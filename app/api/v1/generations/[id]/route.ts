import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { VideoGenerationStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Compose Engine URL for fallback status check
const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || "http://localhost:8000";

// Compose Engine job status response
interface ComposeEngineJobStatus {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  current_step?: string;
  output_url?: string;
  error?: string;
  metadata?: {
    gcs_uri?: string;
    extension_count?: number;
  };
}

/**
 * Fallback: Check job status directly from Compose Engine
 * This is used when callback fails and DB is stuck in PROCESSING state
 */
async function checkComposeEngineStatus(jobId: string): Promise<ComposeEngineJobStatus | null> {
  try {
    const response = await fetch(`${COMPOSE_ENGINE_URL}/api/v1/ai/job/${jobId}/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // Short timeout to avoid blocking
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[Fallback] Failed to check Compose Engine status for ${jobId}:`, error);
    return null;
  }
}

/**
 * Sync generation status from Compose Engine to database
 * Called when generation is stuck in PROCESSING state
 */
async function syncStatusFromComposeEngine(
  generationId: string,
  jobId: string
): Promise<{ synced: boolean; status?: string; outputUrl?: string }> {
  const engineStatus = await checkComposeEngineStatus(jobId);

  if (!engineStatus) {
    return { synced: false };
  }

  // Only sync if Compose Engine shows completed or failed
  if (engineStatus.status === "completed" && engineStatus.output_url) {
    console.log(`[Fallback] Syncing completed status for ${generationId} from Compose Engine`);

    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        status: "COMPLETED",
        progress: 100,
        composedOutputUrl: engineStatus.output_url,
        gcsUri: engineStatus.metadata?.gcs_uri || null,
        updatedAt: new Date(),
      },
    });

    return { synced: true, status: "completed", outputUrl: engineStatus.output_url };
  } else if (engineStatus.status === "failed") {
    console.log(`[Fallback] Syncing failed status for ${generationId} from Compose Engine`);

    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        status: "FAILED",
        progress: 100,
        errorMessage: engineStatus.error || "Job failed",
        updatedAt: new Date(),
      },
    });

    return { synced: true, status: "failed" };
  }

  // Still processing - update progress if available
  if (engineStatus.progress > 0) {
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        progress: engineStatus.progress,
        updatedAt: new Date(),
      },
    });
  }

  return { synced: false };
}

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
        referenceImage: {
          select: { id: true, filename: true, s3Url: true },
        },
        outputAsset: {
          select: { id: true, filename: true, s3Url: true },
        },
        audioAsset: {
          select: { id: true, filename: true, s3Url: true, originalFilename: true },
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

    // RBAC check - Quick Create generations (no campaign) are accessible by their creator
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Fallback: If status is PROCESSING and we have a job ID, check Compose Engine directly
    // This handles cases where callback failed but the job actually completed
    let finalStatus = generation.status;
    let finalProgress = generation.progress;
    let finalOutputUrl = generation.composedOutputUrl;
    let finalErrorMessage = generation.errorMessage;

    if (generation.status === "PROCESSING" && generation.vertexRequestId) {
      const syncResult = await syncStatusFromComposeEngine(
        generation.id,
        generation.vertexRequestId
      );

      if (syncResult.synced) {
        // Update local variables with synced data
        if (syncResult.status === "completed") {
          finalStatus = "COMPLETED" as VideoGenerationStatus;
          finalProgress = 100;
          finalOutputUrl = syncResult.outputUrl || finalOutputUrl;
        } else if (syncResult.status === "failed") {
          finalStatus = "FAILED" as VideoGenerationStatus;
          finalProgress = 100;
        }
      }
    }

    return NextResponse.json({
      id: generation.id,
      campaign_id: generation.campaignId,
      prompt: generation.prompt,
      negative_prompt: generation.negativePrompt,
      duration_seconds: generation.durationSeconds,
      aspect_ratio: generation.aspectRatio,
      reference_image_id: generation.referenceImageId,
      reference_style: generation.referenceStyle,
      // Audio fields
      audio_asset_id: generation.audioAssetId,
      audio_analysis: generation.audioAnalysis,
      audio_start_time: generation.audioStartTime,
      audio_duration: generation.audioDuration,
      composed_output_url: finalOutputUrl,
      status: finalStatus.toLowerCase(),
      progress: finalProgress,
      error_message: finalErrorMessage,
      vertex_operation_name: generation.vertexOperationName,
      vertex_request_id: generation.vertexRequestId,
      output_asset_id: generation.outputAssetId,
      output_url: generation.outputUrl,
      extension_count: generation.extensionCount || 0,
      gcs_uri: generation.gcsUri,
      quality_score: generation.qualityScore,
      quality_metadata: generation.qualityMetadata,
      // Bridge context fields
      original_input: generation.originalInput,
      trend_keywords: generation.trendKeywords,
      reference_urls: generation.referenceUrls,
      prompt_analysis: generation.promptAnalysis,
      is_favorite: generation.isFavorite,
      tags: generation.tags,
      created_by: generation.createdBy,
      created_at: generation.createdAt.toISOString(),
      updated_at: generation.updatedAt.toISOString(),
      reference_image: generation.referenceImage
        ? {
            id: generation.referenceImage.id,
            filename: generation.referenceImage.filename,
            s3_url: generation.referenceImage.s3Url,
          }
        : null,
      output_asset: generation.outputAsset
        ? {
            id: generation.outputAsset.id,
            filename: generation.outputAsset.filename,
            s3_url: generation.outputAsset.s3Url,
          }
        : null,
      audio_asset: generation.audioAsset
        ? {
            id: generation.audioAsset.id,
            filename: generation.audioAsset.filename,
            original_filename: generation.audioAsset.originalFilename,
            s3_url: generation.audioAsset.s3Url,
          }
        : null,
    });
  } catch (error) {
    console.error("Get generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const existingGeneration = await prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    });

    if (!existingGeneration) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (existingGeneration.campaign) {
        if (!user.labelIds.includes(existingGeneration.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (existingGeneration.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const {
      status,
      progress,
      error_message,
      output_url,
      quality_score,
      quality_metadata,
      tiktok_seo,
      tags,
      is_favorite,
    } = body;

    const generation = await prisma.videoGeneration.update({
      where: { id },
      data: {
        ...(status && { status: status.toUpperCase() as VideoGenerationStatus }),
        ...(progress !== undefined && { progress }),
        ...(error_message !== undefined && { errorMessage: error_message }),
        ...(output_url && { outputUrl: output_url }),
        ...(quality_score !== undefined && { qualityScore: quality_score }),
        ...(quality_metadata && { qualityMetadata: quality_metadata }),
        ...(tiktok_seo !== undefined && { tiktokSEO: tiktok_seo }),
        ...(tags !== undefined && { tags }),
        ...(is_favorite !== undefined && { isFavorite: is_favorite }),
      },
      include: {
        referenceImage: {
          select: { id: true, filename: true, s3Url: true },
        },
        outputAsset: {
          select: { id: true, filename: true, s3Url: true },
        },
      },
    });

    return NextResponse.json({
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
      error_message: generation.errorMessage,
      vertex_operation_name: generation.vertexOperationName,
      vertex_request_id: generation.vertexRequestId,
      output_asset_id: generation.outputAssetId,
      output_url: generation.outputUrl,
      quality_score: generation.qualityScore,
      quality_metadata: generation.qualityMetadata,
      created_by: generation.createdBy,
      created_at: generation.createdAt.toISOString(),
      updated_at: generation.updatedAt.toISOString(),
      reference_image: generation.referenceImage
        ? {
            id: generation.referenceImage.id,
            filename: generation.referenceImage.filename,
            s3_url: generation.referenceImage.s3Url,
          }
        : null,
      output_asset: generation.outputAsset
        ? {
            id: generation.outputAsset.id,
            filename: generation.outputAsset.filename,
            s3_url: generation.outputAsset.s3Url,
          }
        : null,
    });
  } catch (error) {
    console.error("Update generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Check for force delete query param
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

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
      // If not found and force=true, return success (idempotent delete)
      if (force) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        // Quick Create - only owner can delete
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // With force=true, allow deletion of any status
    // Without force, can only delete pending, failed, or cancelled generations
    const allowedStatuses = ["PENDING", "FAILED", "CANCELLED"];

    if (!force && !allowedStatuses.includes(generation.status)) {
      // Check if it's a stuck PROCESSING (older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const isStuck = generation.status === "PROCESSING" && generation.updatedAt < oneHourAgo;

      // Check if it's an orphaned COMPLETED (no output)
      const isOrphaned = generation.status === "COMPLETED" &&
        !generation.outputUrl && !generation.composedOutputUrl;

      if (!isStuck && !isOrphaned) {
        return NextResponse.json(
          {
            detail: "Cannot delete generation in current status. Use ?force=true to force delete.",
            status: generation.status,
            hint: "For stuck processing jobs, use the cleanup API or add ?force=true"
          },
          { status: 400 }
        );
      }
    }

    // Soft delete - set deletedAt timestamp instead of actual deletion
    await prisma.videoGeneration.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
