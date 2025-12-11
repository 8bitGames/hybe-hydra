"use client";

import React, { useState, useCallback } from "react";
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
    maxAccounts: "최대 5개 계정",
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
    high: "높음",
    medium: "중간",
    low: "낮음",
  },
  en: {
    title: "Deep Analysis",
    subtitle: "Detailed analysis and comparison of TikTok accounts",
    searchPlaceholder: "Search TikTok accounts (@username)",
    search: "Search",
    selectedAccounts: "Selected Accounts",
    maxAccounts: "Max 5 accounts",
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
    high: "High",
    medium: "Medium",
    low: "Low",
  },
};

// =============================================================================
// Components
// =============================================================================

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
    exceptional: "탁월함",
    "above-average": "평균 이상",
    average: "평균",
    "below-average": "평균 이하",
    "needs-improvement": "개선 필요",
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
              <span className="font-medium text-sm">AI 분석 요약</span>
            </div>
            <p className="text-sm text-muted-foreground">{data.aiInsights.summary}</p>
          </div>
        )}

        {/* Basic Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3 w-3" />
              팔로워
            </div>
            <div className="text-lg font-semibold">{formatNumber(data.followers)}</div>
          </div>
          <div className="p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Play className="h-3 w-3" />
              분석 영상
            </div>
            <div className="text-lg font-semibold">{formatNumber(data.videosAnalyzed)}</div>
          </div>
          <div className="p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Eye className="h-3 w-3" />
              평균 조회수
            </div>
            <div className="text-lg font-semibold">{formatNumber(data.basicMetrics?.avgViews || 0)}</div>
          </div>
          <div className="p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3 w-3" />
              참여율
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
                  강점
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
                  개선 영역
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
              추천 액션
            </div>
            <div className="space-y-2">
              {data.aiInsights.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Badge
                    variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                    className="shrink-0"
                  >
                    {rec.priority === 'high' ? '높음' : rec.priority === 'medium' ? '중간' : '낮음'}
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
              <span className="text-muted-foreground">주요 콘텐츠:</span>
              <Badge variant="outline">{data.contentMixMetrics.dominantContentType}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">다양성:</span>
              <span className="font-medium">{(data.contentMixMetrics.contentDiversity * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Engagement Ranking */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {t.byEngagement}
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
        </CardTitle>
        <CardDescription className="text-xs">{positioning.explanation}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Matrix grid */}
          {(['star', 'question-mark', 'cash-cow', 'dog'] as const).map((quadrant) => {
            const itemsInQuadrant = positioning.matrix.filter(m => m.quadrant === quadrant);
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
                <span className="font-medium">추천: </span>
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
      if (prev.length >= 5) return prev;
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
    } catch (error) {
      console.error('[DeepAnalysis] Comparison error:', error);
      setComparisonError(error instanceof Error ? error.message : 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  }, [selectedAccounts, analysisLanguage]);

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
        <div className="flex items-center gap-4">
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
                <Badge variant="outline">{selectedAccounts.length}/5</Badge>
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
              <p>분석이 완료될 때까지 기다려주세요...</p>
            </div>
          ) : !comparisonData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium mb-2">{t.comparisonTab}</p>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {selectedAccounts.filter(a => a.status === 'complete').length}개의 계정을 비교 분석합니다.
                AI가 각 계정의 강점과 약점을 비교하고 전략적 인사이트를 제공합니다.
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
