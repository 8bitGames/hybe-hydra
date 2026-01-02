/**
 * Image Generation Service
 *
 * Generates images for I2V video generation.
 * Uses Vertex AI exclusively (Imagen 3.0 or via EC2 compose-engine).
 *
 * NOTE: Google AI API (GOOGLE_AI_API_KEY) is NOT used for image generation.
 * All image generation goes through Vertex AI for consistency and cost management.
 */

import { isVertexAIAvailable, getVertexAIMediaClient } from "@/lib/models";

export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  numberOfImages?: number;
  style?: string;
  referenceImageUrl?: string;      // URL of the reference image (product image)
  referenceImageBase64?: string;   // Base64 encoded reference image
}

export interface ImageGenerationResult {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  error?: string;
}

// Mock mode check - only uses explicit env var, not API key presence
const isMockMode = () => {
  return process.env.IMAGEN_MOCK_MODE === "true";
};

/**
 * Fetch an image from URL and convert to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    console.log(`[GEMINI-IMAGE] Fetching reference image from: ${imageUrl.slice(0, 100)}...`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[GEMINI-IMAGE] Failed to fetch image: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    console.log(`[GEMINI-IMAGE] Reference image fetched successfully, type: ${contentType}`);
    return { base64, mimeType: contentType };
  } catch (error) {
    console.error(`[GEMINI-IMAGE] Error fetching reference image:`, error);
    return null;
  }
}

/**
 * Generate an image using Vertex AI (Imagen 3.0)
 * This image will be used as the starting point for I2V video generation
 *
 * NOTE: Only Vertex AI is supported. Google AI API is not used.
 * For production, images are generated via EC2 compose-engine backend.
 *
 * When a reference image (product image) is provided, the model will incorporate
 * that actual product into the generated scene.
 */
export async function generateImage(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  if (isMockMode()) {
    console.log("[IMAGE-GEN] Running in mock mode");
    return generateMockImage(params);
  }

  // Only Vertex AI is supported
  if (!isVertexAIAvailable()) {
    console.error("[IMAGE-GEN] Vertex AI is not available. Image generation requires Vertex AI.");
    return {
      success: false,
      error: "Vertex AI is not configured. Please set up GCP credentials for image generation.",
    };
  }

  console.log("[IMAGE-GEN] Using Vertex AI Imagen 3.0");
  return generateImageWithVertexAI(params);
}

/**
 * Generate image using Vertex AI Imagen 3.0
 */
async function generateImageWithVertexAI(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  try {
    const client = getVertexAIMediaClient();

    console.log(`[VERTEX-IMAGE] Starting image generation with Imagen 3.0`);
    console.log(`[VERTEX-IMAGE] Prompt: ${params.prompt.slice(0, 100)}...`);

    // Build prompt with style
    let fullPrompt = params.prompt;
    if (params.style) {
      fullPrompt = `${params.style} style: ${fullPrompt}`;
    }

    // Add quality modifiers
    fullPrompt += ". High quality, detailed, sharp focus, professional photography.";

    const result = await client.generateImage({
      prompt: fullPrompt,
      negativePrompt: params.negativePrompt,
      aspectRatio: params.aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | undefined,
      numberOfImages: params.numberOfImages || 1,
    });

    if (result.success && result.imageBase64) {
      console.log("[VERTEX-IMAGE] Image generated successfully");
      return {
        success: true,
        imageBase64: result.imageBase64,
        mimeType: "image/png",
      };
    }

    // No fallback - return error
    console.error(`[VERTEX-IMAGE] Failed: ${result.error}`);
    return {
      success: false,
      error: result.error || "Vertex AI image generation failed",
    };

  } catch (error) {
    console.error("[VERTEX-IMAGE] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Vertex AI image generation error",
    };
  }
}

/**
 * Generate a mock image for development/testing
 */
function generateMockImage(params: ImageGenerationParams): ImageGenerationResult {
  console.log(`[GEMINI-IMAGE-MOCK] Generated mock image for prompt: "${params.prompt.slice(0, 50)}..."`);

  // Return a simple placeholder - in real mock mode, you might want to use a sample image
  // For now, we'll indicate mock mode was used
  return {
    success: true,
    imageBase64: "MOCK_IMAGE_BASE64_DATA",
    mimeType: "image/png",
  };
}

/**
 * Optimize prompt for image generation that will be used for I2V
 * This ensures the generated image is suitable for video animation
 */
export function optimizePromptForI2V(prompt: string, videoAspectRatio: string): string {
  // Add modifiers that help create images suitable for video animation
  const i2vModifiers = [
    "cinematic composition",
    "clear subject focus",
    "balanced lighting",
    "suitable for motion",
  ];

  // Adjust based on aspect ratio
  if (videoAspectRatio === "9:16") {
    i2vModifiers.push("vertical composition");
  } else if (videoAspectRatio === "1:1") {
    i2vModifiers.push("centered composition");
  } else {
    i2vModifiers.push("wide cinematic frame");
  }

  return `${prompt}. ${i2vModifiers.join(", ")}.`;
}

/**
 * Convert video aspect ratio to Gemini Image-compatible format
 */
export function convertAspectRatioForGeminiImage(videoAspectRatio: string): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" {
  switch (videoAspectRatio) {
    case "16:9":
      return "16:9";
    case "1:1":
      return "1:1";
    case "9:16":
    default:
      return "9:16";  // Default to portrait (9:16) for TikTok/Reels
  }
}

export interface TwoStepCompositionParams {
  scenePrompt: string;           // Prompt for generating scene with placeholder
  productImageUrl?: string;      // URL of the product image
  productImageBase64?: string;   // Base64 of the product image
  compositePrompt: string;       // Instructions for compositing
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  style?: string;
}

export interface TwoStepCompositionResult {
  success: boolean;
  sceneImageBase64?: string;     // Generated scene with placeholder
  finalImageBase64?: string;     // Final composited image
  mimeType?: string;
  error?: string;
}

/**
 * Two-step image composition workflow:
 * 1. Generate a scene image showing hands holding a placeholder
 * 2. Composite the actual product image into the scene
 *
 * NOTE: This feature is currently NOT SUPPORTED as it requires Google AI API
 * which has been removed. Vertex AI does not support multi-image composition.
 * Use "direct" composition mode instead.
 *
 * @deprecated Use direct mode instead - two-step composition is not supported with Vertex AI only
 */
export async function generateTwoStepComposition(
  params: TwoStepCompositionParams
): Promise<TwoStepCompositionResult> {
  if (isMockMode()) {
    console.log("[IMAGE-GEN] Running in mock mode - Two-step composition");
    return {
      success: true,
      sceneImageBase64: "MOCK_SCENE_IMAGE_BASE64",
      finalImageBase64: "MOCK_FINAL_IMAGE_BASE64",
      mimeType: "image/png",
    };
  }

  // Two-step composition is not supported with Vertex AI only
  console.error("[IMAGE-GEN] Two-step composition is not supported. Vertex AI does not support multi-image composition workflows.");
  console.error("[IMAGE-GEN] Please use 'direct' composition mode instead.");

  return {
    success: false,
    error: "Two-step composition is not supported. Please use 'direct' composition mode instead. Vertex AI does not support multi-image composition workflows.",
  };
}
