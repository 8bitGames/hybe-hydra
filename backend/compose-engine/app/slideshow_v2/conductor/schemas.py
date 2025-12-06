"""
Structured output schemas for AI Conductor decisions.

These schemas define exactly what the AI can output,
ensuring deterministic and executable composition plans.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Literal
from enum import Enum


# =============================================================================
# Available Options (AI must choose from these)
# =============================================================================

AVAILABLE_TRANSITIONS = [
    # GL Transitions (OpenGL shader-based, high-quality)
    # Basic
    "gl_fade",
    "gl_fadecolor",
    "gl_fadegrayscale",
    # Wipe
    "gl_wipeleft",
    "gl_wiperight",
    "gl_wipeup",
    "gl_wipedown",
    "gl_directionalwipe",
    # Slide
    "gl_slideright",
    "gl_slideleft",
    "gl_slideup",
    "gl_slidedown",
    # Circle
    "gl_circle",
    "gl_circleopen",
    "gl_circleclose",
    # Zoom
    "gl_zoomin",
    "gl_zoomout",
    "gl_crosszoom",
    "gl_zoomincircles",
    # Rotation
    "gl_swirl",
    "gl_pinwheel",
    "gl_radial",
    "gl_rotate_scale_fade",
    "gl_kaleidoscope",
    # 3D / Cube
    "gl_cube",
    "gl_pagecurl",
    "gl_doorway",
    # Pixel / Mosaic
    "gl_pixelize",
    "gl_mosaic",
    "gl_randomsquares",
    "gl_hexagonalize",
    # Distortion
    "gl_crosswarp",
    "gl_dreamy",
    "gl_dreamy_zoom",
    "gl_ripple",
    "gl_morph",
    "gl_squeeze",
    "gl_waterdrop",
    # Glitch
    "gl_glitchdisplace",
    "gl_glitchmemories",
    # Shape
    "gl_heart",
    "gl_bowtiehorizontal",
    "gl_bowtievertical",
    "gl_windowblinds",
    # Special Effects
    "gl_burn",
    "gl_filmburn",
    "gl_tvstatic",
    "gl_colorphase",
    "gl_luminance_melt",
    # Advanced
    "gl_displacement",
    "gl_perlin",
    "gl_wind",
    "gl_polkadotscurtain",
    "gl_bounce",
    "gl_angular",
    "gl_directional_scaled",
    "gl_stereo_viewer",
]

AVAILABLE_MOTIONS = [
    "zoom_in",           # Gentle zoom in (Ken Burns)
    "zoom_out",          # Gentle zoom out
    "zoom_in_fast",      # Faster zoom in
    "zoom_out_fast",     # Faster zoom out
    "pan_left",          # Pan from right to left
    "pan_right",         # Pan from left to right
    "pan_up",            # Pan from bottom to top
    "pan_down",          # Pan from top to bottom
    "pan_diagonal_tl",   # Diagonal pan to top-left
    "pan_diagonal_tr",   # Diagonal pan to top-right
    "pan_diagonal_bl",   # Diagonal pan to bottom-left
    "pan_diagonal_br",   # Diagonal pan to bottom-right
    "parallax",          # Parallax depth effect
    "shake",             # Camera shake (energetic)
    "pulse",             # Beat-synced pulse/zoom
    "drift",             # Slow random drift
    "static",            # No motion
]

AVAILABLE_TEXT_ANIMATIONS = [
    "fade",              # Simple fade in/out
    "typewriter",        # Character by character
    "word_by_word",      # Word by word reveal
    "bounce_in",         # Bouncy entrance
    "slide_up",          # Slide from bottom
    "slide_down",        # Slide from top
    "slide_left",        # Slide from right
    "slide_right",       # Slide from left
    "scale_pop",         # Pop in with scale
    "glitch",            # Glitch effect
    "wave",              # Wavy text animation
    "karaoke",           # Highlight synced to audio
    "split_reveal",      # Split and reveal
    "blur_in",           # Blur to sharp
]

AVAILABLE_COLOR_GRADES = [
    "natural",           # No grading
    "vibrant",           # Saturated, punchy
    "cinematic",         # Orange/teal film look
    "moody",             # Dark, desaturated
    "bright",            # High key, airy
    "warm",              # Warm orange tones
    "cool",              # Cool blue tones
    "vintage",           # Faded retro look
    "bw",                # Black and white
    "neon",              # High contrast neon
    "pastel",            # Soft pastel colors
    "dramatic",          # High contrast dramatic
    "golden_hour",       # Warm sunset look
    "moonlight",         # Cool night look
]

AVAILABLE_EFFECTS = [
    "none",              # No additional effect
    "vignette",          # Dark corners
    "film_grain",        # Film grain texture
    "glow",              # Soft glow/bloom
    "chromatic",         # Chromatic aberration
    "vhs",               # VHS retro effect
    "glitch",            # Digital glitch
    "blur_edges",        # Soft edge blur
    "lens_flare",        # Light flare
    "dust",              # Dust particles
    "light_leak",        # Film light leak
    "scan_lines",        # CRT scan lines
]


# =============================================================================
# Composition Plan Schemas
# =============================================================================

@dataclass
class SegmentPlan:
    """AI's plan for a single image segment."""
    image_index: int
    duration: float                              # How long to show (seconds)
    motion: str                                  # From AVAILABLE_MOTIONS
    motion_intensity: float                      # 0.0 to 1.0
    effects: List[str] = field(default_factory=list)  # From AVAILABLE_EFFECTS
    reasoning: str = ""                          # AI's reasoning for choices


@dataclass
class TransitionPlan:
    """AI's plan for transition between segments."""
    from_segment: int
    to_segment: int
    transition: str                              # From AVAILABLE_TRANSITIONS
    duration: float                              # Transition duration (0.2-1.5s)
    sync_to_beat: bool = True                    # Align to nearest beat
    reasoning: str = ""


@dataclass
class CaptionPlan:
    """AI's plan for a single caption."""
    text: str
    segment_index: int                           # Which segment to show on
    position_in_segment: float                   # 0.0-1.0 (when in segment)
    duration: float                              # How long to show
    animation: str                               # From AVAILABLE_TEXT_ANIMATIONS
    style: Literal["bold", "minimal", "dramatic", "playful"] = "bold"
    sync_to_beat: bool = True
    reasoning: str = ""


@dataclass
class EffectsPlan:
    """AI's plan for global video effects."""
    color_grade: str                             # From AVAILABLE_COLOR_GRADES
    color_intensity: float = 1.0                 # 0.0-1.0
    vignette: bool = False
    vignette_intensity: float = 0.3
    film_grain: bool = False
    film_grain_intensity: float = 0.03
    beat_flash: bool = False                     # Flash on beats
    beat_flash_intensity: float = 0.1
    reasoning: str = ""


@dataclass
class AudioPlan:
    """AI's plan for audio treatment."""
    start_time: float = 0.0                      # Where to start in audio
    fade_in: float = 1.0
    fade_out: float = 2.0
    hook_strategy: Literal["calm_start", "drop_start", "build_up"] = "calm_start"
    duck_during_captions: bool = False
    reasoning: str = ""


@dataclass
class CompositionPlan:
    """Complete AI-generated composition plan."""
    # Metadata
    title: str = ""
    mood: str = ""                               # Overall mood description
    energy_level: Literal["low", "medium", "high", "dynamic"] = "medium"
    style_description: str = ""                  # AI's style description

    # Timing
    total_duration: float = 15.0
    fps: int = 30

    # Content plans
    segments: List[SegmentPlan] = field(default_factory=list)
    transitions: List[TransitionPlan] = field(default_factory=list)
    captions: List[CaptionPlan] = field(default_factory=list)

    # Global settings
    effects: EffectsPlan = field(default_factory=EffectsPlan)
    audio: AudioPlan = field(default_factory=AudioPlan)

    # AI reasoning
    overall_reasoning: str = ""
    creative_notes: str = ""

    def validate(self) -> List[str]:
        """Validate the composition plan."""
        errors = []

        # Check segments
        for i, seg in enumerate(self.segments):
            if seg.motion not in AVAILABLE_MOTIONS:
                errors.append(f"Segment {i}: Invalid motion '{seg.motion}'")
            if seg.duration < 0.5:
                errors.append(f"Segment {i}: Duration too short ({seg.duration}s)")
            for effect in seg.effects:
                if effect not in AVAILABLE_EFFECTS:
                    errors.append(f"Segment {i}: Invalid effect '{effect}'")

        # Check transitions
        for i, trans in enumerate(self.transitions):
            if trans.transition not in AVAILABLE_TRANSITIONS:
                errors.append(f"Transition {i}: Invalid transition '{trans.transition}'")
            if trans.duration < 0.1 or trans.duration > 2.0:
                errors.append(f"Transition {i}: Invalid duration ({trans.duration}s)")

        # Check captions
        for i, cap in enumerate(self.captions):
            if cap.animation not in AVAILABLE_TEXT_ANIMATIONS:
                errors.append(f"Caption {i}: Invalid animation '{cap.animation}'")

        # Check effects
        if self.effects.color_grade not in AVAILABLE_COLOR_GRADES:
            errors.append(f"Invalid color grade '{self.effects.color_grade}'")

        return errors

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        import dataclasses
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CompositionPlan":
        """Create from dictionary."""
        return cls(
            title=data.get("title", ""),
            mood=data.get("mood", ""),
            energy_level=data.get("energy_level", "medium"),
            style_description=data.get("style_description", ""),
            total_duration=data.get("total_duration", 15.0),
            fps=data.get("fps", 30),
            segments=[SegmentPlan(**s) for s in data.get("segments", [])],
            transitions=[TransitionPlan(**t) for t in data.get("transitions", [])],
            captions=[CaptionPlan(**c) for c in data.get("captions", [])],
            effects=EffectsPlan(**data.get("effects", {})),
            audio=AudioPlan(**data.get("audio", {})),
            overall_reasoning=data.get("overall_reasoning", ""),
            creative_notes=data.get("creative_notes", ""),
        )


# =============================================================================
# Input Context for AI Conductor
# =============================================================================

@dataclass
class ImageContext:
    """Context about a single image for the AI."""
    index: int
    description: str = ""                        # AI-generated description
    dominant_colors: List[str] = field(default_factory=list)
    mood: str = ""
    has_person: bool = False
    has_text: bool = False
    brightness: float = 0.5                      # 0=dark, 1=bright
    complexity: float = 0.5                      # 0=simple, 1=complex


@dataclass
class LyricsContext:
    """Context about lyrics/script."""
    lines: List[str] = field(default_factory=list)
    language: str = "en"
    mood: str = ""
    themes: List[str] = field(default_factory=list)
    emotional_arc: str = ""                      # e.g., "builds from sad to hopeful"


@dataclass
class AudioContext:
    """Context about the audio for the AI."""
    duration: float
    bpm: float
    beat_times: List[float] = field(default_factory=list)
    energy_curve: List[float] = field(default_factory=list)  # Simplified
    mood: str = ""
    genre: str = ""
    has_drops: bool = False
    drop_times: List[float] = field(default_factory=list)
    suggested_start: float = 0.0


@dataclass
class ConductorInput:
    """Complete input context for the AI Conductor."""
    # Content
    images: List[ImageContext] = field(default_factory=list)
    lyrics: Optional[LyricsContext] = None
    audio: Optional[AudioContext] = None

    # User preferences
    target_duration: float = 15.0
    aspect_ratio: str = "9:16"
    style_hint: str = ""                         # e.g., "energetic K-pop", "emotional ballad"

    # Constraints
    min_image_duration: float = 2.0
    max_image_duration: float = 6.0

    def to_prompt_context(self) -> str:
        """Convert to text context for AI prompt."""
        parts = []

        # Images
        parts.append(f"## Images ({len(self.images)} total)")
        for img in self.images:
            parts.append(f"- Image {img.index}: {img.description or 'No description'}")
            if img.mood:
                parts.append(f"  Mood: {img.mood}")

        # Lyrics
        if self.lyrics and self.lyrics.lines:
            parts.append(f"\n## Lyrics ({len(self.lyrics.lines)} lines)")
            for i, line in enumerate(self.lyrics.lines):
                parts.append(f"- Line {i+1}: \"{line}\"")
            if self.lyrics.mood:
                parts.append(f"Overall mood: {self.lyrics.mood}")

        # Audio
        if self.audio:
            parts.append(f"\n## Audio Analysis")
            parts.append(f"- Duration: {self.audio.duration:.1f}s")
            parts.append(f"- BPM: {self.audio.bpm:.0f}")
            parts.append(f"- Genre: {self.audio.genre}")
            parts.append(f"- Mood: {self.audio.mood}")
            if self.audio.has_drops:
                parts.append(f"- Has energy drops at: {self.audio.drop_times}")

        # Preferences
        parts.append(f"\n## Requirements")
        parts.append(f"- Target duration: {self.target_duration}s")
        parts.append(f"- Aspect ratio: {self.aspect_ratio}")
        if self.style_hint:
            parts.append(f"- Style: {self.style_hint}")

        return "\n".join(parts)
