/**
 * Compose API Client
 * Client-side API wrapper for the MoviePy video composition engine
 */

import { api } from './api';

// Types
export interface ScriptLine {
  text: string;
  timing: number;
  duration: number;
}

export interface TrendContext {
  keyword: string;
  hashtags: string[];
  platform: string;
}

export interface ScriptGenerationRequest {
  campaignId: string;
  artistName: string;
  artistContext?: string;
  trendKeywords: string[];
  trendContext?: TrendContext[];  // Current trending topics to incorporate
  userPrompt: string;
  targetDuration: number;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface GroundingInfo {
  sources: GroundingSource[];
  summary?: string;
}

// TikTok SEO Metadata
export interface TikTokSEOHashtags {
  category: string;
  niche: string;
  descriptive: string[];
  trending?: string;
}

export interface TikTokSEOKeywords {
  primary: string;
  secondary: string[];
  longTail: string[];
}

export interface TikTokSEO {
  description: string;
  hashtags: TikTokSEOHashtags;
  keywords: TikTokSEOKeywords;
  textOverlayKeywords: string[];
  searchIntent: 'tutorial' | 'discovery' | 'entertainment' | 'inspiration';
  suggestedPostingTimes: string[];
}

export interface ScriptGenerationResponse {
  script: {
    lines: ScriptLine[];
    totalDuration: number;
  };
  vibe: string;
  vibeReason: string;
  suggestedBpmRange: { min: number; max: number };
  searchKeywords: string[];
  effectRecommendation: string;
  groundingInfo?: GroundingInfo;
  // TikTok SEO optimization data
  tiktokSEO?: TikTokSEO;
}

export interface ImageCandidate {
  id: string;
  sourceUrl: string;
  thumbnailUrl: string;
  sourceTitle?: string;
  sourceDomain?: string;
  width: number;
  height: number;
  isSelected: boolean;
  sortOrder: number;
  qualityScore?: number;
}

export interface ImageSearchRequest {
  generationId: string;
  keywords: string[];
  maxImages?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface ImageSearchResponse {
  candidates: ImageCandidate[];
  totalFound: number;
  filtered: number;
  filterReasons: Record<string, number>;
}

export interface AudioMatch {
  id: string;
  filename: string;
  s3Url: string;
  bpm: number | null;
  vibe: string | null;
  genre: string | null;
  duration: number;
  energy: number;
  matchScore: number;
}

export interface MusicMatchRequest {
  campaignId: string;
  vibe: string;
  bpmRange: { min: number; max: number };
  minDuration?: number;
}

export interface MusicMatchResponse {
  matches: AudioMatch[];
  totalMatches: number;
}

export interface RenderRequest {
  generationId: string;
  campaignId: string;
  audioAssetId: string;
  images: Array<{
    url: string;
    order: number;
  }>;
  script?: {
    lines: ScriptLine[];
  };
  effectPreset: string;
  aspectRatio: string;
  targetDuration: number;
  vibe: string;
  textStyle?: string;
  colorGrade?: string;
  // Additional compose data for variations
  prompt?: string;  // User's original video concept prompt
  searchKeywords?: string[];
  tiktokSEO?: TikTokSEO;
}

export interface RenderResponse {
  jobId: string;
  generationId: string;
  status: string;
  estimatedSeconds: number;
  outputKey: string;
}

export interface RenderStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  steps?: Array<{
    name: string;
    completed: boolean;
    progress?: number;
  }>;
  outputUrl?: string;
  error?: string;
}

// Composed video item type
export interface ComposedVideo {
  id: string;
  campaign_id: string;
  campaign_name: string;
  artist_name: string;
  prompt: string;
  duration_seconds: number;
  aspect_ratio: string;
  status: string;
  composed_output_url: string | null;
  output_url: string | null;
  audio_asset: {
    id: string;
    filename: string;
    original_filename: string;
    s3_url: string;
  } | null;
  creator: {
    id: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ComposedVideosResponse {
  items: ComposedVideo[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// API Client
export const composeApi = {
  /**
   * Get list of composed videos
   */
  getComposedVideos: async (params?: {
    page?: number;
    page_size?: number;
    campaign_id?: string;
  }): Promise<ComposedVideosResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    if (params?.campaign_id) searchParams.set('campaign_id', params.campaign_id);

    const queryString = searchParams.toString();
    const url = `/api/v1/compose/videos${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<ComposedVideosResponse>(url);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Generate script and vibe analysis using AI
   */
  generateScript: async (data: ScriptGenerationRequest): Promise<ScriptGenerationResponse> => {
    const response = await api.post<ScriptGenerationResponse>('/api/v1/compose/script', data as unknown as Record<string, unknown>);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Search for images using Google Custom Search
   */
  searchImages: async (data: ImageSearchRequest): Promise<ImageSearchResponse> => {
    const response = await api.post<ImageSearchResponse>('/api/v1/compose/images/search', data as unknown as Record<string, unknown>);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Update image selection state
   */
  updateImageSelections: async (
    generationId: string,
    selections: Array<{ id: string; isSelected: boolean; sortOrder: number }>
  ): Promise<{ selectedCount: number; totalCount: number }> => {
    const response = await api.patch<{ selectedCount: number; totalCount: number }>('/api/v1/compose/images/selection', {
      generationId,
      selections
    });
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Upload user's own images (simplified - actual implementation would need FormData handling)
   */
  uploadImages: async (generationId: string, files: File[]): Promise<ImageCandidate[]> => {
    // For now, we'll use a fetch directly for multipart form data
    const formData = new FormData();
    formData.append('generationId', generationId);
    files.forEach((file) => formData.append('files', file));

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const res = await fetch('/api/v1/compose/images/upload', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });

    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.uploaded;
  },

  /**
   * Match music from Asset Locker based on vibe and BPM
   */
  matchMusic: async (data: MusicMatchRequest): Promise<MusicMatchResponse> => {
    const response = await api.post<MusicMatchResponse>('/api/v1/compose/music/match', data as unknown as Record<string, unknown>);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Analyze audio file for BPM
   */
  analyzeAudio: async (assetId: string): Promise<{
    bpm: number;
    energy: number;
    suggestedVibe: string;
    duration: number;
  }> => {
    const response = await api.post<{ bpm: number; energy: number; suggestedVibe: string; duration: number }>('/api/v1/compose/music/analyze', { assetId });
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Proxy images through server to MinIO (for hotlink-protected images)
   */
  proxyImages: async (
    generationId: string,
    images: Array<{ url: string; id: string }>
  ): Promise<{
    results: Array<{
      originalUrl: string;
      minioUrl: string;
      id: string;
      success: boolean;
      error?: string;
    }>;
    successful: number;
    failed: number;
  }> => {
    const response = await api.post<{
      results: Array<{
        originalUrl: string;
        minioUrl: string;
        id: string;
        success: boolean;
        error?: string;
      }>;
      successful: number;
      failed: number;
    }>('/api/v1/compose/proxy-images', { generationId, images });
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Start video rendering
   */
  startRender: async (data: RenderRequest): Promise<RenderResponse> => {
    const response = await api.post<RenderResponse>('/api/v1/compose/render', data as unknown as Record<string, unknown>);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Get render job status
   */
  getRenderStatus: async (generationId: string): Promise<RenderStatus> => {
    const response = await api.get<RenderStatus>(`/api/v1/compose/${generationId}/status`);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Poll for render completion
   * Returns a promise that resolves when the render is complete
   */
  waitForRender: async (
    generationId: string,
    onProgress?: (status: RenderStatus) => void,
    pollInterval = 2000,
    maxAttempts = 300 // 10 minutes max
  ): Promise<RenderStatus> => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await composeApi.getRenderStatus(generationId);

      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Render timed out');
  }
};

// Vibe presets configuration (for UI reference)
export const VIBE_PRESETS = {
  Exciting: {
    bpmRange: { min: 120, max: 140 },
    cutDuration: 0.5,
    transition: 'zoom_beat',
    colorGrade: 'vibrant',
    textStyle: 'bold_pop',
    description: 'Fast, energetic content with quick cuts synced to beats'
  },
  Emotional: {
    bpmRange: { min: 60, max: 80 },
    cutDuration: 2.5,
    transition: 'crossfade',
    colorGrade: 'cinematic',
    textStyle: 'fade_in',
    description: 'Slow, heartfelt content with smooth transitions'
  },
  Pop: {
    bpmRange: { min: 100, max: 120 },
    cutDuration: 1.0,
    transition: 'bounce',
    colorGrade: 'bright',
    textStyle: 'slide_in',
    description: 'Trendy, mainstream content with bouncy effects'
  },
  Minimal: {
    bpmRange: { min: 80, max: 120 },
    cutDuration: 1.5,
    transition: 'minimal',
    colorGrade: 'natural',
    textStyle: 'minimal',
    description: 'Clean, professional content with simple cuts'
  }
} as const;

export type VibeType = keyof typeof VIBE_PRESETS;

// Effect presets
export const EFFECT_PRESETS = [
  { value: 'zoom_beat', label: 'Zoom Beat', description: 'Zoom effects synced to music beats' },
  { value: 'crossfade', label: 'Crossfade', description: 'Smooth fade transitions' },
  { value: 'bounce', label: 'Bounce', description: 'Bouncy, playful transitions' },
  { value: 'minimal', label: 'Minimal', description: 'Simple cuts, no effects' }
];

// Aspect ratios
export const ASPECT_RATIOS = [
  { value: '9:16', label: '9:16 (TikTok/Reels)', width: 1080, height: 1920 },
  { value: '16:9', label: '16:9 (YouTube)', width: 1920, height: 1080 },
  { value: '1:1', label: '1:1 (Instagram)', width: 1080, height: 1080 }
];

// Duration options
export const DURATION_OPTIONS = [
  { value: 10, label: '10초' },
  { value: 15, label: '15초' },
  { value: 30, label: '30초' },
  { value: 60, label: '60초' }
];
