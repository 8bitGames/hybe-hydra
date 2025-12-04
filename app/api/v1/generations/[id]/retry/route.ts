import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { submitRenderToModal, ModalRenderRequest } from '@/lib/modal/client';

const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.MINIO_BUCKET_NAME || 'hydra-assets-hybe';

interface ComposeData {
  script?: Array<{ text: string; timing: number; duration: number }>;
  searchKeywords?: string[];
  vibe?: string;
  effectPreset?: string;
  textStyle?: string;
  colorGrade?: string;
  aspectRatio?: string;
  audioStartTime?: number;
  originalPrompt?: string;
  tiktokSEO?: Record<string, unknown>;
  imageCount?: number;
  useAiEffects?: boolean;
  aiPrompt?: string;
  aiEffects?: Record<string, unknown>;
}

interface QualityMetadata {
  composeData?: ComposeData;
  modalCallId?: string;
  imageUrls?: string[];
}

interface ImageAsset {
  id?: string;
  url: string;
  order: number;
}

interface ScriptData {
  lines?: Array<{ text: string; timing: number; duration: number }>;
  totalDuration?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id: generationId } = await params;

    // Get the original generation
    const generation = await prisma.videoGeneration.findUnique({
      where: { id: generationId },
      include: {
        audioAsset: {
          select: { s3Url: true }
        }
      }
    });

    if (!generation) {
      return NextResponse.json(
        { detail: 'Generation not found' },
        { status: 404 }
      );
    }

    // Only allow retry for failed generations
    if (generation.status !== 'FAILED') {
      return NextResponse.json(
        { detail: 'Can only retry failed generations' },
        { status: 400 }
      );
    }

    // Check if this is a compose video (has composeData in qualityMetadata)
    const qualityMetadata = generation.qualityMetadata as QualityMetadata | null;
    const composeData = qualityMetadata?.composeData;

    if (!composeData) {
      // This is an AI video - we'd need different retry logic
      // For now, just reset status and let the user re-trigger
      return NextResponse.json(
        { detail: 'AI video retry not yet supported. Please create a new generation.' },
        { status: 400 }
      );
    }

    // This is a compose video - retry with stored data
    if (!generation.audioAsset?.s3Url) {
      return NextResponse.json(
        { detail: 'Audio asset not found for retry' },
        { status: 404 }
      );
    }

    // Get stored image URLs - try multiple sources for backward compatibility
    // 1. First try qualityMetadata.imageUrls (legacy)
    // 2. Then try imageAssets from the generation record (new format)
    let imageUrls: string[] = qualityMetadata?.imageUrls || [];

    // If no imageUrls in qualityMetadata, try imageAssets field
    if (imageUrls.length === 0 && generation.imageAssets) {
      const imageAssets = generation.imageAssets as unknown as ImageAsset[];
      if (Array.isArray(imageAssets)) {
        imageUrls = imageAssets
          .sort((a, b) => a.order - b.order)
          .map(asset => asset.url);
      }
    }

    if (imageUrls.length < 3) {
      return NextResponse.json(
        { detail: 'Not enough image data stored for retry. Please create a new generation.' },
        { status: 400 }
      );
    }

    // Get script data - try scriptData field first, then composeData
    const scriptData = generation.scriptData as ScriptData | null;
    const scriptLines = scriptData?.lines || composeData.script || [];

    // Use stored effectPreset from generation if available
    const effectPreset = generation.effectPreset || composeData.effectPreset || 'zoom_beat';

    // Use stored aspectRatio from generation if available
    const aspectRatio = generation.aspectRatio || composeData.aspectRatio || '9:16';

    // Use stored audioStartTime from generation if available
    const audioStartTime = generation.audioStartTime ?? composeData.audioStartTime ?? 0;

    // Reset status to PROCESSING
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        status: 'PROCESSING',
        progress: 0,
        errorMessage: null,
      }
    });

    // Prepare render request for Modal
    const outputKey = `compose/renders/${generationId}/output.mp4`;

    const modalRequest: ModalRenderRequest = {
      job_id: generationId,
      images: imageUrls.map((url, idx) => ({
        url,
        order: idx
      })),
      audio: {
        url: generation.audioAsset.s3Url,
        start_time: audioStartTime,
        duration: null
      },
      script: scriptLines.length > 0
        ? { lines: scriptLines }
        : null,
      settings: {
        vibe: composeData.vibe || 'energetic',
        effect_preset: effectPreset,
        aspect_ratio: aspectRatio,
        target_duration: 0,
        text_style: composeData.textStyle || 'bold_pop',
        color_grade: composeData.colorGrade || 'vibrant',
        use_ai_effects: composeData.useAiEffects ?? true,
        ai_prompt: composeData.aiPrompt || composeData.originalPrompt || generation.prompt,
        ai_effects: composeData.aiEffects,
      },
      output: {
        s3_bucket: S3_BUCKET,
        s3_key: outputKey
      },
    };

    console.log('[Compose Retry] Submitting to Modal:', JSON.stringify({
      job_id: generationId,
      images_count: imageUrls.length,
      has_script: scriptLines.length > 0,
      effect_preset: effectPreset,
      aspect_ratio: aspectRatio,
      audio_start_time: audioStartTime,
    }));

    // Submit to Modal
    const modalResponse = await submitRenderToModal(modalRequest);

    console.log('[Compose Retry] Modal response:', modalResponse);

    // Update with new modal call_id
    const updatedQualityMetadata = {
      ...(qualityMetadata || {}),
      modalCallId: modalResponse.call_id,
    };
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        qualityMetadata: updatedQualityMetadata as unknown as Prisma.InputJsonValue,
      }
    });

    return NextResponse.json({
      jobId: generationId,
      generationId,
      status: 'queued',
      message: 'Retry job queued on Modal',
      modalCallId: modalResponse.call_id,
    });
  } catch (error) {
    console.error('Retry error:', error);
    return NextResponse.json(
      { detail: `Failed to retry: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
