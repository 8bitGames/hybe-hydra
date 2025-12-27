import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Backend compose-engine URL
const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || "http://15.164.236.53:8000";

interface ComposeEngineStatusResponse {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  current_step?: string;
  output_url?: string;
  error?: string;
  metadata?: {
    generation_id?: string;
    gcs_uri?: string;
    extension_count?: number;
    source_gcs_uri?: string;
    original_generation_id?: string;
  };
  is_final: boolean;
}

/**
 * POST /api/v1/ai/jobs/[id]/poll
 *
 * Poll AI job status from compose-engine and update database.
 * This provides reliable status updates without depending on callbacks.
 *
 * Use this endpoint for:
 * - Video generation status
 * - Image-to-video status
 * - Video extension status
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: jobId } = await params;

    console.log(`[AI Job Poll] Checking status for job ${jobId}`);

    // Find generation with this job ID (vertexRequestId)
    const generation = await prisma.videoGeneration.findFirst({
      where: {
        OR: [
          { vertexRequestId: jobId },
          { id: jobId },
        ],
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Job not found" }, { status: 404 });
    }

    // If already completed or failed in DB, check if we need to recover gcsUri
    if (generation.status === "COMPLETED" || generation.status === "FAILED") {
      // If gcsUri is missing for a completed video, try to recover it from backend
      if (generation.status === "COMPLETED" && !generation.gcsUri) {
        console.log(`[AI Job Poll] Completed video missing gcsUri, attempting recovery for ${jobId}`);
        try {
          const recoveryResponse = await fetch(
            `${COMPOSE_ENGINE_URL}/api/v1/ai/job/${jobId}/status`,
            { method: "GET", headers: { "Content-Type": "application/json" } }
          );

          if (recoveryResponse.ok) {
            const recoveryData: ComposeEngineStatusResponse = await recoveryResponse.json();
            if (recoveryData.metadata?.gcs_uri) {
              console.log(`[AI Job Poll] Recovered gcsUri: ${recoveryData.metadata.gcs_uri.slice(0, 60)}...`);
              await prisma.videoGeneration.update({
                where: { id: generation.id },
                data: { gcsUri: recoveryData.metadata.gcs_uri },
              });
              return NextResponse.json({
                job_id: jobId,
                generation_id: generation.id,
                status: generation.status.toLowerCase(),
                output_url: generation.composedOutputUrl || generation.outputUrl,
                gcs_uri: recoveryData.metadata.gcs_uri,
                progress: generation.progress,
                is_final: true,
              });
            }
          }
        } catch (recoveryError) {
          console.warn(`[AI Job Poll] Failed to recover gcsUri: ${recoveryError}`);
        }
      }

      return NextResponse.json({
        job_id: jobId,
        generation_id: generation.id,
        status: generation.status.toLowerCase(),
        output_url: generation.composedOutputUrl || generation.outputUrl,
        gcs_uri: generation.gcsUri,
        progress: generation.progress,
        is_final: true,
      });
    }

    // Poll compose-engine for job status
    console.log(`[AI Job Poll] Polling compose-engine for job ${jobId}`);

    try {
      const backendResponse = await fetch(
        `${COMPOSE_ENGINE_URL}/api/v1/ai/job/${jobId}/status`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (backendResponse.ok) {
        const backendData: ComposeEngineStatusResponse = await backendResponse.json();
        console.log(`[AI Job Poll] Backend response:`, {
          status: backendData.status,
          progress: backendData.progress,
          is_final: backendData.is_final,
          has_metadata: !!backendData.metadata,
        });

        // Update DB based on backend status
        if (backendData.is_final) {
          const dbStatus = backendData.status === "completed" ? "COMPLETED" : "FAILED";

          // Build update data
          const updateData: Record<string, unknown> = {
            status: dbStatus,
            progress: backendData.progress || 100,
            updatedAt: new Date(),
          };

          // Add output URL if present
          if (backendData.output_url) {
            updateData.composedOutputUrl = backendData.output_url;
          }

          // Add error message if failed
          if (backendData.error) {
            updateData.errorMessage = backendData.error;
          }

          // Add metadata fields (gcs_uri, extension_count)
          if (backendData.metadata) {
            if (backendData.metadata.gcs_uri) {
              updateData.gcsUri = backendData.metadata.gcs_uri;
            }
            if (typeof backendData.metadata.extension_count === "number") {
              updateData.extensionCount = backendData.metadata.extension_count;
            }
          }

          // Update the database
          await prisma.videoGeneration.update({
            where: { id: generation.id },
            data: updateData,
          });

          console.log(`[AI Job Poll] Updated generation ${generation.id} to ${dbStatus}`);

          return NextResponse.json({
            job_id: jobId,
            generation_id: generation.id,
            status: backendData.status,
            output_url: backendData.output_url,
            gcs_uri: backendData.metadata?.gcs_uri,
            progress: backendData.progress || 100,
            is_final: true,
          });
        }

        // Job still processing - update progress in DB
        if (backendData.progress && backendData.progress !== generation.progress) {
          await prisma.videoGeneration.update({
            where: { id: generation.id },
            data: {
              progress: backendData.progress,
              updatedAt: new Date(),
            },
          });
        }

        return NextResponse.json({
          job_id: jobId,
          generation_id: generation.id,
          status: backendData.status || "processing",
          output_url: null,
          progress: backendData.progress || generation.progress || 0,
          current_step: backendData.current_step,
          is_final: false,
        });
      }

      // Backend returned error (e.g., 404 - job not in queue anymore)
      if (backendResponse.status === 404) {
        console.log(`[AI Job Poll] Job ${jobId} not found in backend queue`);
        // Job might have expired from queue - return current DB status
      }
    } catch (backendError) {
      console.error(`[AI Job Poll] Backend poll failed:`, backendError);
      // Fall through to return current DB status
    }

    // Return current status from DB if backend poll failed
    const currentProgress = generation.progress || 0;

    return NextResponse.json({
      job_id: jobId,
      generation_id: generation.id,
      status: "processing",
      output_url: null,
      progress: currentProgress,
      is_final: false,
    });
  } catch (error) {
    console.error("[AI Job Poll] Error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/v1/ai/jobs/[id]/poll
 *
 * Same as POST but for GET requests (convenience method)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return POST(request, { params });
}
