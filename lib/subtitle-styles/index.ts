/**
 * Subtitle Style System - Main Export
 * ====================================
 * Complete style packages for subtitle/lyrics rendering
 */

// Types
export type {
  FontStyleType,
  FontSizeType,
  AnimationType,
  VerticalPositionType,
  SubtitleType,
  SubtitleStyleSet,
  LyricsData,
  LyricsSegment,
  SubtitleEntry,
  StyleSetSelectionResult,
  SubtitleRenderSettings,
  LyricsToSubtitleOptions,
  AudioAssetLyricsMetadata,
} from './types';

// Utility functions
export { styleSetToRenderSettings } from './types';

// Presets
export {
  KARAOKE_SYNC,
  LYRIC_FADE,
  BOLD_LYRICS,
  MINIMAL_CAPTION,
  HOOK_IMPACT,
  STORY_TYPE,
  ALL_SUBTITLE_STYLES,
  SUBTITLE_STYLES_BY_ID,
  getSubtitleStyleById,
  getDefaultLyricsStyle,
  getDefaultCaptionStyle,
  findMatchingStyle,
} from './presets';

// Lyrics Converter
export {
  lyricsToSubtitles,
  getSubtitleRenderSettings,
  generateASSContent,
  mergeOverlappingSubtitles,
  // Render script conversion (for compose engine integration)
  lyricsToRenderScript,
  getScriptFromAssetLyrics,
} from './lyrics-converter';

// Render script types
export type {
  RenderScriptLine,
  RenderScriptData,
  LyricsToRenderScriptOptions,
} from './lyrics-converter';
