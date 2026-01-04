import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";

// PATCH /api/v1/publishing/analytics/[id] - Manual analytics update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: postId } = await params;
    const body = await request.json();
    const {
      view_count,
      like_count,
      comment_count,
      share_count,
      save_count,
      engagement_rate,
    } = body;

    // Get the post
    const post = await withRetry(() => prisma.scheduledPost.findUnique({
      where: { id: postId },
      include: {
        socialAccount: true,
      },
    }));

    if (!post) {
      return NextResponse.json({ detail: "Post not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN" && !user.labelIds.includes(post.socialAccount.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      analyticsLastSyncedAt: new Date(),
    };

    if (view_count !== undefined) updateData.viewCount = view_count;
    if (like_count !== undefined) updateData.likeCount = like_count;
    if (comment_count !== undefined) updateData.commentCount = comment_count;
    if (share_count !== undefined) updateData.shareCount = share_count;
    if (save_count !== undefined) updateData.saveCount = save_count;
    if (engagement_rate !== undefined) {
      updateData.engagementRate = engagement_rate;
    } else if (view_count !== undefined && like_count !== undefined) {
      // Auto-calculate engagement rate if not provided
      const views = view_count || 0;
      const likes = like_count || 0;
      const comments = comment_count || post.commentCount || 0;
      const shares = share_count || post.shareCount || 0;
      const totalEngagements = likes + comments + shares;
      updateData.engagementRate = views > 0 ? (totalEngagements / views) * 100 : 0;
    }

    // Update post
    const updatedPost = await withRetry(() => prisma.scheduledPost.update({
      where: { id: postId },
      data: updateData,
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
    }));

    return NextResponse.json({
      id: updatedPost.id,
      campaign_id: updatedPost.campaignId,
      generation_id: updatedPost.generationId,
      platform: updatedPost.platform,
      status: updatedPost.status,
      caption: updatedPost.caption,
      hashtags: updatedPost.hashtags,
      thumbnail_url: updatedPost.thumbnailUrl,
      scheduled_at: updatedPost.scheduledAt?.toISOString() || null,
      published_at: updatedPost.publishedAt?.toISOString() || null,
      timezone: updatedPost.timezone,
      platform_settings: updatedPost.platformSettings,
      published_url: updatedPost.publishedUrl,
      platform_post_id: updatedPost.platformPostId,
      error_message: updatedPost.errorMessage,
      retry_count: updatedPost.retryCount,
      analytics: {
        view_count: updatedPost.viewCount,
        like_count: updatedPost.likeCount,
        comment_count: updatedPost.commentCount,
        share_count: updatedPost.shareCount,
        save_count: updatedPost.saveCount,
        engagement_rate: updatedPost.engagementRate,
        last_synced_at: updatedPost.analyticsLastSyncedAt?.toISOString() || null,
      },
      created_at: updatedPost.createdAt.toISOString(),
      updated_at: updatedPost.updatedAt.toISOString(),
      social_account: {
        id: updatedPost.socialAccount.id,
        platform: updatedPost.socialAccount.platform,
        account_name: updatedPost.socialAccount.accountName,
        profile_url: updatedPost.socialAccount.profileUrl,
      },
      generation: null,
    });
  } catch (error) {
    console.error("Update analytics error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/publishing/analytics/[id] - Get single post analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: postId } = await params;

    const post = await withRetry(() => prisma.scheduledPost.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            accountName: true,
            profileUrl: true,
            labelId: true,
          },
        },
      },
    }));

    if (!post) {
      return NextResponse.json({ detail: "Post not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN" && !user.labelIds.includes(post.socialAccount.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      id: post.id,
      campaign_id: post.campaignId,
      generation_id: post.generationId,
      platform: post.platform,
      status: post.status,
      caption: post.caption,
      hashtags: post.hashtags,
      thumbnail_url: post.thumbnailUrl,
      scheduled_at: post.scheduledAt?.toISOString() || null,
      published_at: post.publishedAt?.toISOString() || null,
      timezone: post.timezone,
      platform_settings: post.platformSettings,
      published_url: post.publishedUrl,
      platform_post_id: post.platformPostId,
      error_message: post.errorMessage,
      retry_count: post.retryCount,
      analytics: {
        view_count: post.viewCount,
        like_count: post.likeCount,
        comment_count: post.commentCount,
        share_count: post.shareCount,
        save_count: post.saveCount,
        engagement_rate: post.engagementRate,
        last_synced_at: post.analyticsLastSyncedAt?.toISOString() || null,
      },
      created_at: post.createdAt.toISOString(),
      updated_at: post.updatedAt.toISOString(),
      social_account: {
        id: post.socialAccount.id,
        platform: post.socialAccount.platform,
        account_name: post.socialAccount.accountName,
        profile_url: post.socialAccount.profileUrl,
      },
      generation: null,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
