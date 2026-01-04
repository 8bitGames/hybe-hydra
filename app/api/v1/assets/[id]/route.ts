import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/storage";
import { getComposeEngineUrl } from "@/lib/compose/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AudioAnalysisResult {
  bpm: number;
  duration: number;
  suggested_vibe?: string;
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
        job_id: `asset-reanalyze-${Date.now()}`
      })
    });

    if (!response.ok) {
      console.warn(`[Asset Analyze] Audio analysis failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      bpm: data.bpm,
      duration: data.duration,
      suggested_vibe: data.suggested_vibe
    };
  } catch (error) {
    console.error('[Asset Analyze] Audio analysis error:', error);
    return null;
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const asset = await withRetry(() => prisma.asset.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    }));

    if (!asset) {
      return NextResponse.json({ detail: "Asset not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN" && !user.labelIds.includes(asset.campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      id: asset.id,
      campaign_id: asset.campaignId,
      type: asset.type.toLowerCase(),
      filename: asset.filename,
      original_filename: asset.originalFilename,
      s3_url: asset.s3Url,
      s3_key: asset.s3Key,
      file_size: asset.fileSize,
      mime_type: asset.mimeType,
      thumbnail_url: asset.thumbnailUrl,
      metadata: asset.metadata,
      created_by: asset.createdBy,
      created_at: asset.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Get asset error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/assets/[id] - Re-analyze an audio asset and update metadata
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const asset = await withRetry(() => prisma.asset.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    }));

    if (!asset) {
      return NextResponse.json({ detail: "Asset not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN" && !user.labelIds.includes(asset.campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Only allow re-analysis of audio assets
    if (asset.type !== "AUDIO") {
      return NextResponse.json(
        { detail: "Only audio assets can be analyzed" },
        { status: 400 }
      );
    }

    console.log('[Asset Analyze] Re-analyzing audio:', asset.filename);
    const analysisResult = await analyzeAudioFile(asset.s3Url);

    if (!analysisResult) {
      return NextResponse.json(
        { detail: "Audio analysis failed" },
        { status: 500 }
      );
    }

    // Update asset metadata
    const updatedMetadata = {
      ...(asset.metadata as Record<string, unknown> || {}),
      bpm: analysisResult.bpm,
      audioBpm: analysisResult.bpm,
      duration: analysisResult.duration,
      audioDurationSec: analysisResult.duration,
      vibe: analysisResult.suggested_vibe,
      audioVibe: analysisResult.suggested_vibe,
      analyzed: true,
      analyzedAt: new Date().toISOString()
    };

    const updatedAsset = await withRetry(() => prisma.asset.update({
      where: { id },
      data: { metadata: updatedMetadata },
    }));

    console.log('[Asset Analyze] Updated metadata:', {
      id: asset.id,
      bpm: analysisResult.bpm,
      duration: analysisResult.duration,
      vibe: analysisResult.suggested_vibe
    });

    return NextResponse.json({
      id: updatedAsset.id,
      message: "Audio asset analyzed successfully",
      metadata: updatedMetadata
    });
  } catch (error) {
    console.error("Analyze asset error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const asset = await withRetry(() => prisma.asset.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    }));

    if (!asset) {
      return NextResponse.json({ detail: "Asset not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN" && !user.labelIds.includes(asset.campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Delete from S3
    if (asset.s3Key) {
      try {
        await deleteFromS3(asset.s3Key);
      } catch (s3Error) {
        console.error("S3 delete error:", s3Error);
        // Continue with database deletion even if S3 fails
      }
    }

    // Delete from database
    await withRetry(() => prisma.asset.delete({ where: { id } }));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete asset error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
