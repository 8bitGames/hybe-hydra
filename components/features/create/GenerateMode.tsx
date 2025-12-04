"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Bot,
  Sparkles,
  Music,
  FolderOpen,
  ArrowRight,
  Lightbulb,
  Wand2,
  Play,
  Link2,
  Search,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Palette,
  Video,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CampaignSelector } from "./CampaignSelector";
import { videoAnalysisApi, VideoAnalysisResult } from "@/lib/video-api";

const generateSteps = [
  {
    step: 1,
    titleKo: "프롬프트",
    titleEn: "Prompt",
    descKo: "AI로 최적화된 프롬프트 작성",
    descEn: "Describe your video with AI optimization",
    icon: Sparkles,
  },
  {
    step: 2,
    titleKo: "오디오",
    titleEn: "Audio",
    descKo: "영상에 맞는 음악 선택",
    descEn: "Select music to sync with your video",
    icon: Music,
  },
  {
    step: 3,
    titleKo: "스타일",
    titleEn: "Style",
    descKo: "비주얼 프리셋과 효과 선택",
    descEn: "Choose visual presets and effects",
    icon: Wand2,
  },
  {
    step: 4,
    titleKo: "생성",
    titleEn: "Generate",
    descKo: "Veo AI가 영상을 생성합니다",
    descEn: "AI creates your video with Veo",
    icon: Play,
  },
];

interface GenerateModeProps {
  className?: string;
}

/**
 * Generate Mode - AI Video Generation with full options
 * 생성 모드 - 모든 옵션을 포함한 AI 영상 생성
 *
 * This component is embeddable in the unified Create page.
 * 이 컴포넌트는 통합 만들기 페이지에 임베드됩니다.
 */
export function GenerateMode({ className }: GenerateModeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useI18n();

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  // TikTok analysis state
  const [tiktokUrl, setTiktokUrl] = useState("");

  // Pre-fill TikTok URL from query param (from dashboard trending click)
  useEffect(() => {
    const urlParam = searchParams.get("tiktok_url");
    if (urlParam) {
      setTiktokUrl(decodeURIComponent(urlParam));
    }
  }, [searchParams]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);

  // Analyze TikTok video and extract prompt
  const handleAnalyzeTikTok = async () => {
    if (!tiktokUrl.trim()) return;

    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const result = await videoAnalysisApi.analyze(tiktokUrl.trim());

      if (result.error) {
        setAnalysisError(result.error.message || (language === "ko" ? "분석 실패" : "Analysis failed"));
        setIsAnalyzing(false);
        return;
      }

      if (result.data?.data) {
        const analysisData = result.data.data;
        setAnalysisResult(analysisData);

        // Save to session storage for campaign generate page
        if (analysisData.suggested_prompt) {
          sessionStorage.setItem("tiktok_analysis_prompt", analysisData.suggested_prompt);
          sessionStorage.setItem("tiktok_analysis_data", JSON.stringify(analysisData));
        }
      } else if (result.data?.error) {
        setAnalysisError(result.data.error);
      }
    } catch {
      setAnalysisError(language === "ko" ? "TikTok 분석 중 오류 발생" : "Error analyzing TikTok");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Clear TikTok analysis
  const handleClearAnalysis = () => {
    setTiktokUrl("");
    setAnalysisResult(null);
    setAnalysisError("");
    setShowAnalysisDetails(false);
    sessionStorage.removeItem("tiktok_analysis_prompt");
    sessionStorage.removeItem("tiktok_analysis_data");
  };

  const handleStartGenerate = () => {
    if (selectedCampaign) {
      router.push(`/campaigns/${selectedCampaign}/generate`);
    }
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Two column layout for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Column - How It Works */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl">
              {language === "ko" ? "AI 영상 생성 방식" : "How AI Video Works"}
            </CardTitle>
            <CardDescription>
              {language === "ko"
                ? "4단계로 AI 영상을 생성하세요"
                : "Create AI-powered videos in 4 simple steps"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {generateSteps.map((step, idx) => (
                <div key={step.step} className="relative">
                  <div className="flex flex-col items-center text-center p-6 bg-muted/30 rounded-xl">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <step.icon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary mb-1">
                      {step.step}
                    </div>
                    <div className="font-semibold text-lg">
                      {language === "ko" ? step.titleKo : step.titleEn}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {language === "ko" ? step.descKo : step.descEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column - TikTok Analysis & Campaign Selection */}
        <div className="flex flex-col gap-6">
          {/* TikTok URL Analysis */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5" />
                {language === "ko" ? "TikTok 영상 분석" : "Analyze TikTok Video"}
                <Badge variant="secondary" className="text-xs">
                  {language === "ko" ? "선택" : "Optional"}
                </Badge>
              </CardTitle>
              <CardDescription>
                {language === "ko"
                  ? "TikTok 영상을 분석하여 비슷한 스타일의 프롬프트를 자동 생성합니다"
                  : "Analyze a TikTok video to auto-generate a similar style prompt"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyzeTikTok()}
                    placeholder={
                      language === "ko"
                        ? "TikTok 영상 URL을 붙여넣으세요..."
                        : "Paste TikTok video URL..."
                    }
                    className="pr-8"
                    disabled={isAnalyzing}
                  />
                  {tiktokUrl && (
                    <button
                      onClick={handleClearAnalysis}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Button
                  onClick={handleAnalyzeTikTok}
                  disabled={isAnalyzing || !tiktokUrl.trim()}
                  size="icon"
                  variant="outline"
                >
                  {isAnalyzing ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Error Message */}
              {analysisError && (
                <div className="p-2 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm">
                  {analysisError}
                </div>
              )}

              {/* Analysis Result Preview */}
              {analysisResult && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        {language === "ko" ? "분석 완료!" : "Analysis Complete!"}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowAnalysisDetails(!showAnalysisDetails)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showAnalysisDetails
                        ? (language === "ko" ? "접기" : "Less")
                        : (language === "ko" ? "상세보기" : "Details")}
                      {showAnalysisDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Video Metadata */}
                  {analysisResult.metadata && (
                    <div className="flex items-start gap-3">
                      {analysisResult.metadata.thumbnail_url && (
                        <img
                          src={analysisResult.metadata.thumbnail_url}
                          alt=""
                          className="w-12 h-16 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {analysisResult.metadata.description || "No description"}
                        </p>
                        {analysisResult.metadata.author && (
                          <p className="text-xs text-muted-foreground">
                            @{analysisResult.metadata.author.username}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Style Keywords */}
                  {analysisResult.prompt_elements?.style_keywords && (
                    <div className="flex flex-wrap gap-1">
                      {analysisResult.prompt_elements.style_keywords.slice(0, 4).map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="text-[10px]">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Detailed Analysis - Expandable */}
                  {showAnalysisDetails && (
                    <div className="space-y-3 pt-2 border-t border-green-500/20">
                      {/* Content Analysis */}
                      {analysisResult.content_analysis && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <Video className="w-3.5 h-3.5" />
                            {language === "ko" ? "콘텐츠 분석" : "Content Analysis"}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            {analysisResult.content_analysis.main_subject && (
                              <p><span className="font-medium">{language === "ko" ? "주제" : "Subject"}:</span> {analysisResult.content_analysis.main_subject}</p>
                            )}
                            {analysisResult.content_analysis.setting && (
                              <p><span className="font-medium">{language === "ko" ? "배경" : "Setting"}:</span> {analysisResult.content_analysis.setting}</p>
                            )}
                            {analysisResult.content_analysis.actions && analysisResult.content_analysis.actions.length > 0 && (
                              <p><span className="font-medium">{language === "ko" ? "동작" : "Actions"}:</span> {analysisResult.content_analysis.actions.join(", ")}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Style Analysis */}
                      {analysisResult.style_analysis && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <Palette className="w-3.5 h-3.5" />
                            {language === "ko" ? "스타일 분석" : "Style Analysis"}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 pl-5">
                            {analysisResult.style_analysis.visual_style && (
                              <p><span className="font-medium">{language === "ko" ? "비주얼" : "Visual"}:</span> {analysisResult.style_analysis.visual_style}</p>
                            )}
                            {analysisResult.style_analysis.mood && (
                              <p><span className="font-medium">{language === "ko" ? "무드" : "Mood"}:</span> {analysisResult.style_analysis.mood}</p>
                            )}
                            {analysisResult.style_analysis.lighting && (
                              <p><span className="font-medium">{language === "ko" ? "조명" : "Lighting"}:</span> {analysisResult.style_analysis.lighting}</p>
                            )}
                            {analysisResult.style_analysis.color_palette && analysisResult.style_analysis.color_palette.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{language === "ko" ? "색상" : "Colors"}:</span>
                                <div className="flex gap-0.5">
                                  {analysisResult.style_analysis.color_palette.slice(0, 6).map((color, i) => (
                                    <span key={i} className="text-[10px] px-1 py-0.5 bg-background rounded">{color}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Generated Prompt */}
                      {analysisResult.suggested_prompt && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <FileText className="w-3.5 h-3.5" />
                            {language === "ko" ? "생성된 프롬프트" : "Generated Prompt"}
                          </div>
                          <p className="text-xs text-muted-foreground pl-5 line-clamp-4 bg-background/50 p-2 rounded">
                            {analysisResult.suggested_prompt}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-green-600">
                    {language === "ko"
                      ? "캠페인 생성 페이지에서 프롬프트가 자동으로 채워집니다!"
                      : "Prompt will be auto-filled in the campaign generate page!"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign Selection */}
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FolderOpen className="h-6 w-6" />
                {language === "ko" ? "캠페인 선택" : "Select Campaign"}
              </CardTitle>
              <CardDescription>
                {language === "ko"
                  ? "캠페인을 선택하여 에셋에 접근하고 영상을 생성하세요"
                  : "Choose a campaign to access your assets and generate videos"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="p-6 flex-1">
                <CampaignSelector
                  value={selectedCampaign}
                  onChange={setSelectedCampaign}
                />
              </div>

              <div className="p-6 pt-0">
                <Button
                  size="lg"
                  className="w-full h-14 text-lg"
                  onClick={handleStartGenerate}
                  disabled={!selectedCampaign}
                >
                  <Bot className="h-5 w-5 mr-2" />
                  {selectedCampaign
                    ? (language === "ko" ? "생성 시작" : "Start Generating")
                    : (language === "ko" ? "캠페인을 선택하세요" : "Select Campaign to Continue")
                  }
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Why AI Generate */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {language === "ko" ? "AI 영상을 사용하는 경우" : "When to use AI Video"}
                  </h3>
                  <ul className="text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {language === "ko"
                        ? "텍스트로 독특한 영상 콘텐츠를 만들고 싶을 때"
                        : "You want AI to create unique video content from text"
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {language === "ko"
                        ? "음악에 맞춘 고품질 비주얼이 필요할 때"
                        : "You need high-quality visuals synced to music"
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {language === "ko"
                        ? "다양한 스타일 변형을 생성하고 싶을 때"
                        : "You want to generate multiple style variations"
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {language === "ko"
                        ? "트렌딩 콘텐츠와 바이럴 스타일을 활용하고 싶을 때"
                        : "You want to leverage trending content and viral styles"
                      }
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}
