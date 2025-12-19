"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  videoExtendApi,
  VideoExtendInfoResponse,
  VideoExtendResponse,
} from "@/lib/video-api";

interface VideoExtendPanelProps {
  generationId: string;
  videoUrl?: string;
  currentDuration: number;
  aspectRatio: string;
  onClose: () => void;
  onExtendStarted?: (newGenerationId: string, response: VideoExtendResponse) => void;
}

export function VideoExtendPanel({
  generationId,
  videoUrl,
  currentDuration,
  aspectRatio,
  onClose,
  onExtendStarted,
}: VideoExtendPanelProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const [extendInfo, setExtendInfo] = useState<VideoExtendInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [showOriginalPrompt, setShowOriginalPrompt] = useState(false);
  const [applyAudioAfter, setApplyAudioAfter] = useState(true);

  // Fetch extension info
  useEffect(() => {
    const fetchExtendInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const info = await videoExtendApi.getInfo(generationId);
        setExtendInfo(info);
      } catch (err) {
        console.error("Failed to fetch extend info:", err);
        setError(isKorean ? "확장 정보를 불러올 수 없습니다" : "Failed to load extension info");
      } finally {
        setLoading(false);
      }
    };

    fetchExtendInfo();
  }, [generationId, isKorean]);

  // Handle extend action
  const handleExtend = async () => {
    try {
      setExtending(true);
      setError(null);
      const response = await videoExtendApi.extend(generationId, {
        prompt: prompt.trim() || undefined,
        apply_audio_after: applyAudioAfter && !!extendInfo?.audio_asset_id,
        audio_asset_id: applyAudioAfter ? extendInfo?.audio_asset_id || undefined : undefined,
      });
      onExtendStarted?.(response.id, response);
    } catch (err: unknown) {
      console.error("Failed to extend video:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(
        isKorean
          ? `영상 확장에 실패했습니다: ${errorMessage}`
          : `Failed to extend video: ${errorMessage}`
      );
    } finally {
      setExtending(false);
    }
  };

  // Calculate new duration
  const newDuration = currentDuration + 7;

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
    cannotExtend: isKorean ? "확장 불가" : "Cannot Extend",
    reasonNotCompleted: isKorean ? "영상이 완료되지 않았습니다" : "Video is not completed",
    reasonNotAI: isKorean ? "AI 생성 영상만 확장 가능합니다" : "Only AI-generated videos can be extended",
    reasonNoGCS: isKorean ? "GCS URI가 없습니다 (Veo 영상만 확장 가능)" : "No GCS URI (only Veo videos can be extended)",
    reasonMaxReached: isKorean ? "최대 확장 횟수(20회)에 도달했습니다" : "Maximum extensions (20) reached",
    seconds: isKorean ? "초" : "s",
    of: isKorean ? "/" : "of",
    // New translations
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

  return (
    <Card className="border-2 border-neutral-200 bg-neutral-50 rounded-xl">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">{t.title}</h3>
              <p className="text-xs text-neutral-500">{t.subtitle}</p>
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
          ) : error && !extendInfo ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <>
              {/* Cannot extend reasons */}
              {!canExtend && renderCannotExtendReasons()}

              {/* Video Preview (if available) */}
              {videoUrl && (
                <div className="rounded-lg overflow-hidden bg-black aspect-video">
                  <video
                    src={videoUrl}
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
                        {currentDuration}{t.seconds}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                        <Maximize2 className="w-3 h-3" />
                        {t.aspectRatio}
                      </span>
                      <span className="text-sm font-semibold">{aspectRatio}</span>
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
                        {(extendInfo?.extension_info?.current_extension_count || 0) + 1} {t.of} 20
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
                        width: `${(((extendInfo.extension_info.current_extension_count || 0) + 1) / 20) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Prompt Input */}
              {canExtend && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-neutral-700">
                    {t.promptLabel}
                  </Label>
                  <Textarea
                    placeholder={t.promptPlaceholder}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}

              {/* Error Message */}
              {error && extendInfo && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-200 bg-white rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              {isKorean
                ? "Veo 3.1 API를 사용하여 영상을 자연스럽게 연장합니다"
                : "Uses Veo 3.1 API to seamlessly extend the video"}
            </p>
            <Button
              onClick={handleExtend}
              disabled={!canExtend || extending || loading}
              className={cn(
                "h-10 px-6",
                canExtend
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                  : "bg-neutral-200 text-neutral-500"
              )}
            >
              {extending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.extending}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t.extend}
                </>
              )}
            </Button>
          </div>
        </div>
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
