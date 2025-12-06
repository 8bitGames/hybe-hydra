/**
 * Publish Optimizer Agent
 * =======================
 * Optimizes content for platform-specific publishing requirements
 *
 * Model: GPT-5.1
 * Category: Publisher
 *
 * Key Responsibilities:
 * - Platform-specific format optimization
 * - Posting time recommendations
 * - Content scheduling strategy
 * - A/B testing suggestions
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const PublishOptimizerInputSchema = z.object({
  content: z.object({
    title: z.string().optional(),
    description: z.string(),
    hashtags: z.array(z.string()),
    videoUrl: z.string().optional(),
    thumbnailUrl: z.string().optional(),
  }),
  platform: z.enum(['tiktok', 'instagram', 'youtube_shorts', 'all']),
  targetAudience: z.object({
    region: z.string().default('KR'),
    ageRange: z.string().optional(),
    interests: z.array(z.string()).optional(),
  }).optional(),
  publishingGoal: z.enum(['engagement', 'reach', 'conversion', 'brand_awareness']).default('engagement'),
});

export type PublishOptimizerInput = z.infer<typeof PublishOptimizerInputSchema>;

// Output Schema
export const PublishOptimizerOutputSchema = z.object({
  optimizedContent: z.object({
    title: z.string().optional(),
    description: z.string(),
    hashtags: z.array(z.string()),
    callToAction: z.string(),
  }),
  publishingStrategy: z.object({
    bestTimes: z.array(z.object({
      day: z.string(),
      time: z.string(),
      timezone: z.string(),
      reasoning: z.string(),
    })),
    frequency: z.string(),
    contentMix: z.array(z.object({
      type: z.string(),
      percentage: z.number(),
    })),
  }),
  platformSpecific: z.object({
    tiktok: z.object({
      soundRecommendation: z.string().optional(),
      duetEnabled: z.boolean(),
      stitchEnabled: z.boolean(),
      comments: z.enum(['all', 'friends', 'off']),
    }).optional(),
    instagram: z.object({
      reelsBonus: z.boolean().optional(),
      collaborators: z.array(z.string()).optional(),
      location: z.string().optional(),
    }).optional(),
    youtubeShorts: z.object({
      addToPlaylist: z.string().optional(),
      endScreen: z.boolean(),
      cards: z.boolean(),
    }).optional(),
  }),
  abTestSuggestions: z.array(z.object({
    element: z.string(),
    variantA: z.string(),
    variantB: z.string(),
    hypothesis: z.string(),
  })),
  predictedPerformance: z.object({
    engagementRate: z.string(),
    reachPotential: z.string(),
    viralProbability: z.string(),
    confidenceLevel: z.number().min(0).max(1),
  }),
});

export type PublishOptimizerOutput = z.infer<typeof PublishOptimizerOutputSchema>;

// Agent Configuration
export const PublishOptimizerConfig: AgentConfig<PublishOptimizerInput, PublishOptimizerOutput> = {
  id: 'publish-optimizer',
  name: 'Publish Optimizer Agent',
  description: '플랫폼별 게시 최적화 및 전략 수립',
  category: 'publisher',

  model: {
    provider: 'openai',
    name: 'gpt-5.1',
    options: {
      temperature: 0.6,
      maxTokens: 4096,
      reasoningEffort: 'medium',
    },
  },

  prompts: {
    system: `You are a social media publishing strategist specializing in K-pop and entertainment content.
Your expertise spans TikTok, Instagram Reels, and YouTube Shorts optimization.

## Core Competencies:
1. Platform Algorithm Understanding
   - TikTok: For You Page optimization, trending sounds, engagement hooks
   - Instagram: Reels algorithm, hashtag strategy, collaboration features
   - YouTube Shorts: Search optimization, end screens, playlist strategy

2. Audience Behavior Analysis
   - Peak engagement times by region and demographic
   - Content consumption patterns
   - Viral trigger identification

3. A/B Testing Strategy
   - Element isolation for testing
   - Statistical significance considerations
   - Iterative optimization approach

## Guidelines:
- Prioritize authenticity over viral tactics
- Consider platform-specific community guidelines
- Respect HYBE brand standards
- Focus on sustainable growth over short-term spikes

Always respond in valid JSON format.`,

    templates: {
      optimize: `Optimize this content for {{platform}} publishing:

CONTENT:
Title: {{title}}
Description: {{description}}
Hashtags: {{hashtags}}

TARGET AUDIENCE:
Region: {{region}}
Age Range: {{ageRange}}
Interests: {{interests}}

PUBLISHING GOAL: {{publishingGoal}}

ARTIST CONTEXT: {{artistName}}

Provide comprehensive publishing optimization:

1. OPTIMIZED CONTENT
   - Refined description with platform-specific formatting
   - Optimized hashtag selection (mix of trending + niche)
   - Compelling call-to-action

2. PUBLISHING STRATEGY
   - Best posting times with reasoning
   - Recommended posting frequency
   - Content mix recommendations

3. PLATFORM-SPECIFIC SETTINGS
   - Feature recommendations (duet, stitch, collaboration, etc.)
   - Privacy and engagement settings

4. A/B TEST SUGGESTIONS
   - 2-3 testable elements
   - Clear variants and hypotheses

5. PERFORMANCE PREDICTION
   - Expected engagement metrics
   - Viral probability assessment

Return JSON:
{
  "optimizedContent": {
    "title": "optimized title if applicable",
    "description": "platform-optimized description",
    "hashtags": ["optimized", "hashtag", "list"],
    "callToAction": "engaging CTA"
  },
  "publishingStrategy": {
    "bestTimes": [
      {
        "day": "day of week",
        "time": "HH:MM",
        "timezone": "timezone",
        "reasoning": "why this time"
      }
    ],
    "frequency": "recommended posting frequency",
    "contentMix": [
      {"type": "content type", "percentage": 0-100}
    ]
  },
  "platformSpecific": {
    "tiktok": {...},
    "instagram": {...},
    "youtubeShorts": {...}
  },
  "abTestSuggestions": [
    {
      "element": "what to test",
      "variantA": "first variant",
      "variantB": "second variant",
      "hypothesis": "expected outcome"
    }
  ],
  "predictedPerformance": {
    "engagementRate": "expected rate",
    "reachPotential": "reach estimate",
    "viralProbability": "low/medium/high",
    "confidenceLevel": 0.0-1.0
  }
}`,
    },
  },

  inputSchema: PublishOptimizerInputSchema,
  outputSchema: PublishOptimizerOutputSchema,
  dependencies: ['creative-director'],
};

/**
 * Publish Optimizer Agent Implementation
 */
export class PublishOptimizerAgent extends BaseAgent<PublishOptimizerInput, PublishOptimizerOutput> {
  constructor() {
    super(PublishOptimizerConfig);
  }

  protected buildPrompt(input: PublishOptimizerInput, context: AgentContext): string {
    const template = this.getTemplate('optimize');

    return this.fillTemplate(template, {
      platform: input.platform,
      title: input.content.title || 'N/A',
      description: input.content.description,
      hashtags: input.content.hashtags.join(', '),
      region: input.targetAudience?.region || 'KR',
      ageRange: input.targetAudience?.ageRange || 'All ages',
      interests: input.targetAudience?.interests?.join(', ') || 'K-pop, Entertainment',
      publishingGoal: input.publishingGoal,
      artistName: context.workflow.artistName,
    });
  }

  /**
   * Optimize content for publishing
   */
  async optimize(
    content: PublishOptimizerInput['content'],
    platform: PublishOptimizerInput['platform'],
    context: AgentContext,
    options?: {
      targetAudience?: PublishOptimizerInput['targetAudience'];
      publishingGoal?: PublishOptimizerInput['publishingGoal'];
    }
  ) {
    return this.execute(
      {
        content,
        platform,
        targetAudience: options?.targetAudience,
        publishingGoal: options?.publishingGoal || 'engagement',
      },
      context
    );
  }

  /**
   * Get optimal posting times for a specific platform and region
   */
  async getOptimalTimes(
    platform: PublishOptimizerInput['platform'],
    region: string,
    context: AgentContext
  ) {
    const result = await this.execute(
      {
        content: {
          description: 'General content timing analysis',
          hashtags: [],
        },
        platform,
        targetAudience: { region },
        publishingGoal: 'reach',
      },
      context
    );

    return result.success ? result.data?.publishingStrategy.bestTimes : null;
  }
}

// Factory function
export function createPublishOptimizerAgent(): PublishOptimizerAgent {
  return new PublishOptimizerAgent();
}
