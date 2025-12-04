import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform, Prisma } from "@prisma/client";
import {
  searchTikTok,
  getHashtagVideos,
  getTrendingVideos,
  TikTokVideo,
} from "@/lib/tiktok-rapidapi";
import { batchCacheImagesToS3 } from "@/lib/storage";

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
      thumbnailUrl?: string;
    }> = [];

    // Collect trending videos if requested
    if (includeExplore) {
      const trendingResult = await getTrendingVideos(region, 20);
      if (trendingResult.success) {
        trendingResult.videos.forEach((video, index) => {
          collectedTrends.push({
            rank: index + 1,
            keyword: video.description.slice(0, 100) || `trending_${index + 1}`,
            viewCount: video.stats.playCount,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
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
            thumbnailUrl: video.thumbnailUrl,
          });
        });
      }
    }

    // Collect hashtag trends
    for (const hashtag of hashtags) {
      const result = await getHashtagVideos(hashtag, 10);
      if (result.success && result.info) {
        collectedTrends.push({
          rank: collectedTrends.length + 1,
          keyword: `#${result.hashtag}`,
          hashtag: result.hashtag,
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

    // Cache thumbnail images to S3 (TikTok CDN URLs expire quickly)
    const thumbnailUrls = collectedTrends
      .map((t) => t.thumbnailUrl)
      .filter((url): url is string => !!url && url.startsWith("http"));

    let cachedUrlMap = new Map<string, string>();
    if (thumbnailUrls.length > 0) {
      console.log(`[TRENDS-COLLECT] Caching ${thumbnailUrls.length} thumbnail images to S3...`);
      try {
        cachedUrlMap = await batchCacheImagesToS3(thumbnailUrls, "cache/trends");
        console.log(`[TRENDS-COLLECT] Cached ${cachedUrlMap.size} images to S3`);
      } catch (cacheError) {
        console.warn("[TRENDS-COLLECT] Image caching failed (non-fatal):", cacheError);
        // Continue without caching - proxy will handle expired URLs
      }
    }

    // Save to database with cached S3 URLs where available
    const trendData = collectedTrends.map((trend) => {
      // Use cached S3 URL if available, otherwise keep original (proxy will handle it)
      const cachedThumbnailUrl = trend.thumbnailUrl
        ? cachedUrlMap.get(trend.thumbnailUrl) || trend.thumbnailUrl
        : null;

      return {
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
        thumbnailUrl: cachedThumbnailUrl,
      };
    });

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
      cached_images: cachedUrlMap.size,
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
      const result = await getHashtagVideos(hashtag, limit);

      return NextResponse.json({
        success: result.success,
        hashtag: result.hashtag,
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
