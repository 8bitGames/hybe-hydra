/**
 * Veo 3 Video Generation Service
 * Uses Vertex AI exclusively for video generation.
 *
 * NOTE: Google AI API (GOOGLE_AI_API_KEY) is NOT used for video generation.
 * All video generation goes through Vertex AI for consistency and cost management.
 */

import { uploadVideoFromBase64, uploadVideoFromUrl } from "./storage";
import { isVertexAIAvailable, getVertexAIMediaClient, type VideoDuration, type VideoAspectRatio } from "@/lib/models";

// Model options
export type VeoModel = "veo-3.1-fast-generate-preview" | "veo-3.1-generate-preview" | "veo-2.0-generate-001";

// ============================================================================
// VEO Mode Configuration
// ============================================================================
// VEO_MODE: production (default) | fast | sample
// - production: veo-3.1-generate-preview (highest quality)
// - fast: veo-3.1-fast-generate-preview (faster, lower cost)
// - sample: Returns sample videos without API call (for testing)
// ============================================================================

export type VeoModeType = "production" | "fast" | "sample";

export interface VeoConfig {
  mode: VeoModeType;
  model: VeoModel;
  isSampleMode: boolean;
  description: string;
}

/**
 * Get current VEO configuration based on VEO_MODE environment variable
 */
export function getVeoConfig(): VeoConfig {
  const veoMode = process.env.VEO_MODE?.toLowerCase() as VeoModeType | undefined;

  switch (veoMode) {
    case "sample":
      return {
        mode: "sample",
        model: "veo-3.1-generate-preview",
        isSampleMode: true,
        description: "Sample mode - returning pre-made test videos",
      };
    case "fast":
      return {
        mode: "fast",
        model: "veo-3.1-fast-generate-preview",
        isSampleMode: false,
        description: "Fast mode - using veo-3.1-fast-generate-preview",
      };
    default:
      return {
        mode: "production",
        model: "veo-3.1-generate-preview",
        isSampleMode: false,
        description: "Production mode - using veo-3.1-generate-preview",
      };
  }
}

/**
 * Get model name based on current VEO mode
 * Shorthand for getVeoConfig().model
 */
export function getVeoModel(): VeoModel {
  return getVeoConfig().model;
}

/**
 * Check if running in sample (mock) mode
 * Shorthand for getVeoConfig().isSampleMode
 */
export function isVeoSampleMode(): boolean {
  return getVeoConfig().isSampleMode;
}

// Video generation parameters
export interface VeoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  referenceImageUrl?: string;
  referenceImageBase64?: string;
  style?: string;
  model?: VeoModel;
  resolution?: "720p" | "1080p";
  sampleCount?: number;
  seed?: number;
}

export interface VeoGenerationResult {
  success: boolean;
  videoUrl?: string;
  operationName?: string;
  error?: string;
  metadata?: {
    duration: number;
    resolution: string;
    format: string;
    model: string;
  };
}

export interface VeoJobStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  videoUrl?: string;
  error?: string;
}

// Mock mode check - only uses VEO_MODE env var
const isMockMode = () => {
  return isVeoSampleMode();
};

/**
 * Generate video using Veo 3.1 through Vertex AI
 *
 * NOTE: Only Vertex AI is supported. Google AI API is not used.
 */
export async function generateVideo(
  params: VeoGenerationParams,
  campaignId?: string
): Promise<VeoGenerationResult> {
  const veoConfig = getVeoConfig();

  // Use sample mode if configured
  if (veoConfig.isSampleMode) {
    console.log(`[VEO] Running in ${veoConfig.mode} mode (${veoConfig.description})`);
    return generateMockVideo(params);
  }

  // Only Vertex AI is supported
  if (!isVertexAIAvailable()) {
    console.error("[VEO] Vertex AI is not available. Video generation requires Vertex AI.");
    return {
      success: false,
      error: "Vertex AI is not configured. Please set up GCP credentials for video generation.",
    };
  }

  try {
    const client = getVertexAIMediaClient();

    console.log(`[VEO] Starting video generation with Vertex AI (Veo 3.1)`);
    console.log(`[VEO] Prompt: ${params.prompt.slice(0, 100)}...`);

    // Build the prompt
    const fullPrompt = buildVideoPrompt(params);

    // Determine reference image for I2V mode
    let referenceImageBase64: string | undefined;

    if (params.referenceImageBase64) {
      console.log("[VEO] Using reference image (Base64 provided) - I2V mode activated");
      referenceImageBase64 = params.referenceImageBase64;
    } else if (params.referenceImageUrl) {
      console.log(`[VEO] Fetching reference image from URL: ${params.referenceImageUrl}`);
      try {
        const imageBase64 = await fetchImageAsBase64(params.referenceImageUrl);
        if (imageBase64) {
          console.log("[VEO] Reference image fetched successfully - I2V mode activated");
          referenceImageBase64 = imageBase64;
        }
      } catch (imageError) {
        console.error("[VEO] Failed to fetch reference image, falling back to T2V mode:", imageError);
      }
    } else {
      console.log("[VEO] No reference image provided - T2V mode");
    }

    // Validate and convert duration to supported values (4, 6, or 8 seconds)
    let durationSeconds: VideoDuration = 8;
    if (params.durationSeconds) {
      if (params.durationSeconds <= 4) {
        durationSeconds = 4;
      } else if (params.durationSeconds <= 6) {
        durationSeconds = 6;
      } else {
        durationSeconds = 8;
      }
    }

    // Build GCS output URI for video storage
    const outputGcsUri = campaignId
      ? `gs://${process.env.GCS_BUCKET_NAME || "hybe-hydra-videos"}/campaigns/${campaignId}/`
      : `gs://${process.env.GCS_BUCKET_NAME || "hybe-hydra-videos"}/temp/`;

    // Generate video using Vertex AI
    const result = await client.generateVideo(
      {
        prompt: fullPrompt,
        negativePrompt: params.negativePrompt,
        aspectRatio: params.aspectRatio as VideoAspectRatio,
        durationSeconds,
        personGeneration: "allow_adult",
        generateAudio: true,
        seed: params.seed,
        referenceImageBase64,
      },
      outputGcsUri
    );

    if (!result.success) {
      console.error(`[VEO] Vertex AI video generation failed: ${result.error}`);

      // Only fallback to mock if explicitly enabled
      if (process.env.VEO_FALLBACK_TO_MOCK === "true") {
        console.log("[VEO] Falling back to mock mode (VEO_FALLBACK_TO_MOCK=true)");
        return generateMockVideo(params);
      }

      return {
        success: false,
        error: result.error || "Vertex AI video generation failed",
      };
    }

    let videoUrl = result.videoUri || "";

    // If video is in GCS and we have a campaign, optionally upload to S3
    if (videoUrl.startsWith("gs://") && campaignId && process.env.UPLOAD_TO_S3 === "true") {
      console.log(`[VEO] Video stored at GCS: ${videoUrl}`);
      // GCS URI can be used directly or converted to signed URL
      // For now, we keep the GCS URI - the application can handle conversion as needed
    }

    console.log(`[VEO] Video generation completed: ${videoUrl}`);

    return {
      success: true,
      videoUrl,
      operationName: result.operationName,
      metadata: {
        duration: durationSeconds,
        resolution: params.resolution || "720p",
        format: "mp4",
        model: "veo-3.1-generate-001",
      },
    };
  } catch (error) {
    console.error("[VEO] Generation error:", error instanceof Error ? error.message : String(error));

    // Only fallback to mock if explicitly enabled
    if (process.env.VEO_FALLBACK_TO_MOCK === "true") {
      console.log("[VEO] Falling back to mock mode (VEO_FALLBACK_TO_MOCK=true)");
      return generateMockVideo(params);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Video generation failed",
    };
  }
}

/**
 * Build optimized video prompt
 */
function buildVideoPrompt(params: VeoGenerationParams): string {
  let prompt = params.prompt;

  // Add style guidance
  if (params.style) {
    prompt = `[Style: ${params.style}] ${prompt}`;
  }

  // Add technical specifications for better results
  const specs = [];
  if (params.aspectRatio === "9:16") {
    specs.push("vertical video format optimized for TikTok/Reels");
  } else if (params.aspectRatio === "1:1") {
    specs.push("square format for social media");
  } else {
    specs.push("widescreen cinematic format");
  }

  if (specs.length > 0) {
    prompt += `. Format: ${specs.join(", ")}.`;
  }

  return prompt;
}

// Sample video URL for testing (from our S3 bucket)
const SAMPLE_VIDEO_URL = "https://hydra-assets-hybe.s3.ap-southeast-2.amazonaws.com/campaigns/campaign-carly-hummingbird-tour/72afa814-70c9-429e-8a66-392fc143f86c.mp4";

/**
 * Generate mock video for development/testing
 * Uses a pre-existing video from our S3 bucket to avoid API costs
 */
function generateMockVideo(params: VeoGenerationParams): VeoGenerationResult {
  const aspectRatio = params.aspectRatio || "16:9";

  console.log(`[VEO-SAMPLE] Sample mode - returning pre-made video`);
  console.log(`[VEO-SAMPLE] Prompt would have been: "${params.prompt.slice(0, 50)}..."`);
  console.log(`[VEO-SAMPLE] Using sample URL: ${SAMPLE_VIDEO_URL}`);

  return {
    success: true,
    videoUrl: SAMPLE_VIDEO_URL,
    metadata: {
      duration: params.durationSeconds || 8,
      resolution: aspectRatio === "9:16" ? "1080x1920" : "1920x1080",
      format: "mp4",
      model: "sample",
    },
  };
}

/**
 * Check video generation status (for async operations)
 * Uses Vertex AI operation status API
 */
export async function checkGenerationStatus(operationName: string): Promise<VeoJobStatus> {
  if (isMockMode()) {
    return {
      status: "completed",
      progress: 100,
      videoUrl: SAMPLE_VIDEO_URL,
    };
  }

  if (!isVertexAIAvailable()) {
    return {
      status: "failed",
      progress: 0,
      error: "Vertex AI is not available",
    };
  }

  try {
    const client = getVertexAIMediaClient();
    const operationStatus = await client.checkOperationStatus(operationName);

    // Check if operation is done
    if (operationStatus.done) {
      // Check for errors
      if (operationStatus.error) {
        const errorObj = operationStatus.error as { message?: string };
        return {
          status: "failed",
          progress: 100,
          error: errorObj.message || "Operation failed",
        };
      }

      // Extract video URL from response
      const response = operationStatus.response as {
        videos?: Array<{ gcsUri?: string; uri?: string }>;
      };
      const videos = response?.videos || [];
      const videoUrl = videos[0]?.gcsUri || videos[0]?.uri;

      return {
        status: "completed",
        progress: 100,
        videoUrl,
      };
    }

    // Operation still in progress
    const metadata = operationStatus.metadata as { progressPercentage?: number };
    return {
      status: "processing",
      progress: metadata?.progressPercentage || 50,
    };
  } catch (error) {
    console.error("[VEO] Status check error:", error);
    return {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : "Status check failed",
    };
  }
}

/**
 * Batch generate multiple video variants
 */
export async function batchGenerateVideos(
  baseParams: VeoGenerationParams,
  styleVariants: Array<{ name: string; modifier: string }>,
  campaignId?: string
): Promise<Array<{ style: string; result: VeoGenerationResult }>> {
  const results = await Promise.all(
    styleVariants.map(async (variant) => {
      const modifiedParams = {
        ...baseParams,
        prompt: `${baseParams.prompt}. Style: ${variant.modifier}`,
        style: variant.name,
      };

      const result = await generateVideo(modifiedParams, campaignId);
      return { style: variant.name, result };
    })
  );

  return results;
}

/**
 * Helper function for sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch an image from URL and convert to Base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log(`[VEO] Downloading image from: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    console.log(`[VEO] Image downloaded and converted to Base64 (${Math.round(base64.length / 1024)}KB)`);
    return base64;
  } catch (error) {
    console.error("[VEO] Failed to fetch image:", error);
    return null;
  }
}

/**
 * Detect MIME type from URL or default to PNG
 */
function detectImageMimeType(imageUrl: string): string {
  const url = imageUrl.toLowerCase();
  if (url.includes(".jpg") || url.includes(".jpeg")) {
    return "image/jpeg";
  } else if (url.includes(".webp")) {
    return "image/webp";
  } else if (url.includes(".gif")) {
    return "image/gif";
  }
  return "image/png";
}
