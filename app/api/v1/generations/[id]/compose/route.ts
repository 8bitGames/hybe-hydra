import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { composeVideoWithAudio, checkFFmpeg } from "@/lib/ffmpeg";
import { uploadToS3, generateS3Key, getPresignedUrlFromS3Url } from "@/lib/storage";
import fs from "fs/promises";

// Use Modal for FFmpeg by default (production)
const USE_MODAL_FFMPEG = process.env.USE_MODAL_FFMPEG !== 'false';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/generations/[id]/compose - Compose video with audio
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;

    // Only check local FFmpeg if not using Modal
    if (!USE_MODAL_FFMPEG) {
      const ffmpegAvailable = await checkFFmpeg();
      if (!ffmpegAvailable) {
        return NextResponse.json(
          { detail: "FFmpeg is not available on this server" },
          { status: 503 }
        );
      }
    }

    // Get the generation
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check access - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Check if generation has output video
    if (!generation.outputUrl) {
      return NextResponse.json(
        { detail: "Generation does not have an output video yet" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      audio_asset_id,
      audio_start_time = 0,
      audio_volume = 1.0,
      fade_in = 0,
      fade_out = 0,
      mix_original_audio = false,
      original_audio_volume = 0.3,
    } = body;

    if (!audio_asset_id) {
      return NextResponse.json(
        { detail: "audio_asset_id is required" },
        { status: 400 }
      );
    }

    // Validate audio volume
    if (audio_volume < 0 || audio_volume > 1) {
      return NextResponse.json(
        { detail: "audio_volume must be between 0 and 1" },
        { status: 400 }
      );
    }

    // Get the audio asset
    const audioAsset = await prisma.asset.findUnique({
      where: { id: audio_asset_id },
    });

    if (!audioAsset) {
      return NextResponse.json({ detail: "Audio asset not found" }, { status: 404 });
    }

    if (audioAsset.type !== "AUDIO") {
      return NextResponse.json(
        { detail: "Asset is not an audio file" },
        { status: 400 }
      );
    }

    // Update generation status
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        status: "PROCESSING",
        progress: 10,
      },
    });

    // Generate S3 key for Modal mode
    const s3Folder = generation.campaignId || `quick-create/${user.id}`;
    const composedS3Key = `${s3Folder}/composed_${generationId}.mp4`;

    // Generate fresh presigned URL for audio (stored s3Url may be expired)
    let audioPresignedUrl: string;
    try {
      audioPresignedUrl = await getPresignedUrlFromS3Url(audioAsset.s3Url, 172800);
      console.log(`Generated fresh audio presigned URL for composition`);
    } catch (presignError) {
      console.error(`Failed to generate audio presigned URL:`, presignError);
      audioPresignedUrl = audioAsset.s3Url; // Fallback to original
    }

    // Compose video with audio (Modal or local based on USE_MODAL_FFMPEG)
    console.log(`Starting video composition (Modal: ${USE_MODAL_FFMPEG})...`);
    const result = await composeVideoWithAudio({
      videoUrl: generation.outputUrl,
      audioUrl: audioPresignedUrl,
      audioStartTime: audio_start_time,
      audioVolume: audio_volume,
      fadeIn: fade_in,
      fadeOut: fade_out,
      mixOriginalAudio: mix_original_audio,
      originalAudioVolume: original_audio_volume,
      // Modal-specific: S3 output location
      outputS3Bucket: process.env.AWS_S3_BUCKET || 'hydra-assets-hybe',
      outputS3Key: composedS3Key,
    });

    // Check for success - Modal returns outputUrl, local returns outputPath
    if (!result.success || (!result.outputUrl && !result.outputPath)) {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "FAILED",
          progress: 100,
          errorMessage: result.error || "Composition failed",
        },
      });

      return NextResponse.json(
        { detail: result.error || "Composition failed" },
        { status: 500 }
      );
    }

    let composedUrl: string;

    // Modal mode: outputUrl is already the S3 URL
    if (result.outputUrl) {
      composedUrl = result.outputUrl;
      console.log(`Composition complete (Modal): ${composedUrl}`);
    }
    // Local mode: need to upload outputPath to S3
    else if (result.outputPath) {
      console.log("Uploading composed video to S3 (local mode)...");
      const outputBuffer = await fs.readFile(result.outputPath);
      const composedKey = generateS3Key(s3Folder, `composed_${generationId}.mp4`);
      composedUrl = await uploadToS3(outputBuffer, composedKey, "video/mp4");

      // Clean up temp file
      try {
        await fs.unlink(result.outputPath);
      } catch (e) {
        console.warn("Failed to clean up temp file:", e);
      }
    } else {
      // Should never happen, but handle it
      throw new Error("No output URL or path returned from composition");
    }

    // Get existing metadata
    const existingMetadata = (generation.qualityMetadata as Record<string, unknown>) || {};

    // Update generation with composed video
    const updatedGeneration = await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        status: "COMPLETED",
        progress: 100,
        outputUrl: composedUrl,
        qualityMetadata: {
          ...existingMetadata,
          composition: {
            audioAssetId: audio_asset_id,
            audioAssetName: audioAsset.filename,
            audioStartTime: audio_start_time,
            audioVolume: audio_volume,
            fadeIn: fade_in,
            fadeOut: fade_out,
            mixedOriginalAudio: mix_original_audio,
            composedAt: new Date().toISOString(),
            originalVideoUrl: generation.outputUrl,
            processedBy: USE_MODAL_FFMPEG ? 'modal' : 'local',
          },
        },
      },
    });

    return NextResponse.json({
      id: updatedGeneration.id,
      status: "completed",
      output_url: composedUrl,
      original_video_url: generation.outputUrl,
      duration: result.duration,
      composition: {
        audio_asset_id,
        audio_start_time,
        audio_volume,
        fade_in,
        fade_out,
        mix_original_audio,
      },
      message: "Video composed with audio successfully",
    });
  } catch (error) {
    console.error("Compose error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/generations/[id]/compose - Get composition status/info
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;

    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check access - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const composition = metadata?.composition as Record<string, unknown> | null;

    // Check if FFmpeg is available (Modal is always available, local needs check)
    let ffmpegAvailable = true;
    if (!USE_MODAL_FFMPEG) {
      ffmpegAvailable = await checkFFmpeg();
    }

    return NextResponse.json({
      id: generation.id,
      has_output_video: !!generation.outputUrl,
      is_composed: !!composition,
      ffmpeg_available: ffmpegAvailable,
      processing_mode: USE_MODAL_FFMPEG ? 'modal' : 'local',
      composition: composition
        ? {
            audio_asset_id: composition.audioAssetId,
            audio_asset_name: composition.audioAssetName,
            audio_start_time: composition.audioStartTime,
            audio_volume: composition.audioVolume,
            fade_in: composition.fadeIn,
            fade_out: composition.fadeOut,
            mixed_original_audio: composition.mixedOriginalAudio,
            composed_at: composition.composedAt,
            original_video_url: composition.originalVideoUrl,
            processed_by: composition.processedBy,
          }
        : null,
    });
  } catch (error) {
    console.error("Get compose info error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
