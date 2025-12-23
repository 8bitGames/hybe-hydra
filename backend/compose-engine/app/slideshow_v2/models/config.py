"""Configuration models for Slideshow V2."""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Literal, Optional, Tuple, Dict, Any


class AspectRatio(Enum):
    """Supported aspect ratios."""
    PORTRAIT = "9:16"      # TikTok, Reels, Shorts
    LANDSCAPE = "16:9"     # YouTube, Desktop
    SQUARE = "1:1"         # Instagram Feed
    CINEMA = "21:9"        # Cinematic widescreen


class CutStyle(Enum):
    """How cuts are synchronized to music."""
    BEAT_SYNC = "beat_sync"          # Cut on every N beats
    MEASURE_SYNC = "measure_sync"    # Cut on musical measures (4 beats)
    DROP_SYNC = "drop_sync"          # Cut on energy peaks/drops
    ONSET_SYNC = "onset_sync"        # Cut on note onsets
    EVEN = "even"                    # Even distribution (no music sync)


class TransitionTiming(Enum):
    """When transitions occur relative to beats."""
    ON_BEAT = "on_beat"
    BEFORE_BEAT = "before_beat"
    AFTER_BEAT = "after_beat"


class HookStrategy(Enum):
    """TikTok hook strategy for the first 2-3 seconds."""
    CALM_START = "calm_start"        # Quiet intro, then beat drop
    DROP_START = "drop_start"        # Start at the drop/chorus
    BUILD_UP = "build_up"            # Gradual energy build
    INSTANT_HOOK = "instant_hook"    # Immediate high energy


class MotionStyle(Enum):
    """Ken Burns and motion effect styles."""
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    PAN_LEFT = "pan_left"
    PAN_RIGHT = "pan_right"
    PAN_UP = "pan_up"
    PAN_DOWN = "pan_down"
    PARALLAX = "parallax"
    SHAKE = "shake"
    PULSE = "pulse"
    STATIC = "static"


class TextAnimation(Enum):
    """Caption animation styles."""
    FADE = "fade"
    TYPEWRITER = "typewriter"
    WORD_BY_WORD = "word_by_word"
    BOUNCE_IN = "bounce_in"
    SLIDE_UP = "slide_up"
    SLIDE_DOWN = "slide_down"
    SCALE_POP = "scale_pop"
    GLITCH = "glitch"
    WAVE = "wave"
    KARAOKE = "karaoke"  # Highlight words as they're sung


class ColorGrade(Enum):
    """Color grading presets."""
    NATURAL = "natural"
    VIBRANT = "vibrant"
    CINEMATIC = "cinematic"
    MOODY = "moody"
    BRIGHT = "bright"
    WARM = "warm"
    COOL = "cool"
    VINTAGE = "vintage"
    BW = "bw"
    NEON = "neon"
    PASTEL = "pastel"


@dataclass
class TransitionConfig:
    """Configuration for transitions."""
    # Pool of transitions to randomly select from
    pool: List[str] = field(default_factory=lambda: [
        "xfade_fade", "xfade_dissolve", "xfade_wipeleft", "xfade_slideright"
    ])
    # Duration range in seconds
    duration_range: Tuple[float, float] = (0.3, 0.8)
    # How much variety (0=same transition, 1=max variety)
    variety: float = 0.7
    # Prefer GPU-accelerated transitions
    prefer_gpu: bool = True


@dataclass
class MotionConfig:
    """Configuration for motion effects."""
    styles: List[MotionStyle] = field(default_factory=lambda: [
        MotionStyle.ZOOM_IN, MotionStyle.ZOOM_OUT
    ])
    # Intensity 0-1 (how much zoom/pan)
    intensity: float = 0.5
    # Sync motion to beats
    sync_to_beat: bool = True
    # Apply pulse effect on beats
    beat_pulse: bool = False
    beat_pulse_intensity: float = 0.05


@dataclass
class TextConfig:
    """Configuration for captions/text overlays."""
    style: str = "bold_pop"
    animation: TextAnimation = TextAnimation.FADE
    # Position: "top", "center", "bottom", or (x, y) tuple
    position: str = "bottom"
    # Font size as percentage of video height
    font_size_percent: float = 0.04
    # Sync text appearance to beats
    sync_to_beat: bool = True
    # Maximum characters per line
    max_chars_per_line: int = 20
    # Text shadow/outline
    shadow: bool = True
    outline: bool = True
    outline_color: str = "black"
    outline_width: int = 3


@dataclass
class AudioConfig:
    """Configuration for audio processing."""
    # TikTok hook strategy
    hook_strategy: HookStrategy = HookStrategy.CALM_START
    # Fade durations
    fade_in: float = 1.0
    fade_out: float = 2.0
    # Duck audio during speech/captions
    ducking: bool = False
    ducking_amount: float = 0.3
    # Auto-detect best segment if audio is longer than target
    auto_segment: bool = True


@dataclass
class EffectsConfig:
    """Configuration for visual effects."""
    color_grade: ColorGrade = ColorGrade.NATURAL
    color_grade_intensity: float = 1.0
    # Vignette
    vignette: bool = False
    vignette_intensity: float = 0.3
    # Film grain
    film_grain: bool = False
    film_grain_intensity: float = 0.03
    # Glow/bloom effect
    glow: bool = False
    glow_intensity: float = 0.2
    # Chromatic aberration
    chromatic_aberration: bool = False
    chromatic_intensity: float = 0.005
    # Beat-reactive flash
    beat_flash: bool = False
    beat_flash_intensity: float = 0.1


@dataclass
class SlideshowConfig:
    """Complete configuration for slideshow generation."""
    # Basic settings
    aspect_ratio: AspectRatio = AspectRatio.PORTRAIT
    target_duration: Optional[float] = None  # Auto-calculate if None
    fps: int = 30

    # Timing
    cut_style: CutStyle = CutStyle.BEAT_SYNC
    transition_timing: TransitionTiming = TransitionTiming.ON_BEAT
    min_image_duration: float = 2.0
    max_image_duration: float = 6.0

    # Sub-configs
    transitions: TransitionConfig = field(default_factory=TransitionConfig)
    motion: MotionConfig = field(default_factory=MotionConfig)
    text: TextConfig = field(default_factory=TextConfig)
    audio: AudioConfig = field(default_factory=AudioConfig)
    effects: EffectsConfig = field(default_factory=EffectsConfig)

    # Rendering
    use_gpu: bool = True
    quality: Literal["draft", "normal", "high"] = "normal"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        import dataclasses
        return dataclasses.asdict(self)


class StylePreset(Enum):
    """Pre-defined style presets for common use cases."""

    KPOP_ENERGETIC = "kpop_energetic"
    KPOP_EMOTIONAL = "kpop_emotional"
    CINEMATIC = "cinematic"
    VIRAL_TIKTOK = "viral_tiktok"
    MINIMAL_CLEAN = "minimal_clean"
    RETRO_VHS = "retro_vhs"
    DREAMY_SOFT = "dreamy_soft"
    DYNAMIC_HYPE = "dynamic_hype"
    DOCUMENTARY = "documentary"
    CUSTOM = "custom"


# Pre-defined preset configurations
PRESET_CONFIGS: Dict[StylePreset, SlideshowConfig] = {
    StylePreset.KPOP_ENERGETIC: SlideshowConfig(
        cut_style=CutStyle.BEAT_SYNC,
        transitions=TransitionConfig(
            pool=[
                "xfade_fade", "xfade_slideleft", "xfade_slideright",
                "xfade_zoomin", "xfade_wipeleft", "xfade_wiperight",
                "xfade_smoothleft", "xfade_smoothright"
            ],
            duration_range=(0.2, 0.5),
            variety=0.8,
        ),
        motion=MotionConfig(
            styles=[MotionStyle.ZOOM_IN, MotionStyle.ZOOM_OUT],
            intensity=0.7,
            sync_to_beat=True,
            beat_pulse=True,
            beat_pulse_intensity=0.03,
        ),
        text=TextConfig(
            animation=TextAnimation.BOUNCE_IN,
            sync_to_beat=True,
        ),
        audio=AudioConfig(
            hook_strategy=HookStrategy.CALM_START,
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.VIBRANT,
            beat_flash=True,
            beat_flash_intensity=0.08,
        ),
    ),

    StylePreset.KPOP_EMOTIONAL: SlideshowConfig(
        cut_style=CutStyle.MEASURE_SYNC,
        transitions=TransitionConfig(
            pool=[
                "xfade_fade", "xfade_dissolve", "xfade_fadeblack",
                "xfade_fadewhite"
            ],
            duration_range=(0.5, 1.0),
            variety=0.4,
        ),
        motion=MotionConfig(
            styles=[MotionStyle.ZOOM_IN, MotionStyle.PAN_LEFT, MotionStyle.PAN_RIGHT],
            intensity=0.3,
            sync_to_beat=False,
        ),
        text=TextConfig(
            animation=TextAnimation.FADE,
            sync_to_beat=False,
        ),
        audio=AudioConfig(
            hook_strategy=HookStrategy.BUILD_UP,
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.CINEMATIC,
            vignette=True,
            vignette_intensity=0.2,
        ),
    ),

    StylePreset.CINEMATIC: SlideshowConfig(
        cut_style=CutStyle.MEASURE_SYNC,
        min_image_duration=3.0,
        max_image_duration=8.0,
        transitions=TransitionConfig(
            pool=[
                "xfade_fade", "xfade_dissolve", "xfade_fadeblack",
            ],
            duration_range=(0.8, 1.5),
            variety=0.3,
        ),
        motion=MotionConfig(
            styles=[MotionStyle.ZOOM_IN, MotionStyle.PAN_LEFT],
            intensity=0.25,
            sync_to_beat=False,
        ),
        text=TextConfig(
            animation=TextAnimation.FADE,
            font_size_percent=0.035,
            position="bottom",
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.CINEMATIC,
            color_grade_intensity=0.8,
            vignette=True,
            vignette_intensity=0.25,
            film_grain=False,
            film_grain_intensity=0.0,
        ),
    ),

    StylePreset.VIRAL_TIKTOK: SlideshowConfig(
        cut_style=CutStyle.DROP_SYNC,
        min_image_duration=1.5,
        max_image_duration=4.0,
        transitions=TransitionConfig(
            pool=[
                "xfade_zoomin", "xfade_pixelize", "xfade_slideleft",
                "xfade_slideright", "xfade_wipeleft", "xfade_circleopen",
                "xfade_radial"
            ],
            duration_range=(0.15, 0.4),
            variety=1.0,
        ),
        motion=MotionConfig(
            styles=[MotionStyle.ZOOM_IN, MotionStyle.ZOOM_OUT, MotionStyle.SHAKE],
            intensity=0.9,
            sync_to_beat=True,
            beat_pulse=True,
            beat_pulse_intensity=0.05,
        ),
        text=TextConfig(
            animation=TextAnimation.TYPEWRITER,
            sync_to_beat=True,
            font_size_percent=0.05,
        ),
        audio=AudioConfig(
            hook_strategy=HookStrategy.DROP_START,
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.BRIGHT,
            beat_flash=True,
            beat_flash_intensity=0.12,
        ),
    ),

    StylePreset.MINIMAL_CLEAN: SlideshowConfig(
        cut_style=CutStyle.EVEN,
        transitions=TransitionConfig(
            pool=["xfade_fade"],
            duration_range=(0.5, 0.8),
            variety=0.0,
        ),
        motion=MotionConfig(
            styles=[MotionStyle.STATIC],
            intensity=0.0,
        ),
        text=TextConfig(
            animation=TextAnimation.FADE,
            font_size_percent=0.03,
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.NATURAL,
        ),
    ),

    StylePreset.RETRO_VHS: SlideshowConfig(
        cut_style=CutStyle.BEAT_SYNC,
        transitions=TransitionConfig(
            pool=[
                "xfade_fade", "xfade_pixelize", "xfade_hlslice",
                "xfade_hrslice"
            ],
            duration_range=(0.2, 0.5),
            variety=0.6,
        ),
        motion=MotionConfig(
            styles=[MotionStyle.ZOOM_IN, MotionStyle.SHAKE],
            intensity=0.5,
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.VINTAGE,
            film_grain=False,
            film_grain_intensity=0.0,
            chromatic_aberration=True,
            chromatic_intensity=0.01,
        ),
    ),

    StylePreset.DREAMY_SOFT: SlideshowConfig(
        cut_style=CutStyle.MEASURE_SYNC,
        transitions=TransitionConfig(
            pool=[
                "xfade_fade", "xfade_dissolve", "xfade_fadewhite",
            ],
            duration_range=(1.0, 2.0),
            variety=0.3,
        ),
        motion=MotionConfig(
            styles=[MotionStyle.ZOOM_IN],
            intensity=0.2,
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.PASTEL,
            glow=True,
            glow_intensity=0.3,
            vignette=True,
            vignette_intensity=0.15,
        ),
    ),

    StylePreset.DYNAMIC_HYPE: SlideshowConfig(
        cut_style=CutStyle.ONSET_SYNC,
        min_image_duration=1.0,
        max_image_duration=3.0,
        transitions=TransitionConfig(
            pool=[
                "xfade_zoomin", "xfade_slideleft", "xfade_slideright",
                "xfade_slideup", "xfade_slidedown", "xfade_radial",
                "xfade_circleopen", "xfade_pixelize"  # rectcrop removed (causes visual corruption)
            ],
            duration_range=(0.1, 0.3),
            variety=1.0,
        ),
        motion=MotionConfig(
            styles=[
                MotionStyle.ZOOM_IN, MotionStyle.ZOOM_OUT,
                MotionStyle.SHAKE, MotionStyle.PULSE
            ],
            intensity=1.0,
            sync_to_beat=True,
            beat_pulse=True,
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.NEON,
            beat_flash=True,
            beat_flash_intensity=0.15,
            chromatic_aberration=True,
        ),
    ),

    StylePreset.DOCUMENTARY: SlideshowConfig(
        cut_style=CutStyle.EVEN,
        min_image_duration=4.0,
        max_image_duration=10.0,
        transitions=TransitionConfig(
            pool=["xfade_fade", "xfade_dissolve"],
            duration_range=(1.0, 1.5),
            variety=0.2,
        ),
        motion=MotionConfig(
            styles=[MotionStyle.ZOOM_IN, MotionStyle.PAN_LEFT, MotionStyle.PAN_RIGHT],
            intensity=0.15,
        ),
        text=TextConfig(
            animation=TextAnimation.FADE,
            position="bottom",
            font_size_percent=0.03,
        ),
        effects=EffectsConfig(
            color_grade=ColorGrade.NATURAL,
        ),
    ),
}


def get_preset_config(preset: StylePreset) -> SlideshowConfig:
    """Get configuration for a preset."""
    if preset == StylePreset.CUSTOM:
        return SlideshowConfig()
    return PRESET_CONFIGS.get(preset, SlideshowConfig())
