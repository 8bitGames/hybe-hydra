import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";

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

    const { id: campaignId } = await params;

    // Check campaign access
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: { select: { labelId: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Get generation counts by status
    const [total, pending, processing, completed, failed, cancelled] = await Promise.all([
      prisma.videoGeneration.count({ where: { campaignId } }),
      prisma.videoGeneration.count({ where: { campaignId, status: "PENDING" } }),
      prisma.videoGeneration.count({ where: { campaignId, status: "PROCESSING" } }),
      prisma.videoGeneration.count({ where: { campaignId, status: "COMPLETED" } }),
      prisma.videoGeneration.count({ where: { campaignId, status: "FAILED" } }),
      prisma.videoGeneration.count({ where: { campaignId, status: "CANCELLED" } }),
    ]);

    // Get average quality score for completed generations
    const avgQuality = await prisma.videoGeneration.aggregate({
      where: {
        campaignId,
        status: "COMPLETED",
        qualityScore: { not: null },
      },
      _avg: {
        qualityScore: true,
      },
    });

    return NextResponse.json({
      total,
      pending,
      processing,
      completed,
      failed,
      cancelled,
      avg_quality_score: avgQuality._avg.qualityScore || null,
    });
  } catch (error) {
    console.error("Get generation stats error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
