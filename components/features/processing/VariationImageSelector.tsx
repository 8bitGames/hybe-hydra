"use client";

import { useState, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Search,
  Check,
  X,
  Globe,
  Plus,
  ZoomIn,
  RefreshCw,
  Star,
  Loader2,
  ImageIcon,
  ArrowLeft,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface VariationImageCandidate {
  id: string;
  sourceUrl: string;
  thumbnailUrl: string;
  sourceTitle?: string;
  sourceDomain?: string;
  width: number;
  height: number;
  isSelected: boolean;
  sortOrder: number;
  qualityScore: number;
  isOriginal?: boolean;
}

interface VariationImageSelectorProps {
  generationId: string;
  originalImages: VariationImageCandidate[];
  searchedImages: VariationImageCandidate[];
  keywords: string[];
  isLoading: boolean;
  isSearching: boolean;
  selectedImages: VariationImageCandidate[];
  onToggleSelection: (image: VariationImageCandidate) => void;
  onReorderImages: (newImages: VariationImageCandidate[]) => void;
  onSearchKeywords: (keywords: string[], forceRefresh?: boolean) => void;
  onBack: () => void;
  onConfirm: () => void;
}

// Sortable Image Item
function SortableImageItem({
  image,
  index,
  onRemove,
  onPreview,
}: {
  image: VariationImageCandidate;
  index: number;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative flex-shrink-0 w-28 cursor-grab active:cursor-grabbing touch-none",
        isDragging && "z-50 opacity-80"
      )}
    >
      <div
        className={cn(
          "relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors group",
          isDragging ? "border-neutral-900 shadow-lg" : "border-neutral-200",
          image.isOriginal && "ring-2 ring-amber-400/50"
        )}
      >
        <img
          src={image.sourceUrl}
          alt=""
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
        {/* Order Number */}
        <div className="absolute top-1 left-1 w-5 h-5 bg-neutral-900 text-white rounded-full flex items-center justify-center text-xs font-bold pointer-events-none">
          {index + 1}
        </div>
        {/* Original Badge */}
        {image.isOriginal && (
          <Badge className="absolute top-1 left-7 bg-amber-500/90 text-white text-[8px] px-1 py-0">
            <Star className="w-2 h-2 mr-0.5 fill-white" />
          </Badge>
        )}
        {/* Preview Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-1 left-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function VariationImageSelector({
  generationId,
  originalImages,
  searchedImages,
  keywords,
  isLoading,
  isSearching,
  selectedImages,
  onToggleSelection,
  onReorderImages,
  onSearchKeywords,
  onBack,
  onConfirm,
}: VariationImageSelectorProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const [editableKeywords, setEditableKeywords] = useState<string[]>(keywords);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set(keywords));
  const [newKeyword, setNewKeyword] = useState("");
  const [previewImage, setPreviewImage] = useState<VariationImageCandidate | null>(null);

  // Update editable keywords when props change
  useMemo(() => {
    if (keywords.length > 0 && editableKeywords.length === 0) {
      setEditableKeywords(keywords);
      setSelectedKeywords(new Set(keywords));
    }
  }, [keywords, editableKeywords.length]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selectedImages.findIndex((img) => img.id === active.id);
      const newIndex = selectedImages.findIndex((img) => img.id === over.id);
      const newImages = arrayMove(selectedImages, oldIndex, newIndex);
      onReorderImages(newImages);
    }
  };

  const toggleKeyword = useCallback((keyword: string) => {
    setSelectedKeywords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyword)) {
        newSet.delete(keyword);
      } else {
        newSet.add(keyword);
      }
      return newSet;
    });
  }, []);

  const addKeyword = useCallback(() => {
    const trimmed = newKeyword.trim();
    if (trimmed && !editableKeywords.includes(trimmed)) {
      setEditableKeywords(prev => [...prev, trimmed]);
      setSelectedKeywords(prev => new Set([...prev, trimmed]));
      setNewKeyword("");
    }
  }, [newKeyword, editableKeywords]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const handleSearch = useCallback(() => {
    const kws = Array.from(selectedKeywords);
    if (kws.length > 0) {
      onSearchKeywords(kws, false);
    }
  }, [selectedKeywords, onSearchKeywords]);

  const handleForceRefresh = useCallback(() => {
    const kws = Array.from(selectedKeywords);
    if (kws.length > 0) {
      onSearchKeywords(kws, true);
    }
  }, [selectedKeywords, onSearchKeywords]);

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return "bg-neutral-900 text-white";
    if (score >= 0.6) return "bg-neutral-200 text-neutral-700";
    return "bg-neutral-100 text-neutral-500";
  };

  const renderImageGrid = (
    images: VariationImageCandidate[],
    title: string,
    icon: React.ReactNode,
    showOriginalBadge = false
  ) => {
    if (images.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="secondary" className="text-xs">
              {images.length}
            </Badge>
          </Label>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {images.map((image) => {
            const isSelected = selectedImages.some((i) => i.id === image.id);
            const selectionIndex = selectedImages.findIndex((i) => i.id === image.id);

            return (
              <div
                key={image.id}
                onClick={() => onToggleSelection(image)}
                className={cn(
                  "relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                  isSelected
                    ? "border-neutral-900 ring-2 ring-neutral-900/20"
                    : "border-transparent hover:border-neutral-300",
                  showOriginalBadge && "ring-1 ring-amber-300"
                )}
              >
                <img
                  src={image.thumbnailUrl || image.sourceUrl}
                  alt={image.sourceTitle || "Image"}
                  className="w-full h-full object-cover"
                />

                {/* Selection Overlay */}
                {isSelected && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-neutral-900">
                        {selectionIndex + 1}
                      </span>
                    </div>
                  </div>
                )}

                {/* Original Badge */}
                {showOriginalBadge && (
                  <Badge className="absolute top-1 left-1 bg-amber-500/90 text-white text-[8px] px-1 py-0">
                    <Star className="w-2 h-2 mr-0.5 fill-white" />
                    {isKorean ? "원본" : "Orig"}
                  </Badge>
                )}

                {/* Quality Score */}
                {!showOriginalBadge && image.qualityScore !== undefined && (
                  <Badge
                    className={cn(
                      "absolute top-1 left-1 text-[9px] px-1",
                      getQualityColor(image.qualityScore)
                    )}
                  >
                    {Math.round(image.qualityScore * 100)}%
                  </Badge>
                )}

                {/* Dimensions */}
                {image.width > 0 && image.height > 0 && (
                  <Badge
                    variant="outline"
                    className="absolute bottom-1 left-1 text-[8px] bg-black/60 text-white border-none px-1"
                  >
                    {image.width}×{image.height}
                  </Badge>
                )}

                {/* Selection Toggle */}
                <button
                  className={cn(
                    "absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-neutral-900 text-white"
                      : "bg-white/80 text-neutral-600 hover:bg-white"
                  )}
                >
                  {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const selectedOriginalCount = selectedImages.filter(i => i.isOriginal).length;
  const selectedSearchCount = selectedImages.filter(i => !i.isOriginal).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {isKorean ? "돌아가기" : "Back"}
        </Button>

        <h2 className="text-lg font-semibold text-neutral-900">
          {isKorean ? "이미지 직접 선택" : "Select Images Manually"}
        </h2>

        <Button
          onClick={onConfirm}
          disabled={selectedImages.length < 3}
          className="bg-neutral-900 hover:bg-neutral-800 text-white"
        >
          {isKorean ? `${selectedImages.length}개 선택 완료` : `Confirm ${selectedImages.length} Images`}
        </Button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-3" />
            <p className="text-neutral-500">
              {isKorean ? "이미지 로딩 중..." : "Loading images..."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left: Image Grids */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Keyword Search Section */}
            <div className="space-y-3 mb-4">
              <Label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                <Search className="h-4 w-4" />
                {isKorean ? "검색 키워드" : "Search Keywords"}
              </Label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-50 border border-neutral-200 rounded-lg">
                {editableKeywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant={selectedKeywords.has(keyword) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all px-2 py-0.5 text-xs",
                      selectedKeywords.has(keyword)
                        ? "bg-neutral-900 text-white hover:bg-neutral-800"
                        : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                    )}
                    onClick={() => toggleKeyword(keyword)}
                  >
                    {keyword}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder={isKorean ? "새 키워드 입력..." : "Enter new keyword..."}
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addKeyword}
                  disabled={!newKeyword.trim()}
                  className="h-8"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || selectedKeywords.size === 0}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  {isSearching ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  <span className="ml-1.5">{isKorean ? "검색" : "Search"}</span>
                </Button>
                {searchedImages.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleForceRefresh}
                        disabled={isSearching || selectedKeywords.size === 0}
                        variant="outline"
                        size="sm"
                        className="h-8"
                      >
                        <RefreshCw className={cn("h-3 w-3", isSearching && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {isKorean ? "새로 검색 (캐시 무시)" : "Fresh search"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Image Grids */}
            <ScrollArea className="flex-1">
              <div className="space-y-6 pr-4">
                {/* Original Images */}
                {renderImageGrid(
                  originalImages,
                  isKorean ? "원본 이미지" : "Original Images",
                  <Star className="h-4 w-4 text-amber-500" />,
                  true
                )}

                {/* Searched Images */}
                {renderImageGrid(
                  searchedImages,
                  isKorean ? "웹 검색 이미지" : "Web Search Images",
                  <Globe className="h-4 w-4 text-blue-500" />
                )}

                {/* Empty State */}
                {originalImages.length === 0 && searchedImages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
                    <ImageIcon className="h-12 w-12 mb-2 text-neutral-300" />
                    <p>
                      {isKorean
                        ? "키워드를 선택하고 검색하세요"
                        : "Select keywords and search"}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Selected Images */}
          <div className="w-80 flex flex-col border-l border-neutral-200 pl-6">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium text-neutral-700">
                {isKorean ? "선택된 이미지" : "Selected Images"}
              </Label>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500" />
                  {selectedOriginalCount}
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-blue-500" />
                  {selectedSearchCount}
                </span>
              </div>
            </div>

            {/* Selection Count */}
            <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg mb-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  selectedImages.length >= 3
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-200 text-neutral-500"
                )}
              >
                {selectedImages.length}
              </div>
              <div className="flex-1">
                <p className="text-xs text-neutral-500">
                  {selectedImages.length < 3
                    ? isKorean
                      ? `${3 - selectedImages.length}장 더 필요`
                      : `${3 - selectedImages.length} more needed`
                    : isKorean
                    ? "준비 완료"
                    : "Ready"}
                </p>
              </div>
              {selectedImages.length >= 3 && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </div>

            {/* Selected Images Grid */}
            {selectedImages.length > 0 ? (
              <ScrollArea className="flex-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedImages.map((img) => img.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="flex flex-wrap gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                      {selectedImages.map((image, idx) => (
                        <SortableImageItem
                          key={image.id}
                          image={image}
                          index={idx}
                          onRemove={() => onToggleSelection(image)}
                          onPreview={() => setPreviewImage(image)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-neutral-400 text-center">
                  {isKorean
                    ? "왼쪽에서 이미지를 클릭하여 선택하세요"
                    : "Click images on the left to select"}
                </p>
              </div>
            )}

            {/* Tip */}
            <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-600">
              <p>
                {isKorean
                  ? "드래그하여 순서를 변경할 수 있습니다"
                  : "Drag to reorder images"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2 bg-black/95 border-neutral-800">
          {previewImage && (
            <div className="relative flex flex-col items-center">
              <img
                src={previewImage.sourceUrl}
                alt={previewImage.sourceTitle || "Preview"}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
              <div className="mt-3 text-center">
                {previewImage.sourceTitle && (
                  <p className="text-sm text-white/80 mb-1">{previewImage.sourceTitle}</p>
                )}
                <div className="flex items-center justify-center gap-3 text-xs text-white/60">
                  {previewImage.isOriginal && (
                    <Badge className="bg-amber-500 text-white">
                      <Star className="w-2.5 h-2.5 mr-1 fill-white" />
                      {isKorean ? "원본" : "Original"}
                    </Badge>
                  )}
                  {previewImage.width > 0 && previewImage.height > 0 && (
                    <span>{previewImage.width} × {previewImage.height}</span>
                  )}
                  {previewImage.sourceDomain && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {previewImage.sourceDomain}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
