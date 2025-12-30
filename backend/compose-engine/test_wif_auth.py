#!/usr/bin/env python3
"""
Test script for WIF (Workload Identity Federation) authentication.

This script validates that GCP authentication is working correctly
using the WIF configuration.

Usage:
    # Make sure you're on EC2 with IAM Role attached
    python3 test_wif_auth.py
"""

import sys
import os
import logging

# Add app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def print_banner(title):
    """Print a formatted banner."""
    width = 70
    print("=" * width)
    print(f"{title:^{width}}")
    print("=" * width)


def check_environment():
    """Check environment variables."""
    print("\n" + "─" * 70)
    print("Environment Variables")
    print("─" * 70)

    required_vars = [
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GCP_PROJECT_ID",
        "GCP_LOCATION",
    ]

    optional_vars = [
        "GCP_TARGET_SERVICE_ACCOUNT",
    ]

    all_ok = True

    for var in required_vars:
        value = os.environ.get(var)
        if value:
            print(f"✓ {var}: {value}")
        else:
            print(f"✗ {var}: NOT SET")
            all_ok = False

    for var in optional_vars:
        value = os.environ.get(var)
        if value:
            print(f"  {var}: {value}")
        else:
            print(f"  {var}: (not set)")

    # Check if credential file exists
    cred_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_file and os.path.exists(cred_file):
        print(f"\n✓ Credential file exists: {cred_file}")

        # Try to read and show config type
        try:
            import json
            with open(cred_file, 'r') as f:
                config = json.load(f)

            auth_type = config.get("type", "unknown")
            print(f"  Type: {auth_type}")

            if auth_type == "external_account":
                audience = config.get("audience", "")
                if audience:
                    print(f"  Audience: {audience[:60]}...")

                sa_url = config.get("service_account_impersonation_url", "")
                if sa_url:
                    # Extract service account email
                    import re
                    match = re.search(r'serviceAccounts/([^:]+):', sa_url)
                    if match:
                        sa_email = match.group(1)
                        print(f"  Service Account: {sa_email}")
        except Exception as e:
            print(f"  Warning: Could not parse config file: {e}")
    elif cred_file:
        print(f"\n✗ Credential file does not exist: {cred_file}")
        all_ok = False

    return all_ok


def test_aws_metadata():
    """Test AWS EC2 metadata service."""
    print("\n" + "─" * 70)
    print("AWS EC2 Metadata Service")
    print("─" * 70)

    try:
        import subprocess

        # Get IMDSv2 token
        result = subprocess.run(
            ['curl', '-s', '-X', 'PUT',
             'http://169.254.169.254/latest/api/token',
             '-H', 'X-aws-ec2-metadata-token-ttl-seconds: 21600'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0 and result.stdout:
            token = result.stdout
            print(f"✓ IMDSv2 token obtained (length: {len(token)})")

            # Get IAM role name
            result2 = subprocess.run(
                ['curl', '-s', '-H', f'X-aws-ec2-metadata-token: {token}',
                 'http://169.254.169.254/latest/meta-data/iam/security-credentials/'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result2.returncode == 0 and result2.stdout:
                role_name = result2.stdout.strip()
                print(f"✓ IAM Role: {role_name}")
                return True
            else:
                print("✗ Could not get IAM Role name")
                print("  Make sure EC2 instance has an IAM Role attached")
                return False
        else:
            print("✗ Could not get IMDSv2 token")
            print("  Are you running on AWS EC2?")
            return False
    except subprocess.TimeoutExpired:
        print("✗ Metadata service timeout")
        print("  Not running on AWS EC2 or network issue")
        return False
    except FileNotFoundError:
        print("⚠ curl not found, skipping metadata test")
        return True
    except Exception as e:
        print(f"⚠ Metadata check error: {e}")
        return True


def test_gcp_auth():
    """Test GCP authentication using gcp_auth module."""
    print("\n" + "─" * 70)
    print("GCP Authentication Test")
    print("─" * 70)

    try:
        # Import only gcp_auth to avoid dependency issues
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "gcp_auth",
            os.path.join(os.path.dirname(__file__), "app/services/gcp_auth.py")
        )
        gcp_auth = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gcp_auth)

        GCPAuthManager = gcp_auth.GCPAuthManager

        print("\nInitializing GCP Auth Manager...")
        auth_manager = GCPAuthManager()

        print("\nValidating authentication...")
        result = auth_manager.validate_auth()

        print(f"\nAuth Mode: {result['auth_mode']}")
        print(f"Project ID: {result['project_id']}")
        print(f"Location: {result['location']}")

        if result.get('target_sa'):
            print(f"Target SA: {result['target_sa']}")

        print("─" * 70)

        if result['valid']:
            print("✓ Authentication SUCCESS")
            if result.get('token_preview'):
                print(f"  Token: {result['token_preview']}")
            return True
        else:
            print("✗ Authentication FAILED")
            if result.get('error'):
                print(f"  Error: {result['error']}")
            return False

    except Exception as e:
        print(f"✗ Authentication test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main test function."""
    print_banner("WIF Authentication Test")
    print(f"\nPython: {sys.version.split()[0]}")
    print(f"Working Directory: {os.getcwd()}")

    # Step 1: Check environment
    if not check_environment():
        print("\n✗ Environment check failed")
        print("\nMake sure to set:")
        print("  export GOOGLE_APPLICATION_CREDENTIALS=/root/gcp-wif-config.json")
        print("  export GCP_PROJECT_ID=hyb-hydra-dev")
        return 1

    # Step 2: Check AWS metadata (optional)
    test_aws_metadata()

    # Step 3: Test GCP authentication
    if not test_gcp_auth():
        print("\n" + "=" * 70)
        print("FAILED: Authentication test failed")
        print("=" * 70)
        return 1

    print("\n" + "=" * 70)
    print("SUCCESS: All tests passed!")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Your application can now use GCP services")
    print("  2. Credentials will auto-refresh")
    print("  3. No service account keys to manage")

    return 0


if __name__ == "__main__":
    sys.exit(main())
