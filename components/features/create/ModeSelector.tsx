"use client";

import { useI18n } from "@/lib/i18n";
import { useUIStore, type CreateMode } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Bot,
  Images,
  Layers,
  type LucideIcon,
} from "lucide-react";

interface ModeSelectorProps {
  className?: string;
}

const modeIcons: Record<CreateMode, LucideIcon> = {
  quick: Zap,
  generate: Bot,
  fastCut: Images,
  batch: Layers,
};

/**
 * Mode selector tabs for unified Create page
 * 통합 만들기 페이지의 모드 선택 탭
 */
export function ModeSelector({ className }: ModeSelectorProps) {
  const { t, language } = useI18n();
  const { createMode, setCreateMode } = useUIStore();

  const modes: CreateMode[] = ["quick", "generate", "fastCut", "batch"];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {modes.map((mode) => {
        const Icon = modeIcons[mode];
        const modeTranslation = t.createPage.modes[mode];
        const isActive = createMode === mode;

        return (
          <Button
            key={mode}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => setCreateMode(mode)}
            className={cn(
              "gap-2 transition-all",
              isActive && "shadow-sm"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{modeTranslation.name}</span>
            {mode === "quick" && (
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className="text-[10px] px-1.5 py-0"
              >
                {language === "ko" ? "추천" : "Rec"}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Compact mode selector for mobile/narrow screens
 * 모바일/좁은 화면용 컴팩트 모드 선택기
 */
export function CompactModeSelector({ className }: ModeSelectorProps) {
  const { t } = useI18n();
  const { createMode, setCreateMode } = useUIStore();

  const modes: CreateMode[] = ["quick", "generate", "fastCut", "batch"];

  return (
    <div className={cn("grid grid-cols-4 gap-1 p-1 bg-muted rounded-lg", className)}>
      {modes.map((mode) => {
        const Icon = modeIcons[mode];
        const isActive = createMode === mode;

        return (
          <button
            key={mode}
            onClick={() => setCreateMode(mode)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-md transition-all",
              isActive
                ? "bg-background shadow-sm"
                : "hover:bg-muted-foreground/10"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
            <span className="text-[10px] font-medium">
              {t.createPage.modes[mode].name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
