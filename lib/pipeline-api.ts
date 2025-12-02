import { api } from "./api";
import { VideoGeneration, VideoGenerationStatus, VideoGenerationList } from "./video-api";

// Pipeline Types
export interface PipelineItem {
  batch_id: string;
  campaign_id: string;
  campaign_name?: string;
  seed_generation_id: string;
  seed_generation: VideoGeneration;
  name?: string;
  status: "pending" | "processing" | "completed" | "partial_failure";
  overall_progress: number;
  total: number;
  completed: number;
  failed: number;
  style_categories: string[];
  created_at: string;
  updated_at: string;
}

export interface PipelineVariation {
  id: string;
  variation_label: string;
  applied_presets: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  prompt_modification?: string;
  status: VideoGenerationStatus;
  generation: VideoGeneration;
}

export interface PipelineDetail {
  batch_id: string;
  seed_generation_id: string;
  seed_generation: VideoGeneration;
  batch_status: "pending" | "processing" | "completed" | "partial_failure";
  overall_progress: number;
  total: number;
  completed: number;
  failed: number;
  variations: PipelineVariation[];
}

export interface PipelineListResponse {
  items: PipelineItem[];
  total: number;
}

// Pipeline API
export const pipelineApi = {
  // List all pipelines for a campaign
  list: async (campaignId: string): Promise<PipelineListResponse> => {
    // Fetch all generations with batch metadata
    const response = await api.get<VideoGenerationList>(
      `/api/v1/campaigns/${campaignId}/generations?page_size=100`
    );

    if (!response.data) {
      return { items: [], total: 0 };
    }

    const generations = response.data.items;

    // Group by batchId
    const batchMap = new Map<string, {
      generations: VideoGeneration[];
      seedGeneration?: VideoGeneration;
    }>();

    generations.forEach((gen: VideoGeneration) => {
      const metadata = gen.quality_metadata as Record<string, unknown> | null;
      const batchId = metadata?.batchId as string | undefined;
      const seedGenerationId = metadata?.seedGenerationId as string | undefined;
      const variationType = metadata?.variationType as string | undefined;

      if (batchId && variationType === "variation") {
        if (!batchMap.has(batchId)) {
          batchMap.set(batchId, { generations: [] });
        }
        const batch = batchMap.get(batchId)!;
        batch.generations.push(gen);

        // Find seed generation
        if (seedGenerationId && !batch.seedGeneration) {
          const seed = generations.find((g: VideoGeneration) => g.id === seedGenerationId);
          if (seed) {
            batch.seedGeneration = seed;
          }
        }
      }
    });

    // Convert to pipeline items
    const items: PipelineItem[] = [];

    batchMap.forEach((batch, batchId) => {
      if (batch.generations.length === 0) return;

      const statuses = batch.generations.map((g) => g.status);
      let status: PipelineItem["status"] = "processing";
      if (statuses.every((s) => s === "completed")) {
        status = "completed";
      } else if (statuses.some((s) => s === "failed")) {
        status = "partial_failure";
      } else if (statuses.every((s) => s === "pending")) {
        status = "pending";
      }

      const completed = statuses.filter((s) => s === "completed").length;
      const failed = statuses.filter((s) => s === "failed").length;
      const progress = Math.round(
        batch.generations.reduce((sum, g) => sum + g.progress, 0) / batch.generations.length
      );

      // Extract style categories from first generation's metadata
      const firstMetadata = batch.generations[0]?.quality_metadata as Record<string, unknown> | null;
      const appliedPresets = (firstMetadata?.appliedPresets as Array<{ category: string }>) || [];
      const styleCategories = [...new Set(appliedPresets.map((p) => p.category))];

      if (batch.seedGeneration) {
        items.push({
          batch_id: batchId,
          campaign_id: campaignId,
          seed_generation_id: batch.seedGeneration.id,
          seed_generation: batch.seedGeneration,
          status,
          overall_progress: progress,
          total: batch.generations.length,
          completed,
          failed,
          style_categories: styleCategories,
          created_at: batch.generations[0]?.created_at || new Date().toISOString(),
          updated_at: batch.generations[0]?.updated_at || new Date().toISOString(),
        });
      }
    });

    // Sort by created_at descending
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      items,
      total: items.length,
    };
  },

  // List all pipelines across all campaigns
  listAll: async (campaignIds: string[], campaignNames?: Record<string, string>): Promise<PipelineListResponse> => {
    // Fetch pipelines from all campaigns in parallel
    const results = await Promise.all(
      campaignIds.map((id) => pipelineApi.list(id))
    );

    // Combine all items
    const allItems: PipelineItem[] = [];
    results.forEach((result, index) => {
      const campaignId = campaignIds[index];
      result.items.forEach((item) => {
        allItems.push({
          ...item,
          campaign_id: campaignId,
          campaign_name: campaignNames?.[campaignId],
        });
      });
    });

    // Sort by created_at descending
    allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      items: allItems,
      total: allItems.length,
    };
  },

  // Get pipeline detail with all variations
  getDetail: async (seedGenerationId: string, batchId: string): Promise<PipelineDetail> => {
    const response = await api.get<{
      batch_id: string;
      seed_generation_id: string;
      batch_status: "pending" | "processing" | "completed" | "partial_failure";
      overall_progress: number;
      total: number;
      completed: number;
      failed: number;
      variations: Array<{
        id: string;
        variation_label: string;
        applied_presets: Array<{ id: string; name: string; category: string }>;
        prompt_modification?: string;
        status: string;
        generation: VideoGeneration;
      }>;
    }>(`/api/v1/generations/${seedGenerationId}/variations?batch_id=${batchId}`);

    // Fetch seed generation
    const seedResponse = await api.get<VideoGeneration>(
      `/api/v1/generations/${seedGenerationId}`
    );

    if (!response.data || !seedResponse.data) {
      throw new Error("Failed to fetch pipeline detail");
    }

    return {
      ...response.data,
      seed_generation: seedResponse.data,
      variations: response.data.variations.map((v) => ({
        ...v,
        status: v.status as VideoGenerationStatus,
      })),
    };
  },

  // Cancel a pipeline (not implemented yet - placeholder)
  cancel: async (batchId: string): Promise<void> => {
    // TODO: Implement cancel endpoint
    console.warn("Pipeline cancel not yet implemented", batchId);
  },
};
