"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi, assetsApi, Campaign, Asset } from "@/lib/campaigns-api";
import {
  videoApi,
  scoringApi,
  captionApi,
  composeApi,
  VideoGeneration,
  VideoGenerationStats,
  ScoringResult,
  CaptionResult,
  CaptionPlatform,
  CaptionStyle,
  CaptionLanguage,
  GeneratedCaption,
  ComposeOptions,
  ComposeInfoResponse,
} from "@/lib/video-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Plus, Grid3X3, List, Music, Trash2, X, Play, Download, MessageSquare, Zap, Copy, Check, ChevronLeft, ChevronRight, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

type SortOption = "score" | "date" | "status";
type ViewMode = "mosaic" | "list";

export default function CurationDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [stats, setStats] = useState<VideoGenerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoringAll, setScoringAll] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("mosaic");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [statusFilter, setStatusFilter] = useState<string>("completed");

  // Selection state for A/B comparison
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  // Modal state
  const [selectedGeneration, setSelectedGeneration] = useState<VideoGeneration | null>(null);
  const [scoreDetails, setScoreDetails] = useState<Record<string, ScoringResult>>({});

  // Caption state
  const [captionCache, setCaptionCache] = useState<Record<string, CaptionResult>>({});
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("engaging");
  const [captionLanguage, setCaptionLanguage] = useState<CaptionLanguage>("ko");
  const [captionPlatform, setCaptionPlatform] = useState<CaptionPlatform>("tiktok");
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);

  // Audio composition state
  const [audioAssets, setAudioAssets] = useState<Asset[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [audioVolume, setAudioVolume] = useState(1.0);
  const [audioStartTime, setAudioStartTime] = useState(0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [mixOriginalAudio, setMixOriginalAudio] = useState(false);
  const [originalAudioVolume, setOriginalAudioVolume] = useState(0.3);
  const [composing, setComposing] = useState(false);
  const [composeInfo, setComposeInfo] = useState<Record<string, ComposeInfoResponse>>({});

  // Video playback refs
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const loadData = useCallback(async () => {
    try {
      const [campaignResult, generationsResult, statsResult, assetsResult] = await Promise.all([
        campaignsApi.getById(campaignId),
        videoApi.getAll(campaignId, { page_size: 100 }),
        videoApi.getStats(campaignId),
        assetsApi.getByCampaign(campaignId, { type: "audio", page_size: 50 }),
      ]);

      if (campaignResult.error) {
        router.push("/campaigns");
        return;
      }

      if (campaignResult.data) setCampaign(campaignResult.data);
      if (generationsResult.data) setGenerations(generationsResult.data.items);
      if (statsResult.data) setStats(statsResult.data);
      if (assetsResult.data) setAudioAssets(assetsResult.data.items);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sort and filter generations
  const sortedGenerations = [...generations]
    .filter((g) => statusFilter === "all" || g.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === "score") {
        return (b.quality_score || 0) - (a.quality_score || 0);
      } else if (sortBy === "date") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

  const getGrade = (score: number | null) => {
    if (!score) return null;
    if (score >= 90) return "S";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    return "D";
  };

  const getGradeColor = (grade: string | null) => {
    switch (grade) {
      case "S":
        return "bg-gradient-to-r from-yellow-400 to-amber-500 text-black";
      case "A":
        return "bg-green-500 text-white";
      case "B":
        return "bg-blue-500 text-white";
      case "C":
        return "bg-orange-500 text-white";
      case "D":
        return "bg-red-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Helper to get the best available video URL (prefer composed_output_url)
  const getVideoUrl = (gen: VideoGeneration): string | null => {
    return gen.composed_output_url || gen.output_url || null;
  };

  // Helper to determine video source type
  const getVideoSourceType = (gen: VideoGeneration): "compose" | "ai" | "none" => {
    if (gen.composed_output_url) return "compose";
    if (gen.output_url) return "ai";
    return "none";
  };

  const handleScoreAll = async () => {
    setScoringAll(true);
    try {
      const result = await scoringApi.scoreAllInCampaign(campaignId, {
        only_unscored: true,
      });
      if (result.data && result.data.scored > 0) {
        const scoreMap = new Map(
          result.data.results.map((r) => [r.generation_id, r.total_score])
        );
        setGenerations((prev) =>
          prev.map((g) =>
            scoreMap.has(g.id) ? { ...g, quality_score: scoreMap.get(g.id)! } : g
          )
        );
      }
    } catch (err) {
      console.error("Failed to score all:", err);
    } finally {
      setScoringAll(false);
    }
  };

  const handleSelectForCompare = (genId: string) => {
    if (selectedIds.includes(genId)) {
      setSelectedIds(selectedIds.filter((id) => id !== genId));
    } else if (selectedIds.length < 2) {
      setSelectedIds([...selectedIds, genId]);
    }
  };

  const handleOpenDetail = async (gen: VideoGeneration) => {
    setSelectedGeneration(gen);

    // Load score details
    if (gen.quality_score && !scoreDetails[gen.id]) {
      try {
        const result = await scoringApi.getScore(gen.id);
        if (result.data) {
          setScoreDetails((prev) => ({ ...prev, [gen.id]: result.data! }));
        }
      } catch (err) {
        console.error("Failed to get score details:", err);
      }
    }

    // Load compose info
    loadComposeInfo(gen.id);
  };

  const handleDelete = async (genId: string) => {
    if (!confirm("Delete this generation?")) return;
    const result = await videoApi.delete(genId);
    if (!result.error) {
      setGenerations((prev) => prev.filter((g) => g.id !== genId));
      setSelectedGeneration(null);
    }
  };

  const handleVideoHover = (genId: string, isHovering: boolean) => {
    const video = videoRefs.current[genId];
    if (video) {
      if (isHovering) {
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    }
  };

  // Caption generation handler
  const handleGenerateCaption = async (genId: string) => {
    setGeneratingCaption(true);
    try {
      const result = await captionApi.generate(genId, {
        style: captionStyle,
        language: captionLanguage,
        platform: captionPlatform,
      });
      if (result.data && "result" in result.data) {
        const captionResult = result.data.result as CaptionResult;
        setCaptionCache((prev) => ({ ...prev, [genId]: captionResult }));
      }
    } catch (err) {
      console.error("Failed to generate caption:", err);
    } finally {
      setGeneratingCaption(false);
    }
  };

  // Copy caption to clipboard
  const handleCopyCaption = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCaption(type);
      setTimeout(() => setCopiedCaption(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Format caption with hashtags for copy
  const formatCaptionForCopy = (caption: GeneratedCaption): string => {
    let text = caption.caption;
    if (caption.hashtags.length > 0) {
      text += "\n\n" + caption.hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" ");
    }
    return text;
  };

  // Audio composition handler
  const handleCompose = async (genId: string) => {
    if (!selectedAudioId) return;

    setComposing(true);
    try {
      const options: ComposeOptions = {
        audio_asset_id: selectedAudioId,
        audio_start_time: audioStartTime,
        audio_volume: audioVolume,
        fade_in: fadeIn,
        fade_out: fadeOut,
        mix_original_audio: mixOriginalAudio,
        original_audio_volume: originalAudioVolume,
      };

      const result = await composeApi.compose(genId, options);
      if (result.data) {
        // Update the generation with new output URL
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === genId
              ? { ...g, output_url: result.data!.output_url }
              : g
          )
        );
        if (selectedGeneration?.id === genId) {
          setSelectedGeneration({ ...selectedGeneration, output_url: result.data.output_url });
        }
        // Fetch and cache compose info
        const infoResult = await composeApi.getInfo(genId);
        if (infoResult.data) {
          setComposeInfo((prev) => ({ ...prev, [genId]: infoResult.data! }));
        }
        // Reset audio settings
        setSelectedAudioId("");
        setAudioStartTime(0);
        setFadeIn(0);
        setFadeOut(0);
      }
    } catch (err) {
      console.error("Failed to compose video:", err);
    } finally {
      setComposing(false);
    }
  };

  // Load compose info when opening detail modal
  const loadComposeInfo = async (genId: string) => {
    if (!composeInfo[genId]) {
      try {
        const infoResult = await composeApi.getInfo(genId);
        if (infoResult.data) {
          setComposeInfo((prev) => ({ ...prev, [genId]: infoResult.data! }));
        }
      } catch (err) {
        console.error("Failed to get compose info:", err);
      }
    }
  };

  // Compare mode view
  const compareGenerations = selectedIds
    .map((id) => generations.find((g) => g.id === id))
    .filter(Boolean) as VideoGeneration[];

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
        <Link
          href={`/campaigns/${campaignId}`}
          className="hover:text-foreground transition-colors"
        >
          {campaign.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">Curation</span>
      </div>

      {/* Header - Step 3 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Badge variant="outline" className="font-normal">Step 3</Badge>
            <span>Review, score, and select videos</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Curate Videos</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/campaigns/${campaignId}/generate`}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Generate
            </Link>
          </Button>
          {generations.some((g) => g.status === "completed" && !g.quality_score) && (
            <Button
              onClick={handleScoreAll}
              disabled={scoringAll}
              variant="secondary"
            >
              {scoringAll ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Scoring...
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 mr-2" />
                  Score All
                </>
              )}
            </Button>
          )}
          <Button asChild>
            <Link href={`/campaigns/${campaignId}/publish`}>
              Next: Publish
              <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total", value: stats.total, key: "all" },
            { label: "Pending", value: stats.pending, key: "pending" },
            { label: "Processing", value: stats.processing, key: "processing" },
            { label: "Completed", value: stats.completed, key: "completed" },
            { label: "Failed", value: stats.failed, key: "failed" },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => setStatusFilter(stat.key)}
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
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* View Mode */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === "mosaic" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("mosaic")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Sort by Score</SelectItem>
              <SelectItem value="date">Sort by Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Compare Mode Toggle */}
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.length}/2 selected
            </span>
          )}
          <Button
            variant={compareMode ? "default" : "outline"}
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) setSelectedIds([]);
            }}
          >
            <Music className="w-4 h-4 mr-2" />
            Compare Mode
          </Button>
        </div>
      </div>

      {/* A/B Comparison View */}
      {compareMode && selectedIds.length === 2 && (
        <Card className="mb-6 border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              A/B Comparison
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Clear Selection
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {compareGenerations.map((gen, idx) => (
                <div key={gen.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={idx === 0 ? "default" : "secondary"}>
                      {idx === 0 ? "A" : "B"}
                    </Badge>
                    {gen.quality_score && (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getGradeColor(getGrade(gen.quality_score))}`}>
                          {getGrade(gen.quality_score)}
                        </span>
                        <span className="text-foreground font-medium">{gen.quality_score.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
                    {getVideoUrl(gen) ? (
                      <video
                        src={getVideoUrl(gen)!}
                        controls
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No video available
                      </div>
                    )}
                    {getVideoSourceType(gen) === "compose" && (
                      <Badge className="absolute top-2 left-2 bg-purple-500 text-white">
                        Compose
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{gen.prompt}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mosaic Grid */}
      {sortedGenerations.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-medium text-foreground mb-2">No generations yet</h3>
          <p className="text-muted-foreground mb-6">Start generating videos to see them here</p>
          <Button asChild>
            <Link href={`/campaigns/${campaignId}/generate`}>
              Generate Videos
            </Link>
          </Button>
        </Card>
      ) : viewMode === "mosaic" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {sortedGenerations.map((gen) => {
            const grade = getGrade(gen.quality_score);
            const isSelected = selectedIds.includes(gen.id);
            return (
              <div
                key={gen.id}
                className={`group relative bg-card rounded-xl overflow-hidden border transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/50"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => compareMode ? handleSelectForCompare(gen.id) : handleOpenDetail(gen)}
                onMouseEnter={() => handleVideoHover(gen.id, true)}
                onMouseLeave={() => handleVideoHover(gen.id, false)}
              >
                {/* Video/Thumbnail */}
                <div className="aspect-[9/16] bg-muted">
                  {getVideoUrl(gen) ? (
                    <video
                      ref={(el) => { videoRefs.current[gen.id] = el; }}
                      src={getVideoUrl(gen)!}
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {gen.status === "processing" || gen.status === "pending" ? (
                        <div className="text-center">
                          <Spinner className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">{gen.progress}%</p>
                        </div>
                      ) : gen.status === "failed" ? (
                        <X className="w-10 h-10 text-destructive" />
                      ) : (
                        <Play className="w-10 h-10 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>

                {/* Video Source Type Badge */}
                {getVideoSourceType(gen) === "compose" && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5">
                      Compose
                    </Badge>
                  </div>
                )}

                {/* Score Badge */}
                {grade && (
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getGradeColor(grade)}`}>
                      {grade} <span className="opacity-80">{gen.quality_score?.toFixed(0)}</span>
                    </span>
                  </div>
                )}

                {/* Compare Checkbox */}
                {compareMode && (
                  <div className="absolute top-2 left-2">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground bg-background/50"
                    }`}>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary-foreground" />
                      )}
                    </div>
                  </div>
                )}

                {/* Status Badge (for non-completed) - positioned below compose badge if exists */}
                {gen.status !== "completed" && (
                  <div className={`absolute left-2 ${getVideoSourceType(gen) === "compose" ? "top-9" : "top-2"}`}>
                    <Badge variant={
                      gen.status === "processing" ? "default" :
                      gen.status === "pending" ? "secondary" :
                      gen.status === "failed" ? "destructive" : "outline"
                    }>
                      {gen.status}
                    </Badge>
                  </div>
                )}

                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2">
                  <span className="px-2 py-0.5 bg-black/60 rounded text-xs text-white">
                    {gen.duration_seconds}s
                  </span>
                </div>

                {/* Hover Overlay */}
                {!compareMode && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-white text-xs line-clamp-2">{gen.prompt}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <div className="divide-y divide-border">
            {sortedGenerations.map((gen) => {
              const grade = getGrade(gen.quality_score);
              return (
                <div
                  key={gen.id}
                  className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleOpenDetail(gen)}
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-24 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0 relative">
                      {getVideoUrl(gen) ? (
                        <video src={getVideoUrl(gen)!} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Play className="w-6 h-6" />
                        </div>
                      )}
                      {getVideoSourceType(gen) === "compose" && (
                        <Badge className="absolute bottom-1 left-1 bg-purple-500 text-white text-[8px] px-1 py-0">
                          Compose
                        </Badge>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm line-clamp-1">{gen.prompt}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{gen.duration_seconds}s</span>
                        <span>{gen.aspect_ratio}</span>
                        <span>{new Date(gen.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-3">
                      {grade ? (
                        <>
                          <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getGradeColor(grade)}`}>
                            {grade}
                          </span>
                          <span className="text-foreground font-medium w-12 text-right">
                            {gen.quality_score?.toFixed(1)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">No score</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Detail Modal */}
      {selectedGeneration && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle>Generation Details</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedGeneration(null)}
              >
                <X className="w-6 h-6" />
              </Button>
            </CardHeader>

            {/* Modal Content */}
            <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Video Player */}
                <div>
                  <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
                    {getVideoUrl(selectedGeneration) ? (
                      <video
                        src={getVideoUrl(selectedGeneration)!}
                        controls
                        autoPlay
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {selectedGeneration.status === "completed" ? "Video not available" : selectedGeneration.status}
                      </div>
                    )}
                    {getVideoSourceType(selectedGeneration) === "compose" && (
                      <Badge className="absolute top-3 left-3 bg-purple-500 text-white">
                        Compose Video
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground flex-1">{selectedGeneration.prompt}</p>
                      {getVideoSourceType(selectedGeneration) !== "none" && (
                        <Badge variant="outline" className="text-xs">
                          {getVideoSourceType(selectedGeneration) === "compose" ? "이미지+오디오 조합" : "AI 생성"}
                        </Badge>
                      )}
                    </div>
                    {selectedGeneration.negative_prompt && (
                      <p className="text-sm text-muted-foreground">
                        <span className="text-muted-foreground">Negative:</span> {selectedGeneration.negative_prompt}
                      </p>
                    )}
                  </div>
                </div>

                {/* Score Details */}
                <div className="space-y-4">
                  {selectedGeneration.quality_score ? (
                    <>
                      {/* Score Header */}
                      <div className="bg-muted rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-muted-foreground">Quality Score</span>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-lg text-lg font-bold ${getGradeColor(getGrade(selectedGeneration.quality_score))}`}>
                              {getGrade(selectedGeneration.quality_score)}
                            </span>
                            <span className="text-3xl font-bold text-foreground">
                              {selectedGeneration.quality_score.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        {/* Score Bar */}
                        <div className="h-3 bg-background rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${
                              selectedGeneration.quality_score >= 90 ? "from-yellow-400 to-amber-500" :
                              selectedGeneration.quality_score >= 80 ? "from-green-400 to-green-500" :
                              selectedGeneration.quality_score >= 70 ? "from-blue-400 to-blue-500" :
                              selectedGeneration.quality_score >= 60 ? "from-orange-400 to-orange-500" :
                              "from-red-400 to-red-500"
                            }`}
                            style={{ width: `${selectedGeneration.quality_score}%` }}
                          />
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      {scoreDetails[selectedGeneration.id] && (
                        <div className="bg-muted rounded-xl p-4 space-y-3">
                          <h4 className="text-foreground font-medium">Score Breakdown</h4>
                          {[
                            { label: "Prompt Quality", score: scoreDetails[selectedGeneration.id].breakdown.promptQuality.score, weight: 35 },
                            { label: "Technical Settings", score: scoreDetails[selectedGeneration.id].breakdown.technicalSettings.score, weight: 20 },
                            { label: "Style Alignment", score: scoreDetails[selectedGeneration.id].breakdown.styleAlignment.score, weight: 30 },
                            { label: "Trend Alignment", score: scoreDetails[selectedGeneration.id].breakdown.trendAlignment.score, weight: 15 },
                          ].map((item) => (
                            <div key={item.label}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-muted-foreground">{item.label} <span className="opacity-60">({item.weight}%)</span></span>
                                <span className="text-foreground">{item.score}</span>
                              </div>
                              <div className="h-2 bg-background rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${item.score}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Recommendations */}
                      {scoreDetails[selectedGeneration.id]?.recommendations?.length > 0 && (
                        <div className="bg-muted rounded-xl p-4">
                          <h4 className="text-foreground font-medium mb-3">Recommendations</h4>
                          <ul className="space-y-2">
                            {scoreDetails[selectedGeneration.id].recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <span className="text-amber-500">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-muted rounded-xl p-6 text-center">
                      <p className="text-muted-foreground mb-4">No score calculated yet</p>
                      <Button
                        onClick={async () => {
                          const result = await scoringApi.scoreGeneration(selectedGeneration.id);
                          if (result.data) {
                            setScoreDetails((prev) => ({ ...prev, [selectedGeneration.id]: result.data! }));
                            setGenerations((prev) =>
                              prev.map((g) =>
                                g.id === selectedGeneration.id
                                  ? { ...g, quality_score: result.data!.total_score }
                                  : g
                              )
                            );
                            setSelectedGeneration({ ...selectedGeneration, quality_score: result.data.total_score });
                          }
                        }}
                      >
                        Calculate Score
                      </Button>
                    </div>
                  )}

                  {/* Caption Generation */}
                  <div className="bg-muted rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-foreground font-medium flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        AI Caption
                      </h4>
                      {!captionCache[selectedGeneration.id] && (
                        <div className="flex items-center gap-2">
                          <Select value={captionLanguage} onValueChange={(v) => setCaptionLanguage(v as CaptionLanguage)}>
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ko">Korean</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="ja">Japanese</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={captionStyle} onValueChange={(v) => setCaptionStyle(v as CaptionStyle)}>
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="engaging">Engaging</SelectItem>
                              <SelectItem value="question">Question</SelectItem>
                              <SelectItem value="story">Story</SelectItem>
                              <SelectItem value="minimal">Minimal</SelectItem>
                              <SelectItem value="professional">Professional</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {captionCache[selectedGeneration.id] ? (
                      <div className="space-y-4">
                        {/* Platform Tabs */}
                        <div className="flex gap-2">
                          {(["tiktok", "youtube", "instagram"] as CaptionPlatform[]).map((platform) => (
                            <Button
                              key={platform}
                              variant={captionPlatform === platform ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCaptionPlatform(platform)}
                            >
                              {platform === "tiktok" ? "TikTok" : platform === "youtube" ? "YouTube" : "Instagram"}
                            </Button>
                          ))}
                        </div>

                        {/* Caption Content */}
                        {(() => {
                          const platformCaption = captionCache[selectedGeneration.id].platformOptimized[captionPlatform];
                          return (
                            <div className="space-y-3">
                              {/* Hook Line */}
                              {platformCaption.hookLine && (
                                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                                  <p className="text-primary text-xs mb-1">Hook Line</p>
                                  <p className="text-foreground text-sm">{platformCaption.hookLine}</p>
                                </div>
                              )}

                              {/* Main Caption */}
                              <div className="relative group">
                                <p className="text-muted-foreground text-sm whitespace-pre-wrap bg-background rounded-lg p-3 pr-10">
                                  {platformCaption.caption}
                                </p>
                                <button
                                  onClick={() => handleCopyCaption(platformCaption.caption, "caption")}
                                  className="absolute top-2 right-2 p-1.5 bg-muted rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted-foreground/20"
                                  title="Copy caption"
                                >
                                  {copiedCaption === "caption" ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </button>
                              </div>

                              {/* Hashtags */}
                              <div className="flex flex-wrap gap-1.5">
                                {platformCaption.hashtags.slice(0, 8).map((tag, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                  >
                                    #{tag.replace(/^#/, "")}
                                  </Badge>
                                ))}
                                {platformCaption.hashtags.length > 8 && (
                                  <span className="px-2 py-0.5 text-xs text-muted-foreground">
                                    +{platformCaption.hashtags.length - 8} more
                                  </span>
                                )}
                              </div>

                              {/* Call to Action */}
                              {platformCaption.callToAction && (
                                <div className="bg-secondary/50 border border-secondary rounded-lg p-3">
                                  <p className="text-secondary-foreground text-xs mb-1">Call to Action</p>
                                  <p className="text-foreground text-sm">{platformCaption.callToAction}</p>
                                </div>
                              )}

                              {/* SEO Score & Copy All */}
                              <div className="flex items-center justify-between pt-2 border-t border-border">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">SEO Score</span>
                                  <span className={`text-sm font-medium ${
                                    platformCaption.seoScore >= 80 ? "text-green-500" :
                                    platformCaption.seoScore >= 60 ? "text-yellow-500" : "text-red-500"
                                  }`}>
                                    {platformCaption.seoScore}/100
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleCopyCaption(formatCaptionForCopy(platformCaption), "all")}
                                >
                                  {copiedCaption === "all" ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 mr-1" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 mr-1" />
                                      Copy All
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleGenerateCaption(selectedGeneration.id)}
                        disabled={generatingCaption}
                        className="w-full"
                      >
                        {generatingCaption ? (
                          <>
                            <Spinner className="h-4 w-4 mr-2" />
                            Generating Caption...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Generate AI Caption
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Add Music Section */}
                  <div className="bg-muted rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-foreground font-medium flex items-center gap-2">
                        <Music className="w-5 h-5 text-primary" />
                        Add Music
                      </h4>
                      {composeInfo[selectedGeneration.id]?.is_composed && (
                        <Badge variant="secondary" className="text-green-600">
                          <Check className="w-3 h-3 mr-1" />
                          Composed
                        </Badge>
                      )}
                    </div>

                    {/* Show current composition info if exists */}
                    {composeInfo[selectedGeneration.id]?.is_composed && composeInfo[selectedGeneration.id]?.composition && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                        <p className="text-green-600 text-xs mb-1">Current Audio Track</p>
                        <p className="text-foreground text-sm font-medium">
                          {composeInfo[selectedGeneration.id].composition?.audio_asset_name}
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Volume: {((composeInfo[selectedGeneration.id].composition?.audio_volume || 1) * 100).toFixed(0)}% •
                          Start: {composeInfo[selectedGeneration.id].composition?.audio_start_time || 0}s
                        </p>
                      </div>
                    )}

                    {/* Audio selection and controls */}
                    {getVideoUrl(selectedGeneration) && (
                      <div className="space-y-4">
                        {/* Audio Asset Select */}
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">Select Audio Track</label>
                          {audioAssets.length > 0 ? (
                            <Select value={selectedAudioId} onValueChange={setSelectedAudioId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose audio file..." />
                              </SelectTrigger>
                              <SelectContent>
                                {audioAssets.map((asset) => (
                                  <SelectItem key={asset.id} value={asset.id}>
                                    {asset.filename}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-center py-4 bg-background rounded-lg">
                              <p className="text-sm text-muted-foreground mb-2">No audio files uploaded</p>
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/campaigns/${campaignId}`}>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Upload Audio
                                </Link>
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Audio Settings */}
                        {selectedAudioId && (
                          <>
                            {/* Volume */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-muted-foreground flex items-center gap-2">
                                  <Volume2 className="w-4 h-4" />
                                  Music Volume
                                </label>
                                <span className="text-sm text-foreground">{(audioVolume * 100).toFixed(0)}%</span>
                              </div>
                              <Slider
                                value={[audioVolume * 100]}
                                onValueChange={([v]) => setAudioVolume(v / 100)}
                                max={100}
                                step={5}
                                className="w-full"
                              />
                            </div>

                            {/* Start Time */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-muted-foreground">Audio Start Time</label>
                                <span className="text-sm text-foreground">{audioStartTime}s</span>
                              </div>
                              <Slider
                                value={[audioStartTime]}
                                onValueChange={([v]) => setAudioStartTime(v)}
                                max={60}
                                step={1}
                                className="w-full"
                              />
                            </div>

                            {/* Fade Controls */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm text-muted-foreground">Fade In</label>
                                  <span className="text-sm text-foreground">{fadeIn}s</span>
                                </div>
                                <Slider
                                  value={[fadeIn]}
                                  onValueChange={([v]) => setFadeIn(v)}
                                  max={5}
                                  step={0.5}
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm text-muted-foreground">Fade Out</label>
                                  <span className="text-sm text-foreground">{fadeOut}s</span>
                                </div>
                                <Slider
                                  value={[fadeOut]}
                                  onValueChange={([v]) => setFadeOut(v)}
                                  max={5}
                                  step={0.5}
                                  className="w-full"
                                />
                              </div>
                            </div>

                            {/* Mix Original Audio */}
                            <div className="flex items-center justify-between">
                              <label className="text-sm text-muted-foreground flex items-center gap-2">
                                {mixOriginalAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                Mix with Original Audio
                              </label>
                              <Button
                                variant={mixOriginalAudio ? "default" : "outline"}
                                size="sm"
                                onClick={() => setMixOriginalAudio(!mixOriginalAudio)}
                              >
                                {mixOriginalAudio ? "On" : "Off"}
                              </Button>
                            </div>

                            {mixOriginalAudio && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm text-muted-foreground">Original Audio Volume</label>
                                  <span className="text-sm text-foreground">{(originalAudioVolume * 100).toFixed(0)}%</span>
                                </div>
                                <Slider
                                  value={[originalAudioVolume * 100]}
                                  onValueChange={([v]) => setOriginalAudioVolume(v / 100)}
                                  max={100}
                                  step={5}
                                  className="w-full"
                                />
                              </div>
                            )}

                            {/* Compose Button */}
                            <Button
                              onClick={() => handleCompose(selectedGeneration.id)}
                              disabled={composing}
                              className="w-full"
                            >
                              {composing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Composing Video...
                                </>
                              ) : (
                                <>
                                  <Music className="w-4 h-4 mr-2" />
                                  {composeInfo[selectedGeneration.id]?.is_composed ? "Replace Audio" : "Add Audio to Video"}
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {!getVideoUrl(selectedGeneration) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Video must be generated first before adding music
                      </p>
                    )}
                  </div>

                  {/* Meta Info */}
                  <div className="bg-muted rounded-xl p-4">
                    <h4 className="text-foreground font-medium mb-3">Details</h4>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Duration</dt>
                        <dd className="text-foreground">{selectedGeneration.duration_seconds}s</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Aspect Ratio</dt>
                        <dd className="text-foreground">{selectedGeneration.aspect_ratio}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="text-foreground capitalize">{selectedGeneration.status}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="text-foreground">{new Date(selectedGeneration.created_at).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </CardContent>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/50">
              <Button
                variant="destructive"
                onClick={() => handleDelete(selectedGeneration.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <div className="flex items-center gap-3">
                {getVideoUrl(selectedGeneration) && (
                  <Button variant="outline" asChild>
                    <a
                      href={getVideoUrl(selectedGeneration)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                )}
                <Button onClick={() => setSelectedGeneration(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
