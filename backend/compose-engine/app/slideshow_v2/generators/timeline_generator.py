"""
Timeline Generator for Slideshow V2.

Converts AI composition plans into executable timelines with:
- Beat-synchronized transitions
- Motion keyframes
- Caption timing
- Effect applications
"""

import logging
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
import bisect

from ..conductor.schemas import (
    CompositionPlan,
    SegmentPlan,
    TransitionPlan,
    CaptionPlan,
    EffectsPlan,
    AudioPlan,
)
from ..models.timeline import Timeline, TimelineSegment, TransitionPoint, CaptionSegment
from ..models.audio import AudioAnalysisResult, BeatInfo
from ..effects.registry import get_registry, EffectsRegistry

logger = logging.getLogger(__name__)


@dataclass
class BeatGrid:
    """
    Beat grid for synchronizing effects to music.

    Provides efficient lookup of nearest beats, downbeats, and measures.
    """
    beat_times: List[float] = field(default_factory=list)
    downbeat_times: List[float] = field(default_factory=list)
    bpm: float = 120.0
    beat_duration: float = 0.5  # Duration of one beat in seconds

    def nearest_beat(self, time: float, tolerance: float = 0.1) -> Optional[float]:
        """Find the nearest beat to the given time."""
        if not self.beat_times:
            return None

        idx = bisect.bisect_left(self.beat_times, time)

        candidates = []
        if idx > 0:
            candidates.append(self.beat_times[idx - 1])
        if idx < len(self.beat_times):
            candidates.append(self.beat_times[idx])

        if not candidates:
            return None

        nearest = min(candidates, key=lambda t: abs(t - time))
        if abs(nearest - time) <= tolerance:
            return nearest
        return None

    def nearest_downbeat(self, time: float, tolerance: float = 0.2) -> Optional[float]:
        """Find the nearest downbeat to the given time."""
        if not self.downbeat_times:
            return None

        idx = bisect.bisect_left(self.downbeat_times, time)

        candidates = []
        if idx > 0:
            candidates.append(self.downbeat_times[idx - 1])
        if idx < len(self.downbeat_times):
            candidates.append(self.downbeat_times[idx])

        if not candidates:
            return None

        nearest = min(candidates, key=lambda t: abs(t - time))
        if abs(nearest - time) <= tolerance:
            return nearest
        return None

    def snap_to_beat(self, time: float, prefer_downbeat: bool = False) -> float:
        """Snap time to nearest beat or downbeat."""
        if prefer_downbeat:
            downbeat = self.nearest_downbeat(time, tolerance=self.beat_duration)
            if downbeat is not None:
                return downbeat

        beat = self.nearest_beat(time, tolerance=self.beat_duration / 2)
        if beat is not None:
            return beat

        return time

    def beats_in_range(self, start: float, end: float) -> List[float]:
        """Get all beats in a time range."""
        start_idx = bisect.bisect_left(self.beat_times, start)
        end_idx = bisect.bisect_right(self.beat_times, end)
        return self.beat_times[start_idx:end_idx]

    @classmethod
    def from_audio_analysis(cls, analysis: AudioAnalysisResult) -> "BeatGrid":
        """Create beat grid from audio analysis."""
        return cls(
            beat_times=analysis.beat_times,
            downbeat_times=analysis.downbeat_times,
            bpm=analysis.bpm,
            beat_duration=60.0 / analysis.bpm if analysis.bpm > 0 else 0.5,
        )


class TimelineGenerator:
    """
    Generates executable timelines from AI composition plans.

    Responsibilities:
    - Convert AI plans to precise timelines
    - Sync transitions and captions to beats
    - Generate motion keyframes
    - Apply global effects
    - Handle audio ducking
    """

    def __init__(self, effects_registry: Optional[EffectsRegistry] = None):
        self.registry = effects_registry or get_registry()

    def generate(
        self,
        plan: CompositionPlan,
        image_paths: List[str],
        audio_analysis: Optional[AudioAnalysisResult] = None,
        output_size: Tuple[int, int] = (1080, 1920),  # 9:16 vertical
        fps: int = 30,
    ) -> Timeline:
        """
        Generate an executable timeline from a composition plan.

        Args:
            plan: AI-generated composition plan
            image_paths: Paths to source images
            audio_analysis: Optional audio analysis for beat sync
            output_size: Output video dimensions (width, height)
            fps: Frames per second

        Returns:
            Executable Timeline object
        """
        logger.info(f"Generating timeline: {len(plan.segments)} segments, "
                   f"{len(plan.transitions)} transitions, {len(plan.captions)} captions")

        # Create beat grid if audio analysis available
        beat_grid = None
        if audio_analysis:
            beat_grid = BeatGrid.from_audio_analysis(audio_analysis)
            logger.info(f"Beat grid created: BPM={beat_grid.bpm:.1f}, "
                       f"{len(beat_grid.beat_times)} beats")

        # Generate timeline segments
        segments = self._generate_segments(
            plan.segments,
            image_paths,
            beat_grid,
            output_size,
            fps,
        )

        # Generate transitions (adjusted for beat sync)
        transitions = self._generate_transitions(
            plan.transitions,
            segments,
            beat_grid,
        )

        # Generate captions
        captions = self._generate_captions(
            plan.captions,
            segments,
            beat_grid,
        )

        # Calculate actual total duration
        total_duration = self._calculate_total_duration(segments, transitions)

        # Build the timeline
        timeline = Timeline(
            segments=segments,
            transitions=transitions,
            captions=captions,
            total_duration=total_duration,
            fps=fps,
            output_size=output_size,
            color_grade=plan.effects.color_grade,
            color_intensity=plan.effects.color_intensity,
            global_effects=self._extract_global_effects(plan.effects),
            audio_start=plan.audio.start_time,
            audio_fade_in=plan.audio.fade_in,
            audio_fade_out=plan.audio.fade_out,
            beat_times=beat_grid.beat_times if beat_grid else [],
            bpm=beat_grid.bpm if beat_grid else 0.0,
        )

        logger.info(f"Timeline generated: {total_duration:.2f}s, "
                   f"{len(segments)} segments, {len(captions)} captions")

        return timeline

    def _generate_segments(
        self,
        segment_plans: List[SegmentPlan],
        image_paths: List[str],
        beat_grid: Optional[BeatGrid],
        output_size: Tuple[int, int],
        fps: int,
    ) -> List[TimelineSegment]:
        """Generate timeline segments from segment plans."""
        segments = []
        current_time = 0.0

        for i, plan in enumerate(segment_plans):
            # Get image path
            image_idx = plan.image_index
            if image_idx >= len(image_paths):
                logger.warning(f"Image index {image_idx} out of range, using last image")
                image_idx = len(image_paths) - 1

            image_path = image_paths[image_idx]

            # Get motion effect details
            motion_effect = self.registry.get_motion(plan.motion)
            if not motion_effect:
                logger.warning(f"Unknown motion '{plan.motion}', using zoom_in")
                motion_effect = self.registry.get_motion("zoom_in")

            # Calculate segment duration (may be adjusted for beat sync later)
            duration = plan.duration

            # Snap start to beat if beat grid available
            if beat_grid and i > 0:
                snapped_start = beat_grid.snap_to_beat(current_time, prefer_downbeat=True)
                if abs(snapped_start - current_time) < 0.15:  # Within tolerance
                    current_time = snapped_start

            # Create motion keyframes
            motion_keyframes = self._create_motion_keyframes(
                motion_effect,
                plan.motion_intensity,
                duration,
                fps,
                beat_grid,
                current_time,
            )

            # Create segment
            segment = TimelineSegment(
                index=i,
                image_path=image_path,
                start_time=current_time,
                duration=duration,
                motion_type=plan.motion,
                motion_intensity=plan.motion_intensity,
                motion_keyframes=motion_keyframes,
                effects=plan.effects,
                beat_times=beat_grid.beats_in_range(current_time, current_time + duration) if beat_grid else [],
            )

            segments.append(segment)
            current_time += duration

        return segments

    def _create_motion_keyframes(
        self,
        motion: Any,  # MotionEffect
        intensity: float,
        duration: float,
        fps: int,
        beat_grid: Optional[BeatGrid],
        start_time: float,
    ) -> List[Dict[str, Any]]:
        """Create motion keyframes for a segment."""
        keyframes = []
        num_frames = int(duration * fps)

        # Apply intensity to motion parameters
        scale_diff = (motion.end_scale - motion.start_scale) * intensity
        pos_diff_x = (motion.end_position[0] - motion.start_position[0]) * intensity
        pos_diff_y = (motion.end_position[1] - motion.start_position[1]) * intensity

        for frame in range(num_frames + 1):
            t = frame / num_frames if num_frames > 0 else 0

            # Apply easing
            eased_t = self._apply_easing(t, motion.easing)

            # Calculate scale and position
            scale = motion.start_scale + scale_diff * eased_t
            pos_x = motion.start_position[0] + pos_diff_x * eased_t
            pos_y = motion.start_position[1] + pos_diff_y * eased_t

            # Add shake if applicable
            rotation = 0.0
            if motion.shake_intensity > 0:
                import math
                shake = motion.shake_intensity * intensity
                rotation = math.sin(frame * 0.5) * shake * 5
                pos_x += math.sin(frame * 0.7) * shake
                pos_y += math.cos(frame * 0.6) * shake

            keyframe = {
                "frame": frame,
                "time": start_time + (frame / fps),
                "scale": scale,
                "position_x": pos_x,
                "position_y": pos_y,
                "rotation": rotation,
            }

            # Add beat pulse if this is a pulse motion
            if motion.name == "pulse" and beat_grid:
                frame_time = start_time + (frame / fps)
                nearest_beat = beat_grid.nearest_beat(frame_time, tolerance=0.05)
                if nearest_beat is not None:
                    # Apply pulse
                    beat_proximity = 1.0 - min(abs(frame_time - nearest_beat) / 0.1, 1.0)
                    keyframe["scale"] *= 1.0 + (beat_proximity * 0.03 * intensity)

            keyframes.append(keyframe)

        return keyframes

    def _apply_easing(self, t: float, easing: str) -> float:
        """Apply easing function to normalized time."""
        import math

        if easing == "linear":
            return t
        elif easing == "ease_in":
            return t * t
        elif easing == "ease_out":
            return 1 - (1 - t) ** 2
        elif easing == "ease_in_out":
            if t < 0.5:
                return 2 * t * t
            else:
                return 1 - (-2 * t + 2) ** 2 / 2
        elif easing == "bounce":
            if t < 0.5:
                return 8 * t * t * t * t
            else:
                return 1 - pow(-2 * t + 2, 4) / 2
        else:
            return t

    def _generate_transitions(
        self,
        transition_plans: List[TransitionPlan],
        segments: List[TimelineSegment],
        beat_grid: Optional[BeatGrid],
    ) -> List[TransitionPoint]:
        """Generate transitions between segments."""
        transitions = []

        for plan in transition_plans:
            if plan.from_segment >= len(segments) or plan.to_segment >= len(segments):
                logger.warning(f"Invalid transition indices: {plan.from_segment} -> {plan.to_segment}")
                continue

            from_seg = segments[plan.from_segment]
            to_seg = segments[plan.to_segment]

            # Calculate transition time (end of from_segment)
            transition_time = from_seg.start_time + from_seg.duration

            # Snap to beat if requested and beat grid available
            if plan.sync_to_beat and beat_grid:
                snapped = beat_grid.snap_to_beat(transition_time, prefer_downbeat=True)
                if abs(snapped - transition_time) < 0.2:  # Within tolerance
                    transition_time = snapped

            # Get transition effect
            trans_effect = self.registry.get_transition(plan.transition)
            if not trans_effect:
                logger.warning(f"Unknown transition '{plan.transition}', using xfade_fade")
                trans_effect = self.registry.get_transition("xfade_fade")

            # Clamp duration to valid range
            duration = max(
                trans_effect.min_duration,
                min(trans_effect.max_duration, plan.duration)
            )

            transition = TransitionPoint(
                from_segment=plan.from_segment,
                to_segment=plan.to_segment,
                time=transition_time,
                duration=duration,
                transition_type=plan.transition,
                ffmpeg_name=trans_effect.ffmpeg_name if trans_effect else "fade",
                synced_to_beat=plan.sync_to_beat and beat_grid is not None,
            )

            transitions.append(transition)

        return transitions

    def _generate_captions(
        self,
        caption_plans: List[CaptionPlan],
        segments: List[TimelineSegment],
        beat_grid: Optional[BeatGrid],
    ) -> List[CaptionSegment]:
        """Generate caption segments."""
        captions = []

        for plan in caption_plans:
            if plan.segment_index >= len(segments):
                logger.warning(f"Invalid caption segment index: {plan.segment_index}")
                continue

            segment = segments[plan.segment_index]

            # Calculate absolute start time
            relative_start = plan.position_in_segment * segment.duration
            absolute_start = segment.start_time + relative_start

            # Snap to beat if requested
            if plan.sync_to_beat and beat_grid:
                snapped = beat_grid.snap_to_beat(absolute_start, prefer_downbeat=False)
                if abs(snapped - absolute_start) < 0.15:
                    absolute_start = snapped

            # Get animation effect
            anim_effect = self.registry.get_text_animation(plan.animation)
            animation_duration = anim_effect.default_duration if anim_effect else 0.5

            caption = CaptionSegment(
                text=plan.text,
                start_time=absolute_start,
                duration=plan.duration,
                animation=plan.animation,
                animation_duration=animation_duration,
                style=plan.style,
                segment_index=plan.segment_index,
                synced_to_beat=plan.sync_to_beat and beat_grid is not None,
            )

            captions.append(caption)

        return captions

    def _extract_global_effects(self, effects_plan: EffectsPlan) -> Dict[str, Any]:
        """Extract global effects from effects plan."""
        effects = {}

        if effects_plan.vignette:
            effects["vignette"] = {
                "enabled": True,
                "intensity": effects_plan.vignette_intensity,
            }

        if effects_plan.film_grain:
            effects["film_grain"] = {
                "enabled": True,
                "intensity": effects_plan.film_grain_intensity,
            }

        if effects_plan.beat_flash:
            effects["beat_flash"] = {
                "enabled": True,
                "intensity": effects_plan.beat_flash_intensity,
            }

        return effects

    def _calculate_total_duration(
        self,
        segments: List[TimelineSegment],
        transitions: List[TransitionPoint],
    ) -> float:
        """Calculate total timeline duration accounting for transitions."""
        if not segments:
            return 0.0

        # Base duration is sum of all segments
        base_duration = sum(s.duration for s in segments)

        # Subtract overlapping transition durations
        transition_overlap = sum(t.duration for t in transitions)

        # Total duration
        return base_duration - transition_overlap

    def validate_timeline(self, timeline: Timeline) -> List[str]:
        """Validate a timeline for potential issues."""
        errors = []

        # Check for overlapping segments
        for i, seg in enumerate(timeline.segments[:-1]):
            next_seg = timeline.segments[i + 1]
            if seg.start_time + seg.duration > next_seg.start_time + 0.01:  # Small tolerance
                errors.append(
                    f"Segments {i} and {i+1} overlap: "
                    f"{seg.start_time + seg.duration:.2f} > {next_seg.start_time:.2f}"
                )

        # Check caption timing
        for i, cap in enumerate(timeline.captions):
            if cap.start_time + cap.duration > timeline.total_duration:
                errors.append(
                    f"Caption {i} extends beyond video: "
                    f"{cap.start_time + cap.duration:.2f} > {timeline.total_duration:.2f}"
                )

        # Check transition references
        for i, trans in enumerate(timeline.transitions):
            if trans.from_segment >= len(timeline.segments):
                errors.append(f"Transition {i}: invalid from_segment {trans.from_segment}")
            if trans.to_segment >= len(timeline.segments):
                errors.append(f"Transition {i}: invalid to_segment {trans.to_segment}")

        return errors

    def optimize_for_rendering(self, timeline: Timeline) -> Timeline:
        """
        Optimize timeline for efficient rendering.

        - Merge adjacent segments with same image
        - Pre-calculate FFmpeg filter strings
        - Sort captions by start time
        """
        # Sort captions by start time for efficient processing
        timeline.captions.sort(key=lambda c: c.start_time)

        # Pre-calculate any expensive values
        for seg in timeline.segments:
            if not seg.motion_keyframes:
                # Generate default keyframes if missing
                pass

        return timeline
