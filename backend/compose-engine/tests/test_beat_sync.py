"""Tests for beat synchronization."""

import pytest
from app.services.beat_sync import BeatSyncEngine


class TestBeatSyncEngine:
    """Tests for BeatSyncEngine."""

    def setup_method(self):
        """Setup test fixtures."""
        self.engine = BeatSyncEngine()

    def test_calculate_cuts_even_distribution(self):
        """Test cut calculation with no beats (even distribution)."""
        cuts = self.engine.calculate_cuts(
            beat_times=[],
            num_images=4,
            target_duration=16.0,
            cut_style="medium"
        )

        assert len(cuts) == 4
        assert cuts[0][0] == 0.0
        assert cuts[-1][1] == 16.0

        # Check even distribution
        for start, end in cuts:
            assert end - start == pytest.approx(4.0, rel=0.1)

    def test_calculate_cuts_with_beats(self):
        """Test cut calculation with beat times."""
        # 120 BPM = beat every 0.5 seconds
        beat_times = [i * 0.5 for i in range(30)]  # 15 seconds of beats

        cuts = self.engine.calculate_cuts(
            beat_times=beat_times,
            num_images=5,
            target_duration=15.0,
            cut_style="medium"  # Every 2 beats
        )

        assert len(cuts) == 5
        assert cuts[0][0] == 0.0

    def test_calculate_cuts_fast_style(self):
        """Test fast cut style (every beat)."""
        beat_times = [i * 0.5 for i in range(10)]

        cuts = self.engine.calculate_cuts(
            beat_times=beat_times,
            num_images=3,
            target_duration=5.0,
            cut_style="fast"
        )

        assert len(cuts) == 3

    def test_calculate_cuts_slow_style(self):
        """Test slow cut style (every 4 beats)."""
        beat_times = [i * 0.5 for i in range(20)]

        cuts = self.engine.calculate_cuts(
            beat_times=beat_times,
            num_images=3,
            target_duration=10.0,
            cut_style="slow"
        )

        assert len(cuts) == 3

    def test_find_nearest_beat(self):
        """Test finding nearest beat."""
        beat_times = [0.0, 0.5, 1.0, 1.5, 2.0]

        nearest = self.engine.find_nearest_beat(beat_times, 0.7)
        assert nearest == pytest.approx(0.5, rel=0.1) or nearest == pytest.approx(1.0, rel=0.1)

        nearest = self.engine.find_nearest_beat(beat_times, 0.0)
        assert nearest == 0.0

    def test_get_beat_intensity(self):
        """Test energy interpolation."""
        energy_curve = [
            (0.0, 0.2),
            (1.0, 0.8),
            (2.0, 0.5)
        ]

        # Exact point
        intensity = self.engine.get_beat_intensity(energy_curve, 0.0)
        assert intensity == 0.2

        # Interpolated point
        intensity = self.engine.get_beat_intensity(energy_curve, 0.5)
        assert intensity == pytest.approx(0.5, rel=0.1)

    def test_snap_to_beats(self):
        """Test snapping times to beats."""
        beat_times = [0.0, 1.0, 2.0, 3.0]
        times = [0.05, 0.95, 1.5, 2.02]

        snapped = self.engine.snap_to_beats(times, beat_times, tolerance=0.1)

        assert snapped[0] == 0.0  # Snapped
        assert snapped[1] == 1.0  # Snapped
        assert snapped[2] == 1.5  # Not snapped (too far)
        assert snapped[3] == 2.0  # Snapped
