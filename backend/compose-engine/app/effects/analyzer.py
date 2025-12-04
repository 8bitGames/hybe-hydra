"""Prompt Analyzer - Analyzes prompts to extract mood, genre, and keywords using Gemini."""

import os
import json
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from functools import lru_cache

import google.generativeai as genai

from .registry import get_registry, Intensity

logger = logging.getLogger(__name__)


@dataclass
class PromptAnalysis:
    """Result of prompt analysis."""

    moods: List[str]
    genres: List[str]
    keywords: List[str]
    intensity: Intensity
    reasoning: str
    language: str  # detected language

    def to_dict(self) -> Dict[str, Any]:
        return {
            "moods": self.moods,
            "genres": self.genres,
            "keywords": self.keywords,
            "intensity": self.intensity,
            "reasoning": self.reasoning,
            "language": self.language,
        }


class PromptAnalyzer:
    """Analyzes user prompts to extract video characteristics for effect selection."""

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash-lite")

        # Get available moods and genres from registry
        registry = get_registry()
        self._available_moods = registry.moods
        self._available_genres = registry.genres

    def _build_system_prompt(self) -> str:
        """Build the system prompt for analysis."""
        return f"""You are a video production expert who analyzes user prompts to determine the best video style.

Your task is to analyze the given prompt and extract:
1. **Moods**: The emotional atmosphere of the video (choose from: {', '.join(self._available_moods)})
2. **Genres**: The video style category (choose from: {', '.join(self._available_genres)})
3. **Keywords**: Key descriptive words from the prompt that help identify the style
4. **Intensity**: How dynamic/energetic the video should be (low, medium, high)

Rules:
- Select 2-4 moods that best match the prompt
- Select 1-3 genres that best match the prompt
- Extract 5-10 keywords from the prompt that describe the desired style
- Determine intensity based on words like "빠른/fast", "신나는/energetic" = high, "차분한/calm", "부드러운/soft" = low
- Provide brief reasoning for your choices

Respond ONLY with valid JSON in this exact format:
{{
  "moods": ["mood1", "mood2"],
  "genres": ["genre1", "genre2"],
  "keywords": ["keyword1", "keyword2", ...],
  "intensity": "low|medium|high",
  "reasoning": "Brief explanation of why these were chosen",
  "language": "ko|en"
}}"""

    async def analyze(self, prompt: str, bpm: Optional[int] = None) -> PromptAnalysis:
        """
        Analyze a prompt to extract video characteristics.

        Args:
            prompt: User's video concept prompt
            bpm: Optional BPM of the audio for intensity adjustment

        Returns:
            PromptAnalysis with extracted characteristics
        """
        user_prompt = f"Analyze this video concept prompt:\n\n\"{prompt}\""

        if bpm:
            user_prompt += f"\n\nNote: The audio BPM is {bpm}."
            if bpm >= 140:
                user_prompt += " This is a fast tempo, suggesting high energy."
            elif bpm >= 100:
                user_prompt += " This is a moderate tempo."
            else:
                user_prompt += " This is a slow tempo, suggesting calm energy."

        try:
            response = await self.model.generate_content_async(
                [
                    {"role": "user", "parts": [self._build_system_prompt()]},
                    {"role": "model", "parts": ["I understand. I will analyze video prompts and respond with JSON."]},
                    {"role": "user", "parts": [user_prompt]},
                ],
                generation_config=genai.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=500,
                ),
            )

            # Parse JSON response
            text = response.text.strip()

            # Handle markdown code blocks
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            result = json.loads(text)

            # Validate and filter moods/genres to only include valid values
            valid_moods = [m for m in result.get("moods", []) if m in self._available_moods]
            valid_genres = [g for g in result.get("genres", []) if g in self._available_genres]

            # Ensure at least some defaults if AI returned invalid values
            if not valid_moods:
                valid_moods = ["modern"]
            if not valid_genres:
                valid_genres = ["tiktok"]

            intensity = result.get("intensity", "medium")
            if intensity not in ["low", "medium", "high"]:
                intensity = "medium"

            return PromptAnalysis(
                moods=valid_moods,
                genres=valid_genres,
                keywords=result.get("keywords", [])[:10],
                intensity=intensity,
                reasoning=result.get("reasoning", ""),
                language=result.get("language", "en"),
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            return self._fallback_analysis(prompt)

        except Exception as e:
            logger.error(f"Gemini analysis failed: {e}")
            return self._fallback_analysis(prompt)

    def analyze_sync(self, prompt: str, bpm: Optional[int] = None) -> PromptAnalysis:
        """
        Synchronous version of analyze.

        Args:
            prompt: User's video concept prompt
            bpm: Optional BPM of the audio

        Returns:
            PromptAnalysis with extracted characteristics
        """
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(self.analyze(prompt, bpm))

    def _fallback_analysis(self, prompt: str) -> PromptAnalysis:
        """
        Rule-based fallback when AI analysis fails.

        Uses keyword matching to determine characteristics.
        """
        prompt_lower = prompt.lower()

        # Mood detection
        moods = []
        mood_keywords = {
            "energetic": ["신나", "에너지", "활발", "energy", "dynamic", "active", "exciting"],
            "calm": ["차분", "평온", "조용", "calm", "peaceful", "relaxing", "gentle"],
            "dramatic": ["극적", "드라마", "dramatic", "intense", "powerful", "epic"],
            "playful": ["장난", "재미", "fun", "playful", "cheerful", "happy"],
            "elegant": ["우아", "세련", "elegant", "classy", "sophisticated"],
            "romantic": ["로맨틱", "감성", "romantic", "love", "emotional", "sentimental"],
            "dark": ["어두", "무거", "dark", "moody", "serious"],
            "bright": ["밝은", "경쾌", "bright", "light", "fresh"],
            "mysterious": ["신비", "몽환", "mysterious", "dreamy", "ethereal"],
            "modern": ["현대", "트렌디", "modern", "trendy", "contemporary"],
        }

        for mood, keywords in mood_keywords.items():
            if any(kw in prompt_lower for kw in keywords):
                moods.append(mood)

        if not moods:
            moods = ["modern"]

        # Genre detection
        genres = []
        genre_keywords = {
            "kpop": ["k-pop", "kpop", "케이팝", "아이돌", "댄스", "idol"],
            "hiphop": ["힙합", "랩", "hiphop", "hip-hop", "rap"],
            "emotional": ["감성", "발라드", "ballad", "emotional", "느낌"],
            "corporate": ["기업", "비즈니스", "corporate", "business", "professional"],
            "tiktok": ["틱톡", "tiktok", "숏폼", "short", "viral", "트렌드"],
            "cinematic": ["시네마", "영화", "cinematic", "movie", "film"],
            "vlog": ["브이로그", "일상", "vlog", "daily", "lifestyle"],
            "documentary": ["다큐", "documentary", "docu"],
            "edm": ["edm", "일렉트로", "electro", "electronic", "클럽"],
            "indie": ["인디", "indie", "acoustic", "어쿠스틱"],
        }

        for genre, keywords in genre_keywords.items():
            if any(kw in prompt_lower for kw in keywords):
                genres.append(genre)

        if not genres:
            genres = ["tiktok"]

        # Intensity detection
        intensity = "medium"
        high_keywords = ["빠른", "신나는", "강렬", "fast", "quick", "energetic", "intense", "powerful"]
        low_keywords = ["느린", "차분", "부드러운", "slow", "calm", "soft", "gentle", "peaceful"]

        if any(kw in prompt_lower for kw in high_keywords):
            intensity = "high"
        elif any(kw in prompt_lower for kw in low_keywords):
            intensity = "low"

        # Extract keywords from prompt
        # Simple word extraction (remove common words)
        common_words = {"the", "a", "an", "is", "are", "을", "를", "이", "가", "의", "에", "로", "으로", "한", "하는"}
        words = prompt.replace(",", " ").replace(".", " ").split()
        keywords = [w for w in words if len(w) > 1 and w.lower() not in common_words][:10]

        return PromptAnalysis(
            moods=moods[:4],
            genres=genres[:3],
            keywords=keywords,
            intensity=intensity,
            reasoning="Fallback analysis using keyword matching",
            language="ko" if any(ord(c) >= 0xAC00 and ord(c) <= 0xD7A3 for c in prompt) else "en",
        )


# Singleton accessor
_analyzer_instance: Optional[PromptAnalyzer] = None


def get_analyzer() -> PromptAnalyzer:
    """Get the prompt analyzer instance."""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = PromptAnalyzer()
    return _analyzer_instance
