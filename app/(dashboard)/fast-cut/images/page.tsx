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
import { FastCutAIImageStep } from "@/components/features/create/fast-cut/FastCutAIImageStep";
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
    setGenerationId,
    scriptData,
    hasSceneAnalysis,
    setError,
    isHydrated,
    // AI image generation mode
    imageSourceMode,
    aiGeneratedImages,
    setAiGeneratedImages,
    aiImageGlobalStyle,
    setAiImageGlobalStyle,
    aiImageStyle,
    generatingAiPrompts,
    setGeneratingAiPrompts,
    generatingAiImages,
    setGeneratingAiImages,
  } = useFastCut();

  // Check if we have valid data to proceed (either from script step or scene analysis from Start page)
  // For AI mode, we need scriptData; for search mode, keywords are needed
  const hasValidData = imageSourceMode === "ai_generate"
    ? scriptData !== null
    : (scriptData !== null || hasSceneAnalysis || editableKeywords.length > 0);

  // Redirect if no valid data (only after hydration)
  useEffect(() => {
    if (isHydrated && !hasValidData) {
      console.log("[FastCut Images] No valid data found, redirecting to start page");
      router.replace("/start");
    }
  }, [isHydrated, hasValidData, router]);

  // Generate generationId if we have scene analysis but no generationId (skipped script step)
  useEffect(() => {
    if (isHydrated && hasSceneAnalysis && !generationId) {
      const newGenerationId = `compose-${Date.now()}`;
      console.log("[FastCut Images] Generating ID for scene analysis flow:", newGenerationId);
      setGenerationId(newGenerationId);
    }
  }, [isHydrated, hasSceneAnalysis, generationId, setGenerationId]);

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

  // ===== AI Image Generation Handlers =====

  const handleGeneratePrompts = async () => {
    if (!scriptData) return;

    setGeneratingAiPrompts(true);
    setError(null);

    try {
      const result = await fastCutApi.generateImagePrompts({
        script: scriptData.script,
        style: aiImageStyle,
        language: language as "ko" | "en",
      });

      // Initialize AI generated images array with prompts
      const initialImages = result.scenes.map((scene) => ({
        sceneNumber: scene.sceneNumber,
        scriptText: scene.scriptText,
        imagePrompt: scene.imagePrompt,
        negativePrompt: scene.negativePrompt,
        status: "pending" as const,
      }));

      setAiGeneratedImages(initialImages);

      // Set global style if returned
      if (result.globalStyle) {
        setAiImageGlobalStyle(result.globalStyle);
      }

      toast.success(
        language === "ko" ? "프롬프트 생성 완료" : "Prompts generated",
        language === "ko" ? `${initialImages.length}개 씬 준비됨` : `${initialImages.length} scenes ready`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate prompts");
      toast.error(
        language === "ko" ? "프롬프트 생성 실패" : "Prompt generation failed"
      );
    } finally {
      setGeneratingAiPrompts(false);
    }
  };

  const handleGenerateImages = async () => {
    if (aiGeneratedImages.length === 0) return;

    setGeneratingAiImages(true);
    setError(null);

    // Get scenes that need generation (pending or failed)
    const scenesToGenerate = aiGeneratedImages.filter(
      (img) => img.status === "pending" || img.status === "failed"
    );

    if (scenesToGenerate.length === 0) {
      setGeneratingAiImages(false);
      return;
    }

    // Mark scenes as generating
    setAiGeneratedImages((prev) =>
      prev.map((img) =>
        scenesToGenerate.some((s) => s.sceneNumber === img.sceneNumber)
          ? { ...img, status: "generating" as const }
          : img
      )
    );

    try {
      const result = await fastCutApi.generateImages({
        scenes: scenesToGenerate.map((s) => ({
          sceneNumber: s.sceneNumber,
          imagePrompt: s.imagePrompt!,
          negativePrompt: s.negativePrompt,
        })),
        sessionId: activeSession?.id || sessionIdFromUrl || undefined,
      });

      // Update images with results
      setAiGeneratedImages((prev) =>
        prev.map((img) => {
          const generated = result.images.find((r) => r.sceneNumber === img.sceneNumber);
          if (generated) {
            return {
              ...img,
              status: generated.success ? ("completed" as const) : ("failed" as const),
              imageUrl: generated.imageUrl,
              imageBase64: generated.imageBase64,
              s3Key: generated.s3Key,
              error: generated.error,
            };
          }
          return img;
        })
      );

      const successCount = result.images.filter((img) => img.success).length;
      toast.success(
        language === "ko" ? "이미지 생성 완료" : "Images generated",
        language === "ko"
          ? `${successCount}/${scenesToGenerate.length}개 성공`
          : `${successCount}/${scenesToGenerate.length} succeeded`
      );
    } catch (err) {
      // Mark all generating scenes as failed
      setAiGeneratedImages((prev) =>
        prev.map((img) =>
          img.status === "generating"
            ? { ...img, status: "failed" as const, error: err instanceof Error ? err.message : "Unknown error" }
            : img
        )
      );
      setError(err instanceof Error ? err.message : "Image generation failed");
      toast.error(
        language === "ko" ? "이미지 생성 실패" : "Image generation failed"
      );
    } finally {
      setGeneratingAiImages(false);
    }
  };

  const handleRegenerateImage = async (sceneNumber: number) => {
    const scene = aiGeneratedImages.find((img) => img.sceneNumber === sceneNumber);
    if (!scene || !scene.imagePrompt) return;

    // Mark this scene as generating
    setAiGeneratedImages((prev) =>
      prev.map((img) =>
        img.sceneNumber === sceneNumber ? { ...img, status: "generating" as const } : img
      )
    );

    try {
      const result = await fastCutApi.generateImages({
        scenes: [{
          sceneNumber: scene.sceneNumber,
          imagePrompt: scene.imagePrompt,
          negativePrompt: scene.negativePrompt,
        }],
        sessionId: activeSession?.id || sessionIdFromUrl || undefined,
      });

      const generated = result.images[0];
      setAiGeneratedImages((prev) =>
        prev.map((img) =>
          img.sceneNumber === sceneNumber
            ? {
                ...img,
                status: generated?.success ? ("completed" as const) : ("failed" as const),
                imageUrl: generated?.imageUrl,
                imageBase64: generated?.imageBase64,
                s3Key: generated?.s3Key,
                error: generated?.error,
              }
            : img
        )
      );

      if (generated?.success) {
        toast.success(
          language === "ko" ? "이미지 재생성 완료" : "Image regenerated"
        );
      }
    } catch (err) {
      setAiGeneratedImages((prev) =>
        prev.map((img) =>
          img.sceneNumber === sceneNumber
            ? { ...img, status: "failed" as const, error: err instanceof Error ? err.message : "Unknown error" }
            : img
        )
      );
      toast.error(
        language === "ko" ? "재생성 실패" : "Regeneration failed"
      );
    }
  };

  // Different canProceed logic based on image source mode
  const aiCompletedCount = aiGeneratedImages.filter((img) => img.status === "completed").length;
  const canProceed = imageSourceMode === "ai_generate"
    ? aiCompletedCount >= 3
    : selectedImages.length >= 3;

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
      // Save images stage data based on mode
      if (imageSourceMode === "ai_generate") {
        // AI mode: save AI generated images
        setStageData("images", {
          imageSourceMode,
          aiGeneratedImages,
          aiImageGlobalStyle,
          aiImageStyle,
          generationId,
        });
      } else {
        // Search mode: save selected images (include hasSceneAnalysis for session restoration)
        setStageData("images", {
          imageSourceMode,
          imageCandidates,
          selectedImages,
          generationId,
          hasSceneAnalysis,
        });
      }

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
    // Go back to Start page (since we now skip the script step)
    const sessionParam = activeSession?.id || sessionIdFromUrl ? `?session=${activeSession?.id || sessionIdFromUrl}` : "";
    router.push(`/start${sessionParam}`);
  };

  // Show nothing while hydrating or if prerequisites not met
  if (!isHydrated || !hasValidData) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col flex-1 min-h-0">
        <WorkflowHeader contentType="fast-cut" />

        <div className="flex-1 overflow-auto p-6 min-h-0">
          <div className="max-w-4xl mx-auto">
            {imageSourceMode === "ai_generate" ? (
              <FastCutAIImageStep
                scriptData={scriptData}
                aiGeneratedImages={aiGeneratedImages}
                aiImageGlobalStyle={aiImageGlobalStyle}
                aiImageStyle={aiImageStyle}
                generatingAiPrompts={generatingAiPrompts}
                generatingAiImages={generatingAiImages}
                onGeneratePrompts={handleGeneratePrompts}
                onGenerateImages={handleGenerateImages}
                onRegenerateImage={handleRegenerateImage}
                onNext={handleNext}
              />
            ) : (
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
            )}
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
