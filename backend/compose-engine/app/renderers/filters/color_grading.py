"""Color grading via FFmpeg filters.

Replaces MoviePy's video.image_transform() per-frame processing with
native FFmpeg filters for significant speedup.
"""

from typing import Optional, List


# Color grading presets mapped to FFmpeg filter chains
# These match the grades defined in filters.py and xfade_renderer.py
FFMPEG_COLOR_GRADES = {
    # vibrant: +30% saturation for punchy, colorful look
    "vibrant": "eq=saturation=1.3",

    # cinematic: Orange/teal color grading (Hollywood look)
    # - Blue in shadows (rs=-0.05, bs=0.05)
    # - Orange in highlights (rm=-0.03, bm=0.03)
    # - Slightly desaturated (0.9)
    # - Higher contrast (1.1)
    "cinematic": "colorbalance=rs=-0.05:bs=0.05:rm=-0.03:bm=0.03,eq=saturation=0.9:contrast=1.1",

    # bright: +10% brightness with gamma boost for airy feel
    "bright": "eq=brightness=0.1:gamma=1.1",

    # moody: Dark, desaturated with blue tint
    # - Blue tint in shadows and mids
    # - Low saturation (0.7)
    # - Higher contrast (1.15)
    # - Slightly darker (-0.1 brightness)
    "moody": "colorbalance=bs=0.1:bm=0.05,eq=saturation=0.7:contrast=1.15:brightness=-0.1",

    # bw: Black and white conversion using proper luminance weights
    # Formula: 0.3R + 0.4G + 0.3B (similar to BT.601)
    "bw": "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3",

    # warm: Warmer color temperature (sunrise/sunset feel)
    "warm": "colortemperature=temperature=7000,eq=saturation=1.1",

    # cool: Cooler color temperature (winter/night feel)
    "cool": "colortemperature=temperature=4000,eq=saturation=0.95",

    # vintage: Faded retro look with warm tint
    "vintage": "colorbalance=rs=0.1:gs=0.05,eq=saturation=0.8:contrast=0.9:gamma=1.1",

    # sepia: Classic sepia tone
    "sepia": "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131",

    # natural: No processing
    "natural": None,
}


def build_color_grade_filter(grade: str) -> Optional[str]:
    """Get FFmpeg filter string for a color grade preset.

    Args:
        grade: Color grade name (vibrant, cinematic, bright, moody, bw, natural)

    Returns:
        FFmpeg filter string, or None for "natural" (no processing)
    """
    return FFMPEG_COLOR_GRADES.get(grade)


def build_custom_color_grade(
    saturation: float = 1.0,
    contrast: float = 1.0,
    brightness: float = 0.0,
    gamma: float = 1.0,
    shadows_blue: float = 0.0,
    highlights_orange: float = 0.0,
) -> str:
    """Build a custom color grade filter from parameters.

    Args:
        saturation: Saturation multiplier (1.0 = normal, 1.3 = +30%)
        contrast: Contrast multiplier (1.0 = normal)
        brightness: Brightness offset (-1.0 to 1.0)
        gamma: Gamma value (1.0 = normal)
        shadows_blue: Blue shift in shadows (-1.0 to 1.0)
        highlights_orange: Orange shift in highlights (-1.0 to 1.0)

    Returns:
        FFmpeg filter string
    """
    filters = []

    # Color balance for shadows/highlights tinting
    if shadows_blue != 0 or highlights_orange != 0:
        balance_parts = []
        if shadows_blue != 0:
            balance_parts.append(f"bs={shadows_blue}")
        if highlights_orange != 0:
            # Orange = red + a bit of green - blue
            balance_parts.append(f"rh={highlights_orange * 0.5}")
            balance_parts.append(f"bh={-highlights_orange * 0.3}")
        filters.append(f"colorbalance={':'.join(balance_parts)}")

    # EQ filter for saturation, contrast, brightness, gamma
    eq_parts = []
    if saturation != 1.0:
        eq_parts.append(f"saturation={saturation}")
    if contrast != 1.0:
        eq_parts.append(f"contrast={contrast}")
    if brightness != 0:
        eq_parts.append(f"brightness={brightness}")
    if gamma != 1.0:
        eq_parts.append(f"gamma={gamma}")

    if eq_parts:
        filters.append(f"eq={':'.join(eq_parts)}")

    return ",".join(filters) if filters else ""


def build_lut_filter(lut_path: str) -> str:
    """Build filter to apply a 3D LUT file.

    LUT files provide precise color grading control used by professionals.

    Args:
        lut_path: Path to .cube or .3dl LUT file

    Returns:
        FFmpeg filter string
    """
    return f"lut3d='{lut_path}'"


def combine_filters(filters: List[Optional[str]]) -> str:
    """Combine multiple filter strings, removing None values.

    Args:
        filters: List of filter strings (may contain None)

    Returns:
        Combined filter string with comma separation
    """
    valid_filters = [f for f in filters if f]
    return ",".join(valid_filters)


# Common color grade combinations for different moods/genres
MOOD_COLOR_GRADES = {
    # K-Pop / Dance - vibrant, high energy
    "kpop": "vibrant",
    "dance": "vibrant",
    "exciting": "vibrant",

    # Emotional / Ballad - cinematic, dramatic
    "emotional": "cinematic",
    "ballad": "cinematic",
    "dramatic": "cinematic",

    # Chill / Lo-fi - moody, muted
    "chill": "moody",
    "lofi": "moody",
    "ambient": "moody",

    # Summer / Happy - bright, airy
    "summer": "bright",
    "happy": "bright",
    "upbeat": "bright",

    # Retro / Vintage - warm vintage
    "retro": "vintage",
    "nostalgia": "vintage",

    # Default - natural
    "default": "natural",
    "neutral": "natural",
}


def get_grade_for_mood(mood: str) -> str:
    """Get appropriate color grade for a mood/vibe.

    Args:
        mood: Mood or vibe string

    Returns:
        Color grade name
    """
    return MOOD_COLOR_GRADES.get(mood.lower(), "natural")
