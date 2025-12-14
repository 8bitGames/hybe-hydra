import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/v1/compose/callback
 * Callback endpoint for EC2 auto-compose job completion notifications
 *
 * Called by EC2 server when a compose job completes or fails
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      job_id,
      status,
      output_url,
      error,
      progress,
    } = body;

    if (!job_id) {
      return NextResponse.json({ detail: "job_id is required" }, { status: 400 });
    }

    console.log(`[Compose Callback] Received callback for job ${job_id}: status=${status}, output_url=${output_url ? 'yes' : 'no'}`);

    // Find the generation by ID
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: job_id },
    });

    if (!generation) {
      console.warn(`[Compose Callback] Generation not found: ${job_id}`);
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Update based on status
    if (status === "completed" && output_url) {
      await prisma.videoGeneration.update({
        where: { id: job_id },
        data: {
          status: "COMPLETED",
          progress: 100,
          composedOutputUrl: output_url,
          outputUrl: output_url,
        },
      });
      console.log(`[Compose Callback] Job ${job_id} marked as COMPLETED with output: ${output_url}`);
    } else if (status === "failed") {
      await prisma.videoGeneration.update({
        where: { id: job_id },
        data: {
          status: "FAILED",
          progress: 100,
          errorMessage: error || "Auto-compose job failed",
        },
      });
      console.log(`[Compose Callback] Job ${job_id} marked as FAILED: ${error}`);
    } else if (status === "processing" || status === "queued") {
      // Update progress for processing jobs
      const updateData: Record<string, unknown> = {
        status: "PROCESSING",
      };
      if (typeof progress === "number") {
        updateData.progress = progress;
      }
      await prisma.videoGeneration.update({
        where: { id: job_id },
        data: updateData,
      });
      console.log(`[Compose Callback] Job ${job_id} progress updated: ${progress}%`);
    }

    return NextResponse.json({
      success: true,
      job_id,
      status: "callback_processed"
    });
  } catch (error) {
    console.error("[Compose Callback] Error processing callback:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
