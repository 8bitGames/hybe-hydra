import { api } from "./api";
import { VideoGeneration, VideoGenerationType, VideoGenerationStatus, VideoGenerationList } from "./video-api";

// Pipeline type for filtering
export type PipelineType = "ai" | "compose";

// Pipeline Types
export interface PipelineItem {
  batch_id: string;
  campaign_id: string;
  campaign_name?: string;
  seed_generation_id: string;
  seed_generation: VideoGeneration;
  name?: string;
  type: PipelineType; // AI or Compose pipeline
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
  type: PipelineType; // AI or Compose pipeline
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
  // List all pipelines for a campaign with optional type filter
  list: async (campaignId: string, typeFilter?: PipelineType): Promise<PipelineListResponse> => {
    // Fetch all generations with batch metadata
    const response = await api.get<VideoGenerationList>(
      `/api/v1/campaigns/${campaignId}/generations?page_size=100`
    );

    if (!response.data) {
      return { items: [], total: 0 };
    }

    const generations = response.data.items;

    // Group by batchId with type information
    const batchMap = new Map<string, {
      generations: VideoGeneration[];
      seedGeneration?: VideoGeneration;
      type: PipelineType;
    }>();

    generations.forEach((gen: VideoGeneration) => {
      const metadata = gen.quality_metadata as Record<string, unknown> | null;
      const batchId = metadata?.batchId as string | undefined;
      const seedGenerationId = metadata?.seedGenerationId as string | undefined;
      const variationType = metadata?.variationType as string | undefined;

      // Handle both AI variations and compose variations
      if (batchId && (variationType === "variation" || variationType === "compose_variation")) {
        // Determine pipeline type from variationType
        const pipelineType: PipelineType = variationType === "compose_variation" ? "compose" : "ai";

        // Skip if type filter is applied and doesn't match
        if (typeFilter && pipelineType !== typeFilter) {
          return;
        }

        if (!batchMap.has(batchId)) {
          batchMap.set(batchId, { generations: [], type: pipelineType });
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
          type: batch.type,
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

  // List only AI pipelines for a campaign
  listAI: async (campaignId: string): Promise<PipelineListResponse> => {
    return pipelineApi.list(campaignId, "ai");
  },

  // List only Compose pipelines for a campaign
  listCompose: async (campaignId: string): Promise<PipelineListResponse> => {
    return pipelineApi.list(campaignId, "compose");
  },

  // List all pipelines across all campaigns with optional type filter
  listAll: async (campaignIds: string[], campaignNames?: Record<string, string>, typeFilter?: PipelineType): Promise<PipelineListResponse> => {
    // Fetch pipelines from all campaigns in parallel
    const results = await Promise.all(
      campaignIds.map((id) => pipelineApi.list(id, typeFilter))
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

  // List all AI pipelines across all campaigns
  listAllAI: async (campaignIds: string[], campaignNames?: Record<string, string>): Promise<PipelineListResponse> => {
    return pipelineApi.listAll(campaignIds, campaignNames, "ai");
  },

  // List all Compose pipelines across all campaigns
  listAllCompose: async (campaignIds: string[], campaignNames?: Record<string, string>): Promise<PipelineListResponse> => {
    return pipelineApi.listAll(campaignIds, campaignNames, "compose");
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

    // Determine pipeline type from first variation's metadata
    const firstVariation = response.data.variations[0];
    const metadata = firstVariation?.generation?.quality_metadata as Record<string, unknown> | null;
    const variationType = metadata?.variationType as string | undefined;
    const pipelineType: PipelineType = variationType === "compose_variation" ? "compose" : "ai";

    return {
      ...response.data,
      seed_generation: seedResponse.data,
      type: pipelineType,
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

  // Delete all variations in a pipeline batch
  deleteBatch: async (campaignId: string, batchId: string): Promise<{ deleted: number; failed: number }> => {
    // Fetch all generations for this campaign
    const response = await api.get<VideoGenerationList>(
      `/api/v1/campaigns/${campaignId}/generations?page_size=100`
    );

    if (!response.data) {
      return { deleted: 0, failed: 0 };
    }

    // Find all generations belonging to this batch
    const batchGenerations = response.data.items.filter((gen: VideoGeneration) => {
      const metadata = gen.quality_metadata as Record<string, unknown> | null;
      return metadata?.batchId === batchId;
    });

    // Delete each generation
    let deleted = 0;
    let failed = 0;

    await Promise.all(
      batchGenerations.map(async (gen: VideoGeneration) => {
        try {
          await api.delete(`/api/v1/generations/${gen.id}`);
          deleted++;
        } catch (error) {
          console.error(`Failed to delete generation ${gen.id}:`, error);
          failed++;
        }
      })
    );

    return { deleted, failed };
  },
};
