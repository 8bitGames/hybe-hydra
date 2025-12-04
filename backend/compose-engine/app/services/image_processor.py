"""Image processing utilities with GPU acceleration (cupy/CUDA)."""

from PIL import Image
from typing import Tuple
import os
import numpy as np

# Try to import cupy for GPU acceleration
try:
    import cupy as cp
    from cupyx.scipy.ndimage import zoom as gpu_zoom
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False
    cp = None


class ImageProcessor:
    """Service for processing images before video composition.

    Uses GPU (cupy/CUDA) when available, falls back to CPU (PIL/numpy).
    """

    def __init__(self):
        self.supported_formats = [".jpg", ".jpeg", ".png", ".webp", ".gif"]
        self.use_gpu = GPU_AVAILABLE
        if self.use_gpu:
            print("[ImageProcessor] GPU acceleration enabled (cupy/CUDA)")
        else:
            print("[ImageProcessor] Using CPU (PIL) - cupy not available")

    def create_black_image(
        self,
        aspect_ratio: str,
        output_path: str
    ) -> str:
        """Create a black screen image for the given aspect ratio."""
        ratios = {
            "9:16": (1080, 1920),
            "16:9": (1920, 1080),
            "1:1": (1080, 1080)
        }
        target_w, target_h = ratios.get(aspect_ratio, (1080, 1920))
        img = Image.new("RGB", (target_w, target_h), (0, 0, 0))
        img.save(output_path, quality=95)
        return output_path

    def resize_for_aspect(
        self,
        image_path: str,
        aspect_ratio: str,
        output_path: str = None
    ) -> str:
        """
        Resize and crop image for target aspect ratio.
        Uses GPU when available for faster processing.
        Returns path to processed image.
        If image is invalid/corrupted, creates a black screen instead.
        """
        ratios = {
            "9:16": (1080, 1920),
            "16:9": (1920, 1080),
            "1:1": (1080, 1080)
        }
        target_w, target_h = ratios.get(aspect_ratio, (1080, 1920))

        if output_path is None:
            base, ext = os.path.splitext(image_path)
            output_path = f"{base}_processed{ext}"

        # Try to open image, fall back to black screen on error
        try:
            img = Image.open(image_path)
            img.verify()  # Verify it's a valid image
            # Re-open after verify (verify consumes the file)
            img = Image.open(image_path)
        except Exception as e:
            print(f"[ImageProcessor] Invalid image, using black screen: {image_path} - {e}")
            return self.create_black_image(aspect_ratio, output_path)

        # Convert to RGB if necessary
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        img_w, img_h = img.size
        img_ratio = img_w / img_h
        target_ratio = target_w / target_h

        # Crop to aspect ratio
        if img_ratio > target_ratio:
            # Image is wider - crop sides
            new_w = int(img_h * target_ratio)
            x_offset = (img_w - new_w) // 2
            img = img.crop((x_offset, 0, x_offset + new_w, img_h))
        else:
            # Image is taller - crop top/bottom
            new_h = int(img_w / target_ratio)
            y_offset = (img_h - new_h) // 2
            img = img.crop((0, y_offset, img_w, y_offset + new_h))

        # Resize using GPU or CPU
        if self.use_gpu:
            img = self._resize_gpu(img, target_w, target_h)
        else:
            img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

        # Save
        img.save(output_path, quality=95)
        return output_path

    def _resize_gpu(self, img: Image.Image, target_w: int, target_h: int) -> Image.Image:
        """Resize image using GPU (cupy)."""
        # Convert PIL to numpy array
        arr = np.array(img)
        current_h, current_w = arr.shape[:2]

        # Calculate zoom factors
        zoom_h = target_h / current_h
        zoom_w = target_w / current_w

        # Transfer to GPU
        gpu_arr = cp.asarray(arr)

        # Resize on GPU (zoom each channel)
        resized = cp.zeros((target_h, target_w, 3), dtype=cp.uint8)
        for c in range(3):
            resized[:, :, c] = gpu_zoom(gpu_arr[:, :, c].astype(cp.float32),
                                        (zoom_h, zoom_w), order=1).astype(cp.uint8)

        # Transfer back to CPU
        result = cp.asnumpy(resized)

        return Image.fromarray(result)

    def get_dimensions(self, image_path: str) -> Tuple[int, int]:
        """Get image dimensions."""
        with Image.open(image_path) as img:
            return img.size

    def is_valid_resolution(
        self,
        image_path: str,
        min_width: int = 720,
        min_height: int = 720
    ) -> bool:
        """Check if image meets minimum resolution requirements."""
        try:
            width, height = self.get_dimensions(image_path)
            return width >= min_width and height >= min_height
        except Exception:
            return False

    def create_thumbnail(
        self,
        image_path: str,
        output_path: str,
        size: Tuple[int, int] = (320, 320)
    ) -> str:
        """Create a thumbnail of the image."""
        with Image.open(image_path) as img:
            # Convert to RGB if necessary
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            img.thumbnail(size, Image.Resampling.LANCZOS)
            img.save(output_path, quality=85)

        return output_path

    def is_supported_format(self, filename: str) -> bool:
        """Check if the file format is supported."""
        ext = os.path.splitext(filename)[1].lower()
        return ext in self.supported_formats
