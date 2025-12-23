"""
AI Conductor - Gemini 2.5 Flash powered composition engine.

The Conductor analyzes:
- Lyrics/script content and emotional arc
- Images (visual content, colors, mood)
- Audio analysis (beats, energy, structure)

And outputs a complete composition plan:
- Which transitions to use between which images
- Motion effects per image
- Caption timing and animation
- Color grading decisions
- Beat-sync points
"""

from .gemini_conductor import GeminiConductor
from .schemas import (
    CompositionPlan,
    SegmentPlan,
    TransitionPlan,
    CaptionPlan,
    EffectsPlan,
)

__all__ = [
    "GeminiConductor",
    "CompositionPlan",
    "SegmentPlan",
    "TransitionPlan",
    "CaptionPlan",
    "EffectsPlan",
]
