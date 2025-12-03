import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";

const STUCK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/v1/generations/cleanup
 * Get orphaned/stuck generations that need cleanup
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaign_id");
    const includeAll = url.searchParams.get("include_all") === "true";

    const oneHourAgo = new Date(Date.now() - STUCK_THRESHOLD_MS);

    // Find stuck PROCESSING generations (older than 1 hour)
    const stuckProcessing = await prisma.videoGeneration.findMany({
      where: {
        status: "PROCESSING",
        updatedAt: { lt: oneHourAgo },
        ...(campaignId && { campaignId }),
        // RBAC: filter by user's labels unless admin
        ...(user.role !== "ADMIN" && {
          campaign: {
            artist: {
              labelId: { in: user.labelIds },
            },
          },
        }),
      },
      select: {
        id: true,
        campaignId: true,
        prompt: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
        errorMessage: true,
      },
      orderBy: { updatedAt: "asc" },
    });

    // Find orphaned generations (no output URL and status is COMPLETED)
    const orphanedCompleted = await prisma.videoGeneration.findMany({
      where: {
        status: "COMPLETED",
        outputUrl: null,
        composedOutputUrl: null,
        ...(campaignId && { campaignId }),
        ...(user.role !== "ADMIN" && {
          campaign: {
            artist: {
              labelId: { in: user.labelIds },
            },
          },
        }),
      },
      select: {
        id: true,
        campaignId: true,
        prompt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "asc" },
    });

    // Find failed generations that can be cleaned up
    const failedGenerations = includeAll
      ? await prisma.videoGeneration.findMany({
          where: {
            status: "FAILED",
            ...(campaignId && { campaignId }),
            ...(user.role !== "ADMIN" && {
              campaign: {
                artist: {
                  labelId: { in: user.labelIds },
                },
              },
            }),
          },
          select: {
            id: true,
            campaignId: true,
            prompt: true,
            status: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        })
      : [];

    return NextResponse.json({
      stuck_processing: stuckProcessing.map((g) => ({
        id: g.id,
        campaign_id: g.campaignId,
        prompt: g.prompt,
        status: g.status.toLowerCase(),
        progress: g.progress,
        error_message: g.errorMessage,
        created_at: g.createdAt.toISOString(),
        updated_at: g.updatedAt.toISOString(),
        stuck_duration_minutes: Math.round(
          (Date.now() - g.updatedAt.getTime()) / (1000 * 60)
        ),
      })),
      orphaned_completed: orphanedCompleted.map((g) => ({
        id: g.id,
        campaign_id: g.campaignId,
        prompt: g.prompt,
        status: g.status.toLowerCase(),
        created_at: g.createdAt.toISOString(),
        updated_at: g.updatedAt.toISOString(),
      })),
      failed_generations: failedGenerations.map((g) => ({
        id: g.id,
        campaign_id: g.campaignId,
        prompt: g.prompt,
        status: g.status.toLowerCase(),
        error_message: g.errorMessage,
        created_at: g.createdAt.toISOString(),
        updated_at: g.updatedAt.toISOString(),
      })),
      summary: {
        stuck_processing_count: stuckProcessing.length,
        orphaned_completed_count: orphanedCompleted.length,
        failed_count: failedGenerations.length,
        total_cleanup_candidates:
          stuckProcessing.length + orphanedCompleted.length + failedGenerations.length,
      },
    });
  } catch (error) {
    console.error("Get cleanup candidates error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/generations/cleanup
 * Perform cleanup operations on orphaned/stuck generations
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      mark_stuck_as_failed = true,
      delete_orphaned = false,
      delete_failed = false,
      generation_ids = [], // Specific IDs to clean up
      campaign_id,
    } = body;

    const oneHourAgo = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const results = {
      marked_as_failed: 0,
      deleted_orphaned: 0,
      deleted_failed: 0,
      errors: [] as string[],
    };

    // Build RBAC filter
    const rbacFilter =
      user.role !== "ADMIN"
        ? {
            campaign: {
              artist: {
                labelId: { in: user.labelIds },
              },
            },
          }
        : {};

    // 1. Mark stuck PROCESSING as FAILED
    if (mark_stuck_as_failed) {
      const whereClause = {
        status: "PROCESSING" as const,
        updatedAt: { lt: oneHourAgo },
        ...(campaign_id && { campaignId: campaign_id }),
        ...(generation_ids.length > 0 && { id: { in: generation_ids } }),
        ...rbacFilter,
      };

      const updateResult = await prisma.videoGeneration.updateMany({
        where: whereClause,
        data: {
          status: "FAILED",
          errorMessage: "Automatically marked as failed: Processing timeout exceeded 1 hour",
          progress: 0,
        },
      });

      results.marked_as_failed = updateResult.count;
    }

    // 2. Delete orphaned COMPLETED (no output URL)
    if (delete_orphaned) {
      const orphanedIds = await prisma.videoGeneration.findMany({
        where: {
          status: "COMPLETED",
          outputUrl: null,
          composedOutputUrl: null,
          ...(campaign_id && { campaignId: campaign_id }),
          ...(generation_ids.length > 0 && { id: { in: generation_ids } }),
          ...rbacFilter,
        },
        select: { id: true },
      });

      for (const gen of orphanedIds) {
        try {
          await prisma.videoGeneration.delete({ where: { id: gen.id } });
          results.deleted_orphaned++;
        } catch (err) {
          results.errors.push(`Failed to delete orphaned ${gen.id}: ${err}`);
        }
      }
    }

    // 3. Delete FAILED generations
    if (delete_failed) {
      const failedIds = await prisma.videoGeneration.findMany({
        where: {
          status: "FAILED",
          ...(campaign_id && { campaignId: campaign_id }),
          ...(generation_ids.length > 0 && { id: { in: generation_ids } }),
          ...rbacFilter,
        },
        select: { id: true },
      });

      for (const gen of failedIds) {
        try {
          await prisma.videoGeneration.delete({ where: { id: gen.id } });
          results.deleted_failed++;
        } catch (err) {
          results.errors.push(`Failed to delete failed ${gen.id}: ${err}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Cleanup completed: ${results.marked_as_failed} marked as failed, ${results.deleted_orphaned} orphaned deleted, ${results.deleted_failed} failed deleted`,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
