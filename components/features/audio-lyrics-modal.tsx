"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/campaigns-api";
import type { LyricsData } from "@/lib/subtitle-styles";

interface AudioLyricsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset | null;
  onSaved?: () => void;
}

export function AudioLyricsModal({
  open,
  onOpenChange,
  asset,
  onSaved,
}: AudioLyricsModalProps) {
  const { language } = useI18n();

  // Audio player refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // State
  const [lyricsText, setLyricsText] = useState("");
  const [languageHint, setLanguageHint] = useState<"ko" | "en" | "ja" | "auto">("auto");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<LyricsData | null>(null);
  const [saved, setSaved] = useState(false);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(-1);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  // Load existing lyrics when modal opens
  const loadExistingLyrics = useCallback(() => {
    if (!asset) return;

    console.log("[AudioLyricsModal] Loading existing lyrics for asset:", {
      id: asset.id,
      filename: asset.original_filename,
      s3_key: asset.s3_key,
      hasMetadata: !!asset.metadata,
    });

    const metadata = asset.metadata as Record<string, unknown> | null;
    const existingLyrics = metadata?.lyrics as LyricsData | undefined;

    console.log("[AudioLyricsModal] Existing lyrics:", {
      hasLyrics: !!existingLyrics,
      segmentsCount: existingLyrics?.segments?.length || 0,
      fullTextLength: existingLyrics?.fullText?.length || 0,
    });

    if (existingLyrics) {
      setLyricsText(existingLyrics.fullText || "");
      setSyncedLyrics(existingLyrics);
      if (existingLyrics.language && existingLyrics.language !== "mixed") {
        setLanguageHint(existingLyrics.language);
      }
    } else {
      setLyricsText("");
      setSyncedLyrics(null);
    }
    setError(null);
    setSaved(false);
  }, [asset]);

  // Fetch fresh presigned URL for audio playback
  const fetchAudioUrl = useCallback(async () => {
    if (!asset?.s3_key && !asset?.s3_url) {
      console.error("[AudioLyricsModal] No s3_key or s3_url available", { asset });
      setAudioError(
        language === "ko"
          ? "오디오 파일 정보가 없습니다"
          : "No audio file information available"
      );
      return;
    }

    setLoadingUrl(true);
    setAudioError(null);

    try {
      // Prefer s3_key directly when available, fallback to extracting from URL
      const params = asset.s3_key
        ? `key=${encodeURIComponent(asset.s3_key)}`
        : `url=${encodeURIComponent(asset.s3_url)}`;

      console.log("[AudioLyricsModal] Fetching presigned URL with params:", params);
      const response = await fetch(`/api/v1/assets/presign?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[AudioLyricsModal] Presign API error:", response.status, errorData);
        throw new Error(errorData.error || `Failed to get audio URL (${response.status})`);
      }

      const data = await response.json();
      console.log("[AudioLyricsModal] Got presigned URL:", data.presignedUrl?.substring(0, 100) + "...");
      setAudioUrl(data.presignedUrl);
    } catch (err) {
      console.error("[AudioLyricsModal] Failed to get presigned URL:", err);
      setAudioError(
        language === "ko"
          ? "오디오 URL을 가져올 수 없습니다"
          : "Failed to get audio URL"
      );
    } finally {
      setLoadingUrl(false);
    }
  }, [asset?.s3_key, asset?.s3_url, language]);

  // Initialize modal when it opens (useEffect to handle controlled open prop)
  // IMPORTANT: Only depend on open and asset?.id to prevent infinite re-runs
  // when callback functions are recreated due to asset object reference changes
  useEffect(() => {
    console.log("[AudioLyricsModal] useEffect triggered - open:", open, "asset:", asset?.id);

    if (open && asset) {
      console.log("[AudioLyricsModal] Modal opened, initializing...");
      // Reset audio state
      setAudioLoaded(false);
      setAudioError(null);
      setAudioUrl(null);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      // Load existing lyrics and fetch audio URL
      loadExistingLyrics();
      fetchAudioUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset?.id]);

  // Handle modal close (initialization is handled by useEffect)
  const handleOpenChange = (newOpen: boolean) => {
    console.log("[AudioLyricsModal] handleOpenChange called:", newOpen);
    if (!newOpen) {
      // Stop audio when closing
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
    onOpenChange(newOpen);
  };

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
      // Ignore AbortError when play is interrupted
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Playback error:", err);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setAudioLoaded(true);
    setAudioError(null);
  };

  const handleAudioError = () => {
    setAudioLoaded(false);
    setAudioError(language === "ko" ? "오디오를 로드할 수 없습니다" : "Failed to load audio");
  };

  const handleCanPlay = () => {
    setAudioLoaded(true);
    setAudioError(null);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 1;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const seekToSegment = async (startTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = startTime;
    setCurrentTime(startTime);

    if (!isPlaying) {
      try {
        await audioRef.current.play();
      } catch (err) {
        // Ignore AbortError when play is interrupted
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Playback error:", err);
        }
      }
    }
  };

  const skipSeconds = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Find current segment based on playback time
  useEffect(() => {
    if (!syncedLyrics?.segments.length) {
      setCurrentSegmentIndex(-1);
      return;
    }

    const index = syncedLyrics.segments.findIndex(
      (segment) => currentTime >= segment.start && currentTime < segment.end
    );
    setCurrentSegmentIndex(index);
  }, [currentTime, syncedLyrics]);

  // Auto-scroll to current segment
  useEffect(() => {
    if (currentSegmentIndex < 0 || !scrollAreaRef.current) return;

    const segmentElement = scrollAreaRef.current.querySelector(
      `[data-segment-index="${currentSegmentIndex}"]`
    );
    if (segmentElement) {
      segmentElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSegmentIndex]);

  // Sync lyrics with audio
  const handleSync = async () => {
    if (!asset || !lyricsText.trim()) {
      setError(language === "ko" ? "가사를 입력해주세요" : "Please enter lyrics");
      return;
    }

    // Get fresh token from store
    const currentToken = useAuthStore.getState().accessToken;
    console.log("[AudioLyricsModal] handleSync - token check:", {
      hasToken: !!currentToken,
      tokenLength: currentToken?.length,
    });

    if (!currentToken) {
      setError(language === "ko" ? "로그인이 필요합니다. 페이지를 새로고침해주세요." : "Please log in. Try refreshing the page.");
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      // Use api client for the request (it handles token and refresh automatically)
      const response = await api.post<{ lyrics: LyricsData; cached: boolean }>("/api/v1/audio/lyrics", {
        assetId: asset.id,
        lyrics: lyricsText.trim(),
        languageHint,
        forceReExtract: true,
      });

      if (response.error) {
        throw new Error(response.error.message || "Sync failed");
      }

      if (response.data?.lyrics) {
        setSyncedLyrics(response.data.lyrics);
        setSaved(true);
        // Notify parent
        onSaved?.();
      } else {
        throw new Error("No lyrics data returned");
      }
    } catch (err) {
      console.error("Sync error:", err);
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  // Translations
  const t = {
    title: language === "ko" ? "가사 자막 편집" : "Edit Lyrics Subtitles",
    description: language === "ko"
      ? "가사를 입력하고 싱크를 맞춰보세요"
      : "Enter lyrics and sync with audio",
    audioFile: language === "ko" ? "음원 파일" : "Audio File",
    lyricsInput: language === "ko" ? "가사 입력" : "Enter Lyrics",
    lyricsPlaceholder: language === "ko"
      ? "가사를 줄바꿈으로 구분하여 입력하세요...\n\n예시:\n첫 번째 줄\n두 번째 줄\n..."
      : "Enter lyrics separated by line breaks...\n\nExample:\nFirst line\nSecond line\n...",
    language: language === "ko" ? "언어" : "Language",
    auto: language === "ko" ? "자동 감지" : "Auto Detect",
    korean: language === "ko" ? "한국어" : "Korean",
    english: language === "ko" ? "영어" : "English",
    japanese: language === "ko" ? "일본어" : "Japanese",
    syncButton: language === "ko" ? "싱크 맞추기" : "Sync Lyrics",
    syncing: language === "ko" ? "싱크 맞추는 중..." : "Syncing...",
    syncResult: language === "ko" ? "싱크 결과" : "Sync Result",
    segments: language === "ko" ? "개 구간" : " segments",
    confidence: language === "ko" ? "정확도" : "Confidence",
    saved: language === "ko" ? "저장됨" : "Saved",
    close: language === "ko" ? "닫기" : "Close",
    noLyrics: language === "ko" ? "가사를 입력하고 싱크 맞추기를 눌러주세요" : "Enter lyrics and click sync",
    audioPlayer: language === "ko" ? "오디오 플레이어" : "Audio Player",
    clickToSeek: language === "ko" ? "클릭하여 해당 구간으로 이동" : "Click to seek to this segment",
    nowPlaying: language === "ko" ? "재생 중" : "Now Playing",
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Hidden Audio Element */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="auto"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onCanPlay={handleCanPlay}
              onError={handleAudioError}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          )}

          {/* Audio Player */}
          <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-neutral-500">{t.audioFile}</Label>
                <p className="font-medium text-neutral-900 truncate">
                  {asset.original_filename}
                </p>
              </div>
              {isPlaying && (
                <Badge className="bg-green-500 animate-pulse ml-2">
                  <Music className="h-3 w-3 mr-1" />
                  {t.nowPlaying}
                </Badge>
              )}
            </div>

            {/* Loading URL State */}
            {loadingUrl && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-600 rounded text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {language === "ko" ? "오디오 URL 로딩 중..." : "Loading audio URL..."}
              </div>
            )}

            {/* Audio Error */}
            {audioError && !loadingUrl && (
              <div className="flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded text-sm">
                <AlertCircle className="h-4 w-4" />
                {audioError}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-red-600 hover:text-red-700"
                  onClick={fetchAudioUrl}
                >
                  {language === "ko" ? "재시도" : "Retry"}
                </Button>
              </div>
            )}

            {/* Player Controls */}
            <div className="flex items-center gap-3">
              {/* Skip Back */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => skipSeconds(-5)}
                disabled={!audioLoaded || loadingUrl}
                title="-5s"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              {/* Play/Pause */}
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={togglePlayPause}
                disabled={!audioLoaded || loadingUrl}
              >
                {loadingUrl || !audioLoaded ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>

              {/* Skip Forward */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => skipSeconds(5)}
                disabled={!audioLoaded || loadingUrl}
                title="+5s"
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              {/* Time Display */}
              <span className="text-xs font-mono text-neutral-600 w-24 text-center">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Seek Slider */}
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                disabled={!audioLoaded || loadingUrl}
                className="flex-1"
              />

              {/* Volume */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>
          </div>

          {/* Lyrics Input */}
          <div className="space-y-2">
            <Label htmlFor="lyrics-input">{t.lyricsInput}</Label>
            <Textarea
              id="lyrics-input"
              placeholder={t.lyricsPlaceholder}
              value={lyricsText}
              onChange={(e) => {
                setLyricsText(e.target.value);
                setSaved(false);
              }}
              className="min-h-[150px] resize-none font-mono text-sm"
            />
          </div>

          {/* Language Selection */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>{t.language}</Label>
              <Select
                value={languageHint}
                onValueChange={(v) => setLanguageHint(v as typeof languageHint)}
              >
                <SelectTrigger className="w-32">
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

            {/* Sync Button */}
            <Button
              onClick={handleSync}
              disabled={syncing || !lyricsText.trim()}
              className="ml-auto"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.syncing}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  {t.syncButton}
                </>
              )}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Sync Result */}
          {syncedLyrics && syncedLyrics.segments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t.syncResult}
                </Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {syncedLyrics.segments.length}{t.segments}
                  </Badge>
                  {syncedLyrics.confidence && (
                    <Badge variant="outline">
                      {t.confidence}: {Math.round(syncedLyrics.confidence * 100)}%
                    </Badge>
                  )}
                  {saved && (
                    <Badge className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      {t.saved}
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[200px] border border-neutral-200 rounded-lg">
                <div ref={scrollAreaRef} className="p-2 space-y-1">
                  {syncedLyrics.segments.map((segment, idx) => {
                    const isCurrentSegment = idx === currentSegmentIndex;
                    const isPastSegment = currentSegmentIndex >= 0 && idx < currentSegmentIndex;

                    return (
                      <div
                        key={idx}
                        data-segment-index={idx}
                        onClick={() => seekToSegment(segment.start)}
                        className={cn(
                          "flex items-start gap-3 p-2 rounded text-sm cursor-pointer transition-all duration-200",
                          isCurrentSegment
                            ? "bg-primary/10 border-l-4 border-primary shadow-sm"
                            : isPastSegment
                            ? "bg-neutral-100/50 text-neutral-400"
                            : "hover:bg-neutral-50"
                        )}
                        title={t.clickToSeek}
                      >
                        <div className={cn(
                          "flex-shrink-0 w-24 font-mono text-xs pt-0.5",
                          isCurrentSegment ? "text-primary font-semibold" : "text-neutral-500"
                        )}>
                          {formatTime(segment.start)} - {formatTime(segment.end)}
                        </div>
                        <div className={cn(
                          "flex-1",
                          isCurrentSegment ? "text-primary font-medium" : "text-neutral-900"
                        )}>
                          {segment.text}
                        </div>
                        {isCurrentSegment && (
                          <div className="flex-shrink-0">
                            <Music className="h-4 w-4 text-primary animate-pulse" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty State */}
          {!syncedLyrics && !syncing && (
            <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
              <Clock className="h-8 w-8 mb-2" />
              <p className="text-sm">{t.noLyrics}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
