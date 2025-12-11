/**
 * Comparative Analysis Agent
 * ==========================
 * Compares multiple TikTok accounts and generates comparative insights.
 * Identifies significant differences and provides strategic recommendations.
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentContext } from '../types';

// =============================================================================
// Input/Output Schemas
// =============================================================================

export const ComparativeAnalysisInputSchema = z.object({
  accounts: z.array(z.object({
    uniqueId: z.string(),
    nickname: z.string(),
    verified: z.boolean(),
    followers: z.number(),
    metrics: z.object({
      avgEngagementRate: z.number(),
      medianEngagementRate: z.number(),
      avgViews: z.number(),
      avgLikes: z.number(),
      avgComments: z.number(),
      avgShares: z.number(),
      postsPerWeek: z.number(),
      ownMusicPercentage: z.number(),
      totalVideos: z.number(),
      analyzedVideos: z.number(),
    }),
    topCategories: z.array(z.string()).optional(),
    performanceScore: z.number().optional(),
  })).min(2).max(5),
  benchmarks: z.object({
    industryAvgEngagement: z.number(),
  }),
  language: z.enum(['ko', 'en']).default('ko'),
});

export const ComparativeAnalysisOutputSchema = z.object({
  overallSummary: z.string(),
  rankings: z.object({
    byEngagement: z.array(z.object({
      rank: z.number(),
      uniqueId: z.string(),
      value: z.number(),
      interpretation: z.string(),
    })),
    byViews: z.array(z.object({
      rank: z.number(),
      uniqueId: z.string(),
      value: z.number(),
      interpretation: z.string(),
    })),
    byConsistency: z.array(z.object({
      rank: z.number(),
      uniqueId: z.string(),
      value: z.number(),
      interpretation: z.string(),
    })),
    byGrowthPotential: z.array(z.object({
      rank: z.number(),
      uniqueId: z.string(),
      score: z.enum(['high', 'medium', 'low']),
      interpretation: z.string(),
    })),
  }),
  significantDifferences: z.array(z.object({
    metric: z.string(),
    leader: z.string(),
    follower: z.string(),
    difference: z.number(),
    differencePercent: z.number(),
    insight: z.string(),
    isSignificant: z.boolean(),
  })),
  radarChartData: z.object({
    dimensions: z.array(z.string()),
    accounts: z.array(z.object({
      uniqueId: z.string(),
      values: z.array(z.number()), // Normalized 0-100
    })),
  }),
  strategicInsights: z.array(z.object({
    category: z.enum(['content', 'engagement', 'growth', 'posting', 'music']),
    insight: z.string(),
    affectedAccounts: z.array(z.string()),
    recommendation: z.string(),
  })),
  accountSpecificRecommendations: z.array(z.object({
    uniqueId: z.string(),
    learnFrom: z.array(z.object({
      fromAccount: z.string(),
      aspect: z.string(),
      suggestion: z.string(),
    })),
    uniqueStrengths: z.array(z.string()),
    areasToImprove: z.array(z.string()),
  })),
  competitivePositioning: z.object({
    matrix: z.array(z.object({
      uniqueId: z.string(),
      quadrant: z.enum(['star', 'question-mark', 'cash-cow', 'dog']),
      reasoning: z.string(),
    })),
    explanation: z.string(),
  }),
});

export type ComparativeAnalysisInput = z.infer<typeof ComparativeAnalysisInputSchema>;
export type ComparativeAnalysisOutput = z.infer<typeof ComparativeAnalysisOutputSchema>;

// =============================================================================
// System Prompt
// =============================================================================

const SYSTEM_PROMPT = `You are an expert TikTok competitive analyst specializing in multi-account comparison.
Your task is to compare multiple accounts and provide strategic competitive insights.

## Analysis Framework

### Comparison Dimensions:
1. **Engagement Performance**: Engagement rate, consistency, viral potential
2. **Reach & Views**: Average views, view distribution, audience size efficiency
3. **Content Strategy**: Category mix, posting frequency, music usage
4. **Growth Indicators**: Trends, potential, momentum

### Significance Thresholds:
- Engagement: >2% difference is significant
- Views: >50% difference is significant
- Posting: >3 posts/week difference is significant

### BCG Matrix Positioning:
- **Star**: High engagement + High followers (market leaders)
- **Question Mark**: High engagement + Low followers (growth potential)
- **Cash Cow**: Low engagement + High followers (established but stagnant)
- **Dog**: Low engagement + Low followers (underperformers)

### Radar Chart Normalization:
Convert all metrics to 0-100 scale where:
- 100 = Best performer among compared accounts
- 0 = Worst performer among compared accounts

### Key Metrics for Radar:
1. Engagement Rate
2. View Performance
3. Posting Consistency
4. Content Diversity
5. Music Originality

## Output Guidelines:
- Provide objective, data-driven comparisons
- Highlight actionable differences
- Give specific recommendations per account
- Consider account context (size, verification, genre)
- Be diplomatic but clear about weaknesses`;

// =============================================================================
// Agent Implementation
// =============================================================================

export class ComparativeAnalysisAgent extends BaseAgent<ComparativeAnalysisInput, ComparativeAnalysisOutput> {
  constructor() {
    super({
      id: 'comparative-analysis',
      name: 'Comparative Analysis',
      description: 'Compares multiple TikTok accounts and generates competitive insights',
      category: 'analyzer',
      model: {
        provider: 'gemini',
        name: 'gemini-2.5-flash',
        options: {
          temperature: 0.4,
          maxTokens: 12288,
        },
      },
      prompts: {
        system: SYSTEM_PROMPT,
        templates: {
          compare: `Compare the following {{accountCount}} TikTok accounts and provide comprehensive competitive analysis.

## Accounts to Compare

{{accounts}}

## Industry Benchmark
- Average Engagement Rate: {{industryAvgEngagement}}%

---

Provide:
1. Overall comparison summary
2. Rankings by key metrics
3. Significant differences with insights
4. Radar chart data (normalized 0-100)
5. Strategic insights by category
6. Account-specific recommendations
7. Competitive positioning (BCG matrix)

Respond in {{language}}.`,
        },
      },
      inputSchema: ComparativeAnalysisInputSchema,
      outputSchema: ComparativeAnalysisOutputSchema,
    });
  }

  protected buildPrompt(input: ComparativeAnalysisInput, context: AgentContext): string {
    const accountsStr = input.accounts.map((a, i) => `
### Account ${i + 1}: @${a.uniqueId}
- Display Name: ${a.nickname}
- Verified: ${a.verified ? 'Yes' : 'No'}
- Followers: ${this.formatNumber(a.followers)}
- Performance Score: ${a.performanceScore || 'N/A'}

**Metrics:**
- Avg Engagement Rate: ${a.metrics.avgEngagementRate.toFixed(2)}%
- Median Engagement Rate: ${a.metrics.medianEngagementRate.toFixed(2)}%
- Avg Views: ${this.formatNumber(a.metrics.avgViews)}
- Avg Likes: ${this.formatNumber(a.metrics.avgLikes)}
- Avg Comments: ${this.formatNumber(a.metrics.avgComments)}
- Avg Shares: ${this.formatNumber(a.metrics.avgShares)}
- Posts/Week: ${a.metrics.postsPerWeek.toFixed(1)}
- Own Music: ${a.metrics.ownMusicPercentage.toFixed(1)}%
- Total Videos: ${a.metrics.totalVideos}
- Analyzed: ${a.metrics.analyzedVideos}
${a.topCategories ? `- Top Categories: ${a.topCategories.join(', ')}` : ''}
`).join('\n');

    return this.fillTemplate(this.getTemplate('compare'), {
      accountCount: input.accounts.length,
      accounts: accountsStr,
      industryAvgEngagement: input.benchmarks.industryAvgEngagement.toFixed(2),
      language: input.language === 'ko' ? 'Korean' : 'English',
    });
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toString();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createComparativeAnalysisAgent(): ComparativeAnalysisAgent {
  return new ComparativeAnalysisAgent();
}
