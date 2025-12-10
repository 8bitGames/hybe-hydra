"""Vibe presets for video composition."""

from .base import VibePreset
from .exciting import EXCITING_PRESET
from .emotional import EMOTIONAL_PRESET
from .pop import POP_PRESET
from .minimal import MINIMAL_PRESET
from .chill import CHILL_PRESET
from .intense import INTENSE_PRESET
from .dreamy import DREAMY_PRESET
from .energetic import ENERGETIC_PRESET


PRESETS = {
    "Exciting": EXCITING_PRESET,
    "Emotional": EMOTIONAL_PRESET,
    "Pop": POP_PRESET,
    "Minimal": MINIMAL_PRESET,
    "Chill": CHILL_PRESET,
    "Intense": INTENSE_PRESET,
    "Dreamy": DREAMY_PRESET,
    "Energetic": ENERGETIC_PRESET
}


def get_preset(vibe: str) -> VibePreset:
    """Get a preset by vibe name."""
    return PRESETS.get(vibe, MINIMAL_PRESET)


__all__ = [
    "VibePreset",
    "EXCITING_PRESET",
    "EMOTIONAL_PRESET",
    "POP_PRESET",
    "MINIMAL_PRESET",
    "CHILL_PRESET",
    "INTENSE_PRESET",
    "DREAMY_PRESET",
    "ENERGETIC_PRESET",
    "PRESETS",
    "get_preset"
]
