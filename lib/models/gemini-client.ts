/**
 * Gemini Model Client
 * ====================
 * Unified client for Gemini 2.5 Flash and Gemini 3 Pro models
 *
 * Models:
 * - gemini-2.5-flash: Fast analysis, pattern recognition (Analyzers, Transformers)
 * - gemini-3-pro-preview: Deep reasoning, strategic thinking (Creative Director)
 */

import { GoogleGenAI } from '@google/genai';
import type {
  IModelClient,
  ModelClientConfig,
  ModelResponse,
  GenerateOptions,
  StreamChunk,
  TokenUsage,
} from './types';

export interface GeminiClientConfig extends ModelClientConfig {
  model: 'gemini-2.5-flash' | 'gemini-3-pro-preview';
  thinkingLevel?: 'low' | 'high';  // Gemini 3 Pro only
  enableGoogleSearch?: boolean;
}

// Model name mapping - use stable model names
const MODEL_MAP: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-3-pro-preview': 'gemini-3-pro-preview',
};

export class GeminiClient implements IModelClient {
  private ai: GoogleGenAI;
  private config: GeminiClientConfig;
  private actualModelId: string;

  constructor(config: GeminiClientConfig) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required');
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.config = {
      temperature: 0.7,
      maxTokens: 8192,
      topP: 0.95,
      topK: 40,
      ...config,
    };
    this.actualModelId = MODEL_MAP[config.model] || config.model;
  }

  getModelName(): string {
    return this.config.model;
  }

  async generate(options: GenerateOptions): Promise<ModelResponse> {
    const { system, user, images, responseFormat } = options;

    // Build configuration
    const generationConfig: Record<string, unknown> = {
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxTokens,
      topP: this.config.topP,
      topK: this.config.topK,
    };

    // Build tools array first (needed to check for JSON compatibility)
    const tools: Array<Record<string, unknown>> = [];
    if (this.config.enableGoogleSearch) {
      tools.push({ googleSearch: {} });
    }

    // JSON response format - NOT compatible with tools (Google Search)
    // When tools are enabled, we rely on prompt to request JSON and parse from text
    if (responseFormat === 'json' && tools.length === 0) {
      generationConfig.responseMimeType = 'application/json';
    }

    // Build thinkingConfig for Gemini 3 Pro
    let thinkingConfig: Record<string, unknown> | undefined;
    if (this.config.thinkingLevel && this.config.model === 'gemini-3-pro-preview') {
      thinkingConfig = {
        thinkingLevel: this.config.thinkingLevel,
      };
    }

    // Build content parts
    const parts: Array<Record<string, unknown>> = [];

    // Add images if provided
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

    // Add text prompt
    parts.push({ text: user });

    try {
      // Debug: log actual config being sent
      console.log(`[GeminiClient] Request config: model=${this.actualModelId}, maxOutputTokens=${generationConfig.maxOutputTokens}, temp=${generationConfig.temperature}`);

      const response = await this.ai.models.generateContent({
        model: this.actualModelId,
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

      // Extract text from response
      const text = response.text || '';

      // Calculate token usage (estimated if not provided)
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
        rawResponse: response,
      };
    } catch (error) {
      console.error('[GeminiClient] Generation error:', error);
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const { system, user, images, responseFormat } = options;

    // Build configuration
    const generationConfig: Record<string, unknown> = {
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxTokens,
      topP: this.config.topP,
      topK: this.config.topK,
    };

    // Build tools array first (needed to check for JSON compatibility)
    const tools: Array<Record<string, unknown>> = [];
    if (this.config.enableGoogleSearch) {
      tools.push({ googleSearch: {} });
    }

    // JSON response format - NOT compatible with tools (Google Search)
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

    parts.push({ text: user });

    try {
      const response = await this.ai.models.generateContentStream({
        model: this.actualModelId,
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
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Factory function to create Gemini client with preset configurations
 */
export function createGeminiClient(
  model: 'flash' | 'pro',
  options?: Partial<GeminiClientConfig>
): GeminiClient {
  const presets: Record<string, GeminiClientConfig> = {
    flash: {
      model: 'gemini-2.5-flash',
      temperature: 0.3,
      maxTokens: 8192,
    },
    pro: {
      model: 'gemini-3-pro-preview',
      temperature: 0.7,
      maxTokens: 16384,
      thinkingLevel: 'high',
      enableGoogleSearch: true,
    },
  };

  return new GeminiClient({
    ...presets[model],
    ...options,
  });
}
