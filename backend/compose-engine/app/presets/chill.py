"""Chill vibe preset - relaxed, smooth content."""

from .base import VibePreset


CHILL_PRESET = VibePreset(
    name="Chill",
    bpm_range=(70, 95),
    cut_style="slow",
    base_cut_duration=4.0,  # Slow, relaxed cuts
    transition_type="crossfade",
    transition_duration=0.8,
    motion_style="slow_zoom",
    color_grade="natural",
    text_style="fade_in",
    effects=["soft_blur", "vignette"],
    duration_range=(15, 30)  # Relaxed: longer videos
)
