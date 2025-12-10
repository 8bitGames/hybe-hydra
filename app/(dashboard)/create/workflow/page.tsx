"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore, type PreviewImageData as StorePreviewImageData } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { useCampaigns, useAssets } from "@/lib/queries";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { StashedPromptsPanel } from "@/components/features/stashed-prompts-panel";
import { ImagePromptGenerator } from "@/components/features/create/ImagePromptGenerator";
import { videoApi, previewImageApi } from "@/lib/video-api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowHeader, WorkflowFooter } from "@/components/workflow/WorkflowHeader";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ArrowLeft,
  Video,
  Images,
  Music,
  Upload,
  Plus,
  X,
  Hash,
  Lightbulb,
  Play,
  ExternalLink,
  FolderOpen,
  Check,
  Library,
  AlertCircle,
  RefreshCw,
  ImagePlus,
  ZoomIn,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoButton } from "@/components/ui/info-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useSessionWorkflowSync } from "@/lib/stores/session-workflow-sync";

// ============================================================================
// Helper Functions
// ============================================================================

function formatCount(num: number | null | undefined): string {
  if (num === null || num === undefined || num === 0) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

// ============================================================================
// Context Panel - Left Column
// ============================================================================

function ContextPanel() {
  const { language } = useI18n();
  const { goToAnalyze, goToStart } = useWorkflowNavigation();

  const { discover, analyze } = useWorkflowStore(
    useShallow((state) => ({
      discover: state.discover,
      analyze: state.analyze,
    }))
  );

  const {
    keywords,
    selectedHashtags,
    savedInspiration,
    performanceMetrics,
    aiInsights,
  } = discover;

  const { selectedIdea, campaignName, campaignId, optimizedPrompt, hashtags: analyzeHashtags } = analyze;

  // Combine hashtags from discover and analyze
  const allHashtags = useMemo(() => {
    const combined = new Set([...selectedHashtags, ...analyzeHashtags]);
    return Array.from(combined).slice(0, 8);
  }, [selectedHashtags, analyzeHashtags]);

  const hasContext = selectedIdea || keywords.length > 0 || savedInspiration.length > 0;

  if (!hasContext) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <Lightbulb className="h-8 w-8 text-neutral-400" />
        </div>
        <h3 className="text-lg font-medium text-neutral-900 mb-2">
          {language === "ko" ? "아이디어가 없습니다" : "No idea selected"}
        </h3>
        <p className="text-sm text-neutral-500 mb-4 max-w-xs">
          {language === "ko"
            ? "분석 단계에서 아이디어를 선택하거나 시작 단계에서 트렌드를 수집하세요"
            : "Select an idea from Analyze or collect trends from Start"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToStart}
            className="border-neutral-300"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {language === "ko" ? "시작으로" : "Start"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToAnalyze}
            className="border-neutral-300"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {language === "ko" ? "분석으로" : "Analyze"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Selected Idea */}
        {selectedIdea && (
          <div className="border border-neutral-200 rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                {language === "ko" ? "선택된 아이디어" : "Selected Idea"}
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] border-neutral-900 text-neutral-900"
              >
                AI Video
              </Badge>
            </div>

            <h4 className="text-base font-medium text-neutral-900 mb-2">
              {selectedIdea.title}
            </h4>

            {selectedIdea.hook && (
              <p className="text-xs text-neutral-600 mb-2 italic">
                &quot;{selectedIdea.hook}&quot;
              </p>
            )}

            <p className="text-sm text-neutral-500 line-clamp-3 mb-3">
              {selectedIdea.description}
            </p>

            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px]",
                  selectedIdea.estimatedEngagement === "high" && "bg-neutral-900 text-white",
                  selectedIdea.estimatedEngagement === "medium" && "bg-neutral-200 text-neutral-700",
                  selectedIdea.estimatedEngagement === "low" && "bg-neutral-100 text-neutral-500"
                )}
              >
                {language === "ko" ? "예상 참여도:" : "Est:"}{" "}
                {selectedIdea.estimatedEngagement === "high"
                  ? language === "ko" ? "높음" : "High"
                  : selectedIdea.estimatedEngagement === "medium"
                  ? language === "ko" ? "보통" : "Medium"
                  : language === "ko" ? "낮음" : "Low"}
              </Badge>
              {selectedIdea.suggestedMusic && (
                <Badge variant="outline" className="text-[10px] border-neutral-200">
                  <Music className="h-2.5 w-2.5 mr-1" />
                  {selectedIdea.suggestedMusic.bpm} BPM · {selectedIdea.suggestedMusic.genre}
                </Badge>
              )}
            </div>

          </div>
        )}

        {/* Optimized Prompt */}
        {optimizedPrompt && (
          <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
            <h3 className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
              {language === "ko" ? "최적화된 프롬프트" : "Optimized Prompt"}
            </h3>
            <p className="text-sm text-neutral-700 leading-relaxed">
              {optimizedPrompt}
            </p>
          </div>
        )}

        {/* Stashed Prompts Panel */}
        <StashedPromptsPanel
          currentPrompt={optimizedPrompt || ""}
          currentMetadata={{
            // Basic settings
            aspectRatio: "9:16",
            duration: "5",
            // Campaign & idea
            campaignId: campaignId || undefined,
            campaignName: campaignName || undefined,
            selectedIdea: selectedIdea,
            // Hashtags & keywords
            hashtags: allHashtags,
            keywords: keywords,
            // Performance metrics
            performanceMetrics: performanceMetrics,
            // Saved inspiration (thumbnails & stats only)
            savedInspiration: savedInspiration.map((v) => ({
              id: v.id,
              thumbnailUrl: v.thumbnailUrl,
              stats: v.stats,
            })),
            // AI insights
            aiInsights: aiInsights,
          }}
          source="create"
          collapsed={true}
        />

        {/* Campaign */}
        {campaignName && (
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 rounded-lg">
            <FolderOpen className="h-4 w-4 text-neutral-500" />
            <span className="text-sm text-neutral-700">{campaignName}</span>
          </div>
        )}

        {/* Hashtags */}
        {allHashtags.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {language === "ko" ? "해시태그" : "Hashtags"}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {allHashtags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs bg-neutral-200 text-neutral-700"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Inspiration Videos */}
        {savedInspiration.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide flex items-center gap-1">
              <Play className="h-3 w-3" />
              {language === "ko" ? "영감 레퍼런스" : "Inspiration"} ({savedInspiration.length})
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {savedInspiration.slice(0, 5).map((video) => (
                <a
                  key={video.id}
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex-shrink-0 w-16 group"
                >
                  <div className="aspect-[9/16] rounded-lg overflow-hidden bg-neutral-100">
                    {video.thumbnailUrl && (
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ExternalLink className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="mt-1 text-[9px] text-neutral-500 truncate">
                    {formatCount(video.stats.playCount)} views
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* AI Insights */}
        {aiInsights?.summary && (
          <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
            <h3 className="text-xs font-semibold text-neutral-500 mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {language === "ko" ? "AI 인사이트" : "AI Insight"}
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              {aiInsights.summary}
            </p>
          </div>
        )}

        {/* Edit Context Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={goToAnalyze}
          className="w-full text-neutral-500 hover:text-neutral-700"
        >
          {language === "ko" ? "컨텍스트 수정하기" : "Edit Context"}
        </Button>
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// Asset Upload Section
// ============================================================================

interface UploadedAsset {
  id: string;
  type: "audio" | "image";
  name: string;
  url: string;
  file?: File;
  fromCampaign?: boolean;
}

interface CampaignAsset {
  id: string;
  filename: string;
  original_filename: string;
  type: "image" | "video" | "audio" | "goods";
  s3_url: string;
  mime_type: string | null;
}

function AssetUploadSection({
  audioAsset,
  imageAssets,
  onAudioChange,
  onImagesChange,
  campaignAssets,
  isLoadingAssets,
  campaignId,
}: {
  audioAsset: UploadedAsset | null;
  imageAssets: UploadedAsset[];
  onAudioChange: (asset: UploadedAsset | null) => void;
  onImagesChange: (assets: UploadedAsset[]) => void;
  campaignAssets: CampaignAsset[];
  isLoadingAssets: boolean;
  campaignId: string;
}) {
  const { language } = useI18n();
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [musicExpanded, setMusicExpanded] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filter campaign assets by type
  const audioAssets = useMemo(
    () => campaignAssets.filter((a) => a.type === "audio"),
    [campaignAssets]
  );
  const imageAssetsFromCampaign = useMemo(
    () => campaignAssets.filter((a) => a.type === "image"),
    [campaignAssets]
  );
  const videoAssets = useMemo(
    () => campaignAssets.filter((a) => a.type === "video"),
    [campaignAssets]
  );

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !campaignId) return;

    // Get the latest token from store (not from hook to avoid stale closure)
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      setUploadError(language === 'ko'
        ? '로그인이 필요합니다. 페이지를 새로고침 해주세요.'
        : 'Please log in. Try refreshing the page.');
      return;
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg'];
    if (!validTypes.includes(file.type)) {
      setUploadError(language === 'ko'
        ? '지원하는 형식: MP3, WAV, FLAC, OGG'
        : 'Supported formats: MP3, WAV, FLAC, OGG');
      return;
    }

    // Validate file size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
      setUploadError(language === 'ko'
        ? '파일 크기는 500MB 이하여야 합니다'
        : 'File must be less than 500MB');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/v1/campaigns/${campaignId}/assets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Upload failed');
      }

      const data = await response.json();

      // Use the uploaded asset's S3 URL
      onAudioChange({
        id: data.id,
        type: "audio",
        name: file.name,
        url: data.s3_url,
        fromCampaign: true,
      });

      // Auto-expand music section to show the selected file
      setMusicExpanded(true);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }

    // Reset input
    e.target.value = '';
  };

  const handleSelectCampaignAudio = (asset: CampaignAsset) => {
    onAudioChange({
      id: asset.id,
      type: "audio",
      name: asset.original_filename,
      url: asset.s3_url,
      fromCampaign: true,
    });
    setShowAudioPicker(false);
  };

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAssets = files.map((file) => ({
      id: crypto.randomUUID(),
      type: "image" as const,
      name: file.name,
      url: URL.createObjectURL(file),
      file,
    }));
    onImagesChange([...imageAssets, ...newAssets].slice(0, 10));
  };

  const handleSelectCampaignImage = (asset: CampaignAsset) => {
    // Check if already selected
    if (imageAssets.find((a) => a.id === asset.id)) return;
    if (imageAssets.length >= 10) return;

    onImagesChange([
      ...imageAssets,
      {
        id: asset.id,
        type: "image",
        name: asset.original_filename,
        url: asset.s3_url,
        fromCampaign: true,
      },
    ]);
  };

  const removeImage = (id: string) => {
    onImagesChange(imageAssets.filter((a) => a.id !== id));
  };

  // Calculate asset counts for summary
  const assetCounts = {
    audio: audioAssets.length,
    image: imageAssetsFromCampaign.length,
    video: videoAssets.length,
    total: campaignAssets.length,
  };

  return (
    <div className="space-y-4">
      {/* Campaign Assets Summary */}
      {assetCounts.total > 0 && (
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
              {language === "ko" ? "캠페인 에셋" : "Campaign Assets"}
            </h4>
            <span className="text-xs text-neutral-400">
              {assetCounts.total} {language === "ko" ? "개" : "items"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {assetCounts.audio > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-neutral-200">
                <Music className="h-2.5 w-2.5 mr-1" />
                {language === "ko" ? "음악" : "Music"} {assetCounts.audio}
              </Badge>
            )}
            {assetCounts.image > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-neutral-200">
                <Images className="h-2.5 w-2.5 mr-1" />
                {language === "ko" ? "이미지" : "Images"} {assetCounts.image}
              </Badge>
            )}
            {assetCounts.video > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-neutral-200">
                <Video className="h-2.5 w-2.5 mr-1" />
                {language === "ko" ? "영상" : "Videos"} {assetCounts.video}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Music Section - Collapsible */}
      <Collapsible open={musicExpanded} onOpenChange={setMusicExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">
                {language === "ko" ? "음악" : "Music"}
              </span>
              <Badge variant="secondary" className="text-[10px] bg-neutral-200">
                {language === "ko" ? "선택사항" : "Optional"}
              </Badge>
              {audioAsset && (
                <Badge variant="outline" className="text-[10px] border-neutral-400 text-neutral-600">
                  {audioAsset.name.length > 20 ? audioAsset.name.slice(0, 20) + "..." : audioAsset.name}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-neutral-500 transition-transform",
              musicExpanded && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 px-1">
          {audioAsset ? (
            <div className="flex items-center gap-2 p-2 bg-neutral-100 rounded-lg">
              <Music className="h-4 w-4 text-neutral-500" />
              <span className="text-sm text-neutral-700 flex-1 truncate">
                {audioAsset.name}
              </span>
              {audioAsset.fromCampaign && (
                <Badge variant="outline" className="text-[9px] border-neutral-300">
                  {language === "ko" ? "캠페인" : "Campaign"}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onAudioChange(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* From Campaign Button */}
              {audioAssets.length > 0 && (
                <div className="relative">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-neutral-600 border-neutral-200"
                    onClick={() => setShowAudioPicker(!showAudioPicker)}
                  >
                    <Library className="h-4 w-4 mr-2" />
                    {language === "ko"
                      ? `캠페인에서 선택 (${audioAssets.length})`
                      : `Select from Campaign (${audioAssets.length})`}
                  </Button>
                  {showAudioPicker && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                      {audioAssets.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => handleSelectCampaignAudio(asset)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center gap-2"
                        >
                          <Music className="h-3 w-3 text-neutral-400" />
                          <span className="truncate">{asset.original_filename}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Upload Button */}
              <label className={cn(
                "flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg transition-colors",
                uploading
                  ? "border-neutral-300 bg-neutral-50 cursor-wait"
                  : "border-neutral-200 cursor-pointer hover:border-neutral-300"
              )}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
                    <span className="text-sm text-neutral-500">
                      {language === "ko" ? "업로드 중..." : "Uploading..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-neutral-400" />
                    <span className="text-sm text-neutral-500">
                      {language === "ko" ? "오디오 파일 업로드" : "Upload audio file"}
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleAudioUpload}
                  disabled={uploading}
                />
              </label>
              {uploadError && (
                <p className="text-xs text-red-500 mt-1">{uploadError}</p>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
      {/* Video References Section */}
      {videoAssets.length > 0 && (
        <div>
          <Label className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
            <Video className="h-3 w-3" />
            {language === "ko" ? "영상 레퍼런스" : "Video References"}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {videoAssets.slice(0, 6).map((asset) => (
              <div
                key={asset.id}
                className="relative aspect-video rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200"
              >
                <video
                  src={asset.s3_url}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-6 w-6 text-white" />
                </div>
                <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                  <span className="text-[9px] text-white truncate block">
                    {asset.original_filename}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {videoAssets.length > 6 && (
            <p className="text-[10px] text-neutral-400 mt-1">
              +{videoAssets.length - 6} {language === "ko" ? "개 더" : "more"}
            </p>
          )}
        </div>
      )}

      {/* Reference Images Section - Collapsible, at the bottom */}
      <Collapsible open={imageExpanded} onOpenChange={setImageExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors">
            <div className="flex items-center gap-2">
              <Images className="h-4 w-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">
                {language === "ko" ? "레퍼런스 이미지" : "Reference Images"}
              </span>
              <Badge variant="secondary" className="text-[10px] bg-neutral-200">
                {language === "ko" ? "선택사항" : "Optional"}
              </Badge>
              {imageAssets.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-neutral-400 text-neutral-600">
                  {imageAssets.length}/10
                </Badge>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-neutral-500 transition-transform",
              imageExpanded && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 px-1">
          <div className="space-y-3">
            {/* From Campaign Button */}
            {imageAssetsFromCampaign.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-start text-neutral-600 border-neutral-200"
                  onClick={() => setShowImagePicker(!showImagePicker)}
                >
                  <Library className="h-4 w-4 mr-2" />
                  {language === "ko"
                    ? `캠페인에서 선택 (${imageAssetsFromCampaign.length})`
                    : `Select from Campaign (${imageAssetsFromCampaign.length})`}
                </Button>
              </div>
            )}

            {/* Campaign Image Picker */}
            {showImagePicker && imageAssetsFromCampaign.length > 0 && (
              <div className="p-3 border border-neutral-200 rounded-lg bg-neutral-50">
                <div className="text-xs text-neutral-500 mb-2">
                  {language === "ko"
                    ? "캠페인 이미지 (클릭하여 추가)"
                    : "Campaign images (click to add)"}
                </div>
                <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-auto">
                  {imageAssetsFromCampaign.map((asset) => {
                    const isSelected = imageAssets.some((a) => a.id === asset.id);
                    return (
                      <button
                        key={asset.id}
                        onClick={() => handleSelectCampaignImage(asset)}
                        disabled={isSelected || imageAssets.length >= 10}
                        className={cn(
                          "relative aspect-square rounded overflow-hidden",
                          isSelected
                            ? "ring-2 ring-neutral-900 opacity-50"
                            : "hover:ring-2 hover:ring-neutral-400"
                        )}
                      >
                        <img
                          src={asset.s3_url}
                          alt={asset.original_filename}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => setShowImagePicker(false)}
                >
                  {language === "ko" ? "닫기" : "Close"}
                </Button>
              </div>
            )}

            {/* Selected Images Grid */}
            <div className="grid grid-cols-5 gap-2">
              {imageAssets.map((asset) => (
                <div key={asset.id} className="relative aspect-square group">
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {asset.fromCampaign && (
                    <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/60 rounded text-[8px] text-white">
                      {language === "ko" ? "캠페인" : "Campaign"}
                    </div>
                  )}
                  <button
                    onClick={() => removeImage(asset.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-neutral-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {imageAssets.length < 10 && (
                <label className="aspect-square border-2 border-dashed border-neutral-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-neutral-300 transition-colors">
                  <Plus className="h-5 w-5 text-neutral-400" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImagesUpload}
                  />
                </label>
              )}
            </div>

            <p className="text-[10px] text-neutral-400">
              {language === "ko"
                ? "Veo3 영상 생성에 참고할 이미지를 추가하세요"
                : "Add images to reference for Veo3 video generation"}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// Inline Prompt Personalizer (replaces modal)
// ============================================================================

interface PreviewImageData {
  preview_id: string;
  image_url: string;
  image_base64: string;
  gemini_image_prompt: string;
}

interface InlinePromptPersonalizerProps {
  isActive: boolean;
  onGenerateVideo: (metadata: {
    duration: string;
    aspectRatio: string;
    style: string;
    previewImage?: PreviewImageData;
  }) => void;
  isGenerating: boolean;
  context: {
    selectedIdea?: {
      title: string;
      description: string;
      hook?: string;
      type: "ai_video" | "fast-cut";
      optimizedPrompt?: string;
    } | null;
    campaignName: string;
    artistName?: string;
    optimizedPrompt?: string;
  };
  images: { url: string; name?: string; fromCampaign?: boolean; file?: File }[];
  campaignId: string;  // Required: link generated images to this campaign
}

function InlinePromptPersonalizer({
  isActive,
  onGenerateVideo,
  isGenerating,
  context,
  images,
  campaignId,
}: InlinePromptPersonalizerProps) {
  const { language } = useI18n();
  const analyzeState = useWorkflowStore((state) => state.analyze);
  const setAnalyzeImagePrompt = useWorkflowStore((state) => state.setAnalyzeImagePrompt);
  const setAnalyzePreviewImage = useWorkflowStore((state) => state.setAnalyzePreviewImage);

  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Prompts - imagePrompt comes from store for persistence
  const [videoPrompt, setVideoPrompt] = useState("");
  const imagePrompt = analyzeState.imagePrompt || null;
  const [previewImage, setPreviewImage] = useState<PreviewImageData | null>(null);

  // Lightbox for full-size image view
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Metadata
  const [metadata] = useState({
    duration: "8s",
    aspectRatio: "9:16",
    style: "cinematic",
  });

  // Get video prompt from multiple sources
  const getVideoPrompt = useCallback(() => {
    const prompt =
      context.selectedIdea?.optimizedPrompt ||
      context.optimizedPrompt ||
      context.selectedIdea?.description ||
      analyzeState.selectedIdea?.optimizedPrompt ||
      analyzeState.optimizedPrompt ||
      analyzeState.userIdea ||
      analyzeState.selectedIdea?.description ||
      "";
    return prompt;
  }, [context, analyzeState]);

  // Initialize when component becomes active - restore preview image from store
  useEffect(() => {
    if (isActive) {
      const prompt = getVideoPrompt();
      setIsGeneratingPreview(false);
      setError(null);
      setPreviewError(null);
      setVideoPrompt(prompt);
      // Don't reset imagePrompt - let user manually generate/regenerate
      // Restore preview image from store if available (convert camelCase → snake_case)
      if (analyzeState.previewImage) {
        setPreviewImage({
          preview_id: analyzeState.previewImage.previewId,
          image_url: analyzeState.previewImage.imageUrl,
          image_base64: analyzeState.previewImage.imageBase64 || "",
          gemini_image_prompt: analyzeState.previewImage.geminiImagePrompt,
        });
      } else {
        setPreviewImage(null);
      }
      setLightboxOpen(false);
    }
  }, [isActive, getVideoPrompt, analyzeState.previewImage]);

  // Generate preview image (first frame for I2V)
  const generatePreviewImage = useCallback(async () => {
    if (!videoPrompt) return;

    setIsGeneratingPreview(true);
    setPreviewError(null);

    try {
      const productImage = images.find(img => img.url && !img.url.startsWith("blob:"));
      const productImageUrl = productImage?.url;

      const imageDescription =
        context.selectedIdea?.description ||
        context.campaignName ||
        "Product promotional video";

      const response = await previewImageApi.generateWithoutCampaign({
        video_prompt: videoPrompt,
        image_description: imageDescription,
        aspect_ratio: metadata.aspectRatio,
        style: metadata.style,
        product_image_url: productImageUrl,
        composition_mode: "direct",
        hand_pose: "elegantly holding",
        campaign_id: campaignId,  // Link generated image to the selected campaign
      });

      if (response.error || !response.data) {
        throw new Error(response.error?.message || "Failed to generate preview image");
      }

      const newPreviewImage = {
        preview_id: response.data.preview_id,
        image_url: response.data.image_url,
        image_base64: response.data.image_base64,
        gemini_image_prompt: response.data.gemini_image_prompt,
      };
      setPreviewImage(newPreviewImage);

      // Persist to store (convert snake_case → camelCase)
      setAnalyzePreviewImage({
        previewId: response.data.preview_id,
        imageUrl: response.data.image_url,
        imageBase64: response.data.image_base64,
        geminiImagePrompt: response.data.gemini_image_prompt,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to generate preview image");
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [videoPrompt, metadata, images, context, setAnalyzePreviewImage]);

  // Handle regenerate
  const handleRegenerate = useCallback(() => {
    setPreviewImage(null);
    setAnalyzePreviewImage(null);  // Clear store too
    generatePreviewImage();
  }, [generatePreviewImage, setAnalyzePreviewImage]);

  // Handle complete
  const handleComplete = useCallback(() => {
    onGenerateVideo({
      duration: metadata.duration,
      aspectRatio: metadata.aspectRatio,
      style: metadata.style,
      previewImage: previewImage || undefined,
    });
  }, [metadata, previewImage, onGenerateVideo]);

  if (!isActive) return null;

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-neutral-900 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-neutral-900">
              {language === "ko" ? "첫 장면 미리보기" : "First Frame Preview"}
            </h4>
            <p className="text-[10px] text-neutral-500">
              {language === "ko"
                ? "프롬프트를 확인하고 첫 장면을 생성하세요"
                : "Review prompts and generate first frame"}
            </p>
          </div>
        </div>
        {/* Status indicator */}
        {previewImage && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
            <Check className="h-3 w-3 mr-1" />
            {language === "ko" ? "첫 장면 준비 완료" : "First frame ready"}
          </Badge>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-600 flex-1">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-red-600 hover:text-red-700 h-6 px-2"
            onClick={() => setError(null)}
          >
            {language === "ko" ? "닫기" : "Dismiss"}
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Prompts Section - Always visible */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left: Video Prompt */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Video className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-xs font-medium text-neutral-700">
                {language === "ko" ? "영상 프롬프트" : "Video Prompt"}
              </span>
              <Badge variant="secondary" className="text-[9px] bg-neutral-100">Input</Badge>
            </div>
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg h-[140px] overflow-y-auto">
              {videoPrompt ? (
                <p className="text-xs text-neutral-700 whitespace-pre-wrap leading-relaxed">
                  {videoPrompt}
                </p>
              ) : (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <p className="text-xs">
                    {language === "ko" ? "프롬프트가 없습니다" : "No prompt available"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Image Prompt - Using new isolated component */}
          <ImagePromptGenerator
            videoPrompt={videoPrompt}
            imagePrompt={imagePrompt}
            onImagePromptChange={setAnalyzeImagePrompt}
            metadata={metadata}
            context={context}
          />
        </div>

        {/* Preview Image Section - Below prompts */}
        {(isGeneratingPreview || previewError || previewImage) && (
          <div className="border-t border-neutral-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ImagePlus className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-xs font-medium text-neutral-700">
                {language === "ko" ? "첫 장면 미리보기" : "First Frame Preview"}
              </span>
            </div>

            {isGeneratingPreview ? (
              <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-lg bg-neutral-200 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImagePlus className="h-5 w-5 text-neutral-600 animate-bounce" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-neutral-900">
                    {language === "ko" ? "첫 장면 생성 중..." : "Generating first frame..."}
                  </h4>
                  <p className="text-xs text-neutral-500">
                    {language === "ko" ? "30초 ~ 1분 소요" : "30 seconds to 1 minute"}
                  </p>
                </div>
                <Spinner className="h-5 w-5" />
              </div>
            ) : previewError ? (
              <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-800">
                    {language === "ko" ? "생성 실패" : "Generation failed"}
                  </h4>
                  <p className="text-xs text-red-600">{previewError}</p>
                </div>
                <Button onClick={handleRegenerate} variant="outline" size="sm" className="shrink-0">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {language === "ko" ? "재시도" : "Retry"}
                </Button>
              </div>
            ) : previewImage ? (
              <div>
                {/* Preview image - clickable for lightbox */}
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="relative w-full max-w-md rounded-lg overflow-hidden border border-neutral-200 bg-neutral-900 cursor-pointer group"
                >
                  <img
                    src={previewImage.image_url}
                    alt="Generated first frame"
                    className="w-full h-auto object-contain transition-opacity group-hover:opacity-90"
                    style={{ maxHeight: "200px" }}
                  />
                  {/* Expand overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <div className="bg-white/90 rounded-full p-2">
                      <ZoomIn className="h-5 w-5 text-neutral-700" />
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isGenerating}
                    className="text-xs h-7 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {language === "ko" ? "다시 생성" : "Regenerate"}
                  </Button>
                  <span className="text-[10px] text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {language === "ko" ? "영상 생성 준비 완료" : "Ready for video"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (previewImage && !isGeneratingPreview) {
              setPreviewImage(null);
              setAnalyzePreviewImage(null);  // Clear store too
              setPreviewError(null);
            }
          }}
          disabled={!previewImage || isGeneratingPreview}
          className="border-neutral-300"
        >
          {language === "ko" ? "이미지 초기화" : "Reset Image"}
        </Button>

        <div className="flex items-center gap-2">
          {/* Generate Frame button - show when image prompt exists but no preview yet */}
          {imagePrompt && !previewImage && (
            <Button
              onClick={generatePreviewImage}
              disabled={isGeneratingPreview}
              variant="outline"
              className="border-neutral-300"
            >
              {isGeneratingPreview ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {language === "ko" ? "생성 중..." : "Generating..."}
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {language === "ko" ? "첫 장면 생성" : "Generate Frame"}
                </>
              )}
            </Button>
          )}

          {/* Generate Video button - show when preview is ready */}
          {previewImage && !isGeneratingPreview && (
            <Button
              onClick={handleComplete}
              disabled={isGenerating}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {isGenerating ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {language === "ko" ? "생성 중..." : "Generating..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {language === "ko" ? "영상 생성하기" : "Generate Video"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Lightbox Dialog for full-size image */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black border-neutral-800">
          <DialogTitle className="sr-only">
            {language === "ko" ? "첫 장면 미리보기 전체 화면" : "First frame preview full screen"}
          </DialogTitle>
          {previewImage && (
            <div className="relative">
              <img
                src={previewImage.image_url}
                alt="Generated first frame - full size"
                className="w-full h-auto object-contain max-h-[80vh]"
              />
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useI18n();
  const toast = useToast();

  // Session integration - sync with session store if session param exists
  const sessionId = searchParams.get("session");
  const { activeSession, syncNow } = useSessionWorkflowSync("create");

  // Sync workflow stage
  useWorkflowSync("create");
  const { goToAnalyze } = useWorkflowNavigation();

  // Workflow store
  const { analyze, setAnalyzeCampaign } = useWorkflowStore(
    useShallow((state) => ({
      analyze: state.analyze,
      setAnalyzeCampaign: state.setAnalyzeCampaign,
    }))
  );

  // Campaigns
  const { data: campaignsData } = useCampaigns({ page_size: 50 });
  const campaigns = useMemo(() => campaignsData?.items || [], [campaignsData]);

  // Selected campaign state - default to workflow campaign or first campaign
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  // Initialize campaign selection
  useEffect(() => {
    if (analyze.campaignId) {
      setSelectedCampaignId(analyze.campaignId);
    } else if (campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [analyze.campaignId, campaigns, selectedCampaignId]);

  // Get selected campaign name
  const selectedCampaignName = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId)?.name || "",
    [campaigns, selectedCampaignId]
  );

  // Get selected campaign object (for artist_name)
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId),
    [campaigns, selectedCampaignId]
  );

  // Fetch assets for selected campaign
  const { data: assetsData, isLoading: isLoadingAssets } = useAssets(
    selectedCampaignId,
    { page_size: 100 }
  );
  const campaignAssets = useMemo(() => assetsData?.items || [], [assetsData]);

  // Handle campaign change
  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (campaign) {
      setAnalyzeCampaign(campaign.id, campaign.name);
    }
    // Clear selected assets when campaign changes
    setAudioAsset(null);
    setImageAssets([]);
  };

  // Local state
  const [audioAsset, setAudioAsset] = useState<UploadedAsset | null>(null);
  const [imageAssets, setImageAssets] = useState<UploadedAsset[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Helper function to convert File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/xxx;base64, prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle personalization complete - start generation with personalized prompt
  const handlePersonalizationComplete = useCallback(
    async (prompt: string, metadata: {
      duration: string;
      aspectRatio: string;
      style: string;
      previewImage?: {
        preview_id: string;
        image_url: string;
        image_base64: string;
        gemini_image_prompt: string;
      };
    }) => {
      console.log("[Veo3] handlePersonalizationComplete called", {
        prompt: prompt.slice(0, 100) + "...",
        metadata: { ...metadata, previewImage: metadata.previewImage ? { id: metadata.previewImage.preview_id, hasImage: !!metadata.previewImage.image_url } : null },
        audioAsset: audioAsset?.id,
        imageAssetsCount: imageAssets.length,
      });

      // Start generation directly (no modal to close)
      setIsGenerating(true);

      try {
        console.log("[Veo3] ═══════════════════════════════════════════════════════");
        console.log("[Veo3] Starting video generation via API...");
        console.log("[Veo3] Total image assets:", imageAssets.length);
        console.log("[Veo3] Has AI-generated preview:", !!metadata.previewImage);

        // Prepare image data for the API
        let previewImageBase64: string | undefined;
        let previewImageUrl: string | undefined;
        let imageDescription: string | undefined;

        // PRIORITY 1: Use AI-generated preview image from modal (I2V first frame)
        if (metadata.previewImage) {
          console.log("[Veo3] 🎨 Using AI-GENERATED preview image from modal");
          console.log("[Veo3]   Preview ID:", metadata.previewImage.preview_id);
          console.log("[Veo3]   Image URL:", metadata.previewImage.image_url.slice(0, 80) + "...");
          console.log("[Veo3]   Base64 length:", metadata.previewImage.image_base64?.length || 0);

          previewImageUrl = metadata.previewImage.image_url;
          previewImageBase64 = metadata.previewImage.image_base64;
          imageDescription = metadata.previewImage.gemini_image_prompt;
          console.log("[Veo3] ✓ AI-generated first frame ready for I2V");
        }
        // PRIORITY 2: Fall back to user-uploaded images (legacy behavior)
        else {
          const firstImage = imageAssets[0];

          if (firstImage) {
            console.log("[Veo3] 📷 Using USER-UPLOADED image (legacy mode)");
            console.log("[Veo3] First image details:", {
              id: firstImage.id,
              name: firstImage.name,
              fromCampaign: firstImage.fromCampaign,
              hasFile: !!firstImage.file,
              hasUrl: !!firstImage.url,
              urlPreview: firstImage.url?.slice(0, 60),
            });

            if (firstImage.fromCampaign) {
              // Campaign asset - use the S3 URL directly
              previewImageUrl = firstImage.url;
              console.log("[Veo3] ✓ Using CAMPAIGN image URL:", previewImageUrl.slice(0, 80) + "...");
            } else if (firstImage.file) {
              // Local upload - convert to base64
              console.log("[Veo3] Converting LOCAL upload to base64...");
              previewImageBase64 = await fileToBase64(firstImage.file);
              console.log("[Veo3] ✓ Base64 image ready:", Math.round(previewImageBase64.length / 1024) + "KB");
            } else if (firstImage.url && !firstImage.url.startsWith("blob:")) {
              // External URL that's not a blob
              previewImageUrl = firstImage.url;
              console.log("[Veo3] ✓ Using EXTERNAL image URL:", previewImageUrl.slice(0, 80) + "...");
            } else {
              console.log("[Veo3] ⚠ Could not process first image - no valid source");
            }
            imageDescription = `Reference image for video generation`;
          } else {
            console.log("[Veo3] No images provided - will use T2V mode");
          }
        }

        console.log("[Veo3] Image mode summary:", {
          hasBase64: !!previewImageBase64,
          hasUrl: !!previewImageUrl,
          mode: metadata.previewImage ? "AI_GENERATED" : previewImageBase64 ? "LOCAL_UPLOAD" : previewImageUrl ? "CAMPAIGN_URL" : "TEXT_ONLY",
        });

        const apiParams = {
          prompt: prompt.slice(0, 100) + "...",
          audio_asset_id: audioAsset?.id,
          aspect_ratio: metadata.aspectRatio,
          duration_seconds: parseInt(metadata.duration) || 5,
          reference_style: metadata.style || undefined,
          enable_i2v: !!(previewImageBase64 || previewImageUrl),
          image_description: imageDescription,
          has_preview_image_base64: !!previewImageBase64,
          has_preview_image_url: !!previewImageUrl,
          preview_image_url_preview: previewImageUrl?.slice(0, 60),
          mode: metadata.previewImage ? "AI_GENERATED" : "USER_UPLOADED",
        };
        console.log("[Veo3] API request params:", apiParams);

        const response = await videoApi.create(selectedCampaignId, {
          prompt,
          audio_asset_id: audioAsset?.id,
          aspect_ratio: metadata.aspectRatio,
          duration_seconds: parseInt(metadata.duration) || 5,
          reference_style: metadata.style || undefined,
          // Enable I2V if image is available
          enable_i2v: !!(previewImageBase64 || previewImageUrl),
          image_description: imageDescription,
          // Pass the actual image data
          preview_image_base64: previewImageBase64,
          preview_image_url: previewImageUrl,
          // Bridge context from workflow
          original_input: analyze.userIdea || undefined,
          trend_keywords: useWorkflowStore.getState().discover.keywords,
        });

        if (response.error) {
          throw new Error(response.error.message || "Generation failed");
        }

        toast.success(
          language === "ko" ? "생성 시작" : "Generation started",
          language === "ko" ? "영상 생성이 시작되었습니다" : "Video generation has started"
        );

        // Navigate to processing page to monitor video generation
        router.push("/processing");
      } catch (error) {
        console.error("Failed to start video generation:", error);
        toast.error(
          language === "ko" ? "생성 실패" : "Generation failed",
          error instanceof Error ? error.message : "Unknown error"
        );
        setIsGenerating(false);
      }
    },
    [selectedCampaignId, audioAsset, imageAssets, analyze, router, language, toast, fileToBase64]
  );

  // Translations
  const t = {
    title: language === "ko" ? "콘텐츠 만들기" : "Create Content",
    subtitle:
      language === "ko"
        ? "아이디어를 영상으로 만드세요"
        : "Turn your idea into a video",
    back: language === "ko" ? "분석으로" : "Back to Analyze",
    selectCampaign: language === "ko" ? "캠페인 선택" : "Select Campaign",
  };

  return (
    <TooltipProvider>
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <WorkflowHeader
        onBack={goToAnalyze}
        onNext={() => router.push("/processing")}
      />

      {/* Main Content - Two Columns */}
      <div className="flex-1 flex overflow-hidden px-[7%]">
        {/* Left Column - Context */}
        <div className="w-2/5 border-r border-neutral-200 bg-neutral-50">
          <ContextPanel />
        </div>

        {/* Right Column - Campaign, Assets & Methods */}
        <div className="w-3/5 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Campaign Selector */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-neutral-700">
                  {t.selectCampaign}
                </Label>
                <InfoButton
                  content={language === "ko"
                    ? "생성된 영상이 저장될 캠페인을 선택하세요. 캠페인에 업로드된 에셋(음악, 이미지)을 영상 제작에 활용할 수 있습니다."
                    : "Select the campaign where your video will be saved. You can use assets (music, images) uploaded to the campaign."}
                  side="bottom"
                />
              </div>
              <Select
                value={selectedCampaignId}
                onValueChange={handleCampaignChange}
              >
                <SelectTrigger className={cn(
                  "w-full",
                  !selectedCampaignId && "border-neutral-300 ring-1 ring-neutral-200"
                )}>
                  <SelectValue placeholder={t.selectCampaign} />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      <div className="flex items-center gap-2">
                        <span>{campaign.name}</span>
                        {campaign.id === analyze.campaignId && (
                          <Badge variant="secondary" className="text-[9px]">
                            {language === "ko" ? "워크플로우" : "Workflow"}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCampaignName && (
                <p className="text-xs text-neutral-400">
                  {language === "ko"
                    ? `${campaignAssets.length}개 에셋 사용 가능`
                    : `${campaignAssets.length} assets available`}
                </p>
              )}
            </div>

            {/* Inline Prompt Personalizer - Shows when campaign is selected */}
            {selectedCampaignId && (
              <InlinePromptPersonalizer
                isActive={true}
                onGenerateVideo={(metadata) => {
                  // Get the video prompt from workflow store
                  const prompt =
                    analyze.selectedIdea?.optimizedPrompt ||
                    analyze.optimizedPrompt ||
                    analyze.userIdea ||
                    analyze.selectedIdea?.description ||
                    "";
                  handlePersonalizationComplete(prompt, metadata);
                }}
                isGenerating={isGenerating}
                context={{
                  selectedIdea: analyze.selectedIdea || null,
                  campaignName: selectedCampaignName,
                  artistName: selectedCampaign?.artist_name,
                  optimizedPrompt: analyze.optimizedPrompt || analyze.userIdea || "",
                }}
                images={imageAssets.map((asset) => ({
                  url: asset.url,
                  name: asset.name,
                  fromCampaign: asset.fromCampaign,
                  file: asset.file,
                }))}
                campaignId={selectedCampaignId}
              />
            )}

            {/* Asset Upload (Optional) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-neutral-700">
                  {language === "ko" ? "에셋 선택" : "Select Assets"}
                </Label>
                <Badge variant="secondary" className="text-[10px] bg-neutral-100 text-neutral-500">
                  {language === "ko" ? "선택사항" : "Optional"}
                </Badge>
                <InfoButton
                  content={language === "ko"
                    ? "영상 제작에 사용할 음악과 이미지를 선택합니다. 새로 업로드할 수 있습니다."
                    : "Select music and images for video creation. Upload new files."}
                  side="bottom"
                />
              </div>
              <AssetUploadSection
                audioAsset={audioAsset}
                imageAssets={imageAssets}
                onAudioChange={setAudioAsset}
                onImagesChange={setImageAssets}
                campaignAssets={[]}
                isLoadingAssets={false}
                campaignId={selectedCampaignId}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer with navigation */}
      <WorkflowFooter
        onBack={goToAnalyze}
        onNext={() => router.push("/processing")}
        canProceed={!isGenerating}
      />
    </div>
    </TooltipProvider>
  );
}
