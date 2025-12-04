"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useAssets } from "@/lib/queries";
import { useToast } from "@/components/ui/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  composeApi,
  ScriptGenerationResponse,
  ImageCandidate,
  AudioMatch,
  AudioAnalysisResponse,
  TikTokSEO,
} from "@/lib/compose-api";
import {
  FileText,
  Image as ImageIcon,
  Music,
  Film,
  Check,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Hash,
  Play,
  ExternalLink,
  Eye,
  Zap,
  Trophy,
  Sparkles,
} from "lucide-react";

// Step Components
import { ComposeScriptStep } from "./ComposeScriptStep";
import { ComposeImageStep } from "./ComposeImageStep";
import { ComposeMusicStep } from "./ComposeMusicStep";
import { ComposeEffectStep } from "./ComposeEffectStep";

// ============================================================================
// Types
// ============================================================================

type ComposeStep = 1 | 2 | 3 | 4;
type ImageSourceMode = "assets_only" | "search_only" | "mixed";

interface InlineComposeFlowProps {
  campaignId: string;
  campaignName: string;
  onBack: () => void;
}

// ============================================================================
// Context Panel Component
// ============================================================================

function ComposeContextPanel() {
  const { language } = useI18n();

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

  const { selectedIdea, optimizedPrompt, hashtags: analyzeHashtags } = analyze;

  // Combine hashtags
  const allHashtags = useMemo(() => {
    const combined = new Set([...selectedHashtags, ...analyzeHashtags]);
    return Array.from(combined).slice(0, 8);
  }, [selectedHashtags, analyzeHashtags]);

  const formatCount = (num: number | null | undefined): string => {
    if (num === null || num === undefined || num === 0) return "-";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatPercent = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

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
                  selectedIdea.type === "compose"
                    ? "border-neutral-900 text-neutral-900"
                    : "border-neutral-500 text-neutral-500"
                )}
              >
                Compose
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
            <p className="text-sm text-neutral-700 leading-relaxed line-clamp-4">
              {optimizedPrompt}
            </p>
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

        {/* Keywords */}
        {keywords.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
              {language === "ko" ? "키워드" : "Keywords"}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {keywords.slice(0, 6).map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  className="text-xs border-neutral-300 text-neutral-600"
                >
                  {kw}
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
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// Step Navigation Component
// ============================================================================

const STEPS = [
  { step: 1 as const, key: "script", icon: FileText, labelKo: "스크립트", labelEn: "Script" },
  { step: 2 as const, key: "images", icon: ImageIcon, labelKo: "이미지", labelEn: "Images" },
  { step: 3 as const, key: "music", icon: Music, labelKo: "음악", labelEn: "Music" },
  { step: 4 as const, key: "render", icon: Film, labelKo: "효과 & 생성", labelEn: "Effects" },
];

function StepNavigation({
  currentStep,
  scriptData,
  selectedImages,
  selectedAudio,
  onStepClick,
}: {
  currentStep: ComposeStep;
  scriptData: ScriptGenerationResponse | null;
  selectedImages: ImageCandidate[];
  selectedAudio: AudioMatch | null;
  onStepClick: (step: ComposeStep) => void;
}) {
  const { language } = useI18n();

  const isStepComplete = (step: ComposeStep): boolean => {
    switch (step) {
      case 1: return scriptData !== null;
      case 2: return selectedImages.length >= 3;
      case 3: return selectedAudio !== null;
      case 4: return false; // Never "complete" - this is the final step
      default: return false;
    }
  };

  return (
    <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-lg">
      {STEPS.map((step) => {
        const Icon = step.icon;
        const isActive = step.step === currentStep;
        const isComplete = isStepComplete(step.step);
        const isAccessible = step.step <= currentStep || isComplete;

        return (
          <button
            key={step.step}
            onClick={() => isAccessible && onStepClick(step.step)}
            disabled={!isAccessible}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
              isActive
                ? "bg-white text-neutral-900 shadow-sm"
                : isComplete
                ? "text-neutral-700 hover:bg-neutral-50"
                : "text-neutral-400 cursor-not-allowed"
            )}
          >
            {isComplete ? (
              <Check className="w-4 h-4 text-neutral-900" />
            ) : (
              <Icon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {language === "ko" ? step.labelKo : step.labelEn}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InlineComposeFlow({
  campaignId,
  campaignName,
  onBack,
}: InlineComposeFlowProps) {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

  const { discover, analyze, setCreateType } = useWorkflowStore(
    useShallow((state) => ({
      discover: state.discover,
      analyze: state.analyze,
      setCreateType: state.setCreateType,
    }))
  );

  // Fetch campaign assets
  const { data: imageAssetsData, isLoading: imageAssetsLoading } = useAssets(campaignId, {
    type: "image",
    page_size: 100,
  });
  const { data: audioAssetsData, isLoading: audioAssetsLoading } = useAssets(campaignId, {
    type: "audio",
    page_size: 100,
  });

  // Convert campaign assets to ImageCandidate format
  const assetImages: ImageCandidate[] = useMemo(() => {
    const items = imageAssetsData?.items || [];
    return items.map((asset, idx) => ({
      id: `asset-${asset.id}`,
      sourceUrl: asset.s3_url,
      thumbnailUrl: asset.thumbnail_url || asset.s3_url,
      sourceTitle: asset.original_filename,
      sourceDomain: "Campaign Asset",
      width: (asset.metadata?.width as number) || 1080,
      height: (asset.metadata?.height as number) || 1920,
      isSelected: false,
      sortOrder: idx,
      qualityScore: 0.9,
    }));
  }, [imageAssetsData]);

  // ========================================
  // Core State
  // ========================================
  const [currentStep, setCurrentStep] = useState<ComposeStep>(1);
  const [error, setError] = useState("");

  // Step 1: Script state
  const [prompt, setPrompt] = useState(
    analyze.optimizedPrompt || analyze.selectedIdea?.description || ""
  );
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptData, setScriptData] = useState<ScriptGenerationResponse | null>(null);

  // Keyword state
  const [editableKeywords, setEditableKeywords] = useState<string[]>([
    ...discover.keywords,
  ]);
  const [selectedSearchKeywords, setSelectedSearchKeywords] = useState<Set<string>>(
    new Set(discover.keywords)
  );

  // Step 2: Images state
  const [searchingImages, setSearchingImages] = useState(false);
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageCandidate[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  // Default to "search_only" so user sees web search results where auto-selection happens
  // If campaign has assets, will switch to "mixed" after assets load
  const [imageSourceMode, setImageSourceMode] = useState<ImageSourceMode>("search_only");

  // Step 3: Music state
  const [matchingMusic, setMatchingMusic] = useState(false);
  const [audioMatches, setAudioMatches] = useState<AudioMatch[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<AudioMatch | null>(null);
  const [audioStartTime, setAudioStartTime] = useState<number>(0);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResponse | null>(null);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);

  // Step 4: Render state
  const [effectPreset, setEffectPreset] = useState("zoom_beat");
  const [rendering, setRendering] = useState(false);

  // TikTok SEO state
  const [tiktokSEO, setTiktokSEO] = useState<TikTokSEO | null>(null);

  // ========================================
  // Effects
  // ========================================

  // Set create type on mount
  useEffect(() => {
    setCreateType("compose");
  }, [setCreateType]);

  // Switch to "mixed" mode when campaign assets become available
  useEffect(() => {
    if (assetImages.length > 0 && imageSourceMode === "search_only") {
      setImageSourceMode("mixed");
    }
  }, [assetImages.length, imageSourceMode]);

  // ========================================
  // Step 1: Script Generation
  // ========================================

  const handleGenerateScript = async () => {
    if (!prompt.trim()) {
      setError(language === "ko" ? "프롬프트를 입력하세요" : "Please enter a prompt");
      return;
    }

    setError("");
    setGeneratingScript(true);

    try {
      const result = await composeApi.generateScript({
        campaignId,
        artistName: analyze.campaignName || "Artist",
        trendKeywords: editableKeywords,
        userPrompt: prompt.trim(),
        targetDuration: 0,
      });

      setScriptData(result);
      if (result.tiktokSEO) {
        setTiktokSEO(result.tiktokSEO);
      }

      // Merge AI keywords with user keywords
      const userKeywords = [...editableKeywords];
      const aiKeywords = (result.searchKeywords || []).filter(
        (kw) => !editableKeywords.some(
          (existing) => existing.toLowerCase() === kw.toLowerCase()
        )
      );
      const mergedKeywords = [...userKeywords, ...aiKeywords];
      setEditableKeywords(mergedKeywords);

      // Generate ID for this compose session
      const newGenerationId = `compose-${Date.now()}`;
      setGenerationId(newGenerationId);

      // Auto-advance to step 2
      setCurrentStep(2);

      // Auto-search images if keywords exist
      if (userKeywords.length > 0) {
        await handleSearchImages(userKeywords, newGenerationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script generation failed");
    } finally {
      setGeneratingScript(false);
    }
  };

  // ========================================
  // Step 2: Image Search
  // ========================================

  const handleSearchImages = async (keywords?: string[], genId?: string) => {
    const searchKeywords = keywords || Array.from(selectedSearchKeywords);
    const targetGenId = genId || generationId;

    if (searchKeywords.length === 0 || !targetGenId) return;

    setSearchingImages(true);
    setError("");

    try {
      const result = await composeApi.searchImages({
        generationId: targetGenId,
        keywords: searchKeywords,
        maxImages: 30,
      });

      setImageCandidates(result.candidates);

      // Auto-select high quality images
      const autoSelected = result.candidates
        .filter((img) => (img.qualityScore || 0) > 0.5)
        .slice(0, Math.min(6, result.candidates.length));

      setSelectedImages(autoSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image search failed");
    } finally {
      setSearchingImages(false);
    }
  };

  const toggleImageSelection = (image: ImageCandidate) => {
    setSelectedImages((prev) => {
      const exists = prev.find((img) => img.id === image.id);
      if (exists) return prev.filter((img) => img.id !== image.id);
      if (prev.length >= 10) return prev;
      return [...prev, image];
    });
  };

  // ========================================
  // Step 3: Music Matching
  // ========================================

  const handleMatchMusic = async () => {
    if (!scriptData) return;

    setMatchingMusic(true);
    setError("");

    try {
      const result = await composeApi.matchMusic({
        campaignId,
        vibe: scriptData.vibe,
        bpmRange: scriptData.suggestedBpmRange,
        minDuration: 10,
      });

      setAudioMatches(result.matches);
      if (result.matches.length > 0) {
        handleSelectAudio(result.matches[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Music matching failed");
    } finally {
      setMatchingMusic(false);
    }
  };

  const handleSelectAudio = async (audio: AudioMatch) => {
    setSelectedAudio(audio);
    setAudioAnalysis(null);
    setAudioStartTime(0);
    setAnalyzingAudio(true);

    try {
      const targetDuration = scriptData?.script?.totalDuration || 15;
      const analysis = await composeApi.analyzeAudioBestSegment(audio.id, targetDuration);
      setAudioAnalysis(analysis);
      setAudioStartTime(analysis.suggestedStartTime);
    } catch (err) {
      console.warn("Audio analysis failed:", err);
      setAudioStartTime(0);
    } finally {
      setAnalyzingAudio(false);
    }
  };

  // Auto-match music when entering step 3
  useEffect(() => {
    if (currentStep === 3 && audioMatches.length === 0 && scriptData) {
      handleMatchMusic();
    }
  }, [currentStep]);

  // ========================================
  // Step 4: Start Render
  // ========================================

  const handleStartRender = async () => {
    if (!selectedAudio || selectedImages.length < 3 || !generationId || !scriptData) {
      setError(language === "ko" ? "최소 3개의 이미지가 필요합니다" : "At least 3 images required");
      return;
    }

    setRendering(true);
    setError("");

    try {
      // Proxy images first
      const proxyResult = await composeApi.proxyImages(
        generationId,
        selectedImages.map((img) => ({ url: img.sourceUrl, id: img.id }))
      );

      if (proxyResult.successful < 3) {
        setError(`Image upload failed: ${proxyResult.failed} failed. Need at least 3 images.`);
        setRendering(false);
        return;
      }

      const imageUrlMap = new Map(
        proxyResult.results
          .filter((r) => r.success)
          .map((r) => [r.id, r.minioUrl])
      );

      const proxiedImages = selectedImages
        .filter((img) => imageUrlMap.has(img.id))
        .map((img, idx) => ({
          url: imageUrlMap.get(img.id)!,
          order: idx,
        }));

      // Start render
      const renderResult = await composeApi.startRender({
        generationId,
        campaignId,
        audioAssetId: selectedAudio.id,
        images: proxiedImages,
        script: { lines: scriptData.script.lines },
        effectPreset,
        aspectRatio,
        targetDuration: 0,
        vibe: scriptData.vibe,
        audioStartTime,
        prompt,
        searchKeywords: editableKeywords,
        tiktokSEO: tiktokSEO || undefined,
      });

      toast.success(
        language === "ko" ? "생성 시작" : "Generation started",
        language === "ko" ? "영상 생성이 시작되었습니다" : "Video generation has started"
      );

      // Navigate to processing page
      router.push("/processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render failed");
      setRendering(false);
    }
  };

  // ========================================
  // Navigation
  // ========================================

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1: return scriptData !== null;
      case 2: return selectedImages.length >= 3;
      case 3: return selectedAudio !== null;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep((prev) => (prev + 1) as ComposeStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as ComposeStep);
    } else {
      onBack();
    }
  };

  // ========================================
  // Render
  // ========================================

  return (
    <div className="h-full flex flex-col">
      {/* Step Navigation */}
      <div className="px-[7%] py-4 border-b border-neutral-200">
        <StepNavigation
          currentStep={currentStep}
          scriptData={scriptData}
          selectedImages={selectedImages}
          selectedAudio={selectedAudio}
          onStepClick={setCurrentStep}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-[7%] mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content - Two Columns */}
      <div className="flex-1 flex overflow-hidden px-[7%]">
        {/* Left Column - Context */}
        <div className="w-2/5 border-r border-neutral-200 bg-neutral-50">
          <ComposeContextPanel />
        </div>

        {/* Right Column - Steps */}
        <div className="w-3/5 overflow-auto">
          <div className="p-6">
            {currentStep === 1 && (
              <ComposeScriptStep
                prompt={prompt}
                setPrompt={setPrompt}
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
                editableKeywords={editableKeywords}
                setEditableKeywords={setEditableKeywords}
                selectedSearchKeywords={selectedSearchKeywords}
                setSelectedSearchKeywords={setSelectedSearchKeywords}
                generatingScript={generatingScript}
                scriptData={scriptData}
                tiktokSEO={tiktokSEO}
                setTiktokSEO={setTiktokSEO}
                onGenerateScript={handleGenerateScript}
              />
            )}

            {currentStep === 2 && (
              <ComposeImageStep
                imageSourceMode={imageSourceMode}
                setImageSourceMode={setImageSourceMode}
                assetImages={assetImages}
                imageCandidates={imageCandidates}
                selectedImages={selectedImages}
                searchingImages={searchingImages}
                loadingAssets={imageAssetsLoading}
                editableKeywords={editableKeywords}
                selectedSearchKeywords={selectedSearchKeywords}
                setSelectedSearchKeywords={setSelectedSearchKeywords}
                onToggleSelection={toggleImageSelection}
                onSearchImages={() => handleSearchImages()}
                onNext={handleNext}
              />
            )}

            {currentStep === 3 && (
              <ComposeMusicStep
                scriptData={scriptData}
                audioMatches={audioMatches}
                selectedAudio={selectedAudio}
                audioStartTime={audioStartTime}
                audioAnalysis={audioAnalysis}
                matchingMusic={matchingMusic}
                analyzingAudio={analyzingAudio}
                campaignId={campaignId}
                onSelectAudio={handleSelectAudio}
                onSetAudioStartTime={setAudioStartTime}
                onNext={handleNext}
              />
            )}

            {currentStep === 4 && (
              <ComposeEffectStep
                scriptData={scriptData}
                selectedImages={selectedImages}
                selectedAudio={selectedAudio}
                aspectRatio={aspectRatio}
                effectPreset={effectPreset}
                setEffectPreset={setEffectPreset}
                tiktokSEO={tiktokSEO}
                setTiktokSEO={setTiktokSEO}
                rendering={rendering}
                onStartRender={handleStartRender}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Fixed at bottom */}
      <div className="shrink-0 px-[7%] py-4 border-t border-neutral-200 bg-white">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            className="border-neutral-300"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {currentStep === 1
              ? language === "ko" ? "취소" : "Cancel"
              : language === "ko" ? "이전" : "Back"}
          </Button>

          {/* Step progress indicator */}
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            {currentStep === 2 && (
              <span>
                {selectedImages.length}/3+ {language === "ko" ? "이미지 선택됨" : "images selected"}
              </span>
            )}
            {currentStep === 3 && !selectedAudio && (
              <span>{language === "ko" ? "음악을 선택하세요" : "Select music"}</span>
            )}
          </div>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                "bg-neutral-900 text-white hover:bg-neutral-800",
                !canProceed() && "opacity-50 cursor-not-allowed"
              )}
            >
              {language === "ko" ? "다음" : "Next"}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleStartRender}
              disabled={rendering || !selectedAudio || selectedImages.length < 3}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {rendering ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                  {language === "ko" ? "생성 중..." : "Generating..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {language === "ko" ? "컴포즈 영상 생성" : "Generate Compose"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
