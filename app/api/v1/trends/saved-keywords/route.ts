import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/db/prisma";
import { TrendPlatform } from "@prisma/client";

// GET /api/v1/trends/saved-keywords - List user's saved keywords
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") as TrendPlatform | null;
    const includeSnapshots = searchParams.get("include_snapshots") === "true";
    const snapshotDays = parseInt(searchParams.get("snapshot_days") || "7");

    // Build where clause
    const where: any = { userId: user.id };
    if (platform) {
      where.platform = platform;
    }

    // Calculate date range for snapshots
    const snapshotStartDate = new Date();
    snapshotStartDate.setDate(snapshotStartDate.getDate() - snapshotDays);
    snapshotStartDate.setHours(0, 0, 0, 0);

    const savedKeywords = await withRetry(() => prisma.savedKeyword.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      include: includeSnapshots ? {
        snapshots: {
          where: {
            date: { gte: snapshotStartDate },
          },
          orderBy: { date: "asc" },
        },
      } : undefined,
    }));

    // Convert BigInt to number for JSON serialization
    const serialized = savedKeywords.map((kw: any) => ({
      ...kw,
      baselineViews: kw.baselineViews ? Number(kw.baselineViews) : null,
      snapshots: kw.snapshots?.map((s: any) => ({
        ...s,
        totalViews: Number(s.totalViews),
        avgViews: Number(s.avgViews),
      })),
    }));

    return NextResponse.json({
      success: true,
      savedKeywords: serialized,
      count: serialized.length,
    });
  } catch (err) {
    console.error("[SAVED-KEYWORDS] GET error:", err);
    return NextResponse.json(
      { detail: "Failed to fetch saved keywords" },
      { status: 500 }
    );
  }
}

// POST /api/v1/trends/saved-keywords - Save a new keyword
export async function POST(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      keyword,
      platform = "TIKTOK",
      displayName,
      color,
      notes,
      priority = 0,
      alertEnabled = false,
      alertThreshold,
      // Current analysis data for baseline
      currentViews,
      currentEngagement,
      currentTotalVideos,
      currentViralCount,
    } = body;

    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json(
        { detail: "keyword is required" },
        { status: 400 }
      );
    }

    const normalizedKeyword = keyword.toLowerCase().trim().replace(/^#/, "");

    // Check if already saved
    const existing = await withRetry(() => prisma.savedKeyword.findUnique({
      where: {
        userId_keyword_platform: {
          userId: user.id,
          keyword: normalizedKeyword,
          platform: platform as TrendPlatform,
        },
      },
    }));

    if (existing) {
      return NextResponse.json(
        { detail: "Keyword already saved", savedKeyword: existing },
        { status: 409 }
      );
    }

    // Create saved keyword with baseline metrics
    const savedKeyword = await withRetry(() => prisma.savedKeyword.create({
      data: {
        userId: user.id,
        keyword: normalizedKeyword,
        platform: platform as TrendPlatform,
        displayName: displayName || null,
        color: color || null,
        notes: notes || null,
        priority,
        alertEnabled,
        alertThreshold: alertThreshold || null,
        baselineViews: currentViews ? BigInt(currentViews) : null,
        baselineEngagement: currentEngagement || null,
        baselineTotalVideos: currentTotalVideos || null,
        baselineViralCount: currentViralCount || null,
        lastAnalyzedAt: new Date(),
      },
    }));

    // If we have current analysis data, create initial snapshot
    if (currentViews !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await withRetry(() => prisma.keywordDailySnapshot.create({
        data: {
          savedKeywordId: savedKeyword.id,
          date: today,
          totalViews: BigInt(currentViews || 0),
          avgViews: BigInt(Math.round((currentViews || 0) / Math.max(currentTotalVideos || 1, 1))),
          avgEngagement: currentEngagement || 0,
          totalVideos: currentTotalVideos || 0,
          viralCount: currentViralCount || 0,
          highPerformingCount: 0,
          trendScore: calculateTrendScore(currentViews, currentEngagement, currentViralCount),
          viralityScore: calculateViralityScore(currentViralCount, currentTotalVideos),
          growthScore: 50, // Initial score (no previous data to compare)
        },
      }));
    }

    return NextResponse.json({
      success: true,
      savedKeyword: {
        ...savedKeyword,
        baselineViews: savedKeyword.baselineViews ? Number(savedKeyword.baselineViews) : null,
      },
    });
  } catch (err) {
    console.error("[SAVED-KEYWORDS] POST error:", err);
    return NextResponse.json(
      { detail: "Failed to save keyword" },
      { status: 500 }
    );
  }
}

// Helper functions for score calculation
function calculateTrendScore(
  views: number | undefined,
  engagement: number | undefined,
  viralCount: number | undefined
): number {
  if (!views) return 0;

  // Normalize views (log scale, max ~100M views = 100)
  const viewScore = Math.min(100, Math.log10(views + 1) * 12.5);

  // Engagement score (0-10% range mapped to 0-100)
  const engagementScore = Math.min(100, (engagement || 0) * 10);

  // Viral bonus
  const viralBonus = Math.min(20, (viralCount || 0) * 5);

  // Weighted combination
  return Math.round(viewScore * 0.4 + engagementScore * 0.4 + viralBonus);
}

function calculateViralityScore(
  viralCount: number | undefined,
  totalVideos: number | undefined
): number {
  if (!totalVideos || totalVideos === 0) return 0;

  const viralRatio = (viralCount || 0) / totalVideos;
  return Math.round(Math.min(100, viralRatio * 1000)); // 10% viral = 100
}
