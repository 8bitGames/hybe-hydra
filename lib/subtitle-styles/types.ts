/**
 * Subtitle Style Sets - Type Definitions
 * =======================================
 * Complete style packages for consistent subtitle/lyrics rendering
 */

// Font style options
export type FontStyleType = 'bold' | 'modern' | 'minimal' | 'classic';

// Font size options
export type FontSizeType = 'small' | 'medium' | 'large';

// Animation type options
export type AnimationType =
  | 'fade'
  | 'typewriter'
  | 'karaoke'
  | 'slide_up'
  | 'slide_down'
  | 'scale_pop'
  | 'bounce'
  | 'glitch'
  | 'wave';

// Vertical position options
export type VerticalPositionType = 'top' | 'center' | 'bottom';

// Subtitle display mode options
// - sequential: subtitles appear one at a time with individual timing
// - static: all subtitles appear at once and stay visible throughout
export type SubtitleDisplayMode = 'sequential' | 'static';

// Subtitle purpose/type
export type SubtitleType = 'lyrics' | 'hook' | 'verse' | 'chorus' | 'cta' | 'caption';

/**
 * Complete Subtitle Style Set Definition
 */
export interface SubtitleStyleSet {
  // Identification
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;

  // Text styling
  text: {
    fontStyle: FontStyleType;
    fontSize: FontSizeType;
    color: string;              // hex color
    strokeColor: string;        // outline color
    strokeWidth: number;        // outline thickness
  };

  // Animation settings
  animation: {
    type: AnimationType;
    inDuration: number;         // seconds
    outDuration: number;        // seconds
  };

  // Position settings
  position: {
    vertical: VerticalPositionType;
    bottomMargin: number;       // percentage of screen height (0-100)
  };

  // Matching keywords for AI selection
  matchKeywords: {
    ko: string[];
    en: string[];
  };

  // Preview/UI
  previewColor: string;         // hex color for UI display
  icon: string;                 // emoji or icon identifier

  // Display mode (optional preset default)
  displayMode?: SubtitleDisplayMode;
}

/**
 * Lyrics data structure stored in Asset.metadata
 */
export interface LyricsData {
  // Metadata
  language: 'ko' | 'en' | 'ja' | 'mixed' | 'auto';
  extractedAt: string;          // ISO timestamp
  source: 'gemini' | 'forced-alignment' | 'manual' | 'tiktok-captions';  // extraction source
  confidence: number;           // 0-1 confidence score
  isInstrumental: boolean;      // true if no vocals detected

  // Full text
  fullText: string;             // complete lyrics text

  // Timed segments
  segments: LyricsSegment[];
}

/**
 * A single lyrics segment with timing
 */
export interface LyricsSegment {
  text: string;                 // segment text
  start: number;                // start time in seconds
  end: number;                  // end time in seconds
}

/**
 * Subtitle entry for video rendering
 */
export interface SubtitleEntry {
  text: string;
  start: number;                // start time in seconds
  end: number;                  // end time in seconds
  type?: SubtitleType;          // purpose of this subtitle
  styleId?: string;             // SubtitleStyleSet ID to use
}

/**
 * Style set selection result from AI
 */
export interface StyleSetSelectionResult {
  styleSetId: string;
  confidence: number;
  reasoning: string;
  alternativeIds?: string[];
}

/**
 * Render settings derived from a subtitle style set
 * This is what gets sent to the render API
 */
export interface SubtitleRenderSettings {
  textStyle: FontStyleType;
  fontSize: FontSizeType;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  animation: AnimationType;
  animationInDuration: number;
  animationOutDuration: number;
  verticalPosition: VerticalPositionType;
  bottomMargin: number;
  displayMode?: SubtitleDisplayMode; // defaults to 'sequential'
}

/**
 * Convert a subtitle style set to render settings
 */
export function styleSetToRenderSettings(styleSet: SubtitleStyleSet): SubtitleRenderSettings {
  return {
    textStyle: styleSet.text.fontStyle,
    fontSize: styleSet.text.fontSize,
    color: styleSet.text.color,
    strokeColor: styleSet.text.strokeColor,
    strokeWidth: styleSet.text.strokeWidth,
    animation: styleSet.animation.type,
    animationInDuration: styleSet.animation.inDuration,
    animationOutDuration: styleSet.animation.outDuration,
    verticalPosition: styleSet.position.vertical,
    bottomMargin: styleSet.position.bottomMargin,
    displayMode: styleSet.displayMode ?? 'sequential',
  };
}

/**
 * Options for lyrics to subtitle conversion
 */
export interface LyricsToSubtitleOptions {
  audioStartTime: number;       // audio start offset in seconds
  videoDuration: number;        // video length in seconds
  styleId: string;              // subtitle style set ID
  maxLinesPerScreen?: number;   // default: 2
  maxDurationPerSubtitle?: number; // max seconds per subtitle, default: 4
}

/**
 * Audio asset metadata extension for lyrics
 */
export interface AudioAssetLyricsMetadata {
  // Existing audio metadata fields (bpm, vibe, etc.) remain unchanged
  // New lyrics-related fields:
  hasLyrics?: boolean;
  lyricsLanguage?: string;
  lyricsExtractedAt?: string;
  lyrics?: LyricsData;
}
