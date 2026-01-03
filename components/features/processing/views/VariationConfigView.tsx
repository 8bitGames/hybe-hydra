"use client";

import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Check,
  Loader2,
  X,
  Zap,
  Film,
  Square,
  Activity,
  Disc,
  Briefcase,
  Cloud,
  Bold,
  Star,
  Lightbulb,
  Image as ImageIcon,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  useProcessingSessionStore,
  selectOriginalVideo,
  selectSession,
  selectSelectedStyles,
  selectIsGeneratingVariations,
  selectVariations,
  selectImageSelectionMode,
  selectSelectedImageUrls,
  STYLE_SETS,
} from "@/lib/stores/processing-session-store";
import { VariationImageSelector, type VariationImageCandidate } from "../VariationImageSelector";

// Icon mapping for style sets
const STYLE_ICONS: Record<string, LucideIcon> = {
  viral_tiktok: Zap,
  cinematic_mood: Film,
  clean_minimal: Square,
  energetic_beat: Activity,
  retro_aesthetic: Disc,
  professional_corp: Briefcase,
  dreamy_soft: Cloud,
  bold_impact: Bold,
};

interface VariationConfigViewProps {
  className?: string;
  onBack: () => void;
  onStartGeneration: () => void;
  onCancel: () => void;
}

export function VariationConfigView({
  className,
  onBack,
  onStartGeneration,
  onCancel,
}: VariationConfigViewProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);
  const selectedStyles = useProcessingSessionStore(selectSelectedStyles);
  const isGenerating = useProcessingSessionStore(selectIsGeneratingVariations);
  const variations = useProcessingSessionStore(selectVariations);
  const imageSelectionMode = useProcessingSessionStore(selectImageSelectionMode);
  const selectedImageUrls = useProcessingSessionStore(selectSelectedImageUrls);

  const toggleStyleSelection = useProcessingSessionStore((state) => state.toggleStyleSelection);
  const selectAllStyles = useProcessingSessionStore((state) => state.selectAllStyles);
  const clearStyleSelection = useProcessingSessionStore((state) => state.clearStyleSelection);
  const setImageSelectionMode = useProcessingSessionStore((state) => state.setImageSelectionMode);
  const setSelectedImageUrls = useProcessingSessionStore((state) => state.setSelectedImageUrls);

  // Image selector state
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [variationImages, setVariationImages] = useState<{
    originalImages: VariationImageCandidate[];
    searchedImages: VariationImageCandidate[];
    keywords: string[];
  }>({ originalImages: [], searchedImages: [], keywords: [] });
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [selectedImages, setSelectedImages] = useState<VariationImageCandidate[]>([]);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Track image load errors for fallback
  const [originalImageError, setOriginalImageError] = useState(false);
  const [variationImageErrors, setVariationImageErrors] = useState<Record<string, boolean>>({});

  // Handle image error
  const handleOriginalImageError = useCallback(() => {
    setOriginalImageError(true);
  }, []);

  const handleVariationImageError = useCallback((variationId: string) => {
    setVariationImageErrors(prev => ({ ...prev, [variationId]: true }));
  }, []);

  // Check if URL is likely a video URL (not suitable for img tag)
  const isVideoUrl = useCallback((url?: string) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }, []);

  // Toggle play
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Calculate estimated time
  const estimatedTime = useMemo(() => {
    const count = selectedStyles.length;
    if (count === 0) return null;
    const minutesPerVideo = 2;
    const totalMinutes = count * minutesPerVideo;
    return isKorean ? `약 ${totalMinutes}분` : `~${totalMinutes} min`;
  }, [selectedStyles.length, isKorean]);

  // Get generation progress stats
  const progressStats = useMemo(() => {
    const total = variations.length;
    const completed = variations.filter((v) => v.status === "completed").length;
    const failed = variations.filter((v) => v.status === "failed").length;
    const inProgress = total - completed - failed;
    return { total, completed, failed, inProgress };
  }, [variations]);

  // Load variation images when entering manual mode
  const loadVariationImages = useCallback(async () => {
    if (!session?.originalVideo?.id) return;

    setIsLoadingImages(true);
    try {
      const response = await fetch(`/api/v1/generations/${session.originalVideo.id}/variation-images`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to load variation images");
        return;
      }

      const data = await response.json();
      setVariationImages({
        originalImages: data.originalImages || [],
        searchedImages: data.searchedImages || [],
        keywords: data.keywords || [],
      });

      // Pre-select original images
      const originalSelected = (data.originalImages || []).map((img: VariationImageCandidate) => ({
        ...img,
        isSelected: true,
      }));
      setSelectedImages(originalSelected);
    } catch (error) {
      console.error("Error loading variation images:", error);
    } finally {
      setIsLoadingImages(false);
    }
  }, [session?.originalVideo?.id]);

  // Search with custom keywords
  const handleSearchKeywords = useCallback(async (keywords: string[], forceRefresh = false) => {
    if (!session?.originalVideo?.id || keywords.length === 0) return;

    setIsSearchingImages(true);
    try {
      const response = await fetch(`/api/v1/generations/${session.originalVideo.id}/variation-images`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keywords, forceRefresh, maxImages: 50 }),
      });

      if (!response.ok) {
        console.error("Failed to search images");
        return;
      }

      const data = await response.json();
      // Merge new search results with existing
      setVariationImages(prev => ({
        ...prev,
        searchedImages: [
          ...prev.searchedImages,
          ...(data.candidates || []).filter(
            (newImg: VariationImageCandidate) =>
              !prev.searchedImages.some(existing => existing.sourceUrl === newImg.sourceUrl)
          ),
        ],
        keywords: [...new Set([...prev.keywords, ...keywords])],
      }));
    } catch (error) {
      console.error("Error searching images:", error);
    } finally {
      setIsSearchingImages(false);
    }
  }, [session?.originalVideo?.id]);

  // Handle image toggle
  const handleToggleSelection = useCallback((image: VariationImageCandidate) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.id === image.id);
      if (isSelected) {
        return prev.filter(img => img.id !== image.id);
      } else {
        return [...prev, { ...image, isSelected: true }];
      }
    });
  }, []);

  // Handle image reorder
  const handleReorderImages = useCallback((newImages: VariationImageCandidate[]) => {
    setSelectedImages(newImages);
  }, []);

  // Confirm image selection
  const handleConfirmSelection = useCallback(() => {
    const urls = selectedImages.map(img => img.sourceUrl);
    setSelectedImageUrls(urls);
    setShowImageSelector(false);
  }, [selectedImages, setSelectedImageUrls]);

  // Open image selector
  const handleOpenImageSelector = useCallback(() => {
    setShowImageSelector(true);
    loadVariationImages();
  }, [loadVariationImages]);

  // Check if can start - for manual mode, also need selected images
  const canStart = useMemo(() => {
    if (isGenerating) return false;
    if (selectedStyles.length === 0) return false;
    if (imageSelectionMode === "manual" && selectedImageUrls.length < 3) return false;
    return true;
  }, [isGenerating, selectedStyles.length, imageSelectionMode, selectedImageUrls.length]);

  if (!session || !originalVideo) {
    return null;
  }

  // Show image selector view (full screen replacement)
  if (showImageSelector) {
    return (
      <div className={cn("flex flex-col h-full min-h-[60vh]", className)}>
        <VariationImageSelector
          generationId={session.originalVideo?.id || ""}
          originalImages={variationImages.originalImages}
          searchedImages={variationImages.searchedImages}
          selectedImages={selectedImages}
          keywords={variationImages.keywords}
          isLoading={isLoadingImages}
          isSearching={isSearchingImages}
          onToggleSelection={handleToggleSelection}
          onReorderImages={handleReorderImages}
          onSearchKeywords={handleSearchKeywords}
          onBack={() => setShowImageSelector(false)}
          onConfirm={handleConfirmSelection}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col min-h-[60vh]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={isGenerating ? onCancel : onBack}
          className="text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {isGenerating
            ? isKorean ? "취소" : "Cancel"
            : isKorean ? "돌아가기" : "Back"}
        </Button>

        <h2 className="text-lg font-semibold text-neutral-900">
          {isGenerating
            ? isKorean ? "베리에이션 생성 중" : "Generating Variations"
            : isKorean ? "베리에이션 설정" : "Variation Settings"}
        </h2>

        <Button
          onClick={onStartGeneration}
          disabled={!canStart}
          className="bg-neutral-900 hover:bg-neutral-800 text-white"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              {isKorean ? "생성 중..." : "Generating..."}
            </>
          ) : (
            <>
              {isKorean ? "시작하기" : "Start"}
            </>
          )}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Original video preview */}
        <div className="lg:col-span-1">
          <Card className="bg-neutral-900 border-neutral-700 overflow-hidden">
            <CardContent className="p-0">
              {/* Video */}
              <div className="aspect-[9/16] bg-black relative">
                {originalVideo.outputUrl ? (
                  <video
                    ref={videoRef}
                    src={originalVideo.outputUrl}
                    className="w-full h-full object-contain cursor-pointer"
                    loop
                    playsInline
                    muted={isMuted}
                    onClick={togglePlay}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500">
                    {isKorean ? "영상 없음" : "No video"}
                  </div>
                )}

                {/* Label */}
                <Badge className="absolute top-2 left-2 bg-amber-500/90 text-white gap-1">
                  <Star className="w-3 h-3 fill-white" />
                  {isKorean ? "원본" : "Original"}
                </Badge>

                {/* Controls overlay */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content summary */}
          <Card className="mt-4 bg-neutral-50 border-neutral-200">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-2">
                {isKorean ? "콘텐츠" : "Content"}
              </h4>
              <div className="space-y-1 text-xs text-neutral-500">
                <p>📝 {session.content.script ? "스크립트 포함" : "스크립트 없음"}</p>
                <p>🖼️ {session.content.images.length}장</p>
                {session.content.musicTrack && <p>🎵 {session.content.musicTrack.name}</p>}
                {session.content.effectPreset && <p>⚡ {session.content.effectPreset.name}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Style selection / Generation progress */}
        <div className="lg:col-span-3 space-y-4">
          {!isGenerating ? (
            <>
              {/* Image Selection Mode */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-neutral-900 mb-3">
                    {isKorean ? "이미지 선택 방식" : "Image Selection Mode"}
                  </h3>
                  <RadioGroup
                    value={imageSelectionMode}
                    onValueChange={(v) => setImageSelectionMode(v as "auto" | "manual")}
                    className="flex flex-col sm:flex-row gap-4"
                  >
                    <div className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all flex-1",
                      imageSelectionMode === "auto"
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    )}>
                      <RadioGroupItem value="auto" id="mode-auto" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="mode-auto" className="font-medium cursor-pointer">
                          {isKorean ? "자동 생성" : "Auto Generate"}
                        </Label>
                        <p className="text-xs text-neutral-500 mt-1">
                          {isKorean
                            ? "AI가 키워드로 이미지를 자동 검색하여 베리에이션 생성"
                            : "AI auto-searches images with keywords for variations"}
                        </p>
                      </div>
                      <Zap className="w-5 h-5 text-neutral-400 mt-0.5" />
                    </div>

                    <div className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all flex-1",
                      imageSelectionMode === "manual"
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    )}>
                      <RadioGroupItem value="manual" id="mode-manual" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="mode-manual" className="font-medium cursor-pointer">
                          {isKorean ? "직접 선택" : "Manual Selection"}
                        </Label>
                        <p className="text-xs text-neutral-500 mt-1">
                          {isKorean
                            ? "원본 이미지와 검색 이미지 중에서 직접 선택"
                            : "Choose from original and searched images"}
                        </p>
                      </div>
                      <ImageIcon className="w-5 h-5 text-neutral-400 mt-0.5" />
                    </div>
                  </RadioGroup>

                  {/* Manual mode - image selection button */}
                  {imageSelectionMode === "manual" && (
                    <div className="mt-4 flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={handleOpenImageSelector}
                        className="gap-2"
                      >
                        <Search className="w-4 h-4" />
                        {isKorean ? "이미지 선택하기" : "Select Images"}
                      </Button>

                      {selectedImageUrls.length > 0 && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                          <Check className="w-3 h-3 mr-1" />
                          {selectedImageUrls.length}
                          {isKorean ? "장 선택됨" : " selected"}
                        </Badge>
                      )}

                      {selectedImageUrls.length > 0 && selectedImageUrls.length < 3 && (
                        <span className="text-xs text-amber-600">
                          {isKorean
                            ? `최소 3장 필요 (${3 - selectedImageUrls.length}장 더 필요)`
                            : `Min 3 required (${3 - selectedImageUrls.length} more needed)`}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Style Selection Grid */}
              <Card className="flex-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-neutral-900">
                      {isKorean ? "생성할 스타일 선택" : "Select Styles to Generate"}
                      <span className="text-neutral-400 font-normal ml-2">(1-8개)</span>
                    </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllStyles}
                      className="text-xs"
                    >
                      {isKorean ? "전체 선택" : "Select All"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearStyleSelection}
                      className="text-xs"
                    >
                      {isKorean ? "선택 해제" : "Clear"}
                    </Button>
                  </div>
                </div>

                {/* Style grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {STYLE_SETS.map((style) => {
                    const Icon: LucideIcon = STYLE_ICONS[style.id] || Zap;
                    const isSelected = selectedStyles.includes(style.id);

                    return (
                      <div
                        key={style.id}
                        className={cn(
                          "relative p-4 rounded-xl border-2 cursor-pointer transition-all",
                          isSelected
                            ? "border-neutral-900 bg-neutral-50"
                            : "border-neutral-200 hover:border-neutral-300 bg-white"
                        )}
                        onClick={() => toggleStyleSelection(style.id)}
                      >
                        {/* Checkbox */}
                        <div className="absolute top-3 right-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleStyleSelection(style.id)}
                            className="data-[state=checked]:bg-neutral-900 data-[state=checked]:border-neutral-900"
                          />
                        </div>

                        {/* Icon */}
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                            isSelected ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Text */}
                        <h4 className="font-medium text-neutral-900 text-sm mb-1">
                          {isKorean ? style.nameKo : style.name}
                        </h4>
                        <p className="text-xs text-neutral-500 line-clamp-2">
                          {isKorean ? style.descriptionKo : style.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Footer info */}
                <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-neutral-600">
                      {isKorean ? "선택됨:" : "Selected:"}{" "}
                      <span className="font-medium text-neutral-900">{selectedStyles.length}개</span>
                    </span>
                    {estimatedTime && (
                      <span className="text-neutral-500">
                        {isKorean ? "예상 시간:" : "Est. time:"} {estimatedTime}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Lightbulb className="w-4 h-4" />
                    {isKorean
                      ? "3-5개 스타일 선택 시 효과적인 A/B 테스트가 가능합니다"
                      : "Selecting 3-5 styles enables effective A/B testing"}
                  </div>
                </div>
              </CardContent>
            </Card>
            </>
          ) : (
            /* Generation Progress */
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-neutral-900">
                    {isKorean ? "생성 진행 상황" : "Generation Progress"}
                  </h3>
                  <Badge variant="secondary" className="bg-neutral-100">
                    {progressStats.completed}/{progressStats.total}{" "}
                    {isKorean ? "완료" : "completed"}
                  </Badge>
                </div>

                {/* Progress cards grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Original - always complete */}
                  <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50">
                    <div className="aspect-[9/16] bg-black rounded-lg mb-3 relative overflow-hidden">
                      {/* Try to show thumbnail, fallback to video frame, or show check icon */}
                      {originalVideo.thumbnailUrl && !originalImageError && !isVideoUrl(originalVideo.thumbnailUrl) ? (
                        <img
                          src={originalVideo.thumbnailUrl}
                          alt="Original"
                          className="w-full h-full object-cover"
                          onError={handleOriginalImageError}
                        />
                      ) : originalVideo.outputUrl && !originalImageError ? (
                        // For video URLs, use video element with poster or first frame
                        <video
                          src={originalVideo.outputUrl}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-100">
                          <Check className="w-8 h-8 text-emerald-500" />
                        </div>
                      )}
                      <Badge className="absolute top-2 left-2 bg-amber-500/90 text-white gap-1 text-[10px]">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        {isKorean ? "원본" : "Original"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                      <Check className="w-3.5 h-3.5" />
                      {isKorean ? "완료됨" : "Completed"}
                    </div>
                  </div>

                  {/* Variation cards */}
                  {variations.map((variation) => {
                    const Icon: LucideIcon = STYLE_ICONS[variation.styleId] || Zap;
                    const isComplete = variation.status === "completed";
                    const isFailed = variation.status === "failed";
                    const isInProgress = variation.status === "generating";

                    return (
                      <div
                        key={variation.id}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all",
                          isComplete && "border-emerald-200 bg-emerald-50",
                          isFailed && "border-red-200 bg-red-50",
                          !isComplete && !isFailed && "border-neutral-200 bg-white"
                        )}
                      >
                        <div className="aspect-[9/16] bg-neutral-100 rounded-lg mb-3 relative overflow-hidden flex items-center justify-center">
                          {isComplete && variation.thumbnailUrl && !variationImageErrors[variation.id] && !isVideoUrl(variation.thumbnailUrl) ? (
                            <img
                              src={variation.thumbnailUrl}
                              alt={variation.styleName}
                              className="w-full h-full object-cover"
                              onError={() => handleVariationImageError(variation.id)}
                            />
                          ) : isComplete && variation.outputUrl && !variationImageErrors[variation.id] ? (
                            // For video URLs, use video element to show first frame
                            <video
                              src={variation.outputUrl}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                          ) : isComplete ? (
                            <div className="w-full h-full flex items-center justify-center bg-emerald-100">
                              <Check className="w-8 h-8 text-emerald-500" />
                            </div>
                          ) : isFailed ? (
                            <X className="w-8 h-8 text-red-500" />
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
                              <span className="text-lg font-bold text-neutral-600">
                                {variation.progress}%
                              </span>
                            </div>
                          )}

                          {/* Style badge */}
                          <Badge
                            variant="secondary"
                            className="absolute top-2 left-2 bg-neutral-800/80 text-white text-[10px]"
                          >
                            {isKorean ? variation.styleNameKo : variation.styleName}
                          </Badge>
                        </div>

                        {/* Status */}
                        {isComplete && (
                          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                            <Check className="w-3.5 h-3.5" />
                            {isKorean ? "완료됨" : "Completed"}
                          </div>
                        )}
                        {isFailed && (
                          <div className="flex items-center gap-1.5 text-red-600 text-xs font-medium">
                            <X className="w-3.5 h-3.5" />
                            {isKorean ? "실패" : "Failed"}
                          </div>
                        )}
                        {isInProgress && (
                          <div className="space-y-1.5">
                            <Progress value={variation.progress} className="h-1" />
                            <p className="text-xs text-neutral-500">
                              {variation.currentStep || (isKorean ? "처리 중..." : "Processing...")}
                            </p>
                          </div>
                        )}
                        {variation.status === "pending" && (
                          <p className="text-xs text-neutral-400">
                            {isKorean ? "대기 중" : "Pending"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer message */}
                <div className="mt-6 pt-4 border-t border-neutral-200">
                  <p className="text-sm text-neutral-500 text-center flex items-center justify-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    {isKorean
                      ? "완료 시 자동으로 비교 화면으로 이동합니다"
                      : "You'll be redirected to comparison view when complete"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}
