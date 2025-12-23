"""
TikTok Content Posting API Service
https://developers.tiktok.com/doc/content-posting-api-get-started
"""

import httpx
import asyncio
from typing import Optional, Dict, Any, Literal
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)

TIKTOK_API_BASE = "https://open.tiktokapis.com"


class TikTokPrivacyLevel(str, Enum):
    PUBLIC = "PUBLIC_TO_EVERYONE"
    FRIENDS = "MUTUAL_FOLLOW_FRIENDS"
    FOLLOWERS = "FOLLOWER_OF_CREATOR"
    PRIVATE = "SELF_ONLY"


@dataclass
class TikTokPostSettings:
    privacy_level: TikTokPrivacyLevel = TikTokPrivacyLevel.PUBLIC
    disable_duet: bool = False
    disable_comment: bool = False
    disable_stitch: bool = False
    video_cover_timestamp_ms: int = 1000
    brand_content_toggle: bool = False
    brand_organic_toggle: bool = False


@dataclass
class TikTokPublishResult:
    success: bool
    publish_id: Optional[str] = None
    post_id: Optional[str] = None
    post_url: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class TikTokPublisher:
    """TikTok Video Publishing Service"""

    def __init__(self, client_key: str, client_secret: str):
        self.client_key = client_key
        self.client_secret = client_secret

    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh TikTok access token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TIKTOK_API_BASE}/v2/oauth/token/",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_key": self.client_key,
                    "client_secret": self.client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )
            result = response.json()

            if result.get("error"):
                return {
                    "success": False,
                    "error": result.get("error_description", result.get("error")),
                }

            return {
                "success": True,
                "access_token": result.get("access_token"),
                "refresh_token": result.get("refresh_token"),
                "expires_in": result.get("expires_in"),
            }

    async def _download_video(self, video_url: str) -> Dict[str, Any]:
        """Download video from URL"""
        try:
            logger.info(f"[TikTok] Downloading video from: {video_url[:100]}...")
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.get(video_url)

                if response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"Failed to download video: {response.status_code}",
                    }

                video_data = response.content
                logger.info(f"[TikTok] Downloaded {len(video_data)} bytes")

                if len(video_data) == 0:
                    return {"success": False, "error": "Downloaded video is empty"}

                return {
                    "success": True,
                    "data": video_data,
                    "size": len(video_data),
                }
        except Exception as e:
            logger.error(f"[TikTok] Download error: {e}")
            return {"success": False, "error": str(e)}

    async def _init_inbox_upload(
        self,
        access_token: str,
        video_size: int,
        chunk_size: int,
        total_chunk_count: int,
    ) -> Dict[str, Any]:
        """Initialize inbox video upload (sandbox compatible)"""
        request_body = {
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": video_size,
                "chunk_size": chunk_size,
                "total_chunk_count": total_chunk_count,
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TIKTOK_API_BASE}/v2/post/publish/inbox/video/init/",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
                json=request_body,
            )
            result = response.json()
            logger.info(f"[TikTok Inbox] Init response: {result}")

            if result.get("error", {}).get("code") != "ok":
                return {
                    "success": False,
                    "error": result.get("error", {}).get("message", "Init failed"),
                    "error_code": result.get("error", {}).get("code"),
                }

            return {
                "success": True,
                "publish_id": result.get("data", {}).get("publish_id"),
                "upload_url": result.get("data", {}).get("upload_url"),
            }

    async def _init_direct_post(
        self,
        access_token: str,
        video_url: str,
        title: str,
        settings: TikTokPostSettings,
    ) -> Dict[str, Any]:
        """Initialize direct post using PULL_FROM_URL"""
        request_body = {
            "post_info": {
                "title": title[:2200],
                "privacy_level": settings.privacy_level.value,
                "disable_duet": settings.disable_duet,
                "disable_comment": settings.disable_comment,
                "disable_stitch": settings.disable_stitch,
                "video_cover_timestamp_ms": settings.video_cover_timestamp_ms,
                "brand_content_toggle": settings.brand_content_toggle,
                "brand_organic_toggle": settings.brand_organic_toggle,
            },
            "source_info": {
                "source": "PULL_FROM_URL",
                "video_url": video_url,
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TIKTOK_API_BASE}/v2/post/publish/video/init/",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
                json=request_body,
            )
            result = response.json()

            if result.get("error", {}).get("code") != "ok":
                return {
                    "success": False,
                    "error": result.get("error", {}).get("message", "Init failed"),
                }

            return {
                "success": True,
                "publish_id": result.get("data", {}).get("publish_id"),
            }

    async def _upload_chunk(
        self,
        upload_url: str,
        chunk_data: bytes,
        start_byte: int,
        end_byte: int,
        total_size: int,
    ) -> Dict[str, Any]:
        """Upload a video chunk"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.put(
                upload_url,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Length": str(len(chunk_data)),
                    "Content-Range": f"bytes {start_byte}-{end_byte}/{total_size}",
                },
                content=chunk_data,
            )

            if response.status_code not in (200, 201, 206):
                return {
                    "success": False,
                    "error": f"Upload failed: {response.status_code}",
                }

            return {"success": True}

    async def _get_publish_status(
        self, access_token: str, publish_id: str
    ) -> Dict[str, Any]:
        """Get publish status"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TIKTOK_API_BASE}/v2/post/publish/status/fetch/",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
                json={"publish_id": publish_id},
            )
            result = response.json()

            if result.get("error", {}).get("code") != "ok":
                return {
                    "success": False,
                    "error": result.get("error", {}).get("message"),
                }

            return {"success": True, "data": result.get("data")}

    async def _wait_for_publish(
        self,
        access_token: str,
        publish_id: str,
        is_inbox: bool = False,
        max_attempts: int = 30,
        interval_sec: float = 5.0,
    ) -> TikTokPublishResult:
        """Poll publish status until complete"""
        for attempt in range(max_attempts):
            logger.info(f"[TikTok] Status check {attempt + 1}/{max_attempts}")
            status_result = await self._get_publish_status(access_token, publish_id)

            if not status_result["success"]:
                return TikTokPublishResult(
                    success=False,
                    publish_id=publish_id,
                    error=status_result.get("error"),
                )

            status = status_result["data"]["status"]
            logger.info(f"[TikTok] Status: {status}")

            if status == "PUBLISH_COMPLETE":
                post_ids = status_result["data"].get("publicaly_available_post_id", [])
                post_id = post_ids[0] if post_ids else None
                return TikTokPublishResult(
                    success=True,
                    publish_id=publish_id,
                    post_id=post_id,
                    post_url=f"https://www.tiktok.com/@/video/{post_id}" if post_id else None,
                )

            if status == "SEND_TO_USER_INBOX" and is_inbox:
                logger.info("[TikTok] Video sent to inbox successfully!")
                return TikTokPublishResult(success=True, publish_id=publish_id)

            if status == "FAILED":
                return TikTokPublishResult(
                    success=False,
                    publish_id=publish_id,
                    error=status_result["data"].get("fail_reason", "Unknown failure"),
                )

            await asyncio.sleep(interval_sec)

        return TikTokPublishResult(
            success=False,
            publish_id=publish_id,
            error=f"Publish timed out after {max_attempts * interval_sec} seconds",
        )

    async def publish_to_inbox(
        self, access_token: str, video_url: str
    ) -> TikTokPublishResult:
        """
        Publish video to TikTok inbox (sandbox mode)
        Downloads video and uploads via FILE_UPLOAD to user's inbox
        """
        try:
            # Step 1: Download video
            download_result = await self._download_video(video_url)
            if not download_result["success"]:
                return TikTokPublishResult(
                    success=False, error=download_result.get("error")
                )

            video_data = download_result["data"]
            video_size = download_result["size"]

            # Step 2: Calculate chunks
            MIN_CHUNK = 5 * 1024 * 1024  # 5MB
            DEFAULT_CHUNK = 10 * 1024 * 1024  # 10MB
            chunk_size = video_size if video_size < MIN_CHUNK else DEFAULT_CHUNK
            total_chunks = 1 if video_size < MIN_CHUNK else -(-video_size // chunk_size)

            logger.info(f"[TikTok] Upload: {video_size} bytes, {total_chunks} chunks")

            # Step 3: Initialize upload
            init_result = await self._init_inbox_upload(
                access_token, video_size, chunk_size, total_chunks
            )
            if not init_result["success"]:
                return TikTokPublishResult(
                    success=False,
                    error=init_result.get("error"),
                    error_code=init_result.get("error_code"),
                )

            publish_id = init_result["publish_id"]
            upload_url = init_result["upload_url"]
            logger.info(f"[TikTok] Initialized, publish_id: {publish_id}")

            # Step 4: Upload chunks
            for i in range(total_chunks):
                start = i * chunk_size
                end = min(start + chunk_size - 1, video_size - 1)
                chunk = video_data[start : end + 1]

                logger.info(f"[TikTok] Uploading chunk {i + 1}/{total_chunks}")
                upload_result = await self._upload_chunk(
                    upload_url, chunk, start, end, video_size
                )
                if not upload_result["success"]:
                    return TikTokPublishResult(
                        success=False,
                        publish_id=publish_id,
                        error=upload_result.get("error"),
                    )

            # Step 5: Wait for processing
            return await self._wait_for_publish(access_token, publish_id, is_inbox=True)

        except Exception as e:
            logger.error(f"[TikTok] Inbox publish error: {e}")
            return TikTokPublishResult(success=False, error=str(e))

    async def publish_direct(
        self,
        access_token: str,
        video_url: str,
        caption: str,
        hashtags: list[str],
        settings: Optional[TikTokPostSettings] = None,
    ) -> TikTokPublishResult:
        """
        Publish video directly to TikTok (production mode)
        Uses PULL_FROM_URL method - requires verified domain
        """
        try:
            settings = settings or TikTokPostSettings()
            hashtags_str = " ".join(
                h if h.startswith("#") else f"#{h}" for h in hashtags
            )
            title = f"{caption} {hashtags_str}".strip()

            # Initialize publish
            init_result = await self._init_direct_post(
                access_token, video_url, title, settings
            )
            if not init_result["success"]:
                return TikTokPublishResult(
                    success=False, error=init_result.get("error")
                )

            # Wait for publish
            return await self._wait_for_publish(
                access_token, init_result["publish_id"], is_inbox=False
            )

        except Exception as e:
            logger.error(f"[TikTok] Direct publish error: {e}")
            return TikTokPublishResult(success=False, error=str(e))

    async def publish(
        self,
        access_token: str,
        video_url: str,
        caption: str = "",
        hashtags: list[str] = None,
        settings: Optional[TikTokPostSettings] = None,
        mode: Literal["sandbox", "production"] = "sandbox",
    ) -> TikTokPublishResult:
        """
        Main publish method - chooses between inbox and direct post

        Args:
            access_token: TikTok access token
            video_url: URL of the video to publish
            caption: Post caption
            hashtags: List of hashtags
            settings: TikTok post settings
            mode: "sandbox" for inbox upload, "production" for direct post
        """
        hashtags = hashtags or []

        if mode == "sandbox":
            return await self.publish_to_inbox(access_token, video_url)
        else:
            return await self.publish_direct(
                access_token, video_url, caption, hashtags, settings
            )
