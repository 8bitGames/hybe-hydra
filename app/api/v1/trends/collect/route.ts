import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform, Prisma } from "@prisma/client";
import {
  searchTikTok,
  searchByHashtag,
  getTrendingVideos,
  TikTokVideo,
} from "@/lib/tiktok-mcp";

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
      region = "US",
      platform = "TIKTOK",
    } = body as {
      keywords?: string[];
      hashtags?: string[];
      includeExplore?: boolean;
      region?: string;
      platform?: TrendPlatform;
    };

    console.log("[TRENDS-COLLECT] Starting collection with RapidAPI:", {
      keywords,
      hashtags,
      includeExplore,
      region,
      platform,
    });

    if (platform !== "TIKTOK") {
      return NextResponse.json(
        { detail: `Platform ${platform} collection not yet implemented` },
        { status: 400 }
      );
    }

    const collectedTrends: Array<{
      rank: number;
      keyword: string;
      hashtag?: string;
      viewCount?: number;
      videoCount?: number;
      description?: string;
    }> = [];

    // Collect trending videos if requested
    if (includeExplore) {
      const trendingResult = await getTrendingVideos({ country: region, limit: 20 });
      if (trendingResult.success) {
        trendingResult.data.forEach((video, index) => {
          collectedTrends.push({
            rank: index + 1,
            keyword: video.description.slice(0, 100) || `trending_${index + 1}`,
            viewCount: video.stats.playCount,
            description: video.description,
          });
        });
      }
    }

    // Search for keywords
    for (const keyword of keywords) {
      const result = await searchTikTok(keyword, 10);
      if (result.success) {
        result.videos.forEach((video, index) => {
          collectedTrends.push({
            rank: collectedTrends.length + 1,
            keyword,
            viewCount: video.stats.playCount,
            description: video.description,
          });
        });
      }
    }

    // Collect hashtag trends
    for (const hashtag of hashtags) {
      const result = await searchByHashtag(hashtag, 10);
      if (result.success && result.info) {
        collectedTrends.push({
          rank: collectedTrends.length + 1,
          keyword: `#${result.info.title}`,
          hashtag: result.info.title,
          viewCount: result.info.viewCount,
          videoCount: result.info.videoCount,
          description: result.info.description,
        });
      }
    }

    if (collectedTrends.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No trends collected",
        method: "rapidapi",
      });
    }

    // Save to database (no thumbnails - removed preview feature)
    const trendData = collectedTrends.map((trend) => ({
      platform: platform as TrendPlatform,
      keyword: trend.keyword,
      rank: trend.rank,
      region,
      viewCount: trend.viewCount ? BigInt(Math.floor(trend.viewCount)) : null,
      videoCount: trend.videoCount || null,
      description: trend.description || null,
      hashtags: trend.hashtag ? [trend.hashtag] : [],
      metadata: Prisma.JsonNull,
      trendUrl: null,
      thumbnailUrl: null,
    }));

    const created = await prisma.trendSnapshot.createMany({
      data: trendData,
      skipDuplicates: true,
    });

    console.log(`[TRENDS-COLLECT] Saved ${created.count} trends to database`);

    return NextResponse.json({
      success: true,
      message: "Trends collected via RapidAPI",
      method: "rapidapi",
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
    return NextResponse.json(
      {
        detail: "Trend collection failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/v1/trends/collect - Get details for a specific hashtag or search keyword
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
    const limit = parseInt(searchParams.get("limit") || "40", 10);

    console.log("[TRENDS-COLLECT] GET request via RapidAPI:", { action, hashtag, keyword, limit });

    if (action === "search" && keyword) {
      const result = await searchTikTok(keyword, limit);

      return NextResponse.json({
        success: result.success,
        keyword: result.keyword,
        videos: result.videos,
        relatedHashtags: result.relatedHashtags,
        error: result.error,
        method: "rapidapi",
      });
    }

    if (action === "hashtag" && hashtag) {
      const result = await searchByHashtag(hashtag, limit);

      return NextResponse.json({
        success: result.success,
        hashtag: result.info?.title || hashtag,
        info: result.info,
        videos: result.videos,
        error: result.error,
        method: "rapidapi",
      });
    }

    return NextResponse.json(
      { detail: "Missing required parameter: hashtag or keyword" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[TRENDS-COLLECT] GET Error:", err);
    return NextResponse.json(
      {
        detail: "Request failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
