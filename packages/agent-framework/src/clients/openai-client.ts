/**
 * OpenAI Model Client
 * ====================
 * Client adapter for OpenAI's GPT models.
 *
 * Supported Models:
 * - gpt-4o: Multimodal, fast
 * - gpt-4o-mini: Lightweight tasks
 * - gpt-4-turbo: Advanced reasoning
 * - o1, o1-mini: Reasoning models
 *
 * Required Environment Variables:
 * - OPENAI_API_KEY: OpenAI API key
 *
 * @example
 * ```typescript
 * import { OpenAIClient, createOpenAIClient } from '@anthropic/agent-framework/clients';
 *
 * // Using factory
 * const client = createOpenAIClient('copywriting');
 *
 * // Using constructor
 * const client = new OpenAIClient({
 *   model: 'gpt-4o',
 *   temperature: 0.7,
 * });
 *
 * const response = await client.generate({
 *   system: 'You are a helpful assistant.',
 *   user: 'Hello!',
 * });
 * ```
 */

import type {
  IModelClient,
  GenerateOptions,
  ModelResponse,
  ModelClientConfig,
} from '../models/types';
import type { StreamChunk, TokenUsage } from '../types';
import { GPT_DEFAULT, GPT_MINI } from '../types/constants';

/**
 * Extended configuration for OpenAI client
 */
export interface OpenAIClientConfig extends ModelClientConfig {
  /** OpenAI model name */
  model: string;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Reasoning effort for o1 models */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  /** Presence penalty (-2 to 2) */
  presencePenalty?: number;
  /** Frequency penalty (-2 to 2) */
  frequencyPenalty?: number;
  /** Base URL for API (default: https://api.openai.com/v1) */
  baseUrl?: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * OpenAI model client implementation
 */
export class OpenAIClient implements IModelClient {
  private apiKey: string;
  private config: Required<Pick<OpenAIClientConfig, 'model' | 'temperature' | 'maxTokens' | 'topP'>> & OpenAIClientConfig;
  private baseUrl: string;

  constructor(config: OpenAIClientConfig) {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable or apiKey config is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.config = {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      reasoningEffort: 'none',
      presencePenalty: 0,
      frequencyPenalty: 0,
      ...config,
    };
  }

  getModelName(): string {
    return this.config.model;
  }

  async generate(options: GenerateOptions): Promise<ModelResponse> {
    const { system, user, images, responseFormat } = options;

    // Build messages array
    const messages: OpenAIMessage[] = [];

    if (system) {
      messages.push({
        role: 'system',
        content: system,
      });
    }

    // User message with optional images
    if (images && images.length > 0) {
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

      content.push({
        type: 'text',
        text: user,
      });

      for (const image of images) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${image.mimeType};base64,${image.data}`,
          },
        });
      }

      messages.push({
        role: 'user',
        content,
      });
    } else {
      messages.push({
        role: 'user',
        content: user,
      });
    }

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
    };

    // Add optional parameters
    if (this.config.presencePenalty) {
      requestBody.presence_penalty = this.config.presencePenalty;
    }
    if (this.config.frequencyPenalty) {
      requestBody.frequency_penalty = this.config.frequencyPenalty;
    }
    if (this.config.reasoningEffort && this.config.reasoningEffort !== 'none') {
      requestBody.reasoning_effort = this.config.reasoningEffort;
    }

    // JSON response format
    if (responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json() as OpenAICompletionResponse;
      const text = data.choices[0]?.message?.content || '';

      const usage: TokenUsage = {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      };

      return {
        content: text,
        usage,
        finishReason: data.choices[0]?.finish_reason || 'stop',
      };
    } catch (error) {
      console.error('[OpenAIClient] Generation error:', error);
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const { system, user, images, responseFormat } = options;

    const messages: OpenAIMessage[] = [];

    if (system) {
      messages.push({
        role: 'system',
        content: system,
      });
    }

    if (images && images.length > 0) {
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      content.push({ type: 'text', text: user });
      for (const image of images) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${image.mimeType};base64,${image.data}`,
          },
        });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: user });
    }

    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      stream: true,
    };

    if (this.config.presencePenalty) {
      requestBody.presence_penalty = this.config.presencePenalty;
    }
    if (this.config.frequencyPenalty) {
      requestBody.frequency_penalty = this.config.frequencyPenalty;
    }
    if (this.config.reasoningEffort && this.config.reasoningEffort !== 'none') {
      requestBody.reasoning_effort = this.config.reasoningEffort;
    }

    if (responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          if (!trimmedLine.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmedLine.slice(6)) as OpenAIStreamChunk;
            const content = json.choices[0]?.delta?.content;
            if (content) {
              yield {
                content,
                done: false,
              };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      yield {
        content: '',
        done: true,
      };
    } catch (error) {
      console.error('[OpenAIClient] Stream error:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create OpenAI client with preset configurations
 */
export function createOpenAIClient(
  preset: 'default' | 'mini' | 'copywriting' | 'reasoning',
  options?: Partial<OpenAIClientConfig>
): OpenAIClient {
  const presets = {
    default: {
      model: GPT_DEFAULT,
      temperature: 0.7,
      maxTokens: 4096,
    },
    mini: {
      model: GPT_MINI,
      temperature: 0.7,
      maxTokens: 4096,
    },
    copywriting: {
      model: GPT_DEFAULT,
      temperature: 0.8,
      maxTokens: 4096,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    },
    reasoning: {
      model: GPT_DEFAULT,
      temperature: 0.5,
      maxTokens: 8192,
      reasoningEffort: 'medium' as const,
    },
  };

  const basePreset = presets[preset];

  return new OpenAIClient({
    ...basePreset,
    ...options,
    model: options?.model ?? basePreset.model,
  });
}
