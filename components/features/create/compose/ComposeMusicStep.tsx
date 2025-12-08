"use client";

import { useI18n } from "@/lib/i18n";
import { useAssets } from "@/lib/queries";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Music,
  Check,
  Play,
  Pause,
  Timer,
  Gauge,
  Sparkles,
  Zap,
  ChevronRight,
  SkipForward,
  Volume2,
  VolumeX,
  HelpCircle,
} from "lucide-react";
import {
  ScriptGenerationResponse,
  AudioMatch,
  AudioAnalysisResponse,
} from "@/lib/compose-api";

interface ComposeMusicStepProps {
  scriptData: ScriptGenerationResponse | null;
  audioMatches: AudioMatch[];
  selectedAudio: AudioMatch | null;
  audioStartTime: number;
  audioAnalysis: AudioAnalysisResponse | null;
  matchingMusic: boolean;
  analyzingAudio: boolean;
  campaignId: string;
  musicSkipped: boolean;
  onSelectAudio: (audio: AudioMatch) => void;
  onSetAudioStartTime: (time: number) => void;
  onSkipMusic: () => void;
  onUnskipMusic: () => void;
  onNext?: () => void;
}

export function ComposeMusicStep({
  scriptData,
  audioMatches,
  selectedAudio,
  audioStartTime,
  audioAnalysis,
  matchingMusic,
  analyzingAudio,
  campaignId,
  musicSkipped,
  onSelectAudio,
  onSetAudioStartTime,
  onSkipMusic,
  onUnskipMusic,
  onNext,
}: ComposeMusicStepProps) {
  const { language, translate } = useI18n();

  // Helper for tooltip icon
  const TooltipIcon = ({ tooltipKey }: { tooltipKey: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 cursor-help ml-1.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        <p className="text-xs">{translate(tooltipKey)}</p>
      </TooltipContent>
    </Tooltip>
  );

  // Fetch all campaign audio assets for reference
  const { data: audioAssetsData } = useAssets(campaignId, {
    type: "audio",
    page_size: 100,
  });

  const campaignAudioAssets = useMemo(() => {
    return audioAssetsData?.items || [];
  }, [audioAssetsData]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get match score color
  const getMatchScoreColor = (score: number): string => {
    if (score >= 80) return "bg-neutral-900 text-white";
    if (score >= 60) return "bg-neutral-200 text-neutral-700";
    return "bg-neutral-100 text-neutral-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-1">
            {language === "ko" ? "음악 매칭" : "Music Matching"}
          </h2>
          <p className="text-sm text-neutral-500">
            {language === "ko"
              ? "스크립트의 분위기와 BPM에 맞는 음악을 선택하세요"
              : "Select music that matches your script's vibe and BPM"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Skip Music Button */}
          {!musicSkipped && !selectedAudio && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onSkipMusic}
                  className="border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  {language === "ko" ? "건너뛰기" : "Skip"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px]">
                <p className="text-xs">{translate("compose.tooltips.music.skipMusic")}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Next Step Button - Prominent position */}
          {(selectedAudio || musicSkipped) && onNext && (
            <Button
              onClick={onNext}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {language === "ko" ? "효과 & 생성" : "Effects & Generate"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Script Info Summary */}
      {scriptData && (
        <div className="flex items-center gap-4 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-neutral-300">
              <Sparkles className="h-3 w-3 mr-1" />
              {scriptData.vibe}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-neutral-300">
              <Gauge className="h-3 w-3 mr-1" />
              {scriptData.suggestedBpmRange.min}-{scriptData.suggestedBpmRange.max} BPM
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-neutral-300">
              <Timer className="h-3 w-3 mr-1" />
              {scriptData.script.totalDuration}s
            </Badge>
          </div>
        </div>
      )}

      {/* Music Skipped State */}
      {musicSkipped && (
        <div className="flex flex-col items-center justify-center h-48 bg-neutral-50 rounded-lg border border-neutral-200">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <VolumeX className="h-8 w-8 text-neutral-400" />
          </div>
          <p className="text-neutral-600 font-medium mb-1">
            {language === "ko" ? "음악 없이 진행" : "Proceeding without music"}
          </p>
          <p className="text-sm text-neutral-400 mb-4">
            {language === "ko"
              ? "영상이 음원 없이 생성됩니다"
              : "Video will be generated without background music"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onUnskipMusic}
            className="text-xs border-neutral-300"
          >
            <Volume2 className="h-3 w-3 mr-1" />
            {language === "ko" ? "음악 다시 선택" : "Select Music"}
          </Button>
        </div>
      )}

      {/* Loading State */}
      {!musicSkipped && matchingMusic && (
        <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
          <Music className="h-12 w-12 mb-3 animate-pulse" />
          <p>{language === "ko" ? "음악 매칭 중..." : "Matching music..."}</p>
        </div>
      )}

      {/* Music Matches */}
      {!musicSkipped && !matchingMusic && audioMatches.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-neutral-700 flex items-center">
            {language === "ko" ? "추천 음악" : "Recommended Music"} ({audioMatches.length})
            <TooltipIcon tooltipKey="compose.tooltips.music.selectMusic" />
          </Label>
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {audioMatches.map((audio) => {
                const isSelected = selectedAudio?.id === audio.id;
                return (
                  <div
                    key={audio.id}
                    onClick={() => onSelectAudio(audio)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    )}
                  >
                    {/* Play/Selection Icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {isSelected ? <Check className="h-5 w-5" /> : <Music className="h-5 w-5" />}
                    </div>

                    {/* Audio Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 truncate">
                        {audio.filename}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {audio.bpm && (
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <Gauge className="h-3 w-3" />
                            {audio.bpm} BPM
                          </span>
                        )}
                        {audio.vibe && (
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {audio.vibe}
                          </span>
                        )}
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {formatDuration(audio.duration)}
                        </span>
                      </div>
                    </div>

                    {/* Match Score */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          className={cn(
                            "shrink-0 cursor-help",
                            getMatchScoreColor(audio.matchScore)
                          )}
                        >
                          {Math.round(audio.matchScore)}% match
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[240px]">
                        <p className="text-xs">{translate("compose.tooltips.music.matchScore")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* No Matches */}
      {!musicSkipped && !matchingMusic && audioMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-neutral-400 bg-neutral-50 rounded-lg">
          <Music className="h-12 w-12 mb-3 text-neutral-300" />
          <p className="text-sm mb-3">
            {language === "ko"
              ? "매칭된 음악이 없습니다"
              : "No matching music found"}
          </p>
          <p className="text-xs text-neutral-400">
            {language === "ko"
              ? "캠페인에 음악 에셋을 추가하세요"
              : "Add audio assets to your campaign"}
          </p>
        </div>
      )}

      {/* Selected Audio Controls */}
      {selectedAudio && (
        <div className="space-y-4 border border-neutral-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Music className="h-4 w-4" />
              {language === "ko" ? "선택된 음악" : "Selected Music"}
            </h3>
            {analyzingAudio && (
              <Badge variant="outline" className="text-xs border-neutral-300 animate-pulse">
                <Zap className="h-3 w-3 mr-1" />
                {language === "ko" ? "분석 중..." : "Analyzing..."}
              </Badge>
            )}
          </div>

          {/* Audio Preview */}
          <div className="p-3 bg-neutral-50 rounded-lg">
            <p className="font-medium text-neutral-800 mb-1">{selectedAudio.filename}</p>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              {selectedAudio.bpm && <span>{selectedAudio.bpm} BPM</span>}
              {selectedAudio.vibe && <span>· {selectedAudio.vibe}</span>}
              <span>· {formatDuration(selectedAudio.duration)}</span>
            </div>
          </div>

          {/* Audio Start Time Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-neutral-700 flex items-center">
                {language === "ko" ? "시작 시간" : "Start Time"}
                <TooltipIcon tooltipKey="compose.tooltips.music.startTime" />
              </Label>
              <span className="text-sm text-neutral-500 font-mono">
                {formatDuration(audioStartTime)}
              </span>
            </div>
            <Slider
              value={[audioStartTime]}
              onValueChange={(v) => onSetAudioStartTime(v[0])}
              min={0}
              max={Math.max(0, selectedAudio.duration - 10)}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-neutral-400">
              <span>0:00</span>
              <span>{formatDuration(selectedAudio.duration)}</span>
            </div>
          </div>

          {/* AI Analysis Result */}
          {audioAnalysis && (
            <div className="p-3 bg-neutral-50 rounded-lg space-y-2">
              <h4 className="text-xs font-semibold text-neutral-600 uppercase tracking-wide flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {language === "ko" ? "AI 추천" : "AI Recommendation"}
                <TooltipIcon tooltipKey="compose.tooltips.music.aiRecommendation" />
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-neutral-500">
                    {language === "ko" ? "분석된 BPM" : "Detected BPM"}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {audioAnalysis.bpm || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">
                    {language === "ko" ? "추천 구간" : "Suggested Segment"}
                  </p>
                  <p className="text-sm font-medium text-neutral-900">
                    {formatDuration(audioAnalysis.suggestedStartTime)} -{" "}
                    {formatDuration(audioAnalysis.suggestedEndTime)}
                  </p>
                </div>
              </div>
              {audioAnalysis.suggestedStartTime !== audioStartTime && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => onSetAudioStartTime(audioAnalysis.suggestedStartTime)}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {language === "ko" ? "추천 시작 시간 사용" : "Use Suggested Time"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Campaign Audio Assets (for manual selection) */}
      {!musicSkipped && campaignAudioAssets.length > 0 && audioMatches.length === 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-neutral-700">
            {language === "ko" ? "캠페인 오디오" : "Campaign Audio"} ({campaignAudioAssets.length})
          </Label>
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-2">
              {campaignAudioAssets.map((asset) => {
                const isSelected = selectedAudio?.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() =>
                      onSelectAudio({
                        id: asset.id,
                        filename: asset.original_filename,
                        s3Url: asset.s3_url,
                        bpm: null,
                        vibe: null,
                        genre: null,
                        duration: (asset.metadata?.duration as number) || 60,
                        energy: 0.5,
                        matchScore: 50,
                      })
                    }
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      <Music className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-neutral-700 truncate flex-1">
                      {asset.original_filename}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
