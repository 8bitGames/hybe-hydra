"""
Keyword Transformer - Transforms search keywords based on video style using Gemini 2.5 Flash.

Adapts original search keywords to match the target video style (vibe, color_grade, effect)
while preserving the core subject matter.
"""

import os
import json
import re
import logging
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)


class KeywordTransformer:
    """
    Transforms search keywords using Gemini 2.5 Flash.

    Adapts keywords to match target video style while keeping the same subject.
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Keyword Transformer."""
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

        self.model = "gemini-2.5-flash"

    async def transform(
        self,
        original_tags: List[str],
        vibe: str,
        color_grade: str,
        effect_preset: str,
    ) -> List[str]:
        """
        Transform original keywords to match the target video style.

        Args:
            original_tags: Original search keywords (2-3 tags, each 3-4 words)
            vibe: Target vibe (Exciting, Emotional, Pop, Minimal)
            color_grade: Target color grade (vibrant, cinematic, bright, natural, moody)
            effect_preset: Target effect (zoom_beat, crossfade, bounce, minimal)

        Returns:
            List of transformed keywords matching the target style
        """
        try:
            return await self._transform_with_llm(
                original_tags, vibe, color_grade, effect_preset
            )
        except Exception as e:
            logger.warning(f"Keyword transformation failed: {e}, using fallback")
            # Use rule-based fallback instead of original tags
            return self._fallback_transform(original_tags, vibe, color_grade)

    def _clean_json_response(self, text: str) -> str:
        """Clean LLM response for JSON parsing."""
        # Step 1: Remove markdown code fences
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        text = text.strip()

        # Step 2: Replace smart/curly quotes with straight quotes
        # Various Unicode quote characters
        smart_quotes = {
            '\u201c': '"',  # " left double quotation mark
            '\u201d': '"',  # " right double quotation mark
            '\u201e': '"',  # „ double low-9 quotation mark
            '\u201f': '"',  # ‟ double high-reversed-9 quotation mark
            '\u2018': "'",  # ' left single quotation mark
            '\u2019': "'",  # ' right single quotation mark
            '\u201a': "'",  # ‚ single low-9 quotation mark
            '\u201b': "'",  # ‛ single high-reversed-9 quotation mark
            '\uff02': '"',  # ＂ fullwidth quotation mark
            '\u300c': '"',  # 「 left corner bracket
            '\u300d': '"',  # 」 right corner bracket
            '\u300e': '"',  # 『 left white corner bracket
            '\u300f': '"',  # 』 right white corner bracket
        }
        for smart, straight in smart_quotes.items():
            text = text.replace(smart, straight)

        # Step 3: Find JSON object
        start_idx = text.find('{')
        if start_idx == -1:
            return text

        # Find matching closing brace
        brace_count = 0
        end_idx = len(text) - 1  # Default to end if no match found
        for i, char in enumerate(text[start_idx:], start_idx):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i
                    break

        json_str = text[start_idx:end_idx + 1]

        # Step 4: Fix common JSON issues
        # Replace single quotes with double quotes for keys and values
        # Pattern: 'key': -> "key":
        json_str = re.sub(r"'([^']+)'(\s*:)", r'"\1"\2', json_str)
        # Pattern: : 'value' -> : "value"
        json_str = re.sub(r":\s*'([^']*)'", r': "\1"', json_str)
        # Pattern: ['item1', 'item2'] -> ["item1", "item2"]
        json_str = re.sub(r"\[\s*'", '["', json_str)
        json_str = re.sub(r"'\s*\]", '"]', json_str)
        json_str = re.sub(r"'\s*,\s*'", '", "', json_str)

        # Remove trailing commas before ] or }
        json_str = re.sub(r',\s*]', ']', json_str)
        json_str = re.sub(r',\s*}', '}', json_str)

        return json_str

    def _extract_tags_regex(self, text: str) -> List[str]:
        """Try to extract tags using regex when JSON parsing fails."""
        # Try to find array of strings pattern
        # Match patterns like: ["tag1", "tag2"] or ['tag1', 'tag2']
        array_match = re.search(r'\[([^\]]+)\]', text)
        if array_match:
            array_content = array_match.group(1)
            # Extract quoted strings
            tags = re.findall(r'["\']([^"\']+)["\']', array_content)
            if tags:
                logger.info(f"[KeywordTransformer] Regex extracted tags: {tags}")
                return tags
        return []

    async def _transform_with_llm(
        self,
        original_tags: List[str],
        vibe: str,
        color_grade: str,
        effect_preset: str,
    ) -> List[str]:
        """Transform keywords using Gemini LLM."""

        prompt = self._build_prompt(original_tags, vibe, color_grade, effect_preset)

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "temperature": 0.7,
                "max_output_tokens": 512,
            }
        )

        # Parse JSON response
        result_text = response.text.strip()
        logger.info(f"[KeywordTransformer] Raw response (first 100 chars): {repr(result_text[:100])}")

        # Clean and extract JSON
        cleaned_json = self._clean_json_response(result_text)
        logger.info(f"[KeywordTransformer] Cleaned JSON (first 100 chars): {repr(cleaned_json[:100])}")

        try:
            result = json.loads(cleaned_json)
            transformed = result.get("transformed_tags", [])

            if not transformed or len(transformed) == 0:
                logger.warning("[KeywordTransformer] Empty transformed_tags, trying regex extraction")
                transformed = self._extract_tags_regex(result_text)

            if not transformed or len(transformed) == 0:
                logger.warning("[KeywordTransformer] No tags found, using fallback")
                return self._fallback_transform(original_tags, vibe, color_grade)

            logger.info(f"[KeywordTransformer] {original_tags} -> {transformed} (vibe={vibe}, color={color_grade})")
            return transformed

        except json.JSONDecodeError as e:
            logger.warning(f"[KeywordTransformer] JSON parse error: {e}")
            logger.warning(f"[KeywordTransformer] Failed JSON: {repr(cleaned_json[:200])}")

            # Try regex extraction before fallback
            regex_tags = self._extract_tags_regex(result_text)
            if regex_tags and len(regex_tags) >= len(original_tags):
                logger.info(f"[KeywordTransformer] Using regex extracted: {regex_tags}")
                return regex_tags

            # Use fallback instead of original tags
            return self._fallback_transform(original_tags, vibe, color_grade)

    def _build_prompt(
        self,
        original_tags: List[str],
        vibe: str,
        color_grade: str,
        effect_preset: str,
    ) -> str:
        """Build the transformation prompt."""

        tags_str = ", ".join(original_tags)

        return f"""Transform these image search keywords to match the video style.

Original keywords: {tags_str}
Target style: {vibe} vibe, {color_grade} color grade

Create {len(original_tags)} NEW and DIFFERENT search keywords in Korean.
- Keep the same subject matter (what the image is about)
- Change the mood/atmosphere to match the target style
- Each keyword should be 3-4 words
- Keywords should be good for image search

Style interpretation:
- Exciting: dynamic, energetic, fast, powerful
- Emotional: dramatic, dreamy, lyrical, touching
- Pop: trendy, stylish, colorful, hip
- Minimal: minimal, simple, clean, static

IMPORTANT: Return ONLY valid JSON with double quotes, no explanation:
{{"transformed_tags": ["keyword1", "keyword2", "keyword3"]}}"""

    def transform_sync(
        self,
        original_tags: List[str],
        vibe: str,
        color_grade: str,
        effect_preset: str,
    ) -> List[str]:
        """
        Synchronous version of transform (for non-async contexts).
        Uses fallback rule-based transformation.
        """
        return self._fallback_transform(original_tags, vibe, color_grade)

    def _fallback_transform(
        self,
        original_tags: List[str],
        vibe: str,
        color_grade: str,
    ) -> List[str]:
        """
        Rule-based fallback transformation when LLM is unavailable.
        Ensures different vibes get DISTINCTIVELY different keywords.
        """
        import random
        import hashlib

        # Style-specific keyword transformations - each vibe gets unique search terms
        vibe_keyword_map = {
            "Exciting": {
                "prefixes": ["action", "dynamic", "energetic", "fast motion", "powerful"],
                "suffixes": ["in motion", "action shot", "speed", "extreme", "adrenaline"],
                "alternatives": ["adventure", "sports", "racing", "extreme sports", "parkour"],
            },
            "Emotional": {
                "prefixes": ["dreamy", "dramatic", "soft", "romantic", "sentimental"],
                "suffixes": ["aesthetic", "emotion", "feeling", "moment", "tears"],
                "alternatives": ["sunset", "silhouette", "nostalgia", "memory", "intimate"],
            },
            "Pop": {
                "prefixes": ["trendy", "stylish", "colorful", "modern", "hip"],
                "suffixes": ["aesthetic", "vibe", "mood", "style", "fashion"],
                "alternatives": ["neon", "urban", "street style", "influencer", "instagram"],
            },
            "Minimal": {
                "prefixes": ["minimal", "simple", "clean", "zen", "calm"],
                "suffixes": ["minimalist", "white space", "serene", "peaceful", "quiet"],
                "alternatives": ["empty space", "solitude", "stillness", "meditation", "abstract"],
            },
        }

        color_keyword_map = {
            "vibrant": ["vivid colors", "saturated", "bold colors", "bright palette", "colorful"],
            "cinematic": ["cinematic", "film look", "movie scene", "dramatic lighting", "epic"],
            "bright": ["bright", "sunny", "cheerful", "daylight", "fresh"],
            "natural": ["natural light", "organic", "warm tones", "golden hour", "earthy"],
            "moody": ["moody", "dark", "shadow", "mysterious", "atmospheric"],
        }

        # Use vibe+color_grade as seed for consistent but different results per style
        seed_str = f"{vibe}_{color_grade}"
        seed_hash = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
        rng = random.Random(seed_hash)

        vibe_data = vibe_keyword_map.get(vibe, vibe_keyword_map["Pop"])
        color_mods = color_keyword_map.get(color_grade, color_keyword_map["natural"])

        # Transform each tag with style-specific modifications
        transformed = []
        for i, tag in enumerate(original_tags):
            transform_type = (i + seed_hash) % 4

            if transform_type == 0:
                # Prefix style: "dynamic horseback"
                prefix = rng.choice(vibe_data["prefixes"])
                new_tag = f"{prefix} {tag}"
            elif transform_type == 1:
                # Suffix style: "horseback action shot"
                suffix = rng.choice(vibe_data["suffixes"])
                new_tag = f"{tag} {suffix}"
            elif transform_type == 2:
                # Color style: "cinematic horseback"
                color_mod = rng.choice(color_mods)
                new_tag = f"{color_mod} {tag}"
            else:
                # Alternative + original: "adventure horseback"
                alt = rng.choice(vibe_data["alternatives"])
                new_tag = f"{alt} {tag}"

            transformed.append(new_tag)

        logger.info(f"[KeywordTransformer] Fallback: {original_tags} -> {transformed} (vibe={vibe}, color={color_grade})")
        return transformed


# Singleton instance
_transformer_instance: Optional[KeywordTransformer] = None


def get_keyword_transformer() -> KeywordTransformer:
    """Get or create the singleton KeywordTransformer instance."""
    global _transformer_instance
    if _transformer_instance is None:
        _transformer_instance = KeywordTransformer()
    return _transformer_instance
