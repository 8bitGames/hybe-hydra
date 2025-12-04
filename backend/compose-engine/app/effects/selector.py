"""Effect Selector - Selects appropriate effects based on prompt analysis."""

import logging
import random
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from .registry import get_registry, EffectMetadata, EffectType, EffectSource, Intensity

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

    def to_dict(self) -> Dict[str, Any]:
        return {
            "transitions": [e.to_dict() for e in self.transitions],
            "motions": [e.to_dict() for e in self.motions],
            "filters": [e.to_dict() for e in self.filters],
            "text_animations": [e.to_dict() for e in self.text_animations],
        }

    def to_ids(self) -> Dict[str, List[str]]:
        """Get just the effect IDs for compact representation."""
        return {
            "transitions": [e.id for e in self.transitions],
            "motions": [e.id for e in self.motions],
            "filters": [e.id for e in self.filters],
            "text_animations": [e.id for e in self.text_animations],
        }


@dataclass
class SelectionConfig:
    """Configuration for effect selection."""

    num_transitions: int = 5  # Number of transitions to select
    num_motions: int = 3  # Number of motion effects
    num_filters: int = 2  # Number of filter effects
    num_text_animations: int = 2  # Number of text animations

    preferred_sources: Optional[List[EffectSource]] = None  # Preferred effect sources
    exclude_sources: Optional[List[EffectSource]] = None  # Sources to exclude

    gpu_available: bool = True  # Whether GPU is available
    diversity_weight: float = 0.3  # Weight for diversity vs score (0-1)

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

        # If not enough candidates for diversity, get ALL of that type
        # This ensures we can select diverse effects even when mood/genre filtering is too strict
        if len(candidates) < count:
            all_of_type = self.registry.by_type(effect_type)
            if not config.gpu_available:
                all_of_type = [c for c in all_of_type if not c.gpu_required]
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
        Select effects balancing score and diversity.

        Uses a mix of top-scored effects and random sampling to ensure variety.
        """
        if not scored_effects:
            return []

        count = min(count, len(scored_effects))

        # Number of top picks vs diverse picks
        top_count = max(1, int(count * (1 - diversity_weight)))
        diverse_count = count - top_count

        selected = []

        # Take top scored
        for effect, score in scored_effects[:top_count]:
            selected.append(effect)

        # Take diverse picks from remaining
        remaining = [e for e, s in scored_effects[top_count:]]
        if remaining and diverse_count > 0:
            # Weight by source diversity
            source_counts: Dict[EffectSource, int] = {}
            for e in selected:
                source_counts[e.source] = source_counts.get(e.source, 0) + 1

            # Prefer underrepresented sources
            diverse_picks = []
            for _ in range(min(diverse_count, len(remaining))):
                # Score remaining by inverse source count
                candidates_with_diversity = []
                for e in remaining:
                    if e not in diverse_picks:
                        source_penalty = source_counts.get(e.source, 0)
                        diversity_score = 1.0 / (1 + source_penalty)
                        candidates_with_diversity.append((e, diversity_score))

                if not candidates_with_diversity:
                    break

                # Weighted random selection
                total = sum(s for _, s in candidates_with_diversity)
                r = random.random() * total
                cumulative = 0
                for e, s in candidates_with_diversity:
                    cumulative += s
                    if cumulative >= r:
                        diverse_picks.append(e)
                        source_counts[e.source] = source_counts.get(e.source, 0) + 1
                        break

            selected.extend(diverse_picks)

        return selected[:count]

    def _resolve_conflicts(self, selected: SelectedEffects) -> SelectedEffects:
        """Remove conflicting effects."""
        # Collect all selected effect IDs
        all_selected = set()
        for effects_list in [selected.transitions, selected.motions, selected.filters, selected.text_animations]:
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
