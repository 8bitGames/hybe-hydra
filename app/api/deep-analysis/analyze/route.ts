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
import {
  setInMemoryCache,
  saveToFileCache,
  getCachedData,
  loadFromFileCache,
} from '@/lib/deep-analysis/analysis-cache';

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

    // Check if analysis already exists and is recent (< 24 hours) with same language
    const existingAnalysis = await prisma.accountAnalysis.findFirst({
      where: {
        uniqueId,
        analysisLanguage: language, // Must match requested language
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

    // Check for cached data first (avoids re-fetching on retry)
    const cachedData = getCachedData(uniqueId);
    let cachedAccountData = cachedData?.accountData;

    // If not in memory, try file cache
    if (!cachedAccountData) {
      const fileCached = await loadFromFileCache(uniqueId, 'account_data');
      if (fileCached) {
        cachedAccountData = fileCached as AccountData;
        console.log(`[API] Loaded cached TikTok data for ${uniqueId} from file cache`);
      }
    } else {
      console.log(`[API] Using memory-cached TikTok data for ${uniqueId}`);
    }

    // Fetch account data (or use cached)
    let result: Awaited<ReturnType<typeof fetchAccountForAnalysis>>;

    if (cachedAccountData) {
      // Use cached data - construct result object from cache
      console.log(`[API] Using cached data for ${uniqueId} (${cachedAccountData.videos.length} videos)`);
      result = {
        success: true,
        user: {
          id: cachedAccountData.user.id,
          uniqueId: cachedAccountData.user.uniqueId,
          nickname: cachedAccountData.user.nickname,
          avatarUrl: cachedAccountData.user.avatarUrl,
          signature: cachedAccountData.user.signature,
          verified: cachedAccountData.user.verified,
          followers: cachedAccountData.user.followers,
          following: cachedAccountData.user.following,
          likes: cachedAccountData.user.likes,
          videos: cachedAccountData.user.videos,
          secUid: cachedAccountData.user.secUid,
        },
        videos: cachedAccountData.videos.map(v => ({
          id: v.id,
          description: v.description,
          hashtags: v.hashtags,
          musicTitle: v.musicTitle,
          musicId: v.musicId,
          isOwnMusic: v.isOwnMusic,
          duration: v.duration,
          author: {
            uniqueId: cachedAccountData.user.uniqueId,
            nickname: cachedAccountData.user.nickname,
          },
          stats: {
            playCount: v.playCount,
            likeCount: v.likeCount,
            commentCount: v.commentCount,
            shareCount: v.shareCount,
          },
          engagementRate: v.engagementRate,
          createTime: v.createTime,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
        })),
        totalFetched: cachedAccountData.videos.length,
      };
    } else {
      // Fetch fresh data from TikTok
      console.log(`[API] Fetching account data for ${uniqueId}...`);
      result = await fetchAccountForAnalysis(uniqueId, videoCount);
    }

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

    // Cache the raw TikTok data immediately (prevents data loss on AI parsing failures)
    const accountDataForCache: AccountData = {
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

    // Save to memory cache and file cache for persistence
    setInMemoryCache(uniqueId, { accountData: accountDataForCache });
    await saveToFileCache(uniqueId, 'account_data', accountDataForCache);
    console.log(`[API] Cached TikTok data for ${uniqueId} (${result.videos.length} videos)`);

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
      (stage, _accountId, progress, message) => {
        console.log(`[API] ${uniqueId} [${stage}] ${progress}% - ${message}`);
      }
    );

    // Prepare AI insights data
    // Use JSON.parse(JSON.stringify(...)) to strip Zod's index signatures
    // and convert to plain JSON compatible with Prisma's InputJsonValue
    const aiInsights = aiResult.success && aiResult.metrics
      ? JSON.parse(JSON.stringify({
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
        }))
      : null;

    // Prepare content mix data from classification
    // Use JSON.parse(JSON.stringify(...)) to strip Zod's index signatures
    const contentMixMetrics = aiResult.success && aiResult.classification
      ? JSON.parse(JSON.stringify({
          categoryDistribution: aiResult.classification.categoryDistribution,
          contentTypeDistribution: aiResult.classification.contentTypeDistribution,
          dominantCategory: aiResult.classification.insights.dominantCategory,
          dominantContentType: aiResult.classification.insights.dominantContentType,
          contentDiversity: aiResult.classification.insights.contentDiversity,
        }))
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

    const videoClassifications = result.videos
      .filter(video => video.id) // Filter out videos without ID
      .map((video) => {
        const aiClassification = classificationMap.get(video.id);

        // Safely extract secondary categories (handle undefined/null)
        const secondaryCategories = aiClassification?.secondaryCategories;
        const safeSecondaryCategories = Array.isArray(secondaryCategories) ? secondaryCategories : [];

        // Build aiCategories safely
        const aiCategories = aiClassification
          ? [aiClassification.primaryCategory, ...safeSecondaryCategories].filter((c): c is string => typeof c === 'string' && c.length > 0)
          : [];

        // Ensure all required number fields are valid (not NaN, not null)
        const safePlayCount = Number(video.stats?.playCount) || 0;
        const safeLikeCount = Number(video.stats?.likeCount) || 0;
        const safeCommentCount = Number(video.stats?.commentCount) || 0;
        const safeShareCount = Number(video.stats?.shareCount) || 0;
        const safeEngagementRate = Number(video.engagementRate) || 0;

        return {
          analysisId,
          tiktokVideoId: String(video.id),
          videoUrl: video.videoUrl || `https://www.tiktok.com/video/${video.id}`,
          thumbnailUrl: video.thumbnailUrl || null,
          description: video.description || null,
          playCount: BigInt(Math.max(0, Math.floor(safePlayCount))),
          likeCount: Math.max(0, Math.floor(safeLikeCount)),
          commentCount: Math.max(0, Math.floor(safeCommentCount)),
          shareCount: Math.max(0, Math.floor(safeShareCount)),
          engagementRate: Number.isFinite(safeEngagementRate) ? safeEngagementRate : 0,
          aiCategories,
          aiConfidence: Number(aiClassification?.confidence) || 0,
          reasoning: aiClassification?.reasoning || null,
          customTags: [] as string[],
          musicTitle: video.musicTitle || null,
          musicId: video.musicId || null,
          isOwnMusic: Boolean(video.isOwnMusic),
          publishedAt: video.createTime ? new Date(video.createTime * 1000) : null,
          duration: video.duration || null,
          // Store additional AI data in contentAnalysis JSON field (nullable)
          // Use Prisma.DbNull for database NULL, not Prisma.JsonNull (which is JSON null value)
          contentAnalysis: aiClassification
            ? { contentType: aiClassification.contentType || 'unknown', engagementPotential: aiClassification.engagementPotential || 'medium' }
            : Prisma.DbNull,
        };
      });

    // Validate each record before insertion
    const validRecords: typeof videoClassifications = [];
    const invalidRecords: { index: number; reason: string; data: Record<string, unknown> }[] = [];

    for (let i = 0; i < videoClassifications.length; i++) {
      const record = videoClassifications[i];
      const issues: string[] = [];

      // Check all required fields
      if (!record.analysisId) issues.push('analysisId is empty');
      if (!record.tiktokVideoId) issues.push('tiktokVideoId is empty');
      if (!record.videoUrl) issues.push('videoUrl is empty');
      if (record.playCount === null || record.playCount === undefined) issues.push('playCount is null/undefined');
      if (record.likeCount === null || record.likeCount === undefined) issues.push('likeCount is null/undefined');
      if (record.commentCount === null || record.commentCount === undefined) issues.push('commentCount is null/undefined');
      if (record.shareCount === null || record.shareCount === undefined) issues.push('shareCount is null/undefined');
      if (record.engagementRate === null || record.engagementRate === undefined || !Number.isFinite(record.engagementRate)) {
        issues.push(`engagementRate is invalid: ${record.engagementRate}`);
      }
      if (!Array.isArray(record.aiCategories)) issues.push('aiCategories is not an array');
      if (!Array.isArray(record.customTags)) issues.push('customTags is not an array');

      if (issues.length > 0) {
        invalidRecords.push({
          index: i,
          reason: issues.join(', '),
          data: {
            analysisId: record.analysisId,
            tiktokVideoId: record.tiktokVideoId,
            videoUrl: record.videoUrl?.substring(0, 30),
            playCount: String(record.playCount),
            likeCount: record.likeCount,
            commentCount: record.commentCount,
            shareCount: record.shareCount,
            engagementRate: record.engagementRate,
            aiCategories: record.aiCategories,
            customTags: record.customTags,
          },
        });
      } else {
        validRecords.push(record);
      }
    }

    // Log validation results
    console.log(`[API] Video classifications validation: ${validRecords.length} valid, ${invalidRecords.length} invalid`);
    if (invalidRecords.length > 0) {
      console.error(`[API] Invalid records:`, JSON.stringify(invalidRecords, null, 2));
    }

    // Log sample of valid record
    if (validRecords.length > 0) {
      const sample = validRecords[0];
      console.log(`[API] Valid record sample:`, JSON.stringify({
        analysisId: sample.analysisId,
        tiktokVideoId: sample.tiktokVideoId,
        playCount: String(sample.playCount),
        likeCount: sample.likeCount,
        aiCategories: sample.aiCategories,
        customTags: sample.customTags,
      }, null, 2));
    }

    if (validRecords.length === 0) {
      console.error(`[API] No valid video classifications to save!`);
    } else {
      console.log(`[API] Saving ${validRecords.length} video classifications...`);

      // Try individual inserts to identify problematic records
      let successCount = 0;
      let failCount = 0;

      for (const record of validRecords) {
        try {
          await prisma.videoClassification.create({
            data: record,
          });
          successCount++;
        } catch (insertError) {
          failCount++;
          console.error(`[API] Failed to insert video ${record.tiktokVideoId}:`, insertError);
          console.error(`[API] Failed record data:`, JSON.stringify({
            ...record,
            playCount: String(record.playCount),
          }, null, 2));
          // Continue with other records
        }
      }

      console.log(`[API] Video classification insert results: ${successCount} success, ${failCount} failed`);
    }

    console.log(`[API] Analysis completed for ${uniqueId}: ${result.totalFetched} videos, AI: ${aiResult.success ? 'success' : 'failed'}`);
  } catch (error) {
    console.error(`[API] Analysis processing failed for ${uniqueId}:`, error);
    await prisma.accountAnalysis.update({
      where: { id: analysisId },
      data: { status: 'FAILED' },
    });
  }
}
