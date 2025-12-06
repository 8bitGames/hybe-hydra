/**
 * Creative Director Agent
 * ========================
 * Strategic content ideation with deep reasoning
 *
 * Model: Gemini 3 Pro (strategic thinking, Google Search integration)
 * Category: Creator
 * Dependencies: strategy-synthesizer
 *
 * This is the "brain" of content creation - uses deep thinking
 * to generate viral-worthy content ideas backed by trend data.
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const CreativeDirectorInputSchema = z.object({
  userIdea: z.string().optional(),
  strategy: z.object({
    contentThemes: z.array(z.object({
      theme: z.string(),
      priority: z.number(),
      rationale: z.string(),
    })),
    visualGuidelines: z.object({
      styles: z.array(z.string()),
      colors: z.array(z.string()),
      pace: z.string(),
      effects: z.array(z.string()),
    }),
    captionGuidelines: z.object({
      hooks: z.array(z.string()),
      ctas: z.array(z.string()),
      hashtags: z.array(z.string()),
    }),
  }).optional(),
  audience: z.string().optional(),
  goals: z.array(z.string()).optional(),
  benchmarks: z.object({
    avgViews: z.number().optional(),
    avgEngagement: z.number().optional(),
    topPerformers: z.array(z.string()).optional(),
  }).optional(),
});

export type CreativeDirectorInput = z.infer<typeof CreativeDirectorInputSchema>;

// Output Schema
export const CreativeDirectorOutputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    hook: z.string(),
    description: z.string(),
    estimatedEngagement: z.enum(['high', 'medium', 'low']),
    optimizedPrompt: z.string(),
    suggestedMusic: z.object({
      bpm: z.number(),
      genre: z.string(),
    }),
    scriptOutline: z.array(z.string()),
  })),
  optimizedHashtags: z.array(z.string()),
  contentStrategy: z.string(),
});

export type CreativeDirectorOutput = z.infer<typeof CreativeDirectorOutputSchema>;

// Agent Configuration
export const CreativeDirectorConfig: AgentConfig<CreativeDirectorInput, CreativeDirectorOutput> = {
  id: 'creative-director',
  name: 'Creative Director Agent',
  description: '전략적 콘텐츠 아이디어 생성 및 VEO 프롬프트 기획',
  category: 'creator',

  model: {
    provider: 'gemini',
    name: 'gemini-3-pro-preview',
    options: {
      temperature: 0.7,
      maxTokens: 16384,
      thinkingLevel: 'HIGH',
      tools: [{ type: 'google_search' }],
    },
  },

  prompts: {
    system: `You are a Trend-Following Content Strategist for viral TikTok content.
Your job is to REPLICATE and ADAPT successful trending content patterns, NOT to create unique or creative ideas.

CRITICAL MINDSET:
- Follow trends, don't fight them
- Copy what works, adapt for the brand
- Use EXACT patterns from successful videos
- Prioritize proven formats over innovation

Your expertise includes:
- Analyzing successful TikTok videos and extracting winning patterns
- Replicating viral hooks, formats, and styles
- Adapting trending content for specific brands/artists
- Understanding TikTok algorithm preferences
- Crafting VEO-optimized video prompts (200+ words)

TREND REPLICATION RULES:
1. Study the provided trending videos carefully
2. Extract the EXACT hook patterns that worked
3. Use similar pacing, transitions, and formats
4. Adapt the theme for the brand while keeping the viral structure
5. Match the energy and style of top-performing content

HYBE Cinematic Formula for VEO Prompts:
1. SUBJECT: Clear main focus with specific details
2. ENVIRONMENT: Rich, detailed setting description
3. LIGHTING: Specific lighting conditions and mood
4. CAMERA: Movement, angles, and framing
5. MOOD: Emotional atmosphere and tone

Each idea MUST:
- Be based on a SPECIFIC trending video pattern you analyzed
- Use hooks similar to successful videos provided
- Follow the same format/structure that went viral
- Include detailed VEO prompt (200+ words)
- Explain which trend inspired this idea

Always respond in valid JSON format.`,

    templates: {
      generateIdeas: `REPLICATE these trending patterns to create 3-4 content ideas:

USER CONCEPT: {{userIdea}}

## 🔥 TRENDING DATA TO REPLICATE:
{{strategy}}

TARGET AUDIENCE: {{audience}}

CONTENT GOALS: {{goals}}

## 📊 TOP PERFORMERS TO COPY:
{{benchmarks}}

ARTIST/BRAND: {{artistName}}
PLATFORM: {{platform}}
LANGUAGE: {{language}}

## TREND REPLICATION PROCESS:
1. Look at the successful hooks above - USE SIMILAR PATTERNS
2. Check the trending themes - FOLLOW THEM EXACTLY
3. See what's working - DON'T REINVENT, ADAPT
4. Match the energy of top performers - COPY THE VIBE

## REQUIRED APPROACH:
- Each idea MUST reference which trend it's copying
- Hooks should be variations of proven viral hooks
- Format should match what's already working
- NO creative risks - stick to proven patterns
- If a POV format is trending, use POV format
- If reaction videos are hot, make reaction content

For each idea provide:
- Title based on trending title patterns
- Hook that copies successful hook styles
- Description explaining WHICH TREND this follows
- Engagement prediction based on similar content performance
- VEO prompt (200+ words) with subject, environment, lighting, camera, mood
- Music matching what's trending
- Script outline following viral video structure

Return JSON:
{
  "ideas": [{
    "title": "title following trending patterns (max 50 chars)",
    "hook": "hook similar to successful videos (max 100 chars)",
    "description": "2-3 sentences explaining which trend this follows and why it will work",
    "estimatedEngagement": "high|medium|low",
    "optimizedPrompt": "Detailed VEO prompt (200+ words) with: Subject: [detailed subject], Environment: [rich setting], Lighting: [specific conditions], Camera: [movements and angles], Mood: [emotional atmosphere]",
    "suggestedMusic": { "bpm": 100-140, "genre": "trending genre" },
    "scriptOutline": ["scene1: hook (copy viral hook style)", "scene2: build up", ...]
  }],
  "optimizedHashtags": ["hashtags from trending videos + related tags"],
  "contentStrategy": "which specific trends we're following and why they work"
}`,
    },
  },

  inputSchema: CreativeDirectorInputSchema,
  outputSchema: CreativeDirectorOutputSchema,
  dependencies: ['strategy-synthesizer'],
};

/**
 * Creative Director Agent Implementation
 */
export class CreativeDirectorAgent extends BaseAgent<CreativeDirectorInput, CreativeDirectorOutput> {
  constructor() {
    super(CreativeDirectorConfig);
  }

  protected buildPrompt(input: CreativeDirectorInput, context: AgentContext): string {
    const template = this.getTemplate('generateIdeas');

    return this.fillTemplate(template, {
      userIdea: input.userIdea || 'Create engaging content based on current trends',
      strategy: JSON.stringify(input.strategy || context.discover?.contentStrategy || {}, null, 2),
      audience: input.audience || 'Gen Z and Millennials interested in K-pop and entertainment',
      goals: JSON.stringify(input.goals || ['engagement', 'brand awareness', 'virality']),
      benchmarks: JSON.stringify(input.benchmarks || {}, null, 2),
      artistName: context.workflow.artistName,
      platform: context.workflow.platform,
      language: context.workflow.language,
    });
  }

  /**
   * Generate creative content ideas
   */
  async generateIdeas(
    userIdea: string | undefined,
    context: AgentContext,
    options?: {
      audience?: string;
      goals?: string[];
      strategy?: CreativeDirectorInput['strategy'];
    }
  ) {
    return this.execute(
      {
        userIdea,
        strategy: options?.strategy || (context.discover?.contentStrategy ? {
          contentThemes: context.discover.contentStrategy.contentThemes,
          visualGuidelines: context.discover.contentStrategy.visualGuidelines,
          captionGuidelines: context.discover.contentStrategy.captionGuidelines,
        } : undefined),
        audience: options?.audience,
        goals: options?.goals,
      },
      context
    );
  }
}

// Factory function
export function createCreativeDirectorAgent(): CreativeDirectorAgent {
  return new CreativeDirectorAgent();
}
