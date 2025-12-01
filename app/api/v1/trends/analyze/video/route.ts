/**
 * Video Trend Analysis API
 * Analyzes visual styles and content patterns from top TikTok videos
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform, Prisma } from "@prisma/client";
import { searchTikTok, closeBrowser } from "@/lib/tiktok-trends";
import { analyzeVideoTrends, VideoTrendAnalysisResult } from "@/lib/services/video-trend-analyzer";

export const maxDuration = 300; // Allow longer execution for video analysis (5 minutes)

// POST /api/v1/trends/analyze/video - Analyze video trends for a search query
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
      maxVideos = 5,
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

    // Limit max videos to prevent timeout
    const videosToAnalyze = Math.min(maxVideos, 10);

    console.log(`[TRENDS-ANALYZE-VIDEO] Starting analysis for "${searchQuery}" (max ${videosToAnalyze} videos)`);

    // Check for cached analysis (valid for 48 hours due to expensive operation)
    if (!forceRefresh) {
      const cached = await prisma.videoTrendAnalysis.findUnique({
        where: {
          platform_searchQuery: {
            platform: platform as TrendPlatform,
            searchQuery: searchQuery.toLowerCase(),
          },
        },
      });

      if (cached && cached.expiresAt > new Date()) {
        console.log(`[TRENDS-ANALYZE-VIDEO] Returning cached analysis`);
        return NextResponse.json({
          success: true,
          cached: true,
          analysis: {
            visualPatterns: {
              dominantStyles: cached.dominantStyles,
              colorPalettes: cached.colorPalettes,
              lightingPatterns: cached.lightingPatterns,
              cameraMovements: cached.cameraMovements,
              transitionStyles: cached.transitionStyles,
            },
            contentPatterns: {
              commonSubjects: cached.commonSubjects,
              settingTypes: cached.settingTypes,
              propCategories: cached.propCategories,
            },
            dominantMood: cached.dominantMood,
            averagePace: cached.averagePace,
            effectsTrending: cached.effectsTrending,
            videoRecommendations: {
              promptTemplates: cached.promptTemplates,
              styleGuidelines: cached.styleGuidelines,
              technicalSpecs: cached.technicalSpecs,
            },
            analyzedVideoIds: cached.analyzedVideoIds,
            videosAnalyzed: cached.videosAnalyzed,
          },
          analyzedAt: cached.analyzedAt,
          expiresAt: cached.expiresAt,
        });
      }
    }

    // Fetch videos from TikTok
    console.log(`[TRENDS-ANALYZE-VIDEO] Fetching videos from TikTok...`);
    const searchResult = await searchTikTok(searchQuery, 40);
    await closeBrowser();

    if (!searchResult.success || searchResult.videos.length === 0) {
      return NextResponse.json({
        success: false,
        error: searchResult.error || "No videos found for this search query",
      });
    }

    console.log(`[TRENDS-ANALYZE-VIDEO] Found ${searchResult.videos.length} videos, analyzing top ${videosToAnalyze}...`);

    // Run video trend analysis
    const analysis = await analyzeVideoTrends(searchResult.videos, searchQuery, videosToAnalyze);

    // Calculate expiration (48 hours from now - longer due to expensive operation)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Save to database
    const savedAnalysis = await prisma.videoTrendAnalysis.upsert({
      where: {
        platform_searchQuery: {
          platform: platform as TrendPlatform,
          searchQuery: searchQuery.toLowerCase(),
        },
      },
      update: {
        dominantStyles: analysis.visualPatterns.dominantStyles,
        colorPalettes: analysis.visualPatterns.colorPalettes as unknown as Prisma.InputJsonValue,
        lightingPatterns: analysis.visualPatterns.lightingPatterns,
        cameraMovements: analysis.visualPatterns.cameraMovements,
        transitionStyles: analysis.visualPatterns.transitionStyles,
        commonSubjects: analysis.contentPatterns.commonSubjects,
        settingTypes: analysis.contentPatterns.settingTypes,
        propCategories: analysis.contentPatterns.propCategories,
        dominantMood: analysis.dominantMood,
        averagePace: analysis.averagePace,
        effectsTrending: analysis.effectsTrending,
        promptTemplates: analysis.videoRecommendations.promptTemplates as unknown as Prisma.InputJsonValue,
        styleGuidelines: analysis.videoRecommendations.styleGuidelines as unknown as Prisma.InputJsonValue,
        technicalSpecs: analysis.videoRecommendations.technicalSpecs as unknown as Prisma.InputJsonValue,
        analyzedVideoIds: analysis.analyzedVideoIds,
        videosAnalyzed: analysis.videosAnalyzed,
        analyzedAt: new Date(),
        expiresAt,
      },
      create: {
        platform: platform as TrendPlatform,
        searchQuery: searchQuery.toLowerCase(),
        dominantStyles: analysis.visualPatterns.dominantStyles,
        colorPalettes: analysis.visualPatterns.colorPalettes as unknown as Prisma.InputJsonValue,
        lightingPatterns: analysis.visualPatterns.lightingPatterns,
        cameraMovements: analysis.visualPatterns.cameraMovements,
        transitionStyles: analysis.visualPatterns.transitionStyles,
        commonSubjects: analysis.contentPatterns.commonSubjects,
        settingTypes: analysis.contentPatterns.settingTypes,
        propCategories: analysis.contentPatterns.propCategories,
        dominantMood: analysis.dominantMood,
        averagePace: analysis.averagePace,
        effectsTrending: analysis.effectsTrending,
        promptTemplates: analysis.videoRecommendations.promptTemplates as unknown as Prisma.InputJsonValue,
        styleGuidelines: analysis.videoRecommendations.styleGuidelines as unknown as Prisma.InputJsonValue,
        technicalSpecs: analysis.videoRecommendations.technicalSpecs as unknown as Prisma.InputJsonValue,
        analyzedVideoIds: analysis.analyzedVideoIds,
        videosAnalyzed: analysis.videosAnalyzed,
        expiresAt,
      },
    });

    console.log(`[TRENDS-ANALYZE-VIDEO] Analysis complete and saved (${analysis.videosAnalyzed} videos analyzed)`);

    return NextResponse.json({
      success: true,
      cached: false,
      analysis: {
        visualPatterns: analysis.visualPatterns,
        contentPatterns: analysis.contentPatterns,
        dominantMood: analysis.dominantMood,
        averagePace: analysis.averagePace,
        effectsTrending: analysis.effectsTrending,
        videoRecommendations: analysis.videoRecommendations,
        analyzedVideoIds: analysis.analyzedVideoIds,
        videosAnalyzed: analysis.videosAnalyzed,
        trendScore: analysis.trendScore,
      },
      analyzedAt: savedAnalysis.analyzedAt,
      expiresAt: savedAnalysis.expiresAt,
    });
  } catch (err) {
    console.error("[TRENDS-ANALYZE-VIDEO] Error:", err);

    // Ensure browser is closed on error
    try {
      await closeBrowser();
    } catch {
      // Ignore close errors
    }

    return NextResponse.json(
      {
        detail: "Video trend analysis failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/v1/trends/analyze/video - Get cached video analysis
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

    const analysis = await prisma.videoTrendAnalysis.findUnique({
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
        visualPatterns: {
          dominantStyles: analysis.dominantStyles,
          colorPalettes: analysis.colorPalettes,
          lightingPatterns: analysis.lightingPatterns,
          cameraMovements: analysis.cameraMovements,
          transitionStyles: analysis.transitionStyles,
        },
        contentPatterns: {
          commonSubjects: analysis.commonSubjects,
          settingTypes: analysis.settingTypes,
          propCategories: analysis.propCategories,
        },
        dominantMood: analysis.dominantMood,
        averagePace: analysis.averagePace,
        effectsTrending: analysis.effectsTrending,
        videoRecommendations: {
          promptTemplates: analysis.promptTemplates,
          styleGuidelines: analysis.styleGuidelines,
          technicalSpecs: analysis.technicalSpecs,
        },
        analyzedVideoIds: analysis.analyzedVideoIds,
        videosAnalyzed: analysis.videosAnalyzed,
      },
      analyzedAt: analysis.analyzedAt,
      expiresAt: analysis.expiresAt,
    });
  } catch (err) {
    console.error("[TRENDS-ANALYZE-VIDEO] GET Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to fetch video analysis",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
