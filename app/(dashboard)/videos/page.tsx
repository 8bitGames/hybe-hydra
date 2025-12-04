"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useDashboardStats } from "@/lib/queries";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  PlayCircle,
  Search,
  Filter,
  Star,
  Clock,
  CheckCircle,
  FolderOpen,
  ExternalLink,
  MoreVertical,
  Trash2,
  Send,
  Download,
  Eye,
  Music,
  Image,
  Wand2,
  Film,
  Palette,
  Type,
  Sparkles,
  Calendar,
  User,
  Tag,
  FileText,
  Settings,
  Layers,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/ui/video-player";
import { VideoGeneration as FullVideoGeneration } from "@/lib/video-api";

interface VideoListItem {
  id: string;
  campaignId: string;
  campaignName: string;
  prompt: string;
  status: string;
  outputUrl: string | null;
  composedOutputUrl: string | null;
  qualityScore: number | null;
  createdAt: string;
}

export default function AllVideosPage() {
  const router = useRouter();
  const { language } = useI18n();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<FullVideoGeneration | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Use TanStack Query for data fetching with caching
  const { data: dashboardStats, isLoading: loading } = useDashboardStats();

  // Transform the data from dashboard stats
  const videos: VideoListItem[] = dashboardStats?.recent_activity?.generations?.map((gen: any) => ({
    id: gen.id,
    campaignId: gen.campaign_id,
    campaignName: gen.campaign_name,
    prompt: gen.prompt,
    status: "COMPLETED",
    outputUrl: gen.output_url,
    composedOutputUrl: gen.composed_output_url,
    qualityScore: gen.quality_score,
    createdAt: gen.created_at,
  })) || [];

  const fetchVideoDetail = useCallback(async (videoId: string) => {
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
  }, []);

  const getVideoUrl = (video: VideoListItem) => {
    return video.composedOutputUrl || video.outputUrl;
  };

  const getDetailVideoUrl = (video: FullVideoGeneration) => {
    return video.composed_output_url || video.output_url;
  };

  // Check if video is compose type (from generation_type or metadata)
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

  const filteredVideos = videos.filter((video) => {
    if (searchQuery && !video.prompt.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && video.status !== statusFilter) {
      return false;
    }
    if (campaignFilter !== "all" && video.campaignId !== campaignFilter) {
      return false;
    }
    return true;
  });

  const uniqueCampaigns = Array.from(new Set(videos.map(v => v.campaignId)))
    .map(id => ({
      id,
      name: videos.find(v => v.campaignId === id)?.campaignName || "Unknown"
    }));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="outline" className="border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          {language === "ko" ? "완료" : "Completed"}
        </Badge>;
      case "PROCESSING":
        return <Badge variant="outline" className="border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <Clock className="h-3 w-3 mr-1" />
          {language === "ko" ? "처리중" : "Processing"}
        </Badge>;
      case "FAILED":
        return <Badge variant="outline" className="border-zinc-500 bg-zinc-200 text-zinc-800 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200">
          {language === "ko" ? "실패" : "Failed"}
        </Badge>;
      default:
        return <Badge variant="outline" className="border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-8 px-[7%]">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {language === "ko" ? "모든 영상" : "All Videos"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ko"
              ? "캠페인 전체의 생성된 영상을 탐색하고 관리"
              : "Browse and manage all generated videos across campaigns"}
          </p>
        </div>
        <Button onClick={() => router.push("/create/generate")}>
          {language === "ko" ? "새 영상 만들기" : "Create New Video"}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ko" ? "프롬프트로 검색..." : "Search by prompt..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={language === "ko" ? "상태" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ko" ? "모든 상태" : "All Status"}</SelectItem>
                <SelectItem value="COMPLETED">{language === "ko" ? "완료" : "Completed"}</SelectItem>
                <SelectItem value="PROCESSING">{language === "ko" ? "처리중" : "Processing"}</SelectItem>
                <SelectItem value="FAILED">{language === "ko" ? "실패" : "Failed"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={language === "ko" ? "캠페인" : "Campaign"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ko" ? "모든 캠페인" : "All Campaigns"}</SelectItem>
                {uniqueCampaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={soundEnabled ? "default" : "outline"}
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={language === "ko" ? (soundEnabled ? "소리 끄기" : "소리 켜기") : (soundEnabled ? "Mute" : "Unmute")}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Videos Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <PlayCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">
              {language === "ko" ? "영상을 찾을 수 없습니다" : "No videos found"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {videos.length === 0
                ? (language === "ko" ? "영상 생성을 시작해보세요" : "Start generating videos to see them here")
                : (language === "ko" ? "필터를 조정해보세요" : "Try adjusting your filters")}
            </p>
            <Button onClick={() => router.push("/create/generate")}>
              {language === "ko" ? "첫 영상 만들기" : "Create Your First Video"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              {/* Video Thumbnail */}
              <div className="relative aspect-video bg-muted">
                <VideoPlayer
                  src={getVideoUrl(video)}
                  className="w-full h-full"
                  playOnHover={true}
                  soundOnHover={soundEnabled}
                />
                {video.qualityScore && (
                  <Badge
                    variant="outline"
                    className="absolute top-2 right-2 border-zinc-400 bg-white/90 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-900/90 dark:text-zinc-100"
                  >
                    <Star className="h-3 w-3 mr-1" />
                    {video.qualityScore.toFixed(0)}%
                  </Badge>
                )}
              </div>

              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{video.prompt}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                        <FolderOpen className="h-3 w-3 mr-1" />
                        {video.campaignName}
                      </Badge>
                      {getStatusBadge(video.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => fetchVideoDetail(video.id)}>
                        <Eye className="h-4 w-4 mr-2" />
                        {language === "ko" ? "상세보기" : "View Details"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`/campaigns/${video.campaignId}/curation`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {language === "ko" ? "캠페인에서 보기" : "View in Campaign"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`/campaigns/${video.campaignId}/publish`)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {language === "ko" ? "게시 예약" : "Schedule Publish"}
                      </DropdownMenuItem>
                      {getVideoUrl(video) && (
                        <DropdownMenuItem asChild>
                          <a href={getVideoUrl(video)!} download>
                            <Download className="h-4 w-4 mr-2" />
                            {language === "ko" ? "다운로드" : "Download"}
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        {language === "ko" ? "삭제" : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              {language === "ko" ? "영상 상세 정보" : "Video Details"}
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

                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4" />
                      {language === "ko" ? "프롬프트" : "Prompt"}
                    </h3>
                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedVideo.prompt}</p>
                  </div>

                  {selectedVideo.negative_prompt && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        {language === "ko" ? "네거티브 프롬프트" : "Negative Prompt"}
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
                    {language === "ko" ? "영상 설정" : "Video Settings"}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "길이" : "Duration"}</p>
                      <p className="font-medium">{selectedVideo.duration_seconds}s</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "비율" : "Aspect Ratio"}</p>
                      <p className="font-medium">{selectedVideo.aspect_ratio}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "상태" : "Status"}</p>
                      <p className="font-medium">{selectedVideo.status}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "품질 점수" : "Quality Score"}</p>
                      <p className="font-medium">{selectedVideo.quality_score ?? "-"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Generation Type */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                    <Wand2 className="h-4 w-4" />
                    {language === "ko" ? "생성 타입" : "Generation Type"}
                  </h3>
                  <Badge variant="outline" className="border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                    {isComposeVideo(selectedVideo) ? (
                      <>
                        <Layers className="h-3 w-3 mr-1" />
                        {language === "ko" ? "컴포즈 영상" : "Compose Video"}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        {language === "ko" ? "AI 영상" : "AI Video"}
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
                        {language === "ko" ? "오디오" : "Audio"}
                      </h3>
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <p className="text-sm">
                          <span className="text-muted-foreground">{language === "ko" ? "파일명: " : "Filename: "}</span>
                          {selectedVideo.audio_asset.original_filename || selectedVideo.audio_asset.filename}
                        </p>
                        {selectedVideo.audio_start_time !== undefined && selectedVideo.audio_start_time !== null && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">{language === "ko" ? "시작 시간: " : "Start Time: "}</span>
                            {selectedVideo.audio_start_time.toFixed(1)}s
                          </p>
                        )}
                        {selectedVideo.audio_duration !== undefined && selectedVideo.audio_duration !== null && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">{language === "ko" ? "길이: " : "Duration: "}</span>
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
                        <Palette className="h-4 w-4" />
                        {language === "ko" ? "참조 스타일" : "Reference Style"}
                      </h3>
                      <p className="text-sm bg-muted p-3 rounded-lg">{selectedVideo.reference_style}</p>
                    </div>
                  </>
                )}

                {/* Effect Preset (Compose) */}
                {selectedVideo.effect_preset && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4" />
                        {language === "ko" ? "이펙트 프리셋" : "Effect Preset"}
                      </h3>
                      <Badge variant="outline" className="border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">{selectedVideo.effect_preset}</Badge>
                    </div>
                  </>
                )}

                {/* Quality Metadata */}
                {selectedVideo.quality_metadata && Object.keys(selectedVideo.quality_metadata).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                        <Tag className="h-4 w-4" />
                        {language === "ko" ? "메타데이터" : "Metadata"}
                      </h3>
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        {Boolean(selectedVideo.quality_metadata.batchId) && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Batch ID: </span>
                            <code className="text-xs">{String(selectedVideo.quality_metadata.batchId)}</code>
                          </p>
                        )}
                        {Boolean(selectedVideo.quality_metadata.variationType) && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">{language === "ko" ? "변형 타입: " : "Variation Type: "}</span>
                            {String(selectedVideo.quality_metadata.variationType)}
                          </p>
                        )}
                        {Boolean(selectedVideo.quality_metadata.variationLabel) && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">{language === "ko" ? "변형 라벨: " : "Variation Label: "}</span>
                            {String(selectedVideo.quality_metadata.variationLabel)}
                          </p>
                        )}
                        {Array.isArray(selectedVideo.quality_metadata.searchTags) && selectedVideo.quality_metadata.searchTags.length > 0 && (
                          <div>
                            <span className="text-sm text-muted-foreground">{language === "ko" ? "검색 태그: " : "Search Tags: "}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(selectedVideo.quality_metadata.searchTags as string[]).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {Boolean(selectedVideo.quality_metadata.settings) && typeof selectedVideo.quality_metadata.settings === 'object' && (
                          <div>
                            <span className="text-sm text-muted-foreground">{language === "ko" ? "설정: " : "Settings: "}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(selectedVideo.quality_metadata.settings as Record<string, unknown>).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-xs border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {Array.isArray(selectedVideo.quality_metadata.appliedPresets) && selectedVideo.quality_metadata.appliedPresets.length > 0 && (
                          <div>
                            <span className="text-sm text-muted-foreground">{language === "ko" ? "적용된 프리셋: " : "Applied Presets: "}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(selectedVideo.quality_metadata.appliedPresets as Array<{name: string; category: string}>).map((preset, i) => (
                                <Badge key={i} variant="outline" className="text-xs border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {preset.category}: {preset.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
                        {language === "ko" ? "태그" : "Tags"}
                      </h3>
                      <div className="flex flex-wrap gap-1">
                        {selectedVideo.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
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
                      {language === "ko" ? "생성일" : "Created"}
                    </span>
                    <p>{new Date(selectedVideo.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {language === "ko" ? "수정일" : "Updated"}
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
              {language === "ko" ? "영상 정보를 불러올 수 없습니다" : "Failed to load video details"}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
