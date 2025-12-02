/**
 * Modal.com Client for Direct Video Rendering
 *
 * This client calls Modal serverless GPU functions directly,
 * bypassing Railway for simpler architecture.
 *
 * Flow: Next.js → Modal (GPU) → S3
 */

const MODAL_SUBMIT_URL = process.env.MODAL_SUBMIT_URL;
const MODAL_STATUS_URL = process.env.MODAL_STATUS_URL;

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
  };
  output: {
    s3_bucket: string;
    s3_key: string;
  };
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
      use_gpu: false, // CPU encoding (libx264) for reliability
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
 */
export async function submitBatchRenderToModal(
  jobs: ModalRenderRequest[]
): Promise<BatchSubmitResponse> {
  const response = await fetch(MODAL_BATCH_SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jobs: jobs.map(job => ({ ...job, use_gpu: false })),
      use_gpu: false, // CPU encoding (libx264) for reliability
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
