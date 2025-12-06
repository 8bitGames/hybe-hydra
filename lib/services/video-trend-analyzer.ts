/**
 * Video Trend Analyzer Service
 * Analyzes visual styles, content patterns, and generates video recommendations
 * from top TikTok videos for a given search query
 *
 * Uses VisualTrendAgent for AI-powered trend aggregation
 */

import {
  analyzeTikTokVideo,
  TikTokAnalysisResult,
  VideoStyleAnalysis,
  VideoContentAnalysis,
} from "@/lib/tiktok-analyzer";
import { createVisualTrendAgent, type VisualTrendAgent } from "@/lib/agents/analyzers/visual-trend";
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

export interface StylePatterns {
  dominantStyles: string[];
  colorPalettes: string[][];
  lightingPatterns: string[];
  cameraMovements: string[];
  transitionStyles: string[];
}

export interface ContentPatterns {
  commonSubjects: string[];
  settingTypes: string[];
  propCategories: string[];
}

export interface PromptTemplate {
  template: string;
  style: string;
  useCase: string;
}

export interface VideoRecommendations {
  promptTemplates: PromptTemplate[];
  styleGuidelines: {
    visualStyle: string;
    mood: string;
    pace: string;
    effects: string[];
  };
  technicalSpecs: {
    aspectRatio: string;
    duration: number;
    cameraStyle: string;
  };
}

export interface VideoTrendAnalysisResult {
  visualPatterns: StylePatterns;
  contentPatterns: ContentPatterns;
  dominantMood: string;
  averagePace: string;
  effectsTrending: string[];
  videoRecommendations: VideoRecommendations;
  analyzedVideoIds: string[];
  videosAnalyzed: number;
  trendScore: number;
}

// Singleton agent instance
let visualTrendAgent: VisualTrendAgent | null = null;

function getVisualTrendAgent(): VisualTrendAgent {
  if (!visualTrendAgent) {
    visualTrendAgent = createVisualTrendAgent();
  }
  return visualTrendAgent;
}

/**
 * Video Trend Analyzer Class
 */
export class VideoTrendAnalyzer {
  private videos: VideoData[];
  private searchQuery: string;
  private maxVideosToAnalyze: number;
  private agentContext: AgentContext;

  constructor(videos: VideoData[], searchQuery: string, maxVideos: number = 5, language: 'ko' | 'en' = 'ko') {
    this.videos = videos;
    this.searchQuery = searchQuery;
    this.maxVideosToAnalyze = maxVideos;
    this.agentContext = {
      workflow: {
        artistName: searchQuery,
        platform: 'tiktok',
        language,
        sessionId: `video-trend-${Date.now()}`,
      },
    };
  }

  /**
   * Select top videos for analysis based on engagement
   */
  private selectTopVideos(): VideoData[] {
    // Sort by likes (most engaged first)
    const sorted = [...this.videos]
      .filter((v) => v.videoUrl) // Only videos with URLs
      .sort((a, b) => (b.stats.likeCount || 0) - (a.stats.likeCount || 0));

    return sorted.slice(0, this.maxVideosToAnalyze);
  }

  /**
   * Analyze multiple videos and aggregate patterns
   */
  async analyzeVideoTrends(): Promise<TikTokAnalysisResult[]> {
    const topVideos = this.selectTopVideos();
    console.log(`[VideoTrendAnalyzer] Analyzing ${topVideos.length} top videos`);

    const analyses: TikTokAnalysisResult[] = [];

    for (const video of topVideos) {
      try {
        console.log(`[VideoTrendAnalyzer] Analyzing video ${video.id}...`);

        const videoUrl = video.videoUrl ||
          `https://www.tiktok.com/@${video.author.uniqueId}/video/${video.id}`;

        const analysis = await analyzeTikTokVideo(videoUrl);

        if (analysis.success) {
          analyses.push(analysis);
          console.log(`[VideoTrendAnalyzer] Successfully analyzed video ${video.id}`);
        } else {
          console.log(`[VideoTrendAnalyzer] Failed to analyze video ${video.id}: ${analysis.error}`);
        }

        // Add delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`[VideoTrendAnalyzer] Error analyzing video ${video.id}:`, error);
      }
    }

    return analyses;
  }

  /**
   * Aggregate style patterns from multiple analyses
   */
  aggregateStylePatterns(analyses: TikTokAnalysisResult[]): StylePatterns {
    const styles: Map<string, number> = new Map();
    const colors: string[][] = [];
    const lighting: Map<string, number> = new Map();
    const camera: Map<string, number> = new Map();
    const transitions: Map<string, number> = new Map();

    for (const analysis of analyses) {
      const style = analysis.style_analysis;
      if (!style) continue;

      // Count visual styles
      if (style.visual_style) {
        const count = styles.get(style.visual_style) || 0;
        styles.set(style.visual_style, count + 1);
      }

      // Collect color palettes
      if (style.color_palette && style.color_palette.length > 0) {
        colors.push(style.color_palette);
      }

      // Count lighting patterns
      if (style.lighting) {
        const count = lighting.get(style.lighting) || 0;
        lighting.set(style.lighting, count + 1);
      }

      // Count camera movements
      for (const movement of style.camera_movement || []) {
        const count = camera.get(movement) || 0;
        camera.set(movement, count + 1);
      }

      // Count transitions
      for (const transition of style.transitions || []) {
        const count = transitions.get(transition) || 0;
        transitions.set(transition, count + 1);
      }
    }

    // Sort and get top items
    const sortByCount = (map: Map<string, number>): string[] => {
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => key);
    };

    return {
      dominantStyles: sortByCount(styles).slice(0, 5),
      colorPalettes: colors.slice(0, 5),
      lightingPatterns: sortByCount(lighting).slice(0, 5),
      cameraMovements: sortByCount(camera).slice(0, 7),
      transitionStyles: sortByCount(transitions).slice(0, 5),
    };
  }

  /**
   * Aggregate content patterns from analyses
   */
  aggregateContentPatterns(analyses: TikTokAnalysisResult[]): ContentPatterns {
    const subjects: Map<string, number> = new Map();
    const settings: Map<string, number> = new Map();
    const props: Map<string, number> = new Map();

    for (const analysis of analyses) {
      const content = analysis.content_analysis;
      if (!content) continue;

      // Count subjects
      if (content.main_subject) {
        const count = subjects.get(content.main_subject) || 0;
        subjects.set(content.main_subject, count + 1);
      }

      // Count settings
      if (content.setting) {
        const count = settings.get(content.setting) || 0;
        settings.set(content.setting, count + 1);
      }

      // Count props
      for (const prop of content.props || []) {
        const count = props.get(prop) || 0;
        props.set(prop, count + 1);
      }
    }

    const sortByCount = (map: Map<string, number>): string[] => {
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => key);
    };

    return {
      commonSubjects: sortByCount(subjects).slice(0, 5),
      settingTypes: sortByCount(settings).slice(0, 5),
      propCategories: sortByCount(props).slice(0, 10),
    };
  }

  /**
   * Determine dominant mood from analyses
   */
  getDominantMood(analyses: TikTokAnalysisResult[]): string {
    const moods: Map<string, number> = new Map();

    for (const analysis of analyses) {
      const mood = analysis.style_analysis?.mood;
      if (mood) {
        const count = moods.get(mood) || 0;
        moods.set(mood, count + 1);
      }
    }

    if (moods.size === 0) return "engaging";

    return Array.from(moods.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Determine average pace from analyses
   */
  getAveragePace(analyses: TikTokAnalysisResult[]): string {
    const paces: Map<string, number> = new Map();

    for (const analysis of analyses) {
      const pace = analysis.style_analysis?.pace;
      if (pace) {
        const count = paces.get(pace) || 0;
        paces.set(pace, count + 1);
      }
    }

    if (paces.size === 0) return "medium";

    return Array.from(paces.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Get trending effects
   */
  getTrendingEffects(analyses: TikTokAnalysisResult[]): string[] {
    const effects: Map<string, number> = new Map();

    for (const analysis of analyses) {
      for (const effect of analysis.style_analysis?.effects || []) {
        const count = effects.get(effect) || 0;
        effects.set(effect, count + 1);
      }
    }

    return Array.from(effects.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([key]) => key);
  }

  /**
   * Generate prompt templates from patterns using VisualTrendAgent
   */
  async generatePromptTemplates(
    stylePatterns: StylePatterns,
    contentPatterns: ContentPatterns,
    analyses: TikTokAnalysisResult[]
  ): Promise<PromptTemplate[]> {
    try {
      const agent = getVisualTrendAgent();

      // Convert TikTokAnalysisResult to VisualTrendAgent input format
      const videoAnalyses = analyses.map((a) => ({
        id: a.video_url || `video-${Date.now()}`,
        style_analysis: {
          visual_style: a.style_analysis?.visual_style || 'modern',
          color_palette: a.style_analysis?.color_palette || [],
          lighting: a.style_analysis?.lighting || 'natural',
          mood: a.style_analysis?.mood || 'engaging',
          composition: a.style_analysis?.composition || 'centered',
        },
        content_analysis: a.content_analysis ? {
          main_subject: a.content_analysis.main_subject || '',
          setting: a.content_analysis.setting || '',
          props: a.content_analysis.props || [],
        } : undefined,
        technical: a.prompt_elements?.technical_suggestions ? {
          brightness: 0.7,
          complexity: 0.5,
          suggested_motion: a.style_analysis?.camera_movement?.[0] || 'dynamic',
        } : undefined,
      }));

      const result = await agent.aggregateAnalyses(videoAnalyses, this.agentContext);

      if (!result.success || !result.data?.promptTemplates) {
        console.error("[VideoTrendAnalyzer] Agent prompt generation failed:", result.error);
        return this.fallbackPromptTemplates(stylePatterns, contentPatterns);
      }

      // Convert agent output to PromptTemplate format
      return result.data.promptTemplates.map((t) => ({
        template: t.template,
        style: t.style,
        useCase: `Confidence: ${Math.round(t.confidence * 100)}%`,
      })).slice(0, 5);
    } catch (error) {
      console.error("[VideoTrendAnalyzer] Error generating prompt templates:", error);
      return this.fallbackPromptTemplates(stylePatterns, contentPatterns);
    }
  }

  /**
   * Fallback prompt templates when AI is unavailable
   */
  private fallbackPromptTemplates(
    stylePatterns: StylePatterns,
    contentPatterns: ContentPatterns
  ): PromptTemplate[] {
    const style = stylePatterns.dominantStyles[0] || "modern";
    const lighting = stylePatterns.lightingPatterns[0] || "natural";
    const subject = contentPatterns.commonSubjects[0] || "person";

    return [
      {
        template: `A ${style} video of [your subject], ${lighting} lighting, ${stylePatterns.cameraMovements.slice(0, 2).join(" and ")}`,
        style: style,
        useCase: "General content matching trend style",
      },
      {
        template: `[Your concept], ${style} aesthetic, with ${stylePatterns.transitionStyles[0] || "smooth"} transitions and ${stylePatterns.colorPalettes[0]?.[0] || "vibrant"} color palette`,
        style: "Aesthetic focused",
        useCase: "Visual-focused content",
      },
      {
        template: `Dynamic ${style} shot of ${subject}, incorporating ${stylePatterns.cameraMovements[0] || "dynamic camera movement"} and ${stylePatterns.transitionStyles[0] || "quick cuts"}`,
        style: "Dynamic",
        useCase: "High-energy content",
      },
    ];
  }

  /**
   * Calculate trend score based on engagement and analysis quality
   */
  calculateTrendScore(analyses: TikTokAnalysisResult[]): number {
    if (analyses.length === 0) return 0;

    let score = 0;

    // Base score from number of successful analyses
    score += (analyses.length / this.maxVideosToAnalyze) * 30;

    // Score from style consistency (if styles are similar, it's a stronger trend)
    const styles = analyses.map((a) => a.style_analysis?.visual_style).filter(Boolean);
    const uniqueStyles = new Set(styles).size;
    if (styles.length > 0) {
      const styleConsistency = 1 - (uniqueStyles - 1) / styles.length;
      score += styleConsistency * 20;
    }

    // Score from mood consistency
    const moods = analyses.map((a) => a.style_analysis?.mood).filter(Boolean);
    const uniqueMoods = new Set(moods).size;
    if (moods.length > 0) {
      const moodConsistency = 1 - (uniqueMoods - 1) / moods.length;
      score += moodConsistency * 20;
    }

    // Score from having prompt elements
    const hasPromptElements = analyses.filter((a) => a.prompt_elements).length;
    score += (hasPromptElements / analyses.length) * 30;

    return Math.min(100, Math.round(score));
  }

  /**
   * Run full video trend analysis
   */
  async analyze(): Promise<VideoTrendAnalysisResult> {
    console.log(`[VideoTrendAnalyzer] Starting video analysis for "${this.searchQuery}"`);

    // Analyze videos
    const analyses = await this.analyzeVideoTrends();

    if (analyses.length === 0) {
      console.log("[VideoTrendAnalyzer] No videos successfully analyzed, returning defaults");
      return this.getDefaultResult();
    }

    // Aggregate patterns
    const stylePatterns = this.aggregateStylePatterns(analyses);
    const contentPatterns = this.aggregateContentPatterns(analyses);
    const dominantMood = this.getDominantMood(analyses);
    const averagePace = this.getAveragePace(analyses);
    const effectsTrending = this.getTrendingEffects(analyses);

    // Generate recommendations
    const promptTemplates = await this.generatePromptTemplates(
      stylePatterns,
      contentPatterns,
      analyses
    );

    // Get technical specs from analyses
    const technicalSpecs = this.aggregateTechnicalSpecs(analyses);

    // Calculate trend score
    const trendScore = this.calculateTrendScore(analyses);

    // Get analyzed video IDs
    const analyzedVideoIds = this.selectTopVideos()
      .slice(0, analyses.length)
      .map((v) => v.id);

    return {
      visualPatterns: stylePatterns,
      contentPatterns,
      dominantMood,
      averagePace,
      effectsTrending,
      videoRecommendations: {
        promptTemplates,
        styleGuidelines: {
          visualStyle: stylePatterns.dominantStyles[0] || "modern",
          mood: dominantMood,
          pace: averagePace,
          effects: effectsTrending.slice(0, 5),
        },
        technicalSpecs,
      },
      analyzedVideoIds,
      videosAnalyzed: analyses.length,
      trendScore,
    };
  }

  /**
   * Aggregate technical specs from analyses
   */
  private aggregateTechnicalSpecs(analyses: TikTokAnalysisResult[]): {
    aspectRatio: string;
    duration: number;
    cameraStyle: string;
  } {
    const aspectRatios: Map<string, number> = new Map();
    const durations: number[] = [];
    const cameraStyles: Map<string, number> = new Map();

    for (const analysis of analyses) {
      const elements = analysis.prompt_elements;
      if (!elements?.technical_suggestions) continue;

      const tech = elements.technical_suggestions;

      if (tech.aspect_ratio) {
        const count = aspectRatios.get(tech.aspect_ratio) || 0;
        aspectRatios.set(tech.aspect_ratio, count + 1);
      }

      if (tech.duration) {
        durations.push(tech.duration);
      }

      if (tech.camera_style) {
        const count = cameraStyles.get(tech.camera_style) || 0;
        cameraStyles.set(tech.camera_style, count + 1);
      }
    }

    // Get most common values
    const topAspectRatio = Array.from(aspectRatios.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "9:16";

    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 8;

    const topCameraStyle = Array.from(cameraStyles.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "dynamic handheld";

    return {
      aspectRatio: topAspectRatio,
      duration: avgDuration,
      cameraStyle: topCameraStyle,
    };
  }

  /**
   * Get default result when no videos are analyzed
   */
  private getDefaultResult(): VideoTrendAnalysisResult {
    return {
      visualPatterns: {
        dominantStyles: ["modern social media"],
        colorPalettes: [["vibrant", "high contrast"]],
        lightingPatterns: ["well-lit"],
        cameraMovements: ["dynamic"],
        transitionStyles: ["quick cuts"],
      },
      contentPatterns: {
        commonSubjects: ["person"],
        settingTypes: ["indoor"],
        propCategories: [],
      },
      dominantMood: "engaging",
      averagePace: "fast-paced",
      effectsTrending: ["color grading"],
      videoRecommendations: {
        promptTemplates: [
          {
            template: `A modern, engaging video of [your subject] with dynamic camera movements`,
            style: "Modern",
            useCase: "General content",
          },
        ],
        styleGuidelines: {
          visualStyle: "modern social media",
          mood: "engaging",
          pace: "fast-paced",
          effects: ["color grading"],
        },
        technicalSpecs: {
          aspectRatio: "9:16",
          duration: 8,
          cameraStyle: "dynamic handheld",
        },
      },
      analyzedVideoIds: [],
      videosAnalyzed: 0,
      trendScore: 0,
    };
  }
}

/**
 * Factory function to create analyzer and run analysis
 */
export async function analyzeVideoTrends(
  videos: VideoData[],
  searchQuery: string,
  maxVideos: number = 5,
  language: 'ko' | 'en' = 'ko'
): Promise<VideoTrendAnalysisResult> {
  const analyzer = new VideoTrendAnalyzer(videos, searchQuery, maxVideos, language);
  return analyzer.analyze();
}
