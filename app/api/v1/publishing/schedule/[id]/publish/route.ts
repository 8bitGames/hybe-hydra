import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { inngest } from "@/lib/inngest";

interface RouteParams {
  params: Promise<{ id: string }>;
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

    // Trigger publish via Inngest (durable background job)
    await inngest.send({
      name: "publish/tiktok",
      data: {
        videoId: post.generationId,
        userId: user.id,
        accountId: post.socialAccount.id,
        caption: post.caption || "",
        hashtags: post.hashtags,
      },
    });

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
