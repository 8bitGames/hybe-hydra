"use client";

import { cn } from "@/lib/utils";
import { BilingualLabel, type BilingualText } from "./BilingualLabel";

interface ProgressIndicatorProps {
  progress: number;  // 0-100
  status?: "pending" | "processing" | "completed" | "failed" | "cancelled";
  label?: BilingualText;
  showPercentage?: boolean;
  estimatedTime?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Progress indicator with status and optional time estimate
 * 상태 및 선택적 시간 추정이 있는 진행 표시기
 */
export function ProgressIndicator({
  progress,
  status = "processing",
  label,
  showPercentage = true,
  estimatedTime,
  size = "md",
  className,
}: ProgressIndicatorProps) {
  const statusColors = {
    pending: "bg-muted",
    processing: "bg-blue-500",
    completed: "bg-green-500",
    failed: "bg-destructive",
    cancelled: "bg-yellow-500",
  };

  const heights = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={cn("space-y-1", className)}>
      {/* Label and percentage */}
      {(label || showPercentage || estimatedTime) && (
        <div className="flex items-center justify-between text-xs">
          {label && (
            <span className="text-muted-foreground">
              <BilingualLabel ko={label.ko} en={label.en} />
            </span>
          )}
          <div className="flex items-center gap-2">
            {estimatedTime && (
              <span className="text-muted-foreground">~{estimatedTime}</span>
            )}
            {showPercentage && (
              <span className="font-medium">{Math.round(progress)}%</span>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className={cn("bg-muted rounded-full overflow-hidden", heights[size])}>
        <div
          className={cn(
            "h-full transition-all duration-300",
            statusColors[status]
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Step indicator for multi-step processes
 * 다단계 프로세스를 위한 단계 표시기
 */
interface Step {
  id: string;
  label: BilingualText;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: string;
  completedSteps?: string[];
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps = [],
  className,
}: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  isCompleted && "bg-green-500 text-white",
                  isCurrent && !isCompleted && "bg-primary text-primary-foreground",
                  !isCurrent && !isCompleted && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-1 text-center max-w-[80px]",
                  isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                <BilingualLabel ko={step.label.ko} en={step.label.en} />
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-2",
                  isCompleted ? "bg-green-500" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
