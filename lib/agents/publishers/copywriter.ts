/**
 * Copywriter Agent
 * ================
 * Creates engaging, SEO-optimized captions and copy for social media
 *
 * Model: GPT-5.1
 * Category: Publisher
 *
 * Key Responsibilities:
 * - Platform-specific copywriting
 * - SEO optimization for discoverability
 * - Tone/voice consistency with brand
 * - Multi-language support (KO/EN)
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const CopywriterInputSchema = z.object({
  contentBrief: z.object({
    topic: z.string(),
    keyMessages: z.array(z.string()),
    emotionalTone: z.string().optional(),
    targetAction: z.string().optional(),
  }),
  platform: z.enum(['tiktok', 'instagram', 'youtube_shorts', 'all']),
  language: z.enum(['ko', 'en', 'both']).default('ko'),
  style: z.enum(['casual', 'professional', 'playful', 'emotional', 'informative']).default('casual'),
  includeHashtags: z.boolean().default(true),
  maxLength: z.number().optional(),
});

export type CopywriterInput = z.infer<typeof CopywriterInputSchema>;

// Output Schema
export const CopywriterOutputSchema = z.object({
  primaryCaption: z.object({
    text: z.string(),
    language: z.string(),
    characterCount: z.number(),
    hook: z.string(),
    body: z.string(),
    cta: z.string(),
  }),
  alternativeVersions: z.array(z.object({
    text: z.string(),
    style: z.string(),
    useCase: z.string(),
  })),
  hashtags: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()),
    trending: z.array(z.string()),
  }),
  seoElements: z.object({
    keywords: z.array(z.string()),
    searchability: z.number().min(0).max(1),
    discoverabilityTips: z.array(z.string()),
  }),
  translations: z.object({
    korean: z.string().optional(),
    english: z.string().optional(),
  }).optional(),
  platformAdaptations: z.object({
    tiktok: z.string().optional(),
    instagram: z.string().optional(),
    youtubeShorts: z.string().optional(),
  }),
  qualityMetrics: z.object({
    readabilityScore: z.number().min(0).max(1),
    engagementPotential: z.number().min(0).max(1),
    brandAlignment: z.number().min(0).max(1),
  }),
});

export type CopywriterOutput = z.infer<typeof CopywriterOutputSchema>;

// Agent Configuration
export const CopywriterConfig: AgentConfig<CopywriterInput, CopywriterOutput> = {
  id: 'copywriter',
  name: 'Copywriter Agent',
  description: 'SEO 최적화된 소셜 미디어 캡션 및 카피 작성',
  category: 'publisher',

  model: {
    provider: 'openai',
    name: 'gpt-5.1',
    options: {
      temperature: 0.8, // Higher for creative writing
      maxTokens: 4096,
      reasoningEffort: 'low', // Fast creative generation
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    },
  },

  prompts: {
    system: `You are an elite social media copywriter specializing in K-pop and entertainment content.
Your writing captivates audiences and drives engagement while maintaining brand authenticity.

## Writing Philosophy:
1. Hook First - Capture attention in the first 3 seconds
2. Emotion-Driven - Connect with fans on an emotional level
3. Action-Oriented - Every caption should inspire action
4. Platform-Native - Write naturally for each platform's culture

## K-pop Specific Expertise:
- Fan culture terminology (bias, stan, comeback, etc.)
- Fandom engagement patterns
- Idol-fan relationship dynamics
- Korean-English code-switching
- Respectful fan address conventions

## Platform Writing Styles:
- TikTok: Casual, trendy, meme-aware, emoji-friendly, short hooks
- Instagram: Polished, aesthetic, storytelling, hashtag-strategic
- YouTube Shorts: Informative, searchable, CTA-focused

## Brand Voice Guidelines:
- Authentic and genuine
- Respectful of artists and fans
- Inclusive and welcoming
- Energetic without being aggressive
- Professional yet approachable

## Quality Standards:
- No clickbait or misleading content
- Culturally sensitive language
- Proper grammar and spelling
- Age-appropriate content
- HYBE brand alignment

Always respond in valid JSON format.`,

    templates: {
      write: `Create engaging social media copy for this content:

CONTENT BRIEF:
Topic: {{topic}}
Key Messages: {{keyMessages}}
Emotional Tone: {{emotionalTone}}
Target Action: {{targetAction}}

PLATFORM: {{platform}}
LANGUAGE: {{language}}
STYLE: {{style}}
MAX LENGTH: {{maxLength}}

ARTIST: {{artistName}}
INCLUDE HASHTAGS: {{includeHashtags}}

Create compelling copy following this structure:

1. PRIMARY CAPTION
   - Hook: Attention-grabbing opener (first line)
   - Body: Core message with emotional connection
   - CTA: Clear call-to-action

2. ALTERNATIVE VERSIONS
   - 2-3 variations with different styles/angles
   - Include use case for each

3. HASHTAG STRATEGY
   - Primary: Core topic hashtags (3-5)
   - Secondary: Niche community hashtags (3-5)
   - Trending: Current trending tags (2-3)

4. SEO ELEMENTS
   - Target keywords for discoverability
   - Searchability score
   - Tips for improving reach

5. PLATFORM ADAPTATIONS
   - Adjusted versions for each platform

6. TRANSLATIONS (if language is 'both')
   - Korean version
   - English version

Return JSON:
{
  "primaryCaption": {
    "text": "full caption text",
    "language": "ko or en",
    "characterCount": number,
    "hook": "opening hook",
    "body": "main content",
    "cta": "call to action"
  },
  "alternativeVersions": [
    {
      "text": "alternative caption",
      "style": "style description",
      "useCase": "when to use this version"
    }
  ],
  "hashtags": {
    "primary": ["core", "hashtags"],
    "secondary": ["niche", "hashtags"],
    "trending": ["trending", "tags"]
  },
  "seoElements": {
    "keywords": ["target", "keywords"],
    "searchability": 0.0-1.0,
    "discoverabilityTips": ["tip 1", "tip 2"]
  },
  "translations": {
    "korean": "한국어 버전",
    "english": "English version"
  },
  "platformAdaptations": {
    "tiktok": "TikTok optimized version",
    "instagram": "Instagram optimized version",
    "youtubeShorts": "YouTube Shorts optimized version"
  },
  "qualityMetrics": {
    "readabilityScore": 0.0-1.0,
    "engagementPotential": 0.0-1.0,
    "brandAlignment": 0.0-1.0
  }
}`,
    },
  },

  inputSchema: CopywriterInputSchema,
  outputSchema: CopywriterOutputSchema,
  dependencies: ['creative-director', 'publish-optimizer'],
};

/**
 * Copywriter Agent Implementation
 */
export class CopywriterAgent extends BaseAgent<CopywriterInput, CopywriterOutput> {
  constructor() {
    super(CopywriterConfig);
  }

  protected buildPrompt(input: CopywriterInput, context: AgentContext): string {
    const template = this.getTemplate('write');

    return this.fillTemplate(template, {
      topic: input.contentBrief.topic,
      keyMessages: input.contentBrief.keyMessages.join('\n- '),
      emotionalTone: input.contentBrief.emotionalTone || 'engaging and authentic',
      targetAction: input.contentBrief.targetAction || 'engage with content',
      platform: input.platform,
      language: input.language,
      style: input.style,
      maxLength: input.maxLength || 'platform default',
      artistName: context.workflow.artistName,
      includeHashtags: input.includeHashtags,
    });
  }

  /**
   * Write caption for content
   */
  async write(
    topic: string,
    keyMessages: string[],
    context: AgentContext,
    options?: {
      platform?: CopywriterInput['platform'];
      language?: CopywriterInput['language'];
      style?: CopywriterInput['style'];
      emotionalTone?: string;
      targetAction?: string;
    }
  ) {
    return this.execute(
      {
        contentBrief: {
          topic,
          keyMessages,
          emotionalTone: options?.emotionalTone,
          targetAction: options?.targetAction,
        },
        platform: options?.platform || 'all',
        language: options?.language || 'ko',
        style: options?.style || 'casual',
        includeHashtags: true,
      },
      context
    );
  }

  /**
   * Generate multiple caption variations for A/B testing
   */
  async generateVariations(
    topic: string,
    context: AgentContext,
    count: number = 3
  ) {
    const styles: CopywriterInput['style'][] = ['casual', 'playful', 'emotional'];
    const results = await Promise.all(
      styles.slice(0, count).map(style =>
        this.write(topic, [`${topic} content`], context, { style })
      )
    );

    return results
      .filter(r => r.success)
      .map(r => r.data?.primaryCaption);
  }

  /**
   * Quick caption generation for real-time needs
   */
  async quickCaption(
    topic: string,
    platform: CopywriterInput['platform'],
    context: AgentContext
  ) {
    const result = await this.execute(
      {
        contentBrief: {
          topic,
          keyMessages: [topic],
        },
        platform,
        language: 'ko',
        style: 'casual',
        includeHashtags: true,
        maxLength: 150,
      },
      context
    );

    return result.success ? result.data?.primaryCaption.text : null;
  }
}

// Factory function
export function createCopywriterAgent(): CopywriterAgent {
  return new CopywriterAgent();
}
