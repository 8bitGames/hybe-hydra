"""Renderer Adapter - Unified interface for applying video transitions.

Provides automatic fallback: GL Transitions -> xfade -> MoviePy
"""

import os
import logging
from typing import List, Optional, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum
from moviepy import ImageClip, CompositeVideoClip, concatenate_videoclips

from .xfade_renderer import XfadeRenderer, ClipSegment, XFADE_TRANSITIONS
from ..registry import get_registry, EffectMetadata, BLACKLISTED_EFFECTS

# Try to import GL renderer and transitions
try:
    from .gl_renderer import get_gl_renderer, is_gl_available
    from app.effects.glsl.gl_transitions_lib import GL_TRANSITIONS, has_transition as has_gl_transition
    GL_RENDERER_AVAILABLE = True
except ImportError:
    GL_RENDERER_AVAILABLE = False
    GL_TRANSITIONS = {}
    has_gl_transition = lambda x: False

logger = logging.getLogger(__name__)


class RendererType(Enum):
    """Available renderer types."""
    GL_TRANSITIONS = "gl-transitions"
    XFADE = "ffmpeg-xfade"
    MOVIEPY = "moviepy"


@dataclass
class TransitionSpec:
    """Specification for a single transition."""
    effect_id: str
    duration: float = 0.5
    params: Optional[Dict[str, Any]] = None


class RendererAdapter:
    """
    Unified adapter for applying video transitions.

    Automatically selects the best renderer based on effect type
    and provides fallback when primary renderer fails.
    """

    def __init__(
        self,
        prefer_gpu: bool = True,
        fallback_enabled: bool = True,
    ):
        """
        Initialize renderer adapter.

        Args:
            prefer_gpu: Prefer GPU-accelerated renderers
            fallback_enabled: Enable automatic fallback on failure
        """
        self.prefer_gpu = prefer_gpu
        self.fallback_enabled = fallback_enabled
        self.registry = get_registry()

        # Initialize renderers
        self.xfade_renderer = XfadeRenderer()
        self._gl_renderer = None
        self._gl_available = self._check_gl_transitions()

    def _check_gl_transitions(self) -> bool:
        """Check if GL Transitions are available."""
        if not GL_RENDERER_AVAILABLE:
            logger.info("GL renderer module not available")
            return False

        try:
            if is_gl_available():
                self._gl_renderer = get_gl_renderer()
                if self._gl_renderer:
                    logger.info("GL Transitions enabled (OSMesa software rendering)")
                    print("[ADAPTER] GL Transitions ENABLED via OSMesa!")
                    return True
        except Exception as e:
            logger.warning(f"GL renderer check failed: {e}")

        logger.info("GL Transitions not available, using xfade fallback")
        return False

    def get_renderer_for_effect(self, effect_id: str) -> RendererType:
        """
        Determine which renderer to use for an effect.

        Prioritizes GL Transitions when available for best quality.

        Args:
            effect_id: Effect ID from registry

        Returns:
            Appropriate RendererType
        """
        # First, check if this is a GL transition (gl_ prefix)
        if effect_id.startswith("gl_"):
            if self._gl_available and self.prefer_gpu:
                # Check if transition exists in GL library
                if has_gl_transition(effect_id):
                    return RendererType.GL_TRANSITIONS
            # Fallback to xfade
            return RendererType.XFADE

        effect = self.registry.get(effect_id)

        if not effect:
            # Check if it might be a GL transition without registry entry
            if effect_id.startswith("gl_") and has_gl_transition(effect_id):
                if self._gl_available and self.prefer_gpu:
                    return RendererType.GL_TRANSITIONS
                return RendererType.XFADE
            return RendererType.MOVIEPY

        if effect.source == "gl-transitions":
            if self._gl_available and self.prefer_gpu:
                return RendererType.GL_TRANSITIONS
            # Fallback to xfade if similar effect exists
            return RendererType.XFADE

        elif effect.source == "ffmpeg-xfade":
            return RendererType.XFADE

        else:
            return RendererType.MOVIEPY

    def apply_transitions_to_clips(
        self,
        clips: List[ImageClip],
        transitions: List[TransitionSpec],
        temp_dir: str,
        job_id: str = "render",
    ) -> CompositeVideoClip:
        """
        Apply transitions to MoviePy clips.

        This is the main integration point with video_renderer.py.
        It handles the transition application intelligently based on effect types.

        Args:
            clips: List of MoviePy ImageClip objects
            transitions: List of TransitionSpec for each transition
            temp_dir: Temporary directory for intermediate files
            job_id: Job ID for logging

        Returns:
            CompositeVideoClip with transitions applied
        """
        if len(clips) <= 1:
            return clips[0] if clips else None

        # Ensure we have enough transitions
        while len(transitions) < len(clips) - 1:
            transitions.append(TransitionSpec(effect_id="xfade_fade", duration=0.5))

        # Log the transitions we're about to apply
        effect_ids = [t.effect_id for t in transitions]
        print(f"[ADAPTER][{job_id}] Applying transitions: {effect_ids}")
        logger.info(f"[{job_id}] Applying transitions: {effect_ids}")

        # Group by renderer type for batch processing
        groups = self._group_by_renderer(transitions)
        print(f"[ADAPTER][{job_id}] Renderer types: {[g.value for g in groups]}")
        logger.info(f"[{job_id}] Renderer types: {[g.value for g in groups]}")

        # If all transitions can use xfade, process as batch
        if all(r == RendererType.XFADE for r in groups):
            print(f"[ADAPTER][{job_id}] Using xfade batch renderer for {len(transitions)} transitions")
            logger.info(f"[{job_id}] Using xfade batch renderer for {len(transitions)} transitions")
            result = self._apply_xfade_batch(clips, transitions, temp_dir, job_id)
            if result is not None:
                print(f"[ADAPTER][{job_id}] xfade batch SUCCESS!")
                return result
            print(f"[ADAPTER][{job_id}] xfade batch FAILED, falling back to MoviePy")
            logger.warning(f"[{job_id}] xfade batch failed, falling back to MoviePy")

        # Otherwise, fall back to MoviePy-based processing
        print(f"[ADAPTER][{job_id}] Using MoviePy fallback renderer")
        logger.info(f"[{job_id}] Using MoviePy fallback renderer")
        return self._apply_moviepy_transitions(clips, transitions)

    def _group_by_renderer(self, transitions: List[TransitionSpec]) -> List[RendererType]:
        """Group transitions by their renderer type."""
        return [self.get_renderer_for_effect(t.effect_id) for t in transitions]

    def _apply_xfade_batch(
        self,
        clips: List[ImageClip],
        transitions: List[TransitionSpec],
        temp_dir: str,
        job_id: str,
    ) -> Optional[CompositeVideoClip]:
        """
        Apply transitions using FFmpeg xfade in batch.

        This is more efficient than processing transitions individually.
        """
        try:
            # Export clips as video files
            clip_paths = []
            segments = []

            for i, clip in enumerate(clips):
                clip_path = os.path.join(temp_dir, f"{job_id}_clip_{i}.mp4")

                # Write clip to file (without audio for now)
                clip.write_videofile(
                    clip_path,
                    fps=30,
                    codec="libx264",
                    preset="ultrafast",
                    audio=False,
                    logger=None
                )

                clip_paths.append(clip_path)
                segments.append(ClipSegment(
                    path=clip_path,
                    duration=clip.duration,
                    start_time=clip.start if hasattr(clip, 'start') else 0
                ))

            # Get xfade transition names with blacklist filtering
            xfade_names = []
            for t in transitions:
                # ALWAYS check blacklist FIRST, regardless of source
                if t.effect_id in BLACKLISTED_EFFECTS:
                    logger.warning(f"[{job_id}] Replacing blacklisted {t.effect_id} with fade")
                    xfade_names.append("fade")
                elif t.effect_id in XFADE_TRANSITIONS:
                    xfade_names.append(XFADE_TRANSITIONS[t.effect_id])
                elif t.effect_id.startswith("xfade_"):
                    xfade_name = t.effect_id.replace("xfade_", "")
                    xfade_names.append(xfade_name)
                else:
                    # Map GL transition to similar xfade with diversity
                    xfade_names.append(self._map_to_xfade(t.effect_id))

            print(f"[ADAPTER][{job_id}] xfade effects to apply: {xfade_names}")
            logger.info(f"[{job_id}] xfade effects to apply: {xfade_names}")

            # Render with xfade
            output_path = os.path.join(temp_dir, f"{job_id}_xfade_output.mp4")
            avg_duration = sum(t.duration for t in transitions) / len(transitions)

            success = self.xfade_renderer.render_sequence(
                clips=segments,
                output_path=output_path,
                transitions=xfade_names,
                transition_duration=avg_duration,
                use_gpu=self.prefer_gpu
            )

            if success and os.path.exists(output_path):
                # Load the result back as a MoviePy clip
                from moviepy import VideoFileClip
                print(f"[ADAPTER][{job_id}] Loading xfade output from: {output_path}")
                file_size = os.path.getsize(output_path)
                print(f"[ADAPTER][{job_id}] Output file size: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)")
                result = VideoFileClip(output_path)
                print(f"[ADAPTER][{job_id}] Loaded clip duration: {result.duration}s, size: {result.size}")
                logger.info(f"[{job_id}] Applied {len(transitions)} xfade transitions")
                return result
            else:
                print(f"[ADAPTER][{job_id}] xfade output failed - success={success}, exists={os.path.exists(output_path)}")

            # Cleanup temp clips on failure
            for path in clip_paths:
                try:
                    os.remove(path)
                except Exception:
                    pass

            return None

        except Exception as e:
            logger.error(f"[{job_id}] xfade batch failed: {e}")
            return None

    def _map_to_xfade(self, effect_id: str) -> str:
        """Map a GL Transition or other effect to similar xfade transition.

        IMPORTANT: Never map to blacklisted effects that cause visual corruption.
        DIVERSITY: Each GL effect maps to a UNIQUE xfade effect for variety.
        """
        # Mapping from GL Transitions to xfade equivalents
        # NOTE: Avoid mapping to blacklisted effects (hlslice, hrslice, vuslice, vdslice, hblur)
        # DIVERSITY: Spread effects across ALL available safe xfade transitions
        # Contains 50+ GL transitions from gl-transitions library
        gl_to_xfade = {
            # === BASIC TRANSITIONS ===
            "gl_fade": "fade",
            "gl_fadecolor": "fadeblack",
            "gl_fadegrayscale": "fadegrays",

            # === WIPE TRANSITIONS ===
            "gl_wipeleft": "wipeleft",
            "gl_wiperight": "wiperight",
            "gl_wipeup": "wipeup",
            "gl_wipedown": "wipedown",
            "gl_directionalwipe": "wipeleft",
            "gl_windowslice": "wiperight",
            "gl_directional": "slideup",

            # === SLIDE TRANSITIONS ===
            "gl_slideright": "slideright",
            "gl_slideleft": "slideleft",
            "gl_swap": "slideright",
            "gl_leftright": "slideright",
            "gl_wind": "slideleft",

            # === CIRCLE TRANSITIONS ===
            "gl_circle": "circleopen",
            "gl_circleopen": "circleopen",
            "gl_circleclose": "circleclose",
            "gl_heart": "circleopen",
            "gl_zoomincircles": "circleopen",
            "gl_polar_function": "circleclose",
            "gl_waterdrop": "circlecrop",

            # === ZOOM TRANSITIONS ===
            "gl_zoomin": "zoomin",
            "gl_crosszoom": "zoomin",
            "gl_simpleZoom": "zoomin",
            "gl_dreamy_zoom": "zoomin",
            "gl_rotate_scale_fade": "zoomin",

            # === ROTATION TRANSITIONS ===
            "gl_pinwheel": "radial",
            "gl_radial": "radial",
            "gl_rotate": "radial",
            "gl_swirl": "diagtr",
            "gl_kaleidoscope": "radial",
            "gl_powerKaleido": "diagbl",
            "gl_angular": "wipetl",

            # === 3D/CUBE TRANSITIONS ===
            "gl_cube": "diagtl",
            "gl_doorway": "vertopen",
            "gl_stereo_viewer": "horzopen",
            "gl_bowtiehorizontal": "horzopen",
            "gl_bowtievertical": "vertopen",
            "gl_bowTie": "vertclose",

            # === PIXEL/MOSAIC TRANSITIONS ===
            "gl_pixelize": "pixelize",
            "gl_mosaic": "rectcrop",
            "gl_randomsquares": "pixelize",
            "gl_hexagonalize": "pixelize",
            "gl_crosshatch": "rectcrop",
            "gl_squareswipe": "rectcrop",
            "gl_gridflip": "diagtl",

            # === DISTORTION TRANSITIONS ===
            "gl_crosswarp": "dissolve",
            "gl_dreamy": "smoothleft",
            "gl_morph": "distance",
            "gl_ripple": "smoothdown",
            "gl_squeeze": "squeezeh",
            "gl_butterflywavescrawler": "horzclose",
            "gl_undulating": "wipedown",
            "gl_colordistance": "distance",
            "gl_perlin": "smoothup",
            "gl_doomscreenmelt": "smoothdown",
            "gl_linearblur": "smoothright",
            "gl_flyeye": "squeezev",

            # === GLITCH TRANSITIONS ===
            "gl_glitchdisplace": "circlecrop",
            "gl_glitchmemories": "dissolve",
            "gl_static": "fadewhite",
            "gl_tvstatic": "fadewhite",

            # === SPECIAL EFFECTS ===
            "gl_burn": "fadeblack",
            "gl_film_burn": "fadeblack",
            "gl_overexposure": "fadewhite",
            "gl_colorphase": "fadegrays",
            "gl_colorphaseRotate": "diagbr",
            "gl_luminance_melt": "fadegrays",
            "gl_multiply_blend": "dissolve",
            "gl_displacement": "wipeup",
            "gl_inverted_page_curl": "wipebr",
            "gl_directionalscaled": "wipetr",
            "gl_directionalwarp": "wipebl",
            "gl_bounce": "slidedown",
            "gl_polkadotscurtain": "circleclose",
            "gl_windowblinds": "horzopen",
        }

        # Try direct mapping
        if effect_id in gl_to_xfade:
            mapped = gl_to_xfade[effect_id]
            # Double-check: ensure mapped effect is not blacklisted
            xfade_id = f"xfade_{mapped}"
            if xfade_id in BLACKLISTED_EFFECTS:
                logger.warning(f"Mapped effect {mapped} is blacklisted, using fade instead")
                return "fade"
            return mapped

        # Try partial match - use DIVERSE safe alternatives based on hash
        effect_lower = effect_id.lower()

        # Keyword-based mapping with diversity using hash for variation
        if "fade" in effect_lower:
            variants = ["fade", "fadeblack", "fadewhite", "fadegrays"]
            return variants[hash(effect_id) % len(variants)]
        elif "wipe" in effect_lower:
            variants = ["wipeleft", "wiperight", "wipeup", "wipedown", "wipetl", "wipetr", "wipebl", "wipebr"]
            return variants[hash(effect_id) % len(variants)]
        elif "slide" in effect_lower:
            variants = ["slideleft", "slideright", "slideup", "slidedown"]
            return variants[hash(effect_id) % len(variants)]
        elif "zoom" in effect_lower:
            return "zoomin"
        elif "blur" in effect_lower:
            variants = ["smoothleft", "smoothright", "smoothup", "smoothdown", "dissolve"]
            return variants[hash(effect_id) % len(variants)]
        elif "circle" in effect_lower:
            variants = ["circleopen", "circleclose", "circlecrop"]
            return variants[hash(effect_id) % len(variants)]
        elif "pixel" in effect_lower:
            variants = ["pixelize", "rectcrop"]
            return variants[hash(effect_id) % len(variants)]
        elif "slice" in effect_lower:
            variants = ["wipeleft", "wiperight", "horzopen", "vertopen"]
            return variants[hash(effect_id) % len(variants)]
        elif "diag" in effect_lower:
            variants = ["diagtl", "diagtr", "diagbl", "diagbr"]
            return variants[hash(effect_id) % len(variants)]
        elif "smooth" in effect_lower:
            variants = ["smoothleft", "smoothright", "smoothup", "smoothdown"]
            return variants[hash(effect_id) % len(variants)]
        elif "squeeze" in effect_lower:
            variants = ["squeezev", "squeezeh"]
            return variants[hash(effect_id) % len(variants)]
        elif "vert" in effect_lower:
            variants = ["vertopen", "vertclose"]
            return variants[hash(effect_id) % len(variants)]
        elif "horz" in effect_lower:
            variants = ["horzopen", "horzclose"]
            return variants[hash(effect_id) % len(variants)]

        # Default fallback with diversity based on effect_id hash
        fallback_effects = [
            "fade", "dissolve", "wipeleft", "wiperight", "slideleft", "slideright",
            "circleopen", "vertopen", "horzopen", "diagtl", "smoothleft", "smoothright",
            "fadeblack", "fadegrays", "pixelize", "radial", "zoomin", "distance"
        ]
        return fallback_effects[hash(effect_id) % len(fallback_effects)]

    def _apply_moviepy_transitions(
        self,
        clips: List[ImageClip],
        transitions: List[TransitionSpec],
    ) -> CompositeVideoClip:
        """
        Apply transitions using MoviePy (fallback method).

        Uses the existing transition functions from effects/transitions.py
        """
        from ..transitions import get_transition

        # For MoviePy, we use crossfade for all transitions as a safe fallback
        # The existing transitions.py functions handle this

        # Map transition specs to MoviePy transitions
        transition_type = "crossfade"  # Default

        # Check if all transitions are the same type
        effect_types = set(t.effect_id for t in transitions)
        if len(effect_types) == 1:
            effect_id = list(effect_types)[0]
            if "zoom" in effect_id.lower():
                transition_type = "zoom_beat"
            elif "bounce" in effect_id.lower():
                transition_type = "bounce"
            elif "slide" in effect_id.lower():
                transition_type = "slide"
            elif "cut" in effect_id.lower() or "minimal" in effect_id.lower():
                transition_type = "cut"

        transition_func = get_transition(transition_type)
        avg_duration = sum(t.duration for t in transitions) / len(transitions) if transitions else 0.5

        return transition_func(clips, duration=avg_duration)


# Singleton instance
_renderer_instance: Optional[RendererAdapter] = None


def get_renderer(prefer_gpu: bool = True) -> RendererAdapter:
    """Get the renderer adapter instance."""
    global _renderer_instance
    if _renderer_instance is None:
        _renderer_instance = RendererAdapter(prefer_gpu=prefer_gpu)
    return _renderer_instance
