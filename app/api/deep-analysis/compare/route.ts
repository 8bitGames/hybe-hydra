import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  createDeepAnalysisOrchestrator,
  type AccountData,
} from '@/lib/agents/deep-analysis';
import type { AccountMetrics } from '@/lib/deep-analysis/types';

/**
 * POST /api/deep-analysis/compare
 *
 * Compare multiple analyzed accounts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisIds, language = 'ko' } = body;

    if (!analysisIds || !Array.isArray(analysisIds) || analysisIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 analysisIds are required' },
        { status: 400 }
      );
    }

    if (analysisIds.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Maximum 10 accounts can be compared' },
        { status: 400 }
      );
    }

    // Fetch all analyses
    const analyses = await prisma.accountAnalysis.findMany({
      where: {
        id: { in: analysisIds },
        status: 'COMPLETED',
      },
      include: {
        videoClassifications: true,
      },
    });

    if (analyses.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 completed analyses are required' },
        { status: 400 }
      );
    }

    // Prepare account data for comparison
    const accounts: AccountData[] = analyses.map(analysis => {
      const basicMetrics = analysis.basicMetrics as Record<string, number> | null;
      const engagementMetrics = analysis.engagementMetrics as Record<string, number> | null;
      const postingMetrics = analysis.postingMetrics as Record<string, unknown> | null;

      const metrics: AccountMetrics = {
        totalVideos: basicMetrics?.totalVideos || 0,
        analyzedVideos: basicMetrics?.analyzedVideos || analysis.videosAnalyzed,
        totalViews: basicMetrics?.totalViews || 0,
        totalLikes: basicMetrics?.totalLikes || 0,
        totalComments: basicMetrics?.totalComments || 0,
        totalShares: basicMetrics?.totalShares || 0,
        avgViews: basicMetrics?.avgViews || 0,
        avgLikes: basicMetrics?.avgLikes || 0,
        avgComments: basicMetrics?.avgComments || 0,
        avgShares: basicMetrics?.avgShares || 0,
        avgEngagementRate: engagementMetrics?.avgEngagementRate || 0,
        medianEngagementRate: engagementMetrics?.medianEngagementRate || 0,
        engagementRateStdDev: engagementMetrics?.engagementRateStdDev || 0,
        topPerformingRate: engagementMetrics?.topPerformingRate || 0,
        bottomPerformingRate: engagementMetrics?.bottomPerformingRate || 0,
        postsPerWeek: (postingMetrics?.postsPerWeek as number) || 0,
        mostActiveDay: (postingMetrics?.mostActiveDay as string) || undefined,
        mostActiveHour: (postingMetrics?.mostActiveHour as number) || undefined,
        avgDuration: (postingMetrics?.avgDuration as number) || 0,
        avgHashtagCount: (postingMetrics?.avgHashtagCount as number) || 0,
        ownMusicPercentage: (postingMetrics?.ownMusicPercentage as number) || 0,
      };

      return {
        user: {
          id: analysis.tiktokUserId,
          uniqueId: analysis.uniqueId,
          nickname: analysis.nickname,
          avatarUrl: analysis.avatarUrl || '',
          signature: analysis.signature || '',
          verified: analysis.verified,
          followers: Number(analysis.followers),
          following: analysis.following,
          likes: Number(analysis.totalLikes),
          videos: analysis.totalVideos,
          secUid: '',
          totalLikes: Number(analysis.totalLikes),
        },
        videos: analysis.videoClassifications.map(vc => ({
          id: vc.tiktokVideoId,
          description: vc.description || '',
          hashtags: [],
          musicTitle: vc.musicTitle || undefined,
          musicId: vc.musicId || undefined,
          isOwnMusic: vc.isOwnMusic || false,
          duration: vc.duration || 0,
          playCount: Number(vc.playCount),
          likeCount: vc.likeCount,
          commentCount: vc.commentCount,
          shareCount: vc.shareCount,
          engagementRate: vc.engagementRate,
          createTime: vc.publishedAt ? Math.floor(vc.publishedAt.getTime() / 1000) : undefined,
          videoUrl: vc.videoUrl || '',
          thumbnailUrl: vc.thumbnailUrl || '',
        })),
        metrics,
      };
    });

    // Run comparison with orchestrator
    const orchestrator = createDeepAnalysisOrchestrator({
      language: language as 'ko' | 'en',
      parallelClassification: true,
    });

    console.log(`[API] Starting comparison for ${accounts.length} accounts...`);

    const result = await orchestrator.analyzeMultipleAccounts(
      accounts,
      (stage, accountId, progress, message) => {
        console.log(`[API] Comparison [${stage}] ${accountId || 'all'} ${progress}% - ${message}`);
      }
    );

    if (!result.success || !result.comparison) {
      return NextResponse.json({
        success: false,
        error: result.errors.join(', ') || 'Comparison failed',
        accountResults: Object.fromEntries(
          Array.from(result.accountResults.entries()).map(([k, v]) => [
            k,
            { success: v.success, errors: v.errors },
          ])
        ),
      });
    }

    // Save comparison report to database
    // Use JSON.parse(JSON.stringify(...)) to strip Zod's index signatures from .passthrough()
    const report = await prisma.comparisonReport.create({
      data: {
        title: `Comparison: ${accounts.map(a => '@' + a.user.uniqueId).join(' vs ')}`,
        language,
        accountCount: accounts.length,
        overallSummary: result.comparison.overallSummary,
        rankings: JSON.parse(JSON.stringify(result.comparison.rankings)),
        significantDifferences: JSON.parse(JSON.stringify(result.comparison.significantDifferences)),
        radarChartData: JSON.parse(JSON.stringify(result.comparison.radarChartData)),
        strategicInsights: JSON.parse(JSON.stringify(result.comparison.strategicInsights)),
        accountRecommendations: JSON.parse(JSON.stringify(result.comparison.accountSpecificRecommendations)),
        competitivePositioning: JSON.parse(JSON.stringify(result.comparison.competitivePositioning)),
        accounts: {
          create: analysisIds.map((analysisId: string) => ({
            analysisId,
          })),
        },
      },
      include: {
        accounts: {
          include: {
            analysis: true,
          },
        },
      },
    });

    console.log(`[API] Comparison completed: ${report.id}`);

    return NextResponse.json({
      success: true,
      reportId: report.id,
      comparison: result.comparison,
      duration: result.totalDuration,
    });
  } catch (error) {
    console.error('[API] Comparison error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Comparison failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deep-analysis/compare?id={reportId}
 *
 * Get a comparison report by ID
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reportId = searchParams.get('id');

  if (!reportId) {
    return NextResponse.json(
      { success: false, error: 'Report ID is required' },
      { status: 400 }
    );
  }

  try {
    const report = await prisma.comparisonReport.findUnique({
      where: { id: reportId },
      include: {
        accounts: {
          include: {
            analysis: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        title: report.title,
        language: report.language,
        accountCount: report.accountCount,
        overallSummary: report.overallSummary,
        rankings: report.rankings,
        significantDifferences: report.significantDifferences,
        radarChartData: report.radarChartData,
        strategicInsights: report.strategicInsights,
        accountRecommendations: report.accountRecommendations,
        competitivePositioning: report.competitivePositioning,
        createdAt: report.createdAt,
        accounts: report.accounts.map(a => ({
          uniqueId: a.analysis.uniqueId,
          nickname: a.analysis.nickname,
          avatarUrl: a.analysis.avatarUrl,
          verified: a.analysis.verified,
          followers: a.analysis.followers,
        })),
      },
    });
  } catch (error) {
    console.error('[API] Get comparison report error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get report',
      },
      { status: 500 }
    );
  }
}
