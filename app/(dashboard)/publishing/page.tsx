"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  List,
  XCircle,
  MessageCircle,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledPost {
  id: string;
  campaignId: string;
  campaignName: string;
  generationId: string;
  platform: string;
  accountName: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  errorMessage: string | null;
  thumbnailUrl: string | null;
  // TikTok publishing details
  caption: string | null;
  hashtags: string[];
  videoUrl: string | null;
}

interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  isConnected: boolean;
}

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case "TIKTOK": return "🎵";
    case "YOUTUBE": return "📺";
    case "INSTAGRAM": return "📸";
    case "TWITTER": return "🐦";
    default: return "📱";
  }
};

const getStatusBadge = (status: string, language: "ko" | "en") => {
  switch (status) {
    case "PUBLISHED":
      return <Badge className="bg-green-500">
        <CheckCircle className="h-3 w-3 mr-1" />
        {language === "ko" ? "발행됨" : "Published"}
      </Badge>;
    case "PUBLISHING":
      return <Badge className="bg-blue-500">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        {language === "ko" ? "발행 중..." : "Publishing..."}
      </Badge>;
    case "SCHEDULED":
      return <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        {language === "ko" ? "예약됨" : "Scheduled"}
      </Badge>;
    case "FAILED":
      return <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        {language === "ko" ? "실패" : "Failed"}
      </Badge>;
    case "CANCELLED":
      return <Badge variant="outline" className="text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" />
        {language === "ko" ? "취소됨" : "Cancelled"}
      </Badge>;
    case "DRAFT":
      return <Badge variant="outline">{language === "ko" ? "초안" : "Draft"}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const formatNumber = (num: number | null): string => {
  if (num === null) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

export default function PublishingPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const { language } = useI18n();

  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    try {
      // Load all scheduled/published posts using the publishing schedule API
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
          campaignId: post.campaign_id,
          campaignName: post.campaign_name || "Unknown Campaign",
          generationId: post.generation_id,
          platform: post.platform,
          accountName: post.social_account?.account_name || "Unknown",
          status: post.status,
          scheduledAt: post.scheduled_at,
          publishedAt: post.published_at,
          publishedUrl: post.published_url,
          viewCount: post.view_count ?? post.analytics?.view_count,
          likeCount: post.like_count ?? post.analytics?.like_count,
          commentCount: post.comment_count ?? post.analytics?.comment_count,
          shareCount: post.share_count ?? post.analytics?.share_count,
          errorMessage: post.error_message,
          thumbnailUrl: post.thumbnail_url,
          // TikTok publishing details
          caption: post.caption,
          hashtags: post.hashtags || [],
          videoUrl: post.generation?.output_url || post.thumbnail_url,
        }));
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

  const scheduledPosts = posts.filter(p => p.status === "SCHEDULED");
  const publishingPosts = posts.filter(p => p.status === "PUBLISHING");
  const publishedPosts = posts.filter(p => p.status === "PUBLISHED");
  const failedPosts = posts.filter(p => p.status === "FAILED");
  const cancelledPosts = posts.filter(p => p.status === "CANCELLED");

  return (
    <div className="space-y-6 pb-8 px-[7%]">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {language === "ko" ? "발행" : "Publishing"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ko"
              ? "예약된 게시물 관리 및 발행된 콘텐츠 추적"
              : "Manage scheduled posts and track published content"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {language === "ko" ? "새로고침" : "Refresh"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/settings/accounts")}>
            <Settings className="h-4 w-4 mr-2" />
            {language === "ko" ? "계정 관리" : "Manage Accounts"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "예약됨" : "Scheduled"}
                </p>
                <p className="text-2xl font-bold">{scheduledPosts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "발행됨" : "Published"}
                </p>
                <p className="text-2xl font-bold">{publishedPosts.length}</p>
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
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "총 조회수" : "Total Views"}
                </p>
                <p className="text-2xl font-bold">
                  {formatNumber(publishedPosts.reduce((sum, p) => sum + (p.viewCount || 0), 0))}
                </p>
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
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "총 좋아요" : "Total Likes"}
                </p>
                <p className="text-2xl font-bold">
                  {formatNumber(publishedPosts.reduce((sum, p) => sum + (p.likeCount || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <List className="h-4 w-4" />
            {language === "ko" ? "전체" : "All"} ({posts.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Clock className="h-4 w-4" />
            {language === "ko" ? "예약됨" : "Scheduled"} ({scheduledPosts.length})
          </TabsTrigger>
          {publishingPosts.length > 0 && (
            <TabsTrigger value="publishing" className="gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {language === "ko" ? "발행 중" : "Publishing"} ({publishingPosts.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="published" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {language === "ko" ? "발행됨" : "Published"} ({publishedPosts.length})
          </TabsTrigger>
          {failedPosts.length > 0 && (
            <TabsTrigger value="failed" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              {language === "ko" ? "실패" : "Failed"} ({failedPosts.length})
            </TabsTrigger>
          )}
          {cancelledPosts.length > 0 && (
            <TabsTrigger value="cancelled" className="gap-2">
              <XCircle className="h-4 w-4" />
              {language === "ko" ? "취소됨" : "Cancelled"} ({cancelledPosts.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <List className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">
                  {language === "ko" ? "게시물이 없습니다" : "No posts"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === "ko"
                    ? "캠페인의 발행 탭에서 게시물을 예약하세요"
                    : "Schedule posts from your campaign's Publish tab"}
                </p>
                <Button onClick={() => router.push("/campaigns")}>
                  {language === "ko" ? "캠페인으로 이동" : "Go to Campaigns"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <Card key={post.id} className={cn(
                  post.status === "FAILED" && "border-destructive/50",
                  post.status === "CANCELLED" && "opacity-60"
                )}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{getPlatformIcon(post.platform)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{post.accountName}</span>
                          {getStatusBadge(post.status, language)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {post.campaignName} •{" "}
                          {post.publishedAt
                            ? `${language === "ko" ? "발행: " : "Published "}${new Date(post.publishedAt).toLocaleDateString()}`
                            : post.status === "PUBLISHING"
                            ? (language === "ko" ? "TikTok 인박스로 전송 중..." : "Sending to TikTok inbox...")
                            : post.scheduledAt
                            ? `${language === "ko" ? "예약: " : "Scheduled "}${new Date(post.scheduledAt).toLocaleString()}`
                            : language === "ko" ? "즉시 발행" : "Immediate publish"}
                        </p>
                        {post.status === "PUBLISHED" && (
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            {post.viewCount !== null && (
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" /> {formatNumber(post.viewCount)}
                              </span>
                            )}
                            {post.likeCount !== null && (
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" /> {formatNumber(post.likeCount)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPost(post)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {language === "ko" ? "보기" : "View"}
                        </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : scheduledPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">
                  {language === "ko" ? "예약된 게시물이 없습니다" : "No scheduled posts"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === "ko"
                    ? "캠페인의 발행 탭에서 게시물을 예약하세요"
                    : "Schedule posts from your campaign's Publish tab"}
                </p>
                <Button onClick={() => router.push("/campaigns")}>
                  {language === "ko" ? "캠페인으로 이동" : "Go to Campaigns"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {scheduledPosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{getPlatformIcon(post.platform)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{post.accountName}</span>
                          {getStatusBadge(post.status, language)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {post.campaignName} •{" "}
                          {language === "ko" ? "예약 시간: " : "Scheduled for "}
                          {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "-"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPost(post)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {language === "ko" ? "보기" : "View"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="publishing" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : publishingPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">
                  {language === "ko" ? "발행 중인 게시물이 없습니다" : "No posts being published"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === "ko"
                    ? "발행 중인 게시물이 여기에 표시됩니다"
                    : "Posts being published will appear here"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {publishingPosts.map((post) => (
                <Card key={post.id} className="border-blue-500/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{getPlatformIcon(post.platform)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{post.accountName}</span>
                          {getStatusBadge(post.status, language)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {post.campaignName} •{" "}
                          {language === "ko" ? "TikTok 인박스로 전송 중..." : "Sending to TikTok inbox..."}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPost(post)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {language === "ko" ? "보기" : "View"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="published" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : publishedPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">
                  {language === "ko" ? "아직 발행된 게시물이 없습니다" : "No published posts yet"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === "ko"
                    ? "발행된 게시물이 여기에 분석과 함께 표시됩니다"
                    : "Published posts will appear here with their analytics"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {publishedPosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{getPlatformIcon(post.platform)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{post.accountName}</span>
                          {getStatusBadge(post.status, language)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {post.campaignName} •{" "}
                          {language === "ko" ? "발행 날짜: " : "Published "}
                          {post.publishedAt && new Date(post.publishedAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          {post.viewCount !== null && (
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {formatNumber(post.viewCount)}
                            </span>
                          )}
                          {post.likeCount !== null && (
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" /> {formatNumber(post.likeCount)}
                            </span>
                          )}
                        </div>
                      </div>
                      {post.publishedUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a href={post.publishedUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {language === "ko" ? "보기" : "View"}
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="failed" className="mt-6">
          {failedPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-medium mb-2">
                  {language === "ko" ? "실패한 게시물이 없습니다" : "No failed posts"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === "ko"
                    ? "모든 게시물이 성공적으로 발행되고 있습니다"
                    : "All your posts are publishing successfully"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {failedPosts.map((post) => (
                <Card key={post.id} className="border-destructive/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{getPlatformIcon(post.platform)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{post.accountName}</span>
                          {getStatusBadge(post.status, language)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {post.campaignName}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPost(post)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {language === "ko" ? "보기" : "View"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-6">
          {cancelledPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-medium mb-2">
                  {language === "ko" ? "취소된 게시물이 없습니다" : "No cancelled posts"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === "ko"
                    ? "취소된 게시물이 여기에 표시됩니다"
                    : "Cancelled posts will appear here"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {cancelledPosts.map((post) => (
                <Card key={post.id} className="opacity-60">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{getPlatformIcon(post.platform)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{post.accountName}</span>
                          {getStatusBadge(post.status, language)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {post.campaignName}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPost(post)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {language === "ko" ? "보기" : "View"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
              {/* Video - Vertical Display (9:16) */}
              {(selectedPost.videoUrl || selectedPost.thumbnailUrl) && (
                <div className="flex justify-center">
                  <div className="aspect-[9/16] w-[180px] bg-muted rounded-lg overflow-hidden">
                    <video
                      src={selectedPost.videoUrl || selectedPost.thumbnailUrl || ""}
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
                    <span className="font-medium text-sm">
                      {selectedPost.platform === "TIKTOK" ? "TikTok" :
                       selectedPost.platform === "YOUTUBE" ? "YouTube" :
                       selectedPost.platform === "INSTAGRAM" ? "Instagram" :
                       selectedPost.platform === "TWITTER" ? "Twitter" :
                       selectedPost.platform}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {language === "ko" ? "상태" : "Status"}
                  </span>
                  {getStatusBadge(selectedPost.status, language)}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    {language === "ko" ? "계정" : "Account"}
                  </span>
                  <span className="font-medium text-sm">{selectedPost.accountName}</span>
                </div>
              </div>

              {/* Campaign */}
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  {language === "ko" ? "캠페인" : "Campaign"}
                </span>
                <span className="font-medium text-sm">{selectedPost.campaignName}</span>
              </div>

              {/* Caption (Description) */}
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

              {/* Schedule / Publish Time */}
              {selectedPost.publishedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === "ko" ? "발행 일시" : "Published At"}
                  </span>
                  <span>{new Date(selectedPost.publishedAt).toLocaleString()}</span>
                </div>
              )}
              {selectedPost.scheduledAt && !selectedPost.publishedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === "ko" ? "예약 일시" : "Scheduled At"}
                  </span>
                  <span>{new Date(selectedPost.scheduledAt).toLocaleString()}</span>
                </div>
              )}

              {/* Publishing Info (for publishing posts) */}
              {selectedPost.status === "PUBLISHING" && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 text-blue-500 mb-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">
                      {language === "ko" ? "발행 진행 중" : "Publishing in Progress"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground bg-blue-500/10 p-3 rounded-lg">
                    {language === "ko"
                      ? "영상이 TikTok 인박스로 전송되고 있습니다. 완료되면 TikTok 앱에서 영상을 확인하고 발행할 수 있습니다."
                      : "Video is being sent to your TikTok inbox. Once complete, you can review and publish it from the TikTok app."}
                  </p>
                </div>
              )}

              {/* Analytics (for published posts) */}
              {selectedPost.status === "PUBLISHED" && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">
                    {language === "ko" ? "성과" : "Analytics"}
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatNumber(selectedPost.viewCount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === "ko" ? "조회" : "Views"}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <Heart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatNumber(selectedPost.likeCount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === "ko" ? "좋아요" : "Likes"}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <MessageCircle className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatNumber(selectedPost.commentCount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === "ko" ? "댓글" : "Comments"}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <Share2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatNumber(selectedPost.shareCount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === "ko" ? "공유" : "Shares"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message (for failed posts) */}
              {selectedPost.status === "FAILED" && selectedPost.errorMessage && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2 text-destructive">
                    {language === "ko" ? "오류 메시지" : "Error Message"}
                  </p>
                  <p className="text-sm text-muted-foreground bg-destructive/10 p-3 rounded-lg">
                    {selectedPost.errorMessage}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {selectedPost.publishedUrl && (
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={selectedPost.publishedUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {language === "ko" ? "게시물 보기" : "View Post"}
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push(`/campaigns/${selectedPost.campaignId}`)}
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
