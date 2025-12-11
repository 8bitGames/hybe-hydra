"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useFastCutVideos, useAllAIVideos, AllVideoItem } from "@/lib/queries";
import { FastCutVideo } from "@/lib/fast-cut-api";
import {
  Card,
  CardContent,
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlayCircle,
  Search,
  Clock,
  ExternalLink,
  MoreVertical,
  Trash2,
  Send,
  Download,
  Eye,
  Music,
  Wand2,
  Film,
  Sparkles,
  Calendar,
  Tag,
  FileText,
  Settings,
  Layers,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Play,
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

type VideoType = "all" | "ai" | "fast-cut";

export default function AllVideosPage() {
  const router = useRouter();
  const { language } = useI18n();

  const [searchQuery, setSearchQuery] = useState("");
  const [videoType, setVideoType] = useState<VideoType>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<FullVideoGeneration | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Delete state
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch fast-cut videos with pagination
  const { data: composeData, isLoading: loadingCompose, refetch: refetchCompose } = useFastCutVideos({
    page,
    page_size: pageSize,
  });

  // Fetch AI videos from all campaigns
  const { data: aiData, isLoading: loadingAI, refetch: refetchAI } = useAllAIVideos();

  const composeVideos = composeData?.items || [];
  const aiVideos = aiData?.items || [];
  const aiTotal = aiData?.total || 0;
  const composeTotal = composeData?.total || 0;
  const totalAll = aiTotal + composeTotal;
  const totalPages = composeData?.pages || 1;

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
    totalVideos: language === "ko" ? "전체 영상" : "Total Videos",
    viewDetails: language === "ko" ? "상세보기" : "View Details",
    viewInCampaign: language === "ko" ? "캠페인에서 보기" : "View in Campaign",
    schedulePublish: language === "ko" ? "게시 예약" : "Schedule Publish",
    download: language === "ko" ? "다운로드" : "Download",
    delete: language === "ko" ? "삭제" : "Delete",
    completed: language === "ko" ? "완료" : "Completed",
    processing: language === "ko" ? "처리중" : "Processing",
    failed: language === "ko" ? "실패" : "Failed",
    videoDetails: language === "ko" ? "영상 상세 정보" : "Video Details",
    prompt: language === "ko" ? "프롬프트" : "Prompt",
    negativePrompt: language === "ko" ? "네거티브 프롬프트" : "Negative Prompt",
    videoSettings: language === "ko" ? "영상 설정" : "Video Settings",
    duration: language === "ko" ? "길이" : "Duration",
    aspectRatio: language === "ko" ? "비율" : "Aspect Ratio",
    status: language === "ko" ? "상태" : "Status",
    qualityScore: language === "ko" ? "품질 점수" : "Quality Score",
    generationType: language === "ko" ? "생성 타입" : "Generation Type",
    fastCutVideo: language === "ko" ? "패스트 컷 영상" : "Fast Cut Video",
    aiVideo: language === "ko" ? "AI 영상" : "AI Video",
    audio: language === "ko" ? "오디오" : "Audio",
    filename: language === "ko" ? "파일명" : "Filename",
    startTime: language === "ko" ? "시작 시간" : "Start Time",
    referenceStyle: language === "ko" ? "참조 스타일" : "Reference Style",
    effectPreset: language === "ko" ? "이펙트 프리셋" : "Effect Preset",
    metadata: language === "ko" ? "메타데이터" : "Metadata",
    tags: language === "ko" ? "태그" : "Tags",
    createdAt: language === "ko" ? "생성일" : "Created",
    updatedAt: language === "ko" ? "수정일" : "Updated",
    loadFailed: language === "ko" ? "영상 정보를 불러올 수 없습니다" : "Failed to load video details",
    openInNewTab: language === "ko" ? "새 탭에서 열기" : "Open in New Tab",
    createSimilar: language === "ko" ? "유사하게 만들기" : "Create Similar",
    deleteConfirm: language === "ko" ? "정말 이 영상을 삭제하시겠습니까?" : "Are you sure you want to delete this video?",
    deleteConfirmTitle: language === "ko" ? "영상 삭제" : "Delete Video",
    deleting: language === "ko" ? "삭제 중..." : "Deleting...",
    deleteSuccess: language === "ko" ? "영상이 삭제되었습니다" : "Video deleted",
    deleteFailed: language === "ko" ? "삭제에 실패했습니다" : "Failed to delete video",
    confirm: language === "ko" ? "확인" : "Confirm",
    cancel: language === "ko" ? "취소" : "Cancel",
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      // Get a fresh presigned URL from the download API to avoid expiration issues
      const downloadApiResponse = await fetch(
        `/api/v1/assets/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
      );

      if (!downloadApiResponse.ok) {
        throw new Error("Failed to get download URL");
      }

      const { downloadUrl } = await downloadApiResponse.json();

      // Fetch the video using the fresh presigned URL
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleDelete = async () => {
    if (!deleteVideoId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/generations/${deleteVideoId}?force=true`);
      setDeleteVideoId(null);
      // Refresh data
      refetchCompose();
      refetchAI();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  const fetchVideoDetail = async (videoId: string, campaignId?: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const response = await api.get<FullVideoGeneration>(`/api/v1/generations/${videoId}`);
      if (response.data) {
        setSelectedVideo(response.data);
      }
    } catch (err) {
      console.error("Failed to load video detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Helper to get video URL for unified video type
  const getUnifiedVideoUrl = (video: { composed_output_url: string | null; output_url: string | null }) => {
    return video.composed_output_url || video.output_url;
  };

  const getDetailVideoUrl = (video: FullVideoGeneration) => {
    return video.composed_output_url || video.output_url;
  };

  // Check if video is compose type
  const isComposeVideo = (video: FullVideoGeneration) => {
    if (video.generation_type === "COMPOSE") return true;
    if (video.id?.startsWith("compose-")) return true;
    const variationType = video.quality_metadata?.variationType as string | undefined;
    return variationType === "compose_variation" || variationType === "compose";
  };

  // Check if video is portrait (9:16)
  const isPortraitVideo = (video: FullVideoGeneration) => {
    return video.aspect_ratio === "9:16";
  };

  // Unified video type for rendering
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

  // Convert compose videos to unified format
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

  // Convert AI videos to unified format
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

  // Filter videos based on search and type
  const filteredVideos = useMemo(() => {
    // Choose videos based on type filter
    let baseVideos: UnifiedVideo[] = [];

    if (videoType === "all") {
      // Combine both and sort by created_at
      baseVideos = [...unifiedAIVideos, ...unifiedComposeVideos].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (videoType === "ai") {
      baseVideos = unifiedAIVideos;
    } else {
      baseVideos = unifiedComposeVideos;
    }

    // Apply search filter
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const loading = loadingCompose || loadingAI;

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

      {/* Stats & Filters */}
      <div className="flex flex-col gap-4">
        {/* Type Tabs */}
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
              title={soundEnabled ? "Mute" : "Unmute"}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            {filteredVideos.map((video) => (
              <Card
                key={`${video.generation_type}-${video.id}`}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                onClick={() => fetchVideoDetail(video.id, video.campaign_id)}
              >
                {/* Video Thumbnail */}
                <div className="relative aspect-video bg-muted">
                  {getUnifiedVideoUrl(video) ? (
                    <video
                      src={getUnifiedVideoUrl(video)!}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onMouseOver={(e) => {
                        const videoEl = e.currentTarget as HTMLVideoElement;
                        if (soundEnabled) {
                          videoEl.muted = false;
                          videoEl.volume = 0.1;
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
                  {/* Duration badge */}
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px]"
                  >
                    {video.duration_seconds}s
                  </Badge>
                  {/* Type badge */}
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 bg-black/70 text-white text-[10px]"
                  >
                    {video.generation_type === "AI" ? (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI
                      </>
                    ) : (
                      <>
                        <Layers className="h-3 w-3 mr-1" />
                        Fast Cut
                      </>
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
                          <DropdownMenuItem onClick={() => fetchVideoDetail(video.id, video.campaign_id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t.viewDetails}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/campaigns/${video.campaign_id}/curation`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {t.viewInCampaign}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/campaigns/${video.campaign_id}/publish`)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {t.schedulePublish}
                          </DropdownMenuItem>
                          {getUnifiedVideoUrl(video) && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(getUnifiedVideoUrl(video)!, `video-${video.id}.mp4`);
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {t.download}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteVideoId(video.id);
                            }}
                          >
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

      {/* Video Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              {t.videoDetails}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : selectedVideo ? (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Video Preview */}
                <div className="flex justify-center">
                  <div className={cn(
                    "relative bg-muted rounded-lg overflow-hidden",
                    isPortraitVideo(selectedVideo)
                      ? "w-[280px] aspect-[9/16]"
                      : "w-full aspect-video"
                  )}>
                    {getDetailVideoUrl(selectedVideo) ? (
                      <video
                        src={getDetailVideoUrl(selectedVideo)!}
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Download Button */}
                {getDetailVideoUrl(selectedVideo) && (
                  <div className="flex justify-center">
                    <Button
                      onClick={() => handleDownload(getDetailVideoUrl(selectedVideo)!, `video-${selectedVideo.id}.mp4`)}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {t.download}
                    </Button>
                  </div>
                )}

                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4" />
                      {t.prompt}
                    </h3>
                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedVideo.prompt}</p>
                  </div>

                  {selectedVideo.negative_prompt && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        {t.negativePrompt}
                      </h3>
                      <p className="text-sm bg-muted p-3 rounded-lg">{selectedVideo.negative_prompt}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Video Settings */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                    <Settings className="h-4 w-4" />
                    {t.videoSettings}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{t.duration}</p>
                      <p className="font-medium">{selectedVideo.duration_seconds}s</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{t.aspectRatio}</p>
                      <p className="font-medium">{selectedVideo.aspect_ratio}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{t.status}</p>
                      <p className="font-medium">{selectedVideo.status}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{t.qualityScore}</p>
                      <p className="font-medium">{selectedVideo.quality_score ?? "-"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Generation Type */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                    <Wand2 className="h-4 w-4" />
                    {t.generationType}
                  </h3>
                  <Badge variant="outline" className="border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                    {isComposeVideo(selectedVideo) ? (
                      <>
                        <Layers className="h-3 w-3 mr-1" />
                        {t.fastCutVideo}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        {t.aiVideo}
                      </>
                    )}
                  </Badge>
                </div>

                {/* Audio Info */}
                {selectedVideo.audio_asset && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                        <Music className="h-4 w-4" />
                        {t.audio}
                      </h3>
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <p className="text-sm">
                          <span className="text-muted-foreground">{t.filename}: </span>
                          {selectedVideo.audio_asset.original_filename || selectedVideo.audio_asset.filename}
                        </p>
                        {selectedVideo.audio_start_time !== undefined && selectedVideo.audio_start_time !== null && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">{t.startTime}: </span>
                            {selectedVideo.audio_start_time.toFixed(1)}s
                          </p>
                        )}
                        {selectedVideo.audio_duration !== undefined && selectedVideo.audio_duration !== null && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">{t.duration}: </span>
                            {selectedVideo.audio_duration.toFixed(1)}s
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Reference Style */}
                {selectedVideo.reference_style && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                        {t.referenceStyle}
                      </h3>
                      <p className="text-sm bg-muted p-3 rounded-lg">{selectedVideo.reference_style}</p>
                    </div>
                  </>
                )}

                {/* Effect Preset */}
                {selectedVideo.effect_preset && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4" />
                        {t.effectPreset}
                      </h3>
                      <Badge variant="outline">{selectedVideo.effect_preset}</Badge>
                    </div>
                  </>
                )}

                {/* Tags */}
                {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                        <Tag className="h-4 w-4" />
                        {t.tags}
                      </h3>
                      <div className="flex flex-wrap gap-1">
                        {selectedVideo.tags.map((tag, i) => (
                          <Badge key={i} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t.createdAt}
                    </span>
                    <p>{new Date(selectedVideo.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t.updatedAt}
                    </span>
                    <p>{new Date(selectedVideo.updated_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* ID */}
                <div className="text-xs text-muted-foreground">
                  <span>ID: </span>
                  <code className="bg-muted px-1 py-0.5 rounded">{selectedVideo.id}</code>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              {t.loadFailed}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteVideoId} onOpenChange={(open) => !open && setDeleteVideoId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>{t.deleteConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteVideoId(null)}
              disabled={deleting}
            >
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {t.deleting}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t.delete}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
