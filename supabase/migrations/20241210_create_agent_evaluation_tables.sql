-- =============================================================================
-- Agent Evaluation System Tables
-- =============================================================================
-- Creates tables for agent prompt management, execution logging, and evaluation
--
-- Tables:
-- 1. agent_prompts - Store agent prompts with versioning
-- 2. agent_prompt_history - Version history for prompt rollback
-- 3. agent_executions - Log all agent executions
-- 4. agent_feedback - LLM-as-Judge and user feedback
-- 5. agent_test_cases - Regression test cases
-- 6. agent_test_runs - Test execution results
-- =============================================================================

-- =============================================================================
-- 1. Agent Prompts Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('analyzer', 'creator', 'transformer', 'publisher', 'compose')),
  system_prompt TEXT NOT NULL,
  templates JSONB NOT NULL DEFAULT '{}',
  model_provider TEXT NOT NULL CHECK (model_provider IN ('gemini', 'openai')) DEFAULT 'gemini',
  model_name TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  model_options JSONB NOT NULL DEFAULT '{"temperature": 0.7}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_prompts_agent_id ON agent_prompts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_prompts_category ON agent_prompts(category);
CREATE INDEX IF NOT EXISTS idx_agent_prompts_is_active ON agent_prompts(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access (service role bypasses RLS)
CREATE POLICY "Allow authenticated access to agent_prompts" ON agent_prompts
  FOR ALL USING (true);

COMMENT ON TABLE agent_prompts IS 'Stores agent prompts with versioning support';
COMMENT ON COLUMN agent_prompts.agent_id IS 'Unique identifier matching agent code (e.g., vision-analyzer)';
COMMENT ON COLUMN agent_prompts.version IS 'Prompt version number, incremented on each update';

-- =============================================================================
-- 2. Agent Prompt History Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_prompt_id UUID NOT NULL REFERENCES agent_prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  templates JSONB NOT NULL DEFAULT '{}',
  model_options JSONB NOT NULL DEFAULT '{}',
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_prompt_history_prompt_id ON agent_prompt_history(agent_prompt_id);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_history_version ON agent_prompt_history(agent_prompt_id, version DESC);

-- Enable RLS
ALTER TABLE agent_prompt_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to agent_prompt_history" ON agent_prompt_history
  FOR ALL USING (true);

COMMENT ON TABLE agent_prompt_history IS 'Version history for prompt rollback support';

-- =============================================================================
-- 3. Agent Executions Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  session_id TEXT,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')) DEFAULT 'running',
  error_message TEXT,
  prompt_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_session_id ON agent_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_campaign_id ON agent_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_date ON agent_executions(agent_id, created_at DESC);

-- Enable RLS
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access
CREATE POLICY "Allow authenticated access to agent_executions" ON agent_executions
  FOR ALL USING (true);

COMMENT ON TABLE agent_executions IS 'Logs all agent execution runs with performance metrics';
COMMENT ON COLUMN agent_executions.latency_ms IS 'Execution time in milliseconds';
COMMENT ON COLUMN agent_executions.prompt_version IS 'Version of prompt used for this execution';

-- =============================================================================
-- 4. Agent Feedback Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES agent_executions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('user', 'llm_judge', 'automated')),
  overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 5),
  relevance_score INTEGER CHECK (relevance_score >= 1 AND relevance_score <= 5),
  quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
  creativity_score INTEGER CHECK (creativity_score >= 1 AND creativity_score <= 5),
  feedback_text TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  suggestions TEXT[],
  judge_model TEXT,
  raw_evaluation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_feedback_execution_id ON agent_feedback(execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent_id ON agent_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_type ON agent_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_created_at ON agent_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to agent_feedback" ON agent_feedback
  FOR ALL USING (true);

COMMENT ON TABLE agent_feedback IS 'Stores LLM-as-Judge and user feedback for agent outputs';
COMMENT ON COLUMN agent_feedback.feedback_type IS 'Source: user (manual), llm_judge (automated), automated (rule-based)';

-- =============================================================================
-- 5. Agent Test Cases Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  input JSONB NOT NULL,
  expected_criteria JSONB NOT NULL DEFAULT '{}',
  min_overall_score INTEGER NOT NULL DEFAULT 3 CHECK (min_overall_score >= 1 AND min_overall_score <= 5),
  min_relevance_score INTEGER NOT NULL DEFAULT 3 CHECK (min_relevance_score >= 1 AND min_relevance_score <= 5),
  min_quality_score INTEGER NOT NULL DEFAULT 3 CHECK (min_quality_score >= 1 AND min_quality_score <= 5),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_test_cases_agent_id ON agent_test_cases(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_cases_priority ON agent_test_cases(priority);
CREATE INDEX IF NOT EXISTS idx_agent_test_cases_is_active ON agent_test_cases(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE agent_test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to agent_test_cases" ON agent_test_cases
  FOR ALL USING (true);

COMMENT ON TABLE agent_test_cases IS 'Regression test cases for agent quality assurance';
COMMENT ON COLUMN agent_test_cases.expected_criteria IS 'Custom criteria for LLM-as-Judge evaluation';

-- =============================================================================
-- 6. Agent Test Runs Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES agent_test_cases(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  actual_output JSONB,
  overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 5),
  relevance_score INTEGER CHECK (relevance_score >= 1 AND relevance_score <= 5),
  quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
  evaluation_notes TEXT,
  failures TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_test_runs_test_case_id ON agent_test_runs(test_case_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_runs_agent_id ON agent_test_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_runs_prompt_version ON agent_test_runs(agent_id, prompt_version);
CREATE INDEX IF NOT EXISTS idx_agent_test_runs_passed ON agent_test_runs(passed);
CREATE INDEX IF NOT EXISTS idx_agent_test_runs_created_at ON agent_test_runs(created_at DESC);

-- Enable RLS
ALTER TABLE agent_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to agent_test_runs" ON agent_test_runs
  FOR ALL USING (true);

COMMENT ON TABLE agent_test_runs IS 'Records test execution results for regression tracking';
COMMENT ON COLUMN agent_test_runs.prompt_version IS 'Version of prompt tested for A/B comparison';

-- =============================================================================
-- Seed Data: Default Agent Prompts (Optional)
-- =============================================================================
-- You can uncomment and customize these to seed initial prompts

-- INSERT INTO agent_prompts (agent_id, name, description, category, system_prompt, templates, model_provider, model_name)
-- VALUES (
--   'video-recreation-idea',
--   'Video Recreation Idea Agent',
--   'Generates creative video recreation ideas based on viral content analysis',
--   'creator',
--   'You are a creative director specializing in short-form video content...',
--   '{"idea_template": "Generate 3 video ideas for {{brand}}"}',
--   'gemini',
--   'gemini-2.5-flash'
-- ) ON CONFLICT (agent_id) DO NOTHING;
