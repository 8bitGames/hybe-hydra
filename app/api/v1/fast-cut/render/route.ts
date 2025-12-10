import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { submitRenderToModal, ModalRenderRequest, isLocalMode, isBatchMode } from '@/lib/modal/client';
import { getStyleSetById, styleSetToRenderSettings } from '@/lib/fast-cut/style-sets';

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
  // Style Set ID - when provided, overrides individual settings
  styleSetId?: string;
  // Individual settings (used when styleSetId is not provided)
  effectPreset?: string;
  aspectRatio: string;
  targetDuration: number;
  vibe?: string;
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
  // AI Effect Selection System (legacy - used when styleSetId is not provided)
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
      campaignId: rawCampaignId,
      audioAssetId,
      images,
      script,
      styleSetId,
      aspectRatio,
      targetDuration,
      audioStartTime = 0,  // Default to 0 if not provided
      prompt = 'Fast cut video generation',
      searchKeywords = [],
      tiktokSEO,
    } = body;

    // Convert empty campaignId and audioAssetId to null (for test mode)
    const campaignId = rawCampaignId && rawCampaignId.trim() ? rawCampaignId : null;
    const audioAssetIdClean = audioAssetId && audioAssetId.trim() ? audioAssetId : null;

    // Resolve settings from style set or individual parameters
    let vibe: string;
    let effectPreset: string;
    let textStyle: string;
    let colorGrade: string;
    let useAiEffects: boolean;
    let aiEffects: AIEffectSelection | undefined;

    if (styleSetId) {
      // Use style set settings
      const styleSet = getStyleSetById(styleSetId);
      if (!styleSet) {
        return NextResponse.json(
          { detail: `Invalid style set ID: ${styleSetId}` },
          { status: 400 }
        );
      }

      const renderSettings = styleSetToRenderSettings(styleSet);
      vibe = renderSettings.vibe;
      effectPreset = renderSettings.effectPreset;
      textStyle = renderSettings.textStyle;
      colorGrade = renderSettings.colorGrade;
      useAiEffects = false; // Style sets use predefined effects
      aiEffects = renderSettings.aiEffects;

      console.log(`[Fast Cut Render] Using style set: ${styleSetId} (${styleSet.nameKo})`);
    } else {
      // Use individual parameters (legacy mode)
      vibe = body.vibe || 'Exciting';
      effectPreset = body.effectPreset || 'zoom_beat';
      textStyle = body.textStyle || 'bold_pop';
      colorGrade = body.colorGrade || 'vibrant';
      useAiEffects = body.useAiEffects ?? true;
      aiEffects = body.aiEffects;
    }

    const aiPrompt = body.aiPrompt;

    // Get audio asset URL (optional - audio is no longer required)
    let audioAsset = null;
    if (audioAssetIdClean) {
      audioAsset = await prisma.asset.findUnique({
        where: { id: audioAssetIdClean },
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
      // Style set or individual settings
      styleSetId: styleSetId || null,
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
        audioAssetId: audioAssetIdClean,
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
      // Style set or individual settings
      style_set_id: styleSetId || null,
      vibe,
      effect_preset: effectPreset,
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
    const renderBackend = isLocalMode() ? 'local' : isBatchMode() ? 'batch' : 'modal';

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

    const backendLabel = renderBackend === 'local' ? 'Local (CPU)' :
                         renderBackend === 'batch' ? 'AWS Batch (GPU)' : 'Modal (CPU)';
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
