import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { PublishPlatform, Prisma } from "@prisma/client";

// GET /api/v1/publishing/analytics/posts - Get published posts with analytics
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");
    const platform = searchParams.get("platform") as PublishPlatform | null;
    const sortBy = searchParams.get("sort_by") || "date";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");

    // Build where clause
    const where: Prisma.ScheduledPostWhereInput = {
      status: "PUBLISHED",
    };

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (platform) {
      where.platform = platform;
    }

    // RBAC: Non-admin users can only see posts from their labels
    if (user.role !== "ADMIN") {
      where.socialAccount = {
        labelId: { in: user.labelIds },
      };
    }

    // Build order by
    let orderBy: Prisma.ScheduledPostOrderByWithRelationInput;
    switch (sortBy) {
      case "views":
        orderBy = { viewCount: "desc" };
        break;
      case "likes":
        orderBy = { likeCount: "desc" };
        break;
      case "engagement":
        orderBy = { engagementRate: "desc" };
        break;
      case "date":
      default:
        orderBy = { publishedAt: "desc" };
    }

    // Get total count
    const total = await withRetry(() => prisma.scheduledPost.count({ where }));

    // Get posts
    const posts = await withRetry(() => prisma.scheduledPost.findMany({
      where,
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
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }));

    const pages = Math.ceil(total / pageSize) || 1;

    const items = posts.map((p) => ({
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
      generation: null, // Simplified for performance
    }));

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      pages,
    });
  } catch (error) {
    console.error("Get analytics posts error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
