"""Text overlay effects via FFmpeg drawtext filter.

Replaces MoviePy's TextClip with native FFmpeg drawtext filter.
This is much faster as it processes in a single FFmpeg pass.
"""

import os
import textwrap
from dataclasses import dataclass
from typing import List, Literal, Optional, Tuple

# Font path (same as text_overlay.py)
FONTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "fonts"
)
COOPER_BLACK = os.path.join(FONTS_DIR, "COOPBL.TTF")

# Noto Sans font paths (preferred) with fallbacks
# Updated for AWS Batch/Modal Docker containers
FALLBACK_FONTS = [
    # Common Linux paths
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    # Ubuntu/Debian default paths
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    # macOS paths
    "/System/Library/Fonts/NotoSans-Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    # Generic fallback - works with fontconfig
    "Sans",
]

# Animation registry matching text_overlay.py
ANIMATION_REGISTRY = {
    "fade": {"in_duration": 0.3, "out_duration": 0.3},
    "typewriter": {"in_duration": 0.5, "out_duration": 0.2},
    "word_by_word": {"in_duration": 0.4, "out_duration": 0.2},
    "bounce_in": {"in_duration": 0.4, "out_duration": 0.2},
    "scale_pop": {"in_duration": 0.15, "out_duration": 0.15},
    "slide_up": {"in_duration": 0.3, "out_duration": 0.2},
    "slide_down": {"in_duration": 0.3, "out_duration": 0.2},
    "slide_left": {"in_duration": 0.3, "out_duration": 0.2},
    "slide_right": {"in_duration": 0.3, "out_duration": 0.2},
    "glitch": {"in_duration": 0.2, "out_duration": 0.15},
    "wave": {"in_duration": 0.4, "out_duration": 0.3},
    "karaoke": {"in_duration": 0.0, "out_duration": 0.0},
    "split_reveal": {"in_duration": 0.35, "out_duration": 0.2},
    "blur_in": {"in_duration": 0.4, "out_duration": 0.3},
}

# Style configurations matching text_overlay.py
STYLE_CONFIGS = {
    "bold_pop": {
        "fontcolor": "white",
        "borderw": 3,
        "bordercolor": "black",
        "default_animation": "scale_pop",
    },
    "fade_in": {
        "fontcolor": "white",
        "borderw": 2,
        "bordercolor": "black",
        "default_animation": "fade",
    },
    "slide_in": {
        "fontcolor": "white",
        "borderw": 3,
        "bordercolor": "black",
        "default_animation": "slide_up",
    },
    "minimal": {
        "fontcolor": "white",
        "borderw": 2,
        "bordercolor": "black",
        "default_animation": "fade",
    },
}


def escape_ffmpeg_text(text: str) -> str:
    """Escape special characters for FFmpeg drawtext filter.

    FFmpeg's drawtext filter requires specific escaping for:
    - Backslashes (\\)
    - Single quotes (')
    - Colons (:)
    - Semicolons in filter chains (handled separately)

    Args:
        text: Original text

    Returns:
        Escaped text safe for FFmpeg drawtext
    """
    # Order matters: escape backslashes first
    text = text.replace("\\", "\\\\\\\\")
    text = text.replace("'", "'\\''")
    text = text.replace(":", "\\:")
    # Newlines need to be preserved for multi-line text
    # FFmpeg drawtext doesn't support \n directly, use multiple drawtext instead
    return text


def get_font_path() -> tuple[str, bool]:
    """Get available font path - prioritizes Noto Sans.

    Returns:
        Tuple of (font_path_or_name, is_file_path)
        - If is_file_path is True, font_path_or_name is a file path
        - If is_file_path is False, font_path_or_name is a font name for fontconfig
    """
    import logging
    logger = logging.getLogger(__name__)

    # Check each font file in order of preference
    for fallback in FALLBACK_FONTS:
        # For generic font names (no path), return as font name
        if not fallback.startswith("/"):
            logger.info(f"[text_overlay] Using generic font name: {fallback}")
            return (fallback, False)
        if os.path.exists(fallback):
            logger.info(f"[text_overlay] Using font file: {fallback}")
            return (fallback, True)
        else:
            logger.debug(f"[text_overlay] Font not found: {fallback}")

    # Return generic font name as last resort (use fontconfig)
    logger.warning("[text_overlay] No specific fonts found, using 'Sans' via fontconfig")
    return ("Sans", False)


@dataclass
class TextOverlaySpec:
    """Specification for a text overlay."""
    text: str
    start_time: float
    duration: float
    style: str = "minimal"
    animation: Optional[str] = None


def build_drawtext_filter(
    text: str,
    start_time: float,
    duration: float,
    video_size: Tuple[int, int],
    style: str = "minimal",
    animation: Optional[str] = None,
    font_size: Optional[int] = None,
) -> str:
    """Build FFmpeg drawtext filter for text overlay.

    This replicates the behavior of text_overlay.py:create_text_clip()
    using FFmpeg's drawtext filter instead of MoviePy's TextClip.

    Args:
        text: Text to display
        start_time: Start time in seconds
        duration: Duration in seconds
        video_size: (width, height) tuple
        style: Style name (bold_pop, fade_in, slide_in, minimal)
        animation: Animation name (fade, scale_pop, etc.)
        font_size: Optional font size override

    Returns:
        FFmpeg drawtext filter string
    """
    width, height = video_size
    end_time = start_time + duration

    # Font size: 2.8% of height (matching text_overlay.py)
    if font_size is None:
        font_size = max(28, int(height * 0.028))

    # Get style configuration
    config = STYLE_CONFIGS.get(style, STYLE_CONFIGS["minimal"])

    # Get animation configuration
    anim_name = animation or config.get("default_animation", "fade")
    anim_config = ANIMATION_REGISTRY.get(anim_name, ANIMATION_REGISTRY["fade"])
    fade_in_dur = anim_config["in_duration"]
    fade_out_dur = anim_config["out_duration"]

    # Auto line wrap for long text
    max_chars = 16 if width < height else 30  # Vertical vs horizontal
    wrapped_text = "\n".join(textwrap.wrap(text, width=max_chars))

    # Limit to 2 lines
    lines = wrapped_text.split("\n")
    if len(lines) > 2:
        wrapped_text = "\n".join(lines[:2])
        if len(lines) > 2:
            wrapped_text = wrapped_text.rstrip() + "..."

    # Escape for FFmpeg
    escaped_text = escape_ffmpeg_text(wrapped_text)

    # Get font
    font_path, is_font_file = get_font_path()

    # Position: centered vertically
    num_lines = len(lines)
    line_height = font_size * 1.5

    # Calculate y position: center of screen, accounting for text height
    # Center formula: (h - text_h) / 2
    text_height = int(num_lines * line_height)
    y_expr = f"(h-{text_height})/2"

    # Build alpha expression for fade in/out
    # Alpha goes from 0 to 1 during fade_in, stays at 1, then 1 to 0 during fade_out
    if fade_in_dur > 0 or fade_out_dur > 0:
        fade_in_end = start_time + fade_in_dur
        fade_out_start = end_time - fade_out_dur

        # FFmpeg expression for alpha:
        # if t < start: 0
        # if t < fade_in_end: (t - start) / fade_in_dur
        # if t < fade_out_start: 1
        # if t < end: (end - t) / fade_out_dur
        # else: 0

        alpha_parts = []
        if fade_in_dur > 0:
            alpha_parts.append(
                f"if(lt(t\\,{fade_in_end})\\,(t-{start_time})/{fade_in_dur}"
            )
        if fade_out_dur > 0:
            alpha_parts.append(
                f"if(gt(t\\,{fade_out_start})\\,({end_time}-t)/{fade_out_dur}\\,1)"
            )

        if fade_in_dur > 0 and fade_out_dur > 0:
            # Combine both fades
            alpha_expr = (
                f"if(lt(t\\,{fade_in_end})\\,"
                f"(t-{start_time})/{fade_in_dur}\\,"
                f"if(gt(t\\,{fade_out_start})\\,"
                f"({end_time}-t)/{fade_out_dur}\\,"
                f"1))"
            )
        elif fade_in_dur > 0:
            alpha_expr = f"if(lt(t\\,{fade_in_end})\\,(t-{start_time})/{fade_in_dur}\\,1)"
        elif fade_out_dur > 0:
            alpha_expr = f"if(gt(t\\,{fade_out_start})\\,({end_time}-t)/{fade_out_dur}\\,1)"
        else:
            alpha_expr = "1"
    else:
        alpha_expr = "1"

    # Build the drawtext filter
    # Note: For multi-line text, we need to handle it specially
    # FFmpeg drawtext doesn't handle \n well, so we create multiple drawtext filters
    # But for simplicity, we'll use a single filter with line_spacing

    filter_parts = [
        f"drawtext=text='{escaped_text}'",
    ]

    # Use fontfile for file paths, font for font names (fontconfig)
    if is_font_file:
        filter_parts.append(f"fontfile='{font_path}'")
    else:
        filter_parts.append(f"font='{font_path}'")

    filter_parts.extend([
        f"fontsize={font_size}",
        f"fontcolor={config['fontcolor']}",
        f"borderw={config['borderw']}",
        f"bordercolor={config['bordercolor']}",
        f"x=(w-text_w)/2",  # Center horizontally
        f"y={y_expr}",
        f"alpha='{alpha_expr}'",
        f"enable='between(t\\,{start_time}\\,{end_time})'",
    ])

    return ":".join(filter_parts)


def build_text_overlay_chain(
    overlays: List[TextOverlaySpec],
    video_size: Tuple[int, int],
) -> str:
    """Build a chain of drawtext filters for multiple text overlays.

    This processes all text overlays in a single FFmpeg pass,
    which is much faster than MoviePy's CompositeVideoClip.

    Args:
        overlays: List of TextOverlaySpec objects
        video_size: (width, height) tuple

    Returns:
        Complete FFmpeg filter chain string (comma-separated filters)
    """
    if not overlays:
        return ""

    filters = []
    for spec in overlays:
        filter_str = build_drawtext_filter(
            text=spec.text,
            start_time=spec.start_time,
            duration=spec.duration,
            video_size=video_size,
            style=spec.style,
            animation=spec.animation,
        )
        filters.append(filter_str)

    return ",".join(filters)


def build_korean_text_filter(
    text: str,
    start_time: float,
    duration: float,
    video_size: Tuple[int, int],
    style: str = "minimal",
) -> str:
    """Build drawtext filter with Korean font support.

    Korean text requires specific fonts that support Hangul characters.

    Args:
        text: Korean text to display
        start_time: Start time in seconds
        duration: Duration in seconds
        video_size: (width, height) tuple
        style: Style name

    Returns:
        FFmpeg drawtext filter string
    """
    # Korean font paths - includes CJK fonts that support Hangul
    korean_fonts = [
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Bold.otf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    ]

    # Find available Korean font
    font_path = None
    is_font_file = False
    for font in korean_fonts:
        if os.path.exists(font):
            font_path = font
            is_font_file = True
            break

    if not font_path:
        # Fall back to default (may not render Korean properly)
        font_path, is_font_file = get_font_path()

    # Use the standard build function but with Korean font
    width, height = video_size
    font_size = max(28, int(height * 0.028))

    config = STYLE_CONFIGS.get(style, STYLE_CONFIGS["minimal"])
    escaped_text = escape_ffmpeg_text(text)

    end_time = start_time + duration
    anim_config = ANIMATION_REGISTRY["fade"]
    fade_in = anim_config["in_duration"]
    fade_out = anim_config["out_duration"]

    fade_in_end = start_time + fade_in
    fade_out_start = end_time - fade_out

    alpha_expr = (
        f"if(lt(t\\,{fade_in_end})\\,"
        f"(t-{start_time})/{fade_in}\\,"
        f"if(gt(t\\,{fade_out_start})\\,"
        f"({end_time}-t)/{fade_out}\\,"
        f"1))"
    )

    y_expr = f"h*0.75"

    filter_parts = [
        f"drawtext=text='{escaped_text}'",
    ]

    # Use fontfile for file paths, font for font names (fontconfig)
    if is_font_file:
        filter_parts.append(f"fontfile='{font_path}'")
    else:
        filter_parts.append(f"font='{font_path}'")

    filter_parts.extend([
        f"fontsize={font_size}",
        f"fontcolor={config['fontcolor']}",
        f"borderw={config['borderw']}",
        f"bordercolor={config['bordercolor']}",
        f"x=(w-text_w)/2",
        f"y={y_expr}",
        f"alpha='{alpha_expr}'",
        f"enable='between(t\\,{start_time}\\,{end_time})'",
    ])

    return ":".join(filter_parts)
