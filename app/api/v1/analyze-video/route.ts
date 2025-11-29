/**
 * Video Analysis API
 * Analyzes TikTok videos to extract style and content for prompt generation
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeTikTokVideo, isValidTikTokUrl, TikTokAnalysisResult } from "@/lib/tiktok-analyzer";

export const maxDuration = 60; // Allow longer execution for video analysis

// POST /api/v1/analyze-video
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate TikTok URL
    if (!isValidTikTokUrl(url)) {
      return NextResponse.json(
        { error: "Invalid TikTok URL. Please provide a valid TikTok video URL." },
        { status: 400 }
      );
    }

    console.log("[API] Analyzing video:", url);

    // Analyze the video
    const result: TikTokAnalysisResult = await analyzeTikTokVideo(url);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to analyze video" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        metadata: result.metadata,
        style_analysis: result.style_analysis,
        content_analysis: result.content_analysis,
        suggested_prompt: result.suggested_prompt,
        prompt_elements: result.prompt_elements,
      },
    });
  } catch (error) {
    console.error("[API] Video analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
