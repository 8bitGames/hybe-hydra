# Agent Framework Migration Guide

## Overview

This guide explains how to migrate existing hybe-hydra agents to the new `@hybe/agent-framework` package.

## Architecture Comparison

### Old System (lib/agents/)
```typescript
// Fixed context type
export abstract class BaseAgent<TInput, TOutput> {
  // Built-in Supabase integration
  // Built-in memory (remember/recall/forget)
  // Built-in execution logging
}
```

### New Framework (packages/agent-framework/)
```typescript
// Generic context type - more flexible
export abstract class BaseAgent<TInput, TOutput, TContext extends BaseAgentContext> {
  // Extensible via override methods
  // Modular client adapters
  // Clean separation of concerns
}
```

## Key Differences

| Feature | Old System | New Framework |
|---------|------------|---------------|
| Context | Fixed `AgentContext` | Generic `TContext extends BaseAgentContext` |
| Model Client | Internal creation | Abstract `createModelClient()` |
| Prompt Loading | Built-in Supabase | Override `loadPromptFromStorage()` |
| Memory | Built-in methods | Override `getMemoryContextForPrompt()` |
| Logging | Built-in DB logging | Override `logExecutionStart/Complete/Error()` |
| Learning | Built-in patterns | Override `storeLearnedPatterns()` |

## Migration Steps

### Step 1: Define Project Context Type

Create a project-specific context that extends `BaseAgentContext`:

```typescript
// lib/agents-v2/types.ts
import type { BaseAgentContext, BaseWorkflowMetadata } from '@hybe/agent-framework';

// Extend workflow metadata with project-specific fields
export interface HybeWorkflowMetadata extends BaseWorkflowMetadata {
  campaignId?: string;
  artistName?: string;
  platform?: 'tiktok' | 'instagram' | 'youtube';
  genre?: string;
}

// Extend context with project-specific sections
export interface HybeAgentContext extends BaseAgentContext<HybeWorkflowMetadata> {
  discover?: {
    contentStrategy?: ContentStrategy;
    trendAnalysis?: TrendAnalysis;
  };
  analyze?: {
    visionAnalysis?: VisionAnalysis;
    captionAnalysis?: CaptionAnalysis;
  };
  create?: {
    creativeIdeas?: CreativeIdea[];
    generatedContent?: GeneratedContent;
  };
}
```

### Step 2: Create Project Base Agent

Create a base agent with project-specific integrations:

```typescript
// lib/agents-v2/base/hybe-base-agent.ts
import { BaseAgent, GeminiClient, OpenAIClient } from '@hybe/agent-framework';
import type { IModelClient, DatabasePrompt } from '@hybe/agent-framework';
import { createClient } from '@supabase/supabase-js';
import type { HybeAgentContext } from '../types';

export abstract class HybeBaseAgent<TInput, TOutput>
  extends BaseAgent<TInput, TOutput, HybeAgentContext> {

  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Implement abstract method
  protected createModelClient(): IModelClient {
    const { provider, name, options } = this.config.model;

    if (provider === 'gemini') {
      return new GeminiClient(name, options);
    }
    if (provider === 'openai') {
      return new OpenAIClient(name, options);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // Override for DB prompt loading
  protected async loadPromptFromStorage(): Promise<DatabasePrompt | null> {
    const { data } = await this.supabase
      .from('agent_prompts')
      .select('*')
      .eq('agent_id', this.config.id)
      .eq('is_active', true)
      .single();

    return data;
  }

  // Override for memory context
  protected async getMemoryContextForPrompt(context: HybeAgentContext): Promise<string> {
    const { data: memories } = await this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', this.config.id)
      .eq('scope_id', context.workflow.campaignId)
      .order('importance', { ascending: false })
      .limit(10);

    if (!memories?.length) return '';

    return `## Learned Patterns\n${memories.map(m => `- ${m.key}: ${JSON.stringify(m.value)}`).join('\n')}`;
  }

  // Override for execution logging
  protected async logExecutionStart(input: TInput, context: HybeAgentContext): Promise<string> {
    const { data } = await this.supabase
      .from('agent_execution_logs')
      .insert({
        agent_id: this.config.id,
        session_id: context.workflow.sessionId,
        campaign_id: context.workflow.campaignId,
        status: 'running',
        input_summary: JSON.stringify(input).slice(0, 500),
      })
      .select('id')
      .single();

    return data?.id || null;
  }

  protected async logExecutionComplete(
    executionId: string,
    result: AgentResult<TOutput>,
    output: Record<string, unknown>
  ): Promise<void> {
    await this.supabase
      .from('agent_execution_logs')
      .update({
        status: 'completed',
        output_summary: JSON.stringify(output).slice(0, 1000),
        token_usage: result.metadata.tokenUsage,
        latency_ms: result.metadata.latencyMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId);
  }

  // Memory helper methods (optional - for backward compatibility)
  async remember(key: string, value: Record<string, unknown>, context: HybeAgentContext): Promise<void> {
    await this.supabase
      .from('agent_memories')
      .upsert({
        agent_id: this.config.id,
        scope_id: context.workflow.campaignId,
        key,
        value,
        importance: 0.5,
        memory_type: 'pattern',
      });
  }

  async recall(context: HybeAgentContext, limit = 10): Promise<AgentMemory[]> {
    const { data } = await this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', this.config.id)
      .eq('scope_id', context.workflow.campaignId)
      .order('importance', { ascending: false })
      .limit(limit);

    return data || [];
  }
}
```

### Step 3: Migrate Individual Agents

Example: Migrating VisionAnalyzerAgent

**Before (Old System):**
```typescript
// lib/agents/analyzers/vision-analyzer.ts
import { BaseAgent } from '../base-agent';

export class VisionAnalyzerAgent extends BaseAgent<Input, Output> {
  constructor() {
    super(VisionAnalyzerConfig);
  }

  protected buildPrompt(input: Input, context: AgentContext): string {
    const template = this.getTemplate('image');
    return this.fillTemplate(template, { ... });
  }
}
```

**After (New Framework):**
```typescript
// lib/agents-v2/analyzers/vision-analyzer.ts
import { HybeBaseAgent } from '../base/hybe-base-agent';
import type { HybeAgentContext } from '../types';

export class VisionAnalyzerAgent extends HybeBaseAgent<Input, Output> {
  constructor() {
    super(VisionAnalyzerConfig);
  }

  protected buildPrompt(input: Input, context: HybeAgentContext): string {
    const template = this.getTemplate('image');
    return this.fillTemplate(template, {
      artistName: context.workflow.artistName,
      platform: context.workflow.platform,
      // ... other values
    });
  }
}
```

### Step 4: Update Import Paths

```typescript
// Before
import { BaseAgent } from '@/lib/agents/base-agent';
import type { AgentConfig, AgentContext } from '@/lib/agents/types';

// After
import { HybeBaseAgent } from '@/lib/agents-v2/base/hybe-base-agent';
import type { HybeAgentContext } from '@/lib/agents-v2/types';
// Or for framework types:
import type { AgentConfig, TokenUsage } from '@hybe/agent-framework';
```

## Gradual Migration Strategy

1. **Phase 1: Setup** (Done)
   - Created agent-framework package
   - Defined base types and interfaces

2. **Phase 2: Project Integration** (Current)
   - Create HybeBaseAgent extending framework BaseAgent
   - Define HybeAgentContext with project-specific fields
   - Implement Supabase integrations as overrides

3. **Phase 3: Agent Migration**
   - Migrate agents one by one
   - Start with simpler agents (VisionAnalyzer)
   - Progress to complex agents (CreativeDirector)

4. **Phase 4: Cleanup**
   - Remove old lib/agents/ once all migrated
   - Update all import paths
   - Update documentation

## Backward Compatibility

The new framework is designed for gradual migration:

- Old agents continue to work unchanged
- New agents can be added using the framework
- Memory helpers (remember/recall) can be added as methods on HybeBaseAgent
- Both systems can coexist during migration

## Testing Migration

```typescript
// Test that migrated agent produces same output
describe('VisionAnalyzerAgent Migration', () => {
  it('should produce equivalent output', async () => {
    const oldAgent = new OldVisionAnalyzerAgent();
    const newAgent = new NewVisionAnalyzerAgent();

    const input = { mediaUrl: 'https://...', mediaType: 'image' };
    const context = createTestContext();

    const oldResult = await oldAgent.execute(input, context);
    const newResult = await newAgent.execute(input, context);

    expect(newResult.data).toMatchObject(oldResult.data);
  });
});
```

## Common Migration Issues

### 1. Context Type Mismatch
```typescript
// Error: Type 'BaseAgentContext' is not assignable to 'HybeAgentContext'
// Fix: Ensure context has all required fields
const context: HybeAgentContext = {
  workflow: {
    sessionId: 'test',
    campaignId: '123',    // Required for Hybe
    artistName: 'Artist', // Required for Hybe
  },
  discover: {},
  analyze: {},
  create: {},
};
```

### 2. Missing createModelClient()
```typescript
// Error: Non-abstract class must implement abstract member 'createModelClient'
// Fix: Implement in your project base agent (see HybeBaseAgent example)
```

### 3. Memory Methods Not Found
```typescript
// Error: Property 'remember' does not exist
// Fix: Add memory helper methods to your project base agent
```

## Framework Extensibility

The new framework supports custom extensions:

```typescript
// Custom model client
class AnthropicClient implements IModelClient {
  async generate(options: GenerateOptions): Promise<ModelResponse> { ... }
}

// Custom storage adapter
class PostgresStorageAdapter implements IPromptStorage {
  async loadPrompt(agentId: string): Promise<DatabasePrompt | null> { ... }
}

// Custom memory provider
class RedisMemoryProvider implements IMemoryProvider {
  async remember(key: string, value: unknown): Promise<void> { ... }
  async recall(query: MemoryQuery): Promise<AgentMemory[]> { ... }
}
```
