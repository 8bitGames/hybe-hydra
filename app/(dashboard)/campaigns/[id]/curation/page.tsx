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
import { useI18n } from "@/lib/i18n";

type SortOption = "score" | "date" | "status";
type ViewMode = "mosaic" | "list";
type GenerationTypeFilter = "all" | "AI" | "COMPOSE";

export default function CurationDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useI18n();
  const campaignId = params.id as string;

  // Translations
  const t = {
    total: language === "ko" ? "전체" : "Total",
    pending: language === "ko" ? "대기중" : "Pending",
    processing: language === "ko" ? "처리중" : "Processing",
    completed: language === "ko" ? "완료됨" : "Completed",
    failed: language === "ko" ? "실패" : "Failed",
    sortByScore: language === "ko" ? "점수순" : "Sort by Score",
    sortByDate: language === "ko" ? "날짜순" : "Sort by Date",
    compareMode: language === "ko" ? "비교 모드" : "Compare Mode",
    selected: language === "ko" ? "선택됨" : "selected",
    noGenerations: language === "ko" ? "생성된 영상이 없습니다" : "No generations yet",
    startGenerating: language === "ko" ? "영상을 생성해보세요" : "Start generating videos to see them here",
    generateVideos: language === "ko" ? "영상 생성" : "Generate Videos",
    abComparison: language === "ko" ? "A/B 비교" : "A/B Comparison",
    clearSelection: language === "ko" ? "선택 해제" : "Clear Selection",
    noVideoAvailable: language === "ko" ? "영상 없음" : "No video available",
    generationDetails: language === "ko" ? "생성 상세" : "Generation Details",
    qualityScore: language === "ko" ? "품질 점수" : "Quality Score",
    scoreBreakdown: language === "ko" ? "점수 분석" : "Score Breakdown",
    promptQuality: language === "ko" ? "프롬프트 품질" : "Prompt Quality",
    technicalSettings: language === "ko" ? "기술 설정" : "Technical Settings",
    styleAlignment: language === "ko" ? "스타일 일치도" : "Style Alignment",
    trendAlignment: language === "ko" ? "트렌드 일치도" : "Trend Alignment",
    recommendations: language === "ko" ? "추천사항" : "Recommendations",
    noScoreYet: language === "ko" ? "아직 점수가 계산되지 않았습니다" : "No score calculated yet",
    calculateScore: language === "ko" ? "점수 계산" : "Calculate Score",
    aiCaption: language === "ko" ? "AI 캡션" : "AI Caption",
    generateAiCaption: language === "ko" ? "AI 캡션 생성" : "Generate AI Caption",
    generatingCaption: language === "ko" ? "캡션 생성 중..." : "Generating Caption...",
    hookLine: language === "ko" ? "훅 라인" : "Hook Line",
    callToAction: language === "ko" ? "행동 유도" : "Call to Action",
    copyAll: language === "ko" ? "모두 복사" : "Copy All",
    copied: language === "ko" ? "복사됨!" : "Copied!",
    addMusic: language === "ko" ? "음악 추가" : "Add Music",
    composed: language === "ko" ? "조합됨" : "Composed",
    currentAudioTrack: language === "ko" ? "현재 오디오 트랙" : "Current Audio Track",
    selectAudioTrack: language === "ko" ? "오디오 트랙 선택" : "Select Audio Track",
    chooseAudioFile: language === "ko" ? "오디오 파일 선택..." : "Choose audio file...",
    noAudioFiles: language === "ko" ? "업로드된 오디오 파일이 없습니다" : "No audio files uploaded",
    uploadAudio: language === "ko" ? "오디오 업로드" : "Upload Audio",
    musicVolume: language === "ko" ? "음악 볼륨" : "Music Volume",
    audioStartTime: language === "ko" ? "오디오 시작 시간" : "Audio Start Time",
    fadeIn: language === "ko" ? "페이드 인" : "Fade In",
    fadeOut: language === "ko" ? "페이드 아웃" : "Fade Out",
    mixWithOriginalAudio: language === "ko" ? "원본 오디오와 믹스" : "Mix with Original Audio",
    originalAudioVolume: language === "ko" ? "원본 오디오 볼륨" : "Original Audio Volume",
    composingVideo: language === "ko" ? "영상 조합 중..." : "Composing Video...",
    replaceAudio: language === "ko" ? "오디오 교체" : "Replace Audio",
    addAudioToVideo: language === "ko" ? "영상에 오디오 추가" : "Add Audio to Video",
    videoMustBeGenerated: language === "ko" ? "음악을 추가하려면 먼저 영상을 생성해야 합니다" : "Video must be generated first before adding music",
    details: language === "ko" ? "상세" : "Details",
    duration: language === "ko" ? "길이" : "Duration",
    aspectRatio: language === "ko" ? "화면비" : "Aspect Ratio",
    status: language === "ko" ? "상태" : "Status",
    created: language === "ko" ? "생성일" : "Created",
    delete: language === "ko" ? "삭제" : "Delete",
    download: language === "ko" ? "다운로드" : "Download",
    close: language === "ko" ? "닫기" : "Close",
    imageAudioCompose: language === "ko" ? "이미지+오디오 조합" : "Image+Audio Compose",
    aiGenerated: language === "ko" ? "AI 생성" : "AI Generated",
    negative: language === "ko" ? "네거티브" : "Negative",
    noScore: language === "ko" ? "점수 없음" : "No score",
    on: language === "ko" ? "켜짐" : "On",
    off: language === "ko" ? "꺼짐" : "Off",
    volume: language === "ko" ? "볼륨" : "Volume",
    start: language === "ko" ? "시작" : "Start",
    // Type filter
    typeAll: language === "ko" ? "전체 타입" : "All Types",
    typeAI: language === "ko" ? "AI 생성" : "AI Generated",
    typeCompose: language === "ko" ? "컴포즈" : "Compose",
  };

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [stats, setStats] = useState<VideoGenerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoringAll, setScoringAll] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("mosaic");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [statusFilter, setStatusFilter] = useState<string>("completed");
  const [typeFilter, setTypeFilter] = useState<GenerationTypeFilter>("all");

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
    .filter((g) => {
      // Status filter
      if (statusFilter !== "all" && g.status !== statusFilter) {
        return false;
      }
      // Type filter
      if (typeFilter !== "all" && g.generation_type !== typeFilter) {
        return false;
      }
      return true;
    })
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
    <div className="space-y-6">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: t.total, value: stats.total, key: "all" },
            { label: t.pending, value: stats.pending, key: "pending" },
            { label: t.processing, value: stats.processing, key: "processing" },
            { label: t.completed, value: stats.completed, key: "completed" },
            { label: t.failed, value: stats.failed, key: "failed" },
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
              <SelectItem value="score">{t.sortByScore}</SelectItem>
              <SelectItem value="date">{t.sortByDate}</SelectItem>
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as GenerationTypeFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.typeAll}</SelectItem>
              <SelectItem value="AI">{t.typeAI}</SelectItem>
              <SelectItem value="COMPOSE">{t.typeCompose}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Compare Mode Toggle */}
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.length}/2 {t.selected}
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
            {t.compareMode}
          </Button>
        </div>
      </div>

      {/* A/B Comparison View */}
      {compareMode && selectedIds.length === 2 && (
        <Card className="mb-6 border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              {t.abComparison}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              {t.clearSelection}
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
                        {t.noVideoAvailable}
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
          <h3 className="text-xl font-medium text-foreground mb-2">{t.noGenerations}</h3>
          <p className="text-muted-foreground mb-6">{t.startGenerating}</p>
          <Button asChild>
            <Link href={`/campaigns/${campaignId}/generate`}>
              {t.generateVideos}
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
                        <span className="text-muted-foreground text-sm">{t.noScore}</span>
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
              <CardTitle>{t.generationDetails}</CardTitle>
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
                          {getVideoSourceType(selectedGeneration) === "compose" ? t.imageAudioCompose : t.aiGenerated}
                        </Badge>
                      )}
                    </div>
                    {selectedGeneration.negative_prompt && (
                      <p className="text-sm text-muted-foreground">
                        <span className="text-muted-foreground">{t.negative}:</span> {selectedGeneration.negative_prompt}
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
                          <span className="text-muted-foreground">{t.qualityScore}</span>
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
                          <h4 className="text-foreground font-medium">{t.scoreBreakdown}</h4>
                          {[
                            { label: t.promptQuality, score: scoreDetails[selectedGeneration.id].breakdown.promptQuality.score, weight: 35 },
                            { label: t.technicalSettings, score: scoreDetails[selectedGeneration.id].breakdown.technicalSettings.score, weight: 20 },
                            { label: t.styleAlignment, score: scoreDetails[selectedGeneration.id].breakdown.styleAlignment.score, weight: 30 },
                            { label: t.trendAlignment, score: scoreDetails[selectedGeneration.id].breakdown.trendAlignment.score, weight: 15 },
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
                          <h4 className="text-foreground font-medium mb-3">{t.recommendations}</h4>
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
                      <p className="text-muted-foreground mb-4">{t.noScoreYet}</p>
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
                        {t.calculateScore}
                      </Button>
                    </div>
                  )}

                  {/* Caption Generation */}
                  <div className="bg-muted rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-foreground font-medium flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        {t.aiCaption}
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
                                  <p className="text-primary text-xs mb-1">{t.hookLine}</p>
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
                                  <p className="text-secondary-foreground text-xs mb-1">{t.callToAction}</p>
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
                                      {t.copied}
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 mr-1" />
                                      {t.copyAll}
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
                            {t.generatingCaption}
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            {t.generateAiCaption}
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
                        {t.addMusic}
                      </h4>
                      {composeInfo[selectedGeneration.id]?.is_composed && (
                        <Badge variant="secondary" className="text-green-600">
                          <Check className="w-3 h-3 mr-1" />
                          {t.composed}
                        </Badge>
                      )}
                    </div>

                    {/* Show current composition info if exists */}
                    {composeInfo[selectedGeneration.id]?.is_composed && composeInfo[selectedGeneration.id]?.composition && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                        <p className="text-green-600 text-xs mb-1">{t.currentAudioTrack}</p>
                        <p className="text-foreground text-sm font-medium">
                          {composeInfo[selectedGeneration.id].composition?.audio_asset_name}
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          {t.volume}: {((composeInfo[selectedGeneration.id].composition?.audio_volume || 1) * 100).toFixed(0)}% •
                          {t.start}: {composeInfo[selectedGeneration.id].composition?.audio_start_time || 0}s
                        </p>
                      </div>
                    )}

                    {/* Audio selection and controls */}
                    {getVideoUrl(selectedGeneration) && (
                      <div className="space-y-4">
                        {/* Audio Asset Select */}
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">{t.selectAudioTrack}</label>
                          {audioAssets.length > 0 ? (
                            <Select value={selectedAudioId} onValueChange={setSelectedAudioId}>
                              <SelectTrigger>
                                <SelectValue placeholder={t.chooseAudioFile} />
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
                              <p className="text-sm text-muted-foreground mb-2">{t.noAudioFiles}</p>
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/campaigns/${campaignId}`}>
                                  <Plus className="w-4 h-4 mr-2" />
                                  {t.uploadAudio}
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
                                  {t.musicVolume}
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
                                <label className="text-sm text-muted-foreground">{t.audioStartTime}</label>
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
                                  <label className="text-sm text-muted-foreground">{t.fadeIn}</label>
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
                                  <label className="text-sm text-muted-foreground">{t.fadeOut}</label>
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
                                {t.mixWithOriginalAudio}
                              </label>
                              <Button
                                variant={mixOriginalAudio ? "default" : "outline"}
                                size="sm"
                                onClick={() => setMixOriginalAudio(!mixOriginalAudio)}
                              >
                                {mixOriginalAudio ? t.on : t.off}
                              </Button>
                            </div>

                            {mixOriginalAudio && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm text-muted-foreground">{t.originalAudioVolume}</label>
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
                                  {t.composingVideo}
                                </>
                              ) : (
                                <>
                                  <Music className="w-4 h-4 mr-2" />
                                  {composeInfo[selectedGeneration.id]?.is_composed ? t.replaceAudio : t.addAudioToVideo}
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {!getVideoUrl(selectedGeneration) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t.videoMustBeGenerated}
                      </p>
                    )}
                  </div>

                  {/* Meta Info */}
                  <div className="bg-muted rounded-xl p-4">
                    <h4 className="text-foreground font-medium mb-3">{t.details}</h4>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">{t.duration}</dt>
                        <dd className="text-foreground">{selectedGeneration.duration_seconds}s</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t.aspectRatio}</dt>
                        <dd className="text-foreground">{selectedGeneration.aspect_ratio}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t.status}</dt>
                        <dd className="text-foreground capitalize">{selectedGeneration.status}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t.created}</dt>
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
                {t.delete}
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
                      {t.download}
                    </a>
                  </Button>
                )}
                <Button onClick={() => setSelectedGeneration(null)}>
                  {t.close}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
