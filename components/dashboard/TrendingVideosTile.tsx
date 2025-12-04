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
} from "lucide-react";
import { useLiveTrending, TrendingVideo, useInvalidateQueries } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface TrendingVideosTileProps {
  className?: string;
  maxVideos?: number;
  defaultKeywords?: string[];
}

function formatCount(num: number | null | undefined): string {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function VideoCard({
  video,
  onAnalyze,
}: {
  video: TrendingVideo;
  onAnalyze: (url: string) => void;
}) {
  return (
    <div
      className="group flex-shrink-0 w-[160px] cursor-pointer"
      onClick={() => onAnalyze(video.videoUrl)}
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted mb-2">
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="h-5 w-5 text-black fill-black ml-0.5" />
          </div>
        </div>
        {/* Views overlay */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs font-medium">
          <Eye className="h-3 w-3" />
          {formatCount(video.playCount)}
        </div>
        {/* Hashtag */}
        <div className="absolute top-2 left-2 text-white text-[10px] font-medium bg-black/50 px-1.5 py-0.5 rounded">
          #{video.searchQuery}
        </div>
      </div>

      {/* Author */}
      <p className="text-xs font-medium truncate mb-1">@{video.authorId}</p>

      {/* Stats Row */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <Heart className="h-2.5 w-2.5" />
          {formatCount(video.likeCount)}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageCircle className="h-2.5 w-2.5" />
          {formatCount(video.commentCount)}
        </span>
        <span className="flex items-center gap-0.5">
          <Share2 className="h-2.5 w-2.5" />
          {formatCount(video.shareCount)}
        </span>
      </div>
    </div>
  );
}

const DEFAULT_KEYWORDS = ["countrymusic", "kpop", "dance"];

export default function TrendingVideosTile({
  className,
  maxVideos = 30,
  defaultKeywords = DEFAULT_KEYWORDS,
}: TrendingVideosTileProps) {
  const router = useRouter();
  const { language } = useI18n();
  const { invalidateLiveTrending } = useInvalidateQueries();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use live trending with 24h cache
  const { data, isLoading, error, refetch } = useLiveTrending({
    keywords: defaultKeywords,
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

  const handleAnalyze = useCallback((url: string) => {
    router.push(`/create?mode=generate&tiktok_url=${encodeURIComponent(url)}`);
  }, [router]);

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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-pink-500" />
            <CardTitle className="text-base">
              {language === "ko" ? "TikTok 트렌딩" : "TikTok Trending"}
            </CardTitle>
            {cacheText && (
              <span className="text-xs text-muted-foreground">
                · {cacheText}
              </span>
            )}
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
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[160px]">
                <Skeleton className="aspect-[9/16] rounded-lg mb-2" />
                <Skeleton className="h-3 w-20 mb-1" />
                <Skeleton className="h-2.5 w-24" />
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
            <div className="flex gap-3 pb-3">
              {videos.slice(0, 12).map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onAnalyze={handleAnalyze}
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
