/**
 * Gemini Model Client (Google AI Studio / Vertex AI)
 * ===================================================
 * Unified client for Gemini models
 *
 * Authentication Priority:
 * 1. GOOGLE_AI_API_KEY - Google AI Studio (preferred, works without GCP setup)
 * 2. GCP_SERVICE_ACCOUNT_KEY_FILE - Vertex AI with service account
 * 3. GOOGLE_SERVICE_ACCOUNT_JSON - Vertex AI with JSON credentials
 * 4. Application Default Credentials - Vertex AI fallback
 *
 * Models:
 * - gemini-3-flash-preview: Fast analysis, pattern recognition (Analyzers, Transformers)
 * - gemini-3-pro-preview: Deep reasoning, strategic thinking (Creative Director)
 */

import { GoogleGenAI } from '@google/genai';
import { GCPAuthManager } from './gcp-auth';
import type {
  IModelClient,
  ModelClientConfig,
  ModelResponse,
  GenerateOptions,
  StreamChunk,
  TokenUsage,
} from './types';
import { GEMINI_FLASH, GEMINI_PRO, type GeminiModelName } from '../agents/constants';

// Vertex AI configuration for text generation
const VERTEX_AI_PROJECT = 'poised-time-480910-r2';
const VERTEX_AI_LOCATION = 'us-central1';

export interface GeminiClientConfig extends ModelClientConfig {
  model: GeminiModelName;
  thinkingLevel?: 'low' | 'high';  // Gemini 3 Pro only
  enableGoogleSearch?: boolean;
}

// Model name mapping - use stable model names
const MODEL_MAP: Record<string, string> = {
  [GEMINI_FLASH]: GEMINI_FLASH,
  [GEMINI_PRO]: GEMINI_PRO,
};

// Vertex AI response types
interface VertexAIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiClient implements IModelClient {
  private authManager: GCPAuthManager | null = null;
  private googleAI: GoogleGenAI | null = null;
  private useGoogleAIStudio: boolean = false;
  private config: GeminiClientConfig;
  private actualModelId: string;

  constructor(config: GeminiClientConfig) {
    this.config = {
      temperature: 0.7,
      maxTokens: 8192,
      topP: 0.95,
      topK: 40,
      ...config,
    };
    this.actualModelId = MODEL_MAP[config.model] || config.model;

    // Check for Google AI Studio API key first (preferred - simpler auth)
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey && apiKey.length > 0) {
      this.googleAI = new GoogleGenAI({ apiKey });
      this.useGoogleAIStudio = true;
      console.log(`[GeminiClient] Initialized with Google AI Studio (API key)`);
    } else {
      // Fall back to Vertex AI with GCP credentials
      this.authManager = new GCPAuthManager({
        projectId: VERTEX_AI_PROJECT,
        location: VERTEX_AI_LOCATION,
      });
      console.log(`[GeminiClient] Initialized with Vertex AI project: ${VERTEX_AI_PROJECT}`);
    }
  }

  getModelName(): string {
    return this.config.model;
  }

  private getEndpoint(stream: boolean = false): string {
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    return `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_PROJECT}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${this.actualModelId}:${action}`;
  }

  async generate(options: GenerateOptions): Promise<ModelResponse> {
    // Use Google AI Studio if available
    if (this.useGoogleAIStudio && this.googleAI) {
      return this.generateWithGoogleAIStudio(options);
    }

    // Otherwise use Vertex AI
    return this.generateWithVertexAI(options);
  }

  /**
   * Generate using Google AI Studio (@google/genai SDK with API key)
   */
  private async generateWithGoogleAIStudio(options: GenerateOptions): Promise<ModelResponse> {
    const { system, user, images, responseFormat } = options;

    if (!this.googleAI) {
      throw new Error('Google AI Studio client not initialized');
    }

    // Build content parts
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // Add images/video if provided
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
      console.log(`[GeminiClient] Request config (Google AI Studio): model=${this.actualModelId}, maxOutputTokens=${this.config.maxTokens}, temp=${this.config.temperature}`);

      const response = await this.googleAI.models.generateContent({
        model: this.actualModelId,
        config: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
          topP: this.config.topP,
          topK: this.config.topK,
          ...(responseFormat === 'json' && !this.config.enableGoogleSearch
            ? { responseMimeType: 'application/json' }
            : {}),
        },
        ...(system ? { systemInstruction: system } : {}),
        contents: [{
          role: 'user',
          parts,
        }],
      });

      // Extract text from response
      const text = response.text || '';

      // Calculate token usage
      const usageMetadata = response.usageMetadata;
      const usage: TokenUsage = {
        input: usageMetadata?.promptTokenCount || this.estimateTokens((system || '') + user),
        output: usageMetadata?.candidatesTokenCount || this.estimateTokens(text),
        total: usageMetadata?.totalTokenCount ||
          (this.estimateTokens((system || '') + user) + this.estimateTokens(text)),
      };

      return {
        content: text,
        usage,
        finishReason: response.candidates?.[0]?.finishReason || 'STOP',
        rawResponse: response,
      };
    } catch (error) {
      console.error('[GeminiClient] Google AI Studio generation error:', error);
      throw error;
    }
  }

  /**
   * Generate using Vertex AI (GCP credentials)
   */
  private async generateWithVertexAI(options: GenerateOptions): Promise<ModelResponse> {
    const { system, user, images, responseFormat } = options;

    if (!this.authManager) {
      throw new Error('Vertex AI auth manager not initialized');
    }

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

    // JSON response format - NOT compatible with tools (Google Search)
    if (responseFormat === 'json' && tools.length === 0) {
      generationConfig.responseMimeType = 'application/json';
    }

    // Build thinkingConfig for Gemini 3 Pro
    let thinkingConfig: Record<string, unknown> | undefined;
    if (this.config.thinkingLevel && this.config.model === GEMINI_PRO) {
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

    // Build request body
    const requestBody: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig,
    };

    // Add system instruction if provided
    if (system) {
      requestBody.systemInstruction = {
        parts: [{ text: system }],
      };
    }

    // Add tools if any
    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    // Add thinking config if set
    if (thinkingConfig) {
      requestBody.generationConfig = {
        ...generationConfig,
        ...thinkingConfig,
      };
    }

    try {
      console.log(`[GeminiClient] Request config (Vertex AI): model=${this.actualModelId}, maxOutputTokens=${generationConfig.maxOutputTokens}, temp=${generationConfig.temperature}, project=${VERTEX_AI_PROJECT}`);

      const headers = await this.authManager.getAuthHeaders();
      const endpoint = this.getEndpoint(false);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GeminiClient] Vertex AI API error: ${response.status} - ${errorText}`);
        throw new Error(`Vertex AI API error: ${response.status} - ${errorText}`);
      }

      const data: VertexAIResponse = await response.json();

      // Extract text from response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Calculate token usage
      const usage: TokenUsage = {
        input: data.usageMetadata?.promptTokenCount || this.estimateTokens((system || '') + user),
        output: data.usageMetadata?.candidatesTokenCount || this.estimateTokens(text),
        total: data.usageMetadata?.totalTokenCount ||
          (this.estimateTokens((system || '') + user) + this.estimateTokens(text)),
      };

      return {
        content: text,
        usage,
        finishReason: data.candidates?.[0]?.finishReason || 'STOP',
        rawResponse: data,
      };
    } catch (error) {
      console.error('[GeminiClient] Vertex AI generation error:', error);
      throw error;
    }
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const { system, user, images, responseFormat } = options;

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

    // JSON response format
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

    // Build request body
    const requestBody: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig,
    };

    if (system) {
      requestBody.systemInstruction = {
        parts: [{ text: system }],
      };
    }

    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    try {
      const headers = await this.authManager.getAuthHeaders();
      const endpoint = this.getEndpoint(true) + '?alt=sse';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
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
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr && jsonStr !== '[DONE]') {
              try {
                const data: VertexAIResponse = JSON.parse(jsonStr);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text) {
                  yield {
                    content: text,
                    done: false,
                  };
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
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
      model: GEMINI_FLASH,
      temperature: 0.3,
      maxTokens: 8192,
    },
    pro: {
      model: GEMINI_PRO,
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
