"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type Campaign } from "@/lib/campaigns-api";
import { useCampaigns, usePipelines, useInvalidateQueries } from "@/lib/queries";
import { pipelineApi, PipelineItem, cleanupApi, CleanupResponse } from "@/lib/pipeline-api";
import { presetsApi, StylePreset, variationsApi, VariationConfigRequest, videoApi, VideoGeneration, composeVariationsApi } from "@/lib/video-api";
import { socialAccountsApi, SocialAccount } from "@/lib/publishing-api";
import { useWorkflowSync } from "@/lib/hooks/useWorkflowNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
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
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  X,
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
  FastCutPipelineCard,
  FastCutPipelineTableRow,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

type StatusFilter = "all" | "pending" | "processing" | "completed" | "partial_failure";
type ViewMode = "grid" | "table";
type PipelineTypeFilter = "all" | "ai" | "fast-cut";

export default function GlobalPipelinePage() {
  const router = useRouter();
  const { t, language } = useI18n();
  const isKorean = language === "ko";

  // Sync workflow stage - keep "create" tab selected in workflow navigation
  useWorkflowSync("create");

  // Use TanStack Query for campaigns with caching
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({ page_size: 50 });
  const campaigns = useMemo(() => campaignsData?.items || [], [campaignsData]);

  // Invalidation helpers
  const { invalidatePipelines } = useInvalidateQueries();

  const [activeTab, setActiveTab] = useState("pipelines");

  // Determine if pipelines are processing for auto-refresh
  const [hasProcessing, setHasProcessing] = useState(false);

  // Use TanStack Query for pipelines with caching and auto-refresh
  const {
    data: pipelinesData,
    isLoading: pipelinesLoading,
    refetch: refetchPipelines,
  } = usePipelines(campaigns, {
    type: "all",
    refetchInterval: hasProcessing ? 5000 : undefined, // Auto-refresh every 5s if processing
  });
  const pipelines = pipelinesData?.items || [];

  // Update hasProcessing when pipelines change
  useEffect(() => {
    const processing = pipelines.some((p) => p.status === "processing");
    setHasProcessing(processing);
  }, [pipelines]);

  const loading = campaignsLoading || pipelinesLoading;
  const [refreshing, setRefreshing] = useState(false);

  // View mode
  const [pipelineViewMode, setPipelineViewMode] = useState<ViewMode>("table");

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pipelineTypeFilter, setPipelineTypeFilter] = useState<PipelineTypeFilter>("all");
  const [deletingPipeline, setDeletingPipeline] = useState<string | null>(null);

  // Variation modal state
  const [aiVariationModalOpen, setAIVariationModalOpen] = useState(false);
  const [composeVariationModalOpen, setComposeVariationModalOpen] = useState(false);
  const [selectedSeedGeneration, setSelectedSeedGeneration] = useState<VideoGeneration | null>(null);
  const [selectedGenerationType, setSelectedGenerationType] = useState<"ai" | "fast-cut">("ai");
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [creatingVariations, setCreatingVariations] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);

  // Cleanup modal state
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [cleanupData, setCleanupData] = useState<CleanupResponse | null>(null);
  const [loadingCleanup, setLoadingCleanup] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);

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

  // Handle refresh using TanStack Query refetch
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchPipelines();
    } finally {
      setRefreshing(false);
    }
  }, [refetchPipelines]);

  const handleDeletePipeline = async (pipeline: PipelineItem) => {
    const confirmMessage = isKorean
      ? `이 베리에이션의 모든 변형(${pipeline.total}개)을 삭제하시겠습니까?`
      : `Delete all ${pipeline.total} variations in this group?`;

    if (!confirm(confirmMessage)) return;

    setDeletingPipeline(pipeline.batch_id);
    try {
      // Use force=true to delete regardless of status
      const result = await pipelineApi.deleteBatch(pipeline.campaign_id, pipeline.batch_id, true);
      console.log(`Deleted ${result.deleted} generations, ${result.failed} failed`);

      // Invalidate and refetch pipelines using TanStack Query
      await invalidatePipelines();
    } catch (error) {
      console.error("Failed to delete pipeline:", error);
    } finally {
      setDeletingPipeline(null);
    }
  };

  // Cleanup functions
  const handleOpenCleanup = async () => {
    setCleanupModalOpen(true);
    setLoadingCleanup(true);
    try {
      const data = await cleanupApi.getCleanupCandidates(undefined, true);
      setCleanupData(data);
    } catch (error) {
      console.error("Failed to fetch cleanup candidates:", error);
    } finally {
      setLoadingCleanup(false);
    }
  };

  const handleMarkStuckAsFailed = async () => {
    if (!cleanupData || cleanupData.stuck_processing.length === 0) return;

    setRunningCleanup(true);
    try {
      const result = await cleanupApi.markStuckAsFailed();
      console.log("Marked stuck as failed:", result);

      // Refresh cleanup data
      const data = await cleanupApi.getCleanupCandidates(undefined, true);
      setCleanupData(data);

      // Invalidate and refresh pipelines
      await invalidatePipelines();
    } catch (error) {
      console.error("Failed to mark stuck as failed:", error);
    } finally {
      setRunningCleanup(false);
    }
  };

  const handleDeleteOrphaned = async () => {
    if (!cleanupData || cleanupData.orphaned_completed.length === 0) return;

    setRunningCleanup(true);
    try {
      const result = await cleanupApi.deleteOrphaned();
      console.log("Deleted orphaned:", result);

      // Refresh cleanup data
      const data = await cleanupApi.getCleanupCandidates(undefined, true);
      setCleanupData(data);

      // Invalidate and refresh pipelines
      await invalidatePipelines();
    } catch (error) {
      console.error("Failed to delete orphaned:", error);
    } finally {
      setRunningCleanup(false);
    }
  };

  const handleDeleteFailed = async () => {
    if (!cleanupData || cleanupData.failed_generations.length === 0) return;

    setRunningCleanup(true);
    try {
      const result = await cleanupApi.deleteFailed();
      console.log("Deleted failed:", result);

      // Refresh cleanup data
      const data = await cleanupApi.getCleanupCandidates(undefined, true);
      setCleanupData(data);

      // Invalidate and refresh pipelines
      await invalidatePipelines();
    } catch (error) {
      console.error("Failed to delete failed generations:", error);
    } finally {
      setRunningCleanup(false);
    }
  };

  const handleFullCleanup = async () => {
    const confirmMessage = isKorean
      ? "전체 정리를 실행하시겠습니까? 멈춘 작업은 실패로 표시되고, 고아 및 실패한 생성물이 삭제됩니다."
      : "Run full cleanup? This will mark stuck jobs as failed and delete orphaned/failed generations.";

    if (!confirm(confirmMessage)) return;

    setRunningCleanup(true);
    try {
      const result = await cleanupApi.fullCleanup();
      console.log("Full cleanup completed:", result);

      // Refresh cleanup data
      const data = await cleanupApi.getCleanupCandidates(undefined, true);
      setCleanupData(data);

      // Invalidate and refresh pipelines
      await invalidatePipelines();
    } catch (error) {
      console.error("Failed to run full cleanup:", error);
    } finally {
      setRunningCleanup(false);
    }
  };

  // Multi-select functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedPipelines(new Set());
  };

  const togglePipelineSelection = (batchId: string) => {
    const newSelection = new Set(selectedPipelines);
    if (newSelection.has(batchId)) {
      newSelection.delete(batchId);
    } else {
      newSelection.add(batchId);
    }
    setSelectedPipelines(newSelection);
  };

  const selectAllPipelines = () => {
    if (selectedPipelines.size === filteredPipelines.length) {
      setSelectedPipelines(new Set());
    } else {
      setSelectedPipelines(new Set(filteredPipelines.map(p => p.batch_id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPipelines.size === 0) return;

    const totalVariations = pipelines
      .filter(p => selectedPipelines.has(p.batch_id))
      .reduce((sum, p) => sum + p.total, 0);

    const confirmMessage = isKorean
      ? `선택한 ${selectedPipelines.size}개 베리에이션(총 ${totalVariations}개 변형)을 삭제하시겠습니까?`
      : `Delete ${selectedPipelines.size} variations (${totalVariations} total items)?`;

    if (!confirm(confirmMessage)) return;

    setDeletingSelected(true);
    let deleted = 0;
    let failed = 0;

    for (const batchId of selectedPipelines) {
      const pipeline = pipelines.find(p => p.batch_id === batchId);
      if (!pipeline) continue;

      try {
        await pipelineApi.deleteBatch(pipeline.campaign_id, batchId, true);
        deleted++;
      } catch (error) {
        console.error(`Failed to delete pipeline ${batchId}:`, error);
        failed++;
      }
    }

    console.log(`Deleted ${deleted} pipelines, ${failed} failed`);

    // Invalidate and refetch pipelines using TanStack Query
    await invalidatePipelines();
    setSelectedPipelines(new Set());
    setSelectionMode(false);
    setDeletingSelected(false);
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
      await invalidatePipelines();
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
      await invalidatePipelines();
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

  // Separate AI and Fast Cut pipelines for rendering
  const aiPipelines = filteredPipelines.filter((p) => p.type === "ai");
  const fastCutPipelines = filteredPipelines.filter((p) => p.type === "fast-cut");

  // Stats
  const stats = useMemo(() => ({
    total: pipelines.length,
    processing: pipelines.filter((p) => p.status === "processing").length,
    completed: pipelines.filter((p) => p.status === "completed").length,
    failed: pipelines.filter((p) => p.status === "partial_failure").length,
    totalVariations: pipelines.reduce((acc, p) => acc + p.total, 0),
    completedVariations: pipelines.reduce((acc, p) => acc + p.completed, 0),
    aiCount: pipelines.filter((p) => p.type === "ai").length,
    fastCutCount: pipelines.filter((p) => p.type === "fast-cut").length,
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
      <div className="space-y-6 px-[7%]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6" />
              {isKorean ? "베리에이션" : "Variation"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isKorean
                ? "기존 영상을 선택하여 다양한 변형을 생성하고 A/B 테스트하세요"
                : "Select existing videos to create variations and A/B test"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllPipelines}
                >
                  {selectedPipelines.size === filteredPipelines.length ? (
                    <Square className="w-4 h-4 mr-2" />
                  ) : (
                    <CheckSquare className="w-4 h-4 mr-2" />
                  )}
                  {selectedPipelines.size === filteredPipelines.length
                    ? (isKorean ? "전체 해제" : "Deselect All")
                    : (isKorean ? "전체 선택" : "Select All")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={selectedPipelines.size === 0 || deletingSelected}
                >
                  {deletingSelected ? (
                    <Spinner className="w-4 h-4 mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  {isKorean ? `삭제 (${selectedPipelines.size})` : `Delete (${selectedPipelines.size})`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectionMode}
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectionMode}
                  disabled={pipelines.length === 0}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  {isKorean ? "선택" : "Select"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCleanup}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isKorean ? "정리" : "Cleanup"}
                </Button>
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
              </>
            )}
          </div>
        </div>

        {/* Stats Dashboard - PC Optimized (Monochrome) */}
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
                <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
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
                  <p className="text-2xl font-bold mt-1">{stats.processing}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Loader2 className={cn("h-5 w-5 text-zinc-700 dark:text-zinc-300", stats.processing > 0 && "animate-spin")} />
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
                  <p className="text-2xl font-bold mt-1">{stats.completed}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
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
                  <p className="text-2xl font-bold mt-1">{stats.failed}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
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
                {isKorean ? "베리에이션" : "Variations"}
                {stats.processing > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {stats.processing}
                  </Badge>
                )}
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
                          <Video className="w-3 h-3" />
                          {isKorean ? "AI 영상" : "AI Video"}
                        </span>
                      </SelectItem>
                      <SelectItem value="fast-cut">
                        <span className="flex items-center gap-1.5">
                          <Film className="w-3 h-3" />
                          {isKorean ? "패스트 컷 영상" : "Fast Cut Video"}
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
                    {isKorean ? "베리에이션이 없습니다" : "No Variations Yet"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                    {isKorean
                      ? "영상 라이브러리에서 영상을 선택하고 메뉴에서 '베리에이션'을 클릭하여 변형을 생성하세요"
                      : "Select a video from the Videos library and click 'Variation' from the menu to create variations"}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={() => router.push("/videos")}>
                      <Video className="w-4 h-4 mr-2" />
                      {isKorean ? "영상 라이브러리로 이동" : "Go to Videos Library"}
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
                        {selectionMode && (
                          <th className="h-10 px-4 text-center font-medium text-muted-foreground w-12">
                            <Checkbox
                              checked={selectedPipelines.size === filteredPipelines.length && filteredPipelines.length > 0}
                              onCheckedChange={selectAllPipelines}
                            />
                          </th>
                        )}
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
                        pipeline.type === "fast-cut" ? (
                          <FastCutPipelineTableRow
                            key={pipeline.batch_id}
                            pipeline={pipeline}
                            onDelete={() => handleDeletePipeline(pipeline)}
                            selectionMode={selectionMode}
                            isSelected={selectedPipelines.has(pipeline.batch_id)}
                            onToggleSelect={() => togglePipelineSelection(pipeline.batch_id)}
                          />
                        ) : (
                          <AIPipelineTableRow
                            key={pipeline.batch_id}
                            pipeline={pipeline}
                            onDelete={() => handleDeletePipeline(pipeline)}
                            selectionMode={selectionMode}
                            isSelected={selectedPipelines.has(pipeline.batch_id)}
                            onToggleSelect={() => togglePipelineSelection(pipeline.batch_id)}
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
                  pipeline.type === "fast-cut" ? (
                    <FastCutPipelineCard
                      key={pipeline.batch_id}
                      pipeline={pipeline}
                      onDelete={() => handleDeletePipeline(pipeline)}
                      selectionMode={selectionMode}
                      isSelected={selectedPipelines.has(pipeline.batch_id)}
                      onToggleSelect={() => togglePipelineSelection(pipeline.batch_id)}
                    />
                  ) : (
                    <AIPipelineCard
                      key={pipeline.batch_id}
                      pipeline={pipeline}
                      onDelete={() => handleDeletePipeline(pipeline)}
                      selectionMode={selectionMode}
                      isSelected={selectedPipelines.has(pipeline.batch_id)}
                      onToggleSelect={() => togglePipelineSelection(pipeline.batch_id)}
                    />
                  )
                )}
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

        {/* Cleanup Modal */}
        <Dialog open={cleanupModalOpen} onOpenChange={setCleanupModalOpen}>
          <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <div>
                <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {isKorean ? "시스템 정리" : "System Cleanup"}
                </DialogTitle>
                <DialogDescription className="text-sm mt-0.5 text-zinc-500 dark:text-zinc-400">
                  {isKorean
                    ? "멈춘 작업과 불필요한 데이터를 정리합니다"
                    : "Clean up stuck jobs and unnecessary data"}
                </DialogDescription>
              </div>
              {cleanupData && cleanupData.summary.total_cleanup_candidates > 0 && (
                <Button
                  size="sm"
                  onClick={handleFullCleanup}
                  disabled={runningCleanup}
                  className="gap-2 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  {runningCleanup ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  {isKorean ? "전체 정리" : "Clean All"}
                </Button>
              )}
            </div>

            {loadingCleanup ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="w-8 h-8" />
              </div>
            ) : cleanupData ? (
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
                  <div
                    className={cn(
                      "py-4 px-6 text-center transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900",
                      cleanupData.summary.stuck_processing_count > 0 && "bg-zinc-50 dark:bg-zinc-900"
                    )}
                  >
                    <p className={cn(
                      "text-3xl font-bold tabular-nums",
                      cleanupData.summary.stuck_processing_count > 0 ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"
                    )}>
                      {cleanupData.summary.stuck_processing_count}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" />
                      {isKorean ? "멈춘 작업" : "Stuck"}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "py-4 px-6 text-center transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900",
                      cleanupData.summary.orphaned_completed_count > 0 && "bg-zinc-50 dark:bg-zinc-900"
                    )}
                  >
                    <p className={cn(
                      "text-3xl font-bold tabular-nums",
                      cleanupData.summary.orphaned_completed_count > 0 ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"
                    )}>
                      {cleanupData.summary.orphaned_completed_count}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center justify-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {isKorean ? "고아" : "Orphaned"}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "py-4 px-6 text-center transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900",
                      cleanupData.summary.failed_count > 0 && "bg-zinc-50 dark:bg-zinc-900"
                    )}
                  >
                    <p className={cn(
                      "text-3xl font-bold tabular-nums",
                      cleanupData.summary.failed_count > 0 ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"
                    )}>
                      {cleanupData.summary.failed_count}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center justify-center gap-1">
                      <XCircle className="w-3 h-3" />
                      {isKorean ? "실패" : "Failed"}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Stuck Processing */}
                  {cleanupData.stuck_processing.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {isKorean ? "멈춘 작업" : "Stuck Processing"}
                            <span className="text-zinc-500 dark:text-zinc-400 font-normal ml-1">
                              ({cleanupData.stuck_processing.length})
                            </span>
                          </h4>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleMarkStuckAsFailed}
                          disabled={runningCleanup}
                          className="h-8 text-xs gap-1.5 border-zinc-300 dark:border-zinc-700"
                        >
                          {runningCleanup ? <Spinner className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {isKorean ? "실패 처리" : "Mark Failed"}
                        </Button>
                      </div>
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                          {cleanupData.stuck_processing.slice(0, 20).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                            >
                              <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate text-zinc-900 dark:text-zinc-100">{item.prompt}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{item.id}</p>
                              </div>
                              <Badge variant="outline" className="shrink-0 text-xs tabular-nums bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700">
                                {Math.floor((item.stuck_duration_minutes || 0) / 60)}h {(item.stuck_duration_minutes || 0) % 60}m
                              </Badge>
                            </div>
                          ))}
                        </div>
                        {cleanupData.stuck_processing.length > 20 && (
                          <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 text-center text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">
                            +{cleanupData.stuck_processing.length - 20} {isKorean ? "개 더" : "more"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Orphaned Completed */}
                  {cleanupData.orphaned_completed.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-500" />
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {isKorean ? "고아 완료" : "Orphaned Completed"}
                            <span className="text-zinc-500 dark:text-zinc-400 font-normal ml-1">
                              ({cleanupData.orphaned_completed.length})
                            </span>
                          </h4>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDeleteOrphaned}
                          disabled={runningCleanup}
                          className="h-8 text-xs gap-1.5 border-zinc-300 dark:border-zinc-700"
                        >
                          {runningCleanup ? <Spinner className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                          {isKorean ? "삭제" : "Delete"}
                        </Button>
                      </div>
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="max-h-32 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                          {cleanupData.orphaned_completed.slice(0, 10).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                            >
                              <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate text-zinc-900 dark:text-zinc-100">{item.prompt}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{item.id}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {cleanupData.orphaned_completed.length > 10 && (
                          <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 text-center text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">
                            +{cleanupData.orphaned_completed.length - 10} {isKorean ? "개 더" : "more"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Failed Generations */}
                  {cleanupData.failed_generations.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {isKorean ? "실패한 작업" : "Failed Jobs"}
                            <span className="text-zinc-500 dark:text-zinc-400 font-normal ml-1">
                              ({cleanupData.failed_generations.length})
                            </span>
                          </h4>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDeleteFailed}
                          disabled={runningCleanup}
                          className="h-8 text-xs gap-1.5 border-zinc-300 dark:border-zinc-700"
                        >
                          {runningCleanup ? <Spinner className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                          {isKorean ? "전체 삭제" : "Delete All"}
                        </Button>
                      </div>
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                          {cleanupData.failed_generations.slice(0, 15).map((item) => (
                            <div
                              key={item.id}
                              className="px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                                  <XCircle className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate mb-1">{item.id}</p>
                                  <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                                    {item.error_message || "Unknown error"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {cleanupData.failed_generations.length > 15 && (
                          <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 text-center text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">
                            +{cleanupData.failed_generations.length - 15} {isKorean ? "개 더" : "more"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* All Clear */}
                  {cleanupData.summary.total_cleanup_candidates === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                        {isKorean ? "모두 정상입니다!" : "All Clear!"}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {isKorean
                          ? "정리할 항목이 없습니다"
                          : "No cleanup needed"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <Button
                variant="outline"
                onClick={() => setCleanupModalOpen(false)}
                className="border-zinc-300 dark:border-zinc-700"
              >
                {isKorean ? "닫기" : "Close"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
