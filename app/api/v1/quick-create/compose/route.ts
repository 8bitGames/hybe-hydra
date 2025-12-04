import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchImagesMultiQuery, isGoogleSearchConfigured, ImageSearchResult } from '@/lib/google-search';
import { uploadToS3 } from '@/lib/storage';

const GOOGLE_API_KEY = process.env.GOOGLE_AI_API_KEY || '';
const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.MINIO_BUCKET_NAME || 'hydra-assets-hybe';
const MODAL_SUBMIT_URL = process.env.MODAL_SUBMIT_URL;
const MODAL_CALLBACK_SECRET = process.env.MODAL_CALLBACK_SECRET || 'hydra-modal-callback-secret';

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

// Generate script using Gemini AI (simplified for Quick Create)
async function generateQuickScript(prompt: string): Promise<ScriptResult> {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });

  const systemPrompt = `You are a creative director for short-form video content. Generate a video script based on the user's concept.

User's Video Concept: ${prompt}
Target Duration: 15 seconds

Generate a JSON response with this structure:
{
  "script": {
    "lines": [
      { "text": "HOOK TEXT", "timing": 0, "duration": 2 },
      { "text": "Setup line", "timing": 2, "duration": 2.5 },
      { "text": "Build up", "timing": 4.5, "duration": 2.5 },
      { "text": "Key point", "timing": 7, "duration": 2.5 },
      { "text": "Climax", "timing": 9.5, "duration": 2.5 },
      { "text": "Call to action", "timing": 12, "duration": 3 }
    ],
    "totalDuration": 15
  },
  "vibe": "One of: Exciting, Emotional, Pop, Minimal",
  "searchKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"],
  "effectPreset": "One of: zoom_beat, crossfade, bounce, minimal"
}

Rules:
1. FIRST LINE must be a HOOK (curiosity-inducing, 2-4 words): "Wait for it...", "POV:", "This is insane"
2. Script lines should be SHORT (3-8 words) for TikTok style
3. Generate 5-8 script lines total
4. Search keywords should be relevant to the concept for image search
5. Choose vibe based on content mood
6. Return ONLY JSON`;

  const result = await model.generateContent(systemPrompt);
  const response = result.response.text();

  try {
    // Extract JSON from response
    let jsonStr = response;
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      const startIdx = response.indexOf('{');
      const endIdx = response.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = response.substring(startIdx, endIdx + 1);
      }
    }

    const parsed = JSON.parse(jsonStr);
    return {
      lines: parsed.script?.lines || [],
      totalDuration: parsed.script?.totalDuration || 15,
      vibe: parsed.vibe || 'Pop',
      searchKeywords: parsed.searchKeywords || [],
      effectPreset: parsed.effectPreset || 'bounce',
    };
  } catch {
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
}

// Search and proxy images
async function searchAndProxyImages(
  generationId: string,
  keywords: string[]
): Promise<Array<{ url: string; order: number }>> {
  if (!isGoogleSearchConfigured()) {
    throw new Error('Google Custom Search API not configured');
  }

  // Search images
  const searchResults = await searchImagesMultiQuery(keywords, {
    maxResultsPerQuery: 4,
    totalMaxResults: 15,
    safeSearch: 'medium',
  });

  console.log(`[Quick Compose] Found ${searchResults.length} images`);

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

  // Proxy images to S3
  const proxiedImages: Array<{ url: string; order: number }> = [];

  await Promise.all(
    validResults.map(async (result: ImageSearchResult, index: number) => {
      try {
        const response = await fetch(result.link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'Referer': new URL(result.link).origin + '/',
          },
        });

        if (!response.ok) {
          console.warn(`[Quick Compose] Failed to fetch image: ${result.link.slice(0, 50)}...`);
          return;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';

        const objectKey = `compose/${generationId}/images/${index}_${uuidv4().slice(0, 8)}.${ext}`;
        const s3Url = await uploadToS3(buffer, objectKey, contentType);

        proxiedImages.push({
          url: s3Url,
          order: index,
        });
      } catch (error) {
        console.warn(`[Quick Compose] Image proxy error: ${error}`);
      }
    })
  );

  // Sort by order
  proxiedImages.sort((a, b) => a.order - b.order);

  console.log(`[Quick Compose] Proxied ${proxiedImages.length} images`);
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
