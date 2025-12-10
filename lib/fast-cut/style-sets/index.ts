/**
 * Fast Cut Style Sets
 * ===================
 * Complete style packages for consistent video generation
 *
 * Usage:
 * ```typescript
 * import { selectStyleSet, getStyleSetById, styleSetToRenderSettings } from '@/lib/fast-cut/style-sets';
 *
 * // AI-powered selection
 * const result = await selectStyleSet(prompt, context);
 * const styleSet = getStyleSetById(result.styleSetId);
 * const renderSettings = styleSetToRenderSettings(styleSet);
 *
 * // Or keyword-based (fast, no AI)
 * import { selectStyleSetByKeywords } from '@/lib/fast-cut/style-sets';
 * const result = selectStyleSetByKeywords(prompt);
 * ```
 */

// Types
export type {
  FastCutStyleSet,
  StyleSetSelectionResult,
  StyleSetRenderSettings,
  VibeType,
  TextStyleType,
  ColorGradeType,
  IntensityType,
  TextPositionType,
  FontStyleType,
} from './types';

export { styleSetToRenderSettings } from './types';

// Presets
export {
  ALL_STYLE_SETS,
  STYLE_SETS_BY_ID,
  getStyleSetById,
  getDefaultStyleSet,
  // Individual presets (for direct access if needed)
  VIRAL_TIKTOK,
  CINEMATIC_MOOD,
  CLEAN_MINIMAL,
  ENERGETIC_BEAT,
  RETRO_AESTHETIC,
  PROFESSIONAL_CORP,
  DREAMY_SOFT,
  BOLD_IMPACT,
} from './presets';

// Selector
export {
  selectStyleSet,
  selectStyleSetByKeywords,
  getStyleSetWithSelection,
  createStyleSetSelectorAgent,
  StyleSetSelectorAgent,
} from './selector';
