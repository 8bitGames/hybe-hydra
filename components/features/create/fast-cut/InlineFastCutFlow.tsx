"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useProcessingSessionStore } from "@/lib/stores/processing-session-store";
import { useShallow } from "zustand/react/shallow";
import { useAssets, queryKeys } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  fastCutApi,
  ScriptGenerationResponse,
  ImageCandidate,
  AudioMatch,
  AudioAnalysisResponse,
  TikTokSEO,
} from "@/lib/fast-cut-api";
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
  RotateCcw,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Step Components
import { FastCutScriptStep } from "./FastCutScriptStep";
import { FastCutImageStep } from "./FastCutImageStep";
import { FastCutAIImageStep } from "./FastCutAIImageStep";
import { FastCutMusicStep } from "./FastCutMusicStep";
import { FastCutEffectStep } from "./FastCutEffectStep";

// Types
import type {
  SubtitleMode,
  ImageSourceMode,
  AIImageStyle,
  AIGeneratedImage,
  AIImageGlobalStyle,
} from "@/lib/stores/fast-cut-context";
import type { LyricsData } from "@/lib/subtitle-styles";

// ============================================================================
// Types
// ============================================================================

type FastCutStep = 1 | 2 | 3 | 4;

interface InlineFastCutFlowProps {
  campaignId: string;
  campaignName: string;
  onBack: () => void;
}

// ============================================================================
// Context Panel Component
// ============================================================================

function FastCutContextPanel() {
  const { language } = useI18n();

  const { start, analyze, keywords } = useWorkflowStore(
    useShallow((state) => ({
      start: state.start,
      analyze: state.analyze,
      // Derive keywords from start.source (replaces deprecated discover.keywords)
      keywords: state.start.source
        ? state.start.source.type === "trends"
          ? state.start.source.keywords || []
          : state.start.source.type === "idea"
          ? state.start.source.keywords || []
          : state.start.source.type === "video"
          ? state.start.source.hashtags || []
          : []
        : [],
    }))
  );

  const {
    selectedHashtags,
    savedInspiration,
    performanceMetrics,
    aiInsights,
  } = start;

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
                  selectedIdea.type === "fast-cut"
                    ? "border-neutral-900 text-neutral-900"
                    : "border-neutral-500 text-neutral-500"
                )}
              >
                Fast Cut
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

            {/* Fast Cut Data - Script Outline Preview */}
            {selectedIdea.fastCutData?.scriptOutline && selectedIdea.fastCutData.scriptOutline.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-200">
                <h4 className="text-[10px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {language === "ko" ? "스크립트 미리보기" : "Script Outline"}
                </h4>
                <ul className="text-xs text-neutral-600 space-y-0.5">
                  {selectedIdea.fastCutData.scriptOutline.slice(0, 4).map((line, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-neutral-400 shrink-0">{i + 1}.</span>
                      <span className="line-clamp-1">{line}</span>
                    </li>
                  ))}
                  {selectedIdea.fastCutData.scriptOutline.length > 4 && (
                    <li className="text-neutral-400 italic">
                      +{selectedIdea.fastCutData.scriptOutline.length - 4} more...
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Fast Cut Data - Suggested Vibe & BPM */}
            {selectedIdea.fastCutData?.suggestedVibe && (
              <div className="mt-2">
                <Badge variant="secondary" className="text-[10px] bg-neutral-100 text-neutral-600">
                  {language === "ko" ? "분위기:" : "Vibe:"} {selectedIdea.fastCutData.suggestedVibe}
                  {selectedIdea.fastCutData.suggestedBpmRange && (
                    <span className="ml-1.5 border-l border-neutral-300 pl-1.5">
                      {selectedIdea.fastCutData.suggestedBpmRange.min}-{selectedIdea.fastCutData.suggestedBpmRange.max} BPM
                    </span>
                  )}
                </Badge>
              </div>
            )}
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
  musicSkipped,
  imageSourceMode,
  aiGeneratedImages,
  onStepClick,
}: {
  currentStep: FastCutStep;
  scriptData: ScriptGenerationResponse | null;
  selectedImages: ImageCandidate[];
  selectedAudio: AudioMatch | null;
  musicSkipped: boolean;
  imageSourceMode: ImageSourceMode;
  aiGeneratedImages: AIGeneratedImage[];
  onStepClick: (step: FastCutStep) => void;
}) {
  const { language, translate } = useI18n();

  // Get tooltip key for each step
  const getStepTooltipKey = (stepKey: string) => {
    return `fastCut.tooltips.steps.${stepKey}`;
  };

  const isStepComplete = (step: FastCutStep): boolean => {
    switch (step) {
      case 1: return scriptData !== null;
      case 2:
        // Check image mode - search requires selected images, AI requires generated images
        if (imageSourceMode === "search") {
          return selectedImages.length >= 3;
        } else {
          const completedAiImages = aiGeneratedImages.filter((img) => img.status === "completed");
          return completedAiImages.length >= 3;
        }
      case 3: return selectedAudio !== null || musicSkipped; // Complete if audio selected OR skipped
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
        // Step 4 (processing) can be accessed directly if all prerequisites (1, 2, 3) are complete
        const canAccessStep4Directly = step.step === 4 &&
          isStepComplete(1) && isStepComplete(2) && isStepComplete(3);
        const isAccessible = step.step <= currentStep || isComplete || canAccessStep4Directly;
        // Map render step key to effects for tooltip
        const tooltipStepKey = step.key === "render" ? "effects" : step.key;

        return (
          <Tooltip key={step.step}>
            <TooltipTrigger asChild>
              <button
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
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px]">
              <p className="text-xs">{translate(getStepTooltipKey(tooltipStepKey))}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InlineFastCutFlow({
  campaignId,
  campaignName,
  onBack,
}: InlineFastCutFlowProps) {
  const router = useRouter();
  const { language, translate } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { startKeywords, analyze, setCreateType } = useWorkflowStore(
    useShallow((state) => ({
      // Derive keywords from start.source (replaces deprecated discover.keywords)
      startKeywords: state.start.source
        ? state.start.source.type === "trends"
          ? state.start.source.keywords || []
          : state.start.source.type === "idea"
          ? state.start.source.keywords || []
          : state.start.source.type === "video"
          ? state.start.source.hashtags || []
          : []
        : [],
      analyze: state.analyze,
      setCreateType: state.setCreateType,
    }))
  );

  // Fetch campaign audio assets
  const { data: audioAssetsData, isLoading: audioAssetsLoading } = useAssets(campaignId, {
    type: "audio",
    page_size: 100,
  });

  // ========================================
  // Core State
  // ========================================
  const [currentStep, setCurrentStep] = useState<FastCutStep>(1);
  const [error, setError] = useState("");

  // Step 1: Script state
  const initialPrompt = analyze.optimizedPrompt || analyze.selectedIdea?.description || "";
  const [prompt, setPrompt] = useState(initialPrompt);
  const [originalPrompt, setOriginalPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [targetDuration, setTargetDuration] = useState(20); // Default 20 seconds, will be updated from script generation
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptData, setScriptData] = useState<ScriptGenerationResponse | null>(null);

  // Fast Cut Data - pre-generated keywords and vibe from Analyze stage
  const fastCutData = analyze.selectedIdea?.fastCutData;

  // Use fastCutData.searchKeywords if available, otherwise fall back to start keywords
  const initialKeywords = useMemo(() => {
    if (fastCutData?.searchKeywords && fastCutData.searchKeywords.length > 0) {
      return fastCutData.searchKeywords;
    }
    return startKeywords;
  }, [fastCutData?.searchKeywords, startKeywords]);

  // Keyword state
  const [editableKeywords, setEditableKeywords] = useState<string[]>([
    ...initialKeywords,
  ]);
  const [selectedSearchKeywords, setSelectedSearchKeywords] = useState<Set<string>>(
    new Set(initialKeywords)
  );

  // Step 2: Images state
  const [searchingImages, setSearchingImages] = useState(false);
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageCandidate[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);

  // Step 2: AI Image Mode state
  const [imageSourceMode, setImageSourceMode] = useState<ImageSourceMode>("search");
  const [aiImageStyle, setAiImageStyle] = useState<AIImageStyle>("cinematic");
  const [aiGeneratedImages, setAiGeneratedImages] = useState<AIGeneratedImage[]>([]);
  const [aiImageGlobalStyle, setAiImageGlobalStyle] = useState<AIImageGlobalStyle | null>(null);
  const [generatingAiPrompts, setGeneratingAiPrompts] = useState(false);
  const [generatingAiImages, setGeneratingAiImages] = useState(false);

  // Step 3: Music state
  const [matchingMusic, setMatchingMusic] = useState(false);
  const [audioMatches, setAudioMatches] = useState<AudioMatch[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<AudioMatch | null>(null);
  const [audioStartTime, setAudioStartTime] = useState<number>(0);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResponse | null>(null);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);
  const [musicSkipped, setMusicSkipped] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>("lyrics");
  const [subtitleDisplayMode, setSubtitleDisplayMode] = useState<"sequential" | "static">("sequential");
  const [subtitlePosition, setSubtitlePosition] = useState<"top" | "center" | "bottom">("bottom");
  const [audioLyricsText, setAudioLyricsText] = useState<string | null>(null);
  const [triedStartTimes, setTriedStartTimes] = useState<number[]>([]);  // Track tried segments for variety

  // Get lyrics data from selected audio asset's metadata
  const selectedAudioLyrics = useMemo((): LyricsData | null => {
    if (!selectedAudio || !audioAssetsData?.items) {
      return null;
    }

    const fullAsset = audioAssetsData.items.find(
      (asset) => asset.id === selectedAudio.id
    );

    if (!fullAsset?.metadata) {
      return null;
    }

    const metadata = fullAsset.metadata as Record<string, unknown>;
    const lyrics = metadata.lyrics as LyricsData | undefined;

    if (lyrics && Array.isArray(lyrics.segments) && lyrics.segments.length > 0) {
      return lyrics;
    }

    return null;
  }, [selectedAudio, audioAssetsData]);

  // Step 4: Render state
  const [styleSetId, setStyleSetId] = useState<string>("viral_tiktok");
  const [styleSets, setStyleSets] = useState<import("@/lib/fast-cut-api").StyleSetSummary[]>([]);
  const [rendering, setRendering] = useState(false);

  // TikTok SEO state
  const [tiktokSEO, setTiktokSEO] = useState<TikTokSEO | null>(null);

  // Keyword suggestion dialog state (shown before script generation)
  const [showKeywordSuggestionDialog, setShowKeywordSuggestionDialog] = useState(false);
  const [autoSearchWithAIKeyword, setAutoSearchWithAIKeyword] = useState(false);
  const [keywordPopoverOpen, setKeywordPopoverOpen] = useState(false);

  // ========================================
  // Effects
  // ========================================

  // Set create type on mount
  useEffect(() => {
    setCreateType("fast-cut");
  }, [setCreateType]);

  // Fetch style sets on mount
  useEffect(() => {
    const fetchStyleSets = async () => {
      try {
        const result = await fastCutApi.getStyleSets();
        setStyleSets(result.styleSets);
      } catch (err) {
        console.error("Failed to fetch style sets:", err);
      }
    };
    fetchStyleSets();
  }, []);

  // Sync keywords when fastCutData becomes available (e.g., user selects a Fast Cut idea)
  useEffect(() => {
    if (fastCutData?.searchKeywords && fastCutData.searchKeywords.length > 0) {
      setEditableKeywords([...fastCutData.searchKeywords]);
      setSelectedSearchKeywords(new Set(fastCutData.searchKeywords));
    }
  }, [fastCutData?.searchKeywords]);

  // Track last analyzed duration to trigger re-analysis when targetDuration changes
  const [lastAnalyzedDuration, setLastAnalyzedDuration] = useState<number | null>(null);

  // Re-analyze audio when targetDuration changes (e.g., after script generation updates duration)
  useEffect(() => {
    // Skip if no audio selected or still analyzing
    if (!selectedAudio || analyzingAudio) return;
    // Skip if we haven't done initial analysis yet
    if (lastAnalyzedDuration === null) return;
    // Skip if duration hasn't changed
    if (lastAnalyzedDuration === targetDuration) return;

    console.log("[FastCut Inline] targetDuration changed, re-analyzing audio:", {
      previous: lastAnalyzedDuration,
      new: targetDuration,
      audioId: selectedAudio.id
    });

    const reAnalyze = async () => {
      setAnalyzingAudio(true);
      try {
        const analysis = await fastCutApi.analyzeAudioBestSegment(selectedAudio.id, targetDuration);
        setAudioAnalysis(analysis);
        setAudioStartTime(analysis.suggestedStartTime);
        setLastAnalyzedDuration(targetDuration);
        console.log("[FastCut Inline] Re-analysis complete:", {
          suggestedStartTime: analysis.suggestedStartTime,
          targetDuration
        });
      } catch (err) {
        console.warn("[FastCut Inline] Re-analysis failed:", err);
      } finally {
        setAnalyzingAudio(false);
      }
    };

    reAnalyze();
  }, [targetDuration, selectedAudio, lastAnalyzedDuration, analyzingAudio]);

  // ========================================
  // Step 1: Script Generation
  // ========================================

  const handleGenerateScript = async () => {
    if (!prompt.trim()) {
      setError(language === "ko" ? "프롬프트를 입력하세요" : "Please enter a prompt");
      return;
    }

    // Check if no keywords are selected - ask user first
    if (selectedSearchKeywords.size === 0) {
      setShowKeywordSuggestionDialog(true);
      return;
    }

    // Keywords exist, proceed with generation
    await executeScriptGeneration(true);
  };

  // Actual script generation logic
  const executeScriptGeneration = async (shouldAutoSearch: boolean) => {
    setError("");
    setGeneratingScript(true);

    try {
      const result = await fastCutApi.generateScript({
        campaignId,
        artistName: analyze.artistStageName || analyze.artistName || "Artist",
        trendKeywords: editableKeywords,
        userPrompt: prompt.trim(),
        targetDuration: targetDuration,
        language,
      });

      setScriptData(result);
      if (result.tiktokSEO) {
        setTiktokSEO(result.tiktokSEO);
      }

      // Set targetDuration from the actual generated script duration
      // This ensures Music step uses the correct duration (max 30 seconds)
      if (result.script.totalDuration) {
        const cappedDuration = Math.min(result.script.totalDuration, 30);
        setTargetDuration(cappedDuration);
        console.log("[FastCut] Set targetDuration from script:", result.script.totalDuration, "s (capped to", cappedDuration, "s)");
      }

      // Auto-select style set based on prompt (async, don't block flow)
      fastCutApi.selectStyleSet(prompt.trim(), { useAI: true, campaignId })
        .then((selection) => {
          setStyleSetId(selection.selected.id);
          console.log("[FastCut] Auto-selected style set:", selection.selected.nameKo);
        })
        .catch((err) => {
          console.warn("[FastCut] Style set auto-selection failed, using default:", err);
        });

      // Merge AI keywords with user keywords
      const userKeywords = [...editableKeywords];
      const aiKeywords = (result.searchKeywords || []).filter(
        (kw) => !editableKeywords.some(
          (existing) => existing.toLowerCase() === kw.toLowerCase()
        )
      );
      const mergedKeywords = [...userKeywords, ...aiKeywords];
      setEditableKeywords(mergedKeywords);

      // Generate ID for this fast cut session
      // Use 'compose-' prefix for backward compatibility with processing page detection
      const newGenerationId = `compose-${Date.now()}`;
      setGenerationId(newGenerationId);

      // Auto-advance to step 2
      setCurrentStep(2);

      // Auto-search images based on user's choice
      if (shouldAutoSearch && mergedKeywords.length > 0) {
        // Use the best AI keyword for search
        const bestKeyword = mergedKeywords[0];
        setSelectedSearchKeywords(new Set([bestKeyword]));
        await handleSearchImages([bestKeyword], newGenerationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script generation failed");
    } finally {
      setGeneratingScript(false);
    }
  };

  // Handle keyword suggestion confirmation - YES, auto-search with AI keyword
  const handleKeywordSuggestionConfirm = async () => {
    setShowKeywordSuggestionDialog(false);
    await executeScriptGeneration(true);
  };

  // Handle keyword suggestion cancel - NO, go back and let user add keywords manually
  const handleKeywordSuggestionCancel = () => {
    setShowKeywordSuggestionDialog(false);
    // Open the keyword input popover automatically
    setKeywordPopoverOpen(true);
    // Don't generate script - let user add keywords first
  };

  // ========================================
  // Step 2: Image Search
  // ========================================

  const handleSearchImages = async (
    keywords?: string[],
    genId?: string,
    options?: { forceRefresh?: boolean; clearExisting?: boolean }
  ) => {
    const searchKeywords = keywords || Array.from(selectedSearchKeywords);
    const targetGenId = genId || generationId;
    const { forceRefresh = false, clearExisting = false } = options || {};

    if (searchKeywords.length === 0 || !targetGenId) return;

    setSearchingImages(true);
    setError("");

    try {
      const result = await fastCutApi.searchImages({
        generationId: targetGenId,
        keywords: searchKeywords,
        maxImages: 30,
        language: language as 'ko' | 'en',
        forceRefresh,
      });

      // Accumulate results: merge with existing candidates (unless clearExisting)
      setImageCandidates((prev) => {
        if (clearExisting || forceRefresh) {
          return result.candidates;
        }

        // Merge and deduplicate by URL
        const existingUrls = new Set(prev.map((img) => img.sourceUrl));
        const newCandidates = result.candidates.filter(
          (img) => !existingUrls.has(img.sourceUrl)
        );

        // Combine and re-sort by quality score
        const combined = [...prev, ...newCandidates];
        combined.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

        // Re-assign IDs and sortOrder
        return combined.map((img, idx) => ({
          ...img,
          id: `${targetGenId}-img-${idx}`,
          sortOrder: idx,
        }));
      });

      // Auto-select high quality images (only if no images selected yet)
      if (selectedImages.length === 0 || forceRefresh) {
        const autoSelected = result.candidates
          .filter((img) => (img.qualityScore || 0) > 0.5)
          .slice(0, Math.min(6, result.candidates.length));
        setSelectedImages(autoSelected);
      }

      // Log cache stats
      if (result.cacheStats) {
        console.log(
          `[FastCut] Image search: ${result.cacheStats.cached} cached, ${result.cacheStats.fresh} fresh`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image search failed");
    } finally {
      setSearchingImages(false);
    }
  };

  // Force refresh - bypass cache and search fresh
  const handleForceRefreshImages = () => {
    handleSearchImages(undefined, undefined, { forceRefresh: true, clearExisting: true });
  };

  const toggleImageSelection = (image: ImageCandidate) => {
    setSelectedImages((prev) => {
      const exists = prev.find((img) => img.id === image.id);
      if (exists) return prev.filter((img) => img.id !== image.id);
      if (prev.length >= 10) return prev;
      return [...prev, image];
    });
  };

  const reorderImages = (newImages: ImageCandidate[]) => {
    setSelectedImages(newImages);
  };

  // ========================================
  // Step 2: AI Image Generation
  // ========================================

  const handleGenerateAiPrompts = async () => {
    if (!scriptData) return;

    setGeneratingAiPrompts(true);
    setError("");

    try {
      const response = await fetch("/api/v1/fast-cut/images/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: prompt,
          vibe: scriptData.vibe,
          scriptLines: scriptData.script.lines.map((line) => ({
            text: line.text,
            timing: line.timing,
            duration: line.duration,
            purpose: line.purpose,
          })),
          artistName: analyze.artistStageName || analyze.artistName || "Artist",
          aspectRatio,
          imageStyle: aiImageStyle,
          language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate image prompts");
      }

      const result = await response.json();
      console.log("[FastCut AI Images] Prompts generated:", result.sceneCount);

      // Set global style
      setAiImageGlobalStyle(result.globalStyle);

      // Initialize AI generated images array with prompts
      const initialImages: AIGeneratedImage[] = result.scenes.map(
        (scene: { sceneNumber: number; scriptText: string; imagePrompt: string; negativePrompt: string }) => ({
          sceneNumber: scene.sceneNumber,
          scriptText: scene.scriptText,
          imagePrompt: scene.imagePrompt,
          negativePrompt: scene.negativePrompt,
          status: "pending" as const,
        })
      );
      setAiGeneratedImages(initialImages);

      toast.success(
        language === "ko" ? "프롬프트 생성 완료" : "Prompts Generated",
        language === "ko"
          ? `${result.sceneCount}개의 이미지 프롬프트가 생성되었습니다`
          : `${result.sceneCount} image prompts generated`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prompt generation failed");
    } finally {
      setGeneratingAiPrompts(false);
    }
  };

  const handleGenerateAiImages = async () => {
    if (aiGeneratedImages.length === 0) return;

    // Only generate pending images
    const pendingImages = aiGeneratedImages.filter((img) => img.status === "pending");
    if (pendingImages.length === 0) return;

    setGeneratingAiImages(true);
    setError("");

    // Mark pending images as generating
    setAiGeneratedImages((prev) =>
      prev.map((img) =>
        img.status === "pending" ? { ...img, status: "generating" as const } : img
      )
    );

    try {
      const response = await fetch("/api/v1/fast-cut/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: pendingImages.map((img) => ({
            sceneNumber: img.sceneNumber,
            imagePrompt: img.imagePrompt,
            negativePrompt: img.negativePrompt,
          })),
          aspectRatio,
          sessionId: generationId || `fastcut-ai-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate images");
      }

      const result = await response.json();
      console.log("[FastCut AI Images] Images generated:", result.successCount, "success,", result.failureCount, "failed");

      // Update images with results
      setAiGeneratedImages((prev) =>
        prev.map((img) => {
          const generated = result.images.find(
            (g: { sceneNumber: number; success: boolean; imageUrl?: string; imageBase64?: string; s3Key?: string; error?: string }) =>
              g.sceneNumber === img.sceneNumber
          );
          if (generated) {
            return {
              ...img,
              imageUrl: generated.imageUrl,
              imageBase64: generated.imageBase64,
              s3Key: generated.s3Key,
              status: generated.success ? ("completed" as const) : ("failed" as const),
              error: generated.error,
            };
          }
          return img;
        })
      );

      if (result.failureCount > 0) {
        toast.warning(
          language === "ko" ? "일부 이미지 생성 실패" : "Some Images Failed",
          language === "ko"
            ? `${result.successCount}개 성공, ${result.failureCount}개 실패`
            : `${result.successCount} succeeded, ${result.failureCount} failed`
        );
      } else {
        toast.success(
          language === "ko" ? "이미지 생성 완료" : "Images Generated",
          language === "ko"
            ? `${result.successCount}개의 이미지가 생성되었습니다`
            : `${result.successCount} images generated`
        );
      }
    } catch (err) {
      // Mark generating images as failed
      setAiGeneratedImages((prev) =>
        prev.map((img) =>
          img.status === "generating"
            ? { ...img, status: "failed" as const, error: err instanceof Error ? err.message : "Generation failed" }
            : img
        )
      );
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setGeneratingAiImages(false);
    }
  };

  const handleRegenerateAiImage = async (sceneNumber: number) => {
    const scene = aiGeneratedImages.find((img) => img.sceneNumber === sceneNumber);
    if (!scene) return;

    // Mark this scene as generating
    setAiGeneratedImages((prev) =>
      prev.map((img) =>
        img.sceneNumber === sceneNumber ? { ...img, status: "generating" as const, error: undefined } : img
      )
    );

    try {
      const response = await fetch("/api/v1/fast-cut/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: [
            {
              sceneNumber: scene.sceneNumber,
              imagePrompt: scene.imagePrompt,
              negativePrompt: scene.negativePrompt,
            },
          ],
          aspectRatio,
          sessionId: generationId || `fastcut-ai-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to regenerate image");
      }

      const result = await response.json();
      const generated = result.images[0];

      setAiGeneratedImages((prev) =>
        prev.map((img) =>
          img.sceneNumber === sceneNumber
            ? {
                ...img,
                imageUrl: generated.imageUrl,
                imageBase64: generated.imageBase64,
                s3Key: generated.s3Key,
                status: generated.success ? ("completed" as const) : ("failed" as const),
                error: generated.error,
              }
            : img
        )
      );

      if (generated.success) {
        toast.success(
          language === "ko" ? "이미지 재생성 완료" : "Image Regenerated",
          language === "ko" ? `씬 ${sceneNumber} 이미지가 재생성되었습니다` : `Scene ${sceneNumber} image regenerated`
        );
      }
    } catch (err) {
      setAiGeneratedImages((prev) =>
        prev.map((img) =>
          img.sceneNumber === sceneNumber
            ? { ...img, status: "failed" as const, error: err instanceof Error ? err.message : "Regeneration failed" }
            : img
        )
      );
    }
  };

  // ========================================
  // Step 3: Music Matching
  // ========================================

  const handleMatchMusic = async () => {
    if (!scriptData) return;

    setMatchingMusic(true);
    setError("");

    try {
      const result = await fastCutApi.matchMusic({
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
    setMusicSkipped(false); // Reset skip when selecting audio
    setAudioAnalysis(null);
    setAudioStartTime(0);
    setTriedStartTimes([]);  // Reset tried times for new audio
    setAnalyzingAudio(true);

    try {
      // Run audio analysis and lyrics extraction in parallel for better performance
      const [analysisResult, lyricsResult] = await Promise.allSettled([
        fastCutApi.analyzeAudioBestSegment(audio.id, targetDuration),
        fastCutApi.extractLyrics(audio.id, { languageHint: 'auto' }),
      ]);

      // Handle audio analysis result
      if (analysisResult.status === 'fulfilled') {
        setAudioAnalysis(analysisResult.value);
        setAudioStartTime(analysisResult.value.suggestedStartTime);
        // Track the duration used for this analysis (for re-analysis on duration change)
        setLastAnalyzedDuration(targetDuration);
      } else {
        console.warn("Audio analysis failed:", analysisResult.reason);
        setAudioStartTime(0);
      }

      // Handle lyrics extraction result
      if (lyricsResult.status === 'fulfilled') {
        const { lyrics, cached } = lyricsResult.value;
        if (lyrics && !lyrics.isInstrumental && lyrics.segments.length > 0) {
          console.log("[FastCut] Lyrics extracted:", {
            cached,
            language: lyrics.language,
            segmentCount: lyrics.segments.length,
          });

          // Store lyrics text for display in Content Summary
          const lyricsText = lyrics.segments.map((s) => s.text).join("\n");
          setAudioLyricsText(lyricsText);
          console.log("[FastCut] 🎤 Lyrics text saved for display:", {
            textLength: lyricsText.length,
            preview: lyricsText.substring(0, 100),
          });

          // Invalidate assets cache so the UI updates with new lyrics metadata
          // This ensures FastCutMusicStep can display the lyrics preview
          if (!cached) {
            // Invalidate all asset queries for this campaign to ensure UI updates
            queryClient.invalidateQueries({ queryKey: queryKeys.assets(campaignId) });
          }
        } else if (lyrics?.isInstrumental) {
          console.log("[FastCut] Audio is instrumental (no lyrics)");
          setAudioLyricsText(null);
        } else {
          console.log("[FastCut] No lyrics found in audio");
          setAudioLyricsText(null);
        }
      } else {
        console.warn("[FastCut] Lyrics extraction failed:", lyricsResult.reason);
        setAudioLyricsText(null);
      }
    } catch (err) {
      console.warn("Audio processing failed:", err);
      setAudioStartTime(0);
    } finally {
      setAnalyzingAudio(false);
    }
  };

  const handleSkipMusic = () => {
    setMusicSkipped(true);
    setSelectedAudio(null);
    setAudioAnalysis(null);
    setAudioStartTime(0);
  };

  const handleUnskipMusic = () => {
    setMusicSkipped(false);
    // Re-trigger music matching if we have script data
    if (scriptData && audioMatches.length === 0) {
      handleMatchMusic();
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
    // Allow proceeding with music skipped (no selectedAudio) or with audio selected
    const hasValidMusicChoice = selectedAudio !== null || musicSkipped;

    // Check image count based on mode
    const hasValidImages = imageSourceMode === "search"
      ? selectedImages.length >= 3
      : aiGeneratedImages.filter((img) => img.status === "completed").length >= 3;

    if (!hasValidMusicChoice || !hasValidImages || !generationId || !scriptData) {
      setError(language === "ko" ? "최소 3개의 이미지가 필요합니다" : "At least 3 images required");
      return;
    }

    setRendering(true);
    setError("");

    try {
      let finalImages: { url: string; order: number }[];
      let imageUrlMapForSession: Map<string, string>;

      if (imageSourceMode === "search") {
        // Search mode: Proxy images first (external URLs need to be uploaded to our storage)
        const proxyResult = await fastCutApi.proxyImages(
          generationId,
          selectedImages.map((img) => ({ url: img.sourceUrl, id: img.id }))
        );

        if (proxyResult.successful < 3) {
          setError(`Image upload failed: ${proxyResult.failed} failed. Need at least 3 images.`);
          setRendering(false);
          return;
        }

        imageUrlMapForSession = new Map(
          proxyResult.results
            .filter((r) => r.success)
            .map((r) => [r.id, r.minioUrl])
        );

        finalImages = selectedImages
          .filter((img) => imageUrlMapForSession.has(img.id))
          .map((img, idx) => ({
            url: imageUrlMapForSession.get(img.id)!,
            order: idx,
          }));
      } else {
        // AI mode: Images are already on S3, use their URLs directly
        const completedAiImages = aiGeneratedImages.filter((img) => img.status === "completed" && img.imageUrl);

        if (completedAiImages.length < 3) {
          setError(language === "ko" ? "최소 3개의 AI 이미지가 필요합니다" : "At least 3 AI images required");
          setRendering(false);
          return;
        }

        imageUrlMapForSession = new Map(
          completedAiImages.map((img) => [`ai-scene-${img.sceneNumber}`, img.imageUrl!])
        );

        finalImages = completedAiImages.map((img, idx) => ({
          url: img.imageUrl!,
          order: idx,
        }));
      }

      // Start render - audioAssetId is optional when music is skipped
      console.log("[FastCut] 🚀 Starting render API call...");
      console.log("[FastCut] 🎤 Subtitle mode:", subtitleMode, "→ useAudioLyrics:", subtitleMode === "lyrics");
      console.log("[FastCut] 🖼️ Image source mode:", imageSourceMode, "→ images count:", finalImages.length);
      const renderResult = await fastCutApi.startRender({
        generationId,
        campaignId,
        audioAssetId: selectedAudio?.id || "", // Empty string when skipped, API handles this
        images: finalImages,
        script: { lines: scriptData.script.lines },
        // Use style set instead of individual effectPreset
        styleSetId,
        aspectRatio,
        targetDuration,
        audioStartTime: musicSkipped ? 0 : audioStartTime,
        prompt,
        searchKeywords: editableKeywords,
        tiktokSEO: tiktokSEO || undefined,
        // Use audio lyrics for subtitles when lyrics mode selected
        useAudioLyrics: subtitleMode === "lyrics",
        // Subtitle display mode: sequential (one at a time) or static (all visible)
        subtitleDisplayMode,
        // Subtitle position: top, center, or bottom
        subtitlePosition,
      });
      console.log("[FastCut] 📦 Render API response received");

      // Initialize processing session before navigating
      console.log("[FastCut] ✅ Render API call succeeded, now initializing session...");
      console.log("[FastCut] renderResult:", JSON.stringify(renderResult));

      try {
        const selectedStyleSet = styleSets.find(s => s.id === styleSetId);
        console.log("[FastCut] selectedStyleSet:", selectedStyleSet?.name);
        console.log("[FastCut] generationId:", renderResult.generationId);

        // Use lyrics text for display when subtitleMode is "lyrics", otherwise use AI script
        const displayScript = subtitleMode === "lyrics" && audioLyricsText
          ? audioLyricsText
          : scriptData.script.lines.map(l => l.text).join("\n");

        console.log("[FastCut] 🎤 Session script source:", {
          subtitleMode,
          hasAudioLyricsText: !!audioLyricsText,
          usingLyrics: subtitleMode === "lyrics" && !!audioLyricsText,
          scriptPreview: displayScript.substring(0, 100),
        });

        // Build images array based on mode
        const sessionImages = imageSourceMode === "search"
          ? selectedImages.map((img) => ({
              id: img.id,
              url: imageUrlMapForSession.get(img.id) || img.sourceUrl,
              thumbnailUrl: img.thumbnailUrl,
            }))
          : aiGeneratedImages
              .filter((img) => img.status === "completed" && img.imageUrl)
              .map((img) => ({
                id: `ai-scene-${img.sceneNumber}`,
                url: img.imageUrl!,
                thumbnailUrl: img.imageUrl!, // AI images use same URL for thumbnail
              }));

        const sessionData = {
          campaignId,
          campaignName,
          generationId: renderResult.generationId,
          contentType: "fast-cut" as const, // Fast Cut workflow
          content: {
            script: displayScript,
            images: sessionImages,
            musicTrack: selectedAudio ? {
              id: selectedAudio.id,
              name: selectedAudio.filename,
              startTime: audioStartTime || 0,
              url: selectedAudio.s3Url,
            } : undefined,
            effectPreset: selectedStyleSet ? {
              id: selectedStyleSet.id,
              name: selectedStyleSet.name,
              description: selectedStyleSet.description,
            } : undefined,
          },
        };

        console.log("[FastCut] sessionData prepared:", JSON.stringify(sessionData, null, 2));

        useProcessingSessionStore.getState().initSession(sessionData);
        console.log("[FastCut] initSession called");

        // Verify session was created
        const createdSession = useProcessingSessionStore.getState().session;
        console.log("[FastCut] Session created:", createdSession?.id, "State:", createdSession?.state);

        // Double-check localStorage
        const storedData = localStorage.getItem("hydra-processing-session");
        console.log("[FastCut] localStorage after init:", storedData ? "EXISTS" : "MISSING");
      } catch (sessionError) {
        console.error("[FastCut] ❌ Session initialization error:", sessionError);
      }

      toast.success(
        language === "ko" ? "생성 시작" : "Generation started",
        language === "ko" ? "영상 생성이 시작되었습니다" : "Video generation has started"
      );

      // Navigate to processing page
      router.push("/processing");
    } catch (err) {
      console.error("[FastCut] ❌ handleStartRender error:", err);
      console.error("[FastCut] Error stack:", err instanceof Error ? err.stack : "No stack");
      setError(err instanceof Error ? err.message : "Render failed");
      setRendering(false);
    }
  };

  // ========================================
  // Soft Reset Handler
  // ========================================

  const handleSoftReset = useCallback(() => {
    // Reset to step 1 while preserving original prompt
    setCurrentStep(1);
    setPrompt(originalPrompt);
    setScriptData(null);
    setTiktokSEO(null);
    // Reset search mode images
    setImageCandidates([]);
    setSelectedImages([]);
    // Reset AI mode images
    setAiGeneratedImages([]);
    setAiImageGlobalStyle(null);
    setGeneratingAiPrompts(false);
    setGeneratingAiImages(false);
    // Reset music
    setAudioMatches([]);
    setSelectedAudio(null);
    setAudioAnalysis(null);
    setAudioStartTime(0);
    setMusicSkipped(false);
    setGenerationId(null);
    setError("");

    toast.info(
      language === "ko" ? "초기화 완료" : "Reset complete",
      language === "ko" ? "원본 프롬프트로 다시 시작합니다" : "Starting over with original prompt"
    );
  }, [originalPrompt, language, toast]);

  // ========================================
  // Progress Summary Helper
  // ========================================

  const getProgressSummary = useCallback(() => {
    // Determine music detail text
    let musicDetail: string;
    if (musicSkipped) {
      musicDetail = language === "ko" ? "건너뜀" : "Skipped";
    } else if (selectedAudio) {
      musicDetail = selectedAudio.filename.substring(0, 20) + (selectedAudio.filename.length > 20 ? "..." : "");
    } else {
      musicDetail = language === "ko" ? "대기 중" : "Pending";
    }

    // Determine images status based on mode
    let imagesComplete: boolean;
    let imagesDetail: string;
    if (imageSourceMode === "search") {
      imagesComplete = selectedImages.length >= 3;
      imagesDetail = `${selectedImages.length}/3+ ${language === "ko" ? "선택됨" : "selected"}`;
    } else {
      const completedCount = aiGeneratedImages.filter((img) => img.status === "completed").length;
      imagesComplete = completedCount >= 3;
      imagesDetail = `${completedCount}/3+ ${language === "ko" ? "AI 생성됨" : "AI generated"}`;
    }

    return {
      script: {
        complete: scriptData !== null,
        label: language === "ko" ? "스크립트" : "Script",
        detail: scriptData
          ? `${scriptData.script.lines.length} ${language === "ko" ? "라인" : "lines"}`
          : language === "ko" ? "대기 중" : "Pending"
      },
      images: {
        complete: imagesComplete,
        label: language === "ko" ? "이미지" : "Images",
        detail: imagesDetail
      },
      music: {
        complete: selectedAudio !== null || musicSkipped,
        label: language === "ko" ? "음악" : "Music",
        detail: musicDetail
      },
      effects: {
        complete: false, // Never complete - final step
        label: language === "ko" ? "스타일" : "Style",
        detail: styleSets.find(s => s.id === styleSetId)?.nameKo || styleSetId.replace("_", " ")
      }
    };
  }, [scriptData, selectedImages.length, selectedAudio, musicSkipped, styleSetId, styleSets, language, imageSourceMode, aiGeneratedImages]);

  // ========================================
  // Re-analyze audio for different segment
  // ========================================

  const handleReAnalyzeAudio = useCallback(async () => {
    if (!selectedAudio || analyzingAudio) return;

    setAnalyzingAudio(true);
    try {
      // Add current start time to exclusion list
      const excludeStarts = [...triedStartTimes, audioStartTime].filter(
        (t, i, arr) => arr.indexOf(t) === i  // Deduplicate
      );

      console.log("[FastCut Inline] Re-analyzing for different segment:", {
        audioId: selectedAudio.id,
        targetDuration,
        excludeStarts
      });

      const analysis = await fastCutApi.analyzeAudioBestSegment(
        selectedAudio.id,
        targetDuration,
        {
          preferVariety: true,
          excludeStarts,
        }
      );

      setAudioAnalysis(analysis);
      setAudioStartTime(analysis.suggestedStartTime);
      setTriedStartTimes(excludeStarts);  // Track this start time

      console.log("[FastCut Inline] Re-analysis complete:", {
        previousStart: audioStartTime,
        newStart: analysis.suggestedStartTime,
        selectionReason: analysis.selectionReason,
        candidatesCount: analysis.climaxCandidates?.length
      });
    } catch (err) {
      console.warn("[FastCut Inline] Re-analysis failed:", err);
    } finally {
      setAnalyzingAudio(false);
    }
  }, [selectedAudio, analyzingAudio, targetDuration, audioStartTime, triedStartTimes]);

  // ========================================
  // Navigation
  // ========================================

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1: return scriptData !== null;
      case 2:
        // Check image mode - search requires selected images, AI requires generated images
        if (imageSourceMode === "search") {
          return selectedImages.length >= 3;
        } else {
          // AI mode: need at least 3 completed images
          const completedAiImages = aiGeneratedImages.filter((img) => img.status === "completed");
          return completedAiImages.length >= 3;
        }
      case 3: return selectedAudio !== null || musicSkipped; // Can proceed if audio selected OR skipped
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep((prev) => (prev + 1) as FastCutStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as FastCutStep);
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
          musicSkipped={musicSkipped}
          imageSourceMode={imageSourceMode}
          aiGeneratedImages={aiGeneratedImages}
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
          <FastCutContextPanel />
        </div>

        {/* Right Column - Steps */}
        <div className="w-3/5 overflow-auto">
          <div className="p-6">
            {currentStep === 1 && (
              <FastCutScriptStep
                campaignId={campaignId}
                campaignName={campaignName}
                campaignReadOnly={true}
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
                keywordPopoverOpen={keywordPopoverOpen}
                onKeywordPopoverOpenChange={setKeywordPopoverOpen}
                imageSourceMode={imageSourceMode}
                setImageSourceMode={setImageSourceMode}
                aiImageStyle={aiImageStyle}
                setAiImageStyle={setAiImageStyle}
              />
            )}

            {currentStep === 2 && imageSourceMode === "search" && (
              <FastCutImageStep
                imageCandidates={imageCandidates}
                selectedImages={selectedImages}
                searchingImages={searchingImages}
                editableKeywords={editableKeywords}
                selectedSearchKeywords={selectedSearchKeywords}
                setSelectedSearchKeywords={setSelectedSearchKeywords}
                onToggleSelection={toggleImageSelection}
                onReorderImages={reorderImages}
                onSearchImages={() => handleSearchImages()}
                onForceRefresh={handleForceRefreshImages}
                onNext={handleNext}
              />
            )}

            {currentStep === 2 && imageSourceMode === "ai_generate" && (
              <FastCutAIImageStep
                scriptData={scriptData}
                aiGeneratedImages={aiGeneratedImages}
                aiImageGlobalStyle={aiImageGlobalStyle}
                aiImageStyle={aiImageStyle}
                generatingAiPrompts={generatingAiPrompts}
                generatingAiImages={generatingAiImages}
                onGeneratePrompts={handleGenerateAiPrompts}
                onGenerateImages={handleGenerateAiImages}
                onRegenerateImage={handleRegenerateAiImage}
                onNext={handleNext}
              />
            )}

            {currentStep === 3 && (
              <FastCutMusicStep
                scriptData={scriptData}
                audioMatches={audioMatches}
                selectedAudio={selectedAudio}
                audioStartTime={audioStartTime}
                videoDuration={targetDuration}
                audioAnalysis={audioAnalysis}
                matchingMusic={matchingMusic}
                analyzingAudio={analyzingAudio}
                campaignId={campaignId}
                musicSkipped={musicSkipped}
                subtitleMode={subtitleMode}
                onSelectAudio={handleSelectAudio}
                onSetAudioStartTime={setAudioStartTime}
                onSetVideoDuration={setTargetDuration}
                onSetSubtitleMode={setSubtitleMode}
                onSetAudioLyricsText={setAudioLyricsText}
                onSkipMusic={handleSkipMusic}
                onUnskipMusic={handleUnskipMusic}
                onReAnalyze={handleReAnalyzeAudio}
                onNext={handleNext}
              />
            )}

            {currentStep === 4 && (
              <FastCutEffectStep
                scriptData={scriptData}
                setScriptData={setScriptData}
                selectedImages={selectedImages}
                selectedAudio={selectedAudio}
                musicSkipped={musicSkipped}
                aspectRatio={aspectRatio}
                styleSetId={styleSetId}
                setStyleSetId={setStyleSetId}
                styleSets={styleSets}
                tiktokSEO={tiktokSEO}
                setTiktokSEO={setTiktokSEO}
                rendering={rendering}
                onStartRender={handleStartRender}
                videoDuration={targetDuration}
                subtitleMode={subtitleMode}
                lyricsData={selectedAudioLyrics}
                audioStartTime={audioStartTime}
                subtitleDisplayMode={subtitleDisplayMode}
                setSubtitleDisplayMode={setSubtitleDisplayMode}
                subtitlePosition={subtitlePosition}
                setSubtitlePosition={setSubtitlePosition}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Fixed at bottom */}
      <div className="shrink-0 px-[7%] py-4 border-t border-neutral-200 bg-white">
        {/* Progress Summary */}
        {currentStep > 1 && (
          <div className="mb-3 flex items-center gap-4 text-xs">
            {Object.entries(getProgressSummary()).map(([key, info]) => (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full",
                  info.complete
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-500"
                )}
              >
                {info.complete ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                <span className="font-medium">{info.label}</span>
                <span className="opacity-75">· {info.detail}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p className="text-xs">
                  {translate(currentStep === 1 ? "fastCut.tooltips.navigation.cancel" : "fastCut.tooltips.navigation.back")}
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Soft Reset Button - Only show after step 1 */}
            {currentStep > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={handleSoftReset}
                    className="text-neutral-500 hover:text-neutral-700"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {language === "ko" ? "처음부터" : "Start Over"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px]">
                  <p className="text-xs">{translate("fastCut.tooltips.navigation.startOver")}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Step progress indicator */}
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            {currentStep === 2 && imageSourceMode === "search" && (
              <span>
                {selectedImages.length}/3+ {language === "ko" ? "이미지 선택됨" : "images selected"}
              </span>
            )}
            {currentStep === 2 && imageSourceMode === "ai_generate" && (
              <span>
                {aiGeneratedImages.filter((img) => img.status === "completed").length}/3+{" "}
                {language === "ko" ? "AI 이미지 생성됨" : "AI images generated"}
              </span>
            )}
            {currentStep === 3 && !selectedAudio && !musicSkipped && (
              <span>{language === "ko" ? "음악을 선택하세요" : "Select music"}</span>
            )}
            {currentStep === 3 && musicSkipped && (
              <span>{language === "ko" ? "음악 없이 진행" : "Proceeding without music"}</span>
            )}
          </div>

          {currentStep < 4 ? (
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p className="text-xs">{translate("fastCut.tooltips.navigation.next")}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleStartRender}
                  disabled={rendering || (!selectedAudio && !musicSkipped) || (imageSourceMode === "search" ? selectedImages.length < 3 : aiGeneratedImages.filter((img) => img.status === "completed").length < 3)}
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
                      {language === "ko" ? "패스트 컷 영상 생성" : "Generate Fast Cut"}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p className="text-xs">{translate("fastCut.tooltips.navigation.generate")}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Keyword Suggestion Dialog - shown before script generation */}
      <AlertDialog open={showKeywordSuggestionDialog} onOpenChange={setShowKeywordSuggestionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {language === "ko" ? "검색 키워드 없음" : "No Search Keywords"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ko"
                ? "검색 키워드가 선택되지 않았습니다. AI가 생성하는 키워드 중 가장 적합한 것으로 자동 검색할까요?"
                : "No search keywords were selected. Would you like to auto-search with the best AI-generated keyword?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeywordSuggestionCancel}>
              {language === "ko" ? "직접 입력할게요" : "I'll add keywords myself"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleKeywordSuggestionConfirm}>
              {language === "ko" ? "네, AI 키워드로 검색" : "Yes, search with AI keyword"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
