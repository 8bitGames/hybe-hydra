/**
 * Image Caching System
 * - Search results cache (24h TTL) - reduces Google API calls
 * - Image cache with URL + Content Hash deduplication - reduces S3 storage
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

// =====================================================
// CACHE KEY GENERATION
// =====================================================

/**
 * Generate a cache key for image search results
 * Normalizes keywords and params for consistent caching
 */
export function generateSearchCacheKey(
  keywords: string[],
  params: {
    maxImages?: number;
    safeSearch?: string;
    imageSize?: string;
  } = {}
): string {
  // Normalize keywords: lowercase, trim, sort for consistency
  const normalizedKeywords = keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 0)
    .sort()
    .join('|');

  // Include relevant params that affect search results
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
 * Generate a hash for an image URL
 * Removes common tracking parameters for better deduplication
 */
export function generateImageUrlHash(url: string): string {
  try {
    const normalized = new URL(url);
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'fbclid',
      'gclid',
      'ref',
      'source',
    ];
    trackingParams.forEach((param) => normalized.searchParams.delete(param));
    return crypto.createHash('md5').update(normalized.toString()).digest('hex');
  } catch {
    // If URL parsing fails, hash the raw string
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
// SEARCH CACHE OPERATIONS
// =====================================================

export interface SearchCacheResult {
  candidates: unknown[];
  totalFound: number;
  filtered: number;
  filterReasons: Record<string, number>;
}

/**
 * Get cached search results if available and not expired
 * IMPORTANT: Fail-safe - returns null on any error so normal search continues.
 */
export async function getCachedSearchResults(
  cacheKey: string
): Promise<SearchCacheResult | null> {
  try {
    const cached = await prisma.imageSearchCache.findFirst({
      where: {
        cacheKey,
        expiresAt: { gt: new Date() },
      },
    });

    if (cached) {
      // Increment hit count (fire and forget - don't await)
      prisma.imageSearchCache
        .update({
          where: { id: cached.id },
          data: { hitCount: { increment: 1 } },
        })
        .catch(() => {}); // Ignore errors

      console.log(`[Image Cache] Search cache HIT for key: ${cacheKey.slice(0, 8)}...`);
      return cached.results as unknown as SearchCacheResult;
    }

    console.log(`[Image Cache] Search cache MISS for key: ${cacheKey.slice(0, 8)}...`);
    return null;
  } catch (error) {
    // Fail-safe: if cache check fails, log and return null so normal search happens
    console.warn('[Image Cache] Search cache check failed, falling back to fresh search:', error);
    return null;
  }
}

/**
 * Store search results in cache
 * IMPORTANT: Fail-safe - errors are logged but don't break the main flow.
 */
export async function setCachedSearchResults(
  cacheKey: string,
  keywords: string[],
  results: SearchCacheResult,
  searchParams: Record<string, unknown>,
  ttlHours: number = 24
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await prisma.imageSearchCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        keywords,
        results: results as unknown as Prisma.InputJsonValue,
        totalResults: results.totalFound,
        searchParams: searchParams as Prisma.InputJsonValue,
        expiresAt,
      },
      update: {
        results: results as unknown as Prisma.InputJsonValue,
        totalResults: results.totalFound,
        searchParams: searchParams as Prisma.InputJsonValue,
        expiresAt,
        hitCount: 0, // Reset hit count on refresh
      },
    });

    console.log(`[Image Cache] Stored search results for key: ${cacheKey.slice(0, 8)}... (expires in ${ttlHours}h)`);
  } catch (error) {
    // Fail-safe: caching failures shouldn't break the main flow
    console.warn('[Image Cache] Failed to store search results (non-fatal):', error);
  }
}

// =====================================================
// IMAGE CACHE OPERATIONS
// =====================================================

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

/**
 * Check if an image is already cached by URL
 */
export async function getCachedImageByUrl(
  sourceUrl: string
): Promise<CachedImageResult | null> {
  try {
    const urlHash = generateImageUrlHash(sourceUrl);

    const cached = await prisma.cachedImage.findFirst({
      where: { sourceUrlHash: urlHash },
    });

    if (cached) {
      // Update usage stats (fire and forget)
      prisma.cachedImage
        .update({
          where: { id: cached.id },
          data: {
            hitCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        })
        .catch(() => {});

      console.log(`[Image Cache] URL cache HIT: ${sourceUrl.slice(0, 50)}...`);
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
 * This catches cases where same image has different URLs
 */
export async function getCachedImageByContentHash(
  contentHash: string
): Promise<CachedImageResult | null> {
  try {
    const cached = await prisma.cachedImage.findFirst({
      where: { contentHash },
    });

    if (cached) {
      // Update usage stats (fire and forget)
      prisma.cachedImage
        .update({
          where: { id: cached.id },
          data: {
            hitCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        })
        .catch(() => {});

      console.log(`[Image Cache] Content hash HIT: ${contentHash.slice(0, 8)}...`);
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
 * IMPORTANT: This function is fail-safe - if caching fails, it logs and returns null.
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

    const cached = await prisma.cachedImage.create({
      data: {
        ...data,
        sourceUrlHash,
      },
    });

    console.log(`[Image Cache] Stored new image: ${data.sourceUrl.slice(0, 50)}... → ${data.s3Key}`);
    return cached as CachedImageResult;
  } catch (error) {
    // If caching fails (e.g., Prisma not updated, duplicate entry), log and continue
    console.warn('[Image Cache] Failed to store cached image:', error);
    return null;
  }
}

/**
 * Get or cache an image - the main entry point for image caching
 * Returns existing S3 URL if cached, or null if needs to be downloaded
 * IMPORTANT: This function is designed to be fail-safe - if caching fails,
 * it returns { cached: false } so the normal flow continues.
 */
export async function getOrCheckImageCache(
  sourceUrl: string,
  buffer?: Buffer
): Promise<{ cached: true; s3Url: string; s3Key: string } | { cached: false }> {
  try {
    // Step 1: Check by URL (fast, no download needed)
    const byUrl = await getCachedImageByUrl(sourceUrl);
    if (byUrl) {
      return { cached: true, s3Url: byUrl.s3Url, s3Key: byUrl.s3Key };
    }

    // Step 2: If buffer provided, check by content hash
    if (buffer) {
      const contentHash = generateContentHash(buffer);
      const byHash = await getCachedImageByContentHash(contentHash);
      if (byHash) {
        // Same image content, different URL - register this URL too
        try {
          await prisma.cachedImage.create({
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
          });
          console.log(`[Image Cache] Registered duplicate URL for existing image`);
        } catch {
          // Ignore duplicate key errors
        }
        return { cached: true, s3Url: byHash.s3Url, s3Key: byHash.s3Key };
      }
    }

    return { cached: false };
  } catch (error) {
    // If cache check fails for any reason (e.g., Prisma not updated, DB error),
    // gracefully fall back to non-cached behavior
    console.warn('[Image Cache] Cache check failed, falling back to direct download:', error);
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
  const result = await prisma.imageSearchCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  console.log(`[Image Cache] Cleaned up ${result.count} expired search caches`);
  return result.count;
}

/**
 * Delete old unused images (LRU cleanup)
 * Only deletes images not used in the last X days with low hit count
 */
export async function cleanupUnusedImages(
  maxAgeDays: number = 30,
  minHitCount: number = 2
): Promise<{ count: number; s3Keys: string[] }> {
  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  // Find unused images
  const unused = await prisma.cachedImage.findMany({
    where: {
      lastUsedAt: { lt: cutoffDate },
      hitCount: { lt: minHitCount },
    },
    select: { id: true, s3Key: true },
  });

  if (unused.length === 0) {
    return { count: 0, s3Keys: [] };
  }

  // Delete from DB
  await prisma.cachedImage.deleteMany({
    where: {
      id: { in: unused.map((u) => u.id) },
    },
  });

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
      prisma.imageSearchCache.count(),
      prisma.imageSearchCache.count({ where: { expiresAt: { gt: now } } }),
      prisma.imageSearchCache.aggregate({ _sum: { hitCount: true } }),
      prisma.cachedImage.count(),
      prisma.cachedImage.aggregate({ _sum: { hitCount: true } }),
      prisma.cachedImage.aggregate({ _sum: { fileSize: true } }),
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
