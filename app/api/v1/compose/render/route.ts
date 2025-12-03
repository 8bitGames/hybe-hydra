import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { submitRenderToModal, ModalRenderRequest } from '@/lib/modal/client';

const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.MINIO_BUCKET_NAME || 'hydra-assets-hybe';

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
  // Audio timing control
  audioStartTime?: number;  // Start time in seconds for audio (default: 0)
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
      audioStartTime = 0,  // Default to 0 if not provided
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
      audioStartTime,  // Store audio start time for variations
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

    // Prepare render request for Modal
    const modalRequest: ModalRenderRequest = {
      job_id: generationId,
      images: images.map(img => ({
        url: img.url,
        order: img.order
      })),
      audio: {
        url: audioAsset.s3Url,
        start_time: audioStartTime,  // Use analyzed best segment or manual adjustment
        duration: null  // Let backend auto-calculate based on vibe/images
      },
      script: script && script.lines && script.lines.length > 0
        ? { lines: script.lines }
        : null,
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
      },
    };

    console.log('[Compose Render] Submitting to Modal:', JSON.stringify({
      job_id: generationId,
      images_count: images.length,
      has_script: !!(script && script.lines && script.lines.length > 0),
      script_lines_count: script?.lines?.length || 0,
      vibe,
      target_duration: targetDuration,
      audio_start_time: audioStartTime,
    }));

    // Submit to Modal (CPU rendering with libx264)
    const modalResponse = await submitRenderToModal(modalRequest);

    console.log('[Compose Render] Modal response:', modalResponse);

    // Store modal call_id in database for status polling
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        qualityMetadata: {
          composeData,
          modalCallId: modalResponse.call_id,
        },
      }
    });

    return NextResponse.json({
      jobId: generationId,
      generationId,
      status: 'queued',
      message: 'Render job queued on Modal (CPU)',
      modalCallId: modalResponse.call_id,
      estimatedSeconds: targetDuration > 0 ? targetDuration * 5 : 45, // CPU takes longer
      outputKey
    });
  } catch (error) {
    console.error('Render start error:', error);
    return NextResponse.json(
      { detail: `Failed to start rendering: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
