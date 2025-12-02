"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";
import { pipelineApi, PipelineItem } from "@/lib/pipeline-api";
import { presetsApi, StylePreset, variationsApi, VariationConfigRequest, videoApi, VideoGeneration, composeVariationsApi } from "@/lib/video-api";
import { socialAccountsApi, SocialAccount } from "@/lib/publishing-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  RefreshCw,
  Search,
  ArrowRight,
  Sparkles,
  Video,
  Play,
  Clock,
  Music,
  CheckCircle2,
  Wand2,
  Zap,
  Film,
  Grid3X3,
  List,
  TrendingUp,
  XCircle,
  Loader2,
  MoreHorizontal,
  Eye,
  ChevronRight,
  PlayCircle,
  LayoutGrid,
  TableIcon,
  ArrowUpDown,
  Calendar,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { LazyVideo } from "@/components/ui/lazy-video";
import {
  AIVariationModal,
  AIVariationConfig,
  ComposeVariationModal,
  ComposeVariationConfig,
} from "@/components/features/pipeline";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  AIPipelineCard,
  AIPipelineTableRow,
  ComposePipelineCard,
  ComposePipelineTableRow,
  PipelineType,
} from "@/components/features/pipeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";

type StatusFilter = "all" | "pending" | "processing" | "completed" | "partial_failure";
type VideoType = "ai" | "compose";
type ViewMode = "grid" | "table";
type PipelineTypeFilter = "all" | "ai" | "compose";

interface SeedCandidate extends VideoGeneration {
  campaign_name?: string;
  video_type?: VideoType;
}

export default function GlobalPipelinePage() {
  const router = useRouter();
  const { t, language } = useI18n();
  const isKorean = language === "ko";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [seedCandidates, setSeedCandidates] = useState<SeedCandidate[]>([]);
  const [composeCandidates, setComposeCandidates] = useState<SeedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  const [loadingCompose, setLoadingCompose] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pipelines");

  // View mode
  const [pipelineViewMode, setPipelineViewMode] = useState<ViewMode>("table");
  const [videoViewMode, setVideoViewMode] = useState<ViewMode>("grid");

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pipelineTypeFilter, setPipelineTypeFilter] = useState<PipelineTypeFilter>("all");
  const [seedCampaignFilter, setSeedCampaignFilter] = useState<string>("all");
  const [seedSearchQuery, setSeedSearchQuery] = useState("");
  const [composeCampaignFilter, setComposeCampaignFilter] = useState<string>("all");
  const [composeSearchQuery, setComposeSearchQuery] = useState("");

  // Auto-pipeline state for compose videos
  const [creatingAutoPipeline, setCreatingAutoPipeline] = useState(false);
  const [deletingPipeline, setDeletingPipeline] = useState<string | null>(null);

  // Variation modal state
  const [aiVariationModalOpen, setAIVariationModalOpen] = useState(false);
  const [composeVariationModalOpen, setComposeVariationModalOpen] = useState(false);
  const [selectedSeedGeneration, setSelectedSeedGeneration] = useState<VideoGeneration | null>(null);
  const [selectedGenerationType, setSelectedGenerationType] = useState<"ai" | "compose">("ai");
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [creatingVariations, setCreatingVariations] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);

  // Fetch campaigns
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const result = await campaignsApi.getAll({ page_size: 50 });
        if (result.data) {
          setCampaigns(result.data.items);
        }
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
      }
    };
    fetchCampaigns();
  }, []);

  // Fetch presets for variation modal
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const result = await presetsApi.getAll({ active_only: true });
        if (result.data) {
          setPresets(result.data.presets);
        }
      } catch (error) {
        console.error("Failed to fetch presets:", error);
      }
    };
    fetchPresets();
  }, []);

  // Fetch social accounts for auto-publish
  useEffect(() => {
    const fetchSocialAccounts = async () => {
      try {
        const result = await socialAccountsApi.getAll({ platform: "TIKTOK" });
        if (result.data) {
          setSocialAccounts(result.data.accounts);
        }
      } catch (error) {
        console.error("Failed to fetch social accounts:", error);
      }
    };
    fetchSocialAccounts();
  }, []);

  // Fetch pipelines from all campaigns
  const fetchPipelines = useCallback(async () => {
    if (campaigns.length === 0) return;

    try {
      const campaignNames: Record<string, string> = {};
      campaigns.forEach((c) => {
        campaignNames[c.id] = c.name;
      });

      const response = await pipelineApi.listAll(
        campaigns.map((c) => c.id),
        campaignNames
      );
      setPipelines(response.items);
    } catch (error) {
      console.error("Failed to fetch pipelines:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaigns]);

  // Fetch seed candidates (completed AI videos - exclude compose videos)
  const fetchSeedCandidates = useCallback(async () => {
    if (campaigns.length === 0) return;

    setLoadingSeeds(true);
    try {
      const campaignNames: Record<string, string> = {};
      campaigns.forEach((c) => {
        campaignNames[c.id] = c.name;
      });

      const results = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const response = await videoApi.getAll(campaign.id, {
              status: "completed",
              page_size: 50,
            });
            if (response.data) {
              return response.data.items
                .filter((video: VideoGeneration) => !video.id.startsWith("compose-"))
                .map((video: VideoGeneration) => ({
                  ...video,
                  campaign_name: campaignNames[campaign.id],
                  video_type: "ai" as VideoType,
                }));
            }
            return [] as SeedCandidate[];
          } catch {
            return [] as SeedCandidate[];
          }
        })
      );

      const allSeeds = results.flat().sort(
        (a: SeedCandidate, b: SeedCandidate) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSeedCandidates(allSeeds);
    } catch (error) {
      console.error("Failed to fetch seed candidates:", error);
    } finally {
      setLoadingSeeds(false);
    }
  }, [campaigns]);

  // Fetch compose candidates (completed compose videos only)
  const fetchComposeCandidates = useCallback(async () => {
    if (campaigns.length === 0) return;

    setLoadingCompose(true);
    try {
      const campaignNames: Record<string, string> = {};
      campaigns.forEach((c) => {
        campaignNames[c.id] = c.name;
      });

      const results = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const response = await videoApi.getAll(campaign.id, {
              status: "completed",
              page_size: 50,
            });
            if (response.data) {
              return response.data.items
                .filter((video: VideoGeneration) => video.id.startsWith("compose-"))
                .map((video: VideoGeneration) => ({
                  ...video,
                  campaign_name: campaignNames[campaign.id],
                  video_type: "compose" as VideoType,
                }));
            }
            return [] as SeedCandidate[];
          } catch {
            return [] as SeedCandidate[];
          }
        })
      );

      const allCompose = results.flat().sort(
        (a: SeedCandidate, b: SeedCandidate) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setComposeCandidates(allCompose);
    } catch (error) {
      console.error("Failed to fetch compose candidates:", error);
    } finally {
      setLoadingCompose(false);
    }
  }, [campaigns]);

  useEffect(() => {
    if (campaigns.length > 0) {
      fetchPipelines();
    }
  }, [campaigns, fetchPipelines]);

  useEffect(() => {
    if (activeTab === "create" && campaigns.length > 0 && seedCandidates.length === 0) {
      fetchSeedCandidates();
    }
  }, [activeTab, campaigns, seedCandidates.length, fetchSeedCandidates]);

  useEffect(() => {
    if (activeTab === "compose" && campaigns.length > 0 && composeCandidates.length === 0) {
      fetchComposeCandidates();
    }
  }, [activeTab, campaigns, composeCandidates.length, fetchComposeCandidates]);

  useEffect(() => {
    const hasProcessing = pipelines.some((p) => p.status === "processing");
    if (hasProcessing) {
      const interval = setInterval(fetchPipelines, 5000);
      return () => clearInterval(interval);
    }
  }, [pipelines, fetchPipelines]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === "pipelines") {
      fetchPipelines();
    } else if (activeTab === "create") {
      fetchSeedCandidates();
      setRefreshing(false);
    } else if (activeTab === "compose") {
      fetchComposeCandidates();
      setRefreshing(false);
    }
  };

  const handleAutoCreateVariations = async (video: VideoGeneration) => {
    setCreatingAutoPipeline(true);
    try {
      const isComposeVideo = video.id.startsWith("compose-");

      if (isComposeVideo) {
        await composeVariationsApi.create(video.id, {
          variation_count: 4,
          tag_count: 2,
        });
      } else {
        const autoConfig: VariationConfigRequest = {
          style_categories: ["mood", "motion"],
          enable_prompt_variation: false,
          prompt_variation_types: [],
          max_variations: 4,
        };
        await variationsApi.create(video.id, autoConfig);
      }

      setActiveTab("pipelines");
      fetchPipelines();
    } catch (error) {
      console.error("Failed to create auto variations:", error);
    } finally {
      setCreatingAutoPipeline(false);
    }
  };

  const handleSelectSeed = (video: VideoGeneration) => {
    const isComposeVideo = video.id.startsWith("compose-");
    setSelectedSeedGeneration(video);
    setSelectedGenerationType(isComposeVideo ? "compose" : "ai");

    if (isComposeVideo) {
      setComposeVariationModalOpen(true);
    } else {
      setAIVariationModalOpen(true);
    }
  };

  const handleCreateMoreVariations = (pipeline: PipelineItem) => {
    setSelectedSeedGeneration(pipeline.seed_generation);
    setSelectedGenerationType(pipeline.type || "ai");

    if (pipeline.type === "compose") {
      setComposeVariationModalOpen(true);
    } else {
      setAIVariationModalOpen(true);
    }
  };

  const handleDeletePipeline = async (pipeline: PipelineItem) => {
    const confirmMessage = isKorean
      ? `이 파이프라인의 모든 변형(${pipeline.total}개)을 삭제하시겠습니까?`
      : `Delete all ${pipeline.total} variations in this pipeline?`;

    if (!confirm(confirmMessage)) return;

    setDeletingPipeline(pipeline.batch_id);
    try {
      const result = await pipelineApi.deleteBatch(pipeline.campaign_id, pipeline.batch_id);
      console.log(`Deleted ${result.deleted} generations, ${result.failed} failed`);

      // Remove from local state
      setPipelines((prev) => prev.filter((p) => p.batch_id !== pipeline.batch_id));
    } catch (error) {
      console.error("Failed to delete pipeline:", error);
    } finally {
      setDeletingPipeline(null);
    }
  };

  const handleCreateAIVariations = async (config: AIVariationConfig) => {
    if (!selectedSeedGeneration) return;

    setCreatingVariations(true);
    try {
      const autoPublishConfig = config.autoPublish?.enabled ? {
        social_account_id: config.autoPublish.socialAccountId,
        interval_minutes: config.autoPublish.intervalMinutes,
        caption: config.autoPublish.caption,
        hashtags: config.autoPublish.hashtags,
      } : undefined;

      const requestConfig: VariationConfigRequest = {
        style_categories: config.styleCategories,
        enable_prompt_variation: config.enablePromptVariation,
        prompt_variation_types: config.promptVariationTypes,
        max_variations: config.maxVariations,
        auto_publish: autoPublishConfig,
      };
      await variationsApi.create(selectedSeedGeneration.id, requestConfig);

      setAIVariationModalOpen(false);
      setActiveTab("pipelines");
      fetchPipelines();
    } catch (error) {
      console.error("Failed to create AI variations:", error);
    } finally {
      setCreatingVariations(false);
    }
  };

  const handleCreateComposeVariations = async (config: ComposeVariationConfig) => {
    if (!selectedSeedGeneration) return;

    setCreatingVariations(true);
    try {
      const autoPublishConfig = config.autoPublish?.enabled ? {
        social_account_id: config.autoPublish.socialAccountId,
        interval_minutes: config.autoPublish.intervalMinutes,
        caption: config.autoPublish.caption,
        hashtags: config.autoPublish.hashtags,
      } : undefined;

      await composeVariationsApi.create(selectedSeedGeneration.id, {
        variation_count: config.maxVariations || 4,
        tag_count: 2,
        effect_presets: config.effectPresets,
        color_grades: config.colorGrades,
        text_styles: config.textStyles,
        vibe_variations: config.vibeVariations,
        auto_publish: autoPublishConfig,
      });

      setComposeVariationModalOpen(false);
      setActiveTab("pipelines");
      fetchPipelines();
    } catch (error) {
      console.error("Failed to create Compose variations:", error);
    } finally {
      setCreatingVariations(false);
    }
  };

  // Filter pipelines
  const filteredPipelines = pipelines.filter((pipeline) => {
    // Type filter
    if (pipelineTypeFilter !== "all" && pipeline.type !== pipelineTypeFilter) {
      return false;
    }
    if (statusFilter !== "all" && pipeline.status !== statusFilter) {
      return false;
    }
    if (campaignFilter !== "all" && pipeline.campaign_id !== campaignFilter) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesPrompt = pipeline.seed_generation.prompt.toLowerCase().includes(query);
      const matchesCategories = pipeline.style_categories.some((cat) =>
        cat.toLowerCase().includes(query)
      );
      const matchesCampaign = pipeline.campaign_name?.toLowerCase().includes(query);
      return matchesPrompt || matchesCategories || matchesCampaign;
    }
    return true;
  });

  // Separate AI and Compose pipelines for rendering
  const aiPipelines = filteredPipelines.filter((p) => p.type === "ai");
  const composePipelines = filteredPipelines.filter((p) => p.type === "compose");

  // Filter seed candidates
  const filteredSeedCandidates = seedCandidates.filter((video) => {
    if (seedCampaignFilter !== "all" && video.campaign_id !== seedCampaignFilter) {
      return false;
    }
    if (seedSearchQuery) {
      const query = seedSearchQuery.toLowerCase();
      const matchesPrompt = video.prompt.toLowerCase().includes(query);
      const matchesCampaign = video.campaign_name?.toLowerCase().includes(query);
      return matchesPrompt || matchesCampaign;
    }
    return true;
  });

  // Filter compose candidates
  const filteredComposeCandidates = composeCandidates.filter((video) => {
    if (composeCampaignFilter !== "all" && video.campaign_id !== composeCampaignFilter) {
      return false;
    }
    if (composeSearchQuery) {
      const query = composeSearchQuery.toLowerCase();
      const matchesPrompt = video.prompt.toLowerCase().includes(query);
      const matchesCampaign = video.campaign_name?.toLowerCase().includes(query);
      return matchesPrompt || matchesCampaign;
    }
    return true;
  });

  // Stats
  const stats = useMemo(() => ({
    total: pipelines.length,
    processing: pipelines.filter((p) => p.status === "processing").length,
    completed: pipelines.filter((p) => p.status === "completed").length,
    failed: pipelines.filter((p) => p.status === "partial_failure").length,
    totalVariations: pipelines.reduce((acc, p) => acc + p.total, 0),
    completedVariations: pipelines.reduce((acc, p) => acc + p.completed, 0),
    aiCount: pipelines.filter((p) => p.type === "ai").length,
    composeCount: pipelines.filter((p) => p.type === "compose").length,
  }), [pipelines]);

  // Status config helper
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return {
          label: isKorean ? "완료" : "Completed",
          variant: "default" as const,
          icon: CheckCircle2,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
        };
      case "processing":
        return {
          label: isKorean ? "처리중" : "Processing",
          variant: "secondary" as const,
          icon: Loader2,
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
          animate: true,
        };
      case "partial_failure":
        return {
          label: isKorean ? "일부 실패" : "Partial Failure",
          variant: "destructive" as const,
          icon: XCircle,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
        };
      case "pending":
      default:
        return {
          label: isKorean ? "대기중" : "Pending",
          variant: "outline" as const,
          icon: Clock,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6" />
              {isKorean ? "변형 파이프라인" : "Variation Pipeline"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isKorean
                ? "기존 영상을 선택하여 다양한 변형을 생성하고 A/B 테스트하세요"
                : "Select existing videos to create variations and A/B test"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              {isKorean ? "새로고침" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Stats Dashboard - PC Optimized */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {isKorean ? "전체" : "Total"}
                  </p>
                  <p className="text-2xl font-bold mt-1">{stats.total}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {isKorean ? "처리중" : "Processing"}
                  </p>
                  <p className="text-2xl font-bold mt-1 text-blue-500">{stats.processing}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Loader2 className={cn("h-5 w-5 text-blue-500", stats.processing > 0 && "animate-spin")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {isKorean ? "완료" : "Completed"}
                  </p>
                  <p className="text-2xl font-bold mt-1 text-green-500">{stats.completed}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {isKorean ? "실패" : "Failed"}
                  </p>
                  <p className="text-2xl font-bold mt-1 text-yellow-500">{stats.failed}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-2">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {isKorean ? "변형 진행률" : "Variation Progress"}
                </p>
                <span className="text-sm font-medium">
                  {stats.completedVariations}/{stats.totalVariations}
                </span>
              </div>
              <Progress
                value={stats.totalVariations > 0 ? (stats.completedVariations / stats.totalVariations) * 100 : 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {stats.totalVariations > 0
                  ? `${Math.round((stats.completedVariations / stats.totalVariations) * 100)}% ${isKorean ? "완료" : "complete"}`
                  : isKorean ? "변형 없음" : "No variations"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList className="h-10">
              <TabsTrigger value="pipelines" className="gap-2 px-4">
                <Layers className="w-4 h-4" />
                {isKorean ? "파이프라인" : "Pipelines"}
                {stats.processing > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {stats.processing}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="create" className="gap-2 px-4">
                <Video className="w-4 h-4" />
                {isKorean ? "AI 영상" : "AI Videos"}
                <Badge variant="outline" className="ml-1 h-5 px-1.5">
                  {seedCandidates.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="compose" className="gap-2 px-4">
                <Film className="w-4 h-4" />
                {isKorean ? "Compose" : "Compose"}
                <Badge variant="outline" className="ml-1 h-5 px-1.5">
                  {composeCandidates.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* View Mode Toggle - Only for pipelines tab */}
            {activeTab === "pipelines" && (
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button
                  variant={pipelineViewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPipelineViewMode("table")}
                >
                  <TableIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant={pipelineViewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPipelineViewMode("grid")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Pipelines Tab */}
          <TabsContent value="pipelines" className="space-y-4 mt-4">
            {/* Filters Toolbar */}
            <Card className="border-dashed">
              <CardContent className="py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={isKorean ? "프롬프트, 캠페인 검색..." : "Search prompts, campaigns..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder={isKorean ? "캠페인" : "Campaign"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isKorean ? "모든 캠페인" : "All Campaigns"}</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={pipelineTypeFilter}
                    onValueChange={(value) => setPipelineTypeFilter(value as PipelineTypeFilter)}
                  >
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isKorean ? "전체 타입" : "All Types"}</SelectItem>
                      <SelectItem value="ai">
                        <span className="flex items-center gap-1.5">
                          <Video className="w-3 h-3 text-blue-500" />
                          AI
                        </span>
                      </SelectItem>
                      <SelectItem value="compose">
                        <span className="flex items-center gap-1.5">
                          <Film className="w-3 h-3 text-purple-500" />
                          Compose
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isKorean ? "모든 상태" : "All Status"}</SelectItem>
                      <SelectItem value="pending">{isKorean ? "대기중" : "Pending"}</SelectItem>
                      <SelectItem value="processing">{isKorean ? "처리중" : "Processing"}</SelectItem>
                      <SelectItem value="completed">{isKorean ? "완료" : "Completed"}</SelectItem>
                      <SelectItem value="partial_failure">{isKorean ? "일부 실패" : "Partial"}</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex-1" />

                  <p className="text-sm text-muted-foreground">
                    {filteredPipelines.length} {isKorean ? "개 결과" : "results"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Pipeline List/Table */}
            {filteredPipelines.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {isKorean ? "파이프라인이 없습니다" : "No Pipelines Yet"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                    {isKorean
                      ? "AI 영상 또는 Compose 탭에서 영상을 선택하여 변형을 생성하세요"
                      : "Select a video from the AI Videos or Compose tab to create variations"}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={() => setActiveTab("create")} variant="outline">
                      <Video className="w-4 h-4 mr-2" />
                      {isKorean ? "AI 영상 보기" : "View AI Videos"}
                    </Button>
                    <Button onClick={() => setActiveTab("compose")}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {isKorean ? "Compose 영상 보기" : "View Compose Videos"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : pipelineViewMode === "table" ? (
              /* Table View */
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="h-10 px-4 text-left font-medium text-muted-foreground w-20">{isKorean ? "미리보기" : "Preview"}</th>
                        <th className="h-10 px-4 text-center font-medium text-muted-foreground w-20">{isKorean ? "타입" : "Type"}</th>
                        <th className="h-10 px-4 text-left font-medium text-muted-foreground">{isKorean ? "캠페인" : "Campaign"}</th>
                        <th className="h-10 px-4 text-center font-medium text-muted-foreground">{isKorean ? "상태" : "Status"}</th>
                        <th className="h-10 px-4 text-center font-medium text-muted-foreground">{isKorean ? "변형" : "Vars"}</th>
                        <th className="h-10 px-4 text-center font-medium text-muted-foreground w-28">{isKorean ? "진행률" : "Progress"}</th>
                        <th className="h-10 px-4 text-left font-medium text-muted-foreground">{isKorean ? "스타일" : "Styles"}</th>
                        <th className="h-10 px-4 text-right font-medium text-muted-foreground">{isKorean ? "생성일" : "Created"}</th>
                        <th className="h-10 px-4 text-right font-medium text-muted-foreground w-24">{isKorean ? "작업" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredPipelines.map((pipeline) =>
                        pipeline.type === "compose" ? (
                          <ComposePipelineTableRow
                            key={pipeline.batch_id}
                            pipeline={pipeline}
                            onCreateVariations={() => handleCreateMoreVariations(pipeline)}
                            onDelete={() => handleDeletePipeline(pipeline)}
                          />
                        ) : (
                          <AIPipelineTableRow
                            key={pipeline.batch_id}
                            pipeline={pipeline}
                            onCreateVariations={() => handleCreateMoreVariations(pipeline)}
                            onDelete={() => handleDeletePipeline(pipeline)}
                          />
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Grid View */
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredPipelines.map((pipeline) =>
                  pipeline.type === "compose" ? (
                    <ComposePipelineCard
                      key={pipeline.batch_id}
                      pipeline={pipeline}
                      onCreateVariations={() => handleCreateMoreVariations(pipeline)}
                      onDelete={() => handleDeletePipeline(pipeline)}
                    />
                  ) : (
                    <AIPipelineCard
                      key={pipeline.batch_id}
                      pipeline={pipeline}
                      onCreateVariations={() => handleCreateMoreVariations(pipeline)}
                      onDelete={() => handleDeletePipeline(pipeline)}
                    />
                  )
                )}
              </div>
            )}
          </TabsContent>

          {/* AI Videos Tab */}
          <TabsContent value="create" className="space-y-4 mt-4">
            {/* Info Banner */}
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Video className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {isKorean ? "AI 생성 영상에서 변형 만들기" : "Create Variations from AI Videos"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isKorean
                        ? "완료된 AI 영상을 선택하여 스타일 변형을 생성합니다. 각 변형은 원본의 프롬프트를 기반으로 다양한 스타일로 재생성됩니다."
                        : "Select a completed AI video to generate style variations. Each variation is regenerated with different styles based on the original prompt."}
                    </p>
                  </div>
                  <Button onClick={() => router.push("/create/generate")} className="shrink-0">
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isKorean ? "새 영상 생성" : "Generate New"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card className="border-dashed">
              <CardContent className="py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={isKorean ? "프롬프트 검색..." : "Search prompts..."}
                      value={seedSearchQuery}
                      onChange={(e) => setSeedSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={seedCampaignFilter} onValueChange={setSeedCampaignFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder={isKorean ? "캠페인" : "Campaign"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isKorean ? "모든 캠페인" : "All Campaigns"}</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <p className="text-sm text-muted-foreground">
                    {filteredSeedCandidates.length} {isKorean ? "개 영상" : "videos"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Videos Grid - PC Optimized with more columns */}
            {loadingSeeds ? (
              <div className="flex items-center justify-center h-48">
                <Spinner className="w-8 h-8" />
              </div>
            ) : filteredSeedCandidates.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {isKorean ? "완료된 AI 영상이 없습니다" : "No Completed AI Videos"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    {isKorean
                      ? "먼저 AI 영상을 생성해주세요"
                      : "Generate AI videos first to create variations"}
                  </p>
                  <Button onClick={() => router.push("/create/generate")}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isKorean ? "영상 생성하기" : "Generate Videos"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredSeedCandidates.map((video) => (
                  <Card
                    key={video.id}
                    className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group hover:ring-2 hover:ring-primary/50"
                    onClick={() => handleSelectSeed(video)}
                  >
                    <CardContent className="p-0">
                      {/* Video Thumbnail */}
                      <div className="relative aspect-[9/16] bg-muted">
                        {video.output_url || video.composed_output_url ? (
                          <LazyVideo
                            src={video.output_url || video.composed_output_url || ""}
                            className="w-full h-full object-cover"
                            autoPlay={false}
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-end p-4">
                          <Button size="sm" className="gap-2">
                            <Sparkles className="w-4 h-4" />
                            {isKorean ? "변형 생성" : "Create Variations"}
                          </Button>
                        </div>
                        {/* Status Badge */}
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-green-500/90 backdrop-blur-sm">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {isKorean ? "완료" : "Done"}
                          </Badge>
                        </div>
                        {/* Duration Badge */}
                        <div className="absolute bottom-2 right-2 opacity-100 group-hover:opacity-0 transition-opacity">
                          <Badge variant="secondary" className="bg-black/60 text-white border-0">
                            <Clock className="w-3 h-3 mr-1" />
                            {video.duration_seconds}s
                          </Badge>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3 space-y-1.5">
                        {video.campaign_name && (
                          <p className="text-xs text-primary font-medium truncate">
                            {video.campaign_name}
                          </p>
                        )}
                        <p className="text-sm line-clamp-2 leading-snug">
                          {video.prompt}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          {video.audio_asset && (
                            <span className="flex items-center gap-1">
                              <Music className="w-3 h-3" />
                            </span>
                          )}
                          <span>
                            {new Date(video.created_at).toLocaleDateString(
                              isKorean ? "ko-KR" : "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Compose Videos Tab */}
          <TabsContent value="compose" className="space-y-4 mt-4">
            {/* Info Banner */}
            <Card className="bg-gradient-to-r from-purple-500/5 to-pink-500/10 border-purple-500/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
                    <Wand2 className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      {isKorean ? "Compose 슬라이드쇼 자동 변형" : "Compose Slideshow Auto-Variations"}
                      <Badge variant="secondary" className="text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        Auto
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isKorean
                        ? "Compose로 만든 슬라이드쇼입니다. 자동 변형은 새로운 이미지를 검색하여 다른 시각적 스타일의 영상을 생성합니다."
                        : "Slideshows created with Compose. Auto-variation searches for new images and generates videos with different visual styles."}
                    </p>
                  </div>
                  <Button onClick={() => router.push("/compose")} variant="outline" className="shrink-0 border-purple-500/50 text-purple-600 hover:bg-purple-500/10">
                    <Film className="w-4 h-4 mr-2" />
                    {isKorean ? "Compose로 이동" : "Go to Compose"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card className="border-dashed">
              <CardContent className="py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={isKorean ? "프롬프트 검색..." : "Search prompts..."}
                      value={composeSearchQuery}
                      onChange={(e) => setComposeSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={composeCampaignFilter} onValueChange={setComposeCampaignFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder={isKorean ? "캠페인" : "Campaign"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isKorean ? "모든 캠페인" : "All Campaigns"}</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <p className="text-sm text-muted-foreground">
                    {filteredComposeCandidates.length} {isKorean ? "개 영상" : "videos"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Compose Videos Grid */}
            {loadingCompose ? (
              <div className="flex items-center justify-center h-48">
                <Spinner className="w-8 h-8" />
              </div>
            ) : filteredComposeCandidates.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Film className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {isKorean ? "Compose 영상이 없습니다" : "No Compose Videos"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    {isKorean
                      ? "Compose 페이지에서 슬라이드쇼 영상을 먼저 생성해주세요"
                      : "Create slideshow videos on the Compose page first"}
                  </p>
                  <Button onClick={() => router.push("/compose")} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    <Wand2 className="w-4 h-4 mr-2" />
                    {isKorean ? "Compose로 이동" : "Go to Compose"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredComposeCandidates.map((video) => (
                  <Card
                    key={video.id}
                    className="overflow-hidden hover:shadow-lg transition-all group"
                  >
                    <CardContent className="p-0">
                      {/* Video Thumbnail */}
                      <div className="relative aspect-[9/16] bg-muted">
                        {video.composed_output_url || video.output_url ? (
                          <LazyVideo
                            src={video.composed_output_url || video.output_url || ""}
                            className="w-full h-full object-cover"
                            autoPlay={false}
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        {/* Type Badge */}
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-purple-500/90 text-white backdrop-blur-sm">
                            <Wand2 className="w-3 h-3 mr-1" />
                            Compose
                          </Badge>
                        </div>
                        {/* Duration Badge */}
                        <div className="absolute bottom-2 right-2">
                          <Badge variant="secondary" className="bg-black/60 text-white border-0">
                            <Clock className="w-3 h-3 mr-1" />
                            {video.duration_seconds}s
                          </Badge>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3 space-y-2">
                        {video.campaign_name && (
                          <p className="text-xs text-purple-500 font-medium truncate">
                            {video.campaign_name}
                          </p>
                        )}
                        <p className="text-sm line-clamp-2 leading-snug">
                          {video.prompt}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {video.audio_asset && (
                            <span className="flex items-center gap-1">
                              <Music className="w-3 h-3" />
                            </span>
                          )}
                          <span>
                            {new Date(video.created_at).toLocaleDateString(
                              isKorean ? "ko-KR" : "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 h-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                            onClick={() => handleAutoCreateVariations(video)}
                            disabled={creatingAutoPipeline}
                          >
                            {creatingAutoPipeline ? (
                              <Spinner className="w-3 h-3 mr-1" />
                            ) : (
                              <Zap className="w-3 h-3 mr-1" />
                            )}
                            {isKorean ? "자동" : "Auto"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => handleSelectSeed(video)}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* AI Variation Modal */}
        <AIVariationModal
          isOpen={aiVariationModalOpen}
          onClose={() => setAIVariationModalOpen(false)}
          seedGeneration={selectedSeedGeneration}
          presets={presets}
          onCreateVariations={handleCreateAIVariations}
          isCreating={creatingVariations}
          socialAccounts={socialAccounts}
        />

        {/* Compose Variation Modal */}
        <ComposeVariationModal
          isOpen={composeVariationModalOpen}
          onClose={() => setComposeVariationModalOpen(false)}
          seedGeneration={selectedSeedGeneration}
          onCreateVariations={handleCreateComposeVariations}
          isCreating={creatingVariations}
          socialAccounts={socialAccounts}
        />
      </div>
    </TooltipProvider>
  );
}
