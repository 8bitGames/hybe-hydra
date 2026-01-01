/**
 * BaseAgent Tests
 * Tests for the abstract base agent class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { BaseAgent } from '../src/core/base-agent';
import type { AgentConfig, BaseAgentContext } from '../src/types';
import type { IModelClient, ModelResponse } from '../src/models/types';

// ============================================================================
// Test Schemas
// ============================================================================

const TestInputSchema = z.object({
  message: z.string().min(1),
  count: z.number().optional(),
});

const TestOutputSchema = z.object({
  result: z.string(),
  processed: z.boolean(),
});

type TestInput = z.infer<typeof TestInputSchema>;
type TestOutput = z.infer<typeof TestOutputSchema>;

// ============================================================================
// Mock Model Client
// ============================================================================

function createMockModelClient(response: Partial<ModelResponse> = {}): IModelClient {
  const defaultResponse: ModelResponse = {
    content: JSON.stringify({ result: 'test result', processed: true }),
    usage: { input: 100, output: 50, total: 150 },
    ...response,
  };

  return {
    generate: vi.fn().mockResolvedValue(defaultResponse),
    generateStream: vi.fn(),
  };
}

// ============================================================================
// Test Agent Implementation
// ============================================================================

class TestAgent extends BaseAgent<TestInput, TestOutput, BaseAgentContext> {
  public mockModelClient: IModelClient | null = null;

  protected createModelClient(): IModelClient {
    if (this.mockModelClient) {
      return this.mockModelClient;
    }
    return createMockModelClient();
  }

  protected buildPrompt(input: TestInput, context: BaseAgentContext): string {
    return `Process: ${input.message} (count: ${input.count || 1}), session: ${context.workflow.sessionId}`;
  }

  // Expose protected methods for testing
  public testGetTemplate(name: string): string {
    return this.getTemplate(name);
  }

  public testFillTemplate(template: string, values: Record<string, unknown>): string {
    return this.fillTemplate(template, values);
  }

  public testParseResponse(response: ModelResponse): unknown {
    return this.parseResponse(response);
  }
}

// ============================================================================
// Test Configuration
// ============================================================================

function createTestConfig(): AgentConfig<TestInput, TestOutput> {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent for unit testing',
    category: 'test',
    inputSchema: TestInputSchema,
    outputSchema: TestOutputSchema,
    prompts: {
      system: 'You are a test agent.',
      templates: {
        main: 'Process: {{message}}',
        detailed: 'Process {{message}} with count {{count}}',
      },
    },
    model: {
      provider: 'gemini',
      name: 'gemini-2.0-flash',
      options: {
        temperature: 0.5,
        maxTokens: 1024,
      },
    },
    dependencies: ['dep-agent-1', 'dep-agent-2'],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseAgent', () => {
  let agent: TestAgent;
  let config: AgentConfig<TestInput, TestOutput>;

  beforeEach(() => {
    config = createTestConfig();
    agent = new TestAgent(config);
  });

  describe('Configuration', () => {
    it('should return config via getConfig()', () => {
      const returnedConfig = agent.getConfig();
      expect(returnedConfig.id).toBe('test-agent');
      expect(returnedConfig.name).toBe('Test Agent');
      expect(returnedConfig.category).toBe('test');
    });

    it('should return id via getId()', () => {
      expect(agent.getId()).toBe('test-agent');
    });

    it('should return dependencies via getDependencies()', () => {
      expect(agent.getDependencies()).toEqual(['dep-agent-1', 'dep-agent-2']);
    });

    it('should check dependency via dependsOn()', () => {
      expect(agent.dependsOn('dep-agent-1')).toBe(true);
      expect(agent.dependsOn('dep-agent-2')).toBe(true);
      expect(agent.dependsOn('unknown-agent')).toBe(false);
    });

    it('should handle empty dependencies', () => {
      const configNoDeps = { ...config, dependencies: undefined };
      const agentNoDeps = new TestAgent(configNoDeps);
      expect(agentNoDeps.getDependencies()).toEqual([]);
      expect(agentNoDeps.dependsOn('any-agent')).toBe(false);
    });

    it('should report storage prompt status', () => {
      expect(agent.isUsingStoragePrompts()).toBe(false);
    });
  });

  describe('Reflection Configuration', () => {
    it('should set reflection config', () => {
      agent.setReflectionConfig({
        maxIterations: 5,
        qualityThreshold: 0.8,
        verbose: true,
      });

      // Config is internal, but we can verify through behavior in integration tests
      expect(true).toBe(true); // Verify no error thrown
    });
  });

  describe('Memory Configuration', () => {
    it('should set memory config', () => {
      agent.setMemoryConfig({
        enabled: true,
        contextLimit: 20,
        minImportance: 0.5,
      });

      expect(true).toBe(true); // Verify no error thrown
    });

    it('should enable/disable memory', () => {
      agent.enableMemory(true);
      expect(true).toBe(true); // Verify no error thrown

      agent.enableMemory(false);
      expect(true).toBe(true); // Verify no error thrown
    });
  });

  describe('Auto Feedback Configuration', () => {
    it('should set auto feedback config', () => {
      agent.setAutoFeedbackConfig({
        enabled: true,
        targetLatencyMs: 3000,
        targetOutputTokens: 1500,
      });

      expect(true).toBe(true); // Verify no error thrown
    });
  });

  describe('Template Helpers', () => {
    it('should get template by name', () => {
      const template = agent.testGetTemplate('main');
      expect(template).toBe('Process: {{message}}');
    });

    it('should throw for unknown template', () => {
      expect(() => agent.testGetTemplate('unknown')).toThrow(
        "Template 'unknown' not found for agent test-agent"
      );
    });

    it('should fill template with values', () => {
      const result = agent.testFillTemplate('Hello {{name}}, count is {{count}}', {
        name: 'World',
        count: 42,
      });
      expect(result).toBe('Hello World, count is 42');
    });

    it('should fill template with object values as JSON', () => {
      const result = agent.testFillTemplate('Data: {{data}}', {
        data: { key: 'value' },
      });
      expect(result).toContain('"key": "value"');
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const result = agent.testFillTemplate('{{x}} + {{x}} = 2{{x}}', {
        x: 'Y',
      });
      expect(result).toBe('Y + Y = 2Y');
    });
  });

  describe('Response Parsing', () => {
    it('should parse clean JSON response', () => {
      const response: ModelResponse = {
        content: '{"result": "success", "processed": true}',
        usage: { input: 0, output: 0, total: 0 },
      };

      const parsed = agent.testParseResponse(response);
      expect(parsed).toEqual({ result: 'success', processed: true });
    });

    it('should parse JSON with markdown code block', () => {
      const response: ModelResponse = {
        content: '```json\n{"result": "success", "processed": true}\n```',
        usage: { input: 0, output: 0, total: 0 },
      };

      const parsed = agent.testParseResponse(response);
      expect(parsed).toEqual({ result: 'success', processed: true });
    });

    it('should parse JSON with plain code block', () => {
      const response: ModelResponse = {
        content: '```\n{"result": "success", "processed": true}\n```',
        usage: { input: 0, output: 0, total: 0 },
      };

      const parsed = agent.testParseResponse(response);
      expect(parsed).toEqual({ result: 'success', processed: true });
    });

    it('should parse JSON with surrounding text', () => {
      const response: ModelResponse = {
        content: 'Here is the result:\n{"result": "success", "processed": true}\nDone.',
        usage: { input: 0, output: 0, total: 0 },
      };

      const parsed = agent.testParseResponse(response);
      expect(parsed).toEqual({ result: 'success', processed: true });
    });

    it('should parse JSON array', () => {
      const response: ModelResponse = {
        content: '[{"id": 1}, {"id": 2}]',
        usage: { input: 0, output: 0, total: 0 },
      };

      const parsed = agent.testParseResponse(response);
      expect(parsed).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should handle nested JSON', () => {
      const response: ModelResponse = {
        content: '{"outer": {"inner": {"deep": "value"}}}',
        usage: { input: 0, output: 0, total: 0 },
      };

      const parsed = agent.testParseResponse(response);
      expect(parsed).toEqual({ outer: { inner: { deep: 'value' } } });
    });

    it('should throw for non-JSON content', () => {
      const response: ModelResponse = {
        content: 'This is just plain text without any JSON',
        usage: { input: 0, output: 0, total: 0 },
      };

      expect(() => agent.testParseResponse(response)).toThrow(
        /Failed to parse AI response as JSON/
      );
    });
  });

  describe('Initialization', () => {
    it('should initialize model client', async () => {
      const result = await agent.initialize();
      expect(result).toBe(false); // No storage prompts by default
    });

    it('should not re-initialize if already initialized', async () => {
      await agent.initialize();
      const result = await agent.initialize();
      expect(result).toBe(false);
    });
  });

  describe('Execution', () => {
    it('should execute successfully with valid input', async () => {
      const mockClient = createMockModelClient({
        content: JSON.stringify({ result: 'processed message', processed: true }),
      });
      agent.mockModelClient = mockClient;

      const result = await agent.execute(
        { message: 'test message' },
        { workflow: { sessionId: 'test-session' } }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'processed message', processed: true });
      expect(result.metadata.agentId).toBe('test-agent');
      expect(result.metadata.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail with invalid input', async () => {
      const result = await agent.execute(
        { message: '' } as TestInput, // Empty message should fail validation
        { workflow: { sessionId: 'test-session' } }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should fail when model returns invalid output', async () => {
      const mockClient = createMockModelClient({
        content: JSON.stringify({ invalid: 'structure' }),
      });
      agent.mockModelClient = mockClient;

      const result = await agent.execute(
        { message: 'test' },
        { workflow: { sessionId: 'test-session' } }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Output validation failed');
    });

    it('should track token usage', async () => {
      const mockClient = createMockModelClient({
        content: JSON.stringify({ result: 'test', processed: true }),
        usage: { input: 200, output: 100, total: 300 },
      });
      agent.mockModelClient = mockClient;

      const result = await agent.execute(
        { message: 'test' },
        { workflow: { sessionId: 'test-session' } }
      );

      expect(result.success).toBe(true);
      expect(result.metadata.tokenUsage).toEqual({
        input: 200,
        output: 100,
        total: 300,
      });
    });
  });

  describe('Execute with Media', () => {
    it('should execute with media input', async () => {
      const mockClient = createMockModelClient({
        content: JSON.stringify({ result: 'analyzed image', processed: true }),
      });
      agent.mockModelClient = mockClient;

      const result = await agent.executeWithMedia(
        { message: 'analyze this' },
        { workflow: { sessionId: 'test-session' } },
        [{ data: 'base64-image-data', mimeType: 'image/png' }]
      );

      expect(result.success).toBe(true);
      expect(result.data?.result).toBe('analyzed image');

      // Verify generate was called with images
      expect(mockClient.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          images: [{ data: 'base64-image-data', mimeType: 'image/png' }],
        })
      );
    });
  });
});

describe('JSON Parsing Edge Cases', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent(createTestConfig());
  });

  it('should handle whitespace around JSON', () => {
    const response = {
      content: '   \n  {"result": "test", "processed": true}  \n   ',
      usage: { input: 0, output: 0, total: 0 },
    };

    const parsed = agent.testParseResponse(response);
    expect(parsed).toEqual({ result: 'test', processed: true });
  });

  it('should handle escaped characters in JSON strings', () => {
    const response = {
      content: '{"result": "test with \\"quotes\\" and \\\\backslash", "processed": true}',
      usage: { input: 0, output: 0, total: 0 },
    };

    const parsed = agent.testParseResponse(response);
    expect(parsed).toEqual({
      result: 'test with "quotes" and \\backslash',
      processed: true,
    });
  });

  it('should handle unicode in JSON', () => {
    const response = {
      content: '{"result": "한국어 테스트", "processed": true}',
      usage: { input: 0, output: 0, total: 0 },
    };

    const parsed = agent.testParseResponse(response);
    expect(parsed).toEqual({ result: '한국어 테스트', processed: true });
  });

  it('should handle numbers in JSON', () => {
    const response = {
      content: '{"count": 42, "price": 19.99, "negative": -5}',
      usage: { input: 0, output: 0, total: 0 },
    };

    const parsed = agent.testParseResponse(response);
    expect(parsed).toEqual({ count: 42, price: 19.99, negative: -5 });
  });

  it('should handle boolean and null values', () => {
    const response = {
      content: '{"active": true, "deleted": false, "data": null}',
      usage: { input: 0, output: 0, total: 0 },
    };

    const parsed = agent.testParseResponse(response);
    expect(parsed).toEqual({ active: true, deleted: false, data: null });
  });
});
