/**
 * Suggest Publish Content API
 * ==========================
 * Uses PublishOptimizerAgent for platform-specific content optimization
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { createPublishOptimizerAgent } from "@/lib/agents/publishers/publish-optimizer";
import type { AgentContext } from "@/lib/agents/types";

interface PublishContextMetadata {
  // From Discover stage
  trendKeywords?: string[];
  hashtags?: string[];
  performanceMetrics?: {
    avgViews: number;
    avgEngagement: number;
  };

  // From Analyze stage
  campaignName?: string;
  artistName?: string;
  userIdea?: string;
  targetAudience?: string[];
  contentGoals?: string[];
  selectedIdea?: {
    title: string;
    hook: string;
    description: string;
  };

  // From Create stage
  prompt?: string;
  generationType?: "AI" | "COMPOSE";

  // Video metadata
  duration?: number;
  aspectRatio?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      context,
      platform = "tiktok",
      language = "en",
    }: {
      context: PublishContextMetadata;
      platform?: "tiktok" | "instagram" | "youtube";
      language?: "en" | "ko";
    } = body;

    // Build content description from context
    const contentDescription = buildContentDescription(context);

    // Create agent and context
    const publishOptimizer = createPublishOptimizerAgent();

    const agentContext: AgentContext = {
      workflow: {
        artistName: context.artistName || "Brand",
        platform: platform === "youtube" ? "youtube_shorts" : platform,
        language,
        sessionId: `publish-${Date.now()}`,
      },
    };

    // Map platform for agent
    const agentPlatform = platform === "youtube" ? "youtube_shorts" : platform;

    // Execute agent
    const agentResult = await publishOptimizer.execute(
      {
        content: {
          title: context.selectedIdea?.title,
          description: contentDescription,
          hashtags: context.hashtags || [],
        },
        platform: agentPlatform as "tiktok" | "instagram" | "youtube_shorts" | "all",
        targetAudience: {
          region: language === "ko" ? "KR" : "US",
          interests: context.targetAudience,
        },
        publishingGoal: mapGoalToAgent(context.contentGoals),
      },
      agentContext
    );

    // Check if agent execution was successful
    if (!agentResult.success || !agentResult.data) {
      console.error("Agent execution failed:", agentResult.error);

      // Fallback response
      return NextResponse.json({
        success: true,
        caption: context.selectedIdea?.hook || context.userIdea || "Check out this video!",
        hashtags: context.hashtags?.slice(0, getHashtagLimit(platform)) || ["fyp", "viral", "trending"],
        reasoning: "Fallback response due to agent error",
        platform,
        language,
      });
    }

    const output = agentResult.data;

    // Clean up hashtags (remove # if present)
    const cleanedHashtags = output.optimizedContent.hashtags.map((h) =>
      h.replace(/^#/, "").toLowerCase()
    );

    return NextResponse.json({
      success: true,
      caption: output.optimizedContent.description,
      hashtags: cleanedHashtags.slice(0, getHashtagLimit(platform)),
      callToAction: output.optimizedContent.callToAction,
      reasoning: `Optimized for ${output.predictedPerformance.engagementRate} engagement rate with ${output.predictedPerformance.viralProbability} viral probability`,
      platform,
      language,
      // Additional data from agent
      bestPostingTimes: output.publishingStrategy.bestTimes,
      platformSettings: output.platformSpecific,
    });
  } catch (error) {
    console.error("AI suggest publish content error:", error);
    return NextResponse.json(
      {
        detail: "Failed to generate suggestions",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper Functions

function buildContentDescription(context: PublishContextMetadata): string {
  const parts: string[] = [];

  if (context.selectedIdea) {
    parts.push(`Concept: ${context.selectedIdea.title} - ${context.selectedIdea.hook}`);
    parts.push(context.selectedIdea.description);
  }

  if (context.userIdea) {
    parts.push(`Original idea: ${context.userIdea}`);
  }

  if (context.prompt) {
    parts.push(`Video prompt: ${context.prompt}`);
  }

  if (context.trendKeywords?.length) {
    parts.push(`Trending keywords: ${context.trendKeywords.join(", ")}`);
  }

  if (context.duration) {
    parts.push(`Duration: ${context.duration}s`);
  }

  return parts.join(". ") || "Short-form video content";
}

function mapGoalToAgent(
  goals?: string[]
): "engagement" | "reach" | "conversion" | "brand_awareness" {
  if (!goals?.length) return "engagement";

  const goalMap: Record<string, "engagement" | "reach" | "conversion" | "brand_awareness"> = {
    engagement: "engagement",
    reach: "reach",
    awareness: "brand_awareness",
    brand_awareness: "brand_awareness",
    conversion: "conversion",
    sales: "conversion",
    virality: "reach",
  };

  for (const goal of goals) {
    const lowerGoal = goal.toLowerCase();
    for (const [key, value] of Object.entries(goalMap)) {
      if (lowerGoal.includes(key)) {
        return value;
      }
    }
  }

  return "engagement";
}

function getHashtagLimit(platform: string): number {
  const limits: Record<string, number> = {
    tiktok: 8,
    instagram: 30,
    youtube: 15,
  };
  return limits[platform] || 8;
}
