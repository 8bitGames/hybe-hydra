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

type AssetFilter = "all" | "image" | "video" | "audio";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
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

  const loadCampaign = useCallback(async () => {
    const result = await campaignsApi.getById(campaignId);
    if (result.error) {
      router.push("/campaigns");
      return;
    }
    if (result.data) {
      setCampaign(result.data);
      setEditData({
        name: result.data.name,
        description: result.data.description || "",
        status: result.data.status,
      });
    }
  }, [campaignId, router]);

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadCampaign(), loadAssets()]);
      setLoading(false);
    };
    loadData();
  }, [loadCampaign, loadAssets]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadPromises: Promise<void>[] = [];

    for (const file of Array.from(files)) {
      const fileId = `${file.name}-${Date.now()}`;
      setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

      const promise = (async () => {
        try {
          setUploadProgress((prev) => ({ ...prev, [fileId]: 50 }));
          const result = await assetsApi.upload(campaignId, file);

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

    // Clear progress after short delay
    setTimeout(() => {
      setUploadProgress({});
    }, 2000);

    // Reload assets
    await loadAssets();
    setUploading(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteAsset = async (assetId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    const result = await assetsApi.delete(assetId);
    if (!result.error) {
      setAssets(assets.filter((a) => a.id !== assetId));
      await loadAssets(); // Reload to update stats
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

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-300 border-gray-500/50",
    active: "bg-green-500/20 text-green-300 border-green-500/50",
    completed: "bg-blue-500/20 text-blue-300 border-blue-500/50",
    archived: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "image":
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case "video":
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case "audio":
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  return (
    <>
      {/* Breadcrumb */}
      <Link
        href="/campaigns"
        className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Campaigns
      </Link>

      {/* Campaign Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 mb-8">
        {editMode ? (
          <div className="space-y-4">
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="w-full text-2xl font-bold bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="Description..."
              rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <div className="flex items-center gap-4">
              <select
                value={editData.status}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <button
                onClick={handleUpdateCampaign}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-3xl font-bold text-white">{campaign.name}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[campaign.status]}`}>
                  {campaign.status}
                </span>
              </div>
              {campaign.description && (
                <p className="text-gray-400 mb-4">{campaign.description}</p>
              )}
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <span>
                  Artist: <span className="text-white">{campaign.artist_stage_name || campaign.artist_name}</span>
                </span>
                {campaign.start_date && (
                  <span>
                    Start: <span className="text-white">{new Date(campaign.start_date).toLocaleDateString()}</span>
                  </span>
                )}
                {campaign.end_date && (
                  <span>
                    End: <span className="text-white">{new Date(campaign.end_date).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/campaigns/${campaignId}/generate`}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Generate Video
              </Link>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Asset Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total</p>
                <p className="text-xl font-bold text-white">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Images</p>
                <p className="text-xl font-bold text-white">{stats.image}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Videos</p>
                <p className="text-xl font-bold text-white">{stats.video}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Audio</p>
                <p className="text-xl font-bold text-white">{stats.audio}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Locker */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Asset Locker</h2>

            <div className="flex items-center gap-4">
              {/* Filter */}
              <div className="flex items-center bg-white/10 rounded-lg p-1">
                {(["all", "image", "video", "audio"] as AssetFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setAssetFilter(filter);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      assetFilter === filter
                        ? "bg-purple-500 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>

              {/* Upload Button */}
              <label className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
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
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {Object.entries(uploadProgress).length > 0 && (
          <div className="p-4 border-b border-white/10 space-y-2">
            {Object.entries(uploadProgress).map(([fileId, progress]) => (
              <div key={fileId} className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      progress === -1 ? "bg-red-500" : progress === 100 ? "bg-green-500" : "bg-purple-500"
                    }`}
                    style={{ width: `${Math.max(0, progress)}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-20 text-right">
                  {progress === -1 ? "Failed" : progress === 100 ? "Done" : `${progress}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Assets Grid */}
        {uploading && assets.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="text-gray-400 mt-4">Uploading...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No assets yet</h3>
            <p className="text-gray-400 mb-4">Upload images, videos, or audio files to get started</p>
            <label className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer font-medium">
              Upload Assets
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-colors"
              >
                {/* Thumbnail */}
                <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  {asset.type === "image" && asset.s3_url ? (
                    <img
                      src={asset.s3_url}
                      alt={asset.original_filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-500">{getAssetIcon(asset.type)}</div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate" title={asset.original_filename}>
                    {asset.original_filename}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {formatFileSize(asset.file_size)}
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
                      title="View"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteAsset(asset.id, asset.original_filename)}
                    className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Type Badge */}
                <div className="absolute top-2 left-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    asset.type === "image"
                      ? "bg-green-500/20 text-green-300"
                      : asset.type === "video"
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-pink-500/20 text-pink-300"
                  }`}>
                    {asset.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
