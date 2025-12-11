/**
 * Shared Style Presets for Pipeline & Processing Pages
 * =====================================================
 * Re-exports style presets from fast-cut module for consistent usage
 * across compose variation modals and processing views.
 */

import {
  ALL_STYLE_SETS,
  STYLE_SETS_BY_ID,
  getStyleSetById,
} from '@/lib/fast-cut/style-sets/presets';
import type { FastCutStyleSet } from '@/lib/fast-cut/style-sets/types';
import type { LucideIcon } from 'lucide-react';
import {
  Zap,
  Film,
  Square,
  Activity,
  Disc,
  Briefcase,
  Cloud,
  Bold
} from 'lucide-react';

// Re-export types
export type { FastCutStyleSet };

// Re-export constants
export { ALL_STYLE_SETS, STYLE_SETS_BY_ID, getStyleSetById };

/**
 * Icon mapping for style presets (for UI components)
 */
export const STYLE_ICONS: Record<string, LucideIcon> = {
  viral_tiktok: Zap,
  cinematic_mood: Film,
  clean_minimal: Square,
  energetic_beat: Activity,
  retro_aesthetic: Disc,
  professional_corp: Briefcase,
  dreamy_soft: Cloud,
  bold_impact: Bold,
};

/**
 * Simplified style preset for UI display
 */
export interface StylePresetUI {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: LucideIcon;
  previewColor: string;
  emoji: string;
}

/**
 * Get UI-friendly style presets array
 */
export const STYLE_PRESETS_UI: StylePresetUI[] = ALL_STYLE_SETS.map((style) => ({
  id: style.id,
  name: style.name,
  nameKo: style.nameKo,
  description: style.description,
  descriptionKo: style.descriptionKo,
  icon: STYLE_ICONS[style.id] || Zap,
  previewColor: style.previewColor,
  emoji: style.icon,
}));

/**
 * Video settings extracted from a style preset
 */
export interface StylePresetSettings {
  vibe: string;
  colorGrade: string;
  effectPreset: string;
  textStyle: string;
}

/**
 * Get video/text settings from a style preset ID
 * Used by API to map style preset selection to actual render settings
 */
export function getSettingsFromStylePreset(styleId: string): StylePresetSettings | null {
  const style = STYLE_SETS_BY_ID[styleId];
  if (!style) return null;

  return {
    vibe: style.video.vibe,
    colorGrade: style.video.colorGrade,
    effectPreset: style.video.effectPreset,
    textStyle: style.text.style,
  };
}

/**
 * Get settings for multiple style presets
 * Returns array of settings objects (one per style)
 */
export function getSettingsFromStylePresets(styleIds: string[]): StylePresetSettings[] {
  return styleIds
    .map((id) => getSettingsFromStylePreset(id))
    .filter((settings): settings is StylePresetSettings => settings !== null);
}

/**
 * Default selected styles (for initial state)
 */
export const DEFAULT_SELECTED_STYLES = ['viral_tiktok', 'cinematic_mood'];

/**
 * Maximum variations allowed
 */
export const MAX_STYLE_VARIATIONS = 8;
