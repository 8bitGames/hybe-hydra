"""Main video rendering service using pure FFmpeg pipeline.

This module provides the VideoRenderer class which uses FFmpegRenderer
for GPU-accelerated video rendering with NVENC support.
"""

import logging
from typing import Callable, Optional

from ..renderers.ffmpeg_renderer import FFmpegRenderer
from ..models.render_job import RenderRequest

logger = logging.getLogger(__name__)


class VideoRenderer:
    """Main service for rendering composed videos using FFmpeg pipeline.

    This class delegates all rendering to FFmpegRenderer which provides:
    - 3x faster rendering than MoviePy
    - 50% less memory usage
    - Better GPU utilization with NVENC
    - No Python per-frame processing bottleneck
    """

    def __init__(self, use_ffmpeg_pipeline: Optional[bool] = None):
        """Initialize VideoRenderer.

        Args:
            use_ffmpeg_pipeline: Ignored (always uses FFmpeg pipeline).
                Kept for backward compatibility.
        """
        self._renderer = FFmpegRenderer()
        logger.info("[VideoRenderer] Using FFmpeg pipeline")

    async def render(
        self,
        request: RenderRequest,
        progress_callback: Optional[Callable] = None
    ) -> str:
        """Render video using FFmpeg pipeline.

        Args:
            request: RenderRequest with images, audio, settings
            progress_callback: Optional async callback for progress updates

        Returns:
            S3 URL of rendered video
        """
        logger.info(f"[{request.job_id}] Delegating to FFmpeg pipeline")
        return await self._renderer.render(request, progress_callback)
