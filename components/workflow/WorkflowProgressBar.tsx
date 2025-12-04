"use client";

import { cn } from "@/lib/utils";
import { Compass, Sparkles, Clapperboard, Settings2, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { usePathname } from "next/navigation";
import Link from "next/link";

const STAGES = [
  { id: "discover", route: "/discover", icon: Compass, label: { ko: "발견", en: "Discover" } },
  { id: "analyze", route: "/analyze", icon: Sparkles, label: { ko: "분석", en: "Analyze" } },
  { id: "create", route: "/create", icon: Clapperboard, label: { ko: "생성", en: "Create" } },
  { id: "processing", route: "/processing", icon: Settings2, label: { ko: "프로세싱", en: "Processing" } },
  { id: "publish", route: "/publish", icon: Upload, label: { ko: "발행", en: "Publish" } },
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
            <Link
              href={stage.route}
              className="flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 transition-all",
                  sizes.step,
                  isCurrent && "border-neutral-900 bg-neutral-900 text-white",
                  isPast && "border-neutral-400 bg-transparent text-neutral-400",
                  !isCurrent && !isPast && "border-neutral-300 bg-transparent text-neutral-300",
                  "hover:border-neutral-500"
                )}
              >
                <Icon className={sizes.icon} />
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
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
