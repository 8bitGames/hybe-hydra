import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { VideoGenerationType, VideoGenerationStatus } from "@prisma/client";

/**
 * GET /api/v1/generations - List video generations
 * Supports filtering by type, status, and includes test generations
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

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

    // Build where clause
    const where: Record<string, unknown> = {};

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
    } else if (includeTest) {
      // Include test generations (those without campaign)
      // OR with campaign but created by the user
    }

    // For non-admin users, filter by accessible campaigns or their own creations
    if (user.role !== "ADMIN") {
      const accessibleCampaigns = await prisma.campaign.findMany({
        where: {
          artist: {
            labelId: { in: user.labelIds },
          },
        },
        select: { id: true },
      });

      const accessibleCampaignIds = accessibleCampaigns.map((c) => c.id);

      // Can see: their own creations OR accessible campaign generations
      where.OR = [
        { createdBy: user.id },
        { campaignId: { in: accessibleCampaignIds } },
      ];
    }

    const total = await prisma.videoGeneration.count({ where });

    const generations = await prisma.videoGeneration.findMany({
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
    });

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
      output_url: gen.outputUrl,
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
      page,
      page_size: pageSize,
      pages,
    });
  } catch (error) {
    console.error("Get generations error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
