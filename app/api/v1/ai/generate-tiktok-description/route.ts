/**
 * Generate TikTok Description API
 * ================================
 * Uses CopywriterAgent.writeTikTokDescription() to generate TikTok-optimized descriptions
 * from video generation prompts
 *
 * Supports two versions:
 * - short: 15 words or less impactful hook + 5-8 hashtags
 * - long: short hook + additional context + 8-12 SEO hashtags
 *
 * Prompts are managed in DB (agent_prompts table) via tiktok_short/tiktok_long templates
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { createCopywriterAgent } from "@/lib/agents/publishers/copywriter";
import type { AgentContext } from "@/lib/agents/types";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      campaignName,
      artistName,
      language = "ko",
      trendKeywords = [],
      version = "short",
    }: {
      prompt: string;
      campaignName?: string;
      artistName?: string;
      language?: "ko" | "en";
      trendKeywords?: string[];
      version?: "short" | "long";
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { detail: "prompt is required" },
        { status: 400 }
      );
    }

    // Create agent and context
    const copywriter = createCopywriterAgent();

    const agentContext: AgentContext = {
      workflow: {
        artistName: artistName || campaignName || "Creator",
        platform: "tiktok",
        language,
        sessionId: `tiktok-desc-${Date.now()}`,
      },
    };

    // Use specialized TikTok description method
    // Templates (tiktok_short, tiktok_long) are loaded from DB with code fallback
    const result = await copywriter.writeTikTokDescription(prompt, agentContext, {
      version,
      language,
      trendKeywords,
      keyMessages: [prompt],
    });

    if (!result.success || !result.data) {
      console.error("Copywriter agent failed:", result.error);
      return NextResponse.json(
        { detail: "Failed to generate description" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      version: result.data.version,
      description: result.data.description,
      hashtags: result.data.hashtags,
      hook: result.data.hook,
      cta: result.data.cta,
      alternatives: result.data.alternatives,
      seoKeywords: result.data.seoKeywords,
    });
  } catch (error) {
    console.error("Generate TikTok description error:", error);
    return NextResponse.json(
      {
        detail: "Failed to generate description",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
