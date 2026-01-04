import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { validateFile, generateS3Key, uploadToS3, AssetType as StorageAssetType } from "@/lib/storage";
import { AssetType, MerchandiseType, Prisma } from "@prisma/client";
import { getComposeEngineUrl } from "@/lib/compose/client";

interface ClimaxCandidate {
  start_time: number;
  drop_time: number;
  score: number;
  type: string;
}

interface AudioAnalysisResult {
  bpm: number;
  duration: number;
  beat_times?: number[];
  energy_curve?: [number, number][];
  suggested_vibe?: string;
  best_15s_start?: number;
  best_hook_start?: number;
  climax_candidates?: ClimaxCandidate[];
  drops?: number[];
  builds?: [number, number][];
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
        job_id: `asset-upload-${Date.now()}`
      })
    });

    if (!response.ok) {
      console.warn(`[Asset Upload] Audio analysis failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('[Asset Upload] Audio analysis result:', {
      bpm: data.bpm,
      duration: data.duration,
      beat_count: data.beat_times?.length || 0,
      climax_candidates: data.climax_candidates?.length || 0,
      drops: data.drops?.length || 0
    });

    return {
      bpm: data.bpm,
      duration: data.duration,
      beat_times: data.beat_times,
      energy_curve: data.energy_curve,
      suggested_vibe: data.suggested_vibe,
      best_15s_start: data.best_15s_start,
      best_hook_start: data.best_hook_start,
      climax_candidates: data.climax_candidates,
      drops: data.drops,
      builds: data.builds
    };
  } catch (error) {
    console.error('[Asset Upload] Audio analysis error:', error);
    return null;
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "50");
    const type = searchParams.get("type") as AssetType | null;

    // Check campaign access
    const campaign = await withRetry(() => prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: { select: { labelId: true } },
      },
    }));

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Build where clause
    const where: Record<string, unknown> = { campaignId };
    if (type) {
      where.type = type.toUpperCase() as AssetType;
    }

    const total = await withRetry(() => prisma.asset.count({ where }));

    const assets = await withRetry(() => prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }));

    const pages = Math.ceil(total / pageSize) || 1;

    const items = assets.map((asset) => ({
      id: asset.id,
      campaign_id: asset.campaignId,
      type: asset.type.toLowerCase(),
      merchandise_type: asset.merchandiseType?.toLowerCase() || null,
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
    }));

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      pages,
    });
  } catch (error) {
    console.error("Get assets error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Check campaign access
    const campaign = await withRetry(() => prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: { select: { labelId: true } },
      },
    }));

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const assetTypeOverride = formData.get("asset_type") as string | null; // "goods" or null
    const merchandiseTypeStr = formData.get("merchandise_type") as string | null; // "album", "photocard", etc.

    if (!file) {
      return NextResponse.json({ detail: "No file provided" }, { status: 400 });
    }

    // Determine if this should be a GOODS type
    const overrideType = assetTypeOverride?.toUpperCase() === "GOODS" ? "GOODS" as StorageAssetType : undefined;

    // Validate file with optional type override
    const validation = validateFile(file.type, file.size, overrideType);
    if (!validation.valid) {
      return NextResponse.json({ detail: validation.error }, { status: 400 });
    }

    // Validate merchandise_type if asset_type is GOODS
    let merchandiseType: MerchandiseType | null = null;
    if (validation.type === "GOODS") {
      if (!merchandiseTypeStr) {
        return NextResponse.json(
          { detail: "merchandise_type is required when uploading goods" },
          { status: 400 }
        );
      }
      const upperMerchType = merchandiseTypeStr.toUpperCase() as MerchandiseType;
      if (!Object.values(MerchandiseType).includes(upperMerchType)) {
        return NextResponse.json(
          { detail: "Invalid merchandise_type. Must be one of: album, photocard, lightstick, apparel, accessory, other" },
          { status: 400 }
        );
      }
      merchandiseType = upperMerchType;
    }

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const s3Key = generateS3Key(campaignId, file.name);
    const s3Url = await uploadToS3(buffer, s3Key, file.type);

    // Analyze audio file to extract BPM, duration, and climax data
    let metadata: Record<string, unknown> = {};
    if (validation.type === "AUDIO") {
      console.log('[Asset Upload] Analyzing audio file:', file.name);
      const analysisResult = await analyzeAudioFile(s3Url);
      if (analysisResult) {
        // Sample beat_times to max 200 entries for storage efficiency
        const sampledBeatTimes = analysisResult.beat_times && analysisResult.beat_times.length > 200
          ? analysisResult.beat_times.filter((_, i) => i % Math.ceil(analysisResult.beat_times!.length / 200) === 0)
          : analysisResult.beat_times;

        // Sample energy_curve to max 400 entries (every 0.5s for a 200s song)
        const sampledEnergyCurve = analysisResult.energy_curve && analysisResult.energy_curve.length > 400
          ? analysisResult.energy_curve.filter((_, i) => i % Math.ceil(analysisResult.energy_curve!.length / 400) === 0)
          : analysisResult.energy_curve;

        metadata = {
          // Basic info
          bpm: analysisResult.bpm,
          audioBpm: analysisResult.bpm,
          duration: analysisResult.duration,
          audioDurationSec: analysisResult.duration,
          suggestedVibe: analysisResult.suggested_vibe,
          // Timing data (sampled for efficiency)
          beatTimes: sampledBeatTimes,
          energyCurve: sampledEnergyCurve,
          // Climax detection data (full)
          climaxCandidates: analysisResult.climax_candidates,
          drops: analysisResult.drops,
          builds: analysisResult.builds,
          bestHookStart: analysisResult.best_hook_start,
          best15sStart: analysisResult.best_15s_start,
          // Analysis status
          analyzed: true,
          analyzedAt: new Date().toISOString()
        };
        console.log('[Asset Upload] Audio metadata stored:', {
          bpm: metadata.bpm,
          duration: metadata.duration,
          climaxCandidates: (metadata.climaxCandidates as unknown[])?.length || 0,
          drops: (metadata.drops as unknown[])?.length || 0
        });
      }
    }

    // Create asset record
    const asset = await withRetry(() => prisma.asset.create({
      data: {
        campaignId,
        type: validation.type as AssetType,
        merchandiseType,
        filename: s3Key.split("/").pop() || file.name,
        originalFilename: file.name,
        s3Url,
        s3Key,
        fileSize: file.size,
        mimeType: file.type,
        createdBy: user.id,
        metadata: Object.keys(metadata).length > 0 ? metadata as Prisma.InputJsonValue : undefined,
      },
    }));

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
    console.error("Upload asset error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
