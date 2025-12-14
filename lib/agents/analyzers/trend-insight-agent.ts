/**
 * Trend Insight Agent
 * ====================
 * 트렌드 탐색 결과를 분석하여 AI 인사이트 생성
 *
 * Model: Gemini 2.5 Flash (빠른 분석, 비용 효율)
 * Category: Analyzer
 *
 * 입력: 발견된 키워드들, 네트워크 요약, 크리에이터 정보
 * 출력: 카테고리 그룹핑, 인사이트, 콘텐츠 추천, 성장 예측
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext, AgentResult } from '../types';

// ============================================================================
// Input Schema
// ============================================================================

const DiscoveryInputSchema = z.object({
  keyword: z.string(),
  noveltyScore: z.number(),
  popularityScore: z.number(),
  avgEngagement: z.number(),
  avgViews: z.number(),
  discoveryPath: z.array(z.string()),
  isTrending: z.boolean(),
});

const CreatorInputSchema = z.object({
  username: z.string(),
  videoCount: z.number(),
  avgEngagement: z.number(),
});

const NetworkSummarySchema = z.object({
  totalNodes: z.number(),
  totalEdges: z.number(),
  hubKeywords: z.array(z.string()),
});

export const TrendInsightInputSchema = z.object({
  seedKeyword: z.string(),
  discoveries: z.array(DiscoveryInputSchema),
  topCreators: z.array(CreatorInputSchema),
  networkSummary: NetworkSummarySchema,
  explorationDepth: z.number(),
  strategy: z.enum(['novelty', 'popularity', 'balanced']),
});

export type TrendInsightInput = z.infer<typeof TrendInsightInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

const CategorySchema = z.object({
  name: z.string(),
  keywords: z.array(z.string()),
  description: z.string(),
});

const InsightSchema = z.object({
  type: z.enum(['opportunity', 'warning', 'pattern']),
  title: z.string(),
  description: z.string(),
  relatedKeywords: z.array(z.string()),
});

const ContentRecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  suggestedKeywords: z.array(z.string()),
  targetAudience: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

const PredictionSchema = z.object({
  keyword: z.string(),
  potential: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
});

export const TrendInsightOutputSchema = z.object({
  summary: z.string(),
  categories: z.array(CategorySchema),
  insights: z.array(InsightSchema),
  contentRecommendations: z.array(ContentRecommendationSchema),
  predictions: z.array(PredictionSchema),
});

export type TrendInsightOutput = z.infer<typeof TrendInsightOutputSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

export const TrendInsightConfig: AgentConfig<TrendInsightInput, TrendInsightOutput> = {
  id: 'trend-insight',
  name: 'Trend Insight Agent',
  description: '트렌드 탐색 결과를 분석하여 인사이트, 카테고리, 콘텐츠 추천 생성',
  category: 'analyzer',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are a TikTok trend analyst expert specializing in discovering emerging content opportunities.

Your expertise includes:
- Analyzing hashtag patterns and categorizing them semantically
- Identifying content opportunities and market gaps
- Understanding TikTok algorithm and viral mechanics
- Predicting trend growth trajectories
- Recommending actionable content strategies

Guidelines:
- Be specific and actionable in recommendations
- Focus on practical insights creators can immediately use
- Consider both novelty (new opportunities) and popularity (proven performers)
- Explain WHY certain keywords/trends are significant
- Always respond in valid JSON format
- Use Korean for the summary and descriptions`,

    templates: {
      analyze: `Analyze the following TikTok trend exploration results for "{{seedKeyword}}":

## Discovered Keywords (Top 20)
{{discoveries}}

## Top Creators in This Space
{{topCreators}}

## Network Summary
- Total unique keywords: {{totalNodes}}
- Connections between keywords: {{totalEdges}}
- Hub keywords (most connected): {{hubKeywords}}

## Exploration Info
- Depth: {{explorationDepth}} levels from seed
- Strategy: {{strategy}}

---

Provide comprehensive analysis in this exact JSON format:
{
  "summary": "2-3 sentence executive summary in Korean describing the overall trend landscape and key opportunities",
  "categories": [
    {
      "name": "Category name (in Korean)",
      "keywords": ["#keyword1", "#keyword2", ...],
      "description": "What this category represents and why it matters (in Korean)"
    }
  ],
  "insights": [
    {
      "type": "opportunity|warning|pattern",
      "title": "Insight title (in Korean)",
      "description": "Detailed explanation (in Korean)",
      "relatedKeywords": ["#keyword1", "#keyword2"]
    }
  ],
  "contentRecommendations": [
    {
      "title": "Content idea title (in Korean)",
      "description": "How to execute this content (in Korean)",
      "suggestedKeywords": ["#keyword1", "#keyword2"],
      "targetAudience": "Who this content is for (in Korean)",
      "difficulty": "easy|medium|hard"
    }
  ],
  "predictions": [
    {
      "keyword": "#keyword",
      "potential": "high|medium|low",
      "reason": "Why this keyword has growth potential (in Korean)"
    }
  ]
}

Requirements:
- Create 3-5 meaningful categories
- Provide 3-5 actionable insights
- Generate 3-5 content recommendations
- Make 3-5 growth predictions for the most promising keywords
- Focus on keywords with high novelty scores as emerging opportunities
- Focus on keywords with high popularity scores as proven performers`,
    },
  },

  inputSchema: TrendInsightInputSchema,
  outputSchema: TrendInsightOutputSchema,
};

// ============================================================================
// Agent Implementation
// ============================================================================

export class TrendInsightAgent extends BaseAgent<TrendInsightInput, TrendInsightOutput> {
  constructor() {
    super(TrendInsightConfig);
  }

  protected buildPrompt(input: TrendInsightInput, _context: AgentContext): string {
    const template = this.getTemplate('analyze');

    // Format discoveries
    const discoveriesStr = input.discoveries
      .map((d, i) => {
        const path = d.discoveryPath.join(' → ');
        return `${i + 1}. ${d.keyword}
   - Novelty: ${d.noveltyScore}/100, Popularity: ${d.popularityScore}/100
   - Engagement: ${d.avgEngagement.toFixed(2)}%, Views: ${this.formatNumber(d.avgViews)}
   - Discovery path: ${path}
   - Trending: ${d.isTrending ? 'Yes' : 'No'}`;
      })
      .join('\n\n');

    // Format creators
    const creatorsStr = input.topCreators
      .map((c, i) => `${i + 1}. @${c.username} (${c.videoCount} videos, ${c.avgEngagement.toFixed(2)}% engagement)`)
      .join('\n');

    // Format hub keywords
    const hubKeywordsStr = input.networkSummary.hubKeywords.join(', ');

    return this.fillTemplate(template, {
      seedKeyword: input.seedKeyword,
      discoveries: discoveriesStr,
      topCreators: creatorsStr,
      totalNodes: input.networkSummary.totalNodes,
      totalEdges: input.networkSummary.totalEdges,
      hubKeywords: hubKeywordsStr || 'N/A',
      explorationDepth: input.explorationDepth,
      strategy: input.strategy,
    });
  }

  /**
   * Format large numbers for readability
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  /**
   * Analyze trend exploration results
   */
  async analyze(
    input: TrendInsightInput,
    context: AgentContext
  ): Promise<AgentResult<TrendInsightOutput>> {
    return this.execute(input, context);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let trendInsightAgent: TrendInsightAgent | null = null;

/**
 * Get or create the singleton TrendInsightAgent instance
 */
export function getTrendInsightAgent(): TrendInsightAgent {
  if (!trendInsightAgent) {
    trendInsightAgent = new TrendInsightAgent();
  }
  return trendInsightAgent;
}

/**
 * Factory function
 */
export function createTrendInsightAgent(): TrendInsightAgent {
  return new TrendInsightAgent();
}
