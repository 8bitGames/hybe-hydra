"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useUIStore, type CreateMode } from "@/lib/stores/ui-store";
import {
  ModeSelector,
  QuickCreateMode,
  GenerateMode,
  ComposeMode,
  BatchMode,
} from "@/components/features/create";
import { Sparkles } from "lucide-react";

/**
 * Unified Create Page - Hub for all video creation modes
 * 통합 만들기 페이지 - 모든 영상 생성 모드의 허브
 *
 * Modes:
 * - Quick: 1-click simplified generation (default)
 * - Generate: Full AI video generation with all options
 * - Compose: Image + Audio slideshow creation
 * - Batch: Bulk variation generation
 *
 * All modes are embedded within this page to maintain context.
 * 모든 모드는 컨텍스트를 유지하기 위해 이 페이지 내에 임베드됩니다.
 */
export default function CreatePage() {
  const searchParams = useSearchParams();
  const { language } = useI18n();
  const { createMode, setCreateMode } = useUIStore();

  // Handle mode from URL query param
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam && ["quick", "generate", "compose", "batch"].includes(modeParam)) {
      setCreateMode(modeParam as CreateMode);
    }
  }, [searchParams, setCreateMode]);

  // Switch to generate mode from quick mode
  const handleModeSwitch = () => {
    setCreateMode("generate");
  };

  // Render mode-specific content
  const renderModeContent = () => {
    switch (createMode) {
      case "quick":
        return <QuickCreateMode onModeSwitch={handleModeSwitch} />;

      case "generate":
        return <GenerateMode />;

      case "compose":
        return <ComposeMode />;

      case "batch":
        return <BatchMode />;

      default:
        return <QuickCreateMode onModeSwitch={handleModeSwitch} />;
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">
              {language === "ko" ? "콘텐츠 만들기" : "Create Content"}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {language === "ko"
              ? "다양한 방식으로 AI 영상을 생성하세요"
              : "Generate AI videos in various ways"}
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {language === "ko" ? "생성 방식 선택" : "Select creation mode"}
        </p>
        <ModeSelector />
      </div>

      {/* Mode Content - Full width for all modes */}
      <div>
        {renderModeContent()}
      </div>
    </div>
  );
}
