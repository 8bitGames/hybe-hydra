"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
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
  Music,
  Loader2,
  Wand2,
  Check,
  Clock,
  AlertCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Subtitles,
  Palette,
  Film,
  ChevronDown,
  ChevronUp,
  Upload,
  SkipForward,
  HelpCircle,
  Zap,
  Shuffle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAssets } from "@/lib/queries";
import { useAuthStore } from "@/lib/auth-store";
import {
  videoEditApi,
  VideoEditRequest,
  SubtitleStyle,
} from "@/lib/video-api";
import { fastCutApi, AudioAnalysisResponse } from "@/lib/fast-cut-api";
import type { Asset } from "@/lib/campaigns-api";
import type { LyricsData } from "@/lib/subtitle-styles";
import { AudioAIRecommendation } from "@/components/features/audio/AudioAIRecommendation";

interface VideoEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generationId: string;
  campaignId: string;
  videoUrl: string | null;
  onEditStarted?: (newGenerationId: string) => void;
}

type SubtitleModeType = "none" | "lyrics" | "manual";

export function VideoEditModal({
  open,
  onOpenChange,
  generationId,
  campaignId,
  videoUrl,
  onEditStarted,
}: VideoEditModalProps) {
  const { language } = useI18n();

  // File input ref for upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio player refs
  const audioRef = useRef<HTMLAudioElement>(null);

  // Video ref for duration detection
  const videoRef = useRef<HTMLVideoElement>(null);

  // Source video state
  const [sourceVideoDuration, setSourceVideoDuration] = useState<number | null>(null);

  // Audio analysis state
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResponse | null>(null);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);
  const [triedStartTimes, setTriedStartTimes] = useState<number[]>([]);  // Track tried segments for variety

  // Audio state
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioStartTime, setAudioStartTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(15);
  const [audioVolume, setAudioVolume] = useState(1.0);
  const [fadeIn, setFadeIn] = useState(1.0);
  const [fadeOut, setFadeOut] = useState(2.0);
  const [musicSkipped, setMusicSkipped] = useState(false);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [loadingAudioUrl, setLoadingAudioUrl] = useState(false);
  const [isPlayingSegment, setIsPlayingSegment] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Subtitles state
  const [subtitleMode, setSubtitleMode] = useState<SubtitleModeType>("none");
  const [lyricsText, setLyricsText] = useState("");
  const [syncedLyrics, setSyncedLyrics] = useState<LyricsData | null>(null);
  const [languageHint, setLanguageHint] = useState<"ko" | "en" | "ja" | "auto">("auto");
  const [syncing, setSyncing] = useState(false);

  // Subtitle style
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    font_size: "medium",
    font_style: "bold",
    color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 3,
    animation: "fade",
    position: "center",
    bottom_margin: 10,
  });

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStyleSettings, setShowStyleSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch audio assets
  const { data: assetsData, isLoading: loadingAssets, refetch: refetchAssets } = useAssets(campaignId, {
    type: "AUDIO",
    page_size: 100,
  });

  const audioAssets = assetsData?.items || [];

  // Get lyrics from selected asset metadata
  const selectedAudioLyrics = useMemo((): LyricsData | null => {
    if (!selectedAsset) return null;

    const metadata = selectedAsset.metadata as Record<string, unknown> | null;
    const lyrics = metadata?.lyrics as LyricsData | undefined;

    if (lyrics && Array.isArray(lyrics.segments) && lyrics.segments.length > 0) {
      return lyrics;
    }
    return null;
  }, [selectedAsset]);

  // Translations
  const t = {
    title: language === "ko" ? "영상 편집" : "Edit Video",
    description: language === "ko"
      ? "영상에 음원과 자막을 추가하세요"
      : "Add audio and subtitles to your video",
    audioSection: language === "ko" ? "음원 선택" : "Select Audio",
    noAudioAssets: language === "ko" ? "음원이 없습니다" : "No audio assets",
    uploadAudioHint: language === "ko"
      ? "음원 파일을 드래그하거나 클릭하여 업로드"
      : "Drag and drop or click to upload audio",
    uploading: language === "ko" ? "업로드 중..." : "Uploading...",
    audioSettings: language === "ko" ? "음원 설정" : "Audio Settings",
    startTime: language === "ko" ? "시작 위치" : "Start Time",
    volume: language === "ko" ? "볼륨" : "Volume",
    fadeIn: language === "ko" ? "페이드 인" : "Fade In",
    fadeOut: language === "ko" ? "페이드 아웃" : "Fade Out",
    seconds: language === "ko" ? "초" : "sec",
    skipMusic: language === "ko" ? "음원 없이 진행" : "Skip Audio",
    unskipMusic: language === "ko" ? "음원 다시 선택" : "Select Audio",
    musicSkipped: language === "ko" ? "음원 없이 진행" : "Proceeding without audio",
    musicSkippedDesc: language === "ko"
      ? "영상이 음원 없이 편집됩니다"
      : "Video will be edited without audio",
    subtitleSection: language === "ko" ? "자막 설정" : "Subtitle Settings",
    subtitleModeNone: language === "ko" ? "자막 없음" : "No Subtitles",
    subtitleModeLyrics: language === "ko" ? "가사 자막" : "Lyrics Subtitles",
    subtitleModeManual: language === "ko" ? "직접 입력" : "Manual Input",
    subtitleModeNoneDesc: language === "ko"
      ? "자막 없이 영상 편집"
      : "Edit video without subtitles",
    subtitleModeLyricsDesc: language === "ko"
      ? "음원에서 추출한 가사 (음악 타이밍에 맞춤)"
      : "Extracted lyrics from audio (synced to music timing)",
    subtitleModeManualDesc: language === "ko"
      ? "가사를 직접 입력하고 싱크를 맞춥니다"
      : "Enter lyrics manually and sync timing",
    lyricsInput: language === "ko" ? "가사 입력" : "Enter Lyrics",
    lyricsPlaceholder: language === "ko"
      ? "가사를 줄바꿈으로 구분하여 입력하세요..."
      : "Enter lyrics separated by line breaks...",
    languageLabel: language === "ko" ? "언어" : "Language",
    auto: language === "ko" ? "자동 감지" : "Auto Detect",
    korean: language === "ko" ? "한국어" : "Korean",
    english: language === "ko" ? "영어" : "English",
    japanese: language === "ko" ? "일본어" : "Japanese",
    syncButton: language === "ko" ? "싱크 맞추기" : "Sync Lyrics",
    syncing: language === "ko" ? "싱크 맞추는 중..." : "Syncing...",
    syncResult: language === "ko" ? "싱크 결과" : "Sync Result",
    segments: language === "ko" ? "개 구간" : " segments",
    subtitleStyle: language === "ko" ? "자막 스타일" : "Subtitle Style",
    fontSize: language === "ko" ? "글자 크기" : "Font Size",
    small: language === "ko" ? "작게" : "Small",
    medium: language === "ko" ? "보통" : "Medium",
    large: language === "ko" ? "크게" : "Large",
    fontStyle: language === "ko" ? "글꼴" : "Font Style",
    bold: language === "ko" ? "굵게" : "Bold",
    modern: language === "ko" ? "모던" : "Modern",
    minimal: language === "ko" ? "미니멀" : "Minimal",
    classic: language === "ko" ? "클래식" : "Classic",
    animation: language === "ko" ? "애니메이션" : "Animation",
    fade: language === "ko" ? "페이드" : "Fade",
    typewriter: language === "ko" ? "타이핑" : "Typewriter",
    karaoke: language === "ko" ? "노래방" : "Karaoke",
    slideUp: language === "ko" ? "슬라이드 업" : "Slide Up",
    scalePop: language === "ko" ? "팝" : "Pop",
    bounce: language === "ko" ? "바운스" : "Bounce",
    glitch: language === "ko" ? "글리치" : "Glitch",
    wave: language === "ko" ? "웨이브" : "Wave",
    position: language === "ko" ? "위치" : "Position",
    top: language === "ko" ? "상단" : "Top",
    center: language === "ko" ? "중앙" : "Center",
    bottom: language === "ko" ? "하단" : "Bottom",
    textColor: language === "ko" ? "글자 색상" : "Text Color",
    strokeColor: language === "ko" ? "테두리 색상" : "Stroke Color",
    advancedSettings: language === "ko" ? "고급 설정" : "Advanced Settings",
    submit: language === "ko" ? "영상 편집 시작" : "Start Editing",
    submitting: language === "ko" ? "편집 요청 중..." : "Submitting...",
    cancel: language === "ko" ? "취소" : "Cancel",
    success: language === "ko" ? "편집이 시작되었습니다!" : "Edit started!",
    noOptionsSelected: language === "ko"
      ? "음원 또는 자막 중 하나 이상을 선택하세요"
      : "Select at least audio or subtitles",
    extractLyrics: language === "ko" ? "가사 자동 추출" : "Auto-extract Lyrics",
    extracting: language === "ko" ? "추출 중..." : "Extracting...",
    lyricsPreview: language === "ko" ? "가사 미리보기" : "Lyrics Preview",
    visible: language === "ko" ? "표시됨" : "visible",
    videoDuration: language === "ko" ? "영상 길이" : "Video Duration",
    playbackRegion: language === "ko" ? "음악 재생 구간" : "Audio Playback Region",
    regionWarning: language === "ko"
      ? "재생 구간이 음악 길이를 초과합니다. 나머지 구간은 반복 재생됩니다."
      : "Playback region exceeds audio length. Remaining section will loop.",
    aiRecommendation: language === "ko" ? "AI 추천" : "AI Recommendation",
    analyzing: language === "ko" ? "분석 중..." : "Analyzing...",
    detectedBpm: language === "ko" ? "분석된 BPM" : "Detected BPM",
    suggestedSegment: language === "ko" ? "추천 구간" : "Suggested Segment",
    useSuggestedTime: language === "ko" ? "추천 시작 시간 사용" : "Use Suggested Time",
    previewSegment: language === "ko" ? "구간 미리듣기" : "Preview Segment",
    tryDifferent: language === "ko" ? "다른 구간 선택" : "Try Different",
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedAsset(null);
      setAudioUrl(null);
      setAudioStartTime(0);
      setAudioVolume(1.0);
      setFadeIn(1.0);
      setFadeOut(2.0);
      setMusicSkipped(false);
      setSubtitleMode("none");
      setLyricsText("");
      setSyncedLyrics(null);
      setError(null);
      setSuccess(false);
      setShowAdvanced(false);
      setShowStyleSettings(false);
      setAudioAnalysis(null);
      setAnalyzingAudio(false);
      // Note: videoDuration and sourceVideoDuration will be set by video metadata effect
    }
  }, [open]);

  // Detect source video duration
  useEffect(() => {
    if (open && videoUrl) {
      const video = document.createElement("video");
      video.src = videoUrl;
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const detectedDuration = Math.round(video.duration);
        console.log("[VideoEditModal] Detected video duration:", detectedDuration);
        setSourceVideoDuration(detectedDuration);
        // Set video duration to match source (capped at 30s max, min 5s)
        setVideoDuration(Math.min(30, Math.max(5, detectedDuration)));
      };
      video.onerror = () => {
        console.warn("[VideoEditModal] Failed to detect video duration, using default");
        setSourceVideoDuration(null);
        setVideoDuration(15);
      };
    }
  }, [open, videoUrl]);

  // Analyze audio when asset is selected
  useEffect(() => {
    if (selectedAsset && !musicSkipped) {
      const analyzeAudio = async () => {
        setAnalyzingAudio(true);
        setAudioAnalysis(null);
        try {
          const targetDuration = sourceVideoDuration || videoDuration || 15;
          const analysis = await fastCutApi.analyzeAudioBestSegment(selectedAsset.id, targetDuration);
          console.log("[VideoEditModal] Audio analysis result:", analysis);
          setAudioAnalysis(analysis);
          // Auto-apply suggested start time
          if (analysis.suggestedStartTime !== undefined) {
            console.log("[VideoEditModal] Auto-applying suggested start time:", analysis.suggestedStartTime);
            setAudioStartTime(analysis.suggestedStartTime);
          }
        } catch (err) {
          console.error("[VideoEditModal] Audio analysis failed:", err);
          // Not critical - just won't show AI recommendation
        } finally {
          setAnalyzingAudio(false);
        }
      };
      analyzeAudio();
    }
  }, [selectedAsset, musicSkipped, sourceVideoDuration]);

  // Update synced lyrics when audio has embedded lyrics and lyrics mode is selected
  useEffect(() => {
    if (subtitleMode === "lyrics" && selectedAudioLyrics) {
      setSyncedLyrics(selectedAudioLyrics);
      if (selectedAudioLyrics.fullText) {
        setLyricsText(selectedAudioLyrics.fullText);
      }
    }
  }, [subtitleMode, selectedAudioLyrics]);

  // Fetch presigned URL for selected audio
  const fetchAudioUrl = useCallback(async (asset: Asset) => {
    if (!asset.s3_key && !asset.s3_url) return;

    setLoadingAudioUrl(true);
    try {
      const params = asset.s3_key
        ? `key=${encodeURIComponent(asset.s3_key)}`
        : `url=${encodeURIComponent(asset.s3_url)}`;

      const response = await fetch(`/api/v1/assets/presign?${params}`);
      if (!response.ok) throw new Error("Failed to get audio URL");

      const data = await response.json();
      setAudioUrl(data.presignedUrl);
    } catch (err) {
      console.error("Failed to get presigned URL:", err);
    } finally {
      setLoadingAudioUrl(false);
    }
  }, []);

  // Handle re-analyze audio for variety selection
  const handleReAnalyzeAudio = useCallback(async () => {
    if (!selectedAsset || analyzingAudio) return;

    setAnalyzingAudio(true);
    try {
      // Collect current start time and previously tried ones
      const excludeStarts = [...triedStartTimes, audioStartTime].filter(
        (t, i, arr) => arr.indexOf(t) === i
      );

      console.log("[VideoEditModal] Re-analyzing audio with excludeStarts:", excludeStarts);

      const targetDuration = sourceVideoDuration || videoDuration || 15;
      const analysis = await fastCutApi.analyzeAudioBestSegment(
        selectedAsset.id,
        targetDuration,
        {
          preferVariety: true,
          excludeStarts,
        }
      );

      console.log("[VideoEditModal] Re-analysis result:", analysis);
      setAudioAnalysis(analysis);

      // Apply new suggested start time
      if (analysis.suggestedStartTime !== undefined) {
        setAudioStartTime(analysis.suggestedStartTime);
      }

      // Track tried times
      setTriedStartTimes(excludeStarts);
    } catch (err) {
      console.error("[VideoEditModal] Re-analyze failed:", err);
    } finally {
      setAnalyzingAudio(false);
    }
  }, [selectedAsset, analyzingAudio, triedStartTimes, audioStartTime, sourceVideoDuration, videoDuration]);

  // Handle asset selection
  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setAudioLoaded(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setMusicSkipped(false);
    setTriedStartTimes([]);  // Reset tried times for new audio
    fetchAudioUrl(asset);

    // Check if asset has existing lyrics
    const metadata = asset.metadata as Record<string, unknown> | null;
    const existingLyrics = metadata?.lyrics as LyricsData | undefined;
    if (existingLyrics?.segments && existingLyrics.segments.length > 0) {
      // If audio has lyrics, default to lyrics mode
      setSubtitleMode("lyrics");
      setSyncedLyrics(existingLyrics);
      if (existingLyrics.fullText) {
        setLyricsText(existingLyrics.fullText);
      }
    } else {
      // Reset subtitle mode when selecting audio without lyrics
      setSubtitleMode("none");
      setSyncedLyrics(null);
      setLyricsText("");
    }
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    let authState = useAuthStore.getState();
    let accessToken = authState.accessToken;
    const hasHydrated = authState._hasHydrated;

    if (!hasHydrated) {
      await new Promise(resolve => setTimeout(resolve, 500));
      authState = useAuthStore.getState();
      accessToken = authState.accessToken;

      if (!authState._hasHydrated || !accessToken) {
        setUploadError(language === 'ko'
          ? '로그인 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
          : 'Loading authentication. Please try again in a moment.');
        return;
      }
    }

    if (!accessToken) {
      setUploadError(language === 'ko'
        ? '로그인이 필요합니다. 페이지를 새로고침 해주세요.'
        : 'Please log in. Try refreshing the page.');
      return;
    }

    if (!campaignId) {
      setUploadError(language === 'ko'
        ? '캠페인이 선택되지 않았습니다.'
        : 'No campaign selected.');
      return;
    }

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg'];
    if (!validTypes.includes(file.type)) {
      setUploadError(language === 'ko'
        ? '지원하는 형식: MP3, WAV, FLAC, OGG'
        : 'Supported formats: MP3, WAV, FLAC, OGG');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setUploadError(language === 'ko'
        ? '파일 크기는 500MB 이하여야 합니다'
        : 'File must be less than 500MB');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/v1/campaigns/${campaignId}/assets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.detail || 'Upload failed');
        } else {
          const text = await response.text();
          if (response.status === 413) {
            throw new Error(language === 'ko'
              ? '파일이 너무 큽니다. 50MB 이하의 파일을 업로드해주세요.'
              : 'File is too large. Please upload a file under 50MB.');
          }
          if (response.status === 403) {
            throw new Error(language === 'ko'
              ? '업로드 권한이 없습니다. 페이지를 새로고침하고 다시 시도해주세요.'
              : 'Upload not authorized. Please refresh the page and try again.');
          }
          throw new Error(text || `Upload failed with status ${response.status}`);
        }
      }

      const data = await response.json();

      // Refresh assets list and select the uploaded one
      await refetchAssets();

      // Create a temporary asset object to select
      const uploadedAsset: Asset = {
        id: data.id,
        campaign_id: campaignId,
        filename: data.filename,
        original_filename: file.name,
        s3_url: data.s3_url,
        s3_key: data.s3_key,
        type: "audio",
        file_size: file.size,
        mime_type: file.type,
        vector_embedding_id: data.vector_embedding_id || null,
        thumbnail_url: data.thumbnail_url || null,
        metadata: data.metadata || {},
        created_by: data.created_by || "",
        created_at: new Date().toISOString(),
      };

      handleSelectAsset(uploadedAsset);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [campaignId, language, refetchAssets]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = '';
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Audio player controls
  const togglePlayPause = async () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Playback error:", err);
      }
    }
  };

  // Play selected segment only
  const playSelectedSegment = async () => {
    if (!audioRef.current) return;
    try {
      // Stop current playback if any
      audioRef.current.pause();
      // Set to segment start time
      audioRef.current.currentTime = audioStartTime;
      setIsPlayingSegment(true);
      await audioRef.current.play();
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Segment playback error:", err);
      }
      setIsPlayingSegment(false);
    }
  };

  // Stop segment playback when it reaches the end time
  useEffect(() => {
    if (isPlayingSegment && audioRef.current) {
      const segmentEndTime = audioStartTime + videoDuration;
      if (currentTime >= segmentEndTime) {
        audioRef.current.pause();
        setIsPlayingSegment(false);
      }
    }
  }, [currentTime, isPlayingSegment, audioStartTime, videoDuration]);

  // Reset segment playing state when playback stops
  useEffect(() => {
    if (!isPlaying) {
      setIsPlayingSegment(false);
    }
  }, [isPlaying]);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Sync lyrics with audio
  const handleSyncLyrics = async () => {
    if (!selectedAsset || !lyricsText.trim()) {
      setError(language === "ko" ? "음원과 가사를 모두 입력해주세요" : "Please select audio and enter lyrics");
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const response = await api.post<{ lyrics: LyricsData; cached: boolean }>("/api/v1/audio/lyrics", {
        assetId: selectedAsset.id,
        lyrics: lyricsText.trim(),
        languageHint,
        forceReExtract: true,
      });

      if (response.error) {
        throw new Error(response.error.message || "Sync failed");
      }

      if (response.data?.lyrics) {
        setSyncedLyrics(response.data.lyrics);
      }
    } catch (err) {
      console.error("Sync error:", err);
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Extract lyrics from audio using AI
  const handleExtractLyrics = async () => {
    if (!selectedAsset) {
      setError(language === "ko" ? "먼저 음원을 선택해주세요" : "Please select audio first");
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const response = await api.post<{ lyrics: LyricsData }>("/api/v1/audio/extract-lyrics", {
        assetId: selectedAsset.id,
        languageHint,
      });

      if (response.error) {
        throw new Error(response.error.message || "Extraction failed");
      }

      if (response.data?.lyrics) {
        setSyncedLyrics(response.data.lyrics);
        setLyricsText(response.data.lyrics.fullText || "");
        setSubtitleMode("lyrics");
      }
    } catch (err) {
      console.error("Extract error:", err);
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setSyncing(false);
    }
  };

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: string, newGenerationId: string) => {
    const POLL_INTERVAL = 3000; // 3 seconds
    const MAX_POLLS = 60; // Max 3 minutes
    let pollCount = 0;

    const poll = async (): Promise<void> => {
      try {
        pollCount++;
        console.log(`[VideoEditModal] Polling job ${jobId} (attempt ${pollCount}/${MAX_POLLS})`);

        const response = await fetch(`/api/v1/jobs/${jobId}/poll`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Poll failed: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[VideoEditModal] Poll result:`, data);

        if (data.is_final) {
          if (data.status === "completed") {
            setSuccess(true);
            onEditStarted?.(newGenerationId);
            setTimeout(() => {
              onOpenChange(false);
            }, 1500);
          } else if (data.status === "failed") {
            setError(language === "ko" ? "편집 실패" : "Edit failed");
            setSubmitting(false);
          }
          return;
        }

        // Continue polling if not final and under max polls
        if (pollCount < MAX_POLLS) {
          setTimeout(poll, POLL_INTERVAL);
        } else {
          // Max polls reached - assume it's still processing but close modal
          console.log(`[VideoEditModal] Max polls reached, assuming background processing`);
          setSuccess(true);
          onEditStarted?.(newGenerationId);
          setTimeout(() => {
            onOpenChange(false);
          }, 1500);
        }
      } catch (err) {
        console.error("[VideoEditModal] Poll error:", err);
        // Continue polling on error (might be temporary)
        if (pollCount < MAX_POLLS) {
          setTimeout(poll, POLL_INTERVAL);
        }
      }
    };

    // Start polling after a short delay
    setTimeout(poll, POLL_INTERVAL);
  }, [language, onEditStarted, onOpenChange]);

  // Submit edit request
  const handleSubmit = async () => {
    // Validate: need at least audio or subtitles
    const hasAudio = !musicSkipped && selectedAsset;
    const hasSubtitles = subtitleMode !== "none" && syncedLyrics && syncedLyrics.segments.length > 0;

    if (!hasAudio && !hasSubtitles) {
      setError(t.noOptionsSelected);
      return;
    }

    if (subtitleMode !== "none" && (!syncedLyrics || syncedLyrics.segments.length === 0)) {
      setError(language === "ko" ? "자막 싱크를 맞춰주세요" : "Please sync subtitles first");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const request: VideoEditRequest = {};

      if (hasAudio && selectedAsset) {
        request.audio = {
          asset_id: selectedAsset.id,
          start_time: audioStartTime,
          volume: audioVolume,
          fade_in: fadeIn,
          fade_out: fadeOut,
        };
      }

      if (hasSubtitles && syncedLyrics) {
        // Offset subtitle timing by audioStartTime to align with video
        // Filter out segments that would have negative start times
        const adjustedLines = syncedLyrics.segments
          .map((seg) => ({
            text: seg.text,
            start: seg.start - audioStartTime,
            end: seg.end - audioStartTime,
          }))
          .filter((line) => line.end > 0); // Only include lines that are visible in video

        // Clamp start times to 0 if they're slightly negative
        const clampedLines = adjustedLines.map((line) => ({
          ...line,
          start: Math.max(0, line.start),
        }));

        if (clampedLines.length > 0) {
          request.subtitles = {
            lines: clampedLines,
            style: subtitleStyle,
          };
        }
      }

      const response = await videoEditApi.edit(generationId, request);

      if (response.error) {
        throw new Error(response.error.message || "Edit failed");
      }

      // Start polling for job completion
      const jobId = response.data?.job_id;
      const newGenerationId = response.data?.id;

      if (jobId && newGenerationId) {
        console.log(`[VideoEditModal] Job submitted, starting poll for ${jobId}`);
        pollJobStatus(jobId, newGenerationId);
      } else {
        // Fallback to old behavior if no job_id
        setSuccess(true);
        onEditStarted?.(response.data?.id || "");
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (err) {
      console.error("Edit error:", err);
      setError(err instanceof Error ? err.message : "Edit failed");
      setSubmitting(false);
    }
    // Note: Don't set submitting to false here - polling will handle it
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/flac,audio/ogg,.mp3,.wav,.flac,.ogg"
          onChange={handleFileChange}
          className="hidden"
        />

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 pb-4">
            {/* ===== AUDIO SECTION ===== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  {t.audioSection}
                </h3>
                {!musicSkipped && !selectedAsset && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMusicSkipped(true)}
                    className="text-muted-foreground"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    {t.skipMusic}
                  </Button>
                )}
              </div>

              {/* Music Skipped State */}
              {musicSkipped && (
                <div className="flex flex-col items-center justify-center py-8 bg-muted/50 rounded-lg border border-dashed">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <VolumeX className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t.musicSkipped}</p>
                  <p className="text-xs text-muted-foreground mb-3">{t.musicSkippedDesc}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMusicSkipped(false)}
                  >
                    <Volume2 className="h-3 w-3 mr-1" />
                    {t.unskipMusic}
                  </Button>
                </div>
              )}

              {/* Upload Area */}
              {!musicSkipped && !selectedAsset && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer",
                    uploading ? "border-muted-foreground/50 bg-muted/50" : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/30"
                  )}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  <div className="flex items-center justify-center gap-3">
                    {uploading ? (
                      <>
                        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                        <span className="text-sm text-muted-foreground">{t.uploading}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{t.uploadAudioHint}</span>
                        <span className="text-xs text-muted-foreground/70">(MP3, WAV, FLAC, OGG)</span>
                      </>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-xs text-destructive text-center mt-2">{uploadError}</p>
                  )}
                </div>
              )}

              {/* Audio Asset List */}
              {!musicSkipped && !selectedAsset && (
                <div className="space-y-2">
                  {loadingAssets ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : audioAssets.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <p className="text-sm">{t.noAudioAssets}</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-40 border rounded-lg">
                      <div className="p-2 space-y-1">
                        {audioAssets.map((asset) => (
                          <div
                            key={asset.id}
                            onClick={() => handleSelectAsset(asset)}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                              "hover:bg-muted"
                            )}
                          >
                            <Music className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {asset.original_filename}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Selected Audio & Settings */}
              {!musicSkipped && selectedAsset && (
                <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/30">
                  {/* Selected Audio Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Music className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{selectedAsset.original_filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {duration > 0 && formatTime(duration)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {analyzingAudio && (
                        <Badge variant="outline" className="text-xs animate-pulse">
                          <Zap className="h-3 w-3 mr-1" />
                          {t.analyzing}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedAsset(null);
                          setAudioUrl(null);
                          setSubtitleMode("none");
                          setSyncedLyrics(null);
                          setAudioAnalysis(null);
                          setAnalyzingAudio(false);
                        }}
                      >
                        {language === "ko" ? "변경" : "Change"}
                      </Button>
                    </div>
                  </div>

                  {/* Audio Preview Player */}
                  {audioUrl && (
                    <div className="p-3 bg-background rounded-lg space-y-3">
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        preload="auto"
                        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                        onLoadedMetadata={() => {
                          setDuration(audioRef.current?.duration || 0);
                          setAudioLoaded(true);
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                      />

                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={togglePlayPause}
                          disabled={!audioLoaded || loadingAudioUrl}
                        >
                          {loadingAudioUrl ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="text-xs font-mono w-20">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                        <Slider
                          value={[currentTime]}
                          max={duration || 100}
                          step={0.1}
                          onValueChange={(v) => {
                            if (audioRef.current) audioRef.current.currentTime = v[0];
                          }}
                          disabled={!audioLoaded}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* Audio Settings */}
                  <div className="space-y-4">
                    {/* Video Duration Selection */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {t.videoDuration}
                          {sourceVideoDuration && (
                            <span className="text-xs text-muted-foreground">
                              ({language === "ko" ? "원본" : "source"}: {sourceVideoDuration}s)
                            </span>
                          )}
                        </span>
                        <span className="font-mono">{videoDuration}s</span>
                      </div>
                      <Slider
                        value={[videoDuration]}
                        min={5}
                        max={sourceVideoDuration ? Math.min(30, sourceVideoDuration) : 30}
                        step={1}
                        onValueChange={(v) => {
                          const newDuration = v[0];
                          setVideoDuration(newDuration);
                          // Adjust start time if it would cause region to exceed audio
                          const maxStart = Math.max(0, duration - newDuration);
                          if (audioStartTime > maxStart) {
                            setAudioStartTime(maxStart);
                          }
                        }}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>5s</span>
                        <span>{sourceVideoDuration ? Math.round((sourceVideoDuration + 5) / 2) : 15}s</span>
                        <span>{sourceVideoDuration ? Math.min(30, sourceVideoDuration) : 30}s</span>
                      </div>
                    </div>

                    {/* Audio Playback Region - Visual Timeline */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span>{t.playbackRegion}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">
                            {formatTime(audioStartTime)} - {formatTime(audioStartTime + videoDuration)}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={isPlayingSegment ? () => audioRef.current?.pause() : playSelectedSegment}
                                disabled={!audioLoaded || loadingAudioUrl}
                              >
                                {isPlayingSegment ? (
                                  <Pause className="h-3.5 w-3.5" />
                                ) : (
                                  <Play className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>{t.previewSegment}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Visual Timeline Bar */}
                      {duration > 0 && (
                        <div className="relative h-10 bg-muted rounded-lg overflow-hidden">
                          {/* Full audio duration background */}
                          <div className="absolute inset-0 flex items-center px-2">
                            <div className="w-full h-1 bg-muted-foreground/20 rounded-full" />
                          </div>

                          {/* Selected playback region */}
                          <div
                            className="absolute top-1 bottom-1 bg-primary/10 border-2 border-primary rounded transition-all duration-150"
                            style={{
                              left: `${(audioStartTime / duration) * 100}%`,
                              width: `${Math.min((videoDuration / duration) * 100, 100 - (audioStartTime / duration) * 100)}%`,
                            }}
                          >
                            {/* Start handle */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-6 bg-primary rounded-sm" />
                          </div>

                          {/* Time markers */}
                          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] text-muted-foreground">
                            <span>0:00</span>
                            <span>{formatTime(duration / 2)}</span>
                            <span>{formatTime(duration)}</span>
                          </div>
                        </div>
                      )}

                      {/* Start Time Slider */}
                      <Slider
                        value={[audioStartTime]}
                        max={Math.max(0, duration - videoDuration)}
                        step={0.5}
                        onValueChange={(v) => {
                          const maxStart = Math.max(0, duration - videoDuration);
                          setAudioStartTime(Math.min(v[0], maxStart));
                        }}
                        disabled={!audioLoaded}
                      />

                      {/* Warning if playback region exceeds audio */}
                      {audioStartTime + videoDuration > duration && duration > 0 && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {t.regionWarning}
                        </p>
                      )}
                    </div>

                    {/* AI Recommendation */}
                    {audioAnalysis && (
                      <AudioAIRecommendation
                        audioAnalysis={audioAnalysis}
                        audioStartTime={audioStartTime}
                        videoDuration={videoDuration}
                        analyzingAudio={analyzingAudio}
                        isPlayingSegment={isPlayingSegment}
                        audioLoaded={audioLoaded}
                        onUseSuggested={() => setAudioStartTime(audioAnalysis.suggestedStartTime)}
                        onReAnalyze={handleReAnalyzeAudio}
                        onPlaySegment={isPlayingSegment ? () => audioRef.current?.pause() : playSelectedSegment}
                      />
                    )}

                    {/* Volume */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{t.volume}</span>
                        <span className="font-mono">{Math.round(audioVolume * 100)}%</span>
                      </div>
                      <Slider
                        value={[audioVolume]}
                        max={2}
                        step={0.1}
                        onValueChange={(v) => setAudioVolume(v[0])}
                      />
                    </div>

                    {/* Advanced Settings Toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      {t.advancedSettings}
                      {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>

                    {showAdvanced && (
                      <div className="space-y-4 pl-2 pt-2 border-l-2 border-border">
                        {/* Fade In */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{t.fadeIn}</span>
                            <span className="font-mono">{fadeIn.toFixed(1)}{t.seconds}</span>
                          </div>
                          <Slider
                            value={[fadeIn]}
                            max={5}
                            step={0.5}
                            onValueChange={(v) => setFadeIn(v[0])}
                          />
                        </div>

                        {/* Fade Out */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{t.fadeOut}</span>
                            <span className="font-mono">{fadeOut.toFixed(1)}{t.seconds}</span>
                          </div>
                          <Slider
                            value={[fadeOut]}
                            max={5}
                            step={0.5}
                            onValueChange={(v) => setFadeOut(v[0])}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ===== SUBTITLE SECTION ===== */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Subtitles className="h-4 w-4" />
                {t.subtitleSection}
              </h3>

              {/* Subtitle Mode Selection */}
              <div className="space-y-2">
                {/* No Subtitles Option */}
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    subtitleMode === "none"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="subtitleMode"
                    value="none"
                    checked={subtitleMode === "none"}
                    onChange={() => setSubtitleMode("none")}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{t.subtitleModeNone}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.subtitleModeNoneDesc}</p>
                  </div>
                </label>

                {/* Lyrics Subtitles Option - only show if audio has lyrics */}
                {selectedAudioLyrics && (
                  <label
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      subtitleMode === "lyrics"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="subtitleMode"
                      value="lyrics"
                      checked={subtitleMode === "lyrics"}
                      onChange={() => setSubtitleMode("lyrics")}
                      className="mt-0.5 h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.subtitleModeLyrics}</span>
                        <Badge variant="outline" className="text-xs">
                          {selectedAudioLyrics.segments.length} {language === "ko" ? "개" : "segments"}
                        </Badge>
                        {selectedAudioLyrics.language && (
                          <Badge variant="outline" className="text-xs uppercase">
                            {selectedAudioLyrics.language}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.subtitleModeLyricsDesc}</p>
                    </div>
                  </label>
                )}

                {/* Manual Input Option */}
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    subtitleMode === "manual"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="subtitleMode"
                    value="manual"
                    checked={subtitleMode === "manual"}
                    onChange={() => setSubtitleMode("manual")}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{t.subtitleModeManual}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.subtitleModeManualDesc}</p>
                  </div>
                </label>
              </div>

              {/* Lyrics Preview (when lyrics mode selected) */}
              {subtitleMode === "lyrics" && syncedLyrics && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/50 flex items-center justify-between">
                    <span className="text-sm font-medium">{t.lyricsPreview}</span>
                    <Badge variant="outline" className="text-xs">
                      {syncedLyrics.segments.filter(
                        (seg) => seg.start >= audioStartTime && seg.start < audioStartTime + videoDuration
                      ).length} / {syncedLyrics.segments.length} {t.visible}
                    </Badge>
                  </div>
                  <ScrollArea className="h-[160px] p-3">
                    <div className="space-y-1">
                      {syncedLyrics.segments.map((segment, idx) => {
                        const segmentInRange =
                          segment.start >= audioStartTime &&
                          segment.start < audioStartTime + videoDuration;

                        return (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-start gap-3 p-2 rounded text-sm transition-colors",
                              segmentInRange
                                ? "bg-primary/10 border border-primary/20"
                                : "bg-muted/30 opacity-50"
                            )}
                          >
                            <div className="flex-shrink-0 w-20 text-xs text-muted-foreground font-mono pt-0.5">
                              {formatTime(segment.start)} - {formatTime(segment.end)}
                            </div>
                            <div
                              className={cn(
                                "flex-1 leading-relaxed",
                                segmentInRange ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {segment.text}
                            </div>
                            {segmentInRange && (
                              <Badge
                                variant="outline"
                                className="flex-shrink-0 text-xs bg-background"
                              >
                                {t.visible}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Manual Input Section */}
              {subtitleMode === "manual" && (
                <div className="space-y-4">
                  {/* Extract Button (if audio selected) */}
                  {selectedAsset && (
                    <div className="flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExtractLyrics}
                        disabled={syncing}
                      >
                        {syncing ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {t.extracting}
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-3 w-3 mr-1" />
                            {t.extractLyrics}
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Lyrics Input */}
                  <Textarea
                    placeholder={t.lyricsPlaceholder}
                    value={lyricsText}
                    onChange={(e) => {
                      setLyricsText(e.target.value);
                      setSyncedLyrics(null);
                    }}
                    className="min-h-[100px] resize-none font-mono text-sm"
                  />

                  {/* Language & Sync */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">{t.languageLabel}</Label>
                      <Select
                        value={languageHint}
                        onValueChange={(v) => setLanguageHint(v as typeof languageHint)}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">{t.auto}</SelectItem>
                          <SelectItem value="ko">{t.korean}</SelectItem>
                          <SelectItem value="en">{t.english}</SelectItem>
                          <SelectItem value="ja">{t.japanese}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleSyncLyrics}
                      disabled={syncing || !lyricsText.trim() || !selectedAsset}
                      size="sm"
                      className="ml-auto"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.syncing}
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 mr-2" />
                          {t.syncButton}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Sync Result */}
                  {syncedLyrics && syncedLyrics.segments.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          {t.syncResult}
                        </Label>
                        <Badge variant="outline">
                          {syncedLyrics.segments.length}{t.segments}
                        </Badge>
                      </div>
                      <ScrollArea className="h-32 border rounded-lg">
                        <div className="p-2 space-y-1 text-xs">
                          {syncedLyrics.segments.map((seg, idx) => (
                            <div key={idx} className="flex gap-2 text-muted-foreground">
                              <span className="font-mono w-20">
                                {formatTime(seg.start)}-{formatTime(seg.end)}
                              </span>
                              <span className="text-foreground">{seg.text}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}

              {/* Subtitle Style Settings (when subtitles enabled) */}
              {subtitleMode !== "none" && (
                <div className="space-y-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => setShowStyleSettings(!showStyleSettings)}
                  >
                    <span className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      {t.subtitleStyle}
                    </span>
                    {showStyleSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>

                  {showStyleSettings && (
                    <div className="space-y-4 p-3 border border-border rounded-lg bg-muted/30">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Font Size */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t.fontSize}</Label>
                          <Select
                            value={subtitleStyle.font_size}
                            onValueChange={(v) => setSubtitleStyle({ ...subtitleStyle, font_size: v as SubtitleStyle["font_size"] })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">{t.small}</SelectItem>
                              <SelectItem value="medium">{t.medium}</SelectItem>
                              <SelectItem value="large">{t.large}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Font Style */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t.fontStyle}</Label>
                          <Select
                            value={subtitleStyle.font_style}
                            onValueChange={(v) => setSubtitleStyle({ ...subtitleStyle, font_style: v as SubtitleStyle["font_style"] })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bold">{t.bold}</SelectItem>
                              <SelectItem value="modern">{t.modern}</SelectItem>
                              <SelectItem value="minimal">{t.minimal}</SelectItem>
                              <SelectItem value="classic">{t.classic}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Animation */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t.animation}</Label>
                          <Select
                            value={subtitleStyle.animation}
                            onValueChange={(v) => setSubtitleStyle({ ...subtitleStyle, animation: v as SubtitleStyle["animation"] })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fade">{t.fade}</SelectItem>
                              <SelectItem value="typewriter">{t.typewriter}</SelectItem>
                              <SelectItem value="karaoke">{t.karaoke}</SelectItem>
                              <SelectItem value="slide_up">{t.slideUp}</SelectItem>
                              <SelectItem value="scale_pop">{t.scalePop}</SelectItem>
                              <SelectItem value="bounce">{t.bounce}</SelectItem>
                              <SelectItem value="glitch">{t.glitch}</SelectItem>
                              <SelectItem value="wave">{t.wave}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Position */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t.position}</Label>
                          <Select
                            value={subtitleStyle.position}
                            onValueChange={(v) => setSubtitleStyle({ ...subtitleStyle, position: v as SubtitleStyle["position"] })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="top">{t.top}</SelectItem>
                              <SelectItem value="center">{t.center}</SelectItem>
                              <SelectItem value="bottom">{t.bottom}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Color Pickers */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">{t.textColor}</Label>
                          <input
                            type="color"
                            value={subtitleStyle.color}
                            onChange={(e) => setSubtitleStyle({ ...subtitleStyle, color: e.target.value })}
                            className="h-6 w-8 rounded cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">{t.strokeColor}</Label>
                          <input
                            type="color"
                            value={subtitleStyle.stroke_color}
                            onChange={(e) => setSubtitleStyle({ ...subtitleStyle, stroke_color: e.target.value })}
                            className="h-6 w-8 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{t.success}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || success}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t.submitting}
              </>
            ) : (
              <>
                <Film className="h-4 w-4 mr-2" />
                {t.submit}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
