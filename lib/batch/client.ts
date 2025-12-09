/**
 * AWS Batch Client for Video Rendering
 *
 * Submits render jobs to AWS Batch GPU queue (g4dn.xlarge/2xlarge Spot instances)
 * Uses the same interface as Modal client for easy switching
 *
 * AWS Batch Flow: Next.js (Vercel) → AWS Batch → S3 → Callback to Next.js
 *
 * GPU Stack (AWS Batch):
 *   - Instance: g4dn.xlarge (T4 GPU) or g4dn.2xlarge
 *   - Base: nvidia/cuda:12.4.0-devel-ubuntu22.04
 *   - FFmpeg: jellyfin-ffmpeg6 (has h264_nvenc baked in)
 *   - Encoder: h264_nvenc (5-10x faster than CPU)
 *
 * Required Environment Variables:
 *   - AWS_ACCESS_KEY_ID: IAM user with Batch permissions
 *   - AWS_SECRET_ACCESS_KEY: IAM user secret
 *   - AWS_BATCH_JOB_QUEUE: Job queue name (e.g., hydra-compose-gpu-queue)
 *   - AWS_BATCH_JOB_DEFINITION: Job definition name (e.g., hydra-compose-gpu-render)
 *   - AWS_REGION: AWS region (e.g., ap-northeast-2)
 */

import { BatchClient, SubmitJobCommand, DescribeJobsCommand } from '@aws-sdk/client-batch';

// AWS Batch configuration
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const AWS_BATCH_JOB_QUEUE = process.env.AWS_BATCH_JOB_QUEUE || 'hydra-compose-gpu-queue';
const AWS_BATCH_JOB_DEFINITION = process.env.AWS_BATCH_JOB_DEFINITION || 'hydra-compose-gpu-render';
const BATCH_CALLBACK_SECRET = process.env.BATCH_CALLBACK_SECRET || process.env.MODAL_CALLBACK_SECRET || 'hydra-modal-callback-secret';

// Lazy-initialized client (to avoid errors at import time if env vars missing)
let batchClient: BatchClient | null = null;

function getBatchClient(): BatchClient {
  if (!batchClient) {
    batchClient = new BatchClient({
      region: AWS_REGION,
      // Credentials from environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
      // Or from IAM role if running on AWS
    });
  }
  return batchClient;
}

// Callback URL for AWS Batch to notify us when render completes
function getCallbackUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hydra-sand-theta.vercel.app';
  return `${baseUrl}/api/v1/fast-cut/callback`;
}

// AI Effect Selection types (same as Modal)
export interface AIEffectSelection {
  transitions?: string[];
  motions?: string[];
  filters?: string[];
  text_animations?: string[];
  analysis?: Record<string, unknown>;
}

export interface BatchRenderRequest {
  job_id: string;
  images: Array<{
    url: string;
    order: number;
  }>;
  // Audio is optional - videos can be generated without background music
  audio: {
    url: string;
    start_time: number;
    duration: number | null;
  } | null;
  script?: {
    lines: Array<{
      text: string;
      timing: number;
      duration: number;
    }>;
  } | null;
  settings: {
    vibe: string;
    effect_preset: string;
    aspect_ratio: string;
    target_duration: number;
    text_style: string;
    color_grade: string;
    // AI Effect Selection System
    use_ai_effects?: boolean;
    ai_prompt?: string;
    ai_effects?: AIEffectSelection;
  };
  output: {
    s3_bucket: string;
    s3_key: string;
  };
}

export interface BatchSubmitResponse {
  job_id: string;      // Our job ID (same as input)
  batch_job_id: string; // AWS Batch job ID
  status: 'queued' | 'error';
  message?: string;
  error?: string;
}

export interface BatchStatusResponse {
  status: 'pending' | 'runnable' | 'starting' | 'running' | 'succeeded' | 'failed';
  job_id: string;
  batch_job_id: string;
  statusReason?: string;
  // Mapped status for compatibility with Modal client
  mappedStatus: 'processing' | 'completed' | 'failed';
}

/**
 * Submit a render job to AWS Batch
 * Returns immediately with job IDs for tracking
 */
export async function submitRenderToBatch(
  request: BatchRenderRequest
): Promise<BatchSubmitResponse> {
  const client = getBatchClient();

  // Prepare the job parameters (passed to container via environment)
  const jobParameters = {
    ...request,
    callback_url: getCallbackUrl(),
    callback_secret: BATCH_CALLBACK_SECRET,
  };

  try {
    const command = new SubmitJobCommand({
      jobName: `render-${request.job_id}`,
      jobQueue: AWS_BATCH_JOB_QUEUE,
      jobDefinition: AWS_BATCH_JOB_DEFINITION,
      containerOverrides: {
        environment: [
          {
            name: 'BATCH_JOB_PARAMETERS',
            value: JSON.stringify(jobParameters),
          },
        ],
      },
    });

    const response = await client.send(command);

    console.log(`[AWS Batch] Job submitted: ${response.jobId} for render ${request.job_id}`);

    return {
      job_id: request.job_id,
      batch_job_id: response.jobId || '',
      status: 'queued',
      message: `Job submitted to AWS Batch queue: ${AWS_BATCH_JOB_QUEUE}`,
    };
  } catch (error) {
    console.error('[AWS Batch] Submit error:', error);
    return {
      job_id: request.job_id,
      batch_job_id: '',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the status of an AWS Batch job
 */
export async function getBatchJobStatus(batchJobId: string): Promise<BatchStatusResponse> {
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
        statusReason: 'Job not found',
        mappedStatus: 'failed',
      };
    }

    // Map AWS Batch status to our status format
    const statusMap: Record<string, BatchStatusResponse['mappedStatus']> = {
      SUBMITTED: 'processing',
      PENDING: 'processing',
      RUNNABLE: 'processing',
      STARTING: 'processing',
      RUNNING: 'processing',
      SUCCEEDED: 'completed',
      FAILED: 'failed',
    };

    return {
      status: (job.status?.toLowerCase() || 'pending') as BatchStatusResponse['status'],
      job_id: job.jobName?.replace('render-', '') || '',
      batch_job_id: batchJobId,
      statusReason: job.statusReason,
      mappedStatus: statusMap[job.status || ''] || 'processing',
    };
  } catch (error) {
    console.error('[AWS Batch] Status check error:', error);
    return {
      status: 'failed',
      job_id: '',
      batch_job_id: batchJobId,
      statusReason: error instanceof Error ? error.message : 'Unknown error',
      mappedStatus: 'failed',
    };
  }
}

/**
 * Submit multiple render jobs to AWS Batch (batch processing)
 */
export async function submitBatchRenderJobs(
  jobs: BatchRenderRequest[]
): Promise<{
  batch_id: string;
  total_jobs: number;
  results: BatchSubmitResponse[];
  status: 'queued' | 'partial' | 'error';
}> {
  const results: BatchSubmitResponse[] = [];

  // Submit all jobs (AWS Batch handles parallel execution)
  for (const job of jobs) {
    const result = await submitRenderToBatch(job);
    results.push(result);
  }

  const successCount = results.filter(r => r.status === 'queued').length;
  const status = successCount === jobs.length ? 'queued' :
                 successCount > 0 ? 'partial' : 'error';

  return {
    batch_id: `batch-${Date.now()}`,
    total_jobs: jobs.length,
    results,
    status,
  };
}
