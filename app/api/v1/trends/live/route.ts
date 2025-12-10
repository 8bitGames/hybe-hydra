import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform } from "@prisma/client";
import { getTrendingVideos } from "@/lib/tiktok-mcp";

const CACHE_DURATION_HOURS = 24;
const TRENDING_SEARCH_QUERY = "trending"; // Identifier for cached trending videos

// GET /api/v1/trends/live - Get live trending videos with 24h cache
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const forceRefresh = searchParams.get("refresh") === "true";

    console.log("[TRENDS-LIVE] Request:", { limit, forceRefresh });

    // Check cache freshness
    const cacheThreshold = new Date(Date.now() - CACHE_DURATION_HOURS * 60 * 60 * 1000);

    // Get latest collection time for trending
    const latestCollection = await prisma.trendVideo.findFirst({
      where: {
        platform: "TIKTOK",
        searchQuery: TRENDING_SEARCH_QUERY,
      },
      orderBy: { collectedAt: "desc" },
      select: { collectedAt: true },
    });

    const needsRefresh = forceRefresh ||
      !latestCollection ||
      latestCollection.collectedAt < cacheThreshold;

    console.log("[TRENDS-LIVE] Needs refresh:", needsRefresh);

    // Fetch fresh data if needed
    if (needsRefresh) {
      try {
        console.log(`[TRENDS-LIVE] Fetching fresh trending data, limit: ${limit}`);
        const result = await getTrendingVideos({ country: "US", limit });

        if (result.success && result.data.length > 0) {
          // Delete old trending videos (cleanup)
          await prisma.trendVideo.deleteMany({
            where: {
              platform: "TIKTOK",
              searchQuery: TRENDING_SEARCH_QUERY,
            },
          });

          // Insert fresh videos (no thumbnails - removed preview feature)
          const videoData = result.data.map((video) => ({
            platform: "TIKTOK" as TrendPlatform,
            videoId: video.id,
            searchQuery: TRENDING_SEARCH_QUERY,
            searchType: "trending",
            description: video.description || null,
            authorId: video.author.uniqueId,
            authorName: video.author.nickname,
            playCount: video.stats.playCount ? BigInt(video.stats.playCount) : null,
            likeCount: video.stats.likeCount ? BigInt(video.stats.likeCount) : null,
            commentCount: video.stats.commentCount ? BigInt(video.stats.commentCount) : null,
            shareCount: video.stats.shareCount ? BigInt(video.stats.shareCount) : null,
            hashtags: video.hashtags || [],
            videoUrl: video.videoUrl,
            thumbnailUrl: null,
          }));

          await prisma.trendVideo.createMany({
            data: videoData,
            skipDuplicates: true,
          });

          console.log(`[TRENDS-LIVE] Saved ${videoData.length} trending videos`);
        }
      } catch (err) {
        console.error(`[TRENDS-LIVE] Error fetching trending:`, err);
        // Continue to return cached data if available
      }
    }

    // Fetch all trending videos from database
    const videos = await prisma.trendVideo.findMany({
      where: {
        platform: "TIKTOK",
        searchQuery: TRENDING_SEARCH_QUERY,
      },
      orderBy: { playCount: "desc" },
      take: limit,
    });

    // Get cache info
    const latestVideo = videos.length > 0 ? videos[0] : null;
    const collectedAt = latestVideo
      ? await prisma.trendVideo.findFirst({
          where: { id: latestVideo.id },
          select: { collectedAt: true },
        })
      : null;

    const cacheAge = collectedAt
      ? Math.floor((Date.now() - collectedAt.collectedAt.getTime()) / (1000 * 60 * 60))
      : 0;

    // Convert BigInt to number for JSON serialization (no thumbnails - removed preview feature)
    const serializedVideos = videos.map((v) => ({
      id: v.id,
      platform: v.platform,
      videoId: v.videoId,
      searchQuery: v.searchQuery,
      searchType: v.searchType,
      description: v.description,
      authorId: v.authorId,
      authorName: v.authorName,
      playCount: v.playCount ? Number(v.playCount) : null,
      likeCount: v.likeCount ? Number(v.likeCount) : null,
      commentCount: v.commentCount ? Number(v.commentCount) : null,
      shareCount: v.shareCount ? Number(v.shareCount) : null,
      hashtags: v.hashtags,
      videoUrl: v.videoUrl,
      collectedAt: v.collectedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      videos: serializedVideos,
      total: serializedVideos.length,
      cache: {
        ageHours: cacheAge,
        maxAgeHours: CACHE_DURATION_HOURS,
        refreshed: needsRefresh,
      },
    });
  } catch (err) {
    console.error("[TRENDS-LIVE] Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to fetch live trending videos",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
