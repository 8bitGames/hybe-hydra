"use client";

import { useState } from "react";
import { Asset } from "@/lib/campaigns-api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageIcon, X, Sparkles } from "lucide-react";
import { ImagePickerModal } from "./image-picker-modal";
import { SelectedImageCard } from "./selected-image-card";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
          {t.generation.imageReferenceOptional}
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
            {t.common.remove}
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
            {t.generation.imageReferenceDescription}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPicker(true)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {t.generation.selectFromAssetLocker}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t.generation.i2vModeInfo}
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
