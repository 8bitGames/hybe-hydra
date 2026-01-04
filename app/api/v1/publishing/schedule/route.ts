import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { PublishPlatform, PublishStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

// EC2 Backend URL
const getComposeEngineUrl = () =>
  process.env.COMPOSE_ENGINE_URL || "http://15.164.236.53:8000";

// GET /api/v1/publishing/schedule - List scheduled posts
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

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
      const accessibleAccounts = await withRetry(() => prisma.socialAccount.findMany({
        where: {
          labelId: { in: user.labelIds },
        },
        select: { id: true },
      }));
      whereClause.socialAccountId = {
        in: accessibleAccounts.map((a) => a.id),
      };
    }

    // Get total count
    const total = await withRetry(() => prisma.scheduledPost.count({ where: whereClause }));

    // Get scheduled posts
    const posts = await withRetry(() => prisma.scheduledPost.findMany({
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
    }));

    // Get generation details for each post (exclude soft-deleted)
    const generationIds = [...new Set(posts.map((p) => p.generationId))];
    const generations = await withRetry(() => prisma.videoGeneration.findMany({
      where: { id: { in: generationIds }, deletedAt: null },
      select: {
        id: true,
        prompt: true,
        outputUrl: true,
        aspectRatio: true,
        durationSeconds: true,
        qualityScore: true,
      },
    }));
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
    
    const user = await getUserFromRequest(request);

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

    // Verify generation exists and belongs to campaign (exclude soft-deleted)
    const generation = await withRetry(() => prisma.videoGeneration.findFirst({
      where: {
        id: generation_id,
        campaignId: campaign_id,
        status: "COMPLETED",
        deletedAt: null,
      },
    }));

    if (!generation) {
      return NextResponse.json(
        { detail: "Generation not found or not completed" },
        { status: 404 }
      );
    }

    // Verify social account exists and user has access
    const socialAccount = await withRetry(() => prisma.socialAccount.findUnique({
      where: { id: social_account_id },
    }));

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
    const post = await withRetry(() => prisma.scheduledPost.create({
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
    }));

    // If NOW (immediate publish), call EC2 backend
    if (isNow) {
      console.log("[Schedule API] Triggering immediate publish for post:", post.id, "platform:", socialAccount.platform);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hydra.ai.kr";
      const callbackUrl = `${baseUrl}/api/v1/jobs/callback?type=publish&postId=${post.id}`;
      const publishingUrl = `${getComposeEngineUrl()}/api/v1/publish`;
      const jobId = uuidv4(); // Generate unique job ID for EC2 backend

      // Get video URL
      const videoUrl = generation.composedOutputUrl || generation.outputUrl;

      try {
        let endpoint: string;
        let publishRequest: Record<string, unknown>;

        switch (socialAccount.platform) {
          case "TIKTOK":
            endpoint = `${publishingUrl}/tiktok`;
            publishRequest = {
              job_id: jobId,
              video_url: videoUrl,
              caption: caption || "",
              hashtags: hashtags || [],
              credentials: {
                access_token: socialAccount.accessToken,
                refresh_token: socialAccount.refreshToken,
                open_id: socialAccount.accountId,
              },
              settings: {
                privacy_level: platform_settings?.privacy_level || "PUBLIC_TO_EVERYONE",
                disable_duet: platform_settings?.disable_duet,
                disable_comment: platform_settings?.disable_comment,
                disable_stitch: platform_settings?.disable_stitch,
              },
              callback_url: callbackUrl,
              metadata: {
                post_id: post.id,
                user_id: user.id,
                account_id: socialAccount.id,
              },
            };
            break;

          case "YOUTUBE":
            endpoint = `${publishingUrl}/youtube`;
            publishRequest = {
              job_id: jobId,
              video_url: videoUrl,
              caption: caption || "",
              hashtags: hashtags || [],
              credentials: {
                access_token: socialAccount.accessToken,
                refresh_token: socialAccount.refreshToken,
              },
              settings: {
                title: platform_settings?.title || caption?.slice(0, 100) || "Untitled Short",
                privacy_status: platform_settings?.privacy_status || "public",
                made_for_kids: platform_settings?.made_for_kids ?? false,
                tags: platform_settings?.tags || [],
              },
              callback_url: callbackUrl,
              metadata: {
                post_id: post.id,
                user_id: user.id,
                account_id: socialAccount.id,
              },
            };
            break;

          case "INSTAGRAM":
            endpoint = `${publishingUrl}/instagram`;
            publishRequest = {
              job_id: jobId,
              video_url: videoUrl,
              caption: caption || "",
              hashtags: hashtags || [],
              credentials: {
                access_token: socialAccount.accessToken,
                instagram_account_id: socialAccount.accountId,
              },
              settings: {
                share_to_feed: platform_settings?.share_to_feed ?? true,
                cover_url: platform_settings?.cover_url,
                location_id: platform_settings?.location_id,
                collaborator_usernames: platform_settings?.collaborators,
              },
              callback_url: callbackUrl,
              metadata: {
                post_id: post.id,
                user_id: user.id,
                account_id: socialAccount.id,
              },
            };
            break;

          default:
            console.warn("[Schedule API] Unsupported platform for immediate publish:", socialAccount.platform);
            endpoint = "";
            publishRequest = {};
        }

        if (endpoint) {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(publishRequest),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[Schedule API] EC2 publish request failed:", errorText);
          } else {
            console.log("[Schedule API] EC2 publish request sent successfully");
          }
        }
      } catch (publishError) {
        console.error("[Schedule API] Failed to send publish request to EC2:", publishError);
      }
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
