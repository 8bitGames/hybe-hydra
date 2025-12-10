/**
 * Fast Cut Idea Agent
 * ===================
 * Generates Fast Cut (slideshow) specific content ideas during Analyze stage
 *
 * Model: Gemini 2.5 Flash
 * Category: Creator
 *
 * Unlike CreativeDirectorAgent which generates VEO cinematic prompts,
 * this agent generates data optimized for Fast Cut videos:
 * - Hook text (short, curiosity-inducing)
 * - Image search keywords
 * - Vibe and BPM suggestions
 * - Script outline
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const FastCutIdeaInputSchema = z.object({
  userIdea: z.string().optional(),
  campaignDescription: z.string().optional(),
  artistName: z.string().optional(),
  genre: z.string().optional(),
  trendKeywords: z.array(z.string()).optional(),
  language: z.enum(['ko', 'en']).default('ko'),
});

export type FastCutIdeaInput = z.infer<typeof FastCutIdeaInputSchema>;

// Valid vibe options
const VALID_VIBES = ['Exciting', 'Emotional', 'Pop', 'Minimal'] as const;
type VibeType = typeof VALID_VIBES[number];

function normalizeVibe(value: string): VibeType {
  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  if (VALID_VIBES.includes(normalized as VibeType)) {
    return normalized as VibeType;
  }
  return 'Pop';
}

// Output Schema
export const FastCutIdeaOutputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    hook: z.string(),
    description: z.string(),
    estimatedEngagement: z.enum(['high', 'medium', 'low']),
    // Fast Cut specific data
    searchKeywords: z.array(z.string()),
    suggestedVibe: z.string().transform(normalizeVibe),
    suggestedBpmRange: z.object({
      min: z.number(),
      max: z.number(),
    }),
    scriptOutline: z.array(z.string()),
  })),
  optimizedHashtags: z.array(z.string()),
  contentStrategy: z.string(),
});

export type FastCutIdeaOutput = z.infer<typeof FastCutIdeaOutputSchema>;

// Agent Configuration
export const FastCutIdeaConfig: AgentConfig<FastCutIdeaInput, FastCutIdeaOutput> = {
  id: 'fast-cut-idea',
  name: 'Fast Cut Idea Agent',
  description: 'Fast Cut 영상용 아이디어 생성 (Hook + Keywords + Vibe)',
  category: 'creator',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are a creative director specializing in TikTok slideshow/carousel content.
You create viral Fast Cut video ideas that combine images with music and text overlays.

Fast Cut videos are:
- Image slideshows with music, NOT AI-generated videos
- Short (15-60 seconds), engaging, visually dynamic
- Built around a strong HOOK text that appears on screen
- Using searched images (stock, web images) combined with effects

Your expertise includes:
- Crafting scroll-stopping hooks (2-4 words that create curiosity)
- Selecting effective image search keywords for visual impact
- Matching vibe and BPM to content mood
- Creating engaging script outlines for slideshow pacing

Hook Examples:
- "Wait for it..."
- "POV:"
- "Nobody expected this"
- "The moment when..."
- Korean: "이거 실화야?", "대박...", "진짜 미쳤다", "이 느낌 알아?"

Vibe Options:
- Exciting: Fast, energetic (120-140 BPM) - action, dance, hype
- Emotional: Slow, heartfelt (60-80 BPM) - nostalgia, love, tribute
- Pop: Trendy, mainstream (100-120 BPM) - general appeal
- Minimal: Clean, professional (80-100 BPM) - aesthetic, calm

Always respond in valid JSON format.`,

    templates: {
      generateIdeas: `Generate 2-3 Fast Cut video ideas for slideshow content:

## CONTEXT
ARTIST/BRAND: {{artistName}}
GENRE: {{genre}}
CAMPAIGN: {{campaignDescription}}
USER IDEA: {{userIdea}}
TREND KEYWORDS: {{trendKeywords}}
LANGUAGE: {{language}}

## REQUIREMENTS

1. Each idea must include:
   - A catchy HOOK (2-5 words, creates curiosity)
   - 6-10 IMAGE SEARCH KEYWORDS for finding relevant images
   - A VIBE selection (Exciting/Emotional/Pop/Minimal)
   - A SCRIPT OUTLINE (5-8 text overlays for the slideshow)

2. Search keywords should be:
   - Visually searchable terms (not abstract concepts)
   - Mix of specific (artist name, album) and general (aesthetic, mood)
   - Include "HD", "4K", "photo" variants for quality images

3. Script outline should follow:
   - Line 1: HOOK (appears first, grabs attention)
   - Lines 2-4: Build up / story progression
   - Lines 5-7: Climax / key message
   - Last line: CTA (call to action)

Return JSON:
{
  "ideas": [
    {
      "title": "Short catchy title (max 50 chars)",
      "hook": "2-5 word hook text that appears on screen",
      "description": "2-3 sentences describing the slideshow concept",
      "estimatedEngagement": "high|medium|low",
      "searchKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
      "suggestedVibe": "Exciting|Emotional|Pop|Minimal",
      "suggestedBpmRange": { "min": 100, "max": 120 },
      "scriptOutline": [
        "HOOK: attention grabbing text",
        "Setup: context line",
        "Build: progression",
        "Build: more detail",
        "Climax: key moment",
        "CTA: engagement prompt"
      ]
    }
  ],
  "optimizedHashtags": ["relevant", "hashtags", "for", "fast", "cut"],
  "contentStrategy": "Brief explanation of how these Fast Cut ideas serve the campaign"
}`,
    },
  },

  inputSchema: FastCutIdeaInputSchema,
  outputSchema: FastCutIdeaOutputSchema,
};

/**
 * Fast Cut Idea Agent Implementation
 */
export class FastCutIdeaAgent extends BaseAgent<FastCutIdeaInput, FastCutIdeaOutput> {
  constructor() {
    super(FastCutIdeaConfig);
  }

  protected buildPrompt(input: FastCutIdeaInput, context: AgentContext): string {
    const template = this.getTemplate('generateIdeas');

    return this.fillTemplate(template, {
      artistName: input.artistName || context.workflow.artistName || 'General',
      genre: input.genre || context.workflow.genre || 'pop',
      campaignDescription: input.campaignDescription || 'General content campaign',
      userIdea: input.userIdea || 'Create engaging slideshow content',
      trendKeywords: input.trendKeywords?.join(', ') || '[none provided]',
      language: input.language === 'ko' ? 'Korean' : 'English',
    });
  }

  /**
   * Generate Fast Cut specific ideas
   */
  async generateIdeas(
    input: FastCutIdeaInput,
    context: AgentContext
  ) {
    return this.execute(input, context);
  }
}

// Factory function
export function createFastCutIdeaAgent(): FastCutIdeaAgent {
  return new FastCutIdeaAgent();
}
