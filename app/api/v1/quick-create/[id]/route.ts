import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a specific Quick Create generation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;

    // Find the generation
    const generation = await withRetry(() => prisma.videoGeneration.findUnique({
      where: { id: generationId },
    }));

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check ownership (Quick Create generations belong to the creator)
    if (generation.createdBy !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      id: generation.id,
      campaign_id: generation.campaignId,
      is_quick_create: generation.isQuickCreate,
      prompt: generation.prompt,
      negative_prompt: generation.negativePrompt,
      duration_seconds: generation.durationSeconds,
      aspect_ratio: generation.aspectRatio,
      reference_style: generation.referenceStyle,
      status: generation.status.toLowerCase(),
      progress: generation.progress,
      error_message: generation.errorMessage,
      output_url: generation.outputUrl,
      quality_score: generation.qualityScore,
      quality_metadata: generation.qualityMetadata,
      is_favorite: generation.isFavorite,
      tags: generation.tags,
      created_by: generation.createdBy,
      created_at: generation.createdAt.toISOString(),
      updated_at: generation.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Get quick create generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
