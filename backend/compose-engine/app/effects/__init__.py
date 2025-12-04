"""Video effects and transitions."""

from .transitions import (
    apply_crossfade,
    apply_zoom_transition,
    apply_bounce_transition,
    apply_slide_transition,
    get_transition
)
from .filters import apply_color_grade
from .text_overlay import create_text_clip
from .motion import apply_ken_burns

# AI Effect Selection System
from .registry import get_registry, EffectRegistry, EffectMetadata
from .selector import EffectSelector, SelectionConfig, SelectedEffects, select_effects

# Analyzer requires google-generativeai - import conditionally
try:
    from .analyzer import get_analyzer, PromptAnalyzer, PromptAnalysis
except ImportError:
    get_analyzer = None
    PromptAnalyzer = None
    PromptAnalysis = None

# Renderers
from .renderers import XfadeRenderer, RendererAdapter, get_renderer

__all__ = [
    # Existing effects
    "apply_crossfade",
    "apply_zoom_transition",
    "apply_bounce_transition",
    "apply_slide_transition",
    "get_transition",
    "apply_color_grade",
    "create_text_clip",
    "apply_ken_burns",
    # AI Effect Selection
    "get_registry",
    "EffectRegistry",
    "EffectMetadata",
    "get_analyzer",
    "PromptAnalyzer",
    "PromptAnalysis",
    "EffectSelector",
    "SelectionConfig",
    "SelectedEffects",
    "select_effects",
    # Renderers
    "XfadeRenderer",
    "RendererAdapter",
    "get_renderer",
]
