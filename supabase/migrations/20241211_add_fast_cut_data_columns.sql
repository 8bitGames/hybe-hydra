-- Add Fast Cut stage data columns to creation_sessions table
-- These columns store the data for Fast Cut workflow stages

-- Script stage data
ALTER TABLE creation_sessions
ADD COLUMN IF NOT EXISTS script_data JSONB;

-- Images stage data
ALTER TABLE creation_sessions
ADD COLUMN IF NOT EXISTS images_data JSONB;

-- Music stage data
ALTER TABLE creation_sessions
ADD COLUMN IF NOT EXISTS music_data JSONB;

-- Effects stage data
ALTER TABLE creation_sessions
ADD COLUMN IF NOT EXISTS effects_data JSONB;

-- Render stage data
ALTER TABLE creation_sessions
ADD COLUMN IF NOT EXISTS render_data JSONB;

-- Add comments for documentation
COMMENT ON COLUMN creation_sessions.script_data IS 'Fast Cut script stage data (prompt, keywords, scriptData, tiktokSEO, etc.)';
COMMENT ON COLUMN creation_sessions.images_data IS 'Fast Cut images stage data (imageCandidates, selectedImages, generationId)';
COMMENT ON COLUMN creation_sessions.music_data IS 'Fast Cut music stage data (audioMatches, selectedAudio, audioStartTime, audioAnalysis)';
COMMENT ON COLUMN creation_sessions.effects_data IS 'Fast Cut effects stage data (styleSetId, styleSets)';
COMMENT ON COLUMN creation_sessions.render_data IS 'Fast Cut render stage data (renderedVideoUrl, thumbnailUrl, renderStatus)';
