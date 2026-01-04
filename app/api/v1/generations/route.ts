import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { VideoGenerationType, VideoGenerationStatus } from "@prisma/client";

/**
 * GET /api/v1/generations - List video generations
 * Supports filtering by type, status, and includes test generations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "50");
    const type = searchParams.get("type") as VideoGenerationType | null;
    const status = searchParams.get("status") as VideoGenerationStatus | null;
    const includeTest = searchParams.get("include_test") === "true";
    const campaignId = searchParams.get("campaign_id");

    // Build base where clause
    const where: Record<string, unknown> = {
      deletedAt: null, // Exclude soft-deleted records
    };

    // Use AND array to combine multiple conditions
    const andConditions: Record<string, unknown>[] = [];

    // Only include videos with valid output (AI uses outputUrl, Fast Cut uses composedOutputUrl)
    andConditions.push({
      OR: [
        { outputUrl: { not: null } },
        { composedOutputUrl: { not: null } },
      ],
    });

    // Filter by type if provided
    if (type) {
      where.generationType = type.toUpperCase() as VideoGenerationType;
    }

    // Filter by status if provided
    if (status) {
      where.status = status.toUpperCase() as VideoGenerationStatus;
    }

    // Filter by campaign
    if (campaignId) {
      where.campaignId = campaignId;
    } else if (!includeTest) {
      // Exclude test generations (those without campaign)
      where.campaignId = { not: null };
    }

    // For non-admin users, filter by accessible campaigns or their own creations
    if (user.role !== "ADMIN") {
      const accessibleCampaigns = await withRetry(() => prisma.campaign.findMany({
        where: {
          artist: {
            labelId: { in: user.labelIds },
          },
        },
        select: { id: true },
      }));

      const accessibleCampaignIds = accessibleCampaigns.map((c) => c.id);

      // Can see: their own creations OR accessible campaign generations
      andConditions.push({
        OR: [
          { createdBy: user.id },
          { campaignId: { in: accessibleCampaignIds } },
        ],
      });
    }

    // Add AND conditions if any
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Get counts
    const [total, totalAi, totalCompose] = await Promise.all([
      prisma.videoGeneration.count({ where }),
      prisma.videoGeneration.count({ where: { ...where, generationType: "AI" } }),
      prisma.videoGeneration.count({ where: { ...where, generationType: "COMPOSE" } }),
    ]);

    const generations = await withRetry(() => prisma.videoGeneration.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
        audioAsset: {
          select: {
            id: true,
            originalFilename: true,
            metadata: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }));

    const pages = Math.ceil(total / pageSize) || 1;

    const items = generations.map((gen) => ({
      id: gen.id,
      campaign_id: gen.campaignId,
      campaign_name: gen.campaign?.name || null,
      generation_type: gen.generationType.toLowerCase(),
      status: gen.status.toLowerCase(),
      progress: gen.progress,
      prompt: gen.prompt,
      aspect_ratio: gen.aspectRatio,
      duration_seconds: gen.durationSeconds,
      output_url: gen.composedOutputUrl || gen.outputUrl, // Prefer composedOutputUrl for Fast Cut videos
      effect_preset: gen.effectPreset,
      script_data: gen.scriptData,
      image_assets: gen.imageAssets,
      trend_keywords: gen.trendKeywords,
      tiktok_seo: gen.tiktokSEO,
      quality_score: gen.qualityScore,
      quality_metadata: gen.qualityMetadata,
      error_message: gen.errorMessage,
      audio_asset: gen.audioAsset
        ? {
            id: gen.audioAsset.id,
            filename: gen.audioAsset.originalFilename,
            metadata: gen.audioAsset.metadata,
          }
        : null,
      created_by: gen.createdBy,
      created_at: gen.createdAt.toISOString(),
      updated_at: gen.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      items,
      total,
      total_ai: totalAi,
      total_compose: totalCompose,
      page,
      page_size: pageSize,
      pages,
    });
  } catch (error) {
    console.error("Get generations error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
