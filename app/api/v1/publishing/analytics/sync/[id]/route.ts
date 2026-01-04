import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";

// POST /api/v1/publishing/analytics/sync/[id] - Sync analytics for a single post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: postId } = await params;

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

    if (post.status !== "PUBLISHED") {
      return NextResponse.json(
        {
          post_id: postId,
          success: false,
          error: "Post is not published yet",
        }
      );
    }

    if (!post.publishedUrl || !post.platformPostId) {
      return NextResponse.json(
        {
          post_id: postId,
          success: false,
          error: "No published URL or platform post ID available",
        }
      );
    }

    // TODO: Implement actual SNS API calls for each platform
    // For now, simulate fetching analytics from SNS platforms
    // In production, this would call TikTok API, YouTube API, Instagram API, etc.

    let analytics;
    try {
      // Placeholder for actual API integration
      // Each platform would have its own SDK/API call
      switch (post.platform) {
        case "TIKTOK":
          // analytics = await fetchTikTokAnalytics(post.platformPostId, post.socialAccount.accessToken);
          break;
        case "YOUTUBE":
          // analytics = await fetchYouTubeAnalytics(post.platformPostId, post.socialAccount.accessToken);
          break;
        case "INSTAGRAM":
          // analytics = await fetchInstagramAnalytics(post.platformPostId, post.socialAccount.accessToken);
          break;
        case "TWITTER":
          // analytics = await fetchTwitterAnalytics(post.platformPostId, post.socialAccount.accessToken);
          break;
      }

      // For demo purposes, we'll return a message indicating manual update is needed
      // until SNS API integration is implemented
      return NextResponse.json({
        post_id: postId,
        success: false,
        error: `${post.platform} API integration pending. Use manual update for now.`,
        analytics: {
          view_count: post.viewCount,
          like_count: post.likeCount,
          comment_count: post.commentCount,
          share_count: post.shareCount,
          save_count: post.saveCount,
          engagement_rate: post.engagementRate,
          last_synced_at: post.analyticsLastSyncedAt?.toISOString() || null,
        },
      });
    } catch {
      return NextResponse.json({
        post_id: postId,
        success: false,
        error: "Failed to fetch analytics from platform",
      });
    }
  } catch (error) {
    console.error("Sync post analytics error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
