"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";
import { pipelineApi, PipelineItem } from "@/lib/pipeline-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  Plus,
  RefreshCw,
  Filter,
  Search,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PipelineCard } from "@/components/features/pipeline-card";
import { useI18n } from "@/lib/i18n";

type StatusFilter = "all" | "pending" | "processing" | "completed" | "partial_failure";

export default function PipelineManagementPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const { t, language } = useI18n();
  const isKorean = language === "ko";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch campaign data
  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const response = await campaignsApi.getById(campaignId);
        if (response.data) {
          setCampaign(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch campaign:", error);
      }
    };
    fetchCampaign();
  }, [campaignId]);

  // Fetch pipelines
  const fetchPipelines = useCallback(async () => {
    try {
      const response = await pipelineApi.list(campaignId);
      setPipelines(response.items);
    } catch (error) {
      console.error("Failed to fetch pipelines:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

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
    fetchPipelines();
  };

  // Filter pipelines
  const filteredPipelines = pipelines.filter((pipeline) => {
    // Status filter
    if (statusFilter !== "all" && pipeline.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesPrompt = pipeline.seed_generation.prompt
        .toLowerCase()
        .includes(query);
      const matchesCategories = pipeline.style_categories.some((cat) =>
        cat.toLowerCase().includes(query)
      );
      return matchesPrompt || matchesCategories;
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
            {isKorean ? "파이프라인 관리" : "Pipeline Management"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isKorean
              ? "변형 생성 작업을 모니터링하고 관리합니다"
              : "Monitor and manage variation generation jobs"}
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
          <Button
            onClick={() => router.push(`/campaigns/${campaignId}/generate`)}
          >
            <Plus className="w-4 h-4 mr-2" />
            {isKorean ? "새 변형 생성" : "New Variation"}
          </Button>
        </div>
      </div>

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
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={isKorean ? "프롬프트 또는 카테고리 검색..." : "Search prompts or categories..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
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
                ? "완료된 영상이 있으면 글로벌 Pipeline 페이지에서 변형을 생성할 수 있습니다"
                : "If you have completed videos, you can create variations from the global Pipeline page"}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => router.push(`/campaigns/${campaignId}/generate`)}>
                {isKorean ? "AI 영상 생성" : "Generate AI Video"}
              </Button>
              <Button onClick={() => router.push("/pipeline")}>
                <Layers className="w-4 h-4 mr-2" />
                {isKorean ? "Pipeline으로 이동" : "Go to Pipeline"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPipelines.map((pipeline) => (
            <PipelineCard
              key={pipeline.batch_id}
              pipeline={pipeline}
              campaignId={campaignId}
              onSendToCuration={() => {
                router.push(`/campaigns/${campaignId}/curation`);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
