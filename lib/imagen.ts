/**
 * Google Gemini Image Generation Service
 *
 * Generates images using Google's Gemini model for use in I2V video generation.
 * Uses the models/gemini-3-pro-image-preview model for image generation.
 */

import { GoogleGenAI } from "@google/genai";

// Initialize Google Gen AI client
const getClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

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

// Mock mode check
const isMockMode = () => {
  return process.env.IMAGEN_MOCK_MODE === "true" || !process.env.GOOGLE_AI_API_KEY;
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
 * Generate an image using Google Gemini with optional reference image support
 * This image will be used as the starting point for I2V video generation
 *
 * When a reference image (product image) is provided, Gemini will incorporate
 * that actual product into the generated scene.
 */
export async function generateImage(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  if (isMockMode()) {
    console.log("[GEMINI-IMAGE] Running in mock mode");
    return generateMockImage(params);
  }

  try {
    const ai = getClient();
    const model = "gemini-3-pro-image-preview"; // Gemini 3 Pro image generation model

    console.log(`[GEMINI-IMAGE] Starting image generation with model: ${model}`);
    console.log(`[GEMINI-IMAGE] Prompt: ${params.prompt.slice(0, 100)}...`);

    // Build the prompt with style if provided
    let fullPrompt = params.prompt;
    if (params.style) {
      fullPrompt = `[Style: ${params.style}] ${fullPrompt}`;
    }

    // Add quality modifiers for better I2V results
    fullPrompt += ". High quality, detailed, sharp focus, professional photography, suitable for video animation.";

    // Add aspect ratio hint to the prompt
    if (params.aspectRatio) {
      const aspectHint = params.aspectRatio === "16:9"
        ? "horizontal/landscape format"
        : params.aspectRatio === "9:16"
          ? "vertical/portrait format"
          : "square format";
      fullPrompt += ` Image should be in ${aspectHint}.`;
    }

    // Prepare contents array - can include both text and reference image
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = [];

    // Get reference image if provided
    let referenceImageData: { base64: string; mimeType: string } | null = null;

    if (params.referenceImageBase64) {
      // Use provided base64 directly
      referenceImageData = {
        base64: params.referenceImageBase64,
        mimeType: "image/jpeg", // Assume JPEG if not specified
      };
      console.log("[GEMINI-IMAGE] Using provided base64 reference image");
    } else if (params.referenceImageUrl) {
      // Fetch image from URL
      referenceImageData = await fetchImageAsBase64(params.referenceImageUrl);
    }

    // If we have a reference image, add it to contents with modified prompt
    if (referenceImageData) {
      console.log("[GEMINI-IMAGE] Including reference image in generation request");

      // Use image EDITING approach - keep the product exactly as is, only change background
      const promptWithReference = `Edit this image: Change ONLY the background to show: ${fullPrompt}.

CRITICAL RULES:
1. DO NOT modify, redraw, or change the product/object in ANY way
2. Keep the EXACT original product - same pixels, same appearance, same details
3. Only replace/extend the background around the product
4. The product must remain IDENTICAL to the input image
5. This is an IMAGE EDITING task, not image generation - preserve the original product exactly`;

      contents.push({
        inlineData: {
          mimeType: referenceImageData.mimeType,
          data: referenceImageData.base64,
        },
      });
      contents.push({ text: promptWithReference });
    } else {
      // No reference image, use text-only prompt
      contents.push({ text: fullPrompt });
    }

    // Generate image using Gemini generateContent with image response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (ai.models as any).generateContent({
      model,
      contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    console.log("[GEMINI-IMAGE] Generation response received");

    // Check for blocked content
    if (response.promptFeedback?.blockReason) {
      console.error("[GEMINI-IMAGE] Content blocked:", response.promptFeedback.blockReason);
      return {
        success: false,
        error: `Image blocked by safety filter: ${response.promptFeedback.blockReason}`,
      };
    }

    // Extract image from response parts
     
    const candidates = response.candidates || [];
    for (const candidate of candidates) {
       
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        // Check for inline data (image)
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")) {
          console.log("[GEMINI-IMAGE] Image generated successfully");
          return {
            success: true,
            imageBase64: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          };
        }
      }
    }

    // Alternative: Check response.parts directly (newer SDK structure)
     
    const parts = response.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")) {
        console.log("[GEMINI-IMAGE] Image generated successfully (from parts)");
        return {
          success: true,
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }

    console.error("[GEMINI-IMAGE] No image data found in response");
    console.log("[GEMINI-IMAGE] Response structure:", JSON.stringify(response, null, 2).slice(0, 500));
    return {
      success: false,
      error: "No image data in response",
    };
  } catch (error) {
    console.error("[GEMINI-IMAGE] Generation error:", error);

    // Check if it's a specific API error
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: errorMessage,
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
 * Convert video aspect ratio to Imagen-compatible format
 */
export function convertAspectRatioForImagen(videoAspectRatio: string): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" {
  switch (videoAspectRatio) {
    case "9:16":
      return "9:16";
    case "1:1":
      return "1:1";
    case "16:9":
    default:
      return "16:9";
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
 * This approach ensures the product image is preserved exactly while
 * creating a realistic scene around it.
 */
export async function generateTwoStepComposition(
  params: TwoStepCompositionParams
): Promise<TwoStepCompositionResult> {
  if (isMockMode()) {
    console.log("[GEMINI-IMAGE] Running in mock mode - Two-step composition");
    return {
      success: true,
      sceneImageBase64: "MOCK_SCENE_IMAGE_BASE64",
      finalImageBase64: "MOCK_FINAL_IMAGE_BASE64",
      mimeType: "image/png",
    };
  }

  try {
    const ai = getClient();
    const model = "gemini-3-pro-image-preview";  // Gemini 3 Pro image generation model

    // ============ STEP 1: Generate scene with placeholder ============
    console.log(`[GEMINI-IMAGE] Step 1: Generating scene with placeholder using model: ${model}...`);
    console.log(`[GEMINI-IMAGE] Scene prompt: ${params.scenePrompt.slice(0, 100)}...`);

    let scenePrompt = params.scenePrompt;
    if (params.style) {
      scenePrompt = `[Style: ${params.style}] ${scenePrompt}`;
    }

    // CRITICAL: Ensure single image output, not collage
    scenePrompt = `Generate ONE SINGLE coherent image (NOT a collage, NOT multiple images, NOT split screen): ${scenePrompt}`;
    scenePrompt += ". High quality, detailed, sharp focus, professional photography. Single unified composition.";

    if (params.aspectRatio) {
      const aspectHint = params.aspectRatio === "16:9"
        ? "horizontal/landscape format"
        : params.aspectRatio === "9:16"
          ? "vertical/portrait format"
          : "square format";
      scenePrompt += ` Image should be in ${aspectHint}.`;
    }

    // Generate scene image (text-only, no reference)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sceneResponse = await (ai.models as any).generateContent({
      model,
      contents: [{ text: scenePrompt }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Extract scene image
    let sceneImageBase64: string | undefined;
    let sceneMimeType: string = "image/png";

    const sceneCandidates = sceneResponse.candidates || [];
    for (const candidate of sceneCandidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")) {
          sceneImageBase64 = part.inlineData.data;
          sceneMimeType = part.inlineData.mimeType;
          break;
        }
      }
      if (sceneImageBase64) break;
    }

    // Also check response.parts
    if (!sceneImageBase64) {
      const parts = sceneResponse.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")) {
          sceneImageBase64 = part.inlineData.data;
          sceneMimeType = part.inlineData.mimeType;
          break;
        }
      }
    }

    if (!sceneImageBase64) {
      console.error("[GEMINI-IMAGE] Step 1 failed: No scene image generated");
      return {
        success: false,
        error: "Failed to generate scene image with placeholder",
      };
    }

    console.log("[GEMINI-IMAGE] Step 1 complete: Scene image generated");

    // ============ STEP 2: Composite product into scene ============
    console.log("[GEMINI-IMAGE] Step 2: Compositing product into scene...");

    // Get product image
    let productImageData: { base64: string; mimeType: string } | null = null;

    if (params.productImageBase64) {
      productImageData = {
        base64: params.productImageBase64,
        mimeType: "image/jpeg",
      };
      console.log("[GEMINI-IMAGE] Using provided base64 product image");
    } else if (params.productImageUrl) {
      productImageData = await fetchImageAsBase64(params.productImageUrl);
    }

    if (!productImageData) {
      console.error("[GEMINI-IMAGE] Step 2 failed: No product image available");
      return {
        success: false,
        sceneImageBase64,
        error: "Product image is required for composition",
      };
    }

    // Create composition prompt with both images
    const compositionInstructions = `${params.compositePrompt}

TASK: You have two images:
1. SCENE IMAGE (first image): Shows hands holding a placeholder object in a beautiful scene
2. PRODUCT IMAGE (second image): The actual product that should replace the placeholder

CRITICAL REQUIREMENTS:
1. Replace the placeholder object with the EXACT product from the second image
2. The product must be the IDENTICAL to the second image - same appearance, same details
3. Adjust ONLY the product's:
   - Position (to replace placeholder exactly)
   - Scale (to fit naturally in hands)
   - Lighting (to match scene lighting)
   - Shadows (to integrate realistically)
4. DO NOT modify the product's design, colors, logos, or any visual characteristics
5. The final result should look like a professional product photo where the product was naturally photographed in this scene

Output only the final composited image.`;

    // Send both images + instructions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const compositeContents: any[] = [
      {
        inlineData: {
          mimeType: sceneMimeType,
          data: sceneImageBase64,
        },
      },
      {
        inlineData: {
          mimeType: productImageData.mimeType,
          data: productImageData.base64,
        },
      },
      { text: compositionInstructions },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const compositeResponse = await (ai.models as any).generateContent({
      model,
      contents: compositeContents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Extract final composited image
    let finalImageBase64: string | undefined;
    let finalMimeType: string = "image/png";

    const compositeCandidates = compositeResponse.candidates || [];
    for (const candidate of compositeCandidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")) {
          finalImageBase64 = part.inlineData.data;
          finalMimeType = part.inlineData.mimeType;
          break;
        }
      }
      if (finalImageBase64) break;
    }

    // Also check response.parts
    if (!finalImageBase64) {
      const parts = compositeResponse.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")) {
          finalImageBase64 = part.inlineData.data;
          finalMimeType = part.inlineData.mimeType;
          break;
        }
      }
    }

    if (!finalImageBase64) {
      console.error("[GEMINI-IMAGE] Step 2 failed: No composited image generated");
      console.log("[GEMINI-IMAGE] Returning scene image as fallback");
      return {
        success: true,
        sceneImageBase64,
        finalImageBase64: sceneImageBase64,  // Fallback to scene image
        mimeType: sceneMimeType,
      };
    }

    console.log("[GEMINI-IMAGE] Step 2 complete: Product composited into scene");

    return {
      success: true,
      sceneImageBase64,
      finalImageBase64,
      mimeType: finalMimeType,
    };

  } catch (error) {
    console.error("[GEMINI-IMAGE] Two-step composition error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
