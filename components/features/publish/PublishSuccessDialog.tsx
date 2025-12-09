"use client";

import { Check, Sparkles, CalendarCheck, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProcessingVideo } from "@/lib/stores/workflow-store";
import { useI18n } from "@/lib/i18n";

interface PublishContextInfo {
  accountId: string;
  accountName: string;
  caption: string;
  hashtags: string[];
}

interface PublishSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  publishedCount: number;
  videos: ProcessingVideo[];
  publishContext: PublishContextInfo;
  onCreateVariations: () => void;
  onViewSchedule: () => void;
  onStartNew: () => void;
}

export function PublishSuccessDialog({
  isOpen,
  onClose,
  publishedCount,
  videos,
  publishContext,
  onCreateVariations,
  onViewSchedule,
  onStartNew,
}: PublishSuccessDialogProps) {
  const { t, translate } = useI18n();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="text-center py-4">
          {/* Success Icon */}
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>

          {/* Title */}
          <DialogTitle className="text-xl font-semibold mb-2">
            {t.publish.variation.successTitle}
          </DialogTitle>

          {/* Description */}
          <p className="text-neutral-500 mb-6">
            {translate("publish.variation.successDescription", { count: publishedCount })}
          </p>

          {/* Account Info Badge */}
          {publishContext.accountName && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-full text-sm text-neutral-600 mb-6">
              <span>@{publishContext.accountName}</span>
              {publishContext.hashtags.length > 0 && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-400 truncate max-w-[150px]">
                    {publishContext.hashtags.slice(0, 2).map(tag =>
                      tag.startsWith("#") ? tag : `#${tag}`
                    ).join(" ")}
                    {publishContext.hashtags.length > 2 && "..."}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Main CTA: Create Variations */}
          <Button
            onClick={onCreateVariations}
            className="w-full mb-4 h-14 bg-black hover:bg-neutral-800"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">
                  {t.publish.variation.createMoreVariations}
                </div>
                <div className="text-xs text-neutral-300">
                  {t.publish.variation.aiGeneratesNewStyles}
                </div>
              </div>
            </div>
          </Button>

          {/* Secondary Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onViewSchedule}
              className="flex-1"
            >
              <CalendarCheck className="w-4 h-4 mr-2" />
              {t.publish.variation.viewSchedule}
            </Button>
            <Button
              variant="ghost"
              onClick={onStartNew}
              className="flex-1"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              {t.publish.variation.newProject}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
