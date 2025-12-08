import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { CampaignStatus } from "@prisma/client";
import { invalidateCampaignCache } from "@/lib/cache";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        artist: {
          select: {
            name: true,
            stageName: true,
            labelId: true,
          },
        },
        _count: {
          select: { assets: true },
        },
      },
    });

    // Check if campaign exists and is not soft deleted
    if (!campaign || campaign.deletedAt) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
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
      asset_count: campaign._count.assets,
    });
  } catch (error) {
    console.error("Get campaign error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Check campaign exists and user has access
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        artist: {
          select: { labelId: true },
        },
      },
    });

    // Check if campaign exists and is not soft deleted
    if (!existingCampaign || existingCampaign.deletedAt) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(existingCampaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, status, target_countries } = body;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status: status.toUpperCase() as CampaignStatus }),
        ...(target_countries && { targetCountries: target_countries }),
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

    // Invalidate cache
    await invalidateCampaignCache(id);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Update campaign error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Check campaign exists and user has access
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        artist: {
          select: { labelId: true },
        },
      },
    });

    // Check if campaign exists and is not already soft deleted
    if (!existingCampaign || existingCampaign.deletedAt) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(existingCampaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Soft delete: set deletedAt instead of actual delete
    await prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Invalidate cache
    await invalidateCampaignCache(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete campaign error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
