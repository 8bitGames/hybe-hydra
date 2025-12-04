"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { useKeywordAnalysis, useLiveTrending, useKeywordHistory, KeywordAnalysis, KeywordHistoryItem } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, sanitizeUsername } from "@/lib/utils";
import {
  Search,
  TrendingUp,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Eye,
  Heart,
  MessageCircle,
  Play,
  ExternalLink,
  Trophy,
  Flame,
  Hash,
  Users,
  Lightbulb,
  Zap,
  Target,
  Bot,
  ChevronDown,
  ChevronUp,
  Bookmark,
  BookmarkCheck,
  History,
  Clock,
} from "lucide-react";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";

// ============================================================================
// Helper Functions
// ============================================================================

function formatCount(num: number | null | undefined): string {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return `${num.toFixed(2)}%`;
}

// ============================================================================
// Video Card Component
// ============================================================================

interface VideoCardProps {
  video: KeywordAnalysis["videos"][0];
  onSaveInspiration?: (video: KeywordAnalysis["videos"][0]) => void;
  isSaved?: boolean;
  showRank?: boolean;
}

function VideoCard({ video, onSaveInspiration, isSaved, showRank = false }: VideoCardProps) {
  const handleViewVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(video.videoUrl, "_blank", "noopener,noreferrer");
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveInspiration?.(video);
  };

  return (
    <div className="group">
      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-neutral-100 mb-2">
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleViewVideo}
            className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center"
          >
            <Play className="h-5 w-5 text-black fill-black ml-0.5" />
          </button>
        </div>
        {/* Rank badge */}
        {showRank && (
          <div className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white">
            #{video.rank}
          </div>
        )}
        {/* View on TikTok button */}
        <button
          onClick={handleViewVideo}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="View on TikTok"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
        {/* Save to inspiration button */}
        {onSaveInspiration && (
          <button
            onClick={handleSave}
            className={cn(
              "absolute bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] font-medium transition-opacity z-10 whitespace-nowrap flex items-center gap-1",
              isSaved
                ? "bg-white text-black opacity-100"
                : "bg-white text-black opacity-0 group-hover:opacity-100"
            )}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="h-3 w-3" />
                Saved
              </>
            ) : (
              <>
                <Bookmark className="h-3 w-3" />
                Save
              </>
            )}
          </button>
        )}
        {/* Views overlay */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-[10px] font-medium bg-black/60 px-1.5 py-0.5 rounded">
          <Eye className="h-2.5 w-2.5" />
          {formatCount(video.stats.playCount)}
        </div>
        {/* Engagement badge */}
        <div className="absolute bottom-1.5 right-1.5 text-[10px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">
          {formatPercent(video.engagementRate)}
        </div>
      </div>

      {/* Author */}
      <p className="text-[11px] font-medium truncate mb-1 text-neutral-700">
        @{sanitizeUsername(video.author.name)}
      </p>

      {/* Stats Row */}
      <div className="flex items-center gap-2 text-[10px] text-neutral-500">
        <span className="flex items-center gap-0.5">
          <Heart className="h-2.5 w-2.5" />
          {formatCount(video.stats.likeCount)}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageCircle className="h-2.5 w-2.5" />
          {formatCount(video.stats.commentCount)}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Live Trending Section
// ============================================================================

function LiveTrendingSection({
  onSaveInspiration,
  savedIds,
}: {
  onSaveInspiration: (video: KeywordAnalysis["videos"][0]) => void;
  savedIds: Set<string>;
}) {
  const { language } = useI18n();
  const { data, isLoading } = useLiveTrending({ limit: 30 });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[9/16] bg-neutral-200 rounded-lg animate-pulse mb-2" />
            <div className="h-3 bg-neutral-200 rounded animate-pulse w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (!data?.videos?.length) {
    return (
      <div className="text-center py-8 text-neutral-400">
        {language === "ko" ? "트렌드 영상이 없습니다" : "No trending videos"}
      </div>
    );
  }

  // Convert to VideoCard format
  const videos = data.videos.map((v, i) => ({
    id: v.id,
    videoUrl: v.videoUrl,
    thumbnailUrl: v.thumbnailUrl,
    description: v.description || "",
    author: { id: v.authorId, name: v.authorName },
    stats: {
      playCount: v.playCount || 0,
      likeCount: v.likeCount || 0,
      commentCount: v.commentCount || 0,
      shareCount: v.shareCount || 0,
    },
    hashtags: v.hashtags || [],
    engagementRate:
      v.playCount && v.playCount > 0
        ? (((v.likeCount || 0) + (v.commentCount || 0) + (v.shareCount || 0)) / v.playCount) * 100
        : 0,
    likeToViewRatio: 0,
    rank: i + 1,
  }));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onSaveInspiration={onSaveInspiration}
          isSaved={savedIds.has(video.id)}
          showRank
        />
      ))}
    </div>
  );
}

// ============================================================================
// Analysis Results Component
// ============================================================================

function AnalysisResults({
  analysis,
  selectedHashtags,
  onSelectHashtag,
  onSaveInspiration,
  savedIds,
}: {
  analysis: KeywordAnalysis;
  selectedHashtags: string[];
  onSelectHashtag: (tag: string) => void;
  onSaveInspiration: (video: KeywordAnalysis["videos"][0]) => void;
  savedIds: Set<string>;
}) {
  const { language } = useI18n();
  const [aiExpanded, setAiExpanded] = useState(false);

  if (analysis.error || analysis.totalVideos === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-neutral-500">
          {analysis.error || (language === "ko" ? "비디오를 찾을 수 없습니다" : "No videos found")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Insights */}
      {analysis.aiInsights && (
        <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold flex items-center gap-1.5 text-neutral-700">
              <Bot className="h-3.5 w-3.5 text-neutral-500" />
              {language === "ko" ? "AI 인사이트" : "AI Insights"}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiExpanded(!aiExpanded)}
              className="h-6 px-2 text-xs"
            >
              {aiExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">{analysis.aiInsights.summary}</p>
          {aiExpanded && (
            <div className="mt-3 pt-3 border-t border-neutral-200 space-y-3">
              <div>
                <h5 className="text-[10px] font-semibold text-neutral-500 mb-1.5">
                  {language === "ko" ? "비디오 아이디어" : "Video Ideas"}
                </h5>
                <ul className="space-y-1">
                  {analysis.aiInsights.videoIdeas.slice(0, 3).map((idea, i) => (
                    <li key={i} className="text-[11px] flex items-start gap-1.5 text-neutral-600">
                      <Sparkles className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-neutral-100 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-neutral-500 text-[10px] mb-0.5">
            <Eye className="h-2.5 w-2.5" />
            {language === "ko" ? "평균 조회" : "Avg Views"}
          </div>
          <div className="text-sm font-bold text-black">
            {formatCount(analysis.aggregateStats.avgViews)}
          </div>
        </div>
        <div className="bg-neutral-100 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-neutral-500 text-[10px] mb-0.5">
            <Zap className="h-2.5 w-2.5" />
            {language === "ko" ? "참여율" : "Engagement"}
          </div>
          <div className="text-sm font-bold text-black">
            {formatPercent(analysis.aggregateStats.avgEngagementRate)}
          </div>
        </div>
        <div className="bg-neutral-100 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-neutral-500 text-[10px] mb-0.5">
            <Trophy className="h-2.5 w-2.5" />
            {language === "ko" ? "바이럴" : "Viral"}
          </div>
          <div className="text-[11px] font-semibold text-black">
            {analysis.recommendations.engagementBenchmarks.toGoViral}
          </div>
        </div>
        <div className="bg-neutral-100 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-neutral-500 text-[10px] mb-0.5">
            <Target className="h-2.5 w-2.5" />
            {language === "ko" ? "고성과" : "High"}
          </div>
          <div className="text-[11px] font-semibold text-black">
            {analysis.recommendations.engagementBenchmarks.toBeHighPerforming}
          </div>
        </div>
      </div>

      {/* Viral Videos */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <h4 className="text-xs font-semibold text-neutral-700">
            {language === "ko" ? "바이럴 영상" : "Viral Videos"}
          </h4>
          <span className="text-[10px] text-neutral-500">
            ({language === "ko" ? "상위 10%" : "Top 10%"})
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {analysis.performanceTiers.viral.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onSaveInspiration={onSaveInspiration}
              isSaved={savedIds.has(video.id)}
              showRank
            />
          ))}
        </div>
      </div>

      {/* High Performing Videos */}
      {analysis.performanceTiers.highPerforming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <h4 className="text-xs font-semibold text-neutral-700">
              {language === "ko" ? "고성과 영상" : "High Performing"}
            </h4>
            <span className="text-[10px] text-neutral-500">
              ({language === "ko" ? "상위 25%" : "Top 25%"})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {analysis.performanceTiers.highPerforming.slice(0, 12).map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onSaveInspiration={onSaveInspiration}
                isSaved={savedIds.has(video.id)}
                showRank
              />
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Hashtag Recommendations */}
        <div>
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-neutral-700">
            <Hash className="h-3.5 w-3.5 text-neutral-500" />
            {language === "ko" ? "추천 해시태그" : "Recommended Hashtags"}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {analysis.hashtagInsights.recommendedHashtags.slice(0, 10).map((tag) => {
              const isSelected = selectedHashtags.includes(tag);
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-[11px] transition-all",
                    isSelected
                      ? "bg-black text-white border-black"
                      : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                  )}
                  onClick={() => onSelectHashtag(tag)}
                >
                  #{tag}
                  {isSelected ? (
                    <X className="h-2.5 w-2.5 ml-1" />
                  ) : (
                    <Plus className="h-2.5 w-2.5 ml-1 opacity-50" />
                  )}
                </Badge>
              );
            })}
          </div>

          {/* Top Creators */}
          {analysis.creatorInsights.topCreators.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-neutral-700">
                <Users className="h-3.5 w-3.5 text-neutral-500" />
                {language === "ko" ? "탑 크리에이터" : "Top Creators"}
              </h4>
              <div className="space-y-1">
                {analysis.creatorInsights.topCreators.slice(0, 3).map((creator, i) => (
                  <div
                    key={creator.id}
                    className="flex items-center justify-between text-[11px] bg-neutral-100 px-2 py-1.5 rounded"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-500 w-3">{i + 1}.</span>
                      <span className="font-medium text-neutral-700">@{creator.name}</span>
                    </div>
                    <span className="text-neutral-500">{formatPercent(creator.avgEngagement)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Tips */}
        <div>
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-neutral-700">
            <Lightbulb className="h-3.5 w-3.5 text-neutral-500" />
            {language === "ko" ? "콘텐츠 팁" : "Content Tips"}
          </h4>
          <ul className="space-y-1">
            {analysis.recommendations.contentTips.slice(0, 3).map((tip, i) => (
              <li key={i} className="text-[11px] flex items-start gap-1.5 text-neutral-600">
                <span>•</span>
                {tip}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[10px] text-neutral-500">
            {language === "ko" ? "최적 해시태그 수:" : "Optimal hashtags:"}{" "}
            <span className="font-medium text-neutral-700">
              {analysis.recommendations.optimalHashtagCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Saved Inspiration Panel
// ============================================================================

function SavedInspirationPanel({
  savedVideos,
  onRemove,
}: {
  savedVideos: KeywordAnalysis["videos"];
  onRemove: (id: string) => void;
}) {
  const { language } = useI18n();

  if (savedVideos.length === 0) return null;

  return (
    <div className="border-t border-neutral-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold flex items-center gap-1.5 text-neutral-700">
          <BookmarkCheck className="h-3.5 w-3.5 text-black" />
          {language === "ko" ? "저장된 영감" : "Saved Inspiration"} ({savedVideos.length})
        </h4>
      </div>
      <div className="flex gap-2 pb-2 overflow-x-auto">
        {savedVideos.map((video) => (
          <div key={video.id} className="relative flex-shrink-0 w-16">
            <div className="aspect-[9/16] rounded overflow-hidden bg-neutral-100">
              {video.thumbnailUrl && (
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <button
              onClick={() => onRemove(video.id)}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700 hover:bg-red-500 hover:text-white transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Search History Section
// ============================================================================

function SearchHistorySection({
  onSelectKeyword,
  currentKeywords,
}: {
  onSelectKeyword: (keyword: string) => void;
  currentKeywords: string[];
}) {
  const { language } = useI18n();
  const { data, isLoading } = useKeywordHistory({ limit: 10 });

  if (isLoading) {
    return (
      <div className="border-t border-neutral-200 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">
            {language === "ko" ? "검색 기록" : "Search History"}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-40 h-20 bg-neutral-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.history?.length) {
    return null;
  }

  // Filter out keywords that are already being analyzed
  const availableHistory = data.history.filter(
    (item) => !currentKeywords.includes(item.keyword)
  );

  if (availableHistory.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return language === "ko" ? "방금 전" : "Just now";
    }
    if (diffHours < 24) {
      return language === "ko" ? `${diffHours}시간 전` : `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return language === "ko" ? `${diffDays}일 전` : `${diffDays}d ago`;
    }
    return date.toLocaleDateString(language === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="border-t border-neutral-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">
            {language === "ko" ? "검색 기록" : "Search History"}
          </span>
          <span className="text-xs text-neutral-400">
            ({availableHistory.length})
          </span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {availableHistory.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectKeyword(item.keyword)}
            className={cn(
              "flex-shrink-0 w-44 p-3 rounded-lg border text-left transition-all",
              item.isExpired
                ? "border-neutral-200 bg-neutral-50 hover:border-neutral-300"
                : "border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-sm"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-neutral-900 truncate">
                #{item.keyword}
              </span>
              {item.isExpired && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-500">
                  {language === "ko" ? "만료" : "Expired"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-neutral-500 mb-1">
              <span className="flex items-center gap-0.5">
                <Eye className="h-2.5 w-2.5" />
                {formatCount(item.avgViews)}
              </span>
              <span className="flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                {formatPercent(item.avgEngagementRate)}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
              <Clock className="h-2.5 w-2.5" />
              {formatDate(item.analyzedAt)}
              <span className="mx-1">·</span>
              {item.totalVideos} {language === "ko" ? "영상" : "videos"}
            </div>

            {item.aiSummary && (
              <p className="mt-1.5 text-[10px] text-neutral-500 line-clamp-2">
                {item.aiSummary}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function DiscoverPage() {
  const { language } = useI18n();
  const toast = useToast();
  const router = useRouter();

  // Sync workflow stage
  useWorkflowSync("discover");
  const { proceedToAnalyze, canProceedToAnalyze } = useWorkflowNavigation();

  // Workflow store
  const {
    keywords,
    selectedHashtags,
    savedInspiration,
    setDiscoverKeywords,
    addDiscoverKeyword,
    removeDiscoverKeyword,
    toggleDiscoverHashtag,
    addInspiration,
    removeInspiration,
    setDiscoverPerformanceMetrics,
    setDiscoverAiInsights,
    setDiscoverTrendAnalysis,
  } = useWorkflowStore(
    useShallow((state) => ({
      keywords: state.discover.keywords,
      selectedHashtags: state.discover.selectedHashtags,
      savedInspiration: state.discover.savedInspiration,
      setDiscoverKeywords: state.setDiscoverKeywords,
      addDiscoverKeyword: state.addDiscoverKeyword,
      removeDiscoverKeyword: state.removeDiscoverKeyword,
      toggleDiscoverHashtag: state.toggleDiscoverHashtag,
      addInspiration: state.addInspiration,
      removeInspiration: state.removeInspiration,
      setDiscoverPerformanceMetrics: state.setDiscoverPerformanceMetrics,
      setDiscoverAiInsights: state.setDiscoverAiInsights,
      setDiscoverTrendAnalysis: state.setDiscoverTrendAnalysis,
    }))
  );

  // Local state
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<string>("trending");
  const [isSearching, setIsSearching] = useState(false);

  // Fetch keyword analysis
  const { data: analysisData, isLoading: analysisLoading, refetch } = useKeywordAnalysis({
    keywords,
    limit: 30,
    enabled: isSearching && keywords.length > 0,
  });

  // Saved video IDs for quick lookup
  const savedIds = useMemo(
    () => new Set(savedInspiration.map((v) => v.id)),
    [savedInspiration]
  );

  // Current analysis
  const currentAnalysis = useMemo(() => {
    if (!analysisData || activeTab === "trending") return null;
    return analysisData.analyses.find((a) => a.keyword === activeTab) || null;
  }, [analysisData, activeTab]);

  // Update workflow store when analysis completes
  React.useEffect(() => {
    if (currentAnalysis) {
      setDiscoverPerformanceMetrics({
        avgViews: currentAnalysis.aggregateStats.avgViews,
        avgEngagement: currentAnalysis.aggregateStats.avgEngagementRate,
        viralBenchmark: currentAnalysis.aggregateStats.medianViews * 10,
      });
      if (currentAnalysis.aiInsights) {
        setDiscoverAiInsights([
          currentAnalysis.aiInsights.summary,
          ...currentAnalysis.aiInsights.contentStrategy,
        ]);
      }
      setDiscoverTrendAnalysis({
        keyword: currentAnalysis.keyword,
        totalVideos: currentAnalysis.totalVideos,
        viralVideos: currentAnalysis.performanceTiers.viral.map((v) => ({
          ...v,
          engagementRate: v.engagementRate,
        })),
        highPerformingVideos: currentAnalysis.performanceTiers.highPerforming.map((v) => ({
          ...v,
          engagementRate: v.engagementRate,
        })),
      });
    }
  }, [currentAnalysis, setDiscoverPerformanceMetrics, setDiscoverAiInsights, setDiscoverTrendAnalysis]);

  // Handlers
  const handleAddKeyword = useCallback(() => {
    const trimmed = inputValue.trim().toLowerCase().replace(/^#/, "");
    if (trimmed && keywords.length < 3 && !keywords.includes(trimmed)) {
      addDiscoverKeyword(trimmed);
      setInputValue("");
      if (keywords.length === 0) {
        setActiveTab(trimmed);
      }
    }
  }, [inputValue, keywords, addDiscoverKeyword]);

  const handleRemoveKeyword = useCallback(
    (keyword: string) => {
      removeDiscoverKeyword(keyword);
      if (activeTab === keyword) {
        setActiveTab(keywords.length > 1 ? keywords.filter((k) => k !== keyword)[0] : "trending");
      }
      if (keywords.length === 1) {
        setIsSearching(false);
      }
    },
    [keywords, activeTab, removeDiscoverKeyword]
  );

  const handleSearch = useCallback(async () => {
    if (keywords.length === 0) return;
    setIsSearching(true);
    setActiveTab(keywords[0]);
    await refetch();
  }, [keywords, refetch]);

  const handleSelectHashtag = useCallback(
    (tag: string) => {
      if (selectedHashtags.length >= 5 && !selectedHashtags.includes(tag)) {
        toast.warning(
          language === "ko" ? "최대 5개" : "Max 5",
          language === "ko" ? "해시태그는 최대 5개까지" : "Up to 5 hashtags allowed"
        );
        return;
      }
      toggleDiscoverHashtag(tag);
    },
    [selectedHashtags, toggleDiscoverHashtag, language, toast]
  );

  const handleSaveInspiration = useCallback(
    (video: KeywordAnalysis["videos"][0]) => {
      if (savedIds.has(video.id)) {
        removeInspiration(video.id);
        toast.success(
          language === "ko" ? "제거됨" : "Removed",
          language === "ko" ? "영감에서 제거되었습니다" : "Removed from inspiration"
        );
      } else {
        addInspiration({
          id: video.id,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          description: video.description,
          author: video.author,
          stats: video.stats,
          hashtags: video.hashtags,
          engagementRate: video.engagementRate,
        });
        toast.success(
          language === "ko" ? "저장됨" : "Saved",
          language === "ko" ? "영감에 저장되었습니다" : "Saved to inspiration"
        );
      }
    },
    [savedIds, addInspiration, removeInspiration, language, toast]
  );

  const handleProceedToAnalyze = () => {
    if (!canProceedToAnalyze) {
      toast.warning(
        language === "ko" ? "정보 필요" : "Info needed",
        language === "ko"
          ? "키워드를 검색하거나 영감을 저장하세요"
          : "Search keywords or save inspiration first"
      );
      return;
    }
    proceedToAnalyze();
  };

  // Select keyword from history - adds it to keywords and triggers search
  const handleSelectHistoryKeyword = useCallback(
    (keyword: string) => {
      if (keywords.length >= 3) {
        toast.warning(
          language === "ko" ? "최대 3개" : "Max 3",
          language === "ko" ? "키워드는 최대 3개까지" : "Up to 3 keywords allowed"
        );
        return;
      }
      if (!keywords.includes(keyword)) {
        addDiscoverKeyword(keyword);
        setActiveTab(keyword);
        setIsSearching(true);
        // Refetch will happen automatically due to useKeywordAnalysis dependencies
      }
    },
    [keywords, addDiscoverKeyword, language, toast]
  );

  // Translations
  const t = {
    title: language === "ko" ? "트렌드 발견" : "Discover Trends",
    subtitle:
      language === "ko"
        ? "TikTok 트렌드를 검색하고 영감을 수집하세요"
        : "Search TikTok trends and gather inspiration",
    searchPlaceholder:
      language === "ko"
        ? "키워드 또는 #해시태그 (최대 3개)..."
        : "Keyword or #hashtag (max 3)...",
    analyze: language === "ko" ? "분석" : "Analyze",
    trending: language === "ko" ? "실시간 트렌드" : "Live Trending",
    proceed: language === "ko" ? "분석 단계로" : "Proceed to Analyze",
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col bg-white">
      {/* Header */}
      <WorkflowHeader
        onNext={handleProceedToAnalyze}
        canProceed={canProceedToAnalyze}
      />

      {/* Search Row */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-100 bg-white shrink-0">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
            placeholder={t.searchPlaceholder}
            className="pl-9 h-9 bg-neutral-100 border-neutral-200 text-black placeholder:text-neutral-500"
            disabled={keywords.length >= 3}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddKeyword}
          disabled={!inputValue.trim() || keywords.length >= 3}
          className="h-9 px-3 border-neutral-300 text-neutral-700 hover:bg-neutral-100"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={handleSearch}
          disabled={keywords.length === 0 || analysisLoading}
          className="h-9 px-4 bg-black text-white hover:bg-neutral-800"
        >
          {analysisLoading ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {t.analyze}
            </>
          )}
        </Button>

        {/* Keywords & Hashtags */}
        {(keywords.length > 0 || selectedHashtags.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {keywords.map((keyword) => (
              <Badge
                key={keyword}
                variant="secondary"
                className="cursor-pointer text-xs pl-2 bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                onClick={() => handleRemoveKeyword(keyword)}
              >
                #{keyword}
                <X className="h-3 w-3 ml-1.5" />
              </Badge>
            ))}
            {selectedHashtags.map((tag) => (
              <Badge
                key={tag}
                variant="default"
                className="cursor-pointer text-xs bg-black text-white"
                onClick={() => toggleDiscoverHashtag(tag)}
              >
                #{tag}
                <X className="h-2.5 w-2.5 ml-1" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 border-b border-neutral-100 bg-white shrink-0">
        <TabsList className="bg-neutral-100 border border-neutral-200">
          <TabsTrigger
            value="trending"
            className="text-xs data-[state=active]:bg-black data-[state=active]:text-white"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            {t.trending}
          </TabsTrigger>
          {/* Show keyword tabs - either from analysis data or as placeholders */}
          {keywords.map((keyword) => {
            const analysis = analysisData?.analyses.find((a) => a.keyword === keyword);
            return (
              <TabsTrigger
                key={keyword}
                value={keyword}
                className="text-xs data-[state=active]:bg-black data-[state=active]:text-white"
              >
                #{keyword}
                {analysis ? (
                  <span className="ml-1 text-neutral-400">({analysis.totalVideos})</span>
                ) : analysisLoading ? (
                  <Spinner className="ml-1 h-3 w-3" />
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {/* Main Content - Full Width, Scrollable */}
      <div className="flex-1 overflow-auto p-4">
        {/* Live Trending Tab */}
        <TabsContent value="trending" className="mt-0">
          <LiveTrendingSection
            onSaveInspiration={handleSaveInspiration}
            savedIds={savedIds}
          />
        </TabsContent>

        {/* Keyword Analysis Tabs */}
        {keywords.map((keyword) => {
          const analysis = analysisData?.analyses.find((a) => a.keyword === keyword);
          return (
            <TabsContent key={keyword} value={keyword} className="mt-0">
              {analysisLoading ? (
                <div className="space-y-4">
                  <div className="h-20 bg-neutral-200 rounded-lg animate-pulse" />
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 bg-neutral-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i}>
                        <div className="aspect-[9/16] bg-neutral-200 rounded-lg animate-pulse mb-2" />
                        <div className="h-3 bg-neutral-200 rounded animate-pulse w-20" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : analysis ? (
                <AnalysisResults
                  analysis={analysis}
                  selectedHashtags={selectedHashtags}
                  onSelectHashtag={handleSelectHashtag}
                  onSaveInspiration={handleSaveInspiration}
                  savedIds={savedIds}
                />
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-neutral-100 mx-auto mb-4 flex items-center justify-center">
                    <Sparkles className="h-7 w-7 text-neutral-400" />
                  </div>
                  <p className="text-sm text-neutral-500 mb-3">
                    {language === "ko"
                      ? `"${keyword}" 키워드를 분석하려면 분석 버튼을 클릭하세요`
                      : `Click Analyze to search for "${keyword}"`}
                  </p>
                  <Button
                    onClick={handleSearch}
                    className="bg-black text-white hover:bg-neutral-800"
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    {t.analyze}
                  </Button>
                </div>
              )}
            </TabsContent>
          );
        })}

        {/* Saved Inspiration */}
        <SavedInspirationPanel
          savedVideos={savedInspiration as KeywordAnalysis["videos"]}
          onRemove={removeInspiration}
        />

        {/* Search History */}
        <SearchHistorySection
          onSelectKeyword={handleSelectHistoryKeyword}
          currentKeywords={keywords}
        />
      </div>
    </Tabs>
  );
}
