"""FFprobe utilities for getting media information."""

import asyncio
import json
import os
import shutil
from typing import Optional, Tuple


def find_ffprobe() -> str:
    """Find ffprobe binary."""
    # Check common locations
    locations = [
        "/usr/bin/ffprobe",
        "/usr/local/bin/ffprobe",
        "/opt/homebrew/bin/ffprobe",
        shutil.which("ffprobe"),
    ]
    for loc in locations:
        if loc and os.path.exists(loc):
            return loc
    raise RuntimeError("ffprobe not found")


async def get_duration(file_path: str) -> float:
    """Get duration of a media file in seconds.

    Args:
        file_path: Path to video or audio file

    Returns:
        Duration in seconds
    """
    ffprobe = find_ffprobe()
    cmd = [
        ffprobe,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        file_path,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()

    data = json.loads(stdout.decode())
    return float(data["format"]["duration"])


async def get_video_info(file_path: str) -> dict:
    """Get detailed video information.

    Args:
        file_path: Path to video file

    Returns:
        Dict with width, height, duration, fps, codec
    """
    ffprobe = find_ffprobe()
    cmd = [
        ffprobe,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        file_path,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()

    data = json.loads(stdout.decode())

    # Find video stream
    video_stream = None
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            video_stream = stream
            break

    if not video_stream:
        raise ValueError(f"No video stream found in {file_path}")

    # Parse frame rate (could be "30/1" or "30000/1001" etc)
    fps_str = video_stream.get("r_frame_rate", "30/1")
    if "/" in fps_str:
        num, den = fps_str.split("/")
        fps = float(num) / float(den)
    else:
        fps = float(fps_str)

    return {
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "duration": float(data["format"]["duration"]),
        "fps": fps,
        "codec": video_stream.get("codec_name"),
    }


async def get_image_size(file_path: str) -> Tuple[int, int]:
    """Get dimensions of an image file.

    Args:
        file_path: Path to image file

    Returns:
        (width, height) tuple
    """
    ffprobe = find_ffprobe()
    cmd = [
        ffprobe,
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        file_path,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()

    data = json.loads(stdout.decode())

    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            return (stream["width"], stream["height"])

    raise ValueError(f"Could not determine image size for {file_path}")
