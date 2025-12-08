-- Agent Memories Table
-- Stores learned patterns, preferences, and context for cross-session learning

CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  artist_name TEXT,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'pattern', 'feedback', 'context', 'style', 'performance')),
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  importance FLOAT NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Unique constraint to prevent duplicate memories
  UNIQUE (agent_id, campaign_id, key)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_campaign_id ON agent_memories(campaign_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_artist_name ON agent_memories(artist_name);
CREATE INDEX IF NOT EXISTS idx_agent_memories_memory_type ON agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_importance ON agent_memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_expires_at ON agent_memories(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (can access all memories for now)
CREATE POLICY "Allow authenticated access to agent_memories" ON agent_memories
  FOR ALL USING (true);

COMMENT ON TABLE agent_memories IS 'Stores agent learning data for cross-session memory and personalization';
COMMENT ON COLUMN agent_memories.memory_type IS 'Type: preference, pattern, feedback, context, style, performance';
COMMENT ON COLUMN agent_memories.importance IS 'Priority score 0-1, higher values are more important';
COMMENT ON COLUMN agent_memories.access_count IS 'Number of times this memory has been accessed';
