#!/usr/bin/env python3
"""
Migration script to copy GCS videos to S3 and update database URLs.
Run this on EC2 where both GCS (WIF) and S3 credentials are available.

Usage: python3 migrate_gcs_to_s3.py [--dry-run]
"""

import os
import sys
import tempfile
import psycopg2
import boto3
from google.cloud import storage
from google.auth import default as default_credentials
from google.auth import impersonated_credentials
from urllib.parse import urlparse, unquote
import re

# Configuration - MUST be set in environment
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is required")
    sys.exit(1)

S3_BUCKET = os.environ.get('AWS_S3_BUCKET', 'hydra-assets-seoul')
S3_REGION = os.environ.get('AWS_REGION', 'ap-northeast-2')

# Parse database URL for psycopg2
def get_db_connection():
    """Create a psycopg2 connection from DATABASE_URL.

    Uses the Supabase pooler URL with SSL required for transaction mode.
    Pooler URL format: postgresql://postgres.PROJECT_REF:PASSWORD@...pooler.supabase.com:6543/...
    """
    # Remove pgbouncer query param, add sslmode
    url = DATABASE_URL.split('?')[0]

    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or 6543
    user = parsed.username
    password = parsed.password
    database = parsed.path.lstrip('/')

    print(f"  Connecting to: {host}:{port} as {user}")

    return psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        sslmode='require'
    )

def extract_gcs_path(url):
    """Extract bucket and object path from GCS URL or URI."""
    if not url:
        return None, None

    # Handle gs:// URI format
    if url.startswith('gs://'):
        parts = url[5:].split('/', 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        return parts[0], ''

    # Handle https://storage.googleapis.com/bucket/path format
    if 'storage.googleapis.com' in url:
        # Remove query params (signed URL params)
        url_no_params = url.split('?')[0]
        parsed = urlparse(url_no_params)
        path_parts = parsed.path.lstrip('/').split('/', 1)
        if len(path_parts) >= 2:
            bucket = path_parts[0]
            object_path = unquote(path_parts[1])  # Decode URL encoding
            return bucket, object_path

    return None, None

def generate_s3_key(gcs_path, record_id):
    """Generate S3 key from GCS path or record ID."""
    if gcs_path:
        # Use the same path structure: videos/xxx.mp4 -> videos/xxx.mp4
        return gcs_path
    # Fallback: generate from record ID
    return f"videos/migrated/{record_id}.mp4"

GCP_PROJECT = os.environ.get('TARGET_PROJECT_ID', 'hyb-hydra-dev')
TARGET_SA = os.environ.get('TARGET_SERVICE_ACCOUNT', 'sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com')

# Cache for impersonated credentials (expensive to create)
_impersonated_creds = None

def get_impersonated_credentials():
    """Get impersonated credentials using 2-hop authentication.

    WIF gives us the central SA (hyb-mgmt-prod), but GCS bucket access
    is on the target SA (hyb-hydra-dev). We need to impersonate.
    """
    global _impersonated_creds
    if _impersonated_creds is not None:
        return _impersonated_creds

    print(f"  Setting up credential impersonation → {TARGET_SA}")

    # Get source credentials from WIF (central SA)
    source_credentials, project = default_credentials()

    # Create impersonated credentials for target SA
    _impersonated_creds = impersonated_credentials.Credentials(
        source_credentials=source_credentials,
        target_principal=TARGET_SA,
        target_scopes=['https://www.googleapis.com/auth/cloud-platform']
    )

    return _impersonated_creds

def download_from_gcs(bucket_name, object_path, local_path):
    """Download file from GCS using impersonated credentials."""
    try:
        # Get impersonated credentials (2-hop: WIF → central SA → target SA)
        credentials = get_impersonated_credentials()

        # Create client with impersonated credentials
        client = storage.Client(project=GCP_PROJECT, credentials=credentials)
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_path)
        blob.download_to_filename(local_path)
        print(f"  ✓ Downloaded from GCS: {object_path[:60]}...")
        return True
    except Exception as e:
        print(f"  ✗ GCS download failed: {e}")
        return False

def upload_to_s3(local_path, s3_key):
    """Upload file to S3 and return the URL."""
    try:
        s3_client = boto3.client('s3', region_name=S3_REGION)
        content_type = 'video/mp4'

        s3_client.upload_file(
            local_path,
            S3_BUCKET,
            s3_key,
            ExtraArgs={'ContentType': content_type}
        )

        s3_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        print(f"  ✓ Uploaded to S3: {s3_key[:60]}...")
        return s3_url
    except Exception as e:
        print(f"  ✗ S3 upload failed: {e}")
        return None

def update_database(conn, record_id, output_url=None, composed_output_url=None):
    """Update database record with S3 URLs."""
    try:
        cursor = conn.cursor()

        updates = []
        params = []

        if output_url:
            updates.append("output_url = %s")
            params.append(output_url)

        if composed_output_url:
            updates.append("composed_output_url = %s")
            params.append(composed_output_url)

        if not updates:
            return True

        params.append(record_id)
        query = f"UPDATE video_generations SET {', '.join(updates)} WHERE id = %s"

        cursor.execute(query, params)
        conn.commit()
        print(f"  ✓ Updated database record")
        return True
    except Exception as e:
        print(f"  ✗ Database update failed: {e}")
        conn.rollback()
        return False

def migrate_record(conn, record, dry_run=False):
    """Migrate a single record from GCS to S3."""
    record_id = record['id']
    gcs_uri = record.get('gcs_uri')
    output_url = record.get('output_url')
    composed_output_url = record.get('composed_output_url')

    print(f"\nMigrating record: {record_id}")

    # Determine which fields have GCS URLs
    has_gcs_output = output_url and 'storage.googleapis.com' in output_url
    has_gcs_composed = composed_output_url and 'storage.googleapis.com' in composed_output_url

    if not has_gcs_output and not has_gcs_composed:
        print("  → No GCS URLs to migrate, skipping")
        return True

    # Use gcs_uri if available, otherwise extract from URL
    source_url = gcs_uri or composed_output_url or output_url
    bucket_name, object_path = extract_gcs_path(source_url)

    if not bucket_name or not object_path:
        print(f"  ✗ Could not parse GCS path from: {source_url[:80]}...")
        return False

    print(f"  Source: gs://{bucket_name}/{object_path[:50]}...")

    if dry_run:
        print("  [DRY RUN] Would migrate this record")
        return True

    # Download from GCS
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_file:
        tmp_path = tmp_file.name

    try:
        if not download_from_gcs(bucket_name, object_path, tmp_path):
            return False

        # Generate S3 key
        s3_key = generate_s3_key(object_path, record_id)

        # Upload to S3
        s3_url = upload_to_s3(tmp_path, s3_key)
        if not s3_url:
            return False

        # Update database
        new_output_url = s3_url if has_gcs_output else None
        new_composed_url = s3_url if has_gcs_composed else None

        if not update_database(conn, record_id, new_output_url, new_composed_url):
            return False

        return True
    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def main():
    dry_run = '--dry-run' in sys.argv

    if dry_run:
        print("=" * 60)
        print("DRY RUN MODE - No changes will be made")
        print("=" * 60)

    print("\n📦 GCS to S3 Migration Script")
    print(f"  Target S3 bucket: {S3_BUCKET}")
    print(f"  Database: Supabase")

    # Connect to database
    conn = get_db_connection()
    cursor = conn.cursor()

    # Find all records with GCS URLs
    cursor.execute('''
        SELECT id, gcs_uri, output_url, composed_output_url, created_at
        FROM video_generations
        WHERE output_url LIKE '%storage.googleapis.com%'
           OR composed_output_url LIKE '%storage.googleapis.com%'
        ORDER BY created_at DESC
    ''')

    columns = [desc[0] for desc in cursor.description]
    records = [dict(zip(columns, row)) for row in cursor.fetchall()]

    print(f"\n📊 Found {len(records)} records with GCS URLs\n")

    if not records:
        print("No records to migrate!")
        return

    # Migrate each record
    success_count = 0
    fail_count = 0

    for record in records:
        try:
            if migrate_record(conn, record, dry_run):
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            print(f"  ✗ Unexpected error: {e}")
            fail_count += 1

    print("\n" + "=" * 60)
    print(f"Migration complete!")
    print(f"  ✓ Success: {success_count}")
    print(f"  ✗ Failed: {fail_count}")
    print("=" * 60)

    conn.close()

if __name__ == '__main__':
    main()
