/**
 * Trend Explorer - 트렌드 탐색 엔진
 *
 * 목적: 시드 키워드에서 시작하여 자동으로 새로운 트렌드 키워드를 발견
 *
 * 탐색 프로세스:
 * 1. 시드 키워드로 TikTok 검색
 * 2. 결과에서 해시태그 추출
 * 3. 각 해시태그의 새로움 점수 계산
 * 4. 상위 N개 해시태그로 다음 레벨 탐색
 * 5. 깊이 제한까지 반복
 * 6. 발견 경로 및 네트워크 그래프 생성
 */

import { searchTikTok } from '@/lib/tiktok-mcp'
import type {
  ExplorationRequest,
  ExplorationResult,
  ExplorationContext,
  ExplorationStrategy,
  Discovery,
  HashtagCandidate,
  LevelExplorationResult,
  DiscoveredCreatorBrief,
  ExplorationStats,
  UserKeywordHistory,
} from './types'
import {
  KEYWORDS_PER_LEVEL,
  NOVELTY_THRESHOLD,
} from './types'
import {
  calculateNoveltyScore,
  calculatePopularityScore,
  calculateTotalScore,
  rankHashtagCandidates,
  selectTopCandidatesForExpansion,
  normalizeKeyword,
} from './novelty-scorer'
import {
  loadUserHistory,
  recordExploration,
} from './user-history'
import {
  buildNetworkFromContext,
  createSeedNode,
  createDiscoveredNode,
  createIntermediateNode,
  addNodeToContext,
  addEdgeToContext,
} from './network-builder'

// ============================================================================
// 상수
// ============================================================================

const DEFAULT_DEPTH = 3
const DEFAULT_STRATEGY: ExplorationStrategy = 'balanced'

// ============================================================================
// 메인 탐색 함수
// ============================================================================

/**
 * 트렌드 탐색 실행
 */
export async function exploreTrends(
  request: ExplorationRequest
): Promise<ExplorationResult> {
  const startTime = Date.now()
  const explorationId = generateExplorationId()

  // 요청 파라미터 정규화
  const seedKeyword = normalizeKeyword(request.seedKeyword)
  const depth = Math.min(request.depth || DEFAULT_DEPTH, 3) // 최대 3차 탐색
  const strategy = request.strategy || DEFAULT_STRATEGY
  const userId = request.userId

  console.log(`[TREND-EXPLORER] Starting exploration: ${seedKeyword}, depth: ${depth}, strategy: ${strategy}`)

  // 탐색 컨텍스트 초기화
  const context: ExplorationContext = {
    seedKeyword,
    depth,
    strategy,
    userId,
    visited: new Set<string>(),
    discoveries: [],
    nodes: new Map(),
    edges: [],
    userHistory: undefined,
    startTime,
    searchCount: 0,
    videosAnalyzed: 0,
  }

  // 사용자 히스토리 로드 (있으면)
  if (userId) {
    try {
      context.userHistory = await loadUserHistory(userId)
      console.log(`[TREND-EXPLORER] Loaded user history for: ${userId}`)
    } catch (error) {
      console.warn(`[TREND-EXPLORER] Failed to load user history:`, error)
    }
  }

  // 시드 노드 추가
  const seedNode = createSeedNode(request.seedKeyword)
  addNodeToContext(context, seedNode)
  context.visited.add(seedKeyword)

  // 깊이별 탐색 실행
  let currentKeywords = [seedKeyword]

  for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
    console.log(`[TREND-EXPLORER] Level ${currentDepth}: Exploring ${currentKeywords.length} keywords`)

    const levelResults: LevelExplorationResult[] = []

    for (const keyword of currentKeywords) {
      const result = await exploreKeyword(keyword, currentDepth, context)
      if (result) {
        levelResults.push(result)
      }
    }

    // 다음 레벨 탐색할 키워드 선택
    const allCandidates = levelResults.flatMap(r => r.hashtags)
    const nextKeywords = selectNextLevelKeywords(
      allCandidates,
      currentDepth,
      context
    )

    console.log(`[TREND-EXPLORER] Level ${currentDepth} complete: ${nextKeywords.length} keywords for next level`)

    if (nextKeywords.length === 0) {
      console.log(`[TREND-EXPLORER] No more keywords to explore, stopping at depth ${currentDepth}`)
      break
    }

    currentKeywords = nextKeywords
  }

  // 발견된 키워드 필터링 (새로움 점수 기준)
  const filteredDiscoveries = context.discoveries
    .filter(d => d.noveltyScore >= NOVELTY_THRESHOLD)
    .sort((a, b) => b.totalScore - a.totalScore)

  // 네트워크 그래프 생성
  const network = buildNetworkFromContext(context)

  // 통계 계산
  const stats: ExplorationStats = {
    totalSearches: context.searchCount,
    totalVideosAnalyzed: context.videosAnalyzed,
    uniqueHashtagsFound: context.nodes.size - 1, // 시드 제외
    newDiscoveriesCount: filteredDiscoveries.length,
    durationMs: Date.now() - startTime,
  }

  // 사용자 히스토리에 탐색 기록
  if (userId) {
    try {
      // 시드 키워드와 발견된 키워드들 함께 기록
      const keywordsToRecord = [
        seedKeyword,
        ...filteredDiscoveries.slice(0, 10).map(d => d.keyword)
      ]
      await recordExploration(userId, keywordsToRecord)
    } catch (error) {
      console.warn(`[TREND-EXPLORER] Failed to record exploration:`, error)
    }
  }

  console.log(`[TREND-EXPLORER] Exploration complete: ${filteredDiscoveries.length} discoveries in ${stats.durationMs}ms`)

  return {
    explorationId,
    seedKeyword: request.seedKeyword,
    depth,
    strategy,
    discoveries: filteredDiscoveries,
    network,
    stats,
    completedAt: new Date().toISOString(),
  }
}

// ============================================================================
// 키워드 탐색
// ============================================================================

/**
 * 단일 키워드 탐색
 */
async function exploreKeyword(
  keyword: string,
  depth: number,
  context: ExplorationContext
): Promise<LevelExplorationResult | null> {
  try {
    // TikTok 검색
    context.searchCount++
    const searchResult = await searchTikTok(keyword, 30) // VIDEOS_PER_SEARCH

    if (!searchResult.success || !searchResult.videos || searchResult.videos.length === 0) {
      console.log(`[TREND-EXPLORER] No videos found for: ${keyword}`)
      return null
    }

    const videos = searchResult.videos
    context.videosAnalyzed += videos.length

    // 해시태그 추출 및 집계
    const hashtagMap = new Map<string, {
      count: number
      totalEngagement: number
      totalViews: number
      sampleVideoIds: string[]
    }>()

    const creatorMap = new Map<string, {
      username: string
      videoCount: number
      totalEngagement: number
    }>()

    for (const video of videos) {
      const hashtags = video.hashtags || []
      const engagement = calculateVideoEngagement(video)
      const views = video.stats?.playCount || 0

      // 해시태그 집계
      for (const tag of hashtags) {
        const normalizedTag = normalizeKeyword(tag)
        if (!normalizedTag || normalizedTag.length < 2) continue

        const existing = hashtagMap.get(normalizedTag)
        if (existing) {
          existing.count++
          existing.totalEngagement += engagement
          existing.totalViews += views
          if (existing.sampleVideoIds.length < 5) {
            existing.sampleVideoIds.push(video.id)
          }
        } else {
          hashtagMap.set(normalizedTag, {
            count: 1,
            totalEngagement: engagement,
            totalViews: views,
            sampleVideoIds: [video.id],
          })
        }
      }

      // 크리에이터 집계
      const authorId = video.author?.uniqueId
      const authorName = video.author?.nickname
      if (authorId) {
        const existingCreator = creatorMap.get(authorId)
        if (existingCreator) {
          existingCreator.videoCount++
          existingCreator.totalEngagement += engagement
        } else {
          creatorMap.set(authorId, {
            username: authorName || authorId,
            videoCount: 1,
            totalEngagement: engagement,
          })
        }
      }
    }

    // 해시태그 후보 배열 생성
    const hashtags: HashtagCandidate[] = []
    for (const [tag, data] of hashtagMap) {
      hashtags.push({
        tag,
        count: data.count,
        avgEngagement: data.totalEngagement / data.count,
        avgViews: data.totalViews / data.count,
        sampleVideoIds: data.sampleVideoIds,
      })
    }

    // 크리에이터 배열 생성
    const creators: DiscoveredCreatorBrief[] = []
    for (const [id, data] of creatorMap) {
      creators.push({
        id,
        username: data.username,
        videoCount: data.videoCount,
        avgEngagement: data.totalEngagement / data.videoCount,
      })
    }

    // 해시태그 점수 계산 및 노드/엣지 추가
    for (const candidate of hashtags) {
      const normalizedTag = normalizeKeyword(candidate.tag)

      // 이미 방문한 키워드는 스킵 (but 엣지는 추가)
      if (context.visited.has(normalizedTag)) {
        addEdgeToContext(context, keyword, normalizedTag, candidate.count)
        continue
      }

      // 새로움 점수 계산
      const noveltyScore = calculateNoveltyScore({
        keyword: candidate.tag,
        seedKeyword: context.seedKeyword,
        distanceFromSeed: depth,
        userHistory: context.userHistory,
        metadata: {
          occurrenceCount: candidate.count,
          avgEngagement: candidate.avgEngagement,
          firstSeenAt: undefined, // 최초 발견 시점 (없으면 최근으로 처리)
        },
      })

      // 인기도 점수 계산
      const popularityScore = calculatePopularityScore(
        candidate.avgEngagement,
        candidate.avgViews,
        candidate.count
      )

      // 종합 점수 계산
      const totalScore = calculateTotalScore(
        noveltyScore.total,
        popularityScore,
        context.strategy
      )

      // 발견 경로 생성
      const discoveryPath = buildDiscoveryPath(keyword, candidate.tag, context)

      // 발견 객체 생성
      const discovery: Discovery = {
        keyword: candidate.tag,
        noveltyScore: noveltyScore.total,
        popularityScore,
        totalScore,
        discoveryPath,
        depth,
        sampleVideoIds: candidate.sampleVideoIds,
        relatedCreators: creators
          .sort((a, b) => b.avgEngagement - a.avgEngagement)
          .slice(0, 5),
        metadata: {
          occurrenceCount: candidate.count,
          avgEngagement: candidate.avgEngagement,
          avgViews: candidate.avgViews,
          discoveredAt: new Date().toISOString(),
          isTrending: candidate.avgEngagement > 5, // 참여율 5% 이상이면 트렌딩
        },
      }

      context.discoveries.push(discovery)

      // 노드 타입 결정 (새로움 점수 기준)
      if (noveltyScore.total >= 50) { // NOVELTY_THRESHOLD
        const node = createDiscoveredNode(
          candidate.tag,
          depth,
          noveltyScore.total,
          popularityScore
        )
        addNodeToContext(context, node)
      } else {
        const node = createIntermediateNode(
          candidate.tag,
          depth,
          totalScore
        )
        addNodeToContext(context, node)
      }

      // 엣지 추가
      addEdgeToContext(context, keyword, normalizedTag, candidate.count)
    }

    return {
      level: depth,
      keyword,
      hashtags,
      creators,
      videosAnalyzed: videos.length,
    }
  } catch (error) {
    console.error(`[TREND-EXPLORER] Error exploring keyword ${keyword}:`, error)
    return null
  }
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 다음 레벨 탐색할 키워드 선택
 */
function selectNextLevelKeywords(
  candidates: HashtagCandidate[],
  currentDepth: number,
  context: ExplorationContext
): string[] {
  // 전략에 따라 후보 랭킹
  const rankedCandidates = rankHashtagCandidates(
    candidates,
    context.seedKeyword,
    currentDepth,
    context.strategy,
    context.userHistory
  )

  // 상위 후보 선택 (아직 방문하지 않은 것만)
  const selected = selectTopCandidatesForExpansion(
    rankedCandidates,
    KEYWORDS_PER_LEVEL,
    context.visited
  )

  // 방문 표시 및 키워드 추출
  const keywords: string[] = []
  for (const candidate of selected) {
    const normalized = normalizeKeyword(candidate.tag)
    context.visited.add(normalized)
    keywords.push(candidate.tag)
  }

  return keywords
}

/**
 * 발견 경로 생성
 */
function buildDiscoveryPath(
  parentKeyword: string,
  discoveredKeyword: string,
  context: ExplorationContext
): string[] {
  // 시드에서 발견된 키워드까지의 경로 추적
  // 간단한 구현: 현재 parent → discovered
  // 더 정확한 구현은 네트워크 그래프에서 BFS로 경로 추적

  // 시드에서 직접 발견된 경우
  if (normalizeKeyword(parentKeyword) === normalizeKeyword(context.seedKeyword)) {
    return [context.seedKeyword, discoveredKeyword]
  }

  // 발견 목록에서 parent의 경로 찾기
  const parentDiscovery = context.discoveries.find(
    d => normalizeKeyword(d.keyword) === normalizeKeyword(parentKeyword)
  )

  if (parentDiscovery) {
    return [...parentDiscovery.discoveryPath, discoveredKeyword]
  }

  // 찾지 못하면 기본 경로
  return [context.seedKeyword, parentKeyword, discoveredKeyword]
}

/**
 * 비디오 참여율 계산
 */
function calculateVideoEngagement(video: any): number {
  const stats = video.stats
  if (!stats || !stats.playCount || stats.playCount === 0) return 0

  const likes = stats.likeCount || 0
  const comments = stats.commentCount || 0
  const shares = stats.shareCount || 0
  const views = stats.playCount

  return ((likes + comments + shares) / views) * 100
}

/**
 * 탐색 ID 생성
 */
function generateExplorationId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `exp_${timestamp}_${random}`
}

// ============================================================================
// 간편 함수
// ============================================================================

/**
 * 빠른 탐색 (기본 설정)
 */
export async function quickExplore(
  seedKeyword: string,
  userId?: string
): Promise<ExplorationResult> {
  return exploreTrends({
    seedKeyword,
    depth: 2,
    strategy: 'balanced',
    userId,
  })
}

/**
 * 깊은 탐색 (새로움 우선)
 */
export async function deepExploreNovelty(
  seedKeyword: string,
  userId?: string
): Promise<ExplorationResult> {
  return exploreTrends({
    seedKeyword,
    depth: 3,
    strategy: 'novelty',
    userId,
  })
}

/**
 * 인기 탐색 (인기도 우선)
 */
export async function explorePopular(
  seedKeyword: string,
  userId?: string
): Promise<ExplorationResult> {
  return exploreTrends({
    seedKeyword,
    depth: 3,
    strategy: 'popularity',
    userId,
  })
}
