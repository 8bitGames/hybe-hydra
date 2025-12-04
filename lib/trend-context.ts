/**
 * Trend Context Storage Utility
 *
 * Stores trend video/analysis data in sessionStorage for use in Create flows.
 * This enables users to use trending video metadata to generate new content.
 */

export interface TrendVideoContext {
  // Source identification
  source: "trending" | "keyword_analysis";
  keyword?: string; // The search keyword (for keyword analysis)

  // Video information
  video: {
    id: string;
    url: string;
    thumbnailUrl: string | null;
    description: string;
    authorId: string;
    authorName: string;
  };

  // Engagement stats
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    engagementRate: number;
  };

  // Content metadata
  hashtags: string[];

  // AI Insights (if available from keyword analysis)
  aiInsights?: {
    summary: string;
    contentStrategy: string[];
    hashtagStrategy: string[];
    captionTemplates: string[];
    videoIdeas: string[];
    bestPostingAdvice: string;
    audienceInsights: string;
    trendPrediction: string;
  };

  // Recommendations
  recommendations?: {
    suggestedHashtags: string[];
    contentTips: string[];
    optimalHashtagCount: number;
  };

  // Timestamp
  createdAt: string;
}

const STORAGE_KEY = "hydra_trend_context";

/**
 * Store trend context and return a key
 */
export function storeTrendContext(context: TrendVideoContext): string {
  const key = `trend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const data = {
    key,
    context,
    expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour expiry
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to store trend context:", e);
  }

  return key;
}

/**
 * Get stored trend context
 */
export function getTrendContext(): TrendVideoContext | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Check expiry
    if (data.expiresAt && Date.now() > data.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data.context as TrendVideoContext;
  } catch (e) {
    console.error("Failed to get trend context:", e);
    return null;
  }
}

/**
 * Clear stored trend context
 */
export function clearTrendContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear trend context:", e);
  }
}

/**
 * Check if there's an active trend context
 */
export function hasTrendContext(): boolean {
  return getTrendContext() !== null;
}

/**
 * Generate a suggested prompt from trend context for AI generation
 */
export function generatePromptFromContext(context: TrendVideoContext): string {
  const parts: string[] = [];

  // Start with a general description based on the video
  if (context.video.description) {
    // Clean up the description - remove hashtags and mentions
    const cleanDesc = context.video.description
      .replace(/#\w+/g, "")
      .replace(/@\w+/g, "")
      .trim()
      .slice(0, 200);
    if (cleanDesc) {
      parts.push(`Create a video inspired by: "${cleanDesc}"`);
    }
  }

  // Add trending context
  if (context.keyword) {
    parts.push(`This should capture the trending style for "${context.keyword}" content.`);
  }

  // Add AI insights if available
  if (context.aiInsights?.contentStrategy && context.aiInsights.contentStrategy.length > 0) {
    parts.push(`Key style elements: ${context.aiInsights.contentStrategy[0]}`);
  }

  // Add mood/vibe from hashtags
  if (context.hashtags.length > 0) {
    const relevantTags = context.hashtags
      .filter(tag => !tag.toLowerCase().includes("fyp") && !tag.toLowerCase().includes("viral"))
      .slice(0, 3);
    if (relevantTags.length > 0) {
      parts.push(`Incorporate themes: ${relevantTags.join(", ")}`);
    }
  }

  return parts.join(" ") || "Create an engaging TikTok-style video with high energy and dynamic visuals.";
}

/**
 * Get suggested hashtags from context
 */
export function getSuggestedHashtags(context: TrendVideoContext): string[] {
  const hashtags: Set<string> = new Set();

  // Add video's original hashtags
  context.hashtags.forEach(tag => hashtags.add(tag.toLowerCase().replace(/^#/, "")));

  // Add recommended hashtags from analysis
  if (context.recommendations?.suggestedHashtags) {
    context.recommendations.suggestedHashtags.forEach(tag =>
      hashtags.add(tag.toLowerCase().replace(/^#/, ""))
    );
  }

  // Add keyword as hashtag
  if (context.keyword) {
    hashtags.add(context.keyword.toLowerCase());
  }

  return Array.from(hashtags).slice(0, 10);
}
