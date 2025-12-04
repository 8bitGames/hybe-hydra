"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { assetsApi, type Campaign, type Asset } from "@/lib/campaigns-api";
import { useCampaign, useAssets, useVideos } from "@/lib/queries";
import { loadBridgePrompt, clearBridgePrompt } from "@/lib/bridge-storage";
import {
  videoApi,
  promptApi,
  presetsApi,
  batchApi,
  scoringApi,
  variationsApi,
  previewImageApi,
  VideoGeneration,
  VideoGenerationStats,
  VideoGenerationStatus,
  PromptTransformResponse,
  StylePreset,
  ScoringResult,
  VariationConfigRequest,
  PreviewImageResponse,
} from "@/lib/video-api";
import {
  trendsApi,
  TrendSuggestion,
  TrendPlatform,
  formatViewCount,
  getPlatformIcon,
  getPlatformColor,
} from "@/lib/trends-api";
import {
  merchandiseApi,
  merchandiseGenerateApi,
  MerchandiseReference,
  MerchandiseItem,
  MerchandiseContext,
  getMerchandiseTypeIcon,
  getContextIcon,
  MERCHANDISE_CONTEXTS,
  MERCHANDISE_TYPES,
  MerchandiseType,
} from "@/lib/merchandise-api";
import { Input } from "@/components/ui/input";
import { Image as ImageIcon, Search, Check, Music, Volume2, Lightbulb } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  ImageReferenceSection,
  ImageReferenceData,
} from "@/components/features/image-reference";
import { VariationModal, VariationConfig } from "@/components/features/variation-modal";
import { validateImageDescription } from "@/lib/image-prompt-combiner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Play, Zap, Star, Trash2, X, TrendingUp, ChevronDown, ChevronUp, Sparkles, Package, Layers } from "lucide-react";

const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16 (Vertical)", icon: "portrait" },
  { value: "16:9", label: "16:9 (Horizontal)", icon: "landscape" },
  { value: "1:1", label: "1:1 (Square)", icon: "square" },
];

// Category labels for style presets
const CATEGORY_LABELS: Record<string, string> = {
  contrast: "Contrast",
  mood: "Mood",
  motion: "Motion",
  cinematic: "Cinematic",
  aesthetic: "Aesthetic",
  country: "Country",
  effect: "Effects",
  lighting: "Lighting",
};

// Audio Selection Section Component - Required for video generation
interface AudioAsset {
  id: string;
  filename: string;
  original_filename: string;
  s3_url: string;
}

function AudioSelectionSection({
  audioTracks,
  selectedAudioId,
  onSelect,
  campaignId,
  onAudioUploaded,
}: {
  audioTracks: Asset[];
  selectedAudioId: string;
  onSelect: (id: string) => void;
  campaignId: string;
  onAudioUploaded: (newAudio: Asset) => void;
}) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(audioTracks.length === 0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("audio/")) {
      setUploadError(t.common.fileTypeError);
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError(t.common.fileSizeLimit);
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "audio");

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/v1/campaigns/${campaignId}/assets`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || t.common.uploadFailed);
      }

      const newAsset = await response.json();
      setUploadProgress(100);

      // Notify parent and auto-select the new audio
      onAudioUploaded(newAsset);
      setShowUpload(false);

      // Reset input
      e.target.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.common.uploadFailed);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const selectedAudio = audioTracks.find((a) => a.id === selectedAudioId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          {t.generation.audioSelection} <span className="text-destructive">*</span>
        </Label>
        {audioTracks.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? t.generation.showList : t.generation.uploadNewAudio}
          </Button>
        )}
      </div>

      {/* Selected Audio Display */}
      {selectedAudio && !showUpload && (
        <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {selectedAudio.original_filename}
            </p>
            <p className="text-xs text-muted-foreground">{t.common.selected}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onSelect("")}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Audio Upload Section */}
      {showUpload && (
        <div className="p-4 border-2 border-dashed border-border rounded-lg">
          {uploadError && (
            <div className="mb-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive text-sm">
              {uploadError}
            </div>
          )}

          <div className="text-center">
            <Music className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-foreground mb-1">{t.generation.uploadAudioGuide}</p>
            <p className="text-xs text-muted-foreground mb-3">{t.generation.audioFormats}</p>

            <label className="relative cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
              <Button type="button" variant="outline" disabled={uploading} asChild>
                <span>
                  {uploading ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      {t.common.uploading} {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4 mr-2" />
                      {t.common.selectFile}
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>

          {uploading && (
            <div className="mt-3">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio Track List */}
      {!showUpload && audioTracks.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto p-1">
          {audioTracks.map((audio) => (
            <button
              type="button"
              key={audio.id}
              onClick={() => onSelect(audio.id)}
              className={`w-full p-3 rounded-lg border-2 flex items-center gap-3 transition-all ${
                selectedAudioId === audio.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground hover:bg-muted/50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedAudioId === audio.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {selectedAudioId === audio.id ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Music className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-foreground truncate">
                  {audio.original_filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(audio.created_at || "").toLocaleDateString()}
                </p>
              </div>
              {/* Audio Preview Button */}
              <a
                href={audio.s3_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 hover:bg-muted rounded-full transition-colors"
                title={t.common.preview}
              >
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              </a>
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!showUpload && audioTracks.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Music className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t.generation.noAudioUploaded}</p>
          <p className="text-xs">{t.generation.uploadAudioGuide}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t.generation.audioSyncInfo}
      </p>
    </div>
  );
}

// Reference Source Section Component - combines images and merchandise
interface SelectedMerchandise extends MerchandiseItem {
  context: MerchandiseContext;
  guidance_scale: number;
}

function ReferenceSourceSection({
  images,
  referenceImageId,
  setReferenceImageId,
  merchandiseRefs,
  setMerchandiseRefs,
  campaignId,
  artistId,
}: {
  images: Asset[];
  referenceImageId: string;
  setReferenceImageId: (id: string) => void;
  merchandiseRefs: MerchandiseReference[];
  setMerchandiseRefs: (refs: MerchandiseReference[]) => void;
  campaignId: string;
  artistId?: string;
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"images" | "merchandise">("images");
  const [merchandise, setMerchandise] = useState<MerchandiseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<MerchandiseType | "all">("all");
  const [selectedMerchandise, setSelectedMerchandise] = useState<Map<string, SelectedMerchandise>>(new Map());
  const [editingContextId, setEditingContextId] = useState<string | null>(null);
  const maxMerchandise = 3;

  // Load merchandise
  useEffect(() => {
    const loadMerchandise = async () => {
      setLoading(true);
      try {
        const result = await merchandiseApi.getAll({
          page_size: 50,
          active_only: true,
          artist_id: artistId,
        });
        if (result.data) {
          setMerchandise(result.data.items);
        }
      } catch (err) {
        console.error("Failed to load merchandise:", err);
      } finally {
        setLoading(false);
      }
    };
    loadMerchandise();
  }, [artistId]);

  // Sync selected merchandise with parent
  useEffect(() => {
    const newMap = new Map<string, SelectedMerchandise>();
    merchandiseRefs.forEach((ref) => {
      const item = merchandise.find((m) => m.id === ref.merchandise_id);
      if (item) {
        newMap.set(ref.merchandise_id, {
          ...item,
          context: ref.context,
          guidance_scale: ref.guidance_scale || 0.7,
        });
      }
    });
    setSelectedMerchandise(newMap);
  }, [merchandiseRefs, merchandise]);

  // Handle merchandise selection
  const handleSelectMerchandise = (item: MerchandiseItem) => {
    const newSelected = new Map(selectedMerchandise);

    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      if (newSelected.size >= maxMerchandise) return;

      // Default context based on type
      let defaultContext: MerchandiseContext = "holding";
      if (item.type === "apparel") defaultContext = "wearing";

      newSelected.set(item.id, {
        ...item,
        context: defaultContext,
        guidance_scale: 0.7,
      });
    }

    setSelectedMerchandise(newSelected);
    updateMerchandiseRefs(newSelected);
  };

  // Handle context change
  const handleContextChange = (itemId: string, context: MerchandiseContext) => {
    const newSelected = new Map(selectedMerchandise);
    const item = newSelected.get(itemId);
    if (item) {
      newSelected.set(itemId, { ...item, context });
      setSelectedMerchandise(newSelected);
      updateMerchandiseRefs(newSelected);
    }
    setEditingContextId(null);
  };

  // Handle guidance scale change
  const handleGuidanceChange = (itemId: string, guidance_scale: number) => {
    const newSelected = new Map(selectedMerchandise);
    const item = newSelected.get(itemId);
    if (item) {
      newSelected.set(itemId, { ...item, guidance_scale });
      setSelectedMerchandise(newSelected);
      updateMerchandiseRefs(newSelected);
    }
  };

  // Update parent component
  const updateMerchandiseRefs = (selected: Map<string, SelectedMerchandise>) => {
    const refs: MerchandiseReference[] = Array.from(selected.values()).map((item) => ({
      merchandise_id: item.id,
      context: item.context,
      guidance_scale: item.guidance_scale,
    }));
    setMerchandiseRefs(refs);
  };

  // Filter merchandise
  const filteredMerchandise = merchandise.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.name_ko?.toLowerCase().includes(query) ||
        item.artist?.name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const selectedArray = Array.from(selectedMerchandise.values());

  return (
    <div className="space-y-3">
      <Label className="block">{t.generation.referenceSource}</Label>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={activeTab === "images" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("images")}
          className="flex-1"
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          {t.common.image} ({images.length})
        </Button>
        <Button
          type="button"
          variant={activeTab === "merchandise" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("merchandise")}
          className="flex-1"
        >
          <Package className="w-4 h-4 mr-2" />
          {t.generation.goods} {selectedArray.length > 0 && `(${selectedArray.length})`}
        </Button>
      </div>

      {/* Images Tab */}
      {activeTab === "images" && (
        <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
          <button
            type="button"
            onClick={() => setReferenceImageId("")}
            className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-colors ${
              !referenceImageId
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground"
            }`}
          >
            <span className="text-muted-foreground text-xs">{t.common.none}</span>
          </button>
          {images.map((image) => (
            <button
              type="button"
              key={image.id}
              onClick={() => setReferenceImageId(image.id)}
              className={`aspect-square rounded-lg border-2 overflow-hidden transition-colors ${
                referenceImageId === image.id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <img
                src={image.s3_url}
                alt={image.original_filename}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          {images.length === 0 && (
            <div className="col-span-3 text-center py-4 text-muted-foreground text-sm">
              {t.common.noData}
            </div>
          )}
        </div>
      )}

      {/* Merchandise Tab */}
      {activeTab === "merchandise" && (
        <div className="space-y-3">
          {/* Selected Merchandise */}
          {selectedArray.length > 0 && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
              <p className="text-xs text-muted-foreground font-medium">{t.generation.selectedGoods}:</p>
              {selectedArray.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 bg-background rounded-lg">
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-muted">
                    {item.thumbnail_url || item.s3_url ? (
                      <img src={item.thumbnail_url || item.s3_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">
                        {getMerchandiseTypeIcon(item.type)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name_ko || item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {editingContextId === item.id ? (
                        <select
                          value={item.context}
                          onChange={(e) => handleContextChange(item.id, e.target.value as MerchandiseContext)}
                          onBlur={() => setEditingContextId(null)}
                          autoFocus
                          className="text-xs bg-muted border border-border rounded px-2 py-0.5"
                        >
                          {MERCHANDISE_CONTEXTS.map((ctx) => (
                            <option key={ctx.value} value={ctx.value}>
                              {ctx.labelKo}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingContextId(item.id)}
                          className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded hover:bg-muted/80"
                        >
                          {getContextIcon(item.context)} {MERCHANDISE_CONTEXTS.find((c) => c.value === item.context)?.labelKo}
                        </button>
                      )}
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={item.guidance_scale}
                        onChange={(e) => handleGuidanceChange(item.id, parseFloat(e.target.value))}
                        className="w-12 h-1 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">{(item.guidance_scale * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleSelectMerchandise(item)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.generation.searchGoods}
                className="pl-8 h-9"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as MerchandiseType | "all")}>
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue placeholder={t.common.all} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                {MERCHANDISE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.labelKo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Merchandise Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="w-6 h-6" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
              {filteredMerchandise.map((item) => {
                const isSelected = selectedMerchandise.has(item.id);
                const disabled = !isSelected && selectedMerchandise.size >= maxMerchandise;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => handleSelectMerchandise(item)}
                    disabled={disabled}
                    className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : disabled
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <div className="aspect-square bg-muted">
                      {item.thumbnail_url || item.s3_url ? (
                        <img src={item.thumbnail_url || item.s3_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {getMerchandiseTypeIcon(item.type)}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-background/80 backdrop-blur-sm">
                        <p className="text-xs truncate text-foreground">{item.name_ko || item.name}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredMerchandise.length === 0 && (
                <div className="col-span-4 text-center py-8 text-muted-foreground text-sm">
                  {t.generation.goodsNotFound}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t.generation.maxGoodsMessage}
          </p>
        </div>
      )}
    </div>
  );
}

export default function VideoGeneratePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useI18n();
  const campaignId = params.id as string;

  // Page translations
  const pt = {
    newGeneration: language === "ko" ? "새 영상 생성" : "New Generation",
    promptLabel: language === "ko" ? "프롬프트" : "Prompt",
    promptPlaceholder: language === "ko" ? "생성할 영상을 설명해주세요..." : "Describe the video you want to generate...",
    promptTip: language === "ko" ? "팁: 한국어나 영어로 작성하세요. AI가 최적화합니다." : "Tip: Write in Korean or English. The AI will optimize it.",
    optimizing: language === "ko" ? "최적화 중..." : "Optimizing...",
    optimizeWithAi: language === "ko" ? "AI로 최적화" : "Optimize with AI",
    negativePromptLabel: language === "ko" ? "네거티브 프롬프트" : "Negative Prompt",
    negativePromptPlaceholder: language === "ko" ? "영상에서 피할 것..." : "What to avoid in the video...",
    aspectRatioLabel: language === "ko" ? "화면비" : "Aspect Ratio",
    durationAuto: language === "ko" ? "재생 시간은 자동 계산됩니다 (분위기에 따라 10-30초)" : "Duration is auto-calculated (10-30s based on vibe)",
    stylePresets: language === "ko" ? "스타일 프리셋" : "Style Presets",
    selected: language === "ko" ? "선택됨" : "selected",
    clearAll: language === "ko" ? "모두 해제" : "Clear all",
    selectMultipleStyles: language === "ko" ? "여러 스타일을 선택하여 일괄 생성" : "Select multiple styles to generate variations in batch",
    generateVideo: language === "ko" ? "영상 생성" : "Generate Video",
    generateSingle: language === "ko" ? "단일 생성 (스타일 없음)" : "Generate Single (No Style)",
    generateVariations: language === "ko" ? "변형 생성" : "Generate Variations",
    generatingBatch: language === "ko" ? "일괄 생성 시작 중..." : "Starting Batch Generation...",
    generatingWithMerch: language === "ko" ? "굿즈와 함께 생성 중..." : "Generating with Merchandise...",
    generateWithMerch: language === "ko" ? "굿즈와 함께 생성" : "Generate with Merchandise",
    styles: language === "ko" ? "스타일" : "Styles",
    generationHistory: language === "ko" ? "생성 기록" : "Generation History",
    scoring: language === "ko" ? "점수 계산 중..." : "Scoring...",
    scoreAll: language === "ko" ? "전체 점수 계산" : "Score All",
    noGenerationsYet: language === "ko" ? "아직 생성된 영상이 없습니다" : "No generations yet",
    startGenerating: language === "ko" ? "왼쪽 폼에서 영상 생성을 시작하세요" : "Start generating videos with the form on the left",
    promptOptimized: language === "ko" ? "프롬프트 최적화 완료" : "Prompt Optimized",
    intent: language === "ko" ? "의도" : "Intent",
    viewOptimizedPrompt: language === "ko" ? "최적화된 프롬프트 보기" : "View optimized prompt",
    overallScore: language === "ko" ? "전체 점수" : "Overall Score",
    recommendations: language === "ko" ? "추천사항" : "Recommendations",
    watchVideo: language === "ko" ? "영상 보기" : "Watch Video",
    watchVideoNoAudio: language === "ko" ? "영상 보기 (음원 없음)" : "Watch Video (No Audio)",
    createVariations: language === "ko" ? "변형 생성" : "Create Variations",
    deleteConfirm: language === "ko" ? "이 생성을 삭제하시겠습니까?" : "Delete this generation?",
    score: language === "ko" ? "점수" : "Score",
    generatePreviewImage: language === "ko" ? "이미지 미리 생성" : "Generate Preview Image",
    generatingImage: language === "ko" ? "이미지 생성 중..." : "Generating image...",
    imageGenerated: language === "ko" ? "이미지 생성 완료" : "Image generated",
    regenerate: language === "ko" ? "다시 생성" : "Regenerate",
    viewAiPrompt: language === "ko" ? "AI가 생성한 이미지 프롬프트 보기" : "View AI-generated image prompt",
    useThisImageForVideo: language === "ko" ? "이 이미지로 영상 생성" : "Generate video with this image",
    likeThisImage: language === "ko" ? "이 이미지가 마음에 드시면 아래 버튼으로 영상을 생성하세요." : "If you like this image, click the button below to generate the video.",
  };

  // Use TanStack Query for data fetching with caching
  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useCampaign(campaignId);
  const { data: imageAssetsData, isLoading: imageLoading } = useAssets(campaignId, { type: "image", page_size: 50 });
  const { data: audioAssetsData, isLoading: audioLoading } = useAssets(campaignId, { type: "audio", page_size: 50 });
  const { data: videosData, isLoading: videosLoading } = useVideos(campaignId, { page_size: 100, generation_type: "AI" });

  const images = imageAssetsData?.items || [];
  // Local state for audio tracks (allows adding new uploads)
  const [audioTracks, setAudioTracks] = useState<Asset[]>([]);
  // Local state for generations (allows optimistic updates)
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);

  // Sync query data to local state
  React.useEffect(() => {
    if (audioAssetsData?.items) {
      setAudioTracks(audioAssetsData.items);
    }
  }, [audioAssetsData?.items]);

  React.useEffect(() => {
    if (videosData?.items) {
      // Strictly filter - only show AI videos, exclude any COMPOSE or Compose variation
      const aiOnly = videosData.items.filter(v => {
        // Exclude if generation_type contains "COMPOSE" (case insensitive)
        if (v.generation_type && v.generation_type.toUpperCase().includes("COMPOSE")) {
          return false;
        }
        // Exclude if prompt contains "Compose variation"
        if (v.prompt && v.prompt.toLowerCase().includes("compose variation")) {
          return false;
        }
        // Only include if explicitly AI or no type (legacy)
        return v.generation_type === "AI" || !v.generation_type;
      });
      setGenerations(aiOnly);
    }
  }, [videosData?.items]);

  const [stats, setStats] = useState<VideoGenerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [transformedPrompt, setTransformedPrompt] = useState<PromptTransformResponse | null>(null);
  const [error, setError] = useState("");

  // Style presets state
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [batchGenerating, setBatchGenerating] = useState(false);

  // Scoring state
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [scoringAll, setScoringAll] = useState(false);
  const [scoreDetails, setScoreDetails] = useState<Record<string, ScoringResult>>({});
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);

  // Trends state
  const [trendSuggestions, setTrendSuggestions] = useState<TrendSuggestion[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<TrendPlatform | "ALL">("ALL");
  const [trendsExpanded, setTrendsExpanded] = useState(true);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [referenceImageId, setReferenceImageId] = useState<string>("");
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");  // Required audio track

  // Image Reference for I2V generation (optional)
  const [imageReference, setImageReference] = useState<ImageReferenceData | null>(null);

  // Merchandise state
  const [merchandiseRefs, setMerchandiseRefs] = useState<MerchandiseReference[]>([]);
  const [merchandiseGenerating, setMerchandiseGenerating] = useState(false);

  // Bridge prompt loaded state
  const [bridgePromptLoaded, setBridgePromptLoaded] = useState(false);
  const [bridgeContext, setBridgeContext] = useState<{
    originalInput: string;
    trendKeywords: string[];
    promptAnalysis: { intent: string; trend_applied: string[]; suggestions?: string[] } | null;
  } | null>(null);

  // Variation modal state
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [selectedSeedGeneration, setSelectedSeedGeneration] = useState<VideoGeneration | null>(null);
  const [creatingVariations, setCreatingVariations] = useState(false);

  // Preview image state (for I2V two-step workflow)
  const [previewImage, setPreviewImage] = useState<PreviewImageResponse | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  // Load prompt from URL query params (from Quick Create redirect or Personalization modal)
  useEffect(() => {
    const urlPrompt = searchParams.get("prompt");
    const urlStyle = searchParams.get("style");
    const urlAspectRatio = searchParams.get("aspect_ratio");
    const isPersonalized = searchParams.get("personalized") === "true";

    if (urlPrompt) {
      setPrompt(decodeURIComponent(urlPrompt));
    }

    // Handle personalized prompt from Create page workflow
    if (isPersonalized) {
      console.log("[Generate] Loading personalized prompt from workflow");

      // Set aspect ratio if provided
      if (urlAspectRatio) {
        setAspectRatio(urlAspectRatio);
      }

      // Create transformed prompt info for display
      if (urlPrompt) {
        setTransformedPrompt({
          status: "success",
          veo_prompt: decodeURIComponent(urlPrompt),
          negative_prompt: "",
          technical_settings: {
            aspect_ratio: urlAspectRatio || "9:16",
            fps: 30,
            duration_seconds: 15,
            guidance_scale: 7,
          },
          analysis: {
            intent: urlStyle ? `${urlStyle} style video` : "Personalized video from workflow",
            trend_applied: [],
            safety_check: {
              passed: true,
              concerns: [],
            },
            suggestions: [],
          },
          celebrity_warning: undefined,
          detected_celebrities: [],
        });
      }
    }

    // Style is informational - log for debugging
    if (urlStyle) {
      console.log("Style from URL:", urlStyle);
    }
  }, [searchParams]);

  // Load TikTok analysis prompt from session storage (from Create page TikTok analysis)
  useEffect(() => {
    try {
      const tiktokPrompt = sessionStorage.getItem("tiktok_analysis_prompt");
      const tiktokData = sessionStorage.getItem("tiktok_analysis_data");

      if (tiktokPrompt) {
        setPrompt(tiktokPrompt);
        console.log("[Generate] Loaded TikTok analysis prompt from session storage");

        // Parse analysis data for additional context
        if (tiktokData) {
          const analysisData = JSON.parse(tiktokData);
          console.log("[Generate] TikTok analysis data:", analysisData);

          // Set transformed prompt info if we have style analysis
          if (analysisData.style_analysis) {
            setTransformedPrompt({
              status: "success",
              veo_prompt: tiktokPrompt,
              negative_prompt: "",
              technical_settings: {
                aspect_ratio: "9:16", // TikTok default vertical
                fps: 30,
                duration_seconds: 15,
                guidance_scale: 7,
              },
              analysis: {
                intent: analysisData.style_analysis.overall_mood || "TikTok 스타일 영상",
                trend_applied: analysisData.prompt_elements?.hashtags || [],
                safety_check: {
                  passed: true,
                  concerns: [],
                },
                suggestions: [],
              },
              celebrity_warning: undefined,
              detected_celebrities: [],
            });
          }
        }

        // Clear session storage after reading to prevent stale data
        sessionStorage.removeItem("tiktok_analysis_prompt");
        sessionStorage.removeItem("tiktok_analysis_data");
      }
    } catch (err) {
      console.error("[Generate] Error loading TikTok analysis from session storage:", err);
    }
  }, []);

  // Load prompt from Bridge on mount
  useEffect(() => {
    const bridgeData = loadBridgePrompt(campaignId);
    if (bridgeData && bridgeData.transformedPrompt.status === "success") {
      // Pre-fill form with Bridge data
      setPrompt(bridgeData.originalPrompt);
      setTransformedPrompt(bridgeData.transformedPrompt);
      setNegativePrompt(bridgeData.transformedPrompt.negative_prompt);
      setAspectRatio(bridgeData.transformedPrompt.technical_settings.aspect_ratio);
      setBridgePromptLoaded(true);
      // Store Bridge context for API call
      setBridgeContext({
        originalInput: bridgeData.originalPrompt,
        trendKeywords: bridgeData.selectedTrends || [],
        promptAnalysis: bridgeData.transformedPrompt.analysis || null,
      });
      // Clear the stored prompt after loading
      clearBridgePrompt();
    }
  }, [campaignId]);

  // Load extra data that isn't covered by query hooks (stats, presets, trends)
  const loadExtraData = useCallback(async () => {
    try {
      const [statsResult, presetsResult] = await Promise.all([
        videoApi.getStats(campaignId),
        presetsApi.getAll({ active_only: true }),
      ]);

      if (statsResult.data) setStats(statsResult.data);
      if (presetsResult.data) setPresets(presetsResult.data.presets);
    } catch (err) {
      console.error("Failed to load extra data:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Load trend suggestions when campaign data is available
  React.useEffect(() => {
    if (campaign?.artist_id) {
      trendsApi.getSuggestions({
        artist_id: campaign.artist_id,
        limit: 15,
      }).then((result) => {
        if (result.data) {
          setTrendSuggestions(result.data.suggestions);
        }
      });
    }
  }, [campaign?.artist_id]);

  // Load extra data on mount
  React.useEffect(() => {
    loadExtraData();
  }, [loadExtraData]);

  // Redirect if campaign not found
  if (campaignError) {
    router.push("/campaigns");
  }

  // Poll for generation updates
  useEffect(() => {
    const activeGenerations = generations.filter(
      (g) => g.status === "pending" || g.status === "processing"
    );

    if (activeGenerations.length === 0) return;

    const interval = setInterval(async () => {
      const results = await Promise.all(
        activeGenerations.map((g) => videoApi.getById(g.id))
      );

      setGenerations((prev) =>
        prev.map((gen) => {
          const updated = results.find((r) => r.data?.id === gen.id);
          return updated?.data || gen;
        })
      );

      // Reload stats
      const statsResult = await videoApi.getStats(campaignId);
      if (statsResult.data) setStats(statsResult.data);
    }, 2000);

    return () => clearInterval(interval);
  }, [generations, campaignId]);

  // Transform prompt using Prompt Alchemist
  const handleTransformPrompt = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt to optimize");
      return;
    }

    setError("");
    setTransforming(true);

    try {
      const result = await promptApi.transform({
        user_input: prompt.trim(),
        campaign_id: campaignId,
        safety_level: "high",
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        setTransformedPrompt(result.data);

        if (result.data.status === "blocked") {
          setError(result.data.blocked_reason || "Prompt blocked due to safety concerns");
        } else {
          // Auto-fill the form with optimized values
          setNegativePrompt(result.data.negative_prompt);
          setAspectRatio(result.data.technical_settings.aspect_ratio);
        }
      }
    } catch (err) {
      setError("Failed to optimize prompt");
    } finally {
      setTransforming(false);
    }
  };

  // Use transformed prompt or original prompt
  const getPromptToUse = () => {
    if (transformedPrompt?.status === "success" && transformedPrompt.veo_prompt) {
      return transformedPrompt.veo_prompt;
    }
    return prompt.trim();
  };

  // Generate preview image for I2V workflow
  const handleGeneratePreview = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (!imageReference?.description) {
      setError(t.generation.imageUsageRequired);
      return;
    }

    setError("");
    setGeneratingPreview(true);
    setPreviewImage(null);

    try {
      const promptToUse = getPromptToUse();

      const result = await previewImageApi.generate(campaignId, {
        video_prompt: promptToUse,
        image_description: imageReference.description,
        aspect_ratio: aspectRatio,
        negative_prompt: negativePrompt.trim() || undefined,
        product_image_url: imageReference.assetUrl,  // Pass the actual product image for reference
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        setPreviewImage(result.data);
      }
    } catch (err) {
      setError("Failed to generate preview image");
    } finally {
      setGeneratingPreview(false);
    }
  };

  // Clear preview and regenerate
  const handleClearPreview = () => {
    setPreviewImage(null);
  };

  // Toggle preset selection
  const togglePreset = (presetId: string) => {
    setSelectedPresetIds((prev) =>
      prev.includes(presetId)
        ? prev.filter((id) => id !== presetId)
        : [...prev, presetId]
    );
  };

  // Group presets by category
  const presetsByCategory = presets.reduce((acc, preset) => {
    const category = preset.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(preset);
    return acc;
  }, {} as Record<string, StylePreset[]>);

  // Single video generation
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (!selectedAudioId) {
      setError(t.generation.audioRequired);
      return;
    }

    // Validate image description if image is selected (without preview)
    if (imageReference && !previewImage) {
      const validation = validateImageDescription(imageReference.description);
      if (!validation.valid) {
        setError(validation.message || t.generation.imageUsageRequired);
        return;
      }
    }

    setError("");
    setGenerating(true);

    try {
      const promptToUse = getPromptToUse();
      const negativePromptToUse = negativePrompt.trim() || undefined;

      // Determine if we're using I2V mode (AI-generated image first)
      const useI2VMode = imageReference && imageReference.description;
      // Check if we have a preview image to use directly
      const hasPreviewImage = previewImage && previewImage.image_base64;

      const result = await videoApi.create(campaignId, {
        prompt: promptToUse,
        audio_asset_id: selectedAudioId,  // Required audio track
        negative_prompt: negativePromptToUse,
        duration_seconds: 0,  // Auto-calculate based on preset/vibe
        aspect_ratio: aspectRatio,
        // If I2V mode with image description, don't use reference_image_id
        // Backend will generate the image based on the description
        reference_image_id: useI2VMode ? undefined : (referenceImageId || undefined),
        // I2V parameters - enable AI image generation first
        // If we have a preview image, pass it directly to skip regeneration
        enable_i2v: useI2VMode ? true : undefined,
        image_description: useI2VMode ? imageReference.description : undefined,
        // Pass preview image data if available (skip image generation step)
        preview_image_base64: hasPreviewImage ? previewImage.image_base64 : undefined,
        preview_image_url: hasPreviewImage ? previewImage.image_url : undefined,
        // Include Bridge context if available
        original_input: bridgeContext?.originalInput || prompt.trim(),
        trend_keywords: bridgeContext?.trendKeywords || [],
        prompt_analysis: bridgeContext?.promptAnalysis || (transformedPrompt?.analysis ? {
          intent: transformedPrompt.analysis.intent,
          trend_applied: transformedPrompt.analysis.trend_applied,
          suggestions: transformedPrompt.analysis.suggestions,
        } : undefined),
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        setGenerations((prev) => [result.data!, ...prev]);
        // Clear preview image after successful generation
        if (hasPreviewImage) {
          setPreviewImage(null);
        }
        // Reload stats
        const statsResult = await videoApi.getStats(campaignId);
        if (statsResult.data) setStats(statsResult.data);
      }
    } catch (err) {
      setError("Failed to start generation");
    } finally {
      setGenerating(false);
    }
  };

  // Get selected audio track info
  const selectedAudio = audioTracks.find(a => a.id === selectedAudioId);

  // Batch generation with style presets
  const handleBatchGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (!selectedAudioId) {
      setError(t.generation.audioRequired);
      return;
    }

    if (selectedPresetIds.length === 0) {
      setError("Please select at least one style preset");
      return;
    }

    setError("");
    setBatchGenerating(true);

    try {
      const promptToUse = getPromptToUse();

      const result = await batchApi.create(campaignId, {
        base_prompt: promptToUse,
        audio_asset_id: selectedAudioId,  // Required audio track
        negative_prompt: negativePrompt.trim() || undefined,
        style_preset_ids: selectedPresetIds,
        duration_seconds: 0,  // Auto-calculate based on preset/vibe
        aspect_ratio: aspectRatio,
        reference_image_id: referenceImageId || undefined,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        // Add all batch generations to the list
        setGenerations((prev) => [...result.data!.generations, ...prev]);
        // Keep form data for convenience - user can generate more variants
        // Reload stats
        const statsResult = await videoApi.getStats(campaignId);
        if (statsResult.data) setStats(statsResult.data);
      }
    } catch (err) {
      setError("Failed to start batch generation");
    } finally {
      setBatchGenerating(false);
    }
  };

  // Generate with merchandise references
  const handleMerchandiseGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (!selectedAudioId) {
      setError(t.generation.audioRequired);
      return;
    }

    if (merchandiseRefs.length === 0) {
      setError("Please select at least one merchandise item");
      return;
    }

    setError("");
    setMerchandiseGenerating(true);

    try {
      const promptToUse = getPromptToUse();

      const result = await merchandiseGenerateApi.generate(campaignId, {
        base_prompt: promptToUse,
        audio_asset_id: selectedAudioId,  // Required audio track
        negative_prompt: negativePrompt.trim() || undefined,
        merchandise_references: merchandiseRefs,
        style_preset_ids: selectedPresetIds.length > 0 ? selectedPresetIds : undefined,
        duration_seconds: 0,  // Auto-calculate based on preset/vibe
        aspect_ratio: aspectRatio,
        reference_image_id: referenceImageId || undefined,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        // Add all generations to the list
        const newGenerations: VideoGeneration[] = result.data.generations.map((gen) => ({
          id: gen.id,
          campaign_id: gen.campaign_id,
          prompt: gen.prompt,
          negative_prompt: gen.negative_prompt,
          duration_seconds: gen.duration_seconds,
          aspect_ratio: gen.aspect_ratio,
          reference_image_id: null,
          reference_style: gen.style_preset?.name || null,
          // Audio fields
          audio_asset_id: selectedAudioId,
          audio_asset: selectedAudio ? {
            id: selectedAudio.id,
            filename: selectedAudio.filename,
            original_filename: selectedAudio.original_filename,
            s3_url: selectedAudio.s3_url,
          } : null,
          audio_analysis: null,
          audio_start_time: null,
          audio_duration: null,
          composed_output_url: null,
          status: gen.status as VideoGenerationStatus,
          progress: gen.progress,
          error_message: null,
          output_asset_id: null,
          output_url: null,
          quality_score: null,
          // Bridge context fields
          original_input: null,
          trend_keywords: [],
          reference_urls: null,
          prompt_analysis: null,
          is_favorite: false,
          tags: [],
          created_by: gen.created_by,
          created_at: gen.created_at,
          updated_at: gen.created_at,
          // Generation type - this is AI generation page
          generation_type: "AI",
          // Compose-specific fields (not applicable for AI generation)
          script_data: null,
          image_assets: null,
          effect_preset: null,
        }));
        setGenerations((prev) => [...newGenerations, ...prev]);
        // Keep form data for convenience - user can generate more variants
        // Reload stats
        const statsResult = await videoApi.getStats(campaignId);
        if (statsResult.data) setStats(statsResult.data);
      }
    } catch (err) {
      setError("Failed to start merchandise generation");
    } finally {
      setMerchandiseGenerating(false);
    }
  };

  const handleCancel = async (generationId: string) => {
    const result = await videoApi.cancel(generationId);
    if (result.data) {
      setGenerations((prev) =>
        prev.map((g) => (g.id === generationId ? result.data! : g))
      );
    }
  };

  const handleDelete = async (generationId: string) => {
    if (!confirm("Delete this generation?")) return;

    const result = await videoApi.delete(generationId);
    if (!result.error) {
      setGenerations((prev) => prev.filter((g) => g.id !== generationId));
      const statsResult = await videoApi.getStats(campaignId);
      if (statsResult.data) setStats(statsResult.data);
    }
  };

  // Open variation modal for a completed generation
  const handleOpenVariationModal = (gen: VideoGeneration) => {
    setSelectedSeedGeneration(gen);
    setVariationModalOpen(true);
  };

  // Create variations from seed generation
  const handleCreateVariations = async (config: VariationConfig) => {
    if (!selectedSeedGeneration) return;

    setCreatingVariations(true);
    try {
      const result = await variationsApi.create(selectedSeedGeneration.id, {
        style_categories: config.styleCategories,
        enable_prompt_variation: config.enablePromptVariation,
        prompt_variation_types: config.promptVariationTypes,
        max_variations: config.maxVariations,
      });

      if (result.data) {
        // Reload generations to show new variations (AI only)
        const generationsResult = await videoApi.getAll(campaignId, { page_size: 50, generation_type: "AI" });
        if (generationsResult.data) {
          const aiGenerations = generationsResult.data.items.filter(g => g.generation_type === "AI");
          setGenerations(aiGenerations);
        }
        // Reload stats
        const statsResult = await videoApi.getStats(campaignId);
        if (statsResult.data) setStats(statsResult.data);

        // Close modal
        setVariationModalOpen(false);
        setSelectedSeedGeneration(null);
      }
    } catch (err) {
      console.error("Failed to create variations:", err);
      setError("Failed to create variations");
    } finally {
      setCreatingVariations(false);
    }
  };

  const getStatusVariant = (status: VideoGenerationStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pending":
        return "secondary";
      case "processing":
        return "default";
      case "completed":
        return "outline";
      case "failed":
        return "destructive";
      case "cancelled":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "S":
        return "bg-gradient-to-r from-yellow-400 to-amber-500 text-black";
      case "A":
        return "bg-green-500 text-white";
      case "B":
        return "bg-blue-500 text-white";
      case "C":
        return "bg-orange-500 text-white";
      case "D":
        return "bg-red-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 90) return "from-yellow-400 to-amber-500";
    if (score >= 80) return "from-green-400 to-green-500";
    if (score >= 70) return "from-blue-400 to-blue-500";
    if (score >= 60) return "from-orange-400 to-orange-500";
    return "from-red-400 to-red-500";
  };

  // Score a single generation
  const handleScoreGeneration = async (generationId: string) => {
    setScoringId(generationId);
    try {
      const result = await scoringApi.scoreGeneration(generationId);
      if (result.data) {
        setScoreDetails((prev) => ({ ...prev, [generationId]: result.data! }));
        // Update generation list with new score
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === generationId
              ? { ...g, quality_score: result.data!.total_score }
              : g
          )
        );
      }
    } catch (err) {
      console.error("Failed to score generation:", err);
    } finally {
      setScoringId(null);
    }
  };

  // Score all completed generations in campaign
  const handleScoreAll = async () => {
    setScoringAll(true);
    try {
      const result = await scoringApi.scoreAllInCampaign(campaignId, {
        only_unscored: true,
      });
      if (result.data && result.data.scored > 0) {
        // Update generations list with new scores
        const scoreMap = new Map(
          result.data.results.map((r) => [r.generation_id, r.total_score])
        );
        setGenerations((prev) =>
          prev.map((g) =>
            scoreMap.has(g.id)
              ? { ...g, quality_score: scoreMap.get(g.id)! }
              : g
          )
        );
      }
    } catch (err) {
      console.error("Failed to score all:", err);
    } finally {
      setScoringAll(false);
    }
  };

  // Apply trend suggestion to prompt
  const handleApplyTrend = (suggestion: TrendSuggestion) => {
    setPrompt(suggestion.prompt_template);
    setTransformedPrompt(null);
  };

  // Filter trends by platform
  const filteredTrends = selectedPlatform === "ALL"
    ? trendSuggestions
    : trendSuggestions.filter((t) => t.platform === selectedPlatform);

  // Get score details for a generation
  const handleGetScoreDetails = async (generationId: string) => {
    if (scoreDetails[generationId]) {
      setExpandedScoreId(expandedScoreId === generationId ? null : generationId);
      return;
    }
    try {
      const result = await scoringApi.getScore(generationId);
      if (result.data) {
        setScoreDetails((prev) => ({ ...prev, [generationId]: result.data! }));
        setExpandedScoreId(generationId);
      }
    } catch (err) {
      console.error("Failed to get score details:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="space-y-6">
      {/* Trending Topics Section */}
      {trendSuggestions.length > 0 && (
        <Card className="mb-8 border-primary/20">
          <CardHeader className="pb-2">
            <button
              onClick={() => setTrendsExpanded(!trendsExpanded)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">{t.generation.trendingNow}</CardTitle>
                  <p className="text-muted-foreground text-sm">{t.generation.trendingDescription}</p>
                </div>
              </div>
              {trendsExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </CardHeader>

          {trendsExpanded && (
            <CardContent>
              {/* Platform Filter */}
              <div className="flex items-center gap-2 mb-4">
                {(["ALL", "TIKTOK", "YOUTUBE", "INSTAGRAM"] as const).map((platform) => (
                  <Button
                    key={platform}
                    variant={selectedPlatform === platform ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedPlatform(platform)}
                  >
                    {platform === "ALL" ? "All" : (
                      <span className="flex items-center gap-1.5">
                        {getPlatformIcon(platform as TrendPlatform)}
                        {platform.charAt(0) + platform.slice(1).toLowerCase()}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {/* Trends Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTrends.map((trend, idx) => (
                  <button
                    key={`${trend.platform}-${trend.keyword}-${idx}`}
                    onClick={() => handleApplyTrend(trend)}
                    className="group p-3 bg-muted/50 hover:bg-muted border border-border hover:border-primary/50 rounded-xl text-left transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" title={trend.platform}>
                          {getPlatformIcon(trend.platform)}
                        </span>
                        <span className="text-foreground font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">
                          {trend.keyword}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        #{trend.rank}
                      </Badge>
                    </div>

                    {/* Hashtags */}
                    {trend.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {trend.hashtags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-background text-muted-foreground text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {trend.hashtags.length > 3 && (
                          <span className="text-muted-foreground text-xs">+{trend.hashtags.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Relevance Score Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${trend.relevance_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {trend.relevance_score}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {filteredTrends.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No trends found for this platform
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Generation Form */}
        <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{pt.newGeneration}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Bridge Prompt Loaded Indicator */}
            {bridgePromptLoaded && (
              <div className="mb-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="text-primary font-medium text-sm">{t.generation.bridgePromptLoaded}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-1">
                  {t.generation.bridgePromptMessage}
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Prompt */}
              <div>
                <Label className="mb-2 block">
                  {pt.promptLabel} <span className="text-destructive">*</span>
                </Label>
                <textarea
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setTransformedPrompt(null);
                  }}
                  placeholder={pt.promptPlaceholder}
                  rows={4}
                  className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {pt.promptTip}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleTransformPrompt}
                    disabled={transforming || !prompt.trim()}
                  >
                    {transforming ? (
                      <>
                        <Spinner className="w-4 h-4 mr-2" />
                        {pt.optimizing}
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        {pt.optimizeWithAi}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Celebrity Warning */}
              {transformedPrompt?.celebrity_warning && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-yellow-600 mb-1">
                        {t.bridge.celebrityDetected}
                      </p>
                      <p className="text-xs text-yellow-600/80">
                        {transformedPrompt.detected_celebrities?.join(", ")} {t.bridge.celebrityWarningMessage}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Optimized Prompt Preview */}
              {transformedPrompt?.status === "success" && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-green-600" />
                    <span className="text-green-600 font-medium text-sm">{pt.promptOptimized}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {pt.intent}: {transformedPrompt.analysis.intent}
                  </p>
                  {transformedPrompt.analysis.trend_applied.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {transformedPrompt.analysis.trend_applied.map((trend) => (
                        <Badge key={trend} variant="secondary" className="text-xs">
                          {trend}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <details className="cursor-pointer">
                    <summary className="text-xs text-muted-foreground hover:text-foreground">
                      {pt.viewOptimizedPrompt}
                    </summary>
                    <p className="mt-2 text-sm text-foreground bg-muted p-3 rounded-lg break-words">
                      {transformedPrompt.veo_prompt}
                    </p>
                  </details>
                </div>
              )}

              {/* Negative Prompt */}
              <div>
                <Label className="mb-2 block">{pt.negativePromptLabel}</Label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder={pt.negativePromptPlaceholder}
                  rows={2}
                  className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Audio Selection - Required */}
              <AudioSelectionSection
                audioTracks={audioTracks}
                selectedAudioId={selectedAudioId}
                onSelect={setSelectedAudioId}
                campaignId={campaignId}
                onAudioUploaded={(newAudio) => {
                  setAudioTracks((prev) => [newAudio, ...prev]);
                  setSelectedAudioId(newAudio.id);
                }}
              />

              {/* Aspect Ratio */}
              <div>
                <Label className="mb-2 block">{pt.aspectRatioLabel}</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ar) => (
                      <SelectItem key={ar.value} value={ar.value}>
                        {ar.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {pt.durationAuto}
                </p>
              </div>

              {/* Style Presets Multi-Select */}
              {presets.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>
                      {pt.stylePresets} {selectedPresetIds.length > 0 && (
                        <span className="text-primary">({selectedPresetIds.length} {pt.selected})</span>
                      )}
                    </Label>
                    {selectedPresetIds.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPresetIds([])}
                      >
                        {pt.clearAll}
                      </Button>
                    )}
                  </div>
                  <div className="bg-muted/50 border border-border rounded-lg p-3 max-h-64 overflow-y-auto">
                    {Object.entries(presetsByCategory).map(([category, categoryPresets]) => (
                      <div key={category} className="mb-3 last:mb-0">
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                          {CATEGORY_LABELS[category] || category}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {categoryPresets.map((preset) => (
                            <Button
                              key={preset.id}
                              type="button"
                              variant={selectedPresetIds.includes(preset.id) ? "default" : "outline"}
                              size="sm"
                              onClick={() => togglePreset(preset.id)}
                              title={preset.description || preset.name}
                            >
                              {preset.name_ko || preset.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {pt.selectMultipleStyles}
                  </p>
                </div>
              )}

              {/* Image Reference for I2V (NEW - optional) */}
              <div className="p-4 bg-muted/50 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{t.generation.imageGuideGeneration}</span>
                  <Badge variant="secondary" className="text-xs">NEW</Badge>
                </div>
                <ImageReferenceSection
                  images={images}
                  imageReference={imageReference}
                  onImageReferenceChange={(ref) => {
                    setImageReference(ref);
                    setPreviewImage(null); // Clear preview when image reference changes
                  }}
                  campaignId={campaignId}
                />

                {/* Preview Image Section - Two-step workflow */}
                {imageReference && imageReference.description && (
                  <div className="mt-4 pt-4 border-t border-border">
                    {!previewImage ? (
                      // Step 1: Generate Preview Button
                      <Button
                        type="button"
                        onClick={handleGeneratePreview}
                        disabled={generatingPreview || !prompt.trim()}
                        variant="outline"
                        className="w-full"
                      >
                        {generatingPreview ? (
                          <>
                            <Spinner className="w-4 h-4 mr-2" />
                            이미지 생성 중...
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-4 h-4 mr-2" />
                            이미지 미리 생성
                          </>
                        )}
                      </Button>
                    ) : (
                      // Step 2: Show Preview and Actions
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-green-600 flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            이미지 생성 완료
                          </span>
                          <Button
                            type="button"
                            onClick={handleClearPreview}
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4 mr-1" />
                            다시 생성
                          </Button>
                        </div>

                        {/* Preview Image Display */}
                        <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
                          <img
                            src={previewImage.image_url}
                            alt="Generated preview"
                            className="w-full h-auto max-h-64 object-contain"
                          />
                        </div>

                        {/* Gemini Prompt Preview */}
                        <details className="text-xs">
                          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                            AI가 생성한 이미지 프롬프트 보기
                          </summary>
                          <p className="mt-2 p-2 bg-muted rounded text-muted-foreground break-words">
                            {previewImage.gemini_image_prompt}
                          </p>
                        </details>

                        <p className="text-xs text-muted-foreground">
                          이 이미지가 마음에 드시면 아래 버튼으로 영상을 생성하세요.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reference Source (Images + Merchandise) - Legacy */}
              {!imageReference && (
                <ReferenceSourceSection
                  images={images}
                  referenceImageId={referenceImageId}
                  setReferenceImageId={setReferenceImageId}
                  merchandiseRefs={merchandiseRefs}
                  setMerchandiseRefs={setMerchandiseRefs}
                  campaignId={campaignId}
                  artistId={campaign.artist_id}
                />
              )}

              {/* Generate Buttons */}
              <div className="space-y-3">
                {/* Generate with Merchandise (when merchandise selected) */}
                {merchandiseRefs.length > 0 && (
                  <Button
                    onClick={handleMerchandiseGenerate}
                    disabled={merchandiseGenerating || generating || batchGenerating || !prompt.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {merchandiseGenerating ? (
                      <>
                        <Spinner className="w-5 h-5 mr-2" />
                        Generating with Merchandise...
                      </>
                    ) : (
                      <>
                        <Package className="w-5 h-5 mr-2" />
                        Generate with {merchandiseRefs.length} Merchandise
                        {selectedPresetIds.length > 0 && ` + ${selectedPresetIds.length} Styles`}
                      </>
                    )}
                  </Button>
                )}

                {/* Batch Generate (when presets selected, no merchandise) */}
                {selectedPresetIds.length > 0 && merchandiseRefs.length === 0 && (
                  <Button
                    onClick={handleBatchGenerate}
                    disabled={batchGenerating || generating || !prompt.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {batchGenerating ? (
                      <>
                        <Spinner className="w-5 h-5 mr-2" />
                        {pt.generatingBatch}
                      </>
                    ) : (
                      <>
                        <Layers className="w-5 h-5 mr-2" />
                        {pt.generateVariations} ({selectedPresetIds.length})
                      </>
                    )}
                  </Button>
                )}

                {/* Single Generate (no merchandise, no presets) */}
                {merchandiseRefs.length === 0 && (
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || batchGenerating || merchandiseGenerating || !prompt.trim()}
                    variant={selectedPresetIds.length > 0 ? "outline" : "default"}
                    className="w-full"
                    size="lg"
                  >
                    {generating ? (
                      <>
                        <Spinner className="w-5 h-5 mr-2" />
                        {imageReference ? t.generation.imageBasedGenerating : t.generation.generating}
                      </>
                    ) : (
                      <>
                        {imageReference ? (
                          previewImage ? (
                            // Has preview image - generate video with it
                            <>
                              <Play className="w-5 h-5 mr-2" />
                              {pt.useThisImageForVideo}
                            </>
                          ) : (
                            // No preview - standard I2V mode
                            <>
                              <ImageIcon className="w-5 h-5 mr-2" />
                              {t.generation.imageGuideGeneration} (I2V)
                            </>
                          )
                        ) : (
                          <>
                            <Play className="w-5 h-5 mr-2" />
                            {selectedPresetIds.length > 0 ? pt.generateSingle : pt.generateVideo}
                          </>
                        )}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Right: Generations List */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{pt.generationHistory}</CardTitle>
                {generations.filter(g => g.status === "completed" && !g.quality_score).length > 0 && (
                  <Button
                    onClick={handleScoreAll}
                    disabled={scoringAll}
                    variant="outline"
                    size="sm"
                  >
                    {scoringAll ? (
                      <>
                        <Spinner className="w-3 h-3 mr-1" />
                        {pt.scoring}
                      </>
                    ) : (
                      <>
                        <Star className="w-3 h-3 mr-1" />
                        {pt.scoreAll}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {videosLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Spinner className="w-8 h-8 mx-auto mb-3" />
                  <p className="text-sm">{t.common.loading}...</p>
                </div>
              ) : generations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Play className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{pt.noGenerationsYet}</p>
                  <p className="text-xs mt-1">{pt.startGenerating}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {generations.map((gen) => (
                    <div
                      key={gen.id}
                      className={`p-3 rounded-lg border transition-all ${
                        gen.status === "processing" || gen.status === "pending"
                          ? "border-primary/50 bg-primary/5"
                          : gen.status === "completed"
                          ? "border-border hover:border-primary/30"
                          : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      {/* Status & Progress */}
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={getStatusVariant(gen.status)}>
                          {gen.status === "processing" && (
                            <Spinner className="w-3 h-3 mr-1" />
                          )}
                          {gen.status}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {gen.quality_score && (
                            <button
                              onClick={() => handleGetScoreDetails(gen.id)}
                              className={`px-2 py-0.5 rounded text-xs font-bold ${getGradeColor(
                                gen.quality_score >= 90 ? "S" :
                                gen.quality_score >= 80 ? "A" :
                                gen.quality_score >= 70 ? "B" :
                                gen.quality_score >= 60 ? "C" : "D"
                              )}`}
                            >
                              {gen.quality_score}
                            </button>
                          )}
                          <Button
                            onClick={() => handleDelete(gen.id)}
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress Bar (for processing) */}
                      {(gen.status === "processing" || gen.status === "pending") && (
                        <div className="mb-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-500"
                              style={{ width: `${gen.progress || 5}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {gen.progress || 0}% complete
                          </p>
                        </div>
                      )}

                      {/* Prompt Preview */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {gen.prompt}
                      </p>

                      {/* Style Badge */}
                      {gen.reference_style && (
                        <Badge variant="secondary" className="text-xs mb-2">
                          {gen.reference_style}
                        </Badge>
                      )}

                      {/* Video Thumbnail / Preview */}
                      {gen.status === "completed" && (gen.output_url || gen.composed_output_url) && (
                        <div className="relative rounded-lg overflow-hidden bg-muted mb-2 aspect-video group cursor-pointer">
                          <video
                            src={gen.composed_output_url || gen.output_url || ""}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            onMouseEnter={(e) => {
                              e.currentTarget.play().catch(() => {});
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                            onClick={(e) => {
                              const video = e.currentTarget;
                              if (video.paused) {
                                video.play().catch(() => {});
                              } else {
                                video.pause();
                              }
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-all">
                            <Play className="w-10 h-10 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
                          </div>
                        </div>
                      )}

                      {/* Processing Preview Placeholder */}
                      {(gen.status === "processing" || gen.status === "pending") && (
                        <div className="relative rounded-lg overflow-hidden bg-muted mb-2 aspect-video flex items-center justify-center">
                          <div className="text-center">
                            <Spinner className="w-8 h-8 mx-auto mb-2 text-primary" />
                            <p className="text-xs text-muted-foreground">
                              {gen.status === "pending" ? "Queued..." : "Generating..."}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {gen.status === "failed" && gen.error_message && (
                        <p className="text-xs text-destructive mb-2">
                          {gen.error_message}
                        </p>
                      )}

                      {/* Action Buttons */}
                      {gen.status === "completed" && (
                        <div className="flex gap-2">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs"
                          >
                            <a
                              href={gen.composed_output_url || gen.output_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              {pt.watchVideo}
                            </a>
                          </Button>
                          <Button
                            onClick={() => handleOpenVariationModal(gen)}
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                          >
                            <Layers className="w-3 h-3 mr-1" />
                            {pt.createVariations}
                          </Button>
                        </div>
                      )}

                      {/* Score Details (expanded) */}
                      {expandedScoreId === gen.id && scoreDetails[gen.id] && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-medium text-foreground mb-2">
                            {pt.overallScore}: {scoreDetails[gen.id].total_score} ({scoreDetails[gen.id].grade})
                          </p>
                          <div className="space-y-2">
                            {[
                              { name: "Prompt", score: scoreDetails[gen.id].breakdown.promptQuality.score },
                              { name: "Technical", score: scoreDetails[gen.id].breakdown.technicalSettings.score },
                              { name: "Style", score: scoreDetails[gen.id].breakdown.styleAlignment.score },
                              { name: "Trend", score: scoreDetails[gen.id].breakdown.trendAlignment.score },
                            ].map((dim) => (
                              <div key={dim.name} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-16 truncate">{dim.name}</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full bg-gradient-to-r ${getScoreBarColor(dim.score)}`}
                                    style={{ width: `${dim.score}%` }}
                                  />
                                </div>
                                <span className="text-xs text-foreground w-6 text-right">{dim.score}</span>
                              </div>
                            ))}
                          </div>
                          {scoreDetails[gen.id].recommendations.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-foreground mb-1">{pt.recommendations}</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {scoreDetails[gen.id].recommendations.slice(0, 2).map((rec, i) => (
                                  <li key={i}>• {rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Score button for completed without score */}
                      {gen.status === "completed" && !gen.quality_score && (
                        <Button
                          onClick={() => handleScoreGeneration(gen.id)}
                          disabled={scoringId === gen.id}
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 text-xs"
                        >
                          {scoringId === gen.id ? (
                            <>
                              <Spinner className="w-3 h-3 mr-1" />
                              {pt.scoring}
                            </>
                          ) : (
                            <>
                              <Star className="w-3 h-3 mr-1" />
                              {pt.score}
                            </>
                          )}
                        </Button>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(gen.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Variation Modal */}
      <VariationModal
        isOpen={variationModalOpen}
        onClose={() => {
          setVariationModalOpen(false);
          setSelectedSeedGeneration(null);
        }}
        seedGeneration={selectedSeedGeneration}
        presets={presets}
        onCreateVariations={handleCreateVariations}
        isCreating={creatingVariations}
      />
    </div>
  );
}
