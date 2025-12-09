"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore, ContentType } from "@/lib/stores/workflow-store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ArrowRight, Zap, Sparkles, Clapperboard, Settings2, Upload, Lightbulb, FileText, Image, Music, Wand2, Check } from "lucide-react";

// AI Video stage configuration
const AI_VIDEO_STAGES = [
  { id: "start", route: "/start", icon: Zap, label: { ko: "시작", en: "Start" }, description: { ko: "새 콘텐츠 시작", en: "Start new content" } },
  { id: "analyze", route: "/analyze", icon: Lightbulb, label: { ko: "분석", en: "Analyze" }, description: { ko: "아이디어 분석", en: "Analyze ideas" } },
  { id: "create", route: "/create", icon: Sparkles, label: { ko: "생성", en: "Create" }, description: { ko: "영상 생성", en: "Create videos" } },
  { id: "processing", route: "/processing", icon: Settings2, label: { ko: "프로세싱", en: "Processing" }, description: { ko: "영상 검토", en: "Review videos" } },
  { id: "publish", route: "/publish", icon: Upload, label: { ko: "발행", en: "Publish" }, description: { ko: "콘텐츠 발행", en: "Publish content" } },
];

// Fast Cut stage configuration
const FAST_CUT_STAGES = [
  { id: "start", route: "/start", icon: Zap, label: { ko: "시작", en: "Start" }, description: { ko: "새 콘텐츠 시작", en: "Start new content" } },
  { id: "script", route: "/fast-cut/script", icon: FileText, label: { ko: "스크립트", en: "Script" }, description: { ko: "스크립트 작성", en: "Write script" } },
  { id: "images", route: "/fast-cut/images", icon: Image, label: { ko: "이미지", en: "Images" }, description: { ko: "이미지 선택", en: "Select images" } },
  { id: "music", route: "/fast-cut/music", icon: Music, label: { ko: "음악", en: "Music" }, description: { ko: "음악 선택", en: "Select music" } },
  { id: "effects", route: "/fast-cut/effects", icon: Wand2, label: { ko: "효과", en: "Effects" }, description: { ko: "효과 적용", en: "Apply effects" } },
  { id: "processing", route: "/processing", icon: Settings2, label: { ko: "프로세싱", en: "Processing" }, description: { ko: "영상 검토", en: "Review videos" } },
  { id: "publish", route: "/publish", icon: Upload, label: { ko: "발행", en: "Publish" }, description: { ko: "콘텐츠 발행", en: "Publish content" } },
];

// Legacy STAGES for backward compatibility
const STAGES = AI_VIDEO_STAGES;

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
    <div className="flex items-center justify-between px-[7%] py-3 border-b border-neutral-200 bg-white shrink-0 sticky top-0 z-10">
      {/* Left: Icon + Title */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-neutral-900 flex items-center justify-center">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-neutral-900">
            {currentStage.label[language]}
          </h1>
          <p className="text-xs text-neutral-500">
            {subtitle || currentStage.description[language]}
          </p>
        </div>
      </div>

      {/* Center: Step Indicators */}
      <div className="flex-1 flex items-center justify-center px-4 max-w-2xl mx-auto">
        <div className="flex items-center w-full">
          {stages.map((stage, index) => {
            const StageIcon = stage.icon;
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            const isLast = index === stages.length - 1;

            return (
              <React.Fragment key={stage.id}>
                {/* Stage Item */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                      isActive && "bg-neutral-900 text-white",
                      isCompleted && "bg-green-500 text-white",
                      !isActive && !isCompleted && "bg-neutral-200 text-neutral-400"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <StageIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium hidden lg:inline-block",
                      isActive && "text-neutral-900",
                      isCompleted && "text-green-600",
                      !isActive && !isCompleted && "text-neutral-400"
                    )}
                  >
                    {stage.label[language]}
                  </span>
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="flex-1 mx-1.5 min-w-[12px]">
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

      {/* Right: Navigation Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Back Button */}
        {prevStage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={disabled}
            className={cn(
              "h-8 px-3 border-neutral-300 text-neutral-700 hover:bg-neutral-100",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {prevStage.label[language]}
          </Button>
        )}

        {/* Next/Action Button */}
        {actionButton ? (
          <Button
            size="sm"
            onClick={actionButton.onClick}
            disabled={actionButton.disabled || disabled || disableForward}
            className={cn(
              "h-8 px-4 bg-neutral-900 text-white hover:bg-neutral-800",
              (disabled || disableForward) && "opacity-50 cursor-not-allowed"
            )}
          >
            {actionButton.loading ? (
              <Spinner className="h-4 w-4 mr-1.5" />
            ) : actionButton.icon ? (
              <span className="mr-1.5">{actionButton.icon}</span>
            ) : null}
            {actionButton.label}
          </Button>
        ) : nextStage && !disableForward ? (
          <Button
            size="sm"
            onClick={onNext}
            disabled={!canProceed || disabled}
            className={cn(
              "h-8 px-4 bg-neutral-900 text-white hover:bg-neutral-800",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {nextStage.label[language]}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
