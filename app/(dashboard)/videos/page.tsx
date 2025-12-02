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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlayCircle,
  Search,
  Filter,
  Star,
  Clock,
  CheckCircle,
  FolderOpen,
  ExternalLink,
  MoreVertical,
  Trash2,
  Send,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/ui/video-player";

interface VideoGeneration {
  id: string;
  campaignId: string;
  campaignName: string;
  prompt: string;
  status: string;
  outputUrl: string | null;
  composedOutputUrl: string | null;
  qualityScore: number | null;
  createdAt: string;
}

export default function AllVideosPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const { language } = useI18n();

  const [videos, setVideos] = useState<VideoGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadVideos = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    try {
      // This would be a new API endpoint that returns all videos across campaigns
      const response = await api.get<{ items: any[]; recent_activity?: { generations?: any[] } }>("/api/v1/dashboard/stats");
      if (response.data) {
        // Transform the data - in a real implementation this would come from a dedicated API
        const allVideos: VideoGeneration[] = response.data.recent_activity?.generations?.map((gen: any) => ({
          id: gen.id,
          campaignId: gen.campaign_id,
          campaignName: gen.campaign_name,
          prompt: gen.prompt,
          status: "COMPLETED",
          outputUrl: gen.output_url,
          composedOutputUrl: gen.composed_output_url,
          qualityScore: gen.quality_score,
          createdAt: gen.created_at,
        })) || [];
        setVideos(allVideos);
      }
    } catch (err) {
      console.error("Failed to load videos:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const getVideoUrl = (video: VideoGeneration) => {
    return video.composedOutputUrl || video.outputUrl;
  };

  const filteredVideos = videos.filter((video) => {
    if (searchQuery && !video.prompt.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && video.status !== statusFilter) {
      return false;
    }
    if (campaignFilter !== "all" && video.campaignId !== campaignFilter) {
      return false;
    }
    return true;
  });

  const uniqueCampaigns = Array.from(new Set(videos.map(v => v.campaignId)))
    .map(id => ({
      id,
      name: videos.find(v => v.campaignId === id)?.campaignName || "Unknown"
    }));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          {language === "ko" ? "완료" : "Completed"}
        </Badge>;
      case "PROCESSING":
        return <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {language === "ko" ? "처리중" : "Processing"}
        </Badge>;
      case "FAILED":
        return <Badge variant="destructive">{language === "ko" ? "실패" : "Failed"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {language === "ko" ? "모든 영상" : "All Videos"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ko"
              ? "캠페인 전체의 생성된 영상을 탐색하고 관리"
              : "Browse and manage all generated videos across campaigns"}
          </p>
        </div>
        <Button onClick={() => router.push("/create/generate")}>
          {language === "ko" ? "새 영상 만들기" : "Create New Video"}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ko" ? "프롬프트로 검색..." : "Search by prompt..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={language === "ko" ? "상태" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ko" ? "모든 상태" : "All Status"}</SelectItem>
                <SelectItem value="COMPLETED">{language === "ko" ? "완료" : "Completed"}</SelectItem>
                <SelectItem value="PROCESSING">{language === "ko" ? "처리중" : "Processing"}</SelectItem>
                <SelectItem value="FAILED">{language === "ko" ? "실패" : "Failed"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={language === "ko" ? "캠페인" : "Campaign"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ko" ? "모든 캠페인" : "All Campaigns"}</SelectItem>
                {uniqueCampaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Videos Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <PlayCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">
              {language === "ko" ? "영상을 찾을 수 없습니다" : "No videos found"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {videos.length === 0
                ? (language === "ko" ? "영상 생성을 시작해보세요" : "Start generating videos to see them here")
                : (language === "ko" ? "필터를 조정해보세요" : "Try adjusting your filters")}
            </p>
            <Button onClick={() => router.push("/create/generate")}>
              {language === "ko" ? "첫 영상 만들기" : "Create Your First Video"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              {/* Video Thumbnail */}
              <div className="relative aspect-video bg-muted">
                <VideoPlayer
                  src={getVideoUrl(video)}
                  className="w-full h-full"
                  playOnHover={true}
                />
                {video.qualityScore && (
                  <Badge
                    className={cn(
                      "absolute top-2 right-2",
                      video.qualityScore >= 80
                        ? "bg-green-500"
                        : video.qualityScore >= 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    )}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    {video.qualityScore.toFixed(0)}%
                  </Badge>
                )}
              </div>

              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{video.prompt}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        <FolderOpen className="h-3 w-3 mr-1" />
                        {video.campaignName}
                      </Badge>
                      {getStatusBadge(video.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/campaigns/${video.campaignId}/curation`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {language === "ko" ? "캠페인에서 보기" : "View in Campaign"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`/campaigns/${video.campaignId}/publish`)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {language === "ko" ? "게시 예약" : "Schedule Publish"}
                      </DropdownMenuItem>
                      {getVideoUrl(video) && (
                        <DropdownMenuItem asChild>
                          <a href={getVideoUrl(video)!} download>
                            <Download className="h-4 w-4 mr-2" />
                            {language === "ko" ? "다운로드" : "Download"}
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        {language === "ko" ? "삭제" : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
