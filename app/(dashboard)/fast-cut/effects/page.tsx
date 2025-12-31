"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useAssets } from "@/lib/queries";
import type { LyricsData } from "@/lib/subtitle-styles";


// Dummy test lyrics for testing without actual audio lyrics
const DUMMY_TEST_LYRICS: LyricsData = {
  segments: [
    { text: "Test line 1", start: 0, end: 2 },
    { text: "Test line 2", start: 2, end: 4 },
    { text: "Test line 3", start: 4, end: 6 },
    { text: "Test line 4", start: 6, end: 8 },
    { text: "Test line 5", start: 8, end: 10 },
    { text: "Test line 6", start: 10, end: 12 },
    { text: "Test line 7", start: 12, end: 14 },
  ]
};

export default function FastCutEffectsPage() {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

  // Subtitle display mode state
  const [subtitleDisplayMode, setSubtitleDisplayMode] = useState<"sequential" | "static">("sequential");

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
          console.log("[FastCut Effects] Loading session from URL:", sessionIdFromUrl);
          await loadSession(sessionIdFromUrl);
        } catch (error) {
          console.error("[FastCut Effects] Failed to load session from URL:", error);
        }
      }
    };
    loadSessionFromUrl();
  }, [activeSession, sessionIdFromUrl, loadSession]);

  const {
    scriptData,
    setScriptData,
    hasSceneAnalysis,
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
    videoDuration,
    setError,
    isHydrated,
    subtitleMode,
    audioLyricsText,
  } = useFastCut();

  // Processing session store
  const initSession = useProcessingSessionStore((state) => state.initSession);
  const updateOriginalVideo = useProcessingSessionStore((state) => state.updateOriginalVideo);

  // Fetch audio assets to get lyrics data
  const { data: audioAssetsData } = useAssets(campaignId || "", {
    type: "audio",
    page_size: 100,
  });

  // Get lyrics data from selected audio asset's metadata
  const selectedAudioLyrics = useMemo((): LyricsData => {
    if (!selectedAudio || !audioAssetsData?.items) {
      console.log("[FastCut] No audio selected, using DUMMY_TEST_LYRICS"); return DUMMY_TEST_LYRICS;
    }

    const fullAsset = audioAssetsData.items.find(
      (asset) => asset.id === selectedAudio.id
    );

    if (!fullAsset?.metadata) {
      console.log("[FastCut] No metadata, using DUMMY_TEST_LYRICS"); return DUMMY_TEST_LYRICS;
    }

    const metadata = fullAsset.metadata as Record<string, unknown>;
    const lyrics = metadata.lyrics as LyricsData | undefined;

    if (lyrics && Array.isArray(lyrics.segments) && lyrics.segments.length > 0) {
      return lyrics;
    }

    console.log("[FastCut] No lyrics, using DUMMY_TEST_LYRICS");
    return DUMMY_TEST_LYRICS;
  }, [selectedAudio, audioAssetsData]);

  // Check if we have valid data (from script step OR scene analysis from Start page)
  const hasValidData = scriptData !== null || hasSceneAnalysis;

  // Redirect if prerequisites not met (only after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    if (!hasValidData) {
      router.replace("/start");
    } else if (selectedImages.length < 3) {
      router.replace("/fast-cut/images");
    } else if (!selectedAudio && !musicSkipped) {
      router.replace("/fast-cut/music");
    }
  }, [isHydrated, hasValidData, selectedImages, selectedAudio, musicSkipped, router]);

  const handleStartRender = async () => {
    const hasValidMusicChoice = selectedAudio !== null || musicSkipped;
    const hasLyricsContent = subtitleMode === "lyrics" && selectedAudioLyrics?.segments?.length;
    // Allow rendering without scriptData if we have scene analysis (skip script step flow) OR if using lyrics mode
    if (!hasValidMusicChoice || selectedImages.length < 3 || !generationId || (!scriptData && !hasSceneAnalysis && !hasLyricsContent)) {
      setError(language === "ko" ? "최소 3개의 이미지가 필요합니다" : "At least 3 images required");
      return;
    }

    // Create displayScript and scriptLines based on subtitle mode
    // When in lyrics mode, use lyrics data; otherwise use script data
    let displayScript = "";
    let scriptLines: { text: string; timing: number; duration: number }[] = [];

    if (subtitleMode === "lyrics" && selectedAudioLyrics?.segments?.length) {
      // Use lyrics for display and convert to script lines format
      displayScript = selectedAudioLyrics.segments.map(s => s.text).join("\n");
      // Convert lyrics segments to script lines format for render API
      scriptLines = selectedAudioLyrics.segments.map((segment) => {
        const adjustedStart = Math.max(0, segment.start - (musicSkipped ? 0 : audioStartTime));
        const adjustedEnd = Math.max(0, segment.end - (musicSkipped ? 0 : audioStartTime));
        const duration = adjustedEnd - adjustedStart;
        return {
          text: segment.text,
          timing: adjustedStart,
          duration: Math.max(0.5, duration),
        };
      }).filter(line => line.timing < (videoDuration || 15) && line.duration > 0);
    } else {
      // Use script data (fallback for scene analysis flow)
      scriptLines = scriptData?.script?.lines || [];
      displayScript = scriptLines.length > 0
        ? scriptLines.map(l => l.text).join("\n")
        : "";
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
      console.log("[FastCut Effects] 🎤 Subtitle mode:", subtitleMode, "→ useAudioLyrics:", subtitleMode === "lyrics");
      console.log("[FastCut Effects] 📏 Video duration:", videoDuration, "s");
      console.log("[FastCut Effects] 📝 Script lines count:", scriptLines.length);
      const renderResult = await fastCutApi.startRender({
        generationId,
        campaignId: campaignId || "",
        audioAssetId: selectedAudio?.id || "",
        images: proxiedImages,
        script: { lines: scriptLines },
        styleSetId,
        aspectRatio,
        targetDuration: videoDuration || 15,
        audioStartTime: musicSkipped ? 0 : audioStartTime,
        prompt,
        searchKeywords: editableKeywords,
        tiktokSEO: tiktokSEO || undefined,
        useAudioLyrics: subtitleMode === "lyrics",
        subtitleDisplayMode,
      });

      toast.success(
        language === "ko" ? "생성 시작" : "Generation started",
        language === "ko" ? "영상 생성이 시작되었습니다" : "Video generation has started"
      );

      // Initialize processing session with GENERATING state
      console.log("[FastCut Effects] Initializing processing session...");
      console.log("[FastCut Effects] renderResult:", renderResult);

      // Initialize the session
      // Use selected subtitles from scriptData.script.lines (what actually appears in video)
      // displayScript is already defined at the start of this function

      console.log("[FastCut Effects] 🎤 initSession script source:", {
        subtitleMode,
        hasLyricsSegments: !!selectedAudioLyrics?.segments?.length,
        usingLyrics: subtitleMode === "lyrics" && !!selectedAudioLyrics?.segments?.length,
        scriptLinesCount: scriptLines.length,
        scriptPreview: displayScript.substring(0, 100),
      });

      initSession({
        campaignId: campaignId || "",
        campaignName: "Fast Cut Video",
        content: {
          script: displayScript,
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
            startTime: audioStartTime || 0,
            url: selectedAudio.s3Url || "",
          } : undefined,
          effectPreset: styleSetId ? {
            id: styleSetId,
            name: styleSetId,
          } : undefined,
        },
        contentType: "fast-cut", // Fast Cut workflow
        // Use activeSession?.id OR sessionIdFromUrl as fallback (loadSession is async)
        databaseSessionId: activeSession?.id || sessionIdFromUrl || undefined,
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
      // Ensure we have a session loaded before updating stage
      if (!activeSession && sessionIdFromUrl) {
        try {
          console.log("[FastCut Effects] Loading session before proceeding:", sessionIdFromUrl);
          await loadSession(sessionIdFromUrl);
        } catch (error) {
          console.error("[FastCut Effects] Failed to load session:", error);
        }
      }

      // Get the latest activeSession from the store (after loadSession completes)
      const currentSession = useSessionStore.getState().activeSession;

      if (currentSession) {
        setStageData("effects", {
          styleSetId,
          styleSets,
        });
        await proceedToStage("render");
        console.log("[FastCut Effects] Stage updated to render for session:", currentSession.id);
      } else {
        console.warn("[FastCut Effects] No session available, stage not updated");
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
    const sessionParam = activeSession?.id || sessionIdFromUrl ? `?session=${activeSession?.id || sessionIdFromUrl}` : "";
    router.push(`/fast-cut/music${sessionParam}`);
  };

  // Check prerequisites - allow either scriptData OR scene analysis (from Start page skip flow)
  const prerequisitesMet =
    hasValidData &&
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
              videoDuration={videoDuration}
              subtitleMode={subtitleMode}
              lyricsData={selectedAudioLyrics}
              audioStartTime={audioStartTime}
              subtitleDisplayMode={subtitleDisplayMode}
              setSubtitleDisplayMode={setSubtitleDisplayMode}
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
