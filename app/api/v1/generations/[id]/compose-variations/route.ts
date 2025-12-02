import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Extract 2-3 key tags from a prompt for image search variation
function extractVariationTags(prompt: string): string[] {
  // Remove common filler words and extract meaningful keywords
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "video", "image",
    "photo", "picture", "style", "aesthetic", "vibe", "mood", "feeling",
    "generation", "create", "make", "show", "display", "featuring",
  ]);

  // Clean and split the prompt
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Get unique words and prioritize longer/more specific ones
  const uniqueWords = [...new Set(words)]
    .sort((a, b) => b.length - a.length);

  // Return 2-3 most meaningful tags
  return uniqueWords.slice(0, 3);
}

// Generate variation search queries from base tags
function generateVariationQueries(baseTags: string[], variationCount: number): string[][] {
  const variations: string[][] = [];

  // Original combination
  variations.push(baseTags);

  // If we have 3 tags, create variations with 2 tags each
  if (baseTags.length >= 3) {
    variations.push([baseTags[0], baseTags[1]]);
    variations.push([baseTags[0], baseTags[2]]);
    variations.push([baseTags[1], baseTags[2]]);
  }

  // If we have 2 tags, try each individually with style modifiers
  if (baseTags.length >= 2) {
    variations.push([baseTags[0], "aesthetic"]);
    variations.push([baseTags[1], "aesthetic"]);
  }

  // Limit to requested count
  return variations.slice(0, variationCount);
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
    const {
      max_variations = 4,
      vibe_variations = ["Exciting", "Emotional", "Pop", "Minimal"], // Different vibe presets
      auto_publish, // Auto-publish configuration
    } = body;

    // Extract base tags from original prompt (2-3 tags)
    const baseTags = extractVariationTags(seedGeneration.prompt);

    if (baseTags.length === 0) {
      return NextResponse.json(
        { detail: "Could not extract meaningful tags from the original prompt" },
        { status: 400 }
      );
    }

    // Generate variation search queries
    const variationQueries = generateVariationQueries(baseTags, max_variations);

    // Get original compose metadata
    const originalMetadata = seedGeneration.qualityMetadata as Record<string, unknown> | null;
    const originalComposeData = originalMetadata?.composeData as Record<string, unknown> | null;

    // Create batch ID
    const batchId = uuidv4();

    // Create placeholder generations for each variation
    const createdGenerations = await Promise.all(
      variationQueries.map(async (tags, index) => {
        const vibePreset = vibe_variations[index % vibe_variations.length];
        const searchQuery = tags.join(" ");
        const variationLabel = `${vibePreset} - "${searchQuery}"`;

        // Create the generation placeholder
        const generation = await prisma.videoGeneration.create({
          data: {
            id: `compose-var-${uuidv4()}`,
            campaignId: seedGeneration.campaignId,
            prompt: `Compose variation: ${searchQuery} (${vibePreset})`,
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
              searchTags: tags,
              vibePreset,
              originalPrompt: seedGeneration.prompt,
              originalComposeData: originalComposeData as Prisma.InputJsonValue | null,
              // Auto-publish settings for scheduling on completion
              autoPublish: auto_publish ? {
                enabled: true,
                socialAccountId: auto_publish.social_account_id,
                intervalMinutes: auto_publish.interval_minutes || 30,
                caption: auto_publish.caption || "",
                hashtags: auto_publish.hashtags || [],
                variationIndex: index, // For calculating scheduled time offset
              } : null,
            } as Prisma.InputJsonValue,
          },
        });

        return {
          generation,
          variationLabel,
          searchTags: tags,
          vibePreset,
        };
      })
    );

    // Trigger compose-engine for each variation (async)
    // This would call the compose-engine API to search images and render
    const composeEngineUrl = process.env.COMPOSE_ENGINE_URL || "http://localhost:8001";

    // Start background jobs for each variation
    createdGenerations.forEach(async ({ generation, searchTags, vibePreset }) => {
      try {
        // Update to processing
        await prisma.videoGeneration.update({
          where: { id: generation.id },
          data: { status: "PROCESSING", progress: 10 },
        });

        // Call compose-engine to search and render
        const response = await fetch(`${composeEngineUrl}/api/v1/compose/auto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: generation.id,
            search_query: searchTags.join(" "),
            search_tags: searchTags,
            audio_url: seedGeneration.audioAsset?.s3Url,
            vibe: vibePreset,
            aspect_ratio: seedGeneration.aspectRatio,
            target_duration: seedGeneration.durationSeconds,
            campaign_id: seedGeneration.campaignId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Compose engine error: ${response.status}`);
        }
      } catch (error) {
        console.error(`Failed to start compose variation ${generation.id}:`, error);
        await prisma.videoGeneration.update({
          where: { id: generation.id },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: error instanceof Error ? error.message : "Failed to start compose job",
          },
        });
      }
    });

    // Format response
    const variations = createdGenerations.map(({ generation, variationLabel, searchTags, vibePreset }) => ({
      id: generation.id,
      variation_label: variationLabel,
      search_tags: searchTags,
      vibe_preset: vibePreset,
      status: "pending",
    }));

    return NextResponse.json(
      {
        seed_generation_id: seedGenerationId,
        batch_id: batchId,
        total_count: variations.length,
        base_tags: baseTags,
        variations,
        message: `Created ${variations.length} compose variations with tags: ${baseTags.join(", ")}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create compose variations error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
