import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { AssetType, MerchandiseType, Prisma } from "@prisma/client";
import { getComposeEngineUrl } from "@/lib/compose/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AudioAnalysisResult {
  bpm: number;
  duration: number;
  beat_times?: number[];
}

/**
 * Analyze audio file using compose-engine to extract BPM and duration
 */
async function analyzeAudioFile(s3Url: string): Promise<AudioAnalysisResult | null> {
  const composeUrl = getComposeEngineUrl();

  try {
    const response = await fetch(`${composeUrl}/audio/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_url: s3Url,
        job_id: `asset-confirm-${Date.now()}`
      })
    });

    if (!response.ok) {
      console.warn(`[Asset Confirm] Audio analysis failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('[Asset Confirm] Audio analysis result:', {
      bpm: data.bpm,
      duration: data.duration,
      beat_count: data.beat_times?.length || 0
    });

    return {
      bpm: data.bpm,
      duration: data.duration,
      beat_times: data.beat_times
    };
  } catch (error) {
    console.error('[Asset Confirm] Audio analysis error:', error);
    return null;
  }
}

/**
 * POST /api/v1/campaigns/[id]/assets/confirm
 *
 * Confirm a direct S3 upload and create the asset record.
 * Called after the browser successfully uploads to S3 using the presigned URL.
 *
 * Request body:
 * - s3_key: The S3 key from the presign response
 * - s3_url: The public URL from the presign response
 * - filename: Original filename
 * - file_size: Size in bytes
 * - content_type: MIME type
 * - asset_type: Asset type (image, video, audio, goods)
 * - merchandise_type?: Required if asset_type is "goods"
 */
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
      s3_key,
      s3_url,
      filename,
      file_size,
      content_type,
      asset_type,
      merchandise_type,
    } = body;

    if (!s3_key || !s3_url || !filename || !file_size || !content_type || !asset_type) {
      return NextResponse.json(
        { detail: "s3_key, s3_url, filename, file_size, content_type, and asset_type are required" },
        { status: 400 }
      );
    }

    // Convert asset_type to enum
    const assetTypeEnum = asset_type.toUpperCase() as AssetType;
    if (!Object.values(AssetType).includes(assetTypeEnum)) {
      return NextResponse.json({ detail: "Invalid asset_type" }, { status: 400 });
    }

    // Validate merchandise_type for GOODS
    let merchandiseTypeEnum: MerchandiseType | null = null;
    if (assetTypeEnum === "GOODS") {
      if (!merchandise_type) {
        return NextResponse.json(
          { detail: "merchandise_type is required for goods" },
          { status: 400 }
        );
      }
      merchandiseTypeEnum = merchandise_type.toUpperCase() as MerchandiseType;
      if (!Object.values(MerchandiseType).includes(merchandiseTypeEnum)) {
        return NextResponse.json({ detail: "Invalid merchandise_type" }, { status: 400 });
      }
    }

    // Analyze audio file to extract BPM and duration
    let metadata: Record<string, unknown> = {};
    if (assetTypeEnum === "AUDIO") {
      console.log('[Asset Confirm] Analyzing audio file:', filename);
      const analysisResult = await analyzeAudioFile(s3_url);
      if (analysisResult) {
        metadata = {
          bpm: analysisResult.bpm,
          audioBpm: analysisResult.bpm,
          duration: analysisResult.duration,
          audioDurationSec: analysisResult.duration,
          analyzed: true,
          analyzedAt: new Date().toISOString()
        };
        console.log('[Asset Confirm] Audio metadata stored:', metadata);
      }
    }

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        campaignId,
        type: assetTypeEnum,
        merchandiseType: merchandiseTypeEnum,
        filename: s3_key.split("/").pop() || filename,
        originalFilename: filename,
        s3Url: s3_url,
        s3Key: s3_key,
        fileSize: file_size,
        mimeType: content_type,
        createdBy: user.id,
        metadata: Object.keys(metadata).length > 0 ? metadata as Prisma.InputJsonValue : undefined,
      },
    });

    return NextResponse.json(
      {
        id: asset.id,
        filename: asset.filename,
        s3_url: asset.s3Url,
        s3_key: asset.s3Key,
        type: asset.type.toLowerCase(),
        merchandise_type: asset.merchandiseType?.toLowerCase() || null,
        metadata: asset.metadata || null,
        message: "Asset uploaded successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Confirm upload error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
