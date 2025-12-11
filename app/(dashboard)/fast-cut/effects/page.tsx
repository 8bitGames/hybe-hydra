"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useFastCut } from "@/lib/stores/fast-cut-context";
import { useSessionStore } from "@/lib/stores/session-store";
import { useShallow } from "zustand/react/shallow";
import { fastCutApi } from "@/lib/fast-cut-api";
import { useToast } from "@/components/ui/toast";
import { WorkflowHeader, WorkflowFooter } from "@/components/workflow/WorkflowHeader";
import { FastCutEffectStep } from "@/components/features/create/fast-cut/FastCutEffectStep";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { useProcessingSessionStore } from "@/lib/stores/processing-session-store";

export default function FastCutEffectsPage() {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

  // Session store for persisting Fast Cut data
  const { setStageData, proceedToStage, activeSession } = useSessionStore(
    useShallow((state) => ({
      setStageData: state.setStageData,
      proceedToStage: state.proceedToStage,
      activeSession: state.activeSession,
    }))
  );

  const {
    scriptData,
    setScriptData,
    selectedImages,
    selectedAudio,
    musicSkipped,
    aspectRatio,
    styleSetId,
    setStyleSetId,
    styleSets,
    tiktokSEO,
    setTiktokSEO,
    rendering,
    setRendering,
    generationId,
    campaignId,
    prompt,
    editableKeywords,
    audioStartTime,
    setError,
    isHydrated,
  } = useFastCut();

  // Processing session store
  const initSession = useProcessingSessionStore((state) => state.initSession);
  const updateOriginalVideo = useProcessingSessionStore((state) => state.updateOriginalVideo);

  // Redirect if prerequisites not met (only after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    if (!scriptData) {
      router.replace("/fast-cut/script");
    } else if (selectedImages.length < 3) {
      router.replace("/fast-cut/images");
    } else if (!selectedAudio && !musicSkipped) {
      router.replace("/fast-cut/music");
    }
  }, [isHydrated, scriptData, selectedImages, selectedAudio, musicSkipped, router]);

  const handleStartRender = async () => {
    const hasValidMusicChoice = selectedAudio !== null || musicSkipped;
    if (!hasValidMusicChoice || selectedImages.length < 3 || !generationId || !scriptData) {
      setError(language === "ko" ? "최소 3개의 이미지가 필요합니다" : "At least 3 images required");
      return;
    }

    setRendering(true);
    setError(null);

    try {
      // Proxy images first
      const proxyResult = await fastCutApi.proxyImages(
        generationId,
        selectedImages.map((img) => ({ url: img.sourceUrl, id: img.id }))
      );

      if (proxyResult.successful < 3) {
        setError(`Image upload failed: ${proxyResult.failed} failed. Need at least 3 images.`);
        setRendering(false);
        return;
      }

      const imageUrlMap = new Map(
        proxyResult.results
          .filter((r) => r.success)
          .map((r) => [r.id, r.minioUrl])
      );

      const proxiedImages = selectedImages
        .filter((img) => imageUrlMap.has(img.id))
        .map((img, idx) => ({
          url: imageUrlMap.get(img.id)!,
          order: idx,
        }));

      // Start render
      const renderResult = await fastCutApi.startRender({
        generationId,
        campaignId: campaignId || "",
        audioAssetId: selectedAudio?.id || "",
        images: proxiedImages,
        script: { lines: scriptData.script.lines },
        styleSetId,
        aspectRatio,
        targetDuration: 0,
        audioStartTime: musicSkipped ? 0 : audioStartTime,
        prompt,
        searchKeywords: editableKeywords,
        tiktokSEO: tiktokSEO || undefined,
      });

      toast.success(
        language === "ko" ? "생성 시작" : "Generation started",
        language === "ko" ? "영상 생성이 시작되었습니다" : "Video generation has started"
      );

      // Initialize processing session with GENERATING state
      console.log("[FastCut Effects] Initializing processing session...");
      console.log("[FastCut Effects] renderResult:", renderResult);

      // Initialize the session
      initSession({
        campaignId: campaignId || "",
        campaignName: "Fast Cut Video",
        content: {
          script: scriptData.script.lines.map(l => l.text).join("\n"),
          images: selectedImages
            .filter((img) => imageUrlMap.has(img.id))
            .map((img) => ({
              id: img.id,
              url: imageUrlMap.get(img.id)!,
              thumbnailUrl: imageUrlMap.get(img.id)!,
            })),
          musicTrack: selectedAudio ? {
            id: selectedAudio.id,
            name: selectedAudio.filename || "Selected Track",
            duration: selectedAudio.duration || 0,
            url: selectedAudio.s3Url || "",
          } : undefined,
          effectPreset: styleSetId ? {
            id: styleSetId,
            name: styleSetId,
          } : undefined,
        },
        contentType: "fast-cut", // Fast Cut workflow
      });

      // Update with render ID so polling can work
      updateOriginalVideo({
        id: renderResult.jobId,
        status: "generating",
        progress: 0,
        currentStep: language === "ko" ? "준비 중..." : "Preparing...",
      });

      console.log("[FastCut Effects] Session initialized, navigating to /processing");

      // Save effects stage data and proceed to render stage
      if (activeSession) {
        setStageData("effects", {
          styleSetId,
          styleSets,
        });
        await proceedToStage("render");
      }

      // Navigate to processing page
      router.push("/processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render failed");
    } finally {
      setRendering(false);
    }
  };

  const handleBack = () => {
    router.push("/fast-cut/music");
  };

  // Check prerequisites
  const prerequisitesMet =
    scriptData &&
    selectedImages.length >= 3 &&
    (selectedAudio !== null || musicSkipped);

  // Show nothing while hydrating or if prerequisites not met
  if (!isHydrated || !prerequisitesMet) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col flex-1 min-h-0">
        <WorkflowHeader contentType="fast-cut" />

        <div className="flex-1 overflow-auto p-6 min-h-0">
          <div className="max-w-3xl mx-auto">
            <FastCutEffectStep
              scriptData={scriptData}
              setScriptData={setScriptData}
              selectedImages={selectedImages}
              selectedAudio={selectedAudio}
              musicSkipped={musicSkipped}
              aspectRatio={aspectRatio}
              styleSetId={styleSetId}
              setStyleSetId={setStyleSetId}
              styleSets={styleSets}
              tiktokSEO={tiktokSEO}
              setTiktokSEO={setTiktokSEO}
              rendering={rendering}
              onStartRender={handleStartRender}
            />
          </div>
        </div>

        <WorkflowFooter
          onBack={handleBack}
          canProceed={false}
          contentType="fast-cut"
          actionButton={{
            label: language === "ko" ? "영상 생성" : "Generate Video",
            onClick: handleStartRender,
            disabled: rendering,
            loading: rendering,
            icon: <Sparkles className="h-4 w-4" />,
          }}
        />
      </div>
    </TooltipProvider>
  );
}
