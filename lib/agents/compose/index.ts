/**
 * Compose Agents
 * ==============
 * AI agents for video composition workflow
 *
 * Pipeline:
 * 1. Script Generator - Creates TikTok scripts with grounding search
 * 2. Effect Analyzer - Extracts mood/genre/effects from prompts
 * 3. Conductor - Plans full video composition
 */

// ============================================================================
// Script Generator
// ============================================================================

export {
  ComposeScriptGeneratorAgent,
  createComposeScriptGeneratorAgent,
  ComposeScriptGeneratorConfig,
  ComposeScriptGeneratorInputSchema,
  ComposeScriptGeneratorOutputSchema,
  type ComposeScriptGeneratorInput,
  type ComposeScriptGeneratorOutput,
} from './script-generator';

// ============================================================================
// Effect Analyzer
// ============================================================================

export {
  ComposeEffectAnalyzerAgent,
  createComposeEffectAnalyzerAgent,
  ComposeEffectAnalyzerConfig,
  ComposeEffectAnalyzerInputSchema,
  ComposeEffectAnalyzerOutputSchema,
  type ComposeEffectAnalyzerInput,
  type ComposeEffectAnalyzerOutput,
} from './effect-analyzer';

// ============================================================================
// Conductor
// ============================================================================

export {
  ComposeConductorAgent,
  createComposeConductorAgent,
  ComposeConductorConfig,
  ComposeConductorInputSchema,
  ComposeConductorOutputSchema,
  calculateBeatAlignedDurations,
  getAvailableOptions,
  type ComposeConductorInput,
  type ComposeConductorOutput,
} from './conductor';

// ============================================================================
// Compose Agent Factory
// ============================================================================

export const ComposeAgentFactories = {
  scriptGenerator: () => import('./script-generator').then(m => m.createComposeScriptGeneratorAgent()),
  effectAnalyzer: () => import('./effect-analyzer').then(m => m.createComposeEffectAnalyzerAgent()),
  conductor: () => import('./conductor').then(m => m.createComposeConductorAgent()),
};

// ============================================================================
// Agent IDs
// ============================================================================

export const ComposeAgentIds = {
  SCRIPT_GENERATOR: 'compose-script-generator',
  EFFECT_ANALYZER: 'compose-effect-analyzer',
  CONDUCTOR: 'compose-conductor',
} as const;

// ============================================================================
// Model Assignments
// ============================================================================

export const ComposeAgentModels = {
  'compose-script-generator': 'gemini-2.5-flash',
  'compose-effect-analyzer': 'gemini-2.5-flash',
  'compose-conductor': 'gemini-2.5-flash',
} as const;
