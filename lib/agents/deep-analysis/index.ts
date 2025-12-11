/**
 * Deep Analysis Agents
 * ====================
 * AI agents for comprehensive TikTok account analysis.
 */

// Video Classifier
export {
  VideoClassifierAgent,
  createVideoClassifierAgent,
  VideoClassifierInputSchema,
  VideoClassifierOutputSchema,
  type VideoClassifierInput,
  type VideoClassifierOutput,
} from './video-classifier';

// Account Metrics
export {
  AccountMetricsAgent,
  createAccountMetricsAgent,
  AccountMetricsInputSchema,
  AccountMetricsOutputSchema,
  type AccountMetricsInput,
  type AccountMetricsOutput,
} from './account-metrics';

// Comparative Analysis
export {
  ComparativeAnalysisAgent,
  createComparativeAnalysisAgent,
  ComparativeAnalysisInputSchema,
  ComparativeAnalysisOutputSchema,
  type ComparativeAnalysisInput,
  type ComparativeAnalysisOutput,
} from './comparative-analysis';

// Orchestrator
export {
  DeepAnalysisOrchestrator,
  createDeepAnalysisOrchestrator,
  type DeepAnalysisStage,
  type DeepAnalysisConfig,
  type AccountData,
  type SingleAccountAnalysisInput,
  type SingleAccountAnalysisResult,
  type ComparisonAnalysisInput,
  type ComparisonAnalysisResult,
  type FullAnalysisResult,
  type ProgressCallback,
} from './orchestrator';

// Re-export for convenience
export const DeepAnalysisAgents = {
  createVideoClassifier: () => import('./video-classifier').then(m => m.createVideoClassifierAgent()),
  createAccountMetrics: () => import('./account-metrics').then(m => m.createAccountMetricsAgent()),
  createComparativeAnalysis: () => import('./comparative-analysis').then(m => m.createComparativeAnalysisAgent()),
  createOrchestrator: (config?: Parameters<typeof import('./orchestrator').createDeepAnalysisOrchestrator>[0]) =>
    import('./orchestrator').then(m => m.createDeepAnalysisOrchestrator(config)),
};
