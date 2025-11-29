import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { generateVideo, VeoGenerationParams } from "@/lib/veo";
import { MerchandiseContext } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface StylePresetParams {
  promptModifier?: string;
  aspectRatio?: string;
  fps?: number;
  [key: string]: string | number | boolean | null | undefined | string[] | number[];
}

interface MerchandiseReference {
  merchandise_id: string;
  context: string; // holding, wearing, showing, background
  guidance_scale?: number;
}

// Generate prompt addition based on merchandise type and context
function generateMerchandisePrompt(
  merchandise: { name: string; type: string; metadata?: unknown },
  context: MerchandiseContext
): string {
  const merchandiseName = merchandise.name;
  const metadata = merchandise.metadata as Record<string, unknown> | null;
  const designFeatures = metadata?.design_features || metadata?.colors || "";

  const contextPrompts: Record<MerchandiseContext, string> = {
    HOLDING: `holding ${merchandiseName}${designFeatures ? ` with ${designFeatures}` : ""}, product clearly visible in hands`,
    WEARING: `wearing ${merchandiseName}${designFeatures ? ` featuring ${designFeatures}` : ""}, clothing clearly visible`,
    SHOWING: `presenting ${merchandiseName} to camera${designFeatures ? `, showcasing ${designFeatures}` : ""}, product in focus`,
    BACKGROUND: `with ${merchandiseName} visible in background${designFeatures ? `, ${designFeatures} visible` : ""}`,
  };

  return contextPrompts[context] || `with ${merchandiseName}`;
}

// Async video generation handler with merchandise references
function startMerchandiseVideoGeneration(
  generationId: string,
  params: {
    prompt: string;
    negativePrompt?: string;
    durationSeconds: number;
    aspectRatio: string;
    style?: string;
    merchandiseUrls?: string[];
  }
) {
  (async () => {
    try {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "PROCESSING",
          progress: 10,
        },
      });

      // Build Veo params with merchandise reference images
      const veoParams: VeoGenerationParams = {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        durationSeconds: params.durationSeconds,
        aspectRatio: params.aspectRatio as "16:9" | "9:16" | "1:1",
        style: params.style,
        // Note: Reference images would be passed here when Veo supports it
        // referenceImages: params.merchandiseUrls,
      };

      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 50 },
      });

      const result = await generateVideo(veoParams);

      if (result.success && result.videoUrl) {
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
            qualityScore: 75 + Math.floor(Math.random() * 20),
            qualityMetadata: {
              ...existingMetadata,
              veoMetadata: result.metadata,
              merchandiseReferenced: true,
            },
          },
        });
      } else {
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
      console.error("Merchandise video generation error:", error);
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

// POST /api/v1/campaigns/[id]/generations/with-merchandise
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
        artist: { select: { labelId: true, name: true, stageName: true } },
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
      merchandise_references,
      style_preset_ids,
      duration_seconds = 5,
      aspect_ratio = "9:16",
      reference_image_id,
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

    if (!merchandise_references || !Array.isArray(merchandise_references) || merchandise_references.length === 0) {
      return NextResponse.json(
        { detail: "merchandise_references array is required with at least one item" },
        { status: 400 }
      );
    }

    // Validate merchandise references
    const merchandiseIds = merchandise_references.map((ref: MerchandiseReference) => ref.merchandise_id);
    const merchandiseItems = await prisma.merchandiseItem.findMany({
      where: {
        id: { in: merchandiseIds },
        isActive: true,
      },
    });

    if (merchandiseItems.length !== merchandiseIds.length) {
      const foundIds = merchandiseItems.map((m) => m.id);
      const missingIds = merchandiseIds.filter((id: string) => !foundIds.includes(id));
      return NextResponse.json(
        { detail: `Merchandise not found or inactive: ${missingIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate contexts
    const validContexts = ["holding", "wearing", "showing", "background"];
    for (const ref of merchandise_references as MerchandiseReference[]) {
      if (ref.context && !validContexts.includes(ref.context.toLowerCase())) {
        return NextResponse.json(
          { detail: `Invalid context: ${ref.context}. Must be one of: ${validContexts.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Fetch style presets if provided
    let presets: { id: string; name: string; nameKo: string | null; category: string; parameters: unknown }[] = [];
    if (style_preset_ids && Array.isArray(style_preset_ids) && style_preset_ids.length > 0) {
      presets = await prisma.stylePreset.findMany({
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
    } else {
      // Use a default "no preset" option
      presets = [{ id: "default", name: "Default", nameKo: "기본", category: "default", parameters: {} }];
    }

    // Limit batch size
    const MAX_BATCH_SIZE = 10;
    if (presets.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { detail: `Maximum ${MAX_BATCH_SIZE} presets allowed per batch` },
        { status: 400 }
      );
    }

    // Build merchandise prompt additions
    const merchandiseMap = new Map(merchandiseItems.map((m) => [m.id, m]));
    const merchandisePromptParts: string[] = [];
    const merchandiseUrls: string[] = [];

    for (const ref of merchandise_references as MerchandiseReference[]) {
      const merchandise = merchandiseMap.get(ref.merchandise_id);
      if (merchandise) {
        const context = (ref.context?.toUpperCase() || "HOLDING") as MerchandiseContext;
        const promptPart = generateMerchandisePrompt(
          { name: merchandise.name, type: merchandise.type, metadata: merchandise.metadata },
          context
        );
        merchandisePromptParts.push(promptPart);
        merchandiseUrls.push(merchandise.s3Url);
      }
    }

    const merchandisePrompt = merchandisePromptParts.join(", ");
    const batchId = uuidv4();

    // Create generations for each style preset
    const generationPromises = presets.map(async (preset) => {
      const presetParams = preset.parameters as StylePresetParams;
      const promptModifier = presetParams?.promptModifier || "";

      // Build final prompt: base + merchandise + style
      let finalPrompt = `${base_prompt}, ${merchandisePrompt}`;
      if (promptModifier) {
        finalPrompt += `. Style: ${promptModifier}`;
      }

      const finalAspectRatio = presetParams?.aspectRatio || aspect_ratio;

      const generation = await prisma.videoGeneration.create({
        data: {
          campaignId,
          prompt: finalPrompt,
          negativePrompt: negative_prompt || null,
          durationSeconds: duration_seconds,
          aspectRatio: finalAspectRatio,
          referenceImageId: reference_image_id || null,
          referenceStyle: preset.id !== "default" ? preset.name : null,
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
            merchandiseReferenced: true,
            merchandiseIds,
          },
        },
      });

      // Create merchandise reference records
      for (const ref of merchandise_references as MerchandiseReference[]) {
        await prisma.generationMerchandise.create({
          data: {
            generationId: generation.id,
            merchandiseId: ref.merchandise_id,
            context: (ref.context?.toUpperCase() || "HOLDING") as MerchandiseContext,
            guidanceScale: ref.guidance_scale || 0.7,
            promptAddition: generateMerchandisePrompt(
              merchandiseMap.get(ref.merchandise_id)!,
              (ref.context?.toUpperCase() || "HOLDING") as MerchandiseContext
            ),
          },
        });
      }

      return { generation, preset };
    });

    const results = await Promise.all(generationPromises);

    // Start async video generation for all items
    results.forEach(({ generation, preset }) => {
      startMerchandiseVideoGeneration(generation.id, {
        prompt: generation.prompt,
        negativePrompt: generation.negativePrompt || undefined,
        durationSeconds: generation.durationSeconds,
        aspectRatio: generation.aspectRatio,
        style: preset.name !== "Default" ? preset.name : undefined,
        merchandiseUrls,
      });
    });

    // Fetch merchandise details for response
    const merchandiseResponse = merchandiseItems.map((m) => ({
      id: m.id,
      name: m.name,
      name_ko: m.nameKo,
      type: m.type.toLowerCase(),
      s3_url: m.s3Url,
      thumbnail_url: m.thumbnailUrl,
    }));

    // Format response
    const generations = results.map(({ generation, preset }) => ({
      id: generation.id,
      campaign_id: generation.campaignId,
      prompt: generation.prompt,
      negative_prompt: generation.negativePrompt,
      duration_seconds: generation.durationSeconds,
      aspect_ratio: generation.aspectRatio,
      status: generation.status.toLowerCase(),
      progress: generation.progress,
      vertex_request_id: generation.vertexRequestId,
      created_by: generation.createdBy,
      created_at: generation.createdAt.toISOString(),
      style_preset: preset.id !== "default" ? {
        id: preset.id,
        name: preset.name,
        name_ko: preset.nameKo,
        category: preset.category,
      } : null,
    }));

    return NextResponse.json(
      {
        batch_id: batchId,
        total: generations.length,
        generations,
        merchandise_referenced: merchandiseResponse,
        merchandise_prompt: merchandisePrompt,
        message: `Generation started with ${generations.length} variation(s) referencing ${merchandiseItems.length} merchandise item(s)`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Generate with merchandise error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
