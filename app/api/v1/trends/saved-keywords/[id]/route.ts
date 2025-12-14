import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/v1/trends/saved-keywords/[id] - Get a saved keyword with snapshots
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const snapshotDays = parseInt(searchParams.get("days") || "30");

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - snapshotDays);
    startDate.setHours(0, 0, 0, 0);

    const savedKeyword = await prisma.savedKeyword.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        snapshots: {
          where: {
            date: { gte: startDate },
          },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!savedKeyword) {
      return NextResponse.json({ detail: "Saved keyword not found" }, { status: 404 });
    }

    // Serialize BigInt values
    const serialized = {
      ...savedKeyword,
      baselineViews: savedKeyword.baselineViews ? Number(savedKeyword.baselineViews) : null,
      snapshots: savedKeyword.snapshots.map((s) => ({
        ...s,
        totalViews: Number(s.totalViews),
        avgViews: Number(s.avgViews),
      })),
    };

    return NextResponse.json({
      success: true,
      savedKeyword: serialized,
    });
  } catch (err) {
    console.error("[SAVED-KEYWORDS] GET by ID error:", err);
    return NextResponse.json(
      { detail: "Failed to fetch saved keyword" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/trends/saved-keywords/[id] - Update a saved keyword
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.savedKeyword.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ detail: "Saved keyword not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      displayName,
      color,
      notes,
      priority,
      alertEnabled,
      alertThreshold,
    } = body;

    const updated = await prisma.savedKeyword.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(color !== undefined && { color }),
        ...(notes !== undefined && { notes }),
        ...(priority !== undefined && { priority }),
        ...(alertEnabled !== undefined && { alertEnabled }),
        ...(alertThreshold !== undefined && { alertThreshold }),
      },
    });

    return NextResponse.json({
      success: true,
      savedKeyword: {
        ...updated,
        baselineViews: updated.baselineViews ? Number(updated.baselineViews) : null,
      },
    });
  } catch (err) {
    console.error("[SAVED-KEYWORDS] PATCH error:", err);
    return NextResponse.json(
      { detail: "Failed to update saved keyword" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/trends/saved-keywords/[id] - Delete a saved keyword
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.savedKeyword.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ detail: "Saved keyword not found" }, { status: 404 });
    }

    // Delete (cascades to snapshots)
    await prisma.savedKeyword.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Keyword deleted successfully",
    });
  } catch (err) {
    console.error("[SAVED-KEYWORDS] DELETE error:", err);
    return NextResponse.json(
      { detail: "Failed to delete saved keyword" },
      { status: 500 }
    );
  }
}
