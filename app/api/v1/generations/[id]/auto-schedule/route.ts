import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AutoPublishMetadata {
  enabled: boolean;
  socialAccountId: string;
  intervalMinutes: number;
  caption: string;
  hashtags: string[];
  variationIndex: number;
}

// POST /api/v1/generations/[id]/auto-schedule - Auto-schedule post on video completion
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: generationId } = await params;

    // Fetch the generation
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      select: {
        id: true,
        status: true,
        outputUrl: true,
        campaignId: true,
        createdBy: true,
        qualityMetadata: true,
        campaign: true,
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check if video is completed with output
    if (generation.status !== "COMPLETED" || !generation.outputUrl) {
      return NextResponse.json(
        { detail: "Video must be completed with output URL to schedule" },
        { status: 400 }
      );
    }

    // Check for autoPublish metadata
    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const autoPublish = metadata?.autoPublish as AutoPublishMetadata | null;

    if (!autoPublish || !autoPublish.enabled) {
      return NextResponse.json(
        { detail: "Auto-publish not configured for this generation" },
        { status: 400 }
      );
    }

    if (!autoPublish.socialAccountId) {
      return NextResponse.json(
        { detail: "No social account configured for auto-publish" },
        { status: 400 }
      );
    }

    // Verify the social account exists and is active
    const socialAccount = await prisma.socialAccount.findUnique({
      where: { id: autoPublish.socialAccountId },
    });

    if (!socialAccount) {
      return NextResponse.json(
        { detail: "Social account not found" },
        { status: 404 }
      );
    }

    if (!socialAccount.isActive) {
      return NextResponse.json(
        { detail: "Social account is not active" },
        { status: 400 }
      );
    }

    // Check if already scheduled
    const existingScheduledPost = await prisma.scheduledPost.findFirst({
      where: {
        generationId: generationId,
        socialAccountId: autoPublish.socialAccountId,
      },
    });

    if (existingScheduledPost) {
      return NextResponse.json({
        message: "Already scheduled",
        scheduled_post_id: existingScheduledPost.id,
        scheduled_at: existingScheduledPost.scheduledAt?.toISOString(),
      });
    }

    // Calculate scheduled time based on variation index and interval
    const baseTime = new Date();
    const offsetMinutes = autoPublish.variationIndex * autoPublish.intervalMinutes;
    const scheduledAt = new Date(baseTime.getTime() + offsetMinutes * 60 * 1000);

    // Build caption with hashtags
    let finalCaption = autoPublish.caption || "";
    if (autoPublish.hashtags && autoPublish.hashtags.length > 0) {
      const hashtagString = autoPublish.hashtags
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        .join(" ");
      finalCaption = finalCaption ? `${finalCaption}\n\n${hashtagString}` : hashtagString;
    }

    // Determine campaign ID - for Quick Create, campaign might be null
    const campaignId = generation.campaignId;
    if (!campaignId) {
      return NextResponse.json(
        { detail: "Auto-publish requires a campaign. Quick Create videos cannot be auto-published." },
        { status: 400 }
      );
    }

    // Create scheduled post
    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        campaignId: campaignId,
        generationId: generationId,
        socialAccountId: autoPublish.socialAccountId,
        platform: socialAccount.platform,
        status: "SCHEDULED",
        caption: finalCaption,
        hashtags: autoPublish.hashtags || [],
        scheduledAt: scheduledAt,
        timezone: "Asia/Seoul",
        platformSettings: {
          autoScheduled: true,
          batchId: metadata?.batchId || null,
          variationIndex: autoPublish.variationIndex,
        },
        createdBy: generation.createdBy,
      },
    });

    // Update generation metadata to mark as scheduled
    const updatedMetadata = {
      ...metadata,
      autoPublish: {
        ...autoPublish,
        scheduled: true,
        scheduledPostId: scheduledPost.id,
        scheduledAt: scheduledAt.toISOString(),
      },
    };

    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        qualityMetadata: updatedMetadata,
      },
    });

    return NextResponse.json(
      {
        message: "Auto-scheduled successfully",
        scheduled_post: {
          id: scheduledPost.id,
          generation_id: generationId,
          social_account_id: scheduledPost.socialAccountId,
          platform: scheduledPost.platform.toLowerCase(),
          status: scheduledPost.status.toLowerCase(),
          caption: scheduledPost.caption,
          hashtags: scheduledPost.hashtags,
          scheduled_at: scheduledPost.scheduledAt?.toISOString(),
          timezone: scheduledPost.timezone,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Auto-schedule error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
