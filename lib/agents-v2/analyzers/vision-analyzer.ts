/**
 * Vision Analyzer Agent (v2)
 *
 * Migrated to @hybe/agent-framework with HybeBaseAgent.
 * Analyzes images and videos to extract visual elements, composition,
 * mood, and content patterns.
 */

import { z } from 'zod';
import type { AgentConfig, MediaInput } from '@hybe/agent-framework';
import { HybeBaseAgent } from '../base/hybe-base-agent';
import type { HybeAgentContext } from '../types';

// ============================================================================
// Schemas
// ============================================================================

export const VisionAnalyzerInputSchema = z.object({
  /** Type of media being analyzed */
  mediaType: z.enum(['image', 'video']),
  /** Depth of analysis */
  analysisDepth: z.enum(['quick', 'standard', 'detailed']).default('standard'),
  /** Specific aspects to focus on */
  focusAreas: z
    .array(z.enum(['composition', 'subjects', 'colors', 'mood', 'text', 'motion']))
    .optional(),
});

export type VisionAnalyzerInput = z.infer<typeof VisionAnalyzerInputSchema>;

export const VisionAnalyzerOutputSchema = z.object({
  /** Overall description of the visual content */
  description: z.string(),
  /** Identified subjects/objects in the media */
  subjects: z.array(
    z.object({
      name: z.string(),
      confidence: z.number().min(0).max(1),
      position: z.string().optional(),
      attributes: z.array(z.string()).optional(),
    })
  ),
  /** Dominant colors */
  colors: z.object({
    primary: z.array(z.string()),
    accent: z.array(z.string()).optional(),
    mood: z.string(),
  }),
  /** Composition analysis */
  composition: z.object({
    style: z.string(),
    framing: z.string(),
    balance: z.string(),
    focusPoint: z.string().optional(),
  }),
  /** Mood and atmosphere */
  mood: z.object({
    overall: z.string(),
    energy: z.enum(['low', 'medium', 'high']),
    tone: z.string(),
    emotions: z.array(z.string()).optional(),
  }),
  /** Text detected in media (if any) */
  textContent: z
    .object({
      detected: z.boolean(),
      text: z.array(z.string()).optional(),
      style: z.string().optional(),
    })
    .optional(),
  /** Motion analysis (for videos) */
  motion: z
    .object({
      type: z.string(),
      pace: z.enum(['slow', 'moderate', 'fast']),
      transitions: z.array(z.string()).optional(),
    })
    .optional(),
  /** Scene breakdown (for videos) */
  scenes: z
    .array(
      z.object({
        timestamp: z.string().optional(),
        description: z.string(),
        duration: z.string().optional(),
      })
    )
    .optional(),
  /** Quality assessment */
  quality: z.object({
    resolution: z.enum(['low', 'medium', 'high', 'excellent']),
    lighting: z.string(),
    sharpness: z.string(),
    overall: z.number().min(1).max(10),
  }),
  /** Content categorization */
  categories: z.array(z.string()),
  /** Suggested hashtags based on content */
  suggestedHashtags: z.array(z.string()).optional(),
});

export type VisionAnalyzerOutput = z.infer<typeof VisionAnalyzerOutputSchema>;

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are an expert visual content analyzer specializing in social media content.
Your task is to analyze images and videos to extract comprehensive visual information.

You provide detailed, accurate analysis covering:
- Subject identification and attributes
- Color palette and mood
- Composition and framing techniques
- Emotional tone and energy level
- Quality assessment
- Content categorization for social media

Always respond with valid JSON matching the requested schema.
Be specific and detailed in your descriptions.
Consider the platform context when analyzing content.`;

const IMAGE_TEMPLATE = `Analyze this image for {{platform}} content creation.
Analysis depth: {{analysisDepth}}
Language: {{language}}

Provide comprehensive analysis including:
1. Description of the visual content
2. Subjects/objects identified with confidence levels
3. Color palette (primary and accent colors, color mood)
4. Composition analysis (style, framing, balance, focus point)
5. Mood assessment (overall mood, energy level, tone, emotions)
6. Text content if any is visible
7. Quality assessment (resolution, lighting, sharpness, overall score 1-10)
8. Content categories for social media
9. Suggested hashtags

Respond in JSON format.`;

const VIDEO_TEMPLATE = `Analyze this video for {{platform}} content creation.
Analysis depth: {{analysisDepth}}
Language: {{language}}

Provide comprehensive analysis including:
1. Overall description of the video content
2. Main subjects/objects identified
3. Color palette and visual mood
4. Composition and framing style
5. Mood and emotional tone
6. Motion analysis (type, pace, transitions)
7. Scene breakdown with timestamps if applicable
8. Text/captions if visible
9. Quality assessment
10. Content categories and suggested hashtags

Respond in JSON format.`;

// ============================================================================
// Configuration
// ============================================================================

export const VisionAnalyzerConfig: AgentConfig<VisionAnalyzerInput, VisionAnalyzerOutput> = {
  id: 'vision-analyzer-v2',
  name: 'Vision Analyzer Agent (v2)',
  description: 'Analyzes images and videos to extract visual elements, composition, mood, and patterns',
  category: 'analyzer',
  inputSchema: VisionAnalyzerInputSchema,
  outputSchema: VisionAnalyzerOutputSchema,
  prompts: {
    system: SYSTEM_PROMPT,
    templates: {
      image: IMAGE_TEMPLATE,
      video: VIDEO_TEMPLATE,
    },
  },
  model: {
    provider: 'gemini',
    name: 'gemini-2.0-flash',
    options: {
      temperature: 0.3,
      maxTokens: 4096,
    },
  },
};

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Vision Analyzer Agent
 *
 * Analyzes visual content (images and videos) to extract:
 * - Subjects and objects
 * - Color palettes
 * - Composition style
 * - Mood and atmosphere
 * - Quality metrics
 * - Content categories
 *
 * @example
 * ```typescript
 * const agent = new VisionAnalyzerAgent();
 * const result = await agent.analyzeImage(base64Data, 'image/png', context, 'detailed');
 * if (result.success) {
 *   console.log('Subjects:', result.data.subjects);
 *   console.log('Mood:', result.data.mood);
 * }
 * ```
 */
export class VisionAnalyzerAgent extends HybeBaseAgent<VisionAnalyzerInput, VisionAnalyzerOutput> {
  constructor() {
    super(VisionAnalyzerConfig);
  }

  /**
   * Build the analysis prompt based on media type
   */
  protected buildPrompt(input: VisionAnalyzerInput, context: HybeAgentContext): string {
    const templateName = input.mediaType === 'video' ? 'video' : 'image';
    const template = this.getTemplate(templateName);

    return this.fillTemplate(template, {
      analysisDepth: input.analysisDepth,
      platform: context.workflow.platform || 'tiktok',
      language: context.workflow.language || 'en',
      focusAreas: input.focusAreas?.join(', ') || 'all aspects',
    });
  }

  /**
   * Convenience method to analyze an image
   *
   * @param imageData Base64 encoded image data
   * @param mimeType Image MIME type (e.g., 'image/png', 'image/jpeg')
   * @param context Agent context
   * @param depth Analysis depth
   */
  async analyzeImage(
    imageData: string,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
    context: HybeAgentContext,
    depth: 'quick' | 'standard' | 'detailed' = 'standard'
  ) {
    const mediaInput: MediaInput[] = [{ data: imageData, mimeType }];

    return this.executeWithMedia(
      {
        mediaType: 'image',
        analysisDepth: depth,
      },
      context,
      mediaInput
    );
  }

  /**
   * Convenience method to analyze a video
   *
   * @param videoData Base64 encoded video data or frames
   * @param mimeType Video MIME type
   * @param context Agent context
   * @param depth Analysis depth
   */
  async analyzeVideo(
    videoData: string,
    mimeType: 'video/mp4' | 'video/webm',
    context: HybeAgentContext,
    depth: 'quick' | 'standard' | 'detailed' = 'standard'
  ) {
    const mediaInput: MediaInput[] = [{ data: videoData, mimeType }];

    return this.executeWithMedia(
      {
        mediaType: 'video',
        analysisDepth: depth,
      },
      context,
      mediaInput
    );
  }

  /**
   * Analyze multiple images at once
   *
   * @param images Array of image data with MIME types
   * @param context Agent context
   * @param depth Analysis depth
   */
  async analyzeMultipleImages(
    images: Array<{ data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }>,
    context: HybeAgentContext,
    depth: 'quick' | 'standard' | 'detailed' = 'standard'
  ) {
    const mediaInput: MediaInput[] = images.map((img) => ({
      data: img.data,
      mimeType: img.mimeType,
    }));

    return this.executeWithMedia(
      {
        mediaType: 'image',
        analysisDepth: depth,
      },
      context,
      mediaInput
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a VisionAnalyzerAgent with optional configuration overrides
 */
export function createVisionAnalyzerAgent(options?: {
  provider?: 'gemini' | 'openai';
  model?: string;
  temperature?: number;
}): VisionAnalyzerAgent {
  // If custom options provided, we'd need to create a custom config
  // For now, return standard agent
  const agent = new VisionAnalyzerAgent();

  if (options?.temperature !== undefined) {
    // Could set reflection or other configs here
  }

  return agent;
}

// ============================================================================
// Export
// ============================================================================

export default VisionAnalyzerAgent;
