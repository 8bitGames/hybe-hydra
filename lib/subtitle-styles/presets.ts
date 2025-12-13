/**
 * Subtitle Style Sets - 6 TikTok-Optimized Presets
 * =================================================
 * Complete style packages for lyrics and caption rendering
 */

import type { SubtitleStyleSet } from './types';

/**
 * 1. Karaoke Sync - For synchronized lyrics display
 * 음원 가사 싱크용 (가라오케 스타일)
 */
export const KARAOKE_SYNC: SubtitleStyleSet = {
  id: 'karaoke_sync',
  name: 'Karaoke Sync',
  nameKo: '가라오케 싱크',
  description: 'Synchronized lyrics with karaoke-style timing',
  descriptionKo: '가라오케 스타일로 가사가 음악에 맞춰 싱크',

  text: {
    fontStyle: 'bold',
    fontSize: 'large',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 3,
  },

  animation: {
    type: 'karaoke',
    inDuration: 0,
    outDuration: 0.1,
  },

  position: {
    vertical: 'center',
    bottomMargin: 40,
  },

  matchKeywords: {
    ko: ['가사', '노래', '뮤직비디오', '음악', '싱크', '가라오케', '뮤비', 'MV'],
    en: ['lyrics', 'music', 'song', 'mv', 'sync', 'karaoke', 'music video'],
  },

  previewColor: '#9B59B6',
  icon: '🎤',
};

/**
 * 2. Lyric Fade - For emotional, soft lyrics
 * 감성적인 가사 표현용
 */
export const LYRIC_FADE: SubtitleStyleSet = {
  id: 'lyric_fade',
  name: 'Lyric Fade',
  nameKo: '리릭 페이드',
  description: 'Gentle fade animation for emotional lyrics',
  descriptionKo: '감성적인 가사에 어울리는 부드러운 페이드',

  text: {
    fontStyle: 'minimal',
    fontSize: 'medium',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
  },

  animation: {
    type: 'fade',
    inDuration: 0.4,
    outDuration: 0.4,
  },

  position: {
    vertical: 'bottom',
    bottomMargin: 18,
  },

  matchKeywords: {
    ko: ['감성', '발라드', '슬픈', '서정', '무드', '분위기', '로맨틱', '잔잔한'],
    en: ['emotional', 'ballad', 'sad', 'mood', 'soft', 'romantic', 'gentle', 'calm'],
  },

  previewColor: '#3498DB',
  icon: '🎵',
};

/**
 * 3. Bold Lyrics - For powerful, impactful lyrics
 * 강렬한 가사 강조용 (힙합, 댄스 등)
 */
export const BOLD_LYRICS: SubtitleStyleSet = {
  id: 'bold_lyrics',
  name: 'Bold Lyrics',
  nameKo: '볼드 리릭스',
  description: 'Bold, impactful lyrics with pop animation',
  descriptionKo: '강렬한 가사 강조, 팝 애니메이션',

  text: {
    fontStyle: 'bold',
    fontSize: 'large',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
  },

  animation: {
    type: 'scale_pop',
    inDuration: 0.15,
    outDuration: 0.15,
  },

  position: {
    vertical: 'center',
    bottomMargin: 35,
  },

  matchKeywords: {
    ko: ['강렬', '파워풀', '힙합', '랩', '에너지', '댄스', '비트', '신나는', '강한'],
    en: ['bold', 'powerful', 'hiphop', 'rap', 'energy', 'intense', 'dance', 'beat', 'strong'],
  },

  previewColor: '#E74C3C',
  icon: '🔥',
};

/**
 * 4. Minimal Caption - For clean, informational subtitles
 * 깔끔한 정보 전달용
 */
export const MINIMAL_CAPTION: SubtitleStyleSet = {
  id: 'minimal_caption',
  name: 'Minimal Caption',
  nameKo: '미니멀 캡션',
  description: 'Clean, minimal captions for information delivery',
  descriptionKo: '깔끔하고 미니멀한 정보 전달용 자막',

  text: {
    fontStyle: 'modern',
    fontSize: 'medium',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
  },

  animation: {
    type: 'fade',
    inDuration: 0.3,
    outDuration: 0.3,
  },

  position: {
    vertical: 'bottom',
    bottomMargin: 18,
  },

  matchKeywords: {
    ko: ['미니멀', '심플', '깔끔', '정보', '설명', '자막', '캡션', '간단한'],
    en: ['minimal', 'simple', 'clean', 'info', 'caption', 'subtitle', 'basic', 'plain'],
  },

  previewColor: '#95A5A6',
  icon: '✨',
};

/**
 * 5. Hook Impact - For hooks, CTAs, and attention-grabbing moments
 * 훅/CTA/강조 포인트용
 */
export const HOOK_IMPACT: SubtitleStyleSet = {
  id: 'hook_impact',
  name: 'Hook Impact',
  nameKo: '훅 임팩트',
  description: 'Bouncy animation for hooks and CTAs',
  descriptionKo: '훅과 CTA를 위한 바운스 임팩트',

  text: {
    fontStyle: 'bold',
    fontSize: 'large',
    color: '#FFFFFF',
    strokeColor: '#FF0054',
    strokeWidth: 3,
  },

  animation: {
    type: 'bounce',
    inDuration: 0.4,
    outDuration: 0.2,
  },

  position: {
    vertical: 'center',
    bottomMargin: 40,
  },

  matchKeywords: {
    ko: ['훅', '임팩트', '강조', 'CTA', '주목', '하이라이트', '포인트', '중요'],
    en: ['hook', 'impact', 'cta', 'attention', 'highlight', 'point', 'important', 'key'],
  },

  previewColor: '#FF006E',
  icon: '💥',
};

/**
 * 6. Story Type - For storytelling with typewriter effect
 * 스토리텔링/나레이션용
 */
export const STORY_TYPE: SubtitleStyleSet = {
  id: 'story_type',
  name: 'Story Type',
  nameKo: '스토리 타입',
  description: 'Typewriter effect for storytelling narratives',
  descriptionKo: '스토리텔링을 위한 타이프라이터 효과',

  text: {
    fontStyle: 'classic',
    fontSize: 'medium',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
  },

  animation: {
    type: 'typewriter',
    inDuration: 0.5,
    outDuration: 0.2,
  },

  position: {
    vertical: 'bottom',
    bottomMargin: 20,
  },

  matchKeywords: {
    ko: ['스토리', '이야기', '나레이션', '설명', '인트로', '아웃트로', '브이로그'],
    en: ['story', 'narrative', 'narration', 'intro', 'outro', 'vlog', 'explain'],
  },

  previewColor: '#2ECC71',
  icon: '📝',
};

/**
 * All subtitle style sets as an array
 */
export const ALL_SUBTITLE_STYLES: SubtitleStyleSet[] = [
  KARAOKE_SYNC,
  LYRIC_FADE,
  BOLD_LYRICS,
  MINIMAL_CAPTION,
  HOOK_IMPACT,
  STORY_TYPE,
];

/**
 * Subtitle styles indexed by ID for quick lookup
 */
export const SUBTITLE_STYLES_BY_ID: Record<string, SubtitleStyleSet> = {
  karaoke_sync: KARAOKE_SYNC,
  lyric_fade: LYRIC_FADE,
  bold_lyrics: BOLD_LYRICS,
  minimal_caption: MINIMAL_CAPTION,
  hook_impact: HOOK_IMPACT,
  story_type: STORY_TYPE,
};

/**
 * Get a subtitle style set by ID
 */
export function getSubtitleStyleById(id: string): SubtitleStyleSet | undefined {
  return SUBTITLE_STYLES_BY_ID[id];
}

/**
 * Get default subtitle style for lyrics
 */
export function getDefaultLyricsStyle(): SubtitleStyleSet {
  return KARAOKE_SYNC;
}

/**
 * Get default subtitle style for captions
 */
export function getDefaultCaptionStyle(): SubtitleStyleSet {
  return MINIMAL_CAPTION;
}

/**
 * Find best matching subtitle style based on keywords
 */
export function findMatchingStyle(
  keywords: string[],
  language: 'ko' | 'en' = 'ko'
): SubtitleStyleSet {
  const normalizedKeywords = keywords.map(k => k.toLowerCase());

  let bestMatch: SubtitleStyleSet = MINIMAL_CAPTION;
  let bestScore = 0;

  for (const style of ALL_SUBTITLE_STYLES) {
    const styleKeywords = style.matchKeywords[language].map(k => k.toLowerCase());
    const matchCount = normalizedKeywords.filter(k =>
      styleKeywords.some(sk => sk.includes(k) || k.includes(sk))
    ).length;

    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestMatch = style;
    }
  }

  return bestMatch;
}
