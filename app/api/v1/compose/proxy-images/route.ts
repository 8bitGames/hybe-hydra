import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { uploadToS3 } from '@/lib/storage';
import crypto from 'crypto';
import {
  getOrCheckImageCache,
  setCachedImage,
  generateContentHash,
} from '@/lib/image-cache';

interface ProxyRequest {
  images: Array<{
    url: string;
    id: string;
  }>;
  generationId: string;
}

interface ProxyResult {
  originalUrl: string;
  minioUrl: string;
  id: string;
  success: boolean;
  error?: string;
  fromCache?: boolean;
}

// Simple hash function for unique filenames
function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: ProxyRequest = await request.json();
    const { images, generationId } = body;

    if (!images || images.length === 0) {
      return NextResponse.json(
        { detail: 'No images provided' },
        { status: 400 }
      );
    }

    const results: ProxyResult[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    // Process images in parallel
    await Promise.all(
      images.map(async (image, index) => {
        try {
          // =====================================================
          // STEP 1: Check URL cache first (fast, no download)
          // =====================================================
          const urlCacheCheck = await getOrCheckImageCache(image.url);
          if (urlCacheCheck.cached) {
            cacheHits++;
            console.log(`[Proxy] ✅ CACHE HIT (URL): ${image.url.slice(0, 50)}...`);
            results.push({
              originalUrl: image.url,
              minioUrl: urlCacheCheck.s3Url,
              id: image.id,
              success: true,
              fromCache: true,
            });
            return;
          }

          // =====================================================
          // STEP 2: Cache miss - download image
          // =====================================================
          const response = await fetch(image.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': new URL(image.url).origin + '/',
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // =====================================================
          // STEP 3: Check content hash for deduplication
          // =====================================================
          const contentHash = generateContentHash(buffer);
          const contentCacheCheck = await getOrCheckImageCache(image.url, buffer);
          if (contentCacheCheck.cached) {
            cacheHits++;
            console.log(`[Proxy] ✅ CACHE HIT (content hash): ${image.url.slice(0, 50)}...`);
            results.push({
              originalUrl: image.url,
              minioUrl: contentCacheCheck.s3Url,
              id: image.id,
              success: true,
              fromCache: true,
            });
            return;
          }

          // =====================================================
          // STEP 4: Upload to S3 and cache
          // =====================================================
          cacheMisses++;
          let ext = 'jpg';
          if (contentType.includes('png')) ext = 'png';
          else if (contentType.includes('webp')) ext = 'webp';
          else if (contentType.includes('gif')) ext = 'gif';

          // Use shared cache path for deduplication
          const urlHash = hashUrl(image.url);
          const objectKey = `compose/cached/${urlHash}.${ext}`;
          const minioUrl = await uploadToS3(buffer, objectKey, contentType);

          // Store in cache (fire and forget - don't block on this)
          setCachedImage({
            sourceUrl: image.url,
            contentHash,
            s3Url: minioUrl,
            s3Key: objectKey,
            mimeType: contentType,
            fileSize: buffer.length,
          }).catch(err => {
            console.warn(`[Proxy] Cache store failed (non-fatal):`, err);
          });

          console.log(`[Proxy] 💾 NEW: ${image.url.slice(0, 50)}... → ${objectKey}`);
          results.push({
            originalUrl: image.url,
            minioUrl,
            id: image.id,
            success: true,
            fromCache: false,
          });
        } catch (error) {
          // Log warning instead of error (404s are common for web-scraped images)
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[Proxy] ❌ Skipped (${errMsg}): ${image.url.slice(0, 60)}...`);
          results.push({
            originalUrl: image.url,
            minioUrl: '',
            id: image.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    // Check if we have enough successful images
    const successfulImages = results.filter(r => r.success);
    const cachedCount = results.filter(r => r.fromCache).length;

    console.log(`[Proxy] Complete - Success: ${successfulImages.length}, Failed: ${results.length - successfulImages.length}, Cache hits: ${cacheHits}, New uploads: ${cacheMisses}`);

    return NextResponse.json({
      results,
      successful: successfulImages.length,
      failed: results.length - successfulImages.length,
    });
  } catch (error) {
    console.error('Proxy images error:', error);
    return NextResponse.json(
      { detail: 'Failed to proxy images' },
      { status: 500 }
    );
  }
}
