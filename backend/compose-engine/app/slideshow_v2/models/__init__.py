"""Data models for Slideshow V2."""

from .config import SlideshowConfig, StylePreset, AspectRatio
from .timeline import Timeline, TimelineSegment, TransitionPoint, CaptionSegment
from .audio import AudioAnalysisResult, BeatInfo, MusicStructure

__all__ = [
    "SlideshowConfig",
    "StylePreset",
    "AspectRatio",
    "Timeline",
    "TimelineSegment",
    "TransitionPoint",
    "CaptionSegment",
    "AudioAnalysisResult",
    "BeatInfo",
    "MusicStructure",
]
