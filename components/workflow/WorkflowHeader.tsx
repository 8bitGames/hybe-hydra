"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ArrowRight, Compass, Sparkles, Clapperboard, Settings2, Upload } from "lucide-react";

// Stage configuration
const STAGES = [
  { id: "discover", route: "/discover", icon: Compass, label: { ko: "발견", en: "Discover" }, description: { ko: "트렌드 검색", en: "Search trends" } },
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
}

export function WorkflowHeader({
  onBack,
  onNext,
  canProceed = true,
  actionButton,
  subtitle,
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
    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white shrink-0">
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

      {/* Center: Workflow Progress */}
      <div className="flex items-center gap-1">
        {STAGES.map((stage, index) => {
          const StageIcon = stage.icon;
          const isCurrent = pathname.startsWith(stage.route);
          const isPast = index < currentIndex;
          const isLast = index === STAGES.length - 1;

          return (
            <React.Fragment key={stage.id}>
              <Link
                href={stage.route}
                className="flex flex-col items-center gap-1 transition-all cursor-pointer"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                    isCurrent && "border-neutral-900 bg-neutral-900 text-white",
                    isPast && "border-neutral-400 bg-transparent text-neutral-400",
                    !isCurrent && !isPast && "border-neutral-300 bg-transparent text-neutral-300",
                    "hover:border-neutral-500"
                  )}
                >
                  <StageIcon className="w-4 h-4" />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap transition-colors",
                    isCurrent && "text-neutral-900",
                    isPast && "text-neutral-500",
                    !isCurrent && !isPast && "text-neutral-400"
                  )}
                >
                  {stage.label[language]}
                </span>
              </Link>
              {!isLast && (
                <div
                  className={cn(
                    "mx-1 w-6 h-0.5 rounded-full transition-colors",
                    isPast ? "bg-neutral-400" : "bg-neutral-200"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right: Navigation Buttons */}
      <div className="flex items-center gap-2 min-w-[200px] justify-end">
        {/* Back Button */}
        {prevStage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-9 px-3 border-neutral-300 text-neutral-700 hover:bg-neutral-100"
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
            disabled={actionButton.disabled}
            className="h-9 px-4 bg-neutral-900 text-white hover:bg-neutral-800"
          >
            {actionButton.loading ? (
              <Spinner className="h-4 w-4 mr-1.5" />
            ) : actionButton.icon ? (
              <span className="mr-1.5">{actionButton.icon}</span>
            ) : null}
            {actionButton.label}
          </Button>
        ) : nextStage ? (
          <Button
            size="sm"
            onClick={onNext}
            disabled={!canProceed}
            className="h-9 px-4 bg-neutral-900 text-white hover:bg-neutral-800"
          >
            {nextStage.label[language]}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
