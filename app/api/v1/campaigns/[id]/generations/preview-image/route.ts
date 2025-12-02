import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { generateImage, convertAspectRatioForImagen, generateTwoStepComposition } from "@/lib/imagen";
import { generateImagePromptForI2V, generateBackgroundPromptForEditing, generateSceneWithPlaceholderPrompt, generateCompositePrompt } from "@/lib/gemini-prompt";
import { uploadToS3 } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/campaigns/[id]/generations/preview-image
 *
 * Generates a preview image for I2V (Image-to-Video) workflow.
 * User can preview the generated image before proceeding to video generation.
 *
 * Request body:
 * - video_prompt: Main scene description
 * - image_description: Product/object focus description
 * - aspect_ratio: Video aspect ratio (9:16, 16:9, 1:1)
 * - style?: Optional style modifier
 * - negative_prompt?: What to avoid
 * - product_image_url?: URL of the product image to include in the generated scene
 * - composition_mode?: "direct" | "two_step" (default: "two_step" when product_image_url provided)
 *   - "direct": Edit existing product image background
 *   - "two_step": Generate scene with placeholder, then composite product into it
 * - hand_pose?: Description of how hands should hold the product (for two_step mode)
 *
 * Response:
 * - preview_id: Unique ID for this preview
 * - image_url: URL of the generated preview image
 * - scene_image_url?: URL of the scene image (two_step mode only)
 * - gemini_image_prompt: The optimized prompt used for generation
 * - composition_mode: The mode used for generation
 * - message: Status message
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Check campaign access
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: { select: { labelId: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const {
      video_prompt,
      image_description,
      aspect_ratio = "9:16",
      style,
      negative_prompt,
      product_image_url,  // URL of the product image to reference
      composition_mode,   // "direct" | "two_step" - defaults to "two_step" when product_image_url exists
      hand_pose = "elegantly holding",  // How hands should hold the product
    } = body;

    // Determine composition mode: default to "two_step" when product image is provided
    const effectiveCompositionMode = composition_mode || (product_image_url ? "two_step" : "direct");

    if (!video_prompt) {
      return NextResponse.json({ detail: "video_prompt is required" }, { status: 400 });
    }

    if (!image_description) {
      return NextResponse.json({ detail: "image_description is required" }, { status: 400 });
    }

    console.log(`[Preview Image] Starting preview generation for campaign ${campaignId}`);
    console.log(`[Preview Image] Video prompt: ${video_prompt.slice(0, 100)}...`);
    console.log(`[Preview Image] Image description: ${image_description.slice(0, 100)}...`);
    console.log(`[Preview Image] Composition mode: ${effectiveCompositionMode}`);
    if (product_image_url) {
      console.log(`[Preview Image] Product image URL provided: ${product_image_url.slice(0, 100)}...`);
    }

    const previewId = uuidv4();

    // ========== TWO-STEP COMPOSITION MODE ==========
    if (effectiveCompositionMode === "two_step" && product_image_url) {
      console.log(`[Preview Image] Using TWO-STEP composition mode`);

      // Step 1: Generate scene prompt with placeholder
      console.log(`[Preview Image] Step 1: Generating scene with placeholder prompt...`);
      const scenePromptResult = await generateSceneWithPlaceholderPrompt({
        sceneDescription: video_prompt,
        productDescription: image_description,
        handPose: hand_pose,
        style,
        aspectRatio: aspect_ratio,
      });

      if (!scenePromptResult.success || !scenePromptResult.imagePrompt) {
        console.error(`[Preview Image] Scene prompt generation failed: ${scenePromptResult.error}`);
        return NextResponse.json(
          { detail: `Failed to generate scene prompt: ${scenePromptResult.error}` },
          { status: 500 }
        );
      }

      // Step 2: Generate composite prompt
      console.log(`[Preview Image] Step 2: Generating composite instructions...`);
      const compositePromptResult = await generateCompositePrompt({
        sceneDescription: video_prompt,
        productDescription: image_description,
        placementHint: `Hands ${hand_pose} the product`,
      });

      if (!compositePromptResult.success || !compositePromptResult.imagePrompt) {
        console.error(`[Preview Image] Composite prompt generation failed: ${compositePromptResult.error}`);
        return NextResponse.json(
          { detail: `Failed to generate composite prompt: ${compositePromptResult.error}` },
          { status: 500 }
        );
      }

      // Step 3: Execute two-step composition
      console.log(`[Preview Image] Step 3: Executing two-step composition...`);
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
        console.error(`[Preview Image] Two-step composition threw exception:`, compositionError);
        return NextResponse.json(
          { detail: `Composition failed: ${compositionError instanceof Error ? compositionError.message : "Unknown error"}` },
          { status: 500 }
        );
      }

      if (!compositionResult.success || !compositionResult.finalImageBase64) {
        console.error(`[Preview Image] Two-step composition failed: ${compositionResult.error}`);
        return NextResponse.json(
          { detail: `Composition failed: ${compositionResult.error}` },
          { status: 500 }
        );
      }

      console.log(`[Preview Image] Two-step composition completed successfully!`);

      // Upload final image to S3
      let imageUrl: string;
      let sceneImageUrl: string | undefined;

      try {
        // Upload final composited image
        const imageBuffer = Buffer.from(compositionResult.finalImageBase64, "base64");
        const s3Key = `campaigns/${campaignId}/previews/preview-${previewId}.png`;
        imageUrl = await uploadToS3(imageBuffer, s3Key, "image/png");
        console.log(`[Preview Image] Final image uploaded to S3: ${imageUrl}`);

        // Optionally upload scene image for debugging/reference
        if (compositionResult.sceneImageBase64) {
          const sceneBuffer = Buffer.from(compositionResult.sceneImageBase64, "base64");
          const sceneS3Key = `campaigns/${campaignId}/previews/scene-${previewId}.png`;
          sceneImageUrl = await uploadToS3(sceneBuffer, sceneS3Key, "image/png");
          console.log(`[Preview Image] Scene image uploaded to S3: ${sceneImageUrl}`);
        }
      } catch (uploadError) {
        console.error(`[Preview Image] S3 upload failed:`, uploadError);
        imageUrl = `data:image/png;base64,${compositionResult.finalImageBase64}`;
        console.log(`[Preview Image] Using base64 data URL fallback`);
      }

      return NextResponse.json({
        preview_id: previewId,
        image_url: imageUrl,
        scene_image_url: sceneImageUrl,
        image_base64: compositionResult.finalImageBase64,
        scene_image_base64: compositionResult.sceneImageBase64,  // Also return scene image for debugging
        gemini_image_prompt: scenePromptResult.imagePrompt,
        composite_prompt: compositePromptResult.imagePrompt,
        aspect_ratio,
        composition_mode: "two_step",
        message: "Preview image generated with two-step composition",
      });
    }

    // ========== DIRECT MODE (original approach) ==========
    console.log(`[Preview Image] Using DIRECT mode`);

    // Step 1: Generate appropriate prompt based on whether we have a reference image
    let geminiImagePrompt: string;

    if (product_image_url) {
      // Reference image provided → generate BACKGROUND-ONLY prompt (product will be preserved)
      console.log(`[Preview Image] Step 1: Generating BACKGROUND-ONLY prompt (reference image mode)...`);
      const backgroundPromptResult = await generateBackgroundPromptForEditing({
        sceneDescription: video_prompt,
        productUsage: image_description,
        style,
        aspectRatio: aspect_ratio,
      });

      if (!backgroundPromptResult.success || !backgroundPromptResult.imagePrompt) {
        console.error(`[Preview Image] Background prompt generation failed: ${backgroundPromptResult.error}`);
        return NextResponse.json(
          { detail: `Failed to generate background prompt: ${backgroundPromptResult.error}` },
          { status: 500 }
        );
      }

      geminiImagePrompt = backgroundPromptResult.imagePrompt;
      console.log(`[Preview Image] Background-only prompt: ${geminiImagePrompt.slice(0, 150)}...`);
    } else {
      // No reference image → generate full prompt with product description
      console.log(`[Preview Image] Step 1: Generating full image prompt (no reference image)...`);
      const imagePromptResult = await generateImagePromptForI2V({
        videoPrompt: video_prompt,
        imageDescription: image_description,
        style,
        aspectRatio: aspect_ratio,
      });

      if (!imagePromptResult.success || !imagePromptResult.imagePrompt) {
        console.error(`[Preview Image] Gemini image prompt failed: ${imagePromptResult.error}`);
        return NextResponse.json(
          { detail: `Failed to generate image prompt: ${imagePromptResult.error}` },
          { status: 500 }
        );
      }

      geminiImagePrompt = imagePromptResult.imagePrompt;
      console.log(`[Preview Image] Full image prompt: ${geminiImagePrompt.slice(0, 150)}...`);
    }

    // Step 2: Generate image with Gemini using optimized prompt + reference image
    console.log(`[Preview Image] Step 2: Generating image with Gemini...`);
    let imageResult;
    try {
      imageResult = await generateImage({
        prompt: geminiImagePrompt,
        negativePrompt: negative_prompt,
        aspectRatio: convertAspectRatioForImagen(aspect_ratio),
        style,
        referenceImageUrl: product_image_url,  // Pass the product image for reference
      });
    } catch (imagenError) {
      console.error(`[Preview Image] Gemini image generation threw exception:`, imagenError);
      return NextResponse.json(
        { detail: `Image generation failed: ${imagenError instanceof Error ? imagenError.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    if (!imageResult.success || !imageResult.imageBase64) {
      console.error(`[Preview Image] Gemini image generation returned failure: ${imageResult.error}`);
      return NextResponse.json(
        { detail: `Image generation failed: ${imageResult.error}` },
        { status: 500 }
      );
    }

    console.log(`[Preview Image] Image generated successfully!`);

    // Step 3: Upload the image to S3 for preview
    const filename = `preview-${previewId}.png`;

    let imageUrl: string;
    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageResult.imageBase64, "base64");

      // Upload to S3
      const s3Key = `campaigns/${campaignId}/previews/${filename}`;
      imageUrl = await uploadToS3(imageBuffer, s3Key, "image/png");
      console.log(`[Preview Image] Uploaded to S3: ${imageUrl}`);
    } catch (uploadError) {
      console.error(`[Preview Image] S3 upload failed:`, uploadError);
      // Fallback: return base64 data URL
      imageUrl = `data:image/png;base64,${imageResult.imageBase64}`;
      console.log(`[Preview Image] Using base64 data URL fallback`);
    }

    // Store preview metadata in database for later use
    // We'll use a simple JSON field in campaign or create a separate table
    // For now, we'll return the data and let the frontend manage it

    return NextResponse.json({
      preview_id: previewId,
      image_url: imageUrl,
      image_base64: imageResult.imageBase64,  // Also return base64 for I2V
      gemini_image_prompt: geminiImagePrompt,
      aspect_ratio,
      composition_mode: "direct",
      message: "Preview image generated successfully",
    });

  } catch (error) {
    console.error("Preview image generation error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
