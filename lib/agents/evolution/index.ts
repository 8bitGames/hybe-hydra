/**
 * Agent Evolution Pipeline
 * ========================
 * Automated agent improvement system
 *
 * Components:
 * - FeedbackAnalyzer: Analyzes feedback patterns and identifies improvements
 * - PromptImprover: Generates improved prompt candidates
 * - ABTestRunner: Runs comparative tests between prompts
 * - EvolutionService: Main orchestrator
 */

// Types
export * from './types';

// Services
export { FeedbackAnalyzer, createFeedbackAnalyzer } from './feedback-analyzer';
export { PromptImprover, createPromptImprover } from './prompt-improver';
export { ABTestRunner, createABTestRunner } from './ab-test-runner';
export { EvolutionService, createEvolutionService } from './evolution-service';
