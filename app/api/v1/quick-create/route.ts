import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { createI2VSpecialistAgent } from "@/lib/agents/transformers/i2v-specialist";
import type { AgentContext } from "@/lib/agents/types";
import {
  submitImageGeneration,
  submitImageToVideo,
  submitVideoGeneration,
  waitForAIJob,
  generateAIJobId,
  type ImageAspectRatio,
  type VideoAspectRatio,
  type VideoDuration,
} from "@/lib/ec2/ai-client";
// Note: AI generation now handled by EC2 compose-engine via submitImageGeneration, submitVideoGeneration, etc.

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "hydra-assets-hybe";

// Helper: Convert aspect ratio for image generation
function convertAspectRatioForImage(aspectRatio: string): ImageAspectRatio {
  const mapping: Record<string, ImageAspectRatio> = {
    "16:9": "16:9",
    "9:16": "9:16",
    "1:1": "1:1",
    "4:3": "4:3",
    "3:4": "3:4",
  };
  return mapping[aspectRatio] || "9:16";
}

// Helper: Convert aspect ratio for video generation
function convertAspectRatioForVideo(aspectRatio: string): VideoAspectRatio {
  const mapping: Record<string, VideoAspectRatio> = {
    "16:9": "16:9",
    "9:16": "9:16",
    "1:1": "1:1",
  };
  return mapping[aspectRatio] || "9:16";
}

// Helper: Convert duration for video generation
function convertDurationForEC2(durationSeconds: number): VideoDuration {
  if (durationSeconds <= 4) return 4;
  if (durationSeconds <= 6) return 6;
  return 8;
}

// Async video generation handler for Quick Create (no audio composition)
// Uses EC2 compose-engine for all AI generation (GPU with Vertex AI WIF auth)
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
    const logPrefix = `[QuickCreate ${generationId}]`;

    try {
      // Update status to processing
      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "PROCESSING",
          progress: 5,
        },
      }));

      // Step 1: I2V Mode - Generate image first using Gemini-optimized prompts
      let generatedImageUrl: string | undefined;
      let geminiVideoPrompt: string | undefined;

      if (params.enableI2V && params.imageDescription) {
        console.log(`${logPrefix} I2V mode enabled - Starting Gemini prompt generation...`);

        // Step 1a: Use I2V Specialist Agent to generate optimized image prompt
        const i2vAgent = createI2VSpecialistAgent();
        const agentContext: AgentContext = {
          workflow: {
            artistName: "Brand",
            platform: "tiktok",
            language: "ko",
            sessionId: `quick-create-${generationId}`,
          },
        };

        const imagePromptResult = await i2vAgent.generateImagePrompt(
          `${params.prompt}. ${params.imageDescription}`,
          agentContext,
          { style: params.style }
        );

        if (imagePromptResult.success && imagePromptResult.data?.prompt) {
          const geminiImagePrompt = imagePromptResult.data.prompt;
          console.log(`${logPrefix} Gemini image prompt: ${geminiImagePrompt.slice(0, 150)}...`);

          await withRetry(() => prisma.videoGeneration.update({
            where: { id: generationId },
            data: { progress: 20 },
          }));

          // Step 1b: Generate image via EC2 compose-engine
          try {
            const imageJobId = generateAIJobId("quickcreate-img");
            const s3Key = `quick-create/${generationId}/reference-image-${imageJobId}.png`;

            console.log(`${logPrefix} Submitting image generation to EC2: ${imageJobId}`);

            const imageSubmitResult = await submitImageGeneration(
              imageJobId,
              {
                prompt: geminiImagePrompt,
                negative_prompt: params.negativePrompt || "blurry, low quality, text, watermark, logo, distorted",
                aspect_ratio: convertAspectRatioForImage(params.aspectRatio || "16:9"),
                number_of_images: 1,
                safety_filter_level: "block_some",
                person_generation: "allow_adult",
              },
              {
                s3_bucket: AWS_S3_BUCKET,
                s3_key: s3Key,
              }
            );

            if (imageSubmitResult.status === "error") {
              console.warn(`${logPrefix} Image generation submit failed: ${imageSubmitResult.error}`);
            } else {
              // Poll for image completion
              const imageResult = await waitForAIJob(
                imageSubmitResult.ec2_job_id || imageSubmitResult.job_id,
                {
                  jobType: "image_generation",
                  maxWaitTime: 180000, // 3 minutes
                  pollInterval: 3000,
                }
              );

              if (imageResult.mappedStatus === "completed" && imageResult.output_url) {
                generatedImageUrl = imageResult.output_url;
                console.log(`${logPrefix} Image generated successfully! URL: ${generatedImageUrl.slice(0, 80)}...`);

                await withRetry(() => prisma.videoGeneration.update({
                  where: { id: generationId },
                  data: { progress: 35 },
                }));

                // Step 1c: Use I2V Specialist Agent to generate video prompt with animation instructions
                const videoPromptResult = await i2vAgent.generateVideoPrompt(
                  {
                    visual_style: params.style || "cinematic",
                    color_palette: [],
                    mood: "dynamic",
                    main_subject: params.imageDescription || params.prompt,
                  },
                  `${params.prompt}. ${params.imageDescription}`,
                  agentContext,
                  { duration: params.durationSeconds || 8, style: params.style }
                );

                if (videoPromptResult.success && videoPromptResult.data?.prompt) {
                  geminiVideoPrompt = videoPromptResult.data.prompt;
                  console.log(`${logPrefix} Gemini video prompt: ${geminiVideoPrompt.slice(0, 150)}...`);
                }

                await withRetry(() => prisma.videoGeneration.update({
                  where: { id: generationId },
                  data: { progress: 40 },
                }));
              } else {
                console.warn(`${logPrefix} Image generation failed: ${imageResult.error}, falling back to T2V`);
              }
            }
          } catch (imagenError) {
            console.error(`${logPrefix} Imagen error:`, imagenError);
          }
        }
      }

      // Step 2: Generate video via EC2 compose-engine
      console.log(`${logPrefix} Generating video via EC2...`);

      let finalVideoPrompt = params.prompt;
      if (generatedImageUrl && geminiVideoPrompt) {
        finalVideoPrompt = geminiVideoPrompt;
        console.log(`${logPrefix} Using Gemini-generated video prompt`);
      }

      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 50 },
      }));

      const videoJobId = generateAIJobId("quickcreate-vid");
      const videoS3Key = `quick-create/${generationId}/video-${videoJobId}.mp4`;

      console.log(`${logPrefix} Submitting video generation to EC2: ${videoJobId}`);

      let videoSubmitResult;
      try {
        if (generatedImageUrl) {
          // I2V mode: Use image-to-video endpoint
          console.log(`${logPrefix} Using I2V mode with reference image`);
          videoSubmitResult = await submitImageToVideo(
            videoJobId,
            {
              prompt: finalVideoPrompt,
              reference_image_url: generatedImageUrl,
              aspect_ratio: convertAspectRatioForVideo(params.aspectRatio || "16:9"),
              duration_seconds: convertDurationForEC2(params.durationSeconds || 8),
            },
            {
              s3_bucket: AWS_S3_BUCKET,
              s3_key: videoS3Key,
            }
          );
        } else {
          // T2V mode: Text-to-video endpoint
          console.log(`${logPrefix} Using T2V mode (no reference image)`);
          videoSubmitResult = await submitVideoGeneration(
            videoJobId,
            {
              prompt: finalVideoPrompt,
              negative_prompt: params.negativePrompt,
              aspect_ratio: convertAspectRatioForVideo(params.aspectRatio || "16:9"),
              duration_seconds: convertDurationForEC2(params.durationSeconds || 8),
            },
            {
              s3_bucket: AWS_S3_BUCKET,
              s3_key: videoS3Key,
            }
          );
        }
      } catch (submitError) {
        console.error(`${logPrefix} Video submit error:`, submitError);
        await withRetry(() => prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: `EC2 submit error: ${submitError instanceof Error ? submitError.message : "Unknown error"}`,
          },
        }));
        return;
      }

      if (videoSubmitResult.status === "error") {
        console.error(`${logPrefix} Video submit failed: ${videoSubmitResult.error}`);
        await withRetry(() => prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: `EC2 submit failed: ${videoSubmitResult.error}`,
          },
        }));
        return;
      }

      console.log(`${logPrefix} Video job queued: ${videoSubmitResult.ec2_job_id || videoSubmitResult.job_id}`);

      // Poll for video completion
      const videoResult = await waitForAIJob(
        videoSubmitResult.ec2_job_id || videoSubmitResult.job_id,
        {
          jobType: generatedImageUrl ? "image_to_video" : "video_generation",
          maxWaitTime: 600000, // 10 minutes for video
          pollInterval: 5000,
        }
      );

      if (videoResult.mappedStatus !== "completed" || !videoResult.output_url) {
        console.error(`${logPrefix} Video generation failed: ${videoResult.error}`);
        await withRetry(() => prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: videoResult.error || "Video generation failed",
          },
        }));
        return;
      }

      console.log(`${logPrefix} Video generated successfully! URL: ${videoResult.output_url.slice(0, 80)}...`);

      // Success - Quick Create doesn't require audio composition
      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "COMPLETED",
          progress: 100,
          outputUrl: videoResult.output_url,
          qualityMetadata: {
            ec2_job_id: videoSubmitResult.ec2_job_id || videoSubmitResult.job_id,
            mode: generatedImageUrl ? "i2v" : "t2v",
            reference_image_url: generatedImageUrl,
          },
        },
      }));

      console.log(`${logPrefix} Complete!`);
    } catch (error) {
      console.error("Quick Create generation error:", error);
      await withRetry(() => prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "FAILED",
          progress: 100,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      }));
    }
  })();
}

// GET - List user's quick create generations
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");

    // Get only Quick Create generations for this user (exclude soft-deleted)
    const where = {
      isQuickCreate: true,
      createdBy: user.id,
      deletedAt: null,
    };

    // Parallelize count and findMany queries
    const [total, generations] = await Promise.all([
      withRetry(() => prisma.videoGeneration.count({ where })),
      withRetry(() => prisma.videoGeneration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })),
    ]);

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
    const user = await getUserFromRequest(request);

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
    const generation = await withRetry(() => prisma.videoGeneration.create({
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
    }));

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
