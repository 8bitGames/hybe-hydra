/**
 * Veo 3 Video Generation Service
 * Uses Google Gen AI SDK for video generation via Gemini API
 */

import { GoogleGenAI } from "@google/genai";
import { uploadVideoFromBase64, uploadVideoFromUrl } from "./storage";

// Initialize Google Gen AI client
const getClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

// Model options
export type VeoModel = "veo-3.1-fast-generate-preview" | "veo-3.1-generate-preview" | "veo-2.0-generate-001";

// ============================================================================
// VEO Mode Configuration (3-tier system)
// ============================================================================
// VEO_MODE environment variable:
// - "production" (default): Uses veo-3.1-generate-preview (highest quality)
// - "fast": Uses veo-3.1-fast-generate-preview (faster, lower cost)
// - "sample": Returns sample videos without calling API (for testing)
//
// Backwards compatibility:
// - VEO_USE_FAST_MODEL=true → fast mode
// - VEO_MOCK_MODE=true → sample mode
// ============================================================================

export type VeoModeType = "production" | "fast" | "sample";

export interface VeoConfig {
  mode: VeoModeType;
  model: VeoModel;
  isSampleMode: boolean;
  description: string;
}

/**
 * Get current VEO configuration based on environment variables
 * Priority: VEO_MODE > VEO_MOCK_MODE > VEO_USE_FAST_MODEL
 */
export function getVeoConfig(): VeoConfig {
  const veoMode = process.env.VEO_MODE?.toLowerCase();

  // Priority 1: Check VEO_MODE
  if (veoMode === "sample" || process.env.VEO_MOCK_MODE === "true") {
    return {
      mode: "sample",
      model: "veo-3.1-generate-preview", // Not used in sample mode
      isSampleMode: true,
      description: "Sample mode - returning pre-made test videos",
    };
  }

  if (veoMode === "fast" || process.env.VEO_USE_FAST_MODEL === "true") {
    return {
      mode: "fast",
      model: "veo-3.1-fast-generate-preview",
      isSampleMode: false,
      description: "Fast mode - using veo-3.1-fast-generate-preview",
    };
  }

  // Default: production mode
  return {
    mode: "production",
    model: "veo-3.1-generate-preview",
    isSampleMode: false,
    description: "Production mode - using veo-3.1-generate-preview",
  };
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

// Mock mode check (uses new config system)
const isMockMode = () => {
  return isVeoSampleMode() || !process.env.GOOGLE_AI_API_KEY;
};

/**
 * Generate video using Veo 3 through Google AI API
 */
export async function generateVideo(
  params: VeoGenerationParams,
  campaignId?: string
): Promise<VeoGenerationResult> {
  const veoConfig = getVeoConfig();

  // Use sample mode if configured or API key missing
  if (veoConfig.isSampleMode || !process.env.GOOGLE_AI_API_KEY) {
    console.log(`[VEO] Running in ${veoConfig.mode} mode (${veoConfig.description})`);
    return generateMockVideo(params);
  }

  try {
    const ai = getClient();
    // Use model from params if specified, otherwise use config model
    const model = params.model || veoConfig.model;

    console.log(`[VEO] Starting video generation with model: ${model}`);
    console.log(`[VEO] Prompt: ${params.prompt.slice(0, 100)}...`);

    // Build configuration
    const config: Record<string, unknown> = {};

    if (params.negativePrompt) {
      config.negativePrompt = params.negativePrompt;
    }

    if (params.aspectRatio) {
      config.aspectRatio = params.aspectRatio;
    }

    if (params.resolution) {
      config.resolution = params.resolution;
    }

    if (params.sampleCount) {
      config.sampleCount = params.sampleCount;
    }

    if (params.seed !== undefined) {
      config.seed = params.seed;
    }

    // Handle reference image if provided (I2V mode)
    let imageInput: { imageBytes: string; mimeType: string } | undefined;

    // First, check for direct Base64
    if (params.referenceImageBase64) {
      console.log("[VEO] Using reference image (Base64 provided) - I2V mode activated");
      imageInput = {
        imageBytes: params.referenceImageBase64,
        mimeType: "image/png",
      };
    }
    // Otherwise, fetch from URL and convert to Base64
    else if (params.referenceImageUrl) {
      console.log(`[VEO] Fetching reference image from URL: ${params.referenceImageUrl}`);
      try {
        const imageBase64 = await fetchImageAsBase64(params.referenceImageUrl);
        if (imageBase64) {
          console.log("[VEO] Reference image fetched successfully - I2V mode activated");
          const mimeType = detectImageMimeType(params.referenceImageUrl);
          imageInput = {
            imageBytes: imageBase64,
            mimeType,
          };
        }
      } catch (imageError) {
        console.error("[VEO] Failed to fetch reference image, falling back to T2V mode:", imageError);
      }
    } else {
      console.log("[VEO] No reference image provided - T2V mode");
    }

    // Start video generation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generateOptions: any = {
      model,
      prompt: buildVideoPrompt(params),
      config: {
        ...config,
        numberOfVideos: 1,
        // Note: personGeneration options ("allow_all", "allow_adult") are not supported in current API
        // Omitting this parameter to use default behavior
      },
    };

    if (imageInput) {
      generateOptions.image = imageInput;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let operation = await (ai.models as any).generateVideos(generateOptions);

    console.log(`[VEO] Operation started: ${operation.name || "unknown"}`);
    console.log("[VEO] Initial operation details:", JSON.stringify(operation, null, 2));

    // Poll for completion (with timeout)
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes max
    const pollInterval = 10 * 1000; // 10 seconds
    const startTime = Date.now();

    while (!operation.done) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error("Video generation timed out after 10 minutes");
      }

      console.log("[VEO] Waiting for video generation to complete...");
      await sleep(pollInterval);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      operation = await (ai.operations as any).getVideosOperation({
        operation,
      });

      console.log("[VEO] Operation status:", {
        done: operation.done,
        hasResponse: !!operation.response,
        hasError: !!operation.error,
        metadata: operation.metadata,
      });
    }

    console.log("[VEO] Final operation response:", JSON.stringify(operation.response, null, 2));

    // Check for RAI (Responsible AI) filtering
    if (operation.response?.raiMediaFilteredCount > 0) {
      const reasons = operation.response.raiMediaFilteredReasons || [];
      console.error("[VEO] Content filtered by Responsible AI:", reasons);
      throw new Error(`Content blocked by Google's safety filters: ${reasons.join(", ")}`);
    }

    // Check for errors
    if (operation.error) {
      console.error("[VEO] Operation error:", operation.error);
      throw new Error(operation.error.message || "Video generation failed");
    }

    // Get generated video
    const generatedVideos = operation.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      console.error("[VEO] No videos in response. Full response:", operation.response);
      throw new Error(
        "No video generated. Possible causes: API key lacks Veo access, content filtered, or API error. Check logs above."
      );
    }

    const video = generatedVideos[0];
    let videoUrl: string;

    // If we have video bytes, upload to S3
    if (video.video?.videoBytes && campaignId) {
      console.log("[VEO] Uploading video bytes to S3...");
      const uploadResult = await uploadVideoFromBase64(
        video.video.videoBytes,
        campaignId,
        video.video.mimeType || "video/mp4"
      );

      if (!uploadResult.success) {
        throw new Error(`Failed to upload video: ${uploadResult.error}`);
      }

      videoUrl = uploadResult.url!;
    } else if (video.video?.uri && campaignId) {
      // Download from URI and upload to S3 for persistent storage
      console.log("[VEO] Downloading video from URI and uploading to S3...");
      console.log(`[VEO] Source URI: ${video.video.uri}`);

      // Download with API key authentication
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      const downloadUrl = video.video.uri.includes("?")
        ? `${video.video.uri}&key=${apiKey}`
        : `${video.video.uri}?key=${apiKey}`;

      const uploadResult = await uploadVideoFromUrl(downloadUrl, campaignId);

      if (!uploadResult.success) {
        console.warn(`[VEO] S3 upload failed, using direct URI: ${uploadResult.error}`);
        videoUrl = video.video.uri;
      } else {
        videoUrl = uploadResult.url!;
        console.log(`[VEO] Video uploaded to S3: ${videoUrl}`);
      }
    } else if (video.video?.uri) {
      // No campaignId provided, use URI directly
      videoUrl = video.video.uri;
    } else {
      throw new Error("No video data or URI in response");
    }

    console.log(`[VEO] Video generation completed: ${videoUrl}`);

    return {
      success: true,
      videoUrl,
      operationName: operation.name,
      metadata: {
        duration: params.durationSeconds || 8,
        resolution: params.resolution || "720p",
        format: "mp4",
        model,
      },
    };
  } catch (error) {
    console.error("[VEO] Generation error:", error instanceof Error ? error.message : String(error));

    // Only fallback to mock if explicitly enabled via environment variable
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
 * Generate video using Vertex AI (alternative method for enterprise)
 */
export async function generateVideoWithVertexAI(
  params: VeoGenerationParams,
  campaignId?: string
): Promise<VeoGenerationResult> {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.VERTEX_AI_LOCATION || "us-central1";
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;

    if (!projectId || !accessToken) {
      throw new Error("GOOGLE_CLOUD_PROJECT and GOOGLE_ACCESS_TOKEN are required for Vertex AI");
    }

    const modelId = params.model || "veo-3.1-generate-preview";
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

    // Build request body
    const requestBody = {
      instances: [
        {
          prompt: buildVideoPrompt(params),
          ...(params.referenceImageBase64 && {
            referenceImages: [
              {
                image: {
                  bytesBase64Encoded: params.referenceImageBase64,
                  mimeType: "image/png",
                },
                referenceType: "asset",
              },
            ],
          }),
        },
      ],
      parameters: {
        durationSeconds: params.durationSeconds || 8,
        aspectRatio: params.aspectRatio || "16:9",
        ...(params.negativePrompt && { negativePrompt: params.negativePrompt }),
        ...(params.resolution && { resolution: params.resolution }),
        ...(params.sampleCount && { sampleCount: params.sampleCount }),
        ...(params.seed !== undefined && { seed: params.seed }),
        personGeneration: "allow_adult",
      },
    };

    console.log(`[VEO-VERTEX] Starting generation with endpoint: ${endpoint}`);

    // Start long-running operation
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI error: ${response.status} - ${errorText}`);
    }

    const operationData = await response.json();
    const operationName = operationData.name;

    console.log(`[VEO-VERTEX] Operation started: ${operationName}`);

    // Poll for completion
    const maxWaitTime = 10 * 60 * 1000;
    const pollInterval = 10 * 1000;
    const startTime = Date.now();

    let operationResult;
    while (true) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error("Video generation timed out");
      }

      await sleep(pollInterval);

      const statusResponse = await fetch(
        `https://${location}-aiplatform.googleapis.com/v1/${operationName}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      operationResult = await statusResponse.json();

      if (operationResult.done) {
        break;
      }

      console.log("[VEO-VERTEX] Still processing...");
    }

    // Check for errors
    if (operationResult.error) {
      throw new Error(operationResult.error.message);
    }

    // Extract video URL
    const videos = operationResult.response?.videos;
    if (!videos || videos.length === 0) {
      throw new Error("No video in response");
    }

    const gcsUri = videos[0].gcsUri;

    // If it's a GCS URI and we have a campaign, download and re-upload to our S3
    if (gcsUri.startsWith("gs://") && campaignId) {
      // For GCS URIs, we'd need to download via GCS API
      // For now, return the GCS URI directly (requires proper permissions)
      console.log(`[VEO-VERTEX] Video stored at: ${gcsUri}`);
    }

    return {
      success: true,
      videoUrl: gcsUri,
      operationName,
      metadata: {
        duration: params.durationSeconds || 8,
        resolution: params.resolution || "720p",
        format: "mp4",
        model: modelId,
      },
    };
  } catch (error) {
    console.error("[VEO-VERTEX] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Vertex AI generation failed",
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

/**
 * Generate mock video for development/testing
 */
function generateMockVideo(params: VeoGenerationParams): VeoGenerationResult {
  const mockId = Math.random().toString(36).substring(2, 15);
  const aspectRatio = params.aspectRatio || "16:9";

  // Use sample videos from various sources for testing
  const sampleVideos = [
    "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  ];

  // Pick a random sample video
  const mockVideoUrl = sampleVideos[Math.floor(Math.random() * sampleVideos.length)];

  console.log(`[VEO-MOCK] Generated mock video for prompt: "${params.prompt.slice(0, 50)}..."`);
  console.log(`[VEO-MOCK] Mock URL: ${mockVideoUrl}`);

  return {
    success: true,
    videoUrl: mockVideoUrl,
    metadata: {
      duration: params.durationSeconds || 8,
      resolution: aspectRatio === "9:16" ? "1080x1920" : "1920x1080",
      format: "mp4",
      model: params.model || "mock",
    },
  };
}

/**
 * Check video generation status (for async operations)
 */
export async function checkGenerationStatus(operationName: string): Promise<VeoJobStatus> {
  if (isMockMode()) {
    return {
      status: "completed",
      progress: 100,
      videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    };
  }

  try {
    const ai = getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const operation = await (ai.operations as any).get({ name: operationName });

    if (operation.done) {
      if (operation.error) {
        return {
          status: "failed",
          progress: 100,
          error: operation.error.message,
        };
      }

      const video = operation.response?.generatedVideos?.[0];
      return {
        status: "completed",
        progress: 100,
        videoUrl: video?.video?.uri,
      };
    }

    return {
      status: "processing",
      progress: 50,
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
