"""Google Cloud Storage client for AI-generated assets.

Used for Veo 3 videos and Imagen images only.
Other assets (FFmpeg renders, etc.) continue to use S3.

Last update: 2025-12-28 - Initial implementation for AI assets.
"""

import os
import logging
from datetime import timedelta
from typing import Optional

from google.cloud import storage
from google.oauth2 import service_account

from ..services.gcp_auth import get_auth_manager

logger = logging.getLogger(__name__)

# Default bucket for AI-generated assets
DEFAULT_AI_BUCKET = "hyb-hydra-dev-ai-output"

# Signed URL expiration (7 days)
DEFAULT_SIGNED_URL_EXPIRATION = timedelta(days=7)


class GCSClient:
    """
    Google Cloud Storage client for AI-generated assets.

    Provides:
    - Upload bytes/files to GCS
    - Generate signed URLs for secure access
    - Download files from GCS

    Uses service account credentials from gcp_auth module.
    """

    def __init__(self, bucket_name: Optional[str] = None):
        """
        Initialize GCS client.

        Args:
            bucket_name: GCS bucket name (defaults to AI output bucket)
        """
        self.bucket_name = bucket_name or os.environ.get(
            "GCS_AI_BUCKET", DEFAULT_AI_BUCKET
        )

        # Get auth manager for credentials
        self.auth_manager = get_auth_manager()

        # Initialize storage client
        self._client: Optional[storage.Client] = None
        self._signing_credentials = None

        logger.info(f"[GCSClient] Initialized for bucket: {self.bucket_name}")

    def _get_client(self) -> storage.Client:
        """Get or create GCS client with Target SA credentials."""
        if self._client is None:
            # Use Target SA credentials from auth manager (for WIF 2-hop)
            # This ensures we use the correct service account for GCS access
            credentials = self.auth_manager.get_credentials()
            self._client = storage.Client(
                project=self.auth_manager.project_id,
                credentials=credentials,
            )
            logger.info(f"[GCSClient] Created storage client for project: {self.auth_manager.project_id}")
            logger.info(f"[GCSClient] Using credentials type: {type(credentials).__name__}")
        return self._client

    def _get_signing_credentials(self):
        """Get credentials for signing URLs.

        For signed URLs, we need service account credentials with private key.
        """
        if self._signing_credentials is None:
            # Check for service account JSON
            sa_json = self.auth_manager._service_account_json
            if sa_json:
                import json
                sa_info = json.loads(sa_json)
                self._signing_credentials = service_account.Credentials.from_service_account_info(sa_info)
                logger.info(f"[GCSClient] Using service account for signing: {sa_info.get('client_email')}")
            else:
                # Try to get credentials from file
                cred_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
                if cred_file and os.path.exists(cred_file):
                    import json
                    with open(cred_file, 'r') as f:
                        cred_config = json.load(f)
                    if cred_config.get("type") == "service_account":
                        self._signing_credentials = service_account.Credentials.from_service_account_file(cred_file)
                        logger.info(f"[GCSClient] Using service account file for signing")

                if self._signing_credentials is None:
                    logger.warning("[GCSClient] No service account credentials for signing, using default")

        return self._signing_credentials

    def upload_bytes(
        self,
        data: bytes,
        gcs_key: str,
        content_type: str = "application/octet-stream",
        bucket_name: Optional[str] = None,
    ) -> str:
        """
        Upload bytes to GCS.

        Args:
            data: Bytes to upload
            gcs_key: Object key (path) in GCS
            content_type: MIME type of the content
            bucket_name: Override bucket name

        Returns:
            GCS URI (gs://bucket/key)
        """
        bucket_name = bucket_name or self.bucket_name
        client = self._get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_key)

        blob.upload_from_string(data, content_type=content_type)

        gcs_uri = f"gs://{bucket_name}/{gcs_key}"
        logger.info(f"[GCSClient] Uploaded {len(data)} bytes to {gcs_uri}")

        return gcs_uri

    def upload_file(
        self,
        local_path: str,
        gcs_key: str,
        content_type: Optional[str] = None,
        bucket_name: Optional[str] = None,
    ) -> str:
        """
        Upload file to GCS.

        Args:
            local_path: Local file path
            gcs_key: Object key (path) in GCS
            content_type: MIME type (auto-detected if not provided)
            bucket_name: Override bucket name

        Returns:
            GCS URI (gs://bucket/key)
        """
        bucket_name = bucket_name or self.bucket_name
        client = self._get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_key)

        blob.upload_from_filename(local_path, content_type=content_type)

        gcs_uri = f"gs://{bucket_name}/{gcs_key}"
        logger.info(f"[GCSClient] Uploaded file {local_path} to {gcs_uri}")

        return gcs_uri

    def generate_signed_url(
        self,
        gcs_key: str,
        expiration: Optional[timedelta] = None,
        bucket_name: Optional[str] = None,
        method: str = "GET",
    ) -> str:
        """
        Generate a signed URL for accessing an object.

        Args:
            gcs_key: Object key (path) in GCS
            expiration: URL expiration time (default: 7 days)
            bucket_name: Override bucket name
            method: HTTP method (GET, PUT, etc.)

        Returns:
            Signed URL string
        """
        bucket_name = bucket_name or self.bucket_name
        expiration = expiration or DEFAULT_SIGNED_URL_EXPIRATION

        client = self._get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_key)

        # Get signing credentials
        signing_creds = self._get_signing_credentials()

        if signing_creds:
            # Use service account credentials for signing
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=expiration,
                method=method,
                credentials=signing_creds,
            )
        else:
            # Fallback: use default credentials (may not work for all setups)
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=expiration,
                method=method,
            )

        logger.info(f"[GCSClient] Generated signed URL for {gcs_key} (expires in {expiration})")
        return signed_url

    def generate_signed_url_from_uri(
        self,
        gcs_uri: str,
        expiration: Optional[timedelta] = None,
        method: str = "GET",
    ) -> str:
        """
        Generate a signed URL from a GCS URI.

        Args:
            gcs_uri: Full GCS URI (gs://bucket/key)
            expiration: URL expiration time (default: 7 days)
            method: HTTP method

        Returns:
            Signed URL string
        """
        if not gcs_uri.startswith("gs://"):
            raise ValueError(f"Invalid GCS URI: {gcs_uri}")

        # Parse gs://bucket/key
        uri_parts = gcs_uri[5:].split("/", 1)
        bucket_name = uri_parts[0]
        gcs_key = uri_parts[1] if len(uri_parts) > 1 else ""

        return self.generate_signed_url(
            gcs_key=gcs_key,
            expiration=expiration,
            bucket_name=bucket_name,
            method=method,
        )

    def download_as_bytes(
        self,
        gcs_key: str,
        bucket_name: Optional[str] = None,
    ) -> bytes:
        """
        Download object as bytes.

        Args:
            gcs_key: Object key (path) in GCS
            bucket_name: Override bucket name

        Returns:
            Object contents as bytes
        """
        bucket_name = bucket_name or self.bucket_name
        client = self._get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_key)

        data = blob.download_as_bytes()
        logger.info(f"[GCSClient] Downloaded {len(data)} bytes from gs://{bucket_name}/{gcs_key}")

        return data

    def download_from_uri(self, gcs_uri: str) -> bytes:
        """
        Download object from GCS URI.

        Args:
            gcs_uri: Full GCS URI (gs://bucket/key)

        Returns:
            Object contents as bytes
        """
        if not gcs_uri.startswith("gs://"):
            raise ValueError(f"Invalid GCS URI: {gcs_uri}")

        uri_parts = gcs_uri[5:].split("/", 1)
        bucket_name = uri_parts[0]
        gcs_key = uri_parts[1] if len(uri_parts) > 1 else ""

        return self.download_as_bytes(gcs_key, bucket_name)

    def exists(
        self,
        gcs_key: str,
        bucket_name: Optional[str] = None,
    ) -> bool:
        """
        Check if object exists in GCS.

        Args:
            gcs_key: Object key (path) in GCS
            bucket_name: Override bucket name

        Returns:
            True if object exists
        """
        bucket_name = bucket_name or self.bucket_name
        client = self._get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_key)

        return blob.exists()

    def delete(
        self,
        gcs_key: str,
        bucket_name: Optional[str] = None,
    ) -> None:
        """
        Delete object from GCS.

        Args:
            gcs_key: Object key (path) in GCS
            bucket_name: Override bucket name
        """
        bucket_name = bucket_name or self.bucket_name
        client = self._get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_key)

        blob.delete()
        logger.info(f"[GCSClient] Deleted gs://{bucket_name}/{gcs_key}")


# Singleton instance
_gcs_client: Optional[GCSClient] = None


def get_gcs_client() -> GCSClient:
    """Get singleton GCS client instance."""
    global _gcs_client
    if _gcs_client is None:
        _gcs_client = GCSClient()
    return _gcs_client
