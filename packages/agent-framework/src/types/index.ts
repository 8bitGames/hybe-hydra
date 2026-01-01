/**
 * Agent Framework Type Definitions
 * =================================
 * Core types for the AI Agent system.
 * These types are framework-level and can be used across any project.
 */

import type { ZodSchema } from 'zod';
import type { ModelName } from './constants';

// Re-export constants and model types
export * from './constants';

// ================================
// Model Configuration Types
// ================================

export type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'custom';

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  // OpenAI specific
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  presencePenalty?: number;
  frequencyPenalty?: number;
  // Gemini specific
  thinkingLevel?: 'low' | 'high';
  // Tools
  tools?: AgentTool[];
}

export interface AgentTool {
  type: 'google_search' | 'code_execution' | 'function' | string;
  config?: Record<string, unknown>;
}

export interface ModelConfig {
  provider: ModelProvider;
  name: ModelName;
  options?: ModelOptions;
}

// ================================
// Agent Configuration Types
// ================================

export type AgentCategory = string;

export interface AgentPrompts {
  system: string;
  templates: Record<string, string>;
}

export interface AgentConfig<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  model: ModelConfig;
  /**
   * Fallback prompts - used only if database/storage prompts not loaded.
   */
  prompts: AgentPrompts;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  dependencies?: string[];
}

// ================================
// Agent Context Types
// ================================

/**
 * Base workflow metadata - extend this for project-specific needs
 */
export interface BaseWorkflowMetadata {
  sessionId?: string;
  startedAt?: Date;
  language?: string;
  [key: string]: unknown;
}

/**
 * Base agent context - extend this for project-specific needs
 */
export interface BaseAgentContext<TWorkflow extends BaseWorkflowMetadata = BaseWorkflowMetadata> {
  workflow: TWorkflow;
  [key: string]: unknown;
}

// ================================
// Agent Execution Types
// ================================

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface AgentMetadata {
  agentId: string;
  model: ModelName;
  tokenUsage: TokenUsage;
  latencyMs: number;
  timestamp: string;
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: AgentMetadata;
}

// ================================
// Workflow Types
// ================================

export interface AgentStage {
  agents: string[];
  parallel: boolean;
}

export interface WorkflowConfig {
  stages: string[];
  parallelExecution: boolean;
  stopOnError: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface StageResult {
  stage: string;
  success: boolean;
  results: Map<string, AgentResult<unknown>>;
  duration: number;
  errors: string[];
}

export interface WorkflowResult<TContext extends BaseAgentContext = BaseAgentContext> {
  success: boolean;
  stages: StageResult[];
  totalDuration: number;
  context: TContext;
  errors: string[];
}

// ================================
// Reflection Pattern Types
// ================================

export interface ReflectionConfig {
  /** Maximum number of reflection iterations (default: 3) */
  maxIterations: number;
  /** Minimum quality score to accept output (0-1, default: 0.7) */
  qualityThreshold: number;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
  /** Custom reflection prompt template */
  reflectionPrompt?: string;
  /** Aspects to evaluate during reflection */
  evaluationAspects?: ReflectionAspect[];
}

export type ReflectionAspect =
  | 'relevance'      // Output relevance to input
  | 'quality'        // Overall quality
  | 'creativity'     // Creative value
  | 'accuracy'       // Factual accuracy
  | 'completeness'   // Completeness of response
  | 'tone'           // Tone appropriateness
  | 'structure';     // Output structure

export interface ReflectionEvaluation {
  /** Overall quality score (0-1) */
  score: number;
  /** Whether output passes quality threshold */
  passed: boolean;
  /** Specific feedback for improvement */
  feedback: string;
  /** Areas that need improvement */
  improvementAreas: string[];
  /** Aspect-level scores */
  aspectScores: Record<ReflectionAspect, number>;
}

export interface ReflectionIteration {
  /** Iteration number (1-based) */
  iteration: number;
  /** Output from this iteration */
  output: unknown;
  /** Evaluation of this iteration's output */
  evaluation: ReflectionEvaluation;
  /** Token usage for this iteration */
  tokenUsage: TokenUsage;
  /** Latency in milliseconds */
  latencyMs: number;
}

export interface ReflectionResult<T> extends AgentResult<T> {
  /** All reflection iterations performed */
  iterations: ReflectionIteration[];
  /** Total iterations performed */
  totalIterations: number;
  /** Whether reflection improved the output */
  improved: boolean;
  /** Score improvement from first to final iteration */
  scoreImprovement: number;
}

// ================================
// Streaming Types
// ================================

export interface StreamChunk {
  /** Partial content */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Accumulated content so far */
  accumulated?: string;
}

export interface StreamResult<T> {
  /** Final parsed output */
  data?: T;
  /** Whether streaming succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Total token usage */
  tokenUsage: TokenUsage;
  /** Total latency */
  latencyMs: number;
}

// ================================
// Memory System Types
// ================================

export interface AgentMemory {
  id: string;
  agentId: string;
  scopeId?: string;  // Project-specific scope (e.g., campaignId, userId)
  scopeName?: string; // Project-specific scope name (e.g., artistName, userName)
  memoryType: MemoryType;
  key: string;
  value: Record<string, unknown>;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export type MemoryType =
  | 'preference'     // User preferences
  | 'pattern'        // Learned patterns
  | 'feedback'       // User feedback
  | 'context'        // Contextual information
  | 'style'          // Style preferences
  | 'performance';   // Performance metrics

export interface MemoryQuery {
  agentId: string;
  scopeId?: string;
  scopeName?: string;
  memoryTypes?: MemoryType[];
  keys?: string[];
  minImportance?: number;
  limit?: number;
}

export interface MemoryUpdate {
  key: string;
  value: Record<string, unknown>;
  memoryType: MemoryType;
  importance?: number;
  ttlSeconds?: number;
}

// ================================
// Storage Adapter Types
// ================================

export interface DatabasePrompt {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  category: string;
  system_prompt: string;
  templates: Record<string, string>;
  model_provider: ModelProvider;
  model_name: string;
  model_options: Record<string, unknown>;
  is_active: boolean;
  version: number;
}

export interface PromptHistoryRecord {
  id: string;
  agent_prompt_id: string;
  version: number;
  system_prompt: string;
  templates: Record<string, string>;
  model_options: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
  change_notes: string | null;
}

// ================================
// Feedback Types
// ================================

export interface AgentFeedback {
  id?: string;
  agentId: string;
  executionId?: string;
  rating: number;  // 1-5
  feedback?: string;
  inputSummary?: string;
  outputSummary?: string;
  createdAt?: Date;
}
