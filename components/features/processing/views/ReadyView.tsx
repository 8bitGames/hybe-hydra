"use client";

import React, { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Rocket,
  Palette,
  ChevronRight,
  CheckCircle2,
  Layers,
} from "lucide-react";
import {
  useProcessingSessionStore,
  selectOriginalVideo,
  selectSession,
} from "@/lib/stores/processing-session-store";

interface ReadyViewProps {
  className?: string;
  onGoToVariation: () => void;
  onGoToPublish: () => void;
}

export function ReadyView({ className, onGoToVariation, onGoToPublish }: ReadyViewProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";
  const router = useRouter();

  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  // Handle download
  const handleDownload = useCallback(() => {
    if (originalVideo?.outputUrl) {
      const link = document.createElement("a");
      link.href = originalVideo.outputUrl;
      link.download = `video-${session?.id || "output"}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [originalVideo?.outputUrl, session?.id]);

  if (!session || !originalVideo) {
    return null;
  }

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[60vh]", className)}>
      {/* Success header */}
      <div className="flex items-center gap-2 mb-6">
        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        <h2 className="text-xl font-semibold text-neutral-900">
          {isKorean ? "영상 완성!" : "Video Complete!"}
        </h2>
      </div>

      {/* Main content */}
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
                "border-2 border-neutral-200 hover:border-neutral-400 transition-all cursor-pointer group",
                "hover:shadow-lg"
              )}
              onClick={onGoToVariation}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-neutral-200 transition-colors">
                    <Layers className="w-6 h-6 text-neutral-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-neutral-900 text-lg mb-1 flex items-center gap-2">
                      {isKorean ? "베리에이션 만들기" : "Create Variations"}
                      <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 text-xs">
                        A/B Test
                      </Badge>
                    </h4>
                    <p className="text-sm text-neutral-500 mb-3">
                      {isKorean
                        ? "8가지 스타일로 다양한 버전 생성 후 비교하여 선택"
                        : "Generate multiple versions with 8 different styles and compare"}
                    </p>
                    <div className="flex items-center text-sm text-neutral-400">
                      <ChevronRight className="w-4 h-4 mr-1" />
                      {isKorean ? "스타일 선택으로 이동" : "Go to style selection"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info */}
          <p className="text-xs text-neutral-400 mt-4 text-center">
            {isKorean
              ? "베리에이션으로 여러 스타일을 테스트하면 더 높은 참여율을 기대할 수 있습니다"
              : "Testing multiple styles with variations can lead to higher engagement"}
          </p>
        </div>
      </div>
    </div>
  );
}
