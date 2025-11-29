"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { saveBridgePrompt } from "@/lib/bridge-storage";
import { trendsApi, TrendSnapshot, TrendPlatform, getPlatformIcon, formatViewCount } from "@/lib/trends-api";
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
import { TrendingUp, Edit3, Video, Check, Zap, FolderOpen, ChevronLeft, Lightbulb, Play, Circle, Link2, Image, Music, Film, X, ExternalLink, Sparkles, Eye, Palette, Camera, Clapperboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UrlScraper } from "@/components/features/scraper/url-scraper";
import { ScrapedData } from "@/lib/scrape-api";

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

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError("TikTok URL을 입력하세요");
      return;
    }

    // Validate TikTok URL
    const tiktokPatterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/,
      /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
    ];

    if (!tiktokPatterns.some((p) => p.test(url))) {
      setError("올바른 TikTok URL이 아닙니다");
      return;
    }

    setError("");
    setAnalyzing(true);
    setAnalysis(null);

    try {
      const result = await videoAnalysisApi.analyze(url);

      if (result.error) {
        setError(result.error.message);
        toast.error("분석 실패", result.error.message);
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
        toast.success("분석 완료", "비디오 스타일이 성공적으로 분석되었습니다");
      } else if (result.data?.error) {
        setError(result.data.error);
        toast.error("분석 실패", result.data.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "분석 중 오류 발생";
      setError(errorMsg);
      toast.error("분석 실패", errorMsg);
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
        toast.warning("프롬프트 없음", "분석에서 프롬프트를 생성하지 못했습니다");
        return;
      }
      onApplySuggestedPrompt?.(analysis.suggested_prompt, keywords);
      toast.success("프롬프트 적용됨", "분석 결과가 프롬프트에 적용되었습니다");
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
          placeholder="TikTok 영상 URL 붙여넣기..."
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
                스타일 분석
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">무드:</span>
                  <span className="text-foreground">{analysis.style_analysis.mood}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Camera className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">페이스:</span>
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
              <span className="text-muted-foreground">추천:</span>
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
                생성된 프롬프트:
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
            이 스타일로 프롬프트 생성
          </Button>
        </div>
      )}
    </div>
  );
}

// Trend Radar Panel (Left)
function TrendRadarPanel({
  trends,
  loading,
  selectedTrends,
  onSelectTrend,
  platform,
  setPlatform,
  onScrapedData,
  onOpenAssetLocker,
  onVideoAnalysis,
  onApplySuggestedPrompt,
}: {
  trends: TrendSnapshot[];
  loading: boolean;
  selectedTrends: string[];
  onSelectTrend: (keyword: string) => void;
  platform: TrendPlatform | "all";
  setPlatform: (p: TrendPlatform | "all") => void;
  onScrapedData?: (data: ScrapedData) => void;
  onOpenAssetLocker?: () => void;
  onVideoAnalysis?: (analysis: VideoAnalysisResult) => void;
  onApplySuggestedPrompt?: (prompt: string, keywords: string[]) => void;
}) {
  const platforms: Array<TrendPlatform | "all"> = ["all", "TIKTOK", "YOUTUBE", "INSTAGRAM"];
  const [showScraper, setShowScraper] = useState(false);
  const [showVideoAnalyzer, setShowVideoAnalyzer] = useState(false);

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Trend Radar
          </CardTitle>
          <span className="text-xs text-muted-foreground">실시간 트렌드</span>
        </div>

        {/* Platform Tabs */}
        <div className="flex gap-1">
          {platforms.map((p) => (
            <Button
              key={p}
              variant={platform === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPlatform(p)}
              className="text-xs"
            >
              {p === "all" ? "All" : getPlatformIcon(p)}
            </Button>
          ))}
        </div>
      </CardHeader>

      {/* Trend List */}
      <CardContent className="flex-1 overflow-y-auto">
        {loading ? (
          <ListSkeleton items={8} />
        ) : trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Lightbulb className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">No trends available</p>
            <p className="text-muted-foreground/60 text-xs mt-1">트렌드 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-1">
            {trends.map((trend, index) => {
              const isSelected = selectedTrends.includes(trend.keyword);
              return (
                <button
                  key={trend.id}
                  onClick={() => onSelectTrend(trend.keyword)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    isSelected
                      ? "bg-primary/10 border border-primary/50"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="text-lg font-bold text-muted-foreground w-6">{index + 1}</span>
                  <span className="text-lg">{getPlatformIcon(trend.platform)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{trend.keyword}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatViewCount(trend.view_count)} views
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
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
            TikTok 스타일 분석
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

      {/* URL Scraper Section */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => setShowScraper(!showScraper)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Link2 className="w-4 h-4" />
          URL에서 트렌드 가져오기
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
            Asset Locker
          </SheetTitle>
          <SheetDescription>
            {campaignName ? `${campaignName}의 에셋` : "캠페인을 선택하세요"}
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
            <p className="text-xs">전체</p>
          </button>
          <button
            onClick={() => setFilter("image")}
            className={`p-2 rounded-lg text-center transition-colors ${
              filter === "image" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            <p className="text-lg font-bold">{stats.image}</p>
            <p className="text-xs">이미지</p>
          </button>
          <button
            onClick={() => setFilter("video")}
            className={`p-2 rounded-lg text-center transition-colors ${
              filter === "video" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            <p className="text-lg font-bold">{stats.video}</p>
            <p className="text-xs">비디오</p>
          </button>
          <button
            onClick={() => setFilter("audio")}
            className={`p-2 rounded-lg text-center transition-colors ${
              filter === "audio" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            <p className="text-lg font-bold">{stats.audio}</p>
            <p className="text-xs">오디오</p>
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
              <p className="text-muted-foreground">캠페인을 선택하세요</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">에셋이 없습니다</p>
              <Link
                href={`/campaigns/${campaignId}`}
                className="text-sm text-primary hover:underline mt-2"
              >
                에셋 업로드하기 →
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
                캠페인 상세 페이지 →
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
}) {
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
            <SelectValue placeholder="캠페인 선택..." />
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
            <span className="text-xs text-primary">적용된 트렌드:</span>
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
          <Label className="mb-2 block text-muted-foreground">아이디어를 입력하세요</Label>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="예: 정국이 비 오는 거리에서 슬픈 춤을 추는 영상"
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
              변환 중...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              프롬프트 변환
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
                      유명인 이름 감지됨
                    </p>
                    <p className="text-sm text-yellow-700">
                      {transformedPrompt.detected_celebrities?.join(", ")} 이름이 감지되어 자동으로 일반적인 설명으로 대체되었습니다.
                      Google Veo는 실제 인물의 이름이나 초상을 포함한 영상을 생성할 수 없습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">최적화된 Veo 프롬프트</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {transformedPrompt.veo_prompt}
              </p>
            </div>

            {/* Analysis */}
            <div className="p-4 bg-muted rounded-lg border border-border">
              <h4 className="text-sm font-medium text-foreground mb-2">분석</h4>
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
                <p className="text-xs text-muted-foreground">비율</p>
                <p className="text-sm font-medium text-foreground">{transformedPrompt.technical_settings.aspect_ratio}</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">FPS</p>
                <p className="text-sm font-medium text-foreground">{transformedPrompt.technical_settings.fps}</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">길이</p>
                <p className="text-sm font-medium text-foreground">{transformedPrompt.technical_settings.duration_seconds}s</p>
              </div>
            </div>

            {/* Generate Button */}
            <Button onClick={onNavigateToGenerate} className="w-full">
              영상 생성하기 →
            </Button>
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
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "pending" },
      processing: { variant: "secondary", label: "processing" },
      completed: { variant: "default", label: "completed" },
      failed: { variant: "destructive", label: "failed" },
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
            Recent Videos
          </CardTitle>
          <span className="text-xs text-muted-foreground">{generations.length} videos</span>
        </div>
      </CardHeader>

      {/* Video Grid */}
      <CardContent className="flex-1 overflow-y-auto">
        {loading ? (
          <VideoGridSkeleton items={4} />
        ) : generations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Video className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No videos yet</p>
            <p className="text-muted-foreground/60 text-sm mt-1">생성된 영상이 없습니다</p>
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
            모든 영상 보기 →
          </Link>
        </div>
      )}
    </Card>
  );
}

// Main Bridge Page
export default function BridgePage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const router = useRouter();

  // State
  const [trends, setTrends] = useState<TrendSnapshot[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [loading, setLoading] = useState({ trends: true, campaigns: true, generations: true });

  const [platform, setPlatform] = useState<TrendPlatform | "all">("all");
  const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [userInput, setUserInput] = useState("");
  const [transformedPrompt, setTransformedPrompt] = useState<PromptTransformResponse | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [assetLockerOpen, setAssetLockerOpen] = useState(false);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysisResult | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      // Load trends
      try {
        const trendsResult = await trendsApi.getAll({
          platform: platform === "all" ? undefined : platform,
          limit: 15,
        });
        if (trendsResult.data) {
          const trendsArray = Array.isArray(trendsResult.data.trends)
            ? trendsResult.data.trends
            : Object.values(trendsResult.data.trends).flat();
          setTrends(trendsArray);
        }
      } catch (error) {
        console.error("Failed to load trends:", error);
      } finally {
        setLoading((prev) => ({ ...prev, trends: false }));
      }

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
  }, [platform]);

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
        toast.warning("최대 3개까지", "트렌드 키워드는 최대 3개까지 선택 가능합니다");
        return prev;
      }
      return [...prev, keyword];
    });
  }, [toast]);

  // Handle scraped data from URL
  const handleScrapedData = useCallback((data: ScrapedData) => {
    // Auto-add hashtags from scraped content (up to 3)
    if (data.hashtags.length > 0) {
      const newTags = data.hashtags.slice(0, 3);
      setSelectedTrends(newTags);
      toast.success("해시태그 추출 완료", `${newTags.length}개의 해시태그를 가져왔습니다`);
    }

    // If title exists, suggest it as prompt input
    if (data.title) {
      setUserInput(data.title);
    }
  }, [toast]);

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
          toast.error("안전 검사 실패", result.data.blocked_reason || "프롬프트가 차단되었습니다");
        } else {
          setTransformedPrompt(result.data);
          toast.success("변환 완료", "프롬프트가 성공적으로 최적화되었습니다");
        }
      }
    } catch (error) {
      console.error("Transform error:", error);
      toast.error("오류 발생", "프롬프트 변환 중 오류가 발생했습니다");
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

    toast.success("프롬프트 전달됨", "Generate 페이지로 이동합니다");

    // Navigate to generate page
    router.push(`/campaigns/${selectedCampaignId}/generate`);
  }, [selectedCampaignId, transformedPrompt, userInput, selectedTrends, router, toast]);

  return (
    <div className="h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">The Bridge</h1>
        <p className="text-muted-foreground">
          Welcome, {user?.name}. Transform your ideas into viral videos.
        </p>
      </div>

      {/* 3-Panel Layout */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100%-5rem)]">
        {/* Left Panel - Trend Radar */}
        <div className="col-span-3">
          <TrendRadarPanel
            trends={trends}
            loading={loading.trends}
            selectedTrends={selectedTrends}
            onSelectTrend={handleSelectTrend}
            platform={platform}
            setPlatform={setPlatform}
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
