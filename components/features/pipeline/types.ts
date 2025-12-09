import { VideoGeneration, VideoGenerationType } from "@/lib/video-api";
import { PipelineItem, PipelineType, PipelineDetail } from "@/lib/pipeline-api";

// Re-export types for convenience
export type { PipelineItem, PipelineType, PipelineDetail };

// Pipeline status type
export type PipelineStatus = "pending" | "processing" | "completed" | "partial_failure";

// Status configuration for UI rendering
export interface StatusConfig {
  label: string;
  labelKo: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  colorClass: string;
  bgColorClass: string;
  animate?: boolean;
}

// Status configurations map (Monochrome with clear contrast)
export const STATUS_CONFIGS: Record<PipelineStatus, StatusConfig> = {
  completed: {
    label: "Completed",
    labelKo: "완료",
    variant: "secondary",
    colorClass: "text-foreground",
    bgColorClass: "bg-zinc-100 dark:bg-zinc-800",
  },
  processing: {
    label: "Processing",
    labelKo: "처리중",
    variant: "secondary",
    colorClass: "text-foreground",
    bgColorClass: "bg-zinc-100 dark:bg-zinc-800",
    animate: true,
  },
  partial_failure: {
    label: "Partial Failure",
    labelKo: "일부 실패",
    variant: "outline",
    colorClass: "text-foreground",
    bgColorClass: "bg-zinc-100 dark:bg-zinc-800",
  },
  pending: {
    label: "Pending",
    labelKo: "대기중",
    variant: "outline",
    colorClass: "text-muted-foreground",
    bgColorClass: "bg-muted",
  },
};

// AI Pipeline specific metadata
export interface AIPipelineMetadata {
  qualityScore?: number;
  appliedPresets: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  promptModifications: string[];
}

// Fast Cut Pipeline specific metadata
export interface FastCutPipelineMetadata {
  scriptData?: {
    scenes: number;
    duration: number;
  };
  imageCount: number;
  audioTrack?: {
    name: string;
    bpm?: number;
  };
  effectPreset?: string;
  keywords: string[];
  searchKeywords?: string[];
}

// Extended pipeline items with type-specific metadata
export interface AIPipelineItem extends PipelineItem {
  type: "ai";
  metadata?: AIPipelineMetadata;
}

export interface FastCutPipelineItem extends PipelineItem {
  type: "fast-cut";
  metadata?: FastCutPipelineMetadata;
}

// Variation item base type
export interface VariationBase {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
}

// AI Variation specific fields
export interface AIVariation extends VariationBase {
  type: "ai";
  variationLabel: string;
  appliedPresets: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  promptModification?: string;
}

// Compose Variation specific fields
export interface ComposeVariation extends VariationBase {
  type: "compose";
  searchTags: string[];
  imageCount?: number;
}
