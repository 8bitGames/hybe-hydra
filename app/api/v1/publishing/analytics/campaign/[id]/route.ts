import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { PublishPlatform } from "@prisma/client";

// GET /api/v1/publishing/analytics/campaign/[id] - Get campaign analytics summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Get campaign with published posts
    const campaign = await withRetry(() => prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        artist: {
          select: {
            labelId: true,
          },
        },
      },
    }));

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Get all published posts for this campaign
    const posts = await withRetry(() => prisma.scheduledPost.findMany({
      where: {
        campaignId,
        status: "PUBLISHED",
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            accountName: true,
            profileUrl: true,
          },
        },
      },
      orderBy: { viewCount: "desc" },
    }));

    // Calculate totals
    const totals = posts.reduce(
      (acc, post) => ({
        views: acc.views + (post.viewCount || 0),
        likes: acc.likes + (post.likeCount || 0),
        comments: acc.comments + (post.commentCount || 0),
        shares: acc.shares + (post.shareCount || 0),
        saves: acc.saves + (post.saveCount || 0),
        engagementSum: acc.engagementSum + (post.engagementRate || 0),
        engagementCount: acc.engagementCount + (post.engagementRate ? 1 : 0),
      }),
      { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementSum: 0, engagementCount: 0 }
    );

    // Calculate by platform
    const platformStats: Record<string, {
      posts: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      engagement_rate: number;
    }> = {};

    const platforms: PublishPlatform[] = ["TIKTOK", "YOUTUBE", "INSTAGRAM", "TWITTER"];
    platforms.forEach((platform) => {
      const platformPosts = posts.filter((p) => p.platform === platform);
      const platformTotals = platformPosts.reduce(
        (acc, p) => ({
          views: acc.views + (p.viewCount || 0),
          likes: acc.likes + (p.likeCount || 0),
          comments: acc.comments + (p.commentCount || 0),
          shares: acc.shares + (p.shareCount || 0),
          engagementSum: acc.engagementSum + (p.engagementRate || 0),
        }),
        { views: 0, likes: 0, comments: 0, shares: 0, engagementSum: 0 }
      );

      platformStats[platform] = {
        posts: platformPosts.length,
        views: platformTotals.views,
        likes: platformTotals.likes,
        comments: platformTotals.comments,
        shares: platformTotals.shares,
        engagement_rate: platformPosts.length > 0
          ? platformTotals.engagementSum / platformPosts.length
          : 0,
      };
    });

    // Get total posts count (including non-published)
    const totalPosts = await withRetry(() => prisma.scheduledPost.count({
      where: { campaignId },
    }));

    // Top 5 posts
    const topPosts = posts.slice(0, 5).map((p) => ({
      id: p.id,
      campaign_id: p.campaignId,
      generation_id: p.generationId,
      platform: p.platform,
      status: p.status,
      caption: p.caption,
      hashtags: p.hashtags,
      thumbnail_url: p.thumbnailUrl,
      scheduled_at: p.scheduledAt?.toISOString() || null,
      published_at: p.publishedAt?.toISOString() || null,
      timezone: p.timezone,
      platform_settings: p.platformSettings,
      published_url: p.publishedUrl,
      platform_post_id: p.platformPostId,
      error_message: p.errorMessage,
      retry_count: p.retryCount,
      analytics: {
        view_count: p.viewCount,
        like_count: p.likeCount,
        comment_count: p.commentCount,
        share_count: p.shareCount,
        save_count: p.saveCount,
        engagement_rate: p.engagementRate,
        last_synced_at: p.analyticsLastSyncedAt?.toISOString() || null,
      },
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
      social_account: {
        id: p.socialAccount.id,
        platform: p.socialAccount.platform,
        account_name: p.socialAccount.accountName,
        profile_url: p.socialAccount.profileUrl,
      },
    }));

    return NextResponse.json({
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      total_posts: totalPosts,
      published_posts: posts.length,
      total_views: totals.views,
      total_likes: totals.likes,
      total_comments: totals.comments,
      total_shares: totals.shares,
      total_saves: totals.saves,
      avg_engagement_rate: totals.engagementCount > 0
        ? totals.engagementSum / totals.engagementCount
        : 0,
      by_platform: platformStats,
      top_posts: topPosts,
    });
  } catch (error) {
    console.error("Get campaign analytics error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
