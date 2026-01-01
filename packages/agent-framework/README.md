# @anthropic/agent-framework

A reusable AI agent framework for building intelligent, self-improving agents with multi-provider model support.

## Features

- **Multi-Provider Support**: Gemini, OpenAI, Anthropic, and custom model providers
- **Zod Validation**: Type-safe input/output validation with automatic schema enforcement
- **Reflection Pattern**: Self-improvement through iterative refinement
- **Streaming Support**: Real-time response streaming for better UX
- **Extensible Storage**: Adapter interfaces for prompts, memory, and logging
- **JSON Repair**: Automatic repair of malformed AI responses

## Installation

```bash
npm install @anthropic/agent-framework zod
```

## Quick Start

```typescript
import { BaseAgent, AgentConfig } from '@anthropic/agent-framework';
import { z } from 'zod';

// Define input/output schemas
const inputSchema = z.object({
  topic: z.string(),
  style: z.enum(['formal', 'casual']),
});

const outputSchema = z.object({
  content: z.string(),
  summary: z.string(),
});

type MyInput = z.infer<typeof inputSchema>;
type MyOutput = z.infer<typeof outputSchema>;

// Create agent configuration
const config: AgentConfig<MyInput, MyOutput> = {
  id: 'content-writer',
  name: 'Content Writer',
  description: 'Writes content on any topic',
  category: 'writer',
  model: {
    provider: 'gemini',
    name: 'gemini-2.0-flash',
    options: { temperature: 0.7 },
  },
  prompts: {
    system: 'You are a professional content writer...',
    templates: {
      main: 'Write about {{topic}} in a {{style}} tone.',
    },
  },
  inputSchema,
  outputSchema,
};

// Implement the agent
class ContentWriter extends BaseAgent<MyInput, MyOutput> {
  constructor() {
    super(config);
  }

  protected buildPrompt(input: MyInput): string {
    return this.config.prompts.templates.main
      .replace('{{topic}}', input.topic)
      .replace('{{style}}', input.style);
  }

  protected createModelClient(): IModelClient {
    // Return your model client implementation
    return new GeminiClient({ model: this.config.model.name });
  }
}

// Use the agent
const agent = new ContentWriter();
const result = await agent.execute(
  { topic: 'AI agents', style: 'formal' },
  { workflow: {} }
);

if (result.success) {
  console.log(result.data);
}
```

## Advanced Features

### Reflection (Self-Improvement)

```typescript
const result = await agent.executeWithReflection(
  input,
  context,
  {
    maxIterations: 3,
    qualityThreshold: 0.8,
    evaluationAspects: ['quality', 'accuracy', 'completeness'],
  }
);

console.log(`Improved over ${result.totalIterations} iterations`);
console.log(`Score improvement: ${result.scoreImprovement}`);
```

### Streaming

```typescript
for await (const chunk of agent.executeStream(input, context)) {
  if (chunk.done) {
    console.log('Final result:', chunk);
  } else {
    process.stdout.write(chunk.content);
  }
}
```

### Media Input (Images/Videos)

```typescript
const result = await agent.executeWithMedia(
  input,
  context,
  {
    images: [{ data: base64Image, mimeType: 'image/png' }],
    videos: [{ data: base64Video, mimeType: 'video/mp4' }],
  }
);
```

### Custom Storage Adapters

```typescript
import { IPromptStorageAdapter, IMemoryStorageAdapter } from '@anthropic/agent-framework/adapters';

class SupabasePromptAdapter implements IPromptStorageAdapter {
  async loadPrompt(agentId: string) {
    // Load from Supabase
    const { data } = await supabase
      .from('agent_prompts')
      .select('*')
      .eq('agent_id', agentId)
      .single();
    return data;
  }
}

// Use in agent
class MyAgent extends BaseAgent<I, O> {
  private promptAdapter = new SupabasePromptAdapter();

  protected async loadPromptFromStorage() {
    return this.promptAdapter.loadPrompt(this.config.id);
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Your Application                     │
├─────────────────────────────────────────────────────────┤
│                    Agent Framework                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  BaseAgent  │  │   Types     │  │    Adapters     │  │
│  │  - execute  │  │  - Config   │  │  - Prompts      │  │
│  │  - stream   │  │  - Result   │  │  - Memory       │  │
│  │  - reflect  │  │  - Memory   │  │  - Logging      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   IModelClient                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │  Gemini  │  │  OpenAI  │  │Anthropic │  │ Custom  │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Type Exports

```typescript
// Core types
import type {
  AgentConfig,
  AgentResult,
  AgentContext,
  TokenUsage,
  ModelConfig,
} from '@anthropic/agent-framework';

// Model types
import type {
  IModelClient,
  ModelResponse,
  GenerateOptions,
  MediaInput,
} from '@anthropic/agent-framework/models';

// Adapter types
import type {
  IPromptStorageAdapter,
  IMemoryStorageAdapter,
  IExecutionLogAdapter,
  IStorageAdapter,
} from '@anthropic/agent-framework/adapters';
```

## License

MIT
