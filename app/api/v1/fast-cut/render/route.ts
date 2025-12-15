import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { submitRenderToModal, ModalRenderRequest, isLocalMode } from '@/lib/compose/client';
import { getStyleSetById, styleSetToRenderSettings } from '@/lib/fast-cut/style-sets';
import { getScriptFromAssetLyrics } from '@/lib/subtitle-styles/lyrics-converter';
import { createLyricsExtractorAgent, toLyricsData } from '@/lib/agents/analyzers';
import { getPresignedUrl } from '@/lib/storage';

const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.MINIO_BUCKET_NAME || 'hydra-assets-hybe';

/**
 * Remove query string from S3 URL
 * EC2 uses IAM role for S3 access, so pre-signed URL parameters are not needed
 * and cause issues when parsing the S3 key (query string gets included in key)
 */
function cleanS3Url(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove all query parameters (pre-signed URL params)
    urlObj.search = '';
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

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
  // Image transition speed control (from style set or manual)
  cutDuration?: number;  // Duration per image in seconds (overrides BPM-based calculation)
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
  // Lyrics/Subtitle options
  useAudioLyrics?: boolean;  // Auto-load lyrics from audio asset for subtitles
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  const LOG_PREFIX = '[Fast Cut Render API]';

  console.log(`${LOG_PREFIX} ========================================`);
  console.log(`${LOG_PREFIX} REQUEST RECEIVED - ${new Date().toISOString()}`);
  console.log(`${LOG_PREFIX} ========================================`);

  try {
    const authHeader = request.headers.get('authorization');
    console.log(`${LOG_PREFIX} Auth header present: ${!!authHeader}`);

    const user = await getUserFromHeader(authHeader);

    if (!user) {
      console.warn(`${LOG_PREFIX} Authentication failed - no valid user`);
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    console.log(`${LOG_PREFIX} User authenticated: ${user.id}`);

    const body: RenderRequest = await request.json();
    const {
      generationId,
      campaignId: rawCampaignId,
      audioAssetId,
      images,
      script: providedScript,
      styleSetId,
      aspectRatio,
      targetDuration,
      audioStartTime = 0,  // Default to 0 if not provided
      cutDuration: requestCutDuration,  // From request body (frontend may pass this)
      prompt = 'Fast cut video generation',
      searchKeywords = [],
      tiktokSEO,
      useAudioLyrics = false,
    } = body;

    console.log(`${LOG_PREFIX} Request body parsed:`, {
      generationId,
      campaignId: rawCampaignId || '(empty - test mode)',
      audioAssetId: audioAssetId || '(empty)',
      imageCount: images?.length || 0,
      hasScript: !!(providedScript?.lines?.length),
      scriptLinesCount: providedScript?.lines?.length || 0,
      styleSetId: styleSetId || '(none)',
      aspectRatio,
      targetDuration,
      audioStartTime,
      cutDuration: requestCutDuration || '(will resolve from style set)',
      prompt: prompt?.substring(0, 100) || '(none)',
      searchKeywordsCount: searchKeywords?.length || 0,
      hasTiktokSEO: !!tiktokSEO,
      useAudioLyrics,
    });

    // Convert empty campaignId and audioAssetId to null (for test mode)
    const campaignId = rawCampaignId && rawCampaignId.trim() ? rawCampaignId : null;
    const audioAssetIdClean = audioAssetId && audioAssetId.trim() ? audioAssetId : null;

    console.log(`${LOG_PREFIX} Cleaned IDs:`, {
      campaignId: campaignId || '(null - test mode)',
      audioAssetIdClean: audioAssetIdClean || '(null - no audio)',
    });

    // Resolve settings from style set or individual parameters
    let vibe: string;
    let effectPreset: string;
    let textStyle: string;
    let colorGrade: string;
    let useAiEffects: boolean;
    let aiEffects: AIEffectSelection | undefined;
    let cutDuration: number | undefined = requestCutDuration;  // May be overridden by style set

    console.log(`${LOG_PREFIX} Resolving render settings...`);
    const settingsStartTime = Date.now();

    if (styleSetId) {
      // Use style set settings
      console.log(`${LOG_PREFIX} Style Set mode - looking up: ${styleSetId}`);
      const styleSet = getStyleSetById(styleSetId);
      if (!styleSet) {
        console.error(`${LOG_PREFIX} Style set not found: ${styleSetId}`);
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
      // Use style set's cutDuration if not explicitly provided in request
      if (!cutDuration && renderSettings.cutDuration) {
        cutDuration = renderSettings.cutDuration;
      }

      console.log(`${LOG_PREFIX} Style set resolved:`, {
        styleSetId,
        styleSetName: styleSet.nameKo,
        vibe,
        effectPreset,
        textStyle,
        colorGrade,
        cutDuration,
        hasAiEffects: !!aiEffects,
        aiEffectsTransitions: aiEffects?.transitions?.length || 0,
        aiEffectsMotions: aiEffects?.motions?.length || 0,
      });
    } else {
      // Use individual parameters (legacy mode)
      console.log(`${LOG_PREFIX} Legacy mode - using individual parameters`);
      vibe = body.vibe || 'Exciting';
      effectPreset = body.effectPreset || 'zoom_beat';
      textStyle = body.textStyle || 'bold_pop';
      colorGrade = body.colorGrade || 'vibrant';
      useAiEffects = body.useAiEffects ?? true;
      aiEffects = body.aiEffects;

      console.log(`${LOG_PREFIX} Legacy settings resolved:`, {
        vibe,
        effectPreset,
        textStyle,
        colorGrade,
        useAiEffects,
        hasAiEffects: !!aiEffects,
      });
    }
    console.log(`${LOG_PREFIX} Settings resolution took ${Date.now() - settingsStartTime}ms`);

    const aiPrompt = body.aiPrompt;

    // Get audio asset URL (optional - audio is no longer required)
    console.log(`${LOG_PREFIX} Audio asset lookup...`);
    const audioLookupStartTime = Date.now();
    let audioAsset: { s3Url: string | null; metadata: unknown } | null = null;
    if (audioAssetIdClean) {
      console.log(`${LOG_PREFIX} Looking up audio asset: ${audioAssetIdClean}`);
      audioAsset = await prisma.asset.findUnique({
        where: { id: audioAssetIdClean },
        select: { s3Url: true, metadata: true }
      });

      if (!audioAsset) {
        console.error(`${LOG_PREFIX} Audio asset not found: ${audioAssetIdClean}`);
        return NextResponse.json(
          { detail: 'Audio asset not found' },
          { status: 404 }
        );
      }
      console.log(`${LOG_PREFIX} Audio asset found:`, {
        id: audioAssetIdClean,
        s3UrlLength: audioAsset.s3Url?.length || 0,
        s3UrlPreview: audioAsset.s3Url?.substring(0, 80) + '...',
        hasMetadata: !!audioAsset.metadata,
      });
    } else {
      console.log(`${LOG_PREFIX} No audio asset specified - rendering without audio`);
    }
    console.log(`${LOG_PREFIX} Audio lookup took ${Date.now() - audioLookupStartTime}ms`);

    // Resolve script - either from provided script or from audio asset lyrics
    // When useAudioLyrics is true, lyrics take priority over AI-generated script
    let script = providedScript;

    // Debug: Log lyrics resolution attempt
    console.log(`${LOG_PREFIX} 🎤 Lyrics resolution:`, {
      useAudioLyrics,
      hasAudioAsset: !!audioAsset,
      hasMetadata: !!audioAsset?.metadata,
      audioStartTime,
      targetDuration,
    });

    if (useAudioLyrics && audioAssetIdClean) {
      let metadata = audioAsset?.metadata as Record<string, unknown> || {};
      let hasLyricsInMetadata = !!metadata.lyrics;
      let lyricsData = metadata.lyrics as { segments?: unknown[]; isInstrumental?: boolean } | undefined;

      console.log(`${LOG_PREFIX} 🎤 Audio metadata check:`, {
        hasLyricsInMetadata,
        isInstrumental: lyricsData?.isInstrumental,
        segmentCount: Array.isArray(lyricsData?.segments) ? lyricsData.segments.length : 0,
      });

      // ON-DEMAND LYRICS EXTRACTION: If useAudioLyrics is true but no lyrics exist, extract them now
      if (!hasLyricsInMetadata || !lyricsData?.segments?.length) {
        console.log(`${LOG_PREFIX} 🎤 No lyrics in metadata - attempting on-demand extraction...`);

        try {
          // Get fresh audio asset data with s3Key
          const audioAssetFull = await prisma.asset.findUnique({
            where: { id: audioAssetIdClean },
            select: { id: true, s3Key: true, s3Url: true, metadata: true }
          });

          if (audioAssetFull?.s3Key) {
            // Generate fresh presigned URL
            const audioUrl = await getPresignedUrl(audioAssetFull.s3Key, 3600);

            // Create and run lyrics extractor
            const extractor = createLyricsExtractorAgent();
            const agentContext = {
              workflow: {
                platform: 'tiktok' as const,
                language: 'ko' as const,
                artistName: 'unknown',
              },
            };

            console.log(`${LOG_PREFIX} 🎤 Extracting lyrics from audio...`);
            const extractionStartTime = Date.now();

            const result = await extractor.extractLyricsFromUrl(
              audioUrl,
              { languageHint: 'auto', audioDuration: targetDuration * 2 },
              agentContext
            );

            console.log(`${LOG_PREFIX} 🎤 Lyrics extraction completed in ${Date.now() - extractionStartTime}ms`);

            if (result.success && result.data && !result.data.isInstrumental) {
              const extractedLyrics = toLyricsData(result.data);

              // Store lyrics in asset metadata for future use
              const existingMetadata = (audioAssetFull.metadata || {}) as Record<string, unknown>;
              const updatedMetadata = JSON.parse(JSON.stringify({
                ...existingMetadata,
                hasLyrics: !extractedLyrics.isInstrumental,
                lyricsLanguage: extractedLyrics.language,
                lyricsExtractedAt: extractedLyrics.extractedAt,
                lyrics: extractedLyrics,
              })) as Prisma.InputJsonValue;

              await prisma.asset.update({
                where: { id: audioAssetIdClean },
                data: { metadata: updatedMetadata },
              });

              // Update local variables for immediate use
              metadata = updatedMetadata as Record<string, unknown>;
              hasLyricsInMetadata = true;
              lyricsData = extractedLyrics;

              console.log(`${LOG_PREFIX} ✅ Lyrics extracted and saved:`, {
                segmentCount: extractedLyrics.segments?.length || 0,
                language: extractedLyrics.language,
                isInstrumental: extractedLyrics.isInstrumental,
              });
            } else {
              console.log(`${LOG_PREFIX} ⚠️ Lyrics extraction returned no usable lyrics:`, {
                success: result.success,
                hasData: !!result.data,
                isInstrumental: result.data?.isInstrumental,
                error: result.error,
              });
            }
          } else {
            console.log(`${LOG_PREFIX} ⚠️ Cannot extract lyrics - audio asset has no s3Key`);
          }
        } catch (extractError) {
          console.error(`${LOG_PREFIX} ❌ On-demand lyrics extraction failed:`, extractError);
          // Continue without lyrics - will fall back to AI script
        }
      }

      // Now try to get lyrics script (either from existing metadata or freshly extracted)
      if (hasLyricsInMetadata && lyricsData?.segments?.length) {
        console.log(`${LOG_PREFIX} useAudioLyrics enabled - loading lyrics from audio asset (lyrics take priority over AI script)`);
        const lyricsScript = getScriptFromAssetLyrics(
          metadata,
          {
            audioStartTime,
            videoDuration: targetDuration,
          }
        );

        console.log(`${LOG_PREFIX} 🎤 getScriptFromAssetLyrics result:`, {
          hasResult: !!lyricsScript,
          linesCount: lyricsScript?.lines?.length ?? 0,
          firstLine: lyricsScript?.lines?.[0]?.text?.substring(0, 50),
        });

        if (lyricsScript && lyricsScript.lines.length > 0) {
          script = lyricsScript;
          console.log(`${LOG_PREFIX} ✅ Lyrics loaded from audio asset:`, {
            linesCount: lyricsScript.lines.length,
            firstLine: lyricsScript.lines[0]?.text?.substring(0, 30) + '...',
            replacedAiScript: !!(providedScript?.lines?.length),
          });
        } else {
          console.log(`${LOG_PREFIX} ❌ No lyrics found/returned - falling back to AI script`);
        }
      } else {
        console.log(`${LOG_PREFIX} ❌ No usable lyrics available - falling back to AI script`);
      }
    } else {
      console.log(`${LOG_PREFIX} ⚠️ Skipping lyrics (useAudioLyrics=${useAudioLyrics}, hasAudioAsset=${!!audioAssetIdClean})`);
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

    console.log(`${LOG_PREFIX} Prepared data for database:`, {
      fastCutDataKeys: Object.keys(fastCutData),
      imageAssetsCount: imageAssetsData.length,
      hasScriptData: scriptDataForDb !== Prisma.JsonNull,
      hasTiktokSEO: tiktokSEOData !== Prisma.JsonNull,
    });

    // Create or update VideoGeneration record with all fast cut metadata
    console.log(`${LOG_PREFIX} Upserting VideoGeneration record...`);
    const dbUpsertStartTime = Date.now();
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
    console.log(`${LOG_PREFIX} Database upsert completed in ${Date.now() - dbUpsertStartTime}ms`);

    // Use generationId as job_id for consistent tracking
    const outputKey = `fast-cut/renders/${generationId}/output.mp4`;
    console.log(`${LOG_PREFIX} Output S3 key: ${outputKey}`);

    // Prepare render request for Modal
    // Clean S3 URLs to remove pre-signed query parameters (EC2 uses IAM role)
    const cleanedImages = images.map(img => ({
      url: cleanS3Url(img.url),
      order: img.order
    }));

    console.log(`${LOG_PREFIX} Preparing Modal render request...`);
    console.log(`${LOG_PREFIX} Cleaned image URLs (removed query strings):`, {
      originalFirst: images[0]?.url?.substring(0, 100),
      cleanedFirst: cleanedImages[0]?.url?.substring(0, 100),
    });

    const modalRequest: ModalRenderRequest = {
      job_id: generationId,
      images: cleanedImages,
      // Audio is optional - only include if provided and has URL
      // Clean audio URL as well (remove pre-signed query params)
      audio: audioAsset?.s3Url ? {
        url: cleanS3Url(audioAsset.s3Url),
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
        cut_duration: cutDuration,  // Duration per image (from style set or request)
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

    console.log(`${LOG_PREFIX} Modal request prepared:`, {
      job_id: generationId,
      images_count: images.length,
      has_audio: !!audioAsset,
      audio_start_time: audioStartTime,
      has_script: !!(script && script.lines && script.lines.length > 0),
      script_lines_count: script?.lines?.length || 0,
      style_set_id: styleSetId || null,
      vibe,
      effect_preset: effectPreset,
      target_duration: targetDuration,
      cut_duration: cutDuration,  // Image transition speed from style set
      text_style: textStyle,
      color_grade: colorGrade,
      use_ai_effects: useAiEffects,
      has_ai_effects: !!aiEffects,
      s3_bucket: S3_BUCKET,
      output_key: outputKey,
    });

    // Determine render backend for status display
    const renderBackend = isLocalMode() ? 'local' : 'modal';
    const backendLabel = renderBackend === 'local' ? 'Local (CPU)' : 'Modal (CPU)';

    console.log(`${LOG_PREFIX} ----------------------------------------`);
    console.log(`${LOG_PREFIX} SUBMITTING TO BACKEND: ${backendLabel}`);
    console.log(`${LOG_PREFIX} Backend mode: ${renderBackend}`);
    console.log(`${LOG_PREFIX} Environment: COMPOSE_ENGINE_MODE=${process.env.COMPOSE_ENGINE_MODE || '(not set)'}`);
    console.log(`${LOG_PREFIX} ----------------------------------------`);

    // Submit to Modal (CPU rendering with libx264)
    const modalSubmitStartTime = Date.now();
    const modalResponse = await submitRenderToModal(modalRequest);
    const modalSubmitDuration = Date.now() - modalSubmitStartTime;

    console.log(`${LOG_PREFIX} Backend submission response:`, {
      status: 'submitted',
      call_id: modalResponse.call_id,
      backend: backendLabel,
      submissionDurationMs: modalSubmitDuration,
    });

    // Store modal call_id and image URLs in database for status polling and retry
    console.log(`${LOG_PREFIX} Updating database with call_id...`);
    const dbUpdateStartTime = Date.now();
    await prisma.videoGeneration.update({
      where: { id: generationId },
      data: {
        qualityMetadata: {
          fastCutData,
          modalCallId: modalResponse.call_id,
          imageUrls: images.map(img => img.url), // Store for retry functionality
          renderBackend, // 'local' or 'modal' or 'batch' for status display
          createdAt: new Date().toISOString(), // For progress estimation
        },
      }
    });
    console.log(`${LOG_PREFIX} Database update completed in ${Date.now() - dbUpdateStartTime}ms`);

    const totalRequestTime = Date.now() - requestStartTime;
    const estimatedSeconds = targetDuration > 0 ? targetDuration * 5 : 45;

    console.log(`${LOG_PREFIX} ========================================`);
    console.log(`${LOG_PREFIX} REQUEST COMPLETED SUCCESSFULLY`);
    console.log(`${LOG_PREFIX} Total API time: ${totalRequestTime}ms`);
    console.log(`${LOG_PREFIX} Job ID: ${generationId}`);
    console.log(`${LOG_PREFIX} Call ID: ${modalResponse.call_id}`);
    console.log(`${LOG_PREFIX} Backend: ${backendLabel}`);
    console.log(`${LOG_PREFIX} Estimated render time: ${estimatedSeconds}s`);
    console.log(`${LOG_PREFIX} ========================================`);

    return NextResponse.json({
      jobId: generationId,
      generationId,
      status: 'queued',
      message: `Render job queued on ${backendLabel}`,
      modalCallId: modalResponse.call_id,
      estimatedSeconds,
      outputKey,
      renderBackend,
    });
  } catch (error) {
    const totalRequestTime = Date.now() - requestStartTime;
    console.error(`${LOG_PREFIX} ========================================`);
    console.error(`${LOG_PREFIX} REQUEST FAILED`);
    console.error(`${LOG_PREFIX} Total API time: ${totalRequestTime}ms`);
    console.error(`${LOG_PREFIX} Error:`, error);
    console.error(`${LOG_PREFIX} Error message:`, error instanceof Error ? error.message : 'Unknown error');
    console.error(`${LOG_PREFIX} Stack trace:`, error instanceof Error ? error.stack : '(no stack)');
    console.error(`${LOG_PREFIX} ========================================`);
    return NextResponse.json(
      { detail: `Failed to start rendering: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
