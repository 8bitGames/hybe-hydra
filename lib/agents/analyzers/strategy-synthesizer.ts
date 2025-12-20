/**
 * Strategy Synthesizer Agent
 * ===========================
 * Synthesizes text and visual trends into unified content strategy
 *
 * Model: Gemini 2.5 Flash
 * Category: Analyzer
 * Dependencies: text-pattern, visual-trend
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext, ContentStrategy } from '../types';

// Input Schema
export const StrategySynthesizerInputSchema = z.object({
  textAnalysis: z.object({
    clusters: z.array(z.object({
      name: z.string(),
      hashtags: z.array(z.string()),
      trendDirection: z.enum(['rising', 'stable', 'declining']),
    })).optional(),
    sentiment: z.object({
      overall: z.enum(['positive', 'neutral', 'negative']),
      score: z.number(),
      emotions: z.array(z.string()),
    }).optional(),
  }),
  visualAnalysis: z.object({
    dominantStyles: z.array(z.object({
      style: z.string(),
      frequency: z.number(),
    })),
    colorTrends: z.array(z.object({
      palette: z.array(z.string()),
      usage: z.number(),
    })),
    effectsTrending: z.array(z.string()),
    promptTemplates: z.array(z.object({
      template: z.string(),
      style: z.string(),
      confidence: z.number(),
    })),
  }),
  benchmarks: z.object({
    avgViews: z.number().optional(),
    avgEngagement: z.number().optional(),
    topPerformers: z.array(z.string()).optional(),
  }).optional(),
});

export type StrategySynthesizerInput = z.infer<typeof StrategySynthesizerInputSchema>;

// Output Schema
export const StrategySynthesizerOutputSchema = z.object({
  contentThemes: z.array(z.object({
    theme: z.string(),
    priority: z.number().min(1).max(5),
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
  bestPractices: z.array(z.string()),
  avoid: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
});

export type StrategySynthesizerOutput = z.infer<typeof StrategySynthesizerOutputSchema>;

// Agent Configuration
export const StrategySynthesizerConfig: AgentConfig<StrategySynthesizerInput, StrategySynthesizerOutput> = {
  id: 'strategy-synthesizer',
  name: 'Strategy Synthesizer Agent',
  description: '텍스트 + 시각 트렌드를 종합하여 통합 콘텐츠 전략 도출',
  category: 'analyzer',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.5,
      maxTokens: 8192,
    },
  },

  prompts: {
    system: `You are a content strategist synthesizing multi-modal trend data.
Create actionable content strategies from text and visual trend analyses.
Balance creativity with data-driven insights.

Your expertise includes:
- Cross-referencing text and visual patterns
- Prioritizing content themes by potential impact
- Creating specific, actionable guidelines
- Identifying what to avoid based on underperforming patterns

Focus on practical recommendations that content creators can implement immediately.
Always respond in valid JSON format.`,

    templates: {
      synthesize: `Synthesize these trend analyses into a unified content strategy:

TEXT TRENDS:
{{textAnalysis}}

VISUAL TRENDS:
{{visualAnalysis}}

PERFORMANCE BENCHMARKS:
{{benchmarks}}

PLATFORM: {{platform}}
LANGUAGE: {{language}}

Create a comprehensive strategy that:
1. Identifies top content themes with clear priorities
2. Provides specific visual guidelines (styles, colors, pace, effects)
3. Recommends caption approaches (hooks, CTAs, hashtags)
4. Lists best practices from successful content
5. Warns about patterns to avoid

Return JSON:
{
  "contentThemes": [
    {
      "theme": "theme description",
      "priority": 1-5,
      "rationale": "why this theme matters"
    }
  ],
  "visualGuidelines": {
    "styles": ["recommended styles"],
    "colors": ["recommended color hex codes"],
    "pace": "slow|medium|fast",
    "effects": ["recommended effects"]
  },
  "captionGuidelines": {
    "hooks": ["scroll-stopping hook examples"],
    "ctas": ["effective CTA examples"],
    "hashtags": ["recommended hashtags"]
  },
  "bestPractices": ["actionable best practice tips"],
  "avoid": ["things to avoid based on data"],
  "confidenceScore": 0.0-1.0
}`,
    },
  },

  inputSchema: StrategySynthesizerInputSchema,
  outputSchema: StrategySynthesizerOutputSchema,
  dependencies: ['text-pattern', 'visual-trend'],
};

/**
 * Strategy Synthesizer Agent Implementation
 */
export class StrategySynthesizerAgent extends BaseAgent<StrategySynthesizerInput, StrategySynthesizerOutput> {
  constructor() {
    super(StrategySynthesizerConfig);
  }

  protected buildPrompt(input: StrategySynthesizerInput, context: AgentContext): string {
    const template = this.getTemplate('synthesize');

    return this.fillTemplate(template, {
      textAnalysis: JSON.stringify(input.textAnalysis, null, 2),
      visualAnalysis: JSON.stringify(input.visualAnalysis, null, 2),
      benchmarks: JSON.stringify(input.benchmarks || {}, null, 2),
      platform: context.workflow.platform,
      language: context.workflow.language,
    });
  }

  /**
   * Create unified strategy from text and visual analyses
   */
  async synthesize(
    textAnalysis: StrategySynthesizerInput['textAnalysis'],
    visualAnalysis: StrategySynthesizerInput['visualAnalysis'],
    context: AgentContext,
    benchmarks?: StrategySynthesizerInput['benchmarks']
  ) {
    return this.execute(
      { textAnalysis, visualAnalysis, benchmarks },
      context
    );
  }
}

// Factory function
export function createStrategySynthesizerAgent(): StrategySynthesizerAgent {
  return new StrategySynthesizerAgent();
}
