"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, RefreshCw, AlertCircle } from "lucide-react";
import { previewImageApi } from "@/lib/video-api";

interface ImagePromptGeneratorProps {
  videoPrompt: string;
  imagePrompt: string | null;
  onImagePromptChange: (prompt: string) => void;
  metadata: {
    style: string;
    aspectRatio: string;
  };
  context: {
    selectedIdea?: {
      description?: string;
    } | null;
    campaignName?: string;
  };
}

export function ImagePromptGenerator({
  videoPrompt,
  imagePrompt,
  onImagePromptChange,
  metadata,
  context,
}: ImagePromptGeneratorProps) {
  const { language } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    // Show loading immediately
    setIsLoading(true);
    setError(null);

    // Check if video prompt exists
    if (!videoPrompt) {
      setError(
        language === "ko"
          ? "영상 프롬프트가 없습니다. 분석 단계에서 아이디어를 선택해주세요."
          : "No video prompt. Please select an idea from Analyze step."
      );
      setIsLoading(false);
      return;
    }

    try {
      const imageDescription =
        context.selectedIdea?.description ||
        context.campaignName ||
        "Product promotional video";

      const response = await previewImageApi.generateImagePrompt({
        video_prompt: videoPrompt,
        image_description: imageDescription,
        style: metadata.style,
        aspect_ratio: metadata.aspectRatio,
      });

      if (response.error || !response.data?.image_prompt) {
        throw new Error(response.error?.message || "Failed to generate");
      }

      onImagePromptChange(response.data.image_prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsLoading(false);
    }
  }, [videoPrompt, metadata, context, onImagePromptChange, language]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Wand2 className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-medium text-neutral-700">
          {language === "ko" ? "이미지 프롬프트" : "Image Prompt"}
        </span>
        <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-600">
          AI
        </Badge>

        {/* Generate Button */}
        {videoPrompt && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={isLoading}
            className="ml-auto text-[10px] text-blue-600 hover:text-blue-700 h-5 px-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-2 h-2 mr-1 bg-blue-600 rounded-full animate-ping" />
                {language === "ko" ? "생성 중..." : "Generating..."}
              </>
            ) : (
              <>
                <RefreshCw className="h-2.5 w-2.5 mr-1" />
                {imagePrompt
                  ? language === "ko"
                    ? "다시 생성"
                    : "Regenerate"
                  : language === "ko"
                  ? "생성"
                  : "Generate"}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Content Area */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg h-[140px] overflow-y-auto">
        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center gap-2 h-full">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <p className="text-xs text-red-600 text-center">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="text-xs text-red-500 h-6"
            >
              {language === "ko" ? "닫기" : "Dismiss"}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center gap-3 h-full">
            {/* Three bouncing dots */}
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 bg-blue-500 rounded-full"
                style={{
                  animation: "bounce-dot 0.6s infinite alternate",
                  animationDelay: "0ms",
                }}
              />
              <span
                className="w-3 h-3 bg-blue-500 rounded-full"
                style={{
                  animation: "bounce-dot 0.6s infinite alternate",
                  animationDelay: "200ms",
                }}
              />
              <span
                className="w-3 h-3 bg-blue-500 rounded-full"
                style={{
                  animation: "bounce-dot 0.6s infinite alternate",
                  animationDelay: "400ms",
                }}
              />
            </div>
            <span className="text-sm font-medium text-blue-600">
              {language === "ko" ? "이미지 프롬프트 생성 중..." : "Generating..."}
            </span>
            <style jsx>{`
              @keyframes bounce-dot {
                from {
                  transform: translateY(0);
                }
                to {
                  transform: translateY(-8px);
                }
              }
            `}</style>
          </div>
        )}

        {/* Content State */}
        {!isLoading && !error && imagePrompt && (
          <p className="text-xs text-blue-800 whitespace-pre-wrap leading-relaxed">
            {imagePrompt}
          </p>
        )}

        {/* Empty State */}
        {!isLoading && !error && !imagePrompt && (
          <div className="flex items-center justify-center h-full text-blue-400 text-xs">
            {videoPrompt
              ? language === "ko"
                ? "상단의 '생성' 버튼을 클릭하세요"
                : "Click 'Generate' above"
              : language === "ko"
              ? "영상 프롬프트 필요"
              : "Video prompt required"}
          </div>
        )}
      </div>
    </div>
  );
}
