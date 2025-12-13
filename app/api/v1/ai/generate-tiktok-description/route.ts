/**
 * Generate TikTok Description API
 * ================================
 * Uses CopywriterAgent to generate TikTok-optimized descriptions
 * from video generation prompts
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
    }: {
      prompt: string;
      campaignName?: string;
      artistName?: string;
      language?: "ko" | "en";
      trendKeywords?: string[];
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

    // Build key messages from prompt and trend keywords
    const keyMessages = [prompt];
    if (trendKeywords.length > 0) {
      keyMessages.push(`Trending: ${trendKeywords.slice(0, 5).join(", ")}`);
    }

    // Execute copywriter agent
    const result = await copywriter.execute(
      {
        contentBrief: {
          topic: prompt,
          keyMessages,
          emotionalTone: "engaging and trendy",
          targetAction: "watch and engage",
        },
        platform: "tiktok",
        language,
        style: "casual",
        includeHashtags: true,
        maxLength: 150,
      },
      agentContext
    );

    if (!result.success || !result.data) {
      console.error("Copywriter agent failed:", result.error);
      return NextResponse.json(
        { detail: "Failed to generate description" },
        { status: 500 }
      );
    }

    const output = result.data;

    // Combine all hashtags
    const allHashtags = [
      ...(output.hashtags.primary || []),
      ...(output.hashtags.secondary || []),
      ...(output.hashtags.trending || []),
    ]
      .map((h) => h.replace(/^#/, ""))
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      description: output.primaryCaption.text,
      hashtags: allHashtags,
      hook: output.primaryCaption.hook,
      cta: output.primaryCaption.cta,
      alternatives: output.alternativeVersions.map((v) => v.text),
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
