"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore, ContentType } from "@/lib/stores/workflow-store";
import {
  Zap,
  Lightbulb,
  Sparkles,
  Settings2,
  Upload,
  Image,
  Music,
  Wand2,
  Check,
} from "lucide-react";

// AI Video workflow stages
const AI_VIDEO_STAGES = [
  { id: "start", route: "/start", icon: Zap, label: { ko: "시작", en: "Start" } },
  { id: "analyze", route: "/analyze", icon: Lightbulb, label: { ko: "분석", en: "Analyze" } },
  { id: "create", route: "/create", icon: Sparkles, label: { ko: "생성", en: "Create" } },
  { id: "processing", route: "/processing", icon: Settings2, label: { ko: "프로세싱", en: "Processing" } },
  { id: "publish", route: "/publish", icon: Upload, label: { ko: "발행", en: "Publish" } },
];

// Fast Cut workflow stages (Script step removed - keywords come from scene analysis on Start page)
const FAST_CUT_STAGES = [
  { id: "start", route: "/start", icon: Zap, label: { ko: "시작", en: "Start" } },
  { id: "images", route: "/fast-cut/images", icon: Image, label: { ko: "이미지", en: "Images" } },
  { id: "music", route: "/fast-cut/music", icon: Music, label: { ko: "음악", en: "Music" } },
  { id: "effects", route: "/fast-cut/effects", icon: Wand2, label: { ko: "효과", en: "Effects" } },
  { id: "processing", route: "/processing", icon: Settings2, label: { ko: "프로세싱", en: "Processing" } },
  { id: "publish", route: "/publish", icon: Upload, label: { ko: "발행", en: "Publish" } },
];

interface WorkflowStepsIndicatorProps {
  className?: string;
  contentType?: ContentType;
}

export function WorkflowStepsIndicator({ className, contentType: propContentType }: WorkflowStepsIndicatorProps) {
  const { language } = useI18n();
  const pathname = usePathname();
  const storeContentType = useWorkflowStore((state) => state.start.contentType);

  // Use prop if provided, otherwise use store value
  const contentType = propContentType ?? storeContentType;

  // Select appropriate stages based on content type
  const stages = contentType === "fast-cut" ? FAST_CUT_STAGES : AI_VIDEO_STAGES;

  // Find current stage index
  const currentIndex = stages.findIndex((s) => {
    if (s.route === pathname) return true;
    if (pathname?.startsWith(s.route + "/")) return true;
    return false;
  });

  // Don't render if we're not in a workflow page
  const isInWorkflow = currentIndex >= 0;
  if (!isInWorkflow) return null;

  return (
    <div className={cn("w-full bg-neutral-50 border-b border-neutral-200", className)}>
      <div className="px-[7%] py-3">
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            const isLast = index === stages.length - 1;

            return (
              <React.Fragment key={stage.id}>
                {/* Stage Item */}
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                      isActive && "bg-neutral-900 text-white",
                      isCompleted && "bg-green-500 text-white",
                      !isActive && !isCompleted && "bg-neutral-200 text-neutral-500"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium hidden sm:inline-block",
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
                  <div className="flex-1 mx-2 sm:mx-4">
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
