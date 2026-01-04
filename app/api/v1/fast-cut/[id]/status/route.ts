import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { prisma, withRetry } from '@/lib/db/prisma';
import { getModalRenderStatus } from '@/lib/compose/client';
import { getAIJobStatus } from '@/lib/ec2/ai-client';
import { getPresignedUrlFromS3Url } from '@/lib/storage';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestStartTime = Date.now();
  const LOG_PREFIX = '[Fast Cut Status API]';

  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      console.warn(`${LOG_PREFIX} Auth failed - no valid user`);
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const params = await context.params;
    const generationId = params.id;

    console.log(`${LOG_PREFIX} Status check for: ${generationId}`);

    // Get generation record to find the modal call ID
    const dbLookupStart = Date.now();
    const generation = await withRetry(() =>
      prisma.videoGeneration.findUnique({
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
      })
    );
    const dbLookupMs = Date.now() - dbLookupStart;

    if (!generation) {
      console.warn(`${LOG_PREFIX} Generation not found: ${generationId} (lookup: ${dbLookupMs}ms)`);
      return NextResponse.json(
        { detail: 'Generation not found' },
        { status: 404 }
      );
    }

    console.log(`${LOG_PREFIX} DB lookup (${dbLookupMs}ms):`, {
      generationId,
      dbStatus: generation.status,
      dbProgress: generation.progress,
      hasOutputUrl: !!generation.outputUrl,
      hasComposedUrl: !!generation.composedOutputUrl,
      hasError: !!generation.errorMessage,
    });

    // If already completed or failed, return from database
    if (generation.status === 'COMPLETED') {
      const rawOutputUrl = generation.composedOutputUrl || generation.outputUrl;
      // Generate presigned URL for S3 access (direct S3 URLs are not publicly accessible)
      const outputUrl = rawOutputUrl ? await getPresignedUrlFromS3Url(rawOutputUrl) : null;
      console.log(`${LOG_PREFIX} Already COMPLETED - returning cached result (${Date.now() - requestStartTime}ms total)`);
      return NextResponse.json({
        status: 'completed',
        progress: 100,
        currentStep: 'Completed',
        outputUrl,
        error: null
      });
    }

    if (generation.status === 'FAILED') {
      console.log(`${LOG_PREFIX} Already FAILED - returning cached result (${Date.now() - requestStartTime}ms total)`, {
        errorMessage: generation.errorMessage?.substring(0, 100),
      });
      return NextResponse.json({
        status: 'failed',
        progress: 0,
        currentStep: 'Failed',
        outputUrl: null,
        error: generation.errorMessage
      });
    }

    // Get call ID from qualityMetadata (supports both Fast Cut and AI I2V)
    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    // Fast Cut uses modalCallId, AI Video uses ec2_job_id, legacy uses batch_job_id
    const modalCallId = metadata?.modalCallId as string | undefined;
    const ec2JobId = metadata?.ec2_job_id as string | undefined;
    const batchJobId = metadata?.batch_job_id as string | undefined;
    const callId = modalCallId || ec2JobId || batchJobId;
    const renderBackend = metadata?.renderBackend as string | undefined;
    const createdAt = (metadata?.createdAt || metadata?.submitted_at) as string | undefined;
    const jobType = metadata?.job_type as string | undefined;

    console.log(`${LOG_PREFIX} Metadata:`, {
      hasModalCallId: !!modalCallId,
      hasEc2JobId: !!ec2JobId,
      hasBatchJobId: !!batchJobId,
      callIdPreview: callId?.substring(0, 20) + '...',
      renderBackend: renderBackend || '(not set)',
      createdAt: createdAt || '(not set)',
      jobType: jobType || '(not set)',
    });

    // For AI Video jobs, generationId === job_id sent to EC2
    // So we can use generationId directly if ec2_job_id not yet saved (race condition from fire-and-forget submitToEC2)
    const isAIVideoJobType = jobType === 'image_to_video' || jobType === 'video_generation';
    const usingGenerationIdFallback = !callId && isAIVideoJobType;
    const effectiveCallId = callId || (isAIVideoJobType ? generationId : null);

    if (usingGenerationIdFallback) {
      console.log(`${LOG_PREFIX} Using generationId as callId (AI Video fallback for race condition)`);
    }

    if (!effectiveCallId) {
      // No call ID - might be an old job or error
      console.warn(`${LOG_PREFIX} No callId found (modalCallId, ec2_job_id, or batch_job_id) - returning DB status (${Date.now() - requestStartTime}ms total)`);
      const rawOutputUrl = generation.composedOutputUrl || generation.outputUrl;
      const outputUrl = rawOutputUrl ? await getPresignedUrlFromS3Url(rawOutputUrl) : null;
      return NextResponse.json({
        status: generation.status.toLowerCase(),
        progress: generation.progress || 0,
        currentStep: 'Processing',
        outputUrl,
        error: generation.errorMessage
      });
    }

    // Poll backend for current status (supports Modal, EC2, and Local)
    // AI Video jobs (image_to_video, video_generation) use different endpoint than Fast Cut
    const isAIVideoJob = isAIVideoJobType;  // Reuse the check from above
    console.log(`${LOG_PREFIX} Polling backend for status... (isAIVideoJob: ${isAIVideoJob}, effectiveCallId: ${effectiveCallId.substring(0, 20)}...)`);
    const backendPollStart = Date.now();
    try {
      // Use appropriate status function based on job type
      const backendStatus = isAIVideoJob
        ? await getAIJobStatus(effectiveCallId).then(res => ({
            status: res.mappedStatus,
            result: res.output_url ? { output_url: res.output_url } : null,
            error: res.error,
            call_id: res.job_id,
          }))
        : await getModalRenderStatus(effectiveCallId);
      const backendPollMs = Date.now() - backendPollStart;

      // Type-safe error check - result may or may not have error property depending on job type
      const resultError = backendStatus.result && 'error' in backendStatus.result
        ? (backendStatus.result as { error?: string | null }).error
        : null;

      console.log(`${LOG_PREFIX} Backend response (${backendPollMs}ms):`, {
        generationId,
        callId: effectiveCallId.substring(0, 20) + '...',
        backendStatus: backendStatus.status,
        hasResult: !!backendStatus.result,
        hasOutputUrl: !!backendStatus.result?.output_url,
        hasError: !!backendStatus.error || !!resultError,
      });

      if (backendStatus.status === 'completed') {
        console.log(`${LOG_PREFIX} Backend reports COMPLETED - checking for output URL...`);
        // For EC2, output_url comes from callback, not from status check
        // Check if we already have the output URL in database (set by callback)
        const freshDbStart = Date.now();
        const freshGeneration = await withRetry(() =>
          prisma.videoGeneration.findUnique({
            where: { id: generationId },
            select: {
              status: true,
              composedOutputUrl: true,
              outputUrl: true
            }
          })
        );
        console.log(`${LOG_PREFIX} Fresh DB lookup (${Date.now() - freshDbStart}ms):`, {
          freshStatus: freshGeneration?.status,
          hasComposedUrl: !!freshGeneration?.composedOutputUrl,
          hasOutputUrl: !!freshGeneration?.outputUrl,
        });

        const outputUrl = backendStatus.result?.output_url ||
                         freshGeneration?.composedOutputUrl ||
                         freshGeneration?.outputUrl;

        if (outputUrl) {
          // We have the output URL, mark as completed
          const wasNotCompleted = freshGeneration?.status !== 'COMPLETED';
          console.log(`${LOG_PREFIX} Output URL found:`, {
            outputUrlPreview: outputUrl.substring(0, 80) + '...',
            wasNotCompleted,
            willUpdateDb: wasNotCompleted,
          });

          if (wasNotCompleted) {
            const updateStart = Date.now();
            await withRetry(() =>
              prisma.videoGeneration.update({
                where: { id: generationId },
                data: {
                  status: 'COMPLETED',
                  progress: 100,
                  composedOutputUrl: outputUrl,
                  outputUrl: outputUrl,
                }
              })
            );
            console.log(`${LOG_PREFIX} DB updated to COMPLETED (${Date.now() - updateStart}ms)`);

            // Trigger auto-schedule if this is a new completion
            const autoPublish = metadata?.autoPublish as { enabled?: boolean } | undefined;
            if (autoPublish?.enabled) {
              console.log(`${LOG_PREFIX} Auto-publish enabled - triggering auto-schedule...`);
              try {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hydra.ai.kr';
                fetch(`${baseUrl}/api/v1/generations/${generationId}/auto-schedule`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                }).catch(err => console.error(`${LOG_PREFIX} Auto-schedule failed:`, err));
              } catch (scheduleError) {
                console.error(`${LOG_PREFIX} Auto-schedule error:`, scheduleError);
              }
            }
          }

          // Generate presigned URL for S3 access
          const presignedUrl = await getPresignedUrlFromS3Url(outputUrl);

          const totalMs = Date.now() - requestStartTime;
          console.log(`${LOG_PREFIX} ✅ Returning COMPLETED (${totalMs}ms total)`);
          return NextResponse.json({
            status: 'completed',
            progress: 100,
            currentStep: 'Completed',
            outputUrl: presignedUrl,
            error: null
          });
        } else {
          // EC2 shows completed but callback hasn't arrived yet
          // Return processing status while waiting for callback with output URL
          const totalMs = Date.now() - requestStartTime;
          console.log(`${LOG_PREFIX} ⏳ Backend completed but no output URL yet - waiting for callback (${totalMs}ms total)`);
          return NextResponse.json({
            status: 'processing',
            progress: 95,
            currentStep: 'Finalizing (waiting for output)',
            outputUrl: null,
            error: null
          });
        }
      }

      if (backendStatus.status === 'failed' || backendStatus.status === 'error') {
        const errorMsg = resultError || backendStatus.error || 'Render failed';
        console.error(`${LOG_PREFIX} ❌ Backend reports FAILED:`, {
          errorMsg: errorMsg.substring(0, 200),
          backendStatus: backendStatus.status,
        });

        const updateStart = Date.now();
        await withRetry(() =>
          prisma.videoGeneration.update({
            where: { id: generationId },
            data: {
              status: 'FAILED',
              errorMessage: errorMsg
            }
          })
        );
        console.log(`${LOG_PREFIX} DB updated to FAILED (${Date.now() - updateStart}ms)`);

        const totalMs = Date.now() - requestStartTime;
        console.log(`${LOG_PREFIX} Returning FAILED (${totalMs}ms total)`);
        return NextResponse.json({
          status: 'failed',
          progress: 0,
          currentStep: 'Failed',
          outputUrl: null,
          error: errorMsg
        });
      }

      // Still processing - calculate estimated progress
      // EC2 with cold start: ~120s total (90s cold start + 20s GPU render)
      // Modal/Local: ~50s total
      let estimatedProgress = 50; // Default mid-way
      let elapsedSeconds = 0;

      if (createdAt) {
        elapsedSeconds = (Date.now() - new Date(createdAt).getTime()) / 1000;

        if (renderBackend === 'ec2') {
          // EC2 has cold start overhead (~90s) + GPU render (~20s)
          if (elapsedSeconds < 90) {
            // Cold start phase (0-90s) → show 5-35%
            estimatedProgress = 5 + Math.floor((elapsedSeconds / 90) * 30);
          } else {
            // Rendering phase (90s+) → show 35-95%
            const renderElapsed = elapsedSeconds - 90;
            estimatedProgress = 35 + Math.min(60, Math.floor((renderElapsed / 30) * 60));
          }
        } else {
          // Modal/Local: ~50 seconds total
          estimatedProgress = Math.min(90, Math.floor((elapsedSeconds / 50) * 100));
        }
      }

      // Determine render backend for status message
      let backendName = 'Cloud';
      if (renderBackend === 'local') backendName = 'Local';
      else if (renderBackend === 'ec2') backendName = 'EC2 (GPU)';
      else if (renderBackend === 'modal') backendName = 'Modal';

      const totalMs = Date.now() - requestStartTime;
      console.log(`${LOG_PREFIX} 🔄 Still PROCESSING (${totalMs}ms total):`, {
        backendName,
        elapsedSeconds: Math.round(elapsedSeconds),
        estimatedProgress,
        backendStatus: backendStatus.status,
      });

      return NextResponse.json({
        status: 'processing',
        progress: estimatedProgress,
        currentStep: `Rendering on ${backendName}`,
        outputUrl: null,
        error: null
      });

    } catch (modalError) {
      const backendPollMs = Date.now() - backendPollStart;
      console.error(`${LOG_PREFIX} ⚠️ Backend status check FAILED (${backendPollMs}ms):`, {
        error: modalError instanceof Error ? modalError.message : 'Unknown error',
        stack: modalError instanceof Error ? modalError.stack?.substring(0, 300) : undefined,
      });

      // Return current database status as fallback
      const totalMs = Date.now() - requestStartTime;
      console.log(`${LOG_PREFIX} Returning fallback DB status (${totalMs}ms total)`);
      const fallbackRawUrl = generation.composedOutputUrl || generation.outputUrl;
      const fallbackUrl = fallbackRawUrl ? await getPresignedUrlFromS3Url(fallbackRawUrl) : null;
      return NextResponse.json({
        status: generation.status.toLowerCase(),
        progress: generation.progress || 0,
        currentStep: 'Processing (status check failed)',
        outputUrl: fallbackUrl,
        error: null
      });
    }

  } catch (error) {
    const totalMs = Date.now() - requestStartTime;
    console.error(`${LOG_PREFIX} ========================================`);
    console.error(`${LOG_PREFIX} REQUEST FAILED (${totalMs}ms)`);
    console.error(`${LOG_PREFIX} Error:`, error);
    console.error(`${LOG_PREFIX} Message:`, error instanceof Error ? error.message : 'Unknown');
    console.error(`${LOG_PREFIX} Stack:`, error instanceof Error ? error.stack : '(no stack)');
    console.error(`${LOG_PREFIX} ========================================`);
    return NextResponse.json(
      { detail: 'Failed to check status' },
      { status: 500 }
    );
  }
}
