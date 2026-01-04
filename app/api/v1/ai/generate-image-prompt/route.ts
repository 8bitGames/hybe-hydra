import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createI2VSpecialistAgent } from "@/lib/agents/transformers/i2v-specialist";
import type { AgentContext } from "@/lib/agents/types";

/**
 * POST /api/v1/ai/generate-image-prompt
 *
 * Generates an image prompt from a video prompt using the I2V Specialist Agent.
 * This is used to preview the image prompt before generating the actual image.
 *
 * Request body:
 * - video_prompt: Main scene description (Veo3 prompt)
 * - image_description?: Additional context about the image
 * - style?: Optional style modifier
 * - aspect_ratio?: Video aspect ratio (9:16, 16:9, 1:1)
 *
 * Response:
 * - image_prompt: The generated image prompt for the first frame
 * - style_notes: Key style elements to maintain
 * - consistency_markers: Elements that must remain consistent
 */
export async function POST(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      video_prompt,
      image_description = "",
      style,
      aspect_ratio = "9:16",
    } = body;

    if (!video_prompt) {
      return NextResponse.json({ detail: "video_prompt is required" }, { status: 400 });
    }

    console.log(`[Image Prompt] Generating image prompt for user ${user.id}`);
    console.log(`[Image Prompt] Video prompt: ${video_prompt.slice(0, 100)}...`);

    // Create I2V Specialist Agent
    const i2vAgent = createI2VSpecialistAgent();
    const agentContext: AgentContext = {
      workflow: {
        artistName: "Brand",
        platform: "tiktok",
        language: "ko",
        sessionId: `prompt-${Date.now()}`,
      },
    };

    // Generate image prompt from video prompt
    const fullDescription = image_description
      ? `${video_prompt}. ${image_description}`
      : video_prompt;

    const result = await i2vAgent.generateImagePrompt(
      fullDescription,
      agentContext,
      { style }
    );

    if (!result.success || !result.data?.prompt) {
      console.error(`[Image Prompt] Generation failed: ${result.error}`);
      return NextResponse.json(
        { detail: result.error || "Image prompt generation failed" },
        { status: 500 }
      );
    }

    console.log(`[Image Prompt] Generated: ${result.data.prompt.slice(0, 100)}...`);

    return NextResponse.json({
      success: true,
      image_prompt: result.data.prompt,
      style_notes: result.data.styleNotes,
      technical_specs: result.data.technicalSpecs,
      consistency_markers: result.data.consistencyMarkers,
    });
  } catch (error) {
    console.error("Image prompt generation error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
