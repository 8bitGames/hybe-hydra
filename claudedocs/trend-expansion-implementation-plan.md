# TikTok Trend Expansion Dashboard - Implementation Plan

## Executive Summary

This plan enhances the existing trend dashboard to support **keyword/account discovery** through expansion analysis. The core goal is to help users discover new keywords and accounts based on their tracked inputs, with AI-powered recommendations for "what to search next."

### Key Features
1. **Keyword Expansion** - Discover related keywords through hashtag co-occurrence analysis
2. **Account Discovery** - Find relevant creators from tracked keyword videos
3. **Smart Recommendations** - AI-powered suggestions for expanding research
4. **Minimal Changes** - Additive enhancements to existing architecture

---

## Research Findings: TikTok Trend Discovery Methods

### Official TikTok Tools

| Tool | Purpose | Data Available |
|------|---------|----------------|
| [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/trends/hub/pc/en) | Trend hub | Trending hashtags, songs, creators |
| [Keyword Insights](https://ads.tiktok.com/business/creativecenter/keyword-insights/pc/en) | Ad keyword data | Popularity scores, CTR, related keywords |
| [Creator Search Insights](https://ads.tiktok.com/business/creativecenter/trends/home/pc/en) | Trending searches | What users are actively searching |

### TikTok API Family (via partners)

- **Search API** - Query videos by keyword/hashtag, get metadata
- **Discovery API** - Find trending content, creators, audience segments
- **Hashtag Analytics API** - Track hashtag performance over time

### Trend Categories (TikTok's Classification)

| Type | Duration | Example |
|------|----------|---------|
| **Trend Moments** | Days | Viral challenges |
| **Trend Signals** | Weeks | Emerging interests |
| **Trend Forces** | Months+ | Long-term shifts |

### Key Expansion Techniques (From Research)

1. **Co-occurrence Analysis** ([Bellingcat Tool](https://www.bellingcat.com/resources/how-tos/2022/05/11/this-new-tool-lets-you-analyse-tiktok-hashtags/))
   - Track which hashtags appear together frequently
   - Build network graphs showing hashtag relationships
   - Identify "bridge" hashtags connecting different topic clusters

2. **Seed Expansion Method** ([Academic Research](https://arxiv.org/html/2501.16123v1))
   - Start with tracked keywords
   - Find co-occurring hashtags in results
   - Iteratively search new hashtags
   - Continue until saturation

3. **Similar Account Discovery** ([Influencers.club](https://influencers.club/find-similar-tiktok-accounts/))
   - Profile description analysis
   - Engagement metrics comparison
   - Content style/hashtag overlap

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPANSION LAYER (NEW)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐   ┌─────────────────┐   ┌──────────────┐ │
│   │ Co-occurrence   │   │ Account         │   │ Expansion    │ │
│   │ Analyzer        │   │ Discovery       │   │ AI Agent     │ │
│   └────────┬────────┘   └────────┬────────┘   └──────┬───────┘ │
│            │                     │                    │         │
│            └─────────────┬───────┴────────────────────┘         │
│                          │                                      │
│                 ┌────────▼────────┐                             │
│                 │ Recommendation  │                             │
│                 │ Engine          │                             │
│                 └────────┬────────┘                             │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  EXISTING TREND SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│  TikTok Scraper → TrendVideo → KeywordAnalysis → AI Insights    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema Enhancement

### New Models

```prisma
// prisma/schema.prisma - ADD these models

// Hashtag co-occurrence tracking
model HashtagCoOccurrence {
  id                String   @id @default(cuid())
  hashtag1          String
  hashtag2          String
  coOccurrenceCount Int      @default(1)
  avgEngagement     Float?   // Average engagement when appearing together
  sourceKeywords    String[] // Which tracked keywords led to this discovery
  firstSeen         DateTime @default(now())
  lastSeen          DateTime @updatedAt

  @@unique([hashtag1, hashtag2])
  @@index([hashtag1])
  @@index([hashtag2])
  @@index([coOccurrenceCount])
}

// Discovered accounts from trend analysis
model DiscoveredAccount {
  id              String   @id @default(cuid())
  platform        String   @default("tiktok")
  accountId       String   // TikTok user ID
  username        String
  displayName     String?
  followerCount   Int?
  videoCount      Int?
  avgEngagement   Float?
  discoveredFrom  String[] // Keywords/hashtags that led to discovery
  relevanceScore  Float    // Calculated relevance to tracked topics
  topHashtags     String[] // Their most used hashtags
  contentOverlap  Float?   // % overlap with tracked keywords
  firstSeen       DateTime @default(now())
  lastUpdated     DateTime @updatedAt

  @@unique([platform, accountId])
  @@index([relevanceScore])
  @@index([platform])
}

// Expansion recommendations
model ExpansionRecommendation {
  id              String   @id @default(cuid())
  type            String   // "keyword" | "account" | "hashtag"
  sourceKeyword   String   // The tracked keyword that triggered this
  recommendedItem String   // The suggested keyword/account
  score           Float    // Recommendation strength (0-100)
  reason          String   // Human-readable explanation
  metadata        Json?    // Additional context (engagement, trend direction, etc)
  status          String   @default("pending") // pending, accepted, dismissed
  createdAt       DateTime @default(now())
  expiresAt       DateTime? // Recommendations can expire

  @@index([sourceKeyword])
  @@index([type, score])
  @@index([status])
}
```

### Migration Command
```bash
npx prisma migrate dev --name add_expansion_tables
```

---

## Phase 2: Backend Services

### 2.1 Type Definitions

**File: `lib/expansion/types.ts`**

```typescript
// Co-occurrence types
export interface HashtagRelation {
  hashtag: string
  coOccurrenceCount: number
  avgEngagement: number
  expansionScore: number
  trendDirection: 'rising' | 'stable' | 'declining'
}

export interface HashtagNetwork {
  nodes: Array<{
    id: string
    hashtag: string
    weight: number
    isTracked: boolean
  }>
  edges: Array<{
    source: string
    target: string
    weight: number
  }>
}

// Account discovery types
export interface DiscoveredCreator {
  accountId: string
  username: string
  displayName?: string
  followerCount?: number
  avgEngagement: number
  relevanceScore: number
  topHashtags: string[]
  discoveredFrom: string[]
  sampleVideos?: string[]
}

// Recommendation types
export interface ExpansionRecommendation {
  id: string
  type: 'keyword' | 'account' | 'hashtag'
  item: string
  score: number
  reason: string
  sourceKeyword: string
  metadata?: {
    trendDirection?: string
    engagement?: number
    sampleContent?: string[]
  }
}

export interface SearchSuggestion {
  query: string
  reason: string
  expectedResults: string
  priority: 'high' | 'medium' | 'low'
  type: 'expand' | 'explore' | 'validate'
}
```

### 2.2 Co-occurrence Analyzer

**File: `lib/expansion/co-occurrence.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import type { HashtagRelation, HashtagNetwork } from './types'

export class CoOccurrenceAnalyzer {
  /**
   * Process videos and update co-occurrence table
   * Called after keyword analysis completes
   */
  async processVideos(
    videos: Array<{ hashtags: string[], stats?: { engagementRate?: number } }>,
    sourceKeyword: string
  ): Promise<void> {
    for (const video of videos) {
      const hashtags = video.hashtags.map(h => h.toLowerCase().replace('#', ''))
      const engagement = video.stats?.engagementRate || 0

      // Create pairs for co-occurrence
      for (let i = 0; i < hashtags.length; i++) {
        for (let j = i + 1; j < hashtags.length; j++) {
          const [h1, h2] = [hashtags[i], hashtags[j]].sort()

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
              avgEngagement: engagement, // Could be weighted average
              sourceKeywords: { push: sourceKeyword },
              lastSeen: new Date()
            }
          })
        }
      }
    }
  }

  /**
   * Get related hashtags for expansion suggestions
   */
  async getRelatedHashtags(
    hashtag: string,
    trackedHashtags: string[],
    limit = 20
  ): Promise<HashtagRelation[]> {
    const normalizedHashtag = hashtag.toLowerCase().replace('#', '')
    const trackedSet = new Set(trackedHashtags.map(h => h.toLowerCase().replace('#', '')))

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
    const related = coOccurrences
      .map(co => ({
        hashtag: co.hashtag1 === normalizedHashtag ? co.hashtag2 : co.hashtag1,
        coOccurrenceCount: co.coOccurrenceCount,
        avgEngagement: co.avgEngagement || 0,
        isTracked: trackedSet.has(co.hashtag1 === normalizedHashtag ? co.hashtag2 : co.hashtag1)
      }))
      .filter(r => !r.isTracked) // Filter out already tracked
      .slice(0, limit)

    // Calculate expansion scores
    return related.map(r => ({
      hashtag: r.hashtag,
      coOccurrenceCount: r.coOccurrenceCount,
      avgEngagement: r.avgEngagement,
      expansionScore: this.calculateExpansionScore(r.coOccurrenceCount, r.avgEngagement),
      trendDirection: 'stable' as const // TODO: Calculate from historical data
    }))
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
      addNode(h.toLowerCase(), true, 100)
    }

    // BFS to build network
    let currentLevel = sourceHashtags.map(h => h.toLowerCase())
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
          nextLevel.push(r.hashtag)
        }
      }

      currentLevel = [...new Set(nextLevel)]
    }

    return { nodes, edges }
  }

  /**
   * Calculate expansion score (higher = better recommendation)
   */
  private calculateExpansionScore(coOccurrence: number, avgEngagement: number): number {
    // Weighted formula: frequency matters, but engagement matters more
    const frequencyScore = Math.min(coOccurrence / 10, 50) // Max 50 points from frequency
    const engagementScore = Math.min(avgEngagement * 100, 50) // Max 50 points from engagement
    return Math.round(frequencyScore + engagementScore)
  }
}

export const coOccurrenceAnalyzer = new CoOccurrenceAnalyzer()
```

### 2.3 Account Discovery Service

**File: `lib/expansion/account-discovery.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import type { DiscoveredCreator } from './types'

export class AccountDiscoveryService {
  /**
   * Discover accounts from keyword analysis results
   */
  async discoverFromVideos(
    videos: Array<{
      authorId: string
      authorName?: string
      hashtags: string[]
      stats?: { playCount?: number, likeCount?: number, engagementRate?: number }
    }>,
    sourceKeyword: string,
    trackedKeywords: string[]
  ): Promise<DiscoveredCreator[]> {
    // Group videos by author
    const authorMap = new Map<string, {
      videos: typeof videos
      totalEngagement: number
      allHashtags: string[]
    }>()

    for (const video of videos) {
      const existing = authorMap.get(video.authorId) || {
        videos: [],
        totalEngagement: 0,
        allHashtags: []
      }

      existing.videos.push(video)
      existing.totalEngagement += video.stats?.engagementRate || 0
      existing.allHashtags.push(...video.hashtags)

      authorMap.set(video.authorId, existing)
    }

    // Process each author
    const creators: DiscoveredCreator[] = []

    for (const [authorId, data] of authorMap) {
      const firstVideo = data.videos[0]
      const avgEngagement = data.totalEngagement / data.videos.length

      // Get unique hashtags with frequency
      const hashtagCounts = new Map<string, number>()
      for (const h of data.allHashtags) {
        const normalized = h.toLowerCase().replace('#', '')
        hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1)
      }

      // Top hashtags for this creator
      const topHashtags = [...hashtagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([h]) => h)

      // Calculate content overlap with tracked keywords
      const trackedSet = new Set(trackedKeywords.map(k => k.toLowerCase()))
      const overlap = topHashtags.filter(h => trackedSet.has(h)).length / topHashtags.length

      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(avgEngagement, overlap, data.videos.length)

      // Upsert to database
      await prisma.discoveredAccount.upsert({
        where: {
          platform_accountId: { platform: 'tiktok', accountId: authorId }
        },
        create: {
          platform: 'tiktok',
          accountId: authorId,
          username: firstVideo.authorName || authorId,
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

      creators.push({
        accountId: authorId,
        username: firstVideo.authorName || authorId,
        avgEngagement,
        relevanceScore,
        topHashtags,
        discoveredFrom: [sourceKeyword],
        sampleVideos: data.videos.slice(0, 3).map(v => v.authorId) // TODO: Add video URLs
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
    const where: any = { relevanceScore: { gte: minRelevance } }

    if (sourceKeyword) {
      where.discoveredFrom = { has: sourceKeyword }
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
   * Calculate relevance score
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

    const engagementScore = Math.min(avgEngagement * 10, 40) // Max 40 points
    const overlapScore = contentOverlap * 40 // Max 40 points
    const volumeScore = Math.min(videoCount * 5, 20) // Max 20 points

    return Math.round(
      engagementScore * engagementWeight +
      overlapScore * overlapWeight +
      volumeScore * volumeWeight
    ) * 2.5 // Scale to 0-100
  }
}

export const accountDiscoveryService = new AccountDiscoveryService()
```

### 2.4 Recommendation Engine

**File: `lib/expansion/recommendation-engine.ts`**

```typescript
import { prisma } from '@/lib/prisma'
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
    const accounts = await accountDiscoveryService.getDiscoveredAccounts(
      undefined,
      40,
      15
    )

    return accounts.map(a => ({
      id: `acc-${a.accountId}-${Date.now()}`,
      type: 'account' as const,
      item: a.username,
      score: a.relevanceScore,
      reason: this.generateAccountReason(a),
      sourceKeyword: a.discoveredFrom[0],
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
        reason: `"${topRec.item}" frequently appears with your tracked keywords`,
        expectedResults: 'Discover new creators and content in related topics',
        priority: 'high',
        type: 'expand'
      })
    }

    // Suggestion 2: Combine tracked keywords
    if (trackedKeywords.length >= 2) {
      const combo = `${trackedKeywords[0]} ${trackedKeywords[1]}`
      suggestions.push({
        query: combo,
        reason: 'Combining your tracked keywords may reveal intersection content',
        expectedResults: 'Find content that bridges your tracked topics',
        priority: 'medium',
        type: 'explore'
      })
    }

    // Suggestion 3: Trending validation
    suggestions.push({
      query: `trending ${trackedKeywords[0]}`,
      reason: 'Check what\'s currently trending in your tracked topic',
      expectedResults: 'Identify current viral content and emerging creators',
      priority: 'medium',
      type: 'validate'
    })

    // Suggestion 4: Gap exploration (from recommendations)
    const gapKeywords = keywordRecs
      .filter(r => r.score > 60 && r.metadata?.trendDirection === 'rising')
      .slice(0, 2)

    for (const gap of gapKeywords) {
      suggestions.push({
        query: `#${gap.item}`,
        reason: `Rising topic "${gap.item}" has high engagement overlap`,
        expectedResults: 'Catch emerging trends before they peak',
        priority: 'high',
        type: 'expand'
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
      await prisma.expansionRecommendation.create({
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
    }
  }

  /**
   * Get stored recommendations
   */
  async getStoredRecommendations(
    type?: 'keyword' | 'account' | 'hashtag',
    limit = 20
  ): Promise<ExpansionRecommendation[]> {
    const where: any = {
      status: 'pending',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }

    if (type) where.type = type

    const stored = await prisma.expansionRecommendation.findMany({
      where,
      orderBy: { score: 'desc' },
      take: limit
    })

    return stored.map(r => ({
      id: r.id,
      type: r.type as 'keyword' | 'account' | 'hashtag',
      item: r.recommendedItem,
      score: r.score,
      reason: r.reason,
      sourceKeyword: r.sourceKeyword,
      metadata: r.metadata as any
    }))
  }

  /**
   * Mark recommendation as accepted/dismissed
   */
  async updateRecommendationStatus(
    id: string,
    status: 'accepted' | 'dismissed'
  ): Promise<void> {
    await prisma.expansionRecommendation.update({
      where: { id },
      data: { status }
    })
  }

  // Helper methods for generating reasons
  private generateKeywordReason(sourceKeyword: string, relation: any): string {
    const engagement = relation.avgEngagement > 5 ? 'high' : relation.avgEngagement > 2 ? 'good' : 'moderate'
    return `"#${relation.hashtag}" appears ${relation.coOccurrenceCount}x with "${sourceKeyword}" content, with ${engagement} engagement`
  }

  private generateAccountReason(account: any): string {
    const topics = account.topHashtags.slice(0, 3).join(', ')
    return `Creator with ${Math.round(account.avgEngagement * 100) / 100}% engagement, posting about: ${topics}`
  }
}

export const recommendationEngine = new ExpansionRecommendationEngine()
```

---

## Phase 3: API Endpoints

### 3.1 Keywords Expansion Endpoint

**File: `app/api/v1/trends/expand/keywords/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { coOccurrenceAnalyzer } from '@/lib/expansion/co-occurrence'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sourceKeyword = searchParams.get('sourceKeyword')
    const trackedKeywords = searchParams.get('tracked')?.split(',') || []
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!sourceKeyword) {
      return NextResponse.json(
        { error: 'sourceKeyword parameter required' },
        { status: 400 }
      )
    }

    const related = await coOccurrenceAnalyzer.getRelatedHashtags(
      sourceKeyword,
      trackedKeywords,
      limit
    )

    return NextResponse.json({
      success: true,
      sourceKeyword,
      relatedHashtags: related,
      count: related.length
    })
  } catch (error) {
    console.error('Keyword expansion error:', error)
    return NextResponse.json(
      { error: 'Failed to get keyword expansions' },
      { status: 500 }
    )
  }
}
```

### 3.2 Account Discovery Endpoint

**File: `app/api/v1/trends/expand/accounts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { accountDiscoveryService } from '@/lib/expansion/account-discovery'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sourceKeyword = searchParams.get('sourceKeyword') || undefined
    const minRelevance = parseInt(searchParams.get('minRelevance') || '30')
    const limit = parseInt(searchParams.get('limit') || '20')

    const accounts = await accountDiscoveryService.getDiscoveredAccounts(
      sourceKeyword,
      minRelevance,
      limit
    )

    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length
    })
  } catch (error) {
    console.error('Account discovery error:', error)
    return NextResponse.json(
      { error: 'Failed to get discovered accounts' },
      { status: 500 }
    )
  }
}
```

### 3.3 Recommendations Endpoint

**File: `app/api/v1/trends/recommendations/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { recommendationEngine } from '@/lib/expansion/recommendation-engine'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const trackedKeywords = searchParams.get('tracked')?.split(',') || []
    const type = searchParams.get('type') as 'keyword' | 'account' | undefined

    if (trackedKeywords.length === 0) {
      // Return stored recommendations
      const stored = await recommendationEngine.getStoredRecommendations(type)
      return NextResponse.json({ success: true, recommendations: stored })
    }

    // Generate fresh recommendations
    const recommendations = await recommendationEngine.generateRecommendations(
      trackedKeywords
    )

    return NextResponse.json({
      success: true,
      ...recommendations
    })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recommendationId, action } = body

    if (!recommendationId || !['accepted', 'dismissed'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    await recommendationEngine.updateRecommendationStatus(recommendationId, action)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Recommendation update error:', error)
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    )
  }
}
```

---

## Phase 4: AI Agent - Expansion Analyzer

**File: `lib/agents/analyzers/expansion-analyzer.ts`**

```typescript
import { BaseAgent } from '@/lib/agents/base-agent'
import { z } from 'zod'
import type { AgentContext } from '@/lib/agents/types'

export const ExpansionAnalyzerInputSchema = z.object({
  trackedKeywords: z.array(z.string()),
  coOccurrenceData: z.array(z.object({
    hashtag: z.string(),
    coOccurrenceCount: z.number(),
    avgEngagement: z.number()
  })),
  discoveredAccounts: z.array(z.object({
    username: z.string(),
    topHashtags: z.array(z.string()),
    avgEngagement: z.number()
  })).optional()
})

export const ExpansionAnalyzerOutputSchema = z.object({
  strategicInsights: z.array(z.string()),
  prioritizedExpansions: z.array(z.object({
    item: z.string(),
    type: z.enum(['keyword', 'account']),
    priority: z.enum(['high', 'medium', 'low']),
    reasoning: z.string()
  })),
  gapAnalysis: z.string(),
  nextSteps: z.array(z.string())
})

export type ExpansionAnalyzerInput = z.infer<typeof ExpansionAnalyzerInputSchema>
export type ExpansionAnalyzerOutput = z.infer<typeof ExpansionAnalyzerOutputSchema>

export class ExpansionAnalyzerAgent extends BaseAgent<
  ExpansionAnalyzerInput,
  ExpansionAnalyzerOutput
> {
  constructor() {
    super({
      id: 'expansion-analyzer',
      name: 'Expansion Analyzer',
      description: 'Analyzes co-occurrence patterns and generates strategic expansion recommendations',
      category: 'analyzer',
      model: {
        provider: 'gemini',
        name: 'gemini-2.5-flash',
        options: { temperature: 0.7 }
      },
      prompts: {
        system: `You are a TikTok trend expansion strategist. Your role is to analyze hashtag co-occurrence patterns and discovered accounts to provide strategic recommendations for expanding keyword/account tracking.

Focus on:
1. Identifying "bridge" hashtags that connect different topic clusters
2. Spotting emerging trends before they peak
3. Finding high-engagement niches within tracked topics
4. Recommending accounts that represent untapped content territories

Be specific and actionable in your recommendations. Explain WHY each expansion is valuable.`,
        templates: {}
      },
      inputSchema: ExpansionAnalyzerInputSchema,
      outputSchema: ExpansionAnalyzerOutputSchema
    })
  }

  protected buildPrompt(input: ExpansionAnalyzerInput, context: AgentContext): string {
    return `Analyze the following trend expansion data and provide strategic recommendations.

TRACKED KEYWORDS:
${input.trackedKeywords.map(k => `- ${k}`).join('\n')}

CO-OCCURRENCE DATA (hashtags that appear with tracked keywords):
${input.coOccurrenceData.slice(0, 20).map(c =>
  `- #${c.hashtag}: appears ${c.coOccurrenceCount}x, ${c.avgEngagement.toFixed(2)}% avg engagement`
).join('\n')}

${input.discoveredAccounts ? `
DISCOVERED ACCOUNTS:
${input.discoveredAccounts.slice(0, 10).map(a =>
  `- @${a.username}: ${a.avgEngagement.toFixed(2)}% engagement, topics: ${a.topHashtags.slice(0, 5).join(', ')}`
).join('\n')}
` : ''}

Provide:
1. Strategic insights about the expansion opportunities
2. Prioritized list of keywords/accounts to add to tracking
3. Gap analysis - what topics are missing from current tracking?
4. Specific next steps for research

Format your response as JSON matching this structure:
{
  "strategicInsights": ["insight1", "insight2", ...],
  "prioritizedExpansions": [
    {"item": "hashtag or username", "type": "keyword or account", "priority": "high/medium/low", "reasoning": "why this expansion is valuable"}
  ],
  "gapAnalysis": "analysis of what's missing",
  "nextSteps": ["step1", "step2", ...]
}`
  }
}

export function createExpansionAnalyzerAgent(): ExpansionAnalyzerAgent {
  return new ExpansionAnalyzerAgent()
}
```

---

## Phase 5: UI Components

### 5.1 Related Keywords Discovery Component

**File: `components/trends/expansion/RelatedKeywordsDiscovery.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface RelatedKeywordsDiscoveryProps {
  sourceKeyword: string
  trackedKeywords: string[]
  onAddKeyword: (keyword: string) => void
}

export function RelatedKeywordsDiscovery({
  sourceKeyword,
  trackedKeywords,
  onAddKeyword
}: RelatedKeywordsDiscoveryProps) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['related-keywords', sourceKeyword, trackedKeywords],
    queryFn: async () => {
      const params = new URLSearchParams({
        sourceKeyword,
        tracked: trackedKeywords.join(','),
        limit: '15'
      })
      const res = await fetch(`/api/v1/trends/expand/keywords?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!sourceKeyword,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'rising': return <TrendingUp className="h-3 w-3 text-green-500" />
      case 'declining': return <TrendingDown className="h-3 w-3 text-red-500" />
      default: return <Minus className="h-3 w-3 text-gray-400" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-100 text-green-800 border-green-200'
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4" />
            Related Keywords
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data?.relatedHashtags?.length) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4" />
          Discover Related Keywords
          <Badge variant="outline" className="ml-auto">
            {data.relatedHashtags.length} found
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.relatedHashtags.map((item: any) => (
            <div
              key={item.hashtag}
              className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">#{item.hashtag}</span>
                {getTrendIcon(item.trendDirection)}
                <Badge variant="outline" className={getScoreColor(item.expansionScore)}>
                  {item.expansionScore}점
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {item.coOccurrenceCount}회 동시출현
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAddKeyword(item.hashtag)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 5.2 Suggested Accounts Component

**File: `components/trends/expansion/SuggestedAccounts.tsx`**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { User, ExternalLink, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface SuggestedAccountsProps {
  sourceKeyword?: string
  onTrackAccount?: (accountId: string, username: string) => void
}

export function SuggestedAccounts({
  sourceKeyword,
  onTrackAccount
}: SuggestedAccountsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['suggested-accounts', sourceKeyword],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '10' })
      if (sourceKeyword) params.set('sourceKeyword', sourceKeyword)

      const res = await fetch(`/api/v1/trends/expand/accounts?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    staleTime: 5 * 60 * 1000
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" />
            Suggested Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data?.accounts?.length) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" />
          Suggested Accounts
          <Badge variant="outline" className="ml-auto">
            {data.accounts.length} discovered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.accounts.map((account: any) => (
            <div
              key={account.accountId}
              className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent/50 transition-colors"
            >
              <Avatar>
                <AvatarFallback>
                  {account.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">@{account.username}</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(account.relevanceScore)}% 관련
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>{(account.avgEngagement * 100).toFixed(1)}% 참여율</span>
                  <span className="truncate">
                    {account.topHashtags.slice(0, 3).map((h: string) => `#${h}`).join(' ')}
                  </span>
                </div>
              </div>

              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`https://tiktok.com/@${account.username}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {onTrackAccount && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onTrackAccount(account.accountId, account.username)}
                  >
                    Track
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 5.3 Search Recommendations Component

**File: `components/trends/expansion/SearchRecommendations.tsx`**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Search, Lightbulb, ArrowRight, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SearchRecommendationsProps {
  trackedKeywords: string[]
  onSearch: (query: string) => void
}

export function SearchRecommendations({
  trackedKeywords,
  onSearch
}: SearchRecommendationsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['search-recommendations', trackedKeywords],
    queryFn: async () => {
      const params = new URLSearchParams({
        tracked: trackedKeywords.join(',')
      })
      const res = await fetch(`/api/v1/trends/recommendations?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: trackedKeywords.length > 0,
    staleTime: 10 * 60 * 1000
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'expand': return <Zap className="h-3 w-3" />
      case 'explore': return <Search className="h-3 w-3" />
      default: return <Lightbulb className="h-3 w-3" />
    }
  }

  if (isLoading || !data?.searches?.length) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="h-4 w-4" />
          Recommended Next Searches
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.searches.map((suggestion: any, index: number) => (
            <div
              key={index}
              className="p-3 rounded-lg border bg-gradient-to-r from-background to-accent/20 hover:to-accent/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getTypeIcon(suggestion.type)}
                    <span className="font-medium">{suggestion.query}</span>
                    <Badge variant="outline" className={getPriorityColor(suggestion.priority)}>
                      {suggestion.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {suggestion.reason}
                  </p>
                  <p className="text-xs text-muted-foreground/70 italic">
                    → {suggestion.expectedResults}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onSearch(suggestion.query)}
                >
                  Search
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Phase 6: Integration with Existing Pages

### 6.1 Trend Dashboard Integration

**Modify: `app/(dashboard)/trend-dashboard/page.tsx`**

Add after existing content sections:

```tsx
// Import new components
import { RelatedKeywordsDiscovery } from '@/components/trends/expansion/RelatedKeywordsDiscovery'
import { SuggestedAccounts } from '@/components/trends/expansion/SuggestedAccounts'
import { SearchRecommendations } from '@/components/trends/expansion/SearchRecommendations'

// Add in the render, after existing tracked keywords section:

{/* Expansion Discovery Section */}
{selectedKeyword && (
  <div className="space-y-4 mt-6">
    <h2 className="text-lg font-semibold flex items-center gap-2">
      <Sparkles className="h-5 w-5" />
      Expand Your Research
    </h2>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RelatedKeywordsDiscovery
        sourceKeyword={selectedKeyword}
        trackedKeywords={trackedKeywords}
        onAddKeyword={handleAddKeyword}
      />

      <SuggestedAccounts
        sourceKeyword={selectedKeyword}
        onTrackAccount={handleTrackAccount}
      />
    </div>

    <SearchRecommendations
      trackedKeywords={trackedKeywords}
      onSearch={handleSearch}
    />
  </div>
)}
```

### 6.2 Trigger Expansion Analysis on Keyword Analysis

**Modify: `app/api/v1/trends/keyword-analysis/route.ts`**

Add expansion processing after keyword analysis:

```typescript
// After successful keyword analysis, trigger expansion analysis
import { coOccurrenceAnalyzer } from '@/lib/expansion/co-occurrence'
import { accountDiscoveryService } from '@/lib/expansion/account-discovery'

// In the POST handler, after getting videos:
// Process co-occurrences
await coOccurrenceAnalyzer.processVideos(videos, keyword)

// Discover accounts
await accountDiscoveryService.discoverFromVideos(
  videos,
  keyword,
  trackedKeywords
)
```

---

## Optional: Google Custom Search Integration

**If truly needed for cross-platform validation:**

**File: `lib/external/google-search.ts`**

```typescript
export class GoogleCustomSearchService {
  private apiKey: string
  private searchEngineId: string

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || ''
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || ''
  }

  async searchRelatedTopics(keyword: string): Promise<any[]> {
    if (!this.apiKey || !this.searchEngineId) {
      console.warn('Google Custom Search not configured')
      return []
    }

    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', this.apiKey)
    url.searchParams.set('cx', this.searchEngineId)
    url.searchParams.set('q', `${keyword} trend 2025`)
    url.searchParams.set('num', '10')

    const res = await fetch(url.toString())
    if (!res.ok) return []

    const data = await res.json()
    return data.items || []
  }
}
```

**Decision: NOT included in core implementation**
- Current TikTok scraping provides sufficient data
- Can be added later if cross-platform validation is needed
- Requires Google API key and billing setup

---

## Implementation Checklist

### Phase 1: Database
- [ ] Add HashtagCoOccurrence model to schema.prisma
- [ ] Add DiscoveredAccount model to schema.prisma
- [ ] Add ExpansionRecommendation model to schema.prisma
- [ ] Run migration: `npx prisma migrate dev --name add_expansion_tables`

### Phase 2: Backend Services
- [ ] Create `lib/expansion/types.ts`
- [ ] Create `lib/expansion/co-occurrence.ts`
- [ ] Create `lib/expansion/account-discovery.ts`
- [ ] Create `lib/expansion/recommendation-engine.ts`
- [ ] Create `lib/expansion/index.ts` (exports)

### Phase 3: API Endpoints
- [ ] Create `app/api/v1/trends/expand/keywords/route.ts`
- [ ] Create `app/api/v1/trends/expand/accounts/route.ts`
- [ ] Create `app/api/v1/trends/recommendations/route.ts`
- [ ] Add expansion trigger to existing keyword-analysis endpoint

### Phase 4: AI Agent
- [ ] Create `lib/agents/analyzers/expansion-analyzer.ts`
- [ ] Register agent in agent factory

### Phase 5: UI Components
- [ ] Create `components/trends/expansion/RelatedKeywordsDiscovery.tsx`
- [ ] Create `components/trends/expansion/SuggestedAccounts.tsx`
- [ ] Create `components/trends/expansion/SearchRecommendations.tsx`
- [ ] Create `components/trends/expansion/ExpansionScoreBadge.tsx`
- [ ] Create `components/trends/expansion/RecommendationCard.tsx`
- [ ] Create `components/trends/expansion/index.ts` (exports)

### Phase 6: Integration
- [ ] Add expansion section to trend-dashboard/page.tsx
- [ ] Add discovery section to trends/page.tsx
- [ ] Add React Query hooks to lib/queries.ts
- [ ] Test end-to-end flow

### Phase 7: Optional
- [ ] Google Custom Search integration (if requested)
- [ ] Network visualization component
- [ ] Historical tracking improvements

---

## Sources

- [TikTok Creative Center - Keyword Insights](https://ads.tiktok.com/business/creativecenter/keyword-insights/pc/en)
- [TikTok Creative Center - Trend Discovery](https://ads.tiktok.com/business/creativecenter/trends/hub/pc/en)
- [Bellingcat TikTok Hashtag Analysis Tool](https://www.bellingcat.com/resources/how-tos/2022/05/11/this-new-tool-lets-you-analyse-tiktok-hashtags/)
- [TikTok Hashtag Analysis Python Package](https://pypi.org/project/tiktok-hashtag-analysis/)
- [Hootsuite - TikTok Algorithm 2025](https://blog.hootsuite.com/tiktok-algorithm/)
- [Sprout Social - TikTok Hashtags](https://sproutsocial.com/insights/tiktok-hashtags/)
- [Data365 - TikTok Trends API](https://data365.co/blog/tiktok-trends-api)
- [WordStream - TikTok Trend Discovery](https://www.wordstream.com/blog/ws/2023/12/14/tiktok-trend-discovery)
- [Academic Research - Hashtag Co-occurrence Networks](https://arxiv.org/html/2501.16123v1)
