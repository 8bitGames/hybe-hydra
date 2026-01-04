import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Save Quick Create generation to a campaign
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;

    // Find the Quick Create generation
    const generation = await withRetry(() => prisma.videoGeneration.findUnique({
      where: { id: generationId },
    }));

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check ownership
    if (generation.createdBy !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Must be a Quick Create generation
    if (!generation.isQuickCreate) {
      return NextResponse.json(
        { detail: "This generation is already part of a campaign" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return NextResponse.json({ detail: "campaign_id is required" }, { status: 400 });
    }

    // Check campaign exists and user has access
    const campaign = await withRetry(() => prisma.campaign.findUnique({
      where: { id: campaign_id },
      include: {
        artist: { select: { labelId: true } },
      },
    }));

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied to campaign" }, { status: 403 });
    }

    // Update generation to belong to campaign
    const updatedGeneration = await withRetry(() => prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        campaignId: campaign_id,
        isQuickCreate: false, // No longer a Quick Create
      },
    }));

    return NextResponse.json({
      id: updatedGeneration.id,
      campaign_id: updatedGeneration.campaignId,
      is_quick_create: updatedGeneration.isQuickCreate,
      prompt: updatedGeneration.prompt,
      status: updatedGeneration.status.toLowerCase(),
      output_url: updatedGeneration.outputUrl,
      message: "Generation saved to campaign successfully",
    });
  } catch (error) {
    console.error("Save to campaign error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
