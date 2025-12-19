"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAllAssets, useCampaigns } from "@/lib/queries";
import { Asset } from "@/lib/campaigns-api";
import {
  Card,
  CardContent,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Image as ImageIcon,
  Music,
  Video,
  FileText,
  Upload,
  RefreshCw,
  FolderOpen,
  Search,
  Download,
  Trash2,
  Eye,
  Grid3x3,
  List,
  ChevronLeft,
  ChevronRight,
  Package,
  Subtitles,
} from "lucide-react";
import { downloadFile } from "@/lib/utils";
import { AudioLyricsModal } from "@/components/features/audio-lyrics-modal";
import type { LyricsData } from "@/lib/subtitle-styles";

export default function AssetsPage() {
  const router = useRouter();
  const { language } = useI18n();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Lyrics modal state
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
  const [selectedAudioAsset, setSelectedAudioAsset] = useState<Asset | null>(null);

  // Open lyrics modal for audio asset
  const handleAudioClick = (asset: Asset) => {
    setSelectedAudioAsset(asset);
    setLyricsModalOpen(true);
  };

  // Check if audio has lyrics
  const hasLyrics = (asset: Asset): boolean => {
    const metadata = asset.metadata as Record<string, unknown> | null;
    const lyrics = metadata?.lyrics as LyricsData | undefined;
    return !!(lyrics && lyrics.segments && lyrics.segments.length > 0);
  };

  // Fetch campaigns for filter dropdown
  const { data: campaignsData } = useCampaigns({ page_size: 100 });
  const campaigns = campaignsData?.items || [];

  // Build API params
  const apiParams = useMemo(() => {
    const params: {
      page: number;
      page_size: number;
      type?: string;
      campaign_id?: string;
      search?: string;
    } = {
      page,
      page_size: pageSize,
    };

    if (fileTypeFilter !== "all") {
      params.type = fileTypeFilter;
    }
    if (selectedCampaign !== "all") {
      params.campaign_id = selectedCampaign;
    }
    if (searchQuery) {
      params.search = searchQuery;
    }

    return params;
  }, [page, fileTypeFilter, selectedCampaign, searchQuery]);

  // Fetch all assets
  const { data: assetsData, isLoading: loading, refetch } = useAllAssets(apiParams);

  const assets = assetsData?.items || [];
  const totalPages = assetsData?.pages || 1;
  const stats = assetsData?.stats || { total: 0, images: 0, audio: 0, videos: 0, goods: 0 };

  // Update selectedAudioAsset when assets data changes (after refetch)
  const selectedAssetId = selectedAudioAsset?.id;
  useEffect(() => {
    if (selectedAssetId && assets.length > 0) {
      const updatedAsset = assets.find((a) => a.id === selectedAssetId);
      if (updatedAsset) {
        setSelectedAudioAsset(updatedAsset);
      }
    }
  }, [assets, selectedAssetId]);

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="h-5 w-5" />;
      case "audio":
        return <Music className="h-5 w-5" />;
      case "video":
        return <Video className="h-5 w-5" />;
      case "goods":
        return <Package className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getThumbnailUrl = (asset: Asset) => {
    // For images, use the s3_url directly
    if (asset.type === "image" || asset.type === "goods") {
      return asset.s3_url;
    }
    // For other types, use thumbnail if available
    return asset.thumbnail_url;
  };

  const isImageType = (asset: Asset) => {
    return asset.type === "image" || asset.type === "goods" ||
           asset.mime_type?.startsWith("image/");
  };

  // Translations
  const t = {
    title: language === "ko" ? "에셋 라이브러리" : "Asset Library",
    subtitle: language === "ko" ? "업로드된 이미지, 오디오, 영상 관리" : "Manage uploaded images, audio, and videos",
    refresh: language === "ko" ? "새로고침" : "Refresh",
    upload: language === "ko" ? "업로드" : "Upload",
    totalAssets: language === "ko" ? "총 에셋" : "Total Assets",
    images: language === "ko" ? "이미지" : "Images",
    audio: language === "ko" ? "오디오" : "Audio",
    videos: language === "ko" ? "영상" : "Videos",
    goods: language === "ko" ? "굿즈" : "Goods",
    totalSize: language === "ko" ? "총 용량" : "Total Size",
    searchPlaceholder: language === "ko" ? "파일명 검색..." : "Search filename...",
    allCampaigns: language === "ko" ? "모든 캠페인" : "All Campaigns",
    allTypes: language === "ko" ? "모든 타입" : "All Types",
    noAssets: language === "ko" ? "에셋이 없습니다" : "No assets found",
    noAssetsDesc: language === "ko" ? "캠페인을 만들고 파일을 업로드하세요" : "Create a campaign and upload files to get started",
    startUpload: language === "ko" ? "업로드 시작" : "Start Uploading",
    page: language === "ko" ? "페이지" : "Page",
    of: language === "ko" ? "/" : "of",
  };

  if (loading && assets.length === 0) {
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
          <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t.refresh}
          </Button>
          <Button onClick={() => router.push("/campaigns/new")}>
            <Upload className="h-4 w-4 mr-2" />
            {t.upload}
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
                <p className="text-sm text-muted-foreground">{t.totalAssets}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
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
                <p className="text-sm text-muted-foreground">{t.images}</p>
                <p className="text-2xl font-bold">{stats.images}</p>
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
                <p className="text-sm text-muted-foreground">{t.audio}</p>
                <p className="text-2xl font-bold">{stats.audio}</p>
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
                <p className="text-sm text-muted-foreground">{t.videos}</p>
                <p className="text-2xl font-bold">{stats.videos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/10 rounded-lg">
                <Package className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t.goods}</p>
                <p className="text-2xl font-bold">{stats.goods}</p>
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
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={selectedCampaign}
              onValueChange={(v) => {
                setSelectedCampaign(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allCampaigns}</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={fileTypeFilter}
              onValueChange={(v) => {
                setFileTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allTypes}</SelectItem>
                <SelectItem value="image">{t.images}</SelectItem>
                <SelectItem value="audio">{t.audio}</SelectItem>
                <SelectItem value="video">{t.videos}</SelectItem>
                <SelectItem value="goods">{t.goods}</SelectItem>
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
          {assets.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">{t.noAssets}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t.noAssetsDesc}</p>
              <Button onClick={() => router.push("/campaigns/new")}>
                <Upload className="h-4 w-4 mr-2" />
                {t.startUpload}
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-lg border overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {isImageType(asset) ? (
                      <img
                        src={getThumbnailUrl(asset) || ""}
                        alt={asset.original_filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide broken image and show icon instead
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={`flex items-center justify-center ${isImageType(asset) ? "hidden" : ""}`}>
                      {getFileIcon(asset.type)}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{asset.original_filename}</p>
                    <p className="text-xs text-muted-foreground truncate">{asset.campaign_name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {formatFileSize(asset.file_size)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {asset.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {/* Lyrics button for audio */}
                    {asset.type === "audio" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className={`h-7 w-7 ${hasLyrics(asset) ? "bg-green-100 hover:bg-green-200" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAudioClick(asset);
                            }}
                          >
                            <Subtitles className={`h-3 w-3 ${hasLyrics(asset) ? "text-green-600" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasLyrics(asset)
                            ? (language === "ko" ? "자막 편집" : "Edit Lyrics")
                            : (language === "ko" ? "자막 추가" : "Add Lyrics")}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(asset.s3_url, "_blank");
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(asset.s3_url, asset.original_filename);
                      }}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {isImageType(asset) ? (
                      <img
                        src={getThumbnailUrl(asset) || ""}
                        alt={asset.original_filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={`flex items-center justify-center ${isImageType(asset) ? "hidden" : ""}`}>
                      {getFileIcon(asset.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{asset.original_filename}</p>
                    <p className="text-sm text-muted-foreground truncate">{asset.campaign_name}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <Badge variant="outline">{asset.type}</Badge>
                    <Badge variant="secondary">{formatFileSize(asset.file_size)}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {new Date(asset.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-1">
                      {/* Lyrics button for audio */}
                      {asset.type === "audio" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={hasLyrics(asset) ? "text-green-600" : ""}
                              onClick={() => handleAudioClick(asset)}
                            >
                              <Subtitles className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {hasLyrics(asset)
                              ? (language === "ko" ? "자막 편집" : "Edit Lyrics")
                              : (language === "ko" ? "자막 추가" : "Add Lyrics")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(asset.s3_url, "_blank")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadFile(asset.s3_url, asset.original_filename)}
                      >
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} {t.of} {totalPages} {t.page}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Audio Lyrics Modal */}
      <AudioLyricsModal
        open={lyricsModalOpen}
        onOpenChange={setLyricsModalOpen}
        asset={selectedAudioAsset}
        onSaved={() => refetch()}
      />
    </div>
  );
}
