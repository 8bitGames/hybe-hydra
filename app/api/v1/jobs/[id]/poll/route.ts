import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Backend compose-engine URL
const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || "http://15.164.236.53:8000";

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

    // Get the actual job ID used in backend
    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const videoEditJobId = metadata?.videoEditJobId as string | undefined;
    const actualJobId = videoEditJobId || generation.vertexRequestId || jobId;

    // Poll backend for job status
    console.log(`[Job Poll] Polling backend for job ${actualJobId}`);

    try {
      const backendResponse = await fetch(
        `${COMPOSE_ENGINE_URL}/api/v1/video/edit/${actualJobId}/status`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        console.log(`[Job Poll] Backend response:`, backendData);

        // Update DB based on backend status
        if (backendData.is_final) {
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

      // Backend returned error (e.g., 404 - job not in queue anymore)
      if (backendResponse.status === 404) {
        console.log(`[Job Poll] Job ${actualJobId} not found in backend queue`);
        // Job might have expired from queue but completed - check if we can find the output
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
