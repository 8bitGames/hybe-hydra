"""Pydantic models for video editing job requests."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class VideoEditJobStatus(str, Enum):
    """Status of a video edit job."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================
# Subtitle Models
# ============================================================

class SubtitleLine(BaseModel):
    """A single subtitle line with timing."""
    text: str = Field(..., description="Subtitle text content")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")


class SubtitleStyle(BaseModel):
    """Style configuration for subtitles."""
    font_size: str = Field(default="medium", description="Font size: small, medium, large")
    font_style: str = Field(default="bold", description="Font style: bold, modern, minimal, classic")
    color: str = Field(default="#FFFFFF", description="Text color in hex")
    stroke_color: str = Field(default="#000000", description="Stroke/outline color in hex")
    stroke_width: int = Field(default=3, description="Stroke width in pixels")
    animation: str = Field(default="fade", description="Animation type: fade, typewriter, karaoke, slide_up, scale_pop, bounce, glitch, wave")
    position: str = Field(default="center", description="Vertical position: top, center, bottom")
    bottom_margin: int = Field(default=10, description="Bottom margin percentage (0-100)")


class SubtitleSettings(BaseModel):
    """Complete subtitle configuration."""
    lines: List[SubtitleLine] = Field(..., description="List of subtitle lines with timing")
    style: SubtitleStyle = Field(default_factory=SubtitleStyle, description="Subtitle style configuration")


# ============================================================
# Audio Models
# ============================================================

class AudioEditSettings(BaseModel):
    """Audio settings for video editing."""
    url: str = Field(..., description="Audio file URL (S3 or external)")
    start_time: float = Field(default=0, description="Start position in audio file (seconds)")
    volume: float = Field(default=1.0, ge=0.0, le=2.0, description="Volume level (0.0-2.0)")
    fade_in: float = Field(default=1.0, ge=0.0, description="Fade in duration (seconds)")
    fade_out: float = Field(default=2.0, ge=0.0, description="Fade out duration (seconds)")


# ============================================================
# Video Edit Request/Response Models
# ============================================================

class VideoEditRequest(BaseModel):
    """Request model for video editing."""
    job_id: str = Field(..., description="Unique job identifier")
    video_url: str = Field(..., description="Source video URL to edit")
    callback_url: Optional[str] = Field(default=None, description="URL to call when job completes")

    # Output settings
    campaign_id: Optional[str] = Field(default=None, description="Campaign ID for S3 path organization")

    # Metadata for callback (generation_id, user_id, etc.)
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Metadata to include in callback (generation_id, user_id, etc.)")

    # Audio settings (optional - if provided, replaces original audio)
    audio: Optional[AudioEditSettings] = Field(default=None, description="New audio to add (replaces original)")

    # Subtitle settings (optional - adds subtitle overlays)
    subtitles: Optional[SubtitleSettings] = Field(default=None, description="Subtitle overlays to add")


class VideoEditResponse(BaseModel):
    """Response model for video edit job submission."""
    status: str = Field(..., description="Job status: accepted, failed")
    job_id: str = Field(..., description="Job identifier")
    message: Optional[str] = Field(default=None, description="Status message")


class VideoEditCallback(BaseModel):
    """Callback payload sent when video edit job completes."""
    job_id: str = Field(..., description="Job identifier")
    status: VideoEditJobStatus = Field(..., description="Final job status")
    output_url: Optional[str] = Field(default=None, description="URL of edited video (if successful)")
    error: Optional[str] = Field(default=None, description="Error message (if failed)")
    duration_ms: Optional[int] = Field(default=None, description="Processing time in milliseconds")
    progress: Optional[int] = Field(default=None, description="Progress percentage (0-100)")
