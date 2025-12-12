"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ModalVideoPlayerProps {
  src: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  autoPlay?: boolean;
  className?: string;
}

export function ModalVideoPlayer({
  src,
  aspectRatio = "16:9",
  autoPlay = true,
  className,
}: ModalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const isPortrait = aspectRatio === "9:16";

  console.log("[ModalVideoPlayer] Render:", { src: src?.substring(0, 60), aspectRatio, isPortrait });

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  }, [isPlaying]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    hideControlsAfterDelay();
  }, [hideControlsAfterDelay]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Auto-play on mount
  useEffect(() => {
    if (!autoPlay || !videoRef.current) return;

    const video = videoRef.current;
    const tryPlay = () => {
      console.log("[ModalVideoPlayer] Attempting autoplay...");
      video.play()
        .then(() => console.log("[ModalVideoPlayer] Autoplay success"))
        .catch((e) => {
          console.log("[ModalVideoPlayer] Autoplay failed, trying muted:", e.message);
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
    };

    if (video.readyState >= 3) {
      tryPlay();
    } else {
      video.addEventListener("canplay", tryPlay, { once: true });
      return () => video.removeEventListener("canplay", tryPlay);
    }
  }, [autoPlay, src]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Calculate container dimensions
  const containerStyle = isPortrait
    ? { height: "70vh", width: "auto", maxWidth: "100%" }
    : { width: "100%", aspectRatio: "16/9" };

  return (
    <div
      ref={containerRef}
      className={cn("relative bg-black", className)}
      style={containerStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        muted={isMuted}
        playsInline
        preload="auto"
        onClick={togglePlay}
        onPlay={() => {
          console.log("[ModalVideoPlayer] onPlay fired");
          setIsPlaying(true);
          setIsLoading(false);
          hideControlsAfterDelay();
        }}
        onPause={() => {
          console.log("[ModalVideoPlayer] onPause fired");
          setIsPlaying(false);
          setShowControls(true);
        }}
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            const v = videoRef.current;
            console.log("[ModalVideoPlayer] Metadata:", {
              videoWidth: v.videoWidth,
              videoHeight: v.videoHeight,
              duration: v.duration,
            });
            setDuration(v.duration);
            v.volume = 0.5;
          }
        }}
        onCanPlay={() => {
          console.log("[ModalVideoPlayer] canPlay fired");
          setIsLoading(false);
        }}
        onError={(e) => {
          console.error("[ModalVideoPlayer] Error:", e.currentTarget.error);
          setHasError(true);
          setIsLoading(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
        }}
      />

      {/* Loading */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
          <AlertCircle className="h-10 w-10 mb-2 text-red-400" />
          <p className="text-sm mb-3">Failed to load video</p>
          <button
            onClick={() => window.open(src, "_blank")}
            className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded"
          >
            Open in new tab
          </button>
        </div>
      )}

      {/* Play overlay */}
      {!isPlaying && !isLoading && !hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30">
            <Play className="h-8 w-8 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 transition-opacity",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Progress */}
        <div
          className="h-1 bg-zinc-600 rounded cursor-pointer mb-2"
          onClick={(e) => {
            if (!videoRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            videoRef.current.currentTime = pos * duration;
          }}
        >
          <div
            className="h-full bg-white rounded"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={togglePlay} className="p-2 text-white hover:bg-white/10 rounded">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play();
                }
              }}
              className="p-2 text-white hover:bg-white/10 rounded"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={toggleMute} className="p-2 text-white hover:bg-white/10 rounded">
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="text-xs text-white/80 ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <button
            onClick={() => containerRef.current?.requestFullscreen?.()}
            className="p-2 text-white hover:bg-white/10 rounded"
          >
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
