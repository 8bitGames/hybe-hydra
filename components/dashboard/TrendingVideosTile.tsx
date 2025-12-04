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
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  Eye,
  Heart,
  RefreshCw,
  ChevronRight,
  Play,
  MessageCircle,
  Share2,
  ExternalLink,
} from "lucide-react";
import { useLiveTrending, TrendingVideo, useInvalidateQueries } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { cn, sanitizeUsername, sanitizeText, getProxiedImageUrl } from "@/lib/utils";
import { TrendVideoActionDialog } from "./TrendVideoActionDialog";
import { TrendVideoContext } from "@/lib/trend-context";

interface TrendingVideosTileProps {
  className?: string;
  maxVideos?: number;
}

function formatCount(num: number | null | undefined): string {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function VideoCard({
  video,
  onClick,
}: {
  video: TrendingVideo;
  onClick: (video: TrendingVideo) => void;
}) {
  const handleViewVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(video.videoUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="group flex-shrink-0 w-[180px] cursor-pointer"
      onClick={() => onClick(video)}
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted mb-3">
        {video.thumbnailUrl && (
          <img
            src={getProxiedImageUrl(video.thumbnailUrl) || ""}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        )}
        {/* View on TikTok button */}
        <button
          onClick={handleViewVideo}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="View on TikTok"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="h-5 w-5 text-black fill-black ml-0.5" />
          </div>
        </div>
        {/* Views overlay */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-white text-sm font-medium bg-black/60 px-2 py-1 rounded">
          <Eye className="h-4 w-4" />
          {formatCount(video.playCount)}
        </div>
      </div>

      {/* Author */}
      <p className="text-sm font-medium truncate mb-2">@{sanitizeUsername(video.authorId)}</p>

      {/* Stats Row - Bigger */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" />
          {formatCount(video.likeCount)}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" />
          {formatCount(video.commentCount)}
        </span>
        <span className="flex items-center gap-1">
          <Share2 className="h-3.5 w-3.5" />
          {formatCount(video.shareCount)}
        </span>
      </div>
    </div>
  );
}

export default function TrendingVideosTile({
  className,
  maxVideos = 30,
}: TrendingVideosTileProps) {
  const router = useRouter();
  const { language } = useI18n();
  const { invalidateLiveTrending } = useInvalidateQueries();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<TrendVideoContext | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Use live trending with 24h cache
  const { data, isLoading, error, refetch } = useLiveTrending({
    limit: maxVideos,
  });

  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      invalidateLiveTrending();
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [invalidateLiveTrending, refetch]);

  // Open dialog with video context
  const handleVideoClick = useCallback((video: TrendingVideo) => {
    const playCount = video.playCount || 0;
    const likeCount = video.likeCount || 0;
    const commentCount = video.commentCount || 0;
    const shareCount = video.shareCount || 0;

    // Calculate engagement rate
    const engagementRate = playCount > 0
      ? ((likeCount + commentCount + shareCount) / playCount) * 100
      : 0;

    const context: TrendVideoContext = {
      source: "trending",
      video: {
        id: video.id,
        url: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl || null,
        description: sanitizeText(video.description) || "",
        authorId: sanitizeUsername(video.authorId),
        authorName: sanitizeUsername(video.authorId),
      },
      stats: {
        playCount,
        likeCount,
        commentCount,
        shareCount,
        engagementRate,
      },
      hashtags: video.hashtags || [],
      createdAt: new Date().toISOString(),
    };

    setSelectedVideo(context);
    setDialogOpen(true);
  }, []);

  const handleViewAll = useCallback(() => {
    router.push("/trends");
  }, [router]);

  // Filter to only show videos with thumbnails
  const videos = useMemo(() => {
    const allVideos = data?.videos || [];
    return allVideos.filter(v => v.thumbnailUrl && v.playCount);
  }, [data]);

  // Cache info
  const cacheInfo = data?.cache;
  const cacheText = cacheInfo
    ? cacheInfo.ageHours < 1
      ? (language === "ko" ? "방금 업데이트" : "Just now")
      : `${cacheInfo.ageHours}h`
    : "";

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
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">
              {language === "ko" ? "TikTok 트렌딩" : "TikTok Trending"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleForceRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewAll}
              className="h-8 px-2 text-muted-foreground"
            >
              {language === "ko" ? "더 보기" : "More"}
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[180px]">
                <Skeleton className="aspect-[9/16] rounded-lg mb-3" />
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {language === "ko"
                ? "트렌딩 비디오가 없습니다"
                : "No trending videos"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/trends")}
            >
              {language === "ko" ? "트렌드 수집" : "Collect Trends"}
            </Button>
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {videos.slice(0, 12).map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={handleVideoClick}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>

      {/* Trend Video Action Dialog */}
      <TrendVideoActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={selectedVideo}
      />
    </Card>
  );
}
