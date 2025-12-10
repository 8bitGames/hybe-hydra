/**
 * Session-Workflow Store Sync Utility
 *
 * Bridges the new session-based state management with the existing workflow store.
 * This allows gradual migration without breaking existing stage components.
 */

import { useEffect, useCallback, useRef } from "react";
import { useSessionStore, type CreationSession } from "./session-store";
import { useWorkflowStore, type WorkflowStage } from "./workflow-store";
import { useShallow } from "zustand/react/shallow";

/**
 * Syncs session data to workflow store
 * Call this when entering a session-based stage page
 *
 * IMPORTANT: This function FIRST resets the workflow store to clear any
 * leftover data from previous sessions, then restores only the data
 * that exists in the current session.
 */
export function syncSessionToWorkflow(session: CreationSession): void {
  const workflowStore = useWorkflowStore.getState();

  // CRITICAL: Reset workflow store FIRST to clear any stale data from previous sessions
  // This prevents data leakage between sessions
  workflowStore.resetWorkflow();
  console.log("[SyncSessionToWorkflow] Reset workflow store before syncing session:", session.id);

  // Sync stage
  workflowStore.setCurrentStage(session.currentStage);

  // Sync start data (if exists)
  if (session.stageData.start) {
    const startData = session.stageData.start;
    // Sync source based on its type for complete data transfer
    if (startData.source?.type === "video") {
      workflowStore.setStartFromVideo(startData.source);
    } else if (startData.source?.type === "trends") {
      workflowStore.setStartFromTrends(startData.source);
    } else if (startData.source?.type === "idea") {
      workflowStore.setStartFromIdea(startData.source);
    } else if (startData.source) {
      workflowStore.setStartSource(startData.source);
    }
    if (startData.contentType) {
      workflowStore.setStartContentType(startData.contentType);
    }
    // Sync additional start fields
    if (startData.selectedHashtags?.length) {
      workflowStore.setStartHashtags(startData.selectedHashtags);
    }
    if (startData.aiInsights) {
      workflowStore.setStartAiInsights(startData.aiInsights);
    }
    if (startData.performanceMetrics) {
      workflowStore.setStartPerformanceMetrics(startData.performanceMetrics);
    }
  }
  // Note: No else clause needed - resetWorkflow already cleared start data

  // Sync analyze data (if exists)
  if (session.stageData.analyze) {
    const analyzeData = session.stageData.analyze;
    if (analyzeData.campaignId || analyzeData.campaignName) {
      workflowStore.setAnalyzeCampaign(
        analyzeData.campaignId,
        analyzeData.campaignName,
        analyzeData.campaignDescription,
        analyzeData.campaignGenre,
        analyzeData.artistName,
        analyzeData.artistStageName
      );
    }
    if (analyzeData.userIdea) {
      workflowStore.setAnalyzeUserIdea(analyzeData.userIdea);
    }
    if (analyzeData.isRecreationMode !== undefined) {
      workflowStore.setAnalyzeRecreationMode(analyzeData.isRecreationMode);
    }
    if (analyzeData.targetAudience?.length) {
      workflowStore.setAnalyzeTargetAudience(analyzeData.targetAudience);
    }
    if (analyzeData.contentGoals?.length) {
      workflowStore.setAnalyzeContentGoals(analyzeData.contentGoals);
    }
    if (analyzeData.aiGeneratedIdeas?.length) {
      workflowStore.setAnalyzeAiIdeas(analyzeData.aiGeneratedIdeas);
    }
    if (analyzeData.selectedIdea) {
      workflowStore.selectAnalyzeIdea(analyzeData.selectedIdea);
    }
    if (analyzeData.assets?.length) {
      workflowStore.setAnalyzeAssets(analyzeData.assets);
    }
    if (analyzeData.optimizedPrompt) {
      workflowStore.setAnalyzeOptimizedPrompt(analyzeData.optimizedPrompt);
    }
    if (analyzeData.settings) {
      workflowStore.setAnalyzeSettings(analyzeData.settings);
    }
    if (analyzeData.hashtags?.length) {
      workflowStore.setAnalyzeHashtags(analyzeData.hashtags);
    }
  }
  // Note: No else clause needed - resetWorkflow already cleared analyze data

  // Sync create data (if exists)
  if (session.stageData.create) {
    const createData = session.stageData.create;
    if (createData.creationType) {
      workflowStore.setCreateType(createData.creationType);
    }
    if (createData.generations?.length) {
      workflowStore.setGenerations(createData.generations);
    }
    if (createData.selectedGenerations?.length) {
      workflowStore.setSelectedGenerations(createData.selectedGenerations);
    }
    if (createData.pipelineStatus?.length) {
      workflowStore.updatePipelineStatus(createData.pipelineStatus);
    }
  }
  // Note: No else clause needed - resetWorkflow already cleared create data

  // Sync processing data (if exists)
  if (session.stageData.processing) {
    const processingData = session.stageData.processing;
    if (processingData.videos?.length) {
      workflowStore.setProcessingVideos(processingData.videos);
    }
    if (processingData.selectedVideos?.length) {
      workflowStore.setSelectedProcessingVideos(processingData.selectedVideos);
    }
    if (processingData.filterStatus) {
      workflowStore.setProcessingFilter(processingData.filterStatus);
    }
    if (processingData.sortBy) {
      workflowStore.setProcessingSort(processingData.sortBy);
    }
    if (processingData.viewMode) {
      workflowStore.setProcessingViewMode(processingData.viewMode);
    }
  }
  // Note: No else clause needed - resetWorkflow already cleared processing data

  // Sync publish data (if exists)
  if (session.stageData.publish) {
    const publishData = session.stageData.publish;
    if (publishData.scheduledPosts?.length) {
      publishData.scheduledPosts.forEach(post => {
        workflowStore.addScheduledPost(post);
      });
    }
    if (publishData.selectedPlatforms?.length) {
      workflowStore.setPublishPlatforms(publishData.selectedPlatforms);
    }
    if (publishData.publishTime) {
      workflowStore.setPublishTime(publishData.publishTime);
    }
    if (publishData.caption) {
      workflowStore.setPublishCaption(publishData.caption);
    }
    if (publishData.hashtags?.length) {
      workflowStore.setPublishHashtags(publishData.hashtags);
    }
  }
  // Note: No else clause needed - resetWorkflow already cleared publish data

  console.log("[SyncSessionToWorkflow] Completed sync for session:", session.id, "stage:", session.currentStage);
}

/**
 * Syncs workflow store data back to session
 * Call this when exiting a stage or on periodic auto-save
 *
 * IMPORTANT: This function now also syncs currentStage and completedStages
 * to ensure session progress is properly persisted.
 */
export function syncWorkflowToSession(): void {
  const workflowState = useWorkflowStore.getState();
  const sessionStore = useSessionStore.getState();

  if (!sessionStore.activeSession) return;

  const workflowCurrentStage = workflowState.currentStage;
  const sessionCurrentStage = sessionStore.activeSession.currentStage;

  // CRITICAL: Sync currentStage if workflow has progressed beyond session
  // This ensures stage progression is persisted even when navigation functions
  // only update the workflow store
  if (workflowCurrentStage !== sessionCurrentStage) {
    console.log(
      "[SyncWorkflowToSession] Stage mismatch detected:",
      "workflow:", workflowCurrentStage,
      "session:", sessionCurrentStage,
      "- updating session"
    );
    // Use proceedToStage to properly update both currentStage and completedStages
    void sessionStore.proceedToStage(workflowCurrentStage);
  }

  // CRITICAL: Sync metadata (title, contentType) from workflow to session
  // This ensures session cards display correct info in SessionDashboard
  const metadataUpdates: { title?: string; contentType?: "ai_video" | "fast-cut" | null } = {};

  // Sync contentType from start stage
  if (workflowState.start.contentType) {
    metadataUpdates.contentType = workflowState.start.contentType;
  }

  // Sync title from analyze stage (campaign name or selected idea title)
  const title = workflowState.analyze.campaignName ||
    workflowState.analyze.selectedIdea?.title ||
    "";
  if (title && title !== sessionStore.activeSession.metadata.title) {
    metadataUpdates.title = title;
  }

  // Apply metadata updates if any
  if (Object.keys(metadataUpdates).length > 0) {
    sessionStore.updateMetadata(metadataUpdates);
    console.log("[SyncWorkflowToSession] Synced metadata:", metadataUpdates);
  }

  // CRITICAL FIX: Sync ALL stage data that has content, not just current stage
  // This ensures data is preserved when navigating between stages
  // (e.g., start data must persist when moving to analyze stage)

  // Always sync start data if it has a source
  if (workflowState.start.source) {
    sessionStore.updateStageData("start", {
      source: workflowState.start.source,
      contentType: workflowState.start.contentType,
      selectedHashtags: workflowState.discover.selectedHashtags,
    });
    console.log("[SyncWorkflowToSession] Synced start data:", workflowState.start.source?.type);
  }

  // Always sync analyze data if it has meaningful content
  if (workflowState.analyze.campaignId || workflowState.analyze.userIdea || workflowState.analyze.selectedIdea) {
    sessionStore.updateStageData("analyze", {
      campaignId: workflowState.analyze.campaignId,
      campaignName: workflowState.analyze.campaignName,
      userIdea: workflowState.analyze.userIdea,
      selectedIdea: workflowState.analyze.selectedIdea,
      optimizedPrompt: workflowState.analyze.optimizedPrompt,
      hashtags: workflowState.analyze.hashtags,
      aiGeneratedIdeas: workflowState.analyze.aiGeneratedIdeas,
    });
  }

  // Always sync create data if it has generations
  if (workflowState.create.generations?.length || workflowState.create.creationType) {
    sessionStore.updateStageData("create", {
      creationType: workflowState.create.creationType,
      generations: workflowState.create.generations,
      selectedGenerations: workflowState.create.selectedGenerations,
      pipelineStatus: workflowState.create.pipelineStatus,
    });
  }

  // Always sync processing data if it has videos
  if (workflowState.processing.videos?.length) {
    sessionStore.updateStageData("processing", {
      videos: workflowState.processing.videos,
      selectedVideos: workflowState.processing.selectedVideos,
      filterStatus: workflowState.processing.filterStatus,
    });
  }

  // Always sync publish data if it has scheduled posts or platforms
  if (workflowState.publish.scheduledPosts?.length || workflowState.publish.selectedPlatforms?.length) {
    sessionStore.updateStageData("publish", {
      scheduledPosts: workflowState.publish.scheduledPosts,
      selectedPlatforms: workflowState.publish.selectedPlatforms,
    });
  }

  console.log("[SyncWorkflowToSession] Completed sync for stage:", workflowCurrentStage);
}

/**
 * Hook to auto-sync between stores
 * Use in session-based stage pages
 */
export function useSessionWorkflowSync(stage: WorkflowStage) {
  const { activeSession, proceedToStage, saveSession } = useSessionStore(
    useShallow((state) => ({
      activeSession: state.activeSession,
      proceedToStage: state.proceedToStage,
      saveSession: state.saveSession,
    }))
  );

  // Track session ID to prevent re-syncing on every activeSession object change
  const sessionId = activeSession?.id;

  // Refs to prevent infinite loops and track sync state
  const initialSyncDoneRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // Store references for cleanup without triggering re-renders
  const activeSessionRef = useRef(activeSession);
  const saveSessionRef = useRef(saveSession);

  // Keep refs updated
  useEffect(() => {
    activeSessionRef.current = activeSession;
    saveSessionRef.current = saveSession;
  }, [activeSession, saveSession]);

  // Initial sync: session → workflow (on mount or session change)
  useEffect(() => {
    // Skip if no session or already synced for this session
    if (!sessionId || initialSyncDoneRef.current === sessionId) {
      return;
    }

    const session = useSessionStore.getState().activeSession;
    if (!session) return;

    // Mark as synced BEFORE doing anything to prevent re-entry
    initialSyncDoneRef.current = sessionId;

    // Sync session data to workflow store (non-reactive)
    syncSessionToWorkflow(session);

    // Only proceed to stage if we're not already on it
    const currentStage = session.currentStage;
    if (currentStage !== stage) {
      // Use setTimeout to break the synchronous update cycle
      setTimeout(() => {
        if (isMountedRef.current) {
          void proceedToStage(stage);
        }
      }, 0);
    }
  }, [sessionId, stage, proceedToStage]);

  // Periodic sync: workflow → session (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeSessionRef.current) {
        syncWorkflowToSession();
        saveSessionRef.current();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []); // Empty deps - uses refs

  // Sync on unmount (stage exit)
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (activeSessionRef.current) {
        syncWorkflowToSession();
        saveSessionRef.current();
      }
    };
  }, []); // Empty deps - uses refs

  // Manual sync function
  const syncNow = useCallback(() => {
    if (activeSessionRef.current) {
      syncWorkflowToSession();
      saveSessionRef.current();
    }
  }, []); // Empty deps - uses refs

  return {
    activeSession,
    syncNow,
  };
}

/**
 * Mark stage as completed
 */
export function useCompleteStage() {
  const { activeSession, markStageCompleted, saveSession } = useSessionStore(
    useShallow((state) => ({
      activeSession: state.activeSession,
      markStageCompleted: state.markStageCompleted,
      saveSession: state.saveSession,
    }))
  );

  // Use refs to avoid unnecessary re-renders in callback
  const activeSessionRef = useRef(activeSession);
  const markStageCompletedRef = useRef(markStageCompleted);
  const saveSessionRef = useRef(saveSession);

  useEffect(() => {
    activeSessionRef.current = activeSession;
    markStageCompletedRef.current = markStageCompleted;
    saveSessionRef.current = saveSession;
  }, [activeSession, markStageCompleted, saveSession]);

  return useCallback(
    (stage: WorkflowStage) => {
      if (activeSessionRef.current) {
        syncWorkflowToSession();
        markStageCompletedRef.current(stage);
        saveSessionRef.current();
      }
    },
    [] // Empty deps - uses refs
  );
}
