import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

// Heatmap data structure for frontend visualization
interface HeatmapCell {
  date: string; // YYYY-MM-DD
  keyword: string;
  displayName: string | null;
  color: string | null;

  // Core metrics
  trendScore: number; // 0-100
  viralityScore: number; // 0-100
  growthScore: number; // 0-100

  // Raw values for tooltips
  totalViews: number;
  avgViews: number;
  avgEngagement: number;
  totalVideos: number;
  viralCount: number;

  // Growth indicators
  viewsGrowth: number | null;
  engagementGrowth: number | null;
}

interface HeatmapData {
  // X-axis: dates in chronological order
  dates: string[];

  // Y-axis: keywords sorted by priority
  keywords: {
    id: string;
    keyword: string;
    displayName: string | null;
    color: string | null;
    priority: number;
  }[];

  // Cells: matrix of data points
  cells: HeatmapCell[];

  // Summary statistics
  summary: {
    totalKeywords: number;
    dateRange: { start: string; end: string };
    avgTrendScore: number;
    topGrowing: { keyword: string; growthScore: number } | null;
    topViral: { keyword: string; viralityScore: number } | null;
  };
}

// GET /api/v1/trends/heatmap - Get heatmap data for visualization
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    const metric = searchParams.get("metric") || "trendScore"; // trendScore, viralityScore, growthScore

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetch user's saved keywords with snapshots
    const savedKeywords = await prisma.savedKeyword.findMany({
      where: { userId: user.id },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
      include: {
        snapshots: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: { date: "asc" },
        },
      },
    });

    if (savedKeywords.length === 0) {
      return NextResponse.json({
        success: true,
        heatmap: {
          dates: [],
          keywords: [],
          cells: [],
          summary: {
            totalKeywords: 0,
            dateRange: { start: startDate.toISOString().split("T")[0], end: endDate.toISOString().split("T")[0] },
            avgTrendScore: 0,
            topGrowing: null,
            topViral: null,
          },
        } as HeatmapData,
      });
    }

    // Generate date array
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Build keywords list
    const keywords = savedKeywords.map((kw) => ({
      id: kw.id,
      keyword: kw.keyword,
      displayName: kw.displayName,
      color: kw.color,
      priority: kw.priority,
    }));

    // Build cells matrix
    const cells: HeatmapCell[] = [];
    let totalTrendScore = 0;
    let cellCount = 0;
    let topGrowing: { keyword: string; growthScore: number } | null = null;
    let topViral: { keyword: string; viralityScore: number } | null = null;

    for (const kw of savedKeywords) {
      // Create a map of date -> snapshot for this keyword
      const snapshotMap = new Map<string, typeof kw.snapshots[0]>();
      for (const snapshot of kw.snapshots) {
        const dateStr = snapshot.date.toISOString().split("T")[0];
        snapshotMap.set(dateStr, snapshot);
      }

      for (const date of dates) {
        const snapshot = snapshotMap.get(date);

        if (snapshot) {
          const cell: HeatmapCell = {
            date,
            keyword: kw.keyword,
            displayName: kw.displayName,
            color: kw.color,
            trendScore: snapshot.trendScore,
            viralityScore: snapshot.viralityScore,
            growthScore: snapshot.growthScore,
            totalViews: Number(snapshot.totalViews),
            avgViews: Number(snapshot.avgViews),
            avgEngagement: snapshot.avgEngagement,
            totalVideos: snapshot.totalVideos,
            viralCount: snapshot.viralCount,
            viewsGrowth: snapshot.viewsGrowth,
            engagementGrowth: snapshot.engagementGrowth,
          };
          cells.push(cell);

          // Track statistics
          totalTrendScore += snapshot.trendScore;
          cellCount++;

          // Track top growing
          if (!topGrowing || snapshot.growthScore > topGrowing.growthScore) {
            topGrowing = { keyword: kw.keyword, growthScore: snapshot.growthScore };
          }

          // Track top viral
          if (!topViral || snapshot.viralityScore > topViral.viralityScore) {
            topViral = { keyword: kw.keyword, viralityScore: snapshot.viralityScore };
          }
        } else {
          // No data for this date - create empty cell
          cells.push({
            date,
            keyword: kw.keyword,
            displayName: kw.displayName,
            color: kw.color,
            trendScore: 0,
            viralityScore: 0,
            growthScore: 0,
            totalViews: 0,
            avgViews: 0,
            avgEngagement: 0,
            totalVideos: 0,
            viralCount: 0,
            viewsGrowth: null,
            engagementGrowth: null,
          });
        }
      }
    }

    const heatmap: HeatmapData = {
      dates,
      keywords,
      cells,
      summary: {
        totalKeywords: keywords.length,
        dateRange: {
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
        },
        avgTrendScore: cellCount > 0 ? Math.round(totalTrendScore / cellCount) : 0,
        topGrowing,
        topViral,
      },
    };

    return NextResponse.json({
      success: true,
      heatmap,
    });
  } catch (err) {
    console.error("[HEATMAP] GET error:", err);
    return NextResponse.json(
      { detail: "Failed to fetch heatmap data" },
      { status: 500 }
    );
  }
}
