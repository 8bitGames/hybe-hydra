-- Creation Sessions Table
-- Stores video creation workflow sessions with full stage data persistence

CREATE TABLE IF NOT EXISTS creation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Session Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'paused', 'completed', 'abandoned')),
  current_stage TEXT NOT NULL DEFAULT 'start'
    CHECK (current_stage IN ('start', 'analyze', 'create', 'processing', 'publish')),
  completed_stages TEXT[] DEFAULT '{}',

  -- Stage Data (JSONB for flexibility)
  start_data JSONB,
  analyze_data JSONB,
  create_data JSONB,
  processing_data JSONB,
  publish_data JSONB,

  -- Metadata
  entry_source TEXT CHECK (entry_source IN ('trends', 'video', 'idea')),
  content_type TEXT CHECK (content_type IN ('ai_video', 'fast-cut')),
  total_generations INTEGER DEFAULT 0,
  approved_videos INTEGER DEFAULT 0,
  title TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_completed_stages CHECK (
    completed_stages <@ ARRAY['start', 'analyze', 'create', 'processing', 'publish']
  )
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_creation_sessions_user_status
  ON creation_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_creation_sessions_user_updated
  ON creation_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_creation_sessions_campaign
  ON creation_sessions(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creation_sessions_status
  ON creation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_creation_sessions_expires
  ON creation_sessions(expires_at) WHERE expires_at IS NOT NULL;

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_creation_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_creation_session_timestamp ON creation_sessions;
CREATE TRIGGER trigger_creation_session_timestamp
  BEFORE UPDATE ON creation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_creation_session_timestamp();

-- Note: RLS disabled because project uses custom auth (public.users) instead of auth.users
-- If RLS is needed, implement custom policies based on application auth

-- Function to cleanup expired sessions (called by cron or edge function)
CREATE OR REPLACE FUNCTION cleanup_expired_creation_sessions()
RETURNS void AS $$
BEGIN
  -- Draft sessions: 7 days -> abandoned
  UPDATE creation_sessions
  SET status = 'abandoned',
      expires_at = NOW() + INTERVAL '30 days'
  WHERE status = 'draft'
    AND updated_at < NOW() - INTERVAL '7 days';

  -- In progress sessions: 30 days inactive -> paused
  UPDATE creation_sessions
  SET status = 'paused'
  WHERE status = 'in_progress'
    AND updated_at < NOW() - INTERVAL '30 days';

  -- Paused sessions: 90 days -> abandoned
  UPDATE creation_sessions
  SET status = 'abandoned',
      expires_at = NOW() + INTERVAL '30 days'
  WHERE status = 'paused'
    AND updated_at < NOW() - INTERVAL '90 days';

  -- Abandoned sessions: delete after expires_at
  DELETE FROM creation_sessions
  WHERE status = 'abandoned'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE creation_sessions IS 'Stores video creation workflow sessions with full stage data';
COMMENT ON COLUMN creation_sessions.status IS 'Session status: draft, in_progress, paused, completed, abandoned';
COMMENT ON COLUMN creation_sessions.current_stage IS 'Current workflow stage: start, analyze, create, processing, publish';
COMMENT ON COLUMN creation_sessions.completed_stages IS 'Array of completed stage names';
COMMENT ON COLUMN creation_sessions.start_data IS 'Start stage data (source, contentType, hashtags, etc.)';
COMMENT ON COLUMN creation_sessions.analyze_data IS 'Analyze stage data (campaignId, userIdea, selectedIdea, etc.)';
COMMENT ON COLUMN creation_sessions.create_data IS 'Create stage data (generations, selectedGenerations, pipelineStatus)';
COMMENT ON COLUMN creation_sessions.processing_data IS 'Processing stage data (videos, selectedVideos, filters)';
COMMENT ON COLUMN creation_sessions.publish_data IS 'Publish stage data (scheduledPosts, platforms, caption)';
