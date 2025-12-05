import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { generateVideo, VeoGenerationParams, getVeoConfig } from "@/lib/veo";
import { generateImage, convertAspectRatioForImagen } from "@/lib/imagen";
import { generateImagePromptForI2V, generateVideoPromptForI2V } from "@/lib/gemini-prompt";

// Async video generation handler for Quick Create (no audio composition)
async function startQuickVideoGeneration(
  generationId: string,
  params: {
    prompt: string;
    negativePrompt?: string;
    durationSeconds?: number;
    aspectRatio?: string;
    style?: string;
    enableI2V?: boolean;
    imageDescription?: string;
  }
) {
  // Don't await - let it run in background
  (async () => {
    try {
      // Update status to processing
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "PROCESSING",
          progress: 5,
        },
      });

      // Step 1: I2V Mode - Generate image first using Gemini-optimized prompts
      let generatedImageBase64: string | undefined;
      let geminiVideoPrompt: string | undefined;

      if (params.enableI2V && params.imageDescription) {
        console.log(`[QuickCreate ${generationId}] I2V mode enabled - Starting Gemini prompt generation...`);

        // Step 1a: Use Gemini to generate optimized image prompt
        const imagePromptResult = await generateImagePromptForI2V({
          videoPrompt: params.prompt,
          imageDescription: params.imageDescription,
          style: params.style,
          aspectRatio: params.aspectRatio,
        });

        if (imagePromptResult.success && imagePromptResult.imagePrompt) {
          const geminiImagePrompt = imagePromptResult.imagePrompt;
          console.log(`[QuickCreate ${generationId}] Gemini image prompt: ${geminiImagePrompt.slice(0, 150)}...`);

          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: { progress: 20 },
          });

          // Step 1b: Generate image with Imagen using Gemini's prompt
          try {
            const imageResult = await generateImage({
              prompt: geminiImagePrompt,
              negativePrompt: params.negativePrompt,
              aspectRatio: convertAspectRatioForImagen(params.aspectRatio || "16:9"),
              style: params.style,
            });

            if (imageResult.success && imageResult.imageBase64) {
              generatedImageBase64 = imageResult.imageBase64;
              console.log(`[QuickCreate ${generationId}] Image generated successfully!`);

              await prisma.videoGeneration.update({
                where: { id: generationId },
                data: { progress: 35 },
              });

              // Step 1c: Use Gemini to generate video prompt with animation instructions
              const videoPromptResult = await generateVideoPromptForI2V(
                {
                  videoPrompt: params.prompt,
                  imageDescription: params.imageDescription,
                  style: params.style,
                  aspectRatio: params.aspectRatio,
                },
                geminiImagePrompt
              );

              if (videoPromptResult.success && videoPromptResult.videoPrompt) {
                geminiVideoPrompt = videoPromptResult.videoPrompt;
                console.log(`[QuickCreate ${generationId}] Gemini video prompt: ${geminiVideoPrompt.slice(0, 150)}...`);
              }

              await prisma.videoGeneration.update({
                where: { id: generationId },
                data: { progress: 40 },
              });
            } else {
              console.warn(`[QuickCreate ${generationId}] Image generation failed, falling back to T2V`);
            }
          } catch (imagenError) {
            console.error(`[QuickCreate ${generationId}] Imagen error:`, imagenError);
          }
        }
      }

      // Step 2: Generate video with VEO
      console.log(`[QuickCreate ${generationId}] Generating video with VEO...`);

      let finalVideoPrompt = params.prompt;
      if (generatedImageBase64 && geminiVideoPrompt) {
        finalVideoPrompt = geminiVideoPrompt;
        console.log(`[QuickCreate ${generationId}] Using Gemini-generated video prompt`);
      }

      // Get VEO configuration (3-tier: production, fast, sample)
      const veoConfig = getVeoConfig();
      console.log(`[QuickCreate ${generationId}] VEO mode: ${veoConfig.mode} (${veoConfig.description})`);

      const veoParams: VeoGenerationParams = {
        prompt: finalVideoPrompt,
        negativePrompt: params.negativePrompt,
        durationSeconds: params.durationSeconds || 8,
        aspectRatio: (params.aspectRatio as "16:9" | "9:16" | "1:1") || "16:9",
        referenceImageBase64: generatedImageBase64,
        style: params.style,
        model: veoConfig.model,
      };

      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 50 },
      });

      let result;
      try {
        // For Quick Create, we use a special "quick-create" folder in S3
        result = await generateVideo(veoParams, "quick-create");
      } catch (veoError) {
        console.error(`[QuickCreate ${generationId}] VEO API error:`, veoError);
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: `VEO API error: ${veoError instanceof Error ? veoError.message : "Unknown error"}`,
          },
        });
        return;
      }

      if (!result.success || !result.videoUrl) {
        console.error(`[QuickCreate ${generationId}] VEO returned failure:`, result.error);
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: result.error || "Video generation failed",
          },
        });
        return;
      }

      console.log(`[QuickCreate ${generationId}] VEO succeeded, video URL: ${result.videoUrl}`);

      // Success - Quick Create doesn't require audio composition
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "COMPLETED",
          progress: 100,
          outputUrl: result.videoUrl,
          qualityMetadata: result.metadata as object,
        },
      });

      console.log(`[QuickCreate ${generationId}] Complete!`);
    } catch (error) {
      console.error("Quick Create generation error:", error);
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "FAILED",
          progress: 100,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  })();
}

// GET - List user's quick create generations
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");

    // Get only Quick Create generations for this user
    const where = {
      isQuickCreate: true,
      createdBy: user.id,
    };

    const total = await prisma.videoGeneration.count({ where });

    const generations = await prisma.videoGeneration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const pages = Math.ceil(total / pageSize) || 1;

    const items = generations.map((gen) => ({
      id: gen.id,
      campaign_id: gen.campaignId,
      is_quick_create: gen.isQuickCreate,
      prompt: gen.prompt,
      negative_prompt: gen.negativePrompt,
      duration_seconds: gen.durationSeconds,
      aspect_ratio: gen.aspectRatio,
      reference_style: gen.referenceStyle,
      status: gen.status.toLowerCase(),
      progress: gen.progress,
      error_message: gen.errorMessage,
      output_url: gen.outputUrl,
      quality_score: gen.qualityScore,
      quality_metadata: gen.qualityMetadata,
      is_favorite: gen.isFavorite,
      tags: gen.tags,
      created_by: gen.createdBy,
      created_at: gen.createdAt.toISOString(),
      updated_at: gen.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      pages,
    });
  } catch (error) {
    console.error("Get quick create generations error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new Quick Create generation
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      negative_prompt,
      duration_seconds = 8,
      aspect_ratio = "9:16",
      reference_style,
      enable_i2v,
      image_description,
    } = body;

    if (!prompt) {
      return NextResponse.json({ detail: "Prompt is required" }, { status: 400 });
    }

    // Create Quick Create generation record (no campaign)
    const generation = await prisma.videoGeneration.create({
      data: {
        campaignId: null,  // No campaign for Quick Create
        isQuickCreate: true,
        prompt,
        negativePrompt: negative_prompt || null,
        durationSeconds: duration_seconds,
        aspectRatio: aspect_ratio,
        referenceStyle: reference_style || null,
        status: "PENDING",
        progress: 0,
        createdBy: user.id,
        vertexRequestId: uuidv4(),
      },
    });

    // Start async video generation (without audio composition)
    startQuickVideoGeneration(generation.id, {
      prompt,
      negativePrompt: negative_prompt,
      durationSeconds: duration_seconds,
      aspectRatio: aspect_ratio,
      style: reference_style,
      enableI2V: enable_i2v,
      imageDescription: image_description,
    });

    return NextResponse.json(
      {
        id: generation.id,
        is_quick_create: generation.isQuickCreate,
        prompt: generation.prompt,
        negative_prompt: generation.negativePrompt,
        duration_seconds: generation.durationSeconds,
        aspect_ratio: generation.aspectRatio,
        reference_style: generation.referenceStyle,
        status: generation.status.toLowerCase(),
        progress: generation.progress,
        vertex_request_id: generation.vertexRequestId,
        created_by: generation.createdBy,
        created_at: generation.createdAt.toISOString(),
        message: "Quick Create video generation started (no audio)",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create quick generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
