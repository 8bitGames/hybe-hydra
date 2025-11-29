import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import {
  publishVideoToTikTok,
  refreshAccessToken,
  TikTokPostSettings,
} from "@/lib/tiktok";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PlatformSettings {
  privacy_level?: string;
  disable_duet?: boolean;
  disable_comment?: boolean;
  disable_stitch?: boolean;
  video_cover_timestamp_ms?: number;
}

// Helper to check if token needs refresh
function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  // Refresh if expires within 5 minutes
  const bufferMs = 5 * 60 * 1000;
  return new Date().getTime() + bufferMs > expiresAt.getTime();
}

// Background publish handler
async function executePublish(
  postId: string,
  socialAccountId: string,
  videoUrl: string,
  caption: string,
  hashtags: string[],
  platformSettings: PlatformSettings | null
) {
  try {
    // Get social account with credentials
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
      return;
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
        return;
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
        return;
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

    // Prepare TikTok settings
    const tiktokSettings: Partial<TikTokPostSettings> = {
      privacy_level: (platformSettings?.privacy_level as TikTokPostSettings["privacy_level"]) || "PUBLIC_TO_EVERYONE",
      disable_duet: platformSettings?.disable_duet,
      disable_comment: platformSettings?.disable_comment,
      disable_stitch: platformSettings?.disable_stitch,
      video_cover_timestamp_ms: platformSettings?.video_cover_timestamp_ms,
    };

    // Publish to TikTok
    const result = await publishVideoToTikTok(
      accessToken,
      videoUrl,
      caption || "",
      hashtags || [],
      tiktokSettings
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

      console.log(`Successfully published post ${postId} to TikTok:`, result.postId);
    } else {
      await prisma.scheduledPost.update({
        where: { id: postId },
        data: {
          status: "FAILED",
          errorMessage: result.error || "Unknown publish error",
          retryCount: { increment: 1 },
        },
      });

      console.error(`Failed to publish post ${postId}:`, result.error);
    }
  } catch (error) {
    console.error(`Publish error for post ${postId}:`, error);
    await prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        retryCount: { increment: 1 },
      },
    });
  }
}

// POST /api/v1/publishing/schedule/[id]/publish - Manually trigger publish
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role === "VIEWER") {
      return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
    }

    const { id } = await params;

    // Get the scheduled post
    const post = await prisma.scheduledPost.findUnique({
      where: { id },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            accountName: true,
            labelId: true,
            accessToken: true,
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ detail: "Scheduled post not found" }, { status: 404 });
    }

    // Check access
    if (user.role !== "ADMIN" && !user.labelIds.includes(post.socialAccount.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Validate post can be published
    if (post.status === "PUBLISHED") {
      return NextResponse.json({ detail: "Post has already been published" }, { status: 400 });
    }

    if (post.status === "PUBLISHING") {
      return NextResponse.json({ detail: "Post is currently being published" }, { status: 400 });
    }

    if (post.status === "CANCELLED") {
      return NextResponse.json(
        { detail: "Cannot publish a cancelled post. Please update status first." },
        { status: 400 }
      );
    }

    // Check if social account is connected
    if (!post.socialAccount.accessToken) {
      return NextResponse.json(
        { detail: "Social account is not connected. Please reconnect the account." },
        { status: 400 }
      );
    }

    // Get video URL from generation
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: post.generationId },
      select: { outputUrl: true, status: true },
    });

    if (!generation || generation.status !== "COMPLETED" || !generation.outputUrl) {
      return NextResponse.json(
        { detail: "Video generation not found or not completed" },
        { status: 400 }
      );
    }

    // Currently only TikTok is supported
    if (post.platform !== "TIKTOK") {
      return NextResponse.json(
        { detail: `Publishing to ${post.platform} is not yet supported` },
        { status: 400 }
      );
    }

    // Mark as publishing
    await prisma.scheduledPost.update({
      where: { id },
      data: { status: "PUBLISHING" },
    });

    // Start async publish (don't await)
    executePublish(
      post.id,
      post.socialAccount.id,
      generation.outputUrl,
      post.caption || "",
      post.hashtags,
      post.platformSettings as PlatformSettings | null
    );

    return NextResponse.json({
      id: post.id,
      status: "PUBLISHING",
      message: "Publish started. Check status for updates.",
      social_account: {
        id: post.socialAccount.id,
        platform: post.socialAccount.platform,
        account_name: post.socialAccount.accountName,
      },
    });
  } catch (error) {
    console.error("Publish trigger error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
