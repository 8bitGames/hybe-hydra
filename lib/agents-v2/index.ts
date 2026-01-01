/**
 * Hybe Agents v2
 *
 * Agents migrated to @hybe/agent-framework with project-specific integrations.
 * This module provides the new agent implementations while maintaining
 * backward compatibility with the existing agent system.
 *
 * @example
 * ```typescript
 * import { VisionAnalyzerAgent, createMinimalContext } from '@/lib/agents-v2';
 *
 * const agent = new VisionAnalyzerAgent();
 * const context = createMinimalContext({
 *   workflow: { artistName: 'BTS', platform: 'tiktok', language: 'ko' }
 * });
 * const result = await agent.analyzeImage(imageData, 'image/png', context);
 * ```
 */

// Types
export * from './types';

// Base Agent
export { HybeBaseAgent } from './base/hybe-base-agent';

// Analyzers
export {
  VisionAnalyzerAgent,
  createVisionAnalyzerAgent,
  VisionAnalyzerConfig,
  VisionAnalyzerInputSchema,
  VisionAnalyzerOutputSchema,
  type VisionAnalyzerInput,
  type VisionAnalyzerOutput,
} from './analyzers/vision-analyzer';

// Re-export framework types for convenience
export type {
  AgentConfig,
  AgentResult,
  AgentMemory,
  TokenUsage,
  MediaInput,
  IModelClient,
} from '@hybe/agent-framework';
