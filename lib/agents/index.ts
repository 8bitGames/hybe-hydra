/**
 * Hydra AI Agent System
 * =====================
 * Unified multi-agent architecture for AI-powered content creation
 *
 * Architecture:
 * - Analyzers (Gemini 2.5 Flash): Vision, Text Pattern, Visual Trend, Strategy
 * - Creators (Gemini 3 Pro + Flash): Creative Director, Script Writer
 * - Transformers (Gemini 2.5 Flash): Prompt Engineer, I2V Specialist
 * - Publishers (GPT-5.1): Publish Optimizer, Copywriter
 *
 * @example
 * ```typescript
 * import { createOrchestrator, runWorkflow } from '@/lib/agents';
 *
 * // Quick workflow execution
 * const result = await runWorkflow('BTS', 'tiktok', { topic: 'Comeback' });
 *
 * // Or use the orchestrator for more control
 * const orchestrator = createOrchestrator('BTS', 'tiktok', 'ko');
 * const creative = orchestrator.getAgent<CreativeDirectorAgent>('creative-director');
 * const ideas = await creative?.ideate('Comeback concept', orchestrator.getContext());
 * ```
 */

// ============================================================================
// Core Types & Base Classes
// ============================================================================

export * from './types';
export { BaseAgent } from './base-agent';

// ============================================================================
// Prompt Management
// ============================================================================

export {
  loadPromptFromDatabase,
  loadPromptsByCategory,
  clearPromptCache,
  preloadAllPrompts,
  type DatabasePrompt,
} from './prompt-loader';

// ============================================================================
// Evaluation & Metrics
// ============================================================================

export {
  AgentEvaluationService,
  getEvaluationService,
  type ExecutionLog,
  type EvaluationResult,
  type TestCase,
  type TestRunResult,
} from './evaluation-service';

// ============================================================================
// Model Clients
// ============================================================================

export {
  GeminiClient,
  createGeminiClient,
  type GeminiClientConfig,
} from '../models/gemini-client';

export {
  OpenAIClient,
  createOpenAIClient,
  type OpenAIClientConfig,
} from '../models/openai-client';

export type {
  IModelClient,
  ModelClientConfig,
  ModelResponse,
  GenerateOptions,
  StreamChunk,
  TokenUsage,
} from '../models/types';

// ============================================================================
// Analyzer Agents (Gemini 2.5 Flash)
// ============================================================================

export {
  // Vision Analyzer
  VisionAnalyzerAgent,
  createVisionAnalyzerAgent,
  VisionAnalyzerConfig,
  VisionAnalyzerInputSchema,
  VisionAnalyzerOutputSchema,
  type VisionAnalyzerInput,
  type VisionAnalyzerOutput,

  // Text Pattern
  TextPatternAgent,
  createTextPatternAgent,
  TextPatternConfig,
  TextPatternInputSchema,
  TextPatternOutputSchema,
  type TextPatternInput,
  type TextPatternOutput,

  // Visual Trend
  VisualTrendAgent,
  createVisualTrendAgent,
  VisualTrendConfig,
  VisualTrendInputSchema,
  VisualTrendOutputSchema,
  type VisualTrendInput,
  type VisualTrendOutput,

  // Strategy Synthesizer
  StrategySynthesizerAgent,
  createStrategySynthesizerAgent,
  StrategySynthesizerConfig,
  StrategySynthesizerInputSchema,
  StrategySynthesizerOutputSchema,
  type StrategySynthesizerInput,
  type StrategySynthesizerOutput,
} from './analyzers';

// ============================================================================
// Creator Agents (Gemini 3 Pro + Flash)
// ============================================================================

export {
  // Creative Director
  CreativeDirectorAgent,
  createCreativeDirectorAgent,
  CreativeDirectorConfig,
  CreativeDirectorInputSchema,
  CreativeDirectorOutputSchema,
  type CreativeDirectorInput,
  type CreativeDirectorOutput,

  // Script Writer
  ScriptWriterAgent,
  createScriptWriterAgent,
  ScriptWriterConfig,
  ScriptWriterInputSchema,
  ScriptWriterOutputSchema,
  type ScriptWriterInput,
  type ScriptWriterOutput,
} from './creators';

// ============================================================================
// Transformer Agents (Gemini 2.5 Flash)
// ============================================================================

export {
  // Prompt Engineer
  PromptEngineerAgent,
  createPromptEngineerAgent,
  PromptEngineerConfig,
  PromptEngineerInputSchema,
  PromptEngineerOutputSchema,
  type PromptEngineerInput,
  type PromptEngineerOutput,

  // I2V Specialist
  I2VSpecialistAgent,
  createI2VSpecialistAgent,
  I2VSpecialistConfig,
  I2VSpecialistInputSchema,
  I2VSpecialistOutputSchema,
  type I2VSpecialistInput,
  type I2VSpecialistOutput,
} from './transformers';

// ============================================================================
// Publisher Agents (GPT-5.1)
// ============================================================================

export {
  // Publish Optimizer
  PublishOptimizerAgent,
  createPublishOptimizerAgent,
  PublishOptimizerConfig,
  PublishOptimizerInputSchema,
  PublishOptimizerOutputSchema,
  type PublishOptimizerInput,
  type PublishOptimizerOutput,

  // Copywriter
  CopywriterAgent,
  createCopywriterAgent,
  CopywriterConfig,
  CopywriterInputSchema,
  CopywriterOutputSchema,
  type CopywriterInput,
  type CopywriterOutput,
} from './publishers';

// ============================================================================
// Compose Agents (Gemini 2.5 Flash)
// ============================================================================

export {
  // Script Generator
  ComposeScriptGeneratorAgent,
  createComposeScriptGeneratorAgent,
  ComposeScriptGeneratorConfig,
  ComposeScriptGeneratorInputSchema,
  ComposeScriptGeneratorOutputSchema,
  type ComposeScriptGeneratorInput,
  type ComposeScriptGeneratorOutput,

  // Effect Analyzer
  ComposeEffectAnalyzerAgent,
  createComposeEffectAnalyzerAgent,
  ComposeEffectAnalyzerConfig,
  ComposeEffectAnalyzerInputSchema,
  ComposeEffectAnalyzerOutputSchema,
  type ComposeEffectAnalyzerInput,
  type ComposeEffectAnalyzerOutput,

  // Conductor
  ComposeConductorAgent,
  createComposeConductorAgent,
  ComposeConductorConfig,
  ComposeConductorInputSchema,
  ComposeConductorOutputSchema,
  calculateBeatAlignedDurations,
  getAvailableOptions,
  type ComposeConductorInput,
  type ComposeConductorOutput,

  // Compose utilities
  ComposeAgentFactories,
  ComposeAgentIds,
  ComposeAgentModels,
} from './compose';

// ============================================================================
// Workflow Orchestrator
// ============================================================================

export {
  WorkflowOrchestrator,
  createOrchestrator,
  runWorkflow,
  type WorkflowStage,
  type WorkflowConfig,
  type StageResult,
  type WorkflowResult,
} from './orchestrator';

// ============================================================================
// Convenience Re-exports
// ============================================================================

/**
 * All agent factory functions for quick instantiation
 */
export const AgentFactories = {
  // Analyzers
  visionAnalyzer: () => import('./analyzers/vision-analyzer').then(m => m.createVisionAnalyzerAgent()),
  textPattern: () => import('./analyzers/text-pattern').then(m => m.createTextPatternAgent()),
  visualTrend: () => import('./analyzers/visual-trend').then(m => m.createVisualTrendAgent()),
  strategySynthesizer: () => import('./analyzers/strategy-synthesizer').then(m => m.createStrategySynthesizerAgent()),
  keywordInsights: () => import('./analyzers/keyword-insights').then(m => m.createKeywordInsightsAgent()),
  tiktokVision: () => import('./analyzers/tiktok-vision').then(m => m.createTikTokVisionAgent()),
  veo3Personalize: () => import('./analyzers/veo3-personalize').then(m => m.createVeo3PersonalizeAgent()),

  // Creators
  creativeDirector: () => import('./creators/creative-director').then(m => m.createCreativeDirectorAgent()),
  scriptWriter: () => import('./creators/script-writer').then(m => m.createScriptWriterAgent()),

  // Transformers
  promptEngineer: () => import('./transformers/prompt-engineer').then(m => m.createPromptEngineerAgent()),
  i2vSpecialist: () => import('./transformers/i2v-specialist').then(m => m.createI2VSpecialistAgent()),

  // Publishers
  publishOptimizer: () => import('./publishers/publish-optimizer').then(m => m.createPublishOptimizerAgent()),
  copywriter: () => import('./publishers/copywriter').then(m => m.createCopywriterAgent()),

  // Compose
  composeScriptGenerator: () => import('./compose/script-generator').then(m => m.createComposeScriptGeneratorAgent()),
  composeEffectAnalyzer: () => import('./compose/effect-analyzer').then(m => m.createComposeEffectAnalyzerAgent()),
  composeConductor: () => import('./compose/conductor').then(m => m.createComposeConductorAgent()),
};

/**
 * Agent category mapping
 */
export const AgentCategories = {
  analyzer: ['vision-analyzer', 'text-pattern', 'visual-trend', 'strategy-synthesizer', 'keyword-insights', 'tiktok-vision', 'veo3-personalize'],
  creator: ['creative-director', 'script-writer'],
  transformer: ['prompt-engineer', 'i2v-specialist'],
  publisher: ['publish-optimizer', 'copywriter'],
  compose: ['compose-script-generator', 'compose-effect-analyzer', 'compose-conductor'],
} as const;

/**
 * Model assignments by agent
 */
export const AgentModels = {
  // Gemini 2.5 Flash - Fast analysis
  'vision-analyzer': 'gemini-2.5-flash',
  'text-pattern': 'gemini-2.5-flash',
  'visual-trend': 'gemini-2.5-flash',
  'strategy-synthesizer': 'gemini-2.5-flash',
  'tiktok-vision': 'gemini-2.5-flash',
  'veo3-personalize': 'gemini-2.5-flash',
  'script-writer': 'gemini-2.5-flash',
  'prompt-engineer': 'gemini-2.5-flash',
  'i2v-specialist': 'gemini-2.5-flash',

  // Gemini 3 Pro - Deep reasoning
  'creative-director': 'gemini-3-pro-preview',
  'keyword-insights': 'gemini-3-pro-preview',

  // GPT-5.1 - Copywriting
  'publish-optimizer': 'gpt-5.1',
  'copywriter': 'gpt-5.1',

  // Compose Agents - Gemini 2.5 Flash
  'compose-script-generator': 'gemini-2.5-flash',
  'compose-effect-analyzer': 'gemini-2.5-flash',
  'compose-conductor': 'gemini-2.5-flash',
} as const;
