/**
 * Agent Framework
 * ===============
 * A reusable AI agent framework for building intelligent, self-improving agents.
 *
 * Features:
 * - Multi-provider model support (Gemini, OpenAI, Anthropic, custom)
 * - Zod-based input/output validation
 * - Reflection pattern for self-improvement
 * - Streaming support for real-time responses
 * - Extensible storage adapters for prompts, memory, and logging
 * - JSON parsing with automatic repair for malformed AI responses
 *
 * @example
 * ```typescript
 * import { BaseAgent, AgentConfig } from '@anthropic/agent-framework';
 * import { z } from 'zod';
 *
 * const config: AgentConfig<MyInput, MyOutput> = {
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   description: 'Does something useful',
 *   category: 'utility',
 *   model: { provider: 'gemini', name: 'gemini-2.0-flash' },
 *   prompts: { system: '...', templates: {} },
 *   inputSchema: myInputSchema,
 *   outputSchema: myOutputSchema,
 * };
 *
 * class MyAgent extends BaseAgent<MyInput, MyOutput> {
 *   constructor() { super(config); }
 *   protected buildPrompt(input) { return `...`; }
 *   protected createModelClient() { return new GeminiClient(...); }
 * }
 * ```
 *
 * @packageDocumentation
 */

// ================================
// Type Exports
// ================================

export * from './types';

// ================================
// Model Client Exports
// ================================

export * from './models';

// ================================
// Core Exports
// ================================

export * from './core';

// ================================
// Adapter Exports
// ================================

export * from './adapters';

// ================================
// Ready-to-Use Client Exports
// ================================

export * from './clients';

// ================================
// Example Agent Exports
// ================================

export * from './examples';
