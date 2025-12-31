/**
 * Compose Engine Client for Video Rendering
 *
 * Supports two modes:
 *   - ec2 (default): EC2 GPU instance (production - single server)
 *   - local: Local compose-engine Docker container (development)
 *
 * EC2 Flow: Next.js → EC2 GPU Server (g4dn + NVENC) → S3
 * Local Flow: Next.js → Docker compose-engine (CPU) → S3
 *
 * GPU Stack (EC2):
 *   - Instance: g4dn.xlarge (T4 GPU) or g4dn.2xlarge
 *   - Base: nvidia/cuda:12.4.0-devel-ubuntu22.04
 *   - FFmpeg: jellyfin-ffmpeg6 (has h264_nvenc baked in)
 *   - Encoder: h264_nvenc (5-10x faster than CPU)
 */

// Compose engine mode: 'ec2' (default) or 'local' (development)
// Note: 'batch' mode has been removed - use EC2 for all rendering
const COMPOSE_ENGINE_MODE = process.env.COMPOSE_ENGINE_MODE || 'ec2';

// Local compose engine (development)
const LOCAL_COMPOSE_URL = process.env.LOCAL_COMPOSE_URL || 'http://localhost:8000';

// EC2 compose engine (GPU server)
const EC2_COMPOSE_URL = process.env.EC2_COMPOSE_URL || 'http://15.164.236.53:8000';

// Compose engine URL (for direct server modes)
const COMPOSE_ENGINE_URL = COMPOSE_ENGINE_MODE === 'ec2'
  ? EC2_COMPOSE_URL
  : (process.env.MODAL_COMPOSE_URL || LOCAL_COMPOSE_URL);

/**
 * Check if running in local development mode
 */
export function isLocalMode(): boolean {
  return COMPOSE_ENGINE_MODE === 'local';
}

/**
 * Check if running in EC2 GPU server mode
 */
export function isEc2Mode(): boolean {
  return COMPOSE_ENGINE_MODE === 'ec2';
}

/**
 * Check if running in batch mode (legacy)
 * @deprecated Batch mode has been removed. Always returns false.
 */
export function isBatchMode(): boolean {
  return false;
}

/**
 * Check if running in direct server mode (local or EC2)
 * Both modes use the same HTTP API to compose-engine
 */
export function isDirectServerMode(): boolean {
  return isLocalMode() || isEc2Mode();
}

/**
 * Get current compose engine mode
 */
export function getComposeEngineMode(): 'ec2' | 'local' {
  // 'batch' mode has been removed - only 'ec2' and 'local' are supported
  const mode = COMPOSE_ENGINE_MODE as string;
  if (mode === 'batch') {
    console.warn('[Compose] batch mode is deprecated, using ec2 instead');
    return 'ec2';
  }
  return mode as 'ec2' | 'local';
}

/**
 * Get the compose engine URL for direct HTTP calls
 * Use this for endpoints not covered by the main client functions
 */
export function getComposeEngineUrl(): string {
  if (isEc2Mode()) {
    return EC2_COMPOSE_URL;
  }
  return LOCAL_COMPOSE_URL;
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
    cut_duration?: number;  // Duration per image in seconds (overrides BPM-based calculation)
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
 * Submit a render job to direct server (local or EC2)
 * Uses job_id as call_id for unified status polling
 */
async function submitToDirectServer(
  request: ComposeRenderRequest
): Promise<ComposeSubmitResponse> {
  const baseUrl = isEc2Mode() ? EC2_COMPOSE_URL : LOCAL_COMPOSE_URL;
  const url = `${baseUrl}/render`;
  const modeName = isEc2Mode() ? 'EC2' : 'Local';

  console.log(`[${modeName} Compose] Submitting to:`, url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${modeName} compose submit failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Map response to unified response format
  return {
    call_id: data.job_id,
    job_id: data.job_id,
    status: data.status === 'accepted' ? 'queued' : 'error',
    message: data.message,
  };
}

/**
 * Submit a render job to EC2 or Local compose-engine
 * Returns immediately with a call_id for polling
 */
export async function submitRenderToCompose(
  request: ComposeRenderRequest
): Promise<ComposeSubmitResponse> {
  const modeName = isEc2Mode() ? 'EC2' : 'LOCAL';
  console.log(`[Compose] Using ${modeName} mode`);
  return submitToDirectServer(request);
}

// Legacy alias for backward compatibility
export const submitRenderToModal = submitRenderToCompose;

/**
 * Poll direct server (local or EC2) for job status
 * EC2 returns: { job_id, status, progress, current_step?, output_url?, error? }
 */
async function getDirectServerStatus(jobId: string): Promise<ComposeStatusResponse> {
  const baseUrl = isEc2Mode() ? EC2_COMPOSE_URL : LOCAL_COMPOSE_URL;
  const url = `${baseUrl}/job/${jobId}/status`;
  const modeName = isEc2Mode() ? 'EC2' : 'Local';

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
    throw new Error(`${modeName} status check failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Log raw EC2 response for debugging
  console.log(`[${modeName} Status] Raw response for ${jobId}:`, {
    status: data.status,
    progress: data.progress,
    output_url: data.output_url ? `${data.output_url.substring(0, 60)}...` : null,
    error: data.error,
  });

  // Map status to unified format
  const statusMap: Record<string, ComposeStatusResponse['status']> = {
    queued: 'processing',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed',
  };

  const mappedStatus = statusMap[data.status] || 'processing';

  // Build result object for completed/failed jobs
  // EC2's JobStatusResponse includes output_url directly in the response
  const result = (data.status === 'completed' || data.status === 'failed') ? {
    status: data.status,
    job_id: data.job_id || jobId,
    output_url: data.output_url || null,
    error: data.error || null,
  } : undefined;

  return {
    status: mappedStatus,
    call_id: data.job_id || jobId,
    result,
    error: data.error,
  };
}

/**
 * Poll for render job status from EC2 or Local compose-engine
 */
export async function getComposeRenderStatus(
  callId: string
): Promise<ComposeStatusResponse> {
  return getDirectServerStatus(callId);
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
 * Uses EC2 compose-engine for parallel GPU rendering
 */
export async function submitBatchRender(
  jobs: ComposeRenderRequest[]
): Promise<BatchSubmitResponse> {
  const modeName = isEc2Mode() ? 'EC2' : 'Local';
  console.log(`[${modeName} Batch] Submitting ${jobs.length} jobs in parallel`);

  // Submit all jobs in parallel to EC2/Local compose-engine
  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        const result = await submitToDirectServer(job);
        return {
          job_id: job.job_id,
          call_id: result.call_id,
          status: result.status,
          error: result.error,
        };
      } catch (error) {
        return {
          job_id: job.job_id,
          call_id: '',
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  const successCount = results.filter(r => r.status === 'queued').length;
  const status = successCount === jobs.length ? 'queued' :
                 successCount > 0 ? 'partial' : 'error';

  return {
    batch_id: `batch-${Date.now()}`,
    total_jobs: jobs.length,
    call_ids: results.map(r => ({
      job_id: r.job_id,
      call_id: r.call_id,
    })),
    status,
    message: status === 'queued'
      ? `${jobs.length} jobs submitted to ${modeName}`
      : `${successCount}/${jobs.length} jobs submitted`,
  };
}

// Legacy alias for backward compatibility
export const submitBatchRenderToModal = submitBatchRender;

/**
 * Poll status for multiple render jobs at once from EC2/Local compose-engine
 */
export async function getBatchRenderStatus(
  callIds: string[]
): Promise<BatchStatusResponse> {
  // Poll each job individually using EC2/Local compose-engine
  const results = await Promise.all(
    callIds.map(async (callId) => {
      try {
        const status = await getDirectServerStatus(callId);
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

// ============================================================================
// Auto-Compose API (for Variations)
// ============================================================================

export interface AutoComposeScriptLine {
  text: string;
  timing: number;
  duration: number;
}

export interface AutoComposeRequest {
  job_id: string;
  search_query: string;
  search_tags: string[];
  audio_url?: string | null;
  vibe?: string;
  effect_preset?: string;
  color_grade?: string;
  text_style?: string;
  aspect_ratio?: string;
  target_duration?: number;
  campaign_id?: string;
  callback_url?: string;
  script_lines?: AutoComposeScriptLine[];
  // Original image URLs for 70/30 split (70% original + 30% new search)
  original_image_urls?: string[];
}

export interface AutoComposeResponse {
  status: 'accepted' | 'error';
  job_id: string;
  message?: string;
  search_results?: number;
}

/**
 * Submit an auto-compose job to EC2 server
 * Auto-compose handles image search internally based on search_tags
 * Designed for creating variations of existing compose videos
 */
export async function submitAutoCompose(
  request: AutoComposeRequest
): Promise<AutoComposeResponse> {
  const baseUrl = isEc2Mode() ? EC2_COMPOSE_URL : LOCAL_COMPOSE_URL;
  const url = `${baseUrl}/api/v1/compose/auto`;
  const modeName = isEc2Mode() ? 'EC2' : 'Local';

  console.log(`[${modeName} Auto-Compose] Submitting to:`, url);
  console.log(`[${modeName} Auto-Compose] Job ${request.job_id} with tags: ${request.search_tags.join(', ')}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${modeName} auto-compose submit failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    status: data.status === 'accepted' ? 'accepted' : 'error',
    job_id: data.job_id,
    message: data.message,
    search_results: data.search_results,
  };
}

// ============================================================================
// EC2 AI Generation API (Vertex AI via EC2)
// ============================================================================

export type AIJobType = 'video_generation' | 'image_generation' | 'image_to_video' | 'video_extend';
export type AIJobStatus = 'queued' | 'processing' | 'uploading' | 'completed' | 'failed';
export type AIVideoAspectRatio = '16:9' | '9:16' | '1:1';
export type AIImageAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
export type AIVideoDuration = 4 | 6 | 8;
export type AIPersonGeneration = 'allow_adult' | 'dont_allow';

export interface AISubtitleEntry {
  text: string;
  start: number;
  end: number;
}

export interface AIAudioOverlaySettings {
  audio_url: string;
  audio_start_time?: number;
  audio_volume?: number;
  fade_in?: number;
  fade_out?: number;
  mix_original_audio?: boolean;
  original_audio_volume?: number;
  subtitles?: AISubtitleEntry[];
}

export interface AIVideoSettings {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: AIVideoAspectRatio;
  duration_seconds?: AIVideoDuration;
  person_generation?: AIPersonGeneration;
  generate_audio?: boolean;
  seed?: number;
  audio_overlay?: AIAudioOverlaySettings;
}

export interface AIImageSettings {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: AIImageAspectRatio;
  number_of_images?: number;
  person_generation?: AIPersonGeneration;
  seed?: number;
}

export interface AII2VSettings extends AIVideoSettings {
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
  video_settings?: AIVideoSettings;
  image_settings?: AIImageSettings;
  i2v_settings?: AII2VSettings;
  output: AIOutputSettings;
  callback_url?: string;
  callback_secret?: string;
  metadata?: Record<string, unknown>;
}

export interface AIJobResponse {
  job_id: string;
  job_type: AIJobType;
  status: AIJobStatus;
  message?: string;
  error?: string;
}

export interface AIJobStatusResponse {
  job_id: string;
  status: AIJobStatus;
  progress: number;
  current_step?: string;
  output_url?: string;
  error?: string;
  metadata?: {
    gcs_uri?: string;
    extension_count?: number;
    storage?: string;
  };
  is_final: boolean;
}

/**
 * Submit an AI generation job to EC2 (Vertex AI via EC2 GPU server)
 * This routes AI generation through EC2 which has proper GCP authentication
 */
export async function submitAIJob(
  request: AIJobRequest
): Promise<AIJobResponse> {
  const baseUrl = isEc2Mode() ? EC2_COMPOSE_URL : LOCAL_COMPOSE_URL;
  const url = `${baseUrl}/api/v1/ai/generate`;
  const modeName = isEc2Mode() ? 'EC2' : 'Local';

  console.log(`[${modeName} AI] Submitting ${request.job_type} job:`, request.job_id);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${modeName} AI job submit failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Submit an image generation job to EC2 (Imagen 3 via Vertex AI)
 */
export async function submitImageGeneration(
  jobId: string,
  settings: AIImageSettings,
  output: AIOutputSettings,
  options?: {
    callback_url?: string;
    callback_secret?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AIJobResponse> {
  return submitAIJob({
    job_id: jobId,
    job_type: 'image_generation',
    image_settings: settings,
    output,
    ...options,
  });
}

/**
 * Submit a video generation job to EC2 (Veo 3.1 via Vertex AI)
 */
export async function submitVideoGeneration(
  jobId: string,
  settings: AIVideoSettings,
  output: AIOutputSettings,
  options?: {
    callback_url?: string;
    callback_secret?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AIJobResponse> {
  return submitAIJob({
    job_id: jobId,
    job_type: 'video_generation',
    video_settings: settings,
    output,
    ...options,
  });
}

/**
 * Submit an image-to-video job to EC2 (Veo 3.1 I2V via Vertex AI)
 */
export async function submitI2VGeneration(
  jobId: string,
  settings: AII2VSettings,
  output: AIOutputSettings,
  options?: {
    callback_url?: string;
    callback_secret?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AIJobResponse> {
  return submitAIJob({
    job_id: jobId,
    job_type: 'image_to_video',
    i2v_settings: settings,
    output,
    ...options,
  });
}

/**
 * Get AI job status from EC2
 */
export async function getAIJobStatus(jobId: string): Promise<AIJobStatusResponse> {
  const baseUrl = isEc2Mode() ? EC2_COMPOSE_URL : LOCAL_COMPOSE_URL;
  const url = `${baseUrl}/api/v1/ai/job/${jobId}/status`;
  const modeName = isEc2Mode() ? 'EC2' : 'Local';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return {
      job_id: jobId,
      status: 'failed',
      progress: 0,
      error: `Job ${jobId} not found`,
      is_final: true,
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${modeName} AI status check failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Wait for AI job to complete with polling
 */
export async function waitForAIJob(
  jobId: string,
  options: {
    pollInterval?: number;
    maxWaitTime?: number;
    onProgress?: (status: AIJobStatusResponse) => void;
  } = {}
): Promise<AIJobStatusResponse> {
  const {
    pollInterval = 5000,  // AI jobs take longer, poll every 5 seconds
    maxWaitTime = 600000, // 10 minutes max for AI generation
    onProgress,
  } = options;

  const startTime = Date.now();

  while (true) {
    const status = await getAIJobStatus(jobId);

    if (onProgress) {
      onProgress(status);
    }

    if (status.is_final) {
      return status;
    }

    if (Date.now() - startTime > maxWaitTime) {
      return {
        job_id: jobId,
        status: 'failed',
        progress: 0,
        error: 'Timeout waiting for AI job',
        is_final: true,
      };
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}
