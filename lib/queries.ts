"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import {
  campaignsApi,
  artistsApi,
  assetsApi,
  Campaign,
  CampaignList,
  Artist,
  AssetList,
  AssetStats,
} from "./campaigns-api";
import { videoApi, VideoGeneration, VideoGenerationList, VideoGenerationStatus, VideoGenerationType } from "./video-api";
import { pipelineApi, PipelineItem, PipelineListResponse } from "./pipeline-api";
import { composeApi, ComposedVideo, ComposedVideosResponse } from "./compose-api";

// Query Keys
export const queryKeys = {
  // Dashboard
  dashboardStats: ["dashboard", "stats"] as const,

  // Campaigns
  campaigns: ["campaigns"] as const,
  campaignsList: (params?: { page?: number; status?: string; artist_id?: string }) =>
    ["campaigns", "list", params] as const,
  campaign: (id: string) => ["campaigns", id] as const,

  // Artists
  artists: ["artists"] as const,

  // Assets
  assets: (campaignId: string) => ["assets", campaignId] as const,
  assetsList: (campaignId: string, params?: { page?: number; type?: string }) =>
    ["assets", campaignId, "list", params] as const,
  assetsStats: (campaignId: string) => ["assets", campaignId, "stats"] as const,

  // Videos/Generations
  videos: (campaignId: string) => ["videos", campaignId] as const,
  videosList: (campaignId: string, params?: { page?: number; status?: string; generation_type?: string }) =>
    ["videos", campaignId, "list", params] as const,
  video: (id: string) => ["videos", "detail", id] as const,

  // Pipelines
  pipelines: ["pipelines"] as const,
  pipelinesList: (type?: "ai" | "compose" | "all") => ["pipelines", "list", type] as const,

  // Compose Gallery
  composeVideos: ["compose", "videos"] as const,
  composeVideosList: (params?: { page?: number; page_size?: number; campaign_id?: string }) =>
    ["compose", "videos", "list", params] as const,

  // Trends
  trends: ["trends"] as const,
  trendsList: ["trends", "list"] as const,
  savedTrends: ["trends", "saved"] as const,
};

// Dashboard Stats
interface DashboardStats {
  summary: {
    campaigns: {
      total: number;
      by_status: Record<string, number>;
    };
    generations: {
      total: number;
      by_status: Record<string, number>;
      scored: number;
      avg_quality_score: number | null;
      high_quality_count: number;
    };
    publishing: {
      total: number;
      by_status: Record<string, number>;
      by_platform: Record<string, number>;
    };
  };
  sns_performance: {
    total_published: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_saves: number;
    avg_engagement_rate: number | null;
    by_platform: Record<string, { posts: number; views: number; likes: number }>;
  };
  campaigns_overview: Array<{
    id: string;
    name: string;
    status: string;
    artist_name: string;
    artist_group: string | null;
    asset_count: number;
    generation_count: number;
    completed_generations: number;
    processing_generations: number;
    published_count: number;
    scheduled_count: number;
    total_views: number;
    updated_at: string;
  }>;
  recent_activity: {
    generations: Array<{
      id: string;
      campaign_id: string;
      campaign_name: string;
      prompt: string;
      output_url: string | null;
      quality_score: number | null;
      created_at: string;
    }>;
    published: Array<{
      id: string;
      campaign_id: string;
      campaign_name: string;
      platform: string;
      account_name: string;
      published_url: string | null;
      view_count: number | null;
      like_count: number | null;
      published_at: string | null;
    }>;
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: async () => {
      const response = await api.get<DashboardStats>("/api/v1/dashboard/stats");
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Campaigns
export function useCampaigns(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  artist_id?: string;
}) {
  return useQuery({
    queryKey: queryKeys.campaignsList(params),
    queryFn: async () => {
      const response = await campaignsApi.getAll(params);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: async () => {
      const response = await campaignsApi.getById(id);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      artist_id: string;
      description?: string;
      target_countries?: string[];
      start_date?: string;
      end_date?: string;
    }) => {
      const response = await campaignsApi.create(data);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        status?: string;
        target_countries?: string[];
        start_date?: string | null;
        end_date?: string | null;
      };
    }) => {
      const response = await campaignsApi.update(id, data);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await campaignsApi.delete(id);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
  });
}

// Artists
export function useArtists() {
  return useQuery({
    queryKey: queryKeys.artists,
    queryFn: async () => {
      const response = await artistsApi.getAll();
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - artists don't change often
  });
}

// Assets
export function useAssets(
  campaignId: string,
  params?: { page?: number; page_size?: number; type?: string }
) {
  return useQuery({
    queryKey: queryKeys.assetsList(campaignId, params),
    queryFn: async () => {
      const response = await assetsApi.getByCampaign(campaignId, params);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    enabled: !!campaignId,
  });
}

export function useAssetsStats(campaignId: string) {
  return useQuery({
    queryKey: queryKeys.assetsStats(campaignId),
    queryFn: async () => {
      const response = await assetsApi.getStats(campaignId);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    enabled: !!campaignId,
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const response = await assetsApi.delete(id);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return { id, campaignId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets(variables.campaignId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.assetsStats(variables.campaignId) });
    },
  });
}

// Videos/Generations
export function useVideos(
  campaignId: string,
  params?: { page?: number; page_size?: number; status?: VideoGenerationStatus; generation_type?: VideoGenerationType }
) {
  return useQuery({
    queryKey: queryKeys.videosList(campaignId, params),
    queryFn: async () => {
      const response = await videoApi.getAll(campaignId, params);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    enabled: !!campaignId,
  });
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: queryKeys.video(id),
    queryFn: async () => {
      const response = await videoApi.getById(id);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    enabled: !!id,
  });
}

// Performance Stats - derived from dashboard stats (no extra API calls!)
export interface PerformanceStats {
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  processingVideos: number;
  avgQualityScore: number;
  successRate: number;
}

// Helper function to derive performance stats from dashboard stats
export function derivePerformanceStats(dashboardStats: DashboardStats | undefined): PerformanceStats {
  if (!dashboardStats) {
    return {
      totalVideos: 0,
      completedVideos: 0,
      failedVideos: 0,
      processingVideos: 0,
      avgQualityScore: 0,
      successRate: 0,
    };
  }

  const { summary } = dashboardStats;
  const byStatus = summary.generations.by_status;

  const completed = byStatus.COMPLETED || 0;
  const failed = byStatus.FAILED || 0;
  const processing = (byStatus.PROCESSING || 0) + (byStatus.PENDING || 0);
  const total = summary.generations.total;

  return {
    totalVideos: total,
    completedVideos: completed,
    failedVideos: failed,
    processingVideos: processing,
    avgQualityScore: summary.generations.avg_quality_score || 0,
    successRate: completed + failed > 0
      ? (completed / (completed + failed)) * 100
      : 0,
  };
}

// Hook that derives performance stats from dashboard stats (reuses cached data)
export function usePerformanceStats() {
  const { data: dashboardStats, isLoading, error } = useDashboardStats();

  return {
    data: derivePerformanceStats(dashboardStats),
    isLoading,
    error,
  };
}

// Pipelines - fetches all pipelines across campaigns
export function usePipelines(
  campaigns: Array<{ id: string; name: string }>,
  options?: { type?: "ai" | "compose" | "all"; refetchInterval?: number }
) {
  const campaignIds = campaigns.map((c) => c.id);
  const campaignNames = campaigns.reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {} as Record<string, string>);

  return useQuery({
    queryKey: queryKeys.pipelinesList(options?.type),
    queryFn: async (): Promise<PipelineListResponse> => {
      if (campaignIds.length === 0) {
        return { items: [], total: 0 };
      }
      return pipelineApi.listAll(campaignIds, campaignNames, options?.type === "all" ? undefined : options?.type);
    },
    enabled: campaigns.length > 0,
    staleTime: 30 * 1000, // 30 seconds - pipelines change frequently
    refetchInterval: options?.refetchInterval, // For auto-refresh during processing
  });
}

// Seed Candidates - completed AI videos for creating variations
export function useSeedCandidates(campaigns: Array<{ id: string; name: string }>) {
  return useQuery({
    queryKey: ["seeds", "ai"],
    queryFn: async () => {
      if (campaigns.length === 0) return [];

      const campaignNames = campaigns.reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {} as Record<string, string>);

      const results = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const response = await videoApi.getAll(campaign.id, {
              status: "completed",
              page_size: 50,
            });
            if (response.data) {
              return response.data.items
                .filter((video) => !video.id.startsWith("compose-"))
                .map((video) => ({
                  ...video,
                  campaign_name: campaignNames[campaign.id],
                  video_type: "ai" as const,
                }));
            }
            return [];
          } catch {
            return [];
          }
        })
      );

      return results.flat().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: campaigns.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Compose Candidates - completed compose videos for creating variations
export function useComposeCandidates(campaigns: Array<{ id: string; name: string }>) {
  return useQuery({
    queryKey: ["seeds", "compose"],
    queryFn: async () => {
      if (campaigns.length === 0) return [];

      const campaignNames = campaigns.reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {} as Record<string, string>);

      const results = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const response = await videoApi.getAll(campaign.id, {
              status: "completed",
              page_size: 50,
            });
            if (response.data) {
              return response.data.items
                .filter((video) => video.id.startsWith("compose-"))
                .map((video) => ({
                  ...video,
                  campaign_name: campaignNames[campaign.id],
                  video_type: "compose" as const,
                }));
            }
            return [];
          } catch {
            return [];
          }
        })
      );

      return results.flat().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: campaigns.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Compose Gallery - all composed videos
export function useComposeVideos(params?: {
  page?: number;
  page_size?: number;
  campaign_id?: string;
}) {
  return useQuery({
    queryKey: queryKeys.composeVideosList(params),
    queryFn: async () => {
      return composeApi.getComposedVideos(params);
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// Trends - saved trend videos from database
export interface SavedTrendVideo {
  id: string;
  searchQuery: string;
  searchType: string;
  playCount: number | null;
}

export interface TrendGroup {
  query: string;
  type: string;
  videos: SavedTrendVideo[];
  totalPlayCount: number;
}

export function useSavedTrends() {
  return useQuery({
    queryKey: queryKeys.savedTrends,
    queryFn: async (): Promise<TrendGroup[]> => {
      const response = await api.get<{
        success: boolean;
        videos: SavedTrendVideo[];
        total: number;
      }>("/api/v1/trends/videos?limit=100");

      if (response.error) {
        throw new Error(response.error.message);
      }

      const videos = response.data?.videos || [];

      // Group videos by search query
      const groupMap = new Map<string, SavedTrendVideo[]>();
      videos.forEach((video) => {
        const existing = groupMap.get(video.searchQuery) || [];
        existing.push(video);
        groupMap.set(video.searchQuery, existing);
      });

      // Convert to TrendGroup array and sort
      const groups: TrendGroup[] = Array.from(groupMap.entries()).map(([query, vids]) => ({
        query,
        type: vids[0]?.searchType || "keyword",
        videos: vids.sort((a, b) => (b.playCount || 0) - (a.playCount || 0)),
        totalPlayCount: vids.reduce((sum, v) => sum + (v.playCount || 0), 0),
      }));

      groups.sort((a, b) => b.totalPlayCount - a.totalPlayCount);
      return groups;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Invalidation helpers
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateDashboard: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats }),
    invalidateCampaigns: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns }),
    invalidateCampaign: (id: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(id) }),
    invalidateAssets: (campaignId: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.assets(campaignId) }),
    invalidateVideos: (campaignId: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.videos(campaignId) }),
    invalidatePipelines: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines }),
    invalidateComposeVideos: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.composeVideos }),
    invalidateTrends: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.trends }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
