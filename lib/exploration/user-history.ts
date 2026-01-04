/**
 * User History Manager - 사용자 키워드 히스토리 관리
 *
 * 목적: 사용자가 이미 아는 키워드를 추적하여 새로움 점수 계산에 활용
 *
 * 히스토리 타입:
 * - SEARCHED: 검색한 키워드
 * - TRACKED: 트래킹 중인 키워드
 * - CLICKED: 클릭한 비디오의 키워드
 * - EXPLORED: 탐색 결과로 확인한 키워드
 */

import { prisma, withRetry } from '@/lib/db/prisma'
import { UserKeywordAction } from '@prisma/client'
import type {
  UserKeywordHistory,
  UserHistoryAction,
} from './types'
import { normalizeKeyword } from './novelty-scorer'

// ============================================================================
// 타입 변환 헬퍼
// ============================================================================

/**
 * UserHistoryAction (lowercase) -> UserKeywordAction (Prisma uppercase) 변환
 */
function toPrismaAction(action: UserHistoryAction): UserKeywordAction {
  switch (action) {
    case 'searched':
      return UserKeywordAction.SEARCHED
    case 'tracked':
      return UserKeywordAction.TRACKED
    case 'clicked':
      return UserKeywordAction.CLICKED
    case 'explored':
      return UserKeywordAction.EXPLORED
    default:
      return UserKeywordAction.EXPLORED
  }
}

// ============================================================================
// 사용자 히스토리 로드
// ============================================================================

/**
 * 사용자의 키워드 히스토리 로드
 */
export async function loadUserHistory(userId: string): Promise<UserKeywordHistory> {
  try {
    const records = await withRetry(() =>
      prisma.userKeywordHistory.findMany({
        where: { userId },
        select: {
          keyword: true,
          action: true,
        }
      })
    )

    const history: UserKeywordHistory = {
      userId,
      searchedKeywords: new Set(),
      trackedKeywords: new Set(),
      clickedKeywords: new Set(),
    }

    for (const record of records) {
      const normalizedKeyword = normalizeKeyword(record.keyword)

      switch (record.action) {
        case UserKeywordAction.SEARCHED:
          history.searchedKeywords.add(normalizedKeyword)
          break
        case UserKeywordAction.TRACKED:
          history.trackedKeywords.add(normalizedKeyword)
          break
        case UserKeywordAction.CLICKED:
        case UserKeywordAction.EXPLORED:
          history.clickedKeywords.add(normalizedKeyword)
          break
      }
    }

    return history
  } catch (error) {
    console.warn('[USER-HISTORY] Failed to load history:', error)
    // 에러 시 빈 히스토리 반환
    return {
      userId,
      searchedKeywords: new Set(),
      trackedKeywords: new Set(),
      clickedKeywords: new Set(),
    }
  }
}

/**
 * 사용자 트래킹 키워드만 빠르게 로드 (localStorage 기반)
 */
export function loadTrackedKeywordsFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const stored = localStorage.getItem('hybe-trend-tracked-keywords')
    if (!stored) return new Set()

    const keywords = JSON.parse(stored) as Array<{ keyword: string }>
    return new Set(keywords.map(k => normalizeKeyword(k.keyword)))
  } catch {
    return new Set()
  }
}

// ============================================================================
// 히스토리 기록
// ============================================================================

/**
 * 키워드 히스토리 기록
 */
export async function recordKeywordHistory(
  userId: string,
  keyword: string,
  action: UserHistoryAction
): Promise<void> {
  const normalizedKeyword = normalizeKeyword(keyword)
  const prismaAction = toPrismaAction(action)

  try {
    await withRetry(() =>
      prisma.userKeywordHistory.upsert({
        where: {
          userId_keyword_action: {
            userId,
            keyword: normalizedKeyword,
            action: prismaAction,
          }
        },
        create: {
          userId,
          keyword: normalizedKeyword,
          action: prismaAction,
        },
        update: {
          count: { increment: 1 },
        }
      })
    )
  } catch (error) {
    // 테이블이 없을 수 있음 - 무시
    console.warn('[USER-HISTORY] Failed to record history:', error)
  }
}

/**
 * 다수 키워드 히스토리 일괄 기록
 */
export async function recordKeywordsHistory(
  userId: string,
  keywords: string[],
  action: UserHistoryAction
): Promise<void> {
  const normalizedKeywords = keywords.map(normalizeKeyword)
  const prismaAction = toPrismaAction(action)

  try {
    await withRetry(() =>
      prisma.userKeywordHistory.createMany({
        data: normalizedKeywords.map(keyword => ({
          userId,
          keyword,
          action: prismaAction,
        })),
        skipDuplicates: true,
      })
    )
  } catch (error) {
    console.warn('[USER-HISTORY] Failed to record batch history:', error)
  }
}

/**
 * 검색 기록 추가
 */
export async function recordSearch(userId: string, keyword: string): Promise<void> {
  return recordKeywordHistory(userId, keyword, 'searched')
}

/**
 * 탐색 결과 확인 기록 추가
 */
export async function recordExploration(userId: string, keywords: string[]): Promise<void> {
  return recordKeywordsHistory(userId, keywords, 'explored')
}

// ============================================================================
// 히스토리 조회
// ============================================================================

/**
 * 사용자가 키워드를 알고 있는지 확인
 */
export async function isKeywordKnown(
  userId: string,
  keyword: string
): Promise<boolean> {
  const normalizedKeyword = normalizeKeyword(keyword)

  try {
    const record = await withRetry(() =>
      prisma.userKeywordHistory.findFirst({
        where: {
          userId,
          keyword: normalizedKeyword,
        }
      })
    )

    return !!record
  } catch {
    return false
  }
}

/**
 * 사용자의 최근 검색 키워드 목록
 */
export async function getRecentSearches(
  userId: string,
  limit: number = 20
): Promise<string[]> {
  try {
    const records = await withRetry(() =>
      prisma.userKeywordHistory.findMany({
        where: {
          userId,
          action: UserKeywordAction.SEARCHED,
        },
        orderBy: { lastSeen: 'desc' },
        take: limit,
        select: { keyword: true }
      })
    )

    return records.map(r => r.keyword)
  } catch {
    return []
  }
}

/**
 * 사용자 히스토리 통계
 */
export async function getUserHistoryStats(userId: string): Promise<{
  totalKeywords: number
  searchedCount: number
  trackedCount: number
  clickedCount: number
}> {
  try {
    const [total, searched, tracked, clicked] = await Promise.all([
      withRetry(() => prisma.userKeywordHistory.count({ where: { userId } })),
      withRetry(() => prisma.userKeywordHistory.count({ where: { userId, action: UserKeywordAction.SEARCHED } })),
      withRetry(() => prisma.userKeywordHistory.count({ where: { userId, action: UserKeywordAction.TRACKED } })),
      withRetry(() => prisma.userKeywordHistory.count({ where: { userId, action: UserKeywordAction.CLICKED } })),
    ])

    return {
      totalKeywords: total,
      searchedCount: searched,
      trackedCount: tracked,
      clickedCount: clicked,
    }
  } catch {
    return {
      totalKeywords: 0,
      searchedCount: 0,
      trackedCount: 0,
      clickedCount: 0,
    }
  }
}

// ============================================================================
// 히스토리 정리
// ============================================================================

/**
 * 오래된 히스토리 정리 (30일 이상)
 */
export async function cleanupOldHistory(userId: string): Promise<number> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  try {
    const result = await withRetry(() =>
      prisma.userKeywordHistory.deleteMany({
        where: {
          userId,
          lastSeen: { lt: thirtyDaysAgo },
          // tracked는 삭제하지 않음
          action: { not: UserKeywordAction.TRACKED }
        }
      })
    )

    return result.count
  } catch {
    return 0
  }
}

// ============================================================================
// 메모리 기반 히스토리 (DB 없을 때 대체용)
// ============================================================================

const memoryHistoryCache = new Map<string, UserKeywordHistory>()

/**
 * 메모리 기반 히스토리 생성/가져오기
 */
export function getMemoryHistory(userId: string): UserKeywordHistory {
  if (!memoryHistoryCache.has(userId)) {
    memoryHistoryCache.set(userId, {
      userId,
      searchedKeywords: new Set(),
      trackedKeywords: new Set(),
      clickedKeywords: new Set(),
    })
  }
  return memoryHistoryCache.get(userId)!
}

/**
 * 메모리 히스토리에 추가
 */
export function addToMemoryHistory(
  userId: string,
  keyword: string,
  action: UserHistoryAction
): void {
  const history = getMemoryHistory(userId)
  const normalizedKeyword = normalizeKeyword(keyword)

  switch (action) {
    case 'searched':
      history.searchedKeywords.add(normalizedKeyword)
      break
    case 'tracked':
      history.trackedKeywords.add(normalizedKeyword)
      break
    case 'clicked':
    case 'explored':
      history.clickedKeywords.add(normalizedKeyword)
      break
  }
}

/**
 * 메모리 히스토리 초기화
 */
export function clearMemoryHistory(userId: string): void {
  memoryHistoryCache.delete(userId)
}
