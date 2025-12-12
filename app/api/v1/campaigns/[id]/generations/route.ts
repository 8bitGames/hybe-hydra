import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { VideoGenerationStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
// AWS Batch AI client for video/image generation via Vertex AI
import {
  submitImageToVideo,
  submitVideoGeneration,
  getAIOutputSettings,
  type VideoGenerationSettings,
  type ImageToVideoSettings,
  type VideoAspectRatio,
  type AudioOverlaySettings,
} from "@/lib/batch/ai-client";
import { getPresignedUrlFromS3Url } from "@/lib/storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Submit video generation job to AWS Batch
 *
 * AWS Batch Flow:
 * 1. Submit job with parameters
 * 2. AWS Batch picks up job from queue
 * 3. Worker container runs with GCP WIF authentication
 * 4. Worker calls Vertex AI for image/video generation
 * 5. Worker uploads result to S3
 * 6. Worker calls /api/v1/ai/callback to update status
 *
 * This function returns immediately - status updates come via callback
 */
async function submitToAWSBatch(
  generationId: string,
  campaignId: string,
  params: {
    prompt: string;
    negativePrompt?: string;
    durationSeconds?: number;
    aspectRatio?: string;
    referenceImageUrl?: string;  // User's reference photo (REQUIRED for I2V)
    style?: string;
    audioUrl?: string;  // Audio URL for composition (optional)
    audioStartTime?: number;  // Start time in audio file (seconds)
    // MANDATORY I2V parameters
    imageDescription: string;  // How the image should be used in video (required)
    // Pre-generated preview image (from two-step workflow)
    previewImageBase64?: string;  // Skip image generation if provided (local uploads)
    previewImageUrl?: string;     // Skip image generation if provided (S3/external URLs)
  }
): Promise<{ success: boolean; batchJobId?: string; error?: string }> {
  try {
    // Update status to processing
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        status: "PROCESSING",
        progress: 5,
      },
    });

    // Get S3 output settings
    const s3Bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "hydra-assets-hybe";
    const outputSettings = getAIOutputSettings(generationId, "image_to_video", s3Bucket);

    // Map aspect ratio to Vertex AI format
    const aspectRatio = (params.aspectRatio as VideoAspectRatio) || "9:16";

    // Determine if we have a reference image (I2V mode)
    const hasReferenceImage = params.previewImageUrl || params.referenceImageUrl;

    console.log(`[Generation ${generationId}] ═══════════════════════════════════════════════════════`);
    console.log(`[Generation ${generationId}] Submitting to AWS Batch (Vertex AI via WIF)`);
    console.log(`[Generation ${generationId}] Mode: ${hasReferenceImage ? "I2V (Image-to-Video)" : "T2V (Text-to-Video)"}`);
    console.log(`[Generation ${generationId}] Output: s3://${outputSettings.s3_bucket}/${outputSettings.s3_key}`);

    let submitResult;

    // Build audio overlay settings if audio URL is provided
    const audioOverlaySettings: AudioOverlaySettings | undefined = params.audioUrl ? {
      audio_url: params.audioUrl,
      audio_start_time: params.audioStartTime || 0,
      audio_volume: 1.0,
      fade_in: 0.3,
      fade_out: 0.3,
      mix_original_audio: false,  // Replace original audio with new audio
      original_audio_volume: 0.3,
    } : undefined;

    if (hasReferenceImage) {
      // I2V Mode: Image-to-Video with reference image
      const i2vSettings: ImageToVideoSettings = {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        aspect_ratio: aspectRatio,
        duration_seconds: (params.durationSeconds || 8) as 4 | 6 | 8,
        person_generation: "allow_adult",
        generate_audio: !params.audioUrl,  // Don't generate AI audio if we have custom audio
        reference_image_url: params.previewImageUrl || params.referenceImageUrl || "",
        audio_overlay: audioOverlaySettings,  // Add audio overlay settings
      };

      console.log(`[Generation ${generationId}] I2V Settings:`, {
        prompt: i2vSettings.prompt.slice(0, 80) + "...",
        aspect_ratio: i2vSettings.aspect_ratio,
        duration: i2vSettings.duration_seconds,
        reference_image: i2vSettings.reference_image_url.slice(0, 60) + "...",
        audio_overlay: audioOverlaySettings ? "enabled" : "none",
      });

      submitResult = await submitImageToVideo(
        generationId,
        i2vSettings,
        outputSettings,
        {
          campaign_id: campaignId,
          image_description: params.imageDescription,
          style: params.style,
        }
      );
    } else {
      // T2V Mode: Text-to-Video without reference image
      const videoSettings: VideoGenerationSettings = {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        aspect_ratio: aspectRatio,
        duration_seconds: (params.durationSeconds || 8) as 4 | 6 | 8,
        person_generation: "allow_adult",
        generate_audio: !params.audioUrl,  // Don't generate AI audio if we have custom audio
        audio_overlay: audioOverlaySettings,  // Add audio overlay settings
      };

      console.log(`[Generation ${generationId}] T2V Settings:`, {
        prompt: videoSettings.prompt.slice(0, 80) + "...",
        aspect_ratio: videoSettings.aspect_ratio,
        duration: videoSettings.duration_seconds,
        audio_overlay: audioOverlaySettings ? "enabled" : "none",
      });

      submitResult = await submitVideoGeneration(
        generationId,
        videoSettings,
        outputSettings,
        {
          campaign_id: campaignId,
          image_description: params.imageDescription,
          style: params.style,
        }
      );
    }

    if (submitResult.status === "error") {
      console.error(`[Generation ${generationId}] AWS Batch submit failed:`, submitResult.error);
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "FAILED",
          progress: 100,
          errorMessage: submitResult.error || "Failed to submit to AWS Batch",
        },
      });
      return { success: false, error: submitResult.error };
    }

    // Update with batch job ID for tracking
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        progress: 10,
        vertexOperationName: submitResult.batch_job_id,  // Store batch job ID
        qualityMetadata: {
          batch_job_id: submitResult.batch_job_id,
          job_type: hasReferenceImage ? "image_to_video" : "video_generation",
          submitted_at: new Date().toISOString(),
          output_bucket: outputSettings.s3_bucket,
          output_key: outputSettings.s3_key,
        },
      },
    });

    console.log(`[Generation ${generationId}] ✓ AWS Batch job submitted: ${submitResult.batch_job_id}`);
    console.log(`[Generation ${generationId}] Status updates will come via /api/v1/ai/callback`);

    return { success: true, batchJobId: submitResult.batch_job_id };
  } catch (error) {
    console.error(`[Generation ${generationId}] Error submitting to AWS Batch:`, error);
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        status: "FAILED",
        progress: 100,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
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

    // Build where clause - exclude soft-deleted records
    const where: Record<string, unknown> = { campaignId, deletedAt: null };
    if (status) {
      where.status = status.toUpperCase() as VideoGenerationStatus;
    }
    if (generationType) {
      where.generationType = generationType;
      // Ensure AI filter excludes compose videos (which may have wrong default generationType)
      // Ensure COMPOSE filter only includes compose videos
      if (generationType === 'AI') {
        where.id = { not: { startsWith: 'compose-' } };
      } else if (generationType === 'COMPOSE') {
        where.id = { startsWith: 'compose-' };
      }
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

    // Generate presigned URLs for video playback
    const items = await Promise.all(generations.map(async (gen) => {
      // Get presigned URLs for S3-stored videos
      const outputUrl = gen.outputUrl
        ? await getPresignedUrlFromS3Url(gen.outputUrl)
        : null;
      const composedOutputUrl = gen.composedOutputUrl
        ? await getPresignedUrlFromS3Url(gen.composedOutputUrl)
        : null;

      return {
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
        composed_output_url: composedOutputUrl,
        status: gen.status.toLowerCase(),
        progress: gen.progress,
        error_message: gen.errorMessage,
        vertex_operation_name: gen.vertexOperationName,
        vertex_request_id: gen.vertexRequestId,
        output_asset_id: gen.outputAssetId,
        output_url: outputUrl,
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
      };
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
      duration_seconds = 8,
      aspect_ratio = "16:9",
      reference_image_id,
      reference_style,
      audio_asset_id,  // Required: audio track for composition
      audio_start_time = 0,  // Start time in audio file (seconds)
      // I2V parameters - MANDATORY: image generation happens before video
      image_description,  // string: how the image should look/be used in video
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

    // MANDATORY: Reference image is required for I2V generation
    // User must provide either a reference_image_id (campaign asset) or preview image
    const hasReferenceImage = reference_image_id || preview_image_base64 || preview_image_url;
    if (!hasReferenceImage) {
      return NextResponse.json(
        { detail: "Reference image is required. Please provide a reference_image_id, preview_image_base64, or preview_image_url for I2V generation." },
        { status: 400 }
      );
    }

    // Validate audio asset (optional - if provided, must exist and be audio type)
    let audioAsset = null;
    if (audio_asset_id) {
      audioAsset = await prisma.asset.findUnique({
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
        audioStartTime: audio_start_time,  // Start time in audio file (seconds)
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

    // MANDATORY I2V MODE: Always generate image first, then video
    // Determine the reference image source
    let referenceImageUrl: string | undefined;

    if (reference_image_id) {
      // Get URL from campaign asset and generate fresh presigned URL
      const refAsset = await prisma.asset.findUnique({ where: { id: reference_image_id } });
      if (refAsset?.s3Url) {
        try {
          // Generate presigned URL with 48 hour expiration for AWS Batch
          referenceImageUrl = await getPresignedUrlFromS3Url(refAsset.s3Url, 172800);
          console.log(`[Generation] I2V mode: Using campaign asset ${reference_image_id}`);
          console.log(`[Generation] Generated presigned reference image URL`);
        } catch (error) {
          console.error(`[Generation] Failed to generate reference image presigned URL:`, error);
          referenceImageUrl = refAsset.s3Url;  // Fallback to original URL
        }
      }
    }

    // Submit to AWS Batch for video generation via Vertex AI
    console.log(`[Generation] Submitting to AWS Batch (Vertex AI) with params:`, {
      hasPreviewBase64: !!preview_image_base64,
      hasPreviewUrl: !!preview_image_url,
      hasReferenceImageId: !!reference_image_id,
      hasImageDescription: !!image_description,
    });

    // Generate fresh presigned URLs for all S3 assets (48 hour expiry for AWS Batch queue wait time)
    // This is CRITICAL: stored s3Urls may be expired or inaccessible to the worker

    // Presign audio URL if provided
    let audioPresignedUrl: string | undefined;
    if (audioAsset?.s3Url) {
      try {
        audioPresignedUrl = await getPresignedUrlFromS3Url(audioAsset.s3Url, 172800);
        console.log(`[Generation] Generated fresh audio presigned URL for: ${audioAsset.originalFilename || audioAsset.filename}`);
      } catch (error) {
        console.error(`[Generation] Failed to generate audio presigned URL:`, error);
      }
    }

    // Presign preview_image_url if it's an S3 URL
    let presignedPreviewImageUrl: string | undefined;
    if (preview_image_url && preview_image_url.includes('.s3.') && preview_image_url.includes('amazonaws.com')) {
      try {
        presignedPreviewImageUrl = await getPresignedUrlFromS3Url(preview_image_url, 172800);
        console.log(`[Generation] Generated presigned preview image URL`);
      } catch (error) {
        console.error(`[Generation] Failed to generate preview image presigned URL:`, error);
        presignedPreviewImageUrl = preview_image_url;  // Fallback to original
      }
    } else {
      presignedPreviewImageUrl = preview_image_url;  // Non-S3 URL, use as-is
    }

    // Note: AWS Batch handles the entire I2V flow:
    // 1. Download reference image
    // 2. Call Vertex AI Veo 3.1 for video generation
    // 3. Apply audio overlay (if audioUrl provided)
    // 4. Upload result to S3
    // 5. Callback to /api/v1/ai/callback with status
    submitToAWSBatch(generation.id, campaignId, {
      prompt,
      negativePrompt: negative_prompt,
      durationSeconds: duration_seconds,
      aspectRatio: aspect_ratio,
      referenceImageUrl,
      style: reference_style,
      audioUrl: audioPresignedUrl,  // Use fresh presigned URL instead of potentially expired s3Url
      audioStartTime: audio_start_time,  // Start time in audio file (seconds)
      // I2V is MANDATORY - always generate image first
      imageDescription: image_description || prompt,  // Use prompt as fallback description
      // Pre-generated preview image (skip AI image generation step if provided)
      previewImageBase64: preview_image_base64,
      previewImageUrl: presignedPreviewImageUrl || referenceImageUrl,  // Use presigned URLs for S3 access
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
        message: "Video generation submitted to AWS Batch (Vertex AI via WIF)",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
