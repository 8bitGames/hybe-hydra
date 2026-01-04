import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/generations/[id]/extend/history
 *
 * Get the extension history/lineage for a video generation.
 * Returns:
 * - extensions_from_this: Videos extended FROM this video (this video as source)
 * - extended_from: The video this was extended FROM (if any)
 * - full_chain: Complete extension chain from root to all leaves
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the generation exists and user has access
    const generation = await withRetry(() => prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    }));

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // RBAC check
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Get extensions FROM this video (this video as source)
    const extensionsFromThis = await withRetry(() => prisma.videoExtensionHistory.findMany({
      where: { sourceGenerationId: id },
      include: {
        extendedGeneration: {
          select: {
            id: true,
            status: true,
            durationSeconds: true,
            extensionCount: true,
            outputUrl: true,
            gcsUri: true,
            createdAt: true,
          },
        },
      },
      orderBy: { extensionNumber: "asc" },
    }));

    // Get the extension record where this video is the RESULT (extended from another)
    const extendedFrom = await withRetry(() => prisma.videoExtensionHistory.findFirst({
      where: { extendedGenerationId: id },
      include: {
        sourceGeneration: {
          select: {
            id: true,
            status: true,
            durationSeconds: true,
            extensionCount: true,
            outputUrl: true,
            gcsUri: true,
            createdAt: true,
          },
        },
      },
    }));

    // Build full chain - find root and traverse to all leaves
    const fullChain = await buildExtensionChain(id);

    return NextResponse.json({
      generation_id: id,
      extension_count: generation.extensionCount || 0,
      duration_seconds: generation.durationSeconds,

      // This video as source - what was extended from this
      extensions_from_this: extensionsFromThis.map((ext) => ({
        history_id: ext.id,
        extension_number: ext.extensionNumber,
        prompt: ext.prompt,
        duration_before: ext.durationBefore,
        duration_after: ext.durationAfter,
        created_at: ext.createdAt,
        extended_video: {
          id: ext.extendedGeneration.id,
          status: ext.extendedGeneration.status,
          duration_seconds: ext.extendedGeneration.durationSeconds,
          extension_count: ext.extendedGeneration.extensionCount,
          output_url: ext.extendedGeneration.outputUrl,
          has_gcs_uri: !!ext.extendedGeneration.gcsUri,
          created_at: ext.extendedGeneration.createdAt,
        },
      })),

      // Where this video came from (if extended)
      extended_from: extendedFrom
        ? {
            history_id: extendedFrom.id,
            extension_number: extendedFrom.extensionNumber,
            prompt: extendedFrom.prompt,
            duration_before: extendedFrom.durationBefore,
            duration_after: extendedFrom.durationAfter,
            created_at: extendedFrom.createdAt,
            source_video: {
              id: extendedFrom.sourceGeneration.id,
              status: extendedFrom.sourceGeneration.status,
              duration_seconds: extendedFrom.sourceGeneration.durationSeconds,
              extension_count: extendedFrom.sourceGeneration.extensionCount,
              output_url: extendedFrom.sourceGeneration.outputUrl,
              has_gcs_uri: !!extendedFrom.sourceGeneration.gcsUri,
              created_at: extendedFrom.sourceGeneration.createdAt,
            },
          }
        : null,

      // Full chain from root to all leaves
      full_chain: fullChain,
    });
  } catch (error) {
    console.error("Get extension history error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Build the complete extension chain starting from the root video
 */
async function buildExtensionChain(generationId: string) {
  // Find the root (original video with no parent)
  let currentId = generationId;
  let rootId = generationId;

  // Traverse up to find root
  while (true) {
    const parentRecord = await withRetry(() => prisma.videoExtensionHistory.findFirst({
      where: { extendedGenerationId: currentId },
      select: { sourceGenerationId: true },
    }));

    if (!parentRecord) {
      rootId = currentId;
      break;
    }
    currentId = parentRecord.sourceGenerationId;
  }

  // Get root video info
  const rootVideo = await withRetry(() => prisma.videoGeneration.findUnique({
    where: { id: rootId },
    select: {
      id: true,
      status: true,
      durationSeconds: true,
      extensionCount: true,
      outputUrl: true,
      gcsUri: true,
      createdAt: true,
    },
  }));

  if (!rootVideo) {
    return null;
  }

  // Build chain from root
  const chain: Array<{
    id: string;
    extension_number: number;
    duration_seconds: number;
    status: string;
    output_url: string | null;
    has_gcs_uri: boolean;
    is_current: boolean;
    created_at: Date;
  }> = [
    {
      id: rootVideo.id,
      extension_number: 0,
      duration_seconds: rootVideo.durationSeconds,
      status: rootVideo.status,
      output_url: rootVideo.outputUrl,
      has_gcs_uri: !!rootVideo.gcsUri,
      is_current: rootVideo.id === generationId,
      created_at: rootVideo.createdAt,
    },
  ];

  // Traverse down to find all extensions in order (max 20 iterations)
  let currentSourceId: string = rootId;
  for (let i = 0; i < 20; i++) {
    const extensionRecord = await withRetry(() => prisma.videoExtensionHistory.findFirst({
      where: { sourceGenerationId: currentSourceId },
      include: {
        extendedGeneration: {
          select: {
            id: true,
            status: true,
            durationSeconds: true,
            extensionCount: true,
            outputUrl: true,
            gcsUri: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }));

    if (!extensionRecord) {
      break;
    }

    const extGen = extensionRecord.extendedGeneration;
    chain.push({
      id: extGen.id,
      extension_number: extensionRecord.extensionNumber,
      duration_seconds: extGen.durationSeconds,
      status: extGen.status,
      output_url: extGen.outputUrl,
      has_gcs_uri: !!extGen.gcsUri,
      is_current: extGen.id === generationId,
      created_at: extGen.createdAt,
    });

    currentSourceId = extGen.id;
  }

  return {
    root_id: rootId,
    total_extensions: chain.length - 1,
    total_duration_added: chain.length > 1
      ? chain[chain.length - 1].duration_seconds - chain[0].duration_seconds
      : 0,
    videos: chain,
  };
}
