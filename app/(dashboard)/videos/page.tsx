"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  MoreVertical,
  Trash2,
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
  Edit3,
  Expand,
  ChevronsLeft,
  ChevronsRight,
  GitMerge,
  Link2,
  Music,
  ArrowLeft,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { VideoGeneration as FullVideoGeneration, variationsApi } from "@/lib/video-api";
import { fastCutApi } from "@/lib/fast-cut-api";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { VideoEditModal } from "@/components/features/video-edit-modal";
import { VideoExtendPanel } from "@/components/features/processing/VideoExtendPanel";
import { useToast } from "@/components/ui/toast";
import { VariationConfigView, AIVariationConfigView } from "@/components/features/processing/views";
import {
  useProcessingSessionStore,
  selectSession,
  selectOriginalVideo,
  selectIsGeneratingVariations,
  selectVariations,
  selectSelectedStyles,
  ContentType,
} from "@/lib/stores/processing-session-store";
import { CompareApproveView } from "@/components/features/processing/views";

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

// Video edit metadata type
interface VideoEditMetadata {
  originalGenerationId: string;
  originalOutputUrl: string;
  editedAt: string;
  editType: string[];
  audioAssetId?: string;
  audioAssetName?: string;
  hasSubtitles: boolean;
  subtitleLineCount: number;
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
  tags?: string[];
  quality_metadata?: {
    videoEdit?: VideoEditMetadata;
    composition?: {
      audioAssetId?: string;
      audioAssetName?: string;
    };
    [key: string]: unknown;
  } | null;
  extension_count?: number;
  // Audio asset info
  audio_asset?: {
    id: string;
    filename: string;
    original_filename: string;
    s3_url: string;
  } | null;
};

type VideoType = "all" | "ai" | "fast-cut";
type EditedFilter = "all" | "edited" | "original";

export default function AllVideosPage() {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [videoType, setVideoType] = useState<VideoType>("all");
  const [editedFilter, setEditedFilter] = useState<EditedFilter>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("videos-page-size");
      return saved ? Number(saved) : 20;
    }
    return 20;
  });

  // Side panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<UnifiedVideo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Delete state
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editVideo, setEditVideo] = useState<UnifiedVideo | null>(null);

  // Extend state
  const [extendVideo, setExtendVideo] = useState<UnifiedVideo | null>(null);

  // Variation inline view state
  const [showVariationView, setShowVariationView] = useState(false);
  const [variationVideo, setVariationVideo] = useState<UnifiedVideo | null>(null);
  const [variationBatchId, setVariationBatchId] = useState<string | null>(null);
  const variationPollingRef = useRef<NodeJS.Timeout | null>(null);
  const variationBatchIdRef = useRef<string | null>(null);

  // Store connections for variation
  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);
  const isGeneratingVariations = useProcessingSessionStore(selectIsGeneratingVariations);
  const variations = useProcessingSessionStore(selectVariations);
  const selectedStyles = useProcessingSessionStore(selectSelectedStyles);
  const {
    initSessionForVariation,
    goToVariationConfig,
    goToCompareAndApprove,
    startVariationGeneration,
    updateVariation,
    setVariationCompleted,
    setVariationFailed,
    clearSession,
  } = useProcessingSessionStore();

  // Track if there are PROCESSING videos for auto-refresh
  const [hasProcessingVideos, setHasProcessingVideos] = useState(false);

  // Fetch ALL videos (client-side pagination)
  const { data: composeData, isLoading: loadingCompose, refetch: refetchCompose } = useFastCutVideos({
    page_size: 500, // Fetch all at once for client-side pagination
  });
  const { data: aiData, isLoading: loadingAI, refetch: refetchAI } = useAllAIVideos({
    refetchInterval: hasProcessingVideos ? 5000 : undefined, // Auto-refresh every 5s when processing
  });

  const composeVideos = composeData?.items || [];
  const aiVideos = aiData?.items || [];

  // Update hasProcessingVideos when aiVideos changes
  useEffect(() => {
    const hasProcessing = aiVideos.some(
      (video) => video.status.toUpperCase() === "PROCESSING"
    );
    setHasProcessingVideos(hasProcessing);
  }, [aiVideos]);

  // Helper to check if video is displayable (completed with output URL)
  // Note: status can be "completed" or "COMPLETED" depending on source
  const isVideoDisplayable = (video: { status: string; output_url: string | null; composed_output_url: string | null }) =>
    video.status.toLowerCase() === "completed" && (video.output_url || video.composed_output_url);

  // Calculate totals - use API total for Fast Cut (paginated), filter count for AI (not paginated)
  // Fast Cut API already filters for COMPLETED and composedOutputUrl not null
  const aiTotal = aiVideos.filter(isVideoDisplayable).length;
  const composeTotal = composeData?.total || 0;  // Use API total instead of counting current page
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
    download: language === "ko" ? "다운로드" : "Download",
    delete: language === "ko" ? "삭제" : "Delete",
    deleteConfirm: language === "ko" ? "정말 이 영상을 삭제하시겠습니까?" : "Are you sure you want to delete this video?",
    deleteConfirmTitle: language === "ko" ? "영상 삭제" : "Delete Video",
    deleting: language === "ko" ? "삭제 중..." : "Deleting...",
    confirm: language === "ko" ? "확인" : "Confirm",
    cancel: language === "ko" ? "취소" : "Cancel",
    previous: language === "ko" ? "이전" : "Previous",
    next: language === "ko" ? "다음" : "Next",
    editVideo: language === "ko" ? "영상 편집" : "Edit Video",
    extendVideo: language === "ko" ? "영상 확장" : "Extend Video",
    perPage: language === "ko" ? "개씩 보기" : "per page",
    showing: language === "ko" ? "표시" : "Showing",
    to: language === "ko" ? "~" : "to",
    ofTotal: language === "ko" ? "/ 총" : "of",
    edited: language === "ko" ? "편집됨" : "Edited",
    extended: language === "ko" ? "확장됨" : "Extended",
    editedFilter: language === "ko" ? "편집 필터" : "Edit Filter",
    editedFilterAll: language === "ko" ? "전체" : "All",
    editedFilterEdited: language === "ko" ? "편집됨" : "Edited",
    editedFilterOriginal: language === "ko" ? "원본만" : "Originals",
    viewOriginal: language === "ko" ? "원본 영상 보기" : "View Original",
    originalVideo: language === "ko" ? "원본 영상" : "Original Video",
    variation: language === "ko" ? "배리에이션" : "Variation",
    variationStarted: language === "ko" ? "배리에이션 생성이 시작되었습니다" : "Variation generation started",
    variationFailed: language === "ko" ? "배리에이션 생성에 실패했습니다" : "Failed to create variation",
  };

  // Reset page when tab or page size changes
  const handleVideoTypeChange = (v: VideoType) => {
    setVideoType(v);
    setPage(1);
  };

  const handlePageSizeChange = (v: string) => {
    const newSize = Number(v);
    setPageSize(newSize);
    setPage(1);
    localStorage.setItem("videos-page-size", v);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
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
    tags: video.tags,
    quality_metadata: video.quality_metadata,
    audio_asset: video.audio_asset,
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
    tags: video.tags,
    quality_metadata: video.quality_metadata,
    extension_count: video.extension_count,
    audio_asset: video.audio_asset,
  }));

  // Helper to check if video is edited
  const isEditedVideo = (video: UnifiedVideo) => {
    return video.tags?.includes("edited") || !!video.quality_metadata?.videoEdit;
  };

  // Helper to check if video is extended
  const isExtendedVideo = (video: UnifiedVideo) => {
    return (video.extension_count || 0) > 0;
  };

  // Filter videos (all filtered, before pagination)
  const allFilteredVideos = useMemo(() => {
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

    // Apply edited filter
    if (editedFilter === "edited") {
      baseVideos = baseVideos.filter(isEditedVideo);
    } else if (editedFilter === "original") {
      baseVideos = baseVideos.filter((video) => !isEditedVideo(video));
    }

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
  }, [unifiedAIVideos, unifiedComposeVideos, searchQuery, videoType, editedFilter]);

  // Pagination calculations
  const totalFiltered = allFilteredVideos.length;
  const totalPages = Math.ceil(totalFiltered / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const filteredVideos = allFilteredVideos.slice(startIndex, endIndex);

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

  // Variation handler - shows inline VariationConfigView
  const handleOpenVariation = useCallback((video: UnifiedVideo) => {
    const videoUrl = video.composed_output_url || video.output_url;
    if (!videoUrl) {
      toast.error(language === "ko" ? "영상 URL이 없습니다" : "Video URL not found");
      return;
    }

    const contentType: ContentType = video.generation_type === "AI" ? "ai_video" : "fast-cut";

    // Initialize the store with the video for variation
    initSessionForVariation({
      generationId: video.id,
      outputUrl: videoUrl,
      campaignId: video.campaign_id,
      campaignName: video.campaign_name || "Campaign",
      contentType,
      duration: video.duration_seconds,
    });

    // Transition to variation config state
    goToVariationConfig();

    // Set local state to show the view
    setVariationVideo(video);
    setShowVariationView(true);
    setPanelOpen(false); // Close the detail panel if open
  }, [language, toast, initSessionForVariation, goToVariationConfig]);

  // Handle starting variation generation
  const handleStartVariationGeneration = useCallback(async () => {
    if (!variationVideo || !originalVideo) return;

    const seedGenerationId = originalVideo.id;
    const contentType = session?.contentType;
    const isAIVideo = contentType === "ai_video";

    // Get selected styles directly from store state (avoid stale closure)
    const storeState = useProcessingSessionStore.getState();
    const currentSelectedStyles = storeState.session?.variationConfig.selectedStyles || [];

    if (currentSelectedStyles.length === 0) {
      toast.error(language === "ko" ? "스타일을 선택해주세요" : "Please select at least one style");
      return;
    }

    try {
      if (isAIVideo) {
        // AI Video variation - use variationsApi
        console.log("[Videos] Starting AI Video variations:", {
          seedGenerationId,
          styleCount: currentSelectedStyles.length,
        });

        // Create store variations first
        startVariationGeneration();

        // Call API
        const response = await variationsApi.create(seedGenerationId, {
          preset_ids: currentSelectedStyles,
          max_variations: currentSelectedStyles.length || 4,
        });

        console.log("[Videos] AI variation API response:", response);

        // Update store variations with API generationIds
        if (response.data?.variations) {
          const storeVariations = useProcessingSessionStore.getState().session?.variations || [];
          response.data.variations.forEach((apiVar, idx) => {
            const storeVar = storeVariations[idx];
            if (storeVar) {
              updateVariation(storeVar.id, {
                generationId: apiVar.id,
                status: "generating",
              });
            }
          });
        }

        // Set batch ID for polling
        if (response.data?.batch_id) {
          variationBatchIdRef.current = response.data.batch_id;
          setVariationBatchId(response.data.batch_id);
        }

      } else {
        // Compose (Fast-Cut) variation - use fastCutApi
        console.log("[Videos] Starting Compose variations:", {
          seedGenerationId,
          styleCount: currentSelectedStyles.length,
        });

        // Create store variations first
        startVariationGeneration();

        // Call API
        const response = await fastCutApi.startComposeVariations(
          seedGenerationId.startsWith("compose-") ? seedGenerationId : `compose-${seedGenerationId}`,
          { variationCount: currentSelectedStyles.length || 8 }
        );

        console.log("[Videos] Compose variation API response:", response);

        // Map API response to store variations
        if (response.variations) {
          const storeVariations = useProcessingSessionStore.getState().session?.variations || [];
          response.variations.forEach((apiVar, idx) => {
            const storeVar = storeVariations[idx];
            if (storeVar) {
              updateVariation(storeVar.id, {
                generationId: apiVar.id,
                status: "generating",
              });
            }
          });
        }

        // Set batch ID for polling
        if (response.batch_id) {
          variationBatchIdRef.current = response.batch_id;
          setVariationBatchId(response.batch_id);
        }
      }

      toast.success(t.variationStarted);
    } catch (error) {
      console.error("[Videos] Variation generation failed:", error);
      toast.error(t.variationFailed);
    }
  }, [variationVideo, originalVideo, session, language, toast, t, startVariationGeneration, updateVariation]);

  // Polling for variation status
  useEffect(() => {
    if (!variationBatchId || !showVariationView) {
      return;
    }

    const contentType = session?.contentType;
    const isAIVideo = contentType === "ai_video";

    const pollStatus = async () => {
      try {
        const currentBatchId = variationBatchIdRef.current;
        if (!currentBatchId) return;

        // Get fresh state from store
        const storeState = useProcessingSessionStore.getState();
        const storeVariations = storeState.session?.variations || [];

        if (isAIVideo) {
          // AI Video polling - need both generationId and batchId
          const seedGenerationId = storeState.session?.originalVideo?.id;
          if (!seedGenerationId) return;

          const response = await variationsApi.getStatus(seedGenerationId, currentBatchId);
          console.log("[Videos] AI variation poll response:", response);

          if (response.data?.variations) {
            response.data.variations.forEach((apiVar: { id: string; status: string; output_url?: string }) => {
              const storeVar = storeVariations.find(v => v.generationId === apiVar.id);
              if (storeVar) {
                if (apiVar.status === "completed" && apiVar.output_url) {
                  setVariationCompleted(apiVar.id, apiVar.output_url);
                } else if (apiVar.status === "failed") {
                  setVariationFailed(apiVar.id);
                } else if (apiVar.status === "processing" || apiVar.status === "generating") {
                  updateVariation(apiVar.id, { status: "generating" });
                }
              }
            });
          }

          // Check if batch is complete
          if (response.data?.batch_status === "completed" || response.data?.batch_status === "partial_failure") {
            console.log("[Videos] AI variation batch complete");
            if (variationPollingRef.current) {
              clearInterval(variationPollingRef.current);
              variationPollingRef.current = null;
            }
            setVariationBatchId(null);
            variationBatchIdRef.current = null;
          }
        } else {
          // Compose polling
          const response = await fastCutApi.getComposeVariationsStatus(currentBatchId);
          console.log("[Videos] Compose variation poll response:", response);

          if (response.variations) {
            response.variations.forEach((apiVar) => {
              const storeVar = storeVariations.find(v => v.generationId === apiVar.id);
              if (storeVar) {
                if (apiVar.status === "COMPLETED" && apiVar.output_url) {
                  setVariationCompleted(apiVar.id, apiVar.output_url);
                } else if (apiVar.status === "FAILED") {
                  setVariationFailed(apiVar.id);
                } else if (apiVar.status === "PROCESSING" || apiVar.status === "PENDING") {
                  updateVariation(apiVar.id, { status: "generating" });
                }
              }
            });
          }

          // Check if batch is complete
          if (response.batch_status === "completed" || response.batch_status === "partial_failure") {
            console.log("[Videos] Compose variation batch complete");
            if (variationPollingRef.current) {
              clearInterval(variationPollingRef.current);
              variationPollingRef.current = null;
            }
            setVariationBatchId(null);
            variationBatchIdRef.current = null;
          }
        }
      } catch (error) {
        console.error("[Videos] Variation poll error:", error);
      }
    };

    // Start polling every 3 seconds
    variationPollingRef.current = setInterval(pollStatus, 3000);

    // Initial poll
    pollStatus();

    return () => {
      if (variationPollingRef.current) {
        clearInterval(variationPollingRef.current);
        variationPollingRef.current = null;
      }
    };
  }, [variationBatchId, showVariationView, session?.contentType, updateVariation, setVariationCompleted, setVariationFailed]);

  // Handle closing variation view
  const handleCloseVariationView = useCallback(() => {
    // Stop polling
    if (variationPollingRef.current) {
      clearInterval(variationPollingRef.current);
      variationPollingRef.current = null;
    }
    setVariationBatchId(null);
    variationBatchIdRef.current = null;

    // Clear store
    clearSession();

    // Clear local state
    setShowVariationView(false);
    setVariationVideo(null);

    // Refresh the video list to show any new variations
    refetchCompose();
    refetchAI();
  }, [clearSession, refetchCompose, refetchAI]);

  // Open video in side panel (index is relative to current page)
  const openVideo = (video: UnifiedVideo, indexInPage: number) => {
    setSelectedVideo(video);
    // Convert page-relative index to global index
    setSelectedIndex(startIndex + indexInPage);
    setPanelOpen(true);
  };

  // Navigate to prev/next video (uses allFilteredVideos for full navigation)
  const goToPrevious = () => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1;
      setSelectedVideo(allFilteredVideos[newIndex]);
      setSelectedIndex(newIndex);
      // Update page if needed
      const newPage = Math.floor(newIndex / pageSize) + 1;
      if (newPage !== page) setPage(newPage);
    }
  };

  const goToNext = () => {
    if (selectedIndex < allFilteredVideos.length - 1) {
      const newIndex = selectedIndex + 1;
      setSelectedVideo(allFilteredVideos[newIndex]);
      setSelectedIndex(newIndex);
      // Update page if needed
      const newPage = Math.floor(newIndex / pageSize) + 1;
      if (newPage !== page) setPage(newPage);
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
  }, [panelOpen, selectedIndex, allFilteredVideos, pageSize, page]);

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
          <Tabs value={videoType} onValueChange={(v) => handleVideoTypeChange(v as VideoType)}>
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
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={editedFilter}
              onValueChange={(v: EditedFilter) => {
                setEditedFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9">
                <GitMerge className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.editedFilterAll}</SelectItem>
                <SelectItem value="edited">{t.editedFilterEdited}</SelectItem>
                <SelectItem value="original">{t.editedFilterOriginal}</SelectItem>
              </SelectContent>
            </Select>
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
                  {isEditedVideo(video) && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 right-2 bg-purple-600/90 text-white text-[10px]"
                    >
                      <GitMerge className="h-3 w-3 mr-1" />{t.edited}
                    </Badge>
                  )}
                  {isExtendedVideo(video) && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "absolute top-2 bg-blue-600/90 text-white text-[10px]",
                        isEditedVideo(video) ? "right-[70px]" : "right-2"
                      )}
                    >
                      <Expand className="h-3 w-3 mr-1" />{t.extended}
                    </Badge>
                  )}
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
                          {isEditedVideo(video) && video.quality_metadata?.videoEdit?.originalGenerationId && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              // Find the original video and open it
                              const originalId = video.quality_metadata?.videoEdit?.originalGenerationId;
                              const originalVideo = allFilteredVideos.find(v => v.id === originalId);
                              if (originalVideo) {
                                const originalIndex = allFilteredVideos.indexOf(originalVideo);
                                openVideo(originalVideo, originalIndex);
                              } else {
                                // If not in current filter, navigate to the video
                                router.push(`/campaigns/${video.campaign_id}/curation?video=${originalId}`);
                              }
                            }}>
                              <Link2 className="h-4 w-4 mr-2" />
                              {t.viewOriginal}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditVideo(video); }}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            {t.editVideo}
                          </DropdownMenuItem>
                          {video.generation_type === "AI" && !isEditedVideo(video) && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setExtendVideo(video); }}>
                              <Expand className="h-4 w-4 mr-2" />
                              {t.extendVideo}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenVariation(video); }}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {t.variation}
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
          {totalFiltered > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              {/* Left: Page size selector */}
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[100px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">{t.perPage}</span>
              </div>

              {/* Center: Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-3 min-w-[80px] text-center">
                    {page} {t.of} {totalPages} {t.page}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Right: Showing count */}
              <div className="text-sm text-muted-foreground min-w-[140px] text-right">
                {t.showing} {startIndex + 1} {t.to} {Math.min(endIndex, totalFiltered)} {t.ofTotal} {totalFiltered}
              </div>
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
            {selectedIndex < allFilteredVideos.length - 1 && (
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
                  {isEditedVideo(selectedVideo) && (
                    <Badge className="text-xs bg-purple-600/90 text-white">
                      <GitMerge className="h-3 w-3 mr-1" />
                      {t.edited}
                    </Badge>
                  )}
                  {isExtendedVideo(selectedVideo) && (
                    <Badge className="text-xs bg-blue-600/90 text-white">
                      <Expand className="h-3 w-3 mr-1" />
                      {t.extended}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* View Original button for edited videos */}
                  {isEditedVideo(selectedVideo) && selectedVideo.quality_metadata?.videoEdit?.originalGenerationId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      onClick={() => {
                        const originalId = selectedVideo.quality_metadata?.videoEdit?.originalGenerationId;
                        const originalVideo = allFilteredVideos.find(v => v.id === originalId);
                        if (originalVideo) {
                          const originalIndex = allFilteredVideos.indexOf(originalVideo);
                          setSelectedVideo(originalVideo);
                          setSelectedIndex(originalIndex);
                        } else {
                          // Navigate to the campaign curation page with the video
                          setPanelOpen(false);
                          router.push(`/campaigns/${selectedVideo.campaign_id}/curation?video=${originalId}`);
                        }
                      }}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      {t.viewOriginal}
                    </Button>
                  )}
                  {selectedVideo.generation_type === "AI" && !isEditedVideo(selectedVideo) && (
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                      onClick={() => {
                        setPanelOpen(false);
                        setExtendVideo(selectedVideo);
                      }}
                    >
                      <Expand className="h-4 w-4 mr-2" />
                      {t.extendVideo}
                    </Button>
                  )}
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
              </div>

              {/* Scrollable Content */}
              <div className="px-4 max-h-[20vh] overflow-y-auto">
                <p className="text-sm text-zinc-400 mb-2">{selectedVideo.artist_name}</p>
                {/* Audio Info */}
                {(() => {
                  // Get audio name from various sources
                  const rawAudioName =
                    selectedVideo.audio_asset?.original_filename ||
                    selectedVideo.quality_metadata?.videoEdit?.audioAssetName ||
                    selectedVideo.quality_metadata?.composition?.audioAssetName;

                  // Skip UUID-based filenames (e.g., "5f0865f5-9bfc-4817-8f70-f174518d4ac5.mp3")
                  const isUuidFilename = rawAudioName && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\./i.test(rawAudioName);
                  const audioName = isUuidFilename ? null : rawAudioName;

                  return audioName ? (
                    <p className="text-sm text-zinc-400 mb-2 flex items-center gap-1.5">
                      <Music className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="text-zinc-300">{audioName}</span>
                    </p>
                  ) : null;
                })()}
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">{selectedVideo.prompt}</p>
              </div>

              {/* Footer Row - Fixed */}
              <div className="flex items-center gap-4 px-4 py-3 text-xs text-zinc-500 border-t border-zinc-800/50">
                <span>{selectedVideo.duration_seconds}s</span>
                <span>{selectedVideo.aspect_ratio}</span>
                <span>{formatDate(selectedVideo.created_at)}</span>
                <span className="ml-auto">{selectedIndex + 1} / {allFilteredVideos.length}</span>
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

      {/* Video Edit Modal */}
      {editVideo && (
        <VideoEditModal
          open={!!editVideo}
          onOpenChange={(open) => !open && setEditVideo(null)}
          generationId={editVideo.id}
          campaignId={editVideo.campaign_id}
          videoUrl={getVideoUrl(editVideo) || ""}
          onEditStarted={(newGenerationId) => {
            setEditVideo(null);
            // Optionally navigate to the new generation or refresh the list
            refetchCompose();
            refetchAI();
          }}
        />
      )}

      {/* Video Extend Dialog */}
      <Dialog open={!!extendVideo} onOpenChange={(open) => !open && setExtendVideo(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden" showCloseButton={false}>
          <VisuallyHidden>
            <DialogTitle>{t.extendVideo}</DialogTitle>
            <DialogDescription>
              {language === "ko"
                ? "AI 영상을 7초 연장합니다"
                : "Extend AI video by 7 seconds"}
            </DialogDescription>
          </VisuallyHidden>
          {extendVideo && (
            <VideoExtendPanel
              generationId={extendVideo.id}
              videoUrl={getVideoUrl(extendVideo) || undefined}
              currentDuration={extendVideo.duration_seconds}
              aspectRatio={extendVideo.aspect_ratio}
              extensionCount={extendVideo.extension_count || 0}
              onClose={() => setExtendVideo(null)}
              onExtensionComplete={(newGeneration) => {
                // Refresh the video list to include the new extended video
                refetchAI();
                // Update local state so if user clicks "Extend Again", it uses the new video
                setExtendVideo((prev) => prev ? {
                  ...prev,
                  id: newGeneration.id,
                  duration_seconds: newGeneration.duration,
                  extension_count: newGeneration.extensionCount,
                } : null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Variation Popup Modal */}
      {showVariationView && variationVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseVariationView}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden rounded-xl bg-background border border-border shadow-2xl">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-20 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={handleCloseVariationView}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b">
              <div>
                <h1 className="text-xl font-semibold">
                  {language === "ko" ? "배리에이션 생성" : "Create Variations"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {variationVideo.campaign_name} • {variationVideo.generation_type === "AI" ? "AI Video" : "Fast Cut"}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[calc(90vh-73px)] overflow-auto p-6">
              {session?.state === "COMPARE_AND_APPROVE" ? (
                <CompareApproveView
                  onBack={() => {
                    goToVariationConfig();
                  }}
                  onPublish={() => {
                    handleCloseVariationView();
                    toast.success(
                      language === "ko"
                        ? "배리에이션이 완료되었습니다"
                        : "Variations completed"
                    );
                  }}
                />
              ) : variationVideo.generation_type === "AI" ? (
                <AIVariationConfigView
                  video={{
                    id: variationVideo.id,
                    prompt: variationVideo.prompt,
                    campaign_name: variationVideo.campaign_name,
                    artist_name: variationVideo.artist_name,
                    duration_seconds: variationVideo.duration_seconds,
                    aspect_ratio: variationVideo.aspect_ratio,
                    output_url: variationVideo.output_url,
                  }}
                  onBack={handleCloseVariationView}
                  onStartGeneration={handleStartVariationGeneration}
                  onCancel={handleCloseVariationView}
                />
              ) : (
                <VariationConfigView
                  onBack={handleCloseVariationView}
                  onStartGeneration={handleStartVariationGeneration}
                  onCancel={handleCloseVariationView}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
