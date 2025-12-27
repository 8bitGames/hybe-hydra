"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkflowStore, ContentIdea, StartFromVideo } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowNavigation, useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { useSessionWorkflowSync } from "@/lib/stores/session-workflow-sync";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkflowHeader, WorkflowFooter } from "@/components/workflow/WorkflowHeader";
import { StashedPromptsPanel } from "@/components/features/stashed-prompts-panel";
import { cn, getProxiedImageUrl, formatNumber } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Video,
  Image as ImageIcon,
  Bot,
  Clock,
  Music,
  X,
  BookmarkCheck,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InfoButton } from "@/components/ui/info-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Video recreation prompt generation now handled by VideoRecreationIdeaAgent

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

// Video analysis data from StartFromVideo
interface VideoAnalysisData {
  hookAnalysis?: string;
  styleAnalysis?: string;
  structureAnalysis?: string;
  suggestedApproach?: string;
  isComposeVideo?: boolean;
  imageCount?: number;
  conceptDetails?: {
    visualStyle?: string;
    colorPalette?: string[];
    lighting?: string;
    cameraMovement?: string[];
    transitions?: string[];
    effects?: string[];
    mood?: string;
    pace?: string;
    mainSubject?: string;
    actions?: string[];
    setting?: string;
    props?: string[];
    clothingStyle?: string;
  };
}

interface GenerateIdeasRequest {
  user_idea: string;
  keywords: string[];
  hashtags: string[];
  target_audience: string[];
  content_goals: string[];
  campaign_description?: string | null;  // Central context for all prompts - describes campaign concept/goal
  genre?: string | null;  // Music genre for content generation
  // Rich trend data (instead of just a count)
  inspiration_videos?: InspirationVideo[];
  trend_insights?: TrendInsights;
  performance_metrics?: {
    avgViews: number;
    avgEngagement: number;
    viralBenchmark: number;
  } | null;
  language?: "ko" | "en";
  // Content type - selected by user at Start stage
  contentType?: "ai_video" | "fast-cut";
  // Video analysis data (when started from video)
  video_analysis?: VideoAnalysisData | null;
  video_description?: string | null;
  video_hashtags?: string[] | null;
}

interface GenerateIdeasResponse {
  success: boolean;
  ideas: ContentIdea[];
  optimized_hashtags: string[];
  content_strategy: string;
}

// ============================================================================
// Context Reception Component
// ============================================================================

function ContextReceptionPanel() {
  const { language } = useI18n();
  const { goToStart } = useWorkflowNavigation();

  // Get start state with discover as fallback for legacy data
  const { start, startSource, resetWorkflow } = useWorkflowStore(
    useShallow((state) => ({
      start: state.start,
      startSource: state.start.source,
      resetWorkflow: state.resetWorkflow,
    }))
  );

  // Extract data from start state (migrated from discover)
  const { selectedHashtags, savedInspiration, aiInsights } = start;

  // Extract keywords from start.source based on source type
  const keywords = (() => {
    const source = startSource;
    if (!source) return [];
    switch (source.type) {
      case "trends":
        return source.keywords || [];
      case "idea":
        return source.keywords || [];
      case "video":
        return source.hashtags || [];
      default:
        return [];
    }
  })();

  // Type guard for video source
  const isVideoSource = startSource?.type === "video";
  const videoSource: StartFromVideo | null = isVideoSource ? (startSource as StartFromVideo) : null;

  // Clear all workflow data and go back to start
  const handleClearAndRestart = useCallback(() => {
    resetWorkflow();
    goToStart();
  }, [resetWorkflow, goToStart]);

  // Debug logging
  console.log("[ContextReceptionPanel] Source type:", startSource?.type);
  console.log("[ContextReceptionPanel] Video source hashtags:", videoSource?.hashtags);
  console.log("[ContextReceptionPanel] Start keywords:", keywords);

  // Determine what data to display based on source type
  // When video is selected, use video's hashtags; otherwise use start keywords
  const displayKeywords = isVideoSource && videoSource && videoSource.hashtags.length > 0
    ? videoSource.hashtags
    : keywords;

  const displayHashtags = isVideoSource && videoSource && videoSource.hashtags.length > 0
    ? [] // Video already shows hashtags as keywords
    : selectedHashtags;

  const hasContext =
    displayKeywords.length > 0 ||
    displayHashtags.length > 0 ||
    savedInspiration.length > 0 ||
    aiInsights !== null ||
    (isVideoSource && videoSource?.aiAnalysis);

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
            onClick={goToStart}
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
    <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50 w-full overflow-hidden">
      {/* Header with data usage purpose */}
      <div className="flex items-center justify-between mb-2 min-w-0 w-full">
        <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2 min-w-0 truncate">
          <BookmarkCheck className="h-4 w-4 text-neutral-900" />
          {language === "ko" ? "AI 생성에 활용될 데이터" : "Data for AI Generation"}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClearAndRestart}
          className="h-7 w-7 text-neutral-400 hover:text-neutral-600"
          title={language === "ko" ? "초기화하고 다시 시작" : "Clear and restart"}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {/* Data usage description */}
      <p className="text-xs text-neutral-500 mb-3 flex items-center gap-1">
        <span className="inline-block w-1 h-1 rounded-full bg-neutral-400" />
        {language === "ko"
          ? "아래 데이터가 맞춤형 콘텐츠 아이디어 생성에 반영됩니다"
          : "The following data will be reflected in custom content idea generation"}
      </p>

      <div className="space-y-3 overflow-hidden w-full">
        {/* Source Type Indicator */}
        {isVideoSource && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Video className="h-3 w-3" />
            <span>{language === "ko" ? "영상 기반 분석" : "Video-based analysis"}</span>
          </div>
        )}

        {/* Keywords (from video hashtags or trend keywords) */}
        {displayKeywords.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                {language === "ko" ? "키워드" : "Keywords"}
              </p>
              <InfoButton
                content={language === "ko"
                  ? "영상에서 추출된 핵심 키워드와 해시태그입니다. AI가 이 키워드들을 분석하여 관련성 높은 콘텐츠 아이디어를 제안합니다."
                  : "Core keywords and hashtags extracted from the video. AI analyzes these to suggest highly relevant content ideas."}
                size="sm"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {displayKeywords.map((k) => (
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

        {/* Hashtags (only for trend source) */}
        {displayHashtags.length > 0 && (
          <div>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">
              {language === "ko" ? "해시태그" : "Hashtags"}
            </p>
            <div className="flex flex-wrap gap-1">
              {displayHashtags.map((h) => (
                <Badge key={h} className="text-xs bg-neutral-900 text-white">
                  #{h}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Trend Videos - Auto-fetched from keyword analysis */}
        {savedInspiration.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                {language === "ko" ? "트렌드 영상" : "Trend Videos"} ({savedInspiration.length})
              </p>
              <InfoButton
                content={language === "ko"
                  ? "입력한 키워드로 검색된 TikTok 인기 영상들입니다. AI가 이 영상들의 성과를 참고하여 아이디어를 생성합니다."
                  : "Popular TikTok videos found by your keywords. AI references these videos' performance to generate ideas."}
                size="sm"
              />
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {savedInspiration.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="p-2 bg-neutral-50 rounded-lg border border-neutral-100"
                >
                  {/* Stats Row */}
                  <div className="flex items-center gap-3 text-[10px] text-neutral-500 mb-1">
                    <span className="flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      {formatNumber(v.stats?.playCount || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      ❤️ {formatNumber(v.stats?.likeCount || 0)}
                    </span>
                    <span className="text-green-600 font-medium">
                      {v.engagementRate?.toFixed(1)}%
                    </span>
                    {v.author?.name && (
                      <span className="text-neutral-400">@{v.author.name}</span>
                    )}
                  </div>
                  {/* Description */}
                  {v.description && (
                    <p className="text-xs text-neutral-600 line-clamp-2 mb-1">
                      {v.description}
                    </p>
                  )}
                  {/* Hashtags */}
                  {v.hashtags && v.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {v.hashtags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="text-[10px] text-blue-500">
                          #{tag}
                        </span>
                      ))}
                      {v.hashtags.length > 4 && (
                        <span className="text-[10px] text-neutral-400">
                          +{v.hashtags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {savedInspiration.length > 5 && (
                <p className="text-[10px] text-neutral-400 text-center py-1">
                  +{savedInspiration.length - 5} {language === "ko" ? "개 더" : "more"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* AI Video Analysis (for video source) */}
        {isVideoSource && videoSource?.aiAnalysis && (
          <div className="pt-2 border-t border-neutral-200 space-y-2 w-full overflow-hidden">
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                {language === "ko" ? "AI 영상 분석" : "AI Video Analysis"}
              </p>
              <InfoButton
                content={language === "ko"
                  ? "AI가 TikTok 영상을 분석하여 추출한 핵심 정보입니다. 훅, 스타일, 분위기 등 영상의 특징을 파악하여 비슷한 스타일의 콘텐츠를 만들 수 있습니다."
                  : "Key information extracted by AI analysis of the TikTok video. Captures video characteristics like hooks, style, and mood to help create similar content."}
                size="sm"
              />
            </div>

            {/* Hook Analysis */}
            {videoSource.aiAnalysis.hookAnalysis && (
              <div className="overflow-hidden w-full">
                <div className="flex items-center gap-1 mb-1">
                <p className="text-[10px] text-neutral-400">
                  {language === "ko" ? "훅 분석" : "Hook Analysis"}
                </p>
                <InfoButton
                  content={language === "ko"
                    ? "영상의 첫 장면이나 시작 부분을 분석한 결과입니다. 시청자의 관심을 끄는 핵심 요소를 파악하여 더 효과적인 도입부를 만들 수 있어요."
                    : "Analysis of the video's opening scene. Identifies key elements that capture viewer attention to help create more effective intros."}
                  size="sm"
                />
              </div>
                <p className="text-xs text-neutral-600 line-clamp-3 break-all whitespace-normal">
                  {videoSource.aiAnalysis.hookAnalysis}
                </p>
              </div>
            )}

            {/* Style Analysis */}
            {videoSource.aiAnalysis.styleAnalysis && (
              <div className="overflow-hidden w-full">
                <div className="flex items-center gap-1 mb-1">
                <p className="text-[10px] text-neutral-400">
                  {language === "ko" ? "스타일 분석" : "Style Analysis"}
                </p>
                <InfoButton
                  content={language === "ko"
                    ? "영상의 전반적인 시각적 스타일, 색감, 분위기, 촬영 기법 등을 분석한 결과입니다. 비슷한 느낌의 콘텐츠를 만드는 데 참고할 수 있어요."
                    : "Analysis of the video's overall visual style, colors, mood, and filming techniques. Use as reference to create content with similar vibes."}
                  size="sm"
                />
              </div>
                <p className="text-xs text-neutral-600 line-clamp-3 break-all whitespace-normal">
                  {videoSource.aiAnalysis.styleAnalysis}
                </p>
              </div>
            )}

            {/* Concept Details */}
            {videoSource.aiAnalysis.conceptDetails && (
              <div className="overflow-hidden w-full">
                <div className="flex items-center gap-1 mb-1">
                <p className="text-[10px] text-neutral-400">
                  {language === "ko" ? "컨셉 요소" : "Concept Elements"}
                </p>
                <InfoButton
                  content={language === "ko"
                    ? "영상의 핵심 컨셉 요소들입니다. 비주얼 스타일(시각적 특징), 무드(분위기), 페이스(영상 속도감)를 태그로 정리했습니다."
                    : "Key concept elements of the video. Summarizes visual style, mood, and pace as tags for quick reference."}
                  size="sm"
                />
              </div>
                <div className="flex flex-wrap gap-1 w-full overflow-hidden">
                  {videoSource.aiAnalysis.conceptDetails.visualStyle && (
                    <Badge variant="outline" className="text-[10px] border-neutral-300 text-neutral-600 max-w-[calc(100%-8px)] truncate">
                      {videoSource.aiAnalysis.conceptDetails.visualStyle}
                    </Badge>
                  )}
                  {videoSource.aiAnalysis.conceptDetails.mood && (
                    <Badge variant="outline" className="text-[10px] border-neutral-300 text-neutral-600 max-w-[calc(100%-8px)] truncate">
                      {videoSource.aiAnalysis.conceptDetails.mood}
                    </Badge>
                  )}
                  {videoSource.aiAnalysis.conceptDetails.pace && (
                    <Badge variant="outline" className="text-[10px] border-neutral-300 text-neutral-600 max-w-[calc(100%-8px)] truncate">
                      {videoSource.aiAnalysis.conceptDetails.pace}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Suggested Approach */}
            {videoSource.aiAnalysis.suggestedApproach && (
              <div className="overflow-hidden w-full">
                <div className="flex items-center gap-1 mb-1">
                <p className="text-[10px] text-neutral-400">
                  {language === "ko" ? "추천 접근법" : "Suggested Approach"}
                </p>
                <InfoButton
                  content={language === "ko"
                    ? "이 영상 스타일을 활용한 콘텐츠 제작 방향을 AI가 제안합니다. 비슷한 분위기와 구성으로 새로운 콘텐츠를 만들 때 참고하세요."
                    : "AI-suggested approach for creating content using this video's style. Reference when making new content with similar mood and composition."}
                  size="sm"
                />
              </div>
                <p className="text-xs text-neutral-600 line-clamp-3 break-all whitespace-normal">
                  {videoSource.aiAnalysis.suggestedApproach}
                </p>
              </div>
            )}

            {/* Video Recreation Prompt Generator - Hidden: Now auto-generates recreation ideas via VideoRecreationIdeaAgent */}
          </div>
        )}

        {/* AI Trend Insights (for trend source) */}
        {!isVideoSource && aiInsights && (
          <div className="pt-2 border-t border-neutral-200 space-y-2 w-full overflow-hidden">
            <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
              {language === "ko" ? "AI 트렌드 인사이트" : "AI Trend Insights"}
            </p>

            {/* Content Strategy */}
            {aiInsights.contentStrategy && aiInsights.contentStrategy.length > 0 && (
              <div>
                <p className="text-[10px] text-neutral-400 mb-1">
                  {language === "ko" ? "콘텐츠 전략" : "Content Strategy"}
                </p>
                <ul className="text-xs text-neutral-600 space-y-0.5">
                  {aiInsights.contentStrategy.slice(0, 3).map((strategy, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-neutral-400">•</span>
                      <span className="line-clamp-1">{strategy}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Video Ideas */}
            {aiInsights.videoIdeas && aiInsights.videoIdeas.length > 0 && (
              <div>
                <p className="text-[10px] text-neutral-400 mb-1">
                  {language === "ko" ? "영상 아이디어" : "Video Ideas"}
                </p>
                <ul className="text-xs text-neutral-600 space-y-0.5">
                  {aiInsights.videoIdeas.slice(0, 2).map((idea, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-neutral-400">•</span>
                      <span className="line-clamp-1">{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Audience Insights */}
            {aiInsights.audienceInsights && (
              <div>
                <p className="text-[10px] text-neutral-400 mb-1">
                  {language === "ko" ? "타겟 오디언스" : "Target Audience"}
                </p>
                <p className="text-xs text-neutral-600 line-clamp-3">
                  {aiInsights.audienceInsights}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
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
}: {
  idea: ContentIdea;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { language } = useI18n();

  const typeIcon = idea.type === "ai_video" ? Video : ImageIcon;
  const TypeIcon = typeIcon;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all cursor-pointer",
        isSelected
          ? "border-neutral-900 bg-white"
          : "border-neutral-200 hover:border-neutral-300 bg-white"
      )}
    >
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
            {/* Recreation Badge - shows when idea is video recreation */}
            {idea.isRecreationIdea && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] shrink-0 cursor-help border-purple-500 text-purple-600 bg-purple-50"
                  >
                    <Video className="h-2.5 w-2.5 mr-0.5" />
                    {language === "ko" ? "재현" : "Recreate"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">
                    {language === "ko"
                      ? "원본 영상의 스타일을 재현하는 아이디어입니다. 비슷한 분위기와 비주얼로 새로운 콘텐츠를 만들 수 있어요."
                      : "This idea recreates the original video's style. Create new content with similar mood and visuals."}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] shrink-0 cursor-help",
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
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">
                  {language === "ko"
                    ? idea.estimatedEngagement === "high"
                      ? "트렌드 데이터 기반 예상 참여도가 높습니다. 바이럴 가능성이 큰 아이디어예요."
                      : idea.estimatedEngagement === "medium"
                      ? "보통 수준의 예상 참여도입니다. 안정적인 성과가 기대됩니다."
                      : "예상 참여도가 낮습니다. 차별화 전략이 필요할 수 있어요."
                    : idea.estimatedEngagement === "high"
                    ? "High estimated engagement based on trend data. This idea has strong viral potential."
                    : idea.estimatedEngagement === "medium"
                    ? "Moderate estimated engagement. Steady performance is expected."
                    : "Lower estimated engagement. May need differentiation strategy."}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-neutral-500 mb-2 line-clamp-2">{idea.hook}</p>
          <div className="flex items-center gap-3 text-[10px] text-neutral-500">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 cursor-help">
                  <Clock className="h-3 w-3" />
                  {idea.type === "ai_video"
                    ? language === "ko"
                      ? "AI 영상"
                      : "AI Video"
                    : language === "ko"
                    ? "컴포즈"
                    : "Compose"}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px]">
                <p className="text-xs">
                  {language === "ko"
                    ? idea.type === "ai_video"
                      ? "AI가 이미지와 영상을 생성합니다. 창의적인 비주얼이 필요한 콘텐츠에 적합해요."
                      : "기존 영상 소스를 조합하여 편집합니다. 빠른 제작이 가능해요."
                    : idea.type === "ai_video"
                    ? "AI generates images and videos. Best for content requiring creative visuals."
                    : "Combines existing video sources for editing. Enables quick production."}
                </p>
              </TooltipContent>
            </Tooltip>
            {idea.suggestedMusic && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help">
                    <Music className="h-3 w-3" />
                    {idea.suggestedMusic.bpm} BPM
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px]">
                  <p className="text-xs">
                    {language === "ko"
                      ? `추천 음악 템포입니다. ${idea.suggestedMusic.bpm} BPM은 ${
                          idea.suggestedMusic.bpm < 100
                            ? "차분하고 감성적인"
                            : idea.suggestedMusic.bpm < 120
                            ? "적당한 에너지의"
                            : "빠르고 역동적인"
                        } 분위기에 적합해요.`
                      : `Recommended music tempo. ${idea.suggestedMusic.bpm} BPM suits ${
                          idea.suggestedMusic.bpm < 100
                            ? "calm, emotional"
                            : idea.suggestedMusic.bpm < 120
                            ? "moderate energy"
                            : "fast, dynamic"
                        } moods.`}
                  </p>
                </TooltipContent>
              </Tooltip>
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
  const searchParams = useSearchParams();

  // Sync workflow stage
  useWorkflowSync("analyze");
  const { goToStart, proceedToCreate, canProceedToCreate } = useWorkflowNavigation();

  // Session sync for persisted state management
  const sessionId = searchParams.get("session");
  const { activeSession, syncNow } = useSessionWorkflowSync("analyze");

  // Workflow store - using start state (migrated from discover)
  const start = useWorkflowStore((state) => state.start);
  const analyze = useWorkflowStore((state) => state.analyze);
  const startSource = start.source;
  const startContentType = start.contentType;

  // Extract keywords from start.source based on source type
  const startKeywords = (() => {
    const source = startSource;
    if (!source) return [];
    switch (source.type) {
      case "trends":
        return source.keywords || [];
      case "idea":
        return source.keywords || [];
      case "video":
        return source.hashtags || [];
      default:
        return [];
    }
  })();
  const setAnalyzeUserIdea = useWorkflowStore((state) => state.setAnalyzeUserIdea);
  const setAnalyzeAiIdeas = useWorkflowStore((state) => state.setAnalyzeAiIdeas);
  const selectAnalyzeIdea = useWorkflowStore((state) => state.selectAnalyzeIdea);
  const setAnalyzeOptimizedPrompt = useWorkflowStore((state) => state.setAnalyzeOptimizedPrompt);
  const setAnalyzeHashtags = useWorkflowStore((state) => state.setAnalyzeHashtags);

  // Local state
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize hashtags from start state (migrated from discover)
  useEffect(() => {
    if (start.selectedHashtags.length > 0 && analyze.hashtags.length === 0) {
      setAnalyzeHashtags(start.selectedHashtags);
    }
  }, [start.selectedHashtags, analyze.hashtags, setAnalyzeHashtags]);

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
      // In recreation mode, ignore trend data to focus on recreating the exact video concept
      const isRecreationMode = analyze.isRecreationMode;

      // Transform saved inspiration to include rich content data (skip in recreation mode)
      let inspirationVideos: InspirationVideo[] = [];
      let trendInsights: TrendInsights | undefined = undefined;

      if (!isRecreationMode) {
        // Use start.savedInspiration (migrated from discover)
        inspirationVideos = start.savedInspiration.map((video) => ({
          id: video.id,
          description: video.description,
          hashtags: video.hashtags,
          stats: video.stats,
          engagementRate: video.engagementRate,
        }));

        // Also include viral videos from trend analysis (from start.source when type is trends)
        const trendAnalysisVideos = startSource?.type === "trends" ? startSource.analysis.viralVideos : [];
        if (trendAnalysisVideos.length > 0) {
          trendAnalysisVideos.forEach((video) => {
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

        // Extract AI insights from start state (migrated from discover)
        trendInsights = start.aiInsights ? {
          summary: start.aiInsights.summary,
          contentStrategy: start.aiInsights.contentStrategy,
          videoIdeas: start.aiInsights.videoIdeas,
          targetAudience: start.aiInsights.targetAudience,
          bestPostingTimes: start.aiInsights.bestPostingTimes,
        } : undefined;
      }

      // Check if started from video
      const isVideoSource = startSource?.type === "video";
      const videoSource = isVideoSource ? startSource as StartFromVideo : null;

      const request: GenerateIdeasRequest = {
        user_idea: analyze.userIdea,
        // In recreation mode, don't send keywords/hashtags to avoid diluting the exact concept
        keywords: isRecreationMode ? [] : startKeywords,
        hashtags: isRecreationMode ? [] : analyze.hashtags,
        target_audience: analyze.targetAudience,
        content_goals: analyze.contentGoals,
        campaign_description: analyze.campaignDescription,  // Central context for prompts - campaign concept/goal
        genre: analyze.campaignGenre,  // Music genre for viral content generation
        // Pass rich trend data only in non-recreation mode
        inspiration_videos: inspirationVideos,
        trend_insights: trendInsights,
        performance_metrics: isRecreationMode ? null : start.performanceMetrics,
        language: language,
        // Content type - user-selected at Start stage
        contentType: startContentType,
        // Video analysis data for recreation ideas (when started from video)
        video_analysis: videoSource?.aiAnalysis || null,
        video_description: videoSource?.description || null,
        video_hashtags: videoSource?.hashtags || null,
      };

      const response = await api.post<GenerateIdeasResponse>(
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
    generateIdeas: language === "ko" ? "AI 아이디어 생성" : "Generate AI Ideas",
    generating: language === "ko" ? "생성 중..." : "Generating...",
    aiIdeas: language === "ko" ? "AI 콘텐츠 아이디어" : "AI Content Ideas",
    selectedIdea: language === "ko" ? "선택된 아이디어" : "Selected Idea",
    proceed: language === "ko" ? "생성 단계로" : "Proceed to Create",
    back: language === "ko" ? "발견으로" : "Back to Discover",
  };

  return (
    <TooltipProvider>
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <WorkflowHeader
        onBack={goToStart}
        onNext={handleProceedToCreate}
        canProceed={canProceedToCreate}
      />

      {/* Main Content - Two Column */}
      <div className="flex-1 flex overflow-hidden px-[5%]">
        {/* Left Column - Input */}
        <div className="flex-[55] min-w-0 border-r border-neutral-200 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-4 pr-6 space-y-4 overflow-hidden box-border">
              {/* Context from Discover */}
              <ContextReceptionPanel />

              {/* User Idea Input */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Label className="text-xs font-medium text-neutral-700">
                    {t.yourIdea}
                  </Label>
                  <InfoButton
                    content={language === "ko"
                      ? "만들고 싶은 영상에 대한 아이디어를 자유롭게 입력하세요. AI가 트렌드 데이터와 함께 분석하여 최적화된 콘텐츠 아이디어를 제안합니다. 구체적일수록 더 좋은 결과를 얻을 수 있어요."
                      : "Freely describe your video idea. AI will analyze it with trend data to suggest optimized content ideas. The more specific, the better results you'll get."}
                    side="bottom"
                  />
                </div>
                <textarea
                  value={analyze.userIdea}
                  onChange={(e) => setAnalyzeUserIdea(e.target.value)}
                  placeholder={t.ideaPlaceholder}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 resize-none"
                />
              </div>

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
        <div className="flex-[45] min-w-0 flex flex-col bg-neutral-50 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-neutral-900" />
                {t.aiIdeas}
              </h2>
              {/* Content Type Badge - shows user-selected type from Start stage */}
              <Badge variant="outline" className="text-xs bg-neutral-100 text-neutral-600 border-neutral-300">
                {startContentType === "fast-cut" ? (
                  <>
                    <ImageIcon className="h-3 w-3 mr-1" />
                    {language === "ko" ? "Fast Cut" : "Fast Cut"}
                  </>
                ) : (
                  <>
                    <Video className="h-3 w-3 mr-1" />
                    {language === "ko" ? "AI Video" : "AI Video"}
                  </>
                )}
              </Badge>
              <InfoButton
                content={language === "ko"
                  ? startContentType === "fast-cut"
                    ? "Fast Cut 모드로 아이디어가 생성됩니다. 이미지 + 음악을 조합한 빠른 편집 영상에 최적화된 아이디어입니다."
                    : "AI가 입력한 정보와 트렌드 데이터를 분석하여 생성한 콘텐츠 아이디어입니다. 원하는 아이디어를 선택하면 다음 단계에서 사용됩니다. 각 아이디어에는 최적화된 프롬프트가 포함되어 있어요."
                  : startContentType === "fast-cut"
                    ? "Ideas will be generated in Fast Cut mode. Optimized for quick-edit videos combining images + music."
                    : "Content ideas generated by AI analyzing your inputs and trend data. Select your preferred idea to use in the next step. Each idea includes an optimized prompt."}
                side="bottom"
              />
            </div>
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
                    />
                  ))}
                </div>
              )}

              {/* Selected Idea Summary */}
              {analyze.selectedIdea && (
                <div className="mt-4 p-4 border border-neutral-300 rounded-lg bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-neutral-900 flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      {t.selectedIdea}
                    </h3>
                    <InfoButton
                      content={language === "ko"
                        ? "선택한 아이디어가 다음 생성 단계에서 사용됩니다. 프롬프트와 해시태그가 자동으로 적용되어 콘텐츠가 생성돼요."
                        : "Your selected idea will be used in the next creation step. The prompt and hashtags will be automatically applied for content generation."
                      }
                      size="sm"
                    />
                  </div>
                  <p className="text-sm text-neutral-700 mb-3">{analyze.selectedIdea.title}</p>
                  <div className="p-3 bg-neutral-100 rounded border border-neutral-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs text-neutral-500">
                        {language === "ko" ? "최적화된 프롬프트" : "Optimized Prompt"}
                      </p>
                      <InfoButton
                        content={language === "ko"
                          ? "AI가 트렌드 데이터와 아이디어를 분석하여 최적화한 영상 생성 프롬프트입니다. 이 프롬프트로 AI 영상이 생성됩니다."
                          : "AI-optimized video generation prompt based on trend data and your idea. This prompt will be used to generate AI videos."
                        }
                        size="sm"
                      />
                    </div>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      {analyze.selectedIdea.optimizedPrompt}
                    </p>
                  </div>
                  {analyze.hashtags.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <p className="text-xs text-neutral-500">
                          {language === "ko" ? "추천 해시태그" : "Recommended Hashtags"}
                        </p>
                        <InfoButton
                          content={language === "ko"
                            ? "트렌드 분석 기반으로 추천된 해시태그입니다. 발행 단계에서 자동으로 적용되어 도달률을 높여줍니다."
                            : "Recommended hashtags based on trend analysis. These will be automatically applied during publishing to increase reach."
                          }
                          size="sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {analyze.hashtags.map((tag) => (
                          <Badge key={tag} className="text-xs bg-neutral-200 text-neutral-700">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
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
                    // Hashtags & keywords (migrated from discover to start)
                    hashtags: analyze.hashtags,
                    keywords: startKeywords,
                    // Performance metrics
                    performanceMetrics: start.performanceMetrics,
                    // Saved inspiration (thumbnails & stats only)
                    savedInspiration: start.savedInspiration.map((v) => ({
                      id: v.id,
                      thumbnailUrl: v.thumbnailUrl,
                      stats: v.stats,
                    })),
                    // Target audience & goals
                    targetAudience: analyze.targetAudience,
                    contentGoals: analyze.contentGoals,
                    // AI insights
                    aiInsights: start.aiInsights,
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

      {/* Footer with navigation */}
      <WorkflowFooter
        onBack={goToStart}
        onNext={handleProceedToCreate}
        canProceed={canProceedToCreate}
        actionButton={{
          label: t.proceed,
          onClick: handleProceedToCreate,
          disabled: !canProceedToCreate,
          icon: <ArrowRight className="h-4 w-4" />,
        }}
      />
    </div>
    </TooltipProvider>
  );
}
