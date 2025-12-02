"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";
import { videoApi, VideoGeneration } from "@/lib/video-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  Video,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";

interface PerformanceStats {
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  processingVideos: number;
  avgQualityScore: number;
  avgDuration: number;
  successRate: number;
  videosThisWeek: number;
  videosLastWeek: number;
}

interface CampaignPerformance {
  campaign: Campaign;
  stats: PerformanceStats;
}

export default function PerformancePage() {
  const { language } = useI18n();
  const isKorean = language === "ko";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignPerformance, setCampaignPerformance] = useState<CampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("month");

  // Aggregate stats
  const [aggregateStats, setAggregateStats] = useState<PerformanceStats>({
    totalVideos: 0,
    completedVideos: 0,
    failedVideos: 0,
    processingVideos: 0,
    avgQualityScore: 0,
    avgDuration: 0,
    successRate: 0,
    videosThisWeek: 0,
    videosLastWeek: 0,
  });

  const calculateStats = (videos: VideoGeneration[]): PerformanceStats => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const completed = videos.filter((v) => v.status === "completed");
    const failed = videos.filter((v) => v.status === "failed");
    const processing = videos.filter((v) => v.status === "processing" || v.status === "pending");

    const qualityScores = completed
      .map((v) => v.quality_score)
      .filter((s): s is number => s !== null && s !== undefined);

    const durations = completed
      .map((v) => v.duration_seconds)
      .filter((d): d is number => d !== null && d !== undefined);

    const videosThisWeek = videos.filter(
      (v) => new Date(v.created_at) >= weekAgo
    ).length;

    const videosLastWeek = videos.filter(
      (v) => new Date(v.created_at) >= twoWeeksAgo && new Date(v.created_at) < weekAgo
    ).length;

    return {
      totalVideos: videos.length,
      completedVideos: completed.length,
      failedVideos: failed.length,
      processingVideos: processing.length,
      avgQualityScore:
        qualityScores.length > 0
          ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
          : 0,
      avgDuration:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
      successRate:
        videos.length > 0
          ? (completed.length / (completed.length + failed.length)) * 100 || 0
          : 0,
      videosThisWeek,
      videosLastWeek,
    };
  };

  const fetchData = useCallback(async () => {
    try {
      // Fetch campaigns
      const campaignsResult = await campaignsApi.getAll({ page_size: 50 });
      if (!campaignsResult.data) return;

      const campaignsList = campaignsResult.data.items;
      setCampaigns(campaignsList);

      // Fetch videos for each campaign
      const performanceData: CampaignPerformance[] = [];
      const allVideos: VideoGeneration[] = [];

      await Promise.all(
        campaignsList.map(async (campaign) => {
          try {
            const videosResult = await videoApi.getAll(campaign.id, { page_size: 100 });
            if (videosResult.data) {
              const videos = videosResult.data.items;
              allVideos.push(...videos);
              performanceData.push({
                campaign,
                stats: calculateStats(videos),
              });
            }
          } catch (error) {
            console.error(`Failed to fetch videos for campaign ${campaign.id}:`, error);
          }
        })
      );

      // Sort by total videos
      performanceData.sort((a, b) => b.stats.totalVideos - a.stats.totalVideos);
      setCampaignPerformance(performanceData);

      // Calculate aggregate stats
      setAggregateStats(calculateStats(allVideos));
    } catch (error) {
      console.error("Failed to fetch performance data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getGrowthIndicator = (current: number, previous: number) => {
    if (previous === 0) return { growth: 0, isPositive: true };
    const growth = ((current - previous) / previous) * 100;
    return { growth: Math.abs(growth), isPositive: growth >= 0 };
  };

  const weeklyGrowth = getGrowthIndicator(
    aggregateStats.videosThisWeek,
    aggregateStats.videosLastWeek
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            {isKorean ? "성능 분석" : "Performance Analytics"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isKorean
              ? "모든 캠페인의 영상 생성 성능을 한눈에 확인하세요"
              : "Monitor video generation performance across all campaigns"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{isKorean ? "이번 주" : "This Week"}</SelectItem>
              <SelectItem value="month">{isKorean ? "이번 달" : "This Month"}</SelectItem>
              <SelectItem value="all">{isKorean ? "전체" : "All Time"}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {isKorean ? "새로고침" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Video className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-1 text-sm">
                {weeklyGrowth.isPositive ? (
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                )}
                <span className={weeklyGrowth.isPositive ? "text-green-500" : "text-red-500"}>
                  {weeklyGrowth.growth.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold">{aggregateStats.totalVideos}</p>
              <p className="text-sm text-muted-foreground">
                {isKorean ? "총 영상" : "Total Videos"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold text-green-500">{aggregateStats.completedVideos}</p>
              <p className="text-sm text-muted-foreground">
                {isKorean ? "완료" : "Completed"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold text-red-500">{aggregateStats.failedVideos}</p>
              <p className="text-sm text-muted-foreground">
                {isKorean ? "실패" : "Failed"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold">{aggregateStats.successRate.toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">
                {isKorean ? "성공률" : "Success Rate"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold">{aggregateStats.avgQualityScore.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">
                {isKorean ? "평균 품질" : "Avg Quality"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div className="mt-3">
              <p className="text-3xl font-bold">{aggregateStats.avgDuration.toFixed(0)}s</p>
              <p className="text-sm text-muted-foreground">
                {isKorean ? "평균 길이" : "Avg Duration"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {isKorean ? "주간 활동" : "Weekly Activity"}
          </CardTitle>
          <CardDescription>
            {isKorean
              ? "지난 2주간 영상 생성 추이"
              : "Video generation trends over the past 2 weeks"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-8">
            <div className="p-6 bg-muted/50 rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">
                {isKorean ? "이번 주" : "This Week"}
              </p>
              <p className="text-4xl font-bold">{aggregateStats.videosThisWeek}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isKorean ? "개 영상 생성" : "videos generated"}
              </p>
            </div>
            <div className="p-6 bg-muted/50 rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">
                {isKorean ? "지난 주" : "Last Week"}
              </p>
              <p className="text-4xl font-bold">{aggregateStats.videosLastWeek}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isKorean ? "개 영상 생성" : "videos generated"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            {isKorean ? "캠페인별 성능" : "Campaign Performance"}
          </CardTitle>
          <CardDescription>
            {isKorean
              ? "각 캠페인의 영상 생성 현황"
              : "Video generation status by campaign"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaignPerformance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{isKorean ? "캠페인이 없습니다" : "No campaigns found"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-4 px-4 font-medium">
                      {isKorean ? "캠페인" : "Campaign"}
                    </th>
                    <th className="text-center py-4 px-4 font-medium">
                      {isKorean ? "총 영상" : "Total"}
                    </th>
                    <th className="text-center py-4 px-4 font-medium">
                      {isKorean ? "완료" : "Completed"}
                    </th>
                    <th className="text-center py-4 px-4 font-medium">
                      {isKorean ? "실패" : "Failed"}
                    </th>
                    <th className="text-center py-4 px-4 font-medium">
                      {isKorean ? "처리중" : "Processing"}
                    </th>
                    <th className="text-center py-4 px-4 font-medium">
                      {isKorean ? "성공률" : "Success Rate"}
                    </th>
                    <th className="text-center py-4 px-4 font-medium">
                      {isKorean ? "평균 품질" : "Avg Quality"}
                    </th>
                    <th className="text-right py-4 px-4 font-medium">
                      {isKorean ? "액션" : "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaignPerformance.map(({ campaign, stats }) => (
                    <tr key={campaign.id} className="border-b hover:bg-muted/50">
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-muted-foreground">{campaign.artist_name}</p>
                        </div>
                      </td>
                      <td className="text-center py-4 px-4">
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          {stats.totalVideos}
                        </Badge>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="text-green-500 font-medium">{stats.completedVideos}</span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="text-red-500 font-medium">{stats.failedVideos}</span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="text-blue-500 font-medium">{stats.processingVideos}</span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <Badge
                          variant={stats.successRate >= 80 ? "default" : stats.successRate >= 50 ? "secondary" : "destructive"}
                        >
                          {stats.successRate.toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="font-medium">
                          {stats.avgQualityScore > 0 ? stats.avgQualityScore.toFixed(0) : "-"}
                        </span>
                      </td>
                      <td className="text-right py-4 px-4">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/campaigns/${campaign.id}`}>
                            {isKorean ? "보기" : "View"}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
