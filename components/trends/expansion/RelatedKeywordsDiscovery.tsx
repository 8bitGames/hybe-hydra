'use client'

import { useState } from 'react'
import { Plus, TrendingUp, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface HashtagData {
  tag: string
  count: number
  avgEngagement: number
}

interface RelatedKeywordsDiscoveryProps {
  /** Top hashtags from keyword analysis */
  hashtags: HashtagData[]
  /** Source keyword for context */
  sourceKeyword?: string
  /** Currently tracked keywords (to filter out) */
  trackedKeywords?: string[]
  /** Callback when user wants to add a keyword to tracking */
  onAddKeyword?: (keyword: string) => void
  className?: string
}

/**
 * Generate TikTok hashtag URL
 */
function getTikTokHashtagUrl(hashtag: string): string {
  const tag = hashtag.replace(/^#/, '')
  return `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`
}

export function RelatedKeywordsDiscovery({
  hashtags,
  sourceKeyword,
  trackedKeywords = [],
  onAddKeyword,
  className
}: RelatedKeywordsDiscoveryProps) {
  const [addingKeyword, setAddingKeyword] = useState<string | null>(null)

  // Filter out already tracked keywords
  const trackedSet = new Set(trackedKeywords.map(k => k.toLowerCase().replace(/^#/, '')))
  const filteredHashtags = hashtags.filter(h => {
    const normalized = h.tag.toLowerCase().replace(/^#/, '')
    return !trackedSet.has(normalized)
  })

  const handleAddKeyword = async (hashtag: string) => {
    if (!onAddKeyword) return
    setAddingKeyword(hashtag)
    try {
      await onAddKeyword(hashtag)
    } finally {
      setAddingKeyword(null)
    }
  }

  const getEngagementColor = (engagement: number) => {
    if (engagement >= 5) return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
    if (engagement >= 2) return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
    return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
  }

  if (filteredHashtags.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            관련 키워드 발견
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            관련 키워드가 없습니다. 더 많은 키워드를 분석해보세요.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          관련 키워드 발견
          <Badge variant="outline" className="ml-auto text-xs">
            {filteredHashtags.length}개
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {filteredHashtags.map((item) => (
            <div
              key={item.tag}
              className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <a
                  href={getTikTokHashtagUrl(item.tag)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm truncate hover:text-primary hover:underline flex items-center gap-1"
                >
                  #{item.tag}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
                <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
                <Badge
                  variant="outline"
                  className={cn('text-xs shrink-0', getEngagementColor(item.avgEngagement))}
                >
                  {item.avgEngagement.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {item.count}회
                </span>
                {onAddKeyword && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => handleAddKeyword(item.tag)}
                    disabled={addingKeyword === item.tag}
                  >
                    {addingKeyword === item.tag ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
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
