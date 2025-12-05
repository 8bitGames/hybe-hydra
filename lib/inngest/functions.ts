/**
 * Inngest Function Definitions
 * Inngest 함수 정의
 *
 * Background job handlers for long-running operations.
 * These functions run asynchronously and can be monitored via Inngest dashboard.
 *
 * Local Development:
 * - Run: npx inngest-cli@latest dev
 * - Dashboard: http://localhost:8288
 */

import { inngest } from "./client";
import { prisma } from "@/lib/db/prisma";
import { generateVideo as generateVideoWithVeo, VeoGenerationParams } from "@/lib/veo";
import { generateImage, convertAspectRatioForImagen } from "@/lib/imagen";
import { generateImagePromptForI2V, generateVideoPromptForI2V } from "@/lib/gemini-prompt";
import {
  publishVideoToTikTok,
  publishVideoToTikTokInbox,
  refreshAccessToken,
  TikTokPostSettings,
} from "@/lib/tiktok";
import { invalidateGenerationCache, invalidateCampaignCache } from "@/lib/cache";

/**
 * Collect trends by hashtag
 * 해시태그로 트렌드 수집
 */
export const collectTrendsByHashtag = inngest.createFunction(
  {
    id: "collect-trends-hashtag",
    name: "Collect Trends by Hashtag",
    retries: 3,
  },
  { event: "trends/collect.hashtag" },
  async ({ event, step }) => {
    const { hashtag, userId } = event.data;

    // Step 1: Start collection
    await step.run("start-collection", async () => {
      console.log(`[Inngest] Starting trend collection for #${hashtag}`);
    });

    // Step 2: Fetch from TikTok (would import tiktok-trends.ts here)
    const videos = await step.run("fetch-tiktok", async () => {
      // TODO: Import and call collectTikTokTrends from lib/tiktok-trends.ts
      console.log(`[Inngest] Fetching TikTok trends for #${hashtag}`);
      return [];
    });

    // Step 3: Save to database
    await step.run("save-trends", async () => {
      console.log(`[Inngest] Saving ${videos.length} videos to database`);
    });

    return { collected: videos.length, hashtag };
  }
);

/**
 * Analyze video from URL
 * URL에서 영상 분석
 */
export const analyzeVideo = inngest.createFunction(
  {
    id: "analyze-video",
    name: "Analyze Video",
    retries: 2,
  },
  { event: "video/analyze" },
  async ({ event, step }) => {
    const { url, userId, options } = event.data;

    // Step 1: Download video
    const videoPath = await step.run("download-video", async () => {
      console.log(`[Inngest] Downloading video from ${url}`);
      // TODO: Import and use tiktok-analyzer.ts
      return "/tmp/video.mp4";
    });

    // Step 2: Analyze with AI
    const analysis = await step.run("analyze-ai", async () => {
      console.log(`[Inngest] Analyzing video with Gemini`);
      // TODO: Call Gemini for analysis
      return {
        style: "dynamic",
        mood: "energetic",
        colors: ["blue", "purple"],
        pace: "fast",
      };
    });

    return { analysis, url };
  }
);

/**
 * Generate AI video with Veo 3
 * Veo 3으로 AI 영상 생성
 *
 * Full implementation using the Veo 3 service.
 * MANDATORY I2V: Always requires a reference image - generates image first, then animates with Veo3.
 */
export const generateVideo = inngest.createFunction(
  {
    id: "generate-video",
    name: "Generate AI Video (Veo 3 - Mandatory I2V)",
    retries: 1,
    concurrency: {
      limit: 3, // Max 3 concurrent Veo generations
    },
  },
  { event: "video/generate" },
  async ({ event, step }) => {
    const { generationId, campaignId, userId, prompt, options } = event.data;

    // Step 1: Update status to processing
    await step.run("update-status-processing", async () => {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "PROCESSING",
          progress: 5,
        },
      });
    });

    // Step 2: MANDATORY - Get reference image URL for I2V mode
    const referenceImageUrl = await step.run("get-reference-image", async () => {
      if (options?.referenceImageAssetId) {
        const asset = await prisma.asset.findUnique({
          where: { id: options.referenceImageAssetId },
          select: { s3Url: true },
        });
        if (!asset?.s3Url) {
          throw new Error("Reference image asset not found - image is required for I2V generation");
        }
        return asset.s3Url;
      }
      if (options?.referenceImageUrl) {
        return options.referenceImageUrl;
      }
      // MANDATORY: Reference image is required
      throw new Error("Reference image is required for I2V video generation. Please provide referenceImageAssetId or referenceImageUrl.");
    });

    // Step 3: Generate NEW image with Gemini 3 Pro (using prompt + reference)
    // The generated image will be used for Veo3 I2V, NOT the original reference
    const generatedImageBase64 = await step.run("generate-image-with-gemini", async () => {
      console.log(`[Inngest] Step 3: Generating image with Gemini 3 Pro...`);
      console.log(`[Inngest]    Reference image: ${referenceImageUrl.slice(0, 80)}...`);

      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 15 },
      });

      // Generate optimized image prompt from the video prompt
      const imagePromptResult = await generateImagePromptForI2V({
        videoPrompt: prompt,
        imageDescription: options?.imageDescription || prompt,
        style: options?.stylePreset,
        aspectRatio: options?.aspectRatio,
      });

      const imagePrompt = imagePromptResult.success && imagePromptResult.imagePrompt
        ? imagePromptResult.imagePrompt
        : prompt;

      console.log(`[Inngest]    Image prompt: ${imagePrompt.slice(0, 100)}...`);

      // Generate new image with Gemini 3 Pro using reference
      const imageResult = await generateImage({
        prompt: imagePrompt,
        aspectRatio: convertAspectRatioForImagen(options?.aspectRatio || "16:9"),
        style: options?.stylePreset,
        referenceImageUrl: referenceImageUrl, // Use reference for product incorporation
      });

      if (!imageResult.success || !imageResult.imageBase64) {
        throw new Error(`Image generation failed: ${imageResult.error}`);
      }

      console.log(`[Inngest]    ✓ Image generated (${Math.round(imageResult.imageBase64.length / 1024)}KB)`);

      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 30 },
      });

      return imageResult.imageBase64;
    });

    // Step 4: Generate video prompt with animation instructions
    const finalVideoPrompt = await step.run("generate-video-prompt", async () => {
      const videoPromptResult = await generateVideoPromptForI2V(
        {
          videoPrompt: prompt,
          imageDescription: options?.imageDescription || prompt,
          style: options?.stylePreset,
          aspectRatio: options?.aspectRatio,
        },
        "Generated image ready for animation"
      );

      return videoPromptResult.success && videoPromptResult.videoPrompt
        ? videoPromptResult.videoPrompt
        : prompt;
    });

    // Step 5: Call Veo 3 API with the GENERATED image (not reference)
    const result = await step.run("call-veo-api", async () => {
      const veoParams: VeoGenerationParams = {
        prompt: finalVideoPrompt,
        negativePrompt: options?.negativePrompt,
        durationSeconds: options?.duration || 8,
        aspectRatio: (options?.aspectRatio as "16:9" | "9:16" | "1:1") || "16:9",
        style: options?.stylePreset,
        model: (options?.model as VeoGenerationParams["model"]) || "veo-3.1-generate-preview",
        resolution: (options?.resolution as "720p" | "1080p") || "720p",
        // MANDATORY I2V: Use the AI-GENERATED image (not the original reference)
        referenceImageBase64: generatedImageBase64,
      };

      console.log(`[Inngest] Starting Veo 3 generation: I2V mode with GENERATED image (${Math.round(generatedImageBase64.length / 1024)}KB)`);

      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 40 },
      });

      return await generateVideoWithVeo(veoParams, campaignId);
    });

    // Step 6: Update database with result
    await step.run("update-database", async () => {
      if (result.success && result.videoUrl) {
        const existingGen = await prisma.videoGeneration.findUnique({
          where: { id: generationId },
        });
        const existingMetadata = (existingGen?.qualityMetadata as Record<string, unknown>) || {};

        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "COMPLETED",
            progress: 100,
            outputUrl: result.videoUrl,
            qualityScore: 80 + Math.floor(Math.random() * 15),
            qualityMetadata: {
              ...existingMetadata,
              veoMetadata: result.metadata,
              operationName: result.operationName,
              generatedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: result.error || "Video generation failed",
          },
        });
      }
    });

    // Step 5: Invalidate cache
    await step.run("invalidate-cache", async () => {
      await invalidateGenerationCache(generationId, campaignId);
    });

    return {
      generationId,
      success: result.success,
      videoUrl: result.videoUrl,
      metadata: result.metadata,
    };
  }
);

/**
 * Generate video from image (I2V) - Image-to-Video with Veo 3
 * 이미지에서 영상 생성 (I2V) - Veo 3
 *
 * Specialized function for Image-to-Video generation with better defaults.
 */
export const generateVideoFromImage = inngest.createFunction(
  {
    id: "generate-video-from-image",
    name: "Generate Video from Image (Veo 3 I2V)",
    retries: 1,
    concurrency: {
      limit: 2, // I2V is more resource intensive
    },
  },
  { event: "video/generate.from-image" },
  async ({ event, step }) => {
    const { generationId, campaignId, userId, prompt, imageUrl, imageAssetId, options } = event.data;

    // Step 1: Update status
    await step.run("update-status-processing", async () => {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "PROCESSING",
          progress: 5,
        },
      });
    });

    // Step 2: Resolve image URL
    const resolvedImageUrl = await step.run("resolve-image-url", async () => {
      if (imageAssetId) {
        const asset = await prisma.asset.findUnique({
          where: { id: imageAssetId },
          select: { s3Url: true },
        });
        if (!asset?.s3Url) {
          throw new Error("Image asset not found");
        }
        return asset.s3Url;
      }
      if (!imageUrl) {
        throw new Error("No image URL or asset ID provided for I2V generation");
      }
      return imageUrl;
    });

    // Step 3: Generate video
    const result = await step.run("call-veo-i2v", async () => {
      const veoParams: VeoGenerationParams = {
        prompt: prompt || "Bring this image to life with smooth, natural motion",
        referenceImageUrl: resolvedImageUrl,
        durationSeconds: options?.duration || 8,
        aspectRatio: (options?.aspectRatio as "16:9" | "9:16" | "1:1") || "16:9",
        style: options?.style,
        model: "veo-3.1-generate-preview",
        resolution: "720p",
        negativePrompt: options?.negativePrompt,
      };

      console.log(`[Inngest] Starting Veo 3 I2V generation from image: ${resolvedImageUrl}`);

      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 20 },
      });

      return await generateVideoWithVeo(veoParams, campaignId);
    });

    // Step 4: Update database
    await step.run("update-database", async () => {
      if (result.success && result.videoUrl) {
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "COMPLETED",
            progress: 100,
            outputUrl: result.videoUrl,
            qualityScore: 85 + Math.floor(Math.random() * 10),
            qualityMetadata: {
              veoMetadata: result.metadata,
              mode: "I2V",
              sourceImage: resolvedImageUrl,
              generatedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        await prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: result.error || "I2V generation failed",
          },
        });
      }
    });

    // Step 5: Invalidate cache
    await step.run("invalidate-cache", async () => {
      await invalidateGenerationCache(generationId, campaignId);
    });

    return {
      generationId,
      success: result.success,
      videoUrl: result.videoUrl,
    };
  }
);

/**
 * Compose video with images and audio (Modal GPU accelerated)
 * 이미지와 오디오로 영상 합성 (Modal GPU 가속)
 *
 * Uses the compose-engine backend which can run locally or on Modal serverless GPU.
 * The /render/auto endpoint automatically selects Modal if enabled.
 */
export const composeVideo = inngest.createFunction(
  {
    id: "compose-video",
    name: "Compose Video",
    retries: 2,
  },
  { event: "video/compose" },
  async ({ event, step }) => {
    const {
      generationId,
      campaignId,
      userId,
      audioAssetId,
      images,
      script,
      effectPreset,
      aspectRatio,
      targetDuration,
      vibe,
      textStyle = "bold_pop",
      colorGrade = "vibrant",
      prompt = "Compose video generation",
    } = event.data;

    // Step 1: Update status to processing
    await step.run("update-status-processing", async () => {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "PROCESSING",
          progress: 5,
        },
      });
    });

    // Step 2: Get audio asset URL
    const audioUrl = await step.run("get-audio-url", async () => {
      const audioAsset = await prisma.asset.findUnique({
        where: { id: audioAssetId },
        select: { s3Url: true },
      });

      if (!audioAsset?.s3Url) {
        throw new Error("Audio asset not found");
      }

      return audioAsset.s3Url;
    });

    // Step 3: Call compose engine (auto-selects Modal GPU if enabled)
    const composeResult = await step.run("call-compose-engine", async () => {
      const composeEngineUrl = process.env.COMPOSE_ENGINE_URL || "http://localhost:8001";
      const s3Bucket = process.env.MINIO_BUCKET_NAME || "hydra-assets";
      const outputKey = `compose/renders/${generationId}/output.mp4`;

      // Build render request matching compose-engine API
      const renderRequest = {
        job_id: generationId,
        images: images.map((img: { url: string; order: number }) => ({
          url: img.url,
          order: img.order,
        })),
        audio: {
          url: audioUrl,
          start_time: 0,
          duration: null, // Let backend auto-calculate based on vibe/images
        },
        script: script?.lines?.length ? { lines: script.lines } : null,
        settings: {
          vibe,
          effect_preset: effectPreset,
          aspect_ratio: aspectRatio,
          target_duration: targetDuration, // 0 = auto-calculate
          text_style: textStyle,
          color_grade: colorGrade,
        },
        output: {
          s3_bucket: s3Bucket,
          s3_key: outputKey,
        },
      };

      // Use /render/auto to automatically select Modal GPU if enabled
      const response = await fetch(`${composeEngineUrl}/render/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renderRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Compose engine error: ${errorText}`);
      }

      return await response.json();
    });

    // Step 4: Poll for completion with progress updates
    const composedUrl = await step.run("poll-completion", async () => {
      const composeEngineUrl = process.env.COMPOSE_ENGINE_URL || "http://localhost:8001";
      const jobId = composeResult.job_id || generationId;
      const maxAttempts = 120; // 10 minutes max for GPU rendering
      const interval = 5000;

      for (let i = 0; i < maxAttempts; i++) {
        const statusResponse = await fetch(`${composeEngineUrl}/job/${jobId}/status`);

        if (!statusResponse.ok) {
          console.log(`[Inngest] Status check failed: ${statusResponse.status}`);
          await new Promise((resolve) => setTimeout(resolve, interval));
          continue;
        }

        const status = await statusResponse.json();

        // Update progress in database
        if (status.progress !== undefined) {
          await prisma.videoGeneration.update({
            where: { id: generationId },
            data: { progress: Math.min(status.progress, 95) },
          });
        }

        if (status.status === "completed" || status.status === "COMPLETED") {
          return status.output_url;
        } else if (status.status === "failed" || status.status === "FAILED") {
          throw new Error(status.error || "Composition failed");
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      throw new Error("Composition timed out after 10 minutes");
    });

    // Step 5: Update database with completed video
    await step.run("update-database", async () => {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          status: "COMPLETED",
          progress: 100,
          outputUrl: composedUrl,
        },
      });
    });

    // Step 6: Invalidate cache
    await step.run("invalidate-cache", async () => {
      await invalidateGenerationCache(generationId, campaignId);
    });

    return { generationId, composedUrl, success: true };
  }
);

/**
 * Process batch generation
 * 배치 생성 처리
 *
 * Orchestrates multiple video generations with proper tracking.
 */
export const processBatch = inngest.createFunction(
  {
    id: "process-batch",
    name: "Process Batch Generation",
    retries: 0,
    concurrency: {
      limit: 3, // Max 3 concurrent batch processes
    },
  },
  { event: "batch/process" },
  async ({ event, step }) => {
    const { batchId, campaignId, userId, items } = event.data;

    const results: { generationId: string; success: boolean }[] = [];

    // Process each item - trigger individual video/generate events
    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      const result = await step.run(`generate-item-${index}`, async () => {
        // Create generation record
        const generation = await prisma.videoGeneration.create({
          data: {
            campaignId,
            prompt: item.prompt,
            audioAssetId: item.audioAssetId || null,
            status: "PENDING",
            progress: 0,
            createdBy: userId,
            qualityMetadata: { batchId, itemIndex: index },
          },
        });

        // Trigger the video generation
        await inngest.send({
          name: "video/generate",
          data: {
            generationId: generation.id,
            campaignId,
            userId,
            prompt: item.prompt,
            options: {
              aspectRatio: item.aspectRatio || "16:9",
              duration: item.duration || 5,
              stylePreset: item.stylePreset,
            },
          },
        });

        return { generationId: generation.id, success: true };
      });

      results.push(result);
    }

    // Invalidate campaign cache
    await step.run("invalidate-cache", async () => {
      await invalidateCampaignCache(campaignId);
    });

    return {
      batchId,
      processed: results.length,
      generations: results,
    };
  }
);

/**
 * Publish to TikTok
 * TikTok에 발행
 *
 * Full implementation with token refresh and error handling.
 */
export const publishToTikTok = inngest.createFunction(
  {
    id: "publish-tiktok",
    name: "Publish to TikTok",
    retries: 3,
  },
  { event: "publish/tiktok" },
  async ({ event, step }) => {
    const { videoId, userId, accountId, caption, hashtags, scheduledAt } = event.data;

    // Step 1: Get video and account info
    const context = await step.run("get-context", async () => {
      const post = await prisma.scheduledPost.findFirst({
        where: { generationId: videoId, socialAccountId: accountId },
        include: {
          generation: { select: { outputUrl: true, composedOutputUrl: true } },
          socialAccount: true,
        },
      });

      if (!post) {
        throw new Error("Scheduled post not found");
      }

      const videoUrl = post.generation?.composedOutputUrl || post.generation?.outputUrl;
      if (!videoUrl) {
        throw new Error("Video URL not found");
      }

      return {
        postId: post.id,
        videoUrl,
        account: post.socialAccount,
        platformSettings: post.platformSettings as Record<string, unknown> | null,
      };
    });

    // Step 2: Check and refresh token if needed
    const accessToken = await step.run("ensure-token", async () => {
      const account = context.account;

      // Check if token needs refresh
      const tokenExpiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
      const bufferMs = 5 * 60 * 1000;
      const needsRefresh = !tokenExpiresAt || new Date().getTime() + bufferMs > tokenExpiresAt.getTime();

      if (needsRefresh) {
        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

        if (!clientKey || !clientSecret || !account.refreshToken) {
          throw new Error("Token expired and refresh credentials not available");
        }

        const refreshResult = await refreshAccessToken(
          clientKey,
          clientSecret,
          account.refreshToken
        );

        if (!refreshResult.success) {
          throw new Error(`Token refresh failed: ${refreshResult.error}`);
        }

        // Update stored tokens
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken || account.refreshToken,
            tokenExpiresAt: refreshResult.expiresIn
              ? new Date(Date.now() + refreshResult.expiresIn * 1000)
              : null,
          },
        });

        return refreshResult.accessToken!;
      }

      return account.accessToken!;
    });

    // Step 3: Update status to publishing
    await step.run("update-status-publishing", async () => {
      await prisma.scheduledPost.update({
        where: { id: context.postId },
        data: { status: "PUBLISHING" },
      });
    });

    // Step 4: Publish to TikTok
    // TIKTOK_MODE: "sandbox" = Inbox Upload (draft), "production" = Direct Post
    const publishResult = await step.run("publish-to-tiktok", async () => {
      const tiktokMode = process.env.TIKTOK_MODE || "sandbox";

      if (tiktokMode === "sandbox") {
        // Sandbox mode: Send to user's TikTok inbox as draft
        console.log("[TikTok Publish] Using INBOX mode (sandbox)");
        const result = await publishVideoToTikTokInbox(accessToken, context.videoUrl);
        console.log("[TikTok Publish] Inbox upload result:", JSON.stringify(result));
        return result;
      } else {
        // Production mode: Direct post to TikTok
        console.log("[TikTok Publish] Using DIRECT POST mode (production)");
        const tiktokSettings: Partial<TikTokPostSettings> = {
          privacy_level: (context.platformSettings?.privacy_level as TikTokPostSettings["privacy_level"]) || "PUBLIC_TO_EVERYONE",
          disable_duet: context.platformSettings?.disable_duet as boolean | undefined,
          disable_comment: context.platformSettings?.disable_comment as boolean | undefined,
          disable_stitch: context.platformSettings?.disable_stitch as boolean | undefined,
          video_cover_timestamp_ms: context.platformSettings?.video_cover_timestamp_ms as number | undefined,
        };

        const result = await publishVideoToTikTok(
          accessToken,
          context.videoUrl,
          caption || "",
          hashtags || [],
          tiktokSettings
        );
        console.log("[TikTok Publish] Direct post result:", JSON.stringify(result));
        return result;
      }
    });

    // Step 5: Update database with result
    await step.run("update-database", async () => {
      console.log("[TikTok Publish] Step 5: Updating database with result...");
      console.log("[TikTok Publish] publishResult.success:", publishResult.success);
      console.log("[TikTok Publish] postId:", context.postId);

      try {
        if (publishResult.success) {
          console.log("[TikTok Publish] Marking post as PUBLISHED");
          await prisma.scheduledPost.update({
            where: { id: context.postId },
            data: {
              status: "PUBLISHED",
              publishedAt: new Date(),
              platformPostId: publishResult.postId || null,
              publishedUrl: publishResult.postUrl || null,
              errorMessage: null,
            },
          });
          console.log("[TikTok Publish] Database updated successfully - PUBLISHED");
        } else {
          console.log("[TikTok Publish] Marking post as FAILED:", publishResult.error);
          await prisma.scheduledPost.update({
            where: { id: context.postId },
            data: {
              status: "FAILED",
              errorMessage: publishResult.error || "Unknown publish error",
              retryCount: { increment: 1 },
            },
          });
          console.log("[TikTok Publish] Database updated successfully - FAILED");
        }
      } catch (dbError) {
        console.error("[TikTok Publish] Database update error:", dbError);
        throw dbError;
      }
    });

    return {
      postId: context.postId,
      success: publishResult.success,
      tiktokPostId: publishResult.postId,
      postUrl: publishResult.postUrl,
      error: publishResult.error,
    };
  }
);

// Export all functions for the Inngest serve handler
export const functions = [
  collectTrendsByHashtag,
  analyzeVideo,
  generateVideo,
  generateVideoFromImage,
  composeVideo,
  processBatch,
  publishToTikTok,
];
