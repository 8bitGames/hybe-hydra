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
from ..registry import get_registry, EffectMetadata

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
        self._gl_available = self._check_gl_transitions()

    def _check_gl_transitions(self) -> bool:
        """Check if GL Transitions are available."""
        # GL Transitions require ffmpeg-gl-transition build
        # For now, we'll mark as unavailable and use xfade fallback
        # TODO: Implement GL Transitions check when available
        return False

    def get_renderer_for_effect(self, effect_id: str) -> RendererType:
        """
        Determine which renderer to use for an effect.

        Args:
            effect_id: Effect ID from registry

        Returns:
            Appropriate RendererType
        """
        effect = self.registry.get(effect_id)

        if not effect:
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

        # Group by renderer type for batch processing
        groups = self._group_by_renderer(transitions)

        # If all transitions can use xfade, process as batch
        if all(r == RendererType.XFADE for r in groups):
            result = self._apply_xfade_batch(clips, transitions, temp_dir, job_id)
            if result is not None:
                return result

        # Otherwise, fall back to MoviePy-based processing
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

            # Get xfade transition names
            xfade_names = []
            for t in transitions:
                if t.effect_id in XFADE_TRANSITIONS:
                    xfade_names.append(XFADE_TRANSITIONS[t.effect_id])
                elif t.effect_id.startswith("xfade_"):
                    xfade_names.append(t.effect_id.replace("xfade_", ""))
                else:
                    # Map GL transition to similar xfade
                    xfade_names.append(self._map_to_xfade(t.effect_id))

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
                result = VideoFileClip(output_path)
                logger.info(f"[{job_id}] Applied {len(transitions)} xfade transitions")
                return result

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
        """Map a GL Transition or other effect to similar xfade transition."""
        # Mapping from GL Transitions to xfade equivalents
        gl_to_xfade = {
            # Direct mappings
            "gl_fade": "fade",
            "gl_fadecolor": "fadeblack",
            "gl_fadegrayscale": "fadegrays",
            "gl_crosswarp": "dissolve",
            "gl_dreamy": "hblur",
            "gl_pixelize": "pixelize",
            "gl_circleopen": "circleopen",
            "gl_directionalwipe": "wipeleft",
            "gl_cube": "diagtl",
            "gl_doorway": "vertopen",
            "gl_linearblur": "hblur",
            "gl_radial": "radial",
            "gl_windowslice": "hlslice",
            "gl_squeeze": "squeezeh",
            "gl_crosszoom": "zoomin",
            "gl_swap": "slideright",
            "gl_mosaic": "pixelize",
            "gl_burn": "fadeblack",
            "gl_colorphase": "fadegrays",
            "gl_glitchdisplace": "pixelize",
            "gl_hexagonalize": "pixelize",
            "gl_kaleidoscope": "radial",
            "gl_morph": "dissolve",
            "gl_perlin": "dissolve",
            "gl_polkadotscurtain": "circleopen",
            "gl_ripple": "dissolve",
            "gl_rotate_scale_fade": "zoomin",
            "gl_swirl": "radial",
            "gl_wind": "slideleft",
            "gl_windowblinds": "hlslice",
        }

        # Try direct mapping
        if effect_id in gl_to_xfade:
            return gl_to_xfade[effect_id]

        # Try partial match
        effect_lower = effect_id.lower()
        if "fade" in effect_lower:
            return "fade"
        elif "wipe" in effect_lower:
            return "wipeleft"
        elif "slide" in effect_lower:
            return "slideleft"
        elif "zoom" in effect_lower:
            return "zoomin"
        elif "blur" in effect_lower:
            return "hblur"
        elif "circle" in effect_lower:
            return "circleopen"
        elif "pixel" in effect_lower:
            return "pixelize"

        # Default fallback
        return "fade"

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
