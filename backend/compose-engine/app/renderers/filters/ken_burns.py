"""Ken Burns effects via FFmpeg zoompan filter.

Replaces MoviePy's clip.resized(scale_function) with native FFmpeg zoompan filter.
This is significantly faster as it avoids Python per-frame processing.
"""

from typing import Literal, Tuple, Optional


def build_ken_burns_filter(
    style: Literal["zoom_in", "zoom_out", "pan", "static"],
    duration: float,
    output_size: Tuple[int, int],
    fps: int = 30,
    zoom_amount: float = 0.05,
) -> str:
    """Build FFmpeg zoompan filter for Ken Burns effect.

    This replicates the exact behavior of motion.py:apply_ken_burns()
    using FFmpeg's zoompan filter instead of MoviePy's clip.resized().

    Args:
        style: Motion style - zoom_in, zoom_out, pan, or static
        duration: Clip duration in seconds
        output_size: (width, height) tuple for output
        fps: Frame rate (default 30)
        zoom_amount: Zoom percentage (default 0.05 = 5%)

    Returns:
        FFmpeg filter string for zoompan

    Example output:
        "zoompan=z='1.0+0.05*...':d=90:s=1080x1920:fps=30"

    The easing formula matches MoviePy exactly:
        eased = progress * progress * (3 - 2 * progress)
    Where progress = current_frame / total_frames (on/d in FFmpeg terms)
    """
    w, h = output_size
    total_frames = int(duration * fps)

    if style == "static" or total_frames <= 0:
        # No motion - just hold the frame
        return f"zoompan=z='1':d={max(total_frames, 1)}:s={w}x{h}:fps={fps}"

    # FFmpeg zoompan uses 'on' for current frame number and 'd' for total frames
    # We need to express the ease-in-out formula in FFmpeg expression syntax
    # Original: eased = progress * progress * (3 - 2 * progress)
    # Where progress = t / duration = on / d

    # In FFmpeg expression syntax:
    # progress = on/d
    # eased = (on/d)*(on/d)*(3-2*(on/d))
    # Simplified: (on/d)^2 * (3 - 2*on/d)

    # FFmpeg expression (using d for total_frames to match zoompan):
    progress = f"(on/{total_frames})"
    eased = f"({progress}*{progress}*(3-2*{progress}))"

    if style == "zoom_in":
        # Start at 100%, end at 105% (1.0 + 0.05 * eased)
        zoom_expr = f"1.0+{zoom_amount}*{eased}"
        # Center the zoom
        x_expr = f"iw/2-(iw/zoom/2)"
        y_expr = f"ih/2-(ih/zoom/2)"

    elif style == "zoom_out":
        # Start at 105%, end at 100% (1.05 - 0.05 * eased)
        zoom_expr = f"{1.0 + zoom_amount}-{zoom_amount}*{eased}"
        x_expr = f"iw/2-(iw/zoom/2)"
        y_expr = f"ih/2-(ih/zoom/2)"

    elif style == "pan":
        # Fixed 3% zoom with horizontal pan from left to right
        zoom_expr = "1.03"
        # Pan from center-left to center-right (using 3% of width)
        # Start: x = iw*0.015 (1.5% from left of center)
        # End: x = iw*0.015 (1.5% to right of center)
        # This creates subtle horizontal drift
        pan_amount = 0.03  # 3% total movement
        x_expr = f"iw/2-(iw/zoom/2)+iw*{pan_amount}*{progress}"
        y_expr = f"ih/2-(ih/zoom/2)"

    else:
        # Fallback to static
        zoom_expr = "1"
        x_expr = f"iw/2-(iw/zoom/2)"
        y_expr = f"ih/2-(ih/zoom/2)"

    return f"zoompan=z='{zoom_expr}':x='{x_expr}':y='{y_expr}':d={total_frames}:s={w}x{h}:fps={fps}"


def build_image_to_video_filter(
    motion_style: Literal["zoom_in", "zoom_out", "pan", "static"],
    duration: float,
    output_size: Tuple[int, int],
    fps: int = 30,
    input_scale_factor: float = 1.1,
) -> str:
    """Build complete filter chain for converting image to video with Ken Burns.

    This creates a filter that:
    1. Scales input image slightly larger (to allow room for zoom/pan)
    2. Applies Ken Burns motion via zoompan
    3. Ensures output is in yuv420p format for compatibility

    Args:
        motion_style: Ken Burns style
        duration: Output duration in seconds
        output_size: (width, height) for output
        fps: Frame rate
        input_scale_factor: How much to upscale input (1.1 = 10% larger)

    Returns:
        Complete FFmpeg filter chain string
    """
    w, h = output_size

    # Scale input larger to have headroom for zoom/pan
    scaled_w = int(w * input_scale_factor)
    scaled_h = int(h * input_scale_factor)

    filters = [
        # Scale input image to have room for motion
        f"scale={scaled_w}:{scaled_h}:force_original_aspect_ratio=increase",
        # Crop to exact dimensions (centered)
        f"crop={scaled_w}:{scaled_h}",
        # Apply Ken Burns motion
        build_ken_burns_filter(motion_style, duration, output_size, fps),
        # Ensure compatible pixel format
        "format=yuv420p",
    ]

    return ",".join(filters)


def get_diverse_motion_styles(
    num_images: int,
    pattern: Literal["alternate", "random", "progressive"] = "alternate",
) -> list:
    """Generate diverse Ken Burns styles for multiple images.

    Matches the logic in video_renderer.py that creates visual variety
    by alternating between different motion styles.

    Args:
        num_images: Number of images
        pattern: Distribution pattern
            - alternate: zoom_in, zoom_out, pan, repeat
            - random: Random selection
            - progressive: zoom_in for first half, zoom_out for second

    Returns:
        List of motion style strings
    """
    import random

    styles = ["zoom_in", "zoom_out", "pan"]

    if pattern == "alternate":
        return [styles[i % len(styles)] for i in range(num_images)]

    elif pattern == "random":
        return [random.choice(styles) for _ in range(num_images)]

    elif pattern == "progressive":
        mid = num_images // 2
        return (
            ["zoom_in"] * mid
            + ["zoom_out"] * (num_images - mid)
        )

    return ["zoom_in"] * num_images
