import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/v1/merchandise/suggestions - Get suggested merchandise for a campaign/artist
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get("artist_id");
    const campaignId = searchParams.get("campaign_id");
    const limit = parseInt(searchParams.get("limit") || "10");

    let targetArtistId = artistId;

    // If campaign_id is provided, get artist from campaign
    if (campaignId && !artistId) {
      const campaign = await withRetry(() => prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          artistId: true,
          artist: {
            select: { labelId: true },
          },
        },
      }));

      if (!campaign) {
        return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
      }

      // Check RBAC access
      if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }

      targetArtistId = campaign.artistId;
    }

    // Build suggestions based on:
    // 1. Artist's merchandise (if artist specified)
    // 2. Most recently used merchandise
    // 3. Most popular merchandise
    const suggestions: {
      category: string;
      items: unknown[];
    }[] = [];

    // 1. Artist's merchandise
    if (targetArtistId) {
      const artistMerchandise = await withRetry(() => prisma.merchandiseItem.findMany({
        where: {
          artistId: targetArtistId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              stageName: true,
              groupName: true,
            },
          },
          _count: {
            select: { generationMerchandise: true },
          },
        },
      }));

      if (artistMerchandise.length > 0) {
        suggestions.push({
          category: "artist_merchandise",
          items: artistMerchandise.map((item) => ({
            id: item.id,
            name: item.name,
            name_ko: item.nameKo,
            type: item.type.toLowerCase(),
            s3_url: item.s3Url,
            thumbnail_url: item.thumbnailUrl,
            artist: item.artist ? {
              id: item.artist.id,
              name: item.artist.name,
              stage_name: item.artist.stageName,
              group_name: item.artist.groupName,
            } : null,
            usage_count: item._count.generationMerchandise,
          })),
        });
      }
    }

    // 2. Recently used merchandise (from user's generations)
    const recentlyUsed = await withRetry(() => prisma.generationMerchandise.findMany({
      where: {
        generation: {
          createdBy: user.id,
        },
        merchandise: {
          isActive: true,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      distinct: ["merchandiseId"],
      include: {
        merchandise: {
          include: {
            artist: {
              select: {
                id: true,
                name: true,
                stageName: true,
                groupName: true,
              },
            },
          },
        },
      },
    }));

    if (recentlyUsed.length > 0) {
      suggestions.push({
        category: "recently_used",
        items: recentlyUsed.map((gm) => ({
          id: gm.merchandise.id,
          name: gm.merchandise.name,
          name_ko: gm.merchandise.nameKo,
          type: gm.merchandise.type.toLowerCase(),
          s3_url: gm.merchandise.s3Url,
          thumbnail_url: gm.merchandise.thumbnailUrl,
          artist: gm.merchandise.artist ? {
            id: gm.merchandise.artist.id,
            name: gm.merchandise.artist.name,
            stage_name: gm.merchandise.artist.stageName,
            group_name: gm.merchandise.artist.groupName,
          } : null,
          last_used: gm.createdAt.toISOString(),
        })),
      });
    }

    // 3. Most popular merchandise (by usage count)
    const popular = await withRetry(() => prisma.merchandiseItem.findMany({
      where: {
        isActive: true,
        ...(user.role !== "ADMIN" ? {
          artist: {
            labelId: { in: user.labelIds },
          },
        } : {}),
      },
      orderBy: {
        generationMerchandise: {
          _count: "desc",
        },
      },
      take: limit,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            stageName: true,
            groupName: true,
          },
        },
        _count: {
          select: { generationMerchandise: true },
        },
      },
    }));

    const popularFiltered = popular.filter((item) => item._count.generationMerchandise > 0);
    if (popularFiltered.length > 0) {
      suggestions.push({
        category: "popular",
        items: popularFiltered.map((item) => ({
          id: item.id,
          name: item.name,
          name_ko: item.nameKo,
          type: item.type.toLowerCase(),
          s3_url: item.s3Url,
          thumbnail_url: item.thumbnailUrl,
          artist: item.artist ? {
            id: item.artist.id,
            name: item.artist.name,
            stage_name: item.artist.stageName,
            group_name: item.artist.groupName,
          } : null,
          usage_count: item._count.generationMerchandise,
        })),
      });
    }

    // 4. New releases (merchandise released in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newReleases = await withRetry(() => prisma.merchandiseItem.findMany({
      where: {
        isActive: true,
        releaseDate: {
          gte: thirtyDaysAgo,
        },
        ...(user.role !== "ADMIN" ? {
          artist: {
            labelId: { in: user.labelIds },
          },
        } : {}),
      },
      orderBy: { releaseDate: "desc" },
      take: limit,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            stageName: true,
            groupName: true,
          },
        },
      },
    }));

    if (newReleases.length > 0) {
      suggestions.push({
        category: "new_releases",
        items: newReleases.map((item) => ({
          id: item.id,
          name: item.name,
          name_ko: item.nameKo,
          type: item.type.toLowerCase(),
          s3_url: item.s3Url,
          thumbnail_url: item.thumbnailUrl,
          artist: item.artist ? {
            id: item.artist.id,
            name: item.artist.name,
            stage_name: item.artist.stageName,
            group_name: item.artist.groupName,
          } : null,
          release_date: item.releaseDate?.toISOString(),
        })),
      });
    }

    return NextResponse.json({
      suggestions,
      artist_id: targetArtistId,
      campaign_id: campaignId,
    });
  } catch (error) {
    console.error("Get merchandise suggestions error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
