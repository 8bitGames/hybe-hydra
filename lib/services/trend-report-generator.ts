/**
 * Trend Report Generator Service
 * Combines text and video trend analyses into unified content creation recommendations
 */

import { GoogleGenAI } from "@google/genai";
import { TrendPlatform } from "@prisma/client";
import { TextTrendAnalysisResult } from "./text-trend-analyzer";
import { VideoTrendAnalysisResult } from "./video-trend-analyzer";

// Types for the combined report
export interface TextGuide {
  captionStyle: string;
  hashtags: {
    primary: string[];
    secondary: string[];
  };
  contentThemes: string[];
  toneRecommendation: string;
}

export interface VideoGuide {
  visualStyle: string;
  promptTemplate: string;
  mood: string;
  pace: string;
  effects: string[];
  technicalSpecs: {
    aspectRatio: string;
    duration: number;
    cameraStyle: string;
  };
}

export interface CombinedStrategy {
  summary: string;
  keyActions: string[];
  bestPractices: string[];
  doNot: string[];
}

export interface TrendReportResult {
  searchQuery: string;
  platform: TrendPlatform;
  trendScore: number;
  trendDirection: "rising" | "stable" | "declining";
  textGuide: TextGuide;
  videoGuide: VideoGuide;
  combinedStrategy: CombinedStrategy;
  targetAudience: string[];
  bestPostingTimes: {
    timezone: string;
    times: string[];
    days: string[];
  } | null;
  competitorInsights: {
    topCreators: string[];
    contentGaps: string[];
    differentiators: string[];
  } | null;
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
 * Trend Report Generator Class
 */
export class TrendReportGenerator {
  private searchQuery: string;
  private platform: TrendPlatform;
  private textAnalysis: TextTrendAnalysisResult | null;
  private videoAnalysis: VideoTrendAnalysisResult | null;

  constructor(
    searchQuery: string,
    platform: TrendPlatform,
    textAnalysis: TextTrendAnalysisResult | null,
    videoAnalysis: VideoTrendAnalysisResult | null
  ) {
    this.searchQuery = searchQuery;
    this.platform = platform;
    this.textAnalysis = textAnalysis;
    this.videoAnalysis = videoAnalysis;
  }

  /**
   * Calculate overall trend score
   */
  private calculateTrendScore(): number {
    let score = 0;
    let factors = 0;

    // Text analysis contribution
    if (this.textAnalysis) {
      // Engagement metrics
      const avgLikes = this.textAnalysis.metrics.avgLikes;
      if (avgLikes > 100000) score += 30;
      else if (avgLikes > 50000) score += 25;
      else if (avgLikes > 10000) score += 20;
      else if (avgLikes > 1000) score += 15;
      else score += 10;
      factors++;

      // Hashtag diversity
      const hashtagCount = this.textAnalysis.topHashtags.length;
      if (hashtagCount > 15) score += 20;
      else if (hashtagCount > 10) score += 15;
      else score += 10;
      factors++;

      // Theme clarity
      if (this.textAnalysis.topicThemes.length > 0) {
        score += 15;
        factors++;
      }
    }

    // Video analysis contribution
    if (this.videoAnalysis) {
      score += this.videoAnalysis.trendScore * 0.35;
      factors++;
    }

    return factors > 0 ? Math.min(100, Math.round(score / factors * 2)) : 0;
  }

  /**
   * Determine trend direction based on available data
   */
  private determineTrendDirection(): "rising" | "stable" | "declining" {
    // Without historical data, we infer from engagement patterns
    if (!this.textAnalysis) return "stable";

    const avgLikes = this.textAnalysis.metrics.avgLikes;
    const totalVideos = this.textAnalysis.metrics.totalVideos;

    // High engagement with many videos suggests rising trend
    if (avgLikes > 50000 && totalVideos > 20) return "rising";

    // Moderate engagement suggests stable
    if (avgLikes > 10000) return "stable";

    // Lower engagement might indicate declining (or niche)
    return "stable"; // Default to stable without historical data
  }

  /**
   * Generate text guide from analysis
   */
  private generateTextGuide(): TextGuide {
    if (!this.textAnalysis) {
      return {
        captionStyle: "Engaging and authentic",
        hashtags: {
          primary: [this.searchQuery, "fyp"],
          secondary: ["viral", "trending"],
        },
        contentThemes: ["general content"],
        toneRecommendation: "Be genuine and engaging",
      };
    }

    const { contentSuggestions, topicThemes, sentimentTrend } = this.textAnalysis;

    // Determine caption style based on sentiment and themes
    let captionStyle = contentSuggestions.toneRecommendation;
    if (sentimentTrend === "positive") {
      captionStyle = "Upbeat, enthusiastic, and positive. Use emojis sparingly for emphasis.";
    } else if (topicThemes.some((t) => t.toLowerCase().includes("tutorial"))) {
      captionStyle = "Informative and helpful. Focus on value delivery.";
    }

    return {
      captionStyle,
      hashtags: {
        primary: contentSuggestions.hashtagStrategy.primary,
        secondary: contentSuggestions.hashtagStrategy.secondary,
      },
      contentThemes: topicThemes,
      toneRecommendation: contentSuggestions.toneRecommendation,
    };
  }

  /**
   * Generate video guide from analysis
   */
  private generateVideoGuide(): VideoGuide {
    if (!this.videoAnalysis) {
      return {
        visualStyle: "Modern social media aesthetic",
        promptTemplate: `A dynamic, engaging video about ${this.searchQuery} with quick cuts and vibrant colors`,
        mood: "engaging",
        pace: "fast-paced",
        effects: ["color grading"],
        technicalSpecs: {
          aspectRatio: "9:16",
          duration: 8,
          cameraStyle: "dynamic handheld",
        },
      };
    }

    const { visualPatterns, videoRecommendations, dominantMood, averagePace, effectsTrending } = this.videoAnalysis;

    // Get the best prompt template
    const promptTemplate = videoRecommendations.promptTemplates[0]?.template ||
      `A ${visualPatterns.dominantStyles[0] || "modern"} video with ${visualPatterns.cameraMovements[0] || "dynamic"} camera movements`;

    return {
      visualStyle: visualPatterns.dominantStyles.join(", ") || "modern social media",
      promptTemplate,
      mood: dominantMood,
      pace: averagePace,
      effects: effectsTrending,
      technicalSpecs: videoRecommendations.technicalSpecs,
    };
  }

  /**
   * Generate combined strategy using AI
   */
  async generateCombinedStrategy(): Promise<CombinedStrategy> {
    try {
      const ai = getGeminiClient();

      const textGuide = this.generateTextGuide();
      const videoGuide = this.generateVideoGuide();

      const prompt = `You are a social media content strategist. Based on this trend analysis for "${this.searchQuery}" on ${this.platform}:

Text Trends:
- Caption style: ${textGuide.captionStyle}
- Top hashtags: ${textGuide.hashtags.primary.join(", ")}
- Content themes: ${textGuide.contentThemes.join(", ")}
- Tone: ${textGuide.toneRecommendation}

Video Trends:
- Visual style: ${videoGuide.visualStyle}
- Mood: ${videoGuide.mood}
- Pace: ${videoGuide.pace}
- Effects: ${videoGuide.effects.join(", ")}
- Technical: ${videoGuide.technicalSpecs.aspectRatio}, ${videoGuide.technicalSpecs.duration}s

Generate a combined content strategy. Return ONLY valid JSON:
{
  "summary": "One paragraph strategy summary",
  "keyActions": ["3-5 specific actions to take"],
  "bestPractices": ["3-5 best practices to follow"],
  "doNot": ["3-5 things to avoid"]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return this.fallbackCombinedStrategy();
    } catch (error) {
      console.error("[TrendReportGenerator] Error generating combined strategy:", error);
      return this.fallbackCombinedStrategy();
    }
  }

  /**
   * Fallback strategy when AI is unavailable
   */
  private fallbackCombinedStrategy(): CombinedStrategy {
    const textGuide = this.generateTextGuide();
    const videoGuide = this.generateVideoGuide();

    return {
      summary: `Create ${videoGuide.mood} content in the ${videoGuide.visualStyle} style. Use ${textGuide.toneRecommendation.toLowerCase()} captions with trending hashtags like ${textGuide.hashtags.primary.slice(0, 3).join(", ")}. Focus on ${textGuide.contentThemes[0] || "engaging content"}.`,
      keyActions: [
        `Use the ${videoGuide.visualStyle} visual style`,
        `Include hashtags: ${textGuide.hashtags.primary.slice(0, 3).join(", ")}`,
        `Match the ${videoGuide.pace} editing pace`,
        `Apply ${videoGuide.effects[0] || "color grading"} effects`,
        `Keep videos around ${videoGuide.technicalSpecs.duration} seconds`,
      ],
      bestPractices: [
        "Hook viewers in the first 2 seconds",
        "Use trending audio when available",
        `Maintain ${videoGuide.mood} energy throughout`,
        "End with a clear call-to-action",
        "Post consistently during peak hours",
      ],
      doNot: [
        "Don't use outdated trends or hashtags",
        "Don't make videos too long (keep under 15s for TikTok)",
        "Don't neglect the caption - it helps with discovery",
        "Don't copy content exactly - add your unique spin",
        "Don't ignore comments and engagement",
      ],
    };
  }

  /**
   * Infer target audience from analysis
   */
  private inferTargetAudience(): string[] {
    const audiences: string[] = [];

    // Infer from hashtags and themes
    if (this.textAnalysis) {
      const themes = this.textAnalysis.topicThemes.map((t) => t.toLowerCase());
      const hashtags = this.textAnalysis.topHashtags.map((h) => h.hashtag.toLowerCase());

      // Country music related
      if (themes.some((t) => t.includes("country")) || hashtags.some((h) => h.includes("country"))) {
        audiences.push("Country music fans", "Music enthusiasts");
      }

      // Dance related
      if (themes.some((t) => t.includes("dance")) || hashtags.some((h) => h.includes("dance"))) {
        audiences.push("Dance enthusiasts", "Performers");
      }

      // Tutorial/Educational
      if (themes.some((t) => t.includes("tutorial") || t.includes("how"))) {
        audiences.push("Learners", "Skill seekers");
      }

      // Entertainment
      if (themes.some((t) => t.includes("comedy") || t.includes("funny"))) {
        audiences.push("Entertainment seekers", "Casual viewers");
      }
    }

    // Add general audiences
    audiences.push("Gen Z (18-24)", "TikTok active users");

    return [...new Set(audiences)].slice(0, 5);
  }

  /**
   * Generate the full trend report
   */
  async generateReport(): Promise<TrendReportResult> {
    console.log(`[TrendReportGenerator] Generating report for "${this.searchQuery}"`);

    const trendScore = this.calculateTrendScore();
    const trendDirection = this.determineTrendDirection();
    const textGuide = this.generateTextGuide();
    const videoGuide = this.generateVideoGuide();
    const combinedStrategy = await this.generateCombinedStrategy();
    const targetAudience = this.inferTargetAudience();

    return {
      searchQuery: this.searchQuery,
      platform: this.platform,
      trendScore,
      trendDirection,
      textGuide,
      videoGuide,
      combinedStrategy,
      targetAudience,
      bestPostingTimes: {
        timezone: "Asia/Seoul",
        times: ["12:00-14:00", "18:00-21:00", "22:00-24:00"],
        days: ["Monday", "Wednesday", "Friday", "Saturday"],
      },
      competitorInsights: null, // Would require additional data collection
    };
  }

  /**
   * Format report for Bridge page integration
   */
  formatForBridge(): {
    trendStyle: string;
    suggestedPrompt: string;
    hashtags: string[];
    styleMatch: {
      visual: string;
      mood: string;
      pace: string;
    };
  } {
    const videoGuide = this.generateVideoGuide();
    const textGuide = this.generateTextGuide();

    return {
      trendStyle: videoGuide.visualStyle,
      suggestedPrompt: videoGuide.promptTemplate,
      hashtags: [...textGuide.hashtags.primary, ...textGuide.hashtags.secondary].slice(0, 10),
      styleMatch: {
        visual: videoGuide.visualStyle,
        mood: videoGuide.mood,
        pace: videoGuide.pace,
      },
    };
  }

  /**
   * Format report for Compose page integration
   */
  formatForCompose(): {
    scriptSuggestions: string[];
    visualStyle: string;
    hashtags: {
      recommended: string[];
      avoid: string[];
    };
    technicalSettings: {
      aspectRatio: string;
      duration: number;
      effects: string[];
    };
  } {
    const textGuide = this.generateTextGuide();
    const videoGuide = this.generateVideoGuide();

    // Generate script suggestions from caption templates
    const scriptSuggestions = this.textAnalysis?.contentSuggestions.captionTemplates || [
      `POV: [your scenario] #${this.searchQuery}`,
      `Wait for it... #${this.searchQuery} #fyp`,
    ];

    return {
      scriptSuggestions,
      visualStyle: videoGuide.visualStyle,
      hashtags: {
        recommended: [...textGuide.hashtags.primary, ...textGuide.hashtags.secondary].slice(0, 10),
        avoid: [], // Would need more data to determine
      },
      technicalSettings: {
        aspectRatio: videoGuide.technicalSpecs.aspectRatio,
        duration: videoGuide.technicalSpecs.duration,
        effects: videoGuide.effects.slice(0, 5),
      },
    };
  }
}

/**
 * Factory function to generate a trend report
 */
export async function generateTrendReport(
  searchQuery: string,
  platform: TrendPlatform,
  textAnalysis: TextTrendAnalysisResult | null,
  videoAnalysis: VideoTrendAnalysisResult | null
): Promise<TrendReportResult> {
  const generator = new TrendReportGenerator(
    searchQuery,
    platform,
    textAnalysis,
    videoAnalysis
  );
  return generator.generateReport();
}
