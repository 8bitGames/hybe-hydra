/**
 * TikTok Deep Analysis Service
 *
 * Extended TikTok API functionality for comprehensive account analysis.
 * Fetches 50-100 videos per account for detailed metrics and classification.
 */

import {
  getUserInfo,
  getUserPosts,
  searchUsers,
  type TikTokUser,
  type TikTokVideo,
  type SearchResult,
} from '@/lib/tiktok-mcp';

// =============================================================================
// Types
// =============================================================================

export interface DeepAnalysisUser extends TikTokUser {
  secUid: string;
}

export interface DeepAnalysisVideo extends TikTokVideo {
  engagementRate: number;
  isOwnMusic: boolean;
}

export interface AccountFetchResult {
  success: boolean;
  user: DeepAnalysisUser | null;
  videos: DeepAnalysisVideo[];
  totalFetched: number;
  error?: string;
}

export interface AccountSearchResult {
  success: boolean;
  users: DeepAnalysisUser[];
  hasMore: boolean;
  cursor: string;
  error?: string;
}

// =============================================================================
// API Configuration
// =============================================================================

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.TIKTOK_RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

function getHeaders() {
  return {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };
}

// =============================================================================
// Cache System - Avoid repeated API calls during debugging
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache
const userInfoCache = new Map<string, CacheEntry<DeepAnalysisUser>>();
const videosCache = new Map<string, CacheEntry<DeepAnalysisVideo[]>>();

function getCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  // Check if cache is still valid
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  console.log(`[DEEP-ANALYSIS] Cache hit for: ${key}`);
  return entry.data;
}

function setCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`[DEEP-ANALYSIS] Cached data for: ${key}`);
}

export function clearCache(): void {
  userInfoCache.clear();
  videosCache.clear();
  console.log('[DEEP-ANALYSIS] Cache cleared');
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get user info with secUid for fetching posts
 * Results are cached for 30 minutes to avoid repeated API calls
 */
export async function getDeepAnalysisUserInfo(uniqueId: string): Promise<DeepAnalysisUser | null> {
  console.log(`[DEEP-ANALYSIS] Getting user info: ${uniqueId}`);

  // Check cache first
  const cached = getCachedData(userInfoCache, uniqueId);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ uniqueId });
    const response = await fetch(`${BASE_URL}/api/user/info?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error(`[DEEP-ANALYSIS] Get user info error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const user = data.userInfo?.user || data.user || data;
    const stats = data.userInfo?.stats || data.stats || {};

    const result: DeepAnalysisUser = {
      id: String(user.id || ''),
      uniqueId: String(user.uniqueId || uniqueId),
      nickname: String(user.nickname || ''),
      avatarUrl: String(user.avatarLarger || user.avatarMedium || ''),
      signature: String(user.signature || ''),
      verified: Boolean(user.verified),
      followers: Number(stats.followerCount || 0),
      following: Number(stats.followingCount || 0),
      likes: Number(stats.heart || stats.heartCount || 0),
      videos: Number(stats.videoCount || 0),
      region: String(user.region || ''),
      secUid: String(user.secUid || ''),
    };

    // Cache the result
    setCachedData(userInfoCache, uniqueId, result);
    return result;
  } catch (error) {
    console.error(`[DEEP-ANALYSIS] Get user info error:`, error);
    return null;
  }
}

/**
 * Fetch all videos for an account (up to targetCount)
 * Uses pagination to fetch 50-100 videos
 * Results are cached for 30 minutes to avoid repeated API calls
 */
export async function fetchAccountVideos(
  secUid: string,
  targetCount: number = 100,
  onProgress?: (fetched: number, total: number) => void
): Promise<{ videos: DeepAnalysisVideo[]; error?: string }> {
  console.log(`[DEEP-ANALYSIS] Fetching videos for secUid: ${secUid}, target: ${targetCount}`);

  // Check cache first
  const cacheKey = `${secUid}_${targetCount}`;
  const cached = getCachedData(videosCache, cacheKey);
  if (cached) {
    if (onProgress) onProgress(cached.length, targetCount);
    return { videos: cached };
  }

  const videos: DeepAnalysisVideo[] = [];
  const seenIds = new Set<string>();
  let cursor = '0';
  let hasMore = true;
  const maxIterations = Math.ceil(targetCount / 30) + 2; // Safety limit
  let iteration = 0;

  try {
    while (hasMore && videos.length < targetCount && iteration < maxIterations) {
      iteration++;

      const params = new URLSearchParams({
        secUid,
        count: '30',
        cursor,
      });

      const response = await fetch(`${BASE_URL}/api/user/posts?${params}`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEEP-ANALYSIS] Fetch videos error: ${response.status}`, errorText);
        break;
      }

      const rawData = await response.json();
      // Handle nested data structure - API returns { data: { ... } }
      const data = rawData.data || rawData;
      console.log(`[DEEP-ANALYSIS] API response keys:`, Object.keys(rawData), 'inner keys:', Object.keys(data));
      console.log(`[DEEP-ANALYSIS] hasMore:`, data.hasMore, 'cursor:', data.cursor, 'statusCode:', data.statusCode);
      const items = data.itemList || data.aweme_list || data.videos || [];
      console.log(`[DEEP-ANALYSIS] Items in response: ${items.length}`);

      for (const item of items) {
        const video = parseVideoItem(item);
        if (video && !seenIds.has(video.id)) {
          seenIds.add(video.id);
          videos.push(video);
        }
      }

      // Report progress
      if (onProgress) {
        onProgress(videos.length, targetCount);
      }

      // Update pagination (check both nested and flat structure)
      hasMore = Boolean(data.hasMore ?? data.has_more ?? rawData.hasMore ?? false);
      cursor = String(data.cursor || rawData.cursor || '0');

      // Rate limiting - small delay between requests
      if (hasMore && videos.length < targetCount) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[DEEP-ANALYSIS] Fetched ${videos.length} videos`);

    // Cache the results if we got any videos
    if (videos.length > 0) {
      setCachedData(videosCache, cacheKey, videos);
    }

    return { videos };
  } catch (error) {
    console.error(`[DEEP-ANALYSIS] Fetch videos error:`, error);
    return {
      videos,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Search for users with secUid included
 */
export async function searchDeepAnalysisUsers(
  keyword: string,
  options: { cursor?: string; limit?: number } = {}
): Promise<AccountSearchResult> {
  const { cursor = '0', limit = 20 } = options;

  console.log(`[DEEP-ANALYSIS] Searching users: ${keyword}`);

  try {
    const params = new URLSearchParams({
      keyword,
      cursor,
      search_id: '0',
    });

    const response = await fetch(`${BASE_URL}/api/search/account?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[DEEP-ANALYSIS] Search users error: ${error}`);
      return { success: false, users: [], hasMore: false, cursor: '0', error };
    }

    const data = await response.json();
    const users: DeepAnalysisUser[] = (data.user_list || [])
      .slice(0, limit)
      .map((item: Record<string, unknown>) => {
        const user = item.user_info as Record<string, unknown> || item;
        const avatarThumb = user.avatar_thumb as Record<string, unknown> | undefined;
        const avatarUrlList = avatarThumb?.url_list as string[] | undefined;

        return {
          id: String(user.uid || user.id || ''),
          uniqueId: String(user.unique_id || user.uniqueId || ''),
          nickname: String(user.nickname || ''),
          avatarUrl: String(avatarUrlList?.[0] || user.avatarThumb || ''),
          signature: String(user.signature || ''),
          verified: Boolean(user.custom_verify || user.verified),
          followers: Number(user.follower_count || user.followerCount || 0),
          following: Number(user.following_count || user.followingCount || 0),
          likes: Number(user.total_favorited || user.heart || 0),
          videos: Number(user.aweme_count || user.videoCount || 0),
          secUid: String(user.sec_uid || user.secUid || ''),
        };
      });

    return {
      success: true,
      users,
      hasMore: Boolean(data.has_more),
      cursor: String(data.cursor || '0'),
    };
  } catch (error) {
    console.error(`[DEEP-ANALYSIS] Search users error:`, error);
    return {
      success: false,
      users: [],
      hasMore: false,
      cursor: '0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch complete account data for deep analysis
 */
export async function fetchAccountForAnalysis(
  uniqueId: string,
  videoCount: number = 100,
  onProgress?: (stage: string, progress: number) => void
): Promise<AccountFetchResult> {
  console.log(`[DEEP-ANALYSIS] Fetching account for analysis: ${uniqueId}`);

  // Stage 1: Get user info
  if (onProgress) onProgress('user_info', 0);

  const user = await getDeepAnalysisUserInfo(uniqueId);
  if (!user) {
    return {
      success: false,
      user: null,
      videos: [],
      totalFetched: 0,
      error: 'User not found',
    };
  }

  console.log(`[DEEP-ANALYSIS] User info:`, {
    id: user.id,
    uniqueId: user.uniqueId,
    secUid: user.secUid,
    videos: user.videos,
    followers: user.followers,
  });

  if (!user.secUid) {
    return {
      success: false,
      user,
      videos: [],
      totalFetched: 0,
      error: 'User secUid not available',
    };
  }

  if (onProgress) onProgress('user_info', 100);

  // Stage 2: Fetch videos
  if (onProgress) onProgress('videos', 0);

  const { videos, error } = await fetchAccountVideos(
    user.secUid,
    videoCount,
    (fetched, total) => {
      if (onProgress) {
        onProgress('videos', Math.round((fetched / total) * 100));
      }
    }
  );

  if (onProgress) onProgress('videos', 100);

  return {
    success: videos.length > 0,
    user,
    videos,
    totalFetched: videos.length,
    error,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function parseVideoItem(item: Record<string, unknown>): DeepAnalysisVideo | null {
  if (!item) return null;

  const author = (item.author || {}) as Record<string, unknown>;
  const stats = (item.statistics || item.stats || {}) as Record<string, number>;
  const video = (item.video || {}) as Record<string, unknown>;
  const music = (item.music || {}) as Record<string, unknown>;

  const videoId = String(item.aweme_id || item.id || '');
  const authorId = String(author.unique_id || author.uniqueId || '');

  if (!videoId) return null;

  // Extract hashtags
  const hashtags: string[] = [];
  const textExtra = item.text_extra as Array<{ hashtag_name?: string }> | undefined;
  if (textExtra) {
    for (const extra of textExtra) {
      if (extra.hashtag_name) {
        hashtags.push(extra.hashtag_name);
      }
    }
  }
  const challenges = item.challenges as Array<{ title?: string }> | undefined;
  if (challenges) {
    for (const c of challenges) {
      if (c.title && !hashtags.includes(c.title)) {
        hashtags.push(c.title);
      }
    }
  }

  // Get cover URL
  const cover = video.cover || video.origin_cover;
  const coverUrlList = (cover as Record<string, unknown>)?.url_list as string[] | undefined;
  const coverUrl = coverUrlList?.[0] || String(video.cover || '');

  // Get avatar URL
  const avatarThumb = author.avatar_thumb as Record<string, unknown> | undefined;
  const avatarUrlList = avatarThumb?.url_list as string[] | undefined;
  const avatarUrl = avatarUrlList?.[0] || String(author.avatarThumb || author.avatarMedium || '');

  // Calculate stats
  const playCount = Number(stats.play_count || stats.playCount || 0);
  const likeCount = Number(stats.digg_count || stats.diggCount || stats.likeCount || 0);
  const commentCount = Number(stats.comment_count || stats.commentCount || 0);
  const shareCount = Number(stats.share_count || stats.shareCount || 0);

  // Calculate engagement rate
  const engagementRate = playCount > 0
    ? ((likeCount + commentCount + shareCount) / playCount) * 100
    : 0;

  // Check if own music
  const musicAuthor = String(music.author || music.authorName || '');
  const isOwnMusic = authorId
    ? musicAuthor.toLowerCase().includes(authorId.toLowerCase()) ||
      String(author.nickname || '').toLowerCase().includes(musicAuthor.toLowerCase())
    : false;

  return {
    id: videoId,
    description: String(item.desc || ''),
    author: {
      uniqueId: authorId,
      nickname: String(author.nickname || ''),
      avatarUrl,
    },
    stats: {
      playCount,
      likeCount,
      commentCount,
      shareCount,
    },
    videoUrl: authorId
      ? `https://www.tiktok.com/@${authorId}/video/${videoId}`
      : `https://www.tiktok.com/video/${videoId}`,
    thumbnailUrl: coverUrl,
    hashtags,
    createTime: Number(item.create_time || item.createTime || 0),
    musicTitle: String(music.title || ''),
    musicId: String(music.id || music.mid || ''),
    duration: Number(video.duration || item.duration || 0),
    engagementRate,
    isOwnMusic,
  };
}

// =============================================================================
// Metrics Calculation
// =============================================================================

export interface AccountMetrics {
  // Basic metrics
  totalVideos: number;
  analyzedVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;

  // Engagement metrics
  avgEngagementRate: number;
  medianEngagementRate: number;
  engagementRateStdDev: number;
  topPerformingRate: number; // Top 10% engagement rate
  bottomPerformingRate: number; // Bottom 10% engagement rate

  // Performance metrics
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;

  // Content metrics
  avgDuration: number;
  avgHashtagCount: number;
  ownMusicPercentage: number;

  // Posting metrics
  postsPerWeek: number;
  mostActiveDay?: string;
  mostActiveHour?: number;
}

export function calculateAccountMetrics(videos: DeepAnalysisVideo[]): AccountMetrics {
  if (videos.length === 0) {
    return {
      totalVideos: 0,
      analyzedVideos: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      avgEngagementRate: 0,
      medianEngagementRate: 0,
      engagementRateStdDev: 0,
      topPerformingRate: 0,
      bottomPerformingRate: 0,
      avgViews: 0,
      avgLikes: 0,
      avgComments: 0,
      avgShares: 0,
      avgDuration: 0,
      avgHashtagCount: 0,
      ownMusicPercentage: 0,
      postsPerWeek: 0,
    };
  }

  // Basic totals
  const totalViews = videos.reduce((sum, v) => sum + v.stats.playCount, 0);
  const totalLikes = videos.reduce((sum, v) => sum + v.stats.likeCount, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.stats.commentCount, 0);
  const totalShares = videos.reduce((sum, v) => sum + v.stats.shareCount, 0);

  // Engagement rates
  const engagementRates = videos.map(v => v.engagementRate).sort((a, b) => a - b);
  const avgEngagementRate = engagementRates.reduce((a, b) => a + b, 0) / videos.length;
  const medianEngagementRate = engagementRates[Math.floor(videos.length / 2)];

  // Standard deviation
  const variance = engagementRates.reduce((sum, rate) =>
    sum + Math.pow(rate - avgEngagementRate, 2), 0) / videos.length;
  const engagementRateStdDev = Math.sqrt(variance);

  // Top/Bottom percentiles
  const top10Index = Math.floor(videos.length * 0.9);
  const bottom10Index = Math.floor(videos.length * 0.1);
  const topPerformingRate = engagementRates[top10Index] || avgEngagementRate;
  const bottomPerformingRate = engagementRates[bottom10Index] || avgEngagementRate;

  // Duration and hashtags
  const totalDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0);
  const totalHashtags = videos.reduce((sum, v) => sum + v.hashtags.length, 0);

  // Own music percentage
  const ownMusicCount = videos.filter(v => v.isOwnMusic).length;
  const ownMusicPercentage = (ownMusicCount / videos.length) * 100;

  // Posting frequency
  const timestamps = videos
    .map(v => v.createTime)
    .filter((t): t is number => t !== undefined && t > 0)
    .sort((a, b) => a - b);

  let postsPerWeek = 0;
  let mostActiveDay: string | undefined;
  let mostActiveHour: number | undefined;

  if (timestamps.length > 1) {
    const firstPost = timestamps[0]!;
    const lastPost = timestamps[timestamps.length - 1]!;
    const weeksDiff = (lastPost - firstPost) / (7 * 24 * 60 * 60);
    postsPerWeek = weeksDiff > 0 ? timestamps.length / weeksDiff : 0;

    // Calculate most active day and hour
    const dayCount: Record<string, number> = {};
    const hourCount: Record<number, number> = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const ts of timestamps) {
      const date = new Date(ts * 1000);
      const day = days[date.getDay()];
      const hour = date.getHours();

      dayCount[day] = (dayCount[day] || 0) + 1;
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    }

    mostActiveDay = Object.entries(dayCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0];
    mostActiveHour = Number(Object.entries(hourCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0]);
  }

  return {
    totalVideos: videos.length,
    analyzedVideos: videos.length,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    avgEngagementRate,
    medianEngagementRate,
    engagementRateStdDev,
    topPerformingRate,
    bottomPerformingRate,
    avgViews: totalViews / videos.length,
    avgLikes: totalLikes / videos.length,
    avgComments: totalComments / videos.length,
    avgShares: totalShares / videos.length,
    avgDuration: totalDuration / videos.length,
    avgHashtagCount: totalHashtags / videos.length,
    ownMusicPercentage,
    postsPerWeek,
    mostActiveDay,
    mostActiveHour,
  };
}

// =============================================================================
// Industry Benchmarks
// =============================================================================

export const TIKTOK_BENCHMARKS = {
  // Source: Various industry reports 2024
  avgEngagementRate: 5.96, // Average TikTok engagement rate
  goodEngagementRate: 8.0,
  excellentEngagementRate: 15.0,

  // Follower-based benchmarks
  micro: { // < 10K followers
    avgEngagementRate: 8.5,
    avgViews: 1000,
  },
  small: { // 10K - 100K followers
    avgEngagementRate: 6.5,
    avgViews: 5000,
  },
  medium: { // 100K - 1M followers
    avgEngagementRate: 5.0,
    avgViews: 20000,
  },
  large: { // 1M+ followers
    avgEngagementRate: 4.0,
    avgViews: 100000,
  },

  // Artist-specific (estimated)
  musicArtist: {
    avgEngagementRate: 4.5,
    avgViews: 50000,
    ownMusicPercentage: 30,
  },
};

export function getFollowerTier(followers: number): 'micro' | 'small' | 'medium' | 'large' {
  if (followers < 10000) return 'micro';
  if (followers < 100000) return 'small';
  if (followers < 1000000) return 'medium';
  return 'large';
}

export function getBenchmarkForFollowers(followers: number) {
  return TIKTOK_BENCHMARKS[getFollowerTier(followers)];
}
