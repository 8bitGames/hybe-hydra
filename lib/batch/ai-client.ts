/**
 * Unified AI Client for AI Generation (Veo 3.1, Gemini 3 Pro Image)
 *
 * Uses EC2 compose-engine server for all AI generation jobs.
 *
 * EC2 Flow: Next.js (Vercel) → EC2 compose-engine → Vertex AI → S3 → Callback to Next.js
 *
 * GPU Stack:
 *   - Instance: g4dn.xlarge (T4 GPU) or g4dn.2xlarge
 *   - Authentication: GCP Workload Identity Federation (WIF)
 *   - AI Models: Veo 3.1 (video), Gemini 3 Pro Image (image) via Vertex AI
 *
 * Required Environment Variables:
 *   - EC2_COMPOSE_URL: EC2 compose-engine URL
 */

// ============================================================
// Mode Configuration
// ============================================================

// Compose engine mode: 'ec2' (default)
const COMPOSE_ENGINE_MODE = process.env.COMPOSE_ENGINE_MODE || 'ec2';

// EC2 compose-engine URL
const EC2_COMPOSE_URL = process.env.EC2_COMPOSE_URL || 'http://15.164.236.53:8000';

/**
 * Check if running in EC2 mode
 */
export function isEC2Mode(): boolean {
  return COMPOSE_ENGINE_MODE === 'ec2';
}

/**
 * Check if running in AWS Batch mode
 */
export function isBatchMode(): boolean {
  return COMPOSE_ENGINE_MODE === 'batch';
}

/**
 * Get current AI engine mode
 */
export function getAIEngineMode(): 'batch' | 'ec2' {
  return COMPOSE_ENGINE_MODE as 'batch' | 'ec2';
}

// ============================================================
// AWS Batch Configuration
// ============================================================

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
  status: 'pending' | 'runnable' | 'starting' | 'running' | 'succeeded' | 'failed' | 'queued' | 'processing' | 'completed';
  job_id: string;
  batch_job_id: string;
  job_type: AIJobType;
  statusReason?: string;
  mappedStatus: 'processing' | 'completed' | 'failed';
  /** Output URL (available when completed) */
  output_url?: string;
  /** Progress percentage (0-100) */
  progress?: number;
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
 * Submit an AI generation job to AWS Batch (internal)
 */
async function submitAIJobToBatch(request: AIJobRequest): Promise<AIJobSubmitResponse> {
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
 * Submit an AI generation job to EC2 compose-engine (internal)
 */
async function submitAIJobToEC2(request: AIJobRequest): Promise<AIJobSubmitResponse> {
  const url = `${EC2_COMPOSE_URL}/api/v1/ai/generate`;

  // Ensure callback info is set
  const jobParameters = {
    ...request,
    callback_url: request.callback_url || getAICallbackUrl(),
    callback_secret: request.callback_secret || AI_CALLBACK_SECRET,
  };

  console.log(`[EC2 AI] Submitting ${request.job_type} job to: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobParameters),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EC2 AI submit failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log(`[EC2 AI] Job submitted: ${data.job_id} for ${request.job_type}`);

    return {
      job_id: data.job_id,
      batch_job_id: data.job_id,  // Use job_id as batch_job_id for compatibility
      job_type: data.job_type || request.job_type,
      status: data.status === 'queued' ? 'queued' : 'error',
      message: data.message || `AI job submitted to EC2: ${EC2_COMPOSE_URL}`,
    };
  } catch (error) {
    console.error('[EC2 AI] Submit error:', error);
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
 * Submit an AI generation job (auto-selects Batch or EC2 based on COMPOSE_ENGINE_MODE)
 */
export async function submitAIJob(request: AIJobRequest): Promise<AIJobSubmitResponse> {
  if (isEC2Mode()) {
    console.log(`[AI Client] Using EC2 mode for ${request.job_type}`);
    return submitAIJobToEC2(request);
  } else {
    console.log(`[AI Client] Using AWS Batch mode for ${request.job_type}`);
    return submitAIJobToBatch(request);
  }
}

/**
 * Get the status of an AI generation job from AWS Batch (internal)
 */
async function getAIJobStatusFromBatch(
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

/**
 * Get the status of an AI generation job from EC2 compose-engine (internal)
 */
async function getAIJobStatusFromEC2(
  jobId: string,
  jobType: AIJobType = 'video_generation'
): Promise<AIJobStatusResponse> {
  const url = `${EC2_COMPOSE_URL}/api/v1/ai/job/${jobId}/status`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return {
        status: 'failed',
        job_id: jobId,
        batch_job_id: jobId,
        job_type: jobType,
        statusReason: 'Job not found',
        mappedStatus: 'failed',
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EC2 AI status check failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Map EC2 status to unified status format
    const statusMap: Record<string, AIJobStatusResponse['mappedStatus']> = {
      queued: 'processing',
      processing: 'processing',
      uploading: 'processing',
      completed: 'completed',
      failed: 'failed',
    };

    return {
      status: data.status || 'processing',
      job_id: data.job_id || jobId,
      batch_job_id: jobId,  // For compatibility
      job_type: data.job_type || jobType,
      statusReason: data.error || data.current_step,
      mappedStatus: statusMap[data.status] || 'processing',
      output_url: data.output_url,
      progress: data.progress,
    };
  } catch (error) {
    console.error('[EC2 AI] Status check error:', error);
    return {
      status: 'failed',
      job_id: jobId,
      batch_job_id: jobId,
      job_type: jobType,
      statusReason: error instanceof Error ? error.message : 'Unknown error',
      mappedStatus: 'failed',
    };
  }
}

/**
 * Get the status of an AI generation job (auto-selects Batch or EC2 based on COMPOSE_ENGINE_MODE)
 */
export async function getAIJobStatus(
  jobIdOrBatchJobId: string,
  jobType: AIJobType = 'video_generation'
): Promise<AIJobStatusResponse> {
  if (isEC2Mode()) {
    return getAIJobStatusFromEC2(jobIdOrBatchJobId, jobType);
  } else {
    return getAIJobStatusFromBatch(jobIdOrBatchJobId, jobType);
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

// ============================================================
// Polling Functions (Alternative to Callback)
// ============================================================

export interface PollOptions {
  /** Polling interval in milliseconds (default: 5000ms for EC2, 10000ms for Batch) */
  pollInterval?: number;
  /** Maximum wait time in milliseconds (default: 600000ms = 10 minutes) */
  maxWaitTime?: number;
  /** Callback function called on each poll with current status */
  onProgress?: (status: AIJobStatusResponse) => void;
  /** Callback function called on completion (success or failure) */
  onComplete?: (status: AIJobStatusResponse) => void;
}

/**
 * Poll an AI job until completion (polling mode - no callback required)
 *
 * Use this instead of relying on callbacks for real-time status tracking.
 * Useful for:
 * - Local development where callbacks can't reach your server
 * - When you need more control over status checking
 * - As a fallback when callbacks fail
 *
 * @example
 * ```typescript
 * const result = await submitImageGeneration(jobId, settings, output);
 *
 * // Poll until complete
 * const finalStatus = await pollAIJobUntilComplete(result.job_id, {
 *   pollInterval: 3000,  // Check every 3 seconds
 *   onProgress: (status) => console.log(`Progress: ${status.statusReason}`),
 * });
 *
 * if (finalStatus.mappedStatus === 'completed') {
 *   console.log('Output URL:', finalStatus.output_url);
 * }
 * ```
 */
export async function pollAIJobUntilComplete(
  jobId: string,
  options: PollOptions = {}
): Promise<AIJobStatusResponse> {
  const {
    pollInterval = isEC2Mode() ? 5000 : 10000,  // EC2 is faster, poll more frequently
    maxWaitTime = 600000,  // 10 minutes
    onProgress,
    onComplete,
  } = options;

  const startTime = Date.now();
  let lastStatus: AIJobStatusResponse | null = null;

  console.log(`[AI Polling] Starting poll for job ${jobId} (mode: ${getAIEngineMode()}, interval: ${pollInterval}ms)`);

  while (true) {
    const status = await getAIJobStatus(jobId);
    lastStatus = status;

    // Call progress callback
    if (onProgress) {
      onProgress(status);
    }

    // Check if job is complete (success or failure)
    if (status.mappedStatus === 'completed' || status.mappedStatus === 'failed') {
      console.log(`[AI Polling] Job ${jobId} finished: ${status.mappedStatus}`);

      if (onComplete) {
        onComplete(status);
      }

      return status;
    }

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWaitTime) {
      console.warn(`[AI Polling] Job ${jobId} timed out after ${elapsed}ms`);

      const timeoutStatus: AIJobStatusResponse = {
        ...status,
        status: 'failed',
        mappedStatus: 'failed',
        statusReason: `Polling timeout after ${Math.round(elapsed / 1000)}s`,
      };

      if (onComplete) {
        onComplete(timeoutStatus);
      }

      return timeoutStatus;
    }

    // Log progress
    console.log(`[AI Polling] Job ${jobId}: ${status.status} - ${status.statusReason || 'processing'} (${Math.round(elapsed / 1000)}s elapsed)`);

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

/**
 * Submit an AI job and wait for completion using polling
 *
 * Combines submission and polling into a single call.
 * Does NOT use callbacks - uses polling instead.
 *
 * @example
 * ```typescript
 * const result = await submitAndWaitForAIJob({
 *   job_id: generateAIJobId('img'),
 *   job_type: 'image_generation',
 *   image_settings: { prompt: 'A sunset' },
 *   output: getAIOutputSettings(jobId, 'image_generation'),
 * }, {
 *   onProgress: (s) => console.log(s.statusReason),
 * });
 * ```
 */
export async function submitAndWaitForAIJob(
  request: Omit<AIJobRequest, 'callback_url' | 'callback_secret'>,
  pollOptions: PollOptions = {}
): Promise<{ submitResult: AIJobSubmitResponse; finalStatus: AIJobStatusResponse }> {
  // Submit without callback (polling mode)
  const submitResult = await submitAIJob({
    ...request,
    callback_url: undefined,  // No callback - will use polling
    callback_secret: undefined,
  });

  if (submitResult.status === 'error') {
    return {
      submitResult,
      finalStatus: {
        status: 'failed',
        job_id: request.job_id,
        batch_job_id: submitResult.batch_job_id || '',
        job_type: request.job_type,
        statusReason: submitResult.error || 'Submit failed',
        mappedStatus: 'failed',
      },
    };
  }

  // Poll until complete
  const finalStatus = await pollAIJobUntilComplete(submitResult.job_id, pollOptions);

  return { submitResult, finalStatus };
}
