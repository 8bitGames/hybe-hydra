"""Service modules for video composition."""

from .audio_analyzer import AudioAnalyzer
from .beat_sync import BeatSyncEngine
from .video_renderer import VideoRenderer
from .image_fetcher import ImageFetcher
from .image_processor import ImageProcessor
from .gcp_auth import GCPAuthManager, get_auth_manager, get_access_token
from .vertex_ai import (
    VertexAIClient,
    create_vertex_ai_client,
    generate_video,
    generate_image,
    VideoGenerationConfig,
    ImageGenerationConfig,
    GenerationResult,
)

__all__ = [
    # Video composition services
    "AudioAnalyzer",
    "BeatSyncEngine",
    "VideoRenderer",
    "ImageFetcher",
    "ImageProcessor",
    # GCP authentication
    "GCPAuthManager",
    "get_auth_manager",
    "get_access_token",
    # Vertex AI client
    "VertexAIClient",
    "create_vertex_ai_client",
    "generate_video",
    "generate_image",
    "VideoGenerationConfig",
    "ImageGenerationConfig",
    "GenerationResult",
]
