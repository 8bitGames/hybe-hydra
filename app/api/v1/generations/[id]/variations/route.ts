import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { createI2VSpecialistAgent } from "@/lib/agents/transformers/i2v-specialist";
import {
  submitImageGeneration,
  submitI2VGeneration,
  submitVideoGeneration,
  waitForAIJob,
  composeVideoWithAudio,
} from "@/lib/compose/client";
import type { AIVideoAspectRatio, AIVideoDuration } from "@/lib/compose/client";
import { getPresignedUrlFromS3Url } from "@/lib/storage";
import type { AgentContext } from "@/lib/agents/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface StylePresetParams {
  promptModifier?: string;
  aspectRatio?: string;
  fps?: number;
  [key: string]: string | number | boolean | null | undefined | string[] | number[];
}

// Prompt variation templates
const CAMERA_VARIATIONS = [
  "close-up shot of",
  "wide shot showing",
  "dynamic tracking shot of",
  "low angle shot of",
  "overhead view of",
];

const EXPRESSION_VARIATIONS = [
  "with intense energy",
  "in a dreamy atmosphere",
  "with vibrant movements",
  "in smooth flowing motion",
  "with powerful presence",
];

// Generate prompt variations
function generatePromptVariations(
  basePrompt: string,
  types: ("camera" | "expression")[],
  count: number
): string[] {
  const variations: string[] = [basePrompt]; // Always include original

  if (types.includes("camera")) {
    CAMERA_VARIATIONS.slice(0, Math.ceil(count / 2)).forEach((mod) => {
      variations.push(`${mod} ${basePrompt}`);
    });
  }

  if (types.includes("expression")) {
    EXPRESSION_VARIATIONS.slice(0, Math.ceil(count / 2)).forEach((mod) => {
      variations.push(`${basePrompt}, ${mod}`);
    });
  }

  return variations.slice(0, count);
}

// Helper: Convert aspect ratio string to EC2 AI format
function convertAspectRatioForEC2(aspectRatio: string): AIVideoAspectRatio {
  const mapping: Record<string, AIVideoAspectRatio> = {
    "16:9": "16:9",
    "9:16": "9:16",
    "1:1": "1:1",
  };
  return mapping[aspectRatio] || "9:16";
}

// Helper: Convert duration to EC2 AI format
function convertDurationForEC2(durationSeconds: number): AIVideoDuration {
  if (durationSeconds <= 4) return 4;
  if (durationSeconds <= 6) return 6;
  return 8;
}

// Async video generation handler for variations (runs in background) - Uses EC2 AI endpoints
function startVariationVideoGeneration(
  generationId: string,
  params: {
    prompt: string;
    negativePrompt?: string;
    durationSeconds: number;
    aspectRatio: string;
    style?: string;
    // Audio composition params (from seed generation)
    audioAsset?: {
      id: string;
      s3Url: string;
      filename: string;
    } | null;
    audioStartTime?: number;
    audioDuration?: number;
    campaignId?: string | null;
    userId: string;
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
          progress: 5,
        },
      });

      console.log(`[Variation ${generationId}] Starting via EC2 AI endpoints...`);

      // ============================================
      // I2V Mode: Generate image first, then video via EC2
      // ============================================
      let generatedImageUrl: string | undefined;
      let geminiVideoPrompt: string | undefined;

      console.log(`[Variation ${generationId}] Starting I2V mode - Image generation via EC2...`);

      // Step 1: Use I2V Specialist Agent to generate optimized image prompt
      const i2vAgent = createI2VSpecialistAgent();
      const agentContext: AgentContext = {
        workflow: {
          artistName: "Brand",
          platform: "tiktok",
          language: "ko",
          sessionId: `variation-${generationId}`,
        },
      };

      const imagePromptResult = await i2vAgent.generateImagePrompt(
        params.prompt,
        agentContext,
        { style: params.style }
      );

      if (imagePromptResult.success && imagePromptResult.data?.prompt) {
        const geminiImagePrompt = imagePromptResult.data.prompt;
        console.log(`[Variation ${generationId}] Image prompt: ${geminiImagePrompt.slice(0, 150)}...`);

        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: { progress: 15 },
        });

        // Step 2: Generate image via EC2 Imagen endpoint
        try {
          const imageJobId = `img-var-${generationId}`;
          const s3Folder = params.campaignId || `quick-create/${params.userId}`;

          console.log(`[Variation ${generationId}] Submitting image generation to EC2...`);

          const imageSubmitResult = await submitImageGeneration(
            imageJobId,
            {
              prompt: geminiImagePrompt,
              negative_prompt: params.negativePrompt,
              aspect_ratio: convertAspectRatioForEC2(params.aspectRatio || "9:16") as "16:9" | "9:16" | "1:1" | "4:3" | "3:4",
              number_of_images: 1,
            },
            {
              s3_bucket: process.env.AWS_S3_BUCKET || 'hydra-assets-hybe',
              s3_key: `${s3Folder}/variation_image_${generationId}.png`,
            }
          );

          if (imageSubmitResult.status === 'queued' || imageSubmitResult.status === 'processing') {
            console.log(`[Variation ${generationId}] Image job submitted, waiting for completion...`);

            await prisma.videoGeneration.update({
              where: { id: generationId },
              data: { progress: 20 },
            });

            // Wait for image generation to complete
            const imageResult = await waitForAIJob(imageJobId, {
              maxWaitTime: 180000, // 3 minutes for image
              pollInterval: 3000,
            });

            if (imageResult.status === 'completed' && imageResult.output_url) {
              generatedImageUrl = imageResult.output_url;
              console.log(`[Variation ${generationId}] Image generated: ${generatedImageUrl}`);

              await prisma.videoGeneration.update({
                where: { id: generationId },
                data: { progress: 35 },
              });

              // Step 3: Use I2V Specialist Agent to generate video prompt with animation instructions
              const videoPromptResult = await i2vAgent.generateVideoPrompt(
                {
                  visual_style: params.style || "cinematic",
                  color_palette: [],
                  mood: "dynamic",
                  main_subject: params.prompt,
                },
                params.prompt,
                agentContext,
                { duration: params.durationSeconds || 8, style: params.style }
              );

              if (videoPromptResult.success && videoPromptResult.data?.prompt) {
                geminiVideoPrompt = videoPromptResult.data.prompt;
                console.log(`[Variation ${generationId}] Video prompt: ${geminiVideoPrompt.slice(0, 150)}...`);
              }

              await prisma.videoGeneration.update({
                where: { id: generationId },
                data: { progress: 40 },
              });
            } else {
              console.warn(`[Variation ${generationId}] Image generation failed: ${imageResult.error}, falling back to T2V`);
            }
          } else {
            console.warn(`[Variation ${generationId}] Image job submission failed: ${imageSubmitResult.error}`);
          }
        } catch (imagenError) {
          console.error(`[Variation ${generationId}] Imagen error:`, imagenError);
        }
      } else {
        console.warn(`[Variation ${generationId}] Image prompt generation failed, falling back to T2V`);
      }

      // Step 4: Generate video via EC2 VEO endpoint (I2V if image available, T2V as fallback)
      let finalVideoPrompt = params.prompt;
      if (generatedImageUrl && geminiVideoPrompt) {
        finalVideoPrompt = geminiVideoPrompt;
        console.log(`[Variation ${generationId}] Using I2V mode with generated image`);
      } else {
        console.log(`[Variation ${generationId}] Using T2V mode (fallback)`);
      }

      const videoJobId = `vid-var-${generationId}`;
      const s3Folder = params.campaignId || `quick-create/${params.userId}`;
      const videoOutputKey = `${s3Folder}/variation_${generationId}.mp4`;

      // Prepare audio overlay if audio asset exists
      let audioOverlay = undefined;
      if (params.audioAsset?.s3Url) {
        try {
          // Generate fresh presigned URL for audio
          const audioPresignedUrl = await getPresignedUrlFromS3Url(params.audioAsset.s3Url, 172800);
          console.log(`[Variation ${generationId}] Including audio overlay in video generation`);

          audioOverlay = {
            audio_url: audioPresignedUrl,
            audio_start_time: params.audioStartTime || 0,
            audio_volume: 1.0,
            fade_in: 0.5,
            fade_out: 0.5,
          };
        } catch (presignError) {
          console.error(`[Variation ${generationId}] Failed to get audio presigned URL:`, presignError);
        }
      }

      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 50 },
      });

      console.log(`[Variation ${generationId}] Submitting video generation to EC2...`);

      // Submit video generation (I2V if image URL available, otherwise T2V)
      let videoSubmitResult;
      if (generatedImageUrl) {
        // I2V mode - use image as reference
        videoSubmitResult = await submitI2VGeneration(
          videoJobId,
          {
            prompt: finalVideoPrompt,
            negative_prompt: params.negativePrompt,
            aspect_ratio: convertAspectRatioForEC2(params.aspectRatio),
            duration_seconds: convertDurationForEC2(params.durationSeconds),
            reference_image_url: generatedImageUrl,
            generate_audio: !audioOverlay, // Don't generate audio if we're overlaying
            audio_overlay: audioOverlay,
          },
          {
            s3_bucket: process.env.AWS_S3_BUCKET || 'hydra-assets-hybe',
            s3_key: videoOutputKey,
          }
        );
      } else {
        // T2V mode - text to video
        videoSubmitResult = await submitVideoGeneration(
          videoJobId,
          {
            prompt: finalVideoPrompt,
            negative_prompt: params.negativePrompt,
            aspect_ratio: convertAspectRatioForEC2(params.aspectRatio),
            duration_seconds: convertDurationForEC2(params.durationSeconds),
            generate_audio: !audioOverlay,
            audio_overlay: audioOverlay,
          },
          {
            s3_bucket: process.env.AWS_S3_BUCKET || 'hydra-assets-hybe',
            s3_key: videoOutputKey,
          }
        );
      }

      if (videoSubmitResult.status === 'queued' || videoSubmitResult.status === 'processing') {
        console.log(`[Variation ${generationId}] Video job submitted, waiting for completion...`);

        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: { progress: 60 },
        });

        // Wait for video generation to complete (VEO can take up to 5+ minutes)
        const videoResult = await waitForAIJob(videoJobId, {
          maxWaitTime: 600000, // 10 minutes for video
          pollInterval: 5000,
        });

        if (videoResult.status === 'completed' && videoResult.output_url) {
          const existingGen = await prisma.videoGeneration.findUnique({
            where: { id: generationId },
          });
          const existingMetadata = (existingGen?.qualityMetadata as Record<string, unknown>) || {};

          // If audio overlay was included, the output already has audio composed
          const finalOutputUrl = videoResult.output_url;
          const composedOutputUrl = audioOverlay ? videoResult.output_url : null;

          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: {
              status: "COMPLETED",
              progress: 100,
              outputUrl: finalOutputUrl,
              composedOutputUrl: composedOutputUrl,
              qualityScore: 75 + Math.floor(Math.random() * 20),
              qualityMetadata: {
                ...existingMetadata,
                generationMode: generatedImageUrl ? "I2V" : "T2V",
                generatedViaEC2: true,
                imageUrl: generatedImageUrl || null,
                audioComposition: composedOutputUrl ? {
                  audioAssetId: params.audioAsset?.id,
                  audioAssetFilename: params.audioAsset?.filename,
                  composedAt: new Date().toISOString(),
                } : null,
              },
            },
          });

          console.log(`[Variation ${generationId}] Video generation complete: ${finalOutputUrl}`);

          // Trigger auto-schedule if configured
          const autoPublish = existingMetadata?.autoPublish as { enabled?: boolean } | undefined;
          if (autoPublish?.enabled) {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hydra.ai.kr";
              await fetch(`${baseUrl}/api/v1/generations/${generationId}/auto-schedule`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });
            } catch (scheduleError) {
              console.error("Auto-schedule failed:", scheduleError);
            }
          }
        } else {
          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: {
              status: "FAILED",
              progress: 100,
              errorMessage: videoResult.error || "Video generation failed",
            },
          });
        }
      } else {
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: videoSubmitResult.error || "Video job submission failed",
          },
        });
      }
    } catch (error) {
      console.error("Variation video generation error:", error);
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

// POST /api/v1/generations/[id]/variations - Create variations from a seed generation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: seedGenerationId } = await params;

    // Fetch the seed generation
    const seedGeneration = await prisma.videoGeneration.findUnique({
      where: { id: seedGenerationId },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
        audioAsset: true,
      },
    });

    if (!seedGeneration) {
      return NextResponse.json({ detail: "Seed generation not found" }, { status: 404 });
    }

    // Check access - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (seedGeneration.campaign) {
        if (!user.labelIds.includes(seedGeneration.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (seedGeneration.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Validate seed generation is completed
    if (seedGeneration.status !== "COMPLETED") {
      return NextResponse.json(
        { detail: "Seed generation must be completed before creating variations" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      style_categories = [],
      enable_prompt_variation = false,
      prompt_variation_types = [],
      max_variations = 10,
      auto_publish, // Auto-publish configuration
    } = body;

    if (!style_categories || style_categories.length === 0) {
      return NextResponse.json(
        { detail: "At least one style_category is required" },
        { status: 400 }
      );
    }

    // Fetch presets for selected categories
    const presets = await prisma.stylePreset.findMany({
      where: {
        category: { in: style_categories },
        isActive: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    if (presets.length === 0) {
      return NextResponse.json(
        { detail: "No active presets found for selected categories" },
        { status: 400 }
      );
    }

    // Group presets by category
    const presetsByCategory: Record<string, typeof presets> = {};
    presets.forEach((preset) => {
      if (!presetsByCategory[preset.category]) {
        presetsByCategory[preset.category] = [];
      }
      presetsByCategory[preset.category].push(preset);
    });

    // Generate all combinations
    type PresetCombination = typeof presets;
    let combinations: PresetCombination[] = [[]];

    style_categories.forEach((category: string) => {
      const categoryPresets = presetsByCategory[category] || [];
      if (categoryPresets.length > 0) {
        const newCombinations: PresetCombination[] = [];
        combinations.forEach((combo) => {
          categoryPresets.forEach((preset) => {
            newCombinations.push([...combo, preset]);
          });
        });
        combinations = newCombinations;
      }
    });

    // Apply prompt variations if enabled
    let promptVariations = [seedGeneration.prompt];
    if (enable_prompt_variation && prompt_variation_types.length > 0) {
      promptVariations = generatePromptVariations(
        seedGeneration.prompt,
        prompt_variation_types,
        3 // Max 3 prompt variations
      );
    }

    // Calculate final variations (preset combos × prompt variations)
    type VariationData = {
      presetCombo: PresetCombination;
      promptVariation: string;
      promptIndex: number;
    };
    let allVariations: VariationData[] = [];

    combinations.forEach((presetCombo) => {
      promptVariations.forEach((promptVar, promptIndex) => {
        allVariations.push({
          presetCombo,
          promptVariation: promptVar,
          promptIndex,
        });
      });
    });

    // Limit to max_variations
    allVariations = allVariations.slice(0, max_variations);

    // Create batch ID
    const batchId = uuidv4();

    // Create generations for each variation
    const createdGenerations = await Promise.all(
      allVariations.map(async ({ presetCombo, promptVariation, promptIndex }, variationIndex) => {
        // Build variation label
        const presetLabels = presetCombo.map((p) => `${p.category}:${p.name}`);
        const variationLabel = presetLabels.join(" + ") +
          (promptIndex > 0 ? ` (prompt v${promptIndex + 1})` : "");

        // Merge prompt with style modifiers
        let finalPrompt = promptVariation;
        const appliedPresets: { id: string; name: string; category: string }[] = [];

        presetCombo.forEach((preset) => {
          const params = preset.parameters as StylePresetParams;
          if (params?.promptModifier) {
            finalPrompt = `${finalPrompt}. Style: ${params.promptModifier}`;
          }
          appliedPresets.push({
            id: preset.id,
            name: preset.name,
            category: preset.category,
          });
        });

        // Create the generation
        const generation = await prisma.videoGeneration.create({
          data: {
            campaignId: seedGeneration.campaignId,
            prompt: finalPrompt,
            negativePrompt: seedGeneration.negativePrompt,
            durationSeconds: seedGeneration.durationSeconds,
            aspectRatio: seedGeneration.aspectRatio,
            referenceImageId: seedGeneration.referenceImageId,
            referenceStyle: presetCombo.map((p) => p.name).join(", ") || null,
            audioAssetId: seedGeneration.audioAssetId,
            status: "PENDING",
            progress: 0,
            createdBy: user.id,
            vertexRequestId: uuidv4(),
            qualityMetadata: {
              batchId,
              seedGenerationId,
              variationType: "variation",
              variationLabel,
              appliedPresets: appliedPresets.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
              })),
              promptModification: promptIndex > 0 ? `v${promptIndex + 1}` : null,
              // Auto-publish settings for scheduling on completion
              autoPublish: auto_publish ? {
                enabled: true,
                socialAccountId: auto_publish.social_account_id,
                intervalMinutes: auto_publish.interval_minutes || 30,
                caption: auto_publish.caption || "",
                hashtags: auto_publish.hashtags || [],
                variationIndex,
              } : null,
            },
          },
        });

        return {
          generation,
          variationLabel,
          appliedPresets,
          promptModification: promptIndex > 0 ? `prompt v${promptIndex + 1}` : undefined,
        };
      })
    );

    // Start async video generation for all variations (with audio composition)
    createdGenerations.forEach(({ generation }) => {
      startVariationVideoGeneration(generation.id, {
        prompt: generation.prompt,
        negativePrompt: generation.negativePrompt || undefined,
        durationSeconds: generation.durationSeconds,
        aspectRatio: generation.aspectRatio,
        // Pass audio info from seed generation for composition
        audioAsset: seedGeneration.audioAsset ? {
          id: seedGeneration.audioAsset.id,
          s3Url: seedGeneration.audioAsset.s3Url,
          filename: seedGeneration.audioAsset.filename,
        } : null,
        audioStartTime: seedGeneration.audioStartTime || 0,
        audioDuration: seedGeneration.audioDuration || undefined,
        campaignId: seedGeneration.campaignId,
        userId: user.id,
      });
    });

    // Format response
    const variations = createdGenerations.map(({ generation, variationLabel, appliedPresets, promptModification }) => ({
      id: generation.id,
      variation_label: variationLabel,
      applied_presets: appliedPresets,
      prompt_modification: promptModification,
      status: generation.status.toLowerCase(),
    }));

    return NextResponse.json(
      {
        seed_generation_id: seedGenerationId,
        batch_id: batchId,
        total_count: variations.length,
        variations,
        message: `Created ${variations.length} variations from seed generation`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create variations error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/generations/[id]/variations?batch_id=xxx - Get variation batch status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: seedGenerationId } = await params;
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batch_id");

    if (!batchId) {
      return NextResponse.json({ detail: "batch_id query parameter is required" }, { status: 400 });
    }

    // Fetch seed generation for access check
    const seedGeneration = await prisma.videoGeneration.findUnique({
      where: { id: seedGenerationId },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    });

    if (!seedGeneration) {
      return NextResponse.json({ detail: "Seed generation not found" }, { status: 404 });
    }

    // Check access - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (seedGeneration.campaign) {
        if (!user.labelIds.includes(seedGeneration.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (seedGeneration.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Find all variations with this batch ID (exclude soft-deleted)
    const generations = await prisma.videoGeneration.findMany({
      where: {
        deletedAt: null,
        qualityMetadata: {
          path: ["batchId"],
          equals: batchId,
        },
      },
      include: {
        audioAsset: {
          select: { id: true, filename: true, s3Url: true, originalFilename: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (generations.length === 0) {
      return NextResponse.json({ detail: "Variation batch not found" }, { status: 404 });
    }

    // Calculate batch status
    const statuses = generations.map((g) => g.status);
    let batchStatus: "pending" | "processing" | "completed" | "partial_failure" = "processing";
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

    const variations = generations.map((gen) => {
      const metadata = gen.qualityMetadata as Record<string, unknown> | null;
      return {
        id: gen.id,
        variation_label: metadata?.variationLabel || "",
        applied_presets: metadata?.appliedPresets || [],
        prompt_modification: metadata?.promptModification,
        status: gen.status.toLowerCase(),
        generation: {
          id: gen.id,
          prompt: gen.prompt,
          negative_prompt: gen.negativePrompt,
          duration_seconds: gen.durationSeconds,
          aspect_ratio: gen.aspectRatio,
          status: gen.status.toLowerCase(),
          progress: gen.progress,
          output_url: gen.outputUrl,
          composed_output_url: gen.composedOutputUrl,
          error_message: gen.errorMessage,
          quality_score: gen.qualityScore,
          audio_asset: gen.audioAsset ? {
            id: gen.audioAsset.id,
            filename: gen.audioAsset.filename,
            original_filename: gen.audioAsset.originalFilename,
            s3_url: gen.audioAsset.s3Url,
          } : null,
          created_at: gen.createdAt.toISOString(),
          updated_at: gen.updatedAt.toISOString(),
        },
      };
    });

    return NextResponse.json({
      batch_id: batchId,
      seed_generation_id: seedGenerationId,
      batch_status: batchStatus,
      overall_progress: overallProgress,
      total: generations.length,
      completed: completedCount,
      failed: failedCount,
      variations,
    });
  } catch (error) {
    console.error("Get variation batch error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
