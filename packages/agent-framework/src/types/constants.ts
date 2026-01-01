/**
 * Agent Framework Constants
 * =========================
 * Central configuration for AI model names and defaults.
 */

// ================================
// Gemini Models
// ================================

/** Default Gemini model for most agents */
export const GEMINI_FLASH = 'gemini-2.0-flash' as const;

/** Gemini Pro model for complex reasoning tasks */
export const GEMINI_PRO = 'gemini-2.5-pro' as const;

// ================================
// OpenAI Models
// ================================

/** Default OpenAI model */
export const GPT_DEFAULT = 'gpt-4o' as const;

/** GPT Mini for lightweight tasks */
export const GPT_MINI = 'gpt-4o-mini' as const;

// ================================
// Type Exports
// ================================

export type GeminiModelName = typeof GEMINI_FLASH | typeof GEMINI_PRO | string;
export type OpenAIModelName = typeof GPT_DEFAULT | typeof GPT_MINI | string;
export type ModelName = GeminiModelName | OpenAIModelName;

// ================================
// Default Model Options
// ================================

export const DEFAULT_GEMINI_OPTIONS = {
  temperature: 0.7,
  maxTokens: 4096,
} as const;

export const DEFAULT_PRO_OPTIONS = {
  temperature: 0.8,
  maxTokens: 8192,
  thinkingLevel: 'high' as const,
} as const;

export const DEFAULT_GPT_OPTIONS = {
  temperature: 0.7,
  maxTokens: 4096,
  reasoningEffort: 'medium' as const,
} as const;
