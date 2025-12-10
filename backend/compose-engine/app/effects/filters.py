"""Video color grading and filter effects with GPU acceleration."""

from moviepy import VideoClip
import numpy as np
import os

# Try to import cupy for GPU acceleration
try:
    import cupy as cp
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False
    cp = None

# Check if we should use GPU (set by modal_app.py)
USE_GPU = os.environ.get("USE_NVENC", "0") == "1" and GPU_AVAILABLE


def apply_color_grade(
    video: VideoClip,
    grade: str
) -> VideoClip:
    """
    Apply color grading to a video clip.
    Uses GPU (cupy) when available for faster processing.
    """
    if grade == "vibrant":
        return _apply_vibrant(video)
    elif grade == "cinematic":
        return _apply_cinematic(video)
    elif grade == "bright":
        return _apply_bright(video)
    elif grade == "moody":
        return _apply_moody(video)
    elif grade == "bw":
        return _apply_bw(video)
    else:  # natural
        return video


def _gpu_process(frame: np.ndarray, transform_fn) -> np.ndarray:
    """Process frame on GPU if available, else CPU.

    Automatically falls back to CPU on CUDA errors (memory, invalid value, etc.)
    """
    if USE_GPU and cp is not None:
        try:
            # Ensure frame is valid numpy array with correct shape
            if not isinstance(frame, np.ndarray) or frame.ndim != 3:
                return transform_fn(frame.astype(np.float32), np).astype(np.uint8)

            # Transfer to GPU
            gpu_frame = cp.asarray(frame.astype(np.float32))
            # Process on GPU
            result = transform_fn(gpu_frame, cp)
            # Transfer back
            return cp.asnumpy(result).astype(np.uint8)
        except Exception as e:
            # CUDA errors (cudaErrorInvalidValue, out of memory, etc.) - fall back to CPU
            error_msg = str(e).lower()
            if 'cuda' in error_msg or 'gpu' in error_msg or 'memory' in error_msg:
                print(f"[GPU] CUDA error, falling back to CPU: {str(e)[:80]}...")
            # CPU fallback
            return transform_fn(frame.astype(np.float32), np).astype(np.uint8)
    else:
        # CPU fallback
        return transform_fn(frame.astype(np.float32), np).astype(np.uint8)


def _apply_vibrant(video: VideoClip) -> VideoClip:
    """Increase saturation and contrast."""
    def transform(frame, xp):
        gray = xp.mean(frame, axis=2, keepdims=True)
        frame = gray + 1.3 * (frame - gray)
        return xp.clip(frame, 0, 255)

    def process_frame(frame):
        return _gpu_process(frame, transform)

    return video.image_transform(process_frame)


def _apply_cinematic(video: VideoClip) -> VideoClip:
    """Apply cinematic color grading (orange/teal look)."""
    def transform(frame, xp):
        # Lift shadows (blue tint)
        frame[:, :, 0] = xp.clip(frame[:, :, 0] * 0.95, 0, 255)  # Red
        frame[:, :, 2] = xp.clip(frame[:, :, 2] * 1.05, 0, 255)  # Blue
        # Slight desaturation
        gray = xp.mean(frame, axis=2, keepdims=True)
        frame = gray + 0.9 * (frame - gray)
        # Add slight contrast
        frame = (frame - 128) * 1.1 + 128
        return xp.clip(frame, 0, 255)

    def process_frame(frame):
        return _gpu_process(frame, transform)

    return video.image_transform(process_frame)


def _apply_bright(video: VideoClip) -> VideoClip:
    """Brighten the video."""
    def transform(frame, xp):
        frame = frame * 1.1 + 10
        return xp.clip(frame, 0, 255)

    def process_frame(frame):
        return _gpu_process(frame, transform)

    return video.image_transform(process_frame)


def _apply_moody(video: VideoClip) -> VideoClip:
    """Apply moody/dark color grading (low saturation, darker, blue shadows)."""
    def transform(frame, xp):
        # Darken overall
        frame = frame * 0.85
        # Add blue tint to shadows
        frame[:, :, 2] = xp.clip(frame[:, :, 2] * 1.1, 0, 255)
        # Desaturate
        gray = xp.mean(frame, axis=2, keepdims=True)
        frame = gray + 0.7 * (frame - gray)
        # Increase contrast slightly
        frame = (frame - 128) * 1.15 + 128
        return xp.clip(frame, 0, 255)

    def process_frame(frame):
        return _gpu_process(frame, transform)

    return video.image_transform(process_frame)


def _apply_bw(video: VideoClip) -> VideoClip:
    """Convert to black and white."""
    def transform(frame, xp):
        gray = xp.mean(frame, axis=2, keepdims=True)
        return xp.broadcast_to(gray, frame.shape)

    def process_frame(frame):
        return _gpu_process(frame, transform)

    return video.image_transform(process_frame)


def apply_vignette(video: VideoClip, strength: float = 0.3) -> VideoClip:
    """Apply vignette effect."""
    def process_frame(frame):
        h, w = frame.shape[:2]
        # Create vignette mask
        x = np.linspace(-1, 1, w)
        y = np.linspace(-1, 1, h)
        X, Y = np.meshgrid(x, y)
        mask = 1 - strength * (X**2 + Y**2)
        mask = np.clip(mask, 0, 1)
        mask = np.stack([mask] * 3, axis=2)

        frame = frame.astype(np.float32) * mask
        return np.clip(frame, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_film_grain(video: VideoClip, intensity: float = 0.05) -> VideoClip:
    """Apply film grain effect."""
    def process_frame(frame):
        h, w = frame.shape[:2]
        noise = np.random.normal(0, intensity * 255, (h, w, 3))
        frame = frame.astype(np.float32) + noise
        return np.clip(frame, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


# =============================================================================
# IMAGE OVERLAY EFFECTS - AI-selectable visual effects
# =============================================================================

def apply_light_leak(video: VideoClip, style: str = "warm", intensity: float = 0.3, rgb: tuple = None) -> VideoClip:
    """
    Apply light leak effect (film camera light bleeding).

    Args:
        video: Input video clip
        style: "warm" (orange/red), "cool" (blue/purple), "rainbow", "golden" (ignored if rgb provided)
        intensity: Effect strength (0.0 - 1.0)
        rgb: Optional direct RGB tuple (0.0-1.0 normalized), overrides style preset
    """
    # Pre-generate light leak pattern for consistency across frames
    h, w = video.size[1], video.size[0]
    leak_pattern = _generate_light_leak(w, h, style, rgb)

    def process_frame(frame):
        # Additive blend for light leak effect
        result = frame.astype(np.float32) + leak_pattern * intensity * 255
        return np.clip(result, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


def _generate_light_leak(w: int, h: int, style: str, rgb: tuple = None) -> np.ndarray:
    """Generate a light leak pattern."""
    # Create coordinate grids
    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    X, Y = np.meshgrid(x, y)

    # If custom RGB provided, use it for warm-style positioning
    if rgb:
        base_r, base_g, base_b = rgb
        # Create light leak with custom color from top-right
        r = np.exp(-((X - 1.2)**2 + (Y - 0.0)**2) * 2) * base_r
        g = np.exp(-((X - 1.0)**2 + (Y - 0.1)**2) * 2.5) * base_g
        b = np.exp(-((X - 1.1)**2 + (Y - 0.0)**2) * 3) * base_b
    elif style == "warm":
        # Warm orange/red leak from top-right corner
        r = np.exp(-((X - 1.2)**2 + (Y - 0.0)**2) * 2) * 0.8
        g = np.exp(-((X - 1.0)**2 + (Y - 0.1)**2) * 3) * 0.4
        b = np.exp(-((X - 1.1)**2 + (Y - 0.0)**2) * 4) * 0.1
    elif style == "cool":
        # Cool blue/purple leak from bottom-left
        r = np.exp(-((X + 0.2)**2 + (Y - 1.1)**2) * 3) * 0.3
        g = np.exp(-((X + 0.1)**2 + (Y - 1.0)**2) * 2.5) * 0.4
        b = np.exp(-((X + 0.0)**2 + (Y - 1.2)**2) * 2) * 0.8
    elif style == "rainbow":
        # Rainbow gradient leak from top
        r = np.exp(-((X - 0.3)**2 + (Y + 0.3)**2) * 2) * 0.6
        g = np.exp(-((X - 0.5)**2 + (Y + 0.2)**2) * 2) * 0.5
        b = np.exp(-((X - 0.7)**2 + (Y + 0.1)**2) * 2) * 0.6
    else:  # golden
        # Golden hour leak from side
        r = np.exp(-((X - 1.1)**2 * 1.5 + Y**2 * 0.5)) * 0.9
        g = np.exp(-((X - 1.0)**2 * 1.5 + Y**2 * 0.6)) * 0.6
        b = np.exp(-((X - 0.9)**2 * 2 + Y**2 * 0.7)) * 0.2

    return np.stack([r, g, b], axis=2)


def apply_bokeh(video: VideoClip, intensity: float = 0.4, size: str = "medium") -> VideoClip:
    """
    Apply bokeh (light blur circles) overlay effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        size: "small", "medium", "large" - bokeh circle size
    """
    h, w = video.size[1], video.size[0]
    bokeh_pattern = _generate_bokeh(w, h, size)

    def process_frame(frame):
        # Screen blend mode for bokeh
        frame_f = frame.astype(np.float32) / 255.0
        bokeh_f = bokeh_pattern * intensity
        # Screen blend: 1 - (1-a)*(1-b)
        result = 1 - (1 - frame_f) * (1 - bokeh_f)
        return (result * 255).astype(np.uint8)

    return video.image_transform(process_frame)


def _generate_bokeh(w: int, h: int, size: str) -> np.ndarray:
    """Generate bokeh circles pattern."""
    # Size mapping
    size_map = {"small": 15, "medium": 30, "large": 50}
    radius_base = size_map.get(size, 30)

    # Create random bokeh circles
    np.random.seed(42)  # Consistent pattern
    num_circles = 20

    pattern = np.zeros((h, w, 3), dtype=np.float32)

    for _ in range(num_circles):
        cx = np.random.randint(0, w)
        cy = np.random.randint(0, h)
        radius = radius_base + np.random.randint(-10, 20)
        brightness = np.random.uniform(0.2, 0.6)

        # Create soft circle
        y, x = np.ogrid[:h, :w]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)

        # Soft edge circle
        circle = np.clip(1 - dist / radius, 0, 1) ** 2

        # Random warm color tint
        color = np.array([
            0.9 + np.random.uniform(0, 0.1),
            0.7 + np.random.uniform(0, 0.2),
            0.5 + np.random.uniform(0, 0.3)
        ])

        for c in range(3):
            pattern[:, :, c] += circle * brightness * color[c]

    return np.clip(pattern, 0, 1)


def apply_bloom(video: VideoClip, threshold: float = 0.7, intensity: float = 0.5) -> VideoClip:
    """
    Apply bloom/glow effect (bright areas spread light).

    Args:
        video: Input video clip
        threshold: Brightness threshold for bloom (0.0 - 1.0)
        intensity: Bloom strength (0.0 - 1.0)
    """
    from scipy.ndimage import gaussian_filter

    def process_frame(frame):
        frame_f = frame.astype(np.float32) / 255.0

        # Extract bright areas
        luminance = 0.299 * frame_f[:,:,0] + 0.587 * frame_f[:,:,1] + 0.114 * frame_f[:,:,2]
        bright_mask = (luminance > threshold).astype(np.float32)

        # Create bloom by blurring bright areas
        bloom = np.zeros_like(frame_f)
        for c in range(3):
            bright_channel = frame_f[:,:,c] * bright_mask
            bloom[:,:,c] = gaussian_filter(bright_channel, sigma=30)

        # Additive blend
        result = frame_f + bloom * intensity
        return (np.clip(result, 0, 1) * 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_lens_flare(video: VideoClip, position: str = "top_right", intensity: float = 0.4) -> VideoClip:
    """
    Apply lens flare effect.

    Args:
        video: Input video clip
        position: "top_left", "top_right", "center", "bottom_left", "bottom_right"
        intensity: Effect strength (0.0 - 1.0)
    """
    h, w = video.size[1], video.size[0]
    flare_pattern = _generate_lens_flare(w, h, position)

    def process_frame(frame):
        # Additive blend for flare
        result = frame.astype(np.float32) + flare_pattern * intensity * 255
        return np.clip(result, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


def _generate_lens_flare(w: int, h: int, position: str) -> np.ndarray:
    """Generate lens flare pattern."""
    # Position mapping
    positions = {
        "top_left": (0.1, 0.1),
        "top_right": (0.9, 0.1),
        "center": (0.5, 0.5),
        "bottom_left": (0.1, 0.9),
        "bottom_right": (0.9, 0.9),
    }
    px, py = positions.get(position, (0.9, 0.1))

    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    X, Y = np.meshgrid(x, y)

    # Main flare center
    dist = np.sqrt((X - px)**2 + (Y - py)**2)
    main_flare = np.exp(-dist**2 * 20)

    # Lens artifacts (smaller circles along light path)
    artifacts = np.zeros((h, w))
    for i in range(5):
        t = 0.2 + i * 0.15
        ax = px + (0.5 - px) * t
        ay = py + (0.5 - py) * t
        artifact_dist = np.sqrt((X - ax)**2 + (Y - ay)**2)
        artifacts += np.exp(-artifact_dist**2 * 100) * (0.3 - i * 0.05)

    # Combine with color
    r = main_flare * 1.0 + artifacts * 0.9
    g = main_flare * 0.9 + artifacts * 0.7
    b = main_flare * 0.7 + artifacts * 0.5

    return np.stack([r, g, b], axis=2)


def apply_soft_focus(video: VideoClip, intensity: float = 0.3) -> VideoClip:
    """
    Apply soft focus/dreamy effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
    """
    from scipy.ndimage import gaussian_filter

    def process_frame(frame):
        frame_f = frame.astype(np.float32)

        # Create blurred version
        blurred = np.zeros_like(frame_f)
        for c in range(3):
            blurred[:,:,c] = gaussian_filter(frame_f[:,:,c], sigma=10)

        # Blend original with blur
        result = frame_f * (1 - intensity) + blurred * intensity

        # Slight brightness boost for dreamy feel
        result = result * 1.05 + 5

        return np.clip(result, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_dust_particles(video: VideoClip, intensity: float = 0.3, density: str = "medium") -> VideoClip:
    """
    Apply floating dust particles effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        density: "sparse", "medium", "dense"
    """
    h, w = video.size[1], video.size[0]
    duration = video.duration or 10.0

    # Density mapping
    density_map = {"sparse": 30, "medium": 60, "dense": 100}
    num_particles = density_map.get(density, 60)

    # Pre-generate particle positions and properties
    np.random.seed(42)
    particles = []
    for _ in range(num_particles):
        particles.append({
            "x": np.random.uniform(0, 1),
            "y": np.random.uniform(0, 1),
            "size": np.random.uniform(2, 6),
            "speed": np.random.uniform(0.01, 0.03),
            "drift": np.random.uniform(-0.005, 0.005),
            "brightness": np.random.uniform(0.3, 0.8),
        })

    def make_frame(get_frame, t):
        frame = get_frame(t)
        frame_f = frame.astype(np.float32)

        # Create dust layer
        dust = np.zeros((h, w), dtype=np.float32)

        for p in particles:
            # Animate particle position (floating upward with drift)
            px = int((p["x"] + p["drift"] * t) % 1.0 * w)
            py = int((p["y"] - p["speed"] * t) % 1.0 * h)
            size = int(p["size"])

            # Draw soft particle
            y1, y2 = max(0, py - size), min(h, py + size)
            x1, x2 = max(0, px - size), min(w, px + size)

            if y2 > y1 and x2 > x1:
                yy, xx = np.ogrid[y1:y2, x1:x2]
                dist = np.sqrt((xx - px)**2 + (yy - py)**2)
                particle_shape = np.clip(1 - dist / size, 0, 1) * p["brightness"]
                dust[y1:y2, x1:x2] = np.maximum(dust[y1:y2, x1:x2], particle_shape)

        # Screen blend dust onto frame
        dust_rgb = np.stack([dust, dust, dust], axis=2) * intensity * 255
        result = frame_f + dust_rgb * (1 - frame_f / 255)

        return np.clip(result, 0, 255).astype(np.uint8)

    return video.transform(make_frame)


def apply_color_wash(video: VideoClip, color: str = "warm", intensity: float = 0.2, rgb: tuple = None) -> VideoClip:
    """
    Apply color wash/tint overlay effect.

    Args:
        video: Input video clip
        color: "warm", "cool", "purple", "teal", "golden" (ignored if rgb provided)
        intensity: Effect strength (0.0 - 1.0)
        rgb: Optional direct RGB tuple (0.0-1.0 normalized), overrides color preset
    """
    # Use direct RGB if provided, otherwise use preset
    if rgb:
        r, g, b = rgb
    else:
        # Color mapping (RGB normalized)
        colors = {
            "warm": (1.0, 0.8, 0.6),
            "cool": (0.6, 0.8, 1.0),
            "purple": (0.8, 0.6, 1.0),
            "teal": (0.5, 0.9, 0.9),
            "golden": (1.0, 0.9, 0.5),
        }
        r, g, b = colors.get(color, colors["warm"])

    def process_frame(frame):
        frame_f = frame.astype(np.float32) / 255.0

        # Create color overlay
        h, w = frame_f.shape[:2]
        overlay = np.zeros_like(frame_f)
        overlay[:, :, 0] = r
        overlay[:, :, 1] = g
        overlay[:, :, 2] = b

        # Overlay blend mode
        result = frame_f * (1 - intensity) + overlay * intensity + frame_f * overlay * intensity * 0.5

        return (np.clip(result, 0, 1) * 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_sun_rays(video: VideoClip, position: str = "top", intensity: float = 0.4) -> VideoClip:
    """
    Apply sun rays/god rays effect.

    Args:
        video: Input video clip
        position: "top", "top_left", "top_right"
        intensity: Effect strength (0.0 - 1.0)
    """
    h, w = video.size[1], video.size[0]

    # Position mapping
    positions = {
        "top": (0.5, -0.1),
        "top_left": (0.1, -0.1),
        "top_right": (0.9, -0.1),
    }
    px, py = positions.get(position, positions["top"])

    # Pre-generate rays pattern
    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    X, Y = np.meshgrid(x, y)

    # Create radial rays from sun position
    angle = np.arctan2(Y - py, X - px)
    num_rays = 12
    rays = np.abs(np.sin(angle * num_rays)) ** 3

    # Distance falloff from sun
    dist = np.sqrt((X - px)**2 + (Y - py)**2)
    falloff = np.exp(-dist * 1.5)

    # Combine rays with falloff
    ray_pattern = rays * falloff

    # Add warm color tint
    rays_rgb = np.stack([
        ray_pattern * 1.0,   # R
        ray_pattern * 0.9,   # G
        ray_pattern * 0.6,   # B
    ], axis=2)

    def process_frame(frame):
        frame_f = frame.astype(np.float32)
        # Additive blend
        result = frame_f + rays_rgb * intensity * 255
        return np.clip(result, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_sparkle(video: VideoClip, intensity: float = 0.4, density: str = "medium") -> VideoClip:
    """
    Apply sparkle/glitter effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        density: "sparse", "medium", "dense"
    """
    h, w = video.size[1], video.size[0]
    duration = video.duration or 10.0

    # Density mapping
    density_map = {"sparse": 15, "medium": 30, "dense": 50}
    num_sparkles = density_map.get(density, 30)

    # Pre-generate sparkle positions
    np.random.seed(42)
    sparkles = []
    for _ in range(num_sparkles):
        sparkles.append({
            "x": np.random.uniform(0, w),
            "y": np.random.uniform(0, h),
            "phase": np.random.uniform(0, 2 * np.pi),
            "freq": np.random.uniform(2, 5),
            "size": np.random.uniform(3, 8),
        })

    def make_frame(get_frame, t):
        frame = get_frame(t)
        frame_f = frame.astype(np.float32)

        # Create sparkle layer
        sparkle_layer = np.zeros((h, w), dtype=np.float32)

        for s in sparkles:
            # Animated brightness (twinkling)
            brightness = (np.sin(t * s["freq"] + s["phase"]) + 1) / 2
            brightness = brightness ** 2  # Sharper peaks

            if brightness > 0.3:  # Only draw bright sparkles
                px, py = int(s["x"]), int(s["y"])
                size = int(s["size"])

                # Draw star shape
                y1, y2 = max(0, py - size), min(h, py + size)
                x1, x2 = max(0, px - size), min(w, px + size)

                if y2 > y1 and x2 > x1:
                    yy, xx = np.ogrid[y1:y2, x1:x2]
                    # 4-pointed star
                    dist_x = np.abs(xx - px)
                    dist_y = np.abs(yy - py)
                    star = np.maximum(
                        np.clip(1 - dist_x / size, 0, 1) * np.clip(1 - dist_y / (size * 0.3), 0, 1),
                        np.clip(1 - dist_x / (size * 0.3), 0, 1) * np.clip(1 - dist_y / size, 0, 1)
                    )
                    sparkle_layer[y1:y2, x1:x2] = np.maximum(
                        sparkle_layer[y1:y2, x1:x2],
                        star * brightness
                    )

        # Screen blend
        sparkle_rgb = np.stack([sparkle_layer, sparkle_layer, sparkle_layer], axis=2)
        frame_norm = frame_f / 255.0
        result = 1 - (1 - frame_norm) * (1 - sparkle_rgb * intensity)

        return (result * 255).astype(np.uint8)

    return video.transform(make_frame)


def apply_anamorphic(video: VideoClip, intensity: float = 0.4, position: str = "center") -> VideoClip:
    """
    Apply anamorphic lens flare effect (horizontal streak).

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        position: "center", "top", "bottom"
    """
    h, w = video.size[1], video.size[0]

    # Position mapping
    y_positions = {"center": 0.5, "top": 0.3, "bottom": 0.7}
    py = y_positions.get(position, 0.5)

    # Create horizontal streak pattern
    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    X, Y = np.meshgrid(x, y)

    # Horizontal streak (very wide, narrow vertical)
    vertical_falloff = np.exp(-((Y - py) ** 2) * 100)
    horizontal_glow = np.exp(-((X - 0.5) ** 2) * 0.5)

    streak = vertical_falloff * horizontal_glow

    # Blue tint for anamorphic look
    streak_rgb = np.stack([
        streak * 0.7,   # R (less)
        streak * 0.8,   # G
        streak * 1.0,   # B (more)
    ], axis=2)

    def process_frame(frame):
        frame_f = frame.astype(np.float32)
        # Additive blend
        result = frame_f + streak_rgb * intensity * 255
        return np.clip(result, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_moody_shadow(video: VideoClip, intensity: float = 0.3, position: str = "bottom") -> VideoClip:
    """
    Apply moody shadow/darkness effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        position: "bottom", "edges", "top"
    """
    h, w = video.size[1], video.size[0]

    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    X, Y = np.meshgrid(x, y)

    if position == "bottom":
        # Shadow from bottom
        shadow = Y ** 2
    elif position == "edges":
        # Shadow from all edges
        edge_x = 4 * X * (1 - X)  # 0 at edges, 1 in center
        edge_y = 4 * Y * (1 - Y)
        shadow = 1 - edge_x * edge_y
    else:  # top
        shadow = (1 - Y) ** 2

    # Apply shadow with blue tint for moodiness
    shadow_mask = np.stack([shadow, shadow, shadow], axis=2)

    def process_frame(frame):
        frame_f = frame.astype(np.float32)
        # Darken with shadow
        darkened = frame_f * (1 - shadow_mask * intensity * 0.7)
        # Add slight blue tint to shadows
        darkened[:, :, 2] = darkened[:, :, 2] + shadow_mask[:, :, 0] * intensity * 20
        return np.clip(darkened, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_chromatic(video: VideoClip, intensity: float = 0.3, direction: str = "horizontal") -> VideoClip:
    """
    Apply chromatic aberration effect (RGB channel separation).

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        direction: "horizontal", "radial"
    """
    h, w = video.size[1], video.size[0]

    def process_frame(frame):
        # Calculate pixel shift based on intensity
        shift = int(intensity * 10)
        if shift < 1:
            return frame

        result = np.zeros_like(frame)

        if direction == "horizontal":
            # Horizontal RGB separation
            result[:, shift:, 0] = frame[:, :-shift, 0]  # R shifted right
            result[:, :, 1] = frame[:, :, 1]              # G center
            result[:, :-shift, 2] = frame[:, shift:, 2]  # B shifted left
        else:  # radial
            # Simplified radial - shift from center
            cx, cy = w // 2, h // 2

            # Create coordinate grids
            yy, xx = np.ogrid[:h, :w]
            dist_from_center = np.sqrt((xx - cx)**2 + (yy - cy)**2)
            max_dist = np.sqrt(cx**2 + cy**2)

            # Normalized radial factor
            radial_factor = (dist_from_center / max_dist) * shift

            # Shift channels radially (simplified approach)
            for c in range(3):
                channel_shift = int(radial_factor.mean() * (c - 1))
                if channel_shift != 0:
                    if channel_shift > 0:
                        result[:, channel_shift:, c] = frame[:, :-channel_shift, c]
                    else:
                        result[:, :channel_shift, c] = frame[:, -channel_shift:, c]
                else:
                    result[:, :, c] = frame[:, :, c]

        return result

    return video.image_transform(process_frame)


def apply_prism(video: VideoClip, intensity: float = 0.3, position: str = "edge") -> VideoClip:
    """
    Apply prism light dispersion effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        position: "edge", "diagonal", "corner"
    """
    h, w = video.size[1], video.size[0]

    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    X, Y = np.meshgrid(x, y)

    if position == "edge":
        # Rainbow along right edge
        rainbow_mask = np.exp(-((X - 1.1) ** 2) * 5)
        gradient = Y
    elif position == "diagonal":
        # Rainbow along diagonal
        rainbow_mask = np.exp(-(((X + Y - 1.5) / 1.414) ** 2) * 3)
        gradient = (X + Y) / 2
    else:  # corner
        # Rainbow from corner
        dist = np.sqrt((X - 1)**2 + Y**2)
        rainbow_mask = np.exp(-dist * 3)
        gradient = np.arctan2(Y, X - 1) / np.pi

    # Create rainbow colors based on gradient
    rainbow = np.zeros((h, w, 3))
    rainbow[:, :, 0] = np.sin(gradient * 2 * np.pi + 0) ** 2        # R
    rainbow[:, :, 1] = np.sin(gradient * 2 * np.pi + 2.09) ** 2    # G
    rainbow[:, :, 2] = np.sin(gradient * 2 * np.pi + 4.19) ** 2    # B

    # Apply mask
    prism_effect = rainbow * rainbow_mask[:, :, np.newaxis]

    def process_frame(frame):
        frame_f = frame.astype(np.float32)
        # Screen blend
        frame_norm = frame_f / 255.0
        result = 1 - (1 - frame_norm) * (1 - prism_effect * intensity)
        return (result * 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_haze(video: VideoClip, intensity: float = 0.3, color: str = "white") -> VideoClip:
    """
    Apply haze/fog effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        color: "white", "warm", "cool"
    """
    from scipy.ndimage import gaussian_filter

    # Haze color
    colors = {
        "white": (1.0, 1.0, 1.0),
        "warm": (1.0, 0.95, 0.9),
        "cool": (0.9, 0.95, 1.0),
    }
    haze_color = np.array(colors.get(color, colors["white"]))

    def process_frame(frame):
        frame_f = frame.astype(np.float32) / 255.0
        h, w = frame_f.shape[:2]

        # Create depth-like haze (heavier at edges/top)
        y = np.linspace(0, 1, h)[:, np.newaxis]
        haze_density = 0.3 + 0.7 * (1 - y)  # More haze at top

        # Slight blur for fog effect
        blurred = np.zeros_like(frame_f)
        for c in range(3):
            blurred[:,:,c] = gaussian_filter(frame_f[:,:,c], sigma=5)

        # Create haze layer
        haze = np.ones_like(frame_f) * haze_color

        # Blend: original → blurred → haze
        haze_amount = intensity * haze_density
        result = frame_f * (1 - haze_amount * 0.5) + blurred * haze_amount * 0.3 + haze * haze_amount * 0.2

        return (np.clip(result, 0, 1) * 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_vintage_fade(video: VideoClip, intensity: float = 0.3, style: str = "sepia") -> VideoClip:
    """
    Apply vintage fade effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        style: "sepia", "faded", "polaroid"
    """
    def process_frame(frame):
        frame_f = frame.astype(np.float32) / 255.0

        if style == "sepia":
            # Sepia tone matrix
            sepia = np.array([
                [0.393, 0.769, 0.189],
                [0.349, 0.686, 0.168],
                [0.272, 0.534, 0.131]
            ])
            tinted = np.dot(frame_f, sepia.T)
            result = frame_f * (1 - intensity) + tinted * intensity

        elif style == "faded":
            # Lift blacks, lower contrast
            result = frame_f * (1 - intensity * 0.3) + intensity * 0.15
            # Slight desaturation
            gray = np.mean(result, axis=2, keepdims=True)
            result = gray + (result - gray) * (1 - intensity * 0.4)

        else:  # polaroid
            # Polaroid look: slight green tint, faded blacks, warm highlights
            result = frame_f.copy()
            result[:, :, 0] = result[:, :, 0] * (1 + intensity * 0.1)  # Slight red boost
            result[:, :, 1] = result[:, :, 1] * (1 + intensity * 0.05)  # Slight green
            result[:, :, 2] = result[:, :, 2] * (1 - intensity * 0.1)  # Reduce blue
            # Lift blacks
            result = result * (1 - intensity * 0.2) + intensity * 0.1

        return (np.clip(result, 0, 1) * 255).astype(np.uint8)

    return video.image_transform(process_frame)


def apply_light_streak(video: VideoClip, intensity: float = 0.4, angle: str = "diagonal") -> VideoClip:
    """
    Apply light streak effect.

    Args:
        video: Input video clip
        intensity: Effect strength (0.0 - 1.0)
        angle: "diagonal", "horizontal", "vertical"
    """
    h, w = video.size[1], video.size[0]

    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    X, Y = np.meshgrid(x, y)

    if angle == "diagonal":
        # Diagonal streak from top-left to bottom-right
        streak_pos = (X + Y) / 2
        streak = np.exp(-((streak_pos - 0.5) ** 2) * 20) * np.exp(-((X - Y) ** 2) * 50)
    elif angle == "horizontal":
        # Horizontal streak
        streak = np.exp(-((Y - 0.5) ** 2) * 30)
    else:  # vertical
        # Vertical streak
        streak = np.exp(-((X - 0.5) ** 2) * 30)

    # Warm light color
    streak_rgb = np.stack([
        streak * 1.0,
        streak * 0.9,
        streak * 0.7,
    ], axis=2)

    def process_frame(frame):
        frame_f = frame.astype(np.float32)
        # Additive blend
        result = frame_f + streak_rgb * intensity * 200
        return np.clip(result, 0, 255).astype(np.uint8)

    return video.image_transform(process_frame)


# =============================================================================
# OVERLAY EFFECT REGISTRY - for AI selection
# =============================================================================

OVERLAY_EFFECTS = {
    # Light leak variants
    "light_leak_warm": lambda v, i=0.3: apply_light_leak(v, "warm", i),
    "light_leak_cool": lambda v, i=0.3: apply_light_leak(v, "cool", i),
    "light_leak_rainbow": lambda v, i=0.25: apply_light_leak(v, "rainbow", i),
    "light_leak_golden": lambda v, i=0.35: apply_light_leak(v, "golden", i),
    # Bokeh variants
    "bokeh_small": lambda v, i=0.4: apply_bokeh(v, i, "small"),
    "bokeh_medium": lambda v, i=0.4: apply_bokeh(v, i, "medium"),
    "bokeh_large": lambda v, i=0.35: apply_bokeh(v, i, "large"),
    # Bloom variants
    "bloom": lambda v, i=0.5: apply_bloom(v, 0.7, i),
    "bloom_strong": lambda v, i=0.7: apply_bloom(v, 0.6, i),
    # Lens flare variants
    "lens_flare_top": lambda v, i=0.4: apply_lens_flare(v, "top_right", i),
    "lens_flare_center": lambda v, i=0.3: apply_lens_flare(v, "center", i),
    # Soft focus variants
    "soft_focus": lambda v, i=0.3: apply_soft_focus(v, i),
    "soft_focus_strong": lambda v, i=0.5: apply_soft_focus(v, i),
    # Vignette variants
    "vignette": lambda v, i=0.3: apply_vignette(v, i),
    "vignette_strong": lambda v, i=0.5: apply_vignette(v, i),
    # Film grain variants
    "film_grain": lambda v, i=0.05: apply_film_grain(v, i),
    "film_grain_heavy": lambda v, i=0.1: apply_film_grain(v, i),
    # Dust particles variants
    "dust_particles_sparse": lambda v, i=0.3: apply_dust_particles(v, i, "sparse"),
    "dust_particles": lambda v, i=0.3: apply_dust_particles(v, i, "medium"),
    "dust_particles_dense": lambda v, i=0.4: apply_dust_particles(v, i, "dense"),
    # Color wash variants
    "color_wash_warm": lambda v, i=0.2: apply_color_wash(v, "warm", i),
    "color_wash_cool": lambda v, i=0.2: apply_color_wash(v, "cool", i),
    "color_wash_purple": lambda v, i=0.2: apply_color_wash(v, "purple", i),
    "color_wash_teal": lambda v, i=0.2: apply_color_wash(v, "teal", i),
    "color_wash_golden": lambda v, i=0.2: apply_color_wash(v, "golden", i),
    # Sun rays variants
    "sun_rays_top": lambda v, i=0.4: apply_sun_rays(v, "top", i),
    "sun_rays_left": lambda v, i=0.4: apply_sun_rays(v, "top_left", i),
    "sun_rays_right": lambda v, i=0.4: apply_sun_rays(v, "top_right", i),
    # Sparkle variants
    "sparkle_sparse": lambda v, i=0.4: apply_sparkle(v, i, "sparse"),
    "sparkle": lambda v, i=0.4: apply_sparkle(v, i, "medium"),
    "sparkle_dense": lambda v, i=0.5: apply_sparkle(v, i, "dense"),
    # Anamorphic lens flare variants
    "anamorphic_center": lambda v, i=0.4: apply_anamorphic(v, i, "center"),
    "anamorphic_top": lambda v, i=0.4: apply_anamorphic(v, i, "top"),
    "anamorphic_bottom": lambda v, i=0.4: apply_anamorphic(v, i, "bottom"),
    # Moody shadow variants
    "moody_shadow_bottom": lambda v, i=0.3: apply_moody_shadow(v, i, "bottom"),
    "moody_shadow_edges": lambda v, i=0.3: apply_moody_shadow(v, i, "edges"),
    "moody_shadow_top": lambda v, i=0.3: apply_moody_shadow(v, i, "top"),
    # Chromatic aberration variants
    "chromatic_horizontal": lambda v, i=0.3: apply_chromatic(v, i, "horizontal"),
    "chromatic_radial": lambda v, i=0.3: apply_chromatic(v, i, "radial"),
    # Prism variants
    "prism_edge": lambda v, i=0.3: apply_prism(v, i, "edge"),
    "prism_diagonal": lambda v, i=0.3: apply_prism(v, i, "diagonal"),
    "prism_corner": lambda v, i=0.3: apply_prism(v, i, "corner"),
    # Haze variants
    "haze_white": lambda v, i=0.3: apply_haze(v, i, "white"),
    "haze_warm": lambda v, i=0.3: apply_haze(v, i, "warm"),
    "haze_cool": lambda v, i=0.3: apply_haze(v, i, "cool"),
    # Vintage fade variants
    "vintage_sepia": lambda v, i=0.3: apply_vintage_fade(v, i, "sepia"),
    "vintage_faded": lambda v, i=0.3: apply_vintage_fade(v, i, "faded"),
    "vintage_polaroid": lambda v, i=0.3: apply_vintage_fade(v, i, "polaroid"),
    # Light streak variants
    "light_streak_diagonal": lambda v, i=0.4: apply_light_streak(v, i, "diagonal"),
    "light_streak_horizontal": lambda v, i=0.4: apply_light_streak(v, i, "horizontal"),
    "light_streak_vertical": lambda v, i=0.4: apply_light_streak(v, i, "vertical"),
    # Filter effects (color grading as overlay)
    "filter_vibrant": lambda v, i=0.3: apply_color_wash(v, "warm", i * 0.5),  # Subtle warm vibrant effect
    "filter_bright": lambda v, i=0.2: apply_haze(v, i * 0.3, "white"),  # Subtle brightening
    "filter_moody": lambda v, i=0.3: apply_moody_shadow(v, i, "edges"),  # Moody shadow edges
}


# =============================================================================
# DYNAMIC OVERLAY PARAMETER SELECTION - based on mood/audio analysis
# =============================================================================

# Mood-to-color temperature mapping
WARM_MOODS = {"romantic", "warm", "nostalgic", "hopeful", "inspiring", "playful", "energetic"}
COOL_MOODS = {"mysterious", "calm", "ethereal", "modern", "professional", "dark", "dramatic"}
VIBRANT_MOODS = {"energetic", "playful", "magical", "glamorous", "exciting", "dynamic"}

# Overlay type to variant mapping based on mood analysis
OVERLAY_VARIANT_MAP = {
    "light_leak": {
        "warm": ["light_leak_warm", "light_leak_golden"],
        "cool": ["light_leak_cool"],
        "vibrant": ["light_leak_rainbow"],
        "default": ["light_leak_warm"],
    },
    "bokeh": {
        "high": ["bokeh_small"],       # Fast/energetic → small quick bokeh
        "medium": ["bokeh_medium"],
        "low": ["bokeh_large"],        # Calm/slow → large soft bokeh
        "default": ["bokeh_medium"],
    },
    "bloom": {
        "high": ["bloom_strong"],
        "medium": ["bloom"],
        "low": ["bloom"],
        "default": ["bloom"],
    },
    "lens_flare": {
        "high": ["lens_flare_center"],   # Energetic → center flare
        "medium": ["lens_flare_top"],
        "low": ["lens_flare_top"],
        "default": ["lens_flare_top"],
    },
    "soft_focus": {
        "high": ["soft_focus"],
        "medium": ["soft_focus"],
        "low": ["soft_focus_strong"],    # Calm → stronger soft focus
        "default": ["soft_focus"],
    },
    "vignette": {
        "high": ["vignette_strong"],     # Dramatic → strong vignette
        "medium": ["vignette"],
        "low": ["vignette"],
        "default": ["vignette"],
    },
    "film_grain": {
        "high": ["film_grain_heavy"],
        "medium": ["film_grain"],
        "low": ["film_grain"],
        "default": ["film_grain"],
    },
    # === NEW OVERLAY MAPPINGS ===
    "dust_particles": {
        "high": ["dust_particles_dense"],    # Fast → more visible particles
        "medium": ["dust_particles"],
        "low": ["dust_particles_sparse"],    # Calm → subtle sparse particles
        "default": ["dust_particles"],
    },
    "color_wash": {
        "warm": ["color_wash_warm", "color_wash_golden"],
        "cool": ["color_wash_cool", "color_wash_teal"],
        "vibrant": ["color_wash_purple"],
        "default": ["color_wash_warm"],
    },
    "sun_rays": {
        "high": ["sun_rays_top", "sun_rays_left", "sun_rays_right"],
        "medium": ["sun_rays_top"],
        "low": ["sun_rays_top"],
        "default": ["sun_rays_top"],
    },
    "sparkle": {
        "high": ["sparkle_dense"],           # Energetic → lots of sparkles
        "medium": ["sparkle"],
        "low": ["sparkle_sparse"],           # Calm → subtle sparkles
        "default": ["sparkle"],
    },
    "anamorphic": {
        "high": ["anamorphic_center"],       # Dramatic center flare
        "medium": ["anamorphic_center", "anamorphic_top"],
        "low": ["anamorphic_top", "anamorphic_bottom"],
        "default": ["anamorphic_center"],
    },
    "moody_shadow": {
        "high": ["moody_shadow_edges"],      # Dramatic → strong edge shadows
        "medium": ["moody_shadow_bottom"],
        "low": ["moody_shadow_bottom"],
        "default": ["moody_shadow_bottom"],
    },
    "chromatic": {
        "high": ["chromatic_radial"],        # High energy → radial distortion
        "medium": ["chromatic_horizontal"],
        "low": ["chromatic_horizontal"],
        "default": ["chromatic_horizontal"],
    },
    "prism": {
        "warm": ["prism_corner"],
        "cool": ["prism_edge"],
        "vibrant": ["prism_diagonal", "prism_corner"],
        "default": ["prism_edge"],
    },
    "haze": {
        "warm": ["haze_warm"],
        "cool": ["haze_cool"],
        "vibrant": ["haze_white"],
        "default": ["haze_white"],
    },
    "vintage_fade": {
        "warm": ["vintage_sepia", "vintage_polaroid"],
        "cool": ["vintage_faded"],
        "vibrant": ["vintage_polaroid"],
        "default": ["vintage_faded"],
    },
    "light_streak": {
        "high": ["light_streak_diagonal"],   # Dynamic diagonal
        "medium": ["light_streak_horizontal", "light_streak_diagonal"],
        "low": ["light_streak_horizontal"],  # Calm horizontal
        "default": ["light_streak_diagonal"],
    },
}

# Intensity multipliers based on BPM
def get_intensity_from_bpm(bpm: int | None) -> float:
    """Calculate intensity multiplier based on BPM."""
    if bpm is None:
        return 1.0
    if bpm >= 140:
        return 1.3  # High energy → stronger effects
    elif bpm >= 120:
        return 1.15
    elif bpm >= 100:
        return 1.0
    elif bpm >= 80:
        return 0.85
    else:
        return 0.7  # Slow → subtler effects


def get_color_temperature(moods: list[str]) -> str:
    """Determine color temperature based on moods."""
    mood_set = set(m.lower() for m in moods)

    # Count matches for each temperature
    warm_count = len(mood_set & WARM_MOODS)
    cool_count = len(mood_set & COOL_MOODS)
    vibrant_count = len(mood_set & VIBRANT_MOODS)

    # Determine dominant temperature
    if vibrant_count > 0 and vibrant_count >= warm_count and vibrant_count >= cool_count:
        return "vibrant"
    elif warm_count > cool_count:
        return "warm"
    elif cool_count > warm_count:
        return "cool"
    else:
        return "warm"  # Default to warm


def resolve_overlay_variant(
    overlay_type: str,
    moods: list[str] | None = None,
    intensity: str = "medium",
    bpm: int | None = None,
) -> tuple[str, float]:
    """
    Resolve a generic overlay type to a specific variant based on mood/audio analysis.

    Args:
        overlay_type: Generic overlay type (e.g., "light_leak", "bokeh")
        moods: List of detected moods from analysis
        intensity: Intensity level ("low", "medium", "high")
        bpm: Audio BPM (optional)

    Returns:
        Tuple of (specific_effect_id, intensity_multiplier)
    """
    import random

    moods = moods or []
    intensity = intensity.lower() if intensity else "medium"

    # Get variant map for this overlay type
    variant_map = OVERLAY_VARIANT_MAP.get(overlay_type, {})

    if not variant_map:
        # Unknown overlay type, try direct lookup
        return overlay_type, get_intensity_from_bpm(bpm)

    # Overlays that use color temperature for variant selection
    COLOR_BASED_OVERLAYS = {"light_leak", "color_wash", "prism", "haze", "vintage_fade"}

    # Determine which variant to use based on overlay type
    if overlay_type in COLOR_BASED_OVERLAYS:
        # Color-based selection for these overlays
        temperature = get_color_temperature(moods)
        variants = variant_map.get(temperature, variant_map.get("default", [overlay_type]))
    else:
        # Intensity-based selection for other overlays
        variants = variant_map.get(intensity, variant_map.get("default", [overlay_type]))

    # Pick a variant (random for variety if multiple options)
    selected = random.choice(variants) if variants else overlay_type

    # Calculate intensity multiplier
    intensity_mult = get_intensity_from_bpm(bpm)

    return selected, intensity_mult


def get_overlay_effect(effect_id: str):
    """Get an overlay effect function by ID."""
    return OVERLAY_EFFECTS.get(effect_id)


def apply_overlay_effects(video: VideoClip, effect_ids: list, intensity: float = 1.0) -> VideoClip:
    """
    Apply multiple overlay effects to a video clip.

    Args:
        video: Input video clip
        effect_ids: List of effect IDs to apply
        intensity: Global intensity multiplier
    """
    result = video
    for effect_id in effect_ids:
        effect_fn = OVERLAY_EFFECTS.get(effect_id)
        if effect_fn:
            result = effect_fn(result, intensity)
    return result


def apply_overlay_effects_dynamic(
    video: VideoClip,
    overlay_types: list[str],
    moods: list[str] | None = None,
    intensity: str = "medium",
    bpm: int | None = None,
    suggested_colors: dict | None = None,
) -> VideoClip:
    """
    Apply overlay effects with dynamic parameter selection based on mood/audio.

    Args:
        video: Input video clip
        overlay_types: List of generic overlay types (e.g., ["light_leak", "bokeh"])
        moods: List of detected moods from analysis
        intensity: Intensity level ("low", "medium", "high")
        bpm: Audio BPM for intensity adjustment
        suggested_colors: Optional dict with AI-suggested colors {"primary": "#HEX", "secondary": "#HEX", "accent": "#HEX"}

    Returns:
        Video with dynamically-configured overlay effects applied
    """
    import logging
    logger = logging.getLogger(__name__)

    result = video
    applied_effects = []

    # Parse suggested colors to RGB tuples if provided
    ai_colors = None
    if suggested_colors:
        ai_colors = _parse_suggested_colors(suggested_colors)
        logger.info(f"Using AI-suggested colors: primary={suggested_colors.get('primary')}, secondary={suggested_colors.get('secondary')}")

    # Overlays that support dynamic AI colors
    COLOR_DYNAMIC_OVERLAYS = {"light_leak", "color_wash"}

    for overlay_type in overlay_types:
        # Resolve generic type to specific variant
        specific_id, intensity_mult = resolve_overlay_variant(
            overlay_type, moods, intensity, bpm
        )

        # Check if this overlay supports dynamic colors and we have AI colors
        if ai_colors and overlay_type in COLOR_DYNAMIC_OVERLAYS:
            # Apply with AI-suggested color instead of preset
            result = _apply_overlay_with_dynamic_color(
                result, overlay_type, intensity_mult, ai_colors
            )
            applied_effects.append(f"{overlay_type}_dynamic(x{intensity_mult:.2f}, color={suggested_colors.get('primary')})")
        else:
            # Use standard preset-based effect
            effect_fn = OVERLAY_EFFECTS.get(specific_id)
            if effect_fn:
                result = effect_fn(result, intensity_mult)
                applied_effects.append(f"{specific_id}(x{intensity_mult:.2f})")
            else:
                logger.warning(f"Overlay effect not found: {specific_id} (from {overlay_type})")

    if applied_effects:
        logger.info(f"Applied dynamic overlays: {', '.join(applied_effects)}")

    return result


def _parse_suggested_colors(suggested_colors: dict) -> dict:
    """Parse hex color strings to normalized RGB tuples."""
    def hex_to_rgb(hex_color: str) -> tuple:
        hex_color = hex_color.lstrip("#")
        return (
            int(hex_color[0:2], 16) / 255.0,
            int(hex_color[2:4], 16) / 255.0,
            int(hex_color[4:6], 16) / 255.0,
        )

    result = {}
    for key in ["primary", "secondary", "accent"]:
        if key in suggested_colors and suggested_colors[key]:
            try:
                result[key] = hex_to_rgb(suggested_colors[key])
            except (ValueError, IndexError):
                pass
    return result


def _apply_overlay_with_dynamic_color(
    video: VideoClip,
    overlay_type: str,
    intensity: float,
    ai_colors: dict,
) -> VideoClip:
    """Apply overlay effect with AI-suggested dynamic color."""
    # Use primary color for main effect, secondary for blending
    primary_rgb = ai_colors.get("primary", (1.0, 0.6, 0.3))

    if overlay_type == "light_leak":
        return apply_light_leak(video, style="warm", intensity=intensity * 0.3, rgb=primary_rgb)
    elif overlay_type == "color_wash":
        return apply_color_wash(video, color="warm", intensity=intensity * 0.2, rgb=primary_rgb)
    else:
        # Fallback to standard effect
        effect_fn = OVERLAY_EFFECTS.get(overlay_type)
        if effect_fn:
            return effect_fn(video, intensity)
        return video
