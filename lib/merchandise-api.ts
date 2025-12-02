// Merchandise API client

const API_BASE = "/api/v1";

// Types
export type MerchandiseType = "album" | "photocard" | "lightstick" | "apparel" | "accessory" | "other";
export type MerchandiseContext = "holding" | "wearing" | "showing" | "background";

export interface MerchandiseItem {
  id: string;
  name: string;
  name_ko: string | null;
  artist_id: string | null;
  artist: {
    id: string;
    name: string;
    stage_name: string | null;
    group_name: string | null;
  } | null;
  type: MerchandiseType;
  description: string | null;
  s3_url: string;
  thumbnail_url: string | null;
  file_size: number | null;
  release_date: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  usage_count?: number;
  created_at: string;
  updated_at?: string;
  last_used?: string;
}

export interface MerchandiseSuggestionCategory {
  category: "artist_merchandise" | "recently_used" | "popular" | "new_releases";
  items: MerchandiseItem[];
}

export interface MerchandiseSuggestionsResponse {
  suggestions: MerchandiseSuggestionCategory[];
  artist_id: string | null;
  campaign_id: string | null;
}

export interface MerchandiseListResponse {
  items: MerchandiseItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface MerchandiseReference {
  merchandise_id: string;
  context: MerchandiseContext;
  guidance_scale?: number;
}

export interface GenerateWithMerchandiseParams {
  base_prompt: string;
  audio_asset_id: string;  // Required: audio track for composition
  negative_prompt?: string;
  merchandise_references: MerchandiseReference[];
  style_preset_ids?: string[];
  duration_seconds?: number;
  aspect_ratio?: string;
  reference_image_id?: string;
}

export interface GenerateWithMerchandiseResponse {
  batch_id: string;
  total: number;
  generations: Array<{
    id: string;
    campaign_id: string;
    prompt: string;
    negative_prompt: string | null;
    duration_seconds: number;
    aspect_ratio: string;
    status: string;
    progress: number;
    vertex_request_id: string | null;
    created_by: string;
    created_at: string;
    style_preset: {
      id: string;
      name: string;
      name_ko: string | null;
      category: string;
    } | null;
  }>;
  merchandise_referenced: Array<{
    id: string;
    name: string;
    name_ko: string | null;
    type: string;
    s3_url: string;
    thumbnail_url: string | null;
  }>;
  merchandise_prompt: string;
  message: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    status: number;
  };
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: {
          message: data.detail || "An error occurred",
          status: response.status,
        },
      };
    }

    return { data };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : "Network error",
        status: 0,
      },
    };
  }
}

// Merchandise API functions
export const merchandiseApi = {
  // Get all merchandise with pagination and filtering
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    artist_id?: string;
    type?: MerchandiseType;
    search?: string;
    active_only?: boolean;
  }): Promise<ApiResponse<MerchandiseListResponse>> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.page_size) searchParams.set("page_size", String(params.page_size));
    if (params?.artist_id) searchParams.set("artist_id", params.artist_id);
    if (params?.type) searchParams.set("type", params.type);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.active_only !== undefined) searchParams.set("active_only", String(params.active_only));

    const query = searchParams.toString();
    return apiCall<MerchandiseListResponse>(`/merchandise${query ? `?${query}` : ""}`);
  },

  // Get single merchandise by ID
  getById: async (id: string): Promise<ApiResponse<MerchandiseItem>> => {
    return apiCall<MerchandiseItem>(`/merchandise/${id}`);
  },

  // Create new merchandise
  create: async (formData: FormData): Promise<ApiResponse<MerchandiseItem>> => {
    return apiCall<MerchandiseItem>("/merchandise", {
      method: "POST",
      body: formData,
    });
  },

  // Update merchandise
  update: async (
    id: string,
    data: {
      name?: string;
      name_ko?: string;
      type?: MerchandiseType;
      description?: string;
      is_active?: boolean;
      metadata?: Record<string, unknown>;
      release_date?: string | null;
    }
  ): Promise<ApiResponse<MerchandiseItem>> => {
    return apiCall<MerchandiseItem>(`/merchandise/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Delete merchandise
  delete: async (id: string): Promise<ApiResponse<{ message: string; deleted?: boolean; deactivated?: boolean }>> => {
    return apiCall(`/merchandise/${id}`, {
      method: "DELETE",
    });
  },

  // Get merchandise suggestions
  getSuggestions: async (params?: {
    artist_id?: string;
    campaign_id?: string;
    limit?: number;
  }): Promise<ApiResponse<MerchandiseSuggestionsResponse>> => {
    const searchParams = new URLSearchParams();
    if (params?.artist_id) searchParams.set("artist_id", params.artist_id);
    if (params?.campaign_id) searchParams.set("campaign_id", params.campaign_id);
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    return apiCall<MerchandiseSuggestionsResponse>(`/merchandise/suggestions${query ? `?${query}` : ""}`);
  },
};

// Generate with merchandise API
export const merchandiseGenerateApi = {
  // Generate videos with merchandise references
  generate: async (
    campaignId: string,
    params: GenerateWithMerchandiseParams
  ): Promise<ApiResponse<GenerateWithMerchandiseResponse>> => {
    return apiCall<GenerateWithMerchandiseResponse>(`/campaigns/${campaignId}/generations/with-merchandise`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
};

// Helper functions
export const MERCHANDISE_TYPES: { value: MerchandiseType; label: string; labelKo: string }[] = [
  { value: "album", label: "Album", labelKo: "앨범" },
  { value: "photocard", label: "Photocard", labelKo: "포토카드" },
  { value: "lightstick", label: "Lightstick", labelKo: "응원봉" },
  { value: "apparel", label: "Apparel", labelKo: "의류" },
  { value: "accessory", label: "Accessory", labelKo: "악세서리" },
  { value: "other", label: "Other", labelKo: "기타" },
];

export const MERCHANDISE_CONTEXTS: { value: MerchandiseContext; label: string; labelKo: string; description: string }[] = [
  { value: "holding", label: "Holding", labelKo: "들고 있음", description: "Product clearly visible in hands" },
  { value: "wearing", label: "Wearing", labelKo: "착용", description: "Clothing or accessories worn" },
  { value: "showing", label: "Showing", labelKo: "보여주기", description: "Presenting product to camera" },
  { value: "background", label: "Background", labelKo: "배경", description: "Product visible in background" },
];

export function getMerchandiseTypeLabel(type: MerchandiseType): string {
  return MERCHANDISE_TYPES.find((t) => t.value === type)?.label || type;
}

export function getMerchandiseTypeIcon(type: MerchandiseType): string {
  const icons: Record<MerchandiseType, string> = {
    album: "💿",
    photocard: "🎴",
    lightstick: "🔦",
    apparel: "👕",
    accessory: "💍",
    other: "📦",
  };
  return icons[type] || "📦";
}

export function getContextIcon(context: MerchandiseContext): string {
  const icons: Record<MerchandiseContext, string> = {
    holding: "🤲",
    wearing: "👔",
    showing: "📸",
    background: "🖼️",
  };
  return icons[context] || "📦";
}
