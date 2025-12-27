/**
 * Agent Evolution Pipeline Types
 * ================================
 * Type definitions for the automated agent evolution system
 */

import { DatabasePrompt } from '../prompt-loader';
import { EvaluationResult, TestCase } from '../evaluation-service';

// ================================
// Configuration Types
// ================================

export interface EvolutionConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  minFeedbackCount: number;
  minImprovementThreshold: number;
  autoPromoteThreshold: number;
  requireHumanApproval: boolean;
  maxCandidatesPerCycle: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QualityGates {
  minFeedbackCount: number;
  minImprovementThreshold: number;
  maxRegressionAllowed: number;
  minTestPassRate: number;
  requireHumanApproval: boolean;
}

export const DEFAULT_QUALITY_GATES: QualityGates = {
  minFeedbackCount: 10,
  minImprovementThreshold: 0.1,
  maxRegressionAllowed: 0.05,
  minTestPassRate: 0.8,
  requireHumanApproval: true,
};

// ================================
// Evolution Cycle Types
// ================================

export type EvolutionCycleStatus =
  | 'analyzing'
  | 'generating'
  | 'testing'
  | 'reviewing'
  | 'completed'
  | 'failed';

export interface EvolutionCycle {
  id: string;
  agentId: string;
  status: EvolutionCycleStatus;
  startedAt: Date;
  completedAt?: Date;
  feedbackSummary?: FeedbackSummary;
  errorMessage?: string;
  createdAt: Date;
}

export interface EvolutionCycleResult {
  cycleId: string;
  agentId: string;
  status: EvolutionCycleStatus;
  candidates: PromptCandidate[];
  bestCandidate?: PromptCandidate;
  improvementDelta?: number;
  requiresApproval: boolean;
  error?: string;
}

export interface EvolutionSummary {
  totalAgentsProcessed: number;
  successfulEvolutions: number;
  failedEvolutions: number;
  candidatesGenerated: number;
  candidatesPromoted: number;
  candidatesPendingReview: number;
  cycles: EvolutionCycleResult[];
}

export interface EvolutionStatus {
  agentId: string;
  lastCycle?: EvolutionCycle;
  pendingCandidates: PromptCandidate[];
  config: EvolutionConfig;
  eligibleForEvolution: boolean;
  reasonIfNotEligible?: string;
}

// ================================
// Feedback Analysis Types
// ================================

export interface AgentFeedback {
  id: string;
  executionId: string;
  agentId: string;
  overallScore: number;
  relevanceScore: number;
  qualityScore: number;
  creativityScore: number;
  feedbackText?: string;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  createdAt: Date;
}

export interface FeedbackSummary {
  agentId: string;
  feedbackCount: number;
  avgOverallScore: number;
  avgRelevanceScore: number;
  avgQualityScore: number;
  avgCreativityScore: number;
  scoreDistribution: ScoreDistribution;
  commonWeaknesses: WeaknessPattern[];
  commonStrengths: string[];
  recentTrend: 'improving' | 'stable' | 'declining';
}

export interface ScoreDistribution {
  excellent: number;  // 4.5-5.0
  good: number;       // 3.5-4.5
  average: number;    // 2.5-3.5
  poor: number;       // 1.5-2.5
  failing: number;    // 0-1.5
}

export interface WeaknessPattern {
  category: string;
  description: string;
  frequency: number;
  severity: 'high' | 'medium' | 'low';
  suggestedFix?: string;
}

export interface FeedbackAnalysis {
  summary: FeedbackSummary;
  weaknesses: Weakness[];
  priorities: ImprovementPriority[];
  rawFeedback: AgentFeedback[];
}

export interface Weakness {
  id: string;
  dimension: 'relevance' | 'quality' | 'creativity' | 'overall';
  description: string;
  frequency: number;
  avgImpact: number;
  examples: string[];
}

export interface ImprovementPriority {
  dimension: 'relevance' | 'quality' | 'creativity' | 'overall';
  priority: number;  // 1-5, higher is more important
  currentScore: number;
  targetScore: number;
  suggestedActions: string[];
}

// ================================
// Prompt Candidate Types
// ================================

export type CandidateStatus =
  | 'pending'
  | 'testing'
  | 'passed'
  | 'failed'
  | 'promoted'
  | 'rejected';

export interface PromptCandidate {
  id: string;
  cycleId: string;
  agentId: string;
  candidateVersion: number;
  systemPrompt: string;
  templates: Record<string, string>;
  modelOptions?: Record<string, unknown>;
  generationRationale: string;
  testResults?: ABTestResult;
  baselineScore?: number;
  candidateScore?: number;
  improvementDelta?: number;
  status: CandidateStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
}

export interface CandidateGenerationResult {
  candidates: PromptCandidate[];
  generationRationale: string;
  improvementTargets: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ================================
// A/B Testing Types
// ================================

export interface ABTestResult {
  testCaseCount: number;
  baselineResults: TestRunSummary;
  candidateResults: TestRunSummary;
  comparison: TestComparison;
  statisticalSignificance: boolean;
  recommendation: 'promote' | 'reject' | 'more_testing' | 'review';
}

export interface TestRunSummary {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  avgOverallScore: number;
  avgRelevanceScore: number;
  avgQualityScore: number;
  avgCreativityScore: number;
  executionTimeMs: number;
}

export interface TestComparison {
  overallImprovement: number;
  relevanceImprovement: number;
  qualityImprovement: number;
  creativityImprovement: number;
  passRateChange: number;
  regressions: RegressionDetail[];
}

export interface RegressionDetail {
  testCaseId: string;
  testCaseName: string;
  dimension: 'relevance' | 'quality' | 'creativity' | 'overall';
  baselineScore: number;
  candidateScore: number;
  regressionAmount: number;
}

export interface TestEvaluation {
  passed: boolean;
  recommendation: 'promote' | 'reject' | 'more_testing' | 'review';
  confidence: number;
  reasoning: string;
  meetsQualityGates: boolean;
  gateResults: QualityGateResult[];
}

export interface QualityGateResult {
  gate: keyof QualityGates;
  required: number;
  actual: number;
  passed: boolean;
}

// ================================
// Service Input/Output Types
// ================================

export interface RunEvolutionOptions {
  agentId: string;
  forceRun?: boolean;
  candidateCount?: number;
  skipTesting?: boolean;
}

export interface ApproveOptions {
  candidateId: string;
  userId: string;
  notes?: string;
}

export interface RejectOptions {
  candidateId: string;
  userId: string;
  reason: string;
}

// ================================
// Database Row Types (for Supabase)
// ================================

export interface EvolutionConfigRow {
  id: string;
  agent_id: string;
  enabled: boolean;
  min_feedback_count: number;
  min_improvement_threshold: number;
  auto_promote_threshold: number;
  require_human_approval: boolean;
  max_candidates_per_cycle: number;
  created_at: string;
  updated_at: string;
}

export interface EvolutionCycleRow {
  id: string;
  agent_id: string;
  status: EvolutionCycleStatus;
  started_at: string;
  completed_at: string | null;
  feedback_summary: FeedbackSummary | null;
  error_message: string | null;
  created_at: string;
}

export interface EvolutionCandidateRow {
  id: string;
  cycle_id: string;
  agent_id: string;
  candidate_version: number;
  system_prompt: string;
  templates: Record<string, string>;
  model_options: Record<string, unknown> | null;
  generation_rationale: string;
  test_results: ABTestResult | null;
  baseline_score: number | null;
  candidate_score: number | null;
  improvement_delta: number | null;
  status: CandidateStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

// ================================
// Utility Functions for Type Conversion
// ================================

export function configRowToConfig(row: EvolutionConfigRow): EvolutionConfig {
  return {
    id: row.id,
    agentId: row.agent_id,
    enabled: row.enabled,
    minFeedbackCount: row.min_feedback_count,
    minImprovementThreshold: row.min_improvement_threshold,
    autoPromoteThreshold: row.auto_promote_threshold,
    requireHumanApproval: row.require_human_approval,
    maxCandidatesPerCycle: row.max_candidates_per_cycle,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function cycleRowToCycle(row: EvolutionCycleRow): EvolutionCycle {
  return {
    id: row.id,
    agentId: row.agent_id,
    status: row.status,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    feedbackSummary: row.feedback_summary || undefined,
    errorMessage: row.error_message || undefined,
    createdAt: new Date(row.created_at),
  };
}

export function candidateRowToCandidate(row: EvolutionCandidateRow): PromptCandidate {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    agentId: row.agent_id,
    candidateVersion: row.candidate_version,
    systemPrompt: row.system_prompt,
    templates: row.templates,
    modelOptions: row.model_options || undefined,
    generationRationale: row.generation_rationale,
    testResults: row.test_results || undefined,
    baselineScore: row.baseline_score ?? undefined,
    candidateScore: row.candidate_score ?? undefined,
    improvementDelta: row.improvement_delta ?? undefined,
    status: row.status,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    reviewNotes: row.review_notes || undefined,
    createdAt: new Date(row.created_at),
  };
}
