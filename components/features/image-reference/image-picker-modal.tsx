"use client";

import { useState } from "react";
import { Asset } from "@/lib/campaigns-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Check, Upload, ImageIcon } from "lucide-react";
import Link from "next/link";

interface ImagePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: Asset[];
  onSelectImage: (asset: Asset) => void;
  selectedImageId?: string;
  campaignId: string;
}

export function ImagePickerModal({
  open,
  onOpenChange,
  images,
  onSelectImage,
  selectedImageId,
  campaignId,
}: ImagePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredImages = images.filter((image) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      image.original_filename.toLowerCase().includes(query) ||
      image.filename.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Asset Locker에서 이미지 선택
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이미지 검색..."
            className="pl-10"
          />
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {filteredImages.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
              {filteredImages.map((image) => {
                const isSelected = selectedImageId === image.id;
                const isHovered = hoveredId === image.id;

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => onSelectImage(image)}
                    onMouseEnter={() => setHoveredId(image.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={image.s3_url}
                      alt={image.original_filename}
                      className="w-full h-full object-cover"
                    />

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}

                    {/* Hover Overlay with Filename */}
                    {(isHovered || isSelected) && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-white text-xs truncate">
                          {image.original_filename}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                업로드된 이미지가 없습니다
              </p>
              <Button variant="outline" asChild>
                <Link href={`/campaigns/${campaignId}`}>
                  <Upload className="w-4 h-4 mr-2" />
                  이미지 업로드하러 가기
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">
                "{searchQuery}"에 해당하는 이미지가 없습니다
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {filteredImages.length}개의 이미지
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
