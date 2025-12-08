"""
Agent Prompt Loader
====================
Loads agent prompts from Supabase database for Python backend

Usage:
    from app.services.prompt_loader import PromptLoader

    loader = PromptLoader()
    prompt = await loader.get_prompt('compose-conductor')
    system_prompt = prompt['system_prompt']
    templates = prompt['templates']
"""

import os
import json
from typing import Dict, Any, Optional
from functools import lru_cache
import httpx
import asyncio
from datetime import datetime, timedelta

# Supabase configuration
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

# Cache settings
CACHE_TTL_SECONDS = 300  # 5 minutes


class PromptCache:
    """Simple in-memory cache with TTL"""

    def __init__(self, ttl_seconds: int = CACHE_TTL_SECONDS):
        self._cache: Dict[str, tuple[Any, datetime]] = {}
        self._ttl = timedelta(seconds=ttl_seconds)

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, timestamp = self._cache[key]
            if datetime.now() - timestamp < self._ttl:
                return value
            else:
                del self._cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        self._cache[key] = (value, datetime.now())

    def clear(self) -> None:
        self._cache.clear()


class PromptLoader:
    """
    Loads agent prompts from Supabase database

    Supports:
    - Async loading with caching
    - Fallback to hardcoded prompts if database unavailable
    - Template rendering with variables
    """

    _instance: Optional['PromptLoader'] = None
    _cache = PromptCache()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        self.supabase_url = SUPABASE_URL
        self.supabase_key = SUPABASE_SERVICE_KEY
        self._fallback_prompts = self._load_fallback_prompts()

    def _load_fallback_prompts(self) -> Dict[str, Dict[str, Any]]:
        """Fallback prompts if database is unavailable"""
        return {
            'compose-conductor': {
                'system_prompt': '''You are an expert video editor and composer specializing in music video slideshows.
Your task is to create a detailed composition plan that synchronizes images, effects, and captions with the music.

Key principles:
1. VISUAL STORYTELLING: Create emotional progression through image sequencing
2. MUSIC SYNC: Align transitions and effects with beats and musical moments
3. PACING: Vary segment durations based on energy and content
4. EMPHASIS: Use effects and motion to highlight key lyrics/moments
5. COHESION: Maintain visual consistency while providing variety''',
                'templates': {
                    'composition': '''Create a composition plan for this music video slideshow.

Context:
- Artist: {artist_name}
- Song: {song_title}
- Duration: {duration} seconds
- BPM: {bpm}
- Mood: {mood}
- Genre: {genre}

Images: {image_count} total
Captions: {captions}

Available Options:
- Transitions: {available_transitions}
- Effects: {available_effects}
- Motions: {available_motions}

Requirements:
1. Use ALL images at least once
2. Total segment durations must equal {duration} seconds
3. Only use available options
4. Sync key moments with lyrics
5. Vary pacing appropriately'''
                },
                'model_name': 'gemini-2.5-flash',
                'model_options': {'temperature': 0.4, 'max_tokens': 8192}
            },
            'compose-effect-analyzer': {
                'system_prompt': '''You are an expert video effects analyst specializing in mood, genre, and visual style detection.
Your task is to analyze prompts and extract relevant effects, moods, and genres for video composition.

Key analysis areas:
1. MOOD: Emotional tone (energetic, calm, dramatic, playful, etc.)
2. GENRE: Music/content genre (pop, hip-hop, ballad, EDM, etc.)
3. INTENSITY: Energy level from 0.0 (very calm) to 1.0 (very intense)
4. EFFECTS: Suggested visual effects based on mood and content
5. TRANSITIONS: Recommended transition styles''',
                'templates': {
                    'main': '''Analyze this prompt and extract mood, genre, and effects:

Prompt: {prompt}
Language: {language}

Provide analysis in JSON format.'''
                },
                'model_name': 'gemini-2.5-flash',
                'model_options': {'temperature': 0.3, 'max_tokens': 1024}
            },
            'compose-script-generator': {
                'system_prompt': '''You are an expert TikTok content strategist and script writer.
Your task is to create engaging, viral-worthy scripts that hook viewers in the first second.''',
                'templates': {
                    'main': '''Create a TikTok script for {artist_name} content.

Topic: {topic}
Language: {language}
Duration: {target_duration} seconds'''
                },
                'model_name': 'gemini-2.5-flash',
                'model_options': {'temperature': 0.7, 'max_tokens': 4096}
            }
        }

    async def get_prompt(self, agent_id: str) -> Dict[str, Any]:
        """
        Get prompt configuration for an agent

        Args:
            agent_id: The agent identifier (e.g., 'compose-conductor')

        Returns:
            Dict containing system_prompt, templates, model_name, model_options
        """
        # Check cache first
        cached = self._cache.get(agent_id)
        if cached:
            return cached

        # Try loading from database
        try:
            prompt_data = await self._load_from_database(agent_id)
            if prompt_data:
                self._cache.set(agent_id, prompt_data)
                return prompt_data
        except Exception as e:
            print(f"[PromptLoader] Database load failed for {agent_id}: {e}")

        # Fallback to hardcoded prompts
        if agent_id in self._fallback_prompts:
            return self._fallback_prompts[agent_id]

        raise ValueError(f"Unknown agent: {agent_id}")

    async def _load_from_database(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Load prompt from Supabase database"""
        if not self.supabase_url or not self.supabase_key:
            return None

        url = f"{self.supabase_url}/rest/v1/agent_prompts"
        params = {
            'agent_id': f'eq.{agent_id}',
            'is_active': 'eq.true',
            'select': 'system_prompt,templates,model_name,model_options'
        }
        headers = {
            'apikey': self.supabase_key,
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json'
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()

            data = response.json()
            if data and len(data) > 0:
                row = data[0]
                return {
                    'system_prompt': row.get('system_prompt', ''),
                    'templates': row.get('templates', {}),
                    'model_name': row.get('model_name', 'gemini-2.5-flash'),
                    'model_options': row.get('model_options', {})
                }

        return None

    def get_prompt_sync(self, agent_id: str) -> Dict[str, Any]:
        """Synchronous version of get_prompt"""
        # Check cache first
        cached = self._cache.get(agent_id)
        if cached:
            return cached

        # Try loading from database synchronously
        try:
            prompt_data = asyncio.get_event_loop().run_until_complete(
                self._load_from_database(agent_id)
            )
            if prompt_data:
                self._cache.set(agent_id, prompt_data)
                return prompt_data
        except Exception as e:
            print(f"[PromptLoader] Sync load failed for {agent_id}: {e}")

        # Fallback
        if agent_id in self._fallback_prompts:
            return self._fallback_prompts[agent_id]

        raise ValueError(f"Unknown agent: {agent_id}")

    def render_template(
        self,
        template: str,
        variables: Dict[str, Any]
    ) -> str:
        """
        Render a template with variables

        Args:
            template: Template string with {variable} placeholders
            variables: Dict of variable values

        Returns:
            Rendered template string
        """
        result = template
        for key, value in variables.items():
            placeholder = '{' + key + '}'
            if isinstance(value, (list, dict)):
                value = json.dumps(value)
            result = result.replace(placeholder, str(value))
        return result

    def clear_cache(self) -> None:
        """Clear the prompt cache"""
        self._cache.clear()

    async def preload_prompts(self, agent_ids: list[str]) -> None:
        """Preload multiple prompts into cache"""
        for agent_id in agent_ids:
            await self.get_prompt(agent_id)


# Singleton instance
_loader: Optional[PromptLoader] = None


def get_prompt_loader() -> PromptLoader:
    """Get the singleton PromptLoader instance"""
    global _loader
    if _loader is None:
        _loader = PromptLoader()
    return _loader


async def load_prompt(agent_id: str) -> Dict[str, Any]:
    """Convenience function to load a prompt"""
    loader = get_prompt_loader()
    return await loader.get_prompt(agent_id)


def load_prompt_sync(agent_id: str) -> Dict[str, Any]:
    """Synchronous convenience function"""
    loader = get_prompt_loader()
    return loader.get_prompt_sync(agent_id)
