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

// Lenient schema - AI may not return all fields consistently
const StrengthWeaknessSchema = z.object({
  area: z.string().optional().default(''),
  description: z.string().optional().default(''),
  metric: z.string().optional().default(''),
  vsIndustry: z.string().optional().default(''),
}).passthrough();

export const AccountMetricsOutputSchema = z.object({
  summary: z.string().optional().default('Analysis not available'),
  performanceScore: z.number().min(0).max(100).optional().default(50),
  performanceTier: z.enum(['exceptional', 'above-average', 'average', 'below-average', 'needs-improvement']).optional().default('average'),
  strengths: z.array(StrengthWeaknessSchema).optional().default([]),
  weaknesses: z.array(StrengthWeaknessSchema).optional().default([]),
  contentStrategy: z.object({
    topPerformingContent: z.string().optional().default(''),
    contentMixRecommendation: z.string().optional().default(''),
    hashtagStrategy: z.string().optional().default(''),
    musicStrategy: z.string().optional().default(''),
  }).optional().default({
    topPerformingContent: '',
    contentMixRecommendation: '',
    hashtagStrategy: '',
    musicStrategy: '',
  }),
  postingStrategy: z.object({
    optimalFrequency: z.string().optional().default(''),
    bestTimes: z.string().optional().default(''),
    consistencyScore: z.number().min(0).max(100).optional().default(50),
  }).optional().default({
    optimalFrequency: '',
    bestTimes: '',
    consistencyScore: 50,
  }),
  growthPotential: z.object({
    score: z.enum(['high', 'medium', 'low']).optional().default('medium'),
    reasoning: z.string().optional().default(''),
    projectedGrowth: z.string().optional().default(''),
  }).optional().default({
    score: 'medium',
    reasoning: '',
    projectedGrowth: '',
  }),
  recommendations: z.array(z.object({
    priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
    action: z.string().optional().default(''),
    expectedImpact: z.string().optional().default(''),
  })).optional().default([]),
  benchmarkComparison: z.object({
    vsIndustry: z.object({
      engagement: z.number().optional().default(0),
      interpretation: z.string().optional().default(''),
    }).optional().default({
      engagement: 0,
      interpretation: '',
    }),
    vsTier: z.object({
      engagement: z.number().optional().default(0),
      interpretation: z.string().optional().default(''),
    }).optional().default({
      engagement: 0,
      interpretation: '',
    }),
  }).optional(),
}).passthrough();

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

### LANGUAGE REQUIREMENT:
- You MUST respond in the language specified in the prompt (Korean or English)
- ALL text fields (summary, descriptions, recommendations, reasoning) MUST be in the specified language
- If language is "Korean", write all analysis text in Korean (한국어로 작성)
- If language is "English", write all analysis text in English

## CRITICAL: Response JSON Schema
You MUST return a valid JSON object matching this EXACT structure:

{
  "summary": "string - Executive summary of the account's performance (2-3 sentences)",
  "performanceScore": 75,
  "performanceTier": "above-average",
  "strengths": [
    {
      "area": "string (e.g., 'Engagement')",
      "description": "string (detailed explanation)",
      "metric": "string (e.g., '9.5%')",
      "vsIndustry": "string (e.g., '+60% above average')"
    }
  ],
  "weaknesses": [
    {
      "area": "string (e.g., 'Posting Frequency')",
      "description": "string (detailed explanation)",
      "metric": "string (e.g., '1.2 posts/week')",
      "vsIndustry": "string (e.g., '-40% below average')"
    }
  ],
  "contentStrategy": {
    "topPerformingContent": "string (what content works best)",
    "contentMixRecommendation": "string (how to balance content types)",
    "hashtagStrategy": "string (hashtag recommendations)",
    "musicStrategy": "string (music usage recommendations)"
  },
  "postingStrategy": {
    "optimalFrequency": "string (e.g., '3-5 posts per week')",
    "bestTimes": "string (e.g., 'Weekday evenings 6-9 PM')",
    "consistencyScore": 70
  },
  "growthPotential": {
    "score": "high",
    "reasoning": "string (explanation for growth potential)",
    "projectedGrowth": "string (e.g., '20-30% follower growth possible')"
  },
  "recommendations": [
    {
      "priority": "high",
      "action": "string (specific action to take)",
      "expectedImpact": "string (expected result)"
    }
  ],
  "benchmarkComparison": {
    "vsIndustry": {
      "engagement": 1.5,
      "interpretation": "string (e.g., '50% above industry average')"
    },
    "vsTier": {
      "engagement": 1.2,
      "interpretation": "string (e.g., '20% above tier average')"
    }
  }
}

IMPORTANT:
- performanceTier MUST be one of: "exceptional", "above-average", "average", "below-average", "needs-improvement"
- growthPotential.score MUST be one of: "high", "medium", "low"
- recommendations[].priority MUST be one of: "high", "medium", "low"
- All numeric scores should be between 0 and 100
- Return ONLY valid JSON, no markdown code blocks or extra text
- ALWAYS complete the entire JSON structure - never truncate or cut off mid-response
- Keep description strings SHORT (1-2 sentences max) to ensure full response completion`;

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
          maxTokens: 12288, // Increased for complete metrics responses
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

**IMPORTANT: You MUST respond entirely in {{language}}.**
All text fields including summary, descriptions, strengths, weaknesses, recommendations, and strategy insights MUST be written in {{language}}.`,
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
