"use client";

import React, { useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Rocket,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Layers,
  Zap,
  Film,
  Square,
  Activity,
  Disc,
  Briefcase,
  Cloud,
  Bold,
  Lightbulb,
  Loader2,
  X,
  Star,
  Check,
  type LucideIcon,
} from "lucide-react";
import {
  useProcessingSessionStore,
  selectOriginalVideo,
  selectSession,
  selectSelectedStyles,
  selectIsGeneratingVariations,
  selectVariations,
  STYLE_SETS,
} from "@/lib/stores/processing-session-store";

// Icon mapping for style sets
const STYLE_ICONS: Record<string, LucideIcon> = {
  viral_tiktok: Zap,
  cinematic_mood: Film,
  clean_minimal: Square,
  energetic_beat: Activity,
  retro_aesthetic: Disc,
  professional_corp: Briefcase,
  dreamy_soft: Cloud,
  bold_impact: Bold,
};

interface ReadyViewProps {
  className?: string;
  onGoToVariation: () => void;
  onGoToPublish: () => void;
  onStartGeneration?: () => void;
}

export function ReadyView({ className, onGoToVariation, onGoToPublish, onStartGeneration }: ReadyViewProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";
  const router = useRouter();

  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);
  const selectedStyles = useProcessingSessionStore(selectSelectedStyles);
  const isGeneratingVariations = useProcessingSessionStore(selectIsGeneratingVariations);
  const variations = useProcessingSessionStore(selectVariations);
  const toggleStyleSelection = useProcessingSessionStore((state) => state.toggleStyleSelection);
  const selectAllStyles = useProcessingSessionStore((state) => state.selectAllStyles);
  const clearStyleSelection = useProcessingSessionStore((state) => state.clearStyleSelection);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Inline variation panel state
  const [showVariationPanel, setShowVariationPanel] = useState(false);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Handle loaded metadata
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Handle seek
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!videoRef.current || duration === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const seekTime = percentage * duration;
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    },
    [duration]
  );

  // Format time
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle download - fetch fresh presigned URL to avoid expiration issues
  const handleDownload = useCallback(async () => {
    if (!originalVideo?.outputUrl) return;

    try {
      // Get a fresh presigned URL from the download API
      const filename = `video-${session?.id || "output"}.mp4`;
      const response = await fetch(
        `/api/v1/assets/download?url=${encodeURIComponent(originalVideo.outputUrl)}&filename=${encodeURIComponent(filename)}`
      );

      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }

      const { downloadUrl } = await response.json();

      // Trigger download with fresh presigned URL
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback to direct URL (may fail if expired)
      const link = document.createElement("a");
      link.href = originalVideo.outputUrl;
      link.download = `video-${session?.id || "output"}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [originalVideo?.outputUrl, session?.id]);

  // Toggle variation panel
  const handleToggleVariationPanel = useCallback(() => {
    setShowVariationPanel((prev) => !prev);
  }, []);

  // Handle start generation from inline panel
  const handleStartVariationGeneration = useCallback(async () => {
    if (selectedStyles.length === 0) return;
    setIsStartingGeneration(true);
    try {
      if (onStartGeneration) {
        onStartGeneration();
      }
    } finally {
      setIsStartingGeneration(false);
    }
  }, [selectedStyles.length, onStartGeneration]);

  // Get generation progress stats
  const progressStats = useMemo(() => {
    const total = variations.length;
    const completed = variations.filter((v) => v.status === "completed").length;
    const failed = variations.filter((v) => v.status === "failed").length;
    const inProgress = total - completed - failed;
    return { total, completed, failed, inProgress };
  }, [variations]);

  // Calculate estimated time
  const estimatedTime = useMemo(() => {
    const count = selectedStyles.length;
    if (count === 0) return null;
    const minutesPerVideo = 2;
    const totalMinutes = count * minutesPerVideo;
    return isKorean ? `약 ${totalMinutes}분` : `~${totalMinutes} min`;
  }, [selectedStyles.length, isKorean]);

  // Can start generation check
  const canStart = selectedStyles.length > 0 && !isStartingGeneration;

  if (!session || !originalVideo) {
    return null;
  }

  return (
    <div className={cn("flex flex-col items-center py-8", className)}>
      {/* Success header */}
      <div className="flex items-center gap-2 mb-6">
        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        <h2 className="text-xl font-semibold text-neutral-900">
          {isKorean ? "영상 완성!" : "Video Complete!"}
        </h2>
      </div>

      {/* Main content - Video + Decision Cards */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-9 gap-8 px-4">
        {/* Left: Video Player (45%) */}
        <div className="lg:col-span-4">
          <Card className="bg-neutral-900 border-neutral-700 overflow-hidden">
            <CardContent className="p-0">
              {/* Video */}
              <div className="aspect-[9/16] max-h-[65vh] bg-black relative mx-auto">
                {originalVideo.outputUrl ? (
                  <video
                    ref={videoRef}
                    src={originalVideo.outputUrl}
                    className="w-full h-full object-contain cursor-pointer"
                    loop
                    playsInline
                    muted={isMuted}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onClick={togglePlay}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500">
                    {isKorean ? "영상 없음" : "No video"}
                  </div>
                )}

                {/* Play overlay when paused */}
                {!isPlaying && originalVideo.outputUrl && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20"
                    onClick={togglePlay}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-8 h-8 text-neutral-900 ml-1" />
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="p-4 bg-neutral-900 border-t border-neutral-800 space-y-3">
                {/* Progress bar */}
                {duration > 0 && (
                  <div
                    className="h-1.5 bg-neutral-700 rounded-full cursor-pointer group"
                    onClick={handleSeek}
                  >
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                )}

                {/* Control buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white"
                      onClick={togglePlay}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white"
                      onClick={toggleMute}
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </Button>
                    {duration > 0 && (
                      <span className="text-sm text-neutral-400 ml-2">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-neutral-400 hover:text-white hover:bg-white/10"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    {isKorean ? "다운로드" : "Download"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Decision Cards (55%) */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <h3 className="text-lg font-medium text-neutral-700 mb-4">
            {isKorean ? "다음 단계를 선택하세요" : "Choose your next step"}
          </h3>

          <div className="space-y-4">
            {/* Option 1: Direct Publish */}
            <Card
              className={cn(
                "border-2 border-neutral-200 hover:border-neutral-400 transition-all cursor-pointer group",
                "hover:shadow-lg"
              )}
              onClick={onGoToPublish}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-neutral-200 transition-colors">
                    <Rocket className="w-6 h-6 text-neutral-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-neutral-900 text-lg mb-1">
                      {isKorean ? "바로 배포하기" : "Publish Now"}
                    </h4>
                    <p className="text-sm text-neutral-500 mb-3">
                      {isKorean
                        ? "이 영상을 바로 배포합니다"
                        : "Publish this video immediately"}
                    </p>
                    <div className="flex items-center text-sm text-neutral-400">
                      <ChevronRight className="w-4 h-4 mr-1" />
                      {isKorean ? "플랫폼 선택으로 이동" : "Go to platform selection"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Option 2: Create Variations */}
            <Card
              className={cn(
                "border-2 transition-all group",
                (showVariationPanel || isGeneratingVariations)
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-200 hover:border-neutral-400 hover:shadow-lg cursor-pointer"
              )}
              onClick={isGeneratingVariations ? undefined : handleToggleVariationPanel}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    (showVariationPanel || isGeneratingVariations)
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200"
                  )}>
                    {isGeneratingVariations ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Layers className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-neutral-900 text-lg mb-1 flex items-center gap-2">
                      {isGeneratingVariations
                        ? (isKorean ? "베리에이션 생성 중..." : "Generating Variations...")
                        : (isKorean ? "베리에이션 만들기" : "Create Variations")}
                      {!isGeneratingVariations && (
                        <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 text-xs">
                          A/B Test
                        </Badge>
                      )}
                      {isGeneratingVariations && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                          {progressStats.completed}/{progressStats.total}
                        </Badge>
                      )}
                    </h4>
                    <p className="text-sm text-neutral-500 mb-3">
                      {isGeneratingVariations
                        ? (isKorean
                          ? "선택한 스타일로 영상을 생성하고 있습니다"
                          : "Generating videos with your selected styles")
                        : (isKorean
                          ? "8가지 스타일로 다양한 버전 생성 후 비교하여 선택"
                          : "Generate multiple versions with 8 different styles and compare")}
                    </p>
                    {!isGeneratingVariations && (
                      <div className="flex items-center text-sm text-neutral-400">
                        {showVariationPanel ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            {isKorean ? "접기" : "Collapse"}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            {isKorean ? "스타일 선택하기" : "Select styles"}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Info - hide when panel is open or generating */}
          {!showVariationPanel && !isGeneratingVariations && (
            <p className="text-xs text-neutral-400 mt-4 text-center">
              {isKorean
                ? "베리에이션으로 여러 스타일을 테스트하면 더 높은 참여율을 기대할 수 있습니다"
                : "Testing multiple styles with variations can lead to higher engagement"}
            </p>
          )}
        </div>
      </div>

      {/* Full-width Variation Panel below - Style Selection OR Progress */}
      {(showVariationPanel || isGeneratingVariations) && (
        <div className="w-full max-w-6xl px-4 mt-8 animate-in slide-in-from-top-2 duration-200">
          <Card className="border-2 border-neutral-200 bg-white">
            <CardContent className="p-6">
              {!isGeneratingVariations ? (
                /* Style Selection Mode */
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {isKorean ? "생성할 스타일 선택" : "Select Styles to Generate"}
                      <span className="text-neutral-400 font-normal ml-2">(1-8개)</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllStyles();
                        }}
                      >
                        {isKorean ? "전체 선택" : "Select All"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearStyleSelection();
                        }}
                      >
                        {isKorean ? "선택 해제" : "Clear"}
                      </Button>
                    </div>
                  </div>

                  {/* Style grid - wider layout */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    {STYLE_SETS.map((style) => {
                      const Icon: LucideIcon = STYLE_ICONS[style.id] || Zap;
                      const isSelected = selectedStyles.includes(style.id);

                      return (
                        <div
                          key={style.id}
                          className={cn(
                            "relative p-4 rounded-xl border-2 cursor-pointer transition-all",
                            isSelected
                              ? "border-neutral-900 bg-neutral-50"
                              : "border-neutral-200 hover:border-neutral-300 bg-white"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStyleSelection(style.id);
                          }}
                        >
                          {/* Checkbox */}
                          <div className="absolute top-2 right-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleStyleSelection(style.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="data-[state=checked]:bg-neutral-900 data-[state=checked]:border-neutral-900"
                            />
                          </div>

                          {/* Icon */}
                          <div
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center mb-3 mx-auto",
                              isSelected ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
                            )}
                          >
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* Text */}
                          <h4 className="font-medium text-neutral-900 text-sm text-center mb-1">
                            {isKorean ? style.nameKo : style.name}
                          </h4>
                          <p className="text-xs text-neutral-500 text-center line-clamp-2">
                            {isKorean ? style.descriptionKo : style.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer info & Start Button */}
                  <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-neutral-600">
                        {isKorean ? "선택됨:" : "Selected:"}{" "}
                        <span className="font-semibold text-neutral-900">{selectedStyles.length}개</span>
                      </span>
                      {estimatedTime && (
                        <span className="text-neutral-500">
                          {isKorean ? "예상 시간:" : "Est. time:"} {estimatedTime}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-neutral-500">
                        <Lightbulb className="w-4 h-4" />
                        {isKorean
                          ? "3-5개 스타일 선택 시 효과적인 A/B 테스트가 가능합니다"
                          : "Selecting 3-5 styles enables effective A/B testing"}
                      </span>
                    </div>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartVariationGeneration();
                      }}
                      disabled={!canStart}
                      size="lg"
                      className="bg-neutral-900 hover:bg-neutral-800 text-white"
                    >
                      {isStartingGeneration ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isKorean ? "시작 중..." : "Starting..."}
                        </>
                      ) : (
                        <>
                          <Rocket className="w-4 h-4 mr-2" />
                          {isKorean ? "베리에이션 생성 시작" : "Start Variations"}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                /* Generation Progress Mode - Full Width */
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {isKorean ? "베리에이션 생성 진행 상황" : "Variation Generation Progress"}
                    </h3>
                    <Badge variant="secondary" className="bg-neutral-100 text-base px-3 py-1">
                      {progressStats.completed}/{progressStats.total}{" "}
                      {isKorean ? "완료" : "completed"}
                    </Badge>
                  </div>

                  {/* Progress cards grid - horizontal layout */}
                  <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4">
                    {/* Original - always complete */}
                    <div className="p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50">
                      <div className="aspect-[9/16] bg-black rounded-lg mb-2 relative overflow-hidden">
                        {originalVideo?.thumbnailUrl || originalVideo?.outputUrl ? (
                          <img
                            src={originalVideo.thumbnailUrl || originalVideo.outputUrl}
                            alt="Original"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Check className="w-8 h-8 text-emerald-500" />
                          </div>
                        )}
                        <Badge className="absolute top-1.5 left-1.5 bg-amber-500/90 text-white gap-1 text-[10px] px-1.5 py-0.5">
                          <Star className="w-2.5 h-2.5 fill-white" />
                          {isKorean ? "원본" : "Original"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-medium">
                        <Check className="w-3.5 h-3.5" />
                        {isKorean ? "완료" : "Done"}
                      </div>
                    </div>

                    {/* Variation cards */}
                    {variations.map((variation) => {
                      const Icon: LucideIcon = STYLE_ICONS[variation.styleId] || Zap;
                      const isComplete = variation.status === "completed";
                      const isFailed = variation.status === "failed";
                      const isInProgress = variation.status === "generating";

                      return (
                        <div
                          key={variation.id}
                          className={cn(
                            "p-3 rounded-xl border-2 transition-all",
                            isComplete && "border-emerald-200 bg-emerald-50",
                            isFailed && "border-red-200 bg-red-50",
                            !isComplete && !isFailed && "border-neutral-200 bg-white"
                          )}
                        >
                          <div className="aspect-[9/16] bg-neutral-100 rounded-lg mb-2 relative overflow-hidden flex items-center justify-center">
                            {isComplete && variation.thumbnailUrl ? (
                              <img
                                src={variation.thumbnailUrl}
                                alt={variation.styleName}
                                className="w-full h-full object-cover"
                              />
                            ) : isComplete ? (
                              <Check className="w-8 h-8 text-emerald-500" />
                            ) : isFailed ? (
                              <X className="w-8 h-8 text-red-500" />
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
                                <span className="text-lg font-bold text-neutral-600">
                                  {variation.progress}%
                                </span>
                              </div>
                            )}

                            {/* Style badge */}
                            <Badge
                              variant="secondary"
                              className="absolute top-1.5 left-1.5 bg-neutral-800/80 text-white text-[10px] px-1.5 py-0.5"
                            >
                              {isKorean ? variation.styleNameKo : variation.styleName}
                            </Badge>
                          </div>

                          {/* Status */}
                          {isComplete && (
                            <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-medium">
                              <Check className="w-3.5 h-3.5" />
                              {isKorean ? "완료" : "Done"}
                            </div>
                          )}
                          {isFailed && (
                            <div className="flex items-center justify-center gap-1 text-red-600 text-xs font-medium">
                              <X className="w-3.5 h-3.5" />
                              {isKorean ? "실패" : "Failed"}
                            </div>
                          )}
                          {isInProgress && (
                            <div className="space-y-1.5">
                              <Progress value={variation.progress} className="h-1.5" />
                              <p className="text-[10px] text-neutral-500 text-center truncate">
                                {variation.currentStep || (isKorean ? "처리 중..." : "Processing...")}
                              </p>
                            </div>
                          )}
                          {variation.status === "pending" && (
                            <p className="text-xs text-neutral-400 text-center">
                              {isKorean ? "대기 중" : "Pending"}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer message */}
                  <div className="mt-6 pt-4 border-t border-neutral-200">
                    <p className="text-sm text-neutral-500 text-center flex items-center justify-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      {isKorean
                        ? "모든 베리에이션이 완료되면 자동으로 비교 화면으로 이동합니다"
                        : "You'll be automatically redirected to comparison view when all variations are complete"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
