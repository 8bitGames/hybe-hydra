"""Energetic vibe preset - upbeat, dynamic content."""

from .base import VibePreset


ENERGETIC_PRESET = VibePreset(
    name="Energetic",
    bpm_range=(110, 130),
    cut_style="upbeat",
    base_cut_duration=2.0,  # Dynamic cuts
    transition_type="bounce",
    transition_duration=0.2,
    motion_style="bounce",
    color_grade="vibrant",
    text_style="slide_in",
    effects=["flash_transition", "pulse"],
    duration_range=(12, 20)  # Energetic: medium length
)
