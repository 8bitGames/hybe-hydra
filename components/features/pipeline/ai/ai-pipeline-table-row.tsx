"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Video } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LazyVideo } from "@/components/ui/lazy-video";
import { PipelineItem } from "../types";
import { PipelineStatusBadge } from "../shared/pipeline-status-badge";
import { PipelineActionsMenu } from "../shared/pipeline-actions-menu";

interface AIPipelineTableRowProps {
  pipeline: PipelineItem;
  onCreateVariations?: (pipeline: PipelineItem) => void;
  onDelete?: (pipeline: PipelineItem) => void;
}

export function AIPipelineTableRow({
  pipeline,
  onCreateVariations,
  onDelete,
}: AIPipelineTableRowProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const handleCreateVariations = () => {
    onCreateVariations?.(pipeline);
  };

  const handleDelete = () => {
    onDelete?.(pipeline);
  };

  return (
    <tr className="hover:bg-muted/30 transition-colors group">
      {/* Preview */}
      <td className="px-4 py-3">
        <div className="relative w-16 h-10 bg-muted rounded overflow-hidden flex-shrink-0">
          {pipeline.seed_generation.output_url ? (
            <LazyVideo
              src={pipeline.seed_generation.output_url}
              className="w-full h-full object-cover"
              autoPlay={false}
              muted
              loop
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3 text-center">
        <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-0.5">
          <Sparkles className="w-3 h-3 mr-1" />
          AI
        </Badge>
      </td>

      {/* Campaign */}
      <td className="px-4 py-3">
        <Badge variant="outline" className="font-normal whitespace-nowrap">
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

      {/* Style Categories */}
      <td className="px-4 py-3">
        <div className="flex flex-nowrap gap-1">
          {pipeline.style_categories.length > 0 ? (
            <>
              {pipeline.style_categories.slice(0, 2).map((cat) => (
                <Badge
                  key={cat}
                  variant="secondary"
                  className="text-xs py-0 whitespace-nowrap"
                >
                  {cat}
                </Badge>
              ))}
              {pipeline.style_categories.length > 2 && (
                <Badge variant="secondary" className="text-xs py-0">
                  +{pipeline.style_categories.length - 2}
                </Badge>
              )}
            </>
          ) : (
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
          pipelineType="ai"
          onCreateVariations={handleCreateVariations}
          onDelete={handleDelete}
        />
      </td>
    </tr>
  );
}
