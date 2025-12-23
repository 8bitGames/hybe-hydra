"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useI18n, type Translations } from "@/lib/i18n";
import { useCampaigns } from "@/lib/queries";
import {
  PublishPlatform,
  PublishStatus,
  getPlatformDisplayName,
  getPlatformIcon,
  getStatusDisplayName,
  formatScheduledTime,
  getTimeUntilPublish,
} from "@/lib/publishing-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  ExternalLink,
  Eye,
  Heart,
  RefreshCw,
  Settings,
  Film,
  Ban,
  Layers,
  Trash2,
  X,
  MessageCircle,
  Share2,
  LayoutGrid,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface ScheduledPost {
  id: string;
  campaign_id: string;
  campaign_name: string;
  generation_id: string;
  platform: PublishPlatform;
  status: PublishStatus;
  caption: string | null;
  hashtags: string[];
  thumbnail_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  published_url: string | null;
  platform_post_id: string | null;
  error_message: string | null;
  social_account: {
    id: string;
    platform: PublishPlatform;
    account_name: string;
    profile_url: string | null;
  };
  generation: {
    id: string;
    prompt: string;
    output_url: string | null;
    aspect_ratio: string;
    duration_seconds: number;
    quality_score: number | null;
  } | null;
  analytics?: {
    view_count: number | null;
    like_count: number | null;
    comment_count: number | null;
    share_count: number | null;
  };
}

type ViewTab = "queue" | "list";

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

export default function PublishingPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const { t, language } = useI18n();

  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>("queue");
  const [statusFilter, setStatusFilter] = useState<PublishStatus | "ALL">("ALL");
  const [platformFilter, setPlatformFilter] = useState<PublishPlatform | "ALL">("ALL");
  const [campaignFilter, setCampaignFilter] = useState<string>("ALL");
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  // Fetch campaigns for filter
  const { data: campaignsData } = useCampaigns();
  const campaigns = campaignsData?.items || [];

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    try {
      const response = await api.get<{
        items: any[];
        total: number;
        page: number;
        page_size: number;
        pages: number;
      }>("/api/v1/publishing/schedule?page_size=100");

      if (response.data?.items) {
        const allPosts: ScheduledPost[] = response.data.items.map((post: any) => ({
          id: post.id,
          campaign_id: post.campaign_id,
          campaign_name: post.generation?.campaign?.name || "Unknown Campaign",
          generation_id: post.generation_id,
          platform: post.platform,
          status: post.status,
          caption: post.caption,
          hashtags: post.hashtags || [],
          thumbnail_url: post.thumbnail_url,
          scheduled_at: post.scheduled_at,
          published_at: post.published_at,
          published_url: post.published_url,
          platform_post_id: post.platform_post_id,
          error_message: post.error_message,
          social_account: post.social_account || {
            id: "",
            platform: post.platform,
            account_name: "Unknown",
            profile_url: null,
          },
          generation: post.generation,
          analytics: post.analytics,
        }));

        allPosts.sort((a, b) => {
          const dateA = a.published_at || a.scheduled_at || "";
          const dateB = b.published_at || b.scheduled_at || "";
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        setPosts(allPosts);
      }
    } catch (err) {
      console.error("Failed to load publishing data:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh when there are PUBLISHING posts (polling fallback for callback failures)
  const hasPublishingPosts = useMemo(() => {
    return posts.some((post) => post.status === "PUBLISHING");
  }, [posts]);

  useEffect(() => {
    if (!hasPublishingPosts) return;

    // Poll every 5 seconds when there are publishing posts
    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, [hasPublishingPosts, loadData]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (statusFilter !== "ALL" && post.status !== statusFilter) return false;
      if (platformFilter !== "ALL" && post.platform !== platformFilter) return false;
      if (campaignFilter !== "ALL" && post.campaign_id !== campaignFilter) return false;
      return true;
    });
  }, [posts, statusFilter, platformFilter, campaignFilter]);

  // Stats
  const stats = useMemo(() => {
    const baseFilter = (post: ScheduledPost) => {
      if (platformFilter !== "ALL" && post.platform !== platformFilter) return false;
      if (campaignFilter !== "ALL" && post.campaign_id !== campaignFilter) return false;
      return true;
    };

    const filtered = posts.filter(baseFilter);
    return {
      total: filtered.length,
      publishing: filtered.filter((p) => p.status === "PUBLISHING").length,
      scheduled: filtered.filter((p) => p.status === "SCHEDULED").length,
      published: filtered.filter((p) => p.status === "PUBLISHED").length,
      draft: filtered.filter((p) => p.status === "DRAFT").length,
      failed: filtered.filter((p) => p.status === "FAILED").length,
      cancelled: filtered.filter((p) => p.status === "CANCELLED").length,
      totalViews: filtered.reduce((sum, p) => sum + (p.analytics?.view_count || 0), 0),
      totalLikes: filtered.reduce((sum, p) => sum + (p.analytics?.like_count || 0), 0),
    };
  }, [posts, platformFilter, campaignFilter]);

  // Group posts by status for queue view
  const queueGroups = useMemo(() => ({
    publishing: filteredPosts.filter((p) => p.status === "PUBLISHING"),
    scheduled: filteredPosts.filter((p) => p.status === "SCHEDULED"),
    draft: filteredPosts.filter((p) => p.status === "DRAFT"),
    published: filteredPosts.filter((p) => p.status === "PUBLISHED"),
    failed: filteredPosts.filter((p) => p.status === "FAILED"),
    cancelled: filteredPosts.filter((p) => p.status === "CANCELLED"),
  }), [filteredPosts]);

  const handleCancelPost = async (postId: string) => {
    try {
      await api.patch(`/api/v1/publishing/schedule/${postId}`, { status: "CANCELLED" });
      loadData();
    } catch (err) {
      console.error("Failed to cancel post:", err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await api.delete(`/api/v1/publishing/schedule/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error("Failed to delete post:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-[7%] pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t.publish?.title || "Publishing Management"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t.publish?.manageSchedule || "Manage your scheduled posts across all campaigns"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {language === "ko" ? "새로고침" : "Refresh"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/settings/accounts")}>
            <Settings className="h-4 w-4 mr-2" />
            {language === "ko" ? "계정 관리" : "Accounts"}
          </Button>
        </div>
      </div>

      {/* Stats - Card Grid (Monochrome Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: t.publish?.total || "Total", value: stats.total, key: "ALL", icon: Layers },
          { label: t.publish?.publishing || "Publishing", value: stats.publishing, key: "PUBLISHING", icon: RefreshCw },
          { label: t.publish?.scheduled || "Scheduled", value: stats.scheduled, key: "SCHEDULED", icon: Clock },
          { label: t.publish?.published || "Published", value: stats.published, key: "PUBLISHED", icon: CheckCircle },
          { label: t.publish?.drafts || "Drafts", value: stats.draft, key: "DRAFT", icon: Film },
          { label: t.publish?.failed || "Failed", value: stats.failed, key: "FAILED", icon: AlertCircle },
          { label: t.publish?.cancelled || "Cancelled", value: stats.cancelled, key: "CANCELLED", icon: Ban },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.key}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                statusFilter === stat.key && "ring-2 ring-primary border-primary"
              )}
              onClick={() => setStatusFilter(stat.key as PublishStatus | "ALL")}
            >
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Icon className={cn(
                      "h-5 w-5 text-zinc-700 dark:text-zinc-300",
                      stat.key === "PUBLISHING" && stats.publishing > 0 && "animate-spin"
                    )} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            {([
              { key: "queue", label: t.publish?.queue || "Queue", icon: LayoutGrid },
              { key: "list", label: t.publish?.list || "List", icon: List },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Campaign Filter */}
          <Select value={campaignFilter} onValueChange={(v) => setCampaignFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={language === "ko" ? "모든 캠페인" : "All Campaigns"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{language === "ko" ? "모든 캠페인" : "All Campaigns"}</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Platform Filter */}
          <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PublishPlatform | "ALL")}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t.publish?.allPlatforms || "All Platforms"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.publish?.allPlatforms || "All Platforms"}</SelectItem>
              <SelectItem value="TIKTOK">{getPlatformIcon("TIKTOK")} TikTok</SelectItem>
              <SelectItem value="YOUTUBE">{getPlatformIcon("YOUTUBE")} YouTube</SelectItem>
              <SelectItem value="INSTAGRAM">{getPlatformIcon("INSTAGRAM")} Instagram</SelectItem>
              <SelectItem value="TWITTER">{getPlatformIcon("TWITTER")} Twitter/X</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty State */}
      {filteredPosts.length === 0 && (
        <Card className="p-12 text-center">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-10 h-10 text-zinc-700 dark:text-zinc-300" />
          </div>
          <h3 className="text-xl font-medium text-foreground mb-2">
            {t.publish?.noScheduledPosts || "No scheduled posts"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {language === "ko"
              ? "캠페인의 발행 탭에서 게시물을 예약하세요"
              : "Schedule posts from your campaign's Publish tab"}
          </p>
          <Button onClick={() => router.push("/campaigns")}>
            {language === "ko" ? "캠페인으로 이동" : "Go to Campaigns"}
          </Button>
        </Card>
      )}

      {/* Queue View */}
      {activeTab === "queue" && filteredPosts.length > 0 && (
        <div className="space-y-8">
          {/* Publishing Posts */}
          {queueGroups.publishing.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-zinc-700 dark:text-zinc-300 animate-spin" />
                  </div>
                  {t.publish?.publishingPosts || "Publishing"} ({queueGroups.publishing.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {queueGroups.publishing.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onCancel={() => handleCancelPost(post.id)}
                      onDelete={() => handleDeletePost(post.id)}
                      onClick={() => setSelectedPost(post)}
                      t={t}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scheduled Posts */}
          {queueGroups.scheduled.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                </div>
                {t.publish?.scheduledPosts || "Scheduled"} ({queueGroups.scheduled.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {queueGroups.scheduled
                  .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
                  .map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onCancel={() => handleCancelPost(post.id)}
                      onDelete={() => handleDeletePost(post.id)}
                      onClick={() => setSelectedPost(post)}
                      t={t}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Draft Posts */}
          {queueGroups.draft.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Film className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                </div>
                {t.publish?.draftPosts || "Drafts"} ({queueGroups.draft.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {queueGroups.draft.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
                    onClick={() => setSelectedPost(post)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Published Posts */}
          {queueGroups.published.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                </div>
                {t.publish?.publishedPosts || "Published"} ({queueGroups.published.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {queueGroups.published.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
                    onClick={() => setSelectedPost(post)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Failed Posts */}
          {queueGroups.failed.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  </div>
                  {t.publish?.failedPosts || "Failed"} ({queueGroups.failed.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {queueGroups.failed.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onCancel={() => handleCancelPost(post.id)}
                      onDelete={() => handleDeletePost(post.id)}
                      onClick={() => setSelectedPost(post)}
                      t={t}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancelled Posts */}
          {queueGroups.cancelled.length > 0 && (
            <div className="opacity-60">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Ban className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                </div>
                {t.publish?.cancelledPosts || "Cancelled"} ({queueGroups.cancelled.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {queueGroups.cancelled.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
                    onClick={() => setSelectedPost(post)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {activeTab === "list" && filteredPosts.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg border transition-colors hover:bg-muted/50 cursor-pointer",
                    post.status === "CANCELLED" && "opacity-60"
                  )}
                  onClick={() => setSelectedPost(post)}
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {post.generation?.output_url || post.thumbnail_url ? (
                      <video
                        src={post.generation?.output_url || post.thumbnail_url || ""}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{post.social_account.account_name}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {getPlatformIcon(post.platform)} {getPlatformDisplayName(post.platform)}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        post.status === "PUBLISHED" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                        post.status === "SCHEDULED" && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                        post.status === "PUBLISHING" && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
                        post.status === "FAILED" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
                        post.status === "DRAFT" && "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
                        post.status === "CANCELLED" && "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                      )}>
                        {post.status === "PUBLISHING" && <RefreshCw className="w-3 h-3 inline mr-1 animate-spin" />}
                        {getStatusDisplayName(post.status)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {post.campaign_name} • {post.caption || (language === "ko" ? "캡션 없음" : "No caption")}
                    </p>
                    {post.scheduled_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatScheduledTime(post.scheduled_at)}
                      </p>
                    )}
                  </div>

                  {/* Analytics for published */}
                  {post.status === "PUBLISHED" && post.analytics && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatNumber(post.analytics.view_count)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {formatNumber(post.analytics.like_count)}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {post.published_url && (
                      <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                        <a href={post.published_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post Detail Modal */}
      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{selectedPost && getPlatformIcon(selectedPost.platform)}</span>
              {language === "ko" ? "발행 상세" : "Post Details"}
            </DialogTitle>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-4">
              {/* Video Preview */}
              {(selectedPost.generation?.output_url || selectedPost.thumbnail_url) && (
                <div className="flex justify-center">
                  <div className="aspect-[9/16] w-[180px] bg-muted rounded-lg overflow-hidden">
                    <video
                      src={selectedPost.generation?.output_url || selectedPost.thumbnail_url || ""}
                      className="w-full h-full object-cover"
                      controls
                    />
                  </div>
                </div>
              )}

              {/* Platform, Status & Account */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {language === "ko" ? "플랫폼" : "Platform"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{getPlatformIcon(selectedPost.platform)}</span>
                    <span className="font-medium text-sm">{getPlatformDisplayName(selectedPost.platform)}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {language === "ko" ? "상태" : "Status"}
                  </span>
                  <Badge variant={selectedPost.status === "PUBLISHED" ? "default" : "secondary"}>
                    {getStatusDisplayName(selectedPost.status)}
                  </Badge>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {language === "ko" ? "계정" : "Account"}
                  </span>
                  <span className="font-medium text-sm">{selectedPost.social_account.account_name}</span>
                </div>
              </div>

              {/* Campaign */}
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  {language === "ko" ? "캠페인" : "Campaign"}
                </span>
                <span className="font-medium text-sm">{selectedPost.campaign_name}</span>
              </div>

              {/* Caption */}
              {selectedPost.caption && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {language === "ko" ? "캡션" : "Caption"}
                  </span>
                  <p className="text-sm bg-muted/50 p-2 rounded-lg whitespace-pre-wrap">
                    {selectedPost.caption}
                  </p>
                </div>
              )}

              {/* Hashtags */}
              {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {language === "ko" ? "해시태그" : "Hashtags"}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedPost.hashtags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        #{tag.replace(/^#/, "")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule/Publish Time */}
              {selectedPost.published_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === "ko" ? "발행 일시" : "Published At"}
                  </span>
                  <span>{new Date(selectedPost.published_at).toLocaleString()}</span>
                </div>
              )}
              {selectedPost.scheduled_at && !selectedPost.published_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === "ko" ? "예약 일시" : "Scheduled At"}
                  </span>
                  <span>{new Date(selectedPost.scheduled_at).toLocaleString()}</span>
                </div>
              )}

              {/* Analytics (for published posts) */}
              {selectedPost.status === "PUBLISHED" && selectedPost.analytics && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">
                    {language === "ko" ? "성과" : "Analytics"}
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatNumber(selectedPost.analytics.view_count)}</p>
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "조회" : "Views"}</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <Heart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatNumber(selectedPost.analytics.like_count)}</p>
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "좋아요" : "Likes"}</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <MessageCircle className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatNumber(selectedPost.analytics.comment_count)}</p>
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "댓글" : "Comments"}</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <Share2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatNumber(selectedPost.analytics.share_count)}</p>
                      <p className="text-xs text-muted-foreground">{language === "ko" ? "공유" : "Shares"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {selectedPost.status === "FAILED" && selectedPost.error_message && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2 text-destructive">
                    {language === "ko" ? "오류 메시지" : "Error Message"}
                  </p>
                  <p className="text-sm text-muted-foreground bg-destructive/10 p-3 rounded-lg">
                    {selectedPost.error_message}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {selectedPost.published_url && (
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={selectedPost.published_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {language === "ko" ? "게시물 보기" : "View Post"}
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedPost(null);
                    router.push(`/campaigns/${selectedPost.campaign_id}`);
                  }}
                >
                  {language === "ko" ? "캠페인으로 이동" : "Go to Campaign"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// PostCard Component
function PostCard({
  post,
  onCancel,
  onDelete,
  onClick,
  t,
}: {
  post: ScheduledPost;
  onCancel: () => void;
  onDelete: () => void;
  onClick: () => void;
  t: Translations;
}) {
  const [thumbnailError, setThumbnailError] = React.useState(false);
  const videoUrl = post.generation?.output_url || post.thumbnail_url;
  const showPlaceholder = !videoUrl || thumbnailError;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all hover:shadow-md group cursor-pointer",
        post.status === "CANCELLED" && "opacity-60"
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 relative group">
        {showPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <Film className="w-10 h-10 mb-2 opacity-50" />
            <span className="text-xs opacity-50">
              {thumbnailError ? (t.publish?.thumbnailExpired || "Thumbnail expired") : (t.publish?.noThumbnail || "No preview")}
            </span>
          </div>
        ) : (
          <video
            src={videoUrl || ""}
            className="w-full h-full object-cover"
            muted
            playsInline
            onError={() => setThumbnailError(true)}
            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
          />
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Platform Badge - Monochrome */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-black/60 text-white backdrop-blur-sm">
            {getPlatformIcon(post.platform)} {getPlatformDisplayName(post.platform)}
          </span>
        </div>

        {/* Status Badge - Monochrome */}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-black/60 text-white backdrop-blur-sm flex items-center gap-1">
            {post.status === "PUBLISHING" && <RefreshCw className="w-3 h-3 animate-spin" />}
            {post.status === "SCHEDULED" && <Clock className="w-3 h-3" />}
            {post.status === "PUBLISHED" && <CheckCircle className="w-3 h-3" />}
            {post.status === "FAILED" && <AlertCircle className="w-3 h-3" />}
            {post.status === "CANCELLED" && <Ban className="w-3 h-3" />}
            {post.status === "DRAFT" && <Film className="w-3 h-3" />}
            {getStatusDisplayName(post.status)}
          </span>
        </div>

        {/* Time Until */}
        {post.status === "SCHEDULED" && post.scheduled_at && (
          <div className="absolute bottom-2 right-2">
            <span className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-white flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getTimeUntilPublish(post.scheduled_at)}
            </span>
          </div>
        )}

        {/* Publishing Animation Overlay */}
        {post.status === "PUBLISHING" && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
              <Send className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3">
        {/* Account & Campaign */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs">
            <span className="text-zinc-700 dark:text-zinc-300">{getPlatformIcon(post.platform)}</span>
          </div>
          <span className="text-foreground font-medium text-sm truncate">
            {post.social_account.account_name}
          </span>
        </div>

        {/* Campaign Name */}
        <p className="text-xs text-muted-foreground mb-2 truncate">
          {post.campaign_name}
        </p>

        {/* Caption Preview */}
        <p className="text-muted-foreground text-sm line-clamp-2 mb-3 min-h-[2.5rem]">
          {post.caption || <span className="italic opacity-60">{t.publish?.noCaption || "No caption"}</span>}
        </p>

        {/* Scheduled Time */}
        {post.scheduled_at && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-3">
            <Calendar className="w-3 h-3" />
            {formatScheduledTime(post.scheduled_at)}
          </div>
        )}

        {/* Error Message */}
        {post.error_message && (
          <div className="bg-muted border border-border rounded-lg p-2 mb-3">
            <p className="text-muted-foreground text-xs line-clamp-2 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {post.error_message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
          {post.published_url && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={post.published_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                {t.publish?.viewPost || "View"}
              </a>
            </Button>
          )}
          {post.status === "SCHEDULED" && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="w-3 h-3 mr-1" />
              {t.publish?.cancel || "Cancel"}
            </Button>
          )}
          {post.status === "FAILED" && (
            <Button variant="outline" size="sm" className="flex-1">
              <RefreshCw className="w-3 h-3 mr-1" />
              {t.publish?.retry || "Retry"}
            </Button>
          )}
          {post.status !== "PUBLISHED" && post.status !== "PUBLISHING" && (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
