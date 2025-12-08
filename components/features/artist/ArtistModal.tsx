"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useLabels, useCreateArtist, useUpdateArtist } from "@/lib/queries";
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
import { Spinner } from "@/components/ui/spinner";
import { UserPlus, Pencil } from "lucide-react";
import type { Artist } from "@/lib/campaigns-api";

const BIG_MACHINE_CODE = "BIGMACHINE";

interface ArtistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** If provided, modal opens in edit mode */
  artist?: Artist | null;
}

export function ArtistModal({
  open,
  onOpenChange,
  onSuccess,
  artist,
}: ArtistModalProps) {
  const { t, language } = useI18n();
  const artistT = t.artist;
  const { data: labels = [], isLoading: labelsLoading } = useLabels();
  const createArtistMutation = useCreateArtist();
  const updateArtistMutation = useUpdateArtist();

  const isEditMode = !!artist;
  const isPending = createArtistMutation.isPending || updateArtistMutation.isPending;

  const [formData, setFormData] = useState({
    name: "",
    stage_name: "",
    group_name: "",
    label_id: "",
    profile_description: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-select Big Machine label when labels are loaded
  const bigMachineLabel = labels.find((l) => l.code === BIG_MACHINE_CODE);

  // Initialize form data when modal opens
  useEffect(() => {
    if (open) {
      if (artist) {
        // Edit mode - populate with existing data
        setFormData({
          name: artist.name || "",
          stage_name: artist.stage_name || "",
          group_name: artist.group_name || "",
          label_id: artist.label_id || "",
          profile_description: artist.profile_description || "",
        });
      } else {
        // Create mode - reset form
        setFormData({
          name: "",
          stage_name: "",
          group_name: "",
          label_id: bigMachineLabel?.id || "",
          profile_description: "",
        });
      }
      setErrors({});
    }
  }, [open, artist, bigMachineLabel?.id]);

  // Auto-select Big Machine label for create mode
  useEffect(() => {
    if (!isEditMode && bigMachineLabel && !formData.label_id) {
      setFormData((prev) => ({ ...prev, label_id: bigMachineLabel.id }));
    }
  }, [bigMachineLabel, formData.label_id, isEditMode]);

  const handleClose = () => {
    if (!isPending) {
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

    // Label validation for create mode
    if (!isEditMode && !formData.label_id && !bigMachineLabel) {
      newErrors.label_id = language === "ko" ? "레이블을 찾을 수 없습니다" : "Label not found";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (isEditMode && artist) {
        // Update existing artist
        await updateArtistMutation.mutateAsync({
          id: artist.id,
          data: {
            name: formData.name.trim(),
            stage_name: formData.stage_name.trim() || undefined,
            group_name: formData.group_name.trim() || undefined,
            profile_description: formData.profile_description.trim() || undefined,
          },
        });
      } else {
        // Create new artist
        const labelId = formData.label_id || bigMachineLabel?.id;
        if (!labelId) return;

        await createArtistMutation.mutateAsync({
          name: formData.name.trim(),
          label_id: labelId,
          stage_name: formData.stage_name.trim() || undefined,
          group_name: formData.group_name.trim() || undefined,
          profile_description: formData.profile_description.trim() || undefined,
        });
      }

      handleClose();
      onSuccess?.();
    } catch {
      setErrors({
        submit: isEditMode
          ? (language === "ko" ? "아티스트 수정에 실패했습니다" : "Failed to update artist")
          : (language === "ko" ? "아티스트 생성에 실패했습니다" : "Failed to create artist"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5" />
                {language === "ko" ? "아티스트 수정" : "Edit Artist"}
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                {artistT.addArtist}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? (language === "ko" ? "아티스트 정보를 수정합니다" : "Update artist information")
              : artistT.addArtistDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name (Required) */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base">
              {artistT.name} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder={artistT.namePlaceholder}
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
              {artistT.stageName}
            </Label>
            <Input
              id="stage_name"
              value={formData.stage_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, stage_name: e.target.value }))
              }
              placeholder={artistT.stageNamePlaceholder}
              className="h-10 text-base"
            />
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group_name" className="text-base">
              {artistT.groupName}
            </Label>
            <Input
              id="group_name"
              value={formData.group_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, group_name: e.target.value }))
              }
              placeholder={artistT.groupNamePlaceholder}
              className="h-10 text-base"
            />
          </div>

          {/* Label (Fixed to Big Machine for create, shown for edit) */}
          <div className="space-y-2">
            <Label htmlFor="label_id" className="text-base">
              {artistT.label}
            </Label>
            {labelsLoading ? (
              <div className="flex items-center gap-2 h-10">
                <Spinner className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  {language === "ko" ? "레이블 로딩 중..." : "Loading labels..."}
                </span>
              </div>
            ) : (
              <Input
                value={isEditMode ? (artist?.label_name || "") : (bigMachineLabel?.name || "Big Machine Records")}
                disabled
                className="h-10 text-base bg-muted"
              />
            )}
          </div>

          {/* Profile Description */}
          <div className="space-y-2">
            <Label htmlFor="profile_description" className="text-base">
              {artistT.description}
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
              placeholder={artistT.descriptionPlaceholder}
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
              disabled={isPending}
              className="text-base"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isPending || labelsLoading}
              className="text-base"
            >
              {isPending ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {isEditMode
                    ? (language === "ko" ? "수정 중..." : "Updating...")
                    : (language === "ko" ? "생성 중..." : "Creating...")}
                </>
              ) : isEditMode ? (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  {language === "ko" ? "수정" : "Update"}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {artistT.create}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Backwards compatibility export
export { ArtistModal as AddArtistModal };
