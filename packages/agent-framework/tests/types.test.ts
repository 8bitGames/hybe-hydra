/**
 * Type System Tests
 * Tests for Zod schemas and type definitions
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type {
  AgentConfig,
  ModelConfig,
  AgentPrompts,
  BaseAgentContext,
  BaseWorkflowMetadata,
  AgentResult,
} from '../src/types';

describe('Type Definitions', () => {
  describe('ModelConfig', () => {
    it('should accept valid model configuration', () => {
      const config: ModelConfig = {
        provider: 'gemini',
        name: 'gemini-2.0-flash',
        options: {
          temperature: 0.7,
          maxTokens: 4096,
        },
      };

      expect(config.provider).toBe('gemini');
      expect(config.name).toBe('gemini-2.0-flash');
      expect(config.options?.temperature).toBe(0.7);
    });

    it('should accept openai provider', () => {
      const config: ModelConfig = {
        provider: 'openai',
        name: 'gpt-4o',
      };

      expect(config.provider).toBe('openai');
    });

    it('should accept anthropic provider', () => {
      const config: ModelConfig = {
        provider: 'anthropic',
        name: 'claude-3-opus',
      };

      expect(config.provider).toBe('anthropic');
    });
  });

  describe('AgentPrompts', () => {
    it('should have system prompt and templates', () => {
      const prompts: AgentPrompts = {
        system: 'You are a helpful assistant.',
        templates: {
          main: 'Analyze: {{content}}',
          summary: 'Summarize: {{text}}',
        },
      };

      expect(prompts.system).toBeDefined();
      expect(prompts.templates.main).toContain('{{content}}');
    });
  });

  describe('AgentConfig', () => {
    it('should define complete agent configuration', () => {
      const inputSchema = z.object({ content: z.string() });
      const outputSchema = z.object({ result: z.string() });

      const config: AgentConfig<
        z.infer<typeof inputSchema>,
        z.infer<typeof outputSchema>
      > = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        category: 'test',
        model: {
          provider: 'gemini',
          name: 'gemini-2.0-flash',
        },
        prompts: {
          system: 'Test system prompt',
          templates: {},
        },
        inputSchema,
        outputSchema,
      };

      expect(config.id).toBe('test-agent');
      expect(config.category).toBe('test');
    });
  });

  describe('BaseAgentContext', () => {
    it('should require workflow property', () => {
      const context: BaseAgentContext = {
        workflow: {
          sessionId: 'test-session',
        },
      };

      expect(context.workflow.sessionId).toBe('test-session');
    });

    it('should allow additional properties', () => {
      const context: BaseAgentContext = {
        workflow: { sessionId: 'test' },
        customField: 'custom value',
      };

      expect(context.customField).toBe('custom value');
    });
  });

  describe('BaseWorkflowMetadata', () => {
    it('should accept workflow metadata', () => {
      const workflow: BaseWorkflowMetadata = {
        sessionId: 'session-123',
        startedAt: new Date(),
        language: 'en',
      };

      expect(workflow.sessionId).toBe('session-123');
      expect(workflow.language).toBe('en');
    });

    it('should allow additional metadata', () => {
      const workflow: BaseWorkflowMetadata = {
        sessionId: 'test',
        customMeta: { key: 'value' },
      };

      expect(workflow.customMeta).toEqual({ key: 'value' });
    });
  });

  describe('AgentResult', () => {
    it('should represent successful result', () => {
      const result: AgentResult<{ value: number }> = {
        success: true,
        data: { value: 42 },
        tokenUsage: { input: 100, output: 50, total: 150 },
        executionTime: 1500,
      };

      expect(result.success).toBe(true);
      expect(result.data?.value).toBe(42);
    });

    it('should represent failed result', () => {
      const result: AgentResult<unknown> = {
        success: false,
        error: 'Something went wrong',
        tokenUsage: { input: 50, output: 0, total: 50 },
        executionTime: 500,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
