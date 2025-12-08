"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ArrowRight, Zap, Sparkles, Clapperboard, Settings2, Upload } from "lucide-react";

// Stage configuration
const STAGES = [
  { id: "start", route: "/start", icon: Zap, label: { ko: "시작", en: "Start" }, description: { ko: "새 콘텐츠 시작", en: "Start new content" } },
  { id: "analyze", route: "/analyze", icon: Sparkles, label: { ko: "분석", en: "Analyze" }, description: { ko: "아이디어 분석", en: "Analyze ideas" } },
  { id: "create", route: "/create", icon: Clapperboard, label: { ko: "생성", en: "Create" }, description: { ko: "영상 생성", en: "Create videos" } },
  { id: "processing", route: "/processing", icon: Settings2, label: { ko: "프로세싱", en: "Processing" }, description: { ko: "영상 검토", en: "Review videos" } },
  { id: "publish", route: "/publish", icon: Upload, label: { ko: "발행", en: "Publish" }, description: { ko: "콘텐츠 발행", en: "Publish content" } },
];

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
}

export function WorkflowHeader({
  onBack,
  onNext,
  canProceed = true,
  actionButton,
  subtitle,
  disabled = false,
  disableForward = false,
}: WorkflowHeaderProps) {
  const { language } = useI18n();
  const pathname = usePathname();
  const isKorean = language === "ko";

  const currentIndex = STAGES.findIndex((s) => pathname.startsWith(s.route));
  const currentStage = STAGES[currentIndex];
  const prevStage = currentIndex > 0 ? STAGES[currentIndex - 1] : null;
  const nextStage = currentIndex < STAGES.length - 1 ? STAGES[currentIndex + 1] : null;

  if (!currentStage) return null;

  const Icon = currentStage.icon;

  return (
    <div className="flex items-center justify-between px-[7%] py-4 border-b border-neutral-200 bg-white shrink-0 sticky top-0 z-10">
      {/* Left: Icon + Title */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            {currentStage.label[language]}
          </h1>
          <p className="text-xs text-neutral-500">
            {subtitle || currentStage.description[language]}
          </p>
        </div>
      </div>



      {/* Right: Navigation Buttons */}
      <div className="flex items-center gap-2 min-w-[200px] justify-end">
        {/* Back Button */}
        {prevStage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={disabled}
            className={cn(
              "h-9 px-3 border-neutral-300 text-neutral-700 hover:bg-neutral-100",
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
              "h-9 px-4 bg-neutral-900 text-white hover:bg-neutral-800",
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
              "h-9 px-4 bg-neutral-900 text-white hover:bg-neutral-800",
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
