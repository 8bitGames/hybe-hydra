"""Pure FFmpeg video rendering service - No MoviePy dependency.

This renderer uses only FFmpeg for all video processing:
- Image to video conversion with Ken Burns motion
- xfade transitions between clips
- Color grading, vignette, film grain filters
- Audio mixing and fading
- Text overlays via drawtext filter
- Final encoding (NVENC GPU or libx264 CPU)
"""

import os
import platform
import asyncio
import logging
import hashlib
import subprocess
import shutil
from typing import Callable, Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor

from .audio_analyzer import AudioAnalyzer
from ..models.responses import AudioAnalysis
from ..utils.s3_client import S3Client
from ..utils.temp_files import TempFileManager
from ..effects.renderers.xfade_renderer import (
    XfadeRenderer,
    ClipSegment,
    XFADE_TRANSITIONS,
    FFMPEG_COLOR_GRADES,
    get_vignette_filter,
    get_film_grain_filter,
)
from ..presets import get_preset
from ..models.render_job import (
    RenderRequest,
    ImageData,
    AudioData,
    ScriptData,
    RenderSettings,
)


logger = logging.getLogger(__name__)

# Audio fade durations (seconds)
AUDIO_FADE_IN = 1.0
AUDIO_FADE_OUT = 2.0

# TikTok Hook Strategy
HOOK_DURATION = 2.0
HOOK_CALM_FACTOR = 0.7

# Audio analysis cache
_audio_cache: dict = {}
_audio_cache_lock = asyncio.Lock()

# Thread pool for CPU-bound tasks
_cpu_executor: Optional[ThreadPoolExecutor] = None


def get_cpu_executor() -> ThreadPoolExecutor:
    """Get shared thread pool for CPU-bound tasks."""
    global _cpu_executor
    if _cpu_executor is None:
        _cpu_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="cpu_pool")
    return _cpu_executor


class VideoRenderer:
    """Pure FFmpeg video renderer - no MoviePy dependency."""

    def __init__(self):
        self.s3 = S3Client()
        self.audio_analyzer = AudioAnalyzer()
        self.temp = TempFileManager()
        self.xfade = XfadeRenderer()
        self.ffmpeg_path = self._find_ffmpeg()
        self.ffprobe_path = os.path.join(os.path.dirname(self.ffmpeg_path), "ffprobe")

    def _find_ffmpeg(self) -> str:
        """Find FFmpeg binary path."""
        jellyfin_path = "/usr/lib/jellyfin-ffmpeg/ffmpeg"
        if os.path.exists(jellyfin_path):
            return jellyfin_path
        return shutil.which("ffmpeg") or "ffmpeg"

    async def render(
        self,
        request: RenderRequest,
        progress_callback: Optional[Callable] = None
    ) -> str:
        """
        Pure FFmpeg rendering pipeline.
        Returns S3 URL of rendered video.
        """
        job_id = request.job_id
        job_dir = self.temp.get_job_dir(job_id)

        try:
            logger.info(f"[{job_id}] Starting pure FFmpeg render with {len(request.images)} images")
            print(f"[{job_id}] === PURE FFMPEG RENDERER (No MoviePy) ===")

            # ============================================================
            # STEP 1: DOWNLOAD ASSETS
            # ============================================================
            await self._update_progress(progress_callback, job_id, 0, "Downloading assets")

            image_paths, audio_path = await self._download_all_assets(
                request.images, request.audio, job_dir
            )
            logger.info(f"[{job_id}] Downloaded {len(image_paths)} images")

            # ============================================================
            # STEP 2: AUDIO ANALYSIS
            # ============================================================
            await self._update_progress(progress_callback, job_id, 10, "Analyzing audio")

            audio_url = request.audio.url if request.audio else None
            audio_analysis = await self._get_audio_analysis(audio_path, audio_url)
            logger.info(f"[{job_id}] BPM={audio_analysis.bpm}, beats={len(audio_analysis.beat_times)}")

            # ============================================================
            # STEP 3: CALCULATE TIMINGS
            # ============================================================
            await self._update_progress(progress_callback, job_id, 15, "Calculating timings")

            preset = get_preset(request.settings.vibe.value)
            has_audio = audio_path is not None

            # Calculate target duration
            target_duration = self._calculate_target_duration(
                request, preset, len(image_paths), audio_analysis.duration, job_id, has_audio
            )

            # BPM-based image duration (400-800ms range)
            MIN_DURATION = 0.4
            MAX_DURATION = 0.8
            DEFAULT_DURATION = 0.6

            if audio_analysis.bpm and audio_analysis.bpm > 0:
                beat_duration = 60.0 / audio_analysis.bpm
                IMAGE_DURATION = max(MIN_DURATION, min(MAX_DURATION, beat_duration))
            else:
                IMAGE_DURATION = DEFAULT_DURATION

            num_total_clips = max(1, int(target_duration / IMAGE_DURATION))
            logger.info(f"[{job_id}] {IMAGE_DURATION*1000:.0f}ms per image, {num_total_clips} total clips")

            # ============================================================
            # STEP 4: GET TARGET SIZE FROM ASPECT RATIO
            # ============================================================
            aspect_ratio = request.settings.aspect_ratio.value
            target_size = self._get_target_size(aspect_ratio)
            target_w, target_h = target_size
            logger.info(f"[{job_id}] Target size: {target_w}x{target_h} ({aspect_ratio})")

            # ============================================================
            # STEP 5: CREATE VIDEO CLIPS FROM IMAGES (with Ken Burns motion)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 20, "Creating video clips")

            clip_paths = []
            motion_styles = ["zoom_in", "zoom_out", "pan_left", "pan_right", "zoom_in"]

            for i in range(num_total_clips):
                img_idx = i % len(image_paths)
                img_path = image_paths[img_idx]
                clip_path = os.path.join(job_dir, f"clip_{i:04d}.mp4")

                # Vary motion style for visual diversity
                if i == 0:
                    motion = "zoom_in"  # Opening
                elif i == num_total_clips - 1:
                    motion = "zoom_out"  # Closing
                else:
                    motion = motion_styles[i % len(motion_styles)]

                success = await self._create_clip_with_motion(
                    img_path, clip_path, IMAGE_DURATION,
                    target_size, motion, job_id
                )
                if success:
                    clip_paths.append(clip_path)
                else:
                    logger.warning(f"[{job_id}] Failed to create clip {i}")

            logger.info(f"[{job_id}] Created {len(clip_paths)} video clips")

            if len(clip_paths) < 2:
                raise ValueError(f"Not enough clips created. Got {len(clip_paths)}, need at least 2.")

            # ============================================================
            # STEP 6: SELECT TRANSITIONS
            # ============================================================
            await self._update_progress(progress_callback, job_id, 40, "Selecting transitions")

            transitions = self._select_transitions(len(clip_paths), preset, job_id)
            transition_duration = preset.transition_duration
            logger.info(f"[{job_id}] Selected {len(transitions)} transitions, duration={transition_duration}s")

            # ============================================================
            # STEP 7: RENDER SEQUENCE WITH XFADE (includes color grading)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 50, "Applying transitions")

            video_no_audio = os.path.join(job_dir, "video_no_audio.mp4")

            # Build clip segments
            segments = [ClipSegment(path=p, duration=IMAGE_DURATION) for p in clip_paths]

            # Get post-processing settings from preset
            color_grade = getattr(preset, 'color_grade', None)
            vignette_strength = None
            film_grain_intensity = None

            if hasattr(preset, 'effects') and preset.effects:
                if 'vignette' in preset.effects:
                    vignette_strength = 0.25
                if 'film_grain' in preset.effects:
                    film_grain_intensity = 0.03

            logger.info(f"[{job_id}] Post-processing: color={color_grade}, vignette={vignette_strength}, grain={film_grain_intensity}")

            # Run xfade sequence render
            loop = asyncio.get_event_loop()
            success = await loop.run_in_executor(
                get_cpu_executor(),
                lambda: self.xfade.render_sequence(
                    clips=segments,
                    output_path=video_no_audio,
                    transitions=transitions,
                    transition_duration=transition_duration,
                    use_gpu=True,
                    target_size=target_size,
                    color_grade=color_grade,
                    vignette_strength=vignette_strength,
                    film_grain_intensity=film_grain_intensity,
                )
            )

            if not success or not os.path.exists(video_no_audio):
                raise RuntimeError(f"[{job_id}] xfade render failed")

            video_duration = self._get_video_duration(video_no_audio)
            logger.info(f"[{job_id}] Video rendered: {video_duration:.2f}s")

            # ============================================================
            # STEP 8: ADD TEXT OVERLAYS (if script provided)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 70, "Adding text overlays")

            video_with_text = video_no_audio
            if request.script and request.script.lines:
                video_with_text = os.path.join(job_dir, "video_with_text.mp4")
                success = await self._add_text_overlays(
                    video_no_audio, video_with_text, request.script,
                    video_duration, target_size, request.settings.text_style.value, job_id
                )
                if not success:
                    video_with_text = video_no_audio  # Fallback

            # ============================================================
            # STEP 9: ADD AUDIO (with hook and fades)
            # ============================================================
            await self._update_progress(progress_callback, job_id, 80, "Adding audio")

            output_path = self.temp.get_path(job_id, "output.mp4")

            if audio_path and request.audio:
                success = await self._add_audio_with_effects(
                    video_with_text, audio_path, output_path,
                    video_duration, request.audio, job_id
                )
                if not success:
                    # Fallback: copy video without audio
                    shutil.copy(video_with_text, output_path)
            else:
                # No audio - just copy video
                shutil.copy(video_with_text, output_path)

            # ============================================================
            # STEP 10: UPLOAD AND CLEANUP
            # ============================================================
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
            logger.error(f"[{job_id}] Render failed: {e}")
            self.temp.cleanup(job_id)
            raise e

    def _get_target_size(self, aspect_ratio: str) -> Tuple[int, int]:
        """Get target resolution based on aspect ratio."""
        sizes = {
            "9:16": (1080, 1920),
            "16:9": (1920, 1080),
            "1:1": (1080, 1080),
        }
        return sizes.get(aspect_ratio, (1080, 1920))

    async def _create_clip_with_motion(
        self,
        image_path: str,
        output_path: str,
        duration: float,
        target_size: Tuple[int, int],
        motion: str,
        job_id: str
    ) -> bool:
        """
        Create video clip from image with Ken Burns motion effect using FFmpeg.

        Motion types:
        - zoom_in: Start at 100%, end at 110%
        - zoom_out: Start at 110%, end at 100%
        - pan_left: Pan from right to left
        - pan_right: Pan from left to right
        - static: No motion
        """
        target_w, target_h = target_size

        # Scale factor for motion (10% zoom range)
        ZOOM_FACTOR = 1.1

        # Calculate overscan size for motion effects
        overscan_w = int(target_w * ZOOM_FACTOR)
        overscan_h = int(target_h * ZOOM_FACTOR)

        # Build filter chain based on motion type
        if motion == "zoom_in":
            # Scale up slightly, then crop with zooming in
            # Start at full view, end zoomed in 10%
            filter_chain = (
                f"scale={overscan_w}:{overscan_h}:force_original_aspect_ratio=increase,"
                f"crop=w='if(gte(t,{duration}),{target_w},{target_w}+({overscan_w}-{target_w})*(1-t/{duration}))':"
                f"h='if(gte(t,{duration}),{target_h},{target_h}+({overscan_h}-{target_h})*(1-t/{duration}))':"
                f"x='(iw-ow)/2':y='(ih-oh)/2',"
                f"scale={target_w}:{target_h},setsar=1,format=yuv420p"
            )
        elif motion == "zoom_out":
            # Start zoomed in, end at full view
            filter_chain = (
                f"scale={overscan_w}:{overscan_h}:force_original_aspect_ratio=increase,"
                f"crop=w='if(gte(t,{duration}),{overscan_w},{target_w}+({overscan_w}-{target_w})*(t/{duration}))':"
                f"h='if(gte(t,{duration}),{overscan_h},{target_h}+({overscan_h}-{target_h})*(t/{duration}))':"
                f"x='(iw-ow)/2':y='(ih-oh)/2',"
                f"scale={target_w}:{target_h},setsar=1,format=yuv420p"
            )
        elif motion == "pan_left":
            # Pan from right to left
            pan_distance = overscan_w - target_w
            filter_chain = (
                f"scale={overscan_w}:{target_h}:force_original_aspect_ratio=increase,"
                f"crop={target_w}:{target_h}:"
                f"x='{pan_distance}*(1-t/{duration})':y='(ih-oh)/2',"
                f"setsar=1,format=yuv420p"
            )
        elif motion == "pan_right":
            # Pan from left to right
            pan_distance = overscan_w - target_w
            filter_chain = (
                f"scale={overscan_w}:{target_h}:force_original_aspect_ratio=increase,"
                f"crop={target_w}:{target_h}:"
                f"x='{pan_distance}*t/{duration}':y='(ih-oh)/2',"
                f"setsar=1,format=yuv420p"
            )
        else:
            # Static - no motion
            filter_chain = (
                f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
                f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2,"
                f"setsar=1,format=yuv420p"
            )

        # Build FFmpeg command
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-loop", "1",
            "-i", image_path,
            "-t", str(duration),
            "-r", "30",
            "-vf", filter_chain,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "18",
            "-an",  # No audio
            output_path
        ]

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                get_cpu_executor(),
                lambda: subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            )

            if result.returncode != 0:
                logger.error(f"[{job_id}] Clip creation failed: {result.stderr[:200]}")
                return False

            return os.path.exists(output_path) and os.path.getsize(output_path) > 0

        except Exception as e:
            logger.error(f"[{job_id}] Clip creation error: {e}")
            return False

    def _select_transitions(
        self,
        num_clips: int,
        preset,
        job_id: str
    ) -> List[str]:
        """Select xfade transitions for each cut."""
        import random

        num_transitions = num_clips - 1

        # Get available xfade transitions
        available = list(XFADE_TRANSITIONS.values())

        # Filter based on preset vibe
        if hasattr(preset, 'transition_type'):
            if preset.transition_type == "cut":
                # Use fast transitions for cut style
                fast_transitions = ["fade", "wipeleft", "wiperight", "slideleft", "slideright"]
                available = fast_transitions
            elif preset.transition_type == "crossfade":
                # Use smooth transitions
                smooth = ["fade", "fadeblack", "dissolve", "smoothleft", "smoothright"]
                available = smooth

        # Select transitions with variety
        transitions = []
        last_transition = None

        for i in range(num_transitions):
            # Avoid repeating the same transition twice in a row
            choices = [t for t in available if t != last_transition]
            if not choices:
                choices = available

            transition = random.choice(choices)
            transitions.append(transition)
            last_transition = transition

        logger.info(f"[{job_id}] Selected transitions: {transitions[:5]}..." if len(transitions) > 5 else f"[{job_id}] Selected transitions: {transitions}")
        return transitions

    async def _add_text_overlays(
        self,
        input_video: str,
        output_video: str,
        script: ScriptData,
        video_duration: float,
        target_size: Tuple[int, int],
        style: str,
        job_id: str
    ) -> bool:
        """Add text overlays using FFmpeg drawtext filter."""
        if not script.lines:
            return False

        target_w, target_h = target_size

        # Adjust script timings
        adjusted_lines = self._adjust_script_timings(script, video_duration)

        # Build drawtext filter chain
        drawtext_filters = []

        # Font settings based on style
        font_settings = self._get_font_settings(style, target_w)

        for line in adjusted_lines:
            text = line.text.replace("'", "\\'").replace(":", "\\:")
            start_time = line.timing
            end_time = start_time + line.duration

            # Position at bottom center with padding
            y_pos = target_h - 200  # 200px from bottom

            drawtext = (
                f"drawtext=text='{text}':"
                f"fontsize={font_settings['size']}:"
                f"fontcolor={font_settings['color']}:"
                f"x=(w-text_w)/2:y={y_pos}:"
                f"enable='between(t,{start_time},{end_time})':"
                f"shadowcolor=black:shadowx=2:shadowy=2"
            )

            # Add border/box if style requires
            if font_settings.get('box'):
                drawtext += f":box=1:boxcolor=black@0.5:boxborderw=10"

            drawtext_filters.append(drawtext)

        filter_chain = ",".join(drawtext_filters)

        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", input_video,
            "-vf", filter_chain,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "copy",
            output_video
        ]

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                get_cpu_executor(),
                lambda: subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            )

            if result.returncode != 0:
                logger.error(f"[{job_id}] Text overlay failed: {result.stderr[:200]}")
                return False

            return os.path.exists(output_video)

        except Exception as e:
            logger.error(f"[{job_id}] Text overlay error: {e}")
            return False

    def _get_font_settings(self, style: str, video_width: int) -> dict:
        """Get font settings based on text style."""
        base_size = video_width // 20  # Responsive font size

        styles = {
            "bold": {"size": base_size, "color": "white", "box": True},
            "minimal": {"size": base_size - 4, "color": "white", "box": False},
            "cinematic": {"size": base_size + 4, "color": "white", "box": False},
            "fun": {"size": base_size, "color": "yellow", "box": True},
        }
        return styles.get(style, styles["bold"])

    def _adjust_script_timings(self, script: ScriptData, video_duration: float):
        """Adjust script timings to fit video duration."""
        from ..models.render_job import ScriptLine

        if not script.lines:
            return []

        num_lines = len(script.lines)
        SUBTITLE_GAP = 0.5
        MIN_DURATION = 1.5
        MAX_DURATION = 4.0

        adjusted = []
        total_available = video_duration - 0.5
        total_gaps = (num_lines - 1) * SUBTITLE_GAP
        duration_per = min(MAX_DURATION, max(MIN_DURATION, (total_available - total_gaps) / num_lines))

        current_time = 0.3

        for line in script.lines:
            if current_time + duration_per > video_duration - 0.3:
                break

            adjusted.append(ScriptLine(
                text=line.text,
                timing=current_time,
                duration=duration_per
            ))
            current_time += duration_per + SUBTITLE_GAP

        return adjusted

    async def _add_audio_with_effects(
        self,
        video_path: str,
        audio_path: str,
        output_path: str,
        video_duration: float,
        audio_data: AudioData,
        job_id: str
    ) -> bool:
        """Add audio with TikTok hook effect and fades using FFmpeg."""

        # Build audio filter for fades and hook effect
        # Hook: first 2 seconds at 70% volume, then full volume
        # Plus fade in/out

        audio_filters = []

        # TikTok Hook: reduce volume for first 2 seconds
        if video_duration > HOOK_DURATION:
            audio_filters.append(
                f"volume='if(lt(t,{HOOK_DURATION}),{HOOK_CALM_FACTOR},1)'"
            )

        # Fade in
        audio_filters.append(f"afade=t=in:st=0:d={AUDIO_FADE_IN}")

        # Fade out
        fade_out_start = max(0, video_duration - AUDIO_FADE_OUT)
        audio_filters.append(f"afade=t=out:st={fade_out_start}:d={AUDIO_FADE_OUT}")

        audio_filter_chain = ",".join(audio_filters)

        # Handle audio trim if specified
        audio_start = audio_data.start_time or 0

        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", video_path,
            "-ss", str(audio_start),
            "-i", audio_path,
            "-t", str(video_duration),
            "-filter_complex", f"[1:a]{audio_filter_chain}[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            output_path
        ]

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                get_cpu_executor(),
                lambda: subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            )

            if result.returncode != 0:
                logger.error(f"[{job_id}] Audio mixing failed: {result.stderr[:200]}")
                return False

            return os.path.exists(output_path)

        except Exception as e:
            logger.error(f"[{job_id}] Audio mixing error: {e}")
            return False

    def _get_video_duration(self, video_path: str) -> float:
        """Get video duration using ffprobe."""
        try:
            cmd = [
                self.ffprobe_path,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return float(result.stdout.strip())
        except Exception:
            return 0.0

    async def _download_all_assets(
        self,
        images: List[ImageData],
        audio: Optional[AudioData],
        job_dir: str
    ) -> Tuple[List[str], Optional[str]]:
        """Download images and audio."""
        sorted_images = sorted(images, key=lambda x: x.order)

        # Download audio if provided
        audio_path = None
        if audio and audio.url:
            audio_path = os.path.join(job_dir, "audio.mp3")
            await self.s3.download_file(audio.url, audio_path)
            logger.info(f"Audio downloaded: {audio_path}")

        # Download images
        image_paths = []
        for i, img in enumerate(sorted_images):
            local_path = os.path.join(job_dir, f"image_{i}.jpg")
            try:
                await self.s3.download_file(img.url, local_path)
                image_paths.append(local_path)
            except Exception as e:
                logger.warning(f"Failed to download image {i}: {str(e)[:80]}")

        if len(image_paths) < 3:
            raise ValueError(f"Not enough valid images. Got {len(image_paths)}, need at least 3.")

        return image_paths, audio_path

    async def _get_audio_analysis(
        self,
        audio_path: Optional[str],
        audio_url: Optional[str]
    ) -> AudioAnalysis:
        """Get audio analysis with caching."""
        if not audio_path or not audio_url:
            return self._create_default_audio_analysis()

        cache_key = hashlib.md5(audio_url.encode()).hexdigest()

        async with _audio_cache_lock:
            if cache_key in _audio_cache:
                return _audio_cache[cache_key]

        loop = asyncio.get_event_loop()
        TIMEOUT = 60

        try:
            analysis = await asyncio.wait_for(
                loop.run_in_executor(
                    get_cpu_executor(),
                    lambda: self.audio_analyzer.analyze(audio_path)
                ),
                timeout=TIMEOUT
            )
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"Audio analysis failed: {e}")
            return self._create_default_audio_analysis()

        async with _audio_cache_lock:
            _audio_cache[cache_key] = analysis
            if len(_audio_cache) > 50:
                oldest = next(iter(_audio_cache))
                del _audio_cache[oldest]

        return analysis

    def _create_default_audio_analysis(self) -> AudioAnalysis:
        """Create default audio analysis."""
        DEFAULT_BPM = 120
        DEFAULT_DURATION = 60
        beat_interval = 60.0 / DEFAULT_BPM
        beat_times = [i * beat_interval for i in range(int(DEFAULT_DURATION / beat_interval))]
        energy_curve = [(t, 0.5) for t in beat_times[:20]]

        return AudioAnalysis(
            bpm=DEFAULT_BPM,
            beat_times=beat_times,
            duration=DEFAULT_DURATION,
            energy_curve=energy_curve,
            suggested_vibe="Pop"
        )

    def _calculate_target_duration(
        self,
        request: RenderRequest,
        preset,
        num_images: int,
        audio_duration: Optional[float],
        job_id: str,
        has_audio: bool = True
    ) -> float:
        """Calculate target duration."""
        MIN_IMAGE_DURATION = 0.4
        min_duration, max_duration = preset.duration_range
        min_duration_for_images = num_images * MIN_IMAGE_DURATION
        effective_audio_duration = audio_duration if has_audio else max_duration

        if request.settings.target_duration and request.settings.target_duration > 0:
            target = max(min_duration_for_images, request.settings.target_duration)
            target = min(target, effective_audio_duration, max_duration)
        else:
            IDEAL_PER_IMAGE = 3.0
            ideal = num_images * IDEAL_PER_IMAGE
            target = max(min_duration, min_duration_for_images, ideal)
            target = min(target, max_duration, effective_audio_duration)

        logger.info(f"[{job_id}] Target duration: {target:.1f}s")
        return target

    async def _update_progress(
        self,
        callback: Optional[Callable],
        job_id: str,
        progress: int,
        step: str
    ):
        """Update progress callback."""
        if callback:
            await callback(job_id, progress, step)
