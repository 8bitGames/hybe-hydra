"""Social Media Publishing API router.

Provides endpoints for:
- TikTok video publishing (sandbox and direct)
- YouTube Shorts publishing
- Instagram Reels publishing
- Token refresh for all platforms
"""

import os
import time
import asyncio
import logging
import httpx
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException

from ..models.publish_job import (
    PublishPlatform,
    PublishJobStatus,
    PublishJobResponse,
    TikTokPublishRequest,
    YouTubePublishRequest,
    InstagramPublishRequest,
    TikTokPublishResult,
    YouTubePublishResult,
    InstagramPublishResult,
    TokenRefreshRequest,
    TokenRefreshResponse,
    PublishCallback,
)
from ..services.publishers import (
    TikTokPublisher,
    YouTubePublisher,
    InstagramPublisher,
    TikTokPostSettings as TikTokSettings,
    YouTubeShortSettings as YouTubeSettings,
    InstagramReelSettings as InstagramSettings,
)
from ..utils.job_queue import JobQueue
from ..dependencies import get_job_queue
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Configuration
# ============================================================

def get_tiktok_publisher() -> TikTokPublisher:
    """Create TikTok publisher with env credentials."""
    return TikTokPublisher(
        client_key=os.environ.get("TIKTOK_CLIENT_KEY", ""),
        client_secret=os.environ.get("TIKTOK_CLIENT_SECRET", ""),
    )


def get_youtube_publisher() -> YouTubePublisher:
    """Create YouTube publisher with env credentials."""
    return YouTubePublisher(
        client_id=os.environ.get("YOUTUBE_CLIENT_ID", ""),
        client_secret=os.environ.get("YOUTUBE_CLIENT_SECRET", ""),
    )


def get_instagram_publisher() -> InstagramPublisher:
    """Create Instagram publisher with env credentials."""
    return InstagramPublisher(
        app_id=os.environ.get("INSTAGRAM_APP_ID", ""),
        app_secret=os.environ.get("INSTAGRAM_APP_SECRET", ""),
    )


# ============================================================
# Callback Helper
# ============================================================

async def send_callback(
    callback_url: str,
    payload: PublishCallback,
    max_retries: int = 3,
):
    """Send callback to the specified URL."""
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    callback_url,
                    json=payload.model_dump(),
                    headers={"Content-Type": "application/json"},
                )
                if response.status_code < 400:
                    logger.info(f"Callback sent successfully to {callback_url}")
                    return
                logger.warning(
                    f"Callback failed with status {response.status_code}: {response.text}"
                )
        except Exception as e:
            logger.error(f"Callback attempt {attempt + 1} failed: {e}")

        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)  # Exponential backoff

    logger.error(f"All callback attempts failed for {callback_url}")


# ============================================================
# TikTok Publishing
# ============================================================

async def process_tiktok_publish(request: TikTokPublishRequest, job_queue: Optional[JobQueue]):
    """Process TikTok publishing job."""
    job_id = request.job_id
    start_time = time.time()

    try:
        if job_queue:
            await job_queue.update_job(
                job_id,
                status="processing",
                progress=10,
                current_step="Starting TikTok upload",
            )

        publisher = get_tiktok_publisher()

        # Refresh token first
        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=20,
                current_step="Refreshing access token",
            )

        token_result = await publisher.refresh_token(request.credentials.refresh_token)
        if not token_result.get("success"):
            raise RuntimeError(f"Token refresh failed: {token_result.get('error')}")

        access_token = token_result.get("access_token", request.credentials.access_token)

        # Convert settings
        settings = TikTokSettings(
            privacy_level=request.settings.privacy_level.value,
            disable_duet=request.settings.disable_duet,
            disable_comment=request.settings.disable_comment,
            disable_stitch=request.settings.disable_stitch,
            video_cover_timestamp_ms=request.settings.video_cover_timestamp_ms or 0,
        )

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=30,
                current_step="Uploading video to TikTok",
            )

        # Publish
        result = await publisher.publish(
            access_token=access_token,
            video_url=request.video_url,
            caption=request.caption,
            hashtags=request.hashtags,
            settings=settings,
            use_sandbox=request.use_sandbox,
        )

        duration_ms = int((time.time() - start_time) * 1000)

        if result.success:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    status="completed",
                    progress=100,
                    current_step="Completed",
                    output_url=result.publish_id,
                )
            logger.info(f"[{job_id}] TikTok publish completed in {duration_ms}ms")
        else:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    status="failed",
                    error=result.error,
                )
            logger.error(f"[{job_id}] TikTok publish failed: {result.error}")

        # Send callback
        if request.callback_url:
            callback = PublishCallback(
                job_id=job_id,
                platform=PublishPlatform.TIKTOK,
                status=PublishJobStatus.COMPLETED if result.success else PublishJobStatus.FAILED,
                tiktok_result=TikTokPublishResult(
                    success=result.success,
                    publish_id=result.publish_id,
                    error=result.error,
                    status=result.status,
                ),
                duration_ms=duration_ms,
                metadata=request.metadata,
            )
            await send_callback(request.callback_url, callback)

    except Exception as e:
        logger.error(f"[{job_id}] TikTok publish error: {e}")
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status="failed",
                error=str(e),
            )

        if request.callback_url:
            callback = PublishCallback(
                job_id=job_id,
                platform=PublishPlatform.TIKTOK,
                status=PublishJobStatus.FAILED,
                tiktok_result=TikTokPublishResult(success=False, error=str(e)),
                duration_ms=duration_ms,
                metadata=request.metadata,
            )
            await send_callback(request.callback_url, callback)


@router.post("/tiktok", response_model=PublishJobResponse)
async def publish_to_tiktok(
    request: TikTokPublishRequest,
    background_tasks: BackgroundTasks,
):
    """
    Publish a video to TikTok.

    The job runs asynchronously in the background.
    Use sandbox mode for testing (inbox upload) or production mode for direct posting.
    """
    job_queue = get_job_queue()

    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    background_tasks.add_task(process_tiktok_publish, request, job_queue)

    logger.info(f"[{request.job_id}] TikTok publish job queued")

    return PublishJobResponse(
        job_id=request.job_id,
        platform=PublishPlatform.TIKTOK,
        status=PublishJobStatus.QUEUED,
        message="TikTok publish job queued",
    )


# ============================================================
# YouTube Publishing
# ============================================================

async def process_youtube_publish(request: YouTubePublishRequest, job_queue: Optional[JobQueue]):
    """Process YouTube publishing job."""
    job_id = request.job_id
    start_time = time.time()

    try:
        if job_queue:
            await job_queue.update_job(
                job_id,
                status="processing",
                progress=10,
                current_step="Starting YouTube upload",
            )

        publisher = get_youtube_publisher()

        # Refresh token first
        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=20,
                current_step="Refreshing access token",
            )

        token_result = await publisher.refresh_token(request.credentials.refresh_token)
        if not token_result.get("success"):
            raise RuntimeError(f"Token refresh failed: {token_result.get('error')}")

        access_token = token_result.get("access_token", request.credentials.access_token)

        # Convert settings
        settings = YouTubeSettings(
            title=request.settings.title,
            privacy_status=request.settings.privacy_status.value,
            category_id=request.settings.category_id,
            made_for_kids=request.settings.made_for_kids,
            tags=request.settings.tags,
        )

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=30,
                current_step="Uploading video to YouTube",
            )

        # Publish
        result = await publisher.publish(
            access_token=access_token,
            video_url=request.video_url,
            caption=request.caption,
            hashtags=request.hashtags,
            settings=settings,
        )

        duration_ms = int((time.time() - start_time) * 1000)

        if result.success:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    status="completed",
                    progress=100,
                    current_step="Completed",
                    output_url=result.video_url,
                )
            logger.info(f"[{job_id}] YouTube publish completed in {duration_ms}ms")
        else:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    status="failed",
                    error=result.error,
                )
            logger.error(f"[{job_id}] YouTube publish failed: {result.error}")

        # Send callback
        if request.callback_url:
            callback = PublishCallback(
                job_id=job_id,
                platform=PublishPlatform.YOUTUBE,
                status=PublishJobStatus.COMPLETED if result.success else PublishJobStatus.FAILED,
                youtube_result=YouTubePublishResult(
                    success=result.success,
                    video_id=result.video_id,
                    video_url=result.video_url,
                    channel_id=result.channel_id,
                    error=result.error,
                    status=result.status,
                ),
                duration_ms=duration_ms,
                metadata=request.metadata,
            )
            await send_callback(request.callback_url, callback)

    except Exception as e:
        logger.error(f"[{job_id}] YouTube publish error: {e}")
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status="failed",
                error=str(e),
            )

        if request.callback_url:
            callback = PublishCallback(
                job_id=job_id,
                platform=PublishPlatform.YOUTUBE,
                status=PublishJobStatus.FAILED,
                youtube_result=YouTubePublishResult(success=False, error=str(e)),
                duration_ms=duration_ms,
                metadata=request.metadata,
            )
            await send_callback(request.callback_url, callback)


@router.post("/youtube", response_model=PublishJobResponse)
async def publish_to_youtube(
    request: YouTubePublishRequest,
    background_tasks: BackgroundTasks,
):
    """
    Publish a video as a YouTube Short.

    The job runs asynchronously in the background.
    Videos are automatically tagged with #Shorts for YouTube Shorts discovery.
    """
    job_queue = get_job_queue()

    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    background_tasks.add_task(process_youtube_publish, request, job_queue)

    logger.info(f"[{request.job_id}] YouTube publish job queued")

    return PublishJobResponse(
        job_id=request.job_id,
        platform=PublishPlatform.YOUTUBE,
        status=PublishJobStatus.QUEUED,
        message="YouTube publish job queued",
    )


# ============================================================
# Instagram Publishing
# ============================================================

async def process_instagram_publish(request: InstagramPublishRequest, job_queue: Optional[JobQueue]):
    """Process Instagram publishing job."""
    job_id = request.job_id
    start_time = time.time()

    try:
        if job_queue:
            await job_queue.update_job(
                job_id,
                status="processing",
                progress=10,
                current_step="Starting Instagram upload",
            )

        publisher = get_instagram_publisher()

        # Note: Instagram uses long-lived tokens that are refreshed differently
        # For now, we'll use the provided token directly
        access_token = request.credentials.access_token

        # Convert settings
        settings = InstagramSettings(
            share_to_feed=request.settings.share_to_feed,
            cover_url=request.settings.cover_url,
            thumb_offset=request.settings.thumb_offset,
            location_id=request.settings.location_id,
            collaborator_usernames=request.settings.collaborator_usernames,
        )

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=30,
                current_step="Creating Instagram Reel container",
            )

        # Publish
        result = await publisher.publish(
            access_token=access_token,
            instagram_account_id=request.credentials.instagram_account_id,
            video_url=request.video_url,
            caption=request.caption,
            hashtags=request.hashtags,
            settings=settings,
        )

        duration_ms = int((time.time() - start_time) * 1000)

        if result.success:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    status="completed",
                    progress=100,
                    current_step="Completed",
                    output_url=result.permalink,
                )
            logger.info(f"[{job_id}] Instagram publish completed in {duration_ms}ms")
        else:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    status="failed",
                    error=result.error,
                )
            logger.error(f"[{job_id}] Instagram publish failed: {result.error}")

        # Send callback
        if request.callback_url:
            callback = PublishCallback(
                job_id=job_id,
                platform=PublishPlatform.INSTAGRAM,
                status=PublishJobStatus.COMPLETED if result.success else PublishJobStatus.FAILED,
                instagram_result=InstagramPublishResult(
                    success=result.success,
                    media_id=result.media_id,
                    permalink=result.permalink,
                    error=result.error,
                    error_code=result.error_code,
                ),
                duration_ms=duration_ms,
                metadata=request.metadata,
            )
            await send_callback(request.callback_url, callback)

    except Exception as e:
        logger.error(f"[{job_id}] Instagram publish error: {e}")
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status="failed",
                error=str(e),
            )

        if request.callback_url:
            callback = PublishCallback(
                job_id=job_id,
                platform=PublishPlatform.INSTAGRAM,
                status=PublishJobStatus.FAILED,
                instagram_result=InstagramPublishResult(success=False, error=str(e)),
                duration_ms=duration_ms,
                metadata=request.metadata,
            )
            await send_callback(request.callback_url, callback)


@router.post("/instagram", response_model=PublishJobResponse)
async def publish_to_instagram(
    request: InstagramPublishRequest,
    background_tasks: BackgroundTasks,
):
    """
    Publish a video as an Instagram Reel.

    The job runs asynchronously in the background.
    Uses 2-step container creation process required by Instagram API.
    """
    job_queue = get_job_queue()

    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    background_tasks.add_task(process_instagram_publish, request, job_queue)

    logger.info(f"[{request.job_id}] Instagram publish job queued")

    return PublishJobResponse(
        job_id=request.job_id,
        platform=PublishPlatform.INSTAGRAM,
        status=PublishJobStatus.QUEUED,
        message="Instagram publish job queued",
    )


# ============================================================
# Token Refresh
# ============================================================

@router.post("/token/refresh", response_model=TokenRefreshResponse)
async def refresh_token(request: TokenRefreshRequest):
    """
    Refresh OAuth access token for a platform.

    Returns new access token (and optionally new refresh token if rotated).
    """
    try:
        if request.platform == PublishPlatform.TIKTOK:
            publisher = get_tiktok_publisher()
            result = await publisher.refresh_token(request.refresh_token)

        elif request.platform == PublishPlatform.YOUTUBE:
            publisher = get_youtube_publisher()
            result = await publisher.refresh_token(request.refresh_token)

        elif request.platform == PublishPlatform.INSTAGRAM:
            publisher = get_instagram_publisher()
            result = await publisher.refresh_token(request.refresh_token)

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported platform: {request.platform}",
            )

        if not result.get("success"):
            return TokenRefreshResponse(
                success=False,
                error=result.get("error", "Token refresh failed"),
            )

        return TokenRefreshResponse(
            success=True,
            access_token=result.get("access_token"),
            refresh_token=result.get("refresh_token"),
            expires_in=result.get("expires_in"),
        )

    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        return TokenRefreshResponse(
            success=False,
            error=str(e),
        )


# ============================================================
# Job Status
# ============================================================

@router.get("/job/{job_id}/status")
async def get_publish_job_status(job_id: str):
    """Get the status of a publishing job."""
    job_queue = get_job_queue()

    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")

    job = await job_queue.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    # Map status
    status_map = {
        "queued": PublishJobStatus.QUEUED,
        "processing": PublishJobStatus.PROCESSING,
        "completed": PublishJobStatus.COMPLETED,
        "failed": PublishJobStatus.FAILED,
    }

    job_status = status_map.get(job.get("status"), PublishJobStatus.PROCESSING)

    return {
        "job_id": job_id,
        "status": job_status,
        "progress": job.get("progress", 0),
        "current_step": job.get("current_step"),
        "output_url": job.get("output_url"),
        "error": job.get("error"),
    }


# ============================================================
# Health Check
# ============================================================

@router.get("/health")
async def publishing_health_check():
    """Health check for publishing service."""
    return {
        "status": "healthy",
        "platforms": ["tiktok", "youtube", "instagram"],
        "tiktok_configured": bool(os.environ.get("TIKTOK_CLIENT_KEY")),
        "youtube_configured": bool(os.environ.get("YOUTUBE_CLIENT_ID")),
        "instagram_configured": bool(os.environ.get("INSTAGRAM_APP_ID")),
    }
