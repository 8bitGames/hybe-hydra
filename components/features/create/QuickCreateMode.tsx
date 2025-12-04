"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  promptApi,
  PromptTransformResponse,
  quickCreateApi,
  QuickCreateGeneration,
} from "@/lib/video-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Zap,
  ArrowRight,
  Info,
  TrendingUp,
  FolderOpen,
  Play,
  RotateCcw,
  Download,
  Check,
  Film,
  Wand2,
  Image as ImageIcon,
  Music,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SaveToCampaignModal } from "./SaveToCampaignModal";

// Video type for Quick Create
type VideoType = "ai" | "compose";

interface QuickCreateModeProps {
  className?: string;
  onModeSwitch?: () => void;
}

type QuickCreateState =
  | "idle"
  | "transforming"
  | "generating"
  | "completed"
  | "failed";

// Compose generation step
type ComposeStep = "script" | "images" | "render";

// Compose generation result type
interface QuickComposeResult {
  id: string;
  status: string;
  progress: number;
  output_url: string | null;
  error_message?: string;
  script_lines?: number;
  image_count?: number;
  vibe?: string;
}

/**
 * Quick Create Mode - Simplified 1-click video generation
 *
 * Design Intent:
 * - Campaign is OPTIONAL (not required)
 * - Direct API call to /api/v1/quick-create
 * - Show generation progress and result
 * - Save to Campaign modal after completion
 * - Support both AI Video (VEO) and Compose Video (image slideshow)
 */
export function QuickCreateMode({
  className,
  onModeSwitch,
}: QuickCreateModeProps) {
  const { t, language } = useI18n();

  // Video type selection
  const [videoType, setVideoType] = useState<VideoType>("ai");

  // Form state
  const [prompt, setPrompt] = useState("");
  const [transformedPrompt, setTransformedPrompt] =
    useState<PromptTransformResponse | null>(null);

  // Generation state
  const [state, setState] = useState<QuickCreateState>("idle");
  const [generation, setGeneration] = useState<QuickCreateGeneration | null>(
    null
  );
  const [composeResult, setComposeResult] = useState<QuickComposeResult | null>(
    null
  );
  const [composeStep, setComposeStep] = useState<ComposeStep>("script");
  const [error, setError] = useState("");

  // Save to campaign modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedToCampaign, setSavedToCampaign] = useState(false);

  // Poll for generation status
  const pollGenerationStatus = useCallback(async (generationId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const result = await quickCreateApi.get(generationId);
        if (result.error) {
          clearInterval(pollInterval);
          setState("failed");
          setError(result.error.message);
          return;
        }

        if (result.data) {
          setGeneration(result.data);

          if (result.data.status === "completed") {
            clearInterval(pollInterval);
            setState("completed");
          } else if (result.data.status === "failed") {
            clearInterval(pollInterval);
            setState("failed");
            setError(
              result.data.error_message ||
                (language === "ko" ? "영상 생성 실패" : "Video generation failed")
            );
          }
        }
      } catch {
        clearInterval(pollInterval);
        setState("failed");
        setError(
          language === "ko" ? "상태 확인 중 오류 발생" : "Error checking status"
        );
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [language]);

  // Transform prompt with AI
  const handleTransformPrompt = async () => {
    if (!prompt.trim()) {
      setError(
        language === "ko" ? "프롬프트를 입력해주세요" : "Please enter a prompt"
      );
      return;
    }

    setError("");
    setState("transforming");

    try {
      const result = await promptApi.transform({
        user_input: prompt.trim(),
        safety_level: "high",
      });

      if (result.error) {
        setError(result.error.message);
        setState("idle");
        return;
      }

      if (result.data) {
        setTransformedPrompt(result.data);

        if (result.data.status === "blocked") {
          setError(
            result.data.blocked_reason || "Prompt blocked due to safety concerns"
          );
          setState("idle");
        } else {
          setState("idle");
        }
      }
    } catch {
      setError(
        language === "ko" ? "프롬프트 최적화 실패" : "Failed to optimize prompt"
      );
      setState("idle");
    }
  };

  // Start Quick Create generation (AI Video)
  const handleQuickGenerate = async () => {
    if (!prompt.trim()) {
      setError(
        language === "ko" ? "프롬프트를 입력해주세요" : "Please enter a prompt"
      );
      return;
    }

    setError("");
    setState("generating");
    setSavedToCampaign(false);

    try {
      const result = await quickCreateApi.create({
        prompt: transformedPrompt?.veo_prompt || prompt.trim(),
        aspect_ratio: "9:16", // TikTok/Reels optimized
        duration_seconds: 5,
      });

      if (result.error) {
        setError(result.error.message);
        setState("failed");
        return;
      }

      if (result.data) {
        setGeneration(result.data);
        // Start polling for status
        pollGenerationStatus(result.data.id);
      }
    } catch {
      setError(
        language === "ko" ? "영상 생성 시작 실패" : "Failed to start generation"
      );
      setState("failed");
    }
  };

  // Poll for Quick Compose status
  const pollComposeStatus = useCallback(async (generationId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/quick-create/compose/${generationId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        });

        if (!response.ok) {
          clearInterval(pollInterval);
          setState("failed");
          setError(language === "ko" ? "상태 확인 실패" : "Status check failed");
          return;
        }

        const data = await response.json();
        setComposeResult(data);

        // Update step based on progress
        if (data.progress < 30) {
          setComposeStep("script");
        } else if (data.progress < 60) {
          setComposeStep("images");
        } else {
          setComposeStep("render");
        }

        if (data.status === "completed") {
          clearInterval(pollInterval);
          setState("completed");
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setState("failed");
          setError(
            data.error_message ||
              (language === "ko" ? "영상 생성 실패" : "Video generation failed")
          );
        }
      } catch {
        clearInterval(pollInterval);
        setState("failed");
        setError(
          language === "ko" ? "상태 확인 중 오류 발생" : "Error checking status"
        );
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [language]);

  // Start Quick Compose generation
  const handleQuickCompose = async () => {
    if (!prompt.trim()) {
      setError(
        language === "ko" ? "프롬프트를 입력해주세요" : "Please enter a prompt"
      );
      return;
    }

    setError("");
    setState("generating");
    setComposeStep("script");
    setComposeResult(null);
    setSavedToCampaign(false);

    try {
      const response = await fetch("/api/v1/quick-create/compose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspect_ratio: "9:16",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setError(error.detail || "Failed to start compose");
        setState("failed");
        return;
      }

      const data = await response.json();
      setComposeResult(data);
      // Start polling for status
      pollComposeStatus(data.id);
    } catch {
      setError(
        language === "ko" ? "영상 생성 시작 실패" : "Failed to start generation"
      );
      setState("failed");
    }
  };

  // Reset and create new
  const handleReset = () => {
    setState("idle");
    setGeneration(null);
    setComposeResult(null);
    setComposeStep("script");
    setPrompt("");
    setTransformedPrompt(null);
    setError("");
    setSavedToCampaign(false);
  };

  // Get current generation ID (AI or Compose)
  const getCurrentGenerationId = () => {
    if (videoType === "ai") {
      return generation?.id;
    }
    return composeResult?.id;
  };

  // Get current output URL
  const getCurrentOutputUrl = () => {
    if (videoType === "ai") {
      return generation?.output_url;
    }
    return composeResult?.output_url;
  };

  // Render compose progress
  const renderComposeProgress = () => {
    if (!composeResult) return null;

    const steps = [
      { key: "script", label: language === "ko" ? "스크립트 생성" : "Generating Script", icon: Wand2 },
      { key: "images", label: language === "ko" ? "이미지 검색" : "Searching Images", icon: ImageIcon },
      { key: "render", label: language === "ko" ? "영상 렌더링" : "Rendering Video", icon: Film },
    ];

    return (
      <div className="space-y-4">
        {/* Step Progress */}
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = step.key === composeStep;
            const isCompleted = steps.findIndex(s => s.key === composeStep) > idx;

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg transition-all",
                    isActive && "bg-primary/10",
                    isCompleted && "text-green-600"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      isActive && "bg-primary text-primary-foreground",
                      isCompleted && "bg-green-500 text-white",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : isActive ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium hidden sm:inline",
                    isActive && "text-primary",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-2",
                    isCompleted ? "bg-green-500" : "bg-muted"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {composeStep === "script" && (language === "ko" ? "AI가 스크립트를 생성하고 있습니다..." : "AI is generating script...")}
              {composeStep === "images" && (language === "ko" ? "이미지를 검색하고 있습니다..." : "Searching for images...")}
              {composeStep === "render" && (language === "ko" ? "영상을 렌더링하고 있습니다..." : "Rendering video...")}
            </span>
            <span className="font-medium">{composeResult.progress}%</span>
          </div>
          <Progress value={composeResult.progress} className="h-2" />
        </div>

        {/* Additional Info */}
        {composeResult.vibe && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{composeResult.vibe}</Badge>
            {composeResult.script_lines && (
              <span className="text-muted-foreground">
                {composeResult.script_lines} {language === "ko" ? "씬" : "scenes"}
              </span>
            )}
            {composeResult.image_count && (
              <span className="text-muted-foreground">
                {composeResult.image_count} {language === "ko" ? "이미지" : "images"}
              </span>
            )}
          </div>
        )}

        {/* Silent Video Notice */}
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
          <VolumeX className="h-4 w-4" />
          <span>
            {language === "ko"
              ? "Quick Compose는 음악 없이 생성됩니다. 캠페인에 저장 후 음악을 추가할 수 있습니다."
              : "Quick Compose creates silent videos. Add music after saving to a campaign."}
          </span>
        </div>
      </div>
    );
  };

  // Handle successful save to campaign
  const handleSavedToCampaign = () => {
    setSavedToCampaign(true);
    setShowSaveModal(false);
  };

  // Render generation progress/result
  const renderGenerationStatus = () => {
    const outputUrl = getCurrentOutputUrl();
    const generationId = getCurrentGenerationId();

    // For Compose video type
    if (videoType === "compose") {
      return (
        <div className="space-y-4">
          {/* Progress */}
          {state === "generating" && renderComposeProgress()}

          {/* Completed - Video Player */}
          {state === "completed" && outputUrl && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[400px] mx-auto">
                <video
                  src={outputUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Type Badge */}
              <div className="flex items-center justify-center gap-2">
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-500">
                  <Film className="h-3 w-3 mr-1" />
                  Compose Video
                </Badge>
                <Badge variant="outline">
                  <VolumeX className="h-3 w-3 mr-1" />
                  {language === "ko" ? "무음" : "Silent"}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {language === "ko" ? "새로 만들기" : "Create New"}
                </Button>

                <Button
                  variant="outline"
                  asChild
                  className="flex-1"
                >
                  <a
                    href={outputUrl}
                    download={`quick-compose-${generationId}.mp4`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {language === "ko" ? "다운로드" : "Download"}
                  </a>
                </Button>

                {!savedToCampaign ? (
                  <Button
                    onClick={() => setShowSaveModal(true)}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    {language === "ko" ? "캠페인에 저장" : "Save to Campaign"}
                  </Button>
                ) : (
                  <Button
                    disabled
                    variant="outline"
                    className="flex-1 text-green-600 border-green-600"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {language === "ko" ? "저장 완료" : "Saved"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Failed */}
          {state === "failed" && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-lg text-center">
                <p className="text-destructive font-medium">
                  {language === "ko" ? "영상 생성 실패" : "Video Generation Failed"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button onClick={handleReset} variant="outline" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                {language === "ko" ? "다시 시도" : "Try Again"}
              </Button>
            </div>
          )}
        </div>
      );
    }

    // For AI Video type
    if (!generation) return null;

    return (
      <div className="space-y-4">
        {/* Progress */}
        {state === "generating" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {language === "ko" ? "영상 생성 중..." : "Generating video..."}
              </span>
              <span className="font-medium">{generation.progress}%</span>
            </div>
            <Progress value={generation.progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {language === "ko"
                ? "AI가 영상을 생성하고 있습니다. 약 1-2분 소요됩니다."
                : "AI is generating your video. This takes about 1-2 minutes."}
            </p>
          </div>
        )}

        {/* Completed - Video Player */}
        {state === "completed" && generation.output_url && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[400px] mx-auto">
              <video
                src={generation.output_url}
                controls
                autoPlay
                loop
                muted
                className="w-full h-full object-contain"
              />
            </div>

            {/* Type Badge */}
            <div className="flex items-center justify-center">
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Video
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {language === "ko" ? "새로 만들기" : "Create New"}
              </Button>

              <Button
                variant="outline"
                asChild
                className="flex-1"
              >
                <a
                  href={generation.output_url}
                  download={`quick-create-${generation.id}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {language === "ko" ? "다운로드" : "Download"}
                </a>
              </Button>

              {!savedToCampaign ? (
                <Button
                  onClick={() => setShowSaveModal(true)}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {language === "ko" ? "캠페인에 저장" : "Save to Campaign"}
                </Button>
              ) : (
                <Button
                  disabled
                  variant="outline"
                  className="flex-1 text-green-600 border-green-600"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {language === "ko" ? "저장 완료" : "Saved"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Failed */}
        {state === "failed" && (
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-lg text-center">
              <p className="text-destructive font-medium">
                {language === "ko" ? "영상 생성 실패" : "Video Generation Failed"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              {language === "ko" ? "다시 시도" : "Try Again"}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Video Type Selector */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center p-1 bg-muted/50 rounded-xl">
          <button
            onClick={() => {
              setVideoType("ai");
              handleReset();
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              videoType === "ai"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span>{language === "ko" ? "AI 영상" : "AI Video"}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-500">
              VEO
            </Badge>
          </button>
          <button
            onClick={() => {
              setVideoType("compose");
              handleReset();
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              videoType === "compose"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Film className="h-4 w-4" />
            <span>{language === "ko" ? "Compose 영상" : "Compose Video"}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-500">
              {language === "ko" ? "이미지" : "Image"}
            </Badge>
          </button>
        </div>
      </div>

      {/* Two column layout for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Column - Quick Create Card */}
        <Card className={cn(
          "border-2 bg-gradient-to-br to-transparent flex flex-col",
          videoType === "ai"
            ? "border-primary/20 from-primary/5"
            : "border-purple-500/20 from-purple-500/5"
        )}>
          <CardContent className="pt-6 flex-1 flex flex-col">
            {/* Show input or result based on state */}
            {state === "idle" || state === "transforming" ? (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  {videoType === "ai" ? (
                    <Zap className="h-6 w-6 text-primary" />
                  ) : (
                    <Film className="h-6 w-6 text-purple-500" />
                  )}
                  <h2 className="font-semibold text-xl">
                    {language === "ko"
                      ? "무엇을 만들까요?"
                      : "What would you like to create?"}
                  </h2>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setTransformedPrompt(null);
                    setError("");
                  }}
                  placeholder={
                    language === "ko"
                      ? "영상 아이디어를 자유롭게 적어주세요. 한국어 또는 영어로 입력하세요.\n예: 밤하늘 아래 춤추는 소녀, 네온 불빛이 반짝이는 도시"
                      : "Describe your video idea freely. Write in Korean or English.\nExample: A girl dancing under the night sky, neon lights twinkling in the city"
                  }
                  rows={5}
                  className="w-full px-4 py-4 bg-background border border-input rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-lg"
                />

                {/* Quick Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>{t.createPage.hints.quickModeInfo}</span>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}

                {/* Optimized Prompt Preview */}
                {transformedPrompt?.status === "success" && (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium text-sm">
                        {language === "ko"
                          ? "프롬프트 최적화 완료"
                          : "Prompt Optimized"}
                      </span>
                    </div>
                    {transformedPrompt.analysis?.trend_applied?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {transformedPrompt.analysis.trend_applied.map(
                          (trend) => (
                            <Badge
                              key={trend}
                              variant="secondary"
                              className="text-xs"
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {trend}
                            </Badge>
                          )
                        )}
                      </div>
                    )}
                    <details className="cursor-pointer">
                      <summary className="text-xs text-muted-foreground hover:text-foreground">
                        {language === "ko"
                          ? "최적화된 프롬프트 보기"
                          : "View optimized prompt"}
                      </summary>
                      <p className="mt-2 text-sm text-foreground bg-muted p-3 rounded-lg break-words">
                        {transformedPrompt.veo_prompt}
                      </p>
                    </details>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-4">
                  {videoType === "ai" && (
                    <Button
                      onClick={handleTransformPrompt}
                      variant="outline"
                      disabled={state === "transforming" || !prompt.trim()}
                      className="flex-1"
                    >
                      {state === "transforming" ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2" />
                          {language === "ko" ? "최적화 중..." : "Optimizing..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          {language === "ko" ? "AI로 최적화" : "Optimize with AI"}
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    onClick={videoType === "ai" ? handleQuickGenerate : handleQuickCompose}
                    disabled={!prompt.trim() || state === "transforming"}
                    className={cn(
                      "flex-1",
                      videoType === "ai"
                        ? "bg-primary hover:bg-primary/90"
                        : "bg-purple-500 hover:bg-purple-500/90"
                    )}
                    size="lg"
                  >
                    {videoType === "ai" ? (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        {language === "ko" ? "AI 영상 생성" : "Generate AI Video"}
                      </>
                    ) : (
                      <>
                        <Film className="h-4 w-4 mr-2" />
                        {language === "ko" ? "Compose 영상 생성" : "Generate Compose Video"}
                      </>
                    )}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Generating / Completed / Failed state */
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  {state === "generating" && (
                    <>
                      <Spinner className="h-6 w-6 text-primary" />
                      <h2 className="font-semibold text-xl">
                        {language === "ko"
                          ? "영상 생성 중..."
                          : "Generating Video..."}
                      </h2>
                    </>
                  )}
                  {state === "completed" && (
                    <>
                      <Play className="h-6 w-6 text-green-600" />
                      <h2 className="font-semibold text-xl">
                        {language === "ko" ? "완료!" : "Complete!"}
                      </h2>
                    </>
                  )}
                  {state === "failed" && (
                    <>
                      <Zap className="h-6 w-6 text-destructive" />
                      <h2 className="font-semibold text-xl">
                        {language === "ko" ? "생성 실패" : "Generation Failed"}
                      </h2>
                    </>
                  )}
                </div>

                <div className="flex-1">{renderGenerationStatus()}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Info & Tips */}
        <div className="flex flex-col gap-6">
          {/* Quick Create Info - Dynamic based on video type */}
          <Card className="flex-1 flex flex-col">
            <CardContent className="pt-6 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                {videoType === "ai" ? (
                  <Zap className="h-6 w-6 text-primary" />
                ) : (
                  <Film className="h-6 w-6 text-purple-500" />
                )}
                <h2 className="font-semibold text-xl">
                  {videoType === "ai"
                    ? (language === "ko" ? "AI 영상" : "AI Video")
                    : (language === "ko" ? "Compose 영상" : "Compose Video")}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {language === "ko" ? "캠페인 불필요" : "No Campaign Required"}
                </Badge>
              </div>

              <div className="space-y-4 flex-1">
                <p className="text-muted-foreground">
                  {videoType === "ai"
                    ? (language === "ko"
                        ? "프롬프트만 입력하면 AI가 영상을 직접 생성합니다. VEO 모델을 사용하여 고품질 영상을 만듭니다."
                        : "Just enter a prompt and AI will generate the video directly. Uses VEO model to create high-quality videos.")
                    : (language === "ko"
                        ? "프롬프트를 기반으로 AI가 스크립트를 작성하고, 이미지를 검색하여 슬라이드쇼 영상을 생성합니다."
                        : "AI writes a script based on your prompt, searches for images, and creates a slideshow video.")}
                </p>

                <div className="space-y-3">
                  {videoType === "ai" ? (
                    <>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {language === "ko" ? "기본 설정" : "Default Settings"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "ko"
                              ? "9:16 세로 영상 | 5초 | TikTok/Reels 최적화"
                              : "9:16 vertical | 5 seconds | TikTok/Reels optimized"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {language === "ko" ? "AI 최적화" : "AI Optimization"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "ko"
                              ? "트렌드 키워드와 스타일을 자동으로 적용합니다"
                              : "Automatically applies trending keywords and styles"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FolderOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {language === "ko" ? "나중에 저장" : "Save Later"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "ko"
                              ? "생성 후 원하는 캠페인에 저장할 수 있습니다"
                              : "Save to any campaign after generation"}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Wand2 className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {language === "ko" ? "AI 스크립트" : "AI Script"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "ko"
                              ? "프롬프트를 기반으로 자동 스크립트 생성"
                              : "Auto-generates script from your prompt"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <ImageIcon className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {language === "ko" ? "이미지 검색" : "Image Search"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "ko"
                              ? "키워드 기반 고품질 이미지 자동 선별"
                              : "Auto-selects high-quality images by keywords"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <VolumeX className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {language === "ko" ? "무음 영상" : "Silent Video"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "ko"
                              ? "캠페인에 저장 후 음악을 추가할 수 있습니다"
                              : "Add music after saving to a campaign"}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Need more control hint */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <button onClick={onModeSwitch} className="w-full text-left">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">
                      {t.createPage.hints.needMoreControl}
                    </p>
                    <p className="text-primary">
                      {language === "ko"
                        ? "상세 모드로 전환 →"
                        : "Switch to detailed mode →"}
                    </p>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save to Campaign Modal */}
      {getCurrentGenerationId() && (
        <SaveToCampaignModal
          open={showSaveModal}
          onOpenChange={setShowSaveModal}
          generationId={getCurrentGenerationId()!}
          onSaved={handleSavedToCampaign}
        />
      )}
    </div>
  );
}
