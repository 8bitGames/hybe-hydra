"""
Gemini 2.5 Flash AI Conductor for video composition.

This module uses Gemini to analyze images, lyrics, and audio context
to generate intelligent composition decisions.
"""

import os
import json
import base64
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path

from .schemas import (
    CompositionPlan,
    SegmentPlan,
    TransitionPlan,
    CaptionPlan,
    EffectsPlan,
    AudioPlan,
    ConductorInput,
    ImageContext,
    LyricsContext,
    AudioContext,
    AVAILABLE_TRANSITIONS,
    AVAILABLE_MOTIONS,
    AVAILABLE_TEXT_ANIMATIONS,
    AVAILABLE_COLOR_GRADES,
    AVAILABLE_EFFECTS,
)

logger = logging.getLogger(__name__)


class GeminiConductor:
    """
    AI Conductor using Gemini 2.5 Flash.

    Analyzes images, lyrics, and audio to compose a complete video plan.
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Gemini Conductor."""
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not provided")

        # Import Google GenAI
        try:
            from google import genai
            self.genai = genai
            self.client = genai.Client(api_key=self.api_key)
        except ImportError:
            raise ImportError("google-genai package not installed. Run: pip install google-genai")

        self.model = "gemini-2.5-flash-preview-05-20"

    async def analyze_images(
        self,
        image_paths: List[str],
    ) -> List[ImageContext]:
        """
        Analyze images using Gemini vision to extract context.

        Returns descriptions, mood, colors for each image.
        """
        contexts = []

        for i, path in enumerate(image_paths):
            try:
                context = await self._analyze_single_image(i, path)
                contexts.append(context)
            except Exception as e:
                logger.warning(f"Failed to analyze image {i}: {e}")
                # Fallback context
                contexts.append(ImageContext(
                    index=i,
                    description=f"Image {i+1}",
                    mood="neutral",
                ))

        return contexts

    async def _analyze_single_image(self, index: int, path: str) -> ImageContext:
        """Analyze a single image with Gemini."""
        # Read and encode image
        with open(path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        # Determine mime type
        ext = Path(path).suffix.lower()
        mime_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }
        mime_type = mime_types.get(ext, "image/jpeg")

        prompt = """Analyze this image for video composition. Respond in JSON format:
{
    "description": "Brief description of what's in the image (1 sentence)",
    "mood": "One of: energetic, calm, emotional, dramatic, happy, sad, mysterious, romantic, powerful",
    "dominant_colors": ["color1", "color2"],
    "has_person": true/false,
    "has_text": true/false,
    "brightness": 0.0-1.0 (0=dark, 1=bright),
    "complexity": 0.0-1.0 (0=simple/minimal, 1=complex/busy),
    "suggested_motion": "One of: zoom_in, zoom_out, pan_left, pan_right, static"
}"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    {
                        "role": "user",
                        "parts": [
                            {"text": prompt},
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": image_data,
                                }
                            },
                        ],
                    }
                ],
            )

            # Parse JSON response
            text = response.text
            # Extract JSON from potential markdown code block
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            data = json.loads(text.strip())

            return ImageContext(
                index=index,
                description=data.get("description", ""),
                dominant_colors=data.get("dominant_colors", []),
                mood=data.get("mood", "neutral"),
                has_person=data.get("has_person", False),
                has_text=data.get("has_text", False),
                brightness=data.get("brightness", 0.5),
                complexity=data.get("complexity", 0.5),
            )

        except Exception as e:
            logger.warning(f"Image analysis failed: {e}")
            return ImageContext(index=index, description="Image", mood="neutral")

    async def analyze_lyrics(self, lyrics: List[str]) -> LyricsContext:
        """Analyze lyrics/script for emotional content and themes."""
        if not lyrics:
            return LyricsContext()

        prompt = f"""Analyze these lyrics/captions for video composition. Respond in JSON:
{{
    "mood": "Overall emotional mood",
    "themes": ["theme1", "theme2"],
    "emotional_arc": "Description of emotional progression",
    "language": "detected language code (en, ko, etc.)",
    "key_moments": [
        {{"line_index": 0, "emotion": "emotion", "intensity": 0.0-1.0}}
    ]
}}

Lyrics:
{chr(10).join(f'{i+1}. "{line}"' for i, line in enumerate(lyrics))}"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
            )

            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            data = json.loads(text.strip())

            return LyricsContext(
                lines=lyrics,
                language=data.get("language", "en"),
                mood=data.get("mood", ""),
                themes=data.get("themes", []),
                emotional_arc=data.get("emotional_arc", ""),
            )

        except Exception as e:
            logger.warning(f"Lyrics analysis failed: {e}")
            return LyricsContext(lines=lyrics)

    async def compose(
        self,
        context: ConductorInput,
    ) -> CompositionPlan:
        """
        Main composition method.

        Takes all context and generates a complete composition plan.
        """
        # Build the composition prompt
        prompt = self._build_composition_prompt(context)

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config={
                    "temperature": 0.7,  # Some creativity
                    "top_p": 0.9,
                },
            )

            # Parse the response
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            data = json.loads(text.strip())
            plan = CompositionPlan.from_dict(data)

            # Validate and fix any issues
            errors = plan.validate()
            if errors:
                logger.warning(f"Composition plan has {len(errors)} validation errors: {errors[:3]}")
                plan = self._fix_plan_errors(plan, errors)

            return plan

        except Exception as e:
            logger.error(f"Composition failed: {e}")
            # Return a fallback plan
            return self._create_fallback_plan(context)

    def _build_composition_prompt(self, context: ConductorInput) -> str:
        """Build the composition prompt for Gemini."""
        # List available options
        transitions_list = ", ".join(AVAILABLE_TRANSITIONS[:20]) + "..."
        motions_list = ", ".join(AVAILABLE_MOTIONS)
        animations_list = ", ".join(AVAILABLE_TEXT_ANIMATIONS)
        grades_list = ", ".join(AVAILABLE_COLOR_GRADES)

        prompt = f"""You are an expert video editor and composer. Create a composition plan for a slideshow video.

# CONTEXT
{context.to_prompt_context()}

# AVAILABLE OPTIONS

## Transitions (choose from these exactly):
{transitions_list}
Full list: {AVAILABLE_TRANSITIONS}

## Motion Effects:
{motions_list}

## Text Animations:
{animations_list}

## Color Grades:
{grades_list}

# TASK
Create a cohesive, emotionally engaging video composition. Consider:
1. Match transitions to the energy/mood of content
2. Use motion that complements image content
3. Time captions to feel natural with the music
4. Choose color grading that enhances the mood
5. Create visual rhythm that matches the audio BPM

# OUTPUT FORMAT
Respond with a JSON object matching this exact structure:
{{
    "title": "Creative title for the video",
    "mood": "Overall mood description",
    "energy_level": "low|medium|high|dynamic",
    "style_description": "Brief style description",
    "total_duration": {context.target_duration},
    "fps": 30,
    "segments": [
        {{
            "image_index": 0,
            "duration": 3.0,
            "motion": "zoom_in",
            "motion_intensity": 0.5,
            "effects": ["none"],
            "reasoning": "Why this choice"
        }}
    ],
    "transitions": [
        {{
            "from_segment": 0,
            "to_segment": 1,
            "transition": "xfade_fade",
            "duration": 0.5,
            "sync_to_beat": true,
            "reasoning": "Why this transition"
        }}
    ],
    "captions": [
        {{
            "text": "Caption text",
            "segment_index": 0,
            "position_in_segment": 0.3,
            "duration": 2.0,
            "animation": "fade",
            "style": "bold",
            "sync_to_beat": true,
            "reasoning": "Why here"
        }}
    ],
    "effects": {{
        "color_grade": "natural",
        "color_intensity": 1.0,
        "vignette": false,
        "vignette_intensity": 0.3,
        "film_grain": false,
        "film_grain_intensity": 0.03,
        "beat_flash": false,
        "beat_flash_intensity": 0.1,
        "reasoning": "Why these effects"
    }},
    "audio": {{
        "start_time": 0.0,
        "fade_in": 1.0,
        "fade_out": 2.0,
        "hook_strategy": "calm_start",
        "duck_during_captions": false,
        "reasoning": "Audio treatment reasoning"
    }},
    "overall_reasoning": "Explanation of overall creative vision",
    "creative_notes": "Any additional creative notes"
}}

IMPORTANT:
- Create exactly {len(context.images)} segments (one per image)
- Create exactly {len(context.images) - 1} transitions
- Only use transitions from the AVAILABLE list
- Segment durations should sum to approximately {context.target_duration}s
- Be creative but coherent with the mood"""

        return prompt

    def _fix_plan_errors(self, plan: CompositionPlan, errors: List[str]) -> CompositionPlan:
        """Attempt to fix validation errors in the plan."""
        # Fix invalid transitions
        for trans in plan.transitions:
            if trans.transition not in AVAILABLE_TRANSITIONS:
                trans.transition = "xfade_fade"  # Safe fallback
            if trans.duration < 0.1:
                trans.duration = 0.3
            if trans.duration > 2.0:
                trans.duration = 1.0

        # Fix invalid motions
        for seg in plan.segments:
            if seg.motion not in AVAILABLE_MOTIONS:
                seg.motion = "zoom_in"  # Safe fallback
            seg.effects = [e for e in seg.effects if e in AVAILABLE_EFFECTS]
            if not seg.effects:
                seg.effects = ["none"]

        # Fix invalid captions
        for cap in plan.captions:
            if cap.animation not in AVAILABLE_TEXT_ANIMATIONS:
                cap.animation = "fade"

        # Fix color grade
        if plan.effects.color_grade not in AVAILABLE_COLOR_GRADES:
            plan.effects.color_grade = "natural"

        return plan

    def _create_fallback_plan(self, context: ConductorInput) -> CompositionPlan:
        """Create a simple fallback plan when AI fails."""
        num_images = len(context.images)
        duration_per_image = context.target_duration / num_images

        segments = []
        for i in range(num_images):
            segments.append(SegmentPlan(
                image_index=i,
                duration=duration_per_image,
                motion="zoom_in" if i % 2 == 0 else "zoom_out",
                motion_intensity=0.5,
                effects=["none"],
                reasoning="Fallback plan",
            ))

        transitions = []
        for i in range(num_images - 1):
            transitions.append(TransitionPlan(
                from_segment=i,
                to_segment=i + 1,
                transition="xfade_fade",
                duration=0.5,
                sync_to_beat=True,
                reasoning="Fallback transition",
            ))

        captions = []
        if context.lyrics and context.lyrics.lines:
            for i, line in enumerate(context.lyrics.lines):
                seg_idx = min(i, num_images - 1)
                captions.append(CaptionPlan(
                    text=line,
                    segment_index=seg_idx,
                    position_in_segment=0.3,
                    duration=min(2.0, duration_per_image - 0.5),
                    animation="fade",
                    style="bold",
                    reasoning="Fallback caption",
                ))

        return CompositionPlan(
            title="Slideshow Video",
            mood="neutral",
            energy_level="medium",
            total_duration=context.target_duration,
            segments=segments,
            transitions=transitions,
            captions=captions,
            effects=EffectsPlan(color_grade="natural", reasoning="Fallback"),
            audio=AudioPlan(reasoning="Fallback"),
            overall_reasoning="Fallback plan due to AI composition failure",
        )


class GeminiConductorAsync:
    """
    Async version of GeminiConductor for better performance.
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize async conductor."""
        self.sync_conductor = GeminiConductor(api_key)

    async def compose_video(
        self,
        image_paths: List[str],
        audio_context: Optional[AudioContext] = None,
        lyrics: Optional[List[str]] = None,
        target_duration: float = 15.0,
        style_hint: str = "",
        aspect_ratio: str = "9:16",
    ) -> CompositionPlan:
        """
        High-level method to compose a complete video.

        1. Analyzes all images
        2. Analyzes lyrics if provided
        3. Generates composition plan
        """
        # Analyze images
        logger.info(f"Analyzing {len(image_paths)} images...")
        image_contexts = await self.sync_conductor.analyze_images(image_paths)

        # Analyze lyrics
        lyrics_context = None
        if lyrics:
            logger.info(f"Analyzing {len(lyrics)} lyrics lines...")
            lyrics_context = await self.sync_conductor.analyze_lyrics(lyrics)

        # Build input context
        context = ConductorInput(
            images=image_contexts,
            lyrics=lyrics_context,
            audio=audio_context,
            target_duration=target_duration,
            aspect_ratio=aspect_ratio,
            style_hint=style_hint,
        )

        # Generate composition
        logger.info("Generating composition plan...")
        plan = await self.sync_conductor.compose(context)

        logger.info(f"Composition complete: {len(plan.segments)} segments, "
                   f"{len(plan.transitions)} transitions, {len(plan.captions)} captions")

        return plan
