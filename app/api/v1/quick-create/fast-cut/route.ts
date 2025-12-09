import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { searchImagesMultiQuery, isGoogleSearchConfigured, ImageSearchResult } from '@/lib/google-search';
import { uploadToS3 } from '@/lib/storage';
import crypto from 'crypto';
import {
  createFastCutScriptGeneratorAgent,
  type FastCutScriptGeneratorAgent,
} from '@/lib/agents/fast-cut/script-generator';
import type { AgentContext } from '@/lib/agents/types';
import {
  generateSearchCacheKey,
  getCachedSearchResults,
  setCachedSearchResults,
  getOrCheckImageCache,
  setCachedImage,
  generateContentHash,
} from '@/lib/image-cache';

// Simple hash function for unique filenames
function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
}

const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.MINIO_BUCKET_NAME || 'hydra-assets-hybe';
const MODAL_SUBMIT_URL = process.env.MODAL_SUBMIT_URL;
const MODAL_CALLBACK_SECRET = process.env.MODAL_CALLBACK_SECRET || 'hydra-modal-callback-secret';

// Singleton agent instance
let scriptAgent: FastCutScriptGeneratorAgent | null = null;

function getScriptAgent(): FastCutScriptGeneratorAgent {
  if (!scriptAgent) {
    scriptAgent = createFastCutScriptGeneratorAgent();
  }
  return scriptAgent;
}

interface QuickComposeRequest {
  prompt: string;
  aspect_ratio?: string;  // Default: 9:16
}

interface ScriptLine {
  text: string;
  timing: number;
  duration: number;
}

interface ScriptResult {
  lines: ScriptLine[];
  totalDuration: number;
  vibe: string;
  searchKeywords: string[];
  effectPreset: string;
}

// Get callback URL for Modal
function getCallbackUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hydra-sand-theta.vercel.app';
  return `${baseUrl}/api/v1/compose/callback`;
}

// Generate script using ComposeScriptGeneratorAgent
async function generateQuickScript(prompt: string, language: 'ko' | 'en' = 'ko'): Promise<ScriptResult> {
  const agent = getScriptAgent();

  // Create agent context for quick compose
  const agentContext: AgentContext = {
    workflow: {
      artistName: 'Quick Create',
      platform: 'tiktok',
      language,
      sessionId: `quick-compose-${Date.now()}`,
    },
  };

  // Call the agent with simplified input
  const result = await agent.generateScript(
    {
      artistName: 'Quick Create',
      userPrompt: prompt,
      targetDuration: 15,
      trendKeywords: [],
      useGrounding: false,
      language,
    },
    agentContext
  );

  if (!result.success || !result.data) {
    // Return fallback script
    return {
      lines: [
        { text: 'Wait for it...', timing: 0, duration: 2 },
        { text: prompt.slice(0, 30) || 'Something amazing', timing: 2, duration: 3 },
        { text: 'You need to see this', timing: 5, duration: 3 },
        { text: 'This is incredible', timing: 8, duration: 3 },
        { text: 'Follow for more!', timing: 11, duration: 4 },
      ],
      totalDuration: 15,
      vibe: 'Pop',
      searchKeywords: prompt.split(' ').slice(0, 6).filter(w => w.length > 2),
      effectPreset: 'bounce',
    };
  }

  const { script, vibe, searchKeywords, effectRecommendation } = result.data;

  return {
    lines: script.lines.map((line) => ({
      text: line.text,
      timing: line.timing,
      duration: line.duration,
    })),
    totalDuration: script.totalDuration,
    vibe: vibe,
    searchKeywords: searchKeywords || [],
    effectPreset: effectRecommendation || 'bounce',
  };
}

// Search and proxy images with caching
async function searchAndProxyImages(
  generationId: string,
  keywords: string[]
): Promise<Array<{ url: string; order: number }>> {
  if (!isGoogleSearchConfigured()) {
    throw new Error('Google Custom Search API not configured');
  }

  // =====================================================
  // STEP 1: Check search cache first
  // =====================================================
  const cacheKey = generateSearchCacheKey(keywords, { maxImages: 15, safeSearch: 'medium' });
  let searchResults: ImageSearchResult[] = [];
  let fromSearchCache = false;

  const cachedSearch = await getCachedSearchResults(cacheKey);
  if (cachedSearch && Array.isArray(cachedSearch.candidates)) {
    console.log(`[Quick Compose] ✅ Search cache HIT for: ${keywords.join(', ')}`);
    fromSearchCache = true;
    // Map cached candidates back to ImageSearchResult format
    searchResults = (cachedSearch.candidates as Array<{ sourceUrl: string; width: number; height: number; thumbnailUrl: string; sourceTitle?: string; sourceDomain?: string }>).map(c => ({
      link: c.sourceUrl,
      title: c.sourceTitle || '',
      displayLink: c.sourceDomain || '',
      image: {
        width: c.width,
        height: c.height,
        thumbnailLink: c.thumbnailUrl,
        contextLink: '',
        thumbnailWidth: 0,
        thumbnailHeight: 0,
      },
    }));
  } else {
    console.log(`[Quick Compose] ❌ Search cache MISS - calling Google API for: ${keywords.join(', ')}`);
    searchResults = await searchImagesMultiQuery(keywords, {
      maxResultsPerQuery: 4,
      totalMaxResults: 15,
      safeSearch: 'medium',
    });
  }

  console.log(`[Quick Compose] Found ${searchResults.length} images (fromCache: ${fromSearchCache})`);

  // Filter by dimensions and quality
  const minWidth = 400;
  const minHeight = 300;
  const blockedDomains = [
    'lookaside.instagram.com',
    'lookaside.fbsbx.com',
    'scontent.instagram.com',
    'scontent-',
    'tiktok.com/api',
    'tiktokcdn.com',
  ];

  const validResults = searchResults.filter((result: ImageSearchResult) => {
    const width = result.image?.width || 0;
    const height = result.image?.height || 0;
    if (width < minWidth || height < minHeight) return false;
    if (blockedDomains.some(d => result.link?.includes(d))) return false;
    return true;
  }).slice(0, 8); // Take top 8

  console.log(`[Quick Compose] After filtering: ${validResults.length} images`);

  // Store in search cache if not already cached
  if (!fromSearchCache && validResults.length > 0) {
    const candidates = validResults.map((r, idx) => ({
      id: `cached-img-${idx}`,
      sourceUrl: r.link,
      thumbnailUrl: r.image?.thumbnailLink || r.link,
      sourceTitle: r.title,
      sourceDomain: r.displayLink,
      width: r.image?.width || 0,
      height: r.image?.height || 0,
      isSelected: true,
      sortOrder: idx,
      qualityScore: 0.5,
    }));
    setCachedSearchResults(
      cacheKey,
      keywords,
      { candidates, totalFound: searchResults.length, filtered: searchResults.length - validResults.length, filterReasons: {} },
      { maxImages: 15, safeSearch: 'medium' }
    ).catch(err => console.warn('[Quick Compose] Search cache store failed:', err));
  }

  // =====================================================
  // STEP 2: Proxy images with deduplication
  // =====================================================
  const proxiedImages: Array<{ url: string; order: number }> = [];
  let imageCacheHits = 0;
  let imageCacheMisses = 0;

  await Promise.all(
    validResults.map(async (result: ImageSearchResult, index: number) => {
      try {
        // Check image cache first (by URL)
        const urlCacheCheck = await getOrCheckImageCache(result.link);
        if (urlCacheCheck.cached) {
          imageCacheHits++;
          console.log(`[Quick Compose] ✅ Image cache HIT: ${result.link.slice(0, 50)}...`);
          proxiedImages.push({
            url: urlCacheCheck.s3Url,
            order: index,
          });
          return;
        }

        // Download image
        const response = await fetch(result.link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': new URL(result.link).origin + '/',
          },
        });

        if (!response.ok) {
          console.warn(`[Quick Compose] ❌ Failed to fetch (${response.status}): ${result.link.slice(0, 50)}...`);
          return;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Check content hash cache
        const contentHash = generateContentHash(buffer);
        const contentCacheCheck = await getOrCheckImageCache(result.link, buffer);
        if (contentCacheCheck.cached) {
          imageCacheHits++;
          console.log(`[Quick Compose] ✅ Content hash HIT: ${result.link.slice(0, 50)}...`);
          proxiedImages.push({
            url: contentCacheCheck.s3Url,
            order: index,
          });
          return;
        }

        // New image - upload to shared cache path
        imageCacheMisses++;
        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('gif')) ext = 'gif';

        const urlHash = hashUrl(result.link);
        const objectKey = `compose/cached/${urlHash}.${ext}`;
        const s3Url = await uploadToS3(buffer, objectKey, contentType);

        // Store in cache (fire and forget)
        setCachedImage({
          sourceUrl: result.link,
          contentHash,
          s3Url,
          s3Key: objectKey,
          mimeType: contentType,
          fileSize: buffer.length,
          width: result.image?.width,
          height: result.image?.height,
        }).catch(err => console.warn('[Quick Compose] Image cache store failed:', err));

        console.log(`[Quick Compose] 💾 NEW: ${result.link.slice(0, 50)}... → ${objectKey}`);
        proxiedImages.push({
          url: s3Url,
          order: index,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`[Quick Compose] ❌ Skipped (${errMsg}): ${result.link.slice(0, 50)}...`);
      }
    })
  );

  // Sort by order
  proxiedImages.sort((a, b) => a.order - b.order);

  console.log(`[Quick Compose] Proxied ${proxiedImages.length} images (cache hits: ${imageCacheHits}, new uploads: ${imageCacheMisses})`);
  return proxiedImages;
}

// Submit render to Modal (silent video - no audio)
async function submitSilentRender(params: {
  generationId: string;
  images: Array<{ url: string; order: number }>;
  script: ScriptLine[];
  vibe: string;
  effectPreset: string;
  aspectRatio: string;
  targetDuration: number;
}): Promise<{ call_id: string }> {
  if (!MODAL_SUBMIT_URL) {
    throw new Error('MODAL_SUBMIT_URL not configured');
  }

  const { generationId, images, script, vibe, effectPreset, aspectRatio, targetDuration } = params;

  const outputKey = `compose/renders/${generationId}/output.mp4`;

  // Submit render without audio (silent video)
  const renderRequest = {
    job_id: generationId,
    images: images.map(img => ({
      url: img.url,
      order: img.order,
    })),
    // No audio - render as silent video
    audio: null,
    script: script.length > 0 ? { lines: script } : null,
    settings: {
      vibe,
      effect_preset: effectPreset,
      aspect_ratio: aspectRatio,
      target_duration: targetDuration,
      text_style: 'bold_pop',
      color_grade: 'vibrant',
    },
    output: {
      s3_bucket: S3_BUCKET,
      s3_key: outputKey,
    },
    callback_url: getCallbackUrl(),
    callback_secret: MODAL_CALLBACK_SECRET,
    use_gpu: true,
  };

  console.log('[Quick Compose] Submitting silent render to Modal:', {
    job_id: generationId,
    images_count: images.length,
    script_lines: script.length,
    vibe,
    target_duration: targetDuration,
    silent: true,
  });

  const response = await fetch(MODAL_SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(renderRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Modal submit failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: QuickComposeRequest = await request.json();
    const { prompt, aspect_ratio = '9:16' } = body;

    if (!prompt || prompt.trim().length < 3) {
      return NextResponse.json(
        { detail: 'Prompt is required (min 3 characters)' },
        { status: 400 }
      );
    }

    const generationId = uuidv4();

    // Create initial database record
    await prisma.videoGeneration.create({
      data: {
        id: generationId,
        prompt: prompt.trim(),
        aspectRatio: aspect_ratio,
        durationSeconds: 15,
        status: 'PROCESSING',
        progress: 5,
        createdBy: user.id,
        isQuickCreate: true,
        qualityMetadata: {
          quickComposeStep: 'script',
          isQuickCompose: true,
        },
      },
    });

    // Step 1: Generate script (async)
    console.log('[Quick Compose] Step 1: Generating script...');

    let scriptResult: ScriptResult;
    try {
      scriptResult = await generateQuickScript(prompt.trim());
    } catch (error) {
      console.error('[Quick Compose] Script generation failed:', error);
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: 'FAILED',
          errorMessage: 'Script generation failed',
        },
      });
      return NextResponse.json({
        id: generationId,
        status: 'failed',
        progress: 0,
        error_message: 'Script generation failed',
      });
    }

    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        progress: 25,
        qualityMetadata: {
          quickComposeStep: 'images',
          isQuickCompose: true,
          script: JSON.parse(JSON.stringify(scriptResult)),
        },
      },
    });

    // Step 2: Search and proxy images
    console.log('[Quick Compose] Step 2: Searching images...');

    let images: Array<{ url: string; order: number }>;
    try {
      images = await searchAndProxyImages(generationId, scriptResult.searchKeywords);

      if (images.length < 3) {
        throw new Error(`Not enough images found (${images.length})`);
      }
    } catch (error) {
      console.error('[Quick Compose] Image search failed:', error);
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: 'FAILED',
          errorMessage: 'Image search failed',
        },
      });
      return NextResponse.json({
        id: generationId,
        status: 'failed',
        progress: 25,
        error_message: 'Image search failed',
      });
    }

    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        progress: 50,
        qualityMetadata: {
          quickComposeStep: 'render',
          isQuickCompose: true,
          script: JSON.parse(JSON.stringify(scriptResult)),
          imageCount: images.length,
        },
      },
    });

    // Step 3: Submit render
    console.log('[Quick Compose] Step 3: Submitting render...');

    let modalResponse: { call_id: string };
    try {
      modalResponse = await submitSilentRender({
        generationId,
        images,
        script: scriptResult.lines,
        vibe: scriptResult.vibe,
        effectPreset: scriptResult.effectPreset,
        aspectRatio: aspect_ratio,
        targetDuration: scriptResult.totalDuration,
      });
    } catch (error) {
      console.error('[Quick Compose] Render submit failed:', error);
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: 'FAILED',
          errorMessage: 'Render submission failed',
        },
      });
      return NextResponse.json({
        id: generationId,
        status: 'failed',
        progress: 50,
        error_message: 'Render submission failed',
      });
    }

    // Update with Modal call ID for polling
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        progress: 60,
        qualityMetadata: {
          quickComposeStep: 'render',
          isQuickCompose: true,
          script: JSON.parse(JSON.stringify(scriptResult)),
          imageCount: images.length,
          modalCallId: modalResponse.call_id,
        },
      },
    });

    console.log('[Quick Compose] Successfully started:', {
      generationId,
      callId: modalResponse.call_id,
      vibe: scriptResult.vibe,
      scriptLines: scriptResult.lines.length,
      imageCount: images.length,
    });

    return NextResponse.json({
      id: generationId,
      status: 'processing',
      progress: 60,
      script_lines: scriptResult.lines.length,
      image_count: images.length,
      vibe: scriptResult.vibe,
      output_url: null,
    });

  } catch (error) {
    console.error('[Quick Compose] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Quick compose failed' },
      { status: 500 }
    );
  }
}
