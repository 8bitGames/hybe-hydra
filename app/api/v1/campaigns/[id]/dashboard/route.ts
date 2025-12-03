import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL } from "@/lib/cache";

// GET /api/v1/campaigns/[id]/dashboard - Get comprehensive campaign dashboard data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // First check RBAC access (quick query, not cached)
    const campaignAccess = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        artist: { select: { labelId: true } },
      },
    });

    if (!campaignAccess) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaignAccess.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Cache the expensive dashboard aggregation
    const dashboardData = await cached(
      CacheKeys.campaignDashboard(campaignId),
      CacheTTL.CAMPAIGN_DASH, // 2.5 minutes
      async () => {
        // Get campaign with all related data
        const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            stageName: true,
            groupName: true,
            labelId: true,
            profileImageUrl: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assets: {
          select: {
            id: true,
            type: true,
            filename: true,
            originalFilename: true,
            s3Url: true,
            thumbnailUrl: true,
            fileSize: true,
            mimeType: true,
            merchandiseType: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        videoGenerations: {
          select: {
            id: true,
            prompt: true,
            status: true,
            progress: true,
            durationSeconds: true,
            aspectRatio: true,
            outputUrl: true,
            qualityScore: true,
            qualityMetadata: true,
            errorMessage: true,
            referenceStyle: true,
            createdAt: true,
            updatedAt: true,
            merchandiseReferences: {
              include: {
                merchandise: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    thumbnailUrl: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return null; // Will be handled outside cached block
    }

    // Get scheduled posts for this campaign
    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: { campaignId },
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
      orderBy: { createdAt: "desc" },
    });

    // Calculate statistics
    const assetStats = {
      total: campaign.assets.length,
      by_type: {
        IMAGE: campaign.assets.filter(a => a.type === "IMAGE").length,
        VIDEO: campaign.assets.filter(a => a.type === "VIDEO").length,
        AUDIO: campaign.assets.filter(a => a.type === "AUDIO").length,
        GOODS: campaign.assets.filter(a => a.type === "GOODS").length,
      },
      total_size: campaign.assets.reduce((sum, a) => sum + (a.fileSize || 0), 0),
    };

    const generationStats = {
      total: campaign.videoGenerations.length,
      by_status: {
        PENDING: campaign.videoGenerations.filter(v => v.status === "PENDING").length,
        PROCESSING: campaign.videoGenerations.filter(v => v.status === "PROCESSING").length,
        COMPLETED: campaign.videoGenerations.filter(v => v.status === "COMPLETED").length,
        FAILED: campaign.videoGenerations.filter(v => v.status === "FAILED").length,
        CANCELLED: campaign.videoGenerations.filter(v => v.status === "CANCELLED").length,
      },
      scored: campaign.videoGenerations.filter(v => v.qualityScore !== null).length,
      avg_quality_score: (() => {
        const scored = campaign.videoGenerations.filter(v => v.qualityScore !== null);
        if (scored.length === 0) return null;
        return scored.reduce((sum, v) => sum + (v.qualityScore || 0), 0) / scored.length;
      })(),
      high_quality_count: campaign.videoGenerations.filter(v => (v.qualityScore || 0) >= 70).length,
    };

    const publishingStats = {
      total: scheduledPosts.length,
      by_status: {
        DRAFT: scheduledPosts.filter(p => p.status === "DRAFT").length,
        SCHEDULED: scheduledPosts.filter(p => p.status === "SCHEDULED").length,
        PUBLISHING: scheduledPosts.filter(p => p.status === "PUBLISHING").length,
        PUBLISHED: scheduledPosts.filter(p => p.status === "PUBLISHED").length,
        FAILED: scheduledPosts.filter(p => p.status === "FAILED").length,
        CANCELLED: scheduledPosts.filter(p => p.status === "CANCELLED").length,
      },
      by_platform: {
        TIKTOK: scheduledPosts.filter(p => p.platform === "TIKTOK").length,
        YOUTUBE: scheduledPosts.filter(p => p.platform === "YOUTUBE").length,
        INSTAGRAM: scheduledPosts.filter(p => p.platform === "INSTAGRAM").length,
        TWITTER: scheduledPosts.filter(p => p.platform === "TWITTER").length,
      },
    };

    // Calculate SNS analytics totals
    const publishedPosts = scheduledPosts.filter(p => p.status === "PUBLISHED");
    const analyticsStats = {
      total_published: publishedPosts.length,
      total_views: publishedPosts.reduce((sum, p) => sum + (p.viewCount || 0), 0),
      total_likes: publishedPosts.reduce((sum, p) => sum + (p.likeCount || 0), 0),
      total_comments: publishedPosts.reduce((sum, p) => sum + (p.commentCount || 0), 0),
      total_shares: publishedPosts.reduce((sum, p) => sum + (p.shareCount || 0), 0),
      total_saves: publishedPosts.reduce((sum, p) => sum + (p.saveCount || 0), 0),
      avg_engagement_rate: (() => {
        const withEngagement = publishedPosts.filter(p => p.engagementRate !== null);
        if (withEngagement.length === 0) return null;
        return withEngagement.reduce((sum, p) => sum + (p.engagementRate || 0), 0) / withEngagement.length;
      })(),
      by_platform: {
        TIKTOK: {
          posts: publishedPosts.filter(p => p.platform === "TIKTOK").length,
          views: publishedPosts.filter(p => p.platform === "TIKTOK").reduce((sum, p) => sum + (p.viewCount || 0), 0),
          likes: publishedPosts.filter(p => p.platform === "TIKTOK").reduce((sum, p) => sum + (p.likeCount || 0), 0),
        },
        YOUTUBE: {
          posts: publishedPosts.filter(p => p.platform === "YOUTUBE").length,
          views: publishedPosts.filter(p => p.platform === "YOUTUBE").reduce((sum, p) => sum + (p.viewCount || 0), 0),
          likes: publishedPosts.filter(p => p.platform === "YOUTUBE").reduce((sum, p) => sum + (p.likeCount || 0), 0),
        },
        INSTAGRAM: {
          posts: publishedPosts.filter(p => p.platform === "INSTAGRAM").length,
          views: publishedPosts.filter(p => p.platform === "INSTAGRAM").reduce((sum, p) => sum + (p.viewCount || 0), 0),
          likes: publishedPosts.filter(p => p.platform === "INSTAGRAM").reduce((sum, p) => sum + (p.likeCount || 0), 0),
        },
        TWITTER: {
          posts: publishedPosts.filter(p => p.platform === "TWITTER").length,
          views: publishedPosts.filter(p => p.platform === "TWITTER").reduce((sum, p) => sum + (p.viewCount || 0), 0),
          likes: publishedPosts.filter(p => p.platform === "TWITTER").reduce((sum, p) => sum + (p.likeCount || 0), 0),
        },
      },
    };

    // Return data for caching
    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status.toLowerCase(),
        target_countries: campaign.targetCountries,
        start_date: campaign.startDate?.toISOString() || null,
        end_date: campaign.endDate?.toISOString() || null,
        budget_code: campaign.budgetCode,
        created_at: campaign.createdAt.toISOString(),
        updated_at: campaign.updatedAt.toISOString(),
        artist: {
          id: campaign.artist.id,
          name: campaign.artist.name,
          stage_name: campaign.artist.stageName,
          group_name: campaign.artist.groupName,
          profile_image_url: campaign.artist.profileImageUrl,
        },
        creator: {
          id: campaign.creator.id,
          name: campaign.creator.name,
          email: campaign.creator.email,
        },
      },
      stats: {
        assets: assetStats,
        generations: generationStats,
        publishing: publishingStats,
        analytics: analyticsStats,
      },
      assets: campaign.assets.map(a => ({
        id: a.id,
        type: a.type,
        filename: a.filename,
        original_filename: a.originalFilename,
        s3_url: a.s3Url,
        thumbnail_url: a.thumbnailUrl,
        file_size: a.fileSize,
        mime_type: a.mimeType,
        merchandise_type: a.merchandiseType,
        created_at: a.createdAt.toISOString(),
      })),
      generations: campaign.videoGenerations.map(v => ({
        id: v.id,
        prompt: v.prompt,
        status: v.status,
        progress: v.progress,
        duration_seconds: v.durationSeconds,
        aspect_ratio: v.aspectRatio,
        output_url: v.outputUrl,
        quality_score: v.qualityScore,
        quality_metadata: v.qualityMetadata,
        error_message: v.errorMessage,
        reference_style: v.referenceStyle,
        created_at: v.createdAt.toISOString(),
        updated_at: v.updatedAt.toISOString(),
        merchandise: v.merchandiseReferences.map(mr => ({
          id: mr.merchandise.id,
          name: mr.merchandise.name,
          type: mr.merchandise.type,
          thumbnail_url: mr.merchandise.thumbnailUrl,
          context: mr.context,
        })),
      })),
      scheduled_posts: scheduledPosts.map(p => ({
        id: p.id,
        platform: p.platform,
        status: p.status,
        caption: p.caption,
        hashtags: p.hashtags,
        thumbnail_url: p.thumbnailUrl,
        scheduled_at: p.scheduledAt?.toISOString() || null,
        published_at: p.publishedAt?.toISOString() || null,
        published_url: p.publishedUrl,
        analytics: {
          view_count: p.viewCount,
          like_count: p.likeCount,
          comment_count: p.commentCount,
          share_count: p.shareCount,
          save_count: p.saveCount,
          engagement_rate: p.engagementRate,
          last_synced_at: p.analyticsLastSyncedAt?.toISOString() || null,
        },
        social_account: {
          id: p.socialAccount.id,
          platform: p.socialAccount.platform,
          account_name: p.socialAccount.accountName,
          profile_url: p.socialAccount.profileUrl,
        },
        created_at: p.createdAt.toISOString(),
      })),
    };
      }
    );

    // Handle case where campaign was not found inside cached block
    if (!dashboardData) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Get campaign dashboard error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
