import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { generateImage, convertAspectRatioForImagen } from "@/lib/imagen";
import { generateImagePromptForI2V } from "@/lib/gemini-prompt";
import { uploadToS3 } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/v1/ai/generate-preview-image
 *
 * Generates a preview image for I2V (Image-to-Video) workflow.
 * This endpoint doesn't require a campaign ID - can be used from /create page.
 *
 * Request body:
 * - video_prompt: Main scene description (Veo3 prompt)
 * - image_description: Product/object focus description (from image analysis)
 * - aspect_ratio: Video aspect ratio (9:16, 16:9, 1:1)
 * - style?: Optional style modifier
 * - negative_prompt?: What to avoid
 * - product_image_url?: URL of the product image to include
 *
 * Response:
 * - preview_id: Unique ID for this preview
 * - image_url: URL of the generated preview image
 * - image_base64: Base64 encoded image for I2V
 * - gemini_image_prompt: The optimized prompt used for generation
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      video_prompt,
      image_description,
      aspect_ratio = "9:16",
      style,
      negative_prompt,
      product_image_url,
    } = body;

    if (!video_prompt) {
      return NextResponse.json({ detail: "video_prompt is required" }, { status: 400 });
    }

    if (!image_description) {
      return NextResponse.json({ detail: "image_description is required" }, { status: 400 });
    }

    console.log(`[Preview Image AI] Starting preview generation for user ${user.id}`);
    console.log(`[Preview Image AI] Video prompt: ${video_prompt.slice(0, 100)}...`);
    console.log(`[Preview Image AI] Image description: ${image_description.slice(0, 100)}...`);

    const previewId = uuidv4();

    // Step 1: Generate image prompt using Gemini
    console.log(`[Preview Image AI] Step 1: Generating image prompt with Gemini...`);
    const imagePromptResult = await generateImagePromptForI2V({
      videoPrompt: video_prompt,
      imageDescription: image_description,
      style,
      aspectRatio: aspect_ratio,
    });

    if (!imagePromptResult.success || !imagePromptResult.imagePrompt) {
      console.error(`[Preview Image AI] Gemini image prompt failed: ${imagePromptResult.error}`);
      return NextResponse.json(
        { detail: `Failed to generate image prompt: ${imagePromptResult.error}` },
        { status: 500 }
      );
    }

    const geminiImagePrompt = imagePromptResult.imagePrompt;
    console.log(`[Preview Image AI] Image prompt: ${geminiImagePrompt.slice(0, 150)}...`);

    // Step 2: Generate image with Imagen
    console.log(`[Preview Image AI] Step 2: Generating image with Imagen...`);
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
      console.error(`[Preview Image AI] Imagen generation threw exception:`, imagenError);
      return NextResponse.json(
        { detail: `Image generation failed: ${imagenError instanceof Error ? imagenError.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    if (!imageResult.success || !imageResult.imageBase64) {
      console.error(`[Preview Image AI] Imagen generation returned failure: ${imageResult.error}`);
      return NextResponse.json(
        { detail: `Image generation failed: ${imageResult.error}` },
        { status: 500 }
      );
    }

    console.log(`[Preview Image AI] Image generated successfully!`);

    // Step 3: Upload to S3 (general user folder)
    const filename = `preview-${previewId}.png`;
    let imageUrl: string;

    try {
      const imageBuffer = Buffer.from(imageResult.imageBase64, "base64");
      const s3Key = `users/${user.id}/previews/${filename}`;
      imageUrl = await uploadToS3(imageBuffer, s3Key, "image/png");
      console.log(`[Preview Image AI] Uploaded to S3: ${imageUrl}`);
    } catch (uploadError) {
      console.error(`[Preview Image AI] S3 upload failed:`, uploadError);
      // Fallback: return base64 data URL
      imageUrl = `data:image/png;base64,${imageResult.imageBase64}`;
      console.log(`[Preview Image AI] Using base64 data URL fallback`);
    }

    return NextResponse.json({
      success: true,
      preview_id: previewId,
      image_url: imageUrl,
      image_base64: imageResult.imageBase64,
      gemini_image_prompt: geminiImagePrompt,
      aspect_ratio,
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
