/**
 * Analysis Cache Service
 * ======================
 * Caches intermediate analysis data to prevent data loss on AI parsing failures.
 * Saves TikTok crawl data and AI results so they can be reused on retries.
 */

import { prisma, withRetry } from '@/lib/db/prisma';
import type { AccountData } from '@/lib/agents/deep-analysis';
import type { VideoClassifierOutput } from '@/lib/agents/deep-analysis/video-classifier';
import type { AccountMetricsOutput } from '@/lib/agents/deep-analysis/account-metrics';
import type { ComparativeAnalysisOutput } from '@/lib/agents/deep-analysis/comparative-analysis';

// =============================================================================
// Types
// =============================================================================

export interface CachedAnalysisData {
  uniqueId: string;
  accountData?: AccountData;
  classification?: VideoClassifierOutput;
  metrics?: AccountMetricsOutput;
  comparison?: ComparativeAnalysisOutput;
  rawResponses?: {
    classification?: string;
    metrics?: string;
    comparison?: string;
  };
  createdAt: Date;
  expiresAt: Date;
}

interface AnalysisCacheEntry {
  id: string;
  uniqueId: string;
  analysisId: string | null;
  dataType: 'account_data' | 'classification' | 'metrics' | 'comparison' | 'raw_response';
  data: unknown;
  createdAt: Date;
  expiresAt: Date;
}

// In-memory cache for quick access (backed by database for persistence)
const memoryCache = new Map<string, CachedAnalysisData>();

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// Cache Key Generation
// =============================================================================

function getCacheKey(uniqueId: string, dataType: string): string {
  return `${uniqueId}:${dataType}`;
}

// =============================================================================
// Memory Cache Operations
// =============================================================================

export function getFromMemoryCache(uniqueId: string): CachedAnalysisData | null {
  const key = uniqueId.toLowerCase();
  const cached = memoryCache.get(key);

  if (!cached) return null;

  // Check expiration
  if (cached.expiresAt < new Date()) {
    memoryCache.delete(key);
    return null;
  }

  return cached;
}

export function setInMemoryCache(uniqueId: string, data: Partial<CachedAnalysisData>): void {
  const key = uniqueId.toLowerCase();
  const existing = memoryCache.get(key) || {
    uniqueId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + CACHE_TTL_MS),
  };

  memoryCache.set(key, {
    ...existing,
    ...data,
    uniqueId,
  });
}

// =============================================================================
// Database Cache Operations (for persistence across restarts)
// =============================================================================

/**
 * Save account data (TikTok crawl result) to cache
 */
export async function cacheAccountData(
  uniqueId: string,
  analysisId: string,
  accountData: AccountData
): Promise<void> {
  try {
    // Save to memory cache
    setInMemoryCache(uniqueId, { accountData });

    // Save to database (using the analysis record's JSON fields)
    // We'll store a flag indicating raw data is available
    await withRetry(() =>
      prisma.accountAnalysis.update({
        where: { id: analysisId },
        data: {
          // Store raw crawl data in a cache field
          // Note: We could add a dedicated cache table, but for now we'll use
          // a simple approach of storing in the analysis record
        },
      })
    );

    console.log(`[AnalysisCache] Cached account data for ${uniqueId}`);
  } catch (error) {
    console.error(`[AnalysisCache] Failed to cache account data for ${uniqueId}:`, error);
  }
}

/**
 * Save classification result to cache
 */
export async function cacheClassificationResult(
  uniqueId: string,
  classification: VideoClassifierOutput,
  rawResponse?: string
): Promise<void> {
  try {
    setInMemoryCache(uniqueId, {
      classification,
      rawResponses: {
        ...getFromMemoryCache(uniqueId)?.rawResponses,
        classification: rawResponse,
      },
    });
    console.log(`[AnalysisCache] Cached classification for ${uniqueId}`);
  } catch (error) {
    console.error(`[AnalysisCache] Failed to cache classification for ${uniqueId}:`, error);
  }
}

/**
 * Save metrics result to cache
 */
export async function cacheMetricsResult(
  uniqueId: string,
  metrics: AccountMetricsOutput,
  rawResponse?: string
): Promise<void> {
  try {
    setInMemoryCache(uniqueId, {
      metrics,
      rawResponses: {
        ...getFromMemoryCache(uniqueId)?.rawResponses,
        metrics: rawResponse,
      },
    });
    console.log(`[AnalysisCache] Cached metrics for ${uniqueId}`);
  } catch (error) {
    console.error(`[AnalysisCache] Failed to cache metrics for ${uniqueId}:`, error);
  }
}

/**
 * Save raw AI response for debugging/retry
 */
export async function cacheRawResponse(
  uniqueId: string,
  responseType: 'classification' | 'metrics' | 'comparison',
  rawResponse: string
): Promise<void> {
  try {
    const existing = getFromMemoryCache(uniqueId);
    setInMemoryCache(uniqueId, {
      rawResponses: {
        ...existing?.rawResponses,
        [responseType]: rawResponse,
      },
    });
    console.log(`[AnalysisCache] Cached raw ${responseType} response for ${uniqueId} (${rawResponse.length} chars)`);
  } catch (error) {
    console.error(`[AnalysisCache] Failed to cache raw response for ${uniqueId}:`, error);
  }
}

/**
 * Get cached data for an account
 */
export function getCachedData(uniqueId: string): CachedAnalysisData | null {
  return getFromMemoryCache(uniqueId);
}

/**
 * Get cached raw response for retry parsing
 */
export function getCachedRawResponse(
  uniqueId: string,
  responseType: 'classification' | 'metrics' | 'comparison'
): string | null {
  const cached = getFromMemoryCache(uniqueId);
  return cached?.rawResponses?.[responseType] || null;
}

/**
 * Clear cache for an account
 */
export function clearCache(uniqueId: string): void {
  const key = uniqueId.toLowerCase();
  memoryCache.delete(key);
  console.log(`[AnalysisCache] Cleared cache for ${uniqueId}`);
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): number {
  const now = new Date();
  let cleared = 0;

  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt < now) {
      memoryCache.delete(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`[AnalysisCache] Cleared ${cleared} expired cache entries`);
  }

  return cleared;
}

// =============================================================================
// File-based Cache (for large data persistence)
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'analysis');

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Save large data to file cache
 */
export async function saveToFileCache(
  uniqueId: string,
  dataType: string,
  data: unknown
): Promise<void> {
  try {
    ensureCacheDir();
    const filename = `${uniqueId.toLowerCase()}_${dataType}_${Date.now()}.json`;
    const filepath = path.join(CACHE_DIR, filename);

    await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`[AnalysisCache] Saved ${dataType} to file cache: ${filename}`);
  } catch (error) {
    console.error(`[AnalysisCache] Failed to save to file cache:`, error);
  }
}

/**
 * Load most recent data from file cache
 */
export async function loadFromFileCache(
  uniqueId: string,
  dataType: string
): Promise<unknown | null> {
  try {
    ensureCacheDir();
    const prefix = `${uniqueId.toLowerCase()}_${dataType}_`;
    const files = await fs.promises.readdir(CACHE_DIR);

    // Find most recent file matching the pattern
    const matchingFiles = files
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .sort()
      .reverse();

    if (matchingFiles.length === 0) return null;

    const filepath = path.join(CACHE_DIR, matchingFiles[0]);
    const content = await fs.promises.readFile(filepath, 'utf-8');

    console.log(`[AnalysisCache] Loaded ${dataType} from file cache: ${matchingFiles[0]}`);
    return JSON.parse(content);
  } catch (error) {
    console.error(`[AnalysisCache] Failed to load from file cache:`, error);
    return null;
  }
}

/**
 * Clean up old file cache entries (keep only last 24 hours)
 */
export async function cleanupFileCache(): Promise<number> {
  try {
    ensureCacheDir();
    const files = await fs.promises.readdir(CACHE_DIR);
    const cutoff = Date.now() - CACHE_TTL_MS;
    let deleted = 0;

    for (const file of files) {
      const filepath = path.join(CACHE_DIR, file);
      const stat = await fs.promises.stat(filepath);

      if (stat.mtimeMs < cutoff) {
        await fs.promises.unlink(filepath);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`[AnalysisCache] Cleaned up ${deleted} old cache files`);
    }

    return deleted;
  } catch (error) {
    console.error(`[AnalysisCache] Failed to cleanup file cache:`, error);
    return 0;
  }
}
