"""Text overlay effects via Pillow + FFmpeg overlay filter.

This module renders text using Pillow (PIL) and composites it onto video
using FFmpeg's overlay filter. This approach avoids the drawtext filter
which requires FFmpeg to be compiled with --enable-libfreetype.

The workflow:
1. Render each text overlay as a transparent PNG using Pillow
2. Use FFmpeg's overlay filter to composite the images onto the video
"""

import asyncio
import logging
import os
import subprocess
import textwrap
from dataclasses import dataclass
from typing import List, Literal, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

# Font path (same as text_overlay.py)
FONTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "fonts"
)
COOPER_BLACK = os.path.join(FONTS_DIR, "COOPBL.TTF")

# Noto Sans font paths (preferred) with fallbacks
# Updated for Docker containers
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


# =============================================================================
# PILLOW-BASED TEXT OVERLAY (Alternative to drawtext filter)
# =============================================================================


def get_pillow_font(size: int) -> ImageFont.FreeTypeFont:
    """Get a Pillow-compatible font.

    Args:
        size: Font size in pixels

    Returns:
        ImageFont object
    """
    # Try fonts in order of preference
    font_candidates = [
        # CJK fonts (support Korean/Chinese/Japanese)
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Bold.otf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        # Regular Noto Sans
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        # DejaVu (common fallback)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        # Liberation fonts
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        # macOS fonts
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]

    for font_path in font_candidates:
        if os.path.exists(font_path):
            try:
                return ImageFont.truetype(font_path, size)
            except Exception as e:
                logger.debug(f"Could not load font {font_path}: {e}")
                continue

    # Fallback to default font
    logger.warning("No TrueType fonts found, using default font")
    return ImageFont.load_default()


def render_text_image(
    text: str,
    video_size: Tuple[int, int],
    font_size: Optional[int] = None,
    style: str = "minimal",
) -> Image.Image:
    """Render text to a transparent PNG image using Pillow.

    Args:
        text: Text to render
        video_size: (width, height) of the video
        font_size: Font size (auto-calculated if None)
        style: Style name from STYLE_CONFIGS

    Returns:
        PIL Image with transparent background and rendered text
    """
    width, height = video_size

    # Font size: 2.8% of height (matching original)
    if font_size is None:
        font_size = max(28, int(height * 0.028))

    # Get style config
    config = STYLE_CONFIGS.get(style, STYLE_CONFIGS["minimal"])

    # Parse colors
    text_color = config.get("fontcolor", "white")
    border_color = config.get("bordercolor", "black")
    border_width = config.get("borderw", 2)

    # Convert color names to RGBA
    color_map = {
        "white": (255, 255, 255, 255),
        "black": (0, 0, 0, 255),
        "red": (255, 0, 0, 255),
        "yellow": (255, 255, 0, 255),
    }
    text_rgba = color_map.get(text_color, (255, 255, 255, 255))
    border_rgba = color_map.get(border_color, (0, 0, 0, 255))

    # Create transparent image
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Get font
    font = get_pillow_font(font_size)

    # Auto line wrap
    max_chars = 16 if width < height else 30
    wrapped_text = "\n".join(textwrap.wrap(text, width=max_chars))

    # Limit to 2 lines
    lines = wrapped_text.split("\n")
    if len(lines) > 2:
        wrapped_text = "\n".join(lines[:2])
        if len(lines) > 2:
            wrapped_text = wrapped_text.rstrip() + "..."

    # Calculate text bounding box
    bbox = draw.textbbox((0, 0), wrapped_text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center text
    x = (width - text_width) // 2
    y = (height - text_height) // 2

    # Draw border/stroke (draw text multiple times offset in each direction)
    if border_width > 0:
        for dx in range(-border_width, border_width + 1):
            for dy in range(-border_width, border_width + 1):
                if dx != 0 or dy != 0:
                    draw.text((x + dx, y + dy), wrapped_text, font=font, fill=border_rgba)

    # Draw main text
    draw.text((x, y), wrapped_text, font=font, fill=text_rgba)

    return img


async def apply_text_overlays_pillow(
    input_video: str,
    output_video: str,
    overlays: List["TextOverlaySpec"],
    video_size: Tuple[int, int],
    job_id: str = "",
    ffmpeg_path: str = "ffmpeg",
) -> bool:
    """Apply text overlays using Pillow + FFmpeg overlay filter.

    This is an alternative to drawtext that doesn't require libfreetype.

    Args:
        input_video: Path to input video
        output_video: Path to output video
        overlays: List of TextOverlaySpec objects
        video_size: (width, height) tuple
        job_id: Job ID for logging
        ffmpeg_path: Path to FFmpeg binary

    Returns:
        True if successful, False otherwise
    """
    if not overlays:
        logger.info(f"[{job_id}] No text overlays to apply")
        # Just copy input to output
        import shutil
        shutil.copy(input_video, output_video)
        return True

    # Create temp directory for text images
    temp_dir = os.path.dirname(output_video)
    text_images = []

    try:
        # Render each text overlay to a PNG image
        for i, spec in enumerate(overlays):
            img = render_text_image(
                text=spec.text,
                video_size=video_size,
                style=spec.style,
            )
            img_path = os.path.join(temp_dir, f"text_overlay_{i:03d}.png")
            img.save(img_path, "PNG")
            text_images.append({
                "path": img_path,
                "start": spec.start_time,
                "end": spec.start_time + spec.duration,
                "fade_in": ANIMATION_REGISTRY.get(spec.animation or "fade", {}).get("in_duration", 0.3),
                "fade_out": ANIMATION_REGISTRY.get(spec.animation or "fade", {}).get("out_duration", 0.3),
            })
            logger.debug(f"[{job_id}] Rendered text image {i}: '{spec.text[:30]}...'")

        # Build FFmpeg command with overlay filters
        # We need to chain multiple overlays
        inputs = ["-i", input_video]
        for img in text_images:
            inputs.extend(["-i", img["path"]])

        # Build filter complex
        filter_parts = []
        current_input = "0:v"

        for i, img in enumerate(text_images):
            input_idx = i + 1  # Image inputs start at index 1
            output_label = f"v{i+1}"

            # Calculate enable expression for timing
            start = img["start"]
            end = img["end"]
            fade_in = img["fade_in"]
            fade_out = img["fade_out"]

            # Alpha expression for fade in/out
            # Use geq filter to apply alpha based on time
            duration = end - start

            # Handle edge case: if duration is too short for fades, scale them down
            min_duration_for_fades = fade_in + fade_out
            if duration <= 0.1:
                # Duration too short, skip fades entirely - just show at full alpha
                logger.warning(f"[text_overlay] Text {i} duration {duration:.2f}s too short, using constant alpha")
                alpha_expr = f"if(between(t\\,{start}\\,{end})\\,1\\,0)"
            elif duration < min_duration_for_fades:
                # Scale fades proportionally to fit within duration
                scale = duration / min_duration_for_fades * 0.9  # Leave 10% at full alpha
                fade_in = fade_in * scale
                fade_out = fade_out * scale
                logger.info(f"[text_overlay] Text {i} scaled fades to {fade_in:.2f}/{fade_out:.2f}s for {duration:.2f}s duration")

                fade_in_end = start + fade_in
                fade_out_start = end - fade_out

                # Build alpha expression with scaled fades
                alpha_expr = (
                    f"if(lt(t\\,{start})\\,0\\,"
                    f"if(lt(t\\,{fade_in_end})\\,(t-{start})/{fade_in}\\,"
                    f"if(gt(t\\,{fade_out_start})\\,({end}-t)/{fade_out}\\,"
                    f"if(gt(t\\,{end})\\,0\\,1))))"
                )
            else:
                # Normal case: duration is long enough for standard fades
                fade_in_end = start + fade_in
                fade_out_start = end - fade_out

                # Build alpha expression for overlay's format filter
                # This creates smooth fade in/out
                alpha_expr = (
                    f"if(lt(t\\,{start})\\,0\\,"
                    f"if(lt(t\\,{fade_in_end})\\,(t-{start})/{fade_in}\\,"
                    f"if(gt(t\\,{fade_out_start})\\,({end}-t)/{fade_out}\\,"
                    f"if(gt(t\\,{end})\\,0\\,1))))"
                )

            # Format the image input with alpha expression
            filter_parts.append(
                f"[{input_idx}:v]format=rgba,colorchannelmixer=aa='{alpha_expr}'[txt{i}]"
            )

            # Overlay filter
            filter_parts.append(
                f"[{current_input}][txt{i}]overlay=0:0:enable='between(t\\,{start}\\,{end})'[{output_label}]"
            )
            current_input = output_label

        # Final output mapping
        filter_complex = ";".join(filter_parts)

        # Check if NVENC is available for GPU encoding
        from ..ffmpeg_pipeline import is_nvenc_available
        use_gpu = is_nvenc_available()

        # Build FFmpeg command
        if use_gpu:
            cmd = [
                ffmpeg_path, "-y",
                *inputs,
                "-filter_complex", filter_complex,
                "-map", f"[{current_input}]",
                "-map", "0:a?",
                "-c:v", "h264_nvenc",
                "-preset", "p4",
                "-cq", "20",
                "-c:a", "copy",
                output_video,
            ]
        else:
            cmd = [
                ffmpeg_path, "-y",
                *inputs,
                "-filter_complex", filter_complex,
                "-map", f"[{current_input}]",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "18",
                "-c:a", "copy",
                output_video,
            ]

        logger.info(f"[{job_id}] Applying {len(overlays)} text overlays with Pillow+overlay method")
        logger.debug(f"[{job_id}] FFmpeg command: {' '.join(cmd[:10])}...")

        # Run FFmpeg
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            logger.error(f"[{job_id}] FFmpeg overlay failed: {stderr.decode()[-500:]}")
            return False

        logger.info(f"[{job_id}] Text overlays applied successfully")
        return True

    except Exception as e:
        logger.error(f"[{job_id}] Text overlay error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

    finally:
        # Cleanup temp images
        for img in text_images:
            try:
                if os.path.exists(img["path"]):
                    os.remove(img["path"])
            except:
                pass


async def apply_text_overlays_ass(
    input_video: str,
    output_video: str,
    overlays: List["TextOverlaySpec"],
    video_size: Tuple[int, int],
    job_id: str = "",
    ffmpeg_path: str = "ffmpeg",
) -> bool:
    """Apply text overlays using ASS subtitles - simpler and more reliable.

    ASS format has native support for fades via \\fad(fade_in_ms, fade_out_ms).
    This is much more reliable than complex FFmpeg filter expressions.

    Args:
        input_video: Path to input video
        output_video: Path to output video
        overlays: List of TextOverlaySpec objects
        video_size: (width, height) tuple
        job_id: Job ID for logging
        ffmpeg_path: Path to FFmpeg binary

    Returns:
        True if successful, False otherwise
    """
    logger.info(f"[{job_id}] [ASS] === ASS SUBTITLE OVERLAY START ===")
    logger.info(f"[{job_id}] [ASS] Input video: {input_video}")
    logger.info(f"[{job_id}] [ASS] Output video: {output_video}")
    logger.info(f"[{job_id}] [ASS] Video size: {video_size}")
    logger.info(f"[{job_id}] [ASS] Number of overlays: {len(overlays)}")
    logger.info(f"[{job_id}] [ASS] FFmpeg path: {ffmpeg_path}")

    if not overlays:
        logger.info(f"[{job_id}] [ASS] No text overlays to apply - returning True")
        return True

    # Log each overlay detail
    for i, overlay in enumerate(overlays):
        logger.info(f"[{job_id}] [ASS] Overlay {i+1}: text='{overlay.text}', start={overlay.start_time:.2f}s, duration={overlay.duration:.2f}s, end={overlay.start_time + overlay.duration:.2f}s, style={overlay.style}, animation={overlay.animation}")

    width, height = video_size
    job_dir = os.path.dirname(output_video)
    ass_path = os.path.join(job_dir, f"{job_id}_subtitles.ass")
    logger.info(f"[{job_id}] [ASS] ASS file path: {ass_path}")
    logger.info(f"[{job_id}] [ASS] Job directory: {job_dir}")

    try:
        # Generate ASS subtitle file
        logger.info(f"[{job_id}] [ASS] Generating ASS subtitle file...")
        ass_content = _generate_ass_file(overlays, width, height, job_id)
        logger.info(f"[{job_id}] [ASS] ASS content length: {len(ass_content)} bytes")
        logger.info(f"[{job_id}] [ASS] ASS content preview:\n{ass_content[:1000]}...")

        with open(ass_path, "w", encoding="utf-8") as f:
            f.write(ass_content)
        logger.info(f"[{job_id}] [ASS] Written ASS file to: {ass_path}")

        # Verify file was written
        if os.path.exists(ass_path):
            file_size = os.path.getsize(ass_path)
            logger.info(f"[{job_id}] [ASS] ASS file size: {file_size} bytes")
        else:
            logger.error(f"[{job_id}] [ASS] ERROR: ASS file was not created!")
            return False

        # Build FFmpeg command with ASS filter
        # Note: ass filter path needs escaping for Windows compatibility
        escaped_ass_path = ass_path.replace("\\", "/").replace(":", "\\:")
        logger.info(f"[{job_id}] [ASS] Escaped ASS path: {escaped_ass_path}")

        # Check if NVENC is available for GPU encoding
        from ..ffmpeg_pipeline import is_nvenc_available
        use_gpu = is_nvenc_available()

        if use_gpu:
            cmd = [
                ffmpeg_path, "-y",
                "-i", input_video,
                "-vf", f"ass='{escaped_ass_path}'",
                "-c:v", "h264_nvenc",
                "-preset", "p4",
                "-cq", "20",
                "-c:a", "copy",
                output_video,
            ]
            logger.info(f"[{job_id}] [ASS] Using GPU encoding (h264_nvenc)")
        else:
            cmd = [
                ffmpeg_path, "-y",
                "-i", input_video,
                "-vf", f"ass='{escaped_ass_path}'",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "18",
                "-c:a", "copy",
                output_video,
            ]
            logger.info(f"[{job_id}] [ASS] Using CPU encoding (libx264)")

        logger.info(f"[{job_id}] [ASS] FFmpeg command: {' '.join(cmd)}")

        # Run FFmpeg
        logger.info(f"[{job_id}] [ASS] Executing FFmpeg...")
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        logger.info(f"[{job_id}] [ASS] FFmpeg return code: {process.returncode}")

        if stdout:
            logger.info(f"[{job_id}] [ASS] FFmpeg stdout: {stdout.decode()[:500]}")
        if stderr:
            stderr_text = stderr.decode()
            # Log last 1000 chars of stderr (most relevant part)
            logger.info(f"[{job_id}] [ASS] FFmpeg stderr (last 1000 chars): {stderr_text[-1000:]}")

        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            logger.error(f"[{job_id}] [ASS] ✗ FFmpeg FAILED with return code {process.returncode}")
            logger.error(f"[{job_id}] [ASS] Full error: {error_msg}")
            return False

        # Verify output file
        if os.path.exists(output_video):
            output_size = os.path.getsize(output_video)
            logger.info(f"[{job_id}] [ASS] ✓ Output video created: {output_video} ({output_size} bytes)")
        else:
            logger.error(f"[{job_id}] [ASS] ✗ Output video was NOT created!")
            return False

        logger.info(f"[{job_id}] [ASS] === ASS SUBTITLE OVERLAY COMPLETE ===")
        return True

    except Exception as e:
        logger.error(f"[{job_id}] [ASS] ✗ Exception: {type(e).__name__}: {e}")
        import traceback
        logger.error(f"[{job_id}] [ASS] Traceback: {traceback.format_exc()}")
        return False

    finally:
        # Cleanup ASS file
        try:
            if os.path.exists(ass_path):
                os.remove(ass_path)
                logger.info(f"[{job_id}] [ASS] Cleaned up ASS file: {ass_path}")
        except Exception as cleanup_error:
            logger.warning(f"[{job_id}] [ASS] Failed to cleanup ASS file: {cleanup_error}")


def _generate_ass_file(
    overlays: List["TextOverlaySpec"],
    width: int,
    height: int,
    job_id: str = "",
) -> str:
    """Generate ASS subtitle file content.

    Args:
        overlays: List of TextOverlaySpec objects
        width: Video width
        height: Video height
        job_id: Job ID for logging

    Returns:
        ASS file content as string
    """
    # ASS header with style definition
    # PlayResX/Y define the coordinate system
    # Style: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,
    #        Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle,
    #        BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

    # Calculate font size relative to video height (roughly 5% of height)
    font_size = max(36, int(height * 0.05))

    # ASS Alignment uses numpad layout:
    # 7=top-left,    8=top-center,    9=top-right
    # 4=middle-left, 5=middle-center, 6=middle-right
    # 1=bottom-left, 2=bottom-center, 3=bottom-right
    # We use 5 for center of screen (both horizontal and vertical)
    alignment = 5  # Middle-center

    ass_header = f"""[Script Info]
Title: Text Overlays
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK KR,{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,{alignment},0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    # Generate dialogue lines
    dialogue_lines = []
    for i, overlay in enumerate(overlays):
        start_time = _seconds_to_ass_time(overlay.start_time)
        end_time = _seconds_to_ass_time(overlay.start_time + overlay.duration)

        # Get fade durations (default 300ms)
        fade_in_ms = int(ANIMATION_REGISTRY.get(overlay.animation or "fade", {}).get("in_duration", 0.3) * 1000)
        fade_out_ms = int(ANIMATION_REGISTRY.get(overlay.animation or "fade", {}).get("out_duration", 0.3) * 1000)

        # Escape special ASS characters and add fade effect
        text = overlay.text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")

        # Add fade effect: \fad(fade_in_ms, fade_out_ms)
        text_with_fade = f"{{\\fad({fade_in_ms},{fade_out_ms})}}{text}"

        dialogue_lines.append(
            f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text_with_fade}"
        )

        logger.debug(f"[{job_id}] ASS line {i}: '{overlay.text[:30]}...' @ {start_time}->{end_time}")

    return ass_header + "\n".join(dialogue_lines) + "\n"


def _seconds_to_ass_time(seconds: float) -> str:
    """Convert seconds to ASS time format (H:MM:SS.cc).

    Args:
        seconds: Time in seconds

    Returns:
        ASS time string (e.g., "0:00:05.50")
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"


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
