"""
Safe Effects Registry
=====================
Only includes verified, stable FFmpeg xfade transitions.
All effects here have been tested and confirmed to work without visual corruption.

IMPORTANT: Do NOT add GLSL shader effects here - they are unstable.
"""

import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

# ============================================================================
# SAFE XFADE TRANSITIONS (100% stable, no GPU required)
# ============================================================================

SAFE_XFADE_TRANSITIONS = [
    # Fade family - Most stable, works everywhere
    "fade",
    "fadeblack",
    "fadewhite",
    "fadegrays",

    # Wipe family - Clean directional transitions
    "wipeleft",
    "wiperight",
    "wipeup",
    "wipedown",

    # Slide family - Dynamic motion transitions
    "slideleft",
    "slideright",
    "slideup",
    "slidedown",

    # Circle/Geometric family - Impact transitions
    "circleclose",
    "circleopen",
    "radial",

    # Smooth family - Professional transitions
    "smoothleft",
    "smoothright",
    "smoothup",
    "smoothdown",

    # Other stable effects
    "dissolve",
    "pixelize",
    "diagtl",
    "diagtr",
    "diagbl",
    "diagbr",
    "distance",
    "squeezeh",
    "squeezev",
]

# ============================================================================
# EXTENDED BLACKLIST (Do NOT use these effects)
# ============================================================================

EXTENDED_BLACKLIST = {
    # Slice effects - cause horizontal/vertical stripes
    "hlslice", "hrslice", "vuslice", "vdslice",
    "xfade_hlslice", "xfade_hrslice", "xfade_vuslice", "xfade_vdslice",

    # Blur effects - make images invisible
    "hblur", "vblur",
    "xfade_hblur", "xfade_vblur",

    # GLSL effects with known issues
    "gl_burn",
    "gl_overexposure",
    "gl_windowslice",
    "gl_gradient",

    # Other problematic effects
    "rectcrop",  # causes stripes
    "zoomin",    # FFmpeg version dependent
    "squeeze",   # FFmpeg version dependent
}

# ============================================================================
# STYLE SET EFFECT MAPPING
# ============================================================================

STYLE_SET_TRANSITIONS = {
    # Viral TikTok - Fast, impactful (circleclose first for viral impact)
    "viral_tiktok": ["circleclose", "slideright", "wipeleft", "radial"],

    # Cinematic Mood - Slow, emotional
    "cinematic_mood": ["fade", "fadeblack", "dissolve"],

    # Clean Minimal - Simple, clean
    "clean_minimal": ["fade", "wipeleft", "wiperight"],

    # Energetic Beat - Dynamic, beat-synced
    "energetic_beat": ["slideright", "slideleft", "circleopen", "radial"],

    # Retro Aesthetic - Vintage feel
    "retro_aesthetic": ["fade", "dissolve", "pixelize"],

    # Professional - Clean, corporate
    "professional_corp": ["fade", "dissolve", "smoothleft", "smoothright"],

    # Dreamy Soft - Soft, gentle
    "dreamy_soft": ["fade", "fadewhite", "dissolve"],

    # Bold Impact - Strong, attention-grabbing (radial first for announcement impact)
    "bold_impact": ["radial", "circleclose", "wipedown", "slidedown"],
}

# ============================================================================
# FRONTEND TO BACKEND EFFECT MAPPING
# ============================================================================

FRONTEND_TO_XFADE_MAP = {
    # Direct mappings (same name)
    "fade": "fade",
    "dissolve": "dissolve",
    "wipeleft": "wipeleft",
    "wiperight": "wiperight",
    "wipeup": "wipeup",
    "wipedown": "wipedown",
    "slideleft": "slideleft",
    "slideright": "slideright",
    "slideup": "slideup",
    "slidedown": "slidedown",
    "circleclose": "circleclose",
    "circleopen": "circleopen",
    "radial": "radial",
    "pixelize": "pixelize",
    "fadeblack": "fadeblack",
    "fadewhite": "fadewhite",
    "smoothleft": "smoothleft",
    "smoothright": "smoothright",

    # Legacy/alternative names → safe mappings
    "zoom": "circleclose",
    "glitch": "pixelize",
    "slide": "slideright",
    "crossfade": "fade",
    "wipe": "wipeleft",
    "flash": "fadewhite",
    "slam": "circleclose",
    "vhs": "pixelize",
    "blur": "fade",
    "cut": "fade",

    # GLSL effects → safe fallbacks
    "gl_crosswarp": "dissolve",
    "gl_dreamy": "fade",
    "gl_cube": "circleclose",
    "gl_doorway": "wiperight",
    "gl_pixelize": "pixelize",
    "gl_swirl": "radial",
    "gl_directionalwarp": "slideright",
    "gl_directionalwipe": "wipeleft",
    "gl_windowslice": "wiperight",
    "gl_burn": "fade",
    "gl_overexposure": "fadewhite",
}

# ============================================================================
# SAFE MOTION EFFECTS
# ============================================================================

SAFE_MOTIONS = [
    "ken_burns",      # Zoom in/out + pan
    "zoom_in",        # Gradual zoom in (5-10%)
    "zoom_out",       # Gradual zoom out
    "subtle_zoom",    # Minimal zoom (5% - professional)
    "shake",          # Camera shake
    "pulse",          # Beat-synced pulse
]

MOTION_FALLBACK_MAP = {
    "parallax": "ken_burns",
    "slow_zoom": "subtle_zoom",
    "float": "subtle_zoom",
    "scan_lines": "subtle_zoom",
    "punch": "pulse",
    "none": "subtle_zoom",
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_safe_transition(requested: str, fallback: str = "fade") -> str:
    """
    Get a safe transition effect, with automatic fallback for unsafe effects.

    Args:
        requested: The requested transition name
        fallback: Fallback effect if requested is unsafe (default: "fade")

    Returns:
        Safe transition name
    """
    # Normalize to lowercase
    requested_lower = requested.lower().strip()

    # Check if in extended blacklist
    if requested_lower in EXTENDED_BLACKLIST:
        logger.warning(f"Blocked blacklisted effect '{requested}' → using '{fallback}'")
        return fallback

    # Check if in frontend mapping
    if requested_lower in FRONTEND_TO_XFADE_MAP:
        mapped = FRONTEND_TO_XFADE_MAP[requested_lower]
        logger.debug(f"Mapped '{requested}' → '{mapped}'")
        return mapped

    # Check if already a safe xfade transition
    if requested_lower in SAFE_XFADE_TRANSITIONS:
        return requested_lower

    # Unknown effect - use fallback
    logger.warning(f"Unknown effect '{requested}' → using '{fallback}'")
    return fallback


def get_safe_motion(requested: str, fallback: str = "subtle_zoom") -> str:
    """
    Get a safe motion effect, with automatic fallback for unsupported motions.

    Args:
        requested: The requested motion name
        fallback: Fallback effect if requested is unsupported (default: "subtle_zoom")

    Returns:
        Safe motion name
    """
    requested_lower = requested.lower().strip()

    # Check if in safe motions
    if requested_lower in SAFE_MOTIONS:
        return requested_lower

    # Check fallback map
    if requested_lower in MOTION_FALLBACK_MAP:
        mapped = MOTION_FALLBACK_MAP[requested_lower]
        logger.debug(f"Mapped motion '{requested}' → '{mapped}'")
        return mapped

    # Unknown motion - use fallback
    logger.warning(f"Unknown motion '{requested}' → using '{fallback}'")
    return fallback


def get_transitions_for_style(style_set_id: str) -> List[str]:
    """
    Get the recommended transitions for a style set.

    Args:
        style_set_id: The style set ID (e.g., "viral_tiktok")

    Returns:
        List of safe transition names
    """
    return STYLE_SET_TRANSITIONS.get(style_set_id, ["fade", "dissolve"])


def sanitize_transitions(transitions: List[str]) -> List[str]:
    """
    Sanitize a list of transitions, replacing unsafe ones with safe alternatives.

    Args:
        transitions: List of transition names

    Returns:
        List of safe transition names
    """
    safe_transitions = []
    for t in transitions:
        safe_t = get_safe_transition(t)
        if safe_t not in safe_transitions:  # Avoid duplicates
            safe_transitions.append(safe_t)
    return safe_transitions


def sanitize_motions(motions: List[str]) -> List[str]:
    """
    Sanitize a list of motions, replacing unsupported ones with safe alternatives.

    Args:
        motions: List of motion names

    Returns:
        List of safe motion names
    """
    safe_motions = []
    for m in motions:
        safe_m = get_safe_motion(m)
        if safe_m not in safe_motions:  # Avoid duplicates
            safe_motions.append(safe_m)
    return safe_motions


def is_safe_effect(effect_name: str) -> bool:
    """
    Check if an effect is safe to use.

    Args:
        effect_name: The effect name to check

    Returns:
        True if safe, False if blacklisted or unknown
    """
    effect_lower = effect_name.lower().strip()

    if effect_lower in EXTENDED_BLACKLIST:
        return False

    if effect_lower in SAFE_XFADE_TRANSITIONS:
        return True

    if effect_lower in FRONTEND_TO_XFADE_MAP:
        return True

    return False
