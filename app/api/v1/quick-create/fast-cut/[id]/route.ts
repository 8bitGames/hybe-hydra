import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/db/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { getModalRenderStatus } from '@/lib/compose/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get Quick Compose generation status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id: generationId } = await params;

    // Find the generation
    const generation = await withRetry(() =>
      prisma.videoGeneration.findUnique({
        where: { id: generationId },
      })
    );

    if (!generation) {
      return NextResponse.json({ detail: 'Generation not found' }, { status: 404 });
    }

    // Check ownership
    if (generation.createdBy !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ detail: 'Access denied' }, { status: 403 });
    }

    // Extract metadata
    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const isQuickCompose = metadata?.isQuickCompose;
    const quickComposeStep = metadata?.quickComposeStep as string || 'script';
    const modalCallId = metadata?.modalCallId as string | undefined;
    const scriptResult = metadata?.script as { lines?: unknown[]; vibe?: string } | undefined;
    const imageCount = metadata?.imageCount as number | undefined;

    // If not a quick compose generation, return basic status
    if (!isQuickCompose) {
      return NextResponse.json({
        id: generation.id,
        status: generation.status.toLowerCase(),
        progress: generation.progress,
        output_url: generation.outputUrl,
        error_message: generation.errorMessage,
      });
    }

    // If we have a Modal call ID and status is still processing, check Modal
    if (modalCallId && generation.status === 'PROCESSING') {
      try {
        const modalStatus = await getModalRenderStatus(modalCallId);

        if (modalStatus.status === 'completed' && modalStatus.result?.output_url) {
          // Capture to preserve TypeScript narrowing inside callback
          const outputUrl = modalStatus.result.output_url;
          // Update database with completed status
          await withRetry(() =>
            prisma.videoGeneration.update({
              where: { id: generationId },
              data: {
                status: 'COMPLETED',
                progress: 100,
                outputUrl,
              },
            })
          );

          return NextResponse.json({
            id: generation.id,
            status: 'completed',
            progress: 100,
            output_url: outputUrl,
            script_lines: scriptResult?.lines?.length || 0,
            image_count: imageCount || 0,
            vibe: scriptResult?.vibe || 'Pop',
          });
        }

        if (modalStatus.status === 'failed' || modalStatus.status === 'error') {
          const errorMessage = modalStatus.result?.error || modalStatus.error || 'Render failed';

          await withRetry(() =>
            prisma.videoGeneration.update({
              where: { id: generationId },
              data: {
                status: 'FAILED',
                errorMessage,
              },
            })
          );

          return NextResponse.json({
            id: generation.id,
            status: 'failed',
            progress: generation.progress,
            output_url: null,
            error_message: errorMessage,
            script_lines: scriptResult?.lines?.length || 0,
            image_count: imageCount || 0,
            vibe: scriptResult?.vibe || 'Pop',
          });
        }

        // Still processing - return current progress
        // Estimate progress based on step
        let progress = generation.progress;
        if (quickComposeStep === 'render') {
          // Render phase: progress from 60 to 95
          progress = Math.min(95, generation.progress + 5);
          await withRetry(() =>
            prisma.videoGeneration.update({
              where: { id: generationId },
              data: { progress },
            })
          );
        }

        return NextResponse.json({
          id: generation.id,
          status: 'processing',
          progress,
          output_url: null,
          script_lines: scriptResult?.lines?.length || 0,
          image_count: imageCount || 0,
          vibe: scriptResult?.vibe || 'Pop',
        });
      } catch (error) {
        console.error('[Quick Compose Status] Modal check error:', error);
        // Return current database state if Modal check fails
      }
    }

    // Return database state
    return NextResponse.json({
      id: generation.id,
      status: generation.status.toLowerCase(),
      progress: generation.progress,
      output_url: generation.outputUrl,
      error_message: generation.errorMessage,
      script_lines: scriptResult?.lines?.length || 0,
      image_count: imageCount || 0,
      vibe: scriptResult?.vibe || 'Pop',
    });
  } catch (error) {
    console.error('[Quick Compose Status] Error:', error);
    return NextResponse.json(
      { detail: 'Failed to get status' },
      { status: 500 }
    );
  }
}
