"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useSessionStore } from "@/lib/stores/session-store";
import { useAuthStore } from "@/lib/auth-store";
import { useShallow } from "zustand/react/shallow";
import {
  fastCutApi,
  ScriptGenerationResponse,
  ImageCandidate,
  AudioMatch,
  AudioAnalysisResponse,
  TikTokSEO,
  StyleSetSummary,
} from "@/lib/fast-cut-api";

// ============================================================================
// Types
// ============================================================================

export type FastCutStep = "script" | "images" | "music" | "effects";
export type SubtitleMode = "script" | "lyrics";

interface FastCutState {
  // Current step
  currentStep: FastCutStep;

  // Campaign info
  campaignId: string | null;
  campaignName: string;

  // Script step (legacy - now optional, can skip to images with sceneAnalysis)
  prompt: string;
  aspectRatio: string;
  editableKeywords: string[];
  selectedSearchKeywords: Set<string>;
  generatingScript: boolean;
  scriptData: ScriptGenerationResponse | null;
  tiktokSEO: TikTokSEO | null;

  // Scene analysis data (from video analysis on Start page)
  hasSceneAnalysis: boolean;

  // Images step
  searchingImages: boolean;
  imageCandidates: ImageCandidate[];
  selectedImages: ImageCandidate[];
  generationId: string | null;

  // Music step
  matchingMusic: boolean;
  audioMatches: AudioMatch[];
  selectedAudio: AudioMatch | null;
  audioStartTime: number;
  videoDuration: number;  // Video duration in seconds (user-controllable)
  audioAnalysis: AudioAnalysisResponse | null;
  analyzingAudio: boolean;
  musicSkipped: boolean;
  subtitleMode: SubtitleMode;  // 'script' = AI text overlay, 'lyrics' = audio lyrics
  audioLyricsText: string | null;  // Extracted lyrics text for display in Content Summary

  // Effects step
  styleSetId: string;
  styleSets: StyleSetSummary[];
  rendering: boolean;

  // Error state
  error: string | null;

  // Hydration state (for SSR)
  isHydrated: boolean;
}

interface FastCutActions {
  // Navigation
  setCurrentStep: (step: FastCutStep) => void;
  canProceed: () => boolean;

  // Campaign
  setCampaignId: (id: string | null) => void;
  setCampaignName: (name: string) => void;

  // Script actions
  setPrompt: (prompt: string) => void;
  setAspectRatio: (ratio: string) => void;
  setEditableKeywords: (keywords: string[]) => void;
  setSelectedSearchKeywords: (keywords: Set<string>) => void;
  setGeneratingScript: (loading: boolean) => void;
  setScriptData: (data: ScriptGenerationResponse | null) => void;
  setTiktokSEO: (seo: TikTokSEO | null) => void;

  // Images actions
  setSearchingImages: (loading: boolean) => void;
  setImageCandidates: (images: ImageCandidate[]) => void;
  setSelectedImages: (images: ImageCandidate[]) => void;
  setGenerationId: (id: string | null) => void;
  addSelectedImage: (image: ImageCandidate) => void;
  removeSelectedImage: (imageId: string) => void;

  // Music actions
  setMatchingMusic: (loading: boolean) => void;
  setAudioMatches: (matches: AudioMatch[]) => void;
  setSelectedAudio: (audio: AudioMatch | null) => void;
  setAudioStartTime: (time: number) => void;
  setVideoDuration: (duration: number) => void;
  setAudioAnalysis: (analysis: AudioAnalysisResponse | null) => void;
  setAnalyzingAudio: (loading: boolean) => void;
  setMusicSkipped: (skipped: boolean) => void;
  setSubtitleMode: (mode: SubtitleMode) => void;
  setAudioLyricsText: (text: string | null) => void;

  // Effects actions
  setStyleSetId: (id: string) => void;
  setStyleSets: (sets: StyleSetSummary[]) => void;
  setRendering: (loading: boolean) => void;

  // Error
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

type FastCutContextType = FastCutState & FastCutActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: FastCutState = {
  currentStep: "script",
  campaignId: null,
  campaignName: "",
  prompt: "",
  aspectRatio: "9:16",
  editableKeywords: [],
  selectedSearchKeywords: new Set(),
  generatingScript: false,
  scriptData: null,
  tiktokSEO: null,
  hasSceneAnalysis: false,
  searchingImages: false,
  imageCandidates: [],
  selectedImages: [],
  generationId: null,
  matchingMusic: false,
  audioMatches: [],
  selectedAudio: null,
  audioStartTime: 0,
  videoDuration: 15,  // Default 15 seconds
  audioAnalysis: null,
  analyzingAudio: false,
  musicSkipped: false,
  subtitleMode: "lyrics",  // Default to lyrics when available
  audioLyricsText: null,  // Extracted lyrics text for display
  styleSetId: "viral_tiktok",
  styleSets: [],
  rendering: false,
  error: null,
  isHydrated: false,
};

// ============================================================================
// Session Storage Persistence
// ============================================================================

const STORAGE_KEY = "fast-cut-state";

// Extended state type that includes sessionId for validation
interface StoredFastCutState extends Omit<FastCutState, "selectedSearchKeywords"> {
  selectedSearchKeywords: string[];
  _sessionId?: string; // Track which session this data belongs to
  hasSceneAnalysis?: boolean; // Track if we have scene analysis (for restoring from storage)
}

function saveToSessionStorage(state: FastCutState, sessionId?: string | null) {
  try {
    // Convert Set to Array for JSON serialization
    const serializable: StoredFastCutState = {
      ...state,
      selectedSearchKeywords: Array.from(state.selectedSearchKeywords),
      _sessionId: sessionId || undefined, // Store session ID for validation
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (err) {
    console.error("Failed to save Fast Cut state to sessionStorage:", err);
  }
}

function loadFromSessionStorage(currentSessionId?: string | null): Partial<FastCutState> | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as StoredFastCutState;

    // CRITICAL: Validate session ID to prevent loading stale data from previous sessions
    // If the stored session ID doesn't match current session, ignore the stored state
    if (currentSessionId && parsed._sessionId && parsed._sessionId !== currentSessionId) {
      console.log(
        "[FastCutContext] Session ID mismatch - stored:",
        parsed._sessionId,
        "current:",
        currentSessionId,
        "- ignoring stored state"
      );
      clearFastCutSessionStorage(); // Clean up stale data
      return null;
    }

    // Convert Array back to Set
    return {
      ...parsed,
      selectedSearchKeywords: new Set(parsed.selectedSearchKeywords || []),
    };
  } catch (err) {
    console.error("Failed to load Fast Cut state from sessionStorage:", err);
    return null;
  }
}

/**
 * Clear Fast Cut session storage.
 * Exported for use by session-store when creating new sessions.
 */
export function clearFastCutSessionStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    console.log("[FastCutContext] Cleared sessionStorage");
  } catch (err) {
    console.error("Failed to clear Fast Cut state from sessionStorage:", err);
  }
}

// ============================================================================
// Context
// ============================================================================

const FastCutContext = createContext<FastCutContextType | null>(null);

export function useFastCut() {
  const context = useContext(FastCutContext);
  if (!context) {
    throw new Error("useFastCut must be used within a FastCutProvider");
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface FastCutProviderProps {
  children: ReactNode;
}

export function FastCutProvider({ children }: FastCutProviderProps) {
  // Get initial data from workflow store
  const { start, analyze, discover } = useWorkflowStore(
    useShallow((state) => ({
      start: state.start,
      analyze: state.analyze,
      discover: state.discover,
    }))
  );

  // Get current session ID for state validation
  const activeSessionId = useSessionStore((state) => state.activeSession?.id);

  // Get auth state to check if user is authenticated
  const { isAuthenticated, _hasHydrated: authHydrated } = useAuthStore(
    useShallow((state) => ({
      isAuthenticated: state.isAuthenticated,
      _hasHydrated: state._hasHydrated,
    }))
  );

  // Track which session ID was used for hydration
  // This allows re-hydration when switching between sessions
  const [hydratedForSessionId, setHydratedForSessionId] = useState<string | null>(null);

  // State - initialize with default, will hydrate from sessionStorage after mount
  const [state, setState] = useState<FastCutState>(() => {
    // During SSR or initial mount, start with initial state
    // Actual restoration from sessionStorage happens in useEffect below
    return initialState;
  });

  // Hydrate from sessionStorage after mount (client-side only)
  // This is necessary because sessionStorage is not available during SSR
  // CRITICAL: Re-hydrates when session ID changes to prevent stale data from previous sessions
  useEffect(() => {
    // CRITICAL FIX: When activeSessionId becomes null and we had a previous session,
    // reset the state to prevent stale data from flashing when a new session is created
    if (!activeSessionId) {
      if (hydratedForSessionId !== null) {
        console.log("[FastCutProvider] Session cleared, resetting state from previous session:", hydratedForSessionId);
        clearFastCutSessionStorage();
        setState({ ...initialState, isHydrated: false });
        setHydratedForSessionId(null);
      }
      console.log("[FastCutProvider] Waiting for activeSessionId to be available...");
      return;
    }

    // Skip if we've already hydrated for this specific session
    if (hydratedForSessionId === activeSessionId) {
      return;
    }

    // CRITICAL: Clear any stale state when switching to a different session
    if (hydratedForSessionId !== null && hydratedForSessionId !== activeSessionId) {
      console.log("[FastCutProvider] Session changed from", hydratedForSessionId, "to", activeSessionId, "- clearing stale state");
      clearFastCutSessionStorage();
    }

    // CRITICAL: Pass current session ID to validate stored state
    // This prevents loading stale data from previous sessions
    const storedState = loadFromSessionStorage(activeSessionId);
    // Restore from sessionStorage if we have valid state with script data OR scene analysis
    const hasValidStoredState = storedState && (
      storedState.scriptData ||
      storedState.hasSceneAnalysis ||
      (storedState.selectedImages && storedState.selectedImages.length > 0)
    );
    if (hasValidStoredState) {
      // We have valid stored state that matches current session
      console.log("[FastCutProvider] Restoring state from sessionStorage for session:", activeSessionId);
      setState({
        ...initialState,
        ...storedState,
        isHydrated: true,
      } as FastCutState);
    } else {
      // Otherwise initialize with data from workflow store (fresh state for new session)
      console.log("[FastCutProvider] Initializing fresh state for session:", activeSessionId);
      const initialPrompt = analyze.optimizedPrompt || analyze.selectedIdea?.description || "";
      const fastCutData = analyze.selectedIdea?.fastCutData;

      // Check for scene analysis keywords from Start page (new Fast Cut flow)
      const sceneAnalysis = start.source?.type === "video" ? start.source.aiAnalysis?.sceneAnalysis : null;
      const sceneKeywords = sceneAnalysis?.allImageKeywords || [];

      // Priority: sceneAnalysis keywords > fastCutData keywords > discover keywords
      const initialKeywords = sceneKeywords.length > 0
        ? sceneKeywords
        : fastCutData?.searchKeywords?.length
          ? fastCutData.searchKeywords
          : discover.keywords;

      console.log("[FastCutProvider] Keywords source:", sceneKeywords.length > 0 ? "sceneAnalysis" : (fastCutData?.searchKeywords?.length ? "fastCutData" : "discover"));
      console.log("[FastCutProvider] Initial keywords count:", initialKeywords.length);

      setState({
        ...initialState,
        prompt: initialPrompt,
        editableKeywords: [...initialKeywords],
        selectedSearchKeywords: new Set(initialKeywords),
        campaignId: analyze.campaignId || null,  // CRITICAL: Also sync campaignId from workflow
        campaignName: analyze.campaignName || "",
        hasSceneAnalysis: sceneKeywords.length > 0,  // Track if we have scene analysis
        isHydrated: true,
      });
    }

    // Mark that we've hydrated for this specific session
    setHydratedForSessionId(activeSessionId);
  }, [hydratedForSessionId, activeSessionId, analyze.optimizedPrompt, analyze.selectedIdea, analyze.campaignId, analyze.campaignName, discover.keywords, start.source]);

  // Save state to sessionStorage whenever it changes (only after hydration)
  // Include session ID for future validation
  useEffect(() => {
    // Only save after we've hydrated for a session
    if (hydratedForSessionId) {
      saveToSessionStorage(state, activeSessionId);
    }
  }, [state, hydratedForSessionId, activeSessionId]);

  // Sync prompt from workflow store when it changes (within same session)
  // This handles the case when start page updates analyze.optimizedPrompt after hydration
  useEffect(() => {
    // Only sync if we're already hydrated for this session
    if (!state.isHydrated || hydratedForSessionId !== activeSessionId) {
      return;
    }

    // Get the video concept prompt from workflow store
    const videoConceptPrompt = analyze.optimizedPrompt || "";

    // Only sync if:
    // 1. There's a video concept prompt from workflow store
    // 2. Current prompt is empty or hasn't been set yet
    // This avoids overwriting user edits
    if (videoConceptPrompt && !state.prompt) {
      console.log("[FastCutProvider] Syncing video concept prompt from workflow store:", videoConceptPrompt.substring(0, 50) + "...");
      setState((prev) => ({
        ...prev,
        prompt: videoConceptPrompt,
      }));
    }
  }, [state.isHydrated, state.prompt, hydratedForSessionId, activeSessionId, analyze.optimizedPrompt]);

  // Fetch style sets when authenticated
  useEffect(() => {
    // Only fetch when auth has hydrated and user is authenticated
    if (!authHydrated || !isAuthenticated) {
      return;
    }

    const fetchStyleSets = async () => {
      try {
        const result = await fastCutApi.getStyleSets();
        setState((prev) => ({ ...prev, styleSets: result.styleSets }));
      } catch (err) {
        console.error("Failed to fetch style sets:", err);
      }
    };
    fetchStyleSets();
  }, [authHydrated, isAuthenticated]);

  // Actions
  const setCurrentStep = useCallback((step: FastCutStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const canProceed = useCallback(() => {
    switch (state.currentStep) {
      case "script":
        // Script step can be bypassed if we have scene analysis from Start page
        return state.scriptData !== null || state.hasSceneAnalysis;
      case "images":
        return state.selectedImages.length >= 3;
      case "music":
        return state.selectedAudio !== null || state.musicSkipped;
      case "effects":
        return false; // Final step
      default:
        return false;
    }
  }, [state.currentStep, state.scriptData, state.hasSceneAnalysis, state.selectedImages, state.selectedAudio, state.musicSkipped]);

  const setCampaignId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, campaignId: id }));
  }, []);

  const setCampaignName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, campaignName: name }));
  }, []);

  // Script actions
  const setPrompt = useCallback((prompt: string) => {
    setState((prev) => ({ ...prev, prompt }));
  }, []);

  const setAspectRatio = useCallback((aspectRatio: string) => {
    setState((prev) => ({ ...prev, aspectRatio }));
  }, []);

  const setEditableKeywords = useCallback((editableKeywords: string[]) => {
    setState((prev) => ({ ...prev, editableKeywords }));
  }, []);

  const setSelectedSearchKeywords = useCallback((selectedSearchKeywords: Set<string>) => {
    setState((prev) => ({ ...prev, selectedSearchKeywords }));
  }, []);

  const setGeneratingScript = useCallback((generatingScript: boolean) => {
    setState((prev) => ({ ...prev, generatingScript }));
  }, []);

  const setScriptData = useCallback((scriptData: ScriptGenerationResponse | null) => {
    setState((prev) => ({ ...prev, scriptData }));
  }, []);

  const setTiktokSEO = useCallback((tiktokSEO: TikTokSEO | null) => {
    setState((prev) => ({ ...prev, tiktokSEO }));
  }, []);

  // Images actions
  const setSearchingImages = useCallback((searchingImages: boolean) => {
    setState((prev) => ({ ...prev, searchingImages }));
  }, []);

  const setImageCandidates = useCallback((imageCandidates: ImageCandidate[]) => {
    setState((prev) => ({ ...prev, imageCandidates }));
  }, []);

  const setSelectedImages = useCallback((selectedImages: ImageCandidate[]) => {
    setState((prev) => ({ ...prev, selectedImages }));
  }, []);

  const setGenerationId = useCallback((generationId: string | null) => {
    setState((prev) => ({ ...prev, generationId }));
  }, []);

  const addSelectedImage = useCallback((image: ImageCandidate) => {
    setState((prev) => ({
      ...prev,
      selectedImages: [...prev.selectedImages, image],
    }));
  }, []);

  const removeSelectedImage = useCallback((imageId: string) => {
    setState((prev) => ({
      ...prev,
      selectedImages: prev.selectedImages.filter((img) => img.id !== imageId),
    }));
  }, []);

  // Music actions
  const setMatchingMusic = useCallback((matchingMusic: boolean) => {
    setState((prev) => ({ ...prev, matchingMusic }));
  }, []);

  const setAudioMatches = useCallback((audioMatches: AudioMatch[]) => {
    setState((prev) => ({ ...prev, audioMatches }));
  }, []);

  const setSelectedAudio = useCallback((selectedAudio: AudioMatch | null) => {
    setState((prev) => ({ ...prev, selectedAudio }));
  }, []);

  const setAudioStartTime = useCallback((audioStartTime: number) => {
    setState((prev) => ({ ...prev, audioStartTime }));
  }, []);

  const setVideoDuration = useCallback((videoDuration: number) => {
    setState((prev) => ({ ...prev, videoDuration }));
  }, []);

  const setAudioAnalysis = useCallback((audioAnalysis: AudioAnalysisResponse | null) => {
    setState((prev) => ({ ...prev, audioAnalysis }));
  }, []);

  const setAnalyzingAudio = useCallback((analyzingAudio: boolean) => {
    setState((prev) => ({ ...prev, analyzingAudio }));
  }, []);

  const setMusicSkipped = useCallback((musicSkipped: boolean) => {
    setState((prev) => ({ ...prev, musicSkipped }));
  }, []);

  const setSubtitleMode = useCallback((subtitleMode: SubtitleMode) => {
    setState((prev) => ({ ...prev, subtitleMode }));
  }, []);

  const setAudioLyricsText = useCallback((audioLyricsText: string | null) => {
    setState((prev) => ({ ...prev, audioLyricsText }));
  }, []);

  // Effects actions
  const setStyleSetId = useCallback((styleSetId: string) => {
    setState((prev) => ({ ...prev, styleSetId }));
  }, []);

  const setStyleSets = useCallback((styleSets: StyleSetSummary[]) => {
    setState((prev) => ({ ...prev, styleSets }));
  }, []);

  const setRendering = useCallback((rendering: boolean) => {
    setState((prev) => ({ ...prev, rendering }));
  }, []);

  // Error
  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  // Reset
  const reset = useCallback(() => {
    clearFastCutSessionStorage();
    setState(initialState);
  }, []);

  const value: FastCutContextType = {
    ...state,
    setCurrentStep,
    canProceed,
    setCampaignId,
    setCampaignName,
    setPrompt,
    setAspectRatio,
    setEditableKeywords,
    setSelectedSearchKeywords,
    setGeneratingScript,
    setScriptData,
    setTiktokSEO,
    setSearchingImages,
    setImageCandidates,
    setSelectedImages,
    setGenerationId,
    addSelectedImage,
    removeSelectedImage,
    setMatchingMusic,
    setAudioMatches,
    setSelectedAudio,
    setAudioStartTime,
    setVideoDuration,
    setAudioAnalysis,
    setAnalyzingAudio,
    setMusicSkipped,
    setSubtitleMode,
    setAudioLyricsText,
    setStyleSetId,
    setStyleSets,
    setRendering,
    setError,
    reset,
  };

  return (
    <FastCutContext.Provider value={value}>
      {children}
    </FastCutContext.Provider>
  );
}
