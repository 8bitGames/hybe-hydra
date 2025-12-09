"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";
import {
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Sparkles,
  Clock,
  FolderOpen,
  Video,
  Hash,
  X,
  ExternalLink,
  ImageIcon,
  Layers,
  Palette,
  Camera,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore, useWorkflowHydrated } from "@/lib/stores/workflow-store";
import { InfoButton } from "@/components/ui/info-button";
import { cn } from "@/lib/utils";

interface RecentProject {
  id: string;
  name: string;
  type: "trends" | "video" | "idea";
  status: "in_progress" | "completed";
  updatedAt: string;
  thumbnail?: string;
}

// Helper to get access token from Zustand persisted storage
function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("hydra-auth-storage");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.state?.accessToken || null;
  } catch {
    return null;
  }
}

// Format count helper
function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export default function StartPage() {
  const router = useRouter();
  const { translate, language } = useI18n();
  const isKorean = language === "ko";
  const hydrated = useWorkflowHydrated();

  const [ideaInput, setIdeaInput] = useState("");
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const {
    start,
    setStartFromIdea,
    setCurrentStage,
    clearStartData,
    transferToAnalyze,
    updateVideoAiAnalysis,
  } = useWorkflowStore();

  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const startSource = start.source;

  // Load recent campaigns/projects
  useEffect(() => {
    async function loadRecentProjects() {
      try {
        const token = getAccessToken();
        if (!token) {
          setIsLoadingProjects(false);
          return;
        }

        const response = await fetch("/api/v1/campaigns?limit=5&sort=updatedAt", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const projects: RecentProject[] = (data.campaigns || []).map((c: {
            id: string;
            name: string;
            status: string;
            updatedAt: string;
          }) => ({
            id: c.id,
            name: c.name,
            type: "idea" as const,
            status: c.status === "COMPLETED" ? "completed" : "in_progress",
            updatedAt: c.updatedAt,
          }));
          setRecentProjects(projects);
        }
      } catch (error) {
        console.error("Failed to load recent projects:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    }

    if (hydrated) {
      loadRecentProjects();
    }
  }, [hydrated]);

  // Auto-analyze video when source is video type without aiAnalysis
  useEffect(() => {
    async function analyzeVideo() {
      if (!startSource || startSource.type !== "video") return;
      if (startSource.aiAnalysis) return; // Already analyzed
      if (isAnalyzingVideo) return; // Already in progress

      setIsAnalyzingVideo(true);
      setAnalysisError(null);

      try {
        const token = getAccessToken();
        const response = await fetch("/api/v1/analyze-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ url: startSource.videoUrl }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to analyze video");
        }

        // Map API response to store's aiAnalysis format
        const { style_analysis, content_analysis, suggested_prompt, isComposeVideo, imageCount, conceptDetails } = data.data;

        const aiAnalysis: {
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
        } = {};

        // Build styleAnalysis from style_analysis
        if (style_analysis) {
          const styleParts: string[] = [];
          if (style_analysis.visual_style) styleParts.push(style_analysis.visual_style);
          if (style_analysis.mood) styleParts.push(`Mood: ${style_analysis.mood}`);
          if (style_analysis.pace) styleParts.push(`Pace: ${style_analysis.pace}`);
          if (style_analysis.lighting) styleParts.push(`Lighting: ${style_analysis.lighting}`);
          if (style_analysis.camera_movement?.length > 0) {
            styleParts.push(`Camera: ${style_analysis.camera_movement.join(", ")}`);
          }
          if (style_analysis.effects?.length > 0) {
            styleParts.push(`Effects: ${style_analysis.effects.join(", ")}`);
          }
          aiAnalysis.styleAnalysis = styleParts.join(". ");
        }

        // Build structureAnalysis from content_analysis
        if (content_analysis) {
          const contentParts: string[] = [];
          if (content_analysis.main_subject) contentParts.push(`Subject: ${content_analysis.main_subject}`);
          if (content_analysis.setting) contentParts.push(`Setting: ${content_analysis.setting}`);
          if (content_analysis.actions?.length > 0) {
            contentParts.push(`Actions: ${content_analysis.actions.join(", ")}`);
          }
          if (content_analysis.props?.length > 0) {
            contentParts.push(`Props: ${content_analysis.props.join(", ")}`);
          }
          aiAnalysis.structureAnalysis = contentParts.join(". ");
        }

        // Build hookAnalysis from first few elements
        if (style_analysis || content_analysis) {
          const hookParts: string[] = [];
          if (content_analysis?.main_subject) hookParts.push(content_analysis.main_subject);
          if (style_analysis?.visual_style) hookParts.push(style_analysis.visual_style);
          if (content_analysis?.actions?.[0]) hookParts.push(content_analysis.actions[0]);
          aiAnalysis.hookAnalysis = hookParts.join(" - ");
        }

        // suggestedApproach from suggested_prompt
        if (suggested_prompt) {
          aiAnalysis.suggestedApproach = suggested_prompt;
        }

        // Add compose video detection
        if (isComposeVideo !== undefined) {
          aiAnalysis.isComposeVideo = isComposeVideo;
        }
        if (imageCount !== undefined) {
          aiAnalysis.imageCount = imageCount;
        }

        // Add detailed concept for recreation
        if (conceptDetails) {
          aiAnalysis.conceptDetails = conceptDetails;
        }

        // Update the store
        updateVideoAiAnalysis(aiAnalysis);
        console.log("[START] Video analysis complete:", aiAnalysis);
      } catch (error) {
        console.error("[START] Video analysis failed:", error);
        setAnalysisError(error instanceof Error ? error.message : "Analysis failed");
      } finally {
        setIsAnalyzingVideo(false);
      }
    }

    if (hydrated && startSource?.type === "video" && !startSource.aiAnalysis) {
      analyzeVideo();
    }
  }, [hydrated, startSource, isAnalyzingVideo, updateVideoAiAnalysis, retryCount]);

  // Handle direct idea input
  const handleIdeaSubmit = () => {
    if (!ideaInput.trim()) return;

    clearStartData();
    setStartFromIdea({ idea: ideaInput.trim() });
    setCurrentStage("analyze");
    router.push("/analyze");
  };

  // Navigate to trend dashboard
  const handleTrendStart = () => {
    router.push("/trend-dashboard");
  };

  // Continue with existing campaign
  const handleContinueProject = (projectId: string) => {
    router.push(`/campaigns/${projectId}`);
  };

  // Clear selected source and go back to entry selection
  const handleClearSource = () => {
    clearStartData();
  };

  // Proceed to analyze with current data
  const handleProceedToAnalyze = () => {
    transferToAnalyze();
    setCurrentStage("analyze");
    router.push("/analyze");
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return isKorean ? "방금 전" : "Just now";
    if (diffHours < 24) return isKorean ? `${diffHours}시간 전` : `${diffHours}h ago`;
    if (diffDays < 7) return isKorean ? `${diffDays}일 전` : `${diffDays}d ago`;
    return date.toLocaleDateString(isKorean ? "ko-KR" : "en-US");
  };

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">
          {translate("startPage.loading")}
        </div>
      </div>
    );
  }

  // Check if we can proceed to analyze
  const canProceedToAnalyze = startSource !== null || ideaInput.trim().length > 0;

  // Handle proceed action
  const handleProceed = () => {
    if (ideaInput.trim()) {
      handleIdeaSubmit();
    } else if (startSource) {
      handleProceedToAnalyze();
    }
  };

  // If we have a source from trend dashboard, show the preview
  if (startSource) {
    return (
      <div className="flex flex-col bg-background min-h-full">
        {/* Workflow Header */}
        <WorkflowHeader
          onNext={handleProceedToAnalyze}
          canProceed={true}
        />

        {/* Content Area */}
        <div>
          <div className="container max-w-4xl mx-auto py-8 px-4">
            {/* Trend Data Preview */}
            {startSource.type === "trends" && (
              <div className="space-y-4">
                {/* Header Card */}
                <Card className="border border-neutral-200 bg-neutral-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-neutral-200">
                          <TrendingUp className="h-6 w-6 text-neutral-700" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {translate("startPage.entryPaths.trends.title")}
                          </CardTitle>
                          <CardDescription>
                            {startSource.keywords.map(k => `#${k}`).join(", ")}
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleClearSource}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                {/* All Hashtags - Scrollable */}
                {startSource.analysis.topHashtags.length > 0 && (
                  <Card className="border border-neutral-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">
                          {isKorean ? "추천 해시태그" : "Recommended Hashtags"}
                          <span className="ml-2 text-muted-foreground font-normal">
                            ({startSource.analysis.topHashtags.length})
                          </span>
                        </CardTitle>
                        <InfoButton
                          content={isKorean
                            ? "분석된 바이럴 영상들에서 가장 많이 사용된 해시태그입니다. 발행 단계에서 자동으로 적용되며, 도달률과 노출을 높이는 데 도움이 됩니다."
                            : "Most frequently used hashtags from analyzed viral videos. These will be automatically applied during publishing to help increase reach and exposure."
                          }
                          side="right"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[160px] overflow-y-auto">
                        <div className="flex flex-wrap gap-2">
                          {startSource.analysis.topHashtags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        {isKorean
                          ? "이 해시태그들은 콘텐츠 발행 시 자동으로 적용됩니다"
                          : "These hashtags will be automatically applied when publishing"}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Trend Analysis Results - Main Card */}
                {start.aiInsights && (
                  <Card className="border border-neutral-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">
                          {isKorean ? "트렌드 분석 결과" : "Trend Analysis Results"}
                        </CardTitle>
                        <InfoButton
                          content={isKorean
                            ? "AI가 바이럴 영상들을 분석하여 추출한 인사이트입니다. 다음 단계에서 콘텐츠 아이디어 생성과 스크립트 작성에 활용됩니다."
                            : "AI-generated insights from analyzing viral videos. These will be used in the next step for content ideation and script generation."
                          }
                          side="right"
                        />
                      </div>
                      <CardDescription className="text-xs">
                        {isKorean
                          ? `${startSource.analysis.viralVideos.length}개 바이럴 영상 분석 기반`
                          : `Based on ${startSource.analysis.viralVideos.length} viral videos analyzed`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Summary - Key Trend Insight */}
                      {start.aiInsights.summary && (
                        <div className="p-3 bg-neutral-50 rounded-lg">
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "핵심 인사이트" : "Key Insight"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "분석된 영상들의 공통점과 핵심 성공 요인을 요약한 내용입니다. 콘텐츠 기획의 방향성을 잡는 데 참고하세요."
                                : "A summary of common patterns and key success factors from analyzed videos. Use this as a guide for content planning direction."
                              }
                              size="sm"
                            />
                          </div>
                          <p className="text-sm">{start.aiInsights.summary}</p>
                        </div>
                      )}

                      {/* Content Strategy - Patterns Found */}
                      {start.aiInsights.contentStrategy && start.aiInsights.contentStrategy.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "발견된 성공 패턴" : "Success Patterns Found"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "바이럴 영상들에서 반복적으로 나타나는 성공적인 콘텐츠 패턴입니다. 스크립트와 영상 구성에 직접 반영됩니다."
                                : "Recurring successful content patterns found in viral videos. These will be directly applied to script and video composition."
                              }
                              size="sm"
                            />
                          </div>
                          <ul className="space-y-1.5">
                            {start.aiInsights.contentStrategy.slice(0, 4).map((strategy, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="text-neutral-400 font-medium">{idx + 1}.</span>
                                <span>{strategy}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Hashtag Strategy */}
                      {start.aiInsights.hashtagStrategy && start.aiInsights.hashtagStrategy.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "해시태그 전략" : "Hashtag Strategy"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "효과적인 해시태그 사용법에 대한 가이드입니다. 발행 시 해시태그 조합과 순서를 결정하는 데 참고됩니다."
                                : "Guidelines for effective hashtag usage. This helps determine the combination and order of hashtags when publishing."
                              }
                              size="sm"
                            />
                          </div>
                          <ul className="space-y-1">
                            {start.aiInsights.hashtagStrategy.slice(0, 2).map((strategy, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-neutral-400">•</span>
                                <span>{strategy}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Video Ideas - Actionable */}
                      {start.aiInsights.videoIdeas && start.aiInsights.videoIdeas.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "추천 콘텐츠 방향" : "Recommended Content Direction"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "트렌드에 맞는 구체적인 영상 아이디어입니다. 다음 단계에서 AI 아이디어 생성의 기반 자료로 활용됩니다."
                                : "Specific video ideas based on current trends. These serve as foundation for AI idea generation in the next step."
                              }
                              size="sm"
                            />
                          </div>
                          <ul className="space-y-1.5">
                            {start.aiInsights.videoIdeas.slice(0, 3).map((idea, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-neutral-400 flex-shrink-0" />
                                <span>{idea}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Audience Insights */}
                      {start.aiInsights.audienceInsights && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "타겟 오디언스" : "Target Audience"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "이 트렌드에 가장 반응이 좋은 시청자 그룹입니다. 콘텐츠 톤앤매너와 메시지 전달 방식을 결정하는 데 활용됩니다."
                                : "The viewer demographic most responsive to this trend. Used to determine content tone and messaging approach."
                              }
                              size="sm"
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">{start.aiInsights.audienceInsights}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Reference Videos - Collapsible/Minimal */}
                {startSource.analysis.viralVideos.length > 0 && (
                  <Card className="border border-neutral-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">
                          {isKorean ? "분석된 영상" : "Analyzed Videos"}
                          <span className="ml-2 text-muted-foreground font-normal">
                            ({startSource.analysis.viralVideos.length})
                          </span>
                        </CardTitle>
                        <InfoButton
                          content={isKorean
                            ? "위 인사이트들이 도출된 원본 바이럴 영상들입니다. 영감 영상으로 다음 단계에 전달되어 콘텐츠 스타일 참고용으로 활용됩니다."
                            : "The original viral videos from which the above insights were derived. These are passed to the next step as inspiration for content style reference."
                          }
                          side="right"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {startSource.analysis.viralVideos.slice(0, 5).map((video) => (
                          <div
                            key={video.id}
                            className="flex-shrink-0 w-[120px] p-2 bg-neutral-50 rounded-lg text-center"
                          >
                            <p className="text-xs font-medium truncate">@{video.author.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCount(video.stats.playCount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Video Data Preview */}
            {startSource.type === "video" && (
              <div className="space-y-4">
                {/* Header Card */}
                <Card className="border border-neutral-200 bg-neutral-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-neutral-200">
                          <Video className="h-6 w-6 text-neutral-700" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {translate("startPage.entryPaths.video.title")}
                          </CardTitle>
                          <CardDescription>
                            @{startSource.author.name}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(startSource.videoUrl, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          {isKorean ? "원본 보기" : "View Original"}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleClearSource}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Video Description - if exists */}
                {startSource.description && (
                  <Card className="border border-neutral-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-medium">
                          {isKorean ? "영상 설명" : "Video Description"}
                        </CardTitle>
                        <InfoButton
                          content={isKorean
                            ? "원본 영상의 캡션입니다. 콘텐츠 톤앤매너와 키워드를 참고하는 데 활용됩니다."
                            : "Caption from the original video. Used as reference for content tone and keywords."
                          }
                          size="sm"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{startSource.description}</p>
                    </CardContent>
                  </Card>
                )}

                {/* All Hashtags - Scrollable */}
                {startSource.hashtags.length > 0 && (
                  <Card className="border border-neutral-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">
                          {isKorean ? "해시태그" : "Hashtags"}
                          <span className="ml-2 text-muted-foreground font-normal">
                            ({startSource.hashtags.length})
                          </span>
                        </CardTitle>
                        <InfoButton
                          content={isKorean
                            ? "원본 영상에 사용된 해시태그입니다. 발행 단계에서 참고용으로 제공되며, 관련 트렌드 파악에 활용됩니다."
                            : "Hashtags used in the original video. These are provided as reference during publishing and help identify related trends."
                          }
                          side="right"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[160px] overflow-y-auto">
                        <div className="flex flex-wrap gap-2">
                          {startSource.hashtags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        {isKorean
                          ? "이 해시태그들이 콘텐츠 생성에 참고됩니다"
                          : "These hashtags will be used as reference for content generation"}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* AI Analysis Loading State */}
                {isAnalyzingVideo && (
                  <Card className="border border-neutral-200">
                    <CardContent className="py-6">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-300 border-t-neutral-600" />
                        <div>
                          <p className="text-sm font-medium">
                            {isKorean ? "영상 분석 중..." : "Analyzing video..."}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isKorean
                              ? "AI가 영상의 스타일과 구조를 분석하고 있습니다"
                              : "AI is analyzing the video's style and structure"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* AI Analysis Error State */}
                {analysisError && !isAnalyzingVideo && (
                  <Card className="border border-red-200 bg-red-50">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <X className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-700">
                            {isKorean ? "분석 실패" : "Analysis Failed"}
                          </p>
                          <p className="text-xs text-red-600 mt-1">{analysisError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => {
                              setAnalysisError(null);
                              setRetryCount((c) => c + 1);
                            }}
                          >
                            {isKorean ? "다시 시도" : "Retry"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Compose Video Recommendation - if detected */}
                {startSource.aiAnalysis?.isComposeVideo && (
                  <Card className="border-2 border-neutral-300 bg-neutral-50">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-neutral-200">
                          <Layers className="h-5 w-5 text-neutral-700" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">
                              {isKorean ? "🎨 Compose 영상 추천" : "🎨 Compose Video Recommended"}
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {isKorean ? "슬라이드쇼" : "Slideshow"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {isKorean
                              ? `이 영상은 ${startSource.aiAnalysis.imageCount || "여러"}개의 이미지로 구성된 슬라이드쇼 형식입니다. Compose 모드를 사용하면 유사한 스타일의 영상을 쉽게 제작할 수 있습니다.`
                              : `This video is a slideshow format composed of ${startSource.aiAnalysis.imageCount || "multiple"} images. Using Compose mode will make it easy to create a video with a similar style.`}
                          </p>
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {isKorean
                                ? `${startSource.aiAnalysis.imageCount || 0}개 이미지 감지됨`
                                : `${startSource.aiAnalysis.imageCount || 0} images detected`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* AI Analysis - if available */}
                {startSource.aiAnalysis && (
                  <Card className="border border-neutral-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">
                          {isKorean ? "영상 분석" : "Video Analysis"}
                        </CardTitle>
                        <InfoButton
                          content={isKorean
                            ? "AI가 원본 영상을 분석하여 추출한 인사이트입니다. 스크립트 작성과 영상 구성에 활용됩니다."
                            : "AI-generated insights from analyzing the original video. These are used for script writing and video composition."
                          }
                          side="right"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {startSource.aiAnalysis.hookAnalysis && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "훅 분석" : "Hook Analysis"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "영상의 첫 3초 구간 분석입니다. 시청자의 주목을 끄는 오프닝 방식을 참고하세요."
                                : "Analysis of the first 3 seconds of the video. Reference this for attention-grabbing opening techniques."
                              }
                              size="sm"
                            />
                          </div>
                          <p className="text-sm">{startSource.aiAnalysis.hookAnalysis}</p>
                        </div>
                      )}
                      {startSource.aiAnalysis.styleAnalysis && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "스타일 분석" : "Style Analysis"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "영상의 전반적인 톤, 편집 스타일, 음악 사용 등을 분석한 내용입니다."
                                : "Analysis of the overall tone, editing style, and music usage in the video."
                              }
                              size="sm"
                            />
                          </div>
                          <p className="text-sm">{startSource.aiAnalysis.styleAnalysis}</p>
                        </div>
                      )}
                      {startSource.aiAnalysis.structureAnalysis && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "구조 분석" : "Structure Analysis"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "영상의 구성, 주제, 배경, 소품 등 콘텐츠 구조를 분석한 내용입니다."
                                : "Analysis of the video's composition, subject, setting, and props."
                              }
                              size="sm"
                            />
                          </div>
                          <p className="text-sm">{startSource.aiAnalysis.structureAnalysis}</p>
                        </div>
                      )}
                      {startSource.aiAnalysis.suggestedApproach && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "추천 접근 방식" : "Suggested Approach"}
                            </p>
                            <InfoButton
                              content={isKorean
                                ? "이 영상을 참고하여 새로운 콘텐츠를 만들 때 권장되는 방향입니다."
                                : "Recommended direction for creating new content based on this video."
                              }
                              size="sm"
                            />
                          </div>
                          <p className="text-sm">{startSource.aiAnalysis.suggestedApproach}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Concept for Recreation - if available */}
                {startSource.aiAnalysis?.conceptDetails && (
                  <Card className="border border-neutral-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">
                          {isKorean ? "컨셉 상세 (재현용)" : "Concept Details (For Recreation)"}
                        </CardTitle>
                        <InfoButton
                          content={isKorean
                            ? "원본 영상과 유사한 컨셉으로 새 영상을 만들 때 참고할 수 있는 상세 정보입니다."
                            : "Detailed information you can reference when creating a new video with a similar concept to the original."
                          }
                          side="right"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Visual Style Section */}
                      <div className="grid grid-cols-2 gap-4">
                        {startSource.aiAnalysis.conceptDetails.visualStyle && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {isKorean ? "비주얼 스타일" : "Visual Style"}
                            </p>
                            <p className="text-sm">{startSource.aiAnalysis.conceptDetails.visualStyle}</p>
                          </div>
                        )}
                        {startSource.aiAnalysis.conceptDetails.mood && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {isKorean ? "분위기" : "Mood"}
                            </p>
                            <p className="text-sm">{startSource.aiAnalysis.conceptDetails.mood}</p>
                          </div>
                        )}
                        {startSource.aiAnalysis.conceptDetails.pace && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {isKorean ? "페이스" : "Pace"}
                            </p>
                            <p className="text-sm">{startSource.aiAnalysis.conceptDetails.pace}</p>
                          </div>
                        )}
                        {startSource.aiAnalysis.conceptDetails.lighting && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {isKorean ? "조명" : "Lighting"}
                            </p>
                            <p className="text-sm">{startSource.aiAnalysis.conceptDetails.lighting}</p>
                          </div>
                        )}
                      </div>

                      {/* Color Palette */}
                      {startSource.aiAnalysis.conceptDetails.colorPalette && startSource.aiAnalysis.conceptDetails.colorPalette.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">
                              {isKorean ? "컬러 팔레트" : "Color Palette"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {startSource.aiAnalysis.conceptDetails.colorPalette.map((color, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {color}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Camera & Effects */}
                      <div className="grid grid-cols-2 gap-4">
                        {startSource.aiAnalysis.conceptDetails.cameraMovement && startSource.aiAnalysis.conceptDetails.cameraMovement.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {isKorean ? "카메라 움직임" : "Camera Movement"}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {startSource.aiAnalysis.conceptDetails.cameraMovement.map((move, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {move}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {startSource.aiAnalysis.conceptDetails.transitions && startSource.aiAnalysis.conceptDetails.transitions.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {isKorean ? "전환 효과" : "Transitions"}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {startSource.aiAnalysis.conceptDetails.transitions.map((trans, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {trans}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Effects */}
                      {startSource.aiAnalysis.conceptDetails.effects && startSource.aiAnalysis.conceptDetails.effects.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {isKorean ? "이펙트" : "Effects"}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {startSource.aiAnalysis.conceptDetails.effects.map((effect, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {effect}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Content Details */}
                      <div className="pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {isKorean ? "콘텐츠 구성" : "Content Composition"}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {startSource.aiAnalysis.conceptDetails.mainSubject && (
                            <div>
                              <p className="text-xs text-muted-foreground">{isKorean ? "주요 피사체" : "Main Subject"}</p>
                              <p className="text-sm">{startSource.aiAnalysis.conceptDetails.mainSubject}</p>
                            </div>
                          )}
                          {startSource.aiAnalysis.conceptDetails.setting && (
                            <div>
                              <p className="text-xs text-muted-foreground">{isKorean ? "배경/장소" : "Setting"}</p>
                              <p className="text-sm">{startSource.aiAnalysis.conceptDetails.setting}</p>
                            </div>
                          )}
                          {startSource.aiAnalysis.conceptDetails.clothingStyle && (
                            <div>
                              <p className="text-xs text-muted-foreground">{isKorean ? "의상 스타일" : "Clothing Style"}</p>
                              <p className="text-sm">{startSource.aiAnalysis.conceptDetails.clothingStyle}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {startSource.aiAnalysis.conceptDetails.actions && startSource.aiAnalysis.conceptDetails.actions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {isKorean ? "동작/액션" : "Actions"}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {startSource.aiAnalysis.conceptDetails.actions.map((action, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {action}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Props */}
                      {startSource.aiAnalysis.conceptDetails.props && startSource.aiAnalysis.conceptDetails.props.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {isKorean ? "소품" : "Props"}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {startSource.aiAnalysis.conceptDetails.props.map((prop, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {prop}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  // Default: Entry selection view
  return (
    <div className="flex flex-col bg-background min-h-full">
      {/* Workflow Header */}
      <WorkflowHeader
        onNext={handleProceed}
        canProceed={canProceedToAnalyze}
      />

      {/* Content Area */}
      <div>
        <div className="container max-w-4xl mx-auto py-8 px-4">
          {/* Direct Idea Input */}
          <Card className="mb-8 border border-neutral-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-neutral-500" />
                <span className="font-medium">
                  {translate("startPage.entryPaths.idea.title")}
                </span>
              </div>
              <Input
                placeholder={
                  isKorean
                    ? "아이디어를 입력하세요 (예: 홈트 루틴, 일상 브이로그)"
                    : "Enter your idea (e.g., home workout routine, daily vlog)"
                }
                value={ideaInput}
                onChange={(e) => setIdeaInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIdeaSubmit()}
                className="w-full"
              />
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-muted-foreground">
                {isKorean ? "또는" : "or"}
              </span>
            </div>
          </div>

          {/* Entry Path Cards */}
          <div className="grid md:grid-cols-1 gap-4 mb-10">
            {/* Trend Dashboard Entry */}
            <Card
              className={cn(
                "cursor-pointer transition-all hover:border-neutral-400 hover:shadow-md",
                "group border-neutral-200"
              )}
              onClick={handleTrendStart}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-neutral-100">
                      <TrendingUp className="h-6 w-6 text-neutral-700" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {translate("startPage.entryPaths.trends.title")}
                      </CardTitle>
                      <CardDescription>
                        {translate("startPage.entryPaths.trends.description")}
                      </CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {isKorean ? "키워드 분석" : "Keyword Analysis"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {isKorean ? "바이럴 영상" : "Viral Videos"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {isKorean ? "해시태그 트렌드" : "Hashtag Trends"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">
                  {translate("startPage.recentProjects.title")}
                </h2>
              </div>
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleContinueProject(project.id)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded bg-neutral-100">
                            {project.type === "trends" ? (
                              <TrendingUp className="h-4 w-4 text-neutral-600" />
                            ) : project.type === "video" ? (
                              <Video className="h-4 w-4 text-neutral-600" />
                            ) : (
                              <Lightbulb className="h-4 w-4 text-neutral-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{project.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatRelativeTime(project.updatedAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={project.status === "completed" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {project.status === "completed"
                              ? translate("startPage.recentProjects.status.completed")
                              : translate("startPage.recentProjects.status.inProgress")}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            {translate("startPage.recentProjects.continueWork")}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* View All Campaigns Link */}
              <div className="mt-4 text-center">
                <Button
                  variant="link"
                  className="text-sm text-muted-foreground"
                  onClick={() => router.push("/campaigns")}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  {isKorean ? "모든 캠페인 보기" : "View All Campaigns"}
                </Button>
              </div>
            </div>
          )}

          {/* Empty State for Recent Projects */}
          {!isLoadingProjects && recentProjects.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {translate("startPage.recentProjects.empty")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
