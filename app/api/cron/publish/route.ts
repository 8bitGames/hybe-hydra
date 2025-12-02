import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  publishVideoToTikTokInbox,
  refreshAccessToken,
} from "@/lib/tiktok";

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (!cronSecret) {
    console.warn("[CRON-PUBLISH] CRON_SECRET not configured");
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

// Execute publish for a single post (Inbox Upload mode)
async function executePublish(
  postId: string,
  socialAccountId: string,
  videoUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const account = await prisma.socialAccount.findUnique({
      where: { id: socialAccountId },
    });

    if (!account || !account.accessToken) {
      await prisma.scheduledPost.update({
        where: { id: postId },
        data: {
          status: "FAILED",
          errorMessage: "Social account not found or not connected",
          retryCount: { increment: 1 },
        },
      });
      return { success: false, error: "Social account not found" };
    }

    let accessToken = account.accessToken;

    // Check if token needs refresh
    if (isTokenExpired(account.tokenExpiresAt)) {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

      if (!clientKey || !clientSecret || !account.refreshToken) {
        await prisma.scheduledPost.update({
          where: { id: postId },
          data: {
            status: "FAILED",
            errorMessage: "Token expired and refresh credentials not available",
            retryCount: { increment: 1 },
          },
        });
        return { success: false, error: "Token expired" };
      }

      const refreshResult = await refreshAccessToken(
        clientKey,
        clientSecret,
        account.refreshToken
      );

      if (!refreshResult.success) {
        await prisma.scheduledPost.update({
          where: { id: postId },
          data: {
            status: "FAILED",
            errorMessage: `Token refresh failed: ${refreshResult.error}`,
            retryCount: { increment: 1 },
          },
        });
        return { success: false, error: `Token refresh failed: ${refreshResult.error}` };
      }

      // Update stored tokens
      await prisma.socialAccount.update({
        where: { id: socialAccountId },
        data: {
          accessToken: refreshResult.accessToken,
          refreshToken: refreshResult.refreshToken || account.refreshToken,
          tokenExpiresAt: refreshResult.expiresIn
            ? new Date(Date.now() + refreshResult.expiresIn * 1000)
            : null,
        },
      });

      accessToken = refreshResult.accessToken!;
    }

    // Use Inbox Upload method for Sandbox mode compatibility
    // This sends the video to user's TikTok inbox as a draft
    // Note: Caption and settings are not used in inbox upload
    console.log(`[CRON-PUBLISH] Using Inbox Upload method for post ${postId}`);

    const result = await publishVideoToTikTokInbox(
      accessToken,
      videoUrl
    );

    if (result.success) {
      await prisma.scheduledPost.update({
        where: { id: postId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          platformPostId: result.postId,
          publishedUrl: result.postUrl,
          errorMessage: null,
        },
      });
      return { success: true };
    } else {
      await prisma.scheduledPost.update({
        where: { id: postId },
        data: {
          status: "FAILED",
          errorMessage: result.error || "Unknown publish error",
          retryCount: { increment: 1 },
        },
      });
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error(`[CRON-PUBLISH] Error publishing post ${postId}:`, error);
    await prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        retryCount: { increment: 1 },
      },
    });
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function GET(request: NextRequest) {
  console.log("[CRON-PUBLISH] Cron job triggered at:", new Date().toISOString());

  if (!verifyCronSecret(request)) {
    console.error("[CRON-PUBLISH] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find scheduled posts that are due
    const duePosts = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          lte: now,
        },
        retryCount: {
          lt: 3, // Max 3 retries
        },
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            accessToken: true,
            tokenExpiresAt: true,
            refreshToken: true,
          },
        },
        generation: {
          select: {
            id: true,
            outputUrl: true,
            composedOutputUrl: true,
            status: true,
          },
        },
      },
      take: 10, // Process max 10 posts per run
      orderBy: {
        scheduledAt: "asc",
      },
    });

    if (duePosts.length === 0) {
      console.log("[CRON-PUBLISH] No posts due for publishing");
      return NextResponse.json({
        success: true,
        processed: 0,
        timestamp: now.toISOString(),
      });
    }

    console.log(`[CRON-PUBLISH] Found ${duePosts.length} posts due for publishing`);

    const results: Array<{ postId: string; success: boolean; error?: string }> = [];

    for (const post of duePosts) {
      // Skip if platform is not TikTok (for now)
      if (post.platform !== "TIKTOK") {
        console.log(`[CRON-PUBLISH] Skipping post ${post.id}: ${post.platform} not supported yet`);
        results.push({ postId: post.id, success: false, error: `${post.platform} not supported` });
        continue;
      }

      // Get video URL (prefer composed output if available)
      const videoUrl = post.generation?.composedOutputUrl || post.generation?.outputUrl;

      if (!videoUrl) {
        console.log(`[CRON-PUBLISH] Skipping post ${post.id}: No video URL available`);
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "FAILED",
            errorMessage: "No video URL available",
          },
        });
        results.push({ postId: post.id, success: false, error: "No video URL" });
        continue;
      }

      // Mark as publishing
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHING" },
      });

      // Execute publish (Inbox Upload - sends to user's TikTok inbox)
      const result = await executePublish(
        post.id,
        post.socialAccount.id,
        videoUrl
      );

      results.push({
        postId: post.id,
        success: result.success,
        error: result.error,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[CRON-PUBLISH] Completed: ${successCount} success, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      success_count: successCount,
      fail_count: failCount,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON-PUBLISH] Error:", error);
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
