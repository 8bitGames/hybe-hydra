"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Wand2,
  Check,
  AlertCircle,
  HelpCircle,
  ZoomIn,
  Loader2,
  RefreshCw,
  ImageIcon,
  Sparkles,
  Clock,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  AIGeneratedImage,
  AIImageGlobalStyle,
  AIImageStyle,
} from "@/lib/stores/fast-cut-context";
import { ScriptGenerationResponse } from "@/lib/fast-cut-api";

interface FastCutAIImageStepProps {
  scriptData: ScriptGenerationResponse | null;
  aiGeneratedImages: AIGeneratedImage[];
  aiImageGlobalStyle: AIImageGlobalStyle | null;
  aiImageStyle: AIImageStyle;
  generatingAiPrompts: boolean;
  generatingAiImages: boolean;
  onGeneratePrompts: () => void;
  onGenerateImages: () => void;
  onRegenerateImage: (sceneNumber: number) => void;
  onNext?: () => void;
}

// Status icon component
function StatusIcon({ status }: { status: AIGeneratedImage["status"] }) {
  switch (status) {
    case "completed":
      return <Check className="h-4 w-4 text-green-500" />;
    case "generating":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-neutral-400" />;
  }
}

// Scene card component
function SceneCard({
  scene,
  index,
  onPreview,
  onRegenerate,
  isRegenerating,
  language,
}: {
  scene: AIGeneratedImage;
  index: number;
  onPreview: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  language: string;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      {/* Image Area */}
      <div className="relative aspect-[9/16] bg-neutral-100">
        {scene.imageUrl ? (
          <>
            <img
              src={scene.imageUrl}
              alt={`Scene ${scene.sceneNumber}`}
              className="w-full h-full object-cover"
            />
            {/* Preview button */}
            <button
              onClick={onPreview}
              className="absolute bottom-2 left-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            {/* Regenerate button */}
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
            </button>
          </>
        ) : scene.status === "generating" ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 text-neutral-400 animate-spin mb-2" />
            <p className="text-xs text-neutral-500">
              {language === "ko" ? "생성 중..." : "Generating..."}
            </p>
          </div>
        ) : scene.status === "failed" ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-xs text-red-500 text-center mb-2">
              {scene.error || (language === "ko" ? "생성 실패" : "Generation failed")}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="text-xs"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isRegenerating && "animate-spin")} />
              {language === "ko" ? "다시 시도" : "Retry"}
            </Button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <ImageIcon className="h-8 w-8 text-neutral-300 mb-2" />
            <p className="text-xs text-neutral-400">
              {language === "ko" ? "대기 중" : "Pending"}
            </p>
          </div>
        )}

        {/* Scene number badge */}
        <div className="absolute top-2 left-2 w-6 h-6 bg-neutral-900 text-white rounded-full flex items-center justify-center text-sm font-bold">
          {index + 1}
        </div>

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <StatusIcon status={scene.status} />
        </div>
      </div>

      {/* Script text */}
      <div className="p-3 border-t border-neutral-100">
        <p className="text-xs text-neutral-700 line-clamp-2">{scene.scriptText}</p>
      </div>
    </div>
  );
}

export function FastCutAIImageStep({
  scriptData,
  aiGeneratedImages,
  aiImageGlobalStyle,
  aiImageStyle,
  generatingAiPrompts,
  generatingAiImages,
  onGeneratePrompts,
  onGenerateImages,
  onRegenerateImage,
  onNext,
}: FastCutAIImageStepProps) {
  const { language, translate } = useI18n();
  const [previewImage, setPreviewImage] = useState<AIGeneratedImage | null>(null);
  const [regeneratingScene, setRegeneratingScene] = useState<number | null>(null);

  // Calculate progress
  const completedCount = aiGeneratedImages.filter((img) => img.status === "completed").length;
  const totalCount = aiGeneratedImages.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Check if prompts are ready
  const hasPrompts = aiGeneratedImages.length > 0 && aiGeneratedImages.some((img) => img.imagePrompt);

  // Check if generation is in progress
  const isGenerating = generatingAiPrompts || generatingAiImages;

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

  // Get style label
  const getStyleLabel = (style: AIImageStyle) => {
    const labels: Record<AIImageStyle, { ko: string; en: string }> = {
      cinematic: { ko: "시네마틱", en: "Cinematic" },
      photorealistic: { ko: "포토리얼", en: "Photorealistic" },
      illustration: { ko: "일러스트", en: "Illustration" },
      artistic: { ko: "아티스틱", en: "Artistic" },
      anime: { ko: "애니메", en: "Anime" },
    };
    return language === "ko" ? labels[style].ko : labels[style].en;
  };

  const handleRegenerate = async (sceneNumber: number) => {
    setRegeneratingScene(sceneNumber);
    await onRegenerateImage(sceneNumber);
    setRegeneratingScene(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-1">
          {language === "ko" ? "AI 이미지 생성" : "AI Image Generation"}
        </h2>
        <p className="text-sm text-neutral-500">
          {language === "ko"
            ? "각 씬에 맞는 AI 이미지를 자동으로 생성합니다"
            : "Automatically generate AI images for each scene"}
        </p>
      </div>

      {/* Status Panel */}
      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-4">
        {/* Generation Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                completedCount >= 3
                  ? "bg-green-100 text-green-600"
                  : "bg-neutral-200 text-neutral-500"
              )}
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wand2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {language === "ko" ? "생성된 이미지" : "Generated Images"}
              </p>
              <p className="text-xs text-neutral-500">
                {completedCount} / {totalCount || scriptData?.script.lines.length || 0}{" "}
                {language === "ko" ? "완료" : "completed"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {completedCount >= 3 ? (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <Check className="h-3 w-3 mr-1" />
                {language === "ko" ? "준비 완료" : "Ready"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                {language === "ko" ? "최소 3장 필요" : "Min 3 required"}
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-neutral-500 text-center">
              {Math.round(progress)}% {language === "ko" ? "완료" : "complete"}
            </p>
          </div>
        )}

        {/* Style Info */}
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <Badge variant="secondary" className="bg-neutral-200">
            {getStyleLabel(aiImageStyle)}
          </Badge>
          {aiImageGlobalStyle && (
            <>
              <span>•</span>
              <span>{aiImageGlobalStyle.mood}</span>
              <span>•</span>
              <span>{aiImageGlobalStyle.lighting}</span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!hasPrompts ? (
          <Button
            onClick={onGeneratePrompts}
            disabled={!scriptData || generatingAiPrompts}
            className="flex-1 bg-neutral-900 text-white hover:bg-neutral-800"
          >
            {generatingAiPrompts ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === "ko" ? "프롬프트 생성 중..." : "Generating prompts..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {language === "ko" ? "이미지 프롬프트 생성" : "Generate Image Prompts"}
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={onGenerateImages}
            disabled={generatingAiImages || completedCount === totalCount}
            className="flex-1 bg-neutral-900 text-white hover:bg-neutral-800"
          >
            {generatingAiImages ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === "ko" ? "이미지 생성 중..." : "Generating images..."}
              </>
            ) : completedCount === totalCount && totalCount > 0 ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {language === "ko" ? "모든 이미지 생성 완료" : "All Images Generated"}
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                {language === "ko" ? "AI 이미지 생성" : "Generate AI Images"}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Scene Grid */}
      {aiGeneratedImages.length > 0 ? (
        <ScrollArea className="h-[480px] pr-4">
          <div className="grid grid-cols-3 gap-4">
            {aiGeneratedImages.map((scene, idx) => (
              <SceneCard
                key={scene.sceneNumber}
                scene={scene}
                index={idx}
                language={language}
                onPreview={() => setPreviewImage(scene)}
                onRegenerate={() => handleRegenerate(scene.sceneNumber)}
                isRegenerating={regeneratingScene === scene.sceneNumber}
              />
            ))}
          </div>
        </ScrollArea>
      ) : scriptData ? (
        <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
          <Wand2 className="h-12 w-12 mb-2 text-neutral-300" />
          <p className="text-center">
            {language === "ko"
              ? "이미지 프롬프트를 생성하여 시작하세요"
              : "Generate image prompts to start"}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {scriptData.script.lines.length}{" "}
            {language === "ko" ? "개의 씬이 준비되어 있습니다" : "scenes ready for generation"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
          <AlertCircle className="h-12 w-12 mb-2 text-neutral-300" />
          <p>
            {language === "ko"
              ? "먼저 스크립트를 생성해주세요"
              : "Please generate a script first"}
          </p>
        </div>
      )}

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-2 bg-black/95 border-neutral-800">
          {previewImage && previewImage.imageUrl && (
            <div className="relative flex flex-col items-center">
              <img
                src={previewImage.imageUrl}
                alt={`Scene ${previewImage.sceneNumber}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
              <div className="mt-3 text-center space-y-2 px-4">
                <p className="text-sm text-white/80">{previewImage.scriptText}</p>
                <div className="flex items-center justify-center gap-3 text-xs text-white/60">
                  <span>
                    Scene {previewImage.sceneNumber}
                  </span>
                  <span>•</span>
                  <span>{getStyleLabel(aiImageStyle)}</span>
                </div>
                {previewImage.imagePrompt && (
                  <details className="text-left">
                    <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                      {language === "ko" ? "프롬프트 보기" : "View prompt"}
                    </summary>
                    <p className="text-xs text-white/50 mt-2 p-2 bg-white/10 rounded">
                      {previewImage.imagePrompt}
                    </p>
                  </details>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
