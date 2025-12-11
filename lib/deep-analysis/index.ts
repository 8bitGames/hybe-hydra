/**
 * Deep Analysis Module
 *
 * Exports all deep analysis functionality.
 */

// TikTok Service
export {
  getDeepAnalysisUserInfo,
  fetchAccountVideos,
  searchDeepAnalysisUsers,
  fetchAccountForAnalysis,
  calculateAccountMetrics,
  TIKTOK_BENCHMARKS,
  getFollowerTier,
  getBenchmarkForFollowers,
  type DeepAnalysisUser,
  type DeepAnalysisVideo,
  type AccountFetchResult,
  type AccountSearchResult,
  type AccountMetrics,
} from './tiktok-service';

// Types
export * from './types';
