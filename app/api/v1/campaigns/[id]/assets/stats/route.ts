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

    // Count assets by type
    const counts = await prisma.asset.groupBy({
      by: ["type"],
      where: { campaignId },
      _count: true,
    });

    const stats = {
      image: 0,
      video: 0,
      audio: 0,
      goods: 0,
      total: 0,
    };

    counts.forEach((c) => {
      const type = c.type.toLowerCase() as "image" | "video" | "audio" | "goods";
      stats[type] = c._count;
      stats.total += c._count;
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Get asset stats error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
