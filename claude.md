# Claude Rules

---

## 🚨 CRITICAL AI USAGE RULES - 절대 위반 금지

> **이 규칙은 모든 상황에서 반드시 지켜야 합니다. 예외 없음.**

### 1. 이미지/동영상 AI → Vertex AI 필수

```
🔴 이미지 생성, 이미지 분석, 동영상 생성/분석 = Vertex AI ONLY
```

- **필수 사용**: `@google-cloud/vertexai` 패키지
- **필수 인증**: GCP 서비스 계정 (JSON 키 파일)
- **금지**: `@google/genai` 패키지로 이미지/동영상 처리

```typescript
// ✅ 올바른 방법: Vertex AI for Image/Video
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION,
});
```

```typescript
// ❌ 금지: 이미지/동영상에 Google AI Studio API 사용
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
// 이미지/동영상 처리 금지!
```

### 2. LLM (텍스트) AI → GOOGLE_AI_API_KEY 필수

```
🔴 텍스트 생성, 텍스트 분석 = GOOGLE_AI_API_KEY ONLY
```

- **필수 사용**: `@google/genai` 패키지
- **필수 환경변수**: `GOOGLE_AI_API_KEY`
- **금지**: Vertex AI로 일반 텍스트 LLM 처리

```typescript
// ✅ 올바른 방법: Google AI Studio for LLM
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY, // 반드시 이 키 사용!
});
```

### 요약 표

| 작업 유형 | 사용할 서비스 | 패키지 | API 키/인증 |
|----------|-------------|--------|------------|
| 이미지 생성 | Vertex AI | `@google-cloud/vertexai` | GCP 서비스 계정 |
| 이미지 분석 | Vertex AI | `@google-cloud/vertexai` | GCP 서비스 계정 |
| 동영상 생성/분석 | Vertex AI | `@google-cloud/vertexai` | GCP 서비스 계정 |
| 텍스트 생성 (LLM) | Google AI Studio | `@google/genai` | `GOOGLE_AI_API_KEY` |
| 텍스트 분석 (LLM) | Google AI Studio | `@google/genai` | `GOOGLE_AI_API_KEY` |

---

## Response Style

- ALWAYS think through problems step-by-step before providing answers
- Break down complex tasks into smaller, manageable steps
- Explain your reasoning process clearly at each stage

## General Restrictions

- Do NOT run `npm run dev` or `npm run build` without explicit user permission
- Do NOT create README or markdown files unless explicitly told to
- Do NOT change AI models (e.g., Gemini model versions) without explicit user permission
- Use only muted colors like black, grey, and white. Never use colors unless explicitly told to for design.

## Database Operations

- ALWAYS use Supabase MCP tools (`mcp__supabase__*`) for database migrations and schema lookups instead of raw SQL files or Drizzle CLI

## Documentation

- ALWAYS check with Context7 MCP tool (`mcp__context7__*`) for library documentation before implementing code

---

## AI Integration - MUST USE AGENT SYSTEM

**CRITICAL**: All AI usage in this project MUST go through the Agent System at `lib/agents/`.
Do NOT use direct AI API calls outside of the agent system.

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

- **Gemini 2.5 Flash**: Analyzers, Transformers (fast analysis) - via `GOOGLE_AI_API_KEY`
- **Gemini 3 Pro**: Creative Director (deep reasoning) - via `GOOGLE_AI_API_KEY`
- **Vertex AI**: Image/Video generation and analysis - via GCP 서비스 계정
- **GPT-5.1**: Publishers (copywriting)

### How to Add New AI Functionality

1. **Create a new agent** extending `BaseAgent`:

```typescript
import { BaseAgent } from '@/lib/agents/base-agent';
import { z } from 'zod';
import type { AgentContext } from '@/lib/agents/types';

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
      category: 'analyzer',
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

### FORBIDDEN - Do NOT do this:

```typescript
// ❌ WRONG: Direct API calls outside agent system
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
const response = await ai.models.generateContent(...);

// ❌ WRONG: Using Google AI API for image/video (must use Vertex AI)
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
// 이미지/동영상 처리 금지!

// ❌ WRONG: Using Vertex AI for text LLM (must use GOOGLE_AI_API_KEY)
import { VertexAI } from '@google-cloud/vertexai';
const vertexAI = new VertexAI({ project, location });
const model = vertexAI.getGenerativeModel({ model: 'gemini-pro' });
await model.generateContent('text prompt'); // LLM은 금지!
```

### Model Clients (internal use in Agent System only)

- `GeminiClient` - for LLM text generation (uses `GOOGLE_AI_API_KEY`)
- `VertexAIClient` - for image/video generation and analysis (uses GCP 서비스 계정)

---

## Environment Variables

```bash
# LLM (텍스트) - Google AI Studio
GOOGLE_AI_API_KEY=your-google-ai-api-key

# Image/Video - Vertex AI
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./path-to-service-account.json
```
