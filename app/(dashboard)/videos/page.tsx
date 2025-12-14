"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useFastCutVideos, useAllAIVideos } from "@/lib/queries";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlayCircle,
  Search,
  ExternalLink,
  MoreVertical,
  Trash2,
  Send,
  Download,
  Eye,
  Film,
  Sparkles,
  Layers,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { VideoGeneration as FullVideoGeneration } from "@/lib/video-api";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Lazy Video Component - only loads when in viewport
function LazyVideo({
  src,
  soundEnabled,
  className,
  onVideoClick,
}: {
  src: string;
  soundEnabled: boolean;
  className?: string;
  onVideoClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const stopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-full bg-zinc-900", className)}
      onClick={() => {
        stopVideo();
        onVideoClick?.();
      }}
    >
      {isVisible ? (
        <>
          {!isLoaded && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              <Film className="h-8 w-8 text-zinc-600" />
            </div>
          ) : (
            <video
              ref={videoRef}
              src={src}
              className={cn("w-full h-full object-cover", !isLoaded && "opacity-0")}
              muted
              preload="metadata"
              onLoadedData={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
              onMouseOver={(e) => {
                const videoEl = e.currentTarget;
                if (soundEnabled) {
                  videoEl.muted = false;
                  videoEl.volume = 0.1;
                }
                videoEl.play().catch(() => {
                  videoEl.muted = true;
                  videoEl.play().catch(() => {});
                });
              }}
              onMouseOut={(e) => {
                const videoEl = e.currentTarget;
                videoEl.pause();
                videoEl.currentTime = 0;
                videoEl.muted = true;
              }}
            />
          )}
        </>
      ) : (
        <div className="w-full h-full bg-zinc-800 animate-pulse" />
      )}
    </div>
  );
}

// Video Card Skeleton
function VideoCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video">
        <Skeleton className="w-full h-full" />
      </div>
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2 w-1/2" />
        <Skeleton className="h-2 w-full" />
      </CardContent>
    </Card>
  );
}

// Unified video type
type UnifiedVideo = {
  id: string;
  campaign_id: string;
  campaign_name: string;
  artist_name: string;
  prompt: string;
  duration_seconds: number;
  aspect_ratio: string;
  status: string;
  output_url: string | null;
  composed_output_url: string | null;
  created_at: string;
  updated_at: string;
  generation_type: "AI" | "COMPOSE";
};

type VideoType = "all" | "ai" | "fast-cut";

export default function AllVideosPage() {
  const router = useRouter();
  const { language } = useI18n();

  const [searchQuery, setSearchQuery] = useState("");
  const [videoType, setVideoType] = useState<VideoType>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Side panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<UnifiedVideo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Delete state
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch videos
  const { data: composeData, isLoading: loadingCompose, refetch: refetchCompose } = useFastCutVideos({
    page,
    page_size: pageSize,
  });
  const { data: aiData, isLoading: loadingAI, refetch: refetchAI } = useAllAIVideos();

  const composeVideos = composeData?.items || [];
  const aiVideos = aiData?.items || [];
  const totalPages = composeData?.pages || 1;

  // Helper to check if video is displayable (completed with output URL)
  // Note: status can be "completed" or "COMPLETED" depending on source
  const isVideoDisplayable = (video: { status: string; output_url: string | null; composed_output_url: string | null }) =>
    video.status.toLowerCase() === "completed" && (video.output_url || video.composed_output_url);

  // Calculate totals only for completed videos with URLs
  const aiTotal = aiVideos.filter(isVideoDisplayable).length;
  const composeTotal = composeVideos.filter(isVideoDisplayable).length;
  const totalAll = aiTotal + composeTotal;

  // Translations
  const t = {
    title: language === "ko" ? "모든 영상" : "All Videos",
    subtitle: language === "ko" ? "캠페인 전체의 생성된 영상을 탐색하고 관리" : "Browse and manage all generated videos across campaigns",
    createNew: language === "ko" ? "새 영상 만들기" : "Create New Video",
    all: language === "ko" ? "전체" : "All",
    ai: language === "ko" ? "AI 영상" : "AI Videos",
    fastCut: language === "ko" ? "패스트 컷" : "Fast Cut",
    searchPlaceholder: language === "ko" ? "프롬프트, 캠페인명으로 검색..." : "Search by prompt, campaign...",
    noVideos: language === "ko" ? "영상을 찾을 수 없습니다" : "No videos found",
    createFirst: language === "ko" ? "영상 생성을 시작해보세요" : "Start generating videos to see them here",
    tryAdjust: language === "ko" ? "필터를 조정해보세요" : "Try adjusting your filters",
    page: language === "ko" ? "페이지" : "Page",
    of: language === "ko" ? "/" : "of",
    viewDetails: language === "ko" ? "상세보기" : "View Details",
    viewInCampaign: language === "ko" ? "캠페인에서 보기" : "View in Campaign",
    schedulePublish: language === "ko" ? "게시 예약" : "Schedule Publish",
    download: language === "ko" ? "다운로드" : "Download",
    delete: language === "ko" ? "삭제" : "Delete",
    deleteConfirm: language === "ko" ? "정말 이 영상을 삭제하시겠습니까?" : "Are you sure you want to delete this video?",
    deleteConfirmTitle: language === "ko" ? "영상 삭제" : "Delete Video",
    deleting: language === "ko" ? "삭제 중..." : "Deleting...",
    confirm: language === "ko" ? "확인" : "Confirm",
    cancel: language === "ko" ? "취소" : "Cancel",
    previous: language === "ko" ? "이전" : "Previous",
    next: language === "ko" ? "다음" : "Next",
  };

  // Convert to unified format
  const unifiedComposeVideos: UnifiedVideo[] = composeVideos.map((video) => ({
    id: video.id,
    campaign_id: video.campaign_id,
    campaign_name: video.campaign_name,
    artist_name: video.artist_name,
    prompt: video.prompt,
    duration_seconds: video.duration_seconds,
    aspect_ratio: video.aspect_ratio,
    status: video.status,
    output_url: video.output_url,
    composed_output_url: video.composed_output_url,
    created_at: video.created_at,
    updated_at: video.updated_at,
    generation_type: "COMPOSE" as const,
  }));

  const unifiedAIVideos: UnifiedVideo[] = aiVideos.map((video) => ({
    id: video.id,
    campaign_id: video.campaign_id,
    campaign_name: video.campaign_name,
    artist_name: video.artist_name,
    prompt: video.prompt,
    duration_seconds: video.duration_seconds,
    aspect_ratio: video.aspect_ratio,
    status: video.status,
    output_url: video.output_url,
    composed_output_url: video.composed_output_url,
    created_at: video.created_at,
    updated_at: video.updated_at,
    generation_type: "AI" as const,
  }));

  // Filter videos
  const filteredVideos = useMemo(() => {
    let baseVideos: UnifiedVideo[] = [];

    if (videoType === "all") {
      baseVideos = [...unifiedAIVideos, ...unifiedComposeVideos].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (videoType === "ai") {
      baseVideos = unifiedAIVideos;
    } else {
      baseVideos = unifiedComposeVideos;
    }

    // Filter out videos that aren't completed or don't have output URLs
    // Note: status can be "completed" or "COMPLETED" depending on source
    baseVideos = baseVideos.filter(
      (video) => video.status.toLowerCase() === "completed" && (video.output_url || video.composed_output_url)
    );

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return baseVideos.filter(
        (video) =>
          video.prompt.toLowerCase().includes(query) ||
          video.campaign_name.toLowerCase().includes(query) ||
          video.artist_name.toLowerCase().includes(query)
      );
    }

    return baseVideos;
  }, [unifiedAIVideos, unifiedComposeVideos, searchQuery, videoType]);

  // Helpers
  const getVideoUrl = (video: UnifiedVideo) => video.composed_output_url || video.output_url;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDownload = (url: string, filename: string) => {
    const downloadUrl = `/api/v1/assets/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&stream=true`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!deleteVideoId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/generations/${deleteVideoId}?force=true`);
      setDeleteVideoId(null);
      refetchCompose();
      refetchAI();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Open video in side panel
  const openVideo = (video: UnifiedVideo, index: number) => {
    setSelectedVideo(video);
    setSelectedIndex(index);
    setPanelOpen(true);
  };

  // Navigate to prev/next video
  const goToPrevious = () => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1;
      setSelectedVideo(filteredVideos[newIndex]);
      setSelectedIndex(newIndex);
    }
  };

  const goToNext = () => {
    if (selectedIndex < filteredVideos.length - 1) {
      const newIndex = selectedIndex + 1;
      setSelectedVideo(filteredVideos[newIndex]);
      setSelectedIndex(newIndex);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!panelOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "Escape") {
        setPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panelOpen, selectedIndex, filteredVideos]);

  const loading = loadingCompose || loadingAI;
  const videoUrl = selectedVideo ? getVideoUrl(selectedVideo) : null;
  const isPortrait = selectedVideo?.aspect_ratio === "9:16";

  return (
    <div className="space-y-6 pb-8 px-[7%]">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button onClick={() => router.push("/create/generate")}>
          {t.createNew}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Tabs value={videoType} onValueChange={(v) => { setVideoType(v as VideoType); setPage(1); }}>
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <Film className="h-4 w-4" />
                {t.all}
                <Badge variant="secondary" className="ml-1">{totalAll}</Badge>
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-2">
                <Sparkles className="h-4 w-4" />
                {t.ai}
                <Badge variant="secondary" className="ml-1">{aiTotal}</Badge>
              </TabsTrigger>
              <TabsTrigger value="fast-cut" className="gap-2">
                <Layers className="h-4 w-4" />
                {t.fastCut}
                <Badge variant="secondary" className="ml-1">{composeTotal}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
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
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <PlayCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">{t.noVideos}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {totalAll === 0 ? t.createFirst : t.tryAdjust}
            </p>
            <Button onClick={() => router.push("/create/generate")}>
              {t.createNew}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {filteredVideos.map((video, index) => (
              <Card
                key={`${video.generation_type}-${video.id}`}
                className={cn(
                  "overflow-hidden cursor-pointer hover:shadow-lg transition-all group",
                  selectedVideo?.id === video.id && panelOpen && "ring-2 ring-primary"
                )}
                onClick={() => openVideo(video, index)}
              >
                <div className="relative aspect-video bg-muted">
                  {getVideoUrl(video) ? (
                    <LazyVideo
                      src={getVideoUrl(video)!}
                      soundEnabled={soundEnabled}
                      onVideoClick={() => openVideo(video, index)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Film className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px]"
                  >
                    {video.duration_seconds}s
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 bg-black/70 text-white text-[10px]"
                  >
                    {video.generation_type === "AI" ? (
                      <><Sparkles className="h-3 w-3 mr-1" />AI</>
                    ) : (
                      <><Layers className="h-3 w-3 mr-1" />Fast Cut</>
                    )}
                  </Badge>
                </div>

                <CardContent className="p-3">
                  <div className="space-y-1.5">
                    <p className="font-medium text-xs truncate">{video.campaign_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{video.artist_name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{video.prompt}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(video.created_at)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openVideo(video, index); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t.viewDetails}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/campaigns/${video.campaign_id}/curation`); }}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {t.viewInCampaign}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/campaigns/${video.campaign_id}/publish`); }}>
                            <Send className="h-4 w-4 mr-2" />
                            {t.schedulePublish}
                          </DropdownMenuItem>
                          {getVideoUrl(video) && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(getVideoUrl(video)!, `video-${video.id}.mp4`); }}>
                              <Download className="h-4 w-4 mr-2" />
                              {t.download}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteVideoId(video.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} {t.of} {totalPages} {t.page}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Centered Video Overlay */}
      {panelOpen && selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
          />

          {/* Content */}
          <div className="relative z-10 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden rounded-lg bg-zinc-950 border border-zinc-800 shadow-2xl">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-20 text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              onClick={() => setPanelOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Navigation arrows on sides */}
            {selectedIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
            {selectedIndex < filteredVideos.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70"
                onClick={goToNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}

            {/* Video Player */}
            <div className={cn(
              "relative bg-black flex items-center justify-center",
              isPortrait ? "h-[70vh]" : "aspect-video"
            )}>
              {videoUrl ? (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className={cn(
                    "max-w-full max-h-full",
                    isPortrait ? "h-[70vh] w-auto" : "w-full"
                  )}
                />
              ) : (
                <div className="flex items-center justify-center h-48">
                  <Film className="h-12 w-12 text-zinc-600" />
                </div>
              )}
            </div>

            {/* Info Bar */}
            <div className="bg-zinc-900 border-t border-zinc-800">
              {/* Header Row - Fixed */}
              <div className="flex items-center justify-between gap-4 p-4 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white">{selectedVideo.campaign_name}</h3>
                  <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-300">
                    {selectedVideo.generation_type === "AI" ? "AI" : "Fast Cut"}
                  </Badge>
                </div>
                {videoUrl && (
                  <Button
                    size="sm"
                    className="bg-black text-white hover:bg-zinc-800 border border-zinc-700"
                    onClick={() => handleDownload(videoUrl, `video-${selectedVideo.id}.mp4`)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t.download}
                  </Button>
                )}
              </div>

              {/* Scrollable Content */}
              <div className="px-4 max-h-[20vh] overflow-y-auto">
                <p className="text-sm text-zinc-400 mb-2">{selectedVideo.artist_name}</p>
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">{selectedVideo.prompt}</p>
              </div>

              {/* Footer Row - Fixed */}
              <div className="flex items-center gap-4 px-4 py-3 text-xs text-zinc-500 border-t border-zinc-800/50">
                <span>{selectedVideo.duration_seconds}s</span>
                <span>{selectedVideo.aspect_ratio}</span>
                <span>{formatDate(selectedVideo.created_at)}</span>
                <span className="ml-auto">{selectedIndex + 1} / {filteredVideos.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteVideoId} onOpenChange={(open) => !open && setDeleteVideoId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>{t.deleteConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteVideoId(null)} disabled={deleting}>
              {t.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <><Spinner className="h-4 w-4 mr-2" />{t.deleting}</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />{t.delete}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
