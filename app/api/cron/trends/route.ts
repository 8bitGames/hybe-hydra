import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { TrendPlatform, Prisma } from "@prisma/client";
import {
  collectTikTokTrends,
  closeBrowser,
  TikTokTrendItem,
} from "@/lib/tiktok-trends";

// Default keywords to collect trends for
const DEFAULT_KEYWORDS = [
  "countrymusic",
  "countrysong",
  "nashville",
  "carlypearce",
  "countryconcert",
  "countrylive",
  "acoustic",
  "songwriting",
  "countryartist",
  "newcountry",
  "countrytiktok",
];

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // If no CRON_SECRET is set, deny access
  if (!cronSecret) {
    console.warn("[CRON] CRON_SECRET not configured");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  console.log("[CRON-TRENDS] Cron job triggered at:", new Date().toISOString());

  // Verify cron secret
  if (!verifyCronSecret(request)) {
    console.error("[CRON-TRENDS] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Collect trends for default keywords
    console.log("[CRON-TRENDS] Starting collection for keywords:", DEFAULT_KEYWORDS);

    const result = await collectTikTokTrends({
      keywords: DEFAULT_KEYWORDS,
      hashtags: [],
      includeExplore: true,
    });

    const collectedTrends = result.trends;
    const method = result.method;
    const error = result.error;

    // Close browser after collection
    await closeBrowser();

    if (collectedTrends.length === 0) {
      console.log("[CRON-TRENDS] No trends collected:", error);
      return NextResponse.json({
        success: false,
        message: "No trends collected",
        error,
        method,
        timestamp: new Date().toISOString(),
      });
    }

    // Save to database
    const trendData = collectedTrends.map((trend: TikTokTrendItem) => ({
      platform: "TIKTOK" as TrendPlatform,
      keyword: trend.keyword,
      rank: trend.rank,
      region: "KR",
      viewCount: trend.viewCount ? BigInt(Math.floor(trend.viewCount)) : null,
      videoCount: trend.videoCount || null,
      description: trend.description || null,
      hashtags: trend.hashtag ? [trend.hashtag] : [],
      metadata: trend.metadata ? (trend.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      trendUrl: trend.trendUrl || null,
      thumbnailUrl: trend.thumbnailUrl || null,
    }));

    const created = await prisma.trendSnapshot.createMany({
      data: trendData,
      skipDuplicates: true,
    });

    console.log("[CRON-TRENDS] Collection complete:", {
      collected: collectedTrends.length,
      saved: created.count,
      method,
    });

    return NextResponse.json({
      success: true,
      collected_count: collectedTrends.length,
      saved_count: created.count,
      method,
      keywords: DEFAULT_KEYWORDS,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[CRON-TRENDS] Error during collection:", err);

    // Try to close browser on error
    try {
      await closeBrowser();
    } catch (closeErr) {
      console.error("[CRON-TRENDS] Error closing browser:", closeErr);
    }

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering (admin only)
export async function POST(request: NextRequest) {
  // For manual POST requests, require auth header
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  // Reuse GET logic
  return GET(request);
}
