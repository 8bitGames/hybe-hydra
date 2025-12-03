"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  composeApi,
  ComposedVideo,
} from "@/lib/compose-api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wand2,
  Search,
  FolderOpen,
  Play,
  Download,
  Clock,
  User,
  Music,
  Film,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ComposeGalleryPage() {
  const router = useRouter();
  const { language } = useI18n();
  const [videos, setVideos] = useState<ComposedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Video preview modal
  const [selectedVideo, setSelectedVideo] = useState<ComposedVideo | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Translations
  const t = {
    title: language === "ko" ? "컴포즈 영상" : "Compose Videos",
    subtitle: language === "ko" ? "컴포즈로 만든 영상을 확인하고 다운로드하세요" : "View and download your Compose videos",
    createNew: language === "ko" ? "새로 만들기" : "Create New",
    totalVideos: language === "ko" ? "전체 영상" : "Total Videos",
    readyToPlay: language === "ko" ? "재생 가능" : "Ready to Play",
    totalDuration: language === "ko" ? "총 재생시간" : "Total Duration",
    searchPlaceholder: language === "ko" ? "캠페인, 아티스트, 프롬프트로 검색..." : "Search by campaign, artist, or prompt...",
    noVideos: language === "ko" ? "영상을 찾을 수 없습니다" : "No videos found",
    tryDifferent: language === "ko" ? "다른 검색어로 시도해보세요" : "Try a different search term",
    createFirst: language === "ko" ? "컴포즈로 첫 번째 영상을 만들어보세요" : "Create your first Compose video",
    createVideo: language === "ko" ? "영상 만들기" : "Create Video",
    page: language === "ko" ? "페이지" : "Page",
    of: language === "ko" ? "/" : "of",
    videoNotAvailable: language === "ko" ? "영상을 사용할 수 없습니다" : "Video not available",
    artist: language === "ko" ? "아티스트" : "Artist",
    duration: language === "ko" ? "길이" : "Duration",
    seconds: language === "ko" ? "초" : "seconds",
    aspectRatio: language === "ko" ? "화면 비율" : "Aspect Ratio",
    createdBy: language === "ko" ? "제작자" : "Created By",
    createdAt: language === "ko" ? "생성일" : "Created At",
    music: language === "ko" ? "음악" : "Music",
    prompt: language === "ko" ? "프롬프트" : "Prompt",
    openInNewTab: language === "ko" ? "새 탭에서 열기" : "Open in New Tab",
    download: language === "ko" ? "다운로드" : "Download",
    createSimilar: language === "ko" ? "유사하게 만들기" : "Create Similar",
  };

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await composeApi.getComposedVideos({
        page,
        page_size: 12,
      });

      setVideos(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load composed videos:", error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const filteredVideos = videos.filter(
    (video) =>
      video.campaign_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.artist_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVideoClick = (video: ComposedVideo) => {
    setSelectedVideo(video);
    setIsPreviewOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAspectRatioLabel = (ratio: string) => {
    switch (ratio) {
      case "9:16":
        return "TikTok/Reels";
      case "16:9":
        return "YouTube";
      case "1:1":
        return "Instagram";
      default:
        return ratio;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Film className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{t.title}</h1>
              <p className="text-sm text-muted-foreground">
                {t.subtitle}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/compose">
              <Wand2 className="h-4 w-4 mr-2" />
              {t.createNew}
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">{t.totalVideos}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">
                {videos.filter((v) => v.composed_output_url).length}
              </p>
              <p className="text-xs text-muted-foreground">{t.readyToPlay}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">
                {videos.reduce((sum, v) => sum + v.duration_seconds, 0)}s
              </p>
              <p className="text-xs text-muted-foreground">{t.totalDuration}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={soundEnabled ? "default" : "outline"}
          size="icon"
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={language === "ko" ? (soundEnabled ? "소리 끄기" : "소리 켜기") : (soundEnabled ? "Mute" : "Unmute")}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">{t.noVideos}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? t.tryDifferent : t.createFirst}
              </p>
              <Button asChild size="sm">
                <Link href="/compose">
                  <Wand2 className="h-4 w-4 mr-2" />
                  {t.createVideo}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVideos.map((video) => (
              <Card
                key={video.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                onClick={() => handleVideoClick(video)}
              >
                {/* Video Preview Thumbnail */}
                <div className="relative aspect-video bg-muted">
                  {video.composed_output_url ? (
                    <video
                      src={video.composed_output_url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onMouseOver={(e) => {
                        const videoEl = e.currentTarget as HTMLVideoElement;
                        if (soundEnabled) {
                          videoEl.muted = false;
                          videoEl.volume = 0.1; // 10% volume
                        }
                        videoEl.play();
                      }}
                      onMouseOut={(e) => {
                        const videoEl = e.currentTarget as HTMLVideoElement;
                        videoEl.pause();
                        videoEl.currentTime = 0;
                        videoEl.muted = true;
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Film className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="h-6 w-6 text-gray-900 ml-1" />
                    </div>
                  </div>
                  {/* Duration badge */}
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 right-2 bg-black/70 text-white"
                  >
                    {video.duration_seconds}s
                  </Badge>
                </div>

                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {video.campaign_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {video.artist_name}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {getAspectRatioLabel(video.aspect_ratio)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {video.prompt}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {video.creator.name}
                      </span>
                      <span>•</span>
                      <span>{formatDate(video.created_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} {t.of} {totalPages} {t.page}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Video Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              {selectedVideo?.campaign_name}
            </DialogTitle>
          </DialogHeader>

          {selectedVideo && (
            <div className="space-y-4">
              {/* Video Player */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {selectedVideo.composed_output_url ? (
                  <video
                    src={selectedVideo.composed_output_url}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white">
                    <p>{t.videoNotAvailable}</p>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.artist}</p>
                    <p className="font-medium">{selectedVideo.artist_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.duration}</p>
                    <p className="font-medium">{selectedVideo.duration_seconds}{t.seconds}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.aspectRatio}</p>
                    <p className="font-medium">
                      {selectedVideo.aspect_ratio} ({getAspectRatioLabel(selectedVideo.aspect_ratio)})
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.createdBy}</p>
                    <p className="font-medium">{selectedVideo.creator.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.createdAt}</p>
                    <p className="font-medium">{formatDate(selectedVideo.created_at)}</p>
                  </div>
                  {selectedVideo.audio_asset && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t.music}</p>
                      <p className="font-medium flex items-center gap-1">
                        <Music className="h-3 w-3" />
                        {selectedVideo.audio_asset.original_filename}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Prompt */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.prompt}</p>
                <p className="text-sm p-3 bg-muted rounded-lg">{selectedVideo.prompt}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                {selectedVideo.composed_output_url && (
                  <>
                    <Button asChild size="sm">
                      <a
                        href={selectedVideo.composed_output_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t.openInNewTab}
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedVideo.composed_output_url} download>
                        <Download className="h-4 w-4 mr-2" />
                        {t.download}
                      </a>
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="ml-auto"
                >
                  <Link href={`/campaigns/${selectedVideo.campaign_id}/compose`}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {t.createSimilar}
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
