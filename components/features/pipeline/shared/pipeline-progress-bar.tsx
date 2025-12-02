"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface PipelineProgressBarProps {
  progress: number;
  completed: number;
  total: number;
  failed?: number;
  showLabel?: boolean;
  showStats?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PipelineProgressBar({
  progress,
  completed,
  total,
  failed = 0,
  showLabel = true,
  showStats = true,
  size = "md",
  className,
}: PipelineProgressBarProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const heightClasses = {
    sm: "h-1",
    md: "h-1.5",
    lg: "h-2",
  };

  return (
    <div className={cn("space-y-1", className)}>
      {showStats && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            <span className="text-green-600 font-medium">{completed}</span>
            <span className="text-muted-foreground">/{total}</span>
            {failed > 0 && (
              <span className="text-red-500 ml-1">({failed} {isKorean ? "실패" : "failed"})</span>
            )}
          </span>
          {showLabel && (
            <span className="text-muted-foreground font-medium">
              {progress}%
            </span>
          )}
        </div>
      )}
      <Progress
        value={progress}
        className={cn(heightClasses[size])}
      />
    </div>
  );
}
