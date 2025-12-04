import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useState, useEffect } from "react";

// ============================================
// TYPES
// ============================================

export type WorkflowStage = "discover" | "analyze" | "create" | "processing" | "publish";

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

// Processing Stage Types
export interface ProcessingVideo {
  id: string;
  generationId: string;
  campaignId: string;
  campaignName: string;
  status: "processing" | "completed" | "failed" | "approved" | "rejected";
  progress: number;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  prompt: string;
  duration: number;
  aspectRatio: string;
  qualityScore: number | null;
  generationType: "AI" | "COMPOSE";
  createdAt: string;
  completedAt: string | null;
  metadata: {
    fps?: number;
    resolution?: string;
    fileSize?: number;
    audioAssetId?: string;
    audioName?: string;
    audioUrl?: string;
    imageAssets?: { id: string; url: string; name: string }[];
    effectPreset?: string;
    // Extended metadata
    negativePrompt?: string;
    referenceImageId?: string;
    referenceImageUrl?: string;
    referenceStyle?: string;
    trendKeywords?: string[];
    referenceUrls?: { url: string; title?: string; platform?: string; hashtags?: string[] }[];
    tags?: string[];
    scriptData?: Record<string, unknown>;
  };
  error?: string;
}

export interface ProcessingData {
  videos: ProcessingVideo[];
  selectedVideos: string[]; // IDs of videos selected for publishing
  filterStatus: "all" | "processing" | "completed" | "approved" | "rejected";
  sortBy: "newest" | "oldest" | "status";
  viewMode: "grid" | "list";
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

// Stashed Prompts Types
export interface StashedPrompt {
  id: string;
  prompt: string;
  title: string;
  source: "analyze" | "create" | "personalize";
  metadata: {
    // Basic settings
    aspectRatio?: string;
    duration?: string;
    style?: string;
    // Campaign & idea
    campaignId?: string;
    campaignName?: string;
    selectedIdea?: ContentIdea | null;
    // Hashtags & keywords
    hashtags?: string[];
    keywords?: string[];
    // Performance & analytics
    performanceMetrics?: {
      avgViews: number;
      avgEngagement: number;
      viralBenchmark: number;
    } | null;
    // Inspiration videos (thumbnails & stats)
    savedInspiration?: {
      id: string;
      thumbnailUrl: string | null;
      stats: {
        playCount: number;
        likeCount: number;
        commentCount: number;
        shareCount: number;
      };
    }[];
    // Target audience & goals
    targetAudience?: string[];
    contentGoals?: string[];
    // AI insights
    aiInsights?: string[];
  };
  createdAt: string;
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
  processing: ProcessingData;
  publish: PublishData;

  // Stashed prompts (shared across stages)
  stashedPrompts: StashedPrompt[];

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
  clearDiscoverAnalysis: () => void;

  // Actions - Analyze
  setAnalyzeCampaign: (id: string | null, name: string | null) => void;
  setAnalyzeUserIdea: (idea: string) => void;
  setAnalyzeTargetAudience: (audience: string[]) => void;
  setAnalyzeContentGoals: (goals: string[]) => void;
  setAnalyzeAiIdeas: (ideas: ContentIdea[]) => void;
  removeAnalyzeIdea: (ideaId: string) => void;
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

  // Actions - Processing
  setProcessingVideos: (videos: ProcessingVideo[]) => void;
  addProcessingVideo: (video: ProcessingVideo) => void;
  updateProcessingVideo: (id: string, updates: Partial<ProcessingVideo>) => void;
  removeProcessingVideo: (id: string) => void;
  toggleProcessingVideoSelection: (id: string) => void;
  setSelectedProcessingVideos: (ids: string[]) => void;
  approveProcessingVideo: (id: string) => void;
  rejectProcessingVideo: (id: string) => void;
  setProcessingFilter: (filter: ProcessingData["filterStatus"]) => void;
  setProcessingSort: (sort: ProcessingData["sortBy"]) => void;
  setProcessingViewMode: (mode: ProcessingData["viewMode"]) => void;

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
  transferToProcessing: () => void;
  transferToPublish: () => void;

  // Actions - Stashed Prompts
  stashPrompt: (prompt: Omit<StashedPrompt, "id" | "createdAt">) => void;
  restoreStashedPrompt: (id: string) => void;
  removeStashedPrompt: (id: string) => void;
  clearStashedPrompts: () => void;
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

const initialProcessingData: ProcessingData = {
  videos: [],
  selectedVideos: [],
  filterStatus: "all",
  sortBy: "newest",
  viewMode: "grid",
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
        processing: initialProcessingData,
        publish: initialPublishData,
        stashedPrompts: [],

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
            processing: initialProcessingData,
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

        clearDiscoverAnalysis: () =>
          set((state) => ({
            discover: {
              ...state.discover,
              keywords: [],
              selectedHashtags: [],
              performanceMetrics: null,
              aiInsights: [],
              trendAnalysis: null,
              // Keep savedInspiration as user may want to keep that
            },
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

        removeAnalyzeIdea: (ideaId) =>
          set((state) => ({
            analyze: {
              ...state.analyze,
              aiGeneratedIdeas: state.analyze.aiGeneratedIdeas.filter((idea) => idea.id !== ideaId),
              // If the removed idea was selected, clear the selection
              selectedIdea: state.analyze.selectedIdea?.id === ideaId ? null : state.analyze.selectedIdea,
            },
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

        // Processing Actions
        setProcessingVideos: (videos) =>
          set((state) => ({
            processing: { ...state.processing, videos },
          })),

        addProcessingVideo: (video) =>
          set((state) => ({
            processing: {
              ...state.processing,
              videos: [...state.processing.videos, video],
            },
          })),

        updateProcessingVideo: (id, updates) =>
          set((state) => ({
            processing: {
              ...state.processing,
              videos: state.processing.videos.map((v) =>
                v.id === id ? { ...v, ...updates } : v
              ),
            },
          })),

        removeProcessingVideo: (id) =>
          set((state) => ({
            processing: {
              ...state.processing,
              videos: state.processing.videos.filter((v) => v.id !== id),
              selectedVideos: state.processing.selectedVideos.filter((vId) => vId !== id),
            },
          })),

        toggleProcessingVideoSelection: (id) =>
          set((state) => ({
            processing: {
              ...state.processing,
              selectedVideos: state.processing.selectedVideos.includes(id)
                ? state.processing.selectedVideos.filter((vId) => vId !== id)
                : [...state.processing.selectedVideos, id],
            },
          })),

        setSelectedProcessingVideos: (ids) =>
          set((state) => ({
            processing: { ...state.processing, selectedVideos: ids },
          })),

        approveProcessingVideo: (id) =>
          set((state) => ({
            processing: {
              ...state.processing,
              videos: state.processing.videos.map((v) =>
                v.id === id ? { ...v, status: "approved" as const } : v
              ),
            },
          })),

        rejectProcessingVideo: (id) =>
          set((state) => ({
            processing: {
              ...state.processing,
              videos: state.processing.videos.map((v) =>
                v.id === id ? { ...v, status: "rejected" as const } : v
              ),
              selectedVideos: state.processing.selectedVideos.filter((vId) => vId !== id),
            },
          })),

        setProcessingFilter: (filter) =>
          set((state) => ({
            processing: { ...state.processing, filterStatus: filter },
          })),

        setProcessingSort: (sort) =>
          set((state) => ({
            processing: { ...state.processing, sortBy: sort },
          })),

        setProcessingViewMode: (mode) =>
          set((state) => ({
            processing: { ...state.processing, viewMode: mode },
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

        transferToProcessing: () => {
          const state = get();
          set({
            currentStage: "processing",
            completedStages: [...state.completedStages, "create" as WorkflowStage].filter(
              (v, i, a) => a.indexOf(v) === i
            ) as WorkflowStage[],
            // Processing videos will be loaded from API in the processing page
            processing: {
              ...state.processing,
              videos: [],
              selectedVideos: [],
            },
          });
        },

        transferToPublish: () => {
          const state = get();
          // Get selected videos from processing stage
          const selectedVideos = state.processing.videos.filter((v) =>
            state.processing.selectedVideos.includes(v.id) &&
            (v.status === "completed" || v.status === "approved")
          );

          set({
            currentStage: "publish",
            completedStages: [...state.completedStages, "processing" as WorkflowStage].filter(
              (v, i, a) => a.indexOf(v) === i
            ) as WorkflowStage[],
            publish: {
              ...state.publish,
              hashtags: state.analyze.hashtags,
              caption: state.analyze.selectedIdea?.hook || "",
              scheduledPosts: selectedVideos.map((video) => ({
                id: `post-${video.id}`,
                videoId: video.generationId,
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

        // Stashed Prompts Actions
        stashPrompt: (promptData) =>
          set((state) => {
            // Check if same prompt already exists
            const isDuplicate = state.stashedPrompts.some(
              (p) => p.prompt.trim() === promptData.prompt.trim()
            );
            if (isDuplicate) {
              return state; // Don't add duplicate
            }
            return {
              stashedPrompts: [
                {
                  ...promptData,
                  id: `stash-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                  createdAt: new Date().toISOString(),
                },
                ...state.stashedPrompts,
              ].slice(0, 20), // Keep max 20 stashed prompts
            };
          }),

        restoreStashedPrompt: (id) => {
          const state = get();
          const stashed = state.stashedPrompts.find((p) => p.id === id);
          if (stashed) {
            const { metadata } = stashed;
            // Restore to analyze stage with full metadata
            set({
              analyze: {
                ...state.analyze,
                optimizedPrompt: stashed.prompt,
                hashtags: metadata.hashtags || state.analyze.hashtags,
                campaignId: metadata.campaignId || state.analyze.campaignId,
                campaignName: metadata.campaignName || state.analyze.campaignName,
                selectedIdea: metadata.selectedIdea || state.analyze.selectedIdea,
                targetAudience: metadata.targetAudience || state.analyze.targetAudience,
                contentGoals: metadata.contentGoals || state.analyze.contentGoals,
              },
              discover: {
                ...state.discover,
                keywords: metadata.keywords || state.discover.keywords,
                selectedHashtags: metadata.hashtags || state.discover.selectedHashtags,
                performanceMetrics: metadata.performanceMetrics || state.discover.performanceMetrics,
                aiInsights: metadata.aiInsights || state.discover.aiInsights,
                // Restore inspiration videos if available
                savedInspiration: metadata.savedInspiration
                  ? metadata.savedInspiration.map((v) => ({
                      ...v,
                      videoUrl: "",
                      description: "",
                      author: { id: "", name: "" },
                      hashtags: [],
                      engagementRate: 0,
                    }))
                  : state.discover.savedInspiration,
              },
            });
          }
        },

        removeStashedPrompt: (id) =>
          set((state) => ({
            stashedPrompts: state.stashedPrompts.filter((p) => p.id !== id),
          })),

        clearStashedPrompts: () => set({ stashedPrompts: [] }),
      }),
      {
        name: "hydra-workflow-state",
        partialize: (state) => ({
          currentStage: state.currentStage,
          completedStages: state.completedStages,
          discover: state.discover,
          analyze: state.analyze,
          processing: state.processing, // Persist processing so approved videos remain available in publish
          publish: state.publish, // Persist publish state (caption, hashtags, etc.)
          stashedPrompts: state.stashedPrompts,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            console.log("[WorkflowStore] Rehydrated from localStorage");
          }
        },
      }
    )
  )
);

// Hook to check if store is hydrated (for SSR/CSR mismatch prevention)
export const useWorkflowHydrated = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Check if we're on the client and the store has rehydrated
    const unsubscribe = useWorkflowStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // If already hydrated (e.g., on subsequent renders)
    if (useWorkflowStore.persist.hasHydrated()) {
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

export const selectCurrentStage = (state: WorkflowState) => state.currentStage;
export const selectCompletedStages = (state: WorkflowState) => state.completedStages;

export const selectIsStageCompleted = (stage: WorkflowStage) => (state: WorkflowState) =>
  state.completedStages.includes(stage);

export const selectCanProceedToAnalyze = (state: WorkflowState) =>
  state.discover.keywords.length > 0 || state.discover.savedInspiration.length > 0;

export const selectCanProceedToCreate = (state: WorkflowState) =>
  state.analyze.campaignId !== null &&
  (state.analyze.selectedIdea !== null || state.analyze.optimizedPrompt.length > 0);

export const selectCanProceedToProcessing = (state: WorkflowState) =>
  state.create.generations.some((g) => g.status === "completed" || g.status === "processing");

export const selectCanProceedToPublish = (state: WorkflowState) =>
  state.processing.selectedVideos.length > 0 &&
  state.processing.videos.some(
    (v) => state.processing.selectedVideos.includes(v.id) &&
    (v.status === "completed" || v.status === "approved")
  );

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

export const selectProcessingSummary = (state: WorkflowState) => ({
  totalVideos: state.processing.videos.length,
  processingCount: state.processing.videos.filter((v) => v.status === "processing").length,
  completedCount: state.processing.videos.filter((v) => v.status === "completed").length,
  approvedCount: state.processing.videos.filter((v) => v.status === "approved").length,
  failedCount: state.processing.videos.filter((v) => v.status === "failed").length,
  selectedCount: state.processing.selectedVideos.length,
  hasProcessingJobs: state.processing.videos.some((v) => v.status === "processing"),
});

export const selectPublishSummary = (state: WorkflowState) => ({
  postCount: state.publish.scheduledPosts.length,
  platformCount: state.publish.selectedPlatforms.length,
  isScheduled: state.publish.publishTime !== "now",
});
