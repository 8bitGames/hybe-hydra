import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import {
  calculateScore,
  ScoringInput,
  DEFAULT_WEIGHTS,
  ScoringWeights,
} from "@/lib/ai-scoring";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/campaigns/[id]/generations/score-all - Score all generations in a campaign
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Get campaign with artist for brand guidelines
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: {
          select: {
            labelId: true,
            brandGuidelines: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    // Check access
    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Get optional parameters from body
    let customWeights: ScoringWeights = DEFAULT_WEIGHTS;
    let trendKeywords: string[] = [];
    let onlyUnscored = true;

    try {
      const body = await request.json();
      if (body.weights) {
        customWeights = { ...DEFAULT_WEIGHTS, ...body.weights };
      }
      if (body.trend_keywords) {
        trendKeywords = body.trend_keywords;
      }
      if (typeof body.only_unscored === "boolean") {
        onlyUnscored = body.only_unscored;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Get generations to score (exclude soft-deleted)
    const whereClause: Record<string, unknown> = {
      campaignId,
      status: "COMPLETED",
      deletedAt: null,
    };

    if (onlyUnscored) {
      whereClause.qualityScore = null;
    }

    const generations = await prisma.videoGeneration.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    if (generations.length === 0) {
      return NextResponse.json({
        message: onlyUnscored
          ? "No unscored completed generations found"
          : "No completed generations found",
        scored: 0,
        results: [],
      });
    }

    // Score each generation
    const results = await Promise.all(
      generations.map(async (generation) => {
        const metadata = generation.qualityMetadata as Record<string, unknown> | null;
        const stylePresetName = metadata?.stylePresetName as string | undefined;
        const styleParameters = metadata?.styleParameters as Record<string, unknown> | undefined;

        const scoringInput: ScoringInput = {
          prompt: generation.prompt,
          negativePrompt: generation.negativePrompt || undefined,
          aspectRatio: generation.aspectRatio,
          durationSeconds: generation.durationSeconds,
          stylePresetName,
          styleParameters,
          artistBrandGuidelines: campaign.artist.brandGuidelines || undefined,
          trendKeywords,
        };

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
          where: { id: generation.id },
          data: {
            qualityScore: scoringResult.totalScore,
            qualityMetadata: {
              ...metadata,
              scoring: scoringData,
            },
          },
        });

        return {
          generation_id: generation.id,
          total_score: scoringResult.totalScore,
          grade: scoringResult.grade,
          style_preset: stylePresetName || null,
        };
      })
    );

    // Sort by score descending
    results.sort((a, b) => b.total_score - a.total_score);

    // Calculate statistics
    const scores = results.map((r) => r.total_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    const gradeDistribution = results.reduce(
      (acc, r) => {
        acc[r.grade] = (acc[r.grade] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      campaign_id: campaignId,
      scored: results.length,
      statistics: {
        average_score: Math.round(avgScore * 10) / 10,
        max_score: maxScore,
        min_score: minScore,
        grade_distribution: gradeDistribution,
      },
      results,
    });
  } catch (error) {
    console.error("Score all generations error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
