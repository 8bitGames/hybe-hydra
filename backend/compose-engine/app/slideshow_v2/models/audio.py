"""Audio analysis data models."""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Any
from enum import Enum


class MusicMood(Enum):
    """Detected music mood."""
    ENERGETIC = "energetic"
    EMOTIONAL = "emotional"
    CALM = "calm"
    DRAMATIC = "dramatic"
    HAPPY = "happy"
    SAD = "sad"
    AGGRESSIVE = "aggressive"
    PEACEFUL = "peaceful"


class MusicGenre(Enum):
    """Detected music genre."""
    KPOP = "kpop"
    POP = "pop"
    HIPHOP = "hiphop"
    EDM = "edm"
    ROCK = "rock"
    BALLAD = "ballad"
    CLASSICAL = "classical"
    JAZZ = "jazz"
    RNB = "rnb"
    ACOUSTIC = "acoustic"
    ELECTRONIC = "electronic"
    UNKNOWN = "unknown"


@dataclass
class BeatInfo:
    """Information about a single beat."""
    time: float           # Time in seconds
    strength: float       # Beat strength 0-1
    is_downbeat: bool     # Is this a downbeat (first beat of measure)
    measure: int          # Which measure this beat belongs to
    beat_in_measure: int  # Position within measure (1-4 typically)


@dataclass
class MusicSection:
    """A section of the music (intro, verse, chorus, etc.)."""
    start: float
    end: float
    label: str  # "intro", "verse", "chorus", "bridge", "outro", "drop"
    energy: float  # Average energy 0-1
    is_drop: bool  # Is this a drop/high-energy section


@dataclass
class MusicStructure:
    """Overall structure of the music."""
    sections: List[MusicSection] = field(default_factory=list)
    drops: List[float] = field(default_factory=list)  # Times of energy drops
    builds: List[Tuple[float, float]] = field(default_factory=list)  # Build-up ranges
    best_hook_start: float = 0.0  # Best time to start for TikTok hook
    chorus_times: List[float] = field(default_factory=list)


@dataclass
class AudioAnalysisResult:
    """Complete audio analysis result."""
    # Basic info
    duration: float
    sample_rate: int

    # Tempo/rhythm
    bpm: float
    bpm_confidence: float  # 0-1 confidence in BPM detection
    time_signature: int = 4  # Beats per measure (usually 4)

    # Beats
    beats: List[BeatInfo] = field(default_factory=list)
    beat_times: List[float] = field(default_factory=list)  # Simple list of beat times
    downbeat_times: List[float] = field(default_factory=list)

    # Energy
    energy_curve: List[Tuple[float, float]] = field(default_factory=list)  # (time, energy)
    average_energy: float = 0.5
    energy_variance: float = 0.0

    # Onsets (note attacks)
    onset_times: List[float] = field(default_factory=list)
    onset_strengths: List[float] = field(default_factory=list)

    # Structure
    structure: Optional[MusicStructure] = None

    # Classification
    mood: List[MusicMood] = field(default_factory=list)
    genre: MusicGenre = MusicGenre.UNKNOWN

    # Spectral features
    spectral_centroid_mean: float = 0.0  # Brightness indicator
    spectral_rolloff_mean: float = 0.0

    # Recommended settings based on analysis
    suggested_cut_style: str = "beat_sync"
    suggested_transition_duration: float = 0.5
    suggested_motion_intensity: float = 0.5

    def get_beats_in_range(self, start: float, end: float) -> List[BeatInfo]:
        """Get all beats within a time range."""
        return [b for b in self.beats if start <= b.time < end]

    def get_beat_times_in_range(self, start: float, end: float) -> List[float]:
        """Get beat times within a time range, adjusted to be relative."""
        return [t - start for t in self.beat_times if start <= t < end]

    def get_energy_at_time(self, time: float) -> float:
        """Get interpolated energy at a specific time."""
        if not self.energy_curve:
            return 0.5

        # Find surrounding points
        prev_point = None
        next_point = None

        for t, e in self.energy_curve:
            if t <= time:
                prev_point = (t, e)
            if t >= time and next_point is None:
                next_point = (t, e)
                break

        if prev_point is None:
            return self.energy_curve[0][1]
        if next_point is None:
            return self.energy_curve[-1][1]
        if prev_point[0] == next_point[0]:
            return prev_point[1]

        # Linear interpolation
        ratio = (time - prev_point[0]) / (next_point[0] - prev_point[0])
        return prev_point[1] + ratio * (next_point[1] - prev_point[1])

    def find_best_segment(self, target_duration: float) -> Tuple[float, float]:
        """Find the best segment of audio for target duration."""
        if self.duration <= target_duration:
            return (0.0, self.duration)

        # If we have structure info, prefer sections with drops/choruses
        if self.structure and self.structure.drops:
            # Start slightly before first drop
            first_drop = self.structure.drops[0]
            start = max(0, first_drop - 2.0)
            end = min(start + target_duration, self.duration)
            return (start, end)

        # Otherwise, find highest energy segment
        best_start = 0.0
        best_energy = 0.0

        step = 0.5  # Check every 0.5 seconds
        current = 0.0

        while current + target_duration <= self.duration:
            # Calculate average energy for this segment
            segment_energy = 0.0
            count = 0
            for t, e in self.energy_curve:
                if current <= t < current + target_duration:
                    segment_energy += e
                    count += 1

            if count > 0:
                avg_energy = segment_energy / count
                if avg_energy > best_energy:
                    best_energy = avg_energy
                    best_start = current

            current += step

        return (best_start, best_start + target_duration)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "duration": self.duration,
            "sample_rate": self.sample_rate,
            "bpm": self.bpm,
            "bpm_confidence": self.bpm_confidence,
            "beat_times": self.beat_times[:100],  # Limit for serialization
            "average_energy": self.average_energy,
            "mood": [m.value for m in self.mood],
            "genre": self.genre.value,
            "suggested_cut_style": self.suggested_cut_style,
        }
