import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize text by removing odd characters, special unicode, and cleaning up display text
 * Useful for cleaning TikTok usernames and descriptions that may contain unusual characters
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return "";

  return text
    // Remove specific problematic characters like シ, ツ, etc. when used decoratively
    .replace(/[シツッァィゥェォャュョヮヵヶ]/g, "")
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Remove invisible/control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    // Remove other decorative unicode symbols often misused
    .replace(/[☆★♡♥︎❤️💕✨⭐️🌟✿❀❁✾✺❃❋]/g, "")
    // Normalize multiple spaces to single space
    .replace(/\s+/g, " ")
    // Trim whitespace
    .trim();
}

/**
 * Sanitize username - clean decorative characters but keep valid unicode letters
 */
export function sanitizeUsername(username: string | null | undefined): string {
  if (!username) return "";

  return username
    // Remove specific decorative Japanese katakana often used in usernames
    .replace(/[シツッ゛゜ー]/g, "")
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Remove invisible/control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    // Remove common decorative symbols
    .replace(/[☆★♡♥︎❤️💕✨⭐️🌟✿❀❁✾✺❃❋♪♫♬]/g, "")
    // Normalize multiple spaces/underscores
    .replace(/[\s_]{2,}/g, "_")
    // Trim whitespace and underscores from edges
    .replace(/^[\s_]+|[\s_]+$/g, "")
    .trim();
}




















