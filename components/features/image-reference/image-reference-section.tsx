"use client";

import { useState } from "react";
import { Asset } from "@/lib/campaigns-api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageIcon, X, Sparkles } from "lucide-react";
import { ImagePickerModal } from "./image-picker-modal";
import { SelectedImageCard } from "./selected-image-card";

export interface ImageReferenceData {
  assetId: string;
  assetUrl: string;
  filename: string;
  description: string;
}

interface ImageReferenceSectionProps {
  images: Asset[];
  imageReference: ImageReferenceData | null;
  onImageReferenceChange: (ref: ImageReferenceData | null) => void;
  campaignId: string;
}

export function ImageReferenceSection({
  images,
  imageReference,
  onImageReferenceChange,
  campaignId,
}: ImageReferenceSectionProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleSelectImage = (asset: Asset) => {
    onImageReferenceChange({
      assetId: asset.id,
      assetUrl: asset.s3_url,
      filename: asset.original_filename,
      description: "",
    });
    setShowPicker(false);
  };

  const handleDescriptionChange = (description: string) => {
    if (imageReference) {
      onImageReferenceChange({
        ...imageReference,
        description,
      });
    }
  };

  const handleRemoveImage = () => {
    onImageReferenceChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          이미지 참조 (선택)
        </Label>
        {imageReference && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveImage}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4 mr-1" />
            제거
          </Button>
        )}
      </div>

      {imageReference ? (
        <SelectedImageCard
          imageUrl={imageReference.assetUrl}
          filename={imageReference.filename}
          description={imageReference.description}
          onDescriptionChange={handleDescriptionChange}
          onChangeImage={() => setShowPicker(true)}
          onRemove={handleRemoveImage}
        />
      ) : (
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            이미지를 선택하면 영상의 시작점이나 스타일 참조로 활용됩니다
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPicker(true)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Asset Locker에서 이미지 선택
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        이미지를 선택하면 Image-to-Video (I2V) 모드로 생성됩니다. 선택하지 않으면 텍스트만으로 생성합니다.
      </p>

      <ImagePickerModal
        open={showPicker}
        onOpenChange={setShowPicker}
        images={images}
        onSelectImage={handleSelectImage}
        selectedImageId={imageReference?.assetId}
        campaignId={campaignId}
      />
    </div>
  );
}
