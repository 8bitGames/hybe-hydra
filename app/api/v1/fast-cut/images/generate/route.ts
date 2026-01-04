/**
 * Fast Cut AI Image Generation API
 * =================================
 * Generates AI images for each scene using Vertex AI Imagen 3
 *
 * POST /api/v1/fast-cut/images/generate
 *
 * Flow:
 * 1. Receive scene prompts (from generate-prompts API)
 * 2. Submit image generation jobs to EC2 compose-engine
 * 3. Poll for completion
 * 4. Return generated images with S3 URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import {
  submitImageGeneration,
  getAIJobStatus,
  generateAIJobId,
  type ImageAspectRatio,
} from '@/lib/ec2/ai-client';
// Images are stored in S3, need presigned URL for private bucket access
import { getPresignedUrlFromS3Url } from '@/lib/storage';
import { convertAspectRatioForGeminiImage } from '@/lib/imagen';

// ============================================================================
// Types
// ============================================================================

interface ScenePromptInput {
  sceneNumber: number;
  imagePrompt: string;
  negativePrompt?: string;
}

interface GenerateImagesRequest {
  scenes: ScenePromptInput[];
  aspectRatio?: '9:16' | '16:9' | '1:1';
  sessionId?: string;
}

interface GeneratedImage {
  sceneNumber: number;
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  s3Key?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'hydra-assets-hybe';
const POLL_INTERVAL_MS = 3000; // 3 seconds
const MAX_WAIT_TIME_MS = 300000; // 5 minutes per image
const MAX_CONCURRENT_GENERATIONS = 3; // Limit concurrent generations

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a single image via EC2 compose-engine
 */
async function generateSingleImage(
  prompt: string,
  negativePrompt: string | undefined,
  aspectRatio: string,
  sceneNumber: number,
  sessionId: string,
  logPrefix: string
): Promise<GeneratedImage> {
  const jobId = generateAIJobId('fastcut-img');
  const s3Key = `fast-cut/${sessionId}/scene-${sceneNumber}-${jobId}.png`;

  console.log(`${logPrefix} [Scene ${sceneNumber}] Submitting image generation job: ${jobId}`);
  console.log(`${logPrefix} [Scene ${sceneNumber}] Prompt: ${prompt.slice(0, 100)}...`);

  // Submit job to EC2 compose-engine
  const submitResult = await submitImageGeneration(
    jobId,
    {
      prompt,
      negative_prompt: negativePrompt || 'blurry, low quality, text, watermark, logo, distorted, deformed, ugly, bad anatomy',
      aspect_ratio: convertAspectRatioForGeminiImage(aspectRatio) as ImageAspectRatio,
      number_of_images: 1,
      safety_filter_level: 'block_some',
      person_generation: 'allow_adult',
    },
    {
      s3_bucket: AWS_S3_BUCKET,
      s3_key: s3Key,
    }
  );

  if (submitResult.status === 'error') {
    console.error(`${logPrefix} [Scene ${sceneNumber}] Job submit failed: ${submitResult.error}`);
    return {
      sceneNumber,
      success: false,
      error: `EC2 submit failed: ${submitResult.error}`,
    };
  }

  console.log(`${logPrefix} [Scene ${sceneNumber}] Job queued: ${submitResult.ec2_job_id || submitResult.job_id}`);

  // Poll for completion
  const startTime = Date.now();
  const jobIdToCheck = submitResult.ec2_job_id || submitResult.job_id;

  while (Date.now() - startTime < MAX_WAIT_TIME_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const status = await getAIJobStatus(jobIdToCheck, 'image_generation');
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    console.log(`${logPrefix} [Scene ${sceneNumber}] Status: ${status.status} (${elapsed}s elapsed)`);

    if (status.mappedStatus === 'completed') {
      // Job completed - download from S3
      console.log(`${logPrefix} [Scene ${sceneNumber}] Job completed!`);
      console.log(`${logPrefix} [Scene ${sceneNumber}] Output URL: ${status.output_url?.slice(0, 80)}...`);

      try {
        // Use output_url from compose-engine (S3 URL)
        const imageUrl = status.output_url;

        if (!imageUrl) {
          throw new Error('No output_url in job status response');
        }

        // Download image from S3 - need presigned URL for private bucket
        const presignedUrl = await getPresignedUrlFromS3Url(imageUrl);
        const response = await fetch(presignedUrl);
        if (!response.ok) {
          throw new Error(`Failed to download from S3: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const imageBase64 = Buffer.from(arrayBuffer).toString('base64');

        console.log(`${logPrefix} [Scene ${sceneNumber}] Downloaded image: ${imageBase64.length} chars base64`);

        return {
          sceneNumber,
          success: true,
          imageUrl: presignedUrl, // Return presigned URL for direct access
          imageBase64,
          s3Key,
        };
      } catch (downloadError) {
        console.error(`${logPrefix} [Scene ${sceneNumber}] Failed to download generated image:`, downloadError);
        return {
          sceneNumber,
          success: false,
          error: `Failed to download generated image: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`,
        };
      }
    }

    if (status.mappedStatus === 'failed') {
      console.error(`${logPrefix} [Scene ${sceneNumber}] Job failed: ${status.error}`);
      return {
        sceneNumber,
        success: false,
        error: `Image generation failed: ${status.error || 'Unknown error'}`,
      };
    }
  }

  // Timeout
  console.error(`${logPrefix} [Scene ${sceneNumber}] Job timed out after ${MAX_WAIT_TIME_MS / 1000}s`);
  return {
    sceneNumber,
    success: false,
    error: `Image generation timed out after ${MAX_WAIT_TIME_MS / 1000} seconds`,
  };
}

/**
 * Generate images in batches to limit concurrent operations
 */
async function generateImagesInBatches(
  scenes: ScenePromptInput[],
  aspectRatio: string,
  sessionId: string,
  logPrefix: string
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];

  // Process in batches
  for (let i = 0; i < scenes.length; i += MAX_CONCURRENT_GENERATIONS) {
    const batch = scenes.slice(i, i + MAX_CONCURRENT_GENERATIONS);
    console.log(`${logPrefix} Processing batch ${Math.floor(i / MAX_CONCURRENT_GENERATIONS) + 1}: scenes ${batch.map(s => s.sceneNumber).join(', ')}`);

    const batchPromises = batch.map((scene) =>
      generateSingleImage(
        scene.imagePrompt,
        scene.negativePrompt,
        aspectRatio,
        scene.sceneNumber,
        sessionId,
        logPrefix
      )
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // Sort by scene number
  return results.sort((a, b) => a.sceneNumber - b.sceneNumber);
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const logPrefix = '[FastCut AI Images]';

  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: GenerateImagesRequest = await request.json();
    const { scenes, aspectRatio = '9:16', sessionId } = body;

    // Validate required fields
    if (!scenes || scenes.length === 0) {
      return NextResponse.json(
        { detail: 'Missing required field: scenes' },
        { status: 400 }
      );
    }

    // Validate scene prompts
    for (const scene of scenes) {
      if (!scene.imagePrompt || scene.sceneNumber === undefined) {
        return NextResponse.json(
          { detail: 'Each scene must have imagePrompt and sceneNumber' },
          { status: 400 }
        );
      }
    }

    // Generate session ID if not provided
    const effectiveSessionId = sessionId || `fastcut-${Date.now()}-${uuidv4().slice(0, 8)}`;

    console.log(`${logPrefix} Starting image generation for ${scenes.length} scenes`);
    console.log(`${logPrefix} Session ID: ${effectiveSessionId}`);
    console.log(`${logPrefix} Aspect Ratio: ${aspectRatio}`);

    // Generate images
    const generatedImages = await generateImagesInBatches(
      scenes,
      aspectRatio,
      effectiveSessionId,
      logPrefix
    );

    // Count successes and failures
    const successCount = generatedImages.filter((img) => img.success).length;
    const failureCount = generatedImages.filter((img) => !img.success).length;

    console.log(`${logPrefix} Generation complete: ${successCount} success, ${failureCount} failed`);

    return NextResponse.json({
      success: failureCount === 0,
      sessionId: effectiveSessionId,
      totalScenes: scenes.length,
      successCount,
      failureCount,
      images: generatedImages,
    });
  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return NextResponse.json(
      { detail: 'Failed to generate images' },
      { status: 500 }
    );
  }
}
