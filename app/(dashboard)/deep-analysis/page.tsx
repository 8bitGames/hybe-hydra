"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip as ShadcnTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  X,
  Users,
  BarChart3,
  TrendingUp,
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  Eye,
  Music,
  ArrowRight,
  Sparkles,
  Target,
  Trophy,
  Star,
  HelpCircle,
  Zap,
  ArrowUp,
  ArrowDown,
  Trash2,
  History,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

// =============================================================================
// Types
// =============================================================================

interface SelectedAccount {
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  followers: number;
  verified: boolean;
  analysisId?: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  analysisData?: AccountAnalysisData;
}

interface VideoClassificationData {
  id: string;
  tiktokVideoId: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  description?: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  engagementRate: number;
  aiCategories: string[];
  aiConfidence: number;
  reasoning?: string | null;
  musicTitle?: string | null;
  isOwnMusic: boolean;
  publishedAt?: string | null;
  duration?: number | null;
  contentAnalysis?: {
    contentType?: string;
    engagementPotential?: string;
  } | null;
}

interface AccountAnalysisData {
  id: string;
  uniqueId: string;
  nickname: string;
  verified: boolean;
  followers: number;
  videosAnalyzed: number;
  basicMetrics?: {
    totalViews: number;
    avgViews: number;
    avgLikes: number;
    avgComments: number;
    avgShares: number;
  };
  engagementMetrics?: {
    avgEngagementRate: number;
    medianEngagementRate: number;
  };
  aiInsights?: {
    summary: string;
    performanceScore: number;
    performanceTier: string;
    strengths: Array<{ area: string; description: string }>;
    weaknesses: Array<{ area: string; description: string }>;
    recommendations: Array<{ priority: string; action: string; expectedImpact: string }>;
  };
  contentMixMetrics?: {
    dominantCategory: string;
    dominantContentType: string;
    contentDiversity: number;
  };
  videoClassifications?: VideoClassificationData[];
}

interface SearchResultUser {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  followers: number;
  verified: boolean;
  signature?: string;
  videos: number;
}

interface ComparisonData {
  overallSummary: string;
  rankings: {
    byEngagement: RankingItem[];
    byViews: RankingItem[];
    byConsistency: RankingItem[];
    byGrowthPotential: GrowthRankingItem[];
  };
  significantDifferences: SignificantDiff[];
  radarChartData: {
    dimensions: string[];
    accounts: {
      uniqueId: string;
      values: number[];
    }[];
  };
  strategicInsights: StrategicInsight[];
  accountSpecificRecommendations: AccountRecommendation[];
  competitivePositioning: {
    matrix: PositioningItem[];
    explanation: string;
  };
}

interface RankingItem {
  rank: number;
  uniqueId: string;
  value: number;
  interpretation: string;
}

interface GrowthRankingItem {
  rank: number;
  uniqueId: string;
  score: 'high' | 'medium' | 'low';
  interpretation: string;
}

interface SignificantDiff {
  metric: string;
  leader: string;
  follower: string;
  difference: number;
  differencePercent: number;
  insight: string;
  isSignificant: boolean;
}

interface StrategicInsight {
  category: 'content' | 'engagement' | 'growth' | 'posting' | 'music';
  insight: string;
  affectedAccounts: string[];
  recommendation: string;
}

interface AccountRecommendation {
  uniqueId: string;
  learnFrom: {
    fromAccount: string;
    aspect: string;
    suggestion: string;
  }[];
  uniqueStrengths: string[];
  areasToImprove: string[];
}

interface PositioningItem {
  uniqueId: string;
  quadrant: 'star' | 'question-mark' | 'cash-cow' | 'dog';
  reasoning: string;
}

interface SavedComparisonReport {
  id: string;
  title: string;
  language: string;
  accountCount: number;
  overallSummary: string;
  createdAt: string;
  accounts: {
    uniqueId: string;
    nickname: string;
    avatarUrl?: string | null;
    verified: boolean;
    followers: number;
  }[];
}

// =============================================================================
// Translations
// =============================================================================

const translations = {
  ko: {
    title: "심층 분석",
    subtitle: "TikTok 계정의 상세 분석 및 비교",
    searchPlaceholder: "TikTok 계정 검색 (@username)",
    search: "검색",
    selectedAccounts: "선택된 계정",
    maxAccounts: "최대 10개 계정",
    noAccountsSelected: "분석할 계정을 선택해주세요",
    addAccount: "계정 추가",
    startAnalysis: "분석 시작",
    analyzing: "분석 중...",
    complete: "완료",
    pending: "대기 중",
    error: "오류",
    followers: "팔로워",
    videos: "영상",
    language: "언어",
    korean: "한국어",
    english: "English",
    searchResults: "검색 결과",
    noResults: "검색 결과가 없습니다",
    loading: "로딩 중...",
    selectToAnalyze: "분석할 계정을 선택하세요",
    accountsTab: "계정 선택",
    analysisTab: "개별 분석",
    comparisonTab: "비교 분석",
    minTwoAccounts: "비교 분석을 위해 2개 이상의 계정이 필요합니다",
    analysisProgress: "분석 진행률",
    fetchingData: "데이터 수집 중",
    classifyingVideos: "영상 분류 중",
    calculatingMetrics: "지표 계산 중",
    generatingInsights: "인사이트 생성 중",
    videoCount: "분석할 영상 수",
    verified: "인증됨",
    compare: "비교 분석 시작",
    comparing: "비교 분석 중...",
    comparisonSummary: "비교 분석 요약",
    radarChart: "종합 비교 레이더",
    rankings: "순위표",
    byEngagement: "참여율 순위",
    byViews: "조회수 순위",
    byConsistency: "일관성 순위",
    byGrowthPotential: "성장 잠재력",
    significantDiffs: "주요 차이점",
    strategicInsights: "전략적 인사이트",
    recommendations: "계정별 추천",
    bcgMatrix: "경쟁 포지셔닝",
    star: "스타",
    questionMark: "물음표",
    cashCow: "캐시카우",
    dog: "도그",
    learnFrom: "배울 점",
    strengths: "강점",
    improvements: "개선 영역",
    aiSummary: "AI 분석 요약",
    analyzedVideos: "분석 영상",
    avgViewsLabel: "평균 조회수",
    engagementLabel: "참여율",
    recommendedActions: "추천 액션",
    diversityLabel: "다양성",
    performanceDistChart: "성과 분포",
    avgPerformanceNote: "100% (평균)",
    contentTypePerformance: "콘텐츠 유형별 성과",
    dottedLineNote: "점선: 평균 성과 (100%)",
    high: "높음",
    medium: "중간",
    low: "낮음",
    // Video Performance Table
    videoPerformance: "영상별 성과",
    rank: "순위",
    thumbnail: "썸네일",
    views: "조회수",
    likes: "좋아요",
    comments: "댓글",
    shares: "공유",
    engagement: "참여율",
    performanceScore: "성과점수",
    contentType: "콘텐츠",
    sortBy: "정렬",
    all: "전체",
    aboveAverage: "평균 이상",
    belowAverage: "평균 이하",
    topPerformers: "상위 성과",
    performance: "퍼포먼스",
    behindTheScenes: "비하인드",
    promotional: "프로모션",
    trend: "트렌드",
    personal: "개인",
    collaboration: "콜라보",
    challenge: "챌린지",
    other: "기타",
    noVideos: "분석된 영상이 없습니다",
    avgPerformance: "평균 대비",
    clearSelection: "선택 초기화",
    newComparison: "새 비교 시작",
    savedReports: "저장된 비교 리포트",
    noSavedReports: "저장된 비교 리포트가 없습니다",
    viewReport: "보기",
    deleteReport: "삭제",
    loadingReports: "리포트 로딩 중...",
    reportSaved: "비교 분석이 저장되었습니다",
    // Performance tiers
    exceptional: "탁월함",
    aboveAverageTier: "평균 이상",
    averageTier: "평균",
    belowAverageTier: "평균 이하",
    needsImprovement: "개선 필요",
    // Additional labels
    mainContent: "주요 콘텐츠",
    durationByPerformance: "영상 길이별 성과",
    musicByPerformance: "음악 선택별 성과",
    ownMusic: "자체 음악",
    trendingMusic: "트렌딩 음악",
    topPerformersLabel: "상위",
    avgPerformersLabel: "평균",
    lowPerformersLabel: "하위",
    waitingForAnalysis: "분석이 완료될 때까지 기다려주세요...",
    videoCompare: "영상 성과 비교",
    performanceDistribution: "성과 분포 인사이트",
    noData: "없음",
    duration: "길이",
    music: "음악",
    content: "콘텐츠",
    mostConsistent: "가장 안정적인 성과를 보이는 계정",
    highestTopRatio: "가장 높은 상위 성과 비율",
    variance: "편차",
    videosUnit: "개 영상",
    avgScore: "평균",
    recommendAction: "추천",
    maxPerformance: "최고 성과",
    minPerformance: "최저 성과",
    accountVideoDistribution: "각 계정의 영상 성과 분포 비교",
    performanceFactors: "성과 요인 분석",
    countUnit: "개",
    top20VideosShowing: "상위 20개 영상만 표시됩니다. 전체",
    outOf: "중",
    accountsToCompare: "개의 계정을 비교 분석합니다.",
    aiComparisonDescription: "AI가 각 계정의 강점과 약점을 비교하고 전략적 인사이트를 제공합니다.",
    // Factor categories
    categoryDuration: "길이",
    categoryMusic: "음악",
    categorySEO: "SEO",
    categoryContent: "콘텐츠",
    // Duration bins
    duration0to15: "0-15초",
    duration15to30: "15-30초",
    duration30to60: "30-60초",
    duration1to3min: "1-3분",
    duration3plus: "3분+",
    // Description bins
    descNone: "없음",
    descShort: "짧음 (1-50)",
    descMedium: "보통 (50-150)",
    descLong: "긴편 (150+)",
    // Factor insights
    durationVideo: "{label} 영상",
    durationPerformance: "{label} 길이의 영상이 평균 {score}% 성과",
    ownMusicBetterPerformance: "자체 음악 사용 시 {percent}% 더 높은 성과",
    trendingMusicBetterPerformance: "트렌딩 음악 사용 시 {percent}% 더 높은 성과",
    descriptionLabel: "{label} 설명",
    descriptionPerformance: "설명 길이가 {label}일 때 평균 {score}% 성과",
    // Performance distribution insights
    hasHighestTopRatio: "이(가) 가장 높은 상위 성과 비율 ({percent}%)을 보입니다.",
    mostConsistentAccount: "가장 안정적인 성과를 보이는 계정:",
    // Tooltips
    tooltips: {
      // Individual Analysis
      followers: "TikTok 프로필에서 가져온 총 팔로워 수입니다.",
      videosAnalyzed: "분석에 포함된 최근 영상 수입니다. 설정에서 조절 가능합니다.",
      avgViews: "분석된 영상들의 평균 조회수입니다. (총 조회수 ÷ 영상 수)",
      avgEngagement: "평균 참여율입니다. 계산식: (좋아요 + 댓글 + 공유) ÷ 조회수 × 100",
      videoCategory: "AI가 영상 설명, 해시태그, 음악 등을 분석하여 분류한 콘텐츠 카테고리입니다.",
      contentType: "영상의 형태를 분류합니다. (퍼포먼스, 비하인드, 프로모션, 트렌드 등)",
      performanceScore: "해당 계정 평균 대비 영상 성과입니다. 100% = 평균, 200% = 평균의 2배 성과",
      engagementRate: "개별 영상의 참여율입니다. (좋아요 + 댓글 + 공유) ÷ 조회수 × 100",
      // Comparison Analysis
      radarChart: "5가지 핵심 지표를 0-100 점수로 정규화하여 비교합니다. 비교 대상 중 최고=100, 최저=0",
      radarEngagement: "평균 참여율 기준 상대 점수",
      radarViews: "평균 조회수 기준 상대 점수",
      radarConsistency: "콘텐츠 성과 일관성 (편차가 작을수록 높은 점수)",
      radarDiversity: "콘텐츠 카테고리 다양성",
      radarOriginality: "자체 음원 사용 비율",
      rankings: "각 지표별로 계정을 순위로 정렬한 결과입니다.",
      byEngagement: "평균 참여율 순위입니다. (좋아요 + 댓글 + 공유) ÷ 조회수",
      byViews: "평균 조회수 순위입니다.",
      byConsistency: "영상 성과 일관성 순위입니다. 편차가 작을수록 순위가 높습니다.",
      byGrowthPotential: "AI가 참여율, 팔로워 수, 콘텐츠 특성을 종합 분석한 성장 잠재력입니다.",
      significantDiffs: "통계적으로 유의미한 차이가 나는 지표들입니다. (참여율 2%p↑, 조회수 50%↑ 등)",
      strategicInsights: "AI가 데이터 패턴을 분석하여 도출한 전략적 인사이트입니다.",
      bcgMatrix: "BCG 매트릭스 기반 경쟁 포지션입니다. 참여율(성장성) × 팔로워(시장점유율)",
      bcgStar: "높은 참여율 + 높은 팔로워: 시장 리더, 지속 투자 필요",
      bcgQuestionMark: "높은 참여율 + 낮은 팔로워: 성장 잠재력 높음, 집중 육성 대상",
      bcgCashCow: "낮은 참여율 + 높은 팔로워: 안정적이지만 정체, 새로운 전략 필요",
      bcgDog: "낮은 참여율 + 낮은 팔로워: 개선 시급, 전략 재검토 필요",
      recommendations: "AI가 각 계정별로 분석한 강점, 약점, 타 계정에서 배울 점입니다.",
      videoPerformanceCompare: "계정별 영상 성과 분포입니다. 상위(120%↑)/평균(80-120%)/하위(80%↓)",
      maxScore: "해당 계정 평균 대비 가장 높은 성과를 낸 영상의 상대 점수입니다.",
      minScore: "해당 계정 평균 대비 가장 낮은 성과를 낸 영상의 상대 점수입니다.",
      consistency: "최고 성과 - 최저 성과의 차이입니다. 작을수록 일관된 성과를 냅니다.",
      // Individual Analysis - Charts
      performanceDistChart: "영상들의 성과 점수(평균 대비) 분포를 보여줍니다. 100%가 평균이며, 좌측은 평균 이하, 우측은 평균 이상입니다.",
      contentTypePerformance: "콘텐츠 유형별 평균 성과입니다. 100%가 계정 평균이며, 각 유형의 상대적 성과를 비교할 수 있습니다.",
      performanceFactors: "영상 성과에 영향을 미치는 주요 요인들입니다. 각 요인별로 가장 높은 성과를 보인 조건을 분석합니다.",
      durationByPerformance: "영상 길이(초)에 따른 평균 성과입니다. 어떤 길이의 영상이 가장 좋은 반응을 얻는지 확인할 수 있습니다.",
      musicByPerformance: "자체 음악과 트렌딩 음악 사용 시 성과 비교입니다. 어떤 음악 선택이 더 높은 참여율을 이끄는지 보여줍니다.",
    },
  },
  en: {
    title: "Deep Analysis",
    subtitle: "Detailed analysis and comparison of TikTok accounts",
    searchPlaceholder: "Search TikTok accounts (@username)",
    search: "Search",
    selectedAccounts: "Selected Accounts",
    maxAccounts: "Max 10 accounts",
    noAccountsSelected: "Please select accounts to analyze",
    addAccount: "Add Account",
    startAnalysis: "Start Analysis",
    analyzing: "Analyzing...",
    complete: "Complete",
    pending: "Pending",
    error: "Error",
    followers: "Followers",
    videos: "Videos",
    language: "Language",
    korean: "한국어",
    english: "English",
    searchResults: "Search Results",
    noResults: "No results found",
    loading: "Loading...",
    selectToAnalyze: "Select accounts to analyze",
    accountsTab: "Account Selection",
    analysisTab: "Individual Analysis",
    comparisonTab: "Comparison",
    minTwoAccounts: "At least 2 accounts needed for comparison",
    analysisProgress: "Analysis Progress",
    fetchingData: "Fetching data",
    classifyingVideos: "Classifying videos",
    calculatingMetrics: "Calculating metrics",
    generatingInsights: "Generating insights",
    videoCount: "Videos to analyze",
    verified: "Verified",
    compare: "Start Comparison",
    comparing: "Comparing...",
    comparisonSummary: "Comparison Summary",
    radarChart: "Comparison Radar",
    rankings: "Rankings",
    byEngagement: "By Engagement",
    byViews: "By Views",
    byConsistency: "By Consistency",
    byGrowthPotential: "Growth Potential",
    significantDiffs: "Significant Differences",
    strategicInsights: "Strategic Insights",
    recommendations: "Account Recommendations",
    bcgMatrix: "Competitive Positioning",
    star: "Star",
    questionMark: "Question Mark",
    cashCow: "Cash Cow",
    dog: "Dog",
    learnFrom: "Learn From",
    strengths: "Strengths",
    improvements: "Areas to Improve",
    aiSummary: "AI Analysis Summary",
    analyzedVideos: "Analyzed Videos",
    avgViewsLabel: "Avg Views",
    engagementLabel: "Engagement",
    recommendedActions: "Recommended Actions",
    diversityLabel: "Diversity",
    performanceDistChart: "Performance Distribution",
    avgPerformanceNote: "100% (Avg)",
    contentTypePerformance: "Performance by Content Type",
    dottedLineNote: "Dotted line: Average (100%)",
    high: "High",
    medium: "Medium",
    low: "Low",
    // Video Performance Table
    videoPerformance: "Video Performance",
    rank: "Rank",
    thumbnail: "Thumbnail",
    views: "Views",
    likes: "Likes",
    comments: "Comments",
    shares: "Shares",
    engagement: "Engagement",
    performanceScore: "Performance",
    contentType: "Content",
    sortBy: "Sort by",
    all: "All",
    aboveAverage: "Above Average",
    belowAverage: "Below Average",
    topPerformers: "Top Performers",
    performance: "Performance",
    behindTheScenes: "Behind the Scenes",
    promotional: "Promotional",
    trend: "Trend",
    personal: "Personal",
    collaboration: "Collaboration",
    challenge: "Challenge",
    other: "Other",
    noVideos: "No videos analyzed",
    avgPerformance: "vs Average",
    clearSelection: "Clear Selection",
    newComparison: "New Comparison",
    savedReports: "Saved Comparison Reports",
    noSavedReports: "No saved comparison reports",
    viewReport: "View",
    deleteReport: "Delete",
    loadingReports: "Loading reports...",
    reportSaved: "Comparison saved",
    // Performance tiers
    exceptional: "Exceptional",
    aboveAverageTier: "Above Average",
    averageTier: "Average",
    belowAverageTier: "Below Average",
    needsImprovement: "Needs Improvement",
    // Additional labels
    mainContent: "Main Content",
    durationByPerformance: "Performance by Duration",
    musicByPerformance: "Performance by Music",
    ownMusic: "Original Music",
    trendingMusic: "Trending Music",
    topPerformersLabel: "Top",
    avgPerformersLabel: "Avg",
    lowPerformersLabel: "Low",
    waitingForAnalysis: "Please wait until analysis is complete...",
    videoCompare: "Video Performance Comparison",
    performanceDistribution: "Performance Distribution Insights",
    noData: "None",
    duration: "Duration",
    music: "Music",
    content: "Content",
    mostConsistent: "Most consistent performer",
    highestTopRatio: "Highest top performer ratio",
    variance: "Variance",
    videosUnit: "videos",
    avgScore: "Average",
    recommendAction: "Recommend",
    maxPerformance: "Max Performance",
    minPerformance: "Min Performance",
    accountVideoDistribution: "Video performance distribution by account",
    performanceFactors: "Performance Factors Analysis",
    countUnit: "",
    top20VideosShowing: "Showing top 20 videos. Total",
    outOf: "of",
    accountsToCompare: "accounts will be compared.",
    aiComparisonDescription: "AI will compare strengths and weaknesses of each account and provide strategic insights.",
    // Factor categories
    categoryDuration: "Duration",
    categoryMusic: "Music",
    categorySEO: "SEO",
    categoryContent: "Content",
    // Duration bins
    duration0to15: "0-15s",
    duration15to30: "15-30s",
    duration30to60: "30-60s",
    duration1to3min: "1-3min",
    duration3plus: "3min+",
    // Description bins
    descNone: "None",
    descShort: "Short (1-50)",
    descMedium: "Medium (50-150)",
    descLong: "Long (150+)",
    // Factor insights
    durationVideo: "{label} video",
    durationPerformance: "{label} duration videos average {score}% performance",
    ownMusicBetterPerformance: "{percent}% higher performance with original music",
    trendingMusicBetterPerformance: "{percent}% higher performance with trending music",
    descriptionLabel: "{label} description",
    descriptionPerformance: "Average {score}% performance when description is {label}",
    // Performance distribution insights
    hasHighestTopRatio: " has the highest top performer ratio ({percent}%).",
    mostConsistentAccount: "Most consistent performer:",
    // Tooltips
    tooltips: {
      // Individual Analysis
      followers: "Total follower count from TikTok profile.",
      videosAnalyzed: "Number of recent videos included in analysis. Adjustable in settings.",
      avgViews: "Average views across analyzed videos. (Total views ÷ Number of videos)",
      avgEngagement: "Average engagement rate. Formula: (Likes + Comments + Shares) ÷ Views × 100",
      videoCategory: "Content category classified by AI analyzing descriptions, hashtags, and music.",
      contentType: "Video format classification. (Performance, Behind-the-scenes, Promo, Trend, etc.)",
      performanceScore: "Performance relative to account average. 100% = average, 200% = 2x average",
      engagementRate: "Individual video engagement rate. (Likes + Comments + Shares) ÷ Views × 100",
      // Comparison Analysis
      radarChart: "5 key metrics normalized to 0-100 scale. Best among compared = 100, worst = 0",
      radarEngagement: "Relative score based on average engagement rate",
      radarViews: "Relative score based on average views",
      radarConsistency: "Content performance consistency (lower variance = higher score)",
      radarDiversity: "Content category diversity",
      radarOriginality: "Original music usage rate",
      rankings: "Accounts ranked by each metric.",
      byEngagement: "Ranking by average engagement rate. (Likes + Comments + Shares) ÷ Views",
      byViews: "Ranking by average views.",
      byConsistency: "Ranking by performance consistency. Lower variance = higher rank.",
      byGrowthPotential: "Growth potential assessed by AI analyzing engagement, followers, and content.",
      significantDiffs: "Statistically significant differences between accounts. (2%+ engagement, 50%+ views, etc.)",
      strategicInsights: "Strategic insights derived from AI pattern analysis.",
      bcgMatrix: "BCG Matrix positioning. Engagement (growth) × Followers (market share)",
      bcgStar: "High engagement + High followers: Market leader, needs continued investment",
      bcgQuestionMark: "High engagement + Low followers: High growth potential, nurture candidate",
      bcgCashCow: "Low engagement + High followers: Stable but stagnant, needs new strategy",
      bcgDog: "Low engagement + Low followers: Needs improvement, strategy review required",
      recommendations: "AI-analyzed strengths, weaknesses, and lessons from other accounts.",
      videoPerformanceCompare: "Video performance distribution. Top(120%+)/Average(80-120%)/Low(80%-)",
      maxScore: "Highest performing video's relative score vs account average.",
      minScore: "Lowest performing video's relative score vs account average.",
      consistency: "Difference between max and min scores. Lower = more consistent performance.",
      // Individual Analysis - Charts
      performanceDistChart: "Shows distribution of video performance scores (vs average). 100% = average, left = below average, right = above average.",
      contentTypePerformance: "Average performance by content type. 100% = account average. Compare relative performance across types.",
      performanceFactors: "Key factors affecting video performance. Analyzes which conditions produce the highest performance.",
      durationByPerformance: "Average performance by video duration (seconds). See which video lengths get the best engagement.",
      musicByPerformance: "Performance comparison: original music vs trending music. Shows which music choice drives higher engagement.",
    },
  },
};

// =============================================================================
// Components
// =============================================================================

// Info tooltip helper component
function InfoTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <ShadcnTooltip>
      <TooltipTrigger asChild>
        <button type="button" className={cn("inline-flex items-center", className)}>
          <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{text}</p>
      </TooltipContent>
    </ShadcnTooltip>
  );
}

function AccountSearchResult({
  user,
  isSelected,
  onSelect,
  t,
}: {
  user: SearchResultUser;
  isSelected: boolean;
  onSelect: () => void;
  t: typeof translations.ko;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
        isSelected
          ? "bg-primary/10 border-primary"
          : "hover:bg-muted/50 border-border"
      )}
      onClick={onSelect}
    >
      <Avatar className="h-12 w-12">
        <AvatarImage src={user.avatarUrl} alt={user.nickname} />
        <AvatarFallback>{user.nickname.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{user.nickname}</span>
          {user.verified && (
            <Badge variant="secondary" className="h-5 text-xs">
              {t.verified}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">@{user.uniqueId}</div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {formatNumber(user.followers)}
          </span>
          <span className="flex items-center gap-1">
            <Play className="h-3 w-3" />
            {formatNumber(user.videos)}
          </span>
        </div>
      </div>
      {isSelected ? (
        <CheckCircle className="h-5 w-5 text-primary shrink-0" />
      ) : (
        <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
      )}
    </div>
  );
}

function SelectedAccountCard({
  account,
  onRemove,
  t,
}: {
  account: SelectedAccount;
  onRemove: () => void;
  t: typeof translations.ko;
}) {
  const statusColors = {
    pending: "bg-muted text-muted-foreground",
    analyzing: "bg-blue-500/10 text-blue-500",
    complete: "bg-green-500/10 text-green-500",
    error: "bg-red-500/10 text-red-500",
  };

  const statusLabels = {
    pending: t.pending,
    analyzing: t.analyzing,
    complete: t.complete,
    error: t.error,
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <Avatar className="h-10 w-10">
        <AvatarImage src={account.avatarUrl} alt={account.nickname} />
        <AvatarFallback>{account.nickname.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{account.nickname}</span>
          {account.verified && (
            <CheckCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          )}
        </div>
        <div className="text-xs text-muted-foreground">@{account.uniqueId}</div>
      </div>
      <Badge variant="secondary" className={cn("shrink-0", statusColors[account.status])}>
        {account.status === "analyzing" && (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        )}
        {statusLabels[account.status]}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AnalysisProgressCard({
  account,
  progress,
  stage,
  t,
}: {
  account: SelectedAccount;
  progress: number;
  stage: string;
  t: typeof translations.ko;
}) {
  const stageLabels: Record<string, string> = {
    fetching: t.fetchingData,
    classifying: t.classifyingVideos,
    metrics: t.calculatingMetrics,
    insights: t.generatingInsights,
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={account.avatarUrl} alt={account.nickname} />
            <AvatarFallback>{account.nickname.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">{account.nickname}</div>
            <div className="text-xs text-muted-foreground">@{account.uniqueId}</div>
          </div>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2 mb-2" />
        <div className="text-xs text-muted-foreground">
          {stageLabels[stage] || stage}
        </div>
      </CardContent>
    </Card>
  );
}

function AccountAnalysisCard({
  account,
  data,
  t,
}: {
  account: SelectedAccount;
  data: AccountAnalysisData;
  t: typeof translations.ko;
}) {
  const performanceColors: Record<string, string> = {
    exceptional: "text-green-500",
    "above-average": "text-emerald-500",
    average: "text-yellow-500",
    "below-average": "text-orange-500",
    "needs-improvement": "text-red-500",
  };

  const performanceLabels: Record<string, string> = {
    exceptional: t.exceptional,
    "above-average": t.aboveAverageTier,
    average: t.averageTier,
    "below-average": t.belowAverageTier,
    "needs-improvement": t.needsImprovement,
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={account.avatarUrl} alt={data.nickname} />
            <AvatarFallback>{data.nickname.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{data.nickname}</CardTitle>
              {data.verified && (
                <CheckCircle className="h-5 w-5 text-blue-500" />
              )}
            </div>
            <CardDescription>@{data.uniqueId}</CardDescription>
          </div>
          {data.aiInsights && (
            <div className="text-right">
              <div className="text-3xl font-bold">{data.aiInsights.performanceScore}</div>
              <div className={cn(
                "text-sm font-medium",
                performanceColors[data.aiInsights.performanceTier] || "text-muted-foreground"
              )}>
                {performanceLabels[data.aiInsights.performanceTier] || data.aiInsights.performanceTier}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Summary */}
        {data.aiInsights?.summary && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{t.aiSummary}</span>
            </div>
            <p className="text-sm text-muted-foreground">{data.aiInsights.summary}</p>
          </div>
        )}

        {/* Basic Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3 w-3" />
              {t.followers}
              <InfoTooltip text={t.tooltips.followers} />
            </div>
            <div className="text-lg font-semibold">{formatNumber(data.followers)}</div>
          </div>
          <div className="p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Play className="h-3 w-3" />
              {t.analyzedVideos}
              <InfoTooltip text={t.tooltips.videosAnalyzed} />
            </div>
            <div className="text-lg font-semibold">{formatNumber(data.videosAnalyzed)}</div>
          </div>
          <div className="p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Eye className="h-3 w-3" />
              {t.avgViewsLabel}
              <InfoTooltip text={t.tooltips.avgViews} />
            </div>
            <div className="text-lg font-semibold">{formatNumber(data.basicMetrics?.avgViews || 0)}</div>
          </div>
          <div className="p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3 w-3" />
              {t.engagementLabel}
              <InfoTooltip text={t.tooltips.avgEngagement} />
            </div>
            <div className="text-lg font-semibold">
              {(data.engagementMetrics?.avgEngagementRate || 0).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        {data.aiInsights && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            {data.aiInsights.strengths.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {t.strengths}
                </div>
                <div className="space-y-2">
                  {data.aiInsights.strengths.slice(0, 3).map((s, i) => (
                    <div key={i} className="p-2 bg-green-500/5 rounded border border-green-500/20">
                      <div className="font-medium text-sm">{s.area}</div>
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {data.aiInsights.weaknesses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                  <AlertCircle className="h-4 w-4" />
                  {t.improvements}
                </div>
                <div className="space-y-2">
                  {data.aiInsights.weaknesses.slice(0, 3).map((w, i) => (
                    <div key={i} className="p-2 bg-orange-500/5 rounded border border-orange-500/20">
                      <div className="font-medium text-sm">{w.area}</div>
                      <div className="text-xs text-muted-foreground">{w.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {data.aiInsights?.recommendations && data.aiInsights.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4" />
              {t.recommendedActions}
            </div>
            <div className="space-y-2">
              {data.aiInsights.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Badge
                    variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                    className="shrink-0"
                  >
                    {rec.priority === 'high' ? t.high : rec.priority === 'medium' ? t.medium : t.low}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{rec.action}</div>
                    <div className="text-xs text-muted-foreground">{rec.expectedImpact}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Mix */}
        {data.contentMixMetrics && (
          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Music className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t.mainContent}:</span>
              <Badge variant="outline">{data.contentMixMetrics.dominantContentType}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t.diversityLabel}:</span>
              <span className="font-medium">{(data.contentMixMetrics.contentDiversity * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Video Performance Table */}
        {data.videoClassifications && data.videoClassifications.length > 0 && (
          <div className="pt-6 border-t">
            <VideoPerformanceTable
              videos={data.videoClassifications}
              avgEngagementRate={data.engagementMetrics?.avgEngagementRate || 0}
              t={t}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Performance Distribution Chart Component
// =============================================================================

interface VideoWithScore extends VideoClassificationData {
  performanceScore: number;
}

function PerformanceDistributionChart({
  videos,
  t,
}: {
  videos: VideoWithScore[];
  t: typeof translations.ko;
}) {
  // Create histogram bins for performance score distribution
  const bins = [
    { range: '0-40', min: 0, max: 40, count: 0, color: 'hsl(0, 70%, 50%)' },
    { range: '40-60', min: 40, max: 60, count: 0, color: 'hsl(30, 70%, 50%)' },
    { range: '60-80', min: 60, max: 80, count: 0, color: 'hsl(45, 70%, 50%)' },
    { range: '80-100', min: 80, max: 100, count: 0, color: 'hsl(60, 70%, 50%)' },
    { range: '100-120', min: 100, max: 120, count: 0, color: 'hsl(90, 70%, 50%)' },
    { range: '120-150', min: 120, max: 150, count: 0, color: 'hsl(120, 70%, 45%)' },
    { range: '150+', min: 150, max: Infinity, count: 0, color: 'hsl(150, 70%, 40%)' },
  ];

  videos.forEach((video) => {
    for (const bin of bins) {
      if (video.performanceScore >= bin.min && video.performanceScore < bin.max) {
        bin.count++;
        break;
      }
    }
  });

  const maxCount = Math.max(...bins.map(b => b.count), 1);

  return (
    <div className="pt-4">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        {t.performanceDistChart}
        <InfoTooltip text={t.tooltips.performanceDistChart} />
      </h4>
      <div className="h-32 flex items-end gap-1">
        {bins.map((bin) => (
          <div
            key={bin.range}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <span className="text-xs text-muted-foreground">
              {bin.count > 0 ? bin.count : ''}
            </span>
            <div
              className="w-full rounded-t transition-all duration-300"
              style={{
                height: `${(bin.count / maxCount) * 100}%`,
                minHeight: bin.count > 0 ? '4px' : '0',
                backgroundColor: bin.color,
              }}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {bin.range}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-2">
        <span className="text-xs text-muted-foreground">← {t.belowAverage} | {t.avgPerformanceNote} | {t.aboveAverage} →</span>
      </div>
    </div>
  );
}

// =============================================================================
// Content Type Performance Chart Component
// =============================================================================

function ContentTypePerformanceChart({
  videos,
  t,
}: {
  videos: VideoWithScore[];
  t: typeof translations.ko;
}) {
  const contentTypeLabels: Record<string, string> = {
    performance: t.performance,
    'behind-the-scenes': t.behindTheScenes,
    promotional: t.promotional,
    trend: t.trend,
    personal: t.personal,
    collaboration: t.collaboration,
    challenge: t.challenge,
    other: t.other,
  };

  // Group videos by content type and calculate avg performance
  const contentTypeStats: Record<string, { count: number; totalScore: number; avgScore: number }> = {};

  videos.forEach((video) => {
    const contentType = video.contentAnalysis?.contentType?.toLowerCase() || 'other';
    if (!contentTypeStats[contentType]) {
      contentTypeStats[contentType] = { count: 0, totalScore: 0, avgScore: 0 };
    }
    contentTypeStats[contentType].count++;
    contentTypeStats[contentType].totalScore += video.performanceScore;
  });

  // Calculate averages
  Object.keys(contentTypeStats).forEach((key) => {
    const stat = contentTypeStats[key];
    stat.avgScore = stat.count > 0 ? stat.totalScore / stat.count : 0;
  });

  // Sort by avg score descending
  const sortedTypes = Object.entries(contentTypeStats)
    .filter(([_, stats]) => stats.count > 0)
    .sort(([, a], [, b]) => b.avgScore - a.avgScore);

  if (sortedTypes.length === 0) return null;

  const maxScore = Math.max(...sortedTypes.map(([, s]) => s.avgScore), 100);

  return (
    <div className="pt-4">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Play className="h-4 w-4 text-muted-foreground" />
        {t.contentTypePerformance}
        <InfoTooltip text={t.tooltips.contentTypePerformance} />
      </h4>
      <div className="space-y-2">
        {sortedTypes.map(([type, stats]) => {
          const isAboveAverage = stats.avgScore >= 100;
          const widthPercent = (stats.avgScore / maxScore) * 100;

          return (
            <div key={type} className="flex items-center gap-3">
              <div className="w-24 text-xs truncate">
                {contentTypeLabels[type] || type}
              </div>
              <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden relative">
                <div
                  className={cn(
                    "h-full rounded transition-all duration-300",
                    isAboveAverage ? "bg-green-500/70" : "bg-orange-500/70"
                  )}
                  style={{ width: `${widthPercent}%` }}
                />
                {/* 100% baseline marker */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-muted-foreground/50"
                  style={{ left: `${(100 / maxScore) * 100}%` }}
                />
              </div>
              <div className="w-16 text-right">
                <span className={cn(
                  "text-sm font-medium",
                  isAboveAverage ? "text-green-600" : "text-orange-600"
                )}>
                  {stats.avgScore.toFixed(0)}%
                </span>
              </div>
              <div className="w-10 text-right text-xs text-muted-foreground">
                ({stats.count})
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-muted-foreground text-center">
        {t.dottedLineNote}
      </div>
    </div>
  );
}

// =============================================================================
// Performance Factors Component
// =============================================================================

function PerformanceFactorsSection({
  videos,
  t,
}: {
  videos: VideoWithScore[];
  t: typeof translations.ko;
}) {
  // Analyze various factors that correlate with performance

  // 1. Duration analysis
  const videosWithDuration = videos.filter(v => v.duration && v.duration > 0);
  const durationBins = [
    { label: t.duration0to15, min: 0, max: 15, count: 0, totalScore: 0 },
    { label: t.duration15to30, min: 15, max: 30, count: 0, totalScore: 0 },
    { label: t.duration30to60, min: 30, max: 60, count: 0, totalScore: 0 },
    { label: t.duration1to3min, min: 60, max: 180, count: 0, totalScore: 0 },
    { label: t.duration3plus, min: 180, max: Infinity, count: 0, totalScore: 0 },
  ];

  videosWithDuration.forEach(video => {
    const duration = video.duration || 0;
    for (const bin of durationBins) {
      if (duration >= bin.min && duration < bin.max) {
        bin.count++;
        bin.totalScore += video.performanceScore;
        break;
      }
    }
  });

  const durationStats = durationBins
    .filter(b => b.count > 0)
    .map(b => ({ ...b, avgScore: b.totalScore / b.count }));

  // 2. Own Music analysis
  const ownMusicVideos = videos.filter(v => v.isOwnMusic);
  const otherMusicVideos = videos.filter(v => !v.isOwnMusic);
  const ownMusicAvg = ownMusicVideos.length > 0
    ? ownMusicVideos.reduce((sum, v) => sum + v.performanceScore, 0) / ownMusicVideos.length
    : 0;
  const otherMusicAvg = otherMusicVideos.length > 0
    ? otherMusicVideos.reduce((sum, v) => sum + v.performanceScore, 0) / otherMusicVideos.length
    : 0;

  // 3. Description length analysis (SEO factor)
  const descriptionBins = [
    { label: t.descNone, min: 0, max: 1, count: 0, totalScore: 0 },
    { label: t.descShort, min: 1, max: 50, count: 0, totalScore: 0 },
    { label: t.descMedium, min: 50, max: 150, count: 0, totalScore: 0 },
    { label: t.descLong, min: 150, max: Infinity, count: 0, totalScore: 0 },
  ];

  videos.forEach(video => {
    const descLength = (video.description || '').length;
    for (const bin of descriptionBins) {
      if (descLength >= bin.min && descLength < bin.max) {
        bin.count++;
        bin.totalScore += video.performanceScore;
        break;
      }
    }
  });

  const descriptionStats = descriptionBins
    .filter(b => b.count > 0)
    .map(b => ({ ...b, avgScore: b.totalScore / b.count }));

  // 4. Calculate best performing factors
  type Factor = {
    name: string;
    score: number;
    count: number;
    category: string;
    insight: string;
  };

  const factors: Factor[] = [];

  // Best duration
  if (durationStats.length > 0) {
    const bestDuration = durationStats.reduce((a, b) => a.avgScore > b.avgScore ? a : b);
    factors.push({
      name: t.durationVideo.replace('{label}', bestDuration.label),
      score: bestDuration.avgScore,
      count: bestDuration.count,
      category: 'duration',
      insight: t.durationPerformance.replace('{label}', bestDuration.label).replace('{score}', bestDuration.avgScore.toFixed(0)),
    });
  }

  // Music factor
  if (ownMusicVideos.length > 0 && otherMusicVideos.length > 0) {
    const betterMusic = ownMusicAvg > otherMusicAvg;
    factors.push({
      name: betterMusic ? t.ownMusic : t.trendingMusic,
      score: betterMusic ? ownMusicAvg : otherMusicAvg,
      count: betterMusic ? ownMusicVideos.length : otherMusicVideos.length,
      category: 'music',
      insight: betterMusic
        ? t.ownMusicBetterPerformance.replace('{percent}', ((ownMusicAvg / otherMusicAvg - 1) * 100).toFixed(0))
        : t.trendingMusicBetterPerformance.replace('{percent}', ((otherMusicAvg / ownMusicAvg - 1) * 100).toFixed(0)),
    });
  }

  // Best description length (SEO)
  if (descriptionStats.length > 0) {
    const bestDesc = descriptionStats.reduce((a, b) => a.avgScore > b.avgScore ? a : b);
    factors.push({
      name: t.descriptionLabel.replace('{label}', bestDesc.label),
      score: bestDesc.avgScore,
      count: bestDesc.count,
      category: 'seo',
      insight: t.descriptionPerformance.replace('{label}', bestDesc.label).replace('{score}', bestDesc.avgScore.toFixed(0)),
    });
  }

  // Sort factors by score
  factors.sort((a, b) => b.score - a.score);

  // Category display names and colors mapping
  const categoryLabels: Record<string, string> = {
    'duration': t.categoryDuration,
    'music': t.categoryMusic,
    'seo': t.categorySEO,
    'content': t.categoryContent,
  };

  const categoryColors: Record<string, string> = {
    'duration': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    'music': 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    'seo': 'bg-green-500/10 text-green-600 border-green-500/30',
    'content': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  };

  return (
    <div className="pt-4">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        {t.performanceFactors}
        <InfoTooltip text={t.tooltips.performanceFactors} />
      </h4>
      <div className="space-y-3">
        {factors.map((factor, index) => (
          <div
            key={index}
            className="p-3 rounded-lg border bg-card"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("text-xs", categoryColors[factor.category])}
                >
                  {categoryLabels[factor.category]}
                </Badge>
                <span className="font-medium text-sm">{factor.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-semibold",
                  factor.score >= 100 ? "text-green-600" : "text-orange-600"
                )}>
                  {factor.score.toFixed(0)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({factor.count}{t.countUnit})
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{factor.insight}</p>
          </div>
        ))}
      </div>

      {/* Duration chart */}
      {durationStats.length > 1 && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <h5 className="text-xs font-medium mb-2 flex items-center gap-2">
            {t.durationByPerformance}
            <InfoTooltip text={t.tooltips.durationByPerformance} />
          </h5>
          <div className="space-y-1">
            {durationStats.map((stat) => {
              const isAboveAverage = stat.avgScore >= 100;
              return (
                <div key={stat.label} className="flex items-center gap-2 text-xs">
                  <span className="w-16">{stat.label}</span>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded",
                        isAboveAverage ? "bg-green-500/60" : "bg-orange-500/60"
                      )}
                      style={{ width: `${Math.min(stat.avgScore, 200) / 2}%` }}
                    />
                  </div>
                  <span className={cn(
                    "w-12 text-right font-medium",
                    isAboveAverage ? "text-green-600" : "text-orange-600"
                  )}>
                    {stat.avgScore.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Music comparison */}
      {ownMusicVideos.length > 0 && otherMusicVideos.length > 0 && (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg">
          <h5 className="text-xs font-medium mb-2 flex items-center gap-2">
            {t.musicByPerformance}
            <InfoTooltip text={t.tooltips.musicByPerformance} />
          </h5>
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(
              "p-2 rounded border text-center",
              ownMusicAvg >= otherMusicAvg ? "border-green-500/30 bg-green-500/5" : "border-muted"
            )}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Music className="h-3 w-3" />
                <span className="text-xs">{t.ownMusic}</span>
              </div>
              <div className={cn(
                "font-semibold",
                ownMusicAvg >= 100 ? "text-green-600" : "text-orange-600"
              )}>
                {ownMusicAvg.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {ownMusicVideos.length}{t.countUnit}
              </div>
            </div>
            <div className={cn(
              "p-2 rounded border text-center",
              otherMusicAvg > ownMusicAvg ? "border-green-500/30 bg-green-500/5" : "border-muted"
            )}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs">{t.trendingMusic}</span>
              </div>
              <div className={cn(
                "font-semibold",
                otherMusicAvg >= 100 ? "text-green-600" : "text-orange-600"
              )}>
                {otherMusicAvg.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {otherMusicVideos.length}{t.countUnit}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Video Performance Table Component
// =============================================================================

type SortField = 'performanceScore' | 'playCount' | 'likeCount' | 'engagement' | 'commentCount' | 'shareCount';
type FilterType = 'all' | 'aboveAverage' | 'belowAverage';
type ContentTypeFilter = 'all' | 'performance' | 'behind-the-scenes' | 'promotional' | 'trend' | 'personal' | 'collaboration' | 'challenge' | 'other';

function VideoPerformanceTable({
  videos,
  avgEngagementRate,
  t,
}: {
  videos: VideoClassificationData[];
  avgEngagementRate: number;
  t: typeof translations.ko;
}) {
  const [sortField, setSortField] = useState<SortField>('performanceScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [performanceFilter, setPerformanceFilter] = useState<FilterType>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');

  // Calculate performance score for each video
  const videosWithScore = videos.map((video) => {
    const performanceScore = avgEngagementRate > 0
      ? (video.engagementRate / avgEngagementRate) * 100
      : 100;
    return {
      ...video,
      performanceScore,
    };
  });

  // Filter videos
  const filteredVideos = videosWithScore.filter((video) => {
    // Performance filter
    if (performanceFilter === 'aboveAverage' && video.performanceScore < 100) return false;
    if (performanceFilter === 'belowAverage' && video.performanceScore >= 100) return false;

    // Content type filter
    if (contentTypeFilter !== 'all') {
      const videoContentType = video.contentAnalysis?.contentType?.toLowerCase() || 'other';
      if (videoContentType !== contentTypeFilter) return false;
    }

    return true;
  });

  // Sort videos
  const sortedVideos = [...filteredVideos].sort((a, b) => {
    let aVal: number, bVal: number;

    switch (sortField) {
      case 'performanceScore':
        aVal = a.performanceScore;
        bVal = b.performanceScore;
        break;
      case 'playCount':
        aVal = a.playCount;
        bVal = b.playCount;
        break;
      case 'likeCount':
        aVal = a.likeCount;
        bVal = b.likeCount;
        break;
      case 'engagement':
        aVal = a.engagementRate;
        bVal = b.engagementRate;
        break;
      case 'commentCount':
        aVal = a.commentCount;
        bVal = b.commentCount;
        break;
      case 'shareCount':
        aVal = a.shareCount;
        bVal = b.shareCount;
        break;
      default:
        aVal = a.performanceScore;
        bVal = b.performanceScore;
    }

    return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const contentTypeLabels: Record<string, string> = {
    performance: t.performance,
    'behind-the-scenes': t.behindTheScenes,
    promotional: t.promotional,
    trend: t.trend,
    personal: t.personal,
    collaboration: t.collaboration,
    challenge: t.challenge,
    other: t.other,
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? (
      <ArrowDown className="h-3 w-3" />
    ) : (
      <ArrowUp className="h-3 w-3" />
    );
  };

  if (videos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{t.noVideos}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with title */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">{t.videoPerformance}</h3>
        <Badge variant="outline" className="ml-auto">
          {filteredVideos.length}/{videos.length}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={sortField}
          onValueChange={(v) => setSortField(v as SortField)}
        >
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder={t.sortBy} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="performanceScore">{t.performanceScore}</SelectItem>
            <SelectItem value="playCount">{t.views}</SelectItem>
            <SelectItem value="likeCount">{t.likes}</SelectItem>
            <SelectItem value="engagement">{t.engagement}</SelectItem>
            <SelectItem value="commentCount">{t.comments}</SelectItem>
            <SelectItem value="shareCount">{t.shares}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={performanceFilter}
          onValueChange={(v) => setPerformanceFilter(v as FilterType)}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="aboveAverage">{t.aboveAverage}</SelectItem>
            <SelectItem value="belowAverage">{t.belowAverage}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={contentTypeFilter}
          onValueChange={(v) => setContentTypeFilter(v as ContentTypeFilter)}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="performance">{t.performance}</SelectItem>
            <SelectItem value="behind-the-scenes">{t.behindTheScenes}</SelectItem>
            <SelectItem value="promotional">{t.promotional}</SelectItem>
            <SelectItem value="trend">{t.trend}</SelectItem>
            <SelectItem value="personal">{t.personal}</SelectItem>
            <SelectItem value="collaboration">{t.collaboration}</SelectItem>
            <SelectItem value="challenge">{t.challenge}</SelectItem>
            <SelectItem value="other">{t.other}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12">
                  {t.rank}
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {t.thumbnail}
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('playCount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t.views}
                    <SortIcon field="playCount" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('likeCount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t.likes}
                    <SortIcon field="likeCount" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('engagement')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t.engagement}
                    <InfoTooltip text={t.tooltips.engagementRate} />
                    <SortIcon field="engagement" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('performanceScore')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t.performanceScore}
                    <InfoTooltip text={t.tooltips.performanceScore} />
                    <SortIcon field="performanceScore" />
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {t.contentType}
                    <InfoTooltip text={t.tooltips.contentType} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedVideos.slice(0, 20).map((video, index) => {
                const isAboveAverage = video.performanceScore >= 100;
                const contentType = video.contentAnalysis?.contentType?.toLowerCase() || 'other';

                return (
                  <tr
                    key={video.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                        index === 0 ? "bg-yellow-500 text-yellow-950" :
                        index === 1 ? "bg-gray-300 text-gray-700" :
                        index === 2 ? "bg-orange-400 text-orange-950" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <a
                          href={video.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt="thumbnail"
                              className="w-16 h-10 object-cover rounded bg-muted"
                            />
                          ) : (
                            <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                              <Play className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </a>
                        <div className="min-w-0 max-w-[200px]">
                          <p className="text-xs text-muted-foreground truncate">
                            {video.description || '-'}
                          </p>
                          {video.musicTitle && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Music className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">
                                {video.musicTitle}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatNumber(video.playCount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatNumber(video.likeCount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {video.engagementRate.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={cn(
                          "font-semibold",
                          isAboveAverage ? "text-green-600" : "text-orange-600"
                        )}>
                          {video.performanceScore.toFixed(0)}
                        </span>
                        <span className={cn(
                          "text-xs",
                          isAboveAverage ? "text-green-600" : "text-orange-600"
                        )}>
                          {isAboveAverage ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {contentTypeLabels[contentType] || contentType}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedVideos.length > 20 && (
          <div className="px-3 py-2 bg-muted/30 text-center text-xs text-muted-foreground border-t">
            {t.top20VideosShowing} {sortedVideos.length}{t.countUnit} {t.outOf}
          </div>
        )}
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="text-center p-3 bg-green-500/5 rounded-lg border border-green-500/20">
          <div className="text-lg font-semibold text-green-600">
            {videosWithScore.filter(v => v.performanceScore >= 120).length}
          </div>
          <div className="text-xs text-muted-foreground">{t.topPerformers} (120%+)</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg border">
          <div className="text-lg font-semibold">
            {videosWithScore.filter(v => v.performanceScore >= 80 && v.performanceScore < 120).length}
          </div>
          <div className="text-xs text-muted-foreground">{t.avgPerformance} (80-120%)</div>
        </div>
        <div className="text-center p-3 bg-orange-500/5 rounded-lg border border-orange-500/20">
          <div className="text-lg font-semibold text-orange-600">
            {videosWithScore.filter(v => v.performanceScore < 80).length}
          </div>
          <div className="text-xs text-muted-foreground">{t.belowAverage} (&lt;80%)</div>
        </div>
      </div>

      {/* Performance Distribution Chart */}
      <PerformanceDistributionChart
        videos={videosWithScore}
        t={t}
      />

      {/* Content Type Performance Chart */}
      <ContentTypePerformanceChart
        videos={videosWithScore}
        t={t}
      />

      {/* Performance Factors Section */}
      <PerformanceFactorsSection
        videos={videosWithScore}
        t={t}
      />
    </div>
  );
}

// Chart colors for multiple accounts
const CHART_COLORS = [
  "hsl(220, 70%, 50%)",  // Blue
  "hsl(150, 70%, 40%)",  // Green
  "hsl(280, 70%, 50%)",  // Purple
  "hsl(30, 90%, 50%)",   // Orange
  "hsl(340, 70%, 50%)",  // Pink
];

function ComparisonRadarChart({
  data,
  accounts,
  t,
}: {
  data: ComparisonData['radarChartData'];
  accounts: SelectedAccount[];
  t: typeof translations.ko;
}) {
  // Transform data for Recharts
  const chartData = data.dimensions.map((dim, i) => {
    const point: Record<string, string | number> = { dimension: dim };
    data.accounts.forEach((account) => {
      point[account.uniqueId] = account.values[i];
    });
    return point;
  });

  const getAccountName = (uniqueId: string) => {
    const account = accounts.find(a => a.uniqueId === uniqueId);
    return account?.nickname || `@${uniqueId}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t.radarChart}
          <InfoTooltip text={t.tooltips.radarChart} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              {data.accounts.map((account, index) => (
                <Radar
                  key={account.uniqueId}
                  name={getAccountName(account.uniqueId)}
                  dataKey={account.uniqueId}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function RankingsTable({
  rankings,
  accounts,
  t,
}: {
  rankings: ComparisonData['rankings'];
  accounts: SelectedAccount[];
  t: typeof translations.ko;
}) {
  const getAccountInfo = (uniqueId: string) => {
    const account = accounts.find(a => a.uniqueId === uniqueId);
    return account || { uniqueId, nickname: uniqueId, avatarUrl: undefined };
  };

  const growthLabels: Record<string, string> = {
    high: t.high,
    medium: t.medium,
    low: t.low,
  };

  const growthColors: Record<string, string> = {
    high: "text-green-500",
    medium: "text-yellow-500",
    low: "text-red-500",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t.rankings}
          <InfoTooltip text={t.tooltips.rankings} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Engagement Ranking */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {t.byEngagement}
            <InfoTooltip text={t.tooltips.byEngagement} />
          </h4>
          <div className="space-y-2">
            {rankings.byEngagement.map((item) => {
              const accountInfo = getAccountInfo(item.uniqueId);
              return (
                <div
                  key={item.uniqueId}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg",
                    item.rank === 1 ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-muted/30"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold",
                    item.rank === 1 ? "bg-yellow-500 text-yellow-950" :
                    item.rank === 2 ? "bg-gray-300 text-gray-700" :
                    item.rank === 3 ? "bg-orange-400 text-orange-950" : "bg-muted text-muted-foreground"
                  )}>
                    {item.rank}
                  </span>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={accountInfo.avatarUrl} />
                    <AvatarFallback>{accountInfo.nickname.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1">{accountInfo.nickname}</span>
                  <span className="text-sm font-mono">{item.value.toFixed(2)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Views Ranking */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            {t.byViews}
            <InfoTooltip text={t.tooltips.byViews} />
          </h4>
          <div className="space-y-2">
            {rankings.byViews.map((item) => {
              const accountInfo = getAccountInfo(item.uniqueId);
              return (
                <div
                  key={item.uniqueId}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg",
                    item.rank === 1 ? "bg-blue-500/10 border border-blue-500/30" : "bg-muted/30"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold",
                    item.rank === 1 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {item.rank}
                  </span>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={accountInfo.avatarUrl} />
                    <AvatarFallback>{accountInfo.nickname.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1">{accountInfo.nickname}</span>
                  <span className="text-sm font-mono">{formatNumber(item.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Growth Potential */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            {t.byGrowthPotential}
            <InfoTooltip text={t.tooltips.byGrowthPotential} />
          </h4>
          <div className="space-y-2">
            {rankings.byGrowthPotential.map((item) => {
              const accountInfo = getAccountInfo(item.uniqueId);
              return (
                <div
                  key={item.uniqueId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={accountInfo.avatarUrl} />
                    <AvatarFallback>{accountInfo.nickname.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1">{accountInfo.nickname}</span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", growthColors[item.score])}
                  >
                    {growthLabels[item.score]}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BCGMatrixCard({
  positioning,
  accounts,
  t,
}: {
  positioning: ComparisonData['competitivePositioning'];
  accounts: SelectedAccount[];
  t: typeof translations.ko;
}) {
  const getAccountInfo = (uniqueId: string) => {
    const account = accounts.find(a => a.uniqueId === uniqueId);
    return account || { uniqueId, nickname: uniqueId, avatarUrl: undefined };
  };

  const quadrantLabels: Record<string, string> = {
    star: t.star,
    'question-mark': t.questionMark,
    'cash-cow': t.cashCow,
    dog: t.dog,
  };

  const quadrantIcons: Record<string, React.ReactNode> = {
    star: <Star className="h-4 w-4 text-yellow-500" />,
    'question-mark': <HelpCircle className="h-4 w-4 text-purple-500" />,
    'cash-cow': <Trophy className="h-4 w-4 text-green-500" />,
    dog: <AlertCircle className="h-4 w-4 text-gray-500" />,
  };

  const quadrantColors: Record<string, string> = {
    star: "bg-yellow-500/10 border-yellow-500/30",
    'question-mark': "bg-purple-500/10 border-purple-500/30",
    'cash-cow': "bg-green-500/10 border-green-500/30",
    dog: "bg-gray-500/10 border-gray-500/30",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          {t.bcgMatrix}
          <InfoTooltip text={t.tooltips.bcgMatrix} />
        </CardTitle>
        <CardDescription className="text-xs">{positioning.explanation}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Matrix grid */}
          {(['star', 'question-mark', 'cash-cow', 'dog'] as const).map((quadrant) => {
            const itemsInQuadrant = positioning.matrix.filter(m => m.quadrant === quadrant);
            const quadrantTooltips: Record<string, string> = {
              star: t.tooltips.bcgStar,
              'question-mark': t.tooltips.bcgQuestionMark,
              'cash-cow': t.tooltips.bcgCashCow,
              dog: t.tooltips.bcgDog,
            };
            return (
              <div
                key={quadrant}
                className={cn(
                  "p-4 rounded-lg border min-h-[120px]",
                  quadrantColors[quadrant]
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  {quadrantIcons[quadrant]}
                  <span className="text-sm font-medium">{quadrantLabels[quadrant]}</span>
                  <InfoTooltip text={quadrantTooltips[quadrant]} />
                </div>
                <div className="space-y-2">
                  {itemsInQuadrant.map((item) => {
                    const accountInfo = getAccountInfo(item.uniqueId);
                    return (
                      <div key={item.uniqueId} className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={accountInfo.avatarUrl} />
                          <AvatarFallback className="text-xs">{accountInfo.nickname.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{accountInfo.nickname}</span>
                      </div>
                    );
                  })}
                  {itemsInQuadrant.length === 0 && (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SignificantDiffsCard({
  diffs,
  t,
}: {
  diffs: SignificantDiff[];
  t: typeof translations.ko;
}) {
  const significantDiffs = diffs.filter(d => d.isSignificant);

  if (significantDiffs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ArrowUp className="h-5 w-5" />
          {t.significantDiffs}
          <InfoTooltip text={t.tooltips.significantDiffs} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {significantDiffs.slice(0, 5).map((diff, i) => (
            <div key={i} className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{diff.metric}</span>
                <Badge variant="outline" className="text-xs">
                  {diff.differencePercent > 0 ? '+' : ''}{diff.differencePercent.toFixed(0)}%
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span className="font-medium text-green-500">@{diff.leader}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium text-orange-500">@{diff.follower}</span>
              </div>
              <p className="text-xs text-muted-foreground">{diff.insight}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StrategicInsightsCard({
  insights,
  t,
}: {
  insights: StrategicInsight[];
  t: typeof translations.ko;
}) {
  const categoryIcons: Record<string, React.ReactNode> = {
    content: <Play className="h-4 w-4" />,
    engagement: <TrendingUp className="h-4 w-4" />,
    growth: <Zap className="h-4 w-4" />,
    posting: <BarChart3 className="h-4 w-4" />,
    music: <Music className="h-4 w-4" />,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {t.strategicInsights}
          <InfoTooltip text={t.tooltips.strategicInsights} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {categoryIcons[insight.category]}
                <Badge variant="secondary" className="text-xs capitalize">
                  {insight.category}
                </Badge>
              </div>
              <p className="text-sm mb-2">{insight.insight}</p>
              <div className="p-2 bg-muted/50 rounded text-xs">
                <span className="font-medium">{t.recommendAction}: </span>
                {insight.recommendation}
              </div>
              {insight.affectedAccounts.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {insight.affectedAccounts.map(a => `@${a}`).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Video Performance Comparison Component
// =============================================================================

function VideoPerformanceComparisonCard({
  accounts,
  t,
}: {
  accounts: SelectedAccount[];
  t: typeof translations.ko;
}) {
  // Get accounts with video data
  const accountsWithVideos = accounts.filter(
    a => a.analysisData?.videoClassifications && a.analysisData.videoClassifications.length > 0
  );

  if (accountsWithVideos.length < 2) return null;

  // Calculate performance stats for each account
  const accountStats = accountsWithVideos.map(account => {
    const videos = account.analysisData!.videoClassifications!;
    const avgEngagement = account.analysisData?.engagementMetrics?.avgEngagementRate || 0;

    const videosWithScore = videos.map(v => ({
      ...v,
      performanceScore: avgEngagement > 0 ? (v.engagementRate / avgEngagement) * 100 : 100,
    }));

    const topPerformers = videosWithScore.filter(v => v.performanceScore >= 120).length;
    const avgPerformers = videosWithScore.filter(v => v.performanceScore >= 80 && v.performanceScore < 120).length;
    const lowPerformers = videosWithScore.filter(v => v.performanceScore < 80).length;

    const avgPerformanceScore = videosWithScore.reduce((sum, v) => sum + v.performanceScore, 0) / videosWithScore.length;
    const maxScore = Math.max(...videosWithScore.map(v => v.performanceScore));
    const minScore = Math.min(...videosWithScore.map(v => v.performanceScore));
    const consistency = maxScore - minScore;

    return {
      uniqueId: account.uniqueId,
      nickname: account.nickname,
      avatarUrl: account.avatarUrl,
      totalVideos: videos.length,
      topPerformers,
      topPercent: (topPerformers / videos.length) * 100,
      avgPerformers,
      avgPercent: (avgPerformers / videos.length) * 100,
      lowPerformers,
      lowPercent: (lowPerformers / videos.length) * 100,
      avgPerformanceScore,
      maxScore,
      minScore,
      consistency,
    };
  });

  // Sort by top performer percentage
  const sortedByTop = [...accountStats].sort((a, b) => b.topPercent - a.topPercent);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t.videoCompare}
          <InfoTooltip text={t.tooltips.videoPerformanceCompare} />
        </CardTitle>
        <CardDescription className="text-xs">
          {t.accountVideoDistribution}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedByTop.map((stats, index) => (
            <div key={stats.uniqueId} className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <span className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold",
                  index === 0 ? "bg-yellow-500 text-yellow-950" : "bg-muted text-muted-foreground"
                )}>
                  {index + 1}
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={stats.avatarUrl} />
                  <AvatarFallback>{stats.nickname.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{stats.nickname}</div>
                  <div className="text-xs text-muted-foreground">@{stats.uniqueId}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{stats.totalVideos} {t.videosUnit}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.avgScore} {stats.avgPerformanceScore.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Performance distribution bar */}
              <div className="h-6 flex rounded overflow-hidden mb-2">
                <div
                  className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${stats.topPercent}%` }}
                >
                  {stats.topPercent > 10 ? `${stats.topPercent.toFixed(0)}%` : ''}
                </div>
                <div
                  className="bg-gray-400 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${stats.avgPercent}%` }}
                >
                  {stats.avgPercent > 10 ? `${stats.avgPercent.toFixed(0)}%` : ''}
                </div>
                <div
                  className="bg-orange-500 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${stats.lowPercent}%` }}
                >
                  {stats.lowPercent > 10 ? `${stats.lowPercent.toFixed(0)}%` : ''}
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span className="text-muted-foreground">{t.topPerformersLabel} ({stats.topPerformers})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gray-400" />
                  <span className="text-muted-foreground">{t.avgPerformersLabel} ({stats.avgPerformers})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-orange-500" />
                  <span className="text-muted-foreground">{t.lowPerformersLabel} ({stats.lowPerformers})</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {t.maxPerformance}
                    <InfoTooltip text={t.tooltips.maxScore} className="ml-0" />
                  </div>
                  <div className="font-semibold text-green-600">{stats.maxScore.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {t.minPerformance}
                    <InfoTooltip text={t.tooltips.minScore} className="ml-0" />
                  </div>
                  <div className="font-semibold text-orange-600">{stats.minScore.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {t.variance}
                    <InfoTooltip text={t.tooltips.consistency} className="ml-0" />
                  </div>
                  <div className={cn(
                    "font-semibold",
                    stats.consistency < 100 ? "text-green-600" : stats.consistency < 150 ? "text-yellow-600" : "text-orange-600"
                  )}>
                    {stats.consistency.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary insights */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t.performanceDistribution}
          </h5>
          <div className="space-y-1 text-xs text-muted-foreground">
            {sortedByTop[0] && (
              <p>
                <span className="font-medium text-foreground">{sortedByTop[0].nickname}</span>
                {t.hasHighestTopRatio.replace('{percent}', sortedByTop[0].topPercent.toFixed(1))}
              </p>
            )}
            {accountStats.length > 1 && (
              <p>
                {t.mostConsistentAccount}{' '}
                <span className="font-medium text-foreground">
                  {[...accountStats].sort((a, b) => a.consistency - b.consistency)[0].nickname}
                </span>{' '}
                ({t.variance}: {[...accountStats].sort((a, b) => a.consistency - b.consistency)[0].consistency.toFixed(0)})
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountRecommendationsCard({
  recommendations,
  accounts,
  t,
}: {
  recommendations: AccountRecommendation[];
  accounts: SelectedAccount[];
  t: typeof translations.ko;
}) {
  const getAccountInfo = (uniqueId: string) => {
    const account = accounts.find(a => a.uniqueId === uniqueId);
    return account || { uniqueId, nickname: uniqueId, avatarUrl: undefined };
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          {t.recommendations}
          <InfoTooltip text={t.tooltips.recommendations} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {recommendations.map((rec) => {
            const accountInfo = getAccountInfo(rec.uniqueId);
            return (
              <div key={rec.uniqueId} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={accountInfo.avatarUrl} />
                    <AvatarFallback>{accountInfo.nickname.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium">{accountInfo.nickname}</span>
                    <div className="text-xs text-muted-foreground">@{rec.uniqueId}</div>
                  </div>
                </div>

                {/* Strengths */}
                {rec.uniqueStrengths.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {t.strengths}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rec.uniqueStrengths.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-green-500/5">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Areas to Improve */}
                {rec.areasToImprove.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-orange-600 mb-2 flex items-center gap-1">
                      <ArrowUp className="h-3 w-3" />
                      {t.improvements}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rec.areasToImprove.map((a, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-orange-500/5">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Learn From */}
                {rec.learnFrom.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-blue-600 mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {t.learnFrom}
                    </div>
                    <div className="space-y-2">
                      {rec.learnFrom.map((learn, i) => (
                        <div key={i} className="text-xs p-2 bg-blue-500/5 rounded">
                          <span className="font-medium">@{learn.fromAccount}</span>
                          <span className="text-muted-foreground"> - {learn.aspect}: </span>
                          <span>{learn.suggestion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function DeepAnalysisPage() {
  const { language: appLanguage } = useI18n();
  const [analysisLanguage, setAnalysisLanguage] = useState<"ko" | "en">(
    appLanguage === "ko" ? "ko" : "en"
  );
  const t = translations[analysisLanguage];

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected accounts state
  const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccount[]>([]);
  const [videoCount, setVideoCount] = useState<number>(100);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<Record<string, { progress: number; stage: string }>>({});

  // Tab state
  const [activeTab, setActiveTab] = useState("accounts");

  // Comparison state
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);

  // Saved reports state
  const [savedReports, setSavedReports] = useState<SavedComparisonReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(`/api/deep-analysis/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.users || []);
      } else {
        setSearchError(data.error || "Search failed");
        setSearchResults([]);
      }
    } catch (error) {
      setSearchError("Network error");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Select/deselect account
  const toggleAccount = useCallback((user: SearchResultUser) => {
    setSelectedAccounts((prev) => {
      const exists = prev.find((a) => a.uniqueId === user.uniqueId);
      if (exists) {
        return prev.filter((a) => a.uniqueId !== user.uniqueId);
      }
      if (prev.length >= 10) return prev;
      return [
        ...prev,
        {
          uniqueId: user.uniqueId,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          followers: user.followers,
          verified: user.verified,
          status: "pending" as const,
        },
      ];
    });
  }, []);

  // Remove account
  const removeAccount = useCallback((uniqueId: string) => {
    setSelectedAccounts((prev) => prev.filter((a) => a.uniqueId !== uniqueId));
  }, []);

  // Poll for analysis status
  const pollAnalysisStatus = useCallback(async (analysisId: string, uniqueId: string): Promise<AccountAnalysisData | null> => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/deep-analysis/${analysisId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to get analysis');
        }

        const analysis = data.analysis;

        if (analysis.status === 'COMPLETED') {
          return analysis as AccountAnalysisData;
        } else if (analysis.status === 'FAILED') {
          throw new Error('Analysis failed');
        }

        // Update progress based on status
        const progressMap: Record<string, { progress: number; stage: string }> = {
          'PENDING': { progress: 10, stage: 'fetching' },
          'PROCESSING': { progress: 50, stage: 'classifying' },
        };

        setAnalysisProgress((prev) => ({
          ...prev,
          [uniqueId]: progressMap[analysis.status] || { progress: 30, stage: 'fetching' },
        }));

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      } catch (error) {
        console.error(`[DeepAnalysis] Poll error for ${uniqueId}:`, error);
        throw error;
      }
    }

    throw new Error('Analysis timeout');
  }, []);

  // Start analysis
  const startAnalysis = useCallback(async () => {
    if (selectedAccounts.length === 0) return;

    setIsAnalyzing(true);
    setActiveTab("analysis");

    // Update all accounts to analyzing status
    setSelectedAccounts((prev) =>
      prev.map((a) => ({ ...a, status: "analyzing" as const }))
    );

    // Initialize progress
    const initialProgress: Record<string, { progress: number; stage: string }> = {};
    for (const account of selectedAccounts) {
      initialProgress[account.uniqueId] = { progress: 0, stage: "fetching" };
    }
    setAnalysisProgress(initialProgress);

    // Start analysis for each account in parallel
    const analysisPromises = selectedAccounts.map(async (account) => {
      try {
        // Start analysis
        setAnalysisProgress((prev) => ({
          ...prev,
          [account.uniqueId]: { progress: 5, stage: "fetching" },
        }));

        const response = await fetch('/api/deep-analysis/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uniqueId: account.uniqueId,
            videoCount,
            language: analysisLanguage,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to start analysis');
        }

        // If cached, mark as complete immediately
        if (data.cached) {
          setAnalysisProgress((prev) => ({
            ...prev,
            [account.uniqueId]: { progress: 100, stage: "insights" },
          }));

          // Fetch the cached analysis data
          const cachedResponse = await fetch(`/api/deep-analysis/${data.analysisId}`);
          const cachedData = await cachedResponse.json();

          setSelectedAccounts((prev) =>
            prev.map((a) =>
              a.uniqueId === account.uniqueId
                ? {
                    ...a,
                    status: "complete" as const,
                    analysisId: data.analysisId,
                    analysisData: cachedData.analysis,
                  }
                : a
            )
          );
          return;
        }

        // Update with analysis ID
        setSelectedAccounts((prev) =>
          prev.map((a) =>
            a.uniqueId === account.uniqueId
              ? { ...a, analysisId: data.analysisId }
              : a
          )
        );

        // Poll for completion
        const analysisData = await pollAnalysisStatus(data.analysisId, account.uniqueId);

        // Mark as complete
        setAnalysisProgress((prev) => ({
          ...prev,
          [account.uniqueId]: { progress: 100, stage: "insights" },
        }));

        setSelectedAccounts((prev) =>
          prev.map((a) =>
            a.uniqueId === account.uniqueId
              ? {
                  ...a,
                  status: "complete" as const,
                  analysisData: analysisData || undefined,
                }
              : a
          )
        );
      } catch (error) {
        console.error(`[DeepAnalysis] Analysis error for ${account.uniqueId}:`, error);
        setSelectedAccounts((prev) =>
          prev.map((a) =>
            a.uniqueId === account.uniqueId
              ? { ...a, status: "error" as const }
              : a
          )
        );
      }
    });

    await Promise.all(analysisPromises);
    setIsAnalyzing(false);
  }, [selectedAccounts, videoCount, analysisLanguage, pollAnalysisStatus]);

  const isAccountSelected = (uniqueId: string) =>
    selectedAccounts.some((a) => a.uniqueId === uniqueId);

  // Start comparison
  const startComparison = useCallback(async () => {
    const completedAccounts = selectedAccounts.filter(a => a.status === 'complete' && a.analysisId);
    if (completedAccounts.length < 2) return;

    setIsComparing(true);
    setComparisonError(null);

    try {
      const response = await fetch('/api/deep-analysis/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisIds: completedAccounts.map(a => a.analysisId),
          language: analysisLanguage,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Comparison failed');
      }

      setComparisonData(data.comparison);
      setCurrentReportId(data.reportId);
    } catch (error) {
      console.error('[DeepAnalysis] Comparison error:', error);
      setComparisonError(error instanceof Error ? error.message : 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  }, [selectedAccounts, analysisLanguage]);

  // Load saved comparison reports
  const loadSavedReports = useCallback(async () => {
    setIsLoadingReports(true);
    try {
      const response = await fetch('/api/deep-analysis/compare/list');
      const data = await response.json();
      if (data.success) {
        setSavedReports(data.reports);
      }
    } catch (error) {
      console.error('[DeepAnalysis] Load reports error:', error);
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  // Load saved reports on mount and when showHistory is toggled
  useEffect(() => {
    if (showHistory) {
      loadSavedReports();
    }
  }, [showHistory, loadSavedReports]);

  // Clear selection and start new comparison
  const clearAndStartNew = useCallback(() => {
    setSelectedAccounts([]);
    setComparisonData(null);
    setComparisonError(null);
    setCurrentReportId(null);
    setAnalysisProgress({});
    setActiveTab("accounts");
    setSearchResults([]);
    setSearchQuery("");
  }, []);

  // Load a saved report
  const loadSavedReport = useCallback(async (reportId: string) => {
    try {
      const response = await fetch(`/api/deep-analysis/compare?id=${reportId}`);
      const data = await response.json();
      if (data.success && data.report) {
        // Populate selectedAccounts from the saved report's accounts (including analysisData)
        const loadedAccounts: SelectedAccount[] = data.report.accounts.map((acc: {
          uniqueId: string;
          nickname: string;
          avatarUrl?: string;
          verified: boolean;
          followers: number;
          analysisId?: string;
          analysisData?: AccountAnalysisData;
        }) => ({
          uniqueId: acc.uniqueId,
          nickname: acc.nickname,
          avatarUrl: acc.avatarUrl,
          followers: acc.followers,
          verified: acc.verified,
          analysisId: acc.analysisId,
          status: 'complete' as const,
          analysisData: acc.analysisData,
        }));
        setSelectedAccounts(loadedAccounts);

        setComparisonData({
          overallSummary: data.report.overallSummary,
          rankings: data.report.rankings,
          significantDifferences: data.report.significantDifferences,
          radarChartData: data.report.radarChartData,
          strategicInsights: data.report.strategicInsights,
          accountSpecificRecommendations: data.report.accountRecommendations,
          competitivePositioning: data.report.competitivePositioning,
        });
        setCurrentReportId(reportId);
        setShowHistory(false);
        setActiveTab("comparison");
      }
    } catch (error) {
      console.error('[DeepAnalysis] Load report error:', error);
    }
  }, []);

  // Delete a saved report
  const deleteSavedReport = useCallback(async (reportId: string) => {
    try {
      await fetch(`/api/deep-analysis/compare/list?id=${reportId}`, {
        method: 'DELETE',
      });
      setSavedReports((prev) => prev.filter((r) => r.id !== reportId));
      if (currentReportId === reportId) {
        setComparisonData(null);
        setCurrentReportId(null);
      }
    } catch (error) {
      console.error('[DeepAnalysis] Delete report error:', error);
    }
  }, [currentReportId]);

  // Check if comparison can be started
  const canStartComparison = selectedAccounts.filter(a => a.status === 'complete').length >= 2;

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            {t.savedReports}
          </Button>
          {(selectedAccounts.length > 0 || comparisonData) && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAndStartNew}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t.newComparison}
            </Button>
          )}
          <Select value={analysisLanguage} onValueChange={(v) => setAnalysisLanguage(v as "ko" | "en")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ko">{t.korean}</SelectItem>
              <SelectItem value="en">{t.english}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Saved Reports History Panel */}
      {showHistory && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                {t.savedReports}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingReports ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t.loadingReports}</span>
              </div>
            ) : savedReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t.noSavedReports}
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {savedReports.map((report) => (
                    <div
                      key={report.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        currentReportId === report.id && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{report.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(report.createdAt).toLocaleDateString(analysisLanguage === 'ko' ? 'ko-KR' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {report.accounts.map((acc) => (
                            <Avatar key={acc.uniqueId} className="h-6 w-6">
                              <AvatarImage src={acc.avatarUrl || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {acc.nickname.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadSavedReport(report.id)}
                        >
                          {t.viewReport}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteSavedReport(report.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 self-start">
          <TabsTrigger value="accounts" className="gap-2">
            <Users className="h-4 w-4" />
            {t.accountsTab}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2" disabled={selectedAccounts.length === 0}>
            <BarChart3 className="h-4 w-4" />
            {t.analysisTab}
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2" disabled={selectedAccounts.length < 2}>
            <TrendingUp className="h-4 w-4" />
            {t.comparisonTab}
          </TabsTrigger>
        </TabsList>

        {/* Account Selection Tab */}
        <TabsContent value="accounts" className="flex-1 flex gap-6 min-h-0 mt-0">
          {/* Search Panel */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t.searchResults}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pt-0">
              {searchError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{searchError}</AlertDescription>
                </Alert>
              )}
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">{t.loading}</span>
                </div>
              ) : searchResults.length > 0 ? (
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-2">
                    {searchResults.map((user) => (
                      <AccountSearchResult
                        key={user.id}
                        user={user}
                        isSelected={isAccountSelected(user.uniqueId)}
                        onSelect={() => toggleAccount(user)}
                        t={t}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mb-4 opacity-50" />
                  <p>{searchQuery ? t.noResults : t.selectToAnalyze}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Accounts Panel */}
          <Card className="w-96 flex flex-col min-h-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t.selectedAccounts}</CardTitle>
                <Badge variant="outline">{selectedAccounts.length}/10</Badge>
              </div>
              <CardDescription>{t.maxAccounts}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col pt-0">
              {selectedAccounts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-center">{t.noAccountsSelected}</p>
                </div>
              ) : (
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-2">
                    {selectedAccounts.map((account) => (
                      <SelectedAccountCard
                        key={account.uniqueId}
                        account={account}
                        onRemove={() => removeAccount(account.uniqueId)}
                        t={t}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Settings & Start Button */}
              <div className="pt-4 border-t mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t.videoCount}</span>
                  <Select
                    value={String(videoCount)}
                    onValueChange={(v) => setVideoCount(Number(v))}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={startAnalysis}
                  disabled={selectedAccounts.length === 0 || isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.analyzing}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t.startAnalysis}
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual Analysis Tab */}
        <TabsContent value="analysis" className="flex-1 min-h-0 mt-0">
          {isAnalyzing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedAccounts.map((account) => (
                <AnalysisProgressCard
                  key={account.uniqueId}
                  account={account}
                  progress={analysisProgress[account.uniqueId]?.progress || 0}
                  stage={analysisProgress[account.uniqueId]?.stage || ""}
                  t={t}
                />
              ))}
            </div>
          ) : selectedAccounts.some((a) => a.status === "complete") ? (
            <ScrollArea className="h-full">
              <div className="space-y-6">
                {selectedAccounts
                  .filter((a) => a.status === "complete" && a.analysisData)
                  .map((account) => (
                    <AccountAnalysisCard
                      key={account.uniqueId}
                      account={account}
                      data={account.analysisData!}
                      t={t}
                    />
                  ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
              <p>Start analysis to see individual results</p>
            </div>
          )}
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="flex-1 min-h-0 mt-0">
          {selectedAccounts.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>{t.minTwoAccounts}</p>
            </div>
          ) : !canStartComparison ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-12 w-12 mb-4 opacity-50 animate-spin" />
              <p>{t.waitingForAnalysis}</p>
            </div>
          ) : !comparisonData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium mb-2">{t.comparisonTab}</p>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {selectedAccounts.filter(a => a.status === 'complete').length} {t.accountsToCompare}
                {' '}{t.aiComparisonDescription}
              </p>
              {comparisonError && (
                <Alert variant="destructive" className="mb-4 max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{comparisonError}</AlertDescription>
                </Alert>
              )}
              <Button
                size="lg"
                className="gap-2"
                onClick={startComparison}
                disabled={isComparing}
              >
                {isComparing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.comparing}
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    {t.compare}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-6 pb-6">
                {/* Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      {t.comparisonSummary}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{comparisonData.overallSummary}</p>
                  </CardContent>
                </Card>

                {/* Radar Chart and Rankings side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ComparisonRadarChart
                    data={comparisonData.radarChartData}
                    accounts={selectedAccounts}
                    t={t}
                  />
                  <RankingsTable
                    rankings={comparisonData.rankings}
                    accounts={selectedAccounts}
                    t={t}
                  />
                </div>

                {/* BCG Matrix and Significant Differences */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <BCGMatrixCard
                    positioning={comparisonData.competitivePositioning}
                    accounts={selectedAccounts}
                    t={t}
                  />
                  <SignificantDiffsCard
                    diffs={comparisonData.significantDifferences}
                    t={t}
                  />
                </div>

                {/* Video Performance Comparison */}
                <VideoPerformanceComparisonCard
                  accounts={selectedAccounts}
                  t={t}
                />

                {/* Strategic Insights */}
                {comparisonData.strategicInsights.length > 0 && (
                  <StrategicInsightsCard
                    insights={comparisonData.strategicInsights}
                    t={t}
                  />
                )}

                {/* Account-specific Recommendations */}
                {comparisonData.accountSpecificRecommendations.length > 0 && (
                  <AccountRecommendationsCard
                    recommendations={comparisonData.accountSpecificRecommendations}
                    accounts={selectedAccounts}
                    t={t}
                  />
                )}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
