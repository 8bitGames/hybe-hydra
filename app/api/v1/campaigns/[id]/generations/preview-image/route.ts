import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { generatePreviewImage, PreviewImageInput } from "@/lib/preview-image";

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
      product_image_url,
      composition_mode,
      hand_pose = "elegantly holding",
    } = body;

    if (!video_prompt) {
      return NextResponse.json({ detail: "video_prompt is required" }, { status: 400 });
    }

    if (!image_description) {
      return NextResponse.json({ detail: "image_description is required" }, { status: 400 });
    }

    console.log(`[Preview Image] Starting preview generation for campaign ${campaignId}`);

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
      { type: "campaign", id: campaignId, userId: user.id },
      "[Preview Image]"
    );

    if (!result.success) {
      console.error(`[Preview Image] Generation failed: ${result.error}`);
      return NextResponse.json(
        { detail: result.error || "Preview image generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      preview_id: result.preview_id,
      database_id: result.database_id,
      image_url: result.image_url,
      image_base64: result.image_base64,
      gemini_image_prompt: result.gemini_image_prompt,
      aspect_ratio: result.aspect_ratio,
      composition_mode: result.composition_mode,
      // Two-step mode fields
      scene_image_url: result.scene_image_url,
      scene_image_base64: result.scene_image_base64,
      composite_prompt: result.composite_prompt,
      message:
        result.composition_mode === "two_step"
          ? "Preview image generated with two-step composition"
          : "Preview image generated successfully",
    });
  } catch (error) {
    console.error("Preview image generation error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
