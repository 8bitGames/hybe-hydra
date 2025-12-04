"use client";

import React, { useState, useCallback } from "react";
import { useWorkflowStore, StashedPrompt } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Clock,
  Trash2,
  RotateCcw,
  Sparkles,
  Lightbulb,
  Wand2,
  X,
} from "lucide-react";

interface StashedPromptsPanelProps {
  currentPrompt?: string;
  currentMetadata?: {
    aspectRatio?: string;
    duration?: string;
    style?: string;
    ideaTitle?: string;
    campaignName?: string;
    hashtags?: string[];
    // Extended metadata from analyze/create pages
    campaignId?: string;
    selectedIdea?: unknown;
    keywords?: string[];
    performanceMetrics?: unknown;
    savedInspiration?: Array<{ id: string; thumbnailUrl?: string | null; stats?: unknown }>;
    targetAudience?: string | string[];
    contentGoals?: string[];
    aiInsights?: unknown;
  };
  source: "analyze" | "create" | "personalize";
  onRestore?: (prompt: string, metadata: StashedPrompt["metadata"]) => void;
  className?: string;
  collapsed?: boolean;
}

function getSourceIcon(source: StashedPrompt["source"]) {
  switch (source) {
    case "analyze":
      return Lightbulb;
    case "create":
      return Sparkles;
    case "personalize":
      return Wand2;
    default:
      return Bookmark;
  }
}

function getSourceLabel(source: StashedPrompt["source"], isKorean: boolean) {
  switch (source) {
    case "analyze":
      return isKorean ? "분석" : "Analyze";
    case "create":
      return isKorean ? "생성" : "Create";
    case "personalize":
      return isKorean ? "개인화" : "Personalize";
    default:
      return source;
  }
}

function formatTimeAgo(dateString: string, isKorean: boolean): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return isKorean ? "방금 전" : "Just now";
  if (diffMins < 60) return isKorean ? `${diffMins}분 전` : `${diffMins}m ago`;
  if (diffHours < 24) return isKorean ? `${diffHours}시간 전` : `${diffHours}h ago`;
  if (diffDays < 7) return isKorean ? `${diffDays}일 전` : `${diffDays}d ago`;
  return date.toLocaleDateString(isKorean ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
}

export function StashedPromptsPanel({
  currentPrompt,
  currentMetadata,
  source,
  onRestore,
  className,
  collapsed = true,
}: StashedPromptsPanelProps) {
  const { language } = useI18n();
  const isKorean = language === "ko";
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    stashedPrompts,
    stashPrompt,
    restoreStashedPrompt,
    removeStashedPrompt,
  } = useWorkflowStore(
    useShallow((state) => ({
      stashedPrompts: state.stashedPrompts,
      stashPrompt: state.stashPrompt,
      restoreStashedPrompt: state.restoreStashedPrompt,
      removeStashedPrompt: state.removeStashedPrompt,
    }))
  );

  // Handle stash current prompt
  const handleStashCurrent = useCallback(() => {
    if (!currentPrompt || currentPrompt.trim().length === 0) return;

    // Generate a title from the prompt (first 30 chars)
    const title =
      currentPrompt.slice(0, 40).trim() + (currentPrompt.length > 40 ? "..." : "");

    stashPrompt({
      prompt: currentPrompt,
      title,
      source,
      metadata: (currentMetadata || {}) as StashedPrompt["metadata"],
    });
  }, [currentPrompt, currentMetadata, source, stashPrompt]);

  // Handle restore
  const handleRestore = useCallback(
    (stashed: StashedPrompt) => {
      if (onRestore) {
        onRestore(stashed.prompt, stashed.metadata);
      } else {
        restoreStashedPrompt(stashed.id);
      }
    },
    [onRestore, restoreStashedPrompt]
  );

  // Handle delete
  const handleDelete = useCallback(
    (id: string) => {
      removeStashedPrompt(id);
      setDeleteConfirmId(null);
    },
    [removeStashedPrompt]
  );

  const canStash = currentPrompt && currentPrompt.trim().length > 0;

  return (
    <div className={cn("border border-neutral-200 rounded-lg bg-white", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">
                {isKorean ? "저장된 프롬프트" : "Saved Prompts"}
              </span>
              {stashedPrompts.length > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-neutral-100">
                  {stashedPrompts.length}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-neutral-400 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-neutral-200">
            {/* Save Current Button */}
            {canStash && (
              <div className="p-3 border-b border-neutral-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStashCurrent}
                  className="w-full border-neutral-300 text-neutral-700"
                >
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  {isKorean ? "현재 프롬프트 저장" : "Save Current Prompt"}
                </Button>
              </div>
            )}

            {/* Stashed Prompts List */}
            {stashedPrompts.length === 0 ? (
              <div className="p-6 text-center">
                <Bookmark className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">
                  {isKorean
                    ? "저장된 프롬프트가 없습니다"
                    : "No saved prompts"}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  {isKorean
                    ? "프롬프트를 저장하면 나중에 다시 사용할 수 있습니다"
                    : "Save prompts to reuse them later"}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="divide-y divide-neutral-100">
                  {stashedPrompts.map((stashed) => {
                    const SourceIcon = getSourceIcon(stashed.source);
                    return (
                      <div
                        key={stashed.id}
                        className="p-3 hover:bg-neutral-50 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          {/* Icon */}
                          <div className="w-7 h-7 rounded bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                            <SourceIcon className="h-3.5 w-3.5 text-neutral-500" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className="text-[9px] border-neutral-200 text-neutral-500"
                              >
                                {getSourceLabel(stashed.source, isKorean)}
                              </Badge>
                              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTimeAgo(stashed.createdAt, isKorean)}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-700 line-clamp-2 leading-snug">
                              {stashed.prompt}
                            </p>
                            {stashed.metadata.hashtags && stashed.metadata.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {stashed.metadata.hashtags.slice(0, 3).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] text-neutral-400"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                {stashed.metadata.hashtags.length > 3 && (
                                  <span className="text-[10px] text-neutral-400">
                                    +{stashed.metadata.hashtags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-neutral-500 hover:text-neutral-900"
                              onClick={() => handleRestore(stashed)}
                              title={isKorean ? "복원" : "Restore"}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-neutral-400 hover:text-red-600"
                              onClick={() => setDeleteConfirmId(stashed.id)}
                              title={isKorean ? "삭제" : "Delete"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isKorean ? "프롬프트 삭제" : "Delete Prompt"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isKorean
                ? "이 저장된 프롬프트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
                : "Are you sure you want to delete this saved prompt? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {isKorean ? "취소" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {isKorean ? "삭제" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Compact version for inline use
export function StashedPromptsInline({
  currentPrompt,
  currentMetadata,
  source,
  onRestore,
}: Omit<StashedPromptsPanelProps, "className" | "collapsed">) {
  const { language } = useI18n();
  const isKorean = language === "ko";
  const [showAll, setShowAll] = useState(false);

  const { stashedPrompts, stashPrompt, restoreStashedPrompt } = useWorkflowStore(
    useShallow((state) => ({
      stashedPrompts: state.stashedPrompts,
      stashPrompt: state.stashPrompt,
      restoreStashedPrompt: state.restoreStashedPrompt,
    }))
  );

  const handleStashCurrent = useCallback(() => {
    if (!currentPrompt || currentPrompt.trim().length === 0) return;
    const title =
      currentPrompt.slice(0, 40).trim() + (currentPrompt.length > 40 ? "..." : "");
    stashPrompt({
      prompt: currentPrompt,
      title,
      source,
      metadata: (currentMetadata || {}) as StashedPrompt["metadata"],
    });
  }, [currentPrompt, currentMetadata, source, stashPrompt]);

  const handleRestore = useCallback(
    (stashed: StashedPrompt) => {
      if (onRestore) {
        onRestore(stashed.prompt, stashed.metadata);
      } else {
        restoreStashedPrompt(stashed.id);
      }
      setShowAll(false);
    },
    [onRestore, restoreStashedPrompt]
  );

  const canStash = currentPrompt && currentPrompt.trim().length > 0;
  const displayPrompts = showAll ? stashedPrompts : stashedPrompts.slice(0, 3);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Stash button */}
      {canStash && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStashCurrent}
          className="h-7 px-2 text-xs text-neutral-500 hover:text-neutral-900"
        >
          <BookmarkPlus className="h-3 w-3 mr-1" />
          {isKorean ? "저장" : "Save"}
        </Button>
      )}

      {/* Saved prompts chips */}
      {stashedPrompts.length > 0 && (
        <>
          <div className="h-4 w-px bg-neutral-200" />
          {displayPrompts.map((stashed) => (
            <button
              key={stashed.id}
              onClick={() => handleRestore(stashed)}
              className="h-7 px-2.5 text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-full transition-colors truncate max-w-[120px]"
              title={stashed.prompt}
            >
              {stashed.title}
            </button>
          ))}
          {stashedPrompts.length > 3 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="h-7 px-2 text-xs text-neutral-500 hover:text-neutral-700"
            >
              +{stashedPrompts.length - 3}
            </button>
          )}
          {showAll && stashedPrompts.length > 3 && (
            <button
              onClick={() => setShowAll(false)}
              className="h-7 px-2 text-xs text-neutral-500 hover:text-neutral-700"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
