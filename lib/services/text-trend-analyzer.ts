/**
 * Text Trend Analyzer Service
 * Analyzes hashtags, descriptions, and text patterns from TikTok search results
 *
 * Uses TextPatternAgent for AI-powered analysis
 */

import { createTextPatternAgent, type TextPatternAgent } from "@/lib/agents/analyzers/text-pattern";
import type { AgentContext } from "@/lib/agents/types";

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

// Singleton agent instance
let textPatternAgent: TextPatternAgent | null = null;

function getTextPatternAgent(): TextPatternAgent {
  if (!textPatternAgent) {
    textPatternAgent = createTextPatternAgent();
  }
  return textPatternAgent;
}

/**
 * Text Trend Analyzer Class
 */
export class TextTrendAnalyzer {
  private videos: VideoData[];
  private searchQuery: string;
  private agentContext: AgentContext;

  constructor(videos: VideoData[], searchQuery: string, language: 'ko' | 'en' = 'ko') {
    this.videos = videos;
    this.searchQuery = searchQuery;
    this.agentContext = {
      workflow: {
        artistName: searchQuery,
        platform: 'tiktok',
        language,
        sessionId: `text-trend-${Date.now()}`,
      },
    };
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
   * Cluster hashtags by semantic similarity using TextPatternAgent
   */
  async clusterHashtags(hashtags: HashtagAnalysis[]): Promise<HashtagCluster[]> {
    if (hashtags.length === 0) {
      return [];
    }

    try {
      const agent = getTextPatternAgent();

      // Take top 30 hashtags for clustering
      const topHashtags = hashtags.slice(0, 30).map((h) => h.hashtag);

      const result = await agent.clusterHashtags(topHashtags, this.agentContext);

      if (!result.success || !result.data?.clusters) {
        console.error("[TextTrendAnalyzer] Agent clustering failed:", result.error);
        return this.fallbackClustering(hashtags);
      }

      const clusters: HashtagCluster[] = [];

      for (const cluster of result.data.clusters) {
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
          theme: cluster.name,
          hashtags: clusterHashtags,
          popularity: Math.round(totalPopularity),
          description: cluster.trendDirection === 'rising' ? 'Rising trend' :
                       cluster.trendDirection === 'declining' ? 'Declining trend' : 'Stable trend',
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
   * Analyze content themes from hashtag clusters
   * Derives themes from clustering analysis rather than direct AI call
   */
  async analyzeContentThemes(clusters?: HashtagCluster[]): Promise<string[]> {
    try {
      // If clusters provided, extract themes from cluster names
      if (clusters && clusters.length > 0) {
        return clusters.slice(0, 5).map((c) => c.theme);
      }

      // Fallback: Extract themes from common words in descriptions
      const wordFreq = new Map<string, number>();
      const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up',
        'about', 'into', 'over', 'after', 'this', 'that', 'these', 'those',
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
        'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'and',
        'but', 'or', 'not', 'no', 'so', 'as', 'if', 'when', 'than', 'then',
        'fyp', 'foryou', 'foryoupage', 'viral', 'trending',
      ]);

      for (const video of this.videos.slice(0, 30)) {
        const words = video.description
          .toLowerCase()
          .replace(/#\w+/g, '') // Remove hashtags
          .replace(/[^\w\s가-힣]/g, ' ') // Keep only words
          .split(/\s+/)
          .filter((w) => w.length > 3 && !stopWords.has(w));

        for (const word of words) {
          wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }
      }

      // Get top words as themes
      const sortedWords = Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);

      if (sortedWords.length === 0) {
        return [this.searchQuery, "general content"];
      }

      return sortedWords;
    } catch (error) {
      console.error("[TextTrendAnalyzer] Error analyzing themes:", error);
      return ["general content"];
    }
  }

  /**
   * Analyze overall sentiment trend using TextPatternAgent
   */
  async analyzeSentiment(): Promise<"positive" | "neutral" | "negative"> {
    try {
      const agent = getTextPatternAgent();

      const sampleDescriptions = this.videos
        .slice(0, 15)
        .map((v) => v.description)
        .filter((d) => d && d.length > 5);

      if (sampleDescriptions.length === 0) {
        return "neutral";
      }

      const result = await agent.analyzeSentiment(sampleDescriptions, this.agentContext);

      if (!result.success || !result.data?.sentiment) {
        console.error("[TextTrendAnalyzer] Agent sentiment analysis failed:", result.error);
        return "neutral";
      }

      return result.data.sentiment.overall;
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
   * Generate caption templates from top-performing content using TextPatternAgent
   */
  async generateCaptionTemplates(
    hashtags: HashtagAnalysis[],
    themes: string[]
  ): Promise<string[]> {
    try {
      const agent = getTextPatternAgent();

      // Get top performing descriptions
      const topDescriptions = this.videos
        .filter((v) => (v.stats.likeCount || 0) > 0)
        .sort((a, b) => (b.stats.likeCount || 0) - (a.stats.likeCount || 0))
        .slice(0, 5)
        .map((v) => v.description)
        .filter((d) => d && d.length > 10);

      const topHashtags = hashtags.slice(0, 10).map((h) => h.hashtag);

      // Build patterns object for agent
      const patterns: Record<string, unknown> = {
        searchQuery: this.searchQuery,
        topDescriptions,
        topHashtags,
        themes,
      };

      const result = await agent.generateTemplates(patterns, this.agentContext);

      if (!result.success || !result.data?.captionTemplates) {
        console.error("[TextTrendAnalyzer] Agent template generation failed:", result.error);
        return this.getFallbackTemplates(topHashtags);
      }

      return result.data.captionTemplates.map((t) => t.template).slice(0, 5);
    } catch (error) {
      console.error("[TextTrendAnalyzer] Error generating templates:", error);
      return this.getFallbackTemplates(hashtags.slice(0, 10).map((h) => h.hashtag));
    }
  }

  /**
   * Fallback templates when AI is unavailable
   */
  private getFallbackTemplates(topHashtags: string[]): string[] {
    return [
      `POV: [your scenario] #${this.searchQuery} #fyp`,
      `[Your hook here] 🔥 #${topHashtags[0] || this.searchQuery} #trending`,
      `Wait for it... #${this.searchQuery} #viral`,
    ];
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

    // First get clusters and sentiment in parallel
    const [clusters, sentiment] = await Promise.all([
      this.clusterHashtags(hashtags),
      this.analyzeSentiment(),
    ]);

    // Then derive themes from clusters
    const themes = await this.analyzeContentThemes(clusters);

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
  searchQuery: string,
  language: 'ko' | 'en' = 'ko'
): Promise<TextTrendAnalysisResult> {
  const analyzer = new TextTrendAnalyzer(videos, searchQuery, language);
  return analyzer.analyze();
}
