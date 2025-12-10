"""Audio analysis service using librosa."""

import librosa
import numpy as np
import logging
from typing import Tuple, List, Optional

from ..models.responses import AudioAnalysis


logger = logging.getLogger(__name__)


class AudioAnalyzer:
    """Service for analyzing audio files."""

    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate

    def analyze(self, audio_path: str) -> AudioAnalysis:
        """
        Analyze an audio file for BPM, beats, and energy.
        """
        logger.info(f"[AudioAnalyzer] Starting audio analysis: {audio_path}")

        # Load audio
        logger.info(f"[AudioAnalyzer] Loading audio file...")
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        logger.info(f"[AudioAnalyzer] Audio loaded: {len(y)} samples at {sr}Hz")
        duration = librosa.get_duration(y=y, sr=sr)
        logger.info(f"[AudioAnalyzer] Duration: {duration:.2f}s")

        # Detect tempo and beats
        logger.info(f"[AudioAnalyzer] Detecting tempo and beats...")
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        logger.info(f"[AudioAnalyzer] Detected tempo: {tempo}, beats: {len(beat_times)}")

        # Calculate energy curve (RMS)
        logger.info(f"[AudioAnalyzer] Calculating energy curve...")
        hop_length = 512
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

        # Normalize energy to 0-1
        if rms.max() > rms.min():
            rms_normalized = (rms - rms.min()) / (rms.max() - rms.min())
        else:
            rms_normalized = np.zeros_like(rms)

        # Sample energy curve (every 0.5 seconds)
        energy_curve = []
        for t in np.arange(0, duration, 0.5):
            idx = int(t * sr / hop_length)
            if idx < len(rms_normalized):
                energy_curve.append((float(t), float(rms_normalized[idx])))

        # Suggest vibe based on tempo
        tempo_val = float(tempo) if isinstance(tempo, np.ndarray) else tempo
        if tempo_val >= 120:
            suggested_vibe = "Exciting"
        elif tempo_val >= 100:
            suggested_vibe = "Pop"
        elif tempo_val >= 80:
            suggested_vibe = "Minimal"
        else:
            suggested_vibe = "Emotional"

        logger.info(f"[AudioAnalyzer] Analysis complete: BPM={int(round(tempo_val))}, duration={duration:.2f}s, vibe={suggested_vibe}")

        return AudioAnalysis(
            bpm=int(round(tempo_val)),
            beat_times=beat_times.tolist(),
            energy_curve=energy_curve,
            duration=float(duration),
            suggested_vibe=suggested_vibe
        )

    def find_best_segment(
        self,
        audio_path: str,
        target_duration: float = 15.0
    ) -> Tuple[float, float]:
        """
        Find the best segment of audio for the target duration.
        Returns (start_time, end_time) of highest energy segment.
        """
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        total_duration = librosa.get_duration(y=y, sr=sr)

        if total_duration <= target_duration:
            return (0.0, total_duration)

        # Calculate RMS energy
        hop_length = 512
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

        # Find segment with highest average energy
        samples_per_segment = int(target_duration * sr / hop_length)
        best_start = 0
        best_energy = 0

        for i in range(len(rms) - samples_per_segment):
            segment_energy = np.mean(rms[i:i + samples_per_segment])
            if segment_energy > best_energy:
                best_energy = segment_energy
                best_start = i

        start_time = librosa.frames_to_time(best_start, sr=sr, hop_length=hop_length)
        end_time = start_time + target_duration

        return (float(start_time), float(end_time))

    def get_beat_times_in_range(
        self,
        beat_times: List[float],
        start: float,
        end: float
    ) -> List[float]:
        """Get beat times within a specific time range."""
        return [t - start for t in beat_times if start <= t < end]
