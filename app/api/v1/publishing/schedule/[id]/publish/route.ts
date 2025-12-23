import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { getComposeEngineUrl } from "@/lib/compose/client";
import { v4 as uuidv4 } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// EC2 Backend URL for publishing
const getPublishingUrl = () => `${getComposeEngineUrl()}/api/v1/publish`;

// Callback URL for the backend to notify us
const getCallbackUrl = (postId: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hydra.ai.kr";
  return `${baseUrl}/api/v1/jobs/callback?type=publish&postId=${postId}`;
};

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

    // Get the scheduled post with full account details
    const post = await prisma.scheduledPost.findUnique({
      where: { id },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            accountName: true,
            accountId: true, // Platform-specific account ID (Instagram business account ID, etc.)
            labelId: true,
            accessToken: true,
            refreshToken: true,
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

    // Validate supported platforms
    const supportedPlatforms = ["TIKTOK", "YOUTUBE", "INSTAGRAM"];
    if (!supportedPlatforms.includes(post.platform)) {
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

    // Prepare platform-specific request
    const platformSettings = post.platformSettings as Record<string, unknown> | null;
    const jobId = uuidv4();
    const publishingUrl = getPublishingUrl();
    const callbackUrl = getCallbackUrl(post.id);

    let publishRequest: Record<string, unknown>;
    let endpoint: string;

    switch (post.platform) {
      case "TIKTOK":
        endpoint = `${publishingUrl}/tiktok`;
        publishRequest = {
          job_id: jobId,
          credentials: {
            access_token: post.socialAccount.accessToken,
            refresh_token: post.socialAccount.refreshToken,
            open_id: post.socialAccount.accountId,
          },
          video_url: generation.outputUrl,
          caption: post.caption || "",
          hashtags: post.hashtags || [],
          settings: {
            privacy_level: platformSettings?.privacy_level || "PUBLIC_TO_EVERYONE",
            disable_duet: platformSettings?.disable_duet || false,
            disable_comment: platformSettings?.disable_comment || false,
            disable_stitch: platformSettings?.disable_stitch || false,
          },
          use_sandbox: process.env.TIKTOK_SANDBOX === "true",
          callback_url: callbackUrl,
          metadata: {
            post_id: post.id,
            user_id: user.id,
            account_id: post.socialAccount.id,
          },
        };
        break;

      case "YOUTUBE":
        endpoint = `${publishingUrl}/youtube`;
        publishRequest = {
          job_id: jobId,
          credentials: {
            access_token: post.socialAccount.accessToken,
            refresh_token: post.socialAccount.refreshToken,
          },
          video_url: generation.outputUrl,
          caption: post.caption || "",
          hashtags: post.hashtags || [],
          settings: {
            title: platformSettings?.title || "Untitled Short",
            privacy_status: platformSettings?.privacy_status || "public",
            category_id: platformSettings?.category_id || "22",
            made_for_kids: platformSettings?.made_for_kids || false,
            tags: platformSettings?.tags || [],
          },
          callback_url: callbackUrl,
          metadata: {
            post_id: post.id,
            user_id: user.id,
            account_id: post.socialAccount.id,
          },
        };
        break;

      case "INSTAGRAM":
        endpoint = `${publishingUrl}/instagram`;
        publishRequest = {
          job_id: jobId,
          credentials: {
            access_token: post.socialAccount.accessToken,
            instagram_account_id: post.socialAccount.accountId,
          },
          video_url: generation.outputUrl,
          caption: post.caption || "",
          hashtags: post.hashtags || [],
          settings: {
            share_to_feed: platformSettings?.share_to_feed !== false,
            cover_url: platformSettings?.cover_url,
            thumb_offset: platformSettings?.thumb_offset,
            location_id: platformSettings?.location_id,
            collaborator_usernames: platformSettings?.collaborators || [],
          },
          callback_url: callbackUrl,
          metadata: {
            post_id: post.id,
            user_id: user.id,
            account_id: post.socialAccount.id,
          },
        };
        break;

      default:
        return NextResponse.json(
          { detail: `Unsupported platform: ${post.platform}` },
          { status: 400 }
        );
    }

    // Call EC2 backend
    console.log(`[Publish] Sending to EC2 backend: ${endpoint}`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(publishRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Publish] EC2 backend error: ${response.status} - ${errorText}`);

      // Revert status on failure
      await prisma.scheduledPost.update({
        where: { id },
        data: { status: "SCHEDULED" },
      });

      return NextResponse.json(
        { detail: `Publishing service error: ${errorText}` },
        { status: 502 }
      );
    }

    const result = await response.json();
    console.log(`[Publish] EC2 backend response:`, result);

    // Update post with job ID
    await prisma.scheduledPost.update({
      where: { id },
      data: {
        platformSettings: {
          ...(platformSettings || {}),
          publish_job_id: jobId,
        },
      },
    });

    return NextResponse.json({
      id: post.id,
      job_id: jobId,
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
