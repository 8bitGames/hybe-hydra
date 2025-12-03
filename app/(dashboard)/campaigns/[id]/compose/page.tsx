"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi, assetsApi, Campaign, Asset } from "@/lib/campaigns-api";
import { loadBridgePrompt, clearBridgePrompt } from "@/lib/bridge-storage";
import {
  composeApi,
  ScriptGenerationResponse,
  ImageCandidate,
  AudioMatch,
  RenderStatus,
  AudioAnalysisResponse,
  EFFECT_PRESETS,
  ASPECT_RATIOS,
} from "@/lib/compose-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Music,
  Play,
  Check,
  X,
  Search,
  Volume2,
  Download,
  RotateCcw,
  FileText,
  Wand2,
  Zap,
  Plus,
  ExternalLink,
  Globe,
  Film,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { ScriptTimeline } from "@/components/features/script-timeline";
import { ImageTextPreview } from "@/components/features/image-text-preview";
import { AudioStructurePreview } from "@/components/features/audio-structure-preview";
import { TrendRecommendationsCard } from "@/components/features/trend-analysis";
import { TikTokSEOPreview } from "@/components/features/tiktok-seo-preview";

// Wizard Steps
type WizardStep = 1 | 2 | 3 | 4;

// Image Source Mode
type ImageSourceMode = "assets_only" | "search_only" | "mixed";

const STEPS = [
  { step: 1 as const, key: "script", icon: FileText, label: "스크립트", labelEn: "Script" },
  { step: 2 as const, key: "images", icon: ImageIcon, label: "이미지", labelEn: "Images" },
  { step: 3 as const, key: "music", icon: Music, label: "음악", labelEn: "Music" },
  { step: 4 as const, key: "render", icon: Film, label: "렌더링", labelEn: "Render" },
];

export default function ComposePage() {
  const params = useParams();
  const router = useRouter();
  const { t, language } = useI18n();
  const campaignId = params.id as string;

  // Core state
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [error, setError] = useState("");

  // Step 1: Script state
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptData, setScriptData] = useState<ScriptGenerationResponse | null>(null);

  // Step 2: Images state
  const [searchingImages, setSearchingImages] = useState(false);
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageCandidate[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [imageSourceMode, setImageSourceMode] = useState<ImageSourceMode>("mixed");
  const [assetImages, setAssetImages] = useState<ImageCandidate[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Step 3: Music state
  const [matchingMusic, setMatchingMusic] = useState(false);
  const [audioMatches, setAudioMatches] = useState<AudioMatch[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<AudioMatch | null>(null);
  // Audio timing state
  const [audioStartTime, setAudioStartTime] = useState<number>(0);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResponse | null>(null);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);

  // Step 4: Render state
  const [effectPreset, setEffectPreset] = useState("zoom_beat");
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Keyword editing state
  const [editableKeywords, setEditableKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  // Track which keywords are selected for search (only these will be searched)
  const [selectedSearchKeywords, setSelectedSearchKeywords] = useState<Set<string>>(new Set());

  // Load campaign data
  const loadData = useCallback(async () => {
    try {
      const campaignResult = await campaignsApi.getById(campaignId);

      if (campaignResult.error) {
        router.push("/campaigns");
        return;
      }

      if (campaignResult.data) {
        setCampaign(campaignResult.data);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load asset images for the campaign
  const loadAssetImages = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const result = await assetsApi.getByCampaign(campaignId, {
        type: "image",
        page_size: 100,
      });

      if (result.data) {
        // Convert Asset to ImageCandidate format
        const assetImageCandidates: ImageCandidate[] = result.data.items.map(
          (asset, idx) => ({
            id: `asset-${asset.id}`,
            sourceUrl: asset.s3_url,
            thumbnailUrl: asset.thumbnail_url || asset.s3_url,
            sourceTitle: asset.original_filename,
            sourceDomain: "Campaign Asset",
            width: (asset.metadata?.width as number) || 1080,
            height: (asset.metadata?.height as number) || 1920,
            isSelected: false,
            sortOrder: idx,
            qualityScore: 0.9, // Assets are pre-vetted, so give them high quality score
          })
        );
        setAssetImages(assetImageCandidates);
      }
    } catch (err) {
      console.error("Failed to load asset images:", err);
    } finally {
      setLoadingAssets(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadAssetImages();
  }, [loadAssetImages]);

  // Load prompt from Bridge on mount
  useEffect(() => {
    const bridgeData = loadBridgePrompt(campaignId);
    if (bridgeData && bridgeData.transformedPrompt.status === "success") {
      setPrompt(bridgeData.transformedPrompt.veo_prompt || bridgeData.originalPrompt);
      if (bridgeData.transformedPrompt.technical_settings?.aspect_ratio) {
        setAspectRatio(bridgeData.transformedPrompt.technical_settings.aspect_ratio);
      }
      if (bridgeData.selectedTrends && bridgeData.selectedTrends.length > 0) {
        setEditableKeywords(bridgeData.selectedTrends);
        // User-specified keywords are selected for search by default
        setSelectedSearchKeywords(new Set(bridgeData.selectedTrends));
      }
      clearBridgePrompt();
    }
  }, [campaignId]);

  // Step 1: Generate Script
  const handleGenerateScript = async () => {
    if (!prompt.trim() || !campaign) {
      setError(t.compose.enterPrompt);
      return;
    }

    setError("");
    setGeneratingScript(true);

    try {
      let trendContext: { keyword: string; hashtags: string[]; platform: string }[] = [];
      try {
        const trendResponse = await fetch("/api/v1/trends/suggestions?limit=5", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (trendResponse.ok) {
          const trendData = await trendResponse.json();
          trendContext = (trendData.suggestions || []).map((t: { keyword: string; hashtags?: string[]; platform: string }) => ({
            keyword: t.keyword,
            hashtags: t.hashtags || [],
            platform: t.platform,
          }));
        }
      } catch (trendErr) {
        console.warn("Failed to fetch trends:", trendErr);
      }

      const result = await composeApi.generateScript({
        campaignId,
        artistName: campaign.artist_stage_name || campaign.artist_name || "Artist",
        artistContext: undefined,
        trendKeywords: editableKeywords,
        trendContext,
        userPrompt: prompt.trim(),
        targetDuration: 0,
      });

      setScriptData(result);

      // Keep user's keywords separate from AI-suggested keywords
      const userKeywords = [...editableKeywords];
      const aiKeywords = (result.searchKeywords || []).filter(
        (kw) => !editableKeywords.some(
          (existing) => existing.toLowerCase() === kw.toLowerCase()
        )
      );
      const mergedKeywords = [...userKeywords, ...aiKeywords];
      setEditableKeywords(mergedKeywords);

      // Only user-specified keywords are selected for search by default
      // AI keywords are shown but NOT selected - user must explicitly select them
      setSelectedSearchKeywords(new Set(userKeywords));

      const newGenerationId = `compose-${Date.now()}`;
      setGenerationId(newGenerationId);
      setCurrentStep(2);

      // Only search with user's selected keywords (not AI keywords)
      if (userKeywords.length > 0) {
        await handleSearchImages(userKeywords, newGenerationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.general);
    } finally {
      setGeneratingScript(false);
    }
  };

  // Step 2: Search Images
  const handleSearchImages = async (keywords?: string[], genId?: string) => {
    const searchKeywords = keywords || scriptData?.searchKeywords || [];
    const targetGenId = genId || generationId;

    if (searchKeywords.length === 0 || !targetGenId) return;

    setSearchingImages(true);
    setError("");

    try {
      const result = await composeApi.searchImages({
        generationId: targetGenId,
        keywords: searchKeywords,
        maxImages: 30,
      });

      setImageCandidates(result.candidates);

      const autoSelected = result.candidates
        .filter((img) => (img.qualityScore || 0) > 0.5)
        .slice(0, Math.min(6, result.candidates.length));

      setSelectedImages(autoSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.general);
    } finally {
      setSearchingImages(false);
    }
  };

  // Toggle image selection
  const toggleImageSelection = (image: ImageCandidate) => {
    setSelectedImages((prev) => {
      const exists = prev.find((img) => img.id === image.id);
      if (exists) return prev.filter((img) => img.id !== image.id);
      if (prev.length >= 10) return prev;
      return [...prev, image];
    });
  };

  // Step 3: Match Music
  const handleMatchMusic = async () => {
    if (!scriptData || !campaign) return;

    setMatchingMusic(true);
    setError("");

    try {
      const result = await composeApi.matchMusic({
        campaignId,
        vibe: scriptData.vibe,
        bpmRange: scriptData.suggestedBpmRange,
        minDuration: 10,
      });

      setAudioMatches(result.matches);
      if (result.matches.length > 0) {
        handleSelectAudio(result.matches[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.general);
    } finally {
      setMatchingMusic(false);
    }
  };

  // Handle audio selection and analyze for best segment
  const handleSelectAudio = async (audio: AudioMatch) => {
    setSelectedAudio(audio);
    setAudioAnalysis(null);
    setAudioStartTime(0);
    setAnalyzingAudio(true);

    try {
      const targetDuration = scriptData?.script?.totalDuration || 15;
      const analysis = await composeApi.analyzeAudioBestSegment(audio.id, targetDuration);
      setAudioAnalysis(analysis);
      // Auto-set to the suggested best segment start time
      setAudioStartTime(analysis.suggestedStartTime);
    } catch (err) {
      console.warn("Audio analysis failed, using start from 0:", err);
      // Fallback: use 0 as start time
      setAudioStartTime(0);
    } finally {
      setAnalyzingAudio(false);
    }
  };

  useEffect(() => {
    if (currentStep === 3 && audioMatches.length === 0 && scriptData) {
      handleMatchMusic();
    }
  }, [currentStep]);

  // Step 4: Start Render
  const handleStartRender = async () => {
    if (!selectedAudio || selectedImages.length < 3 || !generationId || !scriptData) {
      setError(t.compose.minImagesRequired);
      return;
    }

    setRendering(true);
    setError("");
    setRenderStatus(null);
    setOutputUrl(null);

    try {
      setRenderStatus({
        status: 'processing',
        progress: 5,
        currentStep: '이미지 다운로드 및 업로드 중...',
      });

      const proxyResult = await composeApi.proxyImages(
        generationId,
        selectedImages.map(img => ({ url: img.sourceUrl, id: img.id }))
      );

      if (proxyResult.successful < 3) {
        setError(`이미지 업로드 실패: ${proxyResult.failed}개 실패. 최소 3개의 이미지가 필요합니다.`);
        setRendering(false);
        return;
      }

      const imageUrlMap = new Map(
        proxyResult.results
          .filter(r => r.success)
          .map(r => [r.id, r.minioUrl])
      );

      const proxyedImages = selectedImages
        .filter(img => imageUrlMap.has(img.id))
        .map((img, idx) => ({
          url: imageUrlMap.get(img.id)!,
          order: idx,
        }));

      setRenderStatus({
        status: 'processing',
        progress: 10,
        currentStep: '영상 렌더링 시작 중...',
      });

      const renderResult = await composeApi.startRender({
        generationId,
        campaignId,
        audioAssetId: selectedAudio.id,
        images: proxyedImages,
        script: { lines: scriptData.script.lines },
        effectPreset,
        aspectRatio,
        targetDuration: 0,
        vibe: scriptData.vibe,
        // Audio timing control
        audioStartTime,  // Start time from best segment analysis or manual adjustment
        // Pass compose data for variations to use
        prompt,  // User's original video concept prompt
        searchKeywords: editableKeywords,  // User's keywords (includes AI-suggested merged)
        tiktokSEO: scriptData.tiktokSEO,
      });

      const finalStatus = await composeApi.waitForRender(
        renderResult.generationId,
        (status) => setRenderStatus(status)
      );

      if (finalStatus.status === "completed" && finalStatus.outputUrl) {
        setOutputUrl(finalStatus.outputUrl);
      } else if (finalStatus.status === "failed") {
        setError(finalStatus.error || t.compose.renderFailed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.general);
    } finally {
      setRendering(false);
    }
  };

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 1: return scriptData !== null;
      case 2: return selectedImages.length >= 3;
      case 3: return selectedAudio !== null;
      case 4: return outputUrl !== null;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setPrompt("");
    setScriptData(null);
    setImageCandidates([]);
    setSelectedImages([]);
    setAudioMatches([]);
    setSelectedAudio(null);
    setRenderStatus(null);
    setOutputUrl(null);
    setError("");
  };

  const getVibeColor = (vibe: string) => {
    switch (vibe) {
      case "Exciting": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "Emotional": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Pop": return "bg-pink-500/20 text-pink-400 border-pink-500/30";
      case "Minimal": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default: return "bg-primary/20 text-primary border-primary/30";
    }
  };

  // Get displayed images based on source mode
  const getDisplayedImages = () => {
    switch (imageSourceMode) {
      case "assets_only":
        return assetImages;
      case "search_only":
        return imageCandidates;
      case "mixed":
      default:
        return [...assetImages, ...imageCandidates];
    }
  };

  const displayedImages = getDisplayedImages();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="space-y-6 pb-8">
      {/* Progress Steps - Minimal horizontal stepper */}
      <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = step.step === currentStep;
          const isComplete = step.step < currentStep;

          return (
            <button
              key={step.step}
              onClick={() => step.step <= currentStep && setCurrentStep(step.step)}
              disabled={step.step > currentStep}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : isComplete
                  ? "text-foreground hover:bg-background/50"
                  : "text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              <span className="hidden sm:inline">{language === "ko" ? step.label : step.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive flex items-center gap-3">
          <X className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError("")}
            className="ml-auto h-7 text-destructive hover:text-destructive"
          >
            닫기
          </Button>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Script Generation */}
          {currentStep === 1 && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{language === "ko" ? "스크립트 생성" : "Script Generation"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {language === "ko" ? "AI가 영상 컨셉에 맞는 스크립트와 분위기를 분석합니다" : "AI analyzes the script and mood for your video concept"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ko" ? "영상 컨셉 프롬프트" : "Video Concept Prompt"}</Label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={language === "ko" ? "예: 신곡 발매 기념 팬들에게 감사의 메시지를 전하는 따뜻한 영상..." : "e.g., A heartfelt video thanking fans for the new song release..."}
                    rows={4}
                    className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ko" ? "화면 비율" : "Aspect Ratio"}</Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS.map((ar) => (
                          <SelectItem key={ar.value} value={ar.value}>
                            {ar.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ko" ? "영상 길이" : "Duration"}</Label>
                    <div className="h-11 px-4 flex items-center bg-muted/50 rounded-lg border border-input">
                      <span className="text-sm text-muted-foreground">{language === "ko" ? "자동 (10-30초)" : "Auto (10-30s)"}</span>
                    </div>
                  </div>
                </div>

                {/* Keywords Section */}
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{language === "ko" ? "이미지 검색 키워드" : "Image Search Keywords"}</Label>
                    <span className="text-xs text-muted-foreground">{editableKeywords.length}{language === "ko" ? "개" : ""}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editableKeywords.map((kw, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className={`px-3 py-1 text-xs flex items-center gap-1.5 ${
                          selectedSearchKeywords.has(kw)
                            ? "bg-primary/10 border-primary/30"
                            : "bg-background"
                        }`}
                      >
                        {selectedSearchKeywords.has(kw) && <Check className="w-3 h-3 text-primary" />}
                        {kw}
                        <button
                          onClick={() => {
                            setEditableKeywords((prev) => prev.filter((_, i) => i !== idx));
                            // Also remove from selected keywords
                            setSelectedSearchKeywords((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(kw);
                              return newSet;
                            });
                          }}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    {editableKeywords.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        {language === "ko" ? "키워드를 추가하면 더 정확한 이미지를 검색할 수 있습니다" : "Add keywords for more accurate image searches"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder={language === "ko" ? "키워드 입력 후 Enter..." : "Enter keyword and press Enter..."}
                      className="h-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newKeyword.trim()) {
                          e.preventDefault();
                          const kw = newKeyword.trim();
                          setEditableKeywords((prev) => [...prev, kw]);
                          // Auto-select user-added keywords for search
                          setSelectedSearchKeywords((prev) => new Set([...prev, kw]));
                          setNewKeyword("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        if (newKeyword.trim()) {
                          const kw = newKeyword.trim();
                          setEditableKeywords((prev) => [...prev, kw]);
                          // Auto-select user-added keywords for search
                          setSelectedSearchKeywords((prev) => new Set([...prev, kw]));
                          setNewKeyword("");
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleGenerateScript}
                  disabled={generatingScript || !prompt.trim()}
                  className="w-full h-12"
                  size="lg"
                >
                  {generatingScript ? (
                    <>
                      <Spinner className="w-5 h-5 mr-2" />
                      {language === "ko" ? "AI가 스크립트를 생성하고 있습니다..." : "AI is generating script..."}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      {language === "ko" ? "스크립트 생성하기" : "Generate Script"}
                    </>
                  )}
                </Button>

                {/* Script Preview */}
                {scriptData && (
                  <div className="p-4 bg-muted/50 border border-border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-primary" />
                        <h3 className="font-medium">{language === "ko" ? "스크립트 생성 완료" : "Script Generated"}</h3>
                      </div>
                      <Badge variant="secondary">
                        {scriptData.vibe}
                      </Badge>
                    </div>

                    <ScriptTimeline
                      lines={scriptData.script.lines}
                      totalDuration={scriptData.script.totalDuration}
                      showHookIndicator={true}
                    />

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {scriptData.suggestedBpmRange.min}-{scriptData.suggestedBpmRange.max}
                        </p>
                        <p className="text-xs text-muted-foreground">{language === "ko" ? "BPM 범위" : "BPM Range"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {scriptData.script.totalDuration}{language === "ko" ? "초" : "s"}
                        </p>
                        <p className="text-xs text-muted-foreground">{language === "ko" ? "예상 길이" : "Duration"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {scriptData.script.lines.length}
                        </p>
                        <p className="text-xs text-muted-foreground">{language === "ko" ? "씬 수" : "Scenes"}</p>
                      </div>
                    </div>

                    {scriptData.tiktokSEO && (
                      <div className="pt-4 border-t">
                        <TikTokSEOPreview
                          seo={scriptData.tiktokSEO}
                          editable={true}
                          onUpdate={(updatedSEO) => {
                            setScriptData((prev) => prev ? { ...prev, tiktokSEO: updatedSEO } : null);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Image Selection */}
          {currentStep === 2 && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{language === "ko" ? "이미지 선택" : "Select Images"}</h2>
                      <p className="text-sm text-muted-foreground">
                        {language === "ko" ? "영상에 사용할 이미지를 선택하세요 (최소 3장)" : "Select images for your video (minimum 3)"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {selectedImages.length}/10 {language === "ko" ? "선택됨" : "selected"}
                  </Badge>
                </div>

                {/* Image Source Mode Selection */}
                <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
                  <button
                    onClick={() => setImageSourceMode("mixed")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      imageSourceMode === "mixed"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{language === "ko" ? "혼합" : "Mixed"}</span>
                    <Badge variant="secondary" className="text-xs px-1.5">
                      {assetImages.length + imageCandidates.length}
                    </Badge>
                  </button>
                  <button
                    onClick={() => setImageSourceMode("assets_only")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      imageSourceMode === "assets_only"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>{language === "ko" ? "에셋만" : "Assets Only"}</span>
                    <Badge variant="secondary" className="text-xs px-1.5">
                      {assetImages.length}
                    </Badge>
                  </button>
                  <button
                    onClick={() => setImageSourceMode("search_only")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      imageSourceMode === "search_only"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>{language === "ko" ? "검색만" : "Search Only"}</span>
                    <Badge variant="secondary" className="text-xs px-1.5">
                      {imageCandidates.length}
                    </Badge>
                  </button>
                </div>

                {/* Keyword Search - Only show when search is relevant */}
                {imageSourceMode !== "assets_only" && (
                  <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">
                          {language === "ko" ? "검색 키워드 선택" : "Select Search Keywords"}
                        </Label>
                        <Badge variant="outline" className="text-xs">
                          {selectedSearchKeywords.size}/{editableKeywords.length} {language === "ko" ? "선택됨" : "selected"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const selectedArray = Array.from(selectedSearchKeywords);
                          if (selectedArray.length > 0) {
                            handleSearchImages(selectedArray);
                          }
                        }}
                        disabled={searchingImages || selectedSearchKeywords.size === 0}
                      >
                        <Search className="w-4 h-4 mr-2" />
                        {language === "ko" ? "다시 검색" : "Search Again"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko"
                        ? "클릭하여 검색에 포함할 키워드를 선택하세요. 선택된 키워드만 이미지 검색에 사용됩니다."
                        : "Click to select keywords for search. Only selected keywords will be used for image search."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {editableKeywords.map((kw, idx) => {
                        const isSelected = selectedSearchKeywords.has(kw);
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedSearchKeywords((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(kw)) {
                                  newSet.delete(kw);
                                } else {
                                  newSet.add(kw);
                                }
                                return newSet;
                              });
                            }}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-muted-foreground"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                            {kw}
                          </button>
                        );
                      })}
                    </div>
                    {selectedSearchKeywords.size === 0 && (
                      <p className="text-xs text-amber-500">
                        {language === "ko"
                          ? "⚠️ 검색할 키워드를 최소 1개 선택하세요"
                          : "⚠️ Select at least 1 keyword to search"}
                      </p>
                    )}
                  </div>
                )}

                {/* Asset upload hint when no assets */}
                {imageSourceMode === "assets_only" && assetImages.length === 0 && (
                  <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {language === "ko" ? "업로드된 에셋 이미지가 없습니다" : "No uploaded asset images"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === "ko" ? "에셋 페이지에서 이미지를 먼저 업로드하세요" : "Upload images from the Assets page first"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/campaigns/${campaignId}`}>
                          {language === "ko" ? "에셋 업로드" : "Upload Assets"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                {searchingImages || loadingAssets ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Spinner className="w-10 h-10 mb-4" />
                    <p className="text-muted-foreground">
                      {loadingAssets
                        ? (language === "ko" ? "에셋 이미지를 불러오고 있습니다..." : "Loading asset images...")
                        : (language === "ko" ? "이미지를 검색하고 있습니다..." : "Searching images...")}
                    </p>
                  </div>
                ) : displayedImages.length === 0 ? (
                  <div className="text-center py-16">
                    <ImageIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {imageSourceMode === "assets_only"
                        ? (language === "ko" ? "에셋 이미지가 없습니다" : "No asset images")
                        : (language === "ko" ? "검색 결과가 없습니다" : "No results found")}
                    </p>
                    {imageSourceMode !== "assets_only" && (
                      <Button onClick={() => handleSearchImages()} variant="outline">
                        <Search className="w-4 h-4 mr-2" />
                        {language === "ko" ? "다시 검색" : "Search Again"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {displayedImages.map((image) => {
                        const isAsset = image.id.startsWith("asset-");
                        const isSelected = selectedImages.some((img) => img.id === image.id);
                        const selectionIndex = selectedImages.findIndex((img) => img.id === image.id);
                        return (
                          <button
                            key={image.id}
                            onClick={() => toggleImageSelection(image)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                              isSelected
                                ? "border-primary ring-2 ring-primary/30 scale-[0.98]"
                                : "border-transparent hover:border-muted-foreground/50"
                            }`}
                          >
                            <img
                              src={image.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            <div className={`absolute inset-0 transition-all ${
                              isSelected ? "bg-primary/20" : "bg-black/0 group-hover:bg-black/20"
                            }`} />
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg">
                                {selectionIndex + 1}
                              </div>
                            )}
                            {/* Asset indicator badge */}
                            {isAsset && (
                              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-blue-500/90 rounded text-white text-[10px] font-medium flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" />
                                {language === "ko" ? "에셋" : "Asset"}
                              </div>
                            )}
                            {!isAsset && imageSourceMode === "mixed" && (
                              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-green-500/90 rounded text-white text-[10px] font-medium flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {language === "ko" ? "검색" : "Search"}
                              </div>
                            )}
                            {image.qualityScore && (
                              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                                <div className="flex items-center justify-between text-white text-xs">
                                  <span>{image.width}×{image.height}</span>
                                  <span className="font-medium">{(image.qualityScore * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedImages.length < 3 && (
                      <div className="p-3 bg-muted border border-border rounded-lg text-muted-foreground text-sm text-center">
                        {language === "ko" ? `최소 3장의 이미지를 선택해주세요 (현재 ${selectedImages.length}장)` : `Please select at least 3 images (currently ${selectedImages.length})`}
                      </div>
                    )}

                    {selectedImages.length >= 3 && scriptData?.script?.lines && (
                      <div className="pt-6 border-t">
                        <ImageTextPreview
                          images={selectedImages}
                          scriptLines={scriptData.script.lines}
                          totalDuration={scriptData.script.totalDuration}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Music Selection */}
          {currentStep === 3 && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Music className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{language === "ko" ? "음악 선택" : "Select Music"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {language === "ko" ? `${scriptData?.vibe} 분위기에 맞는 음악을 선택하세요` : `Select music that matches the ${scriptData?.vibe} vibe`}
                    </p>
                  </div>
                </div>

                {matchingMusic ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Spinner className="w-10 h-10 mb-4" />
                    <p className="text-muted-foreground">{language === "ko" ? "음악을 분석하고 있습니다..." : "Analyzing music..."}</p>
                  </div>
                ) : audioMatches.length === 0 ? (
                  <div className="text-center py-16">
                    <Music className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">{language === "ko" ? "사용 가능한 음악이 없습니다" : "No music available"}</p>
                    <Button asChild variant="outline">
                      <Link href={`/campaigns/${campaignId}`}>
                        {language === "ko" ? "음악 업로드하러 가기" : "Upload Music"}
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {audioMatches.map((audio) => {
                      const isSelected = selectedAudio?.id === audio.id;
                      return (
                        <button
                          key={audio.id}
                          onClick={() => handleSelectAudio(audio)}
                          className={`w-full p-4 rounded-lg border-2 flex items-center gap-4 transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground hover:bg-muted/30"
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isSelected ? <Check className="w-6 h-6" /> : <Music className="w-6 h-6" />}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium">{audio.filename}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span>{audio.bpm ? `${audio.bpm} BPM` : "~100 BPM"}</span>
                              <span>{audio.duration.toFixed(0)}초</span>
                              {audio.vibe && <Badge variant="secondary" className="text-xs">{audio.vibe}</Badge>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-4 h-4 text-muted-foreground" />
                              <span className="text-lg font-bold">{(audio.matchScore * 100).toFixed(0)}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{language === "ko" ? "매칭률" : "Match"}</p>
                          </div>
                          <a
                            href={audio.s3Url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2.5 hover:bg-muted rounded-lg transition-colors"
                          >
                            <Volume2 className="w-5 h-5 text-muted-foreground" />
                          </a>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Audio Start Time Control */}
                {selectedAudio && (
                  <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        {language === "ko" ? "음원 시작 위치" : "Audio Start Position"}
                      </Label>
                      {analyzingAudio ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Spinner className="w-3 h-3" />
                          {language === "ko" ? "최적 구간 분석 중..." : "Analyzing best segment..."}
                        </div>
                      ) : audioAnalysis?.analyzed ? (
                        <Badge variant="secondary" className="text-xs">
                          {language === "ko" ? "AI 분석 완료" : "AI Analyzed"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {language === "ko" ? "기본값" : "Default"}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, selectedAudio.duration - (scriptData?.script?.totalDuration || 15))}
                          step={0.5}
                          value={audioStartTime}
                          onChange={(e) => setAudioStartTime(parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                          disabled={analyzingAudio}
                        />
                        <div className="w-20 text-right">
                          <span className="text-sm font-mono font-medium">
                            {audioStartTime.toFixed(1)}s
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>0s</span>
                        <span>{selectedAudio.duration.toFixed(0)}s</span>
                      </div>
                    </div>

                    {audioAnalysis && (
                      <div className="flex items-center gap-2 text-xs">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setAudioStartTime(audioAnalysis.suggestedStartTime)}
                          disabled={audioStartTime === audioAnalysis.suggestedStartTime}
                        >
                          <Wand2 className="w-3 h-3 mr-1" />
                          {language === "ko" ? "AI 추천 위치로" : "Use AI Suggestion"} ({audioAnalysis.suggestedStartTime.toFixed(1)}s)
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setAudioStartTime(0)}
                          disabled={audioStartTime === 0}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          {language === "ko" ? "처음부터" : "From Start"}
                        </Button>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {language === "ko"
                        ? `영상에서 음원이 ${audioStartTime.toFixed(1)}초 지점부터 재생됩니다. AI가 가장 에너지 넘치는 구간을 자동으로 추천합니다.`
                        : `Audio will play from ${audioStartTime.toFixed(1)}s in the video. AI automatically recommends the highest energy section.`}
                    </p>
                  </div>
                )}

                {selectedAudio && scriptData?.script?.lines && (
                  <div className="pt-6 border-t">
                    <AudioStructurePreview
                      audio={selectedAudio}
                      scriptLines={scriptData.script.lines}
                      totalDuration={scriptData.script.totalDuration}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Render */}
          {currentStep === 4 && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Film className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{language === "ko" ? "영상 렌더링" : "Video Rendering"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {language === "ko" ? "설정을 확인하고 렌더링을 시작하세요" : "Review settings and start rendering"}
                    </p>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-2xl font-bold">{selectedImages.length}</p>
                    <p className="text-xs text-muted-foreground">{language === "ko" ? "이미지" : "Images"}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <Music className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-2xl font-bold">{selectedAudio?.bpm || "Auto"}</p>
                    <p className="text-xs text-muted-foreground">BPM</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <Film className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-2xl font-bold">{aspectRatio}</p>
                    <p className="text-xs text-muted-foreground">{language === "ko" ? "화면비율" : "Ratio"}</p>
                  </div>
                </div>

                {/* Effect Selection */}
                <div className="space-y-2">
                  <Label>{language === "ko" ? "이펙트 프리셋" : "Effect Preset"}</Label>
                  <Select value={effectPreset} onValueChange={setEffectPreset}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EFFECT_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{preset.label}</span>
                            <span className="text-muted-foreground text-xs">- {preset.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Render Progress */}
                {renderStatus && (
                  <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{language === "ko" ? "렌더링 진행 중..." : "Rendering..."}</span>
                      <span className="text-sm font-bold">{renderStatus.progress}%</span>
                    </div>
                    <Progress value={renderStatus.progress} className="h-2" />
                    {renderStatus.currentStep && (
                      <p className="text-sm text-muted-foreground">{renderStatus.currentStep}</p>
                    )}
                  </div>
                )}

                {/* Output Success */}
                {outputUrl && (
                  <div className="p-6 bg-muted/50 border border-border rounded-lg text-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{language === "ko" ? "렌더링 완료!" : "Rendering Complete!"}</h3>
                    <p className="text-sm text-muted-foreground mb-6">{language === "ko" ? "영상이 성공적으로 생성되었습니다" : "Video generated successfully"}</p>
                    <div className="flex items-center justify-center gap-3">
                      <Button asChild>
                        <a href={outputUrl} target="_blank" rel="noopener noreferrer">
                          <Play className="w-4 h-4 mr-2" />
                          {language === "ko" ? "영상 보기" : "Watch Video"}
                        </a>
                      </Button>
                      <Button variant="outline" asChild>
                        <a href={outputUrl} download>
                          <Download className="w-4 h-4 mr-2" />
                          {language === "ko" ? "다운로드" : "Download"}
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Render Button */}
                {!outputUrl && (
                  <Button
                    onClick={handleStartRender}
                    disabled={rendering || !selectedAudio || selectedImages.length < 3}
                    className="w-full h-12"
                    size="lg"
                  >
                    {rendering ? (
                      <>
                        <Spinner className="w-5 h-5 mr-2" />
                        {language === "ko" ? "렌더링 중..." : "Rendering..."}
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        {language === "ko" ? "렌더링 시작" : "Start Rendering"}
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Current Selection Summary */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-sm">{language === "ko" ? "현재 진행 상황" : "Progress"}</h3>

              <div className="space-y-3">
                {/* Script Status */}
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  scriptData ? "bg-muted" : currentStep === 1 ? "bg-primary/10" : "bg-muted/30"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    scriptData ? "bg-primary text-primary-foreground" : currentStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {scriptData ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{language === "ko" ? "스크립트" : "Script"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {scriptData
                        ? `${scriptData.vibe} · ${scriptData.script.totalDuration}${language === "ko" ? "초" : "s"}`
                        : (language === "ko" ? "대기 중" : "Pending")}
                    </p>
                  </div>
                </div>

                {/* Images Status */}
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  selectedImages.length >= 3 ? "bg-muted" : currentStep === 2 ? "bg-primary/10" : "bg-muted/30"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedImages.length >= 3 ? "bg-primary text-primary-foreground" : currentStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {selectedImages.length >= 3 ? <Check className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{language === "ko" ? "이미지" : "Images"}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedImages.length > 0
                        ? (() => {
                            const assetCount = selectedImages.filter(img => img.id.startsWith("asset-")).length;
                            const searchCount = selectedImages.length - assetCount;
                            if (assetCount > 0 && searchCount > 0) {
                              return language === "ko"
                                ? `에셋 ${assetCount}장 + 검색 ${searchCount}장`
                                : `${assetCount} assets + ${searchCount} search`;
                            } else if (assetCount > 0) {
                              return language === "ko" ? `에셋 ${assetCount}장` : `${assetCount} assets`;
                            } else {
                              return language === "ko" ? `검색 ${searchCount}장` : `${searchCount} search`;
                            }
                          })()
                        : (language === "ko" ? "대기 중" : "Pending")}
                    </p>
                  </div>
                </div>

                {/* Music Status */}
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  selectedAudio ? "bg-muted" : currentStep === 3 ? "bg-primary/10" : "bg-muted/30"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedAudio ? "bg-primary text-primary-foreground" : currentStep === 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {selectedAudio ? <Check className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{language === "ko" ? "음악" : "Music"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedAudio ? selectedAudio.filename : (language === "ko" ? "대기 중" : "Pending")}
                    </p>
                  </div>
                </div>

                {/* Render Status */}
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  outputUrl ? "bg-muted" : currentStep === 4 ? "bg-primary/10" : "bg-muted/30"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    outputUrl ? "bg-primary text-primary-foreground" : currentStep === 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {outputUrl ? <Check className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{language === "ko" ? "렌더링" : "Render"}</p>
                    <p className="text-xs text-muted-foreground">
                      {outputUrl
                        ? (language === "ko" ? "완료" : "Complete")
                        : (language === "ko" ? "대기 중" : "Pending")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trend Recommendations - Step 1 only */}
          {currentStep === 1 && (
            <TrendRecommendationsCard
              compact
              onApplyPrompt={(suggestedPrompt) => {
                setPrompt((prev) => prev ? `${prev}\n\n${suggestedPrompt}` : suggestedPrompt);
              }}
              onApplyHashtags={(hashtags) => {
                const newKeywords = hashtags.filter(
                  (tag) => !editableKeywords.some((existing) => existing.toLowerCase() === tag.toLowerCase())
                );
                setEditableKeywords((prev) => [...prev, ...newKeywords]);
                // Auto-select new hashtags for search
                setSelectedSearchKeywords((prev) => new Set([...prev, ...newKeywords]));
              }}
            />
          )}

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-sm">{language === "ko" ? "빠른 작업" : "Quick Actions"}</h3>

              {outputUrl ? (
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start h-11" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {language === "ko" ? "새로 시작하기" : "Start Over"}
                  </Button>
                  <Button className="w-full justify-start h-11" asChild>
                    <Link href={`/campaigns/${campaignId}/publish`}>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {language === "ko" ? "퍼블리싱으로 이동" : "Go to Publish"}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start h-11"
                    onClick={handleBack}
                    disabled={currentStep === 1}
                  >
                    {language === "ko" ? "이전 단계" : "Previous Step"}
                  </Button>

                  {/* Next step button with more info */}
                  <div className="space-y-2">
                    <Button
                      className="w-full h-12"
                      onClick={handleNext}
                      disabled={!canProceed() || currentStep === 4}
                    >
                      <span className="flex-1 text-left">
                        {currentStep === 1 && (language === "ko" ? "다음: 이미지 선택" : "Next: Select Images")}
                        {currentStep === 2 && (language === "ko" ? "다음: 음악 선택" : "Next: Select Music")}
                        {currentStep === 3 && (language === "ko" ? "다음: 렌더링" : "Next: Render")}
                        {currentStep === 4 && (language === "ko" ? "완료" : "Finish")}
                      </span>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                    {!canProceed() && currentStep < 4 && (
                      <p className="text-xs text-muted-foreground text-center">
                        {currentStep === 1 && (language === "ko" ? "스크립트를 먼저 생성하세요" : "Generate a script first")}
                        {currentStep === 2 && (language === "ko" ? "최소 3개의 이미지를 선택하세요" : "Select at least 3 images")}
                        {currentStep === 3 && (language === "ko" ? "음악을 선택하세요" : "Select a music track")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
