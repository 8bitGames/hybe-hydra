/**
 * TikTok oEmbed API utilities
 * Used to get stable thumbnail URLs that don't expire (unlike signed CDN URLs)
 */

interface OEmbedResponse {
  version: string;
  type: string;
  title: string;
  author_url: string;
  author_name: string;
  width: string;
  height: string;
  html: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  provider_url: string;
  provider_name: string;
}

/**
 * Get TikTok video info via oEmbed API
 * This returns stable URLs that work for server-side fetching
 *
 * @param videoUrl - TikTok video URL (e.g., https://www.tiktok.com/@user/video/123)
 * @returns OEmbed response or null if failed
 */
export async function getTikTokOEmbed(
  videoUrl: string
): Promise<OEmbedResponse | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(oembedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[TikTok oEmbed] Failed to fetch: ${response.status}`);
      return null;
    }

    return (await response.json()) as OEmbedResponse;
  } catch (error) {
    console.warn("[TikTok oEmbed] Error:", error);
    return null;
  }
}

/**
 * Get TikTok thumbnail URL via oEmbed API
 * More reliable than signed CDN URLs for server-side access
 *
 * @param videoUrl - TikTok video URL
 * @returns Thumbnail URL or null if failed
 */
export async function getTikTokThumbnailViaOEmbed(
  videoUrl: string
): Promise<string | null> {
  const oembed = await getTikTokOEmbed(videoUrl);
  return oembed?.thumbnail_url || null;
}

/**
 * Batch get TikTok thumbnails via oEmbed API
 * Returns a map of video URL -> thumbnail URL
 *
 * @param videoUrls - Array of TikTok video URLs
 * @param concurrency - Number of concurrent requests (default: 5)
 * @returns Map of videoUrl -> thumbnailUrl
 */
export async function batchGetTikTokThumbnails(
  videoUrls: string[],
  concurrency: number = 5
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();

  // Process in chunks to limit concurrency
  const chunks: string[][] = [];
  for (let i = 0; i < videoUrls.length; i += concurrency) {
    chunks.push(videoUrls.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (videoUrl) => {
        const thumbnailUrl = await getTikTokThumbnailViaOEmbed(videoUrl);
        return { videoUrl, thumbnailUrl };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.thumbnailUrl) {
        resultMap.set(result.value.videoUrl, result.value.thumbnailUrl);
      }
    }
  }

  return resultMap;
}
