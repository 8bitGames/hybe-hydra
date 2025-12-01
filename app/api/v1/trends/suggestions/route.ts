import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { TrendPlatform } from "@prisma/client";

interface TrendSuggestion {
  keyword: string;
  platform: TrendPlatform;
  rank: number;
  prompt_template: string;
  hashtags: string[];
  relevance_score: number;
}

// Generate prompt templates based on trend keywords
function generatePromptTemplate(keyword: string, platform: TrendPlatform): string {
  const templates: Record<TrendPlatform, string[]> = {
    TIKTOK: [
      `Country artist performing "${keyword}" trend with authentic stage presence`,
      `Artist performing "${keyword}" challenge in stylish outfit with warm lighting`,
      `Close-up reaction video in "${keyword}" style with smooth transitions`,
    ],
    YOUTUBE: [
      `Music video inspired by "${keyword}" with cinematic visuals`,
      `Artist vlog featuring "${keyword}" with warm, natural lighting`,
      `Behind-the-scenes content about "${keyword}" with intimate atmosphere`,
    ],
    INSTAGRAM: [
      `Aesthetic portrait in "${keyword}" style with soft bokeh background`,
      `Trendy "${keyword}" inspired photoshoot with golden hour lighting`,
      `Stylized content featuring "${keyword}" theme with vibrant colors`,
    ],
  };

  const platformTemplates = templates[platform];
  return platformTemplates[Math.floor(Math.random() * platformTemplates.length)];
}

// Calculate relevance score based on various factors
function calculateRelevanceScore(trend: {
  rank: number;
  viewCount: bigint | null;
  videoCount: number | null;
  collectedAt: Date;
}): number {
  let score = 100;

  // Lower rank = higher relevance (rank 1 is best)
  score -= Math.min(trend.rank * 2, 40);

  // Higher view count = higher relevance
  if (trend.viewCount) {
    const views = Number(trend.viewCount);
    if (views > 10000000) score += 20;
    else if (views > 1000000) score += 10;
    else if (views > 100000) score += 5;
  }

  // More videos = more established trend
  if (trend.videoCount) {
    if (trend.videoCount > 100000) score += 15;
    else if (trend.videoCount > 10000) score += 10;
    else if (trend.videoCount > 1000) score += 5;
  }

  // Fresher trends = higher relevance
  const hoursOld = (Date.now() - trend.collectedAt.getTime()) / (1000 * 60 * 60);
  if (hoursOld < 6) score += 15;
  else if (hoursOld < 12) score += 10;
  else if (hoursOld < 24) score += 5;

  return Math.min(Math.max(score, 0), 100);
}

// GET /api/v1/trends/suggestions - Get prompt suggestions based on trends
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform")?.toUpperCase() as TrendPlatform | undefined;
    const region = searchParams.get("region") || "KR";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
    const artistId = searchParams.get("artist_id");

    // Get trends from the last 24 hours
    const timeThreshold = new Date();
    timeThreshold.setHours(timeThreshold.getHours() - 24);

    const whereClause: Record<string, unknown> = {
      region,
      collectedAt: {
        gte: timeThreshold,
      },
      rank: {
        lte: 20, // Only top 20 trends
      },
    };

    if (platform) {
      whereClause.platform = platform;
    }

    const trends = await prisma.trendSnapshot.findMany({
      where: whereClause,
      orderBy: [
        { rank: "asc" },
        { collectedAt: "desc" },
      ],
      take: limit * 2, // Fetch more to filter duplicates
    });

    // Get artist info for personalized suggestions
    let artistContext: string | null = null;
    if (artistId) {
      const artist = await prisma.artist.findUnique({
        where: { id: artistId },
        select: { name: true, groupName: true, brandGuidelines: true },
      });
      if (artist) {
        artistContext = `${artist.groupName || artist.name}`;
      }
    }

    // Generate suggestions with deduplication
    const seenKeywords = new Set<string>();
    const suggestions: TrendSuggestion[] = [];

    for (const trend of trends) {
      if (seenKeywords.has(trend.keyword.toLowerCase())) continue;
      seenKeywords.add(trend.keyword.toLowerCase());

      let promptTemplate = generatePromptTemplate(trend.keyword, trend.platform);

      // Personalize with artist context
      if (artistContext) {
        promptTemplate = promptTemplate.replace("Artist", artistContext);
        promptTemplate = promptTemplate.replace("Country artist", artistContext);
      }

      suggestions.push({
        keyword: trend.keyword,
        platform: trend.platform,
        rank: trend.rank,
        prompt_template: promptTemplate,
        hashtags: trend.hashtags,
        relevance_score: calculateRelevanceScore(trend),
      });

      if (suggestions.length >= limit) break;
    }

    // Sort by relevance score
    suggestions.sort((a, b) => b.relevance_score - a.relevance_score);

    return NextResponse.json({
      region,
      platform: platform || "all",
      artist_context: artistContext,
      suggestion_count: suggestions.length,
      suggestions,
    });
  } catch (error) {
    console.error("Get trend suggestions error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
