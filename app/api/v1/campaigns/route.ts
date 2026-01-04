import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { CampaignStatus } from "@prisma/client";
import { cached, CacheKeys, CacheTTL, invalidateCampaignCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const status = searchParams.get("status") as CampaignStatus | null;
    const artistId = searchParams.get("artist_id");

    // Build where clause - exclude soft deleted campaigns
    const where: Record<string, unknown> = {
      deletedAt: { equals: null },
    };

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
  // Parallelize count and findMany queries
  const [total, campaigns] = await Promise.all([
    withRetry(() => prisma.campaign.count({ where })),
    withRetry(() => prisma.campaign.findMany({
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
        // Removed: videoGenerations select - replaced with groupBy below
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })),
  ]);

  const pages = Math.ceil(total / pageSize) || 1;

  // Early return if no campaigns
  if (campaigns.length === 0) {
    return { items: [], total, page, page_size: pageSize, pages };
  }

  const campaignIds = campaigns.map(c => c.id);

  // Fetch video stats using database aggregation instead of loading all records
  const [
    videoStatusCounts,
    videoScoreStats,
  ] = await Promise.all([
    // Group by campaignId and status to get counts
    withRetry(() => prisma.videoGeneration.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaignIds } },
      _count: true,
    })),
    // Get score stats per campaign
    withRetry(() => prisma.videoGeneration.groupBy({
      by: ["campaignId"],
      where: {
        campaignId: { in: campaignIds },
        qualityScore: { not: null },
      },
      _count: true,
      _avg: { qualityScore: true },
    })),
  ]);

  // Build lookup maps for efficient access
  type StatusCountMap = Map<string, { completed: number; processing: number; failed: number }>;
  const statusCountMap: StatusCountMap = new Map();

  for (const item of videoStatusCounts) {
    if (!item.campaignId) continue;
    const existing = statusCountMap.get(item.campaignId) || { completed: 0, processing: 0, failed: 0 };
    if (item.status === "COMPLETED") existing.completed = item._count;
    else if (item.status === "PROCESSING" || item.status === "PENDING") existing.processing += item._count;
    else if (item.status === "FAILED") existing.failed = item._count;
    statusCountMap.set(item.campaignId, existing);
  }

  type ScoreMap = Map<string, { scored: number; avgScore: number | null }>;
  const scoreMap: ScoreMap = new Map();

  for (const item of videoScoreStats) {
    if (!item.campaignId) continue;
    scoreMap.set(item.campaignId, {
      scored: item._count,
      avgScore: item._avg.qualityScore,
    });
  }

  const items = campaigns.map((c) => {
    const statusCounts = statusCountMap.get(c.id) || { completed: 0, processing: 0, failed: 0 };
    const scoreStats = scoreMap.get(c.id) || { scored: 0, avgScore: null };

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
      genre: c.genre,
      created_by: c.createdBy,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
      artist_name: c.artist.name,
      artist_stage_name: c.artist.stageName,
      asset_count: c._count.assets,
      video_count: c._count.videoGenerations,
      video_completed: statusCounts.completed,
      video_processing: statusCounts.processing,
      video_failed: statusCounts.failed,
      video_scored: scoreStats.scored,
      video_avg_score: scoreStats.avgScore ? Math.round(scoreStats.avgScore * 10) / 10 : null,
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
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, artist_id, description, target_countries, start_date, end_date, genre } = body;

    if (!name || !artist_id) {
      return NextResponse.json(
        { detail: "Name and artist_id are required" },
        { status: 400 }
      );
    }

    // Check artist exists and user has access
    const artist = await withRetry(() => prisma.artist.findUnique({
      where: { id: artist_id },
    }));

    if (!artist) {
      return NextResponse.json({ detail: "Artist not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Create campaign
    const campaign = await withRetry(() => prisma.campaign.create({
      data: {
        name,
        artistId: artist_id,
        description: description || null,
        targetCountries: target_countries || [],
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null,
        genre: genre || null,  // Music genre for content generation
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
    }));

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
        genre: campaign.genre,
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
