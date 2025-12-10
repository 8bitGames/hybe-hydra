"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { useSessionStore } from "@/lib/stores/session-store";
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

interface FastCutState {
  // Current step
  currentStep: FastCutStep;

  // Campaign info
  campaignId: string | null;
  campaignName: string;

  // Script step
  prompt: string;
  aspectRatio: string;
  editableKeywords: string[];
  selectedSearchKeywords: Set<string>;
  generatingScript: boolean;
  scriptData: ScriptGenerationResponse | null;
  tiktokSEO: TikTokSEO | null;

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
  audioAnalysis: AudioAnalysisResponse | null;
  analyzingAudio: boolean;
  musicSkipped: boolean;

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
  setAudioAnalysis: (analysis: AudioAnalysisResponse | null) => void;
  setAnalyzingAudio: (loading: boolean) => void;
  setMusicSkipped: (skipped: boolean) => void;

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
  searchingImages: false,
  imageCandidates: [],
  selectedImages: [],
  generationId: null,
  matchingMusic: false,
  audioMatches: [],
  selectedAudio: null,
  audioStartTime: 0,
  audioAnalysis: null,
  analyzingAudio: false,
  musicSkipped: false,
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

  // Track if we've hydrated from sessionStorage (client-side only)
  const [isHydrated, setIsHydrated] = useState(false);

  // State - initialize with default, will hydrate from sessionStorage after mount
  const [state, setState] = useState<FastCutState>(() => {
    // During SSR or initial mount, start with initial state
    // Actual restoration from sessionStorage happens in useEffect below
    return initialState;
  });

  // Hydrate from sessionStorage after mount (client-side only)
  // This is necessary because sessionStorage is not available during SSR
  useEffect(() => {
    if (isHydrated) return;

    // CRITICAL: Pass current session ID to validate stored state
    // This prevents loading stale data from previous sessions
    const storedState = loadFromSessionStorage(activeSessionId);
    if (storedState && storedState.scriptData) {
      // We have valid stored state with script data that matches current session
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
      const initialKeywords = fastCutData?.searchKeywords?.length
        ? fastCutData.searchKeywords
        : discover.keywords;

      setState({
        ...initialState,
        prompt: initialPrompt,
        editableKeywords: [...initialKeywords],
        selectedSearchKeywords: new Set(initialKeywords),
        campaignId: analyze.campaignId || null,  // CRITICAL: Also sync campaignId from workflow
        campaignName: analyze.campaignName || "",
        isHydrated: true,
      });
    }

    setIsHydrated(true);
  }, [isHydrated, activeSessionId, analyze.optimizedPrompt, analyze.selectedIdea, analyze.campaignId, analyze.campaignName, discover.keywords]);

  // Save state to sessionStorage whenever it changes (only after hydration)
  // Include session ID for future validation
  useEffect(() => {
    if (isHydrated) {
      saveToSessionStorage(state, activeSessionId);
    }
  }, [state, isHydrated, activeSessionId]);

  // Fetch style sets on mount
  useEffect(() => {
    const fetchStyleSets = async () => {
      try {
        const result = await fastCutApi.getStyleSets();
        setState((prev) => ({ ...prev, styleSets: result.styleSets }));
      } catch (err) {
        console.error("Failed to fetch style sets:", err);
      }
    };
    fetchStyleSets();
  }, []);

  // Actions
  const setCurrentStep = useCallback((step: FastCutStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const canProceed = useCallback(() => {
    switch (state.currentStep) {
      case "script":
        return state.scriptData !== null;
      case "images":
        return state.selectedImages.length >= 3;
      case "music":
        return state.selectedAudio !== null || state.musicSkipped;
      case "effects":
        return false; // Final step
      default:
        return false;
    }
  }, [state.currentStep, state.scriptData, state.selectedImages, state.selectedAudio, state.musicSkipped]);

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

  const setAudioAnalysis = useCallback((audioAnalysis: AudioAnalysisResponse | null) => {
    setState((prev) => ({ ...prev, audioAnalysis }));
  }, []);

  const setAnalyzingAudio = useCallback((analyzingAudio: boolean) => {
    setState((prev) => ({ ...prev, analyzingAudio }));
  }, []);

  const setMusicSkipped = useCallback((musicSkipped: boolean) => {
    setState((prev) => ({ ...prev, musicSkipped }));
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
    setAudioAnalysis,
    setAnalyzingAudio,
    setMusicSkipped,
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
