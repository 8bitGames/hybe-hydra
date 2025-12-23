"""
Instagram Graph API Reels Publishing Service
https://developers.facebook.com/docs/instagram-api/guides/content-publishing

Instagram Reels Publishing Requirements:
- Business or Creator Instagram account
- Connected Facebook Page
- 2-step process: Create container → Publish
- Video: 3-90 seconds, recommended ≤60 seconds
- Aspect ratio: 9:16 (vertical)
- Max file size: 1GB
"""

import httpx
import asyncio
from typing import Optional, Dict, Any, Literal
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com"
FACEBOOK_GRAPH_BASE = "https://graph.facebook.com/v21.0"


@dataclass
class InstagramReelSettings:
    share_to_feed: bool = True
    cover_url: Optional[str] = None
    thumb_offset: Optional[int] = None  # Cover frame offset in ms
    location_id: Optional[str] = None
    collaborator_usernames: list[str] = field(default_factory=list)


@dataclass
class InstagramPublishResult:
    success: bool
    media_id: Optional[str] = None
    permalink: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[int] = None


class InstagramPublisher:
    """Instagram Reels Publishing Service"""

    def __init__(self, app_id: str, app_secret: str):
        self.app_id = app_id
        self.app_secret = app_secret

    async def refresh_token(self, access_token: str) -> Dict[str, Any]:
        """
        Refresh Instagram long-lived token (extends by 60 days)
        Can only be done once per 24 hours
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{INSTAGRAM_GRAPH_BASE}/refresh_access_token",
                params={
                    "grant_type": "ig_refresh_token",
                    "access_token": access_token,
                },
            )
            result = response.json()

            if result.get("error"):
                return {
                    "success": False,
                    "error": result.get("error", {}).get("message", "Token refresh failed"),
                }

            return {
                "success": True,
                "access_token": result.get("access_token"),
                "expires_in": result.get("expires_in"),
            }

    async def get_instagram_account_from_page(
        self, access_token: str
    ) -> Dict[str, Any]:
        """Get Instagram Business Account ID from Facebook Page"""
        try:
            async with httpx.AsyncClient() as client:
                # First get user's pages
                pages_response = await client.get(
                    f"{FACEBOOK_GRAPH_BASE}/me/accounts",
                    params={"access_token": access_token},
                )
                pages_data = pages_response.json()

                if pages_data.get("error"):
                    return {
                        "success": False,
                        "error": pages_data["error"].get("message"),
                    }

                if not pages_data.get("data"):
                    return {
                        "success": False,
                        "error": "No Facebook Pages found. Instagram Business accounts require a connected Facebook Page.",
                    }

                # Get Instagram Business Account from first page with Instagram connected
                for page in pages_data["data"]:
                    ig_response = await client.get(
                        f"{FACEBOOK_GRAPH_BASE}/{page['id']}",
                        params={
                            "fields": "instagram_business_account",
                            "access_token": access_token,
                        },
                    )
                    ig_data = ig_response.json()

                    if ig_data.get("instagram_business_account"):
                        return {
                            "success": True,
                            "instagram_account_id": ig_data["instagram_business_account"]["id"],
                            "page_id": page["id"],
                        }

                return {
                    "success": False,
                    "error": "No Instagram Business Account found connected to your Facebook Pages.",
                }
        except Exception as e:
            logger.error(f"[Instagram] get_instagram_account_from_page error: {e}")
            return {"success": False, "error": str(e)}

    async def get_account_info(
        self, access_token: str, instagram_account_id: str
    ) -> Dict[str, Any]:
        """Get Instagram account info"""
        try:
            async with httpx.AsyncClient() as client:
                fields = "id,username,name,account_type,profile_picture_url,followers_count,media_count"
                response = await client.get(
                    f"{INSTAGRAM_GRAPH_BASE}/{instagram_account_id}",
                    params={"fields": fields, "access_token": access_token},
                )
                data = response.json()

                if data.get("error"):
                    return {"success": False, "error": data["error"].get("message")}

                return {
                    "success": True,
                    "id": data.get("id"),
                    "username": data.get("username"),
                    "name": data.get("name"),
                    "account_type": data.get("account_type"),
                    "profile_picture_url": data.get("profile_picture_url"),
                    "followers_count": data.get("followers_count"),
                    "media_count": data.get("media_count"),
                }
        except Exception as e:
            logger.error(f"[Instagram] get_account_info error: {e}")
            return {"success": False, "error": str(e)}

    async def _create_reels_container(
        self,
        access_token: str,
        instagram_account_id: str,
        video_url: str,
        caption: str,
        settings: Optional[InstagramReelSettings] = None,
    ) -> Dict[str, Any]:
        """
        Step 1: Create a media container for Reels
        Returns a container ID that needs to be polled for status
        """
        try:
            logger.info("[Instagram] Creating Reels container...")

            params: Dict[str, str] = {
                "media_type": "REELS",
                "video_url": video_url,
                "caption": caption[:2200],  # Instagram caption limit
                "access_token": access_token,
            }

            # Optional settings
            if settings:
                if settings.share_to_feed is not None:
                    params["share_to_feed"] = str(settings.share_to_feed).lower()
                if settings.cover_url:
                    params["cover_url"] = settings.cover_url
                if settings.thumb_offset is not None:
                    params["thumb_offset"] = str(settings.thumb_offset)
                if settings.location_id:
                    params["location_id"] = settings.location_id
                if settings.collaborator_usernames:
                    params["collaborators"] = ",".join(settings.collaborator_usernames)

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{INSTAGRAM_GRAPH_BASE}/{instagram_account_id}/media",
                    params=params,
                )
                data = response.json()

                if data.get("error"):
                    logger.error(f"[Instagram] Create container error: {data['error']}")
                    return {
                        "success": False,
                        "error": data["error"].get("message"),
                        "error_code": data["error"].get("code"),
                        "error_subcode": data["error"].get("error_subcode"),
                    }

                logger.info(f"[Instagram] Container created: {data.get('id')}")
                return {"success": True, "container_id": data.get("id")}

        except Exception as e:
            logger.error(f"[Instagram] _create_reels_container error: {e}")
            return {"success": False, "error": str(e)}

    async def _check_container_status(
        self, access_token: str, container_id: str
    ) -> Dict[str, Any]:
        """Check container processing status"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{INSTAGRAM_GRAPH_BASE}/{container_id}",
                    params={
                        "fields": "status,status_code",
                        "access_token": access_token,
                    },
                )
                data = response.json()

                if data.get("error"):
                    return {"success": False, "error": data["error"].get("message")}

                return {
                    "success": True,
                    "status": data.get("status"),
                    "status_code": data.get("status_code"),
                }
        except Exception as e:
            logger.error(f"[Instagram] _check_container_status error: {e}")
            return {"success": False, "error": str(e)}

    async def _wait_for_container_ready(
        self,
        access_token: str,
        container_id: str,
        max_attempts: int = 30,
        interval_sec: float = 10.0,
    ) -> Dict[str, Any]:
        """Wait for container to be ready for publishing"""
        logger.info("[Instagram] Waiting for container to be ready...")

        for attempt in range(max_attempts):
            result = await self._check_container_status(access_token, container_id)

            if not result["success"]:
                return {"success": False, "ready": False, "error": result.get("error")}

            status = result.get("status")
            logger.info(
                f"[Instagram] Container status (attempt {attempt + 1}/{max_attempts}): {status}"
            )

            if status == "FINISHED":
                return {"success": True, "ready": True}

            if status in ("ERROR", "EXPIRED"):
                return {
                    "success": False,
                    "ready": False,
                    "error": f"Container status: {status} - {result.get('status_code')}",
                }

            # Wait before next check
            await asyncio.sleep(interval_sec)

        return {
            "success": False,
            "ready": False,
            "error": "Container processing timed out",
        }

    async def _publish_container(
        self, access_token: str, instagram_account_id: str, container_id: str
    ) -> Dict[str, Any]:
        """Step 2: Publish the media container"""
        try:
            logger.info("[Instagram] Publishing container...")

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{INSTAGRAM_GRAPH_BASE}/{instagram_account_id}/media_publish",
                    params={
                        "creation_id": container_id,
                        "access_token": access_token,
                    },
                )
                data = response.json()

                if data.get("error"):
                    logger.error(f"[Instagram] Publish error: {data['error']}")
                    return {
                        "success": False,
                        "error": data["error"].get("message"),
                        "error_code": data["error"].get("code"),
                    }

                media_id = data.get("id")
                logger.info(f"[Instagram] Published successfully: {media_id}")

                # Get permalink
                media_response = await client.get(
                    f"{INSTAGRAM_GRAPH_BASE}/{media_id}",
                    params={"fields": "permalink", "access_token": access_token},
                )
                media_data = media_response.json()

                return {
                    "success": True,
                    "media_id": media_id,
                    "permalink": media_data.get("permalink"),
                }

        except Exception as e:
            logger.error(f"[Instagram] _publish_container error: {e}")
            return {"success": False, "error": str(e)}

    async def publish(
        self,
        access_token: str,
        instagram_account_id: str,
        video_url: str,
        caption: str = "",
        hashtags: list[str] = None,
        settings: Optional[InstagramReelSettings] = None,
    ) -> InstagramPublishResult:
        """
        Full Reels publishing flow
        Creates container → Waits for ready → Publishes

        Args:
            access_token: Instagram/Facebook access token
            instagram_account_id: Instagram Business Account ID
            video_url: URL of the video to upload
            caption: Reel caption
            hashtags: List of hashtags
            settings: Instagram Reel settings
        """
        try:
            hashtags = hashtags or []

            # Combine caption with hashtags
            if hashtags:
                hashtags_str = " ".join(
                    h if h.startswith("#") else f"#{h}" for h in hashtags
                )
                full_caption = f"{caption}\n\n{hashtags_str}"
            else:
                full_caption = caption

            # Step 1: Create container
            container_result = await self._create_reels_container(
                access_token,
                instagram_account_id,
                video_url,
                full_caption,
                settings,
            )

            if not container_result["success"]:
                return InstagramPublishResult(
                    success=False,
                    error=container_result.get("error"),
                    error_code=container_result.get("error_code"),
                )

            container_id = container_result["container_id"]

            # Step 2: Wait for container to be ready
            ready_result = await self._wait_for_container_ready(
                access_token, container_id
            )

            if not ready_result["success"] or not ready_result.get("ready"):
                return InstagramPublishResult(
                    success=False,
                    error=ready_result.get("error", "Container not ready for publishing"),
                )

            # Step 3: Publish
            publish_result = await self._publish_container(
                access_token, instagram_account_id, container_id
            )

            if not publish_result["success"]:
                return InstagramPublishResult(
                    success=False,
                    error=publish_result.get("error"),
                    error_code=publish_result.get("error_code"),
                )

            return InstagramPublishResult(
                success=True,
                media_id=publish_result.get("media_id"),
                permalink=publish_result.get("permalink"),
            )

        except Exception as e:
            logger.error(f"[Instagram] publish error: {e}")
            return InstagramPublishResult(success=False, error=str(e))

    async def get_publishing_limit(
        self, access_token: str, instagram_account_id: str
    ) -> Dict[str, Any]:
        """Get publishing quota/limits"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{INSTAGRAM_GRAPH_BASE}/{instagram_account_id}/content_publishing_limit",
                    params={
                        "fields": "quota_usage,config",
                        "access_token": access_token,
                    },
                )
                data = response.json()

                if data.get("error"):
                    return {"success": False, "error": data["error"].get("message")}

                quota_data = data.get("data", [{}])[0] if data.get("data") else {}
                return {
                    "success": True,
                    "quota_usage": quota_data.get("quota_usage"),
                    "quota_total": quota_data.get("config", {}).get("quota_total"),
                }
        except Exception as e:
            logger.error(f"[Instagram] get_publishing_limit error: {e}")
            return {"success": False, "error": str(e)}
