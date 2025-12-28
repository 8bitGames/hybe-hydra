---
name: create-agent
description: Create a new AI agent for the Hybe Hydra platform. Use when adding new AI capabilities, extending the agent system, or when user says "create agent", "new agent", "add agent".
---

# Create Agent Skill

Create a new AI agent following the Hybe Hydra agent architecture pattern.

## When to Use

- User requests: "create new agent", "add agent", "build agent"
- Need to add new AI capabilities
- Extending the agent system with new functionality

## Step-by-Step Process

### Step 1: Define Input/Output Schemas

Create Zod schemas for type-safe input/output validation:

```typescript
import { z } from 'zod';

export const MyAgentInputSchema = z.object({
  content: z.string(),
  context: z.object({
    artistName: z.string(),
    platform: z.enum(['tiktok', 'instagram', 'youtube'])
  })
});

export const MyAgentOutputSchema = z.object({
  result: z.string(),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string())
});

export type MyAgentInput = z.infer<typeof MyAgentInputSchema>;
export type MyAgentOutput = z.infer<typeof MyAgentOutputSchema>;
```

### Step 2: Create Agent Config

```typescript
import type { AgentConfig } from '../types';

const SYSTEM_PROMPT = `You are an expert at [task description].

## Your Role
- [Primary responsibility]
- [Secondary responsibility]

## Output Format
Return a JSON object with the following structure:
{
  "result": "...",
  "confidence": 0.0-1.0,
  "suggestions": ["..."]
}`;

const MAIN_TEMPLATE = `## Context
Artist: {{artistName}}
Platform: {{platform}}

## Content to Analyze
{{content}}

## Instructions
[Specific instructions for this task]`;

export const MyAgentConfig: AgentConfig<MyAgentInput, MyAgentOutput> = {
  id: 'my-agent',
  name: 'My Agent',
  description: 'Analyzes content and provides suggestions',
  category: 'analyzer', // analyzer | creator | transformer | publisher | fast-cut
  prompts: {
    system: SYSTEM_PROMPT,
    templates: { main: MAIN_TEMPLATE }
  },
  model: {
    provider: 'gemini',
    name: 'gemini-3-flash-preview',
    options: { temperature: 0.7, maxTokens: 4096 }
  },
  inputSchema: MyAgentInputSchema,
  outputSchema: MyAgentOutputSchema
};
```

### Step 3: Create Agent Class

```typescript
import { BaseAgent } from '../base-agent';
import type { AgentContext } from '../types';

export class MyAgent extends BaseAgent<MyAgentInput, MyAgentOutput> {
  constructor() {
    super(MyAgentConfig);
  }

  protected buildPrompt(input: MyAgentInput, context: AgentContext): string {
    return this.fillTemplate(this.getTemplate('main'), {
      artistName: context.workflow.artistName,
      platform: context.workflow.platform,
      content: input.content
    });
  }
}

// Factory function for easy instantiation
export function createMyAgent(): MyAgent {
  return new MyAgent();
}
```

### Step 4: Register in Seed API

Add to `app/api/v1/admin/prompts/seed/route.ts`:

```typescript
import { MyAgentConfig } from '@/lib/agents/{category}/my-agent';

const AGENT_CONFIGS = [
  // ... existing configs
  MyAgentConfig,
];
```

### Step 5: Sync to Database

```bash
POST /api/v1/admin/prompts/seed
```

## Model Selection Guide

| Use Case | Provider | Model | Why |
|----------|----------|-------|-----|
| Vision/Image Analysis | gemini | gemini-2.5-flash-preview | Fast, vision capable |
| Strategic Thinking | gemini | gemini-3-pro | Deep reasoning |
| User-facing Text | openai | gpt-5.1 | High quality text |
| Fast Analysis | gemini | gemini-3-flash-preview | Speed optimized |

## File Location Convention

```
lib/agents/
├── analyzers/     # Vision, text, trend analysis
├── creators/      # Script, content, idea generation
├── transformers/  # Prompt optimization, format conversion
├── publishers/    # Caption, SEO, publishing optimization
├── fast-cut/      # Fast-cut video workflow agents
└── deep-analysis/ # Deep account/video analysis
```

## Common Patterns

### With Vision Capabilities

```typescript
// Use executeWithImages for image/video analysis
const result = await agent.executeWithImages(input, context, [
  { data: base64Image, mimeType: 'image/jpeg' }
]);
```

### With Memory

```typescript
// Enable memory for learning patterns
agent.enableMemory(true);
agent.setMemoryConfig({
  memoryTypes: ['preference', 'pattern'],
  autoLearn: true
});
```

### With Reflection (Self-Improvement)

```typescript
// Use reflection for quality-critical outputs
const result = await agent.executeWithReflection(input, context, {
  maxIterations: 3,
  qualityThreshold: 0.8
});
```

## Validation Checklist

- [ ] Input/Output schemas defined with Zod
- [ ] Config exported with proper typing
- [ ] Agent class extends BaseAgent
- [ ] buildPrompt method implemented
- [ ] Registered in seed API
- [ ] Synced to database
- [ ] Factory function exported
