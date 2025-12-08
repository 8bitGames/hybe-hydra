/**
 * Video Analysis API
 * Analyzes TikTok videos to extract style and content for prompt generation
 * Includes caching to avoid repeated analysis of the same video
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { analyzeTikTokVideo, isValidTikTokUrl, TikTokAnalysisResult } from "@/lib/tiktok-analyzer";
import { cacheImageToS3 } from "@/lib/storage";

export const maxDuration = 60; // Allow longer execution for video analysis

// Cache TTL: 7 days
const CACHE_TTL_DAYS = 7;

/**
 * Generate MD5 hash for URL-based cache lookup
 */
function generateUrlHash(url: string): string {
  return createHash("md5").update(url).digest("hex");
}

/**
 * Normalize TikTok URL to canonical form for consistent caching
 */
function normalizeUrl(url: string): string {
  // Remove query parameters and fragments for consistent caching
  try {
    const parsed = new URL(url);
    // Keep only the pathname for TikTok URLs
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Build response data from cache or fresh analysis
 */
function buildResponseData(
  metadata: TikTokAnalysisResult["metadata"],
  styleAnalysis: TikTokAnalysisResult["style_analysis"],
  contentAnalysis: TikTokAnalysisResult["content_analysis"],
  suggestedPrompt: string | undefined,
  promptElements: TikTokAnalysisResult["prompt_elements"],
  isComposeVideo: boolean,
  imageCount: number,
  conceptDetails: Record<string, unknown>
) {
  return {
    metadata,
    style_analysis: styleAnalysis,
    content_analysis: contentAnalysis,
    suggested_prompt: suggestedPrompt,
    prompt_elements: promptElements,
    isComposeVideo,
    imageCount,
    conceptDetails,
  };
}

// POST /api/v1/analyze-video
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, skipCache = false } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate TikTok URL
    if (!isValidTikTokUrl(url)) {
      return NextResponse.json(
        { error: "Invalid TikTok URL. Please provide a valid TikTok video URL." },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    const urlHash = generateUrlHash(normalizedUrl);

    console.log("[API] Analyzing video:", url, "| Hash:", urlHash);

    // Check cache first (unless skipCache is true)
    if (!skipCache) {
      try {
        const cached = await prisma.tikTokVideoAnalysisCache.findFirst({
          where: {
            videoUrlHash: urlHash,
            expiresAt: {
              gt: new Date(),
            },
          },
        });

        if (cached) {
          console.log("[API] Cache hit for video:", url);

          // Update hit count and last used timestamp
          await prisma.tikTokVideoAnalysisCache.update({
            where: { id: cached.id },
            data: {
              hitCount: { increment: 1 },
              lastUsedAt: new Date(),
            },
          });

          // Build metadata from cached data
          const cachedMetadata = {
            id: cached.videoId || "",
            description: cached.description || "",
            hashtags: cached.hashtags,
            author: {
              username: cached.authorUsername || "",
              nickname: cached.authorNickname || "",
            },
            music: cached.musicTitle ? {
              title: cached.musicTitle,
              author: cached.musicAuthor || "",
            } : undefined,
            stats: {
              plays: Number(cached.playCount || 0),
              likes: Number(cached.likeCount || 0),
              comments: Number(cached.commentCount || 0),
              shares: Number(cached.shareCount || 0),
            },
            duration: cached.duration || 0,
            thumbnail_url: cached.thumbnailS3Url || "",
            video_url: cached.videoUrl,
            is_photo_post: cached.isPhotoPost,
            image_urls: cached.imageUrls,
          };

          const responseData = buildResponseData(
            cachedMetadata,
            cached.styleAnalysis as unknown as TikTokAnalysisResult["style_analysis"],
            cached.contentAnalysis as unknown as TikTokAnalysisResult["content_analysis"],
            cached.suggestedPrompt || undefined,
            cached.promptElements as unknown as TikTokAnalysisResult["prompt_elements"],
            cached.isPhotoPost || (cached.imageUrls && cached.imageUrls.length > 1),
            cached.imageCount,
            (cached.conceptDetails as unknown as Record<string, unknown>) || {}
          );

          return NextResponse.json({
            success: true,
            cached: true,
            data: responseData,
          });
        }
      } catch (cacheError) {
        console.warn("[API] Cache lookup failed, proceeding with fresh analysis:", cacheError);
      }
    }

    // Analyze the video (fresh analysis)
    console.log("[API] Cache miss, performing fresh analysis for:", url);
    const result: TikTokAnalysisResult = await analyzeTikTokVideo(url);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to analyze video" },
        { status: 500 }
      );
    }

    // Determine if this is a compose video (slideshow/photo post with multiple images)
    const isComposeVideo: boolean = result.metadata?.is_photo_post === true ||
                          (result.metadata?.image_urls && result.metadata.image_urls.length > 1) || false;

    // Build concept details
    const conceptDetails = {
      visualStyle: result.style_analysis?.visual_style,
      colorPalette: result.style_analysis?.color_palette,
      lighting: result.style_analysis?.lighting,
      cameraMovement: result.style_analysis?.camera_movement,
      transitions: result.style_analysis?.transitions,
      effects: result.style_analysis?.effects,
      mood: result.style_analysis?.mood,
      pace: result.style_analysis?.pace,
      mainSubject: result.content_analysis?.main_subject,
      actions: result.content_analysis?.actions,
      setting: result.content_analysis?.setting,
      props: result.content_analysis?.props,
      clothingStyle: result.content_analysis?.clothing_style,
    };

    // Cache to S3 and database (async, don't block response)
    const cachePromise = (async () => {
      try {
        // Cache thumbnail to S3 if available
        let thumbnailS3Url: string | undefined;
        let thumbnailS3Key: string | undefined;

        if (result.metadata?.thumbnail_url) {
          const cacheResult = await cacheImageToS3(
            result.metadata.thumbnail_url,
            "cache/tiktok-thumbnails"
          );
          if (cacheResult.success) {
            thumbnailS3Url = cacheResult.url;
            thumbnailS3Key = cacheResult.key;
          }
        }

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

        // Save to database
        await prisma.tikTokVideoAnalysisCache.upsert({
          where: { videoUrl: normalizedUrl },
          create: {
            videoUrl: normalizedUrl,
            videoUrlHash: urlHash,
            videoId: result.metadata?.id,
            thumbnailS3Url,
            thumbnailS3Key,
            authorUsername: result.metadata?.author?.username,
            authorNickname: result.metadata?.author?.nickname,
            description: result.metadata?.description,
            hashtags: result.metadata?.hashtags || [],
            musicTitle: result.metadata?.music?.title,
            musicAuthor: result.metadata?.music?.author,
            duration: result.metadata?.duration,
            playCount: result.metadata?.stats?.plays ? BigInt(result.metadata.stats.plays) : null,
            likeCount: result.metadata?.stats?.likes ? BigInt(result.metadata.stats.likes) : null,
            commentCount: result.metadata?.stats?.comments ? BigInt(result.metadata.stats.comments) : null,
            shareCount: result.metadata?.stats?.shares ? BigInt(result.metadata.stats.shares) : null,
            isPhotoPost: result.metadata?.is_photo_post || false,
            imageUrls: result.metadata?.image_urls || [],
            imageCount: result.metadata?.image_urls?.length || 0,
            styleAnalysis: result.style_analysis ? (result.style_analysis as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            contentAnalysis: result.content_analysis ? (result.content_analysis as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            promptElements: result.prompt_elements ? (result.prompt_elements as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            suggestedPrompt: result.suggested_prompt,
            conceptDetails: conceptDetails as unknown as Prisma.InputJsonValue,
            expiresAt,
          },
          update: {
            videoUrlHash: urlHash,
            videoId: result.metadata?.id,
            thumbnailS3Url,
            thumbnailS3Key,
            authorUsername: result.metadata?.author?.username,
            authorNickname: result.metadata?.author?.nickname,
            description: result.metadata?.description,
            hashtags: result.metadata?.hashtags || [],
            musicTitle: result.metadata?.music?.title,
            musicAuthor: result.metadata?.music?.author,
            duration: result.metadata?.duration,
            playCount: result.metadata?.stats?.plays ? BigInt(result.metadata.stats.plays) : null,
            likeCount: result.metadata?.stats?.likes ? BigInt(result.metadata.stats.likes) : null,
            commentCount: result.metadata?.stats?.comments ? BigInt(result.metadata.stats.comments) : null,
            shareCount: result.metadata?.stats?.shares ? BigInt(result.metadata.stats.shares) : null,
            isPhotoPost: result.metadata?.is_photo_post || false,
            imageUrls: result.metadata?.image_urls || [],
            imageCount: result.metadata?.image_urls?.length || 0,
            styleAnalysis: result.style_analysis ? (result.style_analysis as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            contentAnalysis: result.content_analysis ? (result.content_analysis as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            promptElements: result.prompt_elements ? (result.prompt_elements as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            suggestedPrompt: result.suggested_prompt,
            conceptDetails: conceptDetails as unknown as Prisma.InputJsonValue,
            expiresAt,
            hitCount: 0,
            lastUsedAt: new Date(),
          },
        });

        console.log("[API] Successfully cached video analysis:", normalizedUrl);
      } catch (cacheError) {
        console.error("[API] Failed to cache video analysis:", cacheError);
        // Don't throw - caching failure shouldn't affect the response
      }
    })();

    // Wait for cache to complete (to ensure data is saved before response)
    await cachePromise;

    const responseData = buildResponseData(
      result.metadata,
      result.style_analysis,
      result.content_analysis,
      result.suggested_prompt,
      result.prompt_elements,
      isComposeVideo,
      result.metadata?.image_urls?.length || 0,
      conceptDetails
    );

    return NextResponse.json({
      success: true,
      cached: false,
      data: responseData,
    });
  } catch (error) {
    console.error("[API] Video analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
