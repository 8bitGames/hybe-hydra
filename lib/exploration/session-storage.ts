/**
 * Session Storage - 탐색 세션 저장 및 조회
 *
 * 목적:
 * - 탐색 결과를 DB에 저장하여 이력 관리
 * - 히트맵 등 트렌드 분석 시각화를 위한 데이터 제공
 */

import { prisma } from '@/lib/db/prisma'
import { ExplorationStrategy as PrismaExplorationStrategy } from '@prisma/client'
import type {
  ExplorationResult,
  ExplorationStrategy,
  Discovery,
  ExplorationNetwork,
  ExplorationStats,
  TrendInsights,
} from './types'

// ============================================================================
// 타입 변환 헬퍼
// ============================================================================

/**
 * ExplorationStrategy (lowercase) -> Prisma enum (uppercase) 변환
 */
function toPrismaStrategy(strategy: ExplorationStrategy): PrismaExplorationStrategy {
  switch (strategy) {
    case 'novelty':
      return PrismaExplorationStrategy.NOVELTY
    case 'popularity':
      return PrismaExplorationStrategy.POPULARITY
    case 'balanced':
    default:
      return PrismaExplorationStrategy.BALANCED
  }
}

/**
 * Prisma enum -> ExplorationStrategy (lowercase) 변환
 */
function fromPrismaStrategy(strategy: PrismaExplorationStrategy): ExplorationStrategy {
  switch (strategy) {
    case PrismaExplorationStrategy.NOVELTY:
      return 'novelty'
    case PrismaExplorationStrategy.POPULARITY:
      return 'popularity'
    case PrismaExplorationStrategy.BALANCED:
    default:
      return 'balanced'
  }
}

// ============================================================================
// 세션 저장
// ============================================================================

export interface SaveSessionOptions {
  /** 탐색 결과 */
  result: ExplorationResult
  /** 사용자 ID */
  userId: string
  /** LLM 인사이트 (옵션) */
  insights?: TrendInsights | null
  /** 만료 시간 (기본 30일) */
  expiresInDays?: number
}

/**
 * 탐색 세션을 DB에 저장
 */
export async function saveExplorationSession(options: SaveSessionOptions): Promise<string> {
  const { result, userId, insights, expiresInDays = 30 } = options

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  try {
    const session = await prisma.explorationSession.create({
      data: {
        id: result.explorationId,
        userId,
        seedKeyword: result.seedKeyword,
        depth: result.depth,
        strategy: toPrismaStrategy(result.strategy),
        totalDiscoveries: result.discoveries.length,
        totalSearches: result.stats.totalSearches,
        totalVideosAnalyzed: result.stats.totalVideosAnalyzed,
        durationMs: result.stats.durationMs,
        discoveries: result.discoveries as any,
        network: result.network as any,
        stats: {
          ...result.stats,
          insights: insights || undefined,
        } as any,
        expiresAt,
      },
    })

    console.log(`[SESSION-STORAGE] Saved session: ${session.id}`)
    return session.id
  } catch (error) {
    console.error('[SESSION-STORAGE] Failed to save session:', error)
    throw error
  }
}

// ============================================================================
// 세션 조회
// ============================================================================

/**
 * 세션 ID로 탐색 결과 조회
 */
export async function getExplorationSession(sessionId: string): Promise<ExplorationResult | null> {
  try {
    const session = await prisma.explorationSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) return null

    return {
      explorationId: session.id,
      seedKeyword: session.seedKeyword,
      depth: session.depth,
      strategy: fromPrismaStrategy(session.strategy),
      discoveries: (session.discoveries as Discovery[]) || [],
      network: (session.network as ExplorationNetwork) || { nodes: [], edges: [] },
      stats: {
        totalSearches: session.totalSearches,
        totalVideosAnalyzed: session.totalVideosAnalyzed,
        uniqueHashtagsFound: session.totalDiscoveries,
        newDiscoveriesCount: session.totalDiscoveries,
        durationMs: session.durationMs,
      },
      completedAt: session.createdAt.toISOString(),
    }
  } catch (error) {
    console.error('[SESSION-STORAGE] Failed to get session:', error)
    return null
  }
}

/**
 * 사용자의 탐색 히스토리 조회
 */
export async function getUserExplorationHistory(
  userId: string,
  options?: {
    limit?: number
    offset?: number
    seedKeyword?: string
  }
): Promise<{
  sessions: Array<{
    id: string
    seedKeyword: string
    depth: number
    strategy: ExplorationStrategy
    totalDiscoveries: number
    createdAt: Date
  }>
  total: number
}> {
  const { limit = 20, offset = 0, seedKeyword } = options || {}

  try {
    const where = {
      userId,
      ...(seedKeyword && { seedKeyword: { contains: seedKeyword } }),
    }

    const [sessions, total] = await Promise.all([
      prisma.explorationSession.findMany({
        where,
        select: {
          id: true,
          seedKeyword: true,
          depth: true,
          strategy: true,
          totalDiscoveries: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.explorationSession.count({ where }),
    ])

    return {
      sessions: sessions.map(s => ({
        id: s.id,
        seedKeyword: s.seedKeyword,
        depth: s.depth,
        strategy: fromPrismaStrategy(s.strategy),
        totalDiscoveries: s.totalDiscoveries,
        createdAt: s.createdAt,
      })),
      total,
    }
  } catch (error) {
    console.error('[SESSION-STORAGE] Failed to get history:', error)
    return { sessions: [], total: 0 }
  }
}

// ============================================================================
// 히트맵/분석용 집계 함수
// ============================================================================

/**
 * 키워드별 트렌드 히트맵 데이터 조회
 * - 시간대별 키워드 출현 빈도
 * - 인기도/새로움 점수 추이
 */
export async function getKeywordHeatmapData(
  userId: string,
  options?: {
    days?: number
    topN?: number
  }
): Promise<{
  keywords: Array<{
    keyword: string
    totalOccurrences: number
    avgNoveltyScore: number
    avgPopularityScore: number
    firstSeen: Date
    lastSeen: Date
    dailyData: Array<{
      date: string
      count: number
      avgScore: number
    }>
  }>
  dateRange: {
    start: Date
    end: Date
  }
}> {
  const { days = 30, topN = 50 } = options || {}

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  try {
    // 기간 내 모든 세션 조회
    const sessions = await prisma.explorationSession.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      select: {
        discoveries: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // 키워드별 데이터 집계
    const keywordMap = new Map<string, {
      keyword: string
      totalOccurrences: number
      totalNoveltyScore: number
      totalPopularityScore: number
      firstSeen: Date
      lastSeen: Date
      dailyCounts: Map<string, { count: number; totalScore: number }>
    }>()

    for (const session of sessions) {
      const discoveries = session.discoveries as Discovery[] || []
      const dateKey = session.createdAt.toISOString().split('T')[0]

      for (const discovery of discoveries) {
        const keyword = discovery.keyword.toLowerCase()
        const existing = keywordMap.get(keyword)

        if (existing) {
          existing.totalOccurrences++
          existing.totalNoveltyScore += discovery.noveltyScore
          existing.totalPopularityScore += discovery.popularityScore
          existing.lastSeen = session.createdAt

          const daily = existing.dailyCounts.get(dateKey)
          if (daily) {
            daily.count++
            daily.totalScore += discovery.totalScore
          } else {
            existing.dailyCounts.set(dateKey, {
              count: 1,
              totalScore: discovery.totalScore,
            })
          }
        } else {
          const dailyCounts = new Map<string, { count: number; totalScore: number }>()
          dailyCounts.set(dateKey, {
            count: 1,
            totalScore: discovery.totalScore,
          })

          keywordMap.set(keyword, {
            keyword: discovery.keyword,
            totalOccurrences: 1,
            totalNoveltyScore: discovery.noveltyScore,
            totalPopularityScore: discovery.popularityScore,
            firstSeen: session.createdAt,
            lastSeen: session.createdAt,
            dailyCounts,
          })
        }
      }
    }

    // 상위 N개 키워드 선택 및 변환
    const keywords = Array.from(keywordMap.values())
      .sort((a, b) => b.totalOccurrences - a.totalOccurrences)
      .slice(0, topN)
      .map(k => ({
        keyword: k.keyword,
        totalOccurrences: k.totalOccurrences,
        avgNoveltyScore: Math.round(k.totalNoveltyScore / k.totalOccurrences),
        avgPopularityScore: Math.round(k.totalPopularityScore / k.totalOccurrences),
        firstSeen: k.firstSeen,
        lastSeen: k.lastSeen,
        dailyData: Array.from(k.dailyCounts.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({
            date,
            count: data.count,
            avgScore: Math.round(data.totalScore / data.count),
          })),
      }))

    return {
      keywords,
      dateRange: {
        start: startDate,
        end: new Date(),
      },
    }
  } catch (error) {
    console.error('[SESSION-STORAGE] Failed to get heatmap data:', error)
    return {
      keywords: [],
      dateRange: { start: startDate, end: new Date() },
    }
  }
}

/**
 * 시드 키워드별 탐색 통계
 */
export async function getSeedKeywordStats(
  userId: string,
  options?: {
    days?: number
    limit?: number
  }
): Promise<Array<{
  seedKeyword: string
  explorationCount: number
  totalDiscoveries: number
  avgDiscoveriesPerSession: number
  lastExploredAt: Date
}>> {
  const { days = 90, limit = 20 } = options || {}

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  try {
    const stats = await prisma.explorationSession.groupBy({
      by: ['seedKeyword'],
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      _count: { id: true },
      _sum: { totalDiscoveries: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    })

    return stats.map(s => ({
      seedKeyword: s.seedKeyword,
      explorationCount: s._count.id,
      totalDiscoveries: s._sum.totalDiscoveries || 0,
      avgDiscoveriesPerSession: Math.round((s._sum.totalDiscoveries || 0) / s._count.id),
      lastExploredAt: s._max.createdAt!,
    }))
  } catch (error) {
    console.error('[SESSION-STORAGE] Failed to get seed keyword stats:', error)
    return []
  }
}

// ============================================================================
// 정리
// ============================================================================

/**
 * 만료된 세션 정리
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.explorationSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    console.log(`[SESSION-STORAGE] Cleaned up ${result.count} expired sessions`)
    return result.count
  } catch (error) {
    console.error('[SESSION-STORAGE] Failed to cleanup sessions:', error)
    return 0
  }
}

/**
 * 사용자의 모든 세션 삭제
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  try {
    const result = await prisma.explorationSession.deleteMany({
      where: { userId },
    })

    return result.count
  } catch (error) {
    console.error('[SESSION-STORAGE] Failed to delete user sessions:', error)
    return 0
  }
}
