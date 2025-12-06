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
} from './types';
import { loadPromptFromDatabase, type DatabasePrompt } from './prompt-loader';
import { getEvaluationService, type ExecutionLog } from './evaluation-service';

export abstract class BaseAgent<TInput, TOutput> {
  protected config: AgentConfig<TInput, TOutput>;
  protected modelClient: IModelClient;
  protected isInitialized: boolean = false;
  protected usingDatabasePrompts: boolean = false;
  protected currentPromptVersion: number = 1;
  protected enableExecutionLogging: boolean = true;

  constructor(config: AgentConfig<TInput, TOutput>) {
    this.config = config;
    this.modelClient = this.initializeClient();
  }

  /**
   * Initialize agent with database prompts
   * Call this before execute() to load prompts from database
   * Falls back to hardcoded config if database load fails
   */
  async initializeFromDatabase(): Promise<boolean> {
    if (this.isInitialized) {
      return this.usingDatabasePrompts;
    }

    try {
      const dbPrompt = await loadPromptFromDatabase(this.config.id);

      if (dbPrompt) {
        // Update config with database values
        this.applyDatabasePrompt(dbPrompt);
        this.usingDatabasePrompts = true;
        console.log(`[${this.config.id}] Loaded prompts from database (v${dbPrompt.version})`);
      } else {
        console.log(`[${this.config.id}] Using hardcoded prompts (no DB entry found)`);
      }
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to load DB prompts, using hardcoded:`, error);
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
        model: name as 'gpt-5.1' | 'gpt-5.1-mini',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 4096,
        reasoningEffort: options?.reasoningEffort ?? 'medium',
      });
    }
  }

  /**
   * Execute the agent with input and context
   * Automatically initializes from database if not already done
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

      // 3. Execute model
      const response = await this.modelClient.generate({
        system: this.config.prompts.system,
        user: prompt,
        responseFormat: 'json',
      });

      // 4. Parse and validate output
      const parsedOutput = this.parseResponse(response);
      const validatedOutput = this.validateOutput(parsedOutput);

      // 5. Build successful result
      const result = this.buildResult(true, validatedOutput, undefined, response.usage, startTime);

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
   */
  async executeWithImages(
    input: TInput,
    context: AgentContext,
    images: Array<{ data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' }>
  ): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();

    // Auto-initialize from database if not already done
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    try {
      const validatedInput = this.validateInput(input);
      const prompt = this.buildPrompt(validatedInput, context);

      const response = await this.modelClient.generate({
        system: this.config.prompts.system,
        user: prompt,
        images,
        responseFormat: 'json',
      });

      const parsedOutput = this.parseResponse(response);
      const validatedOutput = this.validateOutput(parsedOutput);

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

    // Try direct JSON parse first
    try {
      return JSON.parse(content);
    } catch {
      // If direct parse fails, try to extract JSON from markdown code blocks
    }

    // Extract JSON from markdown code blocks: ```json ... ``` or ``` ... ```
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1].trim());
      } catch {
        // Continue to next fallback
      }
    }

    // Try to find JSON object in the content (starts with { and ends with })
    const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]);
      } catch {
        // Continue to next fallback
      }
    }

    // If all parsing fails, return the raw content
    // Some agents might work with non-JSON responses
    return content;
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
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to log execution error:`, error);
    }
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
