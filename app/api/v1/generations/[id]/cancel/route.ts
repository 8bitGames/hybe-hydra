import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const generation = await withRetry(() => prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    }));

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        // Quick Create - only owner can cancel
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Can only cancel pending or processing generations
    if (!["PENDING", "PROCESSING"].includes(generation.status)) {
      return NextResponse.json(
        { detail: "Cannot cancel generation in current status" },
        { status: 400 }
      );
    }

    const updatedGeneration = await withRetry(() => prisma.videoGeneration.update({
      where: { id },
      data: {
        status: "CANCELLED",
        errorMessage: "Cancelled by user",
      },
    }));

    return NextResponse.json({
      id: updatedGeneration.id,
      status: updatedGeneration.status.toLowerCase(),
      message: "Generation cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
