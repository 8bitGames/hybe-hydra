"""Effect Registry - Loads and queries the effects catalog."""

import json
from pathlib import Path
from typing import List, Optional, Dict, Any, Literal
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

EffectType = Literal["transition", "motion", "filter", "text", "overlay"]

# Blacklisted effects that cause visual corruption or make images invisible
# These effects don't render properly with xfade in many configurations
BLACKLISTED_EFFECTS = {
    # Slice effects - cause horizontal/vertical stripes
    "xfade_hlslice",   # Horizontal left slice - causes horizontal stripes
    "xfade_hrslice",   # Horizontal right slice - causes horizontal stripes
    "xfade_vuslice",   # Vertical up slice - causes vertical stripes
    "xfade_vdslice",   # Vertical down slice - causes vertical stripes
    "hlslice",         # Raw names (without xfade_ prefix)
    "hrslice",
    "vuslice",
    "vdslice",

    # Blur effects - can make images invisible
    "xfade_hblur",     # Horizontal blur - can make images invisible
    "hblur",

    # Crop effects - cause visual corruption (horizontal stripes)
    "xfade_rectcrop",  # Rectangle crop - causes horizontal stripes
    "rectcrop",        # Raw name

    # Burn effects - shows solid orange color instead of image during middle progress
    "gl_burn",         # Burns to orange color, making images invisible at progress 0.33-0.66

    # Missing shader effects - these are in catalog but have no GLSL code
    "gl_overexposure", # No shader code exists, falls back incorrectly

    # Other problematic effects
    "gl_windowslice",  # Window slice - similar issues
}
EffectSource = Literal["gl-transitions", "ffmpeg-xfade", "moviepy"]
Intensity = Literal["low", "medium", "high"]


class EffectMetadata:
    """Represents metadata for a single effect."""

    def __init__(self, data: Dict[str, Any]):
        self.id: str = data["id"]
        self.name: str = data["name"]
        self.source: EffectSource = data["source"]
        self.type: EffectType = data["type"]
        self.mood: List[str] = data.get("mood", [])
        self.genre: List[str] = data.get("genre", [])
        self.intensity: Intensity = data.get("intensity", "medium")
        self.description: str = data.get("description", "")
        self.description_ko: str = data.get("description_ko", "")
        self.keywords: List[str] = data.get("keywords", [])
        self.duration_range: tuple = tuple(data.get("duration_range", [0.3, 1.0]))
        self.gpu_required: bool = data.get("gpu_required", False)
        self.params: Dict[str, Any] = data.get("params", {})
        self.compatible_with: List[str] = data.get("compatible_with", [])
        self.conflicts_with: List[str] = data.get("conflicts_with", [])
        self.render_info: Dict[str, str] = data.get("render_info", {})

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "source": self.source,
            "type": self.type,
            "mood": self.mood,
            "genre": self.genre,
            "intensity": self.intensity,
            "description": self.description,
            "description_ko": self.description_ko,
            "keywords": self.keywords,
            "duration_range": list(self.duration_range),
            "gpu_required": self.gpu_required,
            "params": self.params,
            "compatible_with": self.compatible_with,
            "conflicts_with": self.conflicts_with,
            "render_info": self.render_info,
        }

    def matches_mood(self, moods: List[str]) -> float:
        """Calculate mood match score (0-1)."""
        if not moods or not self.mood:
            return 0.0
        matches = len(set(moods) & set(self.mood))
        return matches / len(moods)

    def matches_genre(self, genres: List[str]) -> float:
        """Calculate genre match score (0-1)."""
        if not genres or not self.genre:
            return 0.0
        matches = len(set(genres) & set(self.genre))
        return matches / len(genres)

    def matches_keywords(self, keywords: List[str]) -> float:
        """Calculate keyword match score (0-1)."""
        if not keywords or not self.keywords:
            return 0.0
        # Normalize keywords for matching
        normalized_keywords = [k.lower() for k in keywords]
        normalized_self = [k.lower() for k in self.keywords]
        matches = len(set(normalized_keywords) & set(normalized_self))
        return matches / len(keywords)

    def __repr__(self):
        return f"<Effect {self.id} ({self.source}, {self.type})>"


class EffectRegistry:
    """Registry for managing and querying video effects."""

    _instance: Optional["EffectRegistry"] = None

    def __new__(cls):
        """Singleton pattern to ensure single instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._effects: Dict[str, EffectMetadata] = {}
        self._by_type: Dict[EffectType, List[EffectMetadata]] = {
            "transition": [],
            "motion": [],
            "filter": [],
            "text": [],
            "overlay": [],
        }
        self._by_source: Dict[EffectSource, List[EffectMetadata]] = {
            "gl-transitions": [],
            "ffmpeg-xfade": [],
            "moviepy": [],
        }
        self._moods: List[str] = []
        self._genres: List[str] = []
        self._version: str = ""

        self._load_catalog()
        self._initialized = True

    def _load_catalog(self):
        """Load effects catalog from JSON file."""
        catalog_path = Path(__file__).parent.parent / "data" / "effects_catalog.json"

        if not catalog_path.exists():
            logger.error(f"Effects catalog not found: {catalog_path}")
            return

        try:
            with open(catalog_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self._version = data.get("version", "unknown")
            self._moods = data.get("moods", [])
            self._genres = data.get("genres", [])

            blacklisted_count = 0
            for effect_data in data.get("effects", []):
                effect = EffectMetadata(effect_data)

                # Skip blacklisted effects that cause visual corruption
                if effect.id in BLACKLISTED_EFFECTS:
                    blacklisted_count += 1
                    logger.debug(f"Skipping blacklisted effect: {effect.id}")
                    continue

                self._effects[effect.id] = effect

                if effect.type in self._by_type:
                    self._by_type[effect.type].append(effect)

                if effect.source in self._by_source:
                    self._by_source[effect.source].append(effect)

            logger.info(f"Loaded {len(self._effects)} effects from catalog v{self._version} (skipped {blacklisted_count} blacklisted)")

        except Exception as e:
            logger.error(f"Failed to load effects catalog: {e}")

    @property
    def version(self) -> str:
        return self._version

    @property
    def moods(self) -> List[str]:
        return self._moods.copy()

    @property
    def genres(self) -> List[str]:
        return self._genres.copy()

    def get(self, effect_id: str) -> Optional[EffectMetadata]:
        """Get effect by ID."""
        return self._effects.get(effect_id)

    def all(self) -> List[EffectMetadata]:
        """Get all effects."""
        return list(self._effects.values())

    def by_type(self, effect_type: EffectType) -> List[EffectMetadata]:
        """Get effects by type."""
        return self._by_type.get(effect_type, []).copy()

    def by_source(self, source: EffectSource) -> List[EffectMetadata]:
        """Get effects by source."""
        return self._by_source.get(source, []).copy()

    def filter(
        self,
        effect_type: Optional[EffectType] = None,
        source: Optional[EffectSource] = None,
        moods: Optional[List[str]] = None,
        genres: Optional[List[str]] = None,
        intensity: Optional[Intensity] = None,
        gpu_available: bool = True,
        min_duration: Optional[float] = None,
        max_duration: Optional[float] = None,
    ) -> List[EffectMetadata]:
        """
        Filter effects by multiple criteria.

        Args:
            effect_type: Filter by effect type
            source: Filter by source
            moods: Filter by matching moods
            genres: Filter by matching genres
            intensity: Filter by intensity level
            gpu_available: If False, exclude GPU-required effects
            min_duration: Minimum duration range
            max_duration: Maximum duration range

        Returns:
            List of matching effects
        """
        results = list(self._effects.values())

        if effect_type:
            results = [e for e in results if e.type == effect_type]

        if source:
            results = [e for e in results if e.source == source]

        if moods:
            results = [e for e in results if any(m in e.mood for m in moods)]

        if genres:
            results = [e for e in results if any(g in e.genre for g in genres)]

        if intensity:
            results = [e for e in results if e.intensity == intensity]

        if not gpu_available:
            results = [e for e in results if not e.gpu_required]

        if min_duration is not None:
            results = [e for e in results if e.duration_range[1] >= min_duration]

        if max_duration is not None:
            results = [e for e in results if e.duration_range[0] <= max_duration]

        return results

    def search(
        self,
        query: str,
        effect_type: Optional[EffectType] = None,
        limit: int = 20,
    ) -> List[EffectMetadata]:
        """
        Search effects by keyword.

        Args:
            query: Search query
            effect_type: Optional type filter
            limit: Maximum results

        Returns:
            List of matching effects sorted by relevance
        """
        query_lower = query.lower()
        results = []

        candidates = self._effects.values()
        if effect_type:
            candidates = self._by_type.get(effect_type, [])

        for effect in candidates:
            score = 0

            # Name match (highest weight)
            if query_lower in effect.name.lower():
                score += 3

            # Keyword match
            for kw in effect.keywords:
                if query_lower in kw.lower():
                    score += 2
                    break

            # Description match
            if query_lower in effect.description.lower():
                score += 1
            if query_lower in effect.description_ko:
                score += 1

            # Mood/Genre match
            if query_lower in [m.lower() for m in effect.mood]:
                score += 1
            if query_lower in [g.lower() for g in effect.genre]:
                score += 1

            if score > 0:
                results.append((score, effect))

        # Sort by score descending
        results.sort(key=lambda x: x[0], reverse=True)

        return [e for _, e in results[:limit]]

    def score_effects(
        self,
        effects: List[EffectMetadata],
        moods: List[str],
        genres: List[str],
        keywords: List[str],
        intensity: Optional[Intensity] = None,
    ) -> List[tuple[EffectMetadata, float]]:
        """
        Score effects based on match criteria.

        Args:
            effects: Effects to score
            moods: Target moods
            genres: Target genres
            keywords: Target keywords
            intensity: Preferred intensity

        Returns:
            List of (effect, score) tuples sorted by score descending
        """
        scored = []

        for effect in effects:
            score = 0.0

            # Mood match (weight: 0.3)
            score += effect.matches_mood(moods) * 0.3

            # Genre match (weight: 0.3)
            score += effect.matches_genre(genres) * 0.3

            # Keyword match (weight: 0.25)
            score += effect.matches_keywords(keywords) * 0.25

            # Intensity match (weight: 0.15)
            if intensity and effect.intensity == intensity:
                score += 0.15

            scored.append((effect, score))

        # Sort by score descending
        scored.sort(key=lambda x: x[1], reverse=True)

        return scored

    def get_compatible_effects(
        self,
        effect_id: str,
        effect_type: Optional[EffectType] = None,
    ) -> List[EffectMetadata]:
        """Get effects compatible with the given effect."""
        effect = self.get(effect_id)
        if not effect:
            return []

        compatible = []
        for compat_id in effect.compatible_with:
            compat_effect = self.get(compat_id)
            if compat_effect:
                if effect_type is None or compat_effect.type == effect_type:
                    compatible.append(compat_effect)

        return compatible

    def get_conflicting_effects(self, effect_id: str) -> List[EffectMetadata]:
        """Get effects that conflict with the given effect."""
        effect = self.get(effect_id)
        if not effect:
            return []

        conflicting = []
        for conflict_id in effect.conflicts_with:
            conflict_effect = self.get(conflict_id)
            if conflict_effect:
                conflicting.append(conflict_effect)

        return conflicting

    def stats(self) -> Dict[str, Any]:
        """Get registry statistics."""
        return {
            "version": self._version,
            "total_effects": len(self._effects),
            "by_type": {k: len(v) for k, v in self._by_type.items()},
            "by_source": {k: len(v) for k, v in self._by_source.items()},
            "moods": self._moods,
            "genres": self._genres,
        }


# Singleton accessor
def get_registry() -> EffectRegistry:
    """Get the effect registry instance."""
    return EffectRegistry()
