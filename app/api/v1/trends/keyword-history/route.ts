import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/db/prisma";

// GET /api/v1/trends/keyword-history - Get past keyword analysis history
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = { platform: "TIKTOK" as const };

    // Parallelize findMany and count queries
    const [analyses, total] = await Promise.all([
      withRetry(() => prisma.keywordAnalysis.findMany({
        where,
        orderBy: {
          analyzedAt: "desc",
        },
        take: limit,
        skip: offset,
        select: {
          id: true,
          keyword: true,
          platform: true,
          totalVideos: true,
          avgViews: true,
          avgEngagementRate: true,
          recommendedHashtags: true,
          analyzedAt: true,
          expiresAt: true,
          // Include AI summary if available
          aiInsights: true,
        },
      })),
      withRetry(() => prisma.keywordAnalysis.count({ where })),
    ]);

    // Format the response
    const formattedAnalyses = analyses.map((a) => ({
      id: a.id,
      keyword: a.keyword,
      platform: a.platform,
      totalVideos: a.totalVideos,
      avgViews: Number(a.avgViews),
      avgEngagementRate: a.avgEngagementRate,
      recommendedHashtags: a.recommendedHashtags.slice(0, 5),
      analyzedAt: a.analyzedAt.toISOString(),
      expiresAt: a.expiresAt.toISOString(),
      isExpired: a.expiresAt < new Date(),
      aiSummary: (a.aiInsights as any)?.summary || null,
    }));

    return NextResponse.json({
      success: true,
      history: formattedAnalyses,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error("[KEYWORD-HISTORY] Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to fetch keyword history",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/trends/keyword-history/:id - Delete a keyword analysis
export async function DELETE(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ detail: "id parameter is required" }, { status: 400 });
    }

    await withRetry(() => prisma.keywordAnalysis.delete({
      where: { id },
    }));

    return NextResponse.json({
      success: true,
      message: "Keyword analysis deleted",
    });
  } catch (err) {
    console.error("[KEYWORD-HISTORY] Delete error:", err);
    return NextResponse.json(
      {
        detail: "Failed to delete keyword analysis",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
