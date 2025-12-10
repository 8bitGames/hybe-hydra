"""Dreamy vibe preset - ethereal, soft content."""

from .base import VibePreset


DREAMY_PRESET = VibePreset(
    name="Dreamy",
    bpm_range=(60, 85),
    cut_style="slow",
    base_cut_duration=5.0,  # Slow, flowing cuts
    transition_type="swirl",
    transition_duration=1.0,
    motion_style="float",
    color_grade="bright",
    text_style="fade_in",
    effects=["soft_blur", "glow", "light_leak"],
    duration_range=(20, 45)  # Dreamy: longer, atmospheric
)
