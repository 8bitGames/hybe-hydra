"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import React, { useState, useCallback, useMemo } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n";
import { useDashboardStats, usePerformanceStats, useInvalidateQueries } from "@/lib/queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  FolderOpen,
  CheckCircle,
  Plus,
  ChevronRight,
  Sparkles,
  Send,
  Eye,
  Heart,
  TrendingUp,
  Clock,
  RefreshCw,
  BarChart3,
  Upload,
  LayoutGrid,
  ExternalLink,
  Star,
  Bot,
  Wand2,
  Zap,
  Play,
  Hash,
  Target,
  Video,
  XCircle,
  ArrowRight,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { trackHome, trackTrends, trackQuickCreate } from "@/lib/analytics";
import TrendingVideosTile from "@/components/dashboard/TrendingVideosTile";

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { language } = useI18n();
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Use TanStack Query for data fetching with caching
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: performanceStats, isLoading: perfLoading } = usePerformanceStats();
  const { invalidateDashboard } = useInvalidateQueries();

  const loading = statsLoading || perfLoading;
  const error = statsError?.message || null;

  // Memoized callback functions to prevent re-renders
  const loadDashboard = useCallback(() => {
    refetchStats();
  }, [refetchStats]);

  // Memoized formatNumber function
  const formatNumber = useCallback((num: number | null | undefined): string => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  }, []);

  const handleAnalyzeVideo = useCallback(() => {
    if (tiktokUrl.trim()) {
      router.push(`/bridge?url=${encodeURIComponent(tiktokUrl)}`);
    }
  }, [tiktokUrl, router]);

  const handleSearchTrends = useCallback(() => {
    if (searchKeyword.trim()) {
      router.push(`/trends?keyword=${encodeURIComponent(searchKeyword)}`);
    }
  }, [searchKeyword, router]);

  const handleSoundToggle = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  // Memoized video hover handlers
  const handleVideoMouseOver = useCallback((e: React.MouseEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    if (soundEnabled) {
      videoEl.muted = false;
      videoEl.volume = 0.1; // 10% volume
    }
    videoEl.play();
  }, [soundEnabled]);

  const handleVideoMouseOut = useCallback((e: React.MouseEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    videoEl.pause();
    videoEl.currentTime = 0;
    videoEl.muted = true;
  }, []);

  // Memoized static data
  const popularHashtags = useMemo(() => [
    { tag: "#countrymusic", count: "2.5M" },
    { tag: "#newmusic", count: "1.8M" },
    { tag: "#nashville", count: "1.2M" },
  ], []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {language === "ko" ? "대시보드 로딩 중..." : "Loading dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {language === "ko"
                ? `다시 오신 것을 환영합니다, ${user?.name}님!`
                : `Welcome back, ${user?.name}!`}
            </CardTitle>
            <CardDescription>
              {language === "ko"
                ? "멋진 AI 영상을 만들 준비가 되셨나요?"
                : "Ready to create amazing AI-generated videos?"}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              {error ||
                (language === "ko"
                  ? "대시보드를 불러오지 못했습니다"
                  : "Failed to load dashboard")}
            </p>
            <Button onClick={loadDashboard}>
              {language === "ko" ? "다시 시도" : "Try Again"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, sns_performance, campaigns_overview, recent_activity } = stats;

  const workflowProgress = {
    assets: campaigns_overview.reduce((sum, c) => sum + c.asset_count, 0),
    generated: summary.generations.by_status.COMPLETED || 0,
    processing: summary.generations.by_status.PROCESSING || 0,
    curated: summary.generations.high_quality_count,
    published: summary.publishing.by_status.PUBLISHED || 0,
    scheduled: summary.publishing.by_status.SCHEDULED || 0,
  };

  return (
    <div className="space-y-8 pb-8 px-[7%]">
      {/* Hero Section - Quick Actions */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          {language === "ko" ? "대시보드" : "Dashboard"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {language === "ko"
            ? "무엇을 도와드릴까요? 아래에서 빠르게 시작하세요"
            : "What would you like to do? Get started quickly below"}
        </p>

        {/* Quick Action Cards - Hidden
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors group"
            onClick={() => {
              trackQuickCreate.start();
              router.push("/create?mode=generate");
            }}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    {language === "ko" ? "AI 영상" : "AI Video"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === "ko"
                      ? "텍스트 프롬프트로 즉시 영상 생성"
                      : "Create videos instantly from text prompts"}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors group"
            onClick={() => {
              router.push("/create?mode=compose");
            }}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <Wand2 className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    {language === "ko" ? "컴포즈 영상" : "Compose Video"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === "ko"
                      ? "이미지와 음악으로 영상 제작"
                      : "Create videos with images & music"}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors group"
            onClick={() => {
              trackTrends.explore();
              router.push("/insights");
            }}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    {language === "ko" ? "트렌드 탐색" : "Explore Trends"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === "ko"
                      ? "실시간 TikTok 트렌드 발견"
                      : "Discover real-time TikTok trends"}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </div>
        */}
      </div>

      {/* Key Metrics */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            {language === "ko" ? "주요 지표" : "Key Metrics"}
          </h2>
          <Button variant="outline" size="sm" onClick={loadDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === "ko" ? "새로고침" : "Refresh"}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "캠페인" : "Campaigns"}
                  </p>
                  <p className="text-2xl font-bold">{summary.campaigns.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Video className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "총 영상" : "Total Videos"}
                  </p>
                  <p className="text-2xl font-bold">{performanceStats?.totalVideos || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "성공률" : "Success Rate"}
                  </p>
                  <p className="text-2xl font-bold">
                    {performanceStats?.successRate.toFixed(0) || 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Star className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "평균 품질" : "Avg Quality"}
                  </p>
                  <p className="text-2xl font-bold">
                    {performanceStats?.avgQualityScore.toFixed(0) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "총 조회수" : "Total Views"}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatNumber(sns_performance.total_views)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "참여도" : "Engagement"}
                  </p>
                  <p className="text-2xl font-bold">
                    {sns_performance.avg_engagement_rate
                      ? `${sns_performance.avg_engagement_rate.toFixed(1)}%`
                      : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trending Videos from TikTok */}
      {/* <TrendingVideosTile maxVideos={15} /> */}

      {/* Workflow Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {language === "ko" ? "콘텐츠 제작 파이프라인" : "Content Production Pipeline"}
          </CardTitle>
          <CardDescription>
            {language === "ko"
              ? "에셋에서 발행까지의 전체 프로세스"
              : "End-to-end process from assets to publishing"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Stage Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Stage 1: Assets */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko" ? "에셋" : "Assets"}
                    </p>
                    <p className="text-xl font-bold">{workflowProgress.assets}</p>
                  </div>
                </div>
              </div>

              {/* Stage 2: Generation */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko" ? "생성됨" : "Generated"}
                    </p>
                    <p className="text-xl font-bold">{workflowProgress.generated}</p>
                    {workflowProgress.processing > 0 && (
                      <p className="text-xs text-muted-foreground">
                        +{workflowProgress.processing} {language === "ko" ? "진행 중" : "processing"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Stage 3: Curation */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted">
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko" ? "고품질" : "High Quality"}
                    </p>
                    <p className="text-xl font-bold">{workflowProgress.curated}</p>
                    {workflowProgress.generated > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {((workflowProgress.curated / workflowProgress.generated) * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Stage 4: Publishing */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted">
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko" ? "발행됨" : "Published"}
                    </p>
                    <p className="text-xl font-bold">{workflowProgress.published}</p>
                    {workflowProgress.scheduled > 0 && (
                      <p className="text-xs text-muted-foreground">
                        +{workflowProgress.scheduled} {language === "ko" ? "예약" : "scheduled"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === "ko" ? "전체 완료율" : "Overall Completion"}
                </span>
                <span className="font-medium">
                  {workflowProgress.assets > 0
                    ? `${((workflowProgress.published / workflowProgress.assets) * 100).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>
              <Progress
                value={
                  workflowProgress.assets > 0
                    ? (workflowProgress.published / workflowProgress.assets) * 100
                    : 0
                }
                className="h-2"
              />
              {workflowProgress.processing > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  {language === "ko"
                    ? `${workflowProgress.processing}개 영상 처리 중`
                    : `${workflowProgress.processing} videos processing`}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Campaigns - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>
                {language === "ko" ? "활성 캠페인" : "Active Campaigns"}
              </CardTitle>
              <CardDescription>
                {language === "ko"
                  ? "진행 중인 캠페인 현황"
                  : "Your ongoing campaigns at a glance"}
              </CardDescription>
            </div>
            <Link href="/campaigns">
              <Button variant="outline" size="sm">
                {language === "ko" ? "전체 보기" : "View All"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {campaigns_overview.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">
                  {language === "ko" ? "아직 캠페인이 없습니다" : "No campaigns yet"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === "ko"
                    ? "첫 캠페인을 만들어 시작하세요"
                    : "Create your first campaign to get started"}
                </p>
                <Link href="/campaigns/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    {language === "ko" ? "새 캠페인" : "New Campaign"}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns_overview.slice(0, 5).map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="block p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{campaign.name}</h4>
                        <p className="text-sm text-muted-foreground">{campaign.artist_name}</p>
                      </div>
                      <Badge
                        variant={
                          campaign.status === "active"
                            ? "default"
                            : campaign.status === "completed"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {language === "ko"
                          ? campaign.status === "draft"
                            ? "초안"
                            : campaign.status === "active"
                            ? "활성"
                            : campaign.status === "completed"
                            ? "완료"
                            : campaign.status === "archived"
                            ? "보관됨"
                            : campaign.status
                          : campaign.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          {language === "ko" ? "에셋" : "Assets"}
                        </p>
                        <p className="font-medium">{campaign.asset_count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {language === "ko" ? "생성됨" : "Generated"}
                        </p>
                        <p className="font-medium">{campaign.completed_generations}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {language === "ko" ? "발행됨" : "Published"}
                        </p>
                        <p className="font-medium">{campaign.published_count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {language === "ko" ? "조회수" : "Views"}
                        </p>
                        <p className="font-medium">{formatNumber(campaign.total_views)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insights & Trends - Takes 1 column */}
        <div className="space-y-6">
          {/* Quick Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {language === "ko" ? "빠른 분석" : "Quick Analysis"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === "ko" ? "TikTok URL 분석" : "Analyze TikTok URL"}
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://tiktok.com/@..."
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAnalyzeVideo} disabled={!tiktokUrl.trim()} size="sm">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trending Hashtags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-4 w-4" />
                {language === "ko" ? "트렌딩 해시태그" : "Trending Hashtags"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {popularHashtags.map((hashtag) => (
                <button
                  key={hashtag.tag}
                  onClick={() => {
                    setSearchKeyword(hashtag.tag);
                    handleSearchTrends();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <span className="font-medium">{hashtag.tag}</span>
                  <Badge variant="secondary" className="text-xs">
                    {hashtag.count}
                  </Badge>
                </button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => router.push("/insights")}
              >
                {language === "ko" ? "더 보기" : "View More"}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          {performanceStats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {language === "ko" ? "성능 요약" : "Performance Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === "ko" ? "완료" : "Completed"}
                    </span>
                    <span className="font-medium">
                      {performanceStats.completedVideos}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === "ko" ? "처리 중" : "Processing"}
                    </span>
                    <span className="font-medium">
                      {performanceStats.processingVideos}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === "ko" ? "실패" : "Failed"}
                    </span>
                    <span className="font-medium">
                      {performanceStats.failedVideos}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Activity & SNS Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {language === "ko" ? "최근 활동" : "Recent Activity"}
              </CardTitle>
              <CardDescription>
                {language === "ko" ? "최근 생성 및 발행" : "Latest generations and publishes"}
              </CardDescription>
            </div>
            <Button
              variant={soundEnabled ? "default" : "outline"}
              size="icon"
              onClick={handleSoundToggle}
              title={language === "ko" ? (soundEnabled ? "소리 끄기" : "소리 켜기") : (soundEnabled ? "Mute" : "Unmute")}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent className="min-h-[400px]">
            <div className="space-y-3">
              {recent_activity.generations.length === 0 &&
              recent_activity.published.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{language === "ko" ? "최근 활동이 없습니다" : "No recent activity"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {recent_activity.generations.slice(0, 8).map((gen) => (
                    <Link
                      key={gen.id}
                      href={`/campaigns/${gen.campaign_id}/analytics`}
                      className="group block p-4 rounded-xl border hover:border-primary/50 hover:shadow-md transition-all"
                    >
                      <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden mb-3">
                        {gen.output_url ? (
                          <video
                            src={gen.output_url}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            muted
                            onMouseOver={handleVideoMouseOver}
                            onMouseOut={handleVideoMouseOut}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium line-clamp-2 leading-snug">{gen.prompt}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground truncate">{gen.campaign_name}</p>
                          {gen.quality_score && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              <Star className="h-3 w-3 mr-1" />
                              {gen.quality_score.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SNS Performance */}
        {sns_performance.total_published > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {language === "ko" ? "SNS 성과" : "SNS Performance"}
              </CardTitle>
              <CardDescription>
                {language === "ko" ? "소셜 미디어 지표" : "Social media metrics"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Eye className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xl font-bold">{formatNumber(sns_performance.total_views)}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "조회수" : "Views"}
                  </p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <Heart className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xl font-bold">{formatNumber(sns_performance.total_likes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "좋아요" : "Likes"}
                  </p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <MessageCircle className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xl font-bold">
                    {formatNumber(sns_performance.total_comments)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "댓글" : "Comments"}
                  </p>
                </div>
              </div>

              {/* Platform Breakdown */}
              <div className="mt-4 space-y-2">
                {Object.entries(sns_performance.by_platform)
                  .filter(([_, data]) => data.posts > 0)
                  .slice(0, 3)
                  .map(([platform, data]) => (
                    <div key={platform} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <span className="text-sm font-medium">{platform}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{data.posts} posts</span>
                        <span>{formatNumber(data.views)} views</span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
