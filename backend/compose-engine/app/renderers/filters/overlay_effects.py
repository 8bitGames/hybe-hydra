"""Overlay effects via FFmpeg filters.

Replaces MoviePy's video.image_transform() per-frame processing with
native FFmpeg filters. Not all effects have perfect FFmpeg equivalents,
but these approximations are much faster.
"""

from typing import Optional, List, Dict, Callable


def build_vignette_filter(strength: float = 0.3) -> str:
    """Build FFmpeg vignette filter.

    Creates a darkened edge effect like vintage camera lenses.

    Args:
        strength: Vignette strength 0.0-1.0 (higher = darker edges)

    Returns:
        FFmpeg filter string
    """
    # FFmpeg vignette angle: lower = more vignette
    # Map strength 0.0-1.0 to angle PI/4 (0.785) to PI/8 (0.393)
    angle = 0.785 - (strength * 0.4)
    return f"vignette=a={angle:.3f}"


def build_film_grain_filter(intensity: float = 0.05) -> str:
    """Build FFmpeg noise filter for film grain effect.

    Adds subtle noise to simulate film stock.

    Args:
        intensity: Grain intensity 0.0-0.2 (higher = more grain)

    Returns:
        FFmpeg filter string
    """
    # Map intensity to FFmpeg noise strength (0-50 is reasonable range)
    strength = int(intensity * 250)  # 0.05 -> 12, 0.1 -> 25, 0.2 -> 50
    strength = min(50, max(1, strength))
    return f"noise=alls={strength}:allf=t"


def build_blur_filter(strength: float = 0.3) -> str:
    """Build FFmpeg blur filter for soft focus effect.

    Args:
        strength: Blur strength 0.0-1.0

    Returns:
        FFmpeg filter string
    """
    # Map to box blur radius (1-10)
    radius = int(strength * 10) + 1
    return f"boxblur={radius}:{radius}"


def build_sharpen_filter(strength: float = 0.5) -> str:
    """Build FFmpeg unsharp mask filter for sharpening.

    Args:
        strength: Sharpen strength 0.0-1.0

    Returns:
        FFmpeg filter string
    """
    amount = 0.5 + (strength * 1.5)  # 0.5-2.0 range
    return f"unsharp=5:5:{amount:.1f}:5:5:0"


def build_glow_filter(intensity: float = 0.3) -> str:
    """Build FFmpeg glow/bloom approximation.

    Note: True bloom requires complex multi-pass processing.
    This is a simpler approximation using unsharp mask.

    Args:
        intensity: Glow intensity 0.0-1.0

    Returns:
        FFmpeg filter string
    """
    # Negative unsharp creates glow effect
    amount = -0.5 - (intensity * 1.0)
    return f"unsharp=9:9:{amount:.1f}:9:9:0"


def build_color_tint_filter(color: str, intensity: float = 0.3) -> str:
    """Build color tint overlay filter.

    Args:
        color: Tint color (warm, cool, purple, teal, golden)
        intensity: Tint intensity 0.0-1.0

    Returns:
        FFmpeg filter string
    """
    # Color tint via colorbalance
    tints = {
        "warm": f"colorbalance=rs={intensity*0.3}:gs={intensity*0.1}:bs={-intensity*0.2}",
        "cool": f"colorbalance=rs={-intensity*0.2}:bs={intensity*0.3}",
        "purple": f"colorbalance=rs={intensity*0.2}:bs={intensity*0.3}",
        "teal": f"colorbalance=gs={intensity*0.2}:bs={intensity*0.2}",
        "golden": f"colorbalance=rs={intensity*0.3}:gs={intensity*0.2}",
    }
    return tints.get(color, tints["warm"])


def build_chromatic_aberration_filter(intensity: float = 0.3) -> str:
    """Build chromatic aberration (RGB split) approximation.

    Note: True chromatic aberration is complex. This creates a simplified
    color fringing effect.

    Args:
        intensity: Effect intensity 0.0-1.0

    Returns:
        FFmpeg filter string
    """
    # Shift amount in pixels
    shift = int(intensity * 5) + 1

    # Split channels and offset them
    # This is a simplified version - full implementation would need complex filter_complex
    return f"rgbashift=rh={shift}:bh={-shift}"


def build_haze_filter(color: str = "white", intensity: float = 0.2) -> str:
    """Build atmospheric haze/fog effect.

    Args:
        color: Haze color (white, warm, cool)
        intensity: Haze intensity 0.0-1.0

    Returns:
        FFmpeg filter string
    """
    # Haze is essentially a blend with a solid color
    # We approximate by lifting blacks and adding tint
    brightness = intensity * 0.15
    contrast = 1.0 - (intensity * 0.2)

    base = f"eq=brightness={brightness:.2f}:contrast={contrast:.2f}"

    if color == "warm":
        return f"{base},colorbalance=rs=0.05:bs=-0.05"
    elif color == "cool":
        return f"{base},colorbalance=bs=0.05:rs=-0.03"
    else:  # white
        return base


# =============================================================================
# Overlay Effect Registry
# =============================================================================

# Map effect IDs to filter builder functions
# These match the effects defined in filters.py and effects_catalog.json
FFMPEG_OVERLAY_EFFECTS: Dict[str, Callable[[float], str]] = {
    # Vignette
    "vignette": lambda i=0.3: build_vignette_filter(i),
    "vignette_strong": lambda i=0.5: build_vignette_filter(i),

    # Film Grain
    "film_grain": lambda i=0.05: build_film_grain_filter(i),
    "film_grain_heavy": lambda i=0.1: build_film_grain_filter(i),

    # Bloom/Glow
    "bloom": lambda i=0.3: build_glow_filter(i),
    "bloom_strong": lambda i=0.5: build_glow_filter(i),

    # Soft Focus
    "soft_focus": lambda i=0.2: build_blur_filter(i),
    "soft_focus_strong": lambda i=0.4: build_blur_filter(i),

    # Color Wash
    "color_wash_warm": lambda i=0.3: build_color_tint_filter("warm", i),
    "color_wash_cool": lambda i=0.3: build_color_tint_filter("cool", i),
    "color_wash_purple": lambda i=0.3: build_color_tint_filter("purple", i),
    "color_wash_teal": lambda i=0.3: build_color_tint_filter("teal", i),
    "color_wash_golden": lambda i=0.3: build_color_tint_filter("golden", i),

    # Haze
    "haze_white": lambda i=0.2: build_haze_filter("white", i),
    "haze_warm": lambda i=0.2: build_haze_filter("warm", i),
    "haze_cool": lambda i=0.2: build_haze_filter("cool", i),

    # Chromatic Aberration
    "chromatic_horizontal": lambda i=0.3: build_chromatic_aberration_filter(i),
    "chromatic_radial": lambda i=0.3: build_chromatic_aberration_filter(i),

    # Sharpen
    "sharpen": lambda i=0.5: build_sharpen_filter(i),
    "sharpen_strong": lambda i=0.8: build_sharpen_filter(i),
}

# Effects that require complex processing not available in basic FFmpeg filters
# These will be skipped in the FFmpeg pipeline (or use simplified approximations)
COMPLEX_EFFECTS_SKIP = {
    # Light leaks need pre-rendered overlays
    "light_leak_warm",
    "light_leak_cool",
    "light_leak_rainbow",
    "light_leak_golden",

    # Bokeh needs per-frame particle rendering
    "bokeh_small",
    "bokeh_medium",
    "bokeh_large",

    # Lens flare needs radial pattern generation
    "lens_flare_top",
    "lens_flare_center",

    # Dust particles need animated particles
    "dust_particles_sparse",
    "dust_particles_medium",
    "dust_particles_dense",

    # Sun rays need radial ray generation
    "sun_rays_top",
    "sun_rays_left",
    "sun_rays_right",

    # Sparkles need animated star shapes
    "sparkle_sparse",
    "sparkle_medium",
    "sparkle_dense",

    # Anamorphic needs horizontal streak
    "anamorphic_center",
    "anamorphic_top",
    "anamorphic_bottom",

    # Prism needs rainbow dispersion
    "prism_edge",
    "prism_diagonal",
    "prism_corner",

    # Light streak needs directional glow
    "light_streak_diagonal",
    "light_streak_horizontal",
    "light_streak_vertical",
}


def build_overlay_filter(effect_id: str, intensity: float = 0.3) -> Optional[str]:
    """Get FFmpeg filter for an overlay effect.

    Args:
        effect_id: Effect identifier
        intensity: Effect intensity 0.0-1.0

    Returns:
        FFmpeg filter string, or None if effect not supported
    """
    if effect_id in COMPLEX_EFFECTS_SKIP:
        return None

    builder = FFMPEG_OVERLAY_EFFECTS.get(effect_id)
    if builder:
        return builder(intensity)

    return None


def build_overlay_chain(
    effect_ids: List[str],
    intensities: Optional[Dict[str, float]] = None,
) -> str:
    """Build a chain of overlay effect filters.

    Args:
        effect_ids: List of effect identifiers to apply
        intensities: Optional dict mapping effect_id to intensity

    Returns:
        Combined FFmpeg filter chain string
    """
    if intensities is None:
        intensities = {}

    filters = []
    for effect_id in effect_ids:
        intensity = intensities.get(effect_id, 0.3)
        filter_str = build_overlay_filter(effect_id, intensity)
        if filter_str:
            filters.append(filter_str)

    return ",".join(filters)


# =============================================================================
# Pre-rendered Overlay Support
# =============================================================================

def build_overlay_blend_filter(
    overlay_path: str,
    blend_mode: str = "screen",
    opacity: float = 0.5,
) -> str:
    """Build filter to blend a pre-rendered overlay image/video.

    For complex effects (light leaks, dust, etc.), pre-rendered overlays
    can be blended using this filter in a filter_complex graph.

    Args:
        overlay_path: Path to overlay image/video
        blend_mode: Blend mode (screen, multiply, overlay, addition)
        opacity: Overlay opacity 0.0-1.0

    Returns:
        FFmpeg filter string for use in filter_complex

    Note: This requires a filter_complex setup like:
        [0:v][1:v]blend=all_mode=screen:all_opacity=0.5[out]
    """
    return f"blend=all_mode={blend_mode}:all_opacity={opacity}"


# Common effect combinations for different moods
MOOD_OVERLAY_PRESETS = {
    "energetic": ["film_grain", "sharpen"],
    "dreamy": ["soft_focus", "bloom", "haze_warm"],
    "vintage": ["vignette", "film_grain_heavy", "color_wash_warm"],
    "cinematic": ["vignette", "film_grain"],
    "clean": [],  # No overlays
    "moody": ["vignette_strong", "haze_cool"],
}


def get_overlays_for_mood(mood: str) -> List[str]:
    """Get appropriate overlay effects for a mood.

    Args:
        mood: Mood string

    Returns:
        List of overlay effect IDs
    """
    return MOOD_OVERLAY_PRESETS.get(mood.lower(), [])
