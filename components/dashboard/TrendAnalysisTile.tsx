"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Eye,
  Heart,
  Search,
  Play,
  MessageCircle,
  Share2,
  Hash,
  Sparkles,
  Users,
  BarChart3,
  Lightbulb,
  X,
  Plus,
  Trophy,
  Flame,
  Target,
  Zap,
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { useKeywordAnalysis, KeywordAnalysis, useInvalidateQueries } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { cn, sanitizeUsername, sanitizeText } from "@/lib/utils";
import { TrendVideoActionDialog } from "./TrendVideoActionDialog";
import { TrendVideoContext } from "@/lib/trend-context";

interface TrendAnalysisTileProps {
  className?: string;
}

function formatCount(num: number | null | undefined): string {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return `${num.toFixed(2)}%`;
}

// Video Card Component - Larger stats
function VideoCard({
  video,
  onClick,
  showRank = false,
}: {
  video: KeywordAnalysis["videos"][0];
  onClick: (video: KeywordAnalysis["videos"][0]) => void;
  showRank?: boolean;
}) {
  const handleViewVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(video.videoUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="group flex-shrink-0 w-[160px] cursor-pointer"
      onClick={() => onClick(video)}
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted mb-2">
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="h-4 w-4 text-black fill-black ml-0.5" />
          </div>
        </div>
        {/* Rank badge */}
        {showRank && (
          <div className="absolute top-1.5 left-1.5 text-xs font-bold px-2 py-0.5 rounded bg-black/70 text-white">
            #{video.rank}
          </div>
        )}
        {/* View on TikTok button */}
        <button
          onClick={handleViewVideo}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="View on TikTok"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        {/* Views overlay */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-xs font-medium bg-black/60 px-1.5 py-0.5 rounded">
          <Eye className="h-3 w-3" />
          {formatCount(video.stats.playCount)}
        </div>
        {/* Engagement badge */}
        <div className="absolute bottom-1.5 right-1.5 text-xs font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">
          {formatPercent(video.engagementRate)}
        </div>
      </div>

      {/* Author */}
      <p className="text-xs font-medium truncate mb-1.5">@{sanitizeUsername(video.author.name)}</p>

      {/* Stats Row - Bigger */}
      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" />
          {formatCount(video.stats.likeCount)}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" />
          {formatCount(video.stats.commentCount)}
        </span>
        <span className="flex items-center gap-1">
          <Share2 className="h-3.5 w-3.5" />
          {formatCount(video.stats.shareCount)}
        </span>
      </div>
    </div>
  );
}

// AI Insights Component
function AIInsights({ insights }: { insights: NonNullable<KeywordAnalysis["aiInsights"]> }) {
  const { language } = useI18n();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-muted/30 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          {language === "ko" ? "AI 분석 인사이트" : "AI Analysis Insights"}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-7 px-2"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Summary - Always visible */}
      <p className="text-sm text-muted-foreground mb-3">{insights.summary}</p>

      {expanded && (
        <div className="space-y-4 pt-3 border-t">
          {/* Content Strategy */}
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2">
              {language === "ko" ? "콘텐츠 전략" : "Content Strategy"}
            </h5>
            <ul className="space-y-1.5">
              {insights.contentStrategy.map((tip, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Hashtag Strategy */}
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2">
              {language === "ko" ? "해시태그 전략" : "Hashtag Strategy"}
            </h5>
            <ul className="space-y-1.5">
              {insights.hashtagStrategy.map((tip, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Caption Templates */}
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2">
              {language === "ko" ? "캡션 템플릿" : "Caption Templates"}
            </h5>
            <div className="space-y-2">
              {insights.captionTemplates.map((template, i) => (
                <div key={i} className="text-xs bg-muted/50 p-2 rounded border-l-2 border-muted-foreground/30 italic">
                  &quot;{template}&quot;
                </div>
              ))}
            </div>
          </div>

          {/* Video Ideas */}
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2">
              {language === "ko" ? "비디오 아이디어" : "Video Ideas"}
            </h5>
            <ul className="space-y-1.5">
              {insights.videoIdeas.map((idea, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <Sparkles className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  {idea}
                </li>
              ))}
            </ul>
          </div>

          {/* Additional Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="bg-muted/50 rounded-lg p-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1">
                {language === "ko" ? "오디언스 인사이트" : "Audience Insights"}
              </h5>
              <p className="text-xs">{insights.audienceInsights}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1">
                {language === "ko" ? "트렌드 예측" : "Trend Prediction"}
              </h5>
              <p className="text-xs">{insights.trendPrediction}</p>
            </div>
          </div>

          {/* Posting Advice */}
          <div className="bg-muted/50 rounded-lg p-3">
            <h5 className="text-xs font-semibold text-muted-foreground mb-1">
              {language === "ko" ? "포스팅 조언" : "Posting Advice"}
            </h5>
            <p className="text-xs">{insights.bestPostingAdvice}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Stats Summary Component - With explanations
function StatsSummary({ stats, recommendations }: { stats: KeywordAnalysis["aggregateStats"]; recommendations: KeywordAnalysis["recommendations"] }) {
  const { language } = useI18n();

  return (
    <div className="border rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        {language === "ko" ? "성과 지표" : "Performance Metrics"}
      </h4>
      <p className="text-[11px] text-muted-foreground mb-3">
        {language === "ko"
          ? "분석된 영상들의 평균 성과와 목표 기준을 보여줍니다"
          : "Average performance of analyzed videos and target benchmarks"}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <Eye className="h-3.5 w-3.5" />
            {language === "ko" ? "평균 조회수" : "Avg Views"}
          </div>
          <div className="text-xl font-bold">{formatCount(stats.avgViews)}</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {language === "ko" ? "영상당 평균 재생 횟수" : "Average plays per video"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <Zap className="h-3.5 w-3.5" />
            {language === "ko" ? "평균 참여율" : "Avg Engagement"}
          </div>
          <div className="text-xl font-bold">{formatPercent(stats.avgEngagementRate)}</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {language === "ko" ? "(좋아요+댓글+공유) ÷ 조회수" : "(likes+comments+shares) ÷ views"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <Trophy className="h-3.5 w-3.5" />
            {language === "ko" ? "바이럴 기준" : "Viral Threshold"}
          </div>
          <div className="text-sm font-semibold">{recommendations.engagementBenchmarks.toGoViral}</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {language === "ko" ? "상위 10% 진입 기준" : "Top 10% benchmark"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <Target className="h-3.5 w-3.5" />
            {language === "ko" ? "고성과 기준" : "High Performer"}
          </div>
          <div className="text-sm font-semibold">{recommendations.engagementBenchmarks.toBeHighPerforming}</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {language === "ko" ? "상위 25% 진입 기준" : "Top 25% benchmark"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Hashtag Insights Component - With explanations
function HashtagInsights({ insights }: { insights: KeywordAnalysis["hashtagInsights"] }) {
  const { language } = useI18n();

  return (
    <div className="border rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <Hash className="h-4 w-4 text-muted-foreground" />
        {language === "ko" ? "해시태그 추천" : "Hashtag Recommendations"}
      </h4>
      <p className="text-[11px] text-muted-foreground mb-3">
        {language === "ko"
          ? "고성과 영상들에서 자주 사용되는 해시태그입니다"
          : "Frequently used hashtags in high-performing videos"}
      </p>

      {/* Recommended Hashtags */}
      <div className="mb-4">
        <h5 className="text-xs font-medium text-muted-foreground mb-2">
          {language === "ko" ? "추천 해시태그" : "Suggested Tags"}
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {insights.recommendedHashtags.slice(0, 8).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-full font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Effective Combos */}
      {insights.hashtagCombos.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-1">
            {language === "ko" ? "효과적인 조합" : "Effective Combos"}
          </h5>
          <p className="text-[10px] text-muted-foreground mb-2">
            {language === "ko"
              ? "함께 사용시 높은 참여율을 보이는 해시태그 조합"
              : "Hashtag pairs with higher engagement when used together"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {insights.hashtagCombos.slice(0, 3).map((combo, i) => (
              <span
                key={i}
                className="text-xs bg-muted/70 px-2.5 py-1 rounded-full"
              >
                #{combo.combo.join(" + #")} <span className="text-muted-foreground ml-1">({formatPercent(combo.avgEngagement)})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Content Tips Component - With explanations
function ContentTips({ recommendations, patterns }: { recommendations: KeywordAnalysis["recommendations"]; patterns: KeywordAnalysis["contentPatterns"] }) {
  const { language } = useI18n();

  return (
    <div className="border rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        {language === "ko" ? "콘텐츠 최적화 팁" : "Content Optimization Tips"}
      </h4>
      <p className="text-[11px] text-muted-foreground mb-3">
        {language === "ko"
          ? "바이럴 영상들의 패턴을 분석한 인사이트입니다"
          : "Insights from analyzing patterns in viral videos"}
      </p>

      {/* Tips List */}
      <ul className="space-y-2 mb-4">
        {recommendations.contentTips.slice(0, 4).map((tip, i) => (
          <li key={i} className="text-xs flex items-start gap-2">
            <span className="text-muted-foreground mt-0.5">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      {/* Optimal Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-2.5">
          <div className="text-xs text-muted-foreground mb-0.5">
            {language === "ko" ? "최적 해시태그 수" : "Optimal Hashtags"}
          </div>
          <div className="text-sm font-semibold">
            {recommendations.optimalHashtagCount}{language === "ko" ? "개" : " tags"}
          </div>
        </div>
        {patterns.emojiUsage.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground mb-0.5">
              {language === "ko" ? "인기 이모지" : "Popular Emojis"}
            </div>
            <div className="text-sm">
              {patterns.emojiUsage.slice(0, 6).map((e) => e.emoji).join(" ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Top Creators Component - With explanations
function TopCreators({ creators }: { creators: KeywordAnalysis["creatorInsights"]["topCreators"] }) {
  const { language } = useI18n();

  if (creators.length === 0) return null;

  return (
    <div className="border rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        {language === "ko" ? "탑 크리에이터" : "Top Creators"}
      </h4>
      <p className="text-[11px] text-muted-foreground mb-3">
        {language === "ko"
          ? "이 키워드에서 높은 참여율을 보이는 크리에이터"
          : "Creators with highest engagement for this keyword"}
      </p>
      <div className="space-y-2">
        {creators.slice(0, 5).map((creator, i) => (
          <div
            key={creator.id}
            className="flex items-center justify-between text-xs bg-muted/50 px-3 py-2 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-4">{i + 1}.</span>
              <span className="font-medium">@{creator.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span className="font-semibold">{formatPercent(creator.avgEngagement)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Single Keyword Analysis Tab Content
function KeywordAnalysisContent({
  analysis,
  onVideoClick,
}: {
  analysis: KeywordAnalysis;
  onVideoClick: (video: KeywordAnalysis["videos"][0]) => void;
}) {
  const { language } = useI18n();

  if (analysis.error || analysis.totalVideos === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground text-sm">
          {analysis.error || (language === "ko" ? "비디오를 찾을 수 없습니다" : "No videos found")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Insights - Show first if available */}
      {analysis.aiInsights && <AIInsights insights={analysis.aiInsights} />}

      {/* Stats Summary */}
      <StatsSummary stats={analysis.aggregateStats} recommendations={analysis.recommendations} />

      {/* Video Performance Section */}
      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          {language === "ko" ? "영상 성과 순위" : "Video Performance Ranking"}
        </h4>
        <p className="text-[11px] text-muted-foreground mb-4">
          {language === "ko"
            ? "참여율 기준으로 정렬된 영상들입니다. 클릭하여 분석하거나 생성에 활용하세요."
            : "Videos sorted by engagement rate. Click to analyze or use for content creation."}
        </p>

        {/* Viral Videos */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h5 className="text-xs font-semibold">
              {language === "ko" ? `바이럴 (상위 10%)` : `Viral (Top 10%)`}
            </h5>
            <span className="text-[10px] text-muted-foreground">
              {language === "ko"
                ? `참여율 ${analysis.recommendations.engagementBenchmarks.toGoViral} 이상`
                : `${analysis.recommendations.engagementBenchmarks.toGoViral}+ engagement`}
            </span>
          </div>
          <ScrollArea className="w-full">
            <div className="flex gap-3 pb-3">
              {analysis.performanceTiers.viral.map((video) => (
                <VideoCard key={video.id} video={video} onClick={onVideoClick} showRank />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* High Performing Videos */}
        {analysis.performanceTiers.highPerforming.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <h5 className="text-xs font-semibold">
                {language === "ko" ? `고성과 (상위 25%)` : `High Performing (Top 25%)`}
              </h5>
              <span className="text-[10px] text-muted-foreground">
                {language === "ko"
                  ? `참여율 ${analysis.recommendations.engagementBenchmarks.toBeHighPerforming} 이상`
                  : `${analysis.recommendations.engagementBenchmarks.toBeHighPerforming}+ engagement`}
              </span>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-3">
                {analysis.performanceTiers.highPerforming.slice(0, 8).map((video) => (
                  <VideoCard key={video.id} video={video} onClick={onVideoClick} showRank />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Insights Grid - Reorganized */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Hashtags & Creators */}
        <div className="space-y-4">
          <HashtagInsights insights={analysis.hashtagInsights} />
          <TopCreators creators={analysis.creatorInsights.topCreators} />
        </div>
        {/* Right Column: Content Tips */}
        <div>
          <ContentTips recommendations={analysis.recommendations} patterns={analysis.contentPatterns} />
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = "hydra_trend_analysis_keywords";

// Main Component
export default function TrendAnalysisTile({ className }: TrendAnalysisTileProps) {
  const router = useRouter();
  const { language } = useI18n();
  const { invalidateKeywordAnalysis } = useInvalidateQueries();

  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved keywords from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedKeywords = JSON.parse(saved) as string[];
        if (Array.isArray(parsedKeywords) && parsedKeywords.length > 0) {
          setKeywords(parsedKeywords);
          setActiveTab(parsedKeywords[0]);
          setIsSearching(true);
        }
      }
    } catch (e) {
      console.error("Failed to load saved keywords:", e);
    }
    setIsInitialized(true);
  }, []);

  // Save keywords to localStorage when they change (after search)
  useEffect(() => {
    if (isInitialized && isSearching && keywords.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keywords));
      } catch (e) {
        console.error("Failed to save keywords:", e);
      }
    }
  }, [keywords, isSearching, isInitialized]);

  // Only fetch when we have keywords and user initiates search
  const { data, isLoading, error, refetch } = useKeywordAnalysis({
    keywords,
    limit: 30,
    enabled: isSearching && keywords.length > 0,
  });

  const handleAddKeyword = useCallback(() => {
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed && keywords.length < 3 && !keywords.includes(trimmed)) {
      const newKeywords = [...keywords, trimmed];
      setKeywords(newKeywords);
      setInputValue("");
      if (newKeywords.length === 1) {
        setActiveTab(trimmed);
      }
    }
  }, [inputValue, keywords]);

  const handleRemoveKeyword = useCallback((keyword: string) => {
    const newKeywords = keywords.filter((k) => k !== keyword);
    setKeywords(newKeywords);
    if (activeTab === keyword && newKeywords.length > 0) {
      setActiveTab(newKeywords[0]);
    }
    if (newKeywords.length === 0) {
      setIsSearching(false);
      // Clear localStorage when all keywords are removed
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error("Failed to clear saved keywords:", e);
      }
    } else {
      // Update localStorage with remaining keywords
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newKeywords));
      } catch (e) {
        console.error("Failed to update saved keywords:", e);
      }
    }
  }, [keywords, activeTab]);

  const handleSearch = useCallback(async () => {
    if (keywords.length === 0) return;
    setIsSearching(true);
    invalidateKeywordAnalysis();
    await refetch();
  }, [keywords, invalidateKeywordAnalysis, refetch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  }, [handleAddKeyword]);

  // Dialog state
  const [selectedVideo, setSelectedVideo] = useState<TrendVideoContext | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Get current analysis for context
  const currentAnalysis = useMemo(() => {
    if (!data || !activeTab) return null;
    return data.analyses.find(a => a.keyword === activeTab) || null;
  }, [data, activeTab]);

  // Handle video click - open dialog with full context
  const handleVideoClick = useCallback((video: KeywordAnalysis["videos"][0]) => {
    const context: TrendVideoContext = {
      source: "keyword_analysis",
      keyword: activeTab,
      video: {
        id: video.id,
        url: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl || null,
        description: sanitizeText(video.description) || "",
        authorId: sanitizeUsername(video.author.id),
        authorName: sanitizeUsername(video.author.name),
      },
      stats: {
        playCount: video.stats.playCount,
        likeCount: video.stats.likeCount,
        commentCount: video.stats.commentCount,
        shareCount: video.stats.shareCount,
        engagementRate: video.engagementRate,
      },
      hashtags: video.hashtags,
      aiInsights: currentAnalysis?.aiInsights,
      recommendations: currentAnalysis ? {
        suggestedHashtags: currentAnalysis.recommendations.suggestedHashtags,
        contentTips: currentAnalysis.recommendations.contentTips,
        optimalHashtagCount: currentAnalysis.recommendations.optimalHashtagCount,
      } : undefined,
      createdAt: new Date().toISOString(),
    };

    setSelectedVideo(context);
    setDialogOpen(true);
  }, [activeTab, currentAnalysis]);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            {language === "ko" ? "트렌드 키워드 분석" : "Trend Keyword Analysis"}
          </CardTitle>
        </div>

        {/* Keyword Input */}
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={language === "ko" ? "키워드 입력 (최대 3개)..." : "Enter keyword (max 3)..."}
                className="pl-9 h-9"
                disabled={keywords.length >= 3}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddKeyword}
              disabled={!inputValue.trim() || keywords.length >= 3}
              className="h-9"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={keywords.length === 0 || isLoading}
              className="h-9"
            >
              {isLoading ? (
                <span className="animate-pulse">{language === "ko" ? "분석중..." : "Analyzing..."}</span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  {language === "ko" ? "분석" : "Analyze"}
                </>
              )}
            </Button>
          </div>

          {/* Keyword Pills */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1 text-xs bg-muted text-foreground px-2 py-1 rounded-full"
                >
                  #{keyword}
                  <button
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <span className="text-xs text-muted-foreground py-1">
                {3 - keywords.length} {language === "ko" ? "개 남음" : "remaining"}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Empty State */}
        {!isSearching && keywords.length === 0 && (
          <div className="text-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              {language === "ko"
                ? "키워드를 입력하고 분석을 시작하세요"
                : "Enter keywords to start analysis"}
            </p>
            <p className="text-xs text-muted-foreground">
              {language === "ko"
                ? "예: countrymusic, kpop, dance"
                : "e.g., countrymusic, kpop, dance"}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-lg" />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[160px]">
                  <Skeleton className="aspect-[9/16] rounded-lg mb-2" />
                  <Skeleton className="h-3 w-20 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-destructive mb-2">
              {language === "ko" ? "분석 중 오류가 발생했습니다" : "Analysis failed"}
            </p>
            <Button variant="outline" size="sm" onClick={handleSearch}>
              {language === "ko" ? "다시 시도" : "Try Again"}
            </Button>
          </div>
        )}

        {/* Results with Tabs */}
        {data && data.analyses.length > 0 && !isLoading && (
          <Tabs value={activeTab || data.keywords[0]} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              {data.analyses.map((analysis) => (
                <TabsTrigger key={analysis.keyword} value={analysis.keyword} className="text-xs">
                  #{analysis.keyword}
                  <span className="ml-1 text-muted-foreground">({analysis.totalVideos})</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {data.analyses.map((analysis) => (
              <TabsContent key={analysis.keyword} value={analysis.keyword} className="mt-0">
                <KeywordAnalysisContent analysis={analysis} onVideoClick={handleVideoClick} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>

      {/* Trend Video Action Dialog */}
      <TrendVideoActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={selectedVideo}
      />
    </Card>
  );
}
