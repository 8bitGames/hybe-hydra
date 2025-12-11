"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useFastCut } from "@/lib/stores/fast-cut-context";
import { useSessionStore } from "@/lib/stores/session-store";
import { useShallow } from "zustand/react/shallow";
import { fastCutApi, ImageCandidate } from "@/lib/fast-cut-api";
import { useToast } from "@/components/ui/toast";
import { WorkflowHeader, WorkflowFooter } from "@/components/workflow/WorkflowHeader";
import { FastCutImageStep } from "@/components/features/create/fast-cut/FastCutImageStep";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrowRight } from "lucide-react";

export default function FastCutImagesPage() {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

  // Get session ID from URL
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get("session");

  // Session store for persisting Fast Cut data
  const { setStageData, proceedToStage, activeSession, loadSession } = useSessionStore(
    useShallow((state) => ({
      setStageData: state.setStageData,
      proceedToStage: state.proceedToStage,
      activeSession: state.activeSession,
      loadSession: state.loadSession,
    }))
  );

  // Load session from URL param if not already loaded
  useEffect(() => {
    const loadSessionFromUrl = async () => {
      if (!activeSession && sessionIdFromUrl) {
        try {
          console.log("[FastCut Images] Loading session from URL:", sessionIdFromUrl);
          await loadSession(sessionIdFromUrl);
        } catch (error) {
          console.error("[FastCut Images] Failed to load session from URL:", error);
        }
      }
    };
    loadSessionFromUrl();
  }, [activeSession, sessionIdFromUrl, loadSession]);

  const {
    imageCandidates,
    setImageCandidates,
    selectedImages,
    setSelectedImages,
    searchingImages,
    setSearchingImages,
    editableKeywords,
    setEditableKeywords,
    selectedSearchKeywords,
    setSelectedSearchKeywords,
    generationId,
    scriptData,
    setError,
    isHydrated,
  } = useFastCut();

  // Redirect if no script data (only after hydration)
  useEffect(() => {
    if (isHydrated && !scriptData) {
      router.replace("/fast-cut/script");
    }
  }, [isHydrated, scriptData, router]);

  // Auto-search images on mount if we have keywords and no candidates
  const keywordCount = selectedSearchKeywords?.size ?? 0;
  useEffect(() => {
    if (generationId && keywordCount > 0 && imageCandidates.length === 0 && !searchingImages) {
      handleSearchImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationId, keywordCount]);

  const handleSearchImages = async () => {
    const searchKeywords = Array.from(selectedSearchKeywords);
    if (searchKeywords.length === 0 || !generationId) return;

    setSearchingImages(true);
    setError(null);

    try {
      const result = await fastCutApi.searchImages({
        generationId,
        keywords: searchKeywords,
        maxImages: 30,
        language: language as "ko" | "en",
      });

      setImageCandidates(result.candidates);

      // Auto-select high quality images
      const autoSelected = result.candidates
        .filter((img) => (img.qualityScore || 0) > 0.5)
        .slice(0, Math.min(6, result.candidates.length));

      setSelectedImages(autoSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image search failed");
    } finally {
      setSearchingImages(false);
    }
  };

  const toggleImageSelection = (image: ImageCandidate) => {
    const exists = selectedImages.find((img) => img.id === image.id);
    if (exists) {
      setSelectedImages(selectedImages.filter((img) => img.id !== image.id));
    } else if (selectedImages.length < 10) {
      setSelectedImages([...selectedImages, image]);
    }
  };

  const reorderImages = (newImages: ImageCandidate[]) => {
    setSelectedImages(newImages);
  };

  const handleAddKeyword = (keyword: string) => {
    // Add to editableKeywords and auto-select it
    setEditableKeywords([...editableKeywords, keyword]);
    setSelectedSearchKeywords(new Set([...selectedSearchKeywords, keyword]));
  };

  const canProceed = selectedImages.length >= 3;

  const handleNext = async () => {
    if (!canProceed) return;

    // Ensure we have a session loaded before proceeding
    if (!activeSession && sessionIdFromUrl) {
      try {
        console.log("[FastCut Images] Loading session before proceeding:", sessionIdFromUrl);
        await loadSession(sessionIdFromUrl);
      } catch (error) {
        console.error("[FastCut Images] Failed to load session:", error);
      }
    }

    // Get the latest activeSession from the store (after loadSession completes)
    const currentSession = useSessionStore.getState().activeSession;

    if (currentSession) {
      // Save images stage data
      setStageData("images", {
        imageCandidates,
        selectedImages,
        generationId,
      });

      // Proceed to music stage (saves to DB)
      await proceedToStage("music");
      router.push(`/fast-cut/music?session=${currentSession.id}`);
    } else {
      // No session available, just navigate with URL param if available
      const sessionParam = sessionIdFromUrl ? `?session=${sessionIdFromUrl}` : "";
      router.push(`/fast-cut/music${sessionParam}`);
    }
  };

  const handleBack = () => {
    const sessionParam = activeSession?.id || sessionIdFromUrl ? `?session=${activeSession?.id || sessionIdFromUrl}` : "";
    router.push(`/fast-cut/script${sessionParam}`);
  };

  // Show nothing while hydrating or if prerequisites not met
  if (!isHydrated || !scriptData) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col flex-1 min-h-0">
        <WorkflowHeader contentType="fast-cut" />

        <div className="flex-1 overflow-auto p-6 min-h-0">
          <div className="max-w-4xl mx-auto">
            <FastCutImageStep
              imageCandidates={imageCandidates}
              selectedImages={selectedImages}
              searchingImages={searchingImages}
              editableKeywords={editableKeywords}
              selectedSearchKeywords={selectedSearchKeywords}
              setSelectedSearchKeywords={setSelectedSearchKeywords}
              onToggleSelection={toggleImageSelection}
              onReorderImages={reorderImages}
              onSearchImages={handleSearchImages}
              onAddKeyword={handleAddKeyword}
              onNext={handleNext}
            />
          </div>
        </div>

        <WorkflowFooter
          onBack={handleBack}
          onNext={handleNext}
          canProceed={canProceed}
          contentType="fast-cut"
          actionButton={{
            label: language === "ko" ? "음악 단계" : "Music Step",
            onClick: handleNext,
            disabled: !canProceed,
            icon: <ArrowRight className="h-4 w-4" />,
          }}
        />
      </div>
    </TooltipProvider>
  );
}
