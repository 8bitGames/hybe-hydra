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
 */
export async function searchImages(
  query: string,
  options: {
    maxResults?: number;
    safeSearch?: "off" | "medium" | "high";
    imageType?: "photo" | "face" | "clipart" | "lineart" | "animated";
    imageSize?: "huge" | "icon" | "large" | "medium" | "small" | "xlarge" | "xxlarge";
    rights?: string;
  } = {}
): Promise<ImageSearchResult[]> {
  const {
    maxResults = 10,
    safeSearch = "medium",
    imageType = "photo",
    imageSize = "huge",  // Maximum size option in Google CSE
  } = options;

  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    console.warn("[Google CSE] API not configured!");
    console.warn(`[Google CSE] API_KEY set: ${!!GOOGLE_CSE_API_KEY}, CX set: ${!!GOOGLE_CSE_ID}`);
    return [];
  }

  const params = new URLSearchParams({
    key: GOOGLE_CSE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q: query,
    searchType: "image",
    num: String(Math.min(maxResults, 10)), // API max is 10 per request
    safe: safeSearch,
    imgType: imageType,
    imgSize: imageSize,
  });

  try {
    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
    console.log(`[Google CSE] Searching: "${query}" (size: ${imageSize})`);

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();
      console.error("[Google CSE] API error:", response.status, error);
      throw new Error(`Google CSE API error: ${response.status}`);
    }

    const data: ImageSearchResponse = await response.json();
    console.log(`[Google CSE] Found ${data.items?.length || 0} results for "${query}"`);

    if (data.items && data.items.length > 0) {
      // Log first result in detail to understand the structure
      const first = data.items[0];
      console.log(`[Google CSE] First result detail:`);
      console.log(`  - Original URL: ${first.link}`);
      console.log(`  - Thumbnail URL: ${first.image?.thumbnailLink}`);
      console.log(`  - Reported size: ${first.image?.width}x${first.image?.height}`);
      console.log(`  - Thumbnail size: ${first.image?.thumbnailWidth}x${first.image?.thumbnailHeight}`);
    }

    return data.items || [];
  } catch (error) {
    console.error("[Google CSE] Search error:", error);
    return [];
  }
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
  } = {}
): Promise<ImageSearchResult[]> {
  const {
    maxResultsPerQuery = 5,
    totalMaxResults = 20,
    safeSearch = "medium",
  } = options;

  const allResults: ImageSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    if (allResults.length >= totalMaxResults) break;

    const results = await searchImages(query, {
      maxResults: maxResultsPerQuery,
      safeSearch,
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
