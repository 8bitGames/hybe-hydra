"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  campaignsApi,
  assetsApi,
  Campaign,
  Asset,
  AssetStats,
} from "@/lib/campaigns-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  Play,
  LayoutGrid,
  Calendar,
  Pencil,
  Upload,
  Image,
  Video,
  Music,
  FolderOpen,
  ExternalLink,
  Trash2,
  ChevronRight,
  X,
  Check,
  Package,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

type AssetFilter = "all" | "image" | "video" | "audio" | "goods";
type MerchandiseType = "album" | "photocard" | "lightstick" | "apparel" | "accessory" | "other";

const MERCHANDISE_TYPES: { value: MerchandiseType; label: string; labelKo: string }[] = [
  { value: "album", label: "Album", labelKo: "Albums" },
  { value: "photocard", label: "Photocard", labelKo: "Photocards" },
  { value: "lightstick", label: "Lightstick", labelKo: "Lightsticks" },
  { value: "apparel", label: "Apparel", labelKo: "Apparel" },
  { value: "accessory", label: "Accessory", labelKo: "Accessories" },
  { value: "other", label: "Other", labelKo: "Other" },
];

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const campaignId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ name: "", description: "", status: "" });

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadAsGoods, setUploadAsGoods] = useState(false);
  const [selectedMerchType, setSelectedMerchType] = useState<MerchandiseType>("album");

  const loadAssets = useCallback(async () => {
    const [assetsResult, statsResult] = await Promise.all([
      assetsApi.getByCampaign(campaignId, {
        page,
        page_size: 20,
        type: assetFilter === "all" ? undefined : assetFilter,
      }),
      assetsApi.getStats(campaignId),
    ]);

    if (assetsResult.data) {
      setAssets(assetsResult.data.items);
      setTotalPages(assetsResult.data.pages);
    }
    if (statsResult.data) {
      setStats(statsResult.data as AssetStats);
    }
  }, [campaignId, page, assetFilter]);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Load campaign
      const campaignResult = await campaignsApi.getById(campaignId);
      if (campaignResult.error) {
        router.push("/campaigns");
        setLoading(false);
        return;
      }

      if (campaignResult.data) {
        setCampaign(campaignResult.data);
        setEditData({
          name: campaignResult.data.name,
          description: campaignResult.data.description || "",
          status: campaignResult.data.status,
        });
      }

      // Load assets
      await loadAssets();
      setLoading(false);
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, router, loadAssets]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const hasImageFiles = fileArray.some((f) => f.type.startsWith("image/"));

    if (hasImageFiles) {
      // Show dialog to let user choose if uploading as goods
      setPendingFiles(fileArray);
      setUploadAsGoods(false);
      setSelectedMerchType("album");
      setUploadDialogOpen(true);
    } else {
      // Non-image files: upload directly
      handleUploadFiles(fileArray, false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadFiles = async (
    files: File[],
    asGoods: boolean,
    merchType?: MerchandiseType
  ) => {
    setUploading(true);
    setUploadDialogOpen(false);
    const uploadPromises: Promise<void>[] = [];

    for (const file of files) {
      const fileId = `${file.name}-${Date.now()}`;
      setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

      const promise = (async () => {
        try {
          setUploadProgress((prev) => ({ ...prev, [fileId]: 50 }));

          // Determine upload options
          const isImageFile = file.type.startsWith("image/");
          const options = asGoods && isImageFile
            ? { assetType: "goods" as const, merchandiseType: merchType }
            : undefined;

          const result = await assetsApi.upload(campaignId, file, options);

          if (result.error) {
            console.error(`Failed to upload ${file.name}:`, result.error.message);
            setUploadProgress((prev) => ({ ...prev, [fileId]: -1 }));
          } else {
            setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }));
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          setUploadProgress((prev) => ({ ...prev, [fileId]: -1 }));
        }
      })();

      uploadPromises.push(promise);
    }

    await Promise.all(uploadPromises);

    setTimeout(() => {
      setUploadProgress({});
    }, 2000);

    await loadAssets();
    setUploading(false);
    setPendingFiles([]);
  };

  const handleUploadDialogConfirm = () => {
    handleUploadFiles(
      pendingFiles,
      uploadAsGoods,
      uploadAsGoods ? selectedMerchType : undefined
    );
  };

  const handleUploadDialogCancel = () => {
    setUploadDialogOpen(false);
    setPendingFiles([]);
  };

  const handleDeleteAsset = async (assetId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    const result = await assetsApi.delete(assetId);
    if (!result.error) {
      setAssets(assets.filter((a) => a.id !== assetId));
      await loadAssets();
    }
  };

  const handleUpdateCampaign = async () => {
    if (!campaign) return;

    const result = await campaignsApi.update(campaign.id, {
      name: editData.name,
      description: editData.description || undefined,
      status: editData.status,
    });

    if (result.data) {
      setCampaign(result.data);
      setEditMode(false);
    }
  };

  const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    draft: "secondary",
    active: "default",
    completed: "outline",
    archived: "outline",
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "image":
        return <Image className="h-8 w-8" />;
      case "video":
        return <Video className="h-8 w-8" />;
      case "audio":
        return <Music className="h-8 w-8" />;
      default:
        return <FolderOpen className="h-8 w-8" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Campaign Info Card */}
      <Card>
        <CardContent className="pt-6">
          {editMode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Enter description..."
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-40">
                  <Select
                    value={editData.status}
                    onValueChange={(value) => setEditData({ ...editData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleUpdateCampaign}>
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold">{campaign.name}</h2>
                  <Badge variant={statusVariants[campaign.status]}>
                    {campaign.status}
                  </Badge>
                </div>
                {campaign.description && (
                  <p className="text-sm text-muted-foreground mb-3">{campaign.description}</p>
                )}
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span>
                    Artist: <span className="text-foreground font-medium">{campaign.artist_stage_name || campaign.artist_name}</span>
                  </span>
                  {campaign.start_date && (
                    <span>
                      Start: <span className="text-foreground">{new Date(campaign.start_date).toLocaleDateString()}</span>
                    </span>
                  )}
                  {campaign.end_date && (
                    <span>
                      End: <span className="text-foreground">{new Date(campaign.end_date).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditMode(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asset Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Image className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Images</p>
                  <p className="text-xl font-bold">{stats.image}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Video className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Videos</p>
                  <p className="text-xl font-bold">{stats.video}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Music className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Audio</p>
                  <p className="text-xl font-bold">{stats.audio}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Goods</p>
                  <p className="text-xl font-bold">{stats.goods}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Asset Locker */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle>Asset Locker</CardTitle>
          <div className="flex items-center gap-4">
            {/* Filter */}
            <div className="flex items-center rounded-lg border p-1">
              {(["all", "image", "video", "audio", "goods"] as AssetFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setAssetFilter(filter);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    assetFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter === "goods" ? "Goods" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Upload Button */}
            <Button asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Upload Progress */}
          {Object.entries(uploadProgress).length > 0 && (
            <div className="mb-6 space-y-2">
              {Object.entries(uploadProgress).map(([fileId, progress]) => (
                <div key={fileId} className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        progress === -1
                          ? "bg-destructive"
                          : progress === 100
                          ? "bg-green-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${Math.max(0, progress)}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {progress === -1 ? "Failed" : progress === 100 ? "Done" : `${progress}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Content Grid */}
          {uploading && assets.length === 0 ? (
            <div className="text-center py-12">
              <Spinner className="h-8 w-8 mx-auto" />
              <p className="text-muted-foreground mt-4">Uploading...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                {assetFilter === "goods" ? (
                  <Package className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <h3 className="font-medium mb-2">
                {assetFilter === "goods" ? "No goods yet" : "No assets yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {assetFilter === "goods"
                  ? "Upload images and select 'Goods' type to add merchandise"
                  : "Upload images, videos, or audio files to get started"}
              </p>
              <Button asChild>
                <label className="cursor-pointer">
                  Upload Assets
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-xl overflow-hidden border bg-muted/30 hover:border-primary/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square flex items-center justify-center bg-muted">
                    {(asset.type === "image" || asset.type === "goods") && asset.s3_url ? (
                      <img
                        src={asset.s3_url}
                        alt={asset.original_filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-muted-foreground">{getAssetIcon(asset.type)}</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-medium truncate" title={asset.original_filename}>
                      {asset.original_filename}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {asset.type === "goods" && asset.merchandise_type
                        ? asset.merchandise_type.charAt(0).toUpperCase() + asset.merchandise_type.slice(1)
                        : formatFileSize(asset.file_size)}
                    </p>
                  </div>

                  {/* Actions Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {asset.s3_url && (
                      <a
                        href={asset.s3_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                      >
                        <ExternalLink className="h-5 w-5 text-white" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteAsset(asset.id, asset.original_filename)}
                      className="p-2 bg-destructive/20 rounded-lg hover:bg-destructive/30 transition-colors"
                    >
                      <Trash2 className="h-5 w-5 text-white" />
                    </button>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {asset.type === "goods" && asset.merchandise_type
                        ? asset.merchandise_type
                        : asset.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Type Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Asset Type</DialogTitle>
            <DialogDescription>
              You&apos;re uploading {pendingFiles.length} image file{pendingFiles.length > 1 ? "s" : ""}.
              Choose how to categorize them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Asset Type Selection */}
            <div className="flex gap-4">
              <button
                onClick={() => setUploadAsGoods(false)}
                className={`flex-1 p-4 border rounded-lg text-center transition-colors ${
                  !uploadAsGoods
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                }`}
              >
                <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">Image</p>
                <p className="text-xs text-muted-foreground mt-1">Regular image asset</p>
              </button>
              <button
                onClick={() => setUploadAsGoods(true)}
                className={`flex-1 p-4 border rounded-lg text-center transition-colors ${
                  uploadAsGoods
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                }`}
              >
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">Goods</p>
                <p className="text-xs text-muted-foreground mt-1">Merchandise / Product</p>
              </button>
            </div>

            {/* Merchandise Type Selection (when Goods selected) */}
            {uploadAsGoods && (
              <div className="space-y-2">
                <Label>Merchandise Type</Label>
                <Select
                  value={selectedMerchType}
                  onValueChange={(value) => setSelectedMerchType(value as MerchandiseType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MERCHANDISE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleUploadDialogCancel}>
              Cancel
            </Button>
            <Button onClick={handleUploadDialogConfirm}>
              <Upload className="h-4 w-4 mr-2" />
              Upload {uploadAsGoods ? "as Goods" : "as Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
