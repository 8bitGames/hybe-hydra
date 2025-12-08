"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Sparkles,
  Film,
  Music,
  Image as ImageIcon,
  Check,
  Hash,
  X,
  AlertCircle,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import {
  ScriptGenerationResponse,
  ImageCandidate,
  AudioMatch,
  TikTokSEO,
  EFFECT_PRESETS,
} from "@/lib/compose-api";
import { KeywordInputPopover } from "@/components/ui/keyword-input-popover";

interface ComposeEffectStepProps {
  scriptData: ScriptGenerationResponse | null;
  selectedImages: ImageCandidate[];
  selectedAudio: AudioMatch | null;
  musicSkipped: boolean;
  aspectRatio: string;
  effectPreset: string;
  setEffectPreset: (preset: string) => void;
  tiktokSEO: TikTokSEO | null;
  setTiktokSEO: (seo: TikTokSEO | null) => void;
  rendering: boolean;
  onStartRender: () => void;
}

export function ComposeEffectStep({
  scriptData,
  selectedImages,
  selectedAudio,
  musicSkipped,
  aspectRatio,
  effectPreset,
  setEffectPreset,
  tiktokSEO,
  setTiktokSEO,
  rendering,
  onStartRender,
}: ComposeEffectStepProps) {
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-1">
            {language === "ko" ? "효과 & 생성" : "Effects & Generate"}
          </h2>
          <p className="text-sm text-neutral-500">
            {language === "ko"
              ? "효과를 선택하고 영상을 생성하세요"
              : "Select effects and generate your video"}
          </p>
        </div>

        {/* Generate Button - Prominent position */}
        {isReady && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onStartRender}
                disabled={rendering}
                className="bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {rendering ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-1 animate-spin" />
                    {language === "ko" ? "생성 중..." : "Generating..."}
                  </>
                ) : (
                  <>
                    {language === "ko" ? "영상 생성" : "Generate Video"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px]">
              <p className="text-xs">{translate("compose.tooltips.effects.generateVideo")}</p>
            </TooltipContent>
          </Tooltip>
        )}
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

        {/* Vibe */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
          <Sparkles className="h-5 w-5 text-neutral-500 mx-auto mb-1" />
          <p className="text-xs text-neutral-500">Vibe</p>
          <p className="text-lg font-bold text-neutral-900 truncate">
            {scriptData?.vibe || "-"}
          </p>
        </div>
      </div>

      {/* Effect Preset Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-neutral-700 flex items-center">
          {language === "ko" ? "효과 프리셋" : "Effect Preset"}
          <TooltipIcon tooltipKey="compose.tooltips.effects.preset" />
        </Label>
        <Select value={effectPreset} onValueChange={setEffectPreset}>
          <SelectTrigger className="w-full bg-neutral-50 border-neutral-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EFFECT_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                <div className="flex items-center gap-2">
                  <span>{preset.label}</span>
                  <span className="text-xs text-neutral-400">
                    - {preset.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-neutral-400">
          {scriptData?.effectRecommendation && (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {language === "ko" ? "AI 추천:" : "AI recommends:"}{" "}
              {scriptData.effectRecommendation}
            </span>
          )}
        </p>
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
              <TooltipIcon tooltipKey="compose.tooltips.effects.seo.description" />
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
              <TooltipIcon tooltipKey="compose.tooltips.effects.seo.hashtags" />
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
                <TooltipIcon tooltipKey="compose.tooltips.effects.seo.primaryKeyword" />
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
                <TooltipIcon tooltipKey="compose.tooltips.effects.seo.searchIntent" />
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

      {/* First Frame Preview - Shows how the video will look */}
      {selectedImages.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
            <Film className="h-4 w-4" />
            {language === "ko" ? "첫 프레임 미리보기" : "First Frame Preview"}
            <TooltipIcon tooltipKey="compose.tooltips.effects.preview" />
          </Label>
          <div className="relative w-full max-w-[280px] mx-auto">
            <div
              className={cn(
                "relative rounded-lg overflow-hidden border-2 border-neutral-200 bg-neutral-900",
                aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "1:1" ? "aspect-square" : "aspect-video"
              )}
            >
              {/* Background Image */}
              <img
                src={selectedImages[0]?.thumbnailUrl || selectedImages[0]?.sourceUrl}
                alt="First frame preview"
                className="w-full h-full object-cover"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {/* Script Text Preview */}
              {scriptData?.script.lines && scriptData.script.lines[0] && (
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white text-sm font-medium text-center drop-shadow-lg line-clamp-2">
                    {scriptData.script.lines[0].text}
                  </p>
                </div>
              )}
              {/* Effect Badge */}
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="bg-black/50 text-white text-[9px] backdrop-blur-sm">
                  {EFFECT_PRESETS.find(p => p.value === effectPreset)?.label || effectPreset}
                </Badge>
              </div>
              {/* Audio Info */}
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="bg-black/50 text-white text-[9px] backdrop-blur-sm">
                  <Music className="h-2.5 w-2.5 mr-1" />
                  {musicSkipped
                    ? (language === "ko" ? "음악 없음" : "No Music")
                    : (selectedAudio?.bpm ? `${selectedAudio.bpm} BPM` : "-")}
                </Badge>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 text-center mt-1">
              {language === "ko"
                ? "실제 영상은 선택한 효과에 따라 달라질 수 있습니다"
                : "Actual video may vary based on selected effects"}
            </p>
          </div>
        </div>
      )}

      {/* Selected Images Preview */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-neutral-700">
          {language === "ko" ? "선택된 이미지" : "Selected Images"} ({selectedImages.length})
        </Label>
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {selectedImages.map((image, idx) => (
              <div
                key={image.id}
                className="relative flex-shrink-0 w-14 aspect-[3/4] rounded-lg overflow-hidden border border-neutral-200"
              >
                <img
                  src={image.thumbnailUrl || image.sourceUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-neutral-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

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
