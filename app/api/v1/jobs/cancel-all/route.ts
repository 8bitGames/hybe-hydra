import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";

/**
 * POST /api/v1/jobs/cancel-all
 * Cancel all pending/processing jobs for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Find all active generations for this user
    const activeGenerations = await prisma.videoGeneration.findMany({
      where: {
        createdBy: user.id,
        status: { in: ["PENDING", "PROCESSING"] },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (activeGenerations.length === 0) {
      return NextResponse.json({
        cancelled: 0,
        message: "No active jobs to cancel",
      });
    }

    // Cancel all active generations
    const result = await prisma.videoGeneration.updateMany({
      where: {
        id: { in: activeGenerations.map((g) => g.id) },
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "CANCELLED",
        errorMessage: "Cancelled by user (batch cancel)",
      },
    });

    return NextResponse.json({
      cancelled: result.count,
      message: `Successfully cancelled ${result.count} job(s)`,
    });
  } catch (error) {
    console.error("[Jobs Cancel All API] Error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
