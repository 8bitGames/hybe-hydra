import { api } from "./api";

// Types
export type PublishPlatform = "TIKTOK" | "YOUTUBE" | "INSTAGRAM" | "TWITTER";
export type PublishStatus = "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";

// Social Account Types
export interface SocialAccount {
  id: string;
  platform: PublishPlatform;
  account_name: string;
  account_id: string;
  profile_url: string | null;
  follower_count: number | null;
  is_active: boolean;
  label_id: string;
  token_expires_at: string | null;
  is_token_valid: boolean;
  scheduled_posts_count: number;
  created_at: string;
  updated_at: string;
}

export interface SocialAccountsResponse {
  accounts: SocialAccount[];
  total: number;
}

export interface CreateSocialAccountRequest {
  platform: PublishPlatform;
  account_name: string;
  account_id: string;
  label_id: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  profile_url?: string;
  follower_count?: number;
}

// Scheduled Post Types
export interface ScheduledPostGeneration {
  id: string;
  prompt: string;
  output_url: string | null;
  aspect_ratio: string;
  duration_seconds: number;
  quality_score: number | null;
  campaign?: {
    id: string;
    name: string;
    artist: {
      name: string;
      stage_name: string | null;
      group_name: string | null;
    };
  };
}

export interface PostAnalytics {
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  share_count: number | null;
  save_count: number | null;
  engagement_rate: number | null;
  last_synced_at: string | null;
}

export interface ScheduledPost {
  id: string;
  campaign_id: string;
  generation_id: string;
  platform: PublishPlatform;
  status: PublishStatus;
  caption: string | null;
  hashtags: string[];
  thumbnail_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  timezone: string;
  platform_settings: Record<string, unknown> | null;
  published_url: string | null;
  platform_post_id: string | null;
  error_message: string | null;
  retry_count: number;
  // Analytics
  analytics?: PostAnalytics;
  created_at: string;
  updated_at: string;
  social_account: {
    id: string;
    platform: PublishPlatform;
    account_name: string;
    profile_url: string | null;
  };
  generation: ScheduledPostGeneration | null;
}

export interface ScheduledPostsResponse {
  items: ScheduledPost[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CreateScheduledPostRequest {
  campaign_id: string;
  generation_id: string;
  social_account_id: string;
  caption?: string;
  hashtags?: string[];
  scheduled_at?: string;
  timezone?: string;
  platform_settings?: Record<string, unknown>;
  thumbnail_url?: string;
}

export interface UpdateScheduledPostRequest {
  caption?: string;
  hashtags?: string[];
  scheduled_at?: string | null;
  timezone?: string;
  platform_settings?: Record<string, unknown>;
  thumbnail_url?: string;
  status?: PublishStatus;
}

// Platform-specific settings interfaces
export interface TikTokSettings {
  privacy_level?: "PUBLIC" | "FRIENDS" | "PRIVATE";
  allow_comments?: boolean;
  allow_duet?: boolean;
  allow_stitch?: boolean;
  music_id?: string;
}

export interface YouTubeSettings {
  privacy_status?: "public" | "private" | "unlisted";
  title?: string;
  description?: string;
  tags?: string[];
  category_id?: string;
  made_for_kids?: boolean;
}

export interface InstagramSettings {
  media_type?: "REELS" | "FEED";
  share_to_feed?: boolean;
  location_id?: string;
}

// Social Accounts API
export const socialAccountsApi = {
  // Get all connected social accounts
  getAll: (params?: {
    platform?: PublishPlatform;
    label_id?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.platform) searchParams.set("platform", params.platform);
    if (params?.label_id) searchParams.set("label_id", params.label_id);

    const query = searchParams.toString();
    return api.get<SocialAccountsResponse>(
      `/api/v1/publishing/accounts${query ? `?${query}` : ""}`
    );
  },

  // Connect a new social account
  create: (data: CreateSocialAccountRequest) =>
    api.post<SocialAccount>(
      "/api/v1/publishing/accounts",
      data as unknown as Record<string, unknown>
    ),
};

// Scheduled Posts API
export const scheduledPostsApi = {
  // Get all scheduled posts
  getAll: (params?: {
    campaign_id?: string;
    platform?: PublishPlatform;
    status?: PublishStatus;
    page?: number;
    page_size?: number;
    upcoming?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.campaign_id) searchParams.set("campaign_id", params.campaign_id);
    if (params?.platform) searchParams.set("platform", params.platform);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    if (params?.upcoming) searchParams.set("upcoming", "true");

    const query = searchParams.toString();
    return api.get<ScheduledPostsResponse>(
      `/api/v1/publishing/schedule${query ? `?${query}` : ""}`
    );
  },

  // Get a single scheduled post
  getById: (postId: string) =>
    api.get<ScheduledPost>(`/api/v1/publishing/schedule/${postId}`),

  // Create a new scheduled post
  create: (data: CreateScheduledPostRequest) =>
    api.post<ScheduledPost>(
      "/api/v1/publishing/schedule",
      data as unknown as Record<string, unknown>
    ),

  // Update a scheduled post
  update: (postId: string, data: UpdateScheduledPostRequest) =>
    api.patch<ScheduledPost>(
      `/api/v1/publishing/schedule/${postId}`,
      data as unknown as Record<string, unknown>
    ),

  // Delete a scheduled post
  delete: (postId: string) =>
    api.delete(`/api/v1/publishing/schedule/${postId}`),

  // Cancel a scheduled post
  cancel: (postId: string) =>
    api.patch<ScheduledPost>(
      `/api/v1/publishing/schedule/${postId}`,
      { status: "CANCELLED" }
    ),

  // Reschedule a post
  reschedule: (postId: string, scheduledAt: string, timezone?: string) =>
    api.patch<ScheduledPost>(
      `/api/v1/publishing/schedule/${postId}`,
      { scheduled_at: scheduledAt, timezone, status: "SCHEDULED" }
    ),
};

// Analytics Response Types
export interface CampaignAnalyticsSummary {
  campaign_id: string;
  campaign_name: string;
  total_posts: number;
  published_posts: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  avg_engagement_rate: number;
  by_platform: Record<PublishPlatform, {
    posts: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
  }>;
  top_posts: ScheduledPost[];
}

export interface AnalyticsSyncResult {
  post_id: string;
  success: boolean;
  analytics?: PostAnalytics;
  error?: string;
}

// Analytics API
export const analyticsApi = {
  // Get analytics summary for a campaign
  getCampaignSummary: (campaignId: string) =>
    api.get<CampaignAnalyticsSummary>(
      `/api/v1/publishing/analytics/campaign/${campaignId}`
    ),

  // Get published posts with analytics for a campaign
  getPublishedPosts: (params?: {
    campaign_id?: string;
    platform?: PublishPlatform;
    sort_by?: "views" | "likes" | "engagement" | "date";
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.campaign_id) searchParams.set("campaign_id", params.campaign_id);
    if (params?.platform) searchParams.set("platform", params.platform);
    if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());

    const query = searchParams.toString();
    return api.get<ScheduledPostsResponse>(
      `/api/v1/publishing/analytics/posts${query ? `?${query}` : ""}`
    );
  },

  // Sync analytics for a single post (fetch from SNS)
  syncPost: (postId: string) =>
    api.post<AnalyticsSyncResult>(
      `/api/v1/publishing/analytics/sync/${postId}`
    ),

  // Sync analytics for all published posts in a campaign
  syncCampaign: (campaignId: string) =>
    api.post<{ synced: number; failed: number; results: AnalyticsSyncResult[] }>(
      `/api/v1/publishing/analytics/sync/campaign/${campaignId}`
    ),

  // Manual analytics update (for demo/testing or manual entry)
  updateAnalytics: (postId: string, data: Partial<PostAnalytics>) =>
    api.patch<ScheduledPost>(
      `/api/v1/publishing/analytics/${postId}`,
      data as unknown as Record<string, unknown>
    ),
};

// Helper functions
export function getPlatformDisplayName(platform: PublishPlatform): string {
  const names: Record<PublishPlatform, string> = {
    TIKTOK: "TikTok",
    YOUTUBE: "YouTube",
    INSTAGRAM: "Instagram",
    TWITTER: "Twitter/X",
  };
  return names[platform] || platform;
}

export function getPlatformIcon(platform: PublishPlatform): string {
  const icons: Record<PublishPlatform, string> = {
    TIKTOK: "📱",
    YOUTUBE: "▶️",
    INSTAGRAM: "📷",
    TWITTER: "🐦",
  };
  return icons[platform] || "🌐";
}

export function getPlatformColor(platform: PublishPlatform): string {
  const colors: Record<PublishPlatform, string> = {
    TIKTOK: "#00f2ea",
    YOUTUBE: "#ff0000",
    INSTAGRAM: "#e1306c",
    TWITTER: "#1da1f2",
  };
  return colors[platform] || "#6b7280";
}

export function getStatusDisplayName(status: PublishStatus): string {
  const names: Record<PublishStatus, string> = {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    PUBLISHING: "Publishing...",
    PUBLISHED: "Published",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  };
  return names[status] || status;
}

export function getStatusColor(status: PublishStatus): string {
  const colors: Record<PublishStatus, string> = {
    DRAFT: "gray",
    SCHEDULED: "blue",
    PUBLISHING: "yellow",
    PUBLISHED: "green",
    FAILED: "red",
    CANCELLED: "gray",
  };
  return colors[status] || "gray";
}

export function formatScheduledTime(
  dateString: string,
  timezone: string = "Asia/Seoul"
): string {
  const date = new Date(dateString);
  return date.toLocaleString("ko-KR", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTimeUntilPublish(dateString: string): string {
  const now = new Date();
  const scheduled = new Date(dateString);
  const diff = scheduled.getTime() - now.getTime();

  if (diff < 0) return "Overdue";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
