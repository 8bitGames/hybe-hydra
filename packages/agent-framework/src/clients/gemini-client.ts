/**
 * Gemini Model Client
 * ====================
 * Client adapter for Google's Gemini models.
 *
 * Supported Models:
 * - gemini-2.0-flash: Fast, efficient for most tasks
 * - gemini-2.5-pro: Advanced reasoning and analysis
 * - gemini-3-flash-preview: Latest flash model
 * - gemini-3-pro-preview: Latest pro model with thinking
 *
 * Required Environment Variables:
 * - GOOGLE_AI_API_KEY: Google AI Studio API key
 *
 * @example
 * ```typescript
 * import { GeminiClient, createGeminiClient } from '@anthropic/agent-framework/clients';
 *
 * // Using factory
 * const client = createGeminiClient('flash');
 *
 * // Using constructor
 * const client = new GeminiClient({
 *   model: 'gemini-2.0-flash',
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
import { GEMINI_FLASH, GEMINI_PRO } from '../types/constants';

/**
 * Extended configuration for Gemini client
 */
export interface GeminiClientConfig extends ModelClientConfig {
  /** Gemini model name */
  model: string;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Top-k sampling parameter */
  topK?: number;
  /** Thinking level for Gemini Pro models */
  thinkingLevel?: 'low' | 'high';
  /** Enable Google Search grounding */
  enableGoogleSearch?: boolean;
}

/**
 * Gemini model client implementation
 */
export class GeminiClient implements IModelClient {
  private ai: GoogleGenAIInstance;
  private config: Required<Pick<GeminiClientConfig, 'model' | 'temperature' | 'maxTokens' | 'topP' | 'topK'>> & GeminiClientConfig;

  constructor(config: GeminiClientConfig) {
    const apiKey = config.apiKey || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable or apiKey config is required');
    }

    // Dynamic import to avoid bundling @google/genai
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleGenAI } = require('@google/genai');
    this.ai = new GoogleGenAI({ apiKey });

    this.config = {
      temperature: 0.7,
      maxTokens: 8192,
      topP: 0.95,
      topK: 40,
      ...config,
    };
  }

  getModelName(): string {
    return this.config.model;
  }

  async generate(options: GenerateOptions): Promise<ModelResponse> {
    const { system, user, images, videos, responseFormat } = options;

    // Build generation config
    const generationConfig: Record<string, unknown> = {
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxTokens,
      topP: this.config.topP,
      topK: this.config.topK,
    };

    // Build tools array
    const tools: Array<Record<string, unknown>> = [];
    if (this.config.enableGoogleSearch) {
      tools.push({ googleSearch: {} });
    }

    // JSON response format (not compatible with tools)
    if (responseFormat === 'json' && tools.length === 0) {
      generationConfig.responseMimeType = 'application/json';
    }

    // Build thinking config for Pro models
    let thinkingConfig: Record<string, unknown> | undefined;
    if (this.config.thinkingLevel && this.config.model.includes('pro')) {
      thinkingConfig = {
        thinkingLevel: this.config.thinkingLevel,
      };
    }

    // Build content parts
    const parts: Array<Record<string, unknown>> = [];

    // Add images
    if (images && images.length > 0) {
      for (const image of images) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data,
          },
        });
      }
    }

    // Add videos
    if (videos && videos.length > 0) {
      for (const video of videos) {
        parts.push({
          inlineData: {
            mimeType: video.mimeType,
            data: video.data,
          },
        });
      }
    }

    // Add text prompt
    parts.push({ text: user });

    try {
      const response = await this.ai.models.generateContent({
        model: this.config.model,
        config: {
          ...generationConfig,
          systemInstruction: system,
          ...(tools.length > 0 && { tools }),
          ...(thinkingConfig && { thinkingConfig }),
        },
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
      });

      const text = response.text || '';

      const usage: TokenUsage = {
        input: response.usageMetadata?.promptTokenCount || this.estimateTokens(system + user),
        output: response.usageMetadata?.candidatesTokenCount || this.estimateTokens(text),
        total: response.usageMetadata?.totalTokenCount ||
          (this.estimateTokens(system + user) + this.estimateTokens(text)),
      };

      return {
        content: text,
        usage,
        finishReason: response.candidates?.[0]?.finishReason || 'STOP',
      };
    } catch (error) {
      console.error('[GeminiClient] Generation error:', error);
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const { system, user, images, videos, responseFormat } = options;

    // Build generation config
    const generationConfig: Record<string, unknown> = {
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxTokens,
      topP: this.config.topP,
      topK: this.config.topK,
    };

    // Build tools
    const tools: Array<Record<string, unknown>> = [];
    if (this.config.enableGoogleSearch) {
      tools.push({ googleSearch: {} });
    }

    if (responseFormat === 'json' && tools.length === 0) {
      generationConfig.responseMimeType = 'application/json';
    }

    // Build content parts
    const parts: Array<Record<string, unknown>> = [];

    if (images && images.length > 0) {
      for (const image of images) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data,
          },
        });
      }
    }

    if (videos && videos.length > 0) {
      for (const video of videos) {
        parts.push({
          inlineData: {
            mimeType: video.mimeType,
            data: video.data,
          },
        });
      }
    }

    parts.push({ text: user });

    try {
      const response = await this.ai.models.generateContentStream({
        model: this.config.model,
        config: {
          ...generationConfig,
          systemInstruction: system,
          ...(tools.length > 0 && { tools }),
        },
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
      });

      for await (const chunk of response) {
        const text = chunk.text || '';
        if (text) {
          yield {
            content: text,
            done: false,
          };
        }
      }

      yield {
        content: '',
        done: true,
      };
    } catch (error) {
      console.error('[GeminiClient] Stream error:', error);
      throw error;
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Factory function to create Gemini client with preset configurations
 */
export function createGeminiClient(
  preset: 'flash' | 'pro',
  options?: Partial<GeminiClientConfig>
): GeminiClient {
  const presets = {
    flash: {
      model: GEMINI_FLASH,
      temperature: 0.3,
      maxTokens: 8192,
    },
    pro: {
      model: GEMINI_PRO,
      temperature: 0.7,
      maxTokens: 16384,
      thinkingLevel: 'high' as const,
      enableGoogleSearch: true,
    },
  };

  const basePreset = presets[preset];

  return new GeminiClient({
    ...basePreset,
    ...options,
    model: options?.model ?? basePreset.model,
  });
}

// Type for dynamic import
interface GoogleGenAIInstance {
  models: {
    generateContent(options: unknown): Promise<{
      text?: string;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
      candidates?: Array<{ finishReason?: string }>;
    }>;
    generateContentStream(options: unknown): AsyncIterable<{ text?: string }>;
  };
}
