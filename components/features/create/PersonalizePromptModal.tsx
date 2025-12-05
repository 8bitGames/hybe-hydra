"use client";

import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { previewImageApi } from "@/lib/video-api";
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
  ImagePlus,
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

// Helper function to convert blob URL to base64
async function blobUrlToBase64(blobUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Extract base64 data from data URL (format: data:mime/type;base64,XXXXX)
        const base64Match = result.match(/^data:([^;]+);base64,(.+)$/);
        if (base64Match) {
          resolve({
            mimeType: base64Match[1],
            base64: base64Match[2],
          });
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface ImageAnalysis {
  summary: string;
  detectedElements: string[];
  colorPalette: string[];
  mood: string;
}

// Preview image data from I2V generation
interface PreviewImageData {
  preview_id: string;
  image_url: string;
  image_base64: string;
  gemini_image_prompt: string;
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
    previewImage?: PreviewImageData;
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
    { num: 3, label: language === "ko" ? "영상 프롬프트" : "Video Prompt" },
    { num: 4, label: language === "ko" ? "첫 장면 생성" : "First Frame" },
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
// Step 4: Preview Image Generation
// ============================================================================

function PreviewImageStep({
  previewImage,
  isGenerating,
  error,
  onRegenerate,
}: {
  previewImage: PreviewImageData | null;
  isGenerating: boolean;
  error: string | null;
  onRegenerate: () => void;
}) {
  const { language } = useI18n();

  if (isGenerating) {
    return (
      <div className="py-12 text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-neutral-100 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ImagePlus className="h-8 w-8 text-neutral-600 animate-pulse" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          {language === "ko" ? "첫 장면 이미지 생성 중..." : "Generating first frame..."}
        </h3>
        <p className="text-sm text-neutral-500 mb-6">
          {language === "ko"
            ? "AI가 영상의 첫 장면을 생성하고 있습니다"
            : "AI is creating the first frame for your video"}
        </p>
        <Spinner className="mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          {language === "ko" ? "이미지 생성 실패" : "Image generation failed"}
        </h3>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <Button onClick={onRegenerate} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          {language === "ko" ? "다시 시도" : "Try again"}
        </Button>
      </div>
    );
  }

  if (!previewImage) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Success header */}
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
        <Check className="h-5 w-5 text-green-600" />
        <div>
          <h4 className="text-sm font-semibold text-green-800">
            {language === "ko" ? "첫 장면 이미지가 생성되었습니다" : "First frame generated successfully"}
          </h4>
          <p className="text-xs text-green-600">
            {language === "ko"
              ? "이 이미지를 기반으로 영상이 생성됩니다"
              : "This image will be used as the starting frame for your video"}
          </p>
        </div>
      </div>

      {/* Preview image */}
      <div className="relative rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
        <img
          src={previewImage.image_url}
          alt="Generated first frame"
          className="w-full h-auto object-contain max-h-[400px]"
        />
      </div>

      {/* Image prompt info */}
      <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <Wand2 className="h-3 w-3" />
          {language === "ko" ? "사용된 이미지 프롬프트" : "Image Prompt Used"}
        </h4>
        <p className="text-sm text-neutral-600 line-clamp-3">
          {previewImage.gemini_image_prompt}
        </p>
      </div>

      {/* Regenerate button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          className="text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          {language === "ko" ? "다른 이미지 생성" : "Generate different image"}
        </Button>
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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

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

  // Preview image (Step 4)
  const [previewImage, setPreviewImage] = useState<PreviewImageData | null>(null);

  // Reset state when modal opens - use useEffect instead to properly trigger analysis
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        console.log("[PERSONALIZE] 📂 Modal opening, resetting state...");
        setStep(1);
        setIsAnalyzing(false);
        setIsFinalizing(false);
        setIsGeneratingPreview(false);
        setError(null);
        setPreviewError(null);
        setVariations([]);
        setImageAnalysis(null);
        setSelectedVariation(null);
        setFinalPrompt("");
        setUserFeedback("");
        setPreviewImage(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Convert any image URL to base64 (works for blob, S3, and external URLs)
  const imageUrlToBase64 = async (imageUrl: string): Promise<{ base64: string; mimeType: string } | null> => {
    try {
      console.log("[PERSONALIZE-UI] Fetching image:", imageUrl.slice(0, 80));
      const fetchStart = Date.now();

      // For blob URLs, fetch directly (same origin)
      if (imageUrl.startsWith("blob:")) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error("[PERSONALIZE-UI] Failed to fetch blob:", response.status);
          return null;
        }
        const blob = await response.blob();
        const mimeType = blob.type || "image/jpeg";
        console.log("[PERSONALIZE-UI] Blob fetched in", Date.now() - fetchStart, "ms, size:", blob.size);

        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            console.log("[PERSONALIZE-UI] Converted blob to base64, length:", base64.length);
            resolve({ base64, mimeType });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }

      // For S3/external URLs, use proxy API to avoid CORS
      console.log("[PERSONALIZE-UI] Using proxy for external URL");
      const proxyResponse = await fetch(`/api/v1/proxy-image?url=${encodeURIComponent(imageUrl)}`);
      if (!proxyResponse.ok) {
        console.error("[PERSONALIZE-UI] Proxy failed:", proxyResponse.status);
        return null;
      }
      const data = await proxyResponse.json();
      console.log("[PERSONALIZE-UI] Proxy fetched in", Date.now() - fetchStart, "ms, base64 length:", data.base64?.length);

      return {
        base64: data.base64,
        mimeType: data.mimeType,
      };
    } catch (error) {
      console.error("[PERSONALIZE-UI] Failed to convert image to base64:", error);
      return null;
    }
  };

  // Step 1: Analyze images
  const analyzeImages = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);

    console.log("=".repeat(60));
    console.log("[PERSONALIZE] 🚀 Step 1: Starting image analysis");
    console.log("[PERSONALIZE] 📷 Total images:", images.length);
    images.forEach((img, idx) => {
      console.log(`[PERSONALIZE]   Image ${idx + 1}: ${img.name || "unnamed"}`);
      console.log(`[PERSONALIZE]     URL: ${img.url.slice(0, 80)}...`);
      console.log(`[PERSONALIZE]     Type: ${img.type || "none"}`);
      console.log(`[PERSONALIZE]     Has base64: ${!!img.base64}`);
    });
    const startTime = Date.now();

    try {
      // Convert ALL images to base64 on client side (faster than server fetching from S3)
      console.log("[PERSONALIZE] 🔄 Converting images to base64...");
      const conversionStart = Date.now();

      const processedImages = await Promise.all(
        images.map(async (img, idx) => {
          const imgStart = Date.now();
          console.log(`[PERSONALIZE]   Processing image ${idx + 1}...`);

          // If base64 already provided, use it
          if (img.base64 && img.mimeType) {
            console.log(`[PERSONALIZE]   ✅ Image ${idx + 1}: Already has base64 (${img.base64.length} chars)`);
            return {
              url: img.url,
              type: img.type,
              name: img.name,
              base64: img.base64,
              mimeType: img.mimeType,
            };
          }

          // Convert URL (blob, S3, or external) to base64
          const isBlob = img.url.startsWith("blob:");
          console.log(`[PERSONALIZE]   Image ${idx + 1}: Converting ${isBlob ? "blob" : "external"} URL to base64...`);

          const result = await imageUrlToBase64(img.url);

          if (result) {
            console.log(`[PERSONALIZE]   ✅ Image ${idx + 1}: Converted in ${Date.now() - imgStart}ms`);
            console.log(`[PERSONALIZE]      Base64 length: ${result.base64.length} chars`);
            console.log(`[PERSONALIZE]      MIME type: ${result.mimeType}`);
            return {
              url: img.url,
              type: img.type,
              name: img.name,
              base64: result.base64,
              mimeType: result.mimeType,
            };
          }

          console.log(`[PERSONALIZE]   ❌ Image ${idx + 1}: Failed to convert`);
          return null; // Failed to convert
        })
      );

      // Filter out null values (failed conversions)
      const validImages = processedImages.filter((img): img is NonNullable<typeof img> => img !== null);
      console.log(`[PERSONALIZE] 📊 Conversion complete: ${validImages.length}/${images.length} images in ${Date.now() - conversionStart}ms`);

      if (validImages.length === 0) {
        throw new Error("No valid images to analyze");
      }

      console.log("[PERSONALIZE] 🌐 Calling Gemini API for analysis...");
      const apiStart = Date.now();

      const response = await fetch("/api/v1/ai/personalize-veo3-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze",
          images: validImages,
          context,
        }),
      });

      console.log(`[PERSONALIZE] 📡 API response status: ${response.status} (${Date.now() - apiStart}ms)`);

      const data = await response.json();

      if (!data.success) {
        console.log(`[PERSONALIZE] ❌ API error: ${data.error}`);
        throw new Error(data.error || "Analysis failed");
      }

      console.log(`[PERSONALIZE] ✅ Analysis complete!`);
      console.log(`[PERSONALIZE]    Variations: ${data.variations?.length || 0}`);
      console.log(`[PERSONALIZE]    Image analysis: ${data.imageAnalysis ? "yes" : "no"}`);
      console.log(`[PERSONALIZE] ⏱️ Total time: ${Date.now() - startTime}ms`);
      console.log("=".repeat(60));

      setVariations(data.variations);
      setImageAnalysis(data.imageAnalysis);
      setStep(2);
    } catch (err) {
      console.error("[PERSONALIZE] ❌ Analysis error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze images");
    } finally {
      setIsAnalyzing(false);
    }
  }, [images, context]);

  // Trigger analysis when modal opens
  useEffect(() => {
    if (open && step === 1 && !isAnalyzing && variations.length === 0 && !error) {
      console.log("[PERSONALIZE] 🔄 useEffect triggering analyzeImages...");
      analyzeImages();
    }
  }, [open, step, isAnalyzing, variations.length, error, analyzeImages]);

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

      console.log("[PERSONALIZE] Finalize response:", JSON.stringify(data, null, 2));

      if (!data.success) {
        throw new Error(data.error || "Finalization failed");
      }

      // API returns veo3Prompt, not finalPrompt
      console.log("[PERSONALIZE] veo3Prompt value:", data.veo3Prompt);
      console.log("[PERSONALIZE] veo3Prompt type:", typeof data.veo3Prompt);
      console.log("[PERSONALIZE] veo3Prompt length:", data.veo3Prompt?.length);
      console.log("[PERSONALIZE] metadata:", JSON.stringify(data.metadata));

      const promptValue = data.veo3Prompt || "";
      console.log("[PERSONALIZE] Setting finalPrompt to:", promptValue.slice(0, 100));
      setFinalPrompt(promptValue);
      setMetadata(data.metadata || { duration: "8s", aspectRatio: "9:16", style: "cinematic", recommendedSettings: { fps: 30, resolution: "1080p" } });
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

  // Step 3 → 4: Generate preview image (first frame for I2V)
  const generatePreviewImage = useCallback(async () => {
    if (!finalPrompt || !imageAnalysis) return;

    setIsGeneratingPreview(true);
    setPreviewError(null);
    setStep(4);

    console.log("[PERSONALIZE] 🖼️ Step 4: Generating preview image (first frame)");
    console.log("[PERSONALIZE]   Video prompt:", finalPrompt.slice(0, 100) + "...");
    console.log("[PERSONALIZE]   Image description:", imageAnalysis.summary.slice(0, 100) + "...");

    try {
      const response = await previewImageApi.generateWithoutCampaign({
        video_prompt: finalPrompt,
        image_description: imageAnalysis.summary,
        aspect_ratio: metadata.aspectRatio,
        style: metadata.style,
      });

      if (response.error || !response.data) {
        throw new Error(response.error?.message || "Failed to generate preview image");
      }

      console.log("[PERSONALIZE] ✅ Preview image generated:", response.data.preview_id);

      setPreviewImage({
        preview_id: response.data.preview_id,
        image_url: response.data.image_url,
        image_base64: response.data.image_base64,
        gemini_image_prompt: response.data.gemini_image_prompt,
      });
    } catch (err) {
      console.error("[PERSONALIZE] ❌ Preview image generation error:", err);
      setPreviewError(
        err instanceof Error ? err.message : "Failed to generate preview image"
      );
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [finalPrompt, imageAnalysis, metadata]);

  // Handle regenerate preview image
  const handleRegeneratePreview = useCallback(() => {
    generatePreviewImage();
  }, [generatePreviewImage]);

  // Handle complete
  const handleComplete = useCallback(() => {
    console.log("[PERSONALIZE] handleComplete called with:", {
      finalPrompt: finalPrompt?.slice(0, 100),
      metadata,
      previewImage: previewImage ? { id: previewImage.preview_id, hasImage: !!previewImage.image_url } : null,
    });
    onComplete(finalPrompt, {
      duration: metadata.duration,
      aspectRatio: metadata.aspectRatio,
      style: metadata.style,
      previewImage: previewImage || undefined,
    });
    onOpenChange(false);
  }, [finalPrompt, metadata, previewImage, onComplete, onOpenChange]);

  // Navigation
  const canGoBack = step > 1 && !isAnalyzing && !isFinalizing && !isGeneratingPreview;
  const canGoForward =
    (step === 2 && selectedVariation !== null) ||
    (step === 3 && finalPrompt !== "") ||
    (step === 4 && previewImage !== null);

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
  };

  const handleNext = () => {
    if (step === 2 && selectedVariation) {
      finalizePrompt();
    } else if (step === 3 && finalPrompt) {
      generatePreviewImage();
    } else if (step === 4 && previewImage) {
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
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
        <div className="flex-1 min-h-0 overflow-y-auto max-h-[55vh] pr-2">
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
          {step === 4 && (
            <PreviewImageStep
              previewImage={previewImage}
              isGenerating={isGeneratingPreview}
              error={previewError}
              onRegenerate={handleRegeneratePreview}
            />
          )}
        </div>

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
            {/* Steps 2-3: Next button */}
            {(step === 2 || (step === 3 && !isFinalizing && finalPrompt)) && (
              <Button
                onClick={handleNext}
                disabled={!canGoForward}
                className="bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {t.next}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {/* Step 4: Generate button (final step) */}
            {step === 4 && !isGeneratingPreview && previewImage && (
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
