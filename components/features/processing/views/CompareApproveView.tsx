"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
  Star,
  ChevronRight,
} from "lucide-react";
import {
  useProcessingSessionStore,
  selectOriginalVideo,
  selectSession,
  selectVariations,
  VariationVideo,
} from "@/lib/stores/processing-session-store";

interface CompareApproveViewProps {
  className?: string;
  onBack: () => void;
  onPublish: () => void;
}

export function CompareApproveView({
  className,
  onBack,
  onPublish,
}: CompareApproveViewProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);
  const variations = useProcessingSessionStore(selectVariations);

  const approveVideo = useProcessingSessionStore((state) => state.approveVideo);
  const rejectVideo = useProcessingSessionStore((state) => state.rejectVideo);
  const approveAll = useProcessingSessionStore((state) => state.approveAll);
  const rejectAll = useProcessingSessionStore((state) => state.rejectAll);
  const getApprovalCounts = useProcessingSessionStore((state) => state.getApprovalCounts);

  // Sync playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Video refs - original + variations
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Original video approval state (always approved by default)
  const [originalApproved, setOriginalApproved] = useState(true);

  // Get completed variations only
  const completedVariations = variations.filter((v) => v.status === "completed" && v.outputUrl);

  // Total videos (original + completed variations)
  const totalVideos = 1 + completedVariations.length;

  // Initialize refs
  useEffect(() => {
    videoRefs.current = Array(totalVideos).fill(null);
  }, [totalVideos]);

  // Sync all videos
  const syncVideos = useCallback(
    (action: "play" | "pause" | "seek", seekTime?: number) => {
      videoRefs.current.forEach((video) => {
        if (video) {
          if (action === "play") {
            video.play().catch(() => {});
          } else if (action === "pause") {
            video.pause();
          } else if (action === "seek" && seekTime !== undefined) {
            video.currentTime = seekTime;
          }
        }
      });
    },
    []
  );

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      syncVideos("pause");
      setIsPlaying(false);
    } else {
      syncVideos("play");
      setIsPlaying(true);
    }
  }, [isPlaying, syncVideos]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    videoRefs.current.forEach((video) => {
      if (video) {
        video.muted = newMuted;
      }
    });
    setIsMuted(newMuted);
  }, [isMuted]);

  // Reset all
  const resetAll = useCallback(() => {
    syncVideos("seek", 0);
    setCurrentTime(0);
  }, [syncVideos]);

  // Handle time update
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);
  }, []);

  // Handle loaded metadata
  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      if (video.duration > duration) {
        setDuration(video.duration);
      }
    },
    [duration]
  );

  // Handle seek
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const seekTime = percentage * duration;
      syncVideos("seek", seekTime);
      setCurrentTime(seekTime);
    },
    [duration, syncVideos]
  );

  // Format time
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get approval counts
  const approvalCounts = getApprovalCounts();
  const approvedCount = (originalApproved ? 1 : 0) + completedVariations.filter((v) => v.approval === "approved").length;
  const totalApprovalCount = totalVideos;

  // Check if can publish
  const canPublish = approvedCount > 0;

  if (!session || !originalVideo) {
    return null;
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {isKorean ? "설정으로" : "Back to settings"}
        </Button>

        <h2 className="text-lg font-semibold text-neutral-900">
          {isKorean ? "비교 및 최종 선택" : "Compare & Select"}
        </h2>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-neutral-100">
            {isKorean ? "승인:" : "Approved:"} {approvedCount}/{totalApprovalCount}
          </Badge>
          <Button
            onClick={onPublish}
            disabled={!canPublish}
            className="bg-neutral-900 hover:bg-neutral-800 text-white"
          >
            {isKorean ? "배포하기" : "Publish"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Video comparison grid */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="flex gap-4 pb-4">
            {/* Original video card */}
            <div className="shrink-0 w-64">
              <Card
                className={cn(
                  "overflow-hidden border-2 transition-all",
                  originalApproved ? "border-emerald-300 bg-emerald-50/50" : "border-neutral-200"
                )}
              >
                <CardContent className="p-0">
                  {/* Video */}
                  <div className="aspect-[9/16] bg-black relative">
                    {originalVideo.outputUrl ? (
                      <video
                        ref={(el) => {
                          videoRefs.current[0] = el;
                        }}
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

                    {/* Original badge */}
                    <Badge className="absolute top-2 left-2 bg-amber-500/90 text-white gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {isKorean ? "원본" : "Original"}
                    </Badge>

                    {/* Approval status badge */}
                    {originalApproved && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Approval buttons */}
                  <div className="p-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={originalApproved ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-9",
                        originalApproved
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                      )}
                      onClick={() => setOriginalApproved(true)}
                    >
                      <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                      {isKorean ? "승인" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant={!originalApproved ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-9",
                        !originalApproved
                          ? "bg-neutral-600 hover:bg-neutral-700 text-white"
                          : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                      )}
                      onClick={() => setOriginalApproved(false)}
                    >
                      <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                      {isKorean ? "거부" : "Reject"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Variation video cards */}
            {completedVariations.map((variation, index) => {
              const isApproved = variation.approval === "approved";
              const isRejected = variation.approval === "rejected";

              return (
                <div key={variation.id} className="shrink-0 w-64">
                  <Card
                    className={cn(
                      "overflow-hidden border-2 transition-all",
                      isApproved && "border-emerald-300 bg-emerald-50/50",
                      isRejected && "border-neutral-300 bg-neutral-50/50 opacity-60",
                      !isApproved && !isRejected && "border-neutral-200"
                    )}
                  >
                    <CardContent className="p-0">
                      {/* Video */}
                      <div className="aspect-[9/16] bg-black relative">
                        <video
                          ref={(el) => {
                            videoRefs.current[index + 1] = el;
                          }}
                          src={variation.outputUrl}
                          className="w-full h-full object-contain cursor-pointer"
                          loop
                          playsInline
                          muted={isMuted}
                          onLoadedMetadata={handleLoadedMetadata}
                          onClick={togglePlay}
                        />

                        {/* Style badge */}
                        <Badge
                          variant="secondary"
                          className="absolute top-2 left-2 bg-neutral-800/80 text-white"
                        >
                          {isKorean ? variation.styleNameKo : variation.styleName}
                        </Badge>

                        {/* Approval status */}
                        {isApproved && (
                          <div className="absolute top-2 right-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                        {isRejected && (
                          <div className="absolute top-2 right-2">
                            <div className="w-6 h-6 rounded-full bg-neutral-500 flex items-center justify-center">
                              <X className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Approval buttons */}
                      <div className="p-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isApproved ? "default" : "outline"}
                          className={cn(
                            "flex-1 h-9",
                            isApproved
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                          )}
                          onClick={() => approveVideo(variation.id)}
                        >
                          <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                          {isKorean ? "승인" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant={isRejected ? "default" : "outline"}
                          className={cn(
                            "flex-1 h-9",
                            isRejected
                              ? "bg-neutral-600 hover:bg-neutral-700 text-white"
                              : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                          )}
                          onClick={() => rejectVideo(variation.id)}
                        >
                          <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                          {isKorean ? "거부" : "Reject"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Playback controls */}
      <Card className="mt-4 shrink-0 bg-neutral-900 border-neutral-700">
        <CardContent className="p-4">
          {/* Progress bar */}
          {duration > 0 && (
            <div
              className="h-2 bg-neutral-700 rounded-full cursor-pointer mb-4 group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-white rounded-full transition-all group-hover:h-2.5 group-hover:-mt-0.25"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Left: Playback controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={resetAll}
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
              {duration > 0 && (
                <span className="text-sm text-neutral-400 ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
            </div>

            {/* Right: Bulk actions */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-400">
                {isKorean ? "동기화 재생" : "Synced Playback"}
              </span>
              <div className="h-4 w-px bg-neutral-700" />
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                onClick={approveAll}
              >
                <ThumbsUp className="w-4 h-4 mr-1.5" />
                {isKorean ? "모두 승인" : "Approve All"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
                onClick={rejectAll}
              >
                <ThumbsDown className="w-4 h-4 mr-1.5" />
                {isKorean ? "모두 거부" : "Reject All"}
              </Button>
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-neutral-500 mt-3 text-center">
            {isKorean
              ? "승인된 영상만 배포됩니다"
              : "Only approved videos will be published"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
