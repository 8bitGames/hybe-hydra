import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { CampaignStatus } from "@prisma/client";
import { cached, CacheKeys, CacheTTL, invalidateCampaignCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const status = searchParams.get("status") as CampaignStatus | null;
    const artistId = searchParams.get("artist_id");

    // Build where clause
    const where: Record<string, unknown> = {};

    // RBAC: Non-admin users can only see campaigns for their labels
    const labelKey = user.role === "ADMIN" ? "admin" : user.labelIds.sort().join(",");
    if (user.role !== "ADMIN") {
      where.artist = {
        labelId: { in: user.labelIds },
      };
    }

    if (status) {
      where.status = status.toUpperCase() as CampaignStatus;
    }

    if (artistId) {
      where.artistId = artistId;
    }

    // Cache key based on user's label access and query params
    const cacheKey = CacheKeys.campaignsList(labelKey, page, status || undefined);

    // Use cache for campaign list (30 second TTL)
    const result = await cached(cacheKey, CacheTTL.SHORT, async () => {
      return fetchCampaignsList(where, page, pageSize);
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get campaigns error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// Extracted data fetching logic for caching
async function fetchCampaignsList(
  where: Record<string, unknown>,
  page: number,
  pageSize: number
) {
  // Get total count
  const total = await prisma.campaign.count({ where });

  // Get campaigns with artist info and asset/video counts
  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      artist: {
        select: {
          name: true,
          stageName: true,
        },
      },
      _count: {
        select: {
          assets: true,
          videoGenerations: true,
        },
      },
      videoGenerations: {
        select: {
          status: true,
          qualityScore: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const pages = Math.ceil(total / pageSize) || 1;

  const items = campaigns.map((c) => {
    // Calculate video generation stats
    const videoStats = {
      total: c._count.videoGenerations,
      completed: c.videoGenerations.filter(v => v.status === "COMPLETED").length,
      processing: c.videoGenerations.filter(v => v.status === "PROCESSING" || v.status === "PENDING").length,
      failed: c.videoGenerations.filter(v => v.status === "FAILED").length,
      scored: c.videoGenerations.filter(v => v.qualityScore !== null).length,
      avgScore: c.videoGenerations.filter(v => v.qualityScore !== null).length > 0
        ? c.videoGenerations
            .filter(v => v.qualityScore !== null)
            .reduce((sum, v) => sum + (v.qualityScore || 0), 0) /
          c.videoGenerations.filter(v => v.qualityScore !== null).length
        : null,
    };

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      artist_id: c.artistId,
      status: c.status.toLowerCase(),
      target_countries: c.targetCountries,
      start_date: c.startDate?.toISOString() || null,
      end_date: c.endDate?.toISOString() || null,
      budget_code: c.budgetCode,
      created_by: c.createdBy,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
      artist_name: c.artist.name,
      artist_stage_name: c.artist.stageName,
      asset_count: c._count.assets,
      video_count: videoStats.total,
      video_completed: videoStats.completed,
      video_processing: videoStats.processing,
      video_failed: videoStats.failed,
      video_scored: videoStats.scored,
      video_avg_score: videoStats.avgScore ? Math.round(videoStats.avgScore * 10) / 10 : null,
    };
  });

  // Return data object (will be cached)
  return {
    items,
    total,
    page,
    page_size: pageSize,
    pages,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, artist_id, description, target_countries, start_date, end_date } = body;

    if (!name || !artist_id) {
      return NextResponse.json(
        { detail: "Name and artist_id are required" },
        { status: 400 }
      );
    }

    // Check artist exists and user has access
    const artist = await prisma.artist.findUnique({
      where: { id: artist_id },
    });

    if (!artist) {
      return NextResponse.json({ detail: "Artist not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        name,
        artistId: artist_id,
        description: description || null,
        targetCountries: target_countries || [],
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null,
        createdBy: user.id,
      },
      include: {
        artist: {
          select: {
            name: true,
            stageName: true,
          },
        },
      },
    });

    // Invalidate campaign list cache
    await invalidateCampaignCache(campaign.id);

    return NextResponse.json(
      {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        artist_id: campaign.artistId,
        status: campaign.status.toLowerCase(),
        target_countries: campaign.targetCountries,
        start_date: campaign.startDate?.toISOString() || null,
        end_date: campaign.endDate?.toISOString() || null,
        budget_code: campaign.budgetCode,
        created_by: campaign.createdBy,
        created_at: campaign.createdAt.toISOString(),
        updated_at: campaign.updatedAt.toISOString(),
        artist_name: campaign.artist.name,
        artist_stage_name: campaign.artist.stageName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
