/**
 * Trend Report API
 * Generates combined content creation recommendations from text and video analyses
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform, Prisma } from "@prisma/client";
import { searchTikTok, closeBrowser } from "@/lib/tiktok-trends";
import { analyzeTextTrends, TextTrendAnalysisResult } from "@/lib/services/text-trend-analyzer";
import { analyzeVideoTrends, VideoTrendAnalysisResult } from "@/lib/services/video-trend-analyzer";
import { generateTrendReport, TrendReportResult } from "@/lib/services/trend-report-generator";

export const maxDuration = 300; // Allow longer execution (5 minutes)

// POST /api/v1/trends/analyze/report - Generate comprehensive trend report
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
      includeText = true,
      includeVideo = true,
      maxVideos = 40,
      maxVideoAnalysis = 5,
    } = body as {
      searchQuery: string;
      platform?: TrendPlatform;
      includeText?: boolean;
      includeVideo?: boolean;
      maxVideos?: number;
      maxVideoAnalysis?: number;
    };

    if (!searchQuery) {
      return NextResponse.json(
        { detail: "searchQuery is required" },
        { status: 400 }
      );
    }

    if (!includeText && !includeVideo) {
      return NextResponse.json(
        { detail: "At least one of includeText or includeVideo must be true" },
        { status: 400 }
      );
    }

    console.log(`[TRENDS-REPORT] Starting report generation for "${searchQuery}"`);

    // Fetch videos from TikTok
    console.log(`[TRENDS-REPORT] Fetching videos from TikTok...`);
    const searchResult = await searchTikTok(searchQuery, Math.min(maxVideos, 50));
    await closeBrowser();

    if (!searchResult.success || searchResult.videos.length === 0) {
      return NextResponse.json({
        success: false,
        error: searchResult.error || "No videos found for this search query",
      });
    }

    console.log(`[TRENDS-REPORT] Found ${searchResult.videos.length} videos`);

    // Run analyses in parallel where possible
    const [textAnalysis, videoAnalysis] = await Promise.all([
      includeText
        ? analyzeTextTrends(searchResult.videos, searchQuery)
        : Promise.resolve(null),
      includeVideo
        ? analyzeVideoTrends(searchResult.videos, searchQuery, Math.min(maxVideoAnalysis, 10))
        : Promise.resolve(null),
    ]);

    console.log(`[TRENDS-REPORT] Analyses complete, generating report...`);

    // Generate combined report
    const report = await generateTrendReport(
      searchQuery,
      platform as TrendPlatform,
      textAnalysis,
      videoAnalysis
    );

    // Save to database (permanent storage - each analysis creates a new record)
    const savedReport = await prisma.trendReport.create({
      data: {
        platform: platform as TrendPlatform,
        searchQuery: searchQuery.toLowerCase(),
        trendScore: report.trendScore,
        trendDirection: report.trendDirection,
        textGuide: report.textGuide as unknown as Prisma.InputJsonValue,
        videoGuide: report.videoGuide as unknown as Prisma.InputJsonValue,
        combinedStrategy: report.combinedStrategy as unknown as Prisma.InputJsonValue,
        targetAudience: report.targetAudience,
        bestPostingTimes: report.bestPostingTimes as unknown as Prisma.InputJsonValue,
        competitorInsights: report.competitorInsights as unknown as Prisma.InputJsonValue,
      },
    });

    console.log(`[TRENDS-REPORT] Report generated and saved`);

    return NextResponse.json({
      success: true,
      report: {
        id: savedReport.id,
        searchQuery: report.searchQuery,
        platform: report.platform,
        trendScore: report.trendScore,
        trendDirection: report.trendDirection,
        textGuide: report.textGuide,
        videoGuide: report.videoGuide,
        combinedStrategy: report.combinedStrategy,
        targetAudience: report.targetAudience,
        bestPostingTimes: report.bestPostingTimes,
        competitorInsights: report.competitorInsights,
      },
      // Include raw analysis data for detailed view
      analyses: {
        text: includeText && textAnalysis ? {
          topHashtags: textAnalysis.topHashtags.slice(0, 10),
          topicThemes: textAnalysis.topicThemes,
          metrics: textAnalysis.metrics,
        } : null,
        video: includeVideo && videoAnalysis ? {
          dominantStyles: videoAnalysis.visualPatterns.dominantStyles,
          dominantMood: videoAnalysis.dominantMood,
          videosAnalyzed: videoAnalysis.videosAnalyzed,
          trendScore: videoAnalysis.trendScore,
        } : null,
      },
      createdAt: savedReport.createdAt,
    });
  } catch (err) {
    console.error("[TRENDS-REPORT] Error:", err);

    // Ensure browser is closed on error
    try {
      await closeBrowser();
    } catch {
      // Ignore close errors
    }

    return NextResponse.json(
      {
        detail: "Trend report generation failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/v1/trends/analyze/report - Get trend reports with history
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
    const format = searchParams.get("format"); // "bridge" or "compose" for specialized formats
    const reportId = searchParams.get("id"); // Get specific report by ID
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get specific report by ID
    if (reportId) {
      const report = await prisma.trendReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        return NextResponse.json({
          success: false,
          found: false,
          message: "No report found with this ID.",
        });
      }

      return NextResponse.json({
        success: true,
        found: true,
        report: {
          id: report.id,
          searchQuery: report.searchQuery,
          platform: report.platform,
          trendScore: report.trendScore,
          trendDirection: report.trendDirection,
          textGuide: report.textGuide,
          videoGuide: report.videoGuide,
          combinedStrategy: report.combinedStrategy,
          targetAudience: report.targetAudience,
          bestPostingTimes: report.bestPostingTimes,
          competitorInsights: report.competitorInsights,
        },
        createdAt: report.createdAt,
      });
    }

    // Build query conditions
    const whereCondition: { platform: TrendPlatform; searchQuery?: string } = { platform };
    if (searchQuery) {
      whereCondition.searchQuery = searchQuery.toLowerCase();
    }

    // Get reports (latest first)
    const reports = await prisma.trendReport.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (reports.length === 0) {
      return NextResponse.json({
        success: true,
        found: false,
        reports: [],
        message: searchQuery
          ? "No reports found for this query. Use POST to generate."
          : "No reports found. Use POST to generate.",
      });
    }

    // Get the most recent report for specialized formats
    const latestReport = reports[0];

    // Return specialized format if requested (uses latest report)
    if (format === "bridge") {
      return NextResponse.json({
        success: true,
        found: true,
        bridge: {
          trendStyle: (latestReport.videoGuide as { visualStyle?: string })?.visualStyle || "modern",
          suggestedPrompt: (latestReport.videoGuide as { promptTemplate?: string })?.promptTemplate || "",
          hashtags: [
            ...((latestReport.textGuide as { hashtags?: { primary?: string[] } })?.hashtags?.primary || []),
            ...((latestReport.textGuide as { hashtags?: { secondary?: string[] } })?.hashtags?.secondary || []),
          ].slice(0, 10),
          styleMatch: {
            visual: (latestReport.videoGuide as { visualStyle?: string })?.visualStyle,
            mood: (latestReport.videoGuide as { mood?: string })?.mood,
            pace: (latestReport.videoGuide as { pace?: string })?.pace,
          },
        },
        reportId: latestReport.id,
        createdAt: latestReport.createdAt,
      });
    }

    if (format === "compose") {
      const textGuide = latestReport.textGuide as {
        captionTemplates?: string[];
        hashtags?: { primary?: string[]; secondary?: string[] };
      };
      const videoGuide = latestReport.videoGuide as {
        visualStyle?: string;
        technicalSpecs?: { aspectRatio?: string; duration?: number };
        effects?: string[];
      };

      return NextResponse.json({
        success: true,
        found: true,
        compose: {
          scriptSuggestions: textGuide?.captionTemplates || [],
          visualStyle: videoGuide?.visualStyle || "modern",
          hashtags: {
            recommended: [
              ...(textGuide?.hashtags?.primary || []),
              ...(textGuide?.hashtags?.secondary || []),
            ].slice(0, 10),
          },
          technicalSettings: {
            aspectRatio: videoGuide?.technicalSpecs?.aspectRatio || "9:16",
            duration: videoGuide?.technicalSpecs?.duration || 8,
            effects: videoGuide?.effects || [],
          },
        },
        reportId: latestReport.id,
        createdAt: latestReport.createdAt,
      });
    }

    // Return all reports (history)
    return NextResponse.json({
      success: true,
      found: true,
      total: reports.length,
      reports: reports.map(report => ({
        id: report.id,
        searchQuery: report.searchQuery,
        platform: report.platform,
        trendScore: report.trendScore,
        trendDirection: report.trendDirection,
        textGuide: report.textGuide,
        videoGuide: report.videoGuide,
        combinedStrategy: report.combinedStrategy,
        targetAudience: report.targetAudience,
        bestPostingTimes: report.bestPostingTimes,
        competitorInsights: report.competitorInsights,
        createdAt: report.createdAt,
      })),
    });
  } catch (err) {
    console.error("[TRENDS-REPORT] GET Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to fetch trend reports",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
