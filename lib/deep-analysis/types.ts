/**
 * Deep Analysis Types
 *
 * Type definitions for the Deep Analysis feature.
 */

import { DeepAnalysisStatus } from '@prisma/client';

// =============================================================================
// Core Data Types (for Orchestrator)
// =============================================================================

export interface DeepAnalysisUser {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarUrl: string;
  signature: string;
  verified: boolean;
  followers: number;
  following: number;
  likes: number;
  videos: number;
  secUid: string;
  totalLikes?: number;
}

export interface DeepAnalysisVideo {
  id: string;
  description: string;
  hashtags: string[];
  musicTitle?: string;
  musicId?: string;
  isOwnMusic: boolean;
  duration: number;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  engagementRate: number;
  createTime?: number;
  videoUrl: string;
  thumbnailUrl: string;
}

export interface AccountMetrics {
  totalVideos: number;
  analyzedVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgEngagementRate: number;
  medianEngagementRate: number;
  engagementRateStdDev: number;
  topPerformingRate: number;
  bottomPerformingRate: number;
  postsPerWeek: number;
  mostActiveDay?: string;
  mostActiveHour?: number;
  avgDuration: number;
  avgHashtagCount: number;
  ownMusicPercentage: number;
}

// =============================================================================
// Database-aligned Types
// =============================================================================

export interface AccountAnalysisData {
  id: string;
  tiktokUserId: string;
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  signature?: string;
  verified: boolean;
  followers: bigint | number;
  following: number;
  totalLikes: bigint | number;
  totalVideos: number;
  videosAnalyzed: number;
  analysisLanguage: string;
  status: DeepAnalysisStatus;
  basicMetrics?: BasicMetrics;
  engagementMetrics?: EngagementMetrics;
  contentMixMetrics?: ContentMixMetrics;
  postingMetrics?: PostingMetrics;
  aiInsights?: AIInsights;
  recommendations?: string[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface VideoClassificationData {
  id: string;
  analysisId: string;
  tiktokVideoId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  description?: string;
  playCount: bigint | number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  engagementRate: number;
  aiCategories: string[];
  aiConfidence: number;
  customTags: string[];
  reasoning?: string;
  musicTitle?: string;
  musicId?: string;
  isOwnMusic: boolean;
  publishedAt?: Date;
  duration?: number;
  contentAnalysis?: VideoContentAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComparisonReportData {
  id: string;
  title?: string;
  language: string;
  accountIds: string[];
  radarChartData?: RadarChartData;
  barChartData?: BarChartData;
  rankingTable?: RankingTableData;
  significantDiffs?: SignificantDiff[];
  benchmarkComparison?: BenchmarkComparison;
  aiComparison?: AIComparisonInsights;
  createdAt: Date;
}

// =============================================================================
// Metrics Types
// =============================================================================

export interface BasicMetrics {
  totalVideos: number;
  analyzedVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
}

export interface EngagementMetrics {
  avgEngagementRate: number;
  medianEngagementRate: number;
  engagementRateStdDev: number;
  topPerformingRate: number;
  bottomPerformingRate: number;
  engagementTrend: 'improving' | 'declining' | 'stable';
  viralVideoCount: number; // Videos with > 2x average engagement
  consistencyScore: number; // 0-100, lower std dev = higher score
}

export interface ContentMixMetrics {
  categoryDistribution: CategoryDistribution[];
  topCategories: string[];
  avgCategoryCount: number;
  ownMusicPercentage: number;
  hashtagUsage: {
    avgPerVideo: number;
    topHashtags: HashtagUsage[];
  };
  durationDistribution: DurationBucket[];
  avgDuration: number;
}

export interface PostingMetrics {
  postsPerWeek: number;
  mostActiveDay: string;
  mostActiveHour: number;
  postingConsistency: number; // 0-100
  dayDistribution: DayDistribution[];
  hourDistribution: HourDistribution[];
  recentActivityScore: number; // Based on last 30 days
}

// =============================================================================
// Content Analysis Types
// =============================================================================

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
  avgEngagement: number;
}

export interface HashtagUsage {
  hashtag: string;
  count: number;
  avgEngagement: number;
}

export interface DurationBucket {
  range: string; // e.g., "0-15s", "15-30s", "30-60s", "60s+"
  count: number;
  percentage: number;
  avgEngagement: number;
}

export interface DayDistribution {
  day: string;
  count: number;
  percentage: number;
  avgEngagement: number;
}

export interface HourDistribution {
  hour: number;
  count: number;
  percentage: number;
  avgEngagement: number;
}

export interface VideoContentAnalysis {
  primaryCategory: string;
  secondaryCategories: string[];
  contentType: 'performance' | 'behind-the-scenes' | 'promotional' | 'trend' | 'other';
  mood: string;
  visualStyle: string;
  hasText: boolean;
  hasFace: boolean;
}

// =============================================================================
// AI Insights Types
// =============================================================================

export interface AIInsights {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  contentStrategy: string;
  audienceInsight: string;
  growthPotential: 'high' | 'medium' | 'low';
  keyTakeaways: string[];
}

// =============================================================================
// Comparison Types
// =============================================================================

export interface RadarChartData {
  dimensions: string[];
  accounts: {
    uniqueId: string;
    nickname: string;
    values: number[]; // Normalized 0-100 for each dimension
  }[];
}

export interface BarChartData {
  metrics: {
    name: string;
    accounts: {
      uniqueId: string;
      nickname: string;
      value: number;
      formattedValue: string;
    }[];
  }[];
}

export interface RankingTableData {
  metrics: {
    name: string;
    rankings: {
      rank: number;
      uniqueId: string;
      nickname: string;
      value: number;
      formattedValue: string;
      diff?: number; // Percentage difference from #1
    }[];
  }[];
}

export interface SignificantDiff {
  metric: string;
  description: string;
  accounts: {
    leader: { uniqueId: string; value: number };
    others: { uniqueId: string; value: number; diffPercent: number }[];
  };
  insight: string;
}

export interface BenchmarkComparison {
  industryAvg: number;
  accounts: {
    uniqueId: string;
    value: number;
    vsIndustry: number; // Percentage above/below industry avg
    tier: 'above' | 'at' | 'below';
  }[];
}

export interface AIComparisonInsights {
  overallSummary: string;
  winnersByMetric: {
    metric: string;
    winner: string;
    insight: string;
  }[];
  strategicDifferences: string[];
  recommendations: {
    forAccount: string;
    suggestion: string;
  }[];
}

// =============================================================================
// UI State Types
// =============================================================================

export interface AnalysisState {
  status: 'idle' | 'searching' | 'fetching' | 'analyzing' | 'complete' | 'error';
  progress: number;
  currentStage: string;
  error?: string;
}

export interface SelectedAccount {
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  followers: number;
  analysisId?: string;
}

export interface DeepAnalysisPageState {
  language: 'ko' | 'en';
  selectedAccounts: SelectedAccount[];
  analysisResults: Map<string, AccountAnalysisData>;
  comparisonReport?: ComparisonReportData;
  viewMode: 'search' | 'single' | 'comparison';
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface StartAnalysisRequest {
  uniqueId: string;
  videoCount?: number;
  language?: 'ko' | 'en';
}

export interface StartAnalysisResponse {
  success: boolean;
  analysisId?: string;
  error?: string;
}

export interface GetAnalysisRequest {
  analysisId: string;
}

export interface GetAnalysisResponse {
  success: boolean;
  analysis?: AccountAnalysisData;
  videos?: VideoClassificationData[];
  error?: string;
}

export interface CreateComparisonRequest {
  analysisIds: string[];
  language?: 'ko' | 'en';
}

export interface CreateComparisonResponse {
  success: boolean;
  reportId?: string;
  report?: ComparisonReportData;
  error?: string;
}
