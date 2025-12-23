"""Pydantic models for API requests and responses."""

from .render_job import (
    RenderRequest,
    RenderResponse,
    ImageData,
    AudioData,
    ScriptData,
    ScriptLine,
    RenderSettings,
    OutputSettings
)
from .responses import (
    JobStatus,
    JobStatusResponse,
    AudioAnalysis,
    ImageSearchResult
)
from .ai_job import (
    AIJobType,
    AIJobRequest,
    AIJobResponse,
    AIJobStatus,
    AIJobCallback,
    AIOutputSettings,
    VideoGenerationSettings,
    ImageGenerationSettings,
    ImageToVideoSettings,
)

__all__ = [
    # Render job models
    "RenderRequest",
    "RenderResponse",
    "ImageData",
    "AudioData",
    "ScriptData",
    "ScriptLine",
    "RenderSettings",
    "OutputSettings",
    # Response models
    "JobStatus",
    "JobStatusResponse",
    "AudioAnalysis",
    "ImageSearchResult",
    # AI job models
    "AIJobType",
    "AIJobRequest",
    "AIJobResponse",
    "AIJobStatus",
    "AIJobCallback",
    "AIOutputSettings",
    "VideoGenerationSettings",
    "ImageGenerationSettings",
    "ImageToVideoSettings",
]
