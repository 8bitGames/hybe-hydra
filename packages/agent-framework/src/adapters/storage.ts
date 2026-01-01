/**
 * Storage Adapter Interfaces
 * ==========================
 * Abstract interfaces for storage operations.
 * Implement these interfaces to connect the agent framework to your storage backend.
 */

import type {
  DatabasePrompt,
  AgentMemory,
  MemoryQuery,
  MemoryUpdate,
  AgentFeedback,
} from '../types';

// ================================
// Prompt Storage Adapter
// ================================

/**
 * Interface for loading and managing agent prompts from storage.
 * Implement this to connect to your database (Supabase, Prisma, etc.)
 */
export interface IPromptStorageAdapter {
  /**
   * Load prompt configuration for an agent from storage.
   * Returns null if no prompt is found (will use fallback from config).
   * @param agentId - The agent's unique identifier
   * @returns Promise resolving to DatabasePrompt or null
   */
  loadPrompt(agentId: string): Promise<DatabasePrompt | null>;

  /**
   * Save or update a prompt in storage (optional).
   * @param prompt - The prompt configuration to save
   * @returns Promise resolving to the saved prompt
   */
  savePrompt?(prompt: DatabasePrompt): Promise<DatabasePrompt>;

  /**
   * Get prompt version history (optional).
   * @param agentId - The agent's unique identifier
   * @param limit - Maximum number of versions to return
   * @returns Promise resolving to array of historical prompts
   */
  getPromptHistory?(agentId: string, limit?: number): Promise<DatabasePrompt[]>;
}

// ================================
// Memory Storage Adapter
// ================================

/**
 * Interface for agent memory persistence.
 * Implement this to enable agents to learn and remember across sessions.
 */
export interface IMemoryStorageAdapter {
  /**
   * Query memories matching the specified criteria.
   * @param query - Memory query parameters
   * @returns Promise resolving to matching memories
   */
  queryMemories(query: MemoryQuery): Promise<AgentMemory[]>;

  /**
   * Store or update a memory.
   * @param agentId - The agent's unique identifier
   * @param scopeId - Optional scope identifier (e.g., campaignId, userId)
   * @param scopeName - Optional scope name for display
   * @param update - Memory data to store
   * @returns Promise resolving to the stored memory
   */
  storeMemory(
    agentId: string,
    scopeId: string | undefined,
    scopeName: string | undefined,
    update: MemoryUpdate
  ): Promise<AgentMemory>;

  /**
   * Delete a specific memory.
   * @param memoryId - The memory's unique identifier
   * @returns Promise resolving when deletion is complete
   */
  deleteMemory?(memoryId: string): Promise<void>;

  /**
   * Clean up expired memories (optional).
   * @param agentId - Optional agent filter
   * @returns Promise resolving to number of deleted memories
   */
  cleanupExpiredMemories?(agentId?: string): Promise<number>;
}

// ================================
// Execution Log Storage Adapter
// ================================

/**
 * Execution log entry for tracking agent runs.
 */
export interface ExecutionLogEntry {
  id?: string;
  agentId: string;
  model: string;
  inputSummary: string;
  outputSummary?: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  latencyMs?: number;
  success?: boolean;
  errorMessage?: string;
  createdAt?: Date;
  completedAt?: Date;
}

/**
 * Interface for logging agent executions.
 * Implement this to track agent performance and debug issues.
 */
export interface IExecutionLogAdapter {
  /**
   * Log the start of an agent execution.
   * @param entry - Initial log entry data
   * @returns Promise resolving to the log entry ID
   */
  logStart(entry: ExecutionLogEntry): Promise<string>;

  /**
   * Update a log entry when execution completes.
   * @param logId - The log entry ID from logStart
   * @param updates - Completion data to add
   * @returns Promise resolving when update is complete
   */
  logComplete(
    logId: string,
    updates: Partial<ExecutionLogEntry>
  ): Promise<void>;

  /**
   * Update a log entry when execution fails.
   * @param logId - The log entry ID from logStart
   * @param error - Error information
   * @returns Promise resolving when update is complete
   */
  logError(
    logId: string,
    error: { message: string; stack?: string }
  ): Promise<void>;

  /**
   * Query execution logs (optional).
   * @param agentId - Filter by agent ID
   * @param limit - Maximum entries to return
   * @returns Promise resolving to log entries
   */
  queryLogs?(agentId: string, limit?: number): Promise<ExecutionLogEntry[]>;
}

// ================================
// Feedback Storage Adapter
// ================================

/**
 * Interface for storing user feedback on agent outputs.
 * Implement this to enable agent quality improvement.
 */
export interface IFeedbackStorageAdapter {
  /**
   * Store feedback for an agent execution.
   * @param feedback - Feedback data
   * @returns Promise resolving to the stored feedback
   */
  storeFeedback(feedback: AgentFeedback): Promise<AgentFeedback>;

  /**
   * Query feedback for an agent (optional).
   * @param agentId - The agent's unique identifier
   * @param limit - Maximum entries to return
   * @returns Promise resolving to feedback entries
   */
  queryFeedback?(agentId: string, limit?: number): Promise<AgentFeedback[]>;

  /**
   * Get average rating for an agent (optional).
   * @param agentId - The agent's unique identifier
   * @returns Promise resolving to average rating
   */
  getAverageRating?(agentId: string): Promise<number | null>;
}

// ================================
// Combined Storage Adapter
// ================================

/**
 * Combined interface for all storage operations.
 * Implement this for a unified storage backend.
 */
export interface IStorageAdapter {
  prompts?: IPromptStorageAdapter;
  memory?: IMemoryStorageAdapter;
  executionLogs?: IExecutionLogAdapter;
  feedback?: IFeedbackStorageAdapter;
}

// ================================
// Adapter Factory Types
// ================================

/**
 * Configuration for creating storage adapters.
 */
export interface StorageAdapterConfig {
  /** Database connection string or configuration */
  connection?: string | Record<string, unknown>;
  /** Optional prefix for table/collection names */
  tablePrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Factory function type for creating storage adapters.
 */
export type StorageAdapterFactory = (
  config: StorageAdapterConfig
) => IStorageAdapter;
