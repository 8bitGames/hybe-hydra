"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useFastCut } from "@/lib/stores/fast-cut-context";
import { fastCutApi, AudioMatch } from "@/lib/fast-cut-api";
import { useToast } from "@/components/ui/toast";
import { WorkflowHeader, WorkflowFooter } from "@/components/workflow/WorkflowHeader";
import { FastCutMusicStep } from "@/components/features/create/fast-cut/FastCutMusicStep";
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

  // State for skip confirmation dialog
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Allow proceeding if audio selected, music skipped, OR music is still matching (will show confirmation)
  const canProceed = selectedAudio !== null || musicSkipped || matchingMusic;

  const handleNext = () => {
    // If music is still matching and no audio selected, show confirmation
    if (matchingMusic && !selectedAudio && !musicSkipped) {
      setShowSkipConfirm(true);
      return;
    }
    if (canProceed) {
      router.push("/fast-cut/effects");
    }
  };

  const handleConfirmSkip = () => {
    setShowSkipConfirm(false);
    handleSkipMusic();
    router.push("/fast-cut/effects");
  };

  const handleBack = () => {
    router.push("/fast-cut/images");
  };

  if (!scriptData || selectedImages.length < 3) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col flex-1 min-h-0">
        <WorkflowHeader contentType="fast-cut" />

        <div className="flex-1 overflow-auto p-6 min-h-0">
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

        <WorkflowFooter
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

        {/* Skip Music Confirmation Dialog */}
        <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === "ko"
                  ? "음악 매칭이 진행 중입니다"
                  : "Music matching in progress"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === "ko"
                  ? "음악 추천을 기다리지 않고 다음 단계로 넘어가시겠습니까? 음악 없이 영상이 생성됩니다."
                  : "Do you want to proceed without waiting for music recommendations? The video will be generated without music."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {language === "ko" ? "기다리기" : "Wait"}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmSkip}>
                {language === "ko" ? "넘어가기" : "Skip"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
