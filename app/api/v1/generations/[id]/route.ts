import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { VideoGenerationStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const generation = await prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
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
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check - Quick Create generations (no campaign) are accessible by their creator
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({
      id: generation.id,
      campaign_id: generation.campaignId,
      prompt: generation.prompt,
      negative_prompt: generation.negativePrompt,
      duration_seconds: generation.durationSeconds,
      aspect_ratio: generation.aspectRatio,
      reference_image_id: generation.referenceImageId,
      reference_style: generation.referenceStyle,
      // Audio fields
      audio_asset_id: generation.audioAssetId,
      audio_analysis: generation.audioAnalysis,
      audio_start_time: generation.audioStartTime,
      audio_duration: generation.audioDuration,
      composed_output_url: generation.composedOutputUrl,
      status: generation.status.toLowerCase(),
      progress: generation.progress,
      error_message: generation.errorMessage,
      vertex_operation_name: generation.vertexOperationName,
      vertex_request_id: generation.vertexRequestId,
      output_asset_id: generation.outputAssetId,
      output_url: generation.outputUrl,
      quality_score: generation.qualityScore,
      quality_metadata: generation.qualityMetadata,
      // Bridge context fields
      original_input: generation.originalInput,
      trend_keywords: generation.trendKeywords,
      reference_urls: generation.referenceUrls,
      prompt_analysis: generation.promptAnalysis,
      is_favorite: generation.isFavorite,
      tags: generation.tags,
      created_by: generation.createdBy,
      created_at: generation.createdAt.toISOString(),
      updated_at: generation.updatedAt.toISOString(),
      reference_image: generation.referenceImage
        ? {
            id: generation.referenceImage.id,
            filename: generation.referenceImage.filename,
            s3_url: generation.referenceImage.s3Url,
          }
        : null,
      output_asset: generation.outputAsset
        ? {
            id: generation.outputAsset.id,
            filename: generation.outputAsset.filename,
            s3_url: generation.outputAsset.s3Url,
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
    });
  } catch (error) {
    console.error("Get generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const existingGeneration = await prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    });

    if (!existingGeneration) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (existingGeneration.campaign) {
        if (!user.labelIds.includes(existingGeneration.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (existingGeneration.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { status, progress, error_message, output_url, quality_score, quality_metadata } = body;

    const generation = await prisma.videoGeneration.update({
      where: { id },
      data: {
        ...(status && { status: status.toUpperCase() as VideoGenerationStatus }),
        ...(progress !== undefined && { progress }),
        ...(error_message !== undefined && { errorMessage: error_message }),
        ...(output_url && { outputUrl: output_url }),
        ...(quality_score !== undefined && { qualityScore: quality_score }),
        ...(quality_metadata && { qualityMetadata: quality_metadata }),
      },
      include: {
        referenceImage: {
          select: { id: true, filename: true, s3Url: true },
        },
        outputAsset: {
          select: { id: true, filename: true, s3Url: true },
        },
      },
    });

    return NextResponse.json({
      id: generation.id,
      campaign_id: generation.campaignId,
      prompt: generation.prompt,
      negative_prompt: generation.negativePrompt,
      duration_seconds: generation.durationSeconds,
      aspect_ratio: generation.aspectRatio,
      reference_image_id: generation.referenceImageId,
      reference_style: generation.referenceStyle,
      status: generation.status.toLowerCase(),
      progress: generation.progress,
      error_message: generation.errorMessage,
      vertex_operation_name: generation.vertexOperationName,
      vertex_request_id: generation.vertexRequestId,
      output_asset_id: generation.outputAssetId,
      output_url: generation.outputUrl,
      quality_score: generation.qualityScore,
      quality_metadata: generation.qualityMetadata,
      created_by: generation.createdBy,
      created_at: generation.createdAt.toISOString(),
      updated_at: generation.updatedAt.toISOString(),
      reference_image: generation.referenceImage
        ? {
            id: generation.referenceImage.id,
            filename: generation.referenceImage.filename,
            s3_url: generation.referenceImage.s3Url,
          }
        : null,
      output_asset: generation.outputAsset
        ? {
            id: generation.outputAsset.id,
            filename: generation.outputAsset.filename,
            s3_url: generation.outputAsset.s3Url,
          }
        : null,
    });
  } catch (error) {
    console.error("Update generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const generation = await prisma.videoGeneration.findUnique({
      where: { id },
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

    // RBAC check - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        // Quick Create - only owner can delete
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Can only delete pending or failed generations
    if (!["PENDING", "FAILED", "CANCELLED"].includes(generation.status)) {
      return NextResponse.json(
        { detail: "Cannot delete generation in current status" },
        { status: 400 }
      );
    }

    await prisma.videoGeneration.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
