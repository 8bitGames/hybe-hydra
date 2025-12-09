"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Slider } from "@/components/ui/slider";
import {
  Wand2,
  Music,
  Clock,
  Ratio,
  Image,
  AlertCircle,
  Check,
  Send,
  Hash,
  Timer,
  Zap,
  Palette,
  Type,
  Sparkles,
  Bot,
  TrendingUp,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SocialAccount } from "@/lib/publishing-api";
import { useI18n } from "@/lib/i18n";
import { FastCutPipelineMetadata } from "../types";

// Effect presets for compose variations
const EFFECT_PRESETS = [
  {
    value: "zoom_beat",
    label: "Zoom Beat",
    labelKo: "줌 비트",
    description: "Zoom effects synced to music beats",
    descriptionKo: "음악 비트에 맞춘 줌 효과",
    icon: Zap,
  },
  {
    value: "crossfade",
    label: "Crossfade",
    labelKo: "크로스페이드",
    description: "Smooth fade transitions",
    descriptionKo: "부드러운 페이드 전환",
    icon: Sparkles,
  },
  {
    value: "bounce",
    label: "Bounce",
    labelKo: "바운스",
    description: "Bouncy, playful transitions",
    descriptionKo: "통통 튀는 전환 효과",
    icon: Zap,
  },
  {
    value: "minimal",
    label: "Minimal",
    labelKo: "미니멀",
    description: "Simple cuts, no effects",
    descriptionKo: "심플한 컷, 효과 없음",
    icon: Type,
  },
];

// Color grade presets
const COLOR_GRADE_PRESETS = [
  { value: "vibrant", label: "Vibrant", labelKo: "비비드", description: "Saturated, punchy colors" },
  { value: "cinematic", label: "Cinematic", labelKo: "시네마틱", description: "Film-like color grading" },
  { value: "bright", label: "Bright", labelKo: "밝은", description: "Light and airy tones" },
  { value: "natural", label: "Natural", labelKo: "자연스러운", description: "Minimal color adjustment" },
  { value: "moody", label: "Moody", labelKo: "무디", description: "Dark, atmospheric tones" },
];

// Text style presets
const TEXT_STYLE_PRESETS = [
  { value: "bold_pop", label: "Bold Pop", labelKo: "볼드 팝", description: "Bold, eye-catching text" },
  { value: "fade_in", label: "Fade In", labelKo: "페이드 인", description: "Gentle fade-in text" },
  { value: "slide_in", label: "Slide In", labelKo: "슬라이드 인", description: "Text slides into frame" },
  { value: "minimal", label: "Minimal", labelKo: "미니멀", description: "Simple, clean text" },
  { value: "none", label: "No Text", labelKo: "텍스트 없음", description: "Hide text overlay" },
];

// Vibe presets for compose
const VIBE_PRESETS = [
  { value: "Exciting", label: "Exciting", labelKo: "신나는", description: "Fast, energetic" },
  { value: "Emotional", label: "Emotional", labelKo: "감성적인", description: "Slow, heartfelt" },
  { value: "Pop", label: "Pop", labelKo: "팝", description: "Trendy, mainstream" },
  { value: "Minimal", label: "Minimal", labelKo: "미니멀", description: "Clean, professional" },
];

export interface AutoPublishConfig {
  enabled: boolean;
  socialAccountId: string | null;
  intervalMinutes: number;
  caption: string;
  hashtags: string[];
  generateGeoAeo: boolean;  // Auto-generate GEO/AEO optimized caption when video completes
}

export interface ComposeVariationConfig {
  effectPresets: string[];
  colorGrades: string[];
  textStyles: string[];
  vibeVariations: string[];
  maxVariations: number;
  autoPublish?: AutoPublishConfig;
}

interface ComposeVariationModalProps {
  isOpen: boolean;
  onClose: () => void;
  seedGeneration: {
    id: string;
    prompt: string;
    duration_seconds: number;
    aspect_ratio: string;
    composed_output_url?: string | null;
    output_url?: string | null;
    audio_asset?: {
      id: string;
      original_filename: string;
    } | null;
  } | null;
  metadata?: FastCutPipelineMetadata;
  onCreateVariations: (config: ComposeVariationConfig) => Promise<void>;
  isCreating: boolean;
  socialAccounts?: SocialAccount[];
}

export function ComposeVariationModal({
  isOpen,
  onClose,
  seedGeneration,
  metadata,
  onCreateVariations,
  isCreating,
  socialAccounts = [],
}: ComposeVariationModalProps) {
  const { t, language } = useI18n();
  const isKorean = language === "ko";

  // Selected options
  const [selectedEffects, setSelectedEffects] = useState<string[]>(["zoom_beat", "crossfade"]);
  const [selectedColorGrades, setSelectedColorGrades] = useState<string[]>(["vibrant"]);
  const [selectedTextStyles, setSelectedTextStyles] = useState<string[]>(["bold_pop"]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);

  // Max variations limit
  const [maxVariations, setMaxVariations] = useState(9);

  // Auto-publish settings
  const [enableAutoPublish, setEnableAutoPublish] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [publishIntervalMinutes, setPublishIntervalMinutes] = useState(30);
  const [publishCaption, setPublishCaption] = useState("");
  const [publishHashtags, setPublishHashtags] = useState("");

  // GEO/AEO auto-generation toggle
  const [enableGeoAeo, setEnableGeoAeo] = useState(true);

  // Filter TikTok accounts with valid tokens
  const tiktokAccounts = useMemo(() => {
    return socialAccounts.filter(
      (account) => account.platform === "TIKTOK" && account.is_token_valid
    );
  }, [socialAccounts]);

  // Calculate estimated variations
  const estimatedVariations = useMemo(() => {
    let count = 1;

    if (selectedEffects.length > 0) {
      count *= selectedEffects.length;
    }
    if (selectedColorGrades.length > 0) {
      count *= selectedColorGrades.length;
    }
    if (selectedTextStyles.length > 0) {
      count *= selectedTextStyles.length;
    }
    if (selectedVibes.length > 0) {
      count *= selectedVibes.length;
    }

    return Math.min(count, maxVariations);
  }, [selectedEffects, selectedColorGrades, selectedTextStyles, selectedVibes, maxVariations]);

  // Toggle selection helpers
  const toggleEffect = (value: string) => {
    setSelectedEffects((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const toggleColorGrade = (value: string) => {
    setSelectedColorGrades((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const toggleTextStyle = (value: string) => {
    setSelectedTextStyles((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const toggleVibe = (value: string) => {
    setSelectedVibes((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  // Handle create variations
  const handleCreate = async () => {
    if (!seedGeneration) return;

    const config: ComposeVariationConfig = {
      effectPresets: selectedEffects,
      colorGrades: selectedColorGrades,
      textStyles: selectedTextStyles,
      vibeVariations: selectedVibes,
      maxVariations,
    };

    // Add auto-publish config if enabled
    if (enableAutoPublish && selectedAccountId) {
      config.autoPublish = {
        enabled: true,
        socialAccountId: selectedAccountId,
        intervalMinutes: publishIntervalMinutes,
        caption: publishCaption,
        hashtags: publishHashtags
          .split(/[,\s]+/)
          .map((tag) => tag.replace(/^#/, "").trim())
          .filter(Boolean),
        generateGeoAeo: enableGeoAeo,  // Include GEO/AEO auto-generation setting
      };
    }

    await onCreateVariations(config);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedEffects(["zoom_beat", "crossfade"]);
      setSelectedColorGrades(["vibrant"]);
      setSelectedTextStyles(["bold_pop"]);
      setSelectedVibes([]);
      setMaxVariations(9);
      // Reset auto-publish settings
      setEnableAutoPublish(false);
      setSelectedAccountId("");
      setPublishIntervalMinutes(30);
      setPublishCaption("");
      setPublishHashtags("");
      // Reset GEO/AEO toggle (default enabled)
      setEnableGeoAeo(true);
    }
  }, [isOpen]);

  if (!seedGeneration) return null;

  const hasSelections = selectedEffects.length > 0 || selectedColorGrades.length > 0 || selectedTextStyles.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            {isKorean ? "컴포즈 영상 변형 생성" : "Create Compose Video Variations"}
          </DialogTitle>
          <DialogDescription>
            {isKorean
              ? "컴포즈 영상의 효과와 스타일을 다양하게 변형합니다"
              : "Create variations with different effects and styles for your Compose video"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Seed Generation Info - Fixed Settings */}
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Check className="w-4 h-4 text-purple-500" />
              {isKorean ? "고정 설정 (Seed 컴포즈 영상)" : "Fixed Settings (Seed Compose Video)"}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0 border-purple-500/30">
                  {isKorean ? "키워드" : "Keywords"}
                </Badge>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {metadata?.keywords?.join(", ") || seedGeneration.prompt}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {metadata?.imageCount && (
                  <span className="flex items-center gap-1">
                    <Image className="w-3 h-3 text-purple-500" />
                    {metadata.imageCount} {isKorean ? "장" : "images"}
                  </span>
                )}
                {seedGeneration.audio_asset && (
                  <span className="flex items-center gap-1">
                    <Music className="w-3 h-3 text-pink-500" />
                    {seedGeneration.audio_asset.original_filename}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {seedGeneration.duration_seconds}s
                </span>
                <span className="flex items-center gap-1">
                  <Ratio className="w-3 h-3" />
                  {seedGeneration.aspect_ratio}
                </span>
              </div>
            </div>
          </div>

          {/* Effect Preset Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              {isKorean ? "트랜지션 효과" : "Transition Effects"}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {EFFECT_PRESETS.map((effect) => {
                const isSelected = selectedEffects.includes(effect.value);
                const Icon = effect.icon;
                return (
                  <div
                    key={effect.value}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleEffect(effect.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleEffect(effect.value);
                      }
                    }}
                    className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-purple-500 bg-purple-500/5"
                        : "border-border hover:border-purple-500/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleEffect(effect.value)} />
                      <Icon className={`w-4 h-4 ${isSelected ? "text-purple-500" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium">
                        {isKorean ? effect.labelKo : effect.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 pl-6">
                      {isKorean ? effect.descriptionKo : effect.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color Grade Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-500" />
              {isKorean ? "컬러 그레이딩" : "Color Grading"}
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_GRADE_PRESETS.map((grade) => {
                const isSelected = selectedColorGrades.includes(grade.value);
                return (
                  <Badge
                    key={grade.value}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-500 hover:bg-purple-600"
                        : "hover:border-purple-500/50"
                    }`}
                    onClick={() => toggleColorGrade(grade.value)}
                  >
                    {isKorean ? grade.labelKo : grade.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Text Style Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Type className="w-4 h-4 text-purple-500" />
              {isKorean ? "텍스트 스타일" : "Text Style"}
            </Label>
            <div className="flex flex-wrap gap-2">
              {TEXT_STYLE_PRESETS.map((style) => {
                const isSelected = selectedTextStyles.includes(style.value);
                return (
                  <Badge
                    key={style.value}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-500 hover:bg-purple-600"
                        : "hover:border-purple-500/50"
                    }`}
                    onClick={() => toggleTextStyle(style.value)}
                  >
                    {isKorean ? style.labelKo : style.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Vibe Variation (Optional) */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              {isKorean ? "분위기 변형 (선택)" : "Vibe Variations (Optional)"}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isKorean
                ? "다른 분위기로 재생성합니다. 선택하지 않으면 현재 분위기를 유지합니다."
                : "Re-generate with different vibes. Leave empty to keep current vibe."}
            </p>
            <div className="flex flex-wrap gap-2">
              {VIBE_PRESETS.map((vibe) => {
                const isSelected = selectedVibes.includes(vibe.value);
                return (
                  <Badge
                    key={vibe.value}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? "bg-pink-500 hover:bg-pink-600"
                        : "hover:border-pink-500/50"
                    }`}
                    onClick={() => toggleVibe(vibe.value)}
                  >
                    {isKorean ? vibe.labelKo : vibe.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Max Variations Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                {isKorean ? "최대 생성 수" : "Maximum Variations"}
              </Label>
              <span className="text-sm text-muted-foreground">{maxVariations}</span>
            </div>
            <Slider
              value={[maxVariations]}
              onValueChange={([value]) => setMaxVariations(value)}
              min={3}
              max={20}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {isKorean
                ? "컴포즈 영상 렌더링은 AI 영상 생성보다 빠릅니다"
                : "Compose Video rendering is faster than AI Video generation"}
            </p>
          </div>

          {/* Auto-Publish Settings */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-publish"
                checked={enableAutoPublish}
                onCheckedChange={(checked: boolean | "indeterminate") => setEnableAutoPublish(checked === true)}
              />
              <Label htmlFor="auto-publish" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-500" />
                {isKorean ? "완료 시 자동 TikTok 게시" : "Auto-publish to TikTok on completion"}
              </Label>
            </div>

            {enableAutoPublish && (
              <div className="pl-6 space-y-4 bg-muted/30 rounded-lg p-4">
                {tiktokAccounts.length === 0 ? (
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-600 font-medium">
                        {isKorean ? "연결된 TikTok 계정이 없습니다" : "No TikTok accounts connected"}
                      </p>
                      <p className="text-xs text-yellow-600/80 mt-1">
                        {isKorean
                          ? "설정 > 계정에서 TikTok 계정을 연결해주세요"
                          : "Connect a TikTok account in Settings > Accounts"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Account Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm">
                        {isKorean ? "TikTok 계정" : "TikTok Account"}
                      </Label>
                      <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                        <SelectTrigger>
                          <SelectValue placeholder={isKorean ? "계정 선택..." : "Select account..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {tiktokAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              <span className="flex items-center gap-2">
                                <span>@{account.account_name}</span>
                                {account.follower_count && (
                                  <span className="text-muted-foreground text-xs">
                                    ({account.follower_count.toLocaleString()} followers)
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Publish Interval */}
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        {isKorean ? "게시 간격 (분)" : "Publish Interval (minutes)"}
                      </Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[publishIntervalMinutes]}
                          onValueChange={([value]) => setPublishIntervalMinutes(value)}
                          min={5}
                          max={120}
                          step={5}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-16 text-right">
                          {publishIntervalMinutes}분
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isKorean
                          ? `${estimatedVariations}개 영상이 약 ${Math.ceil((estimatedVariations - 1) * publishIntervalMinutes / 60)}시간에 걸쳐 게시됩니다`
                          : `${estimatedVariations} videos will be published over ~${Math.ceil((estimatedVariations - 1) * publishIntervalMinutes / 60)} hours`}
                      </p>
                    </div>

                    {/* GEO/AEO Auto Generate Toggle */}
                    <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-purple-500/5 to-green-500/5 border border-purple-500/20 rounded-lg">
                      <Checkbox
                        id="geo-aeo-toggle"
                        checked={enableGeoAeo}
                        onCheckedChange={(checked: boolean | "indeterminate") => setEnableGeoAeo(checked === true)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor="geo-aeo-toggle" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                          <Bot className="w-4 h-4 text-purple-500" />
                          {isKorean ? "AI 캡션 & 태그 자동 생성" : "Auto-generate AI Caption & Tags"}
                          <Badge variant="outline" className="text-xs border-green-500/50 text-green-600">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            GEO/AEO
                          </Badge>
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isKorean
                            ? "영상 완료 시 키워드 기반으로 검색 최적화된 캡션과 해시태그가 자동 생성됩니다"
                            : "Auto-generates search-optimized caption and hashtags based on keywords when video completes"}
                        </p>
                      </div>
                    </div>

                    {/* Manual Caption (only shown when GEO/AEO is disabled) */}
                    {!enableGeoAeo && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm">
                            {isKorean ? "캡션 (선택사항)" : "Caption (optional)"}
                          </Label>
                          <Textarea
                            value={publishCaption}
                            onChange={(e) => setPublishCaption(e.target.value)}
                            placeholder={isKorean ? "영상과 함께 게시될 캡션..." : "Caption to post with videos..."}
                            className="min-h-[80px] resize-none"
                            maxLength={2200}
                          />
                          <p className="text-xs text-muted-foreground text-right">
                            {publishCaption.length}/2200
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm flex items-center gap-2">
                            <Hash className="w-4 h-4" />
                            {isKorean ? "해시태그" : "Hashtags"}
                          </Label>
                          <Input
                            value={publishHashtags}
                            onChange={(e) => setPublishHashtags(e.target.value)}
                            placeholder={isKorean ? "#countrymusic #nashville #music" : "#countrymusic #nashville #music"}
                          />
                          <p className="text-xs text-muted-foreground">
                            {isKorean
                              ? "쉼표 또는 공백으로 구분 (TikTok 권장: 3-5개)"
                              : "Separate with commas or spaces (TikTok recommended: 3-5)"}
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Estimation Summary */}
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isKorean ? "예상 생성 수" : "Estimated Variations"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {!hasSelections
                    ? isKorean
                      ? "옵션을 선택해주세요"
                      : "Please select options"
                    : [
                        selectedEffects.length > 0 ? `${isKorean ? "효과" : "Effects"}(${selectedEffects.length})` : null,
                        selectedColorGrades.length > 0 ? `${isKorean ? "컬러" : "Color"}(${selectedColorGrades.length})` : null,
                        selectedTextStyles.length > 0 ? `${isKorean ? "텍스트" : "Text"}(${selectedTextStyles.length})` : null,
                        selectedVibes.length > 0 ? `${isKorean ? "분위기" : "Vibe"}(${selectedVibes.length})` : null,
                      ].filter(Boolean).join(" × ")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-purple-500">{estimatedVariations}</p>
                <p className="text-xs text-muted-foreground">
                  {isKorean ? "영상" : "videos"}
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
          {estimatedVariations > 10 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-600">
                {isKorean
                  ? `${estimatedVariations}개의 영상이 생성됩니다. 렌더링 시간이 오래 걸릴 수 있습니다.`
                  : `${estimatedVariations} videos will be rendered. This may take some time.`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !hasSelections}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {isCreating ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                {isKorean ? "생성 중..." : "Creating..."}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                {isKorean
                  ? `${estimatedVariations}개 컴포즈 영상 변형 생성`
                  : `Generate ${estimatedVariations} Compose Video Variations`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
