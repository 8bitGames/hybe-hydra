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
  VIBE_PRESETS,
  EFFECT_PRESETS,
  ASPECT_RATIOS,
  VibeType,
} from "@/lib/compose-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Music,
  Play,
  Check,
  X,
  Upload,
  Search,
  Volume2,
  Download,
  RotateCcw,
  FileText,
  Wand2,
  Clock,
  Zap,
  Plus,
  Trash2,
  ExternalLink,
  Globe,
} from "lucide-react";
import { ScriptTimeline } from "@/components/features/script-timeline";
import { ImageTextPreview } from "@/components/features/image-text-preview";
import { AudioStructurePreview } from "@/components/features/audio-structure-preview";
import { TrendRecommendationsCard } from "@/components/features/trend-analysis";
import { TikTokSEOPreview } from "@/components/features/tiktok-seo-preview";

// Wizard Steps
type WizardStep = 1 | 2 | 3 | 4;

const STEP_TITLES = {
  1: { key: "stepScript" as const, icon: FileText },
  2: { key: "stepImages" as const, icon: ImageIcon },
  3: { key: "stepMusic" as const, icon: Music },
  4: { key: "stepRender" as const, icon: Play },
};

export default function ComposePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
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

  // Step 3: Music state
  const [matchingMusic, setMatchingMusic] = useState(false);
  const [audioMatches, setAudioMatches] = useState<AudioMatch[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<AudioMatch | null>(null);
  const [audioAssets, setAudioAssets] = useState<Asset[]>([]);

  // Step 4: Render state
  const [effectPreset, setEffectPreset] = useState("zoom_beat");
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Keyword editing state
  const [editableKeywords, setEditableKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  // Load campaign data
  const loadData = useCallback(async () => {
    try {
      const [campaignResult, audioResult] = await Promise.all([
        campaignsApi.getById(campaignId),
        assetsApi.getByCampaign(campaignId, { type: "audio", page_size: 50 }),
      ]);

      if (campaignResult.error) {
        router.push("/campaigns");
        return;
      }

      if (campaignResult.data) {
        setCampaign(campaignResult.data);
      }

      if (audioResult.data) {
        setAudioAssets(audioResult.data.items);
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

  // Load prompt from Bridge on mount (if coming from Bridge page)
  useEffect(() => {
    const bridgeData = loadBridgePrompt(campaignId);
    if (bridgeData && bridgeData.transformedPrompt.status === "success") {
      // Pre-fill prompt with transformed prompt
      setPrompt(bridgeData.transformedPrompt.veo_prompt || bridgeData.originalPrompt);
      // Pre-fill aspect ratio if available
      if (bridgeData.transformedPrompt.technical_settings?.aspect_ratio) {
        setAspectRatio(bridgeData.transformedPrompt.technical_settings.aspect_ratio);
      }
      // Pre-fill trend keywords
      if (bridgeData.selectedTrends && bridgeData.selectedTrends.length > 0) {
        setEditableKeywords(bridgeData.selectedTrends);
      }
      // Clear the stored prompt after loading
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
      // Fetch current trends automatically to incorporate into script generation
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
        // Continue without trend context if fetch fails
        console.warn("Failed to fetch trends, continuing without:", trendErr);
      }

      const result = await composeApi.generateScript({
        campaignId,
        artistName: campaign.artist_stage_name || campaign.artist_name || "Artist",
        artistContext: undefined,
        trendKeywords: editableKeywords, // Pass user-provided keywords
        trendContext, // Pass current trends for AI to incorporate
        userPrompt: prompt.trim(),
        targetDuration: 0,  // Auto-calculate based on vibe (10-30s)
      });

      setScriptData(result);

      // Merge user keywords with AI-generated keywords (user keywords first)
      const mergedKeywords = [
        ...editableKeywords,
        ...(result.searchKeywords || []).filter(
          (kw) => !editableKeywords.some(
            (existing) => existing.toLowerCase() === kw.toLowerCase()
          )
        ),
      ];
      setEditableKeywords(mergedKeywords);

      // Create a generation ID for tracking
      const newGenerationId = `compose-${Date.now()}`;
      setGenerationId(newGenerationId);

      // Auto-advance to images step
      setCurrentStep(2);

      // Auto-search images with merged keywords
      await handleSearchImages(mergedKeywords, newGenerationId);
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

    if (searchKeywords.length === 0 || !targetGenId) {
      return;
    }

    setSearchingImages(true);
    setError("");

    try {
      const result = await composeApi.searchImages({
        generationId: targetGenId,
        keywords: searchKeywords,
        maxImages: 30,  // Get more candidates, quality score handles sorting
      });

      setImageCandidates(result.candidates);

      // Auto-select top quality images
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
      if (exists) {
        return prev.filter((img) => img.id !== image.id);
      }
      if (prev.length >= 10) {
        return prev;
      }
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
        minDuration: 10,  // Minimum TikTok duration
      });

      setAudioMatches(result.matches);

      // Auto-select best match
      if (result.matches.length > 0) {
        setSelectedAudio(result.matches[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.general);
    } finally {
      setMatchingMusic(false);
    }
  };

  // Effect for auto-matching music when entering step 3
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
      // First, proxy images to MinIO to avoid hotlink protection issues
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

      // Create image URL map from proxy results
      const imageUrlMap = new Map(
        proxyResult.results
          .filter(r => r.success)
          .map(r => [r.id, r.minioUrl])
      );

      // Use MinIO URLs instead of external URLs
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
        script: {
          lines: scriptData.script.lines,
        },
        effectPreset,
        aspectRatio,
        targetDuration: 0,  // Auto-calculate based on vibe (10-30s)
        vibe: scriptData.vibe,
      });

      // Poll for status
      const finalStatus = await composeApi.waitForRender(
        renderResult.generationId,
        (status) => {
          setRenderStatus(status);
        }
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
      case 1:
        return scriptData !== null;
      case 2:
        return selectedImages.length >= 3;
      case 3:
        return selectedAudio !== null;
      case 4:
        return outputUrl !== null;
      default:
        return false;
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

  // Get vibe color
  const getVibeColor = (vibe: string) => {
    switch (vibe) {
      case "Exciting":
        return "bg-red-500/20 text-red-500 border-red-500/30";
      case "Emotional":
        return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      case "Pop":
        return "bg-pink-500/20 text-pink-500 border-pink-500/30";
      case "Minimal":
        return "bg-gray-500/20 text-gray-500 border-gray-500/30";
      default:
        return "bg-primary/20 text-primary border-primary/30";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-12 w-12" />
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="max-w-6xl mx-auto">
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
        <span className="text-foreground">Compose</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            {t.compose.title}
          </h1>
          <p className="text-muted-foreground mt-1">{t.compose.subtitle}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/campaigns/${campaignId}/generate`}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Generate
          </Link>
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 px-4">
        {([1, 2, 3, 4] as WizardStep[]).map((step) => {
          const StepIcon = STEP_TITLES[step].icon;
          const isActive = step === currentStep;
          const isComplete = step < currentStep;
          const isDisabled = step > currentStep && !canProceed();

          return (
            <div key={step} className="flex items-center flex-1">
              <button
                onClick={() => step <= currentStep && setCurrentStep(step)}
                disabled={step > currentStep}
                className={`flex items-center gap-3 transition-all ${
                  isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : isComplete
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="text-left">
                  <p
                    className={`text-xs ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {t.compose[`step${step}` as keyof typeof t.compose]}
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t.compose[STEP_TITLES[step].key]}
                  </p>
                </div>
              </button>
              {step < 4 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors ${
                    step < currentStep ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive flex items-center gap-2">
          <X className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step Content */}
      <Card className="mb-6">
        <CardContent className="p-6">
          {/* Step 1: Script Generation */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t.compose.scriptGeneration}</h2>
                  <p className="text-sm text-muted-foreground">
                    AI가 영상 컨셉에 맞는 스크립트와 분위기를 분석합니다
                  </p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">{t.compose.enterPrompt}</Label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t.compose.promptPlaceholder}
                  rows={4}
                  className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div>
                <Label className="mb-2 block">{t.compose.selectAspectRatio}</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
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
                <p className="text-xs text-muted-foreground mt-1">
                  영상 길이는 분위기에 따라 자동 계산됩니다 (10-30초)
                </p>
              </div>

              {/* AI Trend Recommendations */}
              <TrendRecommendationsCard
                compact
                onApplyPrompt={(suggestedPrompt) => {
                  setPrompt((prev) => prev ? `${prev}\n\n${suggestedPrompt}` : suggestedPrompt);
                }}
                onApplyHashtags={(hashtags) => {
                  setEditableKeywords((prev) => {
                    const newKeywords = hashtags.filter(
                      (tag) => !prev.some((existing) => existing.toLowerCase() === tag.toLowerCase())
                    );
                    return [...prev, ...newKeywords];
                  });
                }}
              />

              {/* Search Keywords Input */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label className="text-sm font-medium">이미지 검색 키워드</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      검색에 사용할 키워드를 미리 설정하세요 (스크립트 생성 시 추가 키워드가 자동으로 생성됩니다)
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {editableKeywords.map((kw, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs pr-1 flex items-center gap-1"
                    >
                      {kw}
                      <button
                        onClick={() => {
                          setEditableKeywords((prev) =>
                            prev.filter((_, i) => i !== idx)
                          );
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {editableKeywords.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      아직 키워드가 없습니다. 아래에서 추가하세요.
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="e.g., Carly Pearce concert, country music live, Nashville stage..."
                    className="h-9 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newKeyword.trim()) {
                        e.preventDefault();
                        setEditableKeywords((prev) => [
                          ...prev,
                          newKeyword.trim(),
                        ]);
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
                        setEditableKeywords((prev) => [
                          ...prev,
                          newKeyword.trim(),
                        ]);
                        setNewKeyword("");
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    추가
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleGenerateScript}
                disabled={generatingScript || !prompt.trim()}
                className="w-full"
                size="lg"
              >
                {generatingScript ? (
                  <>
                    <Spinner className="w-5 h-5 mr-2" />
                    {t.compose.generatingScript}
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    {t.compose.generateScript}
                  </>
                )}
              </Button>

              {/* Script Preview */}
              {scriptData && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{t.compose.scriptPreview}</h3>
                    <Badge className={getVibeColor(scriptData.vibe)}>
                      {scriptData.vibe}
                    </Badge>
                  </div>

                  {/* Script Timeline Visualization */}
                  <ScriptTimeline
                    lines={scriptData.script.lines}
                    totalDuration={scriptData.script.totalDuration}
                    showHookIndicator={true}
                  />

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">{t.compose.suggestedBpm}</p>
                      <p className="font-medium">
                        {scriptData.suggestedBpmRange.min} - {scriptData.suggestedBpmRange.max} BPM
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.compose.totalDuration}</p>
                      <p className="font-medium">{scriptData.script.totalDuration}초</p>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">
                          {t.compose.searchKeywords}
                        </p>
                        {scriptData.groundingInfo && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Globe className="w-3 h-3" />
                            Google Grounding
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {editableKeywords.map((kw, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs pr-1 flex items-center gap-1"
                          >
                            {kw}
                            <button
                              onClick={() => {
                                setEditableKeywords((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                );
                              }}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          placeholder="키워드 추가..."
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newKeyword.trim()) {
                              setEditableKeywords((prev) => [
                                ...prev,
                                newKeyword.trim(),
                              ]);
                              setNewKeyword("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            if (newKeyword.trim()) {
                              setEditableKeywords((prev) => [
                                ...prev,
                                newKeyword.trim(),
                              ]);
                              setNewKeyword("");
                            }
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Grounding Sources */}
                    {scriptData.groundingInfo?.sources &&
                      scriptData.groundingInfo.sources.length > 0 && (
                        <div className="col-span-2 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">
                            참고 소스
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {scriptData.groundingInfo.sources.slice(0, 5).map((source, idx) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {source.title.slice(0, 30)}...
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* TikTok SEO Preview */}
                    {scriptData.tiktokSEO && (
                      <div className="col-span-2 pt-4 border-t border-border">
                        <TikTokSEOPreview
                          seo={scriptData.tiktokSEO}
                          editable={true}
                          onUpdate={(updatedSEO) => {
                            setScriptData((prev) => prev ? {
                              ...prev,
                              tiktokSEO: updatedSEO
                            } : null);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Image Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{t.compose.imageSearch}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t.compose.selectImages}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">
                  {t.compose.selectedImages}: {selectedImages.length}/10
                </Badge>
              </div>

              {/* Keyword Editor for Step 2 */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">검색 키워드</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSearchImages(editableKeywords)}
                    disabled={searchingImages || editableKeywords.length === 0}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    키워드로 다시 검색
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {editableKeywords.map((kw, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs pr-1 flex items-center gap-1"
                    >
                      {kw}
                      <button
                        onClick={() => {
                          setEditableKeywords((prev) =>
                            prev.filter((_, i) => i !== idx)
                          );
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="키워드 추가..."
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newKeyword.trim()) {
                        setEditableKeywords((prev) => [
                          ...prev,
                          newKeyword.trim(),
                        ]);
                        setNewKeyword("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      if (newKeyword.trim()) {
                        setEditableKeywords((prev) => [
                          ...prev,
                          newKeyword.trim(),
                        ]);
                        setNewKeyword("");
                      }
                    }}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {searchingImages ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Spinner className="w-8 h-8 mb-4" />
                  <p className="text-muted-foreground">{t.compose.searchingImages}</p>
                </div>
              ) : imageCandidates.length === 0 ? (
                <div className="text-center py-12">
                  <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">{t.compose.noImagesFound}</p>
                  <Button
                    onClick={() => handleSearchImages()}
                    variant="outline"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    {t.compose.searchAgain}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {imageCandidates.map((image) => {
                      const isSelected = selectedImages.some((img) => img.id === image.id);
                      return (
                        <button
                          key={image.id}
                          onClick={() => toggleImageSelection(image)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-transparent hover:border-muted-foreground"
                          }`}
                        >
                          <img
                            src={image.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-white text-xs text-center">
                            {image.width}x{image.height}
                            {image.qualityScore && ` (${(image.qualityScore * 100).toFixed(0)}%)`}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedImages.length < 3 && (
                    <p className="text-sm text-amber-500 text-center">
                      {t.compose.minImagesRequired}
                    </p>
                  )}

                  {/* Image-Text Preview - shows when at least 3 images selected */}
                  {selectedImages.length >= 3 && scriptData?.script?.lines && (
                    <div className="mt-6 pt-6 border-t">
                      <ImageTextPreview
                        images={selectedImages}
                        scriptLines={scriptData.script.lines}
                        totalDuration={scriptData.script.totalDuration}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Music Matching */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t.compose.musicMatching}</h2>
                  <p className="text-sm text-muted-foreground">
                    {scriptData?.vibe} 분위기에 맞는 음악을 선택하세요
                  </p>
                </div>
              </div>

              {matchingMusic ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Spinner className="w-8 h-8 mb-4" />
                  <p className="text-muted-foreground">{t.compose.matchingMusic}</p>
                </div>
              ) : audioMatches.length === 0 ? (
                <div className="text-center py-12">
                  <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">{t.compose.noTracksFound}</p>
                  <Button asChild variant="outline">
                    <Link href={`/campaigns/${campaignId}`}>
                      <Upload className="w-4 h-4 mr-2" />
                      {t.compose.uploadMusic}
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
                        onClick={() => setSelectedAudio(audio)}
                        className={`w-full p-4 rounded-lg border-2 flex items-center gap-4 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-6 h-6" />
                          ) : (
                            <Music className="w-6 h-6" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{audio.filename}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>{audio.bpm ? `${audio.bpm} BPM` : "~100 BPM (추정)"}</span>
                            <span>{audio.duration.toFixed(0)}s</span>
                            {audio.vibe && <Badge variant="secondary">{audio.vibe}</Badge>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            <span className="font-medium">
                              {(audio.matchScore * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{t.compose.matchScore}</p>
                        </div>
                        <a
                          href={audio.s3Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:bg-muted rounded-full transition-colors"
                        >
                          <Volume2 className="w-5 h-5 text-muted-foreground" />
                        </a>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Audio Structure Preview - shows when audio is selected */}
              {selectedAudio && scriptData?.script?.lines && (
                <div className="mt-6 pt-6 border-t">
                  <AudioStructurePreview
                    audio={selectedAudio}
                    scriptLines={scriptData.script.lines}
                    totalDuration={scriptData.script.totalDuration}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Render */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Play className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t.compose.renderVideo}</h2>
                  <p className="text-sm text-muted-foreground">
                    설정을 확인하고 렌더링을 시작하세요
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{selectedImages.length}</p>
                  <p className="text-xs text-muted-foreground">이미지</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">Auto</p>
                  <p className="text-xs text-muted-foreground">10-30s</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {selectedAudio?.bpm || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">BPM</p>
                </div>
              </div>

              {/* Effect Selection */}
              <div>
                <Label className="mb-2 block">{t.compose.effectPreset}</Label>
                <Select value={effectPreset} onValueChange={setEffectPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EFFECT_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        <div className="flex items-center gap-2">
                          <span>{preset.label}</span>
                          <span className="text-muted-foreground text-xs">
                            - {preset.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Render Progress */}
              {renderStatus && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.compose.renderProgress}</span>
                    <span className="text-sm text-muted-foreground">
                      {renderStatus.progress}%
                    </span>
                  </div>
                  <Progress value={renderStatus.progress} />
                  {renderStatus.currentStep && (
                    <p className="text-sm text-muted-foreground">
                      {t.compose.renderStep}: {renderStatus.currentStep}
                    </p>
                  )}
                </div>
              )}

              {/* Output */}
              {outputUrl && (
                <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                  <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-green-500 mb-4">
                    {t.compose.renderComplete}
                  </h3>
                  <div className="flex items-center justify-center gap-3">
                    <Button asChild>
                      <a href={outputUrl} target="_blank" rel="noopener noreferrer">
                        <Play className="w-4 h-4 mr-2" />
                        영상 보기
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={outputUrl} download>
                        <Download className="w-4 h-4 mr-2" />
                        {t.compose.downloadVideo}
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
                  className="w-full"
                  size="lg"
                >
                  {rendering ? (
                    <>
                      <Spinner className="w-5 h-5 mr-2" />
                      {t.compose.renderProgress}...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      {t.compose.startRender}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          {t.compose.back}
        </Button>

        <div className="flex items-center gap-2">
          {outputUrl && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t.compose.reset}
            </Button>
          )}

          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t.compose.next}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : outputUrl ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/campaigns/${campaignId}/curation`}>
                  영상 관리
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/campaigns/${campaignId}/publish`}>
                  {t.compose.finish}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
