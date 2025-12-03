"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { PlayCircle } from "lucide-react";

interface VideoPlayerProps {
  src: string | null | undefined;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  playOnHover?: boolean;
  soundOnHover?: boolean;
  onError?: (error: string) => void;
}

export function VideoPlayer({
  src,
  poster,
  className,
  autoPlay = false,
  muted = true,
  loop = false,
  controls = false,
  playOnHover = true,
  soundOnHover = true,
  onError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMouseEnter = () => {
    if (playOnHover && videoRef.current) {
      // Unmute when hovering if soundOnHover is enabled
      if (soundOnHover) {
        videoRef.current.muted = false;
        videoRef.current.volume = 0.1; // 10% volume
      }
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (playOnHover && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      // Mute again when not hovering
      if (soundOnHover) {
        videoRef.current.muted = true;
      }
    }
  };

  const handleVideoError = () => {
    const errorMsg = "Video failed to load";
    setError(errorMsg);
    onError?.(errorMsg);
  };

  if (error || !src) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <PlayCircle className="h-12 w-12 text-muted-foreground" />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={cn("w-full h-full object-cover", className)}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      controls={controls}
      playsInline
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onError={handleVideoError}
    />
  );
}
