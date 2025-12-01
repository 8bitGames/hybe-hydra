import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import {
  calculateScore,
  ScoringInput,
  ScoringResult,
  DEFAULT_WEIGHTS,
} from "@/lib/ai-scoring";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/generations/[id]/score - Calculate and store AI score for a generation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;

    // Get the generation with related data
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        campaign: {
          include: {
            artist: {
              select: {
                labelId: true,
                brandGuidelines: true,
              },
            },
          },
        },
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check access - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Get optional request body for custom weights or trend keywords
    let customWeights = DEFAULT_WEIGHTS;
    let trendKeywords: string[] = [];

    try {
      const body = await request.json();
      if (body.weights) {
        customWeights = { ...DEFAULT_WEIGHTS, ...body.weights };
      }
      if (body.trend_keywords) {
        trendKeywords = body.trend_keywords;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Extract style preset info from qualityMetadata if available
    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const stylePresetName = metadata?.stylePresetName as string | undefined;
    const styleParameters = metadata?.styleParameters as Record<string, unknown> | undefined;

    // Build scoring input
    const scoringInput: ScoringInput = {
      prompt: generation.prompt,
      negativePrompt: generation.negativePrompt || undefined,
      aspectRatio: generation.aspectRatio,
      durationSeconds: generation.durationSeconds,
      stylePresetName,
      styleParameters,
      artistBrandGuidelines: generation.campaign?.artist?.brandGuidelines || undefined,
      trendKeywords,
    };

    // Calculate score
    const scoringResult = calculateScore(scoringInput, customWeights);

    // Update generation with score
    // Convert to plain JSON objects to satisfy Prisma's InputJsonValue type
    const scoringData = JSON.parse(JSON.stringify({
      version: "1.0",
      calculatedAt: scoringResult.timestamp,
      weights: customWeights,
      breakdown: scoringResult.breakdown,
      grade: scoringResult.grade,
      recommendations: scoringResult.recommendations,
    }));

    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        qualityScore: scoringResult.totalScore,
        qualityMetadata: {
          ...metadata,
          scoring: scoringData,
        },
      },
    });

    return NextResponse.json({
      generation_id: generationId,
      total_score: scoringResult.totalScore,
      normalized_score: scoringResult.normalizedScore,
      grade: scoringResult.grade,
      breakdown: {
        prompt_quality: {
          score: scoringResult.breakdown.promptQuality.score,
          details: {
            length: scoringResult.breakdown.promptQuality.details.length,
            specificity: scoringResult.breakdown.promptQuality.details.specificity,
            structure: scoringResult.breakdown.promptQuality.details.structure,
          },
        },
        technical_settings: {
          score: scoringResult.breakdown.technicalSettings.score,
          details: {
            aspect_ratio: scoringResult.breakdown.technicalSettings.details.aspectRatio,
            duration: scoringResult.breakdown.technicalSettings.details.duration,
            fps: scoringResult.breakdown.technicalSettings.details.fps,
          },
        },
        style_alignment: {
          score: scoringResult.breakdown.styleAlignment.score,
          details: {
            style_preset_match: scoringResult.breakdown.styleAlignment.details.stylePresetMatch,
            brand_consistency: scoringResult.breakdown.styleAlignment.details.brandConsistency,
            visual_coherence: scoringResult.breakdown.styleAlignment.details.visualCoherence,
          },
        },
        trend_alignment: {
          score: scoringResult.breakdown.trendAlignment.score,
          details: {
            trend_keywords: scoringResult.breakdown.trendAlignment.details.trendKeywords,
            contemporary_style: scoringResult.breakdown.trendAlignment.details.contemporaryStyle,
            viral_potential: scoringResult.breakdown.trendAlignment.details.viralPotential,
          },
        },
      },
      recommendations: scoringResult.recommendations,
      calculated_at: scoringResult.timestamp,
    });
  } catch (error) {
    console.error("Score generation error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/v1/generations/[id]/score - Get stored score for a generation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;

    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      select: {
        id: true,
        qualityScore: true,
        qualityMetadata: true,
        createdBy: true,
        campaign: {
          select: {
            artist: {
              select: { labelId: true },
            },
          },
        },
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check access - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const scoring = metadata?.scoring as Record<string, unknown> | undefined;

    if (!scoring) {
      return NextResponse.json(
        { detail: "Score not calculated yet. POST to this endpoint to calculate." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      generation_id: generation.id,
      total_score: generation.qualityScore,
      grade: scoring.grade,
      breakdown: scoring.breakdown,
      recommendations: scoring.recommendations,
      calculated_at: scoring.calculatedAt,
    });
  } catch (error) {
    console.error("Get score error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
