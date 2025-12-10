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

/**
 * TikTok CDN domains that require proxying
 */
const TIKTOK_CDN_DOMAINS = [
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "tiktokcdn-in.com",
  "byteoversea.com",
  "ibytedtos.com",
  "muscdn.com",
];

/**
 * Check if URL is from TikTok CDN (requires proxy)
 */
export function isTikTokCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return TIKTOK_CDN_DOMAINS.some(domain => hostname.endsWith(domain));
  } catch {
    return false;
  }
}

/**
 * Get proxied URL for TikTok images
 * Returns the original URL if it's already from our S3 or not a TikTok CDN URL
 */
export function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Already from our S3 (cached) - no proxy needed
  if (url.includes("s3.") && url.includes("amazonaws.com")) {
    return url;
  }

  // TikTok CDN - proxy through our backend
  if (isTikTokCdnUrl(url)) {
    return `/api/v1/proxy/image?url=${encodeURIComponent(url)}`;
  }

  // Other URLs - return as-is
  return url;
}

/**
 * Download file from URL (handles cross-origin like S3)
 * Fetches the file as blob and triggers browser download
 */
export async function downloadFile(url: string, filename?: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || getFilenameFromUrl(url) || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop();
    return filename || null;
  } catch {
    return null;
  }
}






















