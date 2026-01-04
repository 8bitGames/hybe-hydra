/**
 * Image Caching System
 * - Per-keyword search cache (7-day TTL) - reduces Google API calls
 * - Image cache with URL + Content Hash deduplication - reduces S3 storage
 */

import crypto from 'crypto';
import { prisma, withRetry } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

// =====================================================
// TYPES
// =====================================================

export interface ImageCandidate {
  id: string;
  sourceUrl: string;
  thumbnailUrl: string;
  sourceTitle?: string;
  sourceDomain?: string;
  width: number;
  height: number;
  isSelected: boolean;
  sortOrder: number;
  qualityScore: number;
}

export interface KeywordCacheResult {
  keyword: string;
  candidates: ImageCandidate[];
  fromCache: boolean;
  searchedAt: Date;
}

export interface CachedImageResult {
  id: string;
  sourceUrl: string;
  s3Url: string;
  s3Key: string;
  contentHash: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

// =====================================================
// KEYWORD NORMALIZATION
// =====================================================

/**
 * Normalize a keyword for consistent caching
 */
export function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().trim();
}

// =====================================================
// PER-KEYWORD CACHE OPERATIONS (7-day TTL)
// =====================================================

const CACHE_TTL_DAYS = 7;

/**
 * Get cached results for multiple keywords
 * Returns: { cached: KeywordCacheResult[], uncached: string[] }
 */
export async function getKeywordCacheResults(
  keywords: string[],
  language: string = 'en'
): Promise<{ cached: KeywordCacheResult[]; uncached: string[] }> {
  try {
    const normalizedKeywords = keywords.map(normalizeKeyword).filter(k => k.length > 0);

    if (normalizedKeywords.length === 0) {
      return { cached: [], uncached: [] };
    }

    // Find all cached keywords that haven't expired
    const cachedEntries = await withRetry(() =>
      prisma.imageSearchCache.findMany({
        where: {
          keyword: { in: normalizedKeywords },
          language,
          expiresAt: { gt: new Date() },
        },
      })
    );

    // Build result sets
    const cachedKeywords = new Set(cachedEntries.map(e => e.keyword));
    const cached: KeywordCacheResult[] = [];
    const uncached: string[] = [];

    for (const keyword of normalizedKeywords) {
      const entry = cachedEntries.find(e => e.keyword === keyword);
      if (entry) {
        cached.push({
          keyword,
          candidates: entry.results as unknown as ImageCandidate[],
          fromCache: true,
          searchedAt: entry.searchedAt,
        });

        // Increment hit count (fire and forget)
        withRetry(() =>
          prisma.imageSearchCache.update({
            where: { id: entry.id },
            data: { hitCount: { increment: 1 } },
          })
        ).catch(() => {});
      } else {
        uncached.push(keyword);
      }
    }

    console.log(`[Image Cache] Keywords: ${normalizedKeywords.length} total, ${cached.length} cached, ${uncached.length} uncached`);
    return { cached, uncached };
  } catch (error) {
    console.warn('[Image Cache] Cache check failed, treating all as uncached:', error);
    return {
      cached: [],
      uncached: keywords.map(normalizeKeyword).filter(k => k.length > 0)
    };
  }
}

/**
 * Store search results for a single keyword
 */
export async function setKeywordCacheResult(
  keyword: string,
  candidates: ImageCandidate[],
  language: string = 'en'
): Promise<void> {
  try {
    const normalizedKeyword = normalizeKeyword(keyword);
    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

    await withRetry(() =>
      prisma.imageSearchCache.upsert({
        where: {
          keyword_language: {
            keyword: normalizedKeyword,
            language,
          },
        },
        create: {
          keyword: normalizedKeyword,
          language,
          results: candidates as unknown as Prisma.InputJsonValue,
          resultCount: candidates.length,
          expiresAt,
        },
        update: {
          results: candidates as unknown as Prisma.InputJsonValue,
          resultCount: candidates.length,
          searchedAt: new Date(),
          expiresAt,
          hitCount: 0, // Reset on refresh
        },
      })
    );

    console.log(`[Image Cache] Stored ${candidates.length} results for keyword: "${normalizedKeyword}" (expires in ${CACHE_TTL_DAYS} days)`);
  } catch (error) {
    console.warn('[Image Cache] Failed to store keyword cache:', error);
  }
}

/**
 * Clear cache for specific keywords (used by force refresh)
 */
export async function clearKeywordCache(
  keywords: string[],
  language: string = 'en'
): Promise<number> {
  try {
    const normalizedKeywords = keywords.map(normalizeKeyword).filter(k => k.length > 0);

    const result = await withRetry(() =>
      prisma.imageSearchCache.deleteMany({
        where: {
          keyword: { in: normalizedKeywords },
          language,
        },
      })
    );

    console.log(`[Image Cache] Cleared cache for ${result.count} keywords`);
    return result.count;
  } catch (error) {
    console.warn('[Image Cache] Failed to clear cache:', error);
    return 0;
  }
}

// =====================================================
// LEGACY FUNCTIONS (kept for backward compatibility)
// =====================================================

/**
 * @deprecated Use getKeywordCacheResults instead
 */
export function generateSearchCacheKey(
  keywords: string[],
  params: {
    maxImages?: number;
    safeSearch?: string;
    imageSize?: string;
  } = {}
): string {
  const normalizedKeywords = keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 0)
    .sort()
    .join('|');

  const paramString = [
    `safe:${params.safeSearch || 'medium'}`,
    `size:${params.imageSize || 'huge'}`,
    `max:${params.maxImages || 20}`,
  ].join('|');

  return crypto
    .createHash('md5')
    .update(`${normalizedKeywords}::${paramString}`)
    .digest('hex');
}

/**
 * @deprecated Use getKeywordCacheResults instead
 */
export interface SearchCacheResult {
  candidates: unknown[];
  totalFound: number;
  filtered: number;
  filterReasons: Record<string, number>;
}

/**
 * @deprecated Use getKeywordCacheResults instead
 */
export async function getCachedSearchResults(
  cacheKey: string
): Promise<SearchCacheResult | null> {
  // Return null to force fresh search - this is deprecated
  return null;
}

/**
 * @deprecated Use setKeywordCacheResult instead
 */
export async function setCachedSearchResults(
  cacheKey: string,
  keywords: string[],
  results: SearchCacheResult,
  searchParams: Record<string, unknown>,
  ttlHours: number = 24
): Promise<void> {
  // No-op - deprecated
}

// =====================================================
// IMAGE URL/CONTENT HASH OPERATIONS
// =====================================================

/**
 * Generate a hash for an image URL
 */
export function generateImageUrlHash(url: string): string {
  try {
    const normalized = new URL(url);
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'ref', 'source',
    ];
    trackingParams.forEach((param) => normalized.searchParams.delete(param));
    return crypto.createHash('md5').update(normalized.toString()).digest('hex');
  } catch {
    return crypto.createHash('md5').update(url).digest('hex');
  }
}

/**
 * Generate a content hash from image buffer (MD5)
 */
export function generateContentHash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// =====================================================
// IMAGE CACHE OPERATIONS
// =====================================================

/**
 * Check if an image is already cached by URL
 */
export async function getCachedImageByUrl(
  sourceUrl: string
): Promise<CachedImageResult | null> {
  try {
    const urlHash = generateImageUrlHash(sourceUrl);

    const cached = await withRetry(() =>
      prisma.cachedImage.findFirst({
        where: { sourceUrlHash: urlHash },
      })
    );

    if (cached) {
      withRetry(() =>
        prisma.cachedImage.update({
          where: { id: cached.id },
          data: {
            hitCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        })
      ).catch(() => {});

      return cached as CachedImageResult;
    }

    return null;
  } catch (error) {
    console.error('[Image Cache] Error getting cached image by URL:', error);
    return null;
  }
}

/**
 * Check if an image is already cached by content hash
 */
export async function getCachedImageByContentHash(
  contentHash: string
): Promise<CachedImageResult | null> {
  try {
    const cached = await withRetry(() =>
      prisma.cachedImage.findFirst({
        where: { contentHash },
      })
    );

    if (cached) {
      withRetry(() =>
        prisma.cachedImage.update({
          where: { id: cached.id },
          data: {
            hitCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        })
      ).catch(() => {});

      return cached as CachedImageResult;
    }

    return null;
  } catch (error) {
    console.error('[Image Cache] Error getting cached image by hash:', error);
    return null;
  }
}

/**
 * Store a new cached image
 */
export async function setCachedImage(data: {
  sourceUrl: string;
  contentHash: string;
  s3Url: string;
  s3Key: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  sourceTitle?: string;
  sourceDomain?: string;
  qualityScore?: number;
}): Promise<CachedImageResult | null> {
  try {
    const sourceUrlHash = generateImageUrlHash(data.sourceUrl);

    const cached = await withRetry(() =>
      prisma.cachedImage.create({
        data: {
          ...data,
          sourceUrlHash,
        },
      })
    );

    console.log(`[Image Cache] Stored new image: ${data.sourceUrl.slice(0, 50)}... → ${data.s3Key}`);
    return cached as CachedImageResult;
  } catch (error) {
    console.warn('[Image Cache] Failed to store cached image:', error);
    return null;
  }
}

/**
 * Get or cache an image
 */
export async function getOrCheckImageCache(
  sourceUrl: string,
  buffer?: Buffer
): Promise<{ cached: true; s3Url: string; s3Key: string } | { cached: false }> {
  try {
    const byUrl = await getCachedImageByUrl(sourceUrl);
    if (byUrl) {
      return { cached: true, s3Url: byUrl.s3Url, s3Key: byUrl.s3Key };
    }

    if (buffer) {
      const contentHash = generateContentHash(buffer);
      const byHash = await getCachedImageByContentHash(contentHash);
      if (byHash) {
        try {
          await withRetry(() =>
            prisma.cachedImage.create({
              data: {
                sourceUrl,
                sourceUrlHash: generateImageUrlHash(sourceUrl),
                contentHash,
                s3Url: byHash.s3Url,
                s3Key: byHash.s3Key,
                width: byHash.width,
                height: byHash.height,
                mimeType: byHash.mimeType,
              },
            })
          );
        } catch {
          // Ignore duplicate key errors
        }
        return { cached: true, s3Url: byHash.s3Url, s3Key: byHash.s3Key };
      }
    }

    return { cached: false };
  } catch (error) {
    console.warn('[Image Cache] Cache check failed:', error);
    return { cached: false };
  }
}

// =====================================================
// CACHE CLEANUP OPERATIONS
// =====================================================

/**
 * Delete expired search cache entries
 */
export async function cleanupExpiredSearchCache(): Promise<number> {
  const result = await withRetry(() =>
    prisma.imageSearchCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
  );

  console.log(`[Image Cache] Cleaned up ${result.count} expired search caches`);
  return result.count;
}

/**
 * Delete old unused images (LRU cleanup)
 */
export async function cleanupUnusedImages(
  maxAgeDays: number = 30,
  minHitCount: number = 2
): Promise<{ count: number; s3Keys: string[] }> {
  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  const unused = await withRetry(() =>
    prisma.cachedImage.findMany({
      where: {
        lastUsedAt: { lt: cutoffDate },
        hitCount: { lt: minHitCount },
      },
      select: { id: true, s3Key: true },
    })
  );

  if (unused.length === 0) {
    return { count: 0, s3Keys: [] };
  }

  await withRetry(() =>
    prisma.cachedImage.deleteMany({
      where: {
        id: { in: unused.map((u) => u.id) },
      },
    })
  );

  const s3Keys = unused.map((u) => u.s3Key);
  console.log(`[Image Cache] Marked ${unused.length} unused images for cleanup`);

  return { count: unused.length, s3Keys };
}

// =====================================================
// CACHE STATISTICS
// =====================================================

export interface CacheStats {
  searchCache: {
    total: number;
    active: number;
    expired: number;
    totalHits: number;
  };
  imageCache: {
    total: number;
    totalHits: number;
    totalSizeMB: number;
  };
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(): Promise<CacheStats> {
  const now = new Date();

  const [searchTotal, searchActive, searchHits, imageTotal, imageHits, imageSize] =
    await Promise.all([
      withRetry(() => prisma.imageSearchCache.count()),
      withRetry(() => prisma.imageSearchCache.count({ where: { expiresAt: { gt: now } } })),
      withRetry(() => prisma.imageSearchCache.aggregate({ _sum: { hitCount: true } })),
      withRetry(() => prisma.cachedImage.count()),
      withRetry(() => prisma.cachedImage.aggregate({ _sum: { hitCount: true } })),
      withRetry(() => prisma.cachedImage.aggregate({ _sum: { fileSize: true } })),
    ]);

  return {
    searchCache: {
      total: searchTotal,
      active: searchActive,
      expired: searchTotal - searchActive,
      totalHits: searchHits._sum.hitCount || 0,
    },
    imageCache: {
      total: imageTotal,
      totalHits: imageHits._sum.hitCount || 0,
      totalSizeMB: Math.round((imageSize._sum.fileSize || 0) / 1024 / 1024),
    },
  };
}
