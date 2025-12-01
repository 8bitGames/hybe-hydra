import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import {
  searchImagesMultiQuery,
  isGoogleSearchConfigured,
  ImageSearchResult
} from '@/lib/google-search';

interface ImageSearchRequest {
  generationId: string;
  keywords: string[];
  maxImages?: number;
  minWidth?: number;
  minHeight?: number;
  safeSearch?: string;
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
      minWidth = 300,  // Very low threshold - quality score handles prioritization
      minHeight = 200,  // Allow landscape images (most Google results are wide)
      safeSearch = 'medium'
    } = body;

    // Check if Google Search is configured
    if (!isGoogleSearchConfigured()) {
      console.warn('Google Custom Search API not configured');
      return NextResponse.json({
        candidates: [],
        totalFound: 0,
        filtered: 0,
        filterReasons: {},
        message: 'Google Custom Search API not configured. Please set GOOGLE_CSE_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables.'
      });
    }

    // Search images using multiple keywords for better coverage
    const searchResults = await searchImagesMultiQuery(keywords, {
      maxResultsPerQuery: Math.ceil(maxImages / keywords.length) + 2,
      totalMaxResults: maxImages * 2, // Get more to filter
      safeSearch: safeSearch as "off" | "medium" | "high",
    });

    // Debug: log search results
    console.log(`[Image Search] Keywords: ${keywords.join(', ')}`);
    console.log(`[Image Search] Total found: ${searchResults.length}`);
    console.log(`[Image Search] Filter threshold: ${minWidth}x${minHeight}`);

    // Filter by minimum dimensions and calculate quality scores
    let filteredCount = 0;
    const candidates: ImageCandidate[] = [];

    // Domains that block hotlinking - skip entirely
    const blockedDomains = [
      'lookaside.instagram.com',
      'lookaside.fbsbx.com',
      'scontent.instagram.com',
      'scontent-',
      'tiktok.com/api',
      'tiktokcdn.com',
    ];

    for (let i = 0; i < searchResults.length && candidates.length < maxImages; i++) {
      const result = searchResults[i];

      // Skip hotlink-protected URLs entirely
      if (blockedDomains.some(d => result.link?.includes(d))) {
        console.log(`[Image Search] Skipping blocked domain: ${result.link?.substring(0, 50)}...`);
        filteredCount++;
        continue;
      }

      const width = result.image?.width || 0;
      const height = result.image?.height || 0;

      // Filter by minimum dimensions
      if (width < minWidth || height < minHeight) {
        filteredCount++;
        continue;
      }

      candidates.push({
        id: `${generationId}-img-${candidates.length}`,
        sourceUrl: result.link,
        thumbnailUrl: result.image?.thumbnailLink || result.link,
        sourceTitle: result.title,
        sourceDomain: result.displayLink,
        width,
        height,
        isSelected: true,
        sortOrder: candidates.length,
        qualityScore: calculateQualityScore(result, minWidth, minHeight),
      });
    }

    // Sort by quality score
    candidates.sort((a, b) => b.qualityScore - a.qualityScore);

    // Update sort order after sorting
    candidates.forEach((c, idx) => {
      c.sortOrder = idx;
    });

    return NextResponse.json({
      candidates,
      totalFound: searchResults.length,
      filtered: filteredCount,
      filterReasons: {
        low_resolution: filteredCount
      }
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
  // Prioritize high-res images for better video quality
  if (resolution > 4000000) score += 0.4; // 4MP+ (e.g., 2000x2000)
  else if (resolution > 2000000) score += 0.3; // 2MP+ (e.g., 1414x1414)
  else if (resolution > 1000000) score += 0.15; // 1MP+ (e.g., 1000x1000)
  else score += 0.05; // Lower resolution penalty

  // Aspect ratio bonus for vertical images (good for TikTok/Reels)
  const aspectRatio = height / width;
  if (aspectRatio >= 1.5 && aspectRatio <= 2.0) {
    score += 0.1; // Ideal for 9:16
  } else if (aspectRatio >= 0.5 && aspectRatio <= 0.7) {
    score += 0.05; // Good for 16:9
  }

  // Has thumbnail = likely valid
  if (result.image?.thumbnailLink) score += 0.05;

  // Known good domains for country music content
  const domain = result.displayLink?.toLowerCase() || '';
  const goodDomains = [
    'pinterest.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'billboard.com',
    'rollingstone.com',
    'cmt.com',
    'nashvillelifestyles.com',
    'tasteofcountry.com',
    'theboot.com',
    'sounds-like-nashville.com',
    'countrymusictattletale.com',
  ];

  if (goodDomains.some(d => domain.includes(d))) {
    score += 0.1;
  }

  // Penalty for generic stock photo sites
  const stockSites = ['shutterstock', 'gettyimages', 'istockphoto', 'alamy'];
  if (stockSites.some(s => domain.includes(s))) {
    score -= 0.2;
  }

  // Heavy penalty for hotlink-protected domains (usually fail to download)
  const protectedDomains = [
    'lookaside.instagram.com',
    'lookaside.fbsbx.com',
    'scontent.instagram.com',
    'scontent-',  // Facebook CDN
    'tiktok.com/api',
    'tiktokcdn.com',
  ];
  if (protectedDomains.some(d => result.link?.includes(d))) {
    score -= 0.5;  // Heavy penalty - likely to fail
  }

  return Math.max(0, Math.min(score, 1));
}
