import { api } from "./api";

// Types
export type VideoGenerationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

// Bridge context for tracking how generation was created
export interface BridgeContext {
  original_input: string | null;
  trend_keywords: string[];
  reference_urls: ReferenceUrl[] | null;
  prompt_analysis: PromptAnalysis | null;
}

export interface ReferenceUrl {
  url: string;
  title?: string;
  platform?: string;
  hashtags?: string[];
  scraped_at?: string;
}

export interface PromptAnalysis {
  intent: string;
  trend_applied: string[];
  suggestions?: string[];
}

export interface AudioAssetInfo {
  id: string;
  filename: string;
  original_filename: string;
  s3_url: string;
}

export interface AudioAnalysis {
  duration: number;
  bpm: number;
  energy_curve: number[];
  peak_energy: number;
  avg_energy: number;
  segments: Array<{
    start: number;
    end: number;
    energy: number;
    type: string;
  }>;
  best_15s_start: number;
  best_15s_energy: number;
}

// Generation type for distinguishing AI vs Compose pipelines
export type VideoGenerationType = "AI" | "COMPOSE";

export interface VideoGeneration {
  id: string;
  campaign_id: string;
  prompt: string;
  negative_prompt: string | null;
  duration_seconds: number;
  aspect_ratio: string;
  reference_image_id: string | null;
  reference_style: string | null;
  // Audio fields
  audio_asset_id: string;
  audio_asset?: AudioAssetInfo | null;
  audio_analysis?: AudioAnalysis | null;
  audio_start_time?: number | null;
  audio_duration?: number | null;
  composed_output_url?: string | null;
  status: VideoGenerationStatus;
  progress: number;
  error_message: string | null;
  output_url: string | null;
  output_asset_id: string | null;
  quality_score: number | null;
  // Video Extension fields (Veo 3.1)
  gcs_uri?: string | null;
  extension_count?: number;
  // Bridge context fields
  original_input: string | null;
  trend_keywords: string[];
  reference_urls: ReferenceUrl[] | null;
  prompt_analysis: PromptAnalysis | null;
  is_favorite: boolean;
  tags: string[];
  tiktok_seo?: {
    description?: string;
    hashtags?: string[];
    keywords?: string[];
    searchIntent?: string;
    suggestedPostingTimes?: string[];
    textOverlayKeywords?: string[];
  } | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Generation type - AI (Veo) vs COMPOSE (MoviePy)
  generation_type: VideoGenerationType;
  // Compose-specific fields
  script_data?: Record<string, unknown> | null;
  image_assets?: Record<string, unknown> | null;
  effect_preset?: string | null;
  // Metadata for batch/variation tracking
  quality_metadata?: Record<string, unknown> | null;
}

export interface VideoGenerationList {
  items: VideoGeneration[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface VideoGenerationStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface CreateVideoGenerationRequest {
  prompt: string;
  audio_asset_id?: string;  // Optional: audio track for composition
  audio_start_time?: number;  // Start time in audio file (seconds)
  use_audio_lyrics?: boolean;  // Use lyrics from audio asset as subtitles
  negative_prompt?: string;
  duration_seconds?: number;
  aspect_ratio?: string;
  reference_image_id?: string;
  reference_style?: string;
  // I2V parameters - generate image first, then video
  enable_i2v?: boolean;  // Enable AI image generation before video
  image_description?: string;  // Description of how the image should look
  // Preview image (pre-generated from two-step workflow)
  preview_image_base64?: string;  // Base64 encoded image to skip regeneration
  preview_image_url?: string;  // URL of pre-generated image
  // Bridge context fields (optional)
  original_input?: string;
  trend_keywords?: string[];
  reference_urls?: ReferenceUrl[];
  prompt_analysis?: PromptAnalysis;
}

// Style Preset Types
export interface StylePreset {
  id: string;
  name: string;
  name_ko: string | null;
  category: string;
  description: string | null;
  parameters: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StylePresetList {
  presets: StylePreset[];
  total: number;
}

// Batch Generation Types
export interface BatchGenerationRequest {
  base_prompt: string;
  audio_asset_id: string;  // Required: audio track for composition
  negative_prompt?: string;
  style_preset_ids: string[];
  duration_seconds?: number;
  aspect_ratio?: string;
  reference_image_id?: string;
  reference_style?: string;
}

export interface BatchGenerationItem extends VideoGeneration {
  style_preset: {
    id: string;
    name: string;
    name_ko: string | null;
    category: string;
  };
}

export interface BatchGenerationResponse {
  batch_id: string;
  total: number;
  generations: BatchGenerationItem[];
  message: string;
}

export interface BatchStatusResponse {
  batch_id: string;
  batch_status: "pending" | "processing" | "completed" | "partial_failure";
  overall_progress: number;
  total: number;
  completed: number;
  failed: number;
  generations: BatchGenerationItem[];
}

// Prompt Alchemist Types
export interface PromptTransformRequest {
  user_input: string;
  campaign_id?: string;
  trend_keywords?: string[];
  safety_level?: "high" | "medium" | "low";
}

export interface PromptTransformResponse {
  status: "success" | "blocked";
  analysis: {
    intent: string;
    trend_applied: string[];
    safety_check: {
      passed: boolean;
      concerns: string[];
    };
    suggestions?: string[];
  };
  veo_prompt: string;
  negative_prompt: string;
  technical_settings: {
    aspect_ratio: string;
    fps: number;
    duration_seconds: number;
    guidance_scale: number;
  };
  blocked_reason?: string;
  // Celebrity name warnings
  celebrity_warning?: string;
  detected_celebrities?: string[];
}

// Scoring Types
export interface ScoreBreakdown {
  promptQuality: {
    score: number;
    details: { length: number; specificity: number; structure: number };
  };
  technicalSettings: {
    score: number;
    details: { aspectRatio: number; duration: number; fps: number };
  };
  styleAlignment: {
    score: number;
    details: {
      stylePresetMatch: number;
      brandConsistency: number;
      visualCoherence: number;
    };
  };
  trendAlignment: {
    score: number;
    details: {
      trendKeywords: number;
      contemporaryStyle: number;
      viralPotential: number;
    };
  };
}

export interface ScoringResult {
  generation_id: string;
  total_score: number;
  normalized_score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  breakdown: ScoreBreakdown;
  recommendations: string[];
  calculated_at: string;
}

export interface ScoreAllResponse {
  campaign_id: string;
  scored: number;
  statistics: {
    average_score: number;
    max_score: number;
    min_score: number;
    grade_distribution: Record<string, number>;
  };
  results: Array<{
    generation_id: string;
    total_score: number;
    grade: string;
    style_preset: string | null;
  }>;
}

// Video Generations API
export const videoApi = {
  create: (campaignId: string, data: CreateVideoGenerationRequest) =>
    api.post<VideoGeneration>(
      `/api/v1/campaigns/${campaignId}/generations`,
      data as unknown as Record<string, unknown>
    ),

  getAll: (
    campaignId: string,
    params?: {
      page?: number;
      page_size?: number;
      status?: VideoGenerationStatus;
      generation_type?: VideoGenerationType;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size)
      searchParams.set("page_size", params.page_size.toString());
    if (params?.status) searchParams.set("status", params.status);
    if (params?.generation_type) searchParams.set("generation_type", params.generation_type);

    const query = searchParams.toString();
    return api.get<VideoGenerationList>(
      `/api/v1/campaigns/${campaignId}/generations${query ? `?${query}` : ""}`
    );
  },

  getById: (generationId: string) =>
    api.get<VideoGeneration>(`/api/v1/generations/${generationId}`),

  getStats: (campaignId: string, params?: { generation_type?: VideoGenerationType }) => {
    const searchParams = new URLSearchParams();
    if (params?.generation_type) searchParams.set("generation_type", params.generation_type);
    const query = searchParams.toString();
    return api.get<VideoGenerationStats>(
      `/api/v1/campaigns/${campaignId}/generations/stats${query ? `?${query}` : ""}`
    );
  },

  cancel: (generationId: string) =>
    api.post<VideoGeneration>(`/api/v1/generations/${generationId}/cancel`),

  delete: (generationId: string, force?: boolean) =>
    api.delete(`/api/v1/generations/${generationId}${force ? '?force=true' : ''}`),

  retry: (generationId: string) =>
    api.post<{ jobId: string; generationId: string; status: string; message: string }>(
      `/api/v1/generations/${generationId}/retry`
    ),
};

// Preview Image Types (for I2V two-step workflow)
export interface PreviewImageRequest {
  video_prompt: string;
  image_description: string;
  aspect_ratio?: string;
  style?: string;
  negative_prompt?: string;
  product_image_url?: string;  // URL of the product image to include in generated scene
  composition_mode?: "direct" | "two_step";  // "two_step" generates scene first, then composites product
  hand_pose?: string;  // Description of how hands should hold the product (for two_step mode)
  campaign_id?: string;  // Optional: link this image to a specific campaign
  gemini_image_prompt?: string;  // Pre-generated image prompt (skips I2V Agent if provided)
}

export interface PreviewImageResponse {
  preview_id: string;
  image_url: string;
  scene_image_url?: string;  // Only in two_step mode
  image_base64: string;
  scene_image_base64?: string;  // Only in two_step mode - for debugging
  gemini_image_prompt: string;
  composite_prompt?: string;  // Only in two_step mode
  aspect_ratio: string;
  composition_mode: "direct" | "two_step";
  message: string;
}

// Preview Image API (for I2V two-step workflow)
export const previewImageApi = {
  generate: (campaignId: string, data: PreviewImageRequest) =>
    api.post<PreviewImageResponse>(
      `/api/v1/campaigns/${campaignId}/generations/preview-image`,
      data as unknown as Record<string, unknown>
    ),

  // Generate preview without campaign (for /create page)
  // Now supports all PreviewImageRequest options including composition_mode and hand_pose
  generateWithoutCampaign: (data: PreviewImageRequest) =>
    api.post<PreviewImageResponse & { success: boolean }>(
      "/api/v1/ai/generate-preview-image",
      data as unknown as Record<string, unknown>
    ),

  // Generate image prompt only (without generating the actual image)
  // Used to preview the I2V agent's output before generating
  generateImagePrompt: (data: {
    video_prompt: string;
    image_description?: string;
    style?: string;
    aspect_ratio?: string;
  }) =>
    api.post<{
      success: boolean;
      image_prompt: string;
      style_notes: string;
      technical_specs: { aspectRatio?: string };
      consistency_markers: string[];
    }>("/api/v1/ai/generate-image-prompt", data as unknown as Record<string, unknown>),
};

// Prompt Alchemist API
export const promptApi = {
  transform: (data: PromptTransformRequest) =>
    api.post<PromptTransformResponse>(
      "/api/v1/prompts/transform",
      data as unknown as Record<string, unknown>
    ),
};

// Style Presets API
export const presetsApi = {
  getAll: (params?: { category?: string; active_only?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.active_only !== undefined)
      searchParams.set("active_only", params.active_only.toString());

    const query = searchParams.toString();
    return api.get<StylePresetList>(`/api/v1/presets${query ? `?${query}` : ""}`);
  },

  getById: (presetId: string) => api.get<StylePreset>(`/api/v1/presets/${presetId}`),
};

// Batch Generation API
export const batchApi = {
  create: (campaignId: string, data: BatchGenerationRequest) =>
    api.post<BatchGenerationResponse>(
      `/api/v1/campaigns/${campaignId}/generations/batch`,
      data as unknown as Record<string, unknown>
    ),

  getStatus: (campaignId: string, batchId: string) =>
    api.get<BatchStatusResponse>(
      `/api/v1/campaigns/${campaignId}/generations/batch?batch_id=${batchId}`
    ),
};

// Scoring API
export const scoringApi = {
  scoreGeneration: (
    generationId: string,
    options?: { weights?: Record<string, number>; trend_keywords?: string[] }
  ) =>
    api.post<ScoringResult>(
      `/api/v1/generations/${generationId}/score`,
      options as unknown as Record<string, unknown>
    ),

  getScore: (generationId: string) =>
    api.get<ScoringResult>(`/api/v1/generations/${generationId}/score`),

  scoreAllInCampaign: (
    campaignId: string,
    options?: {
      weights?: Record<string, number>;
      trend_keywords?: string[];
      only_unscored?: boolean;
    }
  ) =>
    api.post<ScoreAllResponse>(
      `/api/v1/campaigns/${campaignId}/generations/score-all`,
      options as unknown as Record<string, unknown>
    ),
};

// Caption Types
export type CaptionLanguage = "ko" | "en" | "ja";
export type CaptionStyle = "engaging" | "question" | "story" | "minimal" | "professional";
export type CaptionPlatform = "tiktok" | "youtube" | "instagram";

export interface GeneratedCaption {
  caption: string;
  hashtags: string[];
  emojis: string[];
  callToAction?: string;
  hookLine?: string;
  seoScore: number;
}

export interface CaptionResult {
  primary: GeneratedCaption;
  alternatives: GeneratedCaption[];
  platformOptimized: Record<CaptionPlatform, GeneratedCaption>;
  metadata: {
    language: CaptionLanguage;
    style: CaptionStyle;
    generatedAt: string;
    trendKeywordsUsed: string[];
  };
}

export interface CaptionResponse {
  generation_id: string;
  quick?: boolean;
  result: CaptionResult | { caption: string; hashtags: string[] };
}

export interface HashtagsResponse {
  hashtags: string[];
  categorized: {
    artist: string[];
    trending: string[];
    general: string[];
  };
  count: number;
  platform: CaptionPlatform;
}

// Compose Types
export interface ComposeOptions {
  audio_asset_id: string;
  audio_start_time?: number; // Start time in audio file (seconds)
  audio_volume?: number; // 0.0 to 1.0
  fade_in?: number; // Fade in duration (seconds)
  fade_out?: number; // Fade out duration (seconds)
  mix_original_audio?: boolean; // Mix with original video audio
  original_audio_volume?: number; // Original audio volume if mixing
}

export interface ComposeResponse {
  id: string;
  status: string;
  output_url: string;
  original_video_url: string;
  duration: number;
  composition: {
    audio_asset_id: string;
    audio_start_time: number;
    audio_volume: number;
    fade_in: number;
    fade_out: number;
    mix_original_audio: boolean;
  };
  message: string;
}

export interface ComposeInfoResponse {
  id: string;
  has_output_video: boolean;
  is_composed: boolean;
  ffmpeg_available: boolean;
  composition: {
    audio_asset_id: string;
    audio_asset_name: string;
    audio_start_time: number;
    audio_volume: number;
    fade_in: number;
    fade_out: number;
    mixed_original_audio: boolean;
    composed_at: string;
    original_video_url: string;
  } | null;
}

// Compose API - Video + Audio composition
export const composeApi = {
  // Compose video with audio
  compose: (generationId: string, options: ComposeOptions) =>
    api.post<ComposeResponse>(
      `/api/v1/generations/${generationId}/compose`,
      options as unknown as Record<string, unknown>
    ),

  // Get composition info/status
  getInfo: (generationId: string) =>
    api.get<ComposeInfoResponse>(`/api/v1/generations/${generationId}/compose`),
};

// Video Analysis Types (TikTok Style Analysis)
export interface VideoStyleAnalysis {
  visual_style: string;
  color_palette: string[];
  lighting: string;
  camera_movement: string[];
  transitions: string[];
  mood: string;
  pace: string;
  effects: string[];
}

export interface VideoContentAnalysis {
  main_subject: string;
  actions: string[];
  setting: string;
  props: string[];
  clothing_style: string;
}

export interface VideoAnalysisMetadata {
  id: string;
  description: string;
  hashtags: string[];
  author: {
    username: string;
    nickname: string;
  };
  music?: {
    title: string;
    author: string;
  };
  stats: {
    plays: number;
    likes: number;
    comments: number;
    shares: number;
  };
  duration: number;
  thumbnail_url: string;
  video_url: string;
}

export interface VideoAnalysisPromptElements {
  style_keywords: string[];
  mood_keywords: string[];
  action_keywords: string[];
  technical_suggestions: {
    aspect_ratio: string;
    duration: number;
    camera_style: string;
  };
}

export interface VideoAnalysisResult {
  metadata?: VideoAnalysisMetadata;
  style_analysis?: VideoStyleAnalysis;
  content_analysis?: VideoContentAnalysis;
  suggested_prompt?: string;
  prompt_elements?: VideoAnalysisPromptElements;
}

export interface VideoAnalysisResponse {
  success: boolean;
  data?: VideoAnalysisResult;
  error?: string;
}

// Video Analysis API (TikTok Analysis)
export const videoAnalysisApi = {
  analyze: (url: string) =>
    api.post<VideoAnalysisResponse>(
      "/api/v1/analyze-video",
      { url } as Record<string, unknown>
    ),
};

// Caption API
export const captionApi = {
  // Generate caption for a video generation
  generate: (
    generationId: string,
    options?: {
      style?: CaptionStyle;
      language?: CaptionLanguage;
      platform?: CaptionPlatform;
      trend_keywords?: string[];
      quick?: boolean;
    }
  ) =>
    api.post<CaptionResponse>(
      `/api/v1/generations/${generationId}/caption`,
      options as unknown as Record<string, unknown>
    ),

  // Get saved caption for a generation
  get: (generationId: string) =>
    api.get<{
      generation_id: string;
      has_caption: boolean;
      caption: {
        primary: GeneratedCaption;
        generatedAt: string;
        language: CaptionLanguage;
        style: CaptionStyle;
      } | null;
    }>(`/api/v1/generations/${generationId}/caption`),

  // Generate hashtags only
  generateHashtags: (options: {
    topic: string;
    artist_name?: string;
    group_name?: string;
    trend_keywords?: string[];
    platform?: CaptionPlatform;
    count?: number;
  }) =>
    api.post<HashtagsResponse>(
      "/api/v1/captions/hashtags",
      options as unknown as Record<string, unknown>
    ),
};

// Auto-publish configuration for variations
export interface AutoPublishConfig {
  social_account_id: string | null;
  interval_minutes: number;
  caption?: string;
  hashtags?: string[];
}

// Variation Generation Types
export interface VariationConfigRequest {
  style_categories?: string[];
  enable_prompt_variation?: boolean;
  prompt_variation_types?: ("camera" | "expression")[];
  max_variations?: number;
  auto_publish?: AutoPublishConfig;
  preset_ids?: string[]; // Direct preset IDs for 1:1 variation mapping
}

export interface VariationItem {
  id: string;
  variation_label: string;
  applied_presets: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  prompt_modification?: string;
  status: VideoGenerationStatus;
}

export interface CreateVariationsResponse {
  seed_generation_id: string;
  batch_id: string;
  total_count: number;
  variations: VariationItem[];
  message: string;
}

export interface VariationBatchStatus {
  batch_id: string;
  seed_generation_id: string;
  batch_status: "pending" | "processing" | "completed" | "partial_failure";
  overall_progress: number;
  total: number;
  completed: number;
  failed: number;
  variations: Array<VariationItem & {
    generation?: VideoGeneration;
  }>;
}

// Variations API
export const variationsApi = {
  // Create variations from a seed generation
  create: (generationId: string, config: VariationConfigRequest) =>
    api.post<CreateVariationsResponse>(
      `/api/v1/generations/${generationId}/variations`,
      config as unknown as Record<string, unknown>
    ),

  // Get variation batch status
  getStatus: (generationId: string, batchId: string) =>
    api.get<VariationBatchStatus>(
      `/api/v1/generations/${generationId}/variations?batch_id=${batchId}`
    ),
};

// Compose Variations Types
export interface ComposeVariationConfigRequest {
  variation_count?: number; // Number of variations to create (default: 4)
  tag_count?: number; // Number of tags to use per variation (default: 2-3)
  // Compose-specific variation options
  effect_presets?: string[]; // Effect presets to apply (zoom_beat, crossfade, etc.)
  color_grades?: string[]; // Color grading presets (warm, cool, vintage, etc.)
  text_styles?: string[]; // Text overlay styles (minimal, bold, animated, etc.)
  vibe_variations?: string[]; // Vibe/mood variations (exciting, emotional, pop, etc.)
  auto_publish?: AutoPublishConfig;
}

export interface ComposeVariationItem {
  variation_id: string;
  search_tags: string[];
  status: "pending" | "processing" | "completed" | "failed";
  output_url?: string;
  error_message?: string;
}

export interface CreateComposeVariationsResponse {
  seed_generation_id: string;
  batch_id: string;
  total_count: number;
  variations: ComposeVariationItem[];
  message: string;
}

// Compose Variations API - for slideshow videos (image search + compose)
export const composeVariationsApi = {
  // Create variations by re-searching images with different tag combinations
  create: (generationId: string, config?: ComposeVariationConfigRequest) =>
    api.post<CreateComposeVariationsResponse>(
      `/api/v1/generations/${generationId}/compose-variations`,
      (config || {}) as unknown as Record<string, unknown>
    ),
};

// Video Edit Types
export interface SubtitleLine {
  text: string;
  start: number;
  end: number;
}

export interface SubtitleStyle {
  font_size?: "small" | "medium" | "large";
  font_style?: "bold" | "modern" | "minimal" | "classic";
  color?: string;
  stroke_color?: string;
  stroke_width?: number;
  animation?: "fade" | "typewriter" | "karaoke" | "slide_up" | "scale_pop" | "bounce" | "glitch" | "wave";
  position?: "top" | "center" | "bottom";
  bottom_margin?: number;
  // Display mode: 'sequential' (default) shows subtitles one at a time
  // 'static' shows all subtitles at once and keeps them visible
  display_mode?: "sequential" | "static";
}

export interface VideoEditAudioSettings {
  asset_id: string;
  start_time?: number;
  volume?: number;
  fade_in?: number;
  fade_out?: number;
}

export interface VideoEditSubtitleSettings {
  lines: SubtitleLine[];
  style?: SubtitleStyle;
}

export interface VideoEditRequest {
  audio?: VideoEditAudioSettings;
  subtitles?: VideoEditSubtitleSettings;
}

export interface VideoEditResponse {
  id: string;
  job_id: string;
  original_generation_id: string;
  status: string;
  message: string;
  edit_options: {
    has_audio: boolean;
    has_subtitles: boolean;
    audio_asset_name?: string;
    subtitle_line_count: number;
  };
}

export interface VideoEditInfoResponse {
  id: string;
  has_output_video: boolean;
  output_url: string | null;
  is_edited: boolean;
  status: string;
  progress: number;
  error_message: string | null;
  audio_asset: {
    id: string;
    filename: string;
    original_filename: string;
  } | null;
  video_edit: {
    original_generation_id: string;
    original_output_url: string;
    edited_at: string;
    edit_type: string[];
    audio_asset_id?: string;
    audio_asset_name?: string;
    has_subtitles: boolean;
    subtitle_line_count: number;
  } | null;
}

// Video Edit API - Add audio and subtitles to existing videos
export const videoEditApi = {
  // Edit video with audio and/or subtitles (creates new generation)
  edit: (generationId: string, options: VideoEditRequest) =>
    api.post<VideoEditResponse>(
      `/api/v1/generations/${generationId}/edit`,
      options as unknown as Record<string, unknown>
    ),

  // Get edit info/status
  getInfo: (generationId: string) =>
    api.get<VideoEditInfoResponse>(`/api/v1/generations/${generationId}/edit`),
};

// Quick Create Types
export interface QuickCreateRequest {
  prompt: string;
  negative_prompt?: string;
  duration_seconds?: number;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  reference_style?: string;
  enable_i2v?: boolean;
  image_description?: string;
}

export interface QuickCreateGeneration {
  id: string;
  is_quick_create: boolean;
  campaign_id: string | null;
  prompt: string;
  negative_prompt: string | null;
  duration_seconds: number;
  aspect_ratio: string;
  reference_style: string | null;
  status: VideoGenerationStatus;
  progress: number;
  error_message: string | null;
  output_url: string | null;
  quality_score: number | null;
  quality_metadata: Record<string, unknown> | null;
  is_favorite: boolean;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuickCreateListResponse {
  items: QuickCreateGeneration[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SaveToCampaignResponse {
  id: string;
  campaign_id: string;
  is_quick_create: boolean;
  prompt: string;
  status: string;
  output_url: string | null;
  message: string;
}

// Quick Create API - Independent video generation without campaign
export const quickCreateApi = {
  // Create a new Quick Create generation
  create: (options: QuickCreateRequest) =>
    api.post<QuickCreateGeneration & { message: string }>(
      "/api/v1/quick-create",
      options as unknown as Record<string, unknown>
    ),

  // List user's Quick Create generations
  list: (page = 1, pageSize = 20) =>
    api.get<QuickCreateListResponse>(
      `/api/v1/quick-create?page=${page}&page_size=${pageSize}`
    ),

  // Get a specific Quick Create generation
  get: (generationId: string) =>
    api.get<QuickCreateGeneration>(`/api/v1/quick-create/${generationId}`),

  // Save Quick Create generation to a campaign
  saveToCampaign: (generationId: string, campaignId: string) =>
    api.post<SaveToCampaignResponse>(
      `/api/v1/quick-create/${generationId}/save-to-campaign`,
      { campaign_id: campaignId }
    ),
};

// Video Extension Types (Veo 3.1)
export interface VideoExtendRequest {
  prompt?: string; // Optional prompt describing how to continue the video
  apply_audio_after?: boolean; // Apply original audio after extension
  audio_asset_id?: string; // Audio asset to apply after extension
}

export interface VideoExtendInfo {
  current_extension_count: number;
  max_extensions: number;
  remaining_extensions: number;
  has_gcs_uri?: boolean;
  is_ai_generated?: boolean;
  is_completed?: boolean;
}

export interface VideoExtendResponse {
  id: string;
  job_id: string;
  original_generation_id: string;
  status: string;
  message: string;
  extension_info: VideoExtendInfo & {
    estimated_duration_seconds: number;
  };
}

export interface VideoExtendInfoResponse {
  id: string;
  can_extend: boolean;
  // Original prompt for continuation context
  original_prompt?: string;
  negative_prompt?: string | null;
  duration_seconds?: number;
  aspect_ratio?: string;
  // Audio info for post-extension overlay
  audio_asset_id?: string | null;
  extension_info: VideoExtendInfo;
  reasons_cannot_extend: {
    not_completed?: boolean;
    not_ai_generated?: boolean;
    no_gcs_uri?: boolean;
    max_extensions_reached?: boolean;
  } | null;
}

// Extension History Types
export interface ExtensionHistoryVideo {
  id: string;
  status: string;
  duration_seconds: number;
  extension_count: number;
  output_url: string | null;
  has_gcs_uri: boolean;
  created_at: string;
}

export interface ExtensionHistoryRecord {
  history_id: string;
  extension_number: number;
  prompt: string | null;
  duration_before: number;
  duration_after: number;
  created_at: string;
}

export interface ExtensionChainVideo {
  id: string;
  extension_number: number;
  duration_seconds: number;
  status: string;
  output_url: string | null;
  has_gcs_uri: boolean;
  is_current: boolean;
  created_at: string;
}

export interface ExtensionHistoryResponse {
  generation_id: string;
  extension_count: number;
  duration_seconds: number;
  // Videos extended FROM this video
  extensions_from_this: Array<ExtensionHistoryRecord & {
    extended_video: ExtensionHistoryVideo;
  }>;
  // The video this was extended FROM (if any)
  extended_from: (ExtensionHistoryRecord & {
    source_video: ExtensionHistoryVideo;
  }) | null;
  // Full chain from root to all leaves
  full_chain: {
    root_id: string;
    total_extensions: number;
    total_duration_added: number;
    videos: ExtensionChainVideo[];
  } | null;
}

// Extension Prompt Generation Types
export interface ExtensionPromptGenerateRequest {
  user_idea: string;
}

export interface ExtensionPromptGenerateResponse {
  success: boolean;
  original_prompt: string;
  user_idea: string;
  generated: {
    enhanced_prompt: string;
    continuity_notes: string;
    visual_consistency: {
      preservedElements: string[];
      transitionType: 'seamless' | 'cut' | 'fade' | 'action';
      matchingDetails: string;
    };
    cinematic_breakdown: {
      subject: string;
      action: string;
      environment: string;
      lighting: string;
      camera: string;
      mood: string;
    };
    audio_suggestions?: {
      ambientSound?: string;
      soundEffects?: string;
    };
    warnings: string[];
    safety_score: number;
  };
}

// Generation Status Response (for polling)
export interface GenerationStatusResponse {
  id: string;
  status: VideoGenerationStatus;
  progress: number;
  duration_seconds: number;
  aspect_ratio: string;
  output_url: string | null;
  gcs_uri: string | null;
  extension_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// AI Job Poll Response (from compose-engine via Vercel)
export interface AIJobPollResponse {
  job_id: string;
  generation_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  output_url: string | null;
  gcs_uri?: string | null;
  progress: number;
  current_step?: string;
  is_final: boolean;
}

// Video Extension API - Extend AI-generated videos by up to 7 seconds (Veo 3.1)
export const videoExtendApi = {
  // Extend an AI-generated video
  extend: (generationId: string, options?: VideoExtendRequest) =>
    api.post<VideoExtendResponse>(
      `/api/v1/generations/${generationId}/extend`,
      (options || {}) as unknown as Record<string, unknown>
    ),

  // Get extension info for a generation
  getInfo: (generationId: string) =>
    api.get<VideoExtendInfoResponse>(`/api/v1/generations/${generationId}/extend`),

  // Get generation status (for polling during extension) - reads from DB
  getStatus: (generationId: string) =>
    api.get<GenerationStatusResponse>(`/api/v1/generations/${generationId}`),

  // Poll AI job status from compose-engine and update DB
  // This is the preferred method for reliable status updates during extension
  pollJobStatus: (jobId: string) =>
    api.post<AIJobPollResponse>(`/api/v1/ai/jobs/${jobId}/poll`),

  // Get extension history/lineage for a generation
  getHistory: (generationId: string) =>
    api.get<ExtensionHistoryResponse>(`/api/v1/generations/${generationId}/extend/history`),

  // Generate enhanced extension prompt using AI
  generatePrompt: (generationId: string, userIdea: string) =>
    api.post<ExtensionPromptGenerateResponse>(
      `/api/v1/generations/${generationId}/extend/generate-prompt`,
      { user_idea: userIdea }
    ),
};
