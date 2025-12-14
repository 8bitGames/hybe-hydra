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
  })).min(2).max(10),
  benchmarks: z.object({
    industryAvgEngagement: z.number(),
  }),
  language: z.enum(['ko', 'en']).default('ko'),
});

// Lenient ranking item schema - AI may not return all fields consistently
const RankingItemSchema = z.object({
  rank: z.number().optional().default(0),
  uniqueId: z.string().optional().default(''),
  value: z.number().optional().default(0),
  score: z.string().optional(),
  interpretation: z.string().optional().default(''),
}).passthrough();

// Lenient difference item schema
const DifferenceItemSchema = z.object({
  metric: z.string().optional().default(''),
  leader: z.string().optional().default(''),
  follower: z.string().optional().default(''),
  difference: z.number().optional().default(0),
  differencePercent: z.number().optional().default(0),
  insight: z.string().optional().default(''),
  isSignificant: z.boolean().optional().default(false),
}).passthrough();

// Lenient strategic insight schema
const StrategicInsightSchema = z.object({
  category: z.string().optional().default('content'),
  insight: z.string().optional().default(''),
  affectedAccounts: z.array(z.string()).optional().default([]),
  recommendation: z.string().optional().default(''),
}).passthrough();

// Lenient account recommendation schema
const AccountRecommendationSchema = z.object({
  uniqueId: z.string().optional().default(''),
  learnFrom: z.array(z.object({
    fromAccount: z.string().optional().default(''),
    aspect: z.string().optional().default(''),
    suggestion: z.string().optional().default(''),
  }).passthrough()).optional().default([]),
  uniqueStrengths: z.array(z.string()).optional().default([]),
  areasToImprove: z.array(z.string()).optional().default([]),
}).passthrough();

// Lenient positioning item schema
const PositioningItemSchema = z.object({
  uniqueId: z.string().optional().default(''),
  quadrant: z.string().optional().default('question-mark'),
  reasoning: z.string().optional().default(''),
}).passthrough();

export const ComparativeAnalysisOutputSchema = z.object({
  overallSummary: z.string().optional().default(''),
  rankings: z.object({
    byEngagement: z.array(RankingItemSchema).optional().default([]),
    byViews: z.array(RankingItemSchema).optional().default([]),
    byConsistency: z.array(RankingItemSchema).optional().default([]),
    byGrowthPotential: z.array(RankingItemSchema).optional().default([]),
  }).optional().default({
    byEngagement: [],
    byViews: [],
    byConsistency: [],
    byGrowthPotential: [],
  }),
  significantDifferences: z.array(DifferenceItemSchema).optional().default([]),
  radarChartData: z.object({
    dimensions: z.array(z.string()).optional().default([]),
    accounts: z.array(z.object({
      uniqueId: z.string().optional().default(''),
      values: z.array(z.number()).optional().default([]),
    }).passthrough()).optional().default([]),
  }).optional().default({
    dimensions: [],
    accounts: [],
  }),
  strategicInsights: z.array(StrategicInsightSchema).optional().default([]),
  accountSpecificRecommendations: z.array(AccountRecommendationSchema).optional().default([]),
  competitivePositioning: z.object({
    matrix: z.array(PositioningItemSchema).optional().default([]),
    explanation: z.string().optional().default(''),
  }).optional().default({
    matrix: [],
    explanation: '',
  }),
}).passthrough();

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
- Be diplomatic but clear about weaknesses

### LANGUAGE REQUIREMENT:
- You MUST respond in the language specified in the prompt (Korean or English)
- ALL text fields (summary, insights, recommendations, interpretations) MUST be in the specified language
- If language is "Korean", write all analysis text in Korean (한국어로 작성)
- If language is "English", write all analysis text in English

## CRITICAL: Response JSON Schema
You MUST return a valid JSON object. Return ONLY valid JSON, no markdown code blocks or extra text.

{
  "overallSummary": "string - 2-3 sentence comparison summary",
  "rankings": {
    "byEngagement": [{"rank": 1, "uniqueId": "@account", "value": 5.5, "interpretation": "string"}],
    "byViews": [{"rank": 1, "uniqueId": "@account", "value": 100000, "interpretation": "string"}],
    "byConsistency": [{"rank": 1, "uniqueId": "@account", "value": 85, "interpretation": "string"}],
    "byGrowthPotential": [{"rank": 1, "uniqueId": "@account", "score": "high|medium|low", "interpretation": "string"}]
  },
  "significantDifferences": [
    {"metric": "string", "leader": "@account", "follower": "@account", "difference": 100, "differencePercent": 50, "insight": "string", "isSignificant": true}
  ],
  "radarChartData": {
    "dimensions": ["Engagement", "Views", "Consistency", "Diversity", "Originality"],
    "accounts": [{"uniqueId": "@account", "values": [80, 60, 70, 50, 90]}]
  },
  "strategicInsights": [
    {"category": "content|engagement|growth|posting|music", "insight": "string", "affectedAccounts": ["@acc1"], "recommendation": "string"}
  ],
  "accountSpecificRecommendations": [
    {"uniqueId": "@account", "learnFrom": [{"fromAccount": "@other", "aspect": "string", "suggestion": "string"}], "uniqueStrengths": ["str1"], "areasToImprove": ["area1"]}
  ],
  "competitivePositioning": {
    "matrix": [{"uniqueId": "@account", "quadrant": "star|question-mark|cash-cow|dog", "reasoning": "string"}],
    "explanation": "string"
  }
}

IMPORTANT:
- Keep all strings SHORT (1-2 sentences max) to ensure complete response
- ALWAYS complete the entire JSON structure - never truncate
- All arrays must have at least one element for each account being compared`;

// =============================================================================
// Agent Configuration (exported for seed API)
// =============================================================================

export const ComparativeAnalysisConfig = {
  id: 'comparative-analysis',
  name: 'Comparative Analysis',
  description: '다수의 TikTok 계정을 비교 분석하여 경쟁 인사이트 도출',
  category: 'analyzer',
  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.4,
      maxTokens: 32768, // Increased for up to 10 account comparisons
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

**IMPORTANT: You MUST respond entirely in {{language}}.**
All text fields including overallSummary, interpretations, insights, and recommendations MUST be written in {{language}}.`,
    },
  },
  inputSchema: ComparativeAnalysisInputSchema,
  outputSchema: ComparativeAnalysisOutputSchema,
};

// =============================================================================
// Agent Implementation
// =============================================================================

export class ComparativeAnalysisAgent extends BaseAgent<ComparativeAnalysisInput, ComparativeAnalysisOutput> {
  constructor() {
    super(ComparativeAnalysisConfig as any);
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
