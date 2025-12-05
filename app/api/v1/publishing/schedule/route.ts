import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getUserFromHeader } from "@/lib/auth";
import { PublishPlatform, PublishStatus } from "@prisma/client";
import { inngest } from "@/lib/inngest";

// GET /api/v1/publishing/schedule - List scheduled posts
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");
    const platform = searchParams.get("platform") as PublishPlatform | null;
    const status = searchParams.get("status") as PublishStatus | null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("page_size") || "20")));
    const upcoming = searchParams.get("upcoming") === "true";

    // Build where clause
    const whereClause: Prisma.ScheduledPostWhereInput = {};

    if (campaignId) {
      whereClause.campaignId = campaignId;
    }

    if (platform) {
      whereClause.platform = platform;
    }

    if (status) {
      whereClause.status = status;
    }

    // Filter for upcoming scheduled posts
    if (upcoming) {
      whereClause.status = "SCHEDULED";
      whereClause.scheduledAt = {
        gte: new Date(),
      };
    }

    // Get accessible accounts based on user's labels
    if (user.role !== "ADMIN") {
      const accessibleAccounts = await prisma.socialAccount.findMany({
        where: {
          labelId: { in: user.labelIds },
        },
        select: { id: true },
      });
      whereClause.socialAccountId = {
        in: accessibleAccounts.map((a) => a.id),
      };
    }

    // Get total count
    const total = await prisma.scheduledPost.count({ where: whereClause });

    // Get scheduled posts
    const posts = await prisma.scheduledPost.findMany({
      where: whereClause,
      orderBy: [
        { scheduledAt: "asc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            accountName: true,
            profileUrl: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get generation details for each post
    const generationIds = [...new Set(posts.map((p) => p.generationId))];
    const generations = await prisma.videoGeneration.findMany({
      where: { id: { in: generationIds } },
      select: {
        id: true,
        prompt: true,
        outputUrl: true,
        aspectRatio: true,
        durationSeconds: true,
        qualityScore: true,
      },
    });
    const generationMap = new Map(generations.map((g) => [g.id, g]));

    // Transform response
    const items = posts.map((post) => {
      const generation = generationMap.get(post.generationId);
      return {
        id: post.id,
        campaign_id: post.campaignId,
        campaign_name: post.campaign?.name || null,
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
        view_count: post.viewCount,
        like_count: post.likeCount,
        comment_count: post.commentCount,
        share_count: post.shareCount,
        created_at: post.createdAt.toISOString(),
        updated_at: post.updatedAt.toISOString(),
        social_account: {
          id: post.socialAccount.id,
          platform: post.socialAccount.platform,
          account_name: post.socialAccount.accountName,
          profile_url: post.socialAccount.profileUrl,
        },
        generation: generation ? {
          id: generation.id,
          prompt: generation.prompt,
          output_url: generation.outputUrl,
          aspect_ratio: generation.aspectRatio,
          duration_seconds: generation.durationSeconds,
          quality_score: generation.qualityScore,
        } : null,
      };
    });

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Get scheduled posts error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/v1/publishing/schedule - Create a scheduled post
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role === "VIEWER") {
      return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const {
      campaign_id,
      generation_id,
      social_account_id,
      caption,
      hashtags = [],
      scheduled_at,
      timezone = "Asia/Seoul",
      platform_settings,
      thumbnail_url,
    } = body;

    // Validate required fields
    if (!campaign_id || !generation_id || !social_account_id) {
      return NextResponse.json(
        { detail: "campaign_id, generation_id, and social_account_id are required" },
        { status: 400 }
      );
    }

    // Verify generation exists and belongs to campaign
    const generation = await prisma.videoGeneration.findFirst({
      where: {
        id: generation_id,
        campaignId: campaign_id,
        status: "COMPLETED",
      },
    });

    if (!generation) {
      return NextResponse.json(
        { detail: "Generation not found or not completed" },
        { status: 404 }
      );
    }

    // Verify social account exists and user has access
    const socialAccount = await prisma.socialAccount.findUnique({
      where: { id: social_account_id },
    });

    if (!socialAccount) {
      return NextResponse.json(
        { detail: "Social account not found" },
        { status: 404 }
      );
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(socialAccount.labelId)) {
      return NextResponse.json(
        { detail: "Access denied to this social account" },
        { status: 403 }
      );
    }

    // Determine status based on scheduled_at
    // NOW (no date) = immediately publish, Scheduled = wait for scheduled time
    const scheduledDate = scheduled_at ? new Date(scheduled_at) : null;
    const isNow = !scheduledDate;
    const status: PublishStatus = isNow ? "PUBLISHING" : "SCHEDULED";

    // Create scheduled post
    const post = await prisma.scheduledPost.create({
      data: {
        campaignId: campaign_id,
        generationId: generation_id,
        socialAccountId: social_account_id,
        platform: socialAccount.platform,
        status,
        caption,
        hashtags,
        thumbnailUrl: thumbnail_url || generation.outputUrl,
        scheduledAt: scheduledDate,
        timezone,
        platformSettings: platform_settings as Prisma.InputJsonValue || Prisma.JsonNull,
        createdBy: user.id,
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
    });

    // If NOW (immediate publish), trigger Inngest function
    if (isNow && socialAccount.platform === "TIKTOK") {
      console.log("[Schedule API] Triggering immediate publish for post:", post.id);
      await inngest.send({
        name: "publish/tiktok",
        data: {
          videoId: generation_id,
          userId: user.id,
          accountId: social_account_id,
          caption: caption || "",
          hashtags: hashtags || [],
        },
      });
    }

    return NextResponse.json({
      id: post.id,
      campaign_id: post.campaignId,
      generation_id: post.generationId,
      platform: post.platform,
      status: post.status,
      caption: post.caption,
      hashtags: post.hashtags,
      scheduled_at: post.scheduledAt?.toISOString() || null,
      timezone: post.timezone,
      social_account: {
        id: post.socialAccount.id,
        platform: post.socialAccount.platform,
        account_name: post.socialAccount.accountName,
        profile_url: post.socialAccount.profileUrl,
      },
      created_at: post.createdAt.toISOString(),
      message: isNow ? "Publishing started" : "Post scheduled successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Create scheduled post error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
