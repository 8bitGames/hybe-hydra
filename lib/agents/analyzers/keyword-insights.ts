/**
 * Keyword Insights Agent
 * =======================
 * Generates AI-powered insights for TikTok keyword analysis
 *
 * Model: Gemini 3 Pro Preview (Google Search grounding)
 * Category: Analyzer
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext, AgentResult } from '../types';

// Input Schema
export const KeywordInsightsInputSchema = z.object({
  keyword: z.string(),
  totalVideos: z.number(),
  avgEngagementRate: z.number(),
  topHashtags: z.array(z.object({
    tag: z.string(),
    count: z.number(),
    avgEngagement: z.number(),
  })),
  viralDescriptions: z.array(z.string()),
  commonPhrases: z.array(z.object({
    pattern: z.string(),
    count: z.number(),
  })),
  topCreators: z.array(z.object({
    name: z.string(),
    avgEngagement: z.number(),
  })),
  emojiUsage: z.array(z.object({
    emoji: z.string(),
    count: z.number(),
  })),
});

export type KeywordInsightsInput = z.infer<typeof KeywordInsightsInputSchema>;

// Output Schema
export const KeywordInsightsOutputSchema = z.object({
  summary: z.string(),
  contentStrategy: z.array(z.string()),
  hashtagStrategy: z.array(z.string()),
  captionTemplates: z.array(z.string()),
  videoIdeas: z.array(z.string()),
  bestPostingAdvice: z.string(),
  audienceInsights: z.string(),
  trendPrediction: z.string(),
});

export type KeywordInsightsOutput = z.infer<typeof KeywordInsightsOutputSchema>;

// Agent Configuration
export const KeywordInsightsConfig: AgentConfig<KeywordInsightsInput, KeywordInsightsOutput> = {
  id: 'keyword-insights',
  name: 'Keyword Insights Agent',
  description: 'TikTok 키워드 분석 데이터를 기반으로 AI 인사이트 생성',
  category: 'analyzer',

  model: {
    provider: 'gemini',
    name: 'gemini-3-pro-preview',
    options: {
      temperature: 0.7,
      maxTokens: 4096,
      tools: [{ type: 'google_search' }],
      thinkingLevel: 'high',
    },
  },

  prompts: {
    system: `You are a TikTok content strategist analyzing trending data.
Your expertise includes:
- Understanding viral content patterns on TikTok
- Identifying high-performing hashtag strategies
- Crafting engaging caption templates
- Predicting trend trajectories
- Understanding audience behavior and preferences

Provide actionable, data-driven insights that content creators can immediately use.
Always respond in valid JSON format.`,

    templates: {
      analyze: `Analyze TikTok trending data for the keyword "{{keyword}}":

Analysis Data:
- Total Videos Analyzed: {{totalVideos}}
- Average Engagement Rate: {{avgEngagementRate}}%
- Top Hashtags: {{topHashtags}}
- Viral Video Captions: {{viralDescriptions}}
- Common Phrases: {{commonPhrases}}
- Popular Emojis: {{emojiUsage}}
- Top Creators: {{topCreators}}

Provide a comprehensive analysis in JSON format with these exact keys:
{
  "summary": "2-3 sentence executive summary of the trend's current state and opportunity",
  "contentStrategy": ["5 specific, actionable content strategies based on what's working"],
  "hashtagStrategy": ["5 strategic hashtag recommendations with reasoning"],
  "captionTemplates": ["3 caption templates that follow viral patterns - use [brackets] for customizable parts"],
  "videoIdeas": ["5 specific video concepts that would likely perform well"],
  "bestPostingAdvice": "Specific advice about timing, frequency, and approach",
  "audienceInsights": "Who is engaging with this content and what they want",
  "trendPrediction": "Where this trend is heading and how to stay ahead"
}

Be specific, data-driven, and actionable. Use insights from the actual data provided.`,
    },
  },

  inputSchema: KeywordInsightsInputSchema,
  outputSchema: KeywordInsightsOutputSchema,
};

/**
 * Keyword Insights Agent Implementation
 */
export class KeywordInsightsAgent extends BaseAgent<KeywordInsightsInput, KeywordInsightsOutput> {
  constructor() {
    super(KeywordInsightsConfig);
  }

  protected buildPrompt(input: KeywordInsightsInput, _context: AgentContext): string {
    const template = this.getTemplate('analyze');

    // Format top hashtags
    const topHashtagsStr = input.topHashtags
      .slice(0, 10)
      .map(h => `#${h.tag} (${h.count} videos, ${h.avgEngagement.toFixed(1)}% engagement)`)
      .join(", ");

    // Format viral descriptions
    const viralDescriptionsStr = input.viralDescriptions
      .slice(0, 5)
      .map(d => `"${d.slice(0, 100)}"`)
      .join("; ");

    // Format common phrases
    const commonPhrasesStr = input.commonPhrases
      .slice(0, 5)
      .map(p => `"${p.pattern}" (${p.count}x)`)
      .join(", ");

    // Format emoji usage
    const emojiUsageStr = input.emojiUsage
      .slice(0, 10)
      .map(e => e.emoji)
      .join(" ");

    // Format top creators
    const topCreatorsStr = input.topCreators
      .slice(0, 5)
      .map(c => `@${c.name} (${c.avgEngagement.toFixed(1)}% engagement)`)
      .join(", ");

    return this.fillTemplate(template, {
      keyword: input.keyword,
      totalVideos: input.totalVideos,
      avgEngagementRate: input.avgEngagementRate.toFixed(2),
      topHashtags: topHashtagsStr || 'N/A',
      viralDescriptions: viralDescriptionsStr || 'N/A',
      commonPhrases: commonPhrasesStr || 'N/A',
      emojiUsage: emojiUsageStr || 'N/A',
      topCreators: topCreatorsStr || 'N/A',
    });
  }

  /**
   * Analyze keyword data and generate insights
   */
  async analyze(
    input: KeywordInsightsInput,
    context: AgentContext
  ): Promise<AgentResult<KeywordInsightsOutput>> {
    return this.execute(input, context);
  }
}

// Singleton instance
let keywordInsightsAgent: KeywordInsightsAgent | null = null;

/**
 * Get or create the singleton KeywordInsightsAgent instance
 */
export function getKeywordInsightsAgent(): KeywordInsightsAgent {
  if (!keywordInsightsAgent) {
    keywordInsightsAgent = new KeywordInsightsAgent();
  }
  return keywordInsightsAgent;
}

/**
 * Factory function
 */
export function createKeywordInsightsAgent(): KeywordInsightsAgent {
  return new KeywordInsightsAgent();
}
