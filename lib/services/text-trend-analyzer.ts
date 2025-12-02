/**
 * Text Trend Analyzer Service
 * Analyzes hashtags, descriptions, and text patterns from TikTok search results
 */

import { GoogleGenAI } from "@google/genai";
import { TrendPlatform } from "@prisma/client";

// Types
export interface VideoData {
  id: string;
  description: string;
  author: { uniqueId: string; nickname: string };
  stats: { playCount: number; likeCount?: number; commentCount?: number; shareCount?: number };
  hashtags?: string[];
  videoUrl?: string;
}

export interface HashtagAnalysis {
  hashtag: string;
  count: number;
  avgLikes: number;
  totalLikes: number;
}

export interface HashtagCluster {
  theme: string;
  hashtags: string[];
  popularity: number;
  description: string;
}

export interface PhraseAnalysis {
  phrase: string;
  frequency: number;
  avgEngagement: number;
}

export interface ContentSuggestions {
  captionTemplates: string[];
  hashtagStrategy: {
    primary: string[];    // Must use
    secondary: string[];  // Recommended
    niche: string[];      // For targeting
  };
  toneRecommendation: string;
  contentThemes: string[];
}

export interface TextTrendAnalysisResult {
  topHashtags: HashtagAnalysis[];
  hashtagClusters: HashtagCluster[];
  topicThemes: string[];
  commonPhrases: PhraseAnalysis[];
  sentimentTrend: "positive" | "neutral" | "negative";
  metrics: {
    totalVideos: number;
    avgLikes: number;
    avgComments: number;
    avgShares: number;
  };
  contentSuggestions: ContentSuggestions;
}

// Initialize Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Text Trend Analyzer Class
 */
export class TextTrendAnalyzer {
  private videos: VideoData[];
  private searchQuery: string;

  constructor(videos: VideoData[], searchQuery: string) {
    this.videos = videos;
    this.searchQuery = searchQuery;
  }

  /**
   * Analyze hashtags from video list
   */
  analyzeHashtags(): HashtagAnalysis[] {
    const hashtagMap = new Map<string, { count: number; totalLikes: number; likes: number[] }>();

    for (const video of this.videos) {
      const hashtags = video.hashtags || this.extractHashtags(video.description);
      const likes = video.stats.likeCount || 0;

      for (const hashtag of hashtags) {
        const normalized = hashtag.toLowerCase().replace("#", "");
        if (!normalized) continue;

        const existing = hashtagMap.get(normalized) || { count: 0, totalLikes: 0, likes: [] };
        existing.count += 1;
        existing.totalLikes += likes;
        existing.likes.push(likes);
        hashtagMap.set(normalized, existing);
      }
    }

    // Convert to array and calculate averages
    const results: HashtagAnalysis[] = [];
    for (const [hashtag, data] of hashtagMap) {
      results.push({
        hashtag,
        count: data.count,
        avgLikes: data.count > 0 ? Math.round(data.totalLikes / data.count) : 0,
        totalLikes: data.totalLikes,
      });
    }

    // Sort by count (most frequent first)
    return results.sort((a, b) => b.count - a.count);
  }

  /**
   * Extract hashtags from description text
   */
  private extractHashtags(description: string): string[] {
    const matches = description.match(/#[\w가-힣]+/g) || [];
    return matches.map((h) => h.replace("#", ""));
  }

  /**
   * Cluster hashtags by semantic similarity using Gemini
   */
  async clusterHashtags(hashtags: HashtagAnalysis[]): Promise<HashtagCluster[]> {
    if (hashtags.length === 0) {
      return [];
    }

    try {
      const ai = getGeminiClient();

      // Take top 30 hashtags for clustering
      const topHashtags = hashtags.slice(0, 30).map((h) => h.hashtag);

      const prompt = `You are analyzing trending hashtags from TikTok for the search query "${this.searchQuery}".

Hashtags to analyze: ${topHashtags.join(", ")}

Group these hashtags into 3-5 thematic clusters. Each cluster should have:
1. A clear theme name (in English)
2. The hashtags that belong to that theme
3. A brief description of what this cluster represents

Respond ONLY with valid JSON in this exact format:
{
  "clusters": [
    {
      "theme": "theme name",
      "hashtags": ["hashtag1", "hashtag2"],
      "description": "Brief description"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error("[TextTrendAnalyzer] Failed to parse cluster response");
        return this.fallbackClustering(hashtags);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const clusters: HashtagCluster[] = [];

      for (const cluster of parsed.clusters || []) {
        // Calculate popularity based on hashtag analytics
        const clusterHashtags = cluster.hashtags || [];
        let totalPopularity = 0;

        for (const ht of clusterHashtags) {
          const found = hashtags.find(
            (h) => h.hashtag.toLowerCase() === ht.toLowerCase()
          );
          if (found) {
            totalPopularity += found.count * (found.avgLikes / 1000);
          }
        }

        clusters.push({
          theme: cluster.theme,
          hashtags: clusterHashtags,
          popularity: Math.round(totalPopularity),
          description: cluster.description,
        });
      }

      return clusters.sort((a, b) => b.popularity - a.popularity);
    } catch (error) {
      console.error("[TextTrendAnalyzer] Error clustering hashtags:", error);
      return this.fallbackClustering(hashtags);
    }
  }

  /**
   * Fallback clustering when AI is unavailable
   */
  private fallbackClustering(hashtags: HashtagAnalysis[]): HashtagCluster[] {
    // Simple keyword-based clustering
    const clusters: HashtagCluster[] = [];

    // Group by common prefixes/keywords
    const mainKeyword = this.searchQuery.toLowerCase();
    const related: string[] = [];
    const general: string[] = [];
    const viral: string[] = [];

    for (const h of hashtags.slice(0, 20)) {
      const tag = h.hashtag.toLowerCase();
      if (tag.includes(mainKeyword) || mainKeyword.includes(tag)) {
        related.push(h.hashtag);
      } else if (["fyp", "viral", "trending", "foryou", "foryoupage"].includes(tag)) {
        viral.push(h.hashtag);
      } else {
        general.push(h.hashtag);
      }
    }

    if (related.length > 0) {
      clusters.push({
        theme: `${this.searchQuery} Related`,
        hashtags: related,
        popularity: related.length * 10,
        description: `Hashtags directly related to ${this.searchQuery}`,
      });
    }

    if (viral.length > 0) {
      clusters.push({
        theme: "Viral/Discovery",
        hashtags: viral,
        popularity: viral.length * 8,
        description: "Hashtags for viral reach and discovery",
      });
    }

    if (general.length > 0) {
      clusters.push({
        theme: "General/Niche",
        hashtags: general,
        popularity: general.length * 5,
        description: "Additional niche and general hashtags",
      });
    }

    return clusters;
  }

  /**
   * Extract common phrases from descriptions
   */
  extractPhrases(): PhraseAnalysis[] {
    const phraseMap = new Map<string, { count: number; totalEngagement: number }>();

    // Common TikTok caption patterns
    const patterns = [
      /^POV:?\s*.+/i,
      /^When\s+.+/i,
      /^Me\s+when\s+.+/i,
      /^This\s+is\s+.+/i,
      /^Wait\s+for\s+it.*/i,
      /^Part\s+\d+/i,
      /^Day\s+\d+/i,
      /^Tutorial:?\s*.+/i,
      /^How\s+to\s+.+/i,
    ];

    for (const video of this.videos) {
      const desc = video.description.trim();
      if (!desc) continue;

      const engagement = (video.stats.likeCount || 0) + (video.stats.commentCount || 0);

      // Check for pattern matches
      for (const pattern of patterns) {
        if (pattern.test(desc)) {
          const match = desc.match(pattern);
          if (match) {
            const phrase = match[0].slice(0, 50); // Truncate long phrases
            const existing = phraseMap.get(phrase) || { count: 0, totalEngagement: 0 };
            existing.count += 1;
            existing.totalEngagement += engagement;
            phraseMap.set(phrase, existing);
          }
        }
      }

      // Also extract first sentence as a potential template
      const firstSentence = desc.split(/[.!?\n]/)[0].trim();
      if (firstSentence.length > 10 && firstSentence.length < 100) {
        const existing = phraseMap.get(firstSentence) || { count: 0, totalEngagement: 0 };
        existing.count += 1;
        existing.totalEngagement += engagement;
        phraseMap.set(firstSentence, existing);
      }
    }

    // Convert to array
    const results: PhraseAnalysis[] = [];
    for (const [phrase, data] of phraseMap) {
      if (data.count >= 2) {
        // Only include phrases that appear at least twice
        results.push({
          phrase,
          frequency: data.count,
          avgEngagement: Math.round(data.totalEngagement / data.count),
        });
      }
    }

    return results.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  }

  /**
   * Analyze content themes using Gemini
   */
  async analyzeContentThemes(): Promise<string[]> {
    try {
      const ai = getGeminiClient();

      // Get sample descriptions
      const sampleDescriptions = this.videos
        .slice(0, 20)
        .map((v) => v.description)
        .filter((d) => d && d.length > 10)
        .slice(0, 10);

      if (sampleDescriptions.length === 0) {
        return ["general content"];
      }

      const prompt = `Analyze these TikTok video descriptions from a search for "${this.searchQuery}":

${sampleDescriptions.map((d, i) => `${i + 1}. ${d.slice(0, 200)}`).join("\n")}

Identify 3-5 main content themes/topics that appear in these descriptions.
Return ONLY a JSON array of theme strings, like: ["theme1", "theme2", "theme3"]`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text || "";
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const themes = JSON.parse(jsonMatch[0]);
        return themes.slice(0, 5);
      }

      return ["general content"];
    } catch (error) {
      console.error("[TextTrendAnalyzer] Error analyzing themes:", error);
      return ["general content"];
    }
  }

  /**
   * Analyze overall sentiment trend
   */
  async analyzeSentiment(): Promise<"positive" | "neutral" | "negative"> {
    try {
      const ai = getGeminiClient();

      const sampleDescriptions = this.videos
        .slice(0, 15)
        .map((v) => v.description)
        .filter((d) => d && d.length > 5)
        .join(" | ");

      if (!sampleDescriptions) {
        return "neutral";
      }

      const prompt = `Analyze the overall sentiment of these TikTok descriptions:

"${sampleDescriptions.slice(0, 1000)}"

Respond with ONLY one word: positive, neutral, or negative`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = (response.text || "").toLowerCase().trim();

      if (responseText.includes("positive")) return "positive";
      if (responseText.includes("negative")) return "negative";
      return "neutral";
    } catch (error) {
      console.error("[TextTrendAnalyzer] Error analyzing sentiment:", error);
      return "neutral";
    }
  }

  /**
   * Calculate metrics from videos
   */
  calculateMetrics(): {
    totalVideos: number;
    avgLikes: number;
    avgComments: number;
    avgShares: number;
  } {
    const total = this.videos.length;
    if (total === 0) {
      return { totalVideos: 0, avgLikes: 0, avgComments: 0, avgShares: 0 };
    }

    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    for (const video of this.videos) {
      totalLikes += video.stats.likeCount || 0;
      totalComments += video.stats.commentCount || 0;
      totalShares += video.stats.shareCount || 0;
    }

    return {
      totalVideos: total,
      avgLikes: Math.round(totalLikes / total),
      avgComments: Math.round(totalComments / total),
      avgShares: Math.round(totalShares / total),
    };
  }

  /**
   * Generate caption templates from top-performing content
   */
  async generateCaptionTemplates(
    hashtags: HashtagAnalysis[],
    themes: string[]
  ): Promise<string[]> {
    try {
      const ai = getGeminiClient();

      // Get top performing descriptions
      const topDescriptions = this.videos
        .filter((v) => (v.stats.likeCount || 0) > 0)
        .sort((a, b) => (b.stats.likeCount || 0) - (a.stats.likeCount || 0))
        .slice(0, 5)
        .map((v) => v.description)
        .filter((d) => d && d.length > 10);

      const topHashtags = hashtags.slice(0, 10).map((h) => h.hashtag);

      const prompt = `You are a TikTok content strategist. Based on these top-performing captions for "${this.searchQuery}":

${topDescriptions.map((d, i) => `${i + 1}. ${d.slice(0, 150)}`).join("\n")}

Top hashtags: ${topHashtags.join(", ")}
Content themes: ${themes.join(", ")}

Generate 3 caption templates that could be used for new content in this niche.
Use [brackets] for customizable parts.
Include relevant hashtags in the templates.

Return ONLY a JSON array of template strings.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text || "";
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]).slice(0, 5);
      }

      // Fallback templates
      return [
        `POV: [your scenario] #${this.searchQuery} #fyp`,
        `[Your hook here] 🔥 #${topHashtags[0] || this.searchQuery} #trending`,
        `Wait for it... #${this.searchQuery} #viral`,
      ];
    } catch (error) {
      console.error("[TextTrendAnalyzer] Error generating templates:", error);
      return [
        `POV: [your scenario] #${this.searchQuery} #fyp`,
        `[Your hook here] 🔥 #${this.searchQuery} #trending`,
      ];
    }
  }

  /**
   * Generate hashtag strategy
   */
  generateHashtagStrategy(hashtags: HashtagAnalysis[]): {
    primary: string[];
    secondary: string[];
    niche: string[];
  } {
    const sorted = [...hashtags].sort((a, b) => b.count - a.count);

    // Primary: Most frequent (top 3-5)
    const primary = sorted.slice(0, 5).map((h) => h.hashtag);

    // Secondary: Next tier (positions 5-10) with good engagement
    const secondary = sorted
      .slice(5, 15)
      .filter((h) => h.avgLikes > 0)
      .slice(0, 5)
      .map((h) => h.hashtag);

    // Niche: Less common but still relevant (positions 10-20)
    const niche = sorted
      .slice(10, 25)
      .filter((h) => h.count >= 2)
      .slice(0, 5)
      .map((h) => h.hashtag);

    // Always add viral hashtags if not present
    const viralTags = ["fyp", "foryou", "viral", "trending"];
    for (const tag of viralTags) {
      if (!primary.includes(tag) && !secondary.includes(tag)) {
        secondary.push(tag);
        break;
      }
    }

    return { primary, secondary, niche };
  }

  /**
   * Run full text trend analysis
   */
  async analyze(): Promise<TextTrendAnalysisResult> {
    console.log(`[TextTrendAnalyzer] Starting analysis for "${this.searchQuery}" with ${this.videos.length} videos`);

    // Run analyses
    const hashtags = this.analyzeHashtags();
    console.log(`[TextTrendAnalyzer] Found ${hashtags.length} unique hashtags`);

    const [clusters, themes, sentiment] = await Promise.all([
      this.clusterHashtags(hashtags),
      this.analyzeContentThemes(),
      this.analyzeSentiment(),
    ]);

    const commonPhrases = this.extractPhrases();
    const metrics = this.calculateMetrics();

    // Generate content suggestions
    const captionTemplates = await this.generateCaptionTemplates(hashtags, themes);
    const hashtagStrategy = this.generateHashtagStrategy(hashtags);

    // Determine tone recommendation based on sentiment and content
    let toneRecommendation = "engaging and authentic";
    if (sentiment === "positive") {
      toneRecommendation = "upbeat, enthusiastic, and positive";
    } else if (themes.some((t) => t.toLowerCase().includes("tutorial"))) {
      toneRecommendation = "informative and helpful";
    }

    return {
      topHashtags: hashtags.slice(0, 20),
      hashtagClusters: clusters,
      topicThemes: themes,
      commonPhrases,
      sentimentTrend: sentiment,
      metrics,
      contentSuggestions: {
        captionTemplates,
        hashtagStrategy,
        toneRecommendation,
        contentThemes: themes,
      },
    };
  }
}

/**
 * Factory function to create analyzer and run analysis
 */
export async function analyzeTextTrends(
  videos: VideoData[],
  searchQuery: string
): Promise<TextTrendAnalysisResult> {
  const analyzer = new TextTrendAnalyzer(videos, searchQuery);
  return analyzer.analyze();
}
