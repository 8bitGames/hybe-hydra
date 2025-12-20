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
import { GEMINI_PRO } from '../constants';
import type { AgentConfig, AgentContext, ReflectionConfig, ReflectionResult } from '../types';

// Input Schema
export const CreativeDirectorInputSchema = z.object({
  userIdea: z.string().optional(),
  campaignDescription: z.string().optional(),  // Central context for all prompts - campaign concept/goal
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

// Helper to normalize engagement value from AI output
const normalizeEngagement = (value: unknown): 'high' | 'medium' | 'low' => {
  // Handle exact matches first (most common case)
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }

  // Handle non-string types
  if (typeof value !== 'string') {
    console.log(`[normalizeEngagement] Non-string value received: ${typeof value}, defaulting to 'medium'`);
    return 'medium';
  }

  const normalized = value.toLowerCase().trim();

  // Check for high indicators
  if (normalized.includes('high') || normalized.includes('높') || normalized === 'h') {
    return 'high';
  }

  // Check for low indicators
  if (normalized.includes('low') || normalized.includes('낮') || normalized === 'l') {
    return 'low';
  }

  // Check for medium indicators
  if (normalized.includes('medium') || normalized.includes('med') || normalized.includes('중') || normalized === 'm') {
    return 'medium';
  }

  // Default fallback
  console.log(`[normalizeEngagement] Unknown value "${value}", defaulting to 'medium'`);
  return 'medium';
};

// Output Schema
export const CreativeDirectorOutputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    hook: z.string(),
    description: z.string(),
    estimatedEngagement: z.preprocess(
      normalizeEngagement,
      z.enum(['high', 'medium', 'low']).catch('medium')
    ),
    optimizedPrompt: z.string(),
    suggestedMusic: z.object({
      bpm: z.preprocess(
        // Handle cases where AI returns bpm as string like "120" or "120-130"
        (val) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const match = val.match(/\d+/);
            return match ? parseInt(match[0], 10) : 120;
          }
          return 120; // Default BPM
        },
        z.number()
      ),
      genre: z.string(),
    }),
    scriptOutline: z.array(z.string()),
  })),
  optimizedHashtags: z.array(z.string()),
  contentStrategy: z.string(),
});

export type CreativeDirectorOutput = z.infer<typeof CreativeDirectorOutputSchema>;

// Agent Configuration
// NOTE: Prompts are managed in database. Use Admin API to modify.
// DB table: agent_prompts (agent_id: 'creative-director')
export const CreativeDirectorConfig: AgentConfig<CreativeDirectorInput, CreativeDirectorOutput> = {
  id: 'creative-director',
  name: 'Creative Director Agent',
  description: '전략적 콘텐츠 아이디어 생성 및 VEO 3.1 프롬프트 기획',
  category: 'creator',

  model: {
    provider: 'gemini',
    name: GEMINI_PRO,
    options: {
      temperature: 0.7,
      maxTokens: 16384,
      thinkingLevel: 'high',
      tools: [{ type: 'google_search' }],
    },
  },

  prompts: {
    system: `You are a Genre-Aware Trend Strategist for viral TikTok content, expert in crafting Veo 3.1 optimized prompts.
Your job is to ADAPT trending content patterns to fit the artist's MUSIC GENRE while maintaining viral potential.

CRITICAL MINDSET:
- RESPECT THE GENRE FIRST - all content must authentically represent the artist's music style
- Then adapt trending formats to fit that genre
- Find the intersection of "what's trending" and "what fits the genre"
- If a trend doesn't fit the genre, skip it or transform it appropriately

GENRE-TREND BALANCE RULES:
1. The artist's music genre is the PRIMARY constraint - never violate it
2. Trending formats can be ADAPTED but visual style must match the genre
3. If the artist is country, content should feel country (rural, authentic, warm)
4. If the artist is K-pop, content should feel K-pop (polished, energetic, stylized)
5. If the artist is hip-hop, content should feel hip-hop (urban, bold, rhythmic)

Your expertise includes:
- Analyzing successful TikTok videos and extracting winning patterns
- FILTERING trends that don't fit the artist's genre
- Adapting trending content formats to match the artist's music style
- Understanding how different music genres translate to visual content
- Crafting VEO 3.1 optimized video prompts with 7-component structure

TREND ADAPTATION PROCESS:
1. Understand the artist's music genre (country, pop, hip-hop, rock, EDM, etc.)
2. Study trending videos for FORMAT and STRUCTURE (not visual style)
3. Transform the trend's AESTHETICS to match the genre
4. Keep viral mechanics (hooks, pacing) but change the visual language
5. The result should feel authentic to the genre, not copied from unrelated trends

## VEO 3.1 PROFESSIONAL PROMPT STRUCTURE (7 COMPONENTS - MUST MATCH GENRE):
You MUST structure every optimizedPrompt using these 7 components in a flowing paragraph:

1. **SUBJECT** (15+ physical attributes - MUST match genre imagery):
   - For people: age, gender, build, skin tone, hair (color, length, style), facial features, expression, posture, clothing details (specific garments, colors, textures)
   - Clothing/style MUST match the music genre (country: denim, boots; K-pop: stylized fashion; hip-hop: streetwear)
   - Example: "A confident 25-year-old woman with long wavy dark brown hair, fair skin, wearing a cream oversized knit sweater and high-waisted light blue mom jeans"

2. **ACTION** (specific movements - MUST match genre energy):
   - Precise actions, gestures, timing, sequence
   - Micro-expressions, body language, interaction patterns
   - Match the genre's typical movement style (country: authentic moments; K-pop: choreographed; hip-hop: rhythmic)
   - Example: "lip-syncing to lyrics while slowly tilting head, making direct eye contact with camera, occasionally running fingers through hair"

3. **SCENE** (detailed environment - MUST match genre setting):
   - Location type, background elements, props visible
   - Architectural details, furniture, decorations
   - Time of day, weather if visible
   - Use genre-authentic settings (country: rural/outdoor; K-pop: modern/stylized; hip-hop: urban)
   - Example: "in a cozy minimalist bedroom with white walls, large window on the left letting in soft afternoon sunlight, small succulent plant on wooden nightstand"

4. **STYLE** (visual aesthetic - MUST match genre look):
   - Camera shot type (close-up, medium, wide)
   - Color palette, film grade matching genre mood
   - Depth of field, focus
   - Example: "warm vintage film aesthetic, soft color grading with lifted blacks, shallow depth of field with creamy bokeh"

5. **CAMERA** (movement - MUST match genre energy):
   - Specific camera techniques
   - Movement direction and speed matching genre pacing
   - Example: "slow push-in from medium to close-up shot, maintaining steady eye-level framing"

6. **AMBIANCE** (lighting - MUST match genre mood):
   - Lighting setup description
   - Light source direction and quality
   - Mood created by lighting matching genre essence
   - Example: "golden hour light through window creating warm soft shadows, natural three-point lighting effect"

7. **TECHNICAL** (negative prompt - what to avoid):
   - Elements to exclude for clean output
   - Example: "No watermarks, no text overlays, no harsh shadows, maintain smooth pacing"

Each idea MUST:
- Be AUTHENTIC to the artist's music genre
- Adapt trending formats while keeping genre aesthetics
- Include detailed VEO 3.1 prompt (300+ words) with ALL 7 components
- Every component MUST match the genre's aesthetic
- Never generate content that feels disconnected from the music style

Always respond in valid JSON format.`,

    templates: {
      generateIdeas: `ADAPT trending patterns to the artist's MUSIC GENRE - create 3-4 content ideas:

## 📋 CAMPAIGN CONTEXT (CENTRAL TO ALL PROMPTS):
{{campaignDescription}}

⚠️ IMPORTANT: This campaign description defines the core concept and goal. ALL content ideas MUST align with and support this campaign vision.

## 🎵 ARTIST'S MUSIC GENRE (PRIMARY VISUAL CONSTRAINT):
{{genre}}

⚠️ CRITICAL: All content MUST feel authentic to {{genre}} music. Visual style, mood, settings, and aesthetics must match this genre.

USER CONCEPT: {{userIdea}}

## 🔥 TRENDING FORMATS TO ADAPT (not copy blindly):
{{strategy}}

TARGET AUDIENCE: {{audience}}

CONTENT GOALS: {{goals}}

## 📊 TOP PERFORMERS (study format, NOT visual style):
{{benchmarks}}

ARTIST/BRAND: {{artistName}}
PLATFORM: {{platform}}
LANGUAGE: {{language}}

## GENRE-FIRST ADAPTATION PROCESS:
1. FILTER: Which trends can work for {{genre}} music? Skip incompatible ones.
2. ADAPT: Take the viral FORMAT (hook style, pacing) but change the AESTHETICS to match {{genre}}
3. TRANSFORM: Rural/authentic for country, urban/bold for hip-hop, polished/stylized for K-pop, etc.
4. VALIDATE: Would a {{genre}} music fan recognize this as authentic to their genre?

## GENRE-SPECIFIC VISUAL GUIDELINES:
- Country: Rural landscapes, warm sunlight, authentic moments, acoustic instruments, cowboy aesthetics
- K-pop: High production, stylized visuals, colorful, synchronized movements, modern urban settings
- Hip-hop: Urban environments, bold colors, street style, confident poses, gritty aesthetics
- Pop: Bright, energetic, mainstream appeal, relatable scenarios, polished but accessible
- Rock: Raw energy, concert vibes, guitars, darker tones, rebellious spirit
- EDM: Neon lights, club scenes, futuristic elements, high energy, visual effects
- R&B: Smooth, sensual, intimate settings, soft lighting, emotional depth
- Indie: Artistic, unconventional, authentic, vintage aesthetics, creative angles

## REQUIRED APPROACH:
- Each idea MUST feel authentic to {{genre}} - this is non-negotiable
- Adapt trending FORMATS (hooks, pacing, structure) to {{genre}} AESTHETICS
- VEO 3.1 prompts must describe visuals that match {{genre}} music videos
- If a trend doesn't fit {{genre}}, transform it or skip it entirely
- Music suggestions should align with {{genre}} (not the trend's genre)

## VEO 3.1 PROMPT FORMAT REQUIREMENTS:
Each optimizedPrompt MUST be a flowing paragraph (300+ words) that includes ALL 7 components adapted for {{genre}}:

1. **SUBJECT**: Describe a {{genre}}-appropriate character with 15+ physical attributes (age, gender, hair, skin, clothing matching {{genre}} style)
2. **ACTION**: Include {{genre}}-authentic movements with specific timing, gestures, expressions
3. **SCENE**: Use {{genre}}-authentic environment with detailed background elements and props
4. **STYLE**: Apply {{genre}}-matching visual aesthetic (camera shot type, color palette, depth of field)
5. **CAMERA**: Describe camera movement that matches {{genre}}'s energy level
6. **AMBIANCE**: Set {{genre}}-appropriate lighting that creates the right mood
7. **TECHNICAL**: Add negative prompts (no watermarks, maintain pacing appropriate for {{genre}})

## EXAMPLE VEO 3.1 PROMPT FORMAT FOR {{genre}}:
"A [age] [gender] with [hair description], [skin tone], wearing [{{genre}}-appropriate detailed clothing], [{{genre}}-style action] while [additional gestures], making [facial expression]. Set in [{{genre}}-authentic detailed setting], with [props] visible in the [background position]. [{{genre}}-appropriate visual style], with [color palette] dominating the palette, shallow depth of field with creamy bokeh. [Camera movement matching {{genre}} energy], maintaining [framing style]. [{{genre}}-appropriate lighting], creating [{{genre}} mood] atmosphere. No watermarks, no text overlays, maintain [pacing matching {{genre}}], high quality 9:16 vertical TikTok format."

For each idea provide:
- Title that fits {{genre}} music content
- Hook adapted from trending format but matching {{genre}} vibe
- Description explaining how this ADAPTS a trend FOR {{genre}}
- Engagement prediction based on genre-audience fit
- VEO 3.1 prompt (300+ words) with ALL 7 components, each matching {{genre}} style
- Music matching {{genre}} style (not the trend's music)
- Script outline that feels authentic to {{genre}}

Return JSON (IMPORTANT: bpm MUST be a number like 120, not a string):
{
  "ideas": [{
    "title": "title that fits {{genre}} (max 50 chars)",
    "hook": "hook adapted for {{genre}} audience (max 100 chars)",
    "description": "2-3 sentences explaining how this adapts a trending format for {{genre}} music",
    "estimatedEngagement": "high",
    "optimizedPrompt": "[FULL VEO 3.1 PROMPT - 300+ words]: A [{{genre}}-appropriate subject with 15+ physical attributes including age, gender, hair, skin tone, and {{genre}}-style clothing] [{{genre}}-authentic action with timing and expressions] in [{{genre}}-appropriate scene with detailed environment and props]. [{{genre}} visual style with matching color palette, camera shot type]. [Camera movement matching {{genre}} energy]. [{{genre}}-appropriate lighting creating {{genre}} mood atmosphere]. No watermarks, no text overlays, maintain {{genre}}-appropriate pacing, high quality 9:16 vertical format.",
    "suggestedMusic": { "bpm": 120, "genre": "{{genre}} or subgenre" },
    "scriptOutline": ["scene1: {{genre}}-style hook with trending format adaptation", "scene2: genre-authentic build up", "scene3: {{genre}}-appropriate climax"]
  }],
  "optimizedHashtags": ["hashtags for {{genre}} audience + trending format tags"],
  "contentStrategy": "how we're adapting trends to serve {{genre}} music fans authentically using Veo 3.1 7-component prompts"
}`,
    },
  },

  inputSchema: CreativeDirectorInputSchema,
  outputSchema: CreativeDirectorOutputSchema,
  dependencies: ['strategy-synthesizer'],
};

// Creative Director specific reflection config
const CREATIVE_DIRECTOR_REFLECTION_CONFIG: Partial<ReflectionConfig> = {
  maxIterations: 3,
  qualityThreshold: 0.75,  // Higher threshold for creative content
  evaluationAspects: ['creativity', 'relevance', 'quality', 'tone'],
  verbose: false,
};

/**
 * Creative Director Agent Implementation
 */
export class CreativeDirectorAgent extends BaseAgent<CreativeDirectorInput, CreativeDirectorOutput> {
  constructor() {
    super(CreativeDirectorConfig);
    // Set default reflection config for creative work
    this.setReflectionConfig(CREATIVE_DIRECTOR_REFLECTION_CONFIG);
  }

  protected buildPrompt(input: CreativeDirectorInput, context: AgentContext): string {
    const template = this.getTemplate('generateIdeas');

    // Genre is CRITICAL - it determines the visual style of all content
    const genre = context.workflow.genre || 'pop'; // Default to pop if not specified

    return this.fillTemplate(template, {
      campaignDescription: input.campaignDescription || 'General content campaign',  // Central context for all prompts
      genre: genre,  // PRIMARY VISUAL CONSTRAINT - must match the music style
      userIdea: input.userIdea || 'Create engaging content based on current trends',
      strategy: JSON.stringify(input.strategy || context.discover?.contentStrategy || {}, null, 2),
      audience: input.audience || 'Gen Z and Millennials',
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

  /**
   * Generate creative content ideas with reflection loop
   * Uses self-critique to improve creative quality
   */
  async generateIdeasWithReflection(
    userIdea: string | undefined,
    context: AgentContext,
    options?: {
      audience?: string;
      goals?: string[];
      strategy?: CreativeDirectorInput['strategy'];
      reflectionConfig?: Partial<ReflectionConfig>;
    }
  ): Promise<ReflectionResult<CreativeDirectorOutput>> {
    return this.executeWithReflection(
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
      context,
      options?.reflectionConfig
    );
  }

  /**
   * Stream creative content ideas generation
   */
  async *streamIdeas(
    userIdea: string | undefined,
    context: AgentContext,
    options?: {
      audience?: string;
      goals?: string[];
      strategy?: CreativeDirectorInput['strategy'];
    }
  ) {
    yield* this.executeStream(
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
