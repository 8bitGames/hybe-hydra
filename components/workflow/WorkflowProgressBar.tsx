"use client";

import { useWorkflowNavigation } from "@/lib/hooks/useWorkflowNavigation";
import { WorkflowStage } from "@/lib/stores/workflow-store";
import { cn } from "@/lib/utils";
import { Check, Search, Lightbulb, Video, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STAGE_ICONS: Record<WorkflowStage, typeof Search> = {
  discover: Search,
  analyze: Lightbulb,
  create: Video,
  publish: Send,
};

interface WorkflowProgressBarProps {
  className?: string;
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
}

export function WorkflowProgressBar({
  className,
  showLabels = true,
  size = "md",
}: WorkflowProgressBarProps) {
  const { stages, goToStage } = useWorkflowNavigation();
  const { language } = useI18n();

  const sizeClasses = {
    sm: {
      container: "gap-1",
      step: "w-6 h-6",
      icon: "w-3 h-3",
      line: "h-0.5",
      label: "text-xs",
    },
    md: {
      container: "gap-2",
      step: "w-8 h-8",
      icon: "w-4 h-4",
      line: "h-0.5",
      label: "text-xs",
    },
    lg: {
      container: "gap-3",
      step: "w-10 h-10",
      icon: "w-5 h-5",
      line: "h-1",
      label: "text-sm",
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div className={cn("flex items-center", sizes.container, className)}>
      {stages.map((stage, index) => {
        const Icon = STAGE_ICONS[stage.id];
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.id} className="flex items-center">
            {/* Step */}
            <button
              onClick={() => stage.canNavigate && goToStage(stage.id)}
              disabled={!stage.canNavigate}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                stage.canNavigate ? "cursor-pointer" : "cursor-not-allowed"
              )}
            >
              {/* Circle */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 transition-all",
                  sizes.step,
                  stage.isCompleted && "border-neutral-900 bg-neutral-900 text-white",
                  stage.isCurrent && !stage.isCompleted && "border-neutral-900 bg-transparent text-neutral-900",
                  !stage.isCurrent &&
                    !stage.isCompleted &&
                    "border-neutral-300 bg-transparent text-neutral-400",
                  stage.canNavigate && !stage.isCurrent && "hover:border-neutral-500"
                )}
              >
                {stage.isCompleted ? (
                  <Check className={sizes.icon} strokeWidth={3} />
                ) : (
                  <Icon className={sizes.icon} />
                )}
              </div>

              {/* Label */}
              {showLabels && (
                <span
                  className={cn(
                    "font-medium whitespace-nowrap transition-colors",
                    sizes.label,
                    stage.isCurrent && "text-neutral-900",
                    stage.isCompleted && "text-neutral-700",
                    !stage.isCurrent && !stage.isCompleted && "text-neutral-400"
                  )}
                >
                  {stage.label[language]}
                </span>
              )}
            </button>

            {/* Connector Line */}
            {!isLast && (
              <div
                className={cn(
                  "mx-2 flex-1 min-w-[24px] max-w-[60px] rounded-full transition-colors",
                  sizes.line,
                  stage.isCompleted ? "bg-neutral-900" : "bg-neutral-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact version for mobile
export function WorkflowProgressBarCompact({ className }: { className?: string }) {
  const { stages, currentStage } = useWorkflowNavigation();
  const { language } = useI18n();

  const currentIndex = stages.findIndex((s) => s.id === currentStage);
  const current = stages[currentIndex];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Progress dots */}
      <div className="flex items-center gap-1">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              stage.isCompleted && "bg-neutral-900",
              stage.isCurrent && !stage.isCompleted && "bg-neutral-900",
              !stage.isCurrent && !stage.isCompleted && "bg-neutral-300"
            )}
          />
        ))}
      </div>

      {/* Current stage label */}
      <span className="text-sm text-neutral-600">
        {currentIndex + 1}/{stages.length} · {current?.label[language]}
      </span>
    </div>
  );
}

// Vertical version for sidebar
export function WorkflowProgressBarVertical({ className }: { className?: string }) {
  const { stages, goToStage } = useWorkflowNavigation();
  const { language } = useI18n();

  return (
    <div className={cn("flex flex-col", className)}>
      {stages.map((stage, index) => {
        const Icon = STAGE_ICONS[stage.id];
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.id} className="flex">
            {/* Left side: icon + line */}
            <div className="flex flex-col items-center mr-3">
              <button
                onClick={() => stage.canNavigate && goToStage(stage.id)}
                disabled={!stage.canNavigate}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                  stage.isCompleted && "border-neutral-900 bg-neutral-900 text-white",
                  stage.isCurrent && !stage.isCompleted && "border-neutral-900 bg-transparent text-neutral-900",
                  !stage.isCurrent &&
                    !stage.isCompleted &&
                    "border-neutral-300 bg-transparent text-neutral-400",
                  stage.canNavigate ? "cursor-pointer hover:border-neutral-500" : "cursor-not-allowed"
                )}
              >
                {stage.isCompleted ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </button>

              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[24px] transition-colors",
                    stage.isCompleted ? "bg-neutral-900" : "bg-neutral-200"
                  )}
                />
              )}
            </div>

            {/* Right side: text */}
            <div className="pb-6">
              <button
                onClick={() => stage.canNavigate && goToStage(stage.id)}
                disabled={!stage.canNavigate}
                className={cn(
                  "text-left transition-colors",
                  stage.canNavigate ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <p
                  className={cn(
                    "font-medium",
                    stage.isCurrent && "text-neutral-900",
                    stage.isCompleted && "text-neutral-700",
                    !stage.isCurrent && !stage.isCompleted && "text-neutral-400"
                  )}
                >
                  {stage.label[language]}
                </p>
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    stage.isCurrent && "text-neutral-500",
                    !stage.isCurrent && "text-neutral-400"
                  )}
                >
                  {stage.description[language]}
                </p>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
