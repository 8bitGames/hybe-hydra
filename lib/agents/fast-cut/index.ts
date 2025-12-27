/**
 * Fast Cut Agents
 * ==============
 * AI agents for fast cut video creation workflow
 *
 * Pipeline:
 * 0. Scene Analyzer - Analyzes TikTok video scene-by-scene for image keywords
 * 1. Script Generator - Creates TikTok scripts with grounding search
 * 2. Image Keyword Generator - Generates Google Image Search optimized keywords
 * 3. Effect Analyzer - Extracts mood/genre/effects from prompts
 * 4. Conductor - Plans full video composition
 */

import { GEMINI_FLASH } from '../constants';

// ============================================================================
// Scene Analyzer
// ============================================================================

export {
  FastCutSceneAnalyzerAgent,
  getFastCutSceneAnalyzerAgent,
  FastCutSceneAnalyzerConfig,
  FastCutSceneAnalyzerInputSchema,
  FastCutSceneAnalyzerOutputSchema,
  type FastCutSceneAnalyzerInput,
  type FastCutSceneAnalyzerOutput,
} from './scene-analyzer';

// ============================================================================
// Script Generator
// ============================================================================

export {
  FastCutScriptGeneratorAgent,
  createFastCutScriptGeneratorAgent,
  FastCutScriptGeneratorConfig,
  FastCutScriptGeneratorInputSchema,
  FastCutScriptGeneratorOutputSchema,
  type FastCutScriptGeneratorInput,
  type FastCutScriptGeneratorOutput,
} from './script-generator';

// ============================================================================
// Image Keyword Generator
// ============================================================================

export {
  ImageKeywordGeneratorAgent,
  createImageKeywordGeneratorAgent,
  ImageKeywordGeneratorConfig,
  ImageKeywordGeneratorInputSchema,
  ImageKeywordGeneratorOutputSchema,
  type ImageKeywordGeneratorInput,
  type ImageKeywordGeneratorOutput,
} from './image-keyword-generator';

// ============================================================================
// Image Prompt Generator (AI Image Generation)
// ============================================================================

export {
  ImagePromptGeneratorAgent,
  createImagePromptGeneratorAgent,
  ImagePromptGeneratorConfig,
  ImagePromptGeneratorInputSchema,
  ImagePromptGeneratorOutputSchema,
  type ImagePromptGeneratorInput,
  type ImagePromptGeneratorOutput,
  type ScenePrompt,
} from './image-prompt-generator';

// ============================================================================
// Effect Analyzer
// ============================================================================

export {
  FastCutEffectAnalyzerAgent,
  createFastCutEffectAnalyzerAgent,
  FastCutEffectAnalyzerConfig,
  FastCutEffectAnalyzerInputSchema,
  FastCutEffectAnalyzerOutputSchema,
  type FastCutEffectAnalyzerInput,
  type FastCutEffectAnalyzerOutput,
} from './effect-analyzer';

// ============================================================================
// Conductor
// ============================================================================

export {
  FastCutConductorAgent,
  createFastCutConductorAgent,
  FastCutConductorConfig,
  FastCutConductorInputSchema,
  FastCutConductorOutputSchema,
  calculateBeatAlignedDurations,
  getAvailableOptions,
  type FastCutConductorInput,
  type FastCutConductorOutput,
} from './conductor';

// ============================================================================
// Fast Cut Agent Factory
// ============================================================================

export const FastCutAgentFactories = {
  sceneAnalyzer: () => import('./scene-analyzer').then(m => m.getFastCutSceneAnalyzerAgent()),
  scriptGenerator: () => import('./script-generator').then(m => m.createFastCutScriptGeneratorAgent()),
  imageKeywordGenerator: () => import('./image-keyword-generator').then(m => m.createImageKeywordGeneratorAgent()),
  imagePromptGenerator: () => import('./image-prompt-generator').then(m => m.createImagePromptGeneratorAgent()),
  effectAnalyzer: () => import('./effect-analyzer').then(m => m.createFastCutEffectAnalyzerAgent()),
  conductor: () => import('./conductor').then(m => m.createFastCutConductorAgent()),
};

// ============================================================================
// Agent IDs
// ============================================================================

export const FastCutAgentIds = {
  SCENE_ANALYZER: 'fast-cut-scene-analyzer',
  SCRIPT_GENERATOR: 'fast-cut-script-generator',
  IMAGE_KEYWORD_GENERATOR: 'fast-cut-image-keyword-generator',
  IMAGE_PROMPT_GENERATOR: 'fast-cut-image-prompt-generator',
  EFFECT_ANALYZER: 'fast-cut-effect-analyzer',
  CONDUCTOR: 'fast-cut-conductor',
} as const;

// ============================================================================
// Model Assignments
// ============================================================================

export const FastCutAgentModels = {
  'fast-cut-scene-analyzer': GEMINI_FLASH,
  'fast-cut-script-generator': GEMINI_FLASH,
  'fast-cut-image-keyword-generator': GEMINI_FLASH,
  'fast-cut-image-prompt-generator': GEMINI_FLASH,
  'fast-cut-effect-analyzer': GEMINI_FLASH,
  'fast-cut-conductor': GEMINI_FLASH,
} as const;
