"""Main video rendering service using MoviePy - Optimized for GPU and parallel processing.

This module provides the VideoRenderer class which can use either:
1. MoviePy-based rendering (default, legacy)
2. Pure FFmpeg rendering (faster, enabled via USE_FFMPEG_PIPELINE=1)

To enable the new FFmpeg pipeline, set environment variable:
    export USE_FFMPEG_PIPELINE=1
"""

import os
import platform

# Feature flag for FFmpeg pipeline
USE_FFMPEG_PIPELINE = os.environ.get("USE_FFMPEG_PIPELINE", "0") == "1"

# CRITICAL: Set FFmpeg path BEFORE importing moviepy/imageio
# This tells imageio_ffmpeg to use our compiled FFmpeg with NVENC support
if platform.system() != "Darwin":  # Not macOS
    NVENC_FFMPEG = "/usr/local/bin/ffmpeg"
    if os.path.exists(NVENC_FFMPEG):
        os.environ["IMAGEIO_FFMPEG_EXE"] = NVENC_FFMPEG
        os.environ["FFMPEG_BINARY"] = NVENC_FFMPEG
        print(f"[FFmpeg] Using NVENC FFmpeg: {NVENC_FFMPEG}")

import asyncio
import logging
import hashlib
import random
from typing import Callable, Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor
from moviepy import (
    ImageClip,
    AudioFileClip,
    CompositeVideoClip,
    concatenate_videoclips
)
from moviepy.audio.fx import AudioFadeIn, AudioFadeOut

from .audio_analyzer import AudioAnalyzer
from ..models.responses import AudioAnalysis
from .beat_sync import BeatSyncEngine, MIN_IMAGE_DURATION
from .image_processor import ImageProcessor
from ..effects import transitions, filters, text_overlay, motion
from ..effects import get_registry, EffectSelector, SelectionConfig, SelectedEffects
from ..presets import get_preset
from ..utils.s3_client import S3Client
from ..utils.temp_files import TempFileManager
from ..models.render_job import (
    RenderRequest,
    ImageData,
    AudioData,
    ScriptData,
    RenderSettings,
    AIEffectSelection
)


logger = logging.getLogger(__name__)

# Audio fade durations (seconds)
AUDIO_FADE_IN = 1.0   # Gentle fade in at start
AUDIO_FADE_OUT = 2.0  # Smooth fade out at end

# TikTok Hook Strategy Constants
HOOK_DURATION = 2.0  # First 2 seconds for hook (calm before beat drop)
HOOK_CALM_FACTOR = 0.7  # Reduce audio volume in hook section

# Audio analysis cache (for compose variations using same audio)
_audio_cache: dict = {}
_audio_cache_lock = asyncio.Lock()

# Shared thread pool for CPU-bound tasks
_cpu_executor: Optional[ThreadPoolExecutor] = None


def get_cpu_executor() -> ThreadPoolExecutor:
    """Get or create shared thread pool for CPU-bound tasks."""
    global _cpu_executor
    if _cpu_executor is None:
        # Use more workers to maximize CPU utilization on Modal (8 cores)
        _cpu_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="cpu_pool")
    return _cpu_executor


class VideoRenderer:
    """Main service for rendering composed videos - Optimized for GPU and parallel processing.

    Can use either MoviePy (legacy) or pure FFmpeg (faster) based on the
    USE_FFMPEG_PIPELINE environment variable.
    """

    def __init__(self, use_ffmpeg_pipeline: Optional[bool] = None):
        """Initialize VideoRenderer.

        Args:
            use_ffmpeg_pipeline: If True, use new FFmpeg pipeline.
                If None, check USE_FFMPEG_PIPELINE env var.
                Default is False (MoviePy legacy mode).
        """
        self._use_ffmpeg = use_ffmpeg_pipeline
        if self._use_ffmpeg is None:
            self._use_ffmpeg = USE_FFMPEG_PIPELINE

        if self._use_ffmpeg:
            # Use pure FFmpeg renderer
            from ..renderers.ffmpeg_renderer import FFmpegRenderer
            self._ffmpeg_renderer = FFmpegRenderer()
            logger.info("[VideoRenderer] Using FFmpeg pipeline (USE_FFMPEG_PIPELINE=1)")
        else:
            # Legacy MoviePy mode
            self._ffmpeg_renderer = None
            logger.info("[VideoRenderer] Using MoviePy pipeline (legacy)")

        self.s3 = S3Client()
        self.audio_analyzer = AudioAnalyzer()
        self.beat_sync = BeatSyncEngine()
        self.image_processor = ImageProcessor()
        self.temp = TempFileManager()
        self.effect_selector = EffectSelector()

    async def render(
        self,
        request: RenderRequest,
        progress_callback: Optional[Callable] = None
    ) -> str:
        """
        Optimized rendering pipeline with parallel processing.
        Returns S3 URL of rendered video.

        If USE_FFMPEG_PIPELINE=1, delegates to FFmpegRenderer for ~3x faster rendering.
        """
        # Use FFmpeg pipeline if enabled
        if self._use_ffmpeg and self._ffmpeg_renderer:
            logger.info(f"[{request.job_id}] Delegating to FFmpeg pipeline")
            return await self._ffmpeg_renderer.render(request, progress_callback)

        # Legacy MoviePy pipeline below
        job_id = request.job_id
        job_dir = self.temp.get_job_dir(job_id)

        try:
            logger.info(f"[{job_id}] Starting optimized render with {len(request.images)} images")
            logger.info(f"[{job_id}] Vibe: {request.settings.vibe.value}, Target: {request.settings.target_duration}s")

            # ============================================================
            # STEP 1: PARALLEL DOWNLOADS (images + audio simultaneously)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 0, "Downloading assets")

            image_paths, audio_path = await self._download_all_assets(
                request.images, request.audio, job_dir
            )
            audio_status = "with audio" if audio_path else "without audio"
            logger.info(f"[{job_id}] Downloaded {len(image_paths)} images ({audio_status})")

            # ============================================================
            # STEP 2: AUDIO ANALYSIS (with caching for variations)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 15, "Analyzing audio" if audio_path else "Calculating timings")

            audio_url = request.audio.url if request.audio else None
            logger.info(f"[{job_id}] STEP 2: Starting audio analysis...")
            audio_analysis = await self._get_audio_analysis(audio_path, audio_url)
            beat_times = audio_analysis.beat_times
            logger.info(f"[{job_id}] STEP 2 COMPLETE: BPM={audio_analysis.bpm}, beats={len(beat_times)}")

            # ============================================================
            # STEP 3: CALCULATE TIMINGS (600ms per image, looping)
            # ============================================================
            logger.info(f"[{job_id}] STEP 3: Calculating timings...")
            await self._update_progress(progress_callback, job_id, 20, "Calculating timings")

            preset = get_preset(request.settings.vibe.value)
            has_audio = audio_path is not None
            target_duration = self._calculate_target_duration(
                request, preset, len(image_paths), audio_analysis.duration, job_id, has_audio
            )

            # BPM-based image duration (400-800ms range)
            # 1 beat = 60/BPM seconds
            MIN_DURATION = 0.4  # 400ms
            MAX_DURATION = 0.8  # 800ms
            DEFAULT_DURATION = 0.6  # 600ms fallback

            if audio_analysis.bpm and audio_analysis.bpm > 0:
                # Calculate duration per beat
                beat_duration = 60.0 / audio_analysis.bpm
                # Clamp to 400-800ms range
                IMAGE_DURATION = max(MIN_DURATION, min(MAX_DURATION, beat_duration))
                logger.info(f"[{job_id}] BPM: {audio_analysis.bpm:.1f} -> {IMAGE_DURATION*1000:.0f}ms per image")
            else:
                IMAGE_DURATION = DEFAULT_DURATION
                logger.info(f"[{job_id}] No BPM detected, using default {IMAGE_DURATION*1000:.0f}ms per image")

            num_total_clips = max(1, int(target_duration / IMAGE_DURATION))

            # Create cut_times for looped images (600ms each)
            cut_times = []
            for i in range(num_total_clips):
                start_time = i * IMAGE_DURATION
                end_time = (i + 1) * IMAGE_DURATION
                cut_times.append((start_time, end_time))

            logger.info(f"[{job_id}] Using 600ms per image: {num_total_clips} clips for {target_duration:.1f}s video")
            logger.info(f"[{job_id}] STEP 3 COMPLETE: calculated {len(cut_times)} cut times")

            # ============================================================
            # STEP 4: PARALLEL IMAGE PROCESSING
            # ============================================================
            logger.info(f"[{job_id}] STEP 4: Processing images in parallel...")
            await self._update_progress(progress_callback, job_id, 25, "Processing images")

            processed_paths = await self._process_images_parallel(
                image_paths,
                request.settings.aspect_ratio.value,
                job_id
            )
            logger.info(f"[{job_id}] Processed {len(processed_paths)} images in parallel")

            # Create looped image paths (repeat images to fill duration)
            looped_image_paths = []
            for i in range(num_total_clips):
                looped_image_paths.append(processed_paths[i % len(processed_paths)])
            logger.info(f"[{job_id}] Looped {len(processed_paths)} images into {len(looped_image_paths)} clips")
            logger.info(f"[{job_id}] STEP 4 COMPLETE")

            # ============================================================
            # STEP 5: CREATE CLIPS (can be parallelized for large batches)
            # ============================================================
            logger.info(f"[{job_id}] STEP 5: Creating video clips...")
            await self._update_progress(progress_callback, job_id, 35, "Creating video clips")

            clips = await self._create_clips_parallel(
                looped_image_paths, cut_times, preset,
                request.settings.aspect_ratio.value, beat_times, job_id
            )
            logger.info(f"[{job_id}] STEP 5 COMPLETE: created {len(clips)} clips")

            # ============================================================
            # STEP 6: GET AI EFFECTS (for transitions and text animations)
            # ============================================================
            logger.info(f"[{job_id}] STEP 6: Getting AI effects...")
            ai_effects = None
            if request.settings.use_ai_effects:
                ai_effects = await self._get_ai_effects(
                    settings=request.settings,
                    num_images=len(image_paths),
                    bpm=audio_analysis.bpm,
                    job_id=job_id
                )
                logger.info(f"[{job_id}] AI effects - transitions: {len(ai_effects.transitions)}, text_animations: {len(ai_effects.text_animations)}")
            logger.info(f"[{job_id}] STEP 6 COMPLETE")

            # ============================================================
            # STEP 7: APPLY TRANSITIONS AND CONCATENATE
            # ============================================================
            logger.info(f"[{job_id}] STEP 7: Concatenating clips (direct cuts, no transitions)...")
            await self._update_progress(progress_callback, job_id, 55, "Concatenating clips")

            # Simple concatenation - no xfade transitions (they were causing issues)
            video = concatenate_videoclips(clips, method="compose")
            logger.info(f"[{job_id}] STEP 7 COMPLETE: video duration={video.duration:.2f}s")

            # ============================================================
            # STEP 8: ADD TEXT OVERLAYS (with AI-selected animations)
            # ============================================================
            logger.info(f"[{job_id}] STEP 8: Adding text overlays...")
            await self._update_progress(progress_callback, job_id, 65, "Adding text overlays")

            video_duration = video.duration
            if request.script and request.script.lines:
                adjusted_script = self._adjust_script_timings(request.script, video_duration, job_id)
                # Pass AI-selected text animations if available
                text_animations = ai_effects.text_animations if ai_effects else None
                video = self._add_text_overlays(
                    video, adjusted_script,
                    request.settings.text_style.value,
                    request.settings.aspect_ratio.value,
                    text_animations=text_animations
                )

            # ============================================================
            # STEP 9: ADD AUDIO WITH TIKTOK HOOK (if audio provided)
            # ============================================================
            logger.info(f"[{job_id}] STEP 9: Adding audio...")
            audio_clips_to_close = []
            if audio_path and request.audio:
                await self._update_progress(progress_callback, job_id, 75, "Adding audio")
                video, audio_clips_to_close = self._add_audio_with_effects(
                    video, audio_path, request.audio, video.duration
                )
            else:
                logger.info(f"[{job_id}] Skipping audio - generating silent video")
            logger.info(f"[{job_id}] STEP 9 COMPLETE")

            # ============================================================
            # STEP 10: COLOR GRADING
            # ============================================================
            logger.info(f"[{job_id}] STEP 10: Applying color grading...")
            await self._update_progress(progress_callback, job_id, 78, "Applying color grading")
            color_grade = preset.color_grade
            if color_grade and color_grade != "natural":
                try:
                    logger.info(f"[{job_id}] Applying color grade: {color_grade}")
                    video = filters.apply_color_grade(video, color_grade)
                except Exception as e:
                    logger.warning(f"[{job_id}] Color grading failed: {e}")
            logger.info(f"[{job_id}] STEP 10 COMPLETE")

            # ============================================================
            # STEP 11: OVERLAY EFFECTS
            # ============================================================
            logger.info(f"[{job_id}] STEP 11: Applying overlay effects...")
            await self._update_progress(progress_callback, job_id, 80, "Applying overlay effects")

            # Apply preset-based effects (film_grain, vignette, etc.)
            if preset.effects:
                for effect_name in preset.effects:
                    try:
                        if effect_name == "film_grain":
                            video = filters.apply_film_grain(video, intensity=0.03)
                            logger.info(f"[{job_id}] Applied film grain effect")
                        elif effect_name == "vignette":
                            video = filters.apply_vignette(video, strength=0.25)
                            logger.info(f"[{job_id}] Applied vignette effect")
                        elif effect_name == "glow":
                            video = filters.apply_bloom(video, threshold=0.7, intensity=0.3)
                            logger.info(f"[{job_id}] Applied glow/bloom effect")
                        elif effect_name == "slight_desaturate":
                            # Already handled by cinematic color grade
                            pass
                        # Note: shake_on_beat and flash_transition are handled in motion/transitions
                    except Exception as e:
                        logger.warning(f"[{job_id}] Overlay effect {effect_name} failed: {e}")

            # Apply AI-selected overlay effects if available
            if ai_effects and ai_effects.filters:
                try:
                    logger.info(f"[{job_id}] Applying {len(ai_effects.filters)} AI overlay effects")
                    video = filters.apply_overlay_effects_dynamic(
                        video,
                        ai_effects.filters,
                        moods=getattr(ai_effects, 'moods', None),
                        intensity="medium",
                        bpm=audio_analysis.bpm if audio_analysis else None
                    )
                except Exception as e:
                    logger.warning(f"[{job_id}] AI overlay effects failed: {e}")
            logger.info(f"[{job_id}] STEP 11 COMPLETE")

            # ============================================================
            # STEP 12: GPU RENDER WITH OPTIMIZED NVENC
            # ============================================================
            logger.info(f"[{job_id}] STEP 12: Rendering video with NVENC...")
            await self._update_progress(progress_callback, job_id, 85, "Rendering video")

            output_path = self.temp.get_path(job_id, "output.mp4")
            temp_audiofile = self.temp.get_path(job_id, f"temp_audio_{job_id}.mp4")

            await self._render_with_nvenc(video, output_path, temp_audiofile, job_id)
            logger.info(f"[{job_id}] STEP 12 COMPLETE")

            # ============================================================
            # STEP 13: CLEANUP AND UPLOAD
            # ============================================================
            logger.info(f"[{job_id}] STEP 13: Cleanup and upload...")
            self._cleanup_clips(video, clips, audio_clips_to_close)

            await self._update_progress(progress_callback, job_id, 95, "Uploading")
            s3_url = await self.s3.upload_file(
                output_path,
                request.output.s3_key,
                content_type="video/mp4"
            )

            self.temp.cleanup(job_id)
            await self._update_progress(progress_callback, job_id, 100, "Completed")

            logger.info(f"[{job_id}] Render complete: {s3_url}")
            return s3_url

        except Exception as e:
            self.temp.cleanup(job_id)
            raise e

    async def _download_all_assets(
        self,
        images: List[ImageData],
        audio: Optional[AudioData],
        job_dir: str
    ) -> Tuple[List[str], Optional[str]]:
        """Download images and audio in parallel, handling failures gracefully.

        Audio is optional - if not provided, returns None for audio_path.
        """
        sorted_images = sorted(images, key=lambda x: x.order)

        # Download audio if provided (optional)
        audio_path = None
        if audio and audio.url:
            audio_path = os.path.join(job_dir, "audio.mp3")
            await self.s3.download_file(audio.url, audio_path)
            logger.info(f"Audio downloaded: {audio_path}")
        else:
            logger.info("No audio provided - generating video without background music")

        # Download images with error handling (some may fail due to hotlink protection)
        image_paths = []
        for i, img in enumerate(sorted_images):
            local_path = os.path.join(job_dir, f"image_{i}.jpg")
            try:
                await self.s3.download_file(img.url, local_path)
                image_paths.append(local_path)
            except Exception as e:
                logger.warning(f"Failed to download image {i}: {str(e)[:80]}...")
                # Continue - try other images

        # Ensure we have at least 3 images
        if len(image_paths) < 3:
            raise ValueError(f"Not enough valid images. Got {len(image_paths)}, need at least 3.")

        logger.info(f"Downloaded {len(image_paths)}/{len(sorted_images)} images successfully")
        return image_paths, audio_path

    async def _get_audio_analysis(self, audio_path: Optional[str], audio_url: Optional[str]) -> AudioAnalysis:
        """Get audio analysis with caching (for compose variations using same audio).

        If no audio is provided, returns default analysis with estimated beat times.
        """
        # If no audio, return default analysis
        if not audio_path or not audio_url:
            return self._create_default_audio_analysis()

        # Create cache key from audio URL
        cache_key = hashlib.md5(audio_url.encode()).hexdigest()

        async with _audio_cache_lock:
            if cache_key in _audio_cache:
                logger.info(f"Using cached audio analysis for {cache_key[:8]}...")
                return _audio_cache[cache_key]

        # Analyze audio (CPU-bound, run in thread pool) with timeout
        loop = asyncio.get_event_loop()
        AUDIO_ANALYSIS_TIMEOUT = 60  # 60 seconds timeout

        try:
            logger.info(f"Starting audio analysis with {AUDIO_ANALYSIS_TIMEOUT}s timeout...")
            analysis = await asyncio.wait_for(
                loop.run_in_executor(
                    get_cpu_executor(),
                    lambda: self.audio_analyzer.analyze(audio_path)
                ),
                timeout=AUDIO_ANALYSIS_TIMEOUT
            )
            logger.info(f"Audio analysis completed successfully")
        except asyncio.TimeoutError:
            logger.warning(f"Audio analysis timed out after {AUDIO_ANALYSIS_TIMEOUT}s, using default analysis")
            return self._create_default_audio_analysis()
        except Exception as e:
            logger.warning(f"Audio analysis failed: {e}, using default analysis")
            return self._create_default_audio_analysis()

        # Cache the result
        async with _audio_cache_lock:
            _audio_cache[cache_key] = analysis
            # Keep cache size reasonable
            if len(_audio_cache) > 50:
                oldest = next(iter(_audio_cache))
                del _audio_cache[oldest]

        return analysis

    def _create_default_audio_analysis(self) -> AudioAnalysis:
        """Create default audio analysis for videos without background music.

        Uses a standard 120 BPM tempo and generates evenly spaced beat times
        for consistent timing when no audio is provided.
        """
        DEFAULT_BPM = 120  # Standard tempo for TikTok/social media
        DEFAULT_DURATION = 60  # Max duration to generate beat times for

        # Generate beat times at 120 BPM (every 0.5 seconds)
        beat_interval = 60.0 / DEFAULT_BPM
        beat_times = [i * beat_interval for i in range(int(DEFAULT_DURATION / beat_interval))]

        logger.info(f"Created default audio analysis: BPM={DEFAULT_BPM}, beats={len(beat_times)}")

        # Generate energy curve as (time, energy) pairs
        energy_curve = [(i * 0.5, 0.5) for i in range(int(DEFAULT_DURATION * 2))]  # Neutral energy

        return AudioAnalysis(
            bpm=DEFAULT_BPM,
            beat_times=beat_times,
            duration=DEFAULT_DURATION,
            energy_curve=energy_curve,
            suggested_vibe="Exciting"  # Default vibe for social media content
        )

    async def _process_images_parallel(
        self,
        image_paths: List[str],
        aspect_ratio: str,
        job_id: str
    ) -> List[str]:
        """Process images in parallel using thread pool.

        Invalid images are filtered out (not replaced with black screens).
        This ensures only valid images are used in the video loop.
        """
        loop = asyncio.get_event_loop()

        async def process_one(i: int, img_path: str) -> Optional[str]:
            output_path = self.temp.get_path(job_id, f"processed_{i}.jpg")
            return await loop.run_in_executor(
                get_cpu_executor(),
                lambda: self.image_processor.resize_for_aspect(img_path, aspect_ratio, output_path)
            )

        tasks = [
            process_one(i, img_path)
            for i, img_path in enumerate(image_paths)
        ]

        results = await asyncio.gather(*tasks)

        # Filter out None results (invalid images)
        valid_paths = [p for p in results if p is not None]

        if len(valid_paths) < len(results):
            logger.warning(f"[{job_id}] Filtered out {len(results) - len(valid_paths)} invalid images")

        if len(valid_paths) < 1:
            raise ValueError("No valid images could be processed")

        return valid_paths

    async def _create_clips_parallel(
        self,
        processed_paths: List[str],
        cut_times: List[Tuple[float, float]],
        preset,
        aspect_ratio: str,
        beat_times: List[float],
        job_id: str
    ) -> List[ImageClip]:
        """Create image clips (parallelized for large batches).

        IMPORTANT: Motion styles are now VARIED per clip for visual diversity.
        Each clip gets a different motion effect (zoom_in, zoom_out, pan) in rotation.
        """
        loop = asyncio.get_event_loop()

        # Define motion style rotation for diversity
        # Alternating between zoom_in and zoom_out creates visual rhythm
        # First and last clips get special treatment
        MOTION_STYLES = ["zoom_in", "zoom_out", "pan", "zoom_in", "zoom_out"]

        def get_motion_style(index: int, total: int, base_style: str) -> str:
            """Get diverse motion style for each clip.

            Strategy:
            - First clip: zoom_in (opening feel)
            - Last clip: zoom_out (closing feel)
            - Middle clips: alternate between styles for variety
            - If base_style is 'static', keep it static
            """
            if base_style == "static":
                return "static"

            if index == 0:
                return "zoom_in"  # Opening: zoom in
            elif index == total - 1:
                return "zoom_out"  # Closing: zoom out
            else:
                # Middle clips: rotate through styles
                return MOTION_STYLES[index % len(MOTION_STYLES)]

        def create_one(img_path: str, start: float, end: float, clip_index: int, total_clips: int) -> ImageClip:
            duration = end - start
            clip = ImageClip(img_path).with_duration(duration)

            # Apply Ken Burns motion effect based on style
            motion_style = get_motion_style(clip_index, total_clips, preset.motion_style)
            if motion_style != "static":
                try:
                    clip = motion.apply_ken_burns(clip, motion_style)
                except Exception as e:
                    logger.warning(f"Motion effect failed: {e}")

            return clip.with_start(start)

        total_clips = len(processed_paths)

        # Log motion diversity
        styles_to_apply = [get_motion_style(i, total_clips, preset.motion_style) for i in range(total_clips)]
        logger.info(f"[{job_id}] Applying diverse motion styles: {styles_to_apply}")

        # For small batches, just create sequentially (overhead of parallelization not worth it)
        if len(processed_paths) <= 4:
            return [
                create_one(img_path, start, end, idx, total_clips)
                for idx, (img_path, (start, end)) in enumerate(zip(processed_paths, cut_times))
            ]

        # For larger batches, use parallel processing
        tasks = [
            loop.run_in_executor(
                get_cpu_executor(),
                lambda p=img_path, s=start, e=end, i=idx: create_one(p, s, e, i, total_clips)
            )
            for idx, (img_path, (start, end)) in enumerate(zip(processed_paths, cut_times))
        ]

        return await asyncio.gather(*tasks)

    def _calculate_target_duration(
        self,
        request: RenderRequest,
        preset,
        num_images: int,
        audio_duration: Optional[float],
        job_id: str,
        has_audio: bool = True
    ) -> float:
        """Calculate optimal target duration for TikTok.

        When no audio is provided, uses target_duration from settings or
        calculates based on number of images.
        """
        min_duration, max_duration = preset.duration_range
        min_duration_for_images = num_images * MIN_IMAGE_DURATION

        # If no audio, don't constrain by audio duration
        effective_audio_duration = audio_duration if has_audio else max_duration

        if request.settings.target_duration and request.settings.target_duration > 0:
            target = max(min_duration_for_images, request.settings.target_duration)
            target = min(target, effective_audio_duration, max_duration)
        else:
            IDEAL_PER_IMAGE = 3.0
            ideal = num_images * IDEAL_PER_IMAGE
            target = max(min_duration, min_duration_for_images, ideal)
            target = min(target, max_duration, effective_audio_duration)

        if target < min_duration_for_images:
            target = min(min_duration_for_images, effective_audio_duration)

        audio_status = "with audio" if has_audio else "no audio"
        logger.info(f"[{job_id}] Target duration: {target:.1f}s ({num_images} images, {audio_status})")
        return target

    def _add_audio_with_effects(
        self,
        video: CompositeVideoClip,
        audio_path: str,
        audio_data: AudioData,
        video_duration: float
    ) -> Tuple[CompositeVideoClip, List]:
        """Add audio with TikTok hook effect and fades."""
        audio_clip = AudioFileClip(audio_path)
        audio_clips_to_close = [audio_clip]

        # Trim audio
        if audio_data.start_time or audio_data.duration:
            start = audio_data.start_time or 0
            duration = audio_data.duration or video_duration
            trimmed = audio_clip.subclipped(start, start + min(duration, audio_clip.duration - start))
            audio_clips_to_close.append(trimmed)
            audio_clip = trimmed

        if audio_clip.duration > video_duration:
            trimmed = audio_clip.subclipped(0, video_duration)
            audio_clips_to_close.append(trimmed)
            audio_clip = trimmed

        # TikTok Hook: Calm start then beat drop
        if audio_clip.duration > HOOK_DURATION:
            from moviepy import concatenate_audioclips
            hook_section = audio_clip.subclipped(0, HOOK_DURATION).with_volume_scaled(HOOK_CALM_FACTOR)
            main_section = audio_clip.subclipped(HOOK_DURATION, audio_clip.duration)
            audio_clips_to_close.extend([hook_section, main_section])
            audio_clip = concatenate_audioclips([hook_section, main_section])
            audio_clips_to_close.append(audio_clip)

        # Fade effects
        faded = audio_clip.with_effects([
            AudioFadeIn(AUDIO_FADE_IN),
            AudioFadeOut(AUDIO_FADE_OUT)
        ])
        audio_clips_to_close.append(faded)

        return video.with_audio(faded), audio_clips_to_close

    def _check_nvenc_available(self) -> bool:
        """Check if NVENC is available on this GPU."""
        import subprocess
        try:
            result = subprocess.run(
                ["ffmpeg", "-hide_banner", "-encoders"],
                capture_output=True, text=True, timeout=10
            )
            # Check if h264_nvenc is listed and test if it works
            if "h264_nvenc" in result.stdout:
                # Try a quick encode test
                test_result = subprocess.run(
                    ["ffmpeg", "-hide_banner", "-f", "lavfi", "-i", "color=black:s=64x64:d=0.1",
                     "-c:v", "h264_nvenc", "-f", "null", "-"],
                    capture_output=True, text=True, timeout=10
                )
                return test_result.returncode == 0
        except Exception:
            pass
        return False

    async def _render_with_nvenc(
        self,
        video: CompositeVideoClip,
        output_path: str,
        temp_audiofile: str,
        job_id: str
    ) -> None:
        """Render video with optimized settings - NVENC if available, else CPU."""
        import time
        is_mac = platform.system() == "Darwin"
        loop = asyncio.get_event_loop()

        # Check if NVENC is actually available (some cloud GPUs don't expose it)
        use_nvenc = not is_mac and self._check_nvenc_available()

        # Log video properties for debugging
        video_duration = getattr(video, 'duration', 'unknown')
        video_size = getattr(video, 'size', 'unknown')
        video_fps = getattr(video, 'fps', 30)
        logger.info(f"[{job_id}] Video properties: duration={video_duration}s, size={video_size}, fps={video_fps}")
        logger.info(f"[{job_id}] Output path: {output_path}")

        start_time = time.time()

        # Set timeout for encoding (5 minutes max for any video)
        ENCODING_TIMEOUT = 300  # 5 minutes

        if use_nvenc:
            # GPU encoding with optimized NVENC parameters for TikTok
            logger.info(f"[{job_id}] Starting NVENC GPU encoding (preset=p1, fastest, timeout={ENCODING_TIMEOUT}s)...")
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: video.write_videofile(
                            output_path,
                            fps=30,
                            codec="h264_nvenc",
                            audio_codec="aac",
                            audio_bitrate="192k",
                            temp_audiofile=temp_audiofile,
                            ffmpeg_params=[
                                "-preset", "p1",
                                "-tune", "ll",
                                "-rc", "vbr",
                                "-cq", "23",
                                "-b:v", "8M",
                                "-maxrate", "12M",
                                "-bufsize", "16M",
                                "-profile:v", "high",
                            ],
                            logger="bar"
                        )
                    ),
                    timeout=ENCODING_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.error(f"[{job_id}] NVENC encoding timed out after {ENCODING_TIMEOUT}s, falling back to CPU")
                # Try CPU encoding as fallback
                await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: video.write_videofile(
                            output_path,
                            fps=30,
                            codec="libx264",
                            audio_codec="aac",
                            audio_bitrate="192k",
                            threads=8,
                            preset="ultrafast",
                            ffmpeg_params=["-crf", "28"],
                            temp_audiofile=temp_audiofile,
                            logger="bar"
                        )
                    ),
                    timeout=ENCODING_TIMEOUT
                )
            elapsed = time.time() - start_time
            logger.info(f"[{job_id}] NVENC encoding completed in {elapsed:.2f}s")
        else:
            # CPU encoding with optimized libx264 (fast preset, 8 threads)
            logger.info(f"[{job_id}] Starting CPU encoding (libx264, preset=fast, threads=8, timeout={ENCODING_TIMEOUT}s)...")
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: video.write_videofile(
                            output_path,
                            fps=30,
                            codec="libx264",
                            audio_codec="aac",
                            audio_bitrate="192k",
                            threads=8,
                            preset="fast",
                            ffmpeg_params=["-crf", "23"],
                            temp_audiofile=temp_audiofile,
                            logger="bar"
                        )
                    ),
                    timeout=ENCODING_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.error(f"[{job_id}] CPU encoding timed out after {ENCODING_TIMEOUT}s")
                raise RuntimeError(f"Video encoding timed out after {ENCODING_TIMEOUT}s")
            elapsed = time.time() - start_time
            logger.info(f"[{job_id}] CPU encoding completed in {elapsed:.2f}s")

    def _cleanup_clips(
        self,
        video: CompositeVideoClip,
        clips: List[ImageClip],
        audio_clips: List
    ) -> None:
        """Clean up all clips and force garbage collection."""
        import gc

        for aclip in audio_clips:
            try:
                aclip.close()
            except Exception:
                pass

        try:
            video.close()
        except Exception:
            pass

        for clip in clips:
            try:
                clip.close()
            except Exception:
                pass

        gc.collect()

    async def _get_ai_effects(
        self,
        settings: RenderSettings,
        num_images: int,
        bpm: Optional[float],
        job_id: str
    ) -> AIEffectSelection:
        """
        Get AI effects - either from pre-selected settings or auto-select.
        """
        # Import blacklist
        from ..effects.registry import BLACKLISTED_EFFECTS

        # If AI effects already provided, use them (but filter out blacklisted)
        if settings.ai_effects and settings.ai_effects.transitions:
            # Filter out blacklisted effects from pre-selected transitions
            filtered_transitions = [
                t for t in settings.ai_effects.transitions
                if t not in BLACKLISTED_EFFECTS
            ]
            if len(filtered_transitions) < len(settings.ai_effects.transitions):
                removed = set(settings.ai_effects.transitions) - set(filtered_transitions)
                logger.warning(f"[{job_id}] Removed blacklisted effects from pre-selected: {removed}")

            if filtered_transitions:
                logger.info(f"[{job_id}] Using pre-selected AI effects: {len(filtered_transitions)} transitions")
                return AIEffectSelection(
                    transitions=filtered_transitions,
                    motions=settings.ai_effects.motions,
                    filters=settings.ai_effects.filters,
                    text_animations=settings.ai_effects.text_animations,
                    overlays=settings.ai_effects.overlays if settings.ai_effects.overlays else [],
                    analysis=settings.ai_effects.analysis
                )
            # If all transitions were blacklisted, fall through to auto-select
            logger.warning(f"[{job_id}] All pre-selected transitions were blacklisted, auto-selecting...")

        # Auto-select based on prompt
        prompt = settings.ai_prompt or ""
        if not prompt:
            # Generate default prompt based on vibe
            vibe_prompts = {
                "Exciting": "energetic fast-paced dynamic video",
                "Emotional": "emotional heartfelt touching video",
                "Pop": "trendy popular style video",
                "Minimal": "clean minimal elegant video"
            }
            prompt = vibe_prompts.get(settings.vibe.value, "modern stylish video")

        logger.info(f"[{job_id}] Auto-selecting AI effects for prompt: '{prompt[:50]}...'")

        # Try to get analyzer (requires google-generativeai)
        try:
            from ..effects import get_analyzer
            if get_analyzer is not None:
                analyzer = get_analyzer()
                analysis = await analyzer.analyze(prompt, bpm=int(bpm) if bpm else None)
            else:
                # Use fallback analysis
                analysis = self._create_fallback_analysis(prompt, bpm)
        except Exception as e:
            logger.warning(f"[{job_id}] Analyzer failed: {e}, using fallback")
            analysis = self._create_fallback_analysis(prompt, bpm)

        # Select effects based on analysis
        # We need exactly (num_images - 1) transitions, one for each cut between images
        # Request that many unique transitions so each cut has a different effect
        num_transitions_needed = num_images - 1
        config = SelectionConfig(
            num_transitions=num_transitions_needed,  # One unique transition per cut
            num_motions=2,
            num_filters=1,
            num_overlays=random.randint(2, 4),  # Randomly select 2-4 overlay effects
            gpu_available=True,
            diversity_weight=0.5,  # Higher diversity to ensure different effects
        )

        selected = self.effect_selector.select(analysis, config)

        logger.info(f"[{job_id}] AI selected: {len(selected.transitions)} transitions, {len(selected.motions)} motions, {len(selected.overlays)} overlays")

        return AIEffectSelection(
            transitions=[e.id for e in selected.transitions],
            motions=[e.id for e in selected.motions],
            filters=[e.id for e in selected.filters],
            text_animations=[e.id for e in selected.text_animations],
            overlays=[e.id for e in selected.overlays],
            analysis={
                "moods": analysis.moods,
                "genres": analysis.genres,
                "keywords": analysis.keywords,
                "intensity": analysis.intensity,
                "suggested_colors": analysis.suggested_colors.to_dict() if analysis.suggested_colors else None,
            }
        )

    def _create_fallback_analysis(self, prompt: str, bpm: Optional[float]):
        """Create fallback analysis when Gemini analyzer is unavailable."""
        from ..effects.selector import PromptAnalysis

        # Simple keyword matching
        # Valid moods: energetic, calm, dramatic, playful, elegant, romantic, dark, bright, mysterious, modern
        # Valid genres: kpop, hiphop, emotional, corporate, tiktok, cinematic, vlog, documentary, edm, indie
        prompt_lower = prompt.lower()

        moods = []
        if any(w in prompt_lower for w in ["exciting", "energetic", "fast", "dynamic", "빠른", "신나는"]):
            moods.append("energetic")
        if any(w in prompt_lower for w in ["emotional", "touching", "sad", "감성", "슬픈"]):
            moods.append("romantic")  # romantic is a valid mood
        if any(w in prompt_lower for w in ["calm", "peaceful", "relaxing", "차분한", "평화"]):
            moods.append("calm")
        if any(w in prompt_lower for w in ["dramatic", "epic", "intense", "극적인"]):
            moods.append("dramatic")
        if any(w in prompt_lower for w in ["playful", "fun", "cute", "귀여운", "재미"]):
            moods.append("playful")
        if any(w in prompt_lower for w in ["dark", "mysterious", "어두운"]):
            moods.append("dark")
        if any(w in prompt_lower for w in ["bright", "happy", "밝은"]):
            moods.append("bright")

        # Default to common moods that match many effects
        if not moods:
            moods = ["modern", "energetic"]

        genres = []
        if any(w in prompt_lower for w in ["kpop", "k-pop", "케이팝", "아이돌"]):
            genres.append("kpop")
        if any(w in prompt_lower for w in ["tiktok", "틱톡", "shorts", "숏폼", "reels"]):
            genres.append("tiktok")
        if any(w in prompt_lower for w in ["cinematic", "movie", "영화", "시네마틱"]):
            genres.append("cinematic")
        if any(w in prompt_lower for w in ["hiphop", "hip-hop", "힙합", "랩"]):
            genres.append("hiphop")
        if any(w in prompt_lower for w in ["edm", "electronic", "일렉트로닉", "댄스"]):
            genres.append("edm")
        if any(w in prompt_lower for w in ["vlog", "브이로그", "일상"]):
            genres.append("vlog")

        # Infer genre from detected moods when no explicit genre found
        if not genres:
            if "energetic" in moods or "modern" in moods:
                genres = ["pop"]
            elif "romantic" in moods or "calm" in moods:
                genres = ["emotional"]
            elif "dramatic" in moods:
                genres = ["cinematic"]
            else:
                genres = ["pop"]  # Neutral fallback when no context available

        # Determine intensity from BPM
        intensity = "medium"
        if bpm:
            if bpm > 130:
                intensity = "high"
            elif bpm < 90:
                intensity = "low"

        # Detect language from prompt (Korean characters present = ko)
        import re
        has_korean = bool(re.search(r'[가-힣]', prompt))
        language = "ko" if has_korean else "en"

        return PromptAnalysis(
            moods=moods,
            genres=genres,
            keywords=prompt.split()[:5],
            intensity=intensity,
            reasoning="Fallback analysis (AI analyzer unavailable)",
            language=language
        )

    def _adjust_script_timings(
        self,
        script: ScriptData,
        video_duration: float,
        job_id: str
    ) -> ScriptData:
        """Adjust script timings to fit within video duration."""
        from ..models.render_job import ScriptLine

        if not script.lines:
            return script

        num_lines = len(script.lines)
        SUBTITLE_GAP = 0.5
        MIN_SUBTITLE_DURATION = 1.5
        MAX_SUBTITLE_DURATION = 4.0

        adjusted_lines = []

        if num_lines == 1:
            line = script.lines[0]
            adjusted_lines.append(ScriptLine(
                text=line.text,
                timing=0.5,
                duration=min(video_duration - 1.0, MAX_SUBTITLE_DURATION)
            ))
        else:
            total_available = video_duration - 0.5
            total_gaps = (num_lines - 1) * SUBTITLE_GAP
            total_subtitle_time = total_available - total_gaps

            duration_per = total_subtitle_time / num_lines
            duration_per = max(MIN_SUBTITLE_DURATION, min(MAX_SUBTITLE_DURATION, duration_per))

            if duration_per * num_lines + total_gaps > total_available:
                duration_per = MIN_SUBTITLE_DURATION
                SUBTITLE_GAP = max(0.2, (total_available - duration_per * num_lines) / max(1, num_lines - 1))

            current_time = 0.3

            for i, line in enumerate(script.lines):
                timing = current_time
                duration = duration_per

                if timing + duration > video_duration - 0.3:
                    duration = video_duration - timing - 0.3
                    if duration < 1.0:
                        continue

                adjusted_lines.append(ScriptLine(
                    text=line.text,
                    timing=timing,
                    duration=duration
                ))

                current_time = timing + duration + SUBTITLE_GAP

        return ScriptData(lines=adjusted_lines)

    def _add_text_overlays(
        self,
        video: CompositeVideoClip,
        script: ScriptData,
        style: str,
        aspect_ratio: str,
        text_animations: Optional[List[str]] = None
    ) -> CompositeVideoClip:
        """Add script text as overlays with AI-selected animations."""
        sizes = {
            "9:16": (1080, 1920),
            "16:9": (1920, 1080),
            "1:1": (1080, 1080)
        }
        video_size = sizes.get(aspect_ratio, (1080, 1920))

        text_clips = [video]
        num_lines = len(script.lines)

        for idx, line in enumerate(script.lines):
            try:
                # Select animation for this line
                # Cycle through available animations for variety
                animation = None
                if text_animations and len(text_animations) > 0:
                    animation = text_animations[idx % len(text_animations)]

                txt_clip = text_overlay.create_text_clip(
                    text=line.text,
                    start=line.timing,
                    duration=line.duration,
                    style=style,
                    video_size=video_size,
                    animation=animation
                )
                text_clips.append(txt_clip)
            except Exception as e:
                logger.error(f"Failed to create text clip: {e}")
                continue

        if text_animations:
            logger.info(f"Applied text animations: {text_animations} to {num_lines} lines")

        return CompositeVideoClip(text_clips)

    async def _update_progress(
        self,
        callback: Optional[Callable],
        job_id: str,
        progress: int,
        step: str
    ):
        """Update progress via callback if provided."""
        if callback:
            await callback(job_id, progress, step)
