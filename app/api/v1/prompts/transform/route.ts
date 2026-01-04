import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { transformPrompt, PromptTransformInput } from "@/lib/prompt-alchemist";

export async function POST(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      user_input,
      campaign_id,
      trend_keywords,
      safety_level = "high",
    } = body;

    if (!user_input) {
      return NextResponse.json(
        { detail: "user_input is required" },
        { status: 400 }
      );
    }

    // Get artist profile if campaign_id is provided
    let artistProfile = undefined;

    if (campaign_id) {
      const campaign = await withRetry(() => prisma.campaign.findUnique({
        where: { id: campaign_id },
        include: {
          artist: {
            select: {
              name: true,
              stageName: true,
              groupName: true,
              profileDescription: true,
              brandGuidelines: true,
              label: {
                select: { id: true },
              },
            },
          },
        },
      }));

      if (!campaign) {
        return NextResponse.json(
          { detail: "Campaign not found" },
          { status: 404 }
        );
      }

      // RBAC check
      if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.label.id)) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }

      artistProfile = {
        name: campaign.artist.name,
        stageName: campaign.artist.stageName || undefined,
        groupName: campaign.artist.groupName || undefined,
        profileDescription: campaign.artist.profileDescription || undefined,
        brandGuidelines: campaign.artist.brandGuidelines || undefined,
      };
    }

    // Transform prompt using Prompt Alchemist
    const input: PromptTransformInput = {
      userInput: user_input,
      artistProfile,
      trendKeywords: trend_keywords,
      safetyLevel: safety_level,
    };

    const result = await transformPrompt(input);

    // Return formatted response
    return NextResponse.json({
      status: result.status,
      analysis: {
        intent: result.analysis.intent,
        trend_applied: result.analysis.trendApplied,
        safety_check: {
          passed: result.analysis.safetyCheck.passed,
          concerns: result.analysis.safetyCheck.concerns,
        },
      },
      veo_prompt: result.veoPrompt,
      negative_prompt: result.negativePrompt,
      technical_settings: {
        aspect_ratio: result.technicalSettings.aspectRatio,
        fps: result.technicalSettings.fps,
        duration_seconds: result.technicalSettings.durationSeconds,
        guidance_scale: result.technicalSettings.guidanceScale,
      },
      blocked_reason: result.blockedReason,
      // Celebrity name warnings
      celebrity_warning: result.celebrityWarning,
      detected_celebrities: result.detectedCelebrities,
    });
  } catch (error) {
    console.error("Prompt transform error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
