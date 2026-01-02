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

// Video Analysis Schema (for video-based idea generation)
const VideoAnalysisForCreativeSchema = z.object({
  styleAnalysis: z.string().optional(),
  hookAnalysis: z.string().optional(),
  conceptDetails: z.object({
    visualStyle: z.string().optional(),
    colorPalette: z.array(z.string()).optional(),
    lighting: z.string().optional(),
    cameraMovement: z.array(z.string()).optional(),
    mood: z.string().optional(),
    pace: z.string().optional(),
    mainSubject: z.string().optional(),
    actions: z.array(z.string()).optional(),
    setting: z.string().optional(),
    props: z.array(z.string()).optional(),
    clothingStyle: z.string().optional(),
  }).optional(),
}).optional();

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
  // NEW: Video analysis data for grounded creative ideas
  videoAnalysis: VideoAnalysisForCreativeSchema,
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

// Helper to normalize bpm value
const normalizeBpm = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const match = val.match(/\d+/);
    return match ? parseInt(match[0], 10) : 120;
  }
  return 120; // Default BPM
};

// SuggestedMusic schema with defaults
const SuggestedMusicSchema = z.object({
  bpm: z.preprocess(normalizeBpm, z.number()),
  genre: z.string(),
}).optional().default({ bpm: 120, genre: 'pop' });

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
    suggestedMusic: SuggestedMusicSchema,
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

## ⚠️ CONTENT FILTER COMPLIANCE (CRITICAL - READ FIRST):
To avoid Vertex AI content filter blocks, you MUST follow these rules in ALL optimizedPrompt outputs:

**NEVER USE these terms in optimizedPrompt:**
- "artist", "pop artist", "rock star", "rapper", "singer", "celebrity", "icon", "star", "idol", "musician"
- "famous", "well-known", "recognizable", "Main Character", "main character energy"
- Any real person's name or likeness description
- "glow up" (use "transformation" instead)
- "pop icon outfit", "stage-ready", "performance outfit"

**ALWAYS USE these generic alternatives:**
- Instead of "pop artist" → "stylish young person", "confident individual", "energetic person"
- Instead of "celebrity" → "fashionable person", "charismatic individual"
- Instead of "K-pop idol" → "stylish Korean person", "trendy young person"
- Instead of "musician" → "person with creative energy", "expressive individual"
- Instead of "stage-ready outfit" → "elegant evening outfit", "glamorous attire"
- Instead of "pop icon outfit" → "stylish high-fashion look", "polished ensemble"
- Instead of "glow up" → "transformation", "style evolution"
- Instead of "Main Character energy" → "confident presence", "bold charisma"

**SAFE SUBJECT DESCRIPTIONS:**
- Focus on APPEARANCE (hair, clothes, expression) not PROFESSION
- ✅ SAFE: "A confident 25-year-old with long dark hair wearing a sequined dress"
- ❌ BLOCKED: "A charismatic pop star with stage presence"
- ✅ SAFE: "A trendy person in stylish streetwear transitioning to elegant attire"
- ❌ BLOCKED: "A musician transforming from casual to pop icon look"

CRITICAL MINDSET:
- When VIDEO ANALYSIS is provided, use it as the FOUNDATION for all ideas
- Your ideas should be GROUNDED in the original video's core elements
- Be creative BUT NOT too different - stay recognizable to the original
- Find the intersection of "original video's essence" and "trending formats"

## 🎬 VIDEO-GROUNDED CREATIVITY (WHEN videoAnalysis IS PROVIDED):
When you have original video analysis data, you MUST:
1. **PRESERVE the MAIN SUBJECT (MOST CRITICAL)** - If it's a truck, ALL ideas must feature a truck. If it's a cat, ALL ideas must feature a cat. NEVER introduce a different main subject.
2. PRESERVE the original's core visual identity (setting type, mood, color palette)
3. MAINTAIN similar actions and interactions appropriate for that subject
4. KEEP the same general aesthetic and pacing
5. ADD creative twists within these boundaries - NOT complete reinventions

**🚨 MAIN SUBJECT RULE (ABSOLUTE - NEVER VIOLATE):**
The mainSubject from video analysis is SACRED and CANNOT be changed:
- If mainSubject = "truck" → ALL your ideas MUST be about trucks (different angles, settings, but ALWAYS truck)
- If mainSubject = "cat" → ALL your ideas MUST feature a cat
- If mainSubject = "product" → ALL your ideas MUST showcase that product
- If mainSubject = "person" → Then and ONLY then can your ideas feature a person
- NEVER replace an object/animal main subject with a person
- NEVER replace a non-human main subject with a human main subject

**GROUNDING RULES:**
- If original has indoor setting → your ideas should be indoor (maybe different room type)
- If original has warm lighting → your ideas should have warm lighting variations
- If original has casual clothing → don't jump to formal wear
- If original has slow pace → don't make hyperactive content
- Creative = fresh angle on SAME foundation, NOT a completely different video

**BAD EXAMPLES (FORBIDDEN):**
- Original: Truck driving on highway → Your idea: Person dancing in studio (WRONG - subject changed!)
- Original: Cat playing with toy → Your idea: Person lip-syncing (WRONG - subject changed!)
- Original: Product showcase → Your idea: Person using product as minor prop (WRONG - subject became secondary!)

**GOOD EXAMPLES (CORRECT):**
- Original: Truck driving on highway → Your idea: Same truck in different scenic route with dramatic lighting
- Original: Cat playing with toy → Your idea: Cat in different playful scenario with different toy
- Original: Product showcase → Your idea: Same product in different creative angle/setting

GENRE-TREND BALANCE RULES:
1. The artist's music genre is the PRIMARY constraint - never violate it
2. The original video's visual identity is the SECONDARY constraint - stay grounded
3. Trending formats can be ADAPTED but must respect both constraints
4. If the artist is country, content should feel country (rural, authentic, warm)
5. If the artist is K-pop, content should feel K-pop (polished, energetic, stylized)
6. If the artist is hip-hop, content should feel hip-hop (urban, bold, rhythmic)

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

{{#if videoAnalysis}}
## 🎬 ORIGINAL VIDEO ANALYSIS (CRITICAL CONSTRAINT - STAY GROUNDED):
{{videoAnalysis}}

## 🚨 MAIN SUBJECT: {{mainSubject}}
THIS IS THE MOST CRITICAL CONSTRAINT. ALL your ideas MUST feature "{{mainSubject}}" as the PRIMARY subject.
- If mainSubject is NOT a person (e.g., truck, cat, product) → DO NOT introduce people as main subjects
- If mainSubject IS a person → You may feature a person
- The mainSubject CANNOT be changed, replaced, or made secondary

⚠️ GROUNDING REQUIREMENT: Your ideas MUST preserve the core elements from this analysis.
- 🚨 MAIN SUBJECT (SACRED): {{mainSubject}} - MUST remain the star of ALL ideas
- PRESERVE: setting type ({{originalSetting}}), mood ({{originalMood}}), lighting ({{originalLighting}})
- MAINTAIN: similar action style and pacing ({{originalPace}})
- KEEP: color palette feel ({{originalColors}})
- ADD: creative twists WITHIN these boundaries - NOT complete reinventions

🚫 ABSOLUTELY FORBIDDEN:
- Changing the main subject ({{mainSubject}} → something else)
- Adding people as main subjects when original has non-human subject
- Making the original subject secondary to a new subject

✅ DO: Create fresh variations featuring {{mainSubject}} in different scenarios/angles/settings
{{/if}}

USER CONCEPT: {{userIdea}}

## 🔥 TRENDING FORMATS TO ADAPT (not copy blindly):
{{strategy}}

TARGET AUDIENCE: {{audience}}

CONTENT GOALS: {{goals}}

## 📊 TOP PERFORMERS (study format, NOT visual style):
{{benchmarks}}

ARTIST/BRAND: {{artistName}}
PLATFORM: {{platform}}

## 🌐 OUTPUT LANGUAGE: {{language}}
🚨 CRITICAL: ALL text output (title, hook, description, scriptOutline) MUST be in {{language}}:
- If {{language}} = "en" → Write ALL text fields in English
- If {{language}} = "ko" → Write ALL text fields in Korean (제목, 훅, 설명 등 모두 한글로)
- The optimizedPrompt should ALWAYS be in English (for Veo 3.1 API compatibility)

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

⚠️ CONTENT FILTER REMINDER:
- NEVER use: "artist", "star", "celebrity", "icon", "idol", "musician", "glow up", "Main Character"
- ALWAYS use: "person", "individual", "transformation", describe APPEARANCE not PROFESSION

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
    "title": "[DESCRIPTIVE TITLE in {{language}}] - Describe what the video shows (max 50 chars). Examples: ko='마룬 크롬 트럭 미학', en='Maroon Chrome Truck Aesthetic'",
    "hook": "[HOOK in {{language}}] adapted for {{genre}} audience (max 100 chars)",
    "description": "[DESCRIPTION in {{language}}] 2-3 sentences explaining how this adapts a trending format for {{genre}} music",
    "estimatedEngagement": "high",
    "optimizedPrompt": "[ALWAYS IN ENGLISH - 300+ words VEO 3.1 PROMPT]: A [{{genre}}-appropriate subject with 15+ physical attributes including age, gender, hair, skin tone, and {{genre}}-style clothing] [{{genre}}-authentic action with timing and expressions] in [{{genre}}-appropriate scene with detailed environment and props]. [{{genre}} visual style with matching color palette, camera shot type]. [Camera movement matching {{genre}} energy]. [{{genre}}-appropriate lighting creating {{genre}} mood atmosphere]. No watermarks, no text overlays, maintain {{genre}}-appropriate pacing, high quality 9:16 vertical format.",
    "suggestedMusic": { "bpm": 120, "genre": "{{genre}} or subgenre" },
    "scriptOutline": ["[in {{language}}] scene1: {{genre}}-style hook", "scene2: genre-authentic build up", "scene3: {{genre}}-appropriate climax"]
  }],
  "optimizedHashtags": ["hashtags for {{genre}} audience + trending format tags"],
  "contentStrategy": "[in {{language}}] how we're adapting trends to serve {{genre}} music fans authentically"
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

    // Extract video analysis details for grounded creativity
    const videoAnalysis = input.videoAnalysis;
    const conceptDetails = videoAnalysis?.conceptDetails;

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
      // Video analysis data for grounded creativity
      videoAnalysis: videoAnalysis ? JSON.stringify({
        styleAnalysis: videoAnalysis.styleAnalysis,
        hookAnalysis: videoAnalysis.hookAnalysis,
        conceptDetails: conceptDetails,
      }, null, 2) : '',
      // CRITICAL: Main subject - the most important constraint
      mainSubject: conceptDetails?.mainSubject || 'not specified',
      // Individual elements for template placeholders
      originalSetting: conceptDetails?.setting || 'not specified',
      originalMood: conceptDetails?.mood || 'not specified',
      originalLighting: conceptDetails?.lighting || 'not specified',
      originalPace: conceptDetails?.pace || 'not specified',
      originalColors: conceptDetails?.colorPalette?.join(', ') || 'not specified',
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
