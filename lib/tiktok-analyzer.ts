/**
 * TikTok Video Analyzer Service
 * Downloads TikTok videos and analyzes them using Gemini Vision via TikTokVisionAgent
 */

import { getTikTokVisionAgent } from "@/lib/agents/analyzers/tiktok-vision";
import type { AgentContext } from "@/lib/agents/types";

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
}> {
  try {
    // Download video and convert to base64
    console.log("[TIKTOK-VISION] Fetching video for analysis:", videoUrl);

    const videoResponse = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.status}`);
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString("base64");
    const videoSize = videoBuffer.byteLength / (1024 * 1024);

    console.log(`[TIKTOK-VISION] Video size: ${videoSize.toFixed(2)} MB`);

    // Gemini has file size limits, check if video is too large
    if (videoSize > 20) {
      console.log("[TIKTOK-VISION] Video too large, using metadata-only analysis");
      return analyzeFromMetadataOnly(metadata);
    }

    // Call the agent
    const agent = getTikTokVisionAgent();
    const context = createAgentContext();
    const result = await agent.analyzeVideo(
      videoBase64,
      "video/mp4",
      {
        mediaType: 'video',
        description: metadata.description,
        hashtags: metadata.hashtags,
        musicTitle: metadata.musicTitle,
      },
      context
    );

    if (!result.success || !result.data) {
      console.error("[TIKTOK-VISION] Agent error:", result.error);
      return analyzeFromMetadataOnly(metadata);
    }

    const analysis = result.data;
    console.log("[TIKTOK-VISION] Analysis complete");
    console.log("[TIKTOK-VISION] suggested_prompt:", analysis.suggested_prompt?.slice(0, 200));

    return {
      success: true,
      style_analysis: analysis.style_analysis,
      content_analysis: analysis.content_analysis,
      suggested_prompt: analysis.suggested_prompt,
      prompt_elements: analysis.prompt_elements,
    };
  } catch (error) {
    console.error("[TIKTOK-VISION] Analysis error:", error);

    // Fallback to metadata-only analysis
    console.log("[TIKTOK-VISION] Falling back to metadata-only analysis");
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
} {
  // Extract style hints from hashtags
  const hashtagsLower = metadata.hashtags.map((h) => h.toLowerCase());

  const styleKeywords: string[] = [];
  const moodKeywords: string[] = [];
  const actionKeywords: string[] = [];

  // Style detection from hashtags
  if (hashtagsLower.some((h) => h.includes("aesthetic") || h.includes("vibe"))) {
    styleKeywords.push("aesthetic", "stylized");
  }
  if (hashtagsLower.some((h) => h.includes("cinematic"))) {
    styleKeywords.push("cinematic", "film-like");
  }
  if (hashtagsLower.some((h) => h.includes("fyp") || h.includes("viral"))) {
    styleKeywords.push("trending", "eye-catching");
  }
  if (hashtagsLower.some((h) => h.includes("dance") || h.includes("choreo"))) {
    actionKeywords.push("dancing", "choreography");
    moodKeywords.push("energetic");
  }
  if (hashtagsLower.some((h) => h.includes("country") || h.includes("nashville"))) {
    styleKeywords.push("country style", "authentic");
    moodKeywords.push("warm");
  }

  // Add defaults if empty
  if (styleKeywords.length === 0) styleKeywords.push("modern", "social media style");
  if (moodKeywords.length === 0) moodKeywords.push("engaging");
  if (actionKeywords.length === 0) actionKeywords.push("expressive movement");

  return {
    success: true,
    style_analysis: {
      visual_style: "modern social media aesthetic",
      color_palette: ["vibrant", "high contrast"],
      lighting: "well-lit",
      camera_movement: ["dynamic"],
      transitions: ["quick cuts"],
      mood: moodKeywords[0] || "engaging",
      pace: "fast-paced",
      effects: ["color grading"],
    },
    content_analysis: {
      main_subject: "person",
      actions: actionKeywords,
      setting: "unspecified",
      props: [],
      clothing_style: "trendy",
    },
    suggested_prompt: `A ${styleKeywords.join(", ")} video featuring ${actionKeywords.join(" and ")}. ${metadata.description}`,
    prompt_elements: {
      style_keywords: styleKeywords,
      mood_keywords: moodKeywords,
      action_keywords: actionKeywords,
      technical_suggestions: {
        aspect_ratio: "9:16",
        duration: 8,
        camera_style: "dynamic handheld",
      },
    },
  };
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
  let analysisResult;

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
  };

  console.log("[ANALYZER] Final result:", {
    success: finalResult.success,
    hasMetadata: !!finalResult.metadata,
    hasStyleAnalysis: !!finalResult.style_analysis,
    hasSuggestedPrompt: !!finalResult.suggested_prompt,
    suggestedPromptPreview: finalResult.suggested_prompt?.slice(0, 100),
    promptElementsKeys: finalResult.prompt_elements ? Object.keys(finalResult.prompt_elements) : [],
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
