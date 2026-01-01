/**
 * Hybe Base Agent (v2)
 *
 * Project-specific base agent extending @hybe/agent-framework with:
 * - Supabase integration for prompts, memory, and logging
 * - Hybe-specific context handling
 * - Backward-compatible memory methods (remember/recall/forget)
 */

import { BaseAgent, GeminiClient, OpenAIClient } from '@hybe/agent-framework';
import type {
  IModelClient,
  DatabasePrompt,
  AgentResult,
  AgentMemory,
  TokenUsage,
  AgentConfig,
} from '@hybe/agent-framework';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { HybeAgentContext } from '../types';

// ============================================================================
// Types
// ============================================================================

interface ExecutionLogData {
  id: string;
}

interface MemoryRecord {
  id: string;
  agent_id: string;
  scope_id: string;
  key: string;
  value: Record<string, unknown>;
  importance: number;
  memory_type: string;
  access_count: number;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

// ============================================================================
// Hybe Base Agent
// ============================================================================

/**
 * Base agent for all Hybe Hydra agents
 *
 * Provides:
 * - Automatic model client creation (Gemini/OpenAI)
 * - Database prompt loading from Supabase
 * - Memory context injection
 * - Execution logging
 * - Backward-compatible memory methods
 *
 * @example
 * ```typescript
 * class MyAgent extends HybeBaseAgent<MyInput, MyOutput> {
 *   constructor() {
 *     super(MyAgentConfig);
 *   }
 *
 *   protected buildPrompt(input: MyInput, context: HybeAgentContext): string {
 *     return this.fillTemplate(this.getTemplate('main'), {
 *       artistName: context.workflow.artistName,
 *       // ...
 *     });
 *   }
 * }
 * ```
 */
export abstract class HybeBaseAgent<TInput, TOutput> extends BaseAgent<
  TInput,
  TOutput,
  HybeAgentContext
> {
  protected supabase: SupabaseClient;

  constructor(config: AgentConfig<TInput, TOutput>) {
    super(config);

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[HybeBaseAgent] Supabase credentials not found, some features will be disabled');
    }

    this.supabase = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseKey || 'placeholder-key'
    );
  }

  // ==========================================================================
  // Abstract Method Implementations
  // ==========================================================================

  /**
   * Create appropriate model client based on config
   */
  protected createModelClient(): IModelClient {
    const { provider, name, options } = this.config.model;

    switch (provider) {
      case 'gemini':
        return new GeminiClient({
          model: name,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          topP: options?.topP,
          topK: options?.topK,
        });

      case 'openai':
        return new OpenAIClient({
          model: name,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          topP: options?.topP,
        });

      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  }

  // ==========================================================================
  // Override Methods for Supabase Integration
  // ==========================================================================

  /**
   * Load prompt from Supabase agent_prompts table
   */
  protected async loadPromptFromStorage(): Promise<DatabasePrompt | null> {
    try {
      const { data, error } = await this.supabase
        .from('agent_prompts')
        .select('*')
        .eq('agent_id', this.config.id)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          // Not "no rows" error
          console.warn(`[${this.config.id}] Failed to load prompt from storage:`, error.message);
        }
        return null;
      }

      return data as DatabasePrompt;
    } catch (err) {
      console.warn(`[${this.config.id}] Error loading prompt from storage:`, err);
      return null;
    }
  }

  /**
   * Get memory context for prompt injection
   */
  protected async getMemoryContextForPrompt(context: HybeAgentContext): Promise<string> {
    const scopeId = context.workflow.campaignId || context.workflow.sessionId;
    if (!scopeId) return '';

    try {
      const { data: memories, error } = await this.supabase
        .from('agent_memories')
        .select('*')
        .eq('agent_id', this.config.id)
        .eq('scope_id', scopeId)
        .order('importance', { ascending: false })
        .limit(10);

      if (error || !memories?.length) return '';

      const memoryLines = memories.map(
        (m: MemoryRecord) => `- ${m.key}: ${JSON.stringify(m.value)}`
      );

      return `## Learned Patterns\n${memoryLines.join('\n')}`;
    } catch {
      return '';
    }
  }

  /**
   * Log execution start
   */
  protected async logExecutionStart(
    input: TInput,
    context: HybeAgentContext
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('agent_execution_logs')
        .insert({
          agent_id: this.config.id,
          session_id: context.workflow.sessionId,
          campaign_id: context.workflow.campaignId,
          status: 'running',
          input_summary: JSON.stringify(input).slice(0, 500),
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.warn(`[${this.config.id}] Failed to log execution start:`, error.message);
        return null;
      }

      return (data as ExecutionLogData)?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Log execution completion
   */
  protected async logExecutionComplete(
    executionId: string,
    result: AgentResult<TOutput>,
    output: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase
        .from('agent_execution_logs')
        .update({
          status: 'completed',
          output_summary: JSON.stringify(output).slice(0, 1000),
          token_usage: result.metadata.tokenUsage,
          latency_ms: result.metadata.latencyMs,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);
    } catch (err) {
      console.warn(`[${this.config.id}] Failed to log execution complete:`, err);
    }
  }

  /**
   * Log execution error
   */
  protected async logExecutionError(
    executionId: string,
    result: AgentResult<TOutput>,
    errorMessage: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('agent_execution_logs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          token_usage: result.metadata.tokenUsage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId);
    } catch (err) {
      console.warn(`[${this.config.id}] Failed to log execution error:`, err);
    }
  }

  // ==========================================================================
  // Backward-Compatible Memory Methods
  // ==========================================================================

  /**
   * Store a memory for this agent
   * @param key Memory identifier
   * @param value Memory content
   * @param context Current context (for scope)
   * @param options Additional options
   */
  async remember(
    key: string,
    value: Record<string, unknown>,
    context: HybeAgentContext,
    options: {
      importance?: number;
      memoryType?: 'preference' | 'pattern' | 'feedback' | 'context' | 'style' | 'performance';
      expiresAt?: Date;
    } = {}
  ): Promise<void> {
    const scopeId = context.workflow.campaignId || context.workflow.sessionId;
    if (!scopeId) {
      console.warn(`[${this.config.id}] Cannot remember without scope (campaignId or sessionId)`);
      return;
    }

    try {
      await this.supabase.from('agent_memories').upsert(
        {
          agent_id: this.config.id,
          scope_id: scopeId,
          key,
          value,
          importance: options.importance ?? 0.5,
          memory_type: options.memoryType ?? 'pattern',
          expires_at: options.expiresAt?.toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'agent_id,scope_id,key',
        }
      );
    } catch (err) {
      console.warn(`[${this.config.id}] Failed to remember:`, err);
    }
  }

  /**
   * Recall memories for this agent
   * @param context Current context (for scope)
   * @param options Query options
   */
  async recall(
    context: HybeAgentContext,
    options: {
      limit?: number;
      minImportance?: number;
      memoryType?: string;
    } = {}
  ): Promise<AgentMemory[]> {
    const scopeId = context.workflow.campaignId || context.workflow.sessionId;
    if (!scopeId) return [];

    try {
      let query = this.supabase
        .from('agent_memories')
        .select('*')
        .eq('agent_id', this.config.id)
        .eq('scope_id', scopeId)
        .order('importance', { ascending: false })
        .limit(options.limit ?? 10);

      if (options.minImportance !== undefined) {
        query = query.gte('importance', options.minImportance);
      }

      if (options.memoryType) {
        query = query.eq('memory_type', options.memoryType);
      }

      const { data, error } = await query;

      if (error) return [];

      return (data || []).map((m: MemoryRecord) => ({
        id: m.id,
        agentId: m.agent_id,
        scopeId: m.scope_id,
        key: m.key,
        value: m.value,
        importance: m.importance,
        memoryType: m.memory_type as AgentMemory['memoryType'],
        accessCount: m.access_count,
        lastAccessedAt: new Date(m.last_accessed_at),
        createdAt: new Date(m.created_at),
        expiresAt: m.expires_at ? new Date(m.expires_at) : undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Recall a single memory by key
   */
  async recallOne(
    key: string,
    context: HybeAgentContext
  ): Promise<AgentMemory | null> {
    const scopeId = context.workflow.campaignId || context.workflow.sessionId;
    if (!scopeId) return null;

    try {
      const { data, error } = await this.supabase
        .from('agent_memories')
        .select('*')
        .eq('agent_id', this.config.id)
        .eq('scope_id', scopeId)
        .eq('key', key)
        .single();

      if (error || !data) return null;

      const m = data as MemoryRecord;
      return {
        id: m.id,
        agentId: m.agent_id,
        scopeId: m.scope_id,
        key: m.key,
        value: m.value,
        importance: m.importance,
        memoryType: m.memory_type as AgentMemory['memoryType'],
        accessCount: m.access_count,
        lastAccessedAt: new Date(m.last_accessed_at),
        createdAt: new Date(m.created_at),
        expiresAt: m.expires_at ? new Date(m.expires_at) : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Forget a memory
   */
  async forget(key: string, context: HybeAgentContext): Promise<void> {
    const scopeId = context.workflow.campaignId || context.workflow.sessionId;
    if (!scopeId) return;

    try {
      await this.supabase
        .from('agent_memories')
        .delete()
        .eq('agent_id', this.config.id)
        .eq('scope_id', scopeId)
        .eq('key', key);
    } catch (err) {
      console.warn(`[${this.config.id}] Failed to forget:`, err);
    }
  }

  /**
   * Forget all memories for current scope
   */
  async forgetAll(context: HybeAgentContext): Promise<void> {
    const scopeId = context.workflow.campaignId || context.workflow.sessionId;
    if (!scopeId) return;

    try {
      await this.supabase
        .from('agent_memories')
        .delete()
        .eq('agent_id', this.config.id)
        .eq('scope_id', scopeId);
    } catch (err) {
      console.warn(`[${this.config.id}] Failed to forget all:`, err);
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default HybeBaseAgent;
