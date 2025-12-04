import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { VideoGenerationStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { generateVideo, VeoGenerationParams } from "@/lib/veo";
import { analyzeAudio } from "@/lib/audio-analyzer";
// Use Modal for audio composition (GPU-accelerated, works in serverless)
import { composeVideoWithAudioModal, type AudioComposeRequest } from "@/lib/modal/client";
import { generateS3Key } from "@/lib/storage";
import { generateImage, convertAspectRatioForImagen } from "@/lib/imagen";
import { generateImagePromptForI2V, generateVideoPromptForI2V } from "@/lib/gemini-prompt";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Async video generation handler (runs in background)
async function startVideoGeneration(
  generationId: string,
  campaignId: string,
  params: {
    prompt: string;
    negativePrompt?: string;
    durationSeconds?: number;
    aspectRatio?: string;
    referenceImageUrl?: string;
    style?: string;
    audioUrl: string;  // Audio URL for composition
    // New I2V parameters
    enableI2V?: boolean;  // Enable AI image generation first
    imageDescription?: string;  // How the image should be used in video
    // Pre-generated preview image (from two-step workflow)
    previewImageBase64?: string;  // Skip image generation if provided (local uploads)
    previewImageUrl?: string;     // Skip image generation if provided (S3/external URLs)
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

      // Step 1: Analyze audio first (for better UX, do this early)
      console.log(`[Generation ${generationId}] Analyzing audio...`);
      let audioAnalysis;
      try {
        audioAnalysis = await analyzeAudio(params.audioUrl);
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            progress: 10,
            audioAnalysis: audioAnalysis as object,
          },
        });
      } catch (audioError) {
        console.warn(`[Generation ${generationId}] Audio analysis failed, continuing with defaults:`, audioError);
      }

      // Step 2: I2V Mode - Generate image first using Gemini-optimized prompts
      let generatedImageBase64: string | undefined;
      let geminiVideoPrompt: string | undefined;  // Will hold VEO-optimized prompt with animation instructions

      if (params.enableI2V && params.imageDescription) {
        // Check if we have a pre-generated preview image (two-step workflow)
        // Priority: base64 > URL > generate new
        if (params.previewImageBase64 || params.previewImageUrl) {
          console.log(`[Generation ${generationId}] I2V mode with user-provided image - skipping AI image generation`);

          // Use base64 directly, or fetch URL and convert to base64
          if (params.previewImageBase64) {
            console.log(`[Generation ${generationId}] Using pre-uploaded base64 image`);
            generatedImageBase64 = params.previewImageBase64;
          } else if (params.previewImageUrl) {
            console.log(`[Generation ${generationId}] Fetching image from URL: ${params.previewImageUrl.slice(0, 80)}...`);
            try {
              const imageResponse = await fetch(params.previewImageUrl);
              if (imageResponse.ok) {
                const arrayBuffer = await imageResponse.arrayBuffer();
                generatedImageBase64 = Buffer.from(arrayBuffer).toString("base64");
                console.log(`[Generation ${generationId}] Image fetched and converted: ${Math.round(arrayBuffer.byteLength / 1024)}KB`);
              } else {
                console.error(`[Generation ${generationId}] Failed to fetch image: ${imageResponse.status}`);
              }
            } catch (fetchError) {
              console.error(`[Generation ${generationId}] Error fetching image URL:`, fetchError);
            }
          }

          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: { progress: 25 },
          });

          // Still generate video prompt with animation instructions
          console.log(`[Generation ${generationId}] Generating video prompt with animation instructions...`);
          const videoPromptResult = await generateVideoPromptForI2V(
            {
              videoPrompt: params.prompt,
              imageDescription: params.imageDescription,
              style: params.style,
              aspectRatio: params.aspectRatio,
            },
            params.imageDescription  // Use image description as context
          );

          if (videoPromptResult.success && videoPromptResult.videoPrompt) {
            geminiVideoPrompt = videoPromptResult.videoPrompt;
            console.log(`[Generation ${generationId}] Gemini video prompt: ${geminiVideoPrompt.slice(0, 150)}...`);
          } else {
            console.warn(`[Generation ${generationId}] Gemini video prompt failed: ${videoPromptResult.error}`);
            console.log(`[Generation ${generationId}] Using original prompt for video generation...`);
          }

          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: { progress: 30 },
          });
        } else {
          // No preview image - generate new image with Gemini + Imagen
          console.log(`[Generation ${generationId}] I2V mode enabled - Starting Gemini prompt generation...`);

          // Step 2a: Use Gemini to generate optimized image prompt
          console.log(`[Generation ${generationId}] Step 2a: Generating image prompt with Gemini...`);
          const imagePromptResult = await generateImagePromptForI2V({
            videoPrompt: params.prompt,
            imageDescription: params.imageDescription,
            style: params.style,
            aspectRatio: params.aspectRatio,
          });

          if (!imagePromptResult.success || !imagePromptResult.imagePrompt) {
            console.warn(`[Generation ${generationId}] Gemini image prompt failed: ${imagePromptResult.error}`);
            console.log(`[Generation ${generationId}] Falling back to T2V mode...`);
          } else {
            const geminiImagePrompt = imagePromptResult.imagePrompt;
            console.log(`[Generation ${generationId}] Gemini image prompt: ${geminiImagePrompt.slice(0, 150)}...`);

            await prisma.videoGeneration.update({
              where: { id: generationId },
              data: { progress: 15 },
            });

            // Step 2b: Generate image with Imagen using Gemini's prompt
            console.log(`[Generation ${generationId}] Step 2b: Generating image with Imagen...`);
            let imageResult;
            try {
              imageResult = await generateImage({
                prompt: geminiImagePrompt,
                negativePrompt: params.negativePrompt,
                aspectRatio: convertAspectRatioForImagen(params.aspectRatio || "16:9"),
                style: params.style,
              });
            } catch (imagenError) {
              console.error(`[Generation ${generationId}] Imagen threw exception:`, imagenError);
              imageResult = { success: false, error: imagenError instanceof Error ? imagenError.message : "Unknown error" };
            }

            if (imageResult.success && imageResult.imageBase64) {
              generatedImageBase64 = imageResult.imageBase64;
              console.log(`[Generation ${generationId}] Image generated successfully!`);

              await prisma.videoGeneration.update({
                where: { id: generationId },
                data: { progress: 25 },
              });

              // Step 2c: Use Gemini to generate video prompt WITH animation instructions
              console.log(`[Generation ${generationId}] Step 2c: Generating video prompt with animation instructions...`);
              const videoPromptResult = await generateVideoPromptForI2V(
                {
                  videoPrompt: params.prompt,
                  imageDescription: params.imageDescription,
                  style: params.style,
                  aspectRatio: params.aspectRatio,
                },
                geminiImagePrompt  // Pass the image prompt as context
              );

              if (videoPromptResult.success && videoPromptResult.videoPrompt) {
                geminiVideoPrompt = videoPromptResult.videoPrompt;
                console.log(`[Generation ${generationId}] Gemini video prompt: ${geminiVideoPrompt.slice(0, 150)}...`);
              } else {
                console.warn(`[Generation ${generationId}] Gemini video prompt failed: ${videoPromptResult.error}`);
                console.log(`[Generation ${generationId}] Using original prompt for video generation...`);
              }

              await prisma.videoGeneration.update({
                where: { id: generationId },
                data: { progress: 30 },
              });
            } else {
              console.warn(`[Generation ${generationId}] Image generation failed: ${imageResult.error}`);
              console.log(`[Generation ${generationId}] Falling back to T2V mode...`);
            }
          }
        }
      }

      // Step 3: Generate video with VEO
      console.log(`[Generation ${generationId}] ═══════════════════════════════════════════════════════`);
      console.log(`[Generation ${generationId}] Step 3: Generating video with VEO...`);

      // Determine generation mode and prompt to use
      let finalVideoPrompt = params.prompt;  // Default to original prompt

      // Determine image source for logging
      const imageSource = params.previewImageBase64 ? "USER_UPLOAD_BASE64" :
                         params.previewImageUrl ? "CAMPAIGN_URL" :
                         generatedImageBase64 ? "AI_GENERATED" : "NONE";

      console.log(`[Generation ${generationId}] Image source: ${imageSource}`);
      console.log(`[Generation ${generationId}] Has image for I2V: ${!!generatedImageBase64}`);

      if (generatedImageBase64) {
        console.log(`[Generation ${generationId}] ✓ I2V mode - Image ready (${Math.round(generatedImageBase64.length / 1024)}KB)`);
        // Use Gemini's video prompt if available (includes animation instructions)
        if (geminiVideoPrompt) {
          finalVideoPrompt = geminiVideoPrompt;
          console.log(`[Generation ${generationId}] ✓ Using Gemini-generated video prompt with animation instructions`);
        }
      } else if (params.referenceImageUrl) {
        console.log(`[Generation ${generationId}] I2V mode with existing reference image: ${params.referenceImageUrl.slice(0, 80)}...`);
      } else {
        console.log(`[Generation ${generationId}] T2V mode (text only - no image provided)`);
      }

      const veoParams: VeoGenerationParams = {
        prompt: finalVideoPrompt,  // Use Gemini's prompt if I2V mode, otherwise original
        negativePrompt: params.negativePrompt,
        durationSeconds: params.durationSeconds || 5,
        aspectRatio: (params.aspectRatio as "16:9" | "9:16" | "1:1") || "16:9",
        // Use AI-generated image if available, otherwise use existing reference image
        referenceImageBase64: generatedImageBase64,
        referenceImageUrl: generatedImageBase64 ? undefined : params.referenceImageUrl,
        style: params.style,
      };

      const currentProgress = generatedImageBase64 ? 40 : 20;
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: currentProgress },
      });

      console.log(`[Generation ${generationId}] Calling VEO API (progress: ${currentProgress}%)...`);

      let result;
      try {
        result = await generateVideo(veoParams, campaignId);
      } catch (veoError) {
        console.error(`[Generation ${generationId}] VEO API threw exception:`, veoError);
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
        console.error(`[Generation ${generationId}] VEO returned failure:`, result.error);
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

      console.log(`[Generation ${generationId}] VEO succeeded, video URL: ${result.videoUrl}`);

      // Update with raw video URL
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          progress: 70,
          outputUrl: result.videoUrl,
          qualityMetadata: result.metadata as object,
        },
      });

      // Step 3: Compose video with audio using Modal (GPU-accelerated)
      console.log(`[Generation ${generationId}] Composing video with audio via Modal...`);

      const s3Bucket = process.env.S3_BUCKET || "hydra-media";
      const s3Key = generateS3Key(campaignId, "composed_video.mp4");

      const composeRequest: AudioComposeRequest = {
        job_id: uuidv4(),
        video_url: result.videoUrl,
        audio_url: params.audioUrl,
        audio_start_time: audioAnalysis?.best_15s_start || 0,
        audio_volume: 1.0,
        fade_in: 0.5,
        fade_out: 1.0,
        mix_original_audio: false,
        output_s3_bucket: s3Bucket,
        output_s3_key: s3Key,
      };

      console.log(`[Generation ${generationId}] Modal compose request:`, {
        video_url: result.videoUrl.slice(0, 60) + "...",
        audio_start_time: composeRequest.audio_start_time,
        output_key: s3Key,
      });

      const composeResult = await composeVideoWithAudioModal({
        ...composeRequest,
        pollInterval: 3000,  // Poll every 3 seconds
        maxWaitTime: 300000, // Max 5 minutes
        onProgress: (status) => {
          console.log(`[Generation ${generationId}] Modal compose status: ${status.status}`);
        },
      });

      if (composeResult.status === "completed" && composeResult.output_url) {
        // Success - update with composed video URL
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "COMPLETED",
            progress: 100,
            composedOutputUrl: composeResult.output_url,
            audioStartTime: audioAnalysis?.best_15s_start || 0,
            audioDuration: 15,
          },
        });
        console.log(`[Generation ${generationId}] Complete with audio! URL: ${composeResult.output_url.slice(0, 60)}...`);
      } else {
        // Composition failed, but video succeeded - mark as completed with warning
        console.warn(`[Generation ${generationId}] Audio composition failed:`, composeResult.error);
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "COMPLETED",
            progress: 100,
            errorMessage: `Video generated but audio composition failed: ${composeResult.error}`,
          },
        });
      }
    } catch (error) {
      console.error("Video generation error:", error);
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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const status = searchParams.get("status") as VideoGenerationStatus | null;
    const generationType = searchParams.get("generation_type") as "AI" | "COMPOSE" | null;

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

    // Build where clause
    const where: Record<string, unknown> = { campaignId };
    if (status) {
      where.status = status.toUpperCase() as VideoGenerationStatus;
    }
    if (generationType) {
      where.generationType = generationType;
    }

    const total = await prisma.videoGeneration.count({ where });

    const generations = await prisma.videoGeneration.findMany({
      where,
      include: {
        referenceImage: {
          select: { id: true, filename: true, s3Url: true },
        },
        outputAsset: {
          select: { id: true, filename: true, s3Url: true },
        },
        audioAsset: {
          select: { id: true, filename: true, s3Url: true, originalFilename: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const pages = Math.ceil(total / pageSize) || 1;

    const items = generations.map((gen) => ({
      id: gen.id,
      campaign_id: gen.campaignId,
      prompt: gen.prompt,
      negative_prompt: gen.negativePrompt,
      duration_seconds: gen.durationSeconds,
      aspect_ratio: gen.aspectRatio,
      reference_image_id: gen.referenceImageId,
      reference_style: gen.referenceStyle,
      // Audio fields
      audio_asset_id: gen.audioAssetId,
      audio_analysis: gen.audioAnalysis,
      audio_start_time: gen.audioStartTime,
      audio_duration: gen.audioDuration,
      composed_output_url: gen.composedOutputUrl,
      status: gen.status.toLowerCase(),
      progress: gen.progress,
      error_message: gen.errorMessage,
      vertex_operation_name: gen.vertexOperationName,
      vertex_request_id: gen.vertexRequestId,
      output_asset_id: gen.outputAssetId,
      output_url: gen.outputUrl,
      quality_score: gen.qualityScore,
      quality_metadata: gen.qualityMetadata,
      // Bridge context fields
      original_input: gen.originalInput,
      trend_keywords: gen.trendKeywords,
      reference_urls: gen.referenceUrls,
      prompt_analysis: gen.promptAnalysis,
      is_favorite: gen.isFavorite,
      tags: gen.tags,
      created_by: gen.createdBy,
      created_at: gen.createdAt.toISOString(),
      updated_at: gen.updatedAt.toISOString(),
      generation_type: gen.generationType,
      reference_image: gen.referenceImage
        ? {
            id: gen.referenceImage.id,
            filename: gen.referenceImage.filename,
            s3_url: gen.referenceImage.s3Url,
          }
        : null,
      output_asset: gen.outputAsset
        ? {
            id: gen.outputAsset.id,
            filename: gen.outputAsset.filename,
            s3_url: gen.outputAsset.s3Url,
          }
        : null,
      audio_asset: gen.audioAsset
        ? {
            id: gen.audioAsset.id,
            filename: gen.audioAsset.filename,
            original_filename: gen.audioAsset.originalFilename,
            s3_url: gen.audioAsset.s3Url,
          }
        : null,
    }));

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      pages,
    });
  } catch (error) {
    console.error("Get generations error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

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
      prompt,
      negative_prompt,
      duration_seconds = 5,
      aspect_ratio = "16:9",
      reference_image_id,
      reference_style,
      audio_asset_id,  // Required: audio track for composition
      // I2V parameters - generate image first, then video
      enable_i2v,  // boolean: enable AI image generation first
      image_description,  // string: how the image should look/be used
      // Preview image (pre-generated from two-step workflow)
      preview_image_base64,  // string: base64 encoded image to skip regeneration
      preview_image_url,  // string: URL of pre-generated image
      // Bridge context fields
      original_input,
      trend_keywords,
      reference_urls,
      prompt_analysis,
    } = body;

    if (!prompt) {
      return NextResponse.json({ detail: "Prompt is required" }, { status: 400 });
    }

    // Validate audio asset (required)
    if (!audio_asset_id) {
      return NextResponse.json(
        { detail: "Audio asset is required. Please select a music track." },
        { status: 400 }
      );
    }

    const audioAsset = await prisma.asset.findUnique({
      where: { id: audio_asset_id },
    });

    if (!audioAsset) {
      return NextResponse.json(
        { detail: "Audio asset not found" },
        { status: 400 }
      );
    }

    if (audioAsset.type !== "AUDIO") {
      return NextResponse.json(
        { detail: "Selected asset is not an audio file" },
        { status: 400 }
      );
    }

    // Validate reference image if provided
    if (reference_image_id) {
      const refImage = await prisma.asset.findUnique({
        where: { id: reference_image_id },
      });

      if (!refImage || refImage.campaignId !== campaignId) {
        return NextResponse.json(
          { detail: "Reference image not found or not in this campaign" },
          { status: 400 }
        );
      }
    }

    // Create generation record
    const generation = await prisma.videoGeneration.create({
      data: {
        campaignId,
        prompt,
        negativePrompt: negative_prompt || null,
        durationSeconds: duration_seconds,
        aspectRatio: aspect_ratio,
        referenceImageId: reference_image_id || null,
        referenceStyle: reference_style || null,
        audioAssetId: audio_asset_id,  // Required audio track
        status: "PENDING",
        progress: 0,
        createdBy: user.id,
        vertexRequestId: uuidv4(),
        // Bridge context fields
        originalInput: original_input || null,
        trendKeywords: trend_keywords || [],
        referenceUrls: reference_urls || null,
        promptAnalysis: prompt_analysis || null,
      },
      include: {
        referenceImage: {
          select: { id: true, filename: true, s3Url: true },
        },
        audioAsset: {
          select: { id: true, filename: true, s3Url: true, originalFilename: true },
        },
      },
    });

    // Determine generation mode
    let referenceImageUrl: string | undefined;

    if (enable_i2v && image_description) {
      // I2V mode with AI-generated image
      console.log(`[Generation] I2V mode: Will generate image first`);
      console.log(`[Generation] Image description: ${image_description}`);
    } else if (reference_image_id) {
      // I2V mode with existing image
      const refAsset = await prisma.asset.findUnique({ where: { id: reference_image_id } });
      referenceImageUrl = refAsset?.s3Url;
      console.log(`[Generation] I2V mode: Using existing image ${reference_image_id}`);
      console.log(`[Generation] Reference image URL: ${referenceImageUrl}`);
    } else {
      console.log(`[Generation] T2V mode: Text-only generation`);
    }

    // Start async video generation
    console.log(`[Generation] Starting video generation with params:`, {
      hasPreviewBase64: !!preview_image_base64,
      hasPreviewUrl: !!preview_image_url,
      enableI2V: enable_i2v,
      hasImageDescription: !!image_description,
    });

    startVideoGeneration(generation.id, campaignId, {
      prompt,
      negativePrompt: negative_prompt,
      durationSeconds: duration_seconds,
      aspectRatio: aspect_ratio,
      referenceImageUrl,
      style: reference_style,
      audioUrl: audioAsset.s3Url,
      // I2V parameters
      enableI2V: enable_i2v,
      imageDescription: image_description,
      // Pre-generated preview image (skip image generation step)
      previewImageBase64: preview_image_base64,
      previewImageUrl: preview_image_url,  // NEW: Pass URL for campaign assets
    });

    return NextResponse.json(
      {
        id: generation.id,
        campaign_id: generation.campaignId,
        prompt: generation.prompt,
        negative_prompt: generation.negativePrompt,
        duration_seconds: generation.durationSeconds,
        aspect_ratio: generation.aspectRatio,
        reference_image_id: generation.referenceImageId,
        reference_style: generation.referenceStyle,
        audio_asset_id: generation.audioAssetId,
        status: generation.status.toLowerCase(),
        progress: generation.progress,
        vertex_request_id: generation.vertexRequestId,
        // Bridge context fields
        original_input: generation.originalInput,
        trend_keywords: generation.trendKeywords,
        reference_urls: generation.referenceUrls,
        prompt_analysis: generation.promptAnalysis,
        is_favorite: generation.isFavorite,
        tags: generation.tags,
        created_by: generation.createdBy,
        created_at: generation.createdAt.toISOString(),
        reference_image: generation.referenceImage
          ? {
              id: generation.referenceImage.id,
              filename: generation.referenceImage.filename,
              s3_url: generation.referenceImage.s3Url,
            }
          : null,
        audio_asset: generation.audioAsset
          ? {
              id: generation.audioAsset.id,
              filename: generation.audioAsset.filename,
              original_filename: generation.audioAsset.originalFilename,
              s3_url: generation.audioAsset.s3Url,
            }
          : null,
        message: "Video generation started (with audio composition)",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
