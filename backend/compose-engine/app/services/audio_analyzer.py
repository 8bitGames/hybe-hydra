"""Audio analysis service using librosa with advanced climax detection."""

import librosa
import numpy as np
import logging
from typing import Tuple, List, Optional
from dataclasses import dataclass
from scipy import signal

from ..models.responses import AudioAnalysis, ClimaxCandidate


logger = logging.getLogger(__name__)


@dataclass
class DropInfo:
    """Information about a detected drop."""
    time: float
    score: float
    energy_delta: float
    type: str  # 'energy', 'onset', 'spectral', 'vocal', 'dynamic', 'gentle'


class AudioAnalyzer:
    """Service for analyzing audio files with advanced climax detection."""

    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate

    def analyze(self, audio_path: str, target_duration: float = 15.0) -> AudioAnalysis:
        """
        Analyze an audio file with comprehensive climax detection.

        Features:
        - BPM and beat detection
        - Energy-based drop detection (gradient analysis)
        - Onset strength burst detection
        - Spectral flux analysis
        - Vocal/harmonic peak detection (for ballads)
        - Dynamic range analysis (for short clips)
        - Multiple climax candidates with scoring
        """
        logger.info(f"[AudioAnalyzer] Starting advanced audio analysis: {audio_path}")
        logger.info(f"[AudioAnalyzer] Target duration: {target_duration}s")

        # Load audio
        logger.info(f"[AudioAnalyzer] Loading audio file...")
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        logger.info(f"[AudioAnalyzer] Audio loaded: {len(y)} samples at {sr}Hz")
        duration = librosa.get_duration(y=y, sr=sr)
        logger.info(f"[AudioAnalyzer] Duration: {duration:.2f}s")

        # Separate harmonic and percussive for better analysis
        y_harmonic, y_percussive = librosa.effects.hpss(y)

        # Detect tempo and beats (use percussive for cleaner beats)
        logger.info(f"[AudioAnalyzer] Detecting tempo and beats...")
        tempo, beat_frames = librosa.beat.beat_track(y=y_percussive, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        tempo_val = float(tempo[0]) if hasattr(tempo, '__iter__') else float(tempo)
        logger.info(f"[AudioAnalyzer] Detected tempo: {tempo_val:.1f} BPM, beats: {len(beat_times)}")

        # Calculate energy curve (RMS)
        logger.info(f"[AudioAnalyzer] Calculating energy curve...")
        hop_length = 512
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
        rms_harmonic = librosa.feature.rms(y=y_harmonic, hop_length=hop_length)[0]

        # Normalize energy to 0-1
        if rms.max() > rms.min():
            rms_normalized = (rms - rms.min()) / (rms.max() - rms.min())
        else:
            rms_normalized = np.zeros_like(rms)

        if rms_harmonic.max() > rms_harmonic.min():
            rms_harmonic_normalized = (rms_harmonic - rms_harmonic.min()) / (rms_harmonic.max() - rms_harmonic.min())
        else:
            rms_harmonic_normalized = np.zeros_like(rms_harmonic)

        # Sample energy curve (every 0.25 seconds for better resolution)
        energy_curve = []
        for t in np.arange(0, duration, 0.25):
            idx = int(t * sr / hop_length)
            if idx < len(rms_normalized):
                energy_curve.append((float(t), float(rms_normalized[idx])))

        # Determine song type for analysis strategy
        avg_energy = np.mean(rms_normalized)
        is_slow_song = tempo_val < 100
        is_short_target = target_duration <= 10
        harmonic_ratio = np.mean(rms_harmonic) / (np.mean(rms) + 1e-6)
        is_vocal_focused = harmonic_ratio > 0.6  # High harmonic content suggests vocals

        logger.info(f"[AudioAnalyzer] Song characteristics: slow={is_slow_song}, short_target={is_short_target}, vocal_focused={is_vocal_focused}")

        # ============================================
        # ADVANCED CLIMAX DETECTION
        # ============================================

        # 1. Detect drops using energy gradient (good for pop/EDM)
        logger.info(f"[AudioAnalyzer] Detecting drops (energy gradient)...")
        energy_drops = self._detect_energy_drops(rms_normalized, sr, hop_length, duration)

        # 2. Detect onset bursts (sudden increase in onset strength)
        logger.info(f"[AudioAnalyzer] Analyzing onset strength...")
        onset_drops = self._detect_onset_bursts(y, sr)

        # 3. Detect spectral flux peaks (timbre changes)
        logger.info(f"[AudioAnalyzer] Analyzing spectral flux...")
        spectral_drops = self._detect_spectral_flux_peaks(y, sr)

        # 4. NEW: Detect vocal/harmonic peaks (good for ballads)
        logger.info(f"[AudioAnalyzer] Detecting vocal peaks...")
        vocal_drops = self._detect_vocal_peaks(rms_harmonic_normalized, sr, hop_length, duration)

        # 5. NEW: Detect dynamic range peaks (good for short clips)
        logger.info(f"[AudioAnalyzer] Detecting dynamic moments...")
        dynamic_drops = self._detect_dynamic_moments(rms_normalized, sr, hop_length, duration, target_duration)

        # 6. Merge and score all drop candidates
        all_drops = self._merge_drop_candidates_enhanced(
            energy_drops, onset_drops, spectral_drops, vocal_drops, dynamic_drops,
            duration, is_slow_song, is_short_target
        )

        # 7. Calculate buildups before drops
        builds = self._detect_buildups(all_drops, energy_curve, tempo_val)

        # 8. Generate climax candidates with scoring
        climax_candidates = self._create_climax_candidates_enhanced(
            all_drops, builds, energy_curve, target_duration, duration,
            is_slow_song, is_short_target, rms_harmonic_normalized, sr, hop_length
        )

        # 9. Find best segment considering song type
        best_segment_start, best_hook_start = self._find_best_segments_enhanced(
            climax_candidates, rms, rms_harmonic, sr, hop_length,
            target_duration, duration, is_slow_song, is_short_target
        )

        # Suggest vibe based on tempo and energy characteristics
        if tempo_val >= 120 and avg_energy > 0.5:
            suggested_vibe = "Exciting"
        elif tempo_val >= 100:
            suggested_vibe = "Pop"
        elif tempo_val >= 80:
            suggested_vibe = "Minimal"
        else:
            suggested_vibe = "Emotional"

        # Extract drop times for response
        drop_times = [d.time for d in all_drops[:5]]
        build_pairs = [(b[0], b[1]) for b in builds[:3]]

        logger.info(f"[AudioAnalyzer] Analysis complete:")
        logger.info(f"  - BPM: {int(round(tempo_val))}")
        logger.info(f"  - Duration: {duration:.2f}s")
        logger.info(f"  - Song type: {'slow/ballad' if is_slow_song else 'upbeat'}")
        logger.info(f"  - Target: {target_duration}s ({'short clip' if is_short_target else 'standard'})")
        logger.info(f"  - Drops found: {len(all_drops)}")
        logger.info(f"  - Climax candidates: {len(climax_candidates)}")
        logger.info(f"  - Best segment start: {best_segment_start:.2f}s")
        logger.info(f"  - Best hook start: {best_hook_start:.2f}s")

        return AudioAnalysis(
            bpm=int(round(tempo_val)),
            beat_times=beat_times.tolist(),
            energy_curve=energy_curve,
            duration=float(duration),
            suggested_vibe=suggested_vibe,
            best_15s_start=float(best_segment_start),
            climax_candidates=climax_candidates,
            drops=drop_times,
            builds=build_pairs,
            best_hook_start=float(best_hook_start)
        )

    def _detect_energy_drops(
        self,
        rms_normalized: np.ndarray,
        sr: int,
        hop_length: int,
        duration: float
    ) -> List[DropInfo]:
        """
        Detect drops using energy gradient analysis.

        A drop is characterized by a sudden increase in energy,
        often following a brief dip (the "drop" effect).
        """
        drops = []

        if len(rms_normalized) < 20:
            return drops

        # Calculate energy gradient (rate of change)
        energy_gradient = np.gradient(rms_normalized)

        # Smooth the gradient to reduce noise
        window_size = max(5, int(sr / hop_length / 4))  # ~0.25s window
        if window_size % 2 == 0:
            window_size += 1
        smoothed_gradient = np.convolve(
            energy_gradient,
            np.ones(window_size) / window_size,
            mode='same'
        )

        # Find significant positive gradients (energy increases)
        threshold = np.std(smoothed_gradient) * 1.5
        positive_threshold = np.percentile(smoothed_gradient[smoothed_gradient > 0], 85)

        # Find peaks in the gradient
        for i in range(1, len(smoothed_gradient) - 1):
            # Local maximum in gradient
            if (smoothed_gradient[i] > smoothed_gradient[i-1] and
                smoothed_gradient[i] > smoothed_gradient[i+1] and
                smoothed_gradient[i] > positive_threshold):

                time = librosa.frames_to_time(i, sr=sr, hop_length=hop_length)

                # Skip if too close to start or end
                if time < 5 or time > duration - 5:
                    continue

                # Calculate score based on gradient magnitude
                score = min(1.0, smoothed_gradient[i] / (np.max(smoothed_gradient) + 1e-6))

                drops.append(DropInfo(
                    time=float(time),
                    score=float(score),
                    energy_delta=float(smoothed_gradient[i]),
                    type='energy'
                ))

        # Sort by score and remove duplicates within 2 seconds
        drops = self._deduplicate_drops(drops, min_gap=2.0)

        return sorted(drops, key=lambda x: x.score, reverse=True)[:10]

    def _detect_onset_bursts(self, y: np.ndarray, sr: int) -> List[DropInfo]:
        """
        Detect onset strength bursts indicating climax moments.

        Onset strength measures how likely a new note/sound is starting.
        Bursts indicate dramatic changes in the music.
        """
        drops = []

        # Calculate onset strength envelope
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)

        if len(onset_env) < 20:
            return drops

        # Normalize
        if onset_env.max() > onset_env.min():
            onset_normalized = (onset_env - onset_env.min()) / (onset_env.max() - onset_env.min())
        else:
            return drops

        # Calculate running average for comparison
        window_size = int(sr / 512 * 2)  # ~2 second window
        running_avg = np.convolve(onset_normalized, np.ones(window_size) / window_size, mode='same')

        # Find peaks that are significantly above running average
        peak_threshold = 0.3  # Peak must be at least this high
        ratio_threshold = 1.5  # Peak must be this much higher than average

        hop_length = 512
        duration = len(y) / sr

        for i in range(window_size, len(onset_normalized) - window_size):
            # Local peak detection
            if (onset_normalized[i] > onset_normalized[i-1] and
                onset_normalized[i] > onset_normalized[i+1] and
                onset_normalized[i] > peak_threshold and
                onset_normalized[i] > running_avg[i] * ratio_threshold):

                time = librosa.frames_to_time(i, sr=sr, hop_length=hop_length)

                if time < 5 or time > duration - 5:
                    continue

                # Score based on how much above average
                ratio = onset_normalized[i] / (running_avg[i] + 1e-6)
                score = min(1.0, (ratio - 1.0) / 2.0)  # Normalize ratio to 0-1

                drops.append(DropInfo(
                    time=float(time),
                    score=float(score),
                    energy_delta=float(onset_normalized[i] - running_avg[i]),
                    type='onset'
                ))

        drops = self._deduplicate_drops(drops, min_gap=2.0)

        return sorted(drops, key=lambda x: x.score, reverse=True)[:10]

    def _detect_spectral_flux_peaks(self, y: np.ndarray, sr: int) -> List[DropInfo]:
        """
        Detect spectral flux peaks indicating timbre/texture changes.

        Spectral flux measures how quickly the spectrum is changing.
        High flux = dramatic timbral change (common in drops).
        """
        drops = []

        # Calculate spectrogram
        hop_length = 512
        S = np.abs(librosa.stft(y, hop_length=hop_length))

        if S.shape[1] < 20:
            return drops

        # Calculate spectral flux (L2 norm of spectral difference)
        spectral_flux = np.sqrt(np.sum(np.diff(S, axis=1) ** 2, axis=0))

        # Normalize
        if spectral_flux.max() > spectral_flux.min():
            flux_normalized = (spectral_flux - spectral_flux.min()) / (spectral_flux.max() - spectral_flux.min())
        else:
            return drops

        # Find peaks in spectral flux
        threshold = np.percentile(flux_normalized, 90)
        duration = len(y) / sr

        for i in range(1, len(flux_normalized) - 1):
            if (flux_normalized[i] > flux_normalized[i-1] and
                flux_normalized[i] > flux_normalized[i+1] and
                flux_normalized[i] > threshold):

                # Add 1 because diff reduces length by 1
                time = librosa.frames_to_time(i + 1, sr=sr, hop_length=hop_length)

                if time < 5 or time > duration - 5:
                    continue

                score = float(flux_normalized[i])

                drops.append(DropInfo(
                    time=float(time),
                    score=score,
                    energy_delta=float(flux_normalized[i]),
                    type='spectral'
                ))

        drops = self._deduplicate_drops(drops, min_gap=2.0)

        return sorted(drops, key=lambda x: x.score, reverse=True)[:10]

    def _merge_drop_candidates(
        self,
        energy_drops: List[DropInfo],
        onset_drops: List[DropInfo],
        spectral_drops: List[DropInfo],
        duration: float
    ) -> List[DropInfo]:
        """
        Merge drop candidates from different detection methods.

        Drops detected by multiple methods get higher scores.
        """
        all_drops = []
        time_tolerance = 1.0  # seconds

        # Start with energy drops as base
        for drop in energy_drops:
            # Check if onset detection agrees
            onset_match = any(
                abs(d.time - drop.time) < time_tolerance
                for d in onset_drops
            )
            # Check if spectral detection agrees
            spectral_match = any(
                abs(d.time - drop.time) < time_tolerance
                for d in spectral_drops
            )

            # Boost score if multiple methods agree
            boost = 1.0
            if onset_match:
                boost += 0.3
            if spectral_match:
                boost += 0.2

            all_drops.append(DropInfo(
                time=drop.time,
                score=min(1.0, drop.score * boost),
                energy_delta=drop.energy_delta,
                type='combined' if (onset_match or spectral_match) else drop.type
            ))

        # Add onset drops not covered by energy drops
        for drop in onset_drops:
            if not any(abs(d.time - drop.time) < time_tolerance for d in all_drops):
                all_drops.append(drop)

        # Add spectral drops not covered
        for drop in spectral_drops:
            if not any(abs(d.time - drop.time) < time_tolerance for d in all_drops):
                all_drops.append(drop)

        # Final deduplication and sorting
        all_drops = self._deduplicate_drops(all_drops, min_gap=3.0)

        return sorted(all_drops, key=lambda x: x.score, reverse=True)

    def _deduplicate_drops(
        self,
        drops: List[DropInfo],
        min_gap: float = 2.0
    ) -> List[DropInfo]:
        """Remove drops that are too close together, keeping highest scored."""
        if not drops:
            return []

        sorted_drops = sorted(drops, key=lambda x: x.score, reverse=True)
        result = []

        for drop in sorted_drops:
            if not any(abs(d.time - drop.time) < min_gap for d in result):
                result.append(drop)

        return result

    def _detect_buildups(
        self,
        drops: List[DropInfo],
        energy_curve: List[Tuple[float, float]],
        bpm: float
    ) -> List[Tuple[float, float, float]]:
        """
        Detect buildup sections before drops.

        Returns list of (start, end, drop_time) tuples.
        """
        builds = []

        if not drops or not energy_curve:
            return builds

        # Calculate buildup duration based on BPM (2-4 bars)
        # 1 bar = 4 beats at 4/4 time
        beats_per_bar = 4
        bars_for_buildup = 2  # Start with 2 bars
        beats_per_minute = bpm if bpm > 0 else 120
        buildup_duration = (beats_per_bar * bars_for_buildup) / (beats_per_minute / 60)
        buildup_duration = max(3.0, min(8.0, buildup_duration))  # Clamp 3-8s

        for drop in drops[:5]:  # Process top 5 drops
            build_end = drop.time - 0.5  # Half second before drop
            build_start = max(0, build_end - buildup_duration)

            # Verify this is actually a buildup (energy should be increasing)
            build_energies = [
                e for t, e in energy_curve
                if build_start <= t <= build_end
            ]

            if len(build_energies) >= 3:
                # Check if energy generally increases
                first_half = np.mean(build_energies[:len(build_energies)//2])
                second_half = np.mean(build_energies[len(build_energies)//2:])

                if second_half >= first_half * 0.9:  # Allow some tolerance
                    builds.append((build_start, build_end, drop.time))

        return builds

    def _create_climax_candidates(
        self,
        drops: List[DropInfo],
        builds: List[Tuple[float, float, float]],
        energy_curve: List[Tuple[float, float]],
        target_duration: float,
        total_duration: float
    ) -> List[ClimaxCandidate]:
        """
        Create climax candidates with suggested start times.
        """
        candidates = []

        # 1. Add drop-based candidates
        for drop in drops[:5]:
            # Find corresponding buildup
            build_for_drop = next(
                (b for b in builds if abs(b[2] - drop.time) < 0.5),
                None
            )

            if build_for_drop:
                start_time = build_for_drop[0]
            else:
                # Default: start 5 seconds before drop
                start_time = max(0, drop.time - 5)

            # Ensure we have enough room for target duration
            if start_time + target_duration > total_duration:
                start_time = max(0, total_duration - target_duration)

            candidates.append(ClimaxCandidate(
                start_time=start_time,
                drop_time=drop.time,
                score=drop.score,
                type=drop.type
            ))

        # 2. Add energy-peak based candidate if no good drops found
        if len(candidates) < 3 and energy_curve:
            energy_values = [e for _, e in energy_curve]
            energy_times = [t for t, _ in energy_curve]

            # Find top energy windows
            window_samples = int(target_duration / 0.25)  # samples per window

            for _ in range(3 - len(candidates)):
                best_start_idx = 0
                best_energy = 0

                for i in range(len(energy_values) - window_samples):
                    window_energy = np.mean(energy_values[i:i + window_samples])
                    if window_energy > best_energy:
                        # Check if not too close to existing candidates
                        start_time = energy_times[i]
                        if not any(abs(c.start_time - start_time) < 10 for c in candidates):
                            best_energy = window_energy
                            best_start_idx = i

                if best_energy > 0:
                    start_time = energy_times[best_start_idx]
                    peak_idx = best_start_idx + window_samples // 2
                    peak_time = energy_times[min(peak_idx, len(energy_times) - 1)]

                    candidates.append(ClimaxCandidate(
                        start_time=start_time,
                        drop_time=peak_time,
                        score=min(1.0, best_energy),
                        type='energy_peak'
                    ))

                    # Mark this region as used
                    for i in range(best_start_idx, min(best_start_idx + window_samples, len(energy_values))):
                        energy_values[i] = 0

        # Sort by score
        candidates.sort(key=lambda x: x.score, reverse=True)

        return candidates[:5]  # Return top 5

    def _find_best_segments(
        self,
        candidates: List[ClimaxCandidate],
        rms: np.ndarray,
        sr: int,
        hop_length: int,
        target_duration: float,
        total_duration: float
    ) -> Tuple[float, float]:
        """
        Find best 15s segment and best hook start point.
        """
        # Best hook start: use top candidate if available
        if candidates:
            best_hook_start = candidates[0].start_time
        else:
            best_hook_start = 0.0

        # Best 15s: consider candidates but also do energy-based search
        if candidates and candidates[0].score > 0.5:
            # Use top candidate's start
            best_15s_start = candidates[0].start_time
        else:
            # Fallback to pure energy-based search
            if total_duration <= target_duration:
                best_15s_start = 0.0
            else:
                samples_per_segment = int(target_duration * sr / hop_length)
                best_energy = 0.0
                best_start_idx = 0

                for i in range(len(rms) - samples_per_segment):
                    segment_energy = np.mean(rms[i:i + samples_per_segment])
                    if segment_energy > best_energy:
                        best_energy = segment_energy
                        best_start_idx = i

                best_15s_start = librosa.frames_to_time(
                    best_start_idx, sr=sr, hop_length=hop_length
                )

        return best_15s_start, best_hook_start

    def _detect_vocal_peaks(
        self,
        rms_harmonic: np.ndarray,
        sr: int,
        hop_length: int,
        duration: float
    ) -> List[DropInfo]:
        """
        Detect vocal/harmonic peaks - good for ballads and vocal-focused songs.
        Uses harmonic component to find where vocals are strongest.
        """
        drops = []

        if len(rms_harmonic) < 20:
            return drops

        # Find sustained high-energy harmonic sections
        # Smooth the harmonic energy to find sustained peaks (not transients)
        window_size = int(sr / hop_length)  # ~1 second window
        if window_size % 2 == 0:
            window_size += 1
        smoothed = np.convolve(rms_harmonic, np.ones(window_size) / window_size, mode='same')

        # Find peaks in smoothed harmonic energy
        threshold = np.percentile(smoothed, 75)

        for i in range(window_size, len(smoothed) - window_size):
            # Local maximum
            if (smoothed[i] > smoothed[i-1] and
                smoothed[i] > smoothed[i+1] and
                smoothed[i] > threshold):

                time = librosa.frames_to_time(i, sr=sr, hop_length=hop_length)

                if time < 3 or time > duration - 3:
                    continue

                # Score based on how sustained the peak is (vocal sections are sustained)
                context_start = max(0, i - window_size // 2)
                context_end = min(len(smoothed), i + window_size // 2)
                sustain_score = np.mean(smoothed[context_start:context_end]) / (np.max(smoothed) + 1e-6)

                drops.append(DropInfo(
                    time=float(time),
                    score=float(sustain_score),
                    energy_delta=float(smoothed[i]),
                    type='vocal'
                ))

        drops = self._deduplicate_drops(drops, min_gap=3.0)
        return sorted(drops, key=lambda x: x.score, reverse=True)[:8]

    def _detect_dynamic_moments(
        self,
        rms_normalized: np.ndarray,
        sr: int,
        hop_length: int,
        duration: float,
        target_duration: float
    ) -> List[DropInfo]:
        """
        Detect high dynamic range moments - best for short clips.
        Finds sections with maximum contrast within the target window.
        """
        drops = []

        if len(rms_normalized) < 20:
            return drops

        # Calculate local dynamic range over target_duration windows
        window_samples = int(target_duration * sr / hop_length)

        for i in range(0, len(rms_normalized) - window_samples, window_samples // 4):
            window = rms_normalized[i:i + window_samples]

            # Dynamic range = max - min in window
            dynamic_range = np.max(window) - np.min(window)

            # Also consider the "story arc" - prefer sections that have clear build
            first_half = np.mean(window[:len(window)//2])
            second_half = np.mean(window[len(window)//2:])
            arc_score = (second_half - first_half + 1) / 2  # Normalize to 0-1

            # Combined score: dynamic range + story arc
            score = (dynamic_range * 0.6) + (arc_score * 0.4)

            time = librosa.frames_to_time(i, sr=sr, hop_length=hop_length)

            if time < 2 or time > duration - target_duration:
                continue

            drops.append(DropInfo(
                time=float(time),
                score=float(score),
                energy_delta=float(dynamic_range),
                type='dynamic'
            ))

        drops = self._deduplicate_drops(drops, min_gap=target_duration / 2)
        return sorted(drops, key=lambda x: x.score, reverse=True)[:8]

    def _merge_drop_candidates_enhanced(
        self,
        energy_drops: List[DropInfo],
        onset_drops: List[DropInfo],
        spectral_drops: List[DropInfo],
        vocal_drops: List[DropInfo],
        dynamic_drops: List[DropInfo],
        duration: float,
        is_slow_song: bool,
        is_short_target: bool
    ) -> List[DropInfo]:
        """
        Enhanced merge that considers song type and target duration.
        """
        all_drops = []
        time_tolerance = 1.5  # seconds

        # Determine weighting based on song type
        if is_slow_song:
            # For ballads: prioritize vocals and dynamics over energy drops
            primary_drops = vocal_drops if vocal_drops else energy_drops
            weight_energy = 0.6
            weight_vocal = 1.2
            weight_dynamic = 1.0
        else:
            # For upbeat: prioritize energy drops
            primary_drops = energy_drops
            weight_energy = 1.0
            weight_vocal = 0.7
            weight_dynamic = 0.8

        if is_short_target:
            # For short clips: boost dynamic drops
            weight_dynamic *= 1.3

        # Process primary drops
        for drop in primary_drops:
            # Check for agreements
            onset_match = any(abs(d.time - drop.time) < time_tolerance for d in onset_drops)
            spectral_match = any(abs(d.time - drop.time) < time_tolerance for d in spectral_drops)
            vocal_match = any(abs(d.time - drop.time) < time_tolerance for d in vocal_drops) if drop.type != 'vocal' else False
            dynamic_match = any(abs(d.time - drop.time) < time_tolerance for d in dynamic_drops) if drop.type != 'dynamic' else False

            # Calculate boosted score
            base_weight = weight_vocal if drop.type == 'vocal' else (weight_dynamic if drop.type == 'dynamic' else weight_energy)
            boost = base_weight
            if onset_match:
                boost += 0.2
            if spectral_match:
                boost += 0.15
            if vocal_match:
                boost += 0.25
            if dynamic_match:
                boost += 0.2

            # Determine type
            match_count = sum([onset_match, spectral_match, vocal_match, dynamic_match])
            if match_count >= 2:
                drop_type = 'combined'
            else:
                drop_type = drop.type

            all_drops.append(DropInfo(
                time=drop.time,
                score=min(1.0, drop.score * boost),
                energy_delta=drop.energy_delta,
                type=drop_type
            ))

        # Add unique drops from other sources
        for drop_list, weight in [(energy_drops, weight_energy), (onset_drops, 0.8),
                                    (spectral_drops, 0.7), (vocal_drops, weight_vocal),
                                    (dynamic_drops, weight_dynamic)]:
            for drop in drop_list:
                if not any(abs(d.time - drop.time) < time_tolerance for d in all_drops):
                    all_drops.append(DropInfo(
                        time=drop.time,
                        score=min(1.0, drop.score * weight),
                        energy_delta=drop.energy_delta,
                        type=drop.type
                    ))

        # Final deduplication and sorting
        all_drops = self._deduplicate_drops(all_drops, min_gap=2.0)
        return sorted(all_drops, key=lambda x: x.score, reverse=True)

    def _create_climax_candidates_enhanced(
        self,
        drops: List[DropInfo],
        builds: List[Tuple[float, float, float]],
        energy_curve: List[Tuple[float, float]],
        target_duration: float,
        total_duration: float,
        is_slow_song: bool,
        is_short_target: bool,
        rms_harmonic: np.ndarray,
        sr: int,
        hop_length: int
    ) -> List[ClimaxCandidate]:
        """
        Enhanced climax candidate creation for different song types.
        """
        candidates = []

        # 1. Add drop-based candidates
        for drop in drops[:7]:
            build_for_drop = next(
                (b for b in builds if abs(b[2] - drop.time) < 0.5),
                None
            )

            if build_for_drop:
                start_time = build_for_drop[0]
            else:
                # For short clips, center the drop in the segment
                if is_short_target:
                    start_time = max(0, drop.time - target_duration * 0.6)
                else:
                    start_time = max(0, drop.time - 5)

            # Ensure we have enough room
            if start_time + target_duration > total_duration:
                start_time = max(0, total_duration - target_duration)

            candidates.append(ClimaxCandidate(
                start_time=start_time,
                drop_time=drop.time,
                score=drop.score,
                type=drop.type
            ))

        # 2. For slow songs, add "gentle peaks" - sections with nice sustained energy
        if is_slow_song and len(candidates) < 5:
            # Find sections with smooth, sustained harmonic energy
            window_samples = int(target_duration * sr / hop_length)
            for i in range(0, len(rms_harmonic) - window_samples, window_samples // 2):
                window = rms_harmonic[i:i + window_samples]
                # Look for sustained, smooth energy (low variance, decent mean)
                mean_energy = np.mean(window)
                variance = np.var(window)
                smoothness_score = mean_energy / (1 + variance * 10)  # Penalize high variance

                if smoothness_score > 0.3:
                    start_time = librosa.frames_to_time(i, sr=sr, hop_length=hop_length)
                    if not any(abs(c.start_time - start_time) < 5 for c in candidates):
                        peak_time = start_time + target_duration / 2
                        candidates.append(ClimaxCandidate(
                            start_time=start_time,
                            drop_time=peak_time,
                            score=smoothness_score,
                            type='gentle'
                        ))

        # 3. For short targets, add high-impact moments
        if is_short_target and len(candidates) < 5 and energy_curve:
            energy_values = [e for _, e in energy_curve]
            energy_times = [t for t, _ in energy_curve]
            window_samples = int(target_duration / 0.25)

            for i in range(len(energy_values) - window_samples):
                window = energy_values[i:i + window_samples]
                # Find sections with quick energy rise (impactful for short clips)
                if len(window) >= 3:
                    rise = max(0, window[-1] - window[0])
                    peak = max(window)
                    impact_score = (rise * 0.4) + (peak * 0.6)

                    if impact_score > 0.4:
                        start_time = energy_times[i]
                        if not any(abs(c.start_time - start_time) < target_duration for c in candidates):
                            candidates.append(ClimaxCandidate(
                                start_time=start_time,
                                drop_time=start_time + target_duration * 0.7,
                                score=impact_score,
                                type='impact'
                            ))

        # Sort by score and return top candidates
        candidates.sort(key=lambda x: x.score, reverse=True)
        return candidates[:7]

    def _find_best_segments_enhanced(
        self,
        candidates: List[ClimaxCandidate],
        rms: np.ndarray,
        rms_harmonic: np.ndarray,
        sr: int,
        hop_length: int,
        target_duration: float,
        total_duration: float,
        is_slow_song: bool,
        is_short_target: bool
    ) -> Tuple[float, float]:
        """
        Enhanced segment finding that considers song characteristics.
        """
        # Best hook start: use top candidate if available
        if candidates:
            best_hook_start = candidates[0].start_time
        else:
            best_hook_start = 0.0

        # Find best segment based on song type
        if candidates and candidates[0].score > 0.4:
            best_segment_start = candidates[0].start_time
        else:
            if total_duration <= target_duration:
                best_segment_start = 0.0
            else:
                # Choose analysis target based on song type
                if is_slow_song:
                    # For ballads, use harmonic energy
                    rms_target = rms_harmonic
                else:
                    rms_target = rms

                samples_per_segment = int(target_duration * sr / hop_length)
                best_score = 0.0
                best_start_idx = 0

                for i in range(len(rms_target) - samples_per_segment):
                    segment = rms_target[i:i + samples_per_segment]
                    segment_energy = np.mean(segment)

                    # For short clips, prefer sections with dynamic arc
                    if is_short_target:
                        first_quarter = np.mean(segment[:len(segment)//4])
                        last_quarter = np.mean(segment[-len(segment)//4:])
                        # Prefer build-up to climax pattern
                        arc_bonus = max(0, (last_quarter - first_quarter) * 0.5)
                        score = segment_energy + arc_bonus
                    else:
                        score = segment_energy

                    if score > best_score:
                        best_score = score
                        best_start_idx = i

                best_segment_start = librosa.frames_to_time(
                    best_start_idx, sr=sr, hop_length=hop_length
                )

        return best_segment_start, best_hook_start

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
