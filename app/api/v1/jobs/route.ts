import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import type { Job, JobType, JobStatus } from "@/lib/stores/job-store";

/**
 * GET /api/v1/jobs
 * Get active and recent background jobs for the current user
 *
 * 현재 사용자의 활성 및 최근 백그라운드 작업 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Get active video generations (PENDING or PROCESSING)
    const activeGenerations = await prisma.videoGeneration.findMany({
      where: {
        createdBy: user.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      select: {
        id: true,
        prompt: true,
        status: true,
        progress: true,
        createdAt: true,
        campaignId: true,
        isQuickCreate: true,
        campaign: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get recent completed/failed generations
    const recentGenerations = await prisma.videoGeneration.findMany({
      where: {
        createdBy: user.id,
        status: { in: ["COMPLETED", "FAILED"] },
        updatedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
      select: {
        id: true,
        prompt: true,
        status: true,
        progress: true,
        outputUrl: true,
        composedOutputUrl: true,
        qualityScore: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        campaignId: true,
        campaign: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    // Transform to Job format
    const active: Job[] = activeGenerations.map((gen) => ({
      id: gen.id,
      type: "VIDEO_GENERATION" as JobType,
      status: mapVideoStatus(gen.status),
      progress: gen.progress || 0,
      title: {
        ko: getJobTitleKo(gen.prompt, gen.isQuickCreate),
        en: getJobTitleEn(gen.prompt, gen.isQuickCreate),
      },
      currentStep: getProgressStep(gen.progress || 0),
      campaignId: gen.campaignId || undefined,
      campaignName: gen.campaign?.name || undefined,
      generationId: gen.id,
      createdAt: gen.createdAt,
      estimatedDuration: estimateDuration(gen.progress || 0),
    }));

    const recent: Job[] = recentGenerations.map((gen) => ({
      id: gen.id,
      type: "VIDEO_GENERATION" as JobType,
      status: mapVideoStatus(gen.status),
      progress: 100,
      title: {
        ko: getJobTitleKo(gen.prompt, false),
        en: getJobTitleEn(gen.prompt, false),
      },
      campaignId: gen.campaignId || undefined,
      campaignName: gen.campaign?.name || undefined,
      generationId: gen.id,
      createdAt: gen.createdAt,
      completedAt: gen.updatedAt,
      result: {
        outputUrl: gen.composedOutputUrl || gen.outputUrl || undefined,
        score: gen.qualityScore || undefined,
        error: gen.errorMessage || undefined,
      },
    }));

    // Count by status
    const counts = {
      queued: active.filter((j) => j.status === "QUEUED").length,
      processing: active.filter((j) => j.status === "PROCESSING").length,
      completed: recent.filter((j) => j.status === "COMPLETED").length,
      failed: recent.filter((j) => j.status === "FAILED").length,
    };

    return NextResponse.json({
      active,
      recent,
      counts,
    });
  } catch (error) {
    console.error("[Jobs API] Error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

function mapVideoStatus(status: string): JobStatus {
  switch (status) {
    case "PENDING":
      return "QUEUED";
    case "PROCESSING":
      return "PROCESSING";
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "QUEUED";
  }
}

function getJobTitleKo(prompt: string, isQuickCreate: boolean): string {
  const truncated = prompt.length > 30 ? prompt.substring(0, 30) + "..." : prompt;
  return isQuickCreate ? `빠른 생성: ${truncated}` : `영상 생성: ${truncated}`;
}

function getJobTitleEn(prompt: string, isQuickCreate: boolean): string {
  const truncated = prompt.length > 30 ? prompt.substring(0, 30) + "..." : prompt;
  return isQuickCreate ? `Quick Create: ${truncated}` : `Generating: ${truncated}`;
}

function getProgressStep(progress: number): { ko: string; en: string } | undefined {
  if (progress < 10) {
    return { ko: "준비 중...", en: "Preparing..." };
  }
  if (progress < 30) {
    return { ko: "프롬프트 최적화 중...", en: "Optimizing prompt..." };
  }
  if (progress < 50) {
    return { ko: "AI 영상 생성 중...", en: "Generating AI video..." };
  }
  if (progress < 70) {
    return { ko: "영상 처리 중...", en: "Processing video..." };
  }
  if (progress < 90) {
    return { ko: "오디오 합성 중...", en: "Composing audio..." };
  }
  return { ko: "마무리 중...", en: "Finalizing..." };
}

function estimateDuration(progress: number): number | undefined {
  if (progress >= 90) return 30;
  if (progress >= 70) return 60;
  if (progress >= 50) return 120;
  if (progress >= 30) return 180;
  if (progress >= 10) return 240;
  return 300;
}
