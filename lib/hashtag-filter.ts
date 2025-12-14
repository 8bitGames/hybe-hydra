/**
 * Hashtag filtering utility for TikTok trend analysis
 * Filters out generic hashtags that don't provide meaningful insights
 */

// Generic hashtags to exclude from analysis (common tags that don't provide insights)
export const EXCLUDED_HASHTAGS = new Set([
  // FYP variants (For You Page)
  "fyp", "foryou", "foryoupage", "fy", "fypage", "fypシ", "fypシ゚", "foryourpage",
  "parati", "perte", "pourtoi", "fürdich", "prapagina", "fyppppp", "fyppp", "fypp",
  "fyp❤️", "xyzbca", "xyz", "xyzabc",

  // Viral/trending generic tags
  "viral", "viralvideo", "viraltiktok", "goviral", "trending", "trend", "trendingnow",
  "viralpost", "goinviral", "viralcontent",

  // Platform tags
  "tiktok", "tiktokviral", "tiktokvideo", "tiktoktrend", "tiktokkorea", "틱톡",
  "tiktokchallenge", "tiktoker", "tiktokfamous",

  // Discovery/explore
  "explore", "explorepage", "discover", "discoverypage",

  // Generic content tags
  "video", "edit", "edits", "capcut", "capcutedit", "vn", "alightmotion",
  "slowmo", "slowmotion", "transition", "transitions",

  // Follow/engagement bait
  "follow", "followme", "followforfollow", "f4f", "fff",
  "like", "likeforlike", "l4l", "likes", "likesforlike",
  "share", "comment", "duet", "stitch",

  // Korean generic tags
  "추천", "추천떠라", "추천떠", "추천좀", "추천타자", "추천뜨자",
  "팔로우", "좋아요", "공유",

  // Other languages common tags
  "reels", "shorts", "youtube", "instagram", "ig",
  "humor", "funny", "fun", "meme", "memes",
  "love", "beautiful", "cute", "cool",
]);

/**
 * Check if a hashtag should be excluded from analysis
 * @param tag - The hashtag to check (with or without #)
 * @returns true if the hashtag should be excluded
 */
export function isExcludedHashtag(tag: string): boolean {
  const normalized = tag.toLowerCase().replace(/^#/, "").trim();
  return EXCLUDED_HASHTAGS.has(normalized);
}

/**
 * Filter an array of hashtags to remove generic/excluded ones
 * @param hashtags - Array of hashtags to filter
 * @returns Filtered array without generic hashtags
 */
export function filterHashtags(hashtags: string[]): string[] {
  return hashtags.filter((tag) => !isExcludedHashtag(tag));
}

/**
 * Get a clean, normalized hashtag
 * @param tag - The hashtag to normalize
 * @returns Normalized hashtag without # prefix and lowercased
 */
export function normalizeHashtag(tag: string): string {
  return tag.toLowerCase().replace(/^#/, "").trim();
}
