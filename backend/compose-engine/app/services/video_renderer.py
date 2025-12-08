"""Main video rendering service using MoviePy - Optimized for GPU and parallel processing."""

import os
import platform

# CRITICAL: Set FFmpeg path BEFORE importing moviepy/imageio
# This tells imageio_ffmpeg to use jellyfin-ffmpeg with NVENC support
if platform.system() != "Darwin":  # Not macOS
    JELLYFIN_FFMPEG = "/usr/lib/jellyfin-ffmpeg/ffmpeg"
    if os.path.exists(JELLYFIN_FFMPEG):
        os.environ["IMAGEIO_FFMPEG_EXE"] = JELLYFIN_FFMPEG
        print(f"[FFmpeg] Using jellyfin-ffmpeg: {JELLYFIN_FFMPEG}")

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
from ..effects.renderers import get_renderer, RendererAdapter
from ..effects.renderers.adapter import TransitionSpec
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
    """Main service for rendering composed videos - Optimized for GPU and parallel processing."""

    def __init__(self):
        self.s3 = S3Client()
        self.audio_analyzer = AudioAnalyzer()
        self.beat_sync = BeatSyncEngine()
        self.image_processor = ImageProcessor()
        self.temp = TempFileManager()
        self.effect_selector = EffectSelector()
        self.renderer_adapter = get_renderer(prefer_gpu=True)

    async def render(
        self,
        request: RenderRequest,
        progress_callback: Optional[Callable] = None
    ) -> str:
        """
        Optimized rendering pipeline with parallel processing.
        Returns S3 URL of rendered video.
        """
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
            audio_analysis = await self._get_audio_analysis(audio_path, audio_url)
            beat_times = audio_analysis.beat_times

            # ============================================================
            # STEP 3: CALCULATE TIMINGS
            # ============================================================
            await self._update_progress(progress_callback, job_id, 20, "Calculating timings")

            preset = get_preset(request.settings.vibe.value)
            has_audio = audio_path is not None
            target_duration = self._calculate_target_duration(
                request, preset, len(image_paths), audio_analysis.duration, job_id, has_audio
            )

            cut_times = self.beat_sync.calculate_cuts(
                beat_times=beat_times,
                num_images=len(image_paths),
                target_duration=target_duration,
                cut_style=preset.cut_style
            )

            # ============================================================
            # STEP 4: PARALLEL IMAGE PROCESSING
            # ============================================================
            await self._update_progress(progress_callback, job_id, 25, "Processing images")

            processed_paths = await self._process_images_parallel(
                image_paths,
                request.settings.aspect_ratio.value,
                job_id
            )
            logger.info(f"[{job_id}] Processed {len(processed_paths)} images in parallel")

            # ============================================================
            # STEP 5: CREATE CLIPS (can be parallelized for large batches)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 35, "Creating video clips")

            clips = await self._create_clips_parallel(
                processed_paths, cut_times, preset,
                request.settings.aspect_ratio.value, beat_times, job_id
            )

            # ============================================================
            # STEP 6: GET AI EFFECTS (for transitions and text animations)
            # ============================================================
            ai_effects = None
            if request.settings.use_ai_effects:
                ai_effects = await self._get_ai_effects(
                    settings=request.settings,
                    num_images=len(image_paths),
                    bpm=audio_analysis.bpm,
                    job_id=job_id
                )
                logger.info(f"[{job_id}] AI effects - transitions: {len(ai_effects.transitions)}, text_animations: {len(ai_effects.text_animations)}")

            # ============================================================
            # STEP 7: APPLY TRANSITIONS (simple crossfade only)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 55, "Applying transitions")

            # SIMPLIFIED: Always use basic crossfade with 0.2s duration
            # This avoids all the complex GL/xfade rendering issues
            SIMPLE_TRANSITION_DURATION = 0.2
            logger.info(f"[{job_id}] Applying simple crossfade transitions (duration={SIMPLE_TRANSITION_DURATION}s)")
            video = transitions.apply_crossfade(clips, duration=SIMPLE_TRANSITION_DURATION)

            # ============================================================
            # STEP 8: ADD TEXT OVERLAYS (with AI-selected animations)
            # ============================================================
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
            audio_clips_to_close = []
            if audio_path and request.audio:
                await self._update_progress(progress_callback, job_id, 75, "Adding audio")
                video, audio_clips_to_close = self._add_audio_with_effects(
                    video, audio_path, request.audio, video.duration
                )
            else:
                logger.info(f"[{job_id}] Skipping audio - generating silent video")

            # ============================================================
            # STEP 10: COLOR GRADING
            # ============================================================
            await self._update_progress(progress_callback, job_id, 78, "Color grading")
            video = filters.apply_color_grade(video, request.settings.color_grade.value)

            # ============================================================
            # STEP 11: APPLY AI-SELECTED OVERLAY EFFECTS (Dynamic Parameters)
            # ============================================================
            if ai_effects and ai_effects.overlays:
                await self._update_progress(progress_callback, job_id, 82, "Adding overlay effects")

                # Convert overlay IDs to filter function IDs (remove 'overlay_' prefix)
                overlay_types = []
                for overlay_id in ai_effects.overlays:
                    # Map from catalog ID to generic type (e.g., "overlay_light_leak" → "light_leak")
                    overlay_type = overlay_id.replace("overlay_", "")
                    overlay_types.append(overlay_type)

                # Extract analysis data for dynamic parameter selection
                analysis_data = ai_effects.analysis or {}
                moods = analysis_data.get("moods", [])
                intensity = analysis_data.get("intensity", "medium")
                bpm = int(audio_analysis.bpm) if audio_analysis.bpm else None
                suggested_colors = analysis_data.get("suggested_colors")  # AI-suggested colors

                logger.info(f"[{job_id}] Applying dynamic overlays: types={overlay_types}, moods={moods}, intensity={intensity}, bpm={bpm}, colors={suggested_colors}")

                # Use dynamic overlay system that selects variants based on mood/audio
                video = filters.apply_overlay_effects_dynamic(
                    video,
                    overlay_types=overlay_types,
                    moods=moods,
                    intensity=intensity,
                    bpm=bpm,
                    suggested_colors=suggested_colors,
                )

            # ============================================================
            # STEP 12: GPU RENDER WITH OPTIMIZED NVENC
            # ============================================================
            await self._update_progress(progress_callback, job_id, 85, "Rendering video")

            output_path = self.temp.get_path(job_id, "output.mp4")
            temp_audiofile = self.temp.get_path(job_id, f"temp_audio_{job_id}.mp4")

            await self._render_with_nvenc(video, output_path, temp_audiofile, job_id)

            # ============================================================
            # STEP 13: CLEANUP AND UPLOAD
            # ============================================================
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

        # Analyze audio (CPU-bound, run in thread pool)
        loop = asyncio.get_event_loop()
        analysis = await loop.run_in_executor(
            get_cpu_executor(),
            lambda: self.audio_analyzer.analyze(audio_path)
        )

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

        return AudioAnalysis(
            bpm=DEFAULT_BPM,
            beat_times=beat_times,
            duration=DEFAULT_DURATION,
            energy_profile=[0.5] * 10,  # Neutral energy
            segments=[]
        )

    async def _process_images_parallel(
        self,
        image_paths: List[str],
        aspect_ratio: str,
        job_id: str
    ) -> List[str]:
        """Process images in parallel using thread pool."""
        loop = asyncio.get_event_loop()

        async def process_one(i: int, img_path: str) -> str:
            output_path = self.temp.get_path(job_id, f"processed_{i}.jpg")
            return await loop.run_in_executor(
                get_cpu_executor(),
                lambda: self.image_processor.resize_for_aspect(img_path, aspect_ratio, output_path)
            )

        tasks = [
            process_one(i, img_path)
            for i, img_path in enumerate(image_paths)
        ]

        return await asyncio.gather(*tasks)

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

            # Get diverse motion style for this clip
            motion_style = get_motion_style(clip_index, total_clips, preset.motion_style)

            clip = motion.apply_ken_burns(
                clip,
                style=motion_style,
                beat_times=[t - start for t in beat_times if start <= t < end]
            )
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
        is_mac = platform.system() == "Darwin"
        loop = asyncio.get_event_loop()

        # Check if NVENC is actually available (some cloud GPUs don't expose it)
        use_nvenc = not is_mac and self._check_nvenc_available()

        if use_nvenc:
            # GPU encoding with optimized NVENC parameters for TikTok
            # - preset p4 (balanced speed/quality)
            # - cq 23 (constant quality, good for social media)
            # - b:v 8M (target bitrate for TikTok HD)
            logger.info(f"[{job_id}] Using NVENC GPU encoding")
            await loop.run_in_executor(
                None,
                lambda: video.write_videofile(
                    output_path,
                    fps=30,
                    codec="h264_nvenc",
                    audio_codec="aac",
                    audio_bitrate="192k",
                    temp_audiofile=temp_audiofile,
                    ffmpeg_params=[
                        "-preset", "p4",       # Fast encoding (p1=fastest, p7=slowest)
                        "-tune", "hq",         # High quality tuning
                        "-rc", "vbr",          # Variable bitrate
                        "-cq", "23",           # Constant quality (18-28, lower=better)
                        "-b:v", "8M",          # Target bitrate
                        "-maxrate", "12M",     # Max bitrate spike
                        "-bufsize", "16M",     # Buffer size
                        "-profile:v", "high",  # H.264 High profile (auto level)
                    ],
                    logger=None
                )
            )
            logger.info(f"[{job_id}] Rendered with GPU (NVENC h264_nvenc, preset=p4)")
        else:
            # CPU encoding with optimized libx264 (fast preset, 8 threads)
            # Still benefits from GPU for cupy image processing and color grading
            logger.info(f"[{job_id}] Using CPU encoding (libx264) - NVENC not available")
            await loop.run_in_executor(
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
                    logger=None
                )
            )
            logger.info(f"[{job_id}] Rendered with CPU (libx264, preset=fast, threads=8)")

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

    async def _apply_ai_transitions(
        self,
        clips: List[ImageClip],
        settings: RenderSettings,
        num_images: int,
        bpm: Optional[float],
        preset,
        job_dir: str,
        job_id: str
    ) -> CompositeVideoClip:
        """
        Apply AI-selected transitions to clips.

        Uses either pre-selected effects from settings.ai_effects
        or auto-selects based on ai_prompt using the EffectSelector.
        """
        try:
            # Get AI effects (pre-selected or auto-select)
            ai_effects = await self._get_ai_effects(settings, num_images, bpm, job_id)

            if not ai_effects.transitions:
                # Fallback to default preset if no AI transitions
                logger.warning(f"[{job_id}] No AI transitions selected, using preset fallback")
                effect_preset = settings.effect_preset.value if settings.effect_preset else preset.transition_type
                transition_func = transitions.get_transition(effect_preset)
                return transition_func(clips, duration=preset.transition_duration)

            # Build transition specs from AI selections
            # Ensure each transition uses a different effect for variety
            transition_specs = []
            num_transitions_needed = len(clips) - 1
            available_effects = ai_effects.transitions.copy()

            for i in range(num_transitions_needed):
                if available_effects:
                    # Use each effect once before repeating
                    effect_id = available_effects.pop(0)
                    # Refill when exhausted (only if we need more than available)
                    if not available_effects and i < num_transitions_needed - 1:
                        available_effects = ai_effects.transitions.copy()
                else:
                    # Fallback to cycling if something goes wrong
                    effect_id = ai_effects.transitions[i % len(ai_effects.transitions)]

                transition_specs.append(TransitionSpec(
                    effect_id=effect_id,
                    duration=preset.transition_duration
                ))

            # Log all transitions to verify diversity
            all_effects = [t.effect_id for t in transition_specs]
            print(f"[VIDEO_RENDERER][{job_id}] About to apply {len(transition_specs)} AI transitions: {all_effects}")
            logger.info(f"[{job_id}] Applying {len(transition_specs)} AI transitions: {all_effects}")

            # Use renderer adapter (with xfade fallback)
            video = self.renderer_adapter.apply_transitions_to_clips(
                clips=clips,
                transitions=transition_specs,
                temp_dir=job_dir,
                job_id=job_id
            )

            if video is not None:
                return video

            # Fallback if adapter fails
            logger.warning(f"[{job_id}] Renderer adapter failed, using MoviePy fallback")
            transition_func = transitions.get_transition("crossfade")
            return transition_func(clips, duration=preset.transition_duration)

        except Exception as e:
            logger.error(f"[{job_id}] AI transition error: {e}, using preset fallback")
            effect_preset = settings.effect_preset.value if settings.effect_preset else preset.transition_type
            transition_func = transitions.get_transition(effect_preset)
            return transition_func(clips, duration=preset.transition_duration)

    async def _apply_ai_transitions_with_effects(
        self,
        clips: List[ImageClip],
        ai_effects: AIEffectSelection,
        preset,
        job_dir: str,
        job_id: str
    ) -> CompositeVideoClip:
        """
        Apply AI-selected transitions using pre-fetched effects.

        This is a variant of _apply_ai_transitions that takes already-fetched
        AI effects to allow sharing between transitions and text animations.
        """
        try:
            if not ai_effects.transitions:
                # Fallback to default preset if no AI transitions
                logger.warning(f"[{job_id}] No AI transitions selected, using preset fallback")
                transition_func = transitions.get_transition(preset.transition_type)
                return transition_func(clips, duration=preset.transition_duration)

            # Build transition specs from AI selections
            # Ensure each transition uses a different effect for variety
            transition_specs = []
            num_transitions_needed = len(clips) - 1
            available_effects = ai_effects.transitions.copy()

            for i in range(num_transitions_needed):
                if available_effects:
                    # Use each effect once before repeating
                    effect_id = available_effects.pop(0)
                    # Refill when exhausted (only if we need more than available)
                    if not available_effects and i < num_transitions_needed - 1:
                        available_effects = ai_effects.transitions.copy()
                else:
                    # Fallback to cycling if something goes wrong
                    effect_id = ai_effects.transitions[i % len(ai_effects.transitions)]

                transition_specs.append(TransitionSpec(
                    effect_id=effect_id,
                    duration=preset.transition_duration
                ))

            # Log all transitions to verify diversity
            all_effects = [t.effect_id for t in transition_specs]
            print(f"[VIDEO_RENDERER][{job_id}] About to apply {len(transition_specs)} AI transitions: {all_effects}")
            logger.info(f"[{job_id}] Applying {len(transition_specs)} AI transitions: {all_effects}")

            # Use renderer adapter (with xfade fallback)
            video = self.renderer_adapter.apply_transitions_to_clips(
                clips=clips,
                transitions=transition_specs,
                temp_dir=job_dir,
                job_id=job_id
            )

            if video is not None:
                return video

            # Fallback if adapter fails
            logger.warning(f"[{job_id}] Renderer adapter failed, using MoviePy fallback")
            transition_func = transitions.get_transition("crossfade")
            return transition_func(clips, duration=preset.transition_duration)

        except Exception as e:
            logger.error(f"[{job_id}] AI transition error: {e}, using preset fallback")
            transition_func = transitions.get_transition(preset.transition_type)
            return transition_func(clips, duration=preset.transition_duration)

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

        return PromptAnalysis(
            moods=moods,
            genres=genres,
            keywords=prompt.split()[:5],
            intensity=intensity
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
