"""
Main Slideshow Renderer Engine for Slideshow V2.

This is the core rendering engine that:
1. Takes a Timeline and renders it to video
2. Uses FFmpeg for transitions and encoding
3. Applies GPU-accelerated effects
4. Renders captions with animations
5. Mixes audio with proper timing

Supports both GPU (NVENC) and CPU rendering modes.
"""

import os
import logging
import tempfile
import subprocess
import shutil
from typing import List, Optional, Tuple, Dict, Any
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np

from ..models.timeline import Timeline, TimelineSegment, TransitionPoint, CaptionSegment
from ..effects.gpu_effects import get_gpu_effects, GPUEffects
from ..effects.registry import get_registry

logger = logging.getLogger(__name__)


class RenderConfig:
    """Configuration for video rendering."""

    def __init__(
        self,
        output_size: Tuple[int, int] = (1080, 1920),
        fps: int = 30,
        video_bitrate: str = "8M",
        audio_bitrate: str = "192k",
        codec: str = "h264",  # h264, h264_nvenc, hevc_nvenc
        preset: str = "medium",  # ultrafast, fast, medium, slow
        crf: int = 23,
        use_gpu: bool = True,
        temp_dir: Optional[str] = None,
        ffmpeg_path: str = "ffmpeg",
        max_workers: int = 4,
    ):
        self.output_size = output_size
        self.fps = fps
        self.video_bitrate = video_bitrate
        self.audio_bitrate = audio_bitrate
        self.codec = codec
        self.preset = preset
        self.crf = crf
        self.use_gpu = use_gpu
        self.temp_dir = temp_dir
        self.ffmpeg_path = ffmpeg_path
        self.max_workers = max_workers


class SlideshowRenderer:
    """
    Main slideshow video renderer.

    Rendering Pipeline:
    1. Prepare images (resize, apply motion effects)
    2. Create segment videos with effects
    3. Apply transitions between segments
    4. Render captions
    5. Mix audio
    6. Encode final video
    """

    def __init__(self, config: Optional[RenderConfig] = None):
        self.config = config or RenderConfig()
        self.effects = get_gpu_effects()
        self.registry = get_registry()
        self._temp_dir: Optional[str] = None

    def render(
        self,
        timeline: Timeline,
        audio_path: Optional[str] = None,
        output_path: str = "output.mp4",
        progress_callback: Optional[callable] = None,
    ) -> str:
        """
        Render a timeline to video.

        Args:
            timeline: The timeline to render
            audio_path: Path to audio file
            output_path: Where to save the output video
            progress_callback: Optional callback for progress updates

        Returns:
            Path to the rendered video
        """
        logger.info(f"Starting render: {timeline.total_duration:.2f}s, "
                   f"{len(timeline.segments)} segments")

        # Create temp directory
        self._temp_dir = tempfile.mkdtemp(prefix="slideshow_v2_")
        logger.info(f"Temp directory: {self._temp_dir}")

        try:
            # Step 1: Prepare segment videos
            if progress_callback:
                progress_callback(0.1, "Preparing segments...")
            segment_videos = self._render_segments(timeline)

            # Step 2: Concatenate videos (transitions disabled)
            if progress_callback:
                progress_callback(0.4, "Concatenating videos...")
            # NO TRANSITIONS: Simply concatenate segment videos directly
            # Transitions disabled per user request
            if len(segment_videos) == 1:
                video_with_transitions = segment_videos[0]
            else:
                video_with_transitions = self._concat_videos(segment_videos)

            # Step 3: Render captions
            if progress_callback:
                progress_callback(0.6, "Rendering captions...")
            video_with_captions = self._render_captions(
                video_with_transitions, timeline.captions, timeline
            )

            # Step 4: Mix audio
            if progress_callback:
                progress_callback(0.8, "Mixing audio...")
            if audio_path:
                final_video = self._mix_audio(
                    video_with_captions, audio_path, timeline
                )
            else:
                final_video = video_with_captions

            # Step 5: Final encoding
            if progress_callback:
                progress_callback(0.9, "Final encoding...")
            self._final_encode(final_video, output_path)

            if progress_callback:
                progress_callback(1.0, "Complete!")

            logger.info(f"Render complete: {output_path}")
            return output_path

        finally:
            # Cleanup temp directory
            if self._temp_dir and os.path.exists(self._temp_dir):
                shutil.rmtree(self._temp_dir)
                logger.info("Temp directory cleaned up")

    def _render_segments(self, timeline: Timeline) -> List[str]:
        """Render each segment as a video clip."""
        segment_videos = []

        for i, segment in enumerate(timeline.segments):
            logger.info(f"Rendering segment {i+1}/{len(timeline.segments)}: "
                       f"{segment.duration:.2f}s")

            output_path = os.path.join(self._temp_dir, f"segment_{i:03d}.mp4")

            self._render_single_segment(segment, timeline, output_path)
            segment_videos.append(output_path)

        return segment_videos

    def _render_single_segment(
        self,
        segment: TimelineSegment,
        timeline: Timeline,
        output_path: str,
    ):
        """Render a single segment with motion and effects."""
        from PIL import Image

        # Load image
        img = Image.open(segment.image_path)
        img = img.convert("RGB")
        base_frame = np.array(img)

        # Calculate frame count
        num_frames = int(segment.duration * self.config.fps)

        # Create frames directory
        frames_dir = os.path.join(self._temp_dir, f"frames_{segment.index}")
        os.makedirs(frames_dir, exist_ok=True)

        # Generate frames with motion and effects
        for frame_idx in range(num_frames):
            # Get keyframe data
            keyframe = self._get_keyframe(segment, frame_idx, num_frames)

            # Calculate beat proximity for flash effect
            beat_proximity = 0.0
            if timeline.beat_times and timeline.global_effects.get("beat_flash", {}).get("enabled"):
                frame_time = segment.start_time + (frame_idx / self.config.fps)
                beat_proximity = self._calculate_beat_proximity(frame_time, timeline.beat_times)

            # Process frame with all effects
            processed = self.effects.process_frame(
                base_frame,
                color_grade=timeline.color_grade,
                color_intensity=timeline.color_intensity,
                vignette=timeline.global_effects.get("vignette", {}).get("enabled", False),
                vignette_intensity=timeline.global_effects.get("vignette", {}).get("intensity", 0.3),
                film_grain=timeline.global_effects.get("film_grain", {}).get("enabled", False),
                grain_intensity=timeline.global_effects.get("film_grain", {}).get("intensity", 0.03),
                beat_proximity=beat_proximity,
                beat_flash_intensity=timeline.global_effects.get("beat_flash", {}).get("intensity", 0.1),
                motion_scale=keyframe.get("scale", 1.0),
                motion_position=(keyframe.get("position_x", 0.5), keyframe.get("position_y", 0.5)),
                motion_rotation=keyframe.get("rotation", 0.0),
                output_size=timeline.output_size,
            )

            # Save frame
            frame_path = os.path.join(frames_dir, f"frame_{frame_idx:05d}.png")
            Image.fromarray(processed).save(frame_path)

        # Encode frames to video
        self._encode_frames_to_video(frames_dir, output_path)

        # Cleanup frames
        shutil.rmtree(frames_dir)

    def _get_keyframe(
        self,
        segment: TimelineSegment,
        frame_idx: int,
        num_frames: int,
    ) -> Dict[str, Any]:
        """Get keyframe data for a specific frame."""
        if segment.motion_keyframes and frame_idx < len(segment.motion_keyframes):
            return segment.motion_keyframes[frame_idx]

        # Default keyframe (no motion)
        return {
            "scale": 1.0,
            "position_x": 0.5,
            "position_y": 0.5,
            "rotation": 0.0,
        }

    def _calculate_beat_proximity(self, time: float, beat_times: List[float]) -> float:
        """Calculate how close the time is to the nearest beat."""
        if not beat_times:
            return 0.0

        import bisect
        idx = bisect.bisect_left(beat_times, time)

        candidates = []
        if idx > 0:
            candidates.append(beat_times[idx - 1])
        if idx < len(beat_times):
            candidates.append(beat_times[idx])

        if not candidates:
            return 0.0

        nearest = min(candidates, key=lambda t: abs(t - time))
        distance = abs(time - nearest)

        # Proximity falls off over 0.1 seconds
        if distance < 0.1:
            return 1.0 - (distance / 0.1)
        return 0.0

    def _encode_frames_to_video(self, frames_dir: str, output_path: str):
        """Encode PNG frames to video using FFmpeg."""
        # Determine encoder
        if self.config.use_gpu and self._check_nvenc():
            encoder = "h264_nvenc"
            encoder_opts = ["-preset", "p4", "-b:v", self.config.video_bitrate]
        else:
            encoder = "libx264"
            encoder_opts = [
                "-preset", self.config.preset,
                "-crf", str(self.config.crf),
            ]

        cmd = [
            self.config.ffmpeg_path,
            "-y",
            "-framerate", str(self.config.fps),
            "-i", os.path.join(frames_dir, "frame_%05d.png"),
            "-c:v", encoder,
            *encoder_opts,
            "-pix_fmt", "yuv420p",
            output_path,
        ]

        logger.debug(f"FFmpeg command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            raise RuntimeError(f"FFmpeg encoding failed: {result.stderr}")

    def _apply_transitions(
        self,
        segment_videos: List[str],
        transitions: List[TransitionPoint],
    ) -> str:
        """Apply transitions between segment videos using FFmpeg xfade."""
        if len(segment_videos) == 1:
            return segment_videos[0]

        # Build xfade filter chain
        current_video = segment_videos[0]

        for i, trans in enumerate(transitions):
            next_video = segment_videos[trans.to_segment]
            output_path = os.path.join(self._temp_dir, f"trans_{i:03d}.mp4")

            # Get segment durations
            duration1 = self._get_video_duration(current_video)

            # Calculate offset (when transition starts)
            offset = duration1 - trans.duration

            # Build FFmpeg command with xfade
            filter_str = f"xfade=transition={trans.ffmpeg_name}:duration={trans.duration}:offset={offset}"

            cmd = [
                self.config.ffmpeg_path,
                "-y",
                "-i", current_video,
                "-i", next_video,
                "-filter_complex", filter_str,
                "-c:v", "libx264" if not self.config.use_gpu else "h264_nvenc",
                "-preset", self.config.preset if not self.config.use_gpu else "p4",
                "-crf", str(self.config.crf),
                "-pix_fmt", "yuv420p",
                output_path,
            ]

            logger.debug(f"Transition command: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode != 0:
                logger.error(f"Transition error: {result.stderr}")
                # Fallback to concatenation
                output_path = self._concat_videos([current_video, next_video])

            current_video = output_path

        return current_video

    def _concat_videos(self, videos: List[str]) -> str:
        """Concatenate videos without transition (fallback)."""
        concat_file = os.path.join(self._temp_dir, "concat.txt")
        with open(concat_file, "w") as f:
            for video in videos:
                f.write(f"file '{video}'\n")

        output_path = os.path.join(self._temp_dir, "concat_output.mp4")

        cmd = [
            self.config.ffmpeg_path,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            output_path,
        ]

        subprocess.run(cmd, capture_output=True)
        return output_path

    def _render_captions(
        self,
        video_path: str,
        captions: List[CaptionSegment],
        timeline: Timeline,
    ) -> str:
        """Render captions onto video using FFmpeg drawtext."""
        if not captions:
            return video_path

        output_path = os.path.join(self._temp_dir, "with_captions.mp4")

        # Build drawtext filter chain
        filters = []
        for cap in captions:
            # Escape text for FFmpeg
            text = cap.text.replace("'", "\\'").replace(":", "\\:")

            # Calculate timing
            start_time = cap.start_time
            end_time = cap.start_time + cap.duration

            # Get font settings based on style
            font_settings = self._get_font_settings(cap.style)

            # Position (center bottom by default)
            x = "(w-text_w)/2"
            y = "h-h/6"

            # Build filter
            filter_str = (
                f"drawtext="
                f"text='{text}':"
                f"fontfile={font_settings['font']}:"
                f"fontsize={font_settings['size']}:"
                f"fontcolor={font_settings['color']}:"
                f"borderw={font_settings['border_width']}:"
                f"bordercolor={font_settings['border_color']}:"
                f"x={x}:y={y}:"
                f"enable='between(t,{start_time},{end_time})'"
            )

            # Add animation based on type
            if cap.animation == "fade":
                anim_dur = cap.animation_duration
                filter_str += f":alpha='if(lt(t,{start_time}+{anim_dur}),(t-{start_time})/{anim_dur},if(gt(t,{end_time}-{anim_dur}),({end_time}-t)/{anim_dur},1))'"

            filters.append(filter_str)

        # Combine filters
        filter_complex = ",".join(filters)

        cmd = [
            self.config.ffmpeg_path,
            "-y",
            "-i", video_path,
            "-vf", filter_complex,
            "-c:v", "libx264" if not self.config.use_gpu else "h264_nvenc",
            "-preset", self.config.preset if not self.config.use_gpu else "p4",
            "-crf", str(self.config.crf),
            "-c:a", "copy",
            output_path,
        ]

        logger.debug(f"Caption command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.warning(f"Caption rendering failed, returning video without captions: {result.stderr}")
            return video_path

        return output_path

    def _get_font_settings(self, style: str) -> Dict[str, Any]:
        """Get font settings for a caption style."""
        # Default font path (system font)
        default_font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if not os.path.exists(default_font):
            # macOS fallback
            default_font = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

        settings = {
            "bold": {
                "font": default_font,
                "size": 48,
                "color": "white",
                "border_width": 3,
                "border_color": "black",
            },
            "minimal": {
                "font": default_font,
                "size": 36,
                "color": "white",
                "border_width": 1,
                "border_color": "gray",
            },
            "dramatic": {
                "font": default_font,
                "size": 56,
                "color": "white",
                "border_width": 4,
                "border_color": "black",
            },
            "playful": {
                "font": default_font,
                "size": 44,
                "color": "yellow",
                "border_width": 3,
                "border_color": "black",
            },
        }

        return settings.get(style, settings["bold"])

    def _mix_audio(
        self,
        video_path: str,
        audio_path: str,
        timeline: Timeline,
    ) -> str:
        """Mix audio into video with proper timing and fades."""
        output_path = os.path.join(self._temp_dir, "with_audio.mp4")

        # Build audio filter
        audio_filters = []

        # Trim audio if needed
        audio_filters.append(f"atrim=start={timeline.audio_start}:duration={timeline.total_duration}")
        audio_filters.append("asetpts=PTS-STARTPTS")

        # Fade in
        if timeline.audio_fade_in > 0:
            audio_filters.append(f"afade=t=in:st=0:d={timeline.audio_fade_in}")

        # Fade out
        if timeline.audio_fade_out > 0:
            fade_start = timeline.total_duration - timeline.audio_fade_out
            audio_filters.append(f"afade=t=out:st={fade_start}:d={timeline.audio_fade_out}")

        audio_filter_str = ",".join(audio_filters)

        cmd = [
            self.config.ffmpeg_path,
            "-y",
            "-i", video_path,
            "-i", audio_path,
            "-filter_complex", f"[1:a]{audio_filter_str}[a]",
            "-map", "0:v",
            "-map", "[a]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", self.config.audio_bitrate,
            "-shortest",
            output_path,
        ]

        logger.debug(f"Audio mix command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.warning(f"Audio mixing failed: {result.stderr}")
            return video_path

        return output_path

    def _final_encode(self, video_path: str, output_path: str):
        """Final encoding pass with optimal settings."""
        # If already at output path, skip
        if os.path.abspath(video_path) == os.path.abspath(output_path):
            return

        # Re-encode with optimal settings
        if self.config.use_gpu and self._check_nvenc():
            encoder = "h264_nvenc"
            encoder_opts = [
                "-preset", "p4",
                "-b:v", self.config.video_bitrate,
                "-maxrate", self.config.video_bitrate,
                "-bufsize", "16M",
            ]
        else:
            encoder = "libx264"
            encoder_opts = [
                "-preset", self.config.preset,
                "-crf", str(self.config.crf),
            ]

        cmd = [
            self.config.ffmpeg_path,
            "-y",
            "-i", video_path,
            "-c:v", encoder,
            *encoder_opts,
            "-c:a", "aac",
            "-b:a", self.config.audio_bitrate,
            "-movflags", "+faststart",
            output_path,
        ]

        logger.debug(f"Final encode command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f"Final encoding failed: {result.stderr}")
            # Fallback: just copy
            shutil.copy(video_path, output_path)

    def _get_video_duration(self, video_path: str) -> float:
        """Get duration of a video file."""
        cmd = [
            self.config.ffmpeg_path.replace("ffmpeg", "ffprobe"),
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        try:
            return float(result.stdout.strip())
        except (ValueError, AttributeError):
            return 0.0

    def _check_nvenc(self) -> bool:
        """Check if NVENC is available."""
        cmd = [
            self.config.ffmpeg_path,
            "-hide_banner",
            "-encoders",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return "h264_nvenc" in result.stdout


class SlideshowRendererOptimized(SlideshowRenderer):
    """
    Optimized renderer with parallel processing.

    Uses ThreadPoolExecutor for parallel segment rendering.
    """

    def _render_segments(self, timeline: Timeline) -> List[str]:
        """Render segments in parallel."""
        segment_videos = [None] * len(timeline.segments)

        def render_segment(args):
            i, segment = args
            output_path = os.path.join(self._temp_dir, f"segment_{i:03d}.mp4")
            self._render_single_segment(segment, timeline, output_path)
            return i, output_path

        with ThreadPoolExecutor(max_workers=self.config.max_workers) as executor:
            results = executor.map(
                render_segment,
                enumerate(timeline.segments)
            )

            for i, path in results:
                segment_videos[i] = path

        return segment_videos
