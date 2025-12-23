import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@supabase/supabase-js';

/**
 * Render Callback Endpoint
 *
 * Called by Modal or EC2 when a render job completes (success or failure).
 * Updates the database with the final status.
 *
 * POST /api/v1/fast-cut/callback
 * Body: { job_id, status, output_url, error, secret }
 */

const LOG_PREFIX = '[Fast Cut Callback]';

// Initialize Supabase client for session updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Support both Modal and EC2 callback secrets
const MODAL_CALLBACK_SECRET = process.env.MODAL_CALLBACK_SECRET || 'hydra-modal-callback-secret';
const EC2_CALLBACK_SECRET = process.env.BATCH_CALLBACK_SECRET || MODAL_CALLBACK_SECRET;

function isValidSecret(secret: string): boolean {
  return secret === MODAL_CALLBACK_SECRET || secret === EC2_CALLBACK_SECRET;
}

function getSecretSource(secret: string): string {
  if (secret === MODAL_CALLBACK_SECRET) return 'Modal';
  if (secret === EC2_CALLBACK_SECRET) return 'EC2';
  return 'Unknown';
}

interface CallbackPayload {
  job_id: string;
  status: 'completed' | 'failed';
  output_url: string | null;
  error: string | null;
  secret: string;
}

/**
 * Update creation_session when render completes
 * Fast Cut stages: start → script → images → music → effects → render → publish
 */
async function updateSessionOnRenderComplete(generationId: string, success: boolean): Promise<void> {
  try {
    // Find fast-cut sessions and filter by generationId in script_data or images_data
    const { data: sessions, error: findError } = await supabase
      .from('creation_sessions')
      .select('id, current_stage, status, script_data, images_data, completed_stages')
      .eq('metadata->>contentType', 'fast-cut')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (findError) {
      console.error(`${LOG_PREFIX} Session lookup error:`, findError.message);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log(`${LOG_PREFIX} No fast-cut sessions found`);
      return;
    }

    // Find session with matching generationId
    const session = sessions.find(s => {
      const scriptData = s.script_data as Record<string, unknown> | null;
      const imagesData = s.images_data as Record<string, unknown> | null;
      return scriptData?.generationId === generationId || imagesData?.generationId === generationId;
    });

    if (!session) {
      console.log(`${LOG_PREFIX} No session found for generationId: ${generationId}`);
      return;
    }
    console.log(`${LOG_PREFIX} Found session ${session.id}, current_stage: ${session.current_stage}`);

    // Only update if currently in render stage or earlier
    const fastCutStages = ['start', 'script', 'images', 'music', 'effects', 'render', 'publish'];
    const currentIndex = fastCutStages.indexOf(session.current_stage);
    const renderIndex = fastCutStages.indexOf('render');

    if (currentIndex > renderIndex) {
      console.log(`${LOG_PREFIX} Session already past render stage, skipping update`);
      return;
    }

    // Update to publish stage on success, keep current on failure
    const newStage = success ? 'publish' : session.current_stage;
    const newStatus = success ? 'in_progress' : session.status;

    // Merge existing completed stages with new ones
    const existingCompleted = (session.completed_stages as string[]) || [];
    const newCompletedStages = success
      ? [...new Set([...existingCompleted, ...fastCutStages.slice(0, renderIndex + 1)])]
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
      console.error(`${LOG_PREFIX} Session update error:`, updateError.message);
    } else {
      console.log(`${LOG_PREFIX} ✓ Session ${session.id} updated: stage=${newStage}, status=${newStatus}`);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Session update exception:`, err);
  }
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  console.log(`${LOG_PREFIX} ========================================`);
  console.log(`${LOG_PREFIX} CALLBACK RECEIVED - ${new Date().toISOString()}`);
  console.log(`${LOG_PREFIX} ========================================`);

  try {
    const body: CallbackPayload = await request.json();
    const { job_id, status, output_url, error, secret } = body;

    console.log(`${LOG_PREFIX} Payload:`, {
      job_id,
      status,
      hasOutputUrl: !!output_url,
      outputUrlPreview: output_url ? output_url.substring(0, 80) + '...' : null,
      hasError: !!error,
      errorPreview: error ? error.substring(0, 100) : null,
      secretSource: getSecretSource(secret),
    });

    // Validate secret (supports both Modal and EC2)
    if (!isValidSecret(secret)) {
      console.error(`${LOG_PREFIX} ❌ UNAUTHORIZED - Invalid callback secret`);
      console.error(`${LOG_PREFIX} Expected Modal or EC2 secret, got: ${secret?.substring(0, 10)}...`);
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    console.log(`${LOG_PREFIX} ✓ Secret validated (source: ${getSecretSource(secret)})`);

    // Validate required fields
    if (!job_id || !status) {
      console.error(`${LOG_PREFIX} ❌ BAD REQUEST - Missing fields:`, {
        hasJobId: !!job_id,
        hasStatus: !!status,
      });
      return NextResponse.json(
        { detail: 'Missing required fields: job_id, status' },
        { status: 400 }
      );
    }

    // Find the generation
    console.log(`${LOG_PREFIX} Looking up generation: ${job_id}`);
    const dbLookupStart = Date.now();
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: job_id },
      select: { id: true, status: true, qualityMetadata: true, createdAt: true }
    });
    const dbLookupMs = Date.now() - dbLookupStart;

    if (!generation) {
      console.error(`${LOG_PREFIX} ❌ NOT FOUND - Generation: ${job_id} (lookup: ${dbLookupMs}ms)`);
      return NextResponse.json({ detail: 'Generation not found' }, { status: 404 });
    }

    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const renderBackend = metadata?.renderBackend as string | undefined;
    const renderDurationMs = Date.now() - new Date(generation.createdAt).getTime();

    console.log(`${LOG_PREFIX} Generation found (${dbLookupMs}ms):`, {
      job_id,
      currentDbStatus: generation.status,
      renderBackend: renderBackend || 'unknown',
      renderDurationSeconds: Math.round(renderDurationMs / 1000),
    });

    // Skip if already completed/failed (idempotency)
    if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
      console.log(`${LOG_PREFIX} ⏭️ SKIPPING - Already ${generation.status}:`, {
        job_id,
        callbackStatus: status,
        dbStatus: generation.status,
      });
      return NextResponse.json({ status: 'skipped', message: 'Already processed' });
    }

    // Update the database
    const dbUpdateStart = Date.now();
    if (status === 'completed' && output_url) {
      await prisma.videoGeneration.update({
        where: { id: job_id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          composedOutputUrl: output_url,
          outputUrl: output_url,
        }
      });
      const dbUpdateMs = Date.now() - dbUpdateStart;

      console.log(`${LOG_PREFIX} ✅ DB UPDATED to COMPLETED (${dbUpdateMs}ms):`, {
        job_id,
        outputUrl: output_url.substring(0, 80) + '...',
        totalRenderSeconds: Math.round(renderDurationMs / 1000),
        backend: renderBackend || 'unknown',
      });

      // Trigger auto-schedule if enabled
      const autoPublish = metadata?.autoPublish as { enabled?: boolean } | undefined;

      if (autoPublish?.enabled) {
        console.log(`${LOG_PREFIX} Auto-publish enabled - triggering auto-schedule...`);
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hydra.ai.kr';
          fetch(`${baseUrl}/api/v1/generations/${job_id}/auto-schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).catch(err => console.error(`${LOG_PREFIX} Auto-schedule request failed:`, err));
        } catch (scheduleError) {
          console.error(`${LOG_PREFIX} Auto-schedule error:`, scheduleError);
        }
      }

      // Update creation_session to publish stage
      await updateSessionOnRenderComplete(job_id, true);

    } else if (status === 'failed') {
      await prisma.videoGeneration.update({
        where: { id: job_id },
        data: {
          status: 'FAILED',
          progress: 0,
          errorMessage: error || 'Render failed',
        }
      });
      const dbUpdateMs = Date.now() - dbUpdateStart;

      console.error(`${LOG_PREFIX} ❌ DB UPDATED to FAILED (${dbUpdateMs}ms):`, {
        job_id,
        error: error?.substring(0, 200) || 'No error message',
        totalRenderSeconds: Math.round(renderDurationMs / 1000),
        backend: renderBackend || 'unknown',
      });

      // Update creation_session on failure (keeps current stage but logs)
      await updateSessionOnRenderComplete(job_id, false);
    }

    const totalMs = Date.now() - requestStartTime;
    console.log(`${LOG_PREFIX} ========================================`);
    console.log(`${LOG_PREFIX} CALLBACK PROCESSED (${totalMs}ms)`);
    console.log(`${LOG_PREFIX} Job: ${job_id}`);
    console.log(`${LOG_PREFIX} Status: ${status.toUpperCase()}`);
    console.log(`${LOG_PREFIX} Render time: ${Math.round(renderDurationMs / 1000)}s`);
    console.log(`${LOG_PREFIX} ========================================`);

    return NextResponse.json({
      status: 'ok',
      job_id,
      updated_status: status.toUpperCase(),
    });

  } catch (err) {
    const totalMs = Date.now() - requestStartTime;
    console.error(`${LOG_PREFIX} ========================================`);
    console.error(`${LOG_PREFIX} CALLBACK ERROR (${totalMs}ms)`);
    console.error(`${LOG_PREFIX} Error:`, err);
    console.error(`${LOG_PREFIX} Message:`, err instanceof Error ? err.message : 'Unknown');
    console.error(`${LOG_PREFIX} Stack:`, err instanceof Error ? err.stack : '(no stack)');
    console.error(`${LOG_PREFIX} ========================================`);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
