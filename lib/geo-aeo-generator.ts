/**
 * @deprecated This file is deprecated. Use the GeoAeoOptimizerAgent instead.
 *
 * Import from: import { createGeoAeoOptimizerAgent } from '@/lib/agents/publishers';
 *
 * This file will be removed in a future version.
 * All AI calls should go through the Agent System as per CLAUDE.md rules.
 *
 * ============================================================================
 *
 * GEO/AEO Optimization Generator (DEPRECATED)
 *
 * GEO (Generative Engine Optimization):
 * - AI 검색 엔진 최적화 (Google AI Overview, ChatGPT, Perplexity 등)
 * - 엔티티 기반 설명, 구조화된 데이터, 인용 가능한 콘텐츠
 *
 * AEO (Answer Engine Optimization):
 * - 답변 엔진 최적화 (음성 검색, Featured Snippets)
 * - 질문 기반 훅, FAQ 스타일 콘텐츠, 직접 답변 형식
 */

import { generateJSON, isGeminiConfigured } from "./gemini";

// Types
export type ContentLanguage = "ko" | "en" | "ja";
export type Platform = "tiktok" | "youtube" | "instagram";
export type ContentVibe = "Exciting" | "Emotional" | "Pop" | "Minimal";

export interface GeoAeoInput {
  // Video/Content context
  keywords: string[];
  searchTags?: string[];
  prompt?: string;

  // Artist/Campaign context
  artistName?: string;
  groupName?: string;
  campaignName?: string;

  // Content settings
  vibe?: ContentVibe;
  language?: ContentLanguage;
  platform?: Platform;

  // Trend data
  trendKeywords?: string[];
}

export interface GeoOptimizedContent {
  // Primary caption - GEO optimized
  caption: string;

  // Hook line for algorithm (첫 3초 = 골든타임)
  hookLine: string;

  // Entity-focused description (AI가 이해하기 쉬운 형식)
  entityDescription: string;

  // Voice search optimized text
  voiceSearchText: string;

  // Call to action
  callToAction: string;
}

export interface AeoOptimizedContent {
  // FAQ style hooks (질문-답변 형식)
  faqHooks: {
    question: string;
    answer: string;
  }[];

  // Featured snippet optimized text (구글 검색 스니펫용)
  featuredSnippetText: string;

  // Direct answer format (AI 답변용)
  directAnswer: string;

  // Search intent keywords
  searchIntentKeywords: string[];
}

export interface OptimizedHashtags {
  // Primary hashtags (SEO 핵심)
  primary: string[];

  // Trending hashtags
  trending: string[];

  // Niche hashtags (타겟 오디언스)
  niche: string[];

  // Entity hashtags (아티스트/브랜드)
  entity: string[];

  // Long-tail hashtags (구체적 검색어)
  longTail: string[];
}

export interface StructuredData {
  // Schema.org compatible data
  type: string;
  name: string;
  description: string;
  keywords: string[];
  creator?: string;
  datePublished?: string;
}

export interface GeoAeoResult {
  geo: GeoOptimizedContent;
  aeo: AeoOptimizedContent;
  hashtags: OptimizedHashtags;
  structuredData: StructuredData;

  // Combined output for easy use
  combinedCaption: string;
  combinedHashtags: string[];

  // Quality scores
  scores: {
    geoScore: number;  // 0-100
    aeoScore: number;  // 0-100
    overallScore: number;
  };

  metadata: {
    language: ContentLanguage;
    platform: Platform;
    generatedAt: string;
    inputKeywords: string[];
  };
}

// Platform-specific configurations
const PLATFORM_CONFIG: Record<Platform, {
  maxCaption: number;
  maxHashtags: number;
  hashtagStyle: "space" | "inline";
  voiceSearchPriority: boolean;
}> = {
  tiktok: {
    maxCaption: 2200,
    maxHashtags: 5,
    hashtagStyle: "space",
    voiceSearchPriority: true, // TikTok 검색이 Gen Z 사이에서 구글 대체
  },
  youtube: {
    maxCaption: 5000,
    maxHashtags: 15,
    hashtagStyle: "space",
    voiceSearchPriority: false,
  },
  instagram: {
    maxCaption: 2200,
    maxHashtags: 30,
    hashtagStyle: "inline",
    voiceSearchPriority: false,
  },
};

// Language-specific prompts
const LANGUAGE_CONFIG: Record<ContentLanguage, {
  instruction: string;
  faqStyle: string;
  ctaExamples: string[];
}> = {
  ko: {
    instruction: "한국어로 자연스럽게 작성해주세요. 존댓말과 친근한 톤을 적절히 섞어주세요.",
    faqStyle: "질문은 자연스러운 한국어 구어체로, 답변은 친근하면서도 정보성 있게 작성해주세요.",
    ctaExamples: [
      "댓글로 알려주세요! 💬",
      "좋아요와 저장 눌러주세요! ❤️",
      "팔로우하고 더 많은 콘텐츠 받아보세요! 👉",
      "친구에게 공유해주세요! 🔗",
    ],
  },
  en: {
    instruction: "Write in natural, conversational English suitable for social media.",
    faqStyle: "Questions should be conversational, answers should be informative yet casual.",
    ctaExamples: [
      "Drop a comment below! 💬",
      "Like and save for later! ❤️",
      "Follow for more content! 👉",
      "Share with a friend! 🔗",
    ],
  },
  ja: {
    instruction: "日本語で自然に書いてください。適切な敬語を使ってください。",
    faqStyle: "質問は自然な日本語で、回答は親しみやすく情報性のあるものにしてください。",
    ctaExamples: [
      "コメントで教えてください！💬",
      "いいねと保存お願いします！❤️",
      "フォローして続きをチェック！👉",
      "友達にシェアしてね！🔗",
    ],
  },
};

// Build the comprehensive prompt for GEO/AEO generation
function buildGeoAeoPrompt(input: GeoAeoInput): string {
  const language = input.language || "ko";
  const platform = input.platform || "tiktok";
  const vibe = input.vibe || "Pop";
  const config = PLATFORM_CONFIG[platform];
  const langConfig = LANGUAGE_CONFIG[language];

  const keywordsStr = input.keywords.join(", ");
  const trendStr = input.trendKeywords?.join(", ") || "";

  return `You are a GEO/AEO optimization expert for ${platform.toUpperCase()} content.
Your goal is to create content optimized for both AI search engines (GEO) and answer engines (AEO).

## Context
- Keywords: ${keywordsStr}
${input.searchTags?.length ? `- Search Tags: ${input.searchTags.join(", ")}` : ""}
${input.prompt ? `- Original Prompt: ${input.prompt}` : ""}
${input.artistName ? `- Artist: ${input.artistName}` : ""}
${input.groupName ? `- Group: ${input.groupName}` : ""}
${input.campaignName ? `- Campaign: ${input.campaignName}` : ""}
- Vibe: ${vibe}
${trendStr ? `- Trending Keywords: ${trendStr}` : ""}

## Language Instructions
${langConfig.instruction}
${langConfig.faqStyle}

## GEO (Generative Engine Optimization) Requirements
1. **Entity-First**: Clearly identify the main entity (artist, topic) in the first line
2. **Structured Information**: Use clear, factual statements AI can easily parse
3. **Voice Search Ready**: Write how people actually speak/search
4. **Citation Worthy**: Make content quotable by AI assistants

## AEO (Answer Engine Optimization) Requirements
1. **FAQ Format**: Create question-answer pairs people actually search for
2. **Featured Snippet Ready**: Write concise, direct answers (40-60 words)
3. **Search Intent Match**: Address what users really want to know
4. **Zero-Click Optimized**: Provide value even without clicking

## Platform Specifics (${platform.toUpperCase()})
- Max caption: ${config.maxCaption} characters
- Max hashtags: ${config.maxHashtags} (strategic, not generic)
- Voice search priority: ${config.voiceSearchPriority ? "HIGH (TikTok is replacing Google for Gen Z)" : "MEDIUM"}

## Hashtag Strategy
- AVOID generic tags: #fyp, #foryou, #viral, #trending
- USE specific, searchable tags that match search intent
- MIX: 1-2 broad category + 2-3 niche specific + 1-2 trending

Generate a comprehensive JSON response with this structure:
{
  "geo": {
    "caption": "Full optimized caption (max ${config.maxCaption} chars)",
    "hookLine": "Attention-grabbing first line (appears in preview)",
    "entityDescription": "Clear, AI-parseable description of the content",
    "voiceSearchText": "Natural speech version of content description",
    "callToAction": "Engaging CTA"
  },
  "aeo": {
    "faqHooks": [
      {"question": "Natural search question", "answer": "Concise answer"},
      {"question": "Another common question", "answer": "Another answer"}
    ],
    "featuredSnippetText": "40-60 word snippet optimized for Google",
    "directAnswer": "Single sentence direct answer for AI assistants",
    "searchIntentKeywords": ["keyword1", "keyword2", "keyword3"]
  },
  "hashtags": {
    "primary": ["#tag1", "#tag2"],
    "trending": ["#trend1"],
    "niche": ["#niche1", "#niche2"],
    "entity": ["#artist", "#brand"],
    "longTail": ["#specificphrase"]
  },
  "structuredData": {
    "type": "VideoObject",
    "name": "Video title",
    "description": "Schema.org compatible description",
    "keywords": ["keyword1", "keyword2"],
    "creator": "Creator name"
  },
  "scores": {
    "geoScore": 85,
    "aeoScore": 80,
    "overallScore": 82
  }
}

Scoring criteria:
- geoScore: Entity clarity, structured info, voice search readiness, AI parseability
- aeoScore: FAQ quality, snippet fitness, search intent match, direct answer quality
- overallScore: Weighted average considering platform priorities`;
}

// Main generation function
export async function generateGeoAeoContent(
  input: GeoAeoInput
): Promise<GeoAeoResult> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API is not configured");
  }

  const language = input.language || "ko";
  const platform = input.platform || "tiktok";
  const config = PLATFORM_CONFIG[platform];

  const prompt = buildGeoAeoPrompt(input);

  const result = await generateJSON<{
    geo: GeoOptimizedContent;
    aeo: AeoOptimizedContent;
    hashtags: OptimizedHashtags;
    structuredData: StructuredData;
    scores: {
      geoScore: number;
      aeoScore: number;
      overallScore: number;
    };
  }>(prompt);

  // Combine all hashtags for easy use (respecting platform limits)
  const allHashtags = [
    ...result.hashtags.primary,
    ...result.hashtags.entity,
    ...result.hashtags.niche,
    ...result.hashtags.trending,
    ...result.hashtags.longTail,
  ].slice(0, config.maxHashtags);

  // Build combined caption with hook + main content + CTA
  const combinedCaption = `${result.geo.hookLine}\n\n${result.geo.caption}\n\n${result.geo.callToAction}`.slice(
    0,
    config.maxCaption
  );

  return {
    ...result,
    combinedCaption,
    combinedHashtags: allHashtags,
    metadata: {
      language,
      platform,
      generatedAt: new Date().toISOString(),
      inputKeywords: input.keywords,
    },
  };
}

// Quick generation for simple use cases
export async function generateQuickGeoAeo(
  keywords: string[],
  options?: {
    artistName?: string;
    language?: ContentLanguage;
    platform?: Platform;
    vibe?: ContentVibe;
  }
): Promise<{ caption: string; hashtags: string[]; score: number }> {
  const result = await generateGeoAeoContent({
    keywords,
    artistName: options?.artistName,
    language: options?.language,
    platform: options?.platform,
    vibe: options?.vibe,
  });

  return {
    caption: result.combinedCaption,
    hashtags: result.combinedHashtags,
    score: result.scores.overallScore,
  };
}

// Generate hashtags only (lighter operation)
export async function generateGeoAeoHashtags(
  input: GeoAeoInput
): Promise<OptimizedHashtags> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API is not configured");
  }

  const platform = input.platform || "tiktok";
  const config = PLATFORM_CONFIG[platform];

  const prompt = `Generate GEO/AEO optimized hashtags for ${platform.toUpperCase()} content.

Keywords: ${input.keywords.join(", ")}
${input.artistName ? `Artist: ${input.artistName}` : ""}
${input.trendKeywords?.length ? `Trending: ${input.trendKeywords.join(", ")}` : ""}

Requirements:
- Total max ${config.maxHashtags} hashtags
- AVOID: #fyp, #foryou, #viral, #trending (too generic)
- Focus on searchable, specific tags
- Include entity tags (artist/brand)
- Mix broad and niche for discoverability

Return JSON:
{
  "primary": ["#tag1", "#tag2"],
  "trending": ["#trend1"],
  "niche": ["#niche1"],
  "entity": ["#artist"],
  "longTail": ["#specific"]
}`;

  return generateJSON<OptimizedHashtags>(prompt);
}

// Export for API use
export type {
  GeoAeoInput as GeoAeoGeneratorInput,
  GeoAeoResult as GeoAeoGeneratorResult,
};
