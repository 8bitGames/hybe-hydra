"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Film,
  Image,
  Layers,
  Music,
  Play,
  Wand2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { LazyVideo } from "@/components/ui/lazy-video";
import { PipelineItem, FastCutPipelineMetadata } from "../types";
import { PipelineStatusBadge } from "../shared/pipeline-status-badge";
import { PipelineProgressBar } from "../shared/pipeline-progress-bar";
import { PipelineActionsMenu } from "../shared/pipeline-actions-menu";

interface FastCutPipelineCardProps {
  pipeline: PipelineItem;
  metadata?: FastCutPipelineMetadata;
  onDelete?: (pipeline: PipelineItem) => void;
  className?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function FastCutPipelineCard({
  pipeline,
  metadata,
  onDelete,
  className,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: FastCutPipelineCardProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const handleDelete = () => {
    onDelete?.(pipeline);
  };

  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect();
    }
  };

  // Get video URL from compose output
  const videoUrl =
    pipeline.seed_generation.composed_output_url ||
    pipeline.seed_generation.output_url;

  return (
    <Card
      className={cn(
        "overflow-hidden hover:shadow-md transition-shadow group",
        selectionMode && "cursor-pointer",
        isSelected && "ring-2 ring-primary bg-primary/5",
        className
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {/* Selection Checkbox */}
          {selectionMode && (
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
              />
            </div>
          )}
          {/* Thumbnail */}
          <div className="relative w-28 h-20 bg-muted rounded-lg overflow-hidden shrink-0">
            {videoUrl ? (
              <LazyVideo
                src={videoUrl}
                className="w-full h-full object-cover"
                autoPlay={false}
                muted
                loop
                playsInline
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-6 h-6 text-white" />
            </div>
            {/* Compose Type Badge */}
            <div className="absolute top-1 left-1">
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                <Wand2 className="w-2.5 h-2.5 mr-0.5" />
                Compose
              </Badge>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                {pipeline.campaign_name && (
                  <p className="text-xs text-muted-foreground font-medium truncate">
                    {pipeline.campaign_name}
                  </p>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="font-medium text-sm truncate cursor-default">
                      {pipeline.seed_generation.prompt.slice(0, 60)}
                      {pipeline.seed_generation.prompt.length > 60 ? "..." : ""}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-md">
                    <p>{pipeline.seed_generation.prompt}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <PipelineStatusBadge status={pipeline.status} size="sm" />
            </div>

            {/* Compose-specific Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span className="font-medium">{pipeline.completed}</span>
                /{pipeline.total}
              </span>
              {metadata?.imageCount && (
                <span className="flex items-center gap-1">
                  <Image className="w-3 h-3" />
                  {metadata.imageCount}
                </span>
              )}
              {metadata?.audioTrack && (
                <span className="flex items-center gap-1">
                  <Music className="w-3 h-3" />
                </span>
              )}
              {pipeline.failed > 0 && (
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {pipeline.failed}
                </span>
              )}
              <span className="flex-1" />
              <span>
                {new Date(pipeline.created_at).toLocaleDateString(
                  isKorean ? "ko-KR" : "en-US",
                  { month: "short", day: "numeric" }
                )}
              </span>
            </div>

            {/* Progress */}
            {pipeline.status === "processing" && (
              <PipelineProgressBar
                progress={pipeline.overall_progress}
                completed={pipeline.completed}
                total={pipeline.total}
                failed={pipeline.failed}
                showStats={false}
                size="sm"
                className="mt-2"
              />
            )}
          </div>
        </div>

        {/* Keywords/Tags */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t">
          <div className="flex items-center gap-1.5">
            {metadata?.keywords?.slice(0, 3).map((keyword) => (
              <Badge
                key={keyword}
                variant="outline"
                className="text-xs py-0 bg-background"
              >
                #{keyword}
              </Badge>
            ))}
            {(metadata?.keywords?.length || 0) > 3 && (
              <Badge
                variant="outline"
                className="text-xs py-0 bg-background"
              >
                +{(metadata?.keywords?.length || 0) - 3}
              </Badge>
            )}
            {!metadata?.keywords?.length && pipeline.style_categories.length > 0 && (
              <>
                {pipeline.style_categories.slice(0, 2).map((cat) => (
                  <Badge
                    key={cat}
                    variant="outline"
                    className="text-xs py-0 bg-background"
                  >
                    {cat}
                  </Badge>
                ))}
              </>
            )}
          </div>
          <PipelineActionsMenu
            pipeline={pipeline}
            pipelineType="fast-cut"
            onDelete={handleDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}
