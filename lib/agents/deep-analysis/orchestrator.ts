/**
 * Deep Analysis Orchestrator
 * ==========================
 * Coordinates multi-agent workflows for comprehensive TikTok account analysis.
 * Manages sequential and parallel execution of classification, metrics, and comparison agents.
 */

import type { AgentContext, AgentResult } from '../types';
import {
  VideoClassifierAgent,
  type VideoClassifierInput,
  type VideoClassifierOutput,
} from './video-classifier';
import {
  AccountMetricsAgent,
  type AccountMetricsInput,
  type AccountMetricsOutput,
} from './account-metrics';
import {
  ComparativeAnalysisAgent,
  type ComparativeAnalysisInput,
  type ComparativeAnalysisOutput,
} from './comparative-analysis';
import type {
  DeepAnalysisVideo,
  DeepAnalysisUser,
  AccountMetrics,
} from '@/lib/deep-analysis/types';
import { TIKTOK_BENCHMARKS } from '@/lib/deep-analysis/tiktok-service';

// =============================================================================
// Types
// =============================================================================

export type DeepAnalysisStage = 'classify' | 'metrics' | 'compare';

export interface DeepAnalysisConfig {
  stages: DeepAnalysisStage[];
  parallelClassification: boolean;
  maxRetries: number;
  timeoutMs: number;
  language: 'ko' | 'en';
}

export interface AccountData {
  user: DeepAnalysisUser;
  videos: DeepAnalysisVideo[];
  metrics: AccountMetrics;
}

export interface SingleAccountAnalysisInput {
  account: AccountData;
}

export interface SingleAccountAnalysisResult {
  success: boolean;
  classification?: VideoClassifierOutput;
  metrics?: AccountMetricsOutput;
  duration: number;
  errors: string[];
}

export interface ComparisonAnalysisInput {
  accounts: Array<{
    account: AccountData;
    classification: VideoClassifierOutput;
    metrics: AccountMetricsOutput;
  }>;
}

export interface ComparisonAnalysisResult {
  success: boolean;
  comparison?: ComparativeAnalysisOutput;
  duration: number;
  errors: string[];
}

export interface FullAnalysisResult {
  success: boolean;
  accountResults: Map<string, SingleAccountAnalysisResult>;
  comparison?: ComparativeAnalysisOutput;
  totalDuration: number;
  errors: string[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: DeepAnalysisConfig = {
  stages: ['classify', 'metrics', 'compare'],
  parallelClassification: true,
  maxRetries: 3, // Increased for better AI response resilience
  timeoutMs: 600000, // 10 minutes (increased for retries and complex analysis)
  language: 'ko',
};

// =============================================================================
// Progress Callback Types
// =============================================================================

export type ProgressCallback = (
  stage: DeepAnalysisStage,
  accountId: string | null,
  progress: number,
  message: string
) => void;

// =============================================================================
// Orchestrator Implementation
// =============================================================================

export class DeepAnalysisOrchestrator {
  private config: DeepAnalysisConfig;
  private videoClassifier: VideoClassifierAgent;
  private accountMetrics: AccountMetricsAgent;
  private comparativeAnalysis: ComparativeAnalysisAgent;
  private context: AgentContext;

  constructor(config: Partial<DeepAnalysisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.videoClassifier = new VideoClassifierAgent();
    this.accountMetrics = new AccountMetricsAgent();
    this.comparativeAnalysis = new ComparativeAnalysisAgent();
    this.context = this.initializeContext();
  }

  /**
   * Initialize the shared context
   */
  private initializeContext(): AgentContext {
    return {
      workflow: {
        artistName: 'Deep Analysis',
        platform: 'tiktok',
        language: this.config.language,
        sessionId: `deep_analysis_${Date.now()}`,
        startedAt: new Date(),
      },
    };
  }

  /**
   * Analyze a single account (classification + metrics)
   */
  async analyzeSingleAccount(
    input: SingleAccountAnalysisInput,
    onProgress?: ProgressCallback
  ): Promise<SingleAccountAnalysisResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const { account } = input;
    const accountId = account.user.uniqueId;

    let classification: VideoClassifierOutput | undefined;
    let metrics: AccountMetricsOutput | undefined;

    // Stage 1: Video Classification
    onProgress?.('classify', accountId, 0, `Classifying ${account.videos.length} videos...`);

    try {
      const classifyInput: VideoClassifierInput = {
        videos: account.videos.map(v => ({
          id: v.id,
          description: v.description || '',
          hashtags: v.hashtags || [],
          musicTitle: v.musicTitle,
          duration: v.duration,
          engagementRate: v.engagementRate,
          playCount: v.playCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          shareCount: v.shareCount,
        })),
        accountInfo: {
          nickname: account.user.nickname,
          uniqueId: account.user.uniqueId,
          verified: account.user.verified,
          followers: account.user.followers,
        },
        language: this.config.language,
      };

      const classifyResult = await this.executeWithRetry(
        () => this.videoClassifier.execute(classifyInput, this.context),
        'video-classifier'
      );

      if (classifyResult.success && classifyResult.data) {
        classification = classifyResult.data;
        onProgress?.('classify', accountId, 100, 'Classification complete');
      } else {
        errors.push(`Classification failed: ${classifyResult.error}`);
        onProgress?.('classify', accountId, 100, `Classification failed: ${classifyResult.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown classification error';
      errors.push(errorMsg);
      onProgress?.('classify', accountId, 100, `Classification error: ${errorMsg}`);
    }

    // Stage 2: Account Metrics Analysis
    onProgress?.('metrics', accountId, 0, 'Analyzing account metrics...');

    try {
      const tierInfo = this.getAccountTier(account.user.followers);

      const metricsInput: AccountMetricsInput = {
        account: {
          uniqueId: account.user.uniqueId,
          nickname: account.user.nickname,
          verified: account.user.verified,
          followers: account.user.followers,
          following: account.user.following || 0,
          totalLikes: account.user.totalLikes || 0,
          totalVideos: account.user.videos || account.videos.length,
        },
        metrics: {
          totalVideos: account.videos.length,
          analyzedVideos: account.videos.length,
          totalViews: account.metrics.totalViews,
          totalLikes: account.metrics.totalLikes,
          totalComments: account.metrics.totalComments,
          totalShares: account.metrics.totalShares,
          avgEngagementRate: account.metrics.avgEngagementRate,
          medianEngagementRate: account.metrics.medianEngagementRate,
          engagementRateStdDev: account.metrics.engagementRateStdDev,
          topPerformingRate: account.metrics.topPerformingRate,
          bottomPerformingRate: account.metrics.bottomPerformingRate,
          avgViews: account.metrics.avgViews,
          avgLikes: account.metrics.avgLikes,
          avgComments: account.metrics.avgComments,
          avgShares: account.metrics.avgShares,
          avgDuration: account.metrics.avgDuration,
          avgHashtagCount: account.metrics.avgHashtagCount,
          ownMusicPercentage: account.metrics.ownMusicPercentage,
          postsPerWeek: account.metrics.postsPerWeek,
          mostActiveDay: account.metrics.mostActiveDay,
          mostActiveHour: account.metrics.mostActiveHour,
        },
        categoryDistribution: classification?.categoryDistribution,
        benchmarks: {
          industryAvgEngagement: TIKTOK_BENCHMARKS.avgEngagementRate,
          tierAvgEngagement: tierInfo.avgEngagement,
          tierAvgViews: tierInfo.avgViews,
          tier: tierInfo.name,
        },
        language: this.config.language,
      };

      const metricsResult = await this.executeWithRetry(
        () => this.accountMetrics.execute(metricsInput, this.context),
        'account-metrics'
      );

      if (metricsResult.success && metricsResult.data) {
        metrics = metricsResult.data;
        onProgress?.('metrics', accountId, 100, 'Metrics analysis complete');
      } else {
        errors.push(`Metrics analysis failed: ${metricsResult.error}`);
        onProgress?.('metrics', accountId, 100, `Metrics failed: ${metricsResult.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown metrics error';
      errors.push(errorMsg);
      onProgress?.('metrics', accountId, 100, `Metrics error: ${errorMsg}`);
    }

    return {
      success: errors.length === 0 && !!classification && !!metrics,
      classification,
      metrics,
      duration: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Analyze multiple accounts and generate comparison
   */
  async analyzeMultipleAccounts(
    accounts: AccountData[],
    onProgress?: ProgressCallback
  ): Promise<FullAnalysisResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const accountResults = new Map<string, SingleAccountAnalysisResult>();

    if (accounts.length < 2 || accounts.length > 10) {
      return {
        success: false,
        accountResults,
        totalDuration: Date.now() - startTime,
        errors: ['Comparison requires 2-10 accounts'],
      };
    }

    // Stage 1 & 2: Analyze each account (parallel or sequential)
    if (this.config.parallelClassification) {
      const analysisPromises = accounts.map(account =>
        this.analyzeSingleAccount({ account }, onProgress)
          .then(result => ({ uniqueId: account.user.uniqueId, result }))
      );

      const results = await Promise.all(analysisPromises);
      for (const { uniqueId, result } of results) {
        accountResults.set(uniqueId, result);
        if (!result.success) {
          errors.push(...result.errors.map(e => `[${uniqueId}] ${e}`));
        }
      }
    } else {
      for (const account of accounts) {
        const result = await this.analyzeSingleAccount({ account }, onProgress);
        accountResults.set(account.user.uniqueId, result);
        if (!result.success) {
          errors.push(...result.errors.map(e => `[${account.user.uniqueId}] ${e}`));
        }
      }
    }

    // Check if we have enough successful analyses for comparison
    const successfulAnalyses = Array.from(accountResults.entries())
      .filter(([, r]) => r.success && r.classification && r.metrics);

    if (successfulAnalyses.length < 2) {
      return {
        success: false,
        accountResults,
        totalDuration: Date.now() - startTime,
        errors: [...errors, 'Not enough successful analyses for comparison'],
      };
    }

    // Stage 3: Comparative Analysis
    onProgress?.('compare', null, 0, `Comparing ${successfulAnalyses.length} accounts...`);

    let comparison: ComparativeAnalysisOutput | undefined;

    try {
      const comparisonInput: ComparativeAnalysisInput = {
        accounts: successfulAnalyses.map(([uniqueId, result]) => {
          const account = accounts.find(a => a.user.uniqueId === uniqueId)!;
          return {
            uniqueId,
            nickname: account.user.nickname,
            verified: account.user.verified,
            followers: account.user.followers,
            metrics: {
              avgEngagementRate: account.metrics.avgEngagementRate,
              medianEngagementRate: account.metrics.medianEngagementRate,
              avgViews: account.metrics.avgViews,
              avgLikes: account.metrics.avgLikes,
              avgComments: account.metrics.avgComments,
              avgShares: account.metrics.avgShares,
              postsPerWeek: account.metrics.postsPerWeek,
              ownMusicPercentage: account.metrics.ownMusicPercentage,
              totalVideos: account.videos.length,
              analyzedVideos: account.videos.length,
            },
            topCategories: result.classification?.insights.dominantCategory
              ? [result.classification.insights.dominantCategory]
              : undefined,
            performanceScore: result.metrics?.performanceScore,
          };
        }),
        benchmarks: {
          industryAvgEngagement: TIKTOK_BENCHMARKS.avgEngagementRate,
        },
        language: this.config.language,
      };

      const comparisonResult = await this.executeWithRetry(
        () => this.comparativeAnalysis.execute(comparisonInput, this.context),
        'comparative-analysis'
      );

      if (comparisonResult.success && comparisonResult.data) {
        comparison = comparisonResult.data;
        onProgress?.('compare', null, 100, 'Comparison complete');
      } else {
        errors.push(`Comparison failed: ${comparisonResult.error}`);
        onProgress?.('compare', null, 100, `Comparison failed: ${comparisonResult.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown comparison error';
      errors.push(errorMsg);
      onProgress?.('compare', null, 100, `Comparison error: ${errorMsg}`);
    }

    return {
      success: !!comparison && errors.length === 0,
      accountResults,
      comparison,
      totalDuration: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Run comparison only (when accounts are already analyzed)
   */
  async runComparisonOnly(
    input: ComparisonAnalysisInput,
    onProgress?: ProgressCallback
  ): Promise<ComparisonAnalysisResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    if (input.accounts.length < 2 || input.accounts.length > 10) {
      return {
        success: false,
        duration: Date.now() - startTime,
        errors: ['Comparison requires 2-10 accounts'],
      };
    }

    onProgress?.('compare', null, 0, `Comparing ${input.accounts.length} accounts...`);

    try {
      const comparisonInput: ComparativeAnalysisInput = {
        accounts: input.accounts.map(({ account, classification, metrics }) => ({
          uniqueId: account.user.uniqueId,
          nickname: account.user.nickname,
          verified: account.user.verified,
          followers: account.user.followers,
          metrics: {
            avgEngagementRate: account.metrics.avgEngagementRate,
            medianEngagementRate: account.metrics.medianEngagementRate,
            avgViews: account.metrics.avgViews,
            avgLikes: account.metrics.avgLikes,
            avgComments: account.metrics.avgComments,
            avgShares: account.metrics.avgShares,
            postsPerWeek: account.metrics.postsPerWeek,
            ownMusicPercentage: account.metrics.ownMusicPercentage,
            totalVideos: account.videos.length,
            analyzedVideos: account.videos.length,
          },
          topCategories: classification.insights.dominantCategory
            ? [classification.insights.dominantCategory]
            : undefined,
          performanceScore: metrics.performanceScore,
        })),
        benchmarks: {
          industryAvgEngagement: TIKTOK_BENCHMARKS.avgEngagementRate,
        },
        language: this.config.language,
      };

      const result = await this.executeWithRetry(
        () => this.comparativeAnalysis.execute(comparisonInput, this.context),
        'comparative-analysis'
      );

      if (result.success && result.data) {
        onProgress?.('compare', null, 100, 'Comparison complete');
        return {
          success: true,
          comparison: result.data,
          duration: Date.now() - startTime,
          errors: [],
        };
      } else {
        errors.push(result.error || 'Unknown comparison error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
    }

    onProgress?.('compare', null, 100, `Comparison failed: ${errors.join(', ')}`);

    return {
      success: false,
      duration: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<AgentResult<T>>,
    agentId: string
  ): Promise<AgentResult<T>> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        if (result.success) {
          return result;
        }
        lastError = result.error;
        console.warn(`[DeepAnalysis] ${agentId} attempt ${attempt + 1} failed:`, lastError);
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`[DeepAnalysis] ${agentId} attempt ${attempt + 1} error:`, lastError);
      }

      if (attempt < this.config.maxRetries) {
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    return {
      success: false,
      error: lastError || 'Max retries exceeded',
      metadata: {
        agentId,
        model: 'gemini-2.5-flash',
        tokenUsage: { input: 0, output: 0, total: 0 },
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get account tier based on follower count
   */
  private getAccountTier(followers: number): { name: string; avgEngagement: number; avgViews: number } {
    if (followers >= 10000000) {
      return { name: 'mega', avgEngagement: 3.5, avgViews: 500000 };
    } else if (followers >= 1000000) {
      return { name: 'macro', avgEngagement: 5.0, avgViews: 100000 };
    } else if (followers >= 100000) {
      return { name: 'mid-tier', avgEngagement: 6.5, avgViews: 30000 };
    } else if (followers >= 10000) {
      return { name: 'micro', avgEngagement: 8.0, avgViews: 8000 };
    } else {
      return { name: 'nano', avgEngagement: 10.0, avgViews: 2000 };
    }
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): DeepAnalysisConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DeepAnalysisConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.language) {
      this.context.workflow.language = updates.language;
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createDeepAnalysisOrchestrator(
  config?: Partial<DeepAnalysisConfig>
): DeepAnalysisOrchestrator {
  return new DeepAnalysisOrchestrator(config);
}
