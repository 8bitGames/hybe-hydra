"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Sparkles,
  Eye,
  Heart,
  MessageCircle,
  Hash,
  Play,
  ExternalLink,
  Search,
  Lightbulb,
  Target,
  Zap,
  ArrowRight,
  Clock,
  BarChart3,
  Video,
  CheckCircle,
  Loader2,
  FolderOpen,
  Trophy,
  Users,
  Calendar,
  X,
  MoreVertical,
  Copy,
  ChevronDown,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkflowStore } from "@/lib/stores/workflow-store";

// ============================================================================
// Types
// ============================================================================

const TRACKED_KEYWORDS_STORAGE_KEY = "hybe-trend-tracked-keywords";
const SEARCH_HISTORY_STORAGE_KEY = "hybe-trend-search-history";

interface TrackedKeyword {
  id: string;
  keyword: string;
  type: "keyword" | "hashtag";
  addedAt: string;
  lastAnalyzedAt: string;
  currentMetrics: {
    avgViews: number;
    avgEngagement: number;
    totalVideos: number;
  };
  trend: {
    direction: "up" | "down" | "stable";
    changePercent: number;
  };
  topHashtags: string[];
}

// Enhanced Viral Video interface (supports 50 videos per keyword)
interface ViralVideo {
  id: string;
  author: string;
  videoUrl: string;
  description: string;
  views: number;
  engagement: number;
  hashtags: string[];
  viralScore: number;
  trend: {
    direction: "up" | "down" | "stable";
    changePercent: number;
  };
}

interface KeywordAnalysisData {
  keyword: string;
  aggregateStats: {
    avgViews: number;
    avgEngagement: number;
    totalVideos: number;
    viralThreshold: string;
  };
  topHashtags: { tag: string; count: number; avgEngagement: number }[];
  viralVideos: ViralVideo[];
  aiSuggestions: string[];
  topCreators: { name: string; avgEngagement: number }[];
  aiInsights?: {
    summary: string;
    contentStrategy: string[];
    hashtagStrategy: string[];
    captionTemplates: string[];
    videoIdeas: string[];
  };
}

interface SearchHistoryItem {
  id: string;
  keyword: string;
  searchedAt: string;
  videosFound: number;
  avgEngagement: number;
}

interface ContentSummary {
  totalGenerated: number;
  processing: number;
  completed: number;
  published: number;
  last24h: number;
  last7d: number;
}

interface CrossKeywordInsight {
  commonHashtags: { tag: string; keywordCount: number }[];
  todayRecommendation: {
    primary: string;
    secondary: string;
  };
}

// API Response Types (from /api/v1/trends/keyword-analysis)
interface APIHashtagInsight {
  tag: string;
  count: number;
  avgEngagement: number;
}

interface APICreatorInsight {
  name: string;
  videoCount: number;
  avgEngagement: number;
  totalViews: number;
}

interface APIAnalyzedVideo {
  id: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  description: string;
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  };
  engagementRate: number;
  likeToViewRatio: number;
  hashtags: string[];
  videoUrl: string;
  thumbnailUrl?: string | null;
  rank: number;
}

interface APIKeywordAnalysis {
  keyword: string;
  totalVideos: number;
  aggregateStats: {
    totalViews: number;
    avgViews: number;
    maxViews: number;
    minViews: number;
    avgEngagementRate: number;
    medianViews: number;
    topPerformerThreshold: number;
  };
  performanceTiers: {
    viral: APIAnalyzedVideo[];
    highPerforming: APIAnalyzedVideo[];
    average: APIAnalyzedVideo[];
    belowAverage: APIAnalyzedVideo[];
  };
  hashtagInsights: {
    topHashtags: APIHashtagInsight[];
    hashtagCombos: { combo: string[]; count: number }[];
    recommendedHashtags: string[];
  };
  creatorInsights: {
    topCreators: APICreatorInsight[];
    uniqueCreators: number;
  };
  aiInsights?: {
    summary: string;
    contentStrategy: string[];
    hashtagStrategy: string[];
    captionTemplates: string[];
    videoIdeas: string[];
  };
  videos: APIAnalyzedVideo[];
  cachedAt?: string;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchKeywordAnalysis(keywords: string[], limit: number = 50, forceRefresh: boolean = false): Promise<APIKeywordAnalysis[]> {
  const params = new URLSearchParams({
    keywords: keywords.join(","),
    limit: limit.toString(),
  });

  if (forceRefresh) {
    params.set("refresh", "true");
  }

  // Get auth token from localStorage
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const response = await fetch(`/api/v1/trends/keyword-analysis?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch keyword analysis: ${response.statusText}`);
  }

  const data = await response.json();
  return data.analyses || [];
}

async function fetchContentSummary(): Promise<ContentSummary> {
  try {
    // Get auth token from localStorage
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    const response = await fetch("/api/v1/dashboard/stats", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error("Failed to fetch content summary");
    }
    const data = await response.json();
    return {
      totalGenerated: data.totalGenerations || 0,
      processing: data.processingCount || 0,
      completed: data.completedCount || 0,
      published: data.publishedCount || 0,
      last24h: data.last24h || 0,
      last7d: data.last7d || 0,
    };
  } catch {
    // Return default values if API fails
    return {
      totalGenerated: 0,
      processing: 0,
      completed: 0,
      published: 0,
      last24h: 0,
      last7d: 0,
    };
  }
}

// ============================================================================
// Data Transformation Functions
// ============================================================================

function transformAPIToViralVideo(video: APIAnalyzedVideo, index: number, totalVideos: number): ViralVideo {
  const views = video.stats.playCount;
  const engagement = video.engagementRate;

  // Determine tier based on rank position
  const tierRatio = video.rank / totalVideos;
  const tier = tierRatio <= 0.1 ? "viral" : tierRatio <= 0.3 ? "highPerforming" : "average";

  // Calculate viral score based on engagement and views
  const baseScore = Math.min(100, Math.round(engagement * 5 + (views > 0 ? Math.log10(views) * 5 : 0)));
  const tierBonus = tier === "viral" ? 20 : tier === "highPerforming" ? 10 : 0;
  const viralScore = Math.min(100, baseScore + tierBonus);

  // Determine trend direction based on engagement
  const trendDirection: "up" | "down" | "stable" =
    engagement > 15 ? "up" : engagement < 5 ? "down" : "stable";

  return {
    id: video.id,
    author: video.author.name || video.author.id,
    videoUrl: video.videoUrl,
    description: video.description || "",
    views,
    engagement,
    hashtags: video.hashtags || [],
    viralScore,
    trend: {
      direction: trendDirection,
      changePercent: Math.round(Math.abs(engagement - 10) * 2),
    },
  };
}

function transformAPIToKeywordAnalysis(apiData: APIKeywordAnalysis): KeywordAnalysisData {
  const totalVideos = apiData.videos.length;
  const allVideos = apiData.videos.map((v, i) => transformAPIToViralVideo(v, i, totalVideos));

  // Calculate viral threshold
  const avgEngagement = apiData.aggregateStats.avgEngagementRate;
  const viralThreshold = avgEngagement > 10 ? `>${Math.round(avgEngagement * 1.5)}%` : `>${Math.round(avgEngagement * 1.2)}%`;

  // Transform top hashtags
  const topHashtags = apiData.hashtagInsights.topHashtags.slice(0, 10).map(h => ({
    tag: h.tag,
    count: h.count,
    avgEngagement: h.avgEngagement,
  }));

  // Transform top creators
  const topCreators = apiData.creatorInsights.topCreators.slice(0, 5).map(c => ({
    name: c.name,
    avgEngagement: c.avgEngagement,
  }));

  // Build AI suggestions from aiInsights
  const aiSuggestions: string[] = [];
  if (apiData.aiInsights) {
    if (apiData.aiInsights.contentStrategy) {
      aiSuggestions.push(...apiData.aiInsights.contentStrategy.slice(0, 2));
    }
    if (apiData.aiInsights.hashtagStrategy) {
      aiSuggestions.push(...apiData.aiInsights.hashtagStrategy.slice(0, 1));
    }
    if (apiData.aiInsights.captionTemplates) {
      aiSuggestions.push(...apiData.aiInsights.captionTemplates.slice(0, 1));
    }
  }

  // Fallback suggestions if no AI insights
  if (aiSuggestions.length === 0) {
    aiSuggestions.push(
      `Use trending hashtags: ${topHashtags.slice(0, 3).map(h => `#${h.tag}`).join(", ")}`,
      `Target engagement rate: ${viralThreshold}`,
      `Top creators in this niche: ${topCreators.slice(0, 2).map(c => `@${c.name}`).join(", ")}`
    );
  }

  return {
    keyword: apiData.keyword,
    aggregateStats: {
      avgViews: Math.round(apiData.aggregateStats.avgViews),
      avgEngagement: Math.round(apiData.aggregateStats.avgEngagementRate * 10) / 10,
      totalVideos: apiData.totalVideos,
      viralThreshold,
    },
    topHashtags,
    viralVideos: allVideos,
    aiSuggestions,
    topCreators,
    aiInsights: apiData.aiInsights,
  };
}

function transformAPIToTrackedKeyword(apiData: APIKeywordAnalysis, existingKeyword?: TrackedKeyword): TrackedKeyword {
  const avgEngagement = apiData.aggregateStats.avgEngagementRate;
  const prevEngagement = existingKeyword?.currentMetrics.avgEngagement || avgEngagement;
  const changePercent = Math.abs(Math.round((avgEngagement - prevEngagement) / prevEngagement * 100));

  const trendDirection: "up" | "down" | "stable" =
    avgEngagement > prevEngagement * 1.05 ? "up" :
    avgEngagement < prevEngagement * 0.95 ? "down" : "stable";

  return {
    id: existingKeyword?.id || `kw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    keyword: apiData.keyword,
    type: apiData.keyword.match(/^[a-zA-Z0-9]+$/) ? "hashtag" : "keyword",
    addedAt: existingKeyword?.addedAt || new Date().toISOString(),
    lastAnalyzedAt: new Date().toISOString(),
    currentMetrics: {
      avgViews: Math.round(apiData.aggregateStats.avgViews),
      avgEngagement: Math.round(avgEngagement * 10) / 10,
      totalVideos: apiData.totalVideos,
    },
    trend: {
      direction: trendDirection,
      changePercent,
    },
    topHashtags: apiData.hashtagInsights.topHashtags.slice(0, 5).map(h => h.tag),
  };
}

function calculateCrossKeywordInsights(
  analysisData: Record<string, KeywordAnalysisData>,
  trackedKeywords: TrackedKeyword[],
  isKorean: boolean
): CrossKeywordInsight {
  const hashtagCounts: Record<string, number> = {};

  // Count hashtags across all keywords
  Object.values(analysisData).forEach(analysis => {
    analysis.topHashtags.forEach(h => {
      hashtagCounts[h.tag] = (hashtagCounts[h.tag] || 0) + 1;
    });
  });

  // Sort by count and get common hashtags
  const commonHashtags = Object.entries(hashtagCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, keywordCount]) => ({ tag, keywordCount }));

  // Find best performing keyword for recommendation
  const bestKeyword = trackedKeywords.reduce((best, current) => {
    if (!best || current.currentMetrics.avgEngagement > best.currentMetrics.avgEngagement) {
      return current;
    }
    return best;
  }, trackedKeywords[0]);

  const secondBest = trackedKeywords
    .filter(k => k.id !== bestKeyword?.id)
    .reduce((best, current) => {
      if (!best || current.currentMetrics.avgEngagement > best.currentMetrics.avgEngagement) {
        return current;
      }
      return best;
    }, undefined as TrackedKeyword | undefined);

  const primaryRec = bestKeyword
    ? isKorean
      ? `#${bestKeyword.keyword} 트렌드 콘텐츠 - 참여율 ${bestKeyword.currentMetrics.avgEngagement}%`
      : `#${bestKeyword.keyword} trend content - ${bestKeyword.currentMetrics.avgEngagement}% engagement`
    : isKorean ? "키워드를 추가하세요" : "Add keywords to get recommendations";

  const secondaryRec = secondBest
    ? isKorean
      ? `${bestKeyword?.keyword} x ${secondBest.keyword} 크로스오버 콘텐츠`
      : `${bestKeyword?.keyword} x ${secondBest.keyword} crossover content`
    : isKorean ? "더 많은 키워드를 추가하세요" : "Add more keywords for alternatives";

  return {
    commonHashtags,
    todayRecommendation: {
      primary: primaryRec,
      secondary: secondaryRec,
    },
  };
}

// ============================================================================
// LocalStorage Functions
// ============================================================================

function loadTrackedKeywords(): TrackedKeyword[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(TRACKED_KEYWORDS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTrackedKeywords(keywords: TrackedKeyword[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TRACKED_KEYWORDS_STORAGE_KEY, JSON.stringify(keywords));
  } catch {
    console.error("Failed to save tracked keywords to localStorage");
  }
}

function loadSearchHistory(): SearchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(history: SearchHistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
  } catch {
    console.error("Failed to save search history to localStorage");
  }
}

function addToSearchHistory(keyword: string, videosFound: number, avgEngagement: number): void {
  const history = loadSearchHistory();
  const newItem: SearchHistoryItem = {
    id: `h-${Date.now()}`,
    keyword,
    searchedAt: new Date().toISOString(),
    videosFound,
    avgEngagement,
  };

  // Remove existing entry for same keyword
  const filtered = history.filter(h => h.keyword.toLowerCase() !== keyword.toLowerCase());
  saveSearchHistory([newItem, ...filtered]);
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

function formatRelativeTime(dateStr: string, language: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return language === "ko" ? "오늘" : "Today";
  if (diffDays === 1) return language === "ko" ? "어제" : "Yesterday";
  if (diffDays < 7) return language === "ko" ? `${diffDays}일 전` : `${diffDays} days ago`;
  return language === "ko" ? "1주 전" : "Last week";
}

// ============================================================================
// Sub-Components
// ============================================================================

function TrendIndicator({ direction, changePercent }: { direction: "up" | "down" | "stable"; changePercent: number }) {
  if (direction === "up") {
    return (
      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" />
        <span className="text-xs font-medium">+{changePercent}%</span>
      </span>
    );
  }
  if (direction === "down") {
    return (
      <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
        <TrendingDown className="h-3 w-3" />
        <span className="text-xs font-medium">-{changePercent}%</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground">
      <Minus className="h-3 w-3" />
      <span className="text-xs font-medium">0%</span>
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left w-full"
    >
      <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
      </div>
    </button>
  );
}

function KeywordCard({
  keyword,
  isSelected,
  onClick,
  onDelete,
}: {
  keyword: TrackedKeyword;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        "flex-shrink-0 w-[160px] min-h-[88px] p-3 rounded-lg border transition-all text-left relative group cursor-pointer",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-background hover:border-primary/50"
      )}
      onClick={onClick}
    >
      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground border border-border opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
        title="Remove keyword"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex items-center gap-2 mb-2 pr-5">
        <span className="text-sm font-semibold truncate flex-1 min-w-0">
          {keyword.type === "hashtag" ? "#" : ""}
          {keyword.keyword}
        </span>
        <TrendIndicator direction={keyword.trend.direction} changePercent={keyword.trend.changePercent} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="h-3 w-3 flex-shrink-0" />
          <span>{formatCount(keyword.currentMetrics.avgViews)} avg</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Zap className="h-3 w-3 flex-shrink-0" />
          <span>{formatPercent(keyword.currentMetrics.avgEngagement)}</span>
        </div>
      </div>
    </div>
  );
}

function AddKeywordCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[160px] min-h-[88px] p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2"
    >
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Plus className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground">Add Keyword</span>
    </button>
  );
}

function HashtagBadge({
  tag,
  count,
  engagement,
  onClick,
}: {
  tag: string;
  count?: number;
  engagement?: number;
  onClick?: () => void;
}) {
  return (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:bg-muted transition-colors text-xs"
      onClick={onClick}
    >
      #{tag}
      {count && <span className="ml-1 text-muted-foreground">({count})</span>}
      {engagement && <span className="ml-1 text-emerald-600">{formatPercent(engagement)}</span>}
    </Badge>
  );
}


// Compact Video Table Row - Click row to go to TikTok
function VideoTableRow({
  video,
  rank,
  isKorean,
  onCreateFromVideo,
}: {
  video: ViralVideo;
  rank: number;
  isKorean: boolean;
  onCreateFromVideo: (videoId: string) => void;
}) {
  const handleCopyHashtags = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tags = video.hashtags.map((h) => `#${h}`).join(" ");
    navigator.clipboard.writeText(tags);
  };

  const handleRowClick = () => {
    window.open(video.videoUrl, "_blank");
  };

  return (
    <TableRow
      className="hover:bg-muted/50 cursor-pointer"
      onClick={handleRowClick}
    >
      <TableCell className="font-medium text-center w-12">
        #{rank}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">@{video.author}</span>
          <TrendIndicator direction={video.trend.direction} changePercent={video.trend.changePercent} />
        </div>
      </TableCell>
      <TableCell className="max-w-[200px]">
        <p className="text-xs text-muted-foreground line-clamp-1">{video.description}</p>
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCount(video.views)}
      </TableCell>
      <TableCell className="text-right">
        <span className={cn(
          "font-medium",
          video.engagement > 10 ? "text-emerald-600 dark:text-emerald-400" : ""
        )}>
          {formatPercent(video.engagement)}
        </span>
      </TableCell>
      <TableCell className="max-w-[150px]">
        <div className="flex flex-wrap gap-1">
          {video.hashtags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              #{tag}
            </Badge>
          ))}
          {video.hashtags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{video.hashtags.length - 3}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center font-semibold">
        {video.viralScore}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreateFromVideo(video.id)}>
              <Sparkles className="h-4 w-4 mr-2" />
              {isKorean ? "이 영상 참고해서 생성" : "Create from this video"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(video.videoUrl, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {isKorean ? "TikTok에서 보기" : "View on TikTok"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleCopyHashtags(e as unknown as React.MouseEvent)}>
              <Copy className="h-4 w-4 mr-2" />
              {isKorean ? "해시태그 복사" : "Copy hashtags"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Full Viral Video Section Component
function ViralVideoSection({
  keyword,
  videos,
  trendData,
  isKorean,
  onCreateFromTrend,
  onCreateFromVideo,
}: {
  keyword: string;
  videos: ViralVideo[];
  trendData: {
    topHashtags: string[];
    avgEngagement: number;
    viralThreshold: string;
    videoCount: number;
  };
  isKorean: boolean;
  onCreateFromTrend: () => void;
  onCreateFromVideo: (videoId: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(10);
  const [sortBy, setSortBy] = useState<"views" | "engagement" | "score" | "recent">("views");
  const [fullModalOpen, setFullModalOpen] = useState(false);

  const sortedVideos = useMemo(() => {
    const sorted = [...videos];
    switch (sortBy) {
      case "engagement":
        return sorted.sort((a, b) => b.engagement - a.engagement);
      case "score":
        return sorted.sort((a, b) => b.viralScore - a.viralScore);
      case "recent":
        return sorted; // Already sorted by recent in mock
      default: // views
        return sorted.sort((a, b) => b.views - a.views);
    }
  }, [videos, sortBy]);

  const tableVideos = sortedVideos.slice(0, visibleCount);
  const remainingCount = videos.length - visibleCount;

  const handleLoadMore = () => {
    const newCount = Math.min(visibleCount + 10, videos.length);
    setVisibleCount(newCount);
  };

  const translations = {
    title: isKorean ? "바이럴 영상" : "Viral Videos",
    createFromTrend: isKorean ? "이 트렌드로 생성" : "Create from this trend",
    loadMore: isKorean ? "더 보기" : "Load More",
    remaining: isKorean ? "개 남음" : "remaining",
    viewAll: isKorean ? "전체 보기" : "View All",
    rank: isKorean ? "순위" : "Rank",
    creator: isKorean ? "크리에이터" : "Creator",
    description: isKorean ? "설명" : "Description",
    views: isKorean ? "조회수" : "Views",
    engagement: isKorean ? "참여율" : "Eng %",
    hashtags: isKorean ? "해시태그" : "Hashtags",
    score: isKorean ? "점수" : "Score",
    actions: isKorean ? "액션" : "Actions",
    allVideosTitle: isKorean ? "전체 바이럴 영상" : "All Viral Videos",
    sortBy: isKorean ? "정렬" : "Sort by",
    sortViews: isKorean ? "조회수" : "Views",
    sortEngagement: isKorean ? "참여율" : "Engagement",
    sortScore: isKorean ? "바이럴 점수" : "Viral Score",
    sortRecent: isKorean ? "최신순" : "Recent",
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-semibold">{translations.title}</h4>
          <Badge variant="secondary" className="text-xs">
            {videos.length}
          </Badge>
        </div>
        <Button size="sm" onClick={onCreateFromTrend}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {translations.createFromTrend}
        </Button>
      </div>

      {/* Video Table (All videos in list) */}
      {tableVideos.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">{translations.rank}</TableHead>
                <TableHead>{translations.creator}</TableHead>
                <TableHead>{translations.description}</TableHead>
                <TableHead className="text-right">{translations.views}</TableHead>
                <TableHead className="text-right">{translations.engagement}</TableHead>
                <TableHead>{translations.hashtags}</TableHead>
                <TableHead className="text-center">{translations.score}</TableHead>
                <TableHead className="text-right w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableVideos.map((video, i) => (
                <VideoTableRow
                  key={video.id}
                  video={video}
                  rank={i + 1}
                  isKorean={isKorean}
                  onCreateFromVideo={onCreateFromVideo}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load More */}
      {remainingCount > 0 && (
        <div className="flex items-center justify-center">
          <Button variant="outline" size="sm" onClick={handleLoadMore}>
            <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
            {translations.loadMore} ({remainingCount} {translations.remaining})
          </Button>
        </div>
      )}

      {/* Full Modal Dialog */}
      <Dialog open={fullModalOpen} onOpenChange={setFullModalOpen}>
        <DialogContent className="w-[90vw] max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                {translations.allVideosTitle}: #{keyword}
                <Badge variant="secondary">{videos.length}</Badge>
              </DialogTitle>
              <div className="flex items-center gap-2 mr-8">
                <span className="text-sm text-muted-foreground">{translations.sortBy}:</span>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">{translations.sortViews}</SelectItem>
                    <SelectItem value="engagement">{translations.sortEngagement}</SelectItem>
                    <SelectItem value="score">{translations.sortScore}</SelectItem>
                    <SelectItem value="recent">{translations.sortRecent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">{translations.rank}</TableHead>
                    <TableHead>{translations.creator}</TableHead>
                    <TableHead>{translations.description}</TableHead>
                    <TableHead className="text-right">{translations.views}</TableHead>
                    <TableHead className="text-right">{translations.engagement}</TableHead>
                    <TableHead>{translations.hashtags}</TableHead>
                    <TableHead className="text-center">{translations.score}</TableHead>
                    <TableHead className="text-right w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedVideos.map((video, i) => (
                    <VideoTableRow
                      key={video.id}
                      video={video}
                      rank={i + 1}
                      isKorean={isKorean}
                      onCreateFromVideo={onCreateFromVideo}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
          <div className="flex-shrink-0 pt-4 border-t mt-4">
            <Button className="w-full" onClick={onCreateFromTrend}>
              <Sparkles className="h-4 w-4 mr-2" />
              {translations.createFromTrend}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  variant?: "default" | "primary";
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        variant === "primary"
          ? "bg-primary/5 border-primary/20"
          : "bg-muted/30 border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            variant === "primary" ? "bg-primary/10" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              variant === "primary" ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-0.5">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          {action && (
            <Button
              size="sm"
              variant={variant === "primary" ? "default" : "outline"}
              className="mt-2 h-7 text-xs"
              onClick={action.onClick}
            >
              {action.label}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton Components
// ============================================================================

function KeywordCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[160px] p-3 rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-4 w-20 flex-1" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-6">
      {/* Metrics Skeleton */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg">
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="flex flex-wrap gap-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-16" />
            ))}
          </div>
        </div>
      </div>
      {/* Table Skeleton */}
      <div className="border rounded-lg p-4">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function TrendDashboardPage() {
  const { language } = useI18n();
  const router = useRouter();
  const isKorean = language === "ko";

  // Workflow store actions
  const {
    setStartFromTrends,
    setStartFromVideo,
    setStartAiInsights,
    clearStartData,
    setCurrentStage,
  } = useWorkflowStore();

  // State
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string>("");
  const [addKeywordDialogOpen, setAddKeywordDialogOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  // Loading & Error States
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [keywordAnalysisData, setKeywordAnalysisData] = useState<Record<string, KeywordAnalysisData>>({});
  const [contentSummary, setContentSummary] = useState<ContentSummary>({
    totalGenerated: 0,
    processing: 0,
    completed: 0,
    published: 0,
    last24h: 0,
    last7d: 0,
  });
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // Derived data
  const selectedKeyword = useMemo(
    () => trackedKeywords.find((k) => k.id === selectedKeywordId),
    [trackedKeywords, selectedKeywordId]
  );

  const keywordAnalysis = useMemo(() => {
    if (!selectedKeyword) return null;
    return keywordAnalysisData[selectedKeyword.keyword] || null;
  }, [selectedKeyword, keywordAnalysisData]);

  const crossInsights = useMemo(() => {
    return calculateCrossKeywordInsights(keywordAnalysisData, trackedKeywords, isKorean);
  }, [keywordAnalysisData, trackedKeywords, isKorean]);

  // Load initial data from localStorage
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load from localStorage
        const storedKeywords = loadTrackedKeywords();
        const storedHistory = loadSearchHistory();

        setTrackedKeywords(storedKeywords);
        setSearchHistory(storedHistory);

        if (storedKeywords.length > 0) {
          setSelectedKeywordId(storedKeywords[0].id);

          // Fetch analysis for all tracked keywords
          const keywords = storedKeywords.map(k => k.keyword);
          try {
            const apiResults = await fetchKeywordAnalysis(keywords, 50);
            const analysisMap: Record<string, KeywordAnalysisData> = {};

            apiResults.forEach(result => {
              analysisMap[result.keyword] = transformAPIToKeywordAnalysis(result);
            });

            setKeywordAnalysisData(analysisMap);

            // Update tracked keywords with fresh data
            const updatedKeywords = storedKeywords.map(kw => {
              const apiData = apiResults.find(r => r.keyword === kw.keyword);
              if (apiData) {
                return transformAPIToTrackedKeyword(apiData, kw);
              }
              return kw;
            });
            setTrackedKeywords(updatedKeywords);
            saveTrackedKeywords(updatedKeywords);
          } catch (apiError) {
            console.error("Failed to fetch initial analysis:", apiError);
            // Keep using stored keywords even if API fails
          }
        }

        // Fetch content summary
        const summary = await fetchContentSummary();
        setContentSummary(summary);
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError(isKorean ? "데이터를 불러오는 중 오류가 발생했습니다." : "Failed to load data.");
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialData();
  }, [isKorean]);

  // Fetch analysis when selected keyword changes
  const fetchAnalysisForKeyword = useCallback(async (keyword: string) => {
    if (keywordAnalysisData[keyword]) return; // Already have data

    setIsAnalysisLoading(true);
    setError(null);

    try {
      const apiResults = await fetchKeywordAnalysis([keyword], 50);
      if (apiResults.length > 0) {
        const analysis = transformAPIToKeywordAnalysis(apiResults[0]);
        setKeywordAnalysisData(prev => ({
          ...prev,
          [keyword]: analysis,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch analysis:", err);
      setError(isKorean ? "분석 데이터를 불러오는 중 오류가 발생했습니다." : "Failed to load analysis data.");
    } finally {
      setIsAnalysisLoading(false);
    }
  }, [keywordAnalysisData, isKorean]);

  useEffect(() => {
    if (selectedKeyword && !keywordAnalysisData[selectedKeyword.keyword]) {
      fetchAnalysisForKeyword(selectedKeyword.keyword);
    }
  }, [selectedKeyword, keywordAnalysisData, fetchAnalysisForKeyword]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    if (trackedKeywords.length === 0) return;

    setIsAnalysisLoading(true);
    setError(null);

    try {
      const keywords = trackedKeywords.map(k => k.keyword);
      const apiResults = await fetchKeywordAnalysis(keywords, 50, true); // forceRefresh
      const analysisMap: Record<string, KeywordAnalysisData> = {};

      apiResults.forEach(result => {
        analysisMap[result.keyword] = transformAPIToKeywordAnalysis(result);
      });

      setKeywordAnalysisData(analysisMap);

      // Update tracked keywords with fresh data
      const updatedKeywords = trackedKeywords.map(kw => {
        const apiData = apiResults.find(r => r.keyword === kw.keyword);
        if (apiData) {
          return transformAPIToTrackedKeyword(apiData, kw);
        }
        return kw;
      });
      setTrackedKeywords(updatedKeywords);
      saveTrackedKeywords(updatedKeywords);
    } catch (err) {
      console.error("Failed to refresh data:", err);
      setError(isKorean ? "데이터 새로고침 중 오류가 발생했습니다." : "Failed to refresh data.");
    } finally {
      setIsAnalysisLoading(false);
    }
  }, [trackedKeywords, isKorean]);

  // Refresh single keyword
  const handleRefreshKeyword = useCallback(async (keyword: string) => {
    setIsAnalysisLoading(true);
    setError(null);

    try {
      const apiResults = await fetchKeywordAnalysis([keyword], 50, true); // forceRefresh
      if (apiResults.length > 0) {
        const apiData = apiResults[0];
        const analysis = transformAPIToKeywordAnalysis(apiData);

        setKeywordAnalysisData(prev => ({
          ...prev,
          [keyword]: analysis,
        }));

        // Update tracked keyword with fresh data
        setTrackedKeywords(prev => {
          const updated = prev.map(kw => {
            if (kw.keyword === keyword) {
              return transformAPIToTrackedKeyword(apiData, kw);
            }
            return kw;
          });
          saveTrackedKeywords(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to refresh keyword:", err);
      setError(isKorean ? "키워드 새로고침 중 오류가 발생했습니다." : "Failed to refresh keyword.");
    } finally {
      setIsAnalysisLoading(false);
    }
  }, [isKorean]);

  // Translations
  const t = {
    title: language === "ko" ? "트렌드 인텔리전스" : "Trend Intelligence",
    subtitle: language === "ko" ? "등록한 키워드의 트렌드를 한눈에 파악하세요" : "Monitor trends for your tracked keywords",
    addKeyword: language === "ko" ? "키워드 추가" : "Add Keyword",
    contentSummary: language === "ko" ? "콘텐츠 현황" : "Content Status",
    totalGenerated: language === "ko" ? "총 생성" : "Generated",
    processing: language === "ko" ? "처리 중" : "Processing",
    completed: language === "ko" ? "완료" : "Completed",
    published: language === "ko" ? "게시됨" : "Published",
    quickActions: language === "ko" ? "빠른 액션" : "Quick Actions",
    createContent: language === "ko" ? "콘텐츠 생성" : "Create Content",
    analyzeNew: language === "ko" ? "새 키워드 분석" : "Analyze New",
    viewDiscover: language === "ko" ? "Discover 보기" : "View Discover",
    trackedKeywords: language === "ko" ? "등록된 키워드" : "Tracked Keywords",
    trendOverview: language === "ko" ? "트렌드 개요" : "Trend Overview",
    selectKeyword: language === "ko" ? "키워드를 선택하세요" : "Select a keyword",
    metrics: language === "ko" ? "성과 지표" : "Performance Metrics",
    avgViews: language === "ko" ? "평균 조회수" : "Avg Views",
    avgEngagement: language === "ko" ? "평균 참여율" : "Avg Engagement",
    viralThreshold: language === "ko" ? "바이럴 기준" : "Viral Threshold",
    totalVideos: language === "ko" ? "분석 영상" : "Total Videos",
    topHashtags: language === "ko" ? "인기 해시태그" : "Top Hashtags",
    copyAll: language === "ko" ? "전체 복사" : "Copy All",
    viralVideos: language === "ko" ? "바이럴 영상" : "Viral Videos",
    aiSuggestions: language === "ko" ? "AI 콘텐츠 제안" : "AI Suggestions",
    topCreators: language === "ko" ? "탑 크리에이터" : "Top Creators",
    crossInsights: language === "ko" ? "크로스 키워드 인사이트" : "Cross-Keyword Insights",
    commonHashtags: language === "ko" ? "공통 해시태그" : "Common Hashtags",
    appearIn: language === "ko" ? "개 키워드에서 등장" : "keywords",
    todayRec: language === "ko" ? "오늘의 콘텐츠 추천" : "Today's Recommendation",
    primary: language === "ko" ? "추천" : "Primary",
    secondary: language === "ko" ? "대안" : "Alternative",
    startCreating: language === "ko" ? "콘텐츠 만들기" : "Start Creating",
    searchHistory: language === "ko" ? "검색 히스토리" : "Search History",
    viewAll: language === "ko" ? "전체 보기" : "View All",
    videosFound: language === "ko" ? "개 영상" : "videos",
    noKeywords: language === "ko" ? "등록된 키워드가 없습니다" : "No tracked keywords",
    addFirst: language === "ko" ? "첫 번째 키워드를 추가하세요" : "Add your first keyword",
    enterKeyword: language === "ko" ? "키워드 또는 해시태그" : "Keyword or hashtag",
    add: language === "ko" ? "추가" : "Add",
    cancel: language === "ko" ? "취소" : "Cancel",
  };

  // Handlers
  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    const keyword = newKeyword.trim().toLowerCase().replace(/^#/, "");

    // Check if already tracked
    if (trackedKeywords.some(k => k.keyword.toLowerCase() === keyword.toLowerCase())) {
      setError(isKorean ? "이미 등록된 키워드입니다." : "Keyword already tracked.");
      return;
    }

    setIsAddingKeyword(true);
    setError(null);

    try {
      // Fetch analysis for the new keyword
      const apiResults = await fetchKeywordAnalysis([keyword], 50);

      if (apiResults.length === 0) {
        setError(isKorean ? "해당 키워드에 대한 데이터를 찾을 수 없습니다." : "No data found for this keyword.");
        return;
      }

      const apiData = apiResults[0];
      const newTracked = transformAPIToTrackedKeyword(apiData);
      const analysis = transformAPIToKeywordAnalysis(apiData);

      // Update states
      setTrackedKeywords(prev => {
        const updated = [...prev, newTracked];
        saveTrackedKeywords(updated);
        return updated;
      });

      setKeywordAnalysisData(prev => ({
        ...prev,
        [keyword]: analysis,
      }));

      // Add to search history
      addToSearchHistory(keyword, apiData.totalVideos, apiData.aggregateStats.avgEngagementRate);
      setSearchHistory(loadSearchHistory());

      // Select the new keyword
      setSelectedKeywordId(newTracked.id);

      setNewKeyword("");
      setAddKeywordDialogOpen(false);
    } catch (err) {
      console.error("Failed to add keyword:", err);
      setError(isKorean ? "키워드 추가 중 오류가 발생했습니다." : "Failed to add keyword.");
    } finally {
      setIsAddingKeyword(false);
    }
  };

  const handleRemoveKeyword = (id: string) => {
    const keywordToRemove = trackedKeywords.find(k => k.id === id);

    setTrackedKeywords(prev => {
      const updated = prev.filter(k => k.id !== id);
      saveTrackedKeywords(updated);
      return updated;
    });

    // Remove from analysis data
    if (keywordToRemove) {
      setKeywordAnalysisData(prev => {
        const updated = { ...prev };
        delete updated[keywordToRemove.keyword];
        return updated;
      });
    }

    // Select another keyword if this one was selected
    if (selectedKeywordId === id) {
      const remaining = trackedKeywords.filter(k => k.id !== id);
      setSelectedKeywordId(remaining[0]?.id || "");
    }
  };

  const handleCopyHashtags = () => {
    if (!keywordAnalysis) return;
    const tags = keywordAnalysis.topHashtags.map((h) => `#${h.tag}`).join(" ");
    navigator.clipboard.writeText(tags);
  };

  // Initial loading state
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isKorean ? "데이터를 불러오는 중..." : "Loading data..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="px-[7%] py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t.title}</h1>
              <p className="text-xs text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trackedKeywords.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isAnalysisLoading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1.5", isAnalysisLoading && "animate-spin")} />
                {isKorean ? "새로고침" : "Refresh"}
              </Button>
            )}

            <Dialog open={addKeywordDialogOpen} onOpenChange={setAddKeywordDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t.addKeyword}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.addKeyword}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder={t.enterKeyword}
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isAddingKeyword && handleAddKeyword()}
                    disabled={isAddingKeyword}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setAddKeywordDialogOpen(false)} disabled={isAddingKeyword}>
                      {t.cancel}
                    </Button>
                    <Button onClick={handleAddKeyword} disabled={!newKeyword.trim() || isAddingKeyword}>
                      {isAddingKeyword ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          {isKorean ? "분석 중..." : "Analyzing..."}
                        </>
                      ) : (
                        t.add
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-[7%] pt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="py-6 px-[7%] space-y-6">
        {/* Row 1: Content Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              {t.contentSummary}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <MetricCard
                icon={Sparkles}
                label={t.totalGenerated}
                value={contentSummary.totalGenerated}
                subValue={`+${contentSummary.last24h} today`}
                onClick={() => router.push("/processing")}
              />
              <MetricCard
                icon={Loader2}
                label={t.processing}
                value={contentSummary.processing}
                onClick={() => router.push("/processing")}
              />
              <MetricCard
                icon={CheckCircle}
                label={t.completed}
                value={contentSummary.completed}
                onClick={() => router.push("/processing")}
              />
              <MetricCard
                icon={FolderOpen}
                label={t.published}
                value={contentSummary.published}
                onClick={() => router.push("/publish")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Row 2: Tracked Keywords */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              {t.trackedKeywords}
              <Badge variant="secondary" className="ml-auto text-xs">
                {trackedKeywords.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trackedKeywords.length === 0 ? (
              <div className="text-center py-8">
                <Hash className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">{t.noKeywords}</p>
                <Button size="sm" onClick={() => setAddKeywordDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t.addFirst}
                </Button>
              </div>
            ) : (
              <ScrollArea className="w-full overflow-visible">
                <div className="flex gap-3 pt-2 pb-2 px-1">
                  {trackedKeywords.map((kw) => (
                    <KeywordCard
                      key={kw.id}
                      keyword={kw}
                      isSelected={kw.id === selectedKeywordId}
                      onClick={() => setSelectedKeywordId(kw.id)}
                      onDelete={(e) => {
                        e.stopPropagation();
                        handleRemoveKeyword(kw.id);
                      }}
                    />
                  ))}
                  <AddKeywordCard onClick={() => setAddKeywordDialogOpen(true)} />
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Row 3: Trend Overview (Selected Keyword Detail) */}
        {selectedKeyword && isAnalysisLoading && !keywordAnalysis && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                {t.trendOverview}: #{selectedKeyword.keyword}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnalysisSkeleton />
            </CardContent>
          </Card>
        )}

        {selectedKeyword && keywordAnalysis && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  {t.trendOverview}: #{selectedKeyword.keyword}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => handleRefreshKeyword(selectedKeyword.keyword)}
                    disabled={isAnalysisLoading}
                  >
                    <RefreshCw className={cn("h-3 w-3 mr-1", isAnalysisLoading && "animate-spin")} />
                    {isKorean ? "새로고침" : "Refresh"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => handleRemoveKeyword(selectedKeyword.id)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    {isKorean ? "삭제" : "Remove"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Metrics + Hashtags Row */}
              <div className="grid grid-cols-2 gap-6">
                {/* Metrics */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-3">{t.metrics}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">{t.avgViews}</p>
                      <p className="text-lg font-bold">{formatCount(keywordAnalysis.aggregateStats.avgViews)}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">{t.avgEngagement}</p>
                      <p className="text-lg font-bold">{formatPercent(keywordAnalysis.aggregateStats.avgEngagement)}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">{t.viralThreshold}</p>
                      <p className="text-lg font-bold">{keywordAnalysis.aggregateStats.viralThreshold}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">{t.totalVideos}</p>
                      <p className="text-lg font-bold">{keywordAnalysis.aggregateStats.totalVideos}</p>
                    </div>
                  </div>
                </div>

                {/* Top Hashtags */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-muted-foreground">{t.topHashtags}</h4>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleCopyHashtags}>
                      {t.copyAll}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywordAnalysis.topHashtags.map((h) => (
                      <HashtagBadge
                        key={h.tag}
                        tag={h.tag}
                        count={h.count}
                        engagement={h.avgEngagement}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Suggestions + Top Creators Row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    {t.aiSuggestions}
                  </h4>
                  <ul className="space-y-2">
                    {keywordAnalysis.aiSuggestions.slice(0, 4).map((suggestion, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <Sparkles className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {t.topCreators}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {keywordAnalysis.topCreators.map((creator) => (
                      <Badge key={creator.name} variant="outline" className="text-xs">
                        @{creator.name}
                        <span className="ml-1 text-emerald-600">{formatPercent(creator.avgEngagement)}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Viral Videos Section */}
              <ViralVideoSection
                keyword={selectedKeyword.keyword}
                videos={keywordAnalysis.viralVideos}
                trendData={{
                  topHashtags: keywordAnalysis.topHashtags.map(h => h.tag),
                  avgEngagement: keywordAnalysis.aggregateStats.avgEngagement,
                  viralThreshold: keywordAnalysis.aggregateStats.viralThreshold,
                  videoCount: keywordAnalysis.viralVideos.length,
                }}
                isKorean={isKorean}
                onCreateFromTrend={() => {
                  // Clear previous data and set trend data
                  clearStartData();
                  setStartFromTrends({
                    keywords: [selectedKeyword.keyword],
                    analysis: {
                      totalVideos: keywordAnalysis.aggregateStats.totalVideos,
                      avgViews: keywordAnalysis.aggregateStats.avgViews,
                      avgEngagement: keywordAnalysis.aggregateStats.avgEngagement,
                      topHashtags: keywordAnalysis.topHashtags.map(h => h.tag),
                      viralVideos: keywordAnalysis.viralVideos.map(v => ({
                        id: v.id,
                        author: { id: v.author, name: v.author },
                        description: v.description,
                        videoUrl: v.videoUrl,
                        thumbnailUrl: null,
                        stats: {
                          playCount: v.views,
                          likeCount: 0,
                          commentCount: 0,
                          shareCount: 0,
                        },
                        engagementRate: v.engagement,
                        hashtags: v.hashtags,
                        viralScore: v.viralScore,
                      })),
                    },
                  });
                  // Set AI insights from trend analysis
                  if (keywordAnalysis.aiInsights) {
                    setStartAiInsights({
                      summary: keywordAnalysis.aiInsights.summary,
                      contentStrategy: keywordAnalysis.aiInsights.contentStrategy,
                      hashtagStrategy: keywordAnalysis.aiInsights.hashtagStrategy,
                      videoIdeas: keywordAnalysis.aiInsights.videoIdeas,
                    });
                  }
                  setCurrentStage("start");
                  router.push("/start");
                }}
                onCreateFromVideo={(videoId: string) => {
                  // Navigate to Start page with video context
                  const video = keywordAnalysis.viralVideos.find(v => v.id === videoId);
                  if (video) {
                    clearStartData();
                    setStartFromVideo({
                      videoId: video.id,
                      videoUrl: video.videoUrl,
                      thumbnailUrl: null,
                      basicStats: {
                        playCount: video.views,
                        likeCount: 0,
                        commentCount: 0,
                        shareCount: 0,
                        engagementRate: video.engagement,
                      },
                      author: {
                        id: video.author,
                        name: video.author,
                      },
                      description: video.description,
                      hashtags: video.hashtags,
                    });
                    setCurrentStage("start");
                    router.push("/start");
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Row 4: Cross-Keyword Insights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              {t.crossInsights}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Common Hashtags */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-3">{t.commonHashtags}</h4>
                {crossInsights.commonHashtags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {crossInsights.commonHashtags.map((h) => (
                      <Badge key={h.tag} variant="secondary" className="text-xs">
                        #{h.tag}
                        <span className="ml-1 text-muted-foreground">
                          ({h.keywordCount}/{trackedKeywords.length} {t.appearIn})
                        </span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isKorean ? "2개 이상의 키워드를 추가하면 공통 해시태그가 표시됩니다." : "Add 2+ keywords to see common hashtags."}
                  </p>
                )}
              </div>

              {/* Today's Recommendation */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground">{t.todayRec}</h4>
                <InsightCard
                  icon={Target}
                  title={t.primary}
                  description={crossInsights.todayRecommendation.primary}
                  variant="primary"
                />
                <InsightCard
                  icon={Lightbulb}
                  title={t.secondary}
                  description={crossInsights.todayRecommendation.secondary}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 5: Search History */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {t.searchHistory}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push("/discover")}>
                {t.viewAll}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {searchHistory.length > 0 ? (
              <div className="grid grid-cols-5 gap-3">
                {searchHistory.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    className="p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-all text-left"
                    onClick={() => router.push(`/discover?keyword=${item.keyword}`)}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {formatRelativeTime(item.searchedAt, language)}
                    </p>
                    <p className="text-sm font-medium mb-1">#{item.keyword}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.videosFound} {t.videosFound}
                    </p>
                  </button>
                ))}
                <button
                  className="p-3 rounded-lg border border-dashed hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center"
                  onClick={() => router.push("/discover")}
                >
                  <Search className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">{t.viewAll}</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isKorean ? "검색 기록이 없습니다" : "No search history"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
