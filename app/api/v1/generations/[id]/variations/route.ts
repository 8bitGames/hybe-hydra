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

// Async video generation handler for variations (runs in background)
function startVariationVideoGeneration(
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
      // Use fast model for testing when VEO_USE_FAST_MODEL=true
      const veoModel = process.env.VEO_USE_FAST_MODEL === "true"
        ? "veo-3.1-fast-generate-preview"
        : "veo-3.1-generate-preview";

      const veoParams: VeoGenerationParams = {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        durationSeconds: params.durationSeconds,
        aspectRatio: params.aspectRatio as "16:9" | "9:16" | "1:1",
        style: params.style,
        model: veoModel,
      };

      // Update progress
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
            },
          },
        });

        // Trigger auto-schedule if configured
        const autoPublish = existingMetadata?.autoPublish as { enabled?: boolean } | undefined;
        if (autoPublish?.enabled) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await fetch(`${baseUrl}/api/v1/generations/${generationId}/auto-schedule`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
          } catch (scheduleError) {
            console.error("Auto-schedule failed:", scheduleError);
            // Don't fail the generation if scheduling fails
          }
        }
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

    // Start async video generation for all variations
    createdGenerations.forEach(({ generation }) => {
      startVariationVideoGeneration(generation.id, {
        prompt: generation.prompt,
        negativePrompt: generation.negativePrompt || undefined,
        durationSeconds: generation.durationSeconds,
        aspectRatio: generation.aspectRatio,
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

    // Find all variations with this batch ID
    const generations = await prisma.videoGeneration.findMany({
      where: {
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
