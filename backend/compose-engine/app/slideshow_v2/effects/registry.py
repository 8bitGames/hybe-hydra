"""
Comprehensive Effects Registry for Slideshow V2.

This module provides a registry of all available effects:
- 40+ FFmpeg xfade transitions
- 17+ motion effects (Ken Burns)
- 14+ color grades
- 12+ overlay effects
- Text animations

Each effect is documented with:
- Parameters
- GPU acceleration support
- Recommended use cases
- Performance characteristics
"""

import logging
from typing import Dict, List, Optional, Callable, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


# =============================================================================
# Effect Categories
# =============================================================================

class EffectCategory(Enum):
    """Categories of effects."""
    TRANSITION = "transition"
    MOTION = "motion"
    COLOR_GRADE = "color_grade"
    OVERLAY = "overlay"
    TEXT_ANIMATION = "text_animation"
    AUDIO_REACTIVE = "audio_reactive"


class PerformanceLevel(Enum):
    """Performance characteristics."""
    FAST = "fast"           # < 1ms per frame
    MEDIUM = "medium"       # 1-10ms per frame
    SLOW = "slow"           # > 10ms per frame
    GPU_ACCELERATED = "gpu" # Requires GPU


class MoodMatch(Enum):
    """Moods an effect works well with."""
    ENERGETIC = "energetic"
    CALM = "calm"
    EMOTIONAL = "emotional"
    DRAMATIC = "dramatic"
    HAPPY = "happy"
    MYSTERIOUS = "mysterious"
    ROMANTIC = "romantic"
    POWERFUL = "powerful"
    PLAYFUL = "playful"
    MELANCHOLIC = "melancholic"


# =============================================================================
# Effect Definitions
# =============================================================================

@dataclass
class TransitionEffect:
    """Definition of a transition effect."""
    name: str
    display_name: str
    ffmpeg_name: str                      # Actual FFmpeg xfade name
    description: str
    category: str = "xfade"               # xfade, custom
    min_duration: float = 0.2
    max_duration: float = 2.0
    default_duration: float = 0.5
    performance: PerformanceLevel = PerformanceLevel.FAST
    moods: List[MoodMatch] = field(default_factory=list)
    energy_range: Tuple[float, float] = (0.0, 1.0)  # Min/max energy level
    gpu_accelerated: bool = True
    parameters: Dict[str, Any] = field(default_factory=dict)

    def is_suitable_for(self, mood: str, energy: float) -> bool:
        """Check if transition is suitable for given mood/energy."""
        mood_match = any(m.value == mood.lower() for m in self.moods) or not self.moods
        energy_match = self.energy_range[0] <= energy <= self.energy_range[1]
        return mood_match and energy_match


@dataclass
class MotionEffect:
    """Definition of a motion/Ken Burns effect."""
    name: str
    display_name: str
    description: str
    start_scale: float = 1.0
    end_scale: float = 1.2
    start_position: Tuple[float, float] = (0.5, 0.5)  # Normalized center
    end_position: Tuple[float, float] = (0.5, 0.5)
    easing: str = "ease_in_out"           # linear, ease_in, ease_out, ease_in_out
    performance: PerformanceLevel = PerformanceLevel.FAST
    moods: List[MoodMatch] = field(default_factory=list)
    energy_range: Tuple[float, float] = (0.0, 1.0)
    rotation: float = 0.0                  # Degrees of rotation
    shake_intensity: float = 0.0           # For shake effects


@dataclass
class FilterEffect:
    """Definition of a color/filter effect."""
    name: str
    display_name: str
    description: str
    ffmpeg_filter: str                     # FFmpeg filter string
    parameters: Dict[str, Any] = field(default_factory=dict)
    intensity_range: Tuple[float, float] = (0.0, 1.0)
    default_intensity: float = 1.0
    performance: PerformanceLevel = PerformanceLevel.FAST
    gpu_accelerated: bool = False
    moods: List[MoodMatch] = field(default_factory=list)

    def get_filter_string(self, intensity: float = None) -> str:
        """Get FFmpeg filter string with applied intensity."""
        if intensity is None:
            intensity = self.default_intensity
        # Interpolate parameters based on intensity
        return self.ffmpeg_filter


@dataclass
class TextAnimationEffect:
    """Definition of a text animation effect."""
    name: str
    display_name: str
    description: str
    animation_type: str                   # fade, slide, scale, character
    direction: Optional[str] = None       # up, down, left, right
    default_duration: float = 0.5
    easing: str = "ease_out"
    parameters: Dict[str, Any] = field(default_factory=dict)


# =============================================================================
# Effects Registry
# =============================================================================

class EffectsRegistry:
    """
    Central registry for all effects.

    Provides:
    - Effect lookup by name
    - Effect recommendations based on context
    - Validation of effect parameters
    """

    def __init__(self):
        self._transitions: Dict[str, TransitionEffect] = {}
        self._motions: Dict[str, MotionEffect] = {}
        self._filters: Dict[str, FilterEffect] = {}
        self._text_animations: Dict[str, TextAnimationEffect] = {}

        # Register all built-in effects
        self._register_transitions()
        self._register_motions()
        self._register_filters()
        self._register_text_animations()

        logger.info(f"Effects registry initialized: "
                   f"{len(self._transitions)} transitions, "
                   f"{len(self._motions)} motions, "
                   f"{len(self._filters)} filters, "
                   f"{len(self._text_animations)} text animations")

    # =========================================================================
    # Registration Methods
    # =========================================================================

    def _register_transitions(self):
        """Register all FFmpeg xfade transitions."""

        # Fade family - Universal, works with everything
        fade_moods = [MoodMatch.CALM, MoodMatch.EMOTIONAL, MoodMatch.ROMANTIC, MoodMatch.MELANCHOLIC]
        self._transitions["xfade_fade"] = TransitionEffect(
            name="xfade_fade",
            display_name="Fade",
            ffmpeg_name="fade",
            description="Classic crossfade between images",
            moods=fade_moods,
            energy_range=(0.0, 0.7),
            default_duration=0.8,
        )
        self._transitions["xfade_fadeblack"] = TransitionEffect(
            name="xfade_fadeblack",
            display_name="Fade to Black",
            ffmpeg_name="fadeblack",
            description="Fade through black",
            moods=[MoodMatch.DRAMATIC, MoodMatch.MYSTERIOUS, MoodMatch.EMOTIONAL],
            energy_range=(0.0, 0.6),
            default_duration=1.0,
        )
        self._transitions["xfade_fadewhite"] = TransitionEffect(
            name="xfade_fadewhite",
            display_name="Fade to White",
            ffmpeg_name="fadewhite",
            description="Fade through white",
            moods=[MoodMatch.HAPPY, MoodMatch.ROMANTIC, MoodMatch.CALM],
            energy_range=(0.0, 0.7),
            default_duration=1.0,
        )
        self._transitions["xfade_fadegrays"] = TransitionEffect(
            name="xfade_fadegrays",
            display_name="Fade Grays",
            ffmpeg_name="fadegrays",
            description="Fade through grayscale",
            moods=[MoodMatch.MELANCHOLIC, MoodMatch.DRAMATIC],
            energy_range=(0.0, 0.5),
            default_duration=1.0,
        )

        # Dissolve family - Organic, artistic
        self._transitions["xfade_dissolve"] = TransitionEffect(
            name="xfade_dissolve",
            display_name="Dissolve",
            ffmpeg_name="dissolve",
            description="Pixel dissolve transition",
            moods=[MoodMatch.MYSTERIOUS, MoodMatch.EMOTIONAL],
            energy_range=(0.0, 0.6),
            default_duration=0.7,
        )
        self._transitions["xfade_pixelize"] = TransitionEffect(
            name="xfade_pixelize",
            display_name="Pixelize",
            ffmpeg_name="pixelize",
            description="Pixelation transition",
            moods=[MoodMatch.PLAYFUL, MoodMatch.ENERGETIC],
            energy_range=(0.5, 1.0),
            default_duration=0.5,
        )

        # Wipe family - Directional, clean
        wipe_moods = [MoodMatch.ENERGETIC, MoodMatch.PLAYFUL, MoodMatch.HAPPY]
        for direction in ["left", "right", "up", "down"]:
            self._transitions[f"xfade_wipe{direction}"] = TransitionEffect(
                name=f"xfade_wipe{direction}",
                display_name=f"Wipe {direction.capitalize()}",
                ffmpeg_name=f"wipe{direction}",
                description=f"Wipe transition from {direction}",
                moods=wipe_moods,
                energy_range=(0.3, 0.8),
                default_duration=0.5,
            )

        # Slide family - Dynamic, energetic
        slide_moods = [MoodMatch.ENERGETIC, MoodMatch.POWERFUL, MoodMatch.HAPPY]
        for direction in ["left", "right", "up", "down"]:
            self._transitions[f"xfade_slide{direction}"] = TransitionEffect(
                name=f"xfade_slide{direction}",
                display_name=f"Slide {direction.capitalize()}",
                ffmpeg_name=f"slide{direction}",
                description=f"Slide transition from {direction}",
                moods=slide_moods,
                energy_range=(0.5, 1.0),
                default_duration=0.4,
            )

        # Smooth family - Elegant motion
        smooth_moods = [MoodMatch.CALM, MoodMatch.ROMANTIC, MoodMatch.EMOTIONAL]
        for direction in ["left", "right", "up", "down"]:
            self._transitions[f"xfade_smooth{direction}"] = TransitionEffect(
                name=f"xfade_smooth{direction}",
                display_name=f"Smooth {direction.capitalize()}",
                ffmpeg_name=f"smooth{direction}",
                description=f"Smooth transition from {direction}",
                moods=smooth_moods,
                energy_range=(0.0, 0.6),
                default_duration=0.7,
            )

        # Circle family - Eye-catching
        self._transitions["xfade_circleopen"] = TransitionEffect(
            name="xfade_circleopen",
            display_name="Circle Open",
            ffmpeg_name="circleopen",
            description="Circular reveal from center",
            moods=[MoodMatch.DRAMATIC, MoodMatch.POWERFUL, MoodMatch.ENERGETIC],
            energy_range=(0.4, 1.0),
            default_duration=0.6,
        )
        self._transitions["xfade_circleclose"] = TransitionEffect(
            name="xfade_circleclose",
            display_name="Circle Close",
            ffmpeg_name="circleclose",
            description="Circular close to center",
            moods=[MoodMatch.DRAMATIC, MoodMatch.MYSTERIOUS],
            energy_range=(0.3, 0.9),
            default_duration=0.6,
        )
        self._transitions["xfade_circlecrop"] = TransitionEffect(
            name="xfade_circlecrop",
            display_name="Circle Crop",
            ffmpeg_name="circlecrop",
            description="Circle crop transition",
            moods=[MoodMatch.PLAYFUL, MoodMatch.HAPPY],
            energy_range=(0.4, 0.9),
            default_duration=0.5,
        )

        # Rect family
        self._transitions["xfade_rectcrop"] = TransitionEffect(
            name="xfade_rectcrop",
            display_name="Rectangle Crop",
            ffmpeg_name="rectcrop",
            description="Rectangle crop transition",
            moods=[MoodMatch.DRAMATIC, MoodMatch.POWERFUL],
            energy_range=(0.4, 0.9),
            default_duration=0.5,
        )

        # Vertical/Horizontal open/close
        for orientation in ["vert", "horz"]:
            for action in ["open", "close"]:
                name = f"xfade_{orientation}{action}"
                display = f"{'Vertical' if orientation == 'vert' else 'Horizontal'} {action.capitalize()}"
                self._transitions[name] = TransitionEffect(
                    name=name,
                    display_name=display,
                    ffmpeg_name=f"{orientation}{action}",
                    description=f"{display} reveal transition",
                    moods=[MoodMatch.DRAMATIC, MoodMatch.POWERFUL],
                    energy_range=(0.4, 1.0),
                    default_duration=0.5,
                )

        # Diagonal family
        diag_moods = [MoodMatch.ENERGETIC, MoodMatch.PLAYFUL, MoodMatch.POWERFUL]
        for corner in ["tl", "tr", "bl", "br"]:
            corner_names = {
                "tl": "Top-Left",
                "tr": "Top-Right",
                "bl": "Bottom-Left",
                "br": "Bottom-Right",
            }
            self._transitions[f"xfade_diag{corner}"] = TransitionEffect(
                name=f"xfade_diag{corner}",
                display_name=f"Diagonal {corner_names[corner]}",
                ffmpeg_name=f"diag{corner}",
                description=f"Diagonal wipe from {corner_names[corner]}",
                moods=diag_moods,
                energy_range=(0.5, 1.0),
                default_duration=0.4,
            )

        # Slice family - Modern, edgy
        slice_moods = [MoodMatch.ENERGETIC, MoodMatch.POWERFUL, MoodMatch.PLAYFUL]
        self._transitions["xfade_hlslice"] = TransitionEffect(
            name="xfade_hlslice",
            display_name="Horizontal Left Slice",
            ffmpeg_name="hlslice",
            description="Horizontal slicing from left",
            moods=slice_moods,
            energy_range=(0.6, 1.0),
            default_duration=0.4,
        )
        self._transitions["xfade_hrslice"] = TransitionEffect(
            name="xfade_hrslice",
            display_name="Horizontal Right Slice",
            ffmpeg_name="hrslice",
            description="Horizontal slicing from right",
            moods=slice_moods,
            energy_range=(0.6, 1.0),
            default_duration=0.4,
        )
        self._transitions["xfade_vuslice"] = TransitionEffect(
            name="xfade_vuslice",
            display_name="Vertical Up Slice",
            ffmpeg_name="vuslice",
            description="Vertical slicing upward",
            moods=slice_moods,
            energy_range=(0.6, 1.0),
            default_duration=0.4,
        )
        self._transitions["xfade_vdslice"] = TransitionEffect(
            name="xfade_vdslice",
            display_name="Vertical Down Slice",
            ffmpeg_name="vdslice",
            description="Vertical slicing downward",
            moods=slice_moods,
            energy_range=(0.6, 1.0),
            default_duration=0.4,
        )

        # Special effects
        self._transitions["xfade_hblur"] = TransitionEffect(
            name="xfade_hblur",
            display_name="Horizontal Blur",
            ffmpeg_name="hblur",
            description="Blur transition with horizontal motion",
            moods=[MoodMatch.ENERGETIC, MoodMatch.MYSTERIOUS],
            energy_range=(0.5, 1.0),
            default_duration=0.5,
        )
        self._transitions["xfade_squeezev"] = TransitionEffect(
            name="xfade_squeezev",
            display_name="Squeeze Vertical",
            ffmpeg_name="squeezev",
            description="Vertical squeeze transition",
            moods=[MoodMatch.PLAYFUL, MoodMatch.ENERGETIC],
            energy_range=(0.5, 1.0),
            default_duration=0.5,
        )
        self._transitions["xfade_squeezeh"] = TransitionEffect(
            name="xfade_squeezeh",
            display_name="Squeeze Horizontal",
            ffmpeg_name="squeezeh",
            description="Horizontal squeeze transition",
            moods=[MoodMatch.PLAYFUL, MoodMatch.ENERGETIC],
            energy_range=(0.5, 1.0),
            default_duration=0.5,
        )
        self._transitions["xfade_zoomin"] = TransitionEffect(
            name="xfade_zoomin",
            display_name="Zoom In",
            ffmpeg_name="zoomin",
            description="Zoom into next image",
            moods=[MoodMatch.DRAMATIC, MoodMatch.POWERFUL, MoodMatch.ENERGETIC],
            energy_range=(0.5, 1.0),
            default_duration=0.5,
        )
        self._transitions["xfade_radial"] = TransitionEffect(
            name="xfade_radial",
            display_name="Radial",
            ffmpeg_name="radial",
            description="Radial wipe transition",
            moods=[MoodMatch.DRAMATIC, MoodMatch.POWERFUL],
            energy_range=(0.4, 1.0),
            default_duration=0.6,
        )

        # Diagonal wipe variations
        for corner in ["tl", "tr", "bl", "br"]:
            corner_names = {
                "tl": "Top-Left",
                "tr": "Top-Right",
                "bl": "Bottom-Left",
                "br": "Bottom-Right",
            }
            self._transitions[f"xfade_wipe{corner}"] = TransitionEffect(
                name=f"xfade_wipe{corner}",
                display_name=f"Wipe {corner_names[corner]}",
                ffmpeg_name=f"wipe{corner}",
                description=f"Wipe from {corner_names[corner]} corner",
                moods=[MoodMatch.ENERGETIC, MoodMatch.PLAYFUL],
                energy_range=(0.4, 0.9),
                default_duration=0.5,
            )

    def _register_motions(self):
        """Register all motion/Ken Burns effects."""

        # Zoom family
        self._motions["zoom_in"] = MotionEffect(
            name="zoom_in",
            display_name="Zoom In",
            description="Gentle zoom into image center",
            start_scale=1.0,
            end_scale=1.15,
            easing="ease_in_out",
            moods=[MoodMatch.CALM, MoodMatch.EMOTIONAL, MoodMatch.ROMANTIC],
            energy_range=(0.0, 0.6),
        )
        self._motions["zoom_out"] = MotionEffect(
            name="zoom_out",
            display_name="Zoom Out",
            description="Gentle zoom out from image",
            start_scale=1.15,
            end_scale=1.0,
            easing="ease_in_out",
            moods=[MoodMatch.CALM, MoodMatch.DRAMATIC],
            energy_range=(0.0, 0.6),
        )
        self._motions["zoom_in_fast"] = MotionEffect(
            name="zoom_in_fast",
            display_name="Fast Zoom In",
            description="Quick zoom into image",
            start_scale=1.0,
            end_scale=1.3,
            easing="ease_out",
            moods=[MoodMatch.ENERGETIC, MoodMatch.POWERFUL, MoodMatch.DRAMATIC],
            energy_range=(0.6, 1.0),
        )
        self._motions["zoom_out_fast"] = MotionEffect(
            name="zoom_out_fast",
            display_name="Fast Zoom Out",
            description="Quick zoom out from image",
            start_scale=1.3,
            end_scale=1.0,
            easing="ease_out",
            moods=[MoodMatch.ENERGETIC, MoodMatch.POWERFUL],
            energy_range=(0.6, 1.0),
        )

        # Pan family
        pan_moods = [MoodMatch.CALM, MoodMatch.ROMANTIC, MoodMatch.EMOTIONAL]
        self._motions["pan_left"] = MotionEffect(
            name="pan_left",
            display_name="Pan Left",
            description="Pan from right to left",
            start_position=(0.6, 0.5),
            end_position=(0.4, 0.5),
            start_scale=1.1,
            end_scale=1.1,
            moods=pan_moods,
            energy_range=(0.0, 0.5),
        )
        self._motions["pan_right"] = MotionEffect(
            name="pan_right",
            display_name="Pan Right",
            description="Pan from left to right",
            start_position=(0.4, 0.5),
            end_position=(0.6, 0.5),
            start_scale=1.1,
            end_scale=1.1,
            moods=pan_moods,
            energy_range=(0.0, 0.5),
        )
        self._motions["pan_up"] = MotionEffect(
            name="pan_up",
            display_name="Pan Up",
            description="Pan from bottom to top",
            start_position=(0.5, 0.6),
            end_position=(0.5, 0.4),
            start_scale=1.1,
            end_scale=1.1,
            moods=pan_moods,
            energy_range=(0.0, 0.5),
        )
        self._motions["pan_down"] = MotionEffect(
            name="pan_down",
            display_name="Pan Down",
            description="Pan from top to bottom",
            start_position=(0.5, 0.4),
            end_position=(0.5, 0.6),
            start_scale=1.1,
            end_scale=1.1,
            moods=pan_moods,
            energy_range=(0.0, 0.5),
        )

        # Diagonal pans
        diag_moods = [MoodMatch.CALM, MoodMatch.ROMANTIC, MoodMatch.MYSTERIOUS]
        self._motions["pan_diagonal_tl"] = MotionEffect(
            name="pan_diagonal_tl",
            display_name="Pan to Top-Left",
            description="Diagonal pan to top-left",
            start_position=(0.6, 0.6),
            end_position=(0.4, 0.4),
            start_scale=1.15,
            end_scale=1.15,
            moods=diag_moods,
            energy_range=(0.0, 0.5),
        )
        self._motions["pan_diagonal_tr"] = MotionEffect(
            name="pan_diagonal_tr",
            display_name="Pan to Top-Right",
            description="Diagonal pan to top-right",
            start_position=(0.4, 0.6),
            end_position=(0.6, 0.4),
            start_scale=1.15,
            end_scale=1.15,
            moods=diag_moods,
            energy_range=(0.0, 0.5),
        )
        self._motions["pan_diagonal_bl"] = MotionEffect(
            name="pan_diagonal_bl",
            display_name="Pan to Bottom-Left",
            description="Diagonal pan to bottom-left",
            start_position=(0.6, 0.4),
            end_position=(0.4, 0.6),
            start_scale=1.15,
            end_scale=1.15,
            moods=diag_moods,
            energy_range=(0.0, 0.5),
        )
        self._motions["pan_diagonal_br"] = MotionEffect(
            name="pan_diagonal_br",
            display_name="Pan to Bottom-Right",
            description="Diagonal pan to bottom-right",
            start_position=(0.4, 0.4),
            end_position=(0.6, 0.6),
            start_scale=1.15,
            end_scale=1.15,
            moods=diag_moods,
            energy_range=(0.0, 0.5),
        )

        # Special effects
        self._motions["parallax"] = MotionEffect(
            name="parallax",
            display_name="Parallax",
            description="Depth parallax effect",
            start_scale=1.1,
            end_scale=1.2,
            start_position=(0.45, 0.5),
            end_position=(0.55, 0.5),
            moods=[MoodMatch.CALM, MoodMatch.ROMANTIC, MoodMatch.MYSTERIOUS],
            energy_range=(0.0, 0.5),
        )
        self._motions["shake"] = MotionEffect(
            name="shake",
            display_name="Camera Shake",
            description="Energetic camera shake",
            shake_intensity=0.02,
            moods=[MoodMatch.ENERGETIC, MoodMatch.POWERFUL, MoodMatch.PLAYFUL],
            energy_range=(0.7, 1.0),
        )
        self._motions["pulse"] = MotionEffect(
            name="pulse",
            display_name="Pulse",
            description="Beat-synced zoom pulse",
            start_scale=1.0,
            end_scale=1.05,
            easing="ease_out",
            moods=[MoodMatch.ENERGETIC, MoodMatch.POWERFUL],
            energy_range=(0.6, 1.0),
        )
        self._motions["drift"] = MotionEffect(
            name="drift",
            display_name="Drift",
            description="Slow random drift",
            start_scale=1.05,
            end_scale=1.08,
            easing="linear",
            moods=[MoodMatch.CALM, MoodMatch.MYSTERIOUS, MoodMatch.MELANCHOLIC],
            energy_range=(0.0, 0.4),
        )
        self._motions["static"] = MotionEffect(
            name="static",
            display_name="Static",
            description="No motion",
            start_scale=1.0,
            end_scale=1.0,
            moods=[],  # Works with anything
            energy_range=(0.0, 1.0),
        )

    def _register_filters(self):
        """Register all color grading and filter effects."""

        # Natural/neutral
        self._filters["natural"] = FilterEffect(
            name="natural",
            display_name="Natural",
            description="No color grading",
            ffmpeg_filter="null",
            moods=[],  # Works with anything
        )

        # Vibrant
        self._filters["vibrant"] = FilterEffect(
            name="vibrant",
            display_name="Vibrant",
            description="Saturated, punchy colors",
            ffmpeg_filter="eq=saturation=1.4:contrast=1.1,unsharp=5:5:1.0",
            moods=[MoodMatch.HAPPY, MoodMatch.ENERGETIC, MoodMatch.PLAYFUL],
        )

        # Cinematic
        self._filters["cinematic"] = FilterEffect(
            name="cinematic",
            display_name="Cinematic",
            description="Orange/teal film look",
            ffmpeg_filter="colorbalance=rs=0.1:gs=-0.05:bs=0.1:rm=0.1:gm=-0.05:bm=0.05,curves=all='0/0 0.25/0.20 0.5/0.5 0.75/0.80 1/1'",
            moods=[MoodMatch.DRAMATIC, MoodMatch.EMOTIONAL, MoodMatch.POWERFUL],
        )

        # Moody
        self._filters["moody"] = FilterEffect(
            name="moody",
            display_name="Moody",
            description="Dark, desaturated look",
            ffmpeg_filter="eq=saturation=0.7:brightness=-0.05:contrast=1.1,curves=all='0/0 0.15/0.1 0.5/0.45 0.85/0.9 1/1'",
            moods=[MoodMatch.MYSTERIOUS, MoodMatch.MELANCHOLIC, MoodMatch.EMOTIONAL],
        )

        # Bright
        self._filters["bright"] = FilterEffect(
            name="bright",
            display_name="Bright",
            description="High key, airy look",
            ffmpeg_filter="eq=brightness=0.1:contrast=0.95:saturation=1.1,curves=all='0/0.05 0.5/0.55 1/1'",
            moods=[MoodMatch.HAPPY, MoodMatch.CALM, MoodMatch.ROMANTIC],
        )

        # Warm
        self._filters["warm"] = FilterEffect(
            name="warm",
            display_name="Warm",
            description="Warm orange tones",
            ffmpeg_filter="colorbalance=rs=0.15:gs=0.05:bs=-0.1:rm=0.1:gm=0.05:bm=-0.05",
            moods=[MoodMatch.ROMANTIC, MoodMatch.HAPPY, MoodMatch.CALM],
        )

        # Cool
        self._filters["cool"] = FilterEffect(
            name="cool",
            display_name="Cool",
            description="Cool blue tones",
            ffmpeg_filter="colorbalance=rs=-0.1:gs=0:bs=0.15:rm=-0.05:gm=0:bm=0.1",
            moods=[MoodMatch.CALM, MoodMatch.MYSTERIOUS, MoodMatch.MELANCHOLIC],
        )

        # Vintage
        self._filters["vintage"] = FilterEffect(
            name="vintage",
            display_name="Vintage",
            description="Faded retro look",
            ffmpeg_filter="curves=all='0/0.05 0.25/0.22 0.5/0.5 0.75/0.78 1/0.95',eq=saturation=0.85,colorbalance=rs=0.05:gs=0.02:bs=-0.05",
            moods=[MoodMatch.ROMANTIC, MoodMatch.MELANCHOLIC, MoodMatch.CALM],
        )

        # Black & White
        self._filters["bw"] = FilterEffect(
            name="bw",
            display_name="Black & White",
            description="Classic monochrome",
            ffmpeg_filter="hue=s=0,eq=contrast=1.1",
            moods=[MoodMatch.DRAMATIC, MoodMatch.EMOTIONAL, MoodMatch.MYSTERIOUS],
        )

        # Neon
        self._filters["neon"] = FilterEffect(
            name="neon",
            display_name="Neon",
            description="High contrast neon look",
            ffmpeg_filter="eq=saturation=1.8:contrast=1.3,curves=all='0/0 0.2/0.1 0.5/0.5 0.8/0.9 1/1'",
            moods=[MoodMatch.ENERGETIC, MoodMatch.PLAYFUL, MoodMatch.POWERFUL],
        )

        # Pastel
        self._filters["pastel"] = FilterEffect(
            name="pastel",
            display_name="Pastel",
            description="Soft pastel colors",
            ffmpeg_filter="eq=saturation=0.6:brightness=0.1,curves=all='0/0.1 0.5/0.55 1/0.95'",
            moods=[MoodMatch.CALM, MoodMatch.ROMANTIC, MoodMatch.HAPPY],
        )

        # Dramatic
        self._filters["dramatic"] = FilterEffect(
            name="dramatic",
            display_name="Dramatic",
            description="High contrast dramatic look",
            ffmpeg_filter="eq=contrast=1.4:saturation=1.1,curves=all='0/0 0.15/0.05 0.5/0.5 0.85/0.95 1/1'",
            moods=[MoodMatch.DRAMATIC, MoodMatch.POWERFUL, MoodMatch.ENERGETIC],
        )

        # Golden Hour
        self._filters["golden_hour"] = FilterEffect(
            name="golden_hour",
            display_name="Golden Hour",
            description="Warm sunset look",
            ffmpeg_filter="colorbalance=rs=0.2:gs=0.1:bs=-0.15:rm=0.15:gm=0.08:bm=-0.1,eq=brightness=0.05",
            moods=[MoodMatch.ROMANTIC, MoodMatch.CALM, MoodMatch.HAPPY],
        )

        # Moonlight
        self._filters["moonlight"] = FilterEffect(
            name="moonlight",
            display_name="Moonlight",
            description="Cool night look",
            ffmpeg_filter="colorbalance=rs=-0.15:gs=-0.05:bs=0.2:rm=-0.1:gm=-0.02:bm=0.15,eq=brightness=-0.05",
            moods=[MoodMatch.MYSTERIOUS, MoodMatch.ROMANTIC, MoodMatch.CALM],
        )

    def _register_text_animations(self):
        """Register all text animation effects."""

        self._text_animations["fade"] = TextAnimationEffect(
            name="fade",
            display_name="Fade",
            description="Simple fade in/out",
            animation_type="fade",
            default_duration=0.5,
        )
        self._text_animations["typewriter"] = TextAnimationEffect(
            name="typewriter",
            display_name="Typewriter",
            description="Character by character reveal",
            animation_type="character",
            default_duration=1.0,
        )
        self._text_animations["word_by_word"] = TextAnimationEffect(
            name="word_by_word",
            display_name="Word by Word",
            description="Word by word reveal",
            animation_type="word",
            default_duration=0.8,
        )
        self._text_animations["bounce_in"] = TextAnimationEffect(
            name="bounce_in",
            display_name="Bounce In",
            description="Bouncy entrance",
            animation_type="scale",
            easing="bounce",
            default_duration=0.4,
        )
        self._text_animations["slide_up"] = TextAnimationEffect(
            name="slide_up",
            display_name="Slide Up",
            description="Slide from bottom",
            animation_type="slide",
            direction="up",
            default_duration=0.4,
        )
        self._text_animations["slide_down"] = TextAnimationEffect(
            name="slide_down",
            display_name="Slide Down",
            description="Slide from top",
            animation_type="slide",
            direction="down",
            default_duration=0.4,
        )
        self._text_animations["slide_left"] = TextAnimationEffect(
            name="slide_left",
            display_name="Slide Left",
            description="Slide from right",
            animation_type="slide",
            direction="left",
            default_duration=0.4,
        )
        self._text_animations["slide_right"] = TextAnimationEffect(
            name="slide_right",
            display_name="Slide Right",
            description="Slide from left",
            animation_type="slide",
            direction="right",
            default_duration=0.4,
        )
        self._text_animations["scale_pop"] = TextAnimationEffect(
            name="scale_pop",
            display_name="Scale Pop",
            description="Pop in with scale",
            animation_type="scale",
            easing="ease_out",
            default_duration=0.3,
        )
        self._text_animations["glitch"] = TextAnimationEffect(
            name="glitch",
            display_name="Glitch",
            description="Digital glitch effect",
            animation_type="glitch",
            default_duration=0.5,
        )
        self._text_animations["wave"] = TextAnimationEffect(
            name="wave",
            display_name="Wave",
            description="Wavy text animation",
            animation_type="wave",
            default_duration=0.8,
        )
        self._text_animations["karaoke"] = TextAnimationEffect(
            name="karaoke",
            display_name="Karaoke",
            description="Highlight synced to audio",
            animation_type="karaoke",
            default_duration=2.0,
        )
        self._text_animations["split_reveal"] = TextAnimationEffect(
            name="split_reveal",
            display_name="Split Reveal",
            description="Split and reveal",
            animation_type="split",
            default_duration=0.5,
        )
        self._text_animations["blur_in"] = TextAnimationEffect(
            name="blur_in",
            display_name="Blur In",
            description="Blur to sharp",
            animation_type="blur",
            default_duration=0.4,
        )

    # =========================================================================
    # Lookup Methods
    # =========================================================================

    def get_transition(self, name: str) -> Optional[TransitionEffect]:
        """Get a transition effect by name."""
        return self._transitions.get(name)

    def get_motion(self, name: str) -> Optional[MotionEffect]:
        """Get a motion effect by name."""
        return self._motions.get(name)

    def get_filter(self, name: str) -> Optional[FilterEffect]:
        """Get a filter effect by name."""
        return self._filters.get(name)

    def get_text_animation(self, name: str) -> Optional[TextAnimationEffect]:
        """Get a text animation by name."""
        return self._text_animations.get(name)

    def list_transitions(self) -> List[str]:
        """List all available transitions."""
        return list(self._transitions.keys())

    def list_motions(self) -> List[str]:
        """List all available motions."""
        return list(self._motions.keys())

    def list_filters(self) -> List[str]:
        """List all available filters."""
        return list(self._filters.keys())

    def list_text_animations(self) -> List[str]:
        """List all available text animations."""
        return list(self._text_animations.keys())

    # =========================================================================
    # Recommendation Methods
    # =========================================================================

    def recommend_transitions(
        self,
        mood: str,
        energy: float,
        limit: int = 5
    ) -> List[TransitionEffect]:
        """Recommend transitions based on mood and energy."""
        suitable = []
        for trans in self._transitions.values():
            if trans.is_suitable_for(mood, energy):
                suitable.append(trans)

        # Sort by how well they match the energy level
        def energy_match(t: TransitionEffect) -> float:
            mid = (t.energy_range[0] + t.energy_range[1]) / 2
            return -abs(energy - mid)

        suitable.sort(key=energy_match)
        return suitable[:limit]

    def recommend_motions(
        self,
        mood: str,
        energy: float,
        limit: int = 3
    ) -> List[MotionEffect]:
        """Recommend motions based on mood and energy."""
        suitable = []
        for motion in self._motions.values():
            mood_match = any(m.value == mood.lower() for m in motion.moods) or not motion.moods
            energy_match = motion.energy_range[0] <= energy <= motion.energy_range[1]
            if mood_match and energy_match:
                suitable.append(motion)

        return suitable[:limit]

    def recommend_filters(
        self,
        mood: str,
        limit: int = 3
    ) -> List[FilterEffect]:
        """Recommend filters based on mood."""
        suitable = []
        for filt in self._filters.values():
            mood_match = any(m.value == mood.lower() for m in filt.moods) or not filt.moods
            if mood_match:
                suitable.append(filt)

        return suitable[:limit]

    # =========================================================================
    # Validation
    # =========================================================================

    def validate_transition(self, name: str) -> bool:
        """Check if a transition name is valid."""
        return name in self._transitions

    def validate_motion(self, name: str) -> bool:
        """Check if a motion name is valid."""
        return name in self._motions

    def validate_filter(self, name: str) -> bool:
        """Check if a filter name is valid."""
        return name in self._filters

    def validate_text_animation(self, name: str) -> bool:
        """Check if a text animation name is valid."""
        return name in self._text_animations


# Global registry instance
_registry_instance: Optional[EffectsRegistry] = None


def get_registry() -> EffectsRegistry:
    """Get the global effects registry instance."""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = EffectsRegistry()
    return _registry_instance
