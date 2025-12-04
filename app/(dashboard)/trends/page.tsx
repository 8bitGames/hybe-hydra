"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { saveBridgePrompt } from "@/lib/bridge-storage";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { promptApi, PromptTransformResponse } from "@/lib/video-api";
import { useCampaigns, useKeywordAnalysis, KeywordAnalysis, useInvalidateQueries } from "@/lib/queries";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendVideoActionDialog } from "@/components/dashboard/TrendVideoActionDialog";
import { TrendVideoContext } from "@/lib/trend-context";
import {
  Sparkles,
  Zap,
  ArrowRight,
  Check,
  Hash,
  FolderOpen,
  Wand2,
  TrendingUp,
  X,
  ChevronRight,
  Music,
  Image as ImageIcon,
  Plus,
  Search,
  Eye,
  ExternalLink,
  Play,
  CheckCircle,
  AlertCircle,
  Heart,
  MessageCircle,
  Share2,
  Brain,
  Trophy,
  Flame,
  Target,
  Users,
  Lightbulb,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronUp,
  Settings,
} from "lucide-react";
import { cn, sanitizeUsername, sanitizeText } from "@/lib/utils";

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

function VideoCard({
  video,
  onClick,
  onUseAsInspiration,
  showRank = false,
}: {
  video: KeywordAnalysis["videos"][0];
  onClick: (video: KeywordAnalysis["videos"][0]) => void;
  onUseAsInspiration?: (video: KeywordAnalysis["videos"][0]) => void;
  showRank?: boolean;
}) {
  const handleViewVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(video.videoUrl, "_blank", "noopener,noreferrer");
  };

  const handleUseInspiration = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUseAsInspiration?.(video);
  };

  return (
    <div
      className="group flex-shrink-0 w-[140px] cursor-pointer"
      onClick={() => onClick(video)}
    >
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
          <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="h-4 w-4 text-black fill-black ml-0.5" />
          </div>
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
        {/* Use as inspiration button */}
        {onUseAsInspiration && (
          <button
            onClick={handleUseInspiration}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap"
          >
            Use this style
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
      <p className="text-[11px] font-medium truncate mb-1">@{sanitizeUsername(video.author.name)}</p>

      {/* Stats Row */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
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
// AI Insights Component
// ============================================================================

function AIInsights({ insights, language }: { insights: NonNullable<KeywordAnalysis["aiInsights"]>; language: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-3 bg-gradient-to-br from-purple-500/5 to-blue-500/5 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-purple-500" />
          {language === "ko" ? "AI 인사이트" : "AI Insights"}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-6 px-2 text-xs"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{insights.summary}</p>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Content Strategy */}
          <div>
            <h5 className="text-[10px] font-semibold text-muted-foreground mb-1.5">
              {language === "ko" ? "콘텐츠 전략" : "Content Strategy"}
            </h5>
            <ul className="space-y-1">
              {insights.contentStrategy.slice(0, 3).map((tip, i) => (
                <li key={i} className="text-[11px] flex items-start gap-1.5">
                  <span className="text-muted-foreground">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Video Ideas */}
          <div>
            <h5 className="text-[10px] font-semibold text-muted-foreground mb-1.5">
              {language === "ko" ? "비디오 아이디어" : "Video Ideas"}
            </h5>
            <ul className="space-y-1">
              {insights.videoIdeas.slice(0, 3).map((idea, i) => (
                <li key={i} className="text-[11px] flex items-start gap-1.5">
                  <Sparkles className="h-2.5 w-2.5 text-muted-foreground mt-0.5 shrink-0" />
                  {idea}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stats Summary Component
// ============================================================================

function StatsSummary({ stats, recommendations, language }: {
  stats: KeywordAnalysis["aggregateStats"];
  recommendations: KeywordAnalysis["recommendations"];
  language: string;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      <div className="bg-muted/50 rounded-lg p-2 text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] mb-0.5">
          <Eye className="h-2.5 w-2.5" />
          {language === "ko" ? "평균 조회" : "Avg Views"}
        </div>
        <div className="text-sm font-bold">{formatCount(stats.avgViews)}</div>
      </div>
      <div className="bg-muted/50 rounded-lg p-2 text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] mb-0.5">
          <Zap className="h-2.5 w-2.5" />
          {language === "ko" ? "참여율" : "Engagement"}
        </div>
        <div className="text-sm font-bold">{formatPercent(stats.avgEngagementRate)}</div>
      </div>
      <div className="bg-muted/50 rounded-lg p-2 text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] mb-0.5">
          <Trophy className="h-2.5 w-2.5" />
          {language === "ko" ? "바이럴" : "Viral"}
        </div>
        <div className="text-[11px] font-semibold">{recommendations.engagementBenchmarks.toGoViral}</div>
      </div>
      <div className="bg-muted/50 rounded-lg p-2 text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] mb-0.5">
          <Target className="h-2.5 w-2.5" />
          {language === "ko" ? "고성과" : "High"}
        </div>
        <div className="text-[11px] font-semibold">{recommendations.engagementBenchmarks.toBeHighPerforming}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Hashtag Recommendations Component
// ============================================================================

function HashtagRecommendations({
  insights,
  selectedTrends,
  onSelectTrend,
  language
}: {
  insights: KeywordAnalysis["hashtagInsights"];
  selectedTrends: string[];
  onSelectTrend: (tag: string) => void;
  language: string;
}) {
  return (
    <div className="mb-3">
      <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
        {language === "ko" ? "추천 해시태그" : "Recommended Hashtags"}
        <span className="text-[10px] text-muted-foreground font-normal ml-1">
          ({language === "ko" ? "클릭하여 추가" : "click to add"})
        </span>
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {insights.recommendedHashtags.slice(0, 10).map((tag) => {
          const isSelected = selectedTrends.includes(tag);
          return (
            <Badge
              key={tag}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "cursor-pointer text-[11px] transition-all",
                isSelected ? "" : "hover:bg-muted"
              )}
              onClick={() => onSelectTrend(tag)}
            >
              #{tag}
              {isSelected ? (
                <Check className="h-2.5 w-2.5 ml-1" />
              ) : (
                <Plus className="h-2.5 w-2.5 ml-1 opacity-50" />
              )}
            </Badge>
          );
        })}
      </div>

      {/* Hashtag Combos */}
      {insights.hashtagCombos.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] text-muted-foreground mb-1">
            {language === "ko" ? "효과적인 조합:" : "Effective combos:"}
          </p>
          <div className="flex flex-wrap gap-1">
            {insights.hashtagCombos.slice(0, 2).map((combo, i) => (
              <span
                key={i}
                className="text-[10px] bg-muted/70 px-2 py-0.5 rounded-full"
              >
                #{combo.combo.join(" + #")} ({formatPercent(combo.avgEngagement)})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Top Creators Component
// ============================================================================

function TopCreators({ creators, language }: { creators: KeywordAnalysis["creatorInsights"]["topCreators"]; language: string }) {
  if (creators.length === 0) return null;

  return (
    <div className="mb-3">
      <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        {language === "ko" ? "탑 크리에이터" : "Top Creators"}
      </h4>
      <div className="space-y-1">
        {creators.slice(0, 3).map((creator, i) => (
          <div
            key={creator.id}
            className="flex items-center justify-between text-[11px] bg-muted/30 px-2 py-1.5 rounded"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground w-3">{i + 1}.</span>
              <span className="font-medium">@{creator.name}</span>
            </div>
            <span className="text-muted-foreground">{formatPercent(creator.avgEngagement)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Content Tips Component
// ============================================================================

function ContentTips({ recommendations, language }: { recommendations: KeywordAnalysis["recommendations"]; language: string }) {
  return (
    <div className="mb-3">
      <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
        <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
        {language === "ko" ? "콘텐츠 팁" : "Content Tips"}
      </h4>
      <ul className="space-y-1">
        {recommendations.contentTips.slice(0, 3).map((tip, i) => (
          <li key={i} className="text-[11px] flex items-start gap-1.5">
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{tip}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[10px] text-muted-foreground">
        {language === "ko" ? "최적 해시태그 수:" : "Optimal hashtags:"} <span className="font-medium text-foreground">{recommendations.optimalHashtagCount}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Analysis Results Component
// ============================================================================

function AnalysisResults({
  analysis,
  selectedTrends,
  onSelectTrend,
  onVideoClick,
  onUseAsInspiration,
  language,
}: {
  analysis: KeywordAnalysis;
  selectedTrends: string[];
  onSelectTrend: (tag: string) => void;
  onVideoClick: (video: KeywordAnalysis["videos"][0]) => void;
  onUseAsInspiration: (video: KeywordAnalysis["videos"][0]) => void;
  language: string;
}) {
  if (analysis.error || analysis.totalVideos === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          {analysis.error || (language === "ko" ? "비디오를 찾을 수 없습니다" : "No videos found")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Insights */}
      {analysis.aiInsights && <AIInsights insights={analysis.aiInsights} language={language} />}

      {/* Stats Summary */}
      <StatsSummary stats={analysis.aggregateStats} recommendations={analysis.recommendations} language={language} />

      {/* Viral Videos */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <h4 className="text-xs font-semibold">
            {language === "ko" ? "바이럴 영상" : "Viral Videos"}
          </h4>
          <span className="text-[10px] text-muted-foreground">
            ({language === "ko" ? "상위 10%" : "Top 10%"})
          </span>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-2.5 pb-2">
            {analysis.performanceTiers.viral.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={onVideoClick}
                onUseAsInspiration={onUseAsInspiration}
                showRank
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* High Performing Videos */}
      {analysis.performanceTiers.highPerforming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <h4 className="text-xs font-semibold">
              {language === "ko" ? "고성과 영상" : "High Performing"}
            </h4>
            <span className="text-[10px] text-muted-foreground">
              ({language === "ko" ? "상위 25%" : "Top 25%"})
            </span>
          </div>
          <ScrollArea className="w-full">
            <div className="flex gap-2.5 pb-2">
              {analysis.performanceTiers.highPerforming.slice(0, 6).map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={onVideoClick}
                  onUseAsInspiration={onUseAsInspiration}
                  showRank
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Two Column Layout for Recommendations */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          {/* Hashtag Recommendations */}
          <HashtagRecommendations
            insights={analysis.hashtagInsights}
            selectedTrends={selectedTrends}
            onSelectTrend={onSelectTrend}
            language={language}
          />
          {/* Top Creators */}
          <TopCreators creators={analysis.creatorInsights.topCreators} language={language} />
        </div>
        <div>
          {/* Content Tips */}
          <ContentTips recommendations={analysis.recommendations} language={language} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Admin Collection Component
// ============================================================================

interface CollectResult {
  success: boolean;
  method: string;
  collected_count: number;
  saved_count: number;
  trends: { rank: number; keyword: string; viewCount?: number; videoCount?: number }[];
  error?: string;
}

function AdminCollection({ language, accessToken }: { language: string; accessToken: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [keywords, setKeywords] = useState("countrymusic");
  const [hashtags, setHashtags] = useState("");
  const [includeExplore, setIncludeExplore] = useState(true);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null);

  const handleCollect = async () => {
    if (!accessToken) return;

    setCollectLoading(true);
    setCollectResult(null);

    try {
      api.setAccessToken(accessToken);
      const response = await api.post<CollectResult>("/api/v1/trends/collect", {
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        hashtags: hashtags.split(",").map((h) => h.trim()).filter(Boolean),
        includeExplore,
        region: "KR",
        platform: "TIKTOK",
      });

      if (response.data) {
        setCollectResult(response.data);
      }
    } catch (err) {
      console.error("Collection failed:", err);
    } finally {
      setCollectLoading(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between h-10 px-3 text-sm text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {language === "ko" ? "관리자: 트렌드 수집" : "Admin: Trend Collection"}
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="keywords" className="text-xs">
                  {language === "ko" ? "키워드 (쉼표 구분)" : "Keywords (comma separated)"}
                </Label>
                <Input
                  id="keywords"
                  placeholder="countrymusic, carlypearce"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags" className="text-xs">
                  {language === "ko" ? "해시태그 (쉼표 구분)" : "Hashtags (comma separated)"}
                </Label>
                <Input
                  id="hashtags"
                  placeholder="fyp, viral"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="explore"
                  checked={includeExplore}
                  onCheckedChange={(checked) => setIncludeExplore(checked === true)}
                />
                <Label htmlFor="explore" className="text-xs font-normal">
                  {language === "ko" ? "Discover 페이지 포함" : "Include Discover page"}
                </Label>
              </div>
              <Button onClick={handleCollect} disabled={collectLoading} size="sm">
                {collectLoading ? (
                  <Spinner className="h-3 w-3 mr-1" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                {language === "ko" ? "수집" : "Collect"}
              </Button>
            </div>

            {collectResult && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  {collectResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-medium">
                    {collectResult.collected_count} collected, {collectResult.saved_count} saved
                  </span>
                </div>
                {collectResult.trends.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {collectResult.trends.slice(0, 8).map((trend) => (
                      <Badge key={trend.rank} variant="secondary" className="text-xs">
                        #{trend.keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function TrendsPage() {
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const { language } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Campaigns - fetch all available
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({ page_size: 100, status: "active" });
  const campaigns = campaignsData?.items || [];

  // Keyword Analysis State
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);

  const { invalidateKeywordAnalysis } = useInvalidateQueries();

  // Fetch keyword analysis
  const { data: analysisData, isLoading: analysisLoading, refetch: refetchAnalysis } = useKeywordAnalysis({
    keywords,
    limit: 30,
    enabled: isSearching && keywords.length > 0,
  });

  // Bridge State
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [transformedPrompt, setTransformedPrompt] = useState<PromptTransformResponse | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  // Video Dialog State
  const [selectedVideo, setSelectedVideo] = useState<TrendVideoContext | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-select first campaign
  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  // Handle URL params
  useEffect(() => {
    const analyzeUrl = searchParams.get("analyze_url") || sessionStorage.getItem("tiktok_analyze_url");
    if (analyzeUrl) {
      const tiktokInstruction = language === "ko"
        ? `이 TikTok 영상과 비슷한 스타일의 영상을 만들어주세요:\n${analyzeUrl}`
        : `Create a video similar to this TikTok:\n${analyzeUrl}`;
      setUserInput(tiktokInstruction);
      sessionStorage.removeItem("tiktok_analyze_url");
    }
  }, [searchParams, language]);

  // Get current analysis
  const currentAnalysis = useMemo(() => {
    if (!analysisData || !activeTab) return null;
    return analysisData.analyses.find(a => a.keyword === activeTab) || null;
  }, [analysisData, activeTab]);

  // Handlers
  const handleAddKeyword = useCallback(() => {
    const trimmed = inputValue.trim().toLowerCase().replace(/^#/, "");
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
    }
  }, [keywords, activeTab]);

  const handleSearch = useCallback(async () => {
    if (keywords.length === 0) return;
    setIsSearching(true);
    invalidateKeywordAnalysis();
    await refetchAnalysis();
  }, [keywords, invalidateKeywordAnalysis, refetchAnalysis]);

  const handleSelectTrend = useCallback((tag: string) => {
    setSelectedTrends((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= 3) {
        toast.warning(
          language === "ko" ? "최대 3개" : "Max 3",
          language === "ko" ? "트렌드는 최대 3개까지" : "Up to 3 trends allowed"
        );
        return prev;
      }
      return [...prev, tag];
    });
  }, [language, toast]);

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

  const handleUseAsInspiration = useCallback((video: KeywordAnalysis["videos"][0]) => {
    // Pre-fill user input with video description
    const inspiration = language === "ko"
      ? `이 스타일로 영상을 만들어주세요:\n"${video.description || ""}"\n\n스타일: @${video.author.name}의 영상 참고`
      : `Create a video in this style:\n"${video.description || ""}"\n\nStyle reference: @${video.author.name}'s video`;

    setUserInput(inspiration);

    // Add video's hashtags to selected trends
    const newTrends = [...selectedTrends];
    video.hashtags.slice(0, 3 - selectedTrends.length).forEach(tag => {
      if (!newTrends.includes(tag) && newTrends.length < 3) {
        newTrends.push(tag);
      }
    });
    setSelectedTrends(newTrends);

    toast.success(
      language === "ko" ? "영감 적용됨" : "Inspiration applied",
      language === "ko" ? "아이디어를 수정하고 최적화하세요" : "Edit the idea and optimize"
    );
  }, [language, selectedTrends, toast]);

  const handleTransform = async () => {
    if (!userInput.trim() || !selectedCampaignId) return;

    setIsTransforming(true);
    setTransformedPrompt(null);

    try {
      const result = await promptApi.transform({
        user_input: userInput,
        campaign_id: selectedCampaignId,
        trend_keywords: selectedTrends,
      });

      if (result.data) {
        if (result.data.status === "blocked") {
          toast.error(
            language === "ko" ? "안전성 검사 실패" : "Safety check failed",
            result.data.blocked_reason || ""
          );
        } else {
          setTransformedPrompt(result.data);
          toast.success(
            language === "ko" ? "프롬프트 최적화 완료" : "Prompt optimized",
            language === "ko" ? "AI가 프롬프트를 최적화했습니다" : "AI has optimized your prompt"
          );
        }
      }
    } catch (error) {
      console.error("Transform error:", error);
      toast.error(
        language === "ko" ? "오류 발생" : "Error occurred",
        language === "ko" ? "다시 시도해주세요" : "Please try again"
      );
    } finally {
      setIsTransforming(false);
    }
  };

  const handleNavigateToGenerate = () => {
    if (!selectedCampaignId || !transformedPrompt) return;
    saveBridgePrompt({
      campaignId: selectedCampaignId,
      originalPrompt: userInput,
      transformedPrompt: transformedPrompt,
      selectedTrends: selectedTrends,
      timestamp: Date.now(),
    });
    router.push(`/campaigns/${selectedCampaignId}/generate`);
  };

  const handleNavigateToCompose = () => {
    if (!selectedCampaignId || !transformedPrompt) return;
    saveBridgePrompt({
      campaignId: selectedCampaignId,
      originalPrompt: userInput,
      transformedPrompt: transformedPrompt,
      selectedTrends: selectedTrends,
      timestamp: Date.now(),
    });
    router.push(`/campaigns/${selectedCampaignId}/compose`);
  };

  const isAdmin = user?.role === "ADMIN";

  // Translations
  const t = {
    title: language === "ko" ? "트렌드 기반 콘텐츠 생성" : "Trend-Powered Content Creation",
    subtitle: language === "ko" ? "TikTok 트렌드를 분석하고 AI로 최적화된 콘텐츠를 생성하세요" : "Analyze TikTok trends and create AI-optimized content",
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{t.title}</h1>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      {/* Main Content - Full Width Side by Side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Analysis (60%) */}
        <div className="w-[60%] border-r flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-muted/30 shrink-0">
            {/* Search Input */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                  placeholder={language === "ko" ? "키워드 또는 #해시태그 (최대 3개)..." : "Keyword or #hashtag (max 3)..."}
                  className="pl-9 h-9"
                  disabled={keywords.length >= 3}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddKeyword}
                disabled={!inputValue.trim() || keywords.length >= 3}
                className="h-9 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={keywords.length === 0 || analysisLoading}
                className="h-9 px-4"
              >
                {analysisLoading ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    {language === "ko" ? "분석" : "Analyze"}
                  </>
                )}
              </Button>
            </div>

            {/* Keyword Pills */}
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="cursor-pointer text-xs pl-2"
                    onClick={() => handleRemoveKeyword(keyword)}
                  >
                    #{keyword}
                    <X className="h-3 w-3 ml-1.5" />
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground py-1">
                  {3 - keywords.length} {language === "ko" ? "개 남음" : "remaining"}
                </span>
              </div>
            )}
          </div>

          {/* Analysis Results */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {!isSearching && keywords.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">
                    {language === "ko" ? "키워드를 입력하세요" : "Enter keywords to start"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === "ko"
                      ? "예: countrymusic, #kpop, dance"
                      : "e.g., countrymusic, #kpop, dance"}
                  </p>
                </div>
              ) : analysisLoading ? (
                <div className="space-y-4">
                  <div className="h-20 bg-muted rounded-lg animate-pulse" />
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-hidden">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-[140px] shrink-0">
                        <div className="aspect-[9/16] bg-muted rounded-lg animate-pulse mb-2" />
                        <div className="h-3 bg-muted rounded animate-pulse w-20" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : analysisData && analysisData.analyses.length > 0 ? (
                <Tabs value={activeTab || analysisData.keywords[0]} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    {analysisData.analyses.map((analysis) => (
                      <TabsTrigger key={analysis.keyword} value={analysis.keyword} className="text-xs">
                        #{analysis.keyword}
                        <span className="ml-1 text-muted-foreground">({analysis.totalVideos})</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {analysisData.analyses.map((analysis) => (
                    <TabsContent key={analysis.keyword} value={analysis.keyword} className="mt-0">
                      <AnalysisResults
                        analysis={analysis}
                        selectedTrends={selectedTrends}
                        onSelectTrend={handleSelectTrend}
                        onVideoClick={handleVideoClick}
                        onUseAsInspiration={handleUseAsInspiration}
                        language={language}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              ) : null}
            </div>
          </ScrollArea>

          {/* Admin Collection */}
          {isAdmin && (
            <div className="border-t p-2 shrink-0">
              <AdminCollection language={language} accessToken={accessToken} />
            </div>
          )}
        </div>

        {/* Right Panel - Content Creation (40%) */}
        <div className="w-[40%] flex flex-col overflow-hidden bg-muted/10">
          <div className="p-4 border-b bg-background shrink-0">
            <h2 className="font-semibold flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              {language === "ko" ? "콘텐츠 생성" : "Create Content"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {language === "ko" ? "트렌드 분석 결과를 바탕으로 AI 콘텐츠를 생성합니다" : "Generate AI content based on trend analysis"}
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Selected Trends */}
              {selectedTrends.length > 0 && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-primary">
                      {language === "ko" ? "적용된 트렌드" : "Applied Trends"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => setSelectedTrends([])}
                    >
                      {language === "ko" ? "모두 제거" : "Clear all"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTrends.map((trend) => (
                      <Badge
                        key={trend}
                        variant="default"
                        className="cursor-pointer text-xs"
                        onClick={() => handleSelectTrend(trend)}
                      >
                        #{trend}
                        <X className="h-2.5 w-2.5 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Campaign Selection */}
              <div>
                <Label className="text-xs font-medium mb-2 block">
                  {language === "ko" ? "캠페인" : "Campaign"}
                </Label>
                {campaignsLoading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : campaigns.length === 0 ? (
                  <div className="text-center py-6 border rounded-lg">
                    <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground mb-2">
                      {language === "ko" ? "캠페인이 없습니다" : "No campaigns"}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => router.push("/campaigns/new")}>
                      <Plus className="h-3 w-3 mr-1" />
                      {language === "ko" ? "만들기" : "Create"}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
                    {campaigns.map((campaign) => {
                      const isSelected = selectedCampaignId === campaign.id;
                      return (
                        <button
                          key={campaign.id}
                          onClick={() => setSelectedCampaignId(campaign.id)}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                            isSelected ? "bg-primary/10" : "bg-muted"
                          )}>
                            {campaign.cover_image_url ? (
                              <img
                                src={campaign.cover_image_url}
                                alt=""
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <FolderOpen className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {campaign.artist_stage_name || campaign.artist_name}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Idea Input */}
              <div>
                <Label className="text-xs font-medium mb-2 block">
                  {language === "ko" ? "아이디어" : "Your Idea"}
                </Label>
                <textarea
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    setTransformedPrompt(null);
                  }}
                  placeholder={language === "ko"
                    ? "영상 아이디어를 적어주세요...\n예: 밤하늘 아래 춤추는 소녀, 네온 불빛"
                    : "Describe your video idea...\nExample: A girl dancing under the night sky, neon lights"}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Transform Button */}
              <Button
                onClick={handleTransform}
                disabled={!userInput.trim() || !selectedCampaignId || isTransforming}
                className="w-full"
              >
                {isTransforming ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    {language === "ko" ? "최적화 중..." : "Optimizing..."}
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    {language === "ko" ? "AI로 프롬프트 최적화" : "Optimize with AI"}
                  </>
                )}
              </Button>

              {/* Optimized Result */}
              {transformedPrompt && (
                <div className="border border-green-500/30 rounded-lg p-4 bg-green-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      {language === "ko" ? "최적화 완료" : "Optimized"}
                    </span>
                  </div>

                  {/* Celebrity Warning */}
                  {transformedPrompt.celebrity_warning && (
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-300 dark:border-yellow-500/30 rounded mb-3">
                      <p className="text-xs text-yellow-800 dark:text-yellow-400">
                        ⚠️ {transformedPrompt.detected_celebrities?.join(", ")}
                      </p>
                    </div>
                  )}

                  {/* Prompt */}
                  <div className="p-3 bg-background rounded border mb-3">
                    <p className="text-sm leading-relaxed">{transformedPrompt.veo_prompt}</p>
                  </div>

                  {/* Applied Trends */}
                  {transformedPrompt.analysis?.trend_applied?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {transformedPrompt.analysis.trend_applied.map((trend) => (
                        <Badge key={trend} variant="secondary" className="text-xs">
                          <TrendingUp className="h-2.5 w-2.5 mr-1" />
                          {trend}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Technical Settings */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="p-2 bg-muted rounded text-center">
                      <p className="text-[10px] text-muted-foreground">{language === "ko" ? "화면비" : "Aspect"}</p>
                      <p className="text-xs font-medium">{transformedPrompt.technical_settings.aspect_ratio}</p>
                    </div>
                    <div className="p-2 bg-muted rounded text-center">
                      <p className="text-[10px] text-muted-foreground">FPS</p>
                      <p className="text-xs font-medium">{transformedPrompt.technical_settings.fps}</p>
                    </div>
                    <div className="p-2 bg-muted rounded text-center">
                      <p className="text-[10px] text-muted-foreground">{language === "ko" ? "길이" : "Duration"}</p>
                      <p className="text-xs font-medium">{transformedPrompt.technical_settings.duration_seconds}s</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button onClick={handleNavigateToGenerate} className="flex-1" size="sm">
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      {language === "ko" ? "AI 영상" : "AI Video"}
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                    <Button onClick={handleNavigateToCompose} variant="outline" className="flex-1" size="sm">
                      <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                      {language === "ko" ? "컴포즈" : "Compose"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Video Action Dialog */}
      <TrendVideoActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={selectedVideo}
      />
    </div>
  );
}
