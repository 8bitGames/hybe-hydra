import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform } from "@prisma/client";
import { searchTikTok } from "@/lib/tiktok-rapidapi";

const CACHE_DURATION_HOURS = 24;
const DEFAULT_KEYWORDS = ["countrymusic", "kpop", "dance"];

// GET /api/v1/trends/live - Get live trending videos with 24h cache
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keywords = searchParams.get("keywords")?.split(",").map(k => k.trim()) || DEFAULT_KEYWORDS;
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 50);
    const forceRefresh = searchParams.get("refresh") === "true";

    console.log("[TRENDS-LIVE] Request:", { keywords, limit, forceRefresh });

    // Check cache freshness
    const cacheThreshold = new Date(Date.now() - CACHE_DURATION_HOURS * 60 * 60 * 1000);

    // Get latest collection time for each keyword
    const latestCollections = await prisma.trendVideo.groupBy({
      by: ["searchQuery"],
      where: {
        platform: "TIKTOK",
        searchQuery: { in: keywords },
      },
      _max: { collectedAt: true },
    });

    const latestMap = new Map(
      latestCollections.map(c => [c.searchQuery, c._max.collectedAt])
    );

    // Determine which keywords need refreshing
    const keywordsToRefresh = forceRefresh
      ? keywords
      : keywords.filter(k => {
          const lastCollected = latestMap.get(k);
          return !lastCollected || lastCollected < cacheThreshold;
        });

    console.log("[TRENDS-LIVE] Keywords to refresh:", keywordsToRefresh);

    // Fetch fresh data for stale keywords
    if (keywordsToRefresh.length > 0) {
      for (const keyword of keywordsToRefresh) {
        try {
          console.log(`[TRENDS-LIVE] Fetching fresh data for: ${keyword}`);
          const result = await searchTikTok(keyword, limit);

          if (result.success && result.videos.length > 0) {
            // Delete old videos for this keyword (cleanup)
            await prisma.trendVideo.deleteMany({
              where: {
                platform: "TIKTOK",
                searchQuery: keyword,
              },
            });

            // Insert fresh videos
            const videoData = result.videos.map((video) => ({
              platform: "TIKTOK" as TrendPlatform,
              videoId: video.id,
              searchQuery: keyword,
              searchType: "keyword",
              description: video.description || null,
              authorId: video.author.uniqueId,
              authorName: video.author.nickname,
              playCount: video.stats.playCount ? BigInt(video.stats.playCount) : null,
              likeCount: video.stats.likeCount ? BigInt(video.stats.likeCount) : null,
              commentCount: video.stats.commentCount ? BigInt(video.stats.commentCount) : null,
              shareCount: video.stats.shareCount ? BigInt(video.stats.shareCount) : null,
              hashtags: video.hashtags || [],
              videoUrl: video.videoUrl,
              thumbnailUrl: video.thumbnailUrl || null,
            }));

            await prisma.trendVideo.createMany({
              data: videoData,
              skipDuplicates: true,
            });

            console.log(`[TRENDS-LIVE] Saved ${videoData.length} videos for: ${keyword}`);
          }
        } catch (err) {
          console.error(`[TRENDS-LIVE] Error fetching ${keyword}:`, err);
          // Continue with other keywords
        }
      }
    }

    // Fetch all videos from database
    const videos = await prisma.trendVideo.findMany({
      where: {
        platform: "TIKTOK",
        searchQuery: { in: keywords },
      },
      orderBy: { playCount: "desc" },
      take: limit,
    });

    // Get available hashtags with counts
    const hashtagGroups = await prisma.trendVideo.groupBy({
      by: ["searchQuery"],
      where: {
        platform: "TIKTOK",
        searchQuery: { in: keywords },
      },
      _count: { id: true },
      _sum: { playCount: true },
      _max: { collectedAt: true },
      orderBy: { _sum: { playCount: "desc" } },
    });

    // Get cache info
    const oldestCollection = hashtagGroups.reduce((oldest, g) => {
      const collected = g._max.collectedAt;
      if (!oldest || (collected && collected < oldest)) return collected;
      return oldest;
    }, null as Date | null);

    const cacheAge = oldestCollection
      ? Math.floor((Date.now() - oldestCollection.getTime()) / (1000 * 60 * 60))
      : 0;

    // Convert BigInt to number for JSON serialization
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
      thumbnailUrl: v.thumbnailUrl,
      collectedAt: v.collectedAt.toISOString(),
    }));

    const serializedHashtags = hashtagGroups.map((g) => ({
      query: g.searchQuery,
      videoCount: g._count.id,
      totalPlayCount: g._sum.playCount ? Number(g._sum.playCount) : 0,
      lastUpdated: g._max.collectedAt?.toISOString() || null,
    }));

    return NextResponse.json({
      success: true,
      videos: serializedVideos,
      availableHashtags: serializedHashtags,
      total: serializedVideos.length,
      cache: {
        ageHours: cacheAge,
        maxAgeHours: CACHE_DURATION_HOURS,
        refreshed: keywordsToRefresh.length > 0,
        keywords,
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
