"use client";

import React from "react";
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

interface GeneratingViewProps {
  className?: string;
}

export function GeneratingView({ className }: GeneratingViewProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);

  if (!session || !originalVideo) {
    return null;
  }

  const { content } = session;

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
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-8 px-4">
        {/* Left: Video Preview Area (60%) */}
        <div className="lg:col-span-3">
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
                <Progress value={progressPercent} className="h-1.5 mb-3" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">{currentStep}</span>
                  <span className="text-neutral-500">{estimateRemainingTime()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Content Summary (40%) */}
        <div className="lg:col-span-2">
          <Card className="bg-white border-neutral-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-500" />
                {isKorean ? "콘텐츠 요약" : "Content Summary"}
              </h3>

              <div className="space-y-4">
                {/* Script */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <FileText className="w-4 h-4" />
                    {isKorean ? "스크립트" : "Script"}
                  </div>
                  <p className="text-sm text-neutral-700 line-clamp-2 bg-neutral-50 rounded-lg p-2.5">
                    {content.script || (isKorean ? "스크립트 없음" : "No script")}
                  </p>
                </div>

                {/* Images */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <ImageIcon className="w-4 h-4" />
                    {isKorean ? "이미지" : "Images"}
                  </div>
                  <div className="flex items-center gap-2">
                    {content.images.slice(0, 3).map((img, idx) => (
                      <div
                        key={img.id || idx}
                        className="w-12 h-12 rounded-md bg-neutral-100 overflow-hidden border border-neutral-200"
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
                    {content.images.length > 3 && (
                      <div className="w-12 h-12 rounded-md bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs text-neutral-500 font-medium">
                        +{content.images.length - 3}
                      </div>
                    )}
                    {content.images.length === 0 && (
                      <span className="text-sm text-neutral-400">
                        {isKorean ? "이미지 없음" : "No images"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Music */}
                {content.musicTrack && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <Music className="w-4 h-4" />
                      {isKorean ? "음악" : "Music"}
                    </div>
                    <div className="flex items-center gap-2 bg-neutral-50 rounded-lg p-2.5">
                      <Music className="w-4 h-4 text-neutral-400" />
                      <div>
                        <p className="text-sm text-neutral-700">{content.musicTrack.name}</p>
                        <p className="text-xs text-neutral-500">
                          {Math.floor(content.musicTrack.duration / 60)}:
                          {String(content.musicTrack.duration % 60).padStart(2, "0")}
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
