import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/auth-store";
import {
  useWorkflowStore,
  type WorkflowStage,
  type StartData,
  type AnalyzeData,
  type CreateData,
  type ProcessingData,
  type PublishData,
} from "./workflow-store";

// ============================================
// STORAGE CLEANUP UTILITIES
// ============================================

/**
 * Clear Fast Cut session storage.
 * This is a standalone function to avoid circular dependency with fast-cut-context.tsx
 */
const clearFastCutStorage = () => {
  try {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("fast-cut-state");
      console.log("[SessionStore] Cleared fast-cut sessionStorage");
    }
  } catch (err) {
    console.error("[SessionStore] Failed to clear fast-cut sessionStorage:", err);
  }
};

/**
 * Clear all session-related storage when starting a new session.
 * This prevents stale data from previous sessions from persisting.
 * Exported for use in components that need to ensure clean state.
 */
export const clearAllSessionStorage = () => {
  console.log("[SessionStore] Clearing all session-related storage for new session");

  // 1. Clear workflow store localStorage (handled by resetWorkflow, but do it explicitly too)
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem("hydra-workflow-state");
    }
  } catch (err) {
    console.error("[SessionStore] Failed to clear workflow localStorage:", err);
  }

  // 2. Clear fast-cut sessionStorage
  clearFastCutStorage();
};

// ============================================
// TYPES
// ============================================

export type SessionStatus =
  | "draft"
  | "in_progress"
  | "paused"
  | "completed"
  | "abandoned";

export type EntrySource = "trends" | "video" | "idea";

export interface SessionMetadata {
  entrySource: EntrySource | null;
  contentType: "ai_video" | "fast-cut" | null;
  totalGenerations: number;
  approvedVideos: number;
  title: string;
}

// Fast Cut stage data types (simplified for session persistence)
export interface ScriptStageData {
  prompt: string;
  aspectRatio: string;
  editableKeywords: string[];
  selectedSearchKeywords: string[];
  scriptData: unknown | null;
  tiktokSEO: unknown | null;
}

export interface ImagesStageData {
  imageCandidates: unknown[];
  selectedImages: unknown[];
  generationId: string | null;
}

export interface MusicStageData {
  audioMatches: unknown[];
  selectedAudio: unknown | null;
  audioStartTime: number;
  audioAnalysis: unknown | null;
  musicSkipped: boolean;
}

export interface EffectsStageData {
  styleSetId: string;
  styleSets: unknown[];
}

export interface RenderStageData {
  renderedVideoUrl: string | null;
  thumbnailUrl: string | null;
  renderStatus: "pending" | "rendering" | "completed" | "failed";
}

export interface StageData {
  // Common start stage
  start: StartData | null;
  // AI Video stages
  analyze: AnalyzeData | null;
  create: CreateData | null;
  processing: ProcessingData | null;
  publish: PublishData | null;
  // Fast Cut stages
  script: ScriptStageData | null;
  images: ImagesStageData | null;
  music: MusicStageData | null;
  effects: EffectsStageData | null;
  render: RenderStageData | null;
}

export interface CreationSession {
  id: string;
  userId: string;
  campaignId: string | null;
  status: SessionStatus;
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];
  stageData: StageData;
  metadata: SessionMetadata;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface SessionSummary {
  id: string;
  status: SessionStatus;
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];
  metadata: SessionMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// INITIAL STATE
// ============================================

const createInitialStageData = (): StageData => ({
  // Common start stage
  start: null,
  // AI Video stages
  analyze: null,
  create: null,
  processing: null,
  publish: null,
  // Fast Cut stages
  script: null,
  images: null,
  music: null,
  effects: null,
  render: null,
});

const createInitialMetadata = (): SessionMetadata => ({
  entrySource: null,
  contentType: null,
  totalGenerations: 0,
  approvedVideos: 0,
  title: "",
});

// ============================================
// STORE INTERFACE
// ============================================

interface SessionState {
  // Current active session
  activeSession: CreationSession | null;

  // Session list (cached)
  sessions: SessionSummary[];
  sessionsLoading: boolean;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;

  // Recovery
  hasLocalRecovery: boolean;
  localRecoveryData: CreationSession | null;
}

interface SessionActions {
  // Session Lifecycle
  createSession: (options?: {
    entrySource?: EntrySource;
    userId?: string;
    initialStartData?: Partial<StartData>;
  }) => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
  saveSession: (options?: { force?: boolean }) => Promise<void>;
  pauseSession: () => Promise<void>;
  completeSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  // Stage Management
  updateStageData: <T extends WorkflowStage>(
    stage: T,
    data: Partial<StageData[T] extends null ? never : NonNullable<StageData[T]>>
  ) => void;
  setStageData: <T extends WorkflowStage>(
    stage: T,
    data: StageData[T]
  ) => void;
  proceedToStage: (stage: WorkflowStage) => Promise<void>;
  markStageCompleted: (stage: WorkflowStage) => void;

  // Metadata
  updateMetadata: (metadata: Partial<SessionMetadata>) => void;
  setSessionTitle: (title: string) => void;

  // Session List
  fetchSessions: (options?: { userId?: string }) => Promise<void>;
  refreshSessions: (options?: { userId?: string }) => Promise<void>;

  // Recovery
  checkLocalRecovery: () => Promise<void>;
  recoverFromLocal: () => Promise<void>;
  discardLocalRecovery: () => void;

  // Internal
  _saveToIndexedDB: () => Promise<void>;
  _loadFromIndexedDB: (sessionId: string) => Promise<CreationSession | null>;
  _clearIndexedDB: (sessionId: string) => Promise<void>;

  // Reset
  clearActiveSession: () => void;
  reset: () => void;
}

type SessionStore = SessionState & SessionActions;

// ============================================
// INDEXEDDB HELPERS
// ============================================

const DB_NAME = "hydra-sessions";
const DB_VERSION = 1;
const STORE_NAME = "sessions";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
  });
};

const saveToIDB = async (session: CreationSession): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: session.completedAt?.toISOString() || null,
    });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const loadFromIDB = async (sessionId: string): Promise<CreationSession | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(sessionId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const data = request.result;
      if (data) {
        resolve({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          completedAt: data.completedAt ? new Date(data.completedAt) : null,
        });
      } else {
        resolve(null);
      }
    };
  });
};

const deleteFromIDB = async (sessionId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(sessionId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const getAllFromIDB = async (): Promise<CreationSession[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const data = request.result || [];
      resolve(
        data.map((item: Record<string, unknown>) => ({
          ...item,
          createdAt: new Date(item.createdAt as string),
          updatedAt: new Date(item.updatedAt as string),
          completedAt: item.completedAt ? new Date(item.completedAt as string) : null,
        })) as CreationSession[]
      );
    };
  });
};

// ============================================
// SUPABASE HELPERS
// ============================================

const sessionToDBRow = (session: CreationSession) => ({
  id: session.id,
  user_id: session.userId,
  campaign_id: session.campaignId,
  status: session.status,
  current_stage: session.currentStage,
  completed_stages: session.completedStages,
  // AI Video stage data
  start_data: session.stageData.start,
  analyze_data: session.stageData.analyze,
  create_data: session.stageData.create,
  processing_data: session.stageData.processing,
  publish_data: session.stageData.publish,
  // Fast Cut stage data
  script_data: session.stageData.script,
  images_data: session.stageData.images,
  music_data: session.stageData.music,
  effects_data: session.stageData.effects,
  render_data: session.stageData.render,
  // Metadata
  entry_source: session.metadata.entrySource,
  content_type: session.metadata.contentType,
  total_generations: session.metadata.totalGenerations,
  approved_videos: session.metadata.approvedVideos,
  title: session.metadata.title,
  completed_at: session.completedAt?.toISOString() || null,
});

const dbRowToSession = (row: Record<string, unknown>): CreationSession => ({
  id: row.id as string,
  userId: row.user_id as string,
  campaignId: row.campaign_id as string | null,
  status: row.status as SessionStatus,
  currentStage: row.current_stage as WorkflowStage,
  completedStages: (row.completed_stages as WorkflowStage[]) || [],
  stageData: {
    // Common start stage
    start: row.start_data as StartData | null,
    // AI Video stages
    analyze: row.analyze_data as AnalyzeData | null,
    create: row.create_data as CreateData | null,
    processing: row.processing_data as ProcessingData | null,
    publish: row.publish_data as PublishData | null,
    // Fast Cut stages
    script: row.script_data as ScriptStageData | null,
    images: row.images_data as ImagesStageData | null,
    music: row.music_data as MusicStageData | null,
    effects: row.effects_data as EffectsStageData | null,
    render: row.render_data as RenderStageData | null,
  },
  metadata: {
    entrySource: row.entry_source as EntrySource | null,
    contentType: row.content_type as "ai_video" | "fast-cut" | null,
    totalGenerations: (row.total_generations as number) || 0,
    approvedVideos: (row.approved_videos as number) || 0,
    title: (row.title as string) || "",
  },
  createdAt: new Date(row.created_at as string),
  updatedAt: new Date(row.updated_at as string),
  completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
});

const dbRowToSummary = (row: Record<string, unknown>): SessionSummary => ({
  id: row.id as string,
  status: row.status as SessionStatus,
  currentStage: row.current_stage as WorkflowStage,
  completedStages: (row.completed_stages as WorkflowStage[]) || [],
  metadata: {
    entrySource: row.entry_source as EntrySource | null,
    contentType: row.content_type as "ai_video" | "fast-cut" | null,
    totalGenerations: (row.total_generations as number) || 0,
    approvedVideos: (row.approved_videos as number) || 0,
    title: (row.title as string) || "",
  },
  createdAt: new Date(row.created_at as string),
  updatedAt: new Date(row.updated_at as string),
});

// ============================================
// FAST CUT SESSION STORAGE HELPER
// ============================================

const FAST_CUT_STORAGE_KEY = "fast-cut-state";

/**
 * Builds a FastCutState object from session data for sessionStorage restoration.
 * This allows resuming Fast Cut workflows from a loaded session.
 */
const buildFastCutStateFromSession = (session: CreationSession): Record<string, unknown> | null => {
  const { stageData, campaignId, metadata } = session;
  const { script, images, music, effects } = stageData;

  // If no script data, cannot restore Fast Cut state
  if (!script?.scriptData) {
    console.log("[SessionStore] Cannot restore Fast Cut state: no script data");
    return null;
  }

  // Map session stage to Fast Cut step
  const stageToStep: Record<string, string> = {
    script: "script",
    images: "images",
    music: "music",
    effects: "effects",
    render: "effects",
  };

  const currentStep = stageToStep[session.currentStage] || "script";

  // Build the Fast Cut state object matching the FastCutState interface
  const fastCutState = {
    // Current step
    currentStep,

    // Campaign info
    campaignId: campaignId || null,
    campaignName: metadata.title || "",

    // Script step
    prompt: script.prompt || "",
    aspectRatio: script.aspectRatio || "9:16",
    editableKeywords: script.editableKeywords || [],
    // Note: selectedSearchKeywords is stored as Array in sessionStorage
    selectedSearchKeywords: script.selectedSearchKeywords || [],
    generatingScript: false,
    scriptData: script.scriptData,
    tiktokSEO: script.tiktokSEO || null,

    // Images step
    searchingImages: false,
    imageCandidates: images?.imageCandidates || [],
    selectedImages: images?.selectedImages || [],
    generationId: images?.generationId || null,

    // Music step
    matchingMusic: false,
    audioMatches: music?.audioMatches || [],
    selectedAudio: music?.selectedAudio || null,
    audioStartTime: music?.audioStartTime || 0,
    audioAnalysis: music?.audioAnalysis || null,
    analyzingAudio: false,
    musicSkipped: music?.musicSkipped || false,

    // Effects step
    styleSetId: effects?.styleSetId || "viral_tiktok",
    styleSets: effects?.styleSets || [],
    rendering: false,

    // Error state
    error: null,
  };

  return fastCutState;
};

/**
 * Saves Fast Cut state to sessionStorage so FastCutProvider can restore it
 */
const saveFastCutStateToSessionStorage = (state: Record<string, unknown>): void => {
  try {
    sessionStorage.setItem(FAST_CUT_STORAGE_KEY, JSON.stringify(state));
    console.log("[SessionStore] Restored Fast Cut state to sessionStorage");
  } catch (err) {
    console.error("[SessionStore] Failed to save Fast Cut state to sessionStorage:", err);
  }
};

// ============================================
// AUTO-SAVE DEBOUNCE
// ============================================

let saveTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 3000;

const debouncedSave = (saveFn: () => Promise<void>) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(async () => {
    try {
      await saveFn();
    } catch (error) {
      console.error("[SessionStore] Auto-save failed:", error);
    }
  }, DEBOUNCE_MS);
};

// ============================================
// STORE
// ============================================

export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    activeSession: null,
    sessions: [],
    sessionsLoading: false,
    isLoading: false,
    isSaving: false,
    lastSavedAt: null,
    saveError: null,
    hasLocalRecovery: false,
    localRecoveryData: null,

    // ==========================================
    // SESSION LIFECYCLE
    // ==========================================

    createSession: async (options?: {
      entrySource?: EntrySource;
      userId?: string;
      initialStartData?: Partial<StartData>;
    }) => {
      // Get user from options or fall back to auth store
      let userId = options?.userId;

      if (!userId) {
        // Fall back to auth store (may not work in all contexts)
        const authState = useAuthStore.getState();
        userId = authState.user?.id;

        console.log("[SessionStore] createSession - Auth state fallback:", {
          userId,
          isAuthenticated: authState.isAuthenticated,
          hasHydrated: authState._hasHydrated,
        });
      }

      if (!userId) {
        throw new Error("User not authenticated - userId is required");
      }

      // CRITICAL: Clear ALL session-related storage FIRST
      // This must happen before resetWorkflow to ensure no stale data persists
      clearAllSessionStorage();

      // IMPORTANT: Reset workflow store BEFORE creating new session
      // This clears any leftover data from previous sessions
      // Note: resetWorkflow also clears localStorage, but we clear it explicitly above too
      const workflowStore = useWorkflowStore.getState();
      workflowStore.resetWorkflow();
      console.log("[SessionStore] Reset workflow store for new session");

      const supabase = createClient();

      const sessionId = crypto.randomUUID();
      const now = new Date();

      // Create initial stage data, optionally with provided start data
      const initialStageData = createInitialStageData();
      if (options?.initialStartData) {
        initialStageData.start = options.initialStartData as StartData;
      }

      // Determine initial contentType from initialStartData or default based on entrySource
      // AI Video workflow is the default for video and trends entries
      const initialContentType = options?.initialStartData?.contentType ||
        (options?.entrySource ? "ai_video" : null);

      const newSession: CreationSession = {
        id: sessionId,
        userId,
        campaignId: null,
        status: "draft",
        currentStage: "start",
        completedStages: [],
        stageData: initialStageData,
        metadata: {
          ...createInitialMetadata(),
          entrySource: options?.entrySource || null,
          contentType: initialContentType,
        },
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };

      // Save to DB
      const { error } = await supabase
        .from("creation_sessions")
        .insert(sessionToDBRow(newSession));

      if (error) {
        console.error("[SessionStore] Failed to create session:", error);
        throw error;
      }

      // Save to IndexedDB
      await saveToIDB(newSession);

      set({
        activeSession: newSession,
        lastSavedAt: now,
        saveError: null,
      });

      // If initial start data was provided, sync it to workflow store
      if (options?.initialStartData) {
        const updatedWorkflowStore = useWorkflowStore.getState();
        if (options.initialStartData.source?.type === "video") {
          updatedWorkflowStore.setStartFromVideo(options.initialStartData.source);
        } else if (options.initialStartData.source?.type === "trends") {
          updatedWorkflowStore.setStartFromTrends(options.initialStartData.source);
        } else if (options.initialStartData.source?.type === "idea") {
          updatedWorkflowStore.setStartFromIdea(options.initialStartData.source);
        }
        console.log("[SessionStore] Synced initial start data to workflow store");
      }

      console.log("[SessionStore] Created new session:", sessionId);
      return sessionId;
    },

    loadSession: async (sessionId: string) => {
      set({ isLoading: true });

      try {
        // CRITICAL: Clear ALL session-related storage FIRST when switching sessions
        // This prevents data leakage from previously active sessions
        clearAllSessionStorage();

        // Reset workflow store (also clears localStorage, but we clear it explicitly above too)
        const workflowStore = useWorkflowStore.getState();
        workflowStore.resetWorkflow();
        console.log("[SessionStore] Reset workflow store before loading session:", sessionId);

        // First, try to load from IndexedDB (faster)
        let session = await loadFromIDB(sessionId);

        if (!session) {
          // Fall back to Supabase
          const supabase = createClient();
          const { data, error } = await supabase
            .from("creation_sessions")
            .select("*")
            .eq("id", sessionId)
            .single();

          if (error) throw error;
          if (!data) throw new Error("Session not found");

          session = dbRowToSession(data);

          // Cache to IndexedDB
          await saveToIDB(session);
        }

        // Update status to in_progress if it was paused or draft
        if (session.status === "paused" || session.status === "draft") {
          session = { ...session, status: "in_progress", updatedAt: new Date() };

          const supabase = createClient();
          await supabase
            .from("creation_sessions")
            .update({ status: "in_progress" })
            .eq("id", sessionId);

          await saveToIDB(session);
        }

        set({
          activeSession: session,
          isLoading: false,
          lastSavedAt: session.updatedAt,
        });

        // Restore Fast Cut state to sessionStorage if this is a Fast Cut session
        if (session.metadata.contentType === "fast-cut") {
          const fastCutState = buildFastCutStateFromSession(session);
          if (fastCutState) {
            saveFastCutStateToSessionStorage(fastCutState);
            console.log("[SessionStore] Restored Fast Cut state for session:", sessionId);
          }
        }

        console.log("[SessionStore] Loaded session:", sessionId);
      } catch (error) {
        console.error("[SessionStore] Failed to load session:", error);
        set({ isLoading: false, saveError: (error as Error).message });
        throw error;
      }
    },

    saveSession: async (options?: { force?: boolean }) => {
      const { activeSession, isSaving } = get();

      if (!activeSession) {
        console.warn("[SessionStore] No active session to save");
        return;
      }

      if (isSaving && !options?.force) {
        console.log("[SessionStore] Save already in progress");
        return;
      }

      set({ isSaving: true, saveError: null });

      try {
        const now = new Date();
        const updatedSession = { ...activeSession, updatedAt: now };

        // Save to IndexedDB first (fast)
        await saveToIDB(updatedSession);

        // Save to Supabase
        const supabase = createClient();
        const { error } = await supabase
          .from("creation_sessions")
          .update(sessionToDBRow(updatedSession))
          .eq("id", activeSession.id);

        if (error) throw error;

        set({
          activeSession: updatedSession,
          isSaving: false,
          lastSavedAt: now,
        });

        console.log("[SessionStore] Saved session:", activeSession.id);
      } catch (error) {
        console.error("[SessionStore] Failed to save session:", error);
        set({
          isSaving: false,
          saveError: (error as Error).message,
        });
        throw error;
      }
    },

    pauseSession: async () => {
      const { activeSession } = get();
      if (!activeSession) return;

      const supabase = createClient();
      const now = new Date();

      const { error } = await supabase
        .from("creation_sessions")
        .update({ status: "paused", updated_at: now.toISOString() })
        .eq("id", activeSession.id);

      if (error) {
        console.error("[SessionStore] Failed to pause session:", error);
        throw error;
      }

      const updatedSession = {
        ...activeSession,
        status: "paused" as SessionStatus,
        updatedAt: now,
      };

      await saveToIDB(updatedSession);

      set({
        activeSession: updatedSession,
        lastSavedAt: now,
      });

      console.log("[SessionStore] Paused session:", activeSession.id);
    },

    completeSession: async () => {
      const { activeSession } = get();
      if (!activeSession) return;

      const supabase = createClient();
      const now = new Date();

      const { error } = await supabase
        .from("creation_sessions")
        .update({
          status: "completed",
          completed_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", activeSession.id);

      if (error) {
        console.error("[SessionStore] Failed to complete session:", error);
        throw error;
      }

      // Clean up IndexedDB
      await deleteFromIDB(activeSession.id);

      set({
        activeSession: {
          ...activeSession,
          status: "completed",
          completedAt: now,
          updatedAt: now,
        },
        lastSavedAt: now,
      });

      console.log("[SessionStore] Completed session:", activeSession.id);
    },

    deleteSession: async (sessionId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("creation_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) {
        console.error("[SessionStore] Failed to delete session:", error);
        throw error;
      }

      // Clean up IndexedDB
      await deleteFromIDB(sessionId);

      // Update state
      const { activeSession, sessions } = get();
      set({
        sessions: sessions.filter((s) => s.id !== sessionId),
        activeSession:
          activeSession?.id === sessionId ? null : activeSession,
      });

      console.log("[SessionStore] Deleted session:", sessionId);
    },

    // ==========================================
    // STAGE MANAGEMENT
    // ==========================================

    updateStageData: (stage, data) => {
      const { activeSession } = get();
      if (!activeSession) return;

      const currentStageData = activeSession.stageData[stage] || {};
      const updatedSession = {
        ...activeSession,
        stageData: {
          ...activeSession.stageData,
          [stage]: { ...currentStageData, ...data },
        },
        updatedAt: new Date(),
      };

      set({ activeSession: updatedSession });

      // Debounced auto-save to IndexedDB
      debouncedSave(() => get()._saveToIndexedDB());
    },

    setStageData: (stage, data) => {
      const { activeSession } = get();
      if (!activeSession) return;

      const updatedSession = {
        ...activeSession,
        stageData: {
          ...activeSession.stageData,
          [stage]: data,
        },
        updatedAt: new Date(),
      };

      set({ activeSession: updatedSession });

      // Debounced auto-save to IndexedDB
      debouncedSave(() => get()._saveToIndexedDB());
    },

    proceedToStage: async (stage: WorkflowStage) => {
      const { activeSession, saveSession } = get();
      if (!activeSession) return;

      // Mark current stage as completed and update stage in one operation
      // to avoid race condition with separate set calls
      const completedStages = activeSession.completedStages.includes(activeSession.currentStage)
        ? activeSession.completedStages
        : [...activeSession.completedStages, activeSession.currentStage];

      set({
        activeSession: {
          ...activeSession,
          currentStage: stage,
          completedStages,
          status: "in_progress",
          updatedAt: new Date(),
        },
      });

      // Save checkpoint to DB
      await saveSession({ force: true });

      console.log("[SessionStore] Proceeded to stage:", stage);
    },

    markStageCompleted: (stage: WorkflowStage) => {
      const { activeSession } = get();
      if (!activeSession) return;

      if (!activeSession.completedStages.includes(stage)) {
        set({
          activeSession: {
            ...activeSession,
            completedStages: [...activeSession.completedStages, stage],
          },
        });
      }
    },

    // ==========================================
    // METADATA
    // ==========================================

    updateMetadata: (metadata) => {
      const { activeSession } = get();
      if (!activeSession) return;

      set({
        activeSession: {
          ...activeSession,
          metadata: { ...activeSession.metadata, ...metadata },
          updatedAt: new Date(),
        },
      });

      debouncedSave(() => get()._saveToIndexedDB());
    },

    setSessionTitle: (title: string) => {
      get().updateMetadata({ title });
    },

    // ==========================================
    // SESSION LIST
    // ==========================================

    fetchSessions: async (options?: { userId?: string }) => {
      set({ sessionsLoading: true });

      try {
        // Get user from options or fall back to auth store
        let userId = options?.userId;

        if (!userId) {
          const authState = useAuthStore.getState();
          userId = authState.user?.id;

          console.log("[SessionStore] fetchSessions - Auth state fallback:", {
            userId,
            isAuthenticated: authState.isAuthenticated,
            hasHydrated: authState._hasHydrated,
          });
        }

        if (!userId) {
          console.log("[SessionStore] fetchSessions - No user, returning empty sessions");
          set({ sessionsLoading: false, sessions: [] });
          return;
        }

        console.log("[SessionStore] fetchSessions - Querying for userId:", userId);

        const supabase = createClient();
        const { data, error } = await supabase
          .from("creation_sessions")
          .select("*")
          .eq("user_id", userId)
          .neq("status", "abandoned")
          .order("updated_at", { ascending: false })
          .limit(50);

        console.log("[SessionStore] fetchSessions - Query result:", {
          dataLength: data?.length ?? 0,
          hasError: !!error,
          errorType: error ? typeof error : null,
        });

        if (error) {
          console.error("[SessionStore] Supabase error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            fullError: JSON.stringify(error),
          });
          throw error;
        }

        const sessions = (data || []).map(dbRowToSummary);
        set({ sessions, sessionsLoading: false });

        console.log("[SessionStore] Fetched", sessions.length, "sessions");
      } catch (error: unknown) {
        // Comprehensive error logging
        console.error("[SessionStore] Failed to fetch sessions - Full error:", error);
        console.error("[SessionStore] Error type:", typeof error);
        console.error("[SessionStore] Error stringified:", JSON.stringify(error, null, 2));

        if (error instanceof Error) {
          console.error("[SessionStore] Error message:", error.message);
          console.error("[SessionStore] Error stack:", error.stack);
        }

        set({ sessionsLoading: false, sessions: [] });
      }
    },

    refreshSessions: async (options?: { userId?: string }) => {
      await get().fetchSessions(options);
    },

    // ==========================================
    // RECOVERY
    // ==========================================

    checkLocalRecovery: async () => {
      try {
        const localSessions = await getAllFromIDB();

        // Find sessions that might need recovery (in_progress or draft with recent updates)
        const recoverableSessions = localSessions.filter((s) => {
          const isRecent = Date.now() - s.updatedAt.getTime() < 24 * 60 * 60 * 1000; // 24 hours
          return (s.status === "in_progress" || s.status === "draft") && isRecent;
        });

        if (recoverableSessions.length > 0) {
          // Sort by most recent
          recoverableSessions.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          );

          set({
            hasLocalRecovery: true,
            localRecoveryData: recoverableSessions[0],
          });

          console.log(
            "[SessionStore] Found recoverable session:",
            recoverableSessions[0].id
          );
        } else {
          set({ hasLocalRecovery: false, localRecoveryData: null });
        }
      } catch (error) {
        console.error("[SessionStore] Failed to check local recovery:", error);
        set({ hasLocalRecovery: false, localRecoveryData: null });
      }
    },

    recoverFromLocal: async () => {
      const { localRecoveryData, loadSession } = get();

      if (!localRecoveryData) {
        console.warn("[SessionStore] No local recovery data");
        return;
      }

      await loadSession(localRecoveryData.id);
      set({ hasLocalRecovery: false, localRecoveryData: null });

      console.log("[SessionStore] Recovered session from local:", localRecoveryData.id);
    },

    discardLocalRecovery: () => {
      const { localRecoveryData } = get();

      if (localRecoveryData) {
        deleteFromIDB(localRecoveryData.id).catch(console.error);
      }

      set({ hasLocalRecovery: false, localRecoveryData: null });
      console.log("[SessionStore] Discarded local recovery data");
    },

    // ==========================================
    // INTERNAL
    // ==========================================

    _saveToIndexedDB: async () => {
      const { activeSession } = get();
      if (activeSession) {
        await saveToIDB(activeSession);
        set({ lastSavedAt: new Date() });
        console.log("[SessionStore] Auto-saved to IndexedDB");
      }
    },

    _loadFromIndexedDB: async (sessionId: string) => {
      return loadFromIDB(sessionId);
    },

    _clearIndexedDB: async (sessionId: string) => {
      await deleteFromIDB(sessionId);
    },

    // ==========================================
    // RESET
    // ==========================================

    clearActiveSession: () => {
      // Clear all session-related storage when clearing active session
      clearAllSessionStorage();

      // Reset workflow store to clear in-memory state
      const workflowStore = useWorkflowStore.getState();
      workflowStore.resetWorkflow();

      set({
        activeSession: null,
        lastSavedAt: null,
        saveError: null,
      });

      console.log("[SessionStore] Cleared active session and all related storage");
    },

    reset: () => {
      // Clear all session-related storage on full reset
      clearAllSessionStorage();

      // Reset workflow store to clear in-memory state
      const workflowStore = useWorkflowStore.getState();
      workflowStore.resetWorkflow();

      set({
        activeSession: null,
        sessions: [],
        sessionsLoading: false,
        isLoading: false,
        isSaving: false,
        lastSavedAt: null,
        saveError: null,
        hasLocalRecovery: false,
        localRecoveryData: null,
      });

      console.log("[SessionStore] Full reset completed with all storage cleared");
    },
  }))
);

// ============================================
// SELECTORS
// ============================================

export const selectActiveSession = (state: SessionStore) => state.activeSession;
export const selectSessions = (state: SessionStore) => state.sessions;
export const selectIsLoading = (state: SessionStore) => state.isLoading;
export const selectIsSaving = (state: SessionStore) => state.isSaving;
export const selectLastSavedAt = (state: SessionStore) => state.lastSavedAt;
export const selectHasLocalRecovery = (state: SessionStore) => state.hasLocalRecovery;
export const selectLocalRecoveryData = (state: SessionStore) => state.localRecoveryData;

export const selectCurrentStage = (state: SessionStore) =>
  state.activeSession?.currentStage || "start";

export const selectCompletedStages = (state: SessionStore) =>
  state.activeSession?.completedStages || [];

export const selectStageData = <T extends WorkflowStage>(stage: T) =>
  (state: SessionStore) => state.activeSession?.stageData[stage] || null;

export const selectSessionMetadata = (state: SessionStore) =>
  state.activeSession?.metadata || createInitialMetadata();

export const selectInProgressSessions = (state: SessionStore) =>
  state.sessions.filter(
    (s) => s.status === "in_progress" || s.status === "draft"
  );

export const selectCompletedSessions = (state: SessionStore) =>
  state.sessions.filter((s) => s.status === "completed");

export const selectPausedSessions = (state: SessionStore) =>
  state.sessions.filter((s) => s.status === "paused");

// ============================================
// HOOKS
// ============================================

export const useActiveSession = () =>
  useSessionStore((state) => state.activeSession);

export const useSessions = () =>
  useSessionStore((state) => state.sessions);

export const useSessionActions = () =>
  useSessionStore((state) => ({
    createSession: state.createSession,
    loadSession: state.loadSession,
    saveSession: state.saveSession,
    pauseSession: state.pauseSession,
    completeSession: state.completeSession,
    deleteSession: state.deleteSession,
    updateStageData: state.updateStageData,
    setStageData: state.setStageData,
    proceedToStage: state.proceedToStage,
    markStageCompleted: state.markStageCompleted,
    updateMetadata: state.updateMetadata,
    setSessionTitle: state.setSessionTitle,
    fetchSessions: state.fetchSessions,
    checkLocalRecovery: state.checkLocalRecovery,
    recoverFromLocal: state.recoverFromLocal,
    discardLocalRecovery: state.discardLocalRecovery,
    clearActiveSession: state.clearActiveSession,
  }));
