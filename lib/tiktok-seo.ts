/**
 * TikTok SEO Optimization Configuration
 * Based on: https://open.forem.com/synergistdigitalmedia/tiktok-search-optimization-how-to-rank-when-gen-z-ditches-google-e2h
 *
 * Key Insights:
 * - 40% of Gen Z uses TikTok/Instagram as primary search engine
 * - TikTok search grew 135% year-over-year in 2024
 * - Algorithm prioritizes: watch time, completion rate, shares, saves
 * - Speech recognition scans audio for keywords
 * - Text overlays are processed for content understanding
 */

// TikTok SEO Metadata interface
export interface TikTokSEO {
  // Primary description (max 2200 chars)
  description: string;

  // Hashtags (3-5 strategic tags)
  hashtags: {
    category: string;      // Broad category tag
    niche: string;         // Specific niche tag
    descriptive: string[]; // 1-2 descriptive tags
    trending?: string;     // Optional trending tag if relevant
  };

  // Keywords for audio/text optimization
  keywords: {
    primary: string;       // Main keyword (front-loaded)
    secondary: string[];   // Supporting keywords
    longTail: string[];    // Specific search phrases
  };

  // Text overlay optimization
  textOverlayKeywords: string[];  // Keywords to include in video text

  // Search intent matching
  searchIntent: 'tutorial' | 'discovery' | 'entertainment' | 'inspiration';

  // Posting optimization
  suggestedPostingTimes: string[];
}

// SEO Configuration constants
export const TIKTOK_SEO_CONFIG = {
  // Description limits
  MAX_DESCRIPTION_LENGTH: 2200,
  OPTIMAL_DESCRIPTION_LENGTH: 150, // First 150 chars most important

  // Hashtag strategy
  HASHTAG_COUNT: {
    MIN: 3,
    MAX: 5,
    OPTIMAL: 4
  },

  // Avoid these generic hashtags
  AVOID_HASHTAGS: ['#fyp', '#foryou', '#viral', '#foryoupage', '#trending'],

  // Content signals that boost ranking
  RANKING_FACTORS: {
    watchTime: 'High watch time signals relevance',
    completionRate: 'Videos watched to end rank higher',
    shares: 'Shared content gets boosted',
    saves: 'Saved content indicates value',
    comments: 'Comments show engagement',
    recency: 'Fresh content ranks higher for timely searches'
  },

  // Keyword placement priority
  KEYWORD_PLACEMENT: [
    'First 3 seconds of video (audio + text)',
    'Caption first line',
    'Text overlays throughout',
    'Spoken words in video',
    'Hashtags'
  ],

  // Best posting times (CST for country music content)
  OPTIMAL_POSTING_TIMES_KST: [
    '12:00', // Lunch break
    '18:00', // After work/school
    '21:00', // Prime evening
    '23:00'  // Late night scrolling
  ],

  // Content format by search intent
  CONTENT_FORMAT_BY_INTENT: {
    tutorial: 'Step-by-step, educational, how-to',
    discovery: 'Product showcases, reviews, recommendations',
    entertainment: 'Engaging, fun, shareable moments',
    inspiration: 'Visual aesthetics, mood, atmosphere'
  }
};

// Country music specific hashtag templates
export const COUNTRY_HASHTAG_TEMPLATES = {
  category: ['#countrymusic', '#countryfan', '#nashville'],
  niche: (artistName: string) => [
    `#${artistName.replace(/\s+/g, '')}`,
    `#${artistName.replace(/\s+/g, '')}fan`,
    `#${artistName.replace(/\s+/g, '')}edit`
  ],
  descriptive: [
    '#countryedit', '#countrylive', '#countrysong', '#countrymoment',
    '#nashvillevibes', '#countryartist', '#countrylife'
  ],
  event: (eventName: string) => [
    `#${eventName.replace(/\s+/g, '')}`,
    '#newmusic', '#newrelease', '#musicvideo'
  ]
};

// Alias for backward compatibility
export const KPOP_HASHTAG_TEMPLATES = COUNTRY_HASHTAG_TEMPLATES;

// Generate TikTok description template
export function generateDescriptionTemplate(
  artistName: string,
  topic: string,
  keywords: string[]
): string {
  const primaryKeyword = keywords[0] || artistName;
  const secondaryKeywords = keywords.slice(1, 4).join(', ');

  return `${primaryKeyword} ✨ ${topic}

${artistName}의 특별한 순간을 담았습니다.
${secondaryKeywords ? `관련: ${secondaryKeywords}` : ''}

💬 어떻게 생각하세요? 댓글로 알려주세요!
❤️ 좋으면 좋아요 & 저장!
👉 팔로우하고 더 많은 콘텐츠를 받아보세요!`;
}

// Generate optimized hashtags
export function generateOptimizedHashtags(
  artistName: string,
  vibe: string,
  trendKeywords: string[]
): TikTokSEO['hashtags'] {
  const artistTag = `#${artistName.replace(/\s+/g, '')}`;

  // Niche tag based on artist
  const nicheTag = COUNTRY_HASHTAG_TEMPLATES.niche(artistName)[0];

  // Descriptive tags based on vibe
  const vibeToTags: Record<string, string[]> = {
    'Exciting': ['#countryedit', '#countrymoment'],
    'Emotional': ['#countryfeels', '#nashvillevibes'],
    'Pop': ['#countrytrend', '#countryedit'],
    'Minimal': ['#countryvibes', '#acoustic']
  };

  const descriptiveTags = vibeToTags[vibe] || ['#countryedit'];

  // Trending tag from user's trend keywords
  const trendingTag = trendKeywords.length > 0
    ? `#${trendKeywords[0].replace(/\s+/g, '').replace('#', '')}`
    : undefined;

  return {
    category: '#countrymusic',
    niche: nicheTag,
    descriptive: descriptiveTags,
    trending: trendingTag
  };
}

// Generate keywords for SEO
export function generateSEOKeywords(
  artistName: string,
  topic: string,
  scriptLines: string[]
): TikTokSEO['keywords'] {
  // Primary keyword is artist name + topic context
  const primary = `${artistName} ${topic.split(' ').slice(0, 3).join(' ')}`;

  // Secondary keywords from script lines
  const secondary = scriptLines
    .slice(0, 3)
    .map(line => line.split(' ').slice(0, 3).join(' '))
    .filter(k => k.length > 3);

  // Long-tail keywords for specific searches
  const longTail = [
    `${artistName} edit`,
    `${artistName} fancam`,
    `${artistName} moment`,
    `${artistName} 2024`,
    `${artistName} 직캠`
  ];

  return {
    primary,
    secondary,
    longTail
  };
}

// Calculate search intent based on content
export function detectSearchIntent(
  topic: string,
  vibe: string
): TikTokSEO['searchIntent'] {
  const topicLower = topic.toLowerCase();

  if (topicLower.includes('how') || topicLower.includes('tutorial') || topicLower.includes('배우')) {
    return 'tutorial';
  }
  if (topicLower.includes('review') || topicLower.includes('recommend') || topicLower.includes('추천')) {
    return 'discovery';
  }
  if (vibe === 'Emotional' || topicLower.includes('aesthetic') || topicLower.includes('vibe')) {
    return 'inspiration';
  }
  return 'entertainment';
}

// Full SEO metadata generator
export function generateTikTokSEO(
  artistName: string,
  topic: string,
  vibe: string,
  scriptLines: string[],
  trendKeywords: string[],
  language: "ko" | "en" = "ko"
): TikTokSEO {
  const keywords = generateSEOKeywords(artistName, topic, scriptLines);
  const hashtags = generateOptimizedHashtags(artistName, vibe, trendKeywords);
  const searchIntent = detectSearchIntent(topic, vibe);

  // Build description with front-loaded keywords
  const hashtagString = [
    hashtags.category,
    hashtags.niche,
    ...hashtags.descriptive,
    hashtags.trending
  ].filter(Boolean).join(' ');

  // CTA text based on language
  const ctaText = language === "ko"
    ? `💬 댓글로 의견을 남겨주세요!
❤️ 좋아요 & 저장으로 응원해주세요!
👉 팔로우하면 더 많은 ${artistName} 콘텐츠를 볼 수 있어요!`
    : `💬 Drop your thoughts in the comments!
❤️ Like & Save to show your support!
👉 Follow for more ${artistName} content!`;

  const description = `${keywords.primary}

${topic}

${scriptLines.slice(0, 2).join('\n')}

${ctaText}

${hashtagString}`;

  return {
    description: description.slice(0, TIKTOK_SEO_CONFIG.MAX_DESCRIPTION_LENGTH),
    hashtags,
    keywords,
    textOverlayKeywords: [
      keywords.primary.split(' ')[0],
      artistName,
      ...keywords.secondary.slice(0, 2)
    ],
    searchIntent,
    suggestedPostingTimes: TIKTOK_SEO_CONFIG.OPTIMAL_POSTING_TIMES_KST
  };
}

// Export for API use
export type { TikTokSEO as TikTokSEOMetadata };
