---
name: db-operations
description: Supabase database operations for Hybe Hydra. Use for querying data, debugging issues, checking records, or when user says "query database", "check DB", "supabase query".
---

# Database Operations Skill

Execute Supabase database operations for the Hybe Hydra platform.

## Project Configuration

| Setting | Value |
|---------|-------|
| Project ID | `nlwufeafadrnesurynom` |
| Region | Asia (Singapore) |
| Provider | Supabase |

## When to Use

- User says: "query database", "check DB", "look up record"
- Debugging data issues
- Verifying data integrity
- Checking agent execution logs

## Using Supabase MCP Tools

### List Tables

```typescript
mcp__supabase__list_tables({
  project_id: "nlwufeafadrnesurynom",
  schemas: ["public"]
})
```

### Execute SQL Query

```typescript
mcp__supabase__execute_sql({
  project_id: "nlwufeafadrnesurynom",
  query: "SELECT * FROM generations WHERE status = 'failed' LIMIT 10"
})
```

### Apply Migration

```typescript
mcp__supabase__apply_migration({
  project_id: "nlwufeafadrnesurynom",
  name: "add_new_column",
  query: "ALTER TABLE generations ADD COLUMN retry_count INTEGER DEFAULT 0"
})
```

## Key Tables Reference

### Agent System

| Table | Description |
|-------|-------------|
| `agent_prompts` | AI agent prompt configurations |
| `agent_executions` | Agent execution logs |
| `agent_feedback` | User feedback on agent outputs |
| `agent_test_cases` | Test cases for agent evaluation |
| `agent_memories` | Agent memory storage |

### Content Generation

| Table | Description |
|-------|-------------|
| `generations` | Video/image generation records |
| `campaigns` | User campaigns |
| `campaign_assets` | Assets linked to campaigns |
| `quick_creations` | Quick create session data |

### Trends & Analysis

| Table | Description |
|-------|-------------|
| `trends` | TikTok trend data |
| `trend_keywords` | Saved trend keywords |
| `deep_analysis` | Deep account analysis results |

### Publishing

| Table | Description |
|-------|-------------|
| `publishing_accounts` | Connected social accounts |
| `publishing_schedules` | Scheduled posts |
| `publishing_analytics` | Post performance data |

## Common Queries

### Check Failed Generations

```sql
SELECT id, campaign_id, status, error_message, created_at
FROM generations
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

### View Agent Execution History

```sql
SELECT
  ae.id,
  ae.agent_id,
  ae.status,
  ae.latency_ms,
  ae.total_tokens,
  ae.created_at
FROM agent_executions ae
WHERE ae.agent_id = 'script-writer'
ORDER BY ae.created_at DESC
LIMIT 20;
```

### Check Agent Prompt Versions

```sql
SELECT id, name, version, model_name, updated_at
FROM agent_prompts
ORDER BY updated_at DESC;
```

### Find Campaign Data

```sql
SELECT
  c.id,
  c.name,
  c.artist_name,
  COUNT(g.id) as generation_count
FROM campaigns c
LEFT JOIN generations g ON g.campaign_id = c.id
WHERE c.user_id = 'user-uuid'
GROUP BY c.id
ORDER BY c.created_at DESC;
```

### Check Publishing Queue

```sql
SELECT
  ps.id,
  ps.platform,
  ps.scheduled_at,
  ps.status,
  g.id as generation_id
FROM publishing_schedules ps
JOIN generations g ON ps.generation_id = g.id
WHERE ps.status = 'pending'
  AND ps.scheduled_at <= NOW() + INTERVAL '1 hour'
ORDER BY ps.scheduled_at;
```

### Agent Performance Metrics

```sql
SELECT
  agent_id,
  COUNT(*) as total_executions,
  AVG(latency_ms) as avg_latency,
  AVG(total_tokens) as avg_tokens,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
FROM agent_executions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_id
ORDER BY total_executions DESC;
```

## Schema Management

### View Table Schema

```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'generations'
ORDER BY ordinal_position;
```

### Add Column

```typescript
mcp__supabase__apply_migration({
  project_id: "nlwufeafadrnesurynom",
  name: "add_retry_count_to_generations",
  query: `
    ALTER TABLE generations
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
  `
})
```

### Add Index

```typescript
mcp__supabase__apply_migration({
  project_id: "nlwufeafadrnesurynom",
  name: "add_status_index_to_generations",
  query: `
    CREATE INDEX IF NOT EXISTS idx_generations_status
    ON generations(status);
  `
})
```

## Row Level Security (RLS)

Most tables have RLS enabled. Queries through API will respect user permissions. For admin operations, use service role key.

### Check RLS Policies

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'generations';
```

## Troubleshooting

### Query Timeout

For large datasets, add limits:
```sql
SELECT * FROM generations LIMIT 100;
```

### Permission Denied

Check if RLS is blocking:
```sql
-- Temporarily disable RLS (admin only)
ALTER TABLE generations DISABLE ROW LEVEL SECURITY;
-- Run query
-- Re-enable
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
```

### Connection Issues

Verify project status:
```typescript
mcp__supabase__get_project({
  id: "nlwufeafadrnesurynom"
})
```

## Best Practices

1. **Always use LIMIT** - Prevent large result sets
2. **Use parameterized queries** - Avoid SQL injection
3. **Check indexes** - For frequently queried columns
4. **Monitor query performance** - Use EXPLAIN ANALYZE
5. **Use migrations** - For schema changes (not raw ALTER)
