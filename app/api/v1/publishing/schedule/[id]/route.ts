import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getUserFromHeader } from "@/lib/auth";
import { PublishStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/publishing/schedule/[id] - Get scheduled post details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const post = await prisma.scheduledPost.findUnique({
      where: { id },
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
    });

    if (!post) {
      return NextResponse.json({ detail: "Scheduled post not found" }, { status: 404 });
    }

    // Check access
    if (user.role !== "ADMIN" && !user.labelIds.includes(post.socialAccount.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Get generation details
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: post.generationId },
      select: {
        id: true,
        prompt: true,
        outputUrl: true,
        aspectRatio: true,
        durationSeconds: true,
        qualityScore: true,
        campaign: {
          select: {
            id: true,
            name: true,
            artist: {
              select: {
                name: true,
                stageName: true,
                groupName: true,
              },
            },
          },
        },
      },
    });

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
        campaign: generation.campaign ? {
          id: generation.campaign.id,
          name: generation.campaign.name,
          artist: {
            name: generation.campaign.artist.name,
            stage_name: generation.campaign.artist.stageName,
            group_name: generation.campaign.artist.groupName,
          },
        } : null,
      } : null,
    });
  } catch (error) {
    console.error("Get scheduled post error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/publishing/schedule/[id] - Update scheduled post
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const post = await prisma.scheduledPost.findUnique({
      where: { id },
      include: {
        socialAccount: {
          select: { labelId: true },
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

    // Can only update if not already published
    if (post.status === "PUBLISHED") {
      return NextResponse.json(
        { detail: "Cannot modify a published post" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      caption,
      hashtags,
      scheduled_at,
      timezone,
      platform_settings,
      thumbnail_url,
      status,
    } = body;

    // Build update data
    const updateData: Prisma.ScheduledPostUpdateInput = {};

    if (caption !== undefined) updateData.caption = caption;
    if (hashtags !== undefined) updateData.hashtags = hashtags;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (thumbnail_url !== undefined) updateData.thumbnailUrl = thumbnail_url;
    if (platform_settings !== undefined) {
      updateData.platformSettings = platform_settings as Prisma.InputJsonValue || Prisma.JsonNull;
    }

    // Handle scheduling changes
    if (scheduled_at !== undefined) {
      if (scheduled_at === null) {
        updateData.scheduledAt = null;
        updateData.status = "DRAFT";
      } else {
        const scheduledDate = new Date(scheduled_at);
        if (scheduledDate < new Date()) {
          return NextResponse.json(
            { detail: "Scheduled time must be in the future" },
            { status: 400 }
          );
        }
        updateData.scheduledAt = scheduledDate;
        updateData.status = "SCHEDULED";
      }
    }

    // Handle status changes
    if (status !== undefined) {
      const validTransitions: Record<PublishStatus, PublishStatus[]> = {
        DRAFT: ["SCHEDULED", "CANCELLED"],
        SCHEDULED: ["DRAFT", "CANCELLED"],
        PUBLISHING: [], // Can't manually change from publishing (except ADMIN)
        PUBLISHED: [], // Can't change from published
        FAILED: ["DRAFT", "SCHEDULED"], // Can retry
        CANCELLED: ["DRAFT", "SCHEDULED"],
      };

      // ADMIN can force-update stuck PUBLISHING posts
      const isAdminRecovery = user.role === "ADMIN" && post.status === "PUBLISHING" &&
        ["PUBLISHED", "FAILED", "DRAFT"].includes(status);

      if (!isAdminRecovery && !validTransitions[post.status]?.includes(status)) {
        return NextResponse.json(
          { detail: `Cannot transition from ${post.status} to ${status}` },
          { status: 400 }
        );
      }
      updateData.status = status;

      // If ADMIN is manually setting to PUBLISHED, update publishedAt
      if (isAdminRecovery && status === "PUBLISHED") {
        updateData.publishedAt = new Date();
      }

      // If re-scheduling a failed post, reset retry count
      if (post.status === "FAILED" && status === "SCHEDULED") {
        updateData.retryCount = 0;
        updateData.errorMessage = null;
      }
    }

    const updatedPost = await prisma.scheduledPost.update({
      where: { id },
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
    });

    return NextResponse.json({
      id: updatedPost.id,
      campaign_id: updatedPost.campaignId,
      generation_id: updatedPost.generationId,
      platform: updatedPost.platform,
      status: updatedPost.status,
      caption: updatedPost.caption,
      hashtags: updatedPost.hashtags,
      scheduled_at: updatedPost.scheduledAt?.toISOString() || null,
      timezone: updatedPost.timezone,
      social_account: {
        id: updatedPost.socialAccount.id,
        platform: updatedPost.socialAccount.platform,
        account_name: updatedPost.socialAccount.accountName,
        profile_url: updatedPost.socialAccount.profileUrl,
      },
      updated_at: updatedPost.updatedAt.toISOString(),
      message: "Scheduled post updated successfully",
    });
  } catch (error) {
    console.error("Update scheduled post error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/publishing/schedule/[id] - Delete scheduled post
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const post = await prisma.scheduledPost.findUnique({
      where: { id },
      include: {
        socialAccount: {
          select: { labelId: true },
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

    // Can't delete published posts
    if (post.status === "PUBLISHED") {
      return NextResponse.json(
        { detail: "Cannot delete a published post. You can only archive it." },
        { status: 400 }
      );
    }

    // Can't delete while publishing
    if (post.status === "PUBLISHING") {
      return NextResponse.json(
        { detail: "Cannot delete while publishing is in progress" },
        { status: 400 }
      );
    }

    await prisma.scheduledPost.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Scheduled post deleted successfully",
    });
  } catch (error) {
    console.error("Delete scheduled post error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
