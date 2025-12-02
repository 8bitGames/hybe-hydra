import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform, Prisma } from "@prisma/client";
import { cached, CacheKeys, CacheTTL } from "@/lib/cache";

// GET /api/v1/trends - Get trending content from social platforms
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") as TrendPlatform | null;
    const region = searchParams.get("region") || "KR";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const hoursAgo = parseInt(searchParams.get("hours_ago") || "24");

    // Cache key for trends (15 min TTL)
    const cacheKey = CacheKeys.trendsPlatform(platform || "all", region);

    // Use cache for trends data
    const result = await cached(cacheKey, CacheTTL.TRENDS, async () => {
      return fetchTrendsData(platform, region, limit, hoursAgo);
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get trends error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// Extracted data fetching logic for caching
async function fetchTrendsData(
  platform: TrendPlatform | null,
  region: string,
  limit: number,
  hoursAgo: number
) {
  // Calculate the time threshold for fresh trends
  const timeThreshold = new Date();
  timeThreshold.setHours(timeThreshold.getHours() - hoursAgo);

  // Build where clause
  const whereClause: Record<string, unknown> = {
    region,
    collectedAt: {
      gte: timeThreshold,
    },
  };

  if (platform) {
    whereClause.platform = platform;
  }

  // Get latest trends, ordered by rank
  const trends = await prisma.trendSnapshot.findMany({
    where: whereClause,
    orderBy: [
      { collectedAt: "desc" },
      { rank: "asc" },
    ],
    take: limit,
  });

  // Group by platform for easier consumption
  const groupedByPlatform = trends.reduce((acc, trend) => {
    if (!acc[trend.platform]) {
      acc[trend.platform] = [];
    }
    acc[trend.platform].push({
      id: trend.id,
      keyword: trend.keyword,
      rank: trend.rank,
      view_count: trend.viewCount?.toString() || null,
      video_count: trend.videoCount,
      description: trend.description,
      hashtags: trend.hashtags,
      trend_url: trend.trendUrl,
      thumbnail_url: trend.thumbnailUrl,
      collected_at: trend.collectedAt.toISOString(),
    });
    return acc;
  }, {} as Record<string, unknown[]>);

  // Get platform statistics
  const platformStats = await prisma.trendSnapshot.groupBy({
    by: ["platform"],
    where: {
      region,
      collectedAt: {
        gte: timeThreshold,
      },
    },
    _count: {
      id: true,
    },
  });

  // Return data object (will be cached)
  return {
    region,
    time_range_hours: hoursAgo,
    total_count: trends.length,
    platform_stats: platformStats.map((stat) => ({
      platform: stat.platform,
      count: stat._count.id,
    })),
    trends: platform ? trends.map((t) => ({
      id: t.id,
      platform: t.platform,
      keyword: t.keyword,
      rank: t.rank,
      view_count: t.viewCount?.toString() || null,
      video_count: t.videoCount,
      description: t.description,
      hashtags: t.hashtags,
      trend_url: t.trendUrl,
      thumbnail_url: t.thumbnailUrl,
      collected_at: t.collectedAt.toISOString(),
    })) : groupedByPlatform,
  };
}

// POST /api/v1/trends - Create new trend snapshots (admin only)
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

    const body = await request.json();
    const { trends } = body;

    if (!Array.isArray(trends) || trends.length === 0) {
      return NextResponse.json(
        { detail: "Invalid request: trends array required" },
        { status: 400 }
      );
    }

    // Validate and prepare trend data
    const trendData = trends.map((trend: {
      platform: TrendPlatform;
      keyword: string;
      rank: number;
      region?: string;
      view_count?: string | number;
      video_count?: number;
      description?: string;
      hashtags?: string[];
      metadata?: Record<string, unknown>;
      trend_url?: string;
      thumbnail_url?: string;
    }) => ({
      platform: trend.platform,
      keyword: trend.keyword,
      rank: trend.rank,
      region: trend.region || "KR",
      viewCount: trend.view_count ? BigInt(trend.view_count) : null,
      videoCount: trend.video_count || null,
      description: trend.description || null,
      hashtags: trend.hashtags || [],
      metadata: trend.metadata ? (trend.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      trendUrl: trend.trend_url || null,
      thumbnailUrl: trend.thumbnail_url || null,
    }));

    // Create trends in batch
    const created = await prisma.trendSnapshot.createMany({
      data: trendData,
      skipDuplicates: true,
    });

    return NextResponse.json({
      message: "Trends created successfully",
      created_count: created.count,
    });
  } catch (error) {
    console.error("Create trends error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
