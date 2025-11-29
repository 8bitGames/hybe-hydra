import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { generateVideo, VeoGenerationParams } from "@/lib/veo";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface StylePresetParams {
  promptModifier?: string;
  aspectRatio?: string;
  fps?: number;
  [key: string]: string | number | boolean | null | undefined | string[] | number[];
}

// Async video generation handler for batch items (runs in background)
function startBatchVideoGeneration(
  generationId: string,
  params: {
    prompt: string;
    negativePrompt?: string;
    durationSeconds: number;
    aspectRatio: string;
    style?: string;
  }
) {
  // Don't await - let it run in background
  (async () => {
    try {
      // Update status to processing
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "PROCESSING",
          progress: 10,
        },
      });

      // Call Veo API
      const veoParams: VeoGenerationParams = {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        durationSeconds: params.durationSeconds,
        aspectRatio: params.aspectRatio as "16:9" | "9:16" | "1:1",
        style: params.style,
      };

      // Update progress
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 50 },
      });

      const result = await generateVideo(veoParams);

      if (result.success && result.videoUrl) {
        // Success - update with video URL
        const existingGen = await prisma.videoGeneration.findUnique({
          where: { id: generationId },
        });
        const existingMetadata = (existingGen?.qualityMetadata as Record<string, unknown>) || {};

        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "COMPLETED",
            progress: 100,
            outputUrl: result.videoUrl,
            qualityScore: 75 + Math.floor(Math.random() * 20), // Will be replaced by AI scoring
            qualityMetadata: {
              ...existingMetadata,
              veoMetadata: result.metadata,
            },
          },
        });
      } else {
        // Failed
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: result.error || "Video generation failed",
          },
        });
      }
    } catch (error) {
      console.error("Batch video generation error:", error);
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "FAILED",
          progress: 100,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  })();
}

// POST /api/v1/campaigns/[id]/generations/batch - Create multiple generations with style presets
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Check campaign access
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: { select: { labelId: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const {
      base_prompt,
      negative_prompt,
      style_preset_ids,
      duration_seconds = 5,
      aspect_ratio = "16:9",
      reference_image_id,
      reference_style,
      audio_asset_id,  // Required: audio track for composition
    } = body;

    if (!base_prompt) {
      return NextResponse.json({ detail: "base_prompt is required" }, { status: 400 });
    }

    if (!audio_asset_id) {
      return NextResponse.json(
        { detail: "Audio asset is required. Please select a music track." },
        { status: 400 }
      );
    }

    // Validate audio asset
    const audioAsset = await prisma.asset.findUnique({
      where: { id: audio_asset_id },
    });

    if (!audioAsset || audioAsset.type !== "AUDIO") {
      return NextResponse.json(
        { detail: "Audio asset not found or invalid" },
        { status: 400 }
      );
    }

    if (!style_preset_ids || !Array.isArray(style_preset_ids) || style_preset_ids.length === 0) {
      return NextResponse.json(
        { detail: "style_preset_ids array is required with at least one preset" },
        { status: 400 }
      );
    }

    // Limit batch size
    const MAX_BATCH_SIZE = 10;
    if (style_preset_ids.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { detail: `Maximum ${MAX_BATCH_SIZE} presets allowed per batch` },
        { status: 400 }
      );
    }

    // Fetch all requested style presets
    const presets = await prisma.stylePreset.findMany({
      where: {
        id: { in: style_preset_ids },
        isActive: true,
      },
    });

    if (presets.length !== style_preset_ids.length) {
      const foundIds = presets.map((p) => p.id);
      const missingIds = style_preset_ids.filter((id: string) => !foundIds.includes(id));
      return NextResponse.json(
        { detail: `Style presets not found or inactive: ${missingIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate reference image if provided
    if (reference_image_id) {
      const refImage = await prisma.asset.findUnique({
        where: { id: reference_image_id },
      });

      if (!refImage || refImage.campaignId !== campaignId) {
        return NextResponse.json(
          { detail: "Reference image not found or not in this campaign" },
          { status: 400 }
        );
      }
    }

    // Create a batch ID to group these generations
    const batchId = uuidv4();

    // Create generations for each style preset
    const generationPromises = presets.map(async (preset) => {
      const presetParams = preset.parameters as StylePresetParams;
      const promptModifier = presetParams?.promptModifier || "";

      // Merge base prompt with style modifier
      const finalPrompt = promptModifier
        ? `${base_prompt}. Style: ${promptModifier}`
        : base_prompt;

      // Use preset's aspect ratio if available, otherwise use request's value
      const finalAspectRatio = presetParams?.aspectRatio || aspect_ratio;

      const generation = await prisma.videoGeneration.create({
        data: {
          campaignId,
          prompt: finalPrompt,
          negativePrompt: negative_prompt || null,
          durationSeconds: duration_seconds,
          aspectRatio: finalAspectRatio,
          referenceImageId: reference_image_id || null,
          referenceStyle: preset.name, // Store the style preset name
          audioAssetId: audio_asset_id,  // Required audio track
          status: "PENDING",
          progress: 0,
          createdBy: user.id,
          vertexRequestId: uuidv4(),
          qualityMetadata: {
            batchId,
            stylePresetId: preset.id,
            stylePresetName: preset.name,
            styleParameters: presetParams,
          },
        },
      });

      return {
        generation,
        preset,
      };
    });

    const results = await Promise.all(generationPromises);

    // Start async video generation for all items
    results.forEach(({ generation, preset }) => {
      // Run in background (don't await)
      startBatchVideoGeneration(generation.id, {
        prompt: generation.prompt,
        negativePrompt: generation.negativePrompt || undefined,
        durationSeconds: generation.durationSeconds,
        aspectRatio: generation.aspectRatio,
        style: preset.name,
      });
    });

    // Format response
    const generations = results.map(({ generation, preset }) => ({
      id: generation.id,
      campaign_id: generation.campaignId,
      prompt: generation.prompt,
      negative_prompt: generation.negativePrompt,
      duration_seconds: generation.durationSeconds,
      aspect_ratio: generation.aspectRatio,
      reference_image_id: generation.referenceImageId,
      reference_style: generation.referenceStyle,
      status: generation.status.toLowerCase(),
      progress: generation.progress,
      vertex_request_id: generation.vertexRequestId,
      created_by: generation.createdBy,
      created_at: generation.createdAt.toISOString(),
      style_preset: {
        id: preset.id,
        name: preset.name,
        name_ko: preset.nameKo,
        category: preset.category,
      },
    }));

    return NextResponse.json(
      {
        batch_id: batchId,
        total: generations.length,
        generations,
        message: `Batch generation started with ${generations.length} style variations`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Batch generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/campaigns/[id]/generations/batch?batch_id=xxx - Get all generations in a batch
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batch_id");

    if (!batchId) {
      return NextResponse.json({ detail: "batch_id query parameter is required" }, { status: 400 });
    }

    // Check campaign access
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: { select: { labelId: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Find all generations with this batch ID
    const generations = await prisma.videoGeneration.findMany({
      where: {
        campaignId,
        qualityMetadata: {
          path: ["batchId"],
          equals: batchId,
        },
      },
      include: {
        referenceImage: {
          select: { id: true, filename: true, s3Url: true },
        },
        outputAsset: {
          select: { id: true, filename: true, s3Url: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (generations.length === 0) {
      return NextResponse.json({ detail: "Batch not found" }, { status: 404 });
    }

    // Calculate batch status
    const statuses = generations.map((g) => g.status);
    let batchStatus = "processing";
    if (statuses.every((s) => s === "COMPLETED")) {
      batchStatus = "completed";
    } else if (statuses.some((s) => s === "FAILED")) {
      batchStatus = "partial_failure";
    } else if (statuses.every((s) => s === "PENDING")) {
      batchStatus = "pending";
    }

    const completedCount = statuses.filter((s) => s === "COMPLETED").length;
    const failedCount = statuses.filter((s) => s === "FAILED").length;
    const overallProgress = Math.round(
      generations.reduce((sum, g) => sum + g.progress, 0) / generations.length
    );

    const items = generations.map((gen) => {
      const metadata = gen.qualityMetadata as Record<string, unknown> | null;
      return {
        id: gen.id,
        campaign_id: gen.campaignId,
        prompt: gen.prompt,
        negative_prompt: gen.negativePrompt,
        duration_seconds: gen.durationSeconds,
        aspect_ratio: gen.aspectRatio,
        reference_image_id: gen.referenceImageId,
        reference_style: gen.referenceStyle,
        status: gen.status.toLowerCase(),
        progress: gen.progress,
        error_message: gen.errorMessage,
        output_url: gen.outputUrl,
        quality_score: gen.qualityScore,
        created_at: gen.createdAt.toISOString(),
        updated_at: gen.updatedAt.toISOString(),
        style_preset: metadata
          ? {
              id: metadata.stylePresetId,
              name: metadata.stylePresetName,
            }
          : null,
        reference_image: gen.referenceImage
          ? {
              id: gen.referenceImage.id,
              filename: gen.referenceImage.filename,
              s3_url: gen.referenceImage.s3Url,
            }
          : null,
        output_asset: gen.outputAsset
          ? {
              id: gen.outputAsset.id,
              filename: gen.outputAsset.filename,
              s3_url: gen.outputAsset.s3Url,
            }
          : null,
      };
    });

    return NextResponse.json({
      batch_id: batchId,
      batch_status: batchStatus,
      overall_progress: overallProgress,
      total: generations.length,
      completed: completedCount,
      failed: failedCount,
      generations: items,
    });
  } catch (error) {
    console.error("Get batch generations error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
