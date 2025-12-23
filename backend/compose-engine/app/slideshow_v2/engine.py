"""
Main Slideshow V2 Engine.

This is the high-level orchestration layer that:
1. Accepts input (images, audio, lyrics)
2. Analyzes content with AI
3. Generates composition plan
4. Renders the final video

Usage:
    engine = SlideshowEngine()
    result = await engine.create_slideshow(
        image_paths=["img1.jpg", "img2.jpg"],
        audio_path="music.mp3",
        lyrics=["Line 1", "Line 2"],
        style="kpop_energetic",
        output_path="output.mp4"
    )
"""

import os
import logging
import asyncio
from typing import List, Optional, Dict, Any
from pathlib import Path
from dataclasses import dataclass

from .conductor import GeminiConductor
from .conductor.schemas import (
    CompositionPlan,
    ConductorInput,
    ImageContext,
    LyricsContext,
    AudioContext,
)
from .analyzers.audio_analyzer import AdvancedAudioAnalyzer
from .analyzers.image_analyzer import ImageAnalyzer
from .generators.timeline_generator import TimelineGenerator
from .renderer.engine import SlideshowRenderer, RenderConfig
from .models.timeline import Timeline

logger = logging.getLogger(__name__)


@dataclass
class SlideshowResult:
    """Result of slideshow creation."""
    success: bool
    output_path: Optional[str] = None
    duration: float = 0.0
    composition_plan: Optional[CompositionPlan] = None
    timeline: Optional[Timeline] = None
    error: Optional[str] = None


class SlideshowEngine:
    """
    Main slideshow creation engine.

    Orchestrates the entire pipeline from input to rendered video.
    """

    def __init__(
        self,
        gemini_api_key: Optional[str] = None,
        render_config: Optional[RenderConfig] = None,
    ):
        """
        Initialize the slideshow engine.

        Args:
            gemini_api_key: API key for Gemini (or from GEMINI_API_KEY env)
            render_config: Video rendering configuration
        """
        # Initialize components
        self.conductor = GeminiConductor(api_key=gemini_api_key)
        self.audio_analyzer = AdvancedAudioAnalyzer()
        self.image_analyzer = ImageAnalyzer()
        self.timeline_generator = TimelineGenerator()
        self.renderer = SlideshowRenderer(config=render_config or RenderConfig())

        logger.info("SlideshowEngine initialized")

    async def create_slideshow(
        self,
        image_paths: List[str],
        audio_path: Optional[str] = None,
        lyrics: Optional[List[str]] = None,
        style_hint: str = "",
        target_duration: Optional[float] = None,
        aspect_ratio: str = "9:16",
        output_path: str = "slideshow.mp4",
        progress_callback: Optional[callable] = None,
    ) -> SlideshowResult:
        """
        Create a complete slideshow video.

        Args:
            image_paths: List of image file paths
            audio_path: Path to audio file (optional)
            lyrics: List of lyrics/caption lines (optional)
            style_hint: Style description (e.g., "energetic K-pop", "emotional ballad")
            target_duration: Target video duration (auto-calculated from audio if not provided)
            aspect_ratio: Output aspect ratio ("9:16", "16:9", "1:1")
            output_path: Where to save the output video
            progress_callback: Optional callback for progress updates

        Returns:
            SlideshowResult with success status and output path
        """
        try:
            # Validate inputs
            if not image_paths:
                raise ValueError("At least one image is required")

            for path in image_paths:
                if not os.path.exists(path):
                    raise FileNotFoundError(f"Image not found: {path}")

            if audio_path and not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio not found: {audio_path}")

            # Parse aspect ratio to output size
            output_size = self._parse_aspect_ratio(aspect_ratio)

            # Step 1: Analyze audio (if provided)
            if progress_callback:
                progress_callback(0.05, "Analyzing audio...")

            audio_analysis = None
            audio_context = None
            if audio_path:
                logger.info(f"Analyzing audio: {audio_path}")
                audio_analysis = self.audio_analyzer.analyze(audio_path)
                audio_context = self.audio_analyzer.to_conductor_context(audio_analysis)

                # Auto-calculate duration from audio if not specified
                if target_duration is None:
                    target_duration = min(audio_analysis.duration, 60.0)  # Cap at 60s

            # Default duration if no audio
            if target_duration is None:
                target_duration = len(image_paths) * 3.0  # 3 seconds per image

            # Step 2: Analyze images with AI
            if progress_callback:
                progress_callback(0.15, "Analyzing images...")

            logger.info(f"Analyzing {len(image_paths)} images...")
            image_contexts = await self.conductor.analyze_images(image_paths)

            # Step 3: Analyze lyrics (if provided)
            if progress_callback:
                progress_callback(0.25, "Analyzing lyrics...")

            lyrics_context = None
            if lyrics:
                logger.info(f"Analyzing {len(lyrics)} lyrics lines...")
                lyrics_context = await self.conductor.analyze_lyrics(lyrics)

            # Step 4: Generate composition plan with AI
            if progress_callback:
                progress_callback(0.35, "Generating composition plan...")

            logger.info("Generating AI composition plan...")
            conductor_input = ConductorInput(
                images=image_contexts,
                lyrics=lyrics_context,
                audio=audio_context,
                target_duration=target_duration,
                aspect_ratio=aspect_ratio,
                style_hint=style_hint,
            )

            composition_plan = await self.conductor.compose(conductor_input)
            logger.info(f"Composition plan: {len(composition_plan.segments)} segments, "
                       f"{len(composition_plan.transitions)} transitions, "
                       f"mood: {composition_plan.mood}")

            # Step 5: Generate executable timeline
            if progress_callback:
                progress_callback(0.45, "Generating timeline...")

            logger.info("Generating timeline...")
            timeline = self.timeline_generator.generate(
                plan=composition_plan,
                image_paths=image_paths,
                audio_analysis=audio_analysis,
                output_size=output_size,
                fps=composition_plan.fps,
            )

            # Validate timeline
            errors = self.timeline_generator.validate_timeline(timeline)
            if errors:
                logger.warning(f"Timeline validation warnings: {errors[:3]}")

            # Optimize timeline
            timeline = self.timeline_generator.optimize_for_rendering(timeline)

            # Step 6: Render video
            if progress_callback:
                progress_callback(0.5, "Rendering video...")

            def render_progress(pct, msg):
                # Map render progress (0-1) to overall progress (0.5-0.95)
                overall = 0.5 + pct * 0.45
                if progress_callback:
                    progress_callback(overall, msg)

            logger.info(f"Starting render: {timeline.total_duration:.2f}s video")
            final_path = self.renderer.render(
                timeline=timeline,
                audio_path=audio_path,
                output_path=output_path,
                progress_callback=render_progress,
            )

            if progress_callback:
                progress_callback(1.0, "Complete!")

            logger.info(f"Slideshow created: {final_path}")

            return SlideshowResult(
                success=True,
                output_path=final_path,
                duration=timeline.total_duration,
                composition_plan=composition_plan,
                timeline=timeline,
            )

        except Exception as e:
            logger.error(f"Slideshow creation failed: {e}", exc_info=True)
            return SlideshowResult(
                success=False,
                error=str(e),
            )

    def _parse_aspect_ratio(self, ratio: str) -> tuple:
        """Parse aspect ratio string to output dimensions."""
        ratios = {
            "9:16": (1080, 1920),   # Vertical (TikTok, Reels)
            "16:9": (1920, 1080),   # Horizontal (YouTube)
            "1:1": (1080, 1080),    # Square (Instagram)
            "4:5": (1080, 1350),    # Portrait (Instagram)
            "4:3": (1440, 1080),    # Classic
        }
        return ratios.get(ratio, (1080, 1920))

    async def create_from_preset(
        self,
        image_paths: List[str],
        audio_path: str,
        preset_name: str,
        lyrics: Optional[List[str]] = None,
        output_path: str = "slideshow.mp4",
    ) -> SlideshowResult:
        """
        Create slideshow using a preset style.

        Presets:
            - kpop_energetic: Fast cuts, beat sync, vibrant colors
            - kpop_emotional: Slow transitions, emotional color grading
            - viral_tiktok: Quick cuts, trendy transitions
            - cinematic: Dramatic, slow motion feel
            - minimal_clean: Clean, simple animations
        """
        from .models.config import get_preset

        preset = get_preset(preset_name)

        # Map preset to style hint
        style_hints = {
            "kpop_energetic": "energetic K-pop music video with fast cuts synced to beats",
            "kpop_emotional": "emotional ballad with slow, meaningful transitions",
            "viral_tiktok": "trendy TikTok video with engaging quick cuts",
            "cinematic": "cinematic, dramatic film-like composition",
            "minimal_clean": "clean, minimalist style with elegant transitions",
            "retro_vhs": "nostalgic retro VHS aesthetic",
            "dreamy_soft": "soft, dreamy aesthetic with gentle movements",
            "dynamic_hype": "high-energy hype video with dynamic effects",
            "documentary": "documentary style with informative pacing",
        }

        return await self.create_slideshow(
            image_paths=image_paths,
            audio_path=audio_path,
            lyrics=lyrics,
            style_hint=style_hints.get(preset_name, ""),
            aspect_ratio=preset.aspect_ratio,
            output_path=output_path,
        )


class SlideshowEngineSync:
    """
    Synchronous wrapper for SlideshowEngine.

    For use in non-async contexts like Modal functions.
    """

    def __init__(
        self,
        gemini_api_key: Optional[str] = None,
        render_config: Optional[RenderConfig] = None,
    ):
        self.engine = SlideshowEngine(
            gemini_api_key=gemini_api_key,
            render_config=render_config,
        )

    def create_slideshow(
        self,
        image_paths: List[str],
        audio_path: Optional[str] = None,
        lyrics: Optional[List[str]] = None,
        style_hint: str = "",
        target_duration: Optional[float] = None,
        aspect_ratio: str = "9:16",
        output_path: str = "slideshow.mp4",
        progress_callback: Optional[callable] = None,
    ) -> SlideshowResult:
        """Synchronous version of create_slideshow."""
        return asyncio.run(
            self.engine.create_slideshow(
                image_paths=image_paths,
                audio_path=audio_path,
                lyrics=lyrics,
                style_hint=style_hint,
                target_duration=target_duration,
                aspect_ratio=aspect_ratio,
                output_path=output_path,
                progress_callback=progress_callback,
            )
        )

    def create_from_preset(
        self,
        image_paths: List[str],
        audio_path: str,
        preset_name: str,
        lyrics: Optional[List[str]] = None,
        output_path: str = "slideshow.mp4",
    ) -> SlideshowResult:
        """Synchronous version of create_from_preset."""
        return asyncio.run(
            self.engine.create_from_preset(
                image_paths=image_paths,
                audio_path=audio_path,
                preset_name=preset_name,
                lyrics=lyrics,
                output_path=output_path,
            )
        )


# Convenience function for simple usage
async def create_slideshow(
    images: List[str],
    audio: Optional[str] = None,
    captions: Optional[List[str]] = None,
    style: str = "",
    output: str = "slideshow.mp4",
) -> str:
    """
    Simple function to create a slideshow.

    Args:
        images: List of image paths
        audio: Audio file path
        captions: Caption lines
        style: Style hint
        output: Output path

    Returns:
        Path to output video
    """
    engine = SlideshowEngine()
    result = await engine.create_slideshow(
        image_paths=images,
        audio_path=audio,
        lyrics=captions,
        style_hint=style,
        output_path=output,
    )

    if result.success:
        return result.output_path
    else:
        raise RuntimeError(f"Slideshow creation failed: {result.error}")
