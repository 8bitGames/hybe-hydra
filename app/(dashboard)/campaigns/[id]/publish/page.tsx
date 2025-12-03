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
import { Plus, Calendar, X, Play, Trash2, ExternalLink, Clock, Check, CheckCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Translations } from "@/lib/i18n/translations";

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
    scheduled: filteredPosts.filter((p) => p.status === "SCHEDULED"),
    draft: filteredPosts.filter((p) => p.status === "DRAFT"),
    published: filteredPosts.filter((p) => p.status === "PUBLISHED"),
    failed: filteredPosts.filter((p) => p.status === "FAILED"),
  };

  // Stats
  const stats = {
    total: scheduledPosts.length,
    scheduled: scheduledPosts.filter((p) => p.status === "SCHEDULED").length,
    published: scheduledPosts.filter((p) => p.status === "PUBLISHED").length,
    draft: scheduledPosts.filter((p) => p.status === "DRAFT").length,
    failed: scheduledPosts.filter((p) => p.status === "FAILED").length,
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
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: t.publish.total, value: stats.total, key: "ALL" },
          { label: t.publish.scheduled, value: stats.scheduled, key: "SCHEDULED" },
          { label: t.publish.published, value: stats.published, key: "PUBLISHED" },
          { label: t.publish.drafts, value: stats.draft, key: "DRAFT" },
          { label: t.publish.failed, value: stats.failed, key: "FAILED" },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setStatusFilter(stat.key as PublishStatus | "ALL")}
            className={`rounded-lg p-4 border transition-all ${
              statusFilter === stat.key
                ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                : "border-border hover:border-muted-foreground bg-card"
            }`}
          >
            <p className="text-muted-foreground text-xs">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </button>
        ))}
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
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-10 h-10 text-green-600" />
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
        <div className="space-y-6">
          {/* Scheduled Posts */}
          {queueGroups.scheduled.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {t.publish.scheduledPosts} ({queueGroups.scheduled.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                {t.publish.draftPosts} ({queueGroups.draft.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {t.publish.publishedPosts} ({queueGroups.published.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                {t.publish.failedPosts} ({queueGroups.failed.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-10 h-10 text-primary" />
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
  return (
    <Card className="overflow-hidden">
      {/* Thumbnail */}
      <div className="aspect-video bg-muted relative">
        {post.thumbnail_url ? (
          <video src={post.thumbnail_url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Play className="w-12 h-12" />
          </div>
        )}

        {/* Platform Badge */}
        <div className="absolute top-2 left-2">
          <span
            className="px-2 py-1 rounded-lg text-xs font-medium"
            style={{
              backgroundColor: `${getPlatformColor(post.platform)}20`,
              color: getPlatformColor(post.platform),
            }}
          >
            {getPlatformIcon(post.platform)} {getPlatformDisplayName(post.platform)}
          </span>
        </div>

        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <Badge
            variant={
              getStatusColor(post.status) === "green" ? "default" :
              getStatusColor(post.status) === "blue" ? "secondary" :
              getStatusColor(post.status) === "red" ? "destructive" :
              getStatusColor(post.status) === "yellow" ? "outline" : "outline"
            }
          >
            {getStatusDisplayName(post.status)}
          </Badge>
        </div>

        {/* Time Until */}
        {post.status === "SCHEDULED" && post.scheduled_at && (
          <div className="absolute bottom-2 right-2">
            <span className="px-2 py-1 bg-black/60 rounded text-xs text-white">
              {t.publish.inTime} {getTimeUntilPublish(post.scheduled_at)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-4">
        {/* Account */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-foreground font-medium text-sm">
            {post.social_account.account_name}
          </span>
        </div>

        {/* Caption Preview */}
        <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
          {post.caption || t.publish.noCaption}
        </p>

        {/* Schedule Time */}
        {post.scheduled_at && (
          <p className="text-muted-foreground text-xs mb-3">
            {formatScheduledTime(post.scheduled_at)}
          </p>
        )}

        {/* Error Message */}
        {post.error_message && (
          <p className="text-destructive text-xs mb-3 line-clamp-2">
            {t.publish.error}: {post.error_message}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {post.published_url && (
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a
                href={post.published_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                {t.publish.viewPost}
              </a>
            </Button>
          )}
          {post.status === "SCHEDULED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-yellow-600 hover:text-yellow-700"
            >
              {t.publish.cancel}
            </Button>
          )}
          {post.status !== "PUBLISHED" && post.status !== "PUBLISHING" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              {t.common.delete}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
