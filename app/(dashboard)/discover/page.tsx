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
  Sparkles,
  Eye,
  Heart,
  MessageCircle,
  MessageSquare,
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
  Trash2,
} from "lucide-react";
import { InfoButton } from "@/components/ui/info-button";
import { TooltipProvider } from "@/components/ui/tooltip";
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
// Video Card Component (Text-based - No Thumbnail)
// ============================================================================

interface VideoCardProps {
  video: KeywordAnalysis["videos"][0];
  onSaveInspiration?: (video: KeywordAnalysis["videos"][0]) => void;
  isSaved?: boolean;
  showRank?: boolean;
}

function VideoCard({ video, onSaveInspiration, isSaved, showRank = false }: VideoCardProps) {
  const { language } = useI18n();

  const handleViewVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(video.videoUrl, "_blank", "noopener,noreferrer");
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveInspiration?.(video);
  };

  // Calculate engagement bar width (max 100%, scaled for visibility)
  const engagementBarWidth = Math.min(video.engagementRate * 8, 100);

  return (
    <div
      className="group relative p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer"
      onClick={handleViewVideo}
    >
      {/* Header: Rank + Author + Actions */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showRank && video.rank != null && video.rank > 0 && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-900 text-white">
              #{video.rank}
            </span>
          )}
          <span className="text-xs font-medium text-neutral-700 truncate">
            @{sanitizeUsername(video.author.name)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Save button */}
          {onSaveInspiration && (
            <button
              onClick={handleSave}
              className={cn(
                "p-1 rounded transition-all",
                isSaved
                  ? "text-neutral-900"
                  : "text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-700"
              )}
              title={isSaved ? (language === "ko" ? "저장됨" : "Saved") : (language === "ko" ? "저장" : "Save")}
            >
              {isSaved ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {/* External link */}
          <button
            onClick={handleViewVideo}
            className="p-1 rounded text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-700 transition-all"
            title="View on TikTok"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-neutral-600 line-clamp-2 mb-2 min-h-[2.5rem]">
        {video.description || (language === "ko" ? "설명 없음" : "No description")}
      </p>

      {/* Hashtags */}
      {video.hashtags && video.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {video.hashtags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] text-neutral-500">
              #{tag}
            </span>
          ))}
          {video.hashtags.length > 3 && (
            <span className="text-[10px] text-neutral-400">
              +{video.hashtags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center gap-3 text-[10px] text-neutral-500 mb-2">
        <span className="flex items-center gap-0.5">
          <Eye className="h-2.5 w-2.5" />
          {formatCount(video.stats.playCount)}
        </span>
        <span className="flex items-center gap-0.5">
          <Heart className="h-2.5 w-2.5" />
          {formatCount(video.stats.likeCount)}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageCircle className="h-2.5 w-2.5" />
          {formatCount(video.stats.commentCount)}
        </span>
      </div>

      {/* Engagement Rate Bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-neutral-700 rounded-full transition-all"
            style={{ width: `${engagementBarWidth}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-500">
            {language === "ko" ? "참여율" : "Engagement"}
          </span>
          <span className="text-[10px] font-medium text-neutral-700">
            {formatPercent(video.engagementRate)}
          </span>
        </div>
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
  const { data, isLoading } = useLiveTrending({ limit: 50 });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="p-3 border border-neutral-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-8 bg-neutral-200 rounded animate-pulse" />
              <div className="h-3 bg-neutral-200 rounded animate-pulse w-20" />
            </div>
            <div className="h-8 bg-neutral-200 rounded animate-pulse mb-2" />
            <div className="flex gap-1 mb-3">
              <div className="h-3 w-12 bg-neutral-200 rounded animate-pulse" />
              <div className="h-3 w-10 bg-neutral-200 rounded animate-pulse" />
            </div>
            <div className="flex gap-3 mb-2">
              <div className="h-3 w-12 bg-neutral-200 rounded animate-pulse" />
              <div className="h-3 w-10 bg-neutral-200 rounded animate-pulse" />
            </div>
            <div className="h-1.5 bg-neutral-200 rounded-full animate-pulse" />
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
            <div className="mt-3 pt-3 border-t border-neutral-200 space-y-4">
              {/* Content Strategy */}
              {analysis.aiInsights.contentStrategy && analysis.aiInsights.contentStrategy.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1">
                    <Target className="h-2.5 w-2.5" />
                    {language === "ko" ? "콘텐츠 전략" : "Content Strategy"}
                  </h5>
                  <ul className="space-y-1">
                    {analysis.aiInsights.contentStrategy.slice(0, 3).map((strategy, i) => (
                      <li key={i} className="text-[11px] flex items-start gap-1.5 text-neutral-600">
                        <span className="text-neutral-400">•</span>
                        {strategy}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Video Ideas */}
              {analysis.aiInsights.videoIdeas && analysis.aiInsights.videoIdeas.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    {language === "ko" ? "비디오 아이디어" : "Video Ideas"}
                  </h5>
                  <ul className="space-y-1">
                    {analysis.aiInsights.videoIdeas.slice(0, 3).map((idea, i) => (
                      <li key={i} className="text-[11px] flex items-start gap-1.5 text-neutral-600">
                        <span className="text-neutral-400">•</span>
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hashtag Strategy */}
              {analysis.aiInsights.hashtagStrategy && analysis.aiInsights.hashtagStrategy.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1">
                    <Hash className="h-2.5 w-2.5" />
                    {language === "ko" ? "해시태그 전략" : "Hashtag Strategy"}
                  </h5>
                  <ul className="space-y-1">
                    {analysis.aiInsights.hashtagStrategy.slice(0, 3).map((hashtag, i) => (
                      <li key={i} className="text-[11px] flex items-start gap-1.5 text-neutral-600">
                        <span className="text-neutral-400">•</span>
                        {hashtag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Caption Templates */}
              {analysis.aiInsights.captionTemplates && analysis.aiInsights.captionTemplates.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {language === "ko" ? "캡션 템플릿" : "Caption Templates"}
                  </h5>
                  <ul className="space-y-1.5">
                    {analysis.aiInsights.captionTemplates.slice(0, 2).map((template, i) => (
                      <li key={i} className="text-[11px] text-neutral-600 bg-neutral-100 rounded px-2 py-1.5 italic">
                        "{template}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Best Posting Advice */}
              {analysis.aiInsights.bestPostingAdvice && (
                <div>
                  <h5 className="text-[10px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {language === "ko" ? "최적 포스팅 조언" : "Best Posting Advice"}
                  </h5>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    {analysis.aiInsights.bestPostingAdvice}
                  </p>
                </div>
              )}

              {/* Audience Insights */}
              {analysis.aiInsights.audienceInsights && (
                <div>
                  <h5 className="text-[10px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" />
                    {language === "ko" ? "오디언스 인사이트" : "Audience Insights"}
                  </h5>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    {analysis.aiInsights.audienceInsights}
                  </p>
                </div>
              )}

              {/* Trend Prediction */}
              {analysis.aiInsights.trendPrediction && (
                <div>
                  <h5 className="text-[10px] font-semibold text-neutral-500 mb-1.5 flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5" />
                    {language === "ko" ? "트렌드 예측" : "Trend Prediction"}
                  </h5>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    {analysis.aiInsights.trendPrediction}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2">
        {/* 평균 조회 */}
        <div className="bg-neutral-100 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-neutral-500 text-[10px] mb-0.5">
            <Eye className="h-2.5 w-2.5" />
            {language === "ko" ? "평균 조회" : "Avg Views"}
            <InfoButton
              content={language === "ko"
                ? "검색된 모든 영상의 조회수 평균값입니다. 해당 키워드의 일반적인 도달 범위를 나타냅니다. 조회수가 높다고 참여율이 높은 것은 아닙니다."
                : "The average view count of all searched videos. Indicates typical reach for this keyword. High views don't always mean high engagement."}
              side="bottom"
            />
          </div>
          <div className="text-sm font-bold text-black">
            {formatCount(analysis.aggregateStats.avgViews)}
          </div>
        </div>

        {/* 참여율 */}
        <div className="bg-neutral-100 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-neutral-500 text-[10px] mb-0.5">
            <Zap className="h-2.5 w-2.5" />
            {language === "ko" ? "참여율" : "Engagement"}
            <InfoButton
              content={language === "ko"
                ? "영상을 본 사람들 중 실제로 반응(좋아요, 댓글, 공유)한 비율입니다. (좋아요 + 댓글 + 공유) / 조회수 × 100. 참여율이 높을수록 콘텐츠 품질이 좋다는 신호입니다."
                : "The percentage of viewers who actively engaged (liked, commented, shared). Formula: (Likes + Comments + Shares) / Views × 100. Higher engagement indicates better content quality."}
              side="bottom"
            />
          </div>
          <div className="text-sm font-bold text-black">
            {formatPercent(analysis.aggregateStats.avgEngagementRate)}
          </div>
        </div>

        {/* 바이럴 기준 */}
        <div className="bg-neutral-100 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-neutral-500 text-[10px] mb-0.5">
            <Trophy className="h-2.5 w-2.5 text-amber-500" />
            {language === "ko" ? "바이럴" : "Viral"}
            <InfoButton
              content={language === "ko"
                ? `참여율 기준 상위 10%에 해당하는 영상입니다. 이 수치 이상의 참여율을 달성하면 바이럴 가능성이 높습니다. 이 키워드에서 ${analysis.recommendations.engagementBenchmarks.toGoViral} 이상이면 바이럴!`
                : `Videos in the top 10% by engagement rate. Achieving this rate or higher indicates viral potential. ${analysis.recommendations.engagementBenchmarks.toGoViral}+ means viral for this keyword!`}
              side="bottom"
            />
          </div>
          <div className="text-[11px] font-semibold text-black">
            {analysis.recommendations.engagementBenchmarks.toGoViral}
          </div>
        </div>

        {/* 고성과 기준 */}
        <div className="bg-neutral-100 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-neutral-500 text-[10px] mb-0.5">
            <Flame className="h-2.5 w-2.5 text-orange-500" />
            {language === "ko" ? "고성과" : "High"}
            <InfoButton
              content={language === "ko"
                ? `참여율 기준 상위 10~30%에 해당하는 영상입니다. 평균 이상의 좋은 성과를 보이는 콘텐츠입니다. 이 키워드에서 ${analysis.recommendations.engagementBenchmarks.toBeHighPerforming} 이상이면 고성과!`
                : `Videos in the top 10-30% by engagement rate. These show above-average performance. ${analysis.recommendations.engagementBenchmarks.toBeHighPerforming}+ means high performing!`}
              side="bottom"
            />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {analysis.performanceTiers.highPerforming.map((video) => (
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

      {/* Average Videos */}
      {analysis.performanceTiers.average.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-neutral-500" />
            <h4 className="text-xs font-semibold text-neutral-700">
              {language === "ko" ? "일반 영상" : "Average Videos"}
            </h4>
            <span className="text-[10px] text-neutral-500">
              ({language === "ko" ? "상위 30-70%" : "Top 30-70%"})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {analysis.performanceTiers.average.map((video) => (
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
            {(() => {
              // Use recommendedHashtags if available, fallback to topHashtags
              const hashtagsToShow = analysis.hashtagInsights.recommendedHashtags.length > 0
                ? analysis.hashtagInsights.recommendedHashtags
                : analysis.hashtagInsights.topHashtags.map(h => h.tag);

              if (hashtagsToShow.length === 0) {
                return (
                  <p className="text-[11px] text-neutral-400 italic">
                    {language === "ko" ? "해시태그 데이터가 없습니다" : "No hashtag data available"}
                  </p>
                );
              }

              return hashtagsToShow.slice(0, 10).map((tag) => {
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
              });
            })()}
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

  const handleViewVideo = (videoUrl: string) => {
    window.open(videoUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="border-t border-neutral-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold flex items-center gap-1.5 text-neutral-700">
          <BookmarkCheck className="h-3.5 w-3.5 text-black" />
          {language === "ko" ? "저장된 영감" : "Saved Inspiration"} ({savedVideos.length})
        </h4>
      </div>
      <div className="flex gap-2 pb-2 overflow-x-auto">
        {savedVideos.map((video) => (
          <div
            key={video.id}
            className="group relative flex-shrink-0 w-48 p-2.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer"
            onClick={() => handleViewVideo(video.videoUrl)}
          >
            {/* Header: Author + Remove */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-neutral-700 truncate flex-1">
                @{sanitizeUsername(video.author.name)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(video.id);
                }}
                className="p-0.5 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {/* Description */}
            <p className="text-[10px] text-neutral-500 line-clamp-2 mb-1.5 min-h-[2rem]">
              {video.description || (language === "ko" ? "설명 없음" : "No description")}
            </p>
            {/* Stats */}
            <div className="flex items-center gap-2 text-[9px] text-neutral-400">
              <span className="flex items-center gap-0.5">
                <Eye className="h-2 w-2" />
                {formatCount(video.stats.playCount)}
              </span>
              <span className="flex items-center gap-0.5">
                <Heart className="h-2 w-2" />
                {formatCount(video.stats.likeCount)}
              </span>
              <span className="text-neutral-500 font-medium">
                {formatPercent(video.engagementRate)}
              </span>
            </div>
            {/* External link indicator on hover */}
            <div className="absolute top-2 right-7 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-2.5 w-2.5 text-neutral-400" />
            </div>
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
  useWorkflowSync("start");
  const { proceedToAnalyze, canProceedToAnalyze } = useWorkflowNavigation();

  // Workflow store
  const {
    keywords,
    selectedHashtags,
    savedInspiration,
    trendAnalysis,
    setDiscoverKeywords,
    addDiscoverKeyword,
    removeDiscoverKeyword,
    toggleDiscoverHashtag,
    addInspiration,
    updateInspiration,
    removeInspiration,
    setDiscoverPerformanceMetrics,
    setDiscoverAiInsights,
    setDiscoverTrendAnalysis,
    clearDiscoverAnalysis,
  } = useWorkflowStore(
    useShallow((state) => ({
      keywords: state.discover.keywords,
      selectedHashtags: state.discover.selectedHashtags,
      savedInspiration: state.discover.savedInspiration,
      trendAnalysis: state.discover.trendAnalysis,
      setDiscoverKeywords: state.setDiscoverKeywords,
      addDiscoverKeyword: state.addDiscoverKeyword,
      removeDiscoverKeyword: state.removeDiscoverKeyword,
      toggleDiscoverHashtag: state.toggleDiscoverHashtag,
      addInspiration: state.addInspiration,
      updateInspiration: state.updateInspiration,
      removeInspiration: state.removeInspiration,
      setDiscoverPerformanceMetrics: state.setDiscoverPerformanceMetrics,
      setDiscoverAiInsights: state.setDiscoverAiInsights,
      setDiscoverTrendAnalysis: state.setDiscoverTrendAnalysis,
      clearDiscoverAnalysis: state.clearDiscoverAnalysis,
    }))
  );

  // Local state - initialize based on persisted data
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<string>(() => {
    // If we have persisted trend analysis, start on that keyword tab
    if (trendAnalysis?.keyword) return trendAnalysis.keyword;
    if (keywords.length > 0) return keywords[0];
    return "trending";
  });
  // If there's persisted analysis, we're already in "searched" state
  const [isSearching, setIsSearching] = useState(() => !!trendAnalysis);

  // Fetch keyword analysis - only when explicitly searching (not on initial load with persisted data)
  const { data: analysisData, isLoading: analysisLoading, refetch } = useKeywordAnalysis({
    keywords,
    limit: 50,
    // Don't auto-fetch if we already have persisted analysis for the same keyword
    enabled: isSearching && keywords.length > 0 && !trendAnalysis,
  });

  // Saved video IDs for quick lookup
  const savedIds = useMemo(
    () => new Set(savedInspiration.map((v) => v.id)),
    [savedInspiration]
  );

  // Current analysis - check API data first, then persisted data
  const currentAnalysis = useMemo(() => {
    if (activeTab === "trending") return null;

    // First check if we have fresh data from API
    if (analysisData) {
      const apiAnalysis = analysisData.analyses.find((a) => a.keyword === activeTab);
      if (apiAnalysis) return apiAnalysis;
    }

    // Fall back to persisted trend analysis if keyword matches
    if (trendAnalysis && trendAnalysis.keyword === activeTab) {
      // Convert persisted TrendAnalysis to KeywordAnalysis format
      // Note: We use the persisted performanceMetrics and aiInsights directly from the store
      // without adding them to dependencies to avoid infinite loops
      const store = useWorkflowStore.getState();
      const persistedMetrics = store.discover.performanceMetrics;
      const persistedInsights = store.discover.aiInsights;

      return {
        keyword: trendAnalysis.keyword,
        totalVideos: trendAnalysis.totalVideos,
        analyzedAt: new Date().toISOString(),
        videos: [...trendAnalysis.viralVideos, ...trendAnalysis.highPerformingVideos].map((v) => ({
          ...v,
          likeToViewRatio: v.stats.playCount > 0 ? v.stats.likeCount / v.stats.playCount : 0,
          rank: 0,
        })),
        aggregateStats: {
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          avgViews: persistedMetrics?.avgViews || 0,
          avgLikes: 0,
          avgComments: 0,
          avgShares: 0,
          avgEngagementRate: persistedMetrics?.avgEngagement || 0,
          medianViews: 0,
          medianEngagementRate: 0,
        },
        performanceTiers: {
          viral: trendAnalysis.viralVideos.map((v) => ({
            ...v,
            likeToViewRatio: v.stats.playCount > 0 ? v.stats.likeCount / v.stats.playCount : 0,
            rank: 0,
          })) as KeywordAnalysis["videos"],
          highPerforming: trendAnalysis.highPerformingVideos.map((v) => ({
            ...v,
            likeToViewRatio: v.stats.playCount > 0 ? v.stats.likeCount / v.stats.playCount : 0,
            rank: 0,
          })) as KeywordAnalysis["videos"],
          average: [],
          belowAverage: [],
        },
        hashtagInsights: {
          topHashtags: [],
          hashtagCombos: [],
          recommendedHashtags: selectedHashtags,
        },
        contentPatterns: {
          avgDescriptionLength: 0,
          commonPhrases: [],
          callToActions: [],
          emojiUsage: [],
        },
        creatorInsights: {
          topCreators: [],
          uniqueCreators: 0,
        },
        recommendations: {
          optimalHashtagCount: 5,
          suggestedHashtags: selectedHashtags,
          contentTips: persistedInsights?.contentStrategy || [],
          engagementBenchmarks: {
            toGoViral: ">10%",
            toBeHighPerforming: ">5%",
            averagePerformance: ">2%",
          },
        },
        aiInsights: persistedInsights ? {
          summary: persistedInsights.summary || "",
          contentStrategy: persistedInsights.contentStrategy || [],
          hashtagStrategy: persistedInsights.hashtagStrategy || [],
          captionTemplates: persistedInsights.captionTemplates || [],
          videoIdeas: persistedInsights.videoIdeas || [],
          bestPostingAdvice: persistedInsights.bestPostingAdvice || "",
          audienceInsights: persistedInsights.audienceInsights || "",
          trendPrediction: persistedInsights.trendPrediction || "",
        } : undefined,
      } satisfies KeywordAnalysis;
    }

    return null;
  }, [analysisData, activeTab, trendAnalysis, selectedHashtags]);

  // Update workflow store when NEW API analysis data comes in (not persisted data)
  React.useEffect(() => {
    // Only update when we have fresh API data, not when loading from persisted state
    if (!analysisData) return;

    const apiAnalysis = analysisData.analyses.find((a) => a.keyword === activeTab);
    if (!apiAnalysis || !apiAnalysis.aggregateStats) return;

    setDiscoverPerformanceMetrics({
      avgViews: apiAnalysis.aggregateStats.avgViews,
      avgEngagement: apiAnalysis.aggregateStats.avgEngagementRate,
      viralBenchmark: apiAnalysis.aggregateStats.medianViews * 10,
    });
    if (apiAnalysis.aiInsights) {
      // Pass full AI insights object instead of flattened array
      setDiscoverAiInsights({
        summary: apiAnalysis.aiInsights.summary,
        contentStrategy: apiAnalysis.aiInsights.contentStrategy,
        hashtagStrategy: apiAnalysis.aiInsights.hashtagStrategy,
        captionTemplates: apiAnalysis.aiInsights.captionTemplates,
        videoIdeas: apiAnalysis.aiInsights.videoIdeas,
        bestPostingAdvice: apiAnalysis.aiInsights.bestPostingAdvice,
        audienceInsights: apiAnalysis.aiInsights.audienceInsights,
        trendPrediction: apiAnalysis.aiInsights.trendPrediction,
      });
    } else {
      setDiscoverAiInsights(null);
    }
    setDiscoverTrendAnalysis({
      keyword: apiAnalysis.keyword,
      totalVideos: apiAnalysis.totalVideos,
      viralVideos: apiAnalysis.performanceTiers.viral.map((v) => ({
        ...v,
        engagementRate: v.engagementRate,
      })),
      highPerformingVideos: apiAnalysis.performanceTiers.highPerforming.map((v) => ({
        ...v,
        engagementRate: v.engagementRate,
      })),
    });
  }, [analysisData, activeTab, setDiscoverPerformanceMetrics, setDiscoverAiInsights, setDiscoverTrendAnalysis]);

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
    // Clear old persisted analysis to fetch fresh data
    setDiscoverTrendAnalysis(null);
    setIsSearching(true);
    setActiveTab(keywords[0]);
    await refetch();
  }, [keywords, refetch, setDiscoverTrendAnalysis]);

  // Handle clear analysis
  const handleClearAnalysis = useCallback(() => {
    clearDiscoverAnalysis();
    setIsSearching(false);
    setActiveTab("trending");
    toast.success(
      language === "ko" ? "초기화됨" : "Cleared",
      language === "ko" ? "분석 데이터가 초기화되었습니다" : "Analysis data has been cleared"
    );
  }, [clearDiscoverAnalysis, language, toast]);

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
    async (video: KeywordAnalysis["videos"][0]) => {
      if (savedIds.has(video.id)) {
        removeInspiration(video.id);
        toast.success(
          language === "ko" ? "제거됨" : "Removed",
          language === "ko" ? "영감에서 제거되었습니다" : "Removed from inspiration"
        );
      } else {
        // First, add inspiration with original thumbnail URL
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

        // Then, cache thumbnail to S3 in background (don't block UI)
        if (video.thumbnailUrl && video.thumbnailUrl.startsWith("http")) {
          // Skip if already an S3 URL
          if (video.thumbnailUrl.includes(".s3.") && video.thumbnailUrl.includes("amazonaws.com")) {
            return;
          }

          try {
            const response = await fetch("/api/v1/inspiration/cache-thumbnail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                thumbnailUrl: video.thumbnailUrl,
                videoId: video.id,
              }),
            });

            const result = await response.json();
            if (result.success && result.cachedUrl) {
              // Update the inspiration with cached S3 URL
              updateInspiration(video.id, { thumbnailUrl: result.cachedUrl });
              console.log(`[Discover] Thumbnail cached to S3 for video ${video.id}`);
            }
          } catch (error) {
            // Silent fail - original URL will still work via proxy
            console.warn(`[Discover] Failed to cache thumbnail for video ${video.id}:`, error);
          }
        }
      }
    },
    [savedIds, addInspiration, updateInspiration, removeInspiration, language, toast]
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
        ? "트렌드 데이터를 수집하여 AI 콘텐츠 생성의 기반을 만드세요"
        : "Collect trend data to build the foundation for AI content generation",
    subtitleHint:
      language === "ko"
        ? "수집한 키워드, 해시태그, 영감이 맞춤형 프롬프트 생성에 활용됩니다"
        : "Collected keywords, hashtags, and inspiration will be used for custom prompt generation",
    searchPlaceholder:
      language === "ko"
        ? "키워드 또는 #해시태그 (최대 3개)..."
        : "Keyword or #hashtag (max 3)...",
    analyze: language === "ko" ? "분석" : "Analyze",
    trending: language === "ko" ? "실시간 트렌드" : "Live Trending",
    proceed: language === "ko" ? "분석 단계로" : "Proceed to Analyze",
  };

  return (
    <TooltipProvider>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col bg-white">
      {/* Header */}
      <WorkflowHeader
        onNext={handleProceedToAnalyze}
        canProceed={canProceedToAnalyze}
      />

      {/* Search Row */}
      <div className="flex items-center gap-4 px-[7%] py-3 border-b border-neutral-100 bg-white shrink-0">
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

        {/* Clear Analysis Button */}
        {(keywords.length > 0 || selectedHashtags.length > 0 || trendAnalysis) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAnalysis}
            className="h-9 px-3 text-neutral-500 hover:text-red-600 hover:bg-red-50"
            title={language === "ko" ? "분석 초기화" : "Clear Analysis"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-[7%] py-2 border-b border-neutral-100 bg-white shrink-0">
        <TabsList className="bg-neutral-100 border border-neutral-200">
          <TabsTrigger
            value="trending"
            className="text-xs data-[state=active]:bg-black data-[state=active]:text-white"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            {t.trending}
          </TabsTrigger>
          {/* Show keyword tabs - either from analysis data, persisted data, or as placeholders */}
          {keywords.map((keyword) => {
            const analysis = analysisData?.analyses.find((a) => a.keyword === keyword);
            const persistedAnalysis = trendAnalysis?.keyword === keyword ? trendAnalysis : null;
            const totalVideos = analysis?.totalVideos ?? persistedAnalysis?.totalVideos;
            return (
              <TabsTrigger
                key={keyword}
                value={keyword}
                className="text-xs data-[state=active]:bg-black data-[state=active]:text-white"
              >
                #{keyword}
                {totalVideos !== undefined ? (
                  <span className="ml-1 text-neutral-400">({totalVideos})</span>
                ) : analysisLoading ? (
                  <Spinner className="ml-1 h-3 w-3" />
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {/* Main Content - Full Width, Scrollable */}
      <div className="flex-1 overflow-auto px-[7%] py-4">
        {/* Live Trending Tab */}
        <TabsContent value="trending" className="mt-0">
          <LiveTrendingSection
            onSaveInspiration={handleSaveInspiration}
            savedIds={savedIds}
          />
        </TabsContent>

        {/* Keyword Analysis Tabs */}
        {keywords.map((keyword) => {
          // Check both API data and persisted data
          const analysis = analysisData?.analyses.find((a) => a.keyword === keyword);
          const persistedAnalysis = trendAnalysis?.keyword === keyword ? trendAnalysis : null;
          const hasAnalysis = analysis || persistedAnalysis;

          // Use currentAnalysis when this keyword is active (handles both sources)
          const displayAnalysis = activeTab === keyword ? currentAnalysis : analysis;

          return (
            <TabsContent key={keyword} value={keyword} className="mt-0">
              {analysisLoading && !persistedAnalysis ? (
                <div className="space-y-4">
                  <div className="h-20 bg-neutral-200 rounded-lg animate-pulse" />
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 bg-neutral-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="p-3 border border-neutral-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-8 bg-neutral-200 rounded animate-pulse" />
                          <div className="h-3 bg-neutral-200 rounded animate-pulse w-20" />
                        </div>
                        <div className="h-8 bg-neutral-200 rounded animate-pulse mb-2" />
                        <div className="flex gap-1 mb-3">
                          <div className="h-3 w-12 bg-neutral-200 rounded animate-pulse" />
                          <div className="h-3 w-10 bg-neutral-200 rounded animate-pulse" />
                        </div>
                        <div className="flex gap-3 mb-2">
                          <div className="h-3 w-12 bg-neutral-200 rounded animate-pulse" />
                          <div className="h-3 w-10 bg-neutral-200 rounded animate-pulse" />
                        </div>
                        <div className="h-1.5 bg-neutral-200 rounded-full animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : displayAnalysis ? (
                <AnalysisResults
                  analysis={displayAnalysis}
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
    </TooltipProvider>
  );
}
