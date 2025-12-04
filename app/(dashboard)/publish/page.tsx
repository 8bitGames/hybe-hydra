"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Send,
  ArrowLeft,
  ArrowRight,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Play,
  Eye,
  Hash,
  X,
  Plus,
  Link2,
  AlertCircle,
  CheckCircle,
  Zap,
  Video,
} from "lucide-react";

// Platform icons (simplified)
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

// ============================================================================
// Platform Configuration
// ============================================================================

const PLATFORMS = [
  { id: "tiktok", name: "TikTok", icon: TikTokIcon, color: "bg-black" },
  { id: "instagram", name: "Instagram Reels", icon: InstagramIcon, color: "bg-gradient-to-tr from-purple-600 to-pink-500" },
  { id: "youtube", name: "YouTube Shorts", icon: YouTubeIcon, color: "bg-red-600" },
];

// ============================================================================
// Time Slots
// ============================================================================

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00",
];

// ============================================================================
// Video Preview Card Component
// ============================================================================

function VideoPreviewCard({
  video,
  isSelected,
  onToggle,
}: {
  video: { id: string; outputUrl: string | null; thumbnailUrl: string | null; qualityScore: number | null };
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative aspect-[9/16] rounded-lg overflow-hidden bg-neutral-100 transition-all",
        isSelected ? "ring-2 ring-black" : "opacity-60 hover:opacity-100"
      )}
    >
      {video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      )}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
      {video.qualityScore && (
        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
          {video.qualityScore}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PublishPage() {
  const { language } = useI18n();
  const toast = useToast();
  const router = useRouter();

  // Sync workflow stage
  useWorkflowSync("publish");
  const { goToCreate, resetWorkflow } = useWorkflowNavigation();

  // Workflow store
  const create = useWorkflowStore((state) => state.create);
  const analyze = useWorkflowStore((state) => state.analyze);
  const publish = useWorkflowStore((state) => state.publish);
  const setPublishPlatforms = useWorkflowStore((state) => state.setPublishPlatforms);
  const setPublishTime = useWorkflowStore((state) => state.setPublishTime);
  const setPublishCaption = useWorkflowStore((state) => state.setPublishCaption);
  const setPublishHashtags = useWorkflowStore((state) => state.setPublishHashtags);

  // Local state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("18:00");
  const [isPublishing, setIsPublishing] = useState(false);
  const [newHashtag, setNewHashtag] = useState("");

  // Get selected videos from create stage
  const selectedVideos = create.generations.filter(
    (g) => create.selectedGenerations.includes(g.id) && g.status === "completed"
  );

  // Initialize caption and hashtags from analyze stage
  useEffect(() => {
    if (analyze.selectedIdea && !publish.caption) {
      setPublishCaption(analyze.selectedIdea.hook);
    }
    if (analyze.hashtags.length > 0 && publish.hashtags.length === 0) {
      setPublishHashtags(analyze.hashtags);
    }
  }, [analyze, publish, setPublishCaption, setPublishHashtags]);

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

  // Handle publish
  const handlePublish = async () => {
    if (selectedVideos.length === 0) {
      toast.warning(
        language === "ko" ? "영상 필요" : "Video needed",
        language === "ko" ? "발행할 영상이 없습니다" : "No videos to publish"
      );
      return;
    }

    if (publish.selectedPlatforms.length === 0) {
      toast.warning(
        language === "ko" ? "플랫폼 필요" : "Platform needed",
        language === "ko" ? "발행할 플랫폼을 선택하세요" : "Select at least one platform"
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
          video_id: video.id,
          video_url: video.outputUrl,
          platform,
          caption: `${publish.caption}\n\n${publish.hashtags.map((h) => `#${h}`).join(" ")}`,
          scheduled_at: scheduledAt,
        }))
      );

      // Call API to schedule
      const response = await api.post<{ success: boolean }>("/api/v1/publishing/schedule/batch", {
        posts: requests,
      });

      if (response.data?.success) {
        toast.success(
          language === "ko" ? "발행 예약 완료" : "Scheduled",
          language === "ko"
            ? `${requests.length}개의 발행이 예약되었습니다`
            : `${requests.length} posts scheduled`
        );

        // Reset workflow and go to dashboard
        resetWorkflow();
        router.push("/publishing");
      } else {
        throw new Error("Failed to schedule");
      }
    } catch (error) {
      console.error("Publish error:", error);
      toast.error(
        language === "ko" ? "오류 발생" : "Error",
        language === "ko" ? "발행 예약에 실패했습니다" : "Failed to schedule posts"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // Translations
  const t = {
    title: language === "ko" ? "콘텐츠 발행" : "Publish Content",
    subtitle:
      language === "ko"
        ? "SNS 채널에 스케줄 발행하세요"
        : "Schedule and publish to your SNS channels",
    selectVideos: language === "ko" ? "발행할 영상" : "Videos to Publish",
    platforms: language === "ko" ? "발행 플랫폼" : "Platforms",
    schedule: language === "ko" ? "발행 시간" : "Schedule",
    publishNow: language === "ko" ? "즉시 발행" : "Publish Now",
    scheduleLater: language === "ko" ? "예약 발행" : "Schedule for Later",
    caption: language === "ko" ? "캡션" : "Caption",
    hashtags: language === "ko" ? "해시태그" : "Hashtags",
    back: language === "ko" ? "생성으로" : "Back to Create",
    publish: language === "ko" ? "발행하기" : "Publish",
    scheduling: language === "ko" ? "예약 중..." : "Scheduling...",
    optimalTime: language === "ko" ? "AI 추천 시간: 오후 6시" : "AI Optimal: 6 PM",
  };

  const isScheduled = selectedDate !== undefined;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-neutral-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
              <Send className="h-5 w-5 text-neutral-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-black">{t.title}</h1>
              <p className="text-xs text-neutral-500">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToCreate}
              className="text-neutral-600 hover:text-black"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t.back}
            </Button>
            <Button
              onClick={handlePublish}
              disabled={
                selectedVideos.length === 0 ||
                publish.selectedPlatforms.length === 0 ||
                isPublishing
              }
              className="bg-black text-white hover:bg-neutral-800"
            >
              {isPublishing ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {t.scheduling}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {t.publish}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column */}
      <div className="flex flex-1">
        {/* Left Column - Video Selection & Platforms */}
        <div className="w-1/2 border-r border-neutral-200">
          <div className="p-6 space-y-6">
            {/* Video Selection */}
            <div>
              <Label className="text-xs font-medium text-neutral-700 mb-3 block">
                {t.selectVideos} ({selectedVideos.length})
              </Label>
              {selectedVideos.length === 0 ? (
                <div className="text-center py-8 border border-neutral-200 rounded-lg bg-neutral-50">
                  <Video className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500 mb-3">
                    {language === "ko"
                      ? "발행할 영상이 없습니다"
                      : "No videos selected for publishing"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToCreate}
                    className="border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    {language === "ko" ? "생성으로 돌아가기" : "Go to Create"}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {selectedVideos.map((video) => (
                    <VideoPreviewCard
                      key={video.id}
                      video={video}
                      isSelected={true}
                      onToggle={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Platform Selection */}
            <div>
              <Label className="text-xs font-medium text-neutral-700 mb-3 block">
                {t.platforms}
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
                        "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                        isSelected
                          ? "border-black bg-neutral-50"
                          : "border-neutral-200 hover:border-neutral-300"
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
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-black" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule */}
            <div>
              <Label className="text-xs font-medium text-neutral-700 mb-3 block">
                {t.schedule}
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
                  {t.publishNow}
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
                      {isScheduled
                        ? format(selectedDate!, "PPP")
                        : t.scheduleLater}
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
                    {language === "ko" ? "시간 선택" : "Select Time"}
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
                            : "bg-neutral-100 text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                        )}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-green-600 mt-2 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {t.optimalTime}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Caption & Hashtags */}
        <div className="w-1/2 bg-neutral-50">
          <div className="p-6 space-y-6">
            {/* Caption */}
            <div>
              <Label className="text-xs font-medium text-neutral-700 mb-2 block">
                {t.caption}
              </Label>
              <textarea
                value={publish.caption}
                onChange={(e) => setPublishCaption(e.target.value)}
                placeholder={
                  language === "ko"
                    ? "영상에 대한 캡션을 작성하세요..."
                    : "Write a caption for your video..."
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
                {t.hashtags}
              </Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddHashtag()}
                  placeholder={language === "ko" ? "해시태그 추가..." : "Add hashtag..."}
                  className="flex-1 h-8 bg-white border-neutral-200 text-black text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddHashtag}
                  className="h-8 px-2 border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {publish.hashtags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-neutral-200 text-neutral-700 pr-1"
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

            {/* Preview */}
            <div className="border border-neutral-200 rounded-lg p-4 bg-white">
              <h3 className="text-xs font-semibold text-neutral-500 mb-3">
                {language === "ko" ? "미리보기" : "Preview"}
              </h3>
              <div className="space-y-2">
                <p className="text-sm text-black whitespace-pre-wrap">
                  {publish.caption || (language === "ko" ? "(캡션 없음)" : "(No caption)")}
                </p>
                <p className="text-sm text-blue-600">
                  {publish.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-2">
              <h3 className="text-xs font-semibold text-neutral-500 mb-3">
                {language === "ko" ? "발행 요약" : "Publish Summary"}
              </h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  {language === "ko" ? "영상" : "Videos"}
                </span>
                <span className="text-black">{selectedVideos.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  {language === "ko" ? "플랫폼" : "Platforms"}
                </span>
                <span className="text-black">{publish.selectedPlatforms.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  {language === "ko" ? "총 발행" : "Total Posts"}
                </span>
                <span className="text-black font-semibold">
                  {selectedVideos.length * publish.selectedPlatforms.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-neutral-200">
                <span className="text-neutral-500">
                  {language === "ko" ? "발행 시간" : "Publish Time"}
                </span>
                <span className="text-black">
                  {isScheduled
                    ? `${format(selectedDate!, "PP")} ${selectedTime}`
                    : language === "ko"
                    ? "즉시"
                    : "Immediately"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
