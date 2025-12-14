"use client";

import { useState, useCallback } from "react";
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
  Save,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/campaigns-api";
import type { LyricsData, LyricsSegment } from "@/lib/subtitle-styles";

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
  const accessToken = useAuthStore((s) => s.accessToken);

  // State
  const [lyricsText, setLyricsText] = useState("");
  const [languageHint, setLanguageHint] = useState<"ko" | "en" | "ja" | "auto">("auto");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<LyricsData | null>(null);
  const [saved, setSaved] = useState(false);

  // Load existing lyrics when modal opens
  const loadExistingLyrics = useCallback(() => {
    if (!asset) return;

    const metadata = asset.metadata as Record<string, unknown> | null;
    const existingLyrics = metadata?.lyrics as LyricsData | undefined;

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

  // Reset state when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      loadExistingLyrics();
    }
    onOpenChange(newOpen);
  };

  // Sync lyrics with audio
  const handleSync = async () => {
    if (!asset || !lyricsText.trim()) {
      setError(language === "ko" ? "가사를 입력해주세요" : "Please enter lyrics");
      return;
    }

    if (!accessToken) {
      setError(language === "ko" ? "로그인이 필요합니다" : "Please log in");
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/audio/lyrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          assetId: asset.id,
          lyrics: lyricsText.trim(),
          languageHint,
          forceReExtract: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // Show the actual error message if available
        const errorDetail = data.error || data.detail || `Failed with status ${response.status}`;
        throw new Error(errorDetail);
      }

      const data = await response.json();
      setSyncedLyrics(data.lyrics);
      setSaved(true);

      // Notify parent
      onSaved?.();
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
          {/* Audio File Info */}
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
            <Label className="text-xs text-neutral-500">{t.audioFile}</Label>
            <p className="font-medium text-neutral-900 truncate">
              {asset.original_filename}
            </p>
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
                <div className="p-2 space-y-1">
                  {syncedLyrics.segments.map((segment, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-2 rounded hover:bg-neutral-50 text-sm"
                    >
                      <div className="flex-shrink-0 w-24 font-mono text-xs text-neutral-500 pt-0.5">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </div>
                      <div className="flex-1 text-neutral-900">{segment.text}</div>
                    </div>
                  ))}
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
