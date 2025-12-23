"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Zap, Shuffle, Loader2, Play, Pause, HelpCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { AudioAnalysisResponse } from "@/lib/fast-cut-api";

interface AudioAIRecommendationProps {
  audioAnalysis: AudioAnalysisResponse;
  audioStartTime: number;
  videoDuration: number;
  analyzingAudio: boolean;
  isPlayingSegment?: boolean;
  audioLoaded?: boolean;
  onUseSuggested: () => void;
  onReAnalyze?: () => void;
  onPlaySegment?: () => void;
  showTooltip?: boolean;
}

// Helper to format time
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function AudioAIRecommendation({
  audioAnalysis,
  audioStartTime,
  videoDuration,
  analyzingAudio,
  isPlayingSegment = false,
  audioLoaded = true,
  onUseSuggested,
  onReAnalyze,
  onPlaySegment,
  showTooltip = false,
}: AudioAIRecommendationProps) {
  const { language } = useI18n();

  const t = {
    aiRecommendation: language === "ko" ? "AI 추천" : "AI Recommendation",
    detectedBpm: language === "ko" ? "분석된 BPM" : "Detected BPM",
    suggestedSegment: language === "ko" ? "추천 구간" : "Suggested Segment",
    useSuggested: language === "ko" ? "추천 구간 사용" : "Use Suggested",
    tryDifferent: language === "ko" ? "다른 구간 선택" : "Try Different",
    previewSegment: language === "ko" ? "구간 재생" : "Play Segment",
    stopPreview: language === "ko" ? "구간 정지" : "Stop Segment",
    tooltipText: language === "ko"
      ? "AI가 음원의 에너지, 드롭, BPM을 분석하여 가장 임팩트 있는 구간을 추천합니다"
      : "AI analyzes energy, drops, and BPM to recommend the most impactful segment",
  };

  const showUseSuggestedButton = audioAnalysis.suggestedStartTime !== audioStartTime;

  return (
    <div className="p-3 bg-neutral-50 dark:bg-muted/50 rounded-lg space-y-2">
      {/* Header */}
      <h4 className="text-xs font-semibold text-neutral-600 dark:text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Zap className="h-3 w-3" />
        {t.aiRecommendation}
        {analyzingAudio && (
          <Loader2 className="h-3 w-3 ml-1 animate-spin" />
        )}
        {showTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 cursor-help ml-1.5" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px]">
              <p className="text-xs">{t.tooltipText}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </h4>

      {/* Analysis Info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-neutral-500 dark:text-muted-foreground">
            {t.detectedBpm}
          </p>
          <p className="text-sm font-medium text-neutral-900 dark:text-foreground">
            {audioAnalysis.bpm || "N/A"}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-muted-foreground">
            {t.suggestedSegment}
          </p>
          <p className="text-sm font-medium text-neutral-900 dark:text-foreground">
            {formatDuration(audioAnalysis.suggestedStartTime)} -{" "}
            {formatDuration(audioAnalysis.suggestedEndTime)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-2">
        {/* Preview Segment Button */}
        {onPlaySegment && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isPlayingSegment ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={onPlaySegment}
                disabled={!audioLoaded || analyzingAudio}
              >
                {isPlayingSegment ? (
                  <>
                    <Pause className="h-3 w-3 mr-1" />
                    {t.stopPreview}
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    {t.previewSegment}
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px]">
              <p className="text-xs">
                {language === "ko"
                  ? `선택한 구간만 재생 (${formatDuration(audioStartTime)} - ${formatDuration(audioStartTime + videoDuration)})`
                  : `Preview selected segment (${formatDuration(audioStartTime)} - ${formatDuration(audioStartTime + videoDuration)})`}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Use Suggested Button */}
        {showUseSuggestedButton && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={onUseSuggested}
          >
            <Zap className="h-3 w-3 mr-1" />
            {t.useSuggested}
          </Button>
        )}

        {/* Try Different Button */}
        {onReAnalyze && (
          <Button
            variant="outline"
            size="sm"
            className={showUseSuggestedButton ? "flex-1 text-xs" : "flex-1 text-xs"}
            onClick={onReAnalyze}
            disabled={analyzingAudio}
          >
            {analyzingAudio ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Shuffle className="h-3 w-3 mr-1" />
            )}
            {t.tryDifferent}
          </Button>
        )}
      </div>
    </div>
  );
}
