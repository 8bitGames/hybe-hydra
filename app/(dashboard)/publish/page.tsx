"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkflowStore, ProcessingVideo, useWorkflowHydrated } from "@/lib/stores/workflow-store";
import {
  useProcessingSessionStore,
  useProcessingSessionHydrated,
  selectSession,
} from "@/lib/stores/processing-session-store";
import { useSessionStore } from "@/lib/stores/session-store";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { useSessionWorkflowSync } from "@/lib/stores/session-workflow-sync";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useCampaigns } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import {
  Send,
  ArrowLeft,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Play,
  Pause,
  X,
  Plus,
  Zap,
  Video,
  Sparkles,
  Loader2,
  Film,
  Link2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Users,
  MessageSquare,
  Share2,
  Settings,
} from "lucide-react";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";
import { VariationQuickPanel, PublishSuccessDialog } from "@/components/features/publish";
import { VariationModal, VariationConfig } from "@/components/features/variation-modal";
import type { VideoGeneration, StylePreset } from "@/lib/video-api";

// Social Account interface
interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
  profile_url: string | null;
  follower_count: number | null;
  is_active: boolean;
  label_id: string;
  token_expires_at: string | null;
  is_token_valid: boolean;
}

// TikTok platform settings
interface TikTokSettings {
  privacy_level: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  disable_duet: boolean;
  disable_stitch: boolean;
  disable_comment: boolean;
}

// Platform icons
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={cn("w-4 h-4", className)} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const TIME_SLOTS = [
  "custom", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00",
];

export default function PublishPage() {
  const { language } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isKorean = language === "ko";
  const videoRef = useRef<HTMLVideoElement>(null);

  // Wait for store hydration before rendering
  const isWorkflowHydrated = useWorkflowHydrated();
  const isSessionHydrated = useProcessingSessionHydrated();
  const isHydrated = isWorkflowHydrated && isSessionHydrated;

  // Processing session store (for fast-cut flow)
  const processingSession = useProcessingSessionStore(selectSession);
  const getApprovedVideosFromSession = useProcessingSessionStore((state) => state.getApprovedVideos);

  // Check if coming from fast-cut flow (sessionId in URL)
  const isFastCutFlow = useMemo(() => {
    const sessionIdParam = searchParams.get("sessionId");
    return !!sessionIdParam && !!processingSession;
  }, [searchParams, processingSession]);

  // Sync workflow stage
  useWorkflowSync("publish");
  const { goToProcessing } = useWorkflowNavigation();

  // Session sync for persisted state management
  const sessionIdFromUrl = searchParams.get("sessionId") || searchParams.get("session");
  const { activeSession, syncNow } = useSessionWorkflowSync("publish");
  const { completeSession, loadSession } = useSessionStore(
    useShallow((state) => ({
      completeSession: state.completeSession,
      loadSession: state.loadSession,
    }))
  );

  // Workflow store
  const discover = useWorkflowStore((state) => state.discover);
  const analyze = useWorkflowStore((state) => state.analyze);
  const processing = useWorkflowStore((state) => state.processing);
  const setSelectedProcessingVideos = useWorkflowStore((state) => state.setSelectedProcessingVideos);
  const publish = useWorkflowStore((state) => state.publish);
  const setPublishCaption = useWorkflowStore((state) => state.setPublishCaption);
  const setPublishHashtags = useWorkflowStore((state) => state.setPublishHashtags);

  // Get campaigns
  const { data: campaignsData } = useCampaigns({ page: 1, page_size: 100 });

  // Local state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("18:00");
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customTimeValue, setCustomTimeValue] = useState<string>("12:00");
  const [isPublishing, setIsPublishing] = useState(false);
  const [newHashtag, setNewHashtag] = useState("");
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isOptimizingGeoAeo, setIsOptimizingGeoAeo] = useState(false);

  // Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Social accounts state
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // TikTok specific settings
  const [tiktokSettings, setTiktokSettings] = useState<TikTokSettings>({
    privacy_level: "PUBLIC_TO_EVERYONE",
    disable_duet: false,
    disable_stitch: false,
    disable_comment: false,
  });

  // Variation modal state
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationType, setVariationType] = useState<"ai" | "compose">("ai");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [publishedVideos, setPublishedVideos] = useState<ProcessingVideo[]>([]);
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [isCreatingVariations, setIsCreatingVariations] = useState(false);

  // Load session from URL param if not already loaded (fixes fast-cut flow)
  useEffect(() => {
    const loadSessionFromUrl = async () => {
      if (!activeSession && sessionIdFromUrl) {
        try {
          console.log("[Publish] Loading session from URL:", sessionIdFromUrl);
          await loadSession(sessionIdFromUrl);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[Publish] Failed to load session from URL:", sessionIdFromUrl, errorMessage);
          // If session doesn't exist, redirect to start page
          if (errorMessage.includes("not found") || errorMessage.includes("PGRST116")) {
            console.log("[Publish] Session not found, redirecting to start");
            router.push("/start");
          }
        }
      }
    };
    loadSessionFromUrl();
  }, [activeSession, sessionIdFromUrl, loadSession, router]);

  // Clean up stale selections on mount
  // This handles the case where localStorage has stale IDs that don't match current videos
  useEffect(() => {
    if (!isHydrated) return;

    const validIds = new Set(processing.videos.map((v) => v.id));
    const staleIds = processing.selectedVideos.filter((id) => !validIds.has(id));

    if (staleIds.length > 0) {
      // Remove stale IDs from selection
      const cleanedSelection = processing.selectedVideos.filter((id) => validIds.has(id));
      setSelectedProcessingVideos(cleanedSelection);
    }
  }, [isHydrated, processing.videos, processing.selectedVideos, setSelectedProcessingVideos]);

  // Fetch connected social accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const response = await api.get<{ accounts: SocialAccount[]; total: number }>(
          "/api/v1/publishing/accounts"
        );
        if (response.data?.accounts) {
          setSocialAccounts(response.data.accounts);
          const validTikTokAccount = response.data.accounts.find(
            (a) => a.platform === "TIKTOK" && a.is_token_valid
          );
          if (validTikTokAccount) {
            setSelectedAccountId(validTikTokAccount.id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch social accounts:", error);
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  // Fetch style presets for variation modal
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const response = await api.get<{ presets: StylePreset[] }>("/api/v1/style-presets");
        if (response.data?.presets) {
          setStylePresets(response.data.presets);
        }
      } catch (error) {
        console.error("Failed to fetch style presets:", error);
      }
    };
    fetchPresets();
  }, []);

  // Get selected account
  const selectedAccount = useMemo(() => {
    return socialAccounts.find((a) => a.id === selectedAccountId) || null;
  }, [socialAccounts, selectedAccountId]);

  // Get videos for publishing based on current selection
  // Priority: Fast-cut flow (processing-session-store) > AI Video flow (workflow-store)
  const approvedVideos = useMemo((): ProcessingVideo[] => {
    // If coming from fast-cut flow, use processing-session-store
    if (isFastCutFlow && processingSession) {
      const sessionApproved = getApprovedVideosFromSession();
      // Convert to ProcessingVideo format
      // Note: Only original video has a real generationId, variations have temp client IDs
      return sessionApproved
        .filter((v) => {
          // Only include videos with valid generationIds (not temp variation IDs like "var-xxx")
          // Original video: uses the actual generationId from DB
          // Variations: have temp IDs starting with "var-" which won't work for publishing
          const isValidGenerationId = v.id && !v.id.startsWith("var-");
          if (!isValidGenerationId) {
            console.warn(`[Publish] Skipping video with temp ID: ${v.id}`);
          }
          return isValidGenerationId;
        })
        .map((v): ProcessingVideo => ({
          id: v.id,
          generationId: v.id,
          campaignId: processingSession.campaignId,
          campaignName: processingSession.campaignName,
          prompt: v.styleName,
          status: "approved",
          progress: 100,
          outputUrl: v.outputUrl,
          thumbnailUrl: v.thumbnailUrl || null,
          duration: 15, // Default duration
          aspectRatio: "9:16",
          qualityScore: null,
          generationType: "COMPOSE",
          createdAt: processingSession.createdAt,
          completedAt: new Date().toISOString(),
          metadata: {},
        }));
    }

    // AI Video flow: use workflow-store
    // If there are selected videos, use them as source of truth
    if (processing.selectedVideos.length > 0) {
      return processing.videos.filter(
        (v) => processing.selectedVideos.includes(v.id) &&
               (v.status === "completed" || v.status === "approved")
      );
    }
    // Fallback: show all approved videos if no selection
    return processing.videos.filter((v) => v.status === "approved");
  }, [isFastCutFlow, processingSession, getApprovedVideosFromSession, processing.videos, processing.selectedVideos]);

  // Current video
  const currentVideo = approvedVideos[currentVideoIndex] || null;

  // Video navigation
  const goToPrevVideo = useCallback(() => {
    setCurrentVideoIndex((prev) => (prev > 0 ? prev - 1 : approvedVideos.length - 1));
    setIsPlaying(false);
  }, [approvedVideos.length]);

  const goToNextVideo = useCallback(() => {
    setCurrentVideoIndex((prev) => (prev < approvedVideos.length - 1 ? prev + 1 : 0));
    setIsPlaying(false);
  }, [approvedVideos.length]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Add hashtag
  const handleAddHashtag = useCallback(() => {
    const tag = newHashtag.trim().toLowerCase().replace(/^#/, "");
    if (tag && !publish.hashtags.includes(tag)) {
      setPublishHashtags([...publish.hashtags, tag]);
      setNewHashtag("");
    }
  }, [newHashtag, publish.hashtags, setPublishHashtags]);

  // Remove hashtag
  const handleRemoveHashtag = useCallback(
    (tag: string) => {
      setPublishHashtags(publish.hashtags.filter((h) => h !== tag));
    },
    [publish.hashtags, setPublishHashtags]
  );

  // Generate AI suggestions
  const handleGenerateAISuggestions = async () => {
    if (!currentVideo) return;
    setIsGeneratingAI(true);
    try {
      const context = {
        trendKeywords: discover.keywords,
        hashtags: discover.selectedHashtags,
        campaignName: analyze.campaignName,
        userIdea: analyze.userIdea,
        selectedIdea: analyze.selectedIdea
          ? { title: analyze.selectedIdea.title, hook: analyze.selectedIdea.hook }
          : undefined,
        prompt: currentVideo.prompt,
        generationType: currentVideo.generationType,
      };

      const response = await api.post<{
        success: boolean;
        caption: string;
        hashtags: string[];
      }>("/api/v1/ai/suggest-publish-content", {
        context,
        platform: "tiktok",
        language,
      });

      if (response.data?.success) {
        setPublishCaption(response.data.caption);
        setPublishHashtags(response.data.hashtags);
        toast.success(
          isKorean ? "AI 추천 완료" : "AI Suggestions Ready",
          isKorean ? "캡션과 해시태그가 생성되었습니다" : "Caption and hashtags generated"
        );
      }
    } catch (error) {
      console.error("AI suggestion error:", error);
      toast.error(isKorean ? "오류 발생" : "Error", isKorean ? "AI 추천 생성에 실패했습니다" : "Failed to generate");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // GEO/AEO optimization
  const handleGeoAeoOptimization = async () => {
    if (!currentVideo) return;
    setIsOptimizingGeoAeo(true);
    try {
      const basePrompt = publish.caption.trim() || currentVideo.prompt;
      const allKeywords = [
        ...(discover.keywords || []),
        ...(analyze.hashtags || []),
        ...(publish.hashtags || []),
      ].filter((k, i, arr) => arr.indexOf(k) === i);

      const response = await api.post<{
        caption: string;
        hashtags: string[];
        score: number;
      }>("/api/v1/publishing/geo-aeo", {
        keywords: allKeywords.length > 0 ? allKeywords : [analyze.campaignName || "content"].filter(Boolean),
        search_tags: discover.selectedHashtags || publish.hashtags || [],
        prompt: basePrompt,
        artist_name: analyze.campaignName,
        language,
        platform: "tiktok",
        trend_keywords: discover.keywords || [],
      });

      if (response.data?.caption) {
        setPublishCaption(response.data.caption);
        if (response.data.hashtags) {
          const cleanHashtags = response.data.hashtags.map((h) => h.replace(/^#/, ""));
          setPublishHashtags(cleanHashtags);
        }
        toast.success(
          isKorean ? "GEO/AEO 최적화 완료" : "GEO/AEO Optimized",
          isKorean ? `점수: ${response.data.score}/100` : `Score: ${response.data.score}/100`
        );
      }
    } catch (error) {
      console.error("GEO/AEO error:", error);
      toast.error(isKorean ? "오류 발생" : "Error", isKorean ? "최적화 실패" : "Optimization failed");
    } finally {
      setIsOptimizingGeoAeo(false);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (approvedVideos.length === 0) {
      toast.warning(isKorean ? "영상 필요" : "Video needed", isKorean ? "발행할 영상이 없습니다" : "No videos to publish");
      return;
    }

    if (!selectedAccountId) {
      toast.warning(isKorean ? "계정 필요" : "Account needed", isKorean ? "발행할 계정을 선택하세요" : "Select an account");
      return;
    }

    setIsPublishing(true);

    try {
      let scheduledAt: string | null = null;
      if (selectedDate) {
        const timeToUse = isCustomTime ? customTimeValue : selectedTime;
        const [hours, minutes] = timeToUse.split(":");
        const scheduledDate = new Date(selectedDate);
        scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        scheduledAt = scheduledDate.toISOString();
      }

      const platformSettings = selectedAccount?.platform === "TIKTOK" ? {
        privacy_level: tiktokSettings.privacy_level,
        disable_duet: tiktokSettings.disable_duet,
        disable_stitch: tiktokSettings.disable_stitch,
        disable_comment: tiktokSettings.disable_comment,
      } : {};

      const results = await Promise.all(
        approvedVideos.map(async (video) => {
          const response = await api.post<{ id: string; status: string }>("/api/v1/publishing/schedule", {
            campaign_id: video.campaignId,
            generation_id: video.generationId,
            social_account_id: selectedAccountId,
            caption: `${publish.caption}\n\n${publish.hashtags.map((h) => `#${h}`).join(" ")}`,
            hashtags: publish.hashtags,
            scheduled_at: scheduledAt,
            timezone: "Asia/Seoul",
            platform_settings: platformSettings,
            thumbnail_url: video.thumbnailUrl,
          });
          return response.data;
        })
      );

      const successCount = results.filter((r) => r?.id).length;

      if (successCount > 0) {
        toast.success(
          isKorean ? "발행 예약 완료" : "Scheduled",
          isKorean ? `${successCount}개의 발행이 예약되었습니다` : `${successCount} posts scheduled`
        );

        // Mark session as completed
        try {
          // Get current activeSession from store (avoids stale closure)
          let currentActiveSession = useSessionStore.getState().activeSession;
          // Ensure session is loaded before completing (handles fast-cut flow)
          if (!currentActiveSession && sessionIdFromUrl) {
            console.log("[Publish] Loading session before completing:", sessionIdFromUrl);
            await loadSession(sessionIdFromUrl);
            // Re-check activeSession after loading
            currentActiveSession = useSessionStore.getState().activeSession;
          }

          if (currentActiveSession) {
            await completeSession();
            console.log("[Publish] Session marked as completed:", currentActiveSession.id);
            // Refresh session list to reflect the change
            await useSessionStore.getState().fetchSessions();
          } else {
            console.warn("[Publish] No active session to complete. sessionIdFromUrl:", sessionIdFromUrl);
          }
        } catch (err) {
          console.error("[Publish] Failed to mark session as completed:", err);
        }

        // Show success dialog instead of immediately redirecting
        setPublishedVideos(approvedVideos);
        setShowSuccessDialog(true);
      } else {
        throw new Error("Failed to schedule");
      }
    } catch (error) {
      console.error("Publish error:", error);
      toast.error(isKorean ? "오류 발생" : "Error", isKorean ? "발행 예약에 실패했습니다" : "Failed to schedule");
    } finally {
      setIsPublishing(false);
    }
  };

  // Variation handlers
  const handleOpenVariationModal = useCallback((type: "ai" | "compose") => {
    setVariationType(type);
    setVariationModalOpen(true);
  }, []);

  const handleCreateVariations = async (config: VariationConfig) => {
    if (!currentVideo?.generationId) {
      toast.error(isKorean ? "오류" : "Error", isKorean ? "영상 정보가 없습니다" : "No video information");
      return;
    }

    setIsCreatingVariations(true);
    try {
      const response = await api.post<{ batch_id: string; total_count: number }>(
        `/api/v1/generations/${currentVideo.generationId}/variations`,
        {
          style_categories: config.styleCategories,
          enable_prompt_variation: config.enablePromptVariation,
          prompt_variation_types: config.promptVariationTypes,
          max_variations: config.maxVariations,
          auto_publish: config.autoPublish ? {
            enabled: true,
            social_account_id: config.autoPublish.socialAccountId,
            interval_minutes: config.autoPublish.intervalMinutes,
            caption: config.autoPublish.caption,
            hashtags: config.autoPublish.hashtags,
          } : undefined,
        }
      );

      if (response.data?.batch_id) {
        toast.success(
          isKorean ? "변형 생성 시작" : "Variations Started",
          isKorean ? `${response.data.total_count}개 변형 생성 중` : `Creating ${response.data.total_count} variations`
        );
        setVariationModalOpen(false);
        // Navigate to processing page with batch ID
        router.push(`/processing?variation_batch=${response.data.batch_id}`);
      }
    } catch (error) {
      console.error("Create variations error:", error);
      toast.error(isKorean ? "오류" : "Error", isKorean ? "변형 생성에 실패했습니다" : "Failed to create variations");
    } finally {
      setIsCreatingVariations(false);
    }
  };

  // Success dialog handlers
  const handleViewSchedule = useCallback(() => {
    setShowSuccessDialog(false);
    // CRITICAL: Use clearActiveSession to fully clear all storage
    // The session has already been completed in handlePublish, so no need to keep localStorage
    // This prevents stale data from appearing when user later starts a new project
    useSessionStore.getState().clearActiveSession();
    router.push("/publishing");
  }, [router]);

  const handleStartNew = useCallback(() => {
    setShowSuccessDialog(false);
    // CRITICAL: Use clearActiveSession to fully clear all storage
    // This ensures no stale data persists when starting a new project
    // The ?new=true parameter tells /start page to skip hydration wait
    useSessionStore.getState().clearActiveSession();
    router.push("/start?new=true");
  }, [router]);

  // Handle success dialog close (when user closes dialog without selecting an option)
  const handleSuccessDialogClose = useCallback(() => {
    setShowSuccessDialog(false);
    // CRITICAL: Use clearActiveSession to fully clear all storage
    useSessionStore.getState().clearActiveSession();
    router.push("/start?new=true");
  }, [router]);

  // Convert currentVideo to VideoGeneration format for VariationModal
  const seedGeneration: VideoGeneration | null = currentVideo ? {
    id: currentVideo.generationId || currentVideo.id,
    campaign_id: "",
    prompt: currentVideo.prompt || "",
    negative_prompt: null,
    status: (currentVideo.status as VideoGeneration["status"]) || "completed",
    progress: 100,
    error_message: null,
    output_url: currentVideo.outputUrl,
    output_asset_id: null,
    duration_seconds: currentVideo.duration || 5,
    aspect_ratio: "9:16",
    reference_image_id: null,
    reference_style: null,
    audio_asset_id: "",
    quality_score: null,
    original_input: null,
    trend_keywords: [],
    reference_urls: null,
    prompt_analysis: null,
    is_favorite: false,
    tags: [],
    created_by: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    generation_type: "AI",
  } : null;

  const isScheduled = selectedDate !== undefined;

  // Loading state while waiting for hydration
  if (!isHydrated) {
    return (
      <div className="h-full flex flex-col bg-white">
        <WorkflowHeader
          onBack={goToProcessing}
          actionButton={{
            label: isKorean ? "발행하기" : "Publish",
            onClick: handlePublish,
            disabled: true,
            icon: <Send className="h-4 w-4" />,
          }}
        />
        <div className="flex items-center justify-center flex-1">
          <Spinner className="w-8 h-8" />
        </div>
      </div>
    );
  }

  // Empty state
  if (approvedVideos.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white">
        <WorkflowHeader
          onBack={goToProcessing}
          actionButton={{
            label: isKorean ? "발행하기" : "Publish",
            onClick: handlePublish,
            disabled: true,
            icon: <Send className="h-4 w-4" />,
          }}
        />
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mb-6">
            <Film className="w-10 h-10 text-neutral-400" />
          </div>
          <h2 className="text-xl font-semibold text-black mb-2">
            {isKorean ? "승인된 영상이 없습니다" : "No Approved Videos"}
          </h2>
          <p className="text-neutral-500 text-center max-w-md mb-6">
            {isKorean ? "발행하려면 먼저 처리 단계에서 영상을 승인하세요" : "Approve videos in Processing first"}
          </p>
          <Button onClick={goToProcessing} className="bg-black text-white hover:bg-neutral-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isKorean ? "처리로 돌아가기" : "Back to Processing"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      {/* Header */}
      <WorkflowHeader
        onBack={goToProcessing}
        subtitle={isKorean
          ? `${approvedVideos.length}개 영상${selectedAccount ? ` · @${selectedAccount.account_name}` : ""}`
          : `${approvedVideos.length} videos${selectedAccount ? ` · @${selectedAccount.account_name}` : ""}`}
      />

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden px-[7%] py-6 gap-6">
        {/* Left: Video Preview */}
        <div className="w-[320px] shrink-0 flex flex-col">
          <div className="bg-black rounded-2xl overflow-hidden relative" style={{ aspectRatio: "9/16" }}>
            {currentVideo?.outputUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={currentVideo.outputUrl}
                  className="w-full h-full object-cover"
                  loop
                  muted={isMuted}
                  playsInline
                  onClick={togglePlay}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {/* Play/Pause overlay */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer" onClick={togglePlay}>
                    <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>
                )}
                {/* Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="flex items-center justify-between">
                    <button onClick={toggleMute} className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                      {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                    </button>
                    <div className="flex items-center gap-1 text-white text-xs">
                      <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px]">
                        {currentVideo.duration}s
                      </Badge>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-12 h-12 text-neutral-600" />
              </div>
            )}
          </div>

          {/* Video navigation */}
          {approvedVideos.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={goToPrevVideo} className="p-2 rounded-full hover:bg-neutral-200 transition-colors">
                <ChevronLeft className="w-5 h-5 text-neutral-600" />
              </button>
              <span className="text-sm text-neutral-600 font-medium">
                {currentVideoIndex + 1} / {approvedVideos.length}
              </span>
              <button onClick={goToNextVideo} className="p-2 rounded-full hover:bg-neutral-200 transition-colors">
                <ChevronRight className="w-5 h-5 text-neutral-600" />
              </button>
            </div>
          )}

          {/* Video thumbnails */}
          {approvedVideos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {approvedVideos.map((video, index) => (
                <button
                  key={video.id}
                  onClick={() => { setCurrentVideoIndex(index); setIsPlaying(false); }}
                  className={cn(
                    "w-14 h-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all",
                    index === currentVideoIndex ? "border-black" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : video.outputUrl ? (
                    <video
                      src={video.outputUrl}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
                      <Video className="w-4 h-4 text-neutral-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Variation Quick Panel */}
          {currentVideo && (
            <VariationQuickPanel
              video={currentVideo}
              onCreateAIVariation={() => handleOpenVariationModal("ai")}
              onCreateComposeVariation={() => handleOpenVariationModal("compose")}
            />
          )}
        </div>

        {/* Center: Caption & Hashtags */}
        <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="p-6 flex-1 overflow-auto space-y-6">
            {/* Caption */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium text-neutral-900">
                  {isKorean ? "캡션" : "Caption"}
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateAISuggestions}
                    disabled={isGeneratingAI}
                    className="h-8 text-xs"
                  >
                    {isGeneratingAI ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                    {isKorean ? "AI 추천" : "AI"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGeoAeoOptimization}
                    disabled={isOptimizingGeoAeo}
                    className="h-8 text-xs"
                  >
                    {isOptimizingGeoAeo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                    GEO/AEO
                  </Button>
                </div>
              </div>
              <textarea
                value={publish.caption}
                onChange={(e) => setPublishCaption(e.target.value)}
                placeholder={isKorean ? "캡션을 입력하거나 AI 추천을 사용하세요..." : "Write a caption or use AI..."}
                rows={6}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
              />
              <p className="text-[11px] text-neutral-400 mt-2 text-right">{publish.caption.length}/2200</p>
            </div>

            {/* Hashtags */}
            <div>
              <Label className="text-sm font-medium text-neutral-900 mb-3 block">
                {isKorean ? "해시태그" : "Hashtags"}
              </Label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddHashtag()}
                  placeholder={isKorean ? "해시태그 추가..." : "Add hashtag..."}
                  className="flex-1 h-10 bg-neutral-50 border-neutral-200"
                />
                <Button variant="outline" onClick={handleAddHashtag} className="h-10 px-4 border-neutral-200">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {publish.hashtags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-neutral-100 text-neutral-700 pl-2.5 pr-1.5 py-1 text-sm">
                    #{tag}
                    <button onClick={() => handleRemoveHashtag(tag)} className="ml-1.5 hover:text-black">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Account & Schedule */}
        <div className="w-[300px] shrink-0 flex flex-col gap-4">
          {/* Account Selection */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-sm font-medium text-neutral-900">
                {isKorean ? "발행 계정" : "Account"}
              </Label>
              <Button variant="ghost" size="sm" onClick={() => router.push("/settings/accounts")} className="h-7 text-xs">
                <Link2 className="h-3 w-3 mr-1" />
                {isKorean ? "관리" : "Manage"}
              </Button>
            </div>

            {loadingAccounts ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-5 w-5" />
              </div>
            ) : socialAccounts.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500 mb-3">{isKorean ? "연결된 계정 없음" : "No accounts"}</p>
                <Button variant="outline" size="sm" onClick={() => router.push("/settings/accounts")}>
                  <Plus className="h-4 w-4 mr-1" />
                  {isKorean ? "계정 연결" : "Connect"}
                </Button>
              </div>
            ) : (
              <Select value={selectedAccountId || ""} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-12 bg-neutral-50 border-neutral-200">
                  <SelectValue placeholder={isKorean ? "계정 선택" : "Select account"} />
                </SelectTrigger>
                <SelectContent>
                  {socialAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
                          <TikTokIcon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-medium">{account.account_name}</span>
                        {!account.is_token_valid && (
                          <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">!</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* TikTok Settings */}
            {selectedAccount?.platform === "TIKTOK" && (
              <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-500">{isKorean ? "TikTok 설정" : "TikTok Settings"}</span>
                </div>
                <Select
                  value={tiktokSettings.privacy_level}
                  onValueChange={(value: TikTokSettings["privacy_level"]) =>
                    setTiktokSettings((prev) => ({ ...prev, privacy_level: value }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm bg-neutral-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC_TO_EVERYONE">
                      <div className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" />{isKorean ? "전체 공개" : "Public"}</div>
                    </SelectItem>
                    <SelectItem value="FOLLOWER_OF_CREATOR">
                      <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{isKorean ? "팔로워만" : "Followers"}</div>
                    </SelectItem>
                    <SelectItem value="SELF_ONLY">
                      <div className="flex items-center gap-2"><EyeOff className="h-3.5 w-3.5" />{isKorean ? "나만 보기" : "Private"}</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-600">{isKorean ? "듀엣 허용" : "Duet"}</span>
                    <Switch
                      checked={!tiktokSettings.disable_duet}
                      onCheckedChange={(checked) => setTiktokSettings((prev) => ({ ...prev, disable_duet: !checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-600">{isKorean ? "이어붙이기" : "Stitch"}</span>
                    <Switch
                      checked={!tiktokSettings.disable_stitch}
                      onCheckedChange={(checked) => setTiktokSettings((prev) => ({ ...prev, disable_stitch: !checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-600">{isKorean ? "댓글 허용" : "Comments"}</span>
                    <Switch
                      checked={!tiktokSettings.disable_comment}
                      onCheckedChange={(checked) => setTiktokSettings((prev) => ({ ...prev, disable_comment: !checked }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 flex-1">
            <Label className="text-sm font-medium text-neutral-900 mb-4 block">
              {isKorean ? "발행 시간" : "Schedule"}
            </Label>

            <div className="flex gap-2 mb-4">
              <Button
                variant={!isScheduled ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(undefined)}
                className={cn(
                  "flex-1 h-10",
                  !isScheduled ? "bg-black text-white hover:bg-neutral-800" : "border-neutral-200"
                )}
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                {isKorean ? "즉시" : "Now"}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={isScheduled ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex-1 h-10",
                      isScheduled ? "bg-black text-white hover:bg-neutral-800" : "border-neutral-200"
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {isScheduled ? format(selectedDate!, "M/d") : isKorean ? "예약" : "Schedule"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < startOfDay(new Date())}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {isScheduled && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">{isKorean ? "시간" : "Time"}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIME_SLOTS.slice(0, 9).map((time) => (
                    <button
                      key={time}
                      onClick={() => {
                        if (time === "custom") {
                          setIsCustomTime(true);
                          setSelectedTime("");
                        } else {
                          setIsCustomTime(false);
                          setSelectedTime(time);
                        }
                      }}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-xs font-medium transition-all",
                        time === "custom"
                          ? isCustomTime
                            ? "bg-black text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                          : selectedTime === time && !isCustomTime
                          ? "bg-black text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      )}
                    >
                      {time === "custom" ? (isKorean ? "직접" : "Custom") : time}
                    </button>
                  ))}
                </div>
                {isCustomTime && (
                  <div className="mt-3">
                    <Input
                      type="time"
                      value={customTimeValue}
                      onChange={(e) => setCustomTimeValue(e.target.value)}
                      className="h-10 bg-neutral-50 border-neutral-200 text-center"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="mt-auto pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{isKorean ? "총 발행" : "Total"}</span>
                <span className="font-semibold text-black">{approvedVideos.length} {isKorean ? "개" : "posts"}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-neutral-500">{isKorean ? "발행 시간" : "When"}</span>
                <span className="font-medium text-black flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {isScheduled
                    ? `${format(selectedDate!, "M/d")} ${isCustomTime ? customTimeValue : selectedTime}`
                    : isKorean ? "즉시" : "Now"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Footer */}
      <div className="border-t border-neutral-200 bg-white shrink-0">
        <div className="flex items-center justify-between px-[7%] py-4">
          {/* Left: Back Button */}
          <Button
            variant="outline"
            onClick={goToProcessing}
            className="h-10 px-4 border-neutral-300 text-neutral-700 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isKorean ? "프로세싱" : "Processing"}
          </Button>

          {/* Center: Summary */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-neutral-500" />
              <span className="text-neutral-600">
                {approvedVideos.length} {isKorean ? "개 영상" : "videos"}
              </span>
            </div>
            {selectedAccount && (
              <>
                <div className="h-4 w-px bg-neutral-200" />
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                    <TikTokIcon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-neutral-600">@{selectedAccount.account_name}</span>
                </div>
              </>
            )}
          </div>

          {/* Right: Publish Button */}
          <Button
            onClick={handlePublish}
            disabled={!selectedAccountId || isPublishing}
            className="h-10 px-6 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {isPublishing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isPublishing ? (isKorean ? "예약 중..." : "Scheduling...") : (isKorean ? "발행하기" : "Publish")}
          </Button>
        </div>
      </div>

      {/* Variation Modal */}
      <VariationModal
        isOpen={variationModalOpen}
        onClose={() => setVariationModalOpen(false)}
        seedGeneration={seedGeneration}
        presets={stylePresets}
        onCreateVariations={handleCreateVariations}
        isCreating={isCreatingVariations}
        socialAccounts={socialAccounts as unknown as import("@/lib/publishing-api").SocialAccount[]}
      />

      {/* Publish Success Dialog */}
      <PublishSuccessDialog
        isOpen={showSuccessDialog}
        onClose={handleSuccessDialogClose}
        publishedCount={publishedVideos.length}
        videos={publishedVideos}
        publishContext={{
          accountId: selectedAccountId || "",
          accountName: selectedAccount?.account_name || "",
          caption: publish.caption,
          hashtags: publish.hashtags,
        }}
        onViewSchedule={handleViewSchedule}
        onStartNew={handleStartNew}
      />
    </div>
  );
}
