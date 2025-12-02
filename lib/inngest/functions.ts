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
import {
  publishVideoToTikTok,
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
 * Generate AI video with Veo
 * Veo로 AI 영상 생성
 *
 * Full implementation using the Veo service.
 */
export const generateVideo = inngest.createFunction(
  {
    id: "generate-video",
    name: "Generate AI Video",
    retries: 1,
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
          progress: 10,
        },
      });
    });

    // Step 2: Prepare Veo parameters and call API
    const result = await step.run("call-veo-api", async () => {
      const veoParams: VeoGenerationParams = {
        prompt,
        negativePrompt: options?.negativePrompt,
        durationSeconds: options?.duration || 5,
        aspectRatio: (options?.aspectRatio as "16:9" | "9:16" | "1:1") || "16:9",
        style: options?.stylePreset,
      };

      // Update progress to 50%
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: { progress: 50 },
      });

      return await generateVideoWithVeo(veoParams, campaignId);
    });

    // Step 3: Update database with result
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
            qualityScore: 75 + Math.floor(Math.random() * 20), // Will be replaced by AI scoring
            qualityMetadata: {
              ...existingMetadata,
              veoMetadata: result.metadata,
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

    // Step 4: Invalidate cache
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
 * Compose video with audio
 * 오디오와 함께 영상 합성
 */
export const composeVideo = inngest.createFunction(
  {
    id: "compose-video",
    name: "Compose Video",
    retries: 2,
  },
  { event: "video/compose" },
  async ({ event, step }) => {
    const { generationId, campaignId, userId, audioAssetId, options } = event.data;

    // Step 1: Get video and audio URLs
    const assets = await step.run("prepare-assets", async () => {
      const generation = await prisma.videoGeneration.findUnique({
        where: { id: generationId },
        select: { outputUrl: true },
      });

      const audioAsset = await prisma.asset.findUnique({
        where: { id: audioAssetId },
        select: { s3Url: true },
      });

      return {
        videoUrl: generation?.outputUrl,
        audioUrl: audioAsset?.s3Url,
      };
    });

    if (!assets.videoUrl || !assets.audioUrl) {
      throw new Error("Video or audio asset not found");
    }

    // Step 2: Call compose engine
    const composeResult = await step.run("call-compose-engine", async () => {
      const composeEngineUrl = process.env.COMPOSE_ENGINE_URL || "http://localhost:8001";

      const response = await fetch(`${composeEngineUrl}/render/async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: assets.videoUrl,
          audio_url: assets.audioUrl,
          campaign_id: campaignId,
          generation_id: generationId,
          options: options || {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Compose engine error: ${response.status}`);
      }

      return await response.json();
    });

    // Step 3: Poll for completion
    const composedUrl = await step.run("poll-completion", async () => {
      const composeEngineUrl = process.env.COMPOSE_ENGINE_URL || "http://localhost:8001";
      const jobId = composeResult.job_id;
      const maxAttempts = 60; // 5 minutes max
      const interval = 5000;

      for (let i = 0; i < maxAttempts; i++) {
        const statusResponse = await fetch(`${composeEngineUrl}/render/status/${jobId}`);
        const status = await statusResponse.json();

        if (status.status === "COMPLETED") {
          return status.output_url;
        } else if (status.status === "FAILED") {
          throw new Error(status.error || "Composition failed");
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      throw new Error("Composition timed out");
    });

    // Step 4: Update database
    await step.run("update-database", async () => {
      await prisma.videoGeneration.update({
        where: { id: generationId },
        data: {
          composedOutputUrl: composedUrl,
        },
      });
    });

    return { generationId, composedUrl };
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
    const publishResult = await step.run("publish-to-tiktok", async () => {
      const tiktokSettings: Partial<TikTokPostSettings> = {
        privacy_level: (context.platformSettings?.privacy_level as TikTokPostSettings["privacy_level"]) || "PUBLIC_TO_EVERYONE",
        disable_duet: context.platformSettings?.disable_duet as boolean | undefined,
        disable_comment: context.platformSettings?.disable_comment as boolean | undefined,
        disable_stitch: context.platformSettings?.disable_stitch as boolean | undefined,
        video_cover_timestamp_ms: context.platformSettings?.video_cover_timestamp_ms as number | undefined,
      };

      return await publishVideoToTikTok(
        accessToken,
        context.videoUrl,
        caption || "",
        hashtags || [],
        tiktokSettings
      );
    });

    // Step 5: Update database with result
    await step.run("update-database", async () => {
      if (publishResult.success) {
        await prisma.scheduledPost.update({
          where: { id: context.postId },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            platformPostId: publishResult.postId,
            publishedUrl: publishResult.postUrl,
            errorMessage: null,
          },
        });
      } else {
        await prisma.scheduledPost.update({
          where: { id: context.postId },
          data: {
            status: "FAILED",
            errorMessage: publishResult.error || "Unknown publish error",
            retryCount: { increment: 1 },
          },
        });
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
  composeVideo,
  processBatch,
  publishToTikTok,
];
