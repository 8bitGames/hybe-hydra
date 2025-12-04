import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";

interface AudioAnalysisResult {
  bpm: number;
  duration: number;
  suggested_vibe?: string;
}

/**
 * Analyze audio file using compose-engine
 */
async function analyzeAudioFile(s3Url: string, jobId: string): Promise<AudioAnalysisResult | null> {
  const composeUrl = process.env.MODAL_COMPOSE_URL || process.env.LOCAL_COMPOSE_URL;

  if (!composeUrl) {
    return null;
  }

  try {
    const response = await fetch(`${composeUrl}/audio/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: s3Url, job_id: jobId })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      bpm: data.bpm,
      duration: data.duration,
      suggested_vibe: data.suggested_vibe
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/assets/analyze-all - Analyze all audio assets without metadata
 * Admin only - used for migrating existing assets
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Admin only
    if (user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    // Get limit from query params (default 10 to avoid timeout)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Find audio assets without BPM metadata
    const audioAssets = await prisma.asset.findMany({
      where: {
        type: "AUDIO",
        OR: [
          { metadata: { equals: Prisma.DbNull } },
          { metadata: { path: ["bpm"], equals: Prisma.JsonNull } }
        ]
      },
      select: {
        id: true,
        filename: true,
        s3Url: true,
        metadata: true
      },
      take: limit
    });

    console.log(`[Analyze All] Found ${audioAssets.length} audio assets to analyze`);

    const results = {
      total: audioAssets.length,
      analyzed: 0,
      failed: 0,
      details: [] as { id: string; filename: string; success: boolean; bpm?: number; duration?: number; error?: string }[]
    };

    // Analyze each asset sequentially to avoid overloading the server
    for (const asset of audioAssets) {
      console.log(`[Analyze All] Analyzing: ${asset.filename}`);

      try {
        const analysisResult = await analyzeAudioFile(asset.s3Url, `bulk-${asset.id}`);

        if (analysisResult) {
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

          await prisma.asset.update({
            where: { id: asset.id },
            data: { metadata: updatedMetadata }
          });

          results.analyzed++;
          results.details.push({
            id: asset.id,
            filename: asset.filename,
            success: true,
            bpm: analysisResult.bpm,
            duration: analysisResult.duration
          });
        } else {
          results.failed++;
          results.details.push({
            id: asset.id,
            filename: asset.filename,
            success: false,
            error: "Analysis returned no result"
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          id: asset.id,
          filename: asset.filename,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    console.log(`[Analyze All] Complete: ${results.analyzed} analyzed, ${results.failed} failed`);

    return NextResponse.json({
      message: "Audio analysis complete",
      ...results
    });
  } catch (error) {
    console.error("Analyze all assets error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
