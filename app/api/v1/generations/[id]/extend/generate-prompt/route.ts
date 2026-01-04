import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { createExtensionPromptGeneratorAgent } from "@/lib/agents/transformers/extension-prompt-generator";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/generations/[id]/extend/generate-prompt
 *
 * Generate an enhanced extension prompt using AI.
 * Takes the user's simple idea and transforms it into a rich,
 * contextual prompt that connects smoothly with the original video.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Get the generation
    const generation = await withRetry(() => prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    }));

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { user_idea } = body as { user_idea?: string };

    if (!user_idea || user_idea.trim().length === 0) {
      return NextResponse.json(
        { detail: "user_idea is required" },
        { status: 400 }
      );
    }

    // Check if original prompt exists
    if (!generation.prompt) {
      return NextResponse.json(
        { detail: "Original video has no prompt - cannot generate extension prompt" },
        { status: 400 }
      );
    }

    // Use the Extension Prompt Generator Agent
    const agent = createExtensionPromptGeneratorAgent();

    const result = await agent.generateExtensionPrompt(
      generation.prompt,
      user_idea.trim(),
      {
        durationSeconds: generation.durationSeconds + 7, // Current duration + extension
        extensionNumber: (generation.extensionCount || 0) + 1,
        negativePrompt: generation.negativePrompt || undefined,
      }
    );

    return NextResponse.json({
      success: true,
      original_prompt: generation.prompt,
      user_idea: user_idea.trim(),
      generated: {
        enhanced_prompt: result.enhancedPrompt,
        continuity_notes: result.continuityNotes,
        visual_consistency: result.visualConsistency,
        cinematic_breakdown: result.cinematicBreakdown,
        audio_suggestions: result.audioSuggestions,
        warnings: result.warnings,
        safety_score: result.safetyScore,
      },
    });
  } catch (error) {
    console.error("Generate extension prompt error:", error);
    return NextResponse.json(
      { detail: "Failed to generate extension prompt" },
      { status: 500 }
    );
  }
}
