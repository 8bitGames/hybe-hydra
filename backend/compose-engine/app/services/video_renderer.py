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
from ..presets import get_preset
from ..utils.s3_client import S3Client
from ..utils.temp_files import TempFileManager
from ..models.render_job import (
    RenderRequest,
    ImageData,
    AudioData,
    ScriptData,
    RenderSettings
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
        _cpu_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="cpu_pool")
    return _cpu_executor


class VideoRenderer:
    """Main service for rendering composed videos - Optimized for GPU and parallel processing."""

    def __init__(self):
        self.s3 = S3Client()
        self.audio_analyzer = AudioAnalyzer()
        self.beat_sync = BeatSyncEngine()
        self.image_processor = ImageProcessor()
        self.temp = TempFileManager()

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
            logger.info(f"[{job_id}] Downloaded {len(image_paths)} images + audio in parallel")

            # ============================================================
            # STEP 2: AUDIO ANALYSIS (with caching for variations)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 15, "Analyzing audio")

            audio_analysis = await self._get_audio_analysis(audio_path, request.audio.url)
            beat_times = audio_analysis.beat_times

            # ============================================================
            # STEP 3: CALCULATE TIMINGS
            # ============================================================
            await self._update_progress(progress_callback, job_id, 20, "Calculating timings")

            preset = get_preset(request.settings.vibe.value)
            target_duration = self._calculate_target_duration(
                request, preset, len(image_paths), audio_analysis.duration, job_id
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
            # STEP 6: APPLY TRANSITIONS
            # ============================================================
            await self._update_progress(progress_callback, job_id, 55, "Applying transitions")

            effect_preset = request.settings.effect_preset.value if request.settings.effect_preset else preset.transition_type
            transition_func = transitions.get_transition(effect_preset)
            video = transition_func(clips, duration=preset.transition_duration)

            # ============================================================
            # STEP 7: ADD TEXT OVERLAYS
            # ============================================================
            await self._update_progress(progress_callback, job_id, 65, "Adding text overlays")

            video_duration = video.duration
            if request.script and request.script.lines:
                adjusted_script = self._adjust_script_timings(request.script, video_duration, job_id)
                video = self._add_text_overlays(
                    video, adjusted_script,
                    request.settings.text_style.value,
                    request.settings.aspect_ratio.value
                )

            # ============================================================
            # STEP 8: ADD AUDIO WITH TIKTOK HOOK
            # ============================================================
            await self._update_progress(progress_callback, job_id, 75, "Adding audio")

            video, audio_clips_to_close = self._add_audio_with_effects(
                video, audio_path, request.audio, video.duration
            )

            # ============================================================
            # STEP 9: COLOR GRADING
            # ============================================================
            await self._update_progress(progress_callback, job_id, 80, "Color grading")
            video = filters.apply_color_grade(video, request.settings.color_grade.value)

            # ============================================================
            # STEP 10: GPU RENDER WITH OPTIMIZED NVENC
            # ============================================================
            await self._update_progress(progress_callback, job_id, 85, "Rendering video")

            output_path = self.temp.get_path(job_id, "output.mp4")
            temp_audiofile = self.temp.get_path(job_id, f"temp_audio_{job_id}.mp4")

            await self._render_with_nvenc(video, output_path, temp_audiofile, job_id)

            # ============================================================
            # STEP 11: CLEANUP AND UPLOAD
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
        audio: AudioData,
        job_dir: str
    ) -> Tuple[List[str], str]:
        """Download images and audio in parallel, handling failures gracefully."""
        sorted_images = sorted(images, key=lambda x: x.order)

        # Download audio first (critical - must succeed)
        audio_path = os.path.join(job_dir, "audio.mp3")
        await self.s3.download_file(audio.url, audio_path)
        logger.info(f"Audio downloaded: {audio_path}")

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

    async def _get_audio_analysis(self, audio_path: str, audio_url: str) -> AudioAnalysis:
        """Get audio analysis with caching (for compose variations using same audio)."""
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
        """Create image clips (parallelized for large batches)."""
        loop = asyncio.get_event_loop()

        def create_one(img_path: str, start: float, end: float) -> ImageClip:
            duration = end - start
            clip = ImageClip(img_path).with_duration(duration)
            clip = motion.apply_ken_burns(
                clip,
                style=preset.motion_style,
                beat_times=[t - start for t in beat_times if start <= t < end]
            )
            return clip.with_start(start)

        # For small batches, just create sequentially (overhead of parallelization not worth it)
        if len(processed_paths) <= 4:
            return [
                create_one(img_path, start, end)
                for img_path, (start, end) in zip(processed_paths, cut_times)
            ]

        # For larger batches, use parallel processing
        tasks = [
            loop.run_in_executor(
                get_cpu_executor(),
                lambda p=img_path, s=start, e=end: create_one(p, s, e)
            )
            for img_path, (start, end) in zip(processed_paths, cut_times)
        ]

        return await asyncio.gather(*tasks)

    def _calculate_target_duration(
        self,
        request: RenderRequest,
        preset,
        num_images: int,
        audio_duration: float,
        job_id: str
    ) -> float:
        """Calculate optimal target duration for TikTok."""
        min_duration, max_duration = preset.duration_range
        min_duration_for_images = num_images * MIN_IMAGE_DURATION

        if request.settings.target_duration and request.settings.target_duration > 0:
            target = max(min_duration_for_images, request.settings.target_duration)
            target = min(target, audio_duration, max_duration)
        else:
            IDEAL_PER_IMAGE = 3.0
            ideal = num_images * IDEAL_PER_IMAGE
            target = max(min_duration, min_duration_for_images, ideal)
            target = min(target, max_duration, audio_duration)

        if target < min_duration_for_images:
            target = min(min_duration_for_images, audio_duration)

        logger.info(f"[{job_id}] Target duration: {target:.1f}s ({num_images} images)")
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

    async def _render_with_nvenc(
        self,
        video: CompositeVideoClip,
        output_path: str,
        temp_audiofile: str,
        job_id: str
    ) -> None:
        """Render video with optimized NVENC settings for TikTok."""
        is_mac = platform.system() == "Darwin"
        loop = asyncio.get_event_loop()

        if not is_mac:
            # GPU encoding with optimized NVENC parameters for TikTok
            # - preset p4 (balanced speed/quality)
            # - cq 23 (constant quality, good for social media)
            # - b:v 8M (target bitrate for TikTok HD)
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
            # macOS: CPU encoding
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
            logger.info(f"[{job_id}] Rendered with CPU (libx264)")

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
        aspect_ratio: str
    ) -> CompositeVideoClip:
        """Add script text as overlays."""
        sizes = {
            "9:16": (1080, 1920),
            "16:9": (1920, 1080),
            "1:1": (1080, 1080)
        }
        video_size = sizes.get(aspect_ratio, (1080, 1920))

        text_clips = [video]
        for line in script.lines:
            try:
                txt_clip = text_overlay.create_text_clip(
                    text=line.text,
                    start=line.timing,
                    duration=line.duration,
                    style=style,
                    video_size=video_size
                )
                text_clips.append(txt_clip)
            except Exception as e:
                logger.error(f"Failed to create text clip: {e}")
                continue

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
