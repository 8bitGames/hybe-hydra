"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { quickCreateApi } from "@/lib/video-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FolderOpen, Check, AlertCircle } from "lucide-react";
import { CampaignSelector } from "./CampaignSelector";

interface SaveToCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generationId: string;
  onSaved?: () => void;
}

/**
 * Modal to save a Quick Create generation to a campaign
 * Quick Create 영상을 캠페인에 저장하는 모달
 */
export function SaveToCampaignModal({
  open,
  onOpenChange,
  generationId,
  onSaved,
}: SaveToCampaignModalProps) {
  const { language } = useI18n();

  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!selectedCampaignId) {
      setError(
        language === "ko"
          ? "캠페인을 선택해주세요"
          : "Please select a campaign"
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await quickCreateApi.saveToCampaign(
        generationId,
        selectedCampaignId
      );

      if (result.error) {
        setError(result.error.message);
        setSaving(false);
        return;
      }

      setSuccess(true);
      setSaving(false);

      // Call onSaved callback and close after a short delay
      setTimeout(() => {
        onSaved?.();
        // Reset state for next use
        setSuccess(false);
        setSelectedCampaignId("");
      }, 1000);
    } catch {
      setError(
        language === "ko"
          ? "저장 중 오류가 발생했습니다"
          : "An error occurred while saving"
      );
      setSaving(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!saving) {
      onOpenChange(open);
      // Reset state when closing
      if (!open) {
        setError("");
        setSuccess(false);
        setSelectedCampaignId("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {language === "ko" ? "캠페인에 저장" : "Save to Campaign"}
          </DialogTitle>
          <DialogDescription>
            {language === "ko"
              ? "이 영상을 저장할 캠페인을 선택하세요. 저장 후에는 캠페인의 다른 영상들과 함께 관리됩니다."
              : "Select a campaign to save this video. Once saved, it will be managed with other videos in the campaign."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {/* Success State */}
          {success ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg text-green-600">
                {language === "ko" ? "저장 완료!" : "Saved Successfully!"}
              </h3>
              <p className="text-muted-foreground mt-2">
                {language === "ko"
                  ? "영상이 캠페인에 저장되었습니다"
                  : "The video has been saved to the campaign"}
              </p>
            </div>
          ) : (
            <>
              {/* Campaign Selector */}
              <CampaignSelector
                value={selectedCampaignId}
                onChange={setSelectedCampaignId}
              />

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={saving}
                  className="flex-1"
                >
                  {language === "ko" ? "취소" : "Cancel"}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!selectedCampaignId || saving}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Spinner className="h-4 w-4 mr-2" />
                      {language === "ko" ? "저장 중..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {language === "ko" ? "저장" : "Save"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
