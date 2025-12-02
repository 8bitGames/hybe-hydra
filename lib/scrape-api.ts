import { api } from "./api";

export type ScrapePlatform = "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "UNKNOWN";

export interface ScrapedData {
  url: string;
  platform: ScrapePlatform;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  author: string | null;
  author_url: string | null;
  view_count: string | null;
  like_count: string | null;
  embed_html: string | null;
  hashtags: string[];
  metadata: Record<string, unknown>;
}

export const scrapeApi = {
  // Scrape a URL for content data
  scrape: (url: string) =>
    api.post<ScrapedData>("/api/v1/scrape", { url }),
};

// Helper to get platform display name
export function getPlatformDisplayName(platform: ScrapePlatform): string {
  switch (platform) {
    case "YOUTUBE":
      return "YouTube";
    case "TIKTOK":
      return "TikTok";
    case "INSTAGRAM":
      return "Instagram";
    default:
      return "Unknown";
  }
}

// Helper to get platform color
export function getScrapePlatformColor(platform: ScrapePlatform): string {
  switch (platform) {
    case "YOUTUBE":
      return "#ff0000";
    case "TIKTOK":
      return "#00f2ea";
    case "INSTAGRAM":
      return "#e1306c";
    default:
      return "#6b7280";
  }
}
