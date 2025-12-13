/**
 * Compose Engine Client for Video Rendering
 *
 * Supports two modes:
 *   - batch (default): AWS Batch GPU (production - AWS infrastructure)
 *   - local: Local compose-engine Docker container (development)
 *
 * Batch Flow: Next.js → AWS Batch (GPU g4dn + NVENC) → S3
 * Local Flow: Next.js → Docker compose-engine (CPU) → S3
 *
 * GPU Stack (AWS Batch):
 *   - Instance: g4dn.xlarge (T4 GPU) or g4dn.2xlarge
 *   - Base: nvidia/cuda:12.4.0-devel-ubuntu22.04
 *   - FFmpeg: jellyfin-ffmpeg6 (has h264_nvenc baked in)
 *   - Encoder: h264_nvenc (5-10x faster than CPU)
 */

// Compose engine mode: 'batch' (default) or 'local' (development)
// Note: 'modal' mode has been removed - use 'batch' for production
const COMPOSE_ENGINE_MODE = process.env.COMPOSE_ENGINE_MODE || 'batch';

// Local compose engine (development)
const LOCAL_COMPOSE_URL = process.env.LOCAL_COMPOSE_URL || 'http://localhost:8000';

// Compose engine URL (for batch mode, points to deployed compose-engine)
const COMPOSE_ENGINE_URL = process.env.MODAL_COMPOSE_URL || LOCAL_COMPOSE_URL;

/**
 * Check if running in local development mode
 */
export function isLocalMode(): boolean {
  return COMPOSE_ENGINE_MODE === 'local';
}

/**
 * Check if running in AWS Batch mode
 */
export function isBatchMode(): boolean {
  return COMPOSE_ENGINE_MODE === 'batch';
}

/**
 * Get current compose engine mode
 */
export function getComposeEngineMode(): 'batch' | 'local' {
  return COMPOSE_ENGINE_MODE as 'batch' | 'local';
}

// AI Effect Selection types
export interface AIEffectSelection {
  transitions?: string[];
  motions?: string[];
  filters?: string[];
  text_animations?: string[];
  analysis?: Record<string, unknown>;
}

export interface ComposeRenderRequest {
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
  // Optional callback for auto-updating database on completion
  callback_url?: string;
  callback_secret?: string;
}

// Legacy alias for backward compatibility
export type ModalRenderRequest = ComposeRenderRequest;

export interface ComposeSubmitResponse {
  call_id: string;
  job_id: string;
  status: 'queued' | 'error';
  message?: string;
  error?: string;
}

// Legacy alias for backward compatibility
export type ModalSubmitResponse = ComposeSubmitResponse;

export interface ComposeStatusResponse {
  status: 'processing' | 'completed' | 'failed' | 'error';
  call_id?: string;
  result?: {
    status: string;
    job_id: string;
    output_url: string | null;
    error: string | null;
  };
  error?: string;
}

// Legacy alias for backward compatibility
export type ModalStatusResponse = ComposeStatusResponse;

/**
 * Submit a render job to local compose engine (development)
 * Uses job_id as call_id for unified status polling
 */
async function submitToLocal(
  request: ComposeRenderRequest
): Promise<ComposeSubmitResponse> {
  const url = `${LOCAL_COMPOSE_URL}/render`;

  console.log('[Local Compose] Submitting to:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Local compose submit failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Map local response to unified response format
  return {
    call_id: data.job_id,
    job_id: data.job_id,
    status: data.status === 'accepted' ? 'queued' : 'error',
    message: data.message,
  };
}

/**
 * Submit a render job to AWS Batch (production)
 */
async function submitToBatch(
  request: ComposeRenderRequest
): Promise<ComposeSubmitResponse> {
  // Dynamic import to avoid loading AWS SDK when not needed
  const { submitRenderToBatch } = await import('@/lib/batch/client');

  const result = await submitRenderToBatch({
    job_id: request.job_id,
    images: request.images,
    audio: request.audio,
    script: request.script,
    settings: request.settings,
    output: request.output,
  });

  // Map Batch response to unified response format
  return {
    call_id: result.batch_job_id,
    job_id: result.job_id,
    status: result.status === 'queued' ? 'queued' : 'error',
    message: result.message,
    error: result.error,
  };
}

/**
 * Submit a render job (auto-selects Batch or Local based on COMPOSE_ENGINE_MODE)
 * Returns immediately with a call_id for polling
 */
export async function submitRenderToCompose(
  request: ComposeRenderRequest
): Promise<ComposeSubmitResponse> {
  if (isLocalMode()) {
    console.log('[Compose] Using LOCAL mode');
    return submitToLocal(request);
  } else {
    console.log('[Compose] Using AWS BATCH mode');
    return submitToBatch(request);
  }
}

// Legacy alias for backward compatibility
export const submitRenderToModal = submitRenderToCompose;

/**
 * Poll local compose engine for job status (development)
 */
async function getLocalStatus(jobId: string): Promise<ComposeStatusResponse> {
  const url = `${LOCAL_COMPOSE_URL}/job/${jobId}/status`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return {
      status: 'error',
      error: `Job ${jobId} not found`,
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Local status check failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Map local status to unified format
  const statusMap: Record<string, ComposeStatusResponse['status']> = {
    queued: 'processing',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed',
  };

  return {
    status: statusMap[data.status] || 'processing',
    call_id: data.job_id,
    result: data.status === 'completed' || data.status === 'failed' ? {
      status: data.status,
      job_id: data.job_id,
      output_url: data.output_url || null,
      error: data.error || null,
    } : undefined,
    error: data.error,
  };
}

/**
 * Poll AWS Batch for render job status
 */
async function getBatchStatus(batchJobId: string): Promise<ComposeStatusResponse> {
  // Dynamic import to avoid loading AWS SDK when not needed
  const { getBatchJobStatus } = await import('@/lib/batch/client');

  const result = await getBatchJobStatus(batchJobId);

  // Map Batch status to unified format
  if (result.mappedStatus === 'completed') {
    return {
      status: 'completed',
      call_id: result.batch_job_id,
      result: {
        status: 'completed',
        job_id: result.job_id,
        output_url: null, // Will be set by callback
        error: null,
      },
    };
  } else if (result.mappedStatus === 'failed') {
    return {
      status: 'failed',
      call_id: result.batch_job_id,
      result: {
        status: 'failed',
        job_id: result.job_id,
        output_url: null,
        error: result.statusReason || 'Job failed',
      },
      error: result.statusReason,
    };
  } else {
    return {
      status: 'processing',
      call_id: result.batch_job_id,
    };
  }
}

/**
 * Poll for render job status (auto-selects Batch or Local based on COMPOSE_ENGINE_MODE)
 */
export async function getComposeRenderStatus(
  callId: string
): Promise<ComposeStatusResponse> {
  if (isLocalMode()) {
    return getLocalStatus(callId);
  } else {
    return getBatchStatus(callId);
  }
}

// Legacy alias for backward compatibility
export const getModalRenderStatus = getComposeRenderStatus;

/**
 * Helper to convert status to database status
 */
export function composeStatusToDbStatus(
  composeStatus: ComposeStatusResponse['status']
): 'PROCESSING' | 'COMPLETED' | 'FAILED' {
  switch (composeStatus) {
    case 'completed':
      return 'COMPLETED';
    case 'failed':
    case 'error':
      return 'FAILED';
    default:
      return 'PROCESSING';
  }
}

// Legacy alias for backward compatibility
export const modalStatusToDbStatus = composeStatusToDbStatus;

// ============================================================================
// Batch Processing (For Variations)
// ============================================================================

export interface BatchSubmitResponse {
  batch_id: string;
  total_jobs: number;
  call_ids: Array<{ job_id: string; call_id: string }>;
  status: 'queued' | 'partial' | 'error';
  message?: string;
}

export interface BatchStatusResponse {
  total: number;
  processing: number;
  all_complete: boolean;
  results: Array<{
    call_id: string;
    status: 'processing' | 'completed' | 'failed' | 'error';
    result?: {
      status: string;
      job_id: string;
      output_url: string | null;
      error: string | null;
    };
    error?: string;
  }>;
}

/**
 * Submit multiple render jobs in parallel (batch processing)
 * Uses AWS Batch for parallel GPU rendering
 */
export async function submitBatchRender(
  jobs: ComposeRenderRequest[]
): Promise<BatchSubmitResponse> {
  // Dynamic import to avoid loading AWS SDK when not needed
  const { submitBatchRenderJobs } = await import('@/lib/batch/client');

  const batchRequests = jobs.map(job => ({
    job_id: job.job_id,
    images: job.images,
    audio: job.audio,
    script: job.script,
    settings: job.settings,
    output: job.output,
  }));

  const result = await submitBatchRenderJobs(batchRequests);

  // Map to unified response format
  return {
    batch_id: result.batch_id,
    total_jobs: result.total_jobs,
    call_ids: result.results.map(r => ({
      job_id: r.job_id,
      call_id: r.batch_job_id,
    })),
    status: result.status,
    message: result.status === 'queued'
      ? `${result.total_jobs} jobs submitted to AWS Batch`
      : `${result.results.filter(r => r.status === 'queued').length}/${result.total_jobs} jobs submitted`,
  };
}

// Legacy alias for backward compatibility
export const submitBatchRenderToModal = submitBatchRender;

/**
 * Poll status for multiple render jobs at once
 */
export async function getBatchRenderStatus(
  callIds: string[]
): Promise<BatchStatusResponse> {
  // Poll each job individually using AWS Batch
  const results = await Promise.all(
    callIds.map(async (callId) => {
      try {
        const status = await getBatchStatus(callId);
        return {
          call_id: callId,
          status: status.status,
          result: status.result,
          error: status.error,
        };
      } catch (error) {
        return {
          call_id: callId,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  const processing = results.filter(r => r.status === 'processing').length;
  const allComplete = results.every(r => r.status === 'completed' || r.status === 'failed' || r.status === 'error');

  return {
    total: results.length,
    processing,
    all_complete: allComplete,
    results,
  };
}

// ============================================================================
// Audio Processing Types & Endpoints
// ============================================================================

export interface SubtitleEntry {
  text: string;
  start: number;  // Start time in seconds
  end: number;    // End time in seconds
}

export interface AudioComposeRequest {
  job_id?: string;
  video_url: string;
  audio_url: string;
  audio_start_time?: number;
  audio_volume?: number;
  fade_in?: number;
  fade_out?: number;
  mix_original_audio?: boolean;
  original_audio_volume?: number;
  output_s3_bucket?: string;
  output_s3_key?: string;
  subtitles?: SubtitleEntry[];
}

export interface AudioComposeResponse {
  call_id: string;
  job_id: string;
  status: 'queued' | 'error';
  message?: string;
}

export interface AudioSegment {
  start: number;
  end: number;
  energy: number;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'unknown';
}

export interface AudioAnalysis {
  duration: number;
  bpm: number;
  energy_curve: number[];
  peak_energy: number;
  avg_energy: number;
  segments: AudioSegment[];
  best_15s_start: number;
  best_15s_energy: number;
  metadata?: {
    sample_rate: number;
    channels: number;
    bitrate: number;
  };
}

export interface AudioJobResult {
  status: 'completed' | 'failed';
  job_id: string;
  output_url?: string | null;
  duration?: number | null;
  analysis?: AudioAnalysis | null;
  error?: string | null;
}

export interface AudioStatusResponse {
  status: 'processing' | 'completed' | 'failed' | 'error';
  call_id?: string;
  result?: AudioJobResult;
  error?: string;
}

/**
 * Submit an audio composition job to compose-engine
 */
export async function submitAudioCompose(
  request: AudioComposeRequest
): Promise<AudioComposeResponse> {
  const url = `${COMPOSE_ENGINE_URL}/audio/compose`;

  console.log(`[Audio Compose] Using compose-engine: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Compose-engine audio compose failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    call_id: data.job_id,
    job_id: data.job_id,
    status: data.status === 'queued' ? 'queued' : 'error',
    message: data.message,
  };
}

// Legacy alias for backward compatibility
export const submitAudioComposeToModal = submitAudioCompose;

/**
 * Get media duration from compose-engine
 */
export async function getMediaDuration(
  url: string,
  mediaType: 'video' | 'audio' = 'video'
): Promise<{ duration: number; error?: string }> {
  const endpoint = `${COMPOSE_ENGINE_URL}/audio/duration`;

  try {
    const response = await fetch(`${endpoint}?audio_url=${encodeURIComponent(url)}&media_type=${mediaType}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { duration: 0, error: `Duration failed: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { duration: result.duration || 0, error: result.error };
  } catch (error) {
    return { duration: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Legacy alias for backward compatibility
export const getMediaDurationFromModal = getMediaDuration;

/**
 * Poll for audio job status from compose-engine
 */
export async function getAudioJobStatus(callId: string): Promise<AudioStatusResponse> {
  const url = `${COMPOSE_ENGINE_URL}/audio/compose/${callId}/status`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return {
      status: 'error',
      error: `Job ${callId} not found`,
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Compose-engine status check failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Map compose-engine response to unified format
  if (data.status === 'completed') {
    return {
      status: 'completed',
      call_id: data.job_id,
      result: {
        status: 'completed',
        job_id: data.job_id,
        output_url: data.output_url,
        duration: data.duration,
        error: null,
      },
    };
  } else if (data.status === 'failed') {
    return {
      status: 'failed',
      call_id: data.job_id,
      result: {
        status: 'failed',
        job_id: data.job_id,
        output_url: null,
        error: data.error,
      },
      error: data.error,
    };
  } else {
    return {
      status: 'processing',
      call_id: data.job_id,
    };
  }
}

/**
 * Wait for audio job to complete with polling
 */
export async function waitForAudioJob(
  callId: string,
  options: {
    pollInterval?: number;
    maxWaitTime?: number;
    onProgress?: (status: AudioStatusResponse) => void;
  } = {}
): Promise<AudioJobResult> {
  const {
    pollInterval = 2000,
    maxWaitTime = 300000, // 5 minutes
    onProgress,
  } = options;

  const startTime = Date.now();

  while (true) {
    const status = await getAudioJobStatus(callId);

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed' || status.status === 'failed') {
      return status.result || {
        status: status.status,
        job_id: callId,
        output_url: null,
        error: status.error || null,
      };
    }

    if (status.status === 'error') {
      return {
        status: 'failed',
        job_id: callId,
        output_url: null,
        error: status.error || 'Unknown error',
      };
    }

    if (Date.now() - startTime > maxWaitTime) {
      return {
        status: 'failed',
        job_id: callId,
        output_url: null,
        error: 'Timeout waiting for audio job',
      };
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

/**
 * Compose video with audio (convenience function)
 * Submits the job and waits for completion
 */
export async function composeVideoWithAudio(
  options: AudioComposeRequest & {
    pollInterval?: number;
    maxWaitTime?: number;
    onProgress?: (status: AudioStatusResponse) => void;
  }
): Promise<AudioJobResult> {
  const { pollInterval, maxWaitTime, onProgress, ...request } = options;

  // Submit the job
  const submitResponse = await submitAudioCompose(request);

  // Wait for completion
  return waitForAudioJob(submitResponse.call_id, {
    pollInterval,
    maxWaitTime,
    onProgress,
  });
}

// Legacy alias for backward compatibility
export const composeVideoWithAudioModal = composeVideoWithAudio;
