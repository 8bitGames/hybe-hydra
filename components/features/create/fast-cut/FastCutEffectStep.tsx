"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Film,
  Music,
  Image as ImageIcon,
  Check,
  Hash,
  X,
  AlertCircle,
  HelpCircle,
  Palette,
  ChevronLeft,
  ChevronRight,
  Type,
  Plus,
  Clock,
  Wand2,
  GripVertical,
  Trash2,
} from "lucide-react";
import {
  ScriptGenerationResponse,
  ImageCandidate,
  AudioMatch,
  TikTokSEO,
  StyleSetSummary,
  VIBE_PRESETS,
  VibeType,
} from "@/lib/fast-cut-api";
import { KeywordInputPopover } from "@/components/ui/keyword-input-popover";

interface FastCutEffectStepProps {
  scriptData: ScriptGenerationResponse | null;
  setScriptData: (data: ScriptGenerationResponse | null) => void;
  selectedImages: ImageCandidate[];
  selectedAudio: AudioMatch | null;
  musicSkipped: boolean;
  aspectRatio: string;
  styleSetId: string;
  setStyleSetId: (id: string) => void;
  styleSets: StyleSetSummary[];
  tiktokSEO: TikTokSEO | null;
  setTiktokSEO: (seo: TikTokSEO | null) => void;
  rendering: boolean;
  onStartRender: () => void;
}

// Helper function to get cut duration from vibe
function getCutDurationFromVibe(vibe: string): number {
  const vibeKey = vibe as VibeType;
  if (vibeKey in VIBE_PRESETS) {
    return VIBE_PRESETS[vibeKey].cutDuration;
  }
  return 1.5; // Default fallback
}

// Format seconds to mm:ss.s
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}

// Subtitle Timeline Editor component
interface SubtitleTimelineEditorProps {
  selectedImages: ImageCandidate[];
  scriptData: ScriptGenerationResponse | null;
  onUpdateScript: (lines: ScriptGenerationResponse["script"]["lines"]) => void;
  selectedStyleSet: StyleSetSummary | undefined;
  language: string;
}

function SubtitleTimelineEditor({
  selectedImages,
  scriptData,
  onUpdateScript,
  selectedStyleSet,
  language,
}: SubtitleTimelineEditorProps) {
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isDragging, setIsDragging] = useState<{ index: number; edge: "start" | "end" | "move" } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Get cut duration from style (for display purposes)
  const cutDuration = useMemo(() => {
    if (!selectedStyleSet?.vibe) return 1.5;
    return getCutDurationFromVibe(selectedStyleSet.vibe);
  }, [selectedStyleSet?.vibe]);

  // Total duration comes from script (fixed by prompt), not from images
  const totalDuration = useMemo(() => {
    if (!scriptData?.script.lines.length) return 10; // fallback
    const lines = scriptData.script.lines;
    const lastLine = lines[lines.length - 1];
    return lastLine.timing + lastLine.duration;
  }, [scriptData?.script.lines]);

  // Calculate how images will loop to fill the total duration
  const imageLoopInfo = useMemo(() => {
    if (selectedImages.length === 0) return { totalSlots: 0, loopCount: 1 };
    const singleCycleDuration = selectedImages.length * cutDuration;
    const loopCount = Math.ceil(totalDuration / singleCycleDuration);
    const totalSlots = Math.ceil(totalDuration / cutDuration);
    return { totalSlots, loopCount, singleCycleDuration };
  }, [selectedImages.length, cutDuration, totalDuration]);

  // Calculate image display times (with looping)
  const imageTimings = useMemo(() => {
    const timings: { start: number; end: number; imageIndex: number }[] = [];
    let currentTime = 0;
    let slot = 0;

    while (currentTime < totalDuration) {
      const imageIndex = slot % selectedImages.length;
      const end = Math.min(currentTime + cutDuration, totalDuration);
      timings.push({
        start: currentTime,
        end,
        imageIndex,
      });
      currentTime = end;
      slot++;
    }

    return timings;
  }, [selectedImages.length, cutDuration, totalDuration]);

  // Get script lines or empty array
  const subtitleLines = useMemo(() => {
    return scriptData?.script.lines || [];
  }, [scriptData?.script.lines]);

  // Auto-distribute subtitles evenly across the timeline
  const handleAutoDistribute = useCallback(() => {
    if (subtitleLines.length === 0) return;

    const segmentDuration = totalDuration / subtitleLines.length;
    const newLines = subtitleLines.map((line, idx) => ({
      ...line,
      timing: idx * segmentDuration,
      duration: segmentDuration,
    }));

    onUpdateScript(newLines);
  }, [subtitleLines, totalDuration, onUpdateScript]);

  // Add a new subtitle at the end
  const handleAddSubtitle = useCallback(() => {
    // Find the end time of the last subtitle, or start from 0
    const lastEnd = subtitleLines.length > 0
      ? subtitleLines[subtitleLines.length - 1].timing + subtitleLines[subtitleLines.length - 1].duration
      : 0;

    // Default duration: remaining time / 2, or 2 seconds, whichever is smaller
    const remainingTime = totalDuration - lastEnd;
    const defaultDuration = Math.min(Math.max(remainingTime, 0.5), 2);

    if (remainingTime < 0.5) {
      // No room for new subtitle, redistribute
      const newLines = [
        ...subtitleLines,
        { text: "", timing: 0, duration: 1 },
      ];
      const segmentDuration = totalDuration / newLines.length;
      const redistributed = newLines.map((line, idx) => ({
        ...line,
        timing: idx * segmentDuration,
        duration: segmentDuration,
      }));
      onUpdateScript(redistributed);
      setSelectedSubtitleIndex(newLines.length - 1);
      setEditingText("");
    } else {
      const newLines = [
        ...subtitleLines,
        { text: "", timing: lastEnd, duration: defaultDuration },
      ];
      onUpdateScript(newLines);
      setSelectedSubtitleIndex(newLines.length - 1);
      setEditingText("");
    }
  }, [subtitleLines, totalDuration, onUpdateScript]);

  // Delete selected subtitle
  const handleDeleteSubtitle = useCallback(() => {
    if (selectedSubtitleIndex === null || subtitleLines.length <= 1) return;

    const newLines = subtitleLines.filter((_, idx) => idx !== selectedSubtitleIndex);
    onUpdateScript(newLines);
    setSelectedSubtitleIndex(null);
    setEditingText("");
  }, [selectedSubtitleIndex, subtitleLines, onUpdateScript]);

  // Handle selecting a subtitle block
  const handleSelectSubtitle = (index: number) => {
    setSelectedSubtitleIndex(index);
    setEditingText(subtitleLines[index]?.text || "");
  };

  // Handle updating subtitle text
  const handleSaveText = () => {
    if (selectedSubtitleIndex === null) return;

    const newLines = [...subtitleLines];
    newLines[selectedSubtitleIndex] = {
      ...newLines[selectedSubtitleIndex],
      text: editingText,
    };
    onUpdateScript(newLines);
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent, index: number, edge: "start" | "end" | "move") => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging({ index, edge });
    setSelectedSubtitleIndex(index);
    setEditingText(subtitleLines[index]?.text || "");
  };

  // Handle mouse move for dragging
  useEffect(() => {
    if (!isDragging || !timelineRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineRef.current!.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const time = (x / rect.width) * totalDuration;

      const newLines = [...subtitleLines];
      const line = newLines[isDragging.index];
      const minDuration = 0.5; // Minimum subtitle duration

      if (isDragging.edge === "start") {
        const newTiming = Math.max(0, Math.min(time, line.timing + line.duration - minDuration));
        const newDuration = line.timing + line.duration - newTiming;
        newLines[isDragging.index] = { ...line, timing: newTiming, duration: newDuration };
      } else if (isDragging.edge === "end") {
        const newDuration = Math.max(minDuration, Math.min(time - line.timing, totalDuration - line.timing));
        newLines[isDragging.index] = { ...line, duration: newDuration };
      } else if (isDragging.edge === "move") {
        const newTiming = Math.max(0, Math.min(time - line.duration / 2, totalDuration - line.duration));
        newLines[isDragging.index] = { ...line, timing: newTiming };
      }

      onUpdateScript(newLines);
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, subtitleLines, totalDuration, onUpdateScript]);

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers = [];
    const interval = totalDuration <= 15 ? 1 : totalDuration <= 30 ? 2 : 5;
    for (let t = 0; t <= totalDuration; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration]);

  // Note: Style changes no longer affect timeline duration
  // Duration is fixed by script, style only affects image transition speed

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
          <Film className="h-4 w-4" />
          {language === "ko" ? "자막 타임라인" : "Subtitle Timeline"}
        </Label>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {formatTime(totalDuration)}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddSubtitle}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            {language === "ko" ? "자막 추가" : "Add Subtitle"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoDistribute}
            className="h-7 text-xs"
            disabled={subtitleLines.length === 0}
          >
            <Wand2 className="h-3 w-3 mr-1" />
            {language === "ko" ? "자동 배치" : "Auto-distribute"}
          </Button>
        </div>
      </div>

      {/* Duration info */}
      <div className="text-xs text-neutral-500 flex items-center gap-4 flex-wrap">
        <span>
          {language === "ko" ? "이미지" : "Images"}: {selectedImages.length}
        </span>
        <span>
          {language === "ko" ? "전환 속도" : "Transition"}: {cutDuration.toFixed(1)}s
        </span>
        <span>
          {language === "ko" ? "자막" : "Subtitles"}: {subtitleLines.length}
        </span>
        {imageLoopInfo.loopCount > 1 && (
          <span className="text-blue-600">
            {language === "ko"
              ? `이미지 ${imageLoopInfo.loopCount}회 반복`
              : `Images loop ${imageLoopInfo.loopCount}x`}
          </span>
        )}
      </div>

      {/* Timeline Container */}
      <div className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
        {/* Time markers */}
        <div className="relative h-5 mb-1">
          {timeMarkers.map((t) => (
            <div
              key={t}
              className="absolute text-[10px] text-neutral-400 -translate-x-1/2"
              style={{ left: `${(t / totalDuration) * 100}%` }}
            >
              {formatTime(t)}
            </div>
          ))}
        </div>

        {/* Image Track - shows how images loop across timeline */}
        <div className="relative h-12 mb-2">
          <div className="absolute inset-0 flex">
            {imageTimings.map((timing, slotIdx) => {
              const image = selectedImages[timing.imageIndex];
              if (!image) return null;
              const isLooped = slotIdx >= selectedImages.length;
              const width = ((timing.end - timing.start) / totalDuration) * 100;

              return (
                <div
                  key={`${slotIdx}-${timing.imageIndex}`}
                  className="relative border-r border-neutral-300 last:border-r-0 overflow-hidden"
                  style={{ width: `${width}%` }}
                  title={`${language === "ko" ? "이미지" : "Image"} ${timing.imageIndex + 1}: ${formatTime(timing.start)} - ${formatTime(timing.end)}`}
                >
                  <img
                    src={image.thumbnailUrl || image.sourceUrl}
                    alt=""
                    className={cn(
                      "w-full h-full object-cover",
                      isLooped && "opacity-70"
                    )}
                  />
                  <div className={cn(
                    "absolute inset-0",
                    isLooped ? "bg-blue-900/40" : "bg-black/30"
                  )} />
                  <div className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white font-bold",
                    isLooped ? "bg-blue-600" : "bg-neutral-900"
                  )}>
                    {timing.imageIndex + 1}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="absolute left-0 -translate-x-full pr-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 whitespace-nowrap">
            {language === "ko" ? "이미지" : "Images"}
          </div>
        </div>

        {/* Subtitle Track */}
        <div
          ref={timelineRef}
          className="relative h-10 bg-neutral-200 rounded cursor-crosshair"
          onClick={(e) => {
            // Deselect if clicking on empty space
            if (e.target === e.currentTarget) {
              setSelectedSubtitleIndex(null);
            }
          }}
        >
          {/* Grid lines aligned with images */}
          {imageTimings.map((timing, idx) => (
            <div
              key={idx}
              className="absolute top-0 bottom-0 border-l border-neutral-300 border-dashed"
              style={{ left: `${(timing.start / totalDuration) * 100}%` }}
            />
          ))}

          {/* Subtitle blocks */}
          {subtitleLines.map((line, idx) => {
            const left = (line.timing / totalDuration) * 100;
            const width = (line.duration / totalDuration) * 100;
            const isSelected = selectedSubtitleIndex === idx;

            return (
              <div
                key={idx}
                className={cn(
                  "absolute top-1 bottom-1 rounded cursor-move transition-colors group",
                  isSelected
                    ? "bg-neutral-800 ring-2 ring-neutral-900 ring-offset-1"
                    : "bg-neutral-600 hover:bg-neutral-700"
                )}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  minWidth: "20px",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectSubtitle(idx);
                }}
                onMouseDown={(e) => handleMouseDown(e, idx, "move")}
              >
                {/* Left resize handle */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 flex items-center justify-center"
                  onMouseDown={(e) => handleMouseDown(e, idx, "start")}
                >
                  <GripVertical className="h-3 w-3 text-white/50 opacity-0 group-hover:opacity-100" />
                </div>

                {/* Content */}
                <div className="absolute inset-x-2 top-0 bottom-0 flex items-center overflow-hidden">
                  <p className="text-[10px] text-white truncate px-1">
                    {line.text || `(${language === "ko" ? "자막" : "Subtitle"} ${idx + 1})`}
                  </p>
                </div>

                {/* Right resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 flex items-center justify-center"
                  onMouseDown={(e) => handleMouseDown(e, idx, "end")}
                >
                  <GripVertical className="h-3 w-3 text-white/50 opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            );
          })}

          <div className="absolute left-0 -translate-x-full pr-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 whitespace-nowrap">
            {language === "ko" ? "자막" : "Subtitles"}
          </div>
        </div>
      </div>

      {/* Selected Subtitle Editor */}
      {selectedSubtitleIndex !== null && subtitleLines[selectedSubtitleIndex] && (
        <div className="border border-neutral-200 rounded-lg p-3 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
              <Type className="h-4 w-4" />
              {language === "ko" ? `자막 ${selectedSubtitleIndex + 1} 편집` : `Edit Subtitle ${selectedSubtitleIndex + 1}`}
            </Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {formatTime(subtitleLines[selectedSubtitleIndex].timing)} -{" "}
                {formatTime(subtitleLines[selectedSubtitleIndex].timing + subtitleLines[selectedSubtitleIndex].duration)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteSubtitle}
                disabled={subtitleLines.length <= 1}
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                title={language === "ko" ? "자막 삭제" : "Delete subtitle"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={handleSaveText}
            placeholder={language === "ko" ? "자막 텍스트를 입력하세요..." : "Enter subtitle text..."}
            className="min-h-[60px] text-sm"
          />

          {/* Timing controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-500">
                {language === "ko" ? "시작 시간" : "Start Time"}
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max={totalDuration - 0.5}
                value={subtitleLines[selectedSubtitleIndex].timing.toFixed(1)}
                onChange={(e) => {
                  const newTiming = Math.max(0, Math.min(parseFloat(e.target.value) || 0, totalDuration - 0.5));
                  const newLines = [...subtitleLines];
                  newLines[selectedSubtitleIndex] = {
                    ...newLines[selectedSubtitleIndex],
                    timing: newTiming,
                  };
                  onUpdateScript(newLines);
                }}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-500">
                {language === "ko" ? "지속 시간" : "Duration"}
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0.5"
                max={totalDuration - subtitleLines[selectedSubtitleIndex].timing}
                value={subtitleLines[selectedSubtitleIndex].duration.toFixed(1)}
                onChange={(e) => {
                  const newDuration = Math.max(0.5, parseFloat(e.target.value) || 0.5);
                  const newLines = [...subtitleLines];
                  newLines[selectedSubtitleIndex] = {
                    ...newLines[selectedSubtitleIndex],
                    duration: newDuration,
                  };
                  onUpdateScript(newLines);
                }}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {subtitleLines.length > 0 && (
        <div className="text-xs text-neutral-500 text-center">
          {(() => {
            const emptyCount = subtitleLines.filter((l) => !l.text.trim()).length;
            if (emptyCount > 0) {
              return (
                <span className="text-orange-600">
                  {language === "ko"
                    ? `${emptyCount}개의 자막에 텍스트가 없습니다`
                    : `${emptyCount} subtitle(s) have no text`}
                </span>
              );
            }
            return (
              <span className="text-green-600">
                {language === "ko" ? "모든 자막이 준비되었습니다" : "All subtitles are ready"}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export function FastCutEffectStep({
  scriptData,
  setScriptData,
  selectedImages,
  selectedAudio,
  musicSkipped,
  aspectRatio,
  styleSetId,
  setStyleSetId,
  styleSets,
  tiktokSEO,
  setTiktokSEO,
  rendering,
  onStartRender,
}: FastCutEffectStepProps) {
  const { language, translate } = useI18n();

  // Handle updating all script lines (for timeline editor)
  const handleUpdateScriptLines = useCallback(
    (lines: ScriptGenerationResponse["script"]["lines"]) => {
      if (!scriptData) return;

      // Recalculate total duration
      const totalDuration = lines.reduce((sum, line) => sum + line.duration, 0);

      setScriptData({
        ...scriptData,
        script: {
          ...scriptData.script,
          lines,
          totalDuration,
        },
      });
    },
    [scriptData, setScriptData]
  );

  // Get selected style set
  const selectedStyleSet = useMemo(() => {
    return styleSets.find(s => s.id === styleSetId);
  }, [styleSets, styleSetId]);

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

  // Collect all SEO hashtags
  const allHashtags = useMemo(() => {
    if (!tiktokSEO) return [];
    return [
      tiktokSEO.hashtags.category,
      tiktokSEO.hashtags.niche,
      ...tiktokSEO.hashtags.descriptive,
      tiktokSEO.hashtags.trending || "",
    ].filter(Boolean);
  }, [tiktokSEO]);

  // Check readiness - music is ready if audio is selected OR music is skipped
  const isReady = useMemo(() => {
    const musicReady = selectedAudio !== null || musicSkipped;
    return selectedImages.length >= 3 && musicReady && scriptData !== null;
  }, [selectedImages, selectedAudio, musicSkipped, scriptData]);

  // Update SEO description
  const updateSEODescription = (description: string) => {
    if (!tiktokSEO) return;
    setTiktokSEO({ ...tiktokSEO, description });
  };

  // Add hashtag
  const addHashtag = (tag: string) => {
    if (!tiktokSEO) return;
    const trimmed = tag.trim().replace(/^#/, "");
    if (!trimmed) return;
    if (tiktokSEO.hashtags.descriptive.includes(trimmed)) return;
    setTiktokSEO({
      ...tiktokSEO,
      hashtags: {
        ...tiktokSEO.hashtags,
        descriptive: [...tiktokSEO.hashtags.descriptive, trimmed],
      },
    });
  };

  // Remove hashtag
  const removeHashtag = (tag: string) => {
    if (!tiktokSEO) return;
    setTiktokSEO({
      ...tiktokSEO,
      hashtags: {
        ...tiktokSEO.hashtags,
        descriptive: tiktokSEO.hashtags.descriptive.filter((t) => t !== tag),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-1">
          {language === "ko" ? "스타일 & 생성" : "Style & Generate"}
        </h2>
        <p className="text-sm text-neutral-500">
          {language === "ko"
            ? "스타일을 선택하고 영상을 생성하세요"
            : "Select a style and generate your video"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Images */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
          <ImageIcon className="h-5 w-5 text-neutral-500 mx-auto mb-1" />
          <p className="text-xs text-neutral-500">
            {language === "ko" ? "이미지" : "Images"}
          </p>
          <p className="text-lg font-bold text-neutral-900">
            {selectedImages.length}
          </p>
        </div>

        {/* Audio */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
          <Music className="h-5 w-5 text-neutral-500 mx-auto mb-1" />
          <p className="text-xs text-neutral-500">
            {musicSkipped ? (language === "ko" ? "음악" : "Music") : "BPM"}
          </p>
          <p className="text-lg font-bold text-neutral-900">
            {musicSkipped
              ? (language === "ko" ? "없음" : "None")
              : (selectedAudio?.bpm || "-")}
          </p>
        </div>

        {/* Aspect Ratio */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
          <Film className="h-5 w-5 text-neutral-500 mx-auto mb-1" />
          <p className="text-xs text-neutral-500">
            {language === "ko" ? "비율" : "Ratio"}
          </p>
          <p className="text-lg font-bold text-neutral-900">{aspectRatio}</p>
        </div>

        {/* Style */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
          <Palette className="h-5 w-5 text-neutral-500 mx-auto mb-1" />
          <p className="text-xs text-neutral-500">
            {language === "ko" ? "스타일" : "Style"}
          </p>
          <p className="text-lg font-bold text-neutral-900 truncate">
            {selectedStyleSet?.icon || "🎬"}
          </p>
        </div>
      </div>

      {/* Style Set Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-neutral-700 flex items-center">
          {language === "ko" ? "비디오 스타일" : "Video Style"}
          <TooltipIcon tooltipKey="fastCut.tooltips.effects.styleSet" />
        </Label>

        {/* Style Set Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {styleSets.map((styleSet) => {
            const isSelected = styleSet.id === styleSetId;
            const styleCutDuration = getCutDurationFromVibe(styleSet.vibe);
            return (
              <button
                key={styleSet.id}
                onClick={() => setStyleSetId(styleSet.id)}
                className={cn(
                  "relative p-3 rounded-lg border-2 text-left transition-all",
                  "hover:border-neutral-400 hover:bg-neutral-50",
                  isSelected
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200 bg-white"
                )}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5">
                    <div className="w-4 h-4 bg-neutral-900 rounded-full flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>
                )}

                {/* Icon and preview color */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{styleSet.icon}</span>
                  <div
                    className="w-3 h-3 rounded-full border border-neutral-200"
                    style={{ backgroundColor: styleSet.previewColor }}
                  />
                </div>

                {/* Name */}
                <p className="font-medium text-sm text-neutral-900 truncate">
                  {language === "ko" ? styleSet.nameKo : styleSet.name}
                </p>

                {/* Description */}
                <p className="text-[10px] text-neutral-500 line-clamp-2 mt-0.5">
                  {language === "ko" ? styleSet.descriptionKo : styleSet.description}
                </p>

                {/* Badges: Intensity + Speed */}
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[9px] py-0",
                      styleSet.intensity === "high" && "bg-red-100 text-red-700",
                      styleSet.intensity === "medium" && "bg-yellow-100 text-yellow-700",
                      styleSet.intensity === "low" && "bg-green-100 text-green-700"
                    )}
                  >
                    {styleSet.intensity === "high" && (language === "ko" ? "강렬함" : "High")}
                    {styleSet.intensity === "medium" && (language === "ko" ? "보통" : "Medium")}
                    {styleSet.intensity === "low" && (language === "ko" ? "차분함" : "Low")}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] py-0 text-neutral-500">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                    {styleCutDuration}s
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected style details */}
        {selectedStyleSet && (
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedStyleSet.icon}</span>
                <span className="font-medium text-neutral-900">
                  {language === "ko" ? selectedStyleSet.nameKo : selectedStyleSet.name}
                </span>
              </div>
              {/* Video duration from script */}
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {language === "ko" ? "영상 길이" : "Duration"}:{" "}
                {scriptData?.script.lines.length
                  ? formatTime(
                      scriptData.script.lines[scriptData.script.lines.length - 1].timing +
                      scriptData.script.lines[scriptData.script.lines.length - 1].duration
                    )
                  : "-"}
              </Badge>
            </div>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div>
                <span className="text-neutral-500 block">Vibe</span>
                <span className="text-neutral-700">{selectedStyleSet.vibe}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Color</span>
                <span className="text-neutral-700">{selectedStyleSet.colorGrade}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Text</span>
                <span className="text-neutral-700">{selectedStyleSet.textStyle}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">BPM</span>
                <span className="text-neutral-700">
                  {selectedStyleSet.bpmRange ? `${selectedStyleSet.bpmRange[0]}-${selectedStyleSet.bpmRange[1]}` : "-"}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">{language === "ko" ? "전환 속도" : "Transition"}</span>
                <span className="text-neutral-700 font-medium">
                  {getCutDurationFromVibe(selectedStyleSet.vibe)}s
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TikTok SEO Editing */}
      {tiktokSEO && (
        <div className="space-y-4 border border-neutral-200 rounded-lg p-4 bg-white">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            {language === "ko" ? "TikTok SEO 편집" : "Edit TikTok SEO"}
          </h3>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500 flex items-center">
              {language === "ko" ? "설명" : "Description"}
              <TooltipIcon tooltipKey="fastCut.tooltips.effects.seo.description" />
            </Label>
            <Textarea
              value={tiktokSEO.description}
              onChange={(e) => updateSEODescription(e.target.value)}
              className="min-h-[60px] bg-neutral-50 border-neutral-200 text-sm"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500 flex items-center">
              {language === "ko" ? "해시태그" : "Hashtags"}
              <TooltipIcon tooltipKey="fastCut.tooltips.effects.seo.hashtags" />
            </Label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-neutral-50 border border-neutral-200 rounded-lg min-h-[48px]">
              {allHashtags.map((tag, idx) => (
                <Badge
                  key={`${tag}-${idx}`}
                  variant="secondary"
                  className="text-xs bg-neutral-200 text-neutral-700"
                >
                  #{tag}
                  <button
                    onClick={() => removeHashtag(tag)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <KeywordInputPopover
                onAdd={addHashtag}
                placeholder={language === "ko" ? "새 해시태그..." : "New hashtag..."}
                buttonText=""
              />
            </div>
          </div>

          {/* Keywords & Search Intent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-neutral-500 flex items-center">
                {language === "ko" ? "주요 키워드" : "Primary Keyword"}
                <TooltipIcon tooltipKey="fastCut.tooltips.effects.seo.primaryKeyword" />
              </Label>
              <Input
                value={tiktokSEO.keywords.primary}
                onChange={(e) =>
                  setTiktokSEO({
                    ...tiktokSEO,
                    keywords: { ...tiktokSEO.keywords, primary: e.target.value },
                  })
                }
                className="bg-neutral-50 border-neutral-200 text-sm h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-500 flex items-center">
                {language === "ko" ? "검색 의도" : "Search Intent"}
                <TooltipIcon tooltipKey="fastCut.tooltips.effects.seo.searchIntent" />
              </Label>
              <Select
                value={tiktokSEO.searchIntent}
                onValueChange={(v) =>
                  setTiktokSEO({
                    ...tiktokSEO,
                    searchIntent: v as TikTokSEO["searchIntent"],
                  })
                }
              >
                <SelectTrigger className="bg-neutral-50 border-neutral-200 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutorial">Tutorial</SelectItem>
                  <SelectItem value="discovery">Discovery</SelectItem>
                  <SelectItem value="entertainment">Entertainment</SelectItem>
                  <SelectItem value="inspiration">Inspiration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Timeline Editor */}
      {selectedImages.length > 0 && scriptData && (
        <SubtitleTimelineEditor
          selectedImages={selectedImages}
          scriptData={scriptData}
          onUpdateScript={handleUpdateScriptLines}
          selectedStyleSet={selectedStyleSet}
          language={language}
        />
      )}

      {/* Readiness Check */}
      {!isReady && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-orange-700">
              {language === "ko" ? "준비가 필요합니다" : "Not ready"}
            </p>
            <ul className="text-orange-600 text-xs mt-1 space-y-0.5">
              {selectedImages.length < 3 && (
                <li>
                  • {language === "ko" ? "이미지가 부족합니다 (최소 3장)" : "Need more images (min 3)"}
                </li>
              )}
              {!selectedAudio && !musicSkipped && (
                <li>
                  • {language === "ko" ? "음악을 선택하거나 건너뛰세요" : "Select music or skip"}
                </li>
              )}
              {!scriptData && (
                <li>
                  • {language === "ko" ? "스크립트를 생성하세요" : "Generate script"}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}
