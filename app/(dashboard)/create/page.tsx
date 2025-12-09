"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { useCampaigns, useAssets } from "@/lib/queries";
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
import { InfoButton } from "@/components/ui/info-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

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
  imageSelected: boolean;
}

function StepProgressIndicator({
  status,
  selectedMethod,
}: {
  status: StepStatus;
  selectedMethod: "ai" | null;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Determine current step and next action
  // Assets are now optional, so step 3 is always "done" once method is selected
  const getCurrentStep = (): number => {
    if (!status.campaignSelected) return 1;
    if (!status.methodSelected) return 2;
    return 3; // Ready to go (assets are optional)
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
        ? "AI 생성 방식을 선택하세요"
        : "Select AI video generation method";
    }
    // Ready to generate (assets are optional)
    return isKorean
      ? "준비 완료! 'Veo3로 생성하기' 버튼을 클릭하세요"
      : "Ready! Click 'Generate with Veo3' to create";
  };

  // Build steps - assets are now optional extras
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
}: {
  audioAsset: UploadedAsset | null;
  imageAssets: UploadedAsset[];
  onAudioChange: (asset: UploadedAsset | null) => void;
  onImagesChange: (assets: UploadedAsset[]) => void;
  campaignAssets: CampaignAsset[];
  isLoadingAssets: boolean;
}) {
  const { language } = useI18n();
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [musicExpanded, setMusicExpanded] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);

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
// Create Method Cards
// ============================================================================

function CreateMethodCards({
  selectedMethod,
  onSelectMethod,
  onGenerate,
  isGenerating,
}: {
  selectedMethod: "ai" | null;
  onSelectMethod: (method: "ai") => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const { language } = useI18n();
  const { analyze } = useWorkflowStore();

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
  const { analyze, setAnalyzeCampaign, startContentType } = useWorkflowStore(
    useShallow((state) => ({
      analyze: state.analyze,
      setAnalyzeCampaign: state.setAnalyzeCampaign,
      startContentType: state.start.contentType,
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

  // Local state - Initialize selectedMethod based on startContentType from Start stage
  const [selectedMethod, setSelectedMethod] = useState<"ai" | null>(() => {
    // Use startContentType from Start stage selection (AI Video only on this page)
    if (startContentType === "ai_video") return "ai";
    return null;
  });
  const [audioAsset, setAudioAsset] = useState<UploadedAsset | null>(null);
  const [imageAssets, setImageAssets] = useState<UploadedAsset[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Personalization modal state
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false);
  const [personalizedPrompt, setPersonalizedPrompt] = useState<{
    prompt: string;
    metadata: { duration: string; aspectRatio: string; style: string };
  } | null>(null);

  // Sync selectedMethod when startContentType changes (e.g., user navigated back and changed it)
  useEffect(() => {
    if (startContentType === "ai_video") {
      setSelectedMethod("ai");
    }
  }, [startContentType]);

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

    // Check if we have a prompt from the analyze step
    const hasPrompt =
      analyze.selectedIdea?.optimizedPrompt ||
      analyze.optimizedPrompt ||
      analyze.userIdea ||
      analyze.selectedIdea?.description;

    if (!hasPrompt) {
      console.log("[Veo3] No prompt available from analyze step");
      toast.warning(
        language === "ko" ? "프롬프트 필요" : "Prompt needed",
        language === "ko"
          ? "먼저 Analyze 단계에서 아이디어를 선택하거나 프롬프트를 입력하세요"
          : "Please select an idea or enter a prompt in the Analyze step first"
      );
      return;
    }

    // Proceed to personalization modal
    console.log("[Veo3] Proceeding to personalization modal");
    console.log("[Veo3] Audio:", audioAsset?.name || "None");
    console.log("[Veo3] Images:", imageAssets.length > 0 ? imageAssets.map(a => a.url) : "None");
    console.log("[Veo3] Prompt source:",
      analyze.selectedIdea?.optimizedPrompt ? "selectedIdea.optimizedPrompt" :
      analyze.optimizedPrompt ? "analyze.optimizedPrompt" :
      analyze.userIdea ? "analyze.userIdea" : "selectedIdea.description"
    );
    setShowPersonalizeModal(true);
    console.log("[Veo3] showPersonalizeModal set to true");
  }, [selectedCampaignId, audioAsset, imageAssets.length, analyze, language, toast]);

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

      // Music and images are now optional - proceed with generation
      setPersonalizedPrompt({ prompt, metadata });
      setShowPersonalizeModal(false);
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

  // Build context for personalization modal
  const personalizationContext = useMemo(() => {
    const { selectedIdea, campaignName, hashtags: analyzeHashtags, optimizedPrompt, userIdea } = analyze;
    const { keywords, selectedHashtags, performanceMetrics, aiInsights } = useWorkflowStore.getState().discover;

    return {
      selectedIdea: selectedIdea || null,
      hashtags: [...new Set([...selectedHashtags, ...analyzeHashtags])],
      keywords,
      campaignName: campaignName || selectedCampaignName,
      artistName: selectedCampaign?.artist_name,
      performanceMetrics: performanceMetrics || null,
      aiInsights: aiInsights || null,
      optimizedPrompt: optimizedPrompt || userIdea || "", // Pass the analyzed prompt or userIdea as fallback
    };
  }, [analyze, selectedCampaignName, selectedCampaign]);

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
                <InfoButton
                  content={language === "ko"
                    ? "생성된 영상이 저장될 캠페인을 선택하세요. 캠페인에 업로드된 에셋(음악, 이미지)을 영상 제작에 활용할 수 있습니다. 분석 단계에서 선택한 캠페인이 기본 선택됩니다."
                    : "Select the campaign where your video will be saved. You can use assets (music, images) uploaded to the campaign. The campaign from Analyze step is pre-selected."}
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

            {/* Step 2: Create Methods - Pre-selected from Start stage */}
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
                {/* Show pre-selected indicator from Start stage */}
                {startContentType === "ai_video" && (
                  <Badge variant="outline" className="text-[10px] border-neutral-300 text-neutral-500">
                    {language === "ko" ? "Start에서 AI Video 선택됨" : "AI Video selected from Start"}
                  </Badge>
                )}
                <InfoButton
                  content={language === "ko"
                    ? "Start 단계에서 선택한 콘텐츠 타입이 자동 선택됩니다. 필요시 변경할 수 있습니다."
                    : "Content type selected at Start stage is auto-selected. You can change it if needed."}
                  side="bottom"
                />
              </div>
              <CreateMethodCards
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            </div>

            {/* Step 3: Asset Upload (Optional) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium",
                  (audioAsset || imageAssets.length > 0) ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-600"
                )}>
                  {(audioAsset || imageAssets.length > 0) ? <Check className="h-3 w-3" /> : "3"}
                </div>
                <Label className="text-sm font-medium text-neutral-700">
                  {language === "ko" ? "에셋 선택" : "Select Assets"}
                </Label>
                <InfoButton
                  content={language === "ko"
                    ? "영상 제작에 사용할 음악과 이미지를 선택합니다. 새로 업로드할 수 있습니다. 음악과 이미지는 선택사항입니다."
                    : "Select music and images for video creation. Upload new files. Music and images are optional."}
                  side="bottom"
                />
                <span className="text-xs text-neutral-400">
                  ({language === "ko" ? "선택사항" : "Optional"})
                </span>
              </div>
              <AssetUploadSection
                audioAsset={audioAsset}
                imageAssets={imageAssets}
                onAudioChange={setAudioAsset}
                onImagesChange={setImageAssets}
                campaignAssets={[]}
                isLoadingAssets={false}
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
    </TooltipProvider>
  );
}
