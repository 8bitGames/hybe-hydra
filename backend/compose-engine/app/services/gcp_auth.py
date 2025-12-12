"""
GCP Authentication Module for Vertex AI.

Supports multiple authentication methods:
1. Service Account JSON (recommended for production)
   - GOOGLE_SERVICE_ACCOUNT_JSON: JSON string of service account credentials
2. Workload Identity Federation (WIF) - legacy
   - GOOGLE_APPLICATION_CREDENTIALS: Path to WIF credential config JSON

Required Environment Variables:
- GOOGLE_SERVICE_ACCOUNT_JSON: Service account JSON string (preferred)
- GCP_PROJECT_ID: GCP project ID for Vertex AI
- GCP_LOCATION: GCP region (default: us-central1)

Legacy WIF Environment Variables (if not using service account JSON):
- GOOGLE_APPLICATION_CREDENTIALS: Path to WIF credential config JSON
- GCP_CENTRAL_SERVICE_ACCOUNT: Central SA for 1st hop
- GCP_TARGET_SERVICE_ACCOUNT: Target SA for 2nd hop
"""

import os
import json
import logging
import time
from typing import Optional
from pathlib import Path
import urllib.request
import urllib.parse

import google.auth
from google.auth import impersonated_credentials
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import jwt  # PyJWT for signing

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
    Manages GCP authentication for Vertex AI.

    Supports:
    1. Service Account JSON (recommended) - via GOOGLE_SERVICE_ACCOUNT_JSON env var
    2. Workload Identity Federation (WIF) - legacy, via GOOGLE_APPLICATION_CREDENTIALS

    Usage:
        auth_manager = GCPAuthManager()
        credentials = auth_manager.get_credentials()
        access_token = auth_manager.get_access_token()
    """

    def __init__(
        self,
        service_account_json: Optional[str] = None,
        central_service_account: Optional[str] = None,
        target_service_account: Optional[str] = None,
        project_id: Optional[str] = None,
        location: Optional[str] = None,
        scopes: Optional[list[str]] = None,
    ):
        """
        Initialize GCP Auth Manager.

        Args:
            service_account_json: Service account JSON string (preferred method)
            central_service_account: Central SA for WIF 1st hop impersonation (legacy)
            target_service_account: Target SA for WIF 2nd hop impersonation (legacy)
            project_id: GCP project ID for Vertex AI
            location: GCP region for Vertex AI
            scopes: OAuth scopes (defaults to Vertex AI scopes)
        """
        self.project_id = project_id or os.environ.get("GCP_PROJECT_ID", "hyb-hydra-dev")
        self.location = location or os.environ.get("GCP_LOCATION", DEFAULT_GCP_LOCATION)
        self.scopes = scopes or VERTEX_AI_SCOPES

        # Check for service account JSON first (preferred method)
        self._service_account_json = service_account_json or os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        self._use_service_account = bool(self._service_account_json)

        # WIF-related settings (legacy)
        env_central_sa = os.environ.get("GCP_CENTRAL_SERVICE_ACCOUNT", "")
        self.central_service_account = central_service_account or env_central_sa or \
            "sa-wif-hyb-hydra-dev@hyb-mgmt-prod.iam.gserviceaccount.com"

        env_target_sa = os.environ.get("GCP_TARGET_SERVICE_ACCOUNT", "")
        if env_target_sa.lower() in ("", "skip", "none"):
            self.target_service_account = None
            self._enable_2hop = False
        else:
            self.target_service_account = target_service_account or env_target_sa
            self._enable_2hop = True

        # Credentials cache
        self._sa_credentials = None       # Service Account credentials
        self._wif_credentials = None      # Pure WIF credentials (no impersonation)
        self._central_credentials = None  # Central SA credentials (1st hop)
        self._target_credentials = None   # Target SA credentials (2nd hop)
        self._access_token = None
        self._token_expiry = None

        # VERSION MARKER - v3.0 (2024-12-12) with self-signed JWT support
        logger.info(f"[gcp_auth v3.0] GCPAuthManager initialized for project: {self.project_id}")
        if self._use_service_account:
            logger.info("Auth method: Service Account JSON (direct)")
        else:
            logger.info("Auth method: Workload Identity Federation (WIF)")
            logger.info(f"Central SA (1st hop): {self.central_service_account}")
            logger.info(f"2-hop impersonation: {'ENABLED' if self._enable_2hop else 'DISABLED'}")
            if self._enable_2hop:
                logger.info(f"Target SA (2nd hop): {self.target_service_account}")
        logger.info(f"Location: {self.location}")

    def _get_sa_credentials(self):
        """
        Get credentials from Service Account JSON.

        Returns:
            Credentials: Service Account credentials
        """
        if self._sa_credentials is None:
            logger.info("Loading Service Account credentials from JSON...")

            try:
                sa_info = json.loads(self._service_account_json)

                # Override project_id from service account if not explicitly set
                if sa_info.get("project_id"):
                    self.project_id = sa_info["project_id"]
                    logger.info(f"Project ID from SA: {self.project_id}")

                self._sa_credentials = service_account.Credentials.from_service_account_info(
                    sa_info,
                    scopes=self.scopes,
                )

                logger.info(f"Service Account: {sa_info.get('client_email', 'unknown')}")
                logger.info("Service Account credentials loaded successfully")

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse service account JSON: {e}")
                raise RuntimeError(f"Invalid service account JSON: {e}")
            except Exception as e:
                logger.error(f"Failed to load service account credentials: {e}")
                raise RuntimeError(f"Service account authentication failed: {e}")

        return self._sa_credentials

    def _create_self_signed_jwt(self) -> str:
        """
        Create a self-signed JWT for direct use as Bearer token.

        For Google Cloud APIs, self-signed JWTs with scopes in the 'aud' claim
        can be used directly without token exchange. This is more reliable than
        the OAuth2 token exchange which sometimes returns id_token instead of access_token.

        Returns:
            str: Self-signed JWT usable as Bearer token
        """
        if not self._service_account_json:
            raise RuntimeError("Service account JSON required for JWT creation")

        sa_info = json.loads(self._service_account_json)

        # Create JWT for direct API access (self-signed JWT)
        # For Vertex AI, the audience is the API endpoint
        now = int(time.time())
        jwt_payload = {
            "iss": sa_info["client_email"],
            "sub": sa_info["client_email"],
            "aud": "https://aiplatform.googleapis.com/",  # Vertex AI audience
            "iat": now,
            "exp": now + 3600,  # 1 hour
        }

        # Sign the JWT with the private key
        private_key = sa_info["private_key"]
        signed_jwt = jwt.encode(
            jwt_payload,
            private_key,
            algorithm="RS256",
        )

        logger.info("Self-signed JWT created for Vertex AI")
        return signed_jwt

    def _exchange_jwt_for_access_token(self) -> str:
        """
        Exchange a signed JWT for an OAuth2 access token.

        If the exchange returns an id_token instead of access_token,
        returns the id_token as it can be used as a bearer token for Google Cloud APIs.

        Returns:
            str: Access token or id_token usable as Bearer token
        """
        if not self._service_account_json:
            raise RuntimeError("Service account JSON required for JWT exchange")

        sa_info = json.loads(self._service_account_json)

        # Create JWT for OAuth2 token exchange
        now = int(time.time())
        jwt_payload = {
            "iss": sa_info["client_email"],
            "sub": sa_info["client_email"],
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,  # 1 hour
            "scope": " ".join(self.scopes),
        }

        # Sign the JWT with the private key
        private_key = sa_info["private_key"]
        signed_jwt = jwt.encode(
            jwt_payload,
            private_key,
            algorithm="RS256",
        )

        # Exchange JWT for access token
        token_url = "https://oauth2.googleapis.com/token"
        data = urllib.parse.urlencode({
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": signed_jwt,
        }).encode("utf-8")

        req = urllib.request.Request(token_url, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))

                # Only access_token is valid for Vertex AI - id_token will not work
                access_token = result.get("access_token")
                if access_token:
                    logger.info("Access token obtained via JWT exchange")
                    return access_token

                # id_token is NOT valid for Vertex AI, must use access_token
                id_token = result.get("id_token")
                if id_token and not access_token:
                    logger.warning("OAuth2 returned id_token instead of access_token - this won't work for Vertex AI")
                    raise RuntimeError("OAuth2 returned id_token instead of access_token")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            logger.error(f"JWT exchange failed: {e.code} - {error_body}")
            raise RuntimeError(f"JWT exchange failed: {error_body}")

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

        Priority:
        1. Service Account JSON (if GOOGLE_SERVICE_ACCOUNT_JSON is set)
        2. WIF with impersonation (legacy)

        Returns:
            google.auth.credentials.Credentials: Authenticated credentials
        """
        # Use Service Account JSON if available (preferred)
        if self._use_service_account:
            logger.info("Using Service Account JSON authentication (direct)")
            return self._get_sa_credentials()

        # Fall back to WIF (legacy)
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

        For Service Account JSON authentication, uses self-signed JWT directly
        as the Bearer token (most reliable method for Vertex AI).

        Args:
            force_refresh: Force token refresh even if not expired

        Returns:
            str: Valid access token or self-signed JWT
        """
        # VERSION MARKER - v3.0 with self-signed JWT (2024-12-12)
        logger.info(f"[gcp_auth v3.0] get_access_token() called, _use_service_account={self._use_service_account}")

        # For service account JSON, use self-signed JWT directly (most reliable)
        # Self-signed JWT can be used directly as Bearer token for Google Cloud APIs
        if self._use_service_account:
            logger.info("Using self-signed JWT for Vertex AI authentication")
            try:
                # Self-signed JWT is the most reliable method
                # It bypasses OAuth2 token exchange which sometimes returns id_token
                jwt_token = self._create_self_signed_jwt()
                logger.info("Self-signed JWT created successfully")
                return jwt_token
            except Exception as e:
                logger.warning(f"Self-signed JWT creation failed: {e}")
                logger.info("Falling back to OAuth2 token exchange...")

                # Fallback 1: Try OAuth2 JWT exchange
                try:
                    return self._exchange_jwt_for_access_token()
                except Exception as e2:
                    logger.warning(f"OAuth2 JWT exchange failed: {e2}")
                    logger.info("Falling back to library refresh...")
                    # Fall through to library-based refresh

        credentials = self.get_credentials()

        # Check if refresh is needed
        if force_refresh or not credentials.valid:
            logger.info("Refreshing access token...")
            request = Request()
            try:
                credentials.refresh(request)
                logger.info("Access token refreshed successfully")
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Credentials refresh failed: {error_msg}")
                # Re-raise to let caller handle
                raise RuntimeError(f"Failed to refresh credentials: {error_msg}")

        if not credentials.token:
            raise RuntimeError("Failed to obtain access token - no token after refresh")

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
        # Determine auth mode string
        if self._use_service_account:
            auth_mode = "Service Account JSON (direct)"
        elif self._enable_2hop:
            auth_mode = "2-hop (WIF → Central SA → Target SA)"
        else:
            auth_mode = "1-hop (WIF → Central SA)"

        result = {
            "valid": False,
            "project_id": self.project_id,
            "target_sa": self.target_service_account or "(direct SA, no impersonation)" if self._use_service_account else "(1-hop only)",
            "location": self.location,
            "use_service_account": self._use_service_account,
            "enable_2hop": self._enable_2hop,
            "auth_mode": auth_mode,
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
