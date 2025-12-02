"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Film, Image, Music, Wand2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LazyVideo } from "@/components/ui/lazy-video";
import { PipelineItem, ComposePipelineMetadata } from "../types";
import { PipelineStatusBadge } from "../shared/pipeline-status-badge";
import { PipelineActionsMenu } from "../shared/pipeline-actions-menu";

interface ComposePipelineTableRowProps {
  pipeline: PipelineItem;
  metadata?: ComposePipelineMetadata;
  onCreateVariations?: (pipeline: PipelineItem) => void;
  onDelete?: (pipeline: PipelineItem) => void;
}

export function ComposePipelineTableRow({
  pipeline,
  metadata,
  onCreateVariations,
  onDelete,
}: ComposePipelineTableRowProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const handleCreateVariations = () => {
    onCreateVariations?.(pipeline);
  };

  const handleDelete = () => {
    onDelete?.(pipeline);
  };

  const videoUrl =
    pipeline.seed_generation.composed_output_url ||
    pipeline.seed_generation.output_url;

  return (
    <tr className="hover:bg-purple-500/5 transition-colors group">
      {/* Preview */}
      <td className="px-4 py-3">
        <div className="relative w-16 h-10 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded overflow-hidden flex-shrink-0">
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
              <Film className="w-4 h-4 text-purple-400" />
            </div>
          )}
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3 text-center">
        <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-2 py-0.5">
          <Wand2 className="w-3 h-3 mr-1" />
          Compose
        </Badge>
      </td>

      {/* Campaign */}
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className="font-normal whitespace-nowrap border-purple-500/30"
        >
          {pipeline.campaign_name || "Unknown"}
        </Badge>
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-center">
        <PipelineStatusBadge status={pipeline.status} />
      </td>

      {/* Variations */}
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className="text-green-600 font-medium">{pipeline.completed}</span>
          <span className="text-muted-foreground">/</span>
          <span>{pipeline.total}</span>
        </span>
      </td>

      {/* Progress */}
      <td className="px-4 py-3">
        <div className="w-24 mx-auto">
          <Progress value={pipeline.overall_progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground text-center mt-1">
            {pipeline.overall_progress}%
          </p>
        </div>
      </td>

      {/* Compose-specific info (Images/Audio) */}
      <td className="px-4 py-3">
        <div className="flex flex-nowrap gap-2">
          {metadata?.imageCount && (
            <span className="flex items-center gap-1 text-xs text-purple-500">
              <Image className="w-3 h-3" />
              {metadata.imageCount}
            </span>
          )}
          {metadata?.audioTrack && (
            <span className="flex items-center gap-1 text-xs text-pink-500">
              <Music className="w-3 h-3" />
              {metadata.audioTrack.name}
            </span>
          )}
          {metadata?.keywords && metadata.keywords.length > 0 && (
            <div className="flex gap-1">
              {metadata.keywords.slice(0, 2).map((kw) => (
                <Badge
                  key={kw}
                  variant="secondary"
                  className="text-xs py-0 whitespace-nowrap bg-purple-500/10 text-purple-600"
                >
                  #{kw}
                </Badge>
              ))}
            </div>
          )}
          {!metadata?.imageCount && !metadata?.audioTrack && !metadata?.keywords?.length && (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      </td>

      {/* Created At */}
      <td className="px-4 py-3 text-right text-sm text-muted-foreground whitespace-nowrap">
        {new Date(pipeline.created_at).toLocaleDateString(
          isKorean ? "ko-KR" : "en-US",
          { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <PipelineActionsMenu
          pipeline={pipeline}
          pipelineType="compose"
          onCreateVariations={handleCreateVariations}
          onDelete={handleDelete}
        />
      </td>
    </tr>
  );
}
