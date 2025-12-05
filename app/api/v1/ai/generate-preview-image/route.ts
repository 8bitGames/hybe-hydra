import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { generatePreviewImage, PreviewImageInput } from "@/lib/preview-image";

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
 * - composition_mode?: "direct" | "two_step" (default: "two_step" when product_image_url provided)
 * - hand_pose?: Description of how hands should hold the product (for two_step mode)
 *
 * Response:
 * - preview_id: Unique ID for this preview
 * - image_url: URL of the generated preview image
 * - image_base64: Base64 encoded image for I2V
 * - gemini_image_prompt: The optimized prompt used for generation
 * - composition_mode: The mode used for generation
 * - scene_image_url?: URL of the scene image (two_step mode only)
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
      composition_mode,
      hand_pose,
    } = body;

    if (!video_prompt) {
      return NextResponse.json({ detail: "video_prompt is required" }, { status: 400 });
    }

    if (!image_description) {
      return NextResponse.json({ detail: "image_description is required" }, { status: 400 });
    }

    console.log(`[Preview Image AI] Starting preview generation for user ${user.id}`);

    const input: PreviewImageInput = {
      video_prompt,
      image_description,
      aspect_ratio,
      style,
      negative_prompt,
      product_image_url,
      composition_mode,
      hand_pose,
    };

    const result = await generatePreviewImage(
      input,
      { type: "user", id: user.id },
      "[Preview Image AI]"
    );

    if (!result.success) {
      console.error(`[Preview Image AI] Generation failed: ${result.error}`);
      return NextResponse.json(
        { detail: result.error || "Preview image generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preview_id: result.preview_id,
      image_url: result.image_url,
      image_base64: result.image_base64,
      gemini_image_prompt: result.gemini_image_prompt,
      aspect_ratio: result.aspect_ratio,
      composition_mode: result.composition_mode,
      // Two-step mode fields
      scene_image_url: result.scene_image_url,
      scene_image_base64: result.scene_image_base64,
      composite_prompt: result.composite_prompt,
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
