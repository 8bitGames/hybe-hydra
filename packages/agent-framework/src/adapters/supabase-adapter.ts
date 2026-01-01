/**
 * Supabase Storage Adapter Implementation
 * ========================================
 * Ready-to-use storage adapter for Supabase.
 *
 * Required Tables:
 * - agent_prompts: Store prompt configurations
 * - agent_prompt_history: Prompt version history
 * - agent_memories: Agent memory storage
 * - agent_execution_logs: Execution tracking
 * - agent_feedback: User feedback
 *
 * @example
 * ```typescript
 * import { createSupabaseStorageAdapter } from '@anthropic/agent-framework/adapters';
 * import { createClient } from '@supabase/supabase-js';
 *
 * const supabase = createClient(url, key);
 * const storage = createSupabaseStorageAdapter(supabase);
 *
 * // Use with BaseAgent
 * class MyAgent extends BaseAgent<I, O> {
 *   constructor() {
 *     super(config, { storage });
 *   }
 * }
 * ```
 */

import type {
  DatabasePrompt,
  AgentMemory,
  MemoryQuery,
  MemoryUpdate,
  AgentFeedback,
} from '../types';

import type {
  IStorageAdapter,
  IPromptStorageAdapter,
  IMemoryStorageAdapter,
  IExecutionLogAdapter,
  IFeedbackStorageAdapter,
  ExecutionLogEntry,
} from './storage';

// ================================
// Supabase Client Type
// ================================

/**
 * Minimal Supabase client interface for type safety without bundling.
 * Compatible with @supabase/supabase-js SupabaseClient.
 */
export interface SupabaseClientLike {
  from(table: string): {
    select(columns?: string): SupabaseQueryBuilder;
    insert(data: Record<string, unknown> | Record<string, unknown>[]): SupabaseQueryBuilder;
    update(data: Record<string, unknown>): SupabaseQueryBuilder;
    delete(): SupabaseQueryBuilder;
    upsert(data: Record<string, unknown> | Record<string, unknown>[]): SupabaseQueryBuilder;
  };
}

interface SupabaseQueryBuilder {
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  like(column: string, value: string): this;
  ilike(column: string, value: string): this;
  in(column: string, values: unknown[]): this;
  order(column: string, options?: { ascending?: boolean }): this;
  limit(count: number): this;
  single(): Promise<{ data: unknown; error: unknown }>;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
  then<TResult1 = { data: unknown[]; error: unknown }>(
    onfulfilled?: ((value: { data: unknown[]; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null
  ): Promise<TResult1>;
}

// ================================
// Configuration
// ================================

export interface SupabaseAdapterConfig {
  /** Supabase client instance */
  client: SupabaseClientLike;
  /** Table name prefix (default: 'agent_') */
  tablePrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
}

// ================================
// Prompt Storage Adapter
// ================================

export class SupabasePromptStorageAdapter implements IPromptStorageAdapter {
  private client: SupabaseClientLike;
  private tableName: string;
  private historyTableName: string;
  private debug: boolean;
  private cache: Map<string, { prompt: DatabasePrompt; loadedAt: number }>;
  private cacheTtlMs: number;

  constructor(config: SupabaseAdapterConfig) {
    this.client = config.client;
    this.tableName = `${config.tablePrefix ?? 'agent_'}prompts`;
    this.historyTableName = `${config.tablePrefix ?? 'agent_'}prompt_history`;
    this.debug = config.debug ?? false;
    this.cache = new Map();
    this.cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000;
  }

  async loadPrompt(agentId: string): Promise<DatabasePrompt | null> {
    try {
      // Check cache
      const cached = this.cache.get(agentId);
      if (cached && Date.now() - cached.loadedAt < this.cacheTtlMs) {
        if (this.debug) console.log(`[SupabasePrompt] Cache hit for ${agentId}`);
        return cached.prompt;
      }

      const result = await this.client
        .from(this.tableName)
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .single();

      if (result.error || !result.data) {
        if (this.debug) console.log(`[SupabasePrompt] No prompt found for ${agentId}`);
        return null;
      }

      const prompt = result.data as DatabasePrompt;
      this.cache.set(agentId, { prompt, loadedAt: Date.now() });

      return prompt;
    } catch (error) {
      if (this.debug) console.error(`[SupabasePrompt] Error loading ${agentId}:`, error);
      return null;
    }
  }

  async savePrompt(prompt: DatabasePrompt): Promise<DatabasePrompt> {
    const result = await this.client
      .from(this.tableName)
      .upsert({
        ...prompt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prompt.id)
      .single();

    if (result.error) {
      throw new Error(`Failed to save prompt: ${String(result.error)}`);
    }

    // Invalidate cache
    this.cache.delete(prompt.agent_id);

    return result.data as DatabasePrompt;
  }

  async getPromptHistory(agentId: string, limit = 10): Promise<DatabasePrompt[]> {
    // First get the prompt ID
    const promptResult = await this.client
      .from(this.tableName)
      .select('id')
      .eq('agent_id', agentId)
      .single();

    if (promptResult.error || !promptResult.data) {
      return [];
    }

    const promptData = promptResult.data as { id: string };

    const result = await this.client
      .from(this.historyTableName)
      .select('*')
      .eq('agent_prompt_id', promptData.id)
      .order('version', { ascending: false })
      .limit(limit);

    if (result.error) {
      return [];
    }

    return (result.data as DatabasePrompt[]) || [];
  }

  clearCache(agentId?: string): void {
    if (agentId) {
      this.cache.delete(agentId);
    } else {
      this.cache.clear();
    }
  }
}

// ================================
// Memory Storage Adapter
// ================================

export class SupabaseMemoryStorageAdapter implements IMemoryStorageAdapter {
  private client: SupabaseClientLike;
  private tableName: string;
  private debug: boolean;

  constructor(config: SupabaseAdapterConfig) {
    this.client = config.client;
    this.tableName = `${config.tablePrefix ?? 'agent_'}memories`;
    this.debug = config.debug ?? false;
  }

  async queryMemories(query: MemoryQuery): Promise<AgentMemory[]> {
    try {
      let builder = this.client
        .from(this.tableName)
        .select('*')
        .eq('agent_id', query.agentId);

      if (query.scopeId) {
        builder = builder.eq('scope_id', query.scopeId);
      }

      if (query.scopeName) {
        builder = builder.eq('scope_name', query.scopeName);
      }

      if (query.memoryTypes && query.memoryTypes.length > 0) {
        builder = builder.in('memory_type', query.memoryTypes);
      }

      if (query.keys && query.keys.length > 0) {
        builder = builder.in('key', query.keys);
      }

      if (query.minImportance !== undefined) {
        builder = builder.gte('importance', query.minImportance);
      }

      builder = builder.order('importance', { ascending: false });

      if (query.limit) {
        builder = builder.limit(query.limit);
      }

      const result = await builder;

      if (result.error) {
        if (this.debug) console.error(`[SupabaseMemory] Query error:`, result.error);
        return [];
      }

      return (result.data as AgentMemory[]) || [];
    } catch (error) {
      if (this.debug) console.error(`[SupabaseMemory] Error querying:`, error);
      return [];
    }
  }

  async storeMemory(
    agentId: string,
    scopeId: string | undefined,
    scopeName: string | undefined,
    update: MemoryUpdate
  ): Promise<AgentMemory> {
    const now = new Date();
    const expiresAt = update.ttlSeconds
      ? new Date(now.getTime() + update.ttlSeconds * 1000)
      : undefined;

    const memoryData = {
      agent_id: agentId,
      scope_id: scopeId || null,
      scope_name: scopeName || null,
      memory_type: update.memoryType,
      key: update.key,
      value: update.value,
      importance: update.importance ?? 0.5,
      access_count: 1,
      last_accessed_at: now.toISOString(),
      created_at: now.toISOString(),
      expires_at: expiresAt?.toISOString() || null,
    };

    const result = await this.client
      .from(this.tableName)
      .upsert(memoryData)
      .single();

    if (result.error) {
      throw new Error(`Failed to store memory: ${String(result.error)}`);
    }

    return result.data as AgentMemory;
  }

  async deleteMemory(memoryId: string): Promise<void> {
    const result = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', memoryId);

    if (result.error) {
      throw new Error(`Failed to delete memory: ${String(result.error)}`);
    }
  }

  async cleanupExpiredMemories(agentId?: string): Promise<number> {
    let builder = this.client
      .from(this.tableName)
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (agentId) {
      builder = builder.eq('agent_id', agentId);
    }

    const result = await builder;

    if (result.error) {
      throw new Error(`Failed to cleanup memories: ${String(result.error)}`);
    }

    // Supabase doesn't return count directly, return 0 for now
    return 0;
  }
}

// ================================
// Execution Log Adapter
// ================================

export class SupabaseExecutionLogAdapter implements IExecutionLogAdapter {
  private client: SupabaseClientLike;
  private tableName: string;
  private debug: boolean;

  constructor(config: SupabaseAdapterConfig) {
    this.client = config.client;
    this.tableName = `${config.tablePrefix ?? 'agent_'}execution_logs`;
    this.debug = config.debug ?? false;
  }

  async logStart(entry: ExecutionLogEntry): Promise<string> {
    const logData = {
      agent_id: entry.agentId,
      model: entry.model,
      input_summary: entry.inputSummary,
      success: null,
      created_at: new Date().toISOString(),
    };

    if (this.debug) console.log(`[SupabaseLog] Starting execution for ${entry.agentId}`);

    const result = await this.client
      .from(this.tableName)
      .insert(logData)
      .single();

    if (result.error) {
      if (this.debug) console.error(`[SupabaseLog] Failed to log start:`, result.error);
      throw new Error(`Failed to log start: ${String(result.error)}`);
    }

    const data = result.data as { id: string };
    return data.id;
  }

  async logComplete(logId: string, updates: Partial<ExecutionLogEntry>): Promise<void> {
    const updateData: Record<string, unknown> = {
      completed_at: new Date().toISOString(),
      success: true,
    };

    if (updates.outputSummary) {
      updateData.output_summary = updates.outputSummary;
    }

    if (updates.tokenUsage) {
      updateData.token_usage = updates.tokenUsage;
    }

    if (updates.latencyMs !== undefined) {
      updateData.latency_ms = updates.latencyMs;
    }

    const result = await this.client
      .from(this.tableName)
      .update(updateData)
      .eq('id', logId);

    if (result.error) {
      throw new Error(`Failed to log complete: ${String(result.error)}`);
    }
  }

  async logError(logId: string, error: { message: string; stack?: string }): Promise<void> {
    const result = await this.client
      .from(this.tableName)
      .update({
        completed_at: new Date().toISOString(),
        success: false,
        error_message: error.message,
      })
      .eq('id', logId);

    if (result.error) {
      throw new Error(`Failed to log error: ${String(result.error)}`);
    }
  }

  async queryLogs(agentId: string, limit = 50): Promise<ExecutionLogEntry[]> {
    const result = await this.client
      .from(this.tableName)
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (result.error) {
      return [];
    }

    return (result.data as ExecutionLogEntry[]) || [];
  }
}

// ================================
// Feedback Storage Adapter
// ================================

export class SupabaseFeedbackStorageAdapter implements IFeedbackStorageAdapter {
  private client: SupabaseClientLike;
  private tableName: string;
  private debug: boolean;

  constructor(config: SupabaseAdapterConfig) {
    this.client = config.client;
    this.tableName = `${config.tablePrefix ?? 'agent_'}feedback`;
    this.debug = config.debug ?? false;
  }

  async storeFeedback(feedback: AgentFeedback): Promise<AgentFeedback> {
    const feedbackData = {
      agent_id: feedback.agentId,
      execution_id: feedback.executionId || null,
      rating: feedback.rating,
      feedback: feedback.feedback || null,
      input_summary: feedback.inputSummary || null,
      output_summary: feedback.outputSummary || null,
      created_at: new Date().toISOString(),
    };

    if (this.debug) console.log(`[SupabaseFeedback] Storing feedback for ${feedback.agentId}`);

    const result = await this.client
      .from(this.tableName)
      .insert(feedbackData)
      .single();

    if (result.error) {
      if (this.debug) console.error(`[SupabaseFeedback] Failed to store:`, result.error);
      throw new Error(`Failed to store feedback: ${String(result.error)}`);
    }

    return result.data as AgentFeedback;
  }

  async queryFeedback(agentId: string, limit = 50): Promise<AgentFeedback[]> {
    const result = await this.client
      .from(this.tableName)
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (result.error) {
      return [];
    }

    return (result.data as AgentFeedback[]) || [];
  }

  async getAverageRating(agentId: string): Promise<number | null> {
    // Note: Supabase doesn't have built-in aggregation via the client
    // This is a simple implementation that fetches all ratings
    const result = await this.client
      .from(this.tableName)
      .select('rating')
      .eq('agent_id', agentId);

    if (result.error || !result.data || result.data.length === 0) {
      return null;
    }

    const ratings = result.data as Array<{ rating: number }>;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return sum / ratings.length;
  }
}

// ================================
// Factory Function
// ================================

/**
 * Create a complete Supabase storage adapter.
 *
 * @example
 * ```typescript
 * import { createClient } from '@supabase/supabase-js';
 * import { createSupabaseStorageAdapter } from '@anthropic/agent-framework/adapters';
 *
 * const supabase = createClient(
 *   process.env.SUPABASE_URL!,
 *   process.env.SUPABASE_ANON_KEY!
 * );
 *
 * const storage = createSupabaseStorageAdapter(supabase);
 * ```
 */
export function createSupabaseStorageAdapter(
  client: SupabaseClientLike,
  options?: {
    tablePrefix?: string;
    debug?: boolean;
    cacheTtlMs?: number;
  }
): IStorageAdapter {
  const config: SupabaseAdapterConfig = {
    client,
    tablePrefix: options?.tablePrefix ?? 'agent_',
    debug: options?.debug ?? false,
    cacheTtlMs: options?.cacheTtlMs,
  };

  return {
    prompts: new SupabasePromptStorageAdapter(config),
    memory: new SupabaseMemoryStorageAdapter(config),
    executionLogs: new SupabaseExecutionLogAdapter(config),
    feedback: new SupabaseFeedbackStorageAdapter(config),
  };
}

/**
 * SQL Migration for creating the required tables.
 * Run this in your Supabase SQL editor to set up the schema.
 */
export const SUPABASE_MIGRATION_SQL = `
-- Agent Prompts Table
CREATE TABLE IF NOT EXISTS agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  templates JSONB DEFAULT '{}',
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_options JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Agent Prompt History Table
CREATE TABLE IF NOT EXISTS agent_prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_prompt_id UUID NOT NULL REFERENCES agent_prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  templates JSONB DEFAULT '{}',
  model_options JSONB DEFAULT '{}',
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_notes TEXT
);

-- Agent Memories Table
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  scope_id TEXT,
  scope_name TEXT,
  memory_type TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  importance FLOAT DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(agent_id, scope_id, key)
);

-- Agent Execution Logs Table
CREATE TABLE IF NOT EXISTS agent_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  token_usage JSONB,
  latency_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Agent Feedback Table
CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  execution_id UUID REFERENCES agent_execution_logs(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  input_summary TEXT,
  output_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_prompts_agent_id ON agent_prompts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_scope ON agent_memories(agent_id, scope_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_id ON agent_execution_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent_id ON agent_feedback(agent_id);
`;
