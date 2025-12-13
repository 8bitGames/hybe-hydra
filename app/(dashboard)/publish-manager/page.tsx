"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  RefreshCw,
  Search,
  Video,
  Edit,
  Check,
  X,
  Copy,
  ExternalLink,
  MoreVertical,
  Filter,
  Grid,
  List,
  Hash,
  FileText,
  Calendar,
  Play,
  Eye,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoItem {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  generationType: string;
  status: string;
  prompt: string;
  outputUrl: string | null;
  tags: string[];
  tiktokSeo: {
    description?: string;
    hashtags?: string[];
    keywords?: string[];
  } | null;
  trendKeywords: string[];
  qualityScore: number | null;
  durationSeconds: number;
  aspectRatio: string;
  createdAt: string;
  createdBy: string;
}

// Safely convert to array
const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",").map(s => s.trim()).filter(Boolean);
  return [];
};

// Get tags from video (hashtags or tags)
const getVideoTags = (video: VideoItem): string[] => {
  return toArray(video.tiktokSeo?.hashtags) || toArray(video.tags) || [];
};

// Sanitize filename - remove special chars
const sanitizeFilename = (str: string): string => {
  return str
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 100);
};

// Get description for publishing (not prompt)
const getVideoDescription = (video: VideoItem): string => {
  return video.tiktokSeo?.description || "";
};

// Generate filename from description
const generateFilename = (video: VideoItem): string => {
  const description = getVideoDescription(video);

  // If no description, use video id
  if (!description) {
    return `video_${video.id.substring(0, 8)}.mp4`;
  }

  // Use description as filename (max 100 chars)
  const filename = sanitizeFilename(description.substring(0, 100));
  return `${filename}.mp4`;
};

// Download video with custom filename
const downloadVideo = async (video: VideoItem) => {
  if (!video.outputUrl) return;

  try {
    const response = await fetch(video.outputUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generateFilename(video);
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Download failed:", error);
    // Fallback: open in new tab
    window.open(video.outputUrl, "_blank");
  }
};

// Copy to clipboard
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export default function PublishManagerPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const { language } = useI18n();
  const toast = useToast();
  const isKorean = language === "ko";

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  // Edit modal state
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Preview modal state
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);

  // Generating description state
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadVideos = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        status: "COMPLETED",
      });

      const response = await api.get<{
        items: any[];
        total: number;
        page: number;
        page_size: number;
        pages: number;
      }>(`/api/v1/generations?${params}`);

      if (response.data?.items) {
        const mappedVideos: VideoItem[] = response.data.items.map((item: any) => ({
          id: item.id,
          campaignId: item.campaign_id,
          campaignName: item.campaign_name,
          generationType: item.generation_type,
          status: item.status,
          prompt: item.prompt || "",
          outputUrl: item.output_url,
          tags: item.tags || [],
          tiktokSeo: item.tiktok_seo,
          trendKeywords: item.trend_keywords || [],
          qualityScore: item.quality_score,
          durationSeconds: item.duration_seconds || 0,
          aspectRatio: item.aspect_ratio || "9:16",
          createdAt: item.created_at,
          createdBy: item.created_by,
        }));

        setVideos(mappedVideos);
        setTotalPages(response.data.pages);
      }
    } catch (err) {
      console.error("Failed to load videos:", err);
      toast.error(
        isKorean ? "오류" : "Error",
        isKorean ? "영상 목록을 불러오는데 실패했습니다" : "Failed to load videos"
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken, page, isKorean, toast]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Filter videos by search query
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;

    const query = searchQuery.toLowerCase();
    return videos.filter(v =>
      v.prompt?.toLowerCase().includes(query) ||
      v.campaignName?.toLowerCase().includes(query) ||
      v.tags.some(t => t.toLowerCase().includes(query)) ||
      v.tiktokSeo?.description?.toLowerCase().includes(query) ||
      v.tiktokSeo?.hashtags?.some(h => h.toLowerCase().includes(query))
    );
  }, [videos, searchQuery]);

  // Filter by tab
  const displayVideos = useMemo(() => {
    switch (activeTab) {
      case "ai":
        return filteredVideos.filter(v => v.generationType === "ai");
      case "compose":
        return filteredVideos.filter(v => v.generationType === "compose");
      default:
        return filteredVideos;
    }
  }, [filteredVideos, activeTab]);

  // Handle edit
  const handleEdit = (video: VideoItem) => {
    setEditingVideo(video);
    setEditDescription(getVideoDescription(video));
    setEditTags(getVideoTags(video).join(", "));
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingVideo) return;

    setIsSaving(true);
    try {
      const hashtags = editTags
        .split(",")
        .map(t => t.trim().replace(/^#/, ""))
        .filter(t => t.length > 0);

      await api.patch(`/api/v1/generations/${editingVideo.id}`, {
        tiktok_seo: {
          ...editingVideo.tiktokSeo,
          description: editDescription,
          hashtags,
        },
        tags: hashtags,
      });

      // Update local state
      setVideos(prev => prev.map(v =>
        v.id === editingVideo.id
          ? {
              ...v,
              tiktokSeo: { ...v.tiktokSeo, description: editDescription, hashtags },
              tags: hashtags,
            }
          : v
      ));

      toast.success(
        isKorean ? "저장 완료" : "Saved",
        isKorean ? "발행 정보가 업데이트되었습니다" : "Publishing info updated"
      );
      setEditingVideo(null);
    } catch (err) {
      console.error("Failed to save:", err);
      toast.error(
        isKorean ? "오류" : "Error",
        isKorean ? "저장에 실패했습니다" : "Failed to save"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Copy all info to clipboard
  const handleCopyInfo = async (video: VideoItem) => {
    const description = getVideoDescription(video);
    const hashtags = getVideoTags(video)
      .map(t => `#${t.replace(/^#/, "")}`)
      .join(" ");

    const text = description && hashtags
      ? `${description}\n\n${hashtags}`
      : description || hashtags || "";
    const success = await copyToClipboard(text);

    if (success) {
      toast.success(
        isKorean ? "복사됨" : "Copied",
        isKorean ? "발행 정보가 클립보드에 복사되었습니다" : "Publishing info copied to clipboard"
      );
    }
  };

  // Generate TikTok description using AI
  const handleGenerateDescription = async (video: VideoItem) => {
    if (!video.prompt) {
      toast.error(
        isKorean ? "오류" : "Error",
        isKorean ? "프롬프트가 없어 설명을 생성할 수 없습니다" : "Cannot generate description without prompt"
      );
      return;
    }

    setGeneratingId(video.id);
    try {
      const response = await api.post<{
        success: boolean;
        description: string;
        hashtags: string[];
      }>("/api/v1/ai/generate-tiktok-description", {
        prompt: video.prompt,
        campaignName: video.campaignName,
        trendKeywords: video.trendKeywords,
        language: isKorean ? "ko" : "en",
      });

      if (response.data?.success && response.data.description) {
        const generatedDescription = response.data.description;
        const generatedHashtags = response.data.hashtags;

        // Update the video's tiktok_seo via PATCH
        const updateResponse = await api.patch(`/api/v1/generations/${video.id}`, {
          tiktok_seo: {
            description: generatedDescription,
            hashtags: generatedHashtags,
          },
          tags: generatedHashtags,
        });

        if (updateResponse.data && !updateResponse.error) {
          // Update local state
          setVideos((prev) =>
            prev.map((v) =>
              v.id === video.id
                ? {
                    ...v,
                    tiktokSeo: {
                      description: generatedDescription,
                      hashtags: generatedHashtags,
                    },
                    tags: generatedHashtags,
                  }
                : v
            )
          );
          toast.success(
            isKorean ? "생성 완료" : "Generated",
            isKorean ? "발행 설명이 생성되었습니다" : "Publishing description generated"
          );
        }
      }
    } catch (err) {
      console.error("Failed to generate description:", err);
      toast.error(
        isKorean ? "오류" : "Error",
        isKorean ? "설명 생성에 실패했습니다" : "Failed to generate description"
      );
    } finally {
      setGeneratingId(null);
    }
  };

  // Download with info
  const handleDownload = async (video: VideoItem) => {
    await downloadVideo(video);
    toast.success(
      isKorean ? "다운로드 시작" : "Download Started",
      isKorean ? "파일명에 설명과 태그가 포함됩니다" : "Filename includes description and tags"
    );
  };

  // Bulk download
  const handleBulkDownload = async () => {
    const selectedVideos = displayVideos.filter(v => v.outputUrl);
    if (selectedVideos.length === 0) return;

    toast.info(
      isKorean ? "다운로드 시작" : "Starting Downloads",
      isKorean ? `${selectedVideos.length}개 영상 다운로드 중...` : `Downloading ${selectedVideos.length} videos...`
    );

    for (const video of selectedVideos) {
      await downloadVideo(video);
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay between downloads
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isKorean ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 pb-8 px-[7%] py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isKorean ? "발행 관리" : "Publish Manager"}
          </h1>
          <p className="text-muted-foreground">
            {isKorean
              ? "영상 다운로드 및 발행 정보 관리 (수동 업로드용)"
              : "Download videos and manage publishing info for manual upload"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadVideos} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {isKorean ? "새로고침" : "Refresh"}
          </Button>
          <Button
            variant="outline"
            onClick={handleBulkDownload}
            disabled={displayVideos.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {isKorean ? "전체 다운로드" : "Download All"}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isKorean ? "설명, 태그, 캠페인명으로 검색..." : "Search by description, tags, campaign..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            {isKorean ? "전체" : "All"} ({filteredVideos.length})
          </TabsTrigger>
          <TabsTrigger value="ai">
            AI ({filteredVideos.filter(v => v.generationType === "ai").length})
          </TabsTrigger>
          <TabsTrigger value="compose">
            Compose ({filteredVideos.filter(v => v.generationType === "compose").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : displayVideos.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">
                  {isKorean ? "완료된 영상이 없습니다" : "No completed videos"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {isKorean
                    ? "영상 생성이 완료되면 여기에 표시됩니다"
                    : "Completed videos will appear here"}
                </p>
                <Button onClick={() => router.push("/start")}>
                  {isKorean ? "영상 만들기" : "Create Video"}
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === "table" ? (
            /* Table View */
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[80px]">{isKorean ? "미리보기" : "Preview"}</TableHead>
                    <TableHead className="min-w-[200px]">{isKorean ? "설명 / Description" : "Description"}</TableHead>
                    <TableHead className="min-w-[150px]">{isKorean ? "태그" : "Tags"}</TableHead>
                    <TableHead>{isKorean ? "캠페인" : "Campaign"}</TableHead>
                    <TableHead className="w-[100px]">{isKorean ? "유형" : "Type"}</TableHead>
                    <TableHead className="w-[100px]">{isKorean ? "생성일" : "Created"}</TableHead>
                    <TableHead className="w-[120px] text-right">{isKorean ? "작업" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayVideos.map((video) => (
                    <TableRow key={video.id} className="group">
                      <TableCell>
                        <button
                          onClick={() => setPreviewVideo(video)}
                          className="relative w-14 h-20 bg-black rounded overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                        >
                          {video.outputUrl ? (
                            <>
                              <video
                                src={video.outputUrl}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="h-4 w-4 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        {getVideoDescription(video) ? (
                          <p className="text-sm line-clamp-2">
                            {getVideoDescription(video)}
                          </p>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground italic">
                              {isKorean ? "미설정" : "Not set"}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleGenerateDescription(video)}
                              disabled={generatingId === video.id}
                            >
                              {generatingId === video.id ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Wand2 className="h-3 w-3 mr-1" />
                              )}
                              {isKorean ? "AI 생성" : "Generate"}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getVideoTags(video).slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              #{tag.replace(/^#/, "")}
                            </Badge>
                          ))}
                          {getVideoTags(video).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{getVideoTags(video).length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {video.campaignName || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={video.generationType === "ai" ? "default" : "secondary"}>
                          {video.generationType.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(video.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyInfo(video)}
                            title={isKorean ? "발행 정보 복사" : "Copy publish info"}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(video)}
                            title={isKorean ? "편집" : "Edit"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(video)}
                            disabled={!video.outputUrl}
                            title={isKorean ? "다운로드" : "Download"}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {displayVideos.map((video) => (
                <Card key={video.id} className="overflow-hidden group">
                  <div
                    className="aspect-[9/16] bg-black relative cursor-pointer"
                    onClick={() => setPreviewVideo(video)}
                  >
                    {video.outputUrl ? (
                      <>
                        <video
                          src={video.outputUrl}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-8 w-8 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge
                      className="absolute top-2 left-2 text-[10px]"
                      variant={video.generationType === "ai" ? "default" : "secondary"}
                    >
                      {video.generationType.toUpperCase()}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    {getVideoDescription(video) ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {getVideoDescription(video)}
                      </p>
                    ) : (
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-xs text-muted-foreground italic">
                          {isKorean ? "미설정" : "Not set"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 text-[10px] px-1.5"
                          onClick={() => handleGenerateDescription(video)}
                          disabled={generatingId === video.id}
                        >
                          {generatingId === video.id ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <Wand2 className="h-2.5 w-2.5" />
                          )}
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {getVideoTags(video).slice(0, 2).map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          #{tag.replace(/^#/, "")}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => handleCopyInfo(video)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {isKorean ? "복사" : "Copy"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => handleDownload(video)}
                        disabled={!video.outputUrl}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {isKorean ? "다운로드" : "Download"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(video)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {isKorean ? "편집" : "Edit"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPreviewVideo(video)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {isKorean ? "미리보기" : "Preview"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isKorean ? "발행 정보 편집" : "Edit Publishing Info"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                <FileText className="h-4 w-4 inline mr-1" />
                {isKorean ? "설명 (Description)" : "Description"}
              </label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={isKorean ? "영상 설명을 입력하세요..." : "Enter video description..."}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editDescription.length}/2200
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                <Hash className="h-4 w-4 inline mr-1" />
                {isKorean ? "태그 (쉼표로 구분)" : "Tags (comma separated)"}
              </label>
              <Input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder={isKorean ? "kpop, dance, viral" : "kpop, dance, viral"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isKorean ? "파일 다운로드 시 파일명에 포함됩니다" : "Will be included in filename when downloading"}
              </p>
            </div>

            {/* Preview filename */}
            {editingVideo && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-1">{isKorean ? "다운로드 파일명 미리보기" : "Download filename preview"}</p>
                <code className="text-xs text-muted-foreground break-all">
                  {generateFilename({
                    ...editingVideo,
                    tiktokSeo: {
                      ...editingVideo.tiktokSeo,
                      description: editDescription,
                      hashtags: editTags.split(",").map(t => t.trim()).filter(Boolean),
                    },
                  })}
                </code>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVideo(null)}>
              {isKorean ? "취소" : "Cancel"}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isKorean ? "저장" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewVideo} onOpenChange={(open) => !open && setPreviewVideo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isKorean ? "영상 미리보기" : "Video Preview"}
            </DialogTitle>
          </DialogHeader>

          {previewVideo && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {/* Video */}
                <div className="w-[200px] shrink-0">
                  <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden">
                    {previewVideo.outputUrl ? (
                      <video
                        src={previewVideo.outputUrl}
                        className="w-full h-full object-cover"
                        controls
                        autoPlay
                        muted
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {isKorean ? "설명" : "Description"}
                    </p>
                    <p className="text-sm">
                      {previewVideo.tiktokSeo?.description || previewVideo.prompt || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {isKorean ? "태그" : "Tags"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(previewVideo.tiktokSeo?.hashtags || previewVideo.tags || []).map((tag, i) => (
                        <Badge key={i} variant="secondary">
                          #{tag.replace(/^#/, "")}
                        </Badge>
                      ))}
                      {(previewVideo.tiktokSeo?.hashtags || previewVideo.tags || []).length === 0 && (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{isKorean ? "캠페인" : "Campaign"}</p>
                      <p>{previewVideo.campaignName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isKorean ? "유형" : "Type"}</p>
                      <Badge>{previewVideo.generationType.toUpperCase()}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isKorean ? "길이" : "Duration"}</p>
                      <p>{previewVideo.durationSeconds}s</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isKorean ? "생성일" : "Created"}</p>
                      <p>{formatDate(previewVideo.createdAt)}</p>
                    </div>
                  </div>

                  {/* Download filename preview */}
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium mb-1">{isKorean ? "다운로드 파일명" : "Download filename"}</p>
                    <code className="text-xs text-muted-foreground break-all">
                      {generateFilename(previewVideo)}
                    </code>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleCopyInfo(previewVideo)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {isKorean ? "발행 정보 복사" : "Copy Info"}
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleDownload(previewVideo)}
                  disabled={!previewVideo.outputUrl}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isKorean ? "다운로드" : "Download"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
