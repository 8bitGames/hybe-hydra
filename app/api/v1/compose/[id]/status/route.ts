import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getModalRenderStatus, modalStatusToDbStatus } from '@/lib/modal/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const params = await context.params;
    const generationId = params.id;

    // Get generation record to find the modal call ID
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      select: {
        id: true,
        status: true,
        progress: true,
        outputUrl: true,
        composedOutputUrl: true,
        errorMessage: true,
        qualityMetadata: true
      }
    });

    if (!generation) {
      return NextResponse.json(
        { detail: 'Generation not found' },
        { status: 404 }
      );
    }

    // If already completed or failed, return from database
    if (generation.status === 'COMPLETED') {
      return NextResponse.json({
        status: 'completed',
        progress: 100,
        currentStep: 'Completed',
        outputUrl: generation.composedOutputUrl || generation.outputUrl,
        error: null
      });
    }

    if (generation.status === 'FAILED') {
      return NextResponse.json({
        status: 'failed',
        progress: 0,
        currentStep: 'Failed',
        outputUrl: null,
        error: generation.errorMessage
      });
    }

    // Get modal call ID from qualityMetadata
    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const modalCallId = metadata?.modalCallId as string | undefined;

    if (!modalCallId) {
      // No modal call ID - might be an old job or error
      return NextResponse.json({
        status: generation.status.toLowerCase(),
        progress: generation.progress || 0,
        currentStep: 'Processing',
        outputUrl: generation.composedOutputUrl || generation.outputUrl,
        error: generation.errorMessage
      });
    }

    // Poll Modal for current status
    try {
      const modalStatus = await getModalRenderStatus(modalCallId);

      console.log(`[Compose Status] Modal response for ${generationId}:`, modalStatus);

      if (modalStatus.status === 'completed' && modalStatus.result?.output_url) {
        // Update database with completion
        // Note: generation.status was already checked above, so this is always true here
        const wasNotCompleted = true;

        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            composedOutputUrl: modalStatus.result.output_url,
            outputUrl: modalStatus.result.output_url,
          }
        });

        // Trigger auto-schedule if this is a new completion
        if (wasNotCompleted) {
          const autoPublish = metadata?.autoPublish as { enabled?: boolean } | undefined;

          if (autoPublish?.enabled) {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
              fetch(`${baseUrl}/api/v1/generations/${generationId}/auto-schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              }).catch(err => console.error('Auto-schedule failed:', err));
            } catch (scheduleError) {
              console.error('Auto-schedule error:', scheduleError);
            }
          }
        }

        return NextResponse.json({
          status: 'completed',
          progress: 100,
          currentStep: 'Completed',
          outputUrl: modalStatus.result.output_url,
          error: null
        });
      }

      if (modalStatus.status === 'failed' || modalStatus.status === 'error') {
        const errorMsg = modalStatus.result?.error || modalStatus.error || 'Modal render failed';

        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: 'FAILED',
            errorMessage: errorMsg
          }
        });

        return NextResponse.json({
          status: 'failed',
          progress: 0,
          currentStep: 'Failed',
          outputUrl: null,
          error: errorMsg
        });
      }

      // Still processing
      // Estimate progress based on typical render times (30-60 seconds total)
      const createdAt = metadata?.createdAt as string | undefined;
      let estimatedProgress = 50; // Default mid-way

      if (createdAt) {
        const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
        // Assume ~45 seconds total render time with GPU
        estimatedProgress = Math.min(90, Math.floor((elapsed / 45) * 100));
      }

      return NextResponse.json({
        status: 'processing',
        progress: estimatedProgress,
        currentStep: 'Rendering on Modal (GPU)',
        outputUrl: null,
        error: null
      });

    } catch (modalError) {
      console.error('Modal status check error:', modalError);

      // Return current database status as fallback
      return NextResponse.json({
        status: generation.status.toLowerCase(),
        progress: generation.progress || 0,
        currentStep: 'Processing (status check failed)',
        outputUrl: generation.composedOutputUrl || generation.outputUrl,
        error: null
      });
    }

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { detail: 'Failed to check status' },
      { status: 500 }
    );
  }
}
