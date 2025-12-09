"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useFastCut } from "@/lib/stores/fast-cut-context";
import { fastCutApi, AudioMatch } from "@/lib/fast-cut-api";
import { useToast } from "@/components/ui/toast";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";
import { FastCutMusicStep } from "@/components/features/create/fast-cut/FastCutMusicStep";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrowRight } from "lucide-react";

export default function FastCutMusicPage() {
  const router = useRouter();
  const { language } = useI18n();
  const toast = useToast();

  const {
    scriptData,
    audioMatches,
    setAudioMatches,
    selectedAudio,
    setSelectedAudio,
    audioStartTime,
    setAudioStartTime,
    audioAnalysis,
    setAudioAnalysis,
    matchingMusic,
    setMatchingMusic,
    analyzingAudio,
    setAnalyzingAudio,
    campaignId,
    musicSkipped,
    setMusicSkipped,
    selectedImages,
    setError,
  } = useFastCut();

  // Redirect if no script data or images
  useEffect(() => {
    if (!scriptData) {
      router.replace("/fast-cut/script");
    } else if (selectedImages.length < 3) {
      router.replace("/fast-cut/images");
    }
  }, [scriptData, selectedImages, router]);

  // Auto-match music on mount
  useEffect(() => {
    if (scriptData && audioMatches.length === 0 && !matchingMusic && !musicSkipped) {
      handleMatchMusic();
    }
  }, [scriptData]);

  const handleMatchMusic = async () => {
    if (!scriptData || !campaignId) return;

    setMatchingMusic(true);
    setError(null);

    try {
      const result = await fastCutApi.matchMusic({
        campaignId,
        vibe: scriptData.vibe,
        bpmRange: scriptData.suggestedBpmRange,
        minDuration: 10,
      });

      setAudioMatches(result.matches);
      if (result.matches.length > 0) {
        handleSelectAudio(result.matches[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Music matching failed");
    } finally {
      setMatchingMusic(false);
    }
  };

  const handleSelectAudio = async (audio: AudioMatch) => {
    setSelectedAudio(audio);
    setMusicSkipped(false);
    setAudioAnalysis(null);
    setAudioStartTime(0);
    setAnalyzingAudio(true);

    try {
      const targetDuration = scriptData?.script?.totalDuration || 15;
      const analysis = await fastCutApi.analyzeAudioBestSegment(audio.id, targetDuration);
      setAudioAnalysis(analysis);
      setAudioStartTime(analysis.suggestedStartTime);
    } catch (err) {
      console.warn("Audio analysis failed:", err);
      setAudioStartTime(0);
    } finally {
      setAnalyzingAudio(false);
    }
  };

  const handleSkipMusic = () => {
    setMusicSkipped(true);
    setSelectedAudio(null);
    setAudioAnalysis(null);
    setAudioStartTime(0);
  };

  const handleUnskipMusic = () => {
    setMusicSkipped(false);
    if (scriptData && audioMatches.length === 0) {
      handleMatchMusic();
    }
  };

  const canProceed = selectedAudio !== null || musicSkipped;

  const handleNext = () => {
    if (canProceed) {
      router.push("/fast-cut/effects");
    }
  };

  const handleBack = () => {
    router.push("/fast-cut/images");
  };

  if (!scriptData || selectedImages.length < 3) {
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
            label: language === "ko" ? "효과 단계" : "Effects Step",
            onClick: handleNext,
            disabled: !canProceed,
            icon: <ArrowRight className="h-4 w-4" />,
          }}
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            <FastCutMusicStep
              scriptData={scriptData}
              audioMatches={audioMatches}
              selectedAudio={selectedAudio}
              audioStartTime={audioStartTime}
              audioAnalysis={audioAnalysis}
              matchingMusic={matchingMusic}
              analyzingAudio={analyzingAudio}
              campaignId={campaignId || ""}
              musicSkipped={musicSkipped}
              onSelectAudio={handleSelectAudio}
              onSetAudioStartTime={setAudioStartTime}
              onSkipMusic={handleSkipMusic}
              onUnskipMusic={handleUnskipMusic}
              onNext={handleNext}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
