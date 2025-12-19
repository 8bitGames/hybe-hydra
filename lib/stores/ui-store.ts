import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

// Local type definition (previously from projects-api)
export type ProjectType = "AI_VIDEO" | "FAST_CUT";

// ============================================
// TYPES - Legacy (preserved for compatibility)
// ============================================

export type CreateMode = "quick" | "generate" | "fastCut" | "batch";
export type CampaignTab = "assets" | "create" | "generate" | "fast-cut" | "videos" | "publish" | "analytics" | "info";
export type Language = "ko" | "en";

// ============================================
// TYPES - Project System Modals
// ============================================

export interface TypeSelectionModalState {
  isOpen: boolean;
  campaignId: string | null;
  campaignName: string | null;
  onSelect?: (type: ProjectType) => void;
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ProjectCreateModalState {
  isOpen: boolean;
  campaignId: string | null;
  projectType: ProjectType | null;
  onSuccess?: (projectId: string) => void;
}

// Panel States
export interface SidePanelState {
  isOpen: boolean;
  width: number;
  content: "assets" | "history" | "settings" | "help" | null;
}

// Toast/Notification
export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

// Global Loading State
export interface GlobalLoading {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

// ============================================
// INITIAL STATES
// ============================================

const initialTypeSelectionModalState: TypeSelectionModalState = {
  isOpen: false,
  campaignId: null,
  campaignName: null,
  onSelect: undefined,
};

const initialConfirmModalState: ConfirmModalState = {
  isOpen: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  variant: "default",
  onConfirm: undefined,
  onCancel: undefined,
};

const initialProjectCreateModalState: ProjectCreateModalState = {
  isOpen: false,
  campaignId: null,
  projectType: null,
  onSuccess: undefined,
};

const initialSidePanelState: SidePanelState = {
  isOpen: false,
  width: 320,
  content: null,
};

const initialGlobalLoading: GlobalLoading = {
  isLoading: false,
  message: undefined,
  progress: undefined,
};

// ============================================
// STORE STATE INTERFACE
// ============================================

interface UIState {
  // Legacy - Create page
  createMode: CreateMode;
  expandedPanels: string[];

  // Legacy - Campaign workspace
  activeTab: CampaignTab;

  // Legacy - Job tracker
  jobTrackerExpanded: boolean;

  // Legacy - Language
  showBothLanguages: boolean;

  // Project System - Modals
  typeSelectionModal: TypeSelectionModalState;
  confirmModal: ConfirmModalState;
  projectCreateModal: ProjectCreateModalState;

  // Project System - Panels
  sidePanel: SidePanelState;
  isNavCollapsed: boolean;

  // Project System - Global states
  globalLoading: GlobalLoading;
  toasts: Toast[];
  shortcutsEnabled: boolean;

  // Legacy Actions
  setCreateMode: (mode: CreateMode) => void;
  togglePanel: (id: string) => void;
  setExpandedPanels: (panels: string[]) => void;
  setActiveTab: (tab: CampaignTab) => void;
  setJobTrackerExpanded: (expanded: boolean) => void;
  toggleJobTracker: () => void;
  setShowBothLanguages: (show: boolean) => void;

  // Type Selection Modal Actions
  openTypeSelectionModal: (
    campaignId: string,
    campaignName: string,
    onSelect?: (type: ProjectType) => void
  ) => void;
  closeTypeSelectionModal: () => void;

  // Confirm Modal Actions
  openConfirmModal: (options: Omit<ConfirmModalState, "isOpen">) => void;
  closeConfirmModal: () => void;

  // Project Create Modal Actions
  openProjectCreateModal: (
    campaignId: string,
    projectType: ProjectType,
    onSuccess?: (projectId: string) => void
  ) => void;
  closeProjectCreateModal: () => void;

  // Side Panel Actions
  openSidePanel: (content: SidePanelState["content"]) => void;
  closeSidePanel: () => void;
  toggleSidePanel: (content: SidePanelState["content"]) => void;
  setSidePanelWidth: (width: number) => void;

  // Navigation Actions
  setNavCollapsed: (collapsed: boolean) => void;
  toggleNavCollapsed: () => void;

  // Global Loading Actions
  setGlobalLoading: (loading: boolean, message?: string, progress?: number) => void;
  updateLoadingProgress: (progress: number) => void;
  clearGlobalLoading: () => void;

  // Toast Actions
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;

  // Keyboard Shortcuts
  setShortcutsEnabled: (enabled: boolean) => void;

  // Reset UI state (modals, loading, toasts)
  resetUIState: () => void;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useUIStore = create<UIState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Legacy - Initial state
        createMode: "quick",
        expandedPanels: [],
        activeTab: "assets",
        jobTrackerExpanded: false,
        showBothLanguages: false,

        // Project System - Initial state
        typeSelectionModal: initialTypeSelectionModalState,
        confirmModal: initialConfirmModalState,
        projectCreateModal: initialProjectCreateModalState,
        sidePanel: initialSidePanelState,
        isNavCollapsed: false,
        globalLoading: initialGlobalLoading,
        toasts: [],
        shortcutsEnabled: true,

        // Legacy Actions
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

        // Type Selection Modal Actions
        openTypeSelectionModal: (campaignId, campaignName, onSelect) => {
          set({
            typeSelectionModal: {
              isOpen: true,
              campaignId,
              campaignName,
              onSelect,
            },
          });
        },

        closeTypeSelectionModal: () => {
          set({ typeSelectionModal: initialTypeSelectionModalState });
        },

        // Confirm Modal Actions
        openConfirmModal: (options) => {
          set({
            confirmModal: {
              isOpen: true,
              ...options,
            },
          });
        },

        closeConfirmModal: () => {
          set({ confirmModal: initialConfirmModalState });
        },

        // Project Create Modal Actions
        openProjectCreateModal: (campaignId, projectType, onSuccess) => {
          set({
            projectCreateModal: {
              isOpen: true,
              campaignId,
              projectType,
              onSuccess,
            },
          });
        },

        closeProjectCreateModal: () => {
          set({ projectCreateModal: initialProjectCreateModalState });
        },

        // Side Panel Actions
        openSidePanel: (content) => {
          set({
            sidePanel: {
              ...get().sidePanel,
              isOpen: true,
              content,
            },
          });
        },

        closeSidePanel: () => {
          set({
            sidePanel: {
              ...get().sidePanel,
              isOpen: false,
              content: null,
            },
          });
        },

        toggleSidePanel: (content) => {
          const { sidePanel } = get();
          if (sidePanel.isOpen && sidePanel.content === content) {
            // Same content, close the panel
            set({
              sidePanel: {
                ...sidePanel,
                isOpen: false,
                content: null,
              },
            });
          } else {
            // Different content or panel closed, open with new content
            set({
              sidePanel: {
                ...sidePanel,
                isOpen: true,
                content,
              },
            });
          }
        },

        setSidePanelWidth: (width) => {
          set({
            sidePanel: {
              ...get().sidePanel,
              width: Math.max(200, Math.min(600, width)), // Clamp between 200-600px
            },
          });
        },

        // Navigation Actions
        setNavCollapsed: (collapsed) => {
          set({ isNavCollapsed: collapsed });
        },

        toggleNavCollapsed: () => {
          set({ isNavCollapsed: !get().isNavCollapsed });
        },

        // Global Loading Actions
        setGlobalLoading: (isLoading, message, progress) => {
          set({
            globalLoading: {
              isLoading,
              message,
              progress,
            },
          });
        },

        updateLoadingProgress: (progress) => {
          set({
            globalLoading: {
              ...get().globalLoading,
              progress: Math.max(0, Math.min(100, progress)),
            },
          });
        },

        clearGlobalLoading: () => {
          set({ globalLoading: initialGlobalLoading });
        },

        // Toast Actions
        addToast: (toast) => {
          const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const newToast: Toast = {
            id,
            duration: toast.duration ?? 5000,
            ...toast,
          };

          set({
            toasts: [...get().toasts, newToast],
          });

          // Auto-remove toast after duration
          if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
              get().removeToast(id);
            }, newToast.duration);
          }
        },

        removeToast: (id) => {
          set({
            toasts: get().toasts.filter((t) => t.id !== id),
          });
        },

        clearAllToasts: () => {
          set({ toasts: [] });
        },

        // Keyboard Shortcuts
        setShortcutsEnabled: (enabled) => {
          set({ shortcutsEnabled: enabled });
        },

        // Reset
        resetUIState: () => {
          set({
            typeSelectionModal: initialTypeSelectionModalState,
            confirmModal: initialConfirmModalState,
            projectCreateModal: initialProjectCreateModalState,
            sidePanel: initialSidePanelState,
            globalLoading: initialGlobalLoading,
            toasts: [],
            // Keep navigation state, shortcuts enabled, and legacy persisted state
          });
        },
      }),
      {
        name: "hydra-ui-state",
        partialize: (state) => ({
          // Legacy persisted state
          createMode: state.createMode,
          expandedPanels: state.expandedPanels,
          showBothLanguages: state.showBothLanguages,
          // Project system persisted state
          isNavCollapsed: state.isNavCollapsed,
          sidePanel: {
            width: state.sidePanel.width,
          },
        }),
      }
    )
  )
);

// ============================================
// SELECTORS
// ============================================

// Legacy selectors
export const selectCreateMode = (state: UIState) => state.createMode;
export const selectExpandedPanels = (state: UIState) => state.expandedPanels;
export const selectActiveTab = (state: UIState) => state.activeTab;
export const selectJobTrackerExpanded = (state: UIState) => state.jobTrackerExpanded;
export const selectShowBothLanguages = (state: UIState) => state.showBothLanguages;

// Project system selectors
export const selectTypeSelectionModal = (state: UIState) => state.typeSelectionModal;
export const selectConfirmModal = (state: UIState) => state.confirmModal;
export const selectProjectCreateModal = (state: UIState) => state.projectCreateModal;
export const selectSidePanel = (state: UIState) => state.sidePanel;
export const selectIsNavCollapsed = (state: UIState) => state.isNavCollapsed;
export const selectGlobalLoading = (state: UIState) => state.globalLoading;
export const selectToasts = (state: UIState) => state.toasts;
export const selectShortcutsEnabled = (state: UIState) => state.shortcutsEnabled;

// Computed selectors
export const selectIsAnyModalOpen = (state: UIState) =>
  state.typeSelectionModal.isOpen ||
  state.confirmModal.isOpen ||
  state.projectCreateModal.isOpen;

export const selectHasToasts = (state: UIState) => state.toasts.length > 0;

// ============================================
// HELPER HOOKS
// ============================================

export function useTypeSelectionModal() {
  const modal = useUIStore(selectTypeSelectionModal);
  const open = useUIStore((s) => s.openTypeSelectionModal);
  const close = useUIStore((s) => s.closeTypeSelectionModal);
  return { ...modal, open, close };
}

export function useConfirmModal() {
  const modal = useUIStore(selectConfirmModal);
  const open = useUIStore((s) => s.openConfirmModal);
  const close = useUIStore((s) => s.closeConfirmModal);
  return { ...modal, open, close };
}

export function useProjectCreateModal() {
  const modal = useUIStore(selectProjectCreateModal);
  const open = useUIStore((s) => s.openProjectCreateModal);
  const close = useUIStore((s) => s.closeProjectCreateModal);
  return { ...modal, open, close };
}

export function useSidePanel() {
  const panel = useUIStore(selectSidePanel);
  const open = useUIStore((s) => s.openSidePanel);
  const close = useUIStore((s) => s.closeSidePanel);
  const toggle = useUIStore((s) => s.toggleSidePanel);
  const setWidth = useUIStore((s) => s.setSidePanelWidth);
  return { ...panel, open, close, toggle, setWidth };
}

export function useGlobalLoading() {
  const loading = useUIStore(selectGlobalLoading);
  const setLoading = useUIStore((s) => s.setGlobalLoading);
  const updateProgress = useUIStore((s) => s.updateLoadingProgress);
  const clear = useUIStore((s) => s.clearGlobalLoading);
  return { ...loading, setLoading, updateProgress, clear };
}

export function useToasts() {
  const toasts = useUIStore(selectToasts);
  const addToast = useUIStore((s) => s.addToast);
  const removeToast = useUIStore((s) => s.removeToast);
  const clearAll = useUIStore((s) => s.clearAllToasts);
  return { toasts, addToast, removeToast, clearAll };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export function showToast(toast: Omit<Toast, "id">) {
  useUIStore.getState().addToast(toast);
}

export function showSuccessToast(title: string, message?: string) {
  useUIStore.getState().addToast({ type: "success", title, message });
}

export function showErrorToast(title: string, message?: string) {
  useUIStore.getState().addToast({ type: "error", title, message });
}

export function showWarningToast(title: string, message?: string) {
  useUIStore.getState().addToast({ type: "warning", title, message });
}

export function showInfoToast(title: string, message?: string) {
  useUIStore.getState().addToast({ type: "info", title, message });
}
