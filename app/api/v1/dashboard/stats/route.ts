import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL } from "@/lib/cache";

// GET /api/v1/dashboard/stats - Get global dashboard statistics across all campaigns
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

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

  // Get all campaigns with counts
  const campaigns = await prisma.campaign.findMany({
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
    });

    const campaignIds = campaigns.map(c => c.id);

    // Get all video generations for these campaigns (exclude soft-deleted)
    const generations = await prisma.videoGeneration.findMany({
      where: { campaignId: { in: campaignIds }, deletedAt: null },
      select: {
        id: true,
        campaignId: true,
        status: true,
        progress: true,
        qualityScore: true,
        outputUrl: true,
        composedOutputUrl: true,
        prompt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all scheduled posts for these campaigns
    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: { campaignId: { in: campaignIds } },
      include: {
        socialAccount: {
          select: {
            accountName: true,
            platform: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate generation statistics
    const generationStats = {
      total: generations.length,
      by_status: {
        PENDING: generations.filter(g => g.status === "PENDING").length,
        PROCESSING: generations.filter(g => g.status === "PROCESSING").length,
        COMPLETED: generations.filter(g => g.status === "COMPLETED").length,
        FAILED: generations.filter(g => g.status === "FAILED").length,
        CANCELLED: generations.filter(g => g.status === "CANCELLED").length,
      },
      scored: generations.filter(g => g.qualityScore !== null).length,
      avg_quality_score: (() => {
        const scored = generations.filter(g => g.qualityScore !== null);
        if (scored.length === 0) return null;
        return scored.reduce((sum, g) => sum + (g.qualityScore || 0), 0) / scored.length;
      })(),
      high_quality_count: generations.filter(g => (g.qualityScore || 0) >= 70).length,
    };

    // Calculate publishing statistics
    const publishingStats = {
      total: scheduledPosts.length,
      by_status: {
        DRAFT: scheduledPosts.filter(p => p.status === "DRAFT").length,
        SCHEDULED: scheduledPosts.filter(p => p.status === "SCHEDULED").length,
        PUBLISHING: scheduledPosts.filter(p => p.status === "PUBLISHING").length,
        PUBLISHED: scheduledPosts.filter(p => p.status === "PUBLISHED").length,
        FAILED: scheduledPosts.filter(p => p.status === "FAILED").length,
        CANCELLED: scheduledPosts.filter(p => p.status === "CANCELLED").length,
      },
      by_platform: {
        TIKTOK: scheduledPosts.filter(p => p.platform === "TIKTOK").length,
        YOUTUBE: scheduledPosts.filter(p => p.platform === "YOUTUBE").length,
        INSTAGRAM: scheduledPosts.filter(p => p.platform === "INSTAGRAM").length,
        TWITTER: scheduledPosts.filter(p => p.platform === "TWITTER").length,
      },
    };

    // Calculate SNS analytics
    const publishedPosts = scheduledPosts.filter(p => p.status === "PUBLISHED");
    const snsPerformance = {
      total_published: publishedPosts.length,
      total_views: publishedPosts.reduce((sum, p) => sum + (p.viewCount || 0), 0),
      total_likes: publishedPosts.reduce((sum, p) => sum + (p.likeCount || 0), 0),
      total_comments: publishedPosts.reduce((sum, p) => sum + (p.commentCount || 0), 0),
      total_shares: publishedPosts.reduce((sum, p) => sum + (p.shareCount || 0), 0),
      total_saves: publishedPosts.reduce((sum, p) => sum + (p.saveCount || 0), 0),
      avg_engagement_rate: (() => {
        const withEngagement = publishedPosts.filter(p => p.engagementRate !== null);
        if (withEngagement.length === 0) return null;
        return withEngagement.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / withEngagement.length;
      })(),
      by_platform: {
        TIKTOK: {
          posts: publishedPosts.filter(p => p.platform === "TIKTOK").length,
          views: publishedPosts.filter(p => p.platform === "TIKTOK").reduce((sum, p) => sum + (p.viewCount || 0), 0),
          likes: publishedPosts.filter(p => p.platform === "TIKTOK").reduce((sum, p) => sum + (p.likeCount || 0), 0),
        },
        YOUTUBE: {
          posts: publishedPosts.filter(p => p.platform === "YOUTUBE").length,
          views: publishedPosts.filter(p => p.platform === "YOUTUBE").reduce((sum, p) => sum + (p.viewCount || 0), 0),
          likes: publishedPosts.filter(p => p.platform === "YOUTUBE").reduce((sum, p) => sum + (p.likeCount || 0), 0),
        },
        INSTAGRAM: {
          posts: publishedPosts.filter(p => p.platform === "INSTAGRAM").length,
          views: publishedPosts.filter(p => p.platform === "INSTAGRAM").reduce((sum, p) => sum + (p.viewCount || 0), 0),
          likes: publishedPosts.filter(p => p.platform === "INSTAGRAM").reduce((sum, p) => sum + (p.likeCount || 0), 0),
        },
        TWITTER: {
          posts: publishedPosts.filter(p => p.platform === "TWITTER").length,
          views: publishedPosts.filter(p => p.platform === "TWITTER").reduce((sum, p) => sum + (p.viewCount || 0), 0),
          likes: publishedPosts.filter(p => p.platform === "TWITTER").reduce((sum, p) => sum + (p.likeCount || 0), 0),
        },
      },
    };

    // Campaign summary statistics
    const campaignStats = {
      total: campaigns.length,
      by_status: {
        DRAFT: campaigns.filter(c => c.status === "DRAFT").length,
        ACTIVE: campaigns.filter(c => c.status === "ACTIVE").length,
        COMPLETED: campaigns.filter(c => c.status === "COMPLETED").length,
        ARCHIVED: campaigns.filter(c => c.status === "ARCHIVED").length,
      },
    };

    // Per-campaign overview with generation/publishing counts
    const campaignsOverview = campaigns.map(campaign => {
      const campaignGenerations = generations.filter(g => g.campaignId === campaign.id);
      const campaignPosts = scheduledPosts.filter(p => p.campaignId === campaign.id);
      const campaignPublished = campaignPosts.filter(p => p.status === "PUBLISHED");

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status.toLowerCase(),
        artist_name: campaign.artist.stageName || campaign.artist.name,
        artist_group: campaign.artist.groupName,
        asset_count: campaign._count.assets,
        generation_count: campaignGenerations.length,
        completed_generations: campaignGenerations.filter(g => g.status === "COMPLETED").length,
        processing_generations: campaignGenerations.filter(g => g.status === "PROCESSING").length,
        published_count: campaignPublished.length,
        scheduled_count: campaignPosts.filter(p => p.status === "SCHEDULED").length,
        total_views: campaignPublished.reduce((sum, p) => sum + (p.viewCount || 0), 0),
        updated_at: campaign.updatedAt.toISOString(),
      };
    });

    // Recent activity (increased limit to show all completed videos including compose)
    const recentGenerations = generations
      .filter(g => g.status === "COMPLETED" && (g.outputUrl || g.composedOutputUrl))
      .slice(0, 50)
      .map(g => {
        const campaign = campaigns.find(c => c.id === g.campaignId);
        return {
          id: g.id,
          campaign_id: g.campaignId,
          campaign_name: campaign?.name || "Unknown",
          prompt: g.prompt,
          output_url: g.outputUrl,
          composed_output_url: g.composedOutputUrl,
          quality_score: g.qualityScore,
          created_at: g.createdAt.toISOString(),
        };
      });

    const recentPublished = publishedPosts
      .slice(0, 5)
      .map(p => {
        const campaign = campaigns.find(c => c.id === p.campaignId);
        return {
          id: p.id,
          campaign_id: p.campaignId,
          campaign_name: campaign?.name || "Unknown",
          platform: p.platform,
          account_name: p.socialAccount.accountName,
          published_url: p.publishedUrl,
          view_count: p.viewCount,
          like_count: p.likeCount,
          published_at: p.publishedAt?.toISOString() || null,
        };
      });

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
