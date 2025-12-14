/**
 * Trend Exploration System
 *
 * 시드 키워드에서 자동으로 새로운 트렌드를 발견하는 탐색 시스템
 *
 * 주요 기능:
 * - 자동 확장 탐색: 시드 → 1차 → 2차 → 3차 검색
 * - 새로움 점수: 사용자가 모르는 키워드 우선
 * - 발견 경로: 어떻게 발견되었는지 추적
 * - 네트워크 시각화: 탐색 그래프 생성
 */

// Types
export type {
  ExplorationRequest,
  ExplorationResult,
  ExplorationStrategy,
  Discovery,
  DiscoveryMetadata,
  DiscoveredCreatorBrief,
  ExplorationNetwork,
  NetworkNode,
  NetworkEdge,
  ExplorationStats,
  NoveltyInput,
  NoveltyScore,
  UserKeywordHistory,
  UserHistoryAction,
  UserHistoryRecord,
  ExplorationSession,
  ExplorationContext,
  LevelExplorationResult,
  HashtagCandidate,
  // LLM Insight Types
  TrendCategory,
  TrendInsight,
  ContentRecommendation,
  GrowthPrediction,
  TrendInsights,
  ExplorationResultWithInsights,
} from './types'

// Constants
export {
  MAX_EXPLORATION_DEPTH,
  KEYWORDS_PER_LEVEL,
  VIDEOS_PER_SEARCH,
  NOVELTY_THRESHOLD,
  POPULARITY_THRESHOLD,
} from './types'

// Main Explorer
export {
  exploreTrends,
  quickExplore,
  deepExploreNovelty,
  explorePopular,
} from './trend-explorer'

// Novelty Scoring
export {
  calculateNoveltyScore,
  calculatePopularityScore,
  calculateTotalScore,
  normalizeKeyword,
  rankHashtagCandidates,
  selectTopCandidatesForExpansion,
  filterNewDiscoveries,
} from './novelty-scorer'

// User History
export {
  loadUserHistory,
  recordKeywordHistory,
  recordSearch,
  recordExploration,
  getMemoryHistory,
  addToMemoryHistory,
} from './user-history'

// Network Builder
export {
  buildNetworkFromContext,
  createSeedNode,
  createDiscoveredNode,
  createIntermediateNode,
  createEdge,
  addNodeToContext,
  addEdgeToContext,
  highlightDiscoveryPaths,
  calculateNetworkStats,
  findHubNodes,
  extractDiscoveryPaths,
  toVisualizationFormat,
  calculateLayeredLayout,
  serializeNetwork,
  deserializeNetwork,
} from './network-builder'

// LLM Insight Analyzer
export {
  analyzeTrendInsights,
} from './insight-analyzer'
