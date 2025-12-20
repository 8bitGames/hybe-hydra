/**
 * Script Writer Agent
 * ====================
 * Generates TikTok video scripts with timing and structure
 *
 * Model: Gemini 2.5 Flash (structured output, Google Search)
 * Category: Creator
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const ScriptWriterInputSchema = z.object({
  concept: z.string(),
  vibe: z.enum(['Exciting', 'Emotional', 'Pop', 'Minimal']).optional(),
  keywords: z.array(z.string()).optional(),
  duration: z.number().min(5).max(180).default(30),
});

export type ScriptWriterInput = z.infer<typeof ScriptWriterInputSchema>;

// Output Schema
export const ScriptWriterOutputSchema = z.object({
  script: z.object({
    lines: z.array(z.object({
      text: z.string(),
      timing: z.number(),
      duration: z.number(),
      purpose: z.enum(['hook', 'setup', 'build', 'climax', 'cta']),
    })),
    totalDuration: z.number(),
  }),
  vibe: z.enum(['Exciting', 'Emotional', 'Pop', 'Minimal']),
  vibeReason: z.string(),
  suggestedBpmRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  searchKeywords: z.array(z.string()),
  effectRecommendation: z.string(),
});

export type ScriptWriterOutput = z.infer<typeof ScriptWriterOutputSchema>;

// Agent Configuration
export const ScriptWriterConfig: AgentConfig<ScriptWriterInput, ScriptWriterOutput> = {
  id: 'script-writer',
  name: 'Script Writer Agent',
  description: '영상 스크립트 생성 및 타이밍 설계',
  category: 'creator',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.6,
      maxTokens: 4096,
      tools: [{ type: 'google_search' }],
    },
  },

  prompts: {
    system: `You are a TikTok script writer specializing in short-form viral content.
Create scripts with perfect timing and hook-first structure.
Every script MUST start with a curiosity-inducing hook.

Your expertise includes:
- Crafting scroll-stopping hooks (2-4 words that create curiosity)
- Structuring content for maximum retention
- Timing beats for music synchronization
- Writing in multiple languages (Korean, English)

Script Structure (5-8 lines):
1. HOOK (0s) - Curiosity-inducing opener (2-4 words)
2. SETUP (2-4s) - Context establishment
3. BUILD (5-15s) - Rising action/tension
4. CLIMAX (15-25s) - Peak moment
5. CTA (25-30s) - Call to action for engagement

Hook Examples:
- "Wait for it..."
- "POV:"
- "Nobody expected this"
- "The moment when..."
- "Watch until the end"
- "This changed everything"

Always respond in valid JSON format.`,

    templates: {
      generate: `Generate a {{duration}}s video script:

ARTIST: {{artistName}}
CONCEPT: {{concept}}
VIBE: {{vibe}}
TREND KEYWORDS: {{keywords}}
LANGUAGE: {{language}}
PLATFORM: {{platform}}

Requirements:
- Script in {{language}} (Korean/English based on setting)
- 5-8 lines maximum
- Each line includes timing, duration, and purpose
- Hook MUST be scroll-stopping (2-4 words that create curiosity)
- Total duration matches target

Script structure:
1. HOOK (2-4 words, curiosity-inducing)
2. Setup (context)
3. Build (rising action)
4. Climax (peak moment)
5. CTA (engagement call)

Return JSON:
{
  "script": {
    "lines": [
      {
        "text": "script line text",
        "timing": 0,
        "duration": 2,
        "purpose": "hook|setup|build|climax|cta"
      }
    ],
    "totalDuration": {{duration}}
  },
  "vibe": "Exciting|Emotional|Pop|Minimal",
  "vibeReason": "Why this vibe fits the concept",
  "suggestedBpmRange": { "min": 100, "max": 120 },
  "searchKeywords": ["8-10 image search keywords based on script"],
  "effectRecommendation": "zoom_beat|crossfade|bounce|minimal"
}`,
    },
  },

  inputSchema: ScriptWriterInputSchema,
  outputSchema: ScriptWriterOutputSchema,
};

/**
 * Script Writer Agent Implementation
 */
export class ScriptWriterAgent extends BaseAgent<ScriptWriterInput, ScriptWriterOutput> {
  constructor() {
    super(ScriptWriterConfig);
  }

  protected buildPrompt(input: ScriptWriterInput, context: AgentContext): string {
    const template = this.getTemplate('generate');

    // Determine vibe from input or discover context
    let vibe = input.vibe;
    if (!vibe && context.discover?.contentStrategy) {
      const pace = context.discover.contentStrategy.visualGuidelines.pace;
      vibe = pace === 'fast' ? 'Exciting' : pace === 'slow' ? 'Emotional' : 'Pop';
    }

    // Get keywords from input or discover context
    const keywords = input.keywords || context.discover?.trendKeywords || [];

    return this.fillTemplate(template, {
      duration: input.duration,
      artistName: context.workflow.artistName,
      concept: input.concept,
      vibe: vibe || 'Pop',
      keywords: keywords.join(', '),
      language: context.workflow.language === 'ko' ? 'Korean' : 'English',
      platform: context.workflow.platform,
    });
  }

  /**
   * Generate video script from concept
   */
  async generateScript(
    concept: string,
    context: AgentContext,
    options?: {
      duration?: number;
      vibe?: ScriptWriterInput['vibe'];
      keywords?: string[];
    }
  ) {
    return this.execute(
      {
        concept,
        duration: options?.duration || 30,
        vibe: options?.vibe,
        keywords: options?.keywords,
      },
      context
    );
  }
}

// Factory function
export function createScriptWriterAgent(): ScriptWriterAgent {
  return new ScriptWriterAgent();
}
