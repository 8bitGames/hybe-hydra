"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import {
  campaignsApi,
  artistsApi,
  labelsApi,
  assetsApi,
  merchandiseApi,
  Campaign,
  CampaignList,
  Artist,
  Label,
  AssetList,
  AssetStats,
  AllAssetsResponse,
  MerchandiseList,
  MerchandiseItem,
} from "./campaigns-api";
import { videoApi, VideoGeneration, VideoGenerationList, VideoGenerationStatus, VideoGenerationType } from "./video-api";
import { pipelineApi, PipelineItem, PipelineListResponse } from "./pipeline-api";
import { fastCutApi, FastCutVideo, FastCutVideosResponse } from "./fast-cut-api";

// Query Keys
export const queryKeys = {
  // Dashboard
  dashboardStats: ["dashboard", "stats"] as const,

  // Campaigns
  campaigns: ["campaigns"] as const,
  campaignsList: (params?: { page?: number; status?: string; artist_id?: string }) =>
    ["campaigns", "list", params] as const,
  campaign: (id: string) => ["campaigns", id] as const,

  // Labels
  labels: ["labels"] as const,

  // Artists
  artists: ["artists"] as const,

  // Assets
  allAssets: (params?: { page?: number; type?: string; campaign_id?: string; search?: string }) =>
    ["assets", "all", params] as const,
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
  pipelinesList: (type?: "ai" | "fast-cut" | "all") => ["pipelines", "list", type] as const,

  // Fast Cut Gallery
  fastCutVideos: ["fast-cut", "videos"] as const,
  fastCutVideosList: (params?: { page?: number; page_size?: number; campaign_id?: string }) =>
    ["fast-cut", "videos", "list", params] as const,

  // Trends
  trends: ["trends"] as const,
  trendsList: ["trends", "list"] as const,
  savedTrends: ["trends", "saved"] as const,
  trendingVideos: (hashtags?: string[]) => ["trends", "trending", hashtags] as const,
  liveTrending: () => ["trends", "live"] as const,
  keywordAnalysis: (keywords: string[]) => ["trends", "keyword-analysis", keywords] as const,
  singleKeywordAnalysis: (keyword: string) => ["trends", "keyword-analysis", "single", keyword] as const,
  keywordHistory: (params?: { limit?: number; offset?: number }) => ["trends", "keyword-history", params] as const,

  // Saved Keywords & Heatmap
  savedKeywords: (params?: { platform?: string; includeSnapshots?: boolean }) =>
    ["trends", "saved-keywords", params] as const,
  savedKeyword: (id: string) => ["trends", "saved-keywords", id] as const,
  trendHeatmap: (params?: { days?: number }) => ["trends", "heatmap", params] as const,

  // Merchandise
  merchandise: ["merchandise"] as const,
  merchandiseList: (params?: { artist_id?: string; type?: string }) =>
    ["merchandise", "list", params] as const,
  merchandiseItem: (id: string) => ["merchandise", id] as const,
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
    // Balance freshness with performance
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Refetch on mount to catch new campaigns
    placeholderData: (previousData) => previousData,
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

// Labels
export function useLabels() {
  return useQuery({
    queryKey: queryKeys.labels,
    queryFn: async () => {
      const response = await labelsApi.getAll();
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!.labels;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - labels rarely change
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

export function useCreateArtist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      label_id: string;
      stage_name?: string;
      group_name?: string;
      profile_description?: string;
    }) => {
      const response = await artistsApi.create(data);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.artists });
    },
  });
}

export function useUpdateArtist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string;
      data: {
        name?: string;
        stage_name?: string;
        group_name?: string;
        profile_description?: string;
      };
    }) => {
      const response = await artistsApi.update(id, data);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.artists });
    },
  });
}

export function useDeleteArtist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await artistsApi.delete(id);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.artists });
    },
  });
}

// Assets

// Get all assets across all campaigns
export function useAllAssets(
  params?: { page?: number; page_size?: number; type?: string; campaign_id?: string; search?: string }
) {
  return useQuery({
    queryKey: queryKeys.allAssets(params),
    queryFn: async () => {
      const response = await assetsApi.getAll(params);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    // Balance freshness with performance
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour in-memory
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Refetch on mount for fresh data
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });
}

// Get assets for a specific campaign
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
    // Balance freshness with performance
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour in-memory
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Refetch on mount for fresh data
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
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
    // Cache stats
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
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

// Merchandise
export function useMerchandise(params?: {
  artist_id?: string;
  type?: string;
  page?: number;
  page_size?: number;
  search?: string;
  active_only?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.merchandiseList({ artist_id: params?.artist_id, type: params?.type }),
    queryFn: async () => {
      const response = await merchandiseApi.getAll(params);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    enabled: !!params?.artist_id, // Only fetch when artist_id is provided
    staleTime: 5 * 60 * 1000, // 5 minutes - merchandise doesn't change often
  });
}

export function useMerchandiseItem(id: string) {
  return useQuery({
    queryKey: queryKeys.merchandiseItem(id),
    queryFn: async () => {
      const response = await merchandiseApi.getById(id);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
    enabled: !!id,
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
  options?: { type?: "ai" | "fast-cut" | "all"; refetchInterval?: number }
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

// Fast Cut Candidates - completed fast cut videos for creating variations
// Uses the fast-cut API which returns presigned URLs for video playback
export function useFastCutCandidates(campaigns: Array<{ id: string; name: string }>) {
  return useQuery({
    queryKey: ["seeds", "fast-cut", campaigns.map(c => c.id)],
    queryFn: async () => {
      if (campaigns.length === 0) return [];

      // Use fast-cut API which returns presigned URLs
      const response = await fastCutApi.getFastCutVideos({
        page_size: 100, // Get all fast-cut videos
      });

      // Map to expected format with video_type field
      return response.items.map((video) => ({
        ...video,
        video_type: "fast-cut" as const,
      })).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: campaigns.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fast Cut Gallery - all fast cut videos
export function useFastCutVideos(params?: {
  page?: number;
  page_size?: number;
  campaign_id?: string;
}) {
  return useQuery({
    queryKey: queryKeys.fastCutVideosList(params),
    queryFn: async () => {
      return fastCutApi.getFastCutVideos(params);
    },
    // Cache settings balanced for fresh data on page visits
    // Videos complete asynchronously, so cache can become stale
    staleTime: 5 * 60 * 1000, // 5 minutes - shorter to catch server-side completions
    gcTime: 60 * 60 * 1000, // 1 hour in-memory
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always refetch on mount to catch new videos
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData, // Show stale while revalidating
  });
}

// All Videos - AI videos from all campaigns (for /videos page)
export interface AllVideoItem {
  id: string;
  campaign_id: string;
  campaign_name: string;
  artist_name: string;
  prompt: string;
  duration_seconds: number;
  aspect_ratio: string;
  status: string;
  output_url: string | null;
  composed_output_url: string | null;
  created_at: string;
  updated_at: string;
  generation_type: "AI" | "FAST_CUT";
  quality_score: number | null;
  tiktok_seo?: {
    description?: string;
    hashtags?: string[];
    keywords?: string[];
    searchIntent?: string;
    suggestedPostingTimes?: string[];
    textOverlayKeywords?: string[];
  } | null;
  tags?: string[];
  quality_metadata?: {
    videoEdit?: {
      originalGenerationId: string;
      originalOutputUrl: string;
      editedAt: string;
      editType: string[];
      audioAssetId?: string;
      audioAssetName?: string;
      hasSubtitles: boolean;
      subtitleLineCount: number;
    };
    [key: string]: unknown;
  } | null;
  // Video Extension fields
  extension_count?: number;
  gcs_uri?: string | null;
  // Audio asset info
  audio_asset?: {
    id: string;
    filename: string;
    original_filename: string;
    s3_url: string;
  } | null;
}

export interface AllVideosResponse {
  items: AllVideoItem[];
  total: number;
}

export function useAllAIVideos(options?: { refetchInterval?: number | false }) {
  // First get all campaigns
  const { data: campaignData } = useCampaigns({ page_size: 100 });
  const campaigns = campaignData?.items || [];

  return useQuery({
    queryKey: ["all-videos", "ai", campaigns.map(c => c.id)],
    queryFn: async (): Promise<AllVideosResponse> => {
      if (campaigns.length === 0) {
        return { items: [], total: 0 };
      }

      const results = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const response = await videoApi.getAll(campaign.id, {
              page_size: 100,
              generation_type: "AI",
            });
            if (response.data) {
              return response.data.items.map((video) => ({
                id: video.id,
                campaign_id: video.campaign_id,
                campaign_name: campaign.name,
                artist_name: campaign.artist_name || campaign.artist_stage_name || "Unknown",
                prompt: video.prompt,
                duration_seconds: video.duration_seconds,
                aspect_ratio: video.aspect_ratio,
                status: video.status,
                output_url: video.output_url,
                composed_output_url: video.composed_output_url || null,
                created_at: video.created_at,
                updated_at: video.updated_at,
                generation_type: "AI" as const,
                quality_score: video.quality_score,
                tiktok_seo: video.tiktok_seo || null,
                tags: video.tags || [],
                quality_metadata: video.quality_metadata || null,
                extension_count: video.extension_count,
                gcs_uri: video.gcs_uri,
                audio_asset: video.audio_asset || null,
              }));
            }
            return [];
          } catch {
            return [];
          }
        })
      );

      const allVideos = results.flat().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return {
        items: allVideos,
        total: allVideos.length,
      };
    },
    enabled: campaigns.length > 0,
    // Cache settings balanced for fresh data on page visits
    // Videos complete asynchronously via EC2 callback, so cache can become stale
    staleTime: 5 * 60 * 1000, // 5 minutes - shorter to catch server-side completions
    gcTime: 60 * 60 * 1000, // 1 hour in-memory
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always refetch on mount to catch server-side video completions
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData, // Show stale while revalidating
    refetchInterval: options?.refetchInterval, // Auto-refresh when PROCESSING videos exist
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

// Trending Videos - top videos by play count
export interface TrendingVideo {
  id: string;
  platform: string;
  videoId: string;
  searchQuery: string;
  searchType: string;
  description: string | null;
  authorId: string;
  authorName: string;
  playCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  hashtags: string[];
  videoUrl: string;
  thumbnailUrl: string | null;
  collectedAt: string;
}

export interface AvailableHashtag {
  query: string;
  videoCount: number;
  totalPlayCount: number;
}

export interface TrendingVideosResponse {
  success: boolean;
  videos: TrendingVideo[];
  availableHashtags: AvailableHashtag[];
  total: number;
}

export interface LiveTrendingResponse {
  success: boolean;
  videos: TrendingVideo[];
  total: number;
  cache: {
    ageHours: number;
    maxAgeHours: number;
    refreshed: boolean;
  };
}

export function useTrendingVideos(params?: {
  hashtags?: string[];
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.trendingVideos(params?.hashtags),
    queryFn: async (): Promise<TrendingVideosResponse> => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.hashtags && params.hashtags.length > 0) {
        searchParams.set("hashtags", params.hashtags.join(","));
      }

      const query = searchParams.toString();
      const response = await api.get<TrendingVideosResponse>(
        `/api/v1/trends/trending${query ? `?${query}` : ""}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Live Trending - fetches fresh data from RapidAPI with 24h cache
export function useLiveTrending(params?: {
  limit?: number;
  forceRefresh?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.liveTrending(),
    queryFn: async (): Promise<LiveTrendingResponse> => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.forceRefresh) {
        searchParams.set("refresh", "true");
      }

      const query = searchParams.toString();
      const response = await api.get<LiveTrendingResponse>(
        `/api/v1/trends/live${query ? `?${query}` : ""}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - matches API cache
    gcTime: 25 * 60 * 60 * 1000, // 25 hours garbage collection
  });
}

// Keyword Analysis Types
interface AnalyzedVideo {
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
  likeToViewRatio: number;
  rank: number;
}

interface HashtagInsight {
  tag: string;
  count: number;
  avgEngagement: number;
  avgViews: number;
  topVideoId: string;
}

interface ContentPattern {
  pattern: string;
  count: number;
  examples: string[];
}

export interface KeywordAnalysis {
  keyword: string;
  totalVideos: number;
  analyzedAt: string;
  error?: string;
  aggregateStats: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    avgViews: number;
    avgLikes: number;
    avgComments: number;
    avgShares: number;
    avgEngagementRate: number;
    medianViews: number;
    medianEngagementRate: number;
  };
  performanceTiers: {
    viral: AnalyzedVideo[];
    highPerforming: AnalyzedVideo[];
    average: AnalyzedVideo[];
    belowAverage: AnalyzedVideo[];
  };
  hashtagInsights: {
    topHashtags: HashtagInsight[];
    hashtagCombos: { combo: string[]; count: number; avgEngagement: number }[];
    recommendedHashtags: string[];
  };
  contentPatterns: {
    avgDescriptionLength: number;
    commonPhrases: ContentPattern[];
    callToActions: ContentPattern[];
    emojiUsage: { emoji: string; count: number }[];
  };
  creatorInsights: {
    topCreators: {
      id: string;
      name: string;
      videoCount: number;
      avgEngagement: number;
      totalViews: number;
    }[];
    uniqueCreators: number;
  };
  recommendations: {
    optimalHashtagCount: number;
    suggestedHashtags: string[];
    contentTips: string[];
    engagementBenchmarks: {
      toGoViral: string;
      toBeHighPerforming: string;
      averagePerformance: string;
    };
  };
  aiInsights?: {
    summary: string;
    contentStrategy: string[];
    hashtagStrategy: string[];
    captionTemplates: string[];
    videoIdeas: string[];
    bestPostingAdvice: string;
    audienceInsights: string;
    trendPrediction: string;
  };
  videos: AnalyzedVideo[];
}

export interface KeywordAnalysisResponse {
  success: boolean;
  keywords: string[];
  analyses: KeywordAnalysis[];
  analyzedAt: string;
}

// Keyword Analysis Hook - fetches and analyzes trending videos for keywords
export function useKeywordAnalysis(params: {
  keywords: string[];
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.keywordAnalysis(params.keywords),
    queryFn: async (): Promise<KeywordAnalysisResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.set("keywords", params.keywords.join(","));
      if (params.limit) searchParams.set("limit", params.limit.toString());

      const response = await api.get<KeywordAnalysisResponse>(
        `/api/v1/trends/keyword-analysis?${searchParams.toString()}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    enabled: params.enabled !== false && params.keywords.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

// Single Keyword Analysis Hook - fetches analysis for a single keyword with caching
export function useSingleKeywordAnalysis(params: {
  keyword: string;
  limit?: number;
  enabled?: boolean;
  forceRefresh?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.singleKeywordAnalysis(params.keyword),
    queryFn: async (): Promise<KeywordAnalysis | null> => {
      const searchParams = new URLSearchParams();
      searchParams.set("keywords", params.keyword);
      if (params.limit) searchParams.set("limit", params.limit.toString());
      if (params.forceRefresh) searchParams.set("refresh", "true");

      const response = await api.get<KeywordAnalysisResponse>(
        `/api/v1/trends/keyword-analysis?${searchParams.toString()}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data?.analyses?.[0] || null;
    },
    enabled: params.enabled !== false && !!params.keyword,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

// Keyword History Types
export interface KeywordHistoryItem {
  id: string;
  keyword: string;
  platform: string;
  totalVideos: number;
  avgViews: number;
  avgEngagementRate: number;
  recommendedHashtags: string[];
  analyzedAt: string;
  expiresAt: string;
  isExpired: boolean;
  aiSummary: string | null;
}

export interface KeywordHistoryResponse {
  success: boolean;
  history: KeywordHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Keyword History Hook - fetches past keyword analyses
export function useKeywordHistory(params?: {
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.keywordHistory(params),
    queryFn: async (): Promise<KeywordHistoryResponse> => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());

      const query = searchParams.toString();
      const response = await api.get<KeywordHistoryResponse>(
        `/api/v1/trends/keyword-history${query ? `?${query}` : ""}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    enabled: params?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Saved Keywords Types
export interface SavedKeywordSnapshot {
  id: string;
  date: string;
  totalViews: number;
  avgViews: number;
  avgEngagement: number;
  totalVideos: number;
  viralCount: number;
  highPerformingCount: number;
  viewsGrowth: number | null;
  engagementGrowth: number | null;
  videosGrowth: number | null;
  trendScore: number;
  viralityScore: number;
  growthScore: number;
  topHashtags: { tag: string; count: number; avgEngagement: number }[] | null;
}

export interface SavedKeyword {
  id: string;
  userId: string;
  keyword: string;
  platform: string;
  displayName: string | null;
  color: string | null;
  priority: number;
  notes: string | null;
  baselineViews: number | null;
  baselineEngagement: number | null;
  baselineTotalVideos: number | null;
  baselineViralCount: number | null;
  alertEnabled: boolean;
  alertThreshold: number | null;
  lastAnalyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
  snapshots?: SavedKeywordSnapshot[];
}

export interface SavedKeywordsResponse {
  success: boolean;
  savedKeywords: SavedKeyword[];
  count: number;
}

export interface SaveKeywordInput {
  keyword: string;
  platform?: string;
  displayName?: string;
  color?: string;
  notes?: string;
  priority?: number;
  alertEnabled?: boolean;
  alertThreshold?: number;
  currentViews?: number;
  currentEngagement?: number;
  currentTotalVideos?: number;
  currentViralCount?: number;
}

export interface UpdateKeywordInput {
  displayName?: string;
  color?: string;
  notes?: string;
  priority?: number;
  alertEnabled?: boolean;
  alertThreshold?: number;
}

// Heatmap Types
export interface HeatmapCell {
  date: string;
  keyword: string;
  displayName: string | null;
  color: string | null;
  trendScore: number;
  viralityScore: number;
  growthScore: number;
  totalViews: number;
  avgViews: number;
  avgEngagement: number;
  totalVideos: number;
  viralCount: number;
  viewsGrowth: number | null;
  engagementGrowth: number | null;
}

export interface HeatmapData {
  dates: string[];
  keywords: {
    id: string;
    keyword: string;
    displayName: string | null;
    color: string | null;
    priority: number;
  }[];
  cells: HeatmapCell[];
  summary: {
    totalKeywords: number;
    dateRange: { start: string; end: string };
    avgTrendScore: number;
    topGrowing: { keyword: string; growthScore: number } | null;
    topViral: { keyword: string; viralityScore: number } | null;
  };
}

export interface HeatmapResponse {
  success: boolean;
  heatmap: HeatmapData;
}

export interface SyncResult {
  keyword: string;
  success: boolean;
  error?: string;
}

export interface SyncKeywordsResponse {
  success: boolean;
  message: string;
  synced: number;
  total: number;
  results: SyncResult[];
}

// Saved Keywords Hooks
export function useSavedKeywords(params?: {
  platform?: string;
  includeSnapshots?: boolean;
  snapshotDays?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.savedKeywords({
      platform: params?.platform,
      includeSnapshots: params?.includeSnapshots,
    }),
    queryFn: async (): Promise<SavedKeywordsResponse> => {
      const searchParams = new URLSearchParams();
      if (params?.platform) searchParams.set("platform", params.platform);
      if (params?.includeSnapshots) searchParams.set("include_snapshots", "true");
      if (params?.snapshotDays) searchParams.set("snapshot_days", params.snapshotDays.toString());

      const query = searchParams.toString();
      const response = await api.get<SavedKeywordsResponse>(
        `/api/v1/trends/saved-keywords${query ? `?${query}` : ""}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    enabled: params?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSavedKeyword(id: string, params?: { days?: number }) {
  return useQuery({
    queryKey: queryKeys.savedKeyword(id),
    queryFn: async (): Promise<{ success: boolean; savedKeyword: SavedKeyword }> => {
      const searchParams = new URLSearchParams();
      if (params?.days) searchParams.set("days", params.days.toString());

      const query = searchParams.toString();
      const response = await api.get<{ success: boolean; savedKeyword: SavedKeyword }>(
        `/api/v1/trends/saved-keywords/${id}${query ? `?${query}` : ""}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveKeywordInput) => {
      const response = await api.post<{ success: boolean; savedKeyword: SavedKeyword }>(
        "/api/v1/trends/saved-keywords",
        data
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trends", "saved-keywords"] });
      queryClient.invalidateQueries({ queryKey: ["trends", "heatmap"] });
    },
  });
}

export function useUpdateSavedKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateKeywordInput }) => {
      const response = await api.patch<{ success: boolean; savedKeyword: SavedKeyword }>(
        `/api/v1/trends/saved-keywords/${id}`,
        data
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["trends", "saved-keywords"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.savedKeyword(variables.id) });
      queryClient.invalidateQueries({ queryKey: ["trends", "heatmap"] });
    },
  });
}

export function useDeleteSavedKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<{ success: boolean; message: string }>(
        `/api/v1/trends/saved-keywords/${id}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trends", "saved-keywords"] });
      queryClient.invalidateQueries({ queryKey: ["trends", "heatmap"] });
    },
  });
}

// Heatmap Hooks
export function useHeatmapData(params?: {
  days?: number;
  metric?: "trendScore" | "viralityScore" | "growthScore";
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.trendHeatmap({ days: params?.days }),
    queryFn: async (): Promise<HeatmapResponse> => {
      const searchParams = new URLSearchParams();
      if (params?.days) searchParams.set("days", params.days.toString());
      if (params?.metric) searchParams.set("metric", params.metric);

      const query = searchParams.toString();
      const response = await api.get<HeatmapResponse>(
        `/api/v1/trends/heatmap${query ? `?${query}` : ""}`
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    enabled: params?.enabled !== false,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Sync Keywords Hooks
export function useSyncKeywords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keywordIds?: string[]) => {
      const response = await api.post<SyncKeywordsResponse>(
        "/api/v1/trends/saved-keywords/sync",
        keywordIds ? { keywordIds } : {}
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trends", "saved-keywords"] });
      queryClient.invalidateQueries({ queryKey: ["trends", "heatmap"] });
    },
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
    invalidateFastCutVideos: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.fastCutVideos }),
    // Add invalidation for all AI videos (shown on /videos page)
    invalidateAllAIVideos: () =>
      queryClient.invalidateQueries({ queryKey: ["all-videos", "ai"] }),
    invalidateTrends: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.trends }),
    invalidateTrendingVideos: () =>
      queryClient.invalidateQueries({ queryKey: ["trends", "trending"] }),
    invalidateLiveTrending: () =>
      queryClient.invalidateQueries({ queryKey: ["trends", "live"] }),
    invalidateKeywordAnalysis: () =>
      queryClient.invalidateQueries({ queryKey: ["trends", "keyword-analysis"] }),
    invalidateKeywordHistory: () =>
      queryClient.invalidateQueries({ queryKey: ["trends", "keyword-history"] }),
    invalidateSavedKeywords: () =>
      queryClient.invalidateQueries({ queryKey: ["trends", "saved-keywords"] }),
    invalidateHeatmap: () =>
      queryClient.invalidateQueries({ queryKey: ["trends", "heatmap"] }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
