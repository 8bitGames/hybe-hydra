import { prisma } from '@/lib/db/prisma'
import type { Prisma } from '@prisma/client'
import type { DiscoveredCreator, VideoForAnalysis } from './types'

export class AccountDiscoveryService {
  /**
   * Discover accounts from keyword analysis results
   */
  async discoverFromVideos(
    videos: VideoForAnalysis[],
    sourceKeyword: string,
    trackedKeywords: string[]
  ): Promise<DiscoveredCreator[]> {
    // Group videos by author
    const authorMap = new Map<string, {
      videos: VideoForAnalysis[]
      totalEngagement: number
      allHashtags: string[]
      authorName?: string
    }>()

    for (const video of videos) {
      if (!video.authorId) continue

      const existing = authorMap.get(video.authorId) || {
        videos: [],
        totalEngagement: 0,
        allHashtags: [],
        authorName: video.authorName
      }

      existing.videos.push(video)
      existing.totalEngagement += video.stats?.engagementRate || 0
      existing.allHashtags.push(...video.hashtags)
      if (video.authorName && !existing.authorName) {
        existing.authorName = video.authorName
      }

      authorMap.set(video.authorId, existing)
    }

    // Process each author
    const creators: DiscoveredCreator[] = []

    for (const [authorId, data] of authorMap) {
      const avgEngagement = data.videos.length > 0
        ? data.totalEngagement / data.videos.length
        : 0

      // Get unique hashtags with frequency
      const hashtagCounts = new Map<string, number>()
      for (const h of data.allHashtags) {
        const normalized = h.toLowerCase().replace(/^#/, '')
        if (normalized.length > 0) {
          hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1)
        }
      }

      // Top hashtags for this creator
      const topHashtags = [...hashtagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([h]) => h)

      // Calculate content overlap with tracked keywords
      const trackedSet = new Set(
        trackedKeywords.map(k => k.toLowerCase().replace(/^#/, ''))
      )
      const overlappingHashtags = topHashtags.filter(h => trackedSet.has(h))
      const overlap = topHashtags.length > 0
        ? overlappingHashtags.length / topHashtags.length
        : 0

      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(
        avgEngagement,
        overlap,
        data.videos.length
      )

      // Upsert to database
      try {
        await prisma.discoveredAccount.upsert({
          where: {
            platform_accountId: { platform: 'tiktok', accountId: authorId }
          },
          create: {
            platform: 'tiktok',
            accountId: authorId,
            username: data.authorName || authorId,
            avgEngagement,
            relevanceScore,
            topHashtags,
            contentOverlap: overlap,
            discoveredFrom: [sourceKeyword]
          },
          update: {
            avgEngagement,
            relevanceScore,
            topHashtags,
            contentOverlap: overlap,
            discoveredFrom: { push: sourceKeyword },
            lastUpdated: new Date()
          }
        })
      } catch (error) {
        console.warn(`Failed to upsert discovered account ${authorId}:`, error)
      }

      creators.push({
        accountId: authorId,
        username: data.authorName || authorId,
        avgEngagement,
        relevanceScore,
        topHashtags,
        discoveredFrom: [sourceKeyword]
      })
    }

    // Sort by relevance and return top results
    return creators
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20)
  }

  /**
   * Get discovered accounts for display
   */
  async getDiscoveredAccounts(
    sourceKeyword?: string,
    minRelevance = 30,
    limit = 20
  ): Promise<DiscoveredCreator[]> {
    const where: Prisma.DiscoveredAccountWhereInput = {
      relevanceScore: { gte: minRelevance }
    }

    if (sourceKeyword) {
      where.discoveredFrom = { has: sourceKeyword.toLowerCase().replace(/^#/, '') }
    }

    const accounts = await prisma.discoveredAccount.findMany({
      where,
      orderBy: { relevanceScore: 'desc' },
      take: limit
    })

    return accounts.map(a => ({
      accountId: a.accountId,
      username: a.username,
      displayName: a.displayName || undefined,
      followerCount: a.followerCount || undefined,
      avgEngagement: a.avgEngagement || 0,
      relevanceScore: a.relevanceScore,
      topHashtags: a.topHashtags,
      discoveredFrom: a.discoveredFrom
    }))
  }

  /**
   * Get accounts by multiple source keywords
   */
  async getAccountsByKeywords(
    keywords: string[],
    minRelevance = 30,
    limit = 20
  ): Promise<DiscoveredCreator[]> {
    const normalizedKeywords = keywords.map(k => k.toLowerCase().replace(/^#/, ''))

    const accounts = await prisma.discoveredAccount.findMany({
      where: {
        relevanceScore: { gte: minRelevance },
        OR: normalizedKeywords.map(kw => ({
          discoveredFrom: { has: kw }
        }))
      },
      orderBy: { relevanceScore: 'desc' },
      take: limit
    })

    // Boost accounts discovered from multiple keywords
    const boostedAccounts = accounts.map(a => {
      const matchingKeywords = normalizedKeywords.filter(kw =>
        a.discoveredFrom.includes(kw)
      )
      const boost = 1 + (matchingKeywords.length - 1) * 0.1 // 10% boost per additional keyword

      return {
        accountId: a.accountId,
        username: a.username,
        displayName: a.displayName || undefined,
        followerCount: a.followerCount || undefined,
        avgEngagement: a.avgEngagement || 0,
        relevanceScore: a.relevanceScore * boost,
        topHashtags: a.topHashtags,
        discoveredFrom: a.discoveredFrom
      }
    })

    return boostedAccounts
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
  }

  /**
   * Find similar accounts based on hashtag overlap
   */
  async findSimilarAccounts(
    accountId: string,
    limit = 10
  ): Promise<DiscoveredCreator[]> {
    // Get the source account
    const sourceAccount = await prisma.discoveredAccount.findFirst({
      where: { accountId }
    })

    if (!sourceAccount || sourceAccount.topHashtags.length === 0) {
      return []
    }

    // Find accounts with overlapping hashtags
    const accounts = await prisma.discoveredAccount.findMany({
      where: {
        accountId: { not: accountId },
        topHashtags: { hasSome: sourceAccount.topHashtags }
      },
      take: limit * 2
    })

    // Calculate similarity score based on hashtag overlap
    const sourceHashtagSet = new Set(sourceAccount.topHashtags)
    const scoredAccounts = accounts.map(a => {
      const overlappingHashtags = a.topHashtags.filter(h => sourceHashtagSet.has(h))
      const similarity = overlappingHashtags.length / sourceHashtagSet.size

      return {
        accountId: a.accountId,
        username: a.username,
        displayName: a.displayName || undefined,
        followerCount: a.followerCount || undefined,
        avgEngagement: a.avgEngagement || 0,
        relevanceScore: a.relevanceScore * (1 + similarity), // Boost by similarity
        topHashtags: a.topHashtags,
        discoveredFrom: a.discoveredFrom
      }
    })

    return scoredAccounts
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
  }

  /**
   * Calculate relevance score
   * Score range: 0-100
   */
  private calculateRelevanceScore(
    avgEngagement: number,
    contentOverlap: number,
    videoCount: number
  ): number {
    // Weighted score calculation
    const engagementWeight = 0.4
    const overlapWeight = 0.4
    const volumeWeight = 0.2

    // Engagement: scaled to 0-40
    const engagementScore = Math.min(avgEngagement * 8, 40)

    // Content overlap: scaled to 0-40
    const overlapScore = contentOverlap * 40

    // Volume: logarithmic scale, max 20
    const volumeScore = Math.min(Math.log10(videoCount + 1) * 10, 20)

    const rawScore =
      engagementScore * engagementWeight +
      overlapScore * overlapWeight +
      volumeScore * volumeWeight

    // Scale to 0-100
    return Math.round(rawScore * 2.5)
  }

  /**
   * Get statistics about discovered accounts
   */
  async getStats(): Promise<{
    totalAccounts: number
    avgRelevanceScore: number
    topAccounts: Array<{ username: string; relevanceScore: number }>
  }> {
    const totalAccounts = await prisma.discoveredAccount.count()

    const avgResult = await prisma.discoveredAccount.aggregate({
      _avg: { relevanceScore: true }
    })

    const topAccounts = await prisma.discoveredAccount.findMany({
      orderBy: { relevanceScore: 'desc' },
      take: 10,
      select: {
        username: true,
        relevanceScore: true
      }
    })

    return {
      totalAccounts,
      avgRelevanceScore: avgResult._avg.relevanceScore || 0,
      topAccounts: topAccounts.map(a => ({
        username: a.username,
        relevanceScore: a.relevanceScore
      }))
    }
  }
}

export const accountDiscoveryService = new AccountDiscoveryService()
