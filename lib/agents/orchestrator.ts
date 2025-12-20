/**
 * Workflow Orchestrator
 * =====================
 * Coordinates multi-agent workflows with parallel execution and context sharing
 *
 * Key Features:
 * - Agent lifecycle management
 * - Context propagation between agents
 * - Parallel execution optimization
 * - Error handling and recovery
 * - Workflow state tracking
 */

import type { AgentContext, AgentResult, WorkflowMetadata, ContentIdea } from './types';
import { preloadAllPrompts } from './prompt-loader';
import { BaseAgent } from './base-agent';
import { GEMINI_FLASH } from './constants';

// Agent imports
import { VisionAnalyzerAgent } from './analyzers/vision-analyzer';
import { TextPatternAgent } from './analyzers/text-pattern';
import { VisualTrendAgent } from './analyzers/visual-trend';
import { StrategySynthesizerAgent } from './analyzers/strategy-synthesizer';
import { CreativeDirectorAgent } from './creators/creative-director';
import { ScriptWriterAgent } from './creators/script-writer';
import { PromptEngineerAgent } from './transformers/prompt-engineer';
import { I2VSpecialistAgent } from './transformers/i2v-specialist';
import { PublishOptimizerAgent } from './publishers/publish-optimizer';
import { CopywriterAgent } from './publishers/copywriter';

// Workflow stage definitions
export type WorkflowStage = 'discover' | 'analyze' | 'create' | 'transform' | 'publish';

export interface WorkflowConfig {
  stages: WorkflowStage[];
  parallelExecution: boolean;
  stopOnError: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface StageResult {
  stage: WorkflowStage;
  success: boolean;
  results: Map<string, AgentResult<unknown>>;
  duration: number;
  errors: string[];
}

export interface WorkflowResult {
  success: boolean;
  stages: StageResult[];
  totalDuration: number;
  context: AgentContext;
  errors: string[];
}

// Default workflow configuration
const DEFAULT_CONFIG: WorkflowConfig = {
  stages: ['analyze', 'create', 'transform', 'publish'],
  parallelExecution: true,
  stopOnError: false,
  maxRetries: 2,
  timeoutMs: 120000, // 2 minutes per stage
};

/**
 * Workflow Orchestrator - Coordinates multi-agent workflows
 */
export class WorkflowOrchestrator {
  private config: WorkflowConfig;
  private agents: Map<string, unknown>;
  private context: AgentContext;

  constructor(
    workflowMetadata: WorkflowMetadata,
    config: Partial<WorkflowConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agents = new Map();
    this.context = this.initializeContext(workflowMetadata);
    this.initializeAgents();
  }

  /**
   * Initialize the shared context
   */
  private initializeContext(metadata: WorkflowMetadata): AgentContext {
    return {
      workflow: metadata,
    };
  }

  /**
   * Initialize all agents
   */
  private initializeAgents(): void {
    // Analyzer agents
    this.agents.set('vision-analyzer', new VisionAnalyzerAgent());
    this.agents.set('text-pattern', new TextPatternAgent());
    this.agents.set('visual-trend', new VisualTrendAgent());
    this.agents.set('strategy-synthesizer', new StrategySynthesizerAgent());

    // Creator agents
    this.agents.set('creative-director', new CreativeDirectorAgent());
    this.agents.set('script-writer', new ScriptWriterAgent());

    // Transformer agents
    this.agents.set('prompt-engineer', new PromptEngineerAgent());
    this.agents.set('i2v-specialist', new I2VSpecialistAgent());

    // Publisher agents
    this.agents.set('publish-optimizer', new PublishOptimizerAgent());
    this.agents.set('copywriter', new CopywriterAgent());
  }

  /**
   * Initialize all agents from database prompts
   * Call this before executeWorkflow for best performance
   */
  async initializeAgentsFromDatabase(): Promise<void> {
    // Preload all prompts into cache first
    await preloadAllPrompts();

    // Initialize each agent from database
    const initPromises = Array.from(this.agents.values()).map(async (agent) => {
      if (agent instanceof BaseAgent) {
        await (agent as BaseAgent<unknown, unknown>).initializeFromDatabase();
      }
    });

    await Promise.all(initPromises);
    console.log('[Orchestrator] All agents initialized from database');
  }

  /**
   * Get an agent by ID
   */
  getAgent<T>(agentId: string): T | undefined {
    return this.agents.get(agentId) as T | undefined;
  }

  /**
   * Get current context
   */
  getContext(): AgentContext {
    return this.context;
  }

  /**
   * Update context with new data
   */
  updateContext(updates: Partial<AgentContext>): void {
    this.context = {
      ...this.context,
      ...updates,
    };
  }

  /**
   * Execute a complete workflow
   */
  async executeWorkflow(
    initialInput: Record<string, unknown>
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const stageResults: StageResult[] = [];
    const errors: string[] = [];

    for (const stage of this.config.stages) {
      const stageStart = Date.now();

      try {
        const result = await this.executeStage(stage, initialInput);
        stageResults.push(result);

        // Update context with stage results
        this.mergeStageResults(stage, result);

        if (!result.success && this.config.stopOnError) {
          errors.push(`Stage ${stage} failed, stopping workflow`);
          break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Stage ${stage} error: ${errorMessage}`);

        stageResults.push({
          stage,
          success: false,
          results: new Map(),
          duration: Date.now() - stageStart,
          errors: [errorMessage],
        });

        if (this.config.stopOnError) {
          break;
        }
      }
    }

    return {
      success: stageResults.every(s => s.success),
      stages: stageResults,
      totalDuration: Date.now() - startTime,
      context: this.context,
      errors,
    };
  }

  /**
   * Execute a single workflow stage
   */
  private async executeStage(
    stage: WorkflowStage,
    input: Record<string, unknown>
  ): Promise<StageResult> {
    const startTime = Date.now();
    const results = new Map<string, AgentResult<unknown>>();
    const errors: string[] = [];

    const agentIds = this.getAgentsForStage(stage);

    if (this.config.parallelExecution) {
      // Execute agents in parallel
      const agentPromises = agentIds.map(async (agentId) => {
        try {
          const result = await this.executeAgent(agentId, input);
          return { agentId, result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            agentId,
            result: {
              success: false,
              error: errorMessage,
            } as AgentResult<unknown>,
          };
        }
      });

      const agentResults = await Promise.all(agentPromises);
      for (const { agentId, result } of agentResults) {
        results.set(agentId, result);
        if (!result.success && result.error) {
          errors.push(`${agentId}: ${result.error}`);
        }
      }
    } else {
      // Execute agents sequentially
      for (const agentId of agentIds) {
        try {
          const result = await this.executeAgent(agentId, input);
          results.set(agentId, result);
          if (!result.success && result.error) {
            errors.push(`${agentId}: ${result.error}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${agentId}: ${errorMessage}`);
          results.set(agentId, {
            success: false,
            error: errorMessage,
          } as AgentResult<unknown>);
        }
      }
    }

    return {
      stage,
      success: errors.length === 0,
      results,
      duration: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Execute a single agent with retry logic
   */
  private async executeAgent(
    agentId: string,
    input: Record<string, unknown>
  ): Promise<AgentResult<unknown>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (agent as any).execute(input, this.context);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[Orchestrator] Agent ${agentId} attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      metadata: {
        agentId,
        model: GEMINI_FLASH,
        tokenUsage: { input: 0, output: 0, total: 0 },
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get agent IDs for a specific stage
   */
  private getAgentsForStage(stage: WorkflowStage): string[] {
    const stageAgents: Record<WorkflowStage, string[]> = {
      discover: [], // External data fetching, not agent-based
      analyze: ['vision-analyzer', 'text-pattern', 'visual-trend', 'strategy-synthesizer'],
      create: ['creative-director', 'script-writer'],
      transform: ['prompt-engineer', 'i2v-specialist'],
      publish: ['publish-optimizer', 'copywriter'],
    };

    return stageAgents[stage] || [];
  }

  /**
   * Merge stage results into context
   */
  private mergeStageResults(stage: WorkflowStage, result: StageResult): void {
    const contextUpdates: Partial<AgentContext> = {};

    switch (stage) {
      case 'analyze':
        contextUpdates.analyze = {
          visionAnalysis: this.extractResult(result, 'vision-analyzer'),
          textPatterns: this.extractResult(result, 'text-pattern'),
          visualTrends: this.extractResult(result, 'visual-trend'),
          strategy: this.extractResult(result, 'strategy-synthesizer'),
        };
        break;

      case 'create':
        const creativeResult = this.extractResult(result, 'creative-director') as { ideas?: ContentIdea[] } | null;
        contextUpdates.create = {
          ideas: creativeResult?.ideas || [],
          selectedIdea: Array.isArray(creativeResult?.ideas) ? creativeResult.ideas[0] : undefined,
          script: this.extractResult(result, 'script-writer'),
        };
        break;

      // Transform and publish stages update context differently
      // based on specific workflow needs
    }

    this.updateContext(contextUpdates);
  }

  /**
   * Extract result data from stage results
   */
  private extractResult(stageResult: StageResult, agentId: string): unknown {
    const result = stageResult.results.get(agentId);
    return result?.success ? result.data : null;
  }

  /**
   * Execute a specific agent directly
   */
  async runAgent<TInput, TOutput>(
    agentId: string,
    input: TInput
  ): Promise<AgentResult<TOutput>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (agent as any).execute(input, this.context);
  }

  /**
   * Execute multiple agents in parallel
   */
  async runAgentsParallel<TOutput>(
    agentConfigs: Array<{ agentId: string; input: unknown }>
  ): Promise<Map<string, AgentResult<TOutput>>> {
    const results = new Map<string, AgentResult<TOutput>>();

    const promises = agentConfigs.map(async ({ agentId, input }) => {
      const result = await this.runAgent<unknown, TOutput>(agentId, input);
      return { agentId, result };
    });

    const agentResults = await Promise.all(promises);
    for (const { agentId, result } of agentResults) {
      results.set(agentId, result);
    }

    return results;
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create an orchestrator
 */
export function createOrchestrator(
  artistName: string,
  platform: 'tiktok' | 'instagram' | 'youtube_shorts' = 'tiktok',
  language: 'ko' | 'en' = 'ko',
  config?: Partial<WorkflowConfig>
): WorkflowOrchestrator {
  return new WorkflowOrchestrator(
    {
      artistName,
      platform,
      language,
      sessionId: `session_${Date.now()}`,
      startedAt: new Date(),
    },
    config
  );
}

/**
 * Quick workflow execution helper
 */
export async function runWorkflow(
  artistName: string,
  platform: 'tiktok' | 'instagram' | 'youtube_shorts',
  input: Record<string, unknown>,
  options?: {
    language?: 'ko' | 'en';
    stages?: WorkflowStage[];
    parallel?: boolean;
  }
): Promise<WorkflowResult> {
  const orchestrator = createOrchestrator(
    artistName,
    platform,
    options?.language || 'ko',
    {
      stages: options?.stages,
      parallelExecution: options?.parallel ?? true,
    }
  );

  return orchestrator.executeWorkflow(input);
}
