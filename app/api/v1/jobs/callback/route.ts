import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface CallbackPayload {
  job_id: string;
  status: "completed" | "failed";
  output_url?: string;
  error?: string;
}

// POST /api/v1/jobs/callback - Receive job completion callbacks from compose-engine
export async function POST(request: NextRequest) {
  try {
    const body: CallbackPayload = await request.json();
    const { job_id, status, output_url, error } = body;

    console.log(`[Job Callback] Received callback for job ${job_id}: ${status}`);

    // Update the video generation record
    const updateData: Record<string, unknown> = {
      status: status === "completed" ? "COMPLETED" : "FAILED",
      progress: 100,
      updatedAt: new Date(),
    };

    if (output_url) {
      updateData.composedOutputUrl = output_url;
    }

    if (error) {
      updateData.errorMessage = error;
    }

    await prisma.videoGeneration.update({
      where: { id: job_id },
      data: updateData,
    });

    console.log(`[Job Callback] Updated job ${job_id} to ${status}`);

    // Check if this job has auto-publish settings
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: job_id },
      select: { qualityMetadata: true },
    });

    if (generation?.qualityMetadata && status === "completed") {
      const metadata = generation.qualityMetadata as Record<string, unknown>;
      const autoPublish = metadata.autoPublish as Record<string, unknown> | null;

      if (autoPublish?.enabled && autoPublish.socialAccountId) {
        console.log(`[Job Callback] Auto-publish enabled for job ${job_id}`);
        // Auto-publish logic would go here (or trigger a separate job)
      }
    }

    return NextResponse.json({ success: true, job_id, status });
  } catch (error) {
    console.error("[Job Callback] Error processing callback:", error);
    return NextResponse.json(
      { detail: "Failed to process callback" },
      { status: 500 }
    );
  }
}
