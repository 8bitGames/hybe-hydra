"""
GCP Workload Identity Federation (WIF) Authentication Module.

Enables AWS Batch workers to authenticate with GCP Vertex AI using:
1. AWS IAM Role credentials (from IMDSv2)
2. GCP Security Token Service (STS) token exchange
3. Service Account impersonation

Authentication Flow:
AWS Batch (IAM Role) → GCP WIF → STS Token → SA Impersonation → Vertex AI

Required Environment Variables:
- GOOGLE_APPLICATION_CREDENTIALS: Path to WIF credential config JSON
- GCP_TARGET_SERVICE_ACCOUNT: Target SA to impersonate (for Vertex AI access)
- GCP_PROJECT_ID: GCP project ID for Vertex AI
- GCP_LOCATION: GCP region (default: us-central1)
"""

import os
import json
import logging
from typing import Optional
from pathlib import Path

import google.auth
from google.auth import impersonated_credentials
from google.auth.transport.requests import Request
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_GCP_LOCATION = "us-central1"
DEFAULT_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
]

# Vertex AI specific scopes
VERTEX_AI_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/aiplatform",
]


class GCPAuthManager:
    """
    Manages GCP authentication using Workload Identity Federation.

    Usage:
        auth_manager = GCPAuthManager()
        credentials = auth_manager.get_credentials()
        access_token = auth_manager.get_access_token()

    WIF Authentication Flow:
        AWS Batch (IAM Role) → GCP WIF → STS Token → SA (from WIF config) → Vertex AI

    If the WIF config already includes service_account_impersonation_url,
    the credentials will already be impersonated and no additional impersonation is needed.
    """

    def __init__(
        self,
        target_service_account: Optional[str] = None,
        project_id: Optional[str] = None,
        location: Optional[str] = None,
        scopes: Optional[list[str]] = None,
    ):
        """
        Initialize GCP Auth Manager.

        Args:
            target_service_account: SA to impersonate (e.g., sa-vertex@project.iam.gserviceaccount.com)
                                    Set to empty string or "skip" to use WIF credentials directly
            project_id: GCP project ID
            location: GCP region for Vertex AI
            scopes: OAuth scopes (defaults to Vertex AI scopes)
        """
        # Check environment variable for target SA
        env_target_sa = os.environ.get("GCP_TARGET_SERVICE_ACCOUNT", "")

        # If env var is empty, "skip", or "none" - use WIF credentials directly
        # This is the default behavior when WIF config already includes impersonation
        if env_target_sa.lower() in ("", "skip", "none"):
            self.target_service_account = None
            self._skip_additional_impersonation = True
        else:
            self.target_service_account = target_service_account or env_target_sa
            self._skip_additional_impersonation = False

        self.project_id = project_id or os.environ.get("GCP_PROJECT_ID", "hyb-hydra-dev")
        self.location = location or os.environ.get("GCP_LOCATION", DEFAULT_GCP_LOCATION)
        self.scopes = scopes or VERTEX_AI_SCOPES

        self._source_credentials = None
        self._target_credentials = None
        self._access_token = None
        self._token_expiry = None

        logger.info(f"GCPAuthManager initialized for project: {self.project_id}")
        if self._skip_additional_impersonation:
            logger.info("Using WIF credentials directly (no additional impersonation)")
        else:
            logger.info(f"Will impersonate SA: {self.target_service_account}")
        logger.info(f"Location: {self.location}")

    def _get_source_credentials(self):
        """
        Get source credentials from WIF configuration.

        This uses the GOOGLE_APPLICATION_CREDENTIALS environment variable
        pointing to the WIF credential config JSON file.
        """
        if self._source_credentials is None:
            logger.info("Loading source credentials from WIF config...")

            # Check for credential config file
            cred_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_file:
                logger.info(f"Using credential file: {cred_file}")

            try:
                # google.auth.default() automatically handles:
                # 1. Service account JSON
                # 2. WIF external account JSON
                # 3. Compute Engine metadata
                # 4. GKE Workload Identity
                self._source_credentials, project = google.auth.default(scopes=DEFAULT_SCOPES)

                if project:
                    logger.info(f"Detected project from credentials: {project}")

                logger.info(f"Source credentials type: {type(self._source_credentials).__name__}")

            except Exception as e:
                logger.error(f"Failed to load source credentials: {e}")
                raise RuntimeError(f"GCP authentication failed: {e}")

        return self._source_credentials

    def _get_impersonated_credentials(self):
        """
        Get impersonated credentials for the target service account.

        This allows the WIF identity to act as the target SA which has
        Vertex AI permissions.
        """
        if self._target_credentials is None:
            source_creds = self._get_source_credentials()

            logger.info(f"Creating impersonated credentials for: {self.target_service_account}")

            try:
                self._target_credentials = impersonated_credentials.Credentials(
                    source_credentials=source_creds,
                    target_principal=self.target_service_account,
                    target_scopes=self.scopes,
                    lifetime=3600,  # 1 hour
                )

                logger.info("Impersonated credentials created successfully")

            except Exception as e:
                logger.error(f"Failed to create impersonated credentials: {e}")
                raise RuntimeError(f"Service account impersonation failed: {e}")

        return self._target_credentials

    def get_credentials(self):
        """
        Get authenticated credentials for GCP API calls.

        If WIF config already includes impersonation, returns WIF credentials directly.
        Otherwise, returns impersonated credentials for the target service account.

        Returns:
            google.auth.credentials.Credentials: Authenticated credentials
        """
        if self._skip_additional_impersonation:
            # WIF config already includes impersonation, use directly
            return self._get_source_credentials()
        else:
            # Additional impersonation needed
            return self._get_impersonated_credentials()

    def get_access_token(self, force_refresh: bool = False) -> str:
        """
        Get a valid access token for Vertex AI API calls.

        Args:
            force_refresh: Force token refresh even if not expired

        Returns:
            str: Valid access token
        """
        credentials = self.get_credentials()

        # Check if refresh is needed
        if force_refresh or not credentials.valid:
            logger.info("Refreshing access token...")
            request = Request()
            credentials.refresh(request)
            logger.info("Access token refreshed successfully")

        if not credentials.token:
            raise RuntimeError("Failed to obtain access token")

        return credentials.token

    def get_auth_headers(self) -> dict:
        """
        Get authorization headers for HTTP requests.

        Returns:
            dict: Headers with Bearer token
        """
        token = self.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def get_vertex_ai_endpoint(self, api_path: str = "") -> str:
        """
        Get the Vertex AI API endpoint URL.

        Args:
            api_path: Additional path after the base endpoint

        Returns:
            str: Full Vertex AI endpoint URL
        """
        base_url = f"https://{self.location}-aiplatform.googleapis.com/v1"
        project_path = f"projects/{self.project_id}/locations/{self.location}"

        if api_path:
            return f"{base_url}/{project_path}/{api_path}"
        return f"{base_url}/{project_path}"

    def validate_auth(self) -> dict:
        """
        Validate authentication by attempting to get credentials.

        Returns:
            dict: Validation result with status and details
        """
        result = {
            "valid": False,
            "project_id": self.project_id,
            "target_sa": self.target_service_account or "(using WIF credentials directly)",
            "location": self.location,
            "skip_impersonation": self._skip_additional_impersonation,
            "error": None,
        }

        try:
            # Try to get access token
            token = self.get_access_token()
            result["valid"] = True
            result["token_preview"] = f"{token[:20]}..." if token else None
            logger.info("Authentication validation successful")

        except Exception as e:
            result["error"] = str(e)
            logger.error(f"Authentication validation failed: {e}")

        return result


# Singleton instance for reuse
_auth_manager: Optional[GCPAuthManager] = None


def get_auth_manager() -> GCPAuthManager:
    """
    Get the singleton GCP Auth Manager instance.

    Returns:
        GCPAuthManager: Configured auth manager
    """
    global _auth_manager
    if _auth_manager is None:
        _auth_manager = GCPAuthManager()
    return _auth_manager


def get_access_token() -> str:
    """
    Convenience function to get an access token.

    Returns:
        str: Valid access token
    """
    return get_auth_manager().get_access_token()


def get_auth_headers() -> dict:
    """
    Convenience function to get auth headers.

    Returns:
        dict: Authorization headers
    """
    return get_auth_manager().get_auth_headers()


# For testing/debugging
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    print("Testing GCP WIF Authentication...")
    print("-" * 50)

    manager = GCPAuthManager()
    result = manager.validate_auth()

    print(f"Valid: {result['valid']}")
    print(f"Project: {result['project_id']}")
    print(f"Target SA: {result['target_sa']}")
    print(f"Location: {result['location']}")

    if result['error']:
        print(f"Error: {result['error']}")
    else:
        print(f"Token: {result['token_preview']}")
