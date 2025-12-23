# Claude Rules

## 🚨 AI API Usage Rules (Never Violate)

| Task | Service | Package |
|------|---------|---------|
| Image/Video | Vertex AI | `@google-cloud/vertexai` + GCP Service Account |
| Text (LLM) | Google AI Studio | `@google/genai` + `GOOGLE_AI_API_KEY` |

```typescript
// Image/Video → Vertex AI
import { VertexAI } from '@google-cloud/vertexai';

// Text LLM → Google AI Studio
import { GoogleGenAI } from '@google/genai';
```

---

## 🚨 Backend Modification Rules

By default, do not modify the `backend/` folder locally. However, if the user explicitly requests backend modification, you may modify locally and deploy to EC2.

```bash
ssh hydra-compose          # connect
cd ~/compose-engine/app/   # location
sudo systemctl restart compose-engine  # restart
```

---

## AI Must Use Agent System

All AI calls must go through the Agent System in `lib/agents/`. Direct API calls are prohibited.

```typescript
// ✅ Correct
const agent = createMyAgent();
const result = await agent.execute(input, context);

// ❌ Prohibited: Direct API call
const ai = new GoogleGenAI({ apiKey });
await ai.models.generateContent(...);
```

---

## 🚨 Agent Prompt Management Rules

**All agent prompts MUST be managed in DB (`agent_prompts` table).**

### New Agent Checklist

1. **Create Config Object** - Export `XxxConfig` in agent file
   ```typescript
   export const MyAgentConfig: AgentConfig = {
     id: 'my-agent',
     name: 'My Agent',
     category: 'analyzer',
     prompts: { system: SYSTEM_PROMPT, templates: { ... } },
     model: { provider: 'gemini', name: 'gemini-3-flash-preview', options: {} }
   };
   ```

2. **Register in Seed API** - Add to `app/api/v1/admin/prompts/seed/route.ts`
   ```typescript
   import { MyAgentConfig } from '@/lib/agents/xxx/my-agent';
   const AGENT_CONFIGS = [..., MyAgentConfig];
   ```

3. **Sync to DB** - Call sync API
   ```bash
   POST /api/v1/admin/prompts/sync?mode=sync
   # or
   POST /api/v1/admin/prompts/seed
   ```

### Prompt Update Workflow

```
Code 수정 → POST /api/v1/admin/prompts/sync → DB 자동 업데이트 (버전++)
```

### Admin UI

- View/Edit prompts: `/admin/prompts`
- Sync status: `/admin/prompts` (Sync 버튼)

---

## Other Rules

- DB operations → Use Supabase MCP tools (Project ID: `nlwufeafadrnesurynom`)
- Library docs → Check Context7 MCP
- `npm run dev/build` → Do not run without permission
- AI model changes → Do not change without permission
