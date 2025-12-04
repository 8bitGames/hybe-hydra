"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  Play,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  Hash,
  RefreshCw,
  ChevronRight,
  Flame,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTrendingVideos, TrendingVideo } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface TrendingVideosTileProps {
  className?: string;
  maxVideos?: number;
  selectedHashtags?: string[];
  showHashtagFilter?: boolean;
}

function formatCount(num: number | null | undefined): string {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function VideoCard({
  video,
  onOpenTikTok,
  soundEnabled,
}: {
  video: TrendingVideo;
  onOpenTikTok: (url: string) => void;
  soundEnabled: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = !soundEnabled;
      if (soundEnabled) {
        videoRef.current.volume = 0.3;
      }
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        // Autoplay blocked, that's okay
      });
    }
  }, [soundEnabled]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true;
    }
  }, []);

  // Construct TikTok video URL for embedding
  // TikTok doesn't allow direct video embedding, so we use the videoUrl stored
  const videoSrc = video.videoUrl;

  return (
    <div
      className="group relative flex-shrink-0 w-[180px] cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onOpenTikTok(video.videoUrl)}
    >
      {/* Video/Thumbnail Container */}
      <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-muted">
        {/* Video element - always present but hidden until hover */}
        <video
          ref={videoRef}
          src={videoSrc}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            isHovered && isPlaying ? "opacity-100" : "opacity-0"
          )}
          muted
          loop
          playsInline
          preload="none"
        />

        {/* Thumbnail - shown when not hovering */}
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.description || "TikTok video"}
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              isHovered && isPlaying ? "opacity-0" : "opacity-100 group-hover:scale-105"
            )}
          />
        ) : (
          <div className={cn(
            "w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500/20 to-purple-500/20",
            isHovered && isPlaying ? "opacity-0" : "opacity-100"
          )}>
            <Play className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {/* Stats Overlay - always visible at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
          <div className="flex items-center gap-3 text-white text-xs">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatCount(video.playCount)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {formatCount(video.likeCount)}
            </span>
          </div>
        </div>

        {/* Hashtag badge - top left */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="secondary"
            className="bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 border-0"
          >
            #{video.searchQuery}
          </Badge>
        </div>

        {/* Play icon - shown when not playing */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200",
            isPlaying ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="bg-black/40 rounded-full p-3 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white fill-white" />
          </div>
        </div>

        {/* External link indicator on hover */}
        {isHovered && (
          <div className="absolute top-2 right-2">
            <div className="bg-black/50 backdrop-blur-sm rounded-full p-1.5">
              <ExternalLink className="h-3 w-3 text-white" />
            </div>
          </div>
        )}

        {/* Flame badge for top performers */}
        {video.playCount && video.playCount > 1000000 && !isHovered && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] px-1.5 py-0.5 border-0">
              <Flame className="h-3 w-3 mr-0.5" />
              Hot
            </Badge>
          </div>
        )}
      </div>

      {/* Author info below */}
      <div className="mt-2 px-1">
        <p className="text-xs font-medium truncate">@{video.authorId}</p>
        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
          {video.description || "No description"}
        </p>
      </div>
    </div>
  );
}

function HashtagPill({
  hashtag,
  isSelected,
  onClick,
  videoCount,
}: {
  hashtag: string;
  isSelected: boolean;
  onClick: () => void;
  videoCount: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-muted hover:bg-muted/80 text-foreground"
      )}
    >
      <Hash className="h-3.5 w-3.5" />
      {hashtag}
      <span
        className={cn(
          "text-xs ml-1 px-1.5 py-0.5 rounded-full",
          isSelected ? "bg-white/20" : "bg-background/50"
        )}
      >
        {videoCount}
      </span>
    </button>
  );
}

export default function TrendingVideosTile({
  className,
  maxVideos = 12,
  selectedHashtags: initialHashtags,
  showHashtagFilter = true,
}: TrendingVideosTileProps) {
  const router = useRouter();
  const { language } = useI18n();
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>(
    initialHashtags || []
  );
  const [soundEnabled, setSoundEnabled] = useState(false);

  const { data, isLoading, error, refetch } = useTrendingVideos({
    hashtags: selectedHashtags.length > 0 ? selectedHashtags : undefined,
    limit: maxVideos,
  });

  const handleSoundToggle = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  const handleHashtagToggle = useCallback((hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(hashtag)
        ? prev.filter((h) => h !== hashtag)
        : [...prev, hashtag]
    );
  }, []);

  const handleOpenTikTok = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleViewAll = useCallback(() => {
    router.push("/trends");
  }, [router]);

  const videos = useMemo(() => data?.videos || [], [data]);
  const availableHashtags = useMemo(() => data?.availableHashtags || [], [data]);

  if (error) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground mb-4">
            {language === "ko"
              ? "트렌딩 비디오를 불러오지 못했습니다"
              : "Failed to load trending videos"}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === "ko" ? "다시 시도" : "Try Again"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-pink-500" />
            {language === "ko" ? "TikTok 트렌딩" : "TikTok Trending"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={soundEnabled ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={handleSoundToggle}
              title={language === "ko" ? (soundEnabled ? "소리 끄기" : "소리 켜기") : (soundEnabled ? "Mute" : "Unmute")}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewAll}
              className="h-8"
            >
              {language === "ko" ? "더 보기" : "View All"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Hashtag Filter Pills */}
        {showHashtagFilter && availableHashtags.length > 0 && (
          <ScrollArea className="w-full mt-3">
            <div className="flex gap-2 pb-2">
              {availableHashtags.slice(0, 6).map((h) => (
                <HashtagPill
                  key={h.query}
                  hashtag={h.query}
                  videoCount={h.videoCount}
                  isSelected={selectedHashtags.includes(h.query)}
                  onClick={() => handleHashtagToggle(h.query)}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[180px]">
                <Skeleton className="aspect-[9/16] rounded-xl" />
                <Skeleton className="h-4 w-24 mt-2" />
                <Skeleton className="h-3 w-full mt-1" />
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {language === "ko"
                ? "트렌딩 비디오가 없습니다. 트렌드를 수집해주세요."
                : "No trending videos yet. Collect some trends first."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/trends")}
            >
              {language === "ko" ? "트렌드 수집하기" : "Collect Trends"}
            </Button>
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onOpenTikTok={handleOpenTikTok}
                  soundEnabled={soundEnabled}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
