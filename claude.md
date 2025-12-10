# Claude Rules

  ## Response Style
  - ALWAYS think through problems step-by-step before providing answers
  - Break down complex tasks into smaller, manageable steps
  - Explain your reasoning process clearly at each stage

  ## General Restrictions
  - Do NOT run `npm run dev` or `npm run build` without explicit user permission
  - Do NOT create README or markdown files unless explicitly told to
  - Do NOT change AI models (e.g., Gemini model versions) without explicit user permission

  ## Database Operations
  - ALWAYS use Supabase MCP tools (`mcp__supabase__*`) for database migrations and schema lookups instead of raw SQL
  files or Drizzle CLI
  ## Documentation
  - ALWAYS check with Context7 MCP tool (`mcp__context7__*`) for library documentation before implementing code

  ## AI Integration - MUST USE AGENT SYSTEM

  **CRITICAL**: All AI usage in this project MUST go through the Agent System at `lib/agents/`.
  Do NOT use direct AI API calls (GoogleGenAI, OpenAI SDK, etc.) outside of the agent system.

  ### Why Agent System?
  - Centralized prompt management (database-driven prompts)
  - Execution logging and metrics tracking
  - Input/output validation with Zod schemas
  - Model client abstraction (Gemini/OpenAI)
  - Consistent error handling

  ### Agent System Architecture (`lib/agents/`)

  ```
  lib/agents/
  ├── base-agent.ts      # Abstract base class for all agents
  ├── types.ts           # Type definitions
  ├── orchestrator.ts    # Workflow orchestrator
  ├── prompt-loader.ts   # Database prompt loading
  ├── evaluation-service.ts # Execution logging
  ├── analyzers/         # Vision, Text Pattern, Visual Trend, Strategy
  ├── creators/          # Creative Director, Script Writer
  ├── transformers/      # Prompt Engineer, I2V Specialist
  ├── publishers/        # Publish Optimizer, Copywriter
  └── compose/           # Compose-specific agents
  ```

  ### Model Assignments
  - **Gemini 2.5 Flash**: Analyzers, Transformers (fast analysis)
  - **Gemini 3 Pro**: Creative Director (deep reasoning)
  - **GPT-5.1**: Publishers (copywriting)

  ### How to Add New AI Functionality

  1. **Create a new agent** extending `BaseAgent`:
  ```typescript
  import { BaseAgent } from '@/lib/agents/base-agent';
  import { z } from 'zod';
  import type { AgentContext } from '@/lib/agents/types';

  // Define input/output schemas
  export const MyAgentInputSchema = z.object({ /* your fields */ });
  export const MyAgentOutputSchema = z.object({ /* your fields */ });
  export type MyAgentInput = z.infer<typeof MyAgentInputSchema>;
  export type MyAgentOutput = z.infer<typeof MyAgentOutputSchema>;

  export class MyAgent extends BaseAgent<MyAgentInput, MyAgentOutput> {
    constructor() {
      super({
        id: 'my-agent',
        name: 'My Agent',
        description: 'Agent description',
        category: 'analyzer', // or 'creator', 'transformer', 'publisher'
        model: {
          provider: 'gemini',
          name: 'gemini-2.5-flash',
          options: { temperature: 0.7 }
        },
        prompts: {
          system: 'Your system prompt...',
          templates: {}
        },
        inputSchema: MyAgentInputSchema,
        outputSchema: MyAgentOutputSchema,
      });
    }

    protected buildPrompt(input: MyAgentInput, context: AgentContext): string {
      return `Your prompt with ${JSON.stringify(input)}`;
    }
  }

  export function createMyAgent(): MyAgent {
    return new MyAgent();
  }
  ```

  2. **Use the agent**:
  ```typescript
  import { createMyAgent } from '@/lib/agents/my-agent';

  const agent = createMyAgent();
  const result = await agent.execute(input, context);

  if (result.success) {
    console.log(result.data);
  } else {
    console.error(result.error);
  }
  ```

  3. **Or use existing agents via factories**:
  ```typescript
  import { AgentFactories, createOrchestrator } from '@/lib/agents';

  // Single agent
  const visionAgent = await AgentFactories.visionAnalyzer();
  const result = await visionAgent.executeWithImages(input, context, images);

  // Orchestrated workflow
  const orchestrator = createOrchestrator('Artist', 'tiktok', 'ko');
  const result = await orchestrator.runWorkflow('analyze', input);
  ```

  ### FORBIDDEN - Do NOT do this:
  ```typescript
  // ❌ WRONG: Direct API calls outside agent system
  import { GoogleGenAI } from '@google/genai';
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent(...);

  // ❌ WRONG: Direct OpenAI calls outside agent system
  import OpenAI from 'openai';
  const openai = new OpenAI();
  const response = await openai.chat.completions.create(...);
  ```

  ### Model Selection (for reference only - use via Agent System)
  - For image generation: use gemini-3-pro-image-preview
  - For text generation: use gemini-2.5-flash or gemini-flash-lite-latest

  ### Model Clients (internal use in Agent System only)
  If you need to create a new agent, use the model clients from `lib/models/`:
  - `GeminiClient` - for Gemini models
  - `OpenAIClient` - for OpenAI models

  These are already integrated into `BaseAgent` and should not be used directly outside agents.

- use only muted colors like black, grey, and white. never use colors unless i tell you to for design.
