"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Copy,
  Wand2,
  Lock,
  Image as ImageIcon,
  Music,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  Star,
  Palette,
  Sparkles,
  Type,
  Zap,
  X,
} from "lucide-react";
import { ProcessingVideo } from "@/lib/stores/workflow-store";

// Style sets configuration matching the backend presets
const STYLE_SETS = [
  { id: "viral_tiktok", name: "Viral TikTok", nameKo: "바이럴 틱톡", icon: "🔥", vibe: "Exciting", effectPreset: "zoom_beat", colorGrade: "vibrant", textStyle: "bold_pop" },
  { id: "cinematic_mood", name: "Cinematic Mood", nameKo: "시네마틱 무드", icon: "🎬", vibe: "Emotional", effectPreset: "crossfade", colorGrade: "cinematic", textStyle: "fade_in" },
  { id: "clean_minimal", name: "Clean Minimal", nameKo: "클린 미니멀", icon: "✨", vibe: "Minimal", effectPreset: "minimal", colorGrade: "natural", textStyle: "minimal" },
  { id: "energetic_beat", name: "Energetic Beat", nameKo: "에너제틱 비트", icon: "⚡", vibe: "Exciting", effectPreset: "zoom_beat", colorGrade: "vibrant", textStyle: "bold_pop" },
  { id: "retro_aesthetic", name: "Retro Aesthetic", nameKo: "레트로 감성", icon: "📼", vibe: "Pop", effectPreset: "crossfade", colorGrade: "vintage", textStyle: "fade_in" },
  { id: "professional_corp", name: "Professional", nameKo: "프로페셔널", icon: "💼", vibe: "Minimal", effectPreset: "minimal", colorGrade: "cool", textStyle: "slide_in" },
  { id: "dreamy_soft", name: "Dreamy Soft", nameKo: "드리미 소프트", icon: "🌸", vibe: "Emotional", effectPreset: "crossfade", colorGrade: "warm", textStyle: "fade_in" },
  { id: "bold_impact", name: "Bold Impact", nameKo: "볼드 임팩트", icon: "💥", vibe: "Exciting", effectPreset: "zoom_beat", colorGrade: "dramatic", textStyle: "bold_pop" },
];

interface VariationPanelProps {
  video: ProcessingVideo;
  onCreateVariations: (settings: VariationSettings) => Promise<void>;
  isCreating: boolean;
  onClose: () => void;
}

interface VariationSettings {
  effectPresets: string[];
  colorGrades: string[];
  textStyles: string[];
  vibeVariations: string[];
  variationCount: number;
}

export function VariationPanel({
  video,
  onCreateVariations,
  isCreating,
  onClose,
}: VariationPanelProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Selected style sets
  const [selectedStyleSets, setSelectedStyleSets] = useState<string[]>([]);

  // Toggle style set selection
  const toggleStyleSet = useCallback((styleId: string) => {
    setSelectedStyleSets((prev) =>
      prev.includes(styleId)
        ? prev.filter((id) => id !== styleId)
        : [...prev, styleId]
    );
  }, []);

  // Calculate variations count and extract unique settings
  const variationSettings = useMemo(() => {
    const effectPresets = new Set<string>();
    const colorGrades = new Set<string>();
    const textStyles = new Set<string>();
    const vibes = new Set<string>();

    selectedStyleSets.forEach((styleId) => {
      const style = STYLE_SETS.find((s) => s.id === styleId);
      if (style) {
        effectPresets.add(style.effectPreset);
        colorGrades.add(style.colorGrade);
        textStyles.add(style.textStyle);
        vibes.add(style.vibe);
      }
    });

    return {
      effectPresets: Array.from(effectPresets),
      colorGrades: Array.from(colorGrades),
      textStyles: Array.from(textStyles),
      vibeVariations: Array.from(vibes),
      // Calculate combinations
      count:
        Math.max(1, effectPresets.size) *
        Math.max(1, colorGrades.size) *
        Math.max(1, textStyles.size) *
        Math.max(1, vibes.size),
    };
  }, [selectedStyleSets]);

  // Handle create variations
  const handleCreateVariations = useCallback(async () => {
    if (selectedStyleSets.length === 0) return;

    await onCreateVariations({
      effectPresets: variationSettings.effectPresets,
      colorGrades: variationSettings.colorGrades,
      textStyles: variationSettings.textStyles,
      vibeVariations: variationSettings.vibeVariations,
      variationCount: variationSettings.count,
    });
  }, [selectedStyleSets, variationSettings, onCreateVariations]);

  // Quick select all
  const handleSelectAll = useCallback(() => {
    if (selectedStyleSets.length === STYLE_SETS.length) {
      setSelectedStyleSets([]);
    } else {
      setSelectedStyleSets(STYLE_SETS.map((s) => s.id));
    }
  }, [selectedStyleSets.length]);

  // Extract script/image count from metadata
  const metadata = video.metadata as Record<string, unknown>;
  const scriptData = metadata?.scriptData as { lines?: unknown[] } | undefined;
  const imageAssets = metadata?.imageAssets as unknown[] | undefined;
  const scriptLineCount = scriptData?.lines?.length || 0;
  const imageCount = imageAssets?.length || 0;

  return (
    <Card className="border-2 border-neutral-200 bg-neutral-50 rounded-xl">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Copy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">
                {isKorean ? "베리에이션 생성" : "Create Variations"}
              </h3>
              <p className="text-xs text-neutral-500">
                {isKorean
                  ? "동일한 콘텐츠로 다양한 스타일의 영상 생성"
                  : "Generate multiple videos with different styles"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Original Content Summary (Locked) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-neutral-400" />
              <Label className="text-sm font-medium text-neutral-600">
                {isKorean ? "고정된 콘텐츠" : "Fixed Content"}
              </Label>
              <Badge variant="secondary" className="text-[10px] bg-neutral-200">
                {isKorean ? "변경 불가" : "Locked"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Script */}
              <div className="p-3 bg-white rounded-lg border border-neutral-200">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-600">
                    {isKorean ? "스크립트" : "Script"}
                  </span>
                </div>
                <p className="text-sm font-semibold">
                  {scriptLineCount > 0 ? `${scriptLineCount} lines` : "-"}
                </p>
              </div>
              {/* Images */}
              <div className="p-3 bg-white rounded-lg border border-neutral-200">
                <div className="flex items-center gap-2 mb-1">
                  <ImageIcon className="w-4 h-4 text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-600">
                    {isKorean ? "이미지" : "Images"}
                  </span>
                </div>
                <p className="text-sm font-semibold">
                  {imageCount > 0 ? `${imageCount} images` : "-"}
                </p>
              </div>
              {/* Music */}
              <div className="p-3 bg-white rounded-lg border border-neutral-200">
                <div className="flex items-center gap-2 mb-1">
                  <Music className="w-4 h-4 text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-600">
                    {isKorean ? "음악" : "Music"}
                  </span>
                </div>
                <p className="text-sm font-semibold truncate">
                  {video.metadata.audioName || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Style Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-600" />
                <Label className="text-sm font-medium text-neutral-700">
                  {isKorean ? "스타일 선택" : "Select Styles"}
                </Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-7 text-xs text-neutral-500 hover:text-neutral-700"
              >
                {selectedStyleSets.length === STYLE_SETS.length
                  ? isKorean
                    ? "전체 해제"
                    : "Deselect All"
                  : isKorean
                  ? "전체 선택"
                  : "Select All"}
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {STYLE_SETS.map((style) => {
                const isSelected = selectedStyleSets.includes(style.id);
                return (
                  <button
                    key={style.id}
                    onClick={() => toggleStyleSet(style.id)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-left",
                      isSelected
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg">{style.icon}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-xs font-medium truncate",
                        isSelected ? "text-white" : "text-neutral-700"
                      )}
                    >
                      {isKorean ? style.nameKo : style.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Variation Preview */}
          {selectedStyleSets.length > 0 && (
            <div className="p-4 bg-white rounded-lg border border-neutral-200 space-y-3">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-neutral-600" />
                <Label className="text-sm font-medium text-neutral-700">
                  {isKorean ? "생성될 조합" : "Combinations to Generate"}
                </Label>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">
                    {isKorean ? "효과" : "Effects"}
                  </p>
                  <p className="text-sm font-semibold">
                    {variationSettings.effectPresets.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">
                    {isKorean ? "색감" : "Colors"}
                  </p>
                  <p className="text-sm font-semibold">
                    {variationSettings.colorGrades.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">
                    {isKorean ? "텍스트" : "Text"}
                  </p>
                  <p className="text-sm font-semibold">
                    {variationSettings.textStyles.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">
                    {isKorean ? "분위기" : "Vibe"}
                  </p>
                  <p className="text-sm font-semibold">
                    {variationSettings.vibeVariations.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2 border-t border-neutral-100">
                <span className="text-sm text-neutral-500">
                  {isKorean ? "총 베리에이션:" : "Total Variations:"}
                </span>
                <Badge className="bg-neutral-900 text-white px-3 py-1 text-sm">
                  {Math.min(variationSettings.count, 9)}
                </Badge>
                {variationSettings.count > 9 && (
                  <span className="text-xs text-neutral-400">
                    ({isKorean ? "최대 9개" : "max 9"})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-200 bg-white rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              {isKorean
                ? "원본 영상의 스크립트와 이미지를 유지하며 스타일만 변경합니다"
                : "Keeps original script & images, changes only the style"}
            </p>
            <Button
              onClick={handleCreateVariations}
              disabled={selectedStyleSets.length === 0 || isCreating}
              className="h-10 px-6 bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isKorean ? "생성 중..." : "Creating..."}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  {isKorean
                    ? `${Math.min(variationSettings.count, 9)}개 베리에이션 생성`
                    : `Create ${Math.min(variationSettings.count, 9)} Variations`}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact variation button to trigger the panel
export function VariationButton({
  video,
  onClick,
  disabled,
}: {
  video: ProcessingVideo;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Only show for completed COMPOSE videos
  if (video.status !== "completed" || video.generationType !== "COMPOSE") {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-8 gap-1.5 text-xs border-neutral-300 hover:bg-neutral-100"
    >
      <Copy className="w-3.5 h-3.5" />
      {isKorean ? "베리에이션" : "Variations"}
    </Button>
  );
}

// Badge to show if video is an original or variation
export function VariationBadge({
  video,
  isOriginal,
}: {
  video: ProcessingVideo;
  isOriginal?: boolean;
}) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Check if this is a variation
  const metadata = video.metadata as Record<string, unknown>;
  const isVariation = video.id.includes("compose-var-") || metadata?.seedGenerationId;
  const variationLabel = metadata?.variationLabel as string | undefined;

  if (isOriginal) {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
        <Star className="w-3 h-3 fill-amber-500" />
        {isKorean ? "원본" : "Original"}
      </Badge>
    );
  }

  if (isVariation) {
    return (
      <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 text-[10px]">
        {variationLabel || (isKorean ? "베리에이션" : "Variation")}
      </Badge>
    );
  }

  return null;
}
