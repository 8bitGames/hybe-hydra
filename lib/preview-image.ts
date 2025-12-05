/**
 * Preview Image Generation Utilities
 *
 * Shared logic for generating preview images (first frames) for I2V workflow.
 * Used by both /create and /campaigns/[id] API endpoints.
 */

import { v4 as uuidv4 } from "uuid";
import { generateImage, convertAspectRatioForImagen, generateTwoStepComposition } from "@/lib/imagen";
import {
  generateImagePromptForI2V,
  generateBackgroundPromptForEditing,
  generateSceneWithPlaceholderPrompt,
  generateCompositePrompt,
} from "@/lib/gemini-prompt";
import { uploadToS3 } from "@/lib/storage";

// ============================================================================
// Types
// ============================================================================

export interface PreviewImageInput {
  video_prompt: string;
  image_description: string;
  aspect_ratio?: string;
  style?: string;
  negative_prompt?: string;
  product_image_url?: string;
  composition_mode?: "direct" | "two_step";
  hand_pose?: string;
}

export interface PreviewImageResult {
  success: boolean;
  preview_id: string;
  image_url: string;
  image_base64: string;
  gemini_image_prompt: string;
  aspect_ratio: string;
  composition_mode: "direct" | "two_step";
  // Two-step mode only
  scene_image_url?: string;
  scene_image_base64?: string;
  composite_prompt?: string;
  // Error info
  error?: string;
}

export interface S3PathConfig {
  type: "user" | "campaign";
  id: string; // userId or campaignId
}

// ============================================================================
// Direct Mode Generation
// ============================================================================

/**
 * Generate preview image using DIRECT mode.
 * - If product_image_url is provided: Generate background-only prompt
 * - If no product_image_url: Generate full image prompt
 */
export async function generateDirectPreviewImage(
  input: PreviewImageInput,
  s3Config: S3PathConfig,
  logPrefix: string = "[Preview Image]"
): Promise<PreviewImageResult> {
  const {
    video_prompt,
    image_description,
    aspect_ratio = "9:16",
    style,
    negative_prompt,
    product_image_url,
  } = input;

  const previewId = uuidv4();

  console.log(`${logPrefix} Using DIRECT mode`);

  // Step 1: Generate appropriate prompt based on whether we have a reference image
  let geminiImagePrompt: string;

  if (product_image_url) {
    // Reference image provided → generate BACKGROUND-ONLY prompt
    console.log(`${logPrefix} Step 1: Generating BACKGROUND-ONLY prompt (reference image mode)...`);
    const backgroundPromptResult = await generateBackgroundPromptForEditing({
      sceneDescription: video_prompt,
      productUsage: image_description,
      style,
      aspectRatio: aspect_ratio,
    });

    if (!backgroundPromptResult.success || !backgroundPromptResult.imagePrompt) {
      console.error(`${logPrefix} Background prompt generation failed: ${backgroundPromptResult.error}`);
      return {
        success: false,
        preview_id: previewId,
        image_url: "",
        image_base64: "",
        gemini_image_prompt: "",
        aspect_ratio,
        composition_mode: "direct",
        error: `Failed to generate background prompt: ${backgroundPromptResult.error}`,
      };
    }

    geminiImagePrompt = backgroundPromptResult.imagePrompt;
    console.log(`${logPrefix} Background-only prompt: ${geminiImagePrompt.slice(0, 150)}...`);
  } else {
    // No reference image → generate full prompt with product description
    console.log(`${logPrefix} Step 1: Generating full image prompt (no reference image)...`);
    const imagePromptResult = await generateImagePromptForI2V({
      videoPrompt: video_prompt,
      imageDescription: image_description,
      style,
      aspectRatio: aspect_ratio,
    });

    if (!imagePromptResult.success || !imagePromptResult.imagePrompt) {
      console.error(`${logPrefix} Gemini image prompt failed: ${imagePromptResult.error}`);
      return {
        success: false,
        preview_id: previewId,
        image_url: "",
        image_base64: "",
        gemini_image_prompt: "",
        aspect_ratio,
        composition_mode: "direct",
        error: `Failed to generate image prompt: ${imagePromptResult.error}`,
      };
    }

    geminiImagePrompt = imagePromptResult.imagePrompt;
    console.log(`${logPrefix} Full image prompt: ${geminiImagePrompt.slice(0, 150)}...`);
  }

  // Step 2: Generate image with Imagen
  console.log(`${logPrefix} Step 2: Generating image with Imagen...`);
  let imageResult;
  try {
    imageResult = await generateImage({
      prompt: geminiImagePrompt,
      negativePrompt: negative_prompt,
      aspectRatio: convertAspectRatioForImagen(aspect_ratio),
      style,
      referenceImageUrl: product_image_url,
    });
  } catch (imagenError) {
    console.error(`${logPrefix} Imagen generation threw exception:`, imagenError);
    return {
      success: false,
      preview_id: previewId,
      image_url: "",
      image_base64: "",
      gemini_image_prompt: geminiImagePrompt,
      aspect_ratio,
      composition_mode: "direct",
      error: `Image generation failed: ${imagenError instanceof Error ? imagenError.message : "Unknown error"}`,
    };
  }

  if (!imageResult.success || !imageResult.imageBase64) {
    console.error(`${logPrefix} Imagen generation returned failure: ${imageResult.error}`);
    return {
      success: false,
      preview_id: previewId,
      image_url: "",
      image_base64: "",
      gemini_image_prompt: geminiImagePrompt,
      aspect_ratio,
      composition_mode: "direct",
      error: `Image generation failed: ${imageResult.error}`,
    };
  }

  console.log(`${logPrefix} Image generated successfully!`);

  // Step 3: Upload to S3
  const filename = `preview-${previewId}.png`;
  let imageUrl: string;

  try {
    const imageBuffer = Buffer.from(imageResult.imageBase64, "base64");
    const s3Key =
      s3Config.type === "user"
        ? `users/${s3Config.id}/previews/${filename}`
        : `campaigns/${s3Config.id}/previews/${filename}`;
    imageUrl = await uploadToS3(imageBuffer, s3Key, "image/png");
    console.log(`${logPrefix} Uploaded to S3: ${imageUrl}`);
  } catch (uploadError) {
    console.error(`${logPrefix} S3 upload failed:`, uploadError);
    // Fallback: return base64 data URL
    imageUrl = `data:image/png;base64,${imageResult.imageBase64}`;
    console.log(`${logPrefix} Using base64 data URL fallback`);
  }

  return {
    success: true,
    preview_id: previewId,
    image_url: imageUrl,
    image_base64: imageResult.imageBase64,
    gemini_image_prompt: geminiImagePrompt,
    aspect_ratio,
    composition_mode: "direct",
  };
}

// ============================================================================
// Two-Step Composition Mode Generation
// ============================================================================

/**
 * Generate preview image using TWO-STEP composition mode.
 * 1. Generate scene with placeholder
 * 2. Generate composite instructions
 * 3. Execute two-step composition (scene generation + product compositing)
 */
export async function generateTwoStepPreviewImage(
  input: PreviewImageInput,
  s3Config: S3PathConfig,
  logPrefix: string = "[Preview Image]"
): Promise<PreviewImageResult> {
  const {
    video_prompt,
    image_description,
    aspect_ratio = "9:16",
    style,
    product_image_url,
    hand_pose = "elegantly holding",
  } = input;

  if (!product_image_url) {
    return {
      success: false,
      preview_id: "",
      image_url: "",
      image_base64: "",
      gemini_image_prompt: "",
      aspect_ratio,
      composition_mode: "two_step",
      error: "product_image_url is required for two_step composition mode",
    };
  }

  const previewId = uuidv4();

  console.log(`${logPrefix} Using TWO-STEP composition mode`);

  // Step 1: Generate scene prompt with placeholder
  console.log(`${logPrefix} Step 1: Generating scene with placeholder prompt...`);
  const scenePromptResult = await generateSceneWithPlaceholderPrompt({
    sceneDescription: video_prompt,
    productDescription: image_description,
    handPose: hand_pose,
    style,
    aspectRatio: aspect_ratio,
  });

  if (!scenePromptResult.success || !scenePromptResult.imagePrompt) {
    console.error(`${logPrefix} Scene prompt generation failed: ${scenePromptResult.error}`);
    return {
      success: false,
      preview_id: previewId,
      image_url: "",
      image_base64: "",
      gemini_image_prompt: "",
      aspect_ratio,
      composition_mode: "two_step",
      error: `Failed to generate scene prompt: ${scenePromptResult.error}`,
    };
  }

  // Step 2: Generate composite prompt
  console.log(`${logPrefix} Step 2: Generating composite instructions...`);
  const compositePromptResult = await generateCompositePrompt({
    sceneDescription: video_prompt,
    productDescription: image_description,
    placementHint: `Hands ${hand_pose} the product`,
  });

  if (!compositePromptResult.success || !compositePromptResult.imagePrompt) {
    console.error(`${logPrefix} Composite prompt generation failed: ${compositePromptResult.error}`);
    return {
      success: false,
      preview_id: previewId,
      image_url: "",
      image_base64: "",
      gemini_image_prompt: scenePromptResult.imagePrompt,
      aspect_ratio,
      composition_mode: "two_step",
      error: `Failed to generate composite prompt: ${compositePromptResult.error}`,
    };
  }

  // Step 3: Execute two-step composition
  console.log(`${logPrefix} Step 3: Executing two-step composition...`);
  let compositionResult;
  try {
    compositionResult = await generateTwoStepComposition({
      scenePrompt: scenePromptResult.imagePrompt,
      productImageUrl: product_image_url,
      compositePrompt: compositePromptResult.imagePrompt,
      aspectRatio: convertAspectRatioForImagen(aspect_ratio),
      style,
    });
  } catch (compositionError) {
    console.error(`${logPrefix} Two-step composition threw exception:`, compositionError);
    return {
      success: false,
      preview_id: previewId,
      image_url: "",
      image_base64: "",
      gemini_image_prompt: scenePromptResult.imagePrompt,
      composite_prompt: compositePromptResult.imagePrompt,
      aspect_ratio,
      composition_mode: "two_step",
      error: `Composition failed: ${compositionError instanceof Error ? compositionError.message : "Unknown error"}`,
    };
  }

  if (!compositionResult.success || !compositionResult.finalImageBase64) {
    console.error(`${logPrefix} Two-step composition failed: ${compositionResult.error}`);
    return {
      success: false,
      preview_id: previewId,
      image_url: "",
      image_base64: "",
      gemini_image_prompt: scenePromptResult.imagePrompt,
      composite_prompt: compositePromptResult.imagePrompt,
      aspect_ratio,
      composition_mode: "two_step",
      error: `Composition failed: ${compositionResult.error}`,
    };
  }

  console.log(`${logPrefix} Two-step composition completed successfully!`);

  // Upload images to S3
  let imageUrl: string;
  let sceneImageUrl: string | undefined;
  const basePath = s3Config.type === "user" ? `users/${s3Config.id}` : `campaigns/${s3Config.id}`;

  try {
    // Upload final composited image
    const imageBuffer = Buffer.from(compositionResult.finalImageBase64, "base64");
    const s3Key = `${basePath}/previews/preview-${previewId}.png`;
    imageUrl = await uploadToS3(imageBuffer, s3Key, "image/png");
    console.log(`${logPrefix} Final image uploaded to S3: ${imageUrl}`);

    // Optionally upload scene image for debugging/reference
    if (compositionResult.sceneImageBase64) {
      const sceneBuffer = Buffer.from(compositionResult.sceneImageBase64, "base64");
      const sceneS3Key = `${basePath}/previews/scene-${previewId}.png`;
      sceneImageUrl = await uploadToS3(sceneBuffer, sceneS3Key, "image/png");
      console.log(`${logPrefix} Scene image uploaded to S3: ${sceneImageUrl}`);
    }
  } catch (uploadError) {
    console.error(`${logPrefix} S3 upload failed:`, uploadError);
    imageUrl = `data:image/png;base64,${compositionResult.finalImageBase64}`;
    console.log(`${logPrefix} Using base64 data URL fallback`);
  }

  return {
    success: true,
    preview_id: previewId,
    image_url: imageUrl,
    image_base64: compositionResult.finalImageBase64,
    gemini_image_prompt: scenePromptResult.imagePrompt,
    composite_prompt: compositePromptResult.imagePrompt,
    aspect_ratio,
    composition_mode: "two_step",
    scene_image_url: sceneImageUrl,
    scene_image_base64: compositionResult.sceneImageBase64,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate preview image with automatic mode selection.
 * - If composition_mode is "two_step" and product_image_url is provided: Use two-step mode
 * - Otherwise: Use direct mode
 */
export async function generatePreviewImage(
  input: PreviewImageInput,
  s3Config: S3PathConfig,
  logPrefix: string = "[Preview Image]"
): Promise<PreviewImageResult> {
  const { composition_mode, product_image_url } = input;

  // Determine effective composition mode
  const effectiveMode = composition_mode || (product_image_url ? "two_step" : "direct");

  console.log(`${logPrefix} Starting preview generation`);
  console.log(`${logPrefix} Video prompt: ${input.video_prompt.slice(0, 100)}...`);
  console.log(`${logPrefix} Image description: ${input.image_description.slice(0, 100)}...`);
  console.log(`${logPrefix} Composition mode: ${effectiveMode}`);

  if (effectiveMode === "two_step" && product_image_url) {
    return generateTwoStepPreviewImage(input, s3Config, logPrefix);
  }

  return generateDirectPreviewImage(input, s3Config, logPrefix);
}
