"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { saveBridgePrompt, BridgePromptData } from "@/lib/bridge-storage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Play,
  Clock,
  History,
  FileText,
  Link2,
  LayoutGrid,
  Send,
  Star,
  Copy,
  ExternalLink,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  RotateCcw,
  Search,
  Calendar,
  Zap,
  Hash,
} from "lucide-react";

// Types
interface WorkspaceData {
  campaign: {
    id: string;
    name: string;
    status: string;
    artist: { id: string; name: string; group: string | null };
    asset_count: number;
    generation_count: number;
    created_at: string;
  };
  stats: {
    generations: {
      total: number;
      completed: number;
      processing: number;
      failed: number;
      avg_quality: number | null;
      high_quality: number;
    };
    publishing: {
      total: number;
      published: number;
      scheduled: number;
      total_views: number;
      total_likes: number;
    };
    prompts: {
      unique_count: number;
      most_successful: Array<{
        original_input: string;
        avg_quality_score: number | null;
        success_count: number;
      }>;
    };
    trends: {
      unique_count: number;
      top_trends: Array<{
        keyword: string;
        usage_count: number;
        avg_score: number | null;
      }>;
    };
  };
  timeline: Array<{
    id: string;
    type: "generation" | "publish" | "asset";
    date: string;
    data: Record<string, unknown>;
  }>;
  prompts: Array<{
    original_input: string;
    veo_prompt: string;
    trend_keywords: string[];
    prompt_analysis: { intent?: string; trend_applied?: string[] } | null;
    generation_count: number;
    success_count: number;
    success_rate: number;
    avg_quality_score: number | null;
    first_used: string;
    last_used: string;
  }>;
  trends: Array<{
    keyword: string;
    usage_count: number;
    success_count: number;
    avg_score: number | null;
  }>;
  reference_urls: Array<{
    url: string;
    title?: string;
    platform?: string;
    hashtags?: string[];
    used_count: number;
    first_used: string;
  }>;
  generations: Array<{
    id: string;
    prompt: string;
    original_input: string | null;
    trend_keywords: string[];
    prompt_analysis: Record<string, unknown> | null;
    status: string;
    output_url: string | null;
    composed_output_url: string | null;
    quality_score: number | null;
    is_favorite: boolean;
    tags: string[];
    duration_seconds: number;
    aspect_ratio: string;
    reference_image: { id: string; s3_url: string; thumbnail_url: string | null } | null;
    merchandise_refs: Array<{
      context: string;
      merchandise: { id: string; name: string; name_ko: string | null; type: string } | null;
    }>;
    created_at: string;
  }>;
  publishing: Array<{
    id: string;
    platform: string;
    status: string;
    account_name: string;
    generation_id: string | null;
    caption: string | null;
    scheduled_at: string | null;
    published_at: string | null;
    published_url: string | null;
    view_count: number | null;
    like_count: number | null;
    comment_count: number | null;
    share_count: number | null;
    engagement_rate: number | null;
    created_at: string;
  }>;
}

// Utility functions
const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
    case "published":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "processing":
    case "publishing":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "scheduled":
      return <Clock className="w-4 h-4 text-yellow-500" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case "TIKTOK":
      return "🎵";
    case "YOUTUBE":
      return "📺";
    case "INSTAGRAM":
      return "📸";
    case "TWITTER":
      return "🐦";
    default:
      return "📱";
  }
};

const getGradeColor = (score: number | null) => {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 90) return "bg-gradient-to-r from-yellow-400 to-amber-500 text-black";
  if (score >= 80) return "bg-green-500 text-white";
  if (score >= 70) return "bg-blue-500 text-white";
  if (score >= 60) return "bg-orange-500 text-white";
  return "bg-red-500 text-white";
};

const getGrade = (score: number | null) => {
  if (score === null) return "-";
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
};

export default function CampaignWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const campaignId = params.id as string;

  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("timeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedVideo, setSelectedVideo] = useState<WorkspaceData["generations"][0] | null>(null);

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadWorkspace = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<WorkspaceData>(`/api/v1/campaigns/${campaignId}/workspace`);

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data) {
        setData(response.data);
      }
    } catch (err) {
      console.error("Failed to load workspace:", err);
      setError("Failed to load workspace data");
    } finally {
      setLoading(false);
    }
  }, [campaignId, accessToken]);

  useEffect(() => {
    if (accessToken) {
      loadWorkspace();
    }
  }, [loadWorkspace, accessToken]);

  // Navigate to Bridge with prompt context
  const handleReusePrompt = (prompt: WorkspaceData["prompts"][0]) => {
    // Create bridge prompt data for reuse
    const bridgeData: BridgePromptData = {
      campaignId,
      originalPrompt: prompt.original_input,
      transformedPrompt: {
        status: "success",
        veo_prompt: prompt.veo_prompt,
        negative_prompt: "",
        analysis: {
          intent: prompt.prompt_analysis?.intent || "Recreating previous prompt",
          trend_applied: prompt.trend_keywords,
          suggestions: [],
          safety_check: {
            passed: true,
            concerns: [],
          },
        },
        technical_settings: {
          aspect_ratio: "9:16",
          fps: 30,
          duration_seconds: 5,
          guidance_scale: 7.5,
        },
      },
      selectedTrends: prompt.trend_keywords,
      timestamp: Date.now(),
    };

    saveBridgePrompt(bridgeData);
    router.push(`/campaigns/${campaignId}/generate`);
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Navigate to Bridge with trend
  const handleUseTrend = (keyword: string) => {
    router.push(`/bridge?trend=${encodeURIComponent(keyword)}&campaign=${campaignId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">{error || "Failed to load workspace"}</p>
            <Button onClick={loadWorkspace}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { campaign, stats, timeline, prompts, trends, reference_urls, generations, publishing } = data;

  // Filter generations based on search and status
  const filteredGenerations = generations.filter((gen) => {
    if (statusFilter !== "all" && gen.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        gen.prompt.toLowerCase().includes(query) ||
        gen.original_input?.toLowerCase().includes(query) ||
        gen.trend_keywords?.some((t) => t.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/campaigns" className="hover:text-foreground transition-colors">
          Campaigns
        </Link>
        <span>/</span>
        <Link href={`/campaigns/${campaignId}`} className="hover:text-foreground transition-colors">
          {campaign.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">Workspace</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaign Workspace</h1>
          <p className="text-muted-foreground">
            {campaign.name} - {campaign.artist.name}
            {campaign.artist.group && ` (${campaign.artist.group})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadWorkspace}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href={`/campaigns/${campaignId}/generate`}>
            <Button>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Generated</p>
                <p className="text-2xl font-bold">{stats.generations.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Quality</p>
                <p className="text-2xl font-bold">{stats.generations.high_quality}</p>
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
                <p className="text-2xl font-bold">{stats.publishing.published}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prompts</p>
                <p className="text-2xl font-bold">{stats.prompts.unique_count}</p>
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
                <p className="text-2xl font-bold">{formatNumber(stats.publishing.total_views)}</p>
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
                <p className="text-2xl font-bold">{formatNumber(stats.publishing.total_likes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Prompts</span>
          </TabsTrigger>
          <TabsTrigger value="references" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">References</span>
          </TabsTrigger>
          <TabsTrigger value="gallery" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Gallery</span>
          </TabsTrigger>
          <TabsTrigger value="publishing" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Publishing</span>
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Work History</CardTitle>
              <CardDescription>Chronological view of all activities</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No activity yet</p>
                  <Link href={`/campaigns/${campaignId}/generate`}>
                    <Button className="mt-4">Start Generating</Button>
                  </Link>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-6">
                    {timeline.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="relative pl-10">
                        <div className="absolute left-2 w-5 h-5 bg-background border-2 border-border rounded-full flex items-center justify-center">
                          {item.type === "generation" ? (
                            <Sparkles className="h-3 w-3 text-purple-500" />
                          ) : (
                            <Send className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon((item.data as { status?: string }).status || "")}
                                <span className="text-sm font-medium capitalize">
                                  {item.type === "generation" ? "Video Generation" : "Published"}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {(item.data as { status?: string }).status}
                                </Badge>
                              </div>
                              {item.type === "generation" && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {(item.data as { original_input?: string; prompt?: string }).original_input ||
                                    (item.data as { prompt?: string }).prompt}
                                </p>
                              )}
                              {item.type === "publish" && (
                                <p className="text-sm text-muted-foreground">
                                  {getPlatformIcon((item.data as { platform?: string }).platform || "")}{" "}
                                  {(item.data as { account_name?: string }).account_name}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(item.date)}
                                </span>
                                {item.type === "generation" &&
                                  (item.data as { quality_score?: number }).quality_score && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getGradeColor(
                                        (item.data as { quality_score?: number }).quality_score ?? null
                                      )}`}
                                    >
                                      {getGrade((item.data as { quality_score?: number }).quality_score ?? null)}
                                    </span>
                                  )}
                                {((item.data as { trend_keywords?: string[] }).trend_keywords?.length ?? 0) > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Hash className="h-3 w-3" />
                                    {((item.data as { trend_keywords?: string[] }).trend_keywords ?? []).slice(0, 2).join(", ")}
                                  </div>
                                )}
                              </div>
                            </div>
                            {item.type === "generation" && ((item.data as { composed_output_url?: string }).composed_output_url || (item.data as { output_url?: string }).output_url) && (
                              <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                                <video
                                  src={(item.data as { composed_output_url?: string; output_url?: string }).composed_output_url || (item.data as { output_url: string }).output_url}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Library</CardTitle>
              <CardDescription>All prompts used in this campaign. Click to reuse.</CardDescription>
            </CardHeader>
            <CardContent>
              {prompts.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No prompts yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prompts.map((prompt, idx) => (
                    <div
                      key={idx}
                      className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium mb-2">{prompt.original_input}</p>
                          {prompt.veo_prompt !== prompt.original_input && (
                            <details className="mb-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                View optimized prompt
                              </summary>
                              <p className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                                {prompt.veo_prompt}
                              </p>
                            </details>
                          )}
                          {prompt.trend_keywords?.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {prompt.trend_keywords.map((keyword) => (
                                <Badge key={keyword} variant="secondary" className="text-xs">
                                  #{keyword}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Used {prompt.generation_count}x</span>
                            <span className="text-green-500">
                              {prompt.success_rate.toFixed(0)}% success
                            </span>
                            {prompt.avg_quality_score && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getGradeColor(
                                  prompt.avg_quality_score
                                )}`}
                              >
                                Avg: {getGrade(prompt.avg_quality_score)}
                              </span>
                            )}
                            <span>Last: {formatDate(prompt.last_used)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyPrompt(prompt.veo_prompt)}
                            title="Copy prompt"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReusePrompt(prompt)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reuse
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* References Tab */}
        <TabsContent value="references" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trends Used */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trends Used
                </CardTitle>
                <CardDescription>Keywords and hashtags applied to generations</CardDescription>
              </CardHeader>
              <CardContent>
                {trends.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No trends used yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trends.map((trend) => (
                      <div
                        key={trend.keyword}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{trend.keyword}</p>
                            <p className="text-xs text-muted-foreground">
                              Used {trend.usage_count}x • {trend.success_count} successful
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {trend.avg_score && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getGradeColor(
                                trend.avg_score
                              )}`}
                            >
                              {getGrade(trend.avg_score)}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUseTrend(trend.keyword)}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reference URLs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Reference URLs
                </CardTitle>
                <CardDescription>External links used as reference</CardDescription>
              </CardHeader>
              <CardContent>
                {reference_urls.length === 0 ? (
                  <div className="text-center py-8">
                    <Link2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No reference URLs yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reference_urls.map((ref, idx) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {ref.title || ref.url}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{ref.url}</p>
                            {ref.hashtags && ref.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ref.hashtags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[10px]">
                                    #{tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Used {ref.used_count}x • First: {formatDate(ref.first_used)}
                            </p>
                          </div>
                          <a href={ref.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="gallery" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Generated Videos</CardTitle>
                  <CardDescription>All videos generated for this campaign</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search prompts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-[200px]"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 px-3 border rounded-md bg-background text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredGenerations.length === 0 ? (
                <div className="text-center py-12">
                  <LayoutGrid className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No videos found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredGenerations.map((gen) => (
                    <div
                      key={gen.id}
                      className="group relative bg-muted rounded-lg overflow-hidden border hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => (gen.composed_output_url || gen.output_url) && setSelectedVideo(gen)}
                    >
                      <div className="aspect-[9/16] relative">
                        {(gen.composed_output_url || gen.output_url) ? (
                          <video
                            src={gen.composed_output_url || gen.output_url || ""}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                            onMouseLeave={(e) => {
                              const video = e.target as HTMLVideoElement;
                              video.pause();
                              video.currentTime = 0;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {gen.status === "processing" ? (
                              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                            ) : gen.status === "failed" ? (
                              <XCircle className="h-8 w-8 text-red-500" />
                            ) : (
                              <Play className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        )}

                        {/* Status badge */}
                        <Badge
                          variant={
                            gen.status === "completed"
                              ? "default"
                              : gen.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                          className="absolute top-2 left-2 text-xs"
                        >
                          {gen.status}
                        </Badge>

                        {/* Quality score */}
                        {gen.quality_score && (
                          <span
                            className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-bold ${getGradeColor(
                              gen.quality_score
                            )}`}
                          >
                            {getGrade(gen.quality_score)}
                          </span>
                        )}

                        {/* Favorite */}
                        {gen.is_favorite && (
                          <Star className="absolute bottom-2 right-2 h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {gen.original_input || gen.prompt}
                        </p>
                        {gen.trend_keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {gen.trend_keywords?.slice(0, 2).map((tag) => (
                              <span key={tag} className="text-[10px] text-primary">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDate(gen.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Publishing Tab */}
        <TabsContent value="publishing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Published Content</CardTitle>
              <CardDescription>SNS publishing status and performance</CardDescription>
            </CardHeader>
            <CardContent>
              {publishing.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No published content yet</p>
                  <Link href={`/campaigns/${campaignId}/publish`}>
                    <Button className="mt-4">Publish Content</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {publishing.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      <div className="text-3xl">{getPlatformIcon(post.platform)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(post.status)}
                          <span className="font-medium">{post.account_name}</span>
                          <Badge variant="outline" className="capitalize">
                            {post.status}
                          </Badge>
                        </div>
                        {post.caption && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                            {post.caption}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {post.published_at ? (
                            <span>Published: {formatDate(post.published_at)}</span>
                          ) : post.scheduled_at ? (
                            <span>Scheduled: {formatDate(post.scheduled_at)}</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Performance Metrics */}
                      {post.status === "published" && (
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <Eye className="h-4 w-4 mx-auto text-muted-foreground" />
                            <p className="font-medium">{formatNumber(post.view_count)}</p>
                          </div>
                          <div className="text-center">
                            <Heart className="h-4 w-4 mx-auto text-red-500" />
                            <p className="font-medium">{formatNumber(post.like_count)}</p>
                          </div>
                          <div className="text-center">
                            <MessageCircle className="h-4 w-4 mx-auto text-blue-500" />
                            <p className="font-medium">{formatNumber(post.comment_count)}</p>
                          </div>
                          <div className="text-center">
                            <Share2 className="h-4 w-4 mx-auto text-green-500" />
                            <p className="font-medium">{formatNumber(post.share_count)}</p>
                          </div>
                          {post.engagement_rate && (
                            <div className="text-center">
                              <TrendingUp className="h-4 w-4 mx-auto text-purple-500" />
                              <p className="font-medium">{post.engagement_rate.toFixed(2)}%</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* External Link */}
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
        </TabsContent>
      </Tabs>

      {/* Video Preview Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedVideo && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Video Preview
                  {selectedVideo.quality_score && (
                    <span
                      className={`ml-2 px-2 py-0.5 rounded text-sm font-bold ${getGradeColor(
                        selectedVideo.quality_score
                      )}`}
                    >
                      {getGrade(selectedVideo.quality_score)}
                    </span>
                  )}
                  {selectedVideo.is_favorite && (
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedVideo.original_input || selectedVideo.prompt}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Video Player */}
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    src={selectedVideo.composed_output_url || selectedVideo.output_url || ""}
                    controls
                    autoPlay
                    className="w-full max-h-[60vh] object-contain"
                  />
                  {selectedVideo.composed_output_url && (
                    <Badge className="absolute bottom-2 left-2 bg-green-600">
                      With Audio
                    </Badge>
                  )}
                </div>

                {/* Video Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Details</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Duration: {selectedVideo.duration_seconds}s</p>
                      <p>Aspect Ratio: {selectedVideo.aspect_ratio}</p>
                      <p>Created: {formatDate(selectedVideo.created_at)}</p>
                      <p className="flex items-center gap-1">
                        Status: {getStatusIcon(selectedVideo.status)}
                        <span className="capitalize">{selectedVideo.status}</span>
                      </p>
                    </div>
                  </div>

                  {selectedVideo.trend_keywords?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Trends Applied</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedVideo.trend_keywords.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reference Image */}
                {selectedVideo.reference_image && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Reference Image</h4>
                    <img
                      src={selectedVideo.reference_image.thumbnail_url || selectedVideo.reference_image.s3_url}
                      alt="Reference"
                      className="h-24 rounded-lg object-cover"
                    />
                  </div>
                )}

                {/* Merchandise References */}
                {selectedVideo.merchandise_refs?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Merchandise</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedVideo.merchandise_refs.map((ref, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {ref.merchandise?.name || ref.context}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyPrompt(selectedVideo.prompt)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Prompt
                  </Button>
                  <Link href={`/campaigns/${campaignId}/generate`}>
                    <Button size="sm">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Generate Similar
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
