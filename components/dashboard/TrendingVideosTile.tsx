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
  Eye,
  Heart,
  Hash,
  RefreshCw,
  ChevronRight,
  Flame,
  Sparkles,
  ArrowRight,
  Play,
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

function VideoRow({
  video,
  rank,
  onAnalyze,
}: {
  video: TrendingVideo;
  rank: number;
  onAnalyze: (url: string) => void;
}) {
  const isHot = video.playCount && video.playCount > 1000000;

  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
      onClick={() => onAnalyze(video.videoUrl)}
    >
      {/* Rank */}
      <div className="flex-shrink-0 w-6 text-center">
        <span className={cn(
          "text-sm font-bold",
          rank <= 3 ? "text-primary" : "text-muted-foreground"
        )}>
          {rank}
        </span>
      </div>

      {/* Thumbnail - only if available */}
      {video.thumbnailUrl && (
        <div className="flex-shrink-0 w-12 h-16 rounded-md overflow-hidden bg-muted relative">
          <img
            src={video.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate">@{video.authorId}</span>
          {isHot && (
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] px-1.5 py-0 border-0 h-4">
              <Flame className="h-2.5 w-2.5 mr-0.5" />
              Hot
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {video.description || "No description"}
        </p>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {formatCount(video.playCount)}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-3 w-3" />
          {formatCount(video.likeCount)}
        </span>
      </div>

      {/* Hashtag Badge */}
      <Badge
        variant="secondary"
        className="flex-shrink-0 text-[10px] px-2 py-0.5"
      >
        #{video.searchQuery}
      </Badge>

      {/* Action */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs">
          <Sparkles className="h-3 w-3" />
          분석
        </Button>
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

  const { data, isLoading, error, refetch } = useTrendingVideos({
    hashtags: selectedHashtags.length > 0 ? selectedHashtags : undefined,
    limit: maxVideos,
  });

  const handleHashtagToggle = useCallback((hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(hashtag)
        ? prev.filter((h) => h !== hashtag)
        : [...prev, hashtag]
    );
  }, []);

  const handleAnalyze = useCallback((url: string) => {
    // Store URL in session storage for the trends/generate page to pick up
    sessionStorage.setItem("tiktok_analyze_url", url);
    // Navigate to trends page with analyze mode
    router.push(`/trends?tab=bridge&analyze_url=${encodeURIComponent(url)}`);
  }, [router]);

  const handleViewAll = useCallback(() => {
    router.push("/trends");
  }, [router]);

  // Filter to only show videos with thumbnails
  const videos = useMemo(() => {
    const allVideos = data?.videos || [];
    return allVideos.filter(v => v.thumbnailUrl && v.playCount);
  }, [data]);

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
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-16 w-12 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-4 w-16" />
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
          <div className="space-y-1">
            {videos.slice(0, 10).map((video, index) => (
              <VideoRow
                key={video.id}
                video={video}
                rank={index + 1}
                onAnalyze={handleAnalyze}
              />
            ))}

            {/* Show more link if there are more videos */}
            {videos.length > 10 && (
              <div className="pt-2 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewAll}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {language === "ko"
                    ? `+${videos.length - 10}개 더 보기`
                    : `+${videos.length - 10} more`}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
