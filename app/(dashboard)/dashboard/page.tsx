"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
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
import { Progress } from "@/components/ui/progress";
import {
  FolderOpen,
  CheckCircle,
  FileEdit,
  Plus,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Send,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Clock,
  Play,
  RefreshCw,
  BarChart3,
  Upload,
  LayoutGrid,
  ExternalLink,
  Star,
} from "lucide-react";

// Types for dashboard API response
interface DashboardStats {
  summary: {
    campaigns: {
      total: number;
      by_status: Record<string, number>;
    };
    generations: {
      total: number;
      by_status: Record<string, number>;
      scored: number;
      avg_quality_score: number | null;
      high_quality_count: number;
    };
    publishing: {
      total: number;
      by_status: Record<string, number>;
      by_platform: Record<string, number>;
    };
  };
  sns_performance: {
    total_published: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_saves: number;
    avg_engagement_rate: number | null;
    by_platform: Record<string, { posts: number; views: number; likes: number }>;
  };
  campaigns_overview: Array<{
    id: string;
    name: string;
    status: string;
    artist_name: string;
    artist_group: string | null;
    asset_count: number;
    generation_count: number;
    completed_generations: number;
    processing_generations: number;
    published_count: number;
    scheduled_count: number;
    total_views: number;
    updated_at: string;
  }>;
  recent_activity: {
    generations: Array<{
      id: string;
      campaign_id: string;
      campaign_name: string;
      prompt: string;
      output_url: string | null;
      quality_score: number | null;
      created_at: string;
    }>;
    published: Array<{
      id: string;
      campaign_id: string;
      campaign_name: string;
      platform: string;
      account_name: string;
      published_url: string | null;
      view_count: number | null;
      like_count: number | null;
      published_at: string | null;
    }>;
  };
}

export default function DashboardPage() {
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<DashboardStats>("/api/v1/dashboard/stats");

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadDashboard();
    }
  }, [loadDashboard, isAuthenticated, accessToken]);

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    draft: "secondary",
    active: "default",
    completed: "outline",
    archived: "outline",
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "TIKTOK": return "🎵";
      case "YOUTUBE": return "📺";
      case "INSTAGRAM": return "📸";
      case "TWITTER": return "🐦";
      default: return "📱";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back, {user?.name}!</CardTitle>
            <CardDescription>Ready to create amazing AI-generated videos?</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">{error || "Failed to load dashboard"}</p>
            <Button onClick={loadDashboard}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, sns_performance, campaigns_overview, recent_activity } = stats;

  // Calculate workflow progress
  const workflowProgress = {
    assets: campaigns_overview.reduce((sum, c) => sum + c.asset_count, 0),
    generated: summary.generations.by_status.COMPLETED || 0,
    processing: summary.generations.by_status.PROCESSING || 0,
    curated: summary.generations.high_quality_count,
    published: summary.publishing.by_status.PUBLISHED || 0,
    scheduled: summary.publishing.by_status.SCHEDULED || 0,
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of all campaigns and content generation progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/campaigns/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Stats - Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FolderOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Campaigns</p>
                <p className="text-2xl font-bold">{summary.campaigns.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Generated</p>
                <p className="text-2xl font-bold">{workflowProgress.generated}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold">{workflowProgress.processing}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Send className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Published</p>
                <p className="text-2xl font-bold">{workflowProgress.published}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Eye className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">{formatNumber(sns_performance.total_views)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Heart className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Likes</p>
                <p className="text-2xl font-bold">{formatNumber(sns_performance.total_likes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Content Production Pipeline
          </CardTitle>
          <CardDescription>Overall workflow progress across all campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1: Assets */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-full ${workflowProgress.assets > 0 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {workflowProgress.assets > 0 ? <CheckCircle className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-medium">1. Assets</p>
                  <p className="text-sm text-muted-foreground">{workflowProgress.assets} uploaded</p>
                </div>
              </div>
              <div className="hidden md:block absolute top-5 left-full w-full h-0.5 bg-muted -translate-x-4" />
            </div>

            {/* Step 2: Generation */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-full ${workflowProgress.generated > 0 ? "bg-green-500 text-white" : workflowProgress.processing > 0 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {workflowProgress.generated > 0 ? <CheckCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-medium">2. Generate</p>
                  <p className="text-sm text-muted-foreground">
                    {workflowProgress.generated} completed
                    {workflowProgress.processing > 0 && <span className="text-blue-500"> ({workflowProgress.processing} processing)</span>}
                  </p>
                </div>
              </div>
              <div className="pl-10 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="text-green-500">{summary.generations.by_status.COMPLETED || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing</span>
                  <span className="text-blue-500">{summary.generations.by_status.PROCESSING || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending</span>
                  <span>{summary.generations.by_status.PENDING || 0}</span>
                </div>
              </div>
              <div className="hidden md:block absolute top-5 left-full w-full h-0.5 bg-muted -translate-x-4" />
            </div>

            {/* Step 3: Curation */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-full ${workflowProgress.curated > 0 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {workflowProgress.curated > 0 ? <CheckCircle className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-medium">3. Curate</p>
                  <p className="text-sm text-muted-foreground">{workflowProgress.curated} high quality</p>
                </div>
              </div>
              <div className="pl-10 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">High Quality (70%+)</span>
                  <span>{summary.generations.high_quality_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Score</span>
                  <span>{summary.generations.avg_quality_score ? `${summary.generations.avg_quality_score.toFixed(1)}%` : "-"}</span>
                </div>
              </div>
              <div className="hidden md:block absolute top-5 left-full w-full h-0.5 bg-muted -translate-x-4" />
            </div>

            {/* Step 4: Publish */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-full ${workflowProgress.published > 0 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {workflowProgress.published > 0 ? <CheckCircle className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-medium">4. Publish</p>
                  <p className="text-sm text-muted-foreground">{workflowProgress.published} live</p>
                </div>
              </div>
              <div className="pl-10 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Published</span>
                  <span className="text-green-500">{summary.publishing.by_status.PUBLISHED || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled</span>
                  <span className="text-blue-500">{summary.publishing.by_status.SCHEDULED || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Draft</span>
                  <span>{summary.publishing.by_status.DRAFT || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SNS Performance Summary */}
      {sns_performance.total_published > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              SNS Performance
            </CardTitle>
            <CardDescription>Analytics from all published content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Eye className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{formatNumber(sns_performance.total_views)}</p>
                <p className="text-xs text-muted-foreground">Views</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Heart className="w-5 h-5 mx-auto mb-2 text-red-500" />
                <p className="text-2xl font-bold">{formatNumber(sns_performance.total_likes)}</p>
                <p className="text-xs text-muted-foreground">Likes</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <MessageCircle className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{formatNumber(sns_performance.total_comments)}</p>
                <p className="text-xs text-muted-foreground">Comments</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Share2 className="w-5 h-5 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{formatNumber(sns_performance.total_shares)}</p>
                <p className="text-xs text-muted-foreground">Shares</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Star className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
                <p className="text-2xl font-bold">{formatNumber(sns_performance.total_saves)}</p>
                <p className="text-xs text-muted-foreground">Saves</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <TrendingUp className="w-5 h-5 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">
                  {sns_performance.avg_engagement_rate ? `${sns_performance.avg_engagement_rate.toFixed(2)}%` : "-"}
                </p>
                <p className="text-xs text-muted-foreground">Engagement</p>
              </div>
            </div>

            {/* Platform Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(sns_performance.by_platform).map(([platform, data]) => (
                data.posts > 0 && (
                  <div key={platform} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getPlatformIcon(platform)}</span>
                      <span className="font-medium">{platform}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {data.posts}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Views</span>
                        <span className="text-foreground">{formatNumber(data.views)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Likes</span>
                        <span className="text-foreground">{formatNumber(data.likes)}</span>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Progress Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>Campaign Progress</CardTitle>
            <CardDescription>Generation and publishing status per campaign</CardDescription>
          </div>
          <Link href="/campaigns">
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="pt-6">
          {campaigns_overview.length === 0 ? (
            <div className="text-center py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">No campaigns yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first campaign to start generating videos
              </p>
              <Link href="/campaigns/new">
                <Button>Create Campaign</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Campaign</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Assets</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Generated</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Published</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Views</th>
                    <th className="text-right py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns_overview.slice(0, 10).map((campaign) => (
                    <tr key={campaign.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-muted-foreground">{campaign.artist_name}</p>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <Badge variant={statusVariants[campaign.status]}>{campaign.status}</Badge>
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className="text-sm">{campaign.asset_count}</span>
                      </td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-sm font-medium">{campaign.completed_generations}</span>
                          {campaign.processing_generations > 0 && (
                            <span className="text-xs text-blue-500">+{campaign.processing_generations}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-sm font-medium">{campaign.published_count}</span>
                          {campaign.scheduled_count > 0 && (
                            <span className="text-xs text-muted-foreground">({campaign.scheduled_count})</span>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className="text-sm">{formatNumber(campaign.total_views)}</span>
                      </td>
                      <td className="text-right py-3 px-2">
                        <Link href={`/campaigns/${campaign.id}/analytics`}>
                          <Button variant="ghost" size="sm">
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Generations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Recent Generations
            </CardTitle>
            <CardDescription>Latest completed video generations</CardDescription>
          </CardHeader>
          <CardContent>
            {recent_activity.generations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No completed generations yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recent_activity.generations.map((gen) => (
                  <Link
                    key={gen.id}
                    href={`/campaigns/${gen.campaign_id}/analytics`}
                    className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {gen.output_url ? (
                        <video src={gen.output_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{gen.prompt}</p>
                      <p className="text-xs text-muted-foreground">{gen.campaign_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {gen.quality_score && (
                          <Badge variant="outline" className="text-[10px]">
                            <Star className="h-3 w-3 mr-1" />
                            {gen.quality_score.toFixed(0)}%
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(gen.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Published */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Recent Published
            </CardTitle>
            <CardDescription>Latest published content on SNS</CardDescription>
          </CardHeader>
          <CardContent>
            {recent_activity.published.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No published content yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recent_activity.published.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-2xl">{getPlatformIcon(post.platform)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{post.account_name}</p>
                      <p className="text-xs text-muted-foreground">{post.campaign_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {post.view_count !== null && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {formatNumber(post.view_count)}
                          </span>
                        )}
                        {post.like_count !== null && (
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" /> {formatNumber(post.like_count)}
                          </span>
                        )}
                        {post.published_at && (
                          <span>{new Date(post.published_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    {post.published_url && (
                      <a href={post.published_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
