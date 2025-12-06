"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useLabels, useCreateArtist } from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

interface AddArtistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddArtistModal({
  open,
  onOpenChange,
  onSuccess,
}: AddArtistModalProps) {
  const { t, language } = useI18n();
  const artist = t.artist;
  const { data: labels = [], isLoading: labelsLoading } = useLabels();
  const createArtistMutation = useCreateArtist();

  const [formData, setFormData] = useState({
    name: "",
    stage_name: "",
    group_name: "",
    label_id: "",
    profile_description: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleClose = () => {
    if (!createArtistMutation.isPending) {
      setFormData({
        name: "",
        stage_name: "",
        group_name: "",
        label_id: "",
        profile_description: "",
      });
      setErrors({});
      onOpenChange(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = language === "ko" ? "이름은 필수입니다" : "Name is required";
    }

    if (!formData.label_id) {
      newErrors.label_id = language === "ko" ? "레이블을 선택하세요" : "Please select a label";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await createArtistMutation.mutateAsync({
        name: formData.name.trim(),
        label_id: formData.label_id,
        stage_name: formData.stage_name.trim() || undefined,
        group_name: formData.group_name.trim() || undefined,
        profile_description: formData.profile_description.trim() || undefined,
      });

      handleClose();
      onSuccess?.();
    } catch {
      setErrors({
        submit: language === "ko"
          ? "아티스트 생성에 실패했습니다"
          : "Failed to create artist",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {artist.addArtist}
          </DialogTitle>
          <DialogDescription>
            {artist.addArtistDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name (Required) */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base">
              {artist.name} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder={artist.namePlaceholder}
              className="h-10 text-base"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Stage Name */}
          <div className="space-y-2">
            <Label htmlFor="stage_name" className="text-base">
              {artist.stageName}
            </Label>
            <Input
              id="stage_name"
              value={formData.stage_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, stage_name: e.target.value }))
              }
              placeholder={artist.stageNamePlaceholder}
              className="h-10 text-base"
            />
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group_name" className="text-base">
              {artist.groupName}
            </Label>
            <Input
              id="group_name"
              value={formData.group_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, group_name: e.target.value }))
              }
              placeholder={artist.groupNamePlaceholder}
              className="h-10 text-base"
            />
          </div>

          {/* Label (Required) */}
          <div className="space-y-2">
            <Label htmlFor="label_id" className="text-base">
              {artist.label} <span className="text-destructive">*</span>
            </Label>
            {labelsLoading ? (
              <div className="flex items-center gap-2 h-10">
                <Spinner className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  {language === "ko" ? "레이블 로딩 중..." : "Loading labels..."}
                </span>
              </div>
            ) : (
              <Select
                value={formData.label_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, label_id: value }))
                }
              >
                <SelectTrigger
                  className="h-10 text-base"
                  aria-invalid={!!errors.label_id}
                >
                  <SelectValue placeholder={artist.selectLabel} />
                </SelectTrigger>
                <SelectContent>
                  {labels.map((label) => (
                    <SelectItem key={label.id} value={label.id} className="text-base">
                      {label.name} ({label.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.label_id && (
              <p className="text-sm text-destructive">{errors.label_id}</p>
            )}
          </div>

          {/* Profile Description */}
          <div className="space-y-2">
            <Label htmlFor="profile_description" className="text-base">
              {artist.description}
            </Label>
            <Textarea
              id="profile_description"
              value={formData.profile_description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  profile_description: e.target.value,
                }))
              }
              placeholder={artist.descriptionPlaceholder}
              className="text-base min-h-[80px]"
            />
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <p className="text-sm text-destructive text-center">{errors.submit}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createArtistMutation.isPending}
              className="text-base"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={createArtistMutation.isPending || labelsLoading}
              className="text-base"
            >
              {createArtistMutation.isPending ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {language === "ko" ? "생성 중..." : "Creating..."}
                </>
              ) : (
                artist.create
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
