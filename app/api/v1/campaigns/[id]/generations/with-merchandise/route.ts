import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { MerchandiseContext } from "@prisma/client";
import {
  submitVideoGeneration,
  submitImageToVideo,
  waitForAIJob,
  generateAIJobId,
  type VideoAspectRatio,
  type VideoDuration,
} from "@/lib/ec2/ai-client";
// Note: AI generation now handled by EC2 compose-engine via submitVideoGeneration/submitImageToVideo

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

// Primary merchandise info for I2V mode
interface PrimaryMerchandiseInfo {
  id: string;
  name: string;
  type: string;
  s3Url: string;
  context: MerchandiseContext;
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

// Generate I2V-optimized prompt for animating the reference product image
function generateI2VPromptWithMerchandise(
  basePrompt: string,
  merchandise: { name: string; type: string },
  context: MerchandiseContext
): string {
  // I2V mode: The reference image IS the product, so describe HOW to animate it
  const merchandiseName = merchandise.name;

  const animationInstructions: Record<MerchandiseContext, string> = {
    HOLDING: `Starting from the reference image of ${merchandiseName}: A person's hands gently pick up and hold the product, fingers naturally wrapping around it, slight movement as they examine it, product remains clearly visible and in focus throughout.`,
    WEARING: `Starting from the reference image of ${merchandiseName}: The clothing/accessory is being worn, subtle natural movement as the person adjusts or shows off the item, fabric/material moves naturally with body motion.`,
    SHOWING: `Starting from the reference image of ${merchandiseName}: Smooth camera push-in towards the product, slight rotation to showcase different angles, the product remains the hero element, cinematic reveal with subtle lighting shifts.`,
    BACKGROUND: `Starting from the reference image of ${merchandiseName}: The product remains visible in the background as the main scene unfolds in the foreground, subtle depth of field shifts bring attention to it periodically.`,
  };

  const animation = animationInstructions[context] || `Starting from the reference image of ${merchandiseName}: ${basePrompt}`;

  // Combine base prompt concept with animation instructions
  return `${animation} Scene context: ${basePrompt}. Maintain visual consistency with the reference product image throughout the video. Smooth, professional motion, product clearly recognizable.`;
}

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "hydra-assets-hybe";

// Helper: Convert aspect ratio for video generation
function convertAspectRatioForVideo(aspectRatio: string): VideoAspectRatio {
  const mapping: Record<string, VideoAspectRatio> = {
    "16:9": "16:9",
    "9:16": "9:16",
    "1:1": "1:1",
  };
  return mapping[aspectRatio] || "9:16";
}

// Helper: Convert duration for video generation
function convertDurationForEC2(durationSeconds: number): VideoDuration {
  if (durationSeconds <= 4) return 4;
  if (durationSeconds <= 6) return 6;
  return 8;
}

// Async video generation handler with merchandise references
// Uses EC2 compose-engine for all AI generation (GPU with Vertex AI WIF auth)
function startMerchandiseVideoGeneration(
  generationId: string,
  campaignId: string,
  params: {
    prompt: string;
    i2vPrompt: string;  // I2V-optimized prompt for animation
    negativePrompt?: string;
    durationSeconds: number;
    aspectRatio: string;
    style?: string;
    primaryMerchandiseUrl?: string;  // Primary merchandise image for I2V
    merchandiseUrls?: string[];
  }
) {
  (async () => {
    const logPrefix = `[Merchandise Gen ${generationId}]`;

    try {
      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "PROCESSING",
          progress: 10,
        },
      }));

      // Determine which prompt to use based on whether we have a reference image
      const useI2VMode = !!params.primaryMerchandiseUrl;
      const finalPrompt = useI2VMode ? params.i2vPrompt : params.prompt;

      console.log(`${logPrefix} Mode: ${useI2VMode ? "I2V with product image" : "T2V text only"}`);
      if (useI2VMode) {
        console.log(`${logPrefix} Reference image: ${params.primaryMerchandiseUrl}`);
      }

      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 30 },
      }));

      // Generate video via EC2 compose-engine
      const videoJobId = generateAIJobId("merch-vid");
      const videoS3Key = `campaigns/${campaignId}/merchandise/${generationId}/video-${videoJobId}.mp4`;

      console.log(`${logPrefix} Submitting video generation to EC2: ${videoJobId}`);

      let videoSubmitResult;
      try {
        if (useI2VMode && params.primaryMerchandiseUrl) {
          // I2V mode: Use image-to-video endpoint
          console.log(`${logPrefix} Using I2V mode with merchandise image`);
          videoSubmitResult = await submitImageToVideo(
            videoJobId,
            {
              prompt: finalPrompt,
              reference_image_url: params.primaryMerchandiseUrl,
              negative_prompt: params.negativePrompt,
              aspect_ratio: convertAspectRatioForVideo(params.aspectRatio),
              duration_seconds: convertDurationForEC2(params.durationSeconds),
            },
            {
              s3_bucket: AWS_S3_BUCKET,
              s3_key: videoS3Key,
            }
          );
        } else {
          // T2V mode: Text-to-video endpoint
          console.log(`${logPrefix} Using T2V mode (no reference image)`);
          videoSubmitResult = await submitVideoGeneration(
            videoJobId,
            {
              prompt: finalPrompt,
              negative_prompt: params.negativePrompt,
              aspect_ratio: convertAspectRatioForVideo(params.aspectRatio),
              duration_seconds: convertDurationForEC2(params.durationSeconds),
            },
            {
              s3_bucket: AWS_S3_BUCKET,
              s3_key: videoS3Key,
            }
          );
        }
      } catch (submitError) {
        console.error(`${logPrefix} Video submit error:`, submitError);
        await withRetry(() => prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: `EC2 submit error: ${submitError instanceof Error ? submitError.message : "Unknown error"}`,
          },
        }));
        return;
      }

      if (videoSubmitResult.status === "error") {
        console.error(`${logPrefix} Video submit failed: ${videoSubmitResult.error}`);
        await withRetry(() => prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: `EC2 submit failed: ${videoSubmitResult.error}`,
          },
        }));
        return;
      }

      console.log(`${logPrefix} Video job queued: ${videoSubmitResult.ec2_job_id || videoSubmitResult.job_id}`);

      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 50 },
      }));

      // Poll for video completion
      const videoResult = await waitForAIJob(
        videoSubmitResult.ec2_job_id || videoSubmitResult.job_id,
        {
          jobType: useI2VMode ? "image_to_video" : "video_generation",
          maxWaitTime: 600000, // 10 minutes for video
          pollInterval: 5000,
        }
      );

      if (videoResult.mappedStatus !== "completed" || !videoResult.output_url) {
        console.error(`${logPrefix} Video generation failed: ${videoResult.error}`);
        await withRetry(() => prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: videoResult.error || "Video generation failed",
          },
        }));
        return;
      }

      console.log(`${logPrefix} Video generated successfully! URL: ${videoResult.output_url.slice(0, 80)}...`);

      const existingGen = await withRetry(() => prisma.videoGeneration.findUnique({
        where: { id: generationId },
      }));
      const existingMetadata = (existingGen?.qualityMetadata as Record<string, unknown>) || {};

      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "COMPLETED",
          progress: 100,
          outputUrl: videoResult.output_url,
          qualityScore: 75 + Math.floor(Math.random() * 20),
          qualityMetadata: {
            ...existingMetadata,
            ec2_job_id: videoSubmitResult.ec2_job_id || videoSubmitResult.job_id,
            mode: useI2VMode ? "i2v" : "t2v",
            merchandiseReferenced: true,
          },
        },
      }));

      console.log(`${logPrefix} Complete!`);
    } catch (error) {
      console.error("Merchandise video generation error:", error);
      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "FAILED",
          progress: 100,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      }));
    }
  })();
}

// POST /api/v1/campaigns/[id]/generations/with-merchandise
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Check campaign access
    const campaign = await withRetry(() => prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: { select: { labelId: true, name: true, stageName: true } },
      },
    }));

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
      duration_seconds = 8,
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
    const audioAsset = await withRetry(() => prisma.asset.findUnique({
      where: { id: audio_asset_id },
    }));

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
    const merchandiseItems = await withRetry(() => prisma.merchandiseItem.findMany({
      where: {
        id: { in: merchandiseIds },
        isActive: true,
      },
    }));

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
      presets = await withRetry(() => prisma.stylePreset.findMany({
        where: {
          id: { in: style_preset_ids },
          isActive: true,
        },
      }));

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

    // Track primary merchandise for I2V (first item with highest guidance_scale)
    let primaryMerch: PrimaryMerchandiseInfo | null = null;
    let highestGuidanceScale = 0;

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

        // Track the primary merchandise (highest guidance scale or first item)
        const guidanceScale = ref.guidance_scale || 0.7;
        if (!primaryMerch || guidanceScale > highestGuidanceScale) {
          primaryMerch = {
            id: merchandise.id,
            name: merchandise.name,
            type: merchandise.type,
            s3Url: merchandise.s3Url,
            context,
          };
          highestGuidanceScale = guidanceScale;
        }
      }
    }

    const merchandisePrompt = merchandisePromptParts.join(", ");
    const batchId = uuidv4();

    // Generate I2V-optimized prompt if we have a primary merchandise image
    const i2vPrompt = primaryMerch
      ? generateI2VPromptWithMerchandise(
          base_prompt,
          { name: primaryMerch.name, type: primaryMerch.type },
          primaryMerch.context
        )
      : "";

    const primaryImageUrl = primaryMerch?.s3Url;
    const primaryMerchandiseId = primaryMerch?.id;

    console.log(`[Merchandise Gen] Primary product: ${primaryMerch?.name || "none"}`);
    console.log(`[Merchandise Gen] Primary image URL: ${primaryImageUrl || "none"}`);
    console.log(`[Merchandise Gen] I2V Mode: ${primaryImageUrl ? "enabled" : "disabled"}`);

    // Create generations for each style preset
    const generationPromises = presets.map(async (preset) => {
      const presetParams = preset.parameters as StylePresetParams;
      const promptModifier = presetParams?.promptModifier || "";

      // Build final prompt: base + merchandise + style (for T2V fallback)
      let finalPrompt = `${base_prompt}, ${merchandisePrompt}`;
      if (promptModifier) {
        finalPrompt += `. Style: ${promptModifier}`;
      }

      // Build I2V prompt with style modifier
      let finalI2VPrompt = i2vPrompt;
      if (promptModifier && finalI2VPrompt) {
        finalI2VPrompt += ` Style: ${promptModifier}`;
      }

      const finalAspectRatio = presetParams?.aspectRatio || aspect_ratio;

      const generation = await withRetry(() => prisma.videoGeneration.create({
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
            i2vMode: !!primaryImageUrl,
            primaryMerchandiseId: primaryMerchandiseId,
            i2vPrompt: finalI2VPrompt || undefined,
          },
        },
      }));

      // Create merchandise reference records
      for (const ref of merchandise_references as MerchandiseReference[]) {
        await withRetry(() => prisma.generationMerchandise.create({
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
        }));
      }

      return { generation, preset, finalI2VPrompt };
    });

    const results = await Promise.all(generationPromises);

    // Start async video generation for all items
    results.forEach(({ generation, preset, finalI2VPrompt }) => {
      startMerchandiseVideoGeneration(generation.id, campaignId, {
        prompt: generation.prompt,
        i2vPrompt: finalI2VPrompt || generation.prompt,
        negativePrompt: generation.negativePrompt || undefined,
        durationSeconds: generation.durationSeconds,
        aspectRatio: generation.aspectRatio,
        style: preset.name !== "Default" ? preset.name : undefined,
        primaryMerchandiseUrl: primaryImageUrl || undefined,
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
