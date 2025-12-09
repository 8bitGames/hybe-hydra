"use client";

import { Sparkles, Wand2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingVideo } from "@/lib/stores/workflow-store";
import { useI18n } from "@/lib/i18n";

interface VariationQuickPanelProps {
  video: ProcessingVideo;
  onCreateAIVariation: () => void;
  onCreateComposeVariation: () => void;
}

export function VariationQuickPanel({
  video,
  onCreateAIVariation,
  onCreateComposeVariation,
}: VariationQuickPanelProps) {
  const { t } = useI18n();
  const isAI = video.generationType === "AI";
  const isCompose = video.generationType === "COMPOSE";

  return (
    <div className="bg-neutral-50 rounded-xl p-4 mt-4 border border-neutral-200">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-neutral-600" />
        <span className="text-sm font-medium">
          {t.publish.variation.createMoreFromThis}
        </span>
      </div>

      {/* Show only the relevant button based on generation type */}
      {isAI && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateAIVariation}
          className="w-full flex flex-col h-auto py-3 hover:bg-neutral-100"
        >
          <Wand2 className="w-4 h-4 mb-1" />
          <span className="text-xs font-medium">
            {t.publish.variation.aiVariation}
          </span>
          <span className="text-[10px] text-neutral-500">
            {t.publish.variation.styleChanges}
          </span>
        </Button>
      )}

      {isCompose && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateComposeVariation}
          className="w-full flex flex-col h-auto py-3 hover:bg-neutral-100"
        >
          <Film className="w-4 h-4 mb-1" />
          <span className="text-xs font-medium">
            {t.publish.variation.fastCutVariation}
          </span>
          <span className="text-[10px] text-neutral-500">
            {t.publish.variation.musicEffects}
          </span>
        </Button>
      )}
    </div>
  );
}
