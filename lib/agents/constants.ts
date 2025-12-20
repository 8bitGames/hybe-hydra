/**
 * Agent System Constants
 * ======================
 * Central configuration for AI model names and defaults.
 *
 * When upgrading models, only change this file and run sync:
 * POST /api/v1/admin/prompts/sync?mode=sync
 */

// ================================
// Gemini Models
// ================================

/** Default Gemini model for most agents (analyzers, transformers, fast-cut) */
export const GEMINI_FLASH = 'gemini-3-flash-preview' as const;

/** Gemini Pro model for complex reasoning tasks (creative director, strategic) */
export const GEMINI_PRO = 'gemini-3-pro-preview' as const;

// ================================
// OpenAI Models
// ================================

/** Default OpenAI model for publishers (user-facing text) */
export const GPT_DEFAULT = 'gpt-5.1' as const;

/** GPT Mini for lightweight tasks */
export const GPT_MINI = 'gpt-5.1-mini' as const;

// ================================
// Type Exports
// ================================

export type GeminiModelName = typeof GEMINI_FLASH | typeof GEMINI_PRO;
export type OpenAIModelName = typeof GPT_DEFAULT | typeof GPT_MINI;
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
