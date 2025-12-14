/**
 * Novelty Scorer - 새로움 점수 계산 모듈
 *
 * 목적: 사용자가 모르는 "새로운" 키워드를 식별하기 위한 점수 계산
 *
 * 점수 구성:
 * - userUnfamiliarity (40%): 사용자가 해당 키워드를 본 적 없는 정도
 * - recencyScore (30%): 최근에 떠오르는 트렌드인지
 * - distanceScore (30%): 시드 키워드에서 얼마나 떨어져 있는지
 */

import type {
  NoveltyInput,
  NoveltyScore,
  UserKeywordHistory,
  HashtagCandidate,
  ExplorationStrategy,
} from './types'

// ============================================================================
// 새로움 점수 계산
// ============================================================================

/**
 * 새로움 점수 계산
 */
export function calculateNoveltyScore(input: NoveltyInput): NoveltyScore {
  const userUnfamiliarity = calculateUserUnfamiliarity(
    input.keyword,
    input.userHistory
  )

  const recencyScore = calculateRecencyScore(
    input.metadata.firstSeenAt,
    input.metadata.avgEngagement
  )

  const distanceScore = calculateDistanceScore(
    input.distanceFromSeed,
    input.seedKeyword,
    input.keyword
  )

  // 가중치 적용 (총합 = 100점 만점)
  const total = Math.round(
    userUnfamiliarity * 0.4 +
    recencyScore * 0.3 +
    distanceScore * 0.3
  )

  return {
    total: Math.min(100, Math.max(0, total)),
    userUnfamiliarity,
    recencyScore,
    distanceScore,
  }
}

/**
 * 인기도 점수 계산
 */
export function calculatePopularityScore(
  avgEngagement: number,
  occurrenceCount: number,
  avgViews: number
): number {
  // 참여율 점수 (0-50점): 10% 이상이면 만점
  const engagementScore = Math.min(50, avgEngagement * 5)

  // 출현 빈도 점수 (0-30점): 로그 스케일
  const frequencyScore = Math.min(30, Math.log10(occurrenceCount + 1) * 15)

  // 조회수 점수 (0-20점): 로그 스케일
  const viewScore = avgViews > 0
    ? Math.min(20, Math.log10(avgViews) * 3)
    : 0

  return Math.round(engagementScore + frequencyScore + viewScore)
}

/**
 * 종합 점수 계산 (전략에 따라 가중치 적용)
 */
export function calculateTotalScore(
  noveltyScore: number,
  popularityScore: number,
  strategy: ExplorationStrategy
): number {
  switch (strategy) {
    case 'novelty':
      // 새로움 70%, 인기도 30%
      return Math.round(noveltyScore * 0.7 + popularityScore * 0.3)

    case 'popularity':
      // 새로움 30%, 인기도 70%
      return Math.round(noveltyScore * 0.3 + popularityScore * 0.7)

    case 'balanced':
    default:
      // 새로움 50%, 인기도 50%
      return Math.round(noveltyScore * 0.5 + popularityScore * 0.5)
  }
}

// ============================================================================
// 개별 점수 계산 함수들
// ============================================================================

/**
 * 사용자 친숙도 역점수 계산 (높을수록 낯섦)
 *
 * - 검색한 적 있음: -40점
 * - 트래킹 중: -30점
 * - 클릭한 적 있음: -20점
 * - 모두 없음: 100점
 */
function calculateUserUnfamiliarity(
  keyword: string,
  userHistory?: UserKeywordHistory
): number {
  if (!userHistory) {
    // 히스토리가 없으면 기본 80점 (약간의 보수적 점수)
    return 80
  }

  const normalizedKeyword = normalizeKeyword(keyword)
  let penalty = 0

  // 검색한 적 있음 - 가장 큰 페널티
  if (userHistory.searchedKeywords.has(normalizedKeyword)) {
    penalty += 40
  }

  // 트래킹 중 - 명확히 알고 있음
  if (userHistory.trackedKeywords.has(normalizedKeyword)) {
    penalty += 30
  }

  // 클릭한 적 있음 - 노출된 적 있음
  if (userHistory.clickedKeywords.has(normalizedKeyword)) {
    penalty += 20
  }

  return Math.max(0, 100 - penalty)
}

/**
 * 시간 기반 점수 계산 (최근 트렌드일수록 높음)
 *
 * - 24시간 이내 급상승: 100점
 * - 7일 이내: 70점
 * - 30일 이내: 50점
 * - 그 이상: 30점 (기본)
 *
 * + 참여율 보너스
 */
function calculateRecencyScore(
  firstSeenAt?: Date,
  avgEngagement?: number
): number {
  let baseScore = 50 // 기본 점수

  if (firstSeenAt) {
    const now = new Date()
    const hoursSince = (now.getTime() - firstSeenAt.getTime()) / (1000 * 60 * 60)

    if (hoursSince <= 24) {
      baseScore = 100
    } else if (hoursSince <= 24 * 7) {
      baseScore = 70
    } else if (hoursSince <= 24 * 30) {
      baseScore = 50
    } else {
      baseScore = 30
    }
  }

  // 참여율 보너스 (높은 참여율은 현재 활발한 트렌드)
  const engagementBonus = avgEngagement
    ? Math.min(20, avgEngagement * 2)
    : 0

  return Math.min(100, baseScore + engagementBonus)
}

/**
 * 거리 기반 점수 계산 (시드에서 멀수록 높음)
 *
 * 깊이 1: 30점 (직접 연관)
 * 깊이 2: 60점 (2단계 연관)
 * 깊이 3: 90점 (3단계 연관 - 예상 못한 발견)
 *
 * + 의미적 거리 보너스 (시드와 다른 카테고리면 추가 점수)
 */
function calculateDistanceScore(
  distanceFromSeed: number,
  seedKeyword: string,
  targetKeyword: string
): number {
  // 깊이 기반 점수 (깊이당 30점)
  const depthScore = Math.min(90, distanceFromSeed * 30)

  // 의미적 거리 보너스 (간단한 휴리스틱)
  const semanticBonus = calculateSemanticDistance(seedKeyword, targetKeyword)

  return Math.min(100, depthScore + semanticBonus)
}

/**
 * 의미적 거리 계산 (간단한 휴리스틱)
 *
 * - 공통 글자가 적을수록 높은 점수
 * - 길이 차이가 클수록 높은 점수
 */
function calculateSemanticDistance(seed: string, target: string): number {
  const normalizedSeed = normalizeKeyword(seed)
  const normalizedTarget = normalizeKeyword(target)

  // 완전히 포함 관계면 낮은 점수
  if (normalizedTarget.includes(normalizedSeed) ||
      normalizedSeed.includes(normalizedTarget)) {
    return 0
  }

  // 공통 문자 비율
  const seedChars = new Set(normalizedSeed)
  const targetChars = new Set(normalizedTarget)
  const commonChars = [...seedChars].filter(c => targetChars.has(c))
  const overlapRatio = commonChars.length / Math.max(seedChars.size, targetChars.size)

  // 낮은 오버랩 = 높은 거리 점수
  return Math.round((1 - overlapRatio) * 10)
}

// ============================================================================
// 해시태그 랭킹 및 선택
// ============================================================================

/**
 * 해시태그 후보들을 점수 기준으로 랭킹
 */
export function rankHashtagCandidates(
  candidates: HashtagCandidate[],
  seedKeyword: string,
  depth: number,
  strategy: ExplorationStrategy,
  userHistory?: UserKeywordHistory
): Array<HashtagCandidate & { noveltyScore: number; popularityScore: number; totalScore: number }> {
  return candidates
    .map(candidate => {
      const noveltyResult = calculateNoveltyScore({
        keyword: candidate.tag,
        seedKeyword,
        distanceFromSeed: depth,
        userHistory,
        metadata: {
          occurrenceCount: candidate.count,
          avgEngagement: candidate.avgEngagement,
        }
      })

      const popularityScore = calculatePopularityScore(
        candidate.avgEngagement,
        candidate.count,
        candidate.avgViews
      )

      const totalScore = calculateTotalScore(
        noveltyResult.total,
        popularityScore,
        strategy
      )

      return {
        ...candidate,
        noveltyScore: noveltyResult.total,
        popularityScore,
        totalScore,
      }
    })
    .sort((a, b) => b.totalScore - a.totalScore)
}

/**
 * 다음 탐색을 위한 상위 키워드 선택
 */
export function selectTopCandidatesForExpansion(
  rankedCandidates: Array<HashtagCandidate & { totalScore: number }>,
  limit: number,
  visited: Set<string>
): HashtagCandidate[] {
  return rankedCandidates
    .filter(c => !visited.has(normalizeKeyword(c.tag)))
    .filter(c => c.totalScore >= 30) // 최소 점수 기준
    .slice(0, limit)
}

/**
 * 새로운 발견으로 분류될 후보 필터링
 */
export function filterNewDiscoveries(
  rankedCandidates: Array<HashtagCandidate & { noveltyScore: number; totalScore: number }>,
  noveltyThreshold: number = 50
): Array<HashtagCandidate & { noveltyScore: number; totalScore: number }> {
  return rankedCandidates.filter(c => c.noveltyScore >= noveltyThreshold)
}

// ============================================================================
// 유틸리티
// ============================================================================

/**
 * 키워드 정규화
 */
export function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/^@/, '')
    .trim()
}

/**
 * 새로움 점수가 임계값을 넘는지 확인
 */
export function isNovel(noveltyScore: number, threshold: number = 50): boolean {
  return noveltyScore >= threshold
}

/**
 * 발견의 품질 등급 계산
 */
export function getDiscoveryGrade(
  noveltyScore: number,
  popularityScore: number
): 'excellent' | 'good' | 'moderate' | 'low' {
  const combined = (noveltyScore + popularityScore) / 2

  if (combined >= 80) return 'excellent'
  if (combined >= 60) return 'good'
  if (combined >= 40) return 'moderate'
  return 'low'
}
