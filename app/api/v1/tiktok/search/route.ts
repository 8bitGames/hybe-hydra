import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import {
  searchUsers,
  searchVideos,
  searchGeneral,
  searchByHashtag,
  getUserInfo,
  getUserPosts,
} from "@/lib/tiktok-mcp";

/**
 * GET /api/v1/tiktok/search
 *
 * Search TikTok for users, videos, or hashtags
 *
 * Query params:
 * - type: "user" | "video" | "hashtag" | "general" (required)
 * - q: search query (required)
 * - cursor: pagination cursor (optional)
 * - searchId: search ID for pagination (optional)
 * - limit: max results (optional, default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const query = searchParams.get("q");
    const cursor = searchParams.get("cursor") || "0";
    const searchId = searchParams.get("searchId") || "0";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    if (!type || !query) {
      return NextResponse.json(
        { detail: "Missing required parameters: type, q" },
        { status: 400 }
      );
    }

    console.log(`[TIKTOK-SEARCH] type=${type}, q=${query}, cursor=${cursor}`);

    switch (type) {
      case "user": {
        const result = await searchUsers(query, { cursor, searchId });
        return NextResponse.json({
          success: result.success,
          type: "user",
          query,
          users: result.data.slice(0, limit),
          hasMore: result.hasMore,
          cursor: result.cursor,
          searchId: result.searchId,
          error: result.error,
        });
      }

      case "video": {
        const result = await searchVideos(query, { cursor, searchId });
        return NextResponse.json({
          success: result.success,
          type: "video",
          query,
          videos: result.data.slice(0, limit),
          hasMore: result.hasMore,
          cursor: result.cursor,
          searchId: result.searchId,
          error: result.error,
        });
      }

      case "hashtag": {
        const result = await searchByHashtag(query, limit);
        return NextResponse.json({
          success: result.success,
          type: "hashtag",
          query,
          info: result.info,
          videos: result.videos,
          error: result.error,
        });
      }

      case "general": {
        const result = await searchGeneral(query, { cursor, searchId });
        return NextResponse.json({
          success: result.success,
          type: "general",
          query,
          videos: result.videos.slice(0, limit),
          users: result.users.slice(0, 10),
          hashtags: result.hashtags.slice(0, 10),
          hasMore: result.hasMore,
          cursor: result.cursor,
          error: result.error,
        });
      }

      default:
        return NextResponse.json(
          { detail: "Invalid type. Must be: user, video, hashtag, or general" },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[TIKTOK-SEARCH] Error:", err);
    return NextResponse.json(
      {
        detail: "Search failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tiktok/search
 *
 * Get detailed user info or user posts
 *
 * Body:
 * - action: "userInfo" | "userPosts"
 * - uniqueId: TikTok username (for userInfo)
 * - secUid: TikTok secUid (for userPosts)
 * - cursor: pagination cursor (for userPosts)
 * - count: number of posts (for userPosts)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { action, uniqueId, secUid, cursor = "0", count = 30 } = body;

    if (!action) {
      return NextResponse.json(
        { detail: "Missing required parameter: action" },
        { status: 400 }
      );
    }

    switch (action) {
      case "userInfo": {
        if (!uniqueId) {
          return NextResponse.json(
            { detail: "Missing required parameter: uniqueId" },
            { status: 400 }
          );
        }
        const userInfo = await getUserInfo(uniqueId);
        return NextResponse.json({
          success: !!userInfo,
          user: userInfo,
        });
      }

      case "userPosts": {
        if (!secUid) {
          return NextResponse.json(
            { detail: "Missing required parameter: secUid" },
            { status: 400 }
          );
        }
        const result = await getUserPosts(secUid, { count, cursor });
        return NextResponse.json({
          success: result.success,
          videos: result.data,
          hasMore: result.hasMore,
          cursor: result.cursor,
          error: result.error,
        });
      }

      default:
        return NextResponse.json(
          { detail: "Invalid action. Must be: userInfo or userPosts" },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[TIKTOK-SEARCH] POST Error:", err);
    return NextResponse.json(
      {
        detail: "Request failed",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
