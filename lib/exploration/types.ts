// Trend Exploration System - Type Definitions
// 목적: 시드 키워드에서 새로운 트렌드를 자동으로 발견하는 탐색 시스템

// ============================================================================
// 핵심 탐색 타입
// ============================================================================

/**
 * 탐색 요청 파라미터
 */
export interface ExplorationRequest {
  /** 시드 키워드 (탐색 시작점) */
  seedKeyword: string
  /** 탐색 깊이 (1-3, 기본값 3) */
  depth?: number
  /** 탐색 전략 */
  strategy?: ExplorationStrategy
  /** 이미 아는 키워드 제외 여부 */
  excludeKnown?: boolean
  /** 사용자 ID (히스토리 기반 새로움 계산용) */
  userId?: string
}

/**
 * 탐색 전략
 * - novelty: 새로운 것 우선 (사용자가 모르는 키워드)
 * - popularity: 인기도 우선 (참여율 높은 키워드)
 * - balanced: 새로움 + 인기도 균형
 */
export type ExplorationStrategy = 'novelty' | 'popularity' | 'balanced'

/**
 * 발견된 키워드/해시태그
 */
export interface Discovery {
  /** 키워드/해시태그 */
  keyword: string
  /** 새로움 점수 (0-100) */
  noveltyScore: number
  /** 인기도 점수 (0-100) */
  popularityScore: number
  /** 종합 점수 (0-100) */
  totalScore: number
  /** 발견 경로 (시드에서 이 키워드까지) */
  discoveryPath: string[]
  /** 탐색 깊이 (1=시드에서 직접 발견, 2=2차 검색에서 발견...) */
  depth: number
  /** 샘플 비디오 ID 목록 */
  sampleVideoIds: string[]
  /** 관련 크리에이터 */
  relatedCreators: DiscoveredCreatorBrief[]
  /** 메타데이터 */
  metadata: DiscoveryMetadata
}

/**
 * 발견 메타데이터
 */
export interface DiscoveryMetadata {
  /** 출현 횟수 (분석된 비디오 중) */
  occurrenceCount: number
  /** 평균 참여율 */
  avgEngagement: number
  /** 평균 조회수 */
  avgViews: number
  /** 최초 발견 시점 */
  discoveredAt: string
  /** 급상승 여부 */
  isTrending: boolean
}

/**
 * 간략한 크리에이터 정보
 */
export interface DiscoveredCreatorBrief {
  id: string
  username: string
  videoCount: number
  avgEngagement: number
}

// ============================================================================
// 탐색 결과 타입
// ============================================================================

/**
 * 탐색 결과 응답
 */
export interface ExplorationResult {
  /** 탐색 세션 ID */
  explorationId: string
  /** 시드 키워드 */
  seedKeyword: string
  /** 탐색 깊이 */
  depth: number
  /** 사용된 전략 */
  strategy: ExplorationStrategy
  /** 발견된 키워드들 */
  discoveries: Discovery[]
  /** 네트워크 그래프 데이터 */
  network: ExplorationNetwork
  /** 탐색 통계 */
  stats: ExplorationStats
  /** 탐색 완료 시간 */
  completedAt: string
}

/**
 * 네트워크 그래프 데이터 (시각화용)
 */
export interface ExplorationNetwork {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

export interface NetworkNode {
  id: string
  label: string
  /** 노드 타입: seed=시드, discovered=발견됨, intermediate=중간경로 */
  type: 'seed' | 'discovered' | 'intermediate'
  /** 노드 크기 결정용 점수 */
  weight: number
  /** 탐색 깊이 */
  depth: number
  /** 새로움 점수 */
  noveltyScore?: number
  /** 인기도 점수 */
  popularityScore?: number
}

export interface NetworkEdge {
  source: string
  target: string
  /** 연결 강도 */
  weight: number
  /** 발견 경로에 포함 여부 */
  isDiscoveryPath: boolean
}

/**
 * 탐색 통계
 */
export interface ExplorationStats {
  /** 총 검색 횟수 */
  totalSearches: number
  /** 분석된 비디오 수 */
  totalVideosAnalyzed: number
  /** 발견된 고유 해시태그 수 */
  uniqueHashtagsFound: number
  /** 새로운 발견 수 (noveltyScore > 50) */
  newDiscoveriesCount: number
  /** 탐색 소요 시간 (ms) */
  durationMs: number
}

// ============================================================================
// 새로움 점수 계산 타입
// ============================================================================

/**
 * 새로움 점수 계산 입력
 */
export interface NoveltyInput {
  /** 평가 대상 키워드 */
  keyword: string
  /** 시드 키워드 */
  seedKeyword: string
  /** 시드에서의 거리 (홉 수) */
  distanceFromSeed: number
  /** 사용자 히스토리 */
  userHistory?: UserKeywordHistory
  /** 키워드 메타데이터 */
  metadata: {
    occurrenceCount: number
    avgEngagement: number
    firstSeenAt?: Date
  }
}

/**
 * 새로움 점수 결과
 */
export interface NoveltyScore {
  /** 총점 (0-100) */
  total: number
  /** 사용자 친숙도 역점수 (0-100, 높을수록 낯섦) */
  userUnfamiliarity: number
  /** 시간 기반 점수 (0-100, 최근일수록 높음) */
  recencyScore: number
  /** 거리 기반 점수 (0-100, 멀수록 높음) */
  distanceScore: number
}

// ============================================================================
// 사용자 히스토리 타입
// ============================================================================

/**
 * 사용자 키워드 히스토리
 */
export interface UserKeywordHistory {
  userId: string
  /** 검색한 키워드들 */
  searchedKeywords: Set<string>
  /** 트래킹 중인 키워드들 */
  trackedKeywords: Set<string>
  /** 클릭한 비디오의 키워드들 */
  clickedKeywords: Set<string>
}

/**
 * 사용자 히스토리 액션 타입
 */
export type UserHistoryAction = 'searched' | 'tracked' | 'clicked' | 'explored'

/**
 * 사용자 히스토리 레코드 (DB 저장용)
 */
export interface UserHistoryRecord {
  userId: string
  keyword: string
  action: UserHistoryAction
  timestamp: Date
}

// ============================================================================
// 탐색 세션 타입 (DB 저장용)
// ============================================================================

/**
 * 탐색 세션 (DB 저장용)
 */
export interface ExplorationSession {
  id: string
  userId: string
  seedKeyword: string
  depth: number
  strategy: ExplorationStrategy
  discoveries: Discovery[]
  network: ExplorationNetwork
  stats: ExplorationStats
  createdAt: Date
}

// ============================================================================
// 내부 처리용 타입
// ============================================================================

/**
 * 탐색 레벨 결과 (내부 처리용)
 */
export interface LevelExplorationResult {
  level: number
  keyword: string
  hashtags: HashtagCandidate[]
  creators: DiscoveredCreatorBrief[]
  videosAnalyzed: number
}

/**
 * 해시태그 후보 (내부 처리용)
 */
export interface HashtagCandidate {
  tag: string
  count: number
  avgEngagement: number
  avgViews: number
  sampleVideoIds: string[]
}

/**
 * 탐색 컨텍스트 (탐색 중 상태 관리)
 */
export interface ExplorationContext {
  seedKeyword: string
  depth: number
  strategy: ExplorationStrategy
  userId?: string
  /** 방문한 키워드 (중복 방지) */
  visited: Set<string>
  /** 발견 목록 */
  discoveries: Discovery[]
  /** 네트워크 노드 */
  nodes: Map<string, NetworkNode>
  /** 네트워크 엣지 */
  edges: NetworkEdge[]
  /** 사용자 히스토리 */
  userHistory?: UserKeywordHistory
  /** 탐색 시작 시간 */
  startTime: number
  /** 검색 횟수 */
  searchCount: number
  /** 분석된 비디오 수 */
  videosAnalyzed: number
}

// ============================================================================
// 상수
// ============================================================================

/** 최대 탐색 깊이 */
export const MAX_EXPLORATION_DEPTH = 3

/** 레벨당 확장할 키워드 수 */
export const KEYWORDS_PER_LEVEL = 5

/** 검색당 가져올 비디오 수 */
export const VIDEOS_PER_SEARCH = 30

/** 새로움 점수 임계값 (이 이상이면 "새로운 발견") */
export const NOVELTY_THRESHOLD = 50

/** 인기도 점수 임계값 */
export const POPULARITY_THRESHOLD = 30

// ============================================================================
// LLM 인사이트 타입
// ============================================================================

/**
 * 트렌드 카테고리
 */
export interface TrendCategory {
  /** 카테고리 이름 */
  name: string
  /** 포함된 키워드들 */
  keywords: string[]
  /** 카테고리 설명 */
  description: string
}

/**
 * 트렌드 인사이트
 */
export interface TrendInsight {
  /** 인사이트 유형 */
  type: 'opportunity' | 'warning' | 'pattern'
  /** 제목 */
  title: string
  /** 상세 설명 */
  description: string
  /** 관련 키워드 */
  relatedKeywords: string[]
}

/**
 * 콘텐츠 추천
 */
export interface ContentRecommendation {
  /** 콘텐츠 아이디어 제목 */
  title: string
  /** 실행 방법 설명 */
  description: string
  /** 추천 키워드 */
  suggestedKeywords: string[]
  /** 타겟 오디언스 */
  targetAudience: string
  /** 난이도 */
  difficulty: 'easy' | 'medium' | 'hard'
}

/**
 * 성장 예측
 */
export interface GrowthPrediction {
  /** 키워드 */
  keyword: string
  /** 성장 잠재력 */
  potential: 'high' | 'medium' | 'low'
  /** 예측 근거 */
  reason: string
}

/**
 * LLM 분석 결과 (TrendInsightAgent 출력)
 */
export interface TrendInsights {
  /** 전체 요약 */
  summary: string
  /** 카테고리 그룹핑 */
  categories: TrendCategory[]
  /** 인사이트 목록 */
  insights: TrendInsight[]
  /** 콘텐츠 추천 */
  contentRecommendations: ContentRecommendation[]
  /** 성장 예측 */
  predictions: GrowthPrediction[]
}

/**
 * 확장된 탐색 결과 (인사이트 포함)
 */
export interface ExplorationResultWithInsights extends ExplorationResult {
  /** LLM 기반 인사이트 (옵션) */
  insights?: TrendInsights
}
