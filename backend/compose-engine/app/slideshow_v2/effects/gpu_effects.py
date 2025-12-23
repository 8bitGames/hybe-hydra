"""
GPU-Accelerated Effects for Slideshow V2.

Uses CuPy for GPU-accelerated image processing when available,
with NumPy fallback for CPU-only environments.

Effects include:
- Color grading
- Vignette
- Film grain
- Beat flash
- Glow/bloom
- Motion blur
"""

import logging
from typing import Optional, Tuple, Dict, Any, List
import numpy as np
from functools import lru_cache

logger = logging.getLogger(__name__)

# Try to import CuPy for GPU acceleration
try:
    import cupy as cp
    GPU_AVAILABLE = True
    logger.info("CuPy available - GPU acceleration enabled")
except ImportError:
    cp = None
    GPU_AVAILABLE = False
    logger.info("CuPy not available - using CPU fallback")


def get_array_module():
    """Get the appropriate array module (cupy or numpy)."""
    return cp if GPU_AVAILABLE else np


def to_gpu(array: np.ndarray):
    """Move array to GPU if available."""
    if GPU_AVAILABLE and not isinstance(array, cp.ndarray):
        return cp.asarray(array)
    return array


def to_cpu(array) -> np.ndarray:
    """Move array to CPU if on GPU."""
    if GPU_AVAILABLE and isinstance(array, cp.ndarray):
        return cp.asnumpy(array)
    return array


class GPUEffects:
    """
    GPU-accelerated visual effects processor.

    Automatically uses GPU if available, falls back to CPU otherwise.
    All methods accept numpy arrays and return numpy arrays.
    """

    def __init__(self):
        self.xp = get_array_module()
        self._vignette_cache: Dict[Tuple[int, int, float], Any] = {}
        self._grain_seed = 42

    # =========================================================================
    # Color Grading
    # =========================================================================

    def apply_color_grade(
        self,
        frame: np.ndarray,
        grade_name: str,
        intensity: float = 1.0,
    ) -> np.ndarray:
        """
        Apply color grading to a frame.

        Args:
            frame: RGB image (H, W, 3) as uint8
            grade_name: Name of the color grade
            intensity: Effect intensity (0-1)

        Returns:
            Color-graded frame
        """
        if grade_name == "natural" or intensity == 0:
            return frame

        xp = self.xp
        f = to_gpu(frame.astype(np.float32) / 255.0)

        # Apply specific grade
        if grade_name == "vibrant":
            f = self._grade_vibrant(f, intensity)
        elif grade_name == "cinematic":
            f = self._grade_cinematic(f, intensity)
        elif grade_name == "moody":
            f = self._grade_moody(f, intensity)
        elif grade_name == "bright":
            f = self._grade_bright(f, intensity)
        elif grade_name == "warm":
            f = self._grade_warm(f, intensity)
        elif grade_name == "cool":
            f = self._grade_cool(f, intensity)
        elif grade_name == "vintage":
            f = self._grade_vintage(f, intensity)
        elif grade_name == "bw":
            f = self._grade_bw(f, intensity)
        elif grade_name == "neon":
            f = self._grade_neon(f, intensity)
        elif grade_name == "pastel":
            f = self._grade_pastel(f, intensity)
        elif grade_name == "dramatic":
            f = self._grade_dramatic(f, intensity)
        elif grade_name == "golden_hour":
            f = self._grade_golden_hour(f, intensity)
        elif grade_name == "moonlight":
            f = self._grade_moonlight(f, intensity)
        else:
            logger.warning(f"Unknown color grade: {grade_name}")

        # Clamp and convert back
        f = xp.clip(f, 0, 1)
        result = (f * 255).astype(xp.uint8)
        return to_cpu(result)

    def _grade_vibrant(self, f, intensity: float):
        """Saturated, punchy colors."""
        xp = self.xp
        # Increase saturation
        gray = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        gray = gray[:, :, xp.newaxis]
        sat_factor = 1.0 + 0.4 * intensity
        f = gray + (f - gray) * sat_factor
        # Increase contrast
        f = (f - 0.5) * (1 + 0.1 * intensity) + 0.5
        return f

    def _grade_cinematic(self, f, intensity: float):
        """Orange/teal film look."""
        xp = self.xp
        # Orange in highlights, teal in shadows
        luminance = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]

        # Shadows -> teal
        shadow_mask = (1 - luminance) ** 2
        f[:, :, 0] = f[:, :, 0] - 0.1 * intensity * shadow_mask  # Less red
        f[:, :, 2] = f[:, :, 2] + 0.1 * intensity * shadow_mask  # More blue

        # Highlights -> orange
        highlight_mask = luminance ** 2
        f[:, :, 0] = f[:, :, 0] + 0.1 * intensity * highlight_mask  # More red
        f[:, :, 1] = f[:, :, 1] + 0.05 * intensity * highlight_mask  # Slight green
        f[:, :, 2] = f[:, :, 2] - 0.05 * intensity * highlight_mask  # Less blue

        return f

    def _grade_moody(self, f, intensity: float):
        """Dark, desaturated look."""
        xp = self.xp
        # Desaturate
        gray = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        gray = gray[:, :, xp.newaxis]
        f = f * (1 - 0.3 * intensity) + gray * 0.3 * intensity
        # Darken
        f = f * (1 - 0.05 * intensity)
        # Increase contrast in shadows
        f = xp.where(f < 0.5, f * (1 - 0.1 * intensity), f)
        return f

    def _grade_bright(self, f, intensity: float):
        """High key, airy look."""
        xp = self.xp
        # Lift shadows
        f = f + 0.1 * intensity * (1 - f)
        # Slight desaturation
        gray = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        gray = gray[:, :, xp.newaxis]
        f = f * (1 - 0.1 * intensity) + gray * 0.1 * intensity
        return f

    def _grade_warm(self, f, intensity: float):
        """Warm orange tones."""
        xp = self.xp
        f[:, :, 0] = f[:, :, 0] + 0.1 * intensity  # More red
        f[:, :, 1] = f[:, :, 1] + 0.05 * intensity  # Slight green
        f[:, :, 2] = f[:, :, 2] - 0.1 * intensity  # Less blue
        return f

    def _grade_cool(self, f, intensity: float):
        """Cool blue tones."""
        xp = self.xp
        f[:, :, 0] = f[:, :, 0] - 0.1 * intensity  # Less red
        f[:, :, 2] = f[:, :, 2] + 0.15 * intensity  # More blue
        return f

    def _grade_vintage(self, f, intensity: float):
        """Faded retro look."""
        xp = self.xp
        # Lift blacks
        f = f * (1 - 0.05 * intensity) + 0.05 * intensity
        # Slight color shift
        f[:, :, 0] = f[:, :, 0] + 0.03 * intensity  # Warm shadows
        f[:, :, 2] = f[:, :, 2] - 0.02 * intensity
        # Desaturate
        gray = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        gray = gray[:, :, xp.newaxis]
        f = f * (1 - 0.15 * intensity) + gray * 0.15 * intensity
        return f

    def _grade_bw(self, f, intensity: float):
        """Black and white."""
        xp = self.xp
        gray = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        gray = gray[:, :, xp.newaxis]
        f = f * (1 - intensity) + xp.repeat(gray, 3, axis=2) * intensity
        # Increase contrast
        f = (f - 0.5) * (1 + 0.1 * intensity) + 0.5
        return f

    def _grade_neon(self, f, intensity: float):
        """High contrast neon look."""
        xp = self.xp
        # High saturation
        gray = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        gray = gray[:, :, xp.newaxis]
        f = gray + (f - gray) * (1 + 0.8 * intensity)
        # High contrast
        f = (f - 0.5) * (1 + 0.3 * intensity) + 0.5
        return f

    def _grade_pastel(self, f, intensity: float):
        """Soft pastel colors."""
        xp = self.xp
        # Desaturate
        gray = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        gray = gray[:, :, xp.newaxis]
        f = f * (1 - 0.4 * intensity) + gray * 0.4 * intensity
        # Lift overall
        f = f + 0.1 * intensity * (1 - f)
        return f

    def _grade_dramatic(self, f, intensity: float):
        """High contrast dramatic look."""
        xp = self.xp
        # S-curve for contrast
        f = xp.where(
            f < 0.5,
            f * (1 - 0.2 * intensity),
            1 - (1 - f) * (1 - 0.2 * intensity)
        )
        # Slight saturation boost
        gray = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        gray = gray[:, :, xp.newaxis]
        f = gray + (f - gray) * (1 + 0.1 * intensity)
        return f

    def _grade_golden_hour(self, f, intensity: float):
        """Warm sunset look."""
        xp = self.xp
        f[:, :, 0] = f[:, :, 0] + 0.15 * intensity  # More red
        f[:, :, 1] = f[:, :, 1] + 0.1 * intensity  # More green (for orange)
        f[:, :, 2] = f[:, :, 2] - 0.15 * intensity  # Less blue
        # Slight brightness boost
        f = f + 0.05 * intensity * (1 - f)
        return f

    def _grade_moonlight(self, f, intensity: float):
        """Cool night look."""
        xp = self.xp
        f[:, :, 0] = f[:, :, 0] - 0.15 * intensity  # Less red
        f[:, :, 1] = f[:, :, 1] - 0.05 * intensity  # Slight less green
        f[:, :, 2] = f[:, :, 2] + 0.2 * intensity  # More blue
        # Darken slightly
        f = f * (1 - 0.05 * intensity)
        return f

    # =========================================================================
    # Overlay Effects
    # =========================================================================

    def apply_vignette(
        self,
        frame: np.ndarray,
        intensity: float = 0.3,
    ) -> np.ndarray:
        """Apply vignette effect (dark corners)."""
        xp = self.xp
        h, w = frame.shape[:2]

        # Get or create vignette mask
        cache_key = (h, w, round(intensity, 2))
        if cache_key not in self._vignette_cache:
            y, x = xp.ogrid[:h, :w]
            center_y, center_x = h / 2, w / 2

            # Normalized distance from center
            dist = xp.sqrt(
                ((x - center_x) / (w / 2)) ** 2 +
                ((y - center_y) / (h / 2)) ** 2
            )

            # Vignette falloff
            mask = 1 - xp.clip(dist - 0.5, 0, 1) * 2 * intensity
            mask = mask[:, :, xp.newaxis]
            self._vignette_cache[cache_key] = mask

        mask = self._vignette_cache[cache_key]

        f = to_gpu(frame.astype(np.float32))
        f = f * mask
        result = xp.clip(f, 0, 255).astype(xp.uint8)
        return to_cpu(result)

    def apply_film_grain(
        self,
        frame: np.ndarray,
        intensity: float = 0.03,
    ) -> np.ndarray:
        """Apply film grain texture."""
        xp = self.xp
        h, w = frame.shape[:2]

        # Generate grain
        self._grain_seed += 1
        if GPU_AVAILABLE:
            xp.random.seed(self._grain_seed)
        grain = xp.random.normal(0, intensity * 255, (h, w, 1)).astype(xp.float32)

        f = to_gpu(frame.astype(np.float32))
        f = f + grain
        result = xp.clip(f, 0, 255).astype(xp.uint8)
        return to_cpu(result)

    def apply_beat_flash(
        self,
        frame: np.ndarray,
        beat_proximity: float,  # 0-1, how close to a beat
        intensity: float = 0.1,
    ) -> np.ndarray:
        """Apply flash effect on beats."""
        if beat_proximity < 0.01:
            return frame

        xp = self.xp
        f = to_gpu(frame.astype(np.float32))

        # Flash effect (brighten)
        flash_amount = beat_proximity * intensity * 50
        f = f + flash_amount

        result = xp.clip(f, 0, 255).astype(xp.uint8)
        return to_cpu(result)

    def apply_glow(
        self,
        frame: np.ndarray,
        intensity: float = 0.3,
        radius: int = 10,
    ) -> np.ndarray:
        """Apply soft glow/bloom effect."""
        xp = self.xp

        # Simple box blur for glow
        f = to_gpu(frame.astype(np.float32))

        # Extract bright areas
        luminance = 0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2]
        bright_mask = xp.clip((luminance - 180) / 75, 0, 1)

        # Simple blur (box kernel)
        from scipy import ndimage
        if GPU_AVAILABLE:
            bright_mask_cpu = cp.asnumpy(bright_mask)
            blurred = ndimage.uniform_filter(bright_mask_cpu, size=radius)
            blurred = cp.asarray(blurred)
        else:
            blurred = ndimage.uniform_filter(bright_mask, size=radius)

        # Add glow
        glow = blurred[:, :, xp.newaxis] * intensity * 100
        f = f + glow

        result = xp.clip(f, 0, 255).astype(xp.uint8)
        return to_cpu(result)

    def apply_chromatic_aberration(
        self,
        frame: np.ndarray,
        intensity: float = 0.005,
    ) -> np.ndarray:
        """Apply chromatic aberration (color fringing)."""
        xp = self.xp
        h, w = frame.shape[:2]

        f = to_gpu(frame.astype(np.float32))

        # Shift red and blue channels
        shift = int(w * intensity)
        if shift > 0:
            # Red channel - shift right
            f[:, shift:, 0] = f[:, :-shift, 0]
            # Blue channel - shift left
            f[:, :-shift, 2] = f[:, shift:, 2]

        result = xp.clip(f, 0, 255).astype(xp.uint8)
        return to_cpu(result)

    # =========================================================================
    # Motion Effects
    # =========================================================================

    def apply_motion_transform(
        self,
        frame: np.ndarray,
        scale: float = 1.0,
        position: Tuple[float, float] = (0.5, 0.5),
        rotation: float = 0.0,
        output_size: Tuple[int, int] = None,
    ) -> np.ndarray:
        """
        Apply motion transformation (scale, position, rotation).

        Args:
            frame: Input frame
            scale: Scale factor (1.0 = original size)
            position: Normalized center position (0.5, 0.5 = center)
            rotation: Rotation in degrees
            output_size: Output size (width, height), None = same as input

        Returns:
            Transformed frame
        """
        from PIL import Image

        h, w = frame.shape[:2]
        out_w, out_h = output_size if output_size else (w, h)

        # Convert to PIL for transformation
        img = Image.fromarray(frame)

        # Calculate scaled dimensions
        scaled_w = int(w * scale)
        scaled_h = int(h * scale)

        # Resize
        if scale != 1.0:
            img = img.resize((scaled_w, scaled_h), Image.LANCZOS)

        # Calculate crop position
        pos_x, pos_y = position
        crop_x = int((scaled_w - out_w) * pos_x)
        crop_y = int((scaled_h - out_h) * pos_y)

        # Ensure valid crop coordinates
        crop_x = max(0, min(crop_x, scaled_w - out_w))
        crop_y = max(0, min(crop_y, scaled_h - out_h))

        # Crop to output size
        if scaled_w >= out_w and scaled_h >= out_h:
            img = img.crop((crop_x, crop_y, crop_x + out_w, crop_y + out_h))
        else:
            # Need to pad - create black background
            result = Image.new("RGB", (out_w, out_h), (0, 0, 0))
            paste_x = (out_w - scaled_w) // 2
            paste_y = (out_h - scaled_h) // 2
            result.paste(img, (paste_x, paste_y))
            img = result

        # Apply rotation if needed
        if abs(rotation) > 0.1:
            img = img.rotate(rotation, resample=Image.BICUBIC, expand=False)

        return np.array(img)

    # =========================================================================
    # Batch Processing
    # =========================================================================

    def process_frame(
        self,
        frame: np.ndarray,
        color_grade: str = "natural",
        color_intensity: float = 1.0,
        vignette: bool = False,
        vignette_intensity: float = 0.3,
        film_grain: bool = False,
        grain_intensity: float = 0.03,
        beat_proximity: float = 0.0,
        beat_flash_intensity: float = 0.1,
        motion_scale: float = 1.0,
        motion_position: Tuple[float, float] = (0.5, 0.5),
        motion_rotation: float = 0.0,
        output_size: Tuple[int, int] = None,
    ) -> np.ndarray:
        """
        Process a frame with all effects in optimal order.

        This is the main entry point for frame processing.
        """
        # 1. Apply motion transformation first
        if motion_scale != 1.0 or motion_position != (0.5, 0.5) or motion_rotation != 0.0:
            frame = self.apply_motion_transform(
                frame, motion_scale, motion_position, motion_rotation, output_size
            )
        elif output_size:
            from PIL import Image
            img = Image.fromarray(frame)
            img = img.resize(output_size, Image.LANCZOS)
            frame = np.array(img)

        # 2. Apply color grading
        if color_grade != "natural" and color_intensity > 0:
            frame = self.apply_color_grade(frame, color_grade, color_intensity)

        # 3. Apply vignette
        if vignette:
            frame = self.apply_vignette(frame, vignette_intensity)

        # 4. Apply film grain
        if film_grain:
            frame = self.apply_film_grain(frame, grain_intensity)

        # 5. Apply beat flash
        if beat_proximity > 0 and beat_flash_intensity > 0:
            frame = self.apply_beat_flash(frame, beat_proximity, beat_flash_intensity)

        return frame


# Global instance
_gpu_effects: Optional[GPUEffects] = None


def get_gpu_effects() -> GPUEffects:
    """Get the global GPU effects instance."""
    global _gpu_effects
    if _gpu_effects is None:
        _gpu_effects = GPUEffects()
    return _gpu_effects
