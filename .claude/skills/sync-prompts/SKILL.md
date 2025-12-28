---
name: sync-prompts
description: Sync agent prompts from code to database. Use when prompts have been modified in code, when deploying prompt updates, or when user says "sync prompts", "update prompts", "refresh prompts".
---

# Sync Prompts Skill

Synchronize AI agent prompts from source code to the database for production use.

## When to Use

- Modified agent prompts in `lib/agents/**/*.ts`
- Need to update production prompt configurations
- User says "sync prompts", "update prompts", "push prompts to DB"
- After creating a new agent

## Sync Workflow

### 1. Make Code Changes

Edit prompts in the agent config files:

```typescript
// lib/agents/creators/script-writer.ts
const SYSTEM_PROMPT = `You are an expert TikTok script writer...
// Updated prompt content
`;
```

### 2. Choose Sync Mode

| Mode | Command | Behavior |
|------|---------|----------|
| **Sync** | `POST /api/v1/admin/prompts/sync?mode=sync` | Updates all, increments version |
| **Seed** | `POST /api/v1/admin/prompts/seed` | Adds missing only, no updates |

### 3. Execute Sync

```bash
# Full sync - updates all agents, increments versions
curl -X POST "https://your-domain/api/v1/admin/prompts/sync?mode=sync" \
  -H "Authorization: Bearer $TOKEN"

# Seed only - adds new agents, doesn't update existing
curl -X POST "https://your-domain/api/v1/admin/prompts/seed" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Verify Changes

Check the Admin UI at `/admin/prompts` or query directly:

```sql
SELECT id, name, version, updated_at
FROM agent_prompts
ORDER BY updated_at DESC
LIMIT 10;
```

## API Reference

### Sync Endpoint

```typescript
POST /api/v1/admin/prompts/sync?mode=sync

Response:
{
  "success": true,
  "synced": [
    { "id": "script-writer", "version": 3, "action": "updated" },
    { "id": "new-agent", "version": 1, "action": "created" }
  ]
}
```

### Seed Endpoint

```typescript
POST /api/v1/admin/prompts/seed

Response:
{
  "success": true,
  "seeded": ["new-agent-1", "new-agent-2"],
  "skipped": ["existing-agent"]
}
```

### List Prompts

```typescript
GET /api/v1/admin/prompts

Response:
{
  "prompts": [
    {
      "id": "script-writer",
      "name": "Script Writer",
      "version": 3,
      "model_provider": "gemini",
      "model_name": "gemini-3-flash-preview"
    }
  ]
}
```

## Database Schema

```sql
CREATE TABLE agent_prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  system_prompt TEXT NOT NULL,
  templates JSONB,
  model_provider TEXT,
  model_name TEXT,
  model_options JSONB,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Troubleshooting

### Prompt Not Updating

1. Check agent is registered in seed route:
   ```typescript
   // app/api/v1/admin/prompts/seed/route.ts
   const AGENT_CONFIGS = [..., YourAgentConfig];
   ```

2. Verify config export:
   ```typescript
   export const YourAgentConfig: AgentConfig = { ... };
   ```

3. Check for TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

### Version Mismatch

If code and DB versions diverge:

```sql
-- Check current version
SELECT id, version FROM agent_prompts WHERE id = 'your-agent';

-- Force reset if needed
UPDATE agent_prompts SET version = 1 WHERE id = 'your-agent';
```

### Sync Fails

Check API logs:
```bash
# View Next.js server logs
npm run dev

# Or check Vercel logs
vercel logs
```

## Best Practices

1. **Always sync after code changes** - Don't leave code/DB out of sync
2. **Use seed for new agents** - Prevents accidental overwrites
3. **Check version numbers** - Verify version incremented after sync
4. **Test locally first** - Sync to dev DB before production
5. **Backup before major changes** - Export prompts before big updates

## Related Commands

```bash
# Export current prompts
GET /api/v1/admin/prompts/export

# Import prompts
POST /api/v1/admin/prompts/import

# Get specific agent prompt
GET /api/v1/admin/prompts/:agentId
```
