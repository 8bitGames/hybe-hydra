import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { refreshAccessToken } from "@/lib/tiktok";

const TIKTOK_API_BASE = "https://open.tiktokapis.com";

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (!cronSecret) {
    console.warn("[CRON-ANALYTICS] CRON_SECRET not configured");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// Check if token needs refresh
function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  const bufferMs = 5 * 60 * 1000;
  return new Date().getTime() + bufferMs > expiresAt.getTime();
}

// Fetch TikTok video analytics
async function fetchTikTokVideoAnalytics(
  accessToken: string,
  videoIds: string[]
): Promise<{
  success: boolean;
  data?: Record<string, {
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
  }>;
  error?: string;
}> {
  try {
    // TikTok Video Query API
    // https://developers.tiktok.com/doc/tiktok-api-v2-video-query/
    const response = await fetch(`${TIKTOK_API_BASE}/v2/video/query/?fields=id,like_count,comment_count,share_count,view_count`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filters: {
          video_ids: videoIds,
        },
      }),
    });

    const result = await response.json();

    if (result.error?.code !== "ok") {
      return {
        success: false,
        error: result.error?.message || "Failed to fetch video analytics",
      };
    }

    const analytics: Record<string, {
      view_count: number;
      like_count: number;
      comment_count: number;
      share_count: number;
    }> = {};

    if (result.data?.videos) {
      for (const video of result.data.videos) {
        analytics[video.id] = {
          view_count: video.view_count || 0,
          like_count: video.like_count || 0,
          comment_count: video.comment_count || 0,
          share_count: video.share_count || 0,
        };
      }
    }

    return { success: true, data: analytics };
  } catch (error) {
    console.error("[CRON-ANALYTICS] TikTok API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(request: NextRequest) {
  console.log("[CRON-ANALYTICS] Cron job triggered at:", new Date().toISOString());

  if (!verifyCronSecret(request)) {
    console.error("[CRON-ANALYTICS] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find published TikTok posts that need analytics sync
    // Only sync posts published in the last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const publishedPosts = await prisma.scheduledPost.findMany({
      where: {
        status: "PUBLISHED",
        platform: "TIKTOK",
        platformPostId: { not: null },
        publishedAt: {
          gte: thirtyDaysAgo,
        },
        OR: [
          { analyticsLastSyncedAt: null },
          {
            analyticsLastSyncedAt: {
              // Sync if last sync was more than 4 hours ago
              lt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
            },
          },
        ],
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: true,
          },
        },
      },
      take: 50, // Process max 50 posts per run
      orderBy: {
        analyticsLastSyncedAt: { sort: "asc", nulls: "first" },
      },
    });

    if (publishedPosts.length === 0) {
      console.log("[CRON-ANALYTICS] No posts need analytics sync");
      return NextResponse.json({
        success: true,
        synced: 0,
        timestamp: now.toISOString(),
      });
    }

    console.log(`[CRON-ANALYTICS] Found ${publishedPosts.length} posts to sync`);

    // Group posts by social account for efficient API calls
    const postsByAccount = new Map<string, typeof publishedPosts>();
    for (const post of publishedPosts) {
      const accountId = post.socialAccount.id;
      if (!postsByAccount.has(accountId)) {
        postsByAccount.set(accountId, []);
      }
      postsByAccount.get(accountId)!.push(post);
    }

    let totalSynced = 0;
    let totalFailed = 0;
    const results: Array<{ postId: string; success: boolean; error?: string }> = [];

    for (const [accountId, posts] of postsByAccount) {
      const account = posts[0].socialAccount;

      if (!account.accessToken) {
        console.log(`[CRON-ANALYTICS] Skipping account ${accountId}: No access token`);
        for (const post of posts) {
          results.push({ postId: post.id, success: false, error: "No access token" });
          totalFailed++;
        }
        continue;
      }

      let accessToken = account.accessToken;

      // Refresh token if needed
      if (isTokenExpired(account.tokenExpiresAt)) {
        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

        if (clientKey && clientSecret && account.refreshToken) {
          const refreshResult = await refreshAccessToken(
            clientKey,
            clientSecret,
            account.refreshToken
          );

          if (refreshResult.success && refreshResult.accessToken) {
            await prisma.socialAccount.update({
              where: { id: accountId },
              data: {
                accessToken: refreshResult.accessToken,
                refreshToken: refreshResult.refreshToken || account.refreshToken,
                tokenExpiresAt: refreshResult.expiresIn
                  ? new Date(Date.now() + refreshResult.expiresIn * 1000)
                  : null,
              },
            });
            accessToken = refreshResult.accessToken;
          } else {
            console.log(`[CRON-ANALYTICS] Token refresh failed for account ${accountId}`);
            for (const post of posts) {
              results.push({ postId: post.id, success: false, error: "Token refresh failed" });
              totalFailed++;
            }
            continue;
          }
        } else {
          console.log(`[CRON-ANALYTICS] Cannot refresh token for account ${accountId}`);
          for (const post of posts) {
            results.push({ postId: post.id, success: false, error: "Token expired" });
            totalFailed++;
          }
          continue;
        }
      }

      // Fetch analytics for all posts from this account
      const videoIds = posts.map(p => p.platformPostId!).filter(Boolean);
      const analyticsResult = await fetchTikTokVideoAnalytics(accessToken, videoIds);

      if (!analyticsResult.success || !analyticsResult.data) {
        console.log(`[CRON-ANALYTICS] Failed to fetch analytics: ${analyticsResult.error}`);
        for (const post of posts) {
          results.push({ postId: post.id, success: false, error: analyticsResult.error });
          totalFailed++;
        }
        continue;
      }

      // Update each post with its analytics
      for (const post of posts) {
        const analytics = analyticsResult.data[post.platformPostId!];

        if (analytics) {
          // Calculate engagement rate
          const totalEngagements = analytics.like_count + analytics.comment_count + analytics.share_count;
          const engagementRate = analytics.view_count > 0
            ? (totalEngagements / analytics.view_count) * 100
            : 0;

          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              viewCount: analytics.view_count,
              likeCount: analytics.like_count,
              commentCount: analytics.comment_count,
              shareCount: analytics.share_count,
              engagementRate,
              analyticsLastSyncedAt: now,
            },
          });

          results.push({ postId: post.id, success: true });
          totalSynced++;
        } else {
          // Video not found in API response - might be deleted or not available
          results.push({ postId: post.id, success: false, error: "Video not found in API" });
          totalFailed++;
        }
      }
    }

    console.log(`[CRON-ANALYTICS] Completed: ${totalSynced} synced, ${totalFailed} failed`);

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      failed: totalFailed,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON-ANALYTICS] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
