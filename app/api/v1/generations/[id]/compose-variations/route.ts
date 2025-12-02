import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import { searchImagesMultiQuery, isGoogleSearchConfigured } from "@/lib/google-search";
import { submitRenderToModal, ModalRenderRequest } from "@/lib/modal/client";

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

    // Accept both field name conventions (snake_case from frontend, camelCase fallback)
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

    // Generate all combinations of settings
    const settingsCombinations = generateSettingsCombinations(
      effectPresets,
      colorGrades,
      textStyles,
      vibeVariations,
      maxVariations
    );

    console.log(`[Compose Variations] Creating ${settingsCombinations.length} variations from:`, {
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

    // Create batch ID
    const batchId = uuidv4();

    // Create placeholder generations for each variation
    const createdGenerations = await Promise.all(
      settingsCombinations.map(async (settings, index) => {
        const variationLabel = `${settings.vibe} - ${settings.effectPreset} / ${settings.colorGrade}`;

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

    // Start background jobs for each variation (call Modal directly)
    createdGenerations.forEach(async ({ generation, settings }) => {
      try {
        const outputKey = `compose/renders/${generation.id}/output.mp4`;

        // Prepare render request for Modal
        const modalRequest: ModalRenderRequest = {
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

        console.log(`[Compose Variations] Submitting ${generation.id} to Modal:`, {
          vibe: settings.vibe,
          effect_preset: settings.effectPreset,
          images_count: images.length,
        });

        // Submit to Modal (CPU rendering)
        const modalResponse = await submitRenderToModal(modalRequest);

        console.log(`[Compose Variations] Modal response for ${generation.id}:`, modalResponse);

        // Update generation with modalCallId for status polling
        await prisma.videoGeneration.update({
          where: { id: generation.id },
          data: {
            status: "PROCESSING",
            qualityMetadata: {
              batchId,
              seedGenerationId,
              variationType: "compose_variation",
              modalCallId: modalResponse.call_id,
              createdAt: new Date().toISOString(),
              settings: {
                effectPreset: settings.effectPreset,
                colorGrade: settings.colorGrade,
                textStyle: settings.textStyle,
                vibe: settings.vibe,
              },
            } as Prisma.InputJsonValue,
          },
        });

        console.log(`[Compose Variations] Started job ${generation.id} with Modal call_id: ${modalResponse.call_id}`);
      } catch (error) {
        console.error(`Failed to start compose variation ${generation.id}:`, error);
        await prisma.videoGeneration.update({
          where: { id: generation.id },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: error instanceof Error ? error.message : "Failed to start Modal render job",
          },
        });
      }
    });

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
