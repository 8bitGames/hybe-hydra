/**
 * Fast Cut Style Sets - Type Definitions
 * =======================================
 * Complete style packages for consistent video generation
 */

// Available vibe options (from existing system)
export type VibeType = 'Exciting' | 'Emotional' | 'Pop' | 'Minimal';

// Available text styles
export type TextStyleType = 'bold_pop' | 'fade_in' | 'slide_in' | 'minimal';

// Available color grades
export type ColorGradeType =
  | 'natural'
  | 'vibrant'
  | 'cinematic'
  | 'moody'
  | 'bright'
  | 'warm'
  | 'cool'
  | 'vintage'
  | 'neon'
  | 'dramatic';

// Intensity levels
export type IntensityType = 'low' | 'medium' | 'high';

// Text position
export type TextPositionType = 'top' | 'center' | 'bottom';

// Font style
export type FontStyleType = 'modern' | 'classic' | 'playful' | 'bold' | 'minimal';

/**
 * Complete Style Set Definition
 * Contains all settings needed for consistent video generation
 */
export interface FastCutStyleSet {
  // Identification
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;

  // Matching keywords for AI selection
  matchKeywords: {
    ko: string[];
    en: string[];
  };

  // Video settings
  video: {
    vibe: VibeType;
    colorGrade: ColorGradeType;
    effectPreset: string;
    transitions: string[];
    motions: string[];
    filters: string[];
  };

  // Text/subtitle settings
  text: {
    style: TextStyleType;
    animations: string[];
    position: TextPositionType;
    fontStyle: FontStyleType;
  };

  // Audio/timing settings
  audio: {
    bpmRange: [number, number];
    intensity: IntensityType;
    cutDuration: number;  // seconds per image
  };

  // Preview/UI
  previewColor: string;  // Hex color for UI card
  icon: string;  // Emoji or icon name
}

/**
 * Style Set Selection Result from AI
 */
export interface StyleSetSelectionResult {
  styleSetId: string;
  confidence: number;
  reasoning: string;
  alternativeIds?: string[];
}

/**
 * Render settings derived from a style set
 * This is what gets sent to the render API
 */
export interface StyleSetRenderSettings {
  vibe: VibeType;
  effectPreset: string;
  textStyle: TextStyleType;
  colorGrade: ColorGradeType;
  aiEffects: {
    transitions: string[];
    motions: string[];
    filters: string[];
    text_animations: string[];
  };
  bpmRange: [number, number];
  cutDuration: number;
}

/**
 * Convert a style set to render settings
 */
export function styleSetToRenderSettings(styleSet: FastCutStyleSet): StyleSetRenderSettings {
  return {
    vibe: styleSet.video.vibe,
    effectPreset: styleSet.video.effectPreset,
    textStyle: styleSet.text.style,
    colorGrade: styleSet.video.colorGrade,
    aiEffects: {
      transitions: styleSet.video.transitions,
      motions: styleSet.video.motions,
      filters: styleSet.video.filters,
      text_animations: styleSet.text.animations,
    },
    bpmRange: styleSet.audio.bpmRange,
    cutDuration: styleSet.audio.cutDuration,
  };
}
