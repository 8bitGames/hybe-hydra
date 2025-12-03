import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * Modal Callback Endpoint
 *
 * Called by Modal when a render job completes (success or failure).
 * Updates the database with the final status.
 *
 * POST /api/v1/compose/callback
 * Body: { job_id, status, output_url, error, secret }
 */

const CALLBACK_SECRET = process.env.MODAL_CALLBACK_SECRET || 'hydra-modal-callback-secret';

interface CallbackPayload {
  job_id: string;
  status: 'completed' | 'failed';
  output_url: string | null;
  error: string | null;
  secret: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CallbackPayload = await request.json();
    const { job_id, status, output_url, error, secret } = body;

    // Validate secret
    if (secret !== CALLBACK_SECRET) {
      console.error('[Compose Callback] Invalid secret');
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!job_id || !status) {
      return NextResponse.json(
        { detail: 'Missing required fields: job_id, status' },
        { status: 400 }
      );
    }

    console.log(`[Compose Callback] Received: job_id=${job_id}, status=${status}`);

    // Find the generation
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: job_id },
      select: { id: true, status: true, qualityMetadata: true }
    });

    if (!generation) {
      console.error(`[Compose Callback] Generation not found: ${job_id}`);
      return NextResponse.json({ detail: 'Generation not found' }, { status: 404 });
    }

    // Skip if already completed/failed (idempotency)
    if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
      console.log(`[Compose Callback] Already ${generation.status}, skipping: ${job_id}`);
      return NextResponse.json({ status: 'skipped', message: 'Already processed' });
    }

    // Update the database
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

      console.log(`[Compose Callback] Updated to COMPLETED: ${job_id}`);

      // Trigger auto-schedule if enabled
      const metadata = generation.qualityMetadata as Record<string, unknown> | null;
      const autoPublish = metadata?.autoPublish as { enabled?: boolean } | undefined;

      if (autoPublish?.enabled) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          fetch(`${baseUrl}/api/v1/generations/${job_id}/auto-schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).catch(err => console.error('[Compose Callback] Auto-schedule failed:', err));
        } catch (scheduleError) {
          console.error('[Compose Callback] Auto-schedule error:', scheduleError);
        }
      }

    } else if (status === 'failed') {
      await prisma.videoGeneration.update({
        where: { id: job_id },
        data: {
          status: 'FAILED',
          progress: 0,
          errorMessage: error || 'Render failed',
        }
      });

      console.log(`[Compose Callback] Updated to FAILED: ${job_id}, error: ${error}`);
    }

    return NextResponse.json({
      status: 'ok',
      job_id,
      updated_status: status.toUpperCase(),
    });

  } catch (err) {
    console.error('[Compose Callback] Error:', err);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
