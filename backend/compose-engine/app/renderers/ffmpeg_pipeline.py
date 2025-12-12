"""FFmpeg pipeline for video composition.

This module provides the core FFmpeg subprocess handling for creating
video clips from images and compositing them together.
"""

import asyncio
import logging
import os
import shutil
import time
from dataclasses import dataclass
from typing import List, Literal, Optional, Tuple

from .filters.ken_burns import build_image_to_video_filter, get_diverse_motion_styles

logger = logging.getLogger(__name__)


def _log_ffmpeg_cmd(cmd: List[str], job_id: str = "unknown"):
    """Log FFmpeg command in a readable format."""
    cmd_str = " ".join(cmd)
    if len(cmd_str) > 500:
        cmd_str = cmd_str[:500] + "..."
    logger.debug(f"[{job_id}] FFmpeg cmd: {cmd_str}")


def find_ffmpeg() -> str:
    """Find ffmpeg binary."""
    # Check imageio_ffmpeg first (used by MoviePy)
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass

    # Check common locations
    locations = [
        "/usr/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        shutil.which("ffmpeg"),
    ]
    for loc in locations:
        if loc and os.path.exists(loc):
            return loc
    raise RuntimeError("ffmpeg not found")


def check_nvenc_available() -> bool:
    """Check if NVIDIA NVENC encoder is available."""
    try:
        import subprocess
        result = subprocess.run(
            [find_ffmpeg(), "-encoders"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return "h264_nvenc" in result.stdout
    except Exception:
        return False


# Cache NVENC availability
_NVENC_AVAILABLE: Optional[bool] = None


def is_nvenc_available() -> bool:
    """Check NVENC availability (cached)."""
    global _NVENC_AVAILABLE
    if _NVENC_AVAILABLE is None:
        _NVENC_AVAILABLE = check_nvenc_available()
    return _NVENC_AVAILABLE


@dataclass
class ImageClipSpec:
    """Specification for creating a video clip from an image."""
    image_path: str
    duration: float
    motion_style: Literal["zoom_in", "zoom_out", "pan", "static"]
    start_time: float = 0.0


async def create_image_clip(
    image_path: str,
    output_path: str,
    duration: float,
    motion_style: Literal["zoom_in", "zoom_out", "pan", "static"],
    output_size: Tuple[int, int],
    fps: int = 30,
    use_gpu: bool = True,
    job_id: str = "unknown",
) -> bool:
    """Create a video clip from a static image with Ken Burns motion.

    This replaces MoviePy's ImageClip + resized() with pure FFmpeg,
    achieving significant speedup by avoiding Python per-frame processing.

    Args:
        image_path: Path to input image
        output_path: Path for output video clip
        duration: Clip duration in seconds
        motion_style: Ken Burns motion style
        output_size: (width, height) for output video
        fps: Frame rate (default 30)
        use_gpu: Whether to use NVENC GPU encoding
        job_id: Job ID for logging

    Returns:
        True if successful, False otherwise
    """
    start_time = time.time()
    ffmpeg = find_ffmpeg()

    # Build filter chain for Ken Burns effect
    filter_chain = build_image_to_video_filter(
        motion_style=motion_style,
        duration=duration,
        output_size=output_size,
        fps=fps,
    )

    # Select encoder based on GPU availability
    encoder_name = "unknown"
    if use_gpu and is_nvenc_available():
        encoder_opts = [
            "-c:v", "h264_nvenc",
            "-preset", "p4",  # Fast preset for clips
            "-b:v", "8M",
        ]
        encoder_name = "h264_nvenc"
    else:
        encoder_opts = [
            "-c:v", "libx264",
            "-preset", "ultrafast",  # Fast for intermediate clips
            "-crf", "18",
        ]
        encoder_name = "libx264"

    cmd = [
        ffmpeg, "-y",
        "-loop", "1",  # Loop static image
        "-i", image_path,
        "-t", str(duration),
        "-vf", filter_chain,
        *encoder_opts,
        "-an",  # No audio for individual clips
        "-r", str(fps),
        output_path,
    ]

    _log_ffmpeg_cmd(cmd, job_id)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    elapsed = time.time() - start_time

    if proc.returncode != 0:
        logger.error(f"[{job_id}] FFmpeg clip creation FAILED ({elapsed:.1f}s): {stderr.decode()[:500]}")
        return False

    # Log success with file size
    if os.path.exists(output_path):
        size_kb = os.path.getsize(output_path) / 1024
        logger.debug(f"[{job_id}] Clip created: {output_path} ({size_kb:.0f}KB, {elapsed:.2f}s, {encoder_name})")

    return True


async def create_clips_parallel(
    specs: List[ImageClipSpec],
    output_dir: str,
    output_size: Tuple[int, int],
    fps: int = 30,
    use_gpu: bool = True,
    max_workers: int = 4,
    job_id: str = "unknown",
) -> List[str]:
    """Create multiple image clips in parallel.

    This is much faster than sequential MoviePy processing because:
    1. FFmpeg is native C code (no Python GIL)
    2. Parallel execution with semaphore limiting
    3. GPU encoding when available

    Args:
        specs: List of ImageClipSpec defining each clip
        output_dir: Directory for output clips
        output_size: (width, height) for output videos
        fps: Frame rate
        use_gpu: Whether to use GPU encoding
        max_workers: Maximum parallel FFmpeg processes
        job_id: Job ID for logging

    Returns:
        List of paths to created clips (in order)
    """
    start_time = time.time()
    logger.info(f"[{job_id}] Creating {len(specs)} clips in parallel (max_workers={max_workers}, gpu={use_gpu})")

    semaphore = asyncio.Semaphore(max_workers)
    results = [None] * len(specs)
    completed_count = [0]  # Use list to allow mutation in nested function

    async def process_one(index: int, spec: ImageClipSpec) -> Tuple[int, Optional[str]]:
        async with semaphore:
            output_path = os.path.join(output_dir, f"clip_{index:03d}.mp4")
            logger.debug(f"[{job_id}] Clip {index+1}/{len(specs)} starting: {spec.motion_style}, {spec.duration:.2f}s")

            success = await create_image_clip(
                image_path=spec.image_path,
                output_path=output_path,
                duration=spec.duration,
                motion_style=spec.motion_style,
                output_size=output_size,
                fps=fps,
                use_gpu=use_gpu,
                job_id=job_id,
            )

            completed_count[0] += 1
            if completed_count[0] % 5 == 0 or completed_count[0] == len(specs):
                logger.info(f"[{job_id}] Clips progress: {completed_count[0]}/{len(specs)} complete")

            return (index, output_path if success else None)

    tasks = [process_one(i, spec) for i, spec in enumerate(specs)]
    completed = await asyncio.gather(*tasks, return_exceptions=True)

    # Collect results in order
    clip_paths = []
    failed_count = 0
    for result in completed:
        if isinstance(result, Exception):
            logger.error(f"[{job_id}] Clip creation exception: {result}")
            clip_paths.append(None)
            failed_count += 1
        else:
            index, path = result
            if path is None:
                failed_count += 1
            clip_paths.append(path)

    # Filter out failures
    valid_paths = [p for p in clip_paths if p is not None]
    elapsed = time.time() - start_time

    if failed_count > 0:
        logger.warning(f"[{job_id}] Clip creation: {len(valid_paths)}/{len(specs)} succeeded, {failed_count} failed")
    else:
        logger.info(f"[{job_id}] All {len(valid_paths)} clips created in {elapsed:.1f}s ({elapsed/len(specs):.2f}s avg)")

    return valid_paths


async def concatenate_clips_simple(
    clip_paths: List[str],
    output_path: str,
    job_id: str = "unknown",
) -> bool:
    """Concatenate clips using FFmpeg concat demuxer (no transitions).

    This is the simplest concatenation - just joins clips end to end.
    For transitions, use xfade_renderer instead.

    Args:
        clip_paths: List of input video paths
        output_path: Output video path
        job_id: Job ID for logging

    Returns:
        True if successful
    """
    start_time = time.time()
    logger.info(f"[{job_id}] Concatenating {len(clip_paths)} clips (simple concat, stream copy)")

    ffmpeg = find_ffmpeg()

    # Create concat file
    concat_file = output_path + ".concat.txt"
    with open(concat_file, "w") as f:
        for path in clip_paths:
            f.write(f"file '{path}'\n")
    logger.debug(f"[{job_id}] Concat list file: {concat_file}")

    try:
        cmd = [
            ffmpeg, "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-c", "copy",  # Stream copy - no re-encoding
            output_path,
        ]

        _log_ffmpeg_cmd(cmd, job_id)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        elapsed = time.time() - start_time

        if proc.returncode != 0:
            logger.error(f"[{job_id}] Concat FAILED ({elapsed:.1f}s): {stderr.decode()[:500]}")
            return False

        if os.path.exists(output_path):
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            logger.info(f"[{job_id}] Concat complete: {output_path} ({size_mb:.1f}MB, {elapsed:.1f}s)")

        return True
    finally:
        # Cleanup concat file
        if os.path.exists(concat_file):
            os.remove(concat_file)


async def apply_filter_to_video(
    input_path: str,
    output_path: str,
    filter_str: str,
    use_gpu: bool = True,
    copy_audio: bool = True,
    job_id: str = "unknown",
) -> bool:
    """Apply an FFmpeg filter to a video.

    Generic function for applying any FFmpeg filter chain to a video.

    Args:
        input_path: Input video path
        output_path: Output video path
        filter_str: FFmpeg filter string (e.g., "eq=saturation=1.3")
        use_gpu: Whether to use GPU encoding
        copy_audio: Whether to copy audio stream
        job_id: Job ID for logging

    Returns:
        True if successful
    """
    start_time = time.time()
    filter_preview = filter_str[:80] + "..." if len(filter_str) > 80 else filter_str
    logger.info(f"[{job_id}] Applying video filter: {filter_preview}")

    ffmpeg = find_ffmpeg()

    # Select encoder
    encoder_name = "unknown"
    if use_gpu and is_nvenc_available():
        encoder_opts = [
            "-c:v", "h264_nvenc",
            "-preset", "p4",
            "-b:v", "8M",
        ]
        encoder_name = "h264_nvenc"
    else:
        encoder_opts = [
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
        ]
        encoder_name = "libx264"

    audio_opts = ["-c:a", "copy"] if copy_audio else ["-an"]

    cmd = [
        ffmpeg, "-y",
        "-i", input_path,
        "-vf", filter_str,
        *encoder_opts,
        *audio_opts,
        output_path,
    ]

    _log_ffmpeg_cmd(cmd, job_id)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    elapsed = time.time() - start_time

    if proc.returncode != 0:
        stderr_text = stderr.decode()
        logger.error(f"[{job_id}] Filter FAILED ({elapsed:.1f}s, {encoder_name})")
        logger.error(f"[{job_id}] Full filter string: {filter_str}")
        logger.error(f"[{job_id}] Full FFmpeg stderr:\n{stderr_text}")
        return False

    if os.path.exists(output_path):
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        logger.info(f"[{job_id}] Filter applied: {output_path} ({size_mb:.1f}MB, {elapsed:.1f}s, {encoder_name})")

    return True


async def mix_audio_to_video(
    video_path: str,
    audio_path: str,
    output_path: str,
    audio_filter: Optional[str] = None,
    use_gpu: bool = False,
    job_id: str = "unknown",
) -> bool:
    """Mix audio into video using FFmpeg.

    Args:
        video_path: Input video path
        audio_path: Input audio path
        output_path: Output video path
        audio_filter: Optional audio filter chain
        use_gpu: Whether to use GPU (usually False for audio-only mix)
        job_id: Job ID for logging

    Returns:
        True if successful
    """
    ffmpeg = find_ffmpeg()

    # Build command
    cmd = [
        ffmpeg, "-y",
        "-i", video_path,
        "-i", audio_path,
    ]

    # Apply audio filter if provided
    if audio_filter:
        cmd.extend([
            "-filter_complex", f"[1:a]{audio_filter}[a]",
            "-map", "0:v",
            "-map", "[a]",
        ])
    else:
        cmd.extend([
            "-map", "0:v",
            "-map", "1:a",
        ])

    # Video: copy (no re-encode), Audio: AAC
    cmd.extend([
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_path,
    ])

    logger.info(f"[{job_id}] Mixing audio into video")

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        logger.error(f"[{job_id}] Audio mix failed: {stderr.decode()}")
        return False

    return True


async def final_encode(
    input_path: str,
    output_path: str,
    use_gpu: bool = True,
    target_bitrate: str = "8M",
    job_id: str = "unknown",
) -> bool:
    """Final encoding pass with quality settings.

    This is the final encoding step that produces the output video
    with optimal quality settings for delivery.

    Args:
        input_path: Input video path
        output_path: Output video path
        use_gpu: Whether to use GPU encoding
        target_bitrate: Target video bitrate
        job_id: Job ID for logging

    Returns:
        True if successful
    """
    ffmpeg = find_ffmpeg()

    # High quality encoding settings - optimized to prevent pixelation
    if use_gpu and is_nvenc_available():
        encoder_opts = [
            "-c:v", "h264_nvenc",
            "-preset", "p1",  # Highest quality preset
            "-tune", "hq",
            "-rc", "vbr",
            "-cq", "18",  # Lower CQ = higher quality (was 23)
            "-b:v", "15M",  # Higher bitrate for better quality (was 8M)
            "-maxrate", "20M",  # Higher max bitrate (was 12M)
            "-bufsize", "30M",  # Higher buffer (was 16M)
            "-profile:v", "high",
        ]
    else:
        encoder_opts = [
            "-c:v", "libx264",
            "-preset", "slow",
            "-crf", "18",  # Lower CRF = higher quality (was 23)
            "-profile:v", "high",
            "-level", "4.1",
        ]

    cmd = [
        ffmpeg, "-y",
        "-i", input_path,
        *encoder_opts,
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",  # Web optimization
        output_path,
    ]

    logger.info(f"[{job_id}] Final encode: GPU={'yes' if use_gpu and is_nvenc_available() else 'no'}")

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        logger.error(f"[{job_id}] Final encode failed: {stderr.decode()}")
        return False

    return True
