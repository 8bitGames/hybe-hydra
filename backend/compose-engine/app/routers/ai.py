"""AI Generation API router for Vertex AI operations.

Provides endpoints for:
- Image generation (Gemini 3 Pro Image)
- Video generation (Veo 3.1)
- Image-to-Video generation (Veo 3.1 with reference image)

This replaces AWS Batch AI worker functionality with direct EC2 execution.
"""

import os
import time
import base64
import asyncio
import logging
import httpx
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from ..models.ai_job import (
    AIJobRequest,
    AIJobResponse,
    AIJobStatus,
    AIJobType,
    AIJobCallback,
)
from ..models.responses import JobStatus
from ..services.vertex_ai import (
    create_vertex_ai_client,
    VideoGenerationConfig,
    ImageGenerationConfig,
    VideoAspectRatio,
    ImageAspectRatio,
    GenerationResult,
)
from ..utils.job_queue import JobQueue
from ..dependencies import get_job_queue
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# S3 Upload Utilities
# ============================================================

async def upload_to_s3(
    content: bytes,
    bucket: str,
    key: str,
    content_type: str = "image/png"
) -> str:
    """Upload content to S3 and return the URL."""
    import boto3
    from botocore.config import Config

    s3_client = boto3.client(
        's3',
        region_name=os.environ.get('AWS_REGION', 'ap-northeast-2'),
        config=Config(signature_version='s3v4')
    )

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=content,
        ContentType=content_type,
    )

    # Generate presigned URL or return direct S3 URL
    url = f"https://{bucket}.s3.amazonaws.com/{key}"
    logger.info(f"Uploaded to S3: {url}")
    return url


async def download_image(url: str) -> tuple[bytes, str]:
    """Download image from URL and return bytes and mime type."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        content_type = response.headers.get('content-type', 'image/png')
        return response.content, content_type


# ============================================================
# Job Processing Functions
# ============================================================

async def send_callback(
    callback_url: str,
    callback_secret: Optional[str],
    payload: AIJobCallback
):
    """Send callback notification when job completes."""
    headers = {"Content-Type": "application/json"}
    if callback_secret:
        headers["X-Callback-Secret"] = callback_secret

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                callback_url,
                headers=headers,
                json=payload.model_dump()
            )
            logger.info(f"Callback sent: {response.status_code}")
    except Exception as e:
        logger.error(f"Callback failed: {e}")


async def process_image_generation(
    request: AIJobRequest,
    job_queue: Optional[JobQueue]
):
    """Process image generation job using Vertex AI."""
    job_id = request.job_id
    start_time = time.time()

    try:
        # Update status to processing
        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.PROCESSING,
                progress=10,
                current_step="Starting image generation"
            )

        settings = request.image_settings
        if not settings:
            raise ValueError("image_settings is required for image_generation job")

        # Create Vertex AI client and config
        client = create_vertex_ai_client()
        config = ImageGenerationConfig(
            prompt=settings.prompt,
            aspect_ratio=ImageAspectRatio(settings.aspect_ratio.value),
            negative_prompt=settings.negative_prompt,
            seed=settings.seed,
            number_of_images=settings.number_of_images,
            person_generation=settings.person_generation.value,
        )

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=30,
                current_step="Generating image with Gemini 3 Pro Image"
            )

        # Generate image
        result = await client.generate_image(config)

        if not result.success:
            raise RuntimeError(result.error or "Image generation failed")

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=70,
                current_step="Uploading to S3"
            )

        # Upload to S3
        image_bytes = base64.b64decode(result.image_base64)
        output_url = await upload_to_s3(
            image_bytes,
            request.output.s3_bucket,
            request.output.s3_key,
            content_type="image/png"
        )

        # Update completion status
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                current_step="Completed",
                output_url=output_url
            )

        logger.info(f"[{job_id}] Image generation completed in {duration_ms}ms")

        # Send callback if configured
        if request.callback_url:
            await send_callback(
                request.callback_url,
                request.callback_secret,
                AIJobCallback(
                    job_id=job_id,
                    job_type=AIJobType.IMAGE_GENERATION,
                    status=AIJobStatus.COMPLETED,
                    output_url=output_url,
                    duration_ms=duration_ms,
                )
            )

    except Exception as e:
        logger.error(f"[{job_id}] Image generation failed: {e}")
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.FAILED,
                error=str(e)
            )

        if request.callback_url:
            await send_callback(
                request.callback_url,
                request.callback_secret,
                AIJobCallback(
                    job_id=job_id,
                    job_type=AIJobType.IMAGE_GENERATION,
                    status=AIJobStatus.FAILED,
                    error=str(e),
                    duration_ms=duration_ms,
                )
            )


async def process_video_generation(
    request: AIJobRequest,
    job_queue: Optional[JobQueue]
):
    """Process video generation job using Vertex AI Veo 3.1."""
    job_id = request.job_id
    start_time = time.time()

    try:
        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.PROCESSING,
                progress=5,
                current_step="Starting video generation"
            )

        settings = request.video_settings
        if not settings:
            raise ValueError("video_settings is required for video_generation job")

        # Create Vertex AI client
        client = create_vertex_ai_client()

        # Build GCS output URI (Veo requires GCS for output)
        gcs_bucket = request.output.gcs_bucket or os.environ.get('GCS_OUTPUT_BUCKET', 'hydra-ai-outputs')
        gcs_key = f"videos/{job_id}.mp4"
        output_gcs_uri = f"gs://{gcs_bucket}/{gcs_key}"

        config = VideoGenerationConfig(
            prompt=settings.prompt,
            aspect_ratio=VideoAspectRatio(settings.aspect_ratio.value),
            duration_seconds=settings.duration_seconds.value,
            negative_prompt=settings.negative_prompt,
            seed=settings.seed,
            person_generation=settings.person_generation.value,
            generate_audio=settings.generate_audio,
        )

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=10,
                current_step="Generating video with Veo 3.1"
            )

        # Generate video (this polls until completion)
        result = await client.generate_video(
            config,
            output_gcs_uri=output_gcs_uri,
            poll_interval=10.0,
            max_wait_time=600.0,  # 10 minutes
        )

        if not result.success:
            raise RuntimeError(result.error or "Video generation failed")

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=80,
                current_step="Downloading from GCS and uploading to S3"
            )

        # Download from GCS and upload to S3
        from google.cloud import storage
        gcs_client = storage.Client()
        bucket = gcs_client.bucket(gcs_bucket)
        blob = bucket.blob(gcs_key)

        video_bytes = blob.download_as_bytes()

        output_url = await upload_to_s3(
            video_bytes,
            request.output.s3_bucket,
            request.output.s3_key,
            content_type="video/mp4"
        )

        # Handle audio overlay if configured
        if settings.audio_overlay:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    progress=90,
                    current_step="Applying audio overlay"
                )
            # TODO: Implement FFmpeg audio overlay
            logger.info(f"[{job_id}] Audio overlay requested but not yet implemented")

        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                current_step="Completed",
                output_url=output_url
            )

        logger.info(f"[{job_id}] Video generation completed in {duration_ms}ms")

        if request.callback_url:
            await send_callback(
                request.callback_url,
                request.callback_secret,
                AIJobCallback(
                    job_id=job_id,
                    job_type=AIJobType.VIDEO_GENERATION,
                    status=AIJobStatus.COMPLETED,
                    output_url=output_url,
                    duration_ms=duration_ms,
                )
            )

    except Exception as e:
        logger.error(f"[{job_id}] Video generation failed: {e}")
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.FAILED,
                error=str(e)
            )

        if request.callback_url:
            await send_callback(
                request.callback_url,
                request.callback_secret,
                AIJobCallback(
                    job_id=job_id,
                    job_type=AIJobType.VIDEO_GENERATION,
                    status=AIJobStatus.FAILED,
                    error=str(e),
                    duration_ms=duration_ms,
                )
            )


async def process_image_to_video(
    request: AIJobRequest,
    job_queue: Optional[JobQueue]
):
    """Process image-to-video job using Vertex AI Veo 3.1."""
    job_id = request.job_id
    start_time = time.time()

    try:
        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.PROCESSING,
                progress=5,
                current_step="Starting image-to-video generation"
            )

        settings = request.i2v_settings
        if not settings:
            raise ValueError("i2v_settings is required for image_to_video job")

        # Download reference image
        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=10,
                current_step="Downloading reference image"
            )

        image_bytes, mime_type = await download_image(settings.reference_image_url)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')

        # Normalize mime type
        if 'jpeg' in mime_type or 'jpg' in mime_type:
            mime_type = 'image/jpeg'
        elif 'png' in mime_type:
            mime_type = 'image/png'
        else:
            mime_type = 'image/png'

        # Create Vertex AI client
        client = create_vertex_ai_client()

        # Build GCS output URI
        gcs_bucket = request.output.gcs_bucket or os.environ.get('GCS_OUTPUT_BUCKET', 'hydra-ai-outputs')
        gcs_key = f"videos/{job_id}.mp4"
        output_gcs_uri = f"gs://{gcs_bucket}/{gcs_key}"

        config = VideoGenerationConfig(
            prompt=settings.prompt,
            aspect_ratio=VideoAspectRatio(settings.aspect_ratio.value),
            duration_seconds=settings.duration_seconds.value,
            negative_prompt=settings.negative_prompt,
            seed=settings.seed,
            person_generation=settings.person_generation.value,
            generate_audio=settings.generate_audio,
            reference_image_base64=image_base64,
            reference_image_mime_type=mime_type,
        )

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=20,
                current_step="Generating video from image with Veo 3.1"
            )

        # Generate video
        result = await client.generate_video(
            config,
            output_gcs_uri=output_gcs_uri,
            poll_interval=10.0,
            max_wait_time=600.0,
        )

        if not result.success:
            raise RuntimeError(result.error or "Image-to-video generation failed")

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=80,
                current_step="Downloading from GCS and uploading to S3"
            )

        # Download from GCS and upload to S3
        from google.cloud import storage
        gcs_client = storage.Client()
        bucket = gcs_client.bucket(gcs_bucket)
        blob = bucket.blob(gcs_key)

        video_bytes = blob.download_as_bytes()

        output_url = await upload_to_s3(
            video_bytes,
            request.output.s3_bucket,
            request.output.s3_key,
            content_type="video/mp4"
        )

        # Handle audio overlay if configured
        if settings.audio_overlay:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    progress=90,
                    current_step="Applying audio overlay"
                )
            # TODO: Implement FFmpeg audio overlay
            logger.info(f"[{job_id}] Audio overlay requested but not yet implemented")

        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                current_step="Completed",
                output_url=output_url
            )

        logger.info(f"[{job_id}] Image-to-video generation completed in {duration_ms}ms")

        if request.callback_url:
            await send_callback(
                request.callback_url,
                request.callback_secret,
                AIJobCallback(
                    job_id=job_id,
                    job_type=AIJobType.IMAGE_TO_VIDEO,
                    status=AIJobStatus.COMPLETED,
                    output_url=output_url,
                    duration_ms=duration_ms,
                )
            )

    except Exception as e:
        logger.error(f"[{job_id}] Image-to-video generation failed: {e}")
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.FAILED,
                error=str(e)
            )

        if request.callback_url:
            await send_callback(
                request.callback_url,
                request.callback_secret,
                AIJobCallback(
                    job_id=job_id,
                    job_type=AIJobType.IMAGE_TO_VIDEO,
                    status=AIJobStatus.FAILED,
                    error=str(e),
                    duration_ms=duration_ms,
                )
            )


# ============================================================
# API Endpoints
# ============================================================

@router.post("/generate", response_model=AIJobResponse)
async def submit_ai_job(
    request: AIJobRequest,
    background_tasks: BackgroundTasks
):
    """
    Submit an AI generation job (image, video, or image-to-video).

    The job runs asynchronously in the background.
    Poll /ai/job/{job_id}/status for status updates.
    Optionally provide callback_url to receive completion notification.
    """
    job_queue = get_job_queue()

    # Create job entry
    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    # Route to appropriate processor
    if request.job_type == AIJobType.IMAGE_GENERATION:
        background_tasks.add_task(process_image_generation, request, job_queue)
        message = "Image generation job queued"

    elif request.job_type == AIJobType.VIDEO_GENERATION:
        background_tasks.add_task(process_video_generation, request, job_queue)
        message = "Video generation job queued"

    elif request.job_type == AIJobType.IMAGE_TO_VIDEO:
        background_tasks.add_task(process_image_to_video, request, job_queue)
        message = "Image-to-video job queued"

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported job type: {request.job_type}"
        )

    logger.info(f"[{request.job_id}] {message}")

    return AIJobResponse(
        job_id=request.job_id,
        job_type=request.job_type,
        status=AIJobStatus.QUEUED,
        message=message,
    )


@router.post("/image/generate", response_model=AIJobResponse)
async def generate_image(
    request: AIJobRequest,
    background_tasks: BackgroundTasks
):
    """
    Submit an image generation job using Gemini 3 Pro Image.

    Shorthand endpoint that sets job_type to IMAGE_GENERATION.
    """
    request.job_type = AIJobType.IMAGE_GENERATION

    if not request.image_settings:
        raise HTTPException(
            status_code=400,
            detail="image_settings is required for image generation"
        )

    return await submit_ai_job(request, background_tasks)


@router.post("/video/generate", response_model=AIJobResponse)
async def generate_video(
    request: AIJobRequest,
    background_tasks: BackgroundTasks
):
    """
    Submit a video generation job using Veo 3.1.

    Shorthand endpoint that sets job_type to VIDEO_GENERATION.
    """
    request.job_type = AIJobType.VIDEO_GENERATION

    if not request.video_settings:
        raise HTTPException(
            status_code=400,
            detail="video_settings is required for video generation"
        )

    return await submit_ai_job(request, background_tasks)


@router.post("/i2v/generate", response_model=AIJobResponse)
async def generate_image_to_video(
    request: AIJobRequest,
    background_tasks: BackgroundTasks
):
    """
    Submit an image-to-video generation job using Veo 3.1.

    Shorthand endpoint that sets job_type to IMAGE_TO_VIDEO.
    """
    request.job_type = AIJobType.IMAGE_TO_VIDEO

    if not request.i2v_settings:
        raise HTTPException(
            status_code=400,
            detail="i2v_settings is required for image-to-video generation"
        )

    return await submit_ai_job(request, background_tasks)


@router.get("/job/{job_id}/status")
async def get_ai_job_status(job_id: str):
    """Get the status of an AI generation job."""
    job_queue = get_job_queue()

    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")

    job = await job_queue.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    # Map internal status to AIJobStatus
    status_map = {
        JobStatus.QUEUED.value: AIJobStatus.QUEUED,
        JobStatus.PROCESSING.value: AIJobStatus.PROCESSING,
        JobStatus.COMPLETED.value: AIJobStatus.COMPLETED,
        JobStatus.FAILED.value: AIJobStatus.FAILED,
        "queued": AIJobStatus.QUEUED,
        "processing": AIJobStatus.PROCESSING,
        "completed": AIJobStatus.COMPLETED,
        "failed": AIJobStatus.FAILED,
    }

    job_status = status_map.get(job.get("status"), AIJobStatus.PROCESSING)

    return {
        "job_id": job_id,
        "status": job_status,
        "progress": job.get("progress", 0),
        "current_step": job.get("current_step"),
        "output_url": job.get("output_url"),
        "error": job.get("error"),
    }


@router.get("/health")
async def ai_health_check():
    """Health check for AI generation service."""
    try:
        # Check if Vertex AI client can be created
        client = create_vertex_ai_client()
        return {
            "status": "healthy",
            "project_id": client.project_id,
            "location": client.location,
            "veo_model": client.VEO_MODEL,
            "image_model": client.IMAGE_MODEL,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }
