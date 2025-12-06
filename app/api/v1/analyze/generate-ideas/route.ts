/**
 * Analyze Generate Ideas API
 * ==========================
 * Uses CreativeDirectorAgent for trend-following content idea generation
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createCreativeDirectorAgent } from "@/lib/agents/creators/creative-director";
import { AgentContext } from "@/lib/agents/types";

// ============================================================================
// Types
// ============================================================================

// Video content for trend analysis
interface InspirationVideo {
  id: string;
  description?: string;
  hashtags?: string[];
  stats?: {
    playCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
  engagementRate?: number;
}

// AI insights from discover phase
interface TrendInsights {
  summary?: string;
  contentStrategy?: string[];
  videoIdeas?: string[];
  targetAudience?: string[];
  bestPostingTimes?: string[];
}

interface GenerateIdeasRequest {
  user_idea: string;
  keywords: string[];
  hashtags: string[];
  target_audience: string[];
  content_goals: string[];
  // Rich trend data (instead of just a count)
  inspiration_videos?: InspirationVideo[];
  trend_insights?: TrendInsights;
  performance_metrics?: {
    avgViews: number;
    avgEngagement: number;
    viralBenchmark: number;
  } | null;
  // Artist/Brand context
  artistName?: string;
  language?: "ko" | "en";
}

interface ContentIdea {
  id: string;
  type: "ai_video" | "compose";
  title: string;
  hook: string;
  description: string;
  estimatedEngagement: "high" | "medium" | "low";
  optimizedPrompt: string;
  suggestedMusic?: {
    bpm: number;
    genre: string;
  };
  scriptOutline?: string[];
}

interface GenerateIdeasResponse {
  success: boolean;
  ideas: ContentIdea[];
  optimized_hashtags: string[];
  content_strategy: string;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateIdeasRequest = await request.json();

    const {
      user_idea,
      keywords,
      hashtags,
      target_audience,
      content_goals,
      inspiration_videos,
      trend_insights,
      performance_metrics,
      artistName = "Brand",
      language = "ko",
    } = body;

    // Build strategy from trend data
    const strategy = buildStrategyFromTrends({
      keywords,
      hashtags,
      inspiration_videos,
      trend_insights,
    });

    // Create agent and context
    const creativeDirector = createCreativeDirectorAgent();

    const agentContext: AgentContext = {
      workflow: {
        artistName,
        platform: "tiktok",
        language,
        sessionId: `analyze-ideas-${Date.now()}`,
      },
      discover: {
        contentStrategy: strategy,
        inspirationVideos: inspiration_videos,
        trendInsights: trend_insights,
      },
    };

    // Execute agent
    const agentResult = await creativeDirector.execute(
      {
        userIdea: user_idea || undefined,
        strategy: strategy,
        audience: target_audience.length > 0 ? target_audience.join(", ") : undefined,
        goals: content_goals.length > 0 ? content_goals : undefined,
        benchmarks: performance_metrics ? {
          avgViews: performance_metrics.avgViews,
          avgEngagement: performance_metrics.avgEngagement,
          topPerformers: extractTopPerformers(inspiration_videos),
        } : undefined,
      },
      agentContext
    );

    // Check if agent execution was successful
    if (!agentResult.success || !agentResult.data) {
      console.error("Agent execution failed:", agentResult.error);
      return NextResponse.json(
        {
          success: false,
          error: agentResult.error || "Failed to generate ideas",
        },
        { status: 500 }
      );
    }

    const output = agentResult.data;

    // Transform agent output to API response format
    const ideas: ContentIdea[] = output.ideas.map((idea) => ({
      id: uuidv4(),
      type: "ai_video" as const,
      title: idea.title,
      hook: idea.hook,
      description: idea.description,
      estimatedEngagement: idea.estimatedEngagement,
      optimizedPrompt: idea.optimizedPrompt,
      suggestedMusic: idea.suggestedMusic,
      scriptOutline: idea.scriptOutline,
    }));

    return NextResponse.json({
      success: true,
      ideas,
      optimized_hashtags: output.optimizedHashtags,
      content_strategy: output.contentStrategy,
    } as GenerateIdeasResponse);
  } catch (error) {
    console.error("Generate ideas error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate ideas",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build strategy object from trend data for the agent
 */
function buildStrategyFromTrends(params: {
  keywords: string[];
  hashtags: string[];
  inspiration_videos?: InspirationVideo[];
  trend_insights?: TrendInsights;
}): {
  contentThemes: Array<{ theme: string; priority: number; rationale: string }>;
  visualGuidelines: {
    styles: string[];
    colors: string[];
    pace: string;
    effects: string[];
  };
  captionGuidelines: {
    hooks: string[];
    ctas: string[];
    hashtags: string[];
  };
} {
  const { keywords, hashtags, inspiration_videos, trend_insights } = params;

  // Extract themes from keywords and trend insights
  const themes: Array<{ theme: string; priority: number; rationale: string }> = [];

  // Add keyword-based themes
  keywords.slice(0, 3).forEach((keyword, index) => {
    themes.push({
      theme: keyword,
      priority: 5 - index,
      rationale: `Trending keyword from TikTok analysis`,
    });
  });

  // Add themes from trend insights
  if (trend_insights?.videoIdeas) {
    trend_insights.videoIdeas.slice(0, 2).forEach((idea, index) => {
      themes.push({
        theme: idea,
        priority: 3 - index,
        rationale: "AI-suggested trend-based idea",
      });
    });
  }

  // Extract hooks from inspiration videos
  const hooks: string[] = [];
  if (inspiration_videos) {
    inspiration_videos.slice(0, 5).forEach((video) => {
      if (video.description) {
        // Extract first sentence as potential hook
        const firstSentence = video.description.split(/[.!?\n]/)[0]?.trim();
        if (firstSentence && firstSentence.length < 100) {
          hooks.push(firstSentence);
        }
      }
    });
  }

  // Default hooks if none extracted
  if (hooks.length === 0) {
    hooks.push(
      "POV: ...",
      "Wait for it...",
      "이거 실화야?",
      "Nobody expected this"
    );
  }

  return {
    contentThemes: themes.length > 0 ? themes : [
      { theme: "Trending content", priority: 5, rationale: "General TikTok trends" }
    ],
    visualGuidelines: {
      styles: ["TikTok native", "vertical 9:16", "fast-paced"],
      colors: ["vibrant", "high contrast"],
      pace: "fast",
      effects: ["zoom", "transitions", "text overlays"],
    },
    captionGuidelines: {
      hooks: hooks.slice(0, 5),
      ctas: [
        "Follow for more!",
        "팔로우하고 더 보기!",
        "Comment below!",
        "Save this!",
      ],
      hashtags: hashtags.slice(0, 10),
    },
  };
}

/**
 * Extract top performer descriptions from inspiration videos
 */
function extractTopPerformers(videos?: InspirationVideo[]): string[] {
  if (!videos || videos.length === 0) return [];

  return videos
    .filter((v) => v.description && v.stats?.playCount)
    .sort((a, b) => (b.stats?.playCount || 0) - (a.stats?.playCount || 0))
    .slice(0, 3)
    .map((v) => {
      const views = v.stats?.playCount
        ? `${(v.stats.playCount / 1000000).toFixed(1)}M views`
        : "";
      return `${v.description?.slice(0, 100)}... (${views})`;
    });
}
