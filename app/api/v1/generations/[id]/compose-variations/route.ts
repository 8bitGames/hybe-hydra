import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import { submitAutoCompose, AutoComposeRequest, getComposeRenderStatus } from "@/lib/compose/client";
import { getSettingsFromStylePresets, getStyleSetById } from "@/lib/constants/style-presets";
import { getPresignedUrlFromS3Url } from "@/lib/storage";

/**
 * Remove query string from S3 URL
 * EC2 uses IAM role for S3 access, so pre-signed URL parameters are not needed
 * and may have expired since original creation
 */
function cleanS3Url(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove all query parameters (pre-signed URL params)
    urlObj.search = '';
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

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
// Prioritizes nouns (visual subjects) over adjectives for better image search
function getVariationKeywords(
  metadata: Record<string, unknown> | null,
  prompt: string,
  trendKeywords?: string[] | null
): string[] {
  // 1. First check trendKeywords field (stored at generation level for Fast-Cut)
  if (trendKeywords && Array.isArray(trendKeywords) && trendKeywords.length > 0) {
    console.log(`[getVariationKeywords] Using trendKeywords: ${trendKeywords.slice(0, 5).join(", ")}`);
    return trendKeywords.slice(0, 5); // Use more keywords for better variety
  }

  // 2. Try to get keywords from fastCutData metadata (Fast-Cut generations)
  const fastCutData = metadata?.fastCutData as Record<string, unknown> | null;
  if (fastCutData?.searchKeywords && Array.isArray(fastCutData.searchKeywords) && fastCutData.searchKeywords.length > 0) {
    console.log(`[getVariationKeywords] Using fastCutData.searchKeywords: ${(fastCutData.searchKeywords as string[]).slice(0, 5).join(", ")}`);
    return (fastCutData.searchKeywords as string[]).slice(0, 5);
  }

  // 3. Try to get keywords from composeData metadata (Compose generations)
  const composeData = metadata?.composeData as Record<string, unknown> | null;
  if (composeData?.keywords && Array.isArray(composeData.keywords) && composeData.keywords.length > 0) {
    return composeData.keywords.slice(0, 3);
  }

  // Try searchKeywords from composeData
  if (composeData?.searchKeywords && Array.isArray(composeData.searchKeywords) && composeData.searchKeywords.length > 0) {
    return composeData.searchKeywords.slice(0, 3);
  }

  // Fallback: extract NOUNS from prompt (for visual image search)
  // Stop words include common function words
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "video", "image",
    "photo", "picture", "style", "aesthetic", "vibe", "mood", "feeling",
    "generation", "create", "make", "show", "display", "featuring",
    "compose", "variation", "composed", "slideshow", "this", "that", "these",
    "those", "it", "its", "they", "them", "their", "there", "here", "where",
    "when", "what", "which", "who", "how", "why", "very", "really", "just",
    "about", "into", "over", "under", "through", "between", "being", "while",
  ]);

  // Common adjective patterns to filter out (not useful for image search)
  const adjectivePatterns = [
    /ing$/, // emphasizing, featuring, stunning
    /ous$/, // adventurous, gorgeous, luxurious
    /ive$/, // creative, attractive, impressive
    /ent$/, // reminiscent, elegant, vibrant
    /ant$/, // elegant, vibrant, dominant
    /ful$/, // beautiful, powerful, colorful
    /less$/, // endless, timeless
    /able$/, // remarkable, incredible
    /ible$/, // visible, accessible
    /tic$/, // dramatic, cinematic, aesthetic
    /ial$/, // aerial, special
    /ical$/, // magical, classical
    /ed$/, // inspired, detailed (when used as adj)
    /ly$/, // slowly, quickly (adverbs)
  ];

  // Common adjectives that might not match patterns
  const commonAdjectives = new Set([
    "good", "great", "best", "new", "old", "big", "small", "high", "low",
    "long", "short", "fast", "slow", "hot", "cold", "warm", "cool", "dark",
    "light", "bright", "soft", "hard", "deep", "wide", "rich", "bold", "epic",
    "wild", "free", "pure", "raw", "real", "true", "full", "open", "fresh",
    "clean", "clear", "sharp", "smooth", "rough", "sweet", "strong", "young",
  ]);

  // Low priority: body parts and ambiguous words that need context
  const lowPriorityWords = new Set([
    "mane", "ears", "eyes", "face", "hair", "head", "hand", "hands", "arm",
    "legs", "foot", "feet", "body", "skin", "nose", "mouth", "tail", "wing",
    "view", "scene", "shot", "angle", "look", "part", "side", "top", "bottom",
    "front", "back", "left", "right", "center", "middle", "edge", "corner",
    "time", "moment", "hour", "day", "night", "morning", "evening", "hue",
    "hues", "color", "colors", "tone", "tones", "texture", "textures",
    "first", "person", "pov", "perspective", "frame", "footage", "clip",
  ]);

  // High priority: concrete visual subjects good for image search
  const highPriorityWords = new Set([
    // Animals
    "horse", "horses", "horseback", "dog", "cat", "bird", "lion", "tiger",
    "elephant", "bear", "wolf", "deer", "eagle", "dolphin", "whale", "dragon",
    // Landscapes/Places
    "mountain", "mountains", "ocean", "beach", "forest", "desert", "canyon",
    "valley", "river", "lake", "waterfall", "island", "cliff", "cave", "volcano",
    "city", "street", "building", "bridge", "tower", "castle", "palace", "temple",
    // People/Characters
    "cowboy", "rider", "dancer", "singer", "warrior", "knight", "samurai",
    "astronaut", "pilot", "soldier", "chef", "artist", "musician", "woman", "man",
    // Vehicles/Objects
    "car", "motorcycle", "airplane", "ship", "boat", "train", "bicycle",
    "guitar", "piano", "sword", "crown", "flower", "tree", "rose", "camera",
    // Nature elements
    "sky", "clouds", "stars", "moon", "sun", "rain", "snow", "storm",
    "lightning", "rainbow", "aurora", "galaxy", "space", "sunset", "sunrise",
  ]);

  const isLikelyAdjective = (word: string): boolean => {
    if (commonAdjectives.has(word)) return true;
    return adjectivePatterns.some(pattern => pattern.test(word));
  };

  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Separate nouns from adjectives
  const nouns: string[] = [];
  const adjectives: string[] = [];

  for (const word of words) {
    if (isLikelyAdjective(word)) {
      adjectives.push(word);
    } else {
      nouns.push(word);
    }
  }

  // Prioritize nouns (visual subjects good for image search)
  const uniqueNouns = [...new Set(nouns)];
  const uniqueAdjectives = [...new Set(adjectives)];

  // Take nouns first, then adjectives if needed
  const candidates = [...uniqueNouns, ...uniqueAdjectives];

  // Score words by priority and relevance
  const scored = candidates.map(word => {
    let score = 0;
    // High priority subjects get +20
    if (highPriorityWords.has(word)) score += 20;
    // Low priority/ambiguous words get -10
    if (lowPriorityWords.has(word)) score -= 10;
    // Medium-length words (4-10 chars) get +5
    if (word.length >= 4 && word.length <= 10) score += 5;
    // Very long words get +2
    else if (word.length > 10) score += 2;
    return { word, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const extracted = scored.slice(0, 3).map(s => s.word);

  console.log(`[getVariationKeywords] Extracted: ${extracted.join(", ")} (scores: ${scored.slice(0, 5).map(s => `${s.word}:${s.score}`).join(", ")})`);

  // If extraction failed, use generic terms
  if (extracted.length === 0) {
    return ["landscape", "scene"];
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
    // Fast-cut stores data in fastCutData instead of composeData
    const originalFastCutData = originalMetadata?.fastCutData as Record<string, unknown> | null;

    // Debug: Log complete seed generation info for troubleshooting
    console.log(`[Compose Variations] ========== SEED GENERATION DEBUG ==========`);
    console.log(`[Compose Variations] Seed ID: ${seedGenerationId}`);
    console.log(`[Compose Variations] Generation Type: ${seedGeneration.generationType}`);
    console.log(`[Compose Variations] Status: ${seedGeneration.status}`);
    console.log(`[Compose Variations] Prompt: ${seedGeneration.prompt?.substring(0, 100)}`);
    console.log(`[Compose Variations] Has qualityMetadata: ${!!originalMetadata}`);
    console.log(`[Compose Variations] qualityMetadata keys: ${originalMetadata ? Object.keys(originalMetadata).join(', ') : 'none'}`);
    console.log(`[Compose Variations] Has composeData: ${!!originalComposeData}`);
    console.log(`[Compose Variations] Has fastCutData: ${!!originalFastCutData}`);
    console.log(`[Compose Variations] Has imageAssets: ${!!seedGeneration.imageAssets}`);
    console.log(`[Compose Variations] ImageAssets count: ${Array.isArray(seedGeneration.imageAssets) ? (seedGeneration.imageAssets as unknown[]).length : 0}`);
    console.log(`[Compose Variations] =========================================`);

    // Get search tags from metadata (for image search)
    // Fast-Cut stores keywords in trendKeywords field at generation level
    const searchTags = getVariationKeywords(
      originalMetadata,
      seedGeneration.prompt,
      seedGeneration.trendKeywords
    );
    console.log(`[Compose Variations] Search tags: ${searchTags.join(", ")}`);
    console.log(`[Compose Variations] trendKeywords from DB: ${seedGeneration.trendKeywords?.join(", ") || "none"}`);

    // Get original image URLs from seed generation for 70/30 split
    // Priority: qualityMetadata.imageUrls > imageAssets array
    // Clean S3 URLs to remove expired presigned params - EC2 uses IAM auth
    let originalImageUrls: string[] = [];
    if (originalMetadata?.imageUrls && Array.isArray(originalMetadata.imageUrls)) {
      originalImageUrls = (originalMetadata.imageUrls as string[]).map(url => cleanS3Url(url));
    } else if (seedGeneration.imageAssets && Array.isArray(seedGeneration.imageAssets)) {
      // Extract URLs from imageAssets array
      const imageAssets = seedGeneration.imageAssets as Array<{ url?: string }>;
      originalImageUrls = imageAssets
        .map(asset => asset.url)
        .filter((url): url is string => typeof url === 'string')
        .map(url => cleanS3Url(url));
    }

    console.log(`[Compose Variations] Seed generation ID: ${seedGenerationId}`);
    console.log(`[Compose Variations] Original images found: ${originalImageUrls.length}`);
    // Debug: Log sample of original image URLs to verify they are S3 cached URLs
    if (originalImageUrls.length > 0) {
      console.log(`[Compose Variations] Original image URL samples:`, {
        first: originalImageUrls[0]?.substring(0, 100),
        second: originalImageUrls[1]?.substring(0, 100),
        isS3: originalImageUrls[0]?.includes('s3.') || originalImageUrls[0]?.includes('amazonaws.com'),
        urlPrefix: originalImageUrls[0]?.split('/').slice(0, 4).join('/'),
      });
    }

    // Get script lines from original data (composeData for compose, fastCutData for fast-cut)
    // Fast-cut stores script as array directly, compose stores it with lines property
    const rawScript = originalComposeData?.script || originalFastCutData?.script;
    const originalScriptLines = (Array.isArray(rawScript) ? rawScript : undefined) as Array<{
      text: string;
      timing: number;
      duration: number;
    }> | undefined;

    console.log(`[Compose Variations] Script lookup:`, {
      hasComposeData: !!originalComposeData,
      hasFastCutData: !!originalFastCutData,
      composeDataScript: originalComposeData?.script ? 'present' : 'missing',
      fastCutDataScript: originalFastCutData?.script ? 'present' : 'missing',
      scriptLinesFound: originalScriptLines?.length || 0,
    });

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

    // Generate fresh presigned URL for audio before sending to EC2
    // This is CRITICAL: stored s3Urls may be expired presigned URLs (7-day default expiry)
    let audioPresignedUrl: string | null = null;
    if (seedGeneration.audioAsset?.s3Url) {
      try {
        // Generate fresh presigned URL with 48 hour expiry (enough for EC2 queue time)
        audioPresignedUrl = await getPresignedUrlFromS3Url(seedGeneration.audioAsset.s3Url, 172800);
        console.log(`[Compose Variations] Generated fresh audio presigned URL for: ${seedGeneration.audioAsset.originalFilename || seedGeneration.audioAsset.filename}`);
      } catch (error) {
        console.error(`[Compose Variations] Failed to generate audio presigned URL:`, error);
        // Don't fail - audio might be optional for some variations
      }
    }

    // Prepare auto-compose requests for each variation
    // Uses 70% original images + 30% new search (keyword transformation disabled)
    // NOTE: Using polling (not callback) to check job status - GET endpoint polls EC2
    const autoComposeRequests: AutoComposeRequest[] = createdGenerations.map(({ generation, settings }) => {
      return {
        job_id: generation.id,
        search_query: seedGeneration.prompt,
        search_tags: searchTags,
        audio_url: audioPresignedUrl,
        vibe: settings.vibe,
        effect_preset: settings.effectPreset,
        color_grade: settings.colorGrade,
        text_style: settings.textStyle,
        aspect_ratio: seedGeneration.aspectRatio,
        target_duration: seedGeneration.durationSeconds || 15,
        campaign_id: seedGeneration.campaignId || undefined,
        // No callback_url - we use polling via GET endpoint instead
        // Script lines for subtitles (if available from original compose)
        script_lines: originalScriptLines && originalScriptLines.length > 0
          ? originalScriptLines.map(line => ({
              text: line.text,
              timing: line.timing,
              duration: line.duration,
            }))
          : undefined,
        // Original image URLs for 70/30 split (70% original + 30% new search)
        original_image_urls: originalImageUrls.length > 0 ? originalImageUrls : undefined,
      };
    });

    console.log(`[Compose Variations] Submitting ${autoComposeRequests.length} jobs to /api/v1/compose/auto`);
    console.log(`[Compose Variations] Search tags: ${searchTags.join(", ")}`);
    console.log(`[Compose Variations] Original images for 70/30 split: ${originalImageUrls.length}`);

    // Submit each job to auto-compose endpoint (EC2 handles image search internally)
    try {
      const submitResults = await Promise.all(
        autoComposeRequests.map(async (request, index) => {
          const genData = createdGenerations[index];
          try {
            const response = await submitAutoCompose(request);
            console.log(`[Compose Variations] Submitted ${request.job_id} to auto-compose: ${response.message}`);
            return { success: true, job_id: request.job_id, call_id: request.job_id, genData };
          } catch (err) {
            console.error(`[Compose Variations] Failed to submit ${request.job_id}:`, err);
            return { success: false, job_id: request.job_id, error: err, genData };
          }
        })
      );

      // Update all generations with their status
      await Promise.all(
        submitResults.map(async (result) => {
          if (result.success && result.call_id) {
            await prisma.videoGeneration.update({
              where: { id: result.job_id },
              data: {
                status: "PROCESSING",
                qualityMetadata: {
                  batchId,
                  seedGenerationId,
                  variationType: "compose_variation",
                  modalCallId: result.call_id, // job_id is used as call_id for auto-compose
                  createdAt: new Date().toISOString(),
                  searchTags,
                  settings: {
                    effectPreset: result.genData.settings.effectPreset,
                    colorGrade: result.genData.settings.colorGrade,
                    textStyle: result.genData.settings.textStyle,
                    vibe: result.genData.settings.vibe,
                    stylePresetId: result.genData.settings.stylePresetId || null,
                  },
                } as Prisma.InputJsonValue,
              },
            });
          } else {
            // Mark failed submissions
            await prisma.videoGeneration.update({
              where: { id: result.job_id },
              data: {
                status: "FAILED",
                progress: 100,
                errorMessage: result.error instanceof Error ? result.error.message : "Failed to submit auto-compose job",
              },
            });
          }
        })
      );

      const successCount = submitResults.filter(r => r.success).length;
      const failCount = submitResults.filter(r => !r.success).length;
      console.log(`[Compose Variations] Submitted ${successCount} jobs successfully, ${failCount} failed`);

      if (successCount === 0) {
        throw new Error("All auto-compose job submissions failed");
      }
    } catch (error) {
      console.error(`[Compose Variations] Submit failed:`, error);
      // Mark all as failed if not already updated
      await Promise.all(
        createdGenerations.map(({ generation }) =>
          prisma.videoGeneration.update({
            where: { id: generation.id },
            data: {
              status: "FAILED",
              progress: 100,
              errorMessage: error instanceof Error ? error.message : "Failed to start auto-compose",
            },
          }).catch(() => {}) // Ignore if already updated
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

    // Find compose variations - by batch_id if provided, otherwise by seedGenerationId
    // This allows recovery of variations when session state is lost
    const generations = await prisma.videoGeneration.findMany({
      where: {
        deletedAt: null,
        ...(batchId
          ? {
              qualityMetadata: {
                path: ["batchId"],
                equals: batchId,
              },
            }
          : {
              qualityMetadata: {
                path: ["seedGenerationId"],
                equals: seedGenerationId,
              },
            }),
      },
      include: {
        audioAsset: {
          select: { id: true, filename: true, s3Url: true, originalFilename: true },
        },
      },
      orderBy: { createdAt: "desc" }, // Most recent first when querying by seedGenerationId
    });

    if (generations.length === 0) {
      return NextResponse.json({
        detail: batchId
          ? "Compose variation batch not found"
          : "No variations found for this generation",
        batch_id: batchId,
        seed_generation_id: seedGenerationId,
        variations: [],
        total: 0,
      }, { status: 200 }); // Return empty array instead of 404 for better UX
    }

    // Check EC2 server status for PROCESSING jobs to update progress
    // This is the polling mechanism - frontend calls GET periodically to check status
    const updatedGenerations = await Promise.all(
      generations.map(async (gen) => {
        // If already completed or failed, return as-is
        if (gen.status === "COMPLETED" || gen.status === "FAILED") {
          return gen;
        }

        const metadata = gen.qualityMetadata as Record<string, unknown> | null;
        const callId = metadata?.modalCallId as string | undefined;

        // For PROCESSING or PENDING jobs, poll EC2 server for status
        if (callId && (gen.status === "PROCESSING" || gen.status === "PENDING")) {
          try {
            const serverStatus = await getComposeRenderStatus(callId);
            console.log(`[Compose Variations] Polling EC2 for ${gen.id}:`, {
              ec2Status: serverStatus.status,
              hasResult: !!serverStatus.result,
              outputUrl: serverStatus.result?.output_url ? 'present' : 'missing',
              error: serverStatus.error,
            });

            if (serverStatus.status === "completed") {
              const outputUrl = serverStatus.result?.output_url;
              if (outputUrl) {
                // Update to COMPLETED with output URL
                console.log(`[Compose Variations] Job ${gen.id} COMPLETED with URL: ${outputUrl.substring(0, 80)}...`);
                await prisma.videoGeneration.update({
                  where: { id: gen.id },
                  data: {
                    status: "COMPLETED",
                    progress: 100,
                    composedOutputUrl: outputUrl,
                    outputUrl: outputUrl,
                  },
                });
                return {
                  ...gen,
                  status: "COMPLETED" as const,
                  progress: 100,
                  composedOutputUrl: outputUrl,
                  outputUrl: outputUrl,
                };
              } else {
                // EC2 says completed but no output_url - this is an error state
                console.error(`[Compose Variations] Job ${gen.id} marked completed but no output_url!`);
                await prisma.videoGeneration.update({
                  where: { id: gen.id },
                  data: {
                    status: "FAILED",
                    progress: 100,
                    errorMessage: "Render completed but no output URL returned",
                  },
                });
                return { ...gen, status: "FAILED" as const, progress: 100, errorMessage: "Render completed but no output URL returned" };
              }
            } else if (serverStatus.status === "failed") {
              const errorMsg = serverStatus.error || serverStatus.result?.error || "Render failed";
              console.log(`[Compose Variations] Job ${gen.id} FAILED: ${errorMsg}`);
              await prisma.videoGeneration.update({
                where: { id: gen.id },
                data: {
                  status: "FAILED",
                  progress: 100,
                  errorMessage: errorMsg,
                },
              });
              return { ...gen, status: "FAILED" as const, progress: 100, errorMessage: errorMsg };
            } else if (serverStatus.status === "processing") {
              // Still processing - update progress to show activity
              const newProgress = Math.max(gen.progress, 30);
              if (newProgress !== gen.progress) {
                await prisma.videoGeneration.update({
                  where: { id: gen.id },
                  data: { progress: newProgress, status: "PROCESSING" },
                });
                return { ...gen, progress: newProgress, status: "PROCESSING" as const };
              }
            }
          } catch (err) {
            console.error(`[Compose Variations] Failed to poll EC2 status for ${gen.id}:`, err);
            // Continue with DB values on error - don't fail the request
          }
        } else if (!callId && gen.status === "PROCESSING") {
          console.warn(`[Compose Variations] Job ${gen.id} is PROCESSING but has no modalCallId - cannot poll EC2`);
        }

        return gen;
      })
    );

    // Calculate batch status
    const statuses = updatedGenerations.map((g) => g.status);
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
      updatedGenerations.reduce((sum, g) => sum + g.progress, 0) / updatedGenerations.length
    );

    // Format response to match VariationsBatchStatus interface
    // Convert S3 URLs to presigned URLs for browser access (bucket blocks public access)
    const variations = await Promise.all(updatedGenerations.map(async (gen) => {
      const metadata = gen.qualityMetadata as Record<string, unknown> | null;
      const rawOutputUrl = gen.composedOutputUrl || gen.outputUrl || undefined;

      // Convert direct S3 URL to presigned URL for browser access
      let outputUrl: string | undefined;
      if (rawOutputUrl) {
        try {
          outputUrl = await getPresignedUrlFromS3Url(rawOutputUrl);
        } catch (err) {
          console.error(`[Compose Variations] Failed to generate presigned URL for ${gen.id}:`, err);
          outputUrl = rawOutputUrl; // Fall back to raw URL
        }
      }

      // Debug log for each variation
      console.log(`[Compose Variations] Response for ${gen.id}:`, {
        status: gen.status,
        hasComposedOutputUrl: !!gen.composedOutputUrl,
        hasOutputUrl: !!gen.outputUrl,
        presignedUrl: outputUrl ? 'generated' : 'missing',
      });

      return {
        id: gen.id,
        variation_label: (metadata?.variationLabel as string) || "",
        status: gen.status as "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
        progress: gen.progress,
        output_url: outputUrl,
        thumbnail_url: undefined, // Compose videos don't have separate thumbnails
        error_message: gen.errorMessage || undefined,
      };
    }));

    // Extract batchId from first generation if not provided in query
    const resolvedBatchId = batchId ||
      ((updatedGenerations[0]?.qualityMetadata as Record<string, unknown>)?.batchId as string) ||
      null;

    console.log(`[Compose Variations] Returning ${variations.length} variations, ${completedCount} completed with URLs`);

    return NextResponse.json({
      batch_id: resolvedBatchId,
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
