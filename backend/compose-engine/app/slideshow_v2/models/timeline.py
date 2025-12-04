"""Timeline data models for video composition."""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from enum import Enum


@dataclass
class TransitionPoint:
    """A transition between two segments."""
    time: float                    # When transition starts
    duration: float                # Transition duration
    effect_id: str                 # e.g., "xfade_fade", "gl_cube"
    from_segment: int              # Index of outgoing segment
    to_segment: int                # Index of incoming segment
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MotionKeyframe:
    """A keyframe for motion animation."""
    time: float           # Relative time within segment (0-1)
    scale: float = 1.0    # Zoom level
    x_offset: float = 0.0 # Horizontal position (-1 to 1)
    y_offset: float = 0.0 # Vertical position (-1 to 1)
    rotation: float = 0.0 # Rotation in degrees


@dataclass
class TimelineSegment:
    """A single segment in the timeline (one image/clip)."""
    index: int
    image_path: str
    start_time: float
    end_time: float

    # Motion
    motion_style: str = "zoom_in"
    motion_intensity: float = 0.5
    motion_keyframes: List[MotionKeyframe] = field(default_factory=list)

    # Beat sync info
    beats_in_segment: List[float] = field(default_factory=list)  # Relative beat times
    is_on_beat: bool = True  # Does this segment start on a beat

    # Effects for this segment
    effects: List[str] = field(default_factory=list)
    effect_params: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration(self) -> float:
        """Get segment duration."""
        return self.end_time - self.start_time

    def get_motion_at_time(self, relative_time: float) -> MotionKeyframe:
        """Interpolate motion at a relative time (0-1)."""
        if not self.motion_keyframes:
            return MotionKeyframe(time=relative_time)

        # Find surrounding keyframes
        prev_kf = None
        next_kf = None

        for kf in self.motion_keyframes:
            if kf.time <= relative_time:
                prev_kf = kf
            if kf.time >= relative_time and next_kf is None:
                next_kf = kf
                break

        if prev_kf is None:
            return self.motion_keyframes[0]
        if next_kf is None:
            return self.motion_keyframes[-1]
        if prev_kf.time == next_kf.time:
            return prev_kf

        # Linear interpolation
        ratio = (relative_time - prev_kf.time) / (next_kf.time - prev_kf.time)
        return MotionKeyframe(
            time=relative_time,
            scale=prev_kf.scale + ratio * (next_kf.scale - prev_kf.scale),
            x_offset=prev_kf.x_offset + ratio * (next_kf.x_offset - prev_kf.x_offset),
            y_offset=prev_kf.y_offset + ratio * (next_kf.y_offset - prev_kf.y_offset),
            rotation=prev_kf.rotation + ratio * (next_kf.rotation - prev_kf.rotation),
        )


@dataclass
class CaptionSegment:
    """A text caption/overlay."""
    text: str
    start_time: float
    end_time: float

    # Animation
    animation: str = "fade"  # fade, typewriter, bounce_in, etc.
    animation_duration: float = 0.3

    # Styling
    style: str = "bold_pop"
    position: str = "bottom"  # top, center, bottom, or (x, y)
    font_size: Optional[int] = None

    # Beat sync
    sync_to_beat: bool = False
    beat_time: Optional[float] = None  # If synced, which beat

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time


@dataclass
class AudioSegment:
    """Audio configuration for the timeline."""
    source_path: str
    start_time: float = 0.0  # Start time in source audio
    end_time: Optional[float] = None  # End time in source (None = to end)

    # Volume envelope
    volume: float = 1.0
    fade_in: float = 1.0
    fade_out: float = 2.0

    # Hook settings
    hook_duration: float = 2.0
    hook_volume: float = 0.7  # Quieter during hook for tension

    # Ducking (lower volume during captions)
    duck_times: List[Tuple[float, float]] = field(default_factory=list)
    duck_amount: float = 0.3


@dataclass
class GlobalEffects:
    """Effects applied to entire video."""
    color_grade: str = "natural"
    color_grade_intensity: float = 1.0

    vignette: bool = False
    vignette_intensity: float = 0.3

    film_grain: bool = False
    film_grain_intensity: float = 0.03

    glow: bool = False
    glow_intensity: float = 0.2

    chromatic_aberration: bool = False
    chromatic_intensity: float = 0.005

    # Beat-reactive effects
    beat_flash: bool = False
    beat_flash_intensity: float = 0.1
    beat_flash_times: List[float] = field(default_factory=list)


@dataclass
class Timeline:
    """Complete timeline for video composition."""
    # Basic info
    duration: float
    fps: int = 30
    resolution: Tuple[int, int] = (1080, 1920)  # width, height

    # Content
    segments: List[TimelineSegment] = field(default_factory=list)
    transitions: List[TransitionPoint] = field(default_factory=list)
    captions: List[CaptionSegment] = field(default_factory=list)

    # Audio
    audio: Optional[AudioSegment] = None

    # Global effects
    effects: GlobalEffects = field(default_factory=GlobalEffects)

    # Metadata
    beat_times: List[float] = field(default_factory=list)
    bpm: Optional[float] = None

    def get_segment_at_time(self, time: float) -> Optional[TimelineSegment]:
        """Get the segment active at a specific time."""
        for segment in self.segments:
            if segment.start_time <= time < segment.end_time:
                return segment
        return None

    def get_transition_at_time(self, time: float) -> Optional[TransitionPoint]:
        """Get transition happening at a specific time."""
        for trans in self.transitions:
            if trans.time <= time < trans.time + trans.duration:
                return trans
        return None

    def get_captions_at_time(self, time: float) -> List[CaptionSegment]:
        """Get all captions visible at a specific time."""
        return [c for c in self.captions if c.start_time <= time < c.end_time]

    def validate(self) -> List[str]:
        """Validate timeline and return list of issues."""
        issues = []

        # Check segments don't overlap incorrectly
        for i, seg in enumerate(self.segments):
            if seg.duration <= 0:
                issues.append(f"Segment {i} has invalid duration: {seg.duration}")

            if i > 0:
                prev = self.segments[i - 1]
                # Allow overlap for transitions
                trans = next(
                    (t for t in self.transitions if t.from_segment == i - 1),
                    None
                )
                min_gap = -trans.duration if trans else 0
                actual_gap = seg.start_time - prev.end_time
                if actual_gap < min_gap - 0.01:  # Small tolerance
                    issues.append(
                        f"Segment {i} overlaps too much with segment {i-1}"
                    )

        # Check transitions reference valid segments
        for trans in self.transitions:
            if trans.from_segment >= len(self.segments):
                issues.append(f"Transition references invalid from_segment: {trans.from_segment}")
            if trans.to_segment >= len(self.segments):
                issues.append(f"Transition references invalid to_segment: {trans.to_segment}")

        # Check captions fit within duration
        for i, cap in enumerate(self.captions):
            if cap.end_time > self.duration:
                issues.append(f"Caption {i} extends beyond video duration")

        return issues

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization/debugging."""
        return {
            "duration": self.duration,
            "fps": self.fps,
            "resolution": self.resolution,
            "num_segments": len(self.segments),
            "num_transitions": len(self.transitions),
            "num_captions": len(self.captions),
            "bpm": self.bpm,
            "segments": [
                {
                    "index": s.index,
                    "start": s.start_time,
                    "end": s.end_time,
                    "motion": s.motion_style,
                }
                for s in self.segments
            ],
            "transitions": [
                {
                    "time": t.time,
                    "effect": t.effect_id,
                    "duration": t.duration,
                }
                for t in self.transitions
            ],
        }

    def __repr__(self) -> str:
        return (
            f"Timeline(duration={self.duration:.1f}s, "
            f"segments={len(self.segments)}, "
            f"transitions={len(self.transitions)}, "
            f"captions={len(self.captions)})"
        )
