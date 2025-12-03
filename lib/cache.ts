/**
 * Upstash Redis Cache Configuration
 * Upstash Redis 캐시 설정
 *
 * Provides caching utilities for reducing database load on frequently accessed data.
 * Uses Upstash Redis for serverless-friendly caching.
 */

import { Redis } from "@upstash/redis";

// Initialize Redis client (falls back to no-op if not configured)
// Supports both KV_REST_API_* (Vercel KV) and UPSTASH_REDIS_REST_* naming conventions
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

/**
 * Cache key prefixes for different data types
 */
export const CacheKeys = {
  // Dashboard stats - per user, short TTL
  dashboardStats: (userId: string) => `dashboard:stats:${userId}`,

  // Campaign list - per label and page
  campaignsList: (labelId: string, page: number, status?: string) =>
    `campaigns:list:${labelId}:${page}:${status || 'all'}`,

  // Single campaign detail
  campaignDetail: (id: string) => `campaigns:detail:${id}`,

  // Campaign dashboard (expensive aggregation) - per campaign
  campaignDashboard: (campaignId: string) => `campaigns:dashboard:${campaignId}`,

  // Trends by platform
  trendsPlatform: (platform: string, region: string) =>
    `trends:platform:${platform}:${region}`,

  // Trend analysis (expensive operations)
  trendAnalysis: (hash: string) => `trends:analysis:${hash}`,

  // User profile - per user ID
  userProfile: (userId: string) => `users:profile:${userId}`,

  // Artists list - per user role (admin sees all, others see by label)
  artistsList: (isAdmin: boolean, labelIds?: string[]) =>
    isAdmin ? `artists:list:admin` : `artists:list:${labelIds?.sort().join(',') || 'none'}`,

  // Labels list (rarely changes)
  labelsList: () => `labels:list`,

  // Style presets (static) - by category and active filter
  stylePresets: (category?: string, activeOnly?: boolean) =>
    `presets:styles:${category || 'all'}:${activeOnly ? 'active' : 'all'}`,

  // Generation status (for polling)
  generationStatus: (id: string) => `generation:status:${id}`,

  // Publishing accounts per label
  publishingAccounts: (labelId: string) => `publishing:accounts:${labelId}`,

  // Merchandise list - with filters
  merchandiseList: (hash: string) => `merchandise:list:${hash}`,
} as const;

/**
 * Cache TTL values in seconds
 */
export const CacheTTL = {
  SHORT: 30,           // 30 seconds - for lists that update frequently
  MEDIUM: 60,          // 1 minute - for dashboard stats
  LONG: 120,           // 2 minutes - for detail pages
  USER_PROFILE: 90,    // 90 seconds - for user profile (called on every page)
  CAMPAIGN_DASH: 150,  // 2.5 minutes - for campaign dashboard (expensive query)
  MEDIUM_STATIC: 300,  // 5 minutes - for merchandise, publishing accounts
  TRENDS: 15 * 60,     // 15 minutes - for trend data
  STATIC: 60 * 60,     // 1 hour - for rarely changing data (artists, labels, presets)
  ANALYSIS: 24 * 60 * 60,  // 24 hours - for expensive analysis results
} as const;

/**
 * Get cached value or fetch and cache
 * 캐시된 값을 가져오거나 새로 가져와서 캐시
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // If Redis not configured, just fetch
  if (!redis) {
    return fetcher();
  }

  try {
    // Try to get from cache
    const cachedValue = await redis.get<T>(key);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // Fetch fresh data
    const freshValue = await fetcher();

    // Store in cache (don't await, fire and forget)
    redis.setex(key, ttlSeconds, freshValue).catch((err) => {
      console.error(`[Cache] Failed to set key ${key}:`, err);
    });

    return freshValue;
  } catch (error) {
    console.error(`[Cache] Error for key ${key}:`, error);
    // Fallback to direct fetch on cache error
    return fetcher();
  }
}

/**
 * Get value from cache
 * 캐시에서 값 가져오기
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    return await redis.get<T>(key);
  } catch (error) {
    console.error(`[Cache] Failed to get key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in cache
 * 캐시에 값 저장
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  if (!redis) return;

  try {
    await redis.setex(key, ttlSeconds, value);
  } catch (error) {
    console.error(`[Cache] Failed to set key ${key}:`, error);
  }
}

/**
 * Delete cache by key
 * 캐시 키로 삭제
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error(`[Cache] Failed to delete key ${key}:`, error);
  }
}

/**
 * Invalidate cache by pattern (delete multiple keys)
 * 패턴으로 캐시 무효화 (여러 키 삭제)
 *
 * Note: Upstash has rate limits on SCAN, use sparingly
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  if (!redis) return 0;

  try {
    // Use SCAN to find keys matching pattern
    const keys: string[] = [];
    let cursor = 0;

    do {
      const result = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(result[0]);
      keys.push(...(result[1] as string[]));
    } while (cursor !== 0);

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return keys.length;
  } catch (error) {
    console.error(`[Cache] Failed to invalidate pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Invalidate all cache for a specific campaign
 * 특정 캠페인의 모든 캐시 무효화
 */
export async function invalidateCampaignCache(campaignId: string): Promise<void> {
  if (!redis) return;

  try {
    // Delete specific campaign detail
    await deleteCache(CacheKeys.campaignDetail(campaignId));

    // Invalidate campaign lists (all pages/labels)
    await invalidatePattern("campaigns:list:*");

    // Invalidate dashboard stats (all users)
    await invalidatePattern("dashboard:stats:*");
  } catch (error) {
    console.error(`[Cache] Failed to invalidate campaign ${campaignId}:`, error);
  }
}

/**
 * Invalidate all cache for a specific user's dashboard
 * 특정 사용자의 대시보드 캐시 무효화
 */
export async function invalidateUserDashboard(userId: string): Promise<void> {
  await deleteCache(CacheKeys.dashboardStats(userId));
}

/**
 * Invalidate generation-related caches
 * 생성 관련 캐시 무효화
 */
export async function invalidateGenerationCache(
  generationId: string,
  campaignId?: string
): Promise<void> {
  if (!redis) return;

  try {
    // Delete generation status
    await deleteCache(CacheKeys.generationStatus(generationId));

    // If campaign ID provided, invalidate related caches
    if (campaignId) {
      await invalidateCampaignCache(campaignId);
    } else {
      // Invalidate all dashboard stats
      await invalidatePattern("dashboard:stats:*");
    }
  } catch (error) {
    console.error(`[Cache] Failed to invalidate generation ${generationId}:`, error);
  }
}

/**
 * Create a hash from object for cache key
 * 객체에서 캐시 키용 해시 생성
 */
export function createCacheHash(obj: Record<string, unknown>): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if Redis is available
 * Redis 사용 가능 여부 확인
 */
export function isRedisAvailable(): boolean {
  return redis !== null;
}

// Export Redis instance for direct usage if needed
export { redis };
