"""Video Edit API router for adding audio and subtitles to existing videos."""

from fastapi import APIRouter, HTTPException
import asyncio
import httpx
import logging
import os
import shutil
import time
import uuid
from typing import Optional

from ..models.video_edit import (
    VideoEditRequest,
    VideoEditResponse,
    VideoEditJobStatus,
    SubtitleLine,
)
from ..renderers.filters.text_overlay import (
    TextOverlaySpec,
    apply_text_overlays_ass,
)
from ..renderers.ffmpeg_pipeline import (
    find_ffmpeg,
    is_nvenc_available,
)
from ..utils.s3_client import S3Client
from ..utils.job_queue import JobQueue
from ..utils.db_client import update_video_generation, update_video_generation_progress
from ..dependencies import get_job_queue, get_render_semaphore
from ..config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


async def send_callback(
    callback_url: str,
    job_id: str,
    status: str,
    output_url: Optional[str] = None,
    error: Optional[str] = None,
    progress: Optional[int] = None,
    metadata: Optional[dict] = None
):
    """Send callback to notify job status changes."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "job_id": job_id,
                "status": status,
                "output_url": output_url,
                "error": error,
                "progress": progress,
                "metadata": metadata,
            }
            response = await client.post(callback_url, json=payload)
            if response.status_code != 200:
                logger.error(f"[VideoEdit] Callback failed: {response.status_code}: {response.text}")
            else:
                logger.info(f"[VideoEdit] Callback sent: job={job_id}, status={status}, generation_id={metadata.get('generation_id') if metadata else 'N/A'}")
    except Exception as e:
        logger.error(f"[VideoEdit] Callback error for job {job_id}: {e}")


async def get_video_duration(video_path: str, job_id: str = "") -> float:
    """Get video duration using FFprobe."""
    ffmpeg = find_ffmpeg()
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")

    cmd = [
        ffprobe,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        logger.error(f"[{job_id}] FFprobe failed: {stderr.decode()}")
        raise ValueError("Failed to get video duration")

    duration = float(stdout.decode().strip())
    logger.info(f"[{job_id}] Video duration: {duration:.2f}s")
    return duration


async def get_video_size(video_path: str, job_id: str = "") -> tuple[int, int]:
    """Get video dimensions using FFprobe."""
    ffmpeg = find_ffmpeg()
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")

    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=p=0:s=x",
        video_path
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        logger.error(f"[{job_id}] FFprobe failed: {stderr.decode()}")
        raise ValueError("Failed to get video size")

    output = stdout.decode().strip()
    width, height = map(int, output.split("x"))
    logger.info(f"[{job_id}] Video size: {width}x{height}")
    return width, height


async def replace_audio(
    input_video: str,
    audio_path: str,
    output_path: str,
    video_duration: float,
    audio_start_time: float = 0,
    volume: float = 1.0,
    fade_in: float = 1.0,
    fade_out: float = 2.0,
    job_id: str = "",
) -> bool:
    """Replace video audio with new audio track using FFmpeg.

    This removes the original audio completely and adds the new audio.

    Args:
        input_video: Path to input video
        audio_path: Path to new audio file
        output_path: Path for output video
        video_duration: Duration of video in seconds
        audio_start_time: Start position in audio file (seconds)
        volume: Audio volume (0.0-2.0)
        fade_in: Fade in duration (seconds)
        fade_out: Fade out duration (seconds)
        job_id: Job ID for logging

    Returns:
        True if successful
    """
    ffmpeg = find_ffmpeg()
    start_time = time.time()

    # Build audio filter chain
    # 1. Seek to start position (if specified)
    # 2. Trim to video duration
    # 3. Apply volume
    # 4. Apply fade in/out
    audio_filters = []

    # Volume adjustment
    if volume != 1.0:
        audio_filters.append(f"volume={volume}")

    # Fade in
    if fade_in > 0:
        audio_filters.append(f"afade=t=in:st=0:d={fade_in}")

    # Fade out (relative to video end)
    if fade_out > 0:
        fade_out_start = max(0, video_duration - fade_out)
        audio_filters.append(f"afade=t=out:st={fade_out_start}:d={fade_out}")

    # Build filter string
    audio_filter = ",".join(audio_filters) if audio_filters else None

    # FFmpeg command:
    # -i video (no audio -an not needed, we just don't map it)
    # -ss for audio seek
    # -i audio
    # -map 0:v (video from first input)
    # -map 1:a (audio from second input)
    # -t to limit duration
    # -c:v copy (no video re-encode needed if no subtitle)
    # -c:a aac (encode audio)
    cmd = [
        ffmpeg, "-y",
        "-i", input_video,
    ]

    # Add audio seek if needed
    if audio_start_time > 0:
        cmd.extend(["-ss", str(audio_start_time)])

    cmd.extend(["-i", audio_path])

    # Map video from input 0, audio from input 1
    cmd.extend([
        "-map", "0:v:0",
        "-map", "1:a:0",
    ])

    # Apply audio filter if any
    if audio_filter:
        cmd.extend(["-af", audio_filter])

    # Limit output duration to video duration
    cmd.extend(["-t", str(video_duration)])

    # Video codec: copy (no re-encode)
    # Audio codec: AAC
    cmd.extend([
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_path,
    ])

    logger.info(f"[{job_id}] Replacing audio: start={audio_start_time}s, vol={volume}, fade_in={fade_in}s, fade_out={fade_out}s")
    logger.debug(f"[{job_id}] FFmpeg cmd: {' '.join(cmd[:15])}...")

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    elapsed = time.time() - start_time

    if proc.returncode != 0:
        logger.error(f"[{job_id}] Audio replacement failed ({elapsed:.1f}s): {stderr.decode()[-500:]}")
        return False

    if os.path.exists(output_path):
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        logger.info(f"[{job_id}] Audio replaced: {size_mb:.1f}MB in {elapsed:.1f}s")

    return True


async def process_video_edit(request: VideoEditRequest, job_queue: Optional[JobQueue]):
    """Background task to process video edit job."""
    settings = get_settings()
    job_id = request.job_id
    output_url = None
    error_message = None

    # Get render semaphore for concurrency control
    semaphore = get_render_semaphore()
    semaphore_acquired = False

    # Create job directory
    job_dir = os.path.join(settings.temp_dir, f"video_edit_{job_id}")
    os.makedirs(job_dir, exist_ok=True)

    try:
        # Wait for semaphore
        if semaphore:
            logger.info(f"[VideoEdit] Job {job_id} waiting for render slot...")
            if job_queue:
                await job_queue.update_job(job_id, status="queued", progress=0, current_step="Waiting for render slot...")
            if request.callback_url:
                await send_callback(request.callback_url, job_id, "queued", progress=0, metadata=request.metadata)
            await semaphore.acquire()
            semaphore_acquired = True
            logger.info(f"[VideoEdit] Job {job_id} acquired render slot")

        # Update status to processing
        if job_queue:
            await job_queue.update_job(job_id, status="processing", progress=5, current_step="Downloading video...")
        if request.callback_url:
            await send_callback(request.callback_url, job_id, "processing", progress=5, metadata=request.metadata)

        s3_client = S3Client()

        # Step 1: Download source video
        logger.info(f"[VideoEdit] Job {job_id} downloading video: {request.video_url[:80]}...")
        video_ext = os.path.splitext(request.video_url.split("?")[0])[1] or ".mp4"
        source_video_path = os.path.join(job_dir, f"source{video_ext}")
        await s3_client.download_file(request.video_url, source_video_path)

        if not os.path.exists(source_video_path):
            raise ValueError("Failed to download source video")

        # Get video info
        video_duration = await get_video_duration(source_video_path, job_id)
        video_size = await get_video_size(source_video_path, job_id)

        if job_queue:
            await job_queue.update_job(job_id, progress=20, current_step="Video downloaded. Processing audio...")
        if request.callback_url:
            await send_callback(request.callback_url, job_id, "processing", progress=20, metadata=request.metadata)

        # Current working video path
        current_video = source_video_path

        # Step 2: Replace audio (if provided)
        if request.audio:
            logger.info(f"[VideoEdit] Job {job_id} downloading audio: {request.audio.url[:80]}...")
            audio_ext = os.path.splitext(request.audio.url.split("?")[0])[1] or ".mp3"
            audio_path = os.path.join(job_dir, f"audio{audio_ext}")
            await s3_client.download_file(request.audio.url, audio_path)

            if not os.path.exists(audio_path):
                raise ValueError("Failed to download audio file")

            if job_queue:
                await job_queue.update_job(job_id, progress=40, current_step="Replacing audio...")
            if request.callback_url:
                await send_callback(request.callback_url, job_id, "processing", progress=40, metadata=request.metadata)

            audio_output = os.path.join(job_dir, "with_audio.mp4")
            success = await replace_audio(
                input_video=current_video,
                audio_path=audio_path,
                output_path=audio_output,
                video_duration=video_duration,
                audio_start_time=request.audio.start_time,
                volume=request.audio.volume,
                fade_in=request.audio.fade_in,
                fade_out=request.audio.fade_out,
                job_id=job_id,
            )

            if not success:
                raise ValueError("Failed to replace audio")

            current_video = audio_output

        # Step 3: Add subtitles (if provided)
        if request.subtitles and request.subtitles.lines:
            if job_queue:
                await job_queue.update_job(job_id, progress=60, current_step="Adding subtitles...")
            if request.callback_url:
                await send_callback(request.callback_url, job_id, "processing", progress=60, metadata=request.metadata)

            logger.info(f"[VideoEdit] Job {job_id} adding {len(request.subtitles.lines)} subtitle lines")

            # Convert SubtitleLine to TextOverlaySpec
            overlays = []
            style = request.subtitles.style

            # Map style settings to text_overlay style names
            style_name = "minimal"  # Default
            if style.font_style == "bold":
                style_name = "bold_pop"
            elif style.font_style == "modern":
                style_name = "fade_in"

            for line in request.subtitles.lines:
                duration = line.end - line.start
                if duration <= 0:
                    logger.warning(f"[VideoEdit] Skipping subtitle with invalid duration: {line.text[:30]}...")
                    continue

                overlays.append(TextOverlaySpec(
                    text=line.text,
                    start_time=line.start,
                    duration=duration,
                    style=style_name,
                    animation=style.animation,
                    position=style.position,
                ))

            if overlays:
                subtitle_output = os.path.join(job_dir, "with_subtitles.mp4")
                ffmpeg = find_ffmpeg()

                success = await apply_text_overlays_ass(
                    input_video=current_video,
                    output_video=subtitle_output,
                    overlays=overlays,
                    video_size=video_size,
                    job_id=job_id,
                    ffmpeg_path=ffmpeg,
                )

                if not success:
                    raise ValueError("Failed to add subtitles")

                current_video = subtitle_output
            else:
                logger.warning(f"[VideoEdit] Job {job_id} no valid subtitle lines to add")

        # Step 4: Upload to S3
        if job_queue:
            await job_queue.update_job(job_id, progress=85, current_step="Uploading result...")
        if request.callback_url:
            await send_callback(request.callback_url, job_id, "processing", progress=85, metadata=request.metadata)

        # Determine S3 path
        s3_folder = request.campaign_id or "video-edit"
        s3_key = f"edited/{s3_folder}/{job_id}.mp4"

        logger.info(f"[VideoEdit] Job {job_id} uploading to S3: {s3_key}")
        output_url = await s3_client.upload_file(
            current_video,
            s3_key,
            content_type="video/mp4"
        )

        # Success!
        if job_queue:
            await job_queue.update_job(
                job_id,
                status="completed",
                progress=100,
                current_step="Completed",
                output_url=output_url,
            )

        # PRIMARY: Direct database update (more reliable than callback)
        generation_id = request.metadata.get("generation_id") if request.metadata else None
        if generation_id:
            db_updated = await update_video_generation(
                generation_id=generation_id,
                status="COMPLETED",
                output_url=output_url,
                progress=100,
            )
            if db_updated:
                logger.info(f"[VideoEdit] Job {job_id} DB updated successfully: generation_id={generation_id}")
            else:
                logger.warning(f"[VideoEdit] Job {job_id} DB update failed, falling back to callback")
                # Fallback to callback if DB update fails
                if request.callback_url:
                    await send_callback(request.callback_url, job_id, "completed", output_url=output_url, progress=100, metadata=request.metadata)
        elif request.callback_url:
            # No generation_id, use callback as fallback
            await send_callback(request.callback_url, job_id, "completed", output_url=output_url, progress=100, metadata=request.metadata)

        logger.info(f"[VideoEdit] Job {job_id} completed: {output_url}")

    except Exception as e:
        error_message = str(e)
        logger.error(f"[VideoEdit] Job {job_id} failed: {error_message}")
        import traceback
        logger.error(traceback.format_exc())

        if job_queue:
            await job_queue.update_job(job_id, status="failed", error=error_message)

        # PRIMARY: Direct database update for failure
        generation_id = request.metadata.get("generation_id") if request.metadata else None
        if generation_id:
            db_updated = await update_video_generation(
                generation_id=generation_id,
                status="FAILED",
                error_message=error_message,
                progress=0,
            )
            if db_updated:
                logger.info(f"[VideoEdit] Job {job_id} failure recorded in DB: generation_id={generation_id}")
            else:
                logger.warning(f"[VideoEdit] Job {job_id} DB update failed, falling back to callback")
                if request.callback_url:
                    await send_callback(request.callback_url, job_id, "failed", error=error_message, metadata=request.metadata)
        elif request.callback_url:
            await send_callback(request.callback_url, job_id, "failed", error=error_message, metadata=request.metadata)

    finally:
        # Cleanup
        if semaphore_acquired and semaphore:
            semaphore.release()
            logger.info(f"[VideoEdit] Job {job_id} released render slot")

        # Remove temp directory
        try:
            if os.path.exists(job_dir):
                shutil.rmtree(job_dir)
                logger.debug(f"[VideoEdit] Cleaned up job directory: {job_dir}")
        except Exception as cleanup_error:
            logger.warning(f"[VideoEdit] Cleanup failed: {cleanup_error}")


@router.post("/edit", response_model=VideoEditResponse)
async def edit_video(request: VideoEditRequest):
    """
    Edit an existing video by adding audio and/or subtitles.

    This endpoint accepts a source video URL and optionally:
    - New audio to replace the original audio track
    - Subtitle lines with timing and style

    The job runs asynchronously. Use the callback_url to receive completion notification,
    or poll the job status endpoint.

    **Audio Settings:**
    - url: Audio file URL (S3 or external)
    - start_time: Position in audio to start from (seconds)
    - volume: Volume level (0.0-2.0, default 1.0)
    - fade_in/fade_out: Fade durations in seconds

    **Subtitle Settings:**
    - lines: Array of {text, start, end} objects
    - style: Font size, color, animation, position settings
    """
    job_queue = get_job_queue()

    # Validate request
    if not request.audio and not request.subtitles:
        raise HTTPException(
            status_code=400,
            detail="At least one of 'audio' or 'subtitles' must be provided"
        )

    # Create job in queue
    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    # Start background processing
    asyncio.create_task(process_video_edit(request, job_queue))

    return VideoEditResponse(
        status="accepted",
        job_id=request.job_id,
        message="Video edit job started"
    )


@router.post("/edit/sync", response_model=dict)
async def edit_video_sync(request: VideoEditRequest):
    """
    Synchronous video edit (for testing).
    Blocks until complete. Not recommended for production use.
    """
    job_queue = get_job_queue()

    if job_queue:
        await job_queue.create_job(request.job_id, request.model_dump())

    await process_video_edit(request, job_queue)

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
