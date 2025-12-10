/**
 * Fast Cut Agents
 * ==============
 * AI agents for fast cut video creation workflow
 *
 * Pipeline:
 * 1. Script Generator - Creates TikTok scripts with grounding search
 * 2. Image Keyword Generator - Generates Google Image Search optimized keywords
 * 3. Effect Analyzer - Extracts mood/genre/effects from prompts
 * 4. Conductor - Plans full video composition
 */

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
  scriptGenerator: () => import('./script-generator').then(m => m.createFastCutScriptGeneratorAgent()),
  imageKeywordGenerator: () => import('./image-keyword-generator').then(m => m.createImageKeywordGeneratorAgent()),
  effectAnalyzer: () => import('./effect-analyzer').then(m => m.createFastCutEffectAnalyzerAgent()),
  conductor: () => import('./conductor').then(m => m.createFastCutConductorAgent()),
};

// ============================================================================
// Agent IDs
// ============================================================================

export const FastCutAgentIds = {
  SCRIPT_GENERATOR: 'fast-cut-script-generator',
  IMAGE_KEYWORD_GENERATOR: 'fast-cut-image-keyword-generator',
  EFFECT_ANALYZER: 'fast-cut-effect-analyzer',
  CONDUCTOR: 'fast-cut-conductor',
} as const;

// ============================================================================
// Model Assignments
// ============================================================================

export const FastCutAgentModels = {
  'fast-cut-script-generator': 'gemini-2.5-flash',
  'fast-cut-image-keyword-generator': 'gemini-2.5-flash',
  'fast-cut-effect-analyzer': 'gemini-2.5-flash',
  'fast-cut-conductor': 'gemini-2.5-flash',
} as const;
