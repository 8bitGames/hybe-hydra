"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { saveBridgePrompt } from "@/lib/bridge-storage";
import { useI18n } from "@/lib/i18n";
import { TrendPlatform, getPlatformIcon, formatViewCount } from "@/lib/trends-api";
import { api } from "@/lib/api";
import { videoApi, promptApi, videoAnalysisApi, VideoGeneration, PromptTransformResponse, VideoAnalysisResult } from "@/lib/video-api";
import { campaignsApi, assetsApi, Campaign, Asset } from "@/lib/campaigns-api";
import { Skeleton, ListSkeleton, VideoGridSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Edit3, Video, Check, Zap, FolderOpen, ChevronLeft, Lightbulb, Play, Circle, Link2, Image, Music, Film, X, ExternalLink, Sparkles, Eye, Palette, Camera, Clapperboard, Database, Hash, RefreshCw, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UrlScraper } from "@/components/features/scraper/url-scraper";
import { ScrapedData } from "@/lib/scrape-api";
import { TrendRecommendationsCard } from "@/components/features/trend-analysis";

// Saved Trend Video interface
interface SavedTrendVideo {
  id: string;
  platform: TrendPlatform;
  videoId: string;
  searchQuery: string;
  searchType: string;
  description: string | null;
  authorId: string;
  authorName: string;
  playCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  hashtags: string[];
  videoUrl: string;
  collectedAt: string;
}

interface TrendGroup {
  query: string;
  type: string;
  videos: SavedTrendVideo[];
  totalPlayCount: number;
}

// TikTok Video Analyzer Component
function TikTokVideoAnalyzer({
  onAnalysisComplete,
  onApplySuggestedPrompt,
}: {
  onAnalysisComplete?: (analysis: VideoAnalysisResult) => void;
  onApplySuggestedPrompt?: (prompt: string, keywords: string[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const toast = useToast();
  const { t } = useI18n();

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError(t.bridge.enterTiktokUrl);
      return;
    }

    // Validate TikTok URL
    const tiktokPatterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/,
      /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
    ];

    if (!tiktokPatterns.some((p) => p.test(url))) {
      setError(t.bridge.invalidTiktokUrl);
      return;
    }

    setError("");
    setAnalyzing(true);
    setAnalysis(null);

    try {
      const result = await videoAnalysisApi.analyze(url);

      if (result.error) {
        setError(result.error.message);
        toast.error(t.bridge.analysisFailed, result.error.message);
        return;
      }

      // API returns { success, data, error } - we need result.data.data for the actual analysis
      if (result.data?.success && result.data.data) {
        const analysisData = result.data.data;
        console.log("[BRIDGE] Analysis data:", {
          hasMetadata: !!analysisData.metadata,
          hasSuggestedPrompt: !!analysisData.suggested_prompt,
          suggestedPromptPreview: analysisData.suggested_prompt?.slice(0, 100),
          promptElementsKeys: analysisData.prompt_elements ? Object.keys(analysisData.prompt_elements) : [],
        });
        setAnalysis(analysisData);
        onAnalysisComplete?.(analysisData);
        toast.success(t.bridge.analysisComplete, t.bridge.videoStyleAnalyzed);
      } else if (result.data?.error) {
        setError(result.data.error);
        toast.error(t.bridge.analysisFailed, result.data.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t.bridge.errorOccurred;
      setError(errorMsg);
      toast.error(t.bridge.analysisFailed, errorMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyPrompt = () => {
    if (analysis) {
      const keywords = [
        ...(analysis.prompt_elements?.style_keywords || []).slice(0, 2),
        ...(analysis.prompt_elements?.mood_keywords || []).slice(0, 1),
      ];
      console.log("[BRIDGE] Applying prompt:", {
        suggestedPrompt: analysis.suggested_prompt,
        keywords,
      });
      if (!analysis.suggested_prompt) {
        toast.warning(t.bridge.noPromptGenerated, t.bridge.errorOccurred);
        return;
      }
      onApplySuggestedPrompt?.(analysis.suggested_prompt, keywords);
      toast.success(t.bridge.promptApplied, t.bridge.analysisApplied);
    }
  };

  return (
    <div className="space-y-3">
      {/* URL Input */}
      <div className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t.bridge.tiktokUrlPlaceholder}
          className="flex-1 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
        />
        <Button
          onClick={handleAnalyze}
          disabled={analyzing || !url.trim()}
          size="sm"
          className="shrink-0"
        >
          {analyzing ? (
            <Spinner className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Analysis Result */}
      {analysis && (
        <div className="space-y-3 p-3 bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/30 rounded-lg">
          {/* Video Info */}
          {analysis.metadata && (
            <div className="flex items-start gap-3">
              {analysis.metadata.thumbnail_url && (
                <div className="w-16 h-24 rounded overflow-hidden bg-muted shrink-0">
                  <img
                    src={analysis.metadata.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {analysis.metadata.description || "No description"}
                </p>
                {analysis.metadata.hashtags && analysis.metadata.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {analysis.metadata.hashtags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 bg-pink-500/20 text-pink-400 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.metadata.stats && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>❤️ {(analysis.metadata.stats.likes / 1000).toFixed(1)}K</span>
                    <span>💬 {(analysis.metadata.stats.comments / 1000).toFixed(1)}K</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Style Analysis */}
          {analysis.style_analysis && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Sparkles className="w-3 h-3 text-pink-500" />
                {t.bridge.styleAnalysis}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{t.bridge.mood}:</span>
                  <span className="text-foreground">{analysis.style_analysis.mood}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Camera className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{t.bridge.pace}:</span>
                  <span className="text-foreground">{analysis.style_analysis.pace}</span>
                </div>
              </div>
              {analysis.prompt_elements?.style_keywords && analysis.prompt_elements.style_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {analysis.prompt_elements.style_keywords.slice(0, 4).map((kw) => (
                    <span key={kw} className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Technical Suggestions */}
          {analysis.prompt_elements?.technical_suggestions && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">{t.bridge.recommendation}:</span>
              <Badge variant="outline" className="text-xs">
                {analysis.prompt_elements.technical_suggestions.aspect_ratio}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {analysis.prompt_elements.technical_suggestions.duration}s
              </Badge>
              <Badge variant="outline" className="text-xs">
                {analysis.prompt_elements.technical_suggestions.camera_style}
              </Badge>
            </div>
          )}

          {/* Suggested Prompt Preview */}
          {analysis.suggested_prompt && (
            <div className="p-2 bg-background/50 rounded border border-border">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                <Clapperboard className="w-3 h-3" />
                {t.bridge.generatedPrompt}:
              </div>
              <p className="text-xs text-foreground line-clamp-3">
                {analysis.suggested_prompt}
              </p>
            </div>
          )}

          {/* Apply Button */}
          <Button
            onClick={handleApplyPrompt}
            size="sm"
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            <Clapperboard className="w-4 h-4 mr-2" />
            {t.bridge.generateWithStyle}
          </Button>
        </div>
      )}
    </div>
  );
}

// Saved Trends Panel (Left) - Loads from database
function SavedTrendsPanel({
  trendGroups,
  loading,
  selectedTrends,
  onSelectTrend,
  onRefresh,
  onScrapedData,
  onOpenAssetLocker,
  onVideoAnalysis,
  onApplySuggestedPrompt,
  onSelectVideo,
}: {
  trendGroups: TrendGroup[];
  loading: boolean;
  selectedTrends: string[];
  onSelectTrend: (keyword: string) => void;
  onRefresh: () => void;
  onScrapedData?: (data: ScrapedData) => void;
  onOpenAssetLocker?: () => void;
  onVideoAnalysis?: (analysis: VideoAnalysisResult) => void;
  onApplySuggestedPrompt?: (prompt: string, keywords: string[]) => void;
  onSelectVideo?: (video: SavedTrendVideo) => void;
}) {
  const [showScraper, setShowScraper] = useState(false);
  const [showVideoAnalyzer, setShowVideoAnalyzer] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const { t } = useI18n();

  const formatNumber = (num: number | null): string => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Saved Trends
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {trendGroups.length} searches • {trendGroups.reduce((acc, g) => acc + g.videos.length, 0)} videos saved
        </p>
      </CardHeader>

      {/* Trend Groups List */}
      <CardContent className="flex-1 overflow-y-auto">
        {loading ? (
          <ListSkeleton items={6} />
        ) : trendGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Database className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm mb-2">No saved trends yet</p>
            <Link href="/trends" className="text-sm text-primary hover:underline">
              Go to Trends page to search and save →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {trendGroups.map((group) => {
              const isExpanded = expandedGroup === group.query;
              const isSelected = selectedTrends.includes(group.query);

              return (
                <div key={group.query} className="border border-border rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setExpandedGroup(isExpanded ? null : group.query);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setExpandedGroup(isExpanded ? null : group.query);
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 transition-colors text-left cursor-pointer ${
                      isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <Hash className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-medium truncate">
                        {group.query}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{group.videos.length} videos</span>
                        <span>•</span>
                        <span>{formatNumber(group.totalPlayCount)} total views</span>
                      </div>
                    </div>
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrend(group.query);
                      }}
                      className="shrink-0"
                    >
                      {isSelected ? <Check className="w-4 h-4" /> : "Use"}
                    </Button>
                  </div>

                  {/* Expanded Videos */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 max-h-[300px] overflow-y-auto">
                      {group.videos.slice(0, 10).map((video) => (
                        <a
                          key={video.id}
                          href={video.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 p-2 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                          onClick={(e) => {
                            if (onSelectVideo) {
                              e.preventDefault();
                              onSelectVideo(video);
                            }
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground line-clamp-2">
                              {video.description || "(No description)"}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>@{video.authorId}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Play className="w-3 h-3" />
                                {formatNumber(video.playCount)}
                              </span>
                            </div>
                            {video.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {video.hashtags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs px-1 py-0.5 bg-primary/10 text-primary rounded cursor-pointer hover:bg-primary/20"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onSelectTrend(tag);
                                    }}
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
                        </a>
                      ))}
                      {group.videos.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          +{group.videos.length - 10} more videos
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* TikTok Video Analyzer Section */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => setShowVideoAnalyzer(!showVideoAnalyzer)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Video className="w-4 h-4 text-pink-500" />
          <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-transparent bg-clip-text font-semibold">
            {t.bridge.tiktokStyleAnalysis}
          </span>
          <span className={`ml-auto transition-transform ${showVideoAnalyzer ? "rotate-180" : ""}`}>▼</span>
        </button>
        {showVideoAnalyzer && (
          <div className="mt-3">
            <TikTokVideoAnalyzer
              onAnalysisComplete={onVideoAnalysis}
              onApplySuggestedPrompt={onApplySuggestedPrompt}
            />
          </div>
        )}
      </div>

      {/* AI Trend Recommendations Section */}
      <div className="p-4 border-t border-border">
        <TrendRecommendationsCard
          compact
          onApplyPrompt={onApplySuggestedPrompt ? (prompt) => onApplySuggestedPrompt(prompt, []) : undefined}
          onApplyHashtags={(hashtags) => hashtags.forEach(onSelectTrend)}
        />
      </div>

      {/* URL Scraper Section */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => setShowScraper(!showScraper)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Link2 className="w-4 h-4" />
          {t.bridge.fetchFromUrl}
          <span className={`ml-auto transition-transform ${showScraper ? "rotate-180" : ""}`}>▼</span>
        </button>
        {showScraper && (
          <div className="mt-3">
            <UrlScraper
              compact
              onDataScraped={onScrapedData}
              onHashtagSelect={onSelectTrend}
              selectedHashtags={selectedTrends}
            />
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="p-4 border-t border-border space-y-2">
        <Link
          href="/trends"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <TrendingUp className="w-4 h-4" />
          Search New Trends
        </Link>
        <button
          onClick={onOpenAssetLocker}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <FolderOpen className="w-4 h-4" />
          Asset Locker
        </button>
      </div>
    </Card>
  );
}

// Asset Locker Sheet Panel
function AssetLockerSheet({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "image" | "video" | "audio">("all");
  const { t, translate } = useI18n();

  useEffect(() => {
    if (open && campaignId) {
      setLoading(true);
      assetsApi.getByCampaign(campaignId, { page_size: 50 })
        .then((result) => {
          if (result.data) {
            setAssets(result.data.items);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, campaignId]);

  const filteredAssets = filter === "all"
    ? assets
    : assets.filter((a) => a.type === filter);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="w-4 h-4" />;
      case "video": return <Film className="w-4 h-4" />;
      case "audio": return <Music className="w-4 h-4" />;
      default: return <FolderOpen className="w-4 h-4" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const stats = {
    total: assets.length,
    image: assets.filter((a) => a.type === "image").length,
    video: assets.filter((a) => a.type === "video").length,
    audio: assets.filter((a) => a.type === "audio").length,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            {t.bridge.assetLocker}
          </SheetTitle>
          <SheetDescription>
            {campaignName ? translate("bridge.campaignAssets", { name: campaignName }) : t.bridge.selectCampaignFirst}
          </SheetDescription>
        </SheetHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 py-4">
          <button
            onClick={() => setFilter("all")}
            className={`p-2 rounded-lg text-center transition-colors ${
              filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-xs">{t.common.all}</p>
          </button>
          <button
            onClick={() => setFilter("image")}
            className={`p-2 rounded-lg text-center transition-colors ${
              filter === "image" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            <p className="text-lg font-bold">{stats.image}</p>
            <p className="text-xs">{t.common.image}</p>
          </button>
          <button
            onClick={() => setFilter("video")}
            className={`p-2 rounded-lg text-center transition-colors ${
              filter === "video" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            <p className="text-lg font-bold">{stats.video}</p>
            <p className="text-xs">{t.common.video}</p>
          </button>
          <button
            onClick={() => setFilter("audio")}
            className={`p-2 rounded-lg text-center transition-colors ${
              filter === "audio" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            <p className="text-lg font-bold">{stats.audio}</p>
            <p className="text-xs">{t.common.audio}</p>
          </button>
        </div>

        {/* Asset List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : !campaignId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t.bridge.selectCampaignFirst}</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t.bridge.noAssets}</p>
              <Link
                href={`/campaigns/${campaignId}`}
                className="text-sm text-primary hover:underline mt-2"
              >
                {t.bridge.uploadAssets} →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded bg-muted-foreground/10 flex items-center justify-center overflow-hidden">
                    {asset.type === "image" && asset.s3_url ? (
                      <img src={asset.s3_url} alt="" className="w-full h-full object-cover" />
                    ) : asset.type === "video" && asset.thumbnail_url ? (
                      <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      getTypeIcon(asset.type)
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.original_filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(asset.file_size)} • {asset.type}
                    </p>
                  </div>

                  {/* Actions */}
                  <a
                    href={asset.s3_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-background rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {campaignId && (
          <div className="pt-4 border-t">
            <Button asChild variant="outline" className="w-full">
              <Link href={`/campaigns/${campaignId}`}>
                {t.bridge.campaignDetailPage} →
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Prompt Interface Panel (Center)
function PromptInterfacePanel({
  campaigns,
  selectedCampaignId,
  setSelectedCampaignId,
  userInput,
  setUserInput,
  transformedPrompt,
  isTransforming,
  onTransform,
  selectedTrends,
  onNavigateToGenerate,
  onNavigateToCompose,
}: {
  campaigns: Campaign[];
  selectedCampaignId: string;
  setSelectedCampaignId: (id: string) => void;
  userInput: string;
  setUserInput: (v: string) => void;
  transformedPrompt: PromptTransformResponse | null;
  isTransforming: boolean;
  onTransform: () => void;
  selectedTrends: string[];
  onNavigateToGenerate: () => void;
  onNavigateToCompose: () => void;
}) {
  const { t, translate } = useI18n();

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-primary" />
            Prompt Alchemist
          </CardTitle>
        </div>

        {/* Campaign Selector */}
        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger>
            <SelectValue placeholder={t.bridge.selectCampaign} />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name} - {campaign.artist_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      {/* Chat-like Input Area */}
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Selected Trends */}
        {selectedTrends.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-lg border border-primary/30">
            <span className="text-xs text-primary">{t.bridge.appliedTrends}:</span>
            {selectedTrends.map((trend) => (
              <Badge
                key={trend}
                variant="secondary"
                className="bg-primary/10 text-primary"
              >
                #{trend}
              </Badge>
            ))}
          </div>
        )}

        {/* User Input */}
        <div>
          <Label className="mb-2 block text-muted-foreground">{t.bridge.enterIdea}</Label>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={t.bridge.ideaPlaceholder}
            rows={4}
            className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {/* Transform Button */}
        <Button
          onClick={onTransform}
          disabled={!userInput.trim() || !selectedCampaignId || isTransforming}
          className="w-full"
        >
          {isTransforming ? (
            <>
              <Spinner className="w-5 h-5 mr-2" />
              {t.bridge.transforming}
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              {t.bridge.transform}
            </>
          )}
        </Button>

        {/* Transformed Prompt Preview */}
        {transformedPrompt && (
          <div className="space-y-4">
            {/* Celebrity Warning */}
            {transformedPrompt.celebrity_warning && (
              <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      {t.bridge.celebrityDetected}
                    </p>
                    <p className="text-sm text-yellow-700">
                      {translate("bridge.celebrityWarningMessage", { names: transformedPrompt.detected_celebrities?.join(", ") || "" })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">{t.bridge.optimizedPrompt}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {transformedPrompt.veo_prompt}
              </p>
            </div>

            {/* Analysis */}
            <div className="p-4 bg-muted rounded-lg border border-border">
              <h4 className="text-sm font-medium text-foreground mb-2">{t.bridge.analysis}</h4>
              <p className="text-sm text-muted-foreground mb-2">{transformedPrompt.analysis.intent}</p>
              <div className="flex flex-wrap gap-2">
                {transformedPrompt.analysis.trend_applied.map((trend) => (
                  <Badge key={trend} variant="secondary">
                    {trend}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Technical Settings */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">{t.bridge.aspectRatioLabel}</p>
                <p className="text-sm font-medium text-foreground">{transformedPrompt.technical_settings.aspect_ratio}</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">{t.bridge.fpsLabel}</p>
                <p className="text-sm font-medium text-foreground">{transformedPrompt.technical_settings.fps}</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">{t.bridge.durationLabel}</p>
                <p className="text-sm font-medium text-foreground">{transformedPrompt.technical_settings.duration_seconds}s</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={onNavigateToGenerate} className="flex-1">
                <Sparkles className="w-4 h-4 mr-2" />
                {t.bridge.generateVideo}
              </Button>
              <Button onClick={onNavigateToCompose} variant="outline" className="flex-1">
                <Wand2 className="w-4 h-4 mr-2" />
                Compose
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Variants Panel (Right)
function VariantsPanel({
  generations,
  loading,
}: {
  generations: VideoGeneration[];
  loading: boolean;
}) {
  const { t } = useI18n();

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: t.generation.status.pending },
      processing: { variant: "secondary", label: t.generation.status.processing },
      completed: { variant: "default", label: t.generation.status.completed },
      failed: { variant: "destructive", label: t.generation.status.failed },
    };
    return statusMap[status] || { variant: "outline", label: status };
  };

  const getGradeColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 90) return "text-primary";
    if (score >= 80) return "text-green-600";
    if (score >= 70) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            {t.bridge.recentVideos}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{generations.length} {t.common.video}</span>
        </div>
      </CardHeader>

      {/* Video Grid */}
      <CardContent className="flex-1 overflow-y-auto">
        {loading ? (
          <VideoGridSkeleton items={4} />
        ) : generations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Video className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.bridge.noVideos}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {generations.slice(0, 6).map((gen) => {
              const statusBadge = getStatusBadge(gen.status);
              return (
                <Link
                  key={gen.id}
                  href={`/campaigns/${gen.campaign_id}/curation`}
                  className="block bg-muted rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors group"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[9/16] relative bg-muted-foreground/10">
                    {gen.output_url ? (
                      <video
                        src={gen.output_url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                        onMouseLeave={(e) => {
                          const video = e.target as HTMLVideoElement;
                          video.pause();
                          video.currentTime = 0;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}

                    {/* Status Badge */}
                    <Badge
                      variant={statusBadge.variant}
                      className="absolute top-2 left-2 text-xs"
                    >
                      {statusBadge.label}
                    </Badge>

                    {/* Score Badge */}
                    {gen.quality_score && (
                      <span className={`absolute top-2 right-2 font-bold text-sm ${getGradeColor(gen.quality_score)}`}>
                        {Math.round(gen.quality_score)}
                      </span>
                    )}

                    {/* Progress Bar */}
                    {gen.status === "processing" && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-foreground/20">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${gen.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground truncate">{gen.prompt.slice(0, 50)}...</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Quick Actions */}
      {generations.length > 0 && (
        <div className="p-4 border-t border-border">
          <Link
            href="/campaigns"
            className="flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            {t.bridge.viewAllVideos} →
          </Link>
        </div>
      )}
    </Card>
  );
}

// Main Bridge Page
export default function BridgePage() {
  const { user, accessToken } = useAuthStore();
  const toast = useToast();
  const router = useRouter();
  const { t, translate } = useI18n();

  // State
  const [trendGroups, setTrendGroups] = useState<TrendGroup[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [loading, setLoading] = useState({ trends: true, campaigns: true, generations: true });

  const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [userInput, setUserInput] = useState("");
  const [transformedPrompt, setTransformedPrompt] = useState<PromptTransformResponse | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [assetLockerOpen, setAssetLockerOpen] = useState(false);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysisResult | null>(null);

  // Load saved trend videos from database
  const loadSavedTrends = useCallback(async () => {
    if (!accessToken) return;

    setLoading((prev) => ({ ...prev, trends: true }));
    try {
      api.setAccessToken(accessToken);
      const response = await api.get<{
        success: boolean;
        videos: SavedTrendVideo[];
        total: number;
      }>("/api/v1/trends/videos?limit=100");

      if (response.data?.videos) {
        // Group videos by searchQuery
        const groupMap = new Map<string, SavedTrendVideo[]>();
        response.data.videos.forEach((video) => {
          const existing = groupMap.get(video.searchQuery) || [];
          existing.push(video);
          groupMap.set(video.searchQuery, existing);
        });

        // Convert to TrendGroup array and sort by total play count
        const groups: TrendGroup[] = Array.from(groupMap.entries()).map(([query, videos]) => ({
          query,
          type: videos[0]?.searchType || "keyword",
          videos: videos.sort((a, b) => (b.playCount || 0) - (a.playCount || 0)),
          totalPlayCount: videos.reduce((sum, v) => sum + (v.playCount || 0), 0),
        }));

        // Sort groups by total play count
        groups.sort((a, b) => b.totalPlayCount - a.totalPlayCount);
        setTrendGroups(groups);
      }
    } catch (error) {
      console.error("Failed to load saved trends:", error);
    } finally {
      setLoading((prev) => ({ ...prev, trends: false }));
    }
  }, [accessToken]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      // Load saved trends from database
      await loadSavedTrends();

      // Load campaigns
      try {
        const campaignsResult = await campaignsApi.getAll({ page_size: 20, status: "active" });
        if (campaignsResult.data) {
          setCampaigns(campaignsResult.data.items);
          if (campaignsResult.data.items.length > 0 && !selectedCampaignId) {
            setSelectedCampaignId(campaignsResult.data.items[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to load campaigns:", error);
      } finally {
        setLoading((prev) => ({ ...prev, campaigns: false }));
      }
    };

    loadData();
  }, [loadSavedTrends]);

  // Load generations when campaign changes
  useEffect(() => {
    const loadGenerations = async () => {
      if (!selectedCampaignId) {
        setGenerations([]);
        setLoading((prev) => ({ ...prev, generations: false }));
        return;
      }

      try {
        const result = await videoApi.getAll(selectedCampaignId, { page_size: 6 });
        if (result.data) {
          setGenerations(result.data.items);
        }
      } catch (error) {
        console.error("Failed to load generations:", error);
      } finally {
        setLoading((prev) => ({ ...prev, generations: false }));
      }
    };

    loadGenerations();
  }, [selectedCampaignId]);

  // Handle trend selection
  const handleSelectTrend = useCallback((keyword: string) => {
    setSelectedTrends((prev) => {
      if (prev.includes(keyword)) {
        return prev.filter((t) => t !== keyword);
      }
      if (prev.length >= 3) {
        toast.warning(t.bridge.maxTrends, t.bridge.maxTrendsMessage);
        return prev;
      }
      return [...prev, keyword];
    });
  }, [toast, t]);

  // Handle scraped data from URL
  const handleScrapedData = useCallback((data: ScrapedData) => {
    // Auto-add hashtags from scraped content (up to 3)
    if (data.hashtags.length > 0) {
      const newTags = data.hashtags.slice(0, 3);
      setSelectedTrends(newTags);
      toast.success(t.bridge.hashtagsExtracted, translate("bridge.hashtagsExtractedMessage", { count: newTags.length }));
    }

    // If title exists, suggest it as prompt input
    if (data.title) {
      setUserInput(data.title);
    }
  }, [toast, t, translate]);

  // Handle video analysis complete
  const handleVideoAnalysis = useCallback((analysis: VideoAnalysisResult) => {
    setVideoAnalysis(analysis);
    // Auto-add hashtags from video
    if (analysis.metadata?.hashtags && analysis.metadata.hashtags.length > 0) {
      const newTags = analysis.metadata.hashtags.slice(0, 3);
      setSelectedTrends(newTags);
    }
  }, []);

  // Handle applying suggested prompt from video analysis
  const handleApplySuggestedPrompt = useCallback((suggestedPrompt: string, keywords: string[]) => {
    setUserInput(suggestedPrompt);
    // Add style keywords to selected trends
    if (keywords.length > 0) {
      setSelectedTrends((prev) => {
        const combined = [...new Set([...prev, ...keywords])];
        return combined.slice(0, 3);
      });
    }
    setTransformedPrompt(null);
  }, []);

  // Handle prompt transform
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
          toast.error(t.bridge.safetyFailed, result.data.blocked_reason || t.bridge.safetyFailed);
        } else {
          setTransformedPrompt(result.data);
          toast.success(t.bridge.transformSuccess, t.bridge.transformSuccessMessage);
        }
      }
    } catch (error) {
      console.error("Transform error:", error);
      toast.error(t.bridge.errorOccurred, t.bridge.errorOccurred);
    } finally {
      setIsTransforming(false);
    }
  };

  // Navigate to generate page with saved prompt data
  const handleNavigateToGenerate = useCallback(() => {
    if (!selectedCampaignId || !transformedPrompt) return;

    // Save prompt data to session storage
    saveBridgePrompt({
      campaignId: selectedCampaignId,
      originalPrompt: userInput,
      transformedPrompt: transformedPrompt,
      selectedTrends: selectedTrends,
      timestamp: Date.now(),
    });

    toast.success(t.bridge.promptTransferred, t.bridge.navigateToGenerate);

    // Navigate to generate page
    router.push(`/campaigns/${selectedCampaignId}/generate`);
  }, [selectedCampaignId, transformedPrompt, userInput, selectedTrends, router, toast, t]);

  // Navigate to compose page with saved prompt data
  const handleNavigateToCompose = useCallback(() => {
    if (!selectedCampaignId || !transformedPrompt) return;

    // Save prompt data to session storage
    saveBridgePrompt({
      campaignId: selectedCampaignId,
      originalPrompt: userInput,
      transformedPrompt: transformedPrompt,
      selectedTrends: selectedTrends,
      timestamp: Date.now(),
    });

    toast.success(t.bridge.promptTransferred, "Compose 페이지로 이동합니다");

    // Navigate to compose page
    router.push(`/campaigns/${selectedCampaignId}/compose`);
  }, [selectedCampaignId, transformedPrompt, userInput, selectedTrends, router, toast, t]);

  return (
    <div className="h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">{t.bridge.title}</h1>
        <p className="text-muted-foreground">
          {t.bridge.subtitle}
        </p>
      </div>

      {/* 3-Panel Layout */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100%-5rem)]">
        {/* Left Panel - Saved Trends */}
        <div className="col-span-3">
          <SavedTrendsPanel
            trendGroups={trendGroups}
            loading={loading.trends}
            selectedTrends={selectedTrends}
            onSelectTrend={handleSelectTrend}
            onRefresh={loadSavedTrends}
            onScrapedData={handleScrapedData}
            onOpenAssetLocker={() => setAssetLockerOpen(true)}
            onVideoAnalysis={handleVideoAnalysis}
            onApplySuggestedPrompt={handleApplySuggestedPrompt}
          />
        </div>

        {/* Center Panel - Prompt Interface */}
        <div className="col-span-5">
          <PromptInterfacePanel
            campaigns={campaigns}
            selectedCampaignId={selectedCampaignId}
            setSelectedCampaignId={setSelectedCampaignId}
            userInput={userInput}
            setUserInput={setUserInput}
            transformedPrompt={transformedPrompt}
            isTransforming={isTransforming}
            onTransform={handleTransform}
            selectedTrends={selectedTrends}
            onNavigateToGenerate={handleNavigateToGenerate}
            onNavigateToCompose={handleNavigateToCompose}
          />
        </div>

        {/* Right Panel - Recent Videos */}
        <div className="col-span-4">
          <VariantsPanel
            generations={generations}
            loading={loading.generations}
          />
        </div>
      </div>

      {/* Asset Locker Sheet */}
      <AssetLockerSheet
        open={assetLockerOpen}
        onOpenChange={setAssetLockerOpen}
        campaignId={selectedCampaignId}
        campaignName={campaigns.find((c) => c.id === selectedCampaignId)?.name || ""}
      />
    </div>
  );
}
