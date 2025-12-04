"""Effect renderers for applying transitions and effects to video clips."""

from .xfade_renderer import XfadeRenderer
from .adapter import RendererAdapter, get_renderer

# GL renderer is optional (requires PyOpenGL + OSMesa)
try:
    from .gl_renderer import GLTransitionRenderer, get_gl_renderer, is_gl_available, GL_TRANSITIONS
    GL_AVAILABLE = True
except ImportError:
    GL_AVAILABLE = False
    GLTransitionRenderer = None
    get_gl_renderer = None
    is_gl_available = None
    GL_TRANSITIONS = {}

__all__ = [
    "XfadeRenderer",
    "RendererAdapter",
    "get_renderer",
    # GL renderer exports (may be None if not available)
    "GLTransitionRenderer",
    "get_gl_renderer",
    "is_gl_available",
    "GL_TRANSITIONS",
    "GL_AVAILABLE",
]
