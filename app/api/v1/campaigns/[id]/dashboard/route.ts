import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL } from "@/lib/cache";

// GET /api/v1/campaigns/[id]/dashboard - Get comprehensive campaign dashboard data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // First check RBAC access (quick query, not cached)
    const campaignAccess = await withRetry(() => prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        artist: { select: { labelId: true } },
      },
    }));

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
        // Fetch campaign and scheduled posts in parallel
        const [campaign, scheduledPosts] = await Promise.all([
          withRetry(() => prisma.campaign.findUnique({
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
          })),
          withRetry(() => prisma.scheduledPost.findMany({
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
          })),
        ]);

    if (!campaign) {
      return null; // Will be handled outside cached block
    }

    // Fetch aggregated stats in parallel with the main data
    // This is more efficient than filtering large arrays in JavaScript
    const [
      assetTypeCounts,
      assetSizeAgg,
      generationStatusCounts,
      generationScoreAgg,
      highQualityGenCount,
      postStatusCounts,
      postPlatformCounts,
      snsGlobalAgg,
      snsByPlatform,
    ] = await Promise.all([
      // Asset counts by type
      withRetry(() => prisma.asset.groupBy({
        by: ["type"],
        where: { campaignId },
        _count: true,
      })),
      // Asset total size
      withRetry(() => prisma.asset.aggregate({
        where: { campaignId },
        _sum: { fileSize: true },
        _count: true,
      })),
      // Generation counts by status
      withRetry(() => prisma.videoGeneration.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: true,
      })),
      // Generation score aggregate
      withRetry(() => prisma.videoGeneration.aggregate({
        where: { campaignId, qualityScore: { not: null } },
        _count: { qualityScore: true },
        _avg: { qualityScore: true },
      })),
      // High quality generations count
      withRetry(() => prisma.videoGeneration.count({
        where: { campaignId, qualityScore: { gte: 70 } },
      })),
      // Post counts by status
      withRetry(() => prisma.scheduledPost.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: true,
      })),
      // Post counts by platform
      withRetry(() => prisma.scheduledPost.groupBy({
        by: ["platform"],
        where: { campaignId },
        _count: true,
      })),
      // SNS aggregate for published posts
      withRetry(() => prisma.scheduledPost.aggregate({
        where: { campaignId, status: "PUBLISHED" },
        _count: true,
        _sum: {
          viewCount: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
          saveCount: true,
        },
        _avg: { engagementRate: true },
      })),
      // SNS by platform for published posts
      withRetry(() => prisma.scheduledPost.groupBy({
        by: ["platform"],
        where: { campaignId, status: "PUBLISHED" },
        _count: true,
        _sum: { viewCount: true, likeCount: true },
      })),
    ]);

    // Helper function to get count from groupBy result
    const getCount = <T extends { _count: number }>(
      arr: T[],
      key: keyof T,
      value: string
    ): number => {
      const found = arr.find((item) => item[key] === value);
      return found?._count || 0;
    };

    // Calculate asset statistics from aggregations
    const assetStats = {
      total: assetSizeAgg._count || 0,
      by_type: {
        IMAGE: getCount(assetTypeCounts, "type", "IMAGE"),
        VIDEO: getCount(assetTypeCounts, "type", "VIDEO"),
        AUDIO: getCount(assetTypeCounts, "type", "AUDIO"),
        GOODS: getCount(assetTypeCounts, "type", "GOODS"),
      },
      total_size: assetSizeAgg._sum.fileSize || 0,
    };

    // Calculate total generations from groupBy
    const totalGenerations = generationStatusCounts.reduce((sum, g) => sum + g._count, 0);

    // Calculate generation statistics from aggregations
    const generationStats = {
      total: totalGenerations,
      by_status: {
        PENDING: getCount(generationStatusCounts, "status", "PENDING"),
        PROCESSING: getCount(generationStatusCounts, "status", "PROCESSING"),
        COMPLETED: getCount(generationStatusCounts, "status", "COMPLETED"),
        FAILED: getCount(generationStatusCounts, "status", "FAILED"),
        CANCELLED: getCount(generationStatusCounts, "status", "CANCELLED"),
      },
      scored: generationScoreAgg._count.qualityScore || 0,
      avg_quality_score: generationScoreAgg._avg.qualityScore,
      high_quality_count: highQualityGenCount,
    };

    // Calculate total posts from groupBy
    const totalPosts = postStatusCounts.reduce((sum, p) => sum + p._count, 0);

    // Calculate publishing statistics from aggregations
    const publishingStats = {
      total: totalPosts,
      by_status: {
        DRAFT: getCount(postStatusCounts, "status", "DRAFT"),
        SCHEDULED: getCount(postStatusCounts, "status", "SCHEDULED"),
        PUBLISHING: getCount(postStatusCounts, "status", "PUBLISHING"),
        PUBLISHED: getCount(postStatusCounts, "status", "PUBLISHED"),
        FAILED: getCount(postStatusCounts, "status", "FAILED"),
        CANCELLED: getCount(postStatusCounts, "status", "CANCELLED"),
      },
      by_platform: {
        TIKTOK: getCount(postPlatformCounts, "platform", "TIKTOK"),
        YOUTUBE: getCount(postPlatformCounts, "platform", "YOUTUBE"),
        INSTAGRAM: getCount(postPlatformCounts, "platform", "INSTAGRAM"),
        TWITTER: getCount(postPlatformCounts, "platform", "TWITTER"),
      },
    };

    // Helper to get SNS by platform stats
    const getSnsPlatformStats = (platform: string) => {
      const found = snsByPlatform.find((p) => p.platform === platform);
      return {
        posts: found?._count || 0,
        views: found?._sum.viewCount || 0,
        likes: found?._sum.likeCount || 0,
      };
    };

    // Calculate SNS analytics from aggregations
    const analyticsStats = {
      total_published: snsGlobalAgg._count || 0,
      total_views: snsGlobalAgg._sum.viewCount || 0,
      total_likes: snsGlobalAgg._sum.likeCount || 0,
      total_comments: snsGlobalAgg._sum.commentCount || 0,
      total_shares: snsGlobalAgg._sum.shareCount || 0,
      total_saves: snsGlobalAgg._sum.saveCount || 0,
      avg_engagement_rate: snsGlobalAgg._avg.engagementRate,
      by_platform: {
        TIKTOK: getSnsPlatformStats("TIKTOK"),
        YOUTUBE: getSnsPlatformStats("YOUTUBE"),
        INSTAGRAM: getSnsPlatformStats("INSTAGRAM"),
        TWITTER: getSnsPlatformStats("TWITTER"),
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
