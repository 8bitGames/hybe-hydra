import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Callback payload from AWS Batch AI Worker
 */
interface AICallbackPayload {
  job_id: string;
  job_type: 'video_generation' | 'image_generation' | 'image_to_video';
  status: 'queued' | 'processing' | 'uploading' | 'completed' | 'failed';
  output_url?: string;
  error?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

// Callback secret for authentication
const AI_CALLBACK_SECRET = process.env.AI_CALLBACK_SECRET || process.env.BATCH_CALLBACK_SECRET || 'hydra-ai-callback-secret';

/**
 * Map AI job status to Prisma VideoStatus enum
 */
function mapStatusToPrisma(status: string): string {
  switch (status) {
    case 'queued':
      return 'PENDING';
    case 'processing':
    case 'uploading':
      return 'PROCESSING';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

/**
 * POST /api/v1/ai/callback
 *
 * Receive job status callbacks from AWS Batch AI Worker.
 * Updates the corresponding generation record in the database.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify callback secret
    const secret = request.headers.get('X-Callback-Secret');
    if (secret !== AI_CALLBACK_SECRET) {
      console.warn('[AI Callback] Invalid callback secret');
      return NextResponse.json(
        { error: 'Invalid callback secret' },
        { status: 401 }
      );
    }

    const body: AICallbackPayload = await request.json();
    const { job_id, job_type, status, output_url, error, duration_ms, metadata } = body;

    console.log(`[AI Callback] Received: job=${job_id}, type=${job_type}, status=${status}`);

    // Map status for database
    const prismaStatus = mapStatusToPrisma(status);
    const progress = status === 'completed' || status === 'failed' ? 100 : 50;

    // Determine which field to update based on job type
    const updateData: Record<string, unknown> = {
      status: prismaStatus,
      progress,
      updatedAt: new Date(),
    };

    // Update output URL based on job type
    if (output_url) {
      if (job_type === 'video_generation' || job_type === 'image_to_video') {
        // For video generation, update the video URL
        updateData.videoUrl = output_url;
      } else if (job_type === 'image_generation') {
        // For image generation, store in metadata (or create separate field)
        updateData.previewImageUrl = output_url;
      }
    }

    // Store error message if failed
    if (error) {
      updateData.errorMessage = error;
    }

    // Store additional metadata
    if (metadata || duration_ms) {
      // Fetch existing metadata first
      const existing = await prisma.videoGeneration.findUnique({
        where: { id: job_id },
        select: { qualityMetadata: true },
      });

      const existingMetadata = (existing?.qualityMetadata as Record<string, unknown>) || {};

      updateData.qualityMetadata = {
        ...existingMetadata,
        ai_generation: {
          job_type,
          duration_ms,
          completed_at: new Date().toISOString(),
          ...metadata,
        },
      };
    }

    // Update the database
    try {
      await prisma.videoGeneration.update({
        where: { id: job_id },
        data: updateData,
      });

      console.log(`[AI Callback] Updated job ${job_id}: status=${prismaStatus}, progress=${progress}%`);
    } catch (dbError) {
      // Job might not exist in videoGeneration table
      // Try to check if it's in a different table or log for debugging
      console.warn(`[AI Callback] Job ${job_id} not found in videoGeneration table, may be a standalone AI job`);

      // For standalone AI jobs, we could store in a separate table
      // For now, just log the completion
      console.log(`[AI Callback] Standalone AI job completed: ${job_id}, type=${job_type}, output=${output_url}`);
    }

    return NextResponse.json({
      success: true,
      job_id,
      job_type,
      status,
    });

  } catch (err) {
    console.error('[AI Callback] Error processing callback:', err);
    return NextResponse.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/ai/callback
 *
 * Health check endpoint for the callback service.
 */
export async function GET() {
  return NextResponse.json({
    service: 'ai-callback',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
