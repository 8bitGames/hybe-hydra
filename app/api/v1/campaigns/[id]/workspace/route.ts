import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/campaigns/[id]/workspace - Get comprehensive workspace data for a campaign
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Check campaign access
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: {
          select: { id: true, name: true, stageName: true, groupName: true, labelId: true },
        },
        _count: {
          select: { assets: true, videoGenerations: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Get all generations with full context (exclude soft-deleted)
    const generations = await prisma.videoGeneration.findMany({
      where: { campaignId, deletedAt: null },
      include: {
        referenceImage: {
          select: { id: true, filename: true, s3Url: true, thumbnailUrl: true },
        },
        outputAsset: {
          select: { id: true, filename: true, s3Url: true, thumbnailUrl: true },
        },
        merchandiseReferences: {
          include: {
            merchandise: {
              select: { id: true, name: true, nameKo: true, type: true, thumbnailUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all scheduled posts
    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: { campaignId },
      include: {
        socialAccount: {
          select: { id: true, accountName: true, platform: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all assets
    const assets = await prisma.asset.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
    });

    // Get all generated preview images for this campaign
    const previewImages = await prisma.generatedPreviewImage.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
    });

    // Extract unique prompts (group by original_input or prompt)
    const promptMap = new Map<string, {
      original_input: string;
      veo_prompt: string;
      trend_keywords: string[];
      prompt_analysis: unknown;
      generation_ids: string[];
      success_count: number;
      total_count: number;
      avg_quality_score: number | null;
      first_used: Date;
      last_used: Date;
    }>();

    generations.forEach((gen) => {
      const key = gen.originalInput || gen.prompt;
      const existing = promptMap.get(key);
      const qualityScore = gen.qualityScore;

      if (existing) {
        existing.generation_ids.push(gen.id);
        existing.total_count++;
        if (gen.status === "COMPLETED") existing.success_count++;
        if (qualityScore !== null) {
          if (existing.avg_quality_score === null) {
            existing.avg_quality_score = qualityScore;
          } else {
            existing.avg_quality_score = (existing.avg_quality_score * (existing.total_count - 1) + qualityScore) / existing.total_count;
          }
        }
        if (gen.createdAt > existing.last_used) existing.last_used = gen.createdAt;
        if (gen.createdAt < existing.first_used) existing.first_used = gen.createdAt;
      } else {
        promptMap.set(key, {
          original_input: gen.originalInput || gen.prompt,
          veo_prompt: gen.prompt,
          trend_keywords: gen.trendKeywords || [],
          prompt_analysis: gen.promptAnalysis,
          generation_ids: [gen.id],
          success_count: gen.status === "COMPLETED" ? 1 : 0,
          total_count: 1,
          avg_quality_score: qualityScore,
          first_used: gen.createdAt,
          last_used: gen.createdAt,
        });
      }
    });

    // Extract unique trend keywords used
    const trendUsageMap = new Map<string, { count: number; success_count: number; avg_score: number | null }>();
    generations.forEach((gen) => {
      (gen.trendKeywords || []).forEach((keyword) => {
        const existing = trendUsageMap.get(keyword);
        const qualityScore = gen.qualityScore;
        if (existing) {
          existing.count++;
          if (gen.status === "COMPLETED") existing.success_count++;
          if (qualityScore !== null) {
            if (existing.avg_score === null) {
              existing.avg_score = qualityScore;
            } else {
              existing.avg_score = (existing.avg_score * (existing.count - 1) + qualityScore) / existing.count;
            }
          }
        } else {
          trendUsageMap.set(keyword, {
            count: 1,
            success_count: gen.status === "COMPLETED" ? 1 : 0,
            avg_score: qualityScore,
          });
        }
      });
    });

    // Extract reference URLs used
    const referenceUrls: Array<{
      url: string;
      title?: string;
      platform?: string;
      hashtags?: string[];
      used_count: number;
      first_used: string;
    }> = [];
    const urlSet = new Set<string>();

    generations.forEach((gen) => {
      const refs = gen.referenceUrls as Array<{ url: string; title?: string; platform?: string; hashtags?: string[] }> | null;
      if (refs && Array.isArray(refs)) {
        refs.forEach((ref) => {
          if (!urlSet.has(ref.url)) {
            urlSet.add(ref.url);
            referenceUrls.push({
              url: ref.url,
              title: ref.title,
              platform: ref.platform,
              hashtags: ref.hashtags,
              used_count: 1,
              first_used: gen.createdAt.toISOString(),
            });
          } else {
            const existing = referenceUrls.find((r) => r.url === ref.url);
            if (existing) existing.used_count++;
          }
        });
      }
    });

    // Build timeline (sorted by date, all activities)
    const timeline: Array<{
      id: string;
      type: "generation" | "publish" | "asset";
      date: string;
      data: unknown;
    }> = [];

    generations.forEach((gen) => {
      timeline.push({
        id: gen.id,
        type: "generation",
        date: gen.createdAt.toISOString(),
        data: {
          id: gen.id,
          status: gen.status.toLowerCase(),
          prompt: gen.prompt,
          original_input: gen.originalInput,
          trend_keywords: gen.trendKeywords,
          output_url: gen.outputUrl,
          composed_output_url: gen.composedOutputUrl,
          quality_score: gen.qualityScore,
          is_favorite: gen.isFavorite,
          tags: gen.tags,
          duration_seconds: gen.durationSeconds,
          aspect_ratio: gen.aspectRatio,
        },
      });
    });

    scheduledPosts.forEach((post) => {
      timeline.push({
        id: post.id,
        type: "publish",
        date: (post.publishedAt || post.createdAt).toISOString(),
        data: {
          id: post.id,
          status: post.status.toLowerCase(),
          platform: post.platform,
          account_name: post.socialAccount.accountName,
          published_url: post.publishedUrl,
          view_count: post.viewCount,
          like_count: post.likeCount,
          engagement_rate: post.engagementRate,
        },
      });
    });

    // Sort timeline by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate statistics
    const stats = {
      generations: {
        total: generations.length,
        completed: generations.filter((g) => g.status === "COMPLETED").length,
        processing: generations.filter((g) => g.status === "PROCESSING").length,
        failed: generations.filter((g) => g.status === "FAILED").length,
        avg_quality: (() => {
          const scored = generations.filter((g) => g.qualityScore !== null);
          if (scored.length === 0) return null;
          return scored.reduce((sum, g) => sum + (g.qualityScore || 0), 0) / scored.length;
        })(),
        high_quality: generations.filter((g) => (g.qualityScore || 0) >= 70).length,
      },
      publishing: {
        total: scheduledPosts.length,
        published: scheduledPosts.filter((p) => p.status === "PUBLISHED").length,
        scheduled: scheduledPosts.filter((p) => p.status === "SCHEDULED").length,
        total_views: scheduledPosts.reduce((sum, p) => sum + (p.viewCount || 0), 0),
        total_likes: scheduledPosts.reduce((sum, p) => sum + (p.likeCount || 0), 0),
      },
      prompts: {
        unique_count: promptMap.size,
        most_successful: Array.from(promptMap.entries())
          .filter(([, v]) => v.success_count > 0)
          .sort((a, b) => (b[1].avg_quality_score || 0) - (a[1].avg_quality_score || 0))
          .slice(0, 3)
          .map(([key, v]) => ({
            original_input: v.original_input,
            avg_quality_score: v.avg_quality_score,
            success_count: v.success_count,
          })),
      },
      trends: {
        unique_count: trendUsageMap.size,
        top_trends: Array.from(trendUsageMap.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5)
          .map(([keyword, data]) => ({
            keyword,
            usage_count: data.count,
            avg_score: data.avg_score,
          })),
      },
      preview_images: {
        total: previewImages.length,
        direct_mode: previewImages.filter((p) => p.compositionMode === "direct").length,
        two_step_mode: previewImages.filter((p) => p.compositionMode === "two_step").length,
        used_in_videos: previewImages.filter((p) => p.usedInGenerationId !== null).length,
      },
    };

    // Format response
    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status.toLowerCase(),
        artist: {
          id: campaign.artist.id,
          name: campaign.artist.stageName || campaign.artist.name,
          group: campaign.artist.groupName,
        },
        asset_count: campaign._count.assets,
        generation_count: campaign._count.videoGenerations,
        created_at: campaign.createdAt.toISOString(),
      },
      stats,
      timeline: timeline.slice(0, 50), // Limit to recent 50 items
      prompts: Array.from(promptMap.values()).map((p) => ({
        original_input: p.original_input,
        veo_prompt: p.veo_prompt,
        trend_keywords: p.trend_keywords,
        prompt_analysis: p.prompt_analysis,
        generation_count: p.total_count,
        success_count: p.success_count,
        success_rate: p.total_count > 0 ? (p.success_count / p.total_count) * 100 : 0,
        avg_quality_score: p.avg_quality_score,
        first_used: p.first_used.toISOString(),
        last_used: p.last_used.toISOString(),
      })),
      trends: Array.from(trendUsageMap.entries()).map(([keyword, data]) => ({
        keyword,
        usage_count: data.count,
        success_count: data.success_count,
        avg_score: data.avg_score,
      })),
      reference_urls: referenceUrls,
      generations: generations.map((gen) => ({
        id: gen.id,
        prompt: gen.prompt,
        original_input: gen.originalInput,
        trend_keywords: gen.trendKeywords,
        prompt_analysis: gen.promptAnalysis,
        status: gen.status.toLowerCase(),
        output_url: gen.outputUrl,
        composed_output_url: gen.composedOutputUrl,
        quality_score: gen.qualityScore,
        quality_metadata: gen.qualityMetadata,
        is_favorite: gen.isFavorite,
        tags: gen.tags,
        duration_seconds: gen.durationSeconds,
        aspect_ratio: gen.aspectRatio,
        image_assets: gen.imageAssets as Array<{ id: string; url: string; keyword: string; sortOrder: number }> | null,
        reference_image: gen.referenceImage
          ? {
              id: gen.referenceImage.id,
              filename: gen.referenceImage.filename,
              s3_url: gen.referenceImage.s3Url,
              thumbnail_url: gen.referenceImage.thumbnailUrl,
            }
          : null,
        merchandise_refs: gen.merchandiseReferences.map((mr) => ({
          context: mr.context,
          guidance_scale: mr.guidanceScale,
          merchandise: mr.merchandise
            ? {
                id: mr.merchandise.id,
                name: mr.merchandise.name,
                name_ko: mr.merchandise.nameKo,
                type: mr.merchandise.type,
                thumbnail_url: mr.merchandise.thumbnailUrl,
              }
            : null,
        })),
        created_at: gen.createdAt.toISOString(),
      })),
      publishing: scheduledPosts.map((post) => ({
        id: post.id,
        platform: post.platform,
        status: post.status.toLowerCase(),
        account_name: post.socialAccount.accountName,
        generation_id: post.generationId,
        caption: post.caption,
        scheduled_at: post.scheduledAt?.toISOString(),
        published_at: post.publishedAt?.toISOString(),
        published_url: post.publishedUrl,
        view_count: post.viewCount,
        like_count: post.likeCount,
        comment_count: post.commentCount,
        share_count: post.shareCount,
        engagement_rate: post.engagementRate,
        created_at: post.createdAt.toISOString(),
      })),
      preview_images: previewImages.map((img) => ({
        id: img.id,
        preview_id: img.previewId,
        image_url: img.imageUrl,
        video_prompt: img.videoPrompt,
        image_description: img.imageDescription,
        gemini_image_prompt: img.geminiImagePrompt,
        aspect_ratio: img.aspectRatio,
        style: img.style,
        composition_mode: img.compositionMode,
        composite_prompt: img.compositePrompt,
        scene_image_url: img.sceneImageUrl,
        product_image_url: img.productImageUrl,
        hand_pose: img.handPose,
        used_in_generation_id: img.usedInGenerationId,
        created_at: img.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get workspace error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
