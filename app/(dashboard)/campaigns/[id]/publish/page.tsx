"use client";

import React, { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { VideoGeneration } from "@/lib/video-api";
import { useCampaign, useVideos } from "@/lib/queries";
import {
  socialAccountsApi,
  scheduledPostsApi,
  SocialAccount,
  ScheduledPost,
  PublishPlatform,
  PublishStatus,
  getPlatformDisplayName,
  getPlatformIcon,
  getPlatformColor,
  getStatusDisplayName,
  getStatusColor,
  formatScheduledTime,
  getTimeUntilPublish,
} from "@/lib/publishing-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, X, Play, Trash2, ExternalLink, Clock, Check, CheckCircle, Send, Film, RefreshCw, Ban, ArrowLeft, Layers, AlertCircle } from "lucide-react";
import { useI18n, type Translations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ViewTab = "calendar" | "list" | "queue";

export default function PublishingPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const campaignId = params.id as string;

  // Use TanStack Query for data fetching with caching
  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useCampaign(campaignId);
  const { data: videosData, isLoading: videosLoading } = useVideos(campaignId, { status: "completed", page_size: 100 });

  const generations = videosData?.items || [];

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const loading = campaignLoading || videosLoading || accountsLoading;

  // View state
  const [activeTab, setActiveTab] = useState<ViewTab>("queue");
  const [statusFilter, setStatusFilter] = useState<PublishStatus | "ALL">("ALL");
  const [platformFilter, setPlatformFilter] = useState<PublishPlatform | "ALL">("ALL");

  // Modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState<VideoGeneration | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [scheduleCaption, setScheduleCaption] = useState("");
  const [scheduleHashtags, setScheduleHashtags] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Load accounts and scheduled posts on mount (these APIs don't have query hooks yet)
  const loadExtraData = useCallback(async () => {
    try {
      const [accountsResult, postsResult] = await Promise.all([
        socialAccountsApi.getAll(),
        scheduledPostsApi.getAll({ campaign_id: campaignId, page_size: 100 }),
      ]);

      if (accountsResult.data) setAccounts(accountsResult.data.accounts);
      if (postsResult.data) setScheduledPosts(postsResult.data.items);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setAccountsLoading(false);
    }
  }, [campaignId]);

  // Load extra data on mount
  React.useEffect(() => {
    loadExtraData();
  }, [loadExtraData]);

  // Auto-refresh when there are PUBLISHING posts (polling fallback for callback failures)
  const hasPublishingPosts = React.useMemo(() => {
    return scheduledPosts.some((post) => post.status === "PUBLISHING");
  }, [scheduledPosts]);

  React.useEffect(() => {
    if (!hasPublishingPosts) return;

    // Poll every 5 seconds when there are publishing posts
    const interval = setInterval(() => {
      loadExtraData();
    }, 5000);

    return () => clearInterval(interval);
  }, [hasPublishingPosts, loadExtraData]);

  // Redirect if campaign not found
  if (campaignError) {
    router.push("/campaigns");
  }

  // Filter posts
  const filteredPosts = scheduledPosts.filter((post) => {
    if (statusFilter !== "ALL" && post.status !== statusFilter) return false;
    if (platformFilter !== "ALL" && post.platform !== platformFilter) return false;
    return true;
  });

  // Group posts by status for queue view
  const queueGroups = {
    publishing: filteredPosts.filter((p) => p.status === "PUBLISHING"),
    scheduled: filteredPosts.filter((p) => p.status === "SCHEDULED"),
    draft: filteredPosts.filter((p) => p.status === "DRAFT"),
    published: filteredPosts.filter((p) => p.status === "PUBLISHED"),
    failed: filteredPosts.filter((p) => p.status === "FAILED"),
    cancelled: filteredPosts.filter((p) => p.status === "CANCELLED"),
  };

  // Stats
  const stats = {
    total: scheduledPosts.length,
    publishing: scheduledPosts.filter((p) => p.status === "PUBLISHING").length,
    scheduled: scheduledPosts.filter((p) => p.status === "SCHEDULED").length,
    published: scheduledPosts.filter((p) => p.status === "PUBLISHED").length,
    draft: scheduledPosts.filter((p) => p.status === "DRAFT").length,
    failed: scheduledPosts.filter((p) => p.status === "FAILED").length,
    cancelled: scheduledPosts.filter((p) => p.status === "CANCELLED").length,
  };

  // Handle schedule creation
  const handleSchedule = async () => {
    if (!selectedGeneration || !selectedAccount) return;

    setScheduling(true);
    try {
      const scheduledAt = scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        : undefined;

      const result = await scheduledPostsApi.create({
        campaign_id: campaignId,
        generation_id: selectedGeneration.id,
        social_account_id: selectedAccount,
        caption: scheduleCaption || undefined,
        hashtags: scheduleHashtags,
        scheduled_at: scheduledAt,
      });

      if (result.data) {
        setScheduledPosts((prev) => [result.data!, ...prev]);
        setShowScheduleModal(false);
        resetScheduleForm();
      }
    } catch (err) {
      console.error("Failed to schedule:", err);
    } finally {
      setScheduling(false);
    }
  };

  const resetScheduleForm = () => {
    setSelectedGeneration(null);
    setSelectedAccount("");
    setScheduleCaption("");
    setScheduleHashtags([]);
    setScheduleDate("");
    setScheduleTime("");
  };

  // Handle post actions
  const handleCancelPost = async (postId: string) => {
    if (!confirm("Cancel this scheduled post?")) return;
    const result = await scheduledPostsApi.cancel(postId);
    if (result.data) {
      setScheduledPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, status: "CANCELLED" as PublishStatus } : p))
      );
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Delete this scheduled post?")) return;
    const result = await scheduledPostsApi.delete(postId);
    if (!result.error) {
      setScheduledPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="space-y-6 px-[7%] pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.publish.title || "Publishing"}</h1>
            <p className="text-muted-foreground text-sm">
              {campaign?.name} - {t.publish.manageSchedule || "Manage your scheduled posts"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats - Card Grid (Monochrome Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: t.publish.total || "Total", value: stats.total, key: "ALL", icon: Layers },
          { label: t.publish.publishing || "Publishing", value: stats.publishing, key: "PUBLISHING", icon: RefreshCw },
          { label: t.publish.scheduled || "Scheduled", value: stats.scheduled, key: "SCHEDULED", icon: Clock },
          { label: t.publish.published || "Published", value: stats.published, key: "PUBLISHED", icon: CheckCircle },
          { label: t.publish.drafts || "Drafts", value: stats.draft, key: "DRAFT", icon: Film },
          { label: t.publish.failed || "Failed", value: stats.failed, key: "FAILED", icon: AlertCircle },
          { label: t.publish.cancelled || "Cancelled", value: stats.cancelled, key: "CANCELLED", icon: Ban },
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
                    <Icon className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View Tabs & Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* View Tabs */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            {([
              { key: "queue", label: t.publish.queue },
              { key: "list", label: t.publish.list },
              { key: "calendar", label: t.publish.calendar }
            ] as { key: ViewTab; label: string }[]).map((tab) => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Platform Filter */}
          <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PublishPlatform | "ALL")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.publish.allPlatforms}</SelectItem>
              <SelectItem value="TIKTOK">TikTok</SelectItem>
              <SelectItem value="YOUTUBE">YouTube</SelectItem>
              <SelectItem value="INSTAGRAM">Instagram</SelectItem>
              <SelectItem value="TWITTER">Twitter/X</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Schedule Button & Connected Accounts */}
        <div className="flex items-center gap-4">
          {/* New Schedule Button - Always visible when accounts and generations exist */}
          {accounts.length > 0 && generations.length > 0 && (
            <Button onClick={() => setShowScheduleModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t.publish.schedulePost}
            </Button>
          )}

          {/* Connected Accounts Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{t.publish.connected}</span>
            {accounts.length > 0 ? (
              <div className="flex items-center gap-1">
                {Array.from(new Set(accounts.map((a) => a.platform))).map((platform) => (
                  <span
                    key={platform}
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{ backgroundColor: `${getPlatformColor(platform)}20`, color: getPlatformColor(platform) }}
                  >
                    {getPlatformIcon(platform)} {accounts.filter((a) => a.platform === platform).length}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-yellow-600 text-sm">{t.publish.noAccountsConnected}</span>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredPosts.length === 0 && (
        <Card className="p-12 text-center">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-10 h-10 text-zinc-700 dark:text-zinc-300" />
          </div>
          <h3 className="text-xl font-medium text-foreground mb-2">{t.publish.noScheduledPosts}</h3>
          <p className="text-muted-foreground mb-6">
            {accounts.length === 0
              ? t.publish.connectAccountsMessage
              : generations.length === 0
              ? t.publish.generateVideosFirst
              : t.publish.scheduleFirstPost}
          </p>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.publish.contactAdmin}
            </p>
          ) : generations.length === 0 ? (
            <Button asChild>
              <Link href={`/campaigns/${campaignId}/generate`}>
                {t.publish.generateVideos}
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setShowScheduleModal(true)}>
              {t.publish.scheduleFirstPost}
            </Button>
          )}
        </Card>
      )}

      {/* Queue View */}
      {activeTab === "queue" && filteredPosts.length > 0 && (
        <div className="space-y-8">
          {/* Publishing Posts - Active/In Progress */}
          {queueGroups.publishing.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-zinc-700 dark:text-zinc-300 animate-spin" />
                  </div>
                  {t.publish.publishingPosts || "Publishing"} ({queueGroups.publishing.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {queueGroups.publishing.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onCancel={() => handleCancelPost(post.id)}
                      onDelete={() => handleDeletePost(post.id)}
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
                {t.publish.scheduledPosts || "Scheduled"} ({queueGroups.scheduled.length})
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
                {t.publish.draftPosts || "Drafts"} ({queueGroups.draft.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {queueGroups.draft.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
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
                {t.publish.publishedPosts || "Published"} ({queueGroups.published.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {queueGroups.published.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
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
                  {t.publish.failedPosts || "Failed"} ({queueGroups.failed.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {queueGroups.failed.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onCancel={() => handleCancelPost(post.id)}
                      onDelete={() => handleDeletePost(post.id)}
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
                {t.publish.cancelledPosts || "Cancelled"} ({queueGroups.cancelled.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {queueGroups.cancelled.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
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
          <div className="divide-y divide-border">
            {filteredPosts.map((post) => (
              <div key={post.id} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-14 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {post.thumbnail_url ? (
                      <video src={post.thumbnail_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Play className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: getPlatformColor(post.platform) }}>
                        {getPlatformIcon(post.platform)}
                      </span>
                      <span className="text-foreground font-medium">
                        {post.social_account.account_name}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm line-clamp-1">
                      {post.caption || t.publish.noCaption}
                    </p>
                  </div>

                  {/* Schedule */}
                  <div className="text-right">
                    {post.scheduled_at && (
                      <p className="text-foreground text-sm">
                        {formatScheduledTime(post.scheduled_at)}
                      </p>
                    )}
                    {post.status === "SCHEDULED" && post.scheduled_at && (
                      <p className="text-muted-foreground text-xs">
                        {t.publish.inTime} {getTimeUntilPublish(post.scheduled_at)}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <Badge
                    variant={
                      getStatusColor(post.status) === "green" ? "default" :
                      getStatusColor(post.status) === "blue" ? "secondary" :
                      getStatusColor(post.status) === "red" ? "destructive" : "outline"
                    }
                  >
                    {getStatusDisplayName(post.status)}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {post.status === "SCHEDULED" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelPost(post.id)}
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    {post.status !== "PUBLISHED" && post.status !== "PUBLISHING" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Calendar View Placeholder */}
      {activeTab === "calendar" && (
        <Card className="p-12 text-center">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-10 h-10 text-zinc-700 dark:text-zinc-300" />
          </div>
          <h3 className="text-xl font-medium text-foreground mb-2">{t.publish.calendarView}</h3>
          <p className="text-muted-foreground">
            {t.publish.comingSoon}
          </p>
        </Card>
      )}

      {/* Schedule Modal - Full Screen */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex">
          {/* Left Side - Form */}
          <div className="w-[480px] bg-background border-r border-border flex flex-col h-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">{t.publish.schedulePost}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowScheduleModal(false);
                  resetScheduleForm();
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Selected Video Preview */}
              {selectedGeneration && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-28 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {selectedGeneration.output_url ? (
                        <video src={selectedGeneration.output_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Play className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {selectedGeneration.prompt?.slice(0, 50) || "Video"}...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Selected
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={() => setSelectedGeneration(null)}
                      >
  Change
                      </Button>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  </div>
                </div>
              )}

              {/* Select Account */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  {t.publish.publishTo}
                </label>
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccount(account.id)}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        selectedAccount === account.id
                          ? "border-green-500 bg-green-500/10"
                          : "border-border hover:border-muted-foreground bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span style={{ color: getPlatformColor(account.platform) }} className="text-lg">
                          {getPlatformIcon(account.platform)}
                        </span>
                        <div className="flex-1">
                          <span className="text-foreground font-medium">{account.account_name}</span>
                          <p className="text-muted-foreground text-xs">
                            {getPlatformDisplayName(account.platform)}
                            {account.follower_count && ` • ${(account.follower_count / 1000).toFixed(1)}K followers`}
                          </p>
                        </div>
                        {selectedAccount === account.id && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  {t.publish.caption}
                </label>
                <textarea
                  value={scheduleCaption}
                  onChange={(e) => setScheduleCaption(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder={t.publish.writeCaption}
                />
              </div>

              {/* Schedule Time */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  {t.publish.scheduleTime}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="px-4 py-3 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="px-4 py-3 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="text-muted-foreground text-xs mt-2">
                  {t.publish.leaveEmptyForDraft}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
              <Button
                variant="outline"
                onClick={() => {
                  setShowScheduleModal(false);
                  resetScheduleForm();
                }}
              >
                {t.publish.cancel}
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={!selectedGeneration || !selectedAccount || scheduling}
                className="min-w-[140px]"
              >
                {scheduling ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    {t.publish.scheduling}
                  </>
                ) : scheduleDate && scheduleTime ? (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    {t.publish.schedulePost}
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    {t.publish.saveAsDraft}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Side - Video Selection */}
          <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h3 className="text-lg font-medium text-white">{t.publish.selectVideo}</h3>
                <p className="text-sm text-white/60 mt-1">
                  {generations.length} videos available
                </p>
              </div>
            </div>

            {/* Video Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {generations.map((gen) => (
                  <button
                    key={gen.id}
                    onClick={() => setSelectedGeneration(gen)}
                    className={`relative aspect-[9/16] bg-black/50 rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] ${
                      selectedGeneration?.id === gen.id
                        ? "border-green-500 ring-2 ring-green-500/50"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {gen.output_url ? (
                      <video
                        src={gen.output_url}
                        className="w-full h-full object-cover"
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/40">
                        <Play className="w-10 h-10" />
                      </div>
                    )}

                    {/* Selection Overlay */}
                    {selectedGeneration?.id === gen.id && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white text-xs line-clamp-2">
                          {gen.prompt?.slice(0, 60) || "Video"}...
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Post Card Component
function PostCard({
  post,
  onCancel,
  onDelete,
  t,
}: {
  post: ScheduledPost;
  onCancel: () => void;
  onDelete: () => void;
  t: Translations;
}) {
  const [thumbnailError, setThumbnailError] = React.useState(false);
  const videoUrl = post.generation?.output_url || post.thumbnail_url;
  const showPlaceholder = !videoUrl || thumbnailError;

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-md group",
      post.status === "CANCELLED" && "opacity-60"
    )}>
      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 relative group">
        {showPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <Film className="w-10 h-10 mb-2 opacity-50" />
            <span className="text-xs opacity-50">
              {thumbnailError ? (t.publish.thumbnailExpired || "Thumbnail expired") : (t.publish.noThumbnail || "No preview")}
            </span>
          </div>
        ) : (
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            onError={() => setThumbnailError(true)}
            muted
            playsInline
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

        {/* Publishing Animation Overlay - Monochrome */}
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
        {/* Account */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs">
            <span className="text-zinc-700 dark:text-zinc-300">{getPlatformIcon(post.platform)}</span>
          </div>
          <span className="text-foreground font-medium text-sm truncate">
            {post.social_account.account_name}
          </span>
        </div>

        {/* Caption Preview */}
        <p className="text-muted-foreground text-sm line-clamp-2 mb-3 min-h-[2.5rem]">
          {post.caption || <span className="italic opacity-60">{t.publish.noCaption || "No caption"}</span>}
        </p>

        {/* Schedule Time */}
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
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {post.published_url && (
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a
                href={post.published_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                {t.publish.viewPost || "View"}
              </a>
            </Button>
          )}
          {post.status === "SCHEDULED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              <X className="w-3 h-3 mr-1" />
              {t.publish.cancel || "Cancel"}
            </Button>
          )}
          {post.status === "FAILED" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              {t.publish.retry || "Retry"}
            </Button>
          )}
          {post.status !== "PUBLISHED" && post.status !== "PUBLISHING" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
