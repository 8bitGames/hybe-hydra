"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWorkflowStore, ProcessingVideo } from "@/lib/stores/workflow-store";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Send,
  ArrowLeft,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Play,
  X,
  Plus,
  CheckCircle,
  Zap,
  Video,
  Sparkles,
  Loader2,
  Film,
} from "lucide-react";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";

// Platform icons
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 0 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const PLATFORMS = [
  { id: "tiktok", name: "TikTok", icon: TikTokIcon, color: "bg-black" },
  { id: "instagram", name: "Instagram", icon: InstagramIcon, color: "bg-gradient-to-tr from-purple-600 to-pink-500" },
  { id: "youtube", name: "YouTube", icon: YouTubeIcon, color: "bg-red-600" },
];

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00",
];

// Campaign with approved videos interface
interface CampaignWithVideos {
  id: string;
  name: string;
  artistName: string;
  videos: ProcessingVideo[];
}

// Video Card Component
function ApprovedVideoCard({
  video,
  isSelected,
  onToggle,
}: {
  video: ProcessingVideo;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const thumbnailUrl = video.thumbnailUrl || (video.outputUrl ? `${video.outputUrl}#t=0.5` : null);

  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative aspect-[9/16] rounded-xl overflow-hidden bg-neutral-100 transition-all group",
        isSelected ? "ring-2 ring-black scale-[1.02]" : "opacity-70 hover:opacity-100"
      )}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : video.outputUrl ? (
        <video
          src={video.outputUrl}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-200">
          <Video className="w-8 h-8 text-neutral-400" />
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black flex items-center justify-center">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Video info */}
      <div className="absolute bottom-2 left-2 right-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="bg-white/20 text-white text-[10px] backdrop-blur-sm border-0">
            {video.duration}s
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white text-[10px] backdrop-blur-sm border-0">
            {video.generationType}
          </Badge>
        </div>
      </div>

      {/* Hover play indicator */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
          <Play className="w-5 h-5 text-white ml-0.5" />
        </div>
      </div>
    </button>
  );
}

export default function PublishPage() {
  const { language } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const isKorean = language === "ko";

  // Sync workflow stage
  useWorkflowSync("publish");
  const { goToProcessing, resetWorkflow } = useWorkflowNavigation();

  // Workflow store - get context from all stages
  const discover = useWorkflowStore((state) => state.discover);
  const analyze = useWorkflowStore((state) => state.analyze);
  const processing = useWorkflowStore((state) => state.processing);
  const publish = useWorkflowStore((state) => state.publish);
  const setPublishPlatforms = useWorkflowStore((state) => state.setPublishPlatforms);
  const setPublishCaption = useWorkflowStore((state) => state.setPublishCaption);
  const setPublishHashtags = useWorkflowStore((state) => state.setPublishHashtags);

  // Get campaigns
  const { data: campaignsData } = useCampaigns({ page: 1, pageSize: 100 });

  // Local state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("18:00");
  const [isPublishing, setIsPublishing] = useState(false);
  const [newHashtag, setNewHashtag] = useState("");
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // Get approved videos from processing stage
  // This includes both "approved" status videos and videos that were selected in processing stage
  const approvedVideos = useMemo(() => {
    // First, get videos with "approved" status
    const approved = processing.videos.filter((v) => v.status === "approved");

    // If no approved videos but we have selected videos from processing, use those
    // (in case user navigated directly without approving)
    if (approved.length === 0 && processing.selectedVideos.length > 0) {
      return processing.videos.filter(
        (v) => processing.selectedVideos.includes(v.id) &&
               (v.status === "completed" || v.status === "approved")
      );
    }

    return approved;
  }, [processing.videos, processing.selectedVideos]);

  // Initialize selected videos from approved videos
  useEffect(() => {
    if (approvedVideos.length > 0 && selectedVideoIds.length === 0) {
      // Select all approved videos by default
      setSelectedVideoIds(approvedVideos.map((v) => v.id));
    }
  }, [approvedVideos, selectedVideoIds.length]);

  // Group approved videos by campaign
  const campaignsWithVideos = useMemo(() => {
    const campaignMap = new Map<string, CampaignWithVideos>();

    approvedVideos.forEach((video) => {
      const existing = campaignMap.get(video.campaignId);
      if (existing) {
        existing.videos.push(video);
      } else {
        const campaign = campaignsData?.items.find((c) => c.id === video.campaignId);
        campaignMap.set(video.campaignId, {
          id: video.campaignId,
          name: video.campaignName || campaign?.name || "Unknown Campaign",
          artistName: campaign?.artist_stage_name || campaign?.artist_name || "",
          videos: [video],
        });
      }
    });

    return Array.from(campaignMap.values());
  }, [approvedVideos, campaignsData]);

  // Set first campaign as active if none selected
  useEffect(() => {
    if (!activeCampaignId && campaignsWithVideos.length > 0) {
      setActiveCampaignId(campaignsWithVideos[0].id);
    }
  }, [activeCampaignId, campaignsWithVideos]);

  // Get selected videos objects
  const selectedVideos = useMemo(() => {
    return approvedVideos.filter((v) => selectedVideoIds.includes(v.id));
  }, [approvedVideos, selectedVideoIds]);

  // Toggle video selection
  const toggleVideoSelection = useCallback((videoId: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId]
    );
  }, []);

  // Toggle platform
  const togglePlatform = useCallback(
    (platformId: string) => {
      const current = publish.selectedPlatforms;
      if (current.includes(platformId)) {
        setPublishPlatforms(current.filter((p) => p !== platformId));
      } else {
        setPublishPlatforms([...current, platformId]);
      }
    },
    [publish.selectedPlatforms, setPublishPlatforms]
  );

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

  // Generate AI suggestions for caption and hashtags
  const handleGenerateAISuggestions = async () => {
    if (selectedVideos.length === 0) {
      toast.warning(
        isKorean ? "영상 필요" : "Video needed",
        isKorean ? "AI 추천을 위해 영상을 선택하세요" : "Select a video for AI suggestions"
      );
      return;
    }

    setIsGeneratingAI(true);

    try {
      const selectedVideo = selectedVideos[0];
      const platform = publish.selectedPlatforms[0] || "tiktok";

      const context = {
        // From Discover stage
        trendKeywords: discover.keywords,
        hashtags: discover.selectedHashtags,
        performanceMetrics: discover.performanceMetrics,

        // From Analyze stage
        campaignName: analyze.campaignName,
        userIdea: analyze.userIdea,
        targetAudience: analyze.targetAudience,
        contentGoals: analyze.contentGoals,
        selectedIdea: analyze.selectedIdea
          ? {
              title: analyze.selectedIdea.title,
              hook: analyze.selectedIdea.hook,
              description: analyze.selectedIdea.description,
            }
          : undefined,

        // From Create/Processing stage
        prompt: selectedVideo.prompt,
        generationType: selectedVideo.generationType,
        duration: selectedVideo.duration,
        aspectRatio: selectedVideo.aspectRatio,
      };

      const response = await api.post<{
        success: boolean;
        caption: string;
        hashtags: string[];
        reasoning?: string;
      }>("/api/v1/ai/suggest-publish-content", {
        context,
        platform,
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
      toast.error(
        isKorean ? "오류 발생" : "Error",
        isKorean ? "AI 추천 생성에 실패했습니다" : "Failed to generate AI suggestions"
      );
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (selectedVideos.length === 0) {
      toast.warning(
        isKorean ? "영상 필요" : "Video needed",
        isKorean ? "발행할 영상이 없습니다" : "No videos to publish"
      );
      return;
    }

    if (publish.selectedPlatforms.length === 0) {
      toast.warning(
        isKorean ? "플랫폼 필요" : "Platform needed",
        isKorean ? "발행할 플랫폼을 선택하세요" : "Select at least one platform"
      );
      return;
    }

    setIsPublishing(true);

    try {
      // Prepare scheduled time
      let scheduledAt: string | null = null;
      if (selectedDate) {
        const [hours, minutes] = selectedTime.split(":");
        const scheduledDate = new Date(selectedDate);
        scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        scheduledAt = scheduledDate.toISOString();
      }

      // Create schedule requests for each video and platform
      const requests = selectedVideos.flatMap((video) =>
        publish.selectedPlatforms.map((platform) => ({
          video_id: video.generationId,
          video_url: video.outputUrl,
          platform,
          caption: `${publish.caption}\n\n${publish.hashtags.map((h) => `#${h}`).join(" ")}`,
          scheduled_at: scheduledAt,
        }))
      );

      const response = await api.post<{ success: boolean }>("/api/v1/publishing/schedule/batch", {
        posts: requests,
      });

      if (response.data?.success) {
        toast.success(
          isKorean ? "발행 예약 완료" : "Scheduled",
          isKorean
            ? `${requests.length}개의 발행이 예약되었습니다`
            : `${requests.length} posts scheduled`
        );

        // Reset workflow and go to publishing dashboard
        resetWorkflow();
        router.push("/publishing");
      } else {
        throw new Error("Failed to schedule");
      }
    } catch (error) {
      console.error("Publish error:", error);
      toast.error(
        isKorean ? "오류 발생" : "Error",
        isKorean ? "발행 예약에 실패했습니다" : "Failed to schedule posts"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const isScheduled = selectedDate !== undefined;

  // Empty state - no approved videos
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
        <div className="flex flex-col items-center justify-center flex-1 px-6">
          <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mb-6">
            <Film className="w-10 h-10 text-neutral-400" />
          </div>
          <h2 className="text-xl font-semibold text-black mb-2">
            {isKorean ? "승인된 영상이 없습니다" : "No Approved Videos"}
          </h2>
          <p className="text-neutral-500 text-center max-w-md mb-6">
            {isKorean
              ? "발행하려면 먼저 처리 단계에서 영상을 승인하세요"
              : "Approve videos in the Processing stage before publishing"}
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
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <WorkflowHeader
        onBack={goToProcessing}
        actionButton={{
          label: isPublishing
            ? (isKorean ? "예약 중..." : "Scheduling...")
            : (isKorean ? "발행하기" : "Publish"),
          onClick: handlePublish,
          disabled: selectedVideos.length === 0 || publish.selectedPlatforms.length === 0 || isPublishing,
          loading: isPublishing,
          icon: <Send className="h-4 w-4" />,
        }}
        subtitle={isKorean
          ? `${approvedVideos.length}개의 승인된 영상`
          : `${approvedVideos.length} approved videos`}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Video Selection by Campaign */}
        <div className="w-[45%] border-r border-neutral-200 flex flex-col">
          <div className="p-4 border-b border-neutral-100">
            <Label className="text-xs font-medium text-neutral-700 mb-2 block">
              {isKorean ? "캠페인별 승인된 영상" : "Approved Videos by Campaign"}
            </Label>
            <p className="text-xs text-neutral-500">
              {isKorean
                ? `${selectedVideoIds.length}개 선택됨`
                : `${selectedVideoIds.length} selected`}
            </p>
          </div>

          {campaignsWithVideos.length > 1 && (
            <div className="px-4 py-2 border-b border-neutral-100 bg-neutral-50/50">
              <Tabs value={activeCampaignId || ""} onValueChange={setActiveCampaignId}>
                <TabsList className="bg-neutral-100 h-8">
                  {campaignsWithVideos.map((campaign) => (
                    <TabsTrigger
                      key={campaign.id}
                      value={campaign.id}
                      className="text-xs px-3 h-6 data-[state=active]:bg-white"
                    >
                      {campaign.name}
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                        {campaign.videos.length}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            {campaignsWithVideos.map((campaign) => (
              <div
                key={campaign.id}
                className={cn(
                  campaignsWithVideos.length > 1 && campaign.id !== activeCampaignId && "hidden"
                )}
              >
                {campaignsWithVideos.length === 1 && (
                  <div className="mb-3">
                    <h3 className="font-medium text-sm text-black">{campaign.name}</h3>
                    {campaign.artistName && (
                      <p className="text-xs text-neutral-500">{campaign.artistName}</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {campaign.videos.map((video) => (
                    <ApprovedVideoCard
                      key={video.id}
                      video={video}
                      isSelected={selectedVideoIds.includes(video.id)}
                      onToggle={() => toggleVideoSelection(video.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Right Column - Publish Settings */}
        <div className="w-[55%] bg-neutral-50 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Platform Selection */}
              <div>
                <Label className="text-xs font-medium text-neutral-700 mb-3 block">
                  {isKorean ? "발행 플랫폼" : "Platforms"}
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((platform) => {
                    const isSelected = publish.selectedPlatforms.includes(platform.id);
                    const Icon = platform.icon;
                    return (
                      <button
                        key={platform.id}
                        onClick={() => togglePlatform(platform.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                          isSelected
                            ? "border-black bg-white shadow-sm"
                            : "border-neutral-200 bg-white/50 hover:border-neutral-300"
                        )}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white",
                            platform.color
                          )}
                        >
                          <Icon />
                        </div>
                        <span className="text-xs font-medium text-neutral-700">{platform.name}</span>
                        {isSelected && <CheckCircle className="h-4 w-4 text-black" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Caption with AI */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-neutral-700">
                    {isKorean ? "캡션" : "Caption"}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateAISuggestions}
                    disabled={isGeneratingAI || selectedVideos.length === 0}
                    className="h-7 text-xs text-neutral-600 hover:text-black"
                  >
                    {isGeneratingAI ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1.5" />
                    )}
                    {isKorean ? "AI 추천" : "AI Suggest"}
                  </Button>
                </div>
                <textarea
                  value={publish.caption}
                  onChange={(e) => setPublishCaption(e.target.value)}
                  placeholder={
                    isKorean
                      ? "영상에 대한 캡션을 작성하거나 AI 추천을 사용하세요..."
                      : "Write a caption or use AI suggestions..."
                  }
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                />
                <p className="text-[10px] text-neutral-500 mt-1 text-right">
                  {publish.caption.length}/2200
                </p>
              </div>

              {/* Hashtags */}
              <div>
                <Label className="text-xs font-medium text-neutral-700 mb-2 block">
                  {isKorean ? "해시태그" : "Hashtags"}
                </Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddHashtag()}
                    placeholder={isKorean ? "해시태그 추가..." : "Add hashtag..."}
                    className="flex-1 h-9 bg-white border-neutral-200 text-black text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddHashtag}
                    className="h-9 px-3 border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {publish.hashtags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="bg-neutral-200 text-neutral-700 pr-1 hover:bg-neutral-300"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveHashtag(tag)}
                        className="ml-1 hover:text-black"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <Label className="text-xs font-medium text-neutral-700 mb-3 block">
                  {isKorean ? "발행 시간" : "Schedule"}
                </Label>
                <div className="flex gap-2 mb-3">
                  <Button
                    variant={!isScheduled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDate(undefined)}
                    className={cn(
                      !isScheduled
                        ? "bg-black text-white hover:bg-neutral-800"
                        : "border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                    )}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    {isKorean ? "즉시 발행" : "Publish Now"}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={isScheduled ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          isScheduled
                            ? "bg-black text-white hover:bg-neutral-800"
                            : "border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                        )}
                      >
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {isScheduled ? format(selectedDate!, "PPP") : isKorean ? "예약 발행" : "Schedule"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white border-neutral-200">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date: Date) => date < new Date()}
                        className="bg-white"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {isScheduled && (
                  <div>
                    <p className="text-[10px] text-neutral-500 mb-2">
                      {isKorean ? "시간 선택" : "Select Time"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {TIME_SLOTS.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={cn(
                            "px-2 py-1 rounded text-xs transition-all",
                            selectedTime === time
                              ? "bg-black text-white"
                              : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                          )}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-green-600 mt-2 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {isKorean ? "AI 추천 시간: 오후 6시" : "AI Optimal: 6 PM"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Bottom Action Bar */}
          <div className="p-4 border-t border-neutral-200 bg-white">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-neutral-500">
                  {isKorean ? "영상" : "Videos"}: <span className="text-black font-medium">{selectedVideos.length}</span>
                </span>
                <span className="text-neutral-500">
                  {isKorean ? "플랫폼" : "Platforms"}: <span className="text-black font-medium">{publish.selectedPlatforms.length}</span>
                </span>
                <span className="text-neutral-500">
                  {isKorean ? "총 발행" : "Total"}: <span className="text-black font-semibold">{selectedVideos.length * publish.selectedPlatforms.length}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Clock className="h-3 w-3" />
                {isScheduled
                  ? `${format(selectedDate!, "PP")} ${selectedTime}`
                  : isKorean
                  ? "즉시"
                  : "Now"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
