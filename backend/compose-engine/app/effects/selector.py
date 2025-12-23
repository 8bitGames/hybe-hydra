"""Effect Selector - Selects appropriate effects based on prompt analysis."""

import logging
import random
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from .registry import get_registry, EffectMetadata, EffectType, EffectSource, Intensity, BLACKLISTED_EFFECTS

# Visual Category Mapping for Transition Effects
# This ensures visual diversity - each transition should LOOK different, not just have different IDs
# Categories are based on the visual motion/appearance of the effect
VISUAL_CATEGORIES = {
    # FADE family - gradual opacity/color changes
    "fade": ["fade", "dissolve", "fadeblack", "fadewhite", "fadegrayscale",
             "gl_fade", "gl_crossfade", "gl_dreamy", "gl_luminance_melt"],

    # WIPE HORIZONTAL - left/right directional wipes
    "wipe_horizontal": ["wipeleft", "wiperight", "smoothleft", "smoothright",
                        "slideleft", "slideright", "gl_directional_wipe",
                        "gl_windowslice", "gl_crosswarp"],

    # WIPE VERTICAL - up/down directional wipes
    "wipe_vertical": ["wipeup", "wipedown", "smoothup", "smoothdown",
                      "slideup", "slidedown", "gl_windowblinds"],

    # ZOOM/RADIAL - circular or zoom-based
    "zoom_radial": ["zoomin", "circleopen", "circleclose", "radial",
                    "gl_circle", "gl_directional", "gl_pinwheel",
                    "gl_radial", "gl_swirl", "gl_zoomincircles",
                    "gl_angular", "gl_rotate_scale_fade"],

    # GEOMETRIC - diagonal or shaped transitions
    "geometric": ["diagtl", "diagtr", "diagbl", "diagbr",
                  "horzopen", "horzclose", "vertopen", "vertclose",
                  "diagbox", "wipetl", "wipebr", "wipetr", "wipebl",
                  "gl_cube", "gl_doorway", "gl_heart"],

    # DISTORTION - pixel/squeeze effects
    "distortion": ["pixelize", "squeezeh", "squeezev", "reveal", "distance",
                   "gl_pixelize", "gl_morph", "gl_ripple", "gl_perlin",
                   "gl_flyeye", "gl_burn", "gl_colorphase",
                   "xfade_pixelize", "gl_directionalwarp", "gl_displacement"],

    # GLITCH/MODERN - trendy, dynamic effects
    "glitch_modern": ["gl_glitchdisplace", "gl_glitch_memories",
                      "gl_kaleidoscope", "gl_polkadotscurtain",
                      "gl_static_fade", "gl_randomsquares", "gl_mosaic"],

    # BLUR/SOFT - soft transition effects
    "blur_soft": ["gl_linearblur", "gl_bounce", "gl_bowtiehorizontal",
                  "gl_bowtievertical", "gl_cannabisleaf", "gl_waterdrop",
                  "gl_dreamyzoom", "gl_crosszoom"],
}

# Reverse mapping: effect_id -> category
EFFECT_TO_CATEGORY = {}
for category, effects in VISUAL_CATEGORIES.items():
    for effect in effects:
        EFFECT_TO_CATEGORY[effect] = category
        # Also map lowercase versions
        EFFECT_TO_CATEGORY[effect.lower()] = category


def get_visual_category(effect_id: str) -> str:
    """Get the visual category for an effect.

    Returns the category name or 'unknown' if not mapped.
    Effects in different categories look visually distinct.
    """
    effect_lower = effect_id.lower()

    # Direct lookup
    if effect_lower in EFFECT_TO_CATEGORY:
        return EFFECT_TO_CATEGORY[effect_lower]

    # Keyword-based fallback
    if "fade" in effect_lower or "dissolve" in effect_lower:
        return "fade"
    if "wipe" in effect_lower or "slide" in effect_lower or "smooth" in effect_lower:
        if any(d in effect_lower for d in ["left", "right"]):
            return "wipe_horizontal"
        if any(d in effect_lower for d in ["up", "down"]):
            return "wipe_vertical"
    if "zoom" in effect_lower or "circle" in effect_lower or "radial" in effect_lower:
        return "zoom_radial"
    if "diag" in effect_lower or "horz" in effect_lower or "vert" in effect_lower:
        return "geometric"
    if "pixel" in effect_lower or "squeeze" in effect_lower or "morph" in effect_lower:
        return "distortion"
    if "glitch" in effect_lower or "random" in effect_lower:
        return "glitch_modern"
    if "blur" in effect_lower or "bounce" in effect_lower:
        return "blur_soft"

    return "unknown"


# Try to import PromptAnalysis, or use a stub if analyzer not available
try:
    from .analyzer import PromptAnalysis
except ImportError:
    from dataclasses import dataclass as _dataclass
    from typing import List as _List

    @_dataclass
    class PromptAnalysis:
        """Stub class when analyzer not available."""
        moods: _List[str]
        genres: _List[str]
        keywords: _List[str]
        intensity: str
        reasoning: str = ""
        language: str = "en"

        def to_dict(self):
            return {
                "moods": self.moods,
                "genres": self.genres,
                "keywords": self.keywords,
                "intensity": self.intensity,
                "reasoning": self.reasoning,
                "language": self.language,
            }

logger = logging.getLogger(__name__)


@dataclass
class SelectedEffects:
    """Collection of selected effects for video generation."""

    transitions: List[EffectMetadata] = field(default_factory=list)
    motions: List[EffectMetadata] = field(default_factory=list)
    filters: List[EffectMetadata] = field(default_factory=list)
    text_animations: List[EffectMetadata] = field(default_factory=list)
    overlays: List[EffectMetadata] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "transitions": [e.to_dict() for e in self.transitions],
            "motions": [e.to_dict() for e in self.motions],
            "filters": [e.to_dict() for e in self.filters],
            "text_animations": [e.to_dict() for e in self.text_animations],
            "overlays": [e.to_dict() for e in self.overlays],
        }

    def to_ids(self) -> Dict[str, List[str]]:
        """Get just the effect IDs for compact representation."""
        return {
            "transitions": [e.id for e in self.transitions],
            "motions": [e.id for e in self.motions],
            "filters": [e.id for e in self.filters],
            "text_animations": [e.id for e in self.text_animations],
            "overlays": [e.id for e in self.overlays],
        }


@dataclass
class SelectionConfig:
    """Configuration for effect selection."""

    num_transitions: int = 5  # Number of transitions to select
    num_motions: int = 3  # Number of motion effects
    num_filters: int = 2  # Number of filter effects
    num_text_animations: int = 2  # Number of text animations
    num_overlays: int = 2  # Number of overlay effects (light leak, bokeh, bloom, etc.)

    preferred_sources: Optional[List[EffectSource]] = None  # Preferred effect sources
    exclude_sources: Optional[List[EffectSource]] = None  # Sources to exclude

    gpu_available: bool = True  # Whether GPU is available
    diversity_weight: float = 0.6  # Weight for VISUAL diversity vs score (0-1)
    # Higher value = more visually distinct transitions (recommended: 0.5-0.7)

    min_transition_duration: Optional[float] = None
    max_transition_duration: Optional[float] = None


class EffectSelector:
    """Selects video effects based on prompt analysis."""

    def __init__(self):
        self.registry = get_registry()

    def select(
        self,
        analysis: PromptAnalysis,
        config: Optional[SelectionConfig] = None,
    ) -> SelectedEffects:
        """
        Select effects based on prompt analysis.

        Args:
            analysis: Result from PromptAnalyzer
            config: Selection configuration

        Returns:
            SelectedEffects with appropriate effects
        """
        if config is None:
            config = SelectionConfig()

        # Adjust config based on intensity
        if analysis.intensity == "high":
            config.num_transitions = min(config.num_transitions + 2, 8)
        elif analysis.intensity == "low":
            config.num_transitions = max(config.num_transitions - 1, 3)

        selected = SelectedEffects()

        # Select transitions
        selected.transitions = self._select_by_type(
            effect_type="transition",
            analysis=analysis,
            config=config,
            count=config.num_transitions,
        )

        # Select motions
        selected.motions = self._select_by_type(
            effect_type="motion",
            analysis=analysis,
            config=config,
            count=config.num_motions,
        )

        # Select filters
        selected.filters = self._select_by_type(
            effect_type="filter",
            analysis=analysis,
            config=config,
            count=config.num_filters,
        )

        # Select text animations
        selected.text_animations = self._select_by_type(
            effect_type="text",
            analysis=analysis,
            config=config,
            count=config.num_text_animations,
        )

        # Select overlay effects (light leak, bokeh, bloom, lens flare, etc.)
        selected.overlays = self._select_by_type(
            effect_type="overlay",
            analysis=analysis,
            config=config,
            count=config.num_overlays,
        )

        # Check compatibility and remove conflicts
        selected = self._resolve_conflicts(selected)

        return selected

    def _select_by_type(
        self,
        effect_type: EffectType,
        analysis: PromptAnalysis,
        config: SelectionConfig,
        count: int,
    ) -> List[EffectMetadata]:
        """Select effects of a specific type."""

        # Get candidates
        candidates = self.registry.filter(
            effect_type=effect_type,
            moods=analysis.moods,
            genres=analysis.genres,
            intensity=analysis.intensity,
            gpu_available=config.gpu_available,
            min_duration=config.min_transition_duration if effect_type == "transition" else None,
            max_duration=config.max_transition_duration if effect_type == "transition" else None,
        )

        # Filter out blacklisted effects at SELECTION time
        # These effects cause visual corruption (invisible images, stripes, etc.)
        original_count = len(candidates)
        candidates = [c for c in candidates if c.id not in BLACKLISTED_EFFECTS]
        if original_count != len(candidates):
            logger.info(f"Filtered {original_count - len(candidates)} blacklisted effects from candidates")

        # If not enough candidates for diversity, get ALL of that type
        # This ensures we can select diverse effects even when mood/genre filtering is too strict
        if len(candidates) < count:
            all_of_type = self.registry.by_type(effect_type)
            if not config.gpu_available:
                all_of_type = [c for c in all_of_type if not c.gpu_required]
            # Filter blacklisted effects from the expanded pool too
            all_of_type = [c for c in all_of_type if c.id not in BLACKLISTED_EFFECTS]
            # Add effects not already in candidates
            existing_ids = {c.id for c in candidates}
            for effect in all_of_type:
                if effect.id not in existing_ids:
                    candidates.append(effect)
            logger.info(f"Expanded candidates from {len(existing_ids)} to {len(candidates)} for diversity")

        # Apply source filtering
        if config.preferred_sources:
            preferred = [c for c in candidates if c.source in config.preferred_sources]
            if preferred:
                candidates = preferred

        if config.exclude_sources:
            candidates = [c for c in candidates if c.source not in config.exclude_sources]

        if not candidates:
            return []

        # Score candidates
        scored = self.registry.score_effects(
            effects=candidates,
            moods=analysis.moods,
            genres=analysis.genres,
            keywords=analysis.keywords,
            intensity=analysis.intensity,
        )

        # Select with diversity
        selected = self._select_with_diversity(
            scored_effects=scored,
            count=count,
            diversity_weight=config.diversity_weight,
        )

        return selected

    def _select_with_diversity(
        self,
        scored_effects: List[tuple[EffectMetadata, float]],
        count: int,
        diversity_weight: float,
    ) -> List[EffectMetadata]:
        """
        Select effects balancing score and VISUAL diversity.

        IMPORTANT: Uses VISUAL CATEGORY diversity, not just source diversity.
        This ensures each transition LOOKS different (fade vs wipe vs zoom vs glitch).

        Algorithm:
        1. First pick = highest scored effect
        2. Subsequent picks = prefer effects from DIFFERENT visual categories
        3. This guarantees visually distinct transitions even with same mood/genre
        """
        if not scored_effects:
            return []

        count = min(count, len(scored_effects))
        selected = []
        used_categories: Dict[str, int] = {}  # Track visual category usage

        # Available effects (make a copy to modify)
        available = list(scored_effects)

        for pick_num in range(count):
            if not available:
                break

            if pick_num == 0:
                # First pick: just take highest scored
                best_effect, best_score = available[0]
                selected.append(best_effect)
                available.pop(0)
                category = get_visual_category(best_effect.id)
                used_categories[category] = used_categories.get(category, 0) + 1
                logger.debug(f"Pick {pick_num}: {best_effect.id} (category: {category}, score: {best_score:.2f})")
            else:
                # Subsequent picks: balance score with visual diversity
                best_candidate = None
                best_combined_score = -1

                for effect, score in available:
                    category = get_visual_category(effect.id)
                    category_count = used_categories.get(category, 0)

                    # STRONG penalty for reusing same visual category
                    # category_count=0 → multiplier=1.0 (no penalty)
                    # category_count=1 → multiplier=0.25 (75% penalty)
                    # category_count=2 → multiplier=0.1 (90% penalty)
                    diversity_multiplier = 1.0 / (1 + category_count * 3)

                    # Combined score: original score * diversity boost
                    # diversity_weight controls how much we care about diversity
                    combined_score = score * (
                        (1 - diversity_weight) + diversity_weight * diversity_multiplier
                    )

                    if combined_score > best_combined_score:
                        best_combined_score = combined_score
                        best_candidate = (effect, score, category)

                if best_candidate:
                    effect, orig_score, category = best_candidate
                    selected.append(effect)
                    available = [(e, s) for e, s in available if e.id != effect.id]
                    used_categories[category] = used_categories.get(category, 0) + 1
                    logger.debug(
                        f"Pick {pick_num}: {effect.id} (category: {category}, "
                        f"orig_score: {orig_score:.2f}, combined: {best_combined_score:.2f})"
                    )

        # Log final selection summary
        category_summary = {cat: count for cat, count in used_categories.items()}
        logger.info(f"Selected {len(selected)} effects with visual categories: {category_summary}")

        return selected

    def _resolve_conflicts(self, selected: SelectedEffects) -> SelectedEffects:
        """Remove conflicting effects."""
        # Collect all selected effect IDs
        all_selected = set()
        for effects_list in [selected.transitions, selected.motions, selected.filters, selected.text_animations, selected.overlays]:
            for effect in effects_list:
                all_selected.add(effect.id)

        # Check conflicts
        to_remove = set()
        for effect_id in all_selected:
            effect = self.registry.get(effect_id)
            if effect:
                for conflict_id in effect.conflicts_with:
                    if conflict_id in all_selected:
                        # Remove the lower-priority conflict (keep the first one encountered)
                        to_remove.add(conflict_id)

        # Remove conflicting effects
        if to_remove:
            selected.transitions = [e for e in selected.transitions if e.id not in to_remove]
            selected.motions = [e for e in selected.motions if e.id not in to_remove]
            selected.filters = [e for e in selected.filters if e.id not in to_remove]
            selected.text_animations = [e for e in selected.text_animations if e.id not in to_remove]
            selected.overlays = [e for e in selected.overlays if e.id not in to_remove]

        return selected

    def select_for_clip(
        self,
        clip_index: int,
        total_clips: int,
        analysis: PromptAnalysis,
        selected_effects: SelectedEffects,
    ) -> Dict[str, Any]:
        """
        Select specific effects for a single clip.

        Distributes effects across clips and handles beginning/end differently.

        Args:
            clip_index: Current clip index (0-based)
            total_clips: Total number of clips
            analysis: Prompt analysis
            selected_effects: Pre-selected effects pool

        Returns:
            Dict with specific effect assignments for this clip
        """
        result = {
            "transition": None,
            "motion": None,
            "filter": None,
            "text": None,
            "overlay": None,
        }

        # Transition (except for last clip)
        if clip_index < total_clips - 1 and selected_effects.transitions:
            idx = clip_index % len(selected_effects.transitions)
            result["transition"] = selected_effects.transitions[idx].to_dict()

        # Motion - vary based on position
        if selected_effects.motions:
            # Use zoom_in for first clip, zoom_out for last, mix for others
            if clip_index == 0:
                # Prefer zoom_in for opening
                zoom_in = next((m for m in selected_effects.motions if "zoom_in" in m.id), None)
                result["motion"] = (zoom_in or selected_effects.motions[0]).to_dict()
            elif clip_index == total_clips - 1:
                # Prefer zoom_out for closing
                zoom_out = next((m for m in selected_effects.motions if "zoom_out" in m.id), None)
                result["motion"] = (zoom_out or selected_effects.motions[-1]).to_dict()
            else:
                idx = clip_index % len(selected_effects.motions)
                result["motion"] = selected_effects.motions[idx].to_dict()

        # Filter - apply consistently or vary
        if selected_effects.filters:
            result["filter"] = selected_effects.filters[0].to_dict()

        # Text animation
        if selected_effects.text_animations and clip_index == 0:
            # Apply text animation to first clip
            result["text"] = selected_effects.text_animations[0].to_dict()

        # Overlay effects (light leak, bokeh, bloom, etc.) - apply to video globally
        # Return all selected overlays so the renderer can apply them
        if selected_effects.overlays:
            # For clip-level selection, cycle through overlays
            idx = clip_index % len(selected_effects.overlays)
            result["overlay"] = selected_effects.overlays[idx].to_dict()

        return result


def select_effects(
    prompt: str,
    analysis: Optional[PromptAnalysis] = None,
    config: Optional[SelectionConfig] = None,
) -> SelectedEffects:
    """
    Convenience function to select effects from a prompt.

    Args:
        prompt: User's video concept prompt
        analysis: Pre-computed analysis (if available)
        config: Selection configuration

    Returns:
        SelectedEffects
    """
    if analysis is None:
        from .analyzer import get_analyzer
        analyzer = get_analyzer()
        analysis = analyzer.analyze_sync(prompt)

    selector = EffectSelector()
    return selector.select(analysis, config)
