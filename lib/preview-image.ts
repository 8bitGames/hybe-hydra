/**
 * Preview Image Generation Utilities
 *
 * Shared logic for generating preview images (first frames) for I2V workflow.
 * Used by both /create and /campaigns/[id] API endpoints.
 *
 * NOTE: Image generation is routed to AWS Batch backend where Vertex AI Gemini 3 Pro Image
 * can run with WIF (Workload Identity Federation) authentication.
 * Vercel serverless doesn't have access to AWS metadata service needed for WIF.
 */

import { v4 as uuidv4 } from "uuid";
import { convertAspectRatioForGeminiImage, generateTwoStepComposition } from "@/lib/imagen";
import { createI2VSpecialistAgent } from "@/lib/agents/transformers/i2v-specialist";
import type { AgentContext } from "@/lib/agents/types";
import { uploadToS3, downloadFromS3AsBase64, getPresignedUrl } from "@/lib/storage";
import { prisma } from "@/lib/db/prisma";
import {
  submitImageGeneration,
  getAIJobStatus,
  generateAIJobId,
  type ImageAspectRatio,
} from "@/lib/batch/ai-client";

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
  gemini_image_prompt?: string;  // Pre-generated image prompt (skips I2V Agent if provided)
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
  // Database record
  database_id?: string; // ID of saved GeneratedPreviewImage record
  // Error info
  error?: string;
}

// ============================================================================
// AWS Batch Helper Functions
// ============================================================================

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "hydra-assets-hybe";
const POLL_INTERVAL_MS = 3000; // 3 seconds
const MAX_WAIT_TIME_MS = 300000; // 5 minutes

interface BatchImageGenerationResult {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  s3Key?: string;
  error?: string;
}

/**
 * Generate image via AWS Batch backend (Vertex AI Gemini 3 Pro Image)
 * Submits job, polls for completion, and downloads result from S3
 */
async function generateImageViaBatch(
  prompt: string,
  aspectRatio: string,
  negativePrompt?: string,
  logPrefix: string = "[Preview Image]"
): Promise<BatchImageGenerationResult> {
  const jobId = generateAIJobId("img");
  const s3Key = `ai/images/${jobId}/output.png`;

  console.log(`${logPrefix} [AWS Batch] Submitting image generation job: ${jobId}`);

  // Submit job to AWS Batch
  const submitResult = await submitImageGeneration(
    jobId,
    {
      prompt,
      negative_prompt: negativePrompt,
      aspect_ratio: convertAspectRatioForGeminiImage(aspectRatio) as ImageAspectRatio,
      number_of_images: 1,
      safety_filter_level: "block_some",
      person_generation: "allow_adult",
    },
    {
      s3_bucket: AWS_S3_BUCKET,
      s3_key: s3Key,
    }
  );

  if (submitResult.status === "error") {
    console.error(`${logPrefix} [AWS Batch] Job submit failed: ${submitResult.error}`);
    return {
      success: false,
      error: `AWS Batch submit failed: ${submitResult.error}`,
    };
  }

  console.log(`${logPrefix} [AWS Batch] Job queued: ${submitResult.batch_job_id}`);

  // Poll for completion
  const startTime = Date.now();
  while (Date.now() - startTime < MAX_WAIT_TIME_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const status = await getAIJobStatus(submitResult.batch_job_id, "image_generation");
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    console.log(`${logPrefix} [AWS Batch] Status: ${status.status} (${elapsed}s elapsed)`);

    if (status.mappedStatus === "completed") {
      // Job completed - download image from S3
      console.log(`${logPrefix} [AWS Batch] Job completed! Downloading from S3: ${s3Key}`);

      try {
        const imageBase64 = await downloadFromS3AsBase64(s3Key);
        const imageUrl = await getPresignedUrl(s3Key, 604800); // 7 days

        return {
          success: true,
          imageBase64,
          imageUrl,
          s3Key,
        };
      } catch (downloadError) {
        console.error(`${logPrefix} [AWS Batch] Failed to download from S3:`, downloadError);
        return {
          success: false,
          error: `Failed to download generated image: ${downloadError instanceof Error ? downloadError.message : "Unknown error"}`,
        };
      }
    }

    if (status.mappedStatus === "failed") {
      console.error(`${logPrefix} [AWS Batch] Job failed: ${status.statusReason}`);
      return {
        success: false,
        error: `Image generation failed: ${status.statusReason || "Unknown error"}`,
      };
    }
  }

  // Timeout
  console.error(`${logPrefix} [AWS Batch] Job timed out after ${MAX_WAIT_TIME_MS / 1000}s`);
  return {
    success: false,
    error: `Image generation timed out after ${MAX_WAIT_TIME_MS / 1000} seconds`,
  };
}

// ============================================================================
// Database Operations
// ============================================================================

interface SavePreviewImageParams {
  previewId: string;
  imageUrl: string;
  s3Key: string;
  input: PreviewImageInput;
  geminiImagePrompt: string;
  compositePrompt?: string;
  sceneImageUrl?: string;
  sceneImageS3Key?: string;
  s3Config: S3PathConfig;
}

/**
 * Save generated preview image to database
 */
async function savePreviewImageToDatabase(
  params: SavePreviewImageParams
): Promise<string | null> {
  try {
    const record = await prisma.generatedPreviewImage.create({
      data: {
        previewId: params.previewId,
        imageUrl: params.imageUrl,
        s3Key: params.s3Key,
        videoPrompt: params.input.video_prompt,
        imageDescription: params.input.image_description,
        geminiImagePrompt: params.geminiImagePrompt,
        aspectRatio: params.input.aspect_ratio || "9:16",
        style: params.input.style,
        negativePrompt: params.input.negative_prompt,
        compositionMode: params.input.composition_mode || "direct",
        compositePrompt: params.compositePrompt,
        sceneImageUrl: params.sceneImageUrl,
        sceneImageS3Key: params.sceneImageS3Key,
        productImageUrl: params.input.product_image_url,
        handPose: params.input.hand_pose,
        userId: params.s3Config.userId,
        campaignId: params.s3Config.type === "campaign" ? params.s3Config.id : (params.s3Config.campaignId || null),
      },
    });
    console.log(`[Preview Image] Saved to database with ID: ${record.id}`);
    return record.id;
  } catch (dbError) {
    console.error("[Preview Image] Failed to save to database:", dbError);
    return null;
  }
}

export interface S3PathConfig {
  type: "user" | "campaign";
  id: string; // userId or campaignId
  userId: string; // Always required for database storage
  campaignId?: string; // Optional: when type is "user" but we still want to link to a campaign
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
    gemini_image_prompt: existingImagePrompt,
  } = input;

  const previewId = uuidv4();

  console.log(`${logPrefix} Using DIRECT mode`);

  // Step 1: Use existing prompt or generate new one
  let geminiImagePrompt: string;

  // If pre-generated prompt is provided, skip I2V Agent
  if (existingImagePrompt) {
    console.log(`${logPrefix} Step 1: Using pre-generated image prompt (skipping I2V Agent)`);
    geminiImagePrompt = existingImagePrompt;
    console.log(`${logPrefix} Pre-generated prompt: ${geminiImagePrompt.slice(0, 150)}...`);
  } else {
    // Create I2V Specialist Agent and context
    const i2vAgent = createI2VSpecialistAgent();
    const agentContext: AgentContext = {
      workflow: {
        artistName: "Brand",
        platform: "tiktok",
        language: "ko",
        sessionId: `preview-${Date.now()}`,
      },
    };

    // Generate appropriate prompt based on whether we have a reference image
    if (product_image_url) {
      // Reference image provided → generate BACKGROUND-ONLY prompt
      console.log(`${logPrefix} Step 1: Generating BACKGROUND-ONLY prompt (reference image mode)...`);
      const backgroundPromptResult = await i2vAgent.generateBackgroundForEditing(
        video_prompt,
        image_description,
        agentContext,
        { style, aspectRatio: aspect_ratio }
      );

      if (!backgroundPromptResult.success || !backgroundPromptResult.data?.prompt) {
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

      geminiImagePrompt = backgroundPromptResult.data.prompt;
      console.log(`${logPrefix} Background-only prompt: ${geminiImagePrompt.slice(0, 150)}...`);
    } else {
      // No reference image → generate full prompt with product description
      console.log(`${logPrefix} Step 1: Generating full image prompt (no reference image)...`);
      const imagePromptResult = await i2vAgent.generateImagePrompt(
        `${video_prompt}. ${image_description}`,
        agentContext,
        { style }
      );

      if (!imagePromptResult.success || !imagePromptResult.data?.prompt) {
        console.error(`${logPrefix} Image prompt generation failed: ${imagePromptResult.error}`);
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

      geminiImagePrompt = imagePromptResult.data.prompt;
      console.log(`${logPrefix} Full image prompt: ${geminiImagePrompt.slice(0, 150)}...`);
    }
  }

  // Step 2: Generate image via AWS Batch backend (Vertex AI)
  // NOTE: Only Vertex AI is supported. Google AI API is not used.
  console.log(`${logPrefix} Step 2: Generating image via AWS Batch backend (Vertex AI)...`);

  // Note: product_image_url (reference image) is not yet supported in batch mode
  // TODO: Add reference image support to AWS Batch ai_worker.py
  if (product_image_url) {
    console.warn(`${logPrefix} Warning: Reference image (product_image_url) is not yet supported in batch mode. Generating without reference.`);
  }

  const imageResult = await generateImageViaBatch(
    geminiImagePrompt,
    aspect_ratio,
    negative_prompt,
    logPrefix
  );

  if (!imageResult.success || !imageResult.imageBase64) {
    console.error(`${logPrefix} AWS Batch image generation failed: ${imageResult.error}`);
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

  console.log(`${logPrefix} Image generated successfully via AWS Batch!`);

  // Step 3: Upload to S3
  const filename = `preview-${previewId}.png`;
  let imageUrl: string;
  let s3Key: string = "";

  // Type guard: imageBase64 is guaranteed to exist at this point (checked above)
  const imageBase64 = imageResult.imageBase64!;

  try {
    const imageBuffer = Buffer.from(imageBase64, "base64");
    s3Key =
      s3Config.type === "user"
        ? `users/${s3Config.id}/previews/${filename}`
        : `campaigns/${s3Config.id}/previews/${filename}`;
    imageUrl = await uploadToS3(imageBuffer, s3Key, "image/png");
    console.log(`${logPrefix} Uploaded to S3: ${imageUrl}`);
  } catch (uploadError) {
    console.error(`${logPrefix} S3 upload failed:`, uploadError);
    // Fallback: return base64 data URL
    imageUrl = `data:image/png;base64,${imageBase64}`;
    console.log(`${logPrefix} Using base64 data URL fallback`);
  }

  // Step 4: Save to database
  const databaseId = await savePreviewImageToDatabase({
    previewId,
    imageUrl,
    s3Key,
    input,
    geminiImagePrompt,
    s3Config,
  });

  return {
    success: true,
    preview_id: previewId,
    image_url: imageUrl,
    image_base64: imageBase64,
    gemini_image_prompt: geminiImagePrompt,
    aspect_ratio,
    composition_mode: "direct",
    database_id: databaseId || undefined,
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

  // Create I2V Specialist Agent and context
  const i2vAgent = createI2VSpecialistAgent();
  const agentContext: AgentContext = {
    workflow: {
      artistName: "Brand",
      platform: "tiktok",
      language: "ko",
      sessionId: `preview-twostep-${Date.now()}`,
    },
  };

  // Step 1: Generate scene prompt with placeholder
  console.log(`${logPrefix} Step 1: Generating scene with placeholder prompt...`);
  const scenePromptResult = await i2vAgent.generateSceneWithPlaceholder(
    video_prompt,
    image_description,
    agentContext,
    { handPose: hand_pose, style, aspectRatio: aspect_ratio }
  );

  if (!scenePromptResult.success || !scenePromptResult.data?.prompt) {
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
  const compositePromptResult = await i2vAgent.generateComposite(
    video_prompt,
    image_description,
    `Hands ${hand_pose} the product`,
    agentContext
  );

  if (!compositePromptResult.success || !compositePromptResult.data?.prompt) {
    console.error(`${logPrefix} Composite prompt generation failed: ${compositePromptResult.error}`);
    return {
      success: false,
      preview_id: previewId,
      image_url: "",
      image_base64: "",
      gemini_image_prompt: scenePromptResult.data.prompt,
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
      scenePrompt: scenePromptResult.data.prompt,
      productImageUrl: product_image_url,
      compositePrompt: compositePromptResult.data.prompt,
      aspectRatio: convertAspectRatioForGeminiImage(aspect_ratio),
      style,
    });
  } catch (compositionError) {
    console.error(`${logPrefix} Two-step composition threw exception:`, compositionError);
    return {
      success: false,
      preview_id: previewId,
      image_url: "",
      image_base64: "",
      gemini_image_prompt: scenePromptResult.data.prompt,
      composite_prompt: compositePromptResult.data.prompt,
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
      gemini_image_prompt: scenePromptResult.data.prompt,
      composite_prompt: compositePromptResult.data.prompt,
      aspect_ratio,
      composition_mode: "two_step",
      error: `Composition failed: ${compositionResult.error}`,
    };
  }

  console.log(`${logPrefix} Two-step composition completed successfully!`);

  // Upload images to S3
  let imageUrl: string;
  let sceneImageUrl: string | undefined;
  let s3Key: string = "";
  let sceneS3Key: string | undefined;
  const basePath = s3Config.type === "user" ? `users/${s3Config.id}` : `campaigns/${s3Config.id}`;

  try {
    // Upload final composited image
    const imageBuffer = Buffer.from(compositionResult.finalImageBase64, "base64");
    s3Key = `${basePath}/previews/preview-${previewId}.png`;
    imageUrl = await uploadToS3(imageBuffer, s3Key, "image/png");
    console.log(`${logPrefix} Final image uploaded to S3: ${imageUrl}`);

    // Optionally upload scene image for debugging/reference
    if (compositionResult.sceneImageBase64) {
      const sceneBuffer = Buffer.from(compositionResult.sceneImageBase64, "base64");
      sceneS3Key = `${basePath}/previews/scene-${previewId}.png`;
      sceneImageUrl = await uploadToS3(sceneBuffer, sceneS3Key, "image/png");
      console.log(`${logPrefix} Scene image uploaded to S3: ${sceneImageUrl}`);
    }
  } catch (uploadError) {
    console.error(`${logPrefix} S3 upload failed:`, uploadError);
    imageUrl = `data:image/png;base64,${compositionResult.finalImageBase64}`;
    console.log(`${logPrefix} Using base64 data URL fallback`);
  }

  // Save to database
  const databaseId = await savePreviewImageToDatabase({
    previewId,
    imageUrl,
    s3Key,
    input,
    geminiImagePrompt: scenePromptResult.data?.prompt || "",
    compositePrompt: compositePromptResult.data?.prompt,
    sceneImageUrl,
    sceneImageS3Key: sceneS3Key,
    s3Config,
  });

  return {
    success: true,
    preview_id: previewId,
    image_url: imageUrl,
    image_base64: compositionResult.finalImageBase64,
    gemini_image_prompt: scenePromptResult.data?.prompt || "",
    composite_prompt: compositePromptResult.data?.prompt || "",
    aspect_ratio,
    composition_mode: "two_step",
    scene_image_url: sceneImageUrl,
    scene_image_base64: compositionResult.sceneImageBase64,
    database_id: databaseId || undefined,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate preview image.
 * - Default: Direct mode (AWS Batch → Vertex AI Gemini 3 Pro Image)
 * - Two-step mode: Only if explicitly requested with composition_mode: "two_step"
 */
export async function generatePreviewImage(
  input: PreviewImageInput,
  s3Config: S3PathConfig,
  logPrefix: string = "[Preview Image]"
): Promise<PreviewImageResult> {
  const { composition_mode, product_image_url } = input;

  // Use direct mode by default, two-step only if explicitly requested
  const effectiveMode = composition_mode || "direct";

  console.log(`${logPrefix} Starting preview generation`);
  console.log(`${logPrefix} Video prompt: ${input.video_prompt.slice(0, 100)}...`);
  console.log(`${logPrefix} Image description: ${input.image_description.slice(0, 100)}...`);
  console.log(`${logPrefix} Composition mode: ${effectiveMode}`);

  // Two-step mode requires explicit request AND product_image_url
  if (effectiveMode === "two_step" && product_image_url) {
    return generateTwoStepPreviewImage(input, s3Config, logPrefix);
  }

  // Default: Direct mode via AWS Batch (Vertex AI Gemini 3 Pro Image)
  return generateDirectPreviewImage(input, s3Config, logPrefix);
}
