"""
Slideshow V2 - AI-Driven Automated Video Composition Engine

A robust, flexible system for creating meaningful slideshow videos with:
- **AI Conductor** (Gemini 2.5 Flash) for intelligent composition decisions
- Advanced audio analysis (beat detection, mood, structure)
- 40+ FFmpeg xfade transitions
- 17+ motion effects (Ken Burns)
- 14+ color grading presets
- GPU-accelerated effects (CuPy)
- Dynamic caption animations
- Style-based presets (K-pop, Cinematic, Viral TikTok)

Architecture:
    Input (Images + Audio + Lyrics)
           ↓
    Analyzers (Audio + Image)
           ↓
    AI Conductor (Gemini 2.5 Flash)
           ↓
    Timeline Generator
           ↓
    GPU Effects Processor
           ↓
    Video Renderer (FFmpeg + NVENC)
           ↓
    Output Video

Usage:
    from app.slideshow_v2 import SlideshowEngine, create_slideshow

    # Async usage
    engine = SlideshowEngine()
    result = await engine.create_slideshow(
        image_paths=["img1.jpg", "img2.jpg"],
        audio_path="music.mp3",
        lyrics=["Line 1", "Line 2"],
        style_hint="energetic K-pop",
        output_path="output.mp4"
    )

    # Simple function
    output = await create_slideshow(
        images=["img1.jpg", "img2.jpg"],
        audio="music.mp3",
        captions=["Line 1", "Line 2"],
        style="cinematic",
    )
"""

from .engine import SlideshowEngine, SlideshowEngineSync, SlideshowResult, create_slideshow
from .models.config import SlideshowConfig, StylePreset, get_preset
from .models.timeline import Timeline, TimelineSegment, TransitionPoint, CaptionSegment
from .conductor import GeminiConductor, CompositionPlan
from .analyzers.audio_analyzer import AdvancedAudioAnalyzer
from .analyzers.image_analyzer import ImageAnalyzer
from .effects.registry import EffectsRegistry, get_registry
from .generators.timeline_generator import TimelineGenerator
from .renderer.engine import SlideshowRenderer, RenderConfig

__version__ = "2.0.0"
__all__ = [
    # Main Engine
    "SlideshowEngine",
    "SlideshowEngineSync",
    "SlideshowResult",
    "create_slideshow",

    # Configuration
    "SlideshowConfig",
    "StylePreset",
    "get_preset",
    "RenderConfig",

    # AI Conductor
    "GeminiConductor",
    "CompositionPlan",

    # Analyzers
    "AdvancedAudioAnalyzer",
    "ImageAnalyzer",

    # Effects
    "EffectsRegistry",
    "get_registry",

    # Timeline
    "Timeline",
    "TimelineSegment",
    "TransitionPoint",
    "CaptionSegment",
    "TimelineGenerator",

    # Renderer
    "SlideshowRenderer",
]
