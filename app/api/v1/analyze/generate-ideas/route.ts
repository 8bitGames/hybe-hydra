/**
 * Analyze Generate Ideas API
 * ==========================
 * Uses CreativeDirectorAgent for trend-following content idea generation
 *
 * Supports both regular and streaming responses:
 * - POST /api/v1/analyze/generate-ideas - Regular JSON response
 * - POST /api/v1/analyze/generate-ideas?stream=true - Server-Sent Events stream
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createCreativeDirectorAgent } from "@/lib/agents/creators/creative-director";
import { createFastCutIdeaAgent } from "@/lib/agents/creators/fast-cut-idea-agent";
import { createVideoRecreationIdeaAgent } from "@/lib/agents/creators/video-recreation-idea-agent";
import { AgentContext, ContentStrategy } from "@/lib/agents/types";

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

// Video analysis data from StartFromVideo
interface VideoAnalysisData {
  hookAnalysis?: string;
  styleAnalysis?: string;
  structureAnalysis?: string;
  suggestedApproach?: string;
  isComposeVideo?: boolean;
  imageCount?: number;
  conceptDetails?: {
    visualStyle?: string;
    colorPalette?: string[];
    lighting?: string;
    cameraMovement?: string[];
    transitions?: string[];
    effects?: string[];
    mood?: string;
    pace?: string;
    mainSubject?: string;
    actions?: string[];
    setting?: string;
    props?: string[];
    clothingStyle?: string;
  };
}

interface GenerateIdeasRequest {
  user_idea: string;
  keywords: string[];
  hashtags: string[];
  target_audience: string[];
  content_goals: string[];
  campaign_description?: string | null;  // Central context for all prompts - describes campaign concept/goal
  genre?: string | null;  // Music genre for viral content generation (e.g., pop, hiphop, ballad)
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
  // Content type - selected by user at Start stage (ai_video or fast-cut)
  contentType?: "ai_video" | "fast-cut";
  // Video analysis data (when started from video)
  video_analysis?: VideoAnalysisData | null;
  video_description?: string | null;
  video_hashtags?: string[] | null;
}

interface FastCutData {
  searchKeywords: string[];
  suggestedVibe: string;
  suggestedBpmRange: { min: number; max: number };
  scriptOutline: string[];
}

interface ContentIdea {
  id: string;
  type: "ai_video" | "fast-cut";
  title: string;
  hook: string;
  description: string;
  estimatedEngagement: "high" | "medium" | "low";
  // AI Video용 (VEO cinematic prompt)
  optimizedPrompt: string;
  // Fast Cut용 데이터
  fastCutData?: FastCutData;
  suggestedMusic?: {
    bpm: number;
    genre: string;
  };
  scriptOutline?: string[];
  // 영상 재현 아이디어 여부 (영상 기반 시작 시)
  isRecreationIdea?: boolean;
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

    // Check if streaming is requested
    const url = new URL(request.url);
    const isStreaming = url.searchParams.get("stream") === "true";

    const {
      user_idea,
      keywords,
      hashtags,
      target_audience,
      content_goals,
      campaign_description,
      genre,
      inspiration_videos,
      trend_insights,
      performance_metrics,
      artistName = "Brand",
      language = "ko",
      contentType = "ai_video",
      video_analysis,
      video_description,
      video_hashtags,
    } = body;

    // Build strategy from trend data
    const strategy = buildStrategyFromTrends({
      keywords,
      hashtags,
      inspiration_videos,
      trend_insights,
    });

    // Common agent context
    const agentContext: AgentContext = {
      workflow: {
        artistName,
        platform: "tiktok",
        language,
        genre: genre || undefined,
        sessionId: `analyze-ideas-${Date.now()}`,
      },
      discover: {
        contentStrategy: strategy,
        inspirationVideos: inspiration_videos,
        trendInsights: trend_insights,
      },
    };

    // ========================================================================
    // Branch: Fast Cut vs AI Video based on user-selected contentType
    // ========================================================================

    if (contentType === "fast-cut") {
      // Use FastCutIdeaAgent for slideshow-type content
      const fastCutAgent = createFastCutIdeaAgent();

      const fastCutInput = {
        userIdea: user_idea || undefined,
        campaignDescription: campaign_description || undefined,
        artistName,
        genre: genre || undefined,
        trendKeywords: keywords,
        language: language as "ko" | "en",
      };

      // Fast Cut doesn't support streaming yet
      const agentResult = await fastCutAgent.execute(fastCutInput, agentContext);

      if (!agentResult.success || !agentResult.data) {
        console.error("FastCutIdeaAgent execution failed:", agentResult.error);
        return NextResponse.json(
          {
            success: false,
            error: agentResult.error || "Failed to generate Fast Cut ideas",
          },
          { status: 500 }
        );
      }

      const output = agentResult.data;

      // Transform Fast Cut agent output
      const ideas: ContentIdea[] = output.ideas.map((idea) => ({
        id: uuidv4(),
        type: "fast-cut" as const,
        title: idea.title,
        hook: idea.hook,
        description: idea.description,
        estimatedEngagement: idea.estimatedEngagement,
        // Empty VEO prompt for Fast Cut ideas
        optimizedPrompt: "",
        // Fast Cut specific data
        fastCutData: {
          searchKeywords: idea.searchKeywords,
          suggestedVibe: idea.suggestedVibe,
          suggestedBpmRange: idea.suggestedBpmRange,
          scriptOutline: idea.scriptOutline,
        },
        suggestedMusic: {
          bpm: Math.round((idea.suggestedBpmRange.min + idea.suggestedBpmRange.max) / 2),
          genre: idea.suggestedVibe.toLowerCase(),
        },
        scriptOutline: idea.scriptOutline,
      }));

      return NextResponse.json({
        success: true,
        ideas,
        optimized_hashtags: output.optimizedHashtags,
        content_strategy: output.contentStrategy,
      } as GenerateIdeasResponse);
    }

    // ========================================================================
    // Default: AI Video (VEO) using CreativeDirectorAgent
    // Branch: Video-based (2+2 ideas) vs Non-video (3 ideas)
    // ========================================================================

    const creativeDirector = createCreativeDirectorAgent();

    const agentInput = {
      userIdea: user_idea || undefined,
      campaignDescription: campaign_description || undefined,
      strategy: strategy,
      audience: target_audience.length > 0 ? target_audience.join(", ") : undefined,
      goals: content_goals.length > 0 ? content_goals : undefined,
      benchmarks: performance_metrics ? {
        avgViews: performance_metrics.avgViews,
        avgEngagement: performance_metrics.avgEngagement,
        topPerformers: extractTopPerformers(inspiration_videos),
      } : undefined,
    };

    // Handle streaming response (only for non-video based)
    if (isStreaming && !video_analysis) {
      return handleStreamingResponse(creativeDirector, agentInput, agentContext);
    }

    // Execute CreativeDirector agent (non-streaming)
    const agentResult = await creativeDirector.execute(agentInput, agentContext);

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

    // ========================================================================
    // Branch: Video-based start → 2 trend ideas + 2 recreation ideas
    // ========================================================================
    if (video_analysis) {
      // Take first 2 trend-based ideas from CreativeDirector
      const trendIdeas: ContentIdea[] = output.ideas.slice(0, 2).map((idea) => ({
        id: uuidv4(),
        type: "ai_video" as const,
        title: idea.title,
        hook: idea.hook,
        description: idea.description,
        estimatedEngagement: idea.estimatedEngagement,
        optimizedPrompt: idea.optimizedPrompt,
        suggestedMusic: idea.suggestedMusic,
        scriptOutline: idea.scriptOutline,
        isRecreationIdea: false,
      }));

      // Generate 2 recreation ideas using VideoRecreationIdeaAgent
      const recreationAgent = createVideoRecreationIdeaAgent();
      const recreationResult = await recreationAgent.execute(
        {
          videoAnalysis: video_analysis,
          videoDescription: video_description || undefined,
          videoHashtags: video_hashtags || undefined,
          campaignDescription: campaign_description || undefined,
          artistName,
          language: language as "ko" | "en",
        },
        agentContext
      );

      let recreationIdeas: ContentIdea[] = [];
      if (recreationResult.success && recreationResult.data) {
        recreationIdeas = recreationResult.data.ideas.map((idea) => ({
          id: uuidv4(),
          type: "ai_video" as const,
          title: idea.title,
          hook: idea.hook,
          description: idea.description,
          estimatedEngagement: idea.estimatedEngagement,
          optimizedPrompt: idea.optimizedPrompt,
          suggestedMusic: idea.suggestedMusic,
          scriptOutline: idea.scriptOutline,
          isRecreationIdea: true,
        }));
      } else {
        console.error("Recreation agent failed:", recreationResult.error);
        // Continue with just trend ideas if recreation fails
      }

      // Combine: 2 trend ideas + 2 recreation ideas = 4 total
      const allIdeas = [...trendIdeas, ...recreationIdeas];

      return NextResponse.json({
        success: true,
        ideas: allIdeas,
        optimized_hashtags: output.optimizedHashtags,
        content_strategy: output.contentStrategy,
      } as GenerateIdeasResponse);
    }

    // ========================================================================
    // Non-video based: 3 trend-based ideas only
    // ========================================================================
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
      isRecreationIdea: false,
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
// Streaming Handler
// ============================================================================

/**
 * Handle streaming response using Server-Sent Events
 */
function handleStreamingResponse(
  agent: ReturnType<typeof createCreativeDirectorAgent>,
  input: Parameters<typeof agent.execute>[0],
  context: AgentContext
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "start", message: "Generating ideas..." })}\n\n`)
        );

        // Use the streaming generator
        const streamGenerator = agent.streamIdeas(
          input.userIdea,
          context,
          {
            strategy: input.strategy,
            audience: input.audience,
            goals: input.goals,
          }
        );

        let accumulatedContent = "";

        for await (const chunk of streamGenerator) {
          if (chunk.done) {
            // Final result with parsed data
            const result = chunk as unknown as { done: true; data?: unknown; success: boolean; error?: string };

            if (result.success && result.data) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const output = result.data as any;
              const ideas: ContentIdea[] = (output.ideas || []).map((idea: {
                title: string;
                hook: string;
                description: string;
                estimatedEngagement: "high" | "medium" | "low";
                optimizedPrompt: string;
                suggestedMusic?: { bpm: number; genre: string };
                scriptOutline?: string[];
              }) => ({
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

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: "complete",
                  success: true,
                  ideas,
                  optimized_hashtags: output.optimizedHashtags || [],
                  content_strategy: output.contentStrategy || "",
                })}\n\n`)
              );
            } else {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: "error",
                  error: result.error || "Failed to generate ideas",
                })}\n\n`)
              );
            }
          } else {
            // Partial content chunk
            accumulatedContent = chunk.accumulated || accumulatedContent + chunk.content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: "chunk",
                content: chunk.content,
                accumulated: accumulatedContent.length,
              })}\n\n`)
            );
          }
        }

        // Send done event
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Streaming failed",
          })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
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
}): ContentStrategy {
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
    bestPractices: [
      "Use trending sounds",
      "Post during peak hours",
      "Engage in comments",
      "Use relevant hashtags",
    ],
    avoid: [
      "Copyrighted music without license",
      "Overly promotional content",
      "Low quality visuals",
    ],
    confidenceScore: trend_insights ? 0.8 : 0.6,
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
