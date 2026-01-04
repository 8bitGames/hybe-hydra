import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { TrendPlatform } from "@prisma/client";

// GET /api/v1/trends/trending - Get top trending videos sorted by play count
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = (searchParams.get("platform") || "TIKTOK") as TrendPlatform;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const hashtags = searchParams.get("hashtags"); // Comma-separated list of hashtags to filter by

    // Build where clause
    const where: {
      platform: TrendPlatform;
      searchQuery?: { in: string[] };
    } = {
      platform,
    };

    // Filter by specific hashtags if provided
    if (hashtags) {
      const hashtagList = hashtags.split(",").map(h => h.trim().replace(/^#/, ""));
      where.searchQuery = { in: hashtagList };
    }

    // Fetch top trending videos sorted by play count
    const videos = await withRetry(() => prisma.trendVideo.findMany({
      where,
      orderBy: { playCount: "desc" },
      take: limit,
    }));

    // Get unique hashtags/queries that we have videos for
    const uniqueQueries = await withRetry(() => prisma.trendVideo.groupBy({
      by: ["searchQuery"],
      where: { platform },
      _count: { id: true },
      _sum: { playCount: true },
      orderBy: { _sum: { playCount: "desc" } },
      take: 10,
    }));

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
      collectedAt: v.collectedAt,
    }));

    const serializedQueries = uniqueQueries.map((q) => ({
      query: q.searchQuery,
      videoCount: q._count.id,
      totalPlayCount: q._sum.playCount ? Number(q._sum.playCount) : 0,
    }));

    return NextResponse.json({
      success: true,
      videos: serializedVideos,
      availableHashtags: serializedQueries,
      total: serializedVideos.length,
    });
  } catch (err) {
    console.error("[TRENDS-TRENDING] Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to fetch trending videos",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
