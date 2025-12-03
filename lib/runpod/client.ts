/**
 * RunPod Serverless Client for Video Rendering with GPU (NVENC)
 *
 * This client calls RunPod serverless endpoints for GPU-accelerated video encoding.
 * RunPod supports proper NVIDIA NVENC hardware encoding (unlike Modal).
 *
 * Flow: Next.js → RunPod (GPU + NVENC) → S3
 *
 * Setup:
 *   1. Deploy Docker image to RunPod
 *   2. Create serverless endpoint
 *   3. Set environment variables:
 *      - RUNPOD_API_KEY
 *      - RUNPOD_ENDPOINT_ID
 */

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

// RunPod API base URL
const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

export interface RunPodRenderRequest {
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
  use_gpu?: boolean;
}

export interface RunPodSubmitResponse {
  id: string; // RunPod job ID (for polling)
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

export interface RunPodStatusResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: {
    status: string;
    job_id: string;
    output_url: string | null;
    nvenc_used: boolean;
    error: string | null;
  };
  error?: string;
}

/**
 * Submit a render job to RunPod (async - returns immediately)
 */
export async function submitRenderToRunPod(
  request: RunPodRenderRequest
): Promise<RunPodSubmitResponse> {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set");
  }

  const url = `${RUNPOD_API_BASE}/${RUNPOD_ENDPOINT_ID}/run`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({
      input: {
        ...request,
        use_gpu: request.use_gpu ?? true, // Default to GPU
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod submit failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Submit a render job synchronously (waits for completion)
 * Only use for short jobs or testing
 */
export async function submitRenderToRunPodSync(
  request: RunPodRenderRequest
): Promise<RunPodStatusResponse> {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set");
  }

  const url = `${RUNPOD_API_BASE}/${RUNPOD_ENDPOINT_ID}/runsync`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({
      input: {
        ...request,
        use_gpu: request.use_gpu ?? true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `RunPod sync submit failed: ${response.status} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Poll RunPod for job status
 */
export async function getRunPodRenderStatus(
  runpodJobId: string
): Promise<RunPodStatusResponse> {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set");
  }

  const url = `${RUNPOD_API_BASE}/${RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `RunPod status check failed: ${response.status} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Cancel a running job
 */
export async function cancelRunPodJob(runpodJobId: string): Promise<void> {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set");
  }

  const url = `${RUNPOD_API_BASE}/${RUNPOD_ENDPOINT_ID}/cancel/${runpodJobId}`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
  });
}

/**
 * Helper to convert RunPod status to database status
 */
export function runpodStatusToDbStatus(
  runpodStatus: RunPodStatusResponse["status"]
): "PROCESSING" | "COMPLETED" | "FAILED" {
  switch (runpodStatus) {
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
    case "CANCELLED":
      return "FAILED";
    default:
      return "PROCESSING";
  }
}

/**
 * Check RunPod endpoint health
 */
export async function checkRunPodHealth(): Promise<{
  healthy: boolean;
  workers: number;
  queue: number;
}> {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    return { healthy: false, workers: 0, queue: 0 };
  }

  try {
    const url = `${RUNPOD_API_BASE}/${RUNPOD_ENDPOINT_ID}/health`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
    });

    if (!response.ok) {
      return { healthy: false, workers: 0, queue: 0 };
    }

    const data = await response.json();
    return {
      healthy: true,
      workers: data.workers?.running ?? 0,
      queue: data.jobs?.inQueue ?? 0,
    };
  } catch {
    return { healthy: false, workers: 0, queue: 0 };
  }
}

// ============================================================================
// Batch Processing (For Variations)
// ============================================================================

export interface BatchJob {
  job_id: string;
  runpod_id: string;
}

/**
 * Submit multiple render jobs in parallel
 * Each job is submitted independently and returns its own RunPod job ID
 */
export async function submitBatchRenderToRunPod(
  jobs: RunPodRenderRequest[]
): Promise<{
  batch_id: string;
  total_jobs: number;
  jobs: BatchJob[];
}> {
  const batchId = `batch-${Date.now()}`;

  // Submit all jobs in parallel
  const results = await Promise.all(
    jobs.map(async (job) => {
      const response = await submitRenderToRunPod(job);
      return {
        job_id: job.job_id,
        runpod_id: response.id,
      };
    })
  );

  return {
    batch_id: batchId,
    total_jobs: jobs.length,
    jobs: results,
  };
}

/**
 * Poll status for multiple render jobs
 */
export async function getBatchRenderStatus(runpodJobIds: string[]): Promise<{
  total: number;
  processing: number;
  completed: number;
  failed: number;
  all_complete: boolean;
  results: RunPodStatusResponse[];
}> {
  // Poll all jobs in parallel
  const results = await Promise.all(
    runpodJobIds.map((id) => getRunPodRenderStatus(id))
  );

  const completed = results.filter((r) => r.status === "COMPLETED").length;
  const failed = results.filter(
    (r) => r.status === "FAILED" || r.status === "CANCELLED"
  ).length;
  const processing = results.length - completed - failed;

  return {
    total: results.length,
    processing,
    completed,
    failed,
    all_complete: processing === 0,
    results,
  };
}
