import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  createLyricsExtractorAgent,
  toLyricsData,
} from "@/lib/agents/analyzers";
import type { LyricsData } from "@/lib/subtitle-styles";

/**
 * POST /api/v1/audio/lyrics
 * Extract lyrics from an audio asset OR sync provided lyrics with audio
 *
 * Request body:
 * - assetId: string - Asset ID containing the audio file
 * - languageHint?: 'ko' | 'en' | 'ja' | 'auto' - Language hint for extraction
 * - forceReExtract?: boolean - Force re-extraction even if lyrics exist
 * - lyrics?: string - (Optional) Provide lyrics text for forced alignment (sync only)
 *                     If provided, will sync these lyrics with audio timing instead of extracting
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { assetId, languageHint = "auto", forceReExtract = false, lyrics: providedLyrics } = body;

    if (!assetId) {
      return NextResponse.json(
        { detail: "assetId is required" },
        { status: 400 }
      );
    }

    // Get the asset with campaign for access check
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        campaign: {
          select: { artistId: true },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ detail: "Asset not found" }, { status: 404 });
    }

    // Check access via campaign's artist
    if (user.role !== "ADMIN") {
      // For non-admin, check if user has access to this campaign's artist
      const artist = asset.campaign?.artistId
        ? await prisma.artist.findUnique({
            where: { id: asset.campaign.artistId },
            select: { labelId: true },
          })
        : null;

      if (!artist || !user.labelIds.includes(artist.labelId)) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Check if asset is audio type
    if (asset.type !== "AUDIO") {
      return NextResponse.json(
        { detail: "Asset must be an audio file" },
        { status: 400 }
      );
    }

    // Check if lyrics already exist and forceReExtract is false
    const existingMetadata = asset.metadata as Record<string, unknown> | null;
    const existingLyrics = existingMetadata?.lyrics as LyricsData | undefined;

    if (existingLyrics && !forceReExtract) {
      return NextResponse.json({
        assetId,
        lyrics: existingLyrics,
        cached: true,
        message: "Lyrics already extracted. Use forceReExtract=true to re-extract.",
      });
    }

    // Get audio URL from asset
    const audioUrl = asset.s3Url;
    if (!audioUrl) {
      return NextResponse.json(
        { detail: "Asset does not have a URL" },
        { status: 400 }
      );
    }

    // Create lyrics extractor agent
    const extractor = createLyricsExtractorAgent();

    // Context for agent (language restricted to ko/en for AgentContext compatibility)
    const agentContext = {
      workflow: {
        platform: "tiktok" as const,
        language: (languageHint === "auto" || languageHint === "ja" ? "ko" : languageHint) as 'ko' | 'en',
        artistName: "unknown",
      },
    };

    // Check if we're doing forced alignment (lyrics provided) or extraction
    const isForcedAlignment = !!providedLyrics && typeof providedLyrics === 'string' && providedLyrics.trim().length > 0;

    const result = isForcedAlignment
      ? await extractor.alignLyricsFromUrl(
          audioUrl,
          providedLyrics.trim(),
          {
            languageHint: languageHint as 'ko' | 'en' | 'ja' | 'auto',
            audioDuration: (existingMetadata?.duration as number) || undefined,
          },
          agentContext
        )
      : await extractor.extractLyricsFromUrl(
          audioUrl,
          {
            languageHint: languageHint as 'ko' | 'en' | 'ja' | 'auto',
            audioDuration: (existingMetadata?.duration as number) || undefined,
          },
          agentContext
        );

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          detail: "Failed to extract lyrics",
          error: result.error,
        },
        { status: 500 }
      );
    }

    // Convert to LyricsData format
    const lyricsData = toLyricsData(result.data);

    // Store lyrics in asset metadata
    // Convert to plain object for Prisma JSON compatibility
    const updatedMetadata = JSON.parse(JSON.stringify({
      ...(existingMetadata || {}),
      hasLyrics: !lyricsData.isInstrumental,
      lyricsLanguage: lyricsData.language,
      lyricsExtractedAt: lyricsData.extractedAt,
      lyrics: lyricsData,
    })) as Prisma.InputJsonValue;

    await prisma.asset.update({
      where: { id: assetId },
      data: {
        metadata: updatedMetadata,
      },
    });

    return NextResponse.json({
      assetId,
      lyrics: lyricsData,
      cached: false,
      mode: isForcedAlignment ? 'forced-alignment' : 'extraction',
      metadata: {
        tokenUsage: result.metadata.tokenUsage,
        latencyMs: result.metadata.latencyMs,
      },
    });
  } catch (error) {
    console.error("Lyrics extraction error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
