import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL } from "@/lib/cache";

// GET /api/v1/dashboard/stats - Get global dashboard statistics across all campaigns
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Use cache for dashboard stats (60 second TTL)
    const cacheKey = CacheKeys.dashboardStats(user.id);
    const stats = await cached(cacheKey, CacheTTL.MEDIUM, async () => {
      return fetchDashboardStats(user.id, user.role, user.labelIds);
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// Extracted data fetching logic for caching
async function fetchDashboardStats(
  userId: string,
  role: string,
  labelIds: string[]
) {
  // Build where clause based on user role
  const campaignWhereClause = role === "ADMIN"
    ? {}
    : {
        artist: {
          labelId: { in: labelIds }
        }
      };

  // Get all campaigns with counts (needed for overview)
  const campaigns = await withRetry(() => prisma.campaign.findMany({
      where: campaignWhereClause,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            stageName: true,
            groupName: true,
          },
        },
        _count: {
          select: {
            assets: true,
            videoGenerations: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }));

  const campaignIds = campaigns.map(c => c.id);

  // Use database aggregations instead of fetching all records
  // This significantly reduces data transfer for large datasets
  const [
    // Generation stats via groupBy
    generationStatusCounts,
    generationScoreAgg,
    highQualityCount,
    // Post stats via groupBy
    postStatusCounts,
    postPlatformCounts,
    // SNS aggregates for published posts
    snsGlobalAgg,
    snsByPlatform,
    // Campaign stats via groupBy
    campaignStatusCounts,
    // Per-campaign generation counts (for overview)
    generationsByCampaign,
    // Per-campaign post counts (for overview)
    postsByCampaign,
    // Recent completed generations (limited fetch)
    recentCompletedGenerations,
    // Recent published posts (limited fetch)
    recentPublishedPosts,
  ] = await Promise.all([
    // Generation stats by status
    withRetry(() => prisma.videoGeneration.groupBy({
      by: ["status"],
      where: { campaignId: { in: campaignIds } },
      _count: true,
    })),
    // Generation score aggregate
    withRetry(() => prisma.videoGeneration.aggregate({
      where: { campaignId: { in: campaignIds }, qualityScore: { not: null } },
      _count: { qualityScore: true },
      _avg: { qualityScore: true },
    })),
    // High quality count (score >= 70)
    withRetry(() => prisma.videoGeneration.count({
      where: { campaignId: { in: campaignIds }, qualityScore: { gte: 70 } },
    })),
    // Post stats by status
    withRetry(() => prisma.scheduledPost.groupBy({
      by: ["status"],
      where: { campaignId: { in: campaignIds } },
      _count: true,
    })),
    // Post stats by platform
    withRetry(() => prisma.scheduledPost.groupBy({
      by: ["platform"],
      where: { campaignId: { in: campaignIds } },
      _count: true,
    })),
    // SNS global aggregate for published posts
    withRetry(() => prisma.scheduledPost.aggregate({
      where: { campaignId: { in: campaignIds }, status: "PUBLISHED" },
      _count: true,
      _sum: {
        viewCount: true,
        likeCount: true,
        commentCount: true,
        shareCount: true,
        saveCount: true,
      },
      _avg: { engagementRate: true },
    })),
    // SNS by platform for published posts
    withRetry(() => prisma.scheduledPost.groupBy({
      by: ["platform"],
      where: { campaignId: { in: campaignIds }, status: "PUBLISHED" },
      _count: true,
      _sum: { viewCount: true, likeCount: true },
    })),
    // Campaign stats by status
    withRetry(() => prisma.campaign.groupBy({
      by: ["status"],
      where: campaignWhereClause,
      _count: true,
    })),
    // Per-campaign generation counts with status breakdown
    withRetry(() => prisma.videoGeneration.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaignIds } },
      _count: true,
    })),
    // Per-campaign post counts with status breakdown
    withRetry(() => prisma.scheduledPost.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaignIds } },
      _count: true,
      _sum: { viewCount: true },
    })),
    // Recent completed generations (fetch only what we need)
    withRetry(() => prisma.videoGeneration.findMany({
      where: {
        campaignId: { in: campaignIds },
        status: "COMPLETED",
        OR: [
          { outputUrl: { not: null } },
          { composedOutputUrl: { not: null } },
        ],
      },
      select: {
        id: true,
        campaignId: true,
        prompt: true,
        outputUrl: true,
        composedOutputUrl: true,
        qualityScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })),
    // Recent published posts
    withRetry(() => prisma.scheduledPost.findMany({
      where: { campaignId: { in: campaignIds }, status: "PUBLISHED" },
      include: {
        socialAccount: { select: { accountName: true, platform: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
    })),
  ]);

  // Helper function to get count from groupBy result
  const getCount = <T extends { _count: number }>(
    arr: T[],
    key: keyof T,
    value: string
  ): number => {
    const found = arr.find((item) => item[key] === value);
    return found?._count || 0;
  };

  // Calculate total generations from groupBy
  const totalGenerations = generationStatusCounts.reduce((sum, g) => sum + g._count, 0);

  // Calculate generation statistics from aggregations
  const generationStats = {
    total: totalGenerations,
    by_status: {
      PENDING: getCount(generationStatusCounts, "status", "PENDING"),
      PROCESSING: getCount(generationStatusCounts, "status", "PROCESSING"),
      COMPLETED: getCount(generationStatusCounts, "status", "COMPLETED"),
      FAILED: getCount(generationStatusCounts, "status", "FAILED"),
      CANCELLED: getCount(generationStatusCounts, "status", "CANCELLED"),
    },
    scored: generationScoreAgg._count.qualityScore || 0,
    avg_quality_score: generationScoreAgg._avg.qualityScore,
    high_quality_count: highQualityCount,
  };

  // Calculate total posts from groupBy
  const totalPosts = postStatusCounts.reduce((sum, p) => sum + p._count, 0);

  // Calculate publishing statistics from aggregations
  const publishingStats = {
    total: totalPosts,
    by_status: {
      DRAFT: getCount(postStatusCounts, "status", "DRAFT"),
      SCHEDULED: getCount(postStatusCounts, "status", "SCHEDULED"),
      PUBLISHING: getCount(postStatusCounts, "status", "PUBLISHING"),
      PUBLISHED: getCount(postStatusCounts, "status", "PUBLISHED"),
      FAILED: getCount(postStatusCounts, "status", "FAILED"),
      CANCELLED: getCount(postStatusCounts, "status", "CANCELLED"),
    },
    by_platform: {
      TIKTOK: getCount(postPlatformCounts, "platform", "TIKTOK"),
      YOUTUBE: getCount(postPlatformCounts, "platform", "YOUTUBE"),
      INSTAGRAM: getCount(postPlatformCounts, "platform", "INSTAGRAM"),
      TWITTER: getCount(postPlatformCounts, "platform", "TWITTER"),
    },
  };

  // Helper to get SNS by platform stats
  const getSnsPlatformStats = (platform: string) => {
    const found = snsByPlatform.find((p) => p.platform === platform);
    return {
      posts: found?._count || 0,
      views: found?._sum.viewCount || 0,
      likes: found?._sum.likeCount || 0,
    };
  };

  // Calculate SNS analytics from aggregations
  const snsPerformance = {
    total_published: snsGlobalAgg._count || 0,
    total_views: snsGlobalAgg._sum.viewCount || 0,
    total_likes: snsGlobalAgg._sum.likeCount || 0,
    total_comments: snsGlobalAgg._sum.commentCount || 0,
    total_shares: snsGlobalAgg._sum.shareCount || 0,
    total_saves: snsGlobalAgg._sum.saveCount || 0,
    avg_engagement_rate: snsGlobalAgg._avg.engagementRate,
    by_platform: {
      TIKTOK: getSnsPlatformStats("TIKTOK"),
      YOUTUBE: getSnsPlatformStats("YOUTUBE"),
      INSTAGRAM: getSnsPlatformStats("INSTAGRAM"),
      TWITTER: getSnsPlatformStats("TWITTER"),
    },
  };

  // Campaign summary statistics from aggregations
  const campaignStats = {
    total: campaigns.length,
    by_status: {
      DRAFT: getCount(campaignStatusCounts, "status", "DRAFT"),
      ACTIVE: getCount(campaignStatusCounts, "status", "ACTIVE"),
      COMPLETED: getCount(campaignStatusCounts, "status", "COMPLETED"),
      ARCHIVED: getCount(campaignStatusCounts, "status", "ARCHIVED"),
    },
  };

  // Build lookup maps for per-campaign counts
  const genCountMap = new Map<string, { total: number; completed: number; processing: number }>();
  for (const g of generationsByCampaign) {
    if (!g.campaignId) continue; // Skip entries without campaignId
    const existing = genCountMap.get(g.campaignId) || { total: 0, completed: 0, processing: 0 };
    existing.total += g._count;
    if (g.status === "COMPLETED") existing.completed = g._count;
    if (g.status === "PROCESSING") existing.processing = g._count;
    genCountMap.set(g.campaignId, existing);
  }

  const postCountMap = new Map<string, { published: number; scheduled: number; views: number }>();
  for (const p of postsByCampaign) {
    const existing = postCountMap.get(p.campaignId) || { published: 0, scheduled: 0, views: 0 };
    if (p.status === "PUBLISHED") {
      existing.published = p._count;
      existing.views = p._sum.viewCount || 0;
    }
    if (p.status === "SCHEDULED") existing.scheduled = p._count;
    postCountMap.set(p.campaignId, existing);
  }

  // Per-campaign overview using lookup maps
  const campaignsOverview = campaigns.map(campaign => {
    const genStats = genCountMap.get(campaign.id) || { total: 0, completed: 0, processing: 0 };
    const postStats = postCountMap.get(campaign.id) || { published: 0, scheduled: 0, views: 0 };

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status.toLowerCase(),
      artist_name: campaign.artist.stageName || campaign.artist.name,
      artist_group: campaign.artist.groupName,
      asset_count: campaign._count.assets,
      generation_count: genStats.total,
      completed_generations: genStats.completed,
      processing_generations: genStats.processing,
      published_count: postStats.published,
      scheduled_count: postStats.scheduled,
      total_views: postStats.views,
      updated_at: campaign.updatedAt.toISOString(),
    };
  });

  // Map campaigns for lookup
  const campaignMap = new Map(campaigns.map(c => [c.id, c.name]));

  // Recent completed generations
  const recentGenerations = recentCompletedGenerations.map(g => ({
    id: g.id,
    campaign_id: g.campaignId,
    campaign_name: (g.campaignId ? campaignMap.get(g.campaignId) : null) || "Unknown",
    prompt: g.prompt,
    output_url: g.outputUrl,
    composed_output_url: g.composedOutputUrl,
    quality_score: g.qualityScore,
    created_at: g.createdAt.toISOString(),
  }));

  // Recent published posts
  const recentPublished = recentPublishedPosts.map(p => ({
    id: p.id,
    campaign_id: p.campaignId,
    campaign_name: campaignMap.get(p.campaignId) || "Unknown",
    platform: p.platform,
    account_name: p.socialAccount.accountName,
    published_url: p.publishedUrl,
    view_count: p.viewCount,
    like_count: p.likeCount,
    published_at: p.publishedAt?.toISOString() || null,
  }));

  // Return data object (will be cached)
  return {
    summary: {
      campaigns: campaignStats,
      generations: generationStats,
      publishing: publishingStats,
    },
    sns_performance: snsPerformance,
    campaigns_overview: campaignsOverview,
    recent_activity: {
      generations: recentGenerations,
      published: recentPublished,
    },
  };
}
