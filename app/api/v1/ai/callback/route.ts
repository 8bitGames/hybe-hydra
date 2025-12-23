import { NextRequest, NextResponse } from "next/server";
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
 * POST /api/v1/ai/callback
 *
 * Receive job status callbacks from EC2 AI Worker.
 *
 * NOTE: This callback is for NOTIFICATION ONLY.
 * - Does NOT save to database (data is already in AI service Job Queue)
 * - Only updates creation_session for workflow progression
 * - Frontend should query AI service status API directly for job data
 * - See: GET /api/v1/ai/job/{job_id}/status on AI service
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
    const { job_id, job_type, status, output_url, error, metadata } = body;

    console.log(`[AI Callback] 📥 Notification received: job=${job_id}, type=${job_type}, status=${status}`);

    // Log important data for debugging
    if (output_url) {
      console.log(`[AI Callback] Output URL: ${output_url.slice(0, 80)}...`);
    }
    if (metadata?.gcs_uri) {
      console.log(`[AI Callback] GCS URI: ${(metadata.gcs_uri as string).slice(0, 80)}...`);
    }
    if (error) {
      console.log(`[AI Callback] Error: ${error}`);
    }

    // Update creation_session when completed or failed (for workflow progression)
    if (status === 'completed' || status === 'failed') {
      await updateSessionOnAIComplete(job_id, status === 'completed');
      console.log(`[AI Callback] ✓ Session updated for workflow progression`);
    }

    // Return success (this is just a notification endpoint)
    return NextResponse.json({
      success: true,
      job_id,
      job_type,
      status,
      message: 'Notification received. Data available via AI service status API.',
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
