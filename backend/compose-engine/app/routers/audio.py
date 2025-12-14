"""Audio processing API router.

Provides endpoints for audio analysis and video+audio composition.
"""

import asyncio
import logging
import os
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List

from ..services.audio_analyzer import AudioAnalyzer
from ..models.responses import AudioAnalysis
from ..utils.s3_client import S3Client
from ..utils.temp_files import TempFileManager
from ..renderers.audio.audio_processor import AudioProcessor, AudioSettings

logger = logging.getLogger(__name__)

router = APIRouter()

# Store for async job status
_compose_jobs: dict = {}


class AudioAnalyzeRequest(BaseModel):
    """Request model for audio analysis."""
    audio_url: str
    job_id: Optional[str] = "temp"
    target_duration: float = 15.0  # Target duration for best segment analysis


class BestSegmentRequest(BaseModel):
    """Request model for finding best audio segment."""
    audio_url: str
    target_duration: float = 15.0
    job_id: Optional[str] = "temp"


class BestSegmentResponse(BaseModel):
    """Response model for best segment."""
    start_time: float
    end_time: float
    duration: float


@router.post("/analyze", response_model=AudioAnalysis)
async def analyze_audio(request: AudioAnalyzeRequest):
    """
    Analyze an audio file for BPM, beats, and energy.
    """
    s3 = S3Client()
    temp = TempFileManager()
    analyzer = AudioAnalyzer()

    # Download audio to temp
    local_path = temp.get_path(request.job_id, "audio_analyze.mp3")

    try:
        await s3.download_file(request.audio_url, local_path)
        result = analyzer.analyze(local_path, target_duration=request.target_duration)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        # Cleanup
        import os
        if os.path.exists(local_path):
            os.remove(local_path)


@router.post("/best-segment", response_model=BestSegmentResponse)
async def find_best_segment(request: BestSegmentRequest):
    """
    Find the best segment of audio for a target duration.
    Returns the highest-energy segment.
    """
    s3 = S3Client()
    temp = TempFileManager()
    analyzer = AudioAnalyzer()

    local_path = temp.get_path(request.job_id, "audio_segment.mp3")

    try:
        await s3.download_file(request.audio_url, local_path)
        start, end = analyzer.find_best_segment(local_path, request.target_duration)

        return BestSegmentResponse(
            start_time=start,
            end_time=end,
            duration=end - start
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segment analysis failed: {str(e)}")
    finally:
        import os
        if os.path.exists(local_path):
            os.remove(local_path)


# ============================================================================
# Video + Audio Composition Endpoint
# ============================================================================

class SubtitleEntry(BaseModel):
    """A subtitle/caption entry."""
    text: str
    start: float  # Start time in seconds
    end: float    # End time in seconds


class AudioComposeRequest(BaseModel):
    """Request model for video+audio composition."""
    job_id: Optional[str] = None
    video_url: str
    audio_url: str
    audio_start_time: Optional[float] = 0.0
    audio_volume: Optional[float] = 1.0
    fade_in: Optional[float] = 1.0
    fade_out: Optional[float] = 2.0
    mix_original_audio: Optional[bool] = False
    original_audio_volume: Optional[float] = 0.3
    output_s3_bucket: Optional[str] = None
    output_s3_key: Optional[str] = None
    subtitles: Optional[List[SubtitleEntry]] = None


class AudioComposeResponse(BaseModel):
    """Response model for composition job submission."""
    job_id: str
    status: str  # 'queued', 'processing', 'completed', 'failed'
    message: Optional[str] = None


class AudioComposeStatusResponse(BaseModel):
    """Response model for composition job status."""
    job_id: str
    status: str  # 'processing', 'completed', 'failed'
    output_url: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None


async def _run_compose_job(
    job_id: str,
    video_url: str,
    audio_url: str,
    audio_start_time: float,
    audio_volume: float,
    fade_in: float,
    fade_out: float,
    mix_original_audio: bool,
    original_audio_volume: float,
    output_s3_bucket: Optional[str],
    output_s3_key: Optional[str],
):
    """Background task to run composition job."""
    s3 = S3Client()
    temp = TempFileManager()
    processor = AudioProcessor()

    video_path = temp.get_path(job_id, "input_video.mp4")
    audio_path = temp.get_path(job_id, "input_audio.mp3")
    output_path = temp.get_path(job_id, "output_composed.mp4")

    try:
        _compose_jobs[job_id] = {"status": "processing"}
        logger.info(f"[{job_id}] Starting composition job")

        # Download files
        logger.info(f"[{job_id}] Downloading video: {video_url[:50]}...")
        await s3.download_file(video_url, video_path)
        logger.info(f"[{job_id}] Downloading audio: {audio_url[:50]}...")
        await s3.download_file(audio_url, audio_path)

        # Get video duration
        from ..utils.ffprobe import get_duration
        video_duration = await get_duration(video_path)
        logger.info(f"[{job_id}] Video duration: {video_duration:.1f}s")

        # Build audio settings
        settings = AudioSettings(
            start_time=audio_start_time,
            duration=video_duration,
            fade_in=fade_in,
            fade_out=fade_out,
            tiktok_hook_enabled=False,  # Disable hook for general composition
        )

        # Run composition
        success = await processor.mix_into_video(
            video_path=video_path,
            audio_path=audio_path,
            output_path=output_path,
            video_duration=video_duration,
            settings=settings,
            job_id=job_id,
        )

        if not success:
            raise Exception("Audio composition failed")

        # Upload to S3
        bucket = output_s3_bucket or os.getenv("AWS_S3_BUCKET", "hydra-assets-hybe")
        key = output_s3_key or f"composed/{job_id}/output.mp4"

        logger.info(f"[{job_id}] Uploading to s3://{bucket}/{key}")
        output_url = await s3.upload_file(output_path, bucket, key)

        _compose_jobs[job_id] = {
            "status": "completed",
            "output_url": output_url,
            "duration": video_duration,
        }
        logger.info(f"[{job_id}] Composition complete: {output_url}")

    except Exception as e:
        logger.error(f"[{job_id}] Composition failed: {str(e)}")
        _compose_jobs[job_id] = {
            "status": "failed",
            "error": str(e),
        }
    finally:
        # Cleanup temp files
        for path in [video_path, audio_path, output_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass


@router.post("/compose", response_model=AudioComposeResponse)
async def compose_video_audio(
    request: AudioComposeRequest,
    background_tasks: BackgroundTasks,
):
    """
    Compose video with audio track.

    Combines a video file with an audio file, applying volume adjustment,
    fades, and optional mixing with original audio.

    Returns a job_id for status polling.
    """
    import uuid

    job_id = request.job_id or str(uuid.uuid4())[:8]

    # Start background job
    _compose_jobs[job_id] = {"status": "queued"}

    background_tasks.add_task(
        _run_compose_job,
        job_id=job_id,
        video_url=request.video_url,
        audio_url=request.audio_url,
        audio_start_time=request.audio_start_time or 0.0,
        audio_volume=request.audio_volume or 1.0,
        fade_in=request.fade_in or 1.0,
        fade_out=request.fade_out or 2.0,
        mix_original_audio=request.mix_original_audio or False,
        original_audio_volume=request.original_audio_volume or 0.3,
        output_s3_bucket=request.output_s3_bucket,
        output_s3_key=request.output_s3_key,
    )

    return AudioComposeResponse(
        job_id=job_id,
        status="queued",
        message="Composition job queued",
    )


@router.get("/compose/{job_id}/status", response_model=AudioComposeStatusResponse)
async def get_compose_status(job_id: str):
    """
    Get status of a composition job.
    """
    job = _compose_jobs.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return AudioComposeStatusResponse(
        job_id=job_id,
        status=job.get("status", "unknown"),
        output_url=job.get("output_url"),
        duration=job.get("duration"),
        error=job.get("error"),
    )


@router.post("/duration")
async def get_media_duration(audio_url: str, media_type: str = "audio"):
    """
    Get duration of a media file (audio or video).
    """
    s3 = S3Client()
    temp = TempFileManager()

    job_id = f"duration-{os.urandom(4).hex()}"
    ext = ".mp4" if media_type == "video" else ".mp3"
    local_path = temp.get_path(job_id, f"media{ext}")

    try:
        await s3.download_file(audio_url, local_path)

        from ..utils.ffprobe import get_duration
        duration = await get_duration(local_path)

        return {"duration": duration, "status": "completed"}
    except Exception as e:
        return {"duration": 0, "status": "failed", "error": str(e)}
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)
