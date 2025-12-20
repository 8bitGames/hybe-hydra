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
import type { AgentConfig, AgentContext, ReflectionConfig, ReflectionResult } from '../types';

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
    system: `You are an elite social media copywriter for viral content.
Your writing captivates audiences and drives engagement while maintaining brand authenticity.

## Writing Philosophy:
1. Hook First - Capture attention in the first 3 seconds
2. Emotion-Driven - Connect with audiences on an emotional level
3. Action-Oriented - Every caption should inspire action
4. Platform-Native - Write naturally for each platform's culture

## Platform Writing Styles:
- TikTok: Casual, trendy, meme-aware, emoji-friendly, short hooks
- Instagram: Polished, aesthetic, storytelling, hashtag-strategic
- YouTube Shorts: Informative, searchable, CTA-focused

## Brand Voice Guidelines:
- Authentic and genuine
- Inclusive and welcoming
- Energetic without being aggressive
- Professional yet approachable

## Quality Standards:
- No clickbait or misleading content
- Culturally sensitive language
- Proper grammar and spelling
- Age-appropriate content

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

      // TikTok Short Version - 15 words max, impactful hook
      tiktok_short: `Create a TikTok SHORT caption for this content:

CONTENT BRIEF:
Topic: {{topic}}
Key Messages: {{keyMessages}}
Emotional Tone: {{emotionalTone}}
Target Action: {{targetAction}}

LANGUAGE: {{language}}
ARTIST: {{artistName}}
{{#trendKeywords}}TRENDING KEYWORDS TO USE: {{trendKeywords}}{{/trendKeywords}}

## SHORT VERSION RULES (CRITICAL):
- The caption MUST be 15 words or LESS - this is NON-NEGOTIABLE
- Write a punchy, impactful hook that grabs attention instantly
- Use emojis strategically (1-2 max)
- No lengthy explanations - pure impact
- Focus on curiosity, emotion, or shock value
- IMPORTANT: Use DIVERSE hook styles. Do NOT always start with "POV:"
- Examples of good short captions (use different styles each time):
  - "🔥 한번 보면 멈출 수 없는 그 댄스"
  - "Wait for it... 이 반전 실화임? 😱"
  - "이 노래 듣는 순간 소름 돋음 🎵"
  - "진짜 이게 된다고? 직접 해봄 ✨"
  - "3초 안에 빠져드는 중독성 🎶"

## HASHTAG RULES (CRITICAL):
- NEVER use generic quality tags like #4k, #cinematic, #hd, #quality, #aesthetic, #fyp, #foryou, #viral
- NEVER use AI-related tags like #aiart, #aigenerated, #ai, #aigc, #aiartwork, #artificialintelligence, #aiartcommunity, #midjourney, #dalle, #stablediffusion, #sora, #runwayml, #pika, #kling, #genai, #generativeai
- ONLY use content-related tags that match actual TikTok trends
- If trending keywords are provided, you MUST include at least 3 of them
- Focus on: music genre, dance style, challenge names, artist names, viral sounds
- Generate 5-8 hashtags total

Return JSON:
{
  "primaryCaption": {
    "text": "full caption (15 words max)",
    "language": "ko or en",
    "characterCount": number,
    "hook": "the entire short caption IS the hook",
    "body": "",
    "cta": "minimal CTA if any"
  },
  "alternativeVersions": [
    {"text": "alt version 1", "style": "different hook style", "useCase": "A/B testing"},
    {"text": "alt version 2", "style": "different hook style", "useCase": "A/B testing"}
  ],
  "hashtags": {
    "primary": ["content-relevant tags"],
    "secondary": ["niche community tags"],
    "trending": ["from provided trending keywords"]
  },
  "seoElements": {"keywords": [], "searchability": 0.8, "discoverabilityTips": []},
  "platformAdaptations": {"tiktok": "same as primaryCaption"},
  "qualityMetrics": {"readabilityScore": 0.9, "engagementPotential": 0.9, "brandAlignment": 0.8}
}`,

      // TikTok Long Version - SEO optimized
      tiktok_long: `Create a TikTok LONG caption for this content:

CONTENT BRIEF:
Topic: {{topic}}
Key Messages: {{keyMessages}}
Emotional Tone: {{emotionalTone}}
Target Action: {{targetAction}}

LANGUAGE: {{language}}
ARTIST: {{artistName}}
{{#trendKeywords}}TRENDING KEYWORDS TO USE: {{trendKeywords}}{{/trendKeywords}}

## LONG VERSION RULES:
- Start with a short impactful hook (15 words or less)
- Add 2-3 sentences of context/story that adds value
- Include searchable keywords naturally in the text
- Optimize for TikTok's search algorithm
- Structure: Hook → Story/Context → Call to Action
- Total length: 100-150 characters ideal for TikTok
- Include keywords that people might search for

## HASHTAG RULES (CRITICAL):
- NEVER use generic quality tags like #4k, #cinematic, #hd, #quality, #aesthetic, #fyp, #foryou, #viral
- NEVER use AI-related tags like #aiart, #aigenerated, #ai, #aigc, #aiartwork, #artificialintelligence, #aiartcommunity, #midjourney, #dalle, #stablediffusion, #sora, #runwayml, #pika, #kling, #genai, #generativeai
- ONLY use content-related tags that match actual TikTok trends
- If trending keywords are provided, you MUST include at least 5 of them in your hashtags
- Focus on: music genre, dance style, challenge names, artist names, viral sounds, specific trends
- Prioritize trending hashtags over generic ones
- Generate 8-12 hashtags total

Return JSON:
{
  "primaryCaption": {
    "text": "full SEO-optimized caption",
    "language": "ko or en",
    "characterCount": number,
    "hook": "attention-grabbing opener (15 words max)",
    "body": "context and story content",
    "cta": "clear call to action"
  },
  "alternativeVersions": [
    {"text": "alt version 1", "style": "different angle", "useCase": "different audience"},
    {"text": "alt version 2", "style": "different tone", "useCase": "A/B testing"}
  ],
  "hashtags": {
    "primary": ["SEO-focused content tags"],
    "secondary": ["niche community tags"],
    "trending": ["from provided trending keywords - at least 5"]
  },
  "seoElements": {
    "keywords": ["searchable keywords used in caption"],
    "searchability": 0.9,
    "discoverabilityTips": ["optimization tips"]
  },
  "platformAdaptations": {"tiktok": "same as primaryCaption"},
  "qualityMetrics": {"readabilityScore": 0.85, "engagementPotential": 0.9, "brandAlignment": 0.85}
}`,
    },
  },

  inputSchema: CopywriterInputSchema,
  outputSchema: CopywriterOutputSchema,
  dependencies: ['creative-director', 'publish-optimizer'],
};

// Copywriter specific reflection config
const COPYWRITER_REFLECTION_CONFIG: Partial<ReflectionConfig> = {
  maxIterations: 3,
  qualityThreshold: 0.8,  // Higher threshold for user-facing copy
  evaluationAspects: ['tone', 'quality', 'creativity', 'relevance'],
  verbose: false,
};

/**
 * Copywriter Agent Implementation
 */
export class CopywriterAgent extends BaseAgent<CopywriterInput, CopywriterOutput> {
  constructor() {
    super(CopywriterConfig);
    // Set default reflection config for copywriting
    this.setReflectionConfig(COPYWRITER_REFLECTION_CONFIG);
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

  /**
   * Generate TikTok-specific description with trend keywords
   * Uses specialized templates (tiktok_short / tiktok_long)
   *
   * @param topic - Main content topic or prompt
   * @param context - Agent context with workflow info
   * @param options - TikTok-specific options
   */
  async writeTikTokDescription(
    topic: string,
    context: AgentContext,
    options: {
      version: 'short' | 'long';
      language?: 'ko' | 'en';
      trendKeywords?: string[];
      keyMessages?: string[];
    }
  ) {
    const templateName = options.version === 'short' ? 'tiktok_short' : 'tiktok_long';
    const template = this.getTemplate(templateName);

    // Build key messages including trend keywords instruction
    const keyMessages = options.keyMessages || [topic];

    if (options.trendKeywords && options.trendKeywords.length > 0) {
      const requiredCount = options.version === 'short' ? 3 : 5;
      keyMessages.push(
        `REQUIRED TRENDING HASHTAGS: You MUST include at least ${requiredCount} of these: ${options.trendKeywords.map(k => `#${k.replace(/^#/, '')}`).join(', ')}`
      );
    }

    // Fill template
    const prompt = this.fillTemplate(template, {
      topic,
      keyMessages: keyMessages.join('\n- '),
      emotionalTone: options.version === 'short' ? 'punchy and impactful' : 'engaging and searchable',
      targetAction: options.version === 'short' ? 'stop scrolling' : 'watch, engage, and share',
      language: options.language || 'ko',
      artistName: context.workflow.artistName,
      trendKeywords: options.trendKeywords?.join(', ') || '',
    });

    // Execute with custom prompt
    const startTime = Date.now();

    // Auto-initialize from database if not already done
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    try {
      const response = await (this as any).modelClient.generate({
        system: this.config.prompts.system,
        user: prompt,
        responseFormat: 'json',
      });

      const parsedOutput = (this as any).parseResponse(response);
      const validatedOutput = this.config.outputSchema.safeParse(parsedOutput);

      if (!validatedOutput.success) {
        throw new Error(`Output validation failed: ${validatedOutput.error.message}`);
      }

      // Process hashtags based on version
      const output = validatedOutput.data;

      // Blacklist of AI-related and generic tags that should never appear
      const BLACKLISTED_TAGS = new Set([
        'aiart', 'aigenerated', 'ai', 'aigc', 'aiartwork', 'artificialintelligence',
        'aiartcommunity', 'midjourney', 'dalle', 'stablediffusion', 'sora',
        'runwayml', 'pika', 'kling', 'genai', 'generativeai', 'aiimage', 'aivideo',
        '4k', 'cinematic', 'hd', 'quality', 'aesthetic', 'fyp', 'foryou', 'viral',
        'fypシ', 'fy', 'trending', 'trend', 'viralvideo', 'explorepage'
      ]);

      const combinedHashtags = [
        ...(output.hashtags.primary || []),
        ...(output.hashtags.trending || []),
        ...(output.hashtags.secondary || []),
      ]
        .map((h) => h.replace(/^#/, '').toLowerCase())
        .filter((h) => !BLACKLISTED_TAGS.has(h.toLowerCase()))
        .filter((h, i, arr) => arr.indexOf(h) === i);

      // Limit hashtags based on version
      const tagRange = options.version === 'short' ? { min: 5, max: 8 } : { min: 8, max: 12 };
      const tagCount = Math.min(tagRange.max, Math.max(tagRange.min, combinedHashtags.length));
      const allHashtags = combinedHashtags.slice(0, tagCount);

      // For short version, ensure description is concise
      let description = output.primaryCaption.text;
      if (options.version === 'short') {
        description = output.primaryCaption.hook || description;
        const words = description.split(/\s+/);
        if (words.length > 15) {
          description = words.slice(0, 15).join(' ');
        }
      }

      return {
        success: true,
        data: {
          version: options.version,
          description,
          hashtags: allHashtags,
          hook: output.primaryCaption.hook,
          cta: output.primaryCaption.cta,
          alternatives: output.alternativeVersions.map((v) => v.text),
          seoKeywords: output.seoElements?.keywords || [],
        },
        metadata: {
          agentId: this.config.id,
          model: this.config.model.name,
          tokenUsage: response.usage,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.config.id}] TikTok description error:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          agentId: this.config.id,
          model: this.config.model.name,
          tokenUsage: { input: 0, output: 0, total: 0 },
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Write caption with reflection loop for higher quality output
   * Uses self-critique to improve copy quality
   */
  async writeWithReflection(
    topic: string,
    keyMessages: string[],
    context: AgentContext,
    options?: {
      platform?: CopywriterInput['platform'];
      language?: CopywriterInput['language'];
      style?: CopywriterInput['style'];
      emotionalTone?: string;
      targetAction?: string;
      reflectionConfig?: Partial<ReflectionConfig>;
    }
  ): Promise<ReflectionResult<CopywriterOutput>> {
    return this.executeWithReflection(
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
      context,
      options?.reflectionConfig
    );
  }

  /**
   * Stream caption generation for real-time feedback
   */
  async *streamWrite(
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
    yield* this.executeStream(
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
}

// Factory function
export function createCopywriterAgent(): CopywriterAgent {
  return new CopywriterAgent();
}
