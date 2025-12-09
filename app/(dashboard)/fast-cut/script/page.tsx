"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useShallow } from "zustand/react/shallow";
import { useFastCut } from "@/lib/stores/fast-cut-context";
import { fastCutApi } from "@/lib/fast-cut-api";
import { useToast } from "@/components/ui/toast";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";
import { FastCutScriptStep } from "@/components/features/create/fast-cut/FastCutScriptStep";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { ArrowRight } from "lucide-react";

export default function FastCutScriptPage() {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

  const { analyze } = useWorkflowStore(
    useShallow((state) => ({
      analyze: state.analyze,
    }))
  );

  const {
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    editableKeywords,
    setEditableKeywords,
    selectedSearchKeywords,
    setSelectedSearchKeywords,
    generatingScript,
    setGeneratingScript,
    scriptData,
    setScriptData,
    tiktokSEO,
    setTiktokSEO,
    campaignId,
    campaignName,
    setCampaignId,
    setGenerationId,
    setStyleSetId,
    setError,
  } = useFastCut();

  // Dialog state
  const [showKeywordSuggestionDialog, setShowKeywordSuggestionDialog] = useState(false);
  const [keywordPopoverOpen, setKeywordPopoverOpen] = useState(false);

  // Get or create campaign ID
  const effectiveCampaignId = campaignId || analyze.campaignId || `campaign-${Date.now()}`;
  if (!campaignId && effectiveCampaignId) {
    setCampaignId(effectiveCampaignId);
  }

  // Handle script generation
  const handleGenerateScript = async () => {
    if (!prompt.trim()) {
      setError(language === "ko" ? "프롬프트를 입력하세요" : "Please enter a prompt");
      return;
    }

    // Check if no keywords are selected
    if (selectedSearchKeywords.size === 0) {
      setShowKeywordSuggestionDialog(true);
      return;
    }

    await executeScriptGeneration();
  };

  const executeScriptGeneration = async () => {
    setError(null);
    setGeneratingScript(true);

    try {
      const result = await fastCutApi.generateScript({
        campaignId: effectiveCampaignId,
        artistName: analyze.campaignName || campaignName || "Artist",
        trendKeywords: editableKeywords,
        userPrompt: prompt.trim(),
        targetDuration: 0,
        language,
      });

      setScriptData(result);
      if (result.tiktokSEO) {
        setTiktokSEO(result.tiktokSEO);
      }

      // Auto-select style set based on prompt
      fastCutApi.selectStyleSet(prompt.trim(), { useAI: true, campaignId: effectiveCampaignId })
        .then((selection) => {
          setStyleSetId(selection.selected.id);
        })
        .catch((err) => {
          console.warn("[FastCut] Style set auto-selection failed:", err);
        });

      // Merge AI keywords with user keywords
      const aiKeywords = (result.searchKeywords || []).filter(
        (kw) => !editableKeywords.some(
          (existing) => existing.toLowerCase() === kw.toLowerCase()
        )
      );
      const mergedKeywords = [...editableKeywords, ...aiKeywords];
      setEditableKeywords(mergedKeywords);

      // Generate ID for this fast cut session
      const newGenerationId = `compose-${Date.now()}`;
      setGenerationId(newGenerationId);

      toast.success(
        language === "ko" ? "스크립트 생성 완료" : "Script generated",
        language === "ko" ? "다음 단계로 이동하세요" : "Proceed to next step"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script generation failed");
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleKeywordSuggestionConfirm = async () => {
    setShowKeywordSuggestionDialog(false);
    await executeScriptGeneration();
  };

  const handleKeywordSuggestionCancel = () => {
    setShowKeywordSuggestionDialog(false);
    setKeywordPopoverOpen(true);
  };

  const canProceed = scriptData !== null;

  const handleNext = () => {
    if (canProceed) {
      router.push("/fast-cut/images");
    }
  };

  const handleBack = () => {
    router.push("/start");
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <WorkflowHeader
          onBack={handleBack}
          onNext={handleNext}
          canProceed={canProceed}
          contentType="fast-cut"
          actionButton={{
            label: language === "ko" ? "이미지 단계" : "Images Step",
            onClick: handleNext,
            disabled: !canProceed,
            icon: <ArrowRight className="h-4 w-4" />,
          }}
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <FastCutScriptStep
              prompt={prompt}
              setPrompt={setPrompt}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              editableKeywords={editableKeywords}
              setEditableKeywords={setEditableKeywords}
              selectedSearchKeywords={selectedSearchKeywords}
              setSelectedSearchKeywords={setSelectedSearchKeywords}
              generatingScript={generatingScript}
              scriptData={scriptData}
              tiktokSEO={tiktokSEO}
              setTiktokSEO={setTiktokSEO}
              onGenerateScript={handleGenerateScript}
              keywordPopoverOpen={keywordPopoverOpen}
              onKeywordPopoverOpenChange={setKeywordPopoverOpen}
            />
          </div>
        </div>

        {/* Keyword Suggestion Dialog */}
        <AlertDialog open={showKeywordSuggestionDialog} onOpenChange={setShowKeywordSuggestionDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === "ko" ? "검색 키워드 없음" : "No Search Keywords"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === "ko"
                  ? "검색 키워드가 선택되지 않았습니다. AI가 프롬프트 기반으로 최적의 키워드를 자동 생성하여 이미지를 검색할까요?"
                  : "No search keywords selected. Would you like AI to auto-generate optimal keywords based on your prompt for image search?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleKeywordSuggestionCancel}>
                {language === "ko" ? "직접 추가하기" : "Add Manually"}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleKeywordSuggestionConfirm}>
                {language === "ko" ? "AI 키워드로 진행" : "Use AI Keywords"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
