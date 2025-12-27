import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Configuration
const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || "http://localhost:8000";

/**
 * POST /api/v1/generations/[id]/extend
 *
 * Extend an AI-generated video by up to 7 seconds using Veo 3.1.
 *
 * Requirements:
 * - The generation must be completed and have a GCS URI
 * - Maximum 20 extensions per video
 * - Only works with AI-generated videos (not Compose)
 */
// Helper function to get app base URL (consistent with ai-client.ts)
function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://hydra.ai.kr";
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Get the generation to extend
    const generation = await prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check if soft-deleted
    if (generation.deletedAt) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Validate: Must be completed
    if (generation.status !== "COMPLETED") {
      return NextResponse.json(
        { detail: "Can only extend completed generations" },
        { status: 400 }
      );
    }

    // Validate: Must be AI type (not Compose)
    if (generation.generationType !== "AI") {
      return NextResponse.json(
        { detail: "Can only extend AI-generated videos (not Compose)" },
        { status: 400 }
      );
    }

    // Validate: Must have GCS URI
    if (!generation.gcsUri) {
      return NextResponse.json(
        { detail: "This video cannot be extended - no GCS URI available. Only videos generated with Veo can be extended." },
        { status: 400 }
      );
    }

    // Validate: Extension count limit
    const extensionCount = generation.extensionCount || 0;
    if (extensionCount >= 20) {
      return NextResponse.json(
        { detail: "Maximum extension limit (20) reached for this video" },
        { status: 400 }
      );
    }

    // Parse request body for optional prompt and audio settings
    const body = await request.json().catch(() => ({}));
    const { prompt, apply_audio_after, audio_asset_id } = body as {
      prompt?: string;
      apply_audio_after?: boolean;
      audio_asset_id?: string;
    };

    // Get audio asset URL if audio overlay is requested
    let audioAssetUrl: string | undefined;
    const effectiveAudioAssetId = audio_asset_id || generation.audioAssetId;
    if (apply_audio_after && effectiveAudioAssetId) {
      const audioAsset = await prisma.asset.findUnique({
        where: { id: effectiveAudioAssetId },
        select: { s3Url: true },
      });
      if (audioAsset?.s3Url) {
        audioAssetUrl = audioAsset.s3Url;
      }
    }

    // Generate job ID
    const jobId = uuidv4();

    // Create S3 output path
    const s3Bucket = process.env.AWS_S3_BUCKET || "hydra-compose";
    const s3Key = `generations/${generation.campaignId || "quick"}/${jobId}/extended.mp4`;

    // Create new generation record for the extended video
    const extendedGeneration = await prisma.videoGeneration.create({
      data: {
        campaignId: generation.campaignId,
        projectId: generation.projectId,
        isQuickCreate: generation.isQuickCreate,
        generationType: "AI",
        prompt: prompt || generation.prompt,
        negativePrompt: generation.negativePrompt,
        durationSeconds: generation.durationSeconds + 7, // Extended by 7 seconds
        aspectRatio: generation.aspectRatio,
        status: "PROCESSING",
        progress: 0,
        // Track extension lineage
        extensionCount: extensionCount + 1,
        // Copy audio asset for future reference
        audioAssetId: effectiveAudioAssetId || null,
        // Copy relevant metadata
        originalInput: generation.originalInput,
        trendKeywords: generation.trendKeywords,
        createdBy: user.id,
      },
    });

    // Create extension history record for tracking lineage
    await prisma.videoExtensionHistory.create({
      data: {
        sourceGenerationId: generation.id,
        extendedGenerationId: extendedGeneration.id,
        extensionNumber: extensionCount + 1,
        prompt: prompt || null,
        durationBefore: generation.durationSeconds,
        durationAfter: generation.durationSeconds + 7,
        createdBy: user.id,
      },
    });

    // Call compose engine to extend the video
    const composeEngineRequest: Record<string, unknown> = {
      job_id: jobId,
      job_type: "video_extend",
      extend_settings: {
        source_gcs_uri: generation.gcsUri,
        prompt: prompt || undefined,
        aspect_ratio: generation.aspectRatio,
        extension_count: extensionCount,
        // Audio overlay settings
        audio_overlay: audioAssetUrl ? {
          audio_url: audioAssetUrl,
          audio_start_time: generation.audioStartTime || 0,
          audio_volume: 1.0,
          fade_in: 0.5,
          fade_out: 0.5,
          mix_original_audio: false,
        } : undefined,
      },
      output: {
        s3_bucket: s3Bucket,
        s3_key: s3Key,
        gcs_bucket: process.env.GCS_OUTPUT_BUCKET || "hyb-hydra-dev-ai-output",
      },
      callback_url: `${getAppBaseUrl()}/api/v1/jobs/callback`,
      callback_secret: process.env.JOB_CALLBACK_SECRET,
      metadata: {
        generation_id: extendedGeneration.id,
        original_generation_id: generation.id,
        extension_number: extensionCount + 1,
        user_id: user.id,
      },
    };

    // Submit to compose engine
    const composeResponse = await fetch(`${COMPOSE_ENGINE_URL}/api/v1/ai/video/extend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(composeEngineRequest),
    });

    if (!composeResponse.ok) {
      const errorText = await composeResponse.text();
      console.error("Compose engine error:", errorText);

      // Mark the generation as failed
      await prisma.videoGeneration.update({
        where: { id: extendedGeneration.id },
        data: {
          status: "FAILED",
          errorMessage: `Failed to start extension: ${errorText.slice(0, 200)}`,
        },
      });

      return NextResponse.json(
        { detail: "Failed to start video extension", error: errorText },
        { status: 500 }
      );
    }

    const composeResult = await composeResponse.json();

    // Update the generation with job info
    await prisma.videoGeneration.update({
      where: { id: extendedGeneration.id },
      data: {
        vertexRequestId: jobId,
      },
    });

    return NextResponse.json({
      id: extendedGeneration.id,
      job_id: jobId,
      original_generation_id: generation.id,
      status: "processing",
      message: `Video extension started (extension #${extensionCount + 1})`,
      extension_info: {
        current_extension_count: extensionCount + 1,
        max_extensions: 20,
        remaining_extensions: 20 - (extensionCount + 1),
        estimated_duration_seconds: generation.durationSeconds + 7,
      },
    });
  } catch (error) {
    console.error("Extend video error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/generations/[id]/extend
 *
 * Get extension info for a generation.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const generation = await prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // If gcsUri is missing for a completed AI video, try to recover it from backend
    let gcsUri = generation.gcsUri;
    if (generation.status === "COMPLETED" && generation.generationType === "AI" && !gcsUri) {
      console.log(`[Extend Info] Attempting to recover gcsUri for ${generation.id}`);
      try {
        const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || "http://15.164.236.53:8000";
        const recoveryResponse = await fetch(
          `${COMPOSE_ENGINE_URL}/api/v1/ai/job/${generation.id}/status`,
          { method: "GET", headers: { "Content-Type": "application/json" } }
        );

        if (recoveryResponse.ok) {
          const recoveryData = await recoveryResponse.json();
          if (recoveryData.metadata?.gcs_uri) {
            console.log(`[Extend Info] Recovered gcsUri: ${recoveryData.metadata.gcs_uri.slice(0, 60)}...`);
            gcsUri = recoveryData.metadata.gcs_uri;
            // Update database with recovered gcsUri
            await prisma.videoGeneration.update({
              where: { id: generation.id },
              data: { gcsUri },
            });
          }
        }
      } catch (recoveryError) {
        console.warn(`[Extend Info] Failed to recover gcsUri: ${recoveryError}`);
      }
    }

    const extensionCount = generation.extensionCount || 0;
    const canExtend =
      generation.status === "COMPLETED" &&
      generation.generationType === "AI" &&
      !!gcsUri &&
      extensionCount < 20;

    return NextResponse.json({
      id: generation.id,
      can_extend: canExtend,
      // Include original prompt for continuation context
      original_prompt: generation.prompt,
      negative_prompt: generation.negativePrompt,
      duration_seconds: generation.durationSeconds,
      aspect_ratio: generation.aspectRatio,
      // Include audio info for post-extension overlay
      audio_asset_id: generation.audioAssetId,
      extension_info: {
        current_extension_count: extensionCount,
        max_extensions: 20,
        remaining_extensions: Math.max(0, 20 - extensionCount),
        has_gcs_uri: !!gcsUri,
        is_ai_generated: generation.generationType === "AI",
        is_completed: generation.status === "COMPLETED",
      },
      reasons_cannot_extend: !canExtend ? {
        not_completed: generation.status !== "COMPLETED",
        not_ai_generated: generation.generationType !== "AI",
        no_gcs_uri: !gcsUri,
        max_extensions_reached: extensionCount >= 20,
      } : null,
    });
  } catch (error) {
    console.error("Get extend info error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
