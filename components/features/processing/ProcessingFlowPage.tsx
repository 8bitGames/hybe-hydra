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
  selectVariations,
} from "@/lib/stores/processing-session-store";
import { useSessionStore } from "@/lib/stores/session-store";
import { useShallow } from "zustand/react/shallow";
import { fastCutApi } from "@/lib/fast-cut-api";
import { variationsApi } from "@/lib/video-api";
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
  const addVariation = useProcessingSessionStore((state) => state.addVariation);
  const setVariationCompleted = useProcessingSessionStore((state) => state.setVariationCompleted);
  const setVariationFailed = useProcessingSessionStore((state) => state.setVariationFailed);
  const selectedStyles = useProcessingSessionStore(selectSelectedStyles);
  const isGeneratingVariations = useProcessingSessionStore(selectIsGeneratingVariations);
  const variations = useProcessingSessionStore(selectVariations);

  // Session store for stage progression (syncs with SessionDashboard)
  const { proceedToStage, activeSession, loadSession } = useSessionStore(
    useShallow((state) => ({
      proceedToStage: state.proceedToStage,
      activeSession: state.activeSession,
      loadSession: state.loadSession,
    }))
  );

  // Local state for initialization
  const [isInitializing, setIsInitializing] = useState(true);

  // State to trigger polling start (used with batch ID ref)
  const [variationBatchId, setVariationBatchId] = useState<string | null>(null);

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

  // Recovery effect: Check for existing compose variations on page refresh
  // This runs when we have an originalVideo but lost the variationBatchId from session
  useEffect(() => {
    // Only run recovery when:
    // 1. Store is hydrated
    // 2. We have an original video
    // 3. We're not currently generating variations
    // 4. We don't have variations in store yet
    // 5. It's a compose/fast_cut content type
    const shouldRecover =
      isHydrated &&
      originalVideo?.id &&
      !isGeneratingVariations &&
      (!variations || variations.length === 0) &&
      session?.contentType !== 'ai_video' &&
      session?.state === 'READY'; // Only recover in READY state

    if (!shouldRecover) return;

    const recoverVariations = async () => {
      try {
        console.log("[ProcessingFlowPage] Checking for existing compose variations...");

        // Call API without batchId to get all variations for this seed
        const status = await fastCutApi.getComposeVariationsStatus(originalVideo.id);

        if (status.variations && status.variations.length > 0) {
          console.log(`[ProcessingFlowPage] Found ${status.variations.length} existing variations, restoring...`);

          // Restore variations to the store
          status.variations.forEach((apiVar) => {
            const existingVar = variations?.find(v => v.id === apiVar.id);
            if (existingVar) return; // Already in store

            // Extract style info from variation_label (e.g., "Pop", "Emotional")
            const styleLabel = apiVar.variation_label || "Variation";
            const styleId = styleLabel.toLowerCase().replace(/\s+/g, '_');

            // Add to store
            addVariation({
              id: apiVar.id,
              generationId: apiVar.id, // For recovered variations, id IS the generation ID
              styleId,
              styleName: styleLabel,
              styleNameKo: styleLabel, // Use same label for Korean (or could map)
              status: apiVar.status === "COMPLETED" ? "completed" :
                      apiVar.status === "FAILED" ? "failed" :
                      apiVar.status === "PROCESSING" ? "generating" : "pending",
              progress: apiVar.progress,
              outputUrl: apiVar.output_url,
              thumbnailUrl: apiVar.thumbnail_url,
              approval: "pending", // Recovered variations start with pending approval
            });
          });

          // If all variations are done, transition to compare state
          const allDone = status.variations.every(
            v => v.status === "COMPLETED" || v.status === "FAILED"
          );
          if (allDone && status.variations.some(v => v.status === "COMPLETED")) {
            setState("COMPARE_AND_APPROVE");
          }
        } else {
          console.log("[ProcessingFlowPage] No existing variations found");
        }
      } catch (error) {
        console.error("[ProcessingFlowPage] Failed to recover variations:", error);
        // Silently fail - this is just recovery, not critical
      }
    };

    recoverVariations();
  }, [isHydrated, originalVideo?.id, isGeneratingVariations, variations, session?.contentType, session?.state, addVariation, setState]);

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
    // Use variationBatchId state (not just ref) to trigger this effect when batch ID is set
    if (!isGeneratingVariations || !variationBatchId || !originalVideo?.id) {
      // Clear any existing polling
      if (variationPollingRef.current) {
        clearInterval(variationPollingRef.current);
        variationPollingRef.current = null;
      }
      return;
    }

    const contentType = session?.contentType;
    const isAIVideo = contentType === "ai_video";

    const pollVariationStatus = async () => {
      // Use state value (already checked above, but double-check for safety)
      const batchId = variationBatchId;
      const seedId = originalVideo?.id;

      if (!batchId || !seedId) return;

      try {
        if (isAIVideo) {
          // Poll AI Video variations API
          const response = await variationsApi.getStatus(seedId, batchId);

          if (!response.data) {
            console.error("[ProcessingFlowPage] No data in AI Video variation status response");
            return;
          }

          const status = response.data;
          console.log("[ProcessingFlowPage] AI Video variation status:", status);

          // Update each variation's progress in the store
          // CRITICAL: Get current variations from store directly, not from React state
          // React state `variations` may be stale during polling due to closure capture timing
          const currentAIVariations = useProcessingSessionStore.getState().session?.variations || [];
          status.variations.forEach((apiVar) => {
            // Find matching variation in store by generationId (API UUID)
            // NOTE: Store variation's `id` is internal, `generationId` is the API UUID
            const storeVar = currentAIVariations.find((v) => v.generationId === apiVar.id || v.id === apiVar.id);
            if (!storeVar) {
              console.warn(`[ProcessingFlowPage] AI Video: No store match for API var ${apiVar.id}`);
              return;
            }

            // AI Video API returns status as lowercase
            const apiStatus = apiVar.status?.toUpperCase?.() || apiVar.status;
            const generation = apiVar.generation;

            if (apiStatus === "COMPLETED" && generation?.output_url) {
              // Use storeVar.id (internal ID) for store operations, not apiVar.id (API UUID)
              setVariationCompleted(storeVar.id, generation.output_url, undefined);
            } else if (apiStatus === "FAILED") {
              setVariationFailed(storeVar.id, generation?.error_message || undefined);
            } else {
              // Update progress for pending/processing
              // Use storeVar.id (internal ID) for store operations
              updateVariation(storeVar.id, {
                progress: generation?.progress || 0,
                status: apiStatus === "PROCESSING" ? "generating" : "pending",
                currentStep: apiStatus === "PROCESSING" ? "Generating..." : "Queued",
              });
            }
          });

          // Check if batch is done
          if (status.batch_status === "completed" || status.batch_status === "partial_failure") {
            console.log("[ProcessingFlowPage] All AI Video variations done, batch status:", status.batch_status);
            // Stop polling - store auto-transitions to COMPARE_AND_APPROVE when all done
            if (variationPollingRef.current) {
              clearInterval(variationPollingRef.current);
              variationPollingRef.current = null;
            }
            variationBatchIdRef.current = null;
            setVariationBatchId(null);
          }
        } else {
          // Poll Compose variations API (uses /compose-variations endpoint)
          const status = await fastCutApi.getComposeVariationsStatus(seedId, batchId);
          console.log("[ProcessingFlowPage] Compose variation status:", status);

          // Update each variation's progress in the store
          // CRITICAL: Get current variations from store directly, not from React state
          // React state `variations` may be stale during polling due to closure capture timing
          const currentComposeVars = useProcessingSessionStore.getState().session?.variations || [];

          console.log("[ProcessingFlowPage] Polling - Store vs API IDs:", {
            storeIds: currentComposeVars.map(v => v.id),
            apiIds: status.variations.map(v => v.id),
          });

          status.variations.forEach((apiVar) => {
            // Find matching variation in store by ID
            const storeVar = currentComposeVars.find((v) => v.id === apiVar.id);

            if (!storeVar) {
              console.warn(`[ProcessingFlowPage] No store match for API var ${apiVar.id}! Store IDs: ${currentComposeVars.map(v => v.id).join(', ')}`);
              return;
            }

            console.log(`[ProcessingFlowPage] Processing ${apiVar.id}: status=${apiVar.status}, output_url=${apiVar.output_url ? 'present' : 'missing'}`);

            if (apiVar.status === "COMPLETED" && apiVar.output_url) {
              console.log(`[ProcessingFlowPage] Setting COMPLETED for ${apiVar.id} with URL: ${apiVar.output_url.substring(0, 60)}...`);
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
            console.log("[ProcessingFlowPage] All Compose variations done, batch status:", status.batch_status);
            // Stop polling - store auto-transitions to COMPARE_AND_APPROVE when all done
            if (variationPollingRef.current) {
              clearInterval(variationPollingRef.current);
              variationPollingRef.current = null;
            }
            variationBatchIdRef.current = null;
            setVariationBatchId(null);
          }
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
  }, [isGeneratingVariations, variationBatchId, originalVideo?.id, session?.contentType, variations, updateVariation, setVariationCompleted, setVariationFailed]);

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
    try {
      // If activeSession is not loaded but we have a database session ID, load it first
      const dbSessionId = session?.databaseSessionId;
      if (!activeSession && dbSessionId) {
        console.log("[ProcessingFlowPage] Loading session before publish:", dbSessionId);
        await loadSession(dbSessionId);
      }
      // Now proceed to publish stage (will work since session is loaded)
      await proceedToStage("publish");
    } catch (error) {
      console.error("[ProcessingFlowPage] Failed to update session stage:", error);
    }
    // Navigate to publish page with the database session ID
    // IMPORTANT: Only use databaseSessionId (UUID), never fall back to session?.id (local format)
    const dbSessionId = session?.databaseSessionId;
    if (dbSessionId) {
      router.push(`/publish?sessionId=${dbSessionId}`);
    } else {
      console.error("[ProcessingFlowPage] Cannot navigate to publish: no databaseSessionId available");
      // Navigate without session ID - publish page will handle the error
      router.push("/publish");
    }
  }, [router, session?.databaseSessionId, activeSession, proceedToStage, loadSession]);

  const handleBackToReady = useCallback(() => {
    setState("READY");
  }, [setState]);

  const handleStartGeneration = useCallback(async () => {
    // Get the original video ID (seed generation) for API call
    const seedGenerationId = originalVideo?.id;
    if (!seedGenerationId) {
      console.error("[ProcessingFlowPage] No original video ID for variations");
      return;
    }

    const contentType = session?.contentType;
    const isAIVideo = contentType === "ai_video";

    try {
      if (isAIVideo) {
        // AI Video (VEO) variation generation
        // NEW: 1:1 mapping - each preset_id = 1 video (no combinations!)
        console.log("[ProcessingFlowPage] Starting AI Video variations for:", seedGenerationId);

        // CRITICAL: Read selectedStyles directly from store to avoid stale closure issue
        // When ReadyView calls setSelectedStyles() then onStartGeneration() immediately,
        // the React component closure may still have the old selectedStyles value
        const currentSelectedPresets = useProcessingSessionStore.getState().session?.variationConfig.selectedStyles || [];
        console.log("[ProcessingFlowPage] Selected AI preset IDs (1:1 mapping):", currentSelectedPresets);

        // NEW: Send preset_ids directly (no category mapping, no combinations!)
        // Preset IDs are: camera_closeup, camera_wide, move_dolly_in, color_warm, etc.
        // Each preset will generate exactly ONE video variation

        // Call AI Video variations API with direct preset_ids
        const response = await variationsApi.create(seedGenerationId, {
          preset_ids: currentSelectedPresets, // Direct 1:1 mapping!
          max_variations: currentSelectedPresets.length || 4,
        });

        // Check for API error response
        if (response.error) {
          console.error("[ProcessingFlowPage] AI Video API error:", response.error);
          throw new Error(response.error.message || "Failed to create AI Video variations");
        }

        if (!response.data || !response.data.variations || response.data.variations.length === 0) {
          console.error("[ProcessingFlowPage] AI Video API returned no variations:", response);
          throw new Error("Failed to create AI Video variations - no variations returned");
        }

        console.log("[ProcessingFlowPage] AI Video variations started:", response.data);

        // CRITICAL: Store batch ID temporarily but don't set it yet
        // This prevents polling from starting before ID updates are complete
        const batchId = response.data.batch_id;

        // Create store variations from selected styles first
        // (startVariationGeneration creates variations and sets isGenerating = true)
        startVariationGeneration();

        // Update each store variation with API data (set generationId for publishing)
        const currentVariations = useProcessingSessionStore.getState().session?.variations || [];
        response.data.variations.forEach((apiVar, index) => {
          if (index < currentVariations.length) {
            // Update existing store variation with API generationId
            updateVariation(currentVariations[index].id, {
              generationId: apiVar.id, // Store real API UUID for publishing (keep internal id unchanged)
              styleName: apiVar.variation_label || `Variation ${index + 1}`,
              styleNameKo: apiVar.variation_label || `변형 ${index + 1}`,
              status: "generating",
              progress: 0,
              currentStep: "Starting...",
            });
          } else {
            // Add new variation if API returned more than store has
            addVariation({
              id: `var-api-${Date.now()}-${index}`,
              generationId: apiVar.id, // Store real API UUID for publishing
              styleId: apiVar.id, // Use API ID as styleId for dynamically added variations
              styleName: apiVar.variation_label || `Variation ${index + 1}`,
              styleNameKo: apiVar.variation_label || `변형 ${index + 1}`,
              status: "generating",
              progress: 0,
              approval: "pending",
              currentStep: "Starting...",
            });
          }
        });

        // NOW set the batch ID - this triggers polling useEffect via state change
        // At this point, all store variations have been updated with correct API UUIDs
        variationBatchIdRef.current = batchId;
        setVariationBatchId(batchId); // State change triggers useEffect
        console.log("[ProcessingFlowPage] AI Video batch ID set, polling will start:", batchId);
      } else {
        // Compose (Fast Cut) - create store variations first, then call API
        startVariationGeneration();
        // Compose (Fast Cut) variation generation
        // Check if this is a compose video (required for compose-variations API)
        if (!seedGenerationId.startsWith("compose-")) {
          console.error("[ProcessingFlowPage] Compose variation requires compose- prefixed ID");
          cancelVariationGeneration();
          return;
        }

        console.log("[ProcessingFlowPage] Starting compose variations for:", seedGenerationId);

        // Read selectedStyles directly from store for consistency (avoid stale closure)
        const currentFastCutStyles = useProcessingSessionStore.getState().session?.variationConfig.selectedStyles || [];
        console.log("[ProcessingFlowPage] Current FastCut styles from store:", currentFastCutStyles);

        // Call the API to start variation generation
        const response = await fastCutApi.startComposeVariations(seedGenerationId, {
          variationCount: currentFastCutStyles.length || 8,
        });

        console.log("[ProcessingFlowPage] Compose variations started:", response);

        // Map API response to store variations (set generationId for publishing) BEFORE setting batch ID
        // CRITICAL: The generationId must be set before polling starts for proper matching
        const currentComposeVariations = useProcessingSessionStore.getState().session?.variations || [];

        console.log("[ProcessingFlowPage] Mapping API variations to store:", {
          apiCount: response.variations.length,
          storeCount: currentComposeVariations.length,
          apiIds: response.variations.map(v => v.id),
          storeIds: currentComposeVariations.map(v => v.id),
        });

        response.variations.forEach((apiVar, index) => {
          const storeVariation = currentComposeVariations[index];
          if (storeVariation) {
            console.log(`[ProcessingFlowPage] Updating store variation ${index}: adding generationId ${apiVar.id}`);
            updateVariation(storeVariation.id, {
              generationId: apiVar.id, // Store API UUID for publishing (polling will match by generationId)
              status: "generating",
              progress: 0,
              currentStep: "Starting...",
            });
          } else {
            console.warn(`[ProcessingFlowPage] No store variation at index ${index} for API var ${apiVar.id}`);
          }
        });

        // Verify generationIds were set
        const updatedVars = useProcessingSessionStore.getState().session?.variations || [];
        console.log("[ProcessingFlowPage] After update, store generationIds:", updatedVars.map(v => v.generationId));

        // NOW set the batch ID - this triggers polling useEffect via state change
        // At this point, all store variations have been updated with correct API IDs
        variationBatchIdRef.current = response.batch_id;
        setVariationBatchId(response.batch_id);
        console.log("[ProcessingFlowPage] Compose batch ID set, polling will start:", response.batch_id);
      }
    } catch (error) {
      console.error("[ProcessingFlowPage] Failed to start variations:", error);
      // Mark all variations as failed
      cancelVariationGeneration();
    }
  }, [startVariationGeneration, originalVideo?.id, session?.contentType, updateVariation, addVariation, cancelVariationGeneration]);

  const handleCancelGeneration = useCallback(() => {
    // Clear batch ID to stop polling
    variationBatchIdRef.current = null;
    setVariationBatchId(null);
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
    // Go back to READY state without deleting variations
    // User can view completed variations again or proceed to publish
    setState("READY");
  }, [setState]);

  const handlePublish = useCallback(async () => {
    // Update session stage to "publish" before navigating
    try {
      // If activeSession is not loaded but we have a database session ID, load it first
      const dbSessionId = session?.databaseSessionId;
      if (!activeSession && dbSessionId) {
        console.log("[ProcessingFlowPage] Loading session before publish:", dbSessionId);
        await loadSession(dbSessionId);
      }
      // Now proceed to publish stage (will work since session is loaded)
      await proceedToStage("publish");
    } catch (error) {
      console.error("[ProcessingFlowPage] Failed to update session stage:", error);
    }
    // Navigate to publish page with the database session ID
    // IMPORTANT: Only use databaseSessionId (UUID), never fall back to session?.id (local format)
    const dbSessionId = session?.databaseSessionId;
    if (dbSessionId) {
      router.push(`/publish?sessionId=${dbSessionId}`);
    } else {
      console.error("[ProcessingFlowPage] Cannot navigate to publish: no databaseSessionId available");
      // Navigate without session ID - publish page will handle the error
      router.push("/publish");
    }
  }, [router, session?.databaseSessionId, activeSession, proceedToStage, loadSession]);

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
              {isKorean ? "돌아가기" : "Back"}
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
      <WorkflowHeader contentType={session.contentType} subtitle={getSubtitle()} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {renderView()}
      </div>

      {/* Footer */}
      {renderFooter()}
    </div>
  );
}
