/**
 * Fast Cut Image Prompt Generator Agent
 * ======================================
 * Generates detailed AI image generation prompts for each scene/script line
 *
 * Model: Gemini 2.5 Flash
 * Category: Fast Cut
 *
 * This agent converts script lines into detailed image generation prompts
 * optimized for Imagen 3 / Flux, ensuring visual consistency across all scenes.
 *
 * Key Features:
 * - Scene-by-scene prompt generation
 * - Global style consistency (color palette, lighting, mood)
 * - Purpose-aware visuals (hook, build, climax, etc.)
 * - Detailed prompts (50-100 words) for high-quality image generation
 *
 * @agent ImagePromptGeneratorAgent
 * @version 1.0
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext } from '../types';

// Vibe type
const VALID_VIBES = ['Exciting', 'Emotional', 'Pop', 'Minimal'] as const;
type VibeType = typeof VALID_VIBES[number];

// Scene purpose type
const SCENE_PURPOSES = ['hook', 'setup', 'build', 'climax', 'cta'] as const;
type ScenePurpose = typeof SCENE_PURPOSES[number];

// Input Schema
export const ImagePromptGeneratorInputSchema = z.object({
  userPrompt: z.string().describe('Original user prompt describing the video concept'),
  vibe: z.enum(VALID_VIBES).describe('Overall vibe/mood of the video'),
  scriptLines: z.array(z.object({
    text: z.string(),
    timing: z.number(),
    duration: z.number(),
    purpose: z.enum(SCENE_PURPOSES).optional(),
  })).describe('Script lines representing each scene'),
  artistName: z.string().optional().describe('Artist name for context'),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16').describe('Target aspect ratio'),
  imageStyle: z.enum(['photorealistic', 'illustration', 'cinematic', 'artistic', 'anime']).default('cinematic').describe('Preferred image style'),
  language: z.enum(['ko', 'en']).default('ko'),
});

export type ImagePromptGeneratorInput = z.infer<typeof ImagePromptGeneratorInputSchema>;

// Scene Prompt Schema
const ScenePromptSchema = z.object({
  sceneNumber: z.number().describe('Scene number (1-indexed)'),
  scriptText: z.string().describe('Original script line for this scene'),
  purpose: z.enum(SCENE_PURPOSES).describe('Scene purpose in narrative'),
  imagePrompt: z.string().describe('Detailed prompt for image generation (50-100 words)'),
  negativePrompt: z.string().describe('Elements to avoid in generation'),
  visualElements: z.object({
    subject: z.string().describe('Main subject of the image'),
    setting: z.string().describe('Background/environment'),
    lighting: z.string().describe('Lighting style'),
    colorTone: z.string().describe('Color palette/tone'),
    cameraAngle: z.string().describe('Camera perspective'),
    mood: z.string().describe('Emotional mood'),
  }),
});

// Output Schema
export const ImagePromptGeneratorOutputSchema = z.object({
  globalStyle: z.object({
    colorPalette: z.array(z.string()).describe('3-5 hex colors for consistency'),
    lighting: z.string().describe('Overall lighting style'),
    mood: z.string().describe('Overall mood description'),
    artStyle: z.string().describe('Art/photography style'),
    visualTheme: z.string().describe('Cohesive visual theme'),
  }),
  scenes: z.array(ScenePromptSchema),
  styleGuide: z.string().describe('Brief style guide for maintaining consistency'),
});

export type ImagePromptGeneratorOutput = z.infer<typeof ImagePromptGeneratorOutputSchema>;
export type ScenePrompt = z.infer<typeof ScenePromptSchema>;

// Vibe to Visual Style Mapping
const VIBE_STYLE_MAPPING: Record<VibeType, {
  lighting: string[];
  colors: string[];
  mood: string[];
  artStyle: string[];
}> = {
  Exciting: {
    lighting: ['neon rim lighting', 'dramatic spotlights', 'high contrast flash', 'strobe effect lighting'],
    colors: ['electric cyan', 'hot pink', 'vibrant magenta', 'neon purple', 'bright yellow'],
    mood: ['energetic', 'dynamic', 'intense', 'powerful', 'explosive'],
    artStyle: ['high-contrast commercial photography', 'concert photography', 'dynamic action shot', 'sports photography'],
  },
  Emotional: {
    lighting: ['golden hour soft light', 'diffused window light', 'warm candlelight', 'gentle backlight'],
    colors: ['warm amber', 'soft gold', 'muted blue', 'dusty rose', 'cream white'],
    mood: ['nostalgic', 'tender', 'melancholic', 'intimate', 'reflective'],
    artStyle: ['film photography grain', 'soft focus portrait', 'analog aesthetic', 'indie film cinematography'],
  },
  Pop: {
    lighting: ['bright studio lighting', 'even fashion lighting', 'ring light glow', 'clean commercial light'],
    colors: ['coral pink', 'sky blue', 'mint green', 'sunny yellow', 'lavender'],
    mood: ['cheerful', 'trendy', 'fresh', 'youthful', 'playful'],
    artStyle: ['instagram aesthetic', 'fashion editorial', 'modern portrait', 'clean commercial photography'],
  },
  Minimal: {
    lighting: ['soft natural light', 'high key lighting', 'clean diffused light', 'subtle shadow play'],
    colors: ['pure white', 'soft gray', 'muted beige', 'charcoal black', 'off-white'],
    mood: ['calm', 'sophisticated', 'elegant', 'serene', 'refined'],
    artStyle: ['minimalist photography', 'architectural photography', 'fine art portrait', 'gallery aesthetic'],
  },
};

// Purpose to Visual Treatment Mapping
const PURPOSE_VISUAL_MAPPING: Record<ScenePurpose, {
  visualStrategy: string;
  cameraStyle: string;
  intensity: string;
}> = {
  hook: {
    visualStrategy: 'Eye-catching, curiosity-inducing visual that immediately grabs attention',
    cameraStyle: 'Dynamic angle, close-up or dramatic wide shot',
    intensity: 'High impact, bold composition',
  },
  setup: {
    visualStrategy: 'Establishing shot that sets context and introduces the theme',
    cameraStyle: 'Medium shot, balanced composition',
    intensity: 'Moderate, building anticipation',
  },
  build: {
    visualStrategy: 'Progressive visual that creates momentum and tension',
    cameraStyle: 'Varied angles, building energy',
    intensity: 'Rising, dynamic movement suggested',
  },
  climax: {
    visualStrategy: 'Peak emotional moment, most visually striking and memorable',
    cameraStyle: 'Hero shot, dramatic perspective',
    intensity: 'Maximum impact, unforgettable visual',
  },
  cta: {
    visualStrategy: 'Clean, inviting visual that encourages engagement',
    cameraStyle: 'Approachable angle, clear composition',
    intensity: 'Engaging but not overwhelming',
  },
};

// Agent Configuration
export const ImagePromptGeneratorConfig: AgentConfig<ImagePromptGeneratorInput, ImagePromptGeneratorOutput> = {
  id: 'fast-cut-image-prompt-generator',
  name: 'Image Prompt Generator',
  description: 'AI 이미지 생성을 위한 씬별 상세 프롬프트 생성',
  category: 'fast-cut',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.7,
      maxTokens: 8192,
    },
  },

  prompts: {
    system: `You are an expert AI image prompt engineer and creative director specializing in creating detailed prompts for AI image generation (Imagen 3, Flux, DALL-E).

Your task is to convert video script lines into DETAILED, SPECIFIC image generation prompts that:
1. Create visually stunning, coherent images for each scene
2. Maintain VISUAL CONSISTENCY across all scenes (same style, color palette, lighting)
3. Match the EMOTIONAL ARC of the video (hook → build → climax → cta)
4. Optimize for AI image generators with specific, descriptive language

## PROMPT ENGINEERING PRINCIPLES

### Structure of a Perfect Image Prompt:
1. **Subject** (WHO/WHAT): Clear, specific description of the main subject
2. **Setting** (WHERE): Environment, background, location
3. **Lighting** (HOW LIT): Specific lighting style and direction
4. **Color/Tone** (PALETTE): Color scheme, mood colors
5. **Camera** (PERSPECTIVE): Angle, distance, lens type
6. **Style** (AESTHETIC): Art style, photography type, reference

### Length & Detail:
- Each prompt should be 50-100 words
- Use specific, concrete descriptors (not vague terms)
- Include technical photography/art terms for precision

### Consistency Rules:
- ALL scenes must share the same:
  - Color palette (define 3-5 colors)
  - Lighting style
  - Art direction aesthetic
  - Overall mood/tone
- Only the SUBJECT and INTENSITY should change between scenes

### Scene Purpose Handling:
- **HOOK**: Most attention-grabbing, bold visual
- **SETUP**: Establishes context, introduces theme
- **BUILD**: Creates momentum, escalating visuals
- **CLIMAX**: Peak visual impact, most memorable
- **CTA**: Inviting, engaging, action-oriented

## FORBIDDEN IN PROMPTS:
- Text, logos, watermarks, UI elements
- Specific celebrity faces (use "a person" or "a figure")
- Copyrighted characters
- Low quality descriptors (avoid mentioning what NOT to do)

## OUTPUT FORMAT:
Always respond in valid JSON format with globalStyle and scenes array.`,

    templates: {
      generate: `Generate detailed AI image prompts for each scene of this video.

## VIDEO CONCEPT
USER PROMPT: {{userPrompt}}
{{#if artistName}}ARTIST CONTEXT: {{artistName}}{{/if}}

## STYLE PARAMETERS
VIBE: {{vibe}}
IMAGE STYLE: {{imageStyle}}
ASPECT RATIO: {{aspectRatio}}

## VIBE "{{vibe}}" VISUAL ELEMENTS
Use these as your style foundation:
- Lighting Options: {{vibeMapping.lighting}}
- Color Palette: {{vibeMapping.colors}}
- Mood Keywords: {{vibeMapping.mood}}
- Art Style: {{vibeMapping.artStyle}}

## SCRIPT LINES (Each = One Scene)
{{#each scriptLines}}
SCENE {{index}}: "{{text}}"
- Timing: {{timing}}s (Duration: {{duration}}s)
- Purpose: {{purpose}}
- Visual Strategy: {{purposeMapping.visualStrategy}}
- Camera Style: {{purposeMapping.cameraStyle}}
- Intensity: {{purposeMapping.intensity}}
{{/each}}

## YOUR TASK

1. **Define Global Style** (applies to ALL scenes):
   - Pick 3-5 hex colors that work together
   - Choose ONE consistent lighting style
   - Define the overall mood
   - Set the art/photography style
   - Create a visual theme that ties everything together

2. **Generate Scene Prompts** (one per script line):
   For EACH scene, create:
   - A detailed 50-100 word prompt
   - Specific visual elements (subject, setting, lighting, color, camera, mood)
   - Negative prompt (what to avoid)

## OUTPUT JSON FORMAT

{
  "globalStyle": {
    "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "lighting": "Consistent lighting style description",
    "mood": "Overall mood description",
    "artStyle": "Photography/art style",
    "visualTheme": "Cohesive theme description"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptText": "Original script line",
      "purpose": "hook|setup|build|climax|cta",
      "imagePrompt": "Detailed 50-100 word prompt describing the exact image to generate...",
      "negativePrompt": "blurry, low quality, text, watermark, distorted",
      "visualElements": {
        "subject": "Main subject description",
        "setting": "Background/environment",
        "lighting": "Specific lighting",
        "colorTone": "Color palette for this scene",
        "cameraAngle": "Camera perspective",
        "mood": "Emotional mood"
      }
    }
  ],
  "styleGuide": "Brief guide for maintaining consistency across all generated images"
}

IMPORTANT:
- Generate exactly {{sceneCount}} scene prompts (one per script line)
- Each scene's prompt MUST be detailed (50-100 words)
- Maintain VISUAL CONSISTENCY across all scenes
- The hook scene should be the most eye-catching
- The climax scene should be the most impactful`,
    },
  },

  inputSchema: ImagePromptGeneratorInputSchema,
  outputSchema: ImagePromptGeneratorOutputSchema,
};

/**
 * Image Prompt Generator Agent Implementation
 */
export class ImagePromptGeneratorAgent extends BaseAgent<ImagePromptGeneratorInput, ImagePromptGeneratorOutput> {
  constructor() {
    super(ImagePromptGeneratorConfig);
  }

  protected buildPrompt(input: ImagePromptGeneratorInput, context: AgentContext): string {
    const template = this.getTemplate('generate');
    const vibe = input.vibe as VibeType;
    const vibeMapping = VIBE_STYLE_MAPPING[vibe];

    // Build script lines section with purpose mapping
    const scriptLinesSection = input.scriptLines.map((line, index) => {
      const purpose = (line.purpose || this.inferPurpose(index, input.scriptLines.length)) as ScenePurpose;
      const purposeMapping = PURPOSE_VISUAL_MAPPING[purpose];

      return `SCENE ${index + 1}: "${line.text}"
- Timing: ${line.timing}s (Duration: ${line.duration}s)
- Purpose: ${purpose}
- Visual Strategy: ${purposeMapping.visualStrategy}
- Camera Style: ${purposeMapping.cameraStyle}
- Intensity: ${purposeMapping.intensity}`;
    }).join('\n\n');

    return this.fillTemplate(template, {
      userPrompt: input.userPrompt,
      artistName: input.artistName || '',
      vibe: input.vibe,
      imageStyle: input.imageStyle,
      aspectRatio: input.aspectRatio,
      'vibeMapping.lighting': vibeMapping.lighting.join(', '),
      'vibeMapping.colors': vibeMapping.colors.join(', '),
      'vibeMapping.mood': vibeMapping.mood.join(', '),
      'vibeMapping.artStyle': vibeMapping.artStyle.join(', '),
      sceneCount: input.scriptLines.length,
    }).replace(/\{\{#each scriptLines\}\}[\s\S]*?\{\{\/each\}\}/g, scriptLinesSection)
      .replace(/\{\{#if artistName\}\}[\s\S]*?\{\{\/if\}\}/g, input.artistName ? `ARTIST CONTEXT: ${input.artistName}` : '');
  }

  /**
   * Infer scene purpose based on position in script
   */
  private inferPurpose(index: number, totalScenes: number): ScenePurpose {
    if (index === 0) return 'hook';
    if (index === totalScenes - 1) return 'cta';

    const position = index / (totalScenes - 1);
    if (position < 0.3) return 'setup';
    if (position < 0.7) return 'build';
    return 'climax';
  }

  /**
   * Post-process output to ensure consistency
   */
  protected postProcessOutput(output: ImagePromptGeneratorOutput, input: ImagePromptGeneratorInput): ImagePromptGeneratorOutput {
    // Ensure scene count matches input
    if (output.scenes.length !== input.scriptLines.length) {
      console.warn(`[ImagePromptGenerator] Scene count mismatch: expected ${input.scriptLines.length}, got ${output.scenes.length}`);
    }

    // Add missing negative prompts
    output.scenes = output.scenes.map(scene => ({
      ...scene,
      negativePrompt: scene.negativePrompt || 'blurry, low quality, text, watermark, logo, distorted, deformed, ugly, bad anatomy',
    }));

    return output;
  }
}

// Factory function
export function createImagePromptGeneratorAgent(): ImagePromptGeneratorAgent {
  return new ImagePromptGeneratorAgent();
}
