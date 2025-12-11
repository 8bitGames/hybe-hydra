// Trend Expansion System - Type Definitions

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

// Input types for services
export interface VideoForAnalysis {
  hashtags: string[]
  authorId: string
  authorName?: string
  stats?: {
    playCount?: number
    likeCount?: number
    engagementRate?: number
  }
}

// API response types
export interface KeywordExpansionResponse {
  success: boolean
  sourceKeyword: string
  relatedHashtags: HashtagRelation[]
  count: number
}

export interface AccountDiscoveryResponse {
  success: boolean
  accounts: DiscoveredCreator[]
  count: number
}

export interface RecommendationsResponse {
  success: boolean
  keywords: ExpansionRecommendation[]
  accounts: ExpansionRecommendation[]
  searches: SearchSuggestion[]
}
