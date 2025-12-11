'use client'

import { Lightbulb, ArrowRight, Zap, Compass, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface HashtagData {
  tag: string
  count: number
  avgEngagement: number
}

export interface CreatorData {
  id: string
  name: string
  videoCount: number
  avgEngagement: number
  totalViews: number
}

interface SearchRecommendation {
  query: string
  type: 'hashtag' | 'creator'
  reason: string
  engagement: number
}

interface SearchRecommendationsProps {
  /** Top hashtags from analysis (for hashtag recommendations) */
  hashtags?: HashtagData[]
  /** Top creators from analysis (for creator recommendations) */
  creators?: CreatorData[]
  /** Currently tracked keywords (to filter out) */
  trackedKeywords?: string[]
  className?: string
}

/**
 * Generate TikTok URL based on query type
 */
function getTikTokUrl(query: string, type: 'hashtag' | 'creator'): string {
  if (type === 'creator') {
    const username = query.replace(/^@/, '')
    return `https://www.tiktok.com/@${encodeURIComponent(username)}`
  }
  const hashtag = query.replace(/^#/, '')
  return `https://www.tiktok.com/tag/${encodeURIComponent(hashtag)}`
}

/**
 * Generate recommendations from analysis data
 */
function generateRecommendations(
  hashtags: HashtagData[],
  creators: CreatorData[],
  trackedKeywords: string[]
): SearchRecommendation[] {
  const recommendations: SearchRecommendation[] = []
  const trackedSet = new Set(trackedKeywords.map(k => k.toLowerCase().replace(/^#/, '')))

  // Add top hashtags as recommendations (filter out tracked)
  const filteredHashtags = hashtags.filter(h => {
    const normalized = h.tag.toLowerCase().replace(/^#/, '')
    return !trackedSet.has(normalized)
  })

  // Sort by engagement and take top 3 hashtags
  const topHashtags = [...filteredHashtags]
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 3)

  for (const h of topHashtags) {
    recommendations.push({
      query: `#${h.tag}`,
      type: 'hashtag',
      reason: `${h.avgEngagement.toFixed(1)}% 참여율, ${h.count}회 사용됨`,
      engagement: h.avgEngagement
    })
  }

  // Add top 2 creators as recommendations
  const topCreators = [...creators]
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 2)

  for (const c of topCreators) {
    recommendations.push({
      query: `@${c.name}`,
      type: 'creator',
      reason: `${c.avgEngagement.toFixed(1)}% 참여율, ${c.videoCount}개 영상`,
      engagement: c.avgEngagement
    })
  }

  // Sort all by engagement and return top 5
  return recommendations
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5)
}

export function SearchRecommendations({
  hashtags = [],
  creators = [],
  trackedKeywords = [],
  className
}: SearchRecommendationsProps) {
  const recommendations = generateRecommendations(hashtags, creators, trackedKeywords)

  const getEngagementColor = (engagement: number) => {
    if (engagement >= 5) return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
    if (engagement >= 2) return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
    return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
  }

  const getTypeIcon = (type: 'hashtag' | 'creator') => {
    switch (type) {
      case 'hashtag':
        return <Zap className="h-3.5 w-3.5 text-amber-500" />
      case 'creator':
        return <Compass className="h-3.5 w-3.5 text-blue-500" />
    }
  }

  const getTypeLabel = (type: 'hashtag' | 'creator') => {
    switch (type) {
      case 'hashtag': return '해시태그'
      case 'creator': return '크리에이터'
    }
  }

  if (recommendations.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4" />
            추천 검색
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            추천할 검색이 없습니다. 더 많은 키워드를 분석해보세요.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="h-4 w-4" />
          추천 검색
          <Badge variant="outline" className="ml-auto text-xs">
            {recommendations.length}개
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <a
              key={index}
              href={getTikTokUrl(rec.query, rec.type)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg border bg-gradient-to-r from-background to-accent/20 hover:to-accent/40 transition-colors block"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {getTypeIcon(rec.type)}
                    <span className="font-medium text-sm hover:text-primary flex items-center gap-1">
                      {rec.query}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', getEngagementColor(rec.engagement))}
                    >
                      {rec.engagement.toFixed(1)}%
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {getTypeLabel(rec.type)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {rec.reason}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
