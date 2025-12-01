import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { composeVideoWithAudio, checkFFmpeg } from "@/lib/ffmpeg";
import { uploadToS3, generateS3Key } from "@/lib/storage";
import fs from "fs/promises";

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

    // Check if FFmpeg is available
    const ffmpegAvailable = await checkFFmpeg();
    if (!ffmpegAvailable) {
      return NextResponse.json(
        { detail: "FFmpeg is not available on this server" },
        { status: 503 }
      );
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

    // Compose video with audio
    console.log("Starting video composition...");
    const result = await composeVideoWithAudio({
      videoUrl: generation.outputUrl,
      audioUrl: audioAsset.s3Url,
      audioStartTime: audio_start_time,
      audioVolume: audio_volume,
      fadeIn: fade_in,
      fadeOut: fade_out,
      mixOriginalAudio: mix_original_audio,
      originalAudioVolume: original_audio_volume,
    });

    if (!result.success || !result.outputPath) {
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

    // Upload composed video to S3
    console.log("Uploading composed video to S3...");
    const outputBuffer = await fs.readFile(result.outputPath);
    const s3Folder = generation.campaignId || `quick-create/${user.id}`;
    const composedKey = generateS3Key(s3Folder, `composed_${generationId}.mp4`);
    const composedUrl = await uploadToS3(outputBuffer, composedKey, "video/mp4");

    // Clean up temp file
    try {
      await fs.unlink(result.outputPath);
    } catch (e) {
      console.warn("Failed to clean up temp file:", e);
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

    // Check if FFmpeg is available
    const ffmpegAvailable = await checkFFmpeg();

    return NextResponse.json({
      id: generation.id,
      has_output_video: !!generation.outputUrl,
      is_composed: !!composition,
      ffmpeg_available: ffmpegAvailable,
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
          }
        : null,
    });
  } catch (error) {
    console.error("Get compose info error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
