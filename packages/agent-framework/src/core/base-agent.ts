/**
 * Base Agent Abstract Class
 * ==========================
 * Foundation class for all AI agents in the framework.
 *
 * Provides:
 * - Model client abstraction (pluggable providers)
 * - Input/output validation with Zod schemas
 * - Prompt building with context
 * - Execution metrics tracking
 * - Error handling
 * - Reflection pattern for self-improvement
 * - Streaming support
 *
 * Extension points:
 * - Override createModelClient() to provide custom model clients
 * - Override loadPromptFromStorage() for custom prompt storage
 * - Override storeLearnedPatterns() for custom learning behavior
 */

import type {
  AgentConfig,
  BaseAgentContext,
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
  DatabasePrompt,
  MemoryType,
} from '../types';
import type {
  IModelClient,
  GenerateOptions,
  ModelResponse,
} from '../models/types';

// ================================
// Configuration Interfaces
// ================================

/**
 * Memory configuration for agent
 */
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

/**
 * Auto-feedback configuration
 */
export interface AutoFeedbackConfig {
  enabled: boolean;
  /** Target latency in ms for scoring (faster = better score) */
  targetLatencyMs?: number;
  /** Target output tokens for efficiency scoring */
  targetOutputTokens?: number;
}

// ================================
// Default Configurations
// ================================

const DEFAULT_REFLECTION_CONFIG: ReflectionConfig = {
  maxIterations: 3,
  qualityThreshold: 0.7,
  verbose: false,
  evaluationAspects: ['relevance', 'quality', 'completeness'],
};

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: false,
  memoryTypes: ['preference', 'pattern', 'style'],
  contextLimit: 10,
  minImportance: 0.3,
  autoLearn: false,
};

const DEFAULT_AUTO_FEEDBACK_CONFIG: AutoFeedbackConfig = {
  enabled: false,
  targetLatencyMs: 5000,
  targetOutputTokens: 2000,
};

// ================================
// Reflection Prompt Templates
// ================================

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

// ================================
// Base Agent Class
// ================================

/**
 * Abstract base class for all agents
 * @template TInput - Input type for the agent
 * @template TOutput - Output type for the agent
 * @template TContext - Context type (extends BaseAgentContext)
 */
export abstract class BaseAgent<
  TInput,
  TOutput,
  TContext extends BaseAgentContext = BaseAgentContext
> {
  protected config: AgentConfig<TInput, TOutput>;
  protected modelClient: IModelClient | null = null;
  protected isInitialized: boolean = false;
  protected usingStoragePrompts: boolean = false;
  protected currentPromptVersion: number = 1;
  protected reflectionConfig: ReflectionConfig = DEFAULT_REFLECTION_CONFIG;
  protected memoryConfig: MemoryConfig = DEFAULT_MEMORY_CONFIG;
  protected autoFeedbackConfig: AutoFeedbackConfig = DEFAULT_AUTO_FEEDBACK_CONFIG;

  constructor(config: AgentConfig<TInput, TOutput>) {
    this.config = config;
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================

  /**
   * Build prompt from template with input and context
   * Subclasses must implement this to customize prompt building
   */
  protected abstract buildPrompt(input: TInput, context: TContext): string;

  /**
   * Create a model client for the configured provider
   * Override this to provide custom model client implementations
   */
  protected abstract createModelClient(): IModelClient;

  // ============================================================================
  // Optional Override Methods
  // ============================================================================

  /**
   * Load prompt from external storage (database, file, etc.)
   * Override this to implement custom prompt loading
   * @returns DatabasePrompt if found, null otherwise
   */
  protected async loadPromptFromStorage(): Promise<DatabasePrompt | null> {
    // Default: no external storage, use config prompts
    return null;
  }

  /**
   * Store learned patterns from successful execution
   * Override this to implement custom learning behavior
   */
  protected async storeLearnedPatterns(
    _input: TInput,
    _output: TOutput,
    _context: TContext
  ): Promise<void> {
    // Default: no-op
  }

  /**
   * Build memory context string for inclusion in prompts
   * Override this to implement memory retrieval
   */
  protected async getMemoryContextForPrompt(
    _context: TContext
  ): Promise<string> {
    // Default: no memory context
    return '';
  }

  /**
   * Log execution start (for monitoring/analytics)
   * Override to implement custom logging
   */
  protected async logExecutionStart(
    _input: TInput,
    _context: TContext
  ): Promise<string | null> {
    return null;
  }

  /**
   * Log execution complete
   * Override to implement custom logging
   */
  protected async logExecutionComplete(
    _executionId: string,
    _result: AgentResult<TOutput>,
    _output: Record<string, unknown>
  ): Promise<void> {
    // Default: no-op
  }

  /**
   * Log execution error
   * Override to implement custom logging
   */
  protected async logExecutionError(
    _executionId: string,
    _result: AgentResult<TOutput>,
    _errorMessage: string
  ): Promise<void> {
    // Default: no-op
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize agent from external storage (database, etc.)
   * Call this before execute() for production use
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return this.usingStoragePrompts;
    }

    // Initialize model client
    this.modelClient = this.createModelClient();

    try {
      const storedPrompt = await this.loadPromptFromStorage();

      if (storedPrompt) {
        this.applyStoredPrompt(storedPrompt);
        this.usingStoragePrompts = true;
        console.log(`[${this.config.id}] ✓ Loaded prompts from storage (v${storedPrompt.version})`);
      }
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to load stored prompts, using fallback:`, error);
    }

    this.isInitialized = true;
    return this.usingStoragePrompts;
  }

  /**
   * Apply stored prompt to config
   */
  private applyStoredPrompt(storedPrompt: DatabasePrompt): void {
    this.currentPromptVersion = storedPrompt.version || 1;

    // Merge templates: stored templates override config, but preserve config as fallback
    const mergedTemplates = {
      ...this.config.prompts.templates,
      ...(storedPrompt.templates || {}),
    };

    // Update prompts
    this.config.prompts = {
      system: storedPrompt.system_prompt,
      templates: mergedTemplates,
    };

    // Update model config if provider/name changed
    if (storedPrompt.model_provider && storedPrompt.model_name) {
      const providerChanged = this.config.model.provider !== storedPrompt.model_provider;
      const nameChanged = this.config.model.name !== storedPrompt.model_name;

      if (providerChanged || nameChanged) {
        this.config.model = {
          provider: storedPrompt.model_provider as ModelProvider,
          name: storedPrompt.model_name as ModelName,
          options: {
            ...this.config.model.options,
            ...storedPrompt.model_options,
          },
        };
        // Reinitialize model client with new config
        this.modelClient = this.createModelClient();
      } else if (Object.keys(storedPrompt.model_options || {}).length > 0) {
        // Just update options
        this.config.model.options = {
          ...this.config.model.options,
          ...storedPrompt.model_options,
        };
      }
    }
  }

  /**
   * Ensure agent is initialized before execution
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!this.modelClient) {
      throw new Error(`Model client not initialized for agent ${this.config.id}`);
    }
  }

  // ============================================================================
  // Execution Methods
  // ============================================================================

  /**
   * Execute the agent with input and context
   */
  async execute(
    input: TInput,
    context: TContext
  ): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    let executionId: string | null = null;

    await this.ensureInitialized();

    // Log execution start
    executionId = await this.logExecutionStart(input, context);

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
      const response = await this.modelClient!.generate({
        system: systemPrompt,
        user: prompt,
        responseFormat: 'json',
      });

      // 6. Parse and validate output
      const parsedOutput = this.parseResponse(response);
      const validatedOutput = this.validateOutput(parsedOutput);

      // 7. Build successful result
      const result = this.buildResult(true, validatedOutput, undefined, response.usage, startTime);

      // 8. Store learned patterns (non-blocking)
      this.storeLearnedPatterns(validatedInput, validatedOutput, context);

      // Log execution success
      if (executionId) {
        this.logExecutionComplete(executionId, result, validatedOutput as Record<string, unknown>);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.config.id}] Execution error:`, errorMessage);

      const result = this.buildResult(
        false,
        undefined,
        errorMessage,
        { input: 0, output: 0, total: 0 },
        startTime
      );

      if (executionId) {
        this.logExecutionError(executionId, result, errorMessage);
      }

      return result;
    }
  }

  /**
   * Execute with media input (for multimodal agents)
   */
  async executeWithMedia(
    input: TInput,
    context: TContext,
    media: Array<{ data: string; mimeType: string }>
  ): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();

    await this.ensureInitialized();

    try {
      const validatedInput = this.validateInput(input);
      const prompt = this.buildPrompt(validatedInput, context);
      const memoryContext = await this.getMemoryContextForPrompt(context);

      const systemPrompt = memoryContext
        ? `${this.config.prompts.system}\n\n${memoryContext}`
        : this.config.prompts.system;

      const response = await this.modelClient!.generate({
        system: systemPrompt,
        user: prompt,
        images: media as GenerateOptions['images'],
        responseFormat: 'json',
      });

      const parsedOutput = this.parseResponse(response);
      const validatedOutput = this.validateOutput(parsedOutput);

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
   */
  async executeWithReflection(
    input: TInput,
    context: TContext,
    reflectionConfig?: Partial<ReflectionConfig>
  ): Promise<ReflectionResult<TOutput>> {
    const config = { ...this.reflectionConfig, ...reflectionConfig };
    const startTime = Date.now();
    const iterations: ReflectionIteration[] = [];
    let totalTokenUsage: TokenUsage = { input: 0, output: 0, total: 0 };

    await this.ensureInitialized();

    if (config.verbose) {
      console.log(`[${this.config.id}] Starting reflection loop (max ${config.maxIterations} iterations)`);
    }

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
        console.log(`[${this.config.id}] Iteration 1: score=${firstEvaluation.evaluation.score.toFixed(2)}`);
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
        const lastIteration = iterations[iterations.length - 1];
        if (!lastIteration) break;
        const previousEvaluation = lastIteration.evaluation;

        const improvedResult = await this.generateImprovedOutput(
          input,
          currentOutput,
          previousEvaluation,
          context
        );

        if (!improvedResult.success || !improvedResult.output) {
          break;
        }

        currentOutput = improvedResult.output;
        totalTokenUsage = this.addTokenUsage(totalTokenUsage, improvedResult.tokenUsage);

        const evaluation = await this.evaluateOutput(input, currentOutput, config);
        totalTokenUsage = this.addTokenUsage(totalTokenUsage, evaluation.tokenUsage);

        iterations.push({
          iteration: i,
          output: currentOutput,
          evaluation: evaluation.evaluation,
          tokenUsage: this.addTokenUsage(improvedResult.tokenUsage, evaluation.tokenUsage),
          latencyMs: Date.now() - loopStart,
        });

        if (evaluation.evaluation.score > bestScore) {
          bestScore = evaluation.evaluation.score;
          bestOutput = currentOutput;
        }

        if (evaluation.evaluation.passed) {
          break;
        }
      }

      const scoreImprovement = bestScore - initialScore;

      return this.buildReflectionResult(
        true,
        bestOutput!,
        undefined,
        totalTokenUsage,
        startTime,
        iterations,
        scoreImprovement > 0,
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
   */
  async *executeStream(
    input: TInput,
    context: TContext
  ): AsyncGenerator<StreamChunk, StreamResult<TOutput>, undefined> {
    const startTime = Date.now();

    await this.ensureInitialized();

    try {
      const validatedInput = this.validateInput(input);
      const prompt = this.buildPrompt(validatedInput, context);

      // Check if model client supports streaming
      if (!this.modelClient!.generateStream) {
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
      const stream = this.modelClient!.generateStream({
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
        tokenUsage: { input: 0, output: 0, total: 0 },
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

  // ============================================================================
  // Validation Methods
  // ============================================================================

  private validateInput(input: TInput): TInput {
    const result = this.config.inputSchema.safeParse(input);
    if (!result.success) {
      const errorMessage = this.formatValidationError(result.error);
      throw new Error(`Input validation failed: ${errorMessage}`);
    }
    return result.data as TInput;
  }

  private validateOutput(output: unknown): TOutput {
    const result = this.config.outputSchema.safeParse(output);
    if (!result.success) {
      const errorMessage = this.formatValidationError(result.error);
      throw new Error(`Output validation failed: ${errorMessage}`);
    }
    return result.data as TOutput;
  }

  /**
   * Format validation error from unknown error type (Zod v3/v4 compatible)
   */
  private formatValidationError(error: unknown): string {
    if (!error) return 'Unknown validation error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    // Zod error objects have message property
    if (typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    // Zod v3/v4 error might have issues array
    if (typeof error === 'object' && 'issues' in error) {
      const issues = (error as { issues: Array<{ message: string }> }).issues;
      return issues.map(i => i.message).join(', ');
    }
    return String(error);
  }

  // ============================================================================
  // Response Parsing
  // ============================================================================

  /**
   * Parse model response into output type
   * Handles markdown code blocks and JSON repair
   */
  protected parseResponse(response: ModelResponse): unknown {
    let content = response.content.trim();

    // Strip markdown code fences if present
    const codeBlockMatch = content.match(/^```(?:\w*)?\s*\n?([\s\S]*?)\n?```\s*$/);
    if (codeBlockMatch?.[1]) {
      content = codeBlockMatch[1].trim();
    }

    // Try direct JSON parse
    try {
      return JSON.parse(content);
    } catch {
      // Continue to fallback methods
    }

    // Try to extract JSON from text
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Continue
      }
    }

    // Try to find JSON object
    const objectExtracted = this.extractBalancedJSON(content, '{', '}');
    if (objectExtracted) {
      try {
        return JSON.parse(this.balanceJSON(objectExtracted));
      } catch {
        // Continue
      }
    }

    // Try to find JSON array
    const arrayExtracted = this.extractBalancedJSON(content, '[', ']');
    if (arrayExtracted) {
      try {
        return JSON.parse(this.balanceJSON(arrayExtracted));
      } catch {
        // Continue
      }
    }

    throw new Error(`Failed to parse AI response as JSON. Response starts with: "${content.substring(0, 100)}..."`);
  }

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
      return content.substring(startIndex);
    }

    return content.substring(startIndex, endIndex + 1);
  }

  private balanceJSON(content: string): string {
    let result = content;

    // Count braces/brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

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

    // Close unclosed braces/brackets
    if (bracketCount > 0 || braceCount > 0) {
      result = result.replace(/,\s*$/, '');
      for (let i = 0; i < bracketCount; i++) result += ']';
      for (let i = 0; i < braceCount; i++) result += '}';
    }

    return result;
  }

  // ============================================================================
  // Reflection Helpers
  // ============================================================================

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
      const response = await this.modelClient!.generate({
        system: 'You are a critical evaluator that provides objective quality assessments. Always respond in valid JSON.',
        user: evaluationPrompt,
        responseFormat: 'json',
      });

      const parsed = this.parseResponse(response) as ReflectionEvaluation;
      parsed.passed = parsed.score >= config.qualityThreshold;

      return {
        evaluation: parsed,
        tokenUsage: response.usage,
      };
    } catch {
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

  private async generateImprovedOutput(
    input: TInput,
    previousOutput: TOutput,
    evaluation: ReflectionEvaluation,
    _context: TContext
  ): Promise<{ success: boolean; output?: TOutput; tokenUsage: TokenUsage }> {
    const improvementPrompt = REFLECTION_IMPROVEMENT_PROMPT
      .replace('{{input}}', JSON.stringify(input, null, 2))
      .replace('{{previousOutput}}', JSON.stringify(previousOutput, null, 2))
      .replace('{{score}}', evaluation.score.toFixed(2))
      .replace('{{feedback}}', evaluation.feedback)
      .replace('{{improvementAreas}}', evaluation.improvementAreas.join(', '));

    try {
      const response = await this.modelClient!.generate({
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
    } catch {
      return {
        success: false,
        tokenUsage: { input: 0, output: 0, total: 0 },
      };
    }
  }

  // ============================================================================
  // Result Builders
  // ============================================================================

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

  private addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
    return {
      input: a.input + b.input,
      output: a.output + b.output,
      total: a.total + b.total,
    };
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  setReflectionConfig(config: Partial<ReflectionConfig>): void {
    this.reflectionConfig = { ...this.reflectionConfig, ...config };
  }

  setMemoryConfig(config: Partial<MemoryConfig>): void {
    this.memoryConfig = { ...this.memoryConfig, ...config };
  }

  enableMemory(enabled: boolean = true): void {
    this.memoryConfig.enabled = enabled;
  }

  setAutoFeedbackConfig(config: Partial<AutoFeedbackConfig>): void {
    this.autoFeedbackConfig = { ...this.autoFeedbackConfig, ...config };
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getConfig(): AgentConfig<TInput, TOutput> {
    return this.config;
  }

  getId(): string {
    return this.config.id;
  }

  getDependencies(): string[] {
    return this.config.dependencies || [];
  }

  dependsOn(agentId: string): boolean {
    return this.config.dependencies?.includes(agentId) ?? false;
  }

  isUsingStoragePrompts(): boolean {
    return this.usingStoragePrompts;
  }

  // ============================================================================
  // Template Helpers
  // ============================================================================

  protected getTemplate(name: string): string {
    const template = this.config.prompts.templates[name];
    if (!template) {
      throw new Error(`Template '${name}' not found for agent ${this.config.id}`);
    }
    return template;
  }

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
