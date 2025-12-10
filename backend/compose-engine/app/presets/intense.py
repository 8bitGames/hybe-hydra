"""Intense vibe preset - high energy, dramatic content."""

from .base import VibePreset


INTENSE_PRESET = VibePreset(
    name="Intense",
    bpm_range=(140, 180),
    cut_style="rapid",
    base_cut_duration=1.5,  # Very fast cuts
    transition_type="glitch_wave",
    transition_duration=0.1,
    motion_style="shake",
    color_grade="moody",
    text_style="bold_pop",
    effects=["glitch", "flash_transition", "chromatic_aberration"],
    duration_range=(8, 15)  # Intense: short, impactful
)
