"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useFastCut } from "@/lib/stores/fast-cut-context";
import { fastCutApi, ImageCandidate } from "@/lib/fast-cut-api";
import { useToast } from "@/components/ui/toast";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";
import { FastCutImageStep } from "@/components/features/create/fast-cut/FastCutImageStep";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrowRight } from "lucide-react";

export default function FastCutImagesPage() {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

  const {
    imageCandidates,
    setImageCandidates,
    selectedImages,
    setSelectedImages,
    searchingImages,
    setSearchingImages,
    editableKeywords,
    selectedSearchKeywords,
    setSelectedSearchKeywords,
    generationId,
    scriptData,
    setError,
  } = useFastCut();

  // Redirect if no script data
  useEffect(() => {
    if (!scriptData) {
      router.replace("/fast-cut/script");
    }
  }, [scriptData, router]);

  // Auto-search images on mount if we have keywords and no candidates
  useEffect(() => {
    if (generationId && selectedSearchKeywords.size > 0 && imageCandidates.length === 0 && !searchingImages) {
      handleSearchImages();
    }
  }, [generationId]);

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

  const canProceed = selectedImages.length >= 3;

  const handleNext = () => {
    if (canProceed) {
      router.push("/fast-cut/music");
    }
  };

  const handleBack = () => {
    router.push("/fast-cut/script");
  };

  if (!scriptData) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <WorkflowHeader
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

        <div className="flex-1 overflow-auto p-6">
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
              onNext={handleNext}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
