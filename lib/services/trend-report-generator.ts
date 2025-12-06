/**
 * Trend Report Generator Service
 * Combines text and video trend analyses into unified content creation recommendations
 */

import { TrendPlatform } from "@prisma/client";
import { TextTrendAnalysisResult } from "./text-trend-analyzer";
import { VideoTrendAnalysisResult } from "./video-trend-analyzer";
import {
  createStrategySynthesizerAgent,
  type StrategySynthesizerAgent,
} from "@/lib/agents/analyzers/strategy-synthesizer";
import type { AgentContext } from "@/lib/agents/types";

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

// Singleton agent instance
let strategySynthesizerAgent: StrategySynthesizerAgent | null = null;

function getStrategySynthesizerAgent(): StrategySynthesizerAgent {
  if (!strategySynthesizerAgent) {
    strategySynthesizerAgent = createStrategySynthesizerAgent();
  }
  return strategySynthesizerAgent;
}

/**
 * Trend Report Generator Class
 */
export class TrendReportGenerator {
  private searchQuery: string;
  private platform: TrendPlatform;
  private textAnalysis: TextTrendAnalysisResult | null;
  private videoAnalysis: VideoTrendAnalysisResult | null;
  private agentContext: AgentContext;

  constructor(
    searchQuery: string,
    platform: TrendPlatform,
    textAnalysis: TextTrendAnalysisResult | null,
    videoAnalysis: VideoTrendAnalysisResult | null,
    language: "ko" | "en" = "ko"
  ) {
    this.searchQuery = searchQuery;
    this.platform = platform;
    this.textAnalysis = textAnalysis;
    this.videoAnalysis = videoAnalysis;
    this.agentContext = {
      workflow: {
        artistName: searchQuery,
        platform: platform.toLowerCase(),
        language,
        sessionId: `trend-report-${Date.now()}`,
      },
    };
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
   * Generate combined strategy using StrategySynthesizerAgent
   */
  async generateCombinedStrategy(): Promise<CombinedStrategy> {
    try {
      const agent = getStrategySynthesizerAgent();

      // Prepare text analysis input for agent
      const textAnalysisInput = this.textAnalysis
        ? {
            clusters: this.textAnalysis.hashtagClusters.map((c) => ({
              name: c.name,
              hashtags: c.hashtags.map((h) => h.hashtag || h),
              trendDirection: "stable" as const,
            })),
            sentiment: {
              overall: this.textAnalysis.sentimentTrend as "positive" | "neutral" | "negative",
              score: this.textAnalysis.sentimentTrend === "positive" ? 0.7 : 0.5,
              emotions: [],
            },
          }
        : { clusters: [], sentiment: { overall: "neutral" as const, score: 0.5, emotions: [] } };

      // Prepare visual analysis input for agent
      const visualAnalysisInput = this.videoAnalysis
        ? {
            dominantStyles: this.videoAnalysis.visualPatterns.dominantStyles.map((style, idx) => ({
              style,
              frequency: 1 - idx * 0.1,
            })),
            colorTrends: this.videoAnalysis.visualPatterns.colorPalettes.map((palette, idx) => ({
              palette,
              usage: 1 - idx * 0.1,
            })),
            effectsTrending: this.videoAnalysis.effectsTrending,
            promptTemplates: this.videoAnalysis.videoRecommendations.promptTemplates.map((t) => ({
              template: t.template,
              style: t.style,
              confidence: 0.8,
            })),
          }
        : {
            dominantStyles: [{ style: "modern", frequency: 0.5 }],
            colorTrends: [{ palette: ["#000000", "#FFFFFF"], usage: 0.5 }],
            effectsTrending: ["color grading"],
            promptTemplates: [],
          };

      // Prepare benchmarks
      const benchmarks = this.textAnalysis
        ? {
            avgViews: this.textAnalysis.metrics.avgViews,
            avgEngagement: this.textAnalysis.metrics.avgLikes,
          }
        : undefined;

      const result = await agent.synthesize(
        textAnalysisInput,
        visualAnalysisInput,
        this.agentContext,
        benchmarks
      );

      if (!result.success || !result.data) {
        return this.fallbackCombinedStrategy();
      }

      // Map agent output to CombinedStrategy format
      const { contentThemes, visualGuidelines, captionGuidelines, bestPractices, avoid } = result.data;

      const summary = contentThemes.length > 0
        ? `Focus on ${contentThemes[0].theme}. ${contentThemes[0].rationale} Use ${visualGuidelines.styles.join(", ")} visual styles with ${visualGuidelines.pace} pacing. Include hooks like "${captionGuidelines.hooks[0] || "Wait for it..."}" and hashtags: ${captionGuidelines.hashtags.slice(0, 3).join(", ")}.`
        : this.fallbackCombinedStrategy().summary;

      const keyActions = [
        ...contentThemes.slice(0, 2).map((t) => `Focus on "${t.theme}" content (Priority: ${t.priority})`),
        `Use ${visualGuidelines.styles[0] || "modern"} visual style`,
        `Apply ${visualGuidelines.effects[0] || "color grading"} effects`,
        `Include hashtags: ${captionGuidelines.hashtags.slice(0, 3).join(", ")}`,
      ].slice(0, 5);

      return {
        summary,
        keyActions,
        bestPractices: bestPractices.slice(0, 5),
        doNot: avoid.slice(0, 5),
      };
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
  videoAnalysis: VideoTrendAnalysisResult | null,
  language: "ko" | "en" = "ko"
): Promise<TrendReportResult> {
  const generator = new TrendReportGenerator(
    searchQuery,
    platform,
    textAnalysis,
    videoAnalysis,
    language
  );
  return generator.generateReport();
}
