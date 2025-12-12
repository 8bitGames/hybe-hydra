import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useState, useEffect } from "react";

// ============================================
// TYPES
// ============================================

export type ProcessingSessionState =
  | "GENERATING"          // 원본 영상 생성 중
  | "READY"               // 분기점 - 배포 vs 베리에이션
  | "VARIATION_CONFIG"    // 스타일 선택 + 생성 진행
  | "COMPARE_AND_APPROVE"; // 비교 및 최종 선택

export type VideoGenerationStatus = "pending" | "generating" | "completed" | "failed";
export type ApprovalStatus = "pending" | "approved" | "rejected";

// Style Set for variations
export interface StyleSet {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: string; // Lucide icon name
}

// Original video info
export interface OriginalVideo {
  id: string;
  status: VideoGenerationStatus;
  progress: number;
  currentStep?: string; // "프레임 합성 중", "이펙트 적용 중" etc.
  outputUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
}

// Content from Fast Cut flow
export interface SessionContent {
  script: string;
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl?: string;
  }>;
  musicTrack?: {
    id: string;
    name: string;
    duration: number;
    url: string;
  };
  effectPreset?: {
    id: string;
    name: string;
    description?: string;
  };
}

// Variation video
export interface VariationVideo {
  id: string;
  styleId: string;
  styleName: string;
  styleNameKo: string;
  status: VideoGenerationStatus;
  progress: number;
  currentStep?: string;
  outputUrl?: string;
  thumbnailUrl?: string;
  approval: ApprovalStatus;
}

// Content type for workflow stages display
export type ContentType = "ai_video" | "fast-cut";

// Full session data
export interface ProcessingSession {
  id: string;
  state: ProcessingSessionState;
  createdAt: string;

  // Database session ID (links to creation_sessions table)
  // This is the UUID from useSessionStore, different from local `id`
  databaseSessionId?: string;

  // Content type for workflow stage display
  contentType: ContentType;

  // Campaign context
  campaignId: string;
  campaignName: string;

  // Original video
  originalVideo: OriginalVideo;

  // Content info from Fast Cut
  content: SessionContent;

  // Variation config
  variationConfig: {
    selectedStyles: string[]; // style IDs
    isGenerating: boolean;
  };

  // Generated variations
  variations: VariationVideo[];
}

// ============================================
// STYLE SETS
// ============================================

export const STYLE_SETS: StyleSet[] = [
  {
    id: "viral_tiktok",
    name: "Viral TikTok",
    nameKo: "바이럴 틱톡",
    description: "Fast cuts, trendy transitions, screen effects",
    descriptionKo: "빠른 컷, 트렌디한 트랜지션, 화면 전환 효과",
    icon: "Zap",
  },
  {
    id: "cinematic_mood",
    name: "Cinematic Mood",
    nameKo: "시네마틱 무드",
    description: "Cinematic colors, slow fades, film-like atmosphere",
    descriptionKo: "시네마틱 색감, 슬로우 페이드, 영화적 분위기",
    icon: "Film",
  },
  {
    id: "clean_minimal",
    name: "Clean Minimal",
    nameKo: "클린 미니멀",
    description: "Simple composition, white space, minimal design",
    descriptionKo: "심플한 구성, 화이트 스페이스, 미니멀 디자인",
    icon: "Square",
  },
  {
    id: "energetic_beat",
    name: "Energetic Beat",
    nameKo: "에너제틱 비트",
    description: "Beat sync, dynamic motion, energetic effects",
    descriptionKo: "비트 싱크, 다이나믹 모션, 에너지 넘치는 효과",
    icon: "Activity",
  },
  {
    id: "retro_aesthetic",
    name: "Retro Aesthetic",
    nameKo: "레트로 감성",
    description: "Vintage filters, noise effects, retro vibes",
    descriptionKo: "빈티지 필터, 노이즈 효과, 레트로 감성",
    icon: "Disc",
  },
  {
    id: "professional_corp",
    name: "Professional Corp",
    nameKo: "프로페셔널",
    description: "Clean corporate style, professional feel",
    descriptionKo: "깔끔한 기업 스타일, 전문적인 느낌",
    icon: "Briefcase",
  },
  {
    id: "dreamy_soft",
    name: "Dreamy Soft",
    nameKo: "드리미 소프트",
    description: "Soft blur, pastel tones, dreamy atmosphere",
    descriptionKo: "소프트 블러, 파스텔 톤, 몽환적 분위기",
    icon: "Cloud",
  },
  {
    id: "bold_impact",
    name: "Bold Impact",
    nameKo: "볼드 임팩트",
    description: "Strong text, high contrast, impactful effects",
    descriptionKo: "강렬한 텍스트, 하이 컨트라스트, 임팩트 있는 효과",
    icon: "Bold",
  },
];

// ============================================
// INITIAL STATE
// ============================================

const createInitialSession = (): ProcessingSession => ({
  id: "",
  state: "GENERATING",
  createdAt: new Date().toISOString(),
  contentType: "ai_video",
  campaignId: "",
  campaignName: "",
  originalVideo: {
    id: "",
    status: "pending",
    progress: 0,
  },
  content: {
    script: "",
    images: [],
  },
  variationConfig: {
    selectedStyles: [],
    isGenerating: false,
  },
  variations: [],
});

// ============================================
// STORE STATE
// ============================================

interface ProcessingSessionStoreState {
  // Current session
  session: ProcessingSession | null;

  // Session exists flag
  hasActiveSession: boolean;

  // Actions - Session lifecycle
  initSession: (data: {
    campaignId: string;
    campaignName: string;
    content: SessionContent;
    generationId?: string;
    contentType?: ContentType;
    databaseSessionId?: string; // UUID from useSessionStore (creation_sessions table)
  }) => void;
  clearSession: () => void;

  // Actions - State transitions
  setState: (state: ProcessingSessionState) => void;
  goToReady: () => void;
  goToVariationConfig: () => void;
  goToCompareAndApprove: () => void;

  // Actions - Original video
  updateOriginalVideo: (updates: Partial<OriginalVideo>) => void;
  setOriginalVideoCompleted: (outputUrl: string, thumbnailUrl?: string) => void;

  // Actions - Variation config
  toggleStyleSelection: (styleId: string) => void;
  setSelectedStyles: (styleIds: string[]) => void;
  selectAllStyles: () => void;
  clearStyleSelection: () => void;

  // Actions - Variation generation
  startVariationGeneration: () => void;
  cancelVariationGeneration: () => void;
  addVariation: (variation: VariationVideo) => void;
  updateVariation: (id: string, updates: Partial<VariationVideo>) => void;
  setVariationCompleted: (id: string, outputUrl: string, thumbnailUrl?: string) => void;
  setVariationFailed: (id: string, error?: string) => void;

  // Actions - Approval
  approveVideo: (id: string) => void;
  rejectVideo: (id: string) => void;
  approveOriginal: () => void;
  rejectOriginal: () => void;
  approveAll: () => void;
  rejectAll: () => void;

  // Computed - Get approved videos for publish
  getApprovedVideos: () => Array<{
    id: string;
    styleId: string | null;
    styleName: string;
    outputUrl: string;
    thumbnailUrl?: string;
    isOriginal: boolean;
  }>;

  // Computed - Check if all variations are done
  areAllVariationsDone: () => boolean;

  // Computed - Get approval counts
  getApprovalCounts: () => {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
}

// ============================================
// STORE
// ============================================

export const useProcessingSessionStore = create<ProcessingSessionStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        session: null,
        hasActiveSession: false,

        // Session lifecycle
        initSession: (data) => {
          const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const generationId = data.generationId || `gen-${Date.now()}`;

          set({
            session: {
              id: sessionId,
              state: "GENERATING",
              createdAt: new Date().toISOString(),
              databaseSessionId: data.databaseSessionId, // Link to database session
              contentType: data.contentType || "ai_video",
              campaignId: data.campaignId,
              campaignName: data.campaignName,
              originalVideo: {
                id: generationId,
                status: "generating",
                progress: 0,
              },
              content: data.content,
              variationConfig: {
                selectedStyles: [],
                isGenerating: false,
              },
              variations: [],
            },
            hasActiveSession: true,
          });
        },

        clearSession: () => {
          // Clear in-memory state
          set({
            session: null,
            hasActiveSession: false,
          });

          // Also explicitly clear localStorage to ensure no stale data persists
          try {
            if (typeof window !== "undefined") {
              localStorage.removeItem("hydra-processing-session");
              console.log("[ProcessingSessionStore] Cleared localStorage");
            }
          } catch (err) {
            console.error("[ProcessingSessionStore] Failed to clear localStorage:", err);
          }
        },

        // State transitions
        setState: (state) => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: { ...s.session, state },
            };
          });
        },

        goToReady: () => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: { ...s.session, state: "READY" },
            };
          });
        },

        goToVariationConfig: () => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: { ...s.session, state: "VARIATION_CONFIG" },
            };
          });
        },

        goToCompareAndApprove: () => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: { ...s.session, state: "COMPARE_AND_APPROVE" },
            };
          });
        },

        // Original video
        updateOriginalVideo: (updates) => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                originalVideo: { ...s.session.originalVideo, ...updates },
              },
            };
          });
        },

        setOriginalVideoCompleted: (outputUrl, thumbnailUrl) => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                originalVideo: {
                  ...s.session.originalVideo,
                  status: "completed",
                  progress: 100,
                  outputUrl,
                  thumbnailUrl,
                },
                state: "READY", // Auto-transition to READY
              },
            };
          });
        },

        // Variation config
        toggleStyleSelection: (styleId) => {
          set((s) => {
            if (!s.session) return s;
            const current = s.session.variationConfig.selectedStyles;
            const updated = current.includes(styleId)
              ? current.filter((id) => id !== styleId)
              : [...current, styleId];
            return {
              session: {
                ...s.session,
                variationConfig: {
                  ...s.session.variationConfig,
                  selectedStyles: updated,
                },
              },
            };
          });
        },

        setSelectedStyles: (styleIds) => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variationConfig: {
                  ...s.session.variationConfig,
                  selectedStyles: styleIds,
                },
              },
            };
          });
        },

        selectAllStyles: () => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variationConfig: {
                  ...s.session.variationConfig,
                  selectedStyles: STYLE_SETS.map((style) => style.id),
                },
              },
            };
          });
        },

        clearStyleSelection: () => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variationConfig: {
                  ...s.session.variationConfig,
                  selectedStyles: [],
                },
              },
            };
          });
        },

        // Variation generation
        startVariationGeneration: () => {
          set((s) => {
            if (!s.session) return s;

            const selectedStyles = s.session.variationConfig.selectedStyles;
            const newVariations: VariationVideo[] = selectedStyles.map((styleId) => {
              const style = STYLE_SETS.find((st) => st.id === styleId);
              return {
                id: `var-${styleId}-${Date.now()}`,
                styleId,
                styleName: style?.name || styleId,
                styleNameKo: style?.nameKo || styleId,
                status: "pending" as VideoGenerationStatus,
                progress: 0,
                approval: "pending" as ApprovalStatus,
              };
            });

            return {
              session: {
                ...s.session,
                variationConfig: {
                  ...s.session.variationConfig,
                  isGenerating: true,
                },
                variations: newVariations,
              },
            };
          });
        },

        cancelVariationGeneration: () => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variationConfig: {
                  ...s.session.variationConfig,
                  isGenerating: false,
                },
                variations: [], // Clear pending variations
              },
            };
          });
        },

        addVariation: (variation) => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variations: [...s.session.variations, variation],
              },
            };
          });
        },

        updateVariation: (id, updates) => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variations: s.session.variations.map((v) =>
                  v.id === id ? { ...v, ...updates } : v
                ),
              },
            };
          });
        },

        setVariationCompleted: (id, outputUrl, thumbnailUrl) => {
          const state = get();

          set((s) => {
            if (!s.session) return s;

            const updatedVariations = s.session.variations.map((v) =>
              v.id === id
                ? { ...v, status: "completed" as VideoGenerationStatus, progress: 100, outputUrl, thumbnailUrl }
                : v
            );

            // Check if all variations are done
            const allDone = updatedVariations.every(
              (v) => v.status === "completed" || v.status === "failed"
            );

            return {
              session: {
                ...s.session,
                variations: updatedVariations,
                variationConfig: {
                  ...s.session.variationConfig,
                  isGenerating: !allDone,
                },
                // Auto-transition to COMPARE_AND_APPROVE when all done
                state: allDone ? "COMPARE_AND_APPROVE" : s.session.state,
              },
            };
          });
        },

        setVariationFailed: (id) => {
          set((s) => {
            if (!s.session) return s;

            const updatedVariations = s.session.variations.map((v) =>
              v.id === id
                ? { ...v, status: "failed" as VideoGenerationStatus, progress: 0 }
                : v
            );

            // Check if all variations are done
            const allDone = updatedVariations.every(
              (v) => v.status === "completed" || v.status === "failed"
            );

            return {
              session: {
                ...s.session,
                variations: updatedVariations,
                variationConfig: {
                  ...s.session.variationConfig,
                  isGenerating: !allDone,
                },
                state: allDone ? "COMPARE_AND_APPROVE" : s.session.state,
              },
            };
          });
        },

        // Approval
        approveVideo: (id) => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variations: s.session.variations.map((v) =>
                  v.id === id ? { ...v, approval: "approved" as ApprovalStatus } : v
                ),
              },
            };
          });
        },

        rejectVideo: (id) => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variations: s.session.variations.map((v) =>
                  v.id === id ? { ...v, approval: "rejected" as ApprovalStatus } : v
                ),
              },
            };
          });
        },

        approveOriginal: () => {
          // Original is always included in approved list by default
          // This is for explicit UI action if needed
        },

        rejectOriginal: () => {
          // Original rejection is handled in getApprovedVideos
        },

        approveAll: () => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variations: s.session.variations.map((v) =>
                  v.status === "completed" ? { ...v, approval: "approved" as ApprovalStatus } : v
                ),
              },
            };
          });
        },

        rejectAll: () => {
          set((s) => {
            if (!s.session) return s;
            return {
              session: {
                ...s.session,
                variations: s.session.variations.map((v) => ({
                  ...v,
                  approval: "rejected" as ApprovalStatus,
                })),
              },
            };
          });
        },

        // Computed
        getApprovedVideos: () => {
          const state = get();
          if (!state.session) return [];

          const approved: Array<{
            id: string;
            styleId: string | null;
            styleName: string;
            outputUrl: string;
            thumbnailUrl?: string;
            isOriginal: boolean;
          }> = [];

          // Include original if completed
          if (
            state.session.originalVideo.status === "completed" &&
            state.session.originalVideo.outputUrl
          ) {
            approved.push({
              id: state.session.originalVideo.id,
              styleId: null,
              styleName: "Original",
              outputUrl: state.session.originalVideo.outputUrl,
              thumbnailUrl: state.session.originalVideo.thumbnailUrl,
              isOriginal: true,
            });
          }

          // Include approved variations
          state.session.variations
            .filter((v) => v.approval === "approved" && v.outputUrl)
            .forEach((v) => {
              approved.push({
                id: v.id,
                styleId: v.styleId,
                styleName: v.styleName,
                outputUrl: v.outputUrl!,
                thumbnailUrl: v.thumbnailUrl,
                isOriginal: false,
              });
            });

          return approved;
        },

        areAllVariationsDone: () => {
          const state = get();
          if (!state.session || state.session.variations.length === 0) return false;
          return state.session.variations.every(
            (v) => v.status === "completed" || v.status === "failed"
          );
        },

        getApprovalCounts: () => {
          const state = get();
          if (!state.session) {
            return { total: 0, approved: 0, rejected: 0, pending: 0 };
          }

          // Include original + variations
          const total = 1 + state.session.variations.filter((v) => v.status === "completed").length;
          const approvedVariations = state.session.variations.filter(
            (v) => v.approval === "approved"
          ).length;
          const rejectedVariations = state.session.variations.filter(
            (v) => v.approval === "rejected"
          ).length;

          // Original is always "approved" by default
          const approved = 1 + approvedVariations;
          const rejected = rejectedVariations;
          const pending = total - approved - rejected;

          return { total, approved, rejected, pending };
        },
      }),
      {
        name: "hydra-processing-session",
        partialize: (state) => ({
          session: state.session,
          hasActiveSession: state.hasActiveSession,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            console.log("[ProcessingSessionStore] Rehydrated from localStorage");
          }
        },
      }
    )
  )
);

// Hook to check if store is hydrated
export const useProcessingSessionHydrated = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useProcessingSessionStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    if (useProcessingSessionStore.persist.hasHydrated()) {
      setHydrated(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  return hydrated;
};

// ============================================
// SELECTORS
// ============================================

// Stable empty array references to prevent infinite re-renders
// React 18's useSyncExternalStore requires getSnapshot to return cached values
const EMPTY_VARIATIONS: VariationVideo[] = [];
const EMPTY_STYLES: string[] = [];

export const selectSession = (state: ProcessingSessionStoreState) => state.session;
export const selectSessionState = (state: ProcessingSessionStoreState) => state.session?.state;
export const selectOriginalVideo = (state: ProcessingSessionStoreState) => state.session?.originalVideo;
export const selectVariations = (state: ProcessingSessionStoreState) =>
  state.session?.variations ?? EMPTY_VARIATIONS;
export const selectSelectedStyles = (state: ProcessingSessionStoreState) =>
  state.session?.variationConfig.selectedStyles ?? EMPTY_STYLES;
export const selectIsGeneratingVariations = (state: ProcessingSessionStoreState) =>
  state.session?.variationConfig.isGenerating ?? false;
