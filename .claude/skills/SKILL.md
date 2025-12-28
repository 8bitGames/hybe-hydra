---
name: hybe-hydra-skills
description: Collection of skills for the Hybe Hydra AI content generation platform. Use these skills for agent creation, prompt management, fast-cut video workflows, backend deployment, and database operations.
---

# Hybe Hydra Development Skills

This skill collection provides specialized workflows for the Hybe Hydra platform - an AI-powered TikTok/social media content generation system.

## Quick Reference

| Skill | Trigger | Description |
|-------|---------|-------------|
| create-agent | "create agent", "new agent" | Create a new AI agent with proper structure |
| sync-prompts | "sync prompts", "update prompts" | Sync agent prompts to database |
| deploy-backend | "deploy backend", "update ec2" | Deploy compose-engine to EC2 |
| fast-cut | "fast cut", "quick video" | Fast-cut video generation workflow |
| db-operations | "query db", "supabase query" | Execute Supabase database operations |
| frontend-guide | "create component", "add page" | Frontend/UI development guidelines |
| api-development | "create api", "add endpoint" | API route development guidelines |

---

## Skill: create-agent

### When to Use
- User says "create new agent", "add agent", "build agent"
- Need to add AI capabilities for a new task
- Extending the agent system

### Checklist

1. **Define Agent Config** in `lib/agents/{category}/{agent-name}.ts`
   ```typescript
   export const MyAgentConfig: AgentConfig = {
     id: 'my-agent-id',
     name: 'My Agent Name',
     description: 'What this agent does',
     category: 'analyzer' | 'creator' | 'transformer' | 'publisher' | 'fast-cut',
     prompts: {
       system: SYSTEM_PROMPT,
       templates: { main: MAIN_TEMPLATE }
     },
     model: {
       provider: 'gemini',
       name: 'gemini-3-flash-preview',
       options: { temperature: 0.7 }
     },
     inputSchema: MyInputSchema,
     outputSchema: MyOutputSchema
   };
   ```

2. **Create Agent Class** extending BaseAgent
   ```typescript
   export class MyAgent extends BaseAgent<TInput, TOutput> {
     constructor() {
       super(MyAgentConfig);
     }
     protected buildPrompt(input: TInput, context: AgentContext): string {
       return this.fillTemplate(this.getTemplate('main'), { ...input });
     }
   }
   ```

3. **Register in Seed API** - Add to `app/api/v1/admin/prompts/seed/route.ts`
   ```typescript
   import { MyAgentConfig } from '@/lib/agents/{category}/my-agent';
   const AGENT_CONFIGS = [...existingConfigs, MyAgentConfig];
   ```

4. **Sync to Database**
   ```bash
   POST /api/v1/admin/prompts/seed
   ```

### Model Selection Guide
| Task Type | Provider | Model |
|-----------|----------|-------|
| Vision/Analysis | gemini | gemini-2.5-flash-preview |
| Strategic/Creative | gemini | gemini-3-pro |
| User-facing text | openai | gpt-5.1 |

---

## Skill: sync-prompts

### When to Use
- Modified agent prompts in code
- Need to update production prompts
- User says "sync prompts", "update DB prompts"

### Commands

```bash
# Full sync (updates all agents)
POST /api/v1/admin/prompts/sync?mode=sync

# Seed only (adds missing, doesn't update existing)
POST /api/v1/admin/prompts/seed

# Check current prompts
GET /api/v1/admin/prompts
```

### Workflow
1. Modify prompts in code (`lib/agents/**/*.ts`)
2. Call sync API
3. Verify in Admin UI (`/admin/prompts`)

---

## Skill: deploy-backend

### When to Use
- User explicitly requests backend deployment
- Need to update compose-engine on EC2
- User says "deploy to EC2", "update backend"

### Prerequisites
- User must explicitly request this
- Never modify `backend/` without permission

### Steps

```bash
# 1. SSH to server
ssh hydra-compose

# 2. Navigate to app directory
cd ~/compose-engine

# 3. Pull latest changes
git pull origin main

# 4. Restart service
sudo systemctl restart compose-engine

# 5. Check status
sudo systemctl status compose-engine

# 6. View logs if needed
sudo journalctl -u compose-engine -f --since "5 minutes ago"
```

### Troubleshooting
```bash
# Check Docker containers
docker ps

# View container logs
docker logs hydra-compose-engine-gpu --tail 100

# Restart Docker container
docker restart hydra-compose-engine-gpu
```

---

## Skill: fast-cut

### When to Use
- User wants to create quick video content
- "fast cut", "quick video", "image slideshow"
- Creating TikTok-style content

### Workflow Overview

1. **Script Generation** - AI generates video script from concept
2. **Image Search/Generation** - Find or generate images for each scene
3. **Music Matching** - Find appropriate background music
4. **Effects Selection** - Choose transition effects
5. **Render** - Send to compose-engine for rendering

### Key Files
- `lib/agents/fast-cut/` - Fast-cut agent implementations
- `app/api/v1/fast-cut/` - API endpoints
- `components/features/create/fast-cut/` - UI components

### API Endpoints
```typescript
// Generate script
POST /api/v1/fast-cut/script

// Search images
POST /api/v1/fast-cut/images/search

// Match music
POST /api/v1/fast-cut/music/match

// Render video
POST /api/v1/compose/render
```

---

## Skill: db-query

### When to Use
- Need to query Supabase database
- User says "check database", "query DB"
- Debugging data issues

### Using Supabase MCP

```typescript
// Project ID: nlwufeafadrnesurynom

// List tables
mcp__supabase__list_tables({ project_id: "nlwufeafadrnesurynom" })

// Execute SQL
mcp__supabase__execute_sql({
  project_id: "nlwufeafadrnesurynom",
  query: "SELECT * FROM agent_prompts LIMIT 10"
})

// Apply migration
mcp__supabase__apply_migration({
  project_id: "nlwufeafadrnesurynom",
  name: "add_new_column",
  query: "ALTER TABLE ..."
})
```

### Common Tables
| Table | Description |
|-------|-------------|
| agent_prompts | AI agent prompt configurations |
| generations | Video generation records |
| campaigns | User campaigns |
| trends | TikTok trend data |
| publishing_schedules | Scheduled posts |

---

## Skill: frontend-guide

### When to Use
- Creating new React components
- Adding new pages to dashboard
- Working with UI/styling
- User says "create component", "add page", "frontend"

### Tech Stack
- **Next.js 14+** - App Router, Server Components
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library (CVA + Radix UI)
- **Zustand** - State management
- **React Query** - Data fetching
- **lucide-react** - Icons

### Key Patterns

```typescript
// Always use cn() for class merging
import { cn } from "@/lib/utils";
<div className={cn("base", isActive && "active", className)} />

// Always use i18n for user-facing text
import { useI18n } from "@/lib/i18n";
const { t } = useI18n();
<h1>{t.myFeature.title}</h1>

// Use CVA for component variants
const variants = cva("base", { variants: { size: { sm, lg } } });
```

### Directory Structure
```
components/
├── ui/          # shadcn/ui components
├── features/    # Feature-specific components
├── shared/      # Reusable components
└── layout/      # Layout components
```

---

## Skill: api-development

### When to Use
- Creating new API endpoints
- Handling HTTP requests
- Database operations via API
- User says "create api", "add endpoint"

### Route Handler Pattern

```typescript
// app/api/v1/my-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await fetchData(session.user.id);
  return NextResponse.json({ data });
}
```

### Key Rules
- Always check authentication
- Use proper error status codes (400, 401, 403, 404, 500)
- Log errors with route identifier: `console.error("[ROUTE_METHOD]", error)`
- Validate input before processing

### Common Patterns
```typescript
// Dynamic route
// app/api/v1/campaigns/[id]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}

// Supabase query
const supabase = await createClient();
const { data, error } = await supabase.from("table").select("*");
```

---

## Critical Rules

### AI API Usage (NEVER VIOLATE)
| Task | Service | Package |
|------|---------|---------|
| Image/Video | Vertex AI | `@google-cloud/vertexai` |
| Text (LLM) | Google AI Studio | `@google/genai` |

### Agent System
- All AI calls MUST go through Agent System (`lib/agents/`)
- Never call AI APIs directly
- All prompts managed in database

### Backend Rules
- Do NOT modify `backend/` without explicit permission
- Always confirm before deploying to EC2

---

## Examples

### Create New Analyzer Agent
```
User: "Create an agent that analyzes video thumbnails"
Action: Use create-agent skill
- Category: analyzer
- Model: gemini-2.5-flash-preview (vision capable)
- Input: image data + context
- Output: thumbnail analysis schema
```

### Update Agent Prompt
```
User: "Update the script generator prompt to be more creative"
Action:
1. Edit lib/agents/fast-cut/script-generator.ts
2. Run: POST /api/v1/admin/prompts/sync?mode=sync
3. Verify in /admin/prompts
```

### Debug Generation Issue
```
User: "Why is my video generation failing?"
Action: Use db-query skill
1. Query generations table for error status
2. Check agent_executions for detailed logs
3. Review compose-engine logs if needed
```
