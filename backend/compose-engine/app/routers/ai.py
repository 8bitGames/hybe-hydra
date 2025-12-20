"""AI Generation API router for Vertex AI operations.

Provides endpoints for:
- Image generation (Gemini 3 Pro Image)
- Video generation (Veo 3.1)
- Image-to-Video generation (Veo 3.1 with reference image)
- Audio overlay with FFmpeg
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
    AudioOverlaySettings,
    VideoExtendSettings,
)
from ..models.responses import JobStatus
from ..services.vertex_ai import (
    create_vertex_ai_client,
    VideoGenerationConfig,
    ImageGenerationConfig,
    VideoExtendConfig,
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
# Callback Utilities
# ============================================================

async def send_callback(
    callback_url: str,
    callback_secret: str,
    job_id: str,
    job_type: str,
    status: str,
    output_url: Optional[str] = None,
    error: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    """
    Send completion callback to Next.js.
    Fire-and-forget, never fails the job on callback errors.
    """
    if not callback_url:
        logger.info(f"[{job_id}] No callback URL configured, skipping callback")
        return

    payload = {
        "job_id": job_id,
        "job_type": job_type,
        "status": status,
        "output_url": output_url,
        "error": error,
        "metadata": metadata,
    }

    try:
        logger.info(f"[{job_id}] Sending callback to {callback_url}")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                callback_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Callback-Secret": callback_secret or "",
                },
            )
            if response.status_code == 200:
                logger.info(f"[{job_id}] ✓ Callback sent successfully")
            else:
                logger.warning(f"[{job_id}] Callback returned status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        logger.error(f"[{job_id}] Callback failed (non-fatal): {e}")


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
# Audio Overlay Processing (FFmpeg)
# ============================================================

def _seconds_to_ass_time(seconds: float) -> str:
    """Convert seconds to ASS time format (H:MM:SS.cc)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"


def _generate_ass_subtitles(
    subtitles: list,
    width: int,
    height: int,
    job_id: str = "",
) -> str:
    """Generate ASS subtitle file content for audio overlay subtitles.

    Args:
        subtitles: List of SubtitleEntry objects with text, start, end
        width: Video width
        height: Video height
        job_id: Job ID for logging

    Returns:
        ASS file content as string
    """
    # Calculate font size (5% of height)
    font_size = max(36, int(height * 0.05))

    # ASS uses numpad alignment: 2 = bottom-center
    alignment = 2

    ass_header = f"""[Script Info]
Title: AI Video Subtitles
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK KR,{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,{alignment},20,20,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogue_lines = []
    for i, sub in enumerate(subtitles):
        start_time = _seconds_to_ass_time(sub.start)
        end_time = _seconds_to_ass_time(sub.end)

        # Escape special ASS characters
        text = sub.text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")

        # Add fade effect (300ms in, 300ms out)
        text_with_fade = f"{{\\fad(300,300)}}{text}"

        dialogue_lines.append(
            f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text_with_fade}"
        )
        logger.debug(f"[{job_id}] ASS subtitle {i}: '{text[:30]}...' @ {start_time}->{end_time}")

    return ass_header + "\n".join(dialogue_lines) + "\n"


async def apply_audio_overlay(
    video_data: bytes,
    audio_overlay: AudioOverlaySettings,
    job_id: str,
) -> bytes:
    """
    Apply audio overlay to video using FFmpeg.

    Args:
        video_data: Raw video bytes
        audio_overlay: Audio overlay settings
        job_id: Job ID for logging

    Returns:
        Composed video bytes with audio overlay
    """
    import subprocess
    import tempfile
    from pathlib import Path

    logger.info(f"[{job_id}] Starting audio overlay composition...")

    # FFmpeg paths
    ffmpeg_path = os.environ.get("FFMPEG_BINARY", "/usr/bin/ffmpeg")
    ffprobe_path = os.environ.get("FFPROBE_BINARY", "/usr/bin/ffprobe")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir = Path(temp_dir)
        video_path = temp_dir / "input_video.mp4"
        audio_path = temp_dir / "input_audio.mp3"
        output_path = temp_dir / "output.mp4"

        # Write video data to temp file
        video_path.write_bytes(video_data)
        logger.info(f"[{job_id}] Video written: {len(video_data)} bytes")

        # Download audio
        logger.info(f"[{job_id}] Downloading audio from {audio_overlay.audio_url[:50]}...")
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(audio_overlay.audio_url, follow_redirects=True)
            response.raise_for_status()
            audio_path.write_bytes(response.content)
            logger.info(f"[{job_id}] Audio downloaded: {len(response.content)} bytes")

        # Get video duration using ffprobe
        probe_cmd = [
            ffprobe_path, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ]
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        video_duration = float(result.stdout.strip()) if result.stdout.strip() else 0
        logger.info(f"[{job_id}] Video duration: {video_duration}s")

        # Build audio filters
        audio_filters = []

        # Trim audio if start time specified
        if audio_overlay.audio_start_time > 0:
            audio_filters.append(f"atrim=start={audio_overlay.audio_start_time}")
            audio_filters.append("asetpts=PTS-STARTPTS")

        # Apply volume
        if audio_overlay.audio_volume != 1.0:
            audio_filters.append(f"volume={audio_overlay.audio_volume}")

        # Apply fade in
        if audio_overlay.fade_in > 0:
            audio_filters.append(f"afade=t=in:st=0:d={audio_overlay.fade_in}")

        # Apply fade out
        if audio_overlay.fade_out > 0:
            fade_out_start = max(0, video_duration - audio_overlay.fade_out)
            audio_filters.append(f"afade=t=out:st={fade_out_start}:d={audio_overlay.fade_out}")

        # Trim audio to video duration
        audio_filters.append(f"atrim=duration={video_duration}")

        # Build complex filter
        if audio_overlay.mix_original_audio:
            complex_filter = f"[0:a]volume={audio_overlay.original_audio_volume}[oa];[1:a]{','.join(audio_filters)}[na];[oa][na]amix=inputs=2:duration=first[aout]"
        else:
            complex_filter = f"[1:a]{','.join(audio_filters)}[aout]"

        # Build ASS subtitle file if subtitles provided
        ass_path = None
        if audio_overlay.subtitles and len(audio_overlay.subtitles) > 0:
            logger.info(f"[{job_id}] Generating ASS subtitle file for {len(audio_overlay.subtitles)} lines")
            ass_path = temp_dir / "subtitles.ass"
            ass_content = _generate_ass_subtitles(audio_overlay.subtitles, 1080, 1920, job_id)
            ass_path.write_text(ass_content, encoding="utf-8")
            logger.info(f"[{job_id}] ASS file written: {len(ass_content)} bytes")

        # Build FFmpeg command
        if ass_path:
            # With subtitles - use ASS filter (requires re-encoding)
            escaped_ass = str(ass_path).replace(":", "\\:")
            video_filter = f"ass='{escaped_ass}'"

            cmd = [
                ffmpeg_path, "-y",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-filter_complex", f"[0:v]{video_filter}[vout];{complex_filter}",
                "-map", "[vout]",
                "-map", "[aout]",
                "-c:v", "h264_nvenc",  # GPU encoding
                "-preset", "p4",
                "-cq", "23",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output_path)
            ]
        else:
            # No subtitles - copy video stream (fast)
            cmd = [
                ffmpeg_path, "-y",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-filter_complex", complex_filter,
                "-map", "0:v",
                "-map", "[aout]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output_path)
            ]

        logger.info(f"[{job_id}] Running FFmpeg for audio overlay...")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f"[{job_id}] FFmpeg error: {result.stderr}")
            # Fallback to CPU encoding if GPU fails
            if "h264_nvenc" in str(cmd):
                logger.info(f"[{job_id}] Retrying with CPU encoding...")
                cmd = [c.replace("h264_nvenc", "libx264").replace("-cq", "-crf") for c in cmd]
                cmd = [c for c in cmd if c not in ["-preset", "p4"]]
                # Re-add CPU preset
                for i, c in enumerate(cmd):
                    if c == "-c:v":
                        cmd.insert(i + 2, "-preset")
                        cmd.insert(i + 3, "fast")
                        break
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    raise RuntimeError(f"FFmpeg failed: {result.stderr[:500]}")
            else:
                raise RuntimeError(f"FFmpeg failed: {result.stderr[:500]}")

        logger.info(f"[{job_id}] Audio overlay composition completed")

        # Read output file
        return output_path.read_bytes()


# ============================================================
# Job Processing Functions
# ============================================================

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

    except Exception as e:
        logger.error(f"[{job_id}] Image generation failed: {e}")
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.FAILED,
                error=str(e)
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
        # Use the actual video URI returned by Veo (may differ from our requested storageUri)
        from google.cloud import storage

        actual_video_uri = result.video_uri or output_gcs_uri
        logger.info(f"[{job_id}] Downloading video from: {actual_video_uri}")

        # Parse GCS URI (gs://bucket/path)
        if actual_video_uri.startswith("gs://"):
            uri_parts = actual_video_uri[5:].split("/", 1)
            actual_bucket = uri_parts[0]
            actual_key = uri_parts[1] if len(uri_parts) > 1 else gcs_key
        else:
            actual_bucket = gcs_bucket
            actual_key = gcs_key

        gcs_client = storage.Client()
        bucket = gcs_client.bucket(actual_bucket)
        blob = bucket.blob(actual_key)

        video_bytes = blob.download_as_bytes()

        # Handle audio overlay if configured
        if settings.audio_overlay:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    progress=85,
                    current_step="Applying audio overlay"
                )
            logger.info(f"[{job_id}] Applying audio overlay...")
            try:
                video_bytes = await apply_audio_overlay(
                    video_data=video_bytes,
                    audio_overlay=settings.audio_overlay,
                    job_id=job_id,
                )
                logger.info(f"[{job_id}] Audio overlay applied: {len(video_bytes)} bytes")
            except Exception as e:
                logger.warning(f"[{job_id}] Audio overlay failed, saving video without audio: {e}")

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=95,
                current_step="Uploading to S3"
            )

        output_url = await upload_to_s3(
            video_bytes,
            request.output.s3_bucket,
            request.output.s3_key,
            content_type="video/mp4"
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # Include GCS URI in metadata for future video extensions
        generation_metadata = {
            "gcs_uri": actual_video_uri,
            "extension_count": 0,
        }

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                current_step="Completed",
                output_url=output_url,
                metadata=generation_metadata,
            )

        logger.info(f"[{job_id}] Video generation completed in {duration_ms}ms (gcs_uri: {actual_video_uri})")

        # Send callback to Next.js with gcs_uri in metadata
        await send_callback(
            callback_url=request.callback_url,
            callback_secret=request.callback_secret,
            job_id=job_id,
            job_type=request.job_type.value,
            status="completed",
            output_url=output_url,
            metadata=generation_metadata,
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

        # Send failure callback to Next.js
        await send_callback(
            callback_url=request.callback_url,
            callback_secret=request.callback_secret,
            job_id=job_id,
            job_type=request.job_type.value,
            status="failed",
            error=str(e),
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
        # Use the actual video URI returned by Veo (may differ from our requested storageUri)
        from google.cloud import storage

        actual_video_uri = result.video_uri or output_gcs_uri
        logger.info(f"[{job_id}] Downloading video from: {actual_video_uri}")

        # Parse GCS URI (gs://bucket/path)
        if actual_video_uri.startswith("gs://"):
            uri_parts = actual_video_uri[5:].split("/", 1)
            actual_bucket = uri_parts[0]
            actual_key = uri_parts[1] if len(uri_parts) > 1 else gcs_key
        else:
            actual_bucket = gcs_bucket
            actual_key = gcs_key

        gcs_client = storage.Client()
        bucket = gcs_client.bucket(actual_bucket)
        blob = bucket.blob(actual_key)

        video_bytes = blob.download_as_bytes()

        # Handle audio overlay if configured
        if settings.audio_overlay:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    progress=85,
                    current_step="Applying audio overlay"
                )
            logger.info(f"[{job_id}] Applying audio overlay...")
            try:
                video_bytes = await apply_audio_overlay(
                    video_data=video_bytes,
                    audio_overlay=settings.audio_overlay,
                    job_id=job_id,
                )
                logger.info(f"[{job_id}] Audio overlay applied: {len(video_bytes)} bytes")
            except Exception as e:
                logger.warning(f"[{job_id}] Audio overlay failed, saving video without audio: {e}")

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=95,
                current_step="Uploading to S3"
            )

        output_url = await upload_to_s3(
            video_bytes,
            request.output.s3_bucket,
            request.output.s3_key,
            content_type="video/mp4"
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # Include GCS URI in metadata for future video extensions
        generation_metadata = {
            "gcs_uri": actual_video_uri,
            "extension_count": 0,
        }

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                current_step="Completed",
                output_url=output_url,
                metadata=generation_metadata,
            )

        logger.info(f"[{job_id}] Image-to-video generation completed in {duration_ms}ms (gcs_uri: {actual_video_uri})")

        # Send callback to Next.js with gcs_uri in metadata
        await send_callback(
            callback_url=request.callback_url,
            callback_secret=request.callback_secret,
            job_id=job_id,
            job_type=request.job_type.value,
            status="completed",
            output_url=output_url,
            metadata=generation_metadata,
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

        # Send failure callback to Next.js
        await send_callback(
            callback_url=request.callback_url,
            callback_secret=request.callback_secret,
            job_id=job_id,
            job_type=request.job_type.value,
            status="failed",
            error=str(e),
        )


async def process_video_extend(
    request: AIJobRequest,
    job_queue: Optional[JobQueue]
):
    """
    Process video extension job using Vertex AI Veo 3.1.

    Extends a previously generated Veo video by up to 7 seconds.
    """
    job_id = request.job_id
    start_time = time.time()

    try:
        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.PROCESSING,
                progress=5,
                current_step="Starting video extension"
            )

        settings = request.extend_settings
        if not settings:
            raise ValueError("extend_settings is required for video_extend job")

        # Validate extension count
        if settings.extension_count >= 20:
            raise ValueError("Maximum extension limit (20) reached for this video")

        # Create Vertex AI client
        client = create_vertex_ai_client()

        # Build GCS output URI
        gcs_bucket = request.output.gcs_bucket or os.environ.get('GCS_OUTPUT_BUCKET', 'hydra-ai-outputs')
        gcs_key = f"videos/extended/{job_id}.mp4"
        output_gcs_uri = f"gs://{gcs_bucket}/{gcs_key}"

        config = VideoExtendConfig(
            source_video_gcs_uri=settings.source_gcs_uri,
            prompt=settings.prompt,
            aspect_ratio=VideoAspectRatio(settings.aspect_ratio.value),
        )

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=10,
                current_step="Extending video with Veo 3.1"
            )

        # Extend video (this polls until completion)
        result = await client.extend_video(
            config,
            output_gcs_uri=output_gcs_uri,
            poll_interval=10.0,
            max_wait_time=600.0,  # 10 minutes
        )

        if not result.success:
            raise RuntimeError(result.error or "Video extension failed")

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=80,
                current_step="Downloading from GCS and uploading to S3"
            )

        # Download from GCS and upload to S3
        from google.cloud import storage

        actual_video_uri = result.video_uri or output_gcs_uri
        logger.info(f"[{job_id}] Downloading extended video from: {actual_video_uri}")

        # Parse GCS URI (gs://bucket/path)
        if actual_video_uri.startswith("gs://"):
            uri_parts = actual_video_uri[5:].split("/", 1)
            actual_bucket = uri_parts[0]
            actual_key = uri_parts[1] if len(uri_parts) > 1 else gcs_key
        else:
            actual_bucket = gcs_bucket
            actual_key = gcs_key

        gcs_client = storage.Client()
        bucket = gcs_client.bucket(actual_bucket)
        blob = bucket.blob(actual_key)

        video_bytes = blob.download_as_bytes()

        # Apply audio overlay if configured
        if settings.audio_overlay:
            if job_queue:
                await job_queue.update_job(
                    job_id,
                    progress=85,
                    current_step="Applying audio overlay"
                )
            logger.info(f"[{job_id}] Applying audio overlay to extended video...")
            try:
                video_bytes = await apply_audio_overlay(
                    video_data=video_bytes,
                    audio_overlay=settings.audio_overlay,
                    job_id=job_id,
                )
                logger.info(f"[{job_id}] Audio overlay applied: {len(video_bytes)} bytes")
            except Exception as e:
                logger.warning(f"[{job_id}] Audio overlay failed, saving video without audio: {e}")

        if job_queue:
            await job_queue.update_job(
                job_id,
                progress=95,
                current_step="Uploading to S3"
            )

        output_url = await upload_to_s3(
            video_bytes,
            request.output.s3_bucket,
            request.output.s3_key,
            content_type="video/mp4"
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # Include the new GCS URI in metadata for future extensions
        extended_metadata = {
            "gcs_uri": actual_video_uri,
            "extension_count": settings.extension_count + 1,
            "source_gcs_uri": settings.source_gcs_uri,
        }

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                current_step="Completed",
                output_url=output_url,
                metadata=extended_metadata,
            )

        logger.info(f"[{job_id}] Video extension completed in {duration_ms}ms (extension #{settings.extension_count + 1})")

        # Send callback to Next.js with updated gcs_uri in metadata
        await send_callback(
            callback_url=request.callback_url,
            callback_secret=request.callback_secret,
            job_id=job_id,
            job_type=request.job_type.value,
            status="completed",
            output_url=output_url,
            metadata=extended_metadata,
        )

    except Exception as e:
        logger.error(f"[{job_id}] Video extension failed: {e}")
        duration_ms = int((time.time() - start_time) * 1000)

        if job_queue:
            await job_queue.update_job(
                job_id,
                status=JobStatus.FAILED,
                error=str(e)
            )

        # Send failure callback to Next.js
        await send_callback(
            callback_url=request.callback_url,
            callback_secret=request.callback_secret,
            job_id=job_id,
            job_type=request.job_type.value,
            status="failed",
            error=str(e),
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

    elif request.job_type == AIJobType.VIDEO_EXTEND:
        background_tasks.add_task(process_video_extend, request, job_queue)
        message = "Video extension job queued"

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


@router.post("/video/extend", response_model=AIJobResponse)
async def extend_video(
    request: AIJobRequest,
    background_tasks: BackgroundTasks
):
    """
    Extend a previously generated Veo video by up to 7 seconds.

    Requirements:
    - Source video must be a Veo-generated video (requires GCS URI)
    - Maximum 20 extensions per video
    - Resolution fixed at 720p for extensions
    - Supports only 9:16 or 16:9 aspect ratios

    The extended video will be saved to a new S3 location and the
    new GCS URI will be returned in metadata for future extensions.
    """
    request.job_type = AIJobType.VIDEO_EXTEND

    if not request.extend_settings:
        raise HTTPException(
            status_code=400,
            detail="extend_settings is required for video extension"
        )

    # Validate GCS URI format
    if not request.extend_settings.source_gcs_uri.startswith("gs://"):
        raise HTTPException(
            status_code=400,
            detail="source_gcs_uri must be a valid GCS URI (gs://bucket/path)"
        )

    # Validate extension count
    if request.extend_settings.extension_count >= 20:
        raise HTTPException(
            status_code=400,
            detail="Maximum extension limit (20) reached for this video"
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
