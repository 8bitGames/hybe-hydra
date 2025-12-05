"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { useCampaigns, useAssets, useMerchandise } from "@/lib/queries";
import type { MerchandiseItem as MerchandiseItemType } from "@/lib/campaigns-api";
import { useToast } from "@/components/ui/toast";
import { PersonalizePromptModal } from "@/components/features/create/PersonalizePromptModal";
import { StashedPromptsPanel } from "@/components/features/stashed-prompts-panel";
import { videoApi } from "@/lib/video-api";
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
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Video,
  Images,
  Music,
  Upload,
  Plus,
  X,
  Hash,
  Eye,
  Zap,
  Trophy,
  Lightbulb,
  Play,
  ExternalLink,
  FolderOpen,
  Check,
  Library,
} from "lucide-react";
import { InlineComposeFlow } from "@/components/features/create/compose/InlineComposeFlow";

// ============================================================================
// Helper Functions
// ============================================================================

function formatCount(num: number | null | undefined): string {
  if (num === null || num === undefined || num === 0) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

// ============================================================================
// Step Progress Indicator
// ============================================================================

interface StepStatus {
  campaignSelected: boolean;
  methodSelected: boolean;
  musicSelected: boolean;
  imageSelected: boolean; // Required for AI (Veo3) mode
}

function StepProgressIndicator({
  status,
  selectedMethod,
}: {
  status: StepStatus;
  selectedMethod: "ai" | "compose" | null;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // For AI mode, image is required; for compose mode, it's not
  const imageRequired = selectedMethod === "ai";
  const assetsComplete = imageRequired
    ? (status.musicSelected && status.imageSelected)
    : status.musicSelected;

  // Determine current step and next action
  const getCurrentStep = (): number => {
    if (!status.campaignSelected) return 1;
    if (!status.methodSelected) return 2;
    if (!assetsComplete) return 3;
    return 4; // All done
  };

  const currentStep = getCurrentStep();

  const getNextActionMessage = (): string => {
    if (!status.campaignSelected) {
      return isKorean
        ? "영상을 저장할 캠페인을 선택하세요"
        : "Select a campaign to save your video";
    }
    if (!status.methodSelected) {
      return isKorean
        ? "AI 생성 또는 컴포즈 중 생성 방식을 선택하세요"
        : "Choose between AI Generated or Compose video";
    }
    // Check assets based on method
    if (!status.musicSelected) {
      return isKorean
        ? "영상에 사용할 음악을 추가하세요"
        : "Add music for your video";
    }
    if (selectedMethod === "ai" && !status.imageSelected) {
      return isKorean
        ? "Veo3 생성을 위해 레퍼런스 이미지를 추가하세요"
        : "Add a reference image for Veo3 generation";
    }
    // All complete
    if (selectedMethod === "ai") {
      return isKorean
        ? "준비 완료! 'Veo3로 생성하기' 버튼을 클릭하세요"
        : "Ready! Click 'Generate with Veo3' to create";
    }
    return isKorean
      ? "준비 완료! '컴포즈 시작' 버튼을 클릭하세요"
      : "Ready! Click 'Start Compose' to create";
  };

  // Build steps dynamically based on method
  const steps = [
    {
      num: 1,
      label: isKorean ? "캠페인" : "Campaign",
      done: status.campaignSelected,
    },
    {
      num: 2,
      label: isKorean ? "생성 방식" : "Method",
      done: status.methodSelected,
    },
    {
      num: 3,
      label: selectedMethod === "ai"
        ? (isKorean ? "음악 + 이미지" : "Music + Image")
        : (isKorean ? "음악" : "Music"),
      done: assetsComplete,
    },
  ];

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
      {/* Next Action Message */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center">
          <ArrowRight className="h-3 w-3 text-white" />
        </div>
        <span className="text-sm font-medium text-neutral-900">
          {getNextActionMessage()}
        </span>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.num} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                step.done
                  ? "bg-neutral-900 text-white"
                  : currentStep === step.num
                  ? "bg-neutral-200 text-neutral-900 ring-2 ring-neutral-400 ring-offset-1"
                  : "bg-neutral-100 text-neutral-400"
              )}
            >
              {step.done ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="w-3 text-center">{step.num}</span>
              )}
              <span>{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-4 h-0.5 mx-1",
                  step.done ? "bg-neutral-400" : "bg-neutral-200"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Context Panel - Left Column
// ============================================================================

function ContextPanel() {
  const { language } = useI18n();
  const { goToAnalyze, goToDiscover } = useWorkflowNavigation();

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
            ? "분석 단계에서 아이디어를 선택하거나 발견 단계에서 트렌드를 수집하세요"
            : "Select an idea from Analyze or collect trends from Discover"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToDiscover}
            className="border-neutral-300"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {language === "ko" ? "발견으로" : "Discover"}
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
                className={cn(
                  "text-[10px]",
                  selectedIdea.type === "ai_video"
                    ? "border-neutral-900 text-neutral-900"
                    : "border-neutral-500 text-neutral-500"
                )}
              >
                {selectedIdea.type === "ai_video" ? "AI Video" : "Compose"}
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

        {/* Performance Benchmarks */}
        {performanceMetrics && (
          <div>
            <h3 className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
              {language === "ko" ? "성과 벤치마크" : "Performance Benchmarks"}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-neutral-100 rounded-lg p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-neutral-500 text-[10px] mb-0.5">
                  <Eye className="h-2.5 w-2.5" />
                  {language === "ko" ? "평균 조회" : "Avg Views"}
                </div>
                <div className="text-sm font-bold text-neutral-900">
                  {formatCount(performanceMetrics.avgViews)}
                </div>
              </div>
              <div className="bg-neutral-100 rounded-lg p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-neutral-500 text-[10px] mb-0.5">
                  <Zap className="h-2.5 w-2.5" />
                  {language === "ko" ? "참여율" : "Engagement"}
                </div>
                <div className="text-sm font-bold text-neutral-900">
                  {formatPercent(performanceMetrics.avgEngagement)}
                </div>
              </div>
              <div className="bg-neutral-100 rounded-lg p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-neutral-500 text-[10px] mb-0.5">
                  <Trophy className="h-2.5 w-2.5" />
                  {language === "ko" ? "바이럴" : "Viral"}
                </div>
                <div className="text-sm font-bold text-neutral-900">
                  {formatCount(performanceMetrics.viralBenchmark)}
                </div>
              </div>
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
        {aiInsights.length > 0 && (
          <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
            <h3 className="text-xs font-semibold text-neutral-500 mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {language === "ko" ? "AI 인사이트" : "AI Insight"}
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              {aiInsights[0]}
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
  merchandise_type?: "album" | "photocard" | "lightstick" | "apparel" | "accessory" | "other" | null;
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
  merchandiseItems,
  isLoadingMerchandise,
}: {
  audioAsset: UploadedAsset | null;
  imageAssets: UploadedAsset[];
  onAudioChange: (asset: UploadedAsset | null) => void;
  onImagesChange: (assets: UploadedAsset[]) => void;
  campaignAssets: CampaignAsset[];
  isLoadingAssets: boolean;
  merchandiseItems: MerchandiseItemType[];
  isLoadingMerchandise: boolean;
}) {
  const { language } = useI18n();
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Filter campaign assets by type
  const audioAssets = useMemo(
    () => campaignAssets.filter((a) => a.type === "audio"),
    [campaignAssets]
  );
  const imageAssetsFromCampaign = useMemo(
    () => campaignAssets.filter((a) => a.type === "image"),
    [campaignAssets]
  );
  const goodsAssets = useMemo(
    () => campaignAssets.filter((a) => a.type === "goods"),
    [campaignAssets]
  );
  const videoAssets = useMemo(
    () => campaignAssets.filter((a) => a.type === "video"),
    [campaignAssets]
  );

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onAudioChange({
        id: crypto.randomUUID(),
        type: "audio",
        name: file.name,
        url,
        file,
      });
    }
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

  // Get merchandise type label
  const getMerchandiseLabel = (type: string | null | undefined): string => {
    const labels: Record<string, { ko: string; en: string }> = {
      album: { ko: "앨범", en: "Album" },
      photocard: { ko: "포토카드", en: "Photocard" },
      lightstick: { ko: "응원봉", en: "Lightstick" },
      apparel: { ko: "의류", en: "Apparel" },
      accessory: { ko: "액세서리", en: "Accessory" },
      other: { ko: "기타", en: "Other" },
    };
    if (!type || !labels[type]) return language === "ko" ? "굿즈" : "Goods";
    return language === "ko" ? labels[type].ko : labels[type].en;
  };

  // Calculate asset counts for summary
  const assetCounts = {
    audio: audioAssets.length,
    image: imageAssetsFromCampaign.length,
    video: videoAssets.length,
    goods: goodsAssets.length,
    merchandise: merchandiseItems.length,
    total: campaignAssets.length + merchandiseItems.length,
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
            {assetCounts.goods > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-neutral-200">
                <Library className="h-2.5 w-2.5 mr-1" />
                {language === "ko" ? "굿즈" : "Goods"} {assetCounts.goods}
              </Badge>
            )}
            {assetCounts.merchandise > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-neutral-200">
                <Library className="h-2.5 w-2.5 mr-1" />
                {language === "ko" ? "머천다이즈" : "Merchandise"} {assetCounts.merchandise}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Music Section */}
      <div>
        <Label className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
          <Music className="h-3 w-3" />
          {language === "ko" ? "음악" : "Music"}
        </Label>
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
            <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-neutral-200 rounded-lg cursor-pointer hover:border-neutral-300 transition-colors">
              <Upload className="h-4 w-4 text-neutral-400" />
              <span className="text-sm text-neutral-500">
                {language === "ko" ? "오디오 파일 업로드" : "Upload audio file"}
              </span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioUpload}
              />
            </label>
          </div>
        )}
      </div>

      {/* Reference Images Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs text-neutral-500 flex items-center gap-1">
            <Images className="h-3 w-3" />
            {language === "ko" ? "레퍼런스 이미지" : "Reference Images"}
            <span className="text-neutral-400">({imageAssets.length}/10)</span>
          </Label>
          {imageAssetsFromCampaign.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-neutral-500"
              onClick={() => setShowImagePicker(!showImagePicker)}
            >
              <Library className="h-3 w-3 mr-1" />
              {language === "ko" ? "캠페인에서 선택" : "From Campaign"}
            </Button>
          )}
        </div>

        {/* Campaign Image Picker */}
        {showImagePicker && imageAssetsFromCampaign.length > 0 && (
          <div className="mb-3 p-3 border border-neutral-200 rounded-lg bg-neutral-50">
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
      </div>

      {/* Merchandise/Goods Section - Shows both campaign goods assets AND separate merchandise items */}
      {(goodsAssets.length > 0 || merchandiseItems.length > 0) && (
        <div>
          <Label className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
            <Library className="h-3 w-3" />
            {language === "ko" ? "굿즈/머천다이즈" : "Merchandise"}
            <span className="text-neutral-400">
              ({goodsAssets.length + merchandiseItems.length})
            </span>
          </Label>

          {/* Artist Merchandise Items (from MerchandiseItem table) */}
          {merchandiseItems.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-neutral-500 mb-2">
                {language === "ko" ? "아티스트 머천다이즈" : "Artist Merchandise"}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {merchandiseItems.map((item) => {
                  const isSelected = imageAssets.some((a) => a.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isSelected || imageAssets.length >= 10) return;
                        onImagesChange([
                          ...imageAssets,
                          {
                            id: item.id,
                            type: "image",
                            name: item.name,
                            url: item.s3_url,
                            fromCampaign: true,
                          },
                        ]);
                      }}
                      disabled={isSelected || imageAssets.length >= 10}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                        isSelected
                          ? "border-neutral-900 opacity-70"
                          : "border-neutral-200 hover:border-neutral-400"
                      )}
                    >
                      <img
                        src={item.thumbnail_url || item.s3_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                        <span className="text-[9px] text-white font-medium">
                          {getMerchandiseLabel(item.type)}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campaign Goods Assets (from Asset table with type=goods) */}
          {goodsAssets.length > 0 && (
            <div>
              {merchandiseItems.length > 0 && (
                <p className="text-[10px] text-neutral-500 mb-2">
                  {language === "ko" ? "캠페인 굿즈" : "Campaign Goods"}
                </p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {goodsAssets.map((asset) => {
                  const isSelected = imageAssets.some((a) => a.id === asset.id);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => handleSelectCampaignImage(asset)}
                      disabled={isSelected || imageAssets.length >= 10}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                        isSelected
                          ? "border-neutral-900 opacity-70"
                          : "border-neutral-200 hover:border-neutral-400"
                      )}
                    >
                      <img
                        src={asset.s3_url}
                        alt={asset.original_filename}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                        <span className="text-[9px] text-white font-medium">
                          {getMerchandiseLabel(asset.merchandise_type)}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-neutral-400 mt-2">
            {language === "ko"
              ? "굿즈 이미지를 클릭하여 레퍼런스로 추가"
              : "Click merchandise to add as reference"}
          </p>
        </div>
      )}

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
    </div>
  );
}

// ============================================================================
// Create Method Cards
// ============================================================================

function CreateMethodCards({
  selectedMethod,
  onSelectMethod,
  onGenerate,
  onCompose,
  isGenerating,
}: {
  selectedMethod: "ai" | "compose" | null;
  onSelectMethod: (method: "ai" | "compose") => void;
  onGenerate: () => void;
  onCompose: () => void;
  isGenerating: boolean;
}) {
  const { language } = useI18n();
  const { analyze } = useWorkflowStore();

  // Highlight recommended method based on selected idea
  const recommendedMethod = analyze.selectedIdea?.type === "compose" ? "compose" : "ai";

  return (
    <div className="space-y-3">
      {/* AI Generated Video */}
      <div
        onClick={() => onSelectMethod("ai")}
        className={cn(
          "border rounded-lg p-4 cursor-pointer transition-all",
          selectedMethod === "ai"
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-200 hover:border-neutral-300"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              selectedMethod === "ai" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
            )}
          >
            <Video className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-neutral-900">
                {language === "ko" ? "AI 생성 영상" : "AI Generated Video"}
              </h4>
              <Badge variant="outline" className="text-[9px] border-neutral-300">
                Veo3
              </Badge>
              {recommendedMethod === "ai" && (
                <Badge className="text-[9px] bg-neutral-900 text-white">
                  {language === "ko" ? "추천" : "Recommended"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              {language === "ko"
                ? "프롬프트를 기반으로 AI가 완전한 영상을 생성합니다"
                : "AI creates a complete video from your prompt"}
            </p>
            <p className="text-[10px] text-neutral-400">
              {language === "ko"
                ? "추천: 독창적인 장면, 복잡한 안무, 시각 효과"
                : "Best for: Original scenes, complex choreography, visual effects"}
            </p>
          </div>
          {selectedMethod === "ai" && (
            <Check className="h-5 w-5 text-neutral-900 shrink-0" />
          )}
        </div>

        {selectedMethod === "ai" && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
              disabled={isGenerating}
              className="w-full bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                  {language === "ko" ? "생성 중..." : "Generating..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {language === "ko" ? "Veo3로 생성하기" : "Generate with Veo3"}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Compose Video */}
      <div
        onClick={() => onSelectMethod("compose")}
        className={cn(
          "border rounded-lg p-4 cursor-pointer transition-all",
          selectedMethod === "compose"
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-200 hover:border-neutral-300"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              selectedMethod === "compose" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
            )}
          >
            <Images className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-neutral-900">
                {language === "ko" ? "컴포즈 영상" : "Compose Video"}
              </h4>
              {recommendedMethod === "compose" && (
                <Badge className="text-[9px] bg-neutral-900 text-white">
                  {language === "ko" ? "추천" : "Recommended"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              {language === "ko"
                ? "이미지들을 음악에 맞춰 슬라이드쇼 형태로 조합합니다"
                : "Combine images into a slideshow synced with music"}
            </p>
            <p className="text-[10px] text-neutral-400">
              {language === "ko"
                ? "추천: 포토 몽타주, 비하인드 씬, 제품 쇼케이스"
                : "Best for: Photo montages, behind-the-scenes, product showcases"}
            </p>
          </div>
          {selectedMethod === "compose" && (
            <Check className="h-5 w-5 text-neutral-900 shrink-0" />
          )}
        </div>

        {selectedMethod === "compose" && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onCompose();
              }}
              disabled={isGenerating}
              className="w-full bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {isGenerating ? (
                <>
                  <Images className="h-4 w-4 mr-2 animate-pulse" />
                  {language === "ko" ? "준비 중..." : "Preparing..."}
                </>
              ) : (
                <>
                  <Images className="h-4 w-4 mr-2" />
                  {language === "ko" ? "컴포즈 시작" : "Start Compose"}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CreatePage() {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

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

  // Fetch assets for selected campaign
  const { data: assetsData, isLoading: isLoadingAssets } = useAssets(
    selectedCampaignId,
    { page_size: 100 }
  );
  const campaignAssets = useMemo(() => assetsData?.items || [], [assetsData]);

  // Get artist_id from selected campaign to fetch merchandise
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId),
    [campaigns, selectedCampaignId]
  );

  // Fetch merchandise items for the campaign's artist
  const { data: merchandiseData, isLoading: isLoadingMerchandise } = useMerchandise({
    artist_id: selectedCampaign?.artist_id,
    page_size: 50,
    active_only: true,
  });
  const merchandiseItems = useMemo(() => merchandiseData?.items || [], [merchandiseData]);

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
  const [selectedMethod, setSelectedMethod] = useState<"ai" | "compose" | null>(null);
  const [audioAsset, setAudioAsset] = useState<UploadedAsset | null>(null);
  const [imageAssets, setImageAssets] = useState<UploadedAsset[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showComposeFlow, setShowComposeFlow] = useState(false);

  // Personalization modal state
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false);
  const [personalizedPrompt, setPersonalizedPrompt] = useState<{
    prompt: string;
    metadata: { duration: string; aspectRatio: string; style: string };
  } | null>(null);

  // Auto-select method based on selected idea
  useEffect(() => {
    if (analyze.selectedIdea) {
      setSelectedMethod(analyze.selectedIdea.type === "compose" ? "compose" : "ai");
    }
  }, [analyze.selectedIdea]);

  // Handle AI generation
  const handleGenerate = useCallback(async () => {
    console.log("[Veo3] handleGenerate called", {
      selectedCampaignId,
      audioAsset: audioAsset?.id,
      imageAssetsCount: imageAssets.length,
    });

    if (!selectedCampaignId) {
      console.log("[Veo3] No campaign selected");
      toast.warning(
        language === "ko" ? "캠페인 필요" : "Campaign needed",
        language === "ko" ? "먼저 캠페인을 선택하세요" : "Please select a campaign first"
      );
      return;
    }

    // Check for audio asset - required for any video generation
    if (!audioAsset) {
      console.log("[Veo3] No audio asset selected");
      toast.warning(
        language === "ko" ? "음악 필요" : "Music required",
        language === "ko" ? "영상 생성을 위해 음악을 선택하세요" : "Please select music for video generation"
      );
      return;
    }

    // MANDATORY: Reference image is required for Veo3 I2V generation
    // User must provide at least one image
    if (imageAssets.length === 0) {
      console.log("[Veo3] No images selected - I2V mode requires at least one reference image");
      toast.warning(
        language === "ko" ? "이미지 필요" : "Image required",
        language === "ko" ? "Veo3 영상 생성을 위해 최소 1개의 레퍼런스 이미지가 필요합니다. 이미지를 추가해주세요." : "At least one reference image is required for Veo3 video generation. Please add an image."
      );
      return;
    }

    // Images are attached, show personalization modal
    console.log("[Veo3] Images attached, showing personalization modal");
    console.log("[Veo3] Image URLs:", imageAssets.map(a => a.url));
    setShowPersonalizeModal(true);
    console.log("[Veo3] showPersonalizeModal set to true");
  }, [selectedCampaignId, audioAsset, imageAssets.length, analyze, router, language, toast]);

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
    async (prompt: string, metadata: { duration: string; aspectRatio: string; style: string }) => {
      console.log("[Veo3] handlePersonalizationComplete called", {
        prompt: prompt.slice(0, 100) + "...",
        metadata,
        audioAsset: audioAsset?.id,
        imageAssetsCount: imageAssets.length,
      });

      if (!audioAsset) {
        console.log("[Veo3] No audio asset in personalization complete");
        toast.warning(
          language === "ko" ? "음악 필요" : "Music required",
          language === "ko" ? "영상 생성을 위해 음악을 선택하세요" : "Please select music for video generation"
        );
        return;
      }

      setPersonalizedPrompt({ prompt, metadata });
      setShowPersonalizeModal(false);
      setIsGenerating(true);

      try {
        console.log("[Veo3] ═══════════════════════════════════════════════════════");
        console.log("[Veo3] Starting video generation via API...");
        console.log("[Veo3] Total image assets:", imageAssets.length);

        // Get first image for I2V if available
        const firstImage = imageAssets[0];

        // Prepare image data for the API
        let previewImageBase64: string | undefined;
        let previewImageUrl: string | undefined;

        if (firstImage) {
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
        } else {
          console.log("[Veo3] No images provided - will use T2V mode");
        }

        console.log("[Veo3] Image mode summary:", {
          hasBase64: !!previewImageBase64,
          hasUrl: !!previewImageUrl,
          mode: previewImageBase64 ? "LOCAL_UPLOAD" : previewImageUrl ? "CAMPAIGN_URL" : "TEXT_ONLY",
        });

        const apiParams = {
          prompt: prompt.slice(0, 100) + "...",
          audio_asset_id: audioAsset.id,
          aspect_ratio: metadata.aspectRatio,
          duration_seconds: parseInt(metadata.duration) || 5,
          reference_style: metadata.style || undefined,
          enable_i2v: !!(previewImageBase64 || previewImageUrl),
          image_description: firstImage ? `Reference image for video generation` : undefined,
          has_preview_image_base64: !!previewImageBase64,
          has_preview_image_url: !!previewImageUrl,
          preview_image_url_preview: previewImageUrl?.slice(0, 60),
          reference_image_id: firstImage?.fromCampaign ? firstImage.id : undefined,
        };
        console.log("[Veo3] API request params:", apiParams);

        const response = await videoApi.create(selectedCampaignId, {
          prompt,
          audio_asset_id: audioAsset.id,
          aspect_ratio: metadata.aspectRatio,
          duration_seconds: parseInt(metadata.duration) || 5,
          reference_style: metadata.style || undefined,
          // Enable I2V if image is available
          enable_i2v: !!(previewImageBase64 || previewImageUrl),
          image_description: firstImage ? `Reference image for video generation` : undefined,
          // Pass the actual image data
          preview_image_base64: previewImageBase64,
          preview_image_url: previewImageUrl,
          reference_image_id: firstImage?.fromCampaign ? firstImage.id : undefined,
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

  // Build context for personalization modal
  const personalizationContext = useMemo(() => {
    const { selectedIdea, campaignName, hashtags: analyzeHashtags } = analyze;
    const { keywords, selectedHashtags, performanceMetrics, aiInsights } = useWorkflowStore.getState().discover;

    return {
      selectedIdea: selectedIdea || null,
      hashtags: [...new Set([...selectedHashtags, ...analyzeHashtags])],
      keywords,
      campaignName: campaignName || selectedCampaignName,
      artistName: selectedCampaign?.artist_name,
      performanceMetrics: performanceMetrics || null,
      aiInsights: aiInsights || [],
    };
  }, [analyze, selectedCampaignName, selectedCampaign]);

  // Handle compose - show inline compose flow instead of navigating
  const handleCompose = useCallback(() => {
    if (!selectedCampaignId) {
      toast.warning(
        language === "ko" ? "캠페인 필요" : "Campaign needed",
        language === "ko" ? "먼저 캠페인을 선택하세요" : "Please select a campaign first"
      );
      return;
    }

    // Show inline compose flow instead of navigating to a new page
    setShowComposeFlow(true);
  }, [selectedCampaignId, language, toast]);

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

  // If compose flow is active, show the inline compose flow WITH partially disabled WorkflowHeader
  if (showComposeFlow && selectedCampaignId) {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* WorkflowHeader - can go back to Analyze, but cannot go forward to Processing */}
        <WorkflowHeader
          onBack={goToAnalyze}
          disableForward={true}
          subtitle={language === "ko" ? "컴포즈 영상 생성 중..." : "Creating Compose Video..."}
        />
        {/* Inline Compose Flow - has its own step navigation */}
        <InlineComposeFlow
          campaignId={selectedCampaignId}
          campaignName={selectedCampaignName}
          onBack={() => setShowComposeFlow(false)}
        />
      </div>
    );
  }

  return (
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
            {/* Step Progress Indicator */}
            <StepProgressIndicator
              status={{
                campaignSelected: !!selectedCampaignId,
                methodSelected: !!selectedMethod,
                musicSelected: !!audioAsset,
                imageSelected: imageAssets.length > 0,
              }}
              selectedMethod={selectedMethod}
            />

            {/* Step 1: Campaign Selector */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium",
                  selectedCampaignId
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-200 text-neutral-600"
                )}>
                  {selectedCampaignId ? <Check className="h-3 w-3" /> : "1"}
                </div>
                <Label className="text-sm font-medium text-neutral-700">
                  {t.selectCampaign}
                </Label>
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

            {/* Step 2: Create Methods */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium",
                  selectedMethod
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-200 text-neutral-600"
                )}>
                  {selectedMethod ? <Check className="h-3 w-3" /> : "2"}
                </div>
                <Label className="text-sm font-medium text-neutral-700">
                  {language === "ko" ? "생성 방식 선택" : "Choose Creation Method"}
                </Label>
              </div>
              <CreateMethodCards
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
                onGenerate={handleGenerate}
                onCompose={handleCompose}
                isGenerating={isGenerating}
              />
            </div>

            {/* Step 3: Asset Upload */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium",
                  selectedMethod === "ai"
                    ? (audioAsset && imageAssets.length > 0 ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-600")
                    : (audioAsset ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-600")
                )}>
                  {selectedMethod === "ai"
                    ? (audioAsset && imageAssets.length > 0 ? <Check className="h-3 w-3" /> : "3")
                    : (audioAsset ? <Check className="h-3 w-3" /> : "3")
                  }
                </div>
                <Label className="text-sm font-medium text-neutral-700">
                  {language === "ko" ? "에셋 선택" : "Select Assets"}
                </Label>
                <span className="text-xs text-neutral-400">
                  ({selectedMethod === "ai"
                    ? (language === "ko" ? "음악 + 이미지 필수" : "Music + Image required")
                    : (language === "ko" ? "음악 필수" : "Music required")
                  })
                </span>
              </div>
              <AssetUploadSection
                audioAsset={audioAsset}
                imageAssets={imageAssets}
                onAudioChange={setAudioAsset}
                onImagesChange={setImageAssets}
                campaignAssets={campaignAssets}
                isLoadingAssets={isLoadingAssets}
                merchandiseItems={merchandiseItems}
                isLoadingMerchandise={isLoadingMerchandise}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Personalize Prompt Modal - Shows when user clicks Veo3 with images attached */}
      <PersonalizePromptModal
        open={showPersonalizeModal}
        onOpenChange={setShowPersonalizeModal}
        images={imageAssets.map((asset) => ({
          url: asset.url,
          type: asset.fromCampaign ? "reference" : "reference",
          name: asset.name,
        }))}
        context={personalizationContext}
        onComplete={handlePersonalizationComplete}
      />
    </div>
  );
}
