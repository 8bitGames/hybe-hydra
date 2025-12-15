/**
 * Base Agent Abstract Class
 * ==========================
 * Foundation class for all AI agents in the system
 *
 * Provides:
 * - Model client initialization (Gemini/OpenAI)
 * - Input/output validation with Zod schemas
 * - Prompt building with context
 * - Execution metrics tracking
 * - Error handling
 * - Database prompt loading with fallback
 */

import { ZodSchema } from 'zod';
import {
  GeminiClient,
  OpenAIClient,
  type IModelClient,
  type ModelResponse,
} from '../models';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  AgentMetadata,
  TokenUsage,
  ModelName,
  ModelProvider,
  ReflectionConfig,
  ReflectionResult,
  ReflectionIteration,
  ReflectionEvaluation,
  ReflectionAspect,
  StreamChunk,
  StreamResult,
} from './types';
import { loadPromptFromDatabase, type DatabasePrompt } from './prompt-loader';
import { getEvaluationService, type ExecutionLog } from './evaluation-service';
import {
  storeMemory,
  retrieveMemories,
  getMemory,
  deleteMemory,
  buildMemoryContext,
} from './memory-service';
import type { MemoryType, MemoryUpdate, MemoryQuery } from './types';

// Default reflection configuration
const DEFAULT_REFLECTION_CONFIG: ReflectionConfig = {
  maxIterations: 3,
  qualityThreshold: 0.7,
  verbose: false,
  evaluationAspects: ['relevance', 'quality', 'completeness'],
};

// Reflection evaluation prompt template
const REFLECTION_EVALUATION_PROMPT = `You are a critical evaluator. Analyze the following output and provide a detailed evaluation.

## Original Input:
{{input}}

## Agent Output:
{{output}}

## Evaluation Criteria:
Evaluate on these aspects (score 0-1 for each):
{{aspects}}

## Response Format (JSON):
{
  "score": <overall score 0-1>,
  "passed": <boolean - whether output meets quality standards>,
  "feedback": "<specific feedback for improvement>",
  "improvementAreas": ["<area1>", "<area2>"],
  "aspectScores": {
    {{aspectScoresFormat}}
  }
}

Be strict but fair. Focus on actionable improvement suggestions.`;

// Reflection improvement prompt template
const REFLECTION_IMPROVEMENT_PROMPT = `You are improving your previous output based on feedback.

## Original Input:
{{input}}

## Your Previous Output:
{{previousOutput}}

## Evaluation Feedback:
Score: {{score}}/1.0
Feedback: {{feedback}}
Areas to improve: {{improvementAreas}}

## Instructions:
Generate an improved output that addresses the feedback. Maintain the same output format but improve the quality based on the evaluation.

Respond with only the improved output in the required JSON format.`;

// Memory configuration interface
export interface MemoryConfig {
  enabled: boolean;
  /** Memory types to use for this agent */
  memoryTypes?: MemoryType[];
  /** Maximum number of memories to include in context */
  contextLimit?: number;
  /** Minimum importance score to include in context */
  minImportance?: number;
  /** Whether to automatically store learned patterns after execution */
  autoLearn?: boolean;
}

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: false,
  memoryTypes: ['preference', 'pattern', 'style'],
  contextLimit: 10,
  minImportance: 0.3,
  autoLearn: false,
};

// Auto-feedback configuration
export interface AutoFeedbackConfig {
  enabled: boolean;
  /** Target latency in ms for scoring (faster = better score) */
  targetLatencyMs?: number;
  /** Target output tokens for efficiency scoring */
  targetOutputTokens?: number;
}

const DEFAULT_AUTO_FEEDBACK_CONFIG: AutoFeedbackConfig = {
  enabled: true, // Enable by default for all agents
  targetLatencyMs: 5000,
  targetOutputTokens: 2000,
};

export abstract class BaseAgent<TInput, TOutput> {
  protected config: AgentConfig<TInput, TOutput>;
  protected modelClient: IModelClient;
  protected isInitialized: boolean = false;
  protected usingDatabasePrompts: boolean = false;
  protected currentPromptVersion: number = 1;
  protected enableExecutionLogging: boolean = true;
  protected reflectionConfig: ReflectionConfig = DEFAULT_REFLECTION_CONFIG;
  protected memoryConfig: MemoryConfig = DEFAULT_MEMORY_CONFIG;
  protected autoFeedbackConfig: AutoFeedbackConfig = DEFAULT_AUTO_FEEDBACK_CONFIG;

  constructor(config: AgentConfig<TInput, TOutput>) {
    this.config = config;
    this.modelClient = this.initializeClient();
  }

  /**
   * Initialize agent with database prompts (REQUIRED)
   * All prompts must be managed in database. Throws error if not found.
   *
   * To add prompts for a new agent:
   * 1. Use Admin API: POST /api/v1/admin/prompts/seed
   * 2. Or use Supabase MCP: mcp__supabase__execute_sql
   */
  async initializeFromDatabase(): Promise<boolean> {
    if (this.isInitialized) {
      return this.usingDatabasePrompts;
    }

    try {
      const dbPrompt = await loadPromptFromDatabase(this.config.id);

      if (dbPrompt) {
        this.applyDatabasePrompt(dbPrompt);
        this.usingDatabasePrompts = true;
        console.log(`[${this.config.id}] ✓ Loaded prompts from DB (v${dbPrompt.version})`);
      } else {
        // DB에 프롬프트가 없으면 경고하고 fallback 사용
        console.warn(
          `[${this.config.id}] ⚠️ NO DB PROMPT FOUND - using fallback. ` +
          `Run 'POST /api/v1/admin/prompts/seed' to initialize database prompts.`
        );
      }
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to load DB prompts, using fallback:`, error);
    }

    this.isInitialized = true;
    return this.usingDatabasePrompts;
  }

  /**
   * Apply database prompt to config
   */
  private applyDatabasePrompt(dbPrompt: DatabasePrompt): void {
    // Capture version
    this.currentPromptVersion = dbPrompt.version || 1;

    // Merge templates: database templates override hardcoded, but preserve hardcoded as fallback
    const mergedTemplates = {
      ...this.config.prompts.templates, // Hardcoded templates as base
      ...(dbPrompt.templates || {}),    // Database templates override
    };

    // Update prompts
    this.config.prompts = {
      system: dbPrompt.system_prompt,
      templates: mergedTemplates,
    };

    // Update model config if provider/name changed
    if (dbPrompt.model_provider && dbPrompt.model_name) {
      const providerChanged = this.config.model.provider !== dbPrompt.model_provider;
      const nameChanged = this.config.model.name !== dbPrompt.model_name;

      if (providerChanged || nameChanged) {
        this.config.model = {
          provider: dbPrompt.model_provider as ModelProvider,
          name: dbPrompt.model_name as ModelName,
          options: {
            ...this.config.model.options,
            ...dbPrompt.model_options,
          },
        };
        // Reinitialize model client with new config
        this.modelClient = this.initializeClient();
      } else if (Object.keys(dbPrompt.model_options || {}).length > 0) {
        // Just update options without reinitializing
        this.config.model.options = {
          ...this.config.model.options,
          ...dbPrompt.model_options,
        };
      }
    }
  }

  /**
   * Check if using database prompts
   */
  isUsingDatabasePrompts(): boolean {
    return this.usingDatabasePrompts;
  }

  /**
   * Initialize the appropriate model client based on provider
   */
  private initializeClient(): IModelClient {
    const { provider, name, options } = this.config.model;

    if (provider === 'gemini') {
      return new GeminiClient({
        model: name as 'gemini-2.5-flash' | 'gemini-3-pro-preview',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 8192,
        topP: options?.topP,
        topK: options?.topK,
        thinkingLevel: options?.thinkingLevel,
        enableGoogleSearch: options?.tools?.some(t => t.type === 'google_search'),
      });
    } else {
      return new OpenAIClient({
        model: name as 'gpt-5.2-2025-12-11',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 4096,
        reasoningEffort: options?.reasoningEffort ?? 'medium',
      });
    }
  }

  /**
   * Execute the agent with input and context
   * Automatically initializes from database if not already done
   * Includes memory context when memory is enabled
   */
  async execute(
    input: TInput,
    context: AgentContext
  ): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    let executionId: string | null = null;

    // Auto-initialize from database if not already done
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    // Log execution start (non-blocking)
    if (this.enableExecutionLogging) {
      executionId = await this.logExecutionStart(input, context);
    }

    try {
      // 1. Validate input
      const validatedInput = this.validateInput(input);

      // 2. Build prompt with context
      const prompt = this.buildPrompt(validatedInput, context);

      // 3. Load memory context if enabled
      const memoryContext = await this.getMemoryContextForPrompt(context);

      // 4. Build system prompt with memory context
      const systemPrompt = memoryContext
        ? `${this.config.prompts.system}\n\n${memoryContext}`
        : this.config.prompts.system;

      // 5. Execute model
      const response = await this.modelClient.generate({
        system: systemPrompt,
        user: prompt,
        responseFormat: 'json',
      });

      // Log finish reason for debugging truncated responses
      if (response.finishReason && response.finishReason !== 'STOP') {
        console.warn(`[${this.config.id}] ⚠️ Unusual finishReason: ${response.finishReason} (response length: ${response.content.length} chars)`);
      }

      // 6. Parse and validate output
      const parsedOutput = this.parseResponse(response);
      const validatedOutput = this.validateOutput(parsedOutput);

      // 7. Build successful result
      const result = this.buildResult(true, validatedOutput, undefined, response.usage, startTime);

      // 8. Store learned patterns if autoLearn is enabled (non-blocking)
      this.storeLearnedPatterns(validatedInput, validatedOutput, context);

      // Log execution success (non-blocking)
      if (this.enableExecutionLogging && executionId) {
        this.logExecutionComplete(executionId, result, validatedOutput as Record<string, unknown>);
      }

      return result;

    } catch (error) {
      // Handle validation or execution errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.config.id}] Execution error:`, errorMessage);

      const result = this.buildResult(
        false,
        undefined,
        errorMessage,
        { input: 0, output: 0, total: 0 },
        startTime
      );

      // Log execution error (non-blocking)
      if (this.enableExecutionLogging && executionId) {
        this.logExecutionError(executionId, result, errorMessage);
      }

      return result;
    }
  }

  /**
   * Execute with image input (for vision-capable agents)
   * Automatically initializes from database if not already done
   * Includes memory context when memory is enabled
   */
  async executeWithImages(
    input: TInput,
    context: AgentContext,
    images: Array<{ data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'video/mp4' | 'video/mpeg' | 'video/webm' | 'video/quicktime' }>
  ): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();

    // Auto-initialize from database if not already done
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    try {
      const validatedInput = this.validateInput(input);
      const prompt = this.buildPrompt(validatedInput, context);

      // Load memory context if enabled
      const memoryContext = await this.getMemoryContextForPrompt(context);

      // Build system prompt with memory context
      const systemPrompt = memoryContext
        ? `${this.config.prompts.system}\n\n${memoryContext}`
        : this.config.prompts.system;

      const response = await this.modelClient.generate({
        system: systemPrompt,
        user: prompt,
        images,
        responseFormat: 'json',
      });

      const parsedOutput = this.parseResponse(response);
      const validatedOutput = this.validateOutput(parsedOutput);

      // Store learned patterns if autoLearn is enabled (non-blocking)
      this.storeLearnedPatterns(validatedInput, validatedOutput, context);

      return this.buildResult(true, validatedOutput, undefined, response.usage, startTime);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.config.id}] Execution error:`, errorMessage);

      return this.buildResult(
        false,
        undefined,
        errorMessage,
        { input: 0, output: 0, total: 0 },
        startTime
      );
    }
  }

  /**
   * Execute with reflection pattern (self-improvement loop)
   * The agent evaluates its own output and iteratively improves it
   */
  async executeWithReflection(
    input: TInput,
    context: AgentContext,
    reflectionConfig?: Partial<ReflectionConfig>
  ): Promise<ReflectionResult<TOutput>> {
    const config = { ...this.reflectionConfig, ...reflectionConfig };
    const startTime = Date.now();
    const iterations: ReflectionIteration[] = [];
    let totalTokenUsage: TokenUsage = { input: 0, output: 0, total: 0 };

    // Auto-initialize from database if not already done
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    if (config.verbose) {
      console.log(`[${this.config.id}] Starting reflection loop (max ${config.maxIterations} iterations)`);
    }

    // Initial execution
    let currentOutput: TOutput | undefined;
    let currentResult: AgentResult<TOutput>;
    let bestOutput: TOutput | undefined;
    let bestScore = 0;
    let initialScore = 0;

    try {
      // First iteration - normal execution
      const iterationStart = Date.now();
      currentResult = await this.execute(input, context);

      if (!currentResult.success || !currentResult.data) {
        return {
          ...currentResult,
          iterations: [],
          totalIterations: 1,
          improved: false,
          scoreImprovement: 0,
        };
      }

      currentOutput = currentResult.data;
      totalTokenUsage = this.addTokenUsage(totalTokenUsage, currentResult.metadata.tokenUsage);

      // Evaluate the first output
      const firstEvaluation = await this.evaluateOutput(input, currentOutput, config);
      totalTokenUsage = this.addTokenUsage(totalTokenUsage, firstEvaluation.tokenUsage);
      initialScore = firstEvaluation.evaluation.score;
      bestScore = initialScore;
      bestOutput = currentOutput;

      iterations.push({
        iteration: 1,
        output: currentOutput,
        evaluation: firstEvaluation.evaluation,
        tokenUsage: this.addTokenUsage(currentResult.metadata.tokenUsage, firstEvaluation.tokenUsage),
        latencyMs: Date.now() - iterationStart,
      });

      if (config.verbose) {
        console.log(`[${this.config.id}] Iteration 1: score=${firstEvaluation.evaluation.score.toFixed(2)}, passed=${firstEvaluation.evaluation.passed}`);
      }

      // If first output passes threshold, return early
      if (firstEvaluation.evaluation.passed) {
        return this.buildReflectionResult(
          true,
          currentOutput,
          undefined,
          totalTokenUsage,
          startTime,
          iterations,
          false,
          0
        );
      }

      // Reflection loop
      for (let i = 2; i <= config.maxIterations; i++) {
        const loopStart = Date.now();
        const previousEvaluation = iterations[iterations.length - 1].evaluation;

        // Generate improved output
        const improvedResult = await this.generateImprovedOutput(
          input,
          currentOutput,
          previousEvaluation,
          context
        );

        if (!improvedResult.success || !improvedResult.output) {
          if (config.verbose) {
            console.log(`[${this.config.id}] Iteration ${i}: improvement failed, using best output`);
          }
          break;
        }

        currentOutput = improvedResult.output;
        totalTokenUsage = this.addTokenUsage(totalTokenUsage, improvedResult.tokenUsage);

        // Evaluate improved output
        const evaluation = await this.evaluateOutput(input, currentOutput, config);
        totalTokenUsage = this.addTokenUsage(totalTokenUsage, evaluation.tokenUsage);

        iterations.push({
          iteration: i,
          output: currentOutput,
          evaluation: evaluation.evaluation,
          tokenUsage: this.addTokenUsage(improvedResult.tokenUsage, evaluation.tokenUsage),
          latencyMs: Date.now() - loopStart,
        });

        if (config.verbose) {
          console.log(`[${this.config.id}] Iteration ${i}: score=${evaluation.evaluation.score.toFixed(2)}, passed=${evaluation.evaluation.passed}`);
        }

        // Track best output
        if (evaluation.evaluation.score > bestScore) {
          bestScore = evaluation.evaluation.score;
          bestOutput = currentOutput;
        }

        // If passes threshold, exit loop
        if (evaluation.evaluation.passed) {
          break;
        }
      }

      const scoreImprovement = bestScore - initialScore;
      const improved = scoreImprovement > 0;

      if (config.verbose) {
        console.log(`[${this.config.id}] Reflection complete: ${iterations.length} iterations, improved=${improved}, scoreChange=${scoreImprovement.toFixed(2)}`);
      }

      return this.buildReflectionResult(
        true,
        bestOutput!,
        undefined,
        totalTokenUsage,
        startTime,
        iterations,
        improved,
        scoreImprovement
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.config.id}] Reflection error:`, errorMessage);

      return this.buildReflectionResult(
        false,
        bestOutput,
        errorMessage,
        totalTokenUsage,
        startTime,
        iterations,
        false,
        0
      );
    }
  }

  /**
   * Execute with streaming output
   * Returns an async generator that yields chunks
   */
  async *executeStream(
    input: TInput,
    context: AgentContext
  ): AsyncGenerator<StreamChunk, StreamResult<TOutput>, undefined> {
    const startTime = Date.now();

    // Auto-initialize from database if not already done
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    try {
      // Validate input
      const validatedInput = this.validateInput(input);
      const prompt = this.buildPrompt(validatedInput, context);

      // Check if model client supports streaming
      if (!this.modelClient.generateStream) {
        // Fallback to non-streaming
        const result = await this.execute(input, context);
        yield {
          content: JSON.stringify(result.data),
          done: true,
          accumulated: JSON.stringify(result.data),
        };
        return {
          data: result.data,
          success: result.success,
          error: result.error,
          tokenUsage: result.metadata.tokenUsage,
          latencyMs: result.metadata.latencyMs,
        };
      }

      // Stream the response
      let accumulated = '';
      const stream = this.modelClient.generateStream({
        system: this.config.prompts.system,
        user: prompt,
        responseFormat: 'json',
      });

      for await (const chunk of stream) {
        accumulated += chunk.content;
        yield {
          content: chunk.content,
          done: chunk.done,
          accumulated,
        };
      }

      // Parse final output
      const parsedOutput = this.parseResponse({ content: accumulated, usage: { input: 0, output: 0, total: 0 } });
      const validatedOutput = this.validateOutput(parsedOutput);

      return {
        data: validatedOutput,
        success: true,
        tokenUsage: { input: 0, output: 0, total: 0 }, // Token usage not available in streaming
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.config.id}] Stream error:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        tokenUsage: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Set reflection configuration
   */
  setReflectionConfig(config: Partial<ReflectionConfig>): void {
    this.reflectionConfig = { ...this.reflectionConfig, ...config };
  }

  // ============================================================================
  // Memory System Methods
  // ============================================================================

  /**
   * Configure memory settings for this agent
   */
  setMemoryConfig(config: Partial<MemoryConfig>): void {
    this.memoryConfig = { ...this.memoryConfig, ...config };
  }

  /**
   * Enable or disable memory for this agent
   */
  enableMemory(enabled: boolean = true): void {
    this.memoryConfig.enabled = enabled;
  }

  /**
   * Store a memory for this agent
   * @param key - Unique key for the memory
   * @param value - Data to store
   * @param options - Additional options like memory type, importance, TTL
   */
  async remember(
    key: string,
    value: Record<string, unknown>,
    options?: {
      memoryType?: MemoryType;
      importance?: number;
      ttlSeconds?: number;
      campaignId?: string;
      artistName?: string;
    }
  ): Promise<string | null> {
    const memory: MemoryUpdate = {
      key,
      value,
      memoryType: options?.memoryType || 'pattern',
      importance: options?.importance,
      ttlSeconds: options?.ttlSeconds,
    };

    return storeMemory(this.config.id, memory, {
      campaignId: options?.campaignId,
      artistName: options?.artistName,
    });
  }

  /**
   * Retrieve memories for this agent
   * @param query - Query parameters for filtering memories
   */
  async recall(query?: {
    campaignId?: string;
    artistName?: string;
    memoryTypes?: MemoryType[];
    keys?: string[];
    minImportance?: number;
    limit?: number;
  }): Promise<Array<{
    key: string;
    value: Record<string, unknown>;
    memoryType: MemoryType;
    importance: number;
  }>> {
    const memories = await retrieveMemories({
      agentId: this.config.id,
      campaignId: query?.campaignId,
      artistName: query?.artistName,
      memoryTypes: query?.memoryTypes,
      keys: query?.keys,
      minImportance: query?.minImportance,
      limit: query?.limit,
    });

    return memories.map((m) => ({
      key: m.key,
      value: m.value,
      memoryType: m.memoryType,
      importance: m.importance,
    }));
  }

  /**
   * Get a specific memory by key
   */
  async recallOne(
    key: string,
    campaignId?: string
  ): Promise<Record<string, unknown> | null> {
    const memory = await getMemory(this.config.id, key, campaignId);
    return memory?.value || null;
  }

  /**
   * Delete a memory
   */
  async forget(key: string, campaignId?: string): Promise<boolean> {
    return deleteMemory(this.config.id, key, campaignId);
  }

  /**
   * Build memory context string for inclusion in prompts
   * Used internally during execute() when memory is enabled
   */
  protected async getMemoryContextForPrompt(
    context: AgentContext
  ): Promise<string> {
    if (!this.memoryConfig.enabled) {
      return '';
    }

    try {
      const memoryContext = await buildMemoryContext(this.config.id, {
        campaignId: context.workflow?.campaignId,
        artistName: context.workflow?.artistName,
        memoryTypes: this.memoryConfig.memoryTypes,
        limit: this.memoryConfig.contextLimit,
      });

      return memoryContext;
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to load memory context:`, error);
      return '';
    }
  }

  /**
   * Store learned patterns from successful execution
   * Called automatically when autoLearn is enabled
   */
  protected async storeLearnedPatterns(
    input: TInput,
    output: TOutput,
    context: AgentContext
  ): Promise<void> {
    if (!this.memoryConfig.enabled || !this.memoryConfig.autoLearn) {
      return;
    }

    try {
      // Store execution pattern (can be overridden by subclasses for custom learning)
      const patternKey = `execution_pattern_${Date.now()}`;
      await this.remember(
        patternKey,
        {
          inputType: typeof input,
          outputSummary: this.summarizeOutput(output),
          timestamp: new Date().toISOString(),
        },
        {
          memoryType: 'pattern',
          importance: 0.5,
          ttlSeconds: 7 * 24 * 60 * 60, // 7 days
          campaignId: context.workflow?.campaignId,
          artistName: context.workflow?.artistName,
        }
      );
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to store learned patterns:`, error);
    }
  }

  /**
   * Summarize output for learning purposes
   * Subclasses can override for custom summarization
   */
  protected summarizeOutput(output: TOutput): string {
    if (typeof output === 'string') {
      return output.slice(0, 200);
    }
    return JSON.stringify(output).slice(0, 200);
  }

  /**
   * Evaluate output quality using LLM self-critique
   */
  private async evaluateOutput(
    input: TInput,
    output: TOutput,
    config: ReflectionConfig
  ): Promise<{ evaluation: ReflectionEvaluation; tokenUsage: TokenUsage }> {
    const aspects = config.evaluationAspects || DEFAULT_REFLECTION_CONFIG.evaluationAspects!;
    const aspectsDescription = aspects.map(a => `- ${a}: <description>`).join('\n');
    const aspectScoresFormat = aspects.map(a => `"${a}": <score 0-1>`).join(',\n    ');

    const evaluationPrompt = REFLECTION_EVALUATION_PROMPT
      .replace('{{input}}', JSON.stringify(input, null, 2))
      .replace('{{output}}', JSON.stringify(output, null, 2))
      .replace('{{aspects}}', aspectsDescription)
      .replace('{{aspectScoresFormat}}', aspectScoresFormat);

    try {
      const response = await this.modelClient.generate({
        system: 'You are a critical evaluator that provides objective quality assessments. Always respond in valid JSON.',
        user: evaluationPrompt,
        responseFormat: 'json',
      });

      const parsed = this.parseResponse(response);
      const evaluation = parsed as ReflectionEvaluation;

      // Ensure passed field reflects the threshold
      evaluation.passed = evaluation.score >= config.qualityThreshold;

      return {
        evaluation,
        tokenUsage: response.usage,
      };
    } catch (error) {
      console.warn(`[${this.config.id}] Evaluation failed, using default scores`);
      const defaultScores: Record<ReflectionAspect, number> = {} as Record<ReflectionAspect, number>;
      aspects.forEach(a => { defaultScores[a] = 0.5; });

      return {
        evaluation: {
          score: 0.5,
          passed: false,
          feedback: 'Evaluation failed, using default assessment',
          improvementAreas: ['Unable to evaluate'],
          aspectScores: defaultScores,
        },
        tokenUsage: { input: 0, output: 0, total: 0 },
      };
    }
  }

  /**
   * Generate improved output based on feedback
   */
  private async generateImprovedOutput(
    input: TInput,
    previousOutput: TOutput,
    evaluation: ReflectionEvaluation,
    context: AgentContext
  ): Promise<{ success: boolean; output?: TOutput; tokenUsage: TokenUsage }> {
    const improvementPrompt = REFLECTION_IMPROVEMENT_PROMPT
      .replace('{{input}}', JSON.stringify(input, null, 2))
      .replace('{{previousOutput}}', JSON.stringify(previousOutput, null, 2))
      .replace('{{score}}', evaluation.score.toFixed(2))
      .replace('{{feedback}}', evaluation.feedback)
      .replace('{{improvementAreas}}', evaluation.improvementAreas.join(', '));

    try {
      const response = await this.modelClient.generate({
        system: this.config.prompts.system,
        user: improvementPrompt,
        responseFormat: 'json',
      });

      const parsed = this.parseResponse(response);
      const validated = this.validateOutput(parsed);

      return {
        success: true,
        output: validated,
        tokenUsage: response.usage,
      };
    } catch (error) {
      console.warn(`[${this.config.id}] Improvement generation failed`);
      return {
        success: false,
        tokenUsage: { input: 0, output: 0, total: 0 },
      };
    }
  }

  /**
   * Build reflection result
   */
  private buildReflectionResult(
    success: boolean,
    data: TOutput | undefined,
    error: string | undefined,
    usage: TokenUsage,
    startTime: number,
    iterations: ReflectionIteration[],
    improved: boolean,
    scoreImprovement: number
  ): ReflectionResult<TOutput> {
    const metadata: AgentMetadata = {
      agentId: this.config.id,
      model: this.config.model.name as ModelName,
      tokenUsage: usage,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    return {
      success,
      data,
      error,
      metadata,
      iterations,
      totalIterations: iterations.length,
      improved,
      scoreImprovement,
    };
  }

  /**
   * Add two token usages together
   */
  private addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
    return {
      input: a.input + b.input,
      output: a.output + b.output,
      total: a.total + b.total,
    };
  }

  /**
   * Validate input against schema
   */
  private validateInput(input: TInput): TInput {
    const result = this.config.inputSchema.safeParse(input);
    if (!result.success) {
      throw new Error(`Input validation failed: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Validate output against schema
   */
  private validateOutput(output: unknown): TOutput {
    const result = this.config.outputSchema.safeParse(output);
    if (!result.success) {
      throw new Error(`Output validation failed: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Build the result object
   */
  private buildResult(
    success: boolean,
    data: TOutput | undefined,
    error: string | undefined,
    usage: TokenUsage,
    startTime: number
  ): AgentResult<TOutput> {
    const metadata: AgentMetadata = {
      agentId: this.config.id,
      model: this.config.model.name as ModelName,
      tokenUsage: usage,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    return {
      success,
      data,
      error,
      metadata,
    };
  }

  /**
   * Build prompt from template with input and context
   * Subclasses must implement this to customize prompt building
   */
  protected abstract buildPrompt(input: TInput, context: AgentContext): string;

  /**
   * Parse model response into output type
   * Default implementation parses JSON, subclasses can override
   * Handles markdown code blocks that may wrap JSON when tools are enabled
   */
  protected parseResponse(response: ModelResponse): unknown {
    let content = response.content.trim();

    // Log raw response for debugging (first 500 chars)
    const previewLength = Math.min(content.length, 500);
    console.log(`[${this.config.id}] Raw AI response (${content.length} chars): ${content.substring(0, previewLength)}${content.length > previewLength ? '...' : ''}`);

    // Helper function to attempt JSON parse with detailed error logging
    const tryParseJSON = (jsonStr: string, source: string): unknown | null => {
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        if (e instanceof SyntaxError) {
          // Find the position of the error
          const match = e.message.match(/position (\d+)/);
          if (match) {
            const pos = parseInt(match[1], 10);
            const start = Math.max(0, pos - 50);
            const end = Math.min(jsonStr.length, pos + 50);
            const context = jsonStr.substring(start, end);
            const pointer = ' '.repeat(Math.min(50, pos - start)) + '^';
            console.error(`[${this.config.id}] ${source} JSON parse error at position ${pos}:`);
            console.error(`Context: ...${context}...`);
            console.error(`         ${pointer}`);
          } else {
            console.error(`[${this.config.id}] ${source} JSON parse error: ${e.message}`);
          }
        } else {
          console.error(`[${this.config.id}] ${source} parse error: ${e instanceof Error ? e.message : 'unknown'}`);
        }
        return null;
      }
    };

    // Helper to try parsing with optional balancing
    const tryParseWithBalance = (jsonStr: string, source: string): unknown | null => {
      // Try direct first
      const direct = tryParseJSON(jsonStr, source);
      if (direct !== null) return direct;

      // Try with balancing
      const balanced = this.balanceJSON(jsonStr);
      if (balanced !== jsonStr) {
        const balancedResult = tryParseJSON(balanced, `${source} (balanced)`);
        if (balancedResult !== null) return balancedResult;
      }

      return null;
    };

    // Step 1: Strip markdown code fences FIRST if present
    // This handles: ```json ... ```, ``` ... ```, ```javascript ... ```
    const codeBlockMatch = content.match(/^```(?:\w*)?\s*\n?([\s\S]*?)\n?```\s*$/);
    if (codeBlockMatch) {
      content = codeBlockMatch[1].trim();
      console.log(`[${this.config.id}] Stripped markdown code fence`);
    }

    // Step 2: Try direct JSON parse
    const directResult = tryParseWithBalance(content, 'Direct');
    if (directResult !== null) return directResult;

    // Step 3: Try to extract JSON from markdown code blocks embedded in text
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      const extracted = jsonBlockMatch[1].trim();
      const blockResult = tryParseWithBalance(extracted, 'Code block');
      if (blockResult !== null) return blockResult;
    }

    // Step 4: Try to find JSON object using balanced extraction
    const jsonObjectExtracted = this.extractBalancedJSON(content, '{', '}');
    if (jsonObjectExtracted) {
      const objectResult = tryParseWithBalance(jsonObjectExtracted, 'Extracted object');
      if (objectResult !== null) return objectResult;
    }

    // Step 5: Try to find JSON array using balanced extraction
    const jsonArrayExtracted = this.extractBalancedJSON(content, '[', ']');
    if (jsonArrayExtracted) {
      const arrayResult = tryParseWithBalance(jsonArrayExtracted, 'Extracted array');
      if (arrayResult !== null) return arrayResult;
    }

    // Step 6: Try full repair pipeline
    console.log(`[${this.config.id}] Attempting full JSON repair...`);
    const repairedContent = this.repairJSON(content);
    if (repairedContent !== content) {
      const repairedResult = tryParseJSON(repairedContent, 'Repaired');
      if (repairedResult !== null) return repairedResult;
    }

    // If all JSON parsing fails, throw an error with details
    // Don't return raw string as it will cause Zod validation to fail with confusing error
    console.error(`[${this.config.id}] All JSON parsing attempts failed. Full response (last 500 chars):\n${content.slice(-500)}`);
    throw new Error(`Failed to parse AI response as JSON. Response starts with: "${content.substring(0, 100)}..."`);
  }

  /**
   * Extract balanced JSON from content using proper brace/bracket matching
   * This is more accurate than greedy regex matching
   */
  private extractBalancedJSON(content: string, openChar: '{' | '[', closeChar: '}' | ']'): string | null {
    const startIndex = content.indexOf(openChar);
    if (startIndex === -1) return null;

    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let endIndex = -1;

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === openChar) {
          depth++;
        } else if (char === closeChar) {
          depth--;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
      }
    }

    if (endIndex === -1) {
      // JSON is truncated or malformed - return from start to end for repair
      return content.substring(startIndex);
    }

    return content.substring(startIndex, endIndex + 1);
  }

  /**
   * Attempt to repair common JSON formatting issues
   */
  private repairJSON(content: string): string {
    let repaired = content;

    // Remove any text before the first { or [
    const firstBrace = repaired.indexOf('{');
    const firstBracket = repaired.indexOf('[');
    const firstJson = Math.min(
      firstBrace >= 0 ? firstBrace : Infinity,
      firstBracket >= 0 ? firstBracket : Infinity
    );
    if (firstJson > 0 && firstJson !== Infinity) {
      repaired = repaired.substring(firstJson);
    }

    // Remove any text after the last } or ]
    const lastBrace = repaired.lastIndexOf('}');
    const lastBracket = repaired.lastIndexOf(']');
    const lastJson = Math.max(lastBrace, lastBracket);
    if (lastJson >= 0 && lastJson < repaired.length - 1) {
      repaired = repaired.substring(0, lastJson + 1);
    }

    // Fix trailing commas before } or ]
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // Fix missing commas between array elements (common AI error)
    repaired = repaired.replace(/\}(\s*)\{/g, '},$1{');

    // Fix missing commas between array elements with strings
    repaired = repaired.replace(/\](\s*)\[/g, '],$1[');

    // Fix missing commas after string values
    repaired = repaired.replace(/"(\s*)\n(\s*)"/g, '",\n$2"');

    // Balance JSON braces/brackets (handles both excess and missing)
    repaired = this.balanceJSON(repaired);

    return repaired;
  }

  /**
   * Balance JSON by closing unclosed braces/brackets or removing excess ones
   */
  private balanceJSON(content: string): string {
    let result = content;

    // Count open braces/brackets while tracking positions
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    // Track positions of closing braces/brackets for removal if excess
    const closingBracePositions: number[] = [];
    const closingBracketPositions: number[] = [];

    for (let i = 0; i < result.length; i++) {
      const char = result[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
          closingBracePositions.length = 0; // Reset - only track consecutive closings at the end
        } else if (char === '}') {
          braceCount--;
          closingBracePositions.push(i);
        } else if (char === '[') {
          bracketCount++;
          closingBracketPositions.length = 0;
        } else if (char === ']') {
          bracketCount--;
          closingBracketPositions.push(i);
        }
      }
    }

    // If we're still inside a string (unclosed quote), try to close it
    if (inString) {
      // Find the last unclosed string and truncate content there, adding closing quote
      const lastQuote = result.lastIndexOf('"');
      if (lastQuote >= 0) {
        // Check if this is likely a truncated string value
        const afterQuote = result.substring(lastQuote + 1);
        if (!afterQuote.includes('"')) {
          // Truncate and close the string
          result = result.substring(0, lastQuote + 1) + '"';
          console.log(`[balanceJSON] Closed truncated string at position ${lastQuote}`);
          // Re-run balance after closing string
          return this.balanceJSON(result);
        }
      }
    }

    // Handle EXCESS closing braces/brackets (negative count means excess)
    if (braceCount < 0 || bracketCount < 0) {
      console.log(`[balanceJSON] Removing excess: ${Math.abs(braceCount)} braces, ${Math.abs(bracketCount)} brackets`);

      // Build list of positions to remove (from the end)
      const positionsToRemove = new Set<number>();

      // Remove excess closing braces from the end
      let bracesToRemove = Math.abs(Math.min(0, braceCount));
      for (let i = closingBracePositions.length - 1; i >= 0 && bracesToRemove > 0; i--) {
        positionsToRemove.add(closingBracePositions[i]);
        bracesToRemove--;
      }

      // Remove excess closing brackets from the end
      let bracketsToRemove = Math.abs(Math.min(0, bracketCount));
      for (let i = closingBracketPositions.length - 1; i >= 0 && bracketsToRemove > 0; i--) {
        positionsToRemove.add(closingBracketPositions[i]);
        bracketsToRemove--;
      }

      // Rebuild string without excess characters
      if (positionsToRemove.size > 0) {
        result = result
          .split('')
          .filter((_, i) => !positionsToRemove.has(i))
          .join('');
      }

      // Recalculate counts after removal
      braceCount = 0;
      bracketCount = 0;
      inString = false;
      escapeNext = false;

      for (const char of result) {
        if (escapeNext) { escapeNext = false; continue; }
        if (char === '\\') { escapeNext = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          else if (char === '[') bracketCount++;
          else if (char === ']') bracketCount--;
        }
      }
    }

    // Handle UNCLOSED braces/brackets (positive count means unclosed)
    if (bracketCount > 0 || braceCount > 0) {
      console.log(`[balanceJSON] Closing ${bracketCount} brackets and ${braceCount} braces`);

      // Remove trailing comma if present (would be invalid before closing)
      result = result.replace(/,\s*$/, '');

      // Close arrays first, then objects
      for (let i = 0; i < bracketCount; i++) {
        result += ']';
      }
      for (let i = 0; i < braceCount; i++) {
        result += '}';
      }
    }

    return result;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig<TInput, TOutput> {
    return this.config;
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * Get agent dependencies
   */
  getDependencies(): string[] {
    return this.config.dependencies || [];
  }

  /**
   * Check if this agent depends on another
   */
  dependsOn(agentId: string): boolean {
    return this.config.dependencies?.includes(agentId) ?? false;
  }

  /**
   * Enable or disable execution logging
   */
  setExecutionLogging(enabled: boolean): void {
    this.enableExecutionLogging = enabled;
  }

  /**
   * Log execution start
   */
  private async logExecutionStart(
    input: TInput,
    context: AgentContext
  ): Promise<string | null> {
    try {
      const evaluationService = getEvaluationService();
      return await evaluationService.logExecution({
        agent_id: this.config.id,
        session_id: context.workflow?.sessionId,
        campaign_id: context.workflow?.campaignId,
        input: input as Record<string, unknown>,
        status: 'running',
        prompt_version: this.currentPromptVersion,
      });
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to log execution start:`, error);
      return null;
    }
  }

  /**
   * Log execution complete
   */
  private async logExecutionComplete(
    executionId: string,
    result: AgentResult<TOutput>,
    output: Record<string, unknown>
  ): Promise<void> {
    try {
      const evaluationService = getEvaluationService();
      await evaluationService.updateExecution(executionId, {
        output,
        latency_ms: result.metadata.latencyMs,
        input_tokens: result.metadata.tokenUsage.input,
        output_tokens: result.metadata.tokenUsage.output,
        total_tokens: result.metadata.tokenUsage.total,
        status: 'success',
      });

      // Store auto-feedback for successful execution
      if (this.autoFeedbackConfig.enabled) {
        await this.storeAutoFeedback(executionId, result, true);
      }
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to log execution complete:`, error);
    }
  }

  /**
   * Log execution error
   */
  private async logExecutionError(
    executionId: string,
    result: AgentResult<TOutput>,
    errorMessage: string
  ): Promise<void> {
    try {
      const evaluationService = getEvaluationService();
      await evaluationService.updateExecution(executionId, {
        latency_ms: result.metadata.latencyMs,
        status: 'error',
        error_message: errorMessage,
      });

      // Store auto-feedback for errors (low score)
      if (this.autoFeedbackConfig.enabled) {
        await this.storeAutoFeedback(executionId, result, false);
      }
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to log execution error:`, error);
    }
  }

  /**
   * Store auto-generated feedback based on execution metrics
   * Uses a simple scoring algorithm (not AI-based) for efficiency
   */
  private async storeAutoFeedback(
    executionId: string,
    result: AgentResult<TOutput>,
    success: boolean
  ): Promise<void> {
    if (!this.autoFeedbackConfig.enabled) return;

    try {
      const evaluationService = getEvaluationService();
      const { latencyMs, tokenUsage } = result.metadata;
      const targetLatency = this.autoFeedbackConfig.targetLatencyMs || 5000;
      const targetTokens = this.autoFeedbackConfig.targetOutputTokens || 2000;

      // Calculate scores (1-5 scale)
      let overallScore: number;
      let relevanceScore: number;
      let qualityScore: number;
      let creativityScore: number;

      if (!success) {
        // Error case: low scores
        overallScore = 1;
        relevanceScore = 1;
        qualityScore = 1;
        creativityScore = 2;
      } else {
        // Success case: calculate based on metrics

        // Latency score: 5 if under target, decreases linearly
        const latencyRatio = latencyMs / targetLatency;
        const latencyScore = Math.max(1, Math.min(5, 6 - latencyRatio * 2));

        // Token efficiency score: penalize excessive token usage
        const tokenRatio = tokenUsage.output / targetTokens;
        const tokenScore = Math.max(1, Math.min(5, 6 - tokenRatio));

        // Base quality score for successful execution
        qualityScore = Math.round(4 + (latencyScore - 3) * 0.3);
        relevanceScore = 4; // Assume relevant if successful
        creativityScore = 3; // Neutral creativity score

        // Overall score: weighted average
        overallScore = Math.round(
          qualityScore * 0.4 +
          relevanceScore * 0.3 +
          tokenScore * 0.2 +
          latencyScore * 0.1
        );

        // Clamp all scores to 1-5
        overallScore = Math.max(1, Math.min(5, overallScore));
        qualityScore = Math.max(1, Math.min(5, qualityScore));
        relevanceScore = Math.max(1, Math.min(5, relevanceScore));
        creativityScore = Math.max(1, Math.min(5, creativityScore));
      }

      // Store the feedback
      await evaluationService.saveFeedback(
        executionId,
        this.config.id,
        {
          overall_score: overallScore,
          relevance_score: relevanceScore,
          quality_score: qualityScore,
          creativity_score: creativityScore,
          feedback_text: success
            ? `Auto-evaluated: ${latencyMs}ms latency, ${tokenUsage.total} tokens`
            : 'Auto-evaluated: Execution failed',
          strengths: [],
          weaknesses: [],
          suggestions: [],
        },
        'automated'
      );
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to store auto-feedback:`, error);
    }
  }

  /**
   * Configure auto-feedback settings
   */
  setAutoFeedbackConfig(config: Partial<AutoFeedbackConfig>): void {
    this.autoFeedbackConfig = { ...this.autoFeedbackConfig, ...config };
  }

  /**
   * Enable or disable auto-feedback
   */
  enableAutoFeedback(enabled: boolean = true): void {
    this.autoFeedbackConfig.enabled = enabled;
  }

  /**
   * Get prompt template by name
   */
  protected getTemplate(name: string): string {
    const template = this.config.prompts.templates[name];
    if (!template) {
      throw new Error(`Template '${name}' not found for agent ${this.config.id}`);
    }
    return template;
  }

  /**
   * Replace placeholders in template with values
   */
  protected fillTemplate(template: string, values: Record<string, unknown>): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      const placeholder = `{{${key}}}`;
      const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      result = result.split(placeholder).join(stringValue);
    }
    return result;
  }
}

/**
 * Helper function to create agent metadata
 */
export function createAgentMetadata(
  agentId: string,
  model: ModelName,
  usage: TokenUsage,
  latencyMs: number
): AgentMetadata {
  return {
    agentId,
    model,
    tokenUsage: usage,
    latencyMs,
    timestamp: new Date().toISOString(),
  };
}
