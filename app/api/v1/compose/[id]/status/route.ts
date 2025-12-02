import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || 'http://localhost:8001';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface JobStatus {
  status: string;
  progress: number;
  current_step?: string;
  steps?: Array<{
    name: string;
    completed: boolean;
    progress?: number;
  }>;
  output_url?: string;
  error?: string;
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

    // Get generation record to find the job ID
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      select: {
        id: true,
        status: true,
        progress: true,
        outputUrl: true,
        composedOutputUrl: true,
        errorMessage: true
      }
    });

    if (!generation) {
      return NextResponse.json(
        { detail: 'Generation not found' },
        { status: 404 }
      );
    }

    // Try to get job status from Python service
    // For now, we'll use the generationId directly as the query
    try {
      const response = await fetch(`${COMPOSE_ENGINE_URL}/job/${generationId}/status`);

      if (response.ok) {
        const jobStatus: JobStatus = await response.json();

        // Update generation record with latest status
        if (jobStatus.status === 'completed' && jobStatus.output_url) {
          // Check if this is a new completion (not already marked as completed)
          const currentGen = await prisma.videoGeneration.findUnique({
            where: { id: generationId },
            select: { status: true, qualityMetadata: true }
          });

          const wasNotCompleted = currentGen?.status !== 'COMPLETED';

          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: {
              status: 'COMPLETED',
              progress: 100,
              composedOutputUrl: jobStatus.output_url,
              outputUrl: jobStatus.output_url, // Also set outputUrl for auto-schedule
            }
          });

          // Trigger auto-schedule if this is a new completion
          if (wasNotCompleted) {
            const metadata = currentGen?.qualityMetadata as Record<string, unknown> | null;
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
        } else if (jobStatus.status === 'failed') {
          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: {
              status: 'FAILED',
              errorMessage: jobStatus.error
            }
          });
        } else {
          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: {
              progress: jobStatus.progress
            }
          });
        }

        return NextResponse.json({
          status: jobStatus.status,
          progress: jobStatus.progress,
          currentStep: jobStatus.current_step,
          steps: jobStatus.steps,
          outputUrl: jobStatus.output_url,
          error: jobStatus.error
        });
      }
    } catch (fetchError) {
      console.warn('Could not fetch job status from compose engine:', fetchError);
    }

    // Fallback to database status
    return NextResponse.json({
      status: generation.status.toLowerCase(),
      progress: generation.progress || 0,
      currentStep: null,
      outputUrl: generation.composedOutputUrl || generation.outputUrl,
      error: generation.errorMessage
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { detail: 'Failed to check status' },
      { status: 500 }
    );
  }
}
