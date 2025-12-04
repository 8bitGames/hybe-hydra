import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { TrendPlatform, Prisma } from "@prisma/client";

// For fallback local scraping (not recommended in production)
import {
  collectTikTokTrends,
  closeBrowser,
  TikTokTrendItem,
} from "@/lib/tiktok-trends";

// Extend timeout for Modal callback or local scraping fallback
export const maxDuration = 120; // 2 minutes (Modal does the heavy lifting)

// Modal TikTok Trends endpoint
const MODAL_TIKTOK_ENDPOINT = process.env.MODAL_TIKTOK_ENDPOINT ||
  "https://modawnai--hydra-tiktok-trends-collect-trends-endpoint.modal.run";

// Default keywords to collect trends for
const DEFAULT_KEYWORDS = [
  "countrymusic",
  "nashville",
  "carlypearce",
  "countrytiktok",
  "newcountry",
  "countrysong",
  "countryconcert",
  "countrylive",
  "acoustic",
  "countryartist",
];

// Hashtags to scrape for detailed info
const DEFAULT_HASHTAGS = [
  "countrymusic",
  "carlypearce",
  "nashville",
];

// Verify cron secret to prevent unauthorized access
// Vercel cron jobs send Authorization header when CRON_SECRET is set in env vars
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === "development") {
    console.log("[CRON] Development mode - skipping auth");
    return true;
  }

  // Check for Vercel's internal cron header (more reliable)
  // Vercel automatically adds this for cron jobs configured in vercel.json
  const isVercelCron = request.headers.get("x-vercel-cron") === "true" ||
                       request.headers.get("user-agent")?.includes("vercel-cron");

  if (isVercelCron) {
    console.log("[CRON] Vercel cron job detected via headers");
    return true;
  }

  // If no CRON_SECRET is set, log warning but allow for Vercel internal calls
  if (!cronSecret) {
    console.warn("[CRON] CRON_SECRET not configured - checking for Vercel origin");
    // Allow if request is from Vercel's internal network
    const vercelId = request.headers.get("x-vercel-id");
    if (vercelId) {
      console.log("[CRON] Allowing request with Vercel ID:", vercelId);
      return true;
    }
    return false;
  }

  // Standard Bearer token verification
  const isValid = authHeader === `Bearer ${cronSecret}`;
  if (!isValid) {
    console.warn("[CRON] Invalid auth header. Expected: Bearer <CRON_SECRET>");
  }
  return isValid;
}

// Interface for Modal response
interface ModalTrendItem {
  rank: number;
  keyword: string;
  hashtag?: string;
  viewCount?: number;
  videoCount?: number;
  description?: string;
  thumbnailUrl?: string;
  trendUrl?: string;
  source?: string;
}

interface ModalVideoItem {
  id: string;
  description: string;
  authorId: string;
  authorNickname: string;
  avatarUrl?: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  thumbnailUrl?: string;
  musicTitle?: string;
  hashtags: string[];
  createTime: number;
  hashtag?: string;
  videoUrl?: string;
  searchKeyword?: string;
}

interface ModalResponse {
  success: boolean;
  method: string;
  trends: ModalTrendItem[];
  videos: ModalVideoItem[];
  collectedAt: string;
  error?: string;
  stats?: {
    totalTrends: number;
    totalVideos: number;
    keywordsSearched: number;
    hashtagsScraped: number;
    errors: number;
  };
}

/**
 * Call Modal TikTok scraping function
 */
async function callModalScraper(
  keywords: string[],
  hashtags: string[],
  includeExplore: boolean
): Promise<ModalResponse | null> {
  try {
    console.log("[CRON-TRENDS] Calling Modal endpoint:", MODAL_TIKTOK_ENDPOINT);

    const response = await fetch(MODAL_TIKTOK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keywords,
        hashtags,
        includeExplore,
        secret: process.env.MODAL_API_SECRET || "",
        limitPerKeyword: 20,
      }),
    });

    if (!response.ok) {
      console.error("[CRON-TRENDS] Modal request failed:", response.status, response.statusText);
      return null;
    }

    const result: ModalResponse = await response.json();
    console.log("[CRON-TRENDS] Modal response:", {
      success: result.success,
      trends: result.trends?.length || 0,
      videos: result.videos?.length || 0,
      method: result.method,
    });

    return result;
  } catch (error) {
    console.error("[CRON-TRENDS] Modal call error:", error);
    return null;
  }
}

/**
 * Fallback to local Playwright scraping (use only if Modal fails)
 */
async function fallbackLocalScraping(keywords: string[]): Promise<{
  trends: TikTokTrendItem[];
  method: string;
  error?: string;
}> {
  console.log("[CRON-TRENDS] Using fallback local scraping...");

  try {
    // Use smaller keyword set for local scraping to avoid timeout
    const limitedKeywords = keywords.slice(0, 3);

    const result = await collectTikTokTrends({
      keywords: limitedKeywords,
      hashtags: [],
      includeExplore: true,
    });

    await closeBrowser();

    return {
      trends: result.trends,
      method: "local_fallback",
      error: result.error,
    };
  } catch (error) {
    try {
      await closeBrowser();
    } catch {}
    return {
      trends: [],
      method: "local_fallback",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(request: NextRequest) {
  console.log("[CRON-TRENDS] Cron job triggered at:", new Date().toISOString());

  // Verify cron secret
  if (!verifyCronSecret(request)) {
    console.error("[CRON-TRENDS] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[CRON-TRENDS] Starting collection for keywords:", DEFAULT_KEYWORDS);

    let collectedTrends: ModalTrendItem[] = [];
    let method = "unknown";
    let error: string | undefined;

    // Try Modal first (recommended for production)
    const useModal = process.env.USE_MODAL_TIKTOK !== "false";

    if (useModal) {
      const modalResult = await callModalScraper(
        DEFAULT_KEYWORDS,
        DEFAULT_HASHTAGS,
        true
      );

      if (modalResult && modalResult.success) {
        collectedTrends = modalResult.trends;
        method = modalResult.method;
        error = modalResult.error;
        console.log("[CRON-TRENDS] Modal scraping successful:", {
          trends: collectedTrends.length,
          stats: modalResult.stats,
        });
      } else {
        console.warn("[CRON-TRENDS] Modal scraping failed, trying fallback...");
      }
    }

    // Fallback to local scraping if Modal fails
    if (collectedTrends.length === 0) {
      console.log("[CRON-TRENDS] Using fallback local scraping");
      const fallbackResult = await fallbackLocalScraping(DEFAULT_KEYWORDS);
      collectedTrends = fallbackResult.trends;
      method = fallbackResult.method;
      error = fallbackResult.error;
    }

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
    const trendData = collectedTrends.map((trend) => ({
      platform: "TIKTOK" as TrendPlatform,
      keyword: trend.keyword,
      rank: trend.rank,
      region: "KR",
      viewCount: trend.viewCount ? BigInt(Math.floor(trend.viewCount)) : null,
      videoCount: trend.videoCount || null,
      description: trend.description || null,
      hashtags: trend.hashtag ? [trend.hashtag] : [],
      metadata: trend.source
        ? ({ source: trend.source } as Prisma.InputJsonValue)
        : Prisma.JsonNull,
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

    // Try to close browser on error (in case fallback was used)
    try {
      await closeBrowser();
    } catch {
      // Ignore close errors
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
