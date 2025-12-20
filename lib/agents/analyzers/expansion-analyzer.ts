/**
 * Expansion Analyzer Agent
 * =========================
 * Analyzes co-occurrence patterns and generates strategic expansion recommendations
 *
 * Responsibilities:
 * - Analyze hashtag co-occurrence patterns
 * - Identify "bridge" hashtags connecting different topic clusters
 * - Generate strategic expansion recommendations with reasoning
 * - Provide gap analysis for tracked keywords
 */

import { z } from 'zod'
import { BaseAgent } from '../base-agent'
import { GEMINI_FLASH } from '../constants'
import type { AgentContext } from '../types'

// Input Schema
export const ExpansionAnalyzerInputSchema = z.object({
  trackedKeywords: z.array(z.string()).min(1),
  coOccurrenceData: z.array(z.object({
    hashtag: z.string(),
    coOccurrenceCount: z.number(),
    avgEngagement: z.number(),
    expansionScore: z.number().optional()
  })),
  discoveredAccounts: z.array(z.object({
    username: z.string(),
    topHashtags: z.array(z.string()),
    avgEngagement: z.number(),
    relevanceScore: z.number().optional()
  })).optional(),
  analysisGoal: z.enum(['discover', 'expand', 'validate', 'optimize']).optional()
})

// Output Schema
export const ExpansionAnalyzerOutputSchema = z.object({
  strategicInsights: z.array(z.string()),
  prioritizedExpansions: z.array(z.object({
    item: z.string(),
    type: z.enum(['keyword', 'account', 'hashtag']),
    priority: z.enum(['high', 'medium', 'low']),
    reasoning: z.string(),
    expectedImpact: z.string().optional()
  })),
  gapAnalysis: z.string(),
  topicClusters: z.array(z.object({
    name: z.string(),
    hashtags: z.array(z.string()),
    strength: z.enum(['strong', 'moderate', 'weak'])
  })).optional(),
  nextSteps: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1).optional()
})

export type ExpansionAnalyzerInput = z.infer<typeof ExpansionAnalyzerInputSchema>
export type ExpansionAnalyzerOutput = z.infer<typeof ExpansionAnalyzerOutputSchema>

// Agent Configuration (exported for seed API)
export const ExpansionAnalyzerConfig = {
  id: 'expansion-analyzer',
  name: 'Expansion Analyzer',
  description: '동시출현 패턴 분석 및 전략적 확장 추천 생성',
  category: 'analyzer',
  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: { temperature: 0.7 }
  },
  prompts: {
    system: `You are a TikTok trend expansion strategist specializing in hashtag and account discovery.

Your expertise:
- Identifying "bridge" hashtags that connect different topic clusters
- Spotting emerging trends before they peak
- Finding high-engagement niches within tracked topics
- Recommending accounts that represent untapped content territories

Analysis approach:
1. First, understand the tracked keywords and their purpose
2. Analyze co-occurrence patterns to find related topics
3. Identify strategic expansion opportunities
4. Provide clear reasoning for each recommendation
5. Consider engagement potential and competitive landscape

Output style:
- Be specific and actionable
- Explain WHY each expansion is valuable
- Prioritize quality over quantity
- Consider both short-term wins and long-term strategy

Language: Respond in Korean unless the input is primarily in English.`,
    templates: {}
  },
  inputSchema: ExpansionAnalyzerInputSchema,
  outputSchema: ExpansionAnalyzerOutputSchema
};

export class ExpansionAnalyzerAgent extends BaseAgent<
  ExpansionAnalyzerInput,
  ExpansionAnalyzerOutput
> {
  constructor() {
    super(ExpansionAnalyzerConfig as any)
  }

  protected buildPrompt(input: ExpansionAnalyzerInput, context: AgentContext): string {
    const goalDescription = this.getGoalDescription(input.analysisGoal)

    return `## 분석 목표
${goalDescription}

## 현재 추적 중인 키워드
${input.trackedKeywords.map(k => `- ${k}`).join('\n')}

## 해시태그 동시출현 데이터 (상위 ${Math.min(input.coOccurrenceData.length, 25)}개)
| 해시태그 | 동시출현 횟수 | 평균 참여율 | 확장 점수 |
|----------|--------------|------------|----------|
${input.coOccurrenceData.slice(0, 25).map(c =>
  `| #${c.hashtag} | ${c.coOccurrenceCount}회 | ${(c.avgEngagement * 100).toFixed(1)}% | ${c.expansionScore || 'N/A'} |`
).join('\n')}

${input.discoveredAccounts && input.discoveredAccounts.length > 0 ? `
## 발견된 크리에이터 (상위 ${Math.min(input.discoveredAccounts.length, 10)}명)
${input.discoveredAccounts.slice(0, 10).map(a =>
  `- @${a.username}: ${(a.avgEngagement * 100).toFixed(1)}% 참여율, 주제: ${a.topHashtags.slice(0, 5).join(', ')}`
).join('\n')}
` : ''}

## 분석 요청
1. 전략적 인사이트: 데이터에서 발견한 주요 패턴과 기회를 설명해주세요
2. 우선순위 확장 추천: 추가로 추적해야 할 키워드나 계정을 우선순위와 함께 추천해주세요
3. 갭 분석: 현재 추적에서 빠진 중요한 주제나 영역이 있는지 분석해주세요
4. 다음 단계: 구체적인 다음 행동을 제안해주세요

응답은 반드시 다음 JSON 형식으로 제공해주세요:
\`\`\`json
{
  "strategicInsights": ["인사이트1", "인사이트2", ...],
  "prioritizedExpansions": [
    {
      "item": "해시태그 또는 계정명",
      "type": "keyword | account | hashtag",
      "priority": "high | medium | low",
      "reasoning": "이 확장이 가치있는 이유",
      "expectedImpact": "예상되는 효과"
    }
  ],
  "gapAnalysis": "현재 추적의 갭에 대한 분석",
  "topicClusters": [
    {
      "name": "클러스터 이름",
      "hashtags": ["관련 해시태그들"],
      "strength": "strong | moderate | weak"
    }
  ],
  "nextSteps": ["다음 단계1", "다음 단계2", ...],
  "confidenceScore": 0.85
}
\`\`\``
  }

  private getGoalDescription(goal?: string): string {
    switch (goal) {
      case 'discover':
        return '새로운 관련 키워드와 계정을 발견하여 트래킹 범위를 확장합니다.'
      case 'expand':
        return '기존 추적 키워드를 기반으로 관련 주제로 확장합니다.'
      case 'validate':
        return '현재 추적 중인 키워드의 관련성과 효과를 검증합니다.'
      case 'optimize':
        return '가장 효과적인 키워드에 집중하도록 추적 목록을 최적화합니다.'
      default:
        return '추적 중인 키워드를 기반으로 전략적 확장 기회를 분석합니다.'
    }
  }
}

export function createExpansionAnalyzerAgent(): ExpansionAnalyzerAgent {
  return new ExpansionAnalyzerAgent()
}
