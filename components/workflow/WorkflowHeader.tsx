"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore, ContentType } from "@/lib/stores/workflow-store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ArrowRight, Zap, Sparkles, Clapperboard, Settings2, Upload, Lightbulb, Image, Music, Wand2, Check } from "lucide-react";

// AI Video stage configuration
export const AI_VIDEO_STAGES = [
  { id: "start", route: "/start", icon: Zap, label: { ko: "시작", en: "Start" }, description: { ko: "새 콘텐츠 시작", en: "Start new content" } },
  { id: "analyze", route: "/analyze", icon: Lightbulb, label: { ko: "분석", en: "Analyze" }, description: { ko: "아이디어 분석", en: "Analyze ideas" } },
  { id: "create", route: "/create", icon: Sparkles, label: { ko: "생성", en: "Create" }, description: { ko: "영상 생성", en: "Create videos" } },
  { id: "processing", route: "/processing", icon: Settings2, label: { ko: "프로세싱", en: "Processing" }, description: { ko: "영상 검토", en: "Review videos" } },
  { id: "publish", route: "/publish", icon: Upload, label: { ko: "발행", en: "Publish" }, description: { ko: "콘텐츠 발행", en: "Publish content" } },
];

// Fast Cut stage configuration (Script step removed - keywords come from scene analysis on Start page)
export const FAST_CUT_STAGES = [
  { id: "start", route: "/start", icon: Zap, label: { ko: "시작", en: "Start" }, description: { ko: "새 콘텐츠 시작", en: "Start new content" } },
  { id: "images", route: "/fast-cut/images", icon: Image, label: { ko: "이미지", en: "Images" }, description: { ko: "이미지 선택", en: "Select images" } },
  { id: "music", route: "/fast-cut/music", icon: Music, label: { ko: "음악", en: "Music" }, description: { ko: "음악 선택", en: "Select music" } },
  { id: "effects", route: "/fast-cut/effects", icon: Wand2, label: { ko: "효과", en: "Effects" }, description: { ko: "효과 적용", en: "Apply effects" } },
  { id: "processing", route: "/processing", icon: Settings2, label: { ko: "프로세싱", en: "Processing" }, description: { ko: "영상 검토", en: "Review videos" } },
  { id: "publish", route: "/publish", icon: Upload, label: { ko: "발행", en: "Publish" }, description: { ko: "콘텐츠 발행", en: "Publish content" } },
];

// Legacy STAGES for backward compatibility
const STAGES = AI_VIDEO_STAGES;

// Helper to get stages based on content type
export function getStagesForContentType(contentType: ContentType | undefined) {
  return contentType === "fast-cut" ? FAST_CUT_STAGES : AI_VIDEO_STAGES;
}

interface WorkflowHeaderProps {
  // Navigation
  onBack?: () => void;
  onNext?: () => void;
  canProceed?: boolean;

  // Custom action button (replaces next button)
  actionButton?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
  };

  // Optional subtitle override
  subtitle?: string;

  // Disable all navigation (for sub-flows like compose)
  disabled?: boolean;

  // Only disable forward navigation (allow back but not forward)
  disableForward?: boolean;

  // Content type for selecting workflow stages
  contentType?: ContentType;
}

export function WorkflowHeader({
  onBack,
  onNext,
  canProceed = true,
  actionButton,
  subtitle,
  disabled = false,
  disableForward = false,
  contentType: propContentType,
}: WorkflowHeaderProps) {
  const { language } = useI18n();
  const pathname = usePathname();
  const isKorean = language === "ko";
  const storeContentType = useWorkflowStore((state) => state.start.contentType);

  // Use prop if provided, otherwise use store value
  const contentType = propContentType ?? storeContentType;

  // Select appropriate stages based on content type
  const stages = contentType === "fast-cut" ? FAST_CUT_STAGES : AI_VIDEO_STAGES;

  const currentIndex = stages.findIndex((s) => {
    if (s.route === pathname) return true;
    if (pathname?.startsWith(s.route + "/")) return true;
    return false;
  });
  const currentStage = stages[currentIndex];
  const prevStage = currentIndex > 0 ? stages[currentIndex - 1] : null;
  const nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;

  if (!currentStage) return null;

  const Icon = currentStage.icon;

  return (
    <div className="border-b border-neutral-200 bg-white shrink-0 sticky top-0 z-10">
      {/* Step Indicators - Center aligned, active stage emphasized */}
      <div className="flex items-center justify-center px-[7%] py-4">
        <div className="flex items-center">
          {stages.map((stage, index) => {
            const StageIcon = stage.icon;
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            const isLast = index === stages.length - 1;

            return (
              <React.Fragment key={stage.id}>
                {isActive ? (
                  // Active stage: Large icon + title + description
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-neutral-900 text-white">
                      <StageIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {stage.label[language]}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {subtitle || stage.description[language]}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Non-active: Small icon + title
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                        isCompleted && "bg-green-500 text-white",
                        !isCompleted && "bg-neutral-200 text-neutral-400"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <StageIcon className="h-3 w-3" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium hidden sm:inline-block",
                        isCompleted && "text-green-600",
                        !isCompleted && "text-neutral-400"
                      )}
                    >
                      {stage.label[language]}
                    </span>
                  </div>
                )}

                {/* Connector Line */}
                {!isLast && (
                  <div className={cn(
                    "w-4 sm:w-6",
                    isActive ? "mx-3 sm:mx-4" : "mx-1.5 sm:mx-2"
                  )}>
                    <div
                      className={cn(
                        "h-0.5 w-full transition-colors",
                        isCompleted ? "bg-green-500" : "bg-neutral-200"
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// WorkflowFooter - Bottom navigation bar
interface WorkflowFooterProps {
  onBack?: () => void;
  onNext?: () => void;
  canProceed?: boolean;
  actionButton?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
  };
  disabled?: boolean;
  disableForward?: boolean;
  contentType?: ContentType;
}

export function WorkflowFooter({
  onBack,
  onNext,
  canProceed = true,
  actionButton,
  disabled = false,
  disableForward = false,
  contentType: propContentType,
}: WorkflowFooterProps) {
  const { language } = useI18n();
  const pathname = usePathname();
  const storeContentType = useWorkflowStore((state) => state.start.contentType);

  const contentType = propContentType ?? storeContentType;
  const stages = contentType === "fast-cut" ? FAST_CUT_STAGES : AI_VIDEO_STAGES;

  const currentIndex = stages.findIndex((s) => {
    if (s.route === pathname) return true;
    if (pathname?.startsWith(s.route + "/")) return true;
    return false;
  });

  const prevStage = currentIndex > 0 ? stages[currentIndex - 1] : null;
  const nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;

  return (
    <div className="flex items-center justify-between px-[7%] py-4 border-t border-neutral-200 bg-white shrink-0">
      {/* Left: Back Button */}
      <div>
        {prevStage && (
          <Button
            variant="outline"
            size="default"
            onClick={onBack}
            disabled={disabled}
            className={cn(
              "h-10 px-4 border-neutral-300 text-neutral-700 hover:bg-neutral-100",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {prevStage.label[language]}
          </Button>
        )}
      </div>

      {/* Right: Next/Action Button */}
      <div>
        {actionButton ? (
          <Button
            size="default"
            onClick={actionButton.onClick}
            disabled={actionButton.disabled || disabled || disableForward}
            className={cn(
              "h-10 px-6 bg-neutral-900 text-white hover:bg-neutral-800",
              (disabled || disableForward) && "opacity-50 cursor-not-allowed"
            )}
          >
            {actionButton.loading ? (
              <Spinner className="h-4 w-4 mr-2" />
            ) : actionButton.icon ? (
              <span className="mr-2">{actionButton.icon}</span>
            ) : null}
            {actionButton.label}
          </Button>
        ) : nextStage && !disableForward ? (
          <Button
            size="default"
            onClick={onNext}
            disabled={!canProceed || disabled}
            className={cn(
              "h-10 px-6 bg-neutral-900 text-white hover:bg-neutral-800",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {nextStage.label[language]}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
