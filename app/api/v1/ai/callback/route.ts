import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for session updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Callback payload from EC2 AI Worker
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

// NOTE: Audio+lyrics composition is now handled in the initial EC2 request via audio_overlay.subtitles
// in app/api/v1/campaigns/[id]/generations/route.ts
// The callback no longer needs to do post-processing composition

/**
 * Update creation_session when AI video generation completes
 * AI Video stages: start → analyze → create → processing → publish
 */
async function updateSessionOnAIComplete(generationId: string, success: boolean): Promise<void> {
  try {
    // Find session that has this generationId in stage_data (processing stage saves generationId)
    // AI Video workflow stores generationId in processing_data or stage_data
    const { data: sessions, error: findError } = await supabase
      .from('creation_sessions')
      .select('id, current_stage, status, stage_data, metadata, completed_stages')
      .eq('metadata->>contentType', 'ai_video')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (findError) {
      console.error('[AI Callback] Session lookup error:', findError.message);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('[AI Callback] No AI video sessions found');
      return;
    }

    // Find session with matching generationId in stage_data
    const session = sessions.find(s => {
      const stageData = s.stage_data as Record<string, unknown> | null;
      if (!stageData) return false;
      // Check various places where generationId might be stored
      return stageData.generationId === generationId ||
             (stageData.processing as Record<string, unknown>)?.generationId === generationId ||
             (stageData.create as Record<string, unknown>)?.generationId === generationId;
    });

    if (!session) {
      console.log(`[AI Callback] No session found for generationId: ${generationId}`);
      return;
    }

    console.log(`[AI Callback] Found session ${session.id}, current_stage: ${session.current_stage}`);

    // Only update if currently in processing stage or earlier
    const aiVideoStages = ['start', 'analyze', 'create', 'processing', 'publish'];
    const currentIndex = aiVideoStages.indexOf(session.current_stage);
    const processingIndex = aiVideoStages.indexOf('processing');

    if (currentIndex > processingIndex) {
      console.log('[AI Callback] Session already past processing stage, skipping update');
      return;
    }

    // Update to publish stage on success, keep current on failure
    const newStage = success ? 'publish' : session.current_stage;
    const newStatus = success ? 'in_progress' : session.status;

    // Merge existing completed stages with new ones
    const existingCompleted = (session.completed_stages as string[]) || [];
    const newCompletedStages = success
      ? [...new Set([...existingCompleted, ...aiVideoStages.slice(0, processingIndex + 1)])]
      : existingCompleted;

    const { error: updateError } = await supabase
      .from('creation_sessions')
      .update({
        current_stage: newStage,
        status: newStatus,
        completed_stages: newCompletedStages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('[AI Callback] Session update error:', updateError.message);
    } else {
      console.log(`[AI Callback] ✓ Session ${session.id} updated: stage=${newStage}, status=${newStatus}`);
    }
  } catch (err) {
    console.error('[AI Callback] Session update exception:', err);
  }
}

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
 * Receive job status callbacks from EC2 AI Worker.
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
        // For video generation, update the output URL (Prisma field: outputUrl -> DB column: output_url)
        updateData.outputUrl = output_url;
      } else if (job_type === 'image_generation') {
        // For image generation, store in metadata (or create separate field)
        updateData.outputUrl = output_url;
      }
    }

    // Store error message if failed
    if (error) {
      updateData.errorMessage = error;
    }

    // Extract and store GCS URI for video extension support (Veo 3.1)
    if (metadata) {
      // Store gcsUri directly in the gcsUri field (required for video extension)
      if (metadata.gcs_uri) {
        updateData.gcsUri = metadata.gcs_uri;
        console.log(`[AI Callback] Storing GCS URI for video extension: ${(metadata.gcs_uri as string).slice(0, 60)}...`);
      }
      // Store extension count if provided
      if (typeof metadata.extension_count === 'number') {
        updateData.extensionCount = metadata.extension_count;
      }
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
      const updated = await prisma.videoGeneration.update({
        where: { id: job_id },
        data: updateData,
      });

      console.log(`[AI Callback] Updated job ${job_id}: status=${prismaStatus}, progress=${progress}%, outputUrl=${updated.outputUrl?.slice(0, 50) || 'none'}`);

      // NOTE: Audio+lyrics composition is now handled in the initial EC2 request
      // via audio_overlay.subtitles - see app/api/v1/campaigns/[id]/generations/route.ts
      // No post-processing composition needed here

      // Update creation_session when completed or failed
      if (status === 'completed' || status === 'failed') {
        await updateSessionOnAIComplete(job_id, status === 'completed');
      }

      return NextResponse.json({
        success: true,
        job_id,
        job_type,
        status,
        updated: true,
      });
    } catch (dbError) {
      // Log the actual error for debugging
      console.error(`[AI Callback] DB Update Error for job ${job_id}:`, dbError);

      // Check if it's a "record not found" error
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      if (errorMessage.includes('Record to update not found') || errorMessage.includes('not found')) {
        console.warn(`[AI Callback] Job ${job_id} not found in videoGeneration table`);
        return NextResponse.json({
          success: false,
          job_id,
          error: 'Job not found in database',
        }, { status: 404 });
      }

      // For other DB errors, return 500
      return NextResponse.json({
        success: false,
        job_id,
        error: 'Database update failed',
        details: errorMessage,
      }, { status: 500 });
    }

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
