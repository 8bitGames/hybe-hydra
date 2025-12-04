/**
 * Cache Cleanup Cron Job
 * - Cleans expired search cache entries (24h TTL)
 * - Cleans unused images (30 days, < 2 hits)
 *
 * Run daily via Vercel Cron: 0 0 * * *
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupExpiredSearchCache,
  cleanupUnusedImages,
  getCacheStats,
} from '@/lib/image-cache';

// Vercel cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (skip in development)
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] Starting cache cleanup...');

    // Get stats before cleanup
    const statsBefore = await getCacheStats();

    // 1. Clean expired search cache
    const expiredSearchCount = await cleanupExpiredSearchCache();

    // 2. Clean unused images (30 days old, < 2 hits)
    const unusedImages = await cleanupUnusedImages(30, 2);

    // Get stats after cleanup
    const statsAfter = await getCacheStats();

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      cleanup: {
        expiredSearchEntries: expiredSearchCount,
        unusedImages: unusedImages.count,
        unusedImageKeys: unusedImages.s3Keys,
      },
      statsBefore,
      statsAfter,
    };

    console.log('[Cron] Cache cleanup completed:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron] Cache cleanup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
