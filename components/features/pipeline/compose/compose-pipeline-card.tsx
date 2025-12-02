"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { PipelineItem, ComposePipelineMetadata } from "../types";
import { PipelineStatusBadge } from "../shared/pipeline-status-badge";
import { PipelineProgressBar } from "../shared/pipeline-progress-bar";
import { PipelineActionsMenu } from "../shared/pipeline-actions-menu";

interface ComposePipelineCardProps {
  pipeline: PipelineItem;
  metadata?: ComposePipelineMetadata;
  onCreateVariations?: (pipeline: PipelineItem) => void;
  onDelete?: (pipeline: PipelineItem) => void;
  className?: string;
}

export function ComposePipelineCard({
  pipeline,
  metadata,
  onCreateVariations,
  onDelete,
  className,
}: ComposePipelineCardProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const handleCreateVariations = () => {
    onCreateVariations?.(pipeline);
  };

  const handleDelete = () => {
    onDelete?.(pipeline);
  };

  // Get video URL from compose output
  const videoUrl =
    pipeline.seed_generation.composed_output_url ||
    pipeline.seed_generation.output_url;

  return (
    <Card
      className={cn(
        "overflow-hidden hover:shadow-md transition-shadow group",
        "border-purple-500/20",
        className
      )}
    >
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {/* Thumbnail */}
          <div className="relative w-28 h-20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg overflow-hidden shrink-0">
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
                <Film className="w-6 h-6 text-purple-400" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-6 h-6 text-white" />
            </div>
            {/* Compose Type Badge */}
            <div className="absolute top-1 left-1">
              <Badge className="bg-purple-500/90 text-white text-[10px] px-1 py-0">
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
                  <p className="text-xs text-purple-500 font-medium truncate">
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
                <span className="text-green-600 font-medium">{pipeline.completed}</span>
                /{pipeline.total}
              </span>
              {metadata?.imageCount && (
                <span className="flex items-center gap-1 text-purple-500">
                  <Image className="w-3 h-3" />
                  {metadata.imageCount}
                </span>
              )}
              {metadata?.audioTrack && (
                <span className="flex items-center gap-1 text-pink-500">
                  <Music className="w-3 h-3" />
                </span>
              )}
              {pipeline.failed > 0 && (
                <span className="flex items-center gap-1 text-red-500">
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
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-purple-500/5 to-pink-500/5 border-t border-purple-500/10">
          <div className="flex items-center gap-1.5">
            {metadata?.keywords?.slice(0, 3).map((keyword) => (
              <Badge
                key={keyword}
                variant="outline"
                className="text-xs py-0 bg-background border-purple-500/30 text-purple-600"
              >
                #{keyword}
              </Badge>
            ))}
            {(metadata?.keywords?.length || 0) > 3 && (
              <Badge
                variant="outline"
                className="text-xs py-0 bg-background border-purple-500/30"
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
            pipelineType="compose"
            onCreateVariations={handleCreateVariations}
            onDelete={handleDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}
