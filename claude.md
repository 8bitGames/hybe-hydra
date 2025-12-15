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

## 🚨 Do Not Modify Backend Locally

Do not modify the `backend/` folder locally. Edit directly on EC2 server.

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

Agent prompts are managed in DB (`agent_prompts` table). Do not modify in code.

---

## Other Rules

- DB operations → Use Supabase MCP tools
- Library docs → Check Context7 MCP
- `npm run dev/build` → Do not run without permission
- AI model changes → Do not change without permission
