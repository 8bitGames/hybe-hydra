"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";
import { pipelineApi, PipelineItem } from "@/lib/pipeline-api";
import { presetsApi, StylePreset, variationsApi, VariationConfigRequest, videoApi, VideoGeneration } from "@/lib/video-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Filter,
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PipelineCard } from "@/components/features/pipeline-card";
import { VariationModal, VariationConfig } from "@/components/features/variation-modal";
import { LazyVideo } from "@/components/ui/lazy-video";
import { useI18n } from "@/lib/i18n";

type StatusFilter = "all" | "pending" | "processing" | "completed" | "partial_failure";
type VideoType = "ai" | "compose";

// Extended VideoGeneration with campaign info
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

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [seedCampaignFilter, setSeedCampaignFilter] = useState<string>("all");
  const [seedSearchQuery, setSeedSearchQuery] = useState("");
  const [composeCampaignFilter, setComposeCampaignFilter] = useState<string>("all");
  const [composeSearchQuery, setComposeSearchQuery] = useState("");

  // Auto-pipeline state for compose videos
  const [creatingAutoPipeline, setCreatingAutoPipeline] = useState(false);

  // Variation modal state
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [selectedSeedGeneration, setSelectedSeedGeneration] = useState<VideoGeneration | null>(null);
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [creatingVariations, setCreatingVariations] = useState(false);

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

      // Fetch completed videos from all campaigns
      const results = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const response = await videoApi.getAll(campaign.id, {
              status: "completed",
              page_size: 50,
            });
            if (response.data) {
              return response.data.items
                .filter((video: VideoGeneration) => !video.id.startsWith("compose-")) // Exclude compose videos
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

      // Combine and sort by created_at
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

      // Fetch completed videos from all campaigns
      const results = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const response = await videoApi.getAll(campaign.id, {
              status: "completed",
              page_size: 50,
            });
            if (response.data) {
              return response.data.items
                .filter((video: VideoGeneration) => video.id.startsWith("compose-")) // Only compose videos
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

      // Combine and sort by created_at
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

  // Fetch seed candidates when tab changes to "create"
  useEffect(() => {
    if (activeTab === "create" && campaigns.length > 0 && seedCandidates.length === 0) {
      fetchSeedCandidates();
    }
  }, [activeTab, campaigns, seedCandidates.length, fetchSeedCandidates]);

  // Fetch compose candidates when tab changes to "compose"
  useEffect(() => {
    if (activeTab === "compose" && campaigns.length > 0 && composeCandidates.length === 0) {
      fetchComposeCandidates();
    }
  }, [activeTab, campaigns, composeCandidates.length, fetchComposeCandidates]);

  // Auto-refresh for processing pipelines
  useEffect(() => {
    const hasProcessing = pipelines.some((p) => p.status === "processing");
    if (hasProcessing) {
      const interval = setInterval(fetchPipelines, 5000);
      return () => clearInterval(interval);
    }
  }, [pipelines, fetchPipelines]);

  // Handle refresh
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

  // Auto-pipeline for compose videos (automatic preset selection)
  const handleAutoCreateVariations = async (video: VideoGeneration) => {
    setCreatingAutoPipeline(true);
    try {
      // Auto-select presets optimized for compose videos (slideshow content)
      // Uses "mood" and "motion" categories which work well with slideshow videos
      const autoConfig: VariationConfigRequest = {
        style_categories: ["mood", "motion"], // Best for slideshow content
        enable_prompt_variation: false, // Keep original prompt for compose
        prompt_variation_types: [],
        max_variations: 4, // Reasonable default
      };

      await variationsApi.create(video.id, autoConfig);
      setActiveTab("pipelines");
      fetchPipelines(); // Refresh to show new pipeline
    } catch (error) {
      console.error("Failed to create auto variations:", error);
    } finally {
      setCreatingAutoPipeline(false);
    }
  };

  // Open variation modal for creating variations from a seed video
  const handleSelectSeed = (video: VideoGeneration) => {
    setSelectedSeedGeneration(video);
    setVariationModalOpen(true);
  };

  // Open variation modal for creating more variations from a completed pipeline
  const handleCreateMoreVariations = (pipeline: PipelineItem) => {
    setSelectedSeedGeneration(pipeline.seed_generation);
    setVariationModalOpen(true);
  };

  // Create variations
  const handleCreateVariations = async (config: VariationConfig) => {
    if (!selectedSeedGeneration) return;

    setCreatingVariations(true);
    try {
      const requestConfig: VariationConfigRequest = {
        style_categories: config.styleCategories,
        enable_prompt_variation: config.enablePromptVariation,
        prompt_variation_types: config.promptVariationTypes,
        max_variations: config.maxVariations,
      };

      await variationsApi.create(selectedSeedGeneration.id, requestConfig);
      setVariationModalOpen(false);
      setActiveTab("pipelines");
      fetchPipelines(); // Refresh to show new pipeline
    } catch (error) {
      console.error("Failed to create variations:", error);
    } finally {
      setCreatingVariations(false);
    }
  };

  // Filter pipelines
  const filteredPipelines = pipelines.filter((pipeline) => {
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
  const stats = {
    total: pipelines.length,
    processing: pipelines.filter((p) => p.status === "processing").length,
    completed: pipelines.filter((p) => p.status === "completed").length,
    failed: pipelines.filter((p) => p.status === "partial_failure").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6" />
            {isKorean ? "파이프라인" : "Pipeline"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isKorean
              ? "기존 영상을 선택하여 다양한 변형을 생성하세요"
              : "Select existing videos to create various variations"}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="pipelines" className="gap-2">
            <Layers className="w-4 h-4" />
            {isKorean ? "파이프라인" : "Pipelines"}
            {stats.processing > 0 && (
              <Badge variant="secondary" className="ml-1">
                {stats.processing}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <Video className="w-4 h-4" />
            {isKorean ? "AI 영상" : "AI Videos"}
          </TabsTrigger>
          <TabsTrigger value="compose" className="gap-2">
            <Film className="w-4 h-4" />
            {isKorean ? "Compose 영상" : "Compose"}
            {composeCandidates.length > 0 && (
              <Badge variant="outline" className="ml-1">
                {composeCandidates.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pipelines Tab */}
        <TabsContent value="pipelines" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {isKorean ? "전체 파이프라인" : "Total Pipelines"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-500">
                  {stats.processing}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isKorean ? "처리중" : "Processing"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-500">
                  {stats.completed}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isKorean ? "완료" : "Completed"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-500">
                  {stats.failed}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isKorean ? "일부 실패" : "Partial Failure"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isKorean ? "검색..." : "Search..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-48">
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
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isKorean ? "전체" : "All"}</SelectItem>
                <SelectItem value="pending">{isKorean ? "대기중" : "Pending"}</SelectItem>
                <SelectItem value="processing">{isKorean ? "처리중" : "Processing"}</SelectItem>
                <SelectItem value="completed">{isKorean ? "완료" : "Completed"}</SelectItem>
                <SelectItem value="partial_failure">{isKorean ? "일부 실패" : "Partial Failure"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline List */}
          {filteredPipelines.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {isKorean ? "파이프라인이 없습니다" : "No Pipelines Yet"}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {isKorean
                    ? "'새 변형 생성' 탭에서 영상을 선택하여 파이프라인을 시작하세요"
                    : "Select a video from the 'Create New' tab to start a pipeline"}
                </p>
                <Button onClick={() => setActiveTab("create")}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isKorean ? "새 변형 생성" : "Create New Variation"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredPipelines.map((pipeline) => (
                <div key={pipeline.batch_id} className="relative">
                  <PipelineCard
                    pipeline={pipeline}
                    campaignId={pipeline.campaign_id}
                    onSendToCuration={() => {
                      router.push(`/campaigns/${pipeline.campaign_id}/curation`);
                    }}
                  />
                  {/* Create More Variations Button */}
                  {pipeline.status === "completed" && (
                    <div className="absolute top-4 right-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateMoreVariations(pipeline)}
                        className="border-primary/50 text-primary hover:bg-primary/10"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {isKorean ? "추가 변형" : "More Variations"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Create New Tab - Seed Selection */}
        <TabsContent value="create" className="space-y-6">
          {/* Header Info */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium">
                    {isKorean ? "Seed 영상 선택" : "Select Seed Video"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isKorean
                      ? "아래에서 완료된 영상을 선택하면 해당 영상의 설정을 기반으로 다양한 변형을 생성할 수 있습니다."
                      : "Select a completed video below to create various variations based on its settings."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isKorean ? "프롬프트 검색..." : "Search prompts..."}
                value={seedSearchQuery}
                onChange={(e) => setSeedSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={seedCampaignFilter} onValueChange={setSeedCampaignFilter}>
              <SelectTrigger className="w-48">
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
          </div>

          {/* Seed Videos Grid */}
          {loadingSeeds ? (
            <div className="flex items-center justify-center h-48">
              <Spinner className="w-8 h-8" />
            </div>
          ) : filteredSeedCandidates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {isKorean ? "완료된 영상이 없습니다" : "No Completed Videos"}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {isKorean
                    ? "캠페인의 Generate 페이지에서 먼저 영상을 생성해주세요"
                    : "Create videos on a campaign's Generate page first"}
                </p>
                <Button onClick={() => router.push("/campaigns")}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {isKorean ? "캠페인으로 이동" : "Go to Campaigns"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSeedCandidates.map((video) => (
                <Card
                  key={video.id}
                  className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => handleSelectSeed(video)}
                >
                  <CardContent className="p-0">
                    {/* Video Thumbnail */}
                    <div className="relative aspect-video bg-muted">
                      {video.output_url ? (
                        <LazyVideo
                          src={video.output_url}
                          className="w-full h-full object-cover"
                          autoPlay={false}
                          muted
                          loop
                          playsInline
                        />
                      ) : video.composed_output_url ? (
                        <LazyVideo
                          src={video.composed_output_url}
                          className="w-full h-full object-cover"
                          autoPlay={false}
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="secondary" size="sm">
                          <Sparkles className="w-4 h-4 mr-2" />
                          {isKorean ? "변형 생성" : "Create Variations"}
                        </Button>
                      </div>
                      {/* Status Badge */}
                      <div className="absolute top-2 right-2">
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {isKorean ? "완료" : "Completed"}
                        </Badge>
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="p-3 space-y-2">
                      {/* Campaign Name */}
                      {video.campaign_name && (
                        <p className="text-xs text-primary font-medium">
                          {video.campaign_name}
                        </p>
                      )}

                      {/* Prompt */}
                      <p className="text-sm line-clamp-2">
                        {video.prompt}
                      </p>

                      {/* Meta Info */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration_seconds}s
                        </span>
                        {video.audio_asset && (
                          <span className="flex items-center gap-1">
                            <Music className="w-3 h-3" />
                            {isKorean ? "오디오" : "Audio"}
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

        {/* Compose Videos Tab - Auto Pipeline */}
        <TabsContent value="compose" className="space-y-6">
          {/* Header Info */}
          <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-purple-500 mt-0.5" />
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    {isKorean ? "Compose 영상 자동 파이프라인" : "Compose Auto Pipeline"}
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      Auto
                    </Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isKorean
                      ? "Compose로 만든 슬라이드쇼 영상입니다. 원클릭으로 최적화된 변형을 자동 생성하거나, 수동으로 세부 설정을 선택할 수 있습니다."
                      : "Slideshow videos created with Compose. Create optimized variations with one click, or manually select detailed settings."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isKorean ? "프롬프트 검색..." : "Search prompts..."}
                value={composeSearchQuery}
                onChange={(e) => setComposeSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={composeCampaignFilter} onValueChange={setComposeCampaignFilter}>
              <SelectTrigger className="w-48">
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
          </div>

          {/* Compose Videos Grid */}
          {loadingCompose ? (
            <div className="flex items-center justify-center h-48">
              <Spinner className="w-8 h-8" />
            </div>
          ) : filteredComposeCandidates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Film className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {isKorean ? "Compose 영상이 없습니다" : "No Compose Videos"}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {isKorean
                    ? "Compose 페이지에서 슬라이드쇼 영상을 먼저 생성해주세요"
                    : "Create slideshow videos on the Compose page first"}
                </p>
                <Button onClick={() => router.push("/compose")}>
                  <Wand2 className="w-4 h-4 mr-2" />
                  {isKorean ? "Compose로 이동" : "Go to Compose"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredComposeCandidates.map((video) => (
                <Card
                  key={video.id}
                  className="overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <CardContent className="p-0">
                    {/* Video Thumbnail */}
                    <div className="relative aspect-video bg-muted">
                      {video.composed_output_url ? (
                        <LazyVideo
                          src={video.composed_output_url}
                          className="w-full h-full object-cover"
                          autoPlay={false}
                          muted
                          loop
                          playsInline
                        />
                      ) : video.output_url ? (
                        <LazyVideo
                          src={video.output_url}
                          className="w-full h-full object-cover"
                          autoPlay={false}
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      {/* Type Badge */}
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="bg-purple-500/90 text-white">
                          <Wand2 className="w-3 h-3 mr-1" />
                          Compose
                        </Badge>
                      </div>
                      {/* Status Badge */}
                      <div className="absolute top-2 right-2">
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {isKorean ? "완료" : "Completed"}
                        </Badge>
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="p-3 space-y-2">
                      {/* Campaign Name */}
                      {video.campaign_name && (
                        <p className="text-xs text-purple-500 font-medium">
                          {video.campaign_name}
                        </p>
                      )}

                      {/* Prompt */}
                      <p className="text-sm line-clamp-2">
                        {video.prompt}
                      </p>

                      {/* Meta Info */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration_seconds}s
                        </span>
                        {video.audio_asset && (
                          <span className="flex items-center gap-1">
                            <Music className="w-3 h-3" />
                            {isKorean ? "오디오" : "Audio"}
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
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                          onClick={() => handleAutoCreateVariations(video)}
                          disabled={creatingAutoPipeline}
                        >
                          {creatingAutoPipeline ? (
                            <Spinner className="w-4 h-4 mr-2" />
                          ) : (
                            <Zap className="w-4 h-4 mr-2" />
                          )}
                          {isKorean ? "자동 변형" : "Auto Generate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectSeed(video)}
                        >
                          <Sparkles className="w-4 h-4" />
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

      {/* Variation Modal */}
      <VariationModal
        isOpen={variationModalOpen}
        onClose={() => setVariationModalOpen(false)}
        seedGeneration={selectedSeedGeneration}
        presets={presets}
        onCreateVariations={handleCreateVariations}
        isCreating={creatingVariations}
      />
    </div>
  );
}
