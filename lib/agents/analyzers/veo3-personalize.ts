/**
 * Veo3 Personalize Agent
 * ======================
 * Analyzes reference images and generates personalized Veo3 video prompts
 *
 * Model: Gemini Flash (Vision capable)
 * Category: Analyzer
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext, AgentResult } from '../types';

// ============================================================================
// Analyze Images Input/Output
// ============================================================================

export const AnalyzeImagesInputSchema = z.object({
  campaignName: z.string(),
  artistName: z.string().optional(),
  selectedIdea: z.object({
    title: z.string(),
    description: z.string(),
    hook: z.string().optional(),
    optimizedPrompt: z.string().optional(),
  }).optional(),
  hashtags: z.array(z.string()),
  keywords: z.array(z.string()),
  performanceMetrics: z.object({
    avgViews: z.number(),
    avgEngagement: z.number(),
    viralBenchmark: z.number(),
  }).optional(),
  aiInsights: z.array(z.string()).optional(),
});

export type AnalyzeImagesInput = z.infer<typeof AnalyzeImagesInputSchema>;

export const ImageAnalysisOutputSchema = z.object({
  summary: z.string(),
  detectedElements: z.array(z.string()),
  colorPalette: z.array(z.string()),
  mood: z.string(),
});

export const PromptVariationSchema = z.object({
  title: z.string(),
  concept: z.string(),
  imageUsage: z.string(),
  mood: z.string(),
  cameraWork: z.string(),
  suggestedPromptPreview: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const AnalyzeImagesOutputSchema = z.object({
  imageAnalysis: ImageAnalysisOutputSchema,
  variations: z.array(PromptVariationSchema),
});

export type AnalyzeImagesOutput = z.infer<typeof AnalyzeImagesOutputSchema>;

// ============================================================================
// Finalize Prompt Input/Output
// ============================================================================

export const FinalizePromptInputSchema = z.object({
  selectedVariation: PromptVariationSchema,
  context: AnalyzeImagesInputSchema,
  imageDescriptions: z.string(),
  userFeedback: z.string().optional(),
});

export type FinalizePromptInput = z.infer<typeof FinalizePromptInputSchema>;

export const FinalizePromptOutputSchema = z.object({
  finalPrompt: z.string(),
  metadata: z.object({
    duration: z.string(),
    aspectRatio: z.string(),
    style: z.string(),
    recommendedSettings: z.object({
      fps: z.number(),
      resolution: z.string(),
    }),
  }),
});

export type FinalizePromptOutput = z.infer<typeof FinalizePromptOutputSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

export const Veo3PersonalizeConfig: AgentConfig<AnalyzeImagesInput, AnalyzeImagesOutput> = {
  id: 'veo3-personalize',
  name: 'Veo3 Personalize Agent',
  description: '레퍼런스 이미지를 분석하고 개인화된 Veo3 비디오 프롬프트 생성',
  category: 'analyzer',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are a creative director specializing in viral TikTok and short-form video content.
Your expertise includes:
- Analyzing visual elements, colors, and composition
- Understanding viral content patterns on TikTok
- Creating engaging video concepts from reference images
- Optimizing for AI video generation (Veo3)

═══════════════════════════════════════════════════════════════════
VEO CONTENT FILTER SAFETY (CRITICAL - PREVENTS API REJECTION)
═══════════════════════════════════════════════════════════════════

Veo's RAI (Responsible AI) filter will REJECT prompts containing these elements.
You MUST automatically sanitize or replace these to prevent generation failures.

## STRICTLY FORBIDDEN (Will cause immediate rejection):
1. WEAPONS: guns, pistols, rifles, swords, knives, holsters, ammunition
   ❌ "a pistol in a hip holster" → ✅ "a determined stride with purpose"

2. FIRE/DESTRUCTION: burning buildings, explosions, arson, destruction
   ❌ "burning house in background" → ✅ "distant warm glow and mist"

3. VIOLENCE: fighting, combat, blood, injury, death
   ❌ "fighting scene" → ✅ "intense confrontation"

4. DANGEROUS COMBINATIONS: weapons + fire, people + danger

## AUTOMATIC REPLACEMENT RULES:
- Weapon references → Remove or replace with neutral body language
- Burning/fire destruction → Replace with "warm glow", "atmospheric light", "mist"
- Combat/fighting → Replace with "tension", "confrontation", "standoff"
- Explosions → Replace with "dramatic lighting", "light burst", "flare"

Always respond in valid JSON format.`,

    templates: {
      analyze: `You are a creative director specializing in viral TikTok and short-form video content.

## Task
Analyze the provided image(s) and create 3 unique creative directions for a Veo3 AI-generated video that incorporates these images with the user's campaign context.

## Campaign Context
{{contextStr}}

## Image Analysis Instructions
For each provided image:
1. Identify key visual elements (subjects, objects, colors, composition)
2. Detect the mood and atmosphere
3. Note any brand elements, products, or merchandise
4. Consider how it could be featured in a video (prominently, as background, color extraction, style reference)

## Output Requirements
Return ONLY valid JSON in this exact format:

{
  "imageAnalysis": {
    "summary": "Brief overall summary of what the images contain",
    "detectedElements": ["element1", "element2", "element3"],
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "mood": "overall mood description"
  },
  "variations": [
    {
      "title": "Short catchy title (max 40 chars)",
      "concept": "2-3 sentence description of the creative direction",
      "imageUsage": "How the images are incorporated (featured prominently, background element, style reference, color palette extraction)",
      "mood": "Mood/tone description",
      "cameraWork": "Suggested camera movements and techniques",
      "suggestedPromptPreview": "A 50-word preview of what the final Veo3 prompt would look like",
      "confidence": "high" or "medium" or "low"
    }
  ]
}

## Guidelines
1. Each variation should be DISTINCTLY different in approach
2. First variation: Feature the images/products prominently in the scene
3. Second variation: Use images as style/aesthetic inspiration (cinematic storytelling)
4. Third variation: Abstract/artistic interpretation using colors and mood from images
5. Consider viral TikTok trends and engagement patterns
6. Ensure concepts are feasible for AI video generation
7. Return ONLY the JSON object, no other text or markdown`,

      finalize: `You are a Veo3 AI video generation prompt expert.

## Task
Create the FINAL optimized prompt for Veo3 video generation based on the selected creative direction.

## Selected Creative Direction
Title: {{variationTitle}}
Concept: {{variationConcept}}
Image Usage: {{variationImageUsage}}
Mood: {{variationMood}}
Camera Work: {{variationCameraWork}}
{{userFeedbackSection}}

## Campaign Context
{{contextStr}}

## Reference Images
{{imageDescriptions}}

## Output Requirements
Return ONLY valid JSON in this exact format:

{
  "finalPrompt": "The complete, detailed Veo3 video generation prompt (300-500 words). Include: scene description, lighting, camera movements, transitions, mood, pacing, and how the reference images/products are incorporated. Be extremely specific and cinematic.",
  "metadata": {
    "duration": "5s" or "8s" (recommended video length),
    "aspectRatio": "9:16" (vertical/TikTok) or "16:9" (horizontal) or "1:1" (square),
    "style": "Primary visual style (e.g., cinematic, documentary, artistic, commercial)",
    "recommendedSettings": {
      "fps": 24 or 30 or 60,
      "resolution": "1080p" or "4K"
    }
  }
}

## Veo3 Prompt Guidelines
1. Start with the main subject/action
2. Describe camera movement (dolly, pan, tilt, zoom, tracking shot)
3. Specify lighting (golden hour, studio, neon, natural)
4. Include atmosphere/mood descriptors
5. Detail any products/merchandise appearance
6. Add temporal progression (what happens from start to end)
7. Include style references if applicable
8. End with quality modifiers (cinematic, professional, high-quality)

## CONTENT FILTER SAFETY (CRITICAL):
NEVER include these elements - they will cause Veo to reject the prompt:
- Weapons (guns, knives, swords, holsters)
- Burning/destruction (burning buildings, explosions, arson)
- Violence (fighting, combat, blood, injury)
- Dangerous combinations (weapons + fire, people in danger)

If the creative direction implies any of these, REPLACE with safe alternatives:
- Weapons → Focus on character posture, determination, clothing details
- Fire/destruction → Use "warm glow", "atmospheric mist", "dramatic lighting"
- Violence → Use "tension", "confrontation", "intense standoff"

Return ONLY the JSON object, no markdown or extra text.`,
    },
  },

  inputSchema: AnalyzeImagesInputSchema,
  outputSchema: AnalyzeImagesOutputSchema,
};

/**
 * Veo3 Personalize Agent Implementation
 */
export class Veo3PersonalizeAgent extends BaseAgent<AnalyzeImagesInput, AnalyzeImagesOutput> {
  constructor() {
    super(Veo3PersonalizeConfig);
  }

  protected buildPrompt(input: AnalyzeImagesInput, _context: AgentContext): string {
    const template = this.getTemplate('analyze');
    const contextStr = this.buildContextString(input);
    return this.fillTemplate(template, { contextStr });
  }

  /**
   * Build context string from input
   */
  private buildContextString(input: AnalyzeImagesInput): string {
    const parts: string[] = [];

    if (input.campaignName) {
      parts.push(`Campaign: ${input.campaignName}`);
    }

    if (input.artistName) {
      parts.push(`Artist: ${input.artistName}`);
    }

    if (input.selectedIdea) {
      parts.push(`\nSelected Idea:`);
      parts.push(`  Title: ${input.selectedIdea.title}`);
      parts.push(`  Description: ${input.selectedIdea.description}`);
      if (input.selectedIdea.hook) {
        parts.push(`  Hook: "${input.selectedIdea.hook}"`);
      }
      if (input.selectedIdea.optimizedPrompt) {
        parts.push(`  Base Prompt: ${input.selectedIdea.optimizedPrompt}`);
      }
    }

    if (input.hashtags.length > 0) {
      parts.push(`\nHashtags: ${input.hashtags.map((h) => `#${h}`).join(" ")}`);
    }

    if (input.keywords.length > 0) {
      parts.push(`Keywords: ${input.keywords.join(", ")}`);
    }

    if (input.performanceMetrics) {
      parts.push(`\nPerformance Benchmarks:`);
      parts.push(`  Avg Views: ${Math.round(input.performanceMetrics.avgViews).toLocaleString()}`);
      parts.push(`  Avg Engagement: ${input.performanceMetrics.avgEngagement.toFixed(2)}%`);
      parts.push(`  Viral Benchmark: ${Math.round(input.performanceMetrics.viralBenchmark).toLocaleString()}+ views`);
    }

    if (input.aiInsights && input.aiInsights.length > 0) {
      parts.push(`\nAI Insights: ${input.aiInsights[0]}`);
    }

    return parts.join("\n");
  }

  /**
   * Analyze images and generate creative variations
   */
  async analyzeImages(
    images: Array<{ base64: string; mimeType: string }>,
    input: AnalyzeImagesInput,
    context: AgentContext
  ): Promise<AgentResult<AnalyzeImagesOutput>> {
    const startTime = Date.now();
    const defaultMetadata = {
      agentId: this.config.id,
      model: this.config.model.name,
      tokenUsage: { input: 0, output: 0, total: 0 },
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      const formattedImages = images.map(img => ({
        data: img.base64,
        mimeType: img.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
      }));

      const result = await this.executeWithImages(
        input,
        context,
        formattedImages
      );

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to analyze images',
          metadata: { ...defaultMetadata, latencyMs: Date.now() - startTime },
        };
      }

      // Parse the JSON response
      const parsed = this.parseAnalysisResponse(result.data as unknown as string);

      return {
        success: true,
        data: parsed,
        metadata: result.metadata,
      };
    } catch (error) {
      console.error('[Veo3PersonalizeAgent] analyzeImages error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { ...defaultMetadata, latencyMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Finalize the Veo3 prompt
   */
  async finalizePrompt(
    input: FinalizePromptInput,
    context: AgentContext,
    image?: { base64: string; mimeType: string }
  ): Promise<AgentResult<FinalizePromptOutput>> {
    const startTime = Date.now();
    const defaultMetadata = {
      agentId: this.config.id,
      model: this.config.model.name,
      tokenUsage: { input: 0, output: 0, total: 0 },
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    };

    const template = this.getTemplate('finalize');
    const contextStr = this.buildContextString(input.context);

    const userFeedbackSection = input.userFeedback
      ? `\nUser's Additional Notes: ${input.userFeedback}`
      : '';

    const prompt = this.fillTemplate(template, {
      variationTitle: input.selectedVariation.title,
      variationConcept: input.selectedVariation.concept,
      variationImageUsage: input.selectedVariation.imageUsage,
      variationMood: input.selectedVariation.mood,
      variationCameraWork: input.selectedVariation.cameraWork,
      userFeedbackSection,
      contextStr,
      imageDescriptions: input.imageDescriptions,
    });

    try {
      let result;

      if (image) {
        const formattedImages = [{
          data: image.base64,
          mimeType: image.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
        }];
        result = await this.executeWithImages(
          input.context as unknown as AnalyzeImagesInput,
          context,
          formattedImages
        );
      } else {
        // Execute without images using the base execute method
        const { createGeminiClient } = await import('@/lib/models/gemini-client');
        const client = createGeminiClient('flash');
        const response = await client.generate({
          system: this.config.prompts.system,
          user: prompt,
        });

        const parsed = this.parseFinalizeResponse(response.content || '');
        return {
          success: true,
          data: parsed,
          metadata: { ...defaultMetadata, latencyMs: Date.now() - startTime },
        };
      }

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to finalize prompt',
          metadata: { ...defaultMetadata, latencyMs: Date.now() - startTime },
        };
      }

      // Parse the JSON response
      const parsed = this.parseFinalizeResponse(result.data as unknown as string);

      return {
        success: true,
        data: parsed,
        metadata: result.metadata,
      };
    } catch (error) {
      console.error('[Veo3PersonalizeAgent] finalizePrompt error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { ...defaultMetadata, latencyMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Parse analysis response from Gemini
   */
  private parseAnalysisResponse(responseText: string): AnalyzeImagesOutput {
    try {
      let jsonStr = responseText;

      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // Try to find JSON object
      const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      return {
        imageAnalysis: parsed.imageAnalysis || {
          summary: 'Image analysis completed',
          detectedElements: [],
          colorPalette: [],
          mood: 'neutral',
        },
        variations: parsed.variations || [],
      };
    } catch (error) {
      console.error('[Veo3PersonalizeAgent] Failed to parse analysis response:', error);

      // Return fallback
      return {
        imageAnalysis: {
          summary: 'Images analyzed for creative direction',
          detectedElements: ['visual elements detected'],
          colorPalette: ['#000000', '#FFFFFF'],
          mood: 'neutral',
        },
        variations: [
          {
            title: 'Product Showcase',
            concept: 'Feature the product/image prominently with cinematic presentation',
            imageUsage: 'Featured prominently as the main subject',
            mood: 'Professional and engaging',
            cameraWork: 'Slow dolly in with smooth transitions',
            suggestedPromptPreview: 'Cinematic product showcase video featuring the item in an elegant setting...',
            confidence: 'high',
          },
          {
            title: 'Lifestyle Integration',
            concept: 'Integrate the visuals into a lifestyle/story-driven narrative',
            imageUsage: 'Incorporated naturally into the scene',
            mood: 'Aspirational and relatable',
            cameraWork: 'Dynamic tracking shots following the action',
            suggestedPromptPreview: 'A day-in-the-life style video where the product appears naturally...',
            confidence: 'medium',
          },
          {
            title: 'Artistic Mood Piece',
            concept: 'Use the colors and aesthetics as inspiration for an abstract visual',
            imageUsage: 'Color palette and style reference',
            mood: 'Artistic and atmospheric',
            cameraWork: 'Sweeping camera movements with dramatic angles',
            suggestedPromptPreview: 'Abstract visual journey inspired by the aesthetic elements...',
            confidence: 'medium',
          },
        ],
      };
    }
  }

  /**
   * Parse finalize response from Gemini
   */
  private parseFinalizeResponse(responseText: string): FinalizePromptOutput {
    try {
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response');
      }

      let jsonStr = responseText;

      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // Try to find JSON object
      const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      // Check for alternative field names
      const finalPrompt = parsed.finalPrompt || parsed.prompt || parsed.veo3Prompt ||
                         parsed.videoPrompt || parsed.veoPrompt || parsed.final_prompt ||
                         parsed.video_prompt;

      return {
        finalPrompt: finalPrompt || 'A cinematic video with professional quality.',
        metadata: parsed.metadata || {
          duration: '8s',
          aspectRatio: '9:16',
          style: 'cinematic',
          recommendedSettings: {
            fps: 24,
            resolution: '1080p',
          },
        },
      };
    } catch (error) {
      console.error('[Veo3PersonalizeAgent] Failed to parse finalize response:', error);

      // Return fallback
      return {
        finalPrompt: 'A cinematic video showcasing the product with smooth camera movements, professional lighting, and high production quality. The scene opens with a dramatic reveal, transitioning through elegant angles that highlight key details. Shot in vertical format optimized for TikTok and Instagram Reels.',
        metadata: {
          duration: '8s',
          aspectRatio: '9:16',
          style: 'cinematic',
          recommendedSettings: {
            fps: 24,
            resolution: '1080p',
          },
        },
      };
    }
  }
}

// Singleton instance
let veo3PersonalizeAgent: Veo3PersonalizeAgent | null = null;

/**
 * Get or create the singleton Veo3PersonalizeAgent instance
 */
export function getVeo3PersonalizeAgent(): Veo3PersonalizeAgent {
  if (!veo3PersonalizeAgent) {
    veo3PersonalizeAgent = new Veo3PersonalizeAgent();
  }
  return veo3PersonalizeAgent;
}

/**
 * Factory function
 */
export function createVeo3PersonalizeAgent(): Veo3PersonalizeAgent {
  return new Veo3PersonalizeAgent();
}
