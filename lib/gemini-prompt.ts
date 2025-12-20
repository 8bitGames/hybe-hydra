/**
 * Gemini Prompt Generator for I2V (Image-to-Video) Generation
 *
 * @deprecated This module is deprecated. Use the I2V Specialist Agent instead:
 * ```typescript
 * import { createI2VSpecialistAgent } from "@/lib/agents/transformers/i2v-specialist";
 * const i2vAgent = createI2VSpecialistAgent();
 * ```
 *
 * Migration guide:
 * - generateImagePromptForI2V → i2vAgent.generateImagePrompt()
 * - generateVideoPromptForI2V → i2vAgent.generateVideoPrompt()
 * - generateBackgroundPromptForEditing → i2vAgent.generateBackgroundForEditing()
 * - generateSceneWithPlaceholderPrompt → i2vAgent.generateSceneWithPlaceholder()
 * - generateCompositePrompt → i2vAgent.generateComposite()
 *
 * Uses Google Gemini to create coherent, organically connected prompts for:
 * 1. Image generation (first frame of video)
 * 2. Video generation with specific image animation instructions
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_FLASH } from "./agents/constants";

// Initialize Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(apiKey);
};

// Mock mode check
const isMockMode = () => {
  return process.env.GEMINI_MOCK_MODE === "true" || !process.env.GOOGLE_AI_API_KEY;
};

export interface I2VPromptInput {
  videoPrompt: string;        // Original video concept/prompt
  imageDescription: string;   // How the user wants the first frame to look
  style?: string;             // Optional style modifier
  aspectRatio?: string;       // Video aspect ratio
}

export interface GeneratedImagePrompt {
  success: boolean;
  imagePrompt?: string;
  error?: string;
}

export interface GeneratedVideoPrompt {
  success: boolean;
  videoPrompt?: string;       // VEO-optimized prompt with animation instructions
  error?: string;
}

export interface BackgroundPromptInput {
  sceneDescription: string;   // User's scene/background description
  productUsage: string;       // How the product is being used (holding, showing, etc)
  style?: string;             // Optional style modifier
  aspectRatio?: string;       // Video aspect ratio
}

export interface SceneWithPlaceholderInput {
  sceneDescription: string;   // User's scene/background description
  productDescription: string; // Brief description of product type (bottle, box, device, etc)
  handPose: string;          // How the hands should hold the product
  style?: string;            // Optional style modifier
  aspectRatio?: string;      // Video aspect ratio
}

export interface CompositePromptInput {
  sceneDescription: string;   // Description of the scene image
  productDescription: string; // What the product looks like
  placementHint: string;     // Where/how the product should be placed
}

/**
 * Generate a BACKGROUND-ONLY prompt for image editing with reference product image
 *
 * When user provides a product image as reference, we only need to describe the
 * BACKGROUND/SCENE - the product itself will be preserved from the reference image.
 *
 * @deprecated Use i2vAgent.generateBackgroundForEditing() instead:
 * ```typescript
 * const i2vAgent = createI2VSpecialistAgent();
 * const result = await i2vAgent.generateBackgroundForEditing(videoPrompt, imageDescription, agentContext, options);
 * ```
 */
export async function generateBackgroundPromptForEditing(
  input: BackgroundPromptInput
): Promise<GeneratedImagePrompt> {
  if (isMockMode()) {
    console.log("[GEMINI] Running in mock mode - Background prompt generation");
    return {
      success: true,
      imagePrompt: `${input.sceneDescription}. ${input.style || "Cinematic"} style, professional lighting, ${input.aspectRatio || "16:9"} aspect ratio.`,
    };
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

    console.log("[GEMINI] Generating background-only prompt for image editing...");

    const systemPrompt = `You are an expert at creating BACKGROUND/SCENE descriptions for AI image editing.

CRITICAL: The user has a REFERENCE PRODUCT IMAGE that will be preserved exactly as-is.
Your job is to describe ONLY the background/environment/scene - NOT the product.

DO NOT:
- Describe the product/object itself (color, shape, brand, etc.)
- Include any product details
- Mention specific product characteristics

DO:
- Describe the background environment
- Describe lighting conditions
- Describe atmosphere and mood
- Describe any supporting elements (surfaces, hands holding product, etc.)
- Keep the description focused on WHERE the product is, not WHAT the product is

Output ONLY the background/scene description in English. Keep it concise (2-3 sentences max).`;

    const userPrompt = `Create a background/scene description for image editing:

USER'S SCENE CONCEPT: ${input.sceneDescription}

PRODUCT USAGE CONTEXT: ${input.productUsage}

${input.style ? `STYLE: ${input.style}` : ""}
${input.aspectRatio ? `ASPECT RATIO: ${input.aspectRatio}` : ""}

Generate a description of the BACKGROUND/ENVIRONMENT only. The product will be preserved from a reference image - do not describe the product itself.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = result.response;
    const backgroundPrompt = response.text().trim();

    if (!backgroundPrompt) {
      return {
        success: false,
        error: "Gemini returned empty response",
      };
    }

    console.log(`[GEMINI] Background prompt generated: ${backgroundPrompt.slice(0, 100)}...`);

    return {
      success: true,
      imagePrompt: backgroundPrompt,
    };
  } catch (error) {
    console.error("[GEMINI] Background prompt generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate a scene prompt with a PLACEHOLDER object for later composition
 *
 * Step 1 of 2-step composition: Preserve the FULL scene description but replace
 * the specific product with a generic placeholder that will be replaced by the
 * actual product image.
 *
 * @deprecated Use i2vAgent.generateSceneWithPlaceholder() instead:
 * ```typescript
 * const i2vAgent = createI2VSpecialistAgent();
 * const result = await i2vAgent.generateSceneWithPlaceholder(videoPrompt, imageDescription, agentContext, options);
 * ```
 */
export async function generateSceneWithPlaceholderPrompt(
  input: SceneWithPlaceholderInput
): Promise<GeneratedImagePrompt> {
  if (isMockMode()) {
    console.log("[GEMINI] Running in mock mode - Scene with placeholder prompt");
    return {
      success: true,
      imagePrompt: `${input.sceneDescription}. Instead of the specific product, she holds a simple white/neutral placeholder bottle. ${input.style || "Cinematic"} style, ${input.aspectRatio || "9:16"} aspect ratio.`,
    };
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

    console.log("[GEMINI] Generating scene with placeholder prompt...");

    const systemPrompt = `You are an expert at modifying image prompts for AI image generation.

Your task is to take an EXISTING scene description and modify it MINIMALLY:
- Keep the ENTIRE scene exactly as described (people, setting, actions, mood, lighting, etc.)
- ONLY replace the specific product/object with a GENERIC PLACEHOLDER
- The placeholder should be a simple, neutral-colored (white/gray) version of the same object type
- DO NOT simplify or reduce the scene to just "hands holding something"
- PRESERVE all details about people, environment, actions, camera angles, lighting, and style

The placeholder will later be replaced by an actual product image via AI compositing.

IMPORTANT RULES:
1. Keep 95% of the original prompt UNCHANGED
2. Only modify the product description to be a generic placeholder
3. Maintain all scene elements: people, location, actions, mood, lighting
4. The placeholder should be clearly visible and well-lit for easy compositing
5. CRITICAL: Output must describe ONE SINGLE coherent image - NOT a collage, NOT multiple images, NOT split screen
6. REMOVE any scene transitions like "cut to", "then", "second woman" - focus on ONE person, ONE moment
7. Pick the FIRST/MAIN scene only if original has multiple scenes

Output ONLY the modified image prompt in English. It must describe a SINGLE unified composition with ONE person.`;

    const userPrompt = `Modify this scene prompt to use a PLACEHOLDER instead of the specific product:

ORIGINAL SCENE DESCRIPTION:
${input.sceneDescription}

PRODUCT TYPE (what the placeholder should look like):
${input.productDescription}

MODIFICATION INSTRUCTIONS:
1. Replace the specific product with "a simple white/neutral placeholder ${input.productDescription.toLowerCase().includes('bottle') ? 'bottle' : input.productDescription.toLowerCase().includes('box') ? 'box' : 'container'}"
2. Keep the FIRST/MAIN scene only - remove any "cut to", "then", or secondary scenes
3. Focus on ONE person, ONE moment, ONE composition
4. Output must be for generating a SINGLE image, not a collage

${input.style ? `STYLE: ${input.style}` : ""}
${input.aspectRatio ? `ASPECT RATIO: ${input.aspectRatio}` : ""}`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = result.response;
    const scenePrompt = response.text().trim();

    if (!scenePrompt) {
      return {
        success: false,
        error: "Gemini returned empty response",
      };
    }

    console.log(`[GEMINI] Scene with placeholder prompt generated: ${scenePrompt.slice(0, 100)}...`);

    return {
      success: true,
      imagePrompt: scenePrompt,
    };
  } catch (error) {
    console.error("[GEMINI] Scene with placeholder prompt generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate a prompt for compositing product image with scene image
 *
 * Step 2 of 2-step composition: Instructions for replacing the placeholder
 * with the actual product image.
 *
 * @deprecated Use i2vAgent.generateComposite() instead:
 * ```typescript
 * const i2vAgent = createI2VSpecialistAgent();
 * const result = await i2vAgent.generateComposite(videoPrompt, imageDescription, placementHint, agentContext);
 * ```
 */
export async function generateCompositePrompt(
  input: CompositePromptInput
): Promise<GeneratedImagePrompt> {
  if (isMockMode()) {
    console.log("[GEMINI] Running in mock mode - Composite prompt");
    return {
      success: true,
      imagePrompt: `Seamlessly composite the product image into the scene. Replace the placeholder with the actual product while maintaining perfect lighting consistency, natural shadows, and realistic integration. The product should appear as if it was originally photographed in this scene.`,
    };
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

    console.log("[GEMINI] Generating composite prompt...");

    const systemPrompt = `You are an expert at creating image compositing instructions for AI.
Your task is to create instructions for seamlessly compositing a product image into a scene image.

The AI will receive:
1. A SCENE IMAGE showing hands holding a placeholder object
2. A PRODUCT IMAGE showing the actual product

Your instructions must ensure:
1. The product EXACTLY replaces the placeholder - same position, same angle
2. Lighting on the product matches the scene's lighting direction and intensity
3. Shadows are consistent with the scene
4. The product appears naturally held by the hands
5. Scale is appropriate - the product fits naturally in the hands
6. The product's original appearance is PRESERVED - only lighting/shadows are adjusted

CRITICAL: The product image must NOT be modified except for:
- Lighting adjustment to match scene
- Shadow addition for realism
- Scale adjustment to fit hands naturally

Output ONLY the compositing instructions in English. Keep it concise but precise (2-3 sentences).`;

    const userPrompt = `Create compositing instructions:

SCENE DESCRIPTION: ${input.sceneDescription}

PRODUCT DESCRIPTION: ${input.productDescription}

PLACEMENT: ${input.placementHint}

Generate precise instructions for seamlessly placing the product image into the scene, replacing the placeholder while maintaining photorealistic quality.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = result.response;
    const compositePrompt = response.text().trim();

    if (!compositePrompt) {
      return {
        success: false,
        error: "Gemini returned empty response",
      };
    }

    console.log(`[GEMINI] Composite prompt generated: ${compositePrompt.slice(0, 100)}...`);

    return {
      success: true,
      imagePrompt: compositePrompt,
    };
  } catch (error) {
    console.error("[GEMINI] Composite prompt generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Step 1: Generate an optimized image prompt for the first frame
 *
 * Takes the video concept and image description, and creates a prompt
 * that will generate an image suitable as the starting frame of the video.
 *
 * @deprecated Use i2vAgent.generateImagePrompt() instead:
 * ```typescript
 * const i2vAgent = createI2VSpecialistAgent();
 * const result = await i2vAgent.generateImagePrompt(sceneDescription, agentContext, options);
 * ```
 */
export async function generateImagePromptForI2V(
  input: I2VPromptInput
): Promise<GeneratedImagePrompt> {
  if (isMockMode()) {
    console.log("[GEMINI] Running in mock mode - Image prompt generation");
    return generateMockImagePrompt(input);
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

    console.log("[GEMINI] Generating image prompt for I2V...");

    const systemPrompt = `You are an expert at creating image generation prompts for AI image generators like Google Imagen.
Your task is to create a prompt that will generate a high-quality still image that will serve as the FIRST FRAME of a video.

CRITICAL PRIORITY - PRODUCT PLACEMENT:
- The "PRODUCT/OBJECT FOCUS" section describes the KEY ELEMENT that MUST be prominently featured
- This product/object must be clearly visible, well-lit, and the central focus of the composition
- Describe the product in detail: its appearance, position, how it's being held/displayed
- The product should take up significant visual space in the frame

Image guidelines:
- The image must be a static, high-quality photograph
- Cinematic composition with the product as the hero element
- Professional product photography lighting - the product should be well-lit and clearly visible
- Do NOT include any motion words (no "moving", "flowing", "rotating" etc.)
- Output ONLY the image prompt, no explanations or additional text
- Write the prompt in English for best results with Imagen

IMPORTANT: The product/object description is the MOST important part. Make sure it is described in detail and prominently placed in the scene.`;

    const userPrompt = `Create an image generation prompt based on:

SCENE CONTEXT (background and setting):
${input.videoPrompt}

PRODUCT/OBJECT FOCUS (MOST IMPORTANT - must be clearly visible and central):
${input.imageDescription}

${input.style ? `STYLE: ${input.style}` : ""}
${input.aspectRatio ? `ASPECT RATIO: ${input.aspectRatio}` : ""}

Generate a detailed image prompt where the PRODUCT/OBJECT is the HERO ELEMENT, clearly visible and prominently placed within the scene context. The product should be the focal point of the composition.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = result.response;
    const imagePrompt = response.text().trim();

    if (!imagePrompt) {
      return {
        success: false,
        error: "Gemini returned empty response",
      };
    }

    console.log(`[GEMINI] Image prompt generated: ${imagePrompt.slice(0, 100)}...`);

    return {
      success: true,
      imagePrompt,
    };
  } catch (error) {
    console.error("[GEMINI] Image prompt generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Step 3: Generate a video prompt with specific animation instructions
 *
 * After the image is generated, this creates a VEO-optimized prompt that:
 * - References the generated image as the starting frame
 * - Includes specific animation/motion instructions
 * - Tells VEO exactly how to animate the first frame into video
 *
 * @deprecated Use i2vAgent.generateVideoPrompt() instead:
 * ```typescript
 * const i2vAgent = createI2VSpecialistAgent();
 * const result = await i2vAgent.generateVideoPrompt(imageAnalysis, sceneDescription, agentContext, options);
 * ```
 */
export async function generateVideoPromptForI2V(
  input: I2VPromptInput,
  generatedImageDescription?: string  // Optional: description of what was actually generated
): Promise<GeneratedVideoPrompt> {
  if (isMockMode()) {
    console.log("[GEMINI] Running in mock mode - Video prompt generation");
    return generateMockVideoPrompt(input);
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

    console.log("[GEMINI] Generating video prompt for I2V with animation instructions...");

    const systemPrompt = `You are an expert at creating video generation prompts for Google VEO (Video Generation AI).
Your task is to create a prompt that will animate a REFERENCE IMAGE into a video.

CRITICAL: VEO will receive both:
1. A reference image (the first frame)
2. Your video prompt (how to animate it)

Your prompt MUST:
- Start with "Starting from the reference image:" to anchor VEO to the provided image
- Describe HOW the elements in the image should move/animate
- Specify camera movements (if any): pan, zoom, dolly, static, etc.
- Describe the progression/transformation over the video duration
- Include timing hints (slowly, gradually, suddenly, etc.)
- Maintain visual consistency with the starting image throughout
- Be specific about what moves and what stays static

DO NOT:
- Describe the image itself (VEO will see it)
- Ask VEO to generate new unrelated elements
- Include text overlays or UI elements
- Output anything except the video prompt

Output ONLY the video prompt in English.`;

    const userPrompt = `Create a VEO video prompt to animate the reference image:

ORIGINAL VIDEO CONCEPT:
${input.videoPrompt}

HOW THE FIRST FRAME LOOKS:
${input.imageDescription}

${generatedImageDescription ? `GENERATED IMAGE DETAILS:\n${generatedImageDescription}` : ""}
${input.style ? `STYLE: ${input.style}` : ""}
DURATION: ~5 seconds

Generate a video prompt that tells VEO how to animate this first frame into a cohesive video.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);

    const response = result.response;
    const videoPrompt = response.text().trim();

    if (!videoPrompt) {
      return {
        success: false,
        error: "Gemini returned empty response",
      };
    }

    console.log(`[GEMINI] Video prompt generated: ${videoPrompt.slice(0, 100)}...`);

    return {
      success: true,
      videoPrompt,
    };
  } catch (error) {
    console.error("[GEMINI] Video prompt generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Complete I2V prompt generation pipeline
 * Returns both image and video prompts in one call
 *
 * @deprecated Use individual agent methods instead:
 * ```typescript
 * const i2vAgent = createI2VSpecialistAgent();
 * const imageResult = await i2vAgent.generateImagePrompt(sceneDescription, agentContext, options);
 * const videoResult = await i2vAgent.generateVideoPrompt(imageAnalysis, sceneDescription, agentContext, options);
 * ```
 */
export async function generateI2VPrompts(
  input: I2VPromptInput
): Promise<{
  success: boolean;
  imagePrompt?: string;
  videoPrompt?: string;
  error?: string;
}> {
  // Step 1: Generate image prompt
  const imageResult = await generateImagePromptForI2V(input);
  if (!imageResult.success || !imageResult.imagePrompt) {
    return {
      success: false,
      error: `Image prompt generation failed: ${imageResult.error}`,
    };
  }

  // Step 2: Generate video prompt (we'll call this after image is actually generated)
  // For now, just return the image prompt - video prompt will be generated after image
  return {
    success: true,
    imagePrompt: imageResult.imagePrompt,
  };
}

// Mock implementations for development/testing
function generateMockImagePrompt(input: I2VPromptInput): GeneratedImagePrompt {
  console.log(`[GEMINI-MOCK] Generated mock image prompt for: "${input.videoPrompt.slice(0, 50)}..."`);

  return {
    success: true,
    imagePrompt: `HERO PRODUCT in focus: ${input.imageDescription}.
The product is prominently displayed, well-lit, and clearly visible as the central element of the composition.
Scene context: ${input.videoPrompt.slice(0, 150)}.
Professional product photography lighting with the product as the focal point.
High quality, sharp focus on the product, cinematic composition.
${input.style ? `Style: ${input.style}.` : ""}
Aspect ratio: ${input.aspectRatio || "16:9"}.`,
  };
}

function generateMockVideoPrompt(input: I2VPromptInput): GeneratedVideoPrompt {
  console.log(`[GEMINI-MOCK] Generated mock video prompt for: "${input.videoPrompt.slice(0, 50)}..."`);

  return {
    success: true,
    videoPrompt: `Starting from the reference image: ${input.imageDescription}.
The scene gradually comes to life as ${input.videoPrompt}.
Camera slowly pushes in while maintaining focus on the central elements.
Subtle movements animate the scene over 5 seconds.
Smooth transitions, cinematic motion blur, maintaining visual consistency with the starting frame throughout.`,
  };
}
