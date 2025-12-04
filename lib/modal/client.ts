/**
 * Compose Engine Client for Video Rendering
 *
 * Supports two modes:
 *   - modal (default): Modal serverless GPU (production)
 *   - local: Local compose-engine Docker container (development)
 *
 * Modal Flow: Next.js → Modal (GPU T4 + NVENC) → S3
 * Local Flow: Next.js → Docker compose-engine (CPU) → S3
 *
 * GPU Stack (Modal):
 *   - Base: nvidia/cuda:12.4.0-devel-ubuntu22.04
 *   - FFmpeg: jellyfin-ffmpeg6 (has h264_nvenc baked in)
 *   - Encoder: h264_nvenc (5-10x faster than CPU)
 */

// Compose engine mode: 'modal' (production) or 'local' (development)
const COMPOSE_ENGINE_MODE = process.env.COMPOSE_ENGINE_MODE || 'modal';

// Modal endpoints (production)
const MODAL_SUBMIT_URL = process.env.MODAL_SUBMIT_URL;
const MODAL_STATUS_URL = process.env.MODAL_STATUS_URL;
const MODAL_CALLBACK_SECRET = process.env.MODAL_CALLBACK_SECRET || 'hydra-modal-callback-secret';

// Local compose engine (development)
const LOCAL_COMPOSE_URL = process.env.LOCAL_COMPOSE_URL || 'http://localhost:8000';

/**
 * Check if running in local development mode
 */
export function isLocalMode(): boolean {
  return COMPOSE_ENGINE_MODE === 'local';
}

// Callback URL for Modal to notify us when render completes
function getCallbackUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hydra-sand-theta.vercel.app';
  return `${baseUrl}/api/v1/compose/callback`;
}

// AI Effect Selection types
export interface AIEffectSelection {
  transitions?: string[];
  motions?: string[];
  filters?: string[];
  text_animations?: string[];
  analysis?: Record<string, unknown>;
}

export interface ModalRenderRequest {
  job_id: string;
  images: Array<{
    url: string;
    order: number;
  }>;
  audio: {
    url: string;
    start_time: number;
    duration: number | null;
  };
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

export interface ModalSubmitResponse {
  call_id: string;
  job_id: string;
  status: 'queued' | 'error';
  message?: string;
  error?: string;
}

export interface ModalStatusResponse {
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

/**
 * Submit a render job to Modal (production)
 */
async function submitToModal(
  request: ModalRenderRequest
): Promise<ModalSubmitResponse> {
  if (!MODAL_SUBMIT_URL) {
    throw new Error('MODAL_SUBMIT_URL environment variable not set');
  }

  const response = await fetch(MODAL_SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...request,
      use_gpu: true, // GPU encoding (NVENC h264_nvenc) - 5-10x faster
      // Add callback for automatic database updates
      callback_url: getCallbackUrl(),
      callback_secret: MODAL_CALLBACK_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Modal submit failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Submit a render job to local compose engine (development)
 * Uses job_id as call_id for unified status polling
 */
async function submitToLocal(
  request: ModalRenderRequest
): Promise<ModalSubmitResponse> {
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

  // Map local response to Modal response format
  // Local uses job_id, Modal uses call_id - we use job_id for both in local mode
  return {
    call_id: data.job_id, // Use job_id as call_id for unified polling
    job_id: data.job_id,
    status: data.status === 'accepted' ? 'queued' : 'error',
    message: data.message,
  };
}

/**
 * Submit a render job (auto-selects Modal or Local based on COMPOSE_ENGINE_MODE)
 * Returns immediately with a call_id for polling
 * Automatically includes callback URL for database updates on completion (Modal only)
 */
export async function submitRenderToModal(
  request: ModalRenderRequest
): Promise<ModalSubmitResponse> {
  if (isLocalMode()) {
    console.log('[Compose] Using LOCAL mode');
    return submitToLocal(request);
  } else {
    console.log('[Compose] Using MODAL mode');
    return submitToModal(request);
  }
}

/**
 * Poll Modal for render job status (production)
 */
async function getModalStatus(callId: string): Promise<ModalStatusResponse> {
  if (!MODAL_STATUS_URL) {
    throw new Error('MODAL_STATUS_URL environment variable not set');
  }

  const url = new URL(MODAL_STATUS_URL);
  url.searchParams.set('call_id', callId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Modal returns 202 for "still processing"
  if (response.status === 202) {
    const data = await response.json();
    return {
      status: 'processing',
      call_id: data.call_id,
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Modal status check failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Poll local compose engine for job status (development)
 * Maps local status format to Modal status format
 */
async function getLocalStatus(jobId: string): Promise<ModalStatusResponse> {
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

  // Map local status to Modal status format
  // Local: { job_id, status: "queued"|"processing"|"completed"|"failed", progress, output_url, error }
  // Modal: { status: "processing"|"completed"|"failed"|"error", result?: { job_id, output_url, error } }
  const statusMap: Record<string, ModalStatusResponse['status']> = {
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
 * Poll for render job status (auto-selects Modal or Local based on COMPOSE_ENGINE_MODE)
 * Returns current status, progress, and output URL when complete
 */
export async function getModalRenderStatus(
  callId: string
): Promise<ModalStatusResponse> {
  if (isLocalMode()) {
    return getLocalStatus(callId);
  } else {
    return getModalStatus(callId);
  }
}

/**
 * Helper to convert Modal status to database status
 */
export function modalStatusToDbStatus(
  modalStatus: ModalStatusResponse['status']
): 'PROCESSING' | 'COMPLETED' | 'FAILED' {
  switch (modalStatus) {
    case 'completed':
      return 'COMPLETED';
    case 'failed':
    case 'error':
      return 'FAILED';
    default:
      return 'PROCESSING';
  }
}

// ============================================================================
// Batch Processing (For Variations)
// ============================================================================

const MODAL_BATCH_SUBMIT_URL = process.env.MODAL_BATCH_SUBMIT_URL ||
  'https://modawnai--hydra-compose-engine-submit-batch-render.modal.run';
const MODAL_BATCH_STATUS_URL = process.env.MODAL_BATCH_STATUS_URL ||
  'https://modawnai--hydra-compose-engine-get-batch-status.modal.run';

export interface BatchSubmitResponse {
  batch_id: string;
  total_jobs: number;
  call_ids: Array<{ job_id: string; call_id: string }>;
  status: 'queued' | 'error';
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
 * Ideal for compose variations - all jobs start simultaneously
 * Automatically includes callback URL for database updates on completion
 */
export async function submitBatchRenderToModal(
  jobs: ModalRenderRequest[]
): Promise<BatchSubmitResponse> {
  // Add callback info to each job
  const callbackUrl = getCallbackUrl();
  const jobsWithCallback = jobs.map(job => ({
    ...job,
    callback_url: callbackUrl,
    callback_secret: MODAL_CALLBACK_SECRET,
  }));

  const response = await fetch(MODAL_BATCH_SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jobs: jobsWithCallback,
      use_gpu: true, // GPU encoding (NVENC h264_nvenc) - 5-10x faster
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Modal batch submit failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Poll status for multiple render jobs at once
 */
export async function getBatchRenderStatus(
  callIds: string[]
): Promise<BatchStatusResponse> {
  const url = new URL(MODAL_BATCH_STATUS_URL);
  url.searchParams.set('call_ids', callIds.join(','));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Modal batch status check failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}
