import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import {
  searchImagesMultiQuery,
  isGoogleSearchConfigured,
  ImageSearchResult
} from '@/lib/google-search';
import {
  getKeywordCacheResults,
  setKeywordCacheResult,
  clearKeywordCache,
  type ImageCandidate as CacheImageCandidate,
} from '@/lib/image-cache';

interface ImageSearchRequest {
  generationId: string;
  keywords: string[];
  maxImages?: number;
  minWidth?: number;
  minHeight?: number;
  safeSearch?: string;
  language?: 'ko' | 'en';
  forceRefresh?: boolean; // Bypass cache and force fresh search
}

interface ImageCandidate {
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

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: ImageSearchRequest = await request.json();
    const {
      generationId,
      keywords,
      maxImages = 20,
      minWidth = 300,
      minHeight = 200,
      safeSearch = 'medium',
      language = 'ko',
      forceRefresh = false,
    } = body;

    // Map language to Google CSE parameters
    const languageMapping = {
      ko: { gl: 'kr', hl: 'ko' },
      en: { gl: 'us', hl: 'en' },
    };
    const { gl, hl } = languageMapping[language];

    // Check if Google Search is configured
    if (!isGoogleSearchConfigured()) {
      console.warn('Google Custom Search API not configured');
      return NextResponse.json({
        candidates: [],
        totalFound: 0,
        filtered: 0,
        filterReasons: {},
        cacheStats: { cached: 0, fresh: 0 },
        message: 'Google Custom Search API not configured.'
      });
    }

    // =====================================================
    // FORCE REFRESH - Clear cache if requested
    // =====================================================
    if (forceRefresh) {
      console.log(`[Image Search] 🔄 Force refresh requested - clearing cache for ${keywords.length} keywords`);
      await clearKeywordCache(keywords, language);
    }

    // =====================================================
    // PER-KEYWORD CACHE CHECK
    // =====================================================
    const { cached: cachedResults, uncached: uncachedKeywords } = await getKeywordCacheResults(
      keywords,
      language
    );

    console.log(`[Image Search] Cache status: ${cachedResults.length} cached, ${uncachedKeywords.length} uncached`);

    // Collect all candidates (cached + fresh)
    const allCandidates: ImageCandidate[] = [];

    // Add cached results
    for (const result of cachedResults) {
      for (const candidate of result.candidates) {
        allCandidates.push({
          ...candidate,
          id: `${generationId}-img-${allCandidates.length}`,
          sortOrder: allCandidates.length,
        });
      }
    }

    // =====================================================
    // FETCH UNCACHED KEYWORDS FROM API
    // =====================================================
    let freshResultsCount = 0;
    let filteredCount = 0;
    let blockedCount = 0;
    let lowResCount = 0;

    if (uncachedKeywords.length > 0) {
      console.log(`[Image Search] 🌐 Calling Google API for: ${uncachedKeywords.join(', ')}`);

      // Search for each uncached keyword separately (for individual caching)
      for (const keyword of uncachedKeywords) {
        const searchResults = await searchImagesMultiQuery([keyword], {
          maxResultsPerQuery: 15,
          totalMaxResults: 30,
          safeSearch: safeSearch as "off" | "medium" | "high",
          imageSize: "huge",
          gl,
          hl,
        });

        // Process results for this keyword
        const keywordCandidates: ImageCandidate[] = [];
        const blockedDomains = [
          'lookaside.fbsbx.com', 'scontent-',
          'vecteezy.com', 'dreamstime.com', '123rf.com', 'depositphotos.com',
          'bigstockphoto.com', 'canstockphoto.com', 'vectorstock.com', 'freepik.com',
          'stock.adobe.com',
        ];

        for (const result of searchResults) {
          // Skip blocked domains
          if (blockedDomains.some(d => result.link?.includes(d))) {
            blockedCount++;
            filteredCount++;
            continue;
          }

          const width = result.image?.width || 0;
          const height = result.image?.height || 0;

          // Skip very small images
          if (width < 100 || height < 100) {
            lowResCount++;
            filteredCount++;
            continue;
          }

          keywordCandidates.push({
            id: `cached-img-${keywordCandidates.length}`,
            sourceUrl: result.link,
            thumbnailUrl: result.image?.thumbnailLink || result.link,
            sourceTitle: result.title,
            sourceDomain: result.displayLink,
            width,
            height,
            isSelected: true,
            sortOrder: keywordCandidates.length,
            qualityScore: calculateQualityScore(result, minWidth, minHeight),
          });
        }

        // Sort by quality
        keywordCandidates.sort((a, b) => b.qualityScore - a.qualityScore);

        // Store in cache (7-day TTL)
        if (keywordCandidates.length > 0) {
          await setKeywordCacheResult(
            keyword,
            keywordCandidates as CacheImageCandidate[],
            language
          );
        }

        // Add to all candidates
        for (const candidate of keywordCandidates) {
          allCandidates.push({
            ...candidate,
            id: `${generationId}-img-${allCandidates.length}`,
            sortOrder: allCandidates.length,
          });
        }

        freshResultsCount += keywordCandidates.length;
      }
    }

    // =====================================================
    // DEDUPLICATE BY URL
    // =====================================================
    const seenUrls = new Set<string>();
    const uniqueCandidates: ImageCandidate[] = [];

    for (const candidate of allCandidates) {
      if (!seenUrls.has(candidate.sourceUrl)) {
        seenUrls.add(candidate.sourceUrl);
        uniqueCandidates.push({
          ...candidate,
          id: `${generationId}-img-${uniqueCandidates.length}`,
          sortOrder: uniqueCandidates.length,
        });
      }
    }

    // Sort by quality score
    uniqueCandidates.sort((a, b) => b.qualityScore - a.qualityScore);

    // Re-assign sort order after sorting
    uniqueCandidates.forEach((c, idx) => {
      c.sortOrder = idx;
    });

    // Limit to maxImages
    const finalCandidates = uniqueCandidates.slice(0, maxImages);

    console.log(`[Image Search] Results: ${finalCandidates.length} total (${cachedResults.length} keywords cached, ${uncachedKeywords.length} fresh)`);

    return NextResponse.json({
      candidates: finalCandidates,
      totalFound: allCandidates.length,
      filtered: filteredCount,
      filterReasons: {
        blocked_domain: blockedCount,
        low_resolution: lowResCount,
        duplicate: allCandidates.length - uniqueCandidates.length,
      },
      cacheStats: {
        cachedKeywords: cachedResults.map(r => r.keyword),
        freshKeywords: uncachedKeywords,
        cached: cachedResults.length,
        fresh: uncachedKeywords.length,
      },
      fromCache: uncachedKeywords.length === 0,
    });
  } catch (error) {
    console.error('Image search error:', error);
    return NextResponse.json(
      { detail: 'Failed to search images' },
      { status: 500 }
    );
  }
}

function calculateQualityScore(
  result: ImageSearchResult,
  minWidth: number,
  minHeight: number
): number {
  let score = 0.5;

  const width = result.image?.width || 0;
  const height = result.image?.height || 0;
  const resolution = width * height;

  // Higher resolution = higher score (max 0.4)
  if (resolution > 4000000) score += 0.4;
  else if (resolution > 2000000) score += 0.3;
  else if (resolution > 1000000) score += 0.15;
  else score += 0.05;

  // Aspect ratio bonus for vertical images (good for TikTok/Reels)
  const aspectRatio = height / width;
  if (aspectRatio >= 1.5 && aspectRatio <= 2.0) {
    score += 0.1;
  } else if (aspectRatio >= 0.5 && aspectRatio <= 0.7) {
    score += 0.05;
  }

  // Has thumbnail = likely valid
  if (result.image?.thumbnailLink) score += 0.05;

  // Known good domains
  const domain = result.displayLink?.toLowerCase() || '';
  const goodDomains = [
    'pinterest.com', 'instagram.com', 'twitter.com', 'x.com',
    'billboard.com', 'rollingstone.com', 'cmt.com',
  ];

  if (goodDomains.some(d => domain.includes(d))) {
    score += 0.1;
  }

  // Heavy penalty for stock photo sites
  const stockSites = [
    'shutterstock', 'gettyimages', 'istockphoto', 'alamy',
    'vecteezy', 'dreamstime', '123rf', 'depositphotos',
  ];
  if (stockSites.some(s => domain.includes(s))) {
    score -= 0.5;
  }

  // Heavy penalty for hotlink-protected domains
  const protectedDomains = [
    'lookaside.instagram.com', 'lookaside.fbsbx.com',
    'scontent.instagram.com', 'scontent-',
    'tiktok.com/api', 'tiktokcdn.com',
  ];
  if (protectedDomains.some(d => result.link?.includes(d))) {
    score -= 0.5;
  }

  return Math.max(0, Math.min(score, 1));
}
