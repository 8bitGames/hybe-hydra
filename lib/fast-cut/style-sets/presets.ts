/**
 * Fast Cut Style Sets - 8 TikTok-Optimized Presets
 * =================================================
 * Complete style packages for consistent, predictable video generation
 */

import type { FastCutStyleSet } from './types';

/**
 * 1. Viral TikTok - For trending, viral content
 * 바이럴/트렌드/챌린지 콘텐츠용
 */
export const VIRAL_TIKTOK: FastCutStyleSet = {
  id: 'viral_tiktok',
  name: 'Viral TikTok',
  nameKo: '바이럴 틱톡',
  description: 'Fast cuts, pop colors, bold text for viral content',
  descriptionKo: '빠른 컷, 팝 컬러, 강렬한 텍스트로 바이럴 콘텐츠 최적화',

  matchKeywords: {
    ko: ['바이럴', '트렌드', '챌린지', '인기', '핫한', '유행', '밈', '재미', '웃긴', '숏폼', 'fyp', '추천'],
    en: ['viral', 'trend', 'trending', 'challenge', 'popular', 'hot', 'meme', 'funny', 'fyp', 'foryou'],
  },

  video: {
    vibe: 'Exciting',
    colorGrade: 'vibrant',
    effectPreset: 'zoom_beat',
    transitions: ['zoom', 'glitch', 'slide'],
    motions: ['shake', 'zoom_in', 'pulse'],
    filters: [],
  },

  text: {
    style: 'bold_pop',
    animations: ['bounce', 'scale_pop', 'glitch'],
    position: 'center',
    fontStyle: 'bold',
  },

  audio: {
    bpmRange: [120, 150],
    intensity: 'high',
    cutDuration: 0.5,
  },

  previewColor: '#FF006E',
  icon: '🔥',
};

/**
 * 2. Cinematic Mood - For emotional, storytelling content
 * 시네마틱/감성/스토리텔링 콘텐츠용
 */
export const CINEMATIC_MOOD: FastCutStyleSet = {
  id: 'cinematic_mood',
  name: 'Cinematic Mood',
  nameKo: '시네마틱 무드',
  description: 'Slow transitions, film-like colors, minimal text',
  descriptionKo: '느린 전환, 영화적 색감, 미니멀 텍스트로 감성적 분위기',

  matchKeywords: {
    ko: ['감성', '무드', '영화', '시네마틱', '분위기', '스토리', '브랜드', '감동', '서정', '아름다운'],
    en: ['cinematic', 'mood', 'emotional', 'story', 'brand', 'aesthetic', 'beautiful', 'artistic', 'film'],
  },

  video: {
    vibe: 'Emotional',
    colorGrade: 'cinematic',
    effectPreset: 'crossfade',
    transitions: ['fade', 'dissolve', 'crossfade'],
    motions: ['parallax', 'slow_zoom'],
    filters: [],
  },

  text: {
    style: 'fade_in',
    animations: ['fade', 'typewriter'],
    position: 'bottom',
    fontStyle: 'minimal',
  },

  audio: {
    bpmRange: [60, 90],
    intensity: 'low',
    cutDuration: 2.5,
  },

  previewColor: '#3A86FF',
  icon: '🎬',
};

/**
 * 3. Clean Minimal - For product, info content
 * 깔끔한 정보 전달/제품 소개용
 */
export const CLEAN_MINIMAL: FastCutStyleSet = {
  id: 'clean_minimal',
  name: 'Clean Minimal',
  nameKo: '클린 미니멀',
  description: 'Simple cuts, natural colors, clear text',
  descriptionKo: '심플한 컷, 자연스러운 색감, 명확한 텍스트',

  matchKeywords: {
    ko: ['깔끔', '심플', '미니멀', '제품', '정보', '설명', '소개', '가이드', '튜토리얼', '리뷰'],
    en: ['clean', 'minimal', 'simple', 'product', 'info', 'guide', 'tutorial', 'review', 'howto'],
  },

  video: {
    vibe: 'Minimal',
    colorGrade: 'natural',
    effectPreset: 'minimal',
    transitions: ['cut', 'fade'],
    motions: ['none', 'subtle_zoom'],
    filters: [],
  },

  text: {
    style: 'minimal',
    animations: ['fade', 'slide_in'],
    position: 'bottom',
    fontStyle: 'modern',
  },

  audio: {
    bpmRange: [90, 110],
    intensity: 'low',
    cutDuration: 1.8,
  },

  previewColor: '#E5E5E5',
  icon: '✨',
};

/**
 * 4. Energetic Beat - For dance, sports, action content
 * 댄스/운동/액티브 콘텐츠용
 */
export const ENERGETIC_BEAT: FastCutStyleSet = {
  id: 'energetic_beat',
  name: 'Energetic Beat',
  nameKo: '에너제틱 비트',
  description: 'Beat-synced cuts, dynamic motion, vibrant colors',
  descriptionKo: '비트 싱크 컷, 다이나믹 모션, 활기찬 컬러',

  matchKeywords: {
    ko: ['에너지', '비트', '댄스', '운동', '액션', '스포츠', '활발', '신나는', '파워', '강렬'],
    en: ['energy', 'beat', 'dance', 'workout', 'action', 'sports', 'dynamic', 'power', 'intense', 'hype'],
  },

  video: {
    vibe: 'Exciting',
    colorGrade: 'vibrant',
    effectPreset: 'zoom_beat',
    transitions: ['zoom', 'wipe', 'flash'],
    motions: ['shake', 'pulse', 'zoom_in'],
    filters: [],
  },

  text: {
    style: 'bold_pop',
    animations: ['bounce', 'shake', 'flash'],
    position: 'center',
    fontStyle: 'bold',
  },

  audio: {
    bpmRange: [130, 160],
    intensity: 'high',
    cutDuration: 0.4,
  },

  previewColor: '#FFBE0B',
  icon: '⚡',
};

/**
 * 5. Retro Aesthetic - For Y2K, vintage style content
 * 레트로/빈티지/Y2K 콘텐츠용
 */
export const RETRO_AESTHETIC: FastCutStyleSet = {
  id: 'retro_aesthetic',
  name: 'Retro Aesthetic',
  nameKo: '레트로 감성',
  description: 'Vintage filters, soft transitions, retro fonts',
  descriptionKo: '빈티지 필터, 부드러운 전환, 레트로 폰트',

  matchKeywords: {
    ko: ['레트로', '빈티지', 'Y2K', '복고', '옛날', '추억', '감성', '아날로그', '필름', '올드스쿨'],
    en: ['retro', 'vintage', 'y2k', 'nostalgia', 'oldschool', 'throwback', 'aesthetic', 'film', 'analog'],
  },

  video: {
    vibe: 'Pop',
    colorGrade: 'moody', // 'vintage' not supported by compose server
    effectPreset: 'crossfade',
    transitions: ['fade', 'dissolve', 'vhs'],
    motions: ['subtle_zoom', 'scan_lines'],
    filters: [],
  },

  text: {
    style: 'fade_in',
    animations: ['typewriter', 'flicker'],
    position: 'bottom',
    fontStyle: 'classic',
  },

  audio: {
    bpmRange: [100, 120],
    intensity: 'medium',
    cutDuration: 1.2,
  },

  previewColor: '#FB5607',
  icon: '📼',
};

/**
 * 6. Professional Corp - For business, corporate content
 * 비즈니스/기업/공식 콘텐츠용
 */
export const PROFESSIONAL_CORP: FastCutStyleSet = {
  id: 'professional_corp',
  name: 'Professional',
  nameKo: '프로페셔널',
  description: 'Clean transitions, sophisticated colors, clear text',
  descriptionKo: '깔끔한 전환, 세련된 색감, 명확한 텍스트',

  matchKeywords: {
    ko: ['비즈니스', '기업', '전문', '공식', '회사', '브랜드', '프로', '세련', '고급', '럭셔리'],
    en: ['business', 'corporate', 'professional', 'official', 'brand', 'luxury', 'premium', 'elegant'],
  },

  video: {
    vibe: 'Minimal',
    colorGrade: 'cinematic', // 'cool' not supported by compose server
    effectPreset: 'minimal',
    transitions: ['fade', 'slide', 'wipe'],
    motions: ['subtle_zoom', 'parallax'],
    filters: [],
  },

  text: {
    style: 'slide_in',
    animations: ['slide_in', 'fade'],
    position: 'bottom',
    fontStyle: 'modern',
  },

  audio: {
    bpmRange: [80, 100],
    intensity: 'low',
    cutDuration: 2.0,
  },

  previewColor: '#1A1A2E',
  icon: '💼',
};

/**
 * 7. Dreamy Soft - For beauty, lifestyle content
 * 뷰티/라이프스타일/소프트 콘텐츠용
 */
export const DREAMY_SOFT: FastCutStyleSet = {
  id: 'dreamy_soft',
  name: 'Dreamy Soft',
  nameKo: '드리미 소프트',
  description: 'Soft transitions, pastel tones, gentle text',
  descriptionKo: '부드러운 전환, 파스텔 톤, 여린 텍스트',

  matchKeywords: {
    ko: ['드리미', '소프트', '뷰티', '라이프스타일', '부드러운', '파스텔', '예쁜', '일상', '힐링', '감성'],
    en: ['dreamy', 'soft', 'beauty', 'lifestyle', 'gentle', 'pastel', 'pretty', 'daily', 'healing', 'aesthetic'],
  },

  video: {
    vibe: 'Emotional',
    colorGrade: 'natural', // 'warm' not supported by compose server
    effectPreset: 'crossfade',
    transitions: ['fade', 'dissolve', 'blur'],
    motions: ['slow_zoom', 'float'],
    filters: [],
  },

  text: {
    style: 'fade_in',
    animations: ['fade', 'float'],
    position: 'bottom',
    fontStyle: 'minimal',
  },

  audio: {
    bpmRange: [70, 95],
    intensity: 'low',
    cutDuration: 2.0,
  },

  previewColor: '#FFB4D1',
  icon: '🌸',
};

/**
 * 8. Bold Impact - For announcement, promo content
 * 발표/프로모션/강조 콘텐츠용
 */
export const BOLD_IMPACT: FastCutStyleSet = {
  id: 'bold_impact',
  name: 'Bold Impact',
  nameKo: '볼드 임팩트',
  description: 'Strong zooms, high contrast, big text',
  descriptionKo: '강렬한 줌, 고대비, 큰 텍스트로 임팩트 강조',

  matchKeywords: {
    ko: ['임팩트', '강렬', '발표', '프로모션', '할인', '이벤트', '세일', '공지', '중요', '특별'],
    en: ['impact', 'bold', 'announcement', 'promo', 'sale', 'event', 'discount', 'notice', 'special', 'big'],
  },

  video: {
    vibe: 'Exciting',
    colorGrade: 'moody', // 'dramatic' not supported by compose server
    effectPreset: 'zoom_beat',
    transitions: ['zoom', 'flash', 'slam'],
    motions: ['zoom_in', 'shake', 'punch'],
    filters: [],
  },

  text: {
    style: 'bold_pop',
    animations: ['scale_pop', 'slam', 'flash'],
    position: 'center',
    fontStyle: 'bold',
  },

  audio: {
    bpmRange: [110, 140],
    intensity: 'high',
    cutDuration: 0.6,
  },

  previewColor: '#FF0054',
  icon: '💥',
};

/**
 * All style sets as an array
 */
export const ALL_STYLE_SETS: FastCutStyleSet[] = [
  VIRAL_TIKTOK,
  CINEMATIC_MOOD,
  CLEAN_MINIMAL,
  ENERGETIC_BEAT,
  RETRO_AESTHETIC,
  PROFESSIONAL_CORP,
  DREAMY_SOFT,
  BOLD_IMPACT,
];

/**
 * Style sets indexed by ID for quick lookup
 */
export const STYLE_SETS_BY_ID: Record<string, FastCutStyleSet> = {
  viral_tiktok: VIRAL_TIKTOK,
  cinematic_mood: CINEMATIC_MOOD,
  clean_minimal: CLEAN_MINIMAL,
  energetic_beat: ENERGETIC_BEAT,
  retro_aesthetic: RETRO_AESTHETIC,
  professional_corp: PROFESSIONAL_CORP,
  dreamy_soft: DREAMY_SOFT,
  bold_impact: BOLD_IMPACT,
};

/**
 * Get a style set by ID
 */
export function getStyleSetById(id: string): FastCutStyleSet | undefined {
  return STYLE_SETS_BY_ID[id];
}

/**
 * Get default style set (viral_tiktok for TikTok content)
 */
export function getDefaultStyleSet(): FastCutStyleSet {
  return VIRAL_TIKTOK;
}
