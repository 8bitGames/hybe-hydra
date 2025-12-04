"""Effects API router - AI-powered effect selection."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

from ..effects.registry import get_registry, EffectType, EffectSource, Intensity
from ..effects.analyzer import get_analyzer, PromptAnalysis
from ..effects.selector import EffectSelector, SelectionConfig, SelectedEffects

logger = logging.getLogger(__name__)
router = APIRouter()


# Request/Response Models
class EffectSelectRequest(BaseModel):
    """Request for AI effect selection."""

    prompt: str = Field(..., description="Video concept prompt")
    audio_bpm: Optional[int] = Field(None, description="Audio BPM for intensity adjustment")
    image_count: int = Field(8, ge=1, le=20, description="Number of images in video")
    duration: float = Field(15.0, ge=5.0, le=120.0, description="Target video duration in seconds")
    preferences: Optional[Dict[str, Any]] = Field(None, description="Selection preferences")


class EffectSelectResponse(BaseModel):
    """Response with selected effects."""

    analysis: Dict[str, Any] = Field(..., description="Prompt analysis results")
    selected_effects: Dict[str, Any] = Field(..., description="Selected effects by category")
    effect_ids: Dict[str, List[str]] = Field(..., description="Just the effect IDs")


class EffectListResponse(BaseModel):
    """Response with list of effects."""

    effects: List[Dict[str, Any]]
    total: int


class RegistryStatsResponse(BaseModel):
    """Response with registry statistics."""

    version: str
    total_effects: int
    by_type: Dict[str, int]
    by_source: Dict[str, int]
    moods: List[str]
    genres: List[str]


@router.get("/stats", response_model=RegistryStatsResponse)
async def get_registry_stats():
    """Get effect registry statistics."""
    registry = get_registry()
    return RegistryStatsResponse(**registry.stats())


@router.get("/", response_model=EffectListResponse)
async def list_effects(
    type: Optional[EffectType] = Query(None, description="Filter by effect type"),
    source: Optional[EffectSource] = Query(None, description="Filter by source"),
    mood: Optional[str] = Query(None, description="Filter by mood"),
    genre: Optional[str] = Query(None, description="Filter by genre"),
    intensity: Optional[Intensity] = Query(None, description="Filter by intensity"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    List available effects with optional filtering.

    Query parameters:
    - type: transition, motion, filter, text
    - source: gl-transitions, ffmpeg-xfade, moviepy
    - mood: energetic, calm, dramatic, etc.
    - genre: kpop, hiphop, emotional, etc.
    - intensity: low, medium, high
    """
    registry = get_registry()

    # Apply filters
    moods = [mood] if mood else None
    genres = [genre] if genre else None

    effects = registry.filter(
        effect_type=type,
        source=source,
        moods=moods,
        genres=genres,
        intensity=intensity,
    )

    # Paginate
    total = len(effects)
    effects = effects[offset : offset + limit]

    return EffectListResponse(
        effects=[e.to_dict() for e in effects],
        total=total,
    )


@router.get("/search", response_model=EffectListResponse)
async def search_effects(
    q: str = Query(..., min_length=1, description="Search query"),
    type: Optional[EffectType] = Query(None, description="Filter by effect type"),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Search effects by keyword.

    Searches effect names, keywords, and descriptions.
    """
    registry = get_registry()
    effects = registry.search(query=q, effect_type=type, limit=limit)

    return EffectListResponse(
        effects=[e.to_dict() for e in effects],
        total=len(effects),
    )


@router.get("/{effect_id}")
async def get_effect(effect_id: str):
    """Get a specific effect by ID."""
    registry = get_registry()
    effect = registry.get(effect_id)

    if not effect:
        raise HTTPException(status_code=404, detail=f"Effect not found: {effect_id}")

    return effect.to_dict()


@router.post("/select", response_model=EffectSelectResponse)
async def select_effects(request: EffectSelectRequest):
    """
    AI-powered effect selection.

    Analyzes the prompt and selects appropriate effects for the video.
    """
    try:
        # Analyze prompt
        analyzer = get_analyzer()
        analysis = await analyzer.analyze(request.prompt, request.audio_bpm)

        # Build selection config from preferences
        config = SelectionConfig()

        if request.preferences:
            prefs = request.preferences

            if "intensity" in prefs:
                # Override detected intensity
                if prefs["intensity"] in ["low", "medium", "high"]:
                    analysis = PromptAnalysis(
                        moods=analysis.moods,
                        genres=analysis.genres,
                        keywords=analysis.keywords,
                        intensity=prefs["intensity"],
                        reasoning=analysis.reasoning,
                        language=analysis.language,
                    )

            if "sources" in prefs:
                config.preferred_sources = prefs["sources"]

            if "exclude_sources" in prefs:
                config.exclude_sources = prefs["exclude_sources"]

            if "gpu_available" in prefs:
                config.gpu_available = prefs["gpu_available"]

            if "num_transitions" in prefs:
                config.num_transitions = min(prefs["num_transitions"], 10)

            if "diversity" in prefs:
                config.diversity_weight = min(max(prefs["diversity"], 0.0), 1.0)

        # Adjust transition count based on image count
        # More images = more transitions needed
        config.num_transitions = min(request.image_count - 1, config.num_transitions)

        # Select effects
        selector = EffectSelector()
        selected = selector.select(analysis, config)

        return EffectSelectResponse(
            analysis=analysis.to_dict(),
            selected_effects=selected.to_dict(),
            effect_ids=selected.to_ids(),
        )

    except Exception as e:
        logger.error(f"Effect selection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/select/clip")
async def select_clip_effects(
    clip_index: int = Query(..., ge=0, description="Clip index (0-based)"),
    total_clips: int = Query(..., ge=1, description="Total number of clips"),
    prompt: str = Query(..., description="Video concept prompt"),
):
    """
    Select effects for a specific clip.

    Useful for progressive rendering where effects are selected per-clip.
    """
    try:
        # Analyze prompt
        analyzer = get_analyzer()
        analysis = await analyzer.analyze(prompt)

        # Select full effect pool
        selector = EffectSelector()
        config = SelectionConfig(num_transitions=total_clips - 1)
        selected = selector.select(analysis, config)

        # Get clip-specific effects
        clip_effects = selector.select_for_clip(
            clip_index=clip_index,
            total_clips=total_clips,
            analysis=analysis,
            selected_effects=selected,
        )

        return {
            "clip_index": clip_index,
            "effects": clip_effects,
        }

    except Exception as e:
        logger.error(f"Clip effect selection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{effect_id}/compatible")
async def get_compatible_effects(
    effect_id: str,
    type: Optional[EffectType] = Query(None, description="Filter by effect type"),
):
    """Get effects compatible with the specified effect."""
    registry = get_registry()

    effect = registry.get(effect_id)
    if not effect:
        raise HTTPException(status_code=404, detail=f"Effect not found: {effect_id}")

    compatible = registry.get_compatible_effects(effect_id, type)

    return {
        "effect_id": effect_id,
        "compatible_effects": [e.to_dict() for e in compatible],
    }
