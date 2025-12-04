"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useCampaigns } from "@/lib/queries";
import type { Campaign } from "@/lib/campaigns-api";
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
  Image as ImageIcon,
  Music,
  Video,
  FileText,
  Upload,
  RefreshCw,
  FolderOpen,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  Grid3x3,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Asset {
  id: string;
  campaign_id: string;
  campaign_name: string;
  filename: string;
  file_type: string;
  file_size: number;
  url: string;
  thumbnail_url?: string;
  uploaded_at: string;
}

export default function AssetsPage() {
  const router = useRouter();
  const { language } = useI18n();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Use TanStack Query for data fetching with caching
  const { data: campaignsData, isLoading: loading, refetch } = useCampaigns({ page_size: 100 });
  const loadData = () => refetch();

  const campaigns = campaignsData?.items || [];

  // Generate mock assets from campaigns (TODO: Replace with actual API when available)
  const assets: Asset[] = campaigns.flatMap((campaign) => {
    // Use campaign id hash to generate consistent mock data
    const seed = campaign.id.charCodeAt(0) % 10 + 1;
    return Array.from({ length: seed }, (_, i) => ({
      id: `${campaign.id}-asset-${i}`,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      filename: `asset-${i + 1}.${["jpg", "png", "mp3", "mp4"][i % 4]}`,
      file_type: ["image/jpeg", "image/png", "audio/mp3", "video/mp4"][i % 4],
      file_size: (i + 1) * 500000,
      url: `https://via.placeholder.com/400x300?text=Asset+${i + 1}`,
      thumbnail_url: `https://via.placeholder.com/150x150?text=${i + 1}`,
      uploaded_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    }));
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
    if (fileType.startsWith("audio/")) return <Music className="h-5 w-5" />;
    if (fileType.startsWith("video/")) return <Video className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const filteredAssets = assets
    .filter((asset) => {
      if (selectedCampaign !== "all" && asset.campaign_id !== selectedCampaign) return false;
      if (fileTypeFilter !== "all") {
        const type = fileTypeFilter === "images" ? "image/" :
                     fileTypeFilter === "audio" ? "audio/" :
                     fileTypeFilter === "videos" ? "video/" : "";
        if (!asset.file_type.startsWith(type)) return false;
      }
      if (searchQuery && !asset.filename.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

  const assetStats = {
    total: assets.length,
    images: assets.filter(a => a.file_type.startsWith("image/")).length,
    audio: assets.filter(a => a.file_type.startsWith("audio/")).length,
    videos: assets.filter(a => a.file_type.startsWith("video/")).length,
    totalSize: assets.reduce((sum, a) => sum + a.file_size, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {language === "ko" ? "에셋 로딩 중..." : "Loading assets..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 px-[7%]">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {language === "ko" ? "에셋 라이브러리" : "Asset Library"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ko"
              ? "업로드된 이미지, 오디오, 영상 관리"
              : "Manage uploaded images, audio, and videos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === "ko" ? "새로고침" : "Refresh"}
          </Button>
          <Button onClick={() => router.push("/campaigns/new")}>
            <Upload className="h-4 w-4 mr-2" />
            {language === "ko" ? "업로드" : "Upload"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FolderOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "총 에셋" : "Total Assets"}
                </p>
                <p className="text-2xl font-bold">{assetStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <ImageIcon className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "이미지" : "Images"}
                </p>
                <p className="text-2xl font-bold">{assetStats.images}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Music className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "오디오" : "Audio"}
                </p>
                <p className="text-2xl font-bold">{assetStats.audio}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Video className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "영상" : "Videos"}
                </p>
                <p className="text-2xl font-bold">{assetStats.videos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/10 rounded-lg">
                <Download className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ko" ? "총 용량" : "Total Size"}
                </p>
                <p className="text-2xl font-bold">{formatFileSize(assetStats.totalSize)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ko" ? "파일명 검색..." : "Search filename..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "ko" ? "모든 캠페인" : "All Campaigns"}
                </SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "ko" ? "모든 타입" : "All Types"}
                </SelectItem>
                <SelectItem value="images">
                  {language === "ko" ? "이미지" : "Images"}
                </SelectItem>
                <SelectItem value="audio">
                  {language === "ko" ? "오디오" : "Audio"}
                </SelectItem>
                <SelectItem value="videos">
                  {language === "ko" ? "영상" : "Videos"}
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assets Display */}
      <Card>
        <CardContent className="pt-6">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">
                {language === "ko" ? "에셋이 없습니다" : "No assets found"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {language === "ko"
                  ? "캠페인을 만들고 파일을 업로드하세요"
                  : "Create a campaign and upload files to get started"}
              </p>
              <Button onClick={() => router.push("/campaigns/new")}>
                <Upload className="h-4 w-4 mr-2" />
                {language === "ko" ? "업로드 시작" : "Start Uploading"}
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-lg border overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {asset.thumbnail_url ? (
                      <img
                        src={asset.thumbnail_url}
                        alt={asset.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getFileIcon(asset.file_type)
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{asset.filename}</p>
                    <p className="text-xs text-muted-foreground truncate">{asset.campaign_name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {formatFileSize(asset.file_size)}
                      </Badge>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button variant="secondary" size="icon" className="h-7 w-7">
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-7 w-7">
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    {asset.thumbnail_url ? (
                      <img
                        src={asset.thumbnail_url}
                        alt={asset.filename}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      getFileIcon(asset.file_type)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{asset.filename}</p>
                    <p className="text-sm text-muted-foreground truncate">{asset.campaign_name}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <Badge variant="outline">{formatFileSize(asset.file_size)}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {new Date(asset.uploaded_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
