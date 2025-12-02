import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CreateMode = "quick" | "generate" | "compose" | "batch";
export type CampaignTab = "assets" | "generate" | "compose" | "videos" | "publish" | "analytics";
export type Language = "ko" | "en";

interface UIState {
  // Create page
  createMode: CreateMode;
  expandedPanels: string[];

  // Campaign workspace
  activeTab: CampaignTab;

  // Job tracker
  jobTrackerExpanded: boolean;

  // Language
  showBothLanguages: boolean;

  // Actions
  setCreateMode: (mode: CreateMode) => void;
  togglePanel: (id: string) => void;
  setExpandedPanels: (panels: string[]) => void;
  setActiveTab: (tab: CampaignTab) => void;
  setJobTrackerExpanded: (expanded: boolean) => void;
  toggleJobTracker: () => void;
  setShowBothLanguages: (show: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      createMode: "quick",
      expandedPanels: [],
      activeTab: "assets",
      jobTrackerExpanded: false,
      showBothLanguages: false,

      // Actions
      setCreateMode: (mode) => set({ createMode: mode }),

      togglePanel: (id) =>
        set((state) => ({
          expandedPanels: state.expandedPanels.includes(id)
            ? state.expandedPanels.filter((p) => p !== id)
            : [...state.expandedPanels, id],
        })),

      setExpandedPanels: (panels) => set({ expandedPanels: panels }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setJobTrackerExpanded: (expanded) => set({ jobTrackerExpanded: expanded }),

      toggleJobTracker: () =>
        set((state) => ({ jobTrackerExpanded: !state.jobTrackerExpanded })),

      setShowBothLanguages: (show) => set({ showBothLanguages: show }),
    }),
    {
      name: "hydra-ui-state",
      partialize: (state) => ({
        createMode: state.createMode,
        expandedPanels: state.expandedPanels,
        showBothLanguages: state.showBothLanguages,
      }),
    }
  )
);
