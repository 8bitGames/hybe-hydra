/**
 * Model Clients Export
 * =====================
 * Unified model client exports for Agent system
 *
 * Text Generation:
 * - GeminiClient: Google AI API (via @google/genai) - uses GOOGLE_AI_API_KEY
 * - OpenAIClient: OpenAI API - uses OPENAI_API_KEY
 *
 * Media Generation:
 * - VertexAIMediaClient: GCP Vertex AI for Veo 3.1 (video) and Gemini 3 Pro Image (image)
 *   Uses GCP service account or Application Default Credentials
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

// Gemini Client - Google AI API (Analyzers, Transformers, Creative Director)
export {
  GeminiClient,
  createGeminiClient,
  type GeminiClientConfig,
} from './gemini-client';

// Vertex AI Media Client - GCP Vertex AI for Veo 3.1 (video) and Gemini 3 Pro Image (image)
export {
  VertexAIMediaClient,
  getVertexAIMediaClient,
  createVertexAIMediaClient,
  isVertexAIAvailable,
  type VideoGenerationConfig,
  type ImageGenerationConfig,
  type GenerationResult,
  type VideoAspectRatio,
  type ImageAspectRatio,
  type VideoDuration,
} from './vertex-ai-client';

// GCP Authentication
export {
  GCPAuthManager,
  getGCPAuthManager,
  getAccessToken,
  getAuthHeaders,
  type GCPAuthConfig,
  type AuthValidationResult,
} from './gcp-auth';

// OpenAI Client (Publishers - GPT-5.1)
export {
  OpenAIClient,
  createOpenAIClient,
  type OpenAIClientConfig,
} from './openai-client';
