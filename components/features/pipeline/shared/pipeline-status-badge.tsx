"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { PipelineStatus, STATUS_CONFIGS } from "../types";

interface PipelineStatusBadgeProps {
  status: PipelineStatus;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const StatusIcons = {
  completed: CheckCircle2,
  processing: Loader2,
  partial_failure: XCircle,
  pending: Clock,
} as const;

export function PipelineStatusBadge({
  status,
  showIcon = true,
  size = "md",
  className,
}: PipelineStatusBadgeProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";
  const config = STATUS_CONFIGS[status];
  const Icon = StatusIcons[status];

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  const iconSizeClasses = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-3.5 h-3.5",
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1 whitespace-nowrap",
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            iconSizeClasses[size],
            config.colorClass,
            config.animate && "animate-spin"
          )}
        />
      )}
      {isKorean ? config.labelKo : config.label}
    </Badge>
  );
}
