/**
 * Model Clients Export
 * =====================
 * Unified model client exports for Agent system
 */

// Types
export type {
  IModelClient,
  ModelClientConfig,
  ModelResponse,
  GenerateOptions,
  StreamChunk,
  TokenUsage,
  ImageInput,
} from './types';

// Gemini Client (Analyzers, Transformers, Creative Director)
export {
  GeminiClient,
  createGeminiClient,
  type GeminiClientConfig,
} from './gemini-client';

// OpenAI Client (Publishers - GPT-5.1)
export {
  OpenAIClient,
  createOpenAIClient,
  type OpenAIClientConfig,
} from './openai-client';
