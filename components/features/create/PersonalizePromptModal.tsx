"use client";

import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { previewImageApi } from "@/lib/video-api";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import type { AiInsightsData } from "@/lib/stores/workflow-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Sparkles,
  Check,
  Wand2,
  AlertCircle,
  RefreshCw,
  ImagePlus,
  Video,
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
    type: "ai_video" | "fast-cut";
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
  aiInsights?: AiInsightsData | null;
  optimizedPrompt?: string; // Top-level prompt from analyze store
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

function StepIndicator({ step }: { step: 1 | 2 }) {
  const { language } = useI18n();

  const steps = [
    { num: 1, label: language === "ko" ? "프롬프트 확인" : "Review Prompts" },
    { num: 2, label: language === "ko" ? "첫 장면 생성" : "Generate Frame" },
  ];

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {steps.map((s, idx) => {
        const isActive = step === s.num;
        const isComplete = step > s.num;

        return (
          <div key={s.num} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isComplete || isActive
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {isComplete ? <Check className="h-3 w-3" /> : s.num}
              </div>
              <span className={`text-xs ${isActive || isComplete ? "text-neutral-900 font-medium" : "text-neutral-400"}`}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-px mx-2 ${isComplete ? "bg-neutral-900" : "bg-neutral-300"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Step 1: Prompt Review (Video + Image Prompt)
// ============================================================================

function PromptReviewStep({
  videoPrompt,
  imagePrompt,
  isGeneratingImagePrompt,
  onGenerateImagePrompt,
}: {
  videoPrompt: string;
  imagePrompt: string | null;
  isGeneratingImagePrompt: boolean;
  onGenerateImagePrompt: () => void;
}) {
  const { language } = useI18n();

  return (
    <div className="grid grid-cols-2 gap-6 min-h-[550px]">
      {/* Left: Video Prompt (Input) */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-neutral-100 flex items-center justify-center">
            <Video className="h-4 w-4 text-neutral-600" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-900">
            {language === "ko" ? "영상 프롬프트" : "Video Prompt"}
          </h4>
          <span className="text-xs text-neutral-400 ml-auto px-2 py-0.5 bg-neutral-100 rounded">Input</span>
        </div>
        <div className="flex-1 p-4 bg-neutral-50 border border-neutral-200 rounded-lg overflow-y-auto min-h-[500px] max-h-[70vh]">
          {videoPrompt ? (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
              {videoPrompt}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">
                {language === "ko" ? "프롬프트가 없습니다" : "No prompt available"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Image Prompt (AI Generated) */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center">
            <Wand2 className="h-4 w-4 text-blue-600" />
          </div>
          <h4 className="text-sm font-semibold text-neutral-900">
            {language === "ko" ? "이미지 프롬프트" : "Image Prompt"}
          </h4>
          <span className="text-xs text-blue-600 ml-auto px-2 py-0.5 bg-blue-100 rounded">AI Generated</span>
        </div>
        <div className="flex-1 p-4 bg-blue-50 border border-blue-200 rounded-lg overflow-y-auto min-h-[500px] max-h-[70vh]">
          {isGeneratingImagePrompt ? (
            <div className="flex items-center justify-center gap-3 h-full">
              <Spinner className="h-5 w-5 text-blue-600" />
              <span className="text-sm text-blue-600">
                {language === "ko" ? "이미지 프롬프트 생성 중..." : "Generating image prompt..."}
              </span>
            </div>
          ) : imagePrompt ? (
            <div className="flex flex-col h-full">
              <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed flex-1">
                {imagePrompt}
              </p>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onGenerateImagePrompt}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 h-7 px-2"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {language === "ko" ? "다시 생성" : "Regenerate"}
                </Button>
              </div>
            </div>
          ) : videoPrompt ? (
            <div className="flex items-center justify-center h-full">
              <Button
                onClick={onGenerateImagePrompt}
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-100"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {language === "ko" ? "이미지 프롬프트 생성" : "Generate Image Prompt"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-blue-500 text-sm">
              {language === "ko" ? "먼저 영상 프롬프트가 필요합니다" : "Video prompt required first"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: Preview Image Result
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
      <div className="flex items-center justify-center gap-8 py-8">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-xl bg-neutral-100 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ImagePlus className="h-8 w-8 text-neutral-600 animate-bounce" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-1">
            {language === "ko" ? "첫 장면 이미지 생성 중..." : "Generating first frame..."}
          </h3>
          <p className="text-sm text-neutral-500">
            {language === "ko"
              ? "30초 ~ 1분 정도 소요됩니다"
              : "This may take 30 seconds to 1 minute"}
          </p>
        </div>
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-6 py-8">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-neutral-900 mb-1">
            {language === "ko" ? "이미지 생성 실패" : "Image generation failed"}
          </h3>
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Button onClick={onRegenerate} variant="outline" size="sm">
          <RefreshCw className="h-3 w-3 mr-1" />
          {language === "ko" ? "다시 시도" : "Try again"}
        </Button>
      </div>
    );
  }

  if (!previewImage) {
    return null;
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Left: Image preview - takes remaining space */}
      <div className="flex-1 min-w-0">
        <div className="relative rounded-lg overflow-hidden border border-neutral-200 bg-neutral-900">
          <img
            src={previewImage.image_url}
            alt="Generated first frame"
            className="w-full h-auto object-contain"
            style={{ maxHeight: "360px" }}
          />
        </div>
        <div className="flex justify-center mt-2">
          <Button variant="ghost" size="sm" onClick={onRegenerate} className="text-xs h-7">
            <RefreshCw className="h-3 w-3 mr-1" />
            {language === "ko" ? "다시 생성" : "Regenerate"}
          </Button>
        </div>
      </div>

      {/* Right: Info panel - fixed width */}
      <div className="w-[280px] shrink-0 space-y-3">
        {/* Success badge */}
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Check className="h-4 w-4 text-green-600 shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-green-800">
              {language === "ko" ? "이미지 생성 완료" : "Image Generated"}
            </h4>
            <p className="text-xs text-green-600">
              {language === "ko" ? "영상 생성 준비 완료" : "Ready for video"}
            </p>
          </div>
        </div>

        {/* Image prompt info */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="h-3 w-3 text-neutral-500" />
            <h4 className="text-xs font-medium text-neutral-500">
              {language === "ko" ? "사용된 프롬프트" : "Prompt Used"}
            </h4>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed max-h-[100px] overflow-y-auto">
            {previewImage.gemini_image_prompt}
          </p>
        </div>

        {/* Next steps info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Video className="h-3 w-3 text-blue-600" />
            <h4 className="text-xs font-medium text-blue-600">
              {language === "ko" ? "다음 단계" : "Next Step"}
            </h4>
          </div>
          <p className="text-xs text-blue-700">
            {language === "ko"
              ? "하단의 '영상 생성하기' 버튼을 클릭하세요."
              : "Click 'Generate Video' below to proceed."}
          </p>
        </div>
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

  // Get prompt directly from workflow store as backup
  const analyzeState = useWorkflowStore((state) => state.analyze);
  const setAnalyzeImagePrompt = useWorkflowStore((state) => state.setAnalyzeImagePrompt);

  // Current step: 1 = prompt review, 2 = image generation/result
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // State
  const [isGeneratingImagePrompt, setIsGeneratingImagePrompt] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Prompts - imagePrompt comes from store for persistence
  const [videoPrompt, setVideoPrompt] = useState("");
  const imagePrompt = analyzeState.imagePrompt || null;

  const [metadata, setMetadata] = useState<{
    duration: string;
    aspectRatio: string;
    style: string;
  }>({
    duration: "8s",
    aspectRatio: "9:16",
    style: "cinematic",
  });

  // Preview image (first frame for I2V)
  const [previewImage, setPreviewImage] = useState<PreviewImageData | null>(null);

  // Composition options
  const [compositionMode, setCompositionMode] = useState<"direct" | "two_step">("direct");
  const [handPose, setHandPose] = useState("elegantly holding");

  // Get video prompt from multiple sources
  const getVideoPrompt = useCallback(() => {
    // Priority: context props > workflow store
    const prompt =
      context.selectedIdea?.optimizedPrompt ||
      context.optimizedPrompt ||
      context.selectedIdea?.description ||
      analyzeState.selectedIdea?.optimizedPrompt ||
      analyzeState.optimizedPrompt ||
      analyzeState.userIdea ||
      analyzeState.selectedIdea?.description ||
      "";

    return prompt;
  }, [context, analyzeState]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      const prompt = getVideoPrompt();

      console.log("[PERSONALIZE] 📂 Modal opening");
      console.log("[PERSONALIZE]   Context prompt:", context.optimizedPrompt ? context.optimizedPrompt.slice(0, 50) + "..." : "(empty)");
      console.log("[PERSONALIZE]   Store userIdea:", analyzeState.userIdea ? analyzeState.userIdea.slice(0, 50) + "..." : "(empty)");
      console.log("[PERSONALIZE]   Store optimizedPrompt:", analyzeState.optimizedPrompt ? analyzeState.optimizedPrompt.slice(0, 50) + "..." : "(empty)");
      console.log("[PERSONALIZE]   Final video prompt:", prompt ? prompt.slice(0, 100) + "..." : "(EMPTY!)");

      setCurrentStep(1);
      setIsGeneratingImagePrompt(false);
      setIsGeneratingPreview(false);
      setError(null);
      setPreviewError(null);
      setVideoPrompt(prompt);
      // Don't reset imagePrompt - let user manually regenerate
      // setImagePrompt(null);
      setPreviewImage(null);
      setCompositionMode("direct");
      setHandPose("elegantly holding");

      // Don't auto-generate - let user click the button to generate
      // This prevents regeneration on every page refresh
    }
  }, [open, getVideoPrompt, context.optimizedPrompt, analyzeState.userIdea, analyzeState.optimizedPrompt]);

  // Generate image prompt from video prompt using I2V agent
  const generateImagePrompt = useCallback(async (prompt?: string) => {
    const videoPromptToUse = prompt || videoPrompt;
    if (!videoPromptToUse) return;

    setIsGeneratingImagePrompt(true);
    // Clear current prompt while generating
    setAnalyzeImagePrompt("");

    console.log("[PERSONALIZE] 🔧 Generating image prompt from video prompt...");

    try {
      const imageDescription =
        context.selectedIdea?.description ||
        context.campaignName ||
        "Product promotional video";

      const response = await previewImageApi.generateImagePrompt({
        video_prompt: videoPromptToUse,
        image_description: imageDescription,
        style: metadata.style,
        aspect_ratio: metadata.aspectRatio,
      });

      if (response.error || !response.data?.image_prompt) {
        throw new Error(response.error?.message || "Failed to generate image prompt");
      }

      console.log("[PERSONALIZE] ✅ Image prompt generated:", response.data.image_prompt.slice(0, 100) + "...");
      // Save to store for persistence across refreshes
      setAnalyzeImagePrompt(response.data.image_prompt);
    } catch (err) {
      console.error("[PERSONALIZE] ❌ Image prompt generation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate image prompt"
      );
    } finally {
      setIsGeneratingImagePrompt(false);
    }
  }, [videoPrompt, metadata, context, setAnalyzeImagePrompt]);

  // Generate preview image (first frame for I2V)
  const generatePreviewImage = useCallback(async () => {
    if (!videoPrompt) return;

    setCurrentStep(2);
    setIsGeneratingPreview(true);
    setPreviewError(null);

    console.log("[PERSONALIZE] 🖼️ Generating preview image (first frame)");

    try {
      const productImage = images.find(img => img.url && !img.url.startsWith("blob:"));
      const productImageUrl = productImage?.url;

      const imageDescription =
        context.selectedIdea?.description ||
        context.campaignName ||
        "Product promotional video";

      const response = await previewImageApi.generateWithoutCampaign({
        video_prompt: videoPrompt,
        image_description: imageDescription,
        aspect_ratio: metadata.aspectRatio,
        style: metadata.style,
        product_image_url: productImageUrl,
        composition_mode: compositionMode,
        hand_pose: handPose,
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
  }, [videoPrompt, metadata, images, compositionMode, handPose, context]);

  // Handle regenerate
  const handleRegenerate = useCallback(() => {
    setPreviewImage(null);
    generatePreviewImage();
  }, [generatePreviewImage]);

  // Handle complete
  const handleComplete = useCallback(() => {
    console.log("[PERSONALIZE] handleComplete called");
    onComplete(videoPrompt, {
      duration: metadata.duration,
      aspectRatio: metadata.aspectRatio,
      style: metadata.style,
      previewImage: previewImage || undefined,
    });
    onOpenChange(false);
  }, [videoPrompt, metadata, previewImage, onComplete, onOpenChange]);

  // Can complete when preview image is ready
  const canComplete = previewImage !== null && !isGeneratingPreview;

  // Translations
  const t = {
    title: language === "ko" ? "첫 장면 미리보기" : "First Frame Preview",
    description:
      language === "ko"
        ? "프롬프트를 확인하고 첫 장면 이미지를 생성합니다."
        : "Review the prompts and generate the first frame image.",
    generate: language === "ko" ? "영상 생성하기" : "Generate Video",
    cancel: language === "ko" ? "취소" : "Cancel",
    back: language === "ko" ? "이전" : "Back",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl w-[95vw] h-[85vh] max-h-[85vh] flex flex-col overflow-hidden p-0">
        {/* Header - compact */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100">
          <DialogHeader className="flex-row items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">{t.title}</DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">{t.description}</DialogDescription>
            </div>
          </DialogHeader>
          <StepIndicator step={currentStep} />
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-600 flex-1">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-100 h-7 px-2"
              onClick={() => setError(null)}
            >
              {language === "ko" ? "닫기" : "Dismiss"}
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[600px]">
          {currentStep === 1 ? (
            <PromptReviewStep
              videoPrompt={videoPrompt}
              imagePrompt={imagePrompt}
              isGeneratingImagePrompt={isGeneratingImagePrompt}
              onGenerateImagePrompt={() => generateImagePrompt()}
            />
          ) : (
            <PreviewImageStep
              previewImage={previewImage}
              isGenerating={isGeneratingPreview}
              error={previewError}
              onRegenerate={handleRegenerate}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep === 2 && !isGeneratingPreview) {
                setCurrentStep(1);
                setPreviewImage(null);
                setPreviewError(null);
              } else {
                onOpenChange(false);
              }
            }}
            className="border-neutral-300"
          >
            {currentStep === 2 && !isGeneratingPreview ? t.back : t.cancel}
          </Button>

          {/* Step 1: Generate Frame button */}
          {currentStep === 1 && imagePrompt && !isGeneratingImagePrompt && (
            <Button
              onClick={generatePreviewImage}
              disabled={isGeneratingPreview}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {isGeneratingPreview ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {language === "ko" ? "생성 중..." : "Generating..."}
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {language === "ko" ? "첫 장면 생성" : "Generate Frame"}
                </>
              )}
            </Button>
          )}

          {/* Step 2: Generate Video button - only show when preview is ready */}
          {currentStep === 2 && canComplete && (
            <Button
              onClick={handleComplete}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {t.generate}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
