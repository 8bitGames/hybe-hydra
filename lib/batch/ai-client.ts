/**
 * AWS Batch Client for AI Generation (Veo 3.1, Gemini 3 Pro Image)
 *
 * Submits AI generation jobs to AWS Batch GPU queue.
 * Uses the same infrastructure as video rendering but with different job parameters.
 *
 * AWS Batch Flow: Next.js (Vercel) → AWS Batch → Vertex AI → S3 → Callback to Next.js
 *
 * GPU Stack (AWS Batch):
 *   - Instance: g4dn.xlarge (T4 GPU) or g4dn.2xlarge
 *   - Authentication: GCP Workload Identity Federation (WIF)
 *   - AI Models: Veo 3.1 (video), Gemini 3 Pro Image (image) via Vertex AI
 *
 * Required Environment Variables:
 *   - AWS_ACCESS_KEY_ID: IAM user with Batch permissions
 *   - AWS_SECRET_ACCESS_KEY: IAM user secret
 *   - AWS_BATCH_AI_JOB_QUEUE: Job queue name for AI jobs
 *   - AWS_BATCH_AI_JOB_DEFINITION: Job definition for AI worker
 *   - AWS_REGION: AWS region (e.g., ap-northeast-2)
 */

import { BatchClient, SubmitJobCommand, DescribeJobsCommand } from '@aws-sdk/client-batch';

// AWS Batch configuration for AI jobs
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const AWS_BATCH_AI_JOB_QUEUE = process.env.AWS_BATCH_AI_JOB_QUEUE || 'hydra-ai-gpu-queue';
const AWS_BATCH_AI_JOB_DEFINITION = process.env.AWS_BATCH_AI_JOB_DEFINITION || 'hydra-ai-gpu-worker';
const AI_CALLBACK_SECRET = process.env.AI_CALLBACK_SECRET || process.env.BATCH_CALLBACK_SECRET || 'hydra-ai-callback-secret';

// Lazy-initialized client
let batchClient: BatchClient | null = null;

function getBatchClient(): BatchClient {
  if (!batchClient) {
    batchClient = new BatchClient({
      region: AWS_REGION,
    });
  }
  return batchClient;
}

// Callback URL for AWS Batch to notify us when AI generation completes
function getAICallbackUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hydra.ai.kr';
  return `${baseUrl}/api/v1/ai/callback`;
}

// ============================================================
// Type Definitions
// ============================================================

export type AIJobType = 'video_generation' | 'image_generation' | 'image_to_video';

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';
export type ImageAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
export type VideoDuration = 4 | 6 | 8;  // Veo 3.1 supports 4, 6, or 8 seconds
export type PersonGeneration = 'allow_adult' | 'dont_allow';
export type SafetyFilterLevel = 'block_none' | 'block_few' | 'block_some' | 'block_most';

export interface SubtitleEntry {
  text: string;
  start: number;
  end: number;
}

export interface AudioOverlaySettings {
  audio_url: string;
  audio_start_time?: number;
  audio_volume?: number;
  fade_in?: number;
  fade_out?: number;
  mix_original_audio?: boolean;
  original_audio_volume?: number;
  subtitles?: SubtitleEntry[];
}

export interface VideoGenerationSettings {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: VideoAspectRatio;
  duration_seconds?: VideoDuration;
  person_generation?: PersonGeneration;
  generate_audio?: boolean;
  seed?: number;
  audio_overlay?: AudioOverlaySettings;
}

export interface ImageGenerationSettings {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: ImageAspectRatio;
  number_of_images?: number;
  safety_filter_level?: SafetyFilterLevel;
  person_generation?: PersonGeneration;
  seed?: number;
}

export interface ImageToVideoSettings extends VideoGenerationSettings {
  reference_image_url: string;
}

export interface AIOutputSettings {
  s3_bucket: string;
  s3_key: string;
  gcs_bucket?: string;
}

export interface AIJobRequest {
  job_id: string;
  job_type: AIJobType;
  video_settings?: VideoGenerationSettings;
  image_settings?: ImageGenerationSettings;
  i2v_settings?: ImageToVideoSettings;
  output: AIOutputSettings;
  callback_url?: string;
  callback_secret?: string;
  metadata?: Record<string, unknown>;
}

export interface AIJobSubmitResponse {
  job_id: string;
  batch_job_id: string;
  job_type: AIJobType;
  status: 'queued' | 'error';
  message?: string;
  error?: string;
}

export interface AIJobStatusResponse {
  status: 'pending' | 'runnable' | 'starting' | 'running' | 'succeeded' | 'failed';
  job_id: string;
  batch_job_id: string;
  job_type: AIJobType;
  statusReason?: string;
  mappedStatus: 'processing' | 'completed' | 'failed';
}

// ============================================================
// API Functions
// ============================================================

/**
 * Submit a video generation job to AWS Batch
 */
export async function submitVideoGeneration(
  jobId: string,
  settings: VideoGenerationSettings,
  output: AIOutputSettings,
  metadata?: Record<string, unknown>
): Promise<AIJobSubmitResponse> {
  const request: AIJobRequest = {
    job_id: jobId,
    job_type: 'video_generation',
    video_settings: {
      aspect_ratio: '9:16',  // Portrait for TikTok/Shorts/Reels
      duration_seconds: 8,
      person_generation: 'allow_adult',
      generate_audio: true,
      ...settings,
    },
    output,
    callback_url: getAICallbackUrl(),
    callback_secret: AI_CALLBACK_SECRET,
    metadata,
  };

  return submitAIJob(request);
}

/**
 * Submit an image generation job to AWS Batch
 */
export async function submitImageGeneration(
  jobId: string,
  settings: ImageGenerationSettings,
  output: AIOutputSettings,
  metadata?: Record<string, unknown>
): Promise<AIJobSubmitResponse> {
  const request: AIJobRequest = {
    job_id: jobId,
    job_type: 'image_generation',
    image_settings: {
      aspect_ratio: '9:16',  // Match Veo 3.1 video aspect ratio
      number_of_images: 1,
      safety_filter_level: 'block_some',
      person_generation: 'allow_adult',
      ...settings,
    },
    output,
    callback_url: getAICallbackUrl(),
    callback_secret: AI_CALLBACK_SECRET,
    metadata,
  };

  return submitAIJob(request);
}

/**
 * Submit an image-to-video generation job to AWS Batch
 */
export async function submitImageToVideo(
  jobId: string,
  settings: ImageToVideoSettings,
  output: AIOutputSettings,
  metadata?: Record<string, unknown>
): Promise<AIJobSubmitResponse> {
  const request: AIJobRequest = {
    job_id: jobId,
    job_type: 'image_to_video',
    i2v_settings: {
      aspect_ratio: '9:16',  // Portrait for TikTok/Shorts/Reels
      duration_seconds: 8,
      person_generation: 'allow_adult',
      generate_audio: true,
      ...settings,
    },
    output,
    callback_url: getAICallbackUrl(),
    callback_secret: AI_CALLBACK_SECRET,
    metadata,
  };

  return submitAIJob(request);
}

/**
 * Submit an AI generation job to AWS Batch
 */
export async function submitAIJob(request: AIJobRequest): Promise<AIJobSubmitResponse> {
  const client = getBatchClient();

  // Ensure callback info is set
  const jobParameters = {
    ...request,
    callback_url: request.callback_url || getAICallbackUrl(),
    callback_secret: request.callback_secret || AI_CALLBACK_SECRET,
  };

  try {
    const command = new SubmitJobCommand({
      jobName: `ai-${request.job_type}-${request.job_id}`,
      jobQueue: AWS_BATCH_AI_JOB_QUEUE,
      jobDefinition: AWS_BATCH_AI_JOB_DEFINITION,
      containerOverrides: {
        environment: [
          {
            name: 'BATCH_JOB_PARAMETERS',
            value: JSON.stringify(jobParameters),
          },
        ],
        // Use ai_worker.py as entrypoint
        command: ['python3', '/root/ai_worker.py'],
      },
    });

    const response = await client.send(command);

    console.log(`[AWS Batch AI] Job submitted: ${response.jobId} for ${request.job_type} ${request.job_id}`);

    return {
      job_id: request.job_id,
      batch_job_id: response.jobId || '',
      job_type: request.job_type,
      status: 'queued',
      message: `AI job submitted to AWS Batch queue: ${AWS_BATCH_AI_JOB_QUEUE}`,
    };
  } catch (error) {
    console.error('[AWS Batch AI] Submit error:', error);
    return {
      job_id: request.job_id,
      batch_job_id: '',
      job_type: request.job_type,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the status of an AI generation job
 */
export async function getAIJobStatus(
  batchJobId: string,
  jobType: AIJobType = 'video_generation'
): Promise<AIJobStatusResponse> {
  const client = getBatchClient();

  try {
    const command = new DescribeJobsCommand({
      jobs: [batchJobId],
    });

    const response = await client.send(command);
    const job = response.jobs?.[0];

    if (!job) {
      return {
        status: 'failed',
        job_id: '',
        batch_job_id: batchJobId,
        job_type: jobType,
        statusReason: 'Job not found',
        mappedStatus: 'failed',
      };
    }

    // Map AWS Batch status to our status format
    const statusMap: Record<string, AIJobStatusResponse['mappedStatus']> = {
      SUBMITTED: 'processing',
      PENDING: 'processing',
      RUNNABLE: 'processing',
      STARTING: 'processing',
      RUNNING: 'processing',
      SUCCEEDED: 'completed',
      FAILED: 'failed',
    };

    return {
      status: (job.status?.toLowerCase() || 'pending') as AIJobStatusResponse['status'],
      job_id: job.jobName?.replace(/^ai-(video_generation|image_generation|image_to_video)-/, '') || '',
      batch_job_id: batchJobId,
      job_type: jobType,
      statusReason: job.statusReason,
      mappedStatus: statusMap[job.status || ''] || 'processing',
    };
  } catch (error) {
    console.error('[AWS Batch AI] Status check error:', error);
    return {
      status: 'failed',
      job_id: '',
      batch_job_id: batchJobId,
      job_type: jobType,
      statusReason: error instanceof Error ? error.message : 'Unknown error',
      mappedStatus: 'failed',
    };
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate a unique job ID
 */
export function generateAIJobId(prefix: string = 'ai'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Get S3 output settings for a job
 */
export function getAIOutputSettings(
  jobId: string,
  jobType: AIJobType,
  bucket: string = process.env.NEXT_PUBLIC_S3_BUCKET || process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'hydra-assets-seoul'
): AIOutputSettings {
  const extension = jobType === 'image_generation' ? 'png' : 'mp4';
  const folder = jobType === 'image_generation' ? 'images' : 'videos';

  return {
    s3_bucket: bucket,
    s3_key: `ai/${folder}/${jobId}/output.${extension}`,
  };
}
