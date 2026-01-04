import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { AssetType } from "@prisma/client";

/**
 * GET /api/v1/assets - Get all assets across all campaigns
 * Supports filtering by type, campaign, and search
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
    const type = searchParams.get("type") as AssetType | null;
    const campaignId = searchParams.get("campaign_id");
    const search = searchParams.get("search");

    // Build where clause based on user's access
    const where: Record<string, unknown> = {};

    // Filter by type if provided
    if (type) {
      where.type = type.toUpperCase() as AssetType;
    }

    // Filter by campaign if provided
    if (campaignId) {
      where.campaignId = campaignId;
    }

    // Search by filename
    if (search) {
      where.OR = [
        { originalFilename: { contains: search, mode: "insensitive" } },
        { filename: { contains: search, mode: "insensitive" } },
      ];
    }

    // For non-admin users, only show assets from campaigns they have access to
    if (user.role !== "ADMIN") {
      const accessibleCampaigns = await withRetry(() => prisma.campaign.findMany({
        where: {
          artist: {
            labelId: { in: user.labelIds },
          },
        },
        select: { id: true },
      }));

      where.campaignId = { in: accessibleCampaigns.map((c) => c.id) };
    }

    // Parallelize count, findMany, and stats groupBy
    const [total, assets, typeCounts] = await Promise.all([
      withRetry(() => prisma.asset.count({ where })),
      withRetry(() => prisma.asset.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })),
      // Single groupBy instead of 4 separate count queries
      withRetry(() => prisma.asset.groupBy({
        by: ["type"],
        where,
        _count: true,
      })),
    ]);

    const pages = Math.ceil(total / pageSize) || 1;

    const items = assets.map((asset) => ({
      id: asset.id,
      campaign_id: asset.campaignId,
      campaign_name: asset.campaign.name,
      type: asset.type.toLowerCase(),
      merchandise_type: asset.merchandiseType?.toLowerCase() || null,
      filename: asset.filename,
      original_filename: asset.originalFilename,
      s3_url: asset.s3Url,
      s3_key: asset.s3Key,
      file_size: asset.fileSize,
      mime_type: asset.mimeType,
      thumbnail_url: asset.thumbnailUrl,
      metadata: asset.metadata,
      created_by: asset.createdBy,
      created_at: asset.createdAt.toISOString(),
    }));

    // Build stats from groupBy result (1 query instead of 4)
    const getTypeCount = (type: string) =>
      typeCounts.find(t => t.type === type)?._count || 0;

    const stats = {
      total,
      images: getTypeCount("IMAGE"),
      audio: getTypeCount("AUDIO"),
      videos: getTypeCount("VIDEO"),
      goods: getTypeCount("GOODS"),
    };

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      pages,
      stats,
    });
  } catch (error) {
    console.error("Get all assets error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
