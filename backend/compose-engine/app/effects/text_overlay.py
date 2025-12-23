"""Text overlay effects for video composition."""

import os
from moviepy import TextClip, CompositeVideoClip
from moviepy.video.fx import CrossFadeIn, CrossFadeOut
from typing import Tuple, Optional
import textwrap

# Get the font path relative to this file
FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fonts")
COOPER_BLACK = os.path.join(FONTS_DIR, "COOPBL.TTF")

# Animation registry - maps animation IDs to effect configurations
# Each animation defines: in/out durations and effect type
ANIMATION_REGISTRY = {
    # Basic animations
    "fade": {"in_duration": 0.3, "out_duration": 0.3, "type": "fade"},
    "typewriter": {"in_duration": 0.5, "out_duration": 0.2, "type": "typewriter"},
    "word_by_word": {"in_duration": 0.4, "out_duration": 0.2, "type": "word_by_word"},

    # Pop/bounce animations
    "bounce_in": {"in_duration": 0.4, "out_duration": 0.2, "type": "bounce"},
    "scale_pop": {"in_duration": 0.15, "out_duration": 0.15, "type": "scale_pop"},

    # Slide animations
    "slide_up": {"in_duration": 0.3, "out_duration": 0.2, "type": "slide_up"},
    "slide_down": {"in_duration": 0.3, "out_duration": 0.2, "type": "slide_down"},
    "slide_left": {"in_duration": 0.3, "out_duration": 0.2, "type": "slide_left"},
    "slide_right": {"in_duration": 0.3, "out_duration": 0.2, "type": "slide_right"},

    # Special effects
    "glitch": {"in_duration": 0.2, "out_duration": 0.15, "type": "glitch"},
    "wave": {"in_duration": 0.4, "out_duration": 0.3, "type": "wave"},
    "karaoke": {"in_duration": 0.0, "out_duration": 0.0, "type": "karaoke"},
    "split_reveal": {"in_duration": 0.35, "out_duration": 0.2, "type": "split_reveal"},
    "blur_in": {"in_duration": 0.4, "out_duration": 0.3, "type": "blur_in"},
}


def create_text_clip(
    text: str,
    start: float,
    duration: float,
    style: str,
    video_size: Tuple[int, int],
    font_size: Optional[int] = None,
    animation: Optional[str] = None
) -> TextClip:
    """
    Create a text clip with the specified style.

    Improvements:
    - Uses Cooper Black font for bold, impactful text
    - Larger font size (4% of height = ~77px for 1920)
    - White text with black outline for visibility
    - Position at bottom 18% for TikTok safe zone
    - Explicit text area height to prevent clipping
    - Auto line wrap for long text
    """
    width, height = video_size

    # Font size: 2.8% of height (9:16 1920 → ~54px, 16:9 1080 → ~30px)
    # Reduced to 0.7x for cleaner look
    if font_size is None:
        font_size = max(28, int(height * 0.028))

    # Auto line wrap for long text (approx 16-30 chars per line for readability)
    # Reduced chars per line for vertical videos to prevent overflow
    max_chars_per_line = 16 if width < height else 30  # Vertical vs horizontal
    wrapped_text = "\n".join(textwrap.wrap(text, width=max_chars_per_line))

    # Limit to 2 lines max for cleaner look and to prevent clipping
    lines = wrapped_text.split("\n")
    if len(lines) > 2:
        wrapped_text = "\n".join(lines[:2])
        if len(lines) > 2:
            wrapped_text = wrapped_text.rstrip() + "..."

    # Check if Cooper Black font exists
    font_path = COOPER_BLACK if os.path.exists(COOPER_BLACK) else None

    # All styles now use Cooper Black with white text and black outline
    style_configs = {
        "bold_pop": {
            "font": font_path,
            "color": "white",
            "stroke_color": "black",
            "stroke_width": 3,
            "method": "caption",
            "align": "center",
        },
        "fade_in": {
            "font": font_path,
            "color": "white",
            "stroke_color": "black",
            "stroke_width": 2,
            "method": "caption",
            "align": "center",
        },
        "slide_in": {
            "font": font_path,
            "color": "white",
            "stroke_color": "black",
            "stroke_width": 3,
            "method": "caption",
            "align": "center",
        },
        "minimal": {
            "font": font_path,
            "color": "white",
            "stroke_color": "black",
            "stroke_width": 2,
            "method": "caption",
            "align": "center",
        }
    }

    config = style_configs.get(style, style_configs["minimal"])

    # Text width: 85% of video width (reduced for better margins)
    text_width = int(width * 0.85)

    # Calculate text area height explicitly (prevents clipping)
    # Use generous height calculation: font_size * 1.8 per line + padding
    num_lines = len(wrapped_text.split('\n'))
    line_height = font_size * 1.8  # Generous line spacing
    text_area_height = int(num_lines * line_height + font_size)  # Extra padding

    # Create text clip with EXPLICIT height to prevent clipping
    try:
        txt_clip = TextClip(
            text=wrapped_text,
            font_size=font_size,
            font=config["font"],
            color=config["color"],
            stroke_color=config["stroke_color"],
            stroke_width=config["stroke_width"],
            method=config["method"],
            text_align=config["align"],
            size=(text_width, text_area_height)  # Explicit height!
        )
    except Exception:
        # Fallback if custom font not available
        txt_clip = TextClip(
            text=wrapped_text,
            font_size=font_size,
            color="white",
            stroke_color="black",
            stroke_width=2,
            method="caption",
            size=(text_width, text_area_height)  # Explicit height!
        )

    # Position at bottom 18% (TikTok safe zone for captions/UI elements)
    # This accounts for TikTok's bottom navigation and engagement buttons
    bottom_margin = int(height * 0.18)  # 18% from bottom edge
    y_position = height - bottom_margin - text_area_height

    # Ensure text doesn't go above 55% of screen (leave top 45% for visual content)
    min_y = int(height * 0.55)
    y_position = max(min_y, y_position)

    txt_clip = txt_clip.with_position(("center", y_position))
    txt_clip = txt_clip.with_start(start)
    txt_clip = txt_clip.with_duration(duration)

    # Apply animation effects using MoviePy 2.x effects
    # Priority: animation parameter > style-based fallback
    anim_config = None
    if animation and animation in ANIMATION_REGISTRY:
        anim_config = ANIMATION_REGISTRY[animation]
    else:
        # Fallback to style-based animation
        style_to_animation = {
            "fade_in": "fade",
            "bold_pop": "scale_pop",
            "slide_in": "slide_up",
            "minimal": "fade",
        }
        fallback_anim = style_to_animation.get(style, "fade")
        anim_config = ANIMATION_REGISTRY.get(fallback_anim, ANIMATION_REGISTRY["fade"])

    in_dur = anim_config["in_duration"]
    out_dur = anim_config["out_duration"]
    anim_type = anim_config["type"]

    # Apply animation based on type
    # For now, most animations use CrossFade with varying durations
    # Future: implement typewriter, glitch, wave effects using custom functions
    if anim_type in ["fade", "scale_pop", "bounce", "blur_in"]:
        txt_clip = txt_clip.with_effects([CrossFadeIn(in_dur), CrossFadeOut(out_dur)])
    elif anim_type in ["slide_up", "slide_down", "slide_left", "slide_right"]:
        # Slide animations use fade with different timing
        txt_clip = txt_clip.with_effects([CrossFadeIn(in_dur), CrossFadeOut(out_dur)])
    elif anim_type == "typewriter":
        # Typewriter effect - fade in slowly, fade out quickly
        txt_clip = txt_clip.with_effects([CrossFadeIn(in_dur), CrossFadeOut(out_dur)])
    elif anim_type == "word_by_word":
        # Word by word - similar to typewriter for now
        txt_clip = txt_clip.with_effects([CrossFadeIn(in_dur), CrossFadeOut(out_dur)])
    elif anim_type == "glitch":
        # Glitch effect - fast fade for glitchy feel
        txt_clip = txt_clip.with_effects([CrossFadeIn(in_dur), CrossFadeOut(out_dur)])
    elif anim_type == "wave":
        # Wave effect - smoother transition
        txt_clip = txt_clip.with_effects([CrossFadeIn(in_dur), CrossFadeOut(out_dur)])
    elif anim_type == "split_reveal":
        # Split reveal - medium fade
        txt_clip = txt_clip.with_effects([CrossFadeIn(in_dur), CrossFadeOut(out_dur)])
    elif anim_type == "karaoke":
        # Karaoke - no fade, instant on/off
        pass  # No effects needed
    else:
        # Default fallback
        txt_clip = txt_clip.with_effects([CrossFadeIn(0.2), CrossFadeOut(0.2)])

    return txt_clip
