/**
 * Fast Cut API Client
 * Client-side API wrapper for the MoviePy video composition engine
 */

import { api } from './api';
import type { SelectedEffects } from './effects-api';

// Style Set types (from lib/fast-cut/style-sets)
export interface StyleSetSummary {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: string;
  previewColor: string;
  vibe: string;
  colorGrade: string;
  textStyle: string;
  intensity: 'low' | 'medium' | 'high';
  bpmRange?: [number, number];
  cutDuration: number;
}

export interface StyleSetSelection {
  styleSetId: string;
  confidence: number;
  reasoning: string;
}

export interface StyleSetSelectionResponse {
  selection: StyleSetSelection;
  selected: StyleSetSummary;
  alternatives: Array<{
    id: string;
    name: string;
    nameKo: string;
    icon: string;
    previewColor: string;
  }>;
}

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
  language?: "ko" | "en";
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

// Categorized keywords from ImageKeywordGeneratorAgent
export interface KeywordCategories {
  subject: string[];   // Artist/person focused keywords
  scene: string[];     // Background/location keywords
  moodVisual: string[]; // Visual mood/atmosphere keywords
  style: string[];     // Photography style keywords
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
  keywordCategories?: KeywordCategories; // Detailed keyword breakdown by category
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
  language?: 'ko' | 'en';  // User's language for region/language filtering
  forceRefresh?: boolean;  // Bypass cache and force fresh search
}

// AI Image Generation Types
export type AIImageStyle = 'cinematic' | 'photorealistic' | 'illustration' | 'artistic' | 'anime';

export interface ImagePromptGenerationRequest {
  script: {
    lines: ScriptLine[];
    totalDuration: number;
  };
  style: AIImageStyle;
  language?: 'ko' | 'en';
}

export interface GeneratedImagePrompt {
  sceneNumber: number;
  scriptText: string;
  imagePrompt: string;
  negativePrompt?: string;
}

export interface ImagePromptGenerationResponse {
  scenes: GeneratedImagePrompt[];
  globalStyle?: {
    colorPalette: string;
    lighting: string;
    mood: string;
    consistency: string;
  };
}

export interface AIImageGenerationRequest {
  scenes: Array<{
    sceneNumber: number;
    imagePrompt: string;
    negativePrompt?: string;
  }>;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  sessionId?: string;
}

export interface GeneratedImage {
  sceneNumber: number;
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  s3Key?: string;
  error?: string;
}

export interface AIImageGenerationResponse {
  success: boolean;
  sessionId: string;
  totalScenes: number;
  successCount: number;
  failureCount: number;
  images: GeneratedImage[];
}

export interface ImageSearchResponse {
  candidates: ImageCandidate[];
  totalFound: number;
  filtered: number;
  filterReasons: Record<string, number>;
  cacheStats?: {
    cachedKeywords: string[];
    freshKeywords: string[];
    cached: number;
    fresh: number;
  };
  fromCache?: boolean;
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
  // Real analysis data (if available)
  energyCurve?: [number, number][];  // [[time, energy], ...]
  beatTimes?: number[];
  analyzed?: boolean;
}

export interface ClimaxCandidate {
  startTime: number;
  dropTime: number;
  score: number;
  type: string;  // 'drop', 'energy_peak', 'chorus', 'combined', etc.
}

export interface AudioAnalysisResponse {
  assetId: string;
  duration: number;
  bpm: number | null;
  vibe?: string;
  suggestedStartTime: number;
  suggestedEndTime: number;
  analyzed: boolean;  // true if fast-cut-engine analyzed, false if fallback heuristics used
  // Real analysis data from fast-cut-engine (librosa)
  energyCurve?: [number, number][];  // [[time, energy], ...] - 0.5s intervals
  beatTimes?: number[];  // Beat positions in seconds
  // Variety selection info
  selectedCandidateIndex?: number;
  selectionReason?: string;
  // Advanced climax detection
  climaxCandidates?: ClimaxCandidate[];
  drops?: number[];
  builds?: [number, number][];
  bestHookStart?: number;
  // Lyrics analysis (if requested)
  lyrics?: {
    language: string;
    confidence: number;
    isInstrumental: boolean;
    segmentCount: number;
    hasChorus: boolean;
  };
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

// Compose Variations Types
export interface ComposeVariationItem {
  id: string;
  variation_label: string;
  search_tags: string[];
  settings: {
    effectPreset: string;
    colorGrade: string;
    textStyle: string;
    vibe: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ComposeVariationsResponse {
  seed_generation_id: string;
  batch_id: string;
  total_count: number;
  search_tags: string[];
  variations: ComposeVariationItem[];
  message: string;
}

export interface VariationStatusItem {
  id: string;
  variation_label?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  output_url?: string;
  thumbnail_url?: string;
  error_message?: string;
}

export interface VariationsBatchStatus {
  batch_id: string;
  seed_generation_id: string;
  batch_status: 'pending' | 'processing' | 'completed' | 'partial_failure';
  overall_progress: number;
  total: number;
  completed: number;
  failed: number;
  variations: VariationStatusItem[];
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
  // Style Set ID - when provided, overrides individual settings
  styleSetId?: string;
  // Individual settings (used when styleSetId is not provided - legacy mode)
  effectPreset?: string;
  aspectRatio: string;
  targetDuration: number;
  vibe?: string;
  textStyle?: string;
  colorGrade?: string;
  // Audio timing control
  audioStartTime?: number;  // Start time in seconds for audio (default: 0)
  // Additional fast cut data for variations
  prompt?: string;  // User's original video concept prompt
  searchKeywords?: string[];
  tiktokSEO?: TikTokSEO;
  // AI Effect Selection System (legacy - used when styleSetId is not provided)
  useAiEffects?: boolean;  // Enable AI-based effect selection
  aiPrompt?: string;  // Prompt for AI effect analysis (defaults to prompt field)
  aiEffects?: SelectedEffects;  // Pre-selected AI effects (auto-selected if not provided)
  // Lyrics subtitle mode
  useAudioLyrics?: boolean;  // Use audio lyrics for subtitles instead of script
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

// Fast cut video item type
export interface FastCutVideo {
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
  tiktok_seo?: {
    description?: string;
    hashtags?: string[];
    keywords?: string[];
    searchIntent?: string;
    suggestedPostingTimes?: string[];
    textOverlayKeywords?: string[];
  } | null;
  tags?: string[];
  quality_metadata?: {
    videoEdit?: {
      originalGenerationId: string;
      originalOutputUrl: string;
      editedAt: string;
      editType: string[];
      audioAssetId?: string;
      audioAssetName?: string;
      hasSubtitles: boolean;
      subtitleLineCount: number;
    };
    [key: string]: unknown;
  } | null;
}

export interface FastCutVideosResponse {
  items: FastCutVideo[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// API Client
export const fastCutApi = {
  /**
   * Get list of fast cut videos
   */
  getFastCutVideos: async (params?: {
    page?: number;
    page_size?: number;
    campaign_id?: string;
  }): Promise<FastCutVideosResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    if (params?.campaign_id) searchParams.set('campaign_id', params.campaign_id);

    const queryString = searchParams.toString();
    const url = `/api/v1/fast-cut/videos${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<FastCutVideosResponse>(url);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Generate script and vibe analysis using AI
   */
  generateScript: async (data: ScriptGenerationRequest): Promise<ScriptGenerationResponse> => {
    const response = await api.post<ScriptGenerationResponse>('/api/v1/fast-cut/script', data as unknown as Record<string, unknown>);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Search for images using Google Custom Search
   */
  searchImages: async (data: ImageSearchRequest): Promise<ImageSearchResponse> => {
    const response = await api.post<ImageSearchResponse>('/api/v1/fast-cut/images/search', data as unknown as Record<string, unknown>);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Generate image prompts from script using AI
   * This creates detailed image generation prompts for each scene
   */
  generateImagePrompts: async (data: ImagePromptGenerationRequest): Promise<ImagePromptGenerationResponse> => {
    const response = await api.post<ImagePromptGenerationResponse>(
      '/api/v1/fast-cut/images/generate-prompts',
      data as unknown as Record<string, unknown>
    );
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Generate AI images from prompts using Vertex AI Imagen 3
   * Creates actual images for each scene
   */
  generateImages: async (data: AIImageGenerationRequest): Promise<AIImageGenerationResponse> => {
    const response = await api.post<AIImageGenerationResponse>(
      '/api/v1/fast-cut/images/generate',
      data as unknown as Record<string, unknown>
    );
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
    const response = await api.patch<{ selectedCount: number; totalCount: number }>('/api/v1/fast-cut/images/selection', {
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
    const res = await fetch('/api/v1/fast-cut/images/upload', {
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
    const response = await api.post<MusicMatchResponse>('/api/v1/fast-cut/music/match', data as unknown as Record<string, unknown>);
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
    const response = await api.post<{ bpm: number; energy: number; suggestedVibe: string; duration: number }>('/api/v1/fast-cut/music/analyze', { assetId });
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Analyze audio to find best segment (highest energy section)
   * Used for automatic audio start time detection
   *
   * @param assetId - The asset ID to analyze
   * @param targetDuration - Target segment duration in seconds (default: 15)
   * @param options - Additional options for variety selection
   */
  analyzeAudioBestSegment: async (
    assetId: string,
    targetDuration: number = 15,
    options?: {
      preferVariety?: boolean;      // Enable random selection from top candidates (default: true)
      candidateIndex?: number;      // Force specific candidate index
      excludeStarts?: number[];     // Exclude these start times (for re-analysis)
      includeLyrics?: boolean;      // Include lyrics-based chorus detection
    }
  ): Promise<AudioAnalysisResponse> => {
    const response = await api.post<AudioAnalysisResponse>('/api/v1/fast-cut/audio/analyze', {
      assetId,
      targetDuration,
      ...options
    });
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Extract lyrics from audio asset
   * Will use cached lyrics if already extracted (unless forceReExtract is true)
   */
  extractLyrics: async (assetId: string, options?: { languageHint?: 'ko' | 'en' | 'ja' | 'auto'; forceReExtract?: boolean }): Promise<{
    assetId: string;
    lyrics: {
      fullText: string;
      language: string;
      isInstrumental: boolean;
      segments: Array<{
        text: string;
        start: number;
        end: number;
        words?: Array<{ word: string; start: number; end: number }>;
      }>;
    } | null;
    cached: boolean;
  }> => {
    const response = await api.post<{
      assetId: string;
      lyrics: {
        fullText: string;
        language: string;
        isInstrumental: boolean;
        segments: Array<{
          text: string;
          start: number;
          end: number;
          words?: Array<{ word: string; start: number; end: number }>;
        }>;
      } | null;
      cached: boolean;
    }>('/api/v1/audio/lyrics', {
      assetId,
      languageHint: options?.languageHint || 'auto',
      forceReExtract: options?.forceReExtract || false,
    });
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
    }>('/api/v1/fast-cut/proxy-images', { generationId, images });
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Start video rendering
   */
  startRender: async (data: RenderRequest): Promise<RenderResponse> => {
    const response = await api.post<RenderResponse>('/api/v1/fast-cut/render', data as unknown as Record<string, unknown>);
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Get render job status
   */
  getRenderStatus: async (generationId: string): Promise<RenderStatus> => {
    const response = await api.get<RenderStatus>(`/api/v1/fast-cut/${generationId}/status`);
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
    maxAttempts = 600 // 20 minutes max (EC2 cold start can take 3-5 min)
  ): Promise<RenderStatus> => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await fastCutApi.getRenderStatus(generationId);

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
  },

  // ============================================
  // Style Sets API
  // ============================================

  /**
   * Get all available style sets
   */
  getStyleSets: async (): Promise<{ styleSets: StyleSetSummary[]; total: number }> => {
    const response = await api.get<{ styleSets: StyleSetSummary[]; total: number }>('/api/v1/fast-cut/style-sets');
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * AI-powered style set selection based on prompt
   */
  selectStyleSet: async (
    prompt: string,
    options?: { useAI?: boolean; campaignId?: string }
  ): Promise<StyleSetSelectionResponse> => {
    const response = await api.post<StyleSetSelectionResponse>('/api/v1/fast-cut/style-sets', {
      prompt,
      useAI: options?.useAI ?? true,
      campaignId: options?.campaignId,
    });
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  // ============================================
  // Compose Variations API
  // ============================================

  /**
   * Start compose video variations generation
   * @param seedGenerationId - The original compose video generation ID
   * @param options - Variation options including vibes, effects, colors, text styles
   */
  startComposeVariations: async (
    seedGenerationId: string,
    options: {
      variationCount?: number;
      vibeVariations?: string[];
      effectPresets?: string[];
      colorGrades?: string[];
      textStyles?: string[];
    } = {}
  ): Promise<ComposeVariationsResponse> => {
    const response = await api.post<ComposeVariationsResponse>(
      `/api/v1/generations/${seedGenerationId}/compose-variations`,
      {
        variation_count: options.variationCount || 8,
        vibe_variations: options.vibeVariations || ['Pop', 'Emotional', 'Exciting', 'Minimal'],
        effect_presets: options.effectPresets || ['zoom_beat', 'crossfade'],
        color_grades: options.colorGrades || ['vibrant', 'cinematic'],
        text_styles: options.textStyles || ['bold_pop', 'fade_in'],
      }
    );
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Get compose variations batch status
   * @param seedGenerationId - The original generation ID (compose video)
   * @param batchId - The batch ID returned from startComposeVariations
   */
  getComposeVariationsStatus: async (
    seedGenerationId: string,
    batchId: string
  ): Promise<VariationsBatchStatus> => {
    const response = await api.get<VariationsBatchStatus>(
      `/api/v1/generations/${seedGenerationId}/compose-variations?batch_id=${batchId}`
    );
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Get variations batch status (for AI Video - uses /variations endpoint)
   * @deprecated Use getComposeVariationsStatus for compose videos
   * @param seedGenerationId - The original generation ID
   * @param batchId - The batch ID returned from startComposeVariations
   */
  getVariationsStatus: async (
    seedGenerationId: string,
    batchId: string
  ): Promise<VariationsBatchStatus> => {
    const response = await api.get<VariationsBatchStatus>(
      `/api/v1/generations/${seedGenerationId}/variations?batch_id=${batchId}`
    );
    if (response.error) throw new Error(response.error.message);
    return response.data!;
  },

  /**
   * Poll for compose variations completion
   * @param seedGenerationId - The original generation ID (compose video)
   * @param batchId - The batch ID
   * @param onProgress - Callback for progress updates
   * @param pollInterval - Polling interval in ms (default 3000)
   * @param maxAttempts - Max polling attempts (default 600 = 30 min)
   */
  waitForComposeVariations: async (
    seedGenerationId: string,
    batchId: string,
    onProgress?: (status: VariationsBatchStatus) => void,
    pollInterval = 3000,
    maxAttempts = 600
  ): Promise<VariationsBatchStatus> => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await fastCutApi.getComposeVariationsStatus(seedGenerationId, batchId);

      if (onProgress) {
        onProgress(status);
      }

      if (status.batch_status === 'completed' || status.batch_status === 'partial_failure') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Compose variations generation timed out');
  },

  /**
   * Poll for AI video variations completion (uses /variations endpoint)
   * @deprecated Use waitForComposeVariations for compose videos
   * @param seedGenerationId - The original generation ID
   * @param batchId - The batch ID
   * @param onProgress - Callback for progress updates
   * @param pollInterval - Polling interval in ms (default 3000)
   * @param maxAttempts - Max polling attempts (default 600 = 30 min)
   */
  waitForVariations: async (
    seedGenerationId: string,
    batchId: string,
    onProgress?: (status: VariationsBatchStatus) => void,
    pollInterval = 3000,
    maxAttempts = 600
  ): Promise<VariationsBatchStatus> => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await fastCutApi.getVariationsStatus(seedGenerationId, batchId);

      if (onProgress) {
        onProgress(status);
      }

      if (status.batch_status === 'completed' || status.batch_status === 'partial_failure') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Variations generation timed out');
  },
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

// Duration range for slider (15-25 seconds)
export const DURATION_RANGE = {
  min: 15,
  max: 25,
  default: 20,
  step: 1,
} as const;

// Legacy: Duration options (deprecated, use DURATION_RANGE instead)
export const DURATION_OPTIONS = [
  { value: 15, label: '15초' },
  { value: 20, label: '20초' },
  { value: 25, label: '25초' }
];

