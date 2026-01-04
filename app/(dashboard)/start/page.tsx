"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowHeader, WorkflowFooter } from "@/components/workflow/WorkflowHeader";
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
  Link,
  Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore, useWorkflowHydrated } from "@/lib/stores/workflow-store";
import { useSessionWorkflowSync } from "@/lib/stores/session-workflow-sync";
import { InfoButton } from "@/components/ui/info-button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// TikTok URL detection helper
function detectTikTokUrl(input: string): { isTikTok: boolean; url: string | null } {
  const trimmed = input.trim();
  // Match various TikTok URL patterns
  const tiktokPatterns = [
    /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i,
    /^https?:\/\/vm\.tiktok\.com\/[\w]+/i,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/i,
    /^https?:\/\/m\.tiktok\.com\/v\/\d+/i,
  ];

  for (const pattern of tiktokPatterns) {
    if (pattern.test(trimmed)) {
      return { isTikTok: true, url: trimmed };
    }
  }

  return { isTikTok: false, url: null };
}

export default function StartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { translate, language } = useI18n();
  const hydrated = useWorkflowHydrated();

  // Session sync for persisted state management
  const sessionId = searchParams.get("session");
  const isNewProject = searchParams.get("new") === "true";
  const { activeSession, syncNow } = useSessionWorkflowSync("start");

  const [ideaInput, setIdeaInput] = useState("");
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // CRITICAL: Handle new project initialization
  // When ?new=true, clear any stale data that might have been hydrated
  useEffect(() => {
    if (isNewProject && hydrated && !isInitialized) {
      console.log("[StartPage] New project detected, ensuring clean state");
      // Clear workflow start data to ensure fresh state
      const workflowStore = useWorkflowStore.getState();
      workflowStore.clearStartData();
      setIsInitialized(true);

      // Remove the ?new=true from URL to prevent re-clearing on refresh
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("new");
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    } else if (!isNewProject && hydrated) {
      setIsInitialized(true);
    }
  }, [isNewProject, hydrated, isInitialized, router]);

  const {
    start,
    analyze,
    setStartFromIdea,
    setStartFromVideo,
    setStartFromTrends,
    setStartAiInsights,
    setStartContentType,
    setCurrentStage,
    clearStartData,
    transferToAnalyze,
    updateVideoAiAnalysis,
    setAnalyzeCampaign,
  } = useWorkflowStore();

  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [isAnalyzingIdea, setIsAnalyzingIdea] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [inputType, setInputType] = useState<"text" | "tiktok" | null>(null);

  // Campaign state for Fast Cut flow
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(analyze.campaignId);

  // CRITICAL FIX: Sync selectedCampaignId when workflow store's analyze.campaignId changes after session sync
  // This ensures the UI reflects the campaign that was saved in the session
  // Uses ref to track the initial sync to prevent resetting on every render
  const initialCampaignSyncDone = useRef(false);

  useEffect(() => {
    // Wait for hydration before syncing
    if (!hydrated) return;

    // On first sync after hydration, always sync the value (including null)
    // This ensures the UI matches the session state
    if (!initialCampaignSyncDone.current) {
      initialCampaignSyncDone.current = true;
      if (analyze.campaignId !== selectedCampaignId) {
        console.log("[StartPage] Initial sync campaignId from workflow store:", analyze.campaignId);
        setSelectedCampaignId(analyze.campaignId);
      }
      return;
    }

    // After initial sync, only update when analyze.campaignId changes
    if (analyze.campaignId !== selectedCampaignId) {
      console.log("[StartPage] Syncing campaignId from workflow store:", analyze.campaignId);
      setSelectedCampaignId(analyze.campaignId);
    }
  }, [hydrated, analyze.campaignId, selectedCampaignId]);

  const startSource = start.source;

  // Load recent campaigns/projects
  useEffect(() => {
    async function loadRecentProjects() {
      try {
        const response = await fetch("/api/v1/campaigns?limit=5&sort=updatedAt", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          // API returns 'items' key with snake_case fields
          const projects: RecentProject[] = (data.items || []).map((c: {
            id: string;
            name: string;
            status: string;
            updated_at: string;
          }) => ({
            id: c.id,
            name: c.name,
            type: "idea" as const,
            status: c.status === "completed" ? "completed" : "in_progress",
            updatedAt: c.updated_at,
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

  // Load campaigns on page load
  useEffect(() => {
    async function loadCampaigns() {
      if (campaigns.length > 0) return; // Already loaded

      setIsLoadingCampaigns(true);
      try {
        const response = await fetch("/api/v1/campaigns?limit=50&sort=updatedAt", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          // API returns 'items' not 'campaigns'
          const campaignList = (data.items || []).map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          }));
          setCampaigns(campaignList);
        }
      } catch (error) {
        console.error("Failed to load campaigns:", error);
      } finally {
        setIsLoadingCampaigns(false);
      }
    }

    if (hydrated) {
      loadCampaigns();
    }
  }, [hydrated, campaigns.length]);

  // Handle campaign selection
  const handleCampaignSelect = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      setSelectedCampaignId(campaignId);
      setAnalyzeCampaign(campaignId, campaign.name);
      console.log("[StartPage] Selected campaign:", campaign.name);
    }
  };

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
          body: JSON.stringify({
            url: startSource.videoUrl,
            contentType: start.contentType, // Pass contentType for scene analysis
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to analyze video");
        }

        // Map API response to store's aiAnalysis format
        const { style_analysis, content_analysis, suggested_prompt, isComposeVideo, imageCount, conceptDetails, sceneAnalysis } = data.data;

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
          sceneAnalysis?: {
            scenes: { sceneNumber: number; description: string; visualElements: string[]; mood: string; imageKeywords: string[] }[];
            overallStyle: { colorPalette: string[]; lighting: string; mood: string; vibe: 'Exciting' | 'Emotional' | 'Pop' | 'Minimal' };
            totalSceneCount: number;
            isSmooth: boolean;
            recommendedImageCount: number;
            allImageKeywords: string[];
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

        // Add scene analysis for Fast Cut mode
        if (sceneAnalysis) {
          aiAnalysis.sceneAnalysis = sceneAnalysis;
          console.log("[START] Scene analysis received:", sceneAnalysis.totalSceneCount, "scenes,", sceneAnalysis.allImageKeywords.length, "keywords");
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

  // Handle direct idea input - with TikTok URL detection and idea analysis
  const handleIdeaSubmit = async () => {
    const input = ideaInput.trim();
    if (!input) return;

    // Check if it's a TikTok URL
    const { isTikTok, url } = detectTikTokUrl(input);

    if (isTikTok && url) {
      // TikTok URL detected - analyze video
      setInputType("tiktok");
      setIsAnalyzingVideo(true);
      setAnalysisError(null);
      const savedContentType = start.contentType; // Preserve content type selection
      clearStartData();
      if (savedContentType) {
        setStartContentType(savedContentType);
      }

      try {
        const token = getAccessToken();
        const response = await fetch("/api/v1/analyze-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ url, contentType: savedContentType }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to analyze video");
        }

        // Extract video metadata and analysis
        const { metadata, style_analysis, content_analysis, suggested_prompt, isComposeVideo, imageCount, conceptDetails, sceneAnalysis } = data.data;

        // Set video source with all data
        setStartFromVideo({
          videoId: metadata.id,
          videoUrl: url,
          thumbnailUrl: metadata.thumbnail_url,
          description: metadata.description || "",
          hashtags: metadata.hashtags || [],
          basicStats: {
            playCount: metadata.stats?.plays || 0,
            likeCount: metadata.stats?.likes || 0,
            commentCount: metadata.stats?.comments || 0,
            shareCount: metadata.stats?.shares || 0,
            engagementRate: metadata.stats?.plays > 0
              ? ((metadata.stats?.likes || 0) + (metadata.stats?.comments || 0)) / metadata.stats.plays * 100
              : 0,
          },
          author: {
            id: metadata.author?.username || "",
            name: metadata.author?.nickname || metadata.author?.username || "Unknown",
            avatar: metadata.author?.avatar,
          },
          aiAnalysis: buildAiAnalysis(style_analysis, content_analysis, suggested_prompt, isComposeVideo, imageCount, conceptDetails, sceneAnalysis),
        });

        setIdeaInput("");
        // Page will re-render with video preview
      } catch (error) {
        console.error("[START] Video analysis failed:", error);
        setAnalysisError(error instanceof Error ? error.message : "Failed to analyze video");
      } finally {
        setIsAnalyzingVideo(false);
      }
    } else {
      // Regular text - analyze as idea/keyword
      setInputType("text");
      setIsAnalyzingIdea(true);
      setAnalysisError(null);
      const savedContentType = start.contentType; // Preserve content type selection
      clearStartData();
      if (savedContentType) {
        setStartContentType(savedContentType);
      }

      try {
        const token = getAccessToken();

        // Extract keywords from the idea (simple approach: use the input as keyword)
        // You could also use AI to extract keywords, but let's keep it simple
        const keywords = input
          .split(/[\s,]+/)
          .filter(k => k.length > 1)
          .slice(0, 3)
          .map(k => k.toLowerCase().replace(/[^a-z0-9가-힣]/gi, ""));

        // If we have keywords, try to get trend analysis
        if (keywords.length > 0) {
          const response = await fetch(
            `/api/v1/trends/keyword-analysis?keywords=${encodeURIComponent(keywords.join(","))}&limit=20`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          );

          if (response.ok) {
            const data = await response.json();

            if (data.success && data.analyses && data.analyses.length > 0) {
              // Found trend data - use it
              const analysis = data.analyses[0];

              setStartFromTrends({
                keywords: keywords,
                originalIdea: input,  // CRITICAL: Preserve original user input
                analysis: {
                  totalVideos: analysis.totalVideos || 0,
                  avgViews: analysis.aggregateStats?.avgViews || 0,
                  avgEngagement: analysis.aggregateStats?.avgEngagementRate || 0,
                  topHashtags: analysis.hashtagInsights?.topHashtags?.map((h: { tag: string }) => h.tag) || [],
                  viralVideos: (analysis.videos || []).slice(0, 5).map((v: {
                    id: string;
                    videoUrl: string;
                    thumbnailUrl?: string;
                    description?: string;
                    author?: { id?: string; name?: string; avatar?: string };
                    stats?: { playCount?: number; likeCount?: number; commentCount?: number; shareCount?: number };
                    hashtags?: string[];
                    engagementRate?: number;
                  }) => ({
                    id: v.id,
                    videoUrl: v.videoUrl,
                    thumbnailUrl: v.thumbnailUrl || null,
                    description: v.description || "",
                    author: {
                      id: v.author?.id || "",
                      name: v.author?.name || "Unknown",
                      avatar: v.author?.avatar,
                    },
                    stats: {
                      playCount: v.stats?.playCount || 0,
                      likeCount: v.stats?.likeCount || 0,
                      commentCount: v.stats?.commentCount || 0,
                      shareCount: v.stats?.shareCount || 0,
                    },
                    hashtags: v.hashtags || [],
                    engagementRate: v.engagementRate || 0,
                  })),
                },
                selectedHashtags: analysis.hashtagInsights?.recommendedHashtags?.slice(0, 10) || [],
              });

              // Set AI insights if available
              if (analysis.aiInsights) {
                setStartAiInsights({
                  summary: analysis.aiInsights.summary,
                  contentStrategy: analysis.aiInsights.contentStrategy,
                  hashtagStrategy: analysis.aiInsights.hashtagStrategy,
                  captionTemplates: analysis.aiInsights.captionTemplates,
                  videoIdeas: analysis.aiInsights.videoIdeas,
                  bestPostingAdvice: analysis.aiInsights.bestPostingAdvice,
                  audienceInsights: analysis.aiInsights.audienceInsights,
                  trendPrediction: analysis.aiInsights.trendPrediction,
                });
              }

              setIdeaInput("");
              // Page will re-render with trend preview
              return;
            }
          }
        }

        // No trend data found or keywords empty - just set as simple idea and proceed
        setStartFromIdea({ idea: input, keywords });
        setIdeaInput("");
        // CRITICAL: transferToAnalyze() must be called BEFORE syncNow()
        // because it populates analyze.userIdea, analyze.optimizedPrompt from start.source
        // If syncNow() is called first, the analyze data won't be saved to session
        transferToAnalyze();
        syncNow();
        const sessionParam = activeSession?.id ? `?session=${activeSession.id}` : "";
        if (start.contentType === "fast-cut") {
          router.push(`/fast-cut/images${sessionParam}`);
        } else {
          setCurrentStage("analyze");
          router.push(`/analyze${sessionParam}`);
        }
      } catch (error) {
        console.error("[START] Idea analysis failed:", error);
        // Fallback: just set the idea and proceed
        setStartFromIdea({ idea: input });
        setIdeaInput("");
        // CRITICAL: transferToAnalyze() must be called BEFORE syncNow()
        transferToAnalyze();
        syncNow();
        // Route based on content type
        const sessionParamCatch = activeSession?.id ? `?session=${activeSession.id}` : "";
        if (start.contentType === "fast-cut") {
          router.push(`/fast-cut/images${sessionParamCatch}`);
        } else {
          setCurrentStage("analyze");
          router.push(`/analyze${sessionParamCatch}`);
        }
      } finally {
        setIsAnalyzingIdea(false);
      }
    }
  };

  // Helper to build AI analysis from video analysis response
  const buildAiAnalysis = (
    style_analysis: {
      visual_style?: string;
      mood?: string;
      pace?: string;
      lighting?: string;
      camera_movement?: string[];
      effects?: string[];
      color_palette?: string[];
      transitions?: string[];
    } | undefined,
    content_analysis: {
      main_subject?: string;
      setting?: string;
      actions?: string[];
      props?: string[];
      clothing_style?: string;
    } | undefined,
    suggested_prompt: string | undefined,
    isComposeVideo: boolean | undefined,
    imageCount: number | undefined,
    conceptDetails: {
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
    } | undefined,
    sceneAnalysis?: {
      scenes: { sceneNumber: number; description: string; visualElements: string[]; mood: string; imageKeywords: string[] }[];
      overallStyle: { colorPalette: string[]; lighting: string; mood: string; vibe: 'Exciting' | 'Emotional' | 'Pop' | 'Minimal' };
      totalSceneCount: number;
      isSmooth: boolean;
      recommendedImageCount: number;
      allImageKeywords: string[];
    }
  ) => {
    const aiAnalysis: {
      hookAnalysis?: string;
      styleAnalysis?: string;
      structureAnalysis?: string;
      suggestedApproach?: string;
      isComposeVideo?: boolean;
      imageCount?: number;
      conceptDetails?: typeof conceptDetails;
      sceneAnalysis?: typeof sceneAnalysis;
    } = {};

    // Build styleAnalysis from style_analysis
    if (style_analysis) {
      const styleParts: string[] = [];
      if (style_analysis.visual_style) styleParts.push(style_analysis.visual_style);
      if (style_analysis.mood) styleParts.push(`Mood: ${style_analysis.mood}`);
      if (style_analysis.pace) styleParts.push(`Pace: ${style_analysis.pace}`);
      if (style_analysis.lighting) styleParts.push(`Lighting: ${style_analysis.lighting}`);
      if (style_analysis.camera_movement?.length) {
        styleParts.push(`Camera: ${style_analysis.camera_movement.join(", ")}`);
      }
      if (style_analysis.effects?.length) {
        styleParts.push(`Effects: ${style_analysis.effects.join(", ")}`);
      }
      aiAnalysis.styleAnalysis = styleParts.join(". ");
    }

    // Build structureAnalysis from content_analysis
    if (content_analysis) {
      const contentParts: string[] = [];
      if (content_analysis.main_subject) contentParts.push(`Subject: ${content_analysis.main_subject}`);
      if (content_analysis.setting) contentParts.push(`Setting: ${content_analysis.setting}`);
      if (content_analysis.actions?.length) {
        contentParts.push(`Actions: ${content_analysis.actions.join(", ")}`);
      }
      if (content_analysis.props?.length) {
        contentParts.push(`Props: ${content_analysis.props.join(", ")}`);
      }
      aiAnalysis.structureAnalysis = contentParts.join(". ");
    }

    // Build hookAnalysis
    if (style_analysis || content_analysis) {
      const hookParts: string[] = [];
      if (content_analysis?.main_subject) hookParts.push(content_analysis.main_subject);
      if (style_analysis?.visual_style) hookParts.push(style_analysis.visual_style);
      if (content_analysis?.actions?.[0]) hookParts.push(content_analysis.actions[0]);
      aiAnalysis.hookAnalysis = hookParts.join(" - ");
    }

    if (suggested_prompt) {
      aiAnalysis.suggestedApproach = suggested_prompt;
    }

    if (isComposeVideo !== undefined) {
      aiAnalysis.isComposeVideo = isComposeVideo;
    }
    if (imageCount !== undefined) {
      aiAnalysis.imageCount = imageCount;
    }
    if (conceptDetails) {
      aiAnalysis.conceptDetails = conceptDetails;
    }

    if (sceneAnalysis) {
      aiAnalysis.sceneAnalysis = sceneAnalysis;
      console.log("[START] Scene analysis added to aiAnalysis:", sceneAnalysis.totalSceneCount, "scenes,", sceneAnalysis.allImageKeywords.length, "keywords");
    }

    return aiAnalysis;
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

  // Proceed to next step based on content type
  const handleProceedToAnalyze = () => {
    // CRITICAL: transferToAnalyze() must be called BEFORE syncNow()
    // because it sets analyze.optimizedPrompt from start.source.aiAnalysis.suggestedApproach
    // If syncNow() is called first, the optimizedPrompt won't be saved to session
    transferToAnalyze();

    // Sync AFTER transferToAnalyze to include analyze.optimizedPrompt in session data
    syncNow();

    // Route based on content type
    // CRITICAL: Always pass session ID in URL for page refresh support
    const sessionParam = activeSession?.id ? `?session=${activeSession.id}` : "";

    if (start.contentType === "fast-cut") {
      // Fast Cut has its own step indicator, just navigate
      router.push(`/fast-cut/images${sessionParam}`);
    } else {
      // Default: AI Video flow
      setCurrentStage("analyze");
      router.push(`/analyze${sessionParam}`);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return translate("startPage.time.justNow");
    if (diffHours < 24) return translate("startPage.time.hoursAgo").replace("{n}", String(diffHours));
    if (diffDays < 7) return translate("startPage.time.daysAgo").replace("{n}", String(diffDays));
    return date.toLocaleDateString(language === "ko" ? "ko-KR" : "en-US");
  };

  // Show loading state while hydrating or initializing new project
  if (!hydrated || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">
          {translate("startPage.loading")}
        </div>
      </div>
    );
  }

  // Check if we can proceed to analyze (not during loading)
  // Must have: content type selected AND campaign selected AND (has source OR has input)
  const canProceedToAnalyze =
    !isAnalyzingVideo &&
    !isAnalyzingIdea &&
    start.contentType !== null &&
    selectedCampaignId !== null &&
    (startSource !== null || ideaInput.trim().length > 0);

  // Handle proceed action
  const handleProceed = () => {
    if (isAnalyzingVideo || isAnalyzingIdea) return;

    if (ideaInput.trim()) {
      handleIdeaSubmit();
    } else if (startSource) {
      handleProceedToAnalyze();
    }
  };

  // If we have a source from trend dashboard, show the preview
  if (startSource) {
    return (
      <div className="flex flex-col bg-background flex-1 min-h-0">
        {/* Workflow Header */}
        <WorkflowHeader />

        {/* Content Area */}
        <div className="flex-1 overflow-auto min-h-0">
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
                          {translate("startPage.analysis.recommendedHashtags")}
                          <span className="ml-2 text-muted-foreground font-normal">
                            ({startSource.analysis.topHashtags.length})
                          </span>
                        </CardTitle>
                        <InfoButton
                          content={translate("startPage.infoButtons.hashtags")}
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
                        {translate("startPage.analysis.hashtagsAutoApply")}
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
                          {translate("startPage.analysis.trendAnalysisResults")}
                        </CardTitle>
                        <InfoButton
                          content={translate("startPage.infoButtons.trendAnalysis")}
                          side="right"
                        />
                      </div>
                      <CardDescription className="text-xs">
                        {`${startSource.analysis.viralVideos.length} ${translate("startPage.analysis.basedOnVideos")}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Summary - Key Trend Insight */}
                      {start.aiInsights.summary && (
                        <div className="p-3 bg-neutral-50 rounded-lg">
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {translate("startPage.analysis.keyInsight")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.keyInsight")}
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
                              {translate("startPage.analysis.successPatterns")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.successPatterns")}
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
                              {translate("startPage.analysis.hashtagStrategy")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.hashtagStrategy")}
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
                              {translate("startPage.analysis.recommendedDirection")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.recommendedDirection")}
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
                              {translate("startPage.analysis.targetAudience")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.targetAudience")}
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
                          {translate("startPage.analysis.analyzedVideos")}
                          <span className="ml-2 text-muted-foreground font-normal">
                            ({startSource.analysis.viralVideos.length})
                          </span>
                        </CardTitle>
                        <InfoButton
                          content={translate("startPage.infoButtons.analyzedVideos")}
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
                          {translate("startPage.analysis.viewOriginal")}
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
                          {translate("startPage.analysis.videoDescription")}
                        </CardTitle>
                        <InfoButton
                          content={translate("startPage.infoButtons.videoDescription")}
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
                          {translate("startPage.analysis.hashtagsLabel")}
                          <span className="ml-2 text-muted-foreground font-normal">
                            ({startSource.hashtags.length})
                          </span>
                        </CardTitle>
                        <InfoButton
                          content={translate("startPage.infoButtons.hashtagsReference")}
                          side="right"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[160px] overflow-y-auto">
                        <div className="flex flex-wrap gap-2">
                          {startSource.hashtags.map((tag, index) => (
                            <Badge key={`${tag}-${index}`} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        {translate("startPage.analysis.hashtagsReference")}
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
                            {translate("startPage.analysis.analyzingVideoStatus")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {translate("startPage.analysis.analyzingAiStatus")}
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
                            {translate("startPage.analysis.analysisFailed")}
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
                            {translate("startPage.input.retry")}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Selected Content Type Display - shows what was already selected */}
                {start.contentType && !isAnalyzingVideo && (
                  <Card className="border border-neutral-200 bg-neutral-50">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-neutral-900">
                            {start.contentType === "ai_video" ? (
                              <Sparkles className="h-4 w-4 text-white" />
                            ) : (
                              <Layers className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {start.contentType === "ai_video" ? "AI Video" : "Fast Cut"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {start.contentType === "ai_video"
                                ? (language === "ko" ? "AI가 이미지와 영상을 생성합니다" : "AI generates images and videos")
                                : (language === "ko" ? "이미지를 조합해 빠르게 편집합니다" : "Quick editing with image combinations")}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearSource}
                          className="text-xs text-muted-foreground"
                        >
                          {language === "ko" ? "변경" : "Change"}
                        </Button>
                      </div>
                      {/* Slideshow recommendation if detected */}
                      {startSource.aiAnalysis?.isComposeVideo && start.contentType === "ai_video" && (
                        <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200">
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span>
                              {language === "ko"
                                ? `슬라이드쇼 영상이 감지되었습니다. Fast Cut을 추천합니다.`
                                : `Slideshow video detected. Fast Cut is recommended.`}
                            </span>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => setStartContentType("fast-cut")}
                              className="h-auto p-0 text-xs text-amber-700 underline"
                            >
                              {language === "ko" ? "Fast Cut으로 변경" : "Switch to Fast Cut"}
                            </Button>
                          </div>
                        </div>
                      )}
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
                          {translate("startPage.analysis.videoAnalysis")}
                        </CardTitle>
                        <InfoButton
                          content={translate("startPage.infoButtons.videoAnalysis")}
                          side="right"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {startSource.aiAnalysis.hookAnalysis && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {translate("startPage.analysis.hookAnalysis")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.hookAnalysis")}
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
                              {translate("startPage.analysis.styleAnalysis")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.styleAnalysis")}
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
                              {translate("startPage.analysis.structureAnalysis")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.structureAnalysis")}
                              size="sm"
                            />
                          </div>
                          <p className="text-sm">{startSource.aiAnalysis.structureAnalysis}</p>
                        </div>
                      )}
                      {/* Only show AI Video suggested approach when AI Video is selected */}
                      {startSource.aiAnalysis.suggestedApproach && start.contentType === "ai_video" && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {translate("startPage.analysis.suggestedApproach")}
                            </p>
                            <InfoButton
                              content={translate("startPage.infoButtons.suggestedApproach")}
                              size="sm"
                            />
                          </div>
                          <p className="text-sm">{startSource.aiAnalysis.suggestedApproach}</p>
                        </div>
                      )}
                      {/* Fast Cut specific guidance */}
                      {start.contentType === "fast-cut" && (
                        <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Layers className="h-4 w-4 text-neutral-600" />
                            <p className="text-xs font-medium text-neutral-700">
                              {language === "ko" ? "Fast Cut 모드" : "Fast Cut Mode"}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {language === "ko"
                              ? "영상의 스타일과 분위기를 분석했습니다. 다음 단계에서 AI가 스크립트와 이미지 키워드를 생성합니다."
                              : "Video style and mood analyzed. In the next step, AI will generate scripts and image keywords."}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Concept for Recreation - only for AI Video mode */}
                {startSource.aiAnalysis?.conceptDetails && start.contentType === "ai_video" && (
                  <Card className="border border-neutral-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">
                          {translate("startPage.analysis.conceptDetails")}
                        </CardTitle>
                        <InfoButton
                          content={translate("startPage.infoButtons.conceptDetails")}
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
                              {translate("startPage.analysis.visualStyle")}
                            </p>
                            <p className="text-sm">{startSource.aiAnalysis.conceptDetails.visualStyle}</p>
                          </div>
                        )}
                        {startSource.aiAnalysis.conceptDetails.mood && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {translate("startPage.analysis.mood")}
                            </p>
                            <p className="text-sm">{startSource.aiAnalysis.conceptDetails.mood}</p>
                          </div>
                        )}
                        {startSource.aiAnalysis.conceptDetails.pace && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {translate("startPage.analysis.pace")}
                            </p>
                            <p className="text-sm">{startSource.aiAnalysis.conceptDetails.pace}</p>
                          </div>
                        )}
                        {startSource.aiAnalysis.conceptDetails.lighting && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {translate("startPage.analysis.lighting")}
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
                              {translate("startPage.analysis.colorPalette")}
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
                              {translate("startPage.analysis.cameraMovement")}
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
                              {translate("startPage.analysis.transitions")}
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
                            {translate("startPage.analysis.effects")}
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
                          {translate("startPage.analysis.contentComposition")}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {startSource.aiAnalysis.conceptDetails.mainSubject && (
                            <div>
                              <p className="text-xs text-muted-foreground">{translate("startPage.analysis.mainSubject")}</p>
                              <p className="text-sm">{startSource.aiAnalysis.conceptDetails.mainSubject}</p>
                            </div>
                          )}
                          {startSource.aiAnalysis.conceptDetails.setting && (
                            <div>
                              <p className="text-xs text-muted-foreground">{translate("startPage.analysis.setting")}</p>
                              <p className="text-sm">{startSource.aiAnalysis.conceptDetails.setting}</p>
                            </div>
                          )}
                          {startSource.aiAnalysis.conceptDetails.clothingStyle && (
                            <div>
                              <p className="text-xs text-muted-foreground">{translate("startPage.analysis.clothingStyle")}</p>
                              <p className="text-sm">{startSource.aiAnalysis.conceptDetails.clothingStyle}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {startSource.aiAnalysis.conceptDetails.actions && startSource.aiAnalysis.conceptDetails.actions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {translate("startPage.analysis.actions")}
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
                            {translate("startPage.analysis.props")}
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

        {/* Workflow Footer */}
        <WorkflowFooter
          onNext={handleProceedToAnalyze}
          canProceed={!isAnalyzingVideo}
          actionButton={{
            label: language === "ko" ? "다음 단계" : "Next Step",
            onClick: handleProceedToAnalyze,
            disabled: isAnalyzingVideo,
            loading: isAnalyzingVideo,
            icon: <ArrowRight className="h-4 w-4" />,
          }}
        />
      </div>
    );
  }

  // Default: Entry selection view
  return (
    <div className="flex flex-col bg-background flex-1 min-h-0">
      {/* Workflow Header */}
      <WorkflowHeader />

      {/* Content Area */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="container max-w-4xl mx-auto py-8 px-4">
          {/* Content Type Selection - Must select before proceeding */}
          <Card className="mb-6 border-2 border-neutral-300 bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-neutral-600" />
                <CardTitle className="text-base font-medium">
                  {language === "ko" ? "콘텐츠 타입 선택" : "Select Content Type"}
                </CardTitle>
                <Badge variant="outline" className="text-xs text-red-500 border-red-200">
                  {language === "ko" ? "필수" : "Required"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {language === "ko"
                  ? "어떤 방식으로 영상을 만들지 선택해주세요"
                  : "Choose how you want to create your video"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid grid-cols-2 gap-3">
                {/* AI Video Option */}
                <button
                  onClick={() => setStartContentType("ai_video")}
                  className={cn(
                    "relative p-4 rounded-lg border-2 text-left transition-all",
                    start.contentType === "ai_video"
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-300 bg-white"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      start.contentType === "ai_video" ? "bg-neutral-900" : "bg-neutral-100"
                    )}>
                      <Sparkles className={cn(
                        "h-5 w-5",
                        start.contentType === "ai_video" ? "text-white" : "text-neutral-600"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">AI Video</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {language === "ko"
                          ? "AI가 이미지와 영상을 생성합니다"
                          : "AI generates images and videos"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {language === "ko" ? "고품질" : "High Quality"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {language === "ko" ? "창작 영상" : "Creative"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {start.contentType === "ai_video" && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Fast Cut Option */}
                <button
                  onClick={() => setStartContentType("fast-cut")}
                  className={cn(
                    "relative p-4 rounded-lg border-2 text-left transition-all",
                    start.contentType === "fast-cut"
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-300 bg-white"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      start.contentType === "fast-cut" ? "bg-neutral-900" : "bg-neutral-100"
                    )}>
                      <Layers className={cn(
                        "h-5 w-5",
                        start.contentType === "fast-cut" ? "text-white" : "text-neutral-600"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Fast Cut</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {language === "ko"
                          ? "이미지를 조합해 빠르게 편집합니다"
                          : "Quick editing with image combinations"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {language === "ko" ? "빠른 제작" : "Fast"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {language === "ko" ? "슬라이드쇼" : "Slideshow"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {start.contentType === "fast-cut" && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>

              {/* Campaign selector - always required */}
              <div className="mt-4 p-4 rounded-lg border border-neutral-200 bg-neutral-50">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen className="h-4 w-4 text-neutral-500" />
                    <span className="text-sm font-medium">
                      {language === "ko" ? "캠페인 선택" : "Select Campaign"}
                    </span>
                    <span className="text-xs text-red-500">*</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {language === "ko"
                      ? "콘텐츠를 생성할 캠페인을 선택해주세요."
                      : "Select a campaign to create content for."}
                  </p>
                  <Select
                    value={selectedCampaignId || ""}
                    onValueChange={handleCampaignSelect}
                    disabled={isLoadingCampaigns}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue
                        placeholder={
                          isLoadingCampaigns
                            ? (language === "ko" ? "로딩 중..." : "Loading...")
                            : (language === "ko" ? "캠페인을 선택하세요" : "Select a campaign")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                      {campaigns.length === 0 && !isLoadingCampaigns && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {language === "ko" ? "캠페인이 없습니다" : "No campaigns found"}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedCampaignId && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {language === "ko" ? "캠페인이 선택되었습니다" : "Campaign selected"}
                    </p>
                  )}
                </div>

              {/* Help text based on selection */}
              {start.contentType && (
                <div className="mt-3 p-2 rounded bg-neutral-50 border border-neutral-200">
                  <p className="text-xs text-muted-foreground">
                    {start.contentType === "ai_video"
                      ? (language === "ko"
                          ? "💡 AI Video: 프롬프트를 기반으로 AI가 새로운 이미지와 영상을 생성합니다. 고품질 창작 콘텐츠에 적합합니다."
                          : "💡 AI Video: AI generates new images and videos based on your prompt. Best for high-quality creative content.")
                      : (language === "ko"
                          ? "💡 Fast Cut: 기존 이미지를 활용해 빠르게 슬라이드쇼 스타일 영상을 만듭니다. 빠른 제작에 적합합니다."
                          : "💡 Fast Cut: Quickly create slideshow-style videos using existing images. Best for fast production.")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Direct Idea Input */}
          <Card className="mb-8 border border-neutral-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-neutral-500" />
                <span className="font-medium">
                  {translate("startPage.entryPaths.idea.title")}
                </span>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder={translate("startPage.input.placeholder")}
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isAnalyzingVideo && !isAnalyzingIdea && handleIdeaSubmit()}
                    disabled={isAnalyzingVideo || isAnalyzingIdea}
                    className="w-full pr-10"
                  />
                  {detectTikTokUrl(ideaInput).isTikTok && (
                    <Link className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  )}
                </div>

                {/* Input hints */}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    {translate("startPage.input.hintIdea")}
                  </span>
                  <span className="text-neutral-300">|</span>
                  <span className="flex items-center gap-1">
                    <Link className="h-3 w-3" />
                    {translate("startPage.input.hintTiktok")}
                  </span>
                </div>

                {/* Loading state for video analysis */}
                {isAnalyzingVideo && inputType === "tiktok" && (
                  <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                    <span className="text-sm text-muted-foreground">
                      {translate("startPage.input.analyzingVideo")}
                    </span>
                  </div>
                )}

                {/* Loading state for idea analysis */}
                {isAnalyzingIdea && inputType === "text" && (
                  <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                    <span className="text-sm text-muted-foreground">
                      {translate("startPage.input.analyzingIdea")}
                    </span>
                  </div>
                )}

                {/* Error state */}
                {analysisError && !isAnalyzingVideo && !isAnalyzingIdea && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                    <X className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-700">{analysisError}</p>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-red-600"
                        onClick={() => {
                          setAnalysisError(null);
                          handleIdeaSubmit();
                        }}
                      >
                        {translate("startPage.input.retry")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-muted-foreground">
                {translate("startPage.input.or")}
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
                    {translate("startPage.badges.keywordAnalysis")}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {translate("startPage.badges.viralVideos")}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {translate("startPage.badges.hashtagTrends")}
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
                  {translate("startPage.viewAllCampaigns")}
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

      {/* Workflow Footer */}
      <WorkflowFooter
        onNext={handleProceed}
        canProceed={canProceedToAnalyze}
        actionButton={{
          label: language === "ko" ? "시작하기" : "Get Started",
          onClick: handleProceed,
          disabled: !canProceedToAnalyze || isAnalyzingVideo || isAnalyzingIdea,
          loading: isAnalyzingVideo || isAnalyzingIdea,
          icon: <ArrowRight className="h-4 w-4" />,
        }}
      />
    </div>
  );
}
