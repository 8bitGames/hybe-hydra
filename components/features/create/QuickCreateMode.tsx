"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { promptApi, PromptTransformResponse } from "@/lib/video-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Sparkles,
  Zap,
  ArrowRight,
  Info,
  TrendingUp,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CampaignSelector } from "./CampaignSelector";

interface QuickCreateModeProps {
  className?: string;
  onModeSwitch?: () => void;
}

/**
 * Quick Create Mode - Simplified 1-click video generation
 * 빠른 생성 모드 - 간소화된 1클릭 영상 생성
 *
 * Defaults:
 * - 9:16 vertical (TikTok/Reels optimized)
 * - 5-10 second duration
 * - Auto-optimize prompt with AI
 */
export function QuickCreateMode({ className, onModeSwitch }: QuickCreateModeProps) {
  const router = useRouter();
  const { t, language } = useI18n();

  // Form state
  const [prompt, setPrompt] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [transformedPrompt, setTransformedPrompt] = useState<PromptTransformResponse | null>(null);

  // UI state
  const [transforming, setTransforming] = useState(false);
  const [error, setError] = useState("");

  // Transform prompt with AI
  const handleTransformPrompt = async () => {
    if (!prompt.trim()) {
      setError(language === "ko" ? "프롬프트를 입력해주세요" : "Please enter a prompt");
      return;
    }

    setError("");
    setTransforming(true);

    try {
      const result = await promptApi.transform({
        user_input: prompt.trim(),
        campaign_id: selectedCampaignId || undefined,
        safety_level: "high",
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        setTransformedPrompt(result.data);

        if (result.data.status === "blocked") {
          setError(result.data.blocked_reason || "Prompt blocked due to safety concerns");
        }
      }
    } catch (err) {
      setError(language === "ko" ? "프롬프트 최적화 실패" : "Failed to optimize prompt");
    } finally {
      setTransforming(false);
    }
  };

  // Navigate to generation page with prompt
  const handleQuickGenerate = () => {
    if (!prompt.trim()) {
      setError(language === "ko" ? "프롬프트를 입력해주세요" : "Please enter a prompt");
      return;
    }

    // If campaign selected, go to campaign generate page
    if (selectedCampaignId) {
      const encodedPrompt = encodeURIComponent(
        transformedPrompt?.veo_prompt || prompt.trim()
      );
      router.push(`/campaigns/${selectedCampaignId}/generate?prompt=${encodedPrompt}&mode=quick`);
    } else {
      // No campaign - prompt user to select one or create
      setError(
        language === "ko"
          ? "영상 생성을 위해 캠페인을 선택하거나 생성해주세요"
          : "Please select or create a campaign to generate videos"
      );
    }
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Two column layout for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Column - Quick Create Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent flex flex-col">
          <CardContent className="pt-6 flex-1 flex flex-col">
            {/* Main Prompt Input */}
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-6 w-6 text-primary" />
                <h2 className="font-semibold text-xl">
                  {language === "ko" ? "무엇을 만들까요?" : "What would you like to create?"}
                </h2>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setTransformedPrompt(null);
                  setError("");
                }}
                placeholder={
                  language === "ko"
                    ? "영상 아이디어를 자유롭게 적어주세요. 한국어 또는 영어로 입력하세요.\n예: 밤하늘 아래 춤추는 소녀, 네온 불빛이 반짝이는 도시"
                    : "Describe your video idea freely. Write in Korean or English.\nExample: A girl dancing under the night sky, neon lights twinkling in the city"
                }
                rows={5}
                className="w-full px-4 py-4 bg-background border border-input rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-lg"
              />

            {/* Quick Info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>
                {t.createPage.hints.quickModeInfo}
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Optimized Prompt Preview */}
            {transformedPrompt?.status === "success" && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium text-sm">
                    {language === "ko" ? "프롬프트 최적화 완료" : "Prompt Optimized"}
                  </span>
                </div>
                {transformedPrompt.analysis?.trend_applied?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {transformedPrompt.analysis.trend_applied.map((trend) => (
                      <Badge key={trend} variant="secondary" className="text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {trend}
                      </Badge>
                    ))}
                  </div>
                )}
                <details className="cursor-pointer">
                  <summary className="text-xs text-muted-foreground hover:text-foreground">
                    {language === "ko" ? "최적화된 프롬프트 보기" : "View optimized prompt"}
                  </summary>
                  <p className="mt-2 text-sm text-foreground bg-muted p-3 rounded-lg break-words">
                    {transformedPrompt.veo_prompt}
                  </p>
                </details>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-4">
              <Button
                onClick={handleTransformPrompt}
                variant="outline"
                disabled={transforming || !prompt.trim()}
                className="flex-1"
              >
                {transforming ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    {language === "ko" ? "최적화 중..." : "Optimizing..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {language === "ko" ? "AI로 최적화" : "Optimize with AI"}
                  </>
                )}
              </Button>

              <Button
                onClick={handleQuickGenerate}
                disabled={!prompt.trim() || !selectedCampaignId}
                className="flex-1 bg-primary hover:bg-primary/90"
                size="lg"
              >
                <Zap className="h-4 w-4 mr-2" />
                {language === "ko" ? "빠른 생성" : "Quick Generate"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Campaign Selection */}
        <div className="flex flex-col gap-6">
          <Card className="flex-1 flex flex-col">
            <CardContent className="pt-6 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen className="h-6 w-6 text-primary" />
                <h2 className="font-semibold text-xl">
                  {language === "ko" ? "캠페인 선택" : "Select Campaign"}
                </h2>
                <Badge variant="destructive" className="text-xs">
                  {language === "ko" ? "필수" : "Required"}
                </Badge>
              </div>

              <div className="flex-1">
                <CampaignSelector
                  value={selectedCampaignId}
                  onChange={setSelectedCampaignId}
                />
              </div>
            </CardContent>
          </Card>

          {/* Need more control hint */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <button
                onClick={onModeSwitch}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">
                      {t.createPage.hints.needMoreControl}
                    </p>
                    <p className="text-primary">
                      {language === "ko" ? "상세 모드로 전환 →" : "Switch to detailed mode →"}
                    </p>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
