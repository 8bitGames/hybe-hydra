/**
 * Example Agents Module
 * =====================
 * Reference implementations demonstrating framework usage patterns.
 *
 * These examples show how to:
 * - Extend BaseAgent with proper typing
 * - Define input/output schemas with Zod
 * - Implement prompt building with templates
 * - Integrate with different model providers
 * - Use storage adapters for prompt management
 *
 * @example
 * ```typescript
 * import { createContentAnalyzerAgent } from '@anthropic/agent-framework/examples';
 *
 * const agent = createContentAnalyzerAgent({ provider: 'gemini' });
 * await agent.initialize();
 *
 * const result = await agent.execute(
 *   { content: 'Your text here...' },
 *   { requestId: 'req-123' }
 * );
 * ```
 */

export {
  ContentAnalyzerAgent,
  createContentAnalyzerAgent,
  ContentAnalyzerInputSchema,
  ContentAnalyzerOutputSchema,
  ContentAnalyzerAgentConfig,
} from './content-analyzer-agent';

export type {
  ContentAnalyzerInput,
  ContentAnalyzerOutput,
  ContentAnalyzerContext,
  ContentAnalyzerAgentOptions,
} from './content-analyzer-agent';
