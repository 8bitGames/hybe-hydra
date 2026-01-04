import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { TrendPlatform } from "@prisma/client";

interface VideoData {
  id: string;
  description: string;
  author: { uniqueId: string; nickname: string };
  stats: { playCount: number; likeCount?: number; commentCount?: number; shareCount?: number };
  hashtags?: string[];
  videoUrl?: string;
}

// POST /api/v1/trends/videos - Save trend videos to database
export async function POST(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      videos,
      searchQuery,
      searchType,
      platform = "TIKTOK",
    } = body as {
      videos: VideoData[];
      searchQuery: string;
      searchType: "keyword" | "hashtag";
      platform?: TrendPlatform;
    };

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { detail: "No videos provided" },
        { status: 400 }
      );
    }

    if (!searchQuery || !searchType) {
      return NextResponse.json(
        { detail: "Missing searchQuery or searchType" },
        { status: 400 }
      );
    }

    console.log(`[TRENDS-VIDEOS] Saving ${videos.length} videos for query "${searchQuery}" (${searchType})`);

    // Prepare video data for insertion
    const videoData = videos.map((video) => {
      const videoUrl = video.videoUrl ||
        (video.author.uniqueId
          ? `https://www.tiktok.com/@${video.author.uniqueId}/video/${video.id}`
          : `https://www.tiktok.com/video/${video.id}`);

      return {
        platform: platform as TrendPlatform,
        videoId: video.id,
        searchQuery,
        searchType,
        description: video.description || null,
        authorId: video.author.uniqueId,
        authorName: video.author.nickname,
        playCount: video.stats.playCount ? BigInt(Math.floor(video.stats.playCount)) : null,
        likeCount: video.stats.likeCount ? BigInt(Math.floor(video.stats.likeCount)) : null,
        commentCount: video.stats.commentCount ? BigInt(Math.floor(video.stats.commentCount)) : null,
        shareCount: video.stats.shareCount ? BigInt(Math.floor(video.stats.shareCount)) : null,
        hashtags: video.hashtags || [],
        videoUrl,
      };
    });

    // Use upsert to handle duplicates
    let savedCount = 0;
    const updatedCount = 0;

    for (const data of videoData) {
      try {
        await withRetry(() => prisma.trendVideo.upsert({
          where: {
            platform_videoId: {
              platform: data.platform,
              videoId: data.videoId,
            },
          },
          update: {
            searchQuery: data.searchQuery,
            searchType: data.searchType,
            description: data.description,
            authorName: data.authorName,
            playCount: data.playCount,
            likeCount: data.likeCount,
            commentCount: data.commentCount,
            shareCount: data.shareCount,
            hashtags: data.hashtags,
            videoUrl: data.videoUrl,
          },
          create: data,
        }));
        savedCount++;
      } catch (err) {
        console.error(`[TRENDS-VIDEOS] Failed to save video ${data.videoId}:`, err);
      }
    }

    console.log(`[TRENDS-VIDEOS] Saved/updated ${savedCount} videos`);

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${savedCount} videos`,
      saved_count: savedCount,
      updated_count: updatedCount,
      total: videos.length,
    });
  } catch (err) {
    console.error("[TRENDS-VIDEOS] Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to save videos",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/v1/trends/videos - Get saved trend videos
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("query");
    const searchType = searchParams.get("type");
    const platform = searchParams.get("platform") || "TIKTOK";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: {
      platform?: TrendPlatform;
      searchQuery?: string;
      searchType?: string;
    } = {
      platform: platform as TrendPlatform,
    };

    if (searchQuery) {
      where.searchQuery = searchQuery;
    }
    if (searchType) {
      where.searchType = searchType;
    }

    const [videos, total] = await Promise.all([
      prisma.trendVideo.findMany({
        where,
        orderBy: { playCount: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.trendVideo.count({ where }),
    ]);

    // Convert BigInt to number for JSON serialization
    const serializedVideos = videos.map((v) => ({
      ...v,
      playCount: v.playCount ? Number(v.playCount) : null,
      likeCount: v.likeCount ? Number(v.likeCount) : null,
      commentCount: v.commentCount ? Number(v.commentCount) : null,
      shareCount: v.shareCount ? Number(v.shareCount) : null,
    }));

    return NextResponse.json({
      success: true,
      videos: serializedVideos,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[TRENDS-VIDEOS] GET Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to fetch videos",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
