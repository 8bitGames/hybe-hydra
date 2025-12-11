import { prisma } from '@/lib/db/prisma'
import type { HashtagRelation, HashtagNetwork, VideoForAnalysis } from './types'

export class CoOccurrenceAnalyzer {
  /**
   * Process videos and update co-occurrence table
   * Called after keyword analysis completes
   */
  async processVideos(
    videos: VideoForAnalysis[],
    sourceKeyword: string
  ): Promise<{ processed: number; pairs: number }> {
    let pairsCreated = 0

    for (const video of videos) {
      // Normalize hashtags
      const hashtags = video.hashtags
        .map(h => h.toLowerCase().replace(/^#/, '').trim())
        .filter(h => h.length > 0 && h.length < 50) // Filter invalid hashtags

      if (hashtags.length < 2) continue

      const engagement = video.stats?.engagementRate || 0

      // Create pairs for co-occurrence (sorted to ensure consistency)
      for (let i = 0; i < hashtags.length; i++) {
        for (let j = i + 1; j < hashtags.length; j++) {
          const [h1, h2] = [hashtags[i], hashtags[j]].sort()

          try {
            await prisma.hashtagCoOccurrence.upsert({
              where: { hashtag1_hashtag2: { hashtag1: h1, hashtag2: h2 } },
              create: {
                hashtag1: h1,
                hashtag2: h2,
                coOccurrenceCount: 1,
                avgEngagement: engagement,
                sourceKeywords: [sourceKeyword]
              },
              update: {
                coOccurrenceCount: { increment: 1 },
                avgEngagement: engagement, // Simple update (could use weighted average)
                sourceKeywords: { push: sourceKeyword },
                lastSeen: new Date()
              }
            })
            pairsCreated++
          } catch (error) {
            // Skip duplicates or other errors silently
            console.warn(`Failed to upsert co-occurrence for ${h1}-${h2}:`, error)
          }
        }
      }
    }

    return { processed: videos.length, pairs: pairsCreated }
  }

  /**
   * Get related hashtags for expansion suggestions
   */
  async getRelatedHashtags(
    hashtag: string,
    trackedHashtags: string[],
    limit = 20
  ): Promise<HashtagRelation[]> {
    const normalizedHashtag = hashtag.toLowerCase().replace(/^#/, '')
    const trackedSet = new Set(
      trackedHashtags.map(h => h.toLowerCase().replace(/^#/, ''))
    )

    // Find co-occurrences where this hashtag appears
    const coOccurrences = await prisma.hashtagCoOccurrence.findMany({
      where: {
        OR: [
          { hashtag1: normalizedHashtag },
          { hashtag2: normalizedHashtag }
        ]
      },
      orderBy: { coOccurrenceCount: 'desc' },
      take: limit * 2 // Get more to filter
    })

    // Extract related hashtags (the other one in the pair)
    const relatedMap = new Map<string, {
      coOccurrenceCount: number
      avgEngagement: number
    }>()

    for (const co of coOccurrences) {
      const relatedHashtag = co.hashtag1 === normalizedHashtag
        ? co.hashtag2
        : co.hashtag1

      // Skip already tracked hashtags
      if (trackedSet.has(relatedHashtag)) continue
      // Skip the source hashtag itself
      if (relatedHashtag === normalizedHashtag) continue

      // Aggregate if we've seen this hashtag from multiple sources
      const existing = relatedMap.get(relatedHashtag)
      if (existing) {
        existing.coOccurrenceCount += co.coOccurrenceCount
        existing.avgEngagement = (existing.avgEngagement + (co.avgEngagement || 0)) / 2
      } else {
        relatedMap.set(relatedHashtag, {
          coOccurrenceCount: co.coOccurrenceCount,
          avgEngagement: co.avgEngagement || 0
        })
      }
    }

    // Convert to array and calculate expansion scores
    const related: HashtagRelation[] = []
    for (const [hashtag, data] of relatedMap) {
      related.push({
        hashtag,
        coOccurrenceCount: data.coOccurrenceCount,
        avgEngagement: data.avgEngagement,
        expansionScore: this.calculateExpansionScore(
          data.coOccurrenceCount,
          data.avgEngagement
        ),
        trendDirection: 'stable' // TODO: Calculate from historical data
      })
    }

    // Sort by expansion score and take top results
    return related
      .sort((a, b) => b.expansionScore - a.expansionScore)
      .slice(0, limit)
  }

  /**
   * Get related hashtags for multiple source hashtags
   */
  async getRelatedHashtagsMultiple(
    hashtags: string[],
    trackedHashtags: string[],
    limit = 20
  ): Promise<HashtagRelation[]> {
    const allRelated = new Map<string, HashtagRelation>()

    for (const hashtag of hashtags) {
      const related = await this.getRelatedHashtags(hashtag, trackedHashtags, limit)

      for (const r of related) {
        const existing = allRelated.get(r.hashtag)
        if (existing) {
          // Combine scores - boost items that appear in multiple sources
          existing.coOccurrenceCount += r.coOccurrenceCount
          existing.avgEngagement = (existing.avgEngagement + r.avgEngagement) / 2
          existing.expansionScore = this.calculateExpansionScore(
            existing.coOccurrenceCount,
            existing.avgEngagement
          ) * 1.2 // Boost for appearing in multiple sources
        } else {
          allRelated.set(r.hashtag, { ...r })
        }
      }
    }

    return [...allRelated.values()]
      .sort((a, b) => b.expansionScore - a.expansionScore)
      .slice(0, limit)
  }

  /**
   * Build network visualization data
   */
  async buildNetwork(sourceHashtags: string[], depth = 2): Promise<HashtagNetwork> {
    const nodes: HashtagNetwork['nodes'] = []
    const edges: HashtagNetwork['edges'] = []
    const visited = new Set<string>()

    const addNode = (hashtag: string, isTracked: boolean, weight: number) => {
      if (!visited.has(hashtag)) {
        visited.add(hashtag)
        nodes.push({ id: hashtag, hashtag, weight, isTracked })
      }
    }

    // Add source hashtags
    for (const h of sourceHashtags) {
      const normalized = h.toLowerCase().replace(/^#/, '')
      addNode(normalized, true, 100)
    }

    // BFS to build network
    let currentLevel = sourceHashtags.map(h => h.toLowerCase().replace(/^#/, ''))

    for (let d = 0; d < depth; d++) {
      const nextLevel: string[] = []

      for (const hashtag of currentLevel) {
        const related = await this.getRelatedHashtags(hashtag, sourceHashtags, 10)

        for (const r of related) {
          addNode(r.hashtag, false, r.expansionScore)
          edges.push({
            source: hashtag,
            target: r.hashtag,
            weight: r.coOccurrenceCount
          })

          if (!visited.has(r.hashtag)) {
            nextLevel.push(r.hashtag)
          }
        }
      }

      currentLevel = [...new Set(nextLevel)]
    }

    return { nodes, edges }
  }

  /**
   * Calculate expansion score (higher = better recommendation)
   * Score range: 0-100
   */
  private calculateExpansionScore(coOccurrence: number, avgEngagement: number): number {
    // Weighted formula: frequency matters, but engagement matters more
    // Frequency: logarithmic scale to prevent outliers from dominating
    const frequencyScore = Math.min(Math.log10(coOccurrence + 1) * 20, 50)

    // Engagement: scaled to 0-50
    const engagementScore = Math.min(avgEngagement * 10, 50)

    return Math.round(frequencyScore + engagementScore)
  }

  /**
   * Get statistics about stored co-occurrences
   */
  async getStats(): Promise<{
    totalPairs: number
    topPairs: Array<{ hashtag1: string; hashtag2: string; count: number }>
  }> {
    const totalPairs = await prisma.hashtagCoOccurrence.count()

    const topPairs = await prisma.hashtagCoOccurrence.findMany({
      orderBy: { coOccurrenceCount: 'desc' },
      take: 10,
      select: {
        hashtag1: true,
        hashtag2: true,
        coOccurrenceCount: true
      }
    })

    return {
      totalPairs,
      topPairs: topPairs.map(p => ({
        hashtag1: p.hashtag1,
        hashtag2: p.hashtag2,
        count: p.coOccurrenceCount
      }))
    }
  }
}

export const coOccurrenceAnalyzer = new CoOccurrenceAnalyzer()
