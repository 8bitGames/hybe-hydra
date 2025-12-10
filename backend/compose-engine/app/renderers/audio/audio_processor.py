"""Audio processing via FFmpeg filters.

Replaces MoviePy's AudioFileClip operations with native FFmpeg audio filters.
This handles trimming, volume adjustment, fades, and the TikTok hook effect.
"""

import asyncio
import logging
import os
import time
from dataclasses import dataclass
from typing import Optional

from ..ffmpeg_pipeline import find_ffmpeg

logger = logging.getLogger(__name__)


def _log_ffmpeg_cmd(cmd: list, job_id: str = "unknown"):
    """Log FFmpeg command in a readable format."""
    cmd_str = " ".join(cmd)
    if len(cmd_str) > 500:
        cmd_str = cmd_str[:500] + "..."
    logger.debug(f"[{job_id}] FFmpeg audio cmd: {cmd_str}")


@dataclass
class AudioSettings:
    """Settings for audio processing."""
    start_time: float = 0.0
    duration: Optional[float] = None
    fade_in: float = 1.0
    fade_out: float = 2.0
    tiktok_hook_enabled: bool = True
    tiktok_hook_duration: float = 2.0
    tiktok_hook_volume: float = 0.7


def build_audio_filter_chain(
    video_duration: float,
    settings: Optional[AudioSettings] = None,
) -> str:
    """Build complete audio filter chain for FFmpeg.

    This replicates the behavior of video_renderer.py:_add_audio_with_effects()
    using FFmpeg's audio filters instead of MoviePy's audio operations.

    The filter chain handles:
    1. Trimming audio to start position
    2. TikTok Hook effect (lower volume for first 2 seconds)
    3. Fade in (1 second by default)
    4. Fade out (2 seconds by default)
    5. Duration limiting

    Args:
        video_duration: Target duration to match video length
        settings: Audio settings (uses defaults if None)

    Returns:
        FFmpeg audio filter chain string

    Example output:
        "atrim=start=5,asetpts=PTS-STARTPTS,volume='if(lt(t,2),0.7,1.0)':eval=frame,afade=t=in:st=0:d=1,afade=t=out:st=13:d=2,atrim=duration=15"
    """
    if settings is None:
        settings = AudioSettings()

    filters = []

    # 1. Trim audio from start position
    if settings.start_time > 0:
        filters.append(f"atrim=start={settings.start_time}")
        # Reset timestamps after trim
        filters.append("asetpts=PTS-STARTPTS")

    # 2. TikTok Hook effect: First N seconds at lower volume, then full volume
    # This creates a "calm intro" that builds to the beat drop
    if settings.tiktok_hook_enabled and video_duration > settings.tiktok_hook_duration:
        # FFmpeg volume expression:
        # if(lt(t, hook_duration), hook_volume, 1.0)
        hook_dur = settings.tiktok_hook_duration
        hook_vol = settings.tiktok_hook_volume
        volume_expr = f"if(lt(t\\,{hook_dur})\\,{hook_vol}\\,1.0)"
        filters.append(f"volume='{volume_expr}':eval=frame")

    # 3. Fade in from start
    if settings.fade_in > 0:
        filters.append(f"afade=t=in:st=0:d={settings.fade_in}")

    # 4. Fade out before end
    if settings.fade_out > 0:
        fade_out_start = max(0, video_duration - settings.fade_out)
        filters.append(f"afade=t=out:st={fade_out_start:.3f}:d={settings.fade_out}")

    # 5. Limit to video duration
    filters.append(f"atrim=duration={video_duration}")

    return ",".join(filters)


class AudioProcessor:
    """FFmpeg-based audio processor.

    Handles all audio operations for video composition including
    trimming, volume adjustment, fades, and mixing.
    """

    def __init__(self):
        self.ffmpeg = find_ffmpeg()

    async def process_audio(
        self,
        audio_path: str,
        output_path: str,
        video_duration: float,
        settings: Optional[AudioSettings] = None,
        job_id: str = "unknown",
    ) -> bool:
        """Process audio file with all effects.

        Applies trimming, TikTok hook, and fades in a single FFmpeg pass.

        Args:
            audio_path: Input audio file path
            output_path: Output audio file path
            video_duration: Target duration
            settings: Audio processing settings
            job_id: Job ID for logging

        Returns:
            True if successful
        """
        filter_chain = build_audio_filter_chain(video_duration, settings)

        cmd = [
            self.ffmpeg, "-y",
            "-i", audio_path,
            "-af", filter_chain,
            "-c:a", "aac",
            "-b:a", "192k",
            output_path,
        ]

        logger.info(f"[{job_id}] Processing audio with filters")
        logger.debug(f"[{job_id}] Audio filter: {filter_chain}")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            logger.error(f"[{job_id}] Audio processing failed: {stderr.decode()}")
            return False

        return True

    async def mix_into_video(
        self,
        video_path: str,
        audio_path: str,
        output_path: str,
        video_duration: float,
        settings: Optional[AudioSettings] = None,
        job_id: str = "unknown",
    ) -> bool:
        """Mix processed audio into video.

        This applies audio filters and combines with video in a single pass.
        Video is stream-copied (no re-encoding) for speed.

        Args:
            video_path: Input video path
            audio_path: Input audio path
            output_path: Output video path
            video_duration: Video duration for filter calculation
            settings: Audio processing settings
            job_id: Job ID for logging

        Returns:
            True if successful
        """
        start_time = time.time()
        logger.info(f"[{job_id}] Mixing audio into video...")
        logger.info(f"[{job_id}]   Video: {video_path}")
        logger.info(f"[{job_id}]   Audio: {audio_path}")
        logger.info(f"[{job_id}]   Duration: {video_duration:.1f}s")

        filter_chain = build_audio_filter_chain(video_duration, settings)
        logger.info(f"[{job_id}]   Audio filter: {filter_chain[:100]}{'...' if len(filter_chain) > 100 else ''}")

        cmd = [
            self.ffmpeg, "-y",
            "-i", video_path,
            "-i", audio_path,
            "-filter_complex", f"[1:a]{filter_chain}[a]",
            "-map", "0:v",
            "-map", "[a]",
            "-c:v", "copy",  # No video re-encoding!
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
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
            logger.error(f"[{job_id}] Audio mix FAILED ({elapsed:.1f}s): {stderr.decode()[:500]}")
            return False

        if os.path.exists(output_path):
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            logger.info(f"[{job_id}] Audio mix complete: {output_path} ({size_mb:.1f}MB, {elapsed:.1f}s)")

        return True

    async def get_duration(self, audio_path: str) -> float:
        """Get audio file duration.

        Args:
            audio_path: Path to audio file

        Returns:
            Duration in seconds
        """
        from ..utils.ffprobe import get_duration
        return await get_duration(audio_path)

    async def extract_audio(
        self,
        video_path: str,
        output_path: str,
        job_id: str = "unknown",
    ) -> bool:
        """Extract audio from video file.

        Args:
            video_path: Input video path
            output_path: Output audio path (usually .aac or .mp3)
            job_id: Job ID for logging

        Returns:
            True if successful
        """
        cmd = [
            self.ffmpeg, "-y",
            "-i", video_path,
            "-vn",  # No video
            "-c:a", "aac",
            "-b:a", "192k",
            output_path,
        ]

        logger.info(f"[{job_id}] Extracting audio from video")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            logger.error(f"[{job_id}] Audio extraction failed: {stderr.decode()}")
            return False

        return True


def build_beat_synced_volume(
    beat_times: list,
    base_volume: float = 1.0,
    boost_volume: float = 1.3,
    beat_window: float = 0.1,
) -> str:
    """Build volume expression that boosts on beats.

    Creates a volume filter that increases volume slightly on beat hits.

    Args:
        beat_times: List of beat timestamps in seconds
        base_volume: Normal volume level
        boost_volume: Volume level on beats
        beat_window: Duration of beat boost in seconds

    Returns:
        FFmpeg volume expression
    """
    # Build a complex expression that checks each beat
    # This becomes: if(condition1, boost, if(condition2, boost, ... base))

    if not beat_times:
        return str(base_volume)

    # For performance, limit to first 100 beats
    beats = beat_times[:100]

    # Build nested if expression
    expr = str(base_volume)
    for beat in reversed(beats):
        # Check if t is within beat_window of this beat
        condition = f"lt(abs(t-{beat:.3f})\\,{beat_window})"
        expr = f"if({condition}\\,{boost_volume}\\,{expr})"

    return expr
