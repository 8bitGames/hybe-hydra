import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from '@supabase/supabase-js';
import { composeVideoWithAudio, type SubtitleEntry } from "@/lib/compose/client";
import { getPresignedUrlFromS3Url } from "@/lib/storage";
import type { LyricsData } from "@/lib/subtitle-styles/types";

// Initialize Supabase client for session updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
 * Process audio and lyrics composition for AI Video
 * Called after video generation completes if use_audio_lyrics is enabled
 *
 * Flow:
 * 1. Get audio asset URL and lyrics from metadata
 * 2. Apply audio_start_time offset to lyrics timing
 * 3. Call EC2 compose-engine to add audio + subtitles
 * 4. Update composedOutputUrl with final video
 */
async function processAudioLyricsComposition(
  generationId: string,
  videoUrl: string
): Promise<{ success: boolean; composedUrl?: string; error?: string }> {
  try {
    console.log(`[AI Callback] Starting audio+lyrics composition for ${generationId}`);

    // Fetch generation with audio asset
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        audioAsset: true,
      },
    });

    if (!generation) {
      return { success: false, error: "Generation not found" };
    }

    if (!generation.audioAssetId || !generation.audioAsset) {
      return { success: false, error: "No audio asset linked" };
    }

    const audioAsset = generation.audioAsset;
    const audioStartTime = generation.audioStartTime || 0;

    // Generate presigned URL for audio
    let audioUrl: string;
    try {
      audioUrl = await getPresignedUrlFromS3Url(audioAsset.s3Url, 3600); // 1 hour expiry
    } catch (err) {
      console.error(`[AI Callback] Failed to get audio presigned URL:`, err);
      return { success: false, error: "Failed to get audio URL" };
    }

    // Generate presigned URL for video
    let videoPresignedUrl: string;
    try {
      videoPresignedUrl = await getPresignedUrlFromS3Url(videoUrl, 3600);
    } catch (err) {
      console.error(`[AI Callback] Failed to get video presigned URL:`, err);
      // Try using the URL as-is if presigning fails
      videoPresignedUrl = videoUrl;
    }

    // Extract lyrics from audio asset metadata and convert to subtitles
    const subtitles: SubtitleEntry[] = [];
    const metadata = audioAsset.metadata as Record<string, unknown> | null;

    if (metadata?.lyrics) {
      const lyricsData = metadata.lyrics as LyricsData;

      if (!lyricsData.isInstrumental && lyricsData.segments?.length > 0) {
        console.log(`[AI Callback] Found ${lyricsData.segments.length} lyrics segments`);

        // Video duration (AI videos are typically 4-8 seconds)
        const videoDuration = generation.durationSeconds || 8;

        for (const segment of lyricsData.segments) {
          // Apply audio_start_time offset
          // Lyrics timestamps are relative to audio file start
          // Video playback starts at audioStartTime into the audio
          // Example: audioStartTime=60, segment.start=65 → video time = 5
          const adjustedStart = segment.start - audioStartTime;
          const adjustedEnd = segment.end - audioStartTime;

          // Skip segments outside video boundaries
          if (adjustedStart >= videoDuration || adjustedEnd <= 0) {
            continue;
          }

          // Clamp to video boundaries
          const clampedStart = Math.max(0, adjustedStart);
          const clampedEnd = Math.min(videoDuration, adjustedEnd);

          // Skip if too short (< 0.3s)
          if (clampedEnd - clampedStart < 0.3) {
            continue;
          }

          subtitles.push({
            text: segment.text.trim(),
            start: clampedStart,
            end: clampedEnd,
          });
        }

        console.log(`[AI Callback] Converted to ${subtitles.length} subtitle entries`);
      }
    }

    // Determine output S3 location
    const s3Bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "hydra-assets-hybe";
    const s3Key = `videos/ai-composed/${generationId}/output.mp4`;

    console.log(`[AI Callback] Calling EC2 compose-engine for audio+lyrics composition`);
    console.log(`[AI Callback] Video: ${videoPresignedUrl.slice(0, 60)}...`);
    console.log(`[AI Callback] Audio: ${audioUrl.slice(0, 60)}...`);
    console.log(`[AI Callback] Subtitles: ${subtitles.length} entries`);

    // Call EC2 compose-engine
    const result = await composeVideoWithAudio({
      job_id: `ai-compose-${generationId}`,
      video_url: videoPresignedUrl,
      audio_url: audioUrl,
      audio_start_time: audioStartTime,
      audio_volume: 1.0,
      fade_in: 0.3,
      fade_out: 0.3,
      mix_original_audio: false,  // Replace original audio
      original_audio_volume: 0.0,
      output_s3_bucket: s3Bucket,
      output_s3_key: s3Key,
      subtitles: subtitles.length > 0 ? subtitles : undefined,
      // Polling options
      pollInterval: 2000,  // Poll every 2 seconds
      maxWaitTime: 180000, // 3 minute timeout
      onProgress: (status) => {
        console.log(`[AI Callback] Compose progress: ${status.status}`);
      },
    });

    if (result.status === "completed" && result.output_url) {
      console.log(`[AI Callback] ✓ Audio+lyrics composition completed: ${result.output_url}`);
      return { success: true, composedUrl: result.output_url };
    } else {
      console.error(`[AI Callback] Composition failed:`, result.error);
      return { success: false, error: result.error || "Composition failed" };
    }
  } catch (err) {
    console.error(`[AI Callback] Audio+lyrics composition error:`, err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

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

      // If video generation completed successfully, check for audio+lyrics composition
      let composedOutputUrl: string | null = null;
      if (status === 'completed' && output_url) {
        const qualityMeta = updated.qualityMetadata as Record<string, unknown> | null;
        const useAudioLyrics = qualityMeta?.use_audio_lyrics === true;

        if (useAudioLyrics && updated.audioAssetId) {
          console.log(`[AI Callback] use_audio_lyrics enabled, starting EC2 compose-engine audio+lyrics composition`);

          // Process audio+lyrics composition via EC2 compose-engine
          const composeResult = await processAudioLyricsComposition(job_id, output_url);

          if (composeResult.success && composeResult.composedUrl) {
            composedOutputUrl = composeResult.composedUrl;

            // Update the generation with composed output URL
            await prisma.videoGeneration.update({
              where: { id: job_id },
              data: {
                composedOutputUrl: composedOutputUrl,
                qualityMetadata: {
                  ...(qualityMeta || {}),
                  audio_composition: {
                    completed_at: new Date().toISOString(),
                    composed_url: composedOutputUrl,
                  },
                },
              },
            });

            console.log(`[AI Callback] ✓ Updated composedOutputUrl for ${job_id}`);
          } else {
            // Log error but don't fail the overall callback
            console.error(`[AI Callback] Audio+lyrics composition failed for ${job_id}:`, composeResult.error);

            // Store the error in metadata
            await prisma.videoGeneration.update({
              where: { id: job_id },
              data: {
                qualityMetadata: {
                  ...(qualityMeta || {}),
                  audio_composition: {
                    error: composeResult.error,
                    failed_at: new Date().toISOString(),
                  },
                },
              },
            });
          }
        }
      }

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
        composed_output_url: composedOutputUrl,
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
