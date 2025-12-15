/**
 * EC2 AI Client for Vertex AI Generation
 *
 * Submits AI generation jobs directly to EC2 compose-engine server.
 *
 * EC2 Flow: Next.js → EC2 compose-engine → Vertex AI → S3 → Callback to Next.js
 *
 * EC2 Stack:
 *   - Instance: g4dn.xlarge (T4 GPU)
 *   - Authentication: GCP Workload Identity Federation (WIF)
 *   - AI Models: Veo 3.1 (video), Gemini 3 Pro Image (image) via Vertex AI
 *
 * Required Environment Variables:
 *   - EC2_COMPOSE_URL: EC2 compose-engine URL (e.g., http://15.164.236.53:8000)
 *   - AI_CALLBACK_SECRET: Secret for callback authentication
 */

// EC2 compose-engine URL
const EC2_COMPOSE_URL = process.env.EC2_COMPOSE_URL || 'http://15.164.236.53:8000';
const AI_CALLBACK_SECRET = process.env.AI_CALLBACK_SECRET || process.env.BATCH_CALLBACK_SECRET || 'hydra-ai-callback-secret';

// Callback URL for EC2 to notify us when AI generation completes
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
export type VideoDuration = 4 | 6 | 8;
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
  ec2_job_id?: string;  // For compatibility, same as job_id
  job_type: AIJobType;
  status: 'queued' | 'error';
  message?: string;
  error?: string;
}

export interface AIJobStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  job_id: string;
  job_type?: AIJobType;
  progress?: number;
  current_step?: string;
  output_url?: string;
  error?: string;
  mappedStatus: 'processing' | 'completed' | 'failed';
}

// ============================================================
// API Functions
// ============================================================

/**
 * Submit an AI job to EC2 compose-engine
 */
async function submitToEC2(request: AIJobRequest): Promise<AIJobSubmitResponse> {
  const url = `${EC2_COMPOSE_URL}/api/v1/ai/generate`;

  console.log(`[EC2 AI] Submitting ${request.job_type} job to:`, url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EC2 AI submit failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      job_id: data.job_id,
      ec2_job_id: data.job_id,
      job_type: data.job_type || request.job_type,
      status: data.status === 'queued' ? 'queued' : 'error',
      message: data.message,
    };
  } catch (error) {
    console.error('[EC2 AI] Submit error:', error);
    return {
      job_id: request.job_id,
      job_type: request.job_type,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Submit a video generation job to EC2
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
      aspect_ratio: '9:16',
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

  return submitToEC2(request);
}

/**
 * Submit an image generation job to EC2
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
      aspect_ratio: '9:16',
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

  return submitToEC2(request);
}

/**
 * Submit an image-to-video generation job to EC2
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
      aspect_ratio: '9:16',
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

  return submitToEC2(request);
}

/**
 * Get the status of an AI generation job from EC2
 */
export async function getAIJobStatus(
  jobId: string,
  _jobType: AIJobType = 'video_generation'
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
        error: 'Job not found',
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
      job_type: data.job_type,
      progress: data.progress,
      current_step: data.current_step,
      output_url: data.output_url,
      error: data.error,
      mappedStatus: statusMap[data.status] || 'processing',
    };
  } catch (error) {
    console.error('[EC2 AI] Status check error:', error);
    return {
      status: 'failed',
      job_id: jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
      mappedStatus: 'failed',
    };
  }
}

/**
 * Check if EC2 AI service is healthy
 */
export async function checkEC2AIHealth(): Promise<{
  healthy: boolean;
  error?: string;
  details?: Record<string, unknown>;
}> {
  const url = `${EC2_COMPOSE_URL}/api/v1/ai/health`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        healthy: false,
        error: `Health check failed: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      healthy: data.status === 'healthy',
      error: data.error,
      details: data,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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

/**
 * Wait for an AI job to complete with polling
 */
export async function waitForAIJob(
  jobId: string,
  options: {
    jobType?: AIJobType;
    pollInterval?: number;
    maxWaitTime?: number;
    onProgress?: (status: AIJobStatusResponse) => void;
  } = {}
): Promise<AIJobStatusResponse> {
  const {
    jobType = 'video_generation',
    pollInterval = 5000,  // 5 seconds
    maxWaitTime = 600000, // 10 minutes
    onProgress,
  } = options;

  const startTime = Date.now();

  while (true) {
    const status = await getAIJobStatus(jobId, jobType);

    if (onProgress) {
      onProgress(status);
    }

    if (status.mappedStatus === 'completed' || status.mappedStatus === 'failed') {
      return status;
    }

    if (Date.now() - startTime > maxWaitTime) {
      return {
        status: 'failed',
        job_id: jobId,
        error: 'Timeout waiting for AI job',
        mappedStatus: 'failed',
      };
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}
