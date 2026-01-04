import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import {
  searchImagesMultiQuery,
  isGoogleSearchConfigured,
} from "@/lib/google-search";
import {
  getKeywordCacheResults,
  setKeywordCacheResult,
  clearKeywordCache,
  type ImageCandidate as CacheImageCandidate,
} from "@/lib/image-cache";

interface RouteParams {
  params: Promise<{ id: string }>;
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
  isOriginal?: boolean; // True if this is from the original generation
}

// Get keywords from metadata or extract from prompt
function extractKeywords(
  metadata: Record<string, unknown> | null,
  prompt: string,
  trendKeywords?: string[] | null
): string[] {
  // Priority 1: trendKeywords from DB
  if (trendKeywords && Array.isArray(trendKeywords) && trendKeywords.length > 0) {
    return trendKeywords.slice(0, 10);
  }

  // Priority 2: fastCutData.searchKeywords
  const fastCutData = metadata?.fastCutData as Record<string, unknown> | null;
  if (fastCutData?.searchKeywords && Array.isArray(fastCutData.searchKeywords)) {
    return (fastCutData.searchKeywords as string[]).slice(0, 10);
  }

  // Priority 3: composeData.keywords
  const composeData = metadata?.composeData as Record<string, unknown> | null;
  if (composeData?.keywords && Array.isArray(composeData.keywords)) {
    return (composeData.keywords as string[]).slice(0, 10);
  }

  // Fallback: extract from prompt
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "video", "image", "photo", "style", "vibe", "mood", "compose", "variation",
  ]);

  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)].slice(0, 5);
}

// Calculate quality score for images
function calculateQualityScore(
  width: number,
  height: number,
  domain?: string
): number {
  let score = 0.5;

  const resolution = width * height;
  if (resolution > 4000000) score += 0.4;
  else if (resolution > 2000000) score += 0.3;
  else if (resolution > 1000000) score += 0.15;
  else score += 0.05;

  // Aspect ratio bonus for vertical
  const aspectRatio = height / width;
  if (aspectRatio >= 1.5 && aspectRatio <= 2.0) {
    score += 0.1;
  }

  // Good domains bonus
  const goodDomains = ['pinterest.com', 'instagram.com', 'twitter.com', 'x.com'];
  if (domain && goodDomains.some(d => domain.includes(d))) {
    score += 0.1;
  }

  return Math.max(0, Math.min(score, 1));
}

/**
 * GET /api/v1/generations/[id]/variation-images
 *
 * Returns original images + web search images for variation image selection
 * Query params:
 * - maxImages: Max web search images (default 50)
 * - forceRefresh: Bypass cache (default false)
 * - additionalKeywords: Comma-separated additional keywords
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;
    const { searchParams } = new URL(request.url);
    const maxImages = parseInt(searchParams.get("maxImages") || "50");
    const forceRefresh = searchParams.get("forceRefresh") === "true";
    const additionalKeywordsParam = searchParams.get("additionalKeywords");
    const additionalKeywords = additionalKeywordsParam
      ? additionalKeywordsParam.split(",").map(k => k.trim()).filter(Boolean)
      : [];

    // Fetch generation
    const generation = await withRetry(() => prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    }));

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    // Check access
    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    const metadata = generation.qualityMetadata as Record<string, unknown> | null;

    // =========================================
    // 1. Extract keywords
    // =========================================
    const baseKeywords = extractKeywords(metadata, generation.prompt, generation.trendKeywords);
    const allKeywords = [...new Set([...baseKeywords, ...additionalKeywords])];

    console.log(`[Variation Images] Generation: ${generationId}`);
    console.log(`[Variation Images] Keywords: ${allKeywords.join(", ")}`);

    // =========================================
    // 2. Get original images from seed generation
    // =========================================
    const originalImages: ImageCandidate[] = [];

    // From qualityMetadata.imageUrls
    if (metadata?.imageUrls && Array.isArray(metadata.imageUrls)) {
      (metadata.imageUrls as string[]).forEach((url, idx) => {
        originalImages.push({
          id: `original-${idx}`,
          sourceUrl: url,
          thumbnailUrl: url,
          sourceTitle: "Original Image",
          sourceDomain: "Original",
          width: 1920, // Assume HD
          height: 1080,
          isSelected: true,
          sortOrder: idx,
          qualityScore: 1.0, // Original images get max score
          isOriginal: true,
        });
      });
    }

    // From imageAssets array
    if (generation.imageAssets && Array.isArray(generation.imageAssets)) {
      const imageAssets = generation.imageAssets as Array<{
        url?: string;
        s3Url?: string;
        width?: number;
        height?: number;
        originalFilename?: string;
      }>;

      imageAssets.forEach((asset, idx) => {
        const url = asset.url || asset.s3Url;
        if (url && !originalImages.some(img => img.sourceUrl === url)) {
          originalImages.push({
            id: `original-asset-${idx}`,
            sourceUrl: url,
            thumbnailUrl: url,
            sourceTitle: asset.originalFilename || "Original Image",
            sourceDomain: "Original",
            width: asset.width || 1920,
            height: asset.height || 1080,
            isSelected: true,
            sortOrder: originalImages.length,
            qualityScore: 1.0,
            isOriginal: true,
          });
        }
      });
    }

    console.log(`[Variation Images] Original images found: ${originalImages.length}`);

    // =========================================
    // 3. Search web images
    // =========================================
    const searchedImages: ImageCandidate[] = [];

    if (!isGoogleSearchConfigured()) {
      console.warn("[Variation Images] Google Search not configured");
    } else if (allKeywords.length > 0) {
      // Force refresh if requested
      if (forceRefresh) {
        await clearKeywordCache(allKeywords, "ko");
      }

      // Check cache
      const { cached: cachedResults, uncached: uncachedKeywords } = await getKeywordCacheResults(
        allKeywords,
        "ko"
      );

      console.log(`[Variation Images] Cache: ${cachedResults.length} cached, ${uncachedKeywords.length} uncached`);

      // Add cached results
      for (const result of cachedResults) {
        for (const candidate of result.candidates) {
          if (!searchedImages.some(img => img.sourceUrl === candidate.sourceUrl)) {
            searchedImages.push({
              ...candidate,
              id: `search-${searchedImages.length}`,
              sortOrder: searchedImages.length,
              isOriginal: false,
              isSelected: false,
            });
          }
        }
      }

      // Fetch uncached keywords
      if (uncachedKeywords.length > 0) {
        const blockedDomains = [
          'lookaside.fbsbx.com', 'scontent-',
          'shutterstock.com', 'gettyimages.com', 'istockphoto.com', 'alamy.com',
          'vecteezy.com', 'dreamstime.com', '123rf.com', 'depositphotos.com',
          'bigstockphoto.com', 'canstockphoto.com', 'vectorstock.com', 'freepik.com',
          'stock.adobe.com', 'pond5.com', 'pixta.jp', 'envato.com', 'unsplash.com',
        ];

        for (const keyword of uncachedKeywords) {
          try {
            const results = await searchImagesMultiQuery([keyword], {
              maxResultsPerQuery: 15,
              totalMaxResults: 30,
              safeSearch: "medium",
              imageSize: "huge",
              gl: "kr",
              hl: "ko",
            });

            const keywordCandidates: ImageCandidate[] = [];

            for (const result of results) {
              if (blockedDomains.some(d => result.link?.includes(d))) continue;

              const width = result.image?.width || 0;
              const height = result.image?.height || 0;
              if (width < 100 || height < 100) continue;

              keywordCandidates.push({
                id: `search-${searchedImages.length + keywordCandidates.length}`,
                sourceUrl: result.link,
                thumbnailUrl: result.image?.thumbnailLink || result.link,
                sourceTitle: result.title,
                sourceDomain: result.displayLink,
                width,
                height,
                isSelected: false,
                sortOrder: searchedImages.length + keywordCandidates.length,
                qualityScore: calculateQualityScore(width, height, result.displayLink),
                isOriginal: false,
              });
            }

            // Cache results
            if (keywordCandidates.length > 0) {
              await setKeywordCacheResult(
                keyword,
                keywordCandidates as CacheImageCandidate[],
                "ko"
              );
            }

            // Add to searched images
            for (const candidate of keywordCandidates) {
              if (!searchedImages.some(img => img.sourceUrl === candidate.sourceUrl)) {
                searchedImages.push(candidate);
              }
            }
          } catch (err) {
            console.error(`[Variation Images] Search failed for "${keyword}":`, err);
          }
        }
      }
    }

    // Sort by quality and limit
    searchedImages.sort((a, b) => b.qualityScore - a.qualityScore);
    const limitedSearchImages = searchedImages.slice(0, maxImages);

    // Re-assign sort order
    limitedSearchImages.forEach((img, idx) => {
      img.sortOrder = idx;
    });

    console.log(`[Variation Images] Returning ${originalImages.length} original + ${limitedSearchImages.length} searched`);

    return NextResponse.json({
      generationId,
      keywords: allKeywords,
      originalImages,
      searchedImages: limitedSearchImages,
      totalOriginal: originalImages.length,
      totalSearched: limitedSearchImages.length,
    });
  } catch (error) {
    console.error("Get variation images error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/generations/[id]/variation-images
 *
 * Search with custom keywords (for adding new keywords)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: generationId } = await params;
    const body = await request.json();
    const { keywords, maxImages = 30, forceRefresh = false } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ detail: "Keywords required" }, { status: 400 });
    }

    // Verify generation exists and user has access
    const generation = await withRetry(() => prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        campaign: {
          include: {
            artist: { select: { labelId: true } },
          },
        },
      },
    }));

    if (!generation) {
      return NextResponse.json({ detail: "Generation not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN") {
      if (generation.campaign) {
        if (!user.labelIds.includes(generation.campaign.artist.labelId)) {
          return NextResponse.json({ detail: "Access denied" }, { status: 403 });
        }
      } else if (generation.createdBy !== user.id) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    // Search for new keywords
    if (!isGoogleSearchConfigured()) {
      return NextResponse.json({
        candidates: [],
        message: "Google Search not configured",
      });
    }

    if (forceRefresh) {
      await clearKeywordCache(keywords, "ko");
    }

    const { cached: cachedResults, uncached: uncachedKeywords } = await getKeywordCacheResults(
      keywords,
      "ko"
    );

    const candidates: ImageCandidate[] = [];

    // Add cached results
    for (const result of cachedResults) {
      for (const candidate of result.candidates) {
        if (!candidates.some(c => c.sourceUrl === candidate.sourceUrl)) {
          candidates.push({
            ...candidate,
            id: `search-${candidates.length}`,
            sortOrder: candidates.length,
            isOriginal: false,
            isSelected: false,
          });
        }
      }
    }

    // Fetch uncached
    if (uncachedKeywords.length > 0) {
      const blockedDomains = [
        'lookaside.fbsbx.com', 'scontent-',
        'shutterstock.com', 'gettyimages.com', 'istockphoto.com', 'alamy.com',
        'freepik.com', 'stock.adobe.com', 'unsplash.com',
      ];

      for (const keyword of uncachedKeywords) {
        try {
          const results = await searchImagesMultiQuery([keyword], {
            maxResultsPerQuery: 15,
            totalMaxResults: 30,
            safeSearch: "medium",
            imageSize: "huge",
            gl: "kr",
            hl: "ko",
          });

          const keywordCandidates: ImageCandidate[] = [];

          for (const result of results) {
            if (blockedDomains.some(d => result.link?.includes(d))) continue;

            const width = result.image?.width || 0;
            const height = result.image?.height || 0;
            if (width < 100 || height < 100) continue;

            keywordCandidates.push({
              id: `search-${candidates.length + keywordCandidates.length}`,
              sourceUrl: result.link,
              thumbnailUrl: result.image?.thumbnailLink || result.link,
              sourceTitle: result.title,
              sourceDomain: result.displayLink,
              width,
              height,
              isSelected: false,
              sortOrder: candidates.length + keywordCandidates.length,
              qualityScore: calculateQualityScore(width, height, result.displayLink),
              isOriginal: false,
            });
          }

          // Cache
          if (keywordCandidates.length > 0) {
            await setKeywordCacheResult(
              keyword,
              keywordCandidates as CacheImageCandidate[],
              "ko"
            );
          }

          for (const c of keywordCandidates) {
            if (!candidates.some(existing => existing.sourceUrl === c.sourceUrl)) {
              candidates.push(c);
            }
          }
        } catch (err) {
          console.error(`[Variation Images] Search failed for "${keyword}":`, err);
        }
      }
    }

    // Sort and limit
    candidates.sort((a, b) => b.qualityScore - a.qualityScore);
    const limited = candidates.slice(0, maxImages);
    limited.forEach((c, idx) => { c.sortOrder = idx; });

    return NextResponse.json({
      keywords,
      candidates: limited,
      totalFound: candidates.length,
    });
  } catch (error) {
    console.error("Search variation images error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
