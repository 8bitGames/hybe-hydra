/**
 * Text Trend Analysis API
 * Analyzes hashtags, descriptions, and text patterns from TikTok search results
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform, Prisma } from "@prisma/client";
import { searchTikTok, closeBrowser } from "@/lib/tiktok-trends";
import { analyzeTextTrends, TextTrendAnalysisResult } from "@/lib/services/text-trend-analyzer";

export const maxDuration = 120; // Allow longer execution for analysis

// POST /api/v1/trends/analyze/text - Analyze text trends for a search query
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      searchQuery,
      platform = "TIKTOK",
      maxVideos = 40,
      forceRefresh = false,
    } = body as {
      searchQuery: string;
      platform?: TrendPlatform;
      maxVideos?: number;
      forceRefresh?: boolean;
    };

    if (!searchQuery) {
      return NextResponse.json(
        { detail: "searchQuery is required" },
        { status: 400 }
      );
    }

    console.log(`[TRENDS-ANALYZE-TEXT] Starting analysis for "${searchQuery}"`);

    // Check for cached analysis (valid for 24 hours)
    if (!forceRefresh) {
      const cached = await prisma.textTrendAnalysis.findUnique({
        where: {
          platform_searchQuery: {
            platform: platform as TrendPlatform,
            searchQuery: searchQuery.toLowerCase(),
          },
        },
      });

      if (cached && cached.expiresAt > new Date()) {
        console.log(`[TRENDS-ANALYZE-TEXT] Returning cached analysis`);
        return NextResponse.json({
          success: true,
          cached: true,
          analysis: {
            topHashtags: cached.topHashtags,
            hashtagClusters: cached.hashtagClusters,
            topicThemes: cached.topicThemes,
            commonPhrases: cached.commonPhrases,
            sentimentTrend: cached.sentimentTrend,
            metrics: {
              totalVideos: cached.totalVideos,
              avgLikes: cached.avgLikes,
              avgComments: cached.avgComments,
              avgShares: cached.avgShares,
            },
            contentSuggestions: {
              captionTemplates: cached.captionTemplates,
              hashtagStrategy: cached.hashtagStrategy,
              contentSuggestions: cached.contentSuggestions,
            },
          },
          analyzedAt: cached.analyzedAt,
          expiresAt: cached.expiresAt,
        });
      }
    }

    // Fetch videos from TikTok
    console.log(`[TRENDS-ANALYZE-TEXT] Fetching videos from TikTok...`);
    const searchResult = await searchTikTok(searchQuery, Math.min(maxVideos, 50));
    await closeBrowser();

    if (!searchResult.success || searchResult.videos.length === 0) {
      return NextResponse.json({
        success: false,
        error: searchResult.error || "No videos found for this search query",
      });
    }

    console.log(`[TRENDS-ANALYZE-TEXT] Found ${searchResult.videos.length} videos, analyzing...`);

    // Run text trend analysis
    const analysis = await analyzeTextTrends(searchResult.videos, searchQuery);

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save to database
    const savedAnalysis = await prisma.textTrendAnalysis.upsert({
      where: {
        platform_searchQuery: {
          platform: platform as TrendPlatform,
          searchQuery: searchQuery.toLowerCase(),
        },
      },
      update: {
        topHashtags: analysis.topHashtags as unknown as Prisma.InputJsonValue,
        hashtagClusters: analysis.hashtagClusters as unknown as Prisma.InputJsonValue,
        topicThemes: analysis.topicThemes,
        commonPhrases: analysis.commonPhrases as unknown as Prisma.InputJsonValue,
        sentimentTrend: analysis.sentimentTrend,
        totalVideos: analysis.metrics.totalVideos,
        avgLikes: analysis.metrics.avgLikes,
        avgComments: analysis.metrics.avgComments,
        avgShares: analysis.metrics.avgShares,
        captionTemplates: analysis.contentSuggestions.captionTemplates as unknown as Prisma.InputJsonValue,
        hashtagStrategy: analysis.contentSuggestions.hashtagStrategy as unknown as Prisma.InputJsonValue,
        contentSuggestions: {
          toneRecommendation: analysis.contentSuggestions.toneRecommendation,
          contentThemes: analysis.contentSuggestions.contentThemes,
        } as unknown as Prisma.InputJsonValue,
        analyzedAt: new Date(),
        expiresAt,
      },
      create: {
        platform: platform as TrendPlatform,
        searchQuery: searchQuery.toLowerCase(),
        topHashtags: analysis.topHashtags as unknown as Prisma.InputJsonValue,
        hashtagClusters: analysis.hashtagClusters as unknown as Prisma.InputJsonValue,
        topicThemes: analysis.topicThemes,
        commonPhrases: analysis.commonPhrases as unknown as Prisma.InputJsonValue,
        sentimentTrend: analysis.sentimentTrend,
        totalVideos: analysis.metrics.totalVideos,
        avgLikes: analysis.metrics.avgLikes,
        avgComments: analysis.metrics.avgComments,
        avgShares: analysis.metrics.avgShares,
        captionTemplates: analysis.contentSuggestions.captionTemplates as unknown as Prisma.InputJsonValue,
        hashtagStrategy: analysis.contentSuggestions.hashtagStrategy as unknown as Prisma.InputJsonValue,
        contentSuggestions: {
          toneRecommendation: analysis.contentSuggestions.toneRecommendation,
          contentThemes: analysis.contentSuggestions.contentThemes,
        } as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    console.log(`[TRENDS-ANALYZE-TEXT] Analysis complete and saved`);

    return NextResponse.json({
      success: true,
      cached: false,
      analysis: {
        topHashtags: analysis.topHashtags,
        hashtagClusters: analysis.hashtagClusters,
        topicThemes: analysis.topicThemes,
        commonPhrases: analysis.commonPhrases,
        sentimentTrend: analysis.sentimentTrend,
        metrics: analysis.metrics,
        contentSuggestions: analysis.contentSuggestions,
      },
      analyzedAt: savedAnalysis.analyzedAt,
      expiresAt: savedAnalysis.expiresAt,
    });
  } catch (err) {
    console.error("[TRENDS-ANALYZE-TEXT] Error:", err);

    // Ensure browser is closed on error
    try {
      await closeBrowser();
    } catch {
      // Ignore close errors
    }

    return NextResponse.json(
      {
        detail: "Text trend analysis failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/v1/trends/analyze/text - Get cached text analysis
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("query");
    const platform = (searchParams.get("platform") || "TIKTOK") as TrendPlatform;

    if (!searchQuery) {
      return NextResponse.json(
        { detail: "query parameter is required" },
        { status: 400 }
      );
    }

    const analysis = await prisma.textTrendAnalysis.findUnique({
      where: {
        platform_searchQuery: {
          platform,
          searchQuery: searchQuery.toLowerCase(),
        },
      },
    });

    if (!analysis) {
      return NextResponse.json({
        success: false,
        found: false,
        message: "No analysis found for this query. Use POST to analyze.",
      });
    }

    const isExpired = analysis.expiresAt < new Date();

    return NextResponse.json({
      success: true,
      found: true,
      expired: isExpired,
      analysis: {
        topHashtags: analysis.topHashtags,
        hashtagClusters: analysis.hashtagClusters,
        topicThemes: analysis.topicThemes,
        commonPhrases: analysis.commonPhrases,
        sentimentTrend: analysis.sentimentTrend,
        metrics: {
          totalVideos: analysis.totalVideos,
          avgLikes: analysis.avgLikes,
          avgComments: analysis.avgComments,
          avgShares: analysis.avgShares,
        },
        contentSuggestions: {
          captionTemplates: analysis.captionTemplates,
          hashtagStrategy: analysis.hashtagStrategy,
          ...((analysis.contentSuggestions as Record<string, unknown>) || {}),
        },
      },
      analyzedAt: analysis.analyzedAt,
      expiresAt: analysis.expiresAt,
    });
  } catch (err) {
    console.error("[TRENDS-ANALYZE-TEXT] GET Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to fetch text analysis",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
