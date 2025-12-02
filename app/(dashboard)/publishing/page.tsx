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
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  ExternalLink,
  Eye,
  Heart,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledPost {
  id: string;
  campaignId: string;
  campaignName: string;
  platform: string;
  accountName: string;
  status: string;
  scheduledAt: string;
  publishedAt: string | null;
  publishedUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
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
  const [activeTab, setActiveTab] = useState("scheduled");

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    try {
      // Load dashboard data which includes publishing info
      const response = await api.get<any>("/api/v1/dashboard/stats");
      if (response.data) {
        // Transform recent_activity.published into ScheduledPost format
        const publishedPosts: ScheduledPost[] = response.data.recent_activity?.published?.map((post: any) => ({
          id: post.id,
          campaignId: post.campaign_id,
          campaignName: post.campaign_name,
          platform: post.platform,
          accountName: post.account_name,
          status: "PUBLISHED",
          scheduledAt: post.published_at,
          publishedAt: post.published_at,
          publishedUrl: post.published_url,
          viewCount: post.view_count,
          likeCount: post.like_count,
        })) || [];
        setPosts(publishedPosts);
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
  const publishedPosts = posts.filter(p => p.status === "PUBLISHED");
  const failedPosts = posts.filter(p => p.status === "FAILED");

  return (
    <div className="space-y-6 pb-8">
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
          <TabsTrigger value="scheduled" className="gap-2">
            <Clock className="h-4 w-4" />
            {language === "ko" ? "예약됨" : "Scheduled"} ({scheduledPosts.length})
          </TabsTrigger>
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
        </TabsList>

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
                          {new Date(post.scheduledAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/campaigns/${post.campaignId}/publish`)}
                      >
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
                        onClick={() => router.push(`/campaigns/${post.campaignId}/publish`)}
                      >
                        {language === "ko" ? "재시도" : "Retry"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
