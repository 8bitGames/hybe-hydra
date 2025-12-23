"""
Advanced Audio Analyzer for Slideshow V2.

Provides comprehensive audio analysis including:
- Beat detection (librosa + madmom patterns)
- Energy/loudness curves
- Music structure detection
- Mood classification
- Optimal segment finding
"""

import logging
import numpy as np
from typing import List, Tuple, Optional
from pathlib import Path

from ..models.audio import (
    AudioAnalysisResult,
    BeatInfo,
    MusicStructure,
    MusicSection,
    MusicMood,
    MusicGenre,
)
from ..conductor.schemas import AudioContext

logger = logging.getLogger(__name__)


class AdvancedAudioAnalyzer:
    """
    Advanced audio analyzer with multiple analysis techniques.

    Uses librosa for core analysis, with patterns inspired by
    madmom and essentia for better accuracy.
    """

    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate
        self._librosa = None

    @property
    def librosa(self):
        """Lazy load librosa."""
        if self._librosa is None:
            import librosa
            self._librosa = librosa
        return self._librosa

    def analyze(self, audio_path: str) -> AudioAnalysisResult:
        """
        Perform comprehensive audio analysis.

        Args:
            audio_path: Path to audio file

        Returns:
            Complete AudioAnalysisResult
        """
        logger.info(f"Analyzing audio: {audio_path}")

        # Load audio
        y, sr = self.librosa.load(audio_path, sr=self.sample_rate)
        duration = self.librosa.get_duration(y=y, sr=sr)

        logger.info(f"Audio loaded: {duration:.1f}s at {sr}Hz")

        # Separate harmonic and percussive
        y_harmonic, y_percussive = self.librosa.effects.hpss(y)

        # Beat detection (use percussive for better beats)
        tempo, beat_frames = self.librosa.beat.beat_track(
            y=y_percussive,
            sr=sr,
            units='frames'
        )
        beat_times = self.librosa.frames_to_time(beat_frames, sr=sr)

        # Handle tempo as array (librosa 0.10+)
        tempo_value = float(tempo[0]) if hasattr(tempo, '__iter__') else float(tempo)

        # BPM confidence via tempogram
        bpm_confidence = self._calculate_bpm_confidence(y, sr, tempo_value)

        # Detect downbeats (first beat of each measure)
        downbeat_times = self._detect_downbeats(beat_times, tempo_value)

        # Create beat info with strength
        beats = self._create_beat_info(y, sr, beat_times, downbeat_times, tempo_value)

        # Energy curve (RMS)
        energy_curve = self._calculate_energy_curve(y, sr)

        # Onset detection
        onset_frames = self.librosa.onset.onset_detect(y=y, sr=sr)
        onset_times = self.librosa.frames_to_time(onset_frames, sr=sr)
        onset_env = self.librosa.onset.onset_strength(y=y, sr=sr)
        onset_strengths = [float(onset_env[f]) for f in onset_frames if f < len(onset_env)]

        # Calculate average energy
        avg_energy = np.mean([e for _, e in energy_curve])
        energy_variance = np.var([e for _, e in energy_curve])

        # Music structure detection
        structure = self._detect_structure(y, sr, beat_times, energy_curve)

        # Mood detection
        moods = self._detect_mood(y, sr, tempo_value, avg_energy)

        # Genre hints
        genre = self._detect_genre(y, sr, tempo_value)

        # Spectral features
        spectral_centroid = self.librosa.feature.spectral_centroid(y=y, sr=sr)
        spectral_rolloff = self.librosa.feature.spectral_rolloff(y=y, sr=sr)

        # Suggest settings based on analysis
        suggested_cut_style, suggested_trans_dur, suggested_intensity = \
            self._suggest_settings(tempo_value, avg_energy, energy_variance, structure)

        result = AudioAnalysisResult(
            duration=duration,
            sample_rate=sr,
            bpm=tempo_value,
            bpm_confidence=bpm_confidence,
            beats=beats,
            beat_times=beat_times.tolist(),
            downbeat_times=downbeat_times,
            energy_curve=energy_curve,
            average_energy=avg_energy,
            energy_variance=energy_variance,
            onset_times=onset_times.tolist(),
            onset_strengths=onset_strengths,
            structure=structure,
            mood=moods,
            genre=genre,
            spectral_centroid_mean=float(np.mean(spectral_centroid)),
            spectral_rolloff_mean=float(np.mean(spectral_rolloff)),
            suggested_cut_style=suggested_cut_style,
            suggested_transition_duration=suggested_trans_dur,
            suggested_motion_intensity=suggested_intensity,
        )

        logger.info(f"Analysis complete: BPM={tempo_value:.0f}, "
                   f"beats={len(beat_times)}, mood={[m.value for m in moods]}")

        return result

    def _calculate_bpm_confidence(self, y: np.ndarray, sr: int, detected_bpm: float) -> float:
        """Calculate confidence in BPM detection."""
        # Use tempogram to check BPM stability
        onset_env = self.librosa.onset.onset_strength(y=y, sr=sr)
        tempogram = self.librosa.feature.tempogram(onset_envelope=onset_env, sr=sr)

        # Find peak in tempogram
        tempo_freqs = self.librosa.tempo_frequencies(tempogram.shape[0], sr=sr)
        avg_tempogram = np.mean(tempogram, axis=1)

        # Find how prominent the detected tempo is
        tempo_idx = np.argmin(np.abs(tempo_freqs - detected_bpm))
        if tempo_idx > 0 and tempo_idx < len(avg_tempogram):
            peak_strength = avg_tempogram[tempo_idx]
            total_strength = np.sum(avg_tempogram)
            confidence = peak_strength / total_strength if total_strength > 0 else 0.5
            return min(1.0, confidence * 3)  # Scale up

        return 0.5

    def _detect_downbeats(self, beat_times: np.ndarray, bpm: float) -> List[float]:
        """Detect downbeats (first beat of each measure)."""
        if len(beat_times) < 4:
            return beat_times.tolist()

        # Assume 4/4 time signature
        beats_per_measure = 4
        downbeats = []

        for i, beat_time in enumerate(beat_times):
            if i % beats_per_measure == 0:
                downbeats.append(float(beat_time))

        return downbeats

    def _create_beat_info(
        self,
        y: np.ndarray,
        sr: int,
        beat_times: np.ndarray,
        downbeat_times: List[float],
        bpm: float
    ) -> List[BeatInfo]:
        """Create detailed beat information."""
        # Get onset strength at beat positions
        onset_env = self.librosa.onset.onset_strength(y=y, sr=sr)
        hop_length = 512

        beats = []
        downbeat_set = set(downbeat_times)

        for i, beat_time in enumerate(beat_times):
            # Calculate beat strength from onset envelope
            frame_idx = int(beat_time * sr / hop_length)
            strength = float(onset_env[frame_idx]) if frame_idx < len(onset_env) else 0.5

            # Normalize strength
            strength = min(1.0, strength / (np.max(onset_env) + 1e-6))

            is_downbeat = beat_time in downbeat_set
            measure = i // 4
            beat_in_measure = (i % 4) + 1

            beats.append(BeatInfo(
                time=float(beat_time),
                strength=strength,
                is_downbeat=is_downbeat,
                measure=measure,
                beat_in_measure=beat_in_measure,
            ))

        return beats

    def _calculate_energy_curve(
        self,
        y: np.ndarray,
        sr: int,
        hop_length: int = 512
    ) -> List[Tuple[float, float]]:
        """Calculate energy curve (RMS) over time."""
        rms = self.librosa.feature.rms(y=y, hop_length=hop_length)[0]

        # Normalize to 0-1
        if rms.max() > rms.min():
            rms_normalized = (rms - rms.min()) / (rms.max() - rms.min())
        else:
            rms_normalized = np.zeros_like(rms)

        # Sample every 0.25 seconds for efficiency
        duration = len(y) / sr
        curve = []
        sample_interval = 0.25

        for t in np.arange(0, duration, sample_interval):
            idx = int(t * sr / hop_length)
            if idx < len(rms_normalized):
                curve.append((float(t), float(rms_normalized[idx])))

        return curve

    def _detect_structure(
        self,
        y: np.ndarray,
        sr: int,
        beat_times: np.ndarray,
        energy_curve: List[Tuple[float, float]]
    ) -> MusicStructure:
        """Detect music structure (sections, drops, builds)."""
        duration = len(y) / sr

        # Simplified structure detection using energy
        # Find energy peaks (potential drops)
        energy_values = np.array([e for _, e in energy_curve])
        energy_times = np.array([t for t, _ in energy_curve])

        drops = []
        builds = []

        # Detect drops (sudden energy increases)
        if len(energy_values) > 4:
            energy_diff = np.diff(energy_values)
            threshold = np.std(energy_diff) * 1.5

            for i, diff in enumerate(energy_diff):
                if diff > threshold and i + 1 < len(energy_times):
                    drops.append(float(energy_times[i + 1]))

            # Detect builds (gradual energy increases before drops)
            for drop_time in drops:
                # Look for build-up in the 4-8 seconds before drop
                build_start = max(0, drop_time - 8)
                build_end = max(0, drop_time - 1)
                if build_end > build_start:
                    builds.append((build_start, build_end))

        # Find best hook start (highest energy section, preferably with a drop)
        best_hook_start = 0.0
        if drops and len(drops) > 0:
            # Start 2 seconds before first major drop
            best_hook_start = max(0, drops[0] - 2)
        elif len(energy_curve) > 0:
            # Find highest energy point
            max_idx = np.argmax(energy_values)
            best_hook_start = max(0, energy_times[max_idx] - 2)

        # Create basic sections (simplified)
        sections = []
        section_length = duration / 4

        for i in range(4):
            start = i * section_length
            end = (i + 1) * section_length

            # Calculate section energy
            section_energies = [e for t, e in energy_curve if start <= t < end]
            section_energy = np.mean(section_energies) if section_energies else 0.5

            # Determine section type based on position and energy
            if i == 0:
                label = "intro"
            elif i == 3:
                label = "outro"
            elif section_energy > 0.7:
                label = "chorus"
            else:
                label = "verse"

            sections.append(MusicSection(
                start=start,
                end=end,
                label=label,
                energy=section_energy,
                is_drop=any(start <= d < end for d in drops),
            ))

        return MusicStructure(
            sections=sections,
            drops=drops[:5],  # Limit to first 5 drops
            builds=builds[:3],
            best_hook_start=best_hook_start,
            chorus_times=[s.start for s in sections if s.label == "chorus"],
        )

    def _detect_mood(
        self,
        y: np.ndarray,
        sr: int,
        bpm: float,
        avg_energy: float
    ) -> List[MusicMood]:
        """Detect music mood from audio features."""
        moods = []

        # BPM-based mood
        if bpm >= 130:
            moods.append(MusicMood.ENERGETIC)
        elif bpm <= 80:
            moods.append(MusicMood.CALM)

        # Energy-based mood
        if avg_energy > 0.7:
            if MusicMood.ENERGETIC not in moods:
                moods.append(MusicMood.ENERGETIC)
        elif avg_energy < 0.3:
            moods.append(MusicMood.PEACEFUL)

        # Spectral features for more mood detection
        chroma = self.librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)

        # Minor key tendency (simplified)
        # Higher energy in minor chord positions might indicate emotional/sad
        minor_energy = chroma_mean[3] + chroma_mean[8]  # Eb + Ab (relative minor)
        major_energy = chroma_mean[0] + chroma_mean[4]  # C + E (major)

        if minor_energy > major_energy * 1.2:
            moods.append(MusicMood.EMOTIONAL)
        elif major_energy > minor_energy * 1.2:
            moods.append(MusicMood.HAPPY)

        # Default if no mood detected
        if not moods:
            moods.append(MusicMood.DRAMATIC)

        return moods[:3]  # Return top 3 moods

    def _detect_genre(self, y: np.ndarray, sr: int, bpm: float) -> MusicGenre:
        """Detect music genre (simplified heuristic)."""
        # This is a simplified approach - real genre detection needs ML models

        # Calculate some features
        spectral_centroid = np.mean(self.librosa.feature.spectral_centroid(y=y, sr=sr))
        spectral_bandwidth = np.mean(self.librosa.feature.spectral_bandwidth(y=y, sr=sr))
        zero_crossing_rate = np.mean(self.librosa.feature.zero_crossing_rate(y))

        # Simple heuristics
        if bpm >= 120 and bpm <= 140 and spectral_centroid > 3000:
            return MusicGenre.KPOP
        elif bpm >= 128 and spectral_bandwidth > 2000:
            return MusicGenre.EDM
        elif bpm >= 85 and bpm <= 115 and zero_crossing_rate < 0.1:
            return MusicGenre.HIPHOP
        elif bpm <= 80:
            return MusicGenre.BALLAD
        elif bpm >= 100 and bpm <= 130:
            return MusicGenre.POP

        return MusicGenre.UNKNOWN

    def _suggest_settings(
        self,
        bpm: float,
        avg_energy: float,
        energy_variance: float,
        structure: MusicStructure
    ) -> Tuple[str, float, float]:
        """Suggest settings based on audio analysis."""
        # Cut style
        if bpm >= 120 and avg_energy > 0.6:
            cut_style = "beat_sync"
        elif structure.drops:
            cut_style = "drop_sync"
        elif bpm <= 90:
            cut_style = "measure_sync"
        else:
            cut_style = "beat_sync"

        # Transition duration (faster for high BPM)
        if bpm >= 130:
            trans_duration = 0.3
        elif bpm >= 100:
            trans_duration = 0.5
        else:
            trans_duration = 0.8

        # Motion intensity
        intensity = min(1.0, (avg_energy + (bpm / 200)) / 2)

        return cut_style, trans_duration, intensity

    def to_conductor_context(self, result: AudioAnalysisResult) -> AudioContext:
        """Convert analysis result to conductor context."""
        # Simplify energy curve for AI
        simplified_energy = [e for t, e in result.energy_curve[::4]][:50]

        return AudioContext(
            duration=result.duration,
            bpm=result.bpm,
            beat_times=result.beat_times[:100],  # Limit for token efficiency
            energy_curve=simplified_energy,
            mood=result.mood[0].value if result.mood else "neutral",
            genre=result.genre.value,
            has_drops=bool(result.structure and result.structure.drops),
            drop_times=result.structure.drops[:5] if result.structure else [],
            suggested_start=result.structure.best_hook_start if result.structure else 0.0,
        )
