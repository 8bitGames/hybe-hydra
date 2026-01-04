import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  createGeoAeoOptimizerAgent,
  type GeoAeoInput,
} from "@/lib/agents/publishers";
import type { AgentContext } from "@/lib/agents/types";

/**
 * POST /api/v1/publishing/geo-aeo
 *
 * Generate GEO/AEO optimized caption and hashtags using Agent System
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
    
    const user = await getUserFromRequest(request);

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
      vibe: body.vibe,
      language: body.language || "ko",
      platform: body.platform || "tiktok",
      trendKeywords: body.trend_keywords,
    };

    // Build agent context
    const context: AgentContext = {
      workflow: {
        campaignId: body.campaign_id,
        artistName: body.artist_name || "Unknown Artist",
        language: body.language || "ko",
        platform: body.platform || "tiktok",
      },
    };

    // Create and execute agent
    const agent = createGeoAeoOptimizerAgent();
    const result = await agent.execute(input, context);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { detail: result.error || "Failed to generate GEO/AEO content" },
        { status: 500 }
      );
    }

    const { geo, aeo, hashtags, structuredData, scores } = result.data;

    // Platform config for combining hashtags
    const platformConfig: Record<string, { maxHashtags: number; maxCaption: number }> = {
      tiktok: { maxHashtags: 5, maxCaption: 2200 },
      youtube: { maxHashtags: 15, maxCaption: 5000 },
      instagram: { maxHashtags: 30, maxCaption: 2200 },
    };
    const platform = input.platform || "tiktok";
    const config = platformConfig[platform];

    // Combine all hashtags for easy use (respecting platform limits)
    const combinedHashtags = [
      ...hashtags.primary,
      ...hashtags.entity,
      ...hashtags.niche,
      ...hashtags.trending,
      ...hashtags.longTail,
    ].slice(0, config.maxHashtags);

    // Build combined caption with hook + main content + CTA
    const combinedCaption = `${geo.hookLine}\n\n${geo.caption}\n\n${geo.callToAction}`.slice(
      0,
      config.maxCaption
    );

    return NextResponse.json({
      // Primary outputs for easy access
      caption: combinedCaption,
      hashtags: combinedHashtags,
      score: scores.overallScore,

      // Detailed GEO content
      geo,

      // Detailed AEO content
      aeo,

      // Categorized hashtags
      hashtags_categorized: hashtags,

      // Structured data for SEO
      structured_data: structuredData,

      // Quality scores
      scores,

      // Metadata
      metadata: {
        language: input.language,
        platform: input.platform,
        generatedAt: new Date().toISOString(),
        inputKeywords: input.keywords,
        agentId: result.metadata.agentId,
        model: result.metadata.model,
        latencyMs: result.metadata.latencyMs,
        tokenUsage: result.metadata.tokenUsage,
      },
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
