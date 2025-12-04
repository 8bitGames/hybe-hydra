"""
Renderer Module for Slideshow V2.

High-performance video rendering with:
- GPU acceleration (NVENC)
- FFmpeg xfade transitions
- Beat-synchronized effects
- Text overlays
"""

from .engine import SlideshowRenderer

__all__ = ["SlideshowRenderer"]
