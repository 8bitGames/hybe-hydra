import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Backend compose-engine URL
const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || "http://15.164.236.53:8000";

/**
 * Determine the job type from generation data
 */
function getJobType(generation: {
  generationType: string;
  qualityMetadata: unknown;
}): "ai_extend" | "video_edit" | "ai_generate" | "compose" {
  const metadata = generation.qualityMetadata as Record<string, unknown> | null;

  // Check for video edit job ID in metadata
  if (metadata?.videoEditJobId) {
    return "video_edit";
  }

  // Check for extension-related metadata
  if (metadata?.original_generation_id || metadata?.extension_number) {
    return "ai_extend";
  }

  // Check generation type
  if (generation.generationType === "COMPOSE") {
    return "compose";
  }

  return "ai_generate";
}

/**
 * Get the appropriate status endpoint URL for a job type
 */
function getStatusEndpoint(jobType: string, jobId: string): string {
  switch (jobType) {
    case "ai_extend":
    case "ai_generate":
      // AI jobs use the AI-specific status endpoint
      return `${COMPOSE_ENGINE_URL}/api/v1/ai/job/${jobId}/status`;
    case "video_edit":
    case "compose":
    default:
      // All other jobs use the general job queue status endpoint
      return `${COMPOSE_ENGINE_URL}/job/${jobId}/status`;
  }
}

// POST /api/v1/jobs/[id]/poll - Poll job status from backend and update DB
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: jobId } = await params;

    console.log(`[Job Poll] Checking status for job ${jobId}`);

    // Find generation with this job ID
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

    // If already completed or failed in DB, return current status
    if (generation.status === "COMPLETED" || generation.status === "FAILED") {
      return NextResponse.json({
        job_id: jobId,
        generation_id: generation.id,
        status: generation.status.toLowerCase(),
        output_url: generation.composedOutputUrl || generation.outputUrl,
        progress: generation.progress,
        is_final: true,
      });
    }

    // Determine job type for routing
    const jobType = getJobType(generation);
    console.log(`[Job Poll] Detected job type: ${jobType}`);

    // Get the actual job ID used in backend
    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const videoEditJobId = metadata?.videoEditJobId as string | undefined;
    const actualJobId = videoEditJobId || generation.vertexRequestId || jobId;

    // Get the appropriate status endpoint for this job type
    const statusEndpoint = getStatusEndpoint(jobType, actualJobId);
    console.log(`[Job Poll] Polling ${statusEndpoint}`);

    try {
      const backendResponse = await fetch(statusEndpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        console.log(`[Job Poll] Backend response:`, backendData);

        // Determine if job is final (some endpoints don't include is_final, infer from status)
        const isFinal = backendData.is_final ??
          (backendData.status === "completed" || backendData.status === "failed");

        // Update DB based on backend status
        if (isFinal) {
          const dbStatus = backendData.status === "completed" ? "COMPLETED" : "FAILED";

          await prisma.videoGeneration.update({
            where: { id: generation.id },
            data: {
              status: dbStatus,
              progress: backendData.progress || 100,
              composedOutputUrl: backendData.output_url || null,
              errorMessage: backendData.error || null,
              updatedAt: new Date(),
            },
          });

          console.log(`[Job Poll] Updated generation ${generation.id} to ${dbStatus}`);

          return NextResponse.json({
            job_id: jobId,
            generation_id: generation.id,
            status: backendData.status,
            output_url: backendData.output_url,
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

      // If first endpoint failed with 404, try the alternate endpoint as fallback
      if (backendResponse.status === 404) {
        console.log(`[Job Poll] Job ${actualJobId} not found at ${statusEndpoint}, trying fallback...`);

        // Try the general job queue endpoint as fallback
        const fallbackEndpoint = `${COMPOSE_ENGINE_URL}/job/${actualJobId}/status`;
        if (fallbackEndpoint !== statusEndpoint) {
          const fallbackResponse = await fetch(fallbackEndpoint, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log(`[Job Poll] Fallback response:`, fallbackData);

            // Infer is_final from status if not provided
            const isFinalFallback = fallbackData.is_final ??
              (fallbackData.status === "completed" || fallbackData.status === "failed");

            if (isFinalFallback) {
              const dbStatus = fallbackData.status === "completed" ? "COMPLETED" : "FAILED";
              await prisma.videoGeneration.update({
                where: { id: generation.id },
                data: {
                  status: dbStatus,
                  progress: fallbackData.progress || 100,
                  composedOutputUrl: fallbackData.output_url || null,
                  errorMessage: fallbackData.error || null,
                  updatedAt: new Date(),
                },
              });

              return NextResponse.json({
                job_id: jobId,
                generation_id: generation.id,
                status: fallbackData.status,
                output_url: fallbackData.output_url,
                progress: fallbackData.progress || 100,
                is_final: true,
              });
            }

            return NextResponse.json({
              job_id: jobId,
              generation_id: generation.id,
              status: fallbackData.status || "processing",
              output_url: null,
              progress: fallbackData.progress || generation.progress || 0,
              current_step: fallbackData.current_step,
              is_final: false,
            });
          }
        }
      }
    } catch (backendError) {
      console.error(`[Job Poll] Backend poll failed:`, backendError);
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
    console.error("[Job Poll] Error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
