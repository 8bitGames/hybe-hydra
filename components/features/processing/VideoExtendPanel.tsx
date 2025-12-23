"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Film,
  Timer,
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
  X,
  AlertCircle,
  Clock,
  Maximize2,
  FileText,
  Music,
  ChevronDown,
  ChevronUp,
  Copy,
  Wand2,
  History,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  videoExtendApi,
  VideoExtendInfoResponse,
  VideoExtendResponse,
  ExtensionPromptGenerateResponse,
  ExtensionHistoryResponse,
  GenerationStatusResponse,
  AIJobPollResponse,
} from "@/lib/video-api";

// Panel states
type PanelState = "idle" | "processing" | "complete" | "error";

// Current video info that can be updated after extension
interface CurrentVideoInfo {
  id: string;
  videoUrl?: string;
  duration: number;
  aspectRatio: string;
  extensionCount: number;
}

interface VideoExtendPanelProps {
  generationId: string;
  videoUrl?: string;
  currentDuration: number;
  aspectRatio: string;
  extensionCount?: number;
  onClose: () => void;
  // Callback when extension completes with new generation info
  onExtensionComplete?: (newGeneration: {
    id: string;
    videoUrl: string;
    duration: number;
    extensionCount: number;
  }) => void;
  // Legacy callback for backwards compatibility
  onExtendStarted?: (newGenerationId: string, response: VideoExtendResponse) => void;
}

export function VideoExtendPanel({
  generationId,
  videoUrl,
  currentDuration,
  aspectRatio,
  extensionCount = 0,
  onClose,
  onExtensionComplete,
  onExtendStarted,
}: VideoExtendPanelProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Panel state machine
  const [panelState, setPanelState] = useState<PanelState>("idle");

  // Current video info (updates after each extension)
  const [currentVideo, setCurrentVideo] = useState<CurrentVideoInfo>({
    id: generationId,
    videoUrl,
    duration: currentDuration,
    aspectRatio,
    extensionCount,
  });

  // Extension info from API
  const [extendInfo, setExtendInfo] = useState<VideoExtendInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [userIdea, setUserIdea] = useState("");
  const [showOriginalPrompt, setShowOriginalPrompt] = useState(false);
  const [applyAudioAfter, setApplyAudioAfter] = useState(true);

  // AI enhancement state
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedResult, setEnhancedResult] = useState<ExtensionPromptGenerateResponse["generated"] | null>(null);
  const [showEnhanceDetails, setShowEnhanceDetails] = useState(false);

  // Processing state
  const [processingProgress, setProcessingProgress] = useState(0);
  const [newGenerationId, setNewGenerationId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingStartTimeRef = useRef<number | null>(null);
  const jobIdRef = useRef<string | null>(null); // Store job_id for polling

  // Version history
  const [showHistory, setShowHistory] = useState(false);
  const [extensionHistory, setExtensionHistory] = useState<ExtensionHistoryResponse | null>(null);

  // Fetch extension info for current video
  const fetchExtendInfo = useCallback(async (genId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await videoExtendApi.getInfo(genId);
      if (response.data) {
        setExtendInfo(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch extend info:", err);
      setError(isKorean ? "확장 정보를 불러올 수 없습니다" : "Failed to load extension info");
    } finally {
      setLoading(false);
    }
  }, [isKorean]);

  // Initial fetch
  useEffect(() => {
    fetchExtendInfo(currentVideo.id);
  }, [currentVideo.id, fetchExtendInfo]);

  // Fetch extension history
  const fetchHistory = useCallback(async () => {
    try {
      const response = await videoExtendApi.getHistory(currentVideo.id);
      if (response.data) {
        setExtensionHistory(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch extension history:", err);
    }
  }, [currentVideo.id]);

  // Start estimated progress animation (0-90% over ~70 seconds)
  const startProgressAnimation = useCallback(() => {
    processingStartTimeRef.current = Date.now();

    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // Update progress every 500ms based on elapsed time
    progressIntervalRef.current = setInterval(() => {
      if (!processingStartTimeRef.current) return;

      const elapsed = (Date.now() - processingStartTimeRef.current) / 1000; // seconds
      const estimatedTotal = 70; // Expected ~70 seconds for extension

      // Calculate progress: quick start, then slow down (logarithmic curve)
      // Goes from 0 to ~90% over the estimated time
      const rawProgress = Math.min(elapsed / estimatedTotal, 1);
      const easedProgress = 1 - Math.pow(1 - rawProgress, 2); // Ease out
      const displayProgress = Math.min(Math.round(easedProgress * 90), 90); // Cap at 90%

      setProcessingProgress(displayProgress);
    }, 500);
  }, []);

  // Stop progress animation
  const stopProgressAnimation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    processingStartTimeRef.current = null;
  }, []);

  // Poll for extension status using the new polling endpoint
  const pollExtensionStatus = useCallback(async (jobId: string, genId: string) => {
    try {
      // Use the new polling endpoint that updates DB and returns fresh status
      const response = await videoExtendApi.pollJobStatus(jobId);
      if (response.data) {
        const pollResult = response.data;

        // Only use API progress if it's meaningful (> current estimated progress)
        // Otherwise keep showing estimated progress
        if (pollResult.progress > 0 && pollResult.progress > processingProgress) {
          setProcessingProgress(pollResult.progress);
        }

        if (pollResult.is_final) {
          // Extension complete or failed
          stopProgressAnimation();
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          jobIdRef.current = null;

          if (pollResult.status === "completed" && pollResult.output_url) {
            setProcessingProgress(100);

            // Fetch the full generation info to get all fields
            const genResponse = await videoExtendApi.getStatus(genId);
            const genData = genResponse.data;

            // Update current video to the new extended video
            const newVideoInfo: CurrentVideoInfo = {
              id: pollResult.generation_id,
              videoUrl: pollResult.output_url,
              duration: genData?.duration_seconds || currentVideo.duration + 7,
              aspectRatio: genData?.aspect_ratio || currentVideo.aspectRatio,
              extensionCount: genData?.extension_count || currentVideo.extensionCount + 1,
            };
            setCurrentVideo(newVideoInfo);
            setPanelState("complete");

            // Notify parent
            onExtensionComplete?.({
              id: pollResult.generation_id,
              videoUrl: pollResult.output_url,
              duration: newVideoInfo.duration,
              extensionCount: newVideoInfo.extensionCount,
            });

            // Fetch updated extension info for the new video
            fetchExtendInfo(pollResult.generation_id);
          } else if (pollResult.status === "failed") {
            setError(isKorean ? "확장 실패" : "Extension failed");
            setPanelState("error");
          }
        }
      }
    } catch (err) {
      console.error("Failed to poll extension status:", err);
      // Don't stop polling on network errors
    }
  }, [isKorean, onExtensionComplete, fetchExtendInfo, processingProgress, stopProgressAnimation, currentVideo]);

  // Cleanup polling and progress animation on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      jobIdRef.current = null;
    };
  }, []);

  // Handle extend action
  const handleExtend = async () => {
    try {
      setError(null);
      setPanelState("processing");
      setProcessingProgress(0);

      const response = await videoExtendApi.extend(currentVideo.id, {
        prompt: prompt.trim() || undefined,
        apply_audio_after: applyAudioAfter && !!extendInfo?.audio_asset_id,
        audio_asset_id: applyAudioAfter ? extendInfo?.audio_asset_id || undefined : undefined,
      });

      if (response.data) {
        const newGenId = response.data.id;
        const jobId = response.data.job_id;
        setNewGenerationId(newGenId);
        jobIdRef.current = jobId;

        // Call legacy callback if provided
        onExtendStarted?.(newGenId, response.data);

        // Start progress animation for visual feedback
        startProgressAnimation();

        // Start polling for status using the new polling endpoint
        pollingRef.current = setInterval(() => {
          if (jobIdRef.current) {
            pollExtensionStatus(jobIdRef.current, newGenId);
          }
        }, 3000);

        // Initial poll
        if (jobId) {
          pollExtensionStatus(jobId, newGenId);
        }
      }
    } catch (err: unknown) {
      console.error("Failed to extend video:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(
        isKorean
          ? `영상 확장에 실패했습니다: ${errorMessage}`
          : `Failed to extend video: ${errorMessage}`
      );
      setPanelState("error");
    }
  };

  // Handle "Extend Again" - reset form for next extension
  const handleExtendAgain = () => {
    setPrompt("");
    setUserIdea("");
    setEnhancedResult(null);
    setShowEnhanceDetails(false);
    setPanelState("idle");
    jobIdRef.current = null;
    setNewGenerationId(null);
  };

  // Handle AI prompt enhancement
  const handleEnhancePrompt = async () => {
    if (!userIdea.trim()) {
      setError(isKorean ? "확장 아이디어를 입력해주세요" : "Please enter your extension idea");
      return;
    }

    try {
      setEnhancing(true);
      setError(null);
      const response = await videoExtendApi.generatePrompt(currentVideo.id, userIdea.trim());
      if (response.data?.success && response.data.generated) {
        setEnhancedResult(response.data.generated);
        setPrompt(response.data.generated.enhanced_prompt);
        setShowEnhanceDetails(true);
      }
    } catch (err: unknown) {
      console.error("Failed to enhance prompt:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(
        isKorean
          ? `프롬프트 생성에 실패했습니다: ${errorMessage}`
          : `Failed to generate prompt: ${errorMessage}`
      );
    } finally {
      setEnhancing(false);
    }
  };

  // Calculate new duration
  const newDuration = currentVideo.duration + 7;

  // Check if video can be extended
  const canExtend = extendInfo?.can_extend ?? false;
  const reasons = extendInfo?.reasons_cannot_extend;

  // Translations
  const t = {
    title: isKorean ? "AI 영상 확장" : "Extend AI Video",
    subtitle: isKorean
      ? "Veo 3.1을 사용하여 영상을 7초 연장합니다"
      : "Extend video by 7 seconds using Veo 3.1",
    currentVideo: isKorean ? "현재 영상" : "Current Video",
    afterExtend: isKorean ? "확장 후" : "After Extension",
    duration: isKorean ? "길이" : "Duration",
    aspectRatio: isKorean ? "화면비율" : "Aspect Ratio",
    extensionCount: isKorean ? "확장 횟수" : "Extensions",
    remaining: isKorean ? "남은 횟수" : "Remaining",
    promptLabel: isKorean ? "확장 프롬프트 (선택)" : "Extension Prompt (Optional)",
    promptPlaceholder: isKorean
      ? "영상이 어떻게 이어질지 설명해주세요... (비워두면 자동 생성)"
      : "Describe how the video should continue... (leave empty for auto)",
    extend: isKorean ? "확장하기" : "Extend Video",
    extending: isKorean ? "확장 중..." : "Extending...",
    extendAgain: isKorean ? "다시 확장하기" : "Extend Again",
    cannotExtend: isKorean ? "확장 불가" : "Cannot Extend",
    reasonNotCompleted: isKorean ? "영상이 완료되지 않았습니다" : "Video is not completed",
    reasonNotAI: isKorean ? "AI 생성 영상만 확장 가능합니다" : "Only AI-generated videos can be extended",
    reasonNoGCS: isKorean ? "GCS URI가 없습니다 (Veo 영상만 확장 가능)" : "No GCS URI (only Veo videos can be extended)",
    reasonMaxReached: isKorean ? "최대 확장 횟수(20회)에 도달했습니다" : "Maximum extensions (20) reached",
    seconds: isKorean ? "초" : "s",
    of: isKorean ? "/" : "of",
    // Processing state
    processing: isKorean ? "영상 확장 중" : "Extending Video",
    processingDesc: isKorean
      ? "AI가 영상을 분석하고 자연스럽게 이어지는 장면을 생성하고 있습니다"
      : "AI is analyzing the video and generating a seamless continuation",
    pleaseWait: isKorean ? "잠시만 기다려주세요..." : "Please wait...",
    // Complete state
    extensionComplete: isKorean ? "확장 완료!" : "Extension Complete!",
    extensionCompleteDesc: isKorean
      ? "영상이 성공적으로 확장되었습니다"
      : "Your video has been successfully extended",
    newDuration: isKorean ? "새로운 길이" : "New Duration",
    // History
    versionHistory: isKorean ? "버전 히스토리" : "Version History",
    original: isKorean ? "원본" : "Original",
    current: isKorean ? "현재" : "Current",
    // Other
    originalPrompt: isKorean ? "원본 프롬프트" : "Original Prompt",
    showOriginalPrompt: isKorean ? "원본 프롬프트 보기" : "Show Original Prompt",
    hideOriginalPrompt: isKorean ? "원본 프롬프트 숨기기" : "Hide Original Prompt",
    useAsBase: isKorean ? "베이스로 사용" : "Use as Base",
    copied: isKorean ? "복사됨" : "Copied",
    applyAudioAfter: isKorean ? "확장 후 음원 자동 적용" : "Apply audio after extension",
    applyAudioAfterDesc: isKorean
      ? "원본 영상에 사용된 음원을 확장된 영상에 자동으로 적용합니다"
      : "Automatically apply the original audio to the extended video",
    noAudioAvailable: isKorean ? "원본 영상에 음원이 없습니다" : "No audio in original video",
    yourIdea: isKorean ? "확장 아이디어" : "Your Idea",
    yourIdeaPlaceholder: isKorean
      ? "예: 트럭이 도로를 따라 멀어져간다..."
      : "e.g., The truck drives away down the road...",
    enhance: isKorean ? "AI 강화" : "AI Enhance",
    enhancing: isKorean ? "생성 중..." : "Enhancing...",
    enhancedPrompt: isKorean ? "AI 생성 프롬프트" : "AI Enhanced Prompt",
    showDetails: isKorean ? "세부정보 보기" : "Show Details",
    hideDetails: isKorean ? "세부정보 숨기기" : "Hide Details",
    continuityNotes: isKorean ? "연속성 노트" : "Continuity Notes",
    visualConsistency: isKorean ? "시각적 일관성" : "Visual Consistency",
    preservedElements: isKorean ? "유지된 요소" : "Preserved Elements",
    transitionType: isKorean ? "전환 유형" : "Transition Type",
    cinematicBreakdown: isKorean ? "시네마틱 분석" : "Cinematic Breakdown",
    safetyScore: isKorean ? "안전 점수" : "Safety Score",
    useEnhanced: isKorean ? "강화된 프롬프트 사용" : "Use Enhanced Prompt",
    editManually: isKorean ? "직접 수정" : "Edit Manually",
    retry: isKorean ? "다시 시도" : "Retry",
  };

  // Render cannot extend reasons
  const renderCannotExtendReasons = () => {
    if (!reasons) return null;
    const reasonsList: string[] = [];
    if (reasons.not_completed) reasonsList.push(t.reasonNotCompleted);
    if (reasons.not_ai_generated) reasonsList.push(t.reasonNotAI);
    if (reasons.no_gcs_uri) reasonsList.push(t.reasonNoGCS);
    if (reasons.max_extensions_reached) reasonsList.push(t.reasonMaxReached);

    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{t.cannotExtend}</span>
        </div>
        <ul className="text-sm text-red-600 space-y-1 ml-7">
          {reasonsList.map((reason, i) => (
            <li key={i}>• {reason}</li>
          ))}
        </ul>
      </div>
    );
  };

  // Render Processing State
  const renderProcessingState = () => (
    <div className="p-8 flex flex-col items-center justify-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center animate-pulse">
        <Sparkles className="w-10 h-10 text-white" />
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-neutral-900">{t.processing}</h3>
        <p className="text-sm text-neutral-500 max-w-sm">{t.processingDesc}</p>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <Progress value={processingProgress} className="h-2" />
        <div className="flex justify-between text-xs text-neutral-500">
          <span>{t.pleaseWait}</span>
          <span>{processingProgress}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{currentVideo.duration}s → {newDuration}s</span>
      </div>
    </div>
  );

  // Render Complete State
  const renderCompleteState = () => (
    <div className="space-y-5">
      {/* Success Banner */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-800">{t.extensionComplete}</h3>
            <p className="text-sm text-green-600">{t.extensionCompleteDesc}</p>
          </div>
        </div>
      </div>

      {/* New Video Preview */}
      {currentVideo.videoUrl && (
        <div className="rounded-lg overflow-hidden bg-black aspect-video">
          <video
            src={currentVideo.videoUrl}
            className="w-full h-full object-contain"
            controls
            autoPlay
            muted
            preload="metadata"
          />
        </div>
      )}

      {/* Updated Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-600" />
            <Label className="text-sm font-medium text-green-700">{t.newDuration}</Label>
          </div>
          <div className="text-2xl font-bold text-green-800">
            {currentVideo.duration}{t.seconds}
          </div>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-2">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-purple-600" />
            <Label className="text-sm font-medium text-purple-700">{t.extensionCount}</Label>
          </div>
          <div className="text-2xl font-bold text-purple-800">
            {currentVideo.extensionCount} / 20
          </div>
        </div>
      </div>

      {/* Can extend again? */}
      {currentVideo.extensionCount < 20 && (
        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-neutral-600">
                {isKorean
                  ? `+7초 더 확장 가능 (${20 - currentVideo.extensionCount}회 남음)`
                  : `Can extend +7s more (${20 - currentVideo.extensionCount} remaining)`}
              </span>
            </div>
            <Button
              onClick={handleExtendAgain}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {t.extendAgain}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // Render Error State
  const renderErrorState = () => (
    <div className="p-8 flex flex-col items-center justify-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-neutral-900">
          {isKorean ? "확장 실패" : "Extension Failed"}
        </h3>
        <p className="text-sm text-red-600 max-w-sm">{error}</p>
      </div>

      <Button
        onClick={() => {
          setError(null);
          setPanelState("idle");
        }}
        className="bg-neutral-900 text-white hover:bg-neutral-800"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {t.retry}
      </Button>
    </div>
  );

  // Render Idle State (main form)
  const renderIdleState = () => (
    <>
      {/* Cannot extend reasons */}
      {!canExtend && renderCannotExtendReasons()}

      {/* Video Preview */}
      {currentVideo.videoUrl && (
        <div className="rounded-lg overflow-hidden bg-black aspect-video">
          <video
            src={currentVideo.videoUrl}
            className="w-full h-full object-contain"
            controls
            muted
            preload="metadata"
          />
        </div>
      )}

      {/* Original Prompt Section */}
      {extendInfo?.original_prompt && (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <button
            onClick={() => setShowOriginalPrompt(!showOriginalPrompt)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-neutral-700">
                {t.originalPrompt}
              </span>
            </div>
            {showOriginalPrompt ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
          {showOriginalPrompt && (
            <div className="px-4 pb-4 space-y-3">
              <div className="p-3 bg-neutral-50 rounded-lg text-sm text-neutral-700 whitespace-pre-wrap">
                {extendInfo.original_prompt}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPrompt(extendInfo.original_prompt || "");
                  }}
                  className="h-8 text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  {t.useAsBase}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio Overlay Option */}
      {extendInfo?.audio_asset_id && canExtend && (
        <div className="p-4 bg-white rounded-lg border border-neutral-200 space-y-2">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="applyAudioAfter"
              checked={applyAudioAfter}
              onCheckedChange={(checked) => setApplyAudioAfter(checked === true)}
            />
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-green-500" />
              <Label
                htmlFor="applyAudioAfter"
                className="text-sm font-medium text-neutral-700 cursor-pointer"
              >
                {t.applyAudioAfter}
              </Label>
            </div>
          </div>
          <p className="text-xs text-neutral-500 ml-7">
            {t.applyAudioAfterDesc}
          </p>
        </div>
      )}

      {/* No Audio Notice */}
      {!extendInfo?.audio_asset_id && canExtend && (
        <div className="px-4 py-2 bg-neutral-100 rounded-lg">
          <p className="text-xs text-neutral-500 flex items-center gap-2">
            <Music className="w-3 h-3" />
            {t.noAudioAvailable}
          </p>
        </div>
      )}

      {/* Extension Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Current Video Info */}
        <div className="p-4 bg-white rounded-lg border border-neutral-200 space-y-3">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-neutral-500" />
            <Label className="text-sm font-medium text-neutral-600">
              {t.currentVideo}
            </Label>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t.duration}
              </span>
              <span className="text-sm font-semibold">
                {currentVideo.duration}{t.seconds}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 flex items-center gap-1">
                <Maximize2 className="w-3 h-3" />
                {t.aspectRatio}
              </span>
              <span className="text-sm font-semibold">{currentVideo.aspectRatio}</span>
            </div>
          </div>
        </div>

        {/* After Extension Info */}
        <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200 space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-purple-500" />
            <Label className="text-sm font-medium text-purple-700">
              {t.afterExtend}
            </Label>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t.duration}
              </span>
              <span className="text-sm font-bold text-purple-700">
                {newDuration}{t.seconds}
                <span className="text-xs font-normal ml-1 text-green-600">(+7s)</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-500 flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {t.extensionCount}
              </span>
              <span className="text-sm font-semibold text-purple-700">
                {currentVideo.extensionCount + 1} {t.of} 20
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Extension Count Progress */}
      {extendInfo?.extension_info && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">{t.remaining}</span>
            <span className="font-medium">
              {(extendInfo.extension_info.remaining_extensions || 20) - 1} {isKorean ? "회 남음" : "left"}
            </span>
          </div>
          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
              style={{
                width: `${((currentVideo.extensionCount + 1) / 20) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* AI Prompt Enhancement Section */}
      {canExtend && (
        <div className="space-y-4">
          {/* User Idea Input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-500" />
              {t.yourIdea}
            </Label>
            <div className="flex gap-2">
              <Textarea
                placeholder={t.yourIdeaPlaceholder}
                value={userIdea}
                onChange={(e) => setUserIdea(e.target.value)}
                rows={2}
                className="resize-none flex-1"
                disabled={enhancing}
              />
              <Button
                onClick={handleEnhancePrompt}
                disabled={enhancing || !userIdea.trim()}
                className="h-auto px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
              >
                {enhancing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span className="ml-1 hidden sm:inline">{t.enhance}</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-neutral-500">
              {isKorean
                ? "간단한 아이디어를 입력하면 AI가 원본 영상과 자연스럽게 이어지는 프롬프트를 생성합니다"
                : "Enter a simple idea and AI will generate a prompt that connects naturally with the original video"}
            </p>
          </div>

          {/* Enhanced Prompt Result */}
          {enhancedResult && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-purple-200 bg-white/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-purple-700">
                      {t.enhancedPrompt}
                    </span>
                    <Badge className="bg-green-100 text-green-700 text-[10px]">
                      {Math.round(enhancedResult.safety_score * 100)}% {t.safetyScore}
                    </Badge>
                  </div>
                  <button
                    onClick={() => setShowEnhanceDetails(!showEnhanceDetails)}
                    className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  >
                    {showEnhanceDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showEnhanceDetails ? t.hideDetails : t.showDetails}
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="p-3 bg-white rounded-lg text-sm text-neutral-700 whitespace-pre-wrap border border-neutral-200">
                  {prompt}
                </div>

                {showEnhanceDetails && (
                  <div className="space-y-3 pt-2 border-t border-purple-200">
                    <div className="text-xs">
                      <span className="font-medium text-purple-600">{t.continuityNotes}:</span>
                      <p className="text-neutral-600 mt-1">{enhancedResult.continuity_notes}</p>
                    </div>

                    <div className="text-xs">
                      <span className="font-medium text-purple-600">{t.visualConsistency}:</span>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500">{t.transitionType}:</span>
                          <Badge variant="outline" className="text-[10px]">
                            {enhancedResult.visual_consistency.transitionType}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {enhancedResult.visual_consistency.preservedElements.map((el, i) => (
                            <Badge key={i} className="bg-purple-100 text-purple-700 text-[10px]">
                              {el}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs">
                      <span className="font-medium text-purple-600">{t.cinematicBreakdown}:</span>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-neutral-600">
                        <span>Subject: {enhancedResult.cinematic_breakdown.subject}</span>
                        <span>Camera: {enhancedResult.cinematic_breakdown.camera}</span>
                        <span>Action: {enhancedResult.cinematic_breakdown.action}</span>
                        <span>Mood: {enhancedResult.cinematic_breakdown.mood}</span>
                      </div>
                    </div>

                    {enhancedResult.warnings.length > 0 && (
                      <div className="text-xs p-2 bg-yellow-50 rounded border border-yellow-200">
                        <span className="font-medium text-yellow-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Warnings:
                        </span>
                        <ul className="text-yellow-600 mt-1">
                          {enhancedResult.warnings.map((w, i) => (
                            <li key={i}>• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Prompt Input (fallback) */}
          {!enhancedResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-neutral-700">
                  {t.promptLabel}
                </Label>
                <span className="text-xs text-neutral-400">
                  {isKorean ? "또는 직접 프롬프트 입력" : "Or enter prompt directly"}
                </span>
              </div>
              <Textarea
                placeholder={t.promptPlaceholder}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Version History Section */}
      {currentVideo.extensionCount > 0 && (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory && !extensionHistory) {
                fetchHistory();
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-neutral-700">
                {t.versionHistory}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {currentVideo.extensionCount + 1} {isKorean ? "버전" : "versions"}
              </Badge>
            </div>
            {showHistory ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
          {showHistory && extensionHistory?.full_chain && (
            <div className="px-4 pb-4">
              <div className="space-y-2">
                {extensionHistory.full_chain.videos.map((video, index) => (
                  <div
                    key={video.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg text-sm",
                      video.is_current
                        ? "bg-purple-50 border border-purple-200"
                        : "bg-neutral-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">
                        {index === 0 ? t.original : `v${video.extension_number}`}
                      </span>
                      <span className="font-medium">{video.duration_seconds}s</span>
                      {video.is_current && (
                        <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                          {t.current}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-neutral-400">
                      {new Date(video.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && extendInfo && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </>
  );

  return (
    <Card className="border-2 border-neutral-200 bg-neutral-50 rounded-xl">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              panelState === "complete"
                ? "bg-gradient-to-br from-green-500 to-emerald-500"
                : panelState === "error"
                ? "bg-gradient-to-br from-red-500 to-orange-500"
                : "bg-gradient-to-br from-purple-500 to-blue-500"
            )}>
              {panelState === "complete" ? (
                <Check className="w-5 h-5 text-white" />
              ) : panelState === "error" ? (
                <AlertCircle className="w-5 h-5 text-white" />
              ) : panelState === "processing" ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">
                {panelState === "complete" ? t.extensionComplete : t.title}
              </h3>
              <p className="text-xs text-neutral-500">
                {panelState === "complete"
                  ? `${currentVideo.duration}${t.seconds} • ${currentVideo.extensionCount}x ${isKorean ? "확장됨" : "extended"}`
                  : t.subtitle}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            </div>
          ) : panelState === "processing" ? (
            renderProcessingState()
          ) : panelState === "complete" ? (
            renderCompleteState()
          ) : panelState === "error" ? (
            renderErrorState()
          ) : error && !extendInfo ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : (
            renderIdleState()
          )}
        </div>

        {/* Footer - Only show in idle state */}
        {panelState === "idle" && !loading && (
          <div className="px-5 py-4 border-t border-neutral-200 bg-white rounded-b-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">
                {isKorean
                  ? "Veo 3.1 API를 사용하여 영상을 자연스럽게 연장합니다"
                  : "Uses Veo 3.1 API to seamlessly extend the video"}
              </p>
              <Button
                onClick={handleExtend}
                disabled={!canExtend || loading}
                className={cn(
                  "h-10 px-6",
                  canExtend
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                    : "bg-neutral-200 text-neutral-500"
                )}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {t.extend}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact button to trigger the extend panel
export function VideoExtendButton({
  generationId,
  generationType,
  status,
  onClick,
  disabled,
}: {
  generationId: string;
  generationType: "AI" | "COMPOSE";
  status: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Only show for completed AI videos
  if (status.toLowerCase() !== "completed" || generationType !== "AI") {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-8 gap-1.5 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
    >
      <Sparkles className="w-3.5 h-3.5" />
      {isKorean ? "확장" : "Extend"}
    </Button>
  );
}

// Badge showing extension count
export function ExtensionBadge({
  extensionCount,
}: {
  extensionCount: number;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  if (!extensionCount || extensionCount === 0) return null;

  return (
    <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-[10px]">
      <Sparkles className="w-2.5 h-2.5 mr-1" />
      {extensionCount}x {isKorean ? "확장됨" : "extended"}
    </Badge>
  );
}
