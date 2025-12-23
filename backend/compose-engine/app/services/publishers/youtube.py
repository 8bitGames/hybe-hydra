"""
YouTube Data API v3 Video Upload Service
For YouTube Shorts (<= 60 seconds vertical videos)
"""

import httpx
import asyncio
import tempfile
import os
from typing import Optional, Dict, Any, Literal
from dataclasses import dataclass, field
import logging
import json

from ...utils.s3_client import S3Client

logger = logging.getLogger(__name__)

YOUTUBE_API_BASE = "https://www.googleapis.com"
YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"


@dataclass
class YouTubeShortSettings:
    title: str = "Untitled Short"
    privacy_status: Literal["public", "private", "unlisted"] = "public"
    category_id: str = "22"  # People & Blogs
    made_for_kids: bool = False
    tags: list[str] = field(default_factory=list)


@dataclass
class YouTubePublishResult:
    success: bool
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    channel_id: Optional[str] = None
    error: Optional[str] = None
    status: Optional[str] = None


class YouTubePublisher:
    """YouTube Shorts Publishing Service"""

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh YouTube/Google access token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_id": self.client_id,
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
                "expires_in": result.get("expires_in"),
            }

    async def _download_video(self, video_url: str) -> Dict[str, Any]:
        """Download video from URL (supports S3 URLs with credentials)"""
        try:
            logger.info(f"[YouTube] Downloading video from: {video_url[:100]}...")

            # Check if it's an S3 URL - use S3Client for authenticated download
            if ".s3." in video_url and ".amazonaws.com" in video_url:
                logger.info("[YouTube] Detected S3 URL, using S3Client for download")
                s3_client = S3Client()

                # Download to temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
                    temp_path = tmp.name

                try:
                    await s3_client.download_file(video_url, temp_path)

                    with open(temp_path, "rb") as f:
                        video_data = f.read()

                    logger.info(f"[YouTube] Downloaded {len(video_data)} bytes from S3")
                    return {
                        "success": True,
                        "data": video_data,
                        "size": len(video_data),
                        "content_type": "video/mp4",
                    }
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
            else:
                # Regular HTTP download for non-S3 URLs
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.get(video_url)

                    if response.status_code != 200:
                        return {
                            "success": False,
                            "error": f"Failed to download video: {response.status_code}",
                        }

                    video_data = response.content
                    content_type = response.headers.get("content-type", "video/mp4")
                    logger.info(f"[YouTube] Downloaded {len(video_data)} bytes")

                    return {
                        "success": True,
                        "data": video_data,
                        "size": len(video_data),
                        "content_type": content_type,
                    }
        except Exception as e:
            logger.error(f"[YouTube] Download error: {e}")
            return {"success": False, "error": str(e)}

    async def _get_resumable_upload_url(
        self,
        access_token: str,
        metadata: dict,
        video_size: int,
        content_type: str = "video/mp4",
    ) -> Dict[str, Any]:
        """Get resumable upload URL from YouTube"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                    "X-Upload-Content-Length": str(video_size),
                    "X-Upload-Content-Type": content_type,
                },
                json=metadata,
            )

            if response.status_code != 200:
                error_text = response.text
                logger.error(f"[YouTube] Init upload failed: {error_text}")
                return {
                    "success": False,
                    "error": f"Failed to initialize upload: {error_text}",
                }

            upload_url = response.headers.get("location")
            if not upload_url:
                return {"success": False, "error": "No upload URL in response"}

            return {"success": True, "upload_url": upload_url}

    async def _upload_video(
        self,
        upload_url: str,
        video_data: bytes,
        content_type: str = "video/mp4",
    ) -> Dict[str, Any]:
        """Upload video data to YouTube"""
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.put(
                upload_url,
                headers={
                    "Content-Type": content_type,
                    "Content-Length": str(len(video_data)),
                },
                content=video_data,
            )

            if response.status_code not in (200, 201):
                error_text = response.text
                logger.error(f"[YouTube] Upload failed: {error_text}")
                return {
                    "success": False,
                    "error": f"Upload failed: {response.status_code}",
                }

            result = response.json()
            return {
                "success": True,
                "video_id": result.get("id"),
                "status": result.get("status", {}).get("uploadStatus"),
            }

    async def _get_video_status(
        self, access_token: str, video_id: str
    ) -> Dict[str, Any]:
        """Get video processing status"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{YOUTUBE_API_BASE}/youtube/v3/videos",
                params={
                    "part": "status,processingDetails",
                    "id": video_id,
                },
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code != 200:
                return {"success": False, "error": "Failed to get video status"}

            result = response.json()
            items = result.get("items", [])

            if not items:
                return {"success": False, "error": "Video not found"}

            video = items[0]
            return {
                "success": True,
                "upload_status": video.get("status", {}).get("uploadStatus"),
                "privacy_status": video.get("status", {}).get("privacyStatus"),
                "processing_status": video.get("processingDetails", {}).get(
                    "processingStatus"
                ),
            }

    async def _wait_for_processing(
        self,
        access_token: str,
        video_id: str,
        max_attempts: int = 30,
        interval_sec: float = 10.0,
    ) -> YouTubePublishResult:
        """Wait for video processing to complete"""
        for attempt in range(max_attempts):
            logger.info(f"[YouTube] Processing check {attempt + 1}/{max_attempts}")
            status_result = await self._get_video_status(access_token, video_id)

            if not status_result["success"]:
                return YouTubePublishResult(
                    success=False,
                    video_id=video_id,
                    error=status_result.get("error"),
                )

            upload_status = status_result.get("upload_status")
            processing_status = status_result.get("processing_status")

            logger.info(f"[YouTube] Status: upload={upload_status}, processing={processing_status}")

            if upload_status == "processed":
                return YouTubePublishResult(
                    success=True,
                    video_id=video_id,
                    video_url=f"https://youtube.com/shorts/{video_id}",
                    status="processed",
                )

            if upload_status in ("failed", "rejected", "deleted"):
                return YouTubePublishResult(
                    success=False,
                    video_id=video_id,
                    error=f"Video {upload_status}",
                    status=upload_status,
                )

            # Still processing
            await asyncio.sleep(interval_sec)

        # Processing not complete but upload succeeded
        return YouTubePublishResult(
            success=True,
            video_id=video_id,
            video_url=f"https://youtube.com/shorts/{video_id}",
            status="processing",
        )

    async def get_channel_info(self, access_token: str) -> Dict[str, Any]:
        """Get authenticated user's channel info"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{YOUTUBE_API_BASE}/youtube/v3/channels",
                params={"part": "snippet,statistics", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code != 200:
                return {"success": False, "error": "Failed to get channel info"}

            result = response.json()
            items = result.get("items", [])

            if not items:
                return {"success": False, "error": "No channel found"}

            channel = items[0]
            snippet = channel.get("snippet", {})

            return {
                "success": True,
                "channel_id": channel.get("id"),
                "title": snippet.get("title"),
                "custom_url": snippet.get("customUrl"),
                "thumbnail_url": snippet.get("thumbnails", {})
                .get("default", {})
                .get("url"),
            }

    async def publish(
        self,
        access_token: str,
        video_url: str,
        caption: str = "",
        hashtags: list[str] = None,
        settings: Optional[YouTubeShortSettings] = None,
    ) -> YouTubePublishResult:
        """
        Upload video as YouTube Short

        Args:
            access_token: YouTube/Google OAuth access token
            video_url: URL of the video to upload
            caption: Video description
            hashtags: List of hashtags
            settings: YouTube Short settings
        """
        try:
            settings = settings or YouTubeShortSettings()
            hashtags = hashtags or []

            # Step 1: Download video
            download_result = await self._download_video(video_url)
            if not download_result["success"]:
                return YouTubePublishResult(
                    success=False, error=download_result.get("error")
                )

            video_data = download_result["data"]
            video_size = download_result["size"]
            content_type = download_result.get("content_type", "video/mp4")

            # Step 2: Prepare metadata
            # Ensure #Shorts is in the description
            all_tags = list(set(settings.tags + hashtags))
            hashtags_str = " ".join(
                h if h.startswith("#") else f"#{h}" for h in all_tags
            )
            shorts_tag = "#Shorts" if "shorts" not in [t.lower().replace("#", "") for t in all_tags] else ""

            title = settings.title[:100]
            description = f"{caption}\n\n{shorts_tag} {hashtags_str}".strip()

            metadata = {
                "snippet": {
                    "title": title,
                    "description": description,
                    "tags": [t.replace("#", "") for t in all_tags] + ["Shorts"],
                    "categoryId": settings.category_id,
                },
                "status": {
                    "privacyStatus": settings.privacy_status,
                    "selfDeclaredMadeForKids": settings.made_for_kids,
                },
            }

            logger.info(f"[YouTube] Uploading: {title[:30]}... ({video_size} bytes)")

            # Step 3: Get resumable upload URL
            init_result = await self._get_resumable_upload_url(
                access_token, metadata, video_size, content_type
            )
            if not init_result["success"]:
                return YouTubePublishResult(
                    success=False, error=init_result.get("error")
                )

            # Step 4: Upload video
            upload_result = await self._upload_video(
                init_result["upload_url"], video_data, content_type
            )
            if not upload_result["success"]:
                return YouTubePublishResult(
                    success=False, error=upload_result.get("error")
                )

            video_id = upload_result["video_id"]
            logger.info(f"[YouTube] Uploaded! Video ID: {video_id}")

            # Step 5: Wait for processing
            return await self._wait_for_processing(access_token, video_id)

        except Exception as e:
            logger.error(f"[YouTube] Publish error: {e}")
            return YouTubePublishResult(success=False, error=str(e))
