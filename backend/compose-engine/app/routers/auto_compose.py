"""Auto-compose API router for variation generation."""

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import asyncio

from ..models.render_job import (
    RenderRequest, RenderSettings, ImageData, AudioData,
    OutputSettings, VibeType, AspectRatio, EffectPreset
)
from ..services.image_fetcher import ImageFetcher
from ..services.video_renderer import VideoRenderer
from ..utils.job_queue import JobQueue
from ..dependencies import get_job_queue
from ..config import get_settings


router = APIRouter()


class AutoComposeRequest(BaseModel):
    """Request for auto-compose with image search."""
    job_id: str = Field(..., description="Unique job identifier")
    search_query: str = Field(..., description="Main search query")
    search_tags: List[str] = Field(..., description="2-3 tags for image search")
    audio_url: Optional[str] = Field(default=None, description="Audio file URL")
    vibe: str = Field(default="Pop", description="Vibe preset")
    aspect_ratio: str = Field(default="9:16", description="Output aspect ratio")
    target_duration: int = Field(default=15, description="Target duration in seconds")
    campaign_id: Optional[str] = Field(default=None, description="Campaign ID for S3 path")


class AutoComposeResponse(BaseModel):
    """Response for auto-compose request."""
    status: str
    job_id: str
    message: Optional[str] = None
    search_results: Optional[int] = None


async def process_auto_compose(request: AutoComposeRequest, job_queue: Optional[JobQueue]):
    """Background task to process auto-compose job."""
    settings = get_settings()

    try:
        # Update status
        if job_queue:
            await job_queue.update_job(
                request.job_id,
                status="processing",
                progress=5,
                current_step="Searching images..."
            )

        # Search for images using the tags
        image_fetcher = ImageFetcher()

        # Try each tag combination until we get enough images
        all_candidates = []
        for tag in request.search_tags:
            result = await image_fetcher.search(
                query=tag,
                max_results=10,
                min_width=720,
                min_height=720
            )
            all_candidates.extend(result.candidates)

        # Also try the full query
        full_result = await image_fetcher.search(
            query=request.search_query,
            max_results=10,
            min_width=720,
            min_height=720
        )
        all_candidates.extend(full_result.candidates)

        # Remove duplicates based on URL
        seen_urls = set()
        unique_candidates = []
        for candidate in all_candidates:
            if candidate.source_url not in seen_urls:
                seen_urls.add(candidate.source_url)
                unique_candidates.append(candidate)

        if len(unique_candidates) < 3:
            if job_queue:
                await job_queue.update_job(
                    request.job_id,
                    status="failed",
                    error=f"Not enough images found. Only {len(unique_candidates)} images."
                )
            return

        # Select images for the video (8-12 images typically)
        target_image_count = min(12, max(6, len(unique_candidates)))
        selected_images = unique_candidates[:target_image_count]

        if job_queue:
            await job_queue.update_job(
                request.job_id,
                progress=30,
                current_step=f"Found {len(selected_images)} images. Preparing render..."
            )

        # Prepare image data for rendering
        images = [
            ImageData(url=img.source_url, order=i)
            for i, img in enumerate(selected_images)
        ]

        # Map vibe string to enum
        vibe_map = {
            "Exciting": VibeType.EXCITING,
            "Emotional": VibeType.EMOTIONAL,
            "Pop": VibeType.POP,
            "Minimal": VibeType.MINIMAL,
        }
        vibe = vibe_map.get(request.vibe, VibeType.POP)

        # Map aspect ratio
        aspect_map = {
            "9:16": AspectRatio.PORTRAIT,
            "16:9": AspectRatio.LANDSCAPE,
            "1:1": AspectRatio.SQUARE,
        }
        aspect_ratio = aspect_map.get(request.aspect_ratio, AspectRatio.PORTRAIT)

        # Create render request
        s3_folder = request.campaign_id or "auto-compose"
        render_request = RenderRequest(
            job_id=request.job_id,
            images=images,
            audio=AudioData(
                url=request.audio_url or "",
                start_time=0,
                duration=None
            ),
            settings=RenderSettings(
                vibe=vibe,
                effect_preset=EffectPreset.ZOOM_BEAT,
                aspect_ratio=aspect_ratio,
                target_duration=request.target_duration,
            ),
            output=OutputSettings(
                s3_bucket=settings.s3_bucket,
                s3_key=f"compose/{s3_folder}/{request.job_id}.mp4"
            )
        )

        # Render the video
        if job_queue:
            await job_queue.update_job(
                request.job_id,
                progress=40,
                current_step="Rendering video..."
            )

        renderer = VideoRenderer()

        async def progress_callback(job_id: str, progress: int, step: str):
            if job_queue:
                # Map renderer progress (0-100) to overall progress (40-100)
                overall_progress = 40 + int(progress * 0.6)
                await job_queue.update_job(job_id, progress=overall_progress, current_step=step)

        output_url = await renderer.render(render_request, progress_callback)

        # Update completion
        if job_queue:
            await job_queue.update_job(
                request.job_id,
                status="completed",
                progress=100,
                current_step="Completed",
                output_url=output_url,
                metadata={
                    "search_tags": request.search_tags,
                    "vibe": request.vibe,
                    "image_count": len(selected_images),
                }
            )

    except Exception as e:
        if job_queue:
            await job_queue.update_job(
                request.job_id,
                status="failed",
                error=str(e)
            )


@router.post("/auto", response_model=AutoComposeResponse)
async def auto_compose(
    request: AutoComposeRequest,
    background_tasks: BackgroundTasks
):
    """
    Auto-compose: Search images by tags and create a slideshow video.

    This endpoint is designed for creating variations of existing compose videos:
    - Takes 2-3 search tags (extracted from original prompt)
    - Searches for new images
    - Creates a new slideshow with the specified vibe
    """
    job_queue = get_job_queue()

    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    # Start background processing
    background_tasks.add_task(process_auto_compose, request, job_queue)

    return AutoComposeResponse(
        status="accepted",
        job_id=request.job_id,
        message=f"Auto-compose job started with tags: {', '.join(request.search_tags)}"
    )


@router.post("/auto/sync", response_model=dict)
async def auto_compose_sync(request: AutoComposeRequest):
    """
    Synchronous auto-compose (for testing).
    Blocks until complete.
    """
    job_queue = get_job_queue()

    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    await process_auto_compose(request, job_queue)

    if job_queue:
        job = await job_queue.get_job(request.job_id)
        if job:
            return {
                "status": job.get("status", "unknown"),
                "job_id": request.job_id,
                "output_url": job.get("output_url"),
                "error": job.get("error"),
            }

    return {
        "status": "completed",
        "job_id": request.job_id,
    }
