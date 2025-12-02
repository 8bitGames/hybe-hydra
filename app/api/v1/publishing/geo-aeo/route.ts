import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import {
  generateGeoAeoContent,
  generateGeoAeoHashtags,
  GeoAeoInput,
  ContentLanguage,
  Platform,
  ContentVibe,
} from "@/lib/geo-aeo-generator";

/**
 * POST /api/v1/publishing/geo-aeo
 *
 * Generate GEO/AEO optimized caption and hashtags
 *
 * Body:
 * - keywords: string[] (required) - Main keywords for the content
 * - search_tags?: string[] - Additional search tags
 * - prompt?: string - Original content prompt
 * - artist_name?: string - Artist name for entity optimization
 * - group_name?: string - Group/band name
 * - campaign_name?: string - Campaign name
 * - vibe?: "Exciting" | "Emotional" | "Pop" | "Minimal"
 * - language?: "ko" | "en" | "ja"
 * - platform?: "tiktok" | "youtube" | "instagram"
 * - trend_keywords?: string[] - Current trending keywords
 * - hashtags_only?: boolean - Only generate hashtags (faster)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const keywords = body.keywords || body.search_tags || [];
    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        { detail: "keywords or search_tags are required" },
        { status: 400 }
      );
    }

    // Build input from request body
    const input: GeoAeoInput = {
      keywords,
      searchTags: body.search_tags,
      prompt: body.prompt,
      artistName: body.artist_name,
      groupName: body.group_name,
      campaignName: body.campaign_name,
      vibe: body.vibe as ContentVibe | undefined,
      language: (body.language || "ko") as ContentLanguage,
      platform: (body.platform || "tiktok") as Platform,
      trendKeywords: body.trend_keywords,
    };

    // Check if only hashtags are requested (faster)
    if (body.hashtags_only) {
      const hashtags = await generateGeoAeoHashtags(input);
      return NextResponse.json({
        hashtags,
        combined: [
          ...hashtags.primary,
          ...hashtags.entity,
          ...hashtags.niche,
          ...hashtags.trending,
          ...hashtags.longTail,
        ].slice(0, body.platform === "instagram" ? 30 : body.platform === "youtube" ? 15 : 5),
      });
    }

    // Generate full GEO/AEO content
    const result = await generateGeoAeoContent(input);

    return NextResponse.json({
      // Primary outputs for easy access
      caption: result.combinedCaption,
      hashtags: result.combinedHashtags,
      score: result.scores.overallScore,

      // Detailed GEO content
      geo: result.geo,

      // Detailed AEO content
      aeo: result.aeo,

      // Categorized hashtags
      hashtags_categorized: result.hashtags,

      // Structured data for SEO
      structured_data: result.structuredData,

      // Quality scores
      scores: result.scores,

      // Metadata
      metadata: result.metadata,
    });
  } catch (error) {
    console.error("[GEO/AEO] Generation error:", error);
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Failed to generate GEO/AEO content",
      },
      { status: 500 }
    );
  }
}
