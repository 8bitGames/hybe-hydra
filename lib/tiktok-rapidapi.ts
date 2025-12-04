/**
 * TikTok Scraping via RapidAPI (ScrapTik)
 * Fast, reliable API-based scraping without browser automation.
 */

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "2b748a1b3cmshe05f9ca2282e082p17573ejsn2ad2e7d431ad";
const RAPIDAPI_HOST = "scraptik.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

export interface TikTokVideo {
  id: string;
  description: string;
  author: {
    uniqueId: string;
    nickname: string;
    avatarUrl?: string;
  };
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  };
  videoUrl: string;
  thumbnailUrl?: string;
  hashtags: string[];
  createTime?: number;
  musicTitle?: string;
}

export interface SearchResult {
  success: boolean;
  keyword: string;
  videos: TikTokVideo[];
  relatedHashtags: string[];
  error?: string;
}

export interface HashtagResult {
  success: boolean;
  hashtag: string;
  info: {
    title: string;
    viewCount: number;
    videoCount?: number;
    description?: string;
  } | null;
  videos: TikTokVideo[];
  error?: string;
}

function getHeaders() {
  return {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": RAPIDAPI_HOST,
  };
}

/**
 * Search TikTok for videos by keyword
 */
export async function searchTikTok(keyword: string, limit: number = 20): Promise<SearchResult> {
  console.log(`[TIKTOK-RAPIDAPI] Searching for: ${keyword}`);

  try {
    const params = new URLSearchParams({
      keyword,
      count: String(Math.min(limit, 30)),
      offset: "0",
      use_filters: "0",
      publish_time: "0",
      sort_type: "0",
      region: "US",
    });

    const response = await fetch(`${BASE_URL}/search-posts?${params}`, {
      method: "GET",
      headers: getHeaders(),
    });

    console.log(`[TIKTOK-RAPIDAPI] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TIKTOK-RAPIDAPI] Error: ${errorText}`);
      return {
        success: false,
        keyword,
        videos: [],
        relatedHashtags: [],
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const videos: TikTokVideo[] = [];
    const hashtagsSet = new Set<string>();

    // ScrapTik returns data in search_item_list[].aweme_info, not aweme_list
    const searchItems = data.search_item_list || [];
    const items = searchItems.length > 0
      ? searchItems.map((si: { aweme_info?: Record<string, unknown> }) => si.aweme_info).filter(Boolean)
      : (data.aweme_list || data.data || []);
    console.log(`[TIKTOK-RAPIDAPI] Found ${items.length} items`);

    for (const item of items.slice(0, limit)) {
      const videoId = item.aweme_id || item.id || "";
      const author = item.author || {};
      const authorId = author.unique_id || "";
      const stats = item.statistics || {};

      // Extract hashtags from text_extra
      const videoHashtags: string[] = [];
      for (const extra of item.text_extra || []) {
        if (extra.hashtag_name) {
          videoHashtags.push(extra.hashtag_name);
          hashtagsSet.add(`#${extra.hashtag_name}`);
        }
      }

      // Get cover image URL
      let coverUrl = "";
      const cover = item.video?.cover || item.video?.origin_cover;
      if (cover?.url_list?.length > 0) {
        coverUrl = cover.url_list[0];
      }

      videos.push({
        id: String(videoId),
        description: item.desc || "",
        author: {
          uniqueId: authorId,
          nickname: author.nickname || "",
          avatarUrl: author.avatar_thumb?.url_list?.[0] || "",
        },
        stats: {
          playCount: stats.play_count || 0,
          likeCount: stats.digg_count || 0,
          commentCount: stats.comment_count || 0,
          shareCount: stats.share_count || 0,
        },
        videoUrl: `https://www.tiktok.com/@${authorId}/video/${videoId}`,
        thumbnailUrl: coverUrl,
        hashtags: videoHashtags,
        createTime: item.create_time,
        musicTitle: item.music?.title || "",
      });
    }

    console.log(`[TIKTOK-RAPIDAPI] Processed ${videos.length} videos, ${hashtagsSet.size} hashtags`);

    return {
      success: true,
      keyword,
      videos,
      relatedHashtags: Array.from(hashtagsSet),
    };
  } catch (error) {
    console.error(`[TIKTOK-RAPIDAPI] Error:`, error);
    return {
      success: false,
      keyword,
      videos: [],
      relatedHashtags: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get videos for a specific hashtag
 * Falls back to search if hashtag endpoint fails
 */
export async function getHashtagVideos(hashtag: string, limit: number = 30): Promise<HashtagResult> {
  // Remove # if present
  const cleanHashtag = hashtag.replace(/^#/, "");
  console.log(`[TIKTOK-RAPIDAPI] Getting hashtag: #${cleanHashtag}`);

  // Use search endpoint with hashtag as keyword (more reliable)
  const searchResult = await searchTikTok(`#${cleanHashtag}`, limit);

  if (searchResult.success && searchResult.videos.length > 0) {
    // Calculate aggregate stats from videos
    const totalViews = searchResult.videos.reduce((sum, v) => sum + v.stats.playCount, 0);

    return {
      success: true,
      hashtag: cleanHashtag,
      info: {
        title: cleanHashtag,
        viewCount: totalViews,
        videoCount: searchResult.videos.length,
        description: `Videos tagged with #${cleanHashtag}`,
      },
      videos: searchResult.videos.map(v => ({
        ...v,
        hashtags: [...new Set([cleanHashtag, ...v.hashtags])],
      })),
    };
  }

  return {
    success: false,
    hashtag: cleanHashtag,
    info: null,
    videos: [],
    error: searchResult.error || "No videos found",
  };
}

/**
 * Get trending/feed videos
 */
export async function getTrendingVideos(region: string = "US", limit: number = 20): Promise<{
  success: boolean;
  videos: TikTokVideo[];
  error?: string;
}> {
  console.log(`[TIKTOK-RAPIDAPI] Getting trending videos for region: ${region}`);

  try {
    const params = new URLSearchParams({
      region,
      count: String(Math.min(limit, 30)),
    });

    const response = await fetch(`${BASE_URL}/feed-list?${params}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      return {
        success: false,
        videos: [],
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const videos: TikTokVideo[] = [];
    const items = data.aweme_list || data.data || [];

    for (const item of items.slice(0, limit)) {
      const videoId = item.aweme_id || "";
      const author = item.author || {};
      const authorId = author.unique_id || "";
      const stats = item.statistics || {};

      // Extract hashtags
      const videoHashtags: string[] = [];
      for (const extra of item.text_extra || []) {
        if (extra.hashtag_name) {
          videoHashtags.push(extra.hashtag_name);
        }
      }

      // Get cover image URL
      let coverUrl = "";
      const cover = item.video?.cover || item.video?.origin_cover;
      if (cover?.url_list?.length > 0) {
        coverUrl = cover.url_list[0];
      }

      videos.push({
        id: String(videoId),
        description: item.desc || "",
        author: {
          uniqueId: authorId,
          nickname: author.nickname || "",
          avatarUrl: author.avatar_thumb?.url_list?.[0] || "",
        },
        stats: {
          playCount: stats.play_count || 0,
          likeCount: stats.digg_count || 0,
          commentCount: stats.comment_count || 0,
          shareCount: stats.share_count || 0,
        },
        videoUrl: `https://www.tiktok.com/@${authorId}/video/${videoId}`,
        thumbnailUrl: coverUrl,
        hashtags: videoHashtags,
        createTime: item.create_time,
        musicTitle: item.music?.title || "",
      });
    }

    console.log(`[TIKTOK-RAPIDAPI] Trending found ${videos.length} videos`);

    return {
      success: true,
      videos,
    };
  } catch (error) {
    console.error(`[TIKTOK-RAPIDAPI] Trending error:`, error);
    return {
      success: false,
      videos: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
