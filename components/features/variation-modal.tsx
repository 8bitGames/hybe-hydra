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
  Sparkles,
  Music,
  Clock,
  Ratio,
  Palette,
  Lightbulb,
  Camera,
  Wand2,
  AlertCircle,
  Check,
  Send,
  Hash,
  Timer,
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
import { VideoGeneration, StylePreset } from "@/lib/video-api";
import { useI18n } from "@/lib/i18n";

// Style categories for variation
export interface StyleCategory {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  presets: StylePreset[];
}

export interface AutoPublishConfig {
  enabled: boolean;
  socialAccountId: string | null;
  intervalMinutes: number;
  caption: string;
  hashtags: string[];
}

export interface VariationConfig {
  styleCategories: string[];
  enablePromptVariation: boolean;
  promptVariationTypes: ("camera" | "expression")[];
  maxVariations: number;
  autoPublish?: AutoPublishConfig;
}

interface VariationModalProps {
  isOpen: boolean;
  onClose: () => void;
  seedGeneration: VideoGeneration | null;
  presets: StylePreset[];
  onCreateVariations: (config: VariationConfig) => Promise<void>;
  isCreating: boolean;
  socialAccounts?: SocialAccount[];
}

// Category configuration
const VARIATION_CATEGORIES = [
  {
    id: "mood",
    name: "Mood",
    nameKo: "분위기",
    description: "Emotional atmosphere variations",
    descriptionKo: "감정적 분위기 변형",
    icon: Palette,
  },
  {
    id: "lighting",
    name: "Lighting",
    nameKo: "조명",
    description: "Light and shadow variations",
    descriptionKo: "빛과 그림자 변형",
    icon: Lightbulb,
  },
  {
    id: "cinematic",
    name: "Cinematic",
    nameKo: "시네마틱",
    description: "Film-style visual effects",
    descriptionKo: "영화 스타일 효과",
    icon: Camera,
  },
  {
    id: "effect",
    name: "Effects",
    nameKo: "이펙트",
    description: "Visual effects and filters",
    descriptionKo: "시각 효과 및 필터",
    icon: Wand2,
  },
];

export function VariationModal({
  isOpen,
  onClose,
  seedGeneration,
  presets,
  onCreateVariations,
  isCreating,
  socialAccounts = [],
}: VariationModalProps) {
  const { t, language } = useI18n();

  // Selected categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["mood", "lighting"]);

  // Prompt variation options
  const [enablePromptVariation, setEnablePromptVariation] = useState(false);
  const [promptVariationTypes, setPromptVariationTypes] = useState<("camera" | "expression")[]>([]);

  // Max variations limit
  const [maxVariations, setMaxVariations] = useState(9);

  // Auto-publish settings
  const [enableAutoPublish, setEnableAutoPublish] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [publishIntervalMinutes, setPublishIntervalMinutes] = useState(30);
  const [publishCaption, setPublishCaption] = useState("");
  const [publishHashtags, setPublishHashtags] = useState("");

  // Filter TikTok accounts with valid tokens
  const tiktokAccounts = useMemo(() => {
    return socialAccounts.filter(
      (account) => account.platform === "TIKTOK" && account.is_token_valid
    );
  }, [socialAccounts]);

  // Group presets by category
  const presetsByCategory = useMemo(() => {
    const grouped: Record<string, StylePreset[]> = {};
    presets.forEach((preset) => {
      if (!grouped[preset.category]) {
        grouped[preset.category] = [];
      }
      grouped[preset.category].push(preset);
    });
    return grouped;
  }, [presets]);

  // Calculate estimated variations
  const estimatedVariations = useMemo(() => {
    let count = 1;
    selectedCategories.forEach((cat) => {
      const categoryPresets = presetsByCategory[cat];
      if (categoryPresets && categoryPresets.length > 0) {
        count *= categoryPresets.length;
      }
    });

    if (enablePromptVariation && promptVariationTypes.length > 0) {
      count *= (promptVariationTypes.length + 1); // +1 for original
    }

    return Math.min(count, maxVariations);
  }, [selectedCategories, presetsByCategory, enablePromptVariation, promptVariationTypes, maxVariations]);

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Toggle prompt variation type
  const togglePromptVariationType = (type: "camera" | "expression") => {
    setPromptVariationTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  // Handle create variations
  const handleCreate = async () => {
    if (!seedGeneration || selectedCategories.length === 0) return;

    const config: VariationConfig = {
      styleCategories: selectedCategories,
      enablePromptVariation,
      promptVariationTypes,
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
      };
    }

    await onCreateVariations(config);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCategories(["mood", "lighting"]);
      setEnablePromptVariation(false);
      setPromptVariationTypes([]);
      setMaxVariations(9);
      // Reset auto-publish settings
      setEnableAutoPublish(false);
      setSelectedAccountId("");
      setPublishIntervalMinutes(30);
      setPublishCaption("");
      setPublishHashtags("");
    }
  }, [isOpen]);

  if (!seedGeneration) return null;

  const isKorean = language === "ko";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {isKorean ? "변형 생성" : "Create Variations"}
          </DialogTitle>
          <DialogDescription>
            {isKorean
              ? "테스트 영상을 기반으로 다양한 스타일의 영상을 자동 생성합니다"
              : "Automatically generate videos with various styles based on your test video"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Seed Generation Info - Fixed Settings */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Check className="w-4 h-4 text-green-500" />
              {isKorean ? "고정 설정 (Seed Generation)" : "Fixed Settings (Seed Generation)"}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">Prompt</Badge>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {seedGeneration.prompt}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {seedGeneration.audio_asset && (
                  <span className="flex items-center gap-1">
                    <Music className="w-3 h-3" />
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

          {/* Style Category Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {isKorean ? "스타일 변형 카테고리" : "Style Variation Categories"}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {VARIATION_CATEGORIES.map((category) => {
                const categoryPresets = presetsByCategory[category.id] || [];
                const isSelected = selectedCategories.includes(category.id);
                const Icon = category.icon;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    disabled={categoryPresets.length === 0}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : categoryPresets.length === 0
                        ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Checkbox
                        checked={isSelected}
                        disabled={categoryPresets.length === 0}
                        className="pointer-events-none"
                      />
                      <Icon className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium">
                        {isKorean ? category.nameKo : category.name}
                      </span>
                      <Badge variant="secondary" className="text-xs ml-auto">
                        ×{categoryPresets.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {isKorean ? category.descriptionKo : category.description}
                    </p>
                    {categoryPresets.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pl-6">
                        {categoryPresets.slice(0, 3).map((preset) => (
                          <span
                            key={preset.id}
                            className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded"
                          >
                            {isKorean && preset.name_ko ? preset.name_ko : preset.name}
                          </span>
                        ))}
                        {categoryPresets.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{categoryPresets.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt Variation Options */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="prompt-variation"
                checked={enablePromptVariation}
                onCheckedChange={(checked: boolean | "indeterminate") => setEnablePromptVariation(checked === true)}
              />
              <Label htmlFor="prompt-variation" className="text-sm font-medium cursor-pointer">
                {isKorean ? "프롬프트 자동 변형 (AI)" : "AI Prompt Variations"}
              </Label>
            </div>

            {enablePromptVariation && (
              <div className="pl-6 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {isKorean
                    ? "핵심 의미는 유지하면서 다양한 표현으로 변형합니다"
                    : "Varies expressions while maintaining core meaning"}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={promptVariationTypes.includes("camera") ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePromptVariationType("camera")}
                  >
                    <Camera className="w-3 h-3 mr-1" />
                    {isKorean ? "카메라 앵글" : "Camera Angles"}
                  </Button>
                  <Button
                    type="button"
                    variant={promptVariationTypes.includes("expression") ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePromptVariationType("expression")}
                  >
                    <Wand2 className="w-3 h-3 mr-1" />
                    {isKorean ? "표현 변형" : "Expressions"}
                  </Button>
                </div>
              </div>
            )}
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
                ? "비용 관리를 위해 최대 생성 수를 제한합니다"
                : "Limit maximum variations for cost management"}
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
                <Send className="w-4 h-4 text-primary" />
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

                    {/* Caption */}
                    <div className="space-y-2">
                      <Label className="text-sm">
                        {isKorean ? "캡션 (선택사항)" : "Caption (optional)"}
                      </Label>
                      <Textarea
                        value={publishCaption}
                        onChange={(e) => setPublishCaption(e.target.value)}
                        placeholder={isKorean ? "영상과 함께 게시될 캡션..." : "Caption to post with videos..."}
                        className="min-h-[60px] resize-none"
                        maxLength={2200}
                      />
                    </div>

                    {/* Hashtags */}
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        {isKorean ? "해시태그" : "Hashtags"}
                      </Label>
                      <Input
                        value={publishHashtags}
                        onChange={(e) => setPublishHashtags(e.target.value)}
                        placeholder={isKorean ? "#kpop #music #viral" : "#kpop #music #viral"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {isKorean
                          ? "쉼표 또는 공백으로 구분하세요"
                          : "Separate with commas or spaces"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Estimation Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isKorean ? "예상 생성 수" : "Estimated Variations"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedCategories.length === 0
                    ? isKorean
                      ? "카테고리를 선택해주세요"
                      : "Please select categories"
                    : selectedCategories.map((cat) => {
                        const category = VARIATION_CATEGORIES.find((c) => c.id === cat);
                        const count = presetsByCategory[cat]?.length || 0;
                        return `${isKorean ? category?.nameKo : category?.name}(${count})`;
                      }).join(" × ")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">{estimatedVariations}</p>
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
                  ? `${estimatedVariations}개의 영상이 생성됩니다. 비용이 많이 발생할 수 있습니다.`
                  : `${estimatedVariations} videos will be generated. This may incur significant costs.`}
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
            disabled={isCreating || selectedCategories.length === 0}
          >
            {isCreating ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                {isKorean ? "생성 중..." : "Creating..."}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {isKorean
                  ? `${estimatedVariations}개 변형 생성`
                  : `Generate ${estimatedVariations} Variations`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
