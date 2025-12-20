/**
 * Text Pattern Agent
 * ===================
 * Analyzes hashtags, captions, and text trends for patterns and sentiment
 *
 * Model: Gemini 2.5 Flash (fast analysis)
 * Category: Analyzer
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const TextPatternInputSchema = z.object({
  analysisType: z.enum(['cluster', 'sentiment', 'templates']),
  hashtags: z.array(z.string()).optional(),
  texts: z.array(z.string()).optional(),
  patterns: z.record(z.string(), z.unknown()).optional(),
});

export type TextPatternInput = z.infer<typeof TextPatternInputSchema>;

// Output Schema
export const TextPatternOutputSchema = z.object({
  clusters: z.array(z.object({
    name: z.string(),
    hashtags: z.array(z.string()),
    avgEngagement: z.number().optional(),
    trendDirection: z.enum(['rising', 'stable', 'declining']),
  })).optional(),
  outliers: z.array(z.string()).optional(),
  sentiment: z.object({
    overall: z.enum(['positive', 'neutral', 'negative']),
    score: z.number().min(-1).max(1),
    emotions: z.array(z.string()),
  }).optional(),
  captionTemplates: z.array(z.object({
    template: z.string(),
    category: z.string(),
    engagementPotential: z.enum(['high', 'medium', 'low']),
  })).optional(),
});

export type TextPatternOutput = z.infer<typeof TextPatternOutputSchema>;

// Agent Configuration
export const TextPatternConfig: AgentConfig<TextPatternInput, TextPatternOutput> = {
  id: 'text-pattern',
  name: 'Text Pattern Agent',
  description: '해시태그, 캡션, 텍스트 트렌드의 패턴과 감성 분석',
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
    system: `You are a social media text analyst specializing in trend pattern recognition.
Identify patterns, clusters, and sentiment in text data.
Focus on actionable insights for content creation.

Your expertise includes:
- Hashtag clustering by theme and engagement potential
- Sentiment analysis of captions and comments
- Caption template generation from successful patterns
- Trend direction prediction based on usage patterns

Always respond in valid JSON format.`,

    templates: {
      cluster: `Group these hashtags into meaningful thematic clusters:

HASHTAGS:
{{hashtags}}

Analyze:
1. Identify common themes and group hashtags
2. Assess trend direction for each cluster
3. Identify outlier hashtags that don't fit clusters

Return JSON:
{
  "clusters": [
    {
      "name": "cluster theme name",
      "hashtags": ["tag1", "tag2", ...],
      "avgEngagement": 0,
      "trendDirection": "rising|stable|declining"
    }
  ],
  "outliers": ["unclustered tags"]
}`,

      sentiment: `Analyze the sentiment of these texts:

TEXTS:
{{texts}}

Analyze:
1. Overall sentiment direction
2. Sentiment score (-1 to 1)
3. Specific emotions detected

Return JSON:
{
  "sentiment": {
    "overall": "positive|neutral|negative",
    "score": -1.0 to 1.0,
    "emotions": ["joy", "excitement", "nostalgia", etc.]
  }
}`,

      templates: `Based on these trending text patterns, generate viral caption templates:

PATTERNS:
{{patterns}}

PLATFORM: {{platform}}
LANGUAGE: {{language}}

Generate 5 caption templates that:
1. Follow successful engagement patterns
2. Include {{placeholder}} markers for customization
3. Are appropriate for the platform
4. Feel authentic and engaging

Return JSON:
{
  "captionTemplates": [
    {
      "template": "Template with {{placeholders}}...",
      "category": "hook|story|cta|question",
      "engagementPotential": "high|medium|low"
    }
  ]
}`,
    },
  },

  inputSchema: TextPatternInputSchema,
  outputSchema: TextPatternOutputSchema,
};

/**
 * Text Pattern Agent Implementation
 */
export class TextPatternAgent extends BaseAgent<TextPatternInput, TextPatternOutput> {
  constructor() {
    super(TextPatternConfig);
  }

  protected buildPrompt(input: TextPatternInput, context: AgentContext): string {
    const template = this.getTemplate(input.analysisType);

    return this.fillTemplate(template, {
      hashtags: input.hashtags?.join('\n') || '',
      texts: input.texts?.join('\n\n---\n\n') || '',
      patterns: input.patterns || {},
      platform: context.workflow.platform,
      language: context.workflow.language,
    });
  }

  /**
   * Cluster hashtags into thematic groups
   */
  async clusterHashtags(
    hashtags: string[],
    context: AgentContext
  ) {
    return this.execute(
      { analysisType: 'cluster', hashtags },
      context
    );
  }

  /**
   * Analyze sentiment of texts
   */
  async analyzeSentiment(
    texts: string[],
    context: AgentContext
  ) {
    return this.execute(
      { analysisType: 'sentiment', texts },
      context
    );
  }

  /**
   * Generate caption templates from patterns
   */
  async generateTemplates(
    patterns: Record<string, unknown>,
    context: AgentContext
  ) {
    return this.execute(
      { analysisType: 'templates', patterns },
      context
    );
  }
}

// Factory function
export function createTextPatternAgent(): TextPatternAgent {
  return new TextPatternAgent();
}
