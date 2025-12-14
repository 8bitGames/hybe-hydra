/**
 * Model Client Type Definitions
 * ==============================
 * Shared types for AI model clients
 */

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface ModelResponse {
  content: string;
  usage: TokenUsage;
  finishReason?: string;
  rawResponse?: unknown;
}

export interface GenerateOptions {
  system: string;
  user: string;
  images?: ImageInput[];
  responseFormat?: 'text' | 'json';
}

export interface MediaInput {
  data: string; // base64 encoded
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

// Backward compatibility alias
export type ImageInput = MediaInput;

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ModelClientConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export interface IModelClient {
  generate(options: GenerateOptions): Promise<ModelResponse>;
  generateStream?(options: GenerateOptions): AsyncGenerator<StreamChunk>;
  getModelName(): string;
}
