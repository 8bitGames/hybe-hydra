import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getModalRenderStatus } from '@/lib/modal/client';

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

    // Get Modal call ID from qualityMetadata
    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const modalCallId = metadata?.modalCallId as string | undefined;

    if (!modalCallId) {
      // No Modal call ID - might be an old job or error
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

      console.log(`[Fast Cut Status] Modal response for ${generationId}:`, modalStatus);

      if (modalStatus.status === 'completed') {
        // For AWS Batch, output_url comes from callback, not from status check
        // Check if we already have the output URL in database (set by callback)
        const freshGeneration = await prisma.videoGeneration.findUnique({
          where: { id: generationId },
          select: {
            status: true,
            composedOutputUrl: true,
            outputUrl: true
          }
        });

        const outputUrl = modalStatus.result?.output_url ||
                         freshGeneration?.composedOutputUrl ||
                         freshGeneration?.outputUrl;

        if (outputUrl) {
          // We have the output URL, mark as completed
          const wasNotCompleted = freshGeneration?.status !== 'COMPLETED';

          if (wasNotCompleted) {
            await prisma.videoGeneration.update({
              where: { id: generationId },
              data: {
                status: 'COMPLETED',
                progress: 100,
                composedOutputUrl: outputUrl,
                outputUrl: outputUrl,
              }
            });

            // Trigger auto-schedule if this is a new completion
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
            outputUrl: outputUrl,
            error: null
          });
        } else {
          // AWS Batch shows completed but callback hasn't arrived yet
          // Return processing status while waiting for callback with output URL
          return NextResponse.json({
            status: 'processing',
            progress: 95,
            currentStep: 'Finalizing (waiting for output)',
            outputUrl: null,
            error: null
          });
        }
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
      // Estimate progress based on typical render times (45-60 seconds with CPU)
      const createdAt = metadata?.createdAt as string | undefined;
      let estimatedProgress = 50; // Default mid-way

      if (createdAt) {
        const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
        // Assume ~50 seconds total render time with CPU
        estimatedProgress = Math.min(90, Math.floor((elapsed / 50) * 100));
      }

      // Determine render backend for status message
      const renderBackend = metadata?.renderBackend as string | undefined;
      let backendName = 'Cloud';
      if (renderBackend === 'local') backendName = 'Local';
      else if (renderBackend === 'batch') backendName = 'AWS Batch (GPU)';
      else if (renderBackend === 'modal') backendName = 'Modal';

      return NextResponse.json({
        status: 'processing',
        progress: estimatedProgress,
        currentStep: `Rendering on ${backendName}`,
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
