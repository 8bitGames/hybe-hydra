"""FFmpeg xfade transition renderer.

Uses FFmpeg's xfade filter to apply transitions between video clips.
This is faster than MoviePy transitions and supports 40+ transition types.
"""

import os
import subprocess
import logging
import tempfile
from typing import List, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# FFmpeg xfade transition names (from https://trac.ffmpeg.org/wiki/Xfade)
# BLACKLISTED effects are excluded: hlslice, hrslice, vuslice, vdslice, hblur, rectcrop
# These cause visual corruption or make images invisible
XFADE_TRANSITIONS = {
    # === FADE EFFECTS ===
    "xfade_fade": "fade",
    "xfade_fadeblack": "fadeblack",
    "xfade_fadewhite": "fadewhite",
    "xfade_fadegrays": "fadegrays",
    "xfade_distance": "distance",
    "xfade_dissolve": "dissolve",

    # === WIPE EFFECTS ===
    "xfade_wipeleft": "wipeleft",
    "xfade_wiperight": "wiperight",
    "xfade_wipeup": "wipeup",
    "xfade_wipedown": "wipedown",
    "xfade_wipetl": "wipetl",
    "xfade_wipetr": "wipetr",
    "xfade_wipebl": "wipebl",
    "xfade_wipebr": "wipebr",

    # === SLIDE EFFECTS ===
    "xfade_slideleft": "slideleft",
    "xfade_slideright": "slideright",
    "xfade_slideup": "slideup",
    "xfade_slidedown": "slidedown",

    # === SMOOTH EFFECTS ===
    "xfade_smoothleft": "smoothleft",
    "xfade_smoothright": "smoothright",
    "xfade_smoothup": "smoothup",
    "xfade_smoothdown": "smoothdown",

    # === CIRCLE/GEOMETRIC EFFECTS ===
    "xfade_circlecrop": "circlecrop",
    "xfade_circleopen": "circleopen",
    "xfade_circleclose": "circleclose",
    "xfade_vertopen": "vertopen",
    "xfade_vertclose": "vertclose",
    "xfade_horzopen": "horzopen",
    "xfade_horzclose": "horzclose",
    "xfade_radial": "radial",

    # === DIAGONAL EFFECTS ===
    "xfade_diagtl": "diagtl",
    "xfade_diagtr": "diagtr",
    "xfade_diagbl": "diagbl",
    "xfade_diagbr": "diagbr",

    # === SPECIAL EFFECTS ===
    "xfade_pixelize": "pixelize",
    "xfade_squeezev": "squeezev",
    "xfade_squeezeh": "squeezeh",
    "xfade_zoomin": "zoomin",

    # === WIND EFFECTS ===
    "xfade_hlwind": "hlwind",
    "xfade_hrwind": "hrwind",
    "xfade_vuwind": "vuwind",
    "xfade_vdwind": "vdwind",

    # === COVER EFFECTS (new clip covers old) ===
    "xfade_coverleft": "coverleft",
    "xfade_coverright": "coverright",
    "xfade_coverup": "coverup",
    "xfade_coverdown": "coverdown",

    # === REVEAL EFFECTS (old clip reveals new) ===
    "xfade_revealleft": "revealleft",
    "xfade_revealright": "revealright",
    "xfade_revealup": "revealup",
    "xfade_revealdown": "revealdown",

    # BLACKLISTED (DO NOT ADD):
    # - rectcrop: causes horizontal stripes
    # - hlslice, hrslice, vuslice, vdslice: causes stripes
    # - hblur: makes images invisible
}

# =============================================================================
# FFmpeg POST-PROCESSING FILTERS
# These run AFTER xfade transitions, in FFmpeg (not MoviePy per-frame)
# =============================================================================

# Color grading presets mapped to FFmpeg filter chains
FFMPEG_COLOR_GRADES = {
    # vibrant: +30% saturation
    "vibrant": "eq=saturation=1.3",

    # cinematic: orange/teal look - slight blue in shadows, desaturate, more contrast
    "cinematic": "colorbalance=rs=-0.05:bs=0.05:rm=-0.03:bm=0.03,eq=saturation=0.9:contrast=1.1",

    # bright: +10% brightness, slight gamma boost
    "bright": "eq=brightness=0.1:gamma=1.1",

    # moody: darker, blue tint, desaturated, high contrast
    "moody": "colorbalance=bs=0.1:bm=0.05,eq=saturation=0.7:contrast=1.15:brightness=-0.1",

    # bw: convert to grayscale
    "bw": "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3",

    # natural: no changes
    "natural": None,
}

# Vignette filter with configurable strength (0.0-1.0)
# angle controls darkness spread: PI/4 is standard, lower = more vignette
def get_vignette_filter(strength: float = 0.3) -> str:
    """Get FFmpeg vignette filter string."""
    # FFmpeg vignette: angle controls how far darkness spreads from edges
    # PI/4 (~0.785) is standard, PI/5 (~0.628) is stronger
    angle = 0.785 - (strength * 0.4)  # strength 0.3 → angle ~0.665
    return f"vignette=a={angle:.3f}"

# Film grain using noise filter
def get_film_grain_filter(intensity: float = 0.05) -> str:
    """Get FFmpeg noise filter for film grain effect."""
    # FFmpeg noise: alls=strength (0-100), allf=t for temporal noise
    # intensity 0.05 → ~5% noise → strength ~12
    strength = int(intensity * 240)  # 0.05 → 12, 0.1 → 24
    return f"noise=alls={strength}:allf=t"


@dataclass
class ClipSegment:
    """Represents a video segment for xfade processing."""
    path: str
    duration: float
    start_time: float = 0.0


class XfadeRenderer:
    """Renders video transitions using FFmpeg xfade filter."""

    def __init__(self, ffmpeg_path: Optional[str] = None):
        """
        Initialize xfade renderer.

        Args:
            ffmpeg_path: Path to ffmpeg binary (auto-detect if None)
        """
        self.ffmpeg_path = ffmpeg_path or self._find_ffmpeg()

    def _find_ffmpeg(self) -> str:
        """Find FFmpeg binary path."""
        # Check for jellyfin-ffmpeg first (has more features)
        jellyfin_path = "/usr/lib/jellyfin-ffmpeg/ffmpeg"
        if os.path.exists(jellyfin_path):
            return jellyfin_path

        # Fall back to system ffmpeg
        return "ffmpeg"

    def get_xfade_name(self, effect_id: str) -> str:
        """Convert effect ID to xfade transition name."""
        return XFADE_TRANSITIONS.get(effect_id, "fade")

    def is_xfade_effect(self, effect_id: str) -> bool:
        """Check if effect ID is an xfade transition."""
        return effect_id in XFADE_TRANSITIONS or effect_id.startswith("xfade_")

    def render_transition(
        self,
        clip1_path: str,
        clip2_path: str,
        output_path: str,
        transition: str = "fade",
        duration: float = 0.5,
        offset: Optional[float] = None,
    ) -> bool:
        """
        Render a single transition between two clips.

        Args:
            clip1_path: Path to first video clip
            clip2_path: Path to second video clip
            output_path: Output file path
            transition: xfade transition name
            duration: Transition duration in seconds
            offset: Time offset for transition (auto-calculate if None)

        Returns:
            True if successful
        """
        try:
            # Get clip1 duration if offset not specified
            if offset is None:
                clip1_duration = self._get_duration(clip1_path)
                offset = max(0, clip1_duration - duration)

            # Build xfade filter
            filter_complex = f"xfade=transition={transition}:duration={duration}:offset={offset}"

            cmd = [
                self.ffmpeg_path,
                "-y",  # Overwrite output
                "-i", clip1_path,
                "-i", clip2_path,
                "-filter_complex", filter_complex,
                "-c:v", "libx264",
                "-preset", "ultrafast",  # Changed from 'fast' for speed
                "-crf", "23",
                "-threads", "0",  # Use all available CPU threads
                "-c:a", "aac",
                "-b:a", "192k",
                output_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode != 0:
                logger.error(f"xfade render failed: {result.stderr}")
                return False

            return True

        except Exception as e:
            logger.error(f"xfade render error: {e}")
            return False

    def render_sequence(
        self,
        clips: List[ClipSegment],
        output_path: str,
        transitions: List[str],
        transition_duration: float = 0.5,
        use_gpu: bool = True,
        target_size: Optional[Tuple[int, int]] = None,
        # Post-processing filters (applied in FFmpeg, not MoviePy)
        color_grade: Optional[str] = None,
        vignette_strength: Optional[float] = None,
        film_grain_intensity: Optional[float] = None,
    ) -> bool:
        """
        Render a sequence of clips with transitions and post-processing.

        Args:
            clips: List of ClipSegment objects
            output_path: Output file path
            transitions: List of transition names (len should be len(clips) - 1)
            transition_duration: Duration for each transition
            use_gpu: Use GPU encoding if available
            target_size: Optional target resolution (width, height)
            color_grade: Color grading preset (vibrant, cinematic, bright, moody, bw)
            vignette_strength: Vignette strength 0.0-1.0 (None to disable)
            film_grain_intensity: Film grain intensity 0.0-0.2 (None to disable)

        Returns:
            True if successful
        """
        # Debug: Log all input clips
        print(f"[XFADE_RENDERER] ============================================")
        print(f"[XFADE_RENDERER] render_sequence called with {len(clips)} clips")
        print(f"[XFADE_RENDERER] Transitions: {transitions}")
        print(f"[XFADE_RENDERER] Transition duration: {transition_duration}s")

        all_valid = True
        for i, clip in enumerate(clips):
            exists = os.path.exists(clip.path)
            size_str = "N/A"
            is_valid = False
            actual_duration = 0.0

            if exists:
                file_size = os.path.getsize(clip.path)
                size_str = f"{file_size / 1024:.1f}KB"

                # Verify it's a valid video file by getting duration
                actual_duration = self._get_duration(clip.path)
                is_valid = file_size > 0 and actual_duration > 0

                if not is_valid:
                    print(f"[XFADE_RENDERER] WARNING: Clip {i} is INVALID (size={file_size}, duration={actual_duration})")
                    all_valid = False
            else:
                print(f"[XFADE_RENDERER] ERROR: Clip {i} does NOT EXIST!")
                all_valid = False

            print(f"[XFADE_RENDERER]   Clip {i}: {clip.path}")
            print(f"[XFADE_RENDERER]     exists={exists}, file_size={size_str}, expected_dur={clip.duration}s, actual_dur={actual_duration}s, valid={is_valid}")

        print(f"[XFADE_RENDERER] ============================================")

        if not all_valid:
            print(f"[XFADE_RENDERER] ERROR: Some input clips are invalid, cannot proceed!")
            return False

        # Determine target size - CRITICAL for Ken Burns motion clips
        # Ken Burns effects (zoom_in, zoom_out, pan) change clip dimensions
        # xfade requires ALL inputs to have identical dimensions
        if target_size is None:
            first_size = self._get_video_size(clips[0].path)
            if first_size:
                target_size = first_size
                print(f"[XFADE_RENDERER] Auto-detected target size from first clip: {target_size}")
            else:
                target_size = (1080, 1920)  # Default to 9:16 vertical
                print(f"[XFADE_RENDERER] Using default target size: {target_size}")

        target_w, target_h = target_size
        print(f"[XFADE_RENDERER] Normalizing all clips to {target_w}x{target_h}")

        if len(clips) < 2:
            logger.warning("Need at least 2 clips for transitions")
            return False

        # VALIDATION: Ensure all clips have valid duration for transitions
        min_clip_duration = transition_duration + 0.1  # Need at least transition + 0.1s
        for i, clip in enumerate(clips):
            if clip.duration < min_clip_duration:
                print(f"[XFADE_RENDERER] WARNING: Clip {i} duration ({clip.duration}s) < minimum ({min_clip_duration}s)")
                print(f"[XFADE_RENDERER] Adjusting transition_duration from {transition_duration}s to {max(0.1, clip.duration - 0.1)}s")
                transition_duration = max(0.1, min(transition_duration, clip.duration - 0.1))

        if len(transitions) != len(clips) - 1:
            # Pad with fade if not enough transitions
            while len(transitions) < len(clips) - 1:
                transitions.append("fade")

        try:
            # Build complex filter for multiple transitions
            inputs = []
            for i, clip in enumerate(clips):
                inputs.extend(["-i", clip.path])

            # Build filter chain with cumulative offset calculation
            # FFmpeg xfade chains: each xfade operates on the OUTPUT of the previous one
            # So offsets must be calculated relative to accumulated duration
            filter_parts = []

            # CRITICAL: Add scale filters for EACH input to normalize dimensions
            # Ken Burns motion effects change clip sizes, causing xfade to fail
            # Scale filter: normalize → pad to exact size → reset SAR → ensure pixel format
            for i in range(len(clips)):
                scale_filter = (
                    f"[{i}:v]scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
                    f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[s{i}]"
                )
                filter_parts.append(scale_filter)

            print(f"[XFADE_RENDERER] Added {len(clips)} scale filters for dimension normalization")

            # Use scaled inputs [s0], [s1], etc. instead of raw [0:v], [1:v]
            current_label = "[s0]"

            # Start with first clip's duration
            accumulated_duration = clips[0].duration
            print(f"[XFADE_RENDERER] Initial accumulated_duration: {accumulated_duration}s")

            for i, transition in enumerate(transitions):
                next_input = f"[s{i + 1}]"  # Use scaled input, not raw

                # Offset is where in the accumulated stream the transition starts
                # It should be: accumulated_duration - transition_duration
                offset = max(0, accumulated_duration - transition_duration)

                # VALIDATION: Ensure offset is not longer than accumulated duration
                if offset > accumulated_duration:
                    print(f"[XFADE_RENDERER] WARNING: offset {offset} > accumulated {accumulated_duration}, clamping")
                    offset = max(0, accumulated_duration - 0.1)

                # VALIDATION: Ensure transition_duration doesn't exceed remaining time
                remaining_time = accumulated_duration - offset
                effective_transition = min(transition_duration, remaining_time)
                if effective_transition != transition_duration:
                    print(f"[XFADE_RENDERER] WARNING: Clamped transition from {transition_duration}s to {effective_transition}s")

                print(f"[XFADE_RENDERER] Transition {i}: {transition}, offset={offset:.2f}s, duration={effective_transition:.2f}s")

                if i < len(transitions) - 1:
                    output_label = f"[v{i}]"
                else:
                    output_label = ""  # Final output has no label

                xfade_filter = f"{current_label}{next_input}xfade=transition={transition}:duration={effective_transition}:offset={offset}{output_label}"
                filter_parts.append(xfade_filter)

                # Update accumulated duration: add next clip, subtract overlap
                accumulated_duration = offset + clips[i + 1].duration
                print(f"[XFADE_RENDERER] After transition {i}: accumulated_duration = {accumulated_duration}s")

                if output_label:
                    current_label = output_label

            print(f"[XFADE_RENDERER] Filter chain: {len(filter_parts)} transitions")
            print(f"[XFADE_RENDERER] Effects being applied: {transitions}")

            # =================================================================
            # POST-PROCESSING FILTERS (color grade, vignette, film grain)
            # Applied in FFmpeg = FAST (vs MoviePy per-frame = SLOW)
            # =================================================================
            post_filters = []

            # Color grading
            if color_grade and color_grade != "natural":
                grade_filter = FFMPEG_COLOR_GRADES.get(color_grade)
                if grade_filter:
                    post_filters.append(grade_filter)
                    print(f"[XFADE_RENDERER] Adding color grade: {color_grade} -> {grade_filter}")

            # Vignette
            if vignette_strength is not None and vignette_strength > 0:
                vignette_filter = get_vignette_filter(vignette_strength)
                post_filters.append(vignette_filter)
                print(f"[XFADE_RENDERER] Adding vignette: strength={vignette_strength} -> {vignette_filter}")

            # Film grain
            if film_grain_intensity is not None and film_grain_intensity > 0:
                grain_filter = get_film_grain_filter(film_grain_intensity)
                post_filters.append(grain_filter)
                print(f"[XFADE_RENDERER] Adding film grain: intensity={film_grain_intensity} -> {grain_filter}")

            # If we have post-processing, need to chain them after xfade
            if post_filters:
                # Last xfade currently has no output label, give it one
                # Find the last xfade filter and add output label
                last_filter_idx = len(filter_parts) - 1
                filter_parts[last_filter_idx] = filter_parts[last_filter_idx] + "[xfade_out]"

                # Chain post-processing filters
                post_chain = ",".join(post_filters)
                filter_parts.append(f"[xfade_out]{post_chain}")
                print(f"[XFADE_RENDERER] Post-processing chain: {post_chain}")

            print(f"[XFADE_RENDERER] Each filter part:")
            for idx, part in enumerate(filter_parts):
                print(f"  [{idx}] {part}")
            logger.info(f"xfade filter chain: {len(filter_parts)} parts with effects: {transitions}")
            logger.info(f"xfade final duration: ~{accumulated_duration:.1f}s")

            filter_complex = ";".join(filter_parts)
            print(f"[XFADE_RENDERER] Full filter_complex: {filter_complex}")
            logger.debug(f"FFmpeg filter_complex: {filter_complex[:200]}...")

            # Build command
            cmd = [self.ffmpeg_path, "-y"]
            cmd.extend(inputs)
            cmd.extend(["-filter_complex", filter_complex])

            # Encoding settings
            if use_gpu and self._check_nvenc():
                cmd.extend([
                    "-c:v", "h264_nvenc",
                    "-preset", "p4",
                    "-cq", "23",
                    "-b:v", "8M",
                ])
            else:
                cmd.extend([
                    "-c:v", "libx264",
                    "-preset", "ultrafast",  # Changed from 'fast' for speed
                    "-crf", "23",
                    "-threads", "0",  # Use all available CPU threads
                ])

            cmd.extend([
                "-c:a", "aac",
                "-b:a", "192k",
                output_path
            ])

            print(f"[XFADE_RENDERER] Full FFmpeg command:")
            print(f"  {' '.join(cmd)}")
            logger.info(f"Running xfade sequence render with {len(clips)} clips")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes for longer sequences
            )

            if result.returncode != 0:
                print(f"[XFADE_RENDERER] FFmpeg FAILED! Return code: {result.returncode}")
                print(f"[XFADE_RENDERER] === FULL STDERR ===")
                print(result.stderr)
                print(f"[XFADE_RENDERER] === END STDERR ===")
                # Also print stdout in case there's useful info there
                if result.stdout:
                    print(f"[XFADE_RENDERER] stdout: {result.stdout}")
                logger.error(f"xfade sequence render failed: {result.stderr}")
                return False

            print(f"[XFADE_RENDERER] FFmpeg SUCCESS! Output: {output_path}")
            return True

        except subprocess.TimeoutExpired:
            logger.error("xfade sequence render timed out")
            return False
        except Exception as e:
            logger.error(f"xfade sequence render error: {e}")
            return False

    def create_clip_from_image(
        self,
        image_path: str,
        output_path: str,
        duration: float,
        fps: int = 30,
        size: Optional[Tuple[int, int]] = None,
    ) -> bool:
        """
        Create a video clip from a static image.

        Args:
            image_path: Path to image file
            output_path: Output video path
            duration: Duration in seconds
            fps: Frame rate
            size: Optional (width, height) to resize

        Returns:
            True if successful
        """
        try:
            cmd = [
                self.ffmpeg_path,
                "-y",
                "-loop", "1",
                "-i", image_path,
                "-t", str(duration),
                "-r", str(fps),
            ]

            if size:
                cmd.extend(["-vf", f"scale={size[0]}:{size[1]}:force_original_aspect_ratio=decrease,pad={size[0]}:{size[1]}:(ow-iw)/2:(oh-ih)/2"])

            cmd.extend([
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "18",
                "-pix_fmt", "yuv420p",
                output_path
            ])

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                logger.error(f"Image to clip failed: {result.stderr}")
                return False

            return True

        except Exception as e:
            logger.error(f"Image to clip error: {e}")
            return False

    def _get_duration(self, video_path: str) -> float:
        """Get video duration using ffprobe."""
        try:
            # Fix: Replace only the filename, not the directory name
            # e.g., /usr/lib/jellyfin-ffmpeg/ffmpeg -> /usr/lib/jellyfin-ffmpeg/ffprobe
            ffprobe_path = os.path.join(os.path.dirname(self.ffmpeg_path), "ffprobe")
            cmd = [
                ffprobe_path,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return float(result.stdout.strip())

        except Exception as e:
            logger.error(f"Failed to get duration: {e}")
            return 0.0

    def _get_video_size(self, video_path: str) -> Optional[Tuple[int, int]]:
        """Get video dimensions (width, height) using ffprobe."""
        try:
            # Fix: Replace only the filename, not the directory name
            # e.g., /usr/lib/jellyfin-ffmpeg/ffmpeg -> /usr/lib/jellyfin-ffmpeg/ffprobe
            ffprobe_path = os.path.join(os.path.dirname(self.ffmpeg_path), "ffprobe")
            cmd = [
                ffprobe_path,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=s=x:p=0",
                video_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0 and result.stdout.strip():
                parts = result.stdout.strip().split("x")
                if len(parts) == 2:
                    width, height = int(parts[0]), int(parts[1])
                    print(f"[XFADE_RENDERER] Got video size: {width}x{height} from {video_path}")
                    return (width, height)

            logger.warning(f"Could not get video size from {video_path}")
            return None

        except Exception as e:
            logger.error(f"Failed to get video size: {e}")
            return None

    def _check_nvenc(self) -> bool:
        """Check if NVENC is actually available by testing a real encode."""
        # Use cached result if available
        if hasattr(self, '_nvenc_available_cache'):
            return self._nvenc_available_cache

        try:
            # Actually test NVENC encoding, not just encoder listing
            # NVENC requires minimum 128x128 frame size, using 256x256 to be safe
            result = subprocess.run(
                [
                    self.ffmpeg_path, "-hide_banner", "-loglevel", "error",
                    "-f", "lavfi", "-i", "color=black:s=256x256:d=0.1",
                    "-c:v", "h264_nvenc", "-f", "null", "-"
                ],
                capture_output=True,
                text=True,
                timeout=10
            )
            self._nvenc_available_cache = result.returncode == 0
            if self._nvenc_available_cache:
                logger.info("NVENC GPU encoding is available")
            else:
                logger.info("NVENC not available, using CPU encoding")
            return self._nvenc_available_cache
        except Exception as e:
            logger.debug(f"NVENC check failed: {e}")
            self._nvenc_available_cache = False
            return False
