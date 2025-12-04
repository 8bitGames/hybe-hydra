"""
Image Analyzer for Slideshow V2.

Provides image analysis for smart cropping, face detection,
and visual feature extraction.
"""

import logging
from typing import List, Tuple, Optional, Dict, Any
from pathlib import Path
import numpy as np

logger = logging.getLogger(__name__)


class ImageAnalyzer:
    """
    Analyzer for extracting visual features from images.

    Used for:
    - Smart cropping (face/subject detection)
    - Color analysis
    - Brightness/contrast detection
    - Composition analysis
    """

    def __init__(self):
        self._pil = None
        self._cv2 = None

    @property
    def PIL(self):
        """Lazy load PIL."""
        if self._pil is None:
            from PIL import Image
            self._pil = Image
        return self._pil

    def analyze_image(self, image_path: str) -> Dict[str, Any]:
        """
        Analyze a single image for visual features.

        Returns:
            Dictionary with image analysis results
        """
        try:
            img = self.PIL.open(image_path)
            img_array = np.array(img.convert("RGB"))

            # Basic info
            width, height = img.size
            aspect_ratio = width / height

            # Color analysis
            dominant_colors = self._get_dominant_colors(img_array)
            brightness = self._calculate_brightness(img_array)
            contrast = self._calculate_contrast(img_array)

            # Composition
            has_face = self._detect_faces(image_path)
            visual_weight = self._calculate_visual_weight(img_array)

            return {
                "width": width,
                "height": height,
                "aspect_ratio": aspect_ratio,
                "dominant_colors": dominant_colors,
                "brightness": brightness,
                "contrast": contrast,
                "has_face": has_face,
                "visual_weight_center": visual_weight,
                "suggested_crop_focus": self._suggest_crop_focus(visual_weight, has_face),
            }

        except Exception as e:
            logger.warning(f"Image analysis failed for {image_path}: {e}")
            return {
                "width": 0,
                "height": 0,
                "aspect_ratio": 1.0,
                "dominant_colors": ["#808080"],
                "brightness": 0.5,
                "contrast": 0.5,
                "has_face": False,
                "visual_weight_center": (0.5, 0.5),
                "suggested_crop_focus": "center",
            }

    def _get_dominant_colors(self, img_array: np.ndarray, n_colors: int = 3) -> List[str]:
        """Extract dominant colors from image."""
        try:
            # Resize for faster processing
            from PIL import Image
            img = Image.fromarray(img_array)
            img_small = img.resize((100, 100))
            pixels = np.array(img_small).reshape(-1, 3)

            # Simple k-means clustering for colors
            from collections import Counter

            # Quantize colors to reduce complexity
            quantized = (pixels // 32) * 32
            color_tuples = [tuple(c) for c in quantized]
            counter = Counter(color_tuples)

            dominant = counter.most_common(n_colors)
            colors = []
            for color, _ in dominant:
                hex_color = "#{:02x}{:02x}{:02x}".format(*color)
                colors.append(hex_color)

            return colors

        except Exception:
            return ["#808080"]

    def _calculate_brightness(self, img_array: np.ndarray) -> float:
        """Calculate overall image brightness (0-1)."""
        # Convert to grayscale-like luminance
        luminance = 0.299 * img_array[:, :, 0] + 0.587 * img_array[:, :, 1] + 0.114 * img_array[:, :, 2]
        return float(np.mean(luminance) / 255.0)

    def _calculate_contrast(self, img_array: np.ndarray) -> float:
        """Calculate image contrast (0-1)."""
        luminance = 0.299 * img_array[:, :, 0] + 0.587 * img_array[:, :, 1] + 0.114 * img_array[:, :, 2]
        contrast = np.std(luminance) / 128.0  # Normalize to roughly 0-1
        return min(1.0, float(contrast))

    def _detect_faces(self, image_path: str) -> bool:
        """Detect if image contains faces (simplified)."""
        # This is a placeholder - in production, use OpenCV's face detection
        # or a more sophisticated model
        try:
            # Try to use OpenCV if available
            import cv2
            img = cv2.imread(image_path)
            if img is None:
                return False

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Use Haar cascade for face detection
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            face_cascade = cv2.CascadeClassifier(cascade_path)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)

            return len(faces) > 0

        except Exception:
            # OpenCV not available or failed
            return False

    def _calculate_visual_weight(self, img_array: np.ndarray) -> Tuple[float, float]:
        """Calculate center of visual weight (0-1, 0-1)."""
        # Use edge detection to find areas of interest
        try:
            # Simple gradient-based approach
            gray = 0.299 * img_array[:, :, 0] + 0.587 * img_array[:, :, 1] + 0.114 * img_array[:, :, 2]

            # Calculate gradients
            grad_x = np.abs(np.diff(gray, axis=1))
            grad_y = np.abs(np.diff(gray, axis=0))

            # Pad to original size
            grad_x = np.pad(grad_x, ((0, 0), (0, 1)), mode='edge')
            grad_y = np.pad(grad_y, ((0, 1), (0, 0)), mode='edge')

            # Combined gradient magnitude
            magnitude = np.sqrt(grad_x**2 + grad_y**2)

            # Calculate weighted center
            h, w = magnitude.shape
            y_coords = np.arange(h).reshape(-1, 1)
            x_coords = np.arange(w).reshape(1, -1)

            total_weight = np.sum(magnitude) + 1e-6
            center_y = np.sum(y_coords * magnitude) / total_weight / h
            center_x = np.sum(x_coords * magnitude) / total_weight / w

            return (float(center_x), float(center_y))

        except Exception:
            return (0.5, 0.5)

    def _suggest_crop_focus(
        self,
        visual_weight: Tuple[float, float],
        has_face: bool
    ) -> str:
        """Suggest where to focus when cropping."""
        x, y = visual_weight

        if has_face:
            return "face"

        # Determine quadrant
        if x < 0.4:
            h_pos = "left"
        elif x > 0.6:
            h_pos = "right"
        else:
            h_pos = "center"

        if y < 0.4:
            v_pos = "top"
        elif y > 0.6:
            v_pos = "bottom"
        else:
            v_pos = "center"

        if h_pos == "center" and v_pos == "center":
            return "center"

        return f"{v_pos}_{h_pos}" if v_pos != "center" else h_pos

    def smart_crop(
        self,
        image_path: str,
        target_aspect: float,
        output_path: str
    ) -> str:
        """
        Smart crop image to target aspect ratio.

        Args:
            image_path: Source image path
            target_aspect: Target width/height ratio
            output_path: Where to save cropped image

        Returns:
            Path to cropped image
        """
        try:
            img = self.PIL.open(image_path)
            width, height = img.size
            current_aspect = width / height

            # Analyze for crop focus
            analysis = self.analyze_image(image_path)
            focus = analysis.get("suggested_crop_focus", "center")
            visual_weight = analysis.get("visual_weight_center", (0.5, 0.5))

            if current_aspect > target_aspect:
                # Image is wider - crop sides
                new_width = int(height * target_aspect)
                new_height = height

                # Determine x offset based on focus
                if focus == "left" or "left" in focus:
                    x_offset = 0
                elif focus == "right" or "right" in focus:
                    x_offset = width - new_width
                else:
                    # Use visual weight
                    center_x = int(visual_weight[0] * width)
                    x_offset = max(0, min(width - new_width, center_x - new_width // 2))

                crop_box = (x_offset, 0, x_offset + new_width, new_height)

            else:
                # Image is taller - crop top/bottom
                new_width = width
                new_height = int(width / target_aspect)

                # Determine y offset based on focus
                if focus == "top" or "top" in focus:
                    y_offset = 0
                elif focus == "bottom" or "bottom" in focus:
                    y_offset = height - new_height
                else:
                    # Use visual weight
                    center_y = int(visual_weight[1] * height)
                    y_offset = max(0, min(height - new_height, center_y - new_height // 2))

                crop_box = (0, y_offset, new_width, y_offset + new_height)

            # Crop and save
            cropped = img.crop(crop_box)
            cropped.save(output_path, quality=95)

            return output_path

        except Exception as e:
            logger.error(f"Smart crop failed: {e}")
            # Fallback to center crop
            return self._center_crop(image_path, target_aspect, output_path)

    def _center_crop(
        self,
        image_path: str,
        target_aspect: float,
        output_path: str
    ) -> str:
        """Simple center crop fallback."""
        img = self.PIL.open(image_path)
        width, height = img.size
        current_aspect = width / height

        if current_aspect > target_aspect:
            new_width = int(height * target_aspect)
            new_height = height
            x_offset = (width - new_width) // 2
            y_offset = 0
        else:
            new_width = width
            new_height = int(width / target_aspect)
            x_offset = 0
            y_offset = (height - new_height) // 2

        crop_box = (x_offset, y_offset, x_offset + new_width, y_offset + new_height)
        cropped = img.crop(crop_box)
        cropped.save(output_path, quality=95)

        return output_path

    def resize_for_video(
        self,
        image_path: str,
        target_size: Tuple[int, int],
        output_path: str,
        method: str = "smart_crop"
    ) -> str:
        """
        Resize image for video composition.

        Args:
            image_path: Source image
            target_size: (width, height)
            output_path: Where to save
            method: "smart_crop", "center_crop", "fit", "fill"

        Returns:
            Path to processed image
        """
        target_width, target_height = target_size
        target_aspect = target_width / target_height

        if method == "smart_crop":
            cropped_path = self.smart_crop(image_path, target_aspect, output_path)
        elif method == "center_crop":
            cropped_path = self._center_crop(image_path, target_aspect, output_path)
        else:
            cropped_path = self._center_crop(image_path, target_aspect, output_path)

        # Resize to exact dimensions
        img = self.PIL.open(cropped_path)
        resized = img.resize(target_size, self.PIL.LANCZOS)
        resized.save(output_path, quality=95)

        return output_path
