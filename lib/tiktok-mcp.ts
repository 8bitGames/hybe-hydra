/**
 * TikTok API via MCP (RapidAPI tiktok-api23)
 *
 * This module provides a unified interface for TikTok data:
 * - Search: users, hashtags, keywords, videos
 * - Trending: videos, hashtags, songs, keywords
 * - User: info, posts, followers
 *
 * Note: Trending endpoints may require a higher subscription tier.
 * Uses only tiktok-api23.p.rapidapi.com
 */

// =============================================================================
// Types
// =============================================================================

export interface TikTokUser {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  signature?: string;
  verified: boolean;
  followers: number;
  following: number;
  likes: number;
  videos: number;
  region?: string;
}

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
  musicId?: string;
  duration?: number;
}

export interface TikTokHashtag {
  id: string;
  title: string;
  description?: string;
  viewCount: number;
  videoCount: number;
  thumbnailUrl?: string;
  isCommerce?: boolean;
}

export interface TikTokSong {
  id: string;
  title: string;
  author: string;
  album?: string;
  duration: number;
  coverUrl?: string;
  playUrl?: string;
  videoCount: number;
  isOriginal?: boolean;
}

export interface TikTokKeyword {
  keyword: string;
  publishCount: number;
  videoCount: number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
}

export interface TrendingResult<T> {
  success: boolean;
  data: T[];
  country: string;
  period: number;
  error?: string;
}

export interface SearchResult<T> {
  success: boolean;
  data: T[];
  hasMore: boolean;
  cursor: string;
  searchId?: string;
  error?: string;
}

// =============================================================================
// API Configuration
// =============================================================================

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.TIKTOK_RAPIDAPI_KEY || '8414587fdamsh11c982341d0e73fp17038bjsnb1e12cc563da';
const RAPIDAPI_HOST = 'tiktok-api23.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// Check if API is available
let apiChecked = false;
let apiAvailable = false;

async function checkApiAvailability(): Promise<boolean> {
  if (apiChecked) return apiAvailable;

  try {
    const response = await fetch(`${BASE_URL}/api/user/info?uniqueId=tiktok`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json();
    apiAvailable = !data.message?.includes('not subscribed');
    apiChecked = true;

    if (!apiAvailable) {
      console.warn('[TIKTOK-MCP] ⚠️ API not subscribed. Please subscribe at: https://rapidapi.com/tikapi-official-tikapi-official-default/api/tiktok-api23');
    }

    return apiAvailable;
  } catch {
    apiChecked = true;
    apiAvailable = false;
    return false;
  }
}

function getHeaders() {
  return {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };
}

// =============================================================================
// User Search & Info
// =============================================================================

/**
 * Search for TikTok users by keyword
 */
export async function searchUsers(
  keyword: string,
  options: { cursor?: string; searchId?: string } = {}
): Promise<SearchResult<TikTokUser>> {
  const { cursor = '0', searchId = '0' } = options;

  console.log(`[TIKTOK-MCP] Searching users: ${keyword}`);

  try {
    const params = new URLSearchParams({
      keyword,
      cursor,
      search_id: searchId,
    });

    const response = await fetch(`${BASE_URL}/api/search/account?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[TIKTOK-MCP] Search users error: ${error}`);
      return { success: false, data: [], hasMore: false, cursor: '0', error };
    }

    const data = await response.json();
    const users: TikTokUser[] = (data.user_list || []).map((item: Record<string, unknown>) => {
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
      };
    });

    return {
      success: true,
      data: users,
      hasMore: Boolean(data.has_more),
      cursor: String(data.cursor || '0'),
      searchId: data.log_pb?.impr_id,
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Search users error:`, error);
    return {
      success: false,
      data: [],
      hasMore: false,
      cursor: '0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get detailed user info by username
 */
export async function getUserInfo(uniqueId: string): Promise<TikTokUser | null> {
  console.log(`[TIKTOK-MCP] Getting user info: ${uniqueId}`);

  try {
    const params = new URLSearchParams({ uniqueId });
    const response = await fetch(`${BASE_URL}/api/user/info?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error(`[TIKTOK-MCP] Get user info error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const user = data.userInfo?.user || data.user || data;
    const stats = data.userInfo?.stats || data.stats || {};

    return {
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
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Get user info error:`, error);
    return null;
  }
}

/**
 * Get user's posts
 */
export async function getUserPosts(
  secUid: string,
  options: { count?: number; cursor?: string } = {}
): Promise<SearchResult<TikTokVideo>> {
  const { count = 30, cursor = '0' } = options;

  console.log(`[TIKTOK-MCP] Getting user posts: ${secUid}`);

  try {
    const params = new URLSearchParams({
      secUid,
      count: String(count),
      cursor,
    });

    const response = await fetch(`${BASE_URL}/api/user/posts?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      return { success: false, data: [], hasMore: false, cursor: '0' };
    }

    const data = await response.json();
    const videos = parseVideoList(data.itemList || data.aweme_list || []);

    return {
      success: true,
      data: videos,
      hasMore: Boolean(data.hasMore || data.has_more),
      cursor: String(data.cursor || '0'),
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Get user posts error:`, error);
    return {
      success: false,
      data: [],
      hasMore: false,
      cursor: '0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Hashtag Search
// =============================================================================

/**
 * Get hashtag (challenge) info
 */
export async function getHashtagInfo(hashtagName: string): Promise<TikTokHashtag | null> {
  const cleanName = hashtagName.replace(/^#/, '');
  console.log(`[TIKTOK-MCP] Getting hashtag info: #${cleanName}`);

  try {
    const params = new URLSearchParams({ challengeName: cleanName });
    const response = await fetch(`${BASE_URL}/api/challenge/info?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error(`[TIKTOK-MCP] Get hashtag info error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const challenge = data.challengeInfo?.challenge || data.challenge || data;
    const stats = data.challengeInfo?.stats || data.stats || {};

    return {
      id: String(challenge.id || ''),
      title: String(challenge.title || cleanName),
      description: String(challenge.desc || ''),
      viewCount: Number(stats.viewCount || challenge.viewCount || 0),
      videoCount: Number(stats.videoCount || challenge.videoCount || 0),
      thumbnailUrl: String(challenge.coverLarger || challenge.coverMedium || ''),
      isCommerce: Boolean(challenge.isCommerce),
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Get hashtag info error:`, error);
    return null;
  }
}

/**
 * Get videos for a hashtag
 */
export async function getHashtagVideos(
  hashtagId: string,
  options: { count?: number; cursor?: string } = {}
): Promise<SearchResult<TikTokVideo>> {
  const { count = 30, cursor = '0' } = options;

  console.log(`[TIKTOK-MCP] Getting hashtag videos: ${hashtagId}`);

  try {
    const params = new URLSearchParams({
      challengeId: hashtagId,
      count: String(count),
      cursor,
    });

    const response = await fetch(`${BASE_URL}/api/challenge/posts?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      return { success: false, data: [], hasMore: false, cursor: '0' };
    }

    const data = await response.json();
    const videos = parseVideoList(data.itemList || data.aweme_list || []);

    return {
      success: true,
      data: videos,
      hasMore: Boolean(data.hasMore || data.has_more),
      cursor: String(data.cursor || '0'),
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Get hashtag videos error:`, error);
    return {
      success: false,
      data: [],
      hasMore: false,
      cursor: '0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Video Search
// =============================================================================

/**
 * Search for videos by keyword
 */
export async function searchVideos(
  keyword: string,
  options: { cursor?: string; searchId?: string } = {}
): Promise<SearchResult<TikTokVideo>> {
  const { cursor = '0', searchId = '0' } = options;

  console.log(`[TIKTOK-MCP] Searching videos: ${keyword}`);

  try {
    const params = new URLSearchParams({
      keyword,
      cursor,
      search_id: searchId,
    });

    const response = await fetch(`${BASE_URL}/api/search/video?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, data: [], hasMore: false, cursor: '0', error };
    }

    const data = await response.json();
    const items = data.item_list || data.data || [];
    const videos = parseVideoList(items);

    return {
      success: true,
      data: videos,
      hasMore: Boolean(data.has_more),
      cursor: String(data.cursor || '0'),
      searchId: data.log_pb?.impr_id,
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Search videos error:`, error);
    return {
      success: false,
      data: [],
      hasMore: false,
      cursor: '0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * General search (Top results - mixed content)
 */
export async function searchGeneral(
  keyword: string,
  options: { cursor?: string; searchId?: string } = {}
): Promise<{
  success: boolean;
  videos: TikTokVideo[];
  users: TikTokUser[];
  hashtags: TikTokHashtag[];
  hasMore: boolean;
  cursor: string;
  error?: string;
}> {
  const { cursor = '0', searchId = '0' } = options;

  console.log(`[TIKTOK-MCP] General search: ${keyword}`);

  try {
    const params = new URLSearchParams({
      keyword,
      cursor,
      search_id: searchId,
    });

    const response = await fetch(`${BASE_URL}/api/search/general?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, videos: [], users: [], hashtags: [], hasMore: false, cursor: '0', error };
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return { success: false, videos: [], users: [], hashtags: [], hasMore: false, cursor: '0', error: 'Empty response from API' };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, videos: [], users: [], hashtags: [], hasMore: false, cursor: '0', error: 'Invalid JSON response' };
    }
    const videos: TikTokVideo[] = [];
    const users: TikTokUser[] = [];
    const hashtags: TikTokHashtag[] = [];

    // Parse mixed results
    for (const item of data.data || []) {
      if (item.type === 1 && item.item) {
        // Video
        const parsed = parseVideoItem(item.item);
        if (parsed) videos.push(parsed);
      } else if (item.type === 4 && item.user_list) {
        // Users
        for (const u of item.user_list) {
          const user = u.user_info || u;
          users.push({
            id: String(user.uid || ''),
            uniqueId: String(user.unique_id || ''),
            nickname: String(user.nickname || ''),
            avatarUrl: String(user.avatar_thumb?.url_list?.[0] || ''),
            signature: String(user.signature || ''),
            verified: Boolean(user.custom_verify),
            followers: Number(user.follower_count || 0),
            following: Number(user.following_count || 0),
            likes: Number(user.total_favorited || 0),
            videos: Number(user.aweme_count || 0),
          });
        }
      } else if (item.type === 2 && item.challenge_info_list) {
        // Hashtags
        for (const c of item.challenge_info_list) {
          const challenge = c.challenge_info || c;
          hashtags.push({
            id: String(challenge.cid || challenge.id || ''),
            title: String(challenge.cha_name || challenge.title || ''),
            description: String(challenge.desc || ''),
            viewCount: Number(challenge.view_count || 0),
            videoCount: Number(challenge.use_count || 0),
            thumbnailUrl: String(challenge.cover?.url_list?.[0] || ''),
          });
        }
      }
    }

    return {
      success: true,
      videos,
      users,
      hashtags,
      hasMore: Boolean(data.has_more),
      cursor: String(data.cursor || '0'),
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] General search error:`, error);
    return {
      success: false,
      videos: [],
      users: [],
      hashtags: [],
      hasMore: false,
      cursor: '0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Trending Content
// =============================================================================

/**
 * Get trending videos
 */
export async function getTrendingVideos(options: {
  country?: string;
  limit?: number;
  page?: number;
  period?: 7 | 30;
  orderBy?: 'vv' | 'like' | 'comment' | 'repost';
} = {}): Promise<TrendingResult<TikTokVideo>> {
  const {
    country = 'US',
    limit = 20,
    page = 1,
    period = 7,
    orderBy = 'vv',
  } = options;

  console.log(`[TIKTOK-MCP] Getting trending videos: ${country}, period=${period}`);

  try {
    const params = new URLSearchParams({
      country,
      limit: String(limit),
      page: String(page),
      period: String(period),
      order_by: orderBy,
    });

    const response = await fetch(`${BASE_URL}/api/trending/video?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await response.json();

    // Check if endpoint is disabled for subscription
    if (data.message?.includes('endpoint is disabled') || data.message?.includes('subscription')) {
      console.log(`[TIKTOK-MCP] Trending videos endpoint disabled for subscription`);
      return {
        success: false,
        data: [],
        country,
        period,
        error: 'Trending videos requires Pro subscription.',
      };
    }

    if (!response.ok) {
      const error = JSON.stringify(data);
      return { success: false, data: [], country, period, error };
    }

    const videos = parseVideoList(data.data || data.videos || []);

    return {
      success: true,
      data: videos,
      country,
      period,
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Get trending videos error:`, error);
    return {
      success: false,
      data: [],
      country,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get trending hashtags
 * Note: Requires higher subscription tier
 */
export async function getTrendingHashtags(options: {
  country?: string;
  limit?: number;
  page?: number;
  period?: 7 | 30 | 120;
  sortBy?: 'popular' | 'surging';
} = {}): Promise<TrendingResult<TikTokHashtag>> {
  const {
    country = 'US',
    limit = 20,
    page = 1,
    period = 7,
    sortBy = 'popular',
  } = options;

  console.log(`[TIKTOK-MCP] Getting trending hashtags: ${country}, period=${period}`);

  try {
    const params = new URLSearchParams({
      country,
      limit: String(limit),
      page: String(page),
      period: String(period),
      sort_by: sortBy,
    });

    const response = await fetch(`${BASE_URL}/api/trending/hashtag?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await response.json();

    // Check if endpoint is disabled for subscription
    if (data.message?.includes('endpoint is disabled') || data.message?.includes('subscription')) {
      console.log(`[TIKTOK-MCP] Trending hashtags endpoint disabled for subscription`);
      return {
        success: false,
        data: [],
        country,
        period,
        error: 'Trending hashtags requires Pro subscription. Use search instead.',
      };
    }

    if (!response.ok) {
      const error = JSON.stringify(data);
      return { success: false, data: [], country, period, error };
    }

    const hashtags: TikTokHashtag[] = (data.data || data.hashtags || []).map(
      (item: Record<string, unknown>) => ({
        id: String(item.hashtag_id || item.id || ''),
        title: String(item.hashtag_name || item.title || ''),
        description: String(item.desc || ''),
        viewCount: Number(item.publish_cnt || item.viewCount || 0),
        videoCount: Number(item.video_cnt || item.videoCount || 0),
        thumbnailUrl: String(item.cover || ''),
      })
    );

    return {
      success: true,
      data: hashtags,
      country,
      period,
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Get trending hashtags error:`, error);
    return {
      success: false,
      data: [],
      country,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get trending songs
 * Note: Requires higher subscription tier
 */
export async function getTrendingSongs(options: {
  country?: string;
  limit?: number;
  page?: number;
  period?: 7 | 30 | 120;
  rankType?: 'popular' | 'surging';
  commercialMusic?: boolean;
} = {}): Promise<TrendingResult<TikTokSong>> {
  const {
    country = 'US',
    limit = 20,
    page = 1,
    period = 7,
    rankType = 'popular',
    commercialMusic,
  } = options;

  console.log(`[TIKTOK-MCP] Getting trending songs: ${country}, period=${period}`);

  try {
    const params = new URLSearchParams({
      country,
      limit: String(limit),
      page: String(page),
      period: String(period),
      rank_type: rankType,
    });

    if (commercialMusic !== undefined) {
      params.set('commercial_music', String(commercialMusic));
    }

    const response = await fetch(`${BASE_URL}/api/trending/song?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await response.json();

    // Check if endpoint is disabled for subscription
    if (data.message?.includes('endpoint is disabled') || data.message?.includes('subscription')) {
      console.log(`[TIKTOK-MCP] Trending songs endpoint disabled for subscription`);
      return {
        success: false,
        data: [],
        country,
        period,
        error: 'Trending songs requires Pro subscription.',
      };
    }

    if (!response.ok) {
      const error = JSON.stringify(data);
      return { success: false, data: [], country, period, error };
    }

    const songs: TikTokSong[] = (data.data || data.songs || []).map(
      (item: Record<string, unknown>) => ({
        id: String(item.clip_id || item.id || ''),
        title: String(item.title || ''),
        author: String(item.author || item.artist || ''),
        album: String(item.album || ''),
        duration: Number(item.duration || 0),
        coverUrl: String(item.cover_large || item.cover || ''),
        playUrl: String(item.play_url || ''),
        videoCount: Number(item.use_count || item.videoCount || 0),
        isOriginal: Boolean(item.is_original),
      })
    );

    return {
      success: true,
      data: songs,
      country,
      period,
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Get trending songs error:`, error);
    return {
      success: false,
      data: [],
      country,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get trending keywords
 * Note: Requires higher subscription tier
 */
export async function getTrendingKeywords(options: {
  country?: string;
  limit?: number;
  page?: number;
  period?: 7 | 30 | 120;
} = {}): Promise<TrendingResult<TikTokKeyword>> {
  const {
    country = 'US',
    limit = 20,
    page = 1,
    period = 7,
  } = options;

  console.log(`[TIKTOK-MCP] Getting trending keywords: ${country}, period=${period}`);

  try {
    const params = new URLSearchParams({
      country,
      limit: String(limit),
      page: String(page),
      period: String(period),
    });

    const response = await fetch(`${BASE_URL}/api/trending/keyword?${params}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await response.json();

    // Check if endpoint is disabled for subscription
    if (data.message?.includes('endpoint is disabled') || data.message?.includes('subscription')) {
      console.log(`[TIKTOK-MCP] Trending keywords endpoint disabled for subscription`);
      return {
        success: false,
        data: [],
        country,
        period,
        error: 'Trending keywords requires Pro subscription.',
      };
    }

    if (!response.ok) {
      const error = JSON.stringify(data);
      return { success: false, data: [], country, period, error };
    }

    const keywords: TikTokKeyword[] = (data.data || data.keywords || []).map(
      (item: Record<string, unknown>) => ({
        keyword: String(item.keyword || item.title || ''),
        publishCount: Number(item.publish_cnt || 0),
        videoCount: Number(item.video_cnt || 0),
        trend: item.trend_type === 1 ? 'up' : item.trend_type === 2 ? 'down' : 'stable',
        trendValue: Number(item.trend_value || 0),
      })
    );

    return {
      success: true,
      data: keywords,
      country,
      period,
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] Get trending keywords error:`, error);
    return {
      success: false,
      data: [],
      country,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function parseVideoItem(item: Record<string, unknown>): TikTokVideo | null {
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

  return {
    id: videoId,
    description: String(item.desc || ''),
    author: {
      uniqueId: authorId,
      nickname: String(author.nickname || ''),
      avatarUrl,
    },
    stats: {
      playCount: Number(stats.play_count || stats.playCount || 0),
      likeCount: Number(stats.digg_count || stats.diggCount || stats.likeCount || 0),
      commentCount: Number(stats.comment_count || stats.commentCount || 0),
      shareCount: Number(stats.share_count || stats.shareCount || 0),
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
  };
}

function parseVideoList(items: Array<Record<string, unknown>>): TikTokVideo[] {
  const videos: TikTokVideo[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const video = parseVideoItem(item);
    if (video && !seenIds.has(video.id)) {
      seenIds.add(video.id);
      videos.push(video);
    }
  }

  return videos;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Search TikTok by hashtag name (convenience wrapper)
 */
export async function searchByHashtag(
  hashtag: string,
  limit = 30
): Promise<{ success: boolean; info: TikTokHashtag | null; videos: TikTokVideo[]; error?: string }> {
  const cleanHashtag = hashtag.replace(/^#/, '');

  // Get hashtag info
  const info = await getHashtagInfo(cleanHashtag);

  if (!info) {
    // Fallback to video search with hashtag as keyword
    const searchResult = await searchVideos(`#${cleanHashtag}`);
    return {
      success: searchResult.success,
      info: null,
      videos: searchResult.data.slice(0, limit),
      error: searchResult.error,
    };
  }

  // Get videos for the hashtag
  const videosResult = await getHashtagVideos(info.id, { count: limit });

  return {
    success: true,
    info,
    videos: videosResult.data,
  };
}

/**
 * Search TikTok for videos (wrapper for backward compatibility)
 * Fetches multiple pages if needed to get at least the requested limit
 */
export async function searchTikTok(keyword: string, limit: number = 30): Promise<{
  success: boolean;
  keyword: string;
  videos: TikTokVideo[];
  relatedHashtags: string[];
  error?: string;
}> {
  console.log(`[TIKTOK-MCP] searchTikTok: ${keyword}, limit: ${limit}`);

  const videos: TikTokVideo[] = [];
  const hashtagsSet = new Set<string>();
  const seenIds = new Set<string>();
  let cursor = '0';
  let searchId = '0';
  const maxPages = Math.ceil(limit / 12); // API returns ~12 per page

  try {
    for (let page = 0; page < maxPages && videos.length < limit; page++) {
      const result = await searchVideos(keyword, { cursor, searchId });

      if (!result.success) {
        if (videos.length > 0) break; // Return what we have
        return {
          success: false,
          keyword,
          videos: [],
          relatedHashtags: [],
          error: result.error,
        };
      }

      // Add unique videos
      for (const video of result.data) {
        if (!seenIds.has(video.id) && videos.length < limit) {
          seenIds.add(video.id);
          videos.push(video);
          // Collect hashtags
          for (const tag of video.hashtags) {
            hashtagsSet.add(`#${tag}`);
          }
        }
      }

      // Update pagination
      cursor = result.cursor;
      searchId = result.searchId || '0';

      // No more results
      if (!result.hasMore || result.data.length === 0) break;
    }

    console.log(`[TIKTOK-MCP] searchTikTok found ${videos.length} videos, ${hashtagsSet.size} hashtags`);

    return {
      success: videos.length > 0,
      keyword,
      videos,
      relatedHashtags: Array.from(hashtagsSet),
    };
  } catch (error) {
    console.error(`[TIKTOK-MCP] searchTikTok error:`, error);
    return {
      success: videos.length > 0,
      keyword,
      videos,
      relatedHashtags: Array.from(hashtagsSet),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all trending content at once
 */
export async function getAllTrending(options: {
  country?: string;
  limit?: number;
  period?: 7 | 30;
} = {}): Promise<{
  success: boolean;
  videos: TikTokVideo[];
  hashtags: TikTokHashtag[];
  songs: TikTokSong[];
  keywords: TikTokKeyword[];
  errors: string[];
}> {
  const { country = 'US', limit = 20, period = 7 } = options;
  const errors: string[] = [];

  console.log(`[TIKTOK-MCP] Getting all trending content: ${country}, period=${period}`);

  // Fetch all trending data in parallel
  const [videosResult, hashtagsResult, songsResult, keywordsResult] = await Promise.all([
    getTrendingVideos({ country, limit, period }),
    getTrendingHashtags({ country, limit, period }),
    getTrendingSongs({ country, limit, period }),
    getTrendingKeywords({ country, limit, period }),
  ]);

  if (videosResult.error) errors.push(`Videos: ${videosResult.error}`);
  if (hashtagsResult.error) errors.push(`Hashtags: ${hashtagsResult.error}`);
  if (songsResult.error) errors.push(`Songs: ${songsResult.error}`);
  if (keywordsResult.error) errors.push(`Keywords: ${keywordsResult.error}`);

  const success = videosResult.success || hashtagsResult.success ||
                  songsResult.success || keywordsResult.success;

  return {
    success,
    videos: videosResult.data,
    hashtags: hashtagsResult.data,
    songs: songsResult.data,
    keywords: keywordsResult.data,
    errors,
  };
}
