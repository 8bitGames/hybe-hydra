"use client";

/**
 * Fast Cut Style Set Test Page
 * ============================
 * Test different style sets with images and music
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Upload,
  X,
  Check,
  Play,
  Pause,
  Image as ImageIcon,
  Music,
  Palette,
  Film,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  Trash2,
  ArrowUpDown,
  Volume2,
  FolderOpen,
  FileText,
  Zap,
  RotateCcw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { fastCutApi, StyleSetSummary, RenderStatus, AudioAnalysisResponse } from "@/lib/fast-cut-api";
import { api } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";

// Sample images for testing (using picsum.photos for reliable placeholders)
const SAMPLE_IMAGES = [
  { url: "https://picsum.photos/seed/concert1/800/1200", name: "Image 1" },
  { url: "https://picsum.photos/seed/concert2/800/1200", name: "Image 2" },
  { url: "https://picsum.photos/seed/concert3/800/1200", name: "Image 3" },
  { url: "https://picsum.photos/seed/concert4/800/1200", name: "Image 4" },
  { url: "https://picsum.photos/seed/concert5/800/1200", name: "Image 5" },
  { url: "https://picsum.photos/seed/concert6/800/1200", name: "Image 6" },
];

interface UploadedImage {
  id: string;
  url: string;
  name: string;
  file?: File;
  order: number;
  isBase64?: boolean; // Flag to identify base64 stored images
}

interface AudioAsset {
  id: string;
  filename: string;
  original_filename: string;
  s3_url: string;
  campaign_name?: string;
  metadata?: {
    duration?: number;
    bpm?: number;
  };
}

interface Campaign {
  id: string;
  name: string;
}

export default function StyleSetTestPage() {
  const { language } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Image State - Initialize from localStorage
  const [images, setImages] = useState<UploadedImage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("fastcut-test-images");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter out blob URLs (they won't work after refresh)
        // Keep base64 data URLs and external URLs
        return parsed.filter((img: UploadedImage) =>
          !img.url.startsWith("blob:") || img.isBase64
        );
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  // Save images to localStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Save base64 URLs and external URLs (not blob URLs without base64 flag)
    const savableImages = images
      .filter((img) => !img.url.startsWith("blob:") || img.isBase64)
      .map(({ file, ...rest }) => rest); // Remove file objects (can't be serialized)

    try {
      localStorage.setItem("fastcut-test-images", JSON.stringify(savableImages));
    } catch (e) {
      // Handle localStorage quota exceeded
      console.warn("Failed to save images to localStorage:", e);
    }
  }, [images]);

  // Campaign State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Style Set State
  const [styleSets, setStyleSets] = useState<StyleSetSummary[]>([]);
  const [selectedStyleSetId, setSelectedStyleSetId] = useState<string>("viral_tiktok");
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");

  // Audio State
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Subtitle Mode State
  const [subtitleMode, setSubtitleMode] = useState<"script" | "lyrics">("script");

  // Audio Analysis State
  const [audioStartTime, setAudioStartTime] = useState<number>(0);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResponse | null>(null);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);

  // Render State
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);

  // Load campaigns on mount
  useEffect(() => {
    const loadCampaigns = async () => {
      setLoadingCampaigns(true);
      try {
        const response = await api.get<{
          items: Array<{ id: string; name: string }>;
        }>("/api/v1/campaigns?page_size=100");

        if (response.data?.items) {
          setCampaigns(response.data.items);
          // Auto-select first campaign if available
          if (response.data.items.length > 0) {
            setSelectedCampaignId(response.data.items[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load campaigns:", err);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    loadCampaigns();
  }, []);

  // Load style sets on mount
  useEffect(() => {
    const loadStyleSets = async () => {
      try {
        const response = await fastCutApi.getStyleSets();
        setStyleSets(response.styleSets);
      } catch (err) {
        console.error("Failed to load style sets:", err);
      }
    };
    loadStyleSets();
  }, []);

  // Load audio assets on mount
  useEffect(() => {
    const loadAudioAssets = async () => {
      setLoadingAudio(true);
      try {
        const response = await api.get<{
          items: AudioAsset[];
          total: number;
        }>("/api/v1/assets?type=audio&page_size=50");

        if (response.data?.items) {
          setAudioAssets(response.data.items);
        }
      } catch (err) {
        console.error("Failed to load audio assets:", err);
      } finally {
        setLoadingAudio(false);
      }
    };
    loadAudioAssets();
  }, []);

  // Get selected style set
  const selectedStyleSet = useMemo(() => {
    return styleSets.find((s) => s.id === selectedStyleSetId);
  }, [styleSets, selectedStyleSetId]);

  // Get selected audio
  const selectedAudio = useMemo(() => {
    return audioAssets.find((a) => a.id === selectedAudioId);
  }, [audioAssets, selectedAudioId]);

  // Analyze audio best segment when audio is selected
  useEffect(() => {
    const analyzeAudio = async () => {
      if (!selectedAudioId) {
        setAudioStartTime(0);
        setAudioAnalysis(null);
        return;
      }

      setAnalyzingAudio(true);
      try {
        const targetDuration = 20; // Fixed 20 seconds for test
        const analysis = await fastCutApi.analyzeAudioBestSegment(selectedAudioId, targetDuration);
        setAudioAnalysis(analysis);
        if (analysis.suggestedStartTime !== undefined) {
          setAudioStartTime(analysis.suggestedStartTime);
          console.log(`[Test] Audio best segment: ${analysis.suggestedStartTime}s - ${analysis.suggestedEndTime}s`);
        }
      } catch (err) {
        console.error("Failed to analyze audio:", err);
        setAudioStartTime(0);
        setAudioAnalysis(null);
      } finally {
        setAnalyzingAudio(false);
      }
    };

    analyzeAudio();
  }, [selectedAudioId]);

  // Generate default script lines for testing (20 seconds total)
  // Note: cutDuration is for image transition speed, not text
  // Text timing is separate - we use a fixed 2 seconds per subtitle for readability
  const generateTestScript = useCallback(() => {
    const textDuration = 2.0; // Fixed text display duration for readability
    const totalDuration = 20; // Fixed 20 seconds
    const numSubtitles = Math.ceil(totalDuration / textDuration);

    const testSubtitles = [
      "스타일 테스트 영상",
      "Fast Cut으로 만든",
      "짧고 임팩트 있는",
      "숏폼 콘텐츠",
      "다양한 효과와",
      "트랜지션으로",
      "눈길을 사로잡는",
      "영상을 만들어보세요",
      "지금 바로 시작!",
      "더 많은 기능을",
    ];

    const lines = [];
    for (let idx = 0; idx < numSubtitles; idx++) {
      const timing = idx * textDuration;
      if (timing >= totalDuration) break;
      lines.push({
        text: testSubtitles[idx % testSubtitles.length],
        timing,
        duration: Math.min(textDuration, totalDuration - timing),
      });
    }
    return lines;
  }, []);

  // Convert file to base64 data URL
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle file upload - convert to base64 for persistence
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: UploadedImage[] = [];
    const currentOrder = images.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      try {
        // Convert to base64 data URL for localStorage persistence
        const base64Url = await fileToBase64(file);
        newImages.push({
          id: uuidv4(),
          url: base64Url,
          name: file.name,
          file,
          order: currentOrder + i,
          isBase64: true,
        });
      } catch (err) {
        console.error("Failed to convert image to base64:", err);
        // Fallback to blob URL if base64 fails
        const url = URL.createObjectURL(file);
        newImages.push({
          id: uuidv4(),
          url,
          name: file.name,
          file,
          order: currentOrder + i,
        });
      }
    }

    setImages((prev) => [...prev, ...newImages]);
  }, [images.length, fileToBase64]);

  // Add sample images
  const addSampleImages = useCallback(() => {
    const currentOrder = images.length;
    const sampleImages: UploadedImage[] = SAMPLE_IMAGES.map((sample, idx) => ({
      id: uuidv4(),
      url: sample.url,
      name: sample.name,
      order: currentOrder + idx,
    }));
    setImages((prev) => [...prev, ...sampleImages]);
  }, [images.length]);

  // Remove image
  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const imgToRemove = prev.find((img) => img.id === id);
      // Only revoke blob URLs, not base64 data URLs
      if (imgToRemove?.url.startsWith("blob:")) {
        URL.revokeObjectURL(imgToRemove.url);
      }
      const filtered = prev.filter((img) => img.id !== id);
      return filtered.map((img, idx) => ({ ...img, order: idx }));
    });
  }, []);

  // Clear all images
  const clearAllImages = useCallback(() => {
    images.forEach((img) => {
      // Only revoke blob URLs, not base64 data URLs
      if (img.file && img.url.startsWith("blob:")) {
        URL.revokeObjectURL(img.url);
      }
    });
    setImages([]);
    // Also clear from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("fastcut-test-images");
    }
  }, [images]);

  // Move image order
  const moveImage = useCallback((id: string, direction: "up" | "down") => {
    setImages((prev) => {
      const index = prev.findIndex((img) => img.id === id);
      if (index === -1) return prev;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newImages = [...prev];
      [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
      return newImages.map((img, idx) => ({ ...img, order: idx }));
    });
  }, []);

  // Toggle audio playback
  const toggleAudioPlayback = useCallback((audioId: string, audioUrl: string) => {
    if (playingAudioId === audioId) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setPlayingAudioId(audioId);
      }
    }
  }, [playingAudioId]);

  // Handle audio upload
  const handleAudioUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!selectedCampaignId) {
      setError(language === "ko" ? "먼저 캠페인을 선택해주세요" : "Please select a campaign first");
      return;
    }

    const file = files[0];
    if (!file.type.startsWith("audio/")) {
      setError(language === "ko" ? "오디오 파일만 업로드 가능합니다" : "Only audio files allowed");
      return;
    }

    setUploadingAudio(true);
    setError(null);

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append("file", file);

      // Get auth token from localStorage
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

      // Upload to the selected campaign
      const response = await fetch(`/api/v1/campaigns/${selectedCampaignId}/assets`, {
        method: "POST",
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || "Upload failed");
      }

      // Add to audio assets list
      const newAudioAsset: AudioAsset = {
        id: data.id,
        filename: data.filename,
        original_filename: file.name,
        s3_url: data.s3_url || data.url,
        metadata: data.metadata,
      };

      setAudioAssets((prev) => [newAudioAsset, ...prev]);
      setSelectedAudioId(data.id); // Auto-select the uploaded audio

    } catch (err) {
      console.error("Audio upload failed:", err);
      setError(err instanceof Error ? err.message : (language === "ko" ? "음원 업로드 실패" : "Audio upload failed"));
    } finally {
      setUploadingAudio(false);
      // Reset the input
      if (audioInputRef.current) {
        audioInputRef.current.value = "";
      }
    }
  }, [language, selectedCampaignId]);

  // Format duration
  const formatDuration = (seconds?: number): string => {
    if (seconds === undefined || seconds === null) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start rendering
  const startRender = useCallback(async () => {
    const startTime = Date.now();
    const LOG_PREFIX = "[Fast-Cut Test]";

    console.log(`${LOG_PREFIX} ========================================`);
    console.log(`${LOG_PREFIX} RENDER START - ${new Date().toISOString()}`);
    console.log(`${LOG_PREFIX} ========================================`);

    // Validation logging
    console.log(`${LOG_PREFIX} Pre-render validation:`, {
      imageCount: images.length,
      requiredImages: 3,
      selectedAudioId,
      selectedStyleSetId,
      aspectRatio,
      selectedStyleSet: selectedStyleSet ? {
        id: selectedStyleSet.id,
        name: selectedStyleSet.name,
        vibe: selectedStyleSet.vibe,
        colorGrade: selectedStyleSet.colorGrade,
      } : null,
      selectedAudio: selectedAudio ? {
        id: selectedAudio.id,
        filename: selectedAudio.original_filename,
        bpm: selectedAudio.metadata?.bpm,
        duration: selectedAudio.metadata?.duration,
      } : null,
    });

    if (images.length < 3) {
      console.warn(`${LOG_PREFIX} Validation failed: Need at least 3 images (have ${images.length})`);
      setError(language === "ko" ? "최소 3장의 이미지가 필요합니다" : "Need at least 3 images");
      return;
    }

    if (!selectedAudioId) {
      console.warn(`${LOG_PREFIX} Validation failed: No audio selected`);
      setError(language === "ko" ? "음원을 선택해주세요" : "Please select an audio track");
      return;
    }

    console.log(`${LOG_PREFIX} Validation passed, starting render...`);
    setRendering(true);
    setError(null);
    setRenderStatus(null);

    const newGenerationId = uuidv4();
    setGenerationId(newGenerationId);
    console.log(`${LOG_PREFIX} Generated job ID: ${newGenerationId}`);

    try {
      // Check if any images are base64 data URLs and need to be proxied to S3
      const hasBase64Images = images.some((img) => img.url.startsWith("data:image/"));
      let processedImages = images;

      if (hasBase64Images) {
        console.log(`${LOG_PREFIX} Found base64 images, uploading to S3 first...`);
        setRenderStatus({
          status: "processing",
          progress: 5,
          currentStep: language === "ko" ? "이미지 업로드 중..." : "Uploading images...",
        });

        try {
          const proxyResult = await fastCutApi.proxyImages(
            newGenerationId,
            images.map((img) => ({ url: img.url, id: img.id }))
          );

          console.log(`${LOG_PREFIX} Proxy result:`, {
            successful: proxyResult.successful,
            failed: proxyResult.failed,
          });

          if (proxyResult.successful < 3) {
            throw new Error(
              language === "ko"
                ? `이미지 업로드 실패: ${proxyResult.successful}개만 성공 (최소 3개 필요)`
                : `Image upload failed: only ${proxyResult.successful} succeeded (need at least 3)`
            );
          }

          // Replace base64 URLs with S3 URLs
          processedImages = images.map((img) => {
            const proxyItem = proxyResult.results.find((r) => r.id === img.id);
            if (proxyItem?.success && proxyItem.minioUrl) {
              return { ...img, url: proxyItem.minioUrl };
            }
            return img;
          });

          console.log(`${LOG_PREFIX} Images uploaded to S3:`, processedImages.map((img) => img.url.substring(0, 80)));
        } catch (proxyError) {
          console.error(`${LOG_PREFIX} Proxy failed:`, proxyError);
          throw proxyError;
        }
      }

      // Generate test script with subtitles
      const scriptLines = generateTestScript();

      // Calculate how many images are needed based on cutDuration
      const cutDuration = selectedStyleSet?.cutDuration ?? 1.5;
      const targetDuration = 20; // Fixed 20 seconds for test
      const numImagesNeeded = Math.ceil(targetDuration / cutDuration);

      // Repeat images to fill the duration
      const repeatedImages: { url: string; order: number }[] = [];
      for (let i = 0; i < numImagesNeeded; i++) {
        const sourceImage = processedImages[i % processedImages.length];
        repeatedImages.push({
          url: sourceImage.url,
          order: i,
        });
      }

      console.log(`${LOG_PREFIX} Image calculation:`, {
        cutDuration,
        targetDuration,
        numImagesNeeded,
        originalImages: processedImages.length,
        repeatedImages: repeatedImages.length,
      });

      const renderRequest = {
        generationId: newGenerationId,
        campaignId: "", // Empty = no campaign (test mode)
        audioAssetId: selectedAudioId,
        images: repeatedImages,
        script: { lines: scriptLines }, // Include test subtitles
        styleSetId: selectedStyleSetId,
        aspectRatio,
        targetDuration,
        cutDuration, // Explicitly pass cutDuration for image transition speed
        audioStartTime, // Best segment start time from audio analysis
        prompt: "Style set test video",
        // Subtitle mode - use audio lyrics when lyrics mode selected
        useAudioLyrics: subtitleMode === "lyrics",
      };

      console.log(`${LOG_PREFIX} Render request payload:`, JSON.stringify(renderRequest, null, 2));
      console.log(`${LOG_PREFIX} Image URLs:`, images.map((img, idx) => `[${idx}] ${img.url.substring(0, 100)}...`));

      // Start render
      const apiStartTime = Date.now();
      console.log(`${LOG_PREFIX} Calling fastCutApi.startRender() at ${new Date().toISOString()}`);

      const response = await fastCutApi.startRender(renderRequest);

      const apiDuration = Date.now() - apiStartTime;
      console.log(`${LOG_PREFIX} ========================================`);
      console.log(`${LOG_PREFIX} API RESPONSE (${apiDuration}ms):`);
      console.log(`${LOG_PREFIX}   Job ID: ${response.jobId}`);
      console.log(`${LOG_PREFIX}   Status: ${response.status}`);
      console.log(`${LOG_PREFIX}   Estimated seconds: ${response.estimatedSeconds}`);
      console.log(`${LOG_PREFIX}   Output key: ${response.outputKey}`);
      console.log(`${LOG_PREFIX}   Full response:`, JSON.stringify(response, null, 2));
      console.log(`${LOG_PREFIX} ========================================`);

      // Poll for status with detailed logging
      let pollCount = 0;
      const pollStartTime = Date.now();
      console.log(`${LOG_PREFIX} Starting status polling (interval: 2000ms, max: 150 attempts)`);

      const finalStatus = await fastCutApi.waitForRender(
        newGenerationId,
        (status) => {
          pollCount++;
          const pollElapsed = Math.floor((Date.now() - pollStartTime) / 1000);
          console.log(`${LOG_PREFIX} [Poll #${pollCount}] Status update at +${pollElapsed}s:`, {
            status: status.status,
            progress: status.progress,
            currentStep: status.currentStep,
            outputUrl: status.outputUrl ? `${status.outputUrl.substring(0, 80)}...` : null,
            error: status.error,
          });
          setRenderStatus(status);
        },
        2000, // Poll every 2 seconds
        150 // 5 minute timeout
      );

      const totalDuration = Math.floor((Date.now() - startTime) / 1000);
      console.log(`${LOG_PREFIX} ========================================`);
      console.log(`${LOG_PREFIX} RENDER COMPLETE`);
      console.log(`${LOG_PREFIX}   Total time: ${totalDuration}s`);
      console.log(`${LOG_PREFIX}   Poll count: ${pollCount}`);
      console.log(`${LOG_PREFIX}   Final status: ${finalStatus.status}`);
      console.log(`${LOG_PREFIX}   Output URL: ${finalStatus.outputUrl || 'N/A'}`);
      console.log(`${LOG_PREFIX} ========================================`);

      setRenderStatus(finalStatus);

      if (finalStatus.status === "failed") {
        console.error(`${LOG_PREFIX} RENDER FAILED:`, finalStatus.error);
        setError(finalStatus.error || "Render failed");
      }
    } catch (err) {
      const totalDuration = Math.floor((Date.now() - startTime) / 1000);
      console.error(`${LOG_PREFIX} ========================================`);
      console.error(`${LOG_PREFIX} RENDER ERROR after ${totalDuration}s`);
      console.error(`${LOG_PREFIX} Error type: ${err instanceof Error ? err.constructor.name : typeof err}`);
      console.error(`${LOG_PREFIX} Error message: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`${LOG_PREFIX} Stack trace:`, err instanceof Error ? err.stack : 'N/A');
      console.error(`${LOG_PREFIX} ========================================`);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRendering(false);
      console.log(`${LOG_PREFIX} Render process ended at ${new Date().toISOString()}`);
    }
  }, [images, selectedStyleSetId, selectedAudioId, aspectRatio, language, selectedStyleSet, selectedAudio, generateTestScript]);

  // Reset test (also clears rendering state for killed jobs)
  const resetTest = useCallback(() => {
    setRendering(false);
    setRenderStatus(null);
    setGenerationId(null);
    setError(null);
  }, []);

  // Check if ready to render
  const isReadyToRender = images.length >= 3 && selectedAudioId;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hidden audio element for preview */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingAudioId(null)}
        className="hidden"
      />

      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/create?mode=fast-cut">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {language === "ko" ? "돌아가기" : "Back"}
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">
                {language === "ko" ? "스타일 세트 테스트" : "Style Set Test"}
              </h1>
              <p className="text-sm text-neutral-500">
                {language === "ko"
                  ? "다양한 스타일을 이미지와 음원으로 테스트해보세요"
                  : "Test different styles with images and music"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/fast-cut/test/results">
              <Button variant="outline" size="sm">
                <Film className="h-4 w-4 mr-1" />
                {language === "ko" ? "결과 보기" : "View Results"}
              </Button>
            </Link>
            <Badge variant="outline" className="text-xs">
              {language === "ko" ? "테스트 모드" : "Test Mode"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Image Upload Section */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {language === "ko" ? "이미지" : "Images"} ({images.length})
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSampleImages}
                    className="text-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {language === "ko" ? "샘플 추가" : "Add Samples"}
                  </Button>
                  {images.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllImages}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {language === "ko" ? "모두 삭제" : "Clear All"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
                  "hover:border-neutral-400 hover:bg-neutral-50",
                  "border-neutral-300 bg-neutral-50/50"
                )}
              >
                <Upload className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
                <p className="text-sm text-neutral-600">
                  {language === "ko"
                    ? "클릭하여 이미지 업로드"
                    : "Click to upload images"}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  PNG, JPG, WEBP
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>

              {/* Image Grid */}
              {images.length > 0 && (
                <ScrollArea className="h-[160px] mt-4">
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((image, idx) => (
                      <div
                        key={image.id}
                        className="relative aspect-[3/4] rounded-lg overflow-hidden border border-neutral-200 group"
                      >
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Order badge */}
                        <div className="absolute top-1 left-1 w-4 h-4 bg-neutral-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                          {idx + 1}
                        </div>
                        {/* Controls */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveImage(image.id, "up");
                            }}
                            disabled={idx === 0}
                          >
                            <ArrowUpDown className="h-3 w-3 rotate-180" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(image.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {images.length < 3 && (
                <p className="text-xs text-orange-600 mt-2">
                  {language === "ko"
                    ? `최소 3장의 이미지가 필요합니다 (현재: ${images.length}장)`
                    : `Need at least 3 images (current: ${images.length})`}
                </p>
              )}
            </div>

            {/* Campaign Selection for Upload */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <FolderOpen className="h-4 w-4" />
                {language === "ko" ? "업로드 캠페인" : "Upload Campaign"}
              </Label>
              {loadingCampaigns ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Spinner className="h-4 w-4" />
                  {language === "ko" ? "로딩 중..." : "Loading..."}
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  {language === "ko" ? "캠페인이 없습니다" : "No campaigns available"}
                </p>
              ) : (
                <Select
                  value={selectedCampaignId || undefined}
                  onValueChange={setSelectedCampaignId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={language === "ko" ? "캠페인 선택..." : "Select campaign..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-neutral-500 mt-2">
                {language === "ko"
                  ? "음원 업로드 시 이 캠페인에 저장됩니다"
                  : "Uploaded audio will be saved to this campaign"}
              </p>
            </div>

            {/* Music Selection Section */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  {language === "ko" ? "음원 선택" : "Select Music"}
                  {selectedAudio && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {language === "ko" ? "선택됨" : "Selected"}
                    </Badge>
                  )}
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={uploadingAudio || !selectedCampaignId}
                  className="text-xs"
                >
                  {uploadingAudio ? (
                    <>
                      <Spinner className="h-3 w-3 mr-1" />
                      {language === "ko" ? "업로드 중..." : "Uploading..."}
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3 mr-1" />
                      {language === "ko" ? "음원 업로드" : "Upload Audio"}
                    </>
                  )}
                </Button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => handleAudioUpload(e.target.files)}
                />
              </div>

              {loadingAudio ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : audioAssets.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <Music className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {language === "ko"
                      ? "사용 가능한 음원이 없습니다"
                      : "No audio assets available"}
                  </p>
                  <p className="text-xs mt-1 mb-3">
                    {language === "ko"
                      ? "위의 '음원 업로드' 버튼을 클릭하여 음원을 추가하세요"
                      : "Click 'Upload Audio' button above to add music"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => audioInputRef.current?.click()}
                    disabled={uploadingAudio || !selectedCampaignId}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {language === "ko" ? "음원 업로드" : "Upload Audio"}
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {audioAssets.map((audio) => {
                      const isSelected = audio.id === selectedAudioId;
                      const isPlaying = audio.id === playingAudioId;
                      return (
                        <div
                          key={audio.id}
                          onClick={() => setSelectedAudioId(audio.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                            isSelected
                              ? "border-neutral-900 bg-neutral-50"
                              : "border-neutral-200 hover:border-neutral-400"
                          )}
                        >
                          {/* Play/Pause Button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAudioPlayback(audio.id, audio.s3_url);
                            }}
                          >
                            {isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {audio.original_filename || audio.filename}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-neutral-500">
                              {audio.metadata?.duration && (
                                <span>{formatDuration(audio.metadata.duration)}</span>
                              )}
                              {audio.metadata?.bpm && (
                                <Badge variant="outline" className="text-[9px] py-0">
                                  {audio.metadata.bpm} BPM
                                </Badge>
                              )}
                              {audio.campaign_name && (
                                <span className="truncate">{audio.campaign_name}</span>
                              )}
                            </div>
                          </div>

                          {/* Selection Indicator */}
                          {isSelected && (
                            <div className="w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center shrink-0">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {!selectedAudioId && audioAssets.length > 0 && (
                <p className="text-xs text-orange-600 mt-2">
                  {language === "ko"
                    ? "음원을 선택해주세요"
                    : "Please select an audio track"}
                </p>
              )}
            </div>

            {/* Audio Start Time Controls - Only show when audio is selected */}
            {selectedAudio && (
              <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    {language === "ko" ? "시작 위치 설정" : "Start Position"}
                  </Label>
                  {analyzingAudio && (
                    <Badge variant="outline" className="text-xs border-neutral-300 animate-pulse">
                      <Spinner className="h-3 w-3 mr-1" />
                      {language === "ko" ? "분석 중..." : "Analyzing..."}
                    </Badge>
                  )}
                </div>

                {/* Audio Start Time Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">
                      {language === "ko" ? "시작 시간" : "Start Time"}
                    </span>
                    <span className="text-sm font-mono font-medium text-neutral-900">
                      {formatDuration(audioStartTime)}
                    </span>
                  </div>
                  <Slider
                    value={[audioStartTime]}
                    onValueChange={(v) => setAudioStartTime(v[0])}
                    min={0}
                    max={Math.max(0, (selectedAudio.metadata?.duration || 60) - 20)}
                    step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>0:00</span>
                    <span>{formatDuration(selectedAudio.metadata?.duration || 60)}</span>
                  </div>
                </div>

                {/* Preview Audio from Start Time */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (audioRef.current && selectedAudio) {
                        audioRef.current.src = selectedAudio.s3_url;
                        audioRef.current.currentTime = audioStartTime;
                        audioRef.current.play();
                        setPlayingAudioId(selectedAudio.id);
                      }
                    }}
                    className="flex-1"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {language === "ko" ? "시작 위치에서 재생" : "Play from Start"}
                  </Button>
                  {playingAudioId === selectedAudio.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        audioRef.current?.pause();
                        setPlayingAudioId(null);
                      }}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* AI Analysis Result */}
                {audioAnalysis && !analyzingAudio && (
                  <div className="p-3 bg-neutral-50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-neutral-600" />
                      <span className="text-sm font-medium text-neutral-700">
                        {language === "ko" ? "AI 분석 결과" : "AI Analysis"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-xs text-neutral-500 block">
                          {language === "ko" ? "분석된 BPM" : "Detected BPM"}
                        </span>
                        <span className="font-medium text-neutral-900">
                          {audioAnalysis.bpm || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-500 block">
                          {language === "ko" ? "추천 구간" : "Suggested Segment"}
                        </span>
                        <span className="font-medium text-neutral-900">
                          {formatDuration(audioAnalysis.suggestedStartTime)} - {formatDuration(audioAnalysis.suggestedEndTime)}
                        </span>
                      </div>
                    </div>

                    {/* Use AI Recommendation Button */}
                    {audioAnalysis.suggestedStartTime !== audioStartTime && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setAudioStartTime(audioAnalysis.suggestedStartTime)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {language === "ko" ? "AI 추천 시간으로 변경" : "Use AI Suggested Time"}
                      </Button>
                    )}
                    {audioAnalysis.suggestedStartTime === audioStartTime && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Check className="h-3 w-3" />
                        {language === "ko" ? "AI 추천 구간 사용 중" : "Using AI recommended segment"}
                      </div>
                    )}
                  </div>
                )}

                {/* Video Duration Info */}
                <div className="text-xs text-neutral-500 bg-neutral-50 p-2 rounded">
                  {language === "ko"
                    ? `영상 길이: 20초 (${formatDuration(audioStartTime)} ~ ${formatDuration(audioStartTime + 20)})`
                    : `Video duration: 20s (${formatDuration(audioStartTime)} ~ ${formatDuration(audioStartTime + 20)})`
                  }
                </div>
              </div>
            )}

            {/* Subtitle Mode Selection */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4" />
                {language === "ko" ? "자막 모드" : "Subtitle Mode"}
              </Label>

              <div className="flex gap-3">
                <button
                  onClick={() => setSubtitleMode("script")}
                  className={cn(
                    "flex-1 p-3 rounded-lg border-2 text-center transition-all",
                    "hover:border-neutral-400",
                    subtitleMode === "script"
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 bg-white"
                  )}
                >
                  <FileText className="h-5 w-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">
                    {language === "ko" ? "스크립트" : "Script"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {language === "ko" ? "테스트 자막 사용" : "Use test subtitles"}
                  </p>
                </button>

                <button
                  onClick={() => setSubtitleMode("lyrics")}
                  className={cn(
                    "flex-1 p-3 rounded-lg border-2 text-center transition-all",
                    "hover:border-neutral-400",
                    subtitleMode === "lyrics"
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 bg-white"
                  )}
                >
                  <Music className="h-5 w-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">
                    {language === "ko" ? "가사" : "Lyrics"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {language === "ko" ? "음원 가사 사용" : "Use audio lyrics"}
                  </p>
                </button>
              </div>

              {subtitleMode === "lyrics" && !selectedAudioId && (
                <p className="text-xs text-orange-600 mt-3">
                  {language === "ko"
                    ? "가사 모드를 사용하려면 음원을 선택해주세요"
                    : "Select audio to use lyrics mode"}
                </p>
              )}
            </div>

            {/* Style Set Selection */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <Palette className="h-4 w-4" />
                {language === "ko" ? "스타일 세트" : "Style Set"}
              </Label>

              {/* Style Set Grid */}
              <div className="grid grid-cols-2 gap-2">
                {styleSets.map((styleSet) => {
                  const isSelected = styleSet.id === selectedStyleSetId;
                  return (
                    <button
                      key={styleSet.id}
                      onClick={() => setSelectedStyleSetId(styleSet.id)}
                      className={cn(
                        "relative p-3 rounded-lg border-2 text-left transition-all",
                        "hover:border-neutral-400 hover:bg-neutral-50",
                        isSelected
                          ? "border-neutral-900 bg-neutral-50"
                          : "border-neutral-200 bg-white"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5">
                          <div className="w-4 h-4 bg-neutral-900 rounded-full flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{styleSet.icon}</span>
                        <div
                          className="w-3 h-3 rounded-full border border-neutral-200"
                          style={{ backgroundColor: styleSet.previewColor }}
                        />
                      </div>

                      <p className="font-medium text-sm text-neutral-900 truncate">
                        {language === "ko" ? styleSet.nameKo : styleSet.name}
                      </p>

                      <div className="flex items-center gap-1 mt-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[9px] py-0",
                            styleSet.intensity === "high" && "bg-red-100 text-red-700",
                            styleSet.intensity === "medium" && "bg-yellow-100 text-yellow-700",
                            styleSet.intensity === "low" && "bg-green-100 text-green-700"
                          )}
                        >
                          {styleSet.intensity === "high" && (language === "ko" ? "강렬함" : "High")}
                          {styleSet.intensity === "medium" && (language === "ko" ? "보통" : "Medium")}
                          {styleSet.intensity === "low" && (language === "ko" ? "차분함" : "Low")}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] py-0 text-neutral-500">
                          {styleSet.cutDuration}s
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected style details */}
              {selectedStyleSet && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{selectedStyleSet.icon}</span>
                    <span className="font-medium text-neutral-900">
                      {language === "ko" ? selectedStyleSet.nameKo : selectedStyleSet.name}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mb-3">
                    {language === "ko" ? selectedStyleSet.descriptionKo : selectedStyleSet.description}
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-400 block">Vibe</span>
                      <span className="text-neutral-700">{selectedStyleSet.vibe}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">Color</span>
                      <span className="text-neutral-700">{selectedStyleSet.colorGrade}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">Text</span>
                      <span className="text-neutral-700">{selectedStyleSet.textStyle}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">BPM</span>
                      <span className="text-neutral-700">
                        {selectedStyleSet.bpmRange
                          ? `${selectedStyleSet.bpmRange[0]}-${selectedStyleSet.bpmRange[1]}`
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Aspect Ratio */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <Film className="h-4 w-4" />
                {language === "ko" ? "비율" : "Aspect Ratio"}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {["9:16", "1:1", "16:9"].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={cn(
                      "p-3 rounded-lg border-2 text-center transition-all",
                      aspectRatio === ratio
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-400"
                    )}
                  >
                    <div
                      className={cn(
                        "mx-auto bg-neutral-300 rounded mb-1",
                        ratio === "9:16" && "w-4 h-6",
                        ratio === "1:1" && "w-5 h-5",
                        ratio === "16:9" && "w-6 h-4"
                      )}
                    />
                    <span className="text-xs font-medium">{ratio}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Preview & Result */}
          <div className="space-y-6">
            {/* Preview / Result */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <Label className="text-base font-semibold flex items-center gap-2 mb-4">
                <Play className="h-4 w-4" />
                {language === "ko" ? "결과" : "Result"}
              </Label>

              {/* Result Video or Preview */}
              <div
                className={cn(
                  "relative mx-auto rounded-lg overflow-hidden bg-neutral-900",
                  aspectRatio === "9:16" && "aspect-[9/16] max-w-[280px]",
                  aspectRatio === "1:1" && "aspect-square max-w-[320px]",
                  aspectRatio === "16:9" && "aspect-video max-w-full"
                )}
              >
                {renderStatus?.status === "completed" && renderStatus.outputUrl ? (
                  <video
                    src={renderStatus.outputUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain"
                  />
                ) : images.length > 0 ? (
                  <>
                    <img
                      src={images[0].url}
                      alt="Preview"
                      className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {rendering ? (
                        <div className="text-center">
                          <Spinner className="h-10 w-10 text-white mx-auto mb-2" />
                          <p className="text-white text-sm font-medium">
                            {renderStatus?.currentStep || (language === "ko" ? "렌더링 중..." : "Rendering...")}
                          </p>
                          <p className="text-white/60 text-xs mt-1">
                            {renderStatus?.progress ? `${Math.round(renderStatus.progress)}%` : ""}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={resetTest}
                            className="mt-3 bg-white/20 border-white/30 text-white hover:bg-white/30"
                          >
                            <X className="h-3 w-3 mr-1" />
                            {language === "ko" ? "취소" : "Cancel"}
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-2">
                            <Play className="h-7 w-7 text-white" />
                          </div>
                          <p className="text-white/80 text-xs">
                            {language === "ko" ? "미리보기" : "Preview"}
                          </p>
                        </div>
                      )}
                    </div>
                    {/* Style badge */}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-black/50 text-white text-[10px] backdrop-blur-sm">
                        {selectedStyleSet?.icon} {language === "ko" ? selectedStyleSet?.nameKo : selectedStyleSet?.name}
                      </Badge>
                    </div>
                    {/* Audio badge */}
                    {selectedAudio && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="bg-black/50 text-white text-[10px] backdrop-blur-sm">
                          <Volume2 className="h-2.5 w-2.5 mr-1" />
                          {selectedAudio.metadata?.bpm ? `${selectedAudio.metadata.bpm} BPM` : "Audio"}
                        </Badge>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-neutral-500">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">
                        {language === "ko" ? "이미지를 추가하세요" : "Add images"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Render Progress Steps */}
              {rendering && renderStatus?.steps && (
                <div className="mt-4 space-y-1">
                  {renderStatus.steps.map((step) => (
                    <div
                      key={step.name}
                      className={cn(
                        "flex items-center gap-2 text-xs px-3 py-1.5 rounded",
                        step.completed
                          ? "bg-green-50 text-green-700"
                          : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {step.completed ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Spinner className="h-3 w-3" />
                      )}
                      {step.name}
                    </div>
                  ))}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Result Actions */}
              {renderStatus?.status === "completed" && renderStatus.outputUrl && (
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(renderStatus.outputUrl, "_blank")}
                    className="flex-1"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {language === "ko" ? "새 탭에서 열기" : "Open in New Tab"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetTest}
                    className="flex-1"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {language === "ko" ? "다시 테스트" : "Test Again"}
                  </Button>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <Label className="text-base font-semibold mb-4 block">
                {language === "ko" ? "요약" : "Summary"}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-neutral-50 rounded-lg text-center">
                  <ImageIcon className="h-4 w-4 mx-auto mb-1 text-neutral-500" />
                  <p className="text-xs text-neutral-500">
                    {language === "ko" ? "이미지" : "Images"}
                  </p>
                  <p className="text-lg font-bold">{images.length}</p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg text-center">
                  <Music className="h-4 w-4 mx-auto mb-1 text-neutral-500" />
                  <p className="text-xs text-neutral-500">
                    {language === "ko" ? "음원" : "Audio"}
                  </p>
                  <p className="text-lg font-bold">
                    {selectedAudio?.metadata?.bpm ? `${selectedAudio.metadata.bpm}` : "-"}
                  </p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg text-center">
                  <Palette className="h-4 w-4 mx-auto mb-1 text-neutral-500" />
                  <p className="text-xs text-neutral-500">
                    {language === "ko" ? "스타일" : "Style"}
                  </p>
                  <p className="text-lg font-bold">{selectedStyleSet?.icon || "-"}</p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg text-center">
                  <Film className="h-4 w-4 mx-auto mb-1 text-neutral-500" />
                  <p className="text-xs text-neutral-500">
                    {language === "ko" ? "비율" : "Ratio"}
                  </p>
                  <p className="text-lg font-bold">{aspectRatio}</p>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={startRender}
              disabled={!isReadyToRender || rendering}
              className="w-full h-12 text-base bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {rendering ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {language === "ko" ? "생성 중..." : "Generating..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {language === "ko" ? "테스트 영상 생성" : "Generate Test Video"}
                </>
              )}
            </Button>

            {/* Readiness Check */}
            {!isReadyToRender && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-xs text-orange-700">
                <p className="font-medium mb-1">
                  {language === "ko" ? "준비 필요" : "Not Ready"}
                </p>
                <ul className="space-y-0.5 list-disc list-inside">
                  {images.length < 3 && (
                    <li>
                      {language === "ko"
                        ? `이미지 ${3 - images.length}장 더 필요`
                        : `Need ${3 - images.length} more images`}
                    </li>
                  )}
                  {!selectedAudioId && (
                    <li>
                      {language === "ko"
                        ? "음원 선택 필요"
                        : "Select an audio track"}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
