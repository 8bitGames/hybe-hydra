"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkflowStore, ContentIdea } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { useCampaigns } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";
import { StashedPromptsPanel } from "@/components/features/stashed-prompts-panel";
import { cn, getProxiedImageUrl } from "@/lib/utils";
import {
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  FolderOpen,
  Hash,
  Eye,
  Video,
  Image as ImageIcon,
  Bot,
  Zap,
  Target,
  Users,
  Clock,
  Music,
  Plus,
  X,
  ChevronRight,
  Wand2,
  BookmarkCheck,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

// Video content for trend analysis
interface InspirationVideo {
  id: string;
  description?: string;
  hashtags?: string[];
  stats?: {
    playCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
  engagementRate?: number;
}

// AI insights from discover phase
interface TrendInsights {
  summary?: string;
  contentStrategy?: string[];
  videoIdeas?: string[];
  targetAudience?: string[];
  bestPostingTimes?: string[];
}

interface GenerateIdeasRequest {
  user_idea: string;
  keywords: string[];
  hashtags: string[];
  target_audience: string[];
  content_goals: string[];
  // Rich trend data (instead of just a count)
  inspiration_videos?: InspirationVideo[];
  trend_insights?: TrendInsights;
  performance_metrics?: {
    avgViews: number;
    avgEngagement: number;
    viralBenchmark: number;
  } | null;
}

interface GenerateIdeasResponse {
  success: boolean;
  ideas: ContentIdea[];
  optimized_hashtags: string[];
  content_strategy: string;
}

// ============================================================================
// Target Audience Options
// ============================================================================

const AUDIENCE_OPTIONS = [
  { id: "gen_z", label: { ko: "Gen Z", en: "Gen Z" } },
  { id: "millennials", label: { ko: "밀레니얼", en: "Millennials" } },
  { id: "music_fans", label: { ko: "음악 팬", en: "Music Fans" } },
  { id: "fashion", label: { ko: "패션 관심층", en: "Fashion Enthusiasts" } },
];

const GOAL_OPTIONS = [
  { id: "awareness", label: { ko: "인지도", en: "Brand Awareness" } },
  { id: "engagement", label: { ko: "참여도", en: "Engagement" } },
  { id: "viral", label: { ko: "바이럴", en: "Go Viral" } },
  { id: "entertainment", label: { ko: "엔터테인먼트", en: "Entertainment" } },
];

// ============================================================================
// Context Reception Component
// ============================================================================

function ContextReceptionPanel() {
  const { language } = useI18n();
  const { goToDiscover } = useWorkflowNavigation();

  const { keywords, selectedHashtags, savedInspiration, performanceMetrics, aiInsights } =
    useWorkflowStore((state) => state.discover);

  const hasContext =
    keywords.length > 0 ||
    selectedHashtags.length > 0 ||
    savedInspiration.length > 0;

  if (!hasContext) {
    return (
      <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-neutral-200 mx-auto mb-3 flex items-center justify-center">
            <BookmarkCheck className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="text-sm text-neutral-500 mb-3">
            {language === "ko"
              ? "발견 단계에서 트렌드를 수집하세요"
              : "Collect trends from Discover stage"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={goToDiscover}
            className="border-neutral-300 text-neutral-700"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            {language === "ko" ? "발견으로 돌아가기" : "Go to Discover"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
      {/* Header with data usage purpose */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 text-neutral-900" />
          {language === "ko" ? "AI 생성에 활용될 데이터" : "Data for AI Generation"}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={goToDiscover}
          className="h-7 px-2 text-xs text-neutral-500"
        >
          {language === "ko" ? "수정" : "Edit"}
        </Button>
      </div>
      {/* Data usage description */}
      <p className="text-xs text-neutral-500 mb-3 flex items-center gap-1">
        <span className="inline-block w-1 h-1 rounded-full bg-neutral-400" />
        {language === "ko"
          ? "아래 데이터가 맞춤형 콘텐츠 아이디어 생성에 반영됩니다"
          : "The following data will be reflected in custom content idea generation"}
      </p>

      <div className="space-y-3">
        {/* Keywords */}
        {keywords.length > 0 && (
          <div>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">
              {language === "ko" ? "키워드" : "Keywords"}
            </p>
            <div className="flex flex-wrap gap-1">
              {keywords.map((k) => (
                <Badge
                  key={k}
                  variant="outline"
                  className="text-xs border-neutral-300 text-neutral-600"
                >
                  #{k}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Hashtags */}
        {selectedHashtags.length > 0 && (
          <div>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">
              {language === "ko" ? "해시태그" : "Hashtags"}
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedHashtags.map((h) => (
                <Badge key={h} className="text-xs bg-neutral-900 text-white">
                  #{h}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Saved Inspiration */}
        {savedInspiration.length > 0 && (
          <div>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">
              {language === "ko" ? "저장된 영감" : "Saved Inspiration"} ({savedInspiration.length})
            </p>
            <div className="flex gap-1">
              {savedInspiration.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="w-10 h-14 rounded overflow-hidden bg-neutral-200"
                >
                  {v.thumbnailUrl && (
                    <img
                      src={getProxiedImageUrl(v.thumbnailUrl) || ""}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
              {savedInspiration.length > 5 && (
                <div className="w-10 h-14 rounded bg-neutral-200 flex items-center justify-center text-xs text-neutral-500">
                  +{savedInspiration.length - 5}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {performanceMetrics && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-200">
            <div className="text-center">
              <p className="text-[10px] text-neutral-500">
                {language === "ko" ? "평균 조회" : "Avg Views"}
              </p>
              <p className="text-xs font-medium text-neutral-700">
                {(performanceMetrics.avgViews / 1000).toFixed(0)}K
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-neutral-500">
                {language === "ko" ? "참여율" : "Engagement"}
              </p>
              <p className="text-xs font-medium text-neutral-700">
                {performanceMetrics.avgEngagement.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-neutral-500">
                {language === "ko" ? "바이럴 기준" : "Viral Bar"}
              </p>
              <p className="text-xs font-medium text-neutral-700">
                {(performanceMetrics.viralBenchmark / 1000).toFixed(0)}K+
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Campaign Selector Component
// ============================================================================

function CampaignSelector() {
  const { language } = useI18n();
  const router = useRouter();

  const { campaignId, setAnalyzeCampaign } = useWorkflowStore(
    useShallow((state) => ({
      campaignId: state.analyze.campaignId,
      setAnalyzeCampaign: state.setAnalyzeCampaign,
    }))
  );

  const { data: campaignsData, isLoading } = useCampaigns({ page_size: 100, status: "active" });
  const campaigns = campaignsData?.items || [];

  // Auto-select first campaign
  useEffect(() => {
    if (campaigns.length > 0 && !campaignId) {
      setAnalyzeCampaign(campaigns[0].id, campaigns[0].name);
    }
  }, [campaigns, campaignId, setAnalyzeCampaign]);

  if (isLoading) {
    return <div className="h-24 bg-neutral-100 rounded-lg animate-pulse" />;
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-6 border border-neutral-200 rounded-lg">
        <FolderOpen className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
        <p className="text-xs text-neutral-500 mb-2">
          {language === "ko" ? "캠페인이 없습니다" : "No campaigns"}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/campaigns/new")}
          className="border-neutral-300"
        >
          <Plus className="h-3 w-3 mr-1" />
          {language === "ko" ? "캠페인 만들기" : "Create Campaign"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      {campaigns.slice(0, 6).map((campaign) => {
        const isSelected = campaignId === campaign.id;
        return (
          <button
            key={campaign.id}
            onClick={() => setAnalyzeCampaign(campaign.id, campaign.name)}
            className={cn(
              "w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all",
              isSelected
                ? "border-neutral-900 bg-neutral-100"
                : "border-neutral-200 hover:border-neutral-300"
            )}
          >
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                isSelected ? "bg-neutral-200" : "bg-neutral-100"
              )}
            >
              {campaign.cover_image_url ? (
                <img
                  src={campaign.cover_image_url}
                  alt=""
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <FolderOpen
                  className={cn("h-4 w-4", isSelected ? "text-neutral-900" : "text-neutral-500")}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-neutral-800">{campaign.name}</p>
              <p className="text-xs text-neutral-500 truncate">
                {campaign.artist_stage_name || campaign.artist_name}
              </p>
            </div>
            {isSelected && (
              <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Idea Card Component
// ============================================================================

function IdeaCard({
  idea,
  isSelected,
  onSelect,
  onDelete,
}: {
  idea: ContentIdea;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { language } = useI18n();

  const typeIcon = idea.type === "ai_video" ? Video : ImageIcon;
  const TypeIcon = typeIcon;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all cursor-pointer group relative",
        isSelected
          ? "border-neutral-900 bg-white"
          : "border-neutral-200 hover:border-neutral-300 bg-white"
      )}
    >
      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-neutral-100 hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title={language === "ko" ? "삭제" : "Delete"}
      >
        <X className="h-3.5 w-3.5 text-neutral-500 hover:text-red-600" />
      </button>

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            isSelected ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
          )}
        >
          <TypeIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-neutral-800 truncate">{idea.title}</h4>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] shrink-0",
                idea.estimatedEngagement === "high"
                  ? "border-green-600 text-green-600"
                  : idea.estimatedEngagement === "medium"
                  ? "border-yellow-600 text-yellow-600"
                  : "border-neutral-400 text-neutral-400"
              )}
            >
              {idea.estimatedEngagement === "high"
                ? language === "ko"
                  ? "높음"
                  : "High"
                : idea.estimatedEngagement === "medium"
                ? language === "ko"
                  ? "중간"
                  : "Medium"
                : language === "ko"
                ? "낮음"
                : "Low"}
            </Badge>
          </div>
          <p className="text-xs text-neutral-500 mb-2 line-clamp-2">{idea.hook}</p>
          <div className="flex items-center gap-3 text-[10px] text-neutral-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {idea.type === "ai_video"
                ? language === "ko"
                  ? "AI 영상"
                  : "AI Video"
                : language === "ko"
                ? "컴포즈"
                : "Compose"}
            </span>
            {idea.suggestedMusic && (
              <span className="flex items-center gap-1">
                <Music className="h-3 w-3" />
                {idea.suggestedMusic.bpm} BPM
              </span>
            )}
          </div>
        </div>
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
            <Check className="h-3 w-3 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AnalyzePage() {
  const { language } = useI18n();
  const toast = useToast();
  const router = useRouter();

  // Sync workflow stage
  useWorkflowSync("analyze");
  const { goToDiscover, proceedToCreate, canProceedToCreate } = useWorkflowNavigation();

  // Workflow store
  const discover = useWorkflowStore((state) => state.discover);
  const analyze = useWorkflowStore((state) => state.analyze);
  const setAnalyzeUserIdea = useWorkflowStore((state) => state.setAnalyzeUserIdea);
  const setAnalyzeTargetAudience = useWorkflowStore((state) => state.setAnalyzeTargetAudience);
  const setAnalyzeContentGoals = useWorkflowStore((state) => state.setAnalyzeContentGoals);
  const setAnalyzeAiIdeas = useWorkflowStore((state) => state.setAnalyzeAiIdeas);
  const removeAnalyzeIdea = useWorkflowStore((state) => state.removeAnalyzeIdea);
  const selectAnalyzeIdea = useWorkflowStore((state) => state.selectAnalyzeIdea);
  const setAnalyzeOptimizedPrompt = useWorkflowStore((state) => state.setAnalyzeOptimizedPrompt);
  const setAnalyzeHashtags = useWorkflowStore((state) => state.setAnalyzeHashtags);

  // Local state
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize hashtags from discover
  useEffect(() => {
    if (discover.selectedHashtags.length > 0 && analyze.hashtags.length === 0) {
      setAnalyzeHashtags(discover.selectedHashtags);
    }
  }, [discover.selectedHashtags, analyze.hashtags, setAnalyzeHashtags]);

  // Toggle handlers
  const toggleAudience = useCallback(
    (id: string) => {
      const current = analyze.targetAudience;
      if (current.includes(id)) {
        setAnalyzeTargetAudience(current.filter((a) => a !== id));
      } else {
        setAnalyzeTargetAudience([...current, id]);
      }
    },
    [analyze.targetAudience, setAnalyzeTargetAudience]
  );

  const toggleGoal = useCallback(
    (id: string) => {
      const current = analyze.contentGoals;
      if (current.includes(id)) {
        setAnalyzeContentGoals(current.filter((g) => g !== id));
      } else {
        setAnalyzeContentGoals([...current, id]);
      }
    },
    [analyze.contentGoals, setAnalyzeContentGoals]
  );

  // Generate ideas with Gemini 3
  const handleGenerateIdeas = async () => {
    if (!analyze.campaignId) {
      toast.warning(
        language === "ko" ? "캠페인 필요" : "Campaign needed",
        language === "ko" ? "캠페인을 선택하세요" : "Please select a campaign"
      );
      return;
    }

    setIsGenerating(true);

    try {
      // Transform saved inspiration to include rich content data
      const inspirationVideos: InspirationVideo[] = discover.savedInspiration.map((video) => ({
        id: video.id,
        description: video.description,
        hashtags: video.hashtags,
        stats: video.stats,
        engagementRate: video.engagementRate,
      }));

      // Also include viral videos from trend analysis
      if (discover.trendAnalysis?.viralVideos) {
        discover.trendAnalysis.viralVideos.forEach((video) => {
          // Only add if not already in saved inspiration
          if (!inspirationVideos.find(v => v.id === video.id)) {
            inspirationVideos.push({
              id: video.id,
              description: video.description,
              hashtags: video.hashtags,
              stats: video.stats,
              engagementRate: video.engagementRate,
            });
          }
        });
      }

      // Extract AI insights from discover phase
      const trendInsights: TrendInsights | undefined = discover.aiInsights ? {
        summary: discover.aiInsights.summary,
        contentStrategy: discover.aiInsights.contentStrategy,
        videoIdeas: discover.aiInsights.videoIdeas,
        targetAudience: discover.aiInsights.targetAudience,
        bestPostingTimes: discover.aiInsights.bestPostingTimes,
      } : undefined;

      const request: GenerateIdeasRequest = {
        user_idea: analyze.userIdea,
        keywords: discover.keywords,
        hashtags: analyze.hashtags,
        target_audience: analyze.targetAudience,
        content_goals: analyze.contentGoals,
        // Pass rich trend data instead of just count
        inspiration_videos: inspirationVideos,
        trend_insights: trendInsights,
        performance_metrics: discover.performanceMetrics,
      };

      const response = await api.post<GenerateIdeasResponse, GenerateIdeasRequest>(
        "/api/v1/analyze/generate-ideas",
        request
      );

      if (response.data?.success) {
        setAnalyzeAiIdeas(response.data.ideas);
        if (response.data.optimized_hashtags.length > 0) {
          setAnalyzeHashtags(response.data.optimized_hashtags);
        }
        toast.success(
          language === "ko" ? "아이디어 생성 완료" : "Ideas generated",
          language === "ko"
            ? `${response.data.ideas.length}개의 콘텐츠 아이디어`
            : `${response.data.ideas.length} content ideas`
        );
      } else {
        throw new Error("Failed to generate ideas");
      }
    } catch (error) {
      console.error("Generate ideas error:", error);
      toast.error(
        language === "ko" ? "오류 발생" : "Error",
        language === "ko" ? "아이디어 생성에 실패했습니다" : "Failed to generate ideas"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Select idea and set optimized prompt
  const handleSelectIdea = useCallback(
    (idea: ContentIdea) => {
      selectAnalyzeIdea(idea);
      setAnalyzeOptimizedPrompt(idea.optimizedPrompt);
    },
    [selectAnalyzeIdea, setAnalyzeOptimizedPrompt]
  );

  // Proceed to create
  const handleProceedToCreate = () => {
    if (!canProceedToCreate) {
      toast.warning(
        language === "ko" ? "아이디어 필요" : "Idea needed",
        language === "ko"
          ? "아이디어를 생성하고 선택하세요"
          : "Generate and select an idea first"
      );
      return;
    }
    proceedToCreate();
  };

  // Translations
  const t = {
    title: language === "ko" ? "콘텐츠 분석" : "Analyze Content",
    subtitle:
      language === "ko"
        ? "아이디어를 정리하고 AI로 콘텐츠를 준비하세요"
        : "Organize ideas and prepare content with AI",
    campaign: language === "ko" ? "캠페인" : "Campaign",
    yourIdea: language === "ko" ? "아이디어" : "Your Idea",
    ideaPlaceholder:
      language === "ko"
        ? "만들고 싶은 영상에 대해 설명해주세요...\n예: 해변에서 춤추는 밝은 분위기의 영상"
        : "Describe the video you want to create...\nExample: A bright, cheerful video dancing on the beach",
    targetAudience: language === "ko" ? "타겟 오디언스" : "Target Audience",
    contentGoals: language === "ko" ? "콘텐츠 목표" : "Content Goals",
    generateIdeas: language === "ko" ? "AI 아이디어 생성" : "Generate AI Ideas",
    generating: language === "ko" ? "생성 중..." : "Generating...",
    aiIdeas: language === "ko" ? "AI 콘텐츠 아이디어" : "AI Content Ideas",
    selectedIdea: language === "ko" ? "선택된 아이디어" : "Selected Idea",
    proceed: language === "ko" ? "생성 단계로" : "Proceed to Create",
    back: language === "ko" ? "발견으로" : "Back to Discover",
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <WorkflowHeader
        onBack={goToDiscover}
        onNext={handleProceedToCreate}
        canProceed={canProceedToCreate}
      />

      {/* Main Content - Two Column */}
      <div className="flex-1 flex overflow-hidden px-[7%]">
        {/* Left Column - Input */}
        <div className="w-1/2 border-r border-neutral-200 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Context from Discover */}
              <ContextReceptionPanel />

              {/* Campaign Selection */}
              <div>
                <Label className="text-xs font-medium text-neutral-700 mb-2 block">
                  {t.campaign}
                </Label>
                <CampaignSelector />
              </div>

              {/* User Idea Input */}
              <div>
                <Label className="text-xs font-medium text-neutral-700 mb-2 block">
                  {t.yourIdea}
                </Label>
                <textarea
                  value={analyze.userIdea}
                  onChange={(e) => setAnalyzeUserIdea(e.target.value)}
                  placeholder={t.ideaPlaceholder}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 resize-none"
                />
              </div>

              {/* Target Audience */}
              <div>
                <Label className="text-xs font-medium text-neutral-700 mb-2 block">
                  {t.targetAudience}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map((option) => {
                    const isSelected = analyze.targetAudience.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleAudience(option.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          isSelected
                            ? "bg-neutral-900 text-white"
                            : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                        )}
                      >
                        {option.label[language]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Goals */}
              <div>
                <Label className="text-xs font-medium text-neutral-700 mb-2 block">
                  {t.contentGoals}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((option) => {
                    const isSelected = analyze.contentGoals.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleGoal(option.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          isSelected
                            ? "bg-neutral-900 text-white"
                            : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                        )}
                      >
                        {option.label[language]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data Flow Indicator */}
              {(discover.keywords.length > 0 || discover.savedInspiration.length > 0) && (
                <div className="mb-3 p-2 rounded-lg bg-neutral-100 border border-neutral-200">
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-neutral-400" />
                      <span>{language === "ko" ? "트렌드 데이터" : "Trend Data"}</span>
                    </div>
                    <span className="text-neutral-300">→</span>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-neutral-500" />
                      <span>{language === "ko" ? "AI 분석" : "AI Analysis"}</span>
                    </div>
                    <span className="text-neutral-300">→</span>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-neutral-900" />
                      <span>{language === "ko" ? "맞춤 프롬프트" : "Custom Prompt"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Context Info */}
              {(discover.keywords.length > 0 || discover.savedInspiration.length > 0) && (
                <p className="text-xs text-neutral-500 mb-2 text-center">
                  {language === "ko"
                    ? `${discover.keywords.length}개 키워드 + ${discover.savedInspiration.length}개 영감 활용`
                    : `Using ${discover.keywords.length} keywords + ${discover.savedInspiration.length} inspirations`}
                </p>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGenerateIdeas}
                disabled={!analyze.campaignId || isGenerating}
                className="w-full bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {isGenerating ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    {t.generating}
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-2" />
                    {t.generateIdeas}
                  </>
                )}
              </Button>
            </div>
          </ScrollArea>
        </div>

        {/* Right Column - AI Ideas */}
        <div className="w-1/2 flex flex-col bg-neutral-50">
          <div className="p-4 border-b border-neutral-200 shrink-0">
            <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-neutral-900" />
              {t.aiIdeas}
            </h2>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {analyze.aiGeneratedIdeas.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-neutral-200 mx-auto mb-4 flex items-center justify-center">
                    <Bot className="h-7 w-7 text-neutral-400" />
                  </div>
                  <p className="text-sm text-neutral-500 mb-1">
                    {language === "ko"
                      ? "AI가 콘텐츠 아이디어를 생성합니다"
                      : "AI will generate content ideas"}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {language === "ko"
                      ? "위의 정보를 입력하고 생성 버튼을 클릭하세요"
                      : "Fill in the info above and click generate"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analyze.aiGeneratedIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      isSelected={analyze.selectedIdea?.id === idea.id}
                      onSelect={() => handleSelectIdea(idea)}
                      onDelete={() => removeAnalyzeIdea(idea.id)}
                    />
                  ))}
                </div>
              )}

              {/* Selected Idea Summary */}
              {analyze.selectedIdea && (
                <div className="mt-4 p-4 border border-neutral-300 rounded-lg bg-white">
                  <h3 className="text-xs font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                    <Check className="h-3 w-3" />
                    {t.selectedIdea}
                  </h3>
                  <p className="text-sm text-neutral-700 mb-3">{analyze.selectedIdea.title}</p>
                  <div className="p-3 bg-neutral-100 rounded border border-neutral-200">
                    <p className="text-xs text-neutral-500 mb-1">
                      {language === "ko" ? "최적화된 프롬프트" : "Optimized Prompt"}
                    </p>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      {analyze.selectedIdea.optimizedPrompt}
                    </p>
                  </div>
                  {analyze.hashtags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {analyze.hashtags.map((tag) => (
                        <Badge key={tag} className="text-xs bg-neutral-200 text-neutral-700">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stashed Prompts Panel */}
              <div className="mt-4">
                <StashedPromptsPanel
                  currentPrompt={analyze.optimizedPrompt || analyze.selectedIdea?.optimizedPrompt || ""}
                  currentMetadata={{
                    // Campaign & idea
                    campaignId: analyze.campaignId || undefined,
                    campaignName: analyze.campaignName || undefined,
                    selectedIdea: analyze.selectedIdea,
                    // Hashtags & keywords
                    hashtags: analyze.hashtags,
                    keywords: discover.keywords,
                    // Performance metrics
                    performanceMetrics: discover.performanceMetrics,
                    // Saved inspiration (thumbnails & stats only)
                    savedInspiration: discover.savedInspiration.map((v) => ({
                      id: v.id,
                      thumbnailUrl: v.thumbnailUrl,
                      stats: v.stats,
                    })),
                    // Target audience & goals
                    targetAudience: analyze.targetAudience,
                    contentGoals: analyze.contentGoals,
                    // AI insights
                    aiInsights: discover.aiInsights,
                  }}
                  source="analyze"
                  onRestore={(prompt, metadata) => {
                    setAnalyzeOptimizedPrompt(prompt);
                    if (metadata.hashtags && metadata.hashtags.length > 0) {
                      setAnalyzeHashtags(metadata.hashtags);
                    }
                  }}
                  collapsed={true}
                />
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

    </div>
  );
}
