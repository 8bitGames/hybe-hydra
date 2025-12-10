import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import {
  getTrendingVideos,
  getTrendingHashtags,
  getTrendingSongs,
  getTrendingKeywords,
  getAllTrending,
} from "@/lib/tiktok-mcp";

/**
 * GET /api/v1/tiktok/trending
 *
 * Get trending TikTok content (videos, hashtags, songs, keywords)
 *
 * Query params:
 * - type: "video" | "hashtag" | "song" | "keyword" | "all" (default: "all")
 * - country: country code (default: "US")
 * - limit: max results per category (default: 20, max: 50)
 * - period: 7 | 30 | 120 days (default: 7)
 * - page: page number (default: 1)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const country = searchParams.get("country") || "US";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const period = parseInt(searchParams.get("period") || "7") as 7 | 30 | 120;
    const page = parseInt(searchParams.get("page") || "1");

    console.log(`[TIKTOK-TRENDING] type=${type}, country=${country}, period=${period}`);

    // Validate period
    if (![7, 30, 120].includes(period)) {
      return NextResponse.json(
        { detail: "Invalid period. Must be: 7, 30, or 120" },
        { status: 400 }
      );
    }

    switch (type) {
      case "video": {
        const result = await getTrendingVideos({
          country,
          limit,
          page,
          period: period as 7 | 30,
        });
        return NextResponse.json({
          success: result.success,
          type: "video",
          country: result.country,
          period: result.period,
          videos: result.data,
          total: result.data.length,
          error: result.error,
        });
      }

      case "hashtag": {
        const result = await getTrendingHashtags({
          country,
          limit,
          page,
          period,
        });
        return NextResponse.json({
          success: result.success,
          type: "hashtag",
          country: result.country,
          period: result.period,
          hashtags: result.data,
          total: result.data.length,
          error: result.error,
        });
      }

      case "song": {
        const result = await getTrendingSongs({
          country,
          limit,
          page,
          period,
        });
        return NextResponse.json({
          success: result.success,
          type: "song",
          country: result.country,
          period: result.period,
          songs: result.data,
          total: result.data.length,
          error: result.error,
        });
      }

      case "keyword": {
        const result = await getTrendingKeywords({
          country,
          limit,
          page,
          period,
        });
        return NextResponse.json({
          success: result.success,
          type: "keyword",
          country: result.country,
          period: result.period,
          keywords: result.data,
          total: result.data.length,
          error: result.error,
        });
      }

      case "all": {
        const result = await getAllTrending({
          country,
          limit,
          period: period as 7 | 30,
        });
        return NextResponse.json({
          success: result.success,
          type: "all",
          country,
          period,
          videos: result.videos,
          hashtags: result.hashtags,
          songs: result.songs,
          keywords: result.keywords,
          totals: {
            videos: result.videos.length,
            hashtags: result.hashtags.length,
            songs: result.songs.length,
            keywords: result.keywords.length,
          },
          errors: result.errors.length > 0 ? result.errors : undefined,
        });
      }

      default:
        return NextResponse.json(
          { detail: "Invalid type. Must be: video, hashtag, song, keyword, or all" },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[TIKTOK-TRENDING] Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to fetch trending content",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
