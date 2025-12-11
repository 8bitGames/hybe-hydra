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
  Bot,
  TrendingUp,
  Lightbulb,
  type LucideIcon,
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
import { cn } from "@/lib/utils";
import {
  STYLE_PRESETS_UI,
  STYLE_ICONS,
  DEFAULT_SELECTED_STYLES,
  MAX_STYLE_VARIATIONS,
} from "@/lib/constants/style-presets";

export interface AutoPublishConfig {
  enabled: boolean;
  socialAccountId: string | null;
  intervalMinutes: number;
  caption: string;
  hashtags: string[];
  generateGeoAeo: boolean;
}

// Updated config to use style presets
export interface ComposeVariationConfig {
  stylePresets: string[];  // Array of style preset IDs
  // Legacy fields for backwards compatibility
  effectPresets?: string[];
  colorGrades?: string[];
  textStyles?: string[];
  vibeVariations?: string[];
  maxVariations?: number;
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

  // Selected style presets
  const [selectedStyles, setSelectedStyles] = useState<string[]>(DEFAULT_SELECTED_STYLES);

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

  // Toggle style selection
  const toggleStyleSelection = (styleId: string) => {
    setSelectedStyles((prev) => {
      if (prev.includes(styleId)) {
        return prev.filter((id) => id !== styleId);
      }
      // Max 7 styles (since original is counted as 1)
      if (prev.length >= MAX_STYLE_VARIATIONS - 1) {
        return prev;
      }
      return [...prev, styleId];
    });
  };

  // Select all styles (max 7)
  const selectAllStyles = () => {
    setSelectedStyles(STYLE_PRESETS_UI.slice(0, MAX_STYLE_VARIATIONS - 1).map((s) => s.id));
  };

  // Clear all selections
  const clearStyleSelection = () => {
    setSelectedStyles([]);
  };

  // Estimated variations = number of selected styles
  const estimatedVariations = selectedStyles.length;

  // Estimated time (2 min per variation)
  const estimatedTime = useMemo(() => {
    if (estimatedVariations === 0) return null;
    const minutesPerVideo = 2;
    const totalMinutes = estimatedVariations * minutesPerVideo;
    return isKorean ? `약 ${totalMinutes}분` : `~${totalMinutes} min`;
  }, [estimatedVariations, isKorean]);

  // Handle create variations
  const handleCreate = async () => {
    if (!seedGeneration || selectedStyles.length === 0) return;

    const config: ComposeVariationConfig = {
      stylePresets: selectedStyles,
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
        generateGeoAeo: enableGeoAeo,
      };
    }

    await onCreateVariations(config);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStyles(DEFAULT_SELECTED_STYLES);
      setEnableAutoPublish(false);
      setSelectedAccountId("");
      setPublishIntervalMinutes(30);
      setPublishCaption("");
      setPublishHashtags("");
      setEnableGeoAeo(true);
    }
  }, [isOpen]);

  if (!seedGeneration) return null;

  const hasSelections = selectedStyles.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            {isKorean ? "패스트 컷 영상 변형 생성" : "Create Fast Cut Video Variations"}
          </DialogTitle>
          <DialogDescription>
            {isKorean
              ? "스타일 프리셋을 선택하여 다양한 버전의 영상을 생성합니다"
              : "Select style presets to create different versions of your video"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Seed Generation Info - Fixed Settings */}
          <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Check className="w-4 h-4 text-muted-foreground" />
              {isKorean ? "고정 설정 (Seed 패스트 컷 영상)" : "Fixed Settings (Seed Fast Cut Video)"}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">
                  {isKorean ? "키워드" : "Keywords"}
                </Badge>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {metadata?.keywords?.join(", ") || seedGeneration.prompt}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {metadata?.imageCount && (
                  <span className="flex items-center gap-1">
                    <Image className="w-3 h-3" />
                    {metadata.imageCount} {isKorean ? "장" : "images"}
                  </span>
                )}
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

          {/* Style Selection Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                {isKorean ? "생성할 스타일 선택" : "Select Styles to Generate"}
                <span className="text-muted-foreground font-normal ml-2">(1-7개)</span>
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllStyles}
                  className="text-xs h-7"
                >
                  {isKorean ? "전체 선택" : "Select All"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearStyleSelection}
                  className="text-xs h-7"
                >
                  {isKorean ? "선택 해제" : "Clear"}
                </Button>
              </div>
            </div>

            {/* Style Grid */}
            <div className="grid grid-cols-2 gap-2">
              {STYLE_PRESETS_UI.map((style) => {
                const Icon: LucideIcon = style.icon;
                const isSelected = selectedStyles.includes(style.id);
                const isDisabled = !isSelected && selectedStyles.length >= MAX_STYLE_VARIATIONS - 1;

                return (
                  <div
                    key={style.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !isDisabled && toggleStyleSelection(style.id)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                        e.preventDefault();
                        toggleStyleSelection(style.id);
                      }
                    }}
                    className={cn(
                      "relative p-3 rounded-lg border-2 text-left transition-all",
                      isSelected
                        ? "border-foreground bg-muted/50"
                        : isDisabled
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "border-border hover:border-muted-foreground/50 cursor-pointer"
                    )}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-2 right-2">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={() => !isDisabled && toggleStyleSelection(style.id)}
                        className="data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                      />
                    </div>

                    {/* Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-md flex items-center justify-center mb-2",
                        isSelected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Text */}
                    <h4 className="font-medium text-foreground text-sm pr-6">
                      {isKorean ? style.nameKo : style.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {isKorean ? style.descriptionKo : style.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Selection Info */}
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  {isKorean ? "선택됨:" : "Selected:"}{" "}
                  <span className="font-medium text-foreground">{selectedStyles.length}개</span>
                </span>
                {estimatedTime && (
                  <span className="text-muted-foreground">
                    {isKorean ? "예상 시간:" : "Est. time:"} {estimatedTime}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lightbulb className="w-3.5 h-3.5" />
                {isKorean
                  ? "3-5개 스타일 추천"
                  : "3-5 styles recommended"}
              </div>
            </div>
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
                <Send className="w-4 h-4 text-muted-foreground" />
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
                    <div className="flex items-start gap-3 p-3 bg-muted/50 border rounded-lg">
                      <Checkbox
                        id="geo-aeo-toggle"
                        checked={enableGeoAeo}
                        onCheckedChange={(checked: boolean | "indeterminate") => setEnableGeoAeo(checked === true)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <Label htmlFor="geo-aeo-toggle" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                          <Bot className="w-4 h-4 text-muted-foreground" />
                          {isKorean ? "AI 캡션 & 태그 자동 생성" : "Auto-generate AI Caption & Tags"}
                          <Badge variant="secondary" className="text-xs">
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
          <div className="bg-muted/50 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isKorean ? "예상 생성 수" : "Estimated Variations"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {!hasSelections
                    ? isKorean
                      ? "스타일을 선택해주세요"
                      : "Please select styles"
                    : isKorean
                    ? `${selectedStyles.length}개 스타일 선택됨`
                    : `${selectedStyles.length} styles selected`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{estimatedVariations}</p>
                <p className="text-xs text-muted-foreground">
                  {isKorean ? "영상" : "videos"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !hasSelections}
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
                  ? `${estimatedVariations}개 패스트 컷 영상 변형 생성`
                  : `Generate ${estimatedVariations} Fast Cut Video Variations`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
