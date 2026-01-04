"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowRight,
  Eye,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PipelineItem, PipelineType } from "../types";

interface PipelineActionsMenuProps {
  pipeline: PipelineItem;
  pipelineType: PipelineType;
  onViewDetails?: () => void;
  onDelete?: () => void;
  showViewButton?: boolean;
}

export function PipelineActionsMenu({
  pipeline,
  pipelineType,
  onViewDetails,
  onDelete,
  showViewButton = true,
}: PipelineActionsMenuProps) {
  const router = useRouter();
  const { language } = useI18n();
  const isKorean = language === "ko";

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails();
    } else {
      const basePath = pipelineType === "fast-cut" ? "fast-cut-pipeline" : "pipeline";
      router.push(
        `/campaigns/${pipeline.campaign_id}/${basePath}/${pipeline.batch_id}?seed=${pipeline.seed_generation_id}`
      );
    }
  };

  const handleGoToCuration = () => {
    router.push(`/campaigns/${pipeline.campaign_id}/curation`);
  };

  return (
    <div className="flex items-center gap-1">
      {showViewButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={handleViewDetails}
        >
          <Eye className="w-4 h-4" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleViewDetails}>
            <Eye className="w-4 h-4 mr-2" />
            {isKorean ? "상세 보기" : "View Details"}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleGoToCuration}>
            <ArrowRight className="w-4 h-4 mr-2" />
            {isKorean ? "큐레이션으로" : "Go to Curation"}
          </DropdownMenuItem>

          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isKorean ? "삭제" : "Delete"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
