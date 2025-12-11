/**
 * Account Metrics Agent
 * =====================
 * Analyzes account performance metrics and generates AI insights.
 * Provides strategic recommendations based on data patterns.
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentContext } from '../types';

// =============================================================================
// Input/Output Schemas
// =============================================================================

export const AccountMetricsInputSchema = z.object({
  account: z.object({
    uniqueId: z.string(),
    nickname: z.string(),
    verified: z.boolean(),
    followers: z.number(),
    following: z.number(),
    totalLikes: z.number(),
    totalVideos: z.number(),
  }),
  metrics: z.object({
    // Basic metrics
    totalVideos: z.number(),
    analyzedVideos: z.number(),
    totalViews: z.number(),
    totalLikes: z.number(),
    totalComments: z.number(),
    totalShares: z.number(),
    // Engagement metrics
    avgEngagementRate: z.number(),
    medianEngagementRate: z.number(),
    engagementRateStdDev: z.number(),
    topPerformingRate: z.number(),
    bottomPerformingRate: z.number(),
    // Content metrics
    avgViews: z.number(),
    avgLikes: z.number(),
    avgComments: z.number(),
    avgShares: z.number(),
    avgDuration: z.number(),
    avgHashtagCount: z.number(),
    ownMusicPercentage: z.number(),
    // Posting metrics
    postsPerWeek: z.number(),
    mostActiveDay: z.string().optional(),
    mostActiveHour: z.number().optional(),
  }),
  categoryDistribution: z.array(z.object({
    category: z.string(),
    count: z.number(),
    percentage: z.number(),
    avgEngagement: z.number(),
  })).optional(),
  benchmarks: z.object({
    industryAvgEngagement: z.number(),
    tierAvgEngagement: z.number(),
    tierAvgViews: z.number(),
    tier: z.string(),
  }),
  language: z.enum(['ko', 'en']).default('ko'),
});

export const AccountMetricsOutputSchema = z.object({
  summary: z.string(),
  performanceScore: z.number().min(0).max(100),
  performanceTier: z.enum(['exceptional', 'above-average', 'average', 'below-average', 'needs-improvement']),
  strengths: z.array(z.object({
    area: z.string(),
    description: z.string(),
    metric: z.string(),
    vsIndustry: z.string(),
  })),
  weaknesses: z.array(z.object({
    area: z.string(),
    description: z.string(),
    metric: z.string(),
    vsIndustry: z.string(),
  })),
  contentStrategy: z.object({
    topPerformingContent: z.string(),
    contentMixRecommendation: z.string(),
    hashtagStrategy: z.string(),
    musicStrategy: z.string(),
  }),
  postingStrategy: z.object({
    optimalFrequency: z.string(),
    bestTimes: z.string(),
    consistencyScore: z.number().min(0).max(100),
  }),
  growthPotential: z.object({
    score: z.enum(['high', 'medium', 'low']),
    reasoning: z.string(),
    projectedGrowth: z.string(),
  }),
  recommendations: z.array(z.object({
    priority: z.enum(['high', 'medium', 'low']),
    action: z.string(),
    expectedImpact: z.string(),
  })),
  benchmarkComparison: z.object({
    vsIndustry: z.object({
      engagement: z.number(),
      interpretation: z.string(),
    }),
    vsTier: z.object({
      engagement: z.number(),
      interpretation: z.string(),
    }),
  }),
});

export type AccountMetricsInput = z.infer<typeof AccountMetricsInputSchema>;
export type AccountMetricsOutput = z.infer<typeof AccountMetricsOutputSchema>;

// =============================================================================
// System Prompt
// =============================================================================

const SYSTEM_PROMPT = `You are an expert TikTok analytics consultant specializing in artist and celebrity accounts.
Your task is to analyze account metrics and provide actionable strategic insights.

## Analysis Framework

### Performance Scoring (0-100):
- 90-100: Exceptional - Top performer, industry leader
- 75-89: Above Average - Strong performance, minor optimizations needed
- 50-74: Average - Meeting benchmarks, room for improvement
- 25-49: Below Average - Underperforming, significant changes needed
- 0-24: Needs Improvement - Critical issues to address

### Key Metrics to Evaluate:
1. **Engagement Rate**: (likes + comments + shares) / views * 100
   - Industry average: ~5.96%
   - Good: >8%, Excellent: >15%

2. **Consistency**: Standard deviation of engagement
   - Lower is better (more predictable performance)

3. **Content Mix**: Distribution across content types
   - Diversity is generally positive

4. **Posting Frequency**: Posts per week
   - Optimal varies by account size

5. **Music Strategy**: Own music vs trending sounds
   - For artists, higher own music % can indicate brand strength

### Response Guidelines:
- Be specific with numbers and percentages
- Compare to relevant benchmarks
- Provide actionable recommendations
- Consider the artist/celebrity context
- Prioritize recommendations by impact

## Output Format
Return a comprehensive analysis with:
- Executive summary
- Performance score and tier
- Strengths and weaknesses with metrics
- Content and posting strategy recommendations
- Growth potential assessment
- Prioritized action items`;

// =============================================================================
// Agent Implementation
// =============================================================================

export class AccountMetricsAgent extends BaseAgent<AccountMetricsInput, AccountMetricsOutput> {
  constructor() {
    super({
      id: 'account-metrics',
      name: 'Account Metrics Analyzer',
      description: 'Analyzes TikTok account metrics and generates strategic insights',
      category: 'analyzer',
      model: {
        provider: 'gemini',
        name: 'gemini-2.5-flash',
        options: {
          temperature: 0.5,
          maxTokens: 8192,
        },
      },
      prompts: {
        system: SYSTEM_PROMPT,
        templates: {
          analyze: `Analyze the following TikTok account metrics and provide strategic insights.

## Account Information
- Username: @{{uniqueId}}
- Display Name: {{nickname}}
- Verified: {{verified}}
- Followers: {{followers}}
- Following: {{following}}
- Total Likes: {{totalLikes}}
- Total Videos: {{totalVideos}}

## Performance Metrics (from {{analyzedVideos}} analyzed videos)

### Engagement Metrics
- Average Engagement Rate: {{avgEngagementRate}}%
- Median Engagement Rate: {{medianEngagementRate}}%
- Engagement Std Dev: {{engagementStdDev}}%
- Top 10% Videos: {{topPerformingRate}}%
- Bottom 10% Videos: {{bottomPerformingRate}}%

### Content Metrics
- Average Views: {{avgViews}}
- Average Likes: {{avgLikes}}
- Average Comments: {{avgComments}}
- Average Shares: {{avgShares}}
- Average Duration: {{avgDuration}}s
- Average Hashtags: {{avgHashtagCount}}
- Own Music Usage: {{ownMusicPercentage}}%

### Posting Metrics
- Posts per Week: {{postsPerWeek}}
- Most Active Day: {{mostActiveDay}}
- Most Active Hour: {{mostActiveHour}}

{{#if categoryDistribution}}
### Content Distribution
{{categoryDistribution}}
{{/if}}

## Benchmarks
- Account Tier: {{tier}}
- Industry Avg Engagement: {{industryAvgEngagement}}%
- Tier Avg Engagement: {{tierAvgEngagement}}%
- Tier Avg Views: {{tierAvgViews}}

---
Provide a comprehensive analysis in {{language}}.`,
        },
      },
      inputSchema: AccountMetricsInputSchema,
      outputSchema: AccountMetricsOutputSchema,
    });
  }

  protected buildPrompt(input: AccountMetricsInput, context: AgentContext): string {
    const categoryDistStr = input.categoryDistribution
      ? input.categoryDistribution.map(c =>
          `- ${c.category}: ${c.count} videos (${c.percentage.toFixed(1)}%), avg engagement: ${c.avgEngagement.toFixed(2)}%`
        ).join('\n')
      : '';

    return this.fillTemplate(this.getTemplate('analyze'), {
      uniqueId: input.account.uniqueId,
      nickname: input.account.nickname,
      verified: input.account.verified ? 'Yes' : 'No',
      followers: this.formatNumber(input.account.followers),
      following: this.formatNumber(input.account.following),
      totalLikes: this.formatNumber(input.account.totalLikes),
      totalVideos: input.account.totalVideos,
      analyzedVideos: input.metrics.analyzedVideos,
      avgEngagementRate: input.metrics.avgEngagementRate.toFixed(2),
      medianEngagementRate: input.metrics.medianEngagementRate.toFixed(2),
      engagementStdDev: input.metrics.engagementRateStdDev.toFixed(2),
      topPerformingRate: input.metrics.topPerformingRate.toFixed(2),
      bottomPerformingRate: input.metrics.bottomPerformingRate.toFixed(2),
      avgViews: this.formatNumber(input.metrics.avgViews),
      avgLikes: this.formatNumber(input.metrics.avgLikes),
      avgComments: this.formatNumber(input.metrics.avgComments),
      avgShares: this.formatNumber(input.metrics.avgShares),
      avgDuration: input.metrics.avgDuration.toFixed(1),
      avgHashtagCount: input.metrics.avgHashtagCount.toFixed(1),
      ownMusicPercentage: input.metrics.ownMusicPercentage.toFixed(1),
      postsPerWeek: input.metrics.postsPerWeek.toFixed(1),
      mostActiveDay: input.metrics.mostActiveDay || 'N/A',
      mostActiveHour: input.metrics.mostActiveHour !== undefined ? `${input.metrics.mostActiveHour}:00` : 'N/A',
      categoryDistribution: categoryDistStr,
      tier: input.benchmarks.tier,
      industryAvgEngagement: input.benchmarks.industryAvgEngagement.toFixed(2),
      tierAvgEngagement: input.benchmarks.tierAvgEngagement.toFixed(2),
      tierAvgViews: this.formatNumber(input.benchmarks.tierAvgViews),
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

export function createAccountMetricsAgent(): AccountMetricsAgent {
  return new AccountMetricsAgent();
}
