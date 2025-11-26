import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { VideoGenerationStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

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

    const { id: campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const status = searchParams.get("status") as VideoGenerationStatus | null;

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
      status: gen.status.toLowerCase(),
      progress: gen.progress,
      error_message: gen.errorMessage,
      vertex_operation_name: gen.vertexOperationName,
      vertex_request_id: gen.vertexRequestId,
      output_asset_id: gen.outputAssetId,
      output_url: gen.outputUrl,
      quality_score: gen.qualityScore,
      quality_metadata: gen.qualityMetadata,
      created_by: gen.createdBy,
      created_at: gen.createdAt.toISOString(),
      updated_at: gen.updatedAt.toISOString(),
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
    } = body;

    if (!prompt) {
      return NextResponse.json({ detail: "Prompt is required" }, { status: 400 });
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
        status: "PENDING",
        progress: 0,
        createdBy: user.id,
        vertexRequestId: uuidv4(),
      },
      include: {
        referenceImage: {
          select: { id: true, filename: true, s3Url: true },
        },
      },
    });

    // In mock mode, simulate async processing
    if (process.env.VEO_MOCK_MODE === "true") {
      // Simulate processing (would be handled by a background job in production)
      setTimeout(async () => {
        try {
          await prisma.videoGeneration.update({
            where: { id: generation.id },
            data: {
              status: "PROCESSING",
              progress: 50,
            },
          });

          setTimeout(async () => {
            await prisma.videoGeneration.update({
              where: { id: generation.id },
              data: {
                status: "COMPLETED",
                progress: 100,
                outputUrl: `https://storage.example.com/mock-video-${generation.id}.mp4`,
                qualityScore: 85,
              },
            });
          }, 3000);
        } catch (e) {
          console.error("Mock processing error:", e);
        }
      }, 2000);
    }

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
        status: generation.status.toLowerCase(),
        progress: generation.progress,
        vertex_request_id: generation.vertexRequestId,
        created_by: generation.createdBy,
        created_at: generation.createdAt.toISOString(),
        reference_image: generation.referenceImage
          ? {
              id: generation.referenceImage.id,
              filename: generation.referenceImage.filename,
              s3_url: generation.referenceImage.s3Url,
            }
          : null,
        message: "Video generation started",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create generation error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
