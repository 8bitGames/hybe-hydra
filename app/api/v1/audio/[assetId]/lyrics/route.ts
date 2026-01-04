import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { LyricsData, LyricsSegment } from "@/lib/subtitle-styles";

interface RouteParams {
  params: Promise<{ assetId: string }>;
}

/**
 * Helper to check asset access
 */
async function checkAssetAccess(
  assetId: string,
  user: { id: string; role: string; labelIds: string[] }
): Promise<{
  asset: Awaited<ReturnType<typeof prisma.asset.findUnique>> | null;
  hasAccess: boolean;
}> {
  const asset = await withRetry(() => prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      campaign: {
        select: { artistId: true },
      },
    },
  }));

  if (!asset) {
    return { asset: null, hasAccess: false };
  }

  // Admin has access to everything
  if (user.role === "ADMIN") {
    return { asset, hasAccess: true };
  }

  // Check via campaign's artist
  const artist = asset.campaign?.artistId
    ? await withRetry(() => prisma.artist.findUnique({
        where: { id: asset.campaign.artistId },
        select: { labelId: true },
      }))
    : null;

  const hasAccess = artist ? user.labelIds.includes(artist.labelId) : false;
  return { asset, hasAccess };
}

/**
 * GET /api/v1/audio/[assetId]/lyrics
 * Get stored lyrics for an audio asset
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { assetId } = await params;

    const { asset, hasAccess } = await checkAssetAccess(assetId, user);

    if (!asset) {
      return NextResponse.json({ detail: "Asset not found" }, { status: 404 });
    }

    if (!hasAccess) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Get lyrics from metadata
    const metadata = asset.metadata as Record<string, unknown> | null;
    const lyrics = metadata?.lyrics as LyricsData | undefined;

    if (!lyrics) {
      return NextResponse.json({
        assetId,
        hasLyrics: false,
        lyrics: null,
        message: "No lyrics extracted for this asset. Use POST /api/v1/audio/lyrics to extract.",
      });
    }

    return NextResponse.json({
      assetId,
      hasLyrics: !lyrics.isInstrumental,
      lyrics,
    });
  } catch (error) {
    console.error("Get lyrics error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/audio/[assetId]/lyrics
 * Update/manually edit lyrics for an audio asset
 *
 * Request body:
 * - lyrics: LyricsData - Updated lyrics data
 * OR
 * - segments: LyricsSegment[] - Update only segments (timing adjustments)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { assetId } = await params;
    const body = await request.json();

    const { asset, hasAccess } = await checkAssetAccess(assetId, user);

    if (!asset) {
      return NextResponse.json({ detail: "Asset not found" }, { status: 404 });
    }

    if (!hasAccess) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    const existingMetadata = asset.metadata as Record<string, unknown> | null;
    const existingLyrics = existingMetadata?.lyrics as LyricsData | undefined;

    let updatedLyrics: LyricsData;

    if (body.lyrics) {
      // Full lyrics update
      updatedLyrics = {
        ...body.lyrics,
        source: body.lyrics.source || 'manual',
        extractedAt: new Date().toISOString(),
      };
    } else if (body.segments && existingLyrics) {
      // Partial update - only segments (for timing adjustments)
      updatedLyrics = {
        ...existingLyrics,
        segments: body.segments as LyricsSegment[],
        source: 'manual', // Mark as manually edited
        extractedAt: new Date().toISOString(),
      };

      // Rebuild fullText from segments if needed
      if (body.rebuildFullText) {
        updatedLyrics.fullText = body.segments
          .map((s: LyricsSegment) => s.text)
          .join('\n');
      }
    } else if (body.segments && !existingLyrics) {
      return NextResponse.json(
        { detail: "No existing lyrics to update. Provide full lyrics object." },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { detail: "Either 'lyrics' or 'segments' must be provided" },
        { status: 400 }
      );
    }

    // Update asset metadata - convert to plain object for Prisma JSON compatibility
    const updatedMetadata = JSON.parse(JSON.stringify({
      ...(existingMetadata || {}),
      hasLyrics: !updatedLyrics.isInstrumental,
      lyricsLanguage: updatedLyrics.language,
      lyricsExtractedAt: updatedLyrics.extractedAt,
      lyrics: updatedLyrics,
    })) as Prisma.InputJsonValue;

    await withRetry(() => prisma.asset.update({
      where: { id: assetId },
      data: {
        metadata: updatedMetadata,
      },
    }));

    return NextResponse.json({
      assetId,
      lyrics: updatedLyrics,
      updated: true,
    });
  } catch (error) {
    console.error("Update lyrics error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/audio/[assetId]/lyrics
 * Remove lyrics from an audio asset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { assetId } = await params;

    // Get the asset
    const asset = await withRetry(() => prisma.asset.findUnique({
      where: { id: assetId },
    }));

    if (!asset) {
      return NextResponse.json({ detail: "Asset not found" }, { status: 404 });
    }

    // Check access - only admin can delete
    if (user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    // Remove lyrics from metadata
    const existingMetadata = asset.metadata as Record<string, unknown> | null;
    if (existingMetadata) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lyrics, hasLyrics, lyricsLanguage, lyricsExtractedAt, ...restMetadata } = existingMetadata;

      const cleanedMetadata = Object.keys(restMetadata).length > 0
        ? (JSON.parse(JSON.stringify(restMetadata)) as Prisma.InputJsonValue)
        : Prisma.JsonNull;

      await withRetry(() => prisma.asset.update({
        where: { id: assetId },
        data: {
          metadata: cleanedMetadata,
        },
      }));
    }

    return NextResponse.json({
      assetId,
      deleted: true,
    });
  } catch (error) {
    console.error("Delete lyrics error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
