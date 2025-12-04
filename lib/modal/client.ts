/**
 * Modal.com Client for Direct Video Rendering
 *
 * This client calls Modal serverless GPU functions directly,
 * bypassing Railway for simpler architecture.
 *
 * Flow: Next.js → Modal (GPU T4 + NVENC) → S3
 *
 * GPU Stack:
 *   - Base: nvidia/cuda:12.4.0-devel-ubuntu22.04
 *   - FFmpeg: jellyfin-ffmpeg6 (has h264_nvenc baked in)
 *   - Encoder: h264_nvenc (5-10x faster than CPU)
 */

const MODAL_SUBMIT_URL = process.env.MODAL_SUBMIT_URL;
const MODAL_STATUS_URL = process.env.MODAL_STATUS_URL;
const MODAL_CALLBACK_SECRET = process.env.MODAL_CALLBACK_SECRET || 'hydra-modal-callback-secret';

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
 * Submit a render job to Modal
 * Returns immediately with a call_id for polling
 * Automatically includes callback URL for database updates on completion
 */
export async function submitRenderToModal(
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
 * Poll Modal for render job status
 * Returns current status, progress, and output URL when complete
 */
export async function getModalRenderStatus(
  callId: string
): Promise<ModalStatusResponse> {
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
