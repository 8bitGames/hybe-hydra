-- Update creation_sessions constraints to allow Fast Cut stages
-- This migration fixes the CHECK constraints that only allowed AI Video stages

-- 1. Drop old current_stage CHECK constraint and add new one with Fast Cut stages
ALTER TABLE creation_sessions
DROP CONSTRAINT IF EXISTS creation_sessions_current_stage_check;

ALTER TABLE creation_sessions
ADD CONSTRAINT creation_sessions_current_stage_check
CHECK (current_stage IN (
  'start',
  'analyze', 'create', 'processing', 'publish',  -- AI Video stages
  'script', 'images', 'music', 'effects', 'render'  -- Fast Cut stages
));

-- 2. Drop old completed_stages constraint and add new one with Fast Cut stages
ALTER TABLE creation_sessions
DROP CONSTRAINT IF EXISTS valid_completed_stages;

ALTER TABLE creation_sessions
ADD CONSTRAINT valid_completed_stages
CHECK (
  completed_stages <@ ARRAY[
    'start',
    'analyze', 'create', 'processing', 'publish',  -- AI Video stages
    'script', 'images', 'music', 'effects', 'render'  -- Fast Cut stages
  ]
);

-- Update column comment
COMMENT ON COLUMN creation_sessions.current_stage IS 'Current workflow stage: AI Video (start, analyze, create, processing, publish) or Fast Cut (start, script, images, music, effects, render)';
