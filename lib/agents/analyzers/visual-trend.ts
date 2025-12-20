/**
 * Visual Trend Agent
 * ===================
 * Aggregates video analyses to identify visual trend patterns
 *
 * Model: Gemini 2.5 Flash
 * Category: Analyzer
 * Dependencies: vision-analyzer
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const VisualTrendInputSchema = z.object({
  videoAnalyses: z.array(z.object({
    id: z.string().optional(),
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
    }).optional(),
    technical: z.object({
      brightness: z.number(),
      complexity: z.number(),
      suggested_motion: z.string(),
    }).optional(),
    engagement: z.number().optional(),
  })),
});

export type VisualTrendInput = z.infer<typeof VisualTrendInputSchema>;

// Output Schema
export const VisualTrendOutputSchema = z.object({
  dominantStyles: z.array(z.object({
    style: z.string(),
    frequency: z.number().min(0).max(1),
    avgEngagement: z.number().optional(),
  })),
  colorTrends: z.array(z.object({
    palette: z.array(z.string()),
    usage: z.number().min(0).max(1),
  })),
  paceDistribution: z.object({
    slow: z.number(),
    medium: z.number(),
    fast: z.number(),
  }),
  effectsTrending: z.array(z.string()),
  promptTemplates: z.array(z.object({
    template: z.string(),
    style: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  moodAnalysis: z.object({
    dominant: z.string(),
    distribution: z.record(z.string(), z.number()),
  }).optional(),
});

export type VisualTrendOutput = z.infer<typeof VisualTrendOutputSchema>;

// Agent Configuration
export const VisualTrendConfig: AgentConfig<VisualTrendInput, VisualTrendOutput> = {
  id: 'visual-trend',
  name: 'Visual Trend Agent',
  description: '다수의 영상 분석 결과를 종합하여 시각적 트렌드 패턴 도출',
  category: 'analyzer',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.4,
      maxTokens: 8192,
    },
  },

  prompts: {
    system: `You are a visual trend analyst for social media content.
Aggregate individual video/image analyses into actionable trend patterns.
Identify what visual styles, colors, and effects are performing well.

Your expertise includes:
- Pattern recognition across multiple visual analyses
- Trend frequency and engagement correlation
- Color palette trend identification
- Video prompt template generation from successful patterns

Focus on actionable insights that content creators can apply.
Always respond in valid JSON format.`,

    templates: {
      aggregate: `Aggregate these video/image analysis results into trend patterns:

VIDEO ANALYSES:
{{videoAnalyses}}

PLATFORM: {{platform}}

Analyze:
1. Identify dominant visual styles and their frequency
2. Extract trending color palettes
3. Determine pace preferences (slow/medium/fast)
4. List trending effects and transitions
5. Generate reusable prompt templates

Return JSON:
{
  "dominantStyles": [
    {
      "style": "style name",
      "frequency": 0.0-1.0,
      "avgEngagement": optional number
    }
  ],
  "colorTrends": [
    {
      "palette": ["#hex1", "#hex2", ...],
      "usage": 0.0-1.0
    }
  ],
  "paceDistribution": {
    "slow": 0.0-1.0,
    "medium": 0.0-1.0,
    "fast": 0.0-1.0
  },
  "effectsTrending": ["effect1", "effect2", ...],
  "promptTemplates": [
    {
      "template": "A prompt template capturing this trend style...",
      "style": "style name",
      "confidence": 0.0-1.0
    }
  ],
  "moodAnalysis": {
    "dominant": "most common mood",
    "distribution": { "mood1": 0.3, "mood2": 0.5, ... }
  }
}`,
    },
  },

  inputSchema: VisualTrendInputSchema,
  outputSchema: VisualTrendOutputSchema,
  dependencies: ['vision-analyzer'],
};

/**
 * Visual Trend Agent Implementation
 */
export class VisualTrendAgent extends BaseAgent<VisualTrendInput, VisualTrendOutput> {
  constructor() {
    super(VisualTrendConfig);
  }

  protected buildPrompt(input: VisualTrendInput, context: AgentContext): string {
    const template = this.getTemplate('aggregate');

    return this.fillTemplate(template, {
      videoAnalyses: JSON.stringify(input.videoAnalyses, null, 2),
      platform: context.workflow.platform,
    });
  }

  /**
   * Aggregate multiple vision analyses into trend patterns
   */
  async aggregateAnalyses(
    analyses: VisualTrendInput['videoAnalyses'],
    context: AgentContext
  ) {
    return this.execute({ videoAnalyses: analyses }, context);
  }
}

// Factory function
export function createVisualTrendAgent(): VisualTrendAgent {
  return new VisualTrendAgent();
}
