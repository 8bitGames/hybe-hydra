import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import { searchImagesMultiQuery, isGoogleSearchConfigured } from "@/lib/google-search";
import { submitBatchRenderToModal, ModalRenderRequest } from "@/lib/modal/client";
import { getSettingsFromStylePresets, getStyleSetById } from "@/lib/constants/style-presets";

const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.MINIO_BUCKET_NAME || 'hydra-assets-hybe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Variation settings combination
interface VariationSettings {
  effectPreset: string;
  colorGrade: string;
  textStyle: string;
  vibe: string;
  stylePresetId?: string;  // Track which preset was used
}

// Default presets when not provided
const DEFAULT_EFFECT_PRESETS = ["zoom_beat", "crossfade"];
const DEFAULT_COLOR_GRADES = ["vibrant"];
const DEFAULT_TEXT_STYLES = ["bold_pop"];
const DEFAULT_VIBE_PRESETS = ["Pop"];

// Get keywords from metadata or extract from prompt as fallback
function getVariationKeywords(
  metadata: Record<string, unknown> | null,
  prompt: string
): string[] {
  // Try to get keywords from composeData metadata (stored during compose creation)
  const composeData = metadata?.composeData as Record<string, unknown> | null;
  if (composeData?.keywords && Array.isArray(composeData.keywords) && composeData.keywords.length > 0) {
    return composeData.keywords.slice(0, 3);
  }

  // Try searchKeywords from composeData
  if (composeData?.searchKeywords && Array.isArray(composeData.searchKeywords) && composeData.searchKeywords.length > 0) {
    return composeData.searchKeywords.slice(0, 3);
  }

  // Fallback: extract from prompt using stop words
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "video", "image",
    "photo", "picture", "style", "aesthetic", "vibe", "mood", "feeling",
    "generation", "create", "make", "show", "display", "featuring",
    "compose", "variation", "composed", "slideshow",
  ]);

  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  const uniqueWords = [...new Set(words)]
    .sort((a, b) => b.length - a.length);

  const extracted = uniqueWords.slice(0, 3);

  // If extraction failed (no meaningful words), use default creative tags
  if (extracted.length === 0) {
    return ["creative", "aesthetic"];
  }

  return extracted;
}

// Generate all combinations of settings
function generateSettingsCombinations(
  effectPresets: string[],
  colorGrades: string[],
  textStyles: string[],
  vibes: string[],
  maxVariations: number
): VariationSettings[] {
  const combinations: VariationSettings[] = [];

  // Use defaults if arrays are empty
  const effects = effectPresets.length > 0 ? effectPresets : DEFAULT_EFFECT_PRESETS;
  const colors = colorGrades.length > 0 ? colorGrades : DEFAULT_COLOR_GRADES;
  const texts = textStyles.length > 0 ? textStyles : DEFAULT_TEXT_STYLES;
  const vibeList = vibes.length > 0 ? vibes : DEFAULT_VIBE_PRESETS;

  // Generate all combinations
  for (const effect of effects) {
    for (const color of colors) {
      for (const text of texts) {
        for (const vibe of vibeList) {
          combinations.push({
            effectPreset: effect,
            colorGrade: color,
            textStyle: text,
            vibe,
          });

          // Stop if we've reached max
          if (combinations.length >= maxVariations) {
            return combinations;
          }
        }
      }
    }
  }

  return combinations;
}

// POST /api/v1/generations/[id]/compose-variations - Create compose variations
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: seedGenerationId } = await params;

    // Fetch the seed generation (must be a compose video)
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

    // Verify it's a compose video
    if (!seedGenerationId.startsWith("compose-")) {
      return NextResponse.json(
        { detail: "This endpoint is only for compose videos. Use /variations for AI videos." },
        { status: 400 }
      );
    }

    // Check access
    if (user.role !== "ADMIN") {
      if (seedGeneration.campaign) {
        if (!user.labelIds.includes(seedGeneration.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (seedGeneration.createdBy !== user.id) {
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

    // Check for new style_presets format first
    const stylePresets: string[] = body.style_presets || body.stylePresets || [];

    // Legacy fields (for backwards compatibility)
    const maxVariations = body.variation_count || body.max_variations || 9;
    const effectPresets: string[] = body.effect_presets || body.effectPresets || [];
    const colorGrades: string[] = body.color_grades || body.colorGrades || [];
    const textStyles: string[] = body.text_styles || body.textStyles || [];
    const vibeVariations: string[] = body.vibe_variations || body.vibeVariations || [];
    const autoPublish = body.auto_publish;

    // Get original compose metadata
    const originalMetadata = seedGeneration.qualityMetadata as Record<string, unknown> | null;
    const originalComposeData = originalMetadata?.composeData as Record<string, unknown> | null;

    // Get search tags from metadata (for image search)
    const searchTags = getVariationKeywords(originalMetadata, seedGeneration.prompt);

    // Get script lines from original compose data (for subtitles/captions)
    const originalScriptLines = originalComposeData?.script as Array<{
      text: string;
      timing: number;
      duration: number;
    }> | undefined;

    // Generate settings based on input format
    let settingsCombinations: VariationSettings[];

    if (stylePresets.length > 0) {
      // New format: style presets (each preset = one variation)
      const presetSettings = getSettingsFromStylePresets(stylePresets);
      settingsCombinations = presetSettings.map((settings, index) => ({
        effectPreset: settings.effectPreset,
        colorGrade: settings.colorGrade,
        textStyle: settings.textStyle,
        vibe: settings.vibe,
        stylePresetId: stylePresets[index],
      }));

      console.log(`[Compose Variations] Creating ${settingsCombinations.length} variations from style presets:`, {
        stylePresets,
        searchTags,
        hasScriptLines: !!originalScriptLines && originalScriptLines.length > 0,
        scriptLinesCount: originalScriptLines?.length || 0,
        originalPrompt: originalComposeData?.originalPrompt || seedGeneration.prompt,
        hasComposeData: !!originalComposeData,
      });
    } else {
      // Legacy format: generate combinations from individual settings
      settingsCombinations = generateSettingsCombinations(
        effectPresets,
        colorGrades,
        textStyles,
        vibeVariations,
        maxVariations
      );

      console.log(`[Compose Variations] Creating ${settingsCombinations.length} variations from legacy settings:`, {
        effectPresets: effectPresets.length || "default",
        colorGrades: colorGrades.length || "default",
        textStyles: textStyles.length || "default",
        vibeVariations: vibeVariations.length || "default",
        maxVariations,
        searchTags,
        hasScriptLines: !!originalScriptLines && originalScriptLines.length > 0,
        scriptLinesCount: originalScriptLines?.length || 0,
        originalPrompt: originalComposeData?.originalPrompt || seedGeneration.prompt,
        hasComposeData: !!originalComposeData,
      });
    }

    // Create batch ID
    const batchId = uuidv4();

    // Create placeholder generations for each variation
    const createdGenerations = await Promise.all(
      settingsCombinations.map(async (settings, index) => {
        // Use style preset name if available, otherwise use legacy format
        const styleSet = settings.stylePresetId ? getStyleSetById(settings.stylePresetId) : null;
        const variationLabel = styleSet
          ? `${styleSet.name} (${styleSet.nameKo})`
          : `${settings.vibe} - ${settings.effectPreset} / ${settings.colorGrade}`;

        // Create the generation placeholder
        const generation = await prisma.videoGeneration.create({
          data: {
            id: `compose-var-${uuidv4()}`,
            campaignId: seedGeneration.campaignId,
            prompt: `Compose variation: ${settings.vibe} (${settings.effectPreset})`,
            negativePrompt: seedGeneration.negativePrompt,
            durationSeconds: seedGeneration.durationSeconds,
            aspectRatio: seedGeneration.aspectRatio,
            audioAssetId: seedGeneration.audioAssetId,
            status: "PENDING",
            progress: 0,
            createdBy: user.id,
            vertexRequestId: uuidv4(),
            qualityMetadata: {
              batchId,
              seedGenerationId,
              variationType: "compose_variation",
              variationLabel,
              searchTags,
              settings: {
                effectPreset: settings.effectPreset,
                colorGrade: settings.colorGrade,
                textStyle: settings.textStyle,
                vibe: settings.vibe,
                stylePresetId: settings.stylePresetId || null,
              },
              originalPrompt: seedGeneration.prompt,
              originalComposeData: originalComposeData as Prisma.InputJsonValue | null,
              // Auto-publish settings for scheduling on completion
              autoPublish: autoPublish ? {
                enabled: true,
                socialAccountId: autoPublish.social_account_id,
                intervalMinutes: autoPublish.interval_minutes || 30,
                caption: autoPublish.caption || "",
                hashtags: autoPublish.hashtags || [],
                variationIndex: index,
                generateGeoAeo: autoPublish.generate_geo_aeo ?? true,  // Auto-generate GEO/AEO content
              } : null,
            } as Prisma.InputJsonValue,
          },
        });

        return {
          generation,
          variationLabel,
          settings,
        };
      })
    );

    // Check if Google Search is configured for image search
    if (!isGoogleSearchConfigured()) {
      console.warn("[Compose Variations] Google Custom Search API not configured");
      return NextResponse.json(
        { detail: "Google Custom Search API not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID." },
        { status: 500 }
      );
    }

    // Search for images once (shared across all variations)
    console.log(`[Compose Variations] Searching images with tags: ${searchTags.join(", ")}`);
    const imageResults = await searchImagesMultiQuery(searchTags, {
      maxResultsPerQuery: 5,
      totalMaxResults: 15,
      safeSearch: "medium",
    });

    if (imageResults.length < 3) {
      console.error(`[Compose Variations] Not enough images found: ${imageResults.length}`);
      // Mark all generations as failed
      await Promise.all(
        createdGenerations.map(({ generation }) =>
          prisma.videoGeneration.update({
            where: { id: generation.id },
            data: {
              status: "FAILED",
              errorMessage: `Not enough images found (${imageResults.length}). Need at least 3 images.`,
            },
          })
        )
      );
      return NextResponse.json(
        { detail: `Not enough images found (${imageResults.length}). Need at least 3.` },
        { status: 400 }
      );
    }

    // Convert search results to image array for Modal
    const images = imageResults.slice(0, 10).map((result, idx) => ({
      url: result.link,
      order: idx,
    }));

    console.log(`[Compose Variations] Found ${images.length} images for rendering`);

    // Prepare all render requests for batch submission
    const modalRequests: ModalRenderRequest[] = createdGenerations.map(({ generation, settings }) => {
      const outputKey = `compose/renders/${generation.id}/output.mp4`;
      return {
        job_id: generation.id,
        images,
        audio: {
          url: seedGeneration.audioAsset?.s3Url || "",
          start_time: 0,
          duration: null, // Auto-calculate
        },
        script: originalScriptLines && originalScriptLines.length > 0
          ? { lines: originalScriptLines }
          : null,
        settings: {
          vibe: settings.vibe,
          effect_preset: settings.effectPreset,
          aspect_ratio: seedGeneration.aspectRatio,
          target_duration: seedGeneration.durationSeconds || 0,
          text_style: settings.textStyle,
          color_grade: settings.colorGrade,
        },
        output: {
          s3_bucket: S3_BUCKET,
          s3_key: outputKey,
        },
      };
    });

    console.log(`[Compose Variations] Submitting ${modalRequests.length} jobs to Modal batch endpoint`);

    // Submit all jobs in a single batch request (parallel processing on Modal)
    try {
      const batchResponse = await submitBatchRenderToModal(modalRequests);

      console.log(`[Compose Variations] Batch response:`, {
        batch_id: batchResponse.batch_id,
        total_jobs: batchResponse.total_jobs,
        status: batchResponse.status,
      });

      // Update all generations with their modalCallIds
      await Promise.all(
        batchResponse.call_ids.map(async ({ job_id, call_id }) => {
          const genData = createdGenerations.find(g => g.generation.id === job_id);
          if (!genData) return;

          await prisma.videoGeneration.update({
            where: { id: job_id },
            data: {
              status: "PROCESSING",
              qualityMetadata: {
                batchId,
                modalBatchId: batchResponse.batch_id,
                seedGenerationId,
                variationType: "compose_variation",
                modalCallId: call_id,
                createdAt: new Date().toISOString(),
                settings: {
                  effectPreset: genData.settings.effectPreset,
                  colorGrade: genData.settings.colorGrade,
                  textStyle: genData.settings.textStyle,
                  vibe: genData.settings.vibe,
                  stylePresetId: genData.settings.stylePresetId || null,
                },
              } as Prisma.InputJsonValue,
            },
          });

          console.log(`[Compose Variations] Started ${job_id} with call_id: ${call_id}`);
        })
      );
    } catch (error) {
      console.error(`[Compose Variations] Batch submit failed:`, error);
      // Mark all as failed
      await Promise.all(
        createdGenerations.map(({ generation }) =>
          prisma.videoGeneration.update({
            where: { id: generation.id },
            data: {
              status: "FAILED",
              progress: 100,
              errorMessage: error instanceof Error ? error.message : "Failed to start Modal batch render",
            },
          })
        )
      );
      throw error;
    }

    // Format response
    const variations = createdGenerations.map(({ generation, variationLabel, settings }) => ({
      id: generation.id,
      variation_label: variationLabel,
      search_tags: searchTags,
      settings,
      status: "pending",
    }));

    return NextResponse.json(
      {
        seed_generation_id: seedGenerationId,
        batch_id: batchId,
        total_count: variations.length,
        search_tags: searchTags,
        variations,
        message: `Created ${variations.length} compose variations`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create compose variations error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/generations/[id]/compose-variations?batch_id=xxx - Get compose variation batch status
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

    // Find all compose variations with this batch ID (exclude soft-deleted)
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
      return NextResponse.json({ detail: "Compose variation batch not found" }, { status: 404 });
    }

    // Calculate batch status
    const statuses = generations.map((g) => g.status);
    let batchStatus: "pending" | "processing" | "completed" | "partial_failure" = "processing";
    if (statuses.every((s) => s === "COMPLETED")) {
      batchStatus = "completed";
    } else if (statuses.some((s) => s === "FAILED")) {
      batchStatus = statuses.every((s) => s === "FAILED" || s === "COMPLETED")
        ? "partial_failure"
        : "processing";
    } else if (statuses.every((s) => s === "PENDING")) {
      batchStatus = "pending";
    }

    const completedCount = statuses.filter((s) => s === "COMPLETED").length;
    const failedCount = statuses.filter((s) => s === "FAILED").length;
    const overallProgress = Math.round(
      generations.reduce((sum, g) => sum + g.progress, 0) / generations.length
    );

    // Format response to match VariationsBatchStatus interface
    const variations = generations.map((gen) => {
      const metadata = gen.qualityMetadata as Record<string, unknown> | null;
      return {
        id: gen.id,
        variation_label: (metadata?.variationLabel as string) || "",
        status: gen.status as "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
        progress: gen.progress,
        output_url: gen.composedOutputUrl || gen.outputUrl || undefined,
        thumbnail_url: undefined, // Compose videos don't have separate thumbnails
        error_message: gen.errorMessage || undefined,
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
    console.error("Get compose variation batch error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
