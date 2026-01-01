/**
 * Content Analyzer Agent - Example Implementation
 * ================================================
 * Demonstrates how to create a complete agent using the framework.
 *
 * Features demonstrated:
 * - Extending BaseAgent with typed input/output
 * - Zod schema validation for input/output
 * - Model client integration (GeminiClient/OpenAIClient)
 * - Prompt building with templates
 * - Optional storage adapter integration
 * - Factory function pattern
 *
 * @example
 * ```typescript
 * import { createContentAnalyzerAgent } from '@anthropic/agent-framework/examples';
 *
 * const agent = createContentAnalyzerAgent({ provider: 'gemini' });
 * await agent.initialize();
 *
 * const result = await agent.execute(
 *   { content: 'Analyze this text...' },
 *   { language: 'en', requestId: 'req-123' }
 * );
 *
 * if (result.success) {
 *   console.log('Topics:', result.data.topics);
 *   console.log('Sentiment:', result.data.sentiment);
 * }
 * ```
 */

import { z } from 'zod';
import { BaseAgent } from '../core/base-agent';
import type {
  AgentConfig,
  BaseAgentContext,
  DatabasePrompt,
} from '../types';
import type { IModelClient } from '../models/types';
import type { IPromptStorageAdapter, IStorageAdapter } from '../adapters/storage';

// ============================================================================
// Input/Output Schemas
// ============================================================================

/**
 * Input schema for content analysis
 */
export const ContentAnalyzerInputSchema = z.object({
  /** The content to analyze */
  content: z.string().min(1).max(50000),
  /** Optional focus areas for analysis */
  focusAreas: z.array(z.enum(['topics', 'sentiment', 'keywords', 'summary', 'entities'])).optional(),
  /** Maximum length for summary (if summary is in focus areas) */
  maxSummaryLength: z.number().min(50).max(500).optional(),
});

export type ContentAnalyzerInput = z.infer<typeof ContentAnalyzerInputSchema>;

/**
 * Output schema for content analysis
 */
export const ContentAnalyzerOutputSchema = z.object({
  /** Main topics identified in the content */
  topics: z.array(z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
    mentions: z.number().optional(),
  })),
  /** Sentiment analysis result */
  sentiment: z.object({
    overall: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    score: z.number().min(-1).max(1),
    aspects: z.array(z.object({
      aspect: z.string(),
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      score: z.number().min(-1).max(1),
    })).optional(),
  }),
  /** Key phrases and keywords extracted */
  keywords: z.array(z.object({
    keyword: z.string(),
    relevance: z.number().min(0).max(1),
    frequency: z.number().optional(),
  })),
  /** Brief summary of the content */
  summary: z.string(),
  /** Named entities found in the content */
  entities: z.array(z.object({
    name: z.string(),
    type: z.enum(['person', 'organization', 'location', 'date', 'product', 'event', 'other']),
    context: z.string().optional(),
  })).optional(),
  /** Metadata about the analysis */
  metadata: z.object({
    wordCount: z.number(),
    characterCount: z.number(),
    languageDetected: z.string().optional(),
  }),
});

export type ContentAnalyzerOutput = z.infer<typeof ContentAnalyzerOutputSchema>;

// ============================================================================
// Context Type
// ============================================================================

/**
 * Extended context for content analysis
 */
export interface ContentAnalyzerContext extends BaseAgentContext {
  /** Request identifier */
  requestId?: string;
  /** Language preference for output */
  language?: string;
  /** Domain context (e.g., 'tech', 'business', 'general') */
  domain?: string;
  /** Additional instructions for analysis */
  additionalInstructions?: string;
}

/**
 * Create a default context for content analysis
 */
export function createContentAnalyzerContext(
  overrides: Partial<ContentAnalyzerContext> = {}
): ContentAnalyzerContext {
  return {
    workflow: { sessionId: `analyze-${Date.now()}` },
    ...overrides,
  };
}

// ============================================================================
// Prompt Templates
// ============================================================================

const SYSTEM_PROMPT = `You are an expert content analyst. Your task is to analyze text content and provide structured insights including topics, sentiment, keywords, and summaries.

Guidelines:
- Be objective and precise in your analysis
- Identify the most significant topics and themes
- Provide confidence scores based on evidence in the text
- Extract meaningful keywords that capture the essence of the content
- Write concise but informative summaries
- Detect named entities accurately with their types

Always respond in valid JSON format matching the required schema.`;

const ANALYSIS_TEMPLATE = `Analyze the following content and provide a comprehensive analysis.

{{#if focusAreas}}
Focus your analysis on these areas: {{focusAreas}}
{{else}}
Provide a complete analysis covering: topics, sentiment, keywords, summary, and entities.
{{/if}}

{{#if additionalInstructions}}
Additional instructions: {{additionalInstructions}}
{{/if}}

Maximum summary length: {{maxSummaryLength}} characters

---
CONTENT TO ANALYZE:
{{content}}
---

Respond with a JSON object containing:
- topics: Array of {name, confidence (0-1), mentions}
- sentiment: {overall (positive/negative/neutral/mixed), score (-1 to 1), aspects}
- keywords: Array of {keyword, relevance (0-1), frequency}
- summary: Brief summary within the specified length
- entities: Array of {name, type, context}
- metadata: {wordCount, characterCount, languageDetected}`;

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Default agent configuration
 */
export const ContentAnalyzerAgentConfig: AgentConfig<ContentAnalyzerInput, ContentAnalyzerOutput> = {
  id: 'content-analyzer',
  name: 'Content Analyzer Agent',
  description: 'Analyzes text content for topics, sentiment, keywords, entities, and generates summaries',
  category: 'analyzer',
  inputSchema: ContentAnalyzerInputSchema,
  outputSchema: ContentAnalyzerOutputSchema,
  prompts: {
    system: SYSTEM_PROMPT,
    templates: {
      analysis: ANALYSIS_TEMPLATE,
    },
  },
  model: {
    provider: 'gemini',
    name: 'gemini-2.0-flash',
    options: {
      temperature: 0.3,
      maxTokens: 4096,
    },
  },
};

// ============================================================================
// Agent Options
// ============================================================================

/**
 * Options for creating ContentAnalyzerAgent
 */
export interface ContentAnalyzerAgentOptions {
  /** Model provider to use */
  provider?: 'gemini' | 'openai';
  /** Specific model name to use */
  model?: string;
  /** Model temperature (0-1) */
  temperature?: number;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** API key (optional, defaults to env var) */
  apiKey?: string;
  /** Storage adapter for prompt management */
  storageAdapter?: IStorageAdapter | IPromptStorageAdapter;
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Content Analyzer Agent
 * Analyzes text content and extracts structured insights
 */
export class ContentAnalyzerAgent extends BaseAgent<
  ContentAnalyzerInput,
  ContentAnalyzerOutput,
  ContentAnalyzerContext
> {
  private options: ContentAnalyzerAgentOptions;
  private promptStorage: IPromptStorageAdapter | null = null;

  constructor(
    config: AgentConfig<ContentAnalyzerInput, ContentAnalyzerOutput>,
    options: ContentAnalyzerAgentOptions = {}
  ) {
    super(config);
    this.options = options;

    // Extract prompt storage adapter if provided
    if (options.storageAdapter) {
      if ('prompts' in options.storageAdapter) {
        // Full IStorageAdapter
        this.promptStorage = options.storageAdapter.prompts ?? null;
      } else if ('loadPrompt' in options.storageAdapter) {
        // Just IPromptStorageAdapter
        this.promptStorage = options.storageAdapter as IPromptStorageAdapter;
      }
    }
  }

  /**
   * Create model client based on configured provider
   */
  protected createModelClient(): IModelClient {
    const provider = this.options.provider || this.config.model.provider;
    const modelName = this.options.model || this.config.model.name;
    const temperature = this.options.temperature ?? (this.config.model.options?.temperature as number) ?? 0.3;
    const maxTokens = this.options.maxTokens ?? (this.config.model.options?.maxTokens as number) ?? 4096;

    if (provider === 'openai') {
      // Dynamic import to keep OpenAI optional
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OpenAIClient } = require('../clients/openai-client');
      return new OpenAIClient({
        model: modelName || 'gpt-4o',
        temperature,
        maxTokens,
        apiKey: this.options.apiKey,
      });
    }

    // Default to Gemini
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GeminiClient } = require('../clients/gemini-client');
    return new GeminiClient({
      model: modelName || 'gemini-2.0-flash',
      temperature,
      maxTokens,
      apiKey: this.options.apiKey,
    });
  }

  /**
   * Build prompt from template with input and context
   */
  protected buildPrompt(input: ContentAnalyzerInput, context: ContentAnalyzerContext): string {
    const template = this.getTemplate('analysis');

    // Simple template substitution (mustache-like)
    let prompt = template;

    // Handle conditional blocks
    if (input.focusAreas && input.focusAreas.length > 0) {
      prompt = prompt.replace(
        /\{\{#if focusAreas\}\}([\s\S]*?)\{\{else\}\}[\s\S]*?\{\{\/if\}\}/,
        `$1`
      );
      prompt = prompt.replace('{{focusAreas}}', input.focusAreas.join(', '));
    } else {
      prompt = prompt.replace(
        /\{\{#if focusAreas\}\}[\s\S]*?\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/,
        `$1`
      );
    }

    if (context.additionalInstructions) {
      prompt = prompt.replace(
        /\{\{#if additionalInstructions\}\}([\s\S]*?)\{\{\/if\}\}/,
        `$1`
      );
      prompt = prompt.replace('{{additionalInstructions}}', context.additionalInstructions);
    } else {
      prompt = prompt.replace(
        /\{\{#if additionalInstructions\}\}[\s\S]*?\{\{\/if\}\}/,
        ''
      );
    }

    // Replace simple placeholders
    prompt = prompt.replace('{{maxSummaryLength}}', String(input.maxSummaryLength || 200));
    prompt = prompt.replace('{{content}}', input.content);

    return prompt.trim();
  }

  /**
   * Load prompt from storage adapter if available
   */
  protected async loadPromptFromStorage(): Promise<DatabasePrompt | null> {
    if (!this.promptStorage) {
      return null;
    }

    try {
      const prompt = await this.promptStorage.loadPrompt(this.config.id);
      return prompt;
    } catch (error) {
      console.warn(`[${this.config.id}] Failed to load prompt from storage:`, error);
    }

    return null;
  }

  /**
   * Analyze content with explicit focus areas
   */
  async analyzeWithFocus(
    content: string,
    focusAreas: ContentAnalyzerInput['focusAreas'],
    context?: Partial<ContentAnalyzerContext>
  ): Promise<ContentAnalyzerOutput | null> {
    const fullContext = createContentAnalyzerContext({
      requestId: context?.requestId || `analyze-${Date.now()}`,
      ...context,
    });

    const result = await this.execute(
      {
        content,
        focusAreas,
        maxSummaryLength: 200,
      },
      fullContext
    );

    return result.success ? (result.data ?? null) : null;
  }

  /**
   * Quick sentiment analysis only
   */
  async analyzeSentiment(content: string): Promise<ContentAnalyzerOutput['sentiment'] | null> {
    const result = await this.analyzeWithFocus(content, ['sentiment']);
    return result?.sentiment ?? null;
  }

  /**
   * Extract topics only
   */
  async extractTopics(content: string): Promise<ContentAnalyzerOutput['topics'] | null> {
    const result = await this.analyzeWithFocus(content, ['topics']);
    return result?.topics ?? null;
  }

  /**
   * Generate summary only
   */
  async summarize(content: string, maxLength: number = 200): Promise<string | null> {
    const context = createContentAnalyzerContext({
      requestId: `summarize-${Date.now()}`,
    });

    const result = await this.execute(
      {
        content,
        focusAreas: ['summary'],
        maxSummaryLength: maxLength,
      },
      context
    );

    return result.success ? (result.data?.summary ?? null) : null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ContentAnalyzerAgent with optional configuration
 *
 * @example
 * ```typescript
 * // Basic usage with Gemini (default)
 * const agent = createContentAnalyzerAgent();
 *
 * // With OpenAI
 * const agent = createContentAnalyzerAgent({ provider: 'openai' });
 *
 * // With custom model and storage
 * const agent = createContentAnalyzerAgent({
 *   provider: 'gemini',
 *   model: 'gemini-2.5-pro',
 *   storageAdapter: mySupabaseAdapter,
 * });
 * ```
 */
export function createContentAnalyzerAgent(
  options: ContentAnalyzerAgentOptions = {}
): ContentAnalyzerAgent {
  // Build config with provider overrides
  const config: AgentConfig<ContentAnalyzerInput, ContentAnalyzerOutput> = {
    ...ContentAnalyzerAgentConfig,
    model: {
      ...ContentAnalyzerAgentConfig.model,
      provider: options.provider || ContentAnalyzerAgentConfig.model.provider,
      name: options.model || ContentAnalyzerAgentConfig.model.name,
      options: {
        ...ContentAnalyzerAgentConfig.model.options,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
      },
    },
  };

  return new ContentAnalyzerAgent(config, options);
}

// ============================================================================
// Export for module usage
// ============================================================================

export default ContentAnalyzerAgent;
