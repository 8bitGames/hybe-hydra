"use client";

import { useI18n } from "@/lib/i18n";
import { useAssets } from "@/lib/queries";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Music,
  Check,
  Play,
  Pause,
  Timer,
  Gauge,
  Sparkles,
  Zap,
  SkipForward,
  Volume2,
  VolumeX,
  HelpCircle,
  Upload,
  Loader2,
  Subtitles,
  ChevronDown,
  ChevronUp,
  Shuffle,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  ScriptGenerationResponse,
  AudioMatch,
  AudioAnalysisResponse,
} from "@/lib/fast-cut-api";
import type { LyricsData } from "@/lib/subtitle-styles";
import type { SubtitleMode } from "@/lib/stores/fast-cut-context";
import { AudioAIRecommendation } from "@/components/features/audio/AudioAIRecommendation";

interface FastCutMusicStepProps {
  scriptData: ScriptGenerationResponse | null;
  audioMatches: AudioMatch[];
  selectedAudio: AudioMatch | null;
  audioStartTime: number;
  videoDuration: number;
  audioAnalysis: AudioAnalysisResponse | null;
  matchingMusic: boolean;
  analyzingAudio: boolean;
  campaignId: string;
  musicSkipped: boolean;
  subtitleMode: SubtitleMode;
  noCampaignForMusic?: boolean;  // True when no campaign is available for music search
  onSelectAudio: (audio: AudioMatch) => void;
  onSetAudioStartTime: (time: number) => void;
  onSetVideoDuration: (duration: number) => void;
  onSkipMusic: () => void;
  onUnskipMusic: () => void;
  onSetSubtitleMode: (mode: SubtitleMode) => void;
  onSetAudioLyricsText: (text: string | null) => void;
  onReAnalyze?: () => void;  // Re-analyze to get different segment
  onNext?: () => void;
}

export function FastCutMusicStep({
  scriptData,
  audioMatches,
  selectedAudio,
  audioStartTime,
  videoDuration,
  audioAnalysis,
  matchingMusic,
  analyzingAudio,
  campaignId,
  musicSkipped,
  subtitleMode,
  noCampaignForMusic = false,
  onSelectAudio,
  onSetAudioStartTime,
  onSetVideoDuration,
  onSkipMusic,
  onUnskipMusic,
  onSetSubtitleMode,
  onSetAudioLyricsText,
  onReAnalyze,
  onNext,
}: FastCutMusicStepProps) {
  const { language, translate } = useI18n();

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [loadingAudioUrl, setLoadingAudioUrl] = useState(false);
  const [isPlayingSegment, setIsPlayingSegment] = useState(false);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    // Get the latest token from store (not from hook to avoid stale closure)
    let authState = useAuthStore.getState();
    let accessToken = authState.accessToken;
    const hasHydrated = authState._hasHydrated;

    // Wait for auth store to hydrate if it hasn't yet
    if (!hasHydrated) {
      console.log('[FastCut Upload] Auth store not hydrated yet, waiting...');
      // Wait a bit for hydration to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      // Retry getting the token after waiting
      authState = useAuthStore.getState();
      accessToken = authState.accessToken;

      if (!authState._hasHydrated || !accessToken) {
        setUploadError(language === 'ko'
          ? '로그인 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
          : 'Loading authentication. Please try again in a moment.');
        return;
      }
    }

    // Check authentication first
    if (!accessToken) {
      console.error('[FastCut Upload] No access token found in auth store');
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

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg'];
    if (!validTypes.includes(file.type)) {
      setUploadError(language === 'ko'
        ? '지원하는 형식: MP3, WAV, FLAC, OGG'
        : 'Supported formats: MP3, WAV, FLAC, OGG');
      return;
    }

    // Validate file size (500MB max)
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

      console.log('[FastCut Upload] Uploading file:', {
        name: file.name,
        type: file.type,
        size: file.size,
        campaignId,
        hasToken: !!accessToken,
        tokenPreview: accessToken?.slice(0, 20) + '...',
      });

      const response = await fetch(`/api/v1/campaigns/${campaignId}/assets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      console.log('[FastCut Upload] Response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });

      if (!response.ok) {
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.detail || 'Upload failed');
        } else {
          // Handle non-JSON response (e.g., plain text "Forbidden")
          const text = await response.text();
          console.error('[FastCut Upload] Non-JSON error response:', text);

          // Check for common Vercel errors
          if (response.status === 413 || text.includes('too large') || text.includes('size')) {
            throw new Error(language === 'ko'
              ? '파일이 너무 큽니다. 50MB 이하의 파일을 업로드해주세요.'
              : 'File is too large. Please upload a file under 50MB.');
          }
          if (response.status === 403 || text.toLowerCase().includes('forbidden')) {
            throw new Error(language === 'ko'
              ? '업로드 권한이 없습니다. 페이지를 새로고침하고 다시 시도해주세요.'
              : 'Upload not authorized. Please refresh the page and try again.');
          }
          throw new Error(text || `Upload failed with status ${response.status}`);
        }
      }

      const data = await response.json();

      // Convert to AudioMatch format and select it
      const uploadedAudio: AudioMatch = {
        id: data.id,
        filename: file.name,
        s3Url: data.s3_url,
        bpm: data.metadata?.bpm || null,
        vibe: null,
        genre: null,
        duration: data.metadata?.duration || 60,
        energy: 0.5,
        matchScore: 100, // User uploaded = perfect match
      };

      onSelectAudio(uploadedAudio);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [campaignId, language, onSelectAudio]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFileUpload]);

  // Handle drag and drop
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

  // Fetch presigned URL for selected audio
  const fetchAudioUrl = useCallback(async (audioId: string) => {
    setLoadingAudioUrl(true);
    setAudioLoaded(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    try {
      const authState = useAuthStore.getState();
      const accessToken = authState.accessToken;

      if (!accessToken || !campaignId) {
        console.error('[FastCut Audio] No token or campaignId for audio URL');
        return;
      }

      const response = await fetch(
        `/api/v1/campaigns/${campaignId}/assets/presign?asset_id=${audioId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error("Failed to get audio URL");

      const data = await response.json();
      setAudioUrl(data.presignedUrl);
    } catch (err) {
      console.error("Failed to get presigned URL:", err);
      setAudioUrl(null);
    } finally {
      setLoadingAudioUrl(false);
    }
  }, [campaignId]);

  // Fetch audio URL when audio is selected
  useEffect(() => {
    if (selectedAudio?.id) {
      fetchAudioUrl(selectedAudio.id);
    } else {
      setAudioUrl(null);
      setAudioLoaded(false);
    }
  }, [selectedAudio?.id, fetchAudioUrl]);

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
      audioRef.current.pause();
      audioRef.current.currentTime = audioStartTime;
      setIsPlayingSegment(true);
      await audioRef.current.play();
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Segment playback error:", err);
      }
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
  }, [isPlayingSegment, currentTime, audioStartTime, videoDuration]);

  // Helper for tooltip icon
  const TooltipIcon = ({ tooltipKey }: { tooltipKey: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 cursor-help ml-1.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        <p className="text-xs">{translate(tooltipKey)}</p>
      </TooltipContent>
    </Tooltip>
  );

  // Fetch all campaign audio assets for reference
  const { data: audioAssetsData } = useAssets(campaignId, {
    type: "audio",
    page_size: 100,
  });

  const campaignAudioAssets = useMemo(() => {
    return audioAssetsData?.items || [];
  }, [audioAssetsData]);

  // Get lyrics data from selected audio asset's metadata
  const selectedAudioLyrics = useMemo((): LyricsData | null => {
    if (!selectedAudio) {
      return null;
    }

    // Find the full asset from campaign assets
    const fullAsset = campaignAudioAssets.find(
      (asset) => asset.id === selectedAudio.id
    );

    if (!fullAsset?.metadata) {
      console.log("[FastCutMusicStep] ⚠️ No metadata for selected audio:", {
        audioId: selectedAudio.id,
        hasFullAsset: !!fullAsset,
        campaignAudioAssetsCount: campaignAudioAssets.length,
      });
      return null;
    }

    const metadata = fullAsset.metadata as Record<string, unknown>;
    const lyrics = metadata.lyrics as LyricsData | undefined;

    // Validate lyrics structure
    if (lyrics && Array.isArray(lyrics.segments) && lyrics.segments.length > 0) {
      console.log("[FastCutMusicStep] ✅ Lyrics found in asset metadata:", {
        audioId: selectedAudio.id,
        segmentCount: lyrics.segments.length,
        language: lyrics.language,
      });
      return lyrics;
    }

    console.log("[FastCutMusicStep] ⚠️ No lyrics segments in metadata:", {
      audioId: selectedAudio.id,
      hasLyricsObject: !!lyrics,
      segmentCount: lyrics?.segments?.length ?? 0,
      metadataKeys: Object.keys(metadata),
    });

    return null;
  }, [selectedAudio, campaignAudioAssets]);

  // Update lyrics text in context when lyrics are available
  useEffect(() => {
    if (selectedAudioLyrics && selectedAudioLyrics.segments.length > 0) {
      // Format lyrics as text for display in Content Summary
      const lyricsText = selectedAudioLyrics.segments
        .map((segment) => segment.text)
        .join("\n");
      console.log("[FastCutMusicStep] 🎤 Setting lyrics text:", {
        segmentCount: selectedAudioLyrics.segments.length,
        textLength: lyricsText.length,
        preview: lyricsText.substring(0, 100),
      });
      onSetAudioLyricsText(lyricsText);
    } else {
      onSetAudioLyricsText(null);
    }
  }, [selectedAudioLyrics, onSetAudioLyricsText]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get match score color
  const getMatchScoreColor = (score: number): string => {
    if (score >= 80) return "bg-neutral-900 text-white";
    if (score >= 60) return "bg-neutral-200 text-neutral-700";
    return "bg-neutral-100 text-neutral-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-1">
            {language === "ko" ? "음악 매칭" : "Music Matching"}
          </h2>
          <p className="text-sm text-neutral-500">
            {language === "ko"
              ? "스크립트의 분위기와 BPM에 맞는 음악을 선택하세요"
              : "Select music that matches your script's vibe and BPM"}
          </p>
        </div>

        {/* Skip Music Button */}
        {!musicSkipped && !selectedAudio && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={onSkipMusic}
                className="border-neutral-300 text-neutral-600 hover:bg-neutral-100"
              >
                <SkipForward className="h-4 w-4 mr-1" />
                {language === "ko" ? "건너뛰기" : "Skip"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px]">
              <p className="text-xs">{translate("fastCut.tooltips.music.skipMusic")}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/flac,audio/ogg,.mp3,.wav,.flac,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Script Info Summary */}
      {scriptData && (
        <div className="flex items-center gap-4 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-neutral-300">
              <Sparkles className="h-3 w-3 mr-1" />
              {scriptData.vibe}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-neutral-300">
              <Gauge className="h-3 w-3 mr-1" />
              {scriptData.suggestedBpmRange.min}-{scriptData.suggestedBpmRange.max} BPM
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-neutral-300">
              <Timer className="h-3 w-3 mr-1" />
              {scriptData.script.totalDuration}s
            </Badge>
          </div>
        </div>
      )}

      {/* Upload Section - Always visible when not skipped */}
      {!musicSkipped && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 transition-colors",
            uploading ? "border-neutral-400 bg-neutral-100" : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50",
            "cursor-pointer"
          )}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <div className="flex items-center justify-center gap-3">
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 text-neutral-500 animate-spin" />
                <span className="text-sm text-neutral-600">
                  {language === "ko" ? "업로드 중..." : "Uploading..."}
                </span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 text-neutral-500" />
                <span className="text-sm text-neutral-600">
                  {language === "ko"
                    ? "음원 파일을 드래그하거나 클릭하여 업로드"
                    : "Drag and drop or click to upload audio"}
                </span>
                <span className="text-xs text-neutral-400">
                  (MP3, WAV, FLAC, OGG)
                </span>
              </>
            )}
          </div>
          {uploadError && (
            <p className="text-xs text-red-500 text-center mt-2">{uploadError}</p>
          )}
        </div>
      )}

      {/* Music Skipped State */}
      {musicSkipped && (
        <div className="flex flex-col items-center justify-center h-48 bg-neutral-50 rounded-lg border border-neutral-200">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <VolumeX className="h-8 w-8 text-neutral-400" />
          </div>
          <p className="text-neutral-600 font-medium mb-1">
            {language === "ko" ? "음악 없이 진행" : "Proceeding without music"}
          </p>
          <p className="text-sm text-neutral-400 mb-4">
            {language === "ko"
              ? "영상이 음원 없이 생성됩니다"
              : "Video will be generated without background music"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onUnskipMusic}
            className="text-xs border-neutral-300"
          >
            <Volume2 className="h-3 w-3 mr-1" />
            {language === "ko" ? "음악 다시 선택" : "Select Music"}
          </Button>
        </div>
      )}

      {/* Loading State */}
      {!musicSkipped && matchingMusic && (
        <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
          <Music className="h-12 w-12 mb-3 animate-pulse" />
          <p>{language === "ko" ? "음악 매칭 중..." : "Matching music..."}</p>
        </div>
      )}

      {/* Music Matches */}
      {!musicSkipped && !matchingMusic && audioMatches.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-neutral-700 flex items-center">
            {language === "ko" ? "추천 음악" : "Recommended Music"} ({audioMatches.length})
            <TooltipIcon tooltipKey="fastCut.tooltips.music.selectMusic" />
          </Label>
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {audioMatches.map((audio) => {
                const isSelected = selectedAudio?.id === audio.id;
                return (
                  <div
                    key={audio.id}
                    onClick={() => onSelectAudio(audio)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    )}
                  >
                    {/* Play/Selection Icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {isSelected ? <Check className="h-5 w-5" /> : <Music className="h-5 w-5" />}
                    </div>

                    {/* Audio Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 truncate">
                        {audio.filename}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {audio.bpm && (
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <Gauge className="h-3 w-3" />
                            {audio.bpm} BPM
                          </span>
                        )}
                        {audio.vibe && (
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {audio.vibe}
                          </span>
                        )}
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {formatDuration(audio.duration)}
                        </span>
                      </div>
                    </div>

                    {/* Match Score */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          className={cn(
                            "shrink-0 cursor-help",
                            getMatchScoreColor(audio.matchScore)
                          )}
                        >
                          {Math.round(audio.matchScore)}% match
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[240px]">
                        <p className="text-xs">{translate("fastCut.tooltips.music.matchScore")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* No Matches */}
      {!musicSkipped && !matchingMusic && audioMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-neutral-400 bg-neutral-50 rounded-lg">
          <Music className="h-12 w-12 mb-3 text-neutral-300" />
          <p className="text-sm mb-3">
            {noCampaignForMusic
              ? (language === "ko" ? "캠페인이 선택되지 않았습니다" : "No campaign selected")
              : (language === "ko" ? "매칭된 음악이 없습니다" : "No matching music found")}
          </p>
          <p className="text-xs text-neutral-400">
            {noCampaignForMusic
              ? (language === "ko" ? "시작 페이지로 돌아가서 캠페인을 선택하거나 직접 음악을 업로드하세요" : "Go back to Start page to select a campaign, or upload music directly")
              : (language === "ko" ? "캠페인에 음악 에셋을 추가하세요" : "Add audio assets to your campaign")}
          </p>
        </div>
      )}

      {/* Selected Audio Controls */}
      {selectedAudio && (
        <div className="space-y-4 border border-neutral-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Music className="h-4 w-4" />
              {language === "ko" ? "선택된 음악" : "Selected Music"}
            </h3>
            {analyzingAudio && (
              <Badge variant="outline" className="text-xs border-neutral-300 animate-pulse">
                <Zap className="h-3 w-3 mr-1" />
                {language === "ko" ? "분석 중..." : "Analyzing..."}
              </Badge>
            )}
          </div>

          {/* Audio Preview with Playback Controls */}
          <div className="p-3 bg-neutral-50 rounded-lg space-y-3">
            <div>
              <p className="font-medium text-neutral-800 mb-1">{selectedAudio.filename}</p>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                {selectedAudio.bpm && <span>{selectedAudio.bpm} BPM</span>}
                {selectedAudio.vibe && <span>· {selectedAudio.vibe}</span>}
                <span>· {formatDuration(selectedAudio.duration)}</span>
              </div>
            </div>

            {/* Audio Element */}
            <audio
              ref={audioRef}
              src={audioUrl || undefined}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
                setAudioLoaded(true);
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setIsPlaying(false);
                setIsPlayingSegment(false);
              }}
              preload="metadata"
            />

            {/* Audio Player Controls */}
            {audioUrl && (
              <div className="space-y-2">
                {/* Progress Bar */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500 font-mono w-10">
                    {formatDuration(currentTime)}
                  </span>
                  <div className="flex-1 relative">
                    <Slider
                      value={[currentTime]}
                      onValueChange={(v) => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = v[0];
                          setCurrentTime(v[0]);
                        }
                      }}
                      min={0}
                      max={duration || selectedAudio.duration}
                      step={0.1}
                      className="w-full"
                      disabled={!audioLoaded}
                    />
                  </div>
                  <span className="text-xs text-neutral-500 font-mono w-10 text-right">
                    {formatDuration(duration || selectedAudio.duration)}
                  </span>
                </div>

                {/* Playback Buttons */}
                <div className="flex items-center gap-2">
                  {/* Play/Pause Full Audio */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePlayPause}
                    disabled={!audioLoaded || loadingAudioUrl}
                    className="flex-1"
                  >
                    {loadingAudioUrl ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        {language === "ko" ? "로딩..." : "Loading..."}
                      </>
                    ) : isPlaying ? (
                      <>
                        <Pause className="h-4 w-4 mr-1" />
                        {language === "ko" ? "일시정지" : "Pause"}
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        {language === "ko" ? "전체 재생" : "Play Full"}
                      </>
                    )}
                  </Button>

                  {/* Play Selected Segment */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isPlayingSegment ? "default" : "outline"}
                        size="sm"
                        onClick={playSelectedSegment}
                        disabled={!audioLoaded || loadingAudioUrl}
                        className="flex-1"
                      >
                        {isPlayingSegment ? (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            {language === "ko" ? "구간 정지" : "Stop Segment"}
                          </>
                        ) : (
                          <>
                            <SkipForward className="h-4 w-4 mr-1" />
                            {language === "ko" ? "구간 재생" : "Play Segment"}
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[240px]">
                      <p className="text-xs">
                        {language === "ko"
                          ? `선택한 구간만 재생합니다 (${formatDuration(audioStartTime)} - ${formatDuration(audioStartTime + videoDuration)})`
                          : `Play only the selected segment (${formatDuration(audioStartTime)} - ${formatDuration(audioStartTime + videoDuration)})`}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            {/* Loading Audio URL */}
            {loadingAudioUrl && (
              <div className="flex items-center justify-center gap-2 py-2 text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">
                  {language === "ko" ? "오디오 로딩 중..." : "Loading audio..."}
                </span>
              </div>
            )}
          </div>

          {/* Video Duration Selection - Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-neutral-700 flex items-center">
                {language === "ko" ? "영상 길이" : "Video Duration"}
                <TooltipIcon tooltipKey="fastCut.tooltips.music.videoDuration" />
              </Label>
              <span className="text-sm text-neutral-500 font-mono">
                {videoDuration || 15}s
              </span>
            </div>
            <Slider
              value={[videoDuration || 15]}
              onValueChange={(v) => {
                const newDuration = v[0];
                onSetVideoDuration(newDuration);
                // Adjust start time if it would cause region to exceed audio
                const maxStart = Math.max(0, selectedAudio.duration - newDuration);
                if (audioStartTime > maxStart) {
                  onSetAudioStartTime(maxStart);
                }
              }}
              min={5}
              max={30}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-neutral-400">
              <span>5s</span>
              <span>15s</span>
              <span>30s</span>
            </div>
          </div>

          {/* Audio Playback Region - Visual Timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-neutral-700 flex items-center">
                {language === "ko" ? "음악 재생 구간" : "Audio Playback Region"}
                <TooltipIcon tooltipKey="fastCut.tooltips.music.startTime" />
              </Label>
              <span className="text-sm text-neutral-500 font-mono">
                {formatDuration(audioStartTime)} - {formatDuration(audioStartTime + (videoDuration || 15))}
              </span>
            </div>

            {/* Visual Timeline Bar */}
            <div className="relative h-10 bg-neutral-100 rounded-lg overflow-hidden">
              {/* Full audio duration background */}
              <div className="absolute inset-0 flex items-center px-2">
                <div className="w-full h-1 bg-neutral-200 rounded-full" />
              </div>

              {/* Selected playback region */}
              <div
                className="absolute top-1 bottom-1 bg-neutral-900/10 border-2 border-neutral-900 rounded transition-all duration-150"
                style={{
                  left: `${(audioStartTime / selectedAudio.duration) * 100}%`,
                  width: `${Math.min(((videoDuration || 15) / selectedAudio.duration) * 100, 100 - (audioStartTime / selectedAudio.duration) * 100)}%`,
                }}
              >
                {/* Start handle */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-6 bg-neutral-900 rounded-sm cursor-ew-resize" />
              </div>

              {/* Time markers */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] text-neutral-400">
                <span>0:00</span>
                <span>{formatDuration(selectedAudio.duration / 2)}</span>
                <span>{formatDuration(selectedAudio.duration)}</span>
              </div>
            </div>

            {/* Start Time Slider */}
            <div className="pt-1">
              <Slider
                value={[audioStartTime]}
                onValueChange={(v) => {
                  // Ensure the playback region doesn't exceed audio duration
                  const maxStart = Math.max(0, selectedAudio.duration - (videoDuration || 15));
                  onSetAudioStartTime(Math.min(v[0], maxStart));
                }}
                min={0}
                max={Math.max(0, selectedAudio.duration - (videoDuration || 15))}
                step={0.5}
                className="w-full"
              />
            </div>

            {/* Warning if playback region exceeds audio */}
            {audioStartTime + (videoDuration || 15) > selectedAudio.duration && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <span>⚠️</span>
                {language === "ko"
                  ? "재생 구간이 음악 길이를 초과합니다. 나머지 구간은 반복 재생됩니다."
                  : "Playback region exceeds audio length. Remaining section will loop."}
              </p>
            )}
          </div>

          {/* AI Analysis Result */}
          {audioAnalysis && (
            <AudioAIRecommendation
              audioAnalysis={audioAnalysis}
              audioStartTime={audioStartTime}
              videoDuration={videoDuration}
              analyzingAudio={analyzingAudio}
              isPlayingSegment={isPlayingSegment}
              audioLoaded={audioLoaded}
              onUseSuggested={() => onSetAudioStartTime(audioAnalysis.suggestedStartTime)}
              onReAnalyze={onReAnalyze}
              onPlaySegment={playSelectedSegment}
              showTooltip={true}
            />
          )}

          {/* Subtitle Mode Selection - only show if lyrics available */}
          {selectedAudioLyrics && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-neutral-700 flex items-center gap-1">
                <Subtitles className="h-4 w-4" />
                {language === "ko" ? "자막 설정" : "Subtitle Settings"}
              </Label>

              <div className="space-y-2">
                {/* Script option */}
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    subtitleMode === "script"
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <input
                    type="radio"
                    name="subtitleMode"
                    value="script"
                    checked={subtitleMode === "script"}
                    onChange={() => onSetSubtitleMode("script")}
                    className="mt-0.5 h-4 w-4 text-neutral-900 border-neutral-300 focus:ring-neutral-900"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {language === "ko" ? "스크립트 자막" : "Script Subtitles"}
                      </span>
                      <Badge variant="outline" className="text-xs border-neutral-300">
                        AI
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {language === "ko"
                        ? "AI가 생성한 텍스트 오버레이 (CTA, 후크 문구)"
                        : "AI-generated text overlays (CTA, hook phrases)"}
                    </p>
                  </div>
                </label>

                {/* Lyrics option */}
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    subtitleMode === "lyrics"
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  )}
                >
                  <input
                    type="radio"
                    name="subtitleMode"
                    value="lyrics"
                    checked={subtitleMode === "lyrics"}
                    onChange={() => onSetSubtitleMode("lyrics")}
                    className="mt-0.5 h-4 w-4 text-neutral-900 border-neutral-300 focus:ring-neutral-900"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {language === "ko" ? "가사 자막" : "Lyrics Subtitles"}
                      </span>
                      <Badge variant="outline" className="text-xs border-neutral-300">
                        {selectedAudioLyrics.segments.length}{" "}
                        {language === "ko" ? "개" : "segments"}
                      </Badge>
                      {selectedAudioLyrics.language && (
                        <Badge variant="outline" className="text-xs border-neutral-300 uppercase">
                          {selectedAudioLyrics.language}
                        </Badge>
                      )}
                      {selectedAudioLyrics.confidence && (
                        <Badge variant="outline" className="text-xs border-neutral-200">
                          {Math.round(selectedAudioLyrics.confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {language === "ko"
                        ? "음원에서 추출한 가사 (음악 타이밍에 맞춤)"
                        : "Extracted lyrics from audio (synced to music timing)"}
                    </p>
                  </div>
                </label>
              </div>

              {/* Lyrics Preview - only when lyrics mode selected */}
              {subtitleMode === "lyrics" && (
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-neutral-50 flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      {language === "ko" ? "가사 미리보기" : "Lyrics Preview"}
                    </span>
                  </div>
                  <div className="p-3 space-y-3">
                    <ScrollArea className="h-[160px] pr-2">
                      <div className="space-y-1">
                        {selectedAudioLyrics.segments.map((segment, idx) => {
                          const segmentInRange =
                            segment.start >= audioStartTime &&
                            segment.start < audioStartTime + (videoDuration || 15);

                          return (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-start gap-3 p-2 rounded text-sm transition-colors",
                                segmentInRange
                                  ? "bg-neutral-100 border border-neutral-200"
                                  : "bg-neutral-50 opacity-50"
                              )}
                            >
                              <div className="flex-shrink-0 w-20 text-xs text-neutral-500 font-mono pt-0.5">
                                {formatDuration(segment.start)} - {formatDuration(segment.end)}
                              </div>
                              <div
                                className={cn(
                                  "flex-1 leading-relaxed",
                                  segmentInRange ? "text-neutral-900" : "text-neutral-500"
                                )}
                              >
                                {segment.text}
                              </div>
                              {segmentInRange && (
                                <Badge
                                  variant="outline"
                                  className="flex-shrink-0 text-xs border-neutral-300 bg-white"
                                >
                                  {language === "ko" ? "표시됨" : "visible"}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <p className="text-xs text-neutral-400 pt-2 border-t border-neutral-100">
                      {language === "ko"
                        ? "자막 스타일은 다음 단계에서 선택할 수 있습니다"
                        : "Subtitle style can be selected in the next step"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Campaign Audio Assets (for manual selection) */}
      {!musicSkipped && campaignAudioAssets.length > 0 && audioMatches.length === 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-neutral-700">
            {language === "ko" ? "캠페인 오디오" : "Campaign Audio"} ({campaignAudioAssets.length})
          </Label>
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-2">
              {campaignAudioAssets.map((asset) => {
                const isSelected = selectedAudio?.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() =>
                      onSelectAudio({
                        id: asset.id,
                        filename: asset.original_filename,
                        s3Url: asset.s3_url,
                        bpm: null,
                        vibe: null,
                        genre: null,
                        duration: (asset.metadata?.duration as number) || 60,
                        energy: 0.5,
                        matchScore: 50,
                      })
                    }
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      <Music className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-neutral-700 truncate flex-1">
                      {asset.original_filename}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
