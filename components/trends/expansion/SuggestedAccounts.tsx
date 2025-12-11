'use client'

import { User, ExternalLink, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export interface CreatorData {
  id: string
  name: string
  videoCount: number
  avgEngagement: number
  totalViews: number
}

interface SuggestedAccountsProps {
  /** Top creators from keyword analysis */
  creators: CreatorData[]
  className?: string
}

/**
 * Generate TikTok profile URL
 */
function getTikTokProfileUrl(username: string): string {
  // Clean up username (remove @ if present)
  const cleanUsername = username.replace(/^@/, '')
  return `https://www.tiktok.com/@${encodeURIComponent(cleanUsername)}`
}

export function SuggestedAccounts({
  creators,
  className
}: SuggestedAccountsProps) {
  const getEngagementColor = (engagement: number) => {
    if (engagement >= 5) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    if (engagement >= 2) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
  }

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
    return views.toString()
  }

  if (creators.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            추천 계정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            추천할 계정이 없습니다. 더 많은 키워드를 분석해보세요.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <User className="h-4 w-4" />
          추천 계정
          <Badge variant="outline" className="ml-auto text-xs">
            {creators.length}명
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {creators.map((creator) => (
            <a
              key={creator.id}
              href={getTikTokProfileUrl(creator.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-accent/50 transition-colors block"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="text-xs">
                  {creator.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate flex items-center gap-1">
                    @{creator.name}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </span>
                  <Badge
                    variant="outline"
                    className={cn('text-xs shrink-0', getEngagementColor(creator.avgEngagement))}
                  >
                    {creator.avgEngagement.toFixed(1)}% 참여율
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {formatViews(creator.totalViews)} 조회
                  </span>
                  <span>{creator.videoCount}개 영상</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
