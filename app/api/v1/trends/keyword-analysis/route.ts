import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { searchTikTok } from "@/lib/tiktok-mcp";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getKeywordInsightsAgent } from "@/lib/agents/analyzers/keyword-insights";
import type { AgentContext } from "@/lib/agents/types";
import { coOccurrenceAnalyzer } from "@/lib/expansion/co-occurrence";
import { accountDiscoveryService } from "@/lib/expansion/account-discovery";
import { isExcludedHashtag } from "@/lib/hashtag-filter";

const CACHE_DURATION_HOURS = 24;

// Sanitize strings to remove invalid Unicode sequences that break JSON
function sanitizeString(str: string | null | undefined): string {
  if (!str) return "";
  return str
    // Remove null characters
    .replace(/\0/g, "")
    // Remove incomplete surrogate pairs
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    // Remove other problematic control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Ensure valid UTF-8
    .normalize("NFC");
}

// Deep sanitize an object recursively
function sanitizeForJson<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJson) as T;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeForJson(value);
    }
    return result as T;
  }

  return obj;
}

interface VideoStats {
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface AnalyzedVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  description: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  stats: VideoStats;
  hashtags: string[];
  engagementRate: number; // (likes + comments + shares) / views * 100
  likeToViewRatio: number;
  rank: number;
}

interface HashtagInsight {
  tag: string;
  count: number;
  avgEngagement: number;
  avgViews: number;
  topVideoId: string;
}

interface ContentPattern {
  pattern: string;
  count: number;
  examples: string[];
}

interface KeywordAnalysis {
  keyword: string;
  totalVideos: number;
  analyzedAt: string;

  // Aggregate Stats
  aggregateStats: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    avgViews: number;
    avgLikes: number;
    avgComments: number;
    avgShares: number;
    avgEngagementRate: number;
    medianViews: number;
    medianEngagementRate: number;
  };

  // Performance Tiers
  performanceTiers: {
    viral: AnalyzedVideo[]; // Top 10% by engagement
    highPerforming: AnalyzedVideo[]; // Top 10-30%
    average: AnalyzedVideo[]; // Middle 40%
    belowAverage: AnalyzedVideo[]; // Bottom 30%
  };

  // Hashtag Analysis
  hashtagInsights: {
    topHashtags: HashtagInsight[];
    hashtagCombos: { combo: string[]; count: number; avgEngagement: number }[];
    recommendedHashtags: string[];
  };

  // Content Patterns
  contentPatterns: {
    avgDescriptionLength: number;
    commonPhrases: ContentPattern[];
    callToActions: ContentPattern[];
    emojiUsage: { emoji: string; count: number }[];
  };

  // Creator Insights
  creatorInsights: {
    topCreators: {
      id: string;
      name: string;
      videoCount: number;
      avgEngagement: number;
      totalViews: number;
    }[];
    uniqueCreators: number;
  };

  // Actionable Recommendations
  recommendations: {
    optimalHashtagCount: number;
    suggestedHashtags: string[];
    contentTips: string[];
    engagementBenchmarks: {
      toGoViral: string;
      toBeHighPerforming: string;
      averagePerformance: string;
    };
  };

  // AI-Generated Insights (from Gemini)
  aiInsights?: {
    summary: string;
    contentStrategy: string[];
    hashtagStrategy: string[];
    captionTemplates: string[];
    videoIdeas: string[];
    bestPostingAdvice: string;
    audienceInsights: string;
    trendPrediction: string;
  };

  // All videos sorted by engagement
  videos: AnalyzedVideo[];
}

function calculateEngagementRate(stats: VideoStats): number {
  if (!stats.playCount || stats.playCount === 0) return 0;
  return ((stats.likeCount + stats.commentCount + stats.shareCount) / stats.playCount) * 100;
}

function extractPhrases(descriptions: string[]): ContentPattern[] {
  const phraseCount = new Map<string, { count: number; examples: string[] }>();

  // Common TikTok phrases to look for
  const patterns = [
    /wait for it/gi,
    /part \d+/gi,
    /follow for more/gi,
    /link in bio/gi,
    /check this out/gi,
    /you won't believe/gi,
    /this is how/gi,
    /trying this/gi,
    /day \d+/gi,
    /pov:/gi,
    /tutorial/gi,
    /hack/gi,
    /trend/gi,
    /viral/gi,
    /fyp/gi,
    /foryou/gi,
    /duet/gi,
    /stitch/gi,
  ];

  descriptions.forEach((desc) => {
    if (!desc) return;
    const lowerDesc = desc.toLowerCase();

    patterns.forEach((pattern) => {
      const matches = lowerDesc.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const normalized = match.toLowerCase().trim();
          const existing = phraseCount.get(normalized);
          if (existing) {
            existing.count++;
            if (existing.examples.length < 3) {
              existing.examples.push(desc.slice(0, 100));
            }
          } else {
            phraseCount.set(normalized, { count: 1, examples: [desc.slice(0, 100)] });
          }
        });
      }
    });
  });

  return Array.from(phraseCount.entries())
    .map(([pattern, data]) => ({ pattern, count: data.count, examples: data.examples }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function extractEmojis(descriptions: string[]): { emoji: string; count: number }[] {
  const emojiCount = new Map<string, number>();
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

  descriptions.forEach((desc) => {
    if (!desc) return;
    const emojis = desc.match(emojiRegex);
    if (emojis) {
      emojis.forEach((emoji) => {
        emojiCount.set(emoji, (emojiCount.get(emoji) || 0) + 1);
      });
    }
  });

  return Array.from(emojiCount.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

// Generate AI insights using KeywordInsightsAgent
async function generateAIInsights(
  keyword: string,
  analysisData: {
    totalVideos: number;
    avgEngagementRate: number;
    topHashtags: { tag: string; count: number; avgEngagement: number }[];
    viralDescriptions: string[];
    commonPhrases: { pattern: string; count: number }[];
    topCreators: { name: string; avgEngagement: number }[];
    emojiUsage: { emoji: string; count: number }[];
  }
): Promise<KeywordAnalysis["aiInsights"]> {
  try {
    const agent = getKeywordInsightsAgent();
    const context: AgentContext = {
      workflow: {
        artistName: keyword,
        platform: 'tiktok',
        language: 'ko',
        sessionId: `keyword-analysis-${Date.now()}`,
      },
    };

    const result = await agent.analyze({
      keyword,
      totalVideos: analysisData.totalVideos,
      avgEngagementRate: analysisData.avgEngagementRate,
      topHashtags: analysisData.topHashtags,
      viralDescriptions: analysisData.viralDescriptions,
      commonPhrases: analysisData.commonPhrases,
      topCreators: analysisData.topCreators,
      emojiUsage: analysisData.emojiUsage,
    }, context);

    if (result.success && result.data) {
      return {
        summary: result.data.summary || "",
        contentStrategy: result.data.contentStrategy || [],
        hashtagStrategy: result.data.hashtagStrategy || [],
        captionTemplates: result.data.captionTemplates || [],
        videoIdeas: result.data.videoIdeas || [],
        bestPostingAdvice: result.data.bestPostingAdvice || "",
        audienceInsights: result.data.audienceInsights || "",
        trendPrediction: result.data.trendPrediction || "",
      };
    }

    console.warn("[KEYWORD-ANALYSIS] Agent returned no data:", result.error);
    return undefined;
  } catch (error) {
    console.error("[KEYWORD-ANALYSIS] KeywordInsightsAgent error:", error);
    return undefined;
  }
}

function analyzeVideos(videos: any[], keyword: string): KeywordAnalysis {
  // Transform and calculate engagement for each video
  const analyzedVideos: AnalyzedVideo[] = videos
    .map((v) => ({
      id: v.id,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl || null,
      description: v.description || "",
      author: {
        id: v.author.uniqueId,
        name: v.author.nickname,
        avatar: v.author.avatarUrl,
      },
      stats: {
        playCount: v.stats.playCount || 0,
        likeCount: v.stats.likeCount || 0,
        commentCount: v.stats.commentCount || 0,
        shareCount: v.stats.shareCount || 0,
      },
      hashtags: v.hashtags || [],
      engagementRate: calculateEngagementRate(v.stats),
      likeToViewRatio: v.stats.playCount ? (v.stats.likeCount / v.stats.playCount) * 100 : 0,
      rank: 0,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .map((v, i) => ({ ...v, rank: i + 1 }));

  const totalVideos = analyzedVideos.length;
  if (totalVideos === 0) {
    return {
      keyword,
      totalVideos: 0,
      analyzedAt: new Date().toISOString(),
      aggregateStats: {
        totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0,
        avgViews: 0, avgLikes: 0, avgComments: 0, avgShares: 0,
        avgEngagementRate: 0, medianViews: 0, medianEngagementRate: 0,
      },
      performanceTiers: { viral: [], highPerforming: [], average: [], belowAverage: [] },
      hashtagInsights: { topHashtags: [], hashtagCombos: [], recommendedHashtags: [] },
      contentPatterns: { avgDescriptionLength: 0, commonPhrases: [], callToActions: [], emojiUsage: [] },
      creatorInsights: { topCreators: [], uniqueCreators: 0 },
      recommendations: {
        optimalHashtagCount: 5,
        suggestedHashtags: [],
        contentTips: [],
        engagementBenchmarks: { toGoViral: "N/A", toBeHighPerforming: "N/A", averagePerformance: "N/A" },
      },
      videos: [],
    };
  }

  // Aggregate Stats
  const totalViews = analyzedVideos.reduce((sum, v) => sum + v.stats.playCount, 0);
  const totalLikes = analyzedVideos.reduce((sum, v) => sum + v.stats.likeCount, 0);
  const totalComments = analyzedVideos.reduce((sum, v) => sum + v.stats.commentCount, 0);
  const totalShares = analyzedVideos.reduce((sum, v) => sum + v.stats.shareCount, 0);

  const sortedByViews = [...analyzedVideos].sort((a, b) => a.stats.playCount - b.stats.playCount);
  const sortedByEngagement = [...analyzedVideos].sort((a, b) => a.engagementRate - b.engagementRate);
  const medianIndex = Math.floor(totalVideos / 2);

  // Performance Tiers
  const viralThreshold = Math.ceil(totalVideos * 0.1);
  const highThreshold = Math.ceil(totalVideos * 0.3);
  const avgThreshold = Math.ceil(totalVideos * 0.7);

  const performanceTiers = {
    viral: analyzedVideos.slice(0, viralThreshold),
    highPerforming: analyzedVideos.slice(viralThreshold, highThreshold),
    average: analyzedVideos.slice(highThreshold, avgThreshold),
    belowAverage: analyzedVideos.slice(avgThreshold),
  };

  // Hashtag Analysis (excluding generic tags like #fyp, #viral, etc.)
  const hashtagStats = new Map<string, { count: number; totalEngagement: number; totalViews: number; topVideoId: string; topEngagement: number }>();

  analyzedVideos.forEach((v) => {
    v.hashtags.forEach((tag) => {
      const normalized = tag.toLowerCase().replace(/^#/, "");
      // Skip generic/excluded hashtags
      if (isExcludedHashtag(normalized)) return;

      const existing = hashtagStats.get(normalized);
      if (existing) {
        existing.count++;
        existing.totalEngagement += v.engagementRate;
        existing.totalViews += v.stats.playCount;
        if (v.engagementRate > existing.topEngagement) {
          existing.topVideoId = v.id;
          existing.topEngagement = v.engagementRate;
        }
      } else {
        hashtagStats.set(normalized, {
          count: 1,
          totalEngagement: v.engagementRate,
          totalViews: v.stats.playCount,
          topVideoId: v.id,
          topEngagement: v.engagementRate,
        });
      }
    });
  });

  const topHashtags: HashtagInsight[] = Array.from(hashtagStats.entries())
    .map(([tag, data]) => ({
      tag,
      count: data.count,
      avgEngagement: data.totalEngagement / data.count,
      avgViews: data.totalViews / data.count,
      topVideoId: data.topVideoId,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Hashtag Combos (pairs that appear together frequently, excluding generic tags)
  const comboCount = new Map<string, { count: number; totalEngagement: number }>();
  analyzedVideos.forEach((v) => {
    // Filter out excluded hashtags before analyzing combos
    const tags = v.hashtags
      .map((t) => t.toLowerCase().replace(/^#/, ""))
      .filter((t) => !isExcludedHashtag(t))
      .slice(0, 5);
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const combo = [tags[i], tags[j]].sort().join(" + ");
        const existing = comboCount.get(combo);
        if (existing) {
          existing.count++;
          existing.totalEngagement += v.engagementRate;
        } else {
          comboCount.set(combo, { count: 1, totalEngagement: v.engagementRate });
        }
      }
    }
  });

  const hashtagCombos = Array.from(comboCount.entries())
    .filter(([_, data]) => data.count >= 2)
    .map(([combo, data]) => ({
      combo: combo.split(" + "),
      count: data.count,
      avgEngagement: data.totalEngagement / data.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 10);

  // Recommended hashtags (high engagement + moderate usage)
  // Try strict filter first, then relax if no results
  let recommendedHashtags = topHashtags
    .filter((h) => h.count >= 2 && h.avgEngagement > sortedByEngagement[medianIndex].engagementRate)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 10)
    .map((h) => h.tag);

  // Fallback 1: If empty, try with just count >= 1 and above average engagement
  if (recommendedHashtags.length === 0) {
    const avgEngagement = analyzedVideos.reduce((sum, v) => sum + v.engagementRate, 0) / totalVideos;
    recommendedHashtags = topHashtags
      .filter((h) => h.avgEngagement >= avgEngagement)
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 10)
      .map((h) => h.tag);
  }

  // Fallback 2: If still empty, just use top hashtags by engagement
  if (recommendedHashtags.length === 0) {
    recommendedHashtags = topHashtags
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 10)
      .map((h) => h.tag);
  }

  // Content Patterns
  const descriptions = analyzedVideos.map((v) => v.description);
  const avgDescriptionLength = descriptions.reduce((sum, d) => sum + (d?.length || 0), 0) / totalVideos;
  const commonPhrases = extractPhrases(descriptions);
  const emojiUsage = extractEmojis(descriptions);

  // Call to Actions
  const ctaPatterns = [
    { pattern: "follow", regex: /follow/gi },
    { pattern: "like", regex: /like/gi },
    { pattern: "comment", regex: /comment/gi },
    { pattern: "share", regex: /share/gi },
    { pattern: "link in bio", regex: /link in bio/gi },
    { pattern: "save this", regex: /save this/gi },
    { pattern: "tag someone", regex: /tag/gi },
  ];

  const callToActions: ContentPattern[] = ctaPatterns
    .map((cta) => {
      const matches = descriptions.filter((d) => d && cta.regex.test(d));
      return {
        pattern: cta.pattern,
        count: matches.length,
        examples: matches.slice(0, 3).map((d) => d.slice(0, 80)),
      };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  // Creator Insights
  const creatorStats = new Map<string, { name: string; videoCount: number; totalEngagement: number; totalViews: number }>();
  analyzedVideos.forEach((v) => {
    const existing = creatorStats.get(v.author.id);
    if (existing) {
      existing.videoCount++;
      existing.totalEngagement += v.engagementRate;
      existing.totalViews += v.stats.playCount;
    } else {
      creatorStats.set(v.author.id, {
        name: v.author.name,
        videoCount: 1,
        totalEngagement: v.engagementRate,
        totalViews: v.stats.playCount,
      });
    }
  });

  const topCreators = Array.from(creatorStats.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      videoCount: data.videoCount,
      avgEngagement: data.totalEngagement / data.videoCount,
      totalViews: data.totalViews,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 10);

  // Calculate optimal hashtag count
  const hashtagCounts = analyzedVideos.map((v) => v.hashtags.length);
  const viralHashtagCounts = performanceTiers.viral.map((v) => v.hashtags.length);
  const optimalHashtagCount = viralHashtagCounts.length > 0
    ? Math.round(viralHashtagCounts.reduce((a, b) => a + b, 0) / viralHashtagCounts.length)
    : Math.round(hashtagCounts.reduce((a, b) => a + b, 0) / hashtagCounts.length);

  // Generate Content Tips
  const contentTips: string[] = [];

  if (performanceTiers.viral.length > 0) {
    const viralAvgLength = performanceTiers.viral.reduce((sum, v) => sum + (v.description?.length || 0), 0) / performanceTiers.viral.length;
    if (viralAvgLength < 100) {
      contentTips.push("Viral videos tend to have shorter captions (under 100 chars). Keep it punchy!");
    } else if (viralAvgLength > 200) {
      contentTips.push("Top performers use longer, story-driven captions. Tell a story!");
    }
  }

  if (hashtagCombos.length > 0) {
    contentTips.push(`Try combining: #${hashtagCombos[0].combo.join(" + #")} for higher engagement`);
  }

  if (emojiUsage.length > 0) {
    contentTips.push(`Most used emojis: ${emojiUsage.slice(0, 5).map((e) => e.emoji).join(" ")} - consider using these`);
  }

  if (callToActions.length > 0) {
    contentTips.push(`"${callToActions[0].pattern}" appears in ${callToActions[0].count} videos - add a clear CTA`);
  }

  const viralEngagement = performanceTiers.viral.length > 0
    ? performanceTiers.viral[performanceTiers.viral.length - 1].engagementRate
    : 0;
  const highEngagement = performanceTiers.highPerforming.length > 0
    ? performanceTiers.highPerforming[performanceTiers.highPerforming.length - 1].engagementRate
    : 0;

  return {
    keyword,
    totalVideos,
    analyzedAt: new Date().toISOString(),
    aggregateStats: {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      avgViews: Math.round(totalViews / totalVideos),
      avgLikes: Math.round(totalLikes / totalVideos),
      avgComments: Math.round(totalComments / totalVideos),
      avgShares: Math.round(totalShares / totalVideos),
      avgEngagementRate: analyzedVideos.reduce((sum, v) => sum + v.engagementRate, 0) / totalVideos,
      medianViews: sortedByViews[medianIndex].stats.playCount,
      medianEngagementRate: sortedByEngagement[medianIndex].engagementRate,
    },
    performanceTiers,
    hashtagInsights: {
      topHashtags,
      hashtagCombos,
      recommendedHashtags,
    },
    contentPatterns: {
      avgDescriptionLength: Math.round(avgDescriptionLength),
      commonPhrases,
      callToActions,
      emojiUsage,
    },
    creatorInsights: {
      topCreators,
      uniqueCreators: creatorStats.size,
    },
    recommendations: {
      optimalHashtagCount,
      suggestedHashtags: recommendedHashtags.slice(0, 5),
      contentTips,
      engagementBenchmarks: {
        toGoViral: `>${viralEngagement.toFixed(2)}% engagement rate`,
        toBeHighPerforming: `>${highEngagement.toFixed(2)}% engagement rate`,
        averagePerformance: `${sortedByEngagement[medianIndex].engagementRate.toFixed(2)}% engagement rate`,
      },
    },
    videos: analyzedVideos,
  };
}

// Helper to re-assign ranks to videos based on their position
function assignRanks<T extends { rank?: number }>(videos: T[] | null | undefined, startRank: number = 1): T[] {
  if (!videos || !Array.isArray(videos)) return [];
  return videos.map((v, i) => ({ ...v, rank: startRank + i }));
}

// Helper to convert DB record to API response format
function dbToApiFormat(record: any): KeywordAnalysis {
  // Re-assign ranks when loading from cache (ranks may be lost during JSON serialization)
  const viralVideos = assignRanks(record.viralVideos as AnalyzedVideo[] | null, 1);
  const viralCount = viralVideos.length;
  const highPerformingVideos = assignRanks(record.highPerformingVideos as AnalyzedVideo[] | null, viralCount + 1);
  const highCount = highPerformingVideos.length;
  const averageVideos = assignRanks(record.averageVideos as AnalyzedVideo[] | null, viralCount + highCount + 1);

  // Also re-assign ranks to allVideos
  const allVideos = assignRanks(record.allVideos as AnalyzedVideo[] | null, 1);

  console.log(`[KEYWORD-ANALYSIS] dbToApiFormat - viral: ${viralCount}, high: ${highCount}, avg: ${averageVideos.length}, all: ${allVideos.length}`);
  if (viralVideos.length > 0) {
    console.log(`[KEYWORD-ANALYSIS] First viral video rank: ${viralVideos[0].rank}`);
  }

  return {
    keyword: record.keyword,
    totalVideos: record.totalVideos,
    analyzedAt: record.analyzedAt.toISOString(),
    aggregateStats: {
      totalViews: Number(record.totalViews),
      totalLikes: Number(record.totalLikes),
      totalComments: Number(record.totalComments),
      totalShares: Number(record.totalShares),
      avgViews: Number(record.avgViews),
      avgLikes: Number(record.avgLikes),
      avgComments: Number(record.avgComments),
      avgShares: Number(record.avgShares),
      avgEngagementRate: record.avgEngagementRate,
      medianViews: Number(record.medianViews),
      medianEngagementRate: record.medianEngagementRate,
    },
    performanceTiers: {
      viral: viralVideos,
      highPerforming: highPerformingVideos,
      average: averageVideos,
      belowAverage: [],
    },
    hashtagInsights: {
      topHashtags: record.topHashtags as HashtagInsight[],
      hashtagCombos: record.hashtagCombos as any[],
      recommendedHashtags: record.recommendedHashtags,
    },
    contentPatterns: {
      avgDescriptionLength: record.avgDescriptionLength,
      commonPhrases: record.commonPhrases as ContentPattern[],
      callToActions: record.callToActions as ContentPattern[],
      emojiUsage: record.emojiUsage as any[],
    },
    creatorInsights: {
      topCreators: record.topCreators as any[],
      uniqueCreators: record.uniqueCreators,
    },
    recommendations: {
      optimalHashtagCount: record.optimalHashtagCount,
      suggestedHashtags: record.suggestedHashtags,
      contentTips: record.contentTips,
      engagementBenchmarks: record.engagementBenchmarks as any,
    },
    videos: allVideos,
    aiInsights: record.aiInsights as KeywordAnalysis["aiInsights"],
  };
}

// Helper to save daily snapshot to history table
async function saveAnalysisHistoryToDb(analysis: KeywordAnalysis): Promise<void> {
  try {
    // Get today's date at midnight (date-only for daily snapshots)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await withRetry(() => prisma.keywordAnalysisHistory.upsert({
      where: {
        platform_keyword_date: {
          platform: "TIKTOK",
          keyword: analysis.keyword,
          date: today,
        },
      },
      update: {
        totalVideos: analysis.totalVideos,
        totalViews: BigInt(analysis.aggregateStats.totalViews),
        totalLikes: BigInt(analysis.aggregateStats.totalLikes),
        totalComments: BigInt(analysis.aggregateStats.totalComments),
        totalShares: BigInt(analysis.aggregateStats.totalShares),
        avgViews: BigInt(analysis.aggregateStats.avgViews),
        avgLikes: BigInt(analysis.aggregateStats.avgLikes),
        avgComments: BigInt(analysis.aggregateStats.avgComments),
        avgShares: BigInt(analysis.aggregateStats.avgShares),
        avgEngagementRate: analysis.aggregateStats.avgEngagementRate,
        medianViews: BigInt(analysis.aggregateStats.medianViews),
        medianEngagementRate: analysis.aggregateStats.medianEngagementRate,
        viralVideoCount: analysis.performanceTiers.viral.length,
        highPerformingCount: analysis.performanceTiers.highPerforming.length,
        averageVideoCount: analysis.performanceTiers.average.length,
        topHashtags: analysis.hashtagInsights.topHashtags.slice(0, 10) as any,
        uniqueCreators: analysis.creatorInsights.uniqueCreators,
      },
      create: {
        platform: "TIKTOK",
        keyword: analysis.keyword,
        date: today,
        totalVideos: analysis.totalVideos,
        totalViews: BigInt(analysis.aggregateStats.totalViews),
        totalLikes: BigInt(analysis.aggregateStats.totalLikes),
        totalComments: BigInt(analysis.aggregateStats.totalComments),
        totalShares: BigInt(analysis.aggregateStats.totalShares),
        avgViews: BigInt(analysis.aggregateStats.avgViews),
        avgLikes: BigInt(analysis.aggregateStats.avgLikes),
        avgComments: BigInt(analysis.aggregateStats.avgComments),
        avgShares: BigInt(analysis.aggregateStats.avgShares),
        avgEngagementRate: analysis.aggregateStats.avgEngagementRate,
        medianViews: BigInt(analysis.aggregateStats.medianViews),
        medianEngagementRate: analysis.aggregateStats.medianEngagementRate,
        viralVideoCount: analysis.performanceTiers.viral.length,
        highPerformingCount: analysis.performanceTiers.highPerforming.length,
        averageVideoCount: analysis.performanceTiers.average.length,
        topHashtags: analysis.hashtagInsights.topHashtags.slice(0, 10) as any,
        uniqueCreators: analysis.creatorInsights.uniqueCreators,
      },
    }));

    console.log(`[KEYWORD-ANALYSIS] Saved history snapshot for: ${analysis.keyword} on ${today.toISOString().split('T')[0]}`);
  } catch (error) {
    // Don't fail the main save if history fails
    console.error(`[KEYWORD-ANALYSIS] Failed to save history for ${analysis.keyword}:`, error);
  }
}

// Helper to save analysis to database
async function saveAnalysisToDb(analysis: KeywordAnalysis): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000);

  // Sanitize all JSON fields to prevent invalid Unicode sequences
  const sanitizedViralVideos = sanitizeForJson(analysis.performanceTiers.viral);
  const sanitizedHighPerforming = sanitizeForJson(analysis.performanceTiers.highPerforming);
  const sanitizedAverageVideos = sanitizeForJson(analysis.performanceTiers.average);
  const sanitizedTopHashtags = sanitizeForJson(analysis.hashtagInsights.topHashtags);
  const sanitizedHashtagCombos = sanitizeForJson(analysis.hashtagInsights.hashtagCombos);
  const sanitizedRecommendedHashtags = sanitizeForJson(analysis.hashtagInsights.recommendedHashtags);
  const sanitizedCommonPhrases = sanitizeForJson(analysis.contentPatterns.commonPhrases);
  const sanitizedCallToActions = sanitizeForJson(analysis.contentPatterns.callToActions);
  const sanitizedEmojiUsage = sanitizeForJson(analysis.contentPatterns.emojiUsage);
  const sanitizedTopCreators = sanitizeForJson(analysis.creatorInsights.topCreators);
  const sanitizedSuggestedHashtags = sanitizeForJson(analysis.recommendations.suggestedHashtags);
  const sanitizedContentTips = sanitizeForJson(analysis.recommendations.contentTips);
  const sanitizedEngagementBenchmarks = sanitizeForJson(analysis.recommendations.engagementBenchmarks);
  const sanitizedAllVideos = sanitizeForJson(analysis.videos);
  const sanitizedAiInsights = sanitizeForJson(analysis.aiInsights);

  await withRetry(() => prisma.keywordAnalysis.upsert({
    where: {
      platform_keyword: {
        platform: "TIKTOK",
        keyword: analysis.keyword,
      },
    },
    update: {
      totalVideos: analysis.totalVideos,
      totalViews: BigInt(analysis.aggregateStats.totalViews),
      totalLikes: BigInt(analysis.aggregateStats.totalLikes),
      totalComments: BigInt(analysis.aggregateStats.totalComments),
      totalShares: BigInt(analysis.aggregateStats.totalShares),
      avgViews: BigInt(analysis.aggregateStats.avgViews),
      avgLikes: BigInt(analysis.aggregateStats.avgLikes),
      avgComments: BigInt(analysis.aggregateStats.avgComments),
      avgShares: BigInt(analysis.aggregateStats.avgShares),
      avgEngagementRate: analysis.aggregateStats.avgEngagementRate,
      medianViews: BigInt(analysis.aggregateStats.medianViews),
      medianEngagementRate: analysis.aggregateStats.medianEngagementRate,
      viralVideos: sanitizedViralVideos as any,
      highPerformingVideos: sanitizedHighPerforming as any,
      averageVideos: sanitizedAverageVideos as any,
      topHashtags: sanitizedTopHashtags as any,
      hashtagCombos: sanitizedHashtagCombos as any,
      recommendedHashtags: sanitizedRecommendedHashtags,
      avgDescriptionLength: analysis.contentPatterns.avgDescriptionLength,
      commonPhrases: sanitizedCommonPhrases as any,
      callToActions: sanitizedCallToActions as any,
      emojiUsage: sanitizedEmojiUsage as any,
      topCreators: sanitizedTopCreators as any,
      uniqueCreators: analysis.creatorInsights.uniqueCreators,
      optimalHashtagCount: analysis.recommendations.optimalHashtagCount,
      suggestedHashtags: sanitizedSuggestedHashtags,
      contentTips: sanitizedContentTips,
      engagementBenchmarks: sanitizedEngagementBenchmarks as any,
      allVideos: sanitizedAllVideos as any,
      aiInsights: sanitizedAiInsights as any,
      analyzedAt: new Date(),
      expiresAt,
    },
    create: {
      keyword: analysis.keyword,
      platform: "TIKTOK",
      totalVideos: analysis.totalVideos,
      totalViews: BigInt(analysis.aggregateStats.totalViews),
      totalLikes: BigInt(analysis.aggregateStats.totalLikes),
      totalComments: BigInt(analysis.aggregateStats.totalComments),
      totalShares: BigInt(analysis.aggregateStats.totalShares),
      avgViews: BigInt(analysis.aggregateStats.avgViews),
      avgLikes: BigInt(analysis.aggregateStats.avgLikes),
      avgComments: BigInt(analysis.aggregateStats.avgComments),
      avgShares: BigInt(analysis.aggregateStats.avgShares),
      avgEngagementRate: analysis.aggregateStats.avgEngagementRate,
      medianViews: BigInt(analysis.aggregateStats.medianViews),
      medianEngagementRate: analysis.aggregateStats.medianEngagementRate,
      viralVideos: sanitizedViralVideos as any,
      highPerformingVideos: sanitizedHighPerforming as any,
      averageVideos: sanitizedAverageVideos as any,
      topHashtags: sanitizedTopHashtags as any,
      hashtagCombos: sanitizedHashtagCombos as any,
      recommendedHashtags: sanitizedRecommendedHashtags,
      avgDescriptionLength: analysis.contentPatterns.avgDescriptionLength,
      commonPhrases: sanitizedCommonPhrases as any,
      callToActions: sanitizedCallToActions as any,
      emojiUsage: sanitizedEmojiUsage as any,
      topCreators: sanitizedTopCreators as any,
      uniqueCreators: analysis.creatorInsights.uniqueCreators,
      optimalHashtagCount: analysis.recommendations.optimalHashtagCount,
      suggestedHashtags: sanitizedSuggestedHashtags,
      contentTips: sanitizedContentTips,
      engagementBenchmarks: sanitizedEngagementBenchmarks as any,
      allVideos: sanitizedAllVideos as any,
      aiInsights: sanitizedAiInsights as any,
      expiresAt,
    },
  }));

  // Also save daily snapshot to history table
  await saveAnalysisHistoryToDb(analysis);
}

// Process expansion data in background (co-occurrence + account discovery)
async function processExpansionData(
  analysis: KeywordAnalysis,
  videos: any[]
): Promise<void> {
  try {
    console.log(`[KEYWORD-ANALYSIS] Processing expansion data for: ${analysis.keyword}`);

    // 1. Process co-occurrence data from videos
    const videosForCoOccurrence = videos.map(v => ({
      id: v.id,
      authorId: v.author?.uniqueId || v.author?.id || '',
      authorName: v.author?.nickname || v.author?.name || '',
      hashtags: v.hashtags || [],
      stats: {
        engagementRate: v.engagementRate || calculateEngagementRate(v.stats)
      }
    }));

    const coOccurrenceResult = await coOccurrenceAnalyzer.processVideos(
      videosForCoOccurrence,
      analysis.keyword
    );
    console.log(`[KEYWORD-ANALYSIS] Co-occurrence: ${coOccurrenceResult.pairs} pairs from ${coOccurrenceResult.processed} videos`);

    // 2. Process account discovery from videos
    const videosForDiscovery = videos.map(v => ({
      id: v.id,
      authorId: v.author?.uniqueId || v.author?.id,
      authorName: v.author?.nickname || v.author?.name,
      hashtags: v.hashtags || [],
      stats: {
        engagementRate: v.engagementRate || calculateEngagementRate(v.stats)
      }
    }));

    // Get all tracked keywords (for now just use the source keyword)
    const trackedKeywords = [analysis.keyword];

    const discoveredCreators = await accountDiscoveryService.discoverFromVideos(
      videosForDiscovery,
      analysis.keyword,
      trackedKeywords
    );
    console.log(`[KEYWORD-ANALYSIS] Account discovery: ${discoveredCreators.length} creators processed`);

  } catch (error) {
    // Don't fail the main analysis if expansion processing fails
    console.error(`[KEYWORD-ANALYSIS] Expansion processing error for ${analysis.keyword}:`, error);
  }
}

// GET /api/v1/trends/keyword-analysis?keywords=countrymusic,kpop,dance&refresh=true
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keywordsParam = searchParams.get("keywords");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!keywordsParam) {
      return NextResponse.json(
        { detail: "keywords parameter is required (comma-separated, max 3)" },
        { status: 400 }
      );
    }

    const keywords = keywordsParam
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0)
      .slice(0, 3); // Max 3 keywords

    if (keywords.length === 0) {
      return NextResponse.json({ detail: "At least one keyword is required" }, { status: 400 });
    }

    console.log(`[KEYWORD-ANALYSIS] Analyzing keywords: ${keywords.join(", ")}, limit: ${limit}, forceRefresh: ${forceRefresh}`);

    // Verify Prisma client is properly initialized
    if (!prisma || !prisma.keywordAnalysis) {
      console.error("[KEYWORD-ANALYSIS] Prisma client not properly initialized");
      return NextResponse.json(
        { detail: "Database client not initialized. Please run 'npx prisma generate'." },
        { status: 500 }
      );
    }

    // Check cache for each keyword
    const cacheThreshold = new Date(Date.now() - CACHE_DURATION_HOURS * 60 * 60 * 1000);

    const analyses: KeywordAnalysis[] = await Promise.all(
      keywords.map(async (keyword) => {
        try {
          // Check for cached analysis (if not forcing refresh)
          if (!forceRefresh) {
            const cached = await withRetry(() => prisma.keywordAnalysis.findUnique({
              where: {
                platform_keyword: {
                  platform: "TIKTOK",
                  keyword,
                },
              },
            }));

            // Return cached if still valid
            if (cached && cached.analyzedAt > cacheThreshold) {
              console.log(`[KEYWORD-ANALYSIS] Using cached analysis for: ${keyword}`);
              return dbToApiFormat(cached);
            }
          }

          // Fetch fresh data from RapidAPI
          console.log(`[KEYWORD-ANALYSIS] Fetching fresh data for: ${keyword}`);
          const result = await searchTikTok(keyword, limit);

          if (!result.success || result.videos.length === 0) {
            // Check if we have stale cache to return
            const staleCache = await withRetry(() => prisma.keywordAnalysis.findUnique({
              where: {
                platform_keyword: {
                  platform: "TIKTOK",
                  keyword,
                },
              },
            }));

            if (staleCache) {
              console.log(`[KEYWORD-ANALYSIS] Returning stale cache for: ${keyword}`);
              return dbToApiFormat(staleCache);
            }

            return {
              keyword,
              error: "No videos found",
              totalVideos: 0,
            } as any;
          }

          // Analyze videos (no thumbnails - removed preview feature)
          const videosWithoutThumbnails = result.videos.map((v) => ({
            ...v,
            thumbnailUrl: null,
          }));

          const analysis = analyzeVideos(videosWithoutThumbnails, keyword);

          // Generate AI insights using Gemini
          console.log(`[KEYWORD-ANALYSIS] Generating AI insights for: ${keyword}`);
          const aiInsights = await generateAIInsights(keyword, {
            totalVideos: analysis.totalVideos,
            avgEngagementRate: analysis.aggregateStats.avgEngagementRate,
            topHashtags: analysis.hashtagInsights.topHashtags.map(h => ({
              tag: h.tag,
              count: h.count,
              avgEngagement: h.avgEngagement,
            })),
            viralDescriptions: analysis.performanceTiers.viral.map(v => v.description),
            commonPhrases: analysis.contentPatterns.commonPhrases.map(p => ({
              pattern: p.pattern,
              count: p.count,
            })),
            topCreators: analysis.creatorInsights.topCreators.map(c => ({
              name: c.name,
              avgEngagement: c.avgEngagement,
            })),
            emojiUsage: analysis.contentPatterns.emojiUsage,
          });

          if (aiInsights) {
            analysis.aiInsights = aiInsights;
            console.log(`[KEYWORD-ANALYSIS] AI insights generated for: ${keyword}`);
          }

          // Save to database
          await saveAnalysisToDb(analysis);
          console.log(`[KEYWORD-ANALYSIS] Saved analysis for: ${keyword}`);

          // Process expansion data in background (non-blocking)
          processExpansionData(analysis, result.videos).catch(err => {
            console.error(`[KEYWORD-ANALYSIS] Background expansion error for ${keyword}:`, err);
          });

          return analysis;
        } catch (err) {
          console.error(`[KEYWORD-ANALYSIS] Error analyzing ${keyword}:`, err);

          // Try to return stale cache on error
          try {
            const staleCache = await withRetry(() => prisma.keywordAnalysis.findUnique({
              where: {
                platform_keyword: {
                  platform: "TIKTOK",
                  keyword,
                },
              },
            }));

            if (staleCache) {
              console.log(`[KEYWORD-ANALYSIS] Returning stale cache after error for: ${keyword}`);
              return dbToApiFormat(staleCache);
            }
          } catch {}

          return {
            keyword,
            error: err instanceof Error ? err.message : "Analysis failed",
            totalVideos: 0,
          } as any;
        }
      })
    );

    return NextResponse.json({
      success: true,
      keywords,
      analyses,
      analyzedAt: new Date().toISOString(),
      cache: {
        maxAgeHours: CACHE_DURATION_HOURS,
      },
    });
  } catch (err) {
    console.error("[KEYWORD-ANALYSIS] Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to analyze keywords",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
