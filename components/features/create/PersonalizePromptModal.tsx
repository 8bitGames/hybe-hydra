"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  Camera,
  Palette,
  Lightbulb,
  Play,
  Image as ImageIcon,
  Wand2,
  AlertCircle,
  Copy,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ImageData {
  url: string;
  type?: "reference" | "merchandise" | "product";
  name?: string;
  base64?: string; // For locally uploaded images
  mimeType?: string;
}

interface ContextData {
  selectedIdea?: {
    title: string;
    description: string;
    hook?: string;
    type: "ai_video" | "compose";
    optimizedPrompt?: string;
  } | null;
  hashtags: string[];
  keywords: string[];
  campaignName: string;
  artistName?: string;
  performanceMetrics?: {
    avgViews: number;
    avgEngagement: number;
    viralBenchmark: number;
  } | null;
  aiInsights?: string[];
}

interface PromptVariation {
  id: string;
  title: string;
  concept: string;
  imageUsage: string;
  mood: string;
  cameraWork: string;
  suggestedPromptPreview: string;
  confidence: "high" | "medium" | "low";
}

interface ImageAnalysis {
  summary: string;
  detectedElements: string[];
  colorPalette: string[];
  mood: string;
}

interface PersonalizePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ImageData[];
  context: ContextData;
  onComplete: (finalPrompt: string, metadata: {
    duration: string;
    aspectRatio: string;
    style: string;
  }) => void;
}

// ============================================================================
// Step Indicators
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: number }) {
  const { language } = useI18n();
  const steps = [
    { num: 1, label: language === "ko" ? "분석 중" : "Analyzing" },
    { num: 2, label: language === "ko" ? "방향 선택" : "Choose Direction" },
    { num: 3, label: language === "ko" ? "최종 프롬프트" : "Final Prompt" },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              currentStep === step.num
                ? "bg-neutral-900 text-white"
                : currentStep > step.num
                ? "bg-neutral-200 text-neutral-700"
                : "bg-neutral-100 text-neutral-400"
            )}
          >
            {currentStep > step.num ? (
              <Check className="h-4 w-4" />
            ) : (
              step.num
            )}
          </div>
          <span
            className={cn(
              "ml-2 text-sm hidden sm:inline",
              currentStep === step.num
                ? "text-neutral-900 font-medium"
                : "text-neutral-400"
            )}
          >
            {step.label}
          </span>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                "w-8 h-0.5 mx-2",
                currentStep > step.num ? "bg-neutral-300" : "bg-neutral-100"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Step 1: Analyzing Images
// ============================================================================

function AnalyzingStep({ images }: { images: ImageData[] }) {
  const { language } = useI18n();

  return (
    <div className="py-12 text-center">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-neutral-100 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-neutral-600 animate-pulse" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        {language === "ko" ? "이미지 분석 중..." : "Analyzing your images..."}
      </h3>
      <p className="text-sm text-neutral-500 mb-6">
        {language === "ko"
          ? "AI가 이미지와 컨텍스트를 분석하여 창의적인 방향을 제안합니다"
          : "AI is analyzing your images and context to suggest creative directions"}
      </p>

      {/* Image previews */}
      <div className="flex justify-center gap-2 mb-4">
        {images.slice(0, 5).map((img, idx) => (
          <div
            key={idx}
            className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200"
          >
            <img
              src={img.url}
              alt={img.name || `Image ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {images.length > 5 && (
          <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-sm text-neutral-500">
            +{images.length - 5}
          </div>
        )}
      </div>

      <Spinner className="mx-auto" />
    </div>
  );
}

// ============================================================================
// Step 2: Choose Direction
// ============================================================================

function ChooseDirectionStep({
  variations,
  imageAnalysis,
  selectedVariation,
  onSelect,
}: {
  variations: PromptVariation[];
  imageAnalysis: ImageAnalysis;
  selectedVariation: PromptVariation | null;
  onSelect: (variation: PromptVariation) => void;
}) {
  const { language } = useI18n();

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: "bg-neutral-900 text-white",
      medium: "bg-neutral-200 text-neutral-700",
      low: "bg-neutral-100 text-neutral-500",
    };
    const labels = {
      high: language === "ko" ? "높음" : "High",
      medium: language === "ko" ? "보통" : "Medium",
      low: language === "ko" ? "낮음" : "Low",
    };
    return (
      <Badge className={cn("text-[9px]", colors[confidence as keyof typeof colors])}>
        {labels[confidence as keyof typeof labels]}
      </Badge>
    );
  };

  const getVariationIcon = (index: number) => {
    const icons = [
      <ImageIcon key="img" className="h-5 w-5" />,
      <Camera key="cam" className="h-5 w-5" />,
      <Palette key="pal" className="h-5 w-5" />,
    ];
    return icons[index] || <Lightbulb className="h-5 w-5" />;
  };

  return (
    <div className="space-y-4">
      {/* Image Analysis Summary */}
      <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {language === "ko" ? "이미지 분석 결과" : "Image Analysis"}
        </h4>
        <p className="text-sm text-neutral-700 mb-2">{imageAnalysis.summary}</p>
        {imageAnalysis.colorPalette.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">
              {language === "ko" ? "색상:" : "Colors:"}
            </span>
            {imageAnalysis.colorPalette.slice(0, 5).map((color, idx) => (
              <div
                key={idx}
                className="w-4 h-4 rounded border border-neutral-200"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}
      </div>

      {/* Variations */}
      <h4 className="text-sm font-semibold text-neutral-700">
        {language === "ko" ? "창의적 방향 선택" : "Choose Creative Direction"}
      </h4>

      <div className="grid gap-3">
        {variations.map((variation, idx) => (
          <button
            key={variation.id}
            onClick={() => onSelect(variation)}
            className={cn(
              "w-full text-left p-4 rounded-lg border transition-all",
              selectedVariation?.id === variation.id
                ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  selectedVariation?.id === variation.id
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-500"
                )}
              >
                {getVariationIcon(idx)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="text-sm font-semibold text-neutral-900 truncate">
                    {variation.title}
                  </h5>
                  {getConfidenceBadge(variation.confidence)}
                </div>
                <p className="text-xs text-neutral-600 mb-2 line-clamp-2">
                  {variation.concept}
                </p>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <Badge variant="outline" className="border-neutral-200">
                    <ImageIcon className="h-2.5 w-2.5 mr-1" />
                    {variation.imageUsage.slice(0, 30)}...
                  </Badge>
                  <Badge variant="outline" className="border-neutral-200">
                    <Camera className="h-2.5 w-2.5 mr-1" />
                    {variation.cameraWork.slice(0, 25)}...
                  </Badge>
                </div>
              </div>
              {selectedVariation?.id === variation.id && (
                <Check className="h-5 w-5 text-neutral-900 shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Step 3: Final Prompt
// ============================================================================

function FinalPromptStep({
  finalPrompt,
  metadata,
  isLoading,
  userFeedback,
  onUserFeedbackChange,
  onCopy,
  onRegenerate,
}: {
  finalPrompt: string;
  metadata: {
    duration: string;
    aspectRatio: string;
    style: string;
    recommendedSettings?: {
      fps: number;
      resolution: string;
    };
  };
  isLoading: boolean;
  userFeedback: string;
  onUserFeedbackChange: (feedback: string) => void;
  onCopy: () => void;
  onRegenerate: () => void;
}) {
  const { language } = useI18n();

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full bg-neutral-100 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Wand2 className="h-6 w-6 text-neutral-600 animate-pulse" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          {language === "ko" ? "최적화 중..." : "Optimizing prompt..."}
        </h3>
        <p className="text-sm text-neutral-500">
          {language === "ko"
            ? "Veo3에 최적화된 프롬프트를 생성하고 있습니다"
            : "Creating a Veo3-optimized prompt"}
        </p>
        <Spinner className="mx-auto mt-4" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metadata badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="text-xs bg-neutral-100">
          <Play className="h-3 w-3 mr-1" />
          {metadata.duration}
        </Badge>
        <Badge variant="secondary" className="text-xs bg-neutral-100">
          {metadata.aspectRatio}
        </Badge>
        <Badge variant="secondary" className="text-xs bg-neutral-100">
          {metadata.style}
        </Badge>
        {metadata.recommendedSettings && (
          <>
            <Badge variant="outline" className="text-xs">
              {metadata.recommendedSettings.fps}fps
            </Badge>
            <Badge variant="outline" className="text-xs">
              {metadata.recommendedSettings.resolution}
            </Badge>
          </>
        )}
      </div>

      {/* Final prompt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs text-neutral-500">
            {language === "ko" ? "최종 Veo3 프롬프트" : "Final Veo3 Prompt"}
          </Label>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onCopy}
            >
              <Copy className="h-3 w-3 mr-1" />
              {language === "ko" ? "복사" : "Copy"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onRegenerate}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {language === "ko" ? "재생성" : "Regenerate"}
            </Button>
          </div>
        </div>
        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
          <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
            {finalPrompt}
          </p>
        </div>
      </div>

      {/* Optional feedback for regeneration */}
      <div>
        <Label className="text-xs text-neutral-500 mb-2 block">
          {language === "ko"
            ? "수정 요청 (선택사항)"
            : "Modifications (optional)"}
        </Label>
        <Textarea
          value={userFeedback}
          onChange={(e) => onUserFeedbackChange(e.target.value)}
          placeholder={
            language === "ko"
              ? "프롬프트 수정을 원하시면 여기에 입력하세요..."
              : "Enter any modifications you'd like..."
          }
          className="resize-none"
          rows={2}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function PersonalizePromptModal({
  open,
  onOpenChange,
  images,
  context,
  onComplete,
}: PersonalizePromptModalProps) {
  const { language } = useI18n();

  // State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis results
  const [variations, setVariations] = useState<PromptVariation[]>([]);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<PromptVariation | null>(null);

  // Final prompt
  const [finalPrompt, setFinalPrompt] = useState("");
  const [metadata, setMetadata] = useState<{
    duration: string;
    aspectRatio: string;
    style: string;
    recommendedSettings?: { fps: number; resolution: string };
  }>({
    duration: "8s",
    aspectRatio: "9:16",
    style: "cinematic",
  });
  const [userFeedback, setUserFeedback] = useState("");

  // Reset state when modal opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setStep(1);
        setIsAnalyzing(false);
        setIsFinalizing(false);
        setError(null);
        setVariations([]);
        setImageAnalysis(null);
        setSelectedVariation(null);
        setFinalPrompt("");
        setUserFeedback("");
        // Start analysis
        analyzeImages();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Convert blob URL to base64
  const blobUrlToBase64 = async (blobUrl: string): Promise<{ base64: string; mimeType: string } | null> => {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Extract base64 from data URL (remove "data:image/...;base64," prefix)
          const base64 = dataUrl.split(",")[1];
          resolve({ base64, mimeType });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("[PERSONALIZE-UI] Failed to convert blob to base64:", error);
      return null;
    }
  };

  // Step 1: Analyze images
  const analyzeImages = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);

    console.log("[PERSONALIZE-UI] Starting analysis...");
    console.log("[PERSONALIZE-UI] Images:", images.map(i => ({ url: i.url.slice(0, 50), name: i.name })));
    const startTime = Date.now();

    try {
      // Convert blob URLs to base64 before sending to API
      console.log("[PERSONALIZE-UI] Processing images...");
      const processedImages = await Promise.all(
        images.map(async (img) => {
          // Check if it's a blob URL (local file)
          if (img.url.startsWith("blob:")) {
            console.log("[PERSONALIZE-UI] Converting blob URL to base64:", img.name);
            const result = await blobUrlToBase64(img.url);
            if (result) {
              return {
                url: img.url, // Keep original for reference
                type: img.type,
                name: img.name,
                base64: result.base64,
                mimeType: result.mimeType,
              };
            }
            return null; // Failed to convert
          }
          // S3 or external URL - pass as-is
          return {
            url: img.url,
            type: img.type,
            name: img.name,
          };
        })
      );

      // Filter out null values (failed conversions)
      const validImages = processedImages.filter((img): img is NonNullable<typeof img> => img !== null);
      console.log("[PERSONALIZE-UI] Processed images:", validImages.length);

      if (validImages.length === 0) {
        throw new Error("No valid images to analyze");
      }

      console.log("[PERSONALIZE-UI] Calling API...");
      const response = await fetch("/api/v1/ai/personalize-veo3-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze",
          images: validImages,
          context,
        }),
      });

      console.log("[PERSONALIZE-UI] Response status:", response.status);
      const data = await response.json();
      console.log("[PERSONALIZE-UI] Response data:", data.success ? "success" : data.error);
      console.log("[PERSONALIZE-UI] Total time:", Date.now() - startTime, "ms");

      if (!data.success) {
        throw new Error(data.error || "Analysis failed");
      }

      setVariations(data.variations);
      setImageAnalysis(data.imageAnalysis);
      setStep(2);
    } catch (err) {
      console.error("[PERSONALIZE-UI] Analysis error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze images");
    } finally {
      setIsAnalyzing(false);
    }
  }, [images, context]);

  // Step 2 → 3: Finalize prompt
  const finalizePrompt = useCallback(async () => {
    if (!selectedVariation) return;

    setIsFinalizing(true);
    setStep(3);
    setError(null);

    try {
      // Process images again for finalization (convert blob URLs to base64)
      const processedImages = await Promise.all(
        images.map(async (img) => {
          if (img.url.startsWith("blob:")) {
            const result = await blobUrlToBase64(img.url);
            if (result) {
              return {
                url: img.url,
                type: img.type,
                name: img.name,
                base64: result.base64,
                mimeType: result.mimeType,
              };
            }
            return null;
          }
          return {
            url: img.url,
            type: img.type,
            name: img.name,
          };
        })
      );

      const validImages = processedImages.filter((img): img is NonNullable<typeof img> => img !== null);

      const response = await fetch("/api/v1/ai/personalize-veo3-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          selectedVariation,
          images: validImages,
          context,
          userFeedback: userFeedback || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Finalization failed");
      }

      setFinalPrompt(data.finalPrompt);
      setMetadata(data.metadata);
    } catch (err) {
      console.error("Finalization error:", err);
      setError(err instanceof Error ? err.message : "Failed to create prompt");
    } finally {
      setIsFinalizing(false);
    }
  }, [selectedVariation, images, context, userFeedback]);

  // Handle copy
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finalPrompt);
  }, [finalPrompt]);

  // Handle regenerate
  const handleRegenerate = useCallback(() => {
    if (selectedVariation) {
      finalizePrompt();
    }
  }, [selectedVariation, finalizePrompt]);

  // Handle complete
  const handleComplete = useCallback(() => {
    onComplete(finalPrompt, {
      duration: metadata.duration,
      aspectRatio: metadata.aspectRatio,
      style: metadata.style,
    });
    onOpenChange(false);
  }, [finalPrompt, metadata, onComplete, onOpenChange]);

  // Navigation
  const canGoBack = step > 1 && !isAnalyzing && !isFinalizing;
  const canGoForward =
    (step === 2 && selectedVariation !== null) ||
    (step === 3 && finalPrompt !== "");

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleNext = () => {
    if (step === 2 && selectedVariation) {
      finalizePrompt();
    } else if (step === 3 && finalPrompt) {
      handleComplete();
    }
  };

  // Translations
  const t = {
    title: language === "ko" ? "프롬프트 개인화" : "Personalize Prompt",
    description:
      language === "ko"
        ? "이미지와 컨텍스트를 분석하여 최적의 Veo3 프롬프트를 생성합니다"
        : "Analyze images and context to create the optimal Veo3 prompt",
    back: language === "ko" ? "이전" : "Back",
    next: language === "ko" ? "다음" : "Next",
    generate: language === "ko" ? "생성하기" : "Generate",
    cancel: language === "ko" ? "취소" : "Cancel",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} />

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-600 mt-1 h-6 px-2"
                onClick={() => {
                  setError(null);
                  if (step === 1) analyzeImages();
                  else if (step === 3) finalizePrompt();
                }}
              >
                {language === "ko" ? "다시 시도" : "Try again"}
              </Button>
            </div>
          </div>
        )}

        {/* Step content */}
        <ScrollArea className="flex-1 pr-4">
          {step === 1 && <AnalyzingStep images={images} />}
          {step === 2 && imageAnalysis && (
            <ChooseDirectionStep
              variations={variations}
              imageAnalysis={imageAnalysis}
              selectedVariation={selectedVariation}
              onSelect={setSelectedVariation}
            />
          )}
          {step === 3 && (
            <FinalPromptStep
              finalPrompt={finalPrompt}
              metadata={metadata}
              isLoading={isFinalizing}
              userFeedback={userFeedback}
              onUserFeedbackChange={setUserFeedback}
              onCopy={handleCopy}
              onRegenerate={handleRegenerate}
            />
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-neutral-300"
          >
            {t.cancel}
          </Button>

          <div className="flex gap-2">
            {canGoBack && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-neutral-300"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t.back}
              </Button>
            )}
            {step < 3 && (
              <Button
                onClick={handleNext}
                disabled={!canGoForward}
                className="bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {t.next}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 3 && !isFinalizing && finalPrompt && (
              <Button
                onClick={handleComplete}
                className="bg-neutral-900 text-white hover:bg-neutral-800"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t.generate}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
