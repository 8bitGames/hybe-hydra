"use client";

import { cn } from "@/lib/utils";
import { Zap, Sparkles, Clapperboard, Settings2, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STAGES = [
  {
    id: "start",
    route: "/start",
    icon: Zap,
    label: { ko: "시작", en: "Start" },
    description: {
      ko: "트렌드, 영상 참고 또는 아이디어로 새 콘텐츠를 시작하세요",
      en: "Start new content from trends, video reference, or your idea"
    }
  },
  {
    id: "analyze",
    route: "/analyze",
    icon: Sparkles,
    label: { ko: "분석", en: "Analyze" },
    description: {
      ko: "수집된 트렌드 데이터로 AI 콘텐츠 아이디어를 생성하세요",
      en: "Generate AI content ideas using collected trend data"
    }
  },
  {
    id: "create",
    route: "/create",
    icon: Clapperboard,
    label: { ko: "생성", en: "Create" },
    description: {
      ko: "AI 영상 생성 또는 Compose로 콘텐츠를 제작하세요",
      en: "Create content with AI video generation or Compose"
    }
  },
  {
    id: "processing",
    route: "/processing",
    icon: Settings2,
    label: { ko: "프로세싱", en: "Processing" },
    description: {
      ko: "영상 생성 상태를 확인하고 승인 또는 수정하세요",
      en: "Check video generation status and approve or revise"
    }
  },
  {
    id: "publish",
    route: "/publish",
    icon: Upload,
    label: { ko: "발행", en: "Publish" },
    description: {
      ko: "완성된 영상을 소셜 미디어에 예약 발행하세요",
      en: "Schedule and publish finished videos to social media"
    }
  },
];

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
  const { language } = useI18n();
  const pathname = usePathname();

  const sizeClasses = {
    sm: { container: "gap-1", step: "w-6 h-6", icon: "w-3 h-3", line: "h-0.5", label: "text-xs" },
    md: { container: "gap-2", step: "w-8 h-8", icon: "w-4 h-4", line: "h-0.5", label: "text-xs" },
    lg: { container: "gap-3", step: "w-10 h-10", icon: "w-5 h-5", line: "h-1", label: "text-sm" },
  };

  const sizes = sizeClasses[size];
  const currentIndex = STAGES.findIndex((s) => pathname.startsWith(s.route));

  return (
    <div className={cn("flex items-center justify-center py-4 border-b border-neutral-100", sizes.container, className)}>
      {STAGES.map((stage, index) => {
        const Icon = stage.icon;
        const isLast = index === STAGES.length - 1;
        const isCurrent = pathname.startsWith(stage.route);
        const isPast = index < currentIndex;

        return (
          <div key={stage.id} className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={stage.route}
                  className="flex flex-col items-center gap-1 transition-all cursor-pointer group"
                >
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full border-2 transition-all relative",
                      sizes.step,
                      isCurrent && "border-neutral-900 bg-neutral-900 text-white",
                      isPast && "border-neutral-400 bg-transparent text-neutral-400",
                      !isCurrent && !isPast && "border-neutral-300 bg-transparent text-neutral-300",
                      "hover:border-neutral-500"
                    )}
                  >
                    <Icon className={sizes.icon} />
                    {isCurrent && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-neutral-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>

                  {showLabels && (
                    <span
                      className={cn(
                        "font-medium whitespace-nowrap transition-colors",
                        sizes.label,
                        isCurrent && "text-neutral-900",
                        isPast && "text-neutral-500",
                        !isCurrent && !isPast && "text-neutral-400"
                      )}
                    >
                      {stage.label[language]}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={8}
                className="max-w-[200px] text-center"
              >
                <p className="text-xs">{stage.description[language]}</p>
              </TooltipContent>
            </Tooltip>

            {!isLast && (
              <div
                className={cn(
                  "mx-2 flex-1 min-w-[24px] max-w-[60px] rounded-full transition-colors",
                  sizes.line,
                  isPast ? "bg-neutral-400" : "bg-neutral-200"
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
  const { language } = useI18n();
  const pathname = usePathname();

  const currentIndex = STAGES.findIndex((s) => pathname.startsWith(s.route));
  const current = STAGES[currentIndex];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-1">
        {STAGES.map((stage, index) => (
          <div
            key={stage.id}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              index <= currentIndex ? "bg-neutral-900" : "bg-neutral-300"
            )}
          />
        ))}
      </div>
      <span className="text-sm text-neutral-600">
        {currentIndex + 1}/{STAGES.length} · {current?.label[language]}
      </span>
    </div>
  );
}

// Vertical version for sidebar
export function WorkflowProgressBarVertical({ className }: { className?: string }) {
  const { language } = useI18n();
  const pathname = usePathname();

  const currentIndex = STAGES.findIndex((s) => pathname.startsWith(s.route));

  return (
    <div className={cn("flex flex-col", className)}>
      {STAGES.map((stage, index) => {
        const Icon = stage.icon;
        const isLast = index === STAGES.length - 1;
        const isCurrent = pathname.startsWith(stage.route);
        const isPast = index < currentIndex;

        return (
          <div key={stage.id} className="flex">
            <div className="flex flex-col items-center mr-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={stage.route}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all cursor-pointer",
                      isCurrent && "border-neutral-900 bg-neutral-900 text-white",
                      isPast && "border-neutral-400 bg-transparent text-neutral-400",
                      !isCurrent && !isPast && "border-neutral-300 bg-transparent text-neutral-300",
                      "hover:border-neutral-500"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={8}
                  className="max-w-[200px]"
                >
                  <p className="text-xs">{stage.description[language]}</p>
                </TooltipContent>
              </Tooltip>

              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[24px] transition-colors",
                    isPast ? "bg-neutral-400" : "bg-neutral-200"
                  )}
                />
              )}
            </div>

            <div className="pb-6">
              <Link href={stage.route} className="text-left transition-colors cursor-pointer">
                <p
                  className={cn(
                    "font-medium",
                    isCurrent && "text-neutral-900",
                    isPast && "text-neutral-500",
                    !isCurrent && !isPast && "text-neutral-400"
                  )}
                >
                  {stage.label[language]}
                </p>
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    isCurrent && "text-neutral-600",
                    isPast && "text-neutral-400",
                    !isCurrent && !isPast && "text-neutral-300"
                  )}
                >
                  {stage.description[language]}
                </p>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
