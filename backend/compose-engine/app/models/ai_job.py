"""Pydantic models for AI generation job requests."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from enum import Enum


class AIJobType(str, Enum):
    """Types of AI generation jobs."""
    VIDEO_GENERATION = "video_generation"  # Veo 3 (with optional audio overlay)
    IMAGE_GENERATION = "image_generation"  # Imagen 3
    IMAGE_TO_VIDEO = "image_to_video"  # Veo 3 with reference image
    VIDEO_EXTEND = "video_extend"  # Veo 3.1 video extension


class VideoAspectRatio(str, Enum):
    """Supported video aspect ratios for Veo."""
    LANDSCAPE = "16:9"
    PORTRAIT = "9:16"
    SQUARE = "1:1"


class ImageAspectRatio(str, Enum):
    """Supported image aspect ratios for Imagen."""
    LANDSCAPE_16_9 = "16:9"
    PORTRAIT_9_16 = "9:16"
    SQUARE = "1:1"
    LANDSCAPE_4_3 = "4:3"
    PORTRAIT_3_4 = "3:4"


class VideoDuration(int, Enum):
    """Supported video durations for Veo 3.1."""
    SHORT = 4  # 4 seconds
    MEDIUM = 6  # 6 seconds
    STANDARD = 8  # 8 seconds


class PersonGeneration(str, Enum):
    """Person generation settings."""
    ALLOW_ADULT = "allow_adult"
    DONT_ALLOW = "dont_allow"


class SafetyFilterLevel(str, Enum):
    """Safety filter levels for content generation."""
    BLOCK_NONE = "block_none"
    BLOCK_FEW = "block_few"
    BLOCK_SOME = "block_some"
    BLOCK_MOST = "block_most"


# ============================================================
# Audio Overlay Settings (used inline with video generation)
# ============================================================

class SubtitleEntry(BaseModel):
    """A single subtitle entry for overlay."""
    text: str = Field(..., description="Subtitle text")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")


class AudioOverlaySettings(BaseModel):
    """
    Optional audio overlay settings for video generation.
    If provided, FFmpeg will compose the audio after AI video generation.
    """
    audio_url: str = Field(..., description="URL of the audio file to overlay")
    audio_start_time: float = Field(
        default=0,
        description="Start time in audio file (seconds)"
    )
    audio_volume: float = Field(
        default=1.0,
        ge=0.0,
        le=2.0,
        description="Audio volume (0.0 - 2.0)"
    )
    fade_in: float = Field(
        default=0,
        ge=0,
        description="Audio fade in duration (seconds)"
    )
    fade_out: float = Field(
        default=0,
        ge=0,
        description="Audio fade out duration (seconds)"
    )
    mix_original_audio: bool = Field(
        default=False,
        description="Whether to mix with original video audio"
    )
    original_audio_volume: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Original audio volume if mixing"
    )
    subtitles: Optional[List[SubtitleEntry]] = Field(
        default=None,
        description="Optional subtitle entries for overlay"
    )


# ============================================================
# Video Generation Models (Veo 3)
# ============================================================

class VideoGenerationSettings(BaseModel):
    """Settings for Veo video generation."""
    prompt: str = Field(..., description="Text prompt for video generation")
    negative_prompt: Optional[str] = Field(
        default=None,
        description="Negative prompt to avoid certain content"
    )
    aspect_ratio: VideoAspectRatio = Field(
        default=VideoAspectRatio.LANDSCAPE,
        description="Video aspect ratio"
    )
    duration_seconds: VideoDuration = Field(
        default=VideoDuration.STANDARD,
        description="Video duration (5 or 8 seconds)"
    )
    person_generation: PersonGeneration = Field(
        default=PersonGeneration.ALLOW_ADULT,
        description="Person generation settings"
    )
    generate_audio: bool = Field(
        default=True,
        description="Generate audio with video (Veo 3 feature)"
    )
    seed: Optional[int] = Field(
        default=None,
        description="Random seed for reproducibility"
    )
    # Optional audio overlay - if provided, FFmpeg will compose audio after generation
    audio_overlay: Optional[AudioOverlaySettings] = Field(
        default=None,
        description="Optional audio overlay settings (FFmpeg composition after AI generation)"
    )


class ImageToVideoSettings(VideoGenerationSettings):
    """Settings for image-to-video generation."""
    reference_image_url: str = Field(
        ...,
        description="S3 URL of reference image for video generation"
    )


# ============================================================
# Video Extension Models (Veo 3.1)
# ============================================================

class VideoExtendSettings(BaseModel):
    """
    Settings for extending a previously generated Veo video.

    Veo 3.1 supports extending videos by up to 7 seconds per extension,
    with a maximum of 20 extensions total.

    Requirements:
    - Source video must be a Veo-generated video (GCS URI required)
    - Resolution is fixed at 720p for extensions
    - Last 1 second of video should contain audio for best results
    """
    source_gcs_uri: str = Field(
        ...,
        description="GCS URI of the source video to extend (gs://bucket/path.mp4)"
    )
    prompt: Optional[str] = Field(
        default=None,
        description="Optional prompt describing how to continue the video"
    )
    aspect_ratio: VideoAspectRatio = Field(
        default=VideoAspectRatio.PORTRAIT,
        description="Video aspect ratio (must match source video)"
    )
    # Extension-specific fields
    extension_count: int = Field(
        default=0,
        ge=0,
        le=20,
        description="Current extension count (0-20, used for validation)"
    )
    # Optional audio overlay - if provided, FFmpeg will compose audio after extension
    audio_overlay: Optional[AudioOverlaySettings] = Field(
        default=None,
        description="Optional audio overlay settings (FFmpeg composition after extension)"
    )


# ============================================================
# Image Generation Models (Imagen 3)
# ============================================================

class ImageGenerationSettings(BaseModel):
    """Settings for Imagen image generation."""
    prompt: str = Field(..., description="Text prompt for image generation")
    negative_prompt: Optional[str] = Field(
        default=None,
        description="Negative prompt to avoid certain content"
    )
    aspect_ratio: ImageAspectRatio = Field(
        default=ImageAspectRatio.SQUARE,
        description="Image aspect ratio"
    )
    number_of_images: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Number of images to generate (1-4)"
    )
    safety_filter_level: SafetyFilterLevel = Field(
        default=SafetyFilterLevel.BLOCK_SOME,
        description="Safety filter level"
    )
    person_generation: PersonGeneration = Field(
        default=PersonGeneration.ALLOW_ADULT,
        description="Person generation settings"
    )
    seed: Optional[int] = Field(
        default=None,
        description="Random seed for reproducibility"
    )


# ============================================================
# Job Request/Response Models
# ============================================================

class AIOutputSettings(BaseModel):
    """Output settings for AI generated content."""
    s3_bucket: str = Field(..., description="S3 bucket for output")
    s3_key: str = Field(..., description="S3 key for output file")
    # GCS is used internally, S3 for final delivery
    gcs_bucket: Optional[str] = Field(
        default=None,
        description="GCS bucket for Vertex AI output (internal)"
    )


class AIJobRequest(BaseModel):
    """
    Request model for AI generation jobs.

    Supports:
    - video_generation: Text-to-video with Veo 3 (with optional audio overlay via FFmpeg)
    - image_generation: Text-to-image with Imagen 3
    - image_to_video: Image-to-video with Veo 3 (with optional audio overlay via FFmpeg)
    """
    job_id: str = Field(..., description="Unique job identifier")
    job_type: AIJobType = Field(..., description="Type of AI job")

    # Generation settings (one of these will be populated based on job_type)
    video_settings: Optional[VideoGenerationSettings] = Field(
        default=None,
        description="Video generation settings (for video_generation)"
    )
    image_settings: Optional[ImageGenerationSettings] = Field(
        default=None,
        description="Image generation settings (for image_generation)"
    )
    i2v_settings: Optional[ImageToVideoSettings] = Field(
        default=None,
        description="Image-to-video settings (for image_to_video)"
    )
    extend_settings: Optional[VideoExtendSettings] = Field(
        default=None,
        description="Video extension settings (for video_extend)"
    )

    # Output configuration
    output: AIOutputSettings = Field(..., description="Output settings")

    # Callback configuration
    callback_url: Optional[str] = Field(
        default=None,
        description="URL to call when job completes"
    )
    callback_secret: Optional[str] = Field(
        default=None,
        description="Secret for callback authentication"
    )

    # Metadata
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata for the job"
    )

    def get_settings(self) -> BaseModel:
        """Get the appropriate settings based on job type."""
        if self.job_type == AIJobType.VIDEO_GENERATION:
            return self.video_settings
        elif self.job_type == AIJobType.IMAGE_GENERATION:
            return self.image_settings
        elif self.job_type == AIJobType.IMAGE_TO_VIDEO:
            return self.i2v_settings
        elif self.job_type == AIJobType.VIDEO_EXTEND:
            return self.extend_settings
        raise ValueError(f"Unknown job type: {self.job_type}")


class AIJobStatus(str, Enum):
    """Status of an AI generation job."""
    QUEUED = "queued"
    PROCESSING = "processing"
    UPLOADING = "uploading"  # Uploading from GCS to S3
    COMPLETED = "completed"
    FAILED = "failed"


class AIJobResponse(BaseModel):
    """Response model for AI job submission."""
    job_id: str = Field(..., description="Job identifier")
    job_type: AIJobType = Field(..., description="Type of AI job")
    status: AIJobStatus = Field(..., description="Current job status")
    message: Optional[str] = Field(default=None, description="Status message")

    # Operation tracking (for async jobs)
    operation_name: Optional[str] = Field(
        default=None,
        description="Vertex AI operation name for tracking"
    )

    # Output URLs (populated when completed)
    output_url: Optional[str] = Field(
        default=None,
        description="S3 URL of generated content"
    )
    gcs_url: Optional[str] = Field(
        default=None,
        description="GCS URL of generated content (internal)"
    )

    # Error information
    error: Optional[str] = Field(
        default=None,
        description="Error message if failed"
    )

    # Metadata
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional response metadata"
    )


class AIJobCallback(BaseModel):
    """Callback payload sent when AI job completes."""
    job_id: str = Field(..., description="Job identifier")
    job_type: AIJobType = Field(..., description="Type of AI job")
    status: AIJobStatus = Field(..., description="Final job status")
    output_url: Optional[str] = Field(
        default=None,
        description="S3 URL of generated content"
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if failed"
    )
    duration_ms: Optional[int] = Field(
        default=None,
        description="Total processing time in milliseconds"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata"
    )
