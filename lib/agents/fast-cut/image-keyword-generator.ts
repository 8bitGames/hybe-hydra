/**
 * Fast Cut Image Keyword Generator Agent
 * =======================================
 * Generates Google Image Search optimized keywords based on vibe and prompt
 *
 * Model: Gemini 2.5 Flash
 * Category: Fast Cut
 *
 * This agent specializes in converting abstract concepts into
 * concrete, searchable image keywords for slideshow creation.
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
  category: 'fast-cut',

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

Your job is to convert abstract video concepts into CONCRETE, SEARCHABLE image keywords.

## CRITICAL RULES:

1. SEARCHABILITY: Every keyword must return good images on Google Image Search
   - ❌ BAD: "love", "happiness", "energy" (too abstract)
   - ✅ GOOD: "couple sunset beach silhouette", "celebration confetti party" (concrete visuals)

2. FORMAT: Each keyword should be 2-4 words
   - ❌ BAD: "city" (too vague), "a beautiful sunset on the beach" (too long)
   - ✅ GOOD: "tokyo night neon street", "sunset beach golden hour"

3. QUALITY MODIFIERS: Add these to improve image quality
   - "4K", "HD", "photography", "cinematic", "professional", "aesthetic"

4. VIBE ALIGNMENT: All keywords must match the specified vibe
   - Exciting = dynamic, colorful, energetic visuals
   - Emotional = warm, soft, nostalgic visuals
   - Pop = trendy, bright, modern visuals
   - Minimal = clean, simple, elegant visuals

5. DIVERSITY: Generate diverse keywords across categories
   - Subject: People, artists, performers
   - Scene: Locations, backgrounds, environments
   - Mood Visual: Lighting, atmosphere, feeling expressed visually
   - Style: Photography style, aesthetic

Always respond in valid JSON format.`,

    templates: {
      generate: `Generate optimized Google Image Search keywords for a Fast Cut video.

## INPUT
VIBE: {{vibe}}
USER PROMPT: {{userPrompt}}
{{artistSection}}
{{scriptSection}}
LANGUAGE: {{language}}

## VIBE "{{vibe}}" VISUAL REFERENCE
Use these visual elements that match the {{vibe}} vibe:
- Lighting: {{vibeMapping.lighting}}
- Scene: {{vibeMapping.scene}}
- Mood: {{vibeMapping.mood}}
- Colors: {{vibeMapping.colors}}

## REQUIREMENTS

Generate 10-12 keywords distributed across these categories:

### 1. SUBJECT (2-3 keywords)
Keywords for the main subject/person in the video.
{{artistKeywordGuide}}
Format: "{name/descriptor} {context} {quality}"
Examples: "kpop idol stage performance HD", "singer concert closeup 4K"

### 2. SCENE (3-4 keywords)
Searchable background/location keywords that match {{vibe}} vibe.
Format: "{specific place} {lighting/time} {photography}"
Examples based on {{vibe}}:
{{sceneExamples}}

### 3. MOOD VISUAL (2-3 keywords)
Visual representations of the mood/atmosphere matching {{vibe}}.
These should be CONCRETE visuals, not abstract emotions.
Format: "{visual element} {lighting} {aesthetic}"
Examples based on {{vibe}}:
{{moodExamples}}

### 4. STYLE (2 keywords)
Photography/cinematography style keywords.
Format: "{style} {medium} {quality}"
Examples: "cinematic film grain aesthetic", "editorial fashion photography 4K"

## OUTPUT JSON
{
  "searchKeywords": [
    "all keywords in order of importance for image search"
  ],
  "keywordCategories": {
    "subject": ["subject keyword 1", "subject keyword 2"],
    "scene": ["scene keyword 1", "scene keyword 2", "scene keyword 3"],
    "moodVisual": ["mood visual 1", "mood visual 2"],
    "style": ["style keyword 1", "style keyword 2"]
  },
  "reasoning": "Brief explanation of keyword selection strategy"
}`,
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

    // Build artist section
    let artistSection = '';
    let artistKeywordGuide = 'Generate generic performer/artist keywords.';
    if (input.artistName) {
      artistSection = `ARTIST NAME: ${input.artistName}`;
      artistKeywordGuide = `Include "${input.artistName}" in 1-2 keywords.
Format: "${input.artistName} {context} {quality}"
Examples: "${input.artistName} concert stage 4K", "${input.artistName} photoshoot HD"`;
    }

    // Build script section
    let scriptSection = '';
    if (input.scriptLines && input.scriptLines.length > 0) {
      scriptSection = `SCRIPT LINES (for context):\n${input.scriptLines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`;
    }

    // Build scene examples based on vibe
    const sceneExamples = this.getSceneExamples(vibe);
    const moodExamples = this.getMoodExamples(vibe);

    return this.fillTemplate(template, {
      vibe: input.vibe,
      userPrompt: input.userPrompt,
      artistSection,
      artistKeywordGuide,
      scriptSection,
      language: input.language === 'ko' ? 'Korean' : 'English',
      'vibeMapping.lighting': vibeMapping.lighting.join(', '),
      'vibeMapping.scene': vibeMapping.scene.join(', '),
      'vibeMapping.mood': vibeMapping.mood.join(', '),
      'vibeMapping.colors': vibeMapping.colors.join(', '),
      sceneExamples,
      moodExamples,
    });
  }

  private getSceneExamples(vibe: VibeType): string {
    const examples: Record<VibeType, string[]> = {
      Exciting: [
        '"concert crowd cheering 4K"',
        '"festival stage lights night"',
        '"neon city street tokyo"',
        '"dance club strobe lights"',
      ],
      Emotional: [
        '"empty road autumn sunset"',
        '"rain window reflection night"',
        '"ocean waves golden hour"',
        '"vintage train station fog"',
      ],
      Pop: [
        '"colorful graffiti wall urban"',
        '"trendy cafe interior bright"',
        '"rooftop city skyline day"',
        '"shopping street tokyo shibuya"',
      ],
      Minimal: [
        '"white studio background clean"',
        '"modern interior minimal design"',
        '"geometric architecture abstract"',
        '"zen garden peaceful simple"',
      ],
    };
    return examples[vibe].map(ex => `- ${ex}`).join('\n');
  }

  private getMoodExamples(vibe: VibeType): string {
    const examples: Record<VibeType, string[]> = {
      Exciting: [
        '"confetti explosion celebration"',
        '"motion blur dynamic energy"',
        '"fireworks night sky colorful"',
      ],
      Emotional: [
        '"soft bokeh lights night"',
        '"film grain nostalgic vintage"',
        '"warm sunlight through curtains"',
      ],
      Pop: [
        '"bright pastel aesthetic clean"',
        '"instagram flat lay trendy"',
        '"colorful balloon party fun"',
      ],
      Minimal: [
        '"shadow play black white"',
        '"negative space art minimal"',
        '"soft gradient subtle tones"',
      ],
    };
    return examples[vibe].map(ex => `- ${ex}`).join('\n');
  }
}

// Factory function
export function createImageKeywordGeneratorAgent(): ImageKeywordGeneratorAgent {
  return new ImageKeywordGeneratorAgent();
}
