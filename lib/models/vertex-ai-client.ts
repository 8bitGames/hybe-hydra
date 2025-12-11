/**
 * Vertex AI Client for Video & Image Generation
 * ==============================================
 * Client for Veo 3.1 (video) and Gemini 3 Pro Image (image) via Vertex AI.
 *
 * Uses GCP authentication (service account or ADC).
 * For text generation, use GeminiClient with Google AI API instead.
 */

import { GCPAuthManager, getGCPAuthManager } from './gcp-auth';

// ============================================================
// Type Definitions
// ============================================================

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';
export type ImageAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
export type VideoDuration = 5 | 8;
export type PersonGeneration = 'allow_adult' | 'dont_allow';
export type SafetyFilterLevel = 'block_none' | 'block_few' | 'block_some' | 'block_most';

export interface VideoGenerationConfig {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: VideoAspectRatio;
  durationSeconds?: VideoDuration;
  personGeneration?: PersonGeneration;
  generateAudio?: boolean;
  seed?: number;
  referenceImageUrl?: string;
  referenceImageBase64?: string;
}

export interface ImageGenerationConfig {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: ImageAspectRatio;
  numberOfImages?: number;
  safetyFilterLevel?: SafetyFilterLevel;
  personGeneration?: PersonGeneration;
  seed?: number;
}

export interface GenerationResult {
  success: boolean;
  operationName?: string;
  videoUri?: string;
  imageUri?: string;
  imageBase64?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface OperationResult {
  done?: boolean;
  error?: {
    message?: string;
    code?: number;
  };
  response?: {
    predictions?: Array<{
      gcsUri?: string;
      bytesBase64Encoded?: string;
    }>;
  };
  metadata?: {
    progressPercentage?: number;
  };
}

// ============================================================
// Vertex AI Client
// ============================================================

export class VertexAIMediaClient {
  private authManager: GCPAuthManager;
  private projectId: string;
  private location: string;

  // Model IDs
  private static readonly VEO_MODEL = 'veo-3.1-generate-001';  // Veo 3.1
  private static readonly IMAGE_MODEL = 'imagen-3.0-generate-001';  // Imagen 3.0

  constructor(config?: { projectId?: string; location?: string }) {
    this.authManager = getGCPAuthManager({
      projectId: config?.projectId,
      location: config?.location,
    });
    this.projectId = this.authManager.getProjectId();
    this.location = this.authManager.getLocation();

    console.log(`[VertexAI] Initialized for ${this.projectId}/${this.location}`);
  }

  /**
   * Generate video using Veo 3
   */
  async generateVideo(
    config: VideoGenerationConfig,
    outputGcsUri: string
  ): Promise<GenerationResult> {
    console.log(`[VertexAI] Starting video generation: ${config.prompt.slice(0, 50)}...`);

    try {
      const endpoint = this.getModelEndpoint(VertexAIMediaClient.VEO_MODEL, 'predictLongRunning');

      // Build request body
      const instances: Array<Record<string, unknown>> = [{
        prompt: config.prompt,
      }];

      // Add reference image for I2V mode
      if (config.referenceImageBase64) {
        instances[0].image = {
          bytesBase64Encoded: config.referenceImageBase64,
          mimeType: 'image/png',
        };
      } else if (config.referenceImageUrl) {
        // Fetch and convert to base64
        const imageBase64 = await this.fetchImageAsBase64(config.referenceImageUrl);
        if (imageBase64) {
          instances[0].image = {
            bytesBase64Encoded: imageBase64,
            mimeType: 'image/png',
          };
        }
      }

      const parameters: Record<string, unknown> = {
        aspectRatio: config.aspectRatio || '16:9',
        durationSeconds: config.durationSeconds || 8,
        personGeneration: config.personGeneration || 'allow_adult',
        generateAudio: config.generateAudio ?? true,
        outputOptions: {
          gcsUri: outputGcsUri,
        },
      };

      if (config.negativePrompt) {
        parameters.negativePrompt = config.negativePrompt;
      }

      if (config.seed !== undefined) {
        parameters.seed = config.seed;
      }

      const requestBody = { instances, parameters };

      // Start long-running operation
      const headers = await this.authManager.getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI error: ${response.status} - ${errorText}`);
      }

      const operationData = await response.json();
      const operationName = operationData.name;

      console.log(`[VertexAI] Video operation started: ${operationName}`);

      // Poll for completion
      const result = await this.pollOperation(operationName);

      if (result.done) {
        if (result.error) {
          return {
            success: false,
            operationName,
            error: result.error.message || JSON.stringify(result.error),
          };
        }

        const predictions = result.response?.predictions || [];
        if (predictions.length > 0) {
          return {
            success: true,
            operationName,
            videoUri: predictions[0].gcsUri || outputGcsUri,
            metadata: result.response as Record<string, unknown>,
          };
        }
      }

      return {
        success: false,
        operationName,
        error: 'Video generation did not complete',
      };

    } catch (error) {
      console.error('[VertexAI] Video generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate image using Gemini 3 Pro Image
   */
  async generateImage(
    config: ImageGenerationConfig,
    outputGcsUri?: string
  ): Promise<GenerationResult> {
    console.log(`[VertexAI] Starting image generation: ${config.prompt.slice(0, 50)}...`);

    try {
      const endpoint = this.getModelEndpoint(VertexAIMediaClient.IMAGE_MODEL, 'predict');

      const instances = [{
        prompt: config.prompt,
      }];

      const parameters: Record<string, unknown> = {
        aspectRatio: config.aspectRatio || '1:1',
        sampleCount: config.numberOfImages || 1,
        safetyFilterLevel: config.safetyFilterLevel || 'block_some',
        personGeneration: config.personGeneration || 'allow_adult',
      };

      if (config.negativePrompt) {
        parameters.negativePrompt = config.negativePrompt;
      }

      if (config.seed !== undefined) {
        parameters.seed = config.seed;
      }

      if (outputGcsUri) {
        parameters.outputOptions = { gcsUri: outputGcsUri };
      }

      const requestBody = { instances, parameters };

      const headers = await this.authManager.getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const predictions = data.predictions || [];

      if (predictions.length > 0) {
        const prediction = predictions[0];

        if (prediction.gcsUri) {
          return {
            success: true,
            imageUri: prediction.gcsUri,
            metadata: data,
          };
        }

        if (prediction.bytesBase64Encoded) {
          return {
            success: true,
            imageBase64: prediction.bytesBase64Encoded,
            metadata: data,
          };
        }
      }

      return {
        success: false,
        error: 'No image generated',
      };

    } catch (error) {
      console.error('[VertexAI] Image generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check operation status
   */
  async checkOperationStatus(operationName: string): Promise<Record<string, unknown>> {
    const url = `https://${this.location}-aiplatform.googleapis.com/v1/${operationName}`;
    const headers = await this.authManager.getAuthHeaders();

    const response = await fetch(url, { headers });
    return response.json();
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private getModelEndpoint(model: string, action: string): string {
    return `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:${action}`;
  }

  private async pollOperation(
    operationName: string,
    pollInterval: number = 10000,
    maxWaitTime: number = 600000
  ): Promise<OperationResult> {
    const url = `https://${this.location}-aiplatform.googleapis.com/v1/${operationName}`;
    const startTime = Date.now();

    while (true) {
      const elapsed = Date.now() - startTime;

      if (elapsed > maxWaitTime) {
        return { done: false, error: { message: 'Timeout' } };
      }

      const headers = await this.authManager.getAuthHeaders();
      const response = await fetch(url, { headers });
      const result = await response.json();

      if (result.done) {
        console.log(`[VertexAI] Operation completed after ${elapsed}ms`);
        return result;
      }

      const progress = result.metadata?.progressPercentage || 0;
      console.log(`[VertexAI] Progress: ${progress}% (elapsed: ${elapsed}ms)`);

      await this.sleep(pollInterval);
    }
  }

  private async fetchImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    } catch (error) {
      console.error('[VertexAI] Failed to fetch image:', error);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// Factory Functions
// ============================================================

let clientInstance: VertexAIMediaClient | null = null;

/**
 * Get singleton Vertex AI media client
 */
export function getVertexAIMediaClient(): VertexAIMediaClient {
  if (!clientInstance) {
    clientInstance = new VertexAIMediaClient();
  }
  return clientInstance;
}

/**
 * Create a new Vertex AI media client
 */
export function createVertexAIMediaClient(config?: {
  projectId?: string;
  location?: string;
}): VertexAIMediaClient {
  return new VertexAIMediaClient(config);
}

/**
 * Check if Vertex AI is available and can be used in the current environment
 *
 * WIF (Workload Identity Federation) credentials only work in AWS environments
 * (EC2, Lambda, EKS, Batch) where the AWS metadata service is accessible.
 * On Vercel, WIF will fail, so we should skip Vertex AI and use Gemini directly.
 */
export function isVertexAIAvailable(): boolean {
  // Check if explicitly disabled
  if (process.env.VERTEX_AI_ENABLED === 'false') {
    return false;
  }

  // Check for credentials
  const hasCredentials = !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCP_PROJECT_ID
  );

  if (!hasCredentials) {
    return false;
  }

  // Check if credentials are WIF (external_account) type
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (credJson) {
    try {
      const creds = JSON.parse(credJson);
      if (creds.type === 'external_account') {
        // WIF credentials - only works in AWS environments
        // Vercel runs on AWS Lambda-like environment but doesn't have IAM role attached
        // Check if we're running on Vercel (where WIF won't work)
        const isVercel = !!(
          process.env.VERCEL ||
          process.env.VERCEL_ENV ||
          process.env.NEXT_PUBLIC_VERCEL_URL
        );

        if (isVercel) {
          console.log('[VertexAI] WIF credentials detected on Vercel - skipping Vertex AI (use Gemini fallback)');
          return false;
        }

        // In non-Vercel AWS environments, WIF should work
        console.log('[VertexAI] WIF credentials detected in AWS environment - Vertex AI available');
        return true;
      }
    } catch (e) {
      // Invalid JSON, will fail anyway
      console.warn('[VertexAI] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
      return false;
    }
  }

  // Standard service account or ADC - should work anywhere
  return true;
}
