/**
 * Vision Analyzer Agent
 * ======================
 * Analyzes images/videos for visual elements: style, mood, colors, motion suggestions
 *
 * Model: Gemini 2.5 Flash (fast analysis, vision-capable)
 * Category: Analyzer
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext, VisionAnalysisSchema } from '../types';

// Input Schema
export const VisionAnalyzerInputSchema = z.object({
  mediaType: z.enum(['image', 'video']),
  mediaData: z.string().optional(), // base64 or URL
  analysisDepth: z.enum(['quick', 'detailed']).default('detailed'),
});

export type VisionAnalyzerInput = z.infer<typeof VisionAnalyzerInputSchema>;

// Output Schema
export const VisionAnalyzerOutputSchema = z.object({
  style_analysis: z.object({
    visual_style: z.string(),
    color_palette: z.array(z.string()),
    lighting: z.string(),
    mood: z.string(),
    composition: z.string(),
  }),
  content_analysis: z.object({
    main_subject: z.string(),
    setting: z.string(),
    props: z.array(z.string()),
  }),
  technical: z.object({
    brightness: z.number().min(0).max(1),
    complexity: z.number().min(0).max(1),
    suggested_motion: z.enum(['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'static']),
  }),
});

export type VisionAnalyzerOutput = z.infer<typeof VisionAnalyzerOutputSchema>;

// Agent Configuration
export const VisionAnalyzerConfig: AgentConfig<VisionAnalyzerInput, VisionAnalyzerOutput> = {
  id: 'vision-analyzer',
  name: 'Vision Analyzer Agent',
  description: '이미지/영상의 시각적 요소를 분석하여 스타일, 무드, 색상 등 추출',
  category: 'analyzer',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.3,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are a visual content analyst specializing in social media aesthetics.
Analyze visual content with precision and consistency.
Your analysis helps content creators understand visual trends and create engaging content.

Guidelines:
- Identify dominant visual styles (cinematic, minimalist, retro, neon, etc.)
- Extract color palettes as hex codes
- Describe lighting conditions accurately
- Assess emotional mood and atmosphere
- Suggest appropriate camera motions for video conversion

Always respond in valid JSON format matching the specified schema.`,

    templates: {
      image: `Analyze this image for social media content creation.

Analysis Type: {{analysisDepth}}

Provide comprehensive analysis including:
1. Visual Style - Describe the aesthetic approach
2. Color Palette - Extract 3-5 dominant hex colors
3. Lighting - Describe the lighting style and quality
4. Mood - Capture the emotional atmosphere
5. Composition - Describe the visual arrangement

For technical metrics:
- brightness: 0.0 (dark) to 1.0 (bright)
- complexity: 0.0 (simple) to 1.0 (complex)
- suggested_motion: Best camera motion for I2V conversion

Return JSON:
{
  "style_analysis": {
    "visual_style": "aesthetic description",
    "color_palette": ["#hex1", "#hex2", ...],
    "lighting": "lighting description",
    "mood": "emotional tone",
    "composition": "composition style"
  },
  "content_analysis": {
    "main_subject": "primary focus",
    "setting": "environment description",
    "props": ["notable objects"]
  },
  "technical": {
    "brightness": 0.0-1.0,
    "complexity": 0.0-1.0,
    "suggested_motion": "zoom_in|zoom_out|pan_left|pan_right|static"
  }
}`,

      video: `Analyze this video content for style extraction.

Analysis Type: {{analysisDepth}}

Analyze:
1. Dominant visual style throughout
2. Color grading and palette
3. Lighting consistency
4. Emotional arc and mood
5. Pacing and transition styles
6. Camera movement patterns

Return JSON with same schema as image analysis, with motion reflecting video's actual movement style.`,
    },
  },

  inputSchema: VisionAnalyzerInputSchema,
  outputSchema: VisionAnalyzerOutputSchema,
};

/**
 * Vision Analyzer Agent Implementation
 */
export class VisionAnalyzerAgent extends BaseAgent<VisionAnalyzerInput, VisionAnalyzerOutput> {
  constructor() {
    super(VisionAnalyzerConfig);
  }

  protected buildPrompt(input: VisionAnalyzerInput, context: AgentContext): string {
    const templateName = input.mediaType === 'video' ? 'video' : 'image';
    const template = this.getTemplate(templateName);

    return this.fillTemplate(template, {
      analysisDepth: input.analysisDepth,
      platform: context.workflow.platform,
      language: context.workflow.language,
    });
  }

  /**
   * Analyze image with base64 data
   */
  async analyzeImage(
    imageData: string,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/jpeg',
    context: AgentContext,
    depth: 'quick' | 'detailed' = 'detailed'
  ) {
    return this.executeWithImages(
      { mediaType: 'image', analysisDepth: depth },
      context,
      [{ data: imageData, mimeType }]
    );
  }
}

// Factory function
export function createVisionAnalyzerAgent(): VisionAnalyzerAgent {
  return new VisionAnalyzerAgent();
}
