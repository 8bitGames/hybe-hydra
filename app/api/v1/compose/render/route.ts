import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { inngest } from '@/lib/inngest/client';

const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || 'http://localhost:8001';
const S3_BUCKET = process.env.MINIO_BUCKET_NAME || 'hydra-assets';
const USE_INNGEST = process.env.USE_INNGEST_COMPOSE === 'true';

interface RenderRequest {
  generationId: string;
  campaignId: string;
  audioAssetId: string;
  images: Array<{
    url: string;
    order: number;
  }>;
  script?: {
    lines: Array<{
      text: string;
      timing: number;
      duration: number;
    }>;
  };
  effectPreset: string;
  aspectRatio: string;
  targetDuration: number;
  vibe: string;
  textStyle?: string;
  colorGrade?: string;
  prompt?: string;
  // Additional compose data for variations
  searchKeywords?: string[];
  tiktokSEO?: {
    description?: string;
    hashtags?: {
      category?: string;
      niche?: string;
      descriptive?: string[];
      trending?: string;
    };
    keywords?: {
      primary?: string;
      secondary?: string[];
      longTail?: string[];
    };
    textOverlayKeywords?: string[];
    searchIntent?: string;
    suggestedPostingTimes?: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: RenderRequest = await request.json();
    const {
      generationId,
      campaignId,
      audioAssetId,
      images,
      script,
      effectPreset,
      aspectRatio,
      targetDuration,
      vibe,
      textStyle = 'bold_pop',
      colorGrade = 'vibrant',
      prompt = 'Compose video generation',
      searchKeywords = [],
      tiktokSEO,
    } = body;

    // Get audio asset URL
    const audioAsset = await prisma.asset.findUnique({
      where: { id: audioAssetId },
      select: { s3Url: true }
    });

    if (!audioAsset) {
      return NextResponse.json(
        { detail: 'Audio asset not found' },
        { status: 404 }
      );
    }

    // Build composeData to store all compose settings for variations
    const composeData = {
      script: script?.lines || [],
      searchKeywords,
      vibe,
      effectPreset,
      textStyle,
      colorGrade,
      aspectRatio,
      originalPrompt: prompt,
      tiktokSEO,
      imageCount: images.length,
    };

    // Create or update VideoGeneration record with composeData
    await prisma.videoGeneration.upsert({
      where: { id: generationId },
      create: {
        id: generationId,
        campaignId,
        prompt,
        audioAssetId,
        aspectRatio,
        durationSeconds: Math.ceil(targetDuration),
        status: 'PROCESSING',
        progress: 0,
        createdBy: user.id,
        qualityMetadata: {
          composeData,
        },
      },
      update: {
        status: 'PROCESSING',
        progress: 0,
        qualityMetadata: {
          composeData,
        },
      }
    });

    // Use generationId as job_id for consistent tracking
    const outputKey = `compose/renders/${generationId}/output.mp4`;

    // Prepare render request for Python service
    // Note: targetDuration=0 means auto-calculate based on vibe preset
    // audio.duration should be null to use full audio, not targetDuration
    const renderRequest = {
      job_id: generationId,
      images: images.map(img => ({
        url: img.url,
        order: img.order
      })),
      audio: {
        url: audioAsset.s3Url,
        start_time: 0,
        duration: null  // Let backend auto-calculate based on vibe/images
      },
      script: script && script.lines && script.lines.length > 0
        ? { lines: script.lines }
        : null,  // Pass null if no script lines
      settings: {
        vibe,
        effect_preset: effectPreset,
        aspect_ratio: aspectRatio,
        target_duration: targetDuration,  // 0 = auto-calculate
        text_style: textStyle,
        color_grade: colorGrade
      },
      output: {
        s3_bucket: S3_BUCKET,
        s3_key: outputKey
      }
    };

    console.log('[Compose Render] Request:', JSON.stringify({
      job_id: generationId,
      images_count: images.length,
      has_script: !!(script && script.lines && script.lines.length > 0),
      script_lines_count: script?.lines?.length || 0,
      vibe,
      target_duration: targetDuration,
      use_inngest: USE_INNGEST
    }));

    // Option 1: Use Inngest for orchestration (recommended for production)
    // Provides retries, monitoring, and better error handling
    if (USE_INNGEST) {
      await inngest.send({
        name: 'video/compose',
        data: {
          generationId,
          campaignId,
          userId: user.id,
          audioAssetId,
          images,
          script,
          effectPreset,
          aspectRatio,
          targetDuration,
          vibe,
          textStyle,
          colorGrade,
          prompt
        }
      });

      return NextResponse.json({
        jobId: generationId,
        generationId,
        status: 'queued',
        message: 'Render job queued via Inngest',
        estimatedSeconds: targetDuration > 0 ? targetDuration * 8 : 60,
        outputKey
      });
    }

    // Option 2: Direct API call to compose engine (faster for local dev)
    // Use /render/auto to automatically choose Modal (GPU) if enabled, else local
    const renderEndpoint = process.env.USE_MODAL_RENDER === 'true'
      ? '/render/auto'  // Auto-select Modal GPU if enabled
      : '/render';      // Local rendering only

    const response = await fetch(`${COMPOSE_ENGINE_URL}${renderEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(renderRequest)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Compose engine error: ${error}`);
    }

    await response.json();

    return NextResponse.json({
      jobId: generationId,
      generationId,
      status: 'queued',
      estimatedSeconds: targetDuration > 0 ? targetDuration * 8 : 60,
      outputKey
    });
  } catch (error) {
    console.error('Render start error:', error);
    return NextResponse.json(
      { detail: 'Failed to start rendering' },
      { status: 500 }
    );
  }
}
