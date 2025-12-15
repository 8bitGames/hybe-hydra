"use client";

import React, { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Loader2,
  FileText,
  Image as ImageIcon,
  Music,
  Sparkles,
} from "lucide-react";
import {
  useProcessingSessionStore,
  selectOriginalVideo,
  selectSession,
} from "@/lib/stores/processing-session-store";
import { useFastCut } from "@/lib/stores/fast-cut-context";
import { useWorkflowStore } from "@/lib/stores/workflow-store";

interface GeneratingViewProps {
  className?: string;
}

export function GeneratingView({ className }: GeneratingViewProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);

  // Get images from fast-cut context (for fast-cut mode)
  const { selectedImages: fastCutImages } = useFastCut();

  // Get images from workflow store (for AI video mode)
  const analyzeAssets = useWorkflowStore((state) => state.analyze.assets);
  const previewImage = useWorkflowStore((state) => state.analyze.previewImage);

  if (!session || !originalVideo) {
    return null;
  }

  const { content } = session;
  const isAIVideo = session.contentType === "ai_video";

  // Get images based on content type
  const displayImages = useMemo(() => {
    // First try session images (already populated during initSession)
    if (content.images && content.images.length > 0) {
      return content.images;
    }

    // AI Video mode: get from workflow store
    if (isAIVideo) {
      const images: Array<{ id: string; url: string; thumbnailUrl: string }> = [];

      // Add preview image if available
      if (previewImage?.imageUrl) {
        images.push({
          id: previewImage.previewId || "preview",
          url: previewImage.imageUrl,
          thumbnailUrl: previewImage.imageUrl,
        });
      }

      // Add analyze assets (image type)
      if (analyzeAssets && analyzeAssets.length > 0) {
        analyzeAssets
          .filter((asset) => asset.type === "image")
          .forEach((asset) => {
            images.push({
              id: asset.id,
              url: asset.url,
              thumbnailUrl: asset.url,
            });
          });
      }

      if (images.length > 0) {
        return images;
      }
    }

    // Fast-cut mode: get from fast-cut context
    if (!isAIVideo && fastCutImages && fastCutImages.length > 0) {
      return fastCutImages.map((img) => ({
        id: img.id,
        url: img.sourceUrl || "",
        thumbnailUrl: img.thumbnailUrl || img.sourceUrl || "",
      }));
    }

    return [];
  }, [content.images, isAIVideo, previewImage, analyzeAssets, fastCutImages]);

  // Format progress percentage
  const progressPercent = originalVideo.progress || 0;

  // Get current step text
  const currentStep = originalVideo.currentStep || (isKorean ? "준비 중..." : "Preparing...");

  // Estimate remaining time (rough calculation based on progress)
  const estimateRemainingTime = () => {
    if (progressPercent === 0) return isKorean ? "계산 중..." : "Calculating...";
    if (progressPercent >= 95) return isKorean ? "거의 완료" : "Almost done";

    // Rough estimate: assume 2 minutes total for a 30-second video
    const totalSeconds = 120;
    const remainingSeconds = Math.round((totalSeconds * (100 - progressPercent)) / 100);

    if (remainingSeconds < 60) {
      return isKorean ? `약 ${remainingSeconds}초` : `~${remainingSeconds}s`;
    }
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return isKorean ? `약 ${mins}분 ${secs}초` : `~${mins}m ${secs}s`;
  };

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[60vh]", className)}>
      {/* Main content area */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 gap-8 px-4">
        {/* Left: Video Preview Area (40%) */}
        <div className="lg:col-span-2">
          <Card className="bg-neutral-900 border-neutral-700 overflow-hidden">
            <CardContent className="p-0">
              {/* Video frame placeholder */}
              <div className="aspect-[9/16] max-h-[70vh] bg-black relative flex items-center justify-center mx-auto">
                {/* Progress circle */}
                <div className="relative">
                  {/* Outer ring */}
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-neutral-800"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      className="text-white transition-all duration-500"
                      strokeDasharray={`${2 * Math.PI * 58}`}
                      strokeDashoffset={`${2 * Math.PI * 58 * (1 - progressPercent / 100)}`}
                    />
                  </svg>
                  {/* Center content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{progressPercent}%</span>
                    <Loader2 className="w-4 h-4 text-neutral-400 animate-spin mt-1" />
                  </div>
                </div>

                {/* 9:16 badge */}
                <Badge
                  variant="secondary"
                  className="absolute top-4 right-4 bg-neutral-800/80 text-neutral-300 text-xs"
                >
                  9:16
                </Badge>
              </div>

              {/* Progress info below video */}
              <div className="p-4 bg-neutral-900 border-t border-neutral-800">
                <Progress value={progressPercent} className="h-1.5 mb-3 bg-neutral-600 [&>div]:bg-white" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">{currentStep}</span>
                  <span className="text-neutral-500">{estimateRemainingTime()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Content Summary (60%) */}
        <div className="lg:col-span-3">
          <Card className="bg-white border-neutral-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-500" />
                {isKorean ? "콘텐츠 요약" : "Content Summary"}
              </h3>

              {isAIVideo ? (
                /* AI Video: Script left, Image right (horizontal layout) */
                <div className="flex gap-4">
                  {/* Left: Script */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <FileText className="w-4 h-4" />
                      {isKorean ? "스크립트" : "Script"}
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3 max-h-[300px] overflow-y-auto">
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap break-words leading-relaxed">
                        {content.script || (isKorean ? "스크립트 없음" : "No script")}
                      </p>
                    </div>
                  </div>

                  {/* Right: Single Image */}
                  <div className="w-[180px] flex-shrink-0 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <ImageIcon className="w-4 h-4" />
                      {isKorean ? "이미지" : "Image"}
                    </div>
                    {displayImages.length > 0 ? (
                      <div className="aspect-[9/16] w-full rounded-lg bg-neutral-100 overflow-hidden border border-neutral-200">
                        {displayImages[0].thumbnailUrl || displayImages[0].url ? (
                          <img
                            src={displayImages[0].thumbnailUrl || displayImages[0].url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-neutral-400" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400">
                        {isKorean ? "이미지 없음" : "No image"}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Fast Cut: Script on top, Images below (vertical layout) */
                <div className="space-y-4">
                  {/* Script */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <FileText className="w-4 h-4" />
                      {isKorean ? "스크립트" : "Script"}
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap break-words leading-relaxed">
                        {content.script || (isKorean ? "스크립트 없음" : "No script")}
                      </p>
                    </div>
                  </div>

                  {/* Images: Horizontal scroll */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <ImageIcon className="w-4 h-4" />
                      {isKorean ? "이미지" : "Images"}
                      {displayImages.length > 0 && (
                        <span className="text-xs text-neutral-400">({displayImages.length})</span>
                      )}
                    </div>
                    {displayImages.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {displayImages.map((img, idx) => (
                          <div
                            key={img.id || idx}
                            className="w-[80px] h-[142px] flex-shrink-0 rounded-lg bg-neutral-100 overflow-hidden border border-neutral-200"
                          >
                            {img.thumbnailUrl || img.url ? (
                              <img
                                src={img.thumbnailUrl || img.url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-neutral-400" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400">
                        {isKorean ? "이미지 없음" : "No images"}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Music & Effects row */}
              {(content.musicTrack || content.effectPreset) && (
                <div className="flex gap-4 mt-4 pt-4 border-t border-neutral-100">
                  {/* Music */}
                  {content.musicTrack && (
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <Music className="w-4 h-4" />
                        {isKorean ? "음악" : "Music"}
                      </div>
                      <div className="flex items-center gap-2 bg-neutral-50 rounded-lg p-2.5">
                        <Music className="w-4 h-4 text-neutral-400" />
                        <div>
                          <p className="text-sm text-neutral-700">{content.musicTrack.name}</p>
                          <p className="text-xs text-neutral-500">
                            {isKorean ? "시작" : "Start"}: {Math.floor(content.musicTrack.startTime / 60)}:
                            {String(Math.floor(content.musicTrack.startTime % 60)).padStart(2, "0")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Effect Preset */}
                  {content.effectPreset && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <Sparkles className="w-4 h-4" />
                        {isKorean ? "이펙트" : "Effects"}
                      </div>
                      <Badge variant="secondary" className="bg-neutral-100 text-neutral-700">
                        {content.effectPreset.name}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info message */}
          <div className="mt-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
            <p className="text-sm text-neutral-600 text-center">
              {isKorean
                ? "생성이 완료되면 바로 확인할 수 있습니다"
                : "You can preview immediately once generation completes"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
