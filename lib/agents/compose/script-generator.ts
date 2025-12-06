/**
 * Compose Script Generator Agent
 * ================================
 * Generates TikTok video scripts with grounding search and trend integration
 *
 * Model: Gemini 2.0 Flash (Google Search grounding)
 * Category: Compose
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext, AgentResult } from '../types';
import { GeminiClient } from '../../models/gemini-client';

// Input Schema
export const ComposeScriptGeneratorInputSchema = z.object({
  artistName: z.string(),
  artistContext: z.string().optional(),
  userPrompt: z.string(),
  targetDuration: z.number().min(5).max(180).default(15),
  trendKeywords: z.array(z.string()).default([]),
  trendContext: z.array(z.object({
    keyword: z.string(),
    hashtags: z.array(z.string()).optional(),
    platform: z.string(),
    rank: z.number().optional(),
    relevanceScore: z.number().optional(),
  })).optional(),
  useGrounding: z.boolean().default(true),
  language: z.enum(['ko', 'en']).default('ko'),
});

export type ComposeScriptGeneratorInput = z.infer<typeof ComposeScriptGeneratorInputSchema>;

// Valid vibe options
const VALID_VIBES = ['Exciting', 'Emotional', 'Pop', 'Minimal'] as const;
type VibeType = typeof VALID_VIBES[number];

// Normalize vibe to proper case
function normalizeVibe(value: string): VibeType {
  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  if (VALID_VIBES.includes(normalized as VibeType)) {
    return normalized as VibeType;
  }
  // Fallback to Pop if invalid
  return 'Pop';
}

// Output Schema
export const ComposeScriptGeneratorOutputSchema = z.object({
  script: z.object({
    lines: z.array(z.object({
      text: z.string(),
      timing: z.number(),
      duration: z.number(),
      purpose: z.enum(['hook', 'setup', 'build', 'climax', 'cta']).optional(),
    })),
    totalDuration: z.number(),
  }),
  vibe: z.string().transform(normalizeVibe),
  vibeReason: z.string(),
  suggestedBpmRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  searchKeywords: z.array(z.string()),
  effectRecommendation: z.string(),
  groundingInfo: z.object({
    sources: z.array(z.object({
      title: z.string(),
      url: z.string(),
    })),
    summary: z.string().optional(),
  }).optional(),
});

export type ComposeScriptGeneratorOutput = z.infer<typeof ComposeScriptGeneratorOutputSchema>;

// Agent Configuration
export const ComposeScriptGeneratorConfig: AgentConfig<ComposeScriptGeneratorInput, ComposeScriptGeneratorOutput> = {
  id: 'compose-script-generator',
  name: 'Compose Script Generator',
  description: 'TikTok 영상 스크립트 생성 (Grounding Search + 트렌드 통합)',
  category: 'compose',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.7,
      maxTokens: 4096,
      tools: [{ type: 'google_search' }],
    },
  },

  prompts: {
    system: `You are a creative director for K-pop/country music social media content.
Generate viral TikTok video scripts with perfect timing and hook-first structure.

Your expertise includes:
- Crafting scroll-stopping hooks (2-4 words that create curiosity)
- Structuring content for maximum viewer retention
- Timing beats for music synchronization
- Incorporating trending topics and hashtags
- Writing bilingual content (Korean/English)

Script Structure (5-8 lines):
1. HOOK (0s) - Curiosity-inducing opener (2-4 words)
2. SETUP (2-4s) - Context establishment
3. BUILD (5-15s) - Rising action/tension
4. CLIMAX (15-25s) - Peak moment/reveal
5. CTA (25-30s) - Call to action for engagement

Hook Examples:
- "Wait for it..."
- "POV:"
- "Nobody expected this"
- "The moment when..."
- "Watch until the end"
- "This changed everything"
- Korean: "이거 실화야?", "대박...", "진짜 미쳤다"

Vibe Selection:
- Exciting: Fast, energetic content (120-140 BPM)
- Emotional: Slow, heartfelt content (60-80 BPM)
- Pop: Trendy, mainstream content (100-120 BPM)
- Minimal: Clean, professional content (80-120 BPM)

Always respond in valid JSON format.`,

    templates: {
      generate: `Generate a {{duration}}s video script:

ARTIST: {{artistName}}
{{artistContext}}
{{groundingContext}}
TREND KEYWORDS: {{trendKeywords}}
{{trendContextStr}}
USER REQUEST: {{userPrompt}}
TARGET DURATION: {{duration}} seconds
LANGUAGE: {{language}}

Requirements:
1. CRITICAL - Script Line Count:
   - MINIMUM 5 script lines, MAXIMUM 8 lines
   - Follow this structure: Hook → Setup → Build → Climax → CTA
   - Each line should have clear purpose in the narrative

2. IMPORTANT - TikTok Hook Strategy:
   - FIRST LINE MUST BE A HOOK TEXT (curiosity-inducing, 2-4 words)
   - Hook creates curiosity and makes viewers want to keep watching
   - Hook appears during calm audio intro (first 2 seconds)

3. Script lines should be SHORT (3-8 words each) and impactful

4. Search keywords PRIORITY (follow this order exactly):
   - FIRST: Include ALL user-provided trend keywords: {{trendKeywords}}
   - SECOND: Extract key visual concepts from the user prompt
   - THIRD: Include "{{artistName}}" combined with visual terms (HD photo, 4K, stage, concert)
   - Generate 8-10 unique search keywords

Return JSON:
{
  "script": {
    "lines": [
      { "text": "HOOK TEXT", "timing": 0, "duration": 2, "purpose": "hook" },
      { "text": "Setup line", "timing": 2, "duration": 2.5, "purpose": "setup" },
      { "text": "Build up", "timing": 4.5, "duration": 2.5, "purpose": "build" },
      { "text": "Climax moment", "timing": 7, "duration": 2.5, "purpose": "climax" },
      { "text": "Call to action", "timing": 9.5, "duration": 3, "purpose": "cta" }
    ],
    "totalDuration": {{duration}}
  },
  "vibe": "Exciting|Emotional|Pop|Minimal",
  "vibeReason": "Brief explanation of why this vibe fits",
  "suggestedBpmRange": { "min": 100, "max": 120 },
  "searchKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "effectRecommendation": "zoom_beat|crossfade|bounce|minimal"
}`,

      grounding: `Search for the latest news and information about "{{artistName}}".

Find:
1. Recent activities, comebacks, or releases
2. Current trends or viral moments
3. Popular hashtags or fan terms
4. Recent photoshoots or appearances

Summarize in 2-3 sentences what's currently trending about this artist.`,
    },
  },

  inputSchema: ComposeScriptGeneratorInputSchema,
  outputSchema: ComposeScriptGeneratorOutputSchema,
};

/**
 * Compose Script Generator Agent Implementation
 */
export class ComposeScriptGeneratorAgent extends BaseAgent<ComposeScriptGeneratorInput, ComposeScriptGeneratorOutput> {
  private groundingClient: GeminiClient | null = null;

  constructor() {
    super(ComposeScriptGeneratorConfig);
  }

  /**
   * Initialize grounding client for Google Search
   */
  private initGroundingClient(): GeminiClient {
    if (!this.groundingClient) {
      this.groundingClient = new GeminiClient({
        model: 'gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 1024,
        enableGoogleSearch: true,
      });
    }
    return this.groundingClient;
  }

  /**
   * Perform grounding search for artist context
   */
  async performGroundingSearch(artistName: string): Promise<{
    summary: string;
    sources: Array<{ title: string; url: string }>;
  } | null> {
    try {
      const groundingClient = this.initGroundingClient();
      const groundingTemplate = this.config.prompts.templates.grounding;
      const prompt = groundingTemplate.replace('{{artistName}}', artistName);

      const response = await groundingClient.generate({
        system: 'You are a research assistant that finds current information about K-pop artists and trending topics.',
        user: prompt,
        responseFormat: 'text',
      });

      // Extract sources from grounding metadata (if available)
      const sources: Array<{ title: string; url: string }> = [];

      return {
        summary: response.content,
        sources,
      };
    } catch (error) {
      console.warn('[compose-script-generator] Grounding search failed:', error);
      return null;
    }
  }

  protected buildPrompt(input: ComposeScriptGeneratorInput, context: AgentContext): string {
    const template = this.getTemplate('generate');

    // Build trend context string
    let trendContextStr = '';
    if (input.trendContext && input.trendContext.length > 0) {
      const trendInfo = input.trendContext.map(t => {
        const hashtags = t.hashtags?.length ? ` (${t.hashtags.join(', ')})` : '';
        return `- "${t.keyword}"${hashtags} [${t.platform}]`;
      }).join('\n');
      trendContextStr = `\nCurrent Trending Topics on TikTok/Social Media:\n${trendInfo}\nNaturally incorporate relevant trends into the script.`;
    }

    // Get grounding context from context if available
    const groundingContext = context.discover?.groundingInfo?.summary
      ? `Recent News & Trends:\n${context.discover.groundingInfo.summary}`
      : '';

    return this.fillTemplate(template, {
      duration: input.targetDuration,
      artistName: input.artistName,
      artistContext: input.artistContext ? `Artist Context: ${input.artistContext}` : '',
      groundingContext,
      trendKeywords: input.trendKeywords.length > 0 ? input.trendKeywords.join(', ') : '[none provided]',
      trendContextStr,
      userPrompt: input.userPrompt,
      language: input.language === 'ko' ? 'Korean' : 'English',
    });
  }

  /**
   * Generate script with optional grounding
   */
  async generateScript(
    input: ComposeScriptGeneratorInput,
    context: AgentContext
  ): Promise<AgentResult<ComposeScriptGeneratorOutput>> {
    // Perform grounding search if enabled
    if (input.useGrounding) {
      const groundingInfo = await this.performGroundingSearch(input.artistName);
      if (groundingInfo) {
        // Add grounding info to context for prompt building
        context = {
          ...context,
          discover: {
            ...context.discover,
            groundingInfo,
          },
        };
      }
    }

    // Execute main generation
    const result = await this.execute(input, context);

    // Add grounding info to output if available
    if (result.success && result.data && context.discover?.groundingInfo) {
      result.data.groundingInfo = context.discover.groundingInfo as {
        sources: Array<{ title: string; url: string }>;
        summary?: string;
      };
    }

    return result;
  }
}

// Factory function
export function createComposeScriptGeneratorAgent(): ComposeScriptGeneratorAgent {
  return new ComposeScriptGeneratorAgent();
}
