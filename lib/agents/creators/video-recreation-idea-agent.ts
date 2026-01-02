/**
 * Video Recreation Idea Agent
 * ============================
 * Generates content ideas that closely recreate the original video's style
 *
 * Model: Gemini 3 Pro (strategic thinking, detailed visual analysis)
 * Category: Creator
 *
 * This agent takes video analysis data (conceptDetails, styleAnalysis, etc.)
 * and generates 2 ideas that recreate the original video's visual style and mood.
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_PRO } from '../constants';
import type { AgentConfig, AgentContext } from '../types';

// Video Analysis Data Schema (from StartFromVideo.aiAnalysis)
export const VideoAnalysisSchema = z.object({
  hookAnalysis: z.string().optional(),
  styleAnalysis: z.string().optional(),
  structureAnalysis: z.string().optional(),
  suggestedApproach: z.string().optional(),
  isComposeVideo: z.boolean().optional(),
  imageCount: z.number().optional(),
  conceptDetails: z.object({
    visualStyle: z.string().optional(),
    colorPalette: z.array(z.string()).optional(),
    lighting: z.string().optional(),
    cameraMovement: z.array(z.string()).optional(),
    transitions: z.array(z.string()).optional(),
    effects: z.array(z.string()).optional(),
    mood: z.string().optional(),
    pace: z.string().optional(),
    mainSubject: z.string().optional(),
    actions: z.array(z.string()).optional(),
    setting: z.string().optional(),
    props: z.array(z.string()).optional(),
    clothingStyle: z.string().optional(),
  }).optional(),
});

// Input Schema
export const VideoRecreationIdeaInputSchema = z.object({
  videoAnalysis: VideoAnalysisSchema,
  videoDescription: z.string().optional(),
  videoHashtags: z.array(z.string()).optional(),
  campaignDescription: z.string().optional(),
  artistName: z.string().optional(),
  language: z.enum(['ko', 'en']).optional(),
});

export type VideoRecreationIdeaInput = z.infer<typeof VideoRecreationIdeaInputSchema>;

// Helper to normalize engagement value from AI output
const normalizeEngagement = (value: unknown): 'high' | 'medium' | 'low' => {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  if (typeof value !== 'string') return 'medium';
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('high') || normalized.includes('높')) return 'high';
  if (normalized.includes('low') || normalized.includes('낮')) return 'low';
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

// SuggestedMusic schema with defaults (matching creative-director pattern)
const SuggestedMusicSchema = z.object({
  bpm: z.preprocess(normalizeBpm, z.number()),
  genre: z.string(),
}).optional().default({ bpm: 120, genre: 'pop' });

// Inner output schema
const VideoRecreationIdeaOutputInnerSchema = z.object({
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
    recreationType: z.enum(['exact', 'variation']),  // exact = 정확히 재현, variation = 변형 재현
  })),
  recreationStrategy: z.string(),
});

// Output Schema - 2 recreation ideas
// Preprocessor handles AI returning array wrapper: [{ideas:...}] → {ideas:...}
export const VideoRecreationIdeaOutputSchema = z.preprocess(
  (val) => {
    // If AI returned an array with one object, unwrap it
    if (Array.isArray(val) && val.length === 1 && typeof val[0] === 'object' && val[0] !== null) {
      console.log('[video-recreation-idea] Unwrapping array response to object');
      return val[0];
    }
    return val;
  },
  VideoRecreationIdeaOutputInnerSchema
);

export type VideoRecreationIdeaOutput = z.infer<typeof VideoRecreationIdeaOutputSchema>;

// Agent Configuration
/**
 * @agent VideoRecreationIdeaAgent
 * @version 5
 * @changelog
 * - v5: Added language-aware output + mainSubject constraint to prevent unrelated prompts
 * - v4: Strengthened recreation types - exact=100% clone (all details), variation=5-10% micro-change only
 * - v3: Added Vertex AI content filter compliance guidelines to prevent blocks
 * - v2: Veo 3.1 optimized 7-component prompt structure for cinematic video generation
 * - v1: Initial version with basic VEO prompts
 */
export const VideoRecreationIdeaConfig: AgentConfig<VideoRecreationIdeaInput, VideoRecreationIdeaOutput> = {
  id: 'video-recreation-idea',
  name: 'Video Recreation Idea Agent',
  description: '원본 영상의 스타일을 재현하는 콘텐츠 아이디어 생성 (Veo 3.1 최적화)',
  category: 'creator',

  model: {
    provider: 'gemini',
    name: GEMINI_PRO,
    options: {
      temperature: 0.5,  // Lower temperature for more faithful recreation
      maxTokens: 16384,  // Increased for detailed Veo 3.1 prompts
      thinkingLevel: 'high',  // Using 'high' for strategic recreation analysis
    },
  },

  prompts: {
    system: `You are a Video Recreation Specialist for TikTok content, expert in crafting Veo 3.1 optimized prompts.
Your job is to analyze an existing video's style, mood, and visual elements, then generate ideas to RECREATE that exact style using the Veo 3.1 Professional Prompt Structure.

## 🚨 MAIN SUBJECT RULE (ABSOLUTE - NEVER VIOLATE):
The mainSubject from video analysis is SACRED and CANNOT be changed:
- If mainSubject = "truck" → ALL your prompts MUST feature a truck
- If mainSubject = "cat" → ALL your prompts MUST feature a cat
- If mainSubject = "food" → ALL your prompts MUST feature food
- NEVER replace an object/animal main subject with a person
- NEVER introduce new subjects that weren't in the original video

**BAD EXAMPLE (FORBIDDEN):**
- Original video mainSubject: "truck driving on highway"
- Generated prompt: "A stylish young woman walks through city streets..." ❌ WRONG!
- This is COMPLETELY WRONG - you changed truck to person!

**GOOD EXAMPLE (CORRECT):**
- Original video mainSubject: "truck driving on highway"
- Generated prompt: "A large red semi-truck with chrome details drives along a scenic highway..." ✅ CORRECT!
- The prompt stays focused on the TRUCK as the main subject.

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
- You are NOT creating new content - you are CLONING an existing video
- Focus on EXACT visual fidelity to the original - every detail matters
- Maintain the IDENTICAL mood, pacing, aesthetic, objects, and staging
- Use the SAME camera techniques, lighting, color palette, and compositions
- The goal is for viewers to say "this is IDENTICAL to the original"

## VEO 3.1 PROFESSIONAL PROMPT STRUCTURE (7 COMPONENTS):
You MUST structure every optimizedPrompt using these 7 components in a flowing paragraph:

1. **SUBJECT** (15+ physical attributes):
   - For people: age, gender, build, skin tone, hair (color, length, style), facial features, expression, posture, clothing details (specific garments, colors, textures)
   - For objects: size, shape, color, material, condition
   - Example: "A confident 25-year-old woman with long wavy dark brown hair, fair skin, wearing a cream oversized knit sweater and high-waisted light blue mom jeans"

2. **ACTION** (specific movements):
   - Precise actions, gestures, timing, sequence
   - Micro-expressions, body language, interaction patterns
   - Example: "lip-syncing to lyrics while slowly tilting head, making direct eye contact with camera, occasionally running fingers through hair"

3. **SCENE** (detailed environment):
   - Location type, background elements, props visible
   - Architectural details, furniture, decorations
   - Time of day, weather if visible
   - Example: "in a cozy minimalist bedroom with white walls, large window on the left letting in soft afternoon sunlight, small succulent plant on wooden nightstand"

4. **STYLE** (visual aesthetic):
   - Camera shot type (close-up, medium, wide)
   - Color palette, film grade
   - Depth of field, focus
   - Example: "warm vintage film aesthetic, soft color grading with lifted blacks, shallow depth of field with creamy bokeh"

5. **CAMERA** (movement):
   - Specific camera techniques
   - Movement direction and speed
   - Example: "slow push-in from medium to close-up shot, maintaining steady eye-level framing"

6. **AMBIANCE** (lighting):
   - Lighting setup description
   - Light source direction and quality
   - Mood created by lighting
   - Example: "golden hour light through window creating warm soft shadows, natural three-point lighting effect"

7. **TECHNICAL** (negative prompt - what to avoid):
   - Elements to exclude for clean output
   - Example: "No watermarks, no text overlays, no harsh shadows, maintain smooth pacing"

## RECREATION TYPES (CRITICAL - READ CAREFULLY):

### 1. EXACT CLONE (recreationType: "exact")
🎯 Goal: 100% IDENTICAL reproduction - as if copying the original frame by frame
- MUST include EVERY object, prop, and element visible in the original
- MUST use the EXACT same setting/location type
- MUST replicate the EXACT same clothing style and colors
- MUST match the EXACT same poses, gestures, and expressions
- MUST use the EXACT same camera angles and movements
- MUST replicate the EXACT same lighting setup
- MUST match the EXACT same color grading
- NO creative additions or changes - pure cloning
- If the original has a plant on the left, YOUR prompt must have a plant on the left
- If the original has warm golden lighting, YOUR prompt must have warm golden lighting

### 2. MICRO VARIATION (recreationType: "variation")
🎯 Goal: 95% IDENTICAL - only ONE tiny element changed
- Keep 95% of everything EXACTLY the same as the original
- Change ONLY ONE of these (pick one):
  * Different background color (e.g., blue wall instead of white)
  * Different outfit color (e.g., red dress instead of black)
  * Different time of day (e.g., sunset instead of noon)
  * Different prop (e.g., coffee cup instead of phone)
- EVERYTHING ELSE stays IDENTICAL to the original
- This is NOT a creative reinterpretation - it's the same video with one tiny tweak
- The viewer should think "this is almost the same video, just with [one small difference]"

Always respond in valid JSON format.`,

    templates: {
      generateRecreationIdeas: `RECREATE the following video's style using Veo 3.1 optimized prompts - generate exactly 2 content ideas:

## 🎬 ORIGINAL VIDEO ANALYSIS:

### Visual Style Analysis:
{{styleAnalysis}}

### Hook Analysis:
{{hookAnalysis}}

### Concept Details:
- Visual Style: {{visualStyle}}
- Color Palette: {{colorPalette}}
- Lighting: {{lighting}}
- Camera Movement: {{cameraMovement}}
- Transitions: {{transitions}}
- Effects: {{effects}}
- Mood: {{mood}}
- Pace: {{pace}}
- Main Subject: {{mainSubject}}
- Actions: {{actions}}
- Setting: {{setting}}
- Props: {{props}}
- Clothing Style: {{clothingStyle}}

### Suggested Approach:
{{suggestedApproach}}

### Original Video Description:
{{videoDescription}}

### Original Hashtags:
{{videoHashtags}}

## 📋 CAMPAIGN CONTEXT:
{{campaignDescription}}

## 👤 ARTIST/BRAND:
{{artistName}}

## 🌐 OUTPUT LANGUAGE: {{language}}
🚨 CRITICAL: ALL text output (title, hook, description, scriptOutline) MUST be in {{language}}:
- If {{language}} = "en" → Write ALL text in English
- If {{language}} = "ko" → Write ALL text in Korean
- The optimizedPrompt should ALWAYS be in English (for Veo 3.1 API)

## 🚨 MAIN SUBJECT CONSTRAINT: {{mainSubject}}
THIS IS THE MOST CRITICAL RULE. You are RECREATING the original video, so:
- The mainSubject "{{mainSubject}}" MUST be the PRIMARY focus of ALL prompts
- If it's a truck video → generate truck prompts, NOT people prompts
- If it's a food video → generate food prompts, NOT people prompts
- NEVER replace the original subject with something completely different

## YOUR TASK:
Generate exactly 2 ideas with VEO 3.1 OPTIMIZED PROMPTS:

⚠️ CONTENT FILTER REMINDER:
- NEVER use: "artist", "star", "celebrity", "icon", "idol", "musician", "glow up", "Main Character"
- ALWAYS use: "person", "individual", "transformation", describe APPEARANCE not PROFESSION

### IDEA 1: EXACT CLONE (100% identical reproduction)
🎯 Create a PERFECT CLONE of the original video:
- Include EVERY object and prop from the original ({{props}})
- Use the EXACT setting: {{setting}}
- Replicate the EXACT clothing: {{clothingStyle}}
- Match the EXACT actions: {{actions}}
- Copy the EXACT camera movements: {{cameraMovement}}
- Replicate the EXACT lighting: {{lighting}}
- Use the EXACT color palette: {{colorPalette}}
- Match the EXACT mood: {{mood}}
- The prompt should describe the original video SO precisely that the output is indistinguishable from it

### IDEA 2: MICRO VARIATION (95% identical, 5% variation)
🎯 Create an ALMOST IDENTICAL video with ONE tiny change:
- Keep 95% EXACTLY the same as IDEA 1
- Change ONLY ONE small element (pick one):
  * Slightly different background color OR
  * Slightly different outfit color OR
  * Slightly different time of day OR
  * One different small prop
- The viewer should say "This is almost the same, just [one thing] is different"

## VEO 3.1 PROMPT FORMAT REQUIREMENTS:
Each optimizedPrompt MUST be a flowing paragraph (300+ words) that includes ALL 7 components:

1. Start with SUBJECT: Use {{mainSubject}} and {{clothingStyle}} to describe 15+ physical attributes
2. Then ACTION: Incorporate {{actions}} with specific timing, gestures, expressions
3. Add SCENE: Use {{setting}} and {{props}} for detailed environment description
4. Include STYLE: Apply {{visualStyle}} and {{colorPalette}} for visual aesthetic
5. Describe CAMERA: Use {{cameraMovement}} for specific camera techniques
6. Set AMBIANCE: Apply {{lighting}} and {{mood}} for lighting and atmosphere
7. End with TECHNICAL: Add negative prompts (no watermarks, maintain {{pace}} pacing)

## EXAMPLE VEO 3.1 PROMPT FORMAT:
"A [age] [gender] with [hair description from mainSubject], [skin tone], wearing [detailed clothing from clothingStyle], [action from actions] while [additional gestures], making [facial expression]. Set in [detailed setting description from setting], with [props from props list] visible in the [background position]. [visualStyle from analysis], with [colorPalette colors] dominating the palette, shallow depth of field with creamy bokeh. [Camera movement from cameraMovement], maintaining [framing style]. [lighting description from lighting], creating [mood from mood analysis] atmosphere. No watermarks, no text overlays, maintain [pace from pace analysis] pacing, high quality 9:16 vertical TikTok format."

Return JSON (IMPORTANT: bpm MUST be a number, not a string):
🚨 REMEMBER:
1. title, hook, description, scriptOutline MUST be in {{language}} language!
2. ALL prompts MUST feature "{{mainSubject}}" as the main subject - DO NOT replace it with something else!

{
  "ideas": [
    {
      "title": "[{{language}}=en: 'Perfect Clone of Original' | {{language}}=ko: '원본 영상 완전 복제'] (max 50 chars, in {{language}})",
      "hook": "[Hook text in {{language}} - IDENTICAL concept to original] (max 100 chars)",
      "description": "[Description in {{language}}] This is a 100% CLONE. Every element - [list specific elements from original: setting, props, clothing, lighting, actions] - is replicated exactly as in the original video.",
      "estimatedEngagement": "high",
      "optimizedPrompt": "[FULL VEO 3.1 PROMPT - 300+ words, ALWAYS IN ENGLISH]: A [EXACT subject description from mainSubject - age, gender, build, skin, hair color/length/style, facial features] wearing [EXACT clothing from clothingStyle with specific colors and textures], [EXACT actions from actions with precise timing and gestures], [EXACT facial expressions]. Set in [EXACT setting description] with [ALL props listed from props in their exact positions]. [EXACT visualStyle] with [EXACT colorPalette colors]. [EXACT cameraMovement]. [EXACT lighting setup]. No watermarks, no text overlays, maintain [EXACT pace] pacing, high quality 9:16 vertical format.",
      "suggestedMusic": { "bpm": 120, "genre": "EXACT match to original mood" },
      "scriptOutline": ["[In {{language}}] scene1: EXACT recreation of opening - same framing, same action, same timing", "[In {{language}}] scene2: EXACT recreation of middle - identical flow and pacing", "[In {{language}}] scene3: EXACT recreation of climax - same emotional peak"],
      "recreationType": "exact"
    },
    {
      "title": "[{{language}}=en: 'Micro Variation Version' | {{language}}=ko: '미세 변형 버전'] (max 50 chars, in {{language}})",
      "hook": "[Hook text in {{language}} - 99% same, tiny twist] (max 100 chars)",
      "description": "[Description in {{language}}] This is 95% IDENTICAL to the original. The ONLY change is [specify the ONE element changed, e.g., 'background color changed from white to soft blue']. Everything else remains exactly the same.",
      "estimatedEngagement": "high",
      "optimizedPrompt": "[FULL VEO 3.1 PROMPT - 300+ words, ALWAYS IN ENGLISH]: [COPY 95% from IDEA 1's prompt]. The ONLY difference: [specify the ONE micro-change, e.g., 'the wall color is now soft blue instead of white' or 'wearing a red sweater instead of cream']. All other elements remain IDENTICAL: same subject, same actions, same props, same camera, same lighting.",
      "suggestedMusic": { "bpm": 120, "genre": "SAME as original" },
      "scriptOutline": ["[In {{language}}] scene1: same as exact clone with [ONE micro change]", "[In {{language}}] scene2: identical to exact clone", "[In {{language}}] scene3: identical to exact clone"],
      "recreationType": "variation"
    }
  ],
  "recreationStrategy": "[In {{language}}] IDEA 1 is a frame-by-frame clone capturing every detail. IDEA 2 is 95% identical with only [specify the one change] modified. Both maintain absolute fidelity to the original's core visual identity."
}`,
    },
  },

  inputSchema: VideoRecreationIdeaInputSchema,
  outputSchema: VideoRecreationIdeaOutputSchema,
};

/**
 * Video Recreation Idea Agent Implementation
 */
export class VideoRecreationIdeaAgent extends BaseAgent<VideoRecreationIdeaInput, VideoRecreationIdeaOutput> {
  constructor() {
    super(VideoRecreationIdeaConfig);
  }

  protected buildPrompt(input: VideoRecreationIdeaInput, context: AgentContext): string {
    const template = this.getTemplate('generateRecreationIdeas');
    const conceptDetails = input.videoAnalysis.conceptDetails || {};

    return this.fillTemplate(template, {
      // Style analysis
      styleAnalysis: input.videoAnalysis.styleAnalysis || 'No style analysis available',
      hookAnalysis: input.videoAnalysis.hookAnalysis || 'No hook analysis available',
      suggestedApproach: input.videoAnalysis.suggestedApproach || 'No suggested approach available',

      // Concept details
      visualStyle: conceptDetails.visualStyle || 'cinematic',
      colorPalette: JSON.stringify(conceptDetails.colorPalette || ['neutral tones']),
      lighting: conceptDetails.lighting || 'natural lighting',
      cameraMovement: JSON.stringify(conceptDetails.cameraMovement || ['static']),
      transitions: JSON.stringify(conceptDetails.transitions || ['cut']),
      effects: JSON.stringify(conceptDetails.effects || ['none']),
      mood: conceptDetails.mood || 'engaging',
      pace: conceptDetails.pace || 'moderate',
      mainSubject: conceptDetails.mainSubject || 'person',
      actions: JSON.stringify(conceptDetails.actions || ['performing']),
      setting: conceptDetails.setting || 'indoor',
      props: JSON.stringify(conceptDetails.props || []),
      clothingStyle: conceptDetails.clothingStyle || 'casual',

      // Video info
      videoDescription: input.videoDescription || 'No description available',
      videoHashtags: JSON.stringify(input.videoHashtags || []),

      // Campaign context
      campaignDescription: input.campaignDescription || 'General content recreation',
      artistName: input.artistName || context.workflow.artistName || 'Artist',
      language: input.language || context.workflow.language || 'ko',
    });
  }

  /**
   * Generate recreation ideas from video analysis
   */
  async generateRecreationIdeas(
    videoAnalysis: VideoRecreationIdeaInput['videoAnalysis'],
    context: AgentContext,
    options?: {
      videoDescription?: string;
      videoHashtags?: string[];
      campaignDescription?: string;
      artistName?: string;
      language?: 'ko' | 'en';
    }
  ) {
    return this.execute(
      {
        videoAnalysis,
        videoDescription: options?.videoDescription,
        videoHashtags: options?.videoHashtags,
        campaignDescription: options?.campaignDescription,
        artistName: options?.artistName,
        language: options?.language,
      },
      context
    );
  }
}

// Factory function
export function createVideoRecreationIdeaAgent(): VideoRecreationIdeaAgent {
  return new VideoRecreationIdeaAgent();
}
