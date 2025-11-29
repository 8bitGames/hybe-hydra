"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";
import { videoApi, VideoGeneration } from "@/lib/video-api";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, X, Play, Trash2, ExternalLink, Clock, Check, ChevronLeft, CheckCircle } from "lucide-react";

type ViewTab = "calendar" | "list" | "queue";

export default function PublishingPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadData = useCallback(async () => {
    try {
      const [campaignResult, generationsResult, accountsResult, postsResult] = await Promise.all([
        campaignsApi.getById(campaignId),
        videoApi.getAll(campaignId, { status: "completed", page_size: 100 }),
        socialAccountsApi.getAll(),
        scheduledPostsApi.getAll({ campaign_id: campaignId, page_size: 100 }),
      ]);

      if (campaignResult.error) {
        router.push("/campaigns");
        return;
      }

      if (campaignResult.data) setCampaign(campaignResult.data);
      if (generationsResult.data) setGenerations(generationsResult.data.items);
      if (accountsResult.data) setAccounts(accountsResult.data.accounts);
      if (postsResult.data) setScheduledPosts(postsResult.data.items);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/campaigns" className="hover:text-foreground transition-colors">
          Campaigns
        </Link>
        <span>/</span>
        <Link href={`/campaigns/${campaignId}`} className="hover:text-foreground transition-colors">
          {campaign.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">Publish</span>
      </div>

      {/* Header - Step 4 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Badge variant="outline" className="font-normal">Step 4</Badge>
            <span>Schedule to social platforms</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Publish</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/campaigns/${campaignId}/curation`}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Curate
            </Link>
          </Button>
          <Button
            onClick={() => setShowScheduleModal(true)}
            disabled={generations.length === 0 || accounts.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule Post
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, key: "ALL" },
          { label: "Scheduled", value: stats.scheduled, key: "SCHEDULED" },
          { label: "Published", value: stats.published, key: "PUBLISHED" },
          { label: "Drafts", value: stats.draft, key: "DRAFT" },
          { label: "Failed", value: stats.failed, key: "FAILED" },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setStatusFilter(stat.key as PublishStatus | "ALL")}
            className={`rounded-xl p-4 border transition-all ${
              statusFilter === stat.key
                ? "border-primary ring-2 ring-primary/50 bg-primary/5"
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
            {(["queue", "list", "calendar"] as ViewTab[]).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Button>
            ))}
          </div>

          {/* Platform Filter */}
          <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PublishPlatform | "ALL")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Platforms</SelectItem>
              <SelectItem value="TIKTOK">TikTok</SelectItem>
              <SelectItem value="YOUTUBE">YouTube</SelectItem>
              <SelectItem value="INSTAGRAM">Instagram</SelectItem>
              <SelectItem value="TWITTER">Twitter/X</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Connected Accounts Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Connected:</span>
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
            <span className="text-yellow-600 text-sm">No accounts connected</span>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredPosts.length === 0 && (
        <Card className="p-12 text-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-xl font-medium text-foreground mb-2">No scheduled posts yet</h3>
          <p className="text-muted-foreground mb-6">
            {accounts.length === 0
              ? "Connect your social media accounts to start publishing"
              : generations.length === 0
              ? "Generate some videos first, then schedule them for publishing"
              : "Click 'Schedule Post' to create your first scheduled post"}
          </p>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Contact your administrator to connect social media accounts
            </p>
          ) : generations.length === 0 ? (
            <Button asChild>
              <Link href={`/campaigns/${campaignId}/generate`}>
                Generate Videos
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setShowScheduleModal(true)}>
              Schedule Your First Post
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
                Scheduled ({queueGroups.scheduled.length})
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
                Drafts ({queueGroups.draft.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {queueGroups.draft.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
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
                Published ({queueGroups.published.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {queueGroups.published.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
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
                Failed ({queueGroups.failed.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {queueGroups.failed.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCancel={() => handleCancelPost(post.id)}
                    onDelete={() => handleDeletePost(post.id)}
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
                      {post.caption || "No caption"}
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
                        in {getTimeUntilPublish(post.scheduled_at)}
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
          <h3 className="text-xl font-medium text-foreground mb-2">Calendar View</h3>
          <p className="text-muted-foreground">
            Calendar view coming soon. Use Queue or List view for now.
          </p>
        </Card>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle>Schedule Post</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowScheduleModal(false);
                  resetScheduleForm();
                }}
              >
                <X className="w-6 h-6" />
              </Button>
            </CardHeader>

            {/* Modal Content */}
            <CardContent className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Select Video */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Select Video
                </label>
                <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {generations.map((gen) => (
                    <button
                      key={gen.id}
                      onClick={() => setSelectedGeneration(gen)}
                      className={`relative aspect-video bg-muted rounded-lg overflow-hidden border-2 transition-all ${
                        selectedGeneration?.id === gen.id
                          ? "border-green-500 ring-2 ring-green-500/50"
                          : "border-transparent hover:border-muted-foreground"
                      }`}
                    >
                      {gen.output_url ? (
                        <video src={gen.output_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Play className="w-8 h-8" />
                        </div>
                      )}
                      {selectedGeneration?.id === gen.id && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <Check className="w-8 h-8 text-green-500" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Account */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Publish To
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccount(account.id)}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        selectedAccount === account.id
                          ? "border-green-500 bg-green-500/10"
                          : "border-border hover:border-muted-foreground bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: getPlatformColor(account.platform) }}>
                          {getPlatformIcon(account.platform)}
                        </span>
                        <span className="text-foreground font-medium">{account.account_name}</span>
                      </div>
                      <p className="text-muted-foreground text-xs mt-1">
                        {getPlatformDisplayName(account.platform)}
                        {account.follower_count && ` • ${(account.follower_count / 1000).toFixed(1)}K followers`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Caption
                </label>
                <textarea
                  value={scheduleCaption}
                  onChange={(e) => setScheduleCaption(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Write your caption..."
                />
              </div>

              {/* Schedule Time */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Schedule Time (Optional)
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
                  Leave empty to save as draft
                </p>
              </div>
            </CardContent>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/50">
              <Button
                variant="outline"
                onClick={() => {
                  setShowScheduleModal(false);
                  resetScheduleForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={!selectedGeneration || !selectedAccount || scheduling}
              >
                {scheduling ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Scheduling...
                  </>
                ) : scheduleDate && scheduleTime ? (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Post
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Save as Draft
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// Post Card Component
function PostCard({
  post,
  onCancel,
  onDelete,
}: {
  post: ScheduledPost;
  onCancel: () => void;
  onDelete: () => void;
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
              in {getTimeUntilPublish(post.scheduled_at)}
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
          {post.caption || "No caption"}
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
            Error: {post.error_message}
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
                View Post
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
              Cancel
            </Button>
          )}
          {post.status !== "PUBLISHED" && post.status !== "PUBLISHING" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
