import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform, Prisma } from "@prisma/client";
import {
  collectTikTokTrends,
  scrapeHashtagPage,
  searchTikTok,
  closeBrowser,
  TikTokTrendItem,
} from "@/lib/tiktok-trends";

// POST /api/v1/trends/collect - Trigger trend collection (admin only)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      keywords = [],
      hashtags = [],
      includeExplore = true,
      region = "KR",
      platform = "TIKTOK",
    } = body as {
      keywords?: string[];
      hashtags?: string[];
      includeExplore?: boolean;
      region?: string;
      platform?: TrendPlatform;
    };

    console.log("[TRENDS-COLLECT] Starting collection with options:", {
      keywords,
      hashtags,
      includeExplore,
      region,
      platform,
    });

    // Collect trends based on platform
    let collectedTrends: TikTokTrendItem[] = [];
    let method = "unknown";
    let error: string | undefined;

    if (platform === "TIKTOK") {
      const result = await collectTikTokTrends({
        keywords,
        hashtags,
        includeExplore,
      });

      collectedTrends = result.trends;
      method = result.method;
      error = result.error;

      // Close browser after collection
      await closeBrowser();
    } else {
      return NextResponse.json(
        { detail: `Platform ${platform} collection not yet implemented` },
        { status: 400 }
      );
    }

    if (collectedTrends.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No trends collected",
        error,
        method,
      });
    }

    // Save to database
    const trendData = collectedTrends.map((trend) => ({
      platform: platform as TrendPlatform,
      keyword: trend.keyword,
      rank: trend.rank,
      region,
      viewCount: trend.viewCount ? BigInt(Math.floor(trend.viewCount)) : null,
      videoCount: trend.videoCount || null,
      description: trend.description || null,
      hashtags: trend.hashtag ? [trend.hashtag] : [],
      metadata: trend.metadata ? (trend.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      trendUrl: trend.trendUrl || null,
      thumbnailUrl: trend.thumbnailUrl || null,
    }));

    const created = await prisma.trendSnapshot.createMany({
      data: trendData,
      skipDuplicates: true,
    });

    console.log(`[TRENDS-COLLECT] Saved ${created.count} trends to database`);

    return NextResponse.json({
      success: true,
      message: "Trends collected and saved successfully",
      method,
      collected_count: collectedTrends.length,
      saved_count: created.count,
      trends: collectedTrends.slice(0, 10).map((t) => ({
        rank: t.rank,
        keyword: t.keyword,
        viewCount: t.viewCount,
        videoCount: t.videoCount,
      })),
    });
  } catch (err) {
    console.error("[TRENDS-COLLECT] Error:", err);

    // Ensure browser is closed on error
    try {
      await closeBrowser();
    } catch {
      // Ignore close errors
    }

    return NextResponse.json(
      {
        detail: "Trend collection failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/v1/trends/collect/hashtag - Get details for a specific hashtag
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const hashtag = searchParams.get("hashtag");
    const keyword = searchParams.get("keyword");
    const action = searchParams.get("action") || "hashtag";

    if (action === "search" && keyword) {
      // Search TikTok for a keyword - fetch up to 40 videos
      const result = await searchTikTok(keyword, 40);
      await closeBrowser();

      return NextResponse.json({
        success: result.success,
        keyword,
        videos: result.videos,
        relatedHashtags: result.relatedHashtags,
        error: result.error,
      });
    }

    if (action === "hashtag" && hashtag) {
      // Get hashtag details - videos already limited in scrapeHashtagPage
      const result = await scrapeHashtagPage(hashtag);
      await closeBrowser();

      return NextResponse.json({
        success: result.success,
        hashtag,
        info: result.info,
        videos: result.videos,
        error: result.error,
      });
    }

    return NextResponse.json(
      { detail: "Missing required parameter: hashtag or keyword" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[TRENDS-COLLECT] GET Error:", err);

    try {
      await closeBrowser();
    } catch {
      // Ignore close errors
    }

    return NextResponse.json(
      {
        detail: "Request failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
