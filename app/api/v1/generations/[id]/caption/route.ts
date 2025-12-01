import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getUserFromHeader } from "@/lib/auth";
import {
  generateCaption,
  generateQuickCaption,
  CaptionInput,
  CaptionLanguage,
  CaptionStyle,
  Platform,
} from "@/lib/caption-generator";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/generations/[id]/caption - Generate caption for a video generation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;

    // Get the generation with campaign and artist info
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        campaign: {
          include: {
            artist: {
              select: {
                name: true,
                stageName: true,
                groupName: true,
                labelId: true,
              },
            },
          },
        },
      },
    });

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check access - handle Quick Create (no campaign) vs campaign-based generations
    if (user.role !== "ADMIN") {
      if (generation.campaignId && generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        // Quick Create - only owner can access
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      style = "engaging",
      language = "ko",
      platform = "tiktok",
      trend_keywords = [],
      quick = false,
    } = body;

    // Get artist info (use defaults for Quick Create without campaign)
    const artistName = generation.campaign?.artist?.stageName || generation.campaign?.artist?.name || "Artist";
    const groupName = generation.campaign?.artist?.groupName || undefined;

    if (quick) {
      // Quick caption generation
      const result = await generateQuickCaption(
        generation.prompt,
        language as CaptionLanguage
      );

      return NextResponse.json({
        generation_id: generationId,
        quick: true,
        result,
      });
    }

    // Full caption generation
    const captionInput: CaptionInput = {
      prompt: generation.prompt,
      artistName,
      groupName,
      campaignName: generation.campaign?.name || "Quick Create",
      trendKeywords: trend_keywords,
      style: style as CaptionStyle,
      language: language as CaptionLanguage,
      platform: platform as Platform,
    };

    const result = await generateCaption(captionInput);

    // Store caption in generation metadata
    const existingMetadata = (generation.qualityMetadata as Record<string, unknown>) || {};
    const captionData = {
      primary: {
        caption: result.primary.caption,
        hashtags: result.primary.hashtags,
        emojis: result.primary.emojis,
        callToAction: result.primary.callToAction || null,
        hookLine: result.primary.hookLine || null,
        seoScore: result.primary.seoScore,
      },
      generatedAt: result.metadata.generatedAt,
      language: result.metadata.language,
      style: result.metadata.style,
    };

    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        qualityMetadata: {
          ...existingMetadata,
          caption: captionData,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      generation_id: generationId,
      result,
    });
  } catch (error) {
    console.error("Generate caption error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/v1/generations/[id]/caption - Get saved caption for a generation
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
            artist: {
              select: { labelId: true },
            },
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
    const caption = metadata?.caption as Record<string, unknown> | undefined;

    if (!caption) {
      return NextResponse.json({
        generation_id: generationId,
        has_caption: false,
        caption: null,
      });
    }

    return NextResponse.json({
      generation_id: generationId,
      has_caption: true,
      caption,
    });
  } catch (error) {
    console.error("Get caption error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
