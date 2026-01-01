/**
 * ContentAnalyzerAgent Tests
 * Tests for the example agent implementation
 */

import { describe, it, expect } from 'vitest';
import {
  ContentAnalyzerInputSchema,
  ContentAnalyzerOutputSchema,
  ContentAnalyzerAgentConfig,
  createContentAnalyzerContext,
  createContentAnalyzerAgent,
} from '../src/examples/content-analyzer-agent';

describe('ContentAnalyzerAgent', () => {
  describe('Input Schema', () => {
    it('should validate valid input', () => {
      const input = {
        content: 'This is some text to analyze.',
        focusAreas: ['topics', 'sentiment'],
        maxSummaryLength: 200,
      };

      const result = ContentAnalyzerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require content field', () => {
      const input = {
        focusAreas: ['topics'],
      };

      const result = ContentAnalyzerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const input = {
        content: '',
      };

      const result = ContentAnalyzerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject content exceeding max length', () => {
      const input = {
        content: 'x'.repeat(50001),
      };

      const result = ContentAnalyzerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate focus areas enum', () => {
      const input = {
        content: 'Test content',
        focusAreas: ['topics', 'sentiment', 'keywords', 'summary', 'entities'],
      };

      const result = ContentAnalyzerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid focus areas', () => {
      const input = {
        content: 'Test content',
        focusAreas: ['invalid_area'],
      };

      const result = ContentAnalyzerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate maxSummaryLength range', () => {
      // Valid range
      expect(
        ContentAnalyzerInputSchema.safeParse({
          content: 'Test',
          maxSummaryLength: 50,
        }).success
      ).toBe(true);

      expect(
        ContentAnalyzerInputSchema.safeParse({
          content: 'Test',
          maxSummaryLength: 500,
        }).success
      ).toBe(true);

      // Invalid - too low
      expect(
        ContentAnalyzerInputSchema.safeParse({
          content: 'Test',
          maxSummaryLength: 49,
        }).success
      ).toBe(false);

      // Invalid - too high
      expect(
        ContentAnalyzerInputSchema.safeParse({
          content: 'Test',
          maxSummaryLength: 501,
        }).success
      ).toBe(false);
    });

    it('should allow optional fields to be omitted', () => {
      const input = {
        content: 'Just the content',
      };

      const result = ContentAnalyzerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('Output Schema', () => {
    it('should validate complete output', () => {
      const output = {
        topics: [
          { name: 'Technology', confidence: 0.9, mentions: 5 },
          { name: 'AI', confidence: 0.8 },
        ],
        sentiment: {
          overall: 'positive',
          score: 0.7,
          aspects: [
            { aspect: 'usability', sentiment: 'positive', score: 0.8 },
          ],
        },
        keywords: [
          { keyword: 'machine learning', relevance: 0.95, frequency: 3 },
        ],
        summary: 'A brief summary of the content.',
        entities: [
          { name: 'OpenAI', type: 'organization', context: 'AI company' },
        ],
        metadata: {
          wordCount: 150,
          characterCount: 850,
          languageDetected: 'en',
        },
      };

      const result = ContentAnalyzerOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should require all main fields except entities', () => {
      const minimalOutput = {
        topics: [],
        sentiment: { overall: 'neutral', score: 0 },
        keywords: [],
        summary: '',
        metadata: { wordCount: 0, characterCount: 0 },
      };

      const result = ContentAnalyzerOutputSchema.safeParse(minimalOutput);
      expect(result.success).toBe(true);
    });

    it('should validate sentiment enum values', () => {
      const validSentiments = ['positive', 'negative', 'neutral', 'mixed'];

      validSentiments.forEach((sentiment) => {
        const output = {
          topics: [],
          sentiment: { overall: sentiment, score: 0 },
          keywords: [],
          summary: '',
          metadata: { wordCount: 0, characterCount: 0 },
        };

        expect(ContentAnalyzerOutputSchema.safeParse(output).success).toBe(true);
      });
    });

    it('should validate entity types', () => {
      const validTypes = ['person', 'organization', 'location', 'date', 'product', 'event', 'other'];

      validTypes.forEach((type) => {
        const output = {
          topics: [],
          sentiment: { overall: 'neutral', score: 0 },
          keywords: [],
          summary: '',
          entities: [{ name: 'Test', type }],
          metadata: { wordCount: 0, characterCount: 0 },
        };

        expect(ContentAnalyzerOutputSchema.safeParse(output).success).toBe(true);
      });
    });

    it('should validate confidence score range (0-1)', () => {
      // Valid
      expect(
        ContentAnalyzerOutputSchema.safeParse({
          topics: [{ name: 'Test', confidence: 0 }],
          sentiment: { overall: 'neutral', score: 0 },
          keywords: [],
          summary: '',
          metadata: { wordCount: 0, characterCount: 0 },
        }).success
      ).toBe(true);

      expect(
        ContentAnalyzerOutputSchema.safeParse({
          topics: [{ name: 'Test', confidence: 1 }],
          sentiment: { overall: 'neutral', score: 0 },
          keywords: [],
          summary: '',
          metadata: { wordCount: 0, characterCount: 0 },
        }).success
      ).toBe(true);

      // Invalid - out of range
      expect(
        ContentAnalyzerOutputSchema.safeParse({
          topics: [{ name: 'Test', confidence: 1.1 }],
          sentiment: { overall: 'neutral', score: 0 },
          keywords: [],
          summary: '',
          metadata: { wordCount: 0, characterCount: 0 },
        }).success
      ).toBe(false);
    });

    it('should validate sentiment score range (-1 to 1)', () => {
      // Valid edges
      expect(
        ContentAnalyzerOutputSchema.safeParse({
          topics: [],
          sentiment: { overall: 'negative', score: -1 },
          keywords: [],
          summary: '',
          metadata: { wordCount: 0, characterCount: 0 },
        }).success
      ).toBe(true);

      expect(
        ContentAnalyzerOutputSchema.safeParse({
          topics: [],
          sentiment: { overall: 'positive', score: 1 },
          keywords: [],
          summary: '',
          metadata: { wordCount: 0, characterCount: 0 },
        }).success
      ).toBe(true);

      // Invalid
      expect(
        ContentAnalyzerOutputSchema.safeParse({
          topics: [],
          sentiment: { overall: 'positive', score: 1.5 },
          keywords: [],
          summary: '',
          metadata: { wordCount: 0, characterCount: 0 },
        }).success
      ).toBe(false);
    });
  });

  describe('Context Creation', () => {
    it('should create context with default workflow', () => {
      const context = createContentAnalyzerContext();

      expect(context.workflow).toBeDefined();
      expect(context.workflow.sessionId).toMatch(/^analyze-\d+$/);
    });

    it('should allow overriding workflow', () => {
      const context = createContentAnalyzerContext({
        workflow: { sessionId: 'custom-session' },
      });

      expect(context.workflow.sessionId).toBe('custom-session');
    });

    it('should accept additional context properties', () => {
      const context = createContentAnalyzerContext({
        requestId: 'req-123',
        language: 'ko',
        domain: 'tech',
        additionalInstructions: 'Focus on technical terms',
      });

      expect(context.requestId).toBe('req-123');
      expect(context.language).toBe('ko');
      expect(context.domain).toBe('tech');
      expect(context.additionalInstructions).toBe('Focus on technical terms');
    });
  });

  describe('Agent Configuration', () => {
    it('should have valid default configuration', () => {
      expect(ContentAnalyzerAgentConfig.id).toBe('content-analyzer');
      expect(ContentAnalyzerAgentConfig.name).toBe('Content Analyzer Agent');
      expect(ContentAnalyzerAgentConfig.category).toBe('analyzer');
    });

    it('should have model configuration', () => {
      expect(ContentAnalyzerAgentConfig.model.provider).toBe('gemini');
      expect(ContentAnalyzerAgentConfig.model.name).toBe('gemini-2.0-flash');
      expect(ContentAnalyzerAgentConfig.model.options?.temperature).toBe(0.3);
    });

    it('should have prompts defined', () => {
      expect(ContentAnalyzerAgentConfig.prompts.system).toBeDefined();
      expect(ContentAnalyzerAgentConfig.prompts.system.length).toBeGreaterThan(0);
      expect(ContentAnalyzerAgentConfig.prompts.templates.analysis).toBeDefined();
    });

    it('should have valid schemas', () => {
      expect(ContentAnalyzerAgentConfig.inputSchema).toBe(ContentAnalyzerInputSchema);
      expect(ContentAnalyzerAgentConfig.outputSchema).toBe(ContentAnalyzerOutputSchema);
    });
  });

  describe('Factory Function', () => {
    it('should create agent with default options', () => {
      const agent = createContentAnalyzerAgent();

      expect(agent).toBeDefined();
      expect(agent.getConfig().id).toBe('content-analyzer');
    });

    it('should create agent with custom provider', () => {
      const agent = createContentAnalyzerAgent({ provider: 'openai' });

      expect(agent.getConfig().model.provider).toBe('openai');
    });

    it('should create agent with custom model', () => {
      const agent = createContentAnalyzerAgent({ model: 'gemini-2.5-pro' });

      expect(agent.getConfig().model.name).toBe('gemini-2.5-pro');
    });

    it('should create agent with custom temperature', () => {
      const agent = createContentAnalyzerAgent({ temperature: 0.5 });

      expect(agent.getConfig().model.options?.temperature).toBe(0.5);
    });

    it('should create agent with custom maxTokens', () => {
      const agent = createContentAnalyzerAgent({ maxTokens: 8192 });

      expect(agent.getConfig().model.options?.maxTokens).toBe(8192);
    });

    it('should create agent with combined options', () => {
      const agent = createContentAnalyzerAgent({
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxTokens: 2048,
      });

      const config = agent.getConfig();
      expect(config.model.provider).toBe('openai');
      expect(config.model.name).toBe('gpt-4o-mini');
      expect(config.model.options?.temperature).toBe(0.8);
      expect(config.model.options?.maxTokens).toBe(2048);
    });
  });
});
