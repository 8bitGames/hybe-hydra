"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Star,
  Layers,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { ProcessingVideo } from "@/lib/stores/workflow-store";

interface ComparePanelProps {
  videos: ProcessingVideo[];
  onClose: () => void;
  onApprove: (videoId: string) => void;
  onReject: (videoId: string) => void;
}

export function ComparePanel({
  videos,
  onClose,
  onApprove,
  onReject,
}: ComparePanelProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Sync playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Video refs for synchronized playback
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Initialize refs array
  useEffect(() => {
    videoRefs.current = videos.map(() => null);
  }, [videos]);

  // Sync all videos
  const syncVideos = useCallback((action: "play" | "pause" | "seek", seekTime?: number) => {
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
  }, []);

  // Toggle play/pause for all
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      syncVideos("pause");
      setIsPlaying(false);
    } else {
      syncVideos("play");
      setIsPlaying(true);
    }
  }, [isPlaying, syncVideos]);

  // Toggle mute for all
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    videoRefs.current.forEach((video) => {
      if (video) {
        video.muted = newMuted;
      }
    });
    setIsMuted(newMuted);
  }, [isMuted]);

  // Reset all videos to beginning
  const resetAll = useCallback(() => {
    syncVideos("seek", 0);
    setCurrentTime(0);
  }, [syncVideos]);

  // Handle time update from first video (master)
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);
  }, []);

  // Handle loaded metadata to get duration
  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.duration > duration) {
      setDuration(video.duration);
    }
  }, [duration]);

  // Handle seek bar click
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * duration;
    syncVideos("seek", seekTime);
    setCurrentTime(seekTime);
  }, [duration, syncVideos]);

  // Format time display
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if video is original or variation
  const getVideoLabel = (video: ProcessingVideo) => {
    if (video.id.includes("-var-")) {
      const metadata = video.metadata as Record<string, unknown>;
      return metadata?.variationLabel as string || (isKorean ? "베리에이션" : "Variation");
    }
    return isKorean ? "원본" : "Original";
  };

  // Get grid columns based on video count
  const getGridCols = () => {
    if (videos.length <= 2) return "grid-cols-2";
    if (videos.length <= 4) return "grid-cols-2 lg:grid-cols-4";
    return "grid-cols-2 lg:grid-cols-4 xl:grid-cols-6";
  };

  return (
    <Card
      className={cn(
        "border-2 border-neutral-300 bg-neutral-900 rounded-xl overflow-hidden",
        isFullscreen && "fixed inset-4 z-50"
      )}
    >
      <CardContent className="p-0 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700 bg-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-neutral-700 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">
                {isKorean ? "비디오 비교" : "Compare Videos"}
              </h3>
              <p className="text-xs text-neutral-400">
                {videos.length} {isKorean ? "개 영상 비교 중" : "videos comparing"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-neutral-400 hover:text-white hover:bg-neutral-700"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-neutral-400 hover:text-white hover:bg-neutral-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Videos Grid */}
        <div className="flex-1 min-h-0 p-4 overflow-auto">
          <div className={cn("grid gap-4", getGridCols())}>
            {videos.map((video, index) => (
              <div key={video.id} className="relative">
                {/* Video Container */}
                <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative">
                  {video.outputUrl ? (
                    <video
                      ref={(el) => {
                        videoRefs.current[index] = el;
                      }}
                      src={video.outputUrl}
                      className="w-full h-full object-contain"
                      loop
                      playsInline
                      muted={isMuted}
                      onTimeUpdate={index === 0 ? handleTimeUpdate : undefined}
                      onLoadedMetadata={handleLoadedMetadata}
                      onClick={togglePlay}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-500">
                      {isKorean ? "영상 없음" : "No video"}
                    </div>
                  )}

                  {/* Label Badge */}
                  <div className="absolute top-2 left-2">
                    {video.id.includes("-var-") ? (
                      <Badge variant="secondary" className="bg-neutral-700/80 text-white text-[10px]">
                        {getVideoLabel(video)}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/80 text-white gap-1 text-[10px]">
                        <Star className="w-3 h-3 fill-white" />
                        {getVideoLabel(video)}
                      </Badge>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-2 right-2">
                    {video.status === "approved" && (
                      <Badge className="bg-emerald-500/80 text-white gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                      </Badge>
                    )}
                    {video.status === "rejected" && (
                      <Badge className="bg-neutral-500/80 text-white gap-1">
                        <ThumbsDown className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Video Info & Actions */}
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-neutral-400 truncate" title={video.prompt}>
                    {video.prompt}
                  </p>
                  {video.status === "completed" && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs bg-transparent border-emerald-600 text-emerald-500 hover:bg-emerald-600 hover:text-white"
                        onClick={() => onApprove(video.id)}
                      >
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {isKorean ? "승인" : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs bg-transparent border-neutral-600 text-neutral-400 hover:bg-neutral-600 hover:text-white"
                        onClick={() => onReject(video.id)}
                      >
                        <ThumbsDown className="w-3 h-3 mr-1" />
                        {isKorean ? "거부" : "Reject"}
                      </Button>
                    </div>
                  )}
                  {video.status === "approved" && (
                    <div className="flex items-center justify-center gap-1 py-1 px-2 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-400 text-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      {isKorean ? "승인됨" : "Approved"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="px-5 py-4 border-t border-neutral-700 bg-neutral-800">
          {/* Progress Bar */}
          {duration > 0 && (
            <div
              className="h-1.5 bg-neutral-700 rounded-full cursor-pointer mb-4 group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-white rounded-full transition-all group-hover:h-2 group-hover:-mt-0.5"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Left Controls */}
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

            {/* Right Info */}
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <span>
                {isKorean ? "동기화 재생" : "Synced Playback"}
              </span>
              <Badge variant="outline" className="border-neutral-600 text-neutral-400">
                {videos.filter((v) => v.status === "approved").length} / {videos.length}{" "}
                {isKorean ? "승인" : "approved"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact compare button to trigger the panel
export function CompareButton({
  selectedCount,
  onClick,
  disabled,
}: {
  selectedCount: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Only enable if 2 or more videos selected
  const isEnabled = selectedCount >= 2 && !disabled;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={!isEnabled}
      className={cn(
        "h-9 gap-1.5",
        isEnabled
          ? "border-neutral-400 text-neutral-700 hover:bg-neutral-100"
          : "border-neutral-200 text-neutral-400"
      )}
    >
      <Layers className="w-4 h-4" />
      {isKorean ? "비교" : "Compare"}
      {selectedCount >= 2 && (
        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
          {selectedCount}
        </Badge>
      )}
    </Button>
  );
}
