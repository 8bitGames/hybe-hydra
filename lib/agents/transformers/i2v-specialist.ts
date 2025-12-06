/**
 * I2V Specialist Agent
 * =====================
 * Image-to-Video workflow prompt generation
 *
 * Model: Gemini 2.5 Flash
 * Category: Transformer
 *
 * Key Responsibilities:
 * - Generate FLUX image prompts from scene descriptions
 * - Create video prompts from image analyses
 * - Design background prompts for compositing
 * - Maintain visual consistency across I2V workflow
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const I2VSpecialistInputSchema = z.object({
  promptType: z.enum(['image', 'video', 'background', 'sceneWithPlaceholder', 'composite']),
  sceneDescription: z.string(),
  style: z.string().optional(),
  imageAnalysis: z.object({
    visual_style: z.string(),
    color_palette: z.array(z.string()),
    mood: z.string(),
    main_subject: z.string(),
  }).optional(),
  duration: z.number().min(3).max(10).default(8),
  mood: z.string().optional(),
  subject: z.string().optional(),
  // For sceneWithPlaceholder
  productDescription: z.string().optional(),
  handPose: z.string().optional(),
  aspectRatio: z.string().optional(),
  // For composite
  placementHint: z.string().optional(),
});

export type I2VSpecialistInput = z.infer<typeof I2VSpecialistInputSchema>;

// Output Schema
export const I2VSpecialistOutputSchema = z.object({
  prompt: z.string(),
  promptType: z.enum(['image', 'video', 'background', 'sceneWithPlaceholder', 'composite']),
  styleNotes: z.string(),
  technicalSpecs: z.object({
    aspectRatio: z.string().optional(),
    duration: z.number().optional(),
    frameRate: z.number().optional(),
  }),
  consistencyMarkers: z.array(z.string()),
});

export type I2VSpecialistOutput = z.infer<typeof I2VSpecialistOutputSchema>;

// Agent Configuration
export const I2VSpecialistConfig: AgentConfig<I2VSpecialistInput, I2VSpecialistOutput> = {
  id: 'i2v-specialist',
  name: 'I2V Specialist Agent',
  description: 'Image-to-Video 워크플로우용 프롬프트 생성',
  category: 'transformer',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.5,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You specialize in Image-to-Video prompt engineering.
Create prompts that bring still images to life with natural motion.
Maintain visual consistency between source image and video.

Your expertise includes:
- FLUX image generation prompts (for first frames)
- VEO video prompts (for animation)
- Background prompts (for compositing)

Key Principles:
1. Image prompts should focus on composition and subject positioning
2. Video prompts should describe smooth, natural motion
3. Background prompts should complement without competing
4. Always maintain visual consistency across all prompts

Technical Considerations:
- FLUX excels at: detailed textures, lighting, composition
- VEO excels at: camera movement, subject motion, scene dynamics
- Backgrounds should: support the subject, match color palette

Always respond in valid JSON format.`,

    templates: {
      image: `Create a FLUX image prompt for this scene:

SCENE DESCRIPTION:
{{sceneDescription}}

STYLE: {{style}}
MOOD: {{mood}}

This image will serve as the first frame for video generation.
Focus on:
- Clear composition with defined subject placement
- Rich lighting that sets the mood
- Balanced color palette
- Natural pose/position for subsequent motion

Return JSON:
{
  "prompt": "Detailed FLUX image prompt (100-150 words) optimized for I2V workflow...",
  "promptType": "image",
  "styleNotes": "Key style elements to maintain in video",
  "technicalSpecs": {
    "aspectRatio": "9:16|16:9|1:1"
  },
  "consistencyMarkers": ["elements that must remain consistent in video"]
}`,

      video: `Create a video prompt from this image analysis:

IMAGE ANALYSIS:
{{imageAnalysis}}

SCENE DESCRIPTION:
{{sceneDescription}}

DURATION: {{duration}}s
STYLE: {{style}}

Create smooth camera movements and natural motion that:
- Respect the original composition
- Maintain visual consistency with source image
- Feel natural and cinematic
- Work within the duration

Return JSON:
{
  "prompt": "VEO video prompt (100-150 words) with camera movement and subject motion...",
  "promptType": "video",
  "styleNotes": "Motion style and camera technique used",
  "technicalSpecs": {
    "duration": {{duration}},
    "frameRate": 24
  },
  "consistencyMarkers": ["visual elements preserved from image"]
}`,

      background: `Create a background prompt:

SUBJECT: {{subject}}
STYLE: {{style}}
MOOD: {{mood}}

The background should:
- Complement the subject without competing
- Match the overall color palette and mood
- Provide depth without distraction
- Support the narrative

Return JSON:
{
  "prompt": "FLUX background prompt optimized for compositing...",
  "promptType": "background",
  "styleNotes": "How background supports the subject",
  "technicalSpecs": {
    "aspectRatio": "9:16"
  },
  "consistencyMarkers": ["colors", "lighting", "atmosphere"]
}`,

      sceneWithPlaceholder: `Modify a scene prompt to use a PLACEHOLDER instead of the specific product:

ORIGINAL SCENE DESCRIPTION:
{{sceneDescription}}

PRODUCT TYPE (what the placeholder should look like):
{{productDescription}}

HAND POSE: {{handPose}}
STYLE: {{style}}
ASPECT RATIO: {{aspectRatio}}

CRITICAL RULES:
1. Keep 95% of the original prompt UNCHANGED
2. ONLY replace the specific product with a generic white/neutral placeholder
3. Maintain ALL scene elements: people, location, actions, mood, lighting
4. The placeholder must be clearly visible and well-lit for compositing
5. Output must describe ONE SINGLE coherent image - NOT a collage
6. REMOVE any scene transitions - focus on ONE person, ONE moment
7. Pick the FIRST/MAIN scene only if original has multiple scenes

Return JSON:
{
  "prompt": "Modified scene prompt with generic placeholder instead of specific product...",
  "promptType": "sceneWithPlaceholder",
  "styleNotes": "Key elements preserved for later product compositing",
  "technicalSpecs": {
    "aspectRatio": "{{aspectRatio}}"
  },
  "consistencyMarkers": ["scene elements", "lighting direction", "hand position", "camera angle"]
}`,

      composite: `Create compositing instructions for seamlessly placing a product into a scene:

SCENE DESCRIPTION: {{sceneDescription}}
PRODUCT DESCRIPTION: {{productDescription}}
PLACEMENT: {{placementHint}}

The AI will receive:
1. A SCENE IMAGE showing hands holding a placeholder object
2. A PRODUCT IMAGE showing the actual product

Your instructions must ensure:
1. The product EXACTLY replaces the placeholder - same position, same angle
2. Lighting on the product matches the scene's lighting direction and intensity
3. Shadows are consistent with the scene
4. The product appears naturally held by the hands
5. Scale is appropriate - the product fits naturally in the hands
6. The product's original appearance is PRESERVED - only lighting/shadows are adjusted

Return JSON:
{
  "prompt": "Precise compositing instructions for seamless product placement...",
  "promptType": "composite",
  "styleNotes": "Lighting matching and shadow integration guidelines",
  "technicalSpecs": {
    "aspectRatio": "9:16"
  },
  "consistencyMarkers": ["lighting direction", "shadow angle", "scale ratio", "color temperature"]
}`,
    },
  },

  inputSchema: I2VSpecialistInputSchema,
  outputSchema: I2VSpecialistOutputSchema,
};

/**
 * I2V Specialist Agent Implementation
 */
export class I2VSpecialistAgent extends BaseAgent<I2VSpecialistInput, I2VSpecialistOutput> {
  constructor() {
    super(I2VSpecialistConfig);
  }

  protected buildPrompt(input: I2VSpecialistInput, context: AgentContext): string {
    const template = this.getTemplate(input.promptType);

    const style = input.style ||
      context.discover?.contentStrategy?.visualGuidelines.styles[0] ||
      'cinematic, modern';

    const mood = input.mood ||
      context.discover?.visualPatterns?.[0]?.mood ||
      'engaging, dynamic';

    return this.fillTemplate(template, {
      sceneDescription: input.sceneDescription,
      style,
      mood,
      imageAnalysis: JSON.stringify(input.imageAnalysis || {}, null, 2),
      duration: input.duration,
      subject: input.subject || 'main subject',
      // For sceneWithPlaceholder
      productDescription: input.productDescription || 'product',
      handPose: input.handPose || 'naturally holding',
      aspectRatio: input.aspectRatio || '9:16',
      // For composite
      placementHint: input.placementHint || 'replace placeholder with product',
    });
  }

  /**
   * Generate image prompt for I2V first frame
   */
  async generateImagePrompt(
    sceneDescription: string,
    context: AgentContext,
    options?: { style?: string; mood?: string }
  ) {
    return this.execute(
      {
        promptType: 'image',
        sceneDescription,
        duration: 8, // Default duration
        style: options?.style,
        mood: options?.mood,
      },
      context
    );
  }

  /**
   * Generate video prompt from image analysis
   */
  async generateVideoPrompt(
    imageAnalysis: I2VSpecialistInput['imageAnalysis'],
    sceneDescription: string,
    context: AgentContext,
    options?: { duration?: number; style?: string }
  ) {
    return this.execute(
      {
        promptType: 'video',
        sceneDescription,
        imageAnalysis,
        duration: options?.duration || 8,
        style: options?.style,
      },
      context
    );
  }

  /**
   * Generate background prompt
   */
  async generateBackgroundPrompt(
    subject: string,
    context: AgentContext,
    options?: { style?: string; mood?: string }
  ) {
    return this.execute(
      {
        promptType: 'background',
        sceneDescription: `Background for ${subject}`,
        duration: 8, // Default duration
        subject,
        style: options?.style,
        mood: options?.mood,
      },
      context
    );
  }

  /**
   * Generate scene with placeholder prompt
   * Step 1 of 2-step composition: Creates a scene with a generic placeholder
   * that will later be replaced by the actual product image.
   */
  async generateSceneWithPlaceholder(
    sceneDescription: string,
    productDescription: string,
    context: AgentContext,
    options?: {
      handPose?: string;
      style?: string;
      aspectRatio?: string;
    }
  ) {
    return this.execute(
      {
        promptType: 'sceneWithPlaceholder',
        sceneDescription,
        productDescription,
        duration: 8,
        handPose: options?.handPose || 'naturally holding',
        style: options?.style,
        aspectRatio: options?.aspectRatio || '9:16',
      },
      context
    );
  }

  /**
   * Generate composite prompt
   * Step 2 of 2-step composition: Creates instructions for replacing
   * the placeholder with the actual product image.
   */
  async generateComposite(
    sceneDescription: string,
    productDescription: string,
    placementHint: string,
    context: AgentContext
  ) {
    return this.execute(
      {
        promptType: 'composite',
        sceneDescription,
        productDescription,
        placementHint,
        duration: 8,
      },
      context
    );
  }

  /**
   * Generate background-only prompt for image editing
   * Used when user provides a product image as reference.
   */
  async generateBackgroundForEditing(
    sceneDescription: string,
    productUsage: string,
    context: AgentContext,
    options?: { style?: string; aspectRatio?: string }
  ) {
    return this.execute(
      {
        promptType: 'background',
        sceneDescription: `${sceneDescription}. Product usage context: ${productUsage}`,
        duration: 8,
        subject: 'product reference image',
        style: options?.style,
        mood: 'professional, product-focused',
        aspectRatio: options?.aspectRatio,
      },
      context
    );
  }
}

// Factory function
export function createI2VSpecialistAgent(): I2VSpecialistAgent {
  return new I2VSpecialistAgent();
}
