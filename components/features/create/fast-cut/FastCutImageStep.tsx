"use client";

import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Search,
  Check,
  X,
  Globe,
  AlertCircle,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { ImageCandidate } from "@/lib/fast-cut-api";
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

interface FastCutImageStepProps {
  imageCandidates: ImageCandidate[];
  selectedImages: ImageCandidate[];
  searchingImages: boolean;
  editableKeywords: string[];
  selectedSearchKeywords: Set<string>;
  setSelectedSearchKeywords: (keywords: Set<string>) => void;
  onToggleSelection: (image: ImageCandidate) => void;
  onReorderImages: (newImages: ImageCandidate[]) => void;
  onSearchImages: () => void;
  onNext?: () => void;
}

// Sortable Image Item Component
function SortableImageItem({
  image,
  index,
  onRemove,
}: {
  image: ImageCandidate;
  index: number;
  onRemove: () => void;
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
        "relative flex-shrink-0 w-16 cursor-grab active:cursor-grabbing touch-none",
        isDragging && "z-50 opacity-80"
      )}
    >
      <div
        className={cn(
          "aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors",
          isDragging ? "border-neutral-900 shadow-lg" : "border-neutral-200"
        )}
      >
        <img
          src={image.thumbnailUrl || image.sourceUrl}
          alt=""
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </div>
      {/* Order Number */}
      <div className="absolute -top-1 -left-1 w-5 h-5 bg-neutral-900 text-white rounded-full flex items-center justify-center text-xs font-bold pointer-events-none">
        {index + 1}
      </div>
      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function FastCutImageStep({
  imageCandidates,
  selectedImages,
  searchingImages,
  editableKeywords,
  selectedSearchKeywords,
  setSelectedSearchKeywords,
  onToggleSelection,
  onReorderImages,
  onSearchImages,
  onNext,
}: FastCutImageStepProps) {
  const { language, translate } = useI18n();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selectedImages.findIndex((img) => img.id === active.id);
      const newIndex = selectedImages.findIndex((img) => img.id === over.id);
      const newImages = arrayMove(selectedImages, oldIndex, newIndex);
      onReorderImages(newImages);
    }
  };

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

  const toggleKeywordSelection = (keyword: string) => {
    const newSet = new Set(selectedSearchKeywords);
    if (newSet.has(keyword)) {
      newSet.delete(keyword);
    } else {
      newSet.add(keyword);
    }
    setSelectedSearchKeywords(newSet);
  };

  // Get quality badge color
  const getQualityColor = (score: number | undefined) => {
    if (!score) return "bg-neutral-100 text-neutral-500";
    if (score >= 0.8) return "bg-neutral-900 text-white";
    if (score >= 0.6) return "bg-neutral-200 text-neutral-700";
    return "bg-neutral-100 text-neutral-500";
  };

  // Render image grid
  const renderImageGrid = (images: ImageCandidate[], showSource = false) => (
    <div className="grid grid-cols-4 gap-3">
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
                : "border-transparent hover:border-neutral-300"
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
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-neutral-900">
                    {selectionIndex + 1}
                  </span>
                </div>
              </div>
            )}

            {/* Quality Score */}
            {image.qualityScore !== undefined && (
              <Badge
                className={cn(
                  "absolute top-1.5 left-1.5 text-[10px]",
                  getQualityColor(image.qualityScore)
                )}
              >
                {Math.round(image.qualityScore * 100)}%
              </Badge>
            )}

            {/* Image Dimensions */}
            {(image.width > 0 && image.height > 0) && (
              <Badge
                variant="outline"
                className="absolute top-7 left-1.5 text-[9px] bg-black/60 text-white border-none"
              >
                {image.width}×{image.height}
              </Badge>
            )}

            {/* Source Domain */}
            {showSource && image.sourceDomain && (
              <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-[9px] text-white truncate">
                  {image.sourceDomain}
                </p>
              </div>
            )}

            {/* Selection Toggle Icon */}
            <button
              className={cn(
                "absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all",
                isSelected
                  ? "bg-neutral-900 text-white"
                  : "bg-white/80 text-neutral-600 hover:bg-white"
              )}
            >
              {isSelected ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-1">
            {language === "ko" ? "이미지 선택" : "Image Selection"}
          </h2>
          <p className="text-sm text-neutral-500">
            {language === "ko"
              ? "영상에 사용할 이미지를 3~10장 선택하세요"
              : "Select 3-10 images for your video"}
          </p>
        </div>

        {/* Next Step Button - Prominent position */}
        {selectedImages.length >= 3 && onNext && (
          <Button
            onClick={onNext}
            className="bg-neutral-900 text-white hover:bg-neutral-800"
          >
            {language === "ko" ? "음악 선택" : "Select Music"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Selection Status */}
      <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              selectedImages.length >= 3
                ? "bg-neutral-900 text-white"
                : "bg-neutral-200 text-neutral-500"
            )}
          >
            {selectedImages.length}
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900 flex items-center">
              {language === "ko" ? "선택된 이미지" : "Selected Images"}
              <TooltipIcon tooltipKey="fastCut.tooltips.images.selectImages" />
            </p>
            <p className="text-xs text-neutral-500">
              {selectedImages.length < 3
                ? language === "ko"
                  ? `${3 - selectedImages.length}장 더 필요`
                  : `${3 - selectedImages.length} more needed`
                : language === "ko"
                ? "충분합니다"
                : "Ready"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedImages.length >= 3 ? (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <Check className="h-3 w-3 mr-1" />
              {language === "ko" ? "준비 완료" : "Ready"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              <AlertCircle className="h-3 w-3 mr-1" />
              {language === "ko" ? "최소 3장 필요" : "Min 3 required"}
            </Badge>
          )}
        </div>
      </div>

      {/* Web Search */}
      <div className="space-y-4">
        {/* Search Keywords Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
            <Search className="h-4 w-4" />
            {language === "ko" ? "검색할 키워드 선택" : "Select Keywords to Search"}
            <TooltipIcon tooltipKey="fastCut.tooltips.images.searchButton" />
          </Label>
          <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
            {editableKeywords.map((keyword) => (
              <Badge
                key={keyword}
                variant={selectedSearchKeywords.has(keyword) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all px-3 py-1",
                  selectedSearchKeywords.has(keyword)
                    ? "bg-neutral-900 text-white hover:bg-neutral-800"
                    : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                )}
                onClick={() => toggleKeywordSelection(keyword)}
              >
                {keyword}
              </Badge>
            ))}
          </div>
          <Button
            onClick={onSearchImages}
            disabled={searchingImages || selectedSearchKeywords.size === 0}
            className="w-full"
            variant="outline"
          >
            {searchingImages ? (
              <>
                <Search className="h-4 w-4 mr-2 animate-spin" />
                {language === "ko" ? "검색 중..." : "Searching..."}
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                {language === "ko" ? "이미지 검색" : "Search Images"}
              </>
            )}
          </Button>
        </div>

        {/* Search Results */}
        {imageCandidates.length > 0 ? (
          <ScrollArea className="h-[480px] pr-4">
            {renderImageGrid(imageCandidates, true)}
          </ScrollArea>
        ) : !searchingImages ? (
          <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
            <Globe className="h-12 w-12 mb-2 text-neutral-300" />
            <p>
              {language === "ko"
                ? "키워드를 선택하고 검색하세요"
                : "Select keywords and search"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Selected Images Preview - Always visible */}
      <div className="space-y-2 border-t border-neutral-200 pt-4">
        <Label className="text-sm font-medium text-neutral-700 flex items-center justify-between">
          <span className="flex items-center">
            {language === "ko" ? "선택된 이미지 순서" : "Selected Image Order"}
            <TooltipIcon tooltipKey="fastCut.tooltips.images.timeline" />
          </span>
          <span className="text-xs text-neutral-400">
            {selectedImages.length}/10 {language === "ko" ? "선택됨" : "selected"}
            {selectedImages.length > 1 && (
              <span className="ml-2 text-neutral-500">
                ({language === "ko" ? "드래그하여 순서 변경" : "Drag to reorder"})
              </span>
            )}
          </span>
        </Label>
        {selectedImages.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedImages.map((img) => img.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-2 overflow-x-auto pb-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                {selectedImages.map((image, idx) => (
                  <SortableImageItem
                    key={image.id}
                    image={image}
                    index={idx}
                    onRemove={() => onToggleSelection(image)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="p-4 bg-neutral-50 rounded-lg border border-dashed border-neutral-300 text-center">
            <p className="text-sm text-neutral-400">
              {language === "ko"
                ? "위에서 이미지를 클릭하여 선택하세요"
                : "Click on images above to select them"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
