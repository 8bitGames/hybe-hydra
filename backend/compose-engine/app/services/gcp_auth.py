"""
GCP Workload Identity Federation (WIF) Authentication Module.

Enables AWS Batch workers to authenticate with GCP Vertex AI using:
1. AWS IAM Role credentials (from IMDSv2)
2. GCP Security Token Service (STS) token exchange
3. 2-hop Service Account impersonation (Central SA → Target SA) via CODE

Authentication Flow (2-hop, all in code):
AWS Batch (IAM Role) → GCP WIF (STS only) → Central SA (code impersonation) → Target SA (code impersonation) → Vertex AI

The WIF config should NOT include service_account_impersonation_url (use wif-only config).
Both Central SA and Target SA impersonation are done in code for full control.

Required Environment Variables:
- GOOGLE_APPLICATION_CREDENTIALS: Path to WIF credential config JSON (NO SA impersonation in config)
- GCP_CENTRAL_SERVICE_ACCOUNT: Central SA for 1st hop (e.g., sa-wif-hyb-hydra-dev@hyb-mgmt-prod.iam.gserviceaccount.com)
- GCP_TARGET_SERVICE_ACCOUNT: Target SA for 2nd hop (e.g., sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com)
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
    Manages GCP authentication using Workload Identity Federation with 2-hop impersonation.

    Usage:
        auth_manager = GCPAuthManager()
        credentials = auth_manager.get_credentials()
        access_token = auth_manager.get_access_token()

    2-hop WIF Authentication Flow (all in code):
        1. AWS Batch (IAM Role) → GCP WIF → STS Token (pure WIF, no SA in config)
        2. WIF Token → Central SA (hyb-mgmt-prod) [code impersonation - 1st hop]
        3. Central SA → Target SA (hyb-hydra-dev) [code impersonation - 2nd hop] → Vertex AI

    Use WIF-only config (no service_account_impersonation_url).
    GCP_CENTRAL_SERVICE_ACCOUNT specifies the Central SA for the 1st hop.
    GCP_TARGET_SERVICE_ACCOUNT specifies the Target SA for the 2nd hop.
    """

    def __init__(
        self,
        central_service_account: Optional[str] = None,
        target_service_account: Optional[str] = None,
        project_id: Optional[str] = None,
        location: Optional[str] = None,
        scopes: Optional[list[str]] = None,
    ):
        """
        Initialize GCP Auth Manager for 2-hop impersonation (all in code).

        Args:
            central_service_account: Central SA for 1st hop impersonation
                                     (e.g., sa-wif-hyb-hydra-dev@hyb-mgmt-prod.iam.gserviceaccount.com)
            target_service_account: Target SA for 2nd hop impersonation
                                    (e.g., sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com)
                                    Set to empty string or "skip" to use Central SA credentials only (1-hop)
            project_id: GCP project ID for Vertex AI
            location: GCP region for Vertex AI
            scopes: OAuth scopes (defaults to Vertex AI scopes)
        """
        # Central SA for 1st hop (WIF → Central SA)
        env_central_sa = os.environ.get("GCP_CENTRAL_SERVICE_ACCOUNT", "")
        self.central_service_account = central_service_account or env_central_sa or \
            "sa-wif-hyb-hydra-dev@hyb-mgmt-prod.iam.gserviceaccount.com"

        # Target SA for 2nd hop (Central SA → Target SA)
        env_target_sa = os.environ.get("GCP_TARGET_SERVICE_ACCOUNT", "")
        if env_target_sa.lower() in ("", "skip", "none"):
            self.target_service_account = None
            self._enable_2hop = False
        else:
            self.target_service_account = target_service_account or env_target_sa
            self._enable_2hop = True

        self.project_id = project_id or os.environ.get("GCP_PROJECT_ID", "hyb-hydra-dev")
        self.location = location or os.environ.get("GCP_LOCATION", DEFAULT_GCP_LOCATION)
        self.scopes = scopes or VERTEX_AI_SCOPES

        self._wif_credentials = None      # Pure WIF credentials (no impersonation)
        self._central_credentials = None  # Central SA credentials (1st hop)
        self._target_credentials = None   # Target SA credentials (2nd hop)
        self._access_token = None
        self._token_expiry = None

        logger.info(f"GCPAuthManager initialized for project: {self.project_id}")
        logger.info(f"Central SA (1st hop): {self.central_service_account}")
        logger.info(f"2-hop impersonation: {'ENABLED' if self._enable_2hop else 'DISABLED'}")
        if self._enable_2hop:
            logger.info(f"Target SA (2nd hop): {self.target_service_account}")
        else:
            logger.info("Using Central SA credentials only (1-hop)")
        logger.info(f"Location: {self.location}")

    def _get_wif_credentials(self):
        """
        Get pure WIF credentials (no SA impersonation).

        This uses GOOGLE_APPLICATION_CREDENTIALS pointing to WIF-only config
        (no service_account_impersonation_url).

        Returns:
            Credentials: Pure WIF/STS credentials
        """
        if self._wif_credentials is None:
            logger.info("Loading pure WIF credentials (no SA impersonation)...")

            # Check for credential config file
            cred_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_file:
                logger.info(f"Using WIF config file: {cred_file}")
                try:
                    with open(cred_file, 'r') as f:
                        config = json.load(f)
                        # Verify no SA impersonation in config
                        sa_url = config.get("service_account_impersonation_url")
                        if sa_url:
                            logger.warning(f"Config has service_account_impersonation_url: {sa_url}")
                            logger.warning("For code-based 2-hop, use WIF-only config without SA impersonation")
                        else:
                            logger.info("WIF-only config confirmed (no SA impersonation URL)")
                except Exception as e:
                    logger.warning(f"Could not read config file: {e}")

            try:
                # google.auth.default() with WIF-only config returns pure WIF credentials
                self._wif_credentials, project = google.auth.default(scopes=DEFAULT_SCOPES)

                if project:
                    logger.info(f"Detected project from WIF: {project}")

                logger.info(f"WIF credentials type: {type(self._wif_credentials).__name__}")
                logger.info("WIF STS token exchange ready")

            except Exception as e:
                logger.error(f"Failed to load WIF credentials: {e}")
                raise RuntimeError(f"WIF authentication failed: {e}")

        return self._wif_credentials

    def _get_central_credentials(self):
        """
        Get Central SA credentials via code-based impersonation (1st hop).

        WIF credentials → Central SA (hyb-mgmt-prod)

        Returns:
            Credentials: Central SA credentials
        """
        if self._central_credentials is None:
            # Get pure WIF credentials first
            wif_creds = self._get_wif_credentials()

            logger.info(f"1st hop: WIF → Central SA (code-based impersonation)")
            logger.info(f"Central SA: {self.central_service_account}")

            try:
                self._central_credentials = impersonated_credentials.Credentials(
                    source_credentials=wif_creds,
                    target_principal=self.central_service_account,
                    target_scopes=DEFAULT_SCOPES,
                    lifetime=3600,  # 1 hour
                )

                logger.info("1st hop completed: WIF → Central SA")
                logger.info(f"Central SA credentials type: {type(self._central_credentials).__name__}")

            except Exception as e:
                logger.error(f"Failed 1st hop impersonation (WIF → Central SA): {e}")
                raise RuntimeError(f"1st hop impersonation failed: {e}")

        return self._central_credentials

    def _get_target_credentials(self):
        """
        Get Target SA credentials via code-based impersonation (2nd hop).

        Central SA (hyb-mgmt-prod) → Target SA (hyb-hydra-dev)

        Returns:
            Credentials: Target SA credentials with Vertex AI access
        """
        if self._target_credentials is None:
            # Get Central SA credentials (1st hop result)
            central_creds = self._get_central_credentials()

            logger.info(f"2nd hop: Central SA → Target SA (code-based impersonation)")
            logger.info(f"Target SA: {self.target_service_account}")

            try:
                self._target_credentials = impersonated_credentials.Credentials(
                    source_credentials=central_creds,
                    target_principal=self.target_service_account,
                    target_scopes=self.scopes,
                    lifetime=3600,  # 1 hour
                )

                logger.info("2nd hop completed: Central SA → Target SA")
                logger.info(f"Target SA credentials type: {type(self._target_credentials).__name__}")

            except Exception as e:
                logger.error(f"Failed 2nd hop impersonation (Central SA → Target SA): {e}")
                raise RuntimeError(f"2nd hop impersonation failed: {e}")

        return self._target_credentials

    def get_credentials(self):
        """
        Get authenticated credentials for GCP API calls.

        Code-based 2-hop impersonation flow:
        - 2-hop enabled: WIF → Central SA (code) → Target SA (code) → Vertex AI
        - 2-hop disabled: WIF → Central SA (code) only

        Returns:
            google.auth.credentials.Credentials: Authenticated credentials
        """
        if self._enable_2hop:
            # 2-hop: WIF → Central SA → Target SA (all in code)
            logger.info("Using 2-hop authentication (code-based): WIF → Central SA → Target SA")
            return self._get_target_credentials()
        else:
            # 1-hop: WIF → Central SA only (code-based)
            logger.info("Using 1-hop authentication (code-based): WIF → Central SA")
            return self._get_central_credentials()

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
            "target_sa": self.target_service_account or "(1-hop only, no Target SA)",
            "location": self.location,
            "enable_2hop": self._enable_2hop,
            "auth_mode": "2-hop (WIF → Central SA → Target SA)" if self._enable_2hop else "1-hop (WIF → Central SA)",
            "error": None,
        }

        try:
            # Try to get access token
            token = self.get_access_token()
            result["valid"] = True
            result["token_preview"] = f"{token[:20]}..." if token else None
            logger.info("Authentication validation successful")
            logger.info(f"Auth mode: {result['auth_mode']}")

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

    print("Testing GCP WIF 2-hop Authentication...")
    print("=" * 60)

    manager = GCPAuthManager()
    result = manager.validate_auth()

    print(f"\nAuth Mode: {result['auth_mode']}")
    print(f"2-hop Enabled: {result['enable_2hop']}")
    print(f"Project ID: {result['project_id']}")
    print(f"Target SA: {result['target_sa']}")
    print(f"Location: {result['location']}")
    print("-" * 60)
    print(f"Valid: {result['valid']}")

    if result['error']:
        print(f"Error: {result['error']}")
    else:
        print(f"Token: {result['token_preview']}")

    print("=" * 60)
