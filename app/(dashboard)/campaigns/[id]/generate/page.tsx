"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi, assetsApi, Campaign, Asset } from "@/lib/campaigns-api";
import {
  videoApi,
  VideoGeneration,
  VideoGenerationStats,
  VideoGenerationStatus,
} from "@/lib/video-api";

const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16 (Vertical)", icon: "portrait" },
  { value: "16:9", label: "16:9 (Horizontal)", icon: "landscape" },
  { value: "1:1", label: "1:1 (Square)", icon: "square" },
];

const DURATIONS = [
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 15, label: "15 seconds" },
];

const STYLES = [
  { value: "", label: "Auto" },
  { value: "cinematic", label: "Cinematic" },
  { value: "anime", label: "Anime" },
  { value: "realistic", label: "Realistic" },
  { value: "artistic", label: "Artistic" },
];

export default function VideoGeneratePage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [images, setImages] = useState<Asset[]>([]);
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [stats, setStats] = useState<VideoGenerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [referenceImageId, setReferenceImageId] = useState<string>("");
  const [style, setStyle] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [campaignResult, assetsResult, generationsResult, statsResult] =
        await Promise.all([
          campaignsApi.getById(campaignId),
          assetsApi.getByCampaign(campaignId, { type: "image", page_size: 50 }),
          videoApi.getAll(campaignId, { page_size: 10 }),
          videoApi.getStats(campaignId),
        ]);

      if (campaignResult.error) {
        router.push("/campaigns");
        return;
      }

      if (campaignResult.data) setCampaign(campaignResult.data);
      if (assetsResult.data) setImages(assetsResult.data.items);
      if (generationsResult.data) setGenerations(generationsResult.data.items);
      if (statsResult.data) setStats(statsResult.data);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for generation updates
  useEffect(() => {
    const activeGenerations = generations.filter(
      (g) => g.status === "pending" || g.status === "processing"
    );

    if (activeGenerations.length === 0) return;

    const interval = setInterval(async () => {
      const results = await Promise.all(
        activeGenerations.map((g) => videoApi.getById(g.id))
      );

      setGenerations((prev) =>
        prev.map((gen) => {
          const updated = results.find((r) => r.data?.id === gen.id);
          return updated?.data || gen;
        })
      );

      // Reload stats
      const statsResult = await videoApi.getStats(campaignId);
      if (statsResult.data) setStats(statsResult.data);
    }, 2000);

    return () => clearInterval(interval);
  }, [generations, campaignId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setError("");
    setGenerating(true);

    try {
      const result = await videoApi.create(campaignId, {
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim() || undefined,
        duration_seconds: duration,
        aspect_ratio: aspectRatio,
        reference_image_id: referenceImageId || undefined,
        reference_style: style || undefined,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        setGenerations((prev) => [result.data!, ...prev]);
        // Clear form
        setPrompt("");
        setNegativePrompt("");
        setReferenceImageId("");
        // Reload stats
        const statsResult = await videoApi.getStats(campaignId);
        if (statsResult.data) setStats(statsResult.data);
      }
    } catch (err) {
      setError("Failed to start generation");
    } finally {
      setGenerating(false);
    }
  };

  const handleCancel = async (generationId: string) => {
    const result = await videoApi.cancel(generationId);
    if (result.data) {
      setGenerations((prev) =>
        prev.map((g) => (g.id === generationId ? result.data! : g))
      );
    }
  };

  const handleDelete = async (generationId: string) => {
    if (!confirm("Delete this generation?")) return;

    const result = await videoApi.delete(generationId);
    if (!result.error) {
      setGenerations((prev) => prev.filter((g) => g.id !== generationId));
      const statsResult = await videoApi.getStats(campaignId);
      if (statsResult.data) setStats(statsResult.data);
    }
  };

  const getStatusColor = (status: VideoGenerationStatus) => {
    switch (status) {
      case "pending":
        return "bg-gray-500/20 text-gray-300";
      case "processing":
        return "bg-blue-500/20 text-blue-300";
      case "completed":
        return "bg-green-500/20 text-green-300";
      case "failed":
        return "bg-red-500/20 text-red-300";
      case "cancelled":
        return "bg-yellow-500/20 text-yellow-300";
      default:
        return "bg-gray-500/20 text-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/campaigns" className="hover:text-white transition-colors">
          Campaigns
        </Link>
        <span>/</span>
        <Link
          href={`/campaigns/${campaignId}`}
          className="hover:text-white transition-colors"
        >
          {campaign.name}
        </Link>
        <span>/</span>
        <span className="text-white">Generate Video</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Video Generation</h1>
          <p className="text-gray-400 mt-1">
            Generate videos using Veo 3 for {campaign.name}
          </p>
        </div>
        <Link
          href={`/campaigns/${campaignId}`}
          className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
        >
          Back to Campaign
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total", value: stats.total, color: "purple" },
            { label: "Pending", value: stats.pending, color: "gray" },
            { label: "Processing", value: stats.processing, color: "blue" },
            { label: "Completed", value: stats.completed, color: "green" },
            { label: "Failed", value: stats.failed, color: "red" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20"
            >
              <p className="text-gray-400 text-xs">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Generation Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">
            New Generation
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prompt <span className="text-red-400">*</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the video you want to generate..."
                rows={4}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Negative Prompt
              </label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What to avoid in the video..."
                rows={2}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Duration & Aspect Ratio */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {ASPECT_RATIOS.map((ar) => (
                    <option key={ar.value} value={ar.value}>
                      {ar.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Style
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference Image */}
            {images.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reference Image (Optional)
                </label>
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  <button
                    onClick={() => setReferenceImageId("")}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center ${
                      !referenceImageId
                        ? "border-purple-500 bg-purple-500/20"
                        : "border-white/20 hover:border-white/40"
                    }`}
                  >
                    <span className="text-gray-400 text-xs">None</span>
                  </button>
                  {images.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => setReferenceImageId(image.id)}
                      className={`aspect-square rounded-lg border-2 overflow-hidden ${
                        referenceImageId === image.id
                          ? "border-purple-500"
                          : "border-white/20 hover:border-white/40"
                      }`}
                    >
                      <img
                        src={image.s3_url}
                        alt={image.original_filename}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Starting Generation...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Generate Video
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generation History */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">
              Generation History
            </h2>
          </div>

          {generations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No generations yet
              </h3>
              <p className="text-gray-400">
                Start generating videos with the form on the left
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto">
              {generations.map((gen) => (
                <div key={gen.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                            gen.status
                          )}`}
                        >
                          {gen.status}
                        </span>
                        {gen.quality_score && (
                          <span className="text-xs text-gray-400">
                            Score: {gen.quality_score.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm line-clamp-2 mb-2">
                        {gen.prompt}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>{gen.duration_seconds}s</span>
                        <span>{gen.aspect_ratio}</span>
                        <span>
                          {new Date(gen.created_at).toLocaleString()}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      {(gen.status === "pending" ||
                        gen.status === "processing") && (
                        <div className="mt-3">
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 transition-all"
                              style={{ width: `${gen.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {gen.progress.toFixed(0)}%
                          </p>
                        </div>
                      )}

                      {/* Error Message */}
                      {gen.status === "failed" && gen.error_message && (
                        <p className="mt-2 text-xs text-red-400">
                          {gen.error_message}
                        </p>
                      )}

                      {/* Output Video */}
                      {gen.status === "completed" && gen.output_url && (
                        <div className="mt-3">
                          <a
                            href={gen.output_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            View Video
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {(gen.status === "pending" ||
                        gen.status === "processing") && (
                        <button
                          onClick={() => handleCancel(gen.id)}
                          className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-white/10 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(gen.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
