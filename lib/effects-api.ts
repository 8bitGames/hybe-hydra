/**
 * Effects API Client
 * Client-side API wrapper for the AI Effect Selection System
 */

import { api } from './api';

// Types - mirrors backend/compose-engine/app/effects/registry.py
export interface EffectMetadata {
  id: string;
  name: string;
  source: 'gl-transitions' | 'ffmpeg-xfade' | 'remotion' | 'moviepy';
  type: 'transition' | 'motion' | 'filter' | 'text';
  mood: string[];
  genre: string[];
  intensity: 'low' | 'medium' | 'high';
  description: string;
  description_ko: string;
  keywords: string[];
  duration_range: [number, number];
  gpu_required: boolean;
  params?: Record<string, unknown>;
  compatible_with?: string[];
  conflicts_with?: string[];
  render_info?: {
    glsl_file?: string;
    ffmpeg_filter?: string;
    moviepy_func?: string;
  };
}

// AI Analysis Results
export interface PromptAnalysis {
  moods: string[];
  genres: string[];
  keywords: string[];
  intensity: 'low' | 'medium' | 'high';
}

// Selected Effects
export interface SelectedEffects {
  transitions: string[];
  motions: string[];
  filters: string[];
  text_animations: string[];
  analysis?: PromptAnalysis;
}

// Effect Selection Request
export interface EffectSelectRequest {
  prompt: string;
  audio_bpm?: number;
  image_count?: number;
  duration?: number;
  preferences?: {
    intensity?: 'low' | 'medium' | 'high';
    sources?: ('gl-transitions' | 'ffmpeg-xfade')[];
    prefer_gpu?: boolean;
  };
}

// Effect Selection Response
export interface EffectSelectResponse {
  analysis: {
    detected_mood: string[];
    detected_genre: string[];
    detected_keywords: string[];
    suggested_intensity: string;
    reasoning: string;
  };
  selected_effects: {
    transitions: EffectMetadata[];
    motions: EffectMetadata[];
    filters: EffectMetadata[];
    text_animations: EffectMetadata[];
  };
}

// Registry Stats
export interface EffectRegistryStats {
  total: number;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
  by_mood: Record<string, number>;
  by_genre: Record<string, number>;
}

// List Effects Response
export interface EffectListResponse {
  effects: EffectMetadata[];
  total: number;
  filtered: number;
}

// Search Response
export interface EffectSearchResponse {
  effects: EffectMetadata[];
  total: number;
  query: string;
}

// Mood categories for UI
export const MOOD_CATEGORIES = [
  { value: 'energetic', label: 'Energetic', label_ko: '에너지 넘치는' },
  { value: 'calm', label: 'Calm', label_ko: '차분한' },
  { value: 'dramatic', label: 'Dramatic', label_ko: '극적인' },
  { value: 'playful', label: 'Playful', label_ko: '장난스러운' },
  { value: 'elegant', label: 'Elegant', label_ko: '우아한' },
  { value: 'romantic', label: 'Romantic', label_ko: '로맨틱한' },
  { value: 'dark', label: 'Dark', label_ko: '어두운' },
  { value: 'bright', label: 'Bright', label_ko: '밝은' },
  { value: 'mysterious', label: 'Mysterious', label_ko: '신비로운' },
  { value: 'modern', label: 'Modern', label_ko: '모던한' },
] as const;

// Genre categories for UI
export const GENRE_CATEGORIES = [
  { value: 'kpop', label: 'K-POP', label_ko: '케이팝' },
  { value: 'hiphop', label: 'Hip-Hop', label_ko: '힙합' },
  { value: 'emotional', label: 'Emotional', label_ko: '감성' },
  { value: 'corporate', label: 'Corporate', label_ko: '기업' },
  { value: 'tiktok', label: 'TikTok', label_ko: '틱톡' },
  { value: 'cinematic', label: 'Cinematic', label_ko: '시네마틱' },
  { value: 'vlog', label: 'Vlog', label_ko: '브이로그' },
  { value: 'documentary', label: 'Documentary', label_ko: '다큐멘터리' },
  { value: 'edm', label: 'EDM', label_ko: 'EDM' },
  { value: 'indie', label: 'Indie', label_ko: '인디' },
] as const;

// Intensity levels for UI
export const INTENSITY_LEVELS = [
  { value: 'low', label: 'Low', label_ko: '낮음', description: 'Subtle, gentle effects' },
  { value: 'medium', label: 'Medium', label_ko: '중간', description: 'Balanced effects' },
  { value: 'high', label: 'High', label_ko: '높음', description: 'Dynamic, intense effects' },
] as const;

// Effect source options for UI
export const EFFECT_SOURCES = [
  { value: 'gl-transitions', label: 'GL Transitions', description: 'GPU-accelerated GLSL shaders (80+ effects)' },
  { value: 'ffmpeg-xfade', label: 'FFmpeg xfade', description: 'Built-in FFmpeg transitions (44 effects)' },
  { value: 'moviepy', label: 'MoviePy', description: 'Python-based effects (fallback)' },
] as const;

// API Client
export const effectsApi = {
  /**
   * Get registry statistics
   */
  getStats: async (): Promise<EffectRegistryStats> => {
    const response = await api.get<EffectRegistryStats>('/api/v1/effects/stats');
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * List effects with optional filtering
   */
  list: async (params?: {
    type?: 'transition' | 'motion' | 'filter' | 'text';
    source?: string;
    mood?: string;
    genre?: string;
    intensity?: 'low' | 'medium' | 'high';
    limit?: number;
    offset?: number;
  }): Promise<EffectListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.source) searchParams.set('source', params.source);
    if (params?.mood) searchParams.set('mood', params.mood);
    if (params?.genre) searchParams.set('genre', params.genre);
    if (params?.intensity) searchParams.set('intensity', params.intensity);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const queryString = searchParams.toString();
    const url = `/api/v1/effects${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<EffectListResponse>(url);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Search effects by keyword
   */
  search: async (query: string, limit = 20): Promise<EffectSearchResponse> => {
    const response = await api.get<EffectSearchResponse>(
      `/api/v1/effects/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Get a single effect by ID
   */
  getById: async (effectId: string): Promise<EffectMetadata> => {
    const response = await api.get<EffectMetadata>(`/api/v1/effects/${effectId}`);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * AI-powered effect selection based on prompt
   * This is the main API for getting AI-recommended effects
   */
  select: async (data: EffectSelectRequest): Promise<EffectSelectResponse> => {
    const response = await api.post<EffectSelectResponse>(
      '/api/v1/effects/select',
      data as unknown as Record<string, unknown>
    );
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Get effects for a specific clip (per-image effect selection)
   */
  selectForClip: async (data: {
    prompt: string;
    clip_index: number;
    total_clips: number;
    context?: {
      previous_effects?: string[];
      mood?: string;
      intensity?: string;
    };
  }): Promise<{
    clip_index: number;
    transition: EffectMetadata | null;
    motion: EffectMetadata | null;
    filter: EffectMetadata | null;
  }> => {
    const response = await api.post<{
      clip_index: number;
      transition: EffectMetadata | null;
      motion: EffectMetadata | null;
      filter: EffectMetadata | null;
    }>('/api/v1/effects/select/clip', data as unknown as Record<string, unknown>);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Convert selected effects to IDs for backend rendering
   */
  toEffectIds: (response: EffectSelectResponse): SelectedEffects => {
    return {
      transitions: response.selected_effects.transitions.map(e => e.id),
      motions: response.selected_effects.motions.map(e => e.id),
      filters: response.selected_effects.filters.map(e => e.id),
      text_animations: response.selected_effects.text_animations.map(e => e.id),
      analysis: {
        moods: response.analysis.detected_mood,
        genres: response.analysis.detected_genre,
        keywords: response.analysis.detected_keywords,
        intensity: response.analysis.suggested_intensity as 'low' | 'medium' | 'high',
      },
    };
  },
};

// Helper function to get effect preview URL (placeholder for now)
export function getEffectPreviewUrl(effectId: string): string {
  // In the future, this could return a URL to a preview GIF/video
  return `/effects/previews/${effectId}.gif`;
}

// Helper function to get localized effect name
export function getEffectLabel(effect: EffectMetadata, locale: 'en' | 'ko' = 'ko'): string {
  if (locale === 'ko' && effect.description_ko) {
    return `${effect.name} - ${effect.description_ko}`;
  }
  return `${effect.name} - ${effect.description}`;
}

// Helper to check if an effect needs GPU
export function requiresGpu(effect: EffectMetadata): boolean {
  return effect.gpu_required || effect.source === 'gl-transitions';
}
