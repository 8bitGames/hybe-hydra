import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getUserFromHeader } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || "http://15.164.236.53:8000";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Subtitle line type
interface SubtitleLine {
  text: string;
  start: number;
  end: number;
}

// Subtitle style type
interface SubtitleStyle {
  font_size?: string;
  font_style?: string;
  color?: string;
  stroke_color?: string;
  stroke_width?: number;
  animation?: string;
  position?: string;
  bottom_margin?: number;
}

// Audio settings type
interface AudioSettings {
  asset_id: string;
  start_time?: number;
  volume?: number;
  fade_in?: number;
  fade_out?: number;
}

// Subtitle settings type
interface SubtitleSettings {
  lines: SubtitleLine[];
  style?: SubtitleStyle;
}

// Request body type
interface VideoEditRequestBody {
  audio?: AudioSettings;
  subtitles?: SubtitleSettings;
}

// POST /api/v1/generations/[id]/edit - Edit video with audio and/or subtitles
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;

    // Get the original generation
    const originalGeneration = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    });

    if (!originalGeneration) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check access
    if (user.role !== "ADMIN") {
      if (originalGeneration.campaign) {
        if (!user.labelIds.includes(originalGeneration.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (originalGeneration.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Check if original has output video (could be in outputUrl or composedOutputUrl)
    const sourceVideoUrl = originalGeneration.outputUrl || originalGeneration.composedOutputUrl;
    if (!sourceVideoUrl) {
      return NextResponse.json(
        { detail: "Original generation does not have an output video" },
        { status: 400 }
      );
    }

    const body: VideoEditRequestBody = await request.json();
    const { audio, subtitles } = body;

    // Validate at least one edit option is provided
    if (!audio && !subtitles) {
      return NextResponse.json(
        { detail: "At least one of audio or subtitles must be provided" },
        { status: 400 }
      );
    }

    // If audio is provided, get the audio asset URL
    let audioUrl: string | undefined;
    let audioAsset = null;
    if (audio?.asset_id) {
      audioAsset = await prisma.asset.findUnique({
        where: { id: audio.asset_id },
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

      audioUrl = audioAsset.s3Url;
    }

    // Create new generation (copy from original)
    const newJobId = uuidv4();
    const newGeneration = await prisma.videoGeneration.create({
      data: {
        campaignId: originalGeneration.campaignId,
        projectId: originalGeneration.projectId,
        isQuickCreate: originalGeneration.isQuickCreate,
        generationType: originalGeneration.generationType,
        prompt: originalGeneration.prompt,
        negativePrompt: originalGeneration.negativePrompt,
        durationSeconds: originalGeneration.durationSeconds,
        aspectRatio: originalGeneration.aspectRatio,
        referenceImageId: originalGeneration.referenceImageId,
        referenceStyle: originalGeneration.referenceStyle,
        status: "PROCESSING",
        progress: 0,
        // Copy audio info if editing audio
        audioAssetId: audio?.asset_id || originalGeneration.audioAssetId,
        audioAnalysis: originalGeneration.audioAnalysis as Prisma.InputJsonValue | undefined,
        audioStartTime: audio?.start_time ?? originalGeneration.audioStartTime,
        audioDuration: originalGeneration.audioDuration,
        // Copy compose-specific fields
        scriptData: originalGeneration.scriptData as Prisma.InputJsonValue | undefined,
        imageAssets: originalGeneration.imageAssets as Prisma.InputJsonValue | undefined,
        effectPreset: originalGeneration.effectPreset,
        // Copy bridge context
        originalInput: originalGeneration.originalInput,
        trendKeywords: originalGeneration.trendKeywords,
        referenceUrls: originalGeneration.referenceUrls as Prisma.InputJsonValue | undefined,
        promptAnalysis: originalGeneration.promptAnalysis as Prisma.InputJsonValue | undefined,
        isFavorite: false, // New generation starts unfavorited
        tags: [...originalGeneration.tags, "edited"],
        tiktokSEO: originalGeneration.tiktokSEO as Prisma.InputJsonValue | undefined,
        createdBy: user.id,
        qualityMetadata: {
          ...(originalGeneration.qualityMetadata as Record<string, unknown> || {}),
          videoEdit: {
            originalGenerationId: originalGeneration.id,
            originalOutputUrl: sourceVideoUrl,
            editedAt: new Date().toISOString(),
            editType: [audio ? "audio" : null, subtitles ? "subtitles" : null].filter(Boolean),
            audioAssetId: audio?.asset_id,
            audioAssetName: audioAsset?.filename,
            hasSubtitles: !!subtitles,
            subtitleLineCount: subtitles?.lines?.length || 0,
          },
        },
      },
    });

    // Build callback URL (consistent with ai-client.ts fallback)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hydra.ai.kr";
    const callbackUrl = `${baseUrl}/api/v1/jobs/callback`;

    // Build request for compose engine
    const editRequest = {
      job_id: newJobId,
      video_url: sourceVideoUrl,
      callback_url: callbackUrl,
      campaign_id: originalGeneration.campaignId,
      // Include metadata for callback to properly identify the generation
      metadata: {
        generation_id: newGeneration.id,
        original_generation_id: originalGeneration.id,
        user_id: user.id,
      },
      ...(audio && audioUrl && {
        audio: {
          url: audioUrl,
          start_time: audio.start_time ?? 0,
          volume: audio.volume ?? 1.0,
          fade_in: audio.fade_in ?? 1.0,
          fade_out: audio.fade_out ?? 2.0,
        },
      }),
      ...(subtitles && {
        subtitles: {
          lines: subtitles.lines,
          style: subtitles.style || {},
        },
      }),
    };

    // Store job ID in generation metadata for callback matching
    await prisma.videoGeneration.update({
      where: { id: newGeneration.id },
      data: {
        vertexRequestId: newJobId, // Reuse this field for job tracking
        qualityMetadata: {
          ...(newGeneration.qualityMetadata as Record<string, unknown> || {}),
          videoEditJobId: newJobId,
        },
      },
    });

    // Send request to compose engine
    console.log(`[VideoEdit] Sending edit request to compose engine for generation ${newGeneration.id}`);

    const response = await fetch(`${COMPOSE_ENGINE_URL}/api/v1/video/edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(editRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VideoEdit] Compose engine error: ${errorText}`);

      // Update generation status to failed
      await prisma.videoGeneration.update({
        where: { id: newGeneration.id },
        data: {
          status: "FAILED",
          errorMessage: `Failed to submit edit job: ${response.status} ${response.statusText}`,
        },
      });

      return NextResponse.json(
        { detail: `Failed to submit edit job: ${errorText}` },
        { status: 500 }
      );
    }

    const result = await response.json();
    console.log(`[VideoEdit] Edit job submitted successfully: ${result.job_id}`);

    // Update progress
    await prisma.videoGeneration.update({
      where: { id: newGeneration.id },
      data: {
        progress: 10,
      },
    });

    return NextResponse.json({
      id: newGeneration.id,
      job_id: newJobId,
      original_generation_id: originalGeneration.id,
      status: "processing",
      message: "Video edit job submitted successfully",
      edit_options: {
        has_audio: !!audio,
        has_subtitles: !!subtitles,
        audio_asset_name: audioAsset?.filename,
        subtitle_line_count: subtitles?.lines?.length || 0,
      },
    });
  } catch (error) {
    console.error("[VideoEdit] Error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/generations/[id]/edit - Get edit status/info
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
        audioAsset: true,
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check access
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    const metadata = generation.qualityMetadata as Record<string, unknown> | null;
    const videoEdit = metadata?.videoEdit as Record<string, unknown> | null;

    return NextResponse.json({
      id: generation.id,
      has_output_video: !!generation.outputUrl,
      output_url: generation.outputUrl,
      is_edited: !!videoEdit,
      status: generation.status.toLowerCase(),
      progress: generation.progress,
      error_message: generation.errorMessage,
      audio_asset: generation.audioAsset ? {
        id: generation.audioAsset.id,
        filename: generation.audioAsset.filename,
        original_filename: generation.audioAsset.originalFilename,
      } : null,
      video_edit: videoEdit ? {
        original_generation_id: videoEdit.originalGenerationId,
        original_output_url: videoEdit.originalOutputUrl,
        edited_at: videoEdit.editedAt,
        edit_type: videoEdit.editType,
        audio_asset_id: videoEdit.audioAssetId,
        audio_asset_name: videoEdit.audioAssetName,
        has_subtitles: videoEdit.hasSubtitles,
        subtitle_line_count: videoEdit.subtitleLineCount,
      } : null,
    });
  } catch (error) {
    console.error("[VideoEdit] Get info error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
