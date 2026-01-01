/**
 * Model Client Type Definitions
 * =============================
 * Interface definitions for AI model clients.
 * Supports multiple providers: Gemini, OpenAI, Anthropic, etc.
 */

import type { TokenUsage, StreamChunk, ModelOptions } from '../types';

// ================================
// Input Types
// ================================

/**
 * Media input for multimodal models (images, videos)
 */
export interface MediaInput {
  /** Base64 encoded data */
  data: string;
  /** MIME type of the media */
  mimeType:
    | 'image/png'
    | 'image/jpeg'
    | 'image/webp'
    | 'image/gif'
    | 'video/mp4'
    | 'video/mpeg'
    | 'video/webm'
    | 'video/quicktime';
}

/**
 * Image input (alias for backward compatibility)
 */
export type ImageInput = MediaInput;

/**
 * Options for model generation
 */
export interface GenerateOptions {
  /** System prompt */
  system: string;
  /** User prompt */
  user: string;
  /** Optional images for multimodal models */
  images?: ImageInput[];
  /** Optional videos for multimodal models */
  videos?: MediaInput[];
  /** Response format hint */
  responseFormat?: 'text' | 'json';
}

// ================================
// Response Types
// ================================

/**
 * Response from model generation
 */
export interface ModelResponse {
  /** Generated content */
  content: string;
  /** Token usage statistics */
  usage: TokenUsage;
  /** Reason for completion */
  finishReason?: string;
}

// ================================
// Client Interface
// ================================

/**
 * Configuration for model client initialization
 */
export interface ModelClientConfig {
  /** Model name/identifier */
  model: string;
  /** Model-specific options */
  options?: ModelOptions;
  /** API key (optional, can use env vars) */
  apiKey?: string;
}

/**
 * Interface for AI model clients
 * Implement this interface to add support for new AI providers
 */
export interface IModelClient {
  /**
   * Generate content from the model
   * @param options - Generation options including prompts and media
   * @returns Promise resolving to model response
   */
  generate(options: GenerateOptions): Promise<ModelResponse>;

  /**
   * Generate content with streaming (optional)
   * @param options - Generation options
   * @returns AsyncGenerator yielding stream chunks
   */
  generateStream?(options: GenerateOptions): AsyncGenerator<StreamChunk>;

  /**
   * Get the model name/identifier
   * @returns Model name string
   */
  getModelName(): string;
}

// ================================
// Factory Types
// ================================

/**
 * Factory function type for creating model clients
 */
export type ModelClientFactory = (config: ModelClientConfig) => IModelClient;

/**
 * Registry of model client factories by provider
 */
export interface ModelClientRegistry {
  gemini?: ModelClientFactory;
  openai?: ModelClientFactory;
  anthropic?: ModelClientFactory;
  custom?: ModelClientFactory;
}
