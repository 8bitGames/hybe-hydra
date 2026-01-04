import { prisma, withRetry } from '@/lib/db/prisma'
import type { Prisma } from '@prisma/client'
import { coOccurrenceAnalyzer } from './co-occurrence'
import { accountDiscoveryService } from './account-discovery'
import type { ExpansionRecommendation, SearchSuggestion } from './types'

export class ExpansionRecommendationEngine {
  /**
   * Generate all recommendations for tracked keywords
   */
  async generateRecommendations(
    trackedKeywords: string[]
  ): Promise<{
    keywords: ExpansionRecommendation[]
    accounts: ExpansionRecommendation[]
    searches: SearchSuggestion[]
  }> {
    const keywords = await this.generateKeywordRecommendations(trackedKeywords)
    const accounts = await this.generateAccountRecommendations(trackedKeywords)
    const searches = await this.generateSearchSuggestions(trackedKeywords, keywords)

    return { keywords, accounts, searches }
  }

  /**
   * Generate keyword expansion recommendations
   */
  async generateKeywordRecommendations(
    trackedKeywords: string[]
  ): Promise<ExpansionRecommendation[]> {
    const recommendations: ExpansionRecommendation[] = []
    const seen = new Set<string>()

    for (const keyword of trackedKeywords) {
      const related = await coOccurrenceAnalyzer.getRelatedHashtags(
        keyword,
        trackedKeywords,
        10
      )

      for (const r of related) {
        if (seen.has(r.hashtag)) continue
        seen.add(r.hashtag)

        const recommendation: ExpansionRecommendation = {
          id: `kw-${r.hashtag}-${Date.now()}`,
          type: 'keyword',
          item: r.hashtag,
          score: r.expansionScore,
          reason: this.generateKeywordReason(keyword, r),
          sourceKeyword: keyword,
          metadata: {
            trendDirection: r.trendDirection,
            engagement: r.avgEngagement
          }
        }

        recommendations.push(recommendation)
      }
    }

    // Sort by score and deduplicate
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
  }

  /**
   * Generate account recommendations
   */
  async generateAccountRecommendations(
    trackedKeywords: string[]
  ): Promise<ExpansionRecommendation[]> {
    const accounts = await accountDiscoveryService.getAccountsByKeywords(
      trackedKeywords,
      40, // minRelevance
      15
    )

    return accounts.map(a => ({
      id: `acc-${a.accountId}-${Date.now()}`,
      type: 'account' as const,
      item: a.username,
      score: a.relevanceScore,
      reason: this.generateAccountReason(a),
      sourceKeyword: a.discoveredFrom[0] || trackedKeywords[0],
      metadata: {
        engagement: a.avgEngagement,
        sampleContent: a.topHashtags.slice(0, 5)
      }
    }))
  }

  /**
   * Generate search suggestions
   */
  async generateSearchSuggestions(
    trackedKeywords: string[],
    keywordRecs: ExpansionRecommendation[]
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = []

    // Suggestion 1: Top expansion keywords
    if (keywordRecs.length > 0) {
      const topRec = keywordRecs[0]
      suggestions.push({
        query: `#${topRec.item}`,
        reason: `"${topRec.item}"이(가) 추적 중인 키워드와 자주 함께 나타납니다`,
        expectedResults: '관련 주제의 크리에이터와 콘텐츠 발견',
        priority: 'high',
        type: 'expand'
      })
    }

    // Suggestion 2: Combine tracked keywords
    if (trackedKeywords.length >= 2) {
      const combo = `${trackedKeywords[0]} ${trackedKeywords[1]}`
      suggestions.push({
        query: combo,
        reason: '추적 중인 키워드를 조합하면 교차된 콘텐츠를 발견할 수 있습니다',
        expectedResults: '추적 중인 주제를 연결하는 콘텐츠 찾기',
        priority: 'medium',
        type: 'explore'
      })
    }

    // Suggestion 3: Trending validation
    if (trackedKeywords.length > 0) {
      suggestions.push({
        query: `trending ${trackedKeywords[0]}`,
        reason: '추적 중인 주제의 현재 트렌드를 확인합니다',
        expectedResults: '현재 바이럴 콘텐츠와 신흥 크리에이터 파악',
        priority: 'medium',
        type: 'validate'
      })
    }

    // Suggestion 4: Gap exploration (from recommendations with high scores)
    const highScoreRecs = keywordRecs
      .filter(r => r.score > 60)
      .slice(0, 2)

    for (const rec of highScoreRecs) {
      if (suggestions.length >= 5) break

      const existingQueries = suggestions.map(s => s.query.toLowerCase())
      const newQuery = `#${rec.item}`

      if (!existingQueries.includes(newQuery.toLowerCase())) {
        suggestions.push({
          query: newQuery,
          reason: `"${rec.item}"은(는) 참여율이 높은 관련 토픽입니다`,
          expectedResults: '피크 전에 신흥 트렌드 포착',
          priority: 'high',
          type: 'expand'
        })
      }
    }

    // Suggestion 5: Creator search if we have accounts
    const topAccounts = await accountDiscoveryService.getDiscoveredAccounts(
      undefined,
      60,
      1
    )

    if (topAccounts.length > 0 && suggestions.length < 5) {
      const topAccount = topAccounts[0]
      suggestions.push({
        query: `@${topAccount.username}`,
        reason: `@${topAccount.username}은(는) 관련 콘텐츠에서 높은 참여율을 보입니다`,
        expectedResults: '이 크리에이터의 콘텐츠 전략 분석',
        priority: 'medium',
        type: 'explore'
      })
    }

    return suggestions.slice(0, 5)
  }

  /**
   * Save recommendations to database
   */
  async saveRecommendations(
    recommendations: ExpansionRecommendation[]
  ): Promise<void> {
    for (const rec of recommendations) {
      try {
        await withRetry(() =>
          prisma.expansionRecommendation.create({
            data: {
              type: rec.type,
              sourceKeyword: rec.sourceKeyword,
              recommendedItem: rec.item,
              score: rec.score,
              reason: rec.reason,
              metadata: rec.metadata,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
          })
        )
      } catch (error) {
        console.warn(`Failed to save recommendation for ${rec.item}:`, error)
      }
    }
  }

  /**
   * Get stored recommendations
   */
  async getStoredRecommendations(
    type?: 'keyword' | 'account' | 'hashtag',
    limit = 20
  ): Promise<ExpansionRecommendation[]> {
    const where: Prisma.ExpansionRecommendationWhereInput = {
      status: 'pending',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }

    if (type) {
      where.type = type
    }

    const stored = await withRetry(() =>
      prisma.expansionRecommendation.findMany({
        where,
        orderBy: { score: 'desc' },
        take: limit
      })
    )

    return stored.map(r => ({
      id: r.id,
      type: r.type as 'keyword' | 'account' | 'hashtag',
      item: r.recommendedItem,
      score: r.score,
      reason: r.reason,
      sourceKeyword: r.sourceKeyword,
      metadata: r.metadata as ExpansionRecommendation['metadata']
    }))
  }

  /**
   * Mark recommendation as accepted/dismissed
   */
  async updateRecommendationStatus(
    id: string,
    status: 'accepted' | 'dismissed'
  ): Promise<void> {
    await withRetry(() =>
      prisma.expansionRecommendation.update({
        where: { id },
        data: { status }
      })
    )
  }

  /**
   * Clean up expired recommendations
   */
  async cleanupExpired(): Promise<number> {
    const result = await withRetry(() =>
      prisma.expansionRecommendation.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      })
    )
    return result.count
  }

  // Helper methods for generating reasons
  private generateKeywordReason(
    sourceKeyword: string,
    relation: { hashtag: string; coOccurrenceCount: number; avgEngagement: number }
  ): string {
    const engagementLevel = relation.avgEngagement > 5
      ? '높은'
      : relation.avgEngagement > 2
        ? '좋은'
        : '보통'

    return `"#${relation.hashtag}"이(가) "${sourceKeyword}" 콘텐츠와 ${relation.coOccurrenceCount}회 함께 나타났으며 ${engagementLevel} 참여율을 보입니다`
  }

  private generateAccountReason(account: {
    avgEngagement: number
    topHashtags: string[]
  }): string {
    const topics = account.topHashtags.slice(0, 3).join(', ')
    const engagementPercent = (account.avgEngagement * 100).toFixed(1)

    return `${engagementPercent}% 참여율의 크리에이터. 주요 주제: ${topics}`
  }
}

export const recommendationEngine = new ExpansionRecommendationEngine()
