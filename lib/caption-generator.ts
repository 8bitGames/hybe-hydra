import { generateJSON, isGeminiConfigured } from "./gemini";

// Types
export type CaptionLanguage = "ko" | "en" | "ja";
export type CaptionStyle = "engaging" | "question" | "story" | "minimal" | "professional";
export type Platform = "tiktok" | "youtube" | "instagram";

export interface CaptionInput {
  prompt: string;
  artistName?: string;
  groupName?: string;
  campaignName?: string;
  trendKeywords?: string[];
  style?: CaptionStyle;
  language?: CaptionLanguage;
  platform?: Platform;
  maxLength?: number;
}

export interface GeneratedCaption {
  caption: string;
  hashtags: string[];
  emojis: string[];
  callToAction?: string;
  hookLine?: string;
  seoScore: number;
}

export interface CaptionResult {
  primary: GeneratedCaption;
  alternatives: GeneratedCaption[];
  platformOptimized: Record<Platform, GeneratedCaption>;
  metadata: {
    language: CaptionLanguage;
    style: CaptionStyle;
    generatedAt: string;
    trendKeywordsUsed: string[];
  };
}

// Platform-specific limits
const PLATFORM_LIMITS: Record<Platform, { captionLength: number; hashtagCount: number }> = {
  tiktok: { captionLength: 2200, hashtagCount: 5 },
  youtube: { captionLength: 5000, hashtagCount: 15 },
  instagram: { captionLength: 2200, hashtagCount: 30 },
};

// Style descriptions for prompts
const STYLE_DESCRIPTIONS: Record<CaptionStyle, string> = {
  engaging: "Create an engaging, attention-grabbing caption that sparks curiosity",
  question: "Start with a thought-provoking question to encourage engagement",
  story: "Tell a micro-story or narrative that connects emotionally",
  minimal: "Keep it short, punchy, and impactful with minimal words",
  professional: "Write a polished, professional caption suitable for official content",
};

// Language instructions
const LANGUAGE_INSTRUCTIONS: Record<CaptionLanguage, string> = {
  ko: "Write the caption in Korean (한국어). Use natural Korean expressions and appropriate honorifics.",
  en: "Write the caption in English. Use contemporary, relatable language.",
  ja: "Write the caption in Japanese (日本語). Use appropriate politeness levels.",
};

// Generate caption prompt
function buildCaptionPrompt(input: CaptionInput): string {
  const style = input.style || "engaging";
  const language = input.language || "ko";
  const platform = input.platform || "tiktok";
  const limits = PLATFORM_LIMITS[platform];

  return `You are a country music social media expert creating viral captions for ${platform.toUpperCase()}.

${LANGUAGE_INSTRUCTIONS[language]}

## Context
- Video Description: ${input.prompt}
${input.artistName ? `- Artist: ${input.artistName}` : ""}
${input.groupName ? `- Group: ${input.groupName}` : ""}
${input.campaignName ? `- Campaign: ${input.campaignName}` : ""}
${input.trendKeywords?.length ? `- Trending Keywords to incorporate: ${input.trendKeywords.join(", ")}` : ""}

## Style
${STYLE_DESCRIPTIONS[style]}

## Requirements
1. Caption must be under ${input.maxLength || limits.captionLength} characters
2. Include exactly ${limits.hashtagCount} relevant hashtags
3. Start with a hook line (first 1-2 sentences that appear in preview)
4. Include a call-to-action (like, comment, follow, share)
5. Use 2-4 relevant emojis naturally placed
6. Incorporate trending keywords naturally if provided

## SEO Guidelines
- Use primary keywords in the first 100 characters
- Mix popular and niche hashtags
- Include brand/artist hashtags
- Add trending hashtags if relevant

Generate a JSON response with this exact structure:
{
  "caption": "The full caption text with emojis",
  "hashtags": ["#hashtag1", "#hashtag2", ...],
  "emojis": ["emoji1", "emoji2", ...],
  "callToAction": "The call to action phrase",
  "hookLine": "The first attention-grabbing sentence",
  "seoScore": 85
}

The seoScore should be 0-100 based on keyword usage, hashtag quality, and engagement potential.`;
}

// Generate platform-optimized prompt
function buildPlatformPrompt(
  input: CaptionInput,
  platform: Platform,
  baseCaption: string
): string {
  const limits = PLATFORM_LIMITS[platform];
  const language = input.language || "ko";

  const platformTips: Record<Platform, string> = {
    tiktok: "TikTok: Focus on trend participation, use trending sounds references, keep it playful and Gen-Z friendly",
    youtube: "YouTube Shorts: Include searchable keywords, mention watch time benefits, use curiosity gaps",
    instagram: "Instagram Reels: Focus on aesthetic appeal, use storytelling, include save-worthy value",
  };

  return `Adapt this caption for ${platform.toUpperCase()}:

Original Caption: ${baseCaption}

${LANGUAGE_INSTRUCTIONS[language]}

${platformTips[platform]}

Platform Requirements:
- Max ${limits.captionLength} characters
- ${limits.hashtagCount} hashtags
- Optimized for ${platform}'s algorithm and audience

${input.trendKeywords?.length ? `Incorporate these trending keywords if relevant: ${input.trendKeywords.join(", ")}` : ""}

Generate a JSON response with this exact structure:
{
  "caption": "Platform-optimized caption",
  "hashtags": ["#hashtag1", "#hashtag2", ...],
  "emojis": ["emoji1", "emoji2", ...],
  "callToAction": "Platform-appropriate CTA",
  "hookLine": "Attention-grabbing opener",
  "seoScore": 85
}`;
}

// Main caption generation function
export async function generateCaption(input: CaptionInput): Promise<CaptionResult> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API is not configured");
  }

  const language = input.language || "ko";
  const style = input.style || "engaging";

  // Generate primary caption
  const primaryPrompt = buildCaptionPrompt(input);
  const primary = await generateJSON<GeneratedCaption>(primaryPrompt);

  // Generate alternatives with different styles
  const alternativeStyles: CaptionStyle[] = ["question", "story", "minimal"].filter(
    (s) => s !== style
  ) as CaptionStyle[];

  const alternatives = await Promise.all(
    alternativeStyles.slice(0, 2).map(async (altStyle) => {
      const altPrompt = buildCaptionPrompt({ ...input, style: altStyle });
      return generateJSON<GeneratedCaption>(altPrompt);
    })
  );

  // Generate platform-optimized versions
  const platforms: Platform[] = ["tiktok", "youtube", "instagram"];
  const platformResults = await Promise.all(
    platforms.map(async (platform) => {
      if (platform === input.platform) {
        return { platform, caption: primary };
      }
      const platformPrompt = buildPlatformPrompt(input, platform, primary.caption);
      const caption = await generateJSON<GeneratedCaption>(platformPrompt);
      return { platform, caption };
    })
  );

  const platformOptimized = platformResults.reduce(
    (acc, { platform, caption }) => {
      acc[platform] = caption;
      return acc;
    },
    {} as Record<Platform, GeneratedCaption>
  );

  return {
    primary,
    alternatives,
    platformOptimized,
    metadata: {
      language,
      style,
      generatedAt: new Date().toISOString(),
      trendKeywordsUsed: input.trendKeywords || [],
    },
  };
}

// Generate hashtags only
export async function generateHashtags(input: {
  topic: string;
  artistName?: string;
  groupName?: string;
  trendKeywords?: string[];
  platform?: Platform;
  count?: number;
}): Promise<string[]> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API is not configured");
  }

  const platform = input.platform || "tiktok";
  const count = input.count || PLATFORM_LIMITS[platform].hashtagCount;

  const prompt = `Generate ${count} SEO-optimized hashtags for country music content.

Topic: ${input.topic}
${input.artistName ? `Artist: ${input.artistName}` : ""}
${input.groupName ? `Group: ${input.groupName}` : ""}
${input.trendKeywords?.length ? `Trending Keywords: ${input.trendKeywords.join(", ")}` : ""}
Platform: ${platform}

Requirements:
- Mix of popular (high volume) and niche (targeted) hashtags
- Include artist specific hashtags
- Include trending hashtags if relevant
- Include general country music and Nashville hashtags
- All hashtags should start with #

Return as JSON array: ["#hashtag1", "#hashtag2", ...]`;

  const hashtags = await generateJSON<string[]>(prompt);
  return hashtags.slice(0, count);
}

// Simple caption for quick generation
export async function generateQuickCaption(
  prompt: string,
  language: CaptionLanguage = "ko"
): Promise<{ caption: string; hashtags: string[] }> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API is not configured");
  }

  const langInstructions: Record<CaptionLanguage, string> = {
    ko: "한국어로 작성",
    en: "Write in English",
    ja: "日本語で作成",
  };

  const quickPrompt = `Create a short, engaging social media caption for this country music content:
"${prompt}"

${langInstructions[language]}

Requirements:
- 1-2 sentences maximum
- Include 1-2 emojis
- Add 5 relevant hashtags

Return JSON: { "caption": "...", "hashtags": ["#tag1", ...] }`;

  return generateJSON<{ caption: string; hashtags: string[] }>(quickPrompt);
}
