import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  fetchAccountForAnalysis,
  calculateAccountMetrics,
} from '@/lib/deep-analysis';
import {
  createDeepAnalysisOrchestrator,
  type AccountData,
} from '@/lib/agents/deep-analysis';

/**
 * POST /api/deep-analysis/analyze
 *
 * Start analysis for a TikTok account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uniqueId, videoCount = 100, language = 'ko' } = body;

    if (!uniqueId) {
      return NextResponse.json(
        { success: false, error: 'uniqueId is required' },
        { status: 400 }
      );
    }

    // Check if analysis already exists and is recent (< 24 hours)
    const existingAnalysis = await prisma.accountAnalysis.findFirst({
      where: {
        uniqueId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        status: 'COMPLETED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingAnalysis) {
      return NextResponse.json({
        success: true,
        analysisId: existingAnalysis.id,
        cached: true,
      });
    }

    // Create pending analysis record
    const analysis = await prisma.accountAnalysis.create({
      data: {
        tiktokUserId: '',
        uniqueId,
        nickname: '',
        followers: 0,
        following: 0,
        totalLikes: 0,
        totalVideos: 0,
        videosAnalyzed: 0,
        analysisLanguage: language,
        status: 'PENDING',
      },
    });

    // Start async analysis (in production, this would be a background job)
    processAnalysis(analysis.id, uniqueId, videoCount, language).catch((error) => {
      console.error('[API] Analysis processing error:', error);
    });

    return NextResponse.json({
      success: true,
      analysisId: analysis.id,
      status: 'PROCESSING',
    });
  } catch (error) {
    console.error('[API] Deep analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Process analysis in the background
 */
async function processAnalysis(
  analysisId: string,
  uniqueId: string,
  videoCount: number,
  language: string
) {
  try {
    // Update status to processing
    await prisma.accountAnalysis.update({
      where: { id: analysisId },
      data: { status: 'PROCESSING' },
    });

    // Fetch account data
    console.log(`[API] Fetching account data for ${uniqueId}...`);
    const result = await fetchAccountForAnalysis(uniqueId, videoCount);

    if (!result.success || !result.user) {
      console.error(`[API] TikTok fetch failed for ${uniqueId}:`, {
        success: result.success,
        hasUser: !!result.user,
        error: result.error,
        videosCount: result.videos?.length || 0,
      });
      await prisma.accountAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
        },
      });
      return;
    }
    console.log(`[API] Fetched ${result.videos.length} videos for ${uniqueId}`);

    // Calculate metrics
    const metrics = calculateAccountMetrics(result.videos);

    // Prepare account data for AI analysis
    const accountData: AccountData = {
      user: {
        id: result.user.id,
        uniqueId: result.user.uniqueId,
        nickname: result.user.nickname,
        avatarUrl: result.user.avatarUrl || '',
        signature: result.user.signature || '',
        verified: result.user.verified,
        followers: result.user.followers,
        following: result.user.following,
        likes: result.user.likes,
        videos: result.user.videos,
        secUid: result.user.secUid,
        totalLikes: result.user.likes,
      },
      videos: result.videos.map(v => ({
        id: v.id,
        description: v.description || '',
        hashtags: v.hashtags || [],
        musicTitle: v.musicTitle,
        musicId: v.musicId,
        isOwnMusic: v.isOwnMusic,
        duration: v.duration || 0,
        playCount: v.stats.playCount,
        likeCount: v.stats.likeCount,
        commentCount: v.stats.commentCount,
        shareCount: v.stats.shareCount,
        engagementRate: v.engagementRate,
        createTime: v.createTime,
        videoUrl: v.videoUrl || '',
        thumbnailUrl: v.thumbnailUrl || '',
      })),
      metrics,
    };

    // Run AI analysis with orchestrator
    const orchestrator = createDeepAnalysisOrchestrator({
      language: language as 'ko' | 'en',
      parallelClassification: true,
    });

    console.log(`[API] Starting AI analysis for ${uniqueId}...`);

    const aiResult = await orchestrator.analyzeSingleAccount(
      { account: accountData },
      (stage, accountId, progress, message) => {
        console.log(`[API] ${uniqueId} [${stage}] ${progress}% - ${message}`);
      }
    );

    // Prepare AI insights data
    const aiInsights = aiResult.success && aiResult.metrics
      ? {
          summary: aiResult.metrics.summary,
          performanceScore: aiResult.metrics.performanceScore,
          performanceTier: aiResult.metrics.performanceTier,
          strengths: aiResult.metrics.strengths,
          weaknesses: aiResult.metrics.weaknesses,
          contentStrategy: aiResult.metrics.contentStrategy,
          postingStrategy: aiResult.metrics.postingStrategy,
          growthPotential: aiResult.metrics.growthPotential,
          recommendations: aiResult.metrics.recommendations,
          benchmarkComparison: aiResult.metrics.benchmarkComparison,
        }
      : null;

    // Prepare content mix data from classification
    const contentMixMetrics = aiResult.success && aiResult.classification
      ? {
          categoryDistribution: aiResult.classification.categoryDistribution,
          contentTypeDistribution: aiResult.classification.contentTypeDistribution,
          dominantCategory: aiResult.classification.insights.dominantCategory,
          dominantContentType: aiResult.classification.insights.dominantContentType,
          contentDiversity: aiResult.classification.insights.contentDiversity,
        }
      : null;

    // Update analysis with user info, metrics, and AI insights
    await prisma.accountAnalysis.update({
      where: { id: analysisId },
      data: {
        tiktokUserId: result.user.id,
        nickname: result.user.nickname,
        avatarUrl: result.user.avatarUrl,
        signature: result.user.signature,
        verified: result.user.verified,
        followers: result.user.followers,
        following: result.user.following,
        totalLikes: result.user.likes,
        totalVideos: result.user.videos,
        videosAnalyzed: result.totalFetched,
        basicMetrics: {
          totalVideos: metrics.totalVideos,
          analyzedVideos: metrics.analyzedVideos,
          totalViews: metrics.totalViews,
          totalLikes: metrics.totalLikes,
          totalComments: metrics.totalComments,
          totalShares: metrics.totalShares,
          avgViews: metrics.avgViews,
          avgLikes: metrics.avgLikes,
          avgComments: metrics.avgComments,
          avgShares: metrics.avgShares,
        },
        engagementMetrics: {
          avgEngagementRate: metrics.avgEngagementRate,
          medianEngagementRate: metrics.medianEngagementRate,
          engagementRateStdDev: metrics.engagementRateStdDev,
          topPerformingRate: metrics.topPerformingRate,
          bottomPerformingRate: metrics.bottomPerformingRate,
        },
        postingMetrics: {
          postsPerWeek: metrics.postsPerWeek,
          mostActiveDay: metrics.mostActiveDay,
          mostActiveHour: metrics.mostActiveHour,
          avgDuration: metrics.avgDuration,
          avgHashtagCount: metrics.avgHashtagCount,
          ownMusicPercentage: metrics.ownMusicPercentage,
        },
        contentMixMetrics: contentMixMetrics ?? undefined,
        aiInsights: aiInsights ?? undefined,
        status: 'COMPLETED',
      },
    });

    // Save video classifications with AI categories
    const classificationMap = new Map(
      aiResult.classification?.classifications.map(c => [c.videoId, c]) || []
    );

    const videoClassifications = result.videos.map((video) => {
      const aiClassification = classificationMap.get(video.id);
      return {
        analysisId,
        tiktokVideoId: video.id,
        videoUrl: video.videoUrl || `https://www.tiktok.com/video/${video.id}`,
        thumbnailUrl: video.thumbnailUrl,
        description: video.description,
        playCount: BigInt(video.stats.playCount),
        likeCount: video.stats.likeCount,
        commentCount: video.stats.commentCount,
        shareCount: video.stats.shareCount,
        engagementRate: video.engagementRate,
        aiCategories: aiClassification
          ? [aiClassification.primaryCategory, ...aiClassification.secondaryCategories]
          : [],
        aiConfidence: aiClassification?.confidence || 0,
        reasoning: aiClassification?.reasoning,
        customTags: [],
        musicTitle: video.musicTitle,
        musicId: video.musicId,
        isOwnMusic: video.isOwnMusic,
        publishedAt: video.createTime ? new Date(video.createTime * 1000) : null,
        duration: video.duration,
        // Store additional AI data in contentAnalysis JSON field
        contentAnalysis: aiClassification ? {
          contentType: aiClassification.contentType,
          engagementPotential: aiClassification.engagementPotential,
        } : Prisma.JsonNull,
      };
    });

    await prisma.videoClassification.createMany({
      data: videoClassifications,
    });

    console.log(`[API] Analysis completed for ${uniqueId}: ${result.totalFetched} videos, AI: ${aiResult.success ? 'success' : 'failed'}`);
  } catch (error) {
    console.error(`[API] Analysis processing failed for ${uniqueId}:`, error);
    await prisma.accountAnalysis.update({
      where: { id: analysisId },
      data: { status: 'FAILED' },
    });
  }
}
