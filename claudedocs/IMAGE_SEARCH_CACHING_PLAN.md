# Google Image Search Caching Optimization Plan

## Problem Statement

현재 Compose 영상 생성 시 Google 이미지 검색을 매번 수행하고 있어 다음 문제가 발생:

| 문제 | 영향 |
|------|------|
| API 낭비 | 동일 키워드 검색 시 Google CSE API 반복 호출 (일일 10,000 쿼리 제한) |
| 스토리지 낭비 | 동일 이미지 URL을 매번 S3에 재업로드 |
| 네트워크 낭비 | 외부 이미지를 반복 다운로드 |
| 응답 지연 | 매번 Google API 호출로 인한 800ms+ 지연 |

## Solution: Two-Layer Caching Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Image Search Request                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Search Results Cache (ImageSearchCache)                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Key: MD5(normalized_keywords + params)                  │    │
│  │  Value: ImageSearchResult[]                              │    │
│  │  TTL: 24 hours                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Cache HIT → Return cached results (NO Google API call)          │
│  Cache MISS → Call Google API → Store results → Return           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Proxied Image Cache (CachedImage)                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Key: MD5(source_url)                                    │    │
│  │  Value: S3 URL + metadata                                │    │
│  │  TTL: Permanent (with LRU cleanup option)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Cache HIT → Return existing S3 URL (NO download/upload)         │
│  Cache MISS → Download → Upload to S3 → Store → Return           │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### 1. ImageSearchCache (24시간 TTL 검색 결과 캐시)

```prisma
model ImageSearchCache {
  id            String   @id @default(uuid())
  cacheKey      String   @unique @map("cache_key")    // MD5 hash of keywords+params
  keywords      String[]                               // Original keywords for debugging
  searchParams  Json?    @map("search_params")        // {maxImages, safeSearch, imageSize}
  results       Json     @map("results")               // Full search response
  totalResults  Int      @map("total_results")
  hitCount      Int      @default(0) @map("hit_count") // Analytics
  createdAt     DateTime @default(now()) @map("created_at")
  expiresAt     DateTime @map("expires_at")            // TTL enforcement

  @@index([cacheKey])
  @@index([expiresAt])
  @@map("image_search_cache")
}
```

### 2. CachedImage (영구 이미지 캐시)

```prisma
model CachedImage {
  id            String   @id @default(uuid())
  sourceUrl     String   @unique @map("source_url")   // Original image URL
  sourceUrlHash String   @map("source_url_hash")      // MD5 for fast lookup
  s3Url         String   @map("s3_url")               // Cached S3 URL
  s3Key         String   @map("s3_key")               // S3 object key
  thumbnailUrl  String?  @map("thumbnail_url")
  width         Int?
  height        Int?
  fileSize      Int?     @map("file_size")
  mimeType      String?  @map("mime_type")
  sourceTitle   String?  @map("source_title")
  sourceDomain  String?  @map("source_domain")
  qualityScore  Float?   @map("quality_score")
  hitCount      Int      @default(0) @map("hit_count")
  lastUsedAt    DateTime @default(now()) @map("last_used_at")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([sourceUrlHash])
  @@index([lastUsedAt])
  @@map("cached_images")
}
```

## Implementation Plan

### Phase 1: Database Schema
**Priority: HIGH | Estimated: 30 min**

1. `prisma/schema.prisma`에 위 두 모델 추가
2. Migration 실행: `npx prisma migrate dev --name add_image_caching`
3. Prisma Client 재생성

### Phase 2: Core Caching Library
**Priority: HIGH | Estimated: 1 hour**

`lib/image-cache.ts` 생성:

```typescript
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Cache key generation
export function generateSearchCacheKey(
  keywords: string[],
  params: { maxImages?: number; safeSearch?: string; imageSize?: string }
): string {
  const normalizedKeywords = keywords
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length > 0)
    .sort()
    .join('|');

  const paramString = [
    `safe:${params.safeSearch || 'medium'}`,
    `size:${params.imageSize || 'huge'}`,
    `max:${params.maxImages || 20}`
  ].join('|');

  return crypto.createHash('md5')
    .update(`${normalizedKeywords}::${paramString}`)
    .digest('hex');
}

export function generateImageUrlHash(url: string): string {
  try {
    const normalized = new URL(url);
    // Remove tracking params
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'ref'].forEach(
      param => normalized.searchParams.delete(param)
    );
    return crypto.createHash('md5').update(normalized.toString()).digest('hex');
  } catch {
    return crypto.createHash('md5').update(url).digest('hex');
  }
}

// Search cache operations
export async function getCachedSearchResults(cacheKey: string) {
  const cached = await prisma.imageSearchCache.findFirst({
    where: {
      cacheKey,
      expiresAt: { gt: new Date() }
    }
  });

  if (cached) {
    // Increment hit count (fire and forget)
    prisma.imageSearchCache.update({
      where: { id: cached.id },
      data: { hitCount: { increment: 1 } }
    }).catch(() => {});
  }

  return cached;
}

export async function setCachedSearchResults(
  cacheKey: string,
  keywords: string[],
  results: unknown,
  totalResults: number,
  searchParams: unknown,
  ttlHours: number = 24
) {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  return prisma.imageSearchCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      keywords,
      results: results as any,
      totalResults,
      searchParams: searchParams as any,
      expiresAt
    },
    update: {
      results: results as any,
      totalResults,
      searchParams: searchParams as any,
      expiresAt,
      hitCount: 0
    }
  });
}

// Image cache operations
export async function getCachedImage(sourceUrl: string) {
  const urlHash = generateImageUrlHash(sourceUrl);

  const cached = await prisma.cachedImage.findFirst({
    where: { sourceUrlHash: urlHash }
  });

  if (cached) {
    // Update usage stats (fire and forget)
    prisma.cachedImage.update({
      where: { id: cached.id },
      data: {
        hitCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    }).catch(() => {});
  }

  return cached;
}

export async function setCachedImage(data: {
  sourceUrl: string;
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
}) {
  const sourceUrlHash = generateImageUrlHash(data.sourceUrl);

  return prisma.cachedImage.upsert({
    where: { sourceUrl: data.sourceUrl },
    create: {
      ...data,
      sourceUrlHash
    },
    update: {
      s3Url: data.s3Url,
      s3Key: data.s3Key,
      lastUsedAt: new Date()
    }
  });
}

// Cleanup operations
export async function cleanupExpiredSearchCache() {
  return prisma.imageSearchCache.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
}
```

### Phase 3: API Route Modifications
**Priority: HIGH | Estimated: 1.5 hours**

#### 3.1 Update `/api/v1/compose/images/search/route.ts`

```typescript
// Add imports
import {
  generateSearchCacheKey,
  getCachedSearchResults,
  setCachedSearchResults
} from '@/lib/image-cache';

export async function POST(request: NextRequest) {
  // ... existing auth check ...

  const { keywords, maxImages, safeSearch } = body;

  // 1. Generate cache key
  const cacheKey = generateSearchCacheKey(keywords, { maxImages, safeSearch });

  // 2. Check cache first
  const cached = await getCachedSearchResults(cacheKey);

  if (cached) {
    console.log(`[Image Search] Cache HIT for: ${keywords.join(', ')}`);
    return NextResponse.json({
      ...(cached.results as any),
      fromCache: true,
      cacheAge: Math.floor((Date.now() - cached.createdAt.getTime()) / 1000 / 60) // minutes
    });
  }

  console.log(`[Image Search] Cache MISS for: ${keywords.join(', ')}`);

  // 3. Cache miss - call Google API (existing logic)
  const searchResults = await searchImagesMultiQuery(keywords, {...});

  // ... existing filtering logic ...

  const response = { candidates, totalFound, filtered, filterReasons };

  // 4. Store in cache
  await setCachedSearchResults(
    cacheKey,
    keywords,
    response,
    searchResults.length,
    { maxImages, safeSearch }
  );

  return NextResponse.json({ ...response, fromCache: false });
}
```

#### 3.2 Update `/api/v1/compose/proxy-images/route.ts`

```typescript
// Add imports
import { getCachedImage, setCachedImage, generateImageUrlHash } from '@/lib/image-cache';

export async function POST(request: NextRequest) {
  // ... existing auth check ...

  const results: ProxyResult[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  await Promise.all(
    images.map(async (image, index) => {
      try {
        // 1. Check if already cached
        const cached = await getCachedImage(image.url);

        if (cached) {
          cacheHits++;
          results.push({
            originalUrl: image.url,
            minioUrl: cached.s3Url,
            id: image.id,
            success: true,
            fromCache: true
          });
          return;
        }

        cacheMisses++;

        // 2. Cache miss - download image (existing logic)
        const response = await fetch(image.url, {...});
        // ... existing download logic ...

        // 3. Upload to SHARED cache path (not per-generation)
        const urlHash = generateImageUrlHash(image.url);
        const objectKey = `compose/cached/${urlHash}.${ext}`;
        const minioUrl = await uploadToS3(buffer, objectKey, contentType);

        // 4. Store in cache
        await setCachedImage({
          sourceUrl: image.url,
          s3Url: minioUrl,
          s3Key: objectKey,
          mimeType: contentType,
          fileSize: buffer.length
        });

        results.push({
          originalUrl: image.url,
          minioUrl,
          id: image.id,
          success: true,
          fromCache: false
        });
      } catch (error) {
        // ... existing error handling ...
      }
    })
  );

  console.log(`[Proxy Images] Cache hits: ${cacheHits}, Misses: ${cacheMisses}`);

  return NextResponse.json({
    results,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    cacheStats: { hits: cacheHits, misses: cacheMisses }
  });
}
```

### Phase 4: Cache Cleanup Cron Job
**Priority: MEDIUM | Estimated: 30 min**

`app/api/cron/cleanup-cache/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { cleanupExpiredSearchCache } from '@/lib/image-cache';

export async function GET(request: Request) {
  // Verify cron secret (for Vercel Cron)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await cleanupExpiredSearchCache();

  return NextResponse.json({
    success: true,
    deletedCount: result.count,
    timestamp: new Date().toISOString()
  });
}
```

`vercel.json` (cron 설정):

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-cache",
      "schedule": "0 4 * * *"
    }
  ]
}
```

## Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Google API calls/day | ~100 | ~10-20 | **80-90% 감소** |
| S3 uploads/day | ~500 | ~100 | **80% 감소** |
| Search latency (cached) | 800ms | 50ms | **94% 감소** |
| Storage growth/day | 50MB | 10MB | **80% 감소** |
| Network bandwidth | High | Low | **Significant** |

## Files Summary

| Action | File Path |
|--------|-----------|
| CREATE | `lib/image-cache.ts` |
| CREATE | `app/api/cron/cleanup-cache/route.ts` |
| MODIFY | `prisma/schema.prisma` |
| MODIFY | `app/api/v1/compose/images/search/route.ts` |
| MODIFY | `app/api/v1/compose/proxy-images/route.ts` |
| MODIFY | `vercel.json` (optional) |

## Backward Compatibility

- 기존 generation의 이미지는 영향 없음 (다른 S3 경로)
- API 응답 형식 유지 (새 필드 `fromCache` 추가만)
- 캐시 없을 때 기존 로직으로 fallback
- 점진적 롤아웃 가능

## Future Enhancements (Optional)

1. **Content Hash**: 같은 이미지라도 다른 URL일 경우 → 이미지 content hash로 중복 제거
2. **Redis Cache**: 고트래픽 시 in-memory 캐시 레이어 추가
3. **Admin Dashboard**: 캐시 통계 및 수동 무효화 UI
4. **Smart TTL**: 인기 키워드는 더 긴 TTL 적용
