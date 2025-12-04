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
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Film,
  Music,
  Image as ImageIcon,
  Check,
  Hash,
  X,
  Plus,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import {
  ScriptGenerationResponse,
  ImageCandidate,
  AudioMatch,
  TikTokSEO,
  EFFECT_PRESETS,
} from "@/lib/compose-api";

interface ComposeEffectStepProps {
  scriptData: ScriptGenerationResponse | null;
  selectedImages: ImageCandidate[];
  selectedAudio: AudioMatch | null;
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
  aspectRatio,
  effectPreset,
  setEffectPreset,
  tiktokSEO,
  setTiktokSEO,
  rendering,
  onStartRender,
}: ComposeEffectStepProps) {
  const { language } = useI18n();

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

  // Check readiness
  const isReady = useMemo(() => {
    return selectedImages.length >= 3 && selectedAudio !== null && scriptData !== null;
  }, [selectedImages, selectedAudio, scriptData]);

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
          <p className="text-xs text-neutral-500">BPM</p>
          <p className="text-lg font-bold text-neutral-900">
            {selectedAudio?.bpm || "-"}
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
        <Label className="text-sm font-medium text-neutral-700">
          {language === "ko" ? "효과 프리셋" : "Effect Preset"}
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
            <Label className="text-xs text-neutral-500">
              {language === "ko" ? "설명" : "Description"}
            </Label>
            <Textarea
              value={tiktokSEO.description}
              onChange={(e) => updateSEODescription(e.target.value)}
              className="min-h-[60px] bg-neutral-50 border-neutral-200 text-sm"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500">
              {language === "ko" ? "해시태그" : "Hashtags"}
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
              <button
                onClick={() => {
                  const tag = window.prompt(
                    language === "ko" ? "새 해시태그:" : "New hashtag:"
                  );
                  if (tag) addHashtag(tag);
                }}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-neutral-500 border border-dashed border-neutral-300 rounded-full hover:border-neutral-400"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Keywords & Search Intent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-neutral-500">
                {language === "ko" ? "주요 키워드" : "Primary Keyword"}
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
              <Label className="text-xs text-neutral-500">
                {language === "ko" ? "검색 의도" : "Search Intent"}
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
              {!selectedAudio && (
                <li>
                  • {language === "ko" ? "음악을 선택하세요" : "Select music"}
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
