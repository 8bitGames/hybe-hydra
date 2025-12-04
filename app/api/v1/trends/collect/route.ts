import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform, Prisma } from "@prisma/client";
import {
  collectTikTokTrends,
  scrapeHashtagPage,
  searchTikTok,
  closeBrowser,
  TikTokTrendItem,
  HashtagVideo,
} from "@/lib/tiktok-trends";

// Modal TikTok Trends endpoint for production (unified endpoint)
const MODAL_TIKTOK_ENDPOINT = process.env.MODAL_TIKTOK_ENDPOINT ||
  "https://modawnai--hydra-compose-engine-collect-trends-endpoint.modal.run";

// Use Modal in production (Vercel), local Playwright in development
const USE_MODAL = process.env.VERCEL === "1" || process.env.USE_MODAL_TIKTOK === "true";

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
  trends: TikTokTrendItem[];
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
 * Call Modal TikTok scraping function (unified endpoint)
 */
async function callModalScraper(
  keywords: string[],
  hashtags: string[],
  includeExplore: boolean,
  limitPerKeyword: number = 40
): Promise<ModalResponse | null> {
  try {
    console.log("[TRENDS-COLLECT] Calling Modal endpoint:", MODAL_TIKTOK_ENDPOINT);

    // Determine action based on inputs
    let action = "collect";
    let requestBody: Record<string, unknown> = {
      action,
      keywords,
      hashtags,
      include_explore: includeExplore,
      secret: process.env.MODAL_API_SECRET || "",
      limit: limitPerKeyword,
    };

    // If only one keyword and no hashtags, use search action
    if (keywords.length === 1 && hashtags.length === 0 && !includeExplore) {
      action = "search";
      requestBody = {
        action,
        keyword: keywords[0],
        limit: limitPerKeyword,
        secret: process.env.MODAL_API_SECRET || "",
      };
    }
    // If only one hashtag and no keywords, use hashtag action
    else if (hashtags.length === 1 && keywords.length === 0 && !includeExplore) {
      action = "hashtag";
      requestBody = {
        action,
        hashtag: hashtags[0],
        secret: process.env.MODAL_API_SECRET || "",
      };
    }

    const response = await fetch(MODAL_TIKTOK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error("[TRENDS-COLLECT] Modal request failed:", response.status, response.statusText);
      return null;
    }

    const result: ModalResponse = await response.json();
    console.log("[TRENDS-COLLECT] Modal response:", {
      success: result.success,
      trends: result.trends?.length || 0,
      videos: result.videos?.length || 0,
      method: result.method,
    });

    return result;
  } catch (error) {
    console.error("[TRENDS-COLLECT] Modal call error:", error);
    return null;
  }
}

/**
 * Convert Modal video to HashtagVideo format
 */
function convertModalVideoToHashtagVideo(video: ModalVideoItem): HashtagVideo {
  return {
    id: video.id,
    description: video.description,
    author: {
      uniqueId: video.authorId,
      nickname: video.authorNickname,
      avatarUrl: video.avatarUrl,
    },
    stats: {
      playCount: video.playCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
    },
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    musicTitle: video.musicTitle,
    hashtags: video.hashtags,
    createTime: video.createTime,
  };
}

// POST /api/v1/trends/collect - Trigger trend collection (admin only)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      keywords = [],
      hashtags = [],
      includeExplore = true,
      region = "KR",
      platform = "TIKTOK",
    } = body as {
      keywords?: string[];
      hashtags?: string[];
      includeExplore?: boolean;
      region?: string;
      platform?: TrendPlatform;
    };

    console.log("[TRENDS-COLLECT] Starting collection with options:", {
      keywords,
      hashtags,
      includeExplore,
      region,
      platform,
    });

    // Collect trends based on platform
    let collectedTrends: TikTokTrendItem[] = [];
    let method = "unknown";
    let error: string | undefined;

    if (platform === "TIKTOK") {
      // Use Modal in production (Vercel), local Playwright in development
      if (USE_MODAL) {
        console.log("[TRENDS-COLLECT] Using Modal for collection");
        const result = await callModalScraper(
          keywords,
          hashtags,
          includeExplore,
          40 // limitPerKeyword
        );

        if (result) {
          // Convert Modal trends format to local format
          collectedTrends = result.trends.map((t) => ({
            rank: t.rank,
            keyword: t.keyword,
            hashtag: t.hashtag,
            viewCount: t.viewCount,
            videoCount: t.videoCount,
            description: t.description,
            thumbnailUrl: t.thumbnailUrl,
            trendUrl: t.trendUrl,
          }));
          method = result.method;
          error = result.error || undefined;
        } else {
          error = "Modal scraper failed - no response";
        }
      } else {
        console.log("[TRENDS-COLLECT] Using local Playwright for collection");
        const result = await collectTikTokTrends({
          keywords,
          hashtags,
          includeExplore,
        });

        collectedTrends = result.trends;
        method = result.method;
        error = result.error;

        // Close browser after collection
        await closeBrowser();
      }
    } else {
      return NextResponse.json(
        { detail: `Platform ${platform} collection not yet implemented` },
        { status: 400 }
      );
    }

    if (collectedTrends.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No trends collected",
        error,
        method,
      });
    }

    // Save to database
    const trendData = collectedTrends.map((trend) => ({
      platform: platform as TrendPlatform,
      keyword: trend.keyword,
      rank: trend.rank,
      region,
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

    console.log(`[TRENDS-COLLECT] Saved ${created.count} trends to database`);

    return NextResponse.json({
      success: true,
      message: "Trends collected and saved successfully",
      method,
      collected_count: collectedTrends.length,
      saved_count: created.count,
      trends: collectedTrends.slice(0, 10).map((t) => ({
        rank: t.rank,
        keyword: t.keyword,
        viewCount: t.viewCount,
        videoCount: t.videoCount,
      })),
    });
  } catch (err) {
    console.error("[TRENDS-COLLECT] Error:", err);

    // Ensure browser is closed on error
    try {
      await closeBrowser();
    } catch {
      // Ignore close errors
    }

    return NextResponse.json(
      {
        detail: "Trend collection failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/v1/trends/collect - Get details for a specific hashtag or search keyword
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const hashtag = searchParams.get("hashtag");
    const keyword = searchParams.get("keyword");
    const action = searchParams.get("action") || "hashtag";
    const limit = parseInt(searchParams.get("limit") || "40", 10);

    console.log("[TRENDS-COLLECT] GET request:", { action, hashtag, keyword, limit, USE_MODAL });

    // Use Modal in production for better performance and reliability
    if (USE_MODAL) {
      if (action === "search" && keyword) {
        // Search TikTok for a keyword using Modal
        const result = await callModalScraper(
          [keyword],  // keywords
          [],         // hashtags
          false,      // includeExplore
          limit
        );

        if (!result) {
          return NextResponse.json({
            success: false,
            keyword,
            videos: [],
            relatedHashtags: [],
            error: "Modal scraper failed",
          });
        }

        // Extract related hashtags from video hashtags
        const relatedHashtags = new Set<string>();
        result.videos.forEach(v => {
          v.hashtags.forEach(h => relatedHashtags.add(`#${h}`));
        });

        return NextResponse.json({
          success: result.success,
          keyword,
          videos: result.videos.map(convertModalVideoToHashtagVideo),
          relatedHashtags: Array.from(relatedHashtags),
          method: result.method,
          stats: result.stats,
        });
      }

      if (action === "hashtag" && hashtag) {
        // Get hashtag details using Modal
        const cleanHashtag = hashtag.replace(/^#/, "");
        const result = await callModalScraper(
          [],           // keywords
          [cleanHashtag], // hashtags
          false,        // includeExplore
          limit
        );

        if (!result) {
          return NextResponse.json({
            success: false,
            hashtag,
            info: null,
            videos: [],
            error: "Modal scraper failed",
          });
        }

        // Extract hashtag info from trends
        const trendInfo = result.trends.find(t =>
          t.keyword.toLowerCase() === cleanHashtag.toLowerCase()
        );

        return NextResponse.json({
          success: result.success,
          hashtag,
          info: trendInfo ? {
            id: cleanHashtag,
            title: trendInfo.keyword,
            description: trendInfo.description,
            viewCount: trendInfo.viewCount || 0,
            videoCount: trendInfo.videoCount || result.videos.length,
            thumbnailUrl: trendInfo.thumbnailUrl,
          } : null,
          videos: result.videos.map(convertModalVideoToHashtagVideo),
          method: result.method,
          stats: result.stats,
        });
      }

      return NextResponse.json(
        { detail: "Missing required parameter: hashtag or keyword" },
        { status: 400 }
      );
    }

    // Fallback to local Playwright (development mode)
    if (action === "search" && keyword) {
      // Search TikTok for a keyword - fetch up to 40 videos
      const result = await searchTikTok(keyword, limit);
      await closeBrowser();

      return NextResponse.json({
        success: result.success,
        keyword,
        videos: result.videos,
        relatedHashtags: result.relatedHashtags,
        error: result.error,
      });
    }

    if (action === "hashtag" && hashtag) {
      // Get hashtag details - videos already limited in scrapeHashtagPage
      const result = await scrapeHashtagPage(hashtag);
      await closeBrowser();

      return NextResponse.json({
        success: result.success,
        hashtag,
        info: result.info,
        videos: result.videos,
        error: result.error,
      });
    }

    return NextResponse.json(
      { detail: "Missing required parameter: hashtag or keyword" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[TRENDS-COLLECT] GET Error:", err);

    try {
      await closeBrowser();
    } catch {
      // Ignore close errors
    }

    return NextResponse.json(
      {
        detail: "Request failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
