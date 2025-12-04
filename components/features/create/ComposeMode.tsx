"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/components";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wand2,
  Image as ImageIcon,
  Music,
  FolderOpen,
  ArrowRight,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Eye,
  Heart,
  Zap,
  Hash,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CampaignSelector } from "./CampaignSelector";
import {
  getTrendContext,
  clearTrendContext,
  getSuggestedHashtags,
  TrendVideoContext,
} from "@/lib/trend-context";

interface ComposeStep {
  step: number;
  ko: string;
  en: string;
  icon: LucideIcon;
}

const composeSteps: ComposeStep[] = [
  {
    step: 1,
    ko: "스크립트|트렌딩 키워드로 AI 스크립트 생성",
    en: "Script|Generate AI script with trending keywords",
    icon: Sparkles,
  },
  {
    step: 2,
    ko: "이미지|영상에 사용할 이미지 검색 및 선택",
    en: "Images|Search and select images for your video",
    icon: ImageIcon,
  },
  {
    step: 3,
    ko: "음악|BPM과 분위기에 맞는 음악 매칭",
    en: "Music|Match music based on BPM and mood",
    icon: Music,
  },
  {
    step: 4,
    ko: "렌더링|효과와 함께 영상 생성",
    en: "Render|Create your video with effects",
    icon: Wand2,
  },
];

interface ComposeModeProps {
  className?: string;
}

/**
 * Compose Mode - Image + Audio slideshow creation
 * 컴포즈 모드 - 이미지 + 오디오 슬라이드쇼 생성
 */
export function ComposeMode({ className }: ComposeModeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pick } = useT();

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  // Trend context state (from TikTok trending or keyword analysis)
  const [trendContext, setTrendContext] = useState<TrendVideoContext | null>(null);

  // Load trend context when coming from trend tile
  useEffect(() => {
    const fromTrend = searchParams.get("from_trend");
    if (fromTrend === "true") {
      const context = getTrendContext();
      if (context) {
        setTrendContext(context);
        // Store hashtags for compose page to use
        const hashtags = getSuggestedHashtags(context);
        sessionStorage.setItem("trend_hashtags", JSON.stringify(hashtags));
        // Store video description for script generation
        if (context.video.description) {
          sessionStorage.setItem("trend_description", context.video.description);
        }
        // Store AI insights for script suggestions
        if (context.aiInsights) {
          sessionStorage.setItem("trend_ai_insights", JSON.stringify(context.aiInsights));
        }
      }
    }
  }, [searchParams]);

  // Clear trend context
  const handleClearTrendContext = () => {
    setTrendContext(null);
    clearTrendContext();
    sessionStorage.removeItem("trend_hashtags");
    sessionStorage.removeItem("trend_description");
    sessionStorage.removeItem("trend_ai_insights");
  };

  // Format count helper
  const formatCount = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const handleStartCompose = () => {
    if (selectedCampaign) {
      router.push(`/campaigns/${selectedCampaign}/compose`);
    }
  };

  // Helper to parse "title|description" format
  const parseStep = (step: ComposeStep) => {
    const text = pick(step.ko, step.en);
    const [title, desc] = text.split("|");
    return { title, desc };
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Trend Context Banner - shown when coming from trend tile */}
      {trendContext && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Thumbnail */}
              {trendContext.video.thumbnailUrl && (
                <div className="relative w-16 flex-shrink-0">
                  <div className="aspect-[9/16] rounded-lg overflow-hidden bg-muted">
                    <img
                      src={trendContext.video.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-primary">
                      {pick("트렌드 기반 컴포즈", "Trend-Based Compose")}
                    </span>
                    {trendContext.keyword && (
                      <Badge variant="secondary" className="text-xs">
                        #{trendContext.keyword}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={handleClearTrendContext}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-1">
                  @{trendContext.video.authorName}
                  {trendContext.video.description && ` · ${trendContext.video.description}`}
                </p>

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatCount(trendContext.stats.playCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {formatCount(trendContext.stats.likeCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {trendContext.stats.engagementRate.toFixed(2)}%
                  </span>
                </div>

                {/* Hashtags */}
                {trendContext.hashtags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    {trendContext.hashtags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {trendContext.hashtags.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{trendContext.hashtags.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* AI Insights hint */}
                {trendContext.aiInsights && (
                  <p className="text-xs text-primary/80 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {pick(
                      "AI 인사이트가 스크립트 생성에 활용됩니다",
                      "AI insights will enhance script generation"
                    )}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two column layout for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Column - How It Works */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl">
              {pick("컴포즈 영상 생성 방식", "How Compose Video Works")}
            </CardTitle>
            <CardDescription>
              {pick(
                "4단계로 컴포즈 영상을 만드세요",
                "Create Compose videos in 4 simple steps"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {composeSteps.map((step) => {
                const { title, desc } = parseStep(step);
                return (
                  <div key={step.step} className="relative">
                    <div className="flex flex-col items-center text-center p-6 bg-muted/30 rounded-xl">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <step.icon className="h-7 w-7 text-primary" />
                      </div>
                      <div className="text-2xl font-bold text-primary mb-1">
                        {step.step}
                      </div>
                      <div className="font-semibold text-lg">{title}</div>
                      <p className="text-sm text-muted-foreground mt-2">{desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Campaign Selection & Info */}
        <div className="flex flex-col gap-6">
          {/* Campaign Selection */}
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FolderOpen className="h-6 w-6" />
                {pick("캠페인 선택", "Select Campaign")}
              </CardTitle>
              <CardDescription>
                {pick(
                  "캠페인을 선택하여 에셋에 접근하고 컴포즈 영상을 저장하세요",
                  "Choose a campaign to access your assets and save the Compose video"
                )}
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
                  onClick={handleStartCompose}
                  disabled={!selectedCampaign}
                >
                  <Wand2 className="h-5 w-5 mr-2" />
                  {selectedCampaign
                    ? pick("컴포즈 시작", "Start Compose")
                    : pick("캠페인을 선택하세요", "Select Campaign to Continue")}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Why Compose */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {pick("컴포즈 영상을 사용하는 경우", "When to use Compose Video")}
                  </h3>
                  <ul className="text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("기존 이미지를 영상으로 만들고 싶을 때", "You have existing images you want to turn into a video")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("특정 음악에 비주얼을 맞추고 싶을 때", "You want to sync visuals to specific music")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("소셜 미디어용 빠른 콘텐츠가 필요할 때", "You need quick content for social media")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {pick("트렌딩 키워드와 TikTok SEO를 활용하고 싶을 때", "You want to leverage trending keywords and TikTok SEO")}
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
