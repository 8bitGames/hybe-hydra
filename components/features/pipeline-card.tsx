"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LazyVideo } from "@/components/ui/lazy-video";
import {
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Play,
  Pause,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PipelineItem } from "@/lib/pipeline-api";
import { useI18n } from "@/lib/i18n";

interface PipelineCardProps {
  pipeline: PipelineItem;
  campaignId: string;
  onViewDetail?: () => void;
  onSendToCuration?: () => void;
}

export function PipelineCard({
  pipeline,
  campaignId,
  onViewDetail,
  onSendToCuration,
}: PipelineCardProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Format date
  const formattedDate = useMemo(() => {
    const date = new Date(pipeline.created_at);
    return date.toLocaleDateString(isKorean ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [pipeline.created_at, isKorean]);

  // Status badge configuration
  const statusConfig = useMemo(() => {
    switch (pipeline.status) {
      case "completed":
        return {
          label: isKorean ? "완료" : "Completed",
          variant: "default" as const,
          icon: CheckCircle2,
          color: "text-green-500",
        };
      case "processing":
        return {
          label: isKorean ? "처리중" : "Processing",
          variant: "secondary" as const,
          icon: Loader2,
          color: "text-blue-500",
          animate: true,
        };
      case "partial_failure":
        return {
          label: isKorean ? "일부 실패" : "Partial Failure",
          variant: "destructive" as const,
          icon: XCircle,
          color: "text-yellow-500",
        };
      case "pending":
      default:
        return {
          label: isKorean ? "대기중" : "Pending",
          variant: "outline" as const,
          icon: Clock,
          color: "text-muted-foreground",
        };
    }
  }, [pipeline.status, isKorean]);

  const StatusIcon = statusConfig.icon;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {/* Seed Thumbnail */}
          <div className="relative w-32 h-20 bg-muted rounded-lg overflow-hidden shrink-0">
            {pipeline.seed_generation.output_url ? (
              <LazyVideo
                src={pipeline.seed_generation.output_url}
                className="w-full h-full object-cover"
                autoPlay={false}
                muted
                loop
                playsInline
              />
            ) : pipeline.seed_generation.composed_output_url ? (
              <LazyVideo
                src={pipeline.seed_generation.composed_output_url}
                className="w-full h-full object-cover"
                autoPlay={false}
                muted
                loop
                playsInline
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Layers className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Play className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Pipeline Info */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                {pipeline.campaign_name && (
                  <p className="text-xs text-primary font-medium mb-0.5">
                    {pipeline.campaign_name}
                  </p>
                )}
                <h3 className="font-medium text-sm truncate">
                  {pipeline.name || pipeline.seed_generation.prompt.slice(0, 50)}
                  {pipeline.seed_generation.prompt.length > 50 ? "..." : ""}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formattedDate}
                </p>
              </div>
              <Badge variant={statusConfig.variant} className="shrink-0">
                <StatusIcon
                  className={`w-3 h-3 mr-1 ${statusConfig.color} ${
                    statusConfig.animate ? "animate-spin" : ""
                  }`}
                />
                {statusConfig.label}
              </Badge>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {pipeline.total} {isKorean ? "변형" : "variations"}
              </span>
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                {pipeline.completed}
              </span>
              {pipeline.failed > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <XCircle className="w-3 h-3" />
                  {pipeline.failed}
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {pipeline.status === "processing" && (
              <div className="mb-2">
                <Progress value={pipeline.overall_progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">
                  {pipeline.overall_progress}% {isKorean ? "완료" : "complete"}
                </p>
              </div>
            )}

            {/* Style Categories */}
            {pipeline.style_categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {pipeline.style_categories.map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs py-0">
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t">
          <div className="flex items-center gap-2">
            <Link href={`/campaigns/${campaignId}/pipeline/${pipeline.batch_id}?seed=${pipeline.seed_generation_id}`}>
              <Button variant="outline" size="sm" onClick={onViewDetail}>
                {isKorean ? "상세보기" : "View Details"}
              </Button>
            </Link>
            {pipeline.status === "completed" && (
              <Button
                variant="default"
                size="sm"
                onClick={onSendToCuration}
                className="gap-1"
              >
                {isKorean ? "큐레이션으로" : "To Curation"}
                <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {pipeline.status === "processing" && (
                <DropdownMenuItem>
                  <Pause className="w-4 h-4 mr-2" />
                  {isKorean ? "일시정지" : "Pause"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive">
                <XCircle className="w-4 h-4 mr-2" />
                {isKorean ? "삭제" : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
