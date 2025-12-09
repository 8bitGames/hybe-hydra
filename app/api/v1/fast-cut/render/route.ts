import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { submitRenderToModal, ModalRenderRequest, isLocalMode, isBatchMode, getComposeEngineMode } from '@/lib/modal/client';

const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.MINIO_BUCKET_NAME || 'hydra-assets-hybe';

// AI Effect Selection types
interface AIEffectSelection {
  transitions?: string[];
  motions?: string[];
  filters?: string[];
  text_animations?: string[];
  analysis?: Record<string, unknown>;
}

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
  // Additional fast cut data for variations
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
  // AI Effect Selection System
  useAiEffects?: boolean;
  aiPrompt?: string;
  aiEffects?: AIEffectSelection;
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
      prompt = 'Fast cut video generation',
      searchKeywords = [],
      tiktokSEO,
      // AI Effect Selection
      useAiEffects = true,
      aiPrompt,
      aiEffects,
    } = body;

    // Get audio asset URL (optional - audio is no longer required)
    let audioAsset = null;
    if (audioAssetId) {
      audioAsset = await prisma.asset.findUnique({
        where: { id: audioAssetId },
        select: { s3Url: true }
      });

      if (!audioAsset) {
        return NextResponse.json(
          { detail: 'Audio asset not found' },
          { status: 404 }
        );
      }
    }

    // Build fastCutData to store all fast cut settings for variations
    // Use JSON.parse(JSON.stringify()) to ensure Prisma JSON compatibility
    const fastCutData = JSON.parse(JSON.stringify({
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
      // AI Effect Selection
      useAiEffects,
      aiPrompt: aiPrompt || prompt,  // Default to main prompt
      aiEffects,
    }));

    // Build imageAssets data for storage - includes URLs for retry functionality
    const imageAssetsData = images.map((img, idx) => ({
      id: `image-${idx}`,
      url: img.url,
      order: img.order,
    }));

    // Build script data for storage
    const scriptDataForDb = script?.lines ? {
      lines: script.lines,
      totalDuration: targetDuration,
    } as Prisma.InputJsonValue : Prisma.JsonNull;

    // Build TikTok SEO data for storage
    const tiktokSEOData = tiktokSEO ? {
      description: tiktokSEO.description,
      hashtags: tiktokSEO.hashtags,
      keywords: tiktokSEO.keywords,
      searchIntent: tiktokSEO.searchIntent,
      suggestedPostingTimes: tiktokSEO.suggestedPostingTimes,
      textOverlayKeywords: tiktokSEO.textOverlayKeywords,
    } as Prisma.InputJsonValue : Prisma.JsonNull;

    // Create or update VideoGeneration record with all fast cut metadata
    await prisma.videoGeneration.upsert({
      where: { id: generationId },
      create: {
        id: generationId,
        campaignId,
        generationType: 'COMPOSE',
        prompt,
        audioAssetId,
        audioStartTime,
        aspectRatio,
        durationSeconds: Math.ceil(targetDuration) || 15,
        status: 'PROCESSING',
        progress: 0,
        createdBy: user.id,
        // Store fast-cut-specific fields in proper DB columns
        scriptData: scriptDataForDb,
        imageAssets: imageAssetsData,
        effectPreset,
        trendKeywords: searchKeywords,
        tiktokSEO: tiktokSEOData,
        // Store additional fast cut settings in qualityMetadata for retry
        qualityMetadata: {
          fastCutData,
          imageUrls: images.map(img => img.url), // Store URLs for easy retry access
        },
      },
      update: {
        generationType: 'COMPOSE',
        audioStartTime,
        status: 'PROCESSING',
        progress: 0,
        errorMessage: null, // Clear any previous error
        // Update fast-cut-specific fields
        scriptData: scriptDataForDb,
        imageAssets: imageAssetsData,
        effectPreset,
        trendKeywords: searchKeywords,
        tiktokSEO: tiktokSEOData,
        qualityMetadata: {
          fastCutData,
          imageUrls: images.map(img => img.url),
        },
      }
    });

    // Use generationId as job_id for consistent tracking
    const outputKey = `fast-cut/renders/${generationId}/output.mp4`;

    // Prepare render request for Modal
    const modalRequest: ModalRenderRequest = {
      job_id: generationId,
      images: images.map(img => ({
        url: img.url,
        order: img.order
      })),
      // Audio is optional - only include if provided
      audio: audioAsset ? {
        url: audioAsset.s3Url,
        start_time: audioStartTime,  // Use analyzed best segment or manual adjustment
        duration: null  // Let backend auto-calculate based on vibe/images
      } : null,
      script: script && script.lines && script.lines.length > 0
        ? { lines: script.lines }
        : null,
      settings: {
        vibe,
        effect_preset: effectPreset,
        aspect_ratio: aspectRatio,
        target_duration: targetDuration,  // 0 = auto-calculate
        text_style: textStyle,
        color_grade: colorGrade,
        // AI Effect Selection System
        use_ai_effects: useAiEffects,
        ai_prompt: aiPrompt || prompt,
        ai_effects: aiEffects,
      },
      output: {
        s3_bucket: S3_BUCKET,
        s3_key: outputKey
      },
    };

    console.log('[Fast Cut Render] Submitting to Modal:', JSON.stringify({
      job_id: generationId,
      images_count: images.length,
      has_script: !!(script && script.lines && script.lines.length > 0),
      script_lines_count: script?.lines?.length || 0,
      vibe,
      target_duration: targetDuration,
      audio_start_time: audioStartTime,
      // AI Effects
      use_ai_effects: useAiEffects,
      has_ai_effects: !!aiEffects,
    }));

    // Submit to Modal (CPU rendering with libx264)
    const modalResponse = await submitRenderToModal(modalRequest);

    console.log('[Fast Cut Render] Modal response:', modalResponse);

    // Determine render backend for status display
    const renderBackend = getComposeEngineMode();

    // Store modal call_id and image URLs in database for status polling and retry
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        qualityMetadata: {
          fastCutData,
          modalCallId: modalResponse.call_id,
          imageUrls: images.map(img => img.url), // Store for retry functionality
          renderBackend, // 'local' or 'modal' for status display
        },
      }
    });

    const backendLabels: Record<string, string> = {
      local: 'Local (CPU)',
      modal: 'Modal (GPU)',
      batch: 'AWS Batch (GPU)',
    };
    const backendLabel = backendLabels[renderBackend] || 'Modal (GPU)';
    return NextResponse.json({
      jobId: generationId,
      generationId,
      status: 'queued',
      message: `Render job queued on ${backendLabel}`,
      modalCallId: modalResponse.call_id,
      estimatedSeconds: targetDuration > 0 ? targetDuration * 5 : 45, // CPU takes longer
      outputKey,
      renderBackend,
    });
  } catch (error) {
    console.error('Render start error:', error);
    return NextResponse.json(
      { detail: `Failed to start rendering: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
