import { api } from "./api";

// Types
export type TrendPlatform = "TIKTOK" | "YOUTUBE" | "INSTAGRAM";

export interface TrendSnapshot {
  id: string;
  platform: TrendPlatform;
  keyword: string;
  rank: number;
  view_count: string | null;
  video_count: number | null;
  description: string | null;
  hashtags: string[];
  metadata: Record<string, unknown> | null;
  trend_url: string | null;
  thumbnail_url: string | null;
  collected_at: string;
}

export interface TrendsListResponse {
  region: string;
  time_range_hours: number;
  total_count: number;
  platform_stats: Array<{
    platform: TrendPlatform;
    count: number;
  }>;
  trends: TrendSnapshot[] | Record<TrendPlatform, TrendSnapshot[]>;
}

export interface PlatformTrendsResponse {
  platform: TrendPlatform;
  region: string;
  time_range_hours: number;
  total_count: number;
  statistics: {
    total_view_count: string;
    average_video_count: number;
  };
  trends: TrendSnapshot[];
}

export interface TrendSuggestion {
  keyword: string;
  platform: TrendPlatform;
  rank: number;
  prompt_template: string;
  hashtags: string[];
  relevance_score: number;
}

export interface TrendSuggestionsResponse {
  region: string;
  platform: string;
  artist_context: string | null;
  suggestion_count: number;
  suggestions: TrendSuggestion[];
}

export interface CreateTrendsRequest {
  trends: Array<{
    platform: TrendPlatform;
    keyword: string;
    rank: number;
    region?: string;
    view_count?: string | number;
    video_count?: number;
    description?: string;
    hashtags?: string[];
    metadata?: Record<string, unknown>;
    trend_url?: string;
    thumbnail_url?: string;
  }>;
}

export interface CreateTrendsResponse {
  message: string;
  created_count: number;
}

// Text Trend Analysis Types
export interface HashtagAnalysis {
  hashtag: string;
  count: number;
  avgLikes: number;
  totalLikes: number;
}

export interface HashtagCluster {
  theme: string;
  hashtags: string[];
  popularity: number;
  description: string;
}

export interface TextTrendAnalysisResponse {
  success: boolean;
  cached: boolean;
  analysis: {
    topHashtags: HashtagAnalysis[];
    hashtagClusters: HashtagCluster[];
    topicThemes: string[];
    commonPhrases: Array<{ phrase: string; frequency: number; avgEngagement: number }>;
    sentimentTrend: "positive" | "neutral" | "negative";
    metrics: {
      totalVideos: number;
      avgLikes: number;
      avgComments: number;
      avgShares: number;
    };
    contentSuggestions: {
      captionTemplates: string[];
      hashtagStrategy: {
        primary: string[];
        secondary: string[];
        niche: string[];
      };
      toneRecommendation: string;
      contentThemes: string[];
    };
  };
  analyzedAt: string;
  expiresAt: string;
}

// Video Trend Analysis Types
export interface PromptTemplate {
  template: string;
  style: string;
  useCase: string;
}

export interface VideoTrendAnalysisResponse {
  success: boolean;
  cached: boolean;
  analysis: {
    visualPatterns: {
      dominantStyles: string[];
      colorPalettes: string[][];
      lightingPatterns: string[];
      cameraMovements: string[];
      transitionStyles: string[];
    };
    contentPatterns: {
      commonSubjects: string[];
      settingTypes: string[];
      propCategories: string[];
    };
    dominantMood: string;
    averagePace: string;
    effectsTrending: string[];
    videoRecommendations: {
      promptTemplates: PromptTemplate[];
      styleGuidelines: {
        visualStyle: string;
        mood: string;
        pace: string;
        effects: string[];
      };
      technicalSpecs: {
        aspectRatio: string;
        duration: number;
        cameraStyle: string;
      };
    };
    analyzedVideoIds: string[];
    videosAnalyzed: number;
    trendScore: number;
  };
  analyzedAt: string;
  expiresAt: string;
}

// Trend Report Types
export interface TrendReportResponse {
  success: boolean;
  cached: boolean;
  report: {
    searchQuery: string;
    platform: TrendPlatform;
    trendScore: number;
    trendDirection: "rising" | "stable" | "declining";
    textGuide: {
      captionStyle: string;
      hashtags: {
        primary: string[];
        secondary: string[];
      };
      contentThemes: string[];
      toneRecommendation: string;
    };
    videoGuide: {
      visualStyle: string;
      promptTemplate: string;
      mood: string;
      pace: string;
      effects: string[];
      technicalSpecs: {
        aspectRatio: string;
        duration: number;
        cameraStyle: string;
      };
    };
    combinedStrategy: {
      summary: string;
      keyActions: string[];
      bestPractices: string[];
      doNot: string[];
    };
    targetAudience: string[];
    bestPostingTimes: {
      timezone: string;
      times: string[];
      days: string[];
    } | null;
    competitorInsights: {
      topCreators: string[];
      contentGaps: string[];
      differentiators: string[];
    } | null;
  };
  analyses?: {
    text: {
      topHashtags: HashtagAnalysis[];
      topicThemes: string[];
      metrics: {
        totalVideos: number;
        avgLikes: number;
        avgComments: number;
        avgShares: number;
      };
    } | null;
    video: {
      dominantStyles: string[];
      dominantMood: string;
      videosAnalyzed: number;
      trendScore: number;
    } | null;
  };
  createdAt: string;
  updatedAt: string;
}

// Bridge Format Response
export interface TrendBridgeFormatResponse {
  success: boolean;
  found: boolean;
  stale: boolean;
  bridge: {
    trendStyle: string;
    suggestedPrompt: string;
    hashtags: string[];
    styleMatch: {
      visual: string;
      mood: string;
      pace: string;
    };
  };
  updatedAt: string;
}

// Compose Format Response
export interface TrendComposeFormatResponse {
  success: boolean;
  found: boolean;
  stale: boolean;
  compose: {
    scriptSuggestions: string[];
    visualStyle: string;
    hashtags: {
      recommended: string[];
    };
    technicalSettings: {
      aspectRatio: string;
      duration: number;
      effects: string[];
    };
  };
  updatedAt: string;
}

// Trends API
export const trendsApi = {
  // Get all trends (optionally filtered by platform)
  getAll: (params?: {
    platform?: TrendPlatform;
    region?: string;
    limit?: number;
    hours_ago?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.platform) searchParams.set("platform", params.platform);
    if (params?.region) searchParams.set("region", params.region);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.hours_ago)
      searchParams.set("hours_ago", params.hours_ago.toString());

    const query = searchParams.toString();
    return api.get<TrendsListResponse>(
      `/api/v1/trends${query ? `?${query}` : ""}`
    );
  },

  // Get trends for a specific platform
  getByPlatform: (
    platform: TrendPlatform,
    params?: {
      region?: string;
      limit?: number;
      hours_ago?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.region) searchParams.set("region", params.region);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.hours_ago)
      searchParams.set("hours_ago", params.hours_ago.toString());

    const query = searchParams.toString();
    return api.get<PlatformTrendsResponse>(
      `/api/v1/trends/${platform.toLowerCase()}${query ? `?${query}` : ""}`
    );
  },

  // Get prompt suggestions based on trends
  getSuggestions: (params?: {
    platform?: TrendPlatform;
    region?: string;
    limit?: number;
    artist_id?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.platform) searchParams.set("platform", params.platform);
    if (params?.region) searchParams.set("region", params.region);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.artist_id) searchParams.set("artist_id", params.artist_id);

    const query = searchParams.toString();
    return api.get<TrendSuggestionsResponse>(
      `/api/v1/trends/suggestions${query ? `?${query}` : ""}`
    );
  },

  // Create new trend snapshots (admin only)
  create: (data: CreateTrendsRequest) =>
    api.post<CreateTrendsResponse>(
      "/api/v1/trends",
      data as unknown as Record<string, unknown>
    ),

  // Analyze text trends (hashtags, descriptions, captions)
  analyzeText: (params: {
    searchQuery: string;
    platform?: TrendPlatform;
    maxVideos?: number;
    forceRefresh?: boolean;
  }) =>
    api.post<TextTrendAnalysisResponse>(
      "/api/v1/trends/analyze/text",
      params as unknown as Record<string, unknown>
    ),

  // Get cached text analysis
  getTextAnalysis: (params: {
    query: string;
    platform?: TrendPlatform;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set("query", params.query);
    if (params.platform) searchParams.set("platform", params.platform);
    return api.get<TextTrendAnalysisResponse>(
      `/api/v1/trends/analyze/text?${searchParams.toString()}`
    );
  },

  // Analyze video trends (visual styles, content patterns)
  analyzeVideo: (params: {
    searchQuery: string;
    platform?: TrendPlatform;
    maxVideos?: number;
    forceRefresh?: boolean;
  }) =>
    api.post<VideoTrendAnalysisResponse>(
      "/api/v1/trends/analyze/video",
      params as unknown as Record<string, unknown>
    ),

  // Get cached video analysis
  getVideoAnalysis: (params: {
    query: string;
    platform?: TrendPlatform;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set("query", params.query);
    if (params.platform) searchParams.set("platform", params.platform);
    return api.get<VideoTrendAnalysisResponse>(
      `/api/v1/trends/analyze/video?${searchParams.toString()}`
    );
  },

  // Generate comprehensive trend report
  generateReport: (params: {
    searchQuery: string;
    platform?: TrendPlatform;
    includeText?: boolean;
    includeVideo?: boolean;
    maxVideos?: number;
    maxVideoAnalysis?: number;
    forceRefresh?: boolean;
  }) =>
    api.post<TrendReportResponse>(
      "/api/v1/trends/analyze/report",
      params as unknown as Record<string, unknown>
    ),

  // Get cached trend report
  getReport: (params: {
    query: string;
    platform?: TrendPlatform;
    format?: "bridge" | "compose";
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set("query", params.query);
    if (params.platform) searchParams.set("platform", params.platform);
    if (params.format) searchParams.set("format", params.format);

    // Return different types based on format
    if (params.format === "bridge") {
      return api.get<TrendBridgeFormatResponse>(
        `/api/v1/trends/analyze/report?${searchParams.toString()}`
      );
    }
    if (params.format === "compose") {
      return api.get<TrendComposeFormatResponse>(
        `/api/v1/trends/analyze/report?${searchParams.toString()}`
      );
    }
    return api.get<TrendReportResponse>(
      `/api/v1/trends/analyze/report?${searchParams.toString()}`
    );
  },

  // Get report formatted for Bridge page
  getReportForBridge: (query: string, platform?: TrendPlatform) => {
    const searchParams = new URLSearchParams();
    searchParams.set("query", query);
    searchParams.set("format", "bridge");
    if (platform) searchParams.set("platform", platform);
    return api.get<TrendBridgeFormatResponse>(
      `/api/v1/trends/analyze/report?${searchParams.toString()}`
    );
  },

  // Get report formatted for Compose page
  getReportForCompose: (query: string, platform?: TrendPlatform) => {
    const searchParams = new URLSearchParams();
    searchParams.set("query", query);
    searchParams.set("format", "compose");
    if (platform) searchParams.set("platform", platform);
    return api.get<TrendComposeFormatResponse>(
      `/api/v1/trends/analyze/report?${searchParams.toString()}`
    );
  },
};

// Helper function to format view counts
export function formatViewCount(viewCount: string | null): string {
  if (!viewCount) return "-";
  const num = parseInt(viewCount, 10);
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Helper function to get platform icon/emoji
export function getPlatformIcon(platform: TrendPlatform): string {
  switch (platform) {
    case "TIKTOK":
      return "📱";
    case "YOUTUBE":
      return "▶️";
    case "INSTAGRAM":
      return "📷";
    default:
      return "🌐";
  }
}

// Helper function to get platform color
export function getPlatformColor(platform: TrendPlatform): string {
  switch (platform) {
    case "TIKTOK":
      return "#00f2ea";
    case "YOUTUBE":
      return "#ff0000";
    case "INSTAGRAM":
      return "#e1306c";
    default:
      return "#6b7280";
  }
}
