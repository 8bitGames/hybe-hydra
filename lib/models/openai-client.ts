/**
 * OpenAI Model Client
 * ====================
 * Client for GPT-5.1 models (Publisher Agents)
 *
 * GPT-5.1 Features:
 * - Adaptive reasoning with reasoningEffort parameter
 * - Superior natural language copywriting
 * - Excellent tone/voice control
 * - Optimized for user-facing content
 *
 * @see https://platform.openai.com/docs/models/gpt-5.1
 */

import type {
  IModelClient,
  ModelClientConfig,
  ModelResponse,
  GenerateOptions,
  StreamChunk,
  TokenUsage,
} from './types';

export interface OpenAIClientConfig extends ModelClientConfig {
  model: 'gpt-5.1' | 'gpt-5.1-mini';
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  presencePenalty?: number;
  frequencyPenalty?: number;
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

export class OpenAIClient implements IModelClient {
  private apiKey: string;
  private config: OpenAIClientConfig;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(config: OpenAIClientConfig) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.apiKey = apiKey;
    this.config = {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      reasoningEffort: 'medium',
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

    // System message
    if (system) {
      messages.push({
        role: 'system',
        content: system,
      });
    }

    // User message with optional images
    if (images && images.length > 0) {
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

      // Add text first
      content.push({
        type: 'text',
        text: user,
      });

      // Add images
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
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      top_p: this.config.topP,
      presence_penalty: this.config.presencePenalty,
      frequency_penalty: this.config.frequencyPenalty,
    };

    // GPT-5.1 specific: reasoning effort
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
        rawResponse: data,
      };
    } catch (error) {
      console.error('[OpenAIClient] Generation error:', error);
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const { system, user, images, responseFormat } = options;

    // Build messages array
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

    // Build request body with stream
    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      top_p: this.config.topP,
      presence_penalty: this.config.presencePenalty,
      frequency_penalty: this.config.frequencyPenalty,
      stream: true,
    };

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
  purpose: 'copywriting' | 'optimization',
  options?: Partial<OpenAIClientConfig>
): OpenAIClient {
  const presets: Record<string, OpenAIClientConfig> = {
    copywriting: {
      model: 'gpt-5.1',
      temperature: 0.8,
      maxTokens: 4096,
      reasoningEffort: 'low', // Fast for creative writing
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    },
    optimization: {
      model: 'gpt-5.1',
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: 'medium', // Balanced for strategic decisions
    },
  };

  return new OpenAIClient({
    ...presets[purpose],
    ...options,
  });
}
