/**
 * TikTok Video Analyzer Service
 * Downloads TikTok videos and analyzes them using Gemini Vision via TikTokVisionAgent
 */

import { getTikTokVisionAgent } from "@/lib/agents/analyzers/tiktok-vision";
import type { AgentContext } from "@/lib/agents/types";
import { z } from "zod";
import { SceneBreakdownSchema, SpatialCompositionSchema } from "@/lib/agents/analyzers/tiktok-vision";

// Types for scene breakdown and spatial composition
type SceneBreakdown = z.infer<typeof SceneBreakdownSchema>;
type SpatialComposition = z.infer<typeof SpatialCompositionSchema>;

// TikTok API types
interface TikTokAuthor {
  uid: string;
  username: string;
  nickname: string;
  signature: string;
  avatar: string;
}

interface TikTokMusic {
  id: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
}

interface TikTokStats {
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

interface TikTokVideo {
  duration: number;
  ratio: string;
  cover: string;
  playAddr: string[];
  downloadAddr: string[];
}

interface TikTokDownloadResult {
  status: "success" | "error";
  message?: string;
  result?: {
    type: "video" | "image";
    id: string;
    createTime: number;
    description: string;
    hashtag: string[];
    isADS: boolean;
    author: TikTokAuthor;
    statistics: TikTokStats;
    video?: TikTokVideo;
    music?: TikTokMusic;
  };
}

// Analysis result types
export interface VideoStyleAnalysis {
  visual_style: string;
  color_palette: string[];
  lighting: string;
  camera_movement: string[];
  transitions: string[];
  mood: string;
  pace: string;
  effects: string[];
}

export interface VideoContentAnalysis {
  main_subject: string;
  actions: string[];
  setting: string;
  props: string[];
  clothing_style: string;
}

export interface TikTokAnalysisResult {
  success: boolean;
  error?: string;
  metadata?: {
    id: string;
    description: string;
    hashtags: string[];
    author: {
      username: string;
      nickname: string;
    };
    music?: {
      title: string;
      author: string;
    };
    stats: {
      plays: number;
      likes: number;
      comments: number;
      shares: number;
    };
    duration: number;
    thumbnail_url: string;
    video_url: string;
    // Compose video detection
    is_photo_post: boolean;
    image_urls: string[];
  };
  style_analysis?: VideoStyleAnalysis;
  content_analysis?: VideoContentAnalysis;
  suggested_prompt?: string;
  prompt_elements?: {
    style_keywords: string[];
    mood_keywords: string[];
    action_keywords: string[];
    technical_suggestions: {
      aspect_ratio: string;
      duration: number;
      camera_style: string;
    };
  };
  // NEW: Enhanced fields for precise video recreation (100% clone support)
  scene_breakdown?: SceneBreakdown[];
  spatial_composition?: SpatialComposition;
}

// Create agent context for TikTok analysis
const createAgentContext = (videoId?: string): AgentContext => ({
  workflow: {
    artistName: 'TikTok Analysis',
    platform: 'tiktok',
    language: 'en',
    sessionId: `tiktok-analysis-${videoId || Date.now()}`,
  },
});

/**
 * Download TikTok video and extract metadata
 */
export async function downloadTikTok(url: string): Promise<{
  success: boolean;
  error?: string;
  data?: TikTokDownloadResult["result"];
}> {
  try {
    // Dynamic import for the TikTok downloader
    const TiktokDL = await import("@tobyg74/tiktok-api-dl");
    const Tiktok = TiktokDL.default || TiktokDL;

    console.log("[TIKTOK] Downloading from:", url);

    // Try v1 first (most documented), fallback to v2, then v3
    let result: TikTokDownloadResult;

    // Try v1 first with showOriginalResponse for more data
    result = await Tiktok.Downloader(url, {
      version: "v1",
      showOriginalResponse: true,
    }) as TikTokDownloadResult;
    console.log("[TIKTOK] v1 result status:", result.status);

    // If v1 fails, try v2
    if (result.status !== "success" || !result.result) {
      console.log("[TIKTOK] v1 failed, trying v2...");
      result = await Tiktok.Downloader(url, {
        version: "v2",
      }) as TikTokDownloadResult;
      console.log("[TIKTOK] v2 result status:", result.status);
    }

    // If v2 fails, try v3
    if (result.status !== "success" || !result.result) {
      console.log("[TIKTOK] v2 failed, trying v3...");
      result = await Tiktok.Downloader(url, {
        version: "v3",
      }) as TikTokDownloadResult;
      console.log("[TIKTOK] v3 result status:", result.status);
    }

    console.log("[TIKTOK] Download result status:", result.status);
    console.log("[TIKTOK] Full response:", JSON.stringify(result, null, 2));

    if (result.status !== "success" || !result.result) {
      return {
        success: false,
        error: result.message || "Failed to download TikTok video",
      };
    }

    console.log("[TIKTOK] Result keys:", Object.keys(result.result));

    return {
      success: true,
      data: result.result,
    };
  } catch (error) {
    console.error("[TIKTOK] Download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to download TikTok",
    };
  }
}

/**
 * Analyze video content using TikTokVisionAgent
 * Uses Gemini 2.5 Flash with video support via inline base64
 */
export async function analyzeVideoWithGemini(
  videoUrl: string,
  metadata: {
    description: string;
    hashtags: string[];
    musicTitle?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
  style_analysis?: VideoStyleAnalysis;
  content_analysis?: VideoContentAnalysis;
  suggested_prompt?: string;
  prompt_elements?: TikTokAnalysisResult["prompt_elements"];
  scene_breakdown?: SceneBreakdown[];
  spatial_composition?: SpatialComposition;
}> {
  try {
    // Download video and convert to base64
    console.log("[TIKTOK-VISION] ========================================");
    console.log("[TIKTOK-VISION] Starting video analysis");
    console.log("[TIKTOK-VISION] Video URL:", videoUrl?.slice(0, 100));

    const videoResponse = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!videoResponse.ok) {
      console.error("[TIKTOK-VISION] Failed to fetch video:", videoResponse.status, videoResponse.statusText);
      throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    const contentType = videoResponse.headers.get("content-type") || "video/mp4";
    console.log("[TIKTOK-VISION] Content-Type:", contentType);

    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString("base64");
    const videoSize = videoBuffer.byteLength / (1024 * 1024);

    console.log(`[TIKTOK-VISION] Video downloaded: ${videoSize.toFixed(2)} MB`);
    console.log(`[TIKTOK-VISION] Base64 length: ${videoBase64.length} characters`);

    // Gemini 2.5 Flash supports inline videos up to ~50MB
    // But for reliability, we'll use 30MB as the limit
    const MAX_VIDEO_SIZE_MB = 30;
    if (videoSize > MAX_VIDEO_SIZE_MB) {
      console.warn(`[TIKTOK-VISION] Video too large (${videoSize.toFixed(2)}MB > ${MAX_VIDEO_SIZE_MB}MB), using metadata-only analysis`);
      return analyzeFromMetadataOnly(metadata);
    }

    // Determine proper MIME type
    let mimeType = "video/mp4";
    if (contentType.includes("video/")) {
      mimeType = contentType.split(";")[0].trim();
    }
    console.log("[TIKTOK-VISION] Using MIME type:", mimeType);

    // Call the agent
    console.log("[TIKTOK-VISION] Calling TikTokVisionAgent...");
    const agent = getTikTokVisionAgent();
    const context = createAgentContext();

    const result = await agent.analyzeVideo(
      videoBase64,
      mimeType,
      {
        mediaType: 'video',
        description: metadata.description,
        hashtags: metadata.hashtags,
        musicTitle: metadata.musicTitle,
      },
      context
    );

    if (!result.success || !result.data) {
      console.error("[TIKTOK-VISION] ❌ Agent returned error:", result.error);
      console.error("[TIKTOK-VISION] Full result:", JSON.stringify(result, null, 2).slice(0, 500));
      console.log("[TIKTOK-VISION] Falling back to metadata-only analysis due to agent error");
      return analyzeFromMetadataOnly(metadata);
    }

    const analysis = result.data;
    console.log("[TIKTOK-VISION] ✅ Analysis successful!");
    console.log("[TIKTOK-VISION] Main subject:", analysis.content_analysis?.main_subject?.slice(0, 100));
    console.log("[TIKTOK-VISION] Setting:", analysis.content_analysis?.setting?.slice(0, 100));
    console.log("[TIKTOK-VISION] Visual style:", analysis.style_analysis?.visual_style?.slice(0, 100));
    console.log("[TIKTOK-VISION] ========================================");

    return {
      success: true,
      style_analysis: analysis.style_analysis,
      content_analysis: analysis.content_analysis,
      suggested_prompt: analysis.suggested_prompt,
      prompt_elements: analysis.prompt_elements,
      // NEW: Enhanced fields for precise recreation
      scene_breakdown: analysis.scene_breakdown,
      spatial_composition: analysis.spatial_composition,
    };
  } catch (error) {
    console.error("[TIKTOK-VISION] ❌ Analysis error:", error);
    console.error("[TIKTOK-VISION] Error stack:", error instanceof Error ? error.stack : "No stack");

    // Fallback to metadata-only analysis
    console.log("[TIKTOK-VISION] Falling back to metadata-only analysis due to exception");
    return analyzeFromMetadataOnly(metadata);
  }
}

/**
 * Analyze image content using TikTokVisionAgent (for photo/slideshow posts)
 */
export async function analyzeImageWithGemini(
  imageUrl: string,
  metadata: {
    description: string;
    hashtags: string[];
    musicTitle?: string;
    isSlideshow?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
  style_analysis?: VideoStyleAnalysis;
  content_analysis?: VideoContentAnalysis;
  suggested_prompt?: string;
  prompt_elements?: TikTokAnalysisResult["prompt_elements"];
  // NEW: Optional fields for video recreation (images don't have scene breakdown)
  scene_breakdown?: SceneBreakdown[];
  spatial_composition?: SpatialComposition;
}> {
  try {
    // Download image and convert to base64
    console.log("[TIKTOK-VISION] Fetching image for analysis:", imageUrl);

    const imageResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

    console.log(`[TIKTOK-VISION] Image size: ${(imageBuffer.byteLength / 1024).toFixed(2)} KB`);

    // Call the agent
    const agent = getTikTokVisionAgent();
    const context = createAgentContext();
    const result = await agent.analyzeImage(
      imageBase64,
      contentType,
      {
        mediaType: 'image',
        description: metadata.description,
        hashtags: metadata.hashtags,
        musicTitle: metadata.musicTitle,
        isSlideshow: metadata.isSlideshow,
      },
      context
    );

    if (!result.success || !result.data) {
      console.error("[TIKTOK-VISION] Agent error:", result.error);
      return analyzeFromMetadataOnly(metadata);
    }

    const analysis = result.data;
    console.log("[TIKTOK-VISION] Image analysis complete");
    console.log("[TIKTOK-VISION] suggested_prompt:", analysis.suggested_prompt?.slice(0, 200));

    return {
      success: true,
      style_analysis: analysis.style_analysis,
      content_analysis: analysis.content_analysis,
      suggested_prompt: analysis.suggested_prompt,
      prompt_elements: analysis.prompt_elements,
    };
  } catch (error) {
    console.error("[TIKTOK-VISION] Image analysis error:", error);

    // Fallback to metadata-only analysis
    console.log("[TIKTOK-VISION] Falling back to metadata-only analysis");
    return analyzeFromMetadataOnly(metadata);
  }
}

/**
 * Fallback analysis using only metadata (no video)
 * This is used when video/image analysis fails - extracts as much context as possible from text
 */
function analyzeFromMetadataOnly(metadata: {
  description: string;
  hashtags: string[];
  musicTitle?: string;
}): {
  success: boolean;
  style_analysis?: VideoStyleAnalysis;
  content_analysis?: VideoContentAnalysis;
  suggested_prompt?: string;
  prompt_elements?: TikTokAnalysisResult["prompt_elements"];
  // NEW: Optional fields for video recreation (will be undefined for metadata-only analysis)
  scene_breakdown?: SceneBreakdown[];
  spatial_composition?: SpatialComposition;
} {
  console.log("[FALLBACK] Using metadata-only analysis - Vision AI analysis failed or unavailable");
  console.log("[FALLBACK] Description:", metadata.description?.slice(0, 100));
  console.log("[FALLBACK] Hashtags:", metadata.hashtags.join(", "));

  const hashtagsLower = metadata.hashtags.map((h) => h.toLowerCase());
  const descLower = (metadata.description || "").toLowerCase();

  const styleKeywords: string[] = [];
  const moodKeywords: string[] = [];
  const actionKeywords: string[] = [];
  let visualStyle = "short-form social media content";
  let mood = "engaging";
  let setting = "indoor setting (details unavailable - video analysis required)";
  let mainSubject = "content creator (details unavailable - video analysis required)";
  let clothingStyle = "casual contemporary style";

  // Enhanced hashtag-based style detection
  if (hashtagsLower.some((h) => h.includes("aesthetic") || h.includes("vibe") || h.includes("mood"))) {
    styleKeywords.push("aesthetic", "curated visuals");
    visualStyle = "curated aesthetic style with intentional color grading";
  }
  if (hashtagsLower.some((h) => h.includes("cinematic") || h.includes("film"))) {
    styleKeywords.push("cinematic", "film-inspired");
    visualStyle = "cinematic style with dramatic framing";
  }
  if (hashtagsLower.some((h) => h.includes("dance") || h.includes("choreo") || h.includes("moves"))) {
    actionKeywords.push("dancing", "rhythmic movement", "choreography");
    moodKeywords.push("energetic", "dynamic");
    mood = "high-energy and dynamic";
  }
  if (hashtagsLower.some((h) => h.includes("country") || h.includes("nashville") || h.includes("western"))) {
    styleKeywords.push("country aesthetic", "rustic warmth");
    visualStyle = "warm country aesthetic with natural tones";
    moodKeywords.push("warm", "authentic");
    mood = "warm and authentic";
    setting = "rustic or countryside setting";
    clothingStyle = "country/western style clothing";
  }
  if (hashtagsLower.some((h) => h.includes("makeup") || h.includes("beauty") || h.includes("skincare"))) {
    actionKeywords.push("beauty demonstration", "close-up shots");
    styleKeywords.push("beauty content", "well-lit");
    setting = "well-lit vanity or bathroom setting";
  }
  if (hashtagsLower.some((h) => h.includes("cooking") || h.includes("recipe") || h.includes("food"))) {
    actionKeywords.push("cooking demonstration", "food preparation");
    styleKeywords.push("food content", "appetizing presentation");
    setting = "kitchen or dining area";
  }
  if (hashtagsLower.some((h) => h.includes("fitness") || h.includes("workout") || h.includes("gym"))) {
    actionKeywords.push("exercise movements", "workout demonstration");
    moodKeywords.push("motivational", "energetic");
    setting = "gym or workout space";
    clothingStyle = "athletic wear";
  }
  if (hashtagsLower.some((h) => h.includes("travel") || h.includes("vacation") || h.includes("explore"))) {
    styleKeywords.push("travel content", "scenic views");
    setting = "travel destination or scenic location";
    moodKeywords.push("adventurous", "wanderlust");
  }
  if (hashtagsLower.some((h) => h.includes("comedy") || h.includes("funny") || h.includes("humor"))) {
    moodKeywords.push("humorous", "lighthearted");
    mood = "comedic and entertaining";
  }

  // Extract context from description
  if (descLower.includes("new year") || descLower.includes("happy new year")) {
    moodKeywords.push("celebratory", "festive");
    mood = "celebratory and festive";
  }

  // Add defaults if arrays are still empty
  if (styleKeywords.length === 0) styleKeywords.push("modern social media style", "vertical video format");
  if (moodKeywords.length === 0) moodKeywords.push("engaging", "attention-grabbing");
  if (actionKeywords.length === 0) actionKeywords.push("expressive performance", "direct camera engagement");

  const result = {
    success: true,
    style_analysis: {
      visual_style: visualStyle,
      color_palette: ["vibrant tones", "platform-optimized contrast", "saturated colors"],
      lighting: "standard ring light or natural window light",
      camera_movement: ["mostly static with occasional subtle movement"],
      transitions: ["quick cuts", "beat-synced edits"],
      mood: mood,
      pace: "fast-paced with attention to viewer retention",
      effects: ["standard color grading", "possible text overlays"],
    },
    content_analysis: {
      main_subject: mainSubject,
      actions: actionKeywords,
      setting: setting,
      props: ["(props unavailable - video analysis required)"],
      clothing_style: clothingStyle,
    },
    suggested_prompt: `Create a ${visualStyle} TikTok-style video. ${actionKeywords.join(", ")}. ${mood} mood. Based on: "${metadata.description?.slice(0, 200) || 'short-form social content'}"`,
    prompt_elements: {
      style_keywords: styleKeywords,
      mood_keywords: moodKeywords,
      action_keywords: actionKeywords,
      technical_suggestions: {
        aspect_ratio: "9:16",
        duration: 8,
        camera_style: "static or subtle handheld movement",
      },
    },
  };

  console.log("[FALLBACK] Generated analysis from metadata:", {
    visualStyle,
    mood,
    mainSubject: mainSubject.slice(0, 50),
    setting: setting.slice(0, 50),
  });

  return result;
}

/**
 * Full TikTok analysis pipeline
 */
export async function analyzeTikTokVideo(url: string): Promise<TikTokAnalysisResult> {
  console.log("[ANALYZER] Starting TikTok analysis for:", url);

  // Step 1: Download and get metadata
  const downloadResult = await downloadTikTok(url);

  if (!downloadResult.success || !downloadResult.data) {
    return {
      success: false,
      error: downloadResult.error || "Failed to download TikTok video",
    };
  }

  const data = downloadResult.data as Record<string, unknown>;

  console.log("[ANALYZER] Raw data keys:", Object.keys(data));

  // Extract metadata - handle different API version response structures
  // v1/v2 might use different field names than v3
  const getVideoUrl = (): string => {
    // Try various possible paths for video URL
    const video = data.video as Record<string, unknown> | undefined;
    if (video) {
      const playAddr = video.playAddr as string[] | string | undefined;
      const downloadAddr = video.downloadAddr as string[] | string | undefined;
      const play = video.play as string | undefined;
      const wmplay = video.wmplay as string | undefined;
      const hdplay = video.hdplay as string | undefined;

      if (Array.isArray(playAddr) && playAddr[0]) return playAddr[0];
      if (typeof playAddr === "string") return playAddr;
      if (Array.isArray(downloadAddr) && downloadAddr[0]) return downloadAddr[0];
      if (typeof downloadAddr === "string") return downloadAddr;
      if (play) return play;
      if (hdplay) return hdplay;
      if (wmplay) return wmplay;
    }
    // Direct fields (some versions)
    if (typeof data.play === "string") return data.play;
    if (typeof data.hdplay === "string") return data.hdplay;
    if (typeof data.wmplay === "string") return data.wmplay;
    return "";
  };

  const getThumbnail = (): string => {
    const video = data.video as Record<string, unknown> | undefined;
    if (video?.cover) return video.cover as string;
    if (video?.originCover) return video.originCover as string;
    if (data.cover) return data.cover as string;
    if (data.origin_cover) return data.origin_cover as string;
    return "";
  };

  const getHashtags = (): string[] => {
    if (Array.isArray(data.hashtag)) return data.hashtag;
    if (Array.isArray(data.hashtags)) return data.hashtags;
    // Extract from description
    const desc = (data.description || data.desc || "") as string;
    const hashtagMatches = desc.match(/#[\w가-힣]+/g) || [];
    return hashtagMatches.map(h => h.replace("#", ""));
  };

  // Parse formatted numbers like "355.6K", "1.7M" to actual numbers
  const parseFormattedNumber = (value: unknown): number => {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return 0;

    const str = value.trim().toUpperCase();
    const num = parseFloat(str);
    if (isNaN(num)) return 0;

    if (str.endsWith("K")) return num * 1000;
    if (str.endsWith("M")) return num * 1000000;
    if (str.endsWith("B")) return num * 1000000000;
    return num;
  };

  const getStats = () => {
    const stats = data.statistics as Record<string, unknown> | undefined;
    if (stats) {
      return {
        plays: parseFormattedNumber(stats.plays || stats.playCount),
        likes: parseFormattedNumber(stats.likes || stats.likeCount || stats.diggCount),
        comments: parseFormattedNumber(stats.comments || stats.commentCount),
        shares: parseFormattedNumber(stats.shares || stats.shareCount),
      };
    }
    return {
      plays: parseFormattedNumber(data.playCount || data.plays),
      likes: parseFormattedNumber(data.likeCount || data.likes || data.diggCount),
      comments: parseFormattedNumber(data.commentCount || data.comments),
      shares: parseFormattedNumber(data.shareCount || data.shares),
    };
  };

  const getAuthor = () => {
    const author = data.author as Record<string, string> | undefined;
    if (author) {
      return {
        username: author.username || author.uniqueId || "",
        nickname: author.nickname || author.name || "",
      };
    }
    return {
      username: (data.username || data.uniqueId || "") as string,
      nickname: (data.nickname || "") as string,
    };
  };

  const getMusic = () => {
    const music = data.music as Record<string, string> | undefined;
    if (music) {
      return {
        title: music.title || music.name || "",
        author: music.author || music.authorName || "",
      };
    }
    return undefined;
  };

  const getDuration = (): number => {
    const video = data.video as Record<string, number> | undefined;
    if (video?.duration) return video.duration;
    if (typeof data.duration === "number") return data.duration;
    return 0;
  };

  // Check if this is a photo/slideshow post
  const getImageUrls = (): string[] => {
    // Check for image type post
    if (data.type === "image" || data.imagePost) {
      // Try different image field structures
      const images = data.images as Array<{ url?: string; displayImage?: string }> | undefined;
      if (Array.isArray(images)) {
        return images
          .map(img => img.url || img.displayImage || "")
          .filter(url => url.length > 0);
      }
      // Some versions use imagePost.images
      const imagePost = data.imagePost as { images?: Array<{ url?: string }> } | undefined;
      if (imagePost?.images) {
        return imagePost.images
          .map(img => img.url || "")
          .filter(url => url.length > 0);
      }
    }
    // Check for cover images as fallback
    const covers = data.covers as string[] | undefined;
    if (Array.isArray(covers) && covers.length > 0) {
      return covers;
    }
    return [];
  };

  const isPhotoPost = data.type === "image" || !!data.imagePost || getImageUrls().length > 0;
  const imageUrls = getImageUrls();

  const metadata = {
    id: (data.id || data.aweme_id || "") as string,
    description: (data.description || data.desc || "") as string,
    hashtags: getHashtags(),
    author: getAuthor(),
    music: getMusic(),
    stats: getStats(),
    duration: getDuration(),
    thumbnail_url: getThumbnail(),
    video_url: getVideoUrl(),
    is_photo_post: isPhotoPost,
    image_urls: imageUrls,
  };

  console.log("[ANALYZER] Metadata extracted:", {
    id: metadata.id,
    description: metadata.description?.slice(0, 50),
    hashtags: metadata.hashtags,
    duration: metadata.duration,
    hasVideoUrl: !!metadata.video_url,
    videoUrl: metadata.video_url?.slice(0, 100),
    thumbnail: metadata.thumbnail_url?.slice(0, 100),
    stats: metadata.stats,
    isPhotoPost: isPhotoPost,
    imageCount: imageUrls.length,
  });

  // Step 2: Analyze with Gemini
  let analysisResult: {
    success: boolean;
    error?: string;
    style_analysis?: VideoStyleAnalysis;
    content_analysis?: VideoContentAnalysis;
    suggested_prompt?: string;
    prompt_elements?: TikTokAnalysisResult["prompt_elements"];
    scene_breakdown?: SceneBreakdown[];
    spatial_composition?: SpatialComposition;
  };

  if (metadata.video_url) {
    // Video analysis
    analysisResult = await analyzeVideoWithGemini(metadata.video_url, {
      description: metadata.description,
      hashtags: metadata.hashtags,
      musicTitle: metadata.music?.title,
    });
  } else if (metadata.is_photo_post && (metadata.image_urls.length > 0 || metadata.thumbnail_url)) {
    // Photo/slideshow analysis - use images or thumbnail
    const imageUrl = metadata.image_urls[0] || metadata.thumbnail_url;
    analysisResult = await analyzeImageWithGemini(imageUrl, {
      description: metadata.description,
      hashtags: metadata.hashtags,
      musicTitle: metadata.music?.title,
      isSlideshow: metadata.image_urls.length > 1,
    });
  } else {
    // Fallback to metadata-only analysis
    analysisResult = analyzeFromMetadataOnly({
      description: metadata.description,
      hashtags: metadata.hashtags,
      musicTitle: metadata.music?.title,
    });
  }

  const finalResult = {
    success: true,
    metadata,
    style_analysis: analysisResult.style_analysis,
    content_analysis: analysisResult.content_analysis,
    suggested_prompt: analysisResult.suggested_prompt,
    prompt_elements: analysisResult.prompt_elements,
    // NEW: Enhanced fields for precise video recreation (100% clone support)
    scene_breakdown: analysisResult.scene_breakdown,
    spatial_composition: analysisResult.spatial_composition,
  };

  console.log("[ANALYZER] Final result:", {
    success: finalResult.success,
    hasMetadata: !!finalResult.metadata,
    hasStyleAnalysis: !!finalResult.style_analysis,
    hasSuggestedPrompt: !!finalResult.suggested_prompt,
    suggestedPromptPreview: finalResult.suggested_prompt?.slice(0, 100),
    promptElementsKeys: finalResult.prompt_elements ? Object.keys(finalResult.prompt_elements) : [],
    // NEW: Enhanced recreation fields
    sceneBreakdownCount: finalResult.scene_breakdown?.length || 0,
    hasSpatialComposition: !!finalResult.spatial_composition,
  });

  return finalResult;
}

/**
 * Check if URL is a valid TikTok URL
 * Supports: /video/, /photo/, short URLs (vm.tiktok.com, vt.tiktok.com, /t/)
 */
export function isValidTikTokUrl(url: string): boolean {
  const tiktokPatterns = [
    /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/photo\/\d+/, // Photo/slideshow posts
    /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
  ];

  return tiktokPatterns.some((pattern) => pattern.test(url));
}
