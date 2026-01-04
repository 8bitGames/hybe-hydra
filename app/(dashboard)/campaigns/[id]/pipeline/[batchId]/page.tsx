"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Layers,
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
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Get proxied URL for S3/GCS video URLs
 * Private bucket URLs need to be proxied through our API for browser access
 */
function getVideoProxyUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // Check for GCS URLs
  const isGcsUrl = url.includes('storage.googleapis.com/') || url.includes('storage.cloud.google.com/');
  if (isGcsUrl) {
    return `/api/v1/assets/proxy?url=${encodeURIComponent(url)}`;
  }
  // Check for S3 URLs
  const isS3Url = url.includes('.s3.') && url.includes('.amazonaws.com');
  if (isS3Url) {
    return `/api/v1/assets/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

type ViewMode = "grid" | "list";

export default function PipelineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const campaignId = params.id as string;
  const batchId = params.batchId as string;
  const seedGenerationId = searchParams.get("seed") || "";
  const { language } = useI18n();
  const isKorean = language === "ko";

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Use TanStack Query for pipeline detail with caching
  const { data: pipeline, isLoading: loading, refetch } = useQuery({
    queryKey: ["pipeline", seedGenerationId, batchId],
    queryFn: async () => {
      const data = await pipelineApi.getDetail(seedGenerationId, batchId);
      return data;
    },
    enabled: !!seedGenerationId && !!batchId,
    staleTime: 30 * 1000, // 30 seconds for pipeline data
    refetchInterval: (query) => {
      // Auto-refetch every 5 seconds if processing
      const data = query.state.data as PipelineDetail | undefined;
      return data?.batch_status === "processing" ? 5000 : false;
    },
  });

  const handleRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
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
          color: "text-blue-500",
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
          {isKorean ? "베리에이션을 찾을 수 없습니다" : "Variation not found"}
        </p>
        <Link href={`/campaigns/${campaignId}/pipeline`}>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/campaigns/${campaignId}/pipeline`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5" />
            {isKorean ? "베리에이션 상세" : "Variation Detail"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pipeline.seed_generation.prompt.slice(0, 80)}
            {pipeline.seed_generation.prompt.length > 80 ? "..." : ""}
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
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
        <Card>
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            {isKorean ? "시드 영상 (원본)" : "Seed Video (Original)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-48 h-28 bg-muted rounded-lg overflow-hidden shrink-0">
              {pipeline.seed_generation.output_url ? (
                <LazyVideo
                  src={getVideoProxyUrl(pipeline.seed_generation.output_url)!}
                  className="w-full h-full object-cover"
                  controls
                  muted
                  playsInline
                />
              ) : pipeline.seed_generation.composed_output_url ? (
                <LazyVideo
                  src={getVideoProxyUrl(pipeline.seed_generation.composed_output_url)!}
                  className="w-full h-full object-cover"
                  controls
                  muted
                  playsInline
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm line-clamp-2 mb-2">{pipeline.seed_generation.prompt}</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{pipeline.seed_generation.duration_seconds}s</span>
                <span>{pipeline.seed_generation.aspect_ratio}</span>
                {pipeline.seed_generation.quality_score && (
                  <Badge variant="secondary" className="text-xs">
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
              className={`overflow-hidden transition-all ${
                isSelected ? "ring-2 ring-primary" : ""
              } ${isCompleted ? "cursor-pointer" : "opacity-70"}`}
              onClick={() => isCompleted && toggleSelection(variation.id)}
            >
              <CardContent className="p-0">
                {/* Video Thumbnail */}
                <div className="relative aspect-video bg-muted">
                  {variation.generation?.output_url ? (
                    <LazyVideo
                      src={getVideoProxyUrl(variation.generation.output_url)!}
                      className="w-full h-full object-cover"
                      autoPlay={false}
                      muted
                      loop
                      playsInline
                    />
                  ) : variation.generation?.composed_output_url ? (
                    <LazyVideo
                      src={getVideoProxyUrl(variation.generation.composed_output_url)!}
                      className="w-full h-full object-cover"
                      autoPlay={false}
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {variation.status === "processing" ? (
                        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
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
                      className="text-xs"
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
                      <Badge variant="secondary" className="text-xs">
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
                        className="text-xs py-0"
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
