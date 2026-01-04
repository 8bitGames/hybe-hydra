import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { TrendPlatform } from "@prisma/client";

interface RouteParams {
  params: Promise<{ platform: string }>;
}

// GET /api/v1/trends/[platform] - Get trends for a specific platform
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { platform: platformParam } = await params;
    const platform = platformParam.toUpperCase() as TrendPlatform;

    // Validate platform
    if (!Object.values(TrendPlatform).includes(platform)) {
      return NextResponse.json(
        { detail: `Invalid platform. Must be one of: ${Object.values(TrendPlatform).join(", ")}` },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || "KR";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const hoursAgo = parseInt(searchParams.get("hours_ago") || "24");

    // Calculate the time threshold for fresh trends
    const timeThreshold = new Date();
    timeThreshold.setHours(timeThreshold.getHours() - hoursAgo);

    // Get latest trends for the platform
    const trends = await withRetry(() => prisma.trendSnapshot.findMany({
      where: {
        platform,
        region,
        collectedAt: {
          gte: timeThreshold,
        },
      },
      orderBy: [
        { collectedAt: "desc" },
        { rank: "asc" },
      ],
      take: limit,
    }));

    // Calculate some statistics
    const totalViewCount = trends.reduce((sum, t) => {
      return sum + (t.viewCount ? Number(t.viewCount) : 0);
    }, 0);

    const avgVideoCount = trends.length > 0
      ? Math.round(trends.reduce((sum, t) => sum + (t.videoCount || 0), 0) / trends.length)
      : 0;

    return NextResponse.json({
      platform,
      region,
      time_range_hours: hoursAgo,
      total_count: trends.length,
      statistics: {
        total_view_count: totalViewCount.toString(),
        average_video_count: avgVideoCount,
      },
      trends: trends.map((t) => ({
        id: t.id,
        keyword: t.keyword,
        rank: t.rank,
        view_count: t.viewCount?.toString() || null,
        video_count: t.videoCount,
        description: t.description,
        hashtags: t.hashtags,
        metadata: t.metadata,
        trend_url: t.trendUrl,
        thumbnail_url: t.thumbnailUrl,
        collected_at: t.collectedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get platform trends error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
