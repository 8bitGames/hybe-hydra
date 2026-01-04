import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { generateHashtags, Platform } from "@/lib/caption-generator";

// POST /api/v1/captions/hashtags - Generate SEO-optimized hashtags
export async function POST(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      topic,
      artist_name,
      group_name,
      trend_keywords = [],
      platform = "tiktok",
      count = 10,
    } = body;

    if (!topic) {
      return NextResponse.json(
        { detail: "Topic is required" },
        { status: 400 }
      );
    }

    const hashtags = await generateHashtags({
      topic,
      artistName: artist_name,
      groupName: group_name,
      trendKeywords: trend_keywords,
      platform: platform as Platform,
      count: Math.min(count, 30),
    });

    // Categorize hashtags
    const categorized = {
      artist: hashtags.filter((h) =>
        h.toLowerCase().includes(artist_name?.toLowerCase() || "") ||
        h.toLowerCase().includes(group_name?.toLowerCase() || "")
      ),
      trending: hashtags.filter((h) =>
        trend_keywords.some((k: string) => h.toLowerCase().includes(k.toLowerCase()))
      ),
      general: hashtags.filter((h) =>
        !h.toLowerCase().includes(artist_name?.toLowerCase() || "") &&
        !h.toLowerCase().includes(group_name?.toLowerCase() || "") &&
        !trend_keywords.some((k: string) => h.toLowerCase().includes(k.toLowerCase()))
      ),
    };

    return NextResponse.json({
      hashtags,
      categorized,
      count: hashtags.length,
      platform,
    });
  } catch (error) {
    console.error("Generate hashtags error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
