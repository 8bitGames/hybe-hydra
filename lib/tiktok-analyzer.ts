/**
 * TikTok Video Analyzer Service
 * Downloads TikTok videos and analyzes them using Gemini Vision
 */

import { GoogleGenAI } from "@google/genai";

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

// Initialize Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

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
 * Analyze video content using Gemini Vision
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
    const ai = getGeminiClient();

    // Download video and convert to base64
    console.log("[GEMINI] Fetching video for analysis:", videoUrl);

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

    console.log(`[GEMINI] Video size: ${videoSize.toFixed(2)} MB`);

    // Gemini has file size limits, check if video is too large
    if (videoSize > 20) {
      console.log("[GEMINI] Video too large, using metadata-only analysis");
      return analyzeFromMetadataOnly(metadata);
    }

    const analysisPrompt = `You are a video style analyst specializing in short-form social media content. Analyze this TikTok video and provide a detailed breakdown.

Context from the video:
- Original description: "${metadata.description}"
- Hashtags: ${metadata.hashtags.join(", ")}
${metadata.musicTitle ? `- Music: "${metadata.musicTitle}"` : ""}

Analyze the video and respond in this exact JSON format:
{
  "style_analysis": {
    "visual_style": "describe the overall visual aesthetic (e.g., 'cinematic', 'lo-fi', 'high-fashion editorial', 'documentary')",
    "color_palette": ["list", "dominant", "colors"],
    "lighting": "describe lighting style (e.g., 'natural daylight', 'neon', 'golden hour', 'dramatic shadows')",
    "camera_movement": ["list camera techniques like 'slow zoom', 'tracking shot', 'handheld', 'static'"],
    "transitions": ["list transition styles like 'jump cut', 'smooth pan', 'fade', 'whip pan'"],
    "mood": "overall emotional tone (e.g., 'energetic', 'melancholic', 'dreamy', 'intense')",
    "pace": "editing pace (e.g., 'fast-paced', 'slow and contemplative', 'rhythmic')",
    "effects": ["list visual effects like 'blur', 'grain', 'speed ramp', 'color grading'"]
  },
  "content_analysis": {
    "main_subject": "describe the main subject/person in the video",
    "actions": ["list main actions/movements"],
    "setting": "describe the location/environment",
    "props": ["list notable props or objects"],
    "clothing_style": "describe fashion/clothing style"
  },
  "suggested_prompt": "Write a detailed Veo video generation prompt that would recreate this style. Be specific about visual elements, camera work, and mood. Do NOT include any real person names.",
  "prompt_elements": {
    "style_keywords": ["5-7 key style descriptors for the prompt"],
    "mood_keywords": ["3-5 mood/emotion keywords"],
    "action_keywords": ["3-5 action/movement keywords"],
    "technical_suggestions": {
      "aspect_ratio": "9:16 or 16:9 or 1:1 based on the video",
      "duration": 5 or 8 or 10 based on content pacing,
      "camera_style": "primary camera technique to use"
    }
  }
}`;

    // Use Gemini 2.0 Flash for video understanding
    const model = ai.models.generateContent;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "video/mp4",
                data: videoBase64,
              },
            },
            { text: analysisPrompt },
          ],
        },
      ],
    });

    const responseText = response.text || "";
    console.log("[GEMINI] Analysis response received, length:", responseText.length);
    console.log("[GEMINI] Raw response (first 500 chars):", responseText.slice(0, 500));

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[GEMINI] Failed to find JSON in response");
      throw new Error("Failed to parse analysis response");
    }

    console.log("[GEMINI] Matched JSON length:", jsonMatch[0].length);
    const analysis = JSON.parse(jsonMatch[0]);

    console.log("[GEMINI] Parsed analysis keys:", Object.keys(analysis));
    console.log("[GEMINI] suggested_prompt:", analysis.suggested_prompt?.slice(0, 200));
    console.log("[GEMINI] style_analysis:", analysis.style_analysis);
    console.log("[GEMINI] prompt_elements:", analysis.prompt_elements);

    return {
      success: true,
      style_analysis: analysis.style_analysis,
      content_analysis: analysis.content_analysis,
      suggested_prompt: analysis.suggested_prompt,
      prompt_elements: analysis.prompt_elements,
    };
  } catch (error) {
    console.error("[GEMINI] Analysis error:", error);

    // Fallback to metadata-only analysis
    console.log("[GEMINI] Falling back to metadata-only analysis");
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
  });

  // Step 2: Analyze with Gemini (if video URL available)
  let analysisResult;

  if (metadata.video_url) {
    analysisResult = await analyzeVideoWithGemini(metadata.video_url, {
      description: metadata.description,
      hashtags: metadata.hashtags,
      musicTitle: metadata.music?.title,
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
 */
export function isValidTikTokUrl(url: string): boolean {
  const tiktokPatterns = [
    /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
  ];

  return tiktokPatterns.some((pattern) => pattern.test(url));
}
