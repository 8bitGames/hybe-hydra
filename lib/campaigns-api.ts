import { api } from "./api";

// Types
export interface Artist {
  id: string;
  name: string;
  stage_name: string | null;
  group_name: string | null;
  label_id: string;
  profile_description: string | null;
  profile_image_url: string | null;
  label_name: string | null;
  label_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  artist_id: string;
  status: "draft" | "active" | "completed" | "archived";
  target_countries: string[];
  start_date: string | null;
  end_date: string | null;
  budget_code: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  artist_name?: string;
  artist_stage_name?: string;
  // Workflow progress counts
  asset_count?: number;
  video_count?: number;
  video_completed?: number;
  video_processing?: number;
  video_failed?: number;
  video_scored?: number;
  video_avg_score?: number | null;
  approved_count?: number;
  published_count?: number;
}

export interface CampaignList {
  items: Campaign[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Asset {
  id: string;
  campaign_id: string;
  type: "image" | "video" | "audio" | "goods";
  merchandise_type?: "album" | "photocard" | "lightstick" | "apparel" | "accessory" | "other" | null;
  filename: string;
  original_filename: string;
  s3_url: string;
  file_size: number | null;
  mime_type: string | null;
  vector_embedding_id: string | null;
  thumbnail_url: string | null;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface AssetList {
  items: Asset[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AssetStats {
  image: number;
  video: number;
  audio: number;
  goods: number;
  total: number;
}

// Artists API
export const artistsApi = {
  getAll: () => api.get<Artist[]>("/api/v1/artists"),

  getById: (id: string) => api.get<Artist>(`/api/v1/artists/${id}`),
};

// Campaigns API
export const campaignsApi = {
  getAll: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    artist_id?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    if (params?.status) searchParams.set("status", params.status);
    if (params?.artist_id) searchParams.set("artist_id", params.artist_id);

    const query = searchParams.toString();
    return api.get<CampaignList>(`/api/v1/campaigns${query ? `?${query}` : ""}`);
  },

  getById: (id: string) => api.get<Campaign>(`/api/v1/campaigns/${id}`),

  create: (data: {
    name: string;
    artist_id: string;
    description?: string;
    target_countries?: string[];
    start_date?: string;
    end_date?: string;
  }) => api.post<Campaign>("/api/v1/campaigns", data),

  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: string;
      target_countries?: string[];
    }
  ) => api.patch<Campaign>(`/api/v1/campaigns/${id}`, data),

  delete: (id: string) => api.delete(`/api/v1/campaigns/${id}`),
};

// Assets API
export const assetsApi = {
  getByCampaign: (
    campaignId: string,
    params?: { page?: number; page_size?: number; type?: string }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    if (params?.type) searchParams.set("type", params.type);

    const query = searchParams.toString();
    return api.get<AssetList>(
      `/api/v1/campaigns/${campaignId}/assets${query ? `?${query}` : ""}`
    );
  },

  getById: (id: string) => api.get<Asset>(`/api/v1/assets/${id}`),

  getStats: (campaignId: string) =>
    api.get<AssetStats>(`/api/v1/campaigns/${campaignId}/assets/stats`),

  upload: async (
    campaignId: string,
    file: File,
    options?: {
      assetType?: "goods";  // Override type - only "goods" for now
      merchandiseType?: "album" | "photocard" | "lightstick" | "apparel" | "accessory" | "other";
    }
  ) => {
    const formData = new FormData();
    formData.append("file", file);

    if (options?.assetType) {
      formData.append("asset_type", options.assetType);
    }
    if (options?.merchandiseType) {
      formData.append("merchandise_type", options.merchandiseType);
    }

    const token = api.getAccessToken();

    const response = await fetch(
      `/api/v1/campaigns/${campaignId}/assets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        error: {
          code: response.status.toString(),
          message: data.detail || "Upload failed",
        },
      };
    }

    return { data };
  },

  delete: (id: string) => api.delete(`/api/v1/assets/${id}`),
};
