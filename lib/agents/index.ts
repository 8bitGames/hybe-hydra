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
export { BaseAgent, type MemoryConfig, type AutoFeedbackConfig } from './base-agent';

// ============================================================================
// Memory Service
// ============================================================================

export {
  storeMemory,
  retrieveMemories,
  getMemory,
  deleteMemory,
  clearAgentMemories,
  updateImportance,
  consolidateMemories,
  cleanupExpiredMemories,
  getMemoryStats,
  buildMemoryContext,
  type MemoryRecord,
} from './memory-service';

// ============================================================================
// Prompt Management
// ============================================================================

export {
  loadPromptFromDatabase,
  loadPromptsByCategory,
  clearPromptCache,
  preloadAllPrompts,
  // Prompt History Management
  savePromptHistory,
  getPromptHistory,
  getPromptHistoryVersion,
  rollbackToVersion,
  updatePromptWithHistory,
  type DatabasePrompt,
  type PromptHistoryRecord,
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

  // Fast Cut Idea
  FastCutIdeaAgent,
  createFastCutIdeaAgent,
  FastCutIdeaConfig,
  FastCutIdeaInputSchema,
  FastCutIdeaOutputSchema,
  type FastCutIdeaInput,
  type FastCutIdeaOutput,
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
// Fast Cut Agents (Gemini 2.5 Flash)
// ============================================================================

export {
  // Script Generator
  FastCutScriptGeneratorAgent,
  createFastCutScriptGeneratorAgent,
  FastCutScriptGeneratorConfig,
  FastCutScriptGeneratorInputSchema,
  FastCutScriptGeneratorOutputSchema,
  type FastCutScriptGeneratorInput,
  type FastCutScriptGeneratorOutput,

  // Effect Analyzer
  FastCutEffectAnalyzerAgent,
  createFastCutEffectAnalyzerAgent,
  FastCutEffectAnalyzerConfig,
  FastCutEffectAnalyzerInputSchema,
  FastCutEffectAnalyzerOutputSchema,
  type FastCutEffectAnalyzerInput,
  type FastCutEffectAnalyzerOutput,

  // Conductor
  FastCutConductorAgent,
  createFastCutConductorAgent,
  FastCutConductorConfig,
  FastCutConductorInputSchema,
  FastCutConductorOutputSchema,
  calculateBeatAlignedDurations,
  getAvailableOptions,
  type FastCutConductorInput,
  type FastCutConductorOutput,

  // Fast Cut utilities
  FastCutAgentFactories,
  FastCutAgentIds,
  FastCutAgentModels,
} from './fast-cut';

// Backward compatibility aliases (deprecated - use FastCut* instead)
export {
  FastCutScriptGeneratorAgent as ComposeScriptGeneratorAgent,
  createFastCutScriptGeneratorAgent as createComposeScriptGeneratorAgent,
  FastCutScriptGeneratorConfig as ComposeScriptGeneratorConfig,
  FastCutScriptGeneratorInputSchema as ComposeScriptGeneratorInputSchema,
  FastCutScriptGeneratorOutputSchema as ComposeScriptGeneratorOutputSchema,
  type FastCutScriptGeneratorInput as ComposeScriptGeneratorInput,
  type FastCutScriptGeneratorOutput as ComposeScriptGeneratorOutput,
  FastCutEffectAnalyzerAgent as ComposeEffectAnalyzerAgent,
  createFastCutEffectAnalyzerAgent as createComposeEffectAnalyzerAgent,
  FastCutEffectAnalyzerConfig as ComposeEffectAnalyzerConfig,
  FastCutEffectAnalyzerInputSchema as ComposeEffectAnalyzerInputSchema,
  FastCutEffectAnalyzerOutputSchema as ComposeEffectAnalyzerOutputSchema,
  type FastCutEffectAnalyzerInput as ComposeEffectAnalyzerInput,
  type FastCutEffectAnalyzerOutput as ComposeEffectAnalyzerOutput,
  FastCutConductorAgent as ComposeConductorAgent,
  createFastCutConductorAgent as createComposeConductorAgent,
  FastCutConductorConfig as ComposeConductorConfig,
  FastCutConductorInputSchema as ComposeConductorInputSchema,
  FastCutConductorOutputSchema as ComposeConductorOutputSchema,
  type FastCutConductorInput as ComposeConductorInput,
  type FastCutConductorOutput as ComposeConductorOutput,
  FastCutAgentFactories as ComposeAgentFactories,
  FastCutAgentIds as ComposeAgentIds,
  FastCutAgentModels as ComposeAgentModels,
} from './fast-cut';

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
  fastCutIdea: () => import('./creators/fast-cut-idea-agent').then(m => m.createFastCutIdeaAgent()),

  // Transformers
  promptEngineer: () => import('./transformers/prompt-engineer').then(m => m.createPromptEngineerAgent()),
  i2vSpecialist: () => import('./transformers/i2v-specialist').then(m => m.createI2VSpecialistAgent()),

  // Publishers
  publishOptimizer: () => import('./publishers/publish-optimizer').then(m => m.createPublishOptimizerAgent()),
  copywriter: () => import('./publishers/copywriter').then(m => m.createCopywriterAgent()),

  // Fast Cut
  fastCutScriptGenerator: () => import('./fast-cut/script-generator').then(m => m.createFastCutScriptGeneratorAgent()),
  fastCutEffectAnalyzer: () => import('./fast-cut/effect-analyzer').then(m => m.createFastCutEffectAnalyzerAgent()),
  fastCutConductor: () => import('./fast-cut/conductor').then(m => m.createFastCutConductorAgent()),
};

/**
 * Agent category mapping
 * Note: fast-cut agents are now distributed by function:
 * - fast-cut-script-generator → creator
 * - fast-cut-effect-analyzer → analyzer
 * - fast-cut-conductor → transformer
 */
export const AgentCategories = {
  analyzer: ['vision-analyzer', 'text-pattern', 'visual-trend', 'strategy-synthesizer', 'keyword-insights', 'tiktok-vision', 'veo3-personalize', 'fast-cut-effect-analyzer'],
  creator: ['creative-director', 'script-writer', 'fast-cut-idea', 'fast-cut-script-generator'],
  transformer: ['prompt-engineer', 'i2v-specialist', 'fast-cut-conductor'],
  publisher: ['publish-optimizer', 'copywriter'],
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

  // Gemini 2.5 Flash - Fast Cut Idea (creator)
  'fast-cut-idea': 'gemini-2.5-flash',

  // GPT-5.1 - Copywriting
  'publish-optimizer': 'gpt-5.1',
  'copywriter': 'gpt-5.1',

  // Fast Cut Agents - Gemini 2.5 Flash
  'fast-cut-script-generator': 'gemini-2.5-flash',
  'fast-cut-effect-analyzer': 'gemini-2.5-flash',
  'fast-cut-conductor': 'gemini-2.5-flash',
} as const;
