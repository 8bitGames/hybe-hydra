"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video, Rocket, Upload } from "lucide-react";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";
import {
  useProcessingSessionStore,
  useProcessingSessionHydrated,
  selectSession,
  selectOriginalVideo,
  selectSelectedStyles,
  selectIsGeneratingVariations,
} from "@/lib/stores/processing-session-store";
import { useSessionStore } from "@/lib/stores/session-store";
import { useShallow } from "zustand/react/shallow";
import { fastCutApi, type VariationsBatchStatus } from "@/lib/fast-cut-api";
import {
  GeneratingView,
  ReadyView,
  VariationConfigView,
  CompareApproveView,
} from "./views";

interface ProcessingFlowPageProps {
  className?: string;
}

export function ProcessingFlowPage({ className }: ProcessingFlowPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useI18n();
  const isKorean = language === "ko";

  // Check if store is hydrated from localStorage
  const isHydrated = useProcessingSessionHydrated();

  // Session state from store
  const session = useProcessingSessionStore(selectSession);
  const originalVideo = useProcessingSessionStore(selectOriginalVideo);

  // Store actions
  const initSession = useProcessingSessionStore((state) => state.initSession);
  const setState = useProcessingSessionStore((state) => state.setState);
  const updateOriginalVideo = useProcessingSessionStore((state) => state.updateOriginalVideo);
  const setOriginalVideoCompleted = useProcessingSessionStore((state) => state.setOriginalVideoCompleted);
  const startVariationGeneration = useProcessingSessionStore((state) => state.startVariationGeneration);
  const cancelVariationGeneration = useProcessingSessionStore((state) => state.cancelVariationGeneration);
  const updateVariation = useProcessingSessionStore((state) => state.updateVariation);
  const setVariationCompleted = useProcessingSessionStore((state) => state.setVariationCompleted);
  const setVariationFailed = useProcessingSessionStore((state) => state.setVariationFailed);
  const selectedStyles = useProcessingSessionStore(selectSelectedStyles);
  const isGeneratingVariations = useProcessingSessionStore(selectIsGeneratingVariations);
  const variations = useProcessingSessionStore((state) => state.session?.variations || []);

  // Session store for stage progression (syncs with SessionDashboard)
  const { proceedToStage, activeSession } = useSessionStore(
    useShallow((state) => ({
      proceedToStage: state.proceedToStage,
      activeSession: state.activeSession,
    }))
  );

  // Local state for initialization
  const [isInitializing, setIsInitializing] = useState(true);

  // Polling ref to track interval
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Variation polling refs
  const variationPollingRef = useRef<NodeJS.Timeout | null>(null);
  const variationBatchIdRef = useRef<string | null>(null);

  // Initialize session from URL params or existing session
  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    const campaignId = searchParams.get("campaignId");
    const campaignName = searchParams.get("campaignName");

    // If we have URL params, initialize a new session
    if (sessionId && campaignId) {
      // Check if we already have this session
      if (session?.id !== sessionId) {
        initSession({
          campaignId,
          campaignName: campaignName || "Campaign",
          content: {
            script: searchParams.get("script") || "",
            images: [], // Images would be passed differently
            musicTrack: undefined,
            effectPreset: undefined,
          },
        });
      }
    }

    setIsInitializing(false);
  }, [searchParams, session?.id, initSession]);

  // Poll for generation status when in GENERATING state
  useEffect(() => {
    // Only poll when in GENERATING state and we have a video ID
    if (session?.state !== "GENERATING" || !originalVideo?.id) {
      // Clear any existing polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const pollStatus = async () => {
      try {
        const status = await fastCutApi.getRenderStatus(originalVideo.id);

        // Update progress and current step
        updateOriginalVideo({
          progress: status.progress,
          currentStep: status.currentStep,
        });

        // Handle completion
        if (status.status === "completed" && status.outputUrl) {
          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          // Update video as completed and transition to READY state
          setOriginalVideoCompleted(status.outputUrl);
          setState("READY");
        }

        // Handle failure
        if (status.status === "failed") {
          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          updateOriginalVideo({
            status: "failed",
            currentStep: status.error || "Generation failed",
          });
        }
      } catch (error) {
        console.error("Failed to poll status:", error);
        // Don't stop polling on network errors, just log them
      }
    };

    // Initial poll
    pollStatus();

    // Start polling interval (every 3 seconds)
    pollingRef.current = setInterval(pollStatus, 3000);

    // Cleanup on unmount or state change
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [session?.state, originalVideo?.id, updateOriginalVideo, setOriginalVideoCompleted, setState]);

  // Poll for variation generation status when isGeneratingVariations is true
  useEffect(() => {
    // Only poll when generating variations and we have a batch ID
    if (!isGeneratingVariations || !variationBatchIdRef.current || !originalVideo?.id) {
      // Clear any existing polling
      if (variationPollingRef.current) {
        clearInterval(variationPollingRef.current);
        variationPollingRef.current = null;
      }
      return;
    }

    const pollVariationStatus = async () => {
      const batchId = variationBatchIdRef.current;
      const seedId = originalVideo?.id;

      if (!batchId || !seedId) return;

      try {
        const status = await fastCutApi.getVariationsStatus(seedId, batchId);
        console.log("[ProcessingFlowPage] Variation status:", status);

        // Update each variation's progress in the store
        status.variations.forEach((apiVar) => {
          // Find matching variation in store by ID
          const storeVar = variations.find((v) => v.id === apiVar.id);
          if (!storeVar) return;

          if (apiVar.status === "COMPLETED" && apiVar.output_url) {
            setVariationCompleted(apiVar.id, apiVar.output_url, apiVar.thumbnail_url);
          } else if (apiVar.status === "FAILED") {
            setVariationFailed(apiVar.id, apiVar.error_message);
          } else {
            // Update progress for pending/processing
            updateVariation(apiVar.id, {
              progress: apiVar.progress,
              status: apiVar.status === "PROCESSING" ? "generating" : "pending",
              currentStep: apiVar.status === "PROCESSING" ? "Generating..." : "Queued",
            });
          }
        });

        // Check if batch is done
        if (status.batch_status === "completed" || status.batch_status === "partial_failure") {
          console.log("[ProcessingFlowPage] All variations done, batch status:", status.batch_status);
          // Stop polling - store auto-transitions to COMPARE_AND_APPROVE when all done
          if (variationPollingRef.current) {
            clearInterval(variationPollingRef.current);
            variationPollingRef.current = null;
          }
          variationBatchIdRef.current = null;
        }
      } catch (error) {
        console.error("[ProcessingFlowPage] Failed to poll variation status:", error);
        // Don't stop polling on network errors, just log them
      }
    };

    // Initial poll
    pollVariationStatus();

    // Start polling interval (every 3 seconds)
    variationPollingRef.current = setInterval(pollVariationStatus, 3000);

    // Cleanup on unmount or state change
    return () => {
      if (variationPollingRef.current) {
        clearInterval(variationPollingRef.current);
        variationPollingRef.current = null;
      }
    };
  }, [isGeneratingVariations, originalVideo?.id, variations, updateVariation, setVariationCompleted, setVariationFailed]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    // Go back to effects page
    router.push("/fast-cut/effects");
  }, [router]);

  const handleGoToVariation = useCallback(() => {
    setState("VARIATION_CONFIG");
  }, [setState]);

  const handleGoToPublish = useCallback(async () => {
    // Direct publish without variations
    // Update session stage to "publish" before navigating
    if (activeSession) {
      await proceedToStage("publish");
    }
    // Navigate to publish page with the session data
    router.push(`/publish?sessionId=${session?.id}`);
  }, [router, session?.id, activeSession, proceedToStage]);

  const handleBackToReady = useCallback(() => {
    setState("READY");
  }, [setState]);

  const handleStartGeneration = useCallback(async () => {
    // First update store to show generating UI with pending variations
    startVariationGeneration();

    // Get the original video ID (seed generation) for API call
    const seedGenerationId = originalVideo?.id;
    if (!seedGenerationId) {
      console.error("[ProcessingFlowPage] No original video ID for variations");
      return;
    }

    // Check if this is a compose video (required for compose-variations API)
    if (!seedGenerationId.startsWith("compose-")) {
      console.error("[ProcessingFlowPage] Variation generation only supported for compose videos");
      return;
    }

    try {
      console.log("[ProcessingFlowPage] Starting compose variations for:", seedGenerationId);

      // Call the API to start variation generation
      const response = await fastCutApi.startComposeVariations(seedGenerationId, {
        variationCount: selectedStyles.length || 8,
      });

      console.log("[ProcessingFlowPage] Variations started:", response);

      // Store the batch ID for polling
      variationBatchIdRef.current = response.batch_id;

      // Map API response to store variations (update IDs to match API)
      response.variations.forEach((apiVar, index) => {
        const storeVariation = variations[index];
        if (storeVariation) {
          updateVariation(storeVariation.id, {
            id: apiVar.id, // Update to API's ID for tracking
            status: "generating",
            progress: 0,
            currentStep: "Starting...",
          });
        }
      });

    } catch (error) {
      console.error("[ProcessingFlowPage] Failed to start variations:", error);
      // Mark all variations as failed
      cancelVariationGeneration();
    }
  }, [startVariationGeneration, originalVideo?.id, selectedStyles.length, variations, updateVariation, cancelVariationGeneration]);

  const handleCancelGeneration = useCallback(() => {
    // Clear batch ID to stop polling
    variationBatchIdRef.current = null;
    if (variationPollingRef.current) {
      clearInterval(variationPollingRef.current);
      variationPollingRef.current = null;
    }
    cancelVariationGeneration();
    setState("READY");
  }, [cancelVariationGeneration, setState]);

  const handleVariationsComplete = useCallback(() => {
    // This is called when all variations are done generating
    setState("COMPARE_AND_APPROVE");
  }, [setState]);

  const handleBackToConfig = useCallback(() => {
    // Cancel any pending generations and go back to config
    // Clear batch ID to stop polling
    variationBatchIdRef.current = null;
    if (variationPollingRef.current) {
      clearInterval(variationPollingRef.current);
      variationPollingRef.current = null;
    }
    cancelVariationGeneration();
    setState("VARIATION_CONFIG");
  }, [cancelVariationGeneration, setState]);

  const handlePublish = useCallback(async () => {
    // Update session stage to "publish" before navigating
    if (activeSession) {
      await proceedToStage("publish");
    }
    // Navigate to publish page with approved videos
    router.push(`/publish?sessionId=${session?.id}`);
  }, [router, session?.id, activeSession, proceedToStage]);

  // Debug logging
  console.log("[ProcessingFlowPage] isHydrated:", isHydrated, "isInitializing:", isInitializing, "session:", session?.id, "state:", session?.state);

  // Check localStorage directly
  useEffect(() => {
    const stored = localStorage.getItem("hydra-processing-session");
    console.log("[ProcessingFlowPage] Direct localStorage check:", stored ? "EXISTS" : "MISSING");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log("[ProcessingFlowPage] Stored session state:", parsed?.state?.session?.id);
      } catch (e) {
        console.error("[ProcessingFlowPage] Failed to parse localStorage:", e);
      }
    }
  }, [isHydrated]);

  // Loading state - wait for both initialization and store hydration
  if (isInitializing || !isHydrated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  // No session state - show empty state
  if (!session) {
    console.log("[ProcessingFlowPage] No session found after hydration");
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-[60vh]", className)}>
        <Video className="w-16 h-16 text-neutral-300 mb-4" />
        <h2 className="text-xl font-semibold text-neutral-700 mb-2">
          {isKorean ? "세션이 없습니다" : "No Session"}
        </h2>
        <p className="text-sm text-neutral-500 mb-6 text-center max-w-md">
          {isKorean
            ? "영상 생성을 시작하려면 효과 페이지로 이동하세요"
            : "Go to the Effects page to start generating videos"}
        </p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isKorean ? "효과로 이동" : "Go to Effects"}
        </Button>
      </div>
    );
  }

  // Route to the appropriate view based on session state
  const renderView = () => {
    switch (session.state) {
      case "GENERATING":
        return <GeneratingView className={className} />;

      case "READY":
        return (
          <ReadyView
            className={className}
            onGoToVariation={handleGoToVariation}
            onGoToPublish={handleGoToPublish}
            onStartGeneration={handleStartGeneration}
          />
        );

      case "VARIATION_CONFIG":
        return (
          <VariationConfigView
            className={className}
            onBack={handleBackToReady}
            onStartGeneration={handleStartGeneration}
            onCancel={handleCancelGeneration}
          />
        );

      case "COMPARE_AND_APPROVE":
        return (
          <CompareApproveView
            className={className}
            onBack={handleBackToConfig}
            onPublish={handlePublish}
          />
        );

      default:
        return null;
    }
  };

  // Get subtitle based on state
  const getSubtitle = () => {
    switch (session.state) {
      case "GENERATING":
        return isKorean ? "영상 생성 중..." : "Generating video...";
      case "READY":
        return isKorean ? "✓ 영상 완성!" : "✓ Video Complete!";
      case "VARIATION_CONFIG":
        return isKorean ? "베리에이션 설정" : "Variation Settings";
      case "COMPARE_AND_APPROVE":
        return isKorean ? "비교 및 최종 선택" : "Compare & Select";
      default:
        return "";
    }
  };

  // Get footer config based on state
  const renderFooter = () => {
    switch (session.state) {
      case "GENERATING":
        // No footer during generation
        return null;

      case "READY":
        // No footer - choices are in the main view
        return null;

      case "VARIATION_CONFIG":
        return (
          <div className="flex items-center justify-between px-[7%] py-4 border-t border-neutral-200 bg-white shrink-0">
            <Button variant="outline" onClick={handleBackToReady}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isKorean ? "돌아가기" : "Back"}
            </Button>
            <Button onClick={handleStartGeneration}>
              <Rocket className="w-4 h-4 mr-2" />
              {isKorean ? "시작하기" : "Start"}
            </Button>
          </div>
        );

      case "COMPARE_AND_APPROVE":
        return (
          <div className="flex items-center justify-between px-[7%] py-4 border-t border-neutral-200 bg-white shrink-0">
            <Button variant="outline" onClick={handleBackToConfig}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isKorean ? "설정으로" : "Back to Config"}
            </Button>
            <Button onClick={handlePublish}>
              <Upload className="w-4 h-4 mr-2" />
              {isKorean ? "배포하기" : "Publish"}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Workflow Header */}
      <WorkflowHeader contentType="fast-cut" subtitle={getSubtitle()} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {renderView()}
      </div>

      {/* Footer */}
      {renderFooter()}
    </div>
  );
}
