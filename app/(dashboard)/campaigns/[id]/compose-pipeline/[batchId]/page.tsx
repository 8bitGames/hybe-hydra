"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { pipelineApi, PipelineDetail, PipelineVariation } from "@/lib/pipeline-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { LazyVideo } from "@/components/ui/lazy-video";
import {
  ArrowLeft,
  Wand2,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Play,
  RefreshCw,
  Star,
  ArrowRight,
  Grid3X3,
  List,
  Image,
  Music,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

type ViewMode = "grid" | "list";

export default function ComposePipelineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const batchId = params.batchId as string;
  const seedGenerationId = searchParams.get("seed") || "";
  const { language } = useI18n();
  const isKorean = language === "ko";

  const [pipeline, setPipeline] = useState<PipelineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch pipeline detail
  const fetchPipeline = useCallback(async () => {
    if (!seedGenerationId) return;
    try {
      const data = await pipelineApi.getDetail(seedGenerationId, batchId);
      setPipeline(data);
    } catch (error) {
      console.error("Failed to fetch pipeline:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [batchId, seedGenerationId]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  // Auto-refresh for processing pipeline
  useEffect(() => {
    if (pipeline?.batch_status === "processing") {
      const interval = setInterval(fetchPipeline, 5000);
      return () => clearInterval(interval);
    }
  }, [pipeline, fetchPipeline]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPipeline();
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!pipeline) return;
    const completedIds = pipeline.variations
      .filter((v) => v.status === "completed")
      .map((v) => v.id);
    setSelectedIds(new Set(completedIds));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Status config
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return {
          label: isKorean ? "완료" : "Completed",
          icon: CheckCircle2,
          color: "text-green-500",
        };
      case "processing":
        return {
          label: isKorean ? "처리중" : "Processing",
          icon: Loader2,
          color: "text-purple-500",
          animate: true,
        };
      case "failed":
        return {
          label: isKorean ? "실패" : "Failed",
          icon: XCircle,
          color: "text-red-500",
        };
      default:
        return {
          label: isKorean ? "대기중" : "Pending",
          icon: Clock,
          color: "text-muted-foreground",
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

  if (!pipeline) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {isKorean ? "파이프라인을 찾을 수 없습니다" : "Pipeline not found"}
        </p>
        <Link href="/pipeline">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isKorean ? "목록으로" : "Back to List"}
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig = getStatusConfig(pipeline.batch_status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6 px-[7%]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pipeline">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            {isKorean ? "Compose 파이프라인 상세" : "Compose Pipeline Detail"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pipeline.seed_generation.prompt.slice(0, 80)}
            {pipeline.seed_generation.prompt.length > 80 ? "..." : ""}
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1 bg-purple-500/10 text-purple-600">
          <StatusIcon
            className={`w-3 h-3 ${statusConfig.color} ${
              statusConfig.animate ? "animate-spin" : ""
            }`}
          />
          {statusConfig.label}
        </Badge>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {isKorean ? "새로고침" : "Refresh"}
        </Button>
      </div>

      {/* Progress */}
      {pipeline.batch_status === "processing" && (
        <Card className="border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {isKorean ? "진행률" : "Progress"}
              </span>
              <span className="text-sm text-muted-foreground">
                {pipeline.completed}/{pipeline.total} ({pipeline.overall_progress}%)
              </span>
            </div>
            <Progress value={pipeline.overall_progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Seed Generation */}
      <Card className="border-purple-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-500" />
            {isKorean ? "시드 영상 (원본)" : "Seed Video (Original)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-48 h-28 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg overflow-hidden shrink-0">
              {pipeline.seed_generation.composed_output_url ? (
                <LazyVideo
                  src={pipeline.seed_generation.composed_output_url}
                  className="w-full h-full object-cover"
                  controls
                  muted
                  playsInline
                />
              ) : pipeline.seed_generation.output_url ? (
                <LazyVideo
                  src={pipeline.seed_generation.output_url}
                  className="w-full h-full object-cover"
                  controls
                  muted
                  playsInline
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-8 h-8 text-purple-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm line-clamp-2 mb-2">{pipeline.seed_generation.prompt}</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Image className="w-3 h-3" />
                  {isKorean ? "이미지 컴포즈" : "Image Compose"}
                </span>
                <span>{pipeline.seed_generation.duration_seconds}s</span>
                <span>{pipeline.seed_generation.aspect_ratio}</span>
                {pipeline.seed_generation.quality_score && (
                  <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600">
                    Score: {pipeline.seed_generation.quality_score}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variations Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {isKorean ? "변형 영상" : "Variations"} ({pipeline.variations.length})
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            {pipeline.completed}
            {pipeline.failed > 0 && (
              <>
                <XCircle className="w-4 h-4 text-red-500 ml-2" />
                {pipeline.failed}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? (
              <List className="w-4 h-4" />
            ) : (
              <Grid3X3 className="w-4 h-4" />
            )}
          </Button>
          {selectedIds.size > 0 ? (
            <Button variant="outline" size="sm" onClick={deselectAll}>
              {isKorean ? "선택 해제" : "Deselect All"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={selectAll}>
              {isKorean ? "완료된 항목 선택" : "Select Completed"}
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              className="bg-purple-500 hover:bg-purple-600"
              onClick={() => router.push(`/campaigns/${campaignId}/curation`)}
            >
              {isKorean
                ? `${selectedIds.size}개 큐레이션으로`
                : `${selectedIds.size} to Curation`}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Variations Grid */}
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            : "flex flex-col gap-3"
        }
      >
        {pipeline.variations.map((variation) => {
          const varStatus = getStatusConfig(variation.status);
          const VarStatusIcon = varStatus.icon;
          const isSelected = selectedIds.has(variation.id);
          const isCompleted = variation.status === "completed";

          return (
            <Card
              key={variation.id}
              className={`overflow-hidden transition-all border-purple-500/10 ${
                isSelected ? "ring-2 ring-purple-500" : ""
              } ${isCompleted ? "cursor-pointer" : "opacity-70"}`}
              onClick={() => isCompleted && toggleSelection(variation.id)}
            >
              <CardContent className="p-0">
                {/* Video Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-purple-500/5 to-pink-500/5">
                  {variation.generation?.composed_output_url ? (
                    <LazyVideo
                      src={variation.generation.composed_output_url}
                      className="w-full h-full object-cover"
                      autoPlay={false}
                      muted
                      loop
                      playsInline
                    />
                  ) : variation.generation?.output_url ? (
                    <LazyVideo
                      src={variation.generation.output_url}
                      className="w-full h-full object-cover"
                      autoPlay={false}
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {variation.status === "processing" ? (
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                      ) : variation.status === "failed" ? (
                        <XCircle className="w-8 h-8 text-red-500" />
                      ) : (
                        <Clock className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {isCompleted && (
                    <div className="absolute top-2 left-2">
                      <Checkbox
                        checked={isSelected}
                        className="bg-background/80"
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleSelection(variation.id)}
                      />
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant={isCompleted ? "secondary" : "outline"}
                      className="text-xs bg-purple-500/10"
                    >
                      <VarStatusIcon
                        className={`w-3 h-3 mr-1 ${varStatus.color} ${
                          varStatus.animate ? "animate-spin" : ""
                        }`}
                      />
                      {varStatus.label}
                    </Badge>
                  </div>

                  {/* Quality score */}
                  {variation.generation?.quality_score && (
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600">
                        {variation.generation.quality_score}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-medium truncate mb-1">
                    {variation.variation_label}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {variation.applied_presets.slice(0, 2).map((preset) => (
                      <Badge
                        key={preset.id}
                        variant="outline"
                        className="text-xs py-0 border-purple-500/30 text-purple-600"
                      >
                        {preset.name}
                      </Badge>
                    ))}
                    {variation.applied_presets.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{variation.applied_presets.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
