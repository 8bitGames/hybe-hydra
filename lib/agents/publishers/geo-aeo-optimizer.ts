/**
 * GEO/AEO Optimizer Agent
 * =======================
 * Generates GEO (Generative Engine Optimization) and AEO (Answer Engine Optimization)
 * optimized captions and hashtags for social media content.
 *
 * GEO: AI 검색 엔진 최적화 (Google AI Overview, ChatGPT, Perplexity 등)
 * AEO: 답변 엔진 최적화 (음성 검색, Featured Snippets)
 *
 * Model: GPT-5.1 (user-facing text quality)
 * Category: Publisher
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// ================================
// Input Schema
// ================================

export const GeoAeoInputSchema = z.object({
  // Video/Content context
  keywords: z.array(z.string()).min(1),
  searchTags: z.array(z.string()).nullish(),
  prompt: z.string().nullish(),

  // Artist/Campaign context
  artistName: z.string().nullish(),
  groupName: z.string().nullish(),
  campaignName: z.string().nullish(),

  // Content settings
  vibe: z.enum(['Exciting', 'Emotional', 'Pop', 'Minimal']).nullish(),
  language: z.enum(['ko', 'en', 'ja']).default('ko'),
  platform: z.enum(['tiktok', 'youtube', 'instagram']).default('tiktok'),

  // Trend data
  trendKeywords: z.array(z.string()).nullish(),
});

export type GeoAeoInput = z.infer<typeof GeoAeoInputSchema>;

// ================================
// Output Schema
// ================================

export const GeoOptimizedContentSchema = z.object({
  caption: z.string(),
  hookLine: z.string(),
  entityDescription: z.string(),
  voiceSearchText: z.string(),
  callToAction: z.string(),
});

export const AeoOptimizedContentSchema = z.object({
  faqHooks: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
  featuredSnippetText: z.string(),
  directAnswer: z.string(),
  searchIntentKeywords: z.array(z.string()),
});

export const OptimizedHashtagsSchema = z.object({
  primary: z.array(z.string()),
  trending: z.array(z.string()),
  niche: z.array(z.string()),
  entity: z.array(z.string()),
  longTail: z.array(z.string()),
});

export const StructuredDataSchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  creator: z.string().optional(),
});

export const GeoAeoOutputSchema = z.object({
  geo: GeoOptimizedContentSchema,
  aeo: AeoOptimizedContentSchema,
  hashtags: OptimizedHashtagsSchema,
  structuredData: StructuredDataSchema,
  scores: z.object({
    geoScore: z.number().min(0).max(100),
    aeoScore: z.number().min(0).max(100),
    overallScore: z.number().min(0).max(100),
  }),
});

export type GeoAeoOutput = z.infer<typeof GeoAeoOutputSchema>;

// ================================
// Platform Configuration
// ================================

const PLATFORM_CONFIG: Record<string, {
  maxCaption: number;
  maxHashtags: number;
  hashtagStyle: 'space' | 'inline';
  voiceSearchPriority: boolean;
}> = {
  tiktok: {
    maxCaption: 2200,
    maxHashtags: 5,
    hashtagStyle: 'space',
    voiceSearchPriority: true,
  },
  youtube: {
    maxCaption: 5000,
    maxHashtags: 15,
    hashtagStyle: 'space',
    voiceSearchPriority: false,
  },
  instagram: {
    maxCaption: 2200,
    maxHashtags: 30,
    hashtagStyle: 'inline',
    voiceSearchPriority: false,
  },
};

// ================================
// Agent Configuration
// ================================

export const GeoAeoOptimizerConfig: AgentConfig<GeoAeoInput, GeoAeoOutput> = {
  id: 'geo-aeo-optimizer',
  name: 'GEO/AEO Optimizer Agent',
  description: 'GEO/AEO 최적화 캡션 및 해시태그 생성',
  category: 'publisher',

  model: {
    provider: 'openai',
    name: 'gpt-5.1',
    options: {
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: 'medium',
    },
  },

  prompts: {
    system: `You are a GEO/AEO optimization expert for social media content.
Your goal is to create content optimized for both AI search engines (GEO) and answer engines (AEO).

## GEO (Generative Engine Optimization)
- Optimize for AI search engines: Google AI Overview, ChatGPT, Perplexity
- Entity-based descriptions with structured, AI-parseable content
- Citation-worthy, quotable content for AI assistants

## AEO (Answer Engine Optimization)
- Optimize for answer engines: Voice search, Featured Snippets
- FAQ-style hooks with question-answer format
- Direct answers optimized for zero-click results

## Quality Standards:
- Natural, engaging language appropriate for the target platform
- Avoid generic hashtags like #fyp, #foryou, #viral, #trending
- Focus on searchable, specific tags that match search intent
- Culturally appropriate content for the target language

Always respond in valid JSON format.`,

    templates: {
      generate: `Generate GEO/AEO optimized content for this social media post:

## Context
- Keywords: {{keywords}}
{{#searchTags}}- Search Tags: {{searchTags}}{{/searchTags}}
{{#prompt}}- Original Prompt: {{prompt}}{{/prompt}}
{{#artistName}}- Artist: {{artistName}}{{/artistName}}
{{#groupName}}- Group: {{groupName}}{{/groupName}}
{{#campaignName}}- Campaign: {{campaignName}}{{/campaignName}}
- Vibe: {{vibe}}
{{#trendKeywords}}- Trending Keywords: {{trendKeywords}}{{/trendKeywords}}

## Language Instructions
{{languageInstruction}}

## Platform Specifics ({{platform}})
- Max caption: {{maxCaption}} characters
- Max hashtags: {{maxHashtags}} (strategic, not generic)
- Voice search priority: {{voiceSearchPriority}}

## Hashtag Strategy
- AVOID generic tags: #fyp, #foryou, #viral, #trending
- USE specific, searchable tags that match search intent
- MIX: 1-2 broad category + 2-3 niche specific + 1-2 trending

Generate a comprehensive JSON response:
{
  "geo": {
    "caption": "Full optimized caption",
    "hookLine": "Attention-grabbing first line",
    "entityDescription": "Clear, AI-parseable description",
    "voiceSearchText": "Natural speech version",
    "callToAction": "Engaging CTA"
  },
  "aeo": {
    "faqHooks": [
      {"question": "Natural search question", "answer": "Concise answer"}
    ],
    "featuredSnippetText": "40-60 word snippet",
    "directAnswer": "Single sentence direct answer",
    "searchIntentKeywords": ["keyword1", "keyword2"]
  },
  "hashtags": {
    "primary": ["#tag1", "#tag2"],
    "trending": ["#trend1"],
    "niche": ["#niche1"],
    "entity": ["#artist"],
    "longTail": ["#specific"]
  },
  "structuredData": {
    "type": "VideoObject",
    "name": "Video title",
    "description": "Schema.org description",
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
- overallScore: Weighted average considering platform priorities`,
    },
  },

  inputSchema: GeoAeoInputSchema,
  outputSchema: GeoAeoOutputSchema,
  dependencies: [],
};

// ================================
// Language Configuration
// ================================

const LANGUAGE_CONFIG: Record<string, {
  instruction: string;
  ctaExamples: string[];
}> = {
  ko: {
    instruction: '한국어로 자연스럽게 작성해주세요. 존댓말과 친근한 톤을 적절히 섞어주세요.',
    ctaExamples: [
      '댓글로 알려주세요! 💬',
      '좋아요와 저장 눌러주세요! ❤️',
      '팔로우하고 더 많은 콘텐츠 받아보세요! 👉',
    ],
  },
  en: {
    instruction: 'Write in natural, conversational English suitable for social media.',
    ctaExamples: [
      'Drop a comment below! 💬',
      'Like and save for later! ❤️',
      'Follow for more content! 👉',
    ],
  },
  ja: {
    instruction: '日本語で自然に書いてください。適切な敬語を使ってください。',
    ctaExamples: [
      'コメントで教えてください！💬',
      'いいねと保存お願いします！❤️',
      'フォローして続きをチェック！👉',
    ],
  },
};

// ================================
// Agent Implementation
// ================================

export class GeoAeoOptimizerAgent extends BaseAgent<GeoAeoInput, GeoAeoOutput> {
  constructor() {
    super(GeoAeoOptimizerConfig);
  }

  protected buildPrompt(input: GeoAeoInput, context: AgentContext): string {
    const template = this.getTemplate('generate');
    const platform = input.platform || 'tiktok';
    const language = input.language || 'ko';
    const platformConfig = PLATFORM_CONFIG[platform];
    const langConfig = LANGUAGE_CONFIG[language];

    // Build conditional sections
    const searchTagsSection = input.searchTags?.length
      ? input.searchTags.join(', ')
      : '';
    const trendKeywordsSection = input.trendKeywords?.length
      ? input.trendKeywords.join(', ')
      : '';

    return this.fillTemplate(template, {
      keywords: input.keywords.join(', '),
      searchTags: searchTagsSection,
      prompt: input.prompt || '',
      artistName: input.artistName || context.workflow?.artistName || '',
      groupName: input.groupName || '',
      campaignName: input.campaignName || '',
      vibe: input.vibe || 'Pop',
      trendKeywords: trendKeywordsSection,
      languageInstruction: langConfig.instruction,
      platform: platform.toUpperCase(),
      maxCaption: platformConfig.maxCaption,
      maxHashtags: platformConfig.maxHashtags,
      voiceSearchPriority: platformConfig.voiceSearchPriority ? 'HIGH' : 'MEDIUM',
    });
  }

  /**
   * Generate GEO/AEO optimized content
   */
  async generate(
    keywords: string[],
    context: AgentContext,
    options?: {
      searchTags?: string[];
      prompt?: string;
      artistName?: string;
      groupName?: string;
      campaignName?: string;
      vibe?: GeoAeoInput['vibe'];
      language?: GeoAeoInput['language'];
      platform?: GeoAeoInput['platform'];
      trendKeywords?: string[];
    }
  ) {
    return this.execute(
      {
        keywords,
        searchTags: options?.searchTags,
        prompt: options?.prompt,
        artistName: options?.artistName,
        groupName: options?.groupName,
        campaignName: options?.campaignName,
        vibe: options?.vibe,
        language: options?.language || 'ko',
        platform: options?.platform || 'tiktok',
        trendKeywords: options?.trendKeywords,
      },
      context
    );
  }

  /**
   * Quick generation with combined caption and hashtags
   */
  async quickGenerate(
    keywords: string[],
    context: AgentContext,
    options?: {
      artistName?: string;
      language?: GeoAeoInput['language'];
      platform?: GeoAeoInput['platform'];
      vibe?: GeoAeoInput['vibe'];
    }
  ): Promise<{
    caption: string;
    hashtags: string[];
    score: number;
  } | null> {
    const result = await this.generate(keywords, context, options);

    if (!result.success || !result.data) {
      return null;
    }

    const { geo, hashtags, scores } = result.data;
    const platform = options?.platform || 'tiktok';
    const platformConfig = PLATFORM_CONFIG[platform];

    // Combine all hashtags respecting platform limits
    const allHashtags = [
      ...hashtags.primary,
      ...hashtags.entity,
      ...hashtags.niche,
      ...hashtags.trending,
      ...hashtags.longTail,
    ].slice(0, platformConfig.maxHashtags);

    // Build combined caption
    const combinedCaption = `${geo.hookLine}\n\n${geo.caption}\n\n${geo.callToAction}`.slice(
      0,
      platformConfig.maxCaption
    );

    return {
      caption: combinedCaption,
      hashtags: allHashtags,
      score: scores.overallScore,
    };
  }
}

// ================================
// Factory Function
// ================================

export function createGeoAeoOptimizerAgent(): GeoAeoOptimizerAgent {
  return new GeoAeoOptimizerAgent();
}
