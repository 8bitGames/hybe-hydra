import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { searchTikTok } from "@/lib/tiktok-mcp";
import { isExcludedHashtag } from "@/lib/hashtag-filter";

// Helper to calculate scores
function calculateTrendScore(
  views: number,
  engagement: number,
  viralCount: number
): number {
  if (!views) return 0;
  const viewScore = Math.min(100, Math.log10(views + 1) * 12.5);
  const engagementScore = Math.min(100, engagement * 10);
  const viralBonus = Math.min(20, viralCount * 5);
  return Math.round(viewScore * 0.4 + engagementScore * 0.4 + viralBonus);
}

function calculateViralityScore(viralCount: number, totalVideos: number): number {
  if (!totalVideos || totalVideos === 0) return 0;
  const viralRatio = viralCount / totalVideos;
  return Math.round(Math.min(100, viralRatio * 1000));
}

function calculateGrowthScore(currentValue: number, previousValue: number | null): number {
  if (previousValue === null || previousValue === 0) return 50; // Neutral if no previous data
  const growthRate = ((currentValue - previousValue) / previousValue) * 100;
  // Map growth rate to 0-100 scale (-50% = 0, 0% = 50, +50% = 100)
  return Math.max(0, Math.min(100, 50 + growthRate));
}

// POST /api/v1/trends/saved-keywords/sync - Sync all saved keywords and create today's snapshot
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { keywordIds } = body; // Optional: sync only specific keywords

    // Get user's saved keywords
    const where: any = { userId: user.id };
    if (keywordIds && Array.isArray(keywordIds) && keywordIds.length > 0) {
      where.id = { in: keywordIds };
    }

    const savedKeywords = await prisma.savedKeyword.findMany({
      where,
      include: {
        snapshots: {
          orderBy: { date: "desc" },
          take: 1, // Get last snapshot for growth calculation
        },
      },
    });

    if (savedKeywords.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No saved keywords to sync",
        synced: 0,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: { keyword: string; success: boolean; error?: string }[] = [];

    // Process each keyword
    for (const savedKw of savedKeywords) {
      try {
        // Check if already synced today
        const existingSnapshot = await prisma.keywordDailySnapshot.findUnique({
          where: {
            savedKeywordId_date: {
              savedKeywordId: savedKw.id,
              date: today,
            },
          },
        });

        if (existingSnapshot) {
          results.push({ keyword: savedKw.keyword, success: true, error: "Already synced today" });
          continue;
        }

        // Fetch fresh data from TikTok
        const searchResult = await searchTikTok(savedKw.keyword, 30);

        if (!searchResult.success || searchResult.videos.length === 0) {
          results.push({ keyword: savedKw.keyword, success: false, error: "No videos found" });
          continue;
        }

        // Calculate metrics
        const videos = searchResult.videos;
        const totalViews = videos.reduce((sum, v) => sum + (v.stats?.playCount || 0), 0);
        const totalVideos = videos.length;
        const avgViews = Math.round(totalViews / totalVideos);

        // Calculate engagement
        const avgEngagement = videos.reduce((sum, v) => {
          const stats = v.stats || {};
          const plays = stats.playCount || 1;
          const engagement = ((stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0)) / plays * 100;
          return sum + engagement;
        }, 0) / totalVideos;

        // Count viral videos (top 10% by engagement)
        const engagements = videos.map(v => {
          const stats = v.stats || {};
          const plays = stats.playCount || 1;
          return ((stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0)) / plays * 100;
        }).sort((a, b) => b - a);

        const viralThreshold = engagements[Math.floor(videos.length * 0.1)] || engagements[0];
        const viralCount = engagements.filter(e => e >= viralThreshold).length;
        const highPerformingThreshold = engagements[Math.floor(videos.length * 0.3)] || engagements[0];
        const highPerformingCount = engagements.filter(e => e >= highPerformingThreshold && e < viralThreshold).length;

        // Get previous snapshot for growth calculation
        const previousSnapshot = savedKw.snapshots[0];
        const previousViews = previousSnapshot ? Number(previousSnapshot.totalViews) : null;
        const previousEngagement = previousSnapshot ? previousSnapshot.avgEngagement : null;

        // Calculate growth
        const viewsGrowth = previousViews !== null
          ? ((totalViews - previousViews) / previousViews) * 100
          : null;
        const engagementGrowth = previousEngagement !== null
          ? ((avgEngagement - previousEngagement) / previousEngagement) * 100
          : null;
        const videosGrowth = previousSnapshot
          ? ((totalVideos - previousSnapshot.totalVideos) / previousSnapshot.totalVideos) * 100
          : null;

        // Calculate scores
        const trendScore = calculateTrendScore(totalViews, avgEngagement, viralCount);
        const viralityScore = calculateViralityScore(viralCount, totalVideos);
        const growthScore = calculateGrowthScore(totalViews, previousViews);

        // Extract top hashtags (excluding generic tags like #fyp, #viral, etc.)
        const hashtagCounts = new Map<string, { count: number; totalEngagement: number }>();
        videos.forEach(v => {
          const engagement = ((v.stats?.likeCount || 0) + (v.stats?.commentCount || 0) + (v.stats?.shareCount || 0)) / (v.stats?.playCount || 1) * 100;
          (v.hashtags || []).forEach((tag: string) => {
            const normalized = tag.toLowerCase().replace(/^#/, "");
            // Skip generic/excluded hashtags
            if (isExcludedHashtag(normalized)) return;

            const existing = hashtagCounts.get(normalized);
            if (existing) {
              existing.count++;
              existing.totalEngagement += engagement;
            } else {
              hashtagCounts.set(normalized, { count: 1, totalEngagement: engagement });
            }
          });
        });

        const topHashtags = Array.from(hashtagCounts.entries())
          .map(([tag, data]) => ({
            tag,
            count: data.count,
            avgEngagement: data.totalEngagement / data.count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Create snapshot
        await prisma.keywordDailySnapshot.create({
          data: {
            savedKeywordId: savedKw.id,
            date: today,
            totalViews: BigInt(totalViews),
            avgViews: BigInt(avgViews),
            avgEngagement,
            totalVideos,
            viralCount,
            highPerformingCount,
            viewsGrowth,
            engagementGrowth,
            videosGrowth,
            trendScore,
            viralityScore,
            growthScore,
            topHashtags,
          },
        });

        // Update lastAnalyzedAt
        await prisma.savedKeyword.update({
          where: { id: savedKw.id },
          data: { lastAnalyzedAt: new Date() },
        });

        results.push({ keyword: savedKw.keyword, success: true });
      } catch (err) {
        console.error(`[SYNC] Error syncing ${savedKw.keyword}:`, err);
        results.push({
          keyword: savedKw.keyword,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Synced ${successCount}/${savedKeywords.length} keywords`,
      synced: successCount,
      total: savedKeywords.length,
      results,
    });
  } catch (err) {
    console.error("[SYNC] POST error:", err);
    return NextResponse.json(
      { detail: "Failed to sync keywords" },
      { status: 500 }
    );
  }
}
