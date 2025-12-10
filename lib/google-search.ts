/**
 * Google Search APIs
 * - Google Custom Search API for image search
 * - Gemini Grounding for AI-enhanced search
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_AI_API_KEY || "";
// GOOGLE_SEARCH_API_KEY is the correct key for Custom Search API (different from AI API key)
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CSE_API_KEY || "";
const GOOGLE_CSE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_SEARCH_CX || "";

// Types
export interface ImageSearchResult {
  title: string;
  link: string;
  displayLink: string;
  snippet?: string;
  image: {
    contextLink: string;
    height: number;
    width: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
}

export interface ImageSearchResponse {
  items: ImageSearchResult[];
  totalResults: number;
  searchInformation: {
    totalResults: string;
    searchTime: number;
  };
}

export interface GroundingSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  aiSummary?: string;
}

/**
 * Search for images using Google Custom Search API
 * Supports pagination to fetch more than 10 results
 */
export async function searchImages(
  query: string,
  options: {
    maxResults?: number;
    safeSearch?: "off" | "medium" | "high";
    imageType?: "photo" | "face" | "clipart" | "lineart" | "animated";
    imageSize?: "huge" | "icon" | "large" | "medium" | "small" | "xlarge" | "xxlarge";
    rights?: string;
    gl?: string;  // Geolocation: "kr", "us", "jp", etc.
    hl?: string;  // Language: "ko", "en", "ja", etc.
  } = {}
): Promise<ImageSearchResult[]> {
  const {
    maxResults = 10,
    safeSearch = "medium",
    imageType,  // undefined = no filter (all image types)
    imageSize,  // undefined = no filter (all sizes)
    gl,         // undefined = no geolocation filter
    hl,         // undefined = no language filter
  } = options;

  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    console.warn("[Google CSE] API not configured!");
    console.warn(`[Google CSE] API_KEY set: ${!!GOOGLE_CSE_API_KEY}, CX set: ${!!GOOGLE_CSE_ID}`);
    return [];
  }

  const allResults: ImageSearchResult[] = [];
  const pagesNeeded = Math.ceil(maxResults / 10);  // Google API returns max 10 per request
  const maxPages = Math.min(pagesNeeded, 3);  // Limit to 3 pages (30 results) to save API quota

  for (let page = 0; page < maxPages && allResults.length < maxResults; page++) {
    const startIndex = page * 10 + 1;  // Google uses 1-based indexing
    const numToFetch = Math.min(10, maxResults - allResults.length);

    const params = new URLSearchParams({
      key: GOOGLE_CSE_API_KEY,
      cx: GOOGLE_CSE_ID,
      q: query,
      searchType: "image",
      num: String(numToFetch),
      start: String(startIndex),
      safe: safeSearch,
    });
    // Add optional filters only if specified
    if (imageType) params.set("imgType", imageType);
    if (imageSize) params.set("imgSize", imageSize);
    if (gl) params.set("gl", gl);  // Geolocation filter
    if (hl) params.set("hl", hl);  // Language filter
    if (options.rights) params.set("rights", options.rights);  // License/rights filter

    try {
      const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
      console.log(`[Google CSE] Searching: "${query}" (page ${page + 1}, start: ${startIndex})`);

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.text();
        console.error("[Google CSE] API error:", response.status, error);
        // Don't throw, just break the loop and return what we have
        break;
      }

      const data: ImageSearchResponse = await response.json();
      console.log(`[Google CSE] Page ${page + 1}: Found ${data.items?.length || 0} results for "${query}"`);

      if (data.items && data.items.length > 0) {
        allResults.push(...data.items);

        // Log first result only on first page
        if (page === 0) {
          const first = data.items[0];
          console.log(`[Google CSE] First result: ${first.image?.width}x${first.image?.height}`);
        }
      } else {
        // No more results available
        break;
      }

      // Small delay between pages to avoid rate limiting
      if (page < maxPages - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("[Google CSE] Search error:", error);
      break;
    }
  }

  console.log(`[Google CSE] Total collected: ${allResults.length} results for "${query}"`);
  return allResults;
}

/**
 * Search for images with multiple queries (for better coverage)
 */
export async function searchImagesMultiQuery(
  queries: string[],
  options: {
    maxResultsPerQuery?: number;
    totalMaxResults?: number;
    safeSearch?: "off" | "medium" | "high";
    imageSize?: "huge" | "icon" | "large" | "medium" | "small" | "xlarge" | "xxlarge";
    gl?: string;  // Geolocation
    hl?: string;  // Language
    rights?: string;  // License filter (e.g., "cc_publicdomain,cc_attribute")
  } = {}
): Promise<ImageSearchResult[]> {
  const {
    maxResultsPerQuery = 5,
    totalMaxResults = 20,
    safeSearch = "medium",
    imageSize,
    gl,
    hl,
    rights,
  } = options;

  const allResults: ImageSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    if (allResults.length >= totalMaxResults) break;

    const results = await searchImages(query, {
      maxResults: maxResultsPerQuery,
      safeSearch,
      imageSize,
      gl,
      hl,
      rights,
    });

    for (const result of results) {
      if (!seenUrls.has(result.link) && allResults.length < totalMaxResults) {
        seenUrls.add(result.link);
        allResults.push(result);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return allResults;
}

/**
 * Use Gemini with Google Search Grounding for enhanced results
 * This uses Gemini's built-in grounding feature to search Google and provide AI-enhanced results
 */
export async function searchWithGrounding(
  query: string,
  options: {
    dynamicThreshold?: number;
  } = {}
): Promise<GroundingSearchResult> {
  // dynamicThreshold is no longer used with the new google_search API
  void options;

  if (!GOOGLE_API_KEY) {
    console.warn("Google AI API key not configured");
    return { query, results: [] };
  }

  try {
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

    const model = genAI.getGenerativeModel(
      {
        model: "gemini-2.0-flash",
        tools: [
          // @ts-expect-error - google_search is the new API format
          { google_search: {} },
        ],
      }
    );

    const prompt = `Search for the latest information about: "${query}"

Please provide:
1. A summary of what you found
2. Key facts and recent news
3. Relevant URLs and sources

Focus on official sources, news articles, and reliable information.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Extract grounding metadata if available
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];

    const results = groundingChunks.map((chunk: { web?: { uri?: string; title?: string } }) => ({
      title: chunk.web?.title || "Source",
      url: chunk.web?.uri || "",
      snippet: "",
    }));

    return {
      query,
      results,
      aiSummary: text,
    };
  } catch (error) {
    console.error("Grounding search error:", error);
    return { query, results: [] };
  }
}

/**
 * Generate image search keywords using Gemini with Grounding
 * Combines AI understanding with real-time search for better keywords
 */
export async function generateSearchKeywordsWithGrounding(
  artistName: string,
  context: string,
  options: {
    maxKeywords?: number;
  } = {}
): Promise<string[]> {
  const { maxKeywords = 10 } = options;

  if (!GOOGLE_API_KEY) {
    // Fallback to basic keywords
    return [
      `${artistName} HD photo`,
      `${artistName} 2024`,
      `${artistName} concert`,
      `${artistName} photoshoot`,
    ];
  }

  try {
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

    const model = genAI.getGenerativeModel(
      {
        model: "gemini-2.0-flash",
        tools: [
          // @ts-expect-error - google_search is the new API format
          { google_search: {} },
        ],
      }
    );

    const prompt = `You are helping create a video about "${artistName}". Context: "${context}"

Search for recent information about this artist and generate the best image search keywords.

Return ONLY a JSON array of ${maxKeywords} specific search keywords that would find high-quality, recent photos.
Include variations like:
- Full name + "HD photo"
- Name + recent events/activities
- Name + fashion/style terms
- Name + official/concept photos

Example format: ["keyword1", "keyword2", "keyword3"]

Return ONLY the JSON array, nothing else.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const keywords = JSON.parse(jsonMatch[0]) as string[];
      return keywords.slice(0, maxKeywords);
    }

    // Fallback
    return [
      `${artistName} HD photo`,
      `${artistName} 2024`,
      `${artistName} official`,
    ];
  } catch (error) {
    console.error("Keyword generation error:", error);
    return [
      `${artistName} HD photo`,
      `${artistName} 2024`,
    ];
  }
}

/**
 * Check if Google Search APIs are configured
 */
export function isGoogleSearchConfigured(): boolean {
  return !!(GOOGLE_CSE_API_KEY && GOOGLE_CSE_ID);
}

export function isGroundingConfigured(): boolean {
  return !!GOOGLE_API_KEY;
}
