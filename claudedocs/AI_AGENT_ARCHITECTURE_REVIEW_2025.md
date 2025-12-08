# AI Agent Architecture Review & 2025 Technology Analysis

> **Created**: 2025-12-07
> **Status**: Analysis Complete
> **Related**: [AI_AGENT_ARCHITECTURE_PLAN.md](./AI_AGENT_ARCHITECTURE_PLAN.md), [AI_LLM_USAGE_ANALYSIS.md](./AI_LLM_USAGE_ANALYSIS.md)

---

## Executive Summary

본 문서는 HYBE Hydra 프로젝트의 AI Agent 아키텍처 구현 현황을 분석하고, 2025년 최신 AI Agent 기술 동향을 바탕으로 개선 방향을 제시합니다.

### 핵심 결론

1. **구현 완료율**: 계획 대비 ~90% 구현 완료
2. **아키텍처 품질**: 프로덕션 레벨의 견고한 설계
3. **개선 기회**: Reflection Pattern, Streaming, Google ADK 통합 권장

---

## 1. Plan vs Implementation 비교 분석

### 1.1 Core Infrastructure

| 계획된 기능 | 구현 상태 | 파일 위치 | 비고 |
|------------|----------|----------|------|
| BaseAgent 추상 클래스 | ✅ 완료 | `lib/agents/base-agent.ts` | 508 lines |
| Gemini Client | ✅ 완료 | `lib/models/gemini-client.ts` | Vision, Tools 지원 |
| OpenAI Client (GPT-5.1) | ✅ 완료 | `lib/models/openai-client.ts` | reasoningEffort 지원 |
| Workflow Orchestrator | ✅ 완료 | `lib/agents/orchestrator.ts` | 466 lines |
| Input/Output Validation | ✅ 완료 | Zod Schema 기반 | Type-safe |

### 1.2 Prompt Management System

| 계획된 기능 | 구현 상태 | 파일 위치 | 비고 |
|------------|----------|----------|------|
| Database Prompt Loading | ✅ 완료 | `lib/agents/prompt-loader.ts` | 132 lines |
| 5분 In-Memory Cache | ✅ 완료 | `CACHE_TTL_MS = 5 * 60 * 1000` | TTL 기반 |
| Version Tracking | ✅ 완료 | `currentPromptVersion` 필드 | 실행 로그에 기록 |
| Template Merging | ✅ 완료 | DB 우선, hardcoded fallback | 안전한 fallback |
| Preload All Prompts | ✅ 완료 | `preloadAllPrompts()` | 배치 초기화 |
| Prompt History Table | ⚠️ 미확인 | DB 스키마 확인 필요 | 롤백 지원 |

### 1.3 Evaluation & Testing System

| 계획된 기능 | 구현 상태 | 파일 위치 | 비고 |
|------------|----------|----------|------|
| Execution Logging | ✅ 완료 | `lib/agents/evaluation-service.ts` | Non-blocking |
| LLM-as-Judge | ✅ 완료 | `evaluateOutput()` | Gemini 2.5 Flash |
| Multi-dimensional Scoring | ✅ 완료 | Relevance, Quality, Creativity, Overall | 1-5 scale |
| Regression Testing | ✅ 완료 | `runRegressionTests()` | Golden test cases |
| User Feedback | ✅ 완료 | `saveUserFeedback()` | 사용자 피드백 수집 |
| Metrics Aggregation | ✅ 완료 | `getAgentMetrics()` | 날짜 범위 지원 |

### 1.4 Agent Implementation Status

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT IMPLEMENTATION STATUS                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ANALYZERS (4/4)      ████████████████████ 100%                │
│  ├── vision-analyzer      ✅ Gemini 2.5 Flash + Vision         │
│  ├── text-pattern         ✅ Gemini 2.5 Flash                  │
│  ├── visual-trend         ✅ Gemini 2.5 Flash                  │
│  └── strategy-synthesizer ✅ Gemini 2.5 Flash                  │
│                                                                 │
│  CREATORS (2/2)       ████████████████████ 100%                │
│  ├── creative-director    ✅ Gemini 3 Pro (Deep Thinking)      │
│  └── script-writer        ✅ Gemini 2.5 Flash + Search         │
│                                                                 │
│  TRANSFORMERS (2/3)   █████████████░░░░░░░  67%                │
│  ├── prompt-engineer      ✅ Gemini 2.5 Flash                  │
│  ├── i2v-specialist       ✅ Gemini 2.5 Flash                  │
│  └── composition-director ⚠️ Python Only (미이식)              │
│                                                                 │
│  PUBLISHERS (2/2)     ████████████████████ 100%                │
│  ├── publish-optimizer    ✅ GPT-5.1 (reasoningEffort)         │
│  └── copywriter           ✅ GPT-5.1 (Creative Copy)           │
│                                                                 │
│  COMPOSE (3/3)        ████████████████████ 100%                │
│  ├── script-generator     ✅ Gemini 2.5 Flash + Grounding      │
│  ├── effect-analyzer      ✅ Gemini 2.5 Flash                  │
│  └── conductor            ✅ Gemini 2.5 Flash                  │
│                                                                 │
│  ADDITIONAL AGENTS                                              │
│  ├── keyword-insights     ✅ Gemini 3 Pro (TikTok Keywords)    │
│  ├── tiktok-vision        ✅ Gemini 2.5 Flash                  │
│  └── veo3-personalize     ✅ Gemini 2.5 Flash                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5 미구현 / 개선 필요 영역

| 영역 | 상태 | 우선순위 | 권장 조치 |
|------|------|----------|----------|
| Agent Prompt History | ⚠️ 미확인 | High | DB 테이블 확인 및 UI 구현 |
| A/B Testing for Prompts | ❌ 미구현 | Medium | 트래픽 분할 로직 추가 |
| Dynamic Model Switching UI | ⚠️ 부분 | Medium | Admin UI 구현 |
| Composition Director (TS) | ⚠️ Python만 | Low | Python 유지 권장 |
| Real-time Streaming | ❌ 미구현 | High | `generateStream()` 활용 |

---

## 2. 현재 아키텍처 강점 분석

### 2.1 Database-Driven Prompt Management

```typescript
// prompt-loader.ts - 견고한 캐싱 전략
const promptCache = new Map<string, { prompt: DatabasePrompt; loadedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function loadPromptFromDatabase(agentId: string): Promise<DatabasePrompt | null> {
  // 1. Cache check
  const cached = promptCache.get(agentId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.prompt;
  }

  // 2. Database fetch
  const { data } = await supabase
    .from('agent_prompts')
    .select('*')
    .eq('agent_id', agentId)
    .eq('is_active', true)
    .single();

  // 3. Cache update
  promptCache.set(agentId, { prompt: data, loadedAt: Date.now() });
  return data;
}
```

**장점:**
- 프로덕션에서 코드 배포 없이 프롬프트 수정 가능
- 5분 캐시로 DB 부하 최소화
- Fallback 전략으로 안정성 확보

### 2.2 Type-Safe Agent Execution

```typescript
// base-agent.ts - Zod 기반 검증
private validateInput(input: TInput): TInput {
  const result = this.config.inputSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Input validation failed: ${result.error.message}`);
  }
  return result.data;
}

private validateOutput(output: unknown): TOutput {
  const result = this.config.outputSchema.safeParse(output);
  if (!result.success) {
    throw new Error(`Output validation failed: ${result.error.message}`);
  }
  return result.data;
}
```

**장점:**
- 컴파일 타임 타입 안전성
- 런타임 데이터 검증
- LLM 출력 신뢰성 향상

### 2.3 LLM-as-Judge Evaluation System

```typescript
// evaluation-service.ts - 자동화된 품질 평가
const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator for AI agent outputs.

Evaluate on these dimensions (1-5 scale):
1. **Relevance** - How well does output address input requirements?
2. **Quality** - How well-structured and professional?
3. **Creativity** - How creative while staying on-topic?
4. **Overall** - Overall assessment

Return JSON with scores, feedback, strengths, weaknesses, suggestions.`;
```

**장점:**
- 객관적이고 일관된 품질 측정
- Regression testing으로 프롬프트 변경 영향 추적
- 데이터 기반 프롬프트 최적화 가능

### 2.4 Parallel Execution with Retry

```typescript
// orchestrator.ts - 견고한 실행 전략
private async executeAgent(agentId: string, input: Record<string, unknown>): Promise<AgentResult<unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
    try {
      const result = await (agent as any).execute(input, this.context);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt < this.config.maxRetries) {
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  return { success: false, error: lastError?.message };
}
```

**장점:**
- Parallel execution으로 처리량 향상
- Exponential backoff로 일시적 오류 복구
- Stage 단위 에러 격리

---

## 3. 2025 AI Agent 기술 동향

### 3.1 Framework Landscape

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     2025 AI AGENT FRAMEWORK COMPARISON                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Framework       │ Architecture  │ Best For              │ Model Support   │
│  ─────────────────────────────────────────────────────────────────────────│
│  Google ADK      │ Code-first    │ Gemini ecosystem      │ Gemini, Any    │
│  LangGraph       │ Graph-based   │ Complex workflows     │ Any            │
│  CrewAI          │ Role-based    │ Team collaboration    │ Any            │
│  AutoGen         │ Conversation  │ Async multi-agent     │ Any            │
│  PydanticAI      │ Type-safe     │ Python developers     │ Any            │
│  mcp-agent       │ MCP-native    │ Tool integration      │ Any            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────│
│  🏆 RECOMMENDED FOR HYBE HYDRA: Google ADK + Current Architecture          │
│     - Gemini 중심 프로젝트와 완벽 호환                                      │
│     - 현재 TypeScript 아키텍처를 Python ADK로 점진적 마이그레이션 가능      │
│     - Vertex AI Agent Engine으로 프로덕션 스케일링                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Agentic Design Patterns

#### 3.2.1 Reflection Pattern (자기 개선)

```
┌─────────────────────────────────────────────────────────────────┐
│                      REFLECTION PATTERN                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────────┐                                             │
│    │   Input      │                                             │
│    └──────┬───────┘                                             │
│           │                                                     │
│           ▼                                                     │
│    ┌──────────────┐                                             │
│    │  Generator   │ ◄─────────────────────────┐                │
│    │   Agent      │                           │                │
│    └──────┬───────┘                           │                │
│           │                                   │                │
│           ▼                                   │                │
│    ┌──────────────┐     ┌──────────────┐     │                │
│    │   Output     │────►│   Critic     │     │                │
│    │   Draft      │     │   Agent      │     │                │
│    └──────────────┘     └──────┬───────┘     │                │
│                                │              │                │
│                                ▼              │                │
│                         ┌──────────────┐     │                │
│                         │  Feedback    │─────┘                │
│                         │  (if needed) │                       │
│                         └──────────────┘                       │
│                                │                               │
│                                ▼                               │
│                         ┌──────────────┐                       │
│                         │   Final      │                       │
│                         │   Output     │                       │
│                         └──────────────┘                       │
│                                                                 │
│  Benefits:                                                      │
│  • Self-correction loop improves output quality                │
│  • Reduces hallucinations and errors                           │
│  • Can be implemented with same or different LLM               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**구현 권장 코드:**

```typescript
// lib/agents/base-agent.ts 에 추가
protected async executeWithReflection(
  input: TInput,
  context: AgentContext,
  options: {
    maxIterations?: number;
    minScore?: number;
    criticPrompt?: string;
  } = {}
): Promise<AgentResult<TOutput>> {
  const { maxIterations = 2, minScore = 4 } = options;
  let result = await this.execute(input, context);
  let iteration = 0;

  while (result.success && iteration < maxIterations) {
    // Evaluate current output
    const evaluation = await getEvaluationService().evaluateOutput(
      this.config.id,
      input as Record<string, unknown>,
      result.data as Record<string, unknown>
    );

    // Check if quality threshold met
    if (evaluation && evaluation.overall_score >= minScore) {
      break;
    }

    // Inject feedback for self-correction
    const improvedInput = {
      ...input,
      _previousAttempt: result.data,
      _feedback: evaluation?.suggestions || [],
      _weaknesses: evaluation?.weaknesses || []
    };

    result = await this.execute(improvedInput as TInput, context);
    iteration++;
  }

  return result;
}
```

#### 3.2.2 Tool Use Pattern (Function Calling)

현재 Gemini Google Search 도구가 구현되어 있으나, 확장 가능:

```typescript
// 현재 구현
options: {
  tools: [{ type: 'google_search' }],
}

// 확장 권장
options: {
  tools: [
    { type: 'google_search' },
    { type: 'code_execution' },    // 코드 실행
    { type: 'web_browsing' },      // 웹 브라우징
    { type: 'custom', handler: myToolHandler }  // 커스텀 도구
  ],
}
```

#### 3.2.3 Planning Pattern (Multi-step Reasoning)

```
┌─────────────────────────────────────────────────────────────────┐
│                       PLANNING PATTERN                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Complex Task                                                  │
│       │                                                         │
│       ▼                                                         │
│   ┌──────────────┐                                             │
│   │   Planner    │ ──► Subtask 1 ──► Worker Agent 1            │
│   │    LLM       │ ──► Subtask 2 ──► Worker Agent 2            │
│   │              │ ──► Subtask 3 ──► Worker Agent 3            │
│   └──────────────┘                         │                   │
│                                            ▼                   │
│                                    Aggregated Result           │
│                                                                 │
│   현재 Orchestrator가 이 패턴을 부분적으로 구현                  │
│   개선: 동적 서브태스크 생성 추가 권장                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Google ADK (Agent Development Kit)

**출시**: Google Cloud NEXT 2025
**GitHub**: https://github.com/google/adk-python
**문서**: https://google.github.io/adk-docs/

#### 핵심 기능

```python
# Google ADK 예시 (Python)
from google.adk import LlmAgent, SequentialAgent, ParallelAgent

# 단일 Agent
vision_agent = LlmAgent(
    model="gemini-2.5-flash",
    tools=[analyze_image_tool],
    instructions="You are a visual content analyst..."
)

# Sequential Workflow
workflow = SequentialAgent(
    agents=[
        vision_agent,
        text_pattern_agent,
        strategy_agent
    ]
)

# Parallel Execution
parallel_analyzers = ParallelAgent(
    agents=[vision_agent, text_pattern_agent]
)

# 실행
result = await workflow.run(input_data)
```

#### HYBE Hydra와의 통합 전략

```
Phase 1 (단기): 현재 TypeScript 아키텍처 유지
├── Reflection Pattern 추가
├── Streaming 지원 구현
└── Tool Use 확장

Phase 2 (중기): Python compose-engine에 ADK 도입
├── composition-director ADK로 재구현
├── 비디오 처리 파이프라인 ADK 통합
└── Vertex AI Agent Engine 테스트

Phase 3 (장기): Hybrid Architecture
├── TypeScript: 웹 API, 프론트엔드 통합
├── Python ADK: 복잡한 멀티에이전트 워크플로우
└── Vertex AI: 프로덕션 스케일링
```

---

## 4. 구체적 개선 권장 사항

### 4.1 Priority 1: Reflection Loop 도입

**파일**: `lib/agents/base-agent.ts`
**예상 작업량**: 4-6시간

```typescript
/**
 * Execute with self-reflection and improvement loop
 * Uses LLM-as-Judge to evaluate and improve output iteratively
 */
protected async executeWithReflection(
  input: TInput,
  context: AgentContext,
  options: ReflectionOptions = {}
): Promise<AgentResult<TOutput>> {
  const {
    maxIterations = 2,
    minScore = 4,
    earlyStopOnPerfect = true
  } = options;

  let currentResult = await this.execute(input, context);
  let bestResult = currentResult;
  let bestScore = 0;

  for (let i = 0; i < maxIterations && currentResult.success; i++) {
    // Evaluate current output
    const evaluation = await getEvaluationService().evaluateOutput(
      this.config.id,
      input as Record<string, unknown>,
      currentResult.data as Record<string, unknown>
    );

    if (!evaluation) break;

    const currentScore = evaluation.overall_score;

    // Track best result
    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestResult = currentResult;
    }

    // Early stop if perfect or meets threshold
    if (earlyStopOnPerfect && currentScore === 5) break;
    if (currentScore >= minScore) break;

    // Self-improvement with feedback injection
    const feedbackContext: AgentContext = {
      ...context,
      _reflection: {
        iteration: i + 1,
        previousScore: currentScore,
        feedback: evaluation.feedback_text,
        suggestions: evaluation.suggestions,
        weaknesses: evaluation.weaknesses
      }
    };

    currentResult = await this.execute(input, feedbackContext);
  }

  return bestResult;
}

interface ReflectionOptions {
  maxIterations?: number;
  minScore?: number;
  earlyStopOnPerfect?: boolean;
}
```

### 4.2 Priority 2: Streaming 지원

**파일**: `lib/agents/base-agent.ts`, `lib/models/*.ts`
**예상 작업량**: 6-8시간

```typescript
/**
 * Execute with streaming response
 * Yields partial results as they become available
 */
async *executeStream(
  input: TInput,
  context: AgentContext
): AsyncGenerator<StreamChunk<TOutput>, void, unknown> {
  // Auto-initialize from database
  if (!this.isInitialized) {
    await this.initializeFromDatabase();
  }

  const startTime = Date.now();

  try {
    const validatedInput = this.validateInput(input);
    const prompt = this.buildPrompt(validatedInput, context);

    let accumulatedContent = '';

    for await (const chunk of this.modelClient.generateStream({
      system: this.config.prompts.system,
      user: prompt,
      responseFormat: 'json'
    })) {
      accumulatedContent += chunk.content;

      yield {
        type: 'partial',
        content: chunk.content,
        accumulated: accumulatedContent
      };
    }

    // Final validation and parsing
    const parsedOutput = this.parseResponse({ content: accumulatedContent });
    const validatedOutput = this.validateOutput(parsedOutput);

    yield {
      type: 'complete',
      data: validatedOutput,
      metadata: {
        agentId: this.config.id,
        model: this.config.model.name,
        latencyMs: Date.now() - startTime
      }
    };

  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

interface StreamChunk<T> {
  type: 'partial' | 'complete' | 'error';
  content?: string;
  accumulated?: string;
  data?: T;
  metadata?: AgentMetadata;
  error?: string;
}
```

### 4.3 Priority 3: Agent Memory System

**새 파일**: `lib/agents/memory/agent-memory.ts`
**예상 작업량**: 8-12시간

```typescript
/**
 * Agent Memory System
 * Provides short-term (session) and long-term (vector DB) memory
 */

import { createClient } from '@supabase/supabase-js';

export interface AgentMemory {
  shortTerm: ShortTermMemory;
  longTerm: LongTermMemory;
}

export class ShortTermMemory {
  private store: Map<string, { value: unknown; timestamp: number }>;
  private ttlMs: number;

  constructor(ttlMs: number = 30 * 60 * 1000) { // 30 minutes default
    this.store = new Map();
    this.ttlMs = ttlMs;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, { value, timestamp: Date.now() });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  getConversationHistory(): Array<{ role: string; content: string }> {
    return this.get('conversation_history') || [];
  }

  addToConversation(role: string, content: string): void {
    const history = this.getConversationHistory();
    history.push({ role, content });
    // Keep last 20 messages
    if (history.length > 20) history.shift();
    this.set('conversation_history', history);
  }
}

export class LongTermMemory {
  private pinecone: PineconeClient; // or Supabase pgvector

  constructor() {
    // Initialize vector store connection
  }

  async store(
    content: string,
    metadata: Record<string, unknown>,
    namespace: string = 'default'
  ): Promise<string> {
    // Generate embedding and store
    const embedding = await this.generateEmbedding(content);
    const id = await this.pinecone.upsert({
      vectors: [{ id: crypto.randomUUID(), values: embedding, metadata }],
      namespace
    });
    return id;
  }

  async recall(
    query: string,
    topK: number = 5,
    namespace: string = 'default'
  ): Promise<Array<{ content: string; score: number; metadata: Record<string, unknown> }>> {
    const embedding = await this.generateEmbedding(query);
    const results = await this.pinecone.query({
      vector: embedding,
      topK,
      namespace,
      includeMetadata: true
    });
    return results.matches.map(m => ({
      content: m.metadata?.content as string,
      score: m.score,
      metadata: m.metadata || {}
    }));
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use Gemini or OpenAI embedding model
    // Implementation details...
    return [];
  }
}

// Factory function
export function createAgentMemory(sessionId: string): AgentMemory {
  return {
    shortTerm: new ShortTermMemory(),
    longTerm: new LongTermMemory()
  };
}
```

### 4.4 Priority 4: Enhanced Tool System

**파일**: `lib/agents/tools/tool-registry.ts`
**예상 작업량**: 6-8시간

```typescript
/**
 * Agent Tool Registry
 * Manages available tools for agents with MCP compatibility
 */

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown) => Promise<unknown>;
}

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  // Convert to Gemini function declarations
  toGeminiFunctions(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }));
  }

  // Execute tool by name
  async execute(name: string, input: unknown): Promise<unknown> {
    const tool = this.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.handler(input);
  }
}

// Pre-built tools
export const googleSearchTool: AgentTool = {
  name: 'google_search',
  description: 'Search the web for current information',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
  handler: async (input: { query: string }) => {
    // Gemini native search
  }
};

export const codeExecutionTool: AgentTool = {
  name: 'code_execution',
  description: 'Execute Python code safely',
  inputSchema: { type: 'object', properties: { code: { type: 'string' } } },
  handler: async (input: { code: string }) => {
    // Safe code execution
  }
};

export const imageAnalysisTool: AgentTool = {
  name: 'analyze_image',
  description: 'Analyze an image for visual elements',
  inputSchema: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string' },
      analysisType: { type: 'string', enum: ['style', 'content', 'technical'] }
    }
  },
  handler: async (input) => {
    // Use vision-analyzer agent
  }
};
```

---

## 5. 마이그레이션 로드맵

### 5.1 단기 (1-2주)

```
Week 1:
├── [ ] Reflection Pattern 구현 (Priority 1)
├── [ ] 기존 Publisher agents에 Reflection 적용
└── [ ] 단위 테스트 추가

Week 2:
├── [ ] Streaming 지원 구현 (Priority 2)
├── [ ] API 엔드포인트에 SSE 추가
└── [ ] 프론트엔드 스트리밍 UI 구현
```

### 5.2 중기 (1-2개월)

```
Month 1:
├── [ ] Agent Memory System 구현 (Priority 3)
├── [ ] Pinecone/pgvector 통합
├── [ ] 대화형 컨텍스트 유지 기능
└── [ ] 세션 기반 학습 구현

Month 2:
├── [ ] Tool Registry 확장 (Priority 4)
├── [ ] MCP 호환 도구 추가
├── [ ] compose-engine에 Google ADK 도입 검토
└── [ ] A/B Testing 시스템 구현
```

### 5.3 장기 (3-6개월)

```
Quarter 1-2:
├── [ ] Google ADK Python 파일럿
├── [ ] Vertex AI Agent Engine 테스트
├── [ ] Hybrid Architecture 설계
├── [ ] 성능 벤치마킹
└── [ ] 프로덕션 마이그레이션 계획
```

---

## 6. 성능 최적화 권장사항

### 6.1 현재 병목점

| 영역 | 현재 상태 | 최적화 방안 |
|------|----------|-------------|
| DB Prompt Loading | 5분 캐시 | Redis 도입 검토 |
| Parallel Execution | Promise.all | Worker Pool 패턴 |
| LLM Latency | 순차 호출 | Batch API 활용 |
| Token Usage | 개별 추적 | 중앙 집계 시스템 |

### 6.2 권장 캐싱 전략

```typescript
// 다층 캐싱 아키텍처
Layer 1: In-Memory (현재) - 5분 TTL
Layer 2: Redis (권장 추가) - 30분 TTL
Layer 3: Database - 영구 저장

// 캐시 무효화 전략
- 프롬프트 업데이트 시 즉시 무효화
- 버전 기반 캐시 키 사용
- Webhook으로 분산 캐시 동기화
```

---

## 7. 참고 자료

### AI Agent Frameworks
- [Langfuse AI Agent Comparison](https://langfuse.com/blog/2025-03-19-ai-agent-comparison)
- [14 AI Agent Frameworks Compared](https://softcery.com/lab/top-14-ai-agent-frameworks-of-2025-a-founders-guide-to-building-smarter-systems)
- [Best AI Agent Frameworks 2025](https://langwatch.ai/blog/best-ai-agent-frameworks-in-2025-comparing-langgraph-dspy-crewai-agno-and-more)
- [Agentic AI Frameworks Comparison](https://dev.to/hani__8725b7a/agentic-ai-frameworks-comparison-2025-mcp-agent-langgraph-ag2-pydanticai-crewai-h40)

### Agentic Design Patterns
- [DeepLearning.AI - Reflection Pattern](https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-2-reflection/)
- [Zero to One: Learning Agentic Patterns](https://www.philschmid.de/agentic-pattern)
- [4 Agentic AI Design Patterns](https://research.aimultiple.com/agentic-ai-design-patterns/)
- [Reflective Loop Pattern](https://medium.com/@vpatil_80538/reflective-loop-pattern-the-llm-powered-self-improving-ai-architecture-7b41b7eacf69)

### Google ADK
- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [Google ADK GitHub](https://github.com/google/adk-python)
- [Google Developers Blog - ADK](https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/)
- [Vertex AI Agent Builder](https://docs.cloud.google.com/agent-builder/agent-development-kit/overview)

### LLM Agents
- [LLM Agents - SuperAnnotate](https://www.superannotate.com/blog/llm-agents)
- [LLM Agent Architectures](https://futureagi.com/blogs/llm-agent-architectures-core-components)
- [Agentic LLMs in 2025](https://datasciencedojo.com/blog/agentic-llm-in-2025/)

---

## Appendix A: Database Schema Reference

### agent_prompts
```sql
CREATE TABLE agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,  -- 'analyzer' | 'creator' | 'transformer' | 'publisher' | 'compose'
  system_prompt TEXT NOT NULL,
  templates JSONB DEFAULT '{}',
  model_provider VARCHAR(50) NOT NULL,  -- 'gemini' | 'openai'
  model_name VARCHAR(100) NOT NULL,
  model_options JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_prompts_agent_id ON agent_prompts(agent_id);
CREATE INDEX idx_agent_prompts_category ON agent_prompts(category);
```

### agent_executions
```sql
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100),
  campaign_id VARCHAR(100),
  input JSONB NOT NULL,
  output JSONB,
  status VARCHAR(20) NOT NULL,  -- 'running' | 'success' | 'error'
  error_message TEXT,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  prompt_version INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);
CREATE INDEX idx_agent_executions_created_at ON agent_executions(created_at);
```

### agent_feedback
```sql
CREATE TABLE agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES agent_executions(id),
  agent_id VARCHAR(100) NOT NULL,
  feedback_type VARCHAR(20) NOT NULL,  -- 'user' | 'llm_judge' | 'automated'
  overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 5),
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 5),
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5),
  creativity_score INTEGER CHECK (creativity_score BETWEEN 1 AND 5),
  feedback_text TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  suggestions TEXT[],
  judge_model VARCHAR(100),
  raw_evaluation JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_feedback_agent_id ON agent_feedback(agent_id);
CREATE INDEX idx_agent_feedback_type ON agent_feedback(feedback_type);
```

---

*Document generated on 2025-12-07*
*Next review scheduled: 2025-01-07*
