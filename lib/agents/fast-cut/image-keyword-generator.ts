/**
 * Fast Cut Image Keyword Generator Agent
 * =======================================
 * Generates Google Image Search optimized keywords based on vibe and prompt
 *
 * Model: Gemini 2.5 Flash
 * Category: Fast Cut
 *
 * This agent specializes in extracting concrete visual subjects from
 * user prompts and converting them into searchable image keywords.
 *
 * @agent ImageKeywordGeneratorAgent
 * @version 2
 * @changelog
 * - v2: Major prompt rewrite - scene-based content extraction
 *       - Added forbidden keywords list (no more "cinematic HD", "video clips")
 *       - Focus on extracting actual visual subjects from user prompt
 *       - Vibe now used only as lighting/color modifier, not primary keyword source
 *       - Simplified buildPrompt method, removed unused template variables
 * - v1: Initial version - vibe-based keyword generation
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Vibe type
const VALID_VIBES = ['Exciting', 'Emotional', 'Pop', 'Minimal'] as const;
type VibeType = typeof VALID_VIBES[number];

// Input Schema
export const ImageKeywordGeneratorInputSchema = z.object({
  vibe: z.enum(VALID_VIBES),
  userPrompt: z.string(),
  artistName: z.string().optional(),
  scriptLines: z.array(z.string()).optional(),
  language: z.enum(['ko', 'en']).default('ko'),
});

export type ImageKeywordGeneratorInput = z.infer<typeof ImageKeywordGeneratorInputSchema>;

// Output Schema
export const ImageKeywordGeneratorOutputSchema = z.object({
  searchKeywords: z.array(z.string()),
  keywordCategories: z.object({
    subject: z.array(z.string()),
    scene: z.array(z.string()),
    moodVisual: z.array(z.string()),
    style: z.array(z.string()),
  }),
  reasoning: z.string(),
});

export type ImageKeywordGeneratorOutput = z.infer<typeof ImageKeywordGeneratorOutputSchema>;

// Vibe to Visual Mapping (used in prompt)
const VIBE_VISUAL_MAPPING: Record<VibeType, {
  lighting: string[];
  scene: string[];
  mood: string[];
  colors: string[];
}> = {
  Exciting: {
    lighting: ['neon lights', 'strobe lights', 'colorful stage lights', 'laser show'],
    scene: ['concert crowd', 'festival stage', 'dance floor', 'stadium arena'],
    mood: ['dynamic motion blur', 'high energy', 'vibrant explosion', 'action shot'],
    colors: ['neon pink blue', 'rainbow colors', 'electric purple', 'vivid saturated'],
  },
  Emotional: {
    lighting: ['golden hour', 'soft window light', 'candlelight', 'sunset glow'],
    scene: ['empty road', 'rain on window', 'autumn leaves', 'ocean waves'],
    mood: ['nostalgic film grain', 'soft focus bokeh', 'melancholic', 'dreamy haze'],
    colors: ['warm orange tones', 'muted earth colors', 'soft pastels', 'sepia vintage'],
  },
  Pop: {
    lighting: ['bright studio light', 'ring light', 'even lighting', 'commercial lighting'],
    scene: ['urban street', 'colorful wall', 'trendy cafe', 'rooftop city'],
    mood: ['clean aesthetic', 'instagram style', 'modern trendy', 'fresh vibrant'],
    colors: ['bright primary colors', 'pastel pop', 'candy colors', 'clean white'],
  },
  Minimal: {
    lighting: ['natural soft light', 'high key lighting', 'diffused light', 'shadow play'],
    scene: ['white background', 'simple interior', 'negative space', 'geometric shapes'],
    mood: ['clean lines', 'zen calm', 'sophisticated', 'elegant simple'],
    colors: ['monochrome', 'black white', 'neutral tones', 'subtle gradient'],
  },
};

// Agent Configuration
export const ImageKeywordGeneratorConfig: AgentConfig<ImageKeywordGeneratorInput, ImageKeywordGeneratorOutput> = {
  id: 'fast-cut-image-keyword-generator',
  name: 'Image Keyword Generator',
  description: 'Google 이미지 검색 최적화 키워드 생성',
  category: 'transformer',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.6,
      maxTokens: 2048,
    },
  },

  prompts: {
    system: `You are an expert at generating Google Image Search keywords for video production.

Your job is to EXTRACT CONCRETE VISUAL SUBJECTS from user prompts and convert them into SEARCHABLE image keywords.

## 🚨 CRITICAL: SCENE-BASED EXTRACTION

The user's prompt often describes specific scenes or visual concepts. You MUST:
1. Parse the prompt to identify each scene/shot description
2. Extract the MAIN VISUAL SUBJECT of each scene (objects, places, people, nature, etc.)
3. Generate keywords that will find EXACTLY that subject on Google Image Search

## ❌ FORBIDDEN KEYWORDS (These are useless for search):
- "generate video", "create content", "make video", "video clips"
- "dynamic cinematic", "HD video", "4K footage", "professional video"
- "aesthetic visuals", "engaging content", "viral video"
- Any keyword describing VIDEO CREATION process rather than VISUAL SUBJECTS

## ✅ GOOD KEYWORDS (These find actual images):
- "woman walking forest path" (specific subject + location)
- "rose petals falling closeup" (specific object + action)
- "neon city street night rain" (specific place + atmosphere)
- "coffee cup steam morning light" (specific object + mood)
- "mountains sunset golden hour" (specific landscape)

## KEYWORD FORMAT RULES:

1. SPECIFICITY: Be specific about WHAT to search for
   - ❌ BAD: "beautiful scene", "aesthetic moment", "dynamic shot"
   - ✅ GOOD: "cherry blossom petals wind", "skyscraper sunset reflection"

2. FORMAT: 2-4 descriptive words focusing on the SUBJECT
   - ❌ BAD: "city" (too vague)
   - ❌ BAD: "a beautiful sunset on the peaceful beach with waves" (too long)
   - ✅ GOOD: "sunset beach golden waves"

3. QUALITY MODIFIERS: Add ONE quality word at the end if needed
   - "forest path morning photography"
   - "city skyline night 4K"
   - NOT: "4K HD cinematic professional aesthetic video footage"

## OUTPUT REQUIREMENTS:
- Generate 8-12 keywords based on ACTUAL CONTENT described in the user's prompt
- Each keyword must be searchable on Google Images and return relevant results
- Keywords should represent different visual subjects/scenes described in the prompt
- Vibe modifiers (lighting, atmosphere) should COMPLEMENT the subject, not replace it

Always respond in valid JSON format.`,

    templates: {
      generate: `Generate Google Image Search keywords based on the ACTUAL CONTENT described in the user's prompt.

## INPUT
USER PROMPT: {{userPrompt}}
{{scriptSection}}
VIBE: {{vibe}} (use this for atmosphere/lighting modifiers only)
LANGUAGE: {{language}}

## 🚨 STEP 1: ANALYZE THE PROMPT

First, identify the VISUAL SUBJECTS mentioned in the user prompt:
- What objects, people, places, or scenes are described?
- What actions or states are shown?
- What specific details are mentioned?

Example Analysis:
- Prompt: "Create a video showing a girl walking through cherry blossoms, then coffee being poured, ending with city lights at night"
- Visual Subjects: 1) woman in cherry blossom garden, 2) coffee pouring into cup, 3) city skyline night lights

## 🚨 STEP 2: GENERATE SEARCHABLE KEYWORDS

For EACH visual subject identified, create a 2-4 word search keyword:

❌ DO NOT generate:
- "create video", "cinematic footage", "dynamic visuals", "HD content"
- Generic vibe words without subjects: "exciting energy", "emotional moment"

✅ GENERATE keywords like:
- "cherry blossom petals falling" (subject from prompt)
- "coffee pour cream swirl" (action from prompt)
- "city skyline night lights" (scene from prompt)

## VIBE "{{vibe}}" MODIFIERS (Use sparingly)
Add these as OPTIONAL modifiers to complement subjects:
- Lighting: {{vibeMapping.lighting}}
- Colors: {{vibeMapping.colors}}

Example: "cherry blossom" + "soft light" → "cherry blossom soft light photography"

## OUTPUT REQUIREMENTS

Generate 8-12 keywords:
- **subject** (3-4): Main objects/people/places from the prompt
- **scene** (2-3): Backgrounds/locations mentioned or implied
- **moodVisual** (2-3): Atmospheric visuals that match the content
- **style** (1-2): Photography style (keep minimal)

## OUTPUT JSON (ALL FIELDS ARE REQUIRED)

{
  "reasoning": "List the visual subjects you identified from the prompt and how you converted them to keywords",
  "searchKeywords": [
    "keyword based on prompt content 1",
    "keyword based on prompt content 2",
    "... 8-12 total keywords"
  ],
  "keywordCategories": {
    "subject": ["main subject from prompt", "secondary subject"],
    "scene": ["location mentioned", "background implied"],
    "moodVisual": ["atmospheric visual matching content"],
    "style": ["one photography style keyword"]
  }
}

IMPORTANT: The "reasoning" field MUST be included and explain your keyword selection strategy.`,
    },
  },

  inputSchema: ImageKeywordGeneratorInputSchema,
  outputSchema: ImageKeywordGeneratorOutputSchema,
};

/**
 * Image Keyword Generator Agent Implementation
 */
export class ImageKeywordGeneratorAgent extends BaseAgent<ImageKeywordGeneratorInput, ImageKeywordGeneratorOutput> {
  constructor() {
    super(ImageKeywordGeneratorConfig);
  }

  protected buildPrompt(input: ImageKeywordGeneratorInput, context: AgentContext): string {
    const template = this.getTemplate('generate');
    const vibe = input.vibe as VibeType;
    const vibeMapping = VIBE_VISUAL_MAPPING[vibe];

    // Build script section - these lines provide additional context for keyword extraction
    let scriptSection = '';
    if (input.scriptLines && input.scriptLines.length > 0) {
      scriptSection = `\nSCRIPT LINES (additional visual context):\n${input.scriptLines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`;
    }

    return this.fillTemplate(template, {
      vibe: input.vibe,
      userPrompt: input.userPrompt,
      scriptSection,
      language: input.language === 'ko' ? 'Korean' : 'English',
      'vibeMapping.lighting': vibeMapping.lighting.join(', '),
      'vibeMapping.colors': vibeMapping.colors.join(', '),
    });
  }
}

// Factory function
export function createImageKeywordGeneratorAgent(): ImageKeywordGeneratorAgent {
  return new ImageKeywordGeneratorAgent();
}
