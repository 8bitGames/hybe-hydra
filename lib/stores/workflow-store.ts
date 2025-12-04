import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

// ============================================
// TYPES
// ============================================

export type WorkflowStage = "discover" | "analyze" | "create" | "publish";

// Discover Stage Types
export interface TrendVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  description: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  };
  hashtags: string[];
  engagementRate: number;
}

export interface DiscoverData {
  keywords: string[];
  selectedHashtags: string[];
  savedInspiration: TrendVideo[];
  performanceMetrics: {
    avgViews: number;
    avgEngagement: number;
    viralBenchmark: number;
  } | null;
  aiInsights: string[];
  trendAnalysis: {
    keyword: string;
    totalVideos: number;
    viralVideos: TrendVideo[];
    highPerformingVideos: TrendVideo[];
  } | null;
}

// Analyze Stage Types
export interface ContentIdea {
  id: string;
  type: "ai_video" | "compose";
  title: string;
  hook: string;
  description: string;
  estimatedEngagement: "high" | "medium" | "low";
  optimizedPrompt: string;
  suggestedMusic?: {
    bpm: number;
    genre: string;
  };
  scriptOutline?: string[];
}

export interface AnalyzeData {
  campaignId: string | null;
  campaignName: string | null;
  userIdea: string;
  targetAudience: string[];
  contentGoals: string[];
  aiGeneratedIdeas: ContentIdea[];
  selectedIdea: ContentIdea | null;
  assets: {
    id: string;
    type: "image" | "video" | "audio";
    url: string;
    name: string;
  }[];
  optimizedPrompt: string;
  settings: {
    aspectRatio: "9:16" | "16:9" | "1:1";
    duration: number;
    fps: number;
  };
  hashtags: string[];
}

// Create Stage Types
export interface GeneratedVideo {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  qualityScore: number | null;
  prompt: string;
  createdAt: string;
  error?: string;
}

export interface CreateData {
  creationType: "ai" | "compose" | null;
  generations: GeneratedVideo[];
  selectedGenerations: string[]; // IDs
  pipelineStatus: {
    id: string;
    type: "ai" | "compose";
    status: "queued" | "processing" | "completed" | "failed";
    progress: number;
    estimatedTimeRemaining?: number;
  }[];
}

// Publish Stage Types
export interface ScheduledPost {
  id: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  platforms: string[];
  caption: string;
  hashtags: string[];
  scheduledTime: string | null;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
}

export interface PublishData {
  scheduledPosts: ScheduledPost[];
  selectedPlatforms: string[];
  publishTime: "now" | string; // ISO string for scheduled time
  caption: string;
  hashtags: string[];
}

// ============================================
// STORE STATE
// ============================================

interface WorkflowState {
  // Current stage tracking
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];

  // Stage data
  discover: DiscoverData;
  analyze: AnalyzeData;
  create: CreateData;
  publish: PublishData;

  // Actions - Navigation
  setCurrentStage: (stage: WorkflowStage) => void;
  markStageCompleted: (stage: WorkflowStage) => void;
  resetWorkflow: () => void;

  // Actions - Discover
  setDiscoverKeywords: (keywords: string[]) => void;
  addDiscoverKeyword: (keyword: string) => void;
  removeDiscoverKeyword: (keyword: string) => void;
  setDiscoverHashtags: (hashtags: string[]) => void;
  toggleDiscoverHashtag: (hashtag: string) => void;
  addInspiration: (video: TrendVideo) => void;
  removeInspiration: (videoId: string) => void;
  setDiscoverPerformanceMetrics: (metrics: DiscoverData["performanceMetrics"]) => void;
  setDiscoverAiInsights: (insights: string[]) => void;
  setDiscoverTrendAnalysis: (analysis: DiscoverData["trendAnalysis"]) => void;

  // Actions - Analyze
  setAnalyzeCampaign: (id: string | null, name: string | null) => void;
  setAnalyzeUserIdea: (idea: string) => void;
  setAnalyzeTargetAudience: (audience: string[]) => void;
  setAnalyzeContentGoals: (goals: string[]) => void;
  setAnalyzeAiIdeas: (ideas: ContentIdea[]) => void;
  selectAnalyzeIdea: (idea: ContentIdea | null) => void;
  setAnalyzeAssets: (assets: AnalyzeData["assets"]) => void;
  addAnalyzeAsset: (asset: AnalyzeData["assets"][0]) => void;
  removeAnalyzeAsset: (assetId: string) => void;
  setAnalyzeOptimizedPrompt: (prompt: string) => void;
  setAnalyzeSettings: (settings: Partial<AnalyzeData["settings"]>) => void;
  setAnalyzeHashtags: (hashtags: string[]) => void;

  // Actions - Create
  setCreateType: (type: "ai" | "compose" | null) => void;
  addGeneration: (generation: GeneratedVideo) => void;
  updateGeneration: (id: string, updates: Partial<GeneratedVideo>) => void;
  removeGeneration: (id: string) => void;
  setGenerations: (generations: GeneratedVideo[]) => void;
  toggleGenerationSelection: (id: string) => void;
  setSelectedGenerations: (ids: string[]) => void;
  updatePipelineStatus: (status: CreateData["pipelineStatus"]) => void;

  // Actions - Publish
  addScheduledPost: (post: ScheduledPost) => void;
  updateScheduledPost: (id: string, updates: Partial<ScheduledPost>) => void;
  removeScheduledPost: (id: string) => void;
  setPublishPlatforms: (platforms: string[]) => void;
  setPublishTime: (time: "now" | string) => void;
  setPublishCaption: (caption: string) => void;
  setPublishHashtags: (hashtags: string[]) => void;

  // Actions - Bridge (transfer data between stages)
  transferToAnalyze: () => void;
  transferToCreate: () => void;
  transferToPublish: () => void;
}

// ============================================
// INITIAL STATE
// ============================================

const initialDiscoverData: DiscoverData = {
  keywords: [],
  selectedHashtags: [],
  savedInspiration: [],
  performanceMetrics: null,
  aiInsights: [],
  trendAnalysis: null,
};

const initialAnalyzeData: AnalyzeData = {
  campaignId: null,
  campaignName: null,
  userIdea: "",
  targetAudience: [],
  contentGoals: [],
  aiGeneratedIdeas: [],
  selectedIdea: null,
  assets: [],
  optimizedPrompt: "",
  settings: {
    aspectRatio: "9:16",
    duration: 30,
    fps: 60,
  },
  hashtags: [],
};

const initialCreateData: CreateData = {
  creationType: null,
  generations: [],
  selectedGenerations: [],
  pipelineStatus: [],
};

const initialPublishData: PublishData = {
  scheduledPosts: [],
  selectedPlatforms: [],
  publishTime: "now",
  caption: "",
  hashtags: [],
};

// ============================================
// STORE
// ============================================

export const useWorkflowStore = create<WorkflowState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        currentStage: "discover",
        completedStages: [],
        discover: initialDiscoverData,
        analyze: initialAnalyzeData,
        create: initialCreateData,
        publish: initialPublishData,

        // Navigation Actions
        setCurrentStage: (stage) => set({ currentStage: stage }),

        markStageCompleted: (stage) =>
          set((state) => ({
            completedStages: state.completedStages.includes(stage)
              ? state.completedStages
              : [...state.completedStages, stage],
          })),

        resetWorkflow: () =>
          set({
            currentStage: "discover",
            completedStages: [],
            discover: initialDiscoverData,
            analyze: initialAnalyzeData,
            create: initialCreateData,
            publish: initialPublishData,
          }),

        // Discover Actions
        setDiscoverKeywords: (keywords) =>
          set((state) => ({
            discover: { ...state.discover, keywords },
          })),

        addDiscoverKeyword: (keyword) =>
          set((state) => ({
            discover: {
              ...state.discover,
              keywords: state.discover.keywords.includes(keyword)
                ? state.discover.keywords
                : [...state.discover.keywords, keyword],
            },
          })),

        removeDiscoverKeyword: (keyword) =>
          set((state) => ({
            discover: {
              ...state.discover,
              keywords: state.discover.keywords.filter((k) => k !== keyword),
            },
          })),

        setDiscoverHashtags: (hashtags) =>
          set((state) => ({
            discover: { ...state.discover, selectedHashtags: hashtags },
          })),

        toggleDiscoverHashtag: (hashtag) =>
          set((state) => ({
            discover: {
              ...state.discover,
              selectedHashtags: state.discover.selectedHashtags.includes(hashtag)
                ? state.discover.selectedHashtags.filter((h) => h !== hashtag)
                : [...state.discover.selectedHashtags, hashtag],
            },
          })),

        addInspiration: (video) =>
          set((state) => ({
            discover: {
              ...state.discover,
              savedInspiration: state.discover.savedInspiration.some((v) => v.id === video.id)
                ? state.discover.savedInspiration
                : [...state.discover.savedInspiration, video],
            },
          })),

        removeInspiration: (videoId) =>
          set((state) => ({
            discover: {
              ...state.discover,
              savedInspiration: state.discover.savedInspiration.filter((v) => v.id !== videoId),
            },
          })),

        setDiscoverPerformanceMetrics: (metrics) =>
          set((state) => ({
            discover: { ...state.discover, performanceMetrics: metrics },
          })),

        setDiscoverAiInsights: (insights) =>
          set((state) => ({
            discover: { ...state.discover, aiInsights: insights },
          })),

        setDiscoverTrendAnalysis: (analysis) =>
          set((state) => ({
            discover: { ...state.discover, trendAnalysis: analysis },
          })),

        // Analyze Actions
        setAnalyzeCampaign: (id, name) =>
          set((state) => ({
            analyze: { ...state.analyze, campaignId: id, campaignName: name },
          })),

        setAnalyzeUserIdea: (idea) =>
          set((state) => ({
            analyze: { ...state.analyze, userIdea: idea },
          })),

        setAnalyzeTargetAudience: (audience) =>
          set((state) => ({
            analyze: { ...state.analyze, targetAudience: audience },
          })),

        setAnalyzeContentGoals: (goals) =>
          set((state) => ({
            analyze: { ...state.analyze, contentGoals: goals },
          })),

        setAnalyzeAiIdeas: (ideas) =>
          set((state) => ({
            analyze: { ...state.analyze, aiGeneratedIdeas: ideas },
          })),

        selectAnalyzeIdea: (idea) =>
          set((state) => ({
            analyze: { ...state.analyze, selectedIdea: idea },
          })),

        setAnalyzeAssets: (assets) =>
          set((state) => ({
            analyze: { ...state.analyze, assets },
          })),

        addAnalyzeAsset: (asset) =>
          set((state) => ({
            analyze: {
              ...state.analyze,
              assets: [...state.analyze.assets, asset],
            },
          })),

        removeAnalyzeAsset: (assetId) =>
          set((state) => ({
            analyze: {
              ...state.analyze,
              assets: state.analyze.assets.filter((a) => a.id !== assetId),
            },
          })),

        setAnalyzeOptimizedPrompt: (prompt) =>
          set((state) => ({
            analyze: { ...state.analyze, optimizedPrompt: prompt },
          })),

        setAnalyzeSettings: (settings) =>
          set((state) => ({
            analyze: {
              ...state.analyze,
              settings: { ...state.analyze.settings, ...settings },
            },
          })),

        setAnalyzeHashtags: (hashtags) =>
          set((state) => ({
            analyze: { ...state.analyze, hashtags },
          })),

        // Create Actions
        setCreateType: (type) =>
          set((state) => ({
            create: { ...state.create, creationType: type },
          })),

        addGeneration: (generation) =>
          set((state) => ({
            create: {
              ...state.create,
              generations: [...state.create.generations, generation],
            },
          })),

        updateGeneration: (id, updates) =>
          set((state) => ({
            create: {
              ...state.create,
              generations: state.create.generations.map((g) =>
                g.id === id ? { ...g, ...updates } : g
              ),
            },
          })),

        removeGeneration: (id) =>
          set((state) => ({
            create: {
              ...state.create,
              generations: state.create.generations.filter((g) => g.id !== id),
              selectedGenerations: state.create.selectedGenerations.filter((gId) => gId !== id),
            },
          })),

        setGenerations: (generations) =>
          set((state) => ({
            create: { ...state.create, generations },
          })),

        toggleGenerationSelection: (id) =>
          set((state) => ({
            create: {
              ...state.create,
              selectedGenerations: state.create.selectedGenerations.includes(id)
                ? state.create.selectedGenerations.filter((gId) => gId !== id)
                : [...state.create.selectedGenerations, id],
            },
          })),

        setSelectedGenerations: (ids) =>
          set((state) => ({
            create: { ...state.create, selectedGenerations: ids },
          })),

        updatePipelineStatus: (status) =>
          set((state) => ({
            create: { ...state.create, pipelineStatus: status },
          })),

        // Publish Actions
        addScheduledPost: (post) =>
          set((state) => ({
            publish: {
              ...state.publish,
              scheduledPosts: [...state.publish.scheduledPosts, post],
            },
          })),

        updateScheduledPost: (id, updates) =>
          set((state) => ({
            publish: {
              ...state.publish,
              scheduledPosts: state.publish.scheduledPosts.map((p) =>
                p.id === id ? { ...p, ...updates } : p
              ),
            },
          })),

        removeScheduledPost: (id) =>
          set((state) => ({
            publish: {
              ...state.publish,
              scheduledPosts: state.publish.scheduledPosts.filter((p) => p.id !== id),
            },
          })),

        setPublishPlatforms: (platforms) =>
          set((state) => ({
            publish: { ...state.publish, selectedPlatforms: platforms },
          })),

        setPublishTime: (time) =>
          set((state) => ({
            publish: { ...state.publish, publishTime: time },
          })),

        setPublishCaption: (caption) =>
          set((state) => ({
            publish: { ...state.publish, caption },
          })),

        setPublishHashtags: (hashtags) =>
          set((state) => ({
            publish: { ...state.publish, hashtags },
          })),

        // Bridge Actions - Transfer data between stages
        transferToAnalyze: () => {
          const state = get();
          set({
            currentStage: "analyze",
            completedStages: [...state.completedStages, "discover" as WorkflowStage].filter(
              (v, i, a) => a.indexOf(v) === i
            ) as WorkflowStage[],
            analyze: {
              ...state.analyze,
              hashtags: state.discover.selectedHashtags,
              // Pre-fill from discover insights
            },
          });
        },

        transferToCreate: () => {
          const state = get();
          set({
            currentStage: "create",
            completedStages: [...state.completedStages, "analyze" as WorkflowStage].filter(
              (v, i, a) => a.indexOf(v) === i
            ) as WorkflowStage[],
            create: {
              ...state.create,
              creationType: state.analyze.selectedIdea?.type === "ai_video" ? "ai" : "compose",
            },
          });
        },

        transferToPublish: () => {
          const state = get();
          const selectedVideos = state.create.generations.filter((g) =>
            state.create.selectedGenerations.includes(g.id)
          );

          set({
            currentStage: "publish",
            completedStages: [...state.completedStages, "create" as WorkflowStage].filter(
              (v, i, a) => a.indexOf(v) === i
            ) as WorkflowStage[],
            publish: {
              ...state.publish,
              hashtags: state.analyze.hashtags,
              caption: state.analyze.selectedIdea?.hook || "",
              scheduledPosts: selectedVideos.map((video) => ({
                id: `post-${video.id}`,
                videoId: video.id,
                videoUrl: video.outputUrl || "",
                thumbnailUrl: video.thumbnailUrl,
                platforms: [],
                caption: state.analyze.selectedIdea?.hook || "",
                hashtags: state.analyze.hashtags,
                scheduledTime: null,
                status: "draft" as const,
              })),
            },
          });
        },
      }),
      {
        name: "hydra-workflow-state",
        partialize: (state) => ({
          currentStage: state.currentStage,
          completedStages: state.completedStages,
          discover: state.discover,
          analyze: state.analyze,
          // Don't persist create and publish - they have transient data
        }),
      }
    )
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectCurrentStage = (state: WorkflowState) => state.currentStage;
export const selectCompletedStages = (state: WorkflowState) => state.completedStages;

export const selectIsStageCompleted = (stage: WorkflowStage) => (state: WorkflowState) =>
  state.completedStages.includes(stage);

export const selectCanProceedToAnalyze = (state: WorkflowState) =>
  state.discover.keywords.length > 0 || state.discover.savedInspiration.length > 0;

export const selectCanProceedToCreate = (state: WorkflowState) =>
  state.analyze.campaignId !== null &&
  (state.analyze.selectedIdea !== null || state.analyze.optimizedPrompt.length > 0);

export const selectCanProceedToPublish = (state: WorkflowState) =>
  state.create.selectedGenerations.length > 0;

export const selectDiscoverSummary = (state: WorkflowState) => ({
  keywordCount: state.discover.keywords.length,
  hashtagCount: state.discover.selectedHashtags.length,
  inspirationCount: state.discover.savedInspiration.length,
  hasMetrics: state.discover.performanceMetrics !== null,
});

export const selectAnalyzeSummary = (state: WorkflowState) => ({
  hasCampaign: state.analyze.campaignId !== null,
  hasIdea: state.analyze.userIdea.length > 0,
  ideaCount: state.analyze.aiGeneratedIdeas.length,
  hasSelectedIdea: state.analyze.selectedIdea !== null,
  assetCount: state.analyze.assets.length,
  hasPrompt: state.analyze.optimizedPrompt.length > 0,
});

export const selectCreateSummary = (state: WorkflowState) => ({
  type: state.create.creationType,
  totalGenerations: state.create.generations.length,
  completedGenerations: state.create.generations.filter((g) => g.status === "completed").length,
  selectedCount: state.create.selectedGenerations.length,
  hasActiveJobs: state.create.pipelineStatus.some(
    (p) => p.status === "queued" || p.status === "processing"
  ),
});

export const selectPublishSummary = (state: WorkflowState) => ({
  postCount: state.publish.scheduledPosts.length,
  platformCount: state.publish.selectedPlatforms.length,
  isScheduled: state.publish.publishTime !== "now",
});
